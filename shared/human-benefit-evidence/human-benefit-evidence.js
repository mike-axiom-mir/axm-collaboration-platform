'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const PROTOCOL_SCHEMA = 'axm.human-benefit-protocol/v1';
const SESSION_SCHEMA = 'axm.human-benefit-session-receipt/v1';
const EVALUATION_SCHEMA = 'axm.human-benefit-evaluation-receipt/v1';
const JUDGMENT_SCHEMA = 'axm.human-benefit-judgment-receipt/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const FIXTURE_MODES = ['LIVE', 'SYNTHETIC'];
const CONDITION_ROLES = ['BASELINE', 'CANDIDATE'];
const DECISIONS = ['CONTINUE', 'HOLD', 'UNSURE'];
const CONFUSION = ['NONE', 'SOME', 'BLOCKED'];
const EFFECTS = ['HELPED', 'HARMED', 'NO_MEANINGFUL_DIFFERENCE', 'UNSURE'];
const BURDENS = ['LOW', 'ACCEPTABLE', 'HIGH'];
const TARGET_SCOPES = ['NAMED_LOCAL_STEWARD', 'DECLARED_COHORT'];
const JUDGMENTS = ['PASS', 'FAIL', 'UNKNOWN'];
const RATIONALE_CODES = [
  'OBJECTIVE_AND_EXPERIENTIAL_BENEFIT',
  'BENEFIT_NOT_ESTABLISHED',
  'HARM_OR_BURDEN',
  'INSUFFICIENT_OR_MIXED',
  'SCOPE_LIMITED'
];
const LIVE_ATTESTATION = 'I reviewed this exact evaluation and entered this judgment myself.';
const SYNTHETIC_ATTESTATION = 'Synthetic fixture only; no human judgment occurred.';

