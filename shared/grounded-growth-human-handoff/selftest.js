'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Handoff = require('./grounded-growth-human-handoff');
const Bridge = require('../grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Human = require('../human-benefit-evidence/human-benefit-evidence');

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

function baseline(suffix) {
  return {
    kind: 'fixture-baseline',
    identity: 'synthetic handoff baseline ' + suffix,
    receiptRef: Loop.reference({ baseline: suffix }, {
      id: 'fixture-handoff-baseline-' + suffix,
      schema: 'axm.baseline-observation/v1'
    })
  };
}

function need(suffix) {
  return {
    id: 'fixture-handoff-need-' + suffix,
    statement: 'Exercise the human handoff contract without producing human evidence.',
    sourceRef: Loop.reference({ source: suffix }, {
      id: 'fixture-handoff-source-' + suffix,
      schema: 'axm.research-signal/v1'
    }),
    directionRef: Loop.reference({ direction: 'truth' }, {
      id: 'fixture-handoff-direction-' + suffix,
      schema: 'axm.direction-reference/v1'
    })
  };
}

function candidateCycle() {
  const candidateRef = Loop.reference({ candidate: 'handoff' }, {
    id: 'fixture-handoff-capability-candidate',
    schema: 'text/javascript'
  });
  return Loop.build({
    cycleId: 'fixture-handoff-candidate-cycle',
    capabilityId: 'fixture.handoff-candidate/v1',
    generatedAt: '2026-08-19T06:00:00.000Z',
    baseline: baseline('candidate'),
    need: need('candidate'),
    gap: {
      state: 'OPEN',
      reason: 'A synthetic candidate exists only to exercise the handoff contract.',
      reportRef: Loop.reference({ gap: 'candidate' }, {
        id: 'fixture-handoff-candidate-gap', schema: 'axm.capability-gap-report/v1'
      })
    },
    provenance: [Loop.reference({ fixture: 'candidate' }, {
      id: 'fixture-handoff-candidate-provenance', schema: 'axm.runtime-probe/v1'
    })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: false, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference({ verification: 'candidate' }, {
        id: 'fixture-handoff-candidate-verification', schema: 'axm.focused-test-receipt/v1'
      }),
      evidenceAuthority: 'MIXED', limitations: ['Synthetic contract fixture only.']
    },
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION', checkedAt: '2026-08-19T06:00:00.000Z', due: false,
      reason: 'Refresh when the fixture changes.'
    }
  });
}

function reuseCycle() {
  const existingCapabilityRef = Loop.reference({ capability: 'existing-handoff' }, {
    id: 'fixture-handoff-existing-capability', schema: 'text/javascript'
  });
  return Loop.build({
    cycleId: 'fixture-handoff-reuse-cycle',
    capabilityId: 'fixture.handoff-reuse/v1',
    generatedAt: '2026-08-19T06:00:00.000Z',
    baseline: baseline('reuse'),
    need: need('reuse'),
    gap: {
      state: 'NO_GAP',
      reason: 'The exact capability already exists.',
      reportRef: Loop.reference({ gap: 'none' }, {
        id: 'fixture-handoff-reuse-gap', schema: 'axm.capability-gap-report/v1'
      }),
      existingCapabilityRef
    },
    provenance: [],
    candidate: null,
    verification: null,
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION', checkedAt: '2026-08-19T06:00:00.000Z', due: false,
      reason: 'Refresh when the exact existing capability changes.'
    }
  });
}

