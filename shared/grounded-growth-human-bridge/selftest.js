#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Bridge = require('./grounded-growth-human-bridge');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Human = require('../human-benefit-evidence/human-benefit-evidence');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function fixtureCycle() {
  const at = '2026-08-19T06:00:00.000Z';
  const baseline = {
    kind: 'fixture-baseline',
    identity: 'synthetic bridge contract baseline',
    receiptRef: Loop.reference({ baseline: 'fixture' }, { id: 'fixture-capability-baseline', schema: 'axm.baseline-observation/v1' })
  };
  const candidateRef = Loop.reference({ candidate: 'bridge-fixture-capability' }, { id: 'fixture-capability-candidate', schema: 'text/javascript' });
  const candidate = {
    strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
    sourceMutationPerformed: false, installed: false, promoted: false, canon: false
  };
  const verification = {
    verdict: 'PASS', subjectDigest: candidateRef.sha256,
    receiptRef: Loop.reference({ checks: 'synthetic' }, { id: 'fixture-verification', schema: 'axm.focused-test-receipt/v1' }),
    evidenceAuthority: 'MIXED', limitations: ['Synthetic contract fixture only.']
  };
  const decision = {
    verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'fixture-steward', candidateDigest: candidateRef.sha256,
    confirmation: 'CONTINUE VERIFIED CAPABILITY',
    decisionRef: Loop.reference({ decision: 'synthetic continue' }, { id: 'fixture-decision', schema: 'axm.review-decision/v1' })
  };
  const availability = {
    status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId: 'fixture-authority',
    receiptRef: Loop.reference({ availability: 'synthetic' }, { id: 'fixture-availability', schema: 'axm.module-availability-receipt/v1' })
  };
  return Loop.build({
    cycleId: 'fixture-human-bridge-cycle', capabilityId: 'fixture.capability/v1', generatedAt: at,
    baseline,
    need: {
      id: 'fixture-need', statement: 'Synthetic contract fixtures must not become human evidence.',
      sourceRef: Loop.reference({ source: 'fixture' }, { id: 'fixture-need-source', schema: 'axm.research-signal/v1' }),
      directionRef: Loop.reference({ direction: 'truth' }, { id: 'fixture-direction', schema: 'axm.direction-reference/v1' })
    },
    gap: {
      state: 'OPEN', reason: 'The cross-module live-source gate needs a focused contract check.',
      reportRef: Loop.reference({ gap: 'bridge' }, { id: 'fixture-gap', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ probe: 'synthetic-only' }, { id: 'fixture-provenance', schema: 'axm.runtime-probe/v1' })],
    candidate, verification, decision, availability,
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Refresh when bridge inputs or contract change.' }
  });
}

