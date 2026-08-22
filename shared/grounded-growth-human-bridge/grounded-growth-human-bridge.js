'use strict';

const crypto = require('crypto');
const CapabilityLoop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Human = require('../human-benefit-evidence/human-benefit-evidence');

const RECEIPT_SCHEMA = 'axm.grounded-growth-human-bridge-receipt/v1';
const BUNDLE_SCHEMA = 'axm.grounded-growth-human-bridge-bundle/v1';
const CLOSURE_SCHEMA = 'axm.grounded-growth-human-closure-receipt/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const TARGET_SCOPES = ['NAMED_LOCAL_STEWARD', 'DECLARED_COHORT'];
const TRUST_MODES = ['NAMED_LOCAL_STEWARD_DECLARATION', 'EXTERNAL_COHORT_AUTHENTICATION'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function exactTimestamp(value, label) {
  const parsed = new Date(value);
  if (value == null || value === '' || Number.isNaN(parsed.getTime())) throw new Error(label + ' must be a valid timestamp');
  return parsed.toISOString();
}

function exactDigest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' must be a SHA-256 digest');
  return result;
}

function normalizeReference(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' reference is required');
  return {
    id: requiredText(input.id, label + ' id', 180),
    schema: requiredText(input.schema, label + ' schema', 180),
    sha256: exactDigest(input.sha256, label + ' sha256')
  };
}

function sameReference(left, right) {
  return Boolean(left && right && left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256);
}

function nativeReference(value, options) {
  const digest = value && DIGEST.test(String(value[options.digestField] || '').toLowerCase())
    ? String(value[options.digestField]).toLowerCase()
    : sha256(value);
  return {
    id: requiredText(value && value[options.idField] ? value[options.idField] : options.fallbackId, options.label + ' id', 180),
    schema: requiredText(value && value.schema ? value.schema : options.fallbackSchema, options.label + ' schema', 180),
    sha256: digest
  };
}

function normalizeBinding(input) {
  input = input || {};
  const targetScope = String(input.targetScope || '').toUpperCase();
  if (!TARGET_SCOPES.includes(targetScope)) throw new Error('binding targetScope is unsupported');
  const sourceTrust = input.sourceTrust || {};
  const interventionLink = input.interventionLink || {};
  const mode = String(sourceTrust.mode || '').toUpperCase();
  if (!TRUST_MODES.includes(mode)) throw new Error('binding sourceTrust mode is unsupported');
  return {
    claimId: requiredText(input.claimId, 'binding claimId', 180),
    capabilityId: requiredText(input.capabilityId, 'binding capabilityId', 180),
    targetScope,
    scopeStatement: requiredText(input.scopeStatement, 'binding scopeStatement', 800),
    interventionLink: {
      relation: requiredText(interventionLink.relation, 'binding interventionLink relation', 180),
      capabilityCandidateRef: normalizeReference(interventionLink.capabilityCandidateRef, 'binding interventionLink capabilityCandidate'),
      evaluatedCandidateRef: normalizeReference(interventionLink.evaluatedCandidateRef, 'binding interventionLink evaluatedCandidate'),
      linkRef: normalizeReference(interventionLink.linkRef, 'binding interventionLink')
    },
    sourceTrust: {
      mode,
      trustRef: normalizeReference(sourceTrust.trustRef, 'binding sourceTrust')
    }
  };
}

