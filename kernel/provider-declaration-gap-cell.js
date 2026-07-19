'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/provider-declaration-gap-v1';
const SCHEMA = 'axm.mirror.provider-declaration-gap-assessment/v1';
const AFFORDANCE_SCHEMA = 'axm.mirror.readiness-probe-affordance-assessment/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function clean(value, maximum = 300) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !input.affordanceAssessment) throw new Error('provider declaration gap evaluation requires an affordance assessment');
  const unexpected = Object.keys(input).filter(key => key !== 'affordanceAssessment');
  if (unexpected.length) throw new Error(`unknown critical provider declaration gap fields: ${unexpected.join(', ')}`);
  const source = clone(input.affordanceAssessment);
  if (source.schema !== AFFORDANCE_SCHEMA || source.assessmentDigest !== digest(without(source, 'assessmentDigest')) || !clean(source.requirementId) || !Array.isArray(source.providerEvidence) || !Array.isArray(source.consumerBindings)) throw new Error('invalid source readiness affordance assessment');
  const exactPrefix = `service:${source.requirementId}`;
  const bindings = source.consumerBindings.map(binding => {
    const consumes = clean(binding && binding.consumes, 500);
    if (!binding || !clean(binding.moduleId) || !clean(binding.contractRelativePath, 500) || !/^[a-f0-9]{64}$/.test(String(binding.contractSha256 || '')) || (consumes !== exactPrefix && !consumes.startsWith(`${exactPrefix}/`))) throw new Error('consumer binding does not exactly bind the source requirement');
    const selector = consumes === exactPrefix ? null : consumes.slice(exactPrefix.length + 1);
    return {
      moduleId: clean(binding.moduleId),
      contractRelativePath: clean(binding.contractRelativePath, 500),
      contractSha256: String(binding.contractSha256),
      consumes,
      providerSelector: selector || null
    };
  }).sort((a, b) => `${a.moduleId}:${a.consumes}`.localeCompare(`${b.moduleId}:${b.consumes}`));
  const providerSelectors = Array.from(new Set(bindings.map(item => item.providerSelector).filter(Boolean))).sort();
  let classification;
  if (source.providerEvidence.length === 1 && source.recommendation) classification = 'DECLARATION_PRESENT_NO_GAP';
  else if (source.providerEvidence.length > 1 || source.classification === 'HOLD_AMBIGUOUS_EXACT_PROVIDER_DECLARATIONS') classification = 'AMBIGUOUS_PROVIDER_DECLARATIONS_HOLD';
  else if (source.providerEvidence.length === 0 && !source.recommendation && bindings.length > 0) classification = 'PROVIDER_DECLARATION_GAP_CANDIDATE';
  else if (source.providerEvidence.length === 0 && !source.recommendation) classification = 'NO_CONSUMER_BOUND_DECLARATION_GAP_HOLD';
  else throw new Error('source affordance provider classification is contradictory');
  const assessment = {
    schema: SCHEMA,
    cellId: CELL_ID,
    assessmentDigest: null,
    sourceAffordanceAssessmentDigest: source.assessmentDigest,
    sourceClassification: source.classification,
    requirementId: source.requirementId,
    classification,
    consumerBindings: bindings,
    providerSelectors,
    counts: { exactProviderDeclarations: source.providerEvidence.length, consumerBindings: bindings.length, providerSelectors: providerSelectors.length },
    unknowns: classification === 'PROVIDER_DECLARATION_GAP_CANDIDATE'
      ? ['provider identity', 'provider declaration schema', 'provider implementation path', 'runtime health', 'semantic fitness', 'required permissions']
      : [],
    authority: {
      providerIdentityInference: false,
      declarationSchemaSelection: false,
      declarationPathSelection: false,
      codeGeneration: false,
      contractWrite: false,
      workshopWrite: false,
      readinessClaim: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveExecution: false,
      trainingAdmission: false,
      worldAction: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'This cell distinguishes an exact consumer-bound missing provider declaration from no demand, an existing declaration, or ambiguity. Consumer demand identifies a declaration gap, never the provider that fills it.'
  };
  assessment.assessmentDigest = digest(without(assessment, 'assessmentDigest'));
  return assessment;
}

function verify(assessment, affordanceAssessment) {
  const expected = evaluate({ affordanceAssessment });
  if (!assessment || assessment.assessmentDigest !== expected.assessmentDigest || JSON.stringify(stable(assessment)) !== JSON.stringify(stable(expected))) throw new Error('provider declaration gap assessment mismatch');
  return true;
}

module.exports = { CELL_ID, SCHEMA, AFFORDANCE_SCHEMA, digest, evaluate, verify };

