'use strict';

const C = require('./core');
const VisualKernel = require('../visual-kernel/visual-kernel');

const CAPABILITY = 'visual.inspect.accessibility/v1';
const RECEIPT_SCHEMA = 'axm.visual-accessibility-observation/v1';
const DEFAULT_POLICY = Object.freeze({ normalTextContrast: 4.5, largeTextContrast: 3, uiComponentContrast: 3, minimumTargetPx: 44, minimumCriticalTextPx: 10 });

function policy(input) {
  input = input || {};
  function bounded(name, fallback, min, max) {
    const value = Number(input[name]);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }
  return {
    normalTextContrast: bounded('normalTextContrast', DEFAULT_POLICY.normalTextContrast, 1, 21),
    largeTextContrast: bounded('largeTextContrast', DEFAULT_POLICY.largeTextContrast, 1, 21),
    uiComponentContrast: bounded('uiComponentContrast', DEFAULT_POLICY.uiComponentContrast, 1, 21),
    minimumTargetPx: bounded('minimumTargetPx', DEFAULT_POLICY.minimumTargetPx, 1, 256),
    minimumCriticalTextPx: bounded('minimumCriticalTextPx', DEFAULT_POLICY.minimumCriticalTextPx, 1, 72)
  };
}

function aggregate(checks) {
  if (checks.some(function (check) { return check.verdict === 'FAIL'; })) return 'FAIL';
  if (checks.some(function (check) { return check.verdict === 'UNKNOWN'; })) return 'UNKNOWN';
  return 'PASS';
}

function measuredId(value, label) {
  try { return C.assertExactIdentifier(value, label); }
  catch (_) { return null; }
}

