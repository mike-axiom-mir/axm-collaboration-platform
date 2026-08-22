#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Shadow = require('./model-shadow-continuity');
const ReviewService = require('../operations/review-service');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }

function ref(id, schema, seed) {
  return { id, schema, sha256: Shadow.sha256(seed) };
}

const taskRef = ref('task:model-shadow-fixture', 'axm.task/v1', 'same task');
const contextRef = ref('context:model-shadow-fixture', 'axm.context-envelope/v1', 'same bounded context');
const provenanceRef = ref('seat:model-a-provenance', 'axm.model-seat-provenance/v1', 'provider-a/model-a');
const sourceRef = ref('evidence:fixture', 'axm.evidence-fragment/v1', 'fixture evidence');

function seat(overrides) {
  return Object.assign({
    id: 'model-seat-a',
    kind: 'MODEL',
    role: 'bounded technical challenger',
    providerFamily: 'provider-a',
    modelId: 'model-a-v1',
    identityDisclosure: 'EXACT',
    priorOutputExposure: 'NONE',
    provenanceRef,
    proofAuthority: 'NONE'
  }, overrides || {});
}

function commitment(id, overrides) {
  return Object.assign({
    id,
    kind: 'CLAIM',
    position: 'AFFIRM',
    evidenceStage: 'OBSERVED',
    contentDigest: Shadow.sha256('content:' + id),
    sourceRefs: [sourceRef],
    uncertaintyState: 'DECLARED',
    authorityRequests: []
  }, overrides || {});
}

function snapshotInput(id, capturedAt, overrides) {
  return Object.assign({
    snapshotId: id,
    capturedAt,
    taskRef,
    contextRef,
    seat: seat(),
    outputRef: ref('output:' + id, 'axm.structured-model-output/v1', id),
    commitments: [
      commitment('agency-boundary', { kind: 'CONSTRAINT', position: 'AFFIRM' }),
      commitment('technical-claim')
    ],
    capabilities: ['analysis.explain', 'code.propose'],
    requestedPermissions: []
  }, overrides || {});
}

function observe(baselineSnapshot, candidateSnapshot, overrides) {
  return Object.assign({
    observationId: 'observation:model-shadow-fixture',
    observedAt: '2026-08-20T12:02:00.000Z',
    baselineSnapshot,
    candidateSnapshot
  }, overrides || {});
}

const baseline = Shadow.createSnapshot(snapshotInput('snapshot:baseline', '2026-08-20T12:00:00.000Z'));
const matching = Shadow.createSnapshot(snapshotInput('snapshot:matching', '2026-08-20T12:01:00.000Z'));
check(Shadow.verifySnapshot(baseline).pass, 'baseline snapshot exact digest verifies');
equal(baseline.schema, Shadow.SNAPSHOT_SCHEMA, 'snapshot schema is exact');
equal(baseline.truth.rawOutputEmbedded, false, 'snapshot embeds no raw model output');
equal(baseline.truth.privateContextEmbedded, false, 'snapshot embeds no private context');
equal(baseline.truth.modelInvokedByObserver, false, 'snapshot creation invokes no model');

const matchInput = observe(baseline, matching);
const matchReceipt = Shadow.buildObservation(matchInput);
equal(matchReceipt.decision.classification, 'STRUCTURED_TRACE_MATCH', 'same declared structured trace under exact context matches');
equal(matchReceipt.comparison.outputArtifactMatch, false, 'different raw-output artifact digests remain visible');
equal(matchReceipt.truth.rawOutputArtifactCompared, false, 'raw-output equivalence is not inferred from structured continuity');
equal(matchReceipt.decision.reviewRequired, false, 'exact match needs no drift review');
equal(matchReceipt.projection.signals.length, 0, 'exact match manufactures no simulation signal');
check(Shadow.verifyObservation(matchInput, matchReceipt).pass, 'exact match receipt rebuild verifies');
equal(matchReceipt.truth.sameModelMindClaimed, false, 'matching identifiers are not called the same persistent mind');
equal(matchReceipt.truth.semanticCorrectnessProven, false, 'matching trace does not prove correctness');
equal(matchReceipt.truth.humanBenefitProven, false, 'matching trace does not prove human benefit');