function clone(value) {
  return JSON.parse(DeterministicJson.canonicalJson(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function requiredText(value, label, maximum) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(label + ' is required');
  if (text.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return text;
}

function exactTimestamp(value, label) {
  if (value == null || value === '') throw new Error(label + ' is required');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(label + ' must be a valid timestamp');
  return parsed.toISOString();
}

function exactDigest(value, label) {
  const digest = String(value || '').toLowerCase();
  if (!DIGEST.test(digest)) throw new Error(label + ' must be a SHA-256 digest');
  return digest;
}

function exactEnum(value, values, label) {
  const normalized = String(value || '').toUpperCase();
  if (!values.includes(normalized)) throw new Error(label + ' is unsupported');
  return normalized;
}

function exactInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function exactNumber(value, minimum, maximum, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be a number from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function normalizeReference(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' reference is required');
  return {
    id: requiredText(input.id, label + ' id', 180),
    schema: requiredText(input.schema, label + ' schema', 180),
    sha256: exactDigest(input.sha256, label + ' sha256')
  };
}

function reference(value, input) {
  input = input || {};
  return {
    id: requiredText(input.id || 'evidence', 'reference id', 180),
    schema: requiredText(input.schema || 'application/octet-stream', 'reference schema', 180),
    sha256: sha256(value)
  };
}

function digestReceipt(receipt, digestField) {
  const payload = clone(receipt);
  delete payload[digestField];
  receipt[digestField] = sha256(payload);
  return receipt;
}

function normalizeCondition(input, index) {
  input = input || {};
  return {
    id: requiredText(input.id, 'condition[' + index + '] id', 80),
    role: exactEnum(input.role, CONDITION_ROLES, 'condition[' + index + '] role'),
    label: requiredText(input.label, 'condition[' + index + '] label', 120),
    artifactRef: normalizeReference(input.artifactRef, 'condition[' + index + '] artifact')
  };
}

function normalizeTrial(input, index, conditionIds) {
  input = input || {};
  const conditionId = requiredText(input.conditionId, 'trial[' + index + '] conditionId', 80);
  if (!conditionIds.has(conditionId)) throw new Error('trial[' + index + '] conditionId is not declared');
  return {
    id: requiredText(input.id, 'trial[' + index + '] id', 100),
    caseId: requiredText(input.caseId, 'trial[' + index + '] caseId', 100),
    conditionId,
    order: exactInteger(input.order, 1, 128, 'trial[' + index + '] order'),
    prompt: requiredText(input.prompt, 'trial[' + index + '] prompt', 1200),
    expectedDecision: exactEnum(input.expectedDecision, ['CONTINUE', 'HOLD'], 'trial[' + index + '] expectedDecision')
  };
}

function validateBalancedTrials(trials, conditions, maximumSameConditionRun) {
  const orders = trials.map((trial) => trial.order).sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1)) throw new Error('trial order must be contiguous from 1');
  const ids = trials.map((trial) => trial.id);
  if (new Set(ids).size !== ids.length) throw new Error('trial ids must be unique');
  const caseIds = trials.map((trial) => trial.caseId);
  if (new Set(caseIds).size !== caseIds.length) throw new Error('trial caseIds must be unique');

  const countByCondition = Object.fromEntries(conditions.map((condition) => [condition.id, 0]));
  trials.forEach((trial) => { countByCondition[trial.conditionId] += 1; });
  const counts = Object.values(countByCondition);
  if (counts.some((count) => count < 2)) throw new Error('each condition needs at least two trials');
  if (Math.max(...counts) - Math.min(...counts) > 1) throw new Error('trial conditions must be balanced within one observation');

  let run = 0;
  let previous = null;
  for (const trial of [...trials].sort((a, b) => a.order - b.order)) {
    run = trial.conditionId === previous ? run + 1 : 1;
    previous = trial.conditionId;
    if (run > maximumSameConditionRun) throw new Error('trial order exceeds maximum same-condition run');
  }
}

function buildProtocol(input) {
  input = input || {};
  const fixtureMode = exactEnum(input.fixtureMode, FIXTURE_MODES, 'fixtureMode');
  const targetScope = exactEnum(input.claim && input.claim.targetScope, TARGET_SCOPES, 'claim targetScope');
  if (!Array.isArray(input.conditions) || input.conditions.length !== 2) throw new Error('protocol needs exactly two conditions');
  const conditions = input.conditions.map(normalizeCondition);
  if (new Set(conditions.map((condition) => condition.id)).size !== conditions.length) throw new Error('condition ids must be unique');
  if (new Set(conditions.map((condition) => condition.role)).size !== CONDITION_ROLES.length) {
    throw new Error('protocol needs one BASELINE and one CANDIDATE condition');
  }
  const conditionIds = new Set(conditions.map((condition) => condition.id));
  if (!Array.isArray(input.trials) || input.trials.length < 4 || input.trials.length > 64) {
    throw new Error('protocol needs 4 to 64 trials');
  }
  const fairness = input.fairness || {};
  const maximumSameConditionRun = exactInteger(fairness.maximumSameConditionRun, 1, 4, 'fairness maximumSameConditionRun');
  const trials = input.trials.map((trial, index) => normalizeTrial(trial, index, conditionIds));
  validateBalancedTrials(trials, conditions, maximumSameConditionRun);

  const successRule = input.successRule || {};
  const minimumCompletedSessions = exactInteger(successRule.minimumCompletedSessions, 1, 64, 'successRule minimumCompletedSessions');
  if (targetScope === 'NAMED_LOCAL_STEWARD' && minimumCompletedSessions !== 1) {
    throw new Error('NAMED_LOCAL_STEWARD scope requires one completed session');
  }
  if (targetScope === 'DECLARED_COHORT' && minimumCompletedSessions < 2) {
    throw new Error('DECLARED_COHORT scope requires at least two completed sessions');
  }

  const protocol = {
    schema: PROTOCOL_SCHEMA,
    version: VERSION,
    protocolId: requiredText(input.protocolId, 'protocolId', 180),
    generatedAt: exactTimestamp(input.generatedAt, 'generatedAt'),
    fixtureMode,
    claim: {
      id: requiredText(input.claim && input.claim.id, 'claim id', 180),
      statement: requiredText(input.claim && input.claim.statement, 'claim statement', 1200),
      beneficiary: 'HUMAN',
      targetScope,
      scopeStatement: requiredText(input.claim && input.claim.scopeStatement, 'claim scopeStatement', 800)
    },
    conditions,
    trials: trials.sort((a, b) => a.order - b.order),
    fairness: {
      orderPolicy: 'BALANCED_WITHIN_SESSION',
      conditionLabels: 'BLINDED_A_B',
      learningEffectRisk: 'DECLARED',
      maximumSameConditionRun
    },
    successRule: {
      minimumCompletedSessions,
      minimumCandidateAccuracyGain: exactNumber(successRule.minimumCandidateAccuracyGain, -1, 1, 'successRule minimumCandidateAccuracyGain'),
      maximumCandidateUnsupportedContinueRate: exactNumber(successRule.maximumCandidateUnsupportedContinueRate, 0, 1, 'successRule maximumCandidateUnsupportedContinueRate'),
      maximumCandidateMeanTimeRatio: exactNumber(successRule.maximumCandidateMeanTimeRatio, 0, 10, 'successRule maximumCandidateMeanTimeRatio'),
      minimumHelpedFraction: exactNumber(successRule.minimumHelpedFraction, 0, 1, 'successRule minimumHelpedFraction'),
      requireNoHighBurden: successRule.requireNoHighBurden === true
    },
    consent: {
      mode: 'VOLUNTARY_OPT_IN',
      withdrawalAllowed: true,
      completionConfirmationRequired: true,
      useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY'
    },
    retention: {
      mode: 'STRUCTURED_NO_FREE_TEXT',
      rawIdentity: 'FORBIDDEN',
      freeText: 'FORBIDDEN',
      rawRecording: 'FORBIDDEN',
      network: 'DENY',
      withdrawalBehavior: 'OMIT_PARTICIPANT_AND_OBSERVATIONS'
    },
    authority: {
      automaticHumanVerdict: false,
      finalHumanJudgmentRequired: true,
      sourceAuthenticationExternal: true,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    protocolDigest: null
  };
  return digestReceipt(protocol, 'protocolDigest');
}

function verifyProtocol(protocol) {
  const errors = [];
  if (!protocol || protocol.schema !== PROTOCOL_SCHEMA) return { pass: false, errors: ['protocol schema mismatch'] };
  if (protocol.version !== VERSION) errors.push('protocol version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildProtocol(protocol);
  } catch (error) {
    errors.push('protocol content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(protocol)) errors.push('protocol content or digest mismatch');
  return { pass: errors.length === 0, errors };
}

function normalizeConsent(input, label) {
  input = input || {};
  if (String(input.mode || '').toUpperCase() !== 'VOLUNTARY_OPT_IN') throw new Error(label + ' mode must be VOLUNTARY_OPT_IN');
  if (String(input.useScope || '').toUpperCase() !== 'LOCAL_BENEFIT_EVALUATION_ONLY') {
    throw new Error(label + ' useScope must be LOCAL_BENEFIT_EVALUATION_ONLY');
  }
  if (String(input.retentionAccepted || '').toUpperCase() !== 'STRUCTURED_NO_FREE_TEXT') {
    throw new Error(label + ' retention must be STRUCTURED_NO_FREE_TEXT');
  }
  return {
    mode: 'VOLUNTARY_OPT_IN',
    grantedAt: exactTimestamp(input.grantedAt, label + ' grantedAt'),
    completionConfirmedAt: input.completionConfirmedAt == null ? null : exactTimestamp(input.completionConfirmedAt, label + ' completionConfirmedAt'),
    withdrawnAt: input.withdrawnAt == null ? null : exactTimestamp(input.withdrawnAt, label + ' withdrawnAt'),
    useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY',
    retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
  };
}

function normalizeObservation(input, index, trial) {
  input = input || {};
  if (requiredText(input.trialId, 'observation[' + index + '] trialId', 100) !== trial.id) {
    throw new Error('observation[' + index + '] trialId does not match the protocol order');
  }
  const decision = exactEnum(input.decision, DECISIONS, 'observation[' + index + '] decision');
  return {
    trialId: trial.id,
    conditionId: trial.conditionId,
    order: trial.order,
    decision,
    confidence: exactInteger(input.confidence, 1, 5, 'observation[' + index + '] confidence'),
    confusion: exactEnum(input.confusion, CONFUSION, 'observation[' + index + '] confusion'),
    elapsedMs: exactInteger(input.elapsedMs, 0, 3600000, 'observation[' + index + '] elapsedMs'),
    correct: decision === trial.expectedDecision,
    unsupportedContinue: trial.expectedDecision === 'HOLD' && decision === 'CONTINUE'
  };
}

function round(value) {
  return Number(value.toFixed(6));
}

function summarizeObservations(protocol, observations) {
  const trialById = new Map(protocol.trials.map((trial) => [trial.id, trial]));
  const summaries = protocol.conditions.map((condition) => {
    const selected = observations.filter((observation) => observation.conditionId === condition.id);
    const correct = selected.filter((observation) => observation.correct).length;
    const unsupportedContinues = selected.filter((observation) => observation.unsupportedContinue).length;
    const holdExpected = selected.filter((observation) => trialById.get(observation.trialId).expectedDecision === 'HOLD').length;
    const totalElapsedMs = selected.reduce((sum, observation) => sum + observation.elapsedMs, 0);
    return {
      conditionId: condition.id,
      role: condition.role,
      total: selected.length,
      correct,
      accuracy: round(correct / selected.length),
      unsupportedContinues,
      holdExpected,
      unsupportedContinueRate: holdExpected ? round(unsupportedContinues / holdExpected) : 0,
      meanElapsedMs: round(totalElapsedMs / selected.length),
      blockedConfusions: selected.filter((observation) => observation.confusion === 'BLOCKED').length
    };
  });
  return summaries;
}

function buildSession(protocolInput, input) {
  const protocol = clone(protocolInput);
  const protocolCheck = verifyProtocol(protocol);
  if (!protocolCheck.pass) throw new Error('protocol is invalid: ' + protocolCheck.errors.join('; '));
  input = input || {};
  const fixtureMode = exactEnum(input.fixtureMode, FIXTURE_MODES, 'fixtureMode');
  if (fixtureMode !== protocol.fixtureMode) throw new Error('session fixtureMode must match protocol');
  const consent = normalizeConsent(input.consent, 'consent');
  const startedAt = exactTimestamp(input.startedAt, 'startedAt');
  const completedAt = exactTimestamp(input.completedAt, 'completedAt');
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  if (new Date(startedAt) < new Date(protocol.generatedAt)) throw new Error('session cannot start before the protocol exists');
  if (new Date(completedAt) < new Date(startedAt)) throw new Error('completedAt cannot precede startedAt');
  if (new Date(generatedAt) < new Date(completedAt)) throw new Error('session receipt cannot be generated before completion');
  if (new Date(consent.grantedAt) > new Date(startedAt)) throw new Error('consent must be granted before the session starts');

  const withdrawn = consent.withdrawnAt !== null;
  let participantRef = null;
  let observations = [];
  let participantJudgment = null;
  let conditionSummary = [];
  if (withdrawn) {
    if (new Date(consent.withdrawnAt) < new Date(consent.grantedAt) || new Date(consent.withdrawnAt) > new Date(completedAt)) {
      throw new Error('withdrawnAt must fall between consent and session completion');
    }
    if (Array.isArray(input.observations) && input.observations.length) throw new Error('withdrawn session must omit observations');
    if (input.participantJudgment != null) throw new Error('withdrawn session must omit participant judgment');
  } else {
    if (!consent.completionConfirmedAt) throw new Error('completed session requires consent completion confirmation');
    if (new Date(consent.completionConfirmedAt) > new Date(completedAt)) throw new Error('completion confirmation cannot follow completedAt');
    participantRef = exactDigest(input.participantRef, 'participantRef');
    if (!Array.isArray(input.observations) || input.observations.length !== protocol.trials.length) {
      throw new Error('completed session needs exactly one observation per protocol trial');
    }
    observations = protocol.trials.map((trial, index) => normalizeObservation(input.observations[index], index, trial));
    const judgment = input.participantJudgment || {};
    participantJudgment = {
      effect: exactEnum(judgment.effect, EFFECTS, 'participantJudgment effect'),
      burden: exactEnum(judgment.burden, BURDENS, 'participantJudgment burden'),
      confidence: exactInteger(judgment.confidence, 1, 5, 'participantJudgment confidence')
    };
    conditionSummary = summarizeObservations(protocol, observations);
  }

  const session = {
    schema: SESSION_SCHEMA,
    version: VERSION,
    sessionId: requiredText(input.sessionId, 'sessionId', 180),
    generatedAt,
    protocolRef: {
      id: protocol.protocolId,
      schema: PROTOCOL_SCHEMA,
      sha256: protocol.protocolDigest
    },
    fixtureMode,
    state: withdrawn ? 'WITHDRAWN' : 'COMPLETED',
    startedAt,
    completedAt,
    participantRef,
    consent,
    observations,
    participantJudgment,
    conditionSummary,
    retention: clone(protocol.retention),
    usableAsLiveEvidence: fixtureMode === 'LIVE' && !withdrawn,
    truth: {
      structuredResponsesOnly: true,
      rawIdentityRetained: false,
      freeTextRetained: false,
      rawRecordingRetained: false,
      withdrawnObservationsRetained: false,
      declaredHumanSourceOnly: fixtureMode === 'LIVE',
      humanSourceAuthenticatedByModule: false,
      automaticHumanVerdict: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    sessionDigest: null
  };
  return digestReceipt(session, 'sessionDigest');
}

function verifySession(protocol, session) {
  const errors = [];
  if (!session || session.schema !== SESSION_SCHEMA) return { pass: false, errors: ['session schema mismatch'] };
  if (session.version !== VERSION) errors.push('session version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildSession(protocol, session);
  } catch (error) {
    errors.push('session content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(session)) errors.push('session content or digest mismatch');
  return { pass: errors.length === 0, errors };
}

function combineConditionSummaries(protocol, sessions) {
  return protocol.conditions.map((condition) => {
    const summaries = sessions.map((session) => session.conditionSummary.find((item) => item.conditionId === condition.id));
    const total = summaries.reduce((sum, item) => sum + item.total, 0);
    const correct = summaries.reduce((sum, item) => sum + item.correct, 0);
    const unsupportedContinues = summaries.reduce((sum, item) => sum + item.unsupportedContinues, 0);
    const holdExpected = summaries.reduce((sum, item) => sum + item.holdExpected, 0);
    const elapsedTotal = summaries.reduce((sum, item) => sum + (item.meanElapsedMs * item.total), 0);
    return {
      conditionId: condition.id,
      role: condition.role,
      total,
      correct,
      accuracy: round(correct / total),
      unsupportedContinues,
      holdExpected,
      unsupportedContinueRate: holdExpected ? round(unsupportedContinues / holdExpected) : 0,
      meanElapsedMs: round(elapsedTotal / total),
      blockedConfusions: summaries.reduce((sum, item) => sum + item.blockedConfusions, 0)
    };
  });
}

function deriveEvaluationSignal(protocol, completed, conditionSummary) {
  if (completed.length < protocol.successRule.minimumCompletedSessions) return 'INCONCLUSIVE';
  const baseline = conditionSummary.find((summary) => summary.role === 'BASELINE');
  const candidate = conditionSummary.find((summary) => summary.role === 'CANDIDATE');
  const helped = completed.filter((session) => session.participantJudgment.effect === 'HELPED').length;
  const harmed = completed.filter((session) => session.participantJudgment.effect === 'HARMED').length;
  const highBurden = completed.filter((session) => session.participantJudgment.burden === 'HIGH').length;
  const helpedFraction = helped / completed.length;
  const accuracyGain = candidate.accuracy - baseline.accuracy;
  const meanTimeRatio = baseline.meanElapsedMs > 0 ? candidate.meanElapsedMs / baseline.meanElapsedMs : Infinity;
  const positive = accuracyGain >= protocol.successRule.minimumCandidateAccuracyGain
    && candidate.unsupportedContinueRate <= protocol.successRule.maximumCandidateUnsupportedContinueRate
    && meanTimeRatio <= protocol.successRule.maximumCandidateMeanTimeRatio
    && helpedFraction >= protocol.successRule.minimumHelpedFraction
    && (!protocol.successRule.requireNoHighBurden || highBurden === 0);
  if (positive) return 'POSITIVE';
  if (candidate.accuracy < baseline.accuracy || candidate.unsupportedContinueRate > baseline.unsupportedContinueRate || harmed > 0) {
    return 'NEGATIVE';
  }
  return 'MIXED';
}

function buildEvaluation(protocolInput, sessionsInput, input) {
  const protocol = clone(protocolInput);
  const protocolCheck = verifyProtocol(protocol);
  if (!protocolCheck.pass) throw new Error('protocol is invalid: ' + protocolCheck.errors.join('; '));
  if (!Array.isArray(sessionsInput) || !sessionsInput.length) throw new Error('evaluation needs at least one session receipt');
  if (sessionsInput.length > 128) throw new Error('evaluation exceeds 128 sessions');
  const sessions = sessionsInput.map((session, index) => {
    const copied = clone(session);
    const checked = verifySession(protocol, copied);
    if (!checked.pass) throw new Error('session[' + index + '] is invalid: ' + checked.errors.join('; '));
    return copied;
  }).sort((a, b) => a.generatedAt.localeCompare(b.generatedAt) || a.sessionId.localeCompare(b.sessionId));
  if (new Set(sessions.map((session) => session.sessionId)).size !== sessions.length) throw new Error('session ids must be unique');
  if (sessions.some((session) => session.fixtureMode !== protocol.fixtureMode)) throw new Error('evaluation cannot mix fixture modes');

  const completed = sessions.filter((session) => session.state === 'COMPLETED');
  const participantRefs = completed.map((session) => session.participantRef);
  if (new Set(participantRefs).size !== participantRefs.length) throw new Error('one completed session per participantRef is allowed');
  const conditionSummary = completed.length ? combineConditionSummaries(protocol, completed) : [];
  const signal = deriveEvaluationSignal(protocol, completed, conditionSummary);
  const baseline = conditionSummary.find((summary) => summary.role === 'BASELINE') || null;
  const candidate = conditionSummary.find((summary) => summary.role === 'CANDIDATE') || null;
  const helpedCount = completed.filter((session) => session.participantJudgment.effect === 'HELPED').length;
  const harmedCount = completed.filter((session) => session.participantJudgment.effect === 'HARMED').length;
  const highBurdenCount = completed.filter((session) => session.participantJudgment.burden === 'HIGH').length;
  input = input || {};
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  if (sessions.some((session) => new Date(generatedAt) < new Date(session.generatedAt))) {
    throw new Error('evaluation cannot be generated before a source session receipt');
  }
  const evaluation = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    evaluationId: requiredText(input.evaluationId, 'evaluationId', 180),
    generatedAt,
    protocol,
    sessions,
    fixtureMode: protocol.fixtureMode,
    summary: {
      submittedSessions: sessions.length,
      completedSessions: completed.length,
      withdrawnSessions: sessions.length - completed.length,
      conditionSummary,
      candidateAccuracyGain: baseline && candidate ? round(candidate.accuracy - baseline.accuracy) : null,
      candidateUnsupportedContinueReduction: baseline && candidate
        ? round(baseline.unsupportedContinueRate - candidate.unsupportedContinueRate)
        : null,
      candidateMeanTimeRatio: baseline && candidate && baseline.meanElapsedMs > 0
        ? round(candidate.meanElapsedMs / baseline.meanElapsedMs)
        : null,
      helpedCount,
      harmedCount,
      highBurdenCount,
      helpedFraction: completed.length ? round(helpedCount / completed.length) : null
    },
    signal,
    state: completed.length < protocol.successRule.minimumCompletedSessions
      ? 'INSUFFICIENT_COMPLETED_SESSIONS'
      : 'READY_FOR_HUMAN_JUDGMENT',
    humanBenefitVerdict: 'NOT_RUN',
    truth: {
      numericSignalIsHumanJudgment: false,
      participantReportsAreHumanNativeButDeclared: protocol.fixtureMode === 'LIVE',
      humanSourceAuthenticatedByModule: false,
      finalHumanJudgmentRequired: true,
      automaticHumanVerdict: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    evaluationDigest: null
  };
  return digestReceipt(evaluation, 'evaluationDigest');
}

function verifyEvaluation(evaluation) {
  const errors = [];
  if (!evaluation || evaluation.schema !== EVALUATION_SCHEMA) return { pass: false, errors: ['evaluation schema mismatch'] };
  if (evaluation.version !== VERSION) errors.push('evaluation version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildEvaluation(evaluation.protocol, evaluation.sessions, evaluation);
  } catch (error) {
    errors.push('evaluation content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(evaluation)) errors.push('evaluation content or digest mismatch');
  return { pass: errors.length === 0, errors };
}

function buildJudgment(evaluationInput, input) {
  const evaluation = clone(evaluationInput);
  const evaluationCheck = verifyEvaluation(evaluation);
  if (!evaluationCheck.pass) throw new Error('evaluation is invalid: ' + evaluationCheck.errors.join('; '));
  input = input || {};
  const fixtureMode = exactEnum(input.fixtureMode, FIXTURE_MODES, 'fixtureMode');
  if (fixtureMode !== evaluation.fixtureMode) throw new Error('judgment fixtureMode must match evaluation');
  const decision = exactEnum(input.decision, JUDGMENTS, 'decision');
  const sourceMode = exactEnum(input.sourceMode, ['HUMAN_ENTERED', 'SYNTHETIC_FIXTURE'], 'sourceMode');
  if (fixtureMode === 'LIVE' && sourceMode !== 'HUMAN_ENTERED') throw new Error('live judgment must be HUMAN_ENTERED');
  if (fixtureMode === 'SYNTHETIC' && sourceMode !== 'SYNTHETIC_FIXTURE') throw new Error('synthetic judgment must be SYNTHETIC_FIXTURE');
  const attestation = requiredText(input.attestation, 'attestation', 200);
  if (fixtureMode === 'LIVE' && attestation !== LIVE_ATTESTATION) throw new Error('live human attestation text mismatch');
  if (fixtureMode === 'SYNTHETIC' && attestation !== SYNTHETIC_ATTESTATION) throw new Error('synthetic attestation text mismatch');
  const judgeRef = exactDigest(input.judgeRef, 'judgeRef');
  if (decision !== 'UNKNOWN' && evaluation.state !== 'READY_FOR_HUMAN_JUDGMENT') {
    throw new Error('insufficient evaluation can only receive UNKNOWN');
  }
  if (decision === 'PASS' && evaluation.signal !== 'POSITIVE') throw new Error('PASS requires a positive predeclared signal');
  if (!Array.isArray(input.rationaleCodes) || !input.rationaleCodes.length) throw new Error('judgment needs rationaleCodes');
  const rationaleCodes = Array.from(new Set(input.rationaleCodes.map((value) => exactEnum(value, RATIONALE_CODES, 'rationaleCode')))).sort();
  if (decision === 'PASS' && !rationaleCodes.includes('OBJECTIVE_AND_EXPERIENTIAL_BENEFIT')) {
    throw new Error('PASS requires OBJECTIVE_AND_EXPERIENTIAL_BENEFIT rationale');
  }

  const recordedAt = exactTimestamp(input.recordedAt, 'recordedAt');
  if (new Date(recordedAt) < new Date(evaluation.generatedAt)) throw new Error('judgment cannot precede the evaluation');
  const judgment = {
    schema: JUDGMENT_SCHEMA,
    version: VERSION,
    judgmentId: requiredText(input.judgmentId, 'judgmentId', 180),
    recordedAt,
    evaluationRef: {
      id: evaluation.evaluationId,
      schema: EVALUATION_SCHEMA,
      sha256: evaluation.evaluationDigest
    },
    fixtureMode,
    sourceMode,
    judgeRef,
    attestation,
    decision,
    rationaleCodes,
    targetScope: evaluation.protocol.claim.targetScope,
    scopeStatement: evaluation.protocol.claim.scopeStatement,
    usableAsHumanEvidence: fixtureMode === 'LIVE',
    truth: {
      declaredHumanJudgment: fixtureMode === 'LIVE',
      humanSourceAuthenticatedByModule: false,
      judgmentAuthority: 'CLAIM_SCOPED_ONLY',
      claimScopeIsCohort: evaluation.protocol.claim.targetScope === 'DECLARED_COHORT',
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false
    },
    judgmentDigest: null
  };
  return digestReceipt(judgment, 'judgmentDigest');
}

function verifyJudgment(evaluation, judgment) {
  const errors = [];
  if (!judgment || judgment.schema !== JUDGMENT_SCHEMA) return { pass: false, errors: ['judgment schema mismatch'] };
  if (judgment.version !== VERSION) errors.push('judgment version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildJudgment(evaluation, judgment);
  } catch (error) {
    errors.push('judgment content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(judgment)) errors.push('judgment content or digest mismatch');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  PROTOCOL_SCHEMA,
  SESSION_SCHEMA,
  EVALUATION_SCHEMA,
  JUDGMENT_SCHEMA,
  VERSION,
  LIVE_ATTESTATION,
  SYNTHETIC_ATTESTATION,
  stableStringify,
  sha256,
  reference,
  buildProtocol,
  verifyProtocol,
  buildSession,
  verifySession,
  buildEvaluation,
  verifyEvaluation,
  buildJudgment,
  verifyJudgment
};
