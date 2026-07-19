'use strict';

const Seam = require('./seam-cell');
const State = require('./state-language');

const CELL_ID = 'axm.mirror.organ-admission/seed-0';
const SCHEMA = 'axm.mirror.organ-admission-assessment/v1';

function clean(value, max = 1000) { return String(value == null ? '' : value).trim().slice(0, max); }
function id(value, fallback) {
  const result = clean(value, 120).replace(/[^a-zA-Z0-9._:/-]/g, '-').replace(/-+/g, '-');
  return result || fallback;
}
function list(value, max = 128) { return Array.isArray(value) ? value.slice(0, max) : []; }
function unique(value, max = 128) { return Array.from(new Set(list(value, max).map(item => id(item, '')).filter(Boolean))); }

function normalizeContract(value) {
  value = value && typeof value === 'object' ? value : {};
  const tests = value.tests && typeof value.tests === 'object' ? value.tests : {};
  return {
    organId: id(value.organId || value.organ_id, ''),
    purpose: clean(value.purpose, 1600),
    implementationKind: ['HARD_CODED_DETERMINISTIC', 'DECLARATIVE', 'LEARNED_PRIVATE_CHALLENGER'].includes(value.implementationKind)
      ? value.implementationKind : null,
    inputSchema: id(value.inputSchema || value.input_schema, ''),
    outputSchema: id(value.outputSchema || value.output_schema, ''),
    toolAuthority: value.toolAuthority === true,
    worldMutationAuthority: value.worldMutationAuthority === true,
    permissionGrantAuthority: value.permissionGrantAuthority === true,
    runtimeInstallAuthority: value.runtimeInstallAuthority === true,
    tests: {
      heldOutTransfer: tests.heldOutTransfer === true,
      counterexamples: tests.counterexamples === true,
      earlierCapabilityRegression: tests.earlierCapabilityRegression === true,
      authorityCanaries: tests.authorityCanaries === true,
      rollback: clean(tests.rollback, 1000),
      independentEvaluator: id(tests.independentEvaluator, '')
    }
  };
}