const criticalCandidate = Shadow.createSnapshot(snapshotInput('snapshot:critical', '2026-08-20T12:01:00.000Z', {
  commitments: [
    commitment('agency-boundary', { kind: 'CONSTRAINT', position: 'HOLD' }),
    commitment('technical-claim', {
      position: 'REJECT',
      contentDigest: Shadow.sha256('changed technical claim'),
      sourceRefs: [ref('evidence:new', 'axm.evidence-fragment/v1', 'new evidence')]
    }),
    commitment('new-claim')
  ],
  capabilities: ['analysis.explain', 'code.propose', 'code.write'],
  requestedPermissions: ['filesystem-write']
}));
const criticalInput = observe(baseline, criticalCandidate);
const critical = Shadow.buildObservation(criticalInput);
equal(critical.decision.classification, 'CRITICAL_DRIFT', 'permission expansion and boundary loss are critical drift');
equal(critical.comparison.validComparison, true, 'critical drift remains a valid same-context comparison');
check(critical.comparison.criticalCommitmentIds.includes('agency-boundary'), 'affirmed constraint loss is critical');
check(critical.comparison.permissionDrift.added.includes('filesystem-write'), 'new permission request is visible');
check(critical.comparison.capabilityDrift.added.includes('code.write'), 'new declared capability is visible');
check(critical.comparison.sourceLineageDriftCommitmentIds.includes('technical-claim'), 'source lineage drift is visible');
check(critical.projection.signals.length >= 4, 'bounded simulation projection carries structured drift signals');
check(critical.projection.signals.every(signal => signal.evidenceStage === 'INFERENCE' && signal.sourceRefs[0].sha256 === critical.comparisonRef.sha256), 'signals bind the exact comparison and remain inference');
equal(critical.projection.seats[0].proofAuthority, 'NONE', 'simulation seat has no proof authority');
equal('sha256:' + critical.reviewProjection.artifactDigest, critical.comparisonRef.sha256, 'review projection binds exact comparison digest');
equal(critical.reviewProjection.truth.submittedToReviewInbox, false, 'review projection is not automatically submitted');
equal(critical.reviewProjection.action.adoptionAuthorized, false, 'review projection grants no adoption authority');
check(!Shadow.stableStringify(critical.reviewProjection).includes('"note"'), 'review projection contains no note field');
check(Shadow.verifyObservation(criticalInput, critical).pass, 'critical drift receipt exact rebuild verifies');

const reviewRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-model-shadow-review-'));
try {
  const review = ReviewService.create({ stateRoot: reviewRoot });
  const item = review.submit(critical.reviewProjection);
  equal(item.artifactDigest, critical.reviewProjection.artifactDigest, 'existing Review Inbox accepts the exact projected digest');
  equal(item.action.classification, 'CRITICAL_DRIFT', 'existing Review Inbox preserves the projected structured action');
} finally {
  fs.rmSync(reviewRoot, { recursive: true, force: true });
}
equal(fs.existsSync(reviewRoot), false, 'temporary Review Inbox compatibility state is removed');

const signalKeys = ['cheapestTest', 'contradictions', 'evidenceStage', 'id', 'seatIds', 'solutionAlternatives', 'sourceRefs', 'statement', 'uncertainty', 'wildcard'];
check(critical.projection.signals.every(signal => Object.keys(signal).sort().join('|') === signalKeys.sort().join('|')), 'simulation signals match Baseline Simulation Lab input keys');
const seatKeys = ['id', 'identityDisclosure', 'kind', 'modelId', 'priorOutputExposure', 'proofAuthority', 'provenanceRef', 'providerFamily', 'role'];
equal(Object.keys(critical.projection.seats[0]).sort().join('|'), seatKeys.sort().join('|'), 'simulation seat matches Baseline Simulation Lab input keys');