function fixtureProtocol() {
  return Human.buildProtocol({
    protocolId: 'synthetic-human-bridge-protocol',
    generatedAt: '2026-08-19T06:05:00.000Z',
    fixtureMode: 'SYNTHETIC',
    claim: {
      id: 'fixture-human-benefit',
      statement: 'The candidate helps the named fixture steward make fewer unsupported continuation decisions.',
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: 'Synthetic scope placeholder for one named local steward; no real person participated.'
    },
    conditions: [
      { id: 'a', role: 'BASELINE', label: 'Condition A', artifactRef: Human.reference({ surface: 'baseline' }, { id: 'fixture-human-baseline', schema: 'axm.comparison-surface/v1' }) },
      { id: 'b', role: 'CANDIDATE', label: 'Condition B', artifactRef: Human.reference({ surface: 'candidate' }, { id: 'fixture-human-candidate', schema: 'axm.comparison-surface/v1' }) }
    ],
    trials: [
      { id: 't1', caseId: 'c1', conditionId: 'a', order: 1, prompt: 'Baseline hold case.', expectedDecision: 'HOLD' },
      { id: 't2', caseId: 'c2', conditionId: 'b', order: 2, prompt: 'Candidate hold case.', expectedDecision: 'HOLD' },
      { id: 't3', caseId: 'c3', conditionId: 'a', order: 3, prompt: 'Baseline continue case.', expectedDecision: 'CONTINUE' },
      { id: 't4', caseId: 'c4', conditionId: 'b', order: 4, prompt: 'Candidate continue case.', expectedDecision: 'CONTINUE' }
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

function fixtureEvidence() {
  const protocol = fixtureProtocol();
  const session = Human.buildSession(protocol, {
    sessionId: 'synthetic-human-bridge-session', generatedAt: '2026-08-19T06:12:00.000Z', fixtureMode: 'SYNTHETIC',
    startedAt: '2026-08-19T06:06:00.000Z', completedAt: '2026-08-19T06:11:00.000Z', participantRef: Human.sha256('fixture-seat'),
    consent: {
      mode: 'VOLUNTARY_OPT_IN', grantedAt: '2026-08-19T06:05:30.000Z', completionConfirmedAt: '2026-08-19T06:10:30.000Z',
      withdrawnAt: null, useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY', retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
    },
    observations: [
      { trialId: 't1', decision: 'CONTINUE', confidence: 2, confusion: 'SOME', elapsedMs: 5000 },
      { trialId: 't2', decision: 'HOLD', confidence: 5, confusion: 'NONE', elapsedMs: 1000 },
      { trialId: 't3', decision: 'UNSURE', confidence: 2, confusion: 'SOME', elapsedMs: 5000 },
      { trialId: 't4', decision: 'CONTINUE', confidence: 5, confusion: 'NONE', elapsedMs: 1000 }
    ],
    participantJudgment: { effect: 'HELPED', burden: 'LOW', confidence: 5 }
  });
  const evaluation = Human.buildEvaluation(protocol, [session], {
    evaluationId: 'synthetic-human-bridge-evaluation', generatedAt: '2026-08-19T06:13:00.000Z'
  });
  const judgment = Human.buildJudgment(evaluation, {
    judgmentId: 'synthetic-human-bridge-judgment', recordedAt: '2026-08-19T06:14:00.000Z', fixtureMode: 'SYNTHETIC',
    sourceMode: 'SYNTHETIC_FIXTURE', judgeRef: Human.sha256('fixture-judge'), attestation: Human.SYNTHETIC_ATTESTATION,
    decision: 'PASS', rationaleCodes: ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT', 'SCOPE_LIMITED']
  });
  return { protocol, evaluation, judgment };
}

function buildInput(overrides) {
  const cycle = fixtureCycle();
  const { protocol, evaluation, judgment } = fixtureEvidence();
  const trustRef = Human.reference({ fixture: 'named-local-steward-declaration' }, { id: 'fixture-source-trust', schema: 'axm.local-steward-source-declaration/v1' });
  const baselineRef = protocol.conditions.find((item) => item.role === 'BASELINE').artifactRef;
  const candidateRef = protocol.conditions.find((item) => item.role === 'CANDIDATE').artifactRef;
  const interventionLinkRef = Human.reference({
    relation: 'EVALUATED_SURFACE_PRESENTS_CAPABILITY_CANDIDATE',
    capabilityCandidate: cycle.candidate.artifactRef,
    evaluatedCandidate: candidateRef
  }, { id: 'fixture-capability-intervention-link', schema: 'axm.capability-intervention-link/v1' });
  const closureSources = [
    { id: cycle.cycleId, schema: cycle.schema, sha256: cycle.receiptDigest },
    { id: protocol.protocolId, schema: protocol.schema, sha256: protocol.protocolDigest },
    { id: evaluation.evaluationId, schema: evaluation.schema, sha256: evaluation.evaluationDigest },
    { id: judgment.judgmentId, schema: judgment.schema, sha256: judgment.judgmentDigest },
    baselineRef, candidateRef, cycle.baseline.receiptRef, cycle.candidate.artifactRef, interventionLinkRef, trustRef
  ];
  const input = {
    bridgeId: 'synthetic-human-bridge', outcomeId: 'synthetic-human-bridge-outcome', generatedAt: '2026-08-19T06:15:00.000Z',
    cycleReceipt: cycle, evaluation, judgment,
    binding: {
      claimId: protocol.claim.id, capabilityId: cycle.capabilityId,
      targetScope: protocol.claim.targetScope, scopeStatement: protocol.claim.scopeStatement,
      interventionLink: {
        relation: 'EVALUATED_SURFACE_PRESENTS_CAPABILITY_CANDIDATE',
        capabilityCandidateRef: cycle.candidate.artifactRef,
        evaluatedCandidateRef: candidateRef,
        linkRef: interventionLinkRef
      },
      sourceTrust: { mode: 'NAMED_LOCAL_STEWARD_DECLARATION', trustRef }
    },
    evidenceClosure: Bridge.buildClosure({
      closureId: 'fixture-closure', state: 'CURRENT', checkedAt: '2026-08-19T06:15:00.000Z', sources: closureSources
    })
  };
  return Object.assign(input, overrides || {});
}

const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-human-bridge-receipt.schema.json'), 'utf8'));
const bundleSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-human-bridge-bundle.schema.json'), 'utf8'));
const closureSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-human-closure-receipt.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
ok(receiptSchema.$id === Bridge.RECEIPT_SCHEMA, 'bridge receipt schema identity matches the implementation');
ok(bundleSchema.$id === Bridge.BUNDLE_SCHEMA, 'bridge bundle schema identity matches the implementation');
ok(closureSchema.$id === Bridge.CLOSURE_SCHEMA, 'bridge closure schema identity matches the implementation');
ok(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module stays TEST with no permissions or writes');
ok(contract.boundaries.refuses.includes('synthetic-fixture-as-human-benefit'), 'contract explicitly refuses synthetic fixtures as human benefit');
ok(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
ok(Bridge.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
assert.throws(() => Bridge.stableStringify({ lost: undefined }), /unsupported undefined/i);
checks += 1;
console.log('PASS unsafe canonical state is refused');

const input = buildInput();
const bundle = Bridge.build(input);
ok(bundle.bridgeReceipt.nativeVerification.evaluation === 'PASS' && bundle.bridgeReceipt.nativeVerification.judgment === 'PASS', 'synthetic native receipts still verify as contract fixtures');
ok(bundle.bridgeReceipt.admission.state === 'SYNTHETIC_HOLD', 'synthetic evidence is held at the cross-module boundary');
ok(bundle.bridgeReceipt.admission.mappedDecision === 'UNKNOWN', 'synthetic PASS maps to UNKNOWN');
ok(bundle.groundedOutcome.claims[0].admittedVerdict === 'UNKNOWN' && bundle.groundedOutcome.claims[0].routeStatus === 'NOT_PROVEN', 'Grounded Growth receives no admitted synthetic human verdict');
ok(bundle.groundedOutcome.state === 'AVAILABLE_EFFECT_UNKNOWN', 'even an available synthetic capability cannot become HUMAN_GROWTH_ONLY');
ok(bundle.groundedOutcome.claims[0].statement.includes('NAMED_LOCAL_STEWARD') && bundle.groundedOutcome.claims[0].limitations[0].includes('NAMED_LOCAL_STEWARD'), 'scope survives in the bridge and Grounded claim text');
ok(Bridge.verify(bundle, { evaluation: input.evaluation, judgment: input.judgment }).pass, 'bundle verifies against the exact native sources');
ok(Bridge.stableStringify(bundle) === Bridge.stableStringify(Bridge.build(input)), 'bridge build is deterministic');

const tamperedEvaluationInput = buildInput();
tamperedEvaluationInput.evaluation.summary.candidateAccuracyGain = 0;
const tamperedEvaluationBundle = Bridge.build(tamperedEvaluationInput);
ok(tamperedEvaluationBundle.bridgeReceipt.nativeVerification.evaluation === 'FAIL', 'tampered evaluation fails native verification');
ok(tamperedEvaluationBundle.bridgeReceipt.admission.mappedDecision === 'UNKNOWN', 'tampered evaluation cannot map a human verdict');

const tamperedJudgmentInput = buildInput();
tamperedJudgmentInput.judgment.decision = 'UNKNOWN';
const tamperedJudgmentBundle = Bridge.build(tamperedJudgmentInput);
ok(tamperedJudgmentBundle.bridgeReceipt.nativeVerification.judgment === 'FAIL', 'tampered judgment fails native verification');
ok(tamperedJudgmentBundle.groundedOutcome.claims[0].admittedVerdict === 'UNKNOWN', 'tampered judgment stays unproven in Grounded Growth');

const capabilityMismatchInput = buildInput();
capabilityMismatchInput.binding.capabilityId = 'another.capability/v1';
const capabilityMismatchBundle = Bridge.build(capabilityMismatchInput);
ok(capabilityMismatchBundle.bridgeReceipt.admission.reasonCodes.includes('CLAIM_CAPABILITY_BINDING_MISMATCH'), 'claim-to-capability mismatch is held');

const interventionMismatchInput = buildInput();
interventionMismatchInput.binding.interventionLink.evaluatedCandidateRef = Human.reference(
  { surface: 'unrelated' }, { id: 'unrelated-surface', schema: 'axm.comparison-surface/v1' }
);
const interventionMismatchBundle = Bridge.build(interventionMismatchInput);
ok(interventionMismatchBundle.bridgeReceipt.admission.reasonCodes.includes('CAPABILITY_INTERVENTION_LINK_MISMATCH'), 'unrelated candidate surface cannot bind itself to the capability');

const trustSchemaMismatchInput = buildInput();
trustSchemaMismatchInput.binding.sourceTrust.trustRef.schema = 'application/octet-stream';
trustSchemaMismatchInput.evidenceClosure = Bridge.buildClosure({
  ...trustSchemaMismatchInput.evidenceClosure,
  sources: trustSchemaMismatchInput.evidenceClosure.sources.map((source) => source.id === 'fixture-source-trust'
    ? trustSchemaMismatchInput.binding.sourceTrust.trustRef
    : source)
});
const trustSchemaMismatchBundle = Bridge.build(trustSchemaMismatchInput);
ok(trustSchemaMismatchBundle.bridgeReceipt.admission.reasonCodes.includes('SOURCE_TRUST_SCHEMA_MISMATCH'), 'source-trust mode requires its scope-specific receipt schema');

const scopeMismatchInput = buildInput();
scopeMismatchInput.binding.targetScope = 'DECLARED_COHORT';
scopeMismatchInput.binding.scopeStatement = 'A different declared cohort.';
scopeMismatchInput.binding.sourceTrust = {
  mode: 'EXTERNAL_COHORT_AUTHENTICATION',
  trustRef: Human.reference({ cohort: 'fixture-authentication' }, { id: 'fixture-cohort-trust', schema: 'axm.external-cohort-authentication/v1' })
};
scopeMismatchInput.evidenceClosure = Bridge.buildClosure({
  ...scopeMismatchInput.evidenceClosure,
  sources: [...scopeMismatchInput.evidenceClosure.sources, scopeMismatchInput.binding.sourceTrust.trustRef]
});
const scopeMismatchBundle = Bridge.build(scopeMismatchInput);
ok(scopeMismatchBundle.bridgeReceipt.admission.reasonCodes.includes('PROTOCOL_SCOPE_MISMATCH'), 'protocol scope cannot be relabeled by the bridge binding');
ok(scopeMismatchBundle.bridgeReceipt.admission.reasonCodes.includes('JUDGMENT_SCOPE_MISMATCH'), 'judgment scope cannot be expanded by the bridge binding');

const incompleteClosureInput = buildInput();
incompleteClosureInput.evidenceClosure = Bridge.buildClosure({
  ...incompleteClosureInput.evidenceClosure,
  sources: incompleteClosureInput.evidenceClosure.sources.filter((source) => source.sha256 !== incompleteClosureInput.judgment.judgmentDigest)
});
const incompleteClosureBundle = Bridge.build(incompleteClosureInput);
ok(incompleteClosureBundle.bridgeReceipt.admission.state === 'EVIDENCE_HOLD', 'incomplete exact closure holds the bridge');
ok(incompleteClosureBundle.bridgeReceipt.admission.reasonCodes.includes('EVIDENCE_CLOSURE_INCOMPLETE'), 'missing judgment closure is named explicitly');

const heldClosureInput = buildInput();
heldClosureInput.evidenceClosure = Bridge.buildClosure({ ...heldClosureInput.evidenceClosure, state: 'HELD' });
const heldClosureBundle = Bridge.build(heldClosureInput);
ok(heldClosureBundle.bridgeReceipt.admission.reasonCodes.includes('EVIDENCE_CLOSURE_NOT_CURRENT'), 'held closure cannot admit human benefit');

const tamperedClosureInput = buildInput();
tamperedClosureInput.evidenceClosure.sources.pop();
assert.throws(() => Bridge.build(tamperedClosureInput), /closure content or digest mismatch/);
checks += 1; console.log('PASS closure source-list tampering is refused before mapping');

const earlyBridgeInput = buildInput();
earlyBridgeInput.generatedAt = '2026-08-19T06:13:30.000Z';
const earlyBridgeBundle = Bridge.build(earlyBridgeInput);
ok(earlyBridgeBundle.bridgeReceipt.admission.reasonCodes.includes('BRIDGE_CHRONOLOGY_INVALID'), 'bridge receipt cannot predate its judgment or closure');

const forgedLiveInput = buildInput();
forgedLiveInput.evaluation.fixtureMode = 'LIVE';
forgedLiveInput.evaluation.protocol.fixtureMode = 'LIVE';
forgedLiveInput.judgment.fixtureMode = 'LIVE';
forgedLiveInput.judgment.sourceMode = 'HUMAN_ENTERED';
forgedLiveInput.judgment.attestation = Human.LIVE_ATTESTATION;
forgedLiveInput.judgment.usableAsHumanEvidence = true;
forgedLiveInput.judgment.truth.declaredHumanJudgment = true;
const forgedLiveBundle = Bridge.build(forgedLiveInput);
ok(forgedLiveBundle.bridgeReceipt.nativeVerification.evaluation === 'FAIL' && forgedLiveBundle.bridgeReceipt.nativeVerification.judgment === 'FAIL', 'changing synthetic labels cannot forge a native LIVE receipt');
ok(forgedLiveBundle.bridgeReceipt.admission.state === 'NATIVE_OR_BINDING_HOLD', 'forged LIVE labels remain held');

const tamperedBundle = JSON.parse(JSON.stringify(bundle));
tamperedBundle.bridgeReceipt.admission.state = 'ADMITTED';
ok(!Bridge.verify(tamperedBundle, { evaluation: input.evaluation, judgment: input.judgment }).pass, 'bundle tampering breaks exact rebuild verification');
ok(!Bridge.verify(bundle, {}).pass, 'bundle verification refuses missing native source receipts');
ok(bundle.bridgeReceipt.truth.automaticPromotion === false && bundle.bridgeReceipt.truth.automaticCanon === false && bundle.bridgeReceipt.truth.automaticRootMutation === false, 'bridge carries no promotion, CANON or root authority');
ok(bundle.bridgeReceipt.truth.sourceAuthenticationPerformedByModule === false, 'bridge does not claim human source authentication');

console.log('\nGrounded Growth Human Bridge selftest: PASS (' + checks + ' checks)');
