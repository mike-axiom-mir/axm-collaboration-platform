'use strict';

const CapabilityLoop = require('../verified-capability-loop/verified-capability-loop');
const Human = require('../human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');

const SOURCE_DECLARATION_SCHEMA = 'axm.local-steward-source-declaration/v1';
const HANDOFF_SCHEMA = 'axm.grounded-growth-human-handoff-package/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const LIVE_DECLARATION_MODE = 'LIVE_HUMAN_DECLARATION';
const SYNTHETIC_DECLARATION_MODE = 'SYNTHETIC_FIXTURE';
const LIVE_SOURCE_ATTESTATION = 'I declare that I personally supplied the referenced session evidence and claim-scoped judgment for this local evaluation.';
const SYNTHETIC_SOURCE_ATTESTATION = 'Synthetic fixture only; no person supplied this source declaration.';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  return Human.stableStringify(value);
}

function sha256(value) {
  return Human.sha256(value);
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function exactTimestamp(value, label) {
  if (value == null || value === '') throw new Error(label + ' is required');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(label + ' must be a valid timestamp');
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

function nativeReference(value, input) {
  input = input || {};
  return {
    id: requiredText(value && value[input.idField] ? value[input.idField] : input.fallbackId, input.label + ' id', 180),
    schema: requiredText(value && value.schema ? value.schema : input.fallbackSchema, input.label + ' schema', 180),
    sha256: value && DIGEST.test(String(value[input.digestField] || '').toLowerCase())
      ? String(value[input.digestField]).toLowerCase()
      : sha256(value)
  };
}

function sameReference(left, right) {
  return Boolean(left && right && left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256);
}

function conditionReference(protocolOrEvaluation, role) {
  const protocol = protocolOrEvaluation && protocolOrEvaluation.protocol
    ? protocolOrEvaluation.protocol
    : protocolOrEvaluation;
  const condition = protocol && Array.isArray(protocol.conditions)
    ? protocol.conditions.find((item) => item && item.role === role)
    : null;
  return condition && condition.artifactRef ? normalizeReference(condition.artifactRef, role + ' condition') : null;
}

function prepareEvaluation(input) {
  input = input || {};
  const cycle = clone(input.cycleReceipt);
  const cycleCheck = CapabilityLoop.verify(cycle);
  if (!cycleCheck.pass) throw new Error('cycle receipt is invalid: ' + cycleCheck.errors.join('; '));
  const ancestry = Bridge.resolveAncestry(cycle);
  if (!ancestry.valid) throw new Error('cycle ancestry is not handoff-ready: ' + ancestry.reasonCodes.join(', '));
  const protocol = clone(input.protocol);
  const protocolCheck = Human.verifyProtocol(protocol);
  if (!protocolCheck.pass) throw new Error('protocol is invalid: ' + protocolCheck.errors.join('; '));
  const evaluation = Human.buildEvaluation(protocol, clone(input.sessions), {
    evaluationId: requiredText(input.evaluationId, 'evaluationId', 180),
    generatedAt: exactTimestamp(input.generatedAt, 'generatedAt')
  });
  if (evaluation.protocol.claim.beneficiary !== 'HUMAN') throw new Error('evaluation claim beneficiary must be HUMAN');
  return evaluation;
}

function sourceDeclarationDigest(receipt) {
  const payload = clone(receipt);
  delete payload.sourceDeclarationDigest;
  return sha256(payload);
}

function buildSourceDeclaration(input) {
  input = input || {};
  const evaluation = clone(input.evaluation);
  const evaluationCheck = Human.verifyEvaluation(evaluation);
  if (!evaluationCheck.pass) throw new Error('evaluation is invalid: ' + evaluationCheck.errors.join('; '));
  const judgment = clone(input.judgment);
  const judgmentCheck = Human.verifyJudgment(evaluation, judgment);
  if (!judgmentCheck.pass) throw new Error('judgment is invalid: ' + judgmentCheck.errors.join('; '));
  if (evaluation.protocol.claim.targetScope !== 'NAMED_LOCAL_STEWARD') {
    throw new Error('local steward source declarations cannot authenticate or represent a cohort');
  }
  const declarationMode = String(input.declarationMode || '').toUpperCase();
  const expectedMode = evaluation.fixtureMode === 'LIVE' ? LIVE_DECLARATION_MODE : SYNTHETIC_DECLARATION_MODE;
  if (declarationMode !== expectedMode) throw new Error('source declaration mode must match evaluation fixture mode');
  const attestation = requiredText(input.attestation, 'source declaration attestation', 220);
  const expectedAttestation = declarationMode === LIVE_DECLARATION_MODE
    ? LIVE_SOURCE_ATTESTATION
    : SYNTHETIC_SOURCE_ATTESTATION;
  if (attestation !== expectedAttestation) throw new Error('source declaration attestation text mismatch');
  const declaredAt = exactTimestamp(input.declaredAt, 'declaredAt');
  if (new Date(declaredAt) < new Date(judgment.recordedAt)) throw new Error('source declaration cannot precede the judgment');

  const completed = evaluation.sessions.filter((session) => session.state === 'COMPLETED');
  const usableAsSourceTrust = declarationMode === LIVE_DECLARATION_MODE
    && evaluation.state === 'READY_FOR_HUMAN_JUDGMENT'
    && judgment.fixtureMode === 'LIVE'
    && judgment.sourceMode === 'HUMAN_ENTERED'
    && judgment.usableAsHumanEvidence === true
    && completed.length >= evaluation.protocol.successRule.minimumCompletedSessions
    && completed.every((session) => session.fixtureMode === 'LIVE' && session.usableAsLiveEvidence === true);

  const receipt = {
    schema: SOURCE_DECLARATION_SCHEMA,
    version: VERSION,
    declarationId: requiredText(input.declarationId, 'declarationId', 180),
    declaredAt,
    fixtureMode: evaluation.fixtureMode,
    declarationMode,
    attestation,
    claim: {
      id: evaluation.protocol.claim.id,
      targetScope: evaluation.protocol.claim.targetScope,
      scopeStatement: evaluation.protocol.claim.scopeStatement
    },
    judgeRef: exactDigest(judgment.judgeRef, 'judgeRef'),
    protocolRef: nativeReference(evaluation.protocol, {
      idField: 'protocolId', digestField: 'protocolDigest', fallbackId: 'protocol',
      fallbackSchema: Human.PROTOCOL_SCHEMA, label: 'protocol'
    }),
    evaluationRef: nativeReference(evaluation, {
      idField: 'evaluationId', digestField: 'evaluationDigest', fallbackId: 'evaluation',
      fallbackSchema: Human.EVALUATION_SCHEMA, label: 'evaluation'
    }),
    judgmentRef: nativeReference(judgment, {
      idField: 'judgmentId', digestField: 'judgmentDigest', fallbackId: 'judgment',
      fallbackSchema: Human.JUDGMENT_SCHEMA, label: 'judgment'
    }),
    sessionRefs: evaluation.sessions.map((session) => nativeReference(session, {
      idField: 'sessionId', digestField: 'sessionDigest', fallbackId: 'session',
      fallbackSchema: Human.SESSION_SCHEMA, label: 'session'
    })),
    usableAsSourceTrust,
    truth: {
      localSourceDeclared: declarationMode === LIVE_DECLARATION_MODE,
      humanPresenceAuthenticated: false,
      identityAuthenticated: false,
      sourceAuthenticationExternal: true,
      cohortAuthenticationPerformed: false,
      syntheticCanBecomeLive: false,
      humanBenefitVerdictCreated: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false
    },
    sourceDeclarationDigest: null
  };
  receipt.sourceDeclarationDigest = sourceDeclarationDigest(receipt);
  return receipt;
}

function verifySourceDeclaration(evaluation, judgment, receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== SOURCE_DECLARATION_SCHEMA) {
    return { pass: false, errors: ['source declaration schema mismatch'] };
  }
  if (receipt.version !== VERSION) errors.push('source declaration version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildSourceDeclaration({
      declarationId: receipt.declarationId,
      declaredAt: receipt.declaredAt,
      declarationMode: receipt.declarationMode,
      attestation: receipt.attestation,
      evaluation,
      judgment
    });
  } catch (error) {
    errors.push('source declaration content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('source declaration content or digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

function uniqueReferences(references) {
  const byValue = new Map();
  references.filter(Boolean).map((reference, index) => normalizeReference(reference, 'closure source[' + index + ']'))
    .forEach((reference) => byValue.set(stableStringify(reference), reference));
  return Array.from(byValue.values());
}

function handoffDigest(receipt) {
  const payload = clone(receipt);
  delete payload.handoffDigest;
  return sha256(payload);
}

function buildPackage(input) {
  input = input || {};
  const cycle = clone(input.cycleReceipt);
  const cycleCheck = CapabilityLoop.verify(cycle);
  if (!cycleCheck.pass) throw new Error('cycle receipt is invalid: ' + cycleCheck.errors.join('; '));
  const ancestry = Bridge.resolveAncestry(cycle);
  if (!ancestry.valid) throw new Error('cycle ancestry is not handoff-ready: ' + ancestry.reasonCodes.join(', '));
  const evaluation = clone(input.evaluation);
  const evaluationCheck = Human.verifyEvaluation(evaluation);
  if (!evaluationCheck.pass) throw new Error('evaluation is invalid: ' + evaluationCheck.errors.join('; '));
  const judgment = clone(input.judgment);
  const judgmentCheck = Human.verifyJudgment(evaluation, judgment);
  if (!judgmentCheck.pass) throw new Error('judgment is invalid: ' + judgmentCheck.errors.join('; '));
  const declaration = clone(input.sourceDeclaration);
  const declarationCheck = verifySourceDeclaration(evaluation, judgment, declaration);
  if (!declarationCheck.pass) throw new Error('source declaration is invalid: ' + declarationCheck.errors.join('; '));
  const interventionLink = clone(input.interventionLink);
  const linkCheck = Bridge.verifyInterventionLink(interventionLink, cycle, evaluation.protocol);
  if (!linkCheck.pass) throw new Error('intervention link is invalid: ' + linkCheck.errors.join('; '));

  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  if (new Date(generatedAt) < new Date(declaration.declaredAt)) throw new Error('handoff cannot precede the source declaration');
  const closureCheckedAt = exactTimestamp(input.closureCheckedAt, 'closureCheckedAt');
  if (new Date(closureCheckedAt) < new Date(declaration.declaredAt)) throw new Error('closure cannot precede the source declaration');
  if (new Date(generatedAt) < new Date(closureCheckedAt)) throw new Error('handoff cannot precede closure');
  const closureState = String(input.closureState || '').toUpperCase();
  if (!['CURRENT', 'HELD', 'UNKNOWN'].includes(closureState)) throw new Error('closureState is unsupported');

  const protocol = evaluation.protocol;
  const declarationRef = nativeReference(declaration, {
    idField: 'declarationId', digestField: 'sourceDeclarationDigest', fallbackId: 'source-declaration',
    fallbackSchema: SOURCE_DECLARATION_SCHEMA, label: 'source declaration'
  });
  const closureSources = uniqueReferences([
    nativeReference(cycle, {
      idField: 'cycleId', digestField: 'receiptDigest', fallbackId: 'cycle',
      fallbackSchema: CapabilityLoop.RECEIPT_SCHEMA, label: 'cycle'
    }),
    nativeReference(protocol, {
      idField: 'protocolId', digestField: 'protocolDigest', fallbackId: 'protocol',
      fallbackSchema: Human.PROTOCOL_SCHEMA, label: 'protocol'
    }),
    nativeReference(evaluation, {
      idField: 'evaluationId', digestField: 'evaluationDigest', fallbackId: 'evaluation',
      fallbackSchema: Human.EVALUATION_SCHEMA, label: 'evaluation'
    }),
    nativeReference(judgment, {
      idField: 'judgmentId', digestField: 'judgmentDigest', fallbackId: 'judgment',
      fallbackSchema: Human.JUDGMENT_SCHEMA, label: 'judgment'
    }),
    nativeReference(interventionLink, {
      idField: 'linkId', digestField: 'linkDigest', fallbackId: 'intervention-link',
      fallbackSchema: Bridge.INTERVENTION_LINK_SCHEMA, label: 'intervention link'
    }),
    conditionReference(protocol, 'BASELINE'),
    conditionReference(protocol, 'CANDIDATE'),
    cycle.baseline && cycle.baseline.receiptRef,
    ancestry.capabilitySurfaceRef,
    declarationRef
  ]);
  const evidenceClosure = Bridge.buildClosure({
    closureId: requiredText(input.closureId, 'closureId', 180),
    state: closureState,
    checkedAt: closureCheckedAt,
    sources: closureSources
  });
  const binding = {
    claimId: protocol.claim.id,
    capabilityId: cycle.capabilityId,
    targetScope: protocol.claim.targetScope,
    scopeStatement: protocol.claim.scopeStatement,
    sourceTrust: {
      mode: 'NAMED_LOCAL_STEWARD_DECLARATION',
      trustRef: declarationRef
    }
  };
  const bridgeBundle = Bridge.build({
    bridgeId: requiredText(input.bridgeId, 'bridgeId', 180),
    outcomeId: requiredText(input.outcomeId, 'outcomeId', 180),
    generatedAt,
    cycleReceipt: cycle,
    evaluation,
    judgment,
    interventionLink,
    binding,
    evidenceClosure,
    refresh: input.refresh
  });
  const receipt = {
    schema: HANDOFF_SCHEMA,
    version: VERSION,
    handoffId: requiredText(input.handoffId, 'handoffId', 180),
    generatedAt,
    capabilityId: cycle.capabilityId,
    claimId: protocol.claim.id,
    ancestryMode: ancestry.mode,
    evaluation,
    judgment,
    sourceDeclaration: declaration,
    bridgeBundle,
    state: bridgeBundle.bridgeReceipt.admission.state,
    mappedDecision: bridgeBundle.bridgeReceipt.admission.mappedDecision,
    truth: {
      evaluationDerivedDeterministically: true,
      judgmentDerivedFromSignal: false,
      judgmentRemainsExplicitHumanInput: true,
      sourceDeclarationAuthenticatesIdentity: false,
      sourceDeclarationAuthenticatesPresence: false,
      syntheticCanBecomeHumanEvidence: false,
      packageWritesAutomatically: false,
      humanParticipationStartedAutomatically: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    handoffDigest: null
  };
  receipt.handoffDigest = handoffDigest(receipt);
  return receipt;
}

function verifyPackage(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== HANDOFF_SCHEMA) return { pass: false, errors: ['handoff package schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('handoff package version mismatch');
  const bundle = receipt.bridgeBundle || {};
  const bridgeReceipt = bundle.bridgeReceipt || {};
  const outcome = bundle.groundedOutcome || {};
  const closure = bridgeReceipt.evidenceClosureReceipt || {};
  let rebuilt = null;
  try {
    rebuilt = buildPackage({
      handoffId: receipt.handoffId,
      generatedAt: receipt.generatedAt,
      closureId: closure.closureId,
      closureState: closure.state,
      closureCheckedAt: closure.checkedAt,
      bridgeId: bridgeReceipt.bridgeId,
      outcomeId: outcome.outcomeId,
      cycleReceipt: outcome.cycleReceipt,
      evaluation: receipt.evaluation,
      judgment: receipt.judgment,
      sourceDeclaration: receipt.sourceDeclaration,
      interventionLink: bridgeReceipt.interventionLinkReceipt,
      refresh: outcome.refresh
    });
  } catch (error) {
    errors.push('handoff package content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('handoff package content or digest mismatch');
  if (rebuilt && rebuilt.handoffDigest !== receipt.handoffDigest) errors.push('handoff package digest mismatch');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  SOURCE_DECLARATION_SCHEMA,
  HANDOFF_SCHEMA,
  VERSION,
  LIVE_DECLARATION_MODE,
  SYNTHETIC_DECLARATION_MODE,
  LIVE_SOURCE_ATTESTATION,
  SYNTHETIC_SOURCE_ATTESTATION,
  stableStringify,
  sha256,
  sameReference,
  prepareEvaluation,
  buildSourceDeclaration,
  verifySourceDeclaration,
  buildPackage,
  verifyPackage
};
