#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ReviewService = require('../../shared/operations/review-service');
const V29 = require('../../shared/model-shadow-retention-audit-review-request/model-shadow-retention-audit-review-request');
const Fixture = require('../../shared/model-shadow-retention-audit-review-request/selftest-fixture');
const View = require('./retention-audit-review-view');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target), resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
async function rehashArtifact(item) {
  const artifact = item.action.artifact;
  const payload = copy(artifact); delete payload.artifactDigest;
  const hex = await View.sha256Hex(View.canonical(payload));
  artifact.artifactDigest = 'sha256:' + hex;
  item.artifactDigest = hex;
  return item;
}
async function expectHold(base, mutate, code, label) {
  const item = copy(base); mutate(item);
  const result = await View.inspect(item);
  equal(result.applies, true, label + ' remains a claimed typed item');
  equal(result.state, 'HOLD', label + ' state');
  equal(result.voteReady, false, label + ' is not vote-ready');
  equal(result.integrityCode, code, label + ' reason');
  return result;
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-retention-audit-review-view-'));
  try {
    const fixture = Fixture.build(tempRoot, 'view');
    const input = Fixture.requestInput(fixture, { requestId: 'v30-review-view:exact' });
    const request = V29.buildReviewRequest(copy(input));
    const reviewRoot = path.join(tempRoot, 'review-state'); fs.mkdirSync(reviewRoot);
    const service = ReviewService.create({ stateRoot: reviewRoot });
    const item = service.submit(copy(request.reviewCandidate));

    equal(View.VERSION, '3.0.0', 'renderer version is exact');
    equal(View.STATUS, 'TEST', 'renderer status remains TEST');
    equal(View.REVIEW_KIND, 'model-shadow-retention-audit-hold', 'renderer kind is exact');
    equal(View.ARTIFACT_SCHEMA, V29.ARTIFACT_SCHEMA, 'renderer consumes exact v2.9 artifact schema');
    equal(View.MAX_ARTIFACT_CANONICAL_BYTES, 1048576, 'renderer bounds artifacts at one MiB');

    const artifactPayload = copy(request.reviewArtifact); delete artifactPayload.artifactDigest;
    const expectedHex = await View.sha256Hex(View.canonical(artifactPayload));
    equal(expectedHex, request.reviewArtifact.artifactDigest.slice(7), 'browser-compatible canonical SHA-256 matches v2.9 artifact');
    const exact = await View.inspect(copy(item));
    equal(exact.applies, true, 'exact held item uses typed view');
    equal(exact.state, 'VERIFIED', 'exact held item verifies');
    equal(exact.voteReady, true, 'exact held item becomes vote-ready');
    equal(exact.integrityCode, 'EXACT_ARTIFACT_DIGEST_VERIFIED', 'exact integrity code is explicit');
    equal(exact.digest, item.artifactDigest, 'view binds full item digest');
    equal(exact.classification, request.reviewArtifact.v27Classification, 'view preserves held classification');
    equal(exact.bestAction, request.reviewArtifact.decision.bestAction, 'view preserves current best action');
    equal(exact.observation, request.reviewArtifact.observationRef, 'view preserves observation reference');
    equal(exact.audit, request.reviewArtifact.v27AuditRef, 'view preserves v2.7 audit reference');
    equal(exact.checkpoint, request.reviewArtifact.retentionSelection.checkpointRef, 'view preserves checkpoint reference');
    equal(exact.retentionStatus, request.reviewArtifact.retentionSelection.selectionStatus, 'view preserves retention selection state');

    const html = View.render(exact);
    check(html.includes('data-integrity-state="VERIFIED"'), 'verified HTML exposes typed integrity state');
    check(html.includes('EXACT DIGEST VERIFIED'), 'verified HTML names exact digest result');
    check(html.includes(exact.classification), 'verified HTML shows held classification');
    check(html.includes(exact.bestAction), 'verified HTML shows best action');
    check(html.includes(exact.digest), 'verified HTML shows full reviewed digest');
    check(html.includes(exact.observation.sha256), 'verified HTML shows observation digest');
    check(html.includes(exact.audit.sha256), 'verified HTML shows audit digest');
    check(html.includes(exact.checkpoint.sha256), 'verified HTML shows checkpoint digest');
    check(html.includes('Retention hold remains unresolved'), 'verified HTML preserves unresolved hold');
    check(html.includes('No execution, adoption, provider call, or evaluation'), 'verified HTML refuses execution and evaluation');
    check(html.includes('No permission grant, install, promotion, merge, Foundation mutation, or CANON'), 'verified HTML refuses consequential authority');
    check(html.includes('No authenticated submitter, reviewer identity, or actual human participation'), 'verified HTML refuses identity and human proof');
    check(html.includes('Raw exact-item JSON remains visible below'), 'verified HTML preserves raw evidence handoff');

    const generic = await View.inspect({ kind: 'proposal', artifactDigest: '0'.repeat(64) });
    equal(generic, { applies: false, state: 'GENERIC', voteReady: true, integrityCode: 'NOT_APPLICABLE' }, 'generic item remains outside typed renderer');
    equal(View.render(generic), '', 'generic item receives no typed HTML');

    await expectHold(item, value => { value.action.artifact.decision.bestAction = 'ALTERED_BUT_STATICALLY_VALID'; }, 'ARTIFACT_SELF_DIGEST_MISMATCH', 'artifact payload drift');
    await expectHold(item, value => { value.artifactDigest = '0'.repeat(64); }, 'ITEM_ARTIFACT_DIGEST_MISMATCH', 'Review Inbox item digest drift');
    await expectHold(item, value => { value.action.schema = 'wrong'; }, 'INVALID_V29_ARTIFACT', 'action schema drift');
    await expectHold(item, value => { value.action.type = 'wrong'; }, 'INVALID_V29_ARTIFACT', 'action type drift');
    await expectHold(item, value => { value.action.automaticApply = true; }, 'INVALID_V29_ARTIFACT', 'automatic apply inflation');
    await expectHold(item, value => { value.action.executionOnApproval = true; }, 'INVALID_V29_ARTIFACT', 'execution authority inflation');
    await expectHold(item, value => { value.action.holdResolutionOnApproval = true; }, 'INVALID_V29_ARTIFACT', 'hold-resolution inflation');
    await expectHold(item, value => { value.action.promotionAuthority = true; }, 'INVALID_V29_ARTIFACT', 'promotion authority inflation');
    await expectHold(item, value => { value.action.canonAuthority = true; }, 'INVALID_V29_ARTIFACT', 'CANON authority inflation');
    await expectHold(item, value => { value.action.extra = true; }, 'INVALID_V29_ARTIFACT', 'action extra field');
    await expectHold(item, value => { value.action.artifact.schema = 'wrong'; }, 'INVALID_V29_ARTIFACT', 'artifact schema drift');
    await expectHold(item, value => { value.action.artifact.version = '3.0.0'; }, 'INVALID_V29_ARTIFACT', 'artifact version drift');
    await expectHold(item, value => { value.action.artifact.status = 'CANON'; }, 'INVALID_V29_ARTIFACT', 'artifact status inflation');
    await expectHold(item, value => { value.action.artifact.mode = 'TRUSTED'; }, 'INVALID_V29_ARTIFACT', 'artifact mode inflation');
    await expectHold(item, value => { value.action.artifact.classification = 'NONHOLD'; }, 'INVALID_V29_ARTIFACT', 'held classification drift');
    await expectHold(item, value => { value.action.artifact.generatedAt = 'not-time'; }, 'INVALID_V29_ARTIFACT', 'artifact time drift');
    await expectHold(item, value => { value.action.artifact.observationRef.sha256 = 'sha256:' + 'Z'.repeat(64); }, 'INVALID_V29_ARTIFACT', 'observation digest syntax drift');
    await expectHold(item, value => { value.action.artifact.observationSequence = 0; }, 'INVALID_V29_ARTIFACT', 'observation sequence underflow');
    await expectHold(item, value => { value.action.artifact.v27Classification = 'EXACT_HISTORY_MATCH'; }, 'INVALID_V29_ARTIFACT', 'non-held v2.7 classification');
    await expectHold(item, value => { value.action.artifact.retentionSelection.selectionStatus = 'UNKNOWN'; }, 'INVALID_V29_ARTIFACT', 'retention selection drift');
    await expectHold(item, value => { value.action.artifact.decision.holdRequired = false; }, 'INVALID_V29_ARTIFACT', 'hold decision drift');
    await expectHold(item, value => { value.action.artifact.decision.autonomousActionCount = 1; }, 'INVALID_V29_ARTIFACT', 'autonomous action inflation');
    await expectHold(item, value => { value.action.artifact.truth.reviewSubmitted = true; }, 'INVALID_V29_ARTIFACT', 'submission truth inflation');
    await expectHold(item, value => { value.action.artifact.truth.hostMutationAuthorizationProven = true; }, 'INVALID_V29_ARTIFACT', 'host authorization truth inflation');
    await expectHold(item, value => { value.action.artifact.truth.actualHumanReviewProven = true; }, 'INVALID_V29_ARTIFACT', 'human review truth inflation');
    await expectHold(item, value => { value.action.artifact.truth.holdResolved = true; }, 'INVALID_V29_ARTIFACT', 'hold resolution truth inflation');
    await expectHold(item, value => { value.action.artifact.truth.automaticCanon = true; }, 'INVALID_V29_ARTIFACT', 'CANON truth inflation');
    await expectHold(item, value => { delete value.action.artifact.truth.privateContextEmbedded; }, 'INVALID_V29_ARTIFACT', 'missing minimization truth');
    await expectHold(item, value => { value.action.artifact.extra = true; }, 'INVALID_V29_ARTIFACT', 'artifact extra field');
    await expectHold(item, value => { value.action.artifact.artifactDigest = 'sha256:' + 'f'.repeat(64); }, 'ARTIFACT_SELF_DIGEST_MISMATCH', 'artifact self-digest drift');
    await expectHold(item, value => { value.action.artifact.pad = 'x'.repeat(View.MAX_ARTIFACT_CANONICAL_BYTES); }, 'OVERSIZED_ARTIFACT', 'oversized artifact');

    const held = await expectHold(item, value => { value.artifactDigest = '0'.repeat(64); }, 'ITEM_ARTIFACT_DIGEST_MISMATCH', 'rendered mismatch fixture');
    const heldHtml = View.render(held);
    check(heldHtml.includes('data-integrity-state="HOLD"'), 'held HTML exposes integrity hold');
    check(heldHtml.includes('Do not vote on this claimed held audit'), 'held HTML gives direct refusal guidance');
    check(heldHtml.includes('Voting is disabled'), 'held HTML states disabled vote');
    check(heldHtml.includes('ITEM_ARTIFACT_DIGEST_MISMATCH'), 'held HTML shows bounded reason code');
    check(!heldHtml.includes(item.action.artifact.decision.bestAction), 'held HTML does not present unverified artifact content as decision context');
    check(View.renderPending().includes('Voting stays disabled'), 'pending HTML states fail-closed gating');
    check(View.renderUnavailable().includes('Voting is disabled'), 'unavailable HTML states fail-closed gating');

    const injected = copy(item);
    injected.action.artifact.decision.bestAction = '<img src=x onerror="globalThis.compromised=true">';
    await rehashArtifact(injected);
    const injectedView = await View.inspect(injected);
    equal(injectedView.state, 'VERIFIED', 'self-consistent schema-valid hostile text reaches safe renderer test');
    const injectedHtml = View.render(injectedView);
    check(!injectedHtml.includes('<img'), 'renderer escapes hostile HTML element');
    check(!injectedHtml.includes('onerror="'), 'renderer escapes hostile attribute syntax');
    check(injectedHtml.includes('&lt;img'), 'renderer retains escaped evidence text');
    equal(View.escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;', 'HTML escaping covers all active punctuation');

    const source = fs.readFileSync(path.join(__dirname, 'retention-audit-review-view.js'), 'utf8');
    check(!/\bfetch\s*\(|XMLHttpRequest|AXMOps|O\.post|review-service|operations-api/.test(source), 'renderer opens no API or service route');
    check(!/require\(['"]fs['"]\)|require\(['"]child_process['"]\)|require\(['"]https?['"]\)/.test(source), 'renderer imports no filesystem process or network module');
    check(source.includes('holdResolutionOnApproval') && source.includes('artifact-approval') === false, 'renderer validates hold-resolution boundary without inventing approval semantics');

    verifiedRemove(reviewRoot, tempRoot);
    equal(fs.existsSync(reviewRoot), false, 'synthetic ReviewService state is removed');
    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
