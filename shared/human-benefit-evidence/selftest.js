'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Human = require('./human-benefit-evidence');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function throws(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  console.log('PASS ' + message);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function makeProtocol(fixtureMode = 'SYNTHETIC', targetScope = 'NAMED_LOCAL_STEWARD', minimumCompletedSessions = 1) {
  const baseline = { surface: 'registered identity only' };
  const candidate = { surface: 'registered identity plus exact current closure' };
  return Human.buildProtocol({
    protocolId: 'source-closure-human-benefit-' + fixtureMode.toLowerCase() + '-' + targetScope.toLowerCase(),
    generatedAt: '2026-08-19T05:00:00.000Z',
    fixtureMode,
    claim: {
      id: 'human-notices-stale-evidence',
      statement: 'The closure surface helps the declared human reviewer avoid unsupported continuation decisions.',
      targetScope,
      scopeStatement: targetScope === 'NAMED_LOCAL_STEWARD'
        ? 'This result applies only to the participating local AXM steward.'
        : 'This result applies only to the explicitly declared local steward cohort.'
    },
    conditions: [
      {
        id: 'condition-a',
        role: 'BASELINE',
        label: 'Condition A',
        artifactRef: Human.reference(baseline, { id: 'baseline-surface', schema: 'axm.synthetic-surface/v1' })
      },
      {
        id: 'condition-b',
        role: 'CANDIDATE',
        label: 'Condition B',
        artifactRef: Human.reference(candidate, { id: 'candidate-surface', schema: 'axm.synthetic-surface/v1' })
      }
    ],
    trials: [
      { id: 'trial-1', caseId: 'case-a-1', conditionId: 'condition-a', order: 1, prompt: 'Registered file was changed after registration. Continue or hold?', expectedDecision: 'HOLD' },
      { id: 'trial-2', caseId: 'case-b-1', conditionId: 'condition-b', order: 2, prompt: 'Closure says CHANGED. Continue or hold?', expectedDecision: 'HOLD' },
      { id: 'trial-3', caseId: 'case-b-2', conditionId: 'condition-b', order: 3, prompt: 'Closure says CURRENT. Continue or hold?', expectedDecision: 'CONTINUE' },
      { id: 'trial-4', caseId: 'case-a-2', conditionId: 'condition-a', order: 4, prompt: 'Registered file remains unchanged. Continue or hold?', expectedDecision: 'CONTINUE' },
      { id: 'trial-5', caseId: 'case-a-3', conditionId: 'condition-a', order: 5, prompt: 'Registered file moved after registration. Continue or hold?', expectedDecision: 'HOLD' },
      { id: 'trial-6', caseId: 'case-b-3', conditionId: 'condition-b', order: 6, prompt: 'Closure says MISSING. Continue or hold?', expectedDecision: 'HOLD' }
    ],
    fairness: { maximumSameConditionRun: 2 },
    successRule: {
      minimumCompletedSessions,
      minimumCandidateAccuracyGain: 0.25,
      maximumCandidateUnsupportedContinueRate: 0,
      maximumCandidateMeanTimeRatio: 0.8,
      minimumHelpedFraction: 0.5,
      requireNoHighBurden: true
    }
  });
}

function observations() {
  return [
    { trialId: 'trial-1', decision: 'CONTINUE', confidence: 3, confusion: 'SOME', elapsedMs: 4200 },
    { trialId: 'trial-2', decision: 'HOLD', confidence: 5, confusion: 'NONE', elapsedMs: 1800 },
    { trialId: 'trial-3', decision: 'CONTINUE', confidence: 5, confusion: 'NONE', elapsedMs: 1500 },
    { trialId: 'trial-4', decision: 'UNSURE', confidence: 2, confusion: 'SOME', elapsedMs: 5100 },
    { trialId: 'trial-5', decision: 'CONTINUE', confidence: 2, confusion: 'BLOCKED', elapsedMs: 6200 },
    { trialId: 'trial-6', decision: 'HOLD', confidence: 5, confusion: 'NONE', elapsedMs: 1600 }
  ];
}

function makeSession(protocol, sessionId = 'synthetic-session-1', participant = 'synthetic-seat-1') {
  return Human.buildSession(protocol, {
    sessionId,
    generatedAt: '2026-08-19T05:12:00.000Z',
    fixtureMode: protocol.fixtureMode,
    startedAt: '2026-08-19T05:05:00.000Z',
    completedAt: '2026-08-19T05:11:00.000Z',
    participantRef: Human.sha256(participant),
    consent: {
      mode: 'VOLUNTARY_OPT_IN',
      grantedAt: '2026-08-19T05:04:00.000Z',
      completionConfirmedAt: '2026-08-19T05:10:30.000Z',
      withdrawnAt: null,
      useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY',
      retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
    },
    observations: observations(),
    participantJudgment: { effect: 'HELPED', burden: 'LOW', confidence: 5 }
  });
}