function assess(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('organ admission input must be an object');
  const sessions = list(input.reasoningSessions, 32);
  const bindings = list(input.evidenceBindings, 32);
  const contract = normalizeContract(input.proposedContract);
  const bindingBySession = new Map(bindings.map(item => [id(item && item.reasoningSessionId, ''), item || {}]));
  const accepted = [];
  const refused = [];

  for (const session of sessions) {
    const sessionId = session && session.reasoningSessionId || null;
    if (!session || session.schema !== 'axm.mirror.reasoning-session/v1') {
      refused.push({ reasoningSessionId: sessionId, reason: 'invalid reasoning session' });
      continue;
    }
    const independent = Seam.inspectReasoningSession(session);
    if (independent.summary.open) {
      refused.push({ reasoningSessionId: sessionId, reason: 'independent reasoning audit has open seams', seamIds: independent.seams.map(item => item.id) });
      continue;
    }
    const proposal = session.developmentProposal;
    if (!proposal || !proposal.targetSeam || !proposal.architectureRoute || proposal.architectureRoute.decision !== 'NEW_HARDCODED_ORGAN_CANDIDATE') {
      refused.push({ reasoningSessionId: sessionId, reason: 'reasoning session did not earn a new-organ candidate route' });
      continue;
    }
    const binding = bindingBySession.get(sessionId);
    if (!binding) {
      refused.push({ reasoningSessionId: sessionId, reason: 'attributed source-group binding missing' });
      continue;
    }
    const evidenceIds = new Set((session.problemState && session.problemState.evidenceRefs) || []);
    const evidenceRefs = unique(binding.evidenceRefs, 128);
    if (!id(binding.sourceGroup, '') || !evidenceRefs.length || evidenceRefs.some(ref => !evidenceIds.has(ref))) {
      refused.push({ reasoningSessionId: sessionId, reason: 'source group or present evidence lineage missing' });
      continue;
    }
    accepted.push({
      reasoningSessionId: sessionId,
      sourceGroup: id(binding.sourceGroup, ''),
      targetSeamId: proposal.targetSeam.id,
      developmentProposalId: proposal.proposalId,
      evidenceRefs,
      outcomeVerified: !!(session.verification && session.verification.finalOutcome && session.verification.finalOutcome.verified),
      repeatedVerifiedOutcomes: Number(session.verification && session.verification.finalOutcome && session.verification.finalOutcome.repeatedVerifiedOutcomes) || 0
    });
  }

  const targetSeams = Array.from(new Set(accepted.map(item => item.targetSeamId)));
  const sourceGroups = Array.from(new Set(accepted.map(item => item.sourceGroup)));
  const boundaryViolations = [];
  if (contract.toolAuthority) boundaryViolations.push('toolAuthority');
  if (contract.worldMutationAuthority) boundaryViolations.push('worldMutationAuthority');
  if (contract.permissionGrantAuthority) boundaryViolations.push('permissionGrantAuthority');
  if (contract.runtimeInstallAuthority) boundaryViolations.push('runtimeInstallAuthority');
  const contractGaps = [];
  if (!contract.organId) contractGaps.push('organId');
  if (!contract.purpose) contractGaps.push('purpose');
  if (!contract.implementationKind) contractGaps.push('implementationKind');
  if (!contract.inputSchema) contractGaps.push('inputSchema');
  if (!contract.outputSchema) contractGaps.push('outputSchema');
  if (!contract.tests.heldOutTransfer) contractGaps.push('heldOutTransfer');
  if (!contract.tests.counterexamples) contractGaps.push('counterexamples');
  if (!contract.tests.earlierCapabilityRegression) contractGaps.push('earlierCapabilityRegression');
  if (!contract.tests.authorityCanaries) contractGaps.push('authorityCanaries');
  if (!contract.tests.rollback) contractGaps.push('rollback');
  if (!contract.tests.independentEvaluator || contract.tests.independentEvaluator === contract.organId) contractGaps.push('independentEvaluator');
  const evidenceGaps = [];
  if (accepted.length < 2) evidenceGaps.push('at-least-two-verified-reasoning-sessions');
  if (sourceGroups.length < 2) evidenceGaps.push('at-least-two-independent-source-groups');
  if (targetSeams.length !== 1) evidenceGaps.push('one-repeated-target-seam');
  if (accepted.some(item => !item.outcomeVerified || item.repeatedVerifiedOutcomes < 2)) evidenceGaps.push('repeated-verified-outcome-evidence');

  let classification = 'PROPOSE_BUILD';
  if (boundaryViolations.length) classification = 'REJECT_BOUNDARY';
  else if (contractGaps.length || evidenceGaps.length) classification = 'HOLD_EVIDENCE';
  const basis = { accepted, refused, contract, boundaryViolations, contractGaps, evidenceGaps, classification };
  const assessmentId = `organ-admission-${State.digest(basis)}`;
  const output = {
    schema: SCHEMA,
    assessmentId,
    cell: { id: CELL_ID, status: 'EXPERIMENTAL', learnedWeights: false },
    classification,
    evidenceLedger: { accepted, refused, targetSeams, sourceGroups },
    proposedContract: contract,
    gaps: { evidence: evidenceGaps, contract: contractGaps, boundaryViolations },
    buildProposal: classification === 'PROPOSE_BUILD' ? {
      proposalId: `organ-build-${State.digest({ assessmentId, contract })}`,
      status: 'EXPERIMENTAL_BUILD_CANDIDATE',
      targetSeamId: targetSeams[0],
      contract,
      requiredSequence: ['IMPLEMENT_ISOLATED', 'STATIC_AUTHORITY_AUDIT', 'UNIT_TEST', 'FROZEN_HELD_OUT', 'COUNTEREXAMPLE', 'REGRESSION', 'ROLLBACK_DRY_RUN', 'INDEPENDENT_REVIEW'],
      installationState: 'NOT_INSTALLED'
    } : null,
    authority: {
      writeCode: false,
      installOrgan: false,
      loadOrgan: false,
      toolUse: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false,
      humanReviewRequired: true
    },
    boundary: 'PROPOSE_BUILD means the evidence earned an isolated implementation candidate. It does not generate, install, load, promote, or authorize the organ.'
  };
  output.assessmentDigest = State.digest(output, 64);
  return output;
}

module.exports = { CELL_ID, SCHEMA, assess };