function inspectProperties(measured, floor, maxElements) {
  measured = measured || {};
  const groups = ['contrastPairs', 'interactiveTargets', 'criticalText', 'signals'];
  const suppliedCount = groups.reduce(function (sum, name) { return sum + (Array.isArray(measured[name]) ? measured[name].length : 0); }, 0);
  if (suppliedCount > maxElements) return { overBudget: true, rules: {}, unknownRules: groups.slice(), violations: [] };

  const rules = {};
  if (!Array.isArray(measured.contrastPairs)) {
    rules.contrast = { verdict: 'UNKNOWN', checks: [] };
  } else {
    const checks = measured.contrastPairs.map(function (row) {
      const id = measuredId(row && row.id, 'contrast pair id'), foreground = String(row && row.foreground || '').toLowerCase(), background = String(row && row.background || '').toLowerCase();
      const role = ['normal-text', 'large-text', 'ui-component'].includes(row && row.role) ? row.role : 'normal-text';
      const minimum = role === 'large-text' ? floor.largeTextContrast : (role === 'ui-component' ? floor.uiComponentContrast : floor.normalTextContrast);
      if (!id || !/^#[a-f0-9]{6}$/.test(foreground) || !/^#[a-f0-9]{6}$/.test(background)) return { id: id || 'invalid-measurement-id', role, ratio: null, minimum, verdict: 'UNKNOWN' };
      const ratio = Number(VisualKernel.contrastRatio(foreground, background).toFixed(3));
      return { id, role, ratio, minimum, verdict: ratio >= minimum ? 'PASS' : 'FAIL' };
    });
    rules.contrast = { verdict: aggregate(checks), checks };
  }

  if (!Array.isArray(measured.interactiveTargets)) {
    rules.targetSize = { verdict: 'UNKNOWN', checks: [] };
  } else {
    const checks = measured.interactiveTargets.map(function (row) {
      const id = measuredId(row && row.id, 'target id'), widthPx = Number(row && row.widthPx), heightPx = Number(row && row.heightPx);
      if (!id || !Number.isFinite(widthPx) || widthPx < 0 || !Number.isFinite(heightPx) || heightPx < 0) return { id: id || 'invalid-measurement-id', widthPx: null, heightPx: null, minimumPx: floor.minimumTargetPx, verdict: 'UNKNOWN' };
      return { id, widthPx, heightPx, minimumPx: floor.minimumTargetPx, verdict: Math.min(widthPx, heightPx) >= floor.minimumTargetPx ? 'PASS' : 'FAIL' };
    });
    rules.targetSize = { verdict: aggregate(checks), checks };
  }

  if (!Array.isArray(measured.criticalText)) {
    rules.criticalText = { verdict: 'UNKNOWN', checks: [] };
  } else {
    const checks = measured.criticalText.map(function (row) {
      const id = measuredId(row && row.id, 'critical text id'), fontSizePx = Number(row && row.fontSizePx);
      if (!id || !Number.isFinite(fontSizePx) || fontSizePx < 0) return { id: id || 'invalid-measurement-id', fontSizePx: null, minimumPx: floor.minimumCriticalTextPx, verdict: 'UNKNOWN' };
      return { id, fontSizePx, minimumPx: floor.minimumCriticalTextPx, verdict: fontSizePx >= floor.minimumCriticalTextPx ? 'PASS' : 'FAIL' };
    });
    rules.criticalText = { verdict: aggregate(checks), checks };
  }

  if (!Array.isArray(measured.signals)) {
    rules.visibleSignalParity = { verdict: 'UNKNOWN', checks: [] };
  } else {
    const checks = measured.signals.map(function (row) {
      const id = measuredId(row && row.id, 'signal id');
      if (!id || typeof (row && row.usesSound) !== 'boolean' || typeof (row && row.visibleEquivalent) !== 'boolean') return { id: id || 'invalid-measurement-id', usesSound: null, visibleEquivalent: null, verdict: 'UNKNOWN' };
      return { id, usesSound: row.usesSound, visibleEquivalent: row.visibleEquivalent, verdict: !row.usesSound || row.visibleEquivalent ? 'PASS' : 'FAIL' };
    });
    rules.visibleSignalParity = { verdict: aggregate(checks), checks };
  }

  if (Object.prototype.hasOwnProperty.call(measured, 'coverage')) {
    const coverage = measured.coverage;
    const valid = coverage && typeof coverage === 'object' && typeof coverage.complete === 'boolean' && Number.isFinite(Number(coverage.inspectedElements)) && Number.isFinite(Number(coverage.discoveredElements)) && Number.isFinite(Number(coverage.measurementCount)) && Number.isFinite(Number(coverage.maxElements));
    const check = valid ? {
      id: 'measurement-coverage',
      complete: coverage.complete,
      inspectedElements: Number(coverage.inspectedElements),
      discoveredElements: Number(coverage.discoveredElements),
      measurementCount: Number(coverage.measurementCount),
      maxElements: Number(coverage.maxElements),
      verdict: coverage.complete ? 'PASS' : 'UNKNOWN'
    } : { id: 'measurement-coverage', complete: null, verdict: 'UNKNOWN' };
    rules.coverage = { verdict: check.verdict, checks: [check] };
  }

  const unknownRules = Object.keys(rules).filter(function (name) { return rules[name].verdict === 'UNKNOWN'; });
  const violations = [];
  Object.keys(rules).forEach(function (name) { rules[name].checks.filter(function (check) { return check.verdict === 'FAIL'; }).forEach(function (check) { violations.push({ rule: name, measurementId: check.id }); }); });
  return { overBudget: false, rules, unknownRules, violations, suppliedCount };
}

function create(options) {
  options = options || {};
  const store = C.createReceiptStore(options.receiptLimit);
  const readComputedStyles = options.readComputedStyles;
  const maxElements = Math.max(1, Math.min(200, Math.round(Number(options.maxElements) || 200)));

  function seal(input, details) {
    return store.push(Object.assign({
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      claim: C.compact(input.claim, 500),
      targetId: C.compact(input.targetId, 500),
      observedAt: C.now(input.observedAt),
      floorPolicy: policy(input.floorPolicy),
      measurementSource: 'none',
      adapterReceiptDigest: null,
      adapterNamedSeams: [],
      measurementCoverage: null,
      measuredElementCount: 0,
      rules: {},
      unknownRules: ['contrast', 'targetSize', 'criticalText', 'visibleSignalParity'],
      violations: [],
      verdict: 'UNKNOWN',
      namedSeams: ['COMPUTED_STYLE_ADAPTER_NOT_INJECTED'],
      contentInspected: false,
      rawPixelsRetained: false,
      measuredPropertiesRetained: false,
      recommendationOnly: true,
      tookNoDirectAction: true,
      rawRetainedBytesAfterSeal: 0,
      rawRetainedItemsAfterSeal: 0,
      cleanupComplete: true,
      nextCheapestInspection: 'Supply bounded measured properties or install a reviewed ui.render.computed-style/v1 host adapter.'
    }, details || {}));
  }

  async function inspect(input) {
    input = input || {};
    const targetId = C.assertExactIdentifier(input.targetId, 'targetId');
    const normalized = Object.assign({}, input, { targetId });
    let measured = input.measuredProperties, source = measured ? 'supplied-properties' : 'none', adapterReceiptDigest = null, adapterNamedSeams = [], measurementCoverage = measured && measured.coverage || null;
    if (!measured && typeof readComputedStyles === 'function') {
      try {
        const response = await readComputedStyles({ targetId, maxElements });
        if (!response || response.schema !== 'axm.ui-computed-style-measurements/v1' || response.capability !== 'ui.render.computed-style/v1' || response.version !== '1.0.0' || response.contentInspected !== false || response.rawPixelsRetained !== false || response.mutatedSurface !== false) {
          return seal(normalized, { namedSeams: ['COMPUTED_STYLE_ADAPTER_CONTRACT_MISMATCH'], nextCheapestInspection: 'Use a reviewed ui.render.computed-style/v1 adapter that returns the exact bounded measurement contract.' });
        }
        if (!response || C.compact(response.targetId, 500) !== targetId) return seal(normalized, { namedSeams: ['COMPUTED_STYLE_TARGET_MISMATCH'], nextCheapestInspection: 'Return measurements for the exact requested targetId.' });
        measured = response.measuredProperties;
        source = 'host-adapter';
        adapterReceiptDigest = C.digest(response);
        adapterNamedSeams = (response.namedSeams || []).slice(0, 20).map(function (seam) { return C.compact(seam, 160); }).filter(Boolean);
        measurementCoverage = response.coverage || measured && measured.coverage || null;
      } catch (error) {
        return seal(normalized, { namedSeams: ['UI_COMPUTED_STYLE_ADAPTER_ERROR'], nextCheapestInspection: C.compact(error && error.message, 180) });
      }
    }
    if (!measured || typeof measured !== 'object') return seal(normalized);

    const floor = policy(input.floorPolicy), result = inspectProperties(measured, floor, maxElements);
    if (result.overBudget) return seal(normalized, { measurementSource: source, namedSeams: ['MEASUREMENT_BUDGET_EXCEEDED'], nextCheapestInspection: 'Reduce the supplied measurement set to at most ' + maxElements + ' elements.' });
    const ruleVerdicts = Object.keys(result.rules).map(function (name) { return result.rules[name].verdict; });
    const verdict = ruleVerdicts.includes('FAIL') ? 'FAIL' : (ruleVerdicts.includes('UNKNOWN') ? 'UNKNOWN' : 'PASS');
    const seams = adapterNamedSeams.slice();
    if (result.violations.length) seams.push('ACCESSIBILITY_FLOOR_VIOLATION');
    result.unknownRules.forEach(function (name) { seams.push(String(name).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase() + '_UNKNOWN'); });
    return seal(normalized, {
      floorPolicy: floor,
      measurementSource: source,
      adapterReceiptDigest,
      adapterNamedSeams,
      measurementCoverage,
      measuredElementCount: result.suppliedCount,
      rules: result.rules,
      unknownRules: result.unknownRules,
      violations: result.violations,
      verdict,
      namedSeams: seams,
      nextCheapestInspection: verdict === 'FAIL'
        ? 'Route the measured violations to a builder; this sense never restyles the surface.'
        : (verdict === 'UNKNOWN' ? 'Supply the missing or invalid measurement groups; partial input is never a pass.' : 'Preserve this bounded floor receipt; a full accessibility audit remains a separate claim.')
    });
  }

  return {
    capability: CAPABILITY,
    inspect,
    receipts: store.list,
    status: function () { return C.status(store, { maxElements, computedStyleAdapterAvailable: typeof readComputedStyles === 'function', measuredPropertiesRetained: false }); }
  };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, DEFAULT_POLICY, policy, aggregate, inspectProperties, create };