const contentCandidate = Shadow.createSnapshot(snapshotInput('snapshot:content', '2026-08-20T12:01:00.000Z', {
  commitments: [
    commitment('agency-boundary', { kind: 'CONSTRAINT', position: 'AFFIRM' }),
    commitment('technical-claim', { contentDigest: Shadow.sha256('new wording or structure') })
  ]
}));
const contentDrift = Shadow.buildObservation(observe(baseline, contentCandidate));
equal(contentDrift.decision.classification, 'DRIFT_DETECTED', 'content digest change is reviewable drift, not automatic failure');
equal(contentDrift.comparison.commitmentDrift[0].severity, 'REVIEW', 'content-only change stays review severity');

const authorityCandidate = Shadow.createSnapshot(snapshotInput('snapshot:authority', '2026-08-20T12:01:00.000Z', {
  commitments: [
    commitment('agency-boundary', { kind: 'CONSTRAINT', position: 'AFFIRM' }),
    commitment('technical-claim', { authorityRequests: ['EXECUTE'] })
  ]
}));
const authorityDrift = Shadow.buildObservation(observe(baseline, authorityCandidate));
equal(authorityDrift.decision.classification, 'CRITICAL_DRIFT', 'new authority request is critical drift');

const removedBoundaryCandidate = Shadow.createSnapshot(snapshotInput('snapshot:removed-boundary', '2026-08-20T12:01:00.000Z', {
  commitments: [commitment('technical-claim')]
}));
const removedBoundary = Shadow.buildObservation(observe(baseline, removedBoundaryCandidate));
equal(removedBoundary.decision.classification, 'CRITICAL_DRIFT', 'removing an affirmed constraint is critical drift');

const contextCandidate = Shadow.createSnapshot(snapshotInput('snapshot:context-change', '2026-08-20T12:01:00.000Z', {
  contextRef: ref('context:changed', 'axm.context-envelope/v1', 'different context'),
  commitments: [commitment('new-context-claim')]
}));
const contextHold = Shadow.buildObservation(observe(baseline, contextCandidate));
equal(contextHold.decision.classification, 'CONTEXT_CHANGED_COMPARISON_NOT_VALID', 'context change is held apart from model drift');
equal(contextHold.decision.validComparison, false, 'context mismatch invalidates comparison');
equal(contextHold.projection.signals.length, 0, 'invalid context creates no simulation signal');

const identityCandidate = Shadow.createSnapshot(snapshotInput('snapshot:identity-change', '2026-08-20T12:01:00.000Z', {
  seat: seat({ modelId: 'model-a-v2' })
}));
equal(Shadow.buildObservation(observe(baseline, identityCandidate)).decision.classification, 'IDENTITY_CHANGED_COMPARISON_NOT_VALID', 'model identity change is held apart from drift');

const partialCandidate = Shadow.createSnapshot(snapshotInput('snapshot:partial-identity', '2026-08-20T12:01:00.000Z', {
  seat: seat({ identityDisclosure: 'PARTIAL', modelId: null })
}));
equal(Shadow.buildObservation(observe(baseline, partialCandidate)).decision.classification, 'IDENTITY_CHANGED_COMPARISON_NOT_VALID', 'partial model identity cannot establish continuity comparison');

const taskCandidate = Shadow.createSnapshot(snapshotInput('snapshot:task-change', '2026-08-20T12:01:00.000Z', {
  taskRef: ref('task:changed', 'axm.task/v1', 'different task')
}));
equal(Shadow.buildObservation(observe(baseline, taskCandidate)).decision.classification, 'HOLD_TASK_MISMATCH', 'different task is held before drift interpretation');

