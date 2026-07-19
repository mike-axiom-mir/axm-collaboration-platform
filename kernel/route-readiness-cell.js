'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/route-readiness-v1';
const SCHEMA = 'axm.mirror.route-readiness-assessment/v1';
const MAX_MODULES = 3;
const MAX_REQUIREMENTS_PER_MODULE = 32;
const STATES = new Set(['READY', 'AVAILABLE', 'OPTIONAL', 'USER_ACTION', 'OFFLINE', 'TRIPPED', 'UNKNOWN']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function clean(value, maximum = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum);
}

function sha(value, field) {
  const result = clean(value, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error(`${field} must be a sha256 digest`);
  return result;
}

function classify(requirements) {
  const states = requirements.map(item => item.state);
  if (states.some(state => ['OFFLINE', 'TRIPPED', 'UNKNOWN'].includes(state))) return 'BLOCKED';
  if (states.some(state => state === 'USER_ACTION')) return 'NEEDS_ACTION';
  if (states.some(state => ['AVAILABLE', 'OPTIONAL'].includes(state))) return 'AVAILABLE';
  return 'READY';
}

function normalizeRequirement(value, moduleId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${moduleId} readiness requirement must be an object`);
  const id = clean(value.id, 120);
  const state = clean(value.state, 40).toUpperCase();
  if (!id || !STATES.has(state)) throw new Error(`${moduleId} readiness requirement has an unsupported id or state`);
  return { id, state, detail: clean(value.detail, 500) || 'No detail supplied by readiness source.' };
}

function normalizeModule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('route readiness module record must be an object');
  const moduleId = clean(value.moduleId, 120);
  if (!moduleId || !Array.isArray(value.requirements) || value.requirements.length > MAX_REQUIREMENTS_PER_MODULE) throw new Error('route readiness module record is invalid or unbounded');
  const requirements = value.requirements.map(item => normalizeRequirement(item, moduleId)).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(requirements.map(item => item.id)).size !== requirements.length) throw new Error(`${moduleId} readiness requirements must be unique`);
  return {
    moduleId,
    evidenceMatchesGraph: value.evidenceMatchesGraph === true,
    requirements
  };
}

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('route readiness input is required');
  const unexpected = Object.keys(input).filter(key => !['sourceStateDigest', 'route', 'modules'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical route readiness fields: ${unexpected.join(', ')}`);
  const sourceStateDigest = sha(input.sourceStateDigest, 'sourceStateDigest');
  if (!input.route || typeof input.route !== 'object' || Array.isArray(input.route)) throw new Error('route identity is required');
  const routeId = clean(input.route.routeId, 160);
  const moduleIds = Array.isArray(input.route.moduleIds) ? input.route.moduleIds.map(item => clean(item, 120)) : [];
  if (!routeId || moduleIds.length < 2 || moduleIds.length > MAX_MODULES || moduleIds.some(item => !item) || new Set(moduleIds).size !== moduleIds.length) throw new Error('route readiness requires a bounded non-cyclic module route');
  if (!Array.isArray(input.modules) || input.modules.length !== moduleIds.length) throw new Error('route readiness requires one module record per route module');
  const byId = new Map(input.modules.map(item => {
    const normalized = normalizeModule(item);
    return [normalized.moduleId, normalized];
  }));
  if (byId.size !== input.modules.length || moduleIds.some(moduleId => !byId.has(moduleId))) throw new Error('route readiness module evidence does not match the route');
  const modules = moduleIds.map(moduleId => byId.get(moduleId));
  const moduleAssessments = modules.map(module => ({
    moduleId: module.moduleId,
    evidenceMatchesGraph: module.evidenceMatchesGraph,
    state: classify(module.requirements),
    requirements: module.requirements
  }));
  const flattened = moduleAssessments.flatMap(module => module.requirements.map(requirement => Object.assign({ moduleId: module.moduleId }, requirement)));
  const routeState = classify(flattened);
  const attention = flattened.filter(item => item.state !== 'READY');
  const assessment = {
    schema: SCHEMA,
    cellId: CELL_ID,
    assessmentDigest: null,
    sourceStateDigest,
    route: { routeId, moduleIds },
    modules: moduleAssessments,
    routeState,
    attention,
    counts: {
      modules: moduleAssessments.length,
      requirements: flattened.length,
      ready: flattened.filter(item => item.state === 'READY').length,
      availableOrOptional: flattened.filter(item => ['AVAILABLE', 'OPTIONAL'].includes(item.state)).length,
      needsAction: flattened.filter(item => item.state === 'USER_ACTION').length,
      unavailable: flattened.filter(item => ['OFFLINE', 'TRIPPED'].includes(item.state)).length,
      unknown: flattened.filter(item => item.state === 'UNKNOWN').length
    },
    authority: {
      candidateExecution: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      runtimeReadinessMutation: false,
      trainingAdmission: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'This cell classifies supplied typed readiness observations. It cannot probe, start, repair, grant, execute, train, or promote. UNKNOWN and stale evidence remain blocking.'
  };
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return assessment;
}

function verify(assessment) {
  if (!assessment || assessment.schema !== SCHEMA || assessment.cellId !== CELL_ID) throw new Error('invalid route readiness assessment');
  const expected = evaluate({
    sourceStateDigest: assessment.sourceStateDigest,
    route: assessment.route,
    modules: assessment.modules.map(module => ({
      moduleId: module.moduleId,
      evidenceMatchesGraph: module.evidenceMatchesGraph,
      requirements: module.requirements
    }))
  });
  if (assessment.assessmentDigest !== expected.assessmentDigest) throw new Error('route readiness assessment digest mismatch');
  if (JSON.stringify(stable(assessment)) !== JSON.stringify(stable(expected))) throw new Error('route readiness assessment content mismatch');
  return true;
}

module.exports = { CELL_ID, SCHEMA, MAX_MODULES, MAX_REQUIREMENTS_PER_MODULE, STATES, digest, classify, evaluate, verify };
