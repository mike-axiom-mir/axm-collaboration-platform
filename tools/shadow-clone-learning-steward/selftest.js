#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('./lib/shadow-clone-learning-core');
const Adapter = require('./lib/periodic-compact-snapshot-adapter');
const Cli = require('./cli');
const ContractVerifier = require('../../hub/module-contract-verifier');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function noField(value, key) { const result = copy(value); delete result[key]; return result; }
function expects(code, fn) { assert.throws(fn, error => error && error.code === code, 'expected ' + code); }
function novelCycle(value) {
  const result = copy(value);
  result.collectionId = 'synthetic-compact-cycle-02';
  result.sourceDigests = ['0', '1', '2', '3'].map(item => item.repeat(64));
  result.snapshots.forEach((snapshot, index) => {
    snapshot.sourceDigest = result.sourceDigests[index];
    snapshot.observations.forEach((signal, signalIndex) => { signal.evidenceDigest = Core.digest({ kind: 'observation', index, signalIndex }); });
    snapshot.userFeedback.forEach((signal, signalIndex) => { signal.evidenceDigest = Core.digest({ kind: 'feedback', index, signalIndex }); });
    snapshot.verifications.forEach(item => { item.testReceiptDigest = snapshot.sourceDigest; });
  });
  return result;
}