const protocolSchema = readJson('human-benefit-protocol.schema.json');
const sessionSchema = readJson('human-benefit-session.schema.json');
const evaluationSchema = readJson('human-benefit-evaluation.schema.json');
const judgmentSchema = readJson('human-benefit-judgment.schema.json');
const contract = readJson('module.contract.json');

ok(protocolSchema.$id === Human.PROTOCOL_SCHEMA, 'protocol schema identity matches the implementation');
ok(sessionSchema.$id === Human.SESSION_SCHEMA, 'session schema identity matches the implementation');
ok(evaluationSchema.$id === Human.EVALUATION_SCHEMA, 'evaluation schema identity matches the implementation');
ok(judgmentSchema.$id === Human.JUDGMENT_SCHEMA, 'judgment schema identity matches the implementation');
ok(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module contract stays TEST with no permissions or writes');
ok(contract.boundaries.refuses.includes('numeric-signal-as-human-judgment'), 'contract refuses numeric evidence as automatic human judgment');

const protocol = makeProtocol();
ok(Human.verifyProtocol(protocol).pass, 'predeclared synthetic protocol verifies');
ok(Human.stableStringify(protocol) === Human.stableStringify(makeProtocol()), 'protocol build is deterministic');
ok(protocol.conditions.map((condition) => condition.role).sort().join(',') === 'BASELINE,CANDIDATE', 'protocol binds one baseline and one candidate');
ok(protocol.trials.filter((trial) => trial.conditionId === 'condition-a').length === protocol.trials.filter((trial) => trial.conditionId === 'condition-b').length, 'protocol balances condition exposure');
ok(protocol.retention.rawIdentity === 'FORBIDDEN' && protocol.retention.freeText === 'FORBIDDEN' && protocol.retention.network === 'DENY', 'protocol minimizes retained human data');
ok(protocol.authority.automaticHumanVerdict === false && protocol.authority.finalHumanJudgmentRequired === true, 'protocol preserves the final human judgment seat');

throws(() => {
  const input = JSON.parse(JSON.stringify(protocol));
  input.conditions[1].role = 'BASELINE';
  Human.buildProtocol(input);
}, /one BASELINE and one CANDIDATE/, 'protocol refuses a missing candidate role');

throws(() => {
  const input = JSON.parse(JSON.stringify(protocol));
  input.trials[2].conditionId = 'condition-a';
  Human.buildProtocol(input);
}, /balanced/, 'protocol refuses unbalanced condition exposure');

throws(() => makeProtocol('SYNTHETIC', 'DECLARED_COHORT', 1), /at least two/, 'cohort scope refuses a one-person minimum');

const tamperedProtocol = JSON.parse(JSON.stringify(protocol));
tamperedProtocol.successRule.minimumCandidateAccuracyGain = -1;
ok(!Human.verifyProtocol(tamperedProtocol).pass, 'protocol tampering breaks deterministic verification');

const session = makeSession(protocol);
ok(Human.verifySession(protocol, session).pass, 'completed synthetic session verifies');
ok(session.usableAsLiveEvidence === false && session.truth.declaredHumanSourceOnly === false, 'synthetic session cannot become live human evidence');
const baselineSummary = session.conditionSummary.find((item) => item.role === 'BASELINE');
const candidateSummary = session.conditionSummary.find((item) => item.role === 'CANDIDATE');
ok(baselineSummary.accuracy === 0 && candidateSummary.accuracy === 1, 'session derives baseline and candidate accuracy from exact trials');
ok(baselineSummary.unsupportedContinues === 2 && candidateSummary.unsupportedContinues === 0, 'session counts unsupported continuation decisions by condition');
ok(session.observations.every((item) => !Object.hasOwn(item, 'note') && !Object.hasOwn(item, 'identity')), 'session retains structured responses without free text or identity fields');

throws(() => {
  const input = {
    sessionId: 'missing-confirmation', generatedAt: '2026-08-19T05:12:00.000Z', fixtureMode: 'SYNTHETIC',
    startedAt: '2026-08-19T05:05:00.000Z', completedAt: '2026-08-19T05:11:00.000Z', participantRef: Human.sha256('seat'),
    consent: { mode: 'VOLUNTARY_OPT_IN', grantedAt: '2026-08-19T05:04:00.000Z', completionConfirmedAt: null, withdrawnAt: null, useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY', retentionAccepted: 'STRUCTURED_NO_FREE_TEXT' },
    observations: observations(), participantJudgment: { effect: 'HELPED', burden: 'LOW', confidence: 5 }
  };
  Human.buildSession(protocol, input);
}, /completion confirmation/, 'completed session refuses missing completion consent');

throws(() => {
  const input = {
    sessionId: 'wrong-trial', generatedAt: '2026-08-19T05:12:00.000Z', fixtureMode: 'SYNTHETIC',
    startedAt: '2026-08-19T05:05:00.000Z', completedAt: '2026-08-19T05:11:00.000Z', participantRef: Human.sha256('seat'),
    consent: { mode: 'VOLUNTARY_OPT_IN', grantedAt: '2026-08-19T05:04:00.000Z', completionConfirmedAt: '2026-08-19T05:10:00.000Z', withdrawnAt: null, useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY', retentionAccepted: 'STRUCTURED_NO_FREE_TEXT' },
    observations: observations(), participantJudgment: { effect: 'HELPED', burden: 'LOW', confidence: 5 }
  };
  input.observations[0].trialId = 'trial-elsewhere';
  Human.buildSession(protocol, input);
}, /does not match/, 'session refuses observations detached from protocol order');

throws(() => {
  const input = {
    sessionId: 'early-receipt', generatedAt: '2026-08-19T05:06:00.000Z', fixtureMode: 'SYNTHETIC',
    startedAt: '2026-08-19T05:05:00.000Z', completedAt: '2026-08-19T05:11:00.000Z', participantRef: Human.sha256('seat'),
    consent: { mode: 'VOLUNTARY_OPT_IN', grantedAt: '2026-08-19T05:04:00.000Z', completionConfirmedAt: '2026-08-19T05:10:00.000Z', withdrawnAt: null, useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY', retentionAccepted: 'STRUCTURED_NO_FREE_TEXT' },
    observations: observations(), participantJudgment: { effect: 'HELPED', burden: 'LOW', confidence: 5 }
  };
  Human.buildSession(protocol, input);
}, /before completion/, 'session receipt refuses impossible chronology');

const withdrawn = Human.buildSession(protocol, {
  sessionId: 'synthetic-withdrawn',
  generatedAt: '2026-08-19T05:08:00.000Z',
  fixtureMode: 'SYNTHETIC',
  startedAt: '2026-08-19T05:05:00.000Z',
  completedAt: '2026-08-19T05:07:00.000Z',
  consent: {
    mode: 'VOLUNTARY_OPT_IN', grantedAt: '2026-08-19T05:04:00.000Z', completionConfirmedAt: null,
    withdrawnAt: '2026-08-19T05:06:00.000Z', useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY', retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
  },
  observations: [],
  participantJudgment: null
});
ok(Human.verifySession(protocol, withdrawn).pass, 'withdrawal receipt verifies');
ok(withdrawn.participantRef === null && withdrawn.observations.length === 0 && withdrawn.participantJudgment === null, 'withdrawal omits participant and observation material');
ok(withdrawn.usableAsLiveEvidence === false, 'withdrawal is never usable as beneficiary evidence');

throws(() => Human.buildSession(protocol, {
  ...withdrawn,
  observations: observations()
}), /omit observations/, 'withdrawal refuses retained observations');

const tamperedSession = JSON.parse(JSON.stringify(session));
tamperedSession.observations[0].correct = true;
ok(!Human.verifySession(protocol, tamperedSession).pass, 'derived session tampering is detected');

const evaluation = Human.buildEvaluation(protocol, [session, withdrawn], {
  evaluationId: 'synthetic-evaluation-positive',
  generatedAt: '2026-08-19T05:13:00.000Z'
});
ok(Human.verifyEvaluation(evaluation).pass, 'aggregate evaluation verifies');
ok(evaluation.signal === 'POSITIVE' && evaluation.state === 'READY_FOR_HUMAN_JUDGMENT', 'predeclared objective and participant signals produce a positive readiness signal');
ok(evaluation.summary.candidateMeanTimeRatio < 0.8, 'evaluation applies the predeclared time-to-decision threshold');
ok(evaluation.humanBenefitVerdict === 'NOT_RUN' && evaluation.truth.numericSignalIsHumanJudgment === false, 'positive numeric signal remains distinct from human judgment');
ok(evaluation.summary.withdrawnSessions === 1 && evaluation.summary.completedSessions === 1, 'evaluation preserves completed and withdrawn counts without withdrawn responses');

throws(() => Human.buildEvaluation(protocol, [session, session], {
  evaluationId: 'duplicate', generatedAt: '2026-08-19T05:13:00.000Z'
}), /session ids must be unique/, 'evaluation refuses duplicate session receipts');

const secondSameParticipant = makeSession(protocol, 'synthetic-session-2', 'synthetic-seat-1');
throws(() => Human.buildEvaluation(protocol, [session, secondSameParticipant], {
  evaluationId: 'duplicate-participant', generatedAt: '2026-08-19T05:13:00.000Z'
}), /one completed session per participantRef/, 'evaluation refuses duplicate participant counting');

const cohortProtocol = makeProtocol('SYNTHETIC', 'DECLARED_COHORT', 2);
const cohortSession = makeSession(cohortProtocol, 'cohort-session-1', 'cohort-seat-1');
const underpowered = Human.buildEvaluation(cohortProtocol, [cohortSession], {
  evaluationId: 'underpowered-cohort', generatedAt: '2026-08-19T05:13:00.000Z'
});
ok(underpowered.state === 'INSUFFICIENT_COMPLETED_SESSIONS' && underpowered.signal === 'INCONCLUSIVE', 'underpowered cohort remains inconclusive');

throws(() => Human.buildJudgment(underpowered, {
  judgmentId: 'underpowered-pass', recordedAt: '2026-08-19T05:14:00.000Z', fixtureMode: 'SYNTHETIC',
  sourceMode: 'SYNTHETIC_FIXTURE', judgeRef: Human.sha256('synthetic-judge'), attestation: Human.SYNTHETIC_ATTESTATION,
  decision: 'PASS', rationaleCodes: ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT']
}), /only receive UNKNOWN/, 'underpowered evaluation cannot receive PASS');

const judgment = Human.buildJudgment(evaluation, {
  judgmentId: 'synthetic-positive-judgment',
  recordedAt: '2026-08-19T05:14:00.000Z',
  fixtureMode: 'SYNTHETIC',
  sourceMode: 'SYNTHETIC_FIXTURE',
  judgeRef: Human.sha256('synthetic-judge'),
  attestation: Human.SYNTHETIC_ATTESTATION,
  decision: 'PASS',
  rationaleCodes: ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT', 'SCOPE_LIMITED']
});
ok(Human.verifyJudgment(evaluation, judgment).pass, 'synthetic judgment receipt verifies as a fixture');
ok(judgment.usableAsHumanEvidence === false && judgment.truth.declaredHumanJudgment === false, 'synthetic judgment cannot impersonate live human evidence');
ok(judgment.targetScope === 'NAMED_LOCAL_STEWARD', 'judgment preserves the exact beneficiary scope');

throws(() => Human.buildJudgment(evaluation, {
  judgmentId: 'wrong-source-mode', recordedAt: '2026-08-19T05:14:00.000Z', fixtureMode: 'SYNTHETIC',
  sourceMode: 'HUMAN_ENTERED', judgeRef: Human.sha256('synthetic-judge'), attestation: Human.SYNTHETIC_ATTESTATION,
  decision: 'PASS', rationaleCodes: ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT']
}), /must be SYNTHETIC_FIXTURE/, 'synthetic evaluation refuses a live source label');

throws(() => Human.buildJudgment(evaluation, {
  judgmentId: 'wrong-attestation', recordedAt: '2026-08-19T05:14:00.000Z', fixtureMode: 'SYNTHETIC',
  sourceMode: 'SYNTHETIC_FIXTURE', judgeRef: Human.sha256('synthetic-judge'), attestation: Human.LIVE_ATTESTATION,
  decision: 'PASS', rationaleCodes: ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT']
}), /attestation text mismatch/, 'synthetic judgment refuses a human attestation phrase');

const tamperedEvaluation = JSON.parse(JSON.stringify(evaluation));
tamperedEvaluation.summary.candidateAccuracyGain = 0;
ok(!Human.verifyEvaluation(tamperedEvaluation).pass, 'aggregate evaluation tampering is detected');
const tamperedJudgment = JSON.parse(JSON.stringify(judgment));
tamperedJudgment.decision = 'UNKNOWN';
ok(!Human.verifyJudgment(evaluation, tamperedJudgment).pass, 'judgment tampering is detected');

const liveProtocol = makeProtocol('LIVE');
const liveWithdrawal = Human.buildSession(liveProtocol, {
  sessionId: 'live-withdrawal-contract-check', generatedAt: '2026-08-19T05:08:00.000Z', fixtureMode: 'LIVE',
  startedAt: '2026-08-19T05:05:00.000Z', completedAt: '2026-08-19T05:07:00.000Z',
  consent: { mode: 'VOLUNTARY_OPT_IN', grantedAt: '2026-08-19T05:04:00.000Z', completionConfirmedAt: null, withdrawnAt: '2026-08-19T05:06:00.000Z', useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY', retentionAccepted: 'STRUCTURED_NO_FREE_TEXT' },
  observations: [], participantJudgment: null
});
ok(liveWithdrawal.state === 'WITHDRAWN' && liveWithdrawal.usableAsLiveEvidence === false, 'live withdrawal path retains no human evidence');

console.log('\nHuman Benefit Evidence selftest: PASS (' + checks + ' checks)');
