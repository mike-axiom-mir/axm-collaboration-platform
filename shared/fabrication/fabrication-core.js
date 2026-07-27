(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMFabrication = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.1.0';
  var EVALUATION_SCHEMA = 'axm.fabrication-readiness-evaluation/v1';
  var PACKAGE_SCHEMA = 'axm.fabrication-bounded-test-package/v1';
  var PROCESS_FAMILIES = ['filament-3d', 'resin-3d', 'full-colour-3d', 'uv-surface', 'laser-cut-engrave', 'cnc', 'hybrid'];
  var DIGEST = /^[a-f0-9]{64}$/;

  function clone(value) { return JSON.parse(JSON.stringify(value == null ? null : value)); }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function pass(receipt) { return receipt && receipt.status === 'PASS' && DIGEST.test(text(receipt.digest)); }
  function exactDigest(value) { return DIGEST.test(text(value)); }
  function add(list, id, detail) { list.push({ id: id, detail: detail }); }

  function evaluate(candidate) {
    candidate = clone(candidate || {});
    var missing = [], failed = [], holds = [];
    var source = candidate.source || {}, adapter = candidate.adapter || {}, physical = candidate.physical || {};
    var technical = candidate.technical || {}, reviews = candidate.reviews || {}, machine = candidate.machine || {};

    if (candidate.schema !== 'axm.fabrication-candidate/v1') add(failed, 'candidate-schema', 'axm.fabrication-candidate/v1 is required');
    if (!text(candidate.id)) add(missing, 'candidate-id', 'exact candidate id required');
    if (!exactDigest(candidate.digest)) add(missing, 'candidate-digest', '64-character lowercase SHA-256 required');
    if (!text(source.id) || !text(source.version) || !exactDigest(source.digest)) add(missing, 'source-binding', 'source id, version and digest required');
    if (!exactDigest(source.provenanceDigest) || !text(source.licenseId)) add(missing, 'source-provenance', 'provenance digest and license required');
    if (!text(adapter.id) || !text(adapter.version) || PROCESS_FAMILIES.indexOf(adapter.processFamily) < 0) add(missing, 'adapter-contract', 'versioned vendor-neutral process adapter required');
    if (adapter.vendorNeutral !== true) add(failed, 'vendor-neutrality', 'vendor-specific software may be an adapter, never the source of truth');
    if (!text(adapter.standardInterchangeFormat)) add(missing, 'interchange-format', 'standard or openly documented interchange format required');
    if (adapter.automaticExecution !== false) add(failed, 'automatic-execution', 'automatic hardware execution is forbidden');
    if (candidate.hardwareCommand != null) add(failed, 'hardware-command', 'hardware commands do not belong in the digital foundation lane');

    var dims = physical.dimensions || {};
    if (!(Number(dims.widthMm) > 0 && Number(dims.heightMm) > 0 && Number(dims.depthMm) > 0)) add(missing, 'dimensions', 'positive millimetre dimensions required');
    ['scale', 'orientation', 'geometryIntent', 'colourIntent', 'textureIntent', 'materialIntent', 'transparencyIntent', 'strengthRequirement'].forEach(function (field) {
      if (!text(physical[field])) add(missing, 'physical.' + field, field + ' required');
    });
    if (!(Number(physical.toleranceMm) >= 0)) add(missing, 'physical.toleranceMm', 'non-negative tolerance required');
    if (!Array.isArray(physical.safetyNotes) || !physical.safetyNotes.length) add(missing, 'physical.safetyNotes', 'at least one safety note required');

    ['sourceIntegrity', 'formatValidation', 'geometryValidation', 'printability', 'simulation', 'materialCompatibility'].forEach(function (field) {
      var value = technical[field];
      if (value && value.status === 'FAIL') add(failed, 'technical.' + field, 'technical receipt failed');
      else if (!pass(value)) add(holds, 'technical.' + field, 'independent PASS receipt required');
    });

    if (machine.evidenceClass === 'ADVERTISEMENT' || machine.claimsVerified !== true || !exactDigest(machine.profileDigest)) {
      add(holds, 'machine-evidence', 'advertising cannot prove machine quality, openness, safety, cost or repeatability');
    }
    if (machine.vendorAiBypassable !== true) add(holds, 'vendor-ai-bypass', 'independent AXM pipeline must remain usable');
    if (machine.coreOfflineCapable !== true) add(holds, 'offline-core', 'core preparation and export require an offline-capable route');

    var reviewBindings = [
      ['humanVisual', 'APPROVE', 'human visual approval'],
      ['machineCrosscheck', 'RECOMMEND', 'independent machine recommendation'],
      ['humanOperator', 'APPROVE_BOUNDED_TEST', 'human operator approval for one bounded test']
    ];
    reviewBindings.forEach(function (item) {
      var review = reviews[item[0]];
      if (!review || review.action !== item[1] || review.candidateDigest !== candidate.digest || !exactDigest(review.digest)) add(holds, 'review.' + item[0], item[2] + ' bound to candidate digest required');
    });

    var status = 'BOUNDED_EXTERNAL_TEST_PACKAGE_READY';
    if (failed.length) status = 'BLOCKED';
    else if (missing.length) status = 'RESEARCH_HOLD';
    else if (holds.some(function (item) { return item.id.indexOf('technical.') === 0 || item.id.indexOf('machine-') === 0 || item.id === 'vendor-ai-bypass' || item.id === 'offline-core'; })) status = 'TECHNICAL_REVIEW_REQUIRED';
    else if (holds.length) status = 'GOVERNANCE_REVIEW_REQUIRED';

    return {
      schema: EVALUATION_SCHEMA,
      version: VERSION,
      candidateId: text(candidate.id),
      candidateDigest: text(candidate.digest),
      status: status,
      missing: missing,
      failed: failed,
      holds: holds,
      automaticExecution: false,
      hardwareCommand: null,
      purchaseDecision: 'NONE',
      advertisedClaimsPromoted: false,
      nextCheapestStep: failed.length ? 'Repair the first failed contract without weakening it.' : (missing.length ? 'Supply the first missing digital-foundation field.' : (holds.length ? 'Gather the first named native evidence or review receipt.' : 'Export one bounded external test package for an approved operator; do not execute hardware automatically.'))
    };
  }

  function buildBoundedTestPackage(candidate, evaluation) {
    candidate = clone(candidate || {});
    evaluation = clone(evaluation || evaluate(candidate));
    if (evaluation.status !== 'BOUNDED_EXTERNAL_TEST_PACKAGE_READY') throw new Error('fabrication candidate is not approved for a bounded external test package');
    return {
      schema: PACKAGE_SCHEMA,
      version: VERSION,
      candidateId: candidate.id,
      candidateDigest: candidate.digest,
      source: clone(candidate.source),
      adapter: clone(candidate.adapter),
      physical: clone(candidate.physical),
      technicalReceiptDigests: Object.keys(candidate.technical || {}).map(function (key) { return { kind: key, digest: candidate.technical[key].digest }; }),
      reviewReceiptDigests: Object.keys(candidate.reviews || {}).map(function (key) { return { kind: key, digest: candidate.reviews[key].digest }; }),
      machineProfileDigest: candidate.machine.profileDigest,
      scope: 'one-bounded-external-test',
      automaticExecution: false,
      hardwareCommand: null,
      resultReceiptRequired: true,
      resultReceiptSchema: 'axm.fabrication-result-receipt/v1'
    };
  }

  return { VERSION: VERSION, EVALUATION_SCHEMA: EVALUATION_SCHEMA, PACKAGE_SCHEMA: PACKAGE_SCHEMA, PROCESS_FAMILIES: PROCESS_FAMILIES, evaluate: evaluate, buildBoundedTestPackage: buildBoundedTestPackage };
}));