(async () => {
  const root = __dirname;
  const manifest = readJson(path.join(root, 'manifest.json'));
  const contract = readJson(path.join(root, 'module.contract.json'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const input = readJson(path.join(root, 'fixtures', 'synthetic-compact-snapshot-set.example.json'));
  const valueTrial = readJson(path.join(root, 'fixtures', 'synthetic-value-trial.example.json'));
  let checks = 0;
  function ok(value, message) { assert.ok(value, message); checks += 1; }
  function equal(left, right, message) { assert.deepEqual(left, right, message); checks += 1; }

  equal(manifest.status, 'EXPERIMENTAL', 'status remains experimental');
  equal(manifest.kind, 'machine-capability', 'machine discovery kind');
  equal(manifest.audience, 'machine', 'machine audience');
  equal(manifest.permissions, [], 'no module permission grant');
  equal(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] }, 'valid contract');
  ok(contract.boundaries.refuses.includes('model-weight-training'), 'weight training refused');
  ok(contract.boundaries.refuses.includes('automatic-inheritance'), 'automatic inheritance refused');
  ok(contract.boundaries.refuses.includes('automatic-review-decision'), 'automatic Mike review decision refused');
  ok(contract.boundaries.refuses.includes('evaluator-score-averaging'), 'evaluator disagreement averaging refused');
  ok(/<html\b[^>]*\blang=/i.test(html) && /name=["']viewport["']/i.test(html), 'inspectable HTML');
  ok(/:focus-visible/.test(fs.readFileSync(path.join(root, 'styles.css'), 'utf8')) && /min-height:44px/.test(fs.readFileSync(path.join(root, 'styles.css'), 'utf8')), 'focus and target size styles');

  const first = Core.compileSnapshotSet(input);
  const second = Core.compileSnapshotSet(input);
  equal(first.ledgerDigest, second.ledgerDigest, 'deterministic ledger digest');
  equal(first.state, 'PASS_BOUNDED_REPLAYABLE_LESSON', 'complete bounded route');
  equal(first.learningClaim.demonstrated, true, 'learning route requires verification');
  equal(first.learningClaim.storedTextAloneCountsAsLearning, false, 'stored text is not learning');
  equal(first.learningClaim.doubleValueProven, false, 'no 2x claim from lesson route');
  equal(first.observations.length, 5, 'observations remain distinct');
  equal(first.userFeedback.length, 1, 'user feedback remains distinct');
  const lesson = first.candidateLessons.find(item => item.lessonKey === 'anti-drift.frozen-source-check');
  equal(lesson.status, 'CANDIDATE', 'cross-instance lesson eligible');
  equal(lesson.confidence, 'HIGH', 'distinct source confidence');
  equal(lesson.verificationState, 'PASS_REPLAY_BOUND', 'verification bound');
  const contested = first.candidateLessons.find(item => item.lessonKey === 'coordination.direct-control');
  equal(contested.status, 'CONTESTED', 'disagreement preserved');
  ok(first.contradictions.some(item => item.kind === 'DIRECT_CONTRADICTION'), 'direct contradiction recorded');
  ok(first.contradictions.some(item => item.kind === 'INCOMPATIBLE_PATTERN'), 'incompatible pattern recorded');
  equal(first.proposedImprovements.length, 1, 'only eligible lesson proposed');
  equal(first.proposedImprovements[0].state, 'PROPOSED_NOT_APPLIED', 'proposal not applied');
  equal(first.inheritanceDecision.state, 'EXTERNAL_HUMAN_GATE_ONLY', 'inheritance external');
  equal(first.authority.modelWeightTraining, false, 'weights unchanged');
  equal(first.source.seenSourceDigests.length, 4, 'first cycle seals source digest history');
  equal(first.deduplication.duplicateSourceSnapshotsRemoved, 0, 'first cycle has no predecessor duplicates');
  equal(first.lessonVersions.length, first.lessons.length, 'first cycle seeds one immutable version per current lesson');

  const pickupRequest = {
    schema: Core.PICKUP_REQUEST_SCHEMA,
    requestId: 'synthetic-pickup-request',
    consumerAlias: 'connected-ai-alpha',
    baseContextDigest: '0'.repeat(64),
    asOf: input.asOf,
    lessonKeys: ['anti-drift.frozen-source-check'],
    includeDissent: true,
    candidateMode: 'VERIFIED_ONLY',
    authority: { explicitSelection: true, automaticPromptRewrite: false, automaticInheritance: false }
  };
  const pickup = Core.createPickup(first, pickupRequest);
  equal(pickup.cloneProfile.kind, 'EPHEMERAL_EVIDENCE_PROFILE_NOT_IDENTITY', 'pickup is evidence profile');
  equal(pickup.cloneProfile.lessons.length, 1, 'one explicit lesson selected');
  equal(pickup.cloneProfile.dissent.length, 1, 'dissent travels with pickup');
  equal(pickup.adoption.automaticPromptRewrite, false, 'no prompt rewrite');
  equal(Core.digest(noField(pickup, 'pickupDigest')), pickup.pickupDigest, 'pickup digest valid');

  const mirror = Core.createMirrorProposal(first, {
    schema: Core.MIRROR_REQUEST_SCHEMA,
    requestId: 'synthetic-mirror-request',
    lessonKey: 'anti-drift.frozen-source-check',
    reviewerAlias: 'reviewer-alpha',
    asOf: input.asOf,
    target: 'MIRROR_PRIVATE_ACTION_LESSON_INTAKE',
    explicitReview: true
  });
  equal(mirror.state, 'REVIEW_REQUIRED', 'Mirror proposal needs review');
  equal(mirror.trainingMeaning, 'PRIVATE_LESSON_PROPOSAL_NOT_MODEL_WEIGHT_TRAINING', 'training meaning bounded');
  equal(mirror.authority.modelWeightsChanged, false, 'Mirror weights unchanged');
  equal(Core.digest(noField(mirror, 'proposalDigest')), mirror.proposalDigest, 'Mirror proposal digest valid');
  expects('LESSON_NOT_VERIFIED', () => Core.createMirrorProposal(first, { schema: Core.MIRROR_REQUEST_SCHEMA, requestId: 'bad-mirror-request', lessonKey: 'coordination.direct-control', reviewerAlias: 'reviewer-alpha', asOf: input.asOf, target: 'MIRROR_PRIVATE_ACTION_LESSON_INTAKE', explicitReview: true })); checks += 1;

  const garden = {
    schema: Core.GRAND_GARDEN_LEDGER_SCHEMA,
    ledgerDigest: null,
    ledgerId: 'synthetic-grand-garden-ledger',
    status: 'EXPERIMENTAL',
    state: 'SECOND_VALUE_ROUTE_FOR_ALL_ACTIVE_INSTANCES',
    asOf: input.asOf,
    authorization: copy(input.authorization),
    retention: copy(input.retention),
    limits: copy(input.limits),
    cycleHistory: [{ cycleId: 'synthetic-garden-cycle' }],
    activeSet: { taskAliases: ['build-alpha', 'steward-beta'], missingTaskAliases: [], reusedTaskAliases: ['build-alpha', 'steward-beta'] },
    contributionReceipts: [],
    lessons: [
      { lessonKey: 'garden.adapter-over-duplication', currentState: 'CANDIDATE', currentConfidenceLabels: ['MEDIUM'], patternVariants: [{ pattern: 'Prefer a small adapter over copying an existing evidence organ.', consumer: 'GENERIC' }], sourceTaskAliases: ['build-alpha', 'steward-beta'], candidateDigests: ['1'.repeat(64)], proposalDigests: ['2'.repeat(64)], verificationReceiptDigests: [], contradictionDigests: [], refreshRequiredAt: '2026-08-29T12:00:00.000Z' },
      { lessonKey: 'garden.claim-timing', currentState: 'CONTESTED', currentConfidenceLabels: ['LOW'], patternVariants: [{ pattern: 'Delay broad claims until detached evidence exists.', consumer: 'GENERIC' }], sourceTaskAliases: ['build-alpha', 'steward-beta'], candidateDigests: ['3'.repeat(64)], proposalDigests: [], verificationReceiptDigests: [], contradictionDigests: ['4'.repeat(64)], refreshRequiredAt: '2026-08-29T12:00:00.000Z' }
    ],
    signalDigestsSeen: [],
    valueAmplification: { duplicateSignalsSkipped: 0, doubleComputeOutcomeProven: false },
    authority: { providerExecution: 'INERT', taskHistoryRead: false, crossTaskMessaging: false, permissionEscalation: false, parentWrites: 0, canonicalWrites: 0, automaticIntegration: false, canon: false },
    boundary: 'Synthetic compact Garden fixture only.'
  };
  garden.ledgerDigest = Core.digest(noField(garden, 'ledgerDigest'));
  const importedGarden = Core.adaptGrandGardenLedger(garden);
  equal(importedGarden.compatibility.sourceDigestVerified, true, 'Garden compact ledger digest verified');
  equal(importedGarden.compatibility.runtimeDependencyOnGarden, false, 'Garden import has no runtime worktree dependency');
  equal(importedGarden.state, 'IMPORTED_CANDIDATES_AWAIT_WORKSHOP_VERIFICATION', 'Garden candidates remain held');
  equal(importedGarden.lessonVersions, importedGarden.lessons, 'Garden import seeds immutable lesson versions');
  const gardenPickup = Core.createPickup(importedGarden, Object.assign({}, pickupRequest, { requestId: 'garden-candidate-pickup', lessonKeys: ['garden.adapter-over-duplication'], candidateMode: 'INCLUDE_UNVERIFIED_AS_HOLD' }));
  equal(gardenPickup.state, 'HOLD_CANDIDATES_AWAIT_VERIFICATION', 'unverified Garden pickup remains hold');
  equal(gardenPickup.cloneProfile.lessons.length, 0, 'unverified Garden lesson is not active');
  equal(gardenPickup.cloneProfile.candidateLessons[0].adoptionState, 'PROPOSAL_ONLY_DO_NOT_APPLY', 'Garden candidate is proposal-only');
  const alteredGarden = copy(garden); alteredGarden.lessons[0].patternVariants[0].pattern = 'Altered after sealing.';
  expects('GARDEN_LEDGER_DIGEST', () => Core.adaptGrandGardenLedger(alteredGarden)); checks += 1;

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-shadow-clone-'));
  const parent = path.join(temp, 'parent-sentinel.txt');
  const canonical = path.join(temp, 'canonical-sentinel.txt');
  fs.writeFileSync(parent, 'parent unchanged\n');
  fs.writeFileSync(canonical, 'canonical unchanged\n');
  const parentBefore = fs.readFileSync(parent, 'utf8');
  const canonicalBefore = fs.readFileSync(canonical, 'utf8');
  const runRoot = path.join(temp, 'learning-run');
  const run = Cli.runLearning(path.join(root, 'fixtures', 'synthetic-compact-snapshot-set.example.json'), runRoot);
  equal(run.ledger.ledgerDigest, first.ledgerDigest, 'CLI uses core ledger');
  const replay = Cli.replayLearning(runRoot, path.join(temp, 'learning-replay'));
  equal(replay.receipt.state, 'PASS_CLEAN_LEARNING_REPLAY', 'clean learning replay');
  equal(fs.readFileSync(parent, 'utf8'), parentBefore, 'parent sentinel unchanged');
  equal(fs.readFileSync(canonical, 'utf8'), canonicalBefore, 'canonical sentinel unchanged');
  expects('OUTPUT_BOUNDARY', () => Cli.replayLearning(runRoot, path.join(runRoot, 'nested'))); checks += 1;
  expects('OUTPUT_EXISTS', () => Cli.runLearning(path.join(root, 'fixtures', 'synthetic-compact-snapshot-set.example.json'), runRoot)); checks += 1;

  const assignmentLesson = first.lessons.find(item => item.lessonKey === 'anti-drift.frozen-source-check');
  const assignmentRequest = {
    schema: Core.TRIAL_ASSIGNMENT_REQUEST_SCHEMA,
    requestId: 'synthetic-heldout-assignment-hold',
    asOf: input.asOf,
    prospectivePlanDigest: '7'.repeat(64),
    lessonKey: assignmentLesson.lessonKey,
    candidateDigest: assignmentLesson.candidateDigest,
    reviewDecision: null,
    recipients: {
      baseline: { alias: 'future-baseline-seat', baseContextDigest: '8'.repeat(64), explicitRequest: false },
      learningRoute: { alias: 'future-learning-seat', baseContextDigest: '9'.repeat(64), explicitRequest: false }
    },
    rubric: copy(valueTrial.rubric),
    authority: { hostAuthenticatedMikeReview: false, automaticPresentation: false, crossTaskMessaging: false, automaticApplication: false, automaticInheritance: false }
  };
  const heldAssignment = Core.prepareTrialAssignment(first, assignmentRequest);
  equal(heldAssignment.state, 'HOLD_TRIAL_ASSIGNMENT', 'missing review and recipients produce typed trial hold');
  ok(heldAssignment.blockers.some(item => item.code === 'MISSING_SPECIFIC_MIKE_REVIEW'), 'trial hold names missing specific Mike review');
  ok(heldAssignment.blockers.some(item => item.code === 'MISSING_AUTHENTICATED_REVIEW_PROVIDER'), 'trial hold names missing authenticated review provider');
  ok(heldAssignment.blockers.some(item => item.code === 'MISSING_BASELINE_RECIPIENT_REQUEST') && heldAssignment.blockers.some(item => item.code === 'MISSING_LEARNING_RECIPIENT_REQUEST'), 'trial hold names both missing recipient requests');
  equal(heldAssignment.candidate.pattern, null, 'held assignment does not reveal lesson pattern');
  equal(heldAssignment.trialCaseTemplate, null, 'held assignment creates no trial case');
  equal(heldAssignment.adoption.presented, false, 'held assignment does not present a lesson');

  const reviewDecision = {
    schema: Core.REVIEW_DECISION_SCHEMA,
    receiptDigest: null,
    decisionId: 'synthetic-mike-review-decision',
    decisionOwner: 'MIKE',
    decision: 'ACCEPT_FOR_ONE_HELD_OUT_TRIAL_CASE',
    decidedAt: input.asOf,
    sourceLedgerDigest: first.ledgerDigest,
    candidateDigest: assignmentLesson.candidateDigest,
    reviewPacketDigest: 'a'.repeat(64)
  };
  reviewDecision.receiptDigest = Core.digest(noField(reviewDecision, 'receiptDigest'));
  const readyRequest = copy(assignmentRequest);
  readyRequest.requestId = 'synthetic-heldout-assignment-ready';
  readyRequest.reviewDecision = reviewDecision;
  readyRequest.recipients.baseline.explicitRequest = true;
  readyRequest.recipients.learningRoute.explicitRequest = true;
  readyRequest.authority.hostAuthenticatedMikeReview = true;
  const readyAssignment = Core.prepareTrialAssignment(first, readyRequest);
  equal(readyAssignment.state, 'READY_RECIPIENT_INITIATED_PAIRED_TRIAL', 'reviewed distinct recipients prepare one paired trial');
  equal(readyAssignment.blockers, [], 'ready assignment has no hidden blocker');
  equal(readyAssignment.trialCaseTemplate.baseline.lessonExcluded, true, 'baseline seat excludes lesson');
  equal(readyAssignment.trialCaseTemplate.learningRoute.lessonPresentation.presented, false, 'ready assignment still requires separate presentation');
  equal(readyAssignment.adoption.applied, false, 'ready assignment does not apply lesson');
  equal(Core.digest(noField(readyAssignment, 'assignmentDigest')), readyAssignment.assignmentDigest, 'trial assignment digest valid');
  equal(Core.prepareTrialAssignment(first, readyRequest).assignmentDigest, readyAssignment.assignmentDigest, 'trial assignment deterministic');

  const assignmentRequestPath = path.join(temp, 'trial-assignment-request.json');
  fs.writeFileSync(assignmentRequestPath, JSON.stringify(assignmentRequest, null, 2) + '\n');
  const assignmentRun = Cli.prepareTrialAssignment(path.join(runRoot, 'LEARNING_LEDGER.json'), assignmentRequestPath, path.join(temp, 'trial-assignment-hold'));
  equal(assignmentRun.value.assignmentDigest, heldAssignment.assignmentDigest, 'CLI trial hold matches core');
  expects('OUTPUT_EXISTS', () => Cli.prepareTrialAssignment(path.join(runRoot, 'LEARNING_LEDGER.json'), assignmentRequestPath, path.join(temp, 'trial-assignment-hold'))); checks += 1;

  const alteredReview = copy(readyRequest); alteredReview.reviewDecision.decision = 'REJECT_CANDIDATE';
  expects('REVIEW_DECISION_DIGEST', () => Core.prepareTrialAssignment(first, alteredReview)); checks += 1;
  const mismatchedReview = copy(readyRequest); mismatchedReview.reviewDecision.candidateDigest = 'b'.repeat(64); mismatchedReview.reviewDecision.receiptDigest = Core.digest(noField(mismatchedReview.reviewDecision, 'receiptDigest'));
  expects('REVIEW_BINDING', () => Core.prepareTrialAssignment(first, mismatchedReview)); checks += 1;
  const widenedAssignment = copy(readyRequest); widenedAssignment.authority.automaticPresentation = true;
  expects('TRIAL_ASSIGNMENT_AUTHORITY', () => Core.prepareTrialAssignment(first, widenedAssignment)); checks += 1;
  const sameRecipient = copy(readyRequest); sameRecipient.recipients.learningRoute.alias = sameRecipient.recipients.baseline.alias;
  ok(Core.prepareTrialAssignment(first, sameRecipient).blockers.some(item => item.code === 'PAIRED_RECIPIENTS_NOT_DISTINCT'), 'same recipient cannot fill both paired arms');
  const derivingRecipient = copy(readyRequest); derivingRecipient.recipients.learningRoute.alias = assignmentLesson.supportTaskAliases[0];
  ok(Core.prepareTrialAssignment(first, derivingRecipient).blockers.some(item => item.code === 'LEARNING_RECIPIENT_DERIVED_LESSON'), 'lesson source task is not a held-out recipient');
  const staleAssignment = copy(readyRequest); staleAssignment.asOf = assignmentLesson.refreshRequiredAt;
  ok(Core.prepareTrialAssignment(first, staleAssignment).blockers.some(item => item.code === 'CANDIDATE_REFRESH_REQUIRED'), 'stale candidate cannot enter trial assignment');
  const privateAssignment = copy(readyRequest); privateAssignment.recipients.baseline.alias = ['Z:', 'synthetic-private', 'seat'].join(String.fromCharCode(92));
  expects('PRIVATE_FIELD_LEAKAGE', () => Core.prepareTrialAssignment(first, privateAssignment)); checks += 1;

  function sealed(value) { value.receiptDigest = Core.digest(noField(value, 'receiptDigest')); return value; }
  function receiptBoundCase(suffix) {
    const assignmentRequestId = 'receipt-bound-case-' + suffix;
    const prospectivePlanDigest = '7'.repeat(64);
    const reviewPacketDigest = Core.digest({ kind: 'synthetic-review-packet', suffix });
    const reviewSubjectDigest = Core.digest({ sourceLedgerDigest: first.ledgerDigest, candidateDigest: assignmentLesson.candidateDigest, reviewPacketDigest, prospectivePlanDigest, assignmentRequestId });
    const reviewReceipt = {
      schema: Core.FOUNDATION_REVIEW_RECEIPT_SCHEMA,
      receiptId: 'foundation-review-' + suffix,
      constitutionId: 'synthetic-shadow-clone-trial-review',
      action: 'shadow-clone-heldout-trial-review',
      seatId: 'mike-final-gate',
      reviewer: { identityId: 'synthetic-mike-seat', kind: 'human', displayName: 'Synthetic Mike seat' },
      artifact: { artifactId: assignmentRequestId, digest: reviewSubjectDigest },
      verdict: 'UP',
      evidence: { summary: 'Synthetic fixture review of one exact held-out case.', refs: [reviewPacketDigest] },
      issuedAt: '2026-08-22T12:04:00.000Z'
    };
    const reviewRequest = {
      schema: Core.REVIEW_INTAKE_REQUEST_SCHEMA,
      requestId: 'review-intake-' + suffix,
      asOf: '2026-08-22T12:05:00.000Z',
      lessonKey: assignmentLesson.lessonKey,
      candidateDigest: assignmentLesson.candidateDigest,
      reviewPacketDigest,
      prospectivePlanDigest,
      assignmentRequestId,
      reviewReceipt,
      authorization: { hostAuthenticatedReviewReceipt: true, authenticatedMikeIdentityDigest: Core.digest(reviewReceipt.reviewer.identityId), authorizationReceiptDigest: Core.digest({ kind: 'synthetic-review-authorization', suffix }), automaticDecision: false }
    };
    const decision = Core.createReviewDecision(first, reviewRequest);
    function participation(seat, alias) {
      return sealed({
        schema: Core.PARTICIPATION_RECEIPT_SCHEMA,
        receiptDigest: null,
        participationId: 'participation-' + suffix + '-' + seat.toLowerCase().replace('_', '-'),
        prospectivePlanDigest,
        candidateDigest: assignmentLesson.candidateDigest,
        assignmentRequestId,
        seat,
        recipientAlias: alias,
        baseContextDigest: Core.digest({ kind: 'synthetic-base-context', suffix, seat }),
        requestedAt: '2026-08-22T12:03:00.000Z',
        expiresAt: '2026-08-24T12:03:00.000Z',
        state: 'OPT_IN_ONE_HELD_OUT_CASE',
        withdrawalReceiptDigest: null,
        automaticEnrollment: false
      });
    }
    const baselineAlias = 'baseline-' + suffix;
    const learningAlias = 'learning-' + suffix;
    const baselineParticipation = participation('BASELINE', baselineAlias);
    const learningParticipation = participation('LEARNING_ROUTE', learningAlias);
    const request = {
      schema: Core.TRIAL_ASSIGNMENT_REQUEST_V2_SCHEMA,
      requestId: assignmentRequestId,
      asOf: '2026-08-22T12:06:00.000Z',
      prospectivePlanDigest,
      lessonKey: assignmentLesson.lessonKey,
      candidateDigest: assignmentLesson.candidateDigest,
      reviewDecision: decision,
      recipients: {
        baseline: { alias: baselineAlias, baseContextDigest: baselineParticipation.baseContextDigest, participationReceipt: baselineParticipation },
        learningRoute: { alias: learningAlias, baseContextDigest: learningParticipation.baseContextDigest, participationReceipt: learningParticipation }
      },
      rubric: copy(valueTrial.rubric),
      authority: { hostAuthenticatedMikeReview: true, hostAuthenticatedRecipientRequests: true, automaticPresentation: false, crossTaskMessaging: false, automaticApplication: false, automaticInheritance: false }
    };
    const assignment = Core.prepareTrialAssignment(first, request);
    const caseAlias = assignment.trialCaseTemplate.caseAlias;
    const presentation = sealed({
      schema: Core.PRESENTATION_ACK_SCHEMA,
      receiptDigest: null,
      presentationId: 'presentation-' + suffix,
      assignmentDigest: assignment.assignmentDigest,
      caseAlias,
      candidateDigest: assignmentLesson.candidateDigest,
      recipientAlias: learningAlias,
      senderReceiptDigest: Core.digest({ kind: 'synthetic-sender-receipt', suffix }),
      recipientAcknowledgementDigest: Core.digest({ kind: 'synthetic-recipient-acknowledgement', suffix }),
      presentedAt: '2026-08-22T12:10:00.000Z',
      acknowledgedAt: '2026-08-22T12:11:00.000Z',
      recipientAcknowledged: true,
      recipientElectedUse: true,
      automaticPromptRewrite: false
    });
    function outcome(arm, alias, baseContextDigest, completedAt) {
      return sealed({
        schema: Core.ARM_OUTCOME_SCHEMA,
        receiptDigest: null,
        outcomeId: 'outcome-' + suffix + '-' + arm.toLowerCase().replace('_', '-'),
        assignmentDigest: assignment.assignmentDigest,
        caseAlias,
        arm,
        recipientAlias: alias,
        baseContextDigest,
        completedAt,
        finalSummaryDigest: Core.digest({ kind: 'synthetic-final-summary', suffix, arm }),
        outcomeDigest: Core.digest({ kind: 'synthetic-outcome', suffix, arm }),
        testReceiptDigest: Core.digest({ kind: 'synthetic-test-receipt', suffix, arm }),
        primaryOutcomeVerified: true,
        lessonUse: { candidateDigest: arm === 'BASELINE' ? null : assignmentLesson.candidateDigest, recipientElectedUse: arm !== 'BASELINE', automaticPromptRewrite: false }
      });
    }
    const baseline = outcome('BASELINE', baselineAlias, baselineParticipation.baseContextDigest, '2026-08-22T12:30:00.000Z');
    const learningRoute = outcome('LEARNING_ROUTE', learningAlias, learningParticipation.baseContextDigest, '2026-08-22T12:31:00.000Z');
    function evaluation(label) {
      return sealed({
        schema: Core.CASE_EVALUATION_SCHEMA,
        receiptDigest: null,
        evaluationId: 'evaluation-' + suffix + '-' + label,
        assignmentDigest: assignment.assignmentDigest,
        caseAlias,
        evaluatorAlias: 'evaluator-' + label,
        evaluatedAt: '2026-08-22T12:40:00.000Z',
        rubricDigest: Core.digest(valueTrial.rubric),
        outcomeReceiptDigests: [baseline.receiptDigest, learningRoute.receiptDigest],
        independence: { fromRecipients: true, fromLessonSources: true, hostAuthenticatedEvaluator: true },
        scores: { baseline: { primaryValue: 50, secondaryReusableValue: 0, overhead: 0 }, learningRoute: { primaryValue: 50, secondaryReusableValue: 45, overhead: 5 } },
        statement: 'Synthetic independent ' + label + ' assessment retained separately.'
      });
    }
    return { reviewRequest, decision, request, assignment, caseInput: { assignment, presentation, outcomes: { baseline, learningRoute }, evaluations: [evaluation('one'), evaluation('two')] } };
  }

  const receiptCases = ['alpha', 'beta', 'gamma'].map(receiptBoundCase);
  equal(receiptCases[0].decision.schema, Core.REVIEW_DECISION_V2_SCHEMA, 'shared review constitution composes into receipt-bound decision');
  equal(receiptCases[0].assignment.schema, Core.TRIAL_ASSIGNMENT_V2_SCHEMA, 'receipt-bound review and opt-in produce v2 assignment');
  equal(receiptCases[0].assignment.state, 'READY_RECIPIENT_INITIATED_PAIRED_TRIAL', 'receipt-bound case is ready but still not presented');
  equal(receiptCases[0].assignment.adoption.presented, false, 'receipt-bound assignment remains preparation only');
  equal(Core.createReviewDecision(first, receiptCases[0].reviewRequest).receiptDigest, receiptCases[0].decision.receiptDigest, 'review decision intake deterministic');
  equal(Core.prepareTrialAssignment(first, receiptCases[0].request).assignmentDigest, receiptCases[0].assignment.assignmentDigest, 'receipt-bound assignment deterministic');
  const reviewRequestPath = path.join(temp, 'receipt-bound-review-request.json');
  fs.writeFileSync(reviewRequestPath, JSON.stringify(receiptCases[0].reviewRequest, null, 2) + '\n');
  const reviewRun = Cli.prepareReviewDecision(path.join(runRoot, 'LEARNING_LEDGER.json'), reviewRequestPath, path.join(temp, 'receipt-bound-review-run'));
  equal(reviewRun.value.receiptDigest, receiptCases[0].decision.receiptDigest, 'CLI review intake matches core');
  expects('OUTPUT_EXISTS', () => Cli.prepareReviewDecision(path.join(runRoot, 'LEARNING_LEDGER.json'), reviewRequestPath, path.join(temp, 'receipt-bound-review-run'))); checks += 1;

  const evidenceTrial = {
    schema: Core.EVIDENCE_VALUE_TRIAL_SCHEMA,
    trialId: 'synthetic-evidence-bound-value-trial',
    asOf: '2026-08-22T13:00:00.000Z',
    prospectivePlanDigest: '7'.repeat(64),
    rubric: copy(valueTrial.rubric),
    cases: receiptCases.map(item => copy(item.caseInput)),
    authority: { hostAuthenticatedEvidenceReceipts: true, automaticPresentation: false, automaticApplication: false, automaticScoring: false, automaticInheritance: false }
  };
  const evidenceReceipt = Core.scoreEvidenceBoundTrial(evidenceTrial);
  equal(evidenceReceipt.state, 'BOUNDED_TARGET_MET', 'three receipt-bound held-out cases can meet the bounded target');
  equal(evidenceReceipt.summary.claimable, true, 'evidence-bound route becomes claimable only with three complete cases');
  equal(evidenceReceipt.summary.lowestObservedAmplificationRatio, 1.8, 'conservative result uses the lowest evaluator ratio');
  equal(evidenceReceipt.summary.independentEvaluatorAliases, 2, 'two independent evaluator aliases retained');
  ok(evidenceReceipt.cases.every(item => item.evaluatorAssessments.length === 2 && item.evaluatorAssessments.every(evaluation => evaluation.statement)), 'every evaluator score and statement remains visible');
  equal(Object.prototype.hasOwnProperty.call(evidenceReceipt.summary, 'meanAmplificationRatio'), false, 'evaluator disagreement is never averaged away');
  equal(Core.scoreEvidenceBoundTrial(evidenceTrial).receiptDigest, evidenceReceipt.receiptDigest, 'evidence-bound scoring deterministic');

  const oneCaseTrial = copy(evidenceTrial); oneCaseTrial.cases = oneCaseTrial.cases.slice(0, 1);
  const oneCaseReceipt = Core.scoreEvidenceBoundTrial(oneCaseTrial);
  equal(oneCaseReceipt.state, 'IN_PROGRESS_NOT_CLAIMABLE', 'one complete case remains in progress and not claimable');
  equal(oneCaseReceipt.summary.claimable, false, 'one complete case cannot imply broad value');

  const contestedTrial = copy(evidenceTrial);
  contestedTrial.cases[0].evaluations[1].scores.learningRoute.secondaryReusableValue = 0;
  contestedTrial.cases[0].evaluations[1].receiptDigest = Core.digest(noField(contestedTrial.cases[0].evaluations[1], 'receiptDigest'));
  const contestedReceipt = Core.scoreEvidenceBoundTrial(contestedTrial);
  equal(contestedReceipt.state, 'CONTESTED_EVALUATION', 'incompatible evaluator classifications block a value claim');
  equal(contestedReceipt.summary.claimable, false, 'contested evaluation is not claimable');
  equal(contestedReceipt.cases[0].disagreement.state, 'PRESERVED_INCOMPATIBLE_TARGET_CLASSIFICATION', 'evaluator disagreement preserved rather than averaged');

  const legacyEvidenceTrial = copy(evidenceTrial);
  legacyEvidenceTrial.cases = [{ assignment: heldAssignment, presentation: null, outcomes: { baseline: null, learningRoute: null }, evaluations: [] }];
  legacyEvidenceTrial.authority.hostAuthenticatedEvidenceReceipts = false;
  const legacyEvidenceHold = Core.scoreEvidenceBoundTrial(legacyEvidenceTrial);
  equal(legacyEvidenceHold.state, 'HOLD_EVIDENCE_BOUND_VALUE_TRIAL', 'legacy or missing evidence returns a typed trial hold');
  ok(legacyEvidenceHold.blockers.some(item => item.code === 'MISSING_AUTHENTICATED_EVIDENCE_PROVIDER') && legacyEvidenceHold.cases[0].blockers.some(item => item.code === 'ASSIGNMENT_NOT_RECEIPT_BOUND'), 'typed hold names missing provider and receipt-bound assignment');

  const spoofedReviewIntake = copy(receiptCases[0].reviewRequest); spoofedReviewIntake.authorization.authenticatedMikeIdentityDigest = '0'.repeat(64);
  expects('FOUNDATION_REVIEW_IDENTITY', () => Core.createReviewDecision(first, spoofedReviewIntake)); checks += 1;
  const mismatchedReviewSubject = copy(receiptCases[0].reviewRequest); mismatchedReviewSubject.reviewReceipt.artifact.digest = '0'.repeat(64);
  expects('FOUNDATION_REVIEW_BINDING', () => Core.createReviewDecision(first, mismatchedReviewSubject)); checks += 1;
  const tamperedParticipation = copy(receiptCases[0].request); tamperedParticipation.recipients.baseline.participationReceipt.recipientAlias = 'different-baseline';
  expects('PARTICIPATION_RECEIPT_DIGEST', () => Core.prepareTrialAssignment(first, tamperedParticipation)); checks += 1;
  const withdrawnParticipation = copy(receiptCases[0].request); withdrawnParticipation.recipients.baseline.participationReceipt.withdrawalReceiptDigest = 'f'.repeat(64); withdrawnParticipation.recipients.baseline.participationReceipt.receiptDigest = Core.digest(noField(withdrawnParticipation.recipients.baseline.participationReceipt, 'receiptDigest'));
  expects('PARTICIPATION_AUTHORITY', () => Core.prepareTrialAssignment(first, withdrawnParticipation)); checks += 1;
  const expiredParticipation = copy(receiptCases[0].request); expiredParticipation.recipients.baseline.participationReceipt.expiresAt = expiredParticipation.asOf; expiredParticipation.recipients.baseline.participationReceipt.receiptDigest = Core.digest(noField(expiredParticipation.recipients.baseline.participationReceipt, 'receiptDigest'));
  expects('PARTICIPATION_EXPIRY', () => Core.prepareTrialAssignment(first, expiredParticipation)); checks += 1;
  const reusedReview = copy(receiptCases[0].request); reusedReview.requestId = 'different-case-request';
  expects('PARTICIPATION_BINDING', () => Core.prepareTrialAssignment(first, reusedReview)); checks += 1;
  const duplicateEvidenceCase = copy(evidenceTrial); duplicateEvidenceCase.cases[1] = copy(duplicateEvidenceCase.cases[0]);
  expects('TRIAL_EVIDENCE_REUSE', () => Core.scoreEvidenceBoundTrial(duplicateEvidenceCase)); checks += 1;
  const tamperedOutcome = copy(evidenceTrial); tamperedOutcome.cases[0].outcomes.baseline.outcomeDigest = '0'.repeat(64);
  expects('ARM_OUTCOME_DIGEST', () => Core.scoreEvidenceBoundTrial(tamperedOutcome)); checks += 1;
  const fakeEvaluator = copy(evidenceTrial); fakeEvaluator.cases[0].evaluations[0].independence.fromRecipients = false; fakeEvaluator.cases[0].evaluations[0].receiptDigest = Core.digest(noField(fakeEvaluator.cases[0].evaluations[0], 'receiptDigest'));
  expects('CASE_EVALUATOR_INDEPENDENCE', () => Core.scoreEvidenceBoundTrial(fakeEvaluator)); checks += 1;
  const widenedEvidence = copy(evidenceTrial); widenedEvidence.authority.automaticScoring = true;
  expects('EVIDENCE_VALUE_AUTHORITY', () => Core.scoreEvidenceBoundTrial(widenedEvidence)); checks += 1;
  const privateEvidence = copy(evidenceTrial); privateEvidence.cases[0].evaluations[0].statement = ['Z:', 'synthetic-private', 'score.json'].join(String.fromCharCode(92));
  expects('PRIVATE_FIELD_LEAKAGE', () => Core.scoreEvidenceBoundTrial(privateEvidence)); checks += 1;

  const evidenceInputPath = path.join(temp, 'evidence-bound-trial.json');
  fs.writeFileSync(evidenceInputPath, JSON.stringify(evidenceTrial, null, 2) + '\n');
  const evidenceRun = Cli.scoreEvidenceTrial(evidenceInputPath, path.join(temp, 'evidence-bound-trial-run'));
  equal(evidenceRun.receipt.receiptDigest, evidenceReceipt.receiptDigest, 'CLI evidence-bound scorer matches core');
  const evidenceReplay = Cli.replayEvidenceTrial(path.join(temp, 'evidence-bound-trial-run'), path.join(temp, 'evidence-bound-trial-replay'));
  equal(evidenceReplay.receipt.state, 'PASS_CLEAN_EVIDENCE_BOUND_VALUE_REPLAY', 'evidence-bound trial clean replay passes');
  expects('OUTPUT_EXISTS', () => Cli.scoreEvidenceTrial(evidenceInputPath, path.join(temp, 'evidence-bound-trial-run'))); checks += 1;
  expects('OUTPUT_BOUNDARY', () => Cli.replayEvidenceTrial(path.join(temp, 'evidence-bound-trial-run'), path.join(temp, 'evidence-bound-trial-run', 'nested'))); checks += 1;
  const evidenceReceiptFile = path.join(temp, 'evidence-bound-trial-run', 'EVIDENCE_BOUND_VALUE_RECEIPT.json');
  const alteredEvidenceReceipt = readJson(evidenceReceiptFile); alteredEvidenceReceipt.state = 'FAKE_TARGET'; fs.writeFileSync(evidenceReceiptFile, JSON.stringify(alteredEvidenceReceipt, null, 2) + '\n');
  expects('EVIDENCE_VALUE_RECEIPT_DIGEST', () => Cli.replayEvidenceTrial(path.join(temp, 'evidence-bound-trial-run'), path.join(temp, 'altered-evidence-replay'))); checks += 1;

  const duplicate = copy(input);
  duplicate.snapshots[0].observations.push(copy(duplicate.snapshots[0].observations[0]));
  const deduplicated = Core.compileSnapshotSet(duplicate);
  equal(deduplicated.deduplication.exactSignalDuplicatesRemoved, 1, 'exact duplicate signal removed');
  equal(deduplicated.candidateLessons.find(item => item.lessonKey === lesson.lessonKey).confidence, 'HIGH', 'duplicate does not inflate confidence');

  const stale = copy(input);
  stale.snapshots.forEach(item => { item.observedAt = '2026-07-01T10:00:00.000Z'; item.expiresAt = '2026-07-08T10:00:00.000Z'; });
  const staleLedger = Core.compileSnapshotSet(stale);
  equal(staleLedger.candidateLessons.find(item => item.lessonKey === lesson.lessonKey).status, 'REFRESH_REQUIRED', 'stale lesson requires refresh');
  equal(staleLedger.learningClaim.demonstrated, false, 'stale evidence cannot demonstrate learning');
  ok(staleLedger.contradictions.some(item => item.kind === 'STALE_OBSERVATION'), 'stale uncertainty retained');

  const spoofed = copy(input); spoofed.authorization.authority = 'SELF_DECLARED';
  expects('LEARNING_AUTHORITY', () => Core.compileSnapshotSet(spoofed)); checks += 1;
  const alteredSource = copy(input); alteredSource.snapshots[0].sourceDigest = '0'.repeat(64);
  expects('SOURCE_BINDING', () => Core.compileSnapshotSet(alteredSource)); checks += 1;
  const privateField = copy(input); privateField.rawTranscript = 'private material';
  expects('PRIVATE_FIELD_LEAKAGE', () => Core.compileSnapshotSet(privateField)); checks += 1;
  const privatePath = copy(input); const syntheticMachinePath = ['Z:', 'synthetic-private', 'session.jsonl'].join(String.fromCharCode(92)); privatePath.snapshots[0].observations[0].statement = 'Read ' + syntheticMachinePath;
  expects('PRIVATE_FIELD_LEAKAGE', () => Core.compileSnapshotSet(privatePath)); checks += 1;
  const unauthorizedInheritance = copy(input); unauthorizedInheritance.inheritanceDecision = 'CANON';
  expects('SHAPE', () => Core.compileSnapshotSet(unauthorizedInheritance)); checks += 1;
  const changedVerification = copy(input); changedVerification.snapshots[3].verifications[0].observedOutputDigest = '0'.repeat(64);
  expects('VERIFICATION_DIGEST', () => Core.compileSnapshotSet(changedVerification)); checks += 1;
  const unboundVerification = copy(input); unboundVerification.snapshots[3].verifications[0].testReceiptDigest = 'a'.repeat(64);
  expects('SOURCE_BINDING', () => Core.compileSnapshotSet(unboundVerification)); checks += 1;

  const fake = copy(input);
  fake.activeTaskAliases = fake.activeTaskAliases.slice(0, 2);
  fake.sourceDigests = fake.sourceDigests.slice(0, 2);
  fake.snapshots = fake.snapshots.slice(0, 2);
  fake.snapshots.forEach(snapshot => { snapshot.observations = snapshot.observations.slice(0, 1); });
  fake.snapshots.forEach((snapshot, snapshotIndex) => snapshot.observations.forEach((signal, signalIndex) => { signal.lessonKey = 'unique-' + snapshotIndex + '-' + signalIndex; }));
  const fakeLedger = Core.compileSnapshotSet(fake);
  equal(fakeLedger.state, 'INSUFFICIENT_EVIDENCE', 'unshared text is not learning');
  equal(fakeLedger.learningClaim.demonstrated, false, 'fake learning claim remains false');
  expects('NO_ELIGIBLE_LESSON', () => Core.createPickup(fakeLedger, Object.assign({}, pickupRequest, { lessonKeys: [] }))); checks += 1;

  const capability = Core.providerCapabilityReceipt(input.asOf);
  equal(capability.status, 'MISSING_CAPABILITY_OR_AUTHORIZATION', 'typed provider miss');
  equal(capability.execution, 'INERT', 'missing provider stays inert');
  equal(capability.crossTaskMessaging, false, 'provider miss grants no messaging');
  const inertAdapter = new Adapter.PeriodicCompactSnapshotAdapter({ clock: () => input.asOf });
  const inertCycle = await inertAdapter.runOnce({ explicitMikeAuthorization: true, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64) });
  equal(inertCycle.status, 'MISSING_CAPABILITY_OR_AUTHORIZATION', 'adapter does not fake a live connection');
  await assert.rejects(() => inertAdapter.runOnce({ explicitMikeAuthorization: false, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64) }), error => error.code === 'LEARNING_AUTHORITY'); checks += 1;

  let delivered = null;
  const provider = {
    capability: () => ({ schema: Adapter.PROVIDER_SCHEMA, receiptDigest: 'b'.repeat(64), status: 'AVAILABLE', capabilityId: 'codex.task.compact-snapshot.read', compactSnapshotsOnly: true, taskHistoryRead: false, crossTaskMessaging: false, credentialInspection: false }),
    collectCompactSnapshotSet: async () => copy(input)
  };
  const activeAdapter = new Adapter.PeriodicCompactSnapshotAdapter({ provider, clock: () => input.asOf, onCycle: item => { delivered = item; } });
  const cycle = await activeAdapter.runOnce({ explicitMikeAuthorization: true, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64), intervalMinutes: 60, maxCycles: 2 });
  equal(cycle.state, 'COMPACT_CYCLE_COMPILED', 'authorized provider cycle compiles');
  equal(delivered.ledger.ledgerDigest, first.ledgerDigest, 'cycle delivery is digest-bound');
  const schedule = activeAdapter.start({ explicitMikeAuthorization: true, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64), intervalMinutes: 60, maxCycles: 2 });
  equal(schedule.state, 'EXPLICITLY_STARTED', 'periodic schedule requires explicit start');
  equal(activeAdapter.stop('SELFTEST').state, 'STOPPED', 'periodic schedule stops explicitly');

  const freshInput = novelCycle(input);
  let chainedProviderCalls = 0;
  const chainedProvider = {
    capability: provider.capability,
    collectCompactSnapshotSet: async () => copy(chainedProviderCalls++ === 0 ? input : freshInput)
  };
  const chainedAdapter = new Adapter.PeriodicCompactSnapshotAdapter({ provider: chainedProvider, clock: () => input.asOf });
  const chainedFirst = await chainedAdapter.runOnce({ explicitMikeAuthorization: true, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64) });
  const chainedSecond = await chainedAdapter.runOnce({ explicitMikeAuthorization: true, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64) });
  equal(chainedFirst.previousLedgerDigest, null, 'first periodic cycle has no predecessor');
  equal(chainedSecond.previousLedgerDigest, chainedFirst.ledger.ledgerDigest, 'periodic cycle binds its predecessor');
  equal(chainedSecond.ledger.cycleHistory.length, 2, 'periodic adapter accumulates bounded cycle history');
  equal(chainedSecond.ledger.cycleHistory[1].previousLedgerDigest, chainedFirst.ledger.ledgerDigest, 'compiled history records prior ledger digest');
  equal(chainedSecond.ledger.source.seenSourceDigests.length, 8, 'periodic chain accumulates source digest history');
  equal(chainedSecond.ledger.deduplication.duplicateSourceSnapshotsRemoved, 0, 'novel second cycle removes no sources');
  ok(chainedSecond.ledger.lessonVersions.length > chainedSecond.ledger.lessons.length, 'superseded lesson versions remain in cumulative history');
  equal(chainedSecond.ledger.cycleHistory[1].preservedPriorLessonVersions, chainedFirst.ledger.lessonVersions.length, 'cycle records preserved predecessor versions');
  equal(chainedSecond.ledger.cycleHistory[1].newLessonVersions, chainedSecond.ledger.candidateLessons.length, 'cycle records each new digest-distinct lesson version');
  const contestedKey = chainedFirst.ledger.lessons.find(item => item.status === 'CONTESTED').lessonKey;
  equal(chainedSecond.ledger.lessonVersions.filter(item => item.lessonKey === contestedKey).length, 2, 'same-key dissent retains both digest-distinct versions');
  const chainedPickup = Core.createPickup(chainedSecond.ledger, Object.assign({}, pickupRequest, { requestId: 'chained-version-pickup' }));
  equal(chainedPickup.cloneProfile.dissent.filter(item => item.lessonKey === contestedKey).length, 2, 'anti-drift pickup carries every preserved dissent version');
  const legacyPrevious = copy(chainedFirst.ledger);
  delete legacyPrevious.source.seenSourceDigests;
  delete legacyPrevious.source.novelSourceDigests;
  delete legacyPrevious.lessonVersions;
  legacyPrevious.ledgerDigest = Core.digest(noField(legacyPrevious, 'ledgerDigest'));
  const legacySuccessorInput = copy(freshInput);
  legacySuccessorInput.previousLedger = legacyPrevious;
  const legacySuccessor = Core.compileSnapshotSet(legacySuccessorInput);
  equal(legacySuccessor.source.seenSourceDigests.length, 8, 'legacy predecessor source bindings migrate into digest history');
  ok(legacySuccessor.lessonVersions.length > legacySuccessor.lessons.length, 'legacy predecessor lessons migrate into immutable version history');

  const freshInputPath = path.join(temp, 'fresh-cycle-input.json');
  fs.writeFileSync(freshInputPath, JSON.stringify(freshInput, null, 2) + '\n');
  const chainedCli = Cli.runLearning(freshInputPath, path.join(temp, 'learning-run-chained'), path.join(runRoot, 'LEARNING_LEDGER.json'));
  equal(chainedCli.ledger.cycleHistory.length, 2, 'CLI previous-ledger route accumulates history');
  equal(chainedCli.ledger.cycleHistory[1].previousLedgerDigest, first.ledgerDigest, 'CLI chain is digest-bound');
  expects('INSUFFICIENT_NOVEL_EVIDENCE', () => Cli.runLearning(path.join(root, 'fixtures', 'synthetic-compact-snapshot-set.example.json'), path.join(temp, 'duplicate-chain-run'), path.join(runRoot, 'LEARNING_LEDGER.json'))); checks += 1;
  const conflictingInput = copy(input); conflictingInput.previousLedger = first;
  const conflictingPath = path.join(temp, 'conflicting-input.json');
  fs.writeFileSync(conflictingPath, JSON.stringify(conflictingInput, null, 2) + '\n');
  expects('PREVIOUS_LEDGER_CONFLICT', () => Cli.runLearning(conflictingPath, path.join(temp, 'conflicting-run'), path.join(runRoot, 'LEARNING_LEDGER.json'))); checks += 1;
  const tamperedPrevious = copy(first); tamperedPrevious.state = 'TAMPERED';
  const tamperedPreviousPath = path.join(temp, 'tampered-previous-ledger.json');
  fs.writeFileSync(tamperedPreviousPath, JSON.stringify(tamperedPrevious, null, 2) + '\n');
  expects('LEDGER_DIGEST', () => Cli.runLearning(path.join(root, 'fixtures', 'synthetic-compact-snapshot-set.example.json'), path.join(temp, 'tampered-chain-run'), tamperedPreviousPath)); checks += 1;
  expects('LEDGER_DIGEST', () => new Adapter.PeriodicCompactSnapshotAdapter({ provider, clock: () => input.asOf, previousLedger: tamperedPrevious })); checks += 1;

  const smuggledProvider = {
    capability: provider.capability,
    collectCompactSnapshotSet: async () => { const value = copy(input); value.previousLedger = first; return value; }
  };
  const smuggledAdapter = new Adapter.PeriodicCompactSnapshotAdapter({ provider: smuggledProvider, clock: () => input.asOf });
  await assert.rejects(() => smuggledAdapter.runOnce({ explicitMikeAuthorization: true, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64) }), error => error.code === 'PROVIDER_BINDING'); checks += 1;

  const badProvider = {
    capability: provider.capability,
    collectCompactSnapshotSet: async () => { const value = copy(input); value.providerBoundary.capabilityReceiptDigest = '0'.repeat(64); return value; }
  };
  const badAdapter = new Adapter.PeriodicCompactSnapshotAdapter({ provider: badProvider, clock: () => input.asOf });
  await assert.rejects(() => badAdapter.runOnce({ explicitMikeAuthorization: true, scope: 'ACTIVE_AXM_CODEX_COMPACT_LEARNING', authorizationReceiptDigest: 'a'.repeat(64) }), error => error.code === 'PROVIDER_BINDING'); checks += 1;

  const scored = Core.scoreValueTrial(valueTrial);
  const scoredAgain = Core.scoreValueTrial(valueTrial);
  equal(scored.receiptDigest, scoredAgain.receiptDigest, 'value trial deterministic');
  equal(scored.summary.meanAmplificationRatio, 1.8, 'synthetic scorer reaches predeclared ratio');
  equal(scored.summary.claimable, true, 'synthetic rubric structurally claimable');
  equal(scored.summary.realWorldClaimable, false, 'direct supplied-score route is never real-world claimable');
  equal(scored.summary.literalTwoXProven, false, '1.8 is not literal 2x');
  ok(scored.claimBoundary.includes('only'), 'trial claim remains bounded');
  const trialRun = Cli.scoreTrial(path.join(root, 'fixtures', 'synthetic-value-trial.example.json'), path.join(temp, 'value-run'));
  equal(trialRun.receipt.receiptDigest, scored.receiptDigest, 'CLI value receipt matches core');
  equal(Cli.replayTrial(path.join(temp, 'value-run'), path.join(temp, 'value-replay')).receipt.state, 'PASS_CLEAN_VALUE_TRIAL_REPLAY', 'value trial clean replay');
  const weakTrial = copy(valueTrial); weakTrial.cases = weakTrial.cases.slice(0, 1);
  equal(Core.scoreValueTrial(weakTrial).summary.conclusion, 'TRIAL_NOT_CLAIMABLE', 'underpowered trial cannot claim multiplier');
  const shiftedPrimary = copy(valueTrial); shiftedPrimary.cases[0].learningRoute.primaryValue = 60;
  expects('VALUE_RUBRIC', () => Core.scoreValueTrial(shiftedPrimary)); checks += 1;

  const driftFile = path.join(runRoot, 'LEARNING_LEDGER.json');
  const drifted = readJson(driftFile); drifted.state = 'FAKE_PASS'; fs.writeFileSync(driftFile, JSON.stringify(drifted, null, 2) + '\n');
  expects('LEDGER_DIGEST', () => Cli.replayLearning(runRoot, path.join(temp, 'drift-replay'))); checks += 1;

  for (const name of ['compact-snapshot-set.schema.json', 'anti-drift-pickup.schema.json', 'mirror-private-lesson-proposal.schema.json', 'candidate-review-decision.schema.json', 'candidate-review-intake-request.schema.json', 'candidate-review-decision-v2.schema.json', 'trial-participation-receipt.schema.json', 'trial-assignment-request.schema.json', 'trial-assignment.schema.json', 'trial-assignment-request-v2.schema.json', 'trial-assignment-v2.schema.json', 'lesson-presentation-ack.schema.json', 'trial-arm-outcome.schema.json', 'trial-case-evaluation.schema.json', 'scored-value-trial.schema.json', 'evidence-bound-value-trial.schema.json', 'evidence-bound-value-receipt.schema.json']) {
    const schema = readJson(path.join(root, 'schemas', name));
    ok(schema.$id && schema.$schema, name + ' declares identity');
  }
  const participationFixture = readJson(path.join(root, 'fixtures', 'synthetic-trial-participation-receipt.example.json'));
  equal(Core.validateParticipationReceipt(participationFixture, Date.parse('2026-08-22T13:00:00.000Z')).receiptDigest, participationFixture.receiptDigest, 'synthetic participation fixture is digest-valid and active');
  const interfaceProposal = readJson(path.join(root, 'CODE_CAPABILITY_FABRIC_INTERFACE_PROPOSAL.json'));
  equal(interfaceProposal.status, 'PROPOSAL_ONLY', 'Code Capability Fabric stays a proposal');
  equal(interfaceProposal.dependsOnInProgressBranch, false, 'no in-progress branch dependency');
  equal(interfaceProposal.invoked, false, 'Fabric interface not invoked');

  console.log('shadow clone learning steward self-test: PASS · ' + checks + ' checks');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
