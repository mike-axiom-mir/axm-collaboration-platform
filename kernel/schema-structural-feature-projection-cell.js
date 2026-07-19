'use strict';

const State = require('./state-language');

const CELL_ID = 'axm.mirror.cell/schema-structural-feature-projection-v1';
const SELECTOR_SCHEMA = 'axm.mirror.structural-feature-selector/v1';
const MAX_RULES = 64;
const MAX_ARRAY_ITEMS = 256;
const MAX_PATH_DEPTH = 16;
const MODES = new Set(['BOOLEAN', 'ENUM', 'PRESENCE']);
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function clean(value, maximum = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum);
}

function token(value, maximum = 120) {
  return clean(value, maximum).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function pathSegment(value) {
  const segment = clean(value, 80);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(segment)) return '';
  return segment;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) { return State.digest(stable(value), 64); }

function scalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return token(value, 80);
  throw new Error('structural selector values must be finite scalar machine tokens');
}

function normalizeSelector(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema !== SELECTOR_SCHEMA) throw new Error('invalid structural feature selector');
  const unexpectedTop = Object.keys(value).filter(key => !['schema', 'selectorId', 'sourceSchema', 'rules', 'authority', 'boundary', 'selectorDigest'].includes(key));
  if (unexpectedTop.length) throw new Error(`structural feature selector has unknown fields: ${unexpectedTop.join(', ')}`);
  const selectorId = token(value.selectorId, 160);
  const sourceSchema = token(value.sourceSchema, 200);
  const rules = Array.isArray(value.rules) ? value.rules : [];
  if (!selectorId || !sourceSchema || !rules.length || rules.length > MAX_RULES) throw new Error('structural feature selector identity or rule count is invalid');
  const seen = new Set();
  const normalizedRules = rules.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error(`structural selector rule ${index} must be an object`);
    const unexpected = Object.keys(rule).filter(key => !['path', 'mode', 'allowedValues', 'positiveValues'].includes(key));
    if (unexpected.length) throw new Error(`structural selector rule ${index} has unknown fields: ${unexpected.join(', ')}`);
    const path = Array.isArray(rule.path) ? rule.path.map(segment => segment === '*' ? '*' : pathSegment(segment)) : [];
    if (!path.length || path.length > MAX_PATH_DEPTH || path.some(segment => !segment || FORBIDDEN_SEGMENTS.has(segment.toLowerCase()))) throw new Error(`structural selector rule ${index} path is invalid`);
    const pathKey = path.join('.');
    if (seen.has(pathKey)) throw new Error(`structural selector path is duplicated: ${pathKey}`);
    seen.add(pathKey);
    const mode = clean(rule.mode, 20).toUpperCase();
    if (!MODES.has(mode)) throw new Error(`structural selector rule ${index} mode is invalid`);
    const allowedValues = Array.from(new Set((Array.isArray(rule.allowedValues) ? rule.allowedValues : []).map(scalar))).sort();
    const positiveValues = Array.from(new Set((Array.isArray(rule.positiveValues) ? rule.positiveValues : []).map(scalar))).sort();
    if (mode === 'BOOLEAN' && (allowedValues.length || positiveValues.some(item => !['true', 'false'].includes(item)))) throw new Error(`structural selector boolean rule ${index} is invalid`);
    if (mode === 'ENUM' && (!allowedValues.length || allowedValues.length > 32 || positiveValues.some(item => !allowedValues.includes(item)))) throw new Error(`structural selector enum rule ${index} is invalid`);
    if (mode === 'PRESENCE' && (allowedValues.length || positiveValues.some(item => !['missing', 'present'].includes(item)))) throw new Error(`structural selector presence rule ${index} is invalid`);
    if (!positiveValues.length) throw new Error(`structural selector rule ${index} has no positive structural value`);
    return { path, mode, allowedValues, positiveValues };
  });
  const normalized = {
    schema: SELECTOR_SCHEMA,
    selectorId,
    sourceSchema,
    rules: normalizedRules,
    authority: {
      proseSelection: false,
      decisionAuthority: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: clean(value.boundary, 2000) || 'Only explicitly selected finite machine fields may become structural observations.'
  };
  normalized.selectorDigest = digest(normalized);
  if (value.selectorDigest && value.selectorDigest !== normalized.selectorDigest) throw new Error('structural feature selector digest changed');
  if (value.authority && JSON.stringify(value.authority) !== JSON.stringify(normalized.authority)) throw new Error('structural feature selector authority changed');
  return normalized;
}