function protocolFor(cycle, suffix) {
  return Human.buildProtocol({
    protocolId: 'synthetic-handoff-protocol-' + suffix,
    generatedAt: '2026-08-19T06:05:00.000Z',
    fixtureMode: 'SYNTHETIC',
    claim: {
      id: 'fixture-handoff-human-benefit-' + suffix,
      statement: 'The evaluated surface helps the named local steward make fewer unsupported decisions.',
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: 'Synthetic local-steward scope only; no person participated.'
    },
    conditions: [
      {
        id: 'a', role: 'BASELINE', label: 'Condition A',
        artifactRef: Human.reference({ surface: 'baseline', capabilityId: cycle.capabilityId }, {
          id: 'fixture-handoff-human-baseline-' + suffix, schema: 'axm.comparison-surface/v1'
        })
      },
      {
        id: 'b', role: 'CANDIDATE', label: 'Condition B',
        artifactRef: Human.reference({ surface: 'evaluated', capabilityId: cycle.capabilityId }, {
          id: 'fixture-handoff-human-candidate-' + suffix, schema: 'axm.comparison-surface/v1'
        })
      }
    ],
    trials: [
      { id: suffix + '-t1', caseId: suffix + '-c1', conditionId: 'a', order: 1, prompt: 'Baseline hold case.', expectedDecision: 'HOLD' },
      { id: suffix + '-t2', caseId: suffix + '-c2', conditionId: 'b', order: 2, prompt: 'Evaluated hold case.', expectedDecision: 'HOLD' },
      { id: suffix + '-t3', caseId: suffix + '-c3', conditionId: 'a', order: 3, prompt: 'Baseline continue case.', expectedDecision: 'CONTINUE' },
      { id: suffix + '-t4', caseId: suffix + '-c4', conditionId: 'b', order: 4, prompt: 'Evaluated continue case.', expectedDecision: 'CONTINUE' }
    ],
    fairness: { maximumSameConditionRun: 1 },
    successRule: {
      minimumCompletedSessions: 1,
      minimumCandidateAccuracyGain: 0.5,
      maximumCandidateUnsupportedContinueRate: 0,
      maximumCandidateMeanTimeRatio: 0.5,
      minimumHelpedFraction: 1,
      requireNoHighBurden: true
    }
  });
}

function sessionFor(protocol, suffix) {
  return Human.buildSession(protocol, {
    sessionId: 'synthetic-handoff-session-' + suffix,
    generatedAt: '2026-08-19T06:12:00.000Z',
    fixtureMode: 'SYNTHETIC',
    startedAt: '2026-08-19T06:06:00.000Z',
    completedAt: '2026-08-19T06:11:00.000Z',
    participantRef: Human.sha256('fixture-handoff-seat-' + suffix),
    consent: {
      mode: 'VOLUNTARY_OPT_IN',
      grantedAt: '2026-08-19T06:05:30.000Z',
      completionConfirmedAt: '2026-08-19T06:10:30.000Z',
      withdrawnAt: null,
      useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY',
      retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
    },
    observations: [
      { trialId: suffix + '-t1', decision: 'CONTINUE', confidence: 2, confusion: 'SOME', elapsedMs: 5000 },
      { trialId: suffix + '-t2', decision: 'HOLD', confidence: 5, confusion: 'NONE', elapsedMs: 1000 },
      { trialId: suffix + '-t3', decision: 'UNSURE', confidence: 2, confusion: 'SOME', elapsedMs: 5000 },
      { trialId: suffix + '-t4', decision: 'CONTINUE', confidence: 5, confusion: 'NONE', elapsedMs: 1000 }
    ],
    participantJudgment: { effect: 'HELPED', burden: 'LOW', confidence: 5 }
  });
}

