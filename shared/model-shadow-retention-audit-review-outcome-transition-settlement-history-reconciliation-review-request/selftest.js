#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Bridge = require('./model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request');
const V39 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer');
const Fixture = require('../model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/selftest-fixture');
const ReviewService = require('../operations/review-service');

let assertions = 0;
function check(value, label) { assert.ok(value, label); assertions += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function throwsCode(operation, code, label) {
  let observed = null;
  try { operation(); } catch (error) { observed = error.code || error.name; }
  equal(observed, code, label);
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target), resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function treeDigest(root) {
  const files = [];
  function visit(directory, relative) {
    fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(directory, entry.name), rel = path.join(relative, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) visit(absolute, rel);
      else if (entry.isFile()) files.push([rel, crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')]);
      else files.push([rel, 'NON_REGULAR']);
    });
  }
  visit(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
}
function canonicalWrite(file, value) { fs.writeFileSync(file, Bridge.stableStringify(value), 'utf8'); }
function runChild(packageFile) {
  const child = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packageFile], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (child.status !== 0) throw new Error('fresh-process rebuild failed: ' + child.stdout + child.stderr);
  return JSON.parse(child.stdout);
}
function expectInvalidArtifact(base, mutate, label) {
  const value = copy(base); mutate(value);
  throwsCode(() => Bridge.validateArtifact(value), 'INVALID_RECONCILIATION_REVIEW_ARTIFACT', label);
}
function expectInvalidRequest(base, mutate, label) {
  const value = copy(base); mutate(value);
  throwsCode(() => Bridge.validateRequest(value), 'INVALID_RECONCILIATION_REVIEW_REQUEST', label);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v40-history-reconciliation-review-'));
try {
  equal(Bridge.VERSION, '4.0.0', 'bridge version is exact');
  equal(Bridge.STATUS, 'TEST', 'bridge remains TEST');
  equal(Bridge.REVIEW_KIND, 'model-shadow-transition-settlement-history-reconciliation', 'Review Inbox kind is exact');
  equal(Bridge.REVIEW_ROUTE, '/api/reviews', 'existing Review Inbox route is declared');
  equal(Bridge.REVIEW_HEADER_NAME + ':' + Bridge.REVIEW_HEADER_VALUE, 'x-axm-review:explicit-submit', 'explicit submission header is declared');
  throwsCode(() => Bridge.buildReviewRequest({}), 'INVALID_REVIEW_REQUEST_INPUT', 'closed input rejects missing fields');
  throwsCode(() => Bridge.buildReviewRequest({ requestId:'x', generatedAt:'2026-08-21T00:00:00.000Z', requiredSeats:1, observationInput:{}, observationReceipt:{}, extra:true }), 'INVALID_REVIEW_REQUEST_INPUT', 'closed input rejects extra fields');

  const scenario = Fixture.buildScenario(tempRoot);
  const left = Fixture.startLane(tempRoot, 'review-left', scenario.sourceAOptions, 'v40-review-left');
  const right = Fixture.startLane(tempRoot, 'review-right', scenario.sourceBOptions, 'v40-review-right');
  Fixture.appendExact(left, scenario.entryAInput, scenario.entryA, 'review-left');
  Fixture.appendExact(right, scenario.entryBInput, scenario.entryB, 'review-right');
  const latestAt = Date.parse(left.latestAt) > Date.parse(right.latestAt) ? left.latestAt : right.latestAt;
  const observationInput = Fixture.pairInput(left.serviceOptions, right.serviceOptions, 'review-divergence', latestAt);
  const observationReceipt = V39.buildObservation(copy(observationInput));
  equal(observationReceipt.classification, 'COMPLETE_HISTORY_DIVERGES', 'fixture is an admitted complete-history divergence');
  equal(observationReceipt.comparison.earliestDivergence.eventIndex, 1, 'fixture diverges at its first normalized event');

  const input = {
    requestId: 'v40-history-reconciliation-review:exact',
    generatedAt: Fixture.add(observationReceipt.observedAt, 1000),
    requiredSeats: 2,
    observationInput: copy(observationInput),
    observationReceipt: copy(observationReceipt)
  };
  const rootsBefore = [treeDigest(left.stateRoot), treeDigest(right.stateRoot), treeDigest(scenario.sourceARoot)];
  const request = Bridge.buildReviewRequest(copy(input));
  equal([treeDigest(left.stateRoot), treeDigest(right.stateRoot), treeDigest(scenario.sourceARoot)], rootsBefore, 'exact rebuild writes no source or settlement bytes');
  equal(request.schema, Bridge.REQUEST_SCHEMA, 'request schema is exact');
  equal(request.status, 'TEST', 'request status remains TEST');
  equal(request.mode, Bridge.MODE, 'request mode names unauthenticated data-only boundary');
  equal(request.state, Bridge.REQUEST_STATE, 'request remains ready for explicit host submission');
  equal(request.nextGate, Bridge.NEXT_GATE, 'next gate requires authenticated review and separate reconciliation authority');
  equal(request.observationRef, { id:observationReceipt.observationId, schema:V39.RECEIPT_SCHEMA, sha256:observationReceipt.observationDigest }, 'request binds exact v3.9 observation');

  const artifact = request.reviewArtifact;
  equal(artifact.schema, Bridge.ARTIFACT_SCHEMA, 'artifact schema is exact');
  equal(artifact.classification, 'COMPLETE_HISTORY_DIVERGENCE_RECONCILIATION_REVIEW_ARTIFACT', 'artifact classification is reconciliation review only');
  equal(artifact.leftHistory.commitmentRef.sha256, observationReceipt.left.historyCommitment.historyCommitmentDigest, 'artifact preserves left complete-history commitment digest');
  equal(artifact.rightHistory.commitmentRef.sha256, observationReceipt.right.historyCommitment.historyCommitmentDigest, 'artifact preserves right complete-history commitment digest');
  equal(artifact.leftHistory.snapshotRef, observationReceipt.left.snapshotRef, 'artifact preserves left snapshot reference');
  equal(artifact.rightHistory.snapshotRef, observationReceipt.right.snapshotRef, 'artifact preserves right snapshot reference');
  equal(artifact.leftHistory.eventCount, observationReceipt.left.historyCommitment.eventCount, 'artifact preserves left event count');
  equal(artifact.rightHistory.eventCount, observationReceipt.right.historyCommitment.eventCount, 'artifact preserves right event count');
  equal(artifact.comparison.commonNormalizedEventPrefixLength, observationReceipt.comparison.commonNormalizedEventPrefixLength, 'artifact preserves common normalized prefix length');
  equal(artifact.comparison.earliestDivergence, observationReceipt.comparison.earliestDivergence, 'artifact preserves earliest divergent event');
  equal(artifact.decision.bestAction, observationReceipt.decision.bestAction, 'artifact preserves v3.9 best action');
  check(artifact.decision.reviewRequired && artifact.decision.holdRequired && artifact.decision.reconciliationRequired, 'artifact requires held reconciliation review');
  equal(artifact.decision.autonomousActionCount, 0, 'artifact authorizes no autonomous action');
  equal(artifact.artifactDigest, Bridge.sha256(copy(Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== 'artifactDigest')))), 'artifact self digest is canonical');

  const candidate = request.reviewCandidate;
  equal(candidate.kind, Bridge.REVIEW_KIND, 'candidate uses dedicated reconciliation kind');
  equal(candidate.artifactDigest, artifact.artifactDigest.slice(7), 'candidate binds raw exact artifact digest');
  equal(candidate.requiredSeats, 2, 'candidate preserves bounded requested seats');
  equal(candidate.action.schema, Bridge.ACTION_SCHEMA, 'candidate action schema is exact');
  equal(candidate.action.artifact, artifact, 'candidate embeds exact minimized artifact');
  ['automaticApply','reconciliationOnApproval','executionOnApproval','adoptionOnApproval','promotionAuthority','mergeAuthority','canonAuthority'].forEach(key => equal(candidate.action[key], false, 'candidate keeps ' + key + ' false'));
  check(candidate.summary.includes('approval would not reconcile'), 'candidate summary refuses approval-as-reconciliation');
  equal(request.submission, {
    method:'POST', route:'/api/reviews', requiredHeader:{ name:'x-axm-review', value:'explicit-submit' },
    bodyRef:{ id:input.requestId, schema:'axm.review-candidate/v1', sha256:Bridge.sha256(candidate) }, explicitHostMutationRequired:true
  }, 'submission is a descriptor requiring explicit host mutation');
  check(request.truth.v39ObservationExactRebuilt && request.truth.completeHistoryDivergenceRequired, 'request truth records exact divergent upstream evidence');
  check(!request.truth.reviewSubmittedByModule && !request.truth.reviewItemObserved, 'request truth denies submission and receiver observation');
  check(!request.truth.actualHumanReviewProven && !request.truth.reviewActorAuthenticated, 'request truth denies human review and identity');
  check(!request.truth.reconciliationPerformed && !request.truth.divergenceResolved, 'request truth denies reconciliation and resolution');
  check(!request.truth.executionAuthorized && !request.truth.automaticCanon, 'request truth denies execution and CANON authority');
  check(Bridge.validateArtifact(copy(artifact)).artifactDigest === artifact.artifactDigest, 'exact artifact validates');
  check(Bridge.validateRequest(copy(request)).requestDigest === request.requestDigest, 'exact request validates');
  check(Bridge.verifyReviewRequest(copy(input), copy(request)).pass, 'exact request rebuilds from current caller roots');

  const serialized = Bridge.stableStringify(request);
  check(!serialized.includes(left.stateRoot) && !serialized.includes(right.stateRoot) && !serialized.includes(scenario.sourceARoot), 'public request omits configured root paths');
  check(!serialized.includes('serviceOptions') && !serialized.includes('historyCommitmentRefs'), 'public request omits caller service packages and capture arrays');
  check(!serialized.includes('rawModelOutput') && !serialized.includes('privateContext'), 'public request embeds no raw output or private context fields');
  check(artifact.truth.completeV39ObservationCopied === false && artifact.truth.completeStoredHistoryCopied === false, 'artifact truth denies copying complete observation or history');
  check(!serialized.includes(observationReceipt.state), 'public request does not copy the full upstream observation state');

  const reviewRoot = path.join(tempRoot, 'synthetic-review-state'); fs.mkdirSync(reviewRoot);
  const service = ReviewService.create({ stateRoot: reviewRoot });
  const item = service.submit(copy(candidate));
  equal(item.schema, 'axm.review-item/v1', 'candidate is compatible with synthetic ReviewService');
  equal(item.kind, Bridge.REVIEW_KIND, 'synthetic ReviewService preserves reconciliation kind');
  equal(item.state, 'PENDING', 'synthetic submission begins pending');
  equal(item.artifactDigest, candidate.artifactDigest, 'synthetic item preserves exact artifact digest');
  equal(item.action, candidate.action, 'synthetic item preserves exact action and artifact');
  equal(item.votes.length, 0, 'synthetic pending item has no votes');
  equal(item.discussion.length, 0, 'synthetic pending item has no discussion');
  equal(service.get(item.id), item, 'synthetic service reload presents the exact item');
  equal(service.submit(copy(candidate)), item, 'duplicate exact candidate is idempotent in synthetic receiver');
  check(request.truth.reviewSubmittedByModule === false, 'synthetic harness mutation does not inflate module submission truth');

  const matchingInput = Fixture.pairInput(left.serviceOptions, left.serviceOptions, 'matching', left.latestAt);
  const matchingReceipt = V39.buildObservation(copy(matchingInput));
  throwsCode(() => Bridge.buildReviewRequest({ requestId:'matching', generatedAt:Fixture.add(matchingReceipt.observedAt,1000), requiredSeats:1, observationInput:matchingInput, observationReceipt:matchingReceipt }), 'V39_OBSERVATION_NOT_DIVERGENT', 'exact replay cannot enter reconciliation review');
  const alteredReceipt = copy(observationReceipt); alteredReceipt.comparison.commonNormalizedEventPrefixLength = 1;
  throwsCode(() => Bridge.buildReviewRequest({ ...copy(input), observationReceipt:alteredReceipt }), 'V39_OBSERVATION_INVALID', 'altered v3.9 receipt fails exact rebuild');
  throwsCode(() => Bridge.buildReviewRequest({ ...copy(input), generatedAt:Fixture.add(observationReceipt.observedAt, -1000) }), 'REVIEW_REQUEST_TIME_INVALID', 'request cannot predate observation');
  throwsCode(() => Bridge.buildReviewRequest({ ...copy(input), requiredSeats:0 }), 'INVALID_REVIEW_REQUEST_INPUT', 'zero review seats fail closed');
  throwsCode(() => Bridge.buildReviewRequest({ ...copy(input), requiredSeats:11 }), 'INVALID_REVIEW_REQUEST_INPUT', 'more than ten review seats fail closed');

  expectInvalidArtifact(artifact, value => { value.status = 'CANON'; }, 'artifact status inflation fails');
  expectInvalidArtifact(artifact, value => { value.leftHistory.commitmentRef.sha256 = 'sha256:' + '0'.repeat(64); }, 'left commitment drift fails');
  expectInvalidArtifact(artifact, value => { value.rightHistory.eventCount += 1; }, 'right event count drift fails');
  expectInvalidArtifact(artifact, value => { value.comparison.commonNormalizedEventPrefixLength += 1; }, 'prefix and divergence mismatch fails');
  expectInvalidArtifact(artifact, value => { value.comparison.earliestDivergence.leftContentDigest = value.comparison.earliestDivergence.rightContentDigest; value.comparison.earliestDivergence.leftKind = value.comparison.earliestDivergence.rightKind; value.comparison.earliestDivergence.leftSequence = value.comparison.earliestDivergence.rightSequence; }, 'matching claimed divergent events fail');
  expectInvalidArtifact(artifact, value => { value.decision.reconciliationRequired = false; }, 'reconciliation requirement drift fails');
  expectInvalidArtifact(artifact, value => { value.truth.actualHumanReviewProven = true; }, 'human review truth inflation fails');
  expectInvalidArtifact(artifact, value => { value.truth.reconciliationPerformed = true; }, 'reconciliation truth inflation fails');
  expectInvalidArtifact(artifact, value => { value.truth.automaticCanon = true; }, 'CANON truth inflation fails');
  expectInvalidArtifact(artifact, value => { value.extra = true; }, 'artifact extra field fails');
  expectInvalidArtifact(artifact, value => { value.artifactDigest = 'sha256:' + 'f'.repeat(64); }, 'artifact digest drift fails');
  expectInvalidArtifact(artifact, value => { value.pad = 'x'.repeat(Bridge.MAX_ARTIFACT_CANONICAL_BYTES); }, 'oversized artifact fails');

  expectInvalidRequest(request, value => { value.reviewCandidate.action.automaticApply = true; }, 'automatic apply inflation fails');
  expectInvalidRequest(request, value => { value.reviewCandidate.action.reconciliationOnApproval = true; }, 'approval-as-reconciliation inflation fails');
  expectInvalidRequest(request, value => { value.reviewCandidate.action.executionOnApproval = true; }, 'execution authority inflation fails');
  expectInvalidRequest(request, value => { value.reviewCandidate.requiredSeats = 11; }, 'candidate seat inflation fails');
  expectInvalidRequest(request, value => { value.reviewCandidate.artifactDigest = '0'.repeat(64); }, 'candidate artifact digest drift fails');
  expectInvalidRequest(request, value => { value.submission.route = '/other'; }, 'submission route drift fails');
  expectInvalidRequest(request, value => { value.submission.explicitHostMutationRequired = false; }, 'host mutation requirement drift fails');
  expectInvalidRequest(request, value => { value.truth.reviewSubmittedByModule = true; }, 'submission truth inflation fails');
  expectInvalidRequest(request, value => { value.requestDigest = 'sha256:' + '0'.repeat(64); }, 'request digest drift fails');
  const tamperedForVerify = copy(request); tamperedForVerify.reviewArtifact.generatedAt = Fixture.add(request.generatedAt, 1000);
  check(!Bridge.verifyReviewRequest(copy(input), tamperedForVerify).pass, 'tampered request fails exact rebuild verification');

  const packageFile = path.join(tempRoot, 'fresh-process-package.json'); canonicalWrite(packageFile, { input });
  const childRequest = runChild(packageFile);
  equal(childRequest, request, 'fresh process exact-rebuilds identical request');

  const artifactSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-artifact.schema.json'), 'utf8'));
  const requestSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-request.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  check(artifactSchema.additionalProperties === false && requestSchema.additionalProperties === false, 'public schemas close their top-level shapes');
  equal(artifactSchema.properties.status.const, 'TEST', 'artifact schema fixes TEST status');
  equal(requestSchema.properties.reviewCandidate.properties.action.properties.reconciliationOnApproval.const, false, 'request schema fixes approval-as-reconciliation false');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
  equal(contract.merge_gate, 'Mike Tobi / AXM', 'contract preserves Mike Tobi / AXM merge gate');
  check(contract.boundaries.refuses.includes('review-approval-as-history-reconciliation-or-divergence-resolution'), 'contract refuses approval-as-reconciliation');
  check(contract.boundaries.refuses.includes('pairwise-history-evidence-as-independent-custody-globality-or-protected-monotonic-state'), 'contract refuses custody and globality inflation');

  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request.js'), 'utf8');
  check(source.includes("require('../model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/"), 'runtime composes exact v3.9 verifier');
  check(!source.includes('review-service') && !source.includes('operations-api'), 'runtime does not import Review Inbox service');
  check(!/\bfetch\s*\(|https?\.|XMLHttpRequest/.test(source), 'runtime opens no network surface');
  check(!/writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync/.test(source), 'runtime opens no filesystem write surface');
  verifiedRemove(reviewRoot, tempRoot);
  equal(fs.existsSync(reviewRoot), false, 'synthetic ReviewService state is removed');
  console.log('RESULT ' + assertions + ' focused assertions passed');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
}