function collect(value, path, index = 0, preserveTerminalAbsence = false) {
  if (index === path.length) return [value];
  const segment = path[index];
  if (segment === '*') {
    if (!Array.isArray(value)) return [];
    if (value.length > MAX_ARRAY_ITEMS) throw new Error(`structural projection array exceeds ${MAX_ARRAY_ITEMS} items`);
    return value.flatMap(item => collect(item, path, index + 1, preserveTerminalAbsence));
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  if (!Object.prototype.hasOwnProperty.call(value, segment)) return preserveTerminalAbsence && index === path.length - 1 ? [undefined] : [];
  return collect(value[segment], path, index + 1, preserveTerminalAbsence);
}

function observe(rule, source) {
  const raw = collect(source, rule.path, 0, rule.mode === 'PRESENCE');
  const values = [];
  for (const value of raw) {
    let observed;
    if (rule.mode === 'PRESENCE') observed = value == null || value === '' ? 'missing' : 'present';
    else if (rule.mode === 'BOOLEAN') {
      if (typeof value !== 'boolean') throw new Error(`selected BOOLEAN field is not boolean: ${rule.path.join('.')}`);
      observed = value ? 'true' : 'false';
    } else {
      observed = scalar(value);
      if (!rule.allowedValues.includes(observed)) throw new Error(`selected ENUM field is outside its declaration: ${rule.path.join('.')}`);
    }
    values.push(observed);
  }
  return Array.from(new Set(values)).sort();
}

function project(source, selectorValue) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('structural projection source must be an object');
  const selector = normalizeSelector(selectorValue);
  if (token(source.schema, 200) !== selector.sourceSchema) throw new Error('structural projection source schema mismatch');
  const namespace = selector.sourceSchema.replace(/^axm\.mirror\./, '').replace(/\//g, '-');
  const observations = selector.rules.map(rule => {
    const values = observe(rule, source);
    const path = rule.path.map(segment => segment === '*' ? 'any' : token(segment, 80)).join('.');
    const positive = values.filter(item => rule.positiveValues.includes(item));
    const negative = values.filter(item => !rule.positiveValues.includes(item));
    return {
      path,
      mode: rule.mode,
      observedValues: values,
      positiveValues: positive,
      nonPositiveValues: negative,
      observations: values.length
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
  const features = Array.from(new Set(observations.flatMap(item => item.positiveValues.map(value => `structural-fact:${namespace}:${item.path}:${value}`)))).sort();
  const negativeFeatures = Array.from(new Set(observations.flatMap(item => item.nonPositiveValues.map(value => `structural-negative:${namespace}:${item.path}:${value}`)))).sort();
  const unknowns = observations.filter(item => !item.observedValues.length).map(item => `NO_SELECTED_VALUE:${item.path}`).sort();
  const selectionBasis = { sourceSchema: selector.sourceSchema, observations };
  return {
    cell: { id: CELL_ID, learnedWeights: false },
    selector,
    sourceSelectionDigest: digest(selectionBasis),
    observations,
    features,
    negativeFeatures,
    unknowns,
    summary: {
      rules: selector.rules.length,
      rulesObserved: observations.filter(item => item.observations > 0).length,
      positiveStructuralFeatures: features.length,
      nonPositiveStructuralFeatures: negativeFeatures.length,
      proseFieldsRead: 0,
      idsRead: 0,
      decisionsMade: 0,
      permissionsGranted: 0,
      trainingAdmissions: 0,
      worldActions: 0
    },
    authority: {
      sourceRead: true,
      semanticTruthWrite: false,
      evidenceAdmission: false,
      decisionAuthority: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Only finite machine values at selector-declared paths are projected. Unselected prose, identifiers, source references, and object keys have no feature or decision authority.'
  };
}

module.exports = { CELL_ID, SELECTOR_SCHEMA, MAX_RULES, MAX_ARRAY_ITEMS, MAX_PATH_DEPTH, normalizeSelector, project, digest };