function fixture(mode, closureState) {
  const suffix = mode === 'reuse' ? 'reuse' : 'candidate';
  const cycle = mode === 'reuse' ? reuseCycle() : candidateCycle();
  const protocol = protocolFor(cycle, suffix);
  const session = sessionFor(protocol, suffix);
  const evaluation = Handoff.prepareEvaluation({
    cycleReceipt: cycle,
    protocol,
    sessions: [session],
    evaluationId: 'synthetic-handoff-evaluation-' + suffix,
    generatedAt: '2026-08-19T06:13:00.000Z'
  });
  const judgment = Human.buildJudgment(evaluation, {
    judgmentId: 'synthetic-handoff-judgment-' + suffix,
    recordedAt: '2026-08-19T06:14:00.000Z',
    fixtureMode: 'SYNTHETIC',
    sourceMode: 'SYNTHETIC_FIXTURE',
    judgeRef: Human.sha256('fixture-handoff-judge-' + suffix),
    attestation: Human.SYNTHETIC_ATTESTATION,
    decision: 'PASS',
    rationaleCodes: ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT', 'SCOPE_LIMITED']
  });
  const sourceDeclaration = Handoff.buildSourceDeclaration({
    declarationId: 'synthetic-handoff-source-declaration-' + suffix,
    declaredAt: '2026-08-19T06:15:00.000Z',
    declarationMode: Handoff.SYNTHETIC_DECLARATION_MODE,
    attestation: Handoff.SYNTHETIC_SOURCE_ATTESTATION,
    evaluation,
    judgment
  });
  const interventionLink = Bridge.buildInterventionLink({
    linkId: 'synthetic-handoff-link-' + suffix,
    generatedAt: '2026-08-19T06:15:30.000Z',
    cycleReceipt: cycle,
    protocol
  });
  const handoffPackage = Handoff.buildPackage({
    handoffId: 'synthetic-handoff-package-' + suffix,
    generatedAt: '2026-08-19T06:18:00.000Z',
    closureId: 'synthetic-handoff-closure-' + suffix,
    closureState: closureState || 'CURRENT',
    closureCheckedAt: '2026-08-19T06:17:00.000Z',
    bridgeId: 'synthetic-handoff-bridge-' + suffix,
    outcomeId: 'synthetic-handoff-outcome-' + suffix,
    cycleReceipt: cycle,
    evaluation,
    judgment,
    sourceDeclaration,
    interventionLink
  });
  return { cycle, protocol, session, evaluation, judgment, sourceDeclaration, interventionLink, handoffPackage };
}

const sourceSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'local-steward-source-declaration.schema.json'), 'utf8'));
const packageSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-human-handoff-package.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const candidate = fixture('candidate');
const reuse = fixture('reuse');

ok(sourceSchema.$id === Handoff.SOURCE_DECLARATION_SCHEMA, 'source declaration schema identity matches the implementation');
ok(packageSchema.$id === Handoff.HANDOFF_SCHEMA, 'handoff package schema identity matches the implementation');
ok(contract.status === 'TEST' && contract.permissions.length === 0, 'handoff leaf remains TEST with no permissions');
ok(contract.boundaries.writes.length === 0, 'handoff leaf declares no automatic writes');
ok(contract.boundaries.refuses.includes('judgment-derived-from-numeric-signal'), 'contract refuses automatic judgment from evaluation signal');
ok(contract.boundaries.refuses.includes('source-declaration-as-identity-authentication'), 'contract refuses identity authentication claims');
ok(contract.boundaries.refuses.includes('synthetic-fixture-as-human-benefit'), 'contract refuses synthetic fixtures as human benefit');

ok(Human.verifyEvaluation(candidate.evaluation).pass, 'candidate evaluation verifies natively');
ok(Human.verifyEvaluation(reuse.evaluation).pass, 'reuse evaluation verifies natively');
ok(candidate.evaluation.signal === 'POSITIVE' && reuse.evaluation.signal === 'POSITIVE', 'synthetic evaluations exercise the positive-signal boundary');
ok(Handoff.verifySourceDeclaration(candidate.evaluation, candidate.judgment, candidate.sourceDeclaration).pass, 'candidate source declaration verifies natively');
ok(Handoff.verifySourceDeclaration(reuse.evaluation, reuse.judgment, reuse.sourceDeclaration).pass, 'reuse source declaration verifies natively');
ok(candidate.sourceDeclaration.usableAsSourceTrust === false, 'synthetic candidate declaration is never usable as source trust');
ok(reuse.sourceDeclaration.truth.humanPresenceAuthenticated === false, 'local declaration does not authenticate human presence');
ok(reuse.sourceDeclaration.truth.identityAuthenticated === false, 'local declaration does not authenticate identity');
ok(reuse.sourceDeclaration.truth.cohortAuthenticationPerformed === false, 'local declaration does not authenticate a cohort');