const staleCandidate = Shadow.createSnapshot(snapshotInput('snapshot:stale', '2026-08-20T11:59:00.000Z'));
equal(Shadow.buildObservation(observe(baseline, staleCandidate)).decision.classification, 'HOLD_NON_FORWARD_SEQUENCE', 'non-forward candidate sequence is held');

const permissionRemovalBaseline = Shadow.createSnapshot(snapshotInput('snapshot:permission-baseline', '2026-08-20T12:00:00.000Z', {
  requestedPermissions: ['filesystem-read']
}));
const permissionRemovalCandidate = Shadow.createSnapshot(snapshotInput('snapshot:permission-candidate', '2026-08-20T12:01:00.000Z'));
equal(Shadow.buildObservation(observe(permissionRemovalBaseline, permissionRemovalCandidate)).decision.classification, 'DRIFT_DETECTED', 'permission removal remains visible without critical escalation');

const reordered = Shadow.createSnapshot(snapshotInput('snapshot:baseline', '2026-08-20T12:00:00.000Z', {
  commitments: [commitment('technical-claim'), commitment('agency-boundary', { kind: 'CONSTRAINT', position: 'AFFIRM' })],
  capabilities: ['code.propose', 'analysis.explain']
}));
equal(Shadow.stableStringify(reordered), Shadow.stableStringify(baseline), 'snapshot ordering is deterministic');

const tamperedSnapshot = Shadow.clone(baseline);
tamperedSnapshot.capabilities.push('tampered');
equal(Shadow.verifySnapshot(tamperedSnapshot).pass, false, 'snapshot tampering is detected');
const tamperedReceipt = Shadow.clone(critical);
tamperedReceipt.decision.classification = 'MATCH';
equal(Shadow.verifyObservation(criticalInput, tamperedReceipt).pass, false, 'receipt tampering is detected');

throws(() => Shadow.createSnapshot(Object.assign(snapshotInput('snapshot:raw', '2026-08-20T12:01:00.000Z'), { rawOutput: 'private raw text' })), /unsupported field/, 'raw output field is refused');
throws(() => Shadow.createSnapshot(Object.assign(snapshotInput('snapshot:private', '2026-08-20T12:01:00.000Z'), { privateContext: 'secret' })), /unsupported field/, 'private context field is refused');
throws(() => Shadow.createSnapshot(snapshotInput('C:\\machine\\snapshot', '2026-08-20T12:01:00.000Z')), /portable logical identifier/, 'machine path snapshot identity is refused');
throws(() => Shadow.createSnapshot(snapshotInput('snapshot:duplicate-authority', '2026-08-20T12:01:00.000Z', {
  commitments: [commitment('technical-claim', { authorityRequests: ['execute', 'EXECUTE'] })]
})), /duplicate actions/, 'case-normalized duplicate authority actions are refused');
throws(() => Shadow.buildObservation(Object.assign(observe(baseline, matching), { surprise: true })), /unsupported field/, 'unknown observation field is refused');
throws(() => Shadow.stableStringify({ unsafe: undefined }), /undefined/, 'undefined state is refused at canonical boundary');
const cycle = {}; cycle.self = cycle;
throws(() => Shadow.stableStringify(cycle), /cycle/, 'cyclic state is refused at canonical boundary');

const snapshotSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-snapshot.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-continuity-receipt.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
equal(snapshotSchema.$id, Shadow.SNAPSHOT_SCHEMA, 'snapshot schema file matches implementation');
equal(receiptSchema.$id, Shadow.RECEIPT_SCHEMA, 'receipt schema file matches implementation');
equal(contract.status, 'TEST', 'module remains TEST');
equal(contract.permissions.length, 0, 'module requests zero permissions');
check(contract.boundaries.writes.length === 0 && contract.boundaries.refuses.includes('provider-invocation') && contract.boundaries.refuses.includes('automatic-training'), 'contract refuses provider invocation, training, and writes');

console.log('\nModel Shadow Continuity selftest: PASS (' + checks + ' checks)');
