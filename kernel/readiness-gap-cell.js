'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/readiness-gap-v1';
const SCHEMA = 'axm.mirror.readiness-gap-assessment/v1';
const MAX_MODULES = 64;
const MAX_ROUTES = 256;
const MISSING_PROBE_DETAILS = new Set(['no live readiness source declared', 'no readiness probe declared']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}

function digest(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex');
}

function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function sha(value, field) { const result = clean(value, 64).toLowerCase(); if (!/^[a-f0-9]{64}$/.test(result)) throw new Error(`${field} must be sha256`); return result; }

function normalizeObservation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('readiness gap observation must be an object');
  const moduleId = clean(value.moduleId, 120);
  const state = clean(value.state, 40).toUpperCase();
  const detail = clean(value.detail, 500);
  if (!moduleId || state !== 'UNKNOWN' || !detail) throw new Error('readiness gap observations must be attributed UNKNOWN states');
  return {
    moduleId,
    state,
    detail,
    evidenceMatchesGraph: value.evidenceMatchesGraph === true,
    manifestRelativePath: clean(value.manifestRelativePath, 300),
    manifestSha256: sha(value.manifestSha256, 'manifestSha256'),
    contractRelativePath: clean(value.contractRelativePath, 300),
    contractSha256: sha(value.contractSha256, 'contractSha256')
  };
}

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('readiness gap input is required');
  const unexpected = Object.keys(input).filter(key => !['sourceReadinessBatchId', 'sourceReadinessBatchDigest', 'sourceStateDigest', 'requirementId', 'observations', 'impactedRouteIds'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical readiness gap fields: ${unexpected.join(', ')}`);
  const sourceReadinessBatchId = clean(input.sourceReadinessBatchId, 160);
  const sourceReadinessBatchDigest = sha(input.sourceReadinessBatchDigest, 'sourceReadinessBatchDigest');
  const sourceStateDigest = sha(input.sourceStateDigest, 'sourceStateDigest');
  const requirementId = clean(input.requirementId, 120);
  if (!sourceReadinessBatchId || !requirementId) throw new Error('readiness gap source and requirement are required');
  if (!Array.isArray(input.observations) || !input.observations.length || input.observations.length > MAX_MODULES) throw new Error('readiness gap observations are missing or unbounded');
  const observations = input.observations.map(normalizeObservation).sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  if (new Set(observations.map(item => item.moduleId)).size !== observations.length) throw new Error('readiness gap module observations must be unique');
  if (!Array.isArray(input.impactedRouteIds) || !input.impactedRouteIds.length || input.impactedRouteIds.length > MAX_ROUTES) throw new Error('readiness gap impacted routes are missing or unbounded');
  const impactedRouteIds = input.impactedRouteIds.map(item => clean(item, 160)).sort();
  if (impactedRouteIds.some(item => !item) || new Set(impactedRouteIds).size !== impactedRouteIds.length) throw new Error('readiness gap route IDs must be present and unique');
  const graphBound = observations.every(item => item.evidenceMatchesGraph && item.manifestRelativePath && item.contractRelativePath);
  const missingProbeDeclaration = observations.every(item => MISSING_PROBE_DETAILS.has(item.detail.toLowerCase()));
  const classification = graphBound && missingProbeDeclaration ? 'MISSING_PROBE_HAND_CANDIDATE' : 'UNKNOWN_INSPECTION_REQUIRED';
  const assessment = {
    schema: SCHEMA,
    cellId: CELL_ID,
    assessmentDigest: null,
    sourceReadinessBatchId,
    sourceReadinessBatchDigest,
    sourceStateDigest,
    requirementId,
    observations,
    impactedRouteIds,
    classification,
    counts: { observedModules: observations.length, impactedRoutes: impactedRouteIds.length },
    authority: {
      readinessClaim: false,
      probeCodeGeneration: false,
      fileWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      trainingAdmission: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'This cell distinguishes a missing probe declaration from other UNKNOWN readiness. It can assess route impact but cannot claim readiness, generate code, install, start, repair, grant, train, execute, or promote.'
  };
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return assessment;
}

function verify(assessment) {
  if (!assessment || assessment.schema !== SCHEMA || assessment.cellId !== CELL_ID) throw new Error('invalid readiness gap assessment');
  const expected = evaluate({
    sourceReadinessBatchId: assessment.sourceReadinessBatchId,
    sourceReadinessBatchDigest: assessment.sourceReadinessBatchDigest,
    sourceStateDigest: assessment.sourceStateDigest,
    requirementId: assessment.requirementId,
    observations: assessment.observations,
    impactedRouteIds: assessment.impactedRouteIds
  });
  if (assessment.assessmentDigest !== expected.assessmentDigest) throw new Error('readiness gap assessment digest mismatch');
  if (JSON.stringify(stable(assessment)) !== JSON.stringify(stable(expected))) throw new Error('readiness gap assessment content mismatch');
  return true;
}

module.exports = { CELL_ID, SCHEMA, MAX_MODULES, MAX_ROUTES, MISSING_PROBE_DETAILS, digest, evaluate, verify };