ok(candidate.handoffPackage.ancestryMode === 'CANDIDATE', 'candidate package preserves candidate ancestry');
ok(reuse.handoffPackage.ancestryMode === 'REUSE_EXISTING', 'reuse package preserves reuse-existing ancestry');
ok(reuse.cycle.candidate === null, 'reuse package invents no capability candidate');
ok(Handoff.verifyPackage(candidate.handoffPackage).pass, 'candidate handoff package verifies exactly');
ok(Handoff.verifyPackage(reuse.handoffPackage).pass, 'reuse handoff package verifies exactly');
ok(Bridge.verify(candidate.handoffPackage.bridgeBundle, { evaluation: candidate.evaluation, judgment: candidate.judgment }).pass, 'candidate bridge bundle verifies against native sources');
ok(Bridge.verify(reuse.handoffPackage.bridgeBundle, { evaluation: reuse.evaluation, judgment: reuse.judgment }).pass, 'reuse bridge bundle verifies against native sources');
ok(candidate.handoffPackage.state === 'SYNTHETIC_HOLD' && reuse.handoffPackage.state === 'SYNTHETIC_HOLD', 'both synthetic packages remain on synthetic hold');
ok(candidate.handoffPackage.mappedDecision === 'UNKNOWN' && reuse.handoffPackage.mappedDecision === 'UNKNOWN', 'synthetic fixture PASS cannot map into Grounded Growth');
ok(candidate.handoffPackage.truth.judgmentDerivedFromSignal === false, 'handoff records that judgment is not derived from the signal');
ok(candidate.handoffPackage.truth.judgmentRemainsExplicitHumanInput === true, 'handoff preserves explicit judgment as a separate input');

const candidateBinding = candidate.handoffPackage.bridgeBundle.bridgeReceipt.binding;
ok(candidateBinding.sourceTrust.trustRef.sha256 === candidate.sourceDeclaration.sourceDeclarationDigest, 'bridge trust binds the exact native source declaration');
const reuseClosure = reuse.handoffPackage.bridgeBundle.bridgeReceipt.evidenceClosureReceipt.sources;
ok(reuseClosure.some((ref) => ref.sha256 === reuse.sourceDeclaration.sourceDeclarationDigest), 'closure covers the source declaration digest');
ok(reuseClosure.some((ref) => ref.sha256 === reuse.interventionLink.linkDigest), 'closure covers the v2 intervention link');
ok(reuseClosure.some((ref) => ref.sha256 === reuse.interventionLink.ancestry.capabilitySurfaceRef.sha256), 'closure covers the exact reused capability surface');

throws(() => Handoff.buildSourceDeclaration({
  declarationId: candidate.sourceDeclaration.declarationId,
  declaredAt: candidate.sourceDeclaration.declaredAt,
  declarationMode: Handoff.SYNTHETIC_DECLARATION_MODE,
  attestation: Handoff.LIVE_SOURCE_ATTESTATION,
  evaluation: candidate.evaluation,
  judgment: candidate.judgment
}), /attestation text mismatch/, 'wrong source attestation is refused');
throws(() => Handoff.buildSourceDeclaration({
  declarationId: candidate.sourceDeclaration.declarationId,
  declaredAt: candidate.sourceDeclaration.declaredAt,
  declarationMode: Handoff.LIVE_DECLARATION_MODE,
  attestation: Handoff.LIVE_SOURCE_ATTESTATION,
  evaluation: candidate.evaluation,
  judgment: candidate.judgment
}), /mode must match/, 'synthetic evaluation cannot be relabeled LIVE');

