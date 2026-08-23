#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Bridge = require('./grounded-growth-human-bridge-v2');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Human = require('../human-benefit-evidence/human-benefit-evidence');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function baseline(suffix) {
  return {
    kind: 'fixture-baseline',
    identity: 'synthetic bridge v2 baseline ' + suffix,
    receiptRef: Loop.reference({ baseline: suffix }, { id: 'fixture-v2-baseline-' + suffix, schema: 'axm.baseline-observation/v1' })
  };
}

function need(suffix) {
  return {
    id: 'fixture-v2-need-' + suffix,
    statement: 'Synthetic ancestry fixtures must not become human evidence.',
    sourceRef: Loop.reference({ source: suffix }, { id: 'fixture-v2-source-' + suffix, schema: 'axm.research-signal/v1' }),
    directionRef: Loop.reference({ direction: 'truth' }, { id: 'fixture-v2-direction-' + suffix, schema: 'axm.direction-reference/v1' })
  };
}

function candidateCycle() {
  const candidateRef = Loop.reference({ candidate: 'v2' }, { id: 'fixture-v2-capability-candidate', schema: 'text/javascript' });
  return Loop.build({
    cycleId: 'fixture-v2-candidate-cycle',
    capabilityId: 'fixture.candidate-capability/v1',
    generatedAt: '2026-08-19T06:00:00.000Z',
    baseline: baseline('candidate'),
    need: need('candidate'),
    gap: {
      state: 'OPEN',
      reason: 'A synthetic candidate exists only to exercise the contract.',
      reportRef: Loop.reference({ gap: 'candidate' }, { id: 'fixture-v2-candidate-gap', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ fixture: 'candidate' }, { id: 'fixture-v2-candidate-provenance', schema: 'axm.runtime-probe/v1' })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: false, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference({ verification: 'candidate' }, { id: 'fixture-v2-candidate-verification', schema: 'axm.focused-test-receipt/v1' }),
      evidenceAuthority: 'MIXED', limitations: ['Synthetic contract fixture only.']
    },
    decision: null,
    availability: null,
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: '2026-08-19T06:00:00.000Z', due: false, reason: 'Refresh when fixture contract changes.' }
  });
}

function reuseCycle() {
  const existingCapabilityRef = Loop.reference(
    { capability: 'existing-v2' },
    { id: 'fixture-v2-existing-capability', schema: 'text/javascript' }
  );
  return Loop.build({
    cycleId: 'fixture-v2-reuse-cycle',
    capabilityId: 'fixture.reused-capability/v1',
    generatedAt: '2026-08-19T06:00:00.000Z',
    baseline: baseline('reuse'),
    need: need('reuse'),
    gap: {
      state: 'NO_GAP',
      reason: 'The exact capability already exists.',
      reportRef: Loop.reference({ gap: 'none' }, { id: 'fixture-v2-reuse-gap', schema: 'axm.capability-gap-report/v1' }),
      existingCapabilityRef
    },
    provenance: [],
    candidate: null,
    verification: null,
    decision: null,
    availability: null,
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: '2026-08-19T06:00:00.000Z', due: false, reason: 'Refresh when exact existing capability changes.' }
  });
}