function buildClosure(input) {
  input = input || {};
  const state = String(input.state || '').toUpperCase();
  if (!['CURRENT', 'HELD', 'UNKNOWN'].includes(state)) throw new Error('evidenceClosure state is unsupported');
  if (!Array.isArray(input.sources) || !input.sources.length) throw new Error('evidenceClosure sources must be a non-empty array');
  if (input.sources.length > 96) throw new Error('evidenceClosure sources exceeds 96 entries');
  const sources = input.sources.map((source, index) => normalizeReference(source, 'evidenceClosure sources[' + index + ']'))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  if (new Set(sources.map(stableStringify)).size !== sources.length) throw new Error('evidenceClosure sources must be unique');
  const receipt = {
    schema: CLOSURE_SCHEMA,
    version: VERSION,
    closureId: requiredText(input.closureId, 'evidenceClosure closureId', 180),
    state,
    checkedAt: exactTimestamp(input.checkedAt, 'evidenceClosure checkedAt'),
    sources,
    truth: {
      sourceStateDeclaredByCaller: true,
      nativeHumanReceiptsReverifiedByBridge: true,
      externalArtifactBytesVerifiedByClosureModule: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    closureDigest: null
  };
  const payload = clone(receipt);
  delete payload.closureDigest;
  receipt.closureDigest = sha256(payload);
  return receipt;
}

function verifyClosure(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== CLOSURE_SCHEMA) return { pass: false, errors: ['closure schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('closure version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildClosure(receipt);
  } catch (error) {
    errors.push('closure content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('closure content or digest mismatch');
  return { pass: errors.length === 0, errors };
}

function closureSummary(receipt) {
  return {
    state: receipt.state,
    checkedAt: receipt.checkedAt,
    receiptRef: { id: receipt.closureId, schema: CLOSURE_SCHEMA, sha256: receipt.closureDigest },
    coveredDigests: Array.from(new Set(receipt.sources.map((source) => source.sha256))).sort()
  };
}

function conditionReference(evaluation, role) {
  const conditions = evaluation && evaluation.protocol && Array.isArray(evaluation.protocol.conditions)
    ? evaluation.protocol.conditions
    : [];
  const condition = conditions.find((item) => item && item.role === role);
  return condition && condition.artifactRef ? condition.artifactRef : null;
}

function addReason(reasons, code) {
  if (!reasons.includes(code)) reasons.push(code);
}

function classify(cycle, evaluation, judgment, binding, closure, refs, generatedAt) {
  const reasons = [];
  const evaluationCheck = Human.verifyEvaluation(evaluation);
  const judgmentCheck = Human.verifyJudgment(evaluation, judgment);
  if (!evaluationCheck.pass) addReason(reasons, 'INVALID_EVALUATION');
  if (!judgmentCheck.pass) addReason(reasons, 'INVALID_JUDGMENT');

  const protocol = evaluation && evaluation.protocol;
  const claim = protocol && protocol.claim;
  if (!claim || claim.id !== binding.claimId || cycle.capabilityId !== binding.capabilityId) addReason(reasons, 'CLAIM_CAPABILITY_BINDING_MISMATCH');
  if (!claim || claim.targetScope !== binding.targetScope || claim.scopeStatement !== binding.scopeStatement) addReason(reasons, 'PROTOCOL_SCOPE_MISMATCH');
  if (!judgment || judgment.targetScope !== binding.targetScope || judgment.scopeStatement !== binding.scopeStatement) addReason(reasons, 'JUDGMENT_SCOPE_MISMATCH');

  if (binding.targetScope === 'NAMED_LOCAL_STEWARD' && binding.sourceTrust.mode !== 'NAMED_LOCAL_STEWARD_DECLARATION') {
    addReason(reasons, 'SOURCE_TRUST_SCOPE_MISMATCH');
  }
  if (binding.targetScope === 'NAMED_LOCAL_STEWARD' && binding.sourceTrust.trustRef.schema !== 'axm.local-steward-source-declaration/v1') {
    addReason(reasons, 'SOURCE_TRUST_SCHEMA_MISMATCH');
  }
  if (binding.targetScope === 'DECLARED_COHORT' && binding.sourceTrust.mode !== 'EXTERNAL_COHORT_AUTHENTICATION') {
    addReason(reasons, 'SOURCE_TRUST_SCOPE_MISMATCH');
  }
  if (binding.targetScope === 'DECLARED_COHORT' && binding.sourceTrust.trustRef.schema !== 'axm.external-cohort-authentication/v1') {
    addReason(reasons, 'SOURCE_TRUST_SCHEMA_MISMATCH');
  }

  const fixtureMode = evaluation && evaluation.fixtureMode;
  if (fixtureMode === 'SYNTHETIC' || (judgment && judgment.fixtureMode === 'SYNTHETIC')) addReason(reasons, 'SYNTHETIC_EVIDENCE');
  if (fixtureMode !== 'LIVE' || !judgment || judgment.fixtureMode !== 'LIVE' || judgment.sourceMode !== 'HUMAN_ENTERED' || judgment.usableAsHumanEvidence !== true || !judgment.truth || judgment.truth.declaredHumanJudgment !== true) {
    addReason(reasons, 'LIVE_HUMAN_DECLARATION_REQUIRED');
  }

  const baselineRef = conditionReference(evaluation, 'BASELINE');
  const candidateRef = conditionReference(evaluation, 'CANDIDATE');
  if (!baselineRef || !candidateRef) addReason(reasons, 'COMPARISON_ARTIFACTS_MISSING');
  if (!cycle.baseline || !cycle.baseline.receiptRef || !cycle.candidate || !cycle.candidate.artifactRef) addReason(reasons, 'CAPABILITY_ANCESTRY_MISSING');
  if (binding.interventionLink.relation !== 'EVALUATED_SURFACE_PRESENTS_CAPABILITY_CANDIDATE'
    || binding.interventionLink.linkRef.schema !== 'axm.capability-intervention-link/v1'
    || !sameReference(binding.interventionLink.capabilityCandidateRef, cycle.candidate && cycle.candidate.artifactRef)
    || !sameReference(binding.interventionLink.evaluatedCandidateRef, candidateRef)) {
    addReason(reasons, 'CAPABILITY_INTERVENTION_LINK_MISMATCH');
  }

  const sourceTimes = [cycle.generatedAt, evaluation && evaluation.generatedAt, judgment && judgment.recordedAt, closure.checkedAt]
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (sourceTimes.some((value) => value > new Date(generatedAt).getTime())) addReason(reasons, 'BRIDGE_CHRONOLOGY_INVALID');

  const requiredDigests = [
    cycle.receiptDigest,
    protocol && protocol.protocolDigest,
    refs.evaluation.sha256,
    refs.judgment.sha256,
    baselineRef && baselineRef.sha256,
    candidateRef && candidateRef.sha256,
    cycle.baseline && cycle.baseline.receiptRef && cycle.baseline.receiptRef.sha256,
    cycle.candidate && cycle.candidate.artifactRef && cycle.candidate.artifactRef.sha256,
    binding.interventionLink.linkRef.sha256,
    binding.sourceTrust.trustRef.sha256
  ].filter((value) => DIGEST.test(String(value || '').toLowerCase()));
  if (closure.state !== 'CURRENT') addReason(reasons, 'EVIDENCE_CLOSURE_NOT_CURRENT');
  if (requiredDigests.some((digest) => !closure.coveredDigests.includes(digest))) addReason(reasons, 'EVIDENCE_CLOSURE_INCOMPLETE');

  const admissionState = reasons.length === 0 ? 'ADMITTED' : (
    reasons.some((reason) => reason.startsWith('EVIDENCE_CLOSURE_')) ? 'EVIDENCE_HOLD' :
      reasons.includes('SYNTHETIC_EVIDENCE') ? 'SYNTHETIC_HOLD' : 'NATIVE_OR_BINDING_HOLD'
  );
  return {
    admissionState,
    reasonCodes: reasons.sort(),
    mappedDecision: admissionState === 'ADMITTED' ? judgment.decision : 'UNKNOWN',
    nativeVerification: {
      evaluation: evaluationCheck.pass ? 'PASS' : 'FAIL',
      judgment: judgmentCheck.pass ? 'PASS' : 'FAIL'
    },
    requiredClosureDigests: Array.from(new Set(requiredDigests)).sort(),
    baselineRef,
    candidateRef
  };
}

function receiptDigest(receipt) {
  const payload = clone(receipt);
  delete payload.receiptDigest;
  return sha256(payload);
}

function build(input) {
  input = input || {};
  const cycle = clone(input.cycleReceipt);
  const cycleCheck = CapabilityLoop.verify(cycle);
  if (!cycleCheck.pass) throw new Error('cycle receipt is invalid: ' + cycleCheck.errors.join('; '));
  const evaluation = clone(input.evaluation);
  const judgment = clone(input.judgment);
  const binding = normalizeBinding(input.binding);
  const evidenceClosureReceipt = clone(input.evidenceClosure);
  const closureCheck = verifyClosure(evidenceClosureReceipt);
  if (!closureCheck.pass) throw new Error('evidence closure receipt is invalid: ' + closureCheck.errors.join('; '));
  const evidenceClosure = closureSummary(evidenceClosureReceipt);
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');

  const refs = {
    cycle: nativeReference(cycle, { digestField: 'receiptDigest', idField: 'cycleId', fallbackId: 'cycle', fallbackSchema: CapabilityLoop.RECEIPT_SCHEMA, label: 'cycle' }),
    protocol: nativeReference(evaluation && evaluation.protocol, { digestField: 'protocolDigest', idField: 'protocolId', fallbackId: 'protocol', fallbackSchema: Human.PROTOCOL_SCHEMA, label: 'protocol' }),
    evaluation: nativeReference(evaluation, { digestField: 'evaluationDigest', idField: 'evaluationId', fallbackId: 'evaluation', fallbackSchema: Human.EVALUATION_SCHEMA, label: 'evaluation' }),
    judgment: nativeReference(judgment, { digestField: 'judgmentDigest', idField: 'judgmentId', fallbackId: 'judgment', fallbackSchema: Human.JUDGMENT_SCHEMA, label: 'judgment' })
  };
  const classification = classify(cycle, evaluation, judgment, binding, evidenceClosure, refs, generatedAt);
  const bridgeReceipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    bridgeId: requiredText(input.bridgeId, 'bridgeId', 180),
    generatedAt,
    capabilityId: cycle.capabilityId,
    claimId: binding.claimId,
    targetScope: binding.targetScope,
    scopeStatement: binding.scopeStatement,
    binding,
    sourceRefs: refs,
    sourceContentDigests: {
      cycle: sha256(cycle),
      evaluation: sha256(evaluation),
      judgment: sha256(judgment)
    },
    evidenceClosureReceipt,
    evidenceClosure,
    nativeVerification: classification.nativeVerification,
    admission: {
      state: classification.admissionState,
      reasonCodes: classification.reasonCodes,
      mappedDecision: classification.mappedDecision
    },
    requiredClosureDigests: classification.requiredClosureDigests,
    truth: {
      bridgeAuthority: 'EVIDENCE_ROUTING_ONLY',
      sourceAuthenticationPerformedByModule: false,
      syntheticCanBecomeHumanEvidence: false,
      scopeExpansionAllowed: false,
      humanJudgmentRemainsClaimScoped: true,
      automaticExecution: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticCanon: false,
      automaticRootMutation: false,
      modelWeightTrainingClaimed: false
    },
    receiptDigest: null
  };
  bridgeReceipt.receiptDigest = receiptDigest(bridgeReceipt);

  const bridgeRef = { id: bridgeReceipt.bridgeId, schema: RECEIPT_SCHEMA, sha256: bridgeReceipt.receiptDigest };
  const scopePrefix = '[Scope: ' + binding.targetScope + '] ' + binding.scopeStatement + ' ';
  const admitted = classification.admissionState === 'ADMITTED';
  const evidenceRefs = admitted ? [refs.evaluation, refs.judgment, binding.sourceTrust.trustRef] : [];
  const claimClosure = admitted ? evidenceClosure : { state: 'UNKNOWN', checkedAt: null, receiptRef: null, coveredDigests: [] };
  const limitations = [
    'The result is limited to ' + binding.targetScope + ': ' + binding.scopeStatement,
    'The bridge routes declared source trust but does not authenticate human identity or participation.',
    admitted
      ? 'The final verdict is the explicit native Human Benefit judgment; the bridge adds no independent human judgment.'
      : 'No human-benefit verdict is admitted while bridge state is ' + classification.admissionState + ': ' + classification.reasonCodes.join(', ') + '.'
  ];
  const outcome = Growth.buildOutcome({
    outcomeId: requiredText(input.outcomeId, 'outcomeId', 180),
    generatedAt,
    cycleReceipt: cycle,
    interventionRef: cycle.candidate && cycle.candidate.artifactRef ? cycle.candidate.artifactRef : null,
    informationRefs: [refs.cycle, refs.protocol, refs.evaluation, refs.judgment, bridgeRef],
    claims: [{
      id: binding.claimId,
      beneficiary: 'HUMAN',
      statement: scopePrefix + (evaluation && evaluation.protocol && evaluation.protocol.claim ? evaluation.protocol.claim.statement : 'Human benefit is not established.'),
      kind: 'WORKFLOW_OUTCOME',
      verdict: classification.mappedDecision,
      proofSurface: admitted && ['PASS', 'FAIL'].includes(classification.mappedDecision) ? 'HUMAN_OBSERVATION' : 'NOT_RUN',
      baselineRef: admitted ? classification.baselineRef : null,
      outcomeRef: admitted ? classification.candidateRef : null,
      evidenceRefs,
      evidenceClosure: claimClosure,
      limitations
    }],
    refresh: input.refresh || {
      checkedAt: generatedAt,
      due: false,
      reason: 'Rebuild when the capability cycle, protocol, evaluation, judgment, source-trust declaration, closure, or beneficiary scope changes.'
    }
  });

  const bundle = {
    schema: BUNDLE_SCHEMA,
    version: VERSION,
    bridgeReceipt,
    groundedOutcome: outcome,
    bundleDigest: null
  };
  const digestPayload = clone(bundle);
  delete digestPayload.bundleDigest;
  bundle.bundleDigest = sha256(digestPayload);
  return bundle;
}

function verify(bundle, sources) {
  const errors = [];
  if (!bundle || bundle.schema !== BUNDLE_SCHEMA) return { pass: false, errors: ['bundle schema mismatch'] };
  if (bundle.version !== VERSION) errors.push('bundle version mismatch');
  sources = sources || {};
  let rebuilt = null;
  try {
    rebuilt = build({
      bridgeId: bundle.bridgeReceipt && bundle.bridgeReceipt.bridgeId,
      outcomeId: bundle.groundedOutcome && bundle.groundedOutcome.outcomeId,
      generatedAt: bundle.bridgeReceipt && bundle.bridgeReceipt.generatedAt,
      cycleReceipt: bundle.groundedOutcome && bundle.groundedOutcome.cycleReceipt,
      evaluation: sources.evaluation,
      judgment: sources.judgment,
      binding: bundle.bridgeReceipt && bundle.bridgeReceipt.binding,
      evidenceClosure: bundle.bridgeReceipt && bundle.bridgeReceipt.evidenceClosureReceipt,
      refresh: bundle.groundedOutcome && bundle.groundedOutcome.refresh
    });
  } catch (error) {
    errors.push('bundle content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(bundle)) errors.push('bundle content, native sources, derived mapping, or digest mismatch');
  if (rebuilt && rebuilt.bundleDigest !== bundle.bundleDigest) errors.push('bundle digest mismatch');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  RECEIPT_SCHEMA,
  BUNDLE_SCHEMA,
  CLOSURE_SCHEMA,
  VERSION,
  stableStringify,
  sha256,
  buildClosure,
  verifyClosure,
  build,
  verify
};