const swappedDeclaration = JSON.parse(JSON.stringify(candidate.sourceDeclaration));
ok(!Handoff.verifySourceDeclaration(reuse.evaluation, reuse.judgment, swappedDeclaration).pass, 'source declaration cannot cross capability routes');
throws(() => Handoff.buildPackage({
  handoffId: 'cross-route-handoff', generatedAt: '2026-08-19T06:18:00.000Z',
  closureId: 'cross-route-closure', closureState: 'CURRENT', closureCheckedAt: '2026-08-19T06:17:00.000Z',
  bridgeId: 'cross-route-bridge', outcomeId: 'cross-route-outcome',
  cycleReceipt: reuse.cycle, evaluation: reuse.evaluation, judgment: reuse.judgment,
  sourceDeclaration: candidate.sourceDeclaration, interventionLink: reuse.interventionLink
}), /source declaration is invalid/, 'cross-route source declaration is refused before bridge composition');
throws(() => Handoff.buildPackage({
  handoffId: 'cross-link-handoff', generatedAt: '2026-08-19T06:18:00.000Z',
  closureId: 'cross-link-closure', closureState: 'CURRENT', closureCheckedAt: '2026-08-19T06:17:00.000Z',
  bridgeId: 'cross-link-bridge', outcomeId: 'cross-link-outcome',
  cycleReceipt: reuse.cycle, evaluation: reuse.evaluation, judgment: reuse.judgment,
  sourceDeclaration: reuse.sourceDeclaration, interventionLink: candidate.interventionLink
}), /intervention link is invalid/, 'candidate intervention link cannot cross into reuse ancestry');
throws(() => Handoff.prepareEvaluation({
  cycleReceipt: reuse.cycle,
  protocol: reuse.protocol,
  sessions: [candidate.session],
  evaluationId: 'cross-session-evaluation',
  generatedAt: '2026-08-19T06:13:00.000Z'
}), /session\[0\] is invalid/, 'session receipt cannot cross protocol routes');

const held = fixture('reuse', 'HELD');
ok(held.handoffPackage.state === 'EVIDENCE_HOLD', 'held closure remains an evidence hold');
ok(held.handoffPackage.mappedDecision === 'UNKNOWN', 'held closure cannot map a fixture decision');

const tamperedDeclaration = JSON.parse(JSON.stringify(candidate.handoffPackage));
tamperedDeclaration.sourceDeclaration.attestation = 'I changed this after the fact.';
ok(!Handoff.verifyPackage(tamperedDeclaration).pass, 'source declaration tampering breaks package verification');
const tamperedBundle = JSON.parse(JSON.stringify(reuse.handoffPackage));
tamperedBundle.bridgeBundle.bridgeReceipt.capabilityAncestry.mode = 'CANDIDATE';
ok(!Handoff.verifyPackage(tamperedBundle).pass, 'ancestry tampering breaks package verification');
const tamperedDigest = JSON.parse(JSON.stringify(candidate.handoffPackage));
tamperedDigest.handoffDigest = Human.sha256('wrong handoff');
ok(!Handoff.verifyPackage(tamperedDigest).pass, 'handoff digest tampering breaks verification');

const rebuiltReuse = fixture('reuse').handoffPackage;
ok(Handoff.stableStringify(rebuiltReuse) === Handoff.stableStringify(reuse.handoffPackage), 'reuse handoff build is deterministic');
ok(reuse.handoffPackage.truth.automaticPromotion === false && reuse.handoffPackage.truth.automaticCanon === false, 'handoff package carries no promotion or CANON authority');
ok(reuse.handoffPackage.truth.foundationMutation === false && reuse.handoffPackage.truth.modelWeightTrainingClaimed === false, 'handoff package carries no Foundation or model-training claim');

console.log('\nGrounded Growth human handoff selftest: PASS (' + checks + ' checks)');
