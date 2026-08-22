#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const ReviewService = require('../operations/review-service');
const Bridge = require('./model-shadow-retention-audit-review-request');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function expectCode(action, code, label) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  check(caught instanceof Bridge.RetentionAuditReviewRequestError, label + ' returns typed v2.9 error');
  equal(caught && caught.code, code, label);
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target), resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function treeDigest(root) {
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name), child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { entries.push({ path: child, type: 'directory' }); walk(absolute, child); }
      else entries.push({ path: child, type: 'file', sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
    });
  }
  walk(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
function writePackage(parent, name, value) {
  const file = path.join(parent, name + '.json');
  fs.writeFileSync(file, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return file;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024
  });
  return { status: result.status, stderr: result.stderr, value: JSON.parse(result.stdout || '{}') };
}
function rehashArtifact(artifact) {
  const value = copy(artifact); delete value.artifactDigest; artifact.artifactDigest = Bridge.sha256(value); return artifact;
}
function rehashRequest(request) {
  const value = copy(request); delete value.requestDigest; request.requestDigest = Bridge.sha256(value); return request;
}
function rehashHandoff(handoff) {
  const value = copy(handoff); delete value.handoffDigest; handoff.handoffDigest = Bridge.sha256(value); return handoff;
}
function allKeys(value, found) {
  const result = found || new Set();
  if (Array.isArray(value)) value.forEach(item => allKeys(item, result));
  else if (value && typeof value === 'object') Object.keys(value).forEach(key => { result.add(key); allKeys(value[key], result); });
  return result;
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v29-retention-audit-review-'));
  try {
    const fixture = Fixture.build(tempRoot, 'primary');
    equal(fixture.exactObservation.classification, 'NONHOLD_RETENTION_AUDIT_OBSERVATION', 'fixture provides one non-held v2.8 observation');
    equal(fixture.heldObservation.classification, 'HELD_RETENTION_AUDIT_OBSERVATION', 'fixture provides one held v2.8 observation');
    equal(fixture.heldObservation.log.sequence, 2, 'held fixture is the second exact persisted observation');
    equal(fixture.observationService.verifyPersisted(fixture.heldObservation).pass, true, 'held fixture exact-reloads through v2.8 public verifier');

    equal(Bridge.VERSION, '2.9.0', 'version is exact');
    equal(Bridge.STATUS, 'TEST', 'status remains TEST');
    equal(Bridge.MODE, 'DATA_ONLY_HELD_RETENTION_AUDIT_REVIEW_REQUEST_UNAUTHENTICATED', 'mode states the unauthenticated data-only boundary');
    equal(Bridge.REVIEW_ROUTE, '/api/reviews', 'host review route is exact');
    equal(Bridge.REVIEW_HEADER_NAME, 'x-axm-review', 'explicit host header name is exact');
    equal(Bridge.REVIEW_HEADER_VALUE, 'explicit-submit', 'explicit host header value is exact');
    equal(Bridge.MAX_REQUEST_INPUT_CANONICAL_BYTES, 8388608, 'request input is bounded at eight MiB');
    equal(Bridge.MAX_HANDOFF_INPUT_CANONICAL_BYTES, 25165824, 'handoff input is bounded at twenty-four MiB');
    equal(Bridge.MAX_ARTIFACT_CANONICAL_BYTES, 1048576, 'review artifact is bounded at one MiB');
    equal(Bridge.MAX_REQUEST_CANONICAL_BYTES, 2097152, 'review request is bounded at two MiB');
    equal(Bridge.MAX_HANDOFF_CANONICAL_BYTES, 4194304, 'pending handoff is bounded at four MiB');

    const requestInput = Fixture.requestInput(fixture);
    const observationTreeBefore = treeDigest(fixture.observationRoot);
    const sourceTreeBefore = treeDigest(fixture.world.absentRoot);
    const retentionTreeBefore = treeDigest(fixture.world.retentionRoot);
    const request = Bridge.buildReviewRequest(copy(requestInput));
    equal(treeDigest(fixture.observationRoot), observationTreeBefore, 'request build leaves durable v2.8 observation tree unchanged');
    equal(treeDigest(fixture.world.absentRoot), sourceTreeBefore, 'request build leaves compared source tree unchanged');
    equal(treeDigest(fixture.world.retentionRoot), retentionTreeBefore, 'request build leaves retention ledger tree unchanged');
    equal(request.schema, Bridge.REQUEST_SCHEMA, 'request schema is exact');
    equal(request.status, 'TEST', 'request status remains TEST');
    equal(request.state, Bridge.REQUEST_STATE, 'request stops before explicit host submission');
    equal(request.observationRef.id, fixture.heldObservation.observationId, 'request binds held observation id');
    equal(request.observationRef.sha256, fixture.heldObservation.observationDigest, 'request binds held observation digest');
    equal(request.reviewArtifact.schema, Bridge.ARTIFACT_SCHEMA, 'artifact schema is exact');
    equal(request.reviewArtifact.classification, 'HELD_RETENTION_AUDIT_REVIEW_ARTIFACT', 'artifact remains held');
    equal(request.reviewArtifact.v27Classification, 'OBSERVED_LEDGER_ABSENT', 'artifact preserves exact held v2.7 classification');
    equal(request.reviewArtifact.v27AuditRef.sha256, fixture.world.absentAudit.auditDigest, 'artifact binds exact v2.7 audit digest');
    equal(request.reviewArtifact.observationSequence, 2, 'artifact binds observation sequence');
    const artifactWithoutDigest = copy(request.reviewArtifact); delete artifactWithoutDigest.artifactDigest;
    equal(request.reviewArtifact.artifactDigest, Bridge.sha256(artifactWithoutDigest), 'artifact digest covers the minimized artifact');
    equal(request.reviewCandidate.artifactDigest, request.reviewArtifact.artifactDigest.slice(7), 'candidate uses exact raw artifact digest');
    equal(request.reviewCandidate.action.artifact, request.reviewArtifact, 'candidate action embeds exact artifact');
    equal(request.reviewCandidate.action.automaticApply, false, 'candidate action cannot auto-apply');
    equal(request.reviewCandidate.action.executionOnApproval, false, 'candidate approval cannot execute');
    equal(request.reviewCandidate.action.holdResolutionOnApproval, false, 'candidate approval cannot resolve hold');
    equal(request.reviewCandidate.action.adoptionOnApproval, false, 'candidate approval cannot adopt');
    equal(request.reviewCandidate.action.promotionAuthority, false, 'candidate carries no promotion authority');
    equal(request.reviewCandidate.action.mergeAuthority, false, 'candidate carries no merge authority');
    equal(request.reviewCandidate.action.canonAuthority, false, 'candidate carries no canon authority');
    equal(request.submission.method, 'POST', 'submission declaration uses POST');
    equal(request.submission.route, '/api/reviews', 'submission declaration names host route');
    equal(request.submission.requiredHeader, { name: 'x-axm-review', value: 'explicit-submit' }, 'submission declaration names explicit host header');
    equal(request.submission.explicitHostMutationRequired, true, 'submission declaration requires host mutation boundary');
    equal(request.submission.bodyRef.sha256, Bridge.sha256(request.reviewCandidate), 'submission body reference binds exact candidate');
    equal(request.truth.reviewSubmittedByModule, false, 'request reports no submission');
    equal(request.truth.reviewItemObserved, false, 'request reports no receiver item');
    equal(request.truth.hostMutationAuthorizationProven, false, 'request reports no proven host authorization');
    equal(request.truth.actualHumanReviewProven, false, 'request reports no actual human review');
    equal(request.truth.reviewActorAuthenticated, false, 'request reports no authenticated reviewer');
    equal(request.truth.holdResolved, false, 'request preserves the hold');
    equal(request.truth.networkInvoked, false, 'request invokes no network');
    equal(request.truth.providerInvoked, false, 'request invokes no provider');
    equal(request.truth.evaluationPerformed, false, 'request performs no evaluation');
    equal(request.truth.executionAuthorized, false, 'request grants no execution authority');
    equal(request.truth.automaticCanon, false, 'request performs no canonization');
    equal(Bridge.validateArtifact(request.reviewArtifact), request.reviewArtifact, 'artifact passes closed runtime validation');
    equal(Bridge.validateRequest(request), request, 'request passes closed runtime validation');
    equal(Bridge.verifyReviewRequest(requestInput, request).pass, true, 'request exact-rebuilds from persisted held observation');
    equal(Bridge.verifyReviewRequest(requestInput, request).rebuilt, request, 'request exact rebuild is byte-structurally identical');

    const nonHeldInput = Fixture.requestInput(fixture, { observationSequence: 1, observation: fixture.exactObservation, requestId: 'v29-review-request:non-held' });
    expectCode(() => Bridge.buildReviewRequest(nonHeldInput), 'REVIEW_OBSERVATION_NOT_HELD', 'non-held observation is refused');
    const wrongSequence = Fixture.requestInput(fixture, { observationSequence: 1 });
    expectCode(() => Bridge.buildReviewRequest(wrongSequence), 'REVIEW_OBSERVATION_SEQUENCE_MISMATCH', 'mismatched observation sequence is refused');
    const alteredObservation = Fixture.requestInput(fixture);
    alteredObservation.observation.observationDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => Bridge.buildReviewRequest(alteredObservation), 'REVIEW_OBSERVATION_INVALID', 'altered observation receipt is refused');
    const wrongRoot = Fixture.requestInput(fixture);
    wrongRoot.observationServiceOptions.stateRoot = path.join(tempRoot, 'missing-observation-root');
    expectCode(() => Bridge.buildReviewRequest(wrongRoot), 'REVIEW_OBSERVATION_INVALID', 'missing persisted observation namespace is refused');
    const earlyRequest = Fixture.requestInput(fixture, { generatedAt: '2026-08-20T16:32:50.999Z' });
    expectCode(() => Bridge.buildReviewRequest(earlyRequest), 'REVIEW_REQUEST_TIME_INVALID', 'request cannot predate held observation');
    const badSeats = Fixture.requestInput(fixture, { requiredSeats: 0 });
    expectCode(() => Bridge.buildReviewRequest(badSeats), 'INVALID_REVIEW_REQUEST_INPUT', 'zero review seats are refused');
    const extraInput = Fixture.requestInput(fixture); extraInput.unexpected = true;
    expectCode(() => Bridge.buildReviewRequest(extraInput), 'INVALID_REVIEW_REQUEST_INPUT', 'extra request input fields are refused');
    const hugeInput = Fixture.requestInput(fixture, { requestId: 'x'.repeat(Bridge.MAX_REQUEST_INPUT_CANONICAL_BYTES) });
    expectCode(() => Bridge.buildReviewRequest(hugeInput), 'REVIEW_REQUEST_INPUT_TOO_LARGE', 'oversized request input is refused before processing');

    const artifactTruthDrift = copy(request.reviewArtifact);
    artifactTruthDrift.truth.reviewSubmitted = true; rehashArtifact(artifactTruthDrift);
    expectCode(() => Bridge.validateArtifact(artifactTruthDrift), 'INVALID_REVIEW_ARTIFACT', 'self-redigested submitted truth is refused');
    const artifactClassificationDrift = copy(request.reviewArtifact);
    artifactClassificationDrift.v27Classification = 'EXACT_HISTORY_MATCH'; rehashArtifact(artifactClassificationDrift);
    expectCode(() => Bridge.validateArtifact(artifactClassificationDrift), 'INVALID_REVIEW_ARTIFACT', 'self-redigested non-held artifact classification is refused');
    const artifactExtra = copy(request.reviewArtifact); artifactExtra.fullObservation = fixture.heldObservation; rehashArtifact(artifactExtra);
    expectCode(() => Bridge.validateArtifact(artifactExtra), 'INVALID_REVIEW_ARTIFACT', 'artifact with copied full observation is refused');
    const requestCandidateDrift = copy(request);
    requestCandidateDrift.reviewCandidate.summary += ' altered'; rehashRequest(requestCandidateDrift);
    expectCode(() => Bridge.validateRequest(requestCandidateDrift), 'INVALID_REVIEW_REQUEST', 'self-redigested candidate drift is refused');
    const requestRouteDrift = copy(request);
    requestRouteDrift.submission.route = '/bypass'; rehashRequest(requestRouteDrift);
    expectCode(() => Bridge.validateRequest(requestRouteDrift), 'INVALID_REVIEW_REQUEST', 'self-redigested host route drift is refused');
    const requestArtifactDrift = copy(request);
    requestArtifactDrift.reviewCandidate.action.artifact.truth.reviewSubmitted = true;
    rehashArtifact(requestArtifactDrift.reviewCandidate.action.artifact); rehashRequest(requestArtifactDrift);
    expectCode(() => Bridge.validateRequest(requestArtifactDrift), 'INVALID_REVIEW_REQUEST', 'candidate embedded artifact drift is refused');
    const requestDigestDrift = copy(request); requestDigestDrift.requestDigest = 'sha256:' + 'f'.repeat(64);
    expectCode(() => Bridge.validateRequest(requestDigestDrift), 'INVALID_REVIEW_REQUEST', 'request digest drift is refused');
    equal(Bridge.verifyReviewRequest(requestInput, requestCandidateDrift).pass, false, 'exact verifier reports candidate drift');

    const requestKeys = allKeys(request);
    ['stateRoot', 'retentionServiceOptions', 'auditInput', 'auditReceipt', 'v27Audit', 'observation', 'votes', 'discussion', 'actor', 'note', 'privateContext', 'rawModelOutput'].forEach(key => {
      equal(requestKeys.has(key), false, 'public request omits ' + key);
    });
    const publicRequest = Bridge.stableStringify(request);
    check(!publicRequest.includes(path.basename(tempRoot)), 'public request omits synthetic root identity');
    check(Buffer.byteLength(Bridge.stableStringify(request.reviewArtifact), 'utf8') < Bridge.MAX_ARTIFACT_CANONICAL_BYTES, 'artifact stays within declared bound');
    check(Buffer.byteLength(publicRequest, 'utf8') < Bridge.MAX_REQUEST_CANONICAL_BYTES, 'request stays within declared bound');

    const runtimeSource = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-request.js'), 'utf8');
    check(!/require\(['\"]fs['\"]\)/.test(runtimeSource), 'runtime imports no filesystem module');
    check(!/require\(['\"](?:https?|net|child_process)['\"]\)/.test(runtimeSource), 'runtime imports no network or child-process module');
    check(!runtimeSource.includes('review-service') && !runtimeSource.includes('ReviewService'), 'runtime does not import or invoke ReviewService');
    check(!runtimeSource.includes('operations-api'), 'runtime does not bypass the operations API boundary');
    check(!/\bfetch\s*\(/.test(runtimeSource), 'runtime performs no fetch call');
    check(runtimeSource.includes('reviewSubmittedByModule: false'), 'runtime fixes submission claim false');
    check(runtimeSource.includes('hostMutationAuthorizationProven: false'), 'runtime fixes host authorization claim false');
    check(runtimeSource.includes('receiverStateFileFsyncProven: false'), 'runtime fixes receiver file-fsync claim false');

    const reviewRoot = path.join(tempRoot, 'synthetic-review-state');
    fs.mkdirSync(reviewRoot);
    const reviewService = ReviewService.create({ stateRoot: reviewRoot });
    const initialItem = reviewService.submit(copy(request.reviewCandidate));
    equal(initialItem.schema, 'axm.review-item/v1', 'existing ReviewService accepts exact candidate shape');
    equal(initialItem.kind, Bridge.REVIEW_KIND, 'ReviewService preserves review kind');
    equal(initialItem.artifactDigest, request.reviewCandidate.artifactDigest, 'ReviewService preserves artifact digest');
    equal(initialItem.action, request.reviewCandidate.action, 'ReviewService preserves embedded artifact action');
    equal(initialItem.state, 'PENDING', 'ReviewService begins at pending');
    equal(initialItem.votes, [], 'initial ReviewService item has zero votes');
    equal(initialItem.discussion, [], 'initial ReviewService item has zero discussion');
    equal(initialItem.expiresAt, null, 'exact candidate creates no expiry');
    check(fs.existsSync(reviewService.stateFile), 'synthetic ReviewService writes its state file');
    check(fs.existsSync(reviewService.auditFile), 'synthetic ReviewService writes its audit evidence file');
    const childPackage = writePackage(tempRoot, 'receiver-reload', { stateRoot: reviewRoot, itemId: initialItem.id });
    const child = runChild(childPackage);
    equal(child.status, 0, 'fresh receiver process exits zero');
    equal(child.stderr, '', 'fresh receiver process emits no stderr');
    equal(child.value.item, initialItem, 'fresh receiver process reloads exact pending item');
    const directReload = ReviewService.create({ stateRoot: reviewRoot }).get(initialItem.id);
    equal(directReload, initialItem, 'new receiver service instance reloads exact pending item');

    const handoffInput = {
      handoffId: 'v29-pending-handoff:held-observation',
      generatedAt: new Date(Date.parse(initialItem.updatedAt) + 1000).toISOString(),
      requestInput: copy(requestInput),
      request: copy(request),
      initialReviewItem: copy(initialItem),
      reloadedReviewItem: copy(child.value.item)
    };
    const observationBeforeHandoff = treeDigest(fixture.observationRoot);
    const reviewBeforeHandoff = treeDigest(reviewRoot);
    const handoff = Bridge.buildPendingReviewHandoff(copy(handoffInput));
    equal(treeDigest(fixture.observationRoot), observationBeforeHandoff, 'handoff build leaves durable v2.8 observation tree unchanged');
    equal(treeDigest(reviewRoot), reviewBeforeHandoff, 'handoff build leaves Review Inbox tree unchanged');
    equal(handoff.schema, Bridge.HANDOFF_SCHEMA, 'handoff schema is exact');
    equal(handoff.state, Bridge.HANDOFF_STATE, 'handoff remains pending with host authorization unproven');
    equal(handoff.reviewRequestRef.sha256, request.requestDigest, 'handoff binds exact request digest');
    equal(handoff.reviewArtifact, request.reviewArtifact, 'handoff carries exact minimized artifact');
    equal(handoff.initialReviewItemRef, handoff.receiverReloadRef, 'initial and receiver item references match');
    equal(handoff.reviewItemEvidence.state, 'PENDING', 'handoff evidence remains pending');
    equal(handoff.reviewItemEvidence.voteCount, 0, 'handoff evidence has zero votes');
    equal(handoff.reviewItemEvidence.discussionCount, 0, 'handoff evidence has zero discussion');
    equal(handoff.truth.receiverReloadPresentationMatched, true, 'handoff records exact caller-presented reload match');
    equal(handoff.truth.independentReceiverProcessProven, false, 'handoff does not infer independent process provenance');
    equal(handoff.truth.receiverPersistenceClaimedByHandoff, false, 'handoff does not claim receiver persistence');
    equal(handoff.truth.reviewSubmittedByModule, false, 'handoff does not claim module submission');
    equal(handoff.truth.hostMutationAuthorizationProven, false, 'handoff does not claim host authorization');
    equal(handoff.truth.actualHumanReviewProven, false, 'handoff does not claim actual human review');
    equal(handoff.truth.reviewActorAuthenticated, false, 'handoff does not claim reviewer authentication');
    equal(handoff.truth.reviewDecisionRecorded, false, 'handoff does not claim review decision');
    equal(handoff.truth.holdResolved, false, 'handoff does not resolve hold');
    equal(handoff.truth.receiverStateFileFsyncProven, false, 'handoff does not claim receiver file fsync');
    equal(handoff.truth.directoryEntryOrHardwareDurabilityProven, false, 'handoff does not claim hardware durability');
    equal(handoff.truth.externalReceiverRetentionProven, false, 'handoff does not claim external receiver retention');
    equal(handoff.truth.executionAuthorized, false, 'handoff grants no execution authority');
    equal(handoff.truth.adoptionAuthorized, false, 'handoff grants no adoption authority');
    equal(handoff.truth.automaticPromotion, false, 'handoff performs no promotion');
    equal(handoff.truth.automaticMerge, false, 'handoff performs no merge');
    equal(handoff.truth.automaticCanon, false, 'handoff performs no canonization');
    equal(Bridge.validatePendingReviewHandoff(handoff), handoff, 'handoff passes closed runtime validation');
    equal(Bridge.verifyPendingReviewHandoff(handoffInput, handoff).pass, true, 'handoff exact-rebuilds from caller package');
    equal(Bridge.verifyPendingReviewHandoff(handoffInput, handoff).rebuilt, handoff, 'handoff exact rebuild is byte-structurally identical');

    const mismatchReload = copy(handoffInput); mismatchReload.reloadedReviewItem.updatedAt = new Date(Date.parse(initialItem.updatedAt) + 1).toISOString();
    expectCode(() => Bridge.buildPendingReviewHandoff(mismatchReload), 'PENDING_REVIEW_RELOAD_MISMATCH', 'initial and reloaded item mismatch is refused');
    const approvedItem = copy(handoffInput); approvedItem.reloadedReviewItem.state = 'APPROVED';
    expectCode(() => Bridge.buildPendingReviewHandoff(approvedItem), 'INVALID_PENDING_REVIEW_ITEM', 'approved receiver item is refused');
    const votedItem = copy(handoffInput); votedItem.reloadedReviewItem.votes.push({ actor: 'not-evidence' });
    expectCode(() => Bridge.buildPendingReviewHandoff(votedItem), 'INVALID_PENDING_REVIEW_ITEM', 'voted receiver item is refused');
    const discussedItem = copy(handoffInput); discussedItem.reloadedReviewItem.discussion.push({ body: 'not-evidence' });
    expectCode(() => Bridge.buildPendingReviewHandoff(discussedItem), 'INVALID_PENDING_REVIEW_ITEM', 'discussed receiver item is refused');
    const expiringItem = copy(handoffInput); expiringItem.reloadedReviewItem.expiresAt = '2026-08-27T16:33:00.000Z';
    expectCode(() => Bridge.buildPendingReviewHandoff(expiringItem), 'INVALID_PENDING_REVIEW_ITEM', 'expiring receiver item is refused');
    const alteredAction = copy(handoffInput); alteredAction.reloadedReviewItem.action.executionOnApproval = true;
    expectCode(() => Bridge.buildPendingReviewHandoff(alteredAction), 'INVALID_PENDING_REVIEW_ITEM', 'altered receiver action is refused');
    const earlyHandoff = copy(handoffInput); earlyHandoff.generatedAt = '2026-08-20T16:32:59.999Z';
    expectCode(() => Bridge.buildPendingReviewHandoff(earlyHandoff), 'PENDING_REVIEW_HANDOFF_TIME_INVALID', 'handoff before request is refused');
    const alteredRequestInput = copy(handoffInput); alteredRequestInput.requestInput.observationSequence = 1;
    expectCode(() => Bridge.buildPendingReviewHandoff(alteredRequestInput), 'PENDING_REVIEW_REQUEST_INVALID', 'handoff refuses request that no longer exact-rebuilds');
    const extraHandoffInput = copy(handoffInput); extraHandoffInput.unexpected = true;
    expectCode(() => Bridge.buildPendingReviewHandoff(extraHandoffInput), 'INVALID_PENDING_REVIEW_HANDOFF_INPUT', 'extra handoff input fields are refused');
    const handoffTruthDrift = copy(handoff); handoffTruthDrift.truth.actualHumanReviewProven = true; rehashHandoff(handoffTruthDrift);
    expectCode(() => Bridge.validatePendingReviewHandoff(handoffTruthDrift), 'INVALID_PENDING_REVIEW_HANDOFF', 'self-redigested human-review claim is refused');
    const handoffTimeDrift = copy(handoff); handoffTimeDrift.generatedAt = '2026-08-20T16:32:00.000Z'; rehashHandoff(handoffTimeDrift);
    expectCode(() => Bridge.validatePendingReviewHandoff(handoffTimeDrift), 'INVALID_PENDING_REVIEW_HANDOFF', 'self-redigested early handoff is refused');
    const handoffRequestRefDrift = copy(handoff); handoffRequestRefDrift.reviewRequestRef.id = 'another-request'; rehashHandoff(handoffRequestRefDrift);
    expectCode(() => Bridge.validatePendingReviewHandoff(handoffRequestRefDrift), 'INVALID_PENDING_REVIEW_HANDOFF', 'self-redigested request reference identity drift is refused');
    const handoffItemRefDrift = copy(handoff); handoffItemRefDrift.receiverReloadRef.sha256 = 'sha256:' + '0'.repeat(64); rehashHandoff(handoffItemRefDrift);
    expectCode(() => Bridge.validatePendingReviewHandoff(handoffItemRefDrift), 'INVALID_PENDING_REVIEW_HANDOFF', 'self-redigested receiver reference drift is refused');
    equal(Bridge.verifyPendingReviewHandoff(handoffInput, handoffTruthDrift).pass, false, 'handoff verifier reports public truth drift');

    const handoffKeys = allKeys(handoff);
    ['stateRoot', 'retentionServiceOptions', 'auditInput', 'auditReceipt', 'v27Audit', 'observation', 'votes', 'discussion', 'actor', 'note', 'privateContext', 'rawModelOutput'].forEach(key => {
      equal(handoffKeys.has(key), false, 'public handoff omits ' + key);
    });
    const publicHandoff = Bridge.stableStringify(handoff);
    check(!publicHandoff.includes(path.basename(tempRoot)), 'public handoff omits synthetic root identity');
    check(Buffer.byteLength(publicHandoff, 'utf8') < Bridge.MAX_HANDOFF_CANONICAL_BYTES, 'handoff stays within declared bound');

    const operationsUtilsSource = fs.readFileSync(path.join(__dirname, '..', 'operations', 'operations-utils.js'), 'utf8');
    check(!operationsUtilsSource.includes('fs.fsync') && !operationsUtilsSource.includes('fsyncSync'), 'receiver utility source provides no file-fsync evidence');
    check(operationsUtilsSource.includes('catch (_) { return clone(fallback); }'), 'receiver utility source falls back on unreadable JSON');

    const contract = require('./module.contract.json');
    equal(contract.version, 'v2.9', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status remains TEST');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'contract preserves human merge gate');
    equal(contract.permissions.length, 3, 'contract declares three narrowly scoped permission statements');
    check(contract.permissions.some(value => value.includes('no Review Inbox mutation')), 'contract requests no Review Inbox mutation permission');
    equal(contract.boundaries.writes.length, 1, 'contract declares the inherited transient lock write');
    check(contract.boundaries.writes[0].includes('transient operation lock') && contract.boundaries.writes[0].includes('no durable state'), 'contract distinguishes transient v2.8 lock from durable state');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    check(contract.boundaries.refuses.includes('automatic-review-inbox-submission'), 'contract refuses automatic Review Inbox submission');
    check(contract.boundaries.refuses.includes('declared-host-route-as-host-mutation-authorization-proof'), 'contract refuses route declaration as host authorization proof');
    check(contract.boundaries.refuses.includes('receiver-reload-presentation-as-independent-process-or-persistence-proof'), 'contract refuses caller reload as process or persistence proof');
    check(contract.boundaries.refuses.includes('review-approval-as-held-observation-resolution'), 'contract refuses approval as hold resolution');
    const contractCheck = ContractVerifier.validateContract(contract);
    equal(contractCheck.pass, true, 'module contract passes repository verifier');
    equal(contractCheck.errors, [], 'module contract verifier reports no errors');

    const schemas = ['review-artifact.schema.json', 'review-request.schema.json', 'pending-review-handoff.schema.json'];
    schemas.forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
      equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name + ' declares Draft 2020-12');
      equal(schema.additionalProperties, false, name + ' is closed at root');
    });
    const requestSchema = require('./review-request.schema.json');
    equal(requestSchema.properties.reviewArtifact.$ref, 'review-artifact.schema.json', 'request schema reuses artifact schema');
    equal(requestSchema.properties.reviewCandidate.properties.action.properties.artifact.$ref, 'review-artifact.schema.json', 'candidate action reuses artifact schema');
    equal(requestSchema.properties.truth.properties.reviewSubmittedByModule.const, false, 'request schema fixes module submission false');
    equal(requestSchema.properties.truth.properties.hostMutationAuthorizationProven.const, false, 'request schema fixes host authorization false');
    const handoffSchema = require('./pending-review-handoff.schema.json');
    equal(handoffSchema.properties.reviewArtifact.$ref, 'review-artifact.schema.json', 'handoff schema reuses artifact schema');
    equal(handoffSchema.properties.truth.properties.independentReceiverProcessProven.const, false, 'handoff schema fixes independent process proof false');
    equal(handoffSchema.properties.truth.properties.receiverStateFileFsyncProven.const, false, 'handoff schema fixes receiver fsync proof false');

    verifiedRemove(reviewRoot, tempRoot);
    equal(fs.existsSync(reviewRoot), false, 'synthetic ReviewService state is removed after bounded test');
    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