function protocolFor(cycle, suffix) {
  return Human.buildProtocol({
    protocolId: 'synthetic-v2-protocol-' + suffix,
    generatedAt: '2026-08-19T06:05:00.000Z',
    fixtureMode: 'SYNTHETIC',
    claim: {
      id: 'fixture-v2-human-benefit-' + suffix,
      statement: 'The evaluated surface helps the named fixture steward make fewer unsupported continuation decisions.',
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: 'Synthetic scope placeholder for one named local steward; no real person participated.'
    },
    conditions: [
      {
        id: 'a', role: 'BASELINE', label: 'Condition A',
        artifactRef: Human.reference({ surface: 'baseline', capabilityId: cycle.capabilityId }, { id: 'fixture-v2-human-baseline-' + suffix, schema: 'axm.comparison-surface/v1' })
      },
      {
        id: 'b', role: 'CANDIDATE', label: 'Condition B',
        artifactRef: Human.reference({ surface: 'evaluated', capabilityId: cycle.capabilityId }, { id: 'fixture-v2-human-candidate-' + suffix, schema: 'axm.comparison-surface/v1' })
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

function evidenceFor(protocol, suffix) {
  const session = Human.buildSession(protocol, {
    sessionId: 'synthetic-v2-session-' + suffix,
    generatedAt: '2026-08-19T06:12:00.000Z',
    fixtureMode: 'SYNTHETIC',
    startedAt: '2026-08-19T06:06:00.000Z',
    completedAt: '2026-08-19T06:11:00.000Z',
    participantRef: Human.sha256('fixture-v2-seat-' + suffix),
    consent: {
      mode: 'VOLUNTARY_OPT_IN', grantedAt: '2026-08-19T06:05:30.000Z', completionConfirmedAt: '2026-08-19T06:10:30.000Z',
      withdrawnAt: null, useScope: 'LOCAL_BENEFIT_EVALUATION_ONLY', retentionAccepted: 'STRUCTURED_NO_FREE_TEXT'
    },
    observations: [
      { trialId: suffix + '-t1', decision: 'CONTINUE', confidence: 2, confusion: 'SOME', elapsedMs: 5000 },
      { trialId: suffix + '-t2', decision: 'HOLD', confidence: 5, confusion: 'NONE', elapsedMs: 1000 },
      { trialId: suffix + '-t3', decision: 'UNSURE', confidence: 2, confusion: 'SOME', elapsedMs: 5000 },
      { trialId: suffix + '-t4', decision: 'CONTINUE', confidence: 5, confusion: 'NONE', elapsedMs: 1000 }
    ],
    participantJudgment: { effect: 'HELPED', burden: 'LOW', confidence: 5 }
  });
  const evaluation = Human.buildEvaluation(protocol, [session], {
    evaluationId: 'synthetic-v2-evaluation-' + suffix,
    generatedAt: '2026-08-19T06:13:00.000Z'
  });
  const judgment = Human.buildJudgment(evaluation, {
    judgmentId: 'synthetic-v2-judgment-' + suffix,
    recordedAt: '2026-08-19T06:14:00.000Z',
    fixtureMode: 'SYNTHETIC',
    sourceMode: 'SYNTHETIC_FIXTURE',
    judgeRef: Human.sha256('fixture-v2-judge-' + suffix),
    attestation: Human.SYNTHETIC_ATTESTATION,
    decision: 'PASS',
    rationaleCodes: ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT', 'SCOPE_LIMITED']
  });
  return { evaluation, judgment };
}

function buildInput(mode) {
  const suffix = mode === 'reuse' ? 'reuse' : 'candidate';
  const cycle = mode === 'reuse' ? reuseCycle() : candidateCycle();
  const protocol = protocolFor(cycle, suffix);
  const { evaluation, judgment } = evidenceFor(protocol, suffix);
  const interventionLink = Bridge.buildInterventionLink({
    linkId: 'fixture-v2-link-' + suffix,
    generatedAt: '2026-08-19T06:15:00.000Z',
    cycleReceipt: cycle,
    protocol
  });
  const trustRef = Human.reference(
    { fixture: 'named-local-steward-declaration', suffix },
    { id: 'fixture-v2-source-trust-' + suffix, schema: 'axm.local-steward-source-declaration/v1' }
  );
  const baselineRef = protocol.conditions.find((item) => item.role === 'BASELINE').artifactRef;
  const evaluatedCandidateRef = protocol.conditions.find((item) => item.role === 'CANDIDATE').artifactRef;
  const closureSources = [
    { id: cycle.cycleId, schema: cycle.schema, sha256: cycle.receiptDigest },
    { id: protocol.protocolId, schema: protocol.schema, sha256: protocol.protocolDigest },
    { id: evaluation.evaluationId, schema: evaluation.schema, sha256: evaluation.evaluationDigest },
    { id: judgment.judgmentId, schema: judgment.schema, sha256: judgment.judgmentDigest },
    { id: interventionLink.linkId, schema: interventionLink.schema, sha256: interventionLink.linkDigest },
    baselineRef,
    evaluatedCandidateRef,
    cycle.baseline.receiptRef,
    interventionLink.ancestry.capabilitySurfaceRef,
    trustRef
  ];
  return {
    bridgeId: 'synthetic-v2-bridge-' + suffix,
    outcomeId: 'synthetic-v2-outcome-' + suffix,
    generatedAt: '2026-08-19T06:17:00.000Z',
    cycleReceipt: cycle,
    evaluation,
    judgment,
    interventionLink,
    binding: {
      claimId: protocol.claim.id,
      capabilityId: cycle.capabilityId,
      targetScope: protocol.claim.targetScope,
      scopeStatement: protocol.claim.scopeStatement,
      sourceTrust: { mode: 'NAMED_LOCAL_STEWARD_DECLARATION', trustRef }
    },
    evidenceClosure: Bridge.buildClosure({
      closureId: 'fixture-v2-closure-' + suffix,
      state: 'CURRENT',
      checkedAt: '2026-08-19T06:16:00.000Z',
      sources: closureSources
    })
  };
}

const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-human-bridge-receipt.schema.json'), 'utf8'));
const bundleSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-human-bridge-bundle.schema.json'), 'utf8'));
const linkSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'capability-intervention-link.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
ok(receiptSchema.$id === Bridge.RECEIPT_SCHEMA, 'v2 bridge receipt schema identity matches the implementation');
ok(bundleSchema.$id === Bridge.BUNDLE_SCHEMA, 'v2 bridge bundle schema identity matches the implementation');
ok(linkSchema.$id === Bridge.INTERVENTION_LINK_SCHEMA, 'v2 intervention link schema identity matches the implementation');
ok(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'v2 module stays TEST with no permissions or writes');
ok(contract.boundaries.refuses.includes('invented-candidate-for-reuse-existing'), 'contract explicitly refuses invented candidate ancestry');
ok(contract.boundaries.refuses.includes('synthetic-fixture-as-human-benefit'), 'contract explicitly refuses synthetic fixtures as human benefit');
ok(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
ok(Bridge.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
assert.throws(() => Bridge.stableStringify({ lost: undefined }), /unsupported undefined/i);
checks += 1;
console.log('PASS unsafe canonical state is refused');

const candidateInput = buildInput('candidate');
const reuseInput = buildInput('reuse');
const candidateAncestry = Bridge.resolveAncestry(candidateInput.cycleReceipt);
const reuseAncestry = Bridge.resolveAncestry(reuseInput.cycleReceipt);
ok(candidateAncestry.valid && candidateAncestry.mode === 'CANDIDATE', 'candidate cycle resolves to exact candidate ancestry');
ok(reuseAncestry.valid && reuseAncestry.mode === 'REUSE_EXISTING', 'no-gap reuse cycle resolves to exact existing-capability ancestry');
ok(candidateAncestry.relation !== reuseAncestry.relation, 'candidate and reuse relations remain semantically distinct');
ok(candidateInput.cycleReceipt.candidate !== null && candidateInput.cycleReceipt.gap.existingCapabilityRef === null, 'candidate fixture carries no reused capability reference');
ok(reuseInput.cycleReceipt.candidate === null && reuseInput.cycleReceipt.gap.existingCapabilityRef !== null, 'reuse fixture carries no invented candidate');

ok(Bridge.verifyInterventionLink(candidateInput.interventionLink, candidateInput.cycleReceipt, candidateInput.evaluation.protocol).pass, 'candidate intervention link verifies natively');
ok(Bridge.verifyInterventionLink(reuseInput.interventionLink, reuseInput.cycleReceipt, reuseInput.evaluation.protocol).pass, 'reuse-existing intervention link verifies natively');
ok(candidateInput.interventionLink.truth.ancestryModeCallerSelected === false, 'candidate link ancestry is derived rather than caller-selected');
ok(reuseInput.interventionLink.truth.candidateInventedForReuse === false, 'reuse link records that no candidate was invented');
ok(Bridge.stableStringify(reuseInput.interventionLink) === Bridge.stableStringify(Bridge.buildInterventionLink({
  linkId: reuseInput.interventionLink.linkId,
  generatedAt: reuseInput.interventionLink.generatedAt,
  cycleReceipt: reuseInput.cycleReceipt,
  protocol: reuseInput.evaluation.protocol
})), 'reuse intervention link build is deterministic');

const candidateBundle = Bridge.build(candidateInput);
const reuseBundle = Bridge.build(reuseInput);
ok(candidateBundle.bridgeReceipt.nativeVerification.interventionLink === 'PASS', 'candidate bundle re-verifies its intervention link');
ok(reuseBundle.bridgeReceipt.nativeVerification.interventionLink === 'PASS', 'reuse bundle re-verifies its intervention link');
ok(candidateBundle.bridgeReceipt.capabilityAncestry.mode === 'CANDIDATE', 'candidate bundle preserves candidate ancestry mode');
ok(reuseBundle.bridgeReceipt.capabilityAncestry.mode === 'REUSE_EXISTING', 'reuse bundle preserves reuse-existing ancestry mode');
ok(reuseBundle.groundedOutcome.interventionRef.sha256 === reuseInput.cycleReceipt.gap.existingCapabilityRef.sha256, 'Grounded outcome receives the exact reused capability surface');
ok(candidateBundle.groundedOutcome.interventionRef.sha256 === candidateInput.cycleReceipt.candidate.artifactRef.sha256, 'Grounded outcome receives the exact candidate capability surface');
ok(candidateBundle.bridgeReceipt.admission.state === 'SYNTHETIC_HOLD' && reuseBundle.bridgeReceipt.admission.state === 'SYNTHETIC_HOLD', 'both ancestry modes keep synthetic fixtures on hold');
ok(candidateBundle.bridgeReceipt.admission.mappedDecision === 'UNKNOWN' && reuseBundle.bridgeReceipt.admission.mappedDecision === 'UNKNOWN', 'synthetic PASS maps to UNKNOWN for both ancestry modes');
ok(!reuseBundle.bridgeReceipt.admission.reasonCodes.some((reason) => reason.includes('ANCESTRY') || reason === 'INVALID_INTERVENTION_LINK'), 'valid reuse ancestry introduces no ancestry or link hold reason');
ok(reuseBundle.groundedOutcome.claims[0].admittedVerdict === 'UNKNOWN', 'reuse contract fixture cannot become human benefit');
ok(Bridge.verify(candidateBundle, { evaluation: candidateInput.evaluation, judgment: candidateInput.judgment }).pass, 'candidate bundle verifies against exact native sources');
ok(Bridge.verify(reuseBundle, { evaluation: reuseInput.evaluation, judgment: reuseInput.judgment }).pass, 'reuse bundle verifies against exact native sources');

const tamperedModeInput = buildInput('reuse');
tamperedModeInput.interventionLink.ancestry.mode = 'CANDIDATE';
const tamperedModeBundle = Bridge.build(tamperedModeInput);
ok(tamperedModeBundle.bridgeReceipt.nativeVerification.interventionLink === 'FAIL', 'caller cannot relabel reuse ancestry as candidate');
ok(tamperedModeBundle.bridgeReceipt.admission.reasonCodes.includes('INVALID_INTERVENTION_LINK'), 'tampered ancestry mode is held explicitly');

const swappedSurfaceInput = buildInput('reuse');
swappedSurfaceInput.interventionLink.ancestry.capabilitySurfaceRef = Loop.reference(
  { unrelated: true }, { id: 'unrelated-reused-capability', schema: 'text/javascript' }
);
swappedSurfaceInput.interventionLink.linkDigest = Bridge.sha256((() => {
  const payload = JSON.parse(JSON.stringify(swappedSurfaceInput.interventionLink));
  delete payload.linkDigest;
  return payload;
})());
const swappedSurfaceBundle = Bridge.build(swappedSurfaceInput);
ok(swappedSurfaceBundle.bridgeReceipt.nativeVerification.interventionLink === 'FAIL', 'unrelated capability surface cannot replace reused ancestry');
ok(swappedSurfaceBundle.bridgeReceipt.admission.mappedDecision === 'UNKNOWN', 'surface substitution cannot map a human verdict');

const crossCycleInput = buildInput('reuse');
crossCycleInput.interventionLink = candidateInput.interventionLink;
const crossCycleBundle = Bridge.build(crossCycleInput);
ok(crossCycleBundle.bridgeReceipt.nativeVerification.interventionLink === 'FAIL', 'candidate-cycle link cannot cross into a reused-capability cycle');

const ambiguousCandidate = candidateCycle().candidate;
const ambiguousCycle = Loop.build({
  cycleId: 'fixture-v2-ambiguous-cycle', capabilityId: 'fixture.ambiguous/v1', generatedAt: '2026-08-19T06:00:00.000Z',
  baseline: baseline('ambiguous'), need: need('ambiguous'),
  gap: {
    state: 'NO_GAP', reason: 'Ambiguous test fixture.',
    reportRef: Loop.reference({ ambiguous: true }, { id: 'fixture-v2-ambiguous-gap', schema: 'axm.capability-gap-report/v1' }),
    existingCapabilityRef: Loop.reference({ existing: true }, { id: 'fixture-v2-ambiguous-existing', schema: 'text/javascript' })
  },
  provenance: [], candidate: ambiguousCandidate, verification: null, decision: null, availability: null,
  refresh: { trigger: 'NEW_INFORMATION', checkedAt: '2026-08-19T06:00:00.000Z', due: false, reason: 'Ambiguity must be refused.' }
});
const ambiguousResolution = Bridge.resolveAncestry(ambiguousCycle);
ok(!ambiguousResolution.valid && ambiguousResolution.reasonCodes.includes('CAPABILITY_ANCESTRY_AMBIGUOUS'), 'cycle carrying candidate and existing references is ambiguous');
assert.throws(() => Bridge.buildInterventionLink({
  linkId: 'ambiguous-link', generatedAt: '2026-08-19T06:15:00.000Z',
  cycleReceipt: ambiguousCycle, protocol: protocolFor(ambiguousCycle, 'ambiguous')
}), /cycle ancestry is not linkable/);
checks += 1; console.log('PASS ambiguous ancestry cannot emit a native link');

const missingClosureInput = buildInput('reuse');
missingClosureInput.evidenceClosure = Bridge.buildClosure({
  ...missingClosureInput.evidenceClosure,
  sources: missingClosureInput.evidenceClosure.sources.filter((source) => source.sha256 !== missingClosureInput.interventionLink.linkDigest)
});
const missingClosureBundle = Bridge.build(missingClosureInput);
ok(missingClosureBundle.bridgeReceipt.admission.state === 'EVIDENCE_HOLD', 'closure missing the intervention link holds reuse mapping');
ok(missingClosureBundle.bridgeReceipt.admission.reasonCodes.includes('EVIDENCE_CLOSURE_INCOMPLETE'), 'missing link closure is named explicitly');

const trustMismatchInput = buildInput('reuse');
trustMismatchInput.binding.sourceTrust.trustRef.schema = 'application/octet-stream';
trustMismatchInput.evidenceClosure = Bridge.buildClosure({
  ...trustMismatchInput.evidenceClosure,
  sources: trustMismatchInput.evidenceClosure.sources.map((source) => source.id === trustMismatchInput.binding.sourceTrust.trustRef.id
    ? trustMismatchInput.binding.sourceTrust.trustRef
    : source)
});
const trustMismatchBundle = Bridge.build(trustMismatchInput);
ok(trustMismatchBundle.bridgeReceipt.admission.reasonCodes.includes('SOURCE_TRUST_SCHEMA_MISMATCH'), 'reuse ancestry does not weaken source-trust schema binding');

const forgedLiveInput = buildInput('reuse');
forgedLiveInput.evaluation.fixtureMode = 'LIVE';
forgedLiveInput.evaluation.protocol.fixtureMode = 'LIVE';
forgedLiveInput.judgment.fixtureMode = 'LIVE';
forgedLiveInput.judgment.sourceMode = 'HUMAN_ENTERED';
forgedLiveInput.judgment.attestation = Human.LIVE_ATTESTATION;
forgedLiveInput.judgment.usableAsHumanEvidence = true;
forgedLiveInput.judgment.truth.declaredHumanJudgment = true;
const forgedLiveBundle = Bridge.build(forgedLiveInput);
ok(forgedLiveBundle.bridgeReceipt.nativeVerification.evaluation === 'FAIL' && forgedLiveBundle.bridgeReceipt.nativeVerification.judgment === 'FAIL', 'changing synthetic labels cannot forge a native LIVE reuse receipt');
ok(forgedLiveBundle.bridgeReceipt.admission.state === 'NATIVE_OR_BINDING_HOLD', 'forged LIVE reuse labels remain held');

const tamperedBundle = JSON.parse(JSON.stringify(reuseBundle));
tamperedBundle.bridgeReceipt.capabilityAncestry.mode = 'CANDIDATE';
ok(!Bridge.verify(tamperedBundle, { evaluation: reuseInput.evaluation, judgment: reuseInput.judgment }).pass, 'bundle ancestry tampering breaks exact rebuild verification');
ok(!Bridge.verify(reuseBundle, {}).pass, 'bundle verification refuses missing native evaluation and judgment');
ok(reuseBundle.bridgeReceipt.truth.candidateInventedForReuse === false, 'bridge receipt explicitly refuses candidate invention');
ok(reuseBundle.bridgeReceipt.truth.automaticPromotion === false && reuseBundle.bridgeReceipt.truth.automaticCanon === false && reuseBundle.bridgeReceipt.truth.automaticRootMutation === false, 'v2 bridge carries no promotion, CANON, or root authority');
ok(reuseBundle.bridgeReceipt.truth.sourceAuthenticationPerformedByModule === false, 'v2 bridge does not claim human source authentication');

console.log('\nGrounded Growth Human Bridge v2 selftest: PASS (' + checks + ' checks)');
