'use strict';

const CapabilityLoop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Human = require('../human-benefit-evidence/human-benefit-evidence');
const BridgeV1 = require('../grounded-growth-human-bridge/grounded-growth-human-bridge');

const RECEIPT_SCHEMA = 'axm.grounded-growth-human-bridge-receipt/v2';
const BUNDLE_SCHEMA = 'axm.grounded-growth-human-bridge-bundle/v2';
const INTERVENTION_LINK_SCHEMA = 'axm.capability-intervention-link/v2';
const CLOSURE_SCHEMA = BridgeV1.CLOSURE_SCHEMA;
const VERSION = '0.2.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const TARGET_SCOPES = ['NAMED_LOCAL_STEWARD', 'DECLARED_COHORT'];
const TRUST_MODES = ['NAMED_LOCAL_STEWARD_DECLARATION', 'EXTERNAL_COHORT_AUTHENTICATION'];
const ANCESTRY = {
  CANDIDATE: {
    mode: 'CANDIDATE',
    relation: 'EVALUATED_SURFACE_PRESENTS_CAPABILITY_CANDIDATE'
  },
  REUSE_EXISTING: {
    mode: 'REUSE_EXISTING',
    relation: 'EVALUATED_SURFACE_PRESENTS_REUSED_CAPABILITY'
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  return BridgeV1.stableStringify(value);
}

function sha256(value) {
  return BridgeV1.sha256(value);
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

function conditionReference(protocolOrEvaluation, role) {
  const protocol = protocolOrEvaluation && protocolOrEvaluation.protocol
    ? protocolOrEvaluation.protocol
    : protocolOrEvaluation;
  const conditions = protocol && Array.isArray(protocol.conditions) ? protocol.conditions : [];
  const condition = conditions.find((item) => item && item.role === role);
  return condition && condition.artifactRef ? condition.artifactRef : null;
}

function addReason(reasons, code) {
  if (!reasons.includes(code)) reasons.push(code);
}

function resolveAncestry(cycle) {
  const candidateRef = cycle && cycle.candidate && cycle.candidate.artifactRef
    ? normalizeReference(cycle.candidate.artifactRef, 'cycle candidate artifact')
    : null;
  const reusedRef = cycle && cycle.gap && cycle.gap.existingCapabilityRef
    ? normalizeReference(cycle.gap.existingCapabilityRef, 'cycle existing capability')
    : null;
  const reuseShape = Boolean(
    cycle && cycle.state === 'REUSE_EXISTING'
    && cycle.gap && cycle.gap.state === 'NO_GAP'
    && reusedRef && !candidateRef
  );
  const candidateShape = Boolean(
    cycle && cycle.state !== 'REUSE_EXISTING'
    && candidateRef && !reusedRef
  );
  if (reuseShape) {
    return {
      valid: true,
      mode: ANCESTRY.REUSE_EXISTING.mode,
      relation: ANCESTRY.REUSE_EXISTING.relation,
      capabilitySurfaceRef: reusedRef,
      reasonCodes: []
    };
  }
  if (candidateShape) {
    return {
      valid: true,
      mode: ANCESTRY.CANDIDATE.mode,
      relation: ANCESTRY.CANDIDATE.relation,
      capabilitySurfaceRef: candidateRef,
      reasonCodes: []
    };
  }
  const reasonCodes = [];
  if (!candidateRef && !reusedRef) reasonCodes.push('CAPABILITY_SURFACE_MISSING');
  if (candidateRef && reusedRef) reasonCodes.push('CAPABILITY_ANCESTRY_AMBIGUOUS');
  if (cycle && cycle.state === 'REUSE_EXISTING' && candidateRef) reasonCodes.push('REUSE_EXISTING_CANNOT_CARRY_CANDIDATE');
  if (reusedRef && (!cycle || cycle.state !== 'REUSE_EXISTING' || !cycle.gap || cycle.gap.state !== 'NO_GAP')) {
    reasonCodes.push('EXISTING_CAPABILITY_REQUIRES_REUSE_EXISTING_STATE');
  }
  if (candidateRef && cycle && cycle.state === 'REUSE_EXISTING') reasonCodes.push('CANDIDATE_REQUIRES_NON_REUSE_STATE');
  if (!reasonCodes.length) reasonCodes.push('CAPABILITY_ANCESTRY_UNSUPPORTED');
  return {
    valid: false,
    mode: 'UNKNOWN',
    relation: 'UNKNOWN',
    capabilitySurfaceRef: null,
    reasonCodes: Array.from(new Set(reasonCodes)).sort()
  };
}

function linkDigest(receipt) {
  const payload = clone(receipt);
  delete payload.linkDigest;
  return sha256(payload);
}

function buildInterventionLink(input) {
  input = input || {};
  const cycle = clone(input.cycleReceipt);
  const cycleCheck = CapabilityLoop.verify(cycle);
  if (!cycleCheck.pass) throw new Error('cycle receipt is invalid: ' + cycleCheck.errors.join('; '));
  const protocol = clone(input.protocol);
  const protocolCheck = Human.verifyProtocol(protocol);
  if (!protocolCheck.pass) throw new Error('protocol is invalid: ' + protocolCheck.errors.join('; '));
  const ancestry = resolveAncestry(cycle);
  if (!ancestry.valid) throw new Error('cycle ancestry is not linkable: ' + ancestry.reasonCodes.join(', '));
  const evaluatedCandidateRef = conditionReference(protocol, 'CANDIDATE');
  if (!evaluatedCandidateRef) throw new Error('protocol candidate comparison surface is missing');
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  const sourceTimes = [cycle.generatedAt, protocol.generatedAt].map((value) => new Date(value).getTime());
  if (sourceTimes.some((value) => value > new Date(generatedAt).getTime())) throw new Error('intervention link cannot predate its cycle or protocol');
  const receipt = {
    schema: INTERVENTION_LINK_SCHEMA,
    version: VERSION,
    linkId: requiredText(input.linkId, 'linkId', 180),
    generatedAt,
    capabilityId: cycle.capabilityId,
    claimId: protocol.claim.id,
    cycleRef: nativeReference(cycle, {
      digestField: 'receiptDigest', idField: 'cycleId', fallbackId: 'cycle',
      fallbackSchema: CapabilityLoop.RECEIPT_SCHEMA, label: 'cycle'
    }),
    protocolRef: nativeReference(protocol, {
      digestField: 'protocolDigest', idField: 'protocolId', fallbackId: 'protocol',
      fallbackSchema: Human.PROTOCOL_SCHEMA, label: 'protocol'
    }),
    ancestry: {
      mode: ancestry.mode,
      relation: ancestry.relation,
      capabilitySurfaceRef: ancestry.capabilitySurfaceRef
    },
    evaluatedCandidateRef: normalizeReference(evaluatedCandidateRef, 'evaluated candidate'),
    truth: {
      derivedFromVerifiedCycleAndProtocol: true,
      candidateInventedForReuse: false,
      ancestryModeCallerSelected: false,
      humanBenefitClaimed: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      automaticRootMutation: false
    },
    linkDigest: null
  };
  receipt.linkDigest = linkDigest(receipt);
  return receipt;
}

function verifyInterventionLink(receipt, cycle, protocol) {
  const errors = [];
  if (!receipt || receipt.schema !== INTERVENTION_LINK_SCHEMA) return { pass: false, errors: ['intervention link schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('intervention link version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildInterventionLink({
      linkId: receipt.linkId,
      generatedAt: receipt.generatedAt,
      cycleReceipt: cycle,
      protocol
    });
  } catch (error) {
    errors.push('intervention link content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('intervention link content, ancestry, or digest mismatch');
  return { pass: errors.length === 0, errors };
}

function normalizeBinding(input) {
  input = input || {};
  const targetScope = String(input.targetScope || '').toUpperCase();
  if (!TARGET_SCOPES.includes(targetScope)) throw new Error('binding targetScope is unsupported');
  const sourceTrust = input.sourceTrust || {};
  const mode = String(sourceTrust.mode || '').toUpperCase();
  if (!TRUST_MODES.includes(mode)) throw new Error('binding sourceTrust mode is unsupported');
  return {
    claimId: requiredText(input.claimId, 'binding claimId', 180),
    capabilityId: requiredText(input.capabilityId, 'binding capabilityId', 180),
    targetScope,
    scopeStatement: requiredText(input.scopeStatement, 'binding scopeStatement', 800),
    sourceTrust: {
      mode,
      trustRef: normalizeReference(sourceTrust.trustRef, 'binding sourceTrust')
    }
  };
}

function closureSummary(receipt) {
  return {
    state: receipt.state,
    checkedAt: receipt.checkedAt,
    receiptRef: { id: receipt.closureId, schema: CLOSURE_SCHEMA, sha256: receipt.closureDigest },
    coveredDigests: Array.from(new Set(receipt.sources.map((source) => source.sha256))).sort()
  };
}

function classify(cycle, evaluation, judgment, interventionLink, binding, closure, refs, generatedAt) {
  const reasons = [];
  const evaluationCheck = Human.verifyEvaluation(evaluation);
  const judgmentCheck = Human.verifyJudgment(evaluation, judgment);
  const protocol = evaluation && evaluation.protocol;
  const linkCheck = verifyInterventionLink(interventionLink, cycle, protocol);
  const ancestry = resolveAncestry(cycle);
  if (!evaluationCheck.pass) addReason(reasons, 'INVALID_EVALUATION');
  if (!judgmentCheck.pass) addReason(reasons, 'INVALID_JUDGMENT');
  if (!linkCheck.pass) addReason(reasons, 'INVALID_INTERVENTION_LINK');
  if (!ancestry.valid) ancestry.reasonCodes.forEach((reason) => addReason(reasons, reason));

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
  if (!cycle.baseline || !cycle.baseline.receiptRef) addReason(reasons, 'CAPABILITY_BASELINE_ANCESTRY_MISSING');
  if (linkCheck.pass && ancestry.valid) {
    if (interventionLink.capabilityId !== cycle.capabilityId
      || interventionLink.claimId !== (claim && claim.id)
      || interventionLink.ancestry.mode !== ancestry.mode
      || interventionLink.ancestry.relation !== ancestry.relation
      || !sameReference(interventionLink.ancestry.capabilitySurfaceRef, ancestry.capabilitySurfaceRef)
      || !sameReference(interventionLink.evaluatedCandidateRef, candidateRef)) {
      addReason(reasons, 'CAPABILITY_INTERVENTION_LINK_MISMATCH');
    }
  }

  const sourceTimes = [
    cycle.generatedAt,
    evaluation && evaluation.generatedAt,
    judgment && judgment.recordedAt,
    interventionLink && interventionLink.generatedAt,
    closure.checkedAt
  ].map((value) => new Date(value).getTime()).filter((value) => Number.isFinite(value));
  if (sourceTimes.some((value) => value > new Date(generatedAt).getTime())) addReason(reasons, 'BRIDGE_CHRONOLOGY_INVALID');

  const requiredDigests = [
    cycle.receiptDigest,
    protocol && protocol.protocolDigest,
    refs.evaluation.sha256,
    refs.judgment.sha256,
    refs.interventionLink.sha256,
    baselineRef && baselineRef.sha256,
    candidateRef && candidateRef.sha256,
    cycle.baseline && cycle.baseline.receiptRef && cycle.baseline.receiptRef.sha256,
    ancestry.capabilitySurfaceRef && ancestry.capabilitySurfaceRef.sha256,
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
      judgment: judgmentCheck.pass ? 'PASS' : 'FAIL',
      interventionLink: linkCheck.pass ? 'PASS' : 'FAIL'
    },
    requiredClosureDigests: Array.from(new Set(requiredDigests)).sort(),
    baselineRef,
    candidateRef,
    ancestry
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
  const interventionLink = clone(input.interventionLink);
  const binding = normalizeBinding(input.binding);
  const evidenceClosureReceipt = clone(input.evidenceClosure);
  const closureCheck = BridgeV1.verifyClosure(evidenceClosureReceipt);
  if (!closureCheck.pass) throw new Error('evidence closure receipt is invalid: ' + closureCheck.errors.join('; '));
  const evidenceClosure = closureSummary(evidenceClosureReceipt);
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');

  const refs = {
    cycle: nativeReference(cycle, { digestField: 'receiptDigest', idField: 'cycleId', fallbackId: 'cycle', fallbackSchema: CapabilityLoop.RECEIPT_SCHEMA, label: 'cycle' }),
    protocol: nativeReference(evaluation && evaluation.protocol, { digestField: 'protocolDigest', idField: 'protocolId', fallbackId: 'protocol', fallbackSchema: Human.PROTOCOL_SCHEMA, label: 'protocol' }),
    evaluation: nativeReference(evaluation, { digestField: 'evaluationDigest', idField: 'evaluationId', fallbackId: 'evaluation', fallbackSchema: Human.EVALUATION_SCHEMA, label: 'evaluation' }),
    judgment: nativeReference(judgment, { digestField: 'judgmentDigest', idField: 'judgmentId', fallbackId: 'judgment', fallbackSchema: Human.JUDGMENT_SCHEMA, label: 'judgment' }),
    interventionLink: nativeReference(interventionLink, { digestField: 'linkDigest', idField: 'linkId', fallbackId: 'intervention-link', fallbackSchema: INTERVENTION_LINK_SCHEMA, label: 'intervention link' })
  };
  const classification = classify(cycle, evaluation, judgment, interventionLink, binding, evidenceClosure, refs, generatedAt);
  const ancestryReceipt = {
    valid: classification.ancestry.valid,
    mode: classification.ancestry.mode,
    relation: classification.ancestry.relation,
    capabilitySurfaceRef: classification.ancestry.capabilitySurfaceRef,
    reasonCodes: classification.ancestry.reasonCodes
  };
  const bridgeReceipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    bridgeId: requiredText(input.bridgeId, 'bridgeId', 180),
    generatedAt,
    capabilityId: cycle.capabilityId,
    claimId: binding.claimId,
    targetScope: binding.targetScope,
    scopeStatement: binding.scopeStatement,
    capabilityAncestry: ancestryReceipt,
    binding,
    interventionLinkReceipt: interventionLink,
    sourceRefs: refs,
    sourceContentDigests: {
      cycle: sha256(cycle),
      evaluation: sha256(evaluation),
      judgment: sha256(judgment),
      interventionLink: sha256(interventionLink)
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
      candidateInventedForReuse: false,
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
  const evidenceRefs = admitted ? [refs.evaluation, refs.judgment, refs.interventionLink, binding.sourceTrust.trustRef] : [];
  const claimClosure = admitted ? evidenceClosure : { state: 'UNKNOWN', checkedAt: null, receiptRef: null, coveredDigests: [] };
  const limitations = [
    'The result is limited to ' + binding.targetScope + ': ' + binding.scopeStatement,
    'Capability ancestry mode is ' + classification.ancestry.mode + '; the bridge does not reinterpret REUSE_EXISTING as a new candidate.',
    'The bridge routes declared source trust but does not authenticate human identity or participation.',
    admitted
      ? 'The final verdict is the explicit native Human Benefit judgment; the bridge adds no independent human judgment.'
      : 'No human-benefit verdict is admitted while bridge state is ' + classification.admissionState + ': ' + classification.reasonCodes.join(', ') + '.'
  ];
  const outcome = Growth.buildOutcome({
    outcomeId: requiredText(input.outcomeId, 'outcomeId', 180),
    generatedAt,
    cycleReceipt: cycle,
    interventionRef: classification.ancestry.valid ? classification.ancestry.capabilitySurfaceRef : null,
    informationRefs: [refs.cycle, refs.protocol, refs.evaluation, refs.judgment, refs.interventionLink, bridgeRef],
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
      reason: 'Rebuild when capability ancestry, protocol, evaluation, judgment, intervention link, source trust, closure, or beneficiary scope changes.'
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
      interventionLink: bundle.bridgeReceipt && bundle.bridgeReceipt.interventionLinkReceipt,
      binding: bundle.bridgeReceipt && bundle.bridgeReceipt.binding,
      evidenceClosure: bundle.bridgeReceipt && bundle.bridgeReceipt.evidenceClosureReceipt,
      refresh: bundle.groundedOutcome && bundle.groundedOutcome.refresh
    });
  } catch (error) {
    errors.push('bundle content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(bundle)) errors.push('bundle content, native sources, ancestry mapping, or digest mismatch');
  if (rebuilt && rebuilt.bundleDigest !== bundle.bundleDigest) errors.push('bundle digest mismatch');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  RECEIPT_SCHEMA,
  BUNDLE_SCHEMA,
  INTERVENTION_LINK_SCHEMA,
  CLOSURE_SCHEMA,
  VERSION,
  ANCESTRY,
  stableStringify,
  sha256,
  resolveAncestry,
  buildInterventionLink,
  verifyInterventionLink,
  buildClosure: BridgeV1.buildClosure,
  verifyClosure: BridgeV1.verifyClosure,
  build,
  verify
};
