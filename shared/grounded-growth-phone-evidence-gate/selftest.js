#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Gate = require('./grounded-growth-phone-evidence-gate');
const Campaign = require('../voluntary-phone-qa-campaign/voluntary-phone-qa-campaign');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Human = require('../human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Handoff = require('../grounded-growth-human-handoff/grounded-growth-human-handoff');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-phone-evidence-gate.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(schema.$id === Gate.RECEIPT_SCHEMA, 'schema identity matches the implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'contract stays TEST with no permissions or writes');
check([
  'device-behavior-as-human-usefulness',
  'candidate-review-as-warning-closure',
  'warning-closure-as-human-benefit',
  'automatic-participation',
  'automatic-promotion',
  'automatic-canon',
  'foundation-mutation'
].every((item) => contract.boundaries.refuses.includes(item)), 'contract records the two-key and authority boundaries');
check(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
check(Gate.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
assert.throws(() => Gate.stableStringify({ lost: undefined }), /unsupported undefined/i);
checks += 1;
console.log('PASS unsafe canonical state is refused');

const seamAt = '2026-08-19T10:00:00.000Z';
const capturedAt = '2026-08-19T10:04:00.000Z';
const reviewedAt = '2026-08-19T10:05:00.000Z';
const closedAt = '2026-08-19T10:06:00.000Z';
const generatedAt = '2026-08-19T10:09:00.000Z';
const gameId = '002-robo-pong';
const slot = '002';
const capabilityId = 'game.002-robo-pong.physical-phone-controller-experience';
const humanClaimId = '002-robo-pong-phone-experience-usefulness';
const scopeStatement = 'The named local steward using the exact AXM Pong phone-controller surface.';

function seamReport(warning, checkedAt = seamAt) {
  return {
    schema: 'axm.game-package-verification/v1',
    scope: 'fixture-only-path-not-retained-by-gate',
    checkedAt,
    games: [{ game: gameId, slot, manifest: 'fixture-manifest-path', errors: [], warnings: warning ? [Campaign.PHONE_WARNING] : [] }],
    pass: true,
    failCount: 0,
    warningCount: warning ? 1 : 0
  };
}

const qaManifest = {
  id: 'browser-lan-hardware-qa-lab',
  version: 'v0.3',
  status: 'TEST',
  entry: 'index.html',
  contract: 'module.contract.json',
  permissions: ['qa.run'],
  produces: ['axm.device-qa-evidence/v1'],
  actions: ['record physical-phone observation candidates']
};
const qaContract = {
  schema: 'axm.module-contract/v1',
  id: qaManifest.id,
  version: qaManifest.version,
  permissions: ['qa.run'],
  boundaries: {
    writes: ['state/browser-lan-hardware-qa', 'state/review-inbox'],
    refuses: ['self-attested-physical-proof', 'manifest-warning-mutation']
  }
};
const manifest = {
  game_id: gameId,
  name: 'AXM Pong: Duet',
  status: 'WORKING TEST',
  version: '2.0.0-test',
  slot,
  controls: { phone_controller: true, touch: true },
  verification: {
    game_night: {
      schema: 'axm.game-night-seams/v1',
      physical_phone_qa: 'pending'
    }
  }
};
const verifiedManifest = JSON.parse(JSON.stringify(manifest));
verifiedManifest.verification.game_night.physical_phone_qa = 'verified';
verifiedManifest.verification.game_night.physical_phone_qa_scope = 'Fixture separate-phone join, action, disconnect, and recovery observations.';
verifiedManifest.verification.game_night.physical_phone_qa_evidence = ['evidence/fixture-phone-observation.json'];
const binding = {
  capabilityId,
  humanClaimId,
  targetScope: 'NAMED_LOCAL_STEWARD',
  scopeStatement
};

function deviceEvidence(complete = true) {
  const values = Object.fromEntries(Gate.OBSERVATION_KEYS.map((key) => [key, complete]));
  const receipt = {
    schema: 'axm.device-qa-evidence/v1',
    id: 'device-qa-fixture-002',
    capturedAt,
    actor: 'declared-local-user',
    userAgent: 'fixture-agent',
    viewport: { width: 390, height: 844, devicePixelRatio: 3 },
    accessibility: { reducedMotion: false, highContrast: false },
    gamepads: [],
    network: { samples: [12, 14], medianMs: 14, p95Ms: 14, disconnectObserved: complete, recoveredAfterDisconnect: complete },
    longSession: { durationMs: 120000, errors: [] },
    phoneObservation: {
      schema: 'axm.qa-phone-observation/v1',
      gameId,
      slot,
      observations: values,
      notes: 'Sensitive fixture note that must not enter the gate output.',
      complete,
      reviewState: 'CANDIDATE_REQUIRES_HUMAN_REVIEW',
      limitations: [
        'Checkboxes and notes are human declarations, not machine proof of physical hardware.',
        'This candidate does not alter a game manifest or clear a verifier warning.',
        'Mike Tobi or an explicitly authorized external steward must review the observed device and game behavior.'
      ]
    },
    truth: {
      hardwareEnumeratedByBrowser: true,
      rawInputStored: false,
      automaticPermissionChange: false,
      physicalHardwareProven: false,
      manifestMutated: false,
      externalReviewRequired: true
    }
  };
  receipt.digest = crypto.createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
  return receipt;
}

function campaign(candidate, decision) {
  return Campaign.buildCampaign({
    campaignId: 'phone-campaign-fixture',
    generatedAt: '2026-08-19T10:01:00.000Z',
    seamReport: seamReport(true),
    qaLabManifest: qaManifest,
    qaLabContract: qaContract,
    maxGamesPerSession: 1,
    candidateReviews: candidate && decision ? [{
      gameId,
      candidateDigest: candidate.digest,
      decision,
      reviewedAt,
      voluntaryHumanReview: true
    }] : []
  });
}

function availableCycle(gameSurfaceRef) {
  const verificationRef = Loop.reference({ checks: 4, result: 'PASS' }, { id: 'phone-capability-verification', schema: 'axm.focused-test-receipt/v1' });
  return Loop.build({
    cycleId: 'cycle-phone-experience-fixture',
    capabilityId,
    generatedAt: seamAt,
    baseline: {
      kind: 'git-and-worktree',
      identity: 'bounded phone-experience selftest fixture',
      receiptRef: Loop.reference({ baseline: 'fixture' }, { id: 'baseline', schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'need-phone-experience',
      statement: 'Phone controller behavior and human usefulness must remain separate evidence claims.',
      sourceRef: Loop.reference({ need: 'phone experience' }, { id: 'need', schema: 'axm.workshop-need/v1' })
    },
    gap: {
      state: 'OPEN',
      reason: 'No two-key evidence gate existed.',
      reportRef: Loop.reference({ missing: 'two-key gate' }, { id: 'gap', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ source: 'selftest' }, { id: 'provenance', schema: 'axm.source-provenance/v1' })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: gameSurfaceRef,
      sourceMutationPerformed: false, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: gameSurfaceRef.sha256, receiptRef: verificationRef,
      evidenceAuthority: 'MIXED', limitations: ['Fixture capability ancestry proves routing only.']
    },
    decision: {
      verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'fixture-steward', candidateDigest: gameSurfaceRef.sha256,
      confirmation: 'CONTINUE VERIFIED CAPABILITY',
      decisionRef: Loop.reference({ verdict: 'CONTINUE', digest: gameSurfaceRef.sha256 }, { id: 'decision', schema: 'axm.review-decision/v1' })
    },
    availability: {
      status: 'AVAILABLE', candidateDigest: gameSurfaceRef.sha256, authorityId: 'fixture-availability',
      receiptRef: Loop.reference({ available: gameSurfaceRef.sha256 }, { id: 'availability', schema: 'axm.module-availability-receipt/v1' })
    },
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: seamAt, due: false, reason: 'Fixture evidence is current.' }
  });
}

function liveHandoff(verdict = 'PASS', surfaceManifest = manifest) {
  const suffix = verdict.toLowerCase();
  const gameSurfaceRef = Human.reference(surfaceManifest, { id: gameId, schema: 'axm.game-manifest-surface/v1' });
  const cycle = availableCycle(gameSurfaceRef);
  const protocol = Human.buildProtocol({
    protocolId: 'phone-human-protocol-fixture-' + suffix,
    generatedAt: '2026-08-19T10:01:00.000Z',
    fixtureMode: 'LIVE',
    claim: {
      id: humanClaimId,
      statement: 'The exact phone-controller experience helps the named local steward use the game as intended.',
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement
    },
    conditions: [
      {
        id: 'a', role: 'BASELINE', label: 'Condition A',
        artifactRef: Human.reference({ surface: 'baseline controller experience' }, { id: 'phone-experience-baseline', schema: 'axm.test-surface/v1' })
      },
      { id: 'b', role: 'CANDIDATE', label: 'Condition B', artifactRef: gameSurfaceRef }
    ],
    trials: [
      { id: suffix + '-t1', caseId: suffix + '-c1', conditionId: 'a', order: 1, prompt: 'Baseline hold case.', expectedDecision: 'HOLD' },
      { id: suffix + '-t2', caseId: suffix + '-c2', conditionId: 'b', order: 2, prompt: 'Candidate hold case.', expectedDecision: 'HOLD' },
      { id: suffix + '-t3', caseId: suffix + '-c3', conditionId: 'a', order: 3, prompt: 'Baseline continue case.', expectedDecision: 'CONTINUE' },
      { id: suffix + '-t4', caseId: suffix + '-c4', conditionId: 'b', order: 4, prompt: 'Candidate continue case.', expectedDecision: 'CONTINUE' }
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
  const session = Human.buildSession(protocol, {
    sessionId: 'phone-human-session-fixture-' + suffix,
    generatedAt: '2026-08-19T10:05:30.000Z',
    fixtureMode: 'LIVE',
    startedAt: '2026-08-19T10:02:00.000Z',
    completedAt: '2026-08-19T10:05:00.000Z',
    participantRef: Human.sha256('declared-phone-participant-fixture-' + suffix),
    consent: {
      mode: 'VOLUNTARY_OPT_IN',
      grantedAt: '2026-08-19T10:01:30.000Z',
      completionConfirmedAt: '2026-08-19T10:04:50.000Z',
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
  const evaluation = Handoff.prepareEvaluation({
    cycleReceipt: cycle,
    protocol,
    sessions: [session],
    evaluationId: 'phone-human-evaluation-fixture-' + suffix,
    generatedAt: '2026-08-19T10:06:00.000Z'
  });
  const judgment = Human.buildJudgment(evaluation, {
    judgmentId: 'phone-human-judgment-fixture-' + suffix,
    recordedAt: '2026-08-19T10:06:30.000Z',
    fixtureMode: 'LIVE',
    sourceMode: 'HUMAN_ENTERED',
    judgeRef: Human.sha256('declared-phone-judge-fixture-' + suffix),
    attestation: Human.LIVE_ATTESTATION,
    decision: verdict,
    rationaleCodes: verdict === 'PASS'
      ? ['OBJECTIVE_AND_EXPERIENTIAL_BENEFIT', 'SCOPE_LIMITED']
      : ['HARM_OR_BURDEN', 'SCOPE_LIMITED']
  });
  const sourceDeclaration = Handoff.buildSourceDeclaration({
    declarationId: 'phone-human-source-declaration-fixture-' + suffix,
    declaredAt: '2026-08-19T10:07:00.000Z',
    declarationMode: Handoff.LIVE_DECLARATION_MODE,
    attestation: Handoff.LIVE_SOURCE_ATTESTATION,
    evaluation,
    judgment
  });
  const interventionLink = Bridge.buildInterventionLink({
    linkId: 'phone-human-link-fixture-' + suffix,
    generatedAt: '2026-08-19T10:07:10.000Z',
    cycleReceipt: cycle,
    protocol
  });
  return Handoff.buildPackage({
    handoffId: 'phone-human-handoff-fixture-' + suffix,
    generatedAt: '2026-08-19T10:08:00.000Z',
    closureId: 'phone-human-closure-fixture-' + suffix,
    closureState: 'CURRENT',
    closureCheckedAt: '2026-08-19T10:07:30.000Z',
    bridgeId: 'phone-human-bridge-fixture-' + suffix,
    outcomeId: 'phone-human-outcome-fixture-' + suffix,
    cycleReceipt: cycle,
    evaluation,
    judgment,
    sourceDeclaration,
    interventionLink
  });
}

function input(extra) {
  return Object.assign({
    gateId: 'phone-evidence-gate-fixture',
    generatedAt,
    campaign: campaign(null, null),
    gameManifest: manifest,
    deviceEvidence: null,
    closureReport: null,
    binding,
    humanHandoff: null
  }, extra || {});
}

const pending = Gate.build(input());
check(pending.overall === 'WAITING_FOR_VOLUNTARY_PHONE_OBSERVATION', 'current empty route waits for voluntary phone observation');
check(!pending.keys.deviceBehavior.passed && !pending.keys.humanUsefulness.passed, 'neither evidence key passes without source evidence');
check(pending.truth.humanUsefulnessEstablished === false && pending.truth.deviceBehaviorVerified === false, 'empty route preserves both unknown claims');
check(Gate.verify(pending, input()).pass, 'fresh pending receipt verifies deterministically');

const device = deviceEvidence(true);
const unreviewedInput = input({ deviceEvidence: device });
const unreviewed = Gate.build(unreviewedInput);
check(unreviewed.overall === 'WAITING_FOR_CANDIDATE_REVIEW', 'complete device candidate still waits for explicit review');
check(unreviewed.keys.deviceBehavior.state === 'DEVICE_CANDIDATE_REVIEW_REQUIRED', 'candidate capture is not device verification');

const acceptedCampaign = campaign(device, 'ACCEPT_FOR_SEPARATE_GAME_REVIEW');
const acceptedInput = input({ campaign: acceptedCampaign, deviceEvidence: device });
const accepted = Gate.build(acceptedInput);
check(accepted.overall === 'WAITING_FOR_MANIFEST_EVIDENCE_GATE', 'accepted candidate leaves the manifest warning gate open');
check(accepted.keys.deviceBehavior.state === 'DEVICE_REVIEW_ACCEPTED_WARNING_OPEN', 'review acceptance is not warning closure');

const closedInput = input({ campaign: acceptedCampaign, gameManifest: verifiedManifest, deviceEvidence: device, closureReport: seamReport(false, closedAt) });
const closed = Gate.build(closedInput);
check(closed.overall === 'WAITING_FOR_HUMAN_USEFULNESS', 'warning-free verifier evidence completes only the device key');
check(closed.keys.deviceBehavior.passed && !closed.keys.humanUsefulness.passed, 'device proof does not imply human usefulness');
check(closed.truth.deviceBehaviorVerified && !closed.truth.combinedEvidencePresent, 'technical closure remains a partial result');

const humanPass = liveHandoff('PASS');
check(Handoff.verifyPackage(humanPass).pass && humanPass.state === 'ADMITTED', 'live handoff fixture verifies natively and is admitted');
const humanBeforeDevice = Gate.build(input({ humanHandoff: humanPass }));
check(humanBeforeDevice.overall === 'HUMAN_PASS_DEVICE_EVIDENCE_INCOMPLETE', 'a human PASS cannot erase missing device evidence');
check(humanBeforeDevice.keys.humanUsefulness.passed && !humanBeforeDevice.keys.deviceBehavior.passed, 'human and device keys remain independently visible');

const verifiedHumanPass = liveHandoff('PASS', verifiedManifest);
const completeInput = input({ campaign: acceptedCampaign, gameManifest: verifiedManifest, deviceEvidence: device, closureReport: seamReport(false, closedAt), humanHandoff: verifiedHumanPass });
const complete = Gate.build(completeInput);
check(complete.overall === 'TWO_KEY_EVIDENCE_PRESENT', 'both independently verified keys produce the combined evidence state');
check(complete.truth.combinedEvidencePresent && complete.truth.humanUsefulnessEstablished, 'combined truth is set only with both keys');
check(complete.nextActions.includes('PRESENT_FOR_EXPLICIT_STEWARD_REVIEW_WITHOUT_AUTOMATIC_PROMOTION'), 'combined evidence still routes to explicit steward review');
check(!JSON.stringify(complete).includes('Sensitive fixture note') && !JSON.stringify(complete).includes('fixture-agent'), 'gate output excludes device notes and user agent');
check(Gate.verify(complete, completeInput).pass, 'fresh combined receipt verifies deterministically');

const humanFail = Gate.build(input({ campaign: acceptedCampaign, gameManifest: verifiedManifest, deviceEvidence: device, closureReport: seamReport(false, closedAt), humanHandoff: liveHandoff('FAIL', verifiedManifest) }));
check(humanFail.overall === 'HUMAN_OUTCOME_HOLD', 'an admitted human FAIL holds the combined route');
check(!humanFail.truth.combinedEvidencePresent, 'human FAIL never becomes combined growth evidence');

const rejected = Gate.build(input({ campaign: campaign(device, 'REJECT'), deviceEvidence: device }));
check(rejected.overall === 'OPTIONAL_RETRY_OR_STOP' && rejected.keys.deviceBehavior.state === 'DEVICE_CANDIDATE_REJECTED', 'rejected candidate preserves stop or optional retry');

assert.throws(() => Gate.build(input({ deviceEvidence: deviceEvidence(false) })), /six affirmative declarations/);
checks += 1; console.log('PASS incomplete phone declarations cannot enter the gate');

const wrongDevice = deviceEvidence(true);
wrongDevice.phoneObservation.gameId = '003-robo-pong-cross';
const wrongPayload = JSON.parse(JSON.stringify(wrongDevice));
delete wrongPayload.digest;
wrongDevice.digest = crypto.createHash('sha256').update(JSON.stringify(wrongPayload)).digest('hex');
assert.throws(() => Gate.build(input({ deviceEvidence: wrongDevice })), /different game/);
checks += 1; console.log('PASS cross-game device evidence is refused');

const mismatchedCampaign = campaign(device, 'ACCEPT_FOR_SEPARATE_GAME_REVIEW');
mismatchedCampaign.games[0].candidateDigest = 'sha256:' + 'f'.repeat(64);
const campaignPayload = JSON.parse(JSON.stringify(mismatchedCampaign));
delete campaignPayload.campaignDigest;
mismatchedCampaign.campaignDigest = Campaign.sha256(campaignPayload);
assert.throws(() => Gate.build(input({ campaign: mismatchedCampaign, deviceEvidence: device })), /does not match device evidence/);
checks += 1; console.log('PASS candidate review must bind the exact device receipt digest');

assert.throws(() => Gate.build(input({ campaign: acceptedCampaign, gameManifest: verifiedManifest, deviceEvidence: device, closureReport: seamReport(true, closedAt) })), /still carries/);
checks += 1; console.log('PASS a verifier report with the warning still open cannot close the device key');

assert.throws(() => Gate.build(input({ campaign: acceptedCampaign, gameManifest: verifiedManifest, deviceEvidence: device, closureReport: seamReport(false, '2026-08-19T10:03:00.000Z') })), /predates/);
checks += 1; console.log('PASS warning closure cannot predate the accepted candidate');

assert.throws(() => Gate.build(input({ campaign: acceptedCampaign, deviceEvidence: device, closureReport: seamReport(false, closedAt) })), /requires the verified game manifest/);
checks += 1; console.log('PASS warning-free report cannot close a stale pending manifest surface');

const wrongOutcome = JSON.parse(JSON.stringify(humanPass));
wrongOutcome.capabilityId = 'other-capability';
assert.throws(() => Gate.build(input({ humanHandoff: wrongOutcome })), /human handoff is invalid|capability binding mismatch/);
checks += 1; console.log('PASS tampered or cross-capability human outcomes are refused');

const tampered = JSON.parse(JSON.stringify(complete));
tampered.overall = 'WAITING_FOR_HUMAN_USEFULNESS';
check(!Gate.verify(tampered, completeInput).pass, 'tampered derived state fails receipt verification');
check(complete.truth.automaticPromotion === false && complete.truth.automaticCanon === false && complete.truth.foundationMutation === false, 'combined evidence grants no promotion, CANON, or Foundation authority');

console.log('\nGrounded Growth phone-evidence gate selftest: PASS (' + checks + ' checks)');
