#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ReviewService = require('../../shared/operations/review-service');
const Bridge = require('../../shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request/model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request');
const V39 = require('../../shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer');
const Fixture = require('../../shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/selftest-fixture');
const View = require('./history-reconciliation-review-view');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target), resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive:true, force:true });
}
async function rehashArtifact(item) {
  const artifact = item.action.artifact, payload = copy(artifact);
  delete payload.artifactDigest;
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v40-history-reconciliation-view-'));
  try {
    const scenario = Fixture.buildScenario(tempRoot);
    const left = Fixture.startLane(tempRoot, 'view-left', scenario.sourceAOptions, 'v40-view-left');
    const right = Fixture.startLane(tempRoot, 'view-right', scenario.sourceBOptions, 'v40-view-right');
    Fixture.appendExact(left, scenario.entryAInput, scenario.entryA, 'view-left');
    Fixture.appendExact(right, scenario.entryBInput, scenario.entryB, 'view-right');
    const latestAt = Date.parse(left.latestAt) > Date.parse(right.latestAt) ? left.latestAt : right.latestAt;
    const observationInput = Fixture.pairInput(left.serviceOptions, right.serviceOptions, 'view-divergence', latestAt);
    const observationReceipt = V39.buildObservation(copy(observationInput));
    const request = Bridge.buildReviewRequest({
      requestId:'v40-history-reconciliation-view:exact',
      generatedAt:Fixture.add(observationReceipt.observedAt, 1000),
      requiredSeats:2,
      observationInput:copy(observationInput),
      observationReceipt:copy(observationReceipt)
    });
    const reviewRoot = path.join(tempRoot, 'review-state'); fs.mkdirSync(reviewRoot);
    const service = ReviewService.create({ stateRoot:reviewRoot });
    const item = service.submit(copy(request.reviewCandidate));

    equal(View.VERSION, '4.0.0', 'renderer version is exact');
    equal(View.STATUS, 'TEST', 'renderer status remains TEST');
    equal(View.REVIEW_KIND, Bridge.REVIEW_KIND, 'renderer consumes exact reconciliation kind');
    equal(View.ARTIFACT_SCHEMA, Bridge.ARTIFACT_SCHEMA, 'renderer consumes exact v4.0 artifact schema');
    equal(View.MAX_ARTIFACT_CANONICAL_BYTES, 1048576, 'renderer bounds artifacts at one MiB');

    const artifactPayload = copy(request.reviewArtifact); delete artifactPayload.artifactDigest;
    const expectedHex = await View.sha256Hex(View.canonical(artifactPayload));
    equal(expectedHex, request.reviewArtifact.artifactDigest.slice(7), 'browser-compatible canonical SHA-256 matches v4.0 artifact');
    const exact = await View.inspect(copy(item));
    equal(exact.applies, true, 'exact divergence item uses typed view');
    equal(exact.state, 'VERIFIED', 'exact divergence artifact verifies');
    equal(exact.voteReady, true, 'exact divergence item becomes vote-ready');
    equal(exact.integrityCode, 'EXACT_ARTIFACT_DIGEST_VERIFIED', 'exact integrity code is explicit');
    equal(exact.digest, item.artifactDigest, 'view binds full Review Inbox item digest');
    equal(exact.bestAction, request.reviewArtifact.decision.bestAction, 'view preserves current best action');
    equal(exact.observation, request.reviewArtifact.observationRef, 'view preserves v3.9 observation reference');
    equal(exact.leftHistory, request.reviewArtifact.leftHistory, 'view preserves left history evidence');
    equal(exact.rightHistory, request.reviewArtifact.rightHistory, 'view preserves right history evidence');
    equal(exact.commonPrefixLength, request.reviewArtifact.comparison.commonNormalizedEventPrefixLength, 'view preserves common prefix length');
    equal(exact.divergence, request.reviewArtifact.comparison.earliestDivergence, 'view preserves earliest divergence');

    const html = View.render(exact);
    check(html.includes('data-integrity-state="VERIFIED"'), 'verified HTML exposes typed integrity state');
    check(html.includes('EXACT DIGEST VERIFIED'), 'verified HTML names exact digest result');
    check(html.includes('Transition-history divergence context'), 'verified HTML names bounded review context');
    check(html.includes(exact.bestAction), 'verified HTML shows best action');
    check(html.includes('Common normalized prefix'), 'verified HTML shows common prefix');
    check(html.includes('event ' + exact.divergence.eventIndex), 'verified HTML shows first divergence index');
    check(html.includes(exact.divergence.leftContentDigest), 'verified HTML shows left divergent digest');
    check(html.includes(exact.divergence.rightContentDigest), 'verified HTML shows right divergent digest');
    check(html.includes(exact.leftHistory.commitmentRef.sha256), 'verified HTML shows left history commitment');
    check(html.includes(exact.rightHistory.commitmentRef.sha256), 'verified HTML shows right history commitment');
    check(html.includes(exact.leftHistory.snapshotRef.sha256), 'verified HTML shows left snapshot digest');
    check(html.includes(exact.rightHistory.snapshotRef.sha256), 'verified HTML shows right snapshot digest');
    check(html.includes(exact.observation.sha256), 'verified HTML shows v3.9 observation digest');
    check(html.includes(exact.digest), 'verified HTML shows full reviewed digest');
    check(html.includes('history divergence remains unresolved'), 'verified HTML preserves unresolved divergence');
    check(html.includes('Approval is not reconciliation'), 'verified HTML refuses approval-as-reconciliation');
    check(html.includes('proves no independent custody, protected global history, or later currentness'), 'verified HTML refuses custody and globality inflation');
    check(html.includes('No execution, adoption, provider call, evaluation'), 'verified HTML refuses execution and evaluation');
    check(html.includes('No authenticated submitter, reviewer, steward identity, or actual human participation'), 'verified HTML refuses actor and human proof');
    check(html.includes('Raw exact-item JSON remains visible below'), 'verified HTML preserves raw evidence handoff');

    const generic = await View.inspect({ kind:'proposal', artifactDigest:'0'.repeat(64) });
    equal(generic, { applies:false, state:'GENERIC', voteReady:true, integrityCode:'NOT_APPLICABLE' }, 'generic item remains outside typed renderer');
    equal(View.render(generic), '', 'generic item receives no typed HTML');

    await expectHold(item, value => { value.action.artifact.generatedAt = Fixture.add(value.action.artifact.generatedAt, 1000); }, 'ARTIFACT_SELF_DIGEST_MISMATCH', 'artifact payload drift');
    await expectHold(item, value => { value.artifactDigest = '0'.repeat(64); }, 'ITEM_ARTIFACT_DIGEST_MISMATCH', 'Review Inbox item digest drift');
    await expectHold(item, value => { value.action.schema = 'wrong'; }, 'INVALID_V40_ARTIFACT', 'action schema drift');
    await expectHold(item, value => { value.action.type = 'wrong'; }, 'INVALID_V40_ARTIFACT', 'action type drift');
    await expectHold(item, value => { value.action.automaticApply = true; }, 'INVALID_V40_ARTIFACT', 'automatic apply inflation');
    await expectHold(item, value => { value.action.reconciliationOnApproval = true; }, 'INVALID_V40_ARTIFACT', 'approval-as-reconciliation inflation');
    await expectHold(item, value => { value.action.executionOnApproval = true; }, 'INVALID_V40_ARTIFACT', 'execution authority inflation');
    await expectHold(item, value => { value.action.promotionAuthority = true; }, 'INVALID_V40_ARTIFACT', 'promotion authority inflation');
    await expectHold(item, value => { value.action.canonAuthority = true; }, 'INVALID_V40_ARTIFACT', 'CANON authority inflation');
    await expectHold(item, value => { value.action.extra = true; }, 'INVALID_V40_ARTIFACT', 'action extra field');
    await expectHold(item, value => { value.action.artifact.schema = 'wrong'; }, 'INVALID_V40_ARTIFACT', 'artifact schema drift');
    await expectHold(item, value => { value.action.artifact.version = '4.1.0'; }, 'INVALID_V40_ARTIFACT', 'artifact version drift');
    await expectHold(item, value => { value.action.artifact.status = 'CANON'; }, 'INVALID_V40_ARTIFACT', 'artifact status inflation');
    await expectHold(item, value => { value.action.artifact.mode = 'TRUSTED'; }, 'INVALID_V40_ARTIFACT', 'artifact mode inflation');
    await expectHold(item, value => { value.action.artifact.classification = 'MATCH'; }, 'INVALID_V40_ARTIFACT', 'artifact classification drift');
    await expectHold(item, value => { value.action.artifact.observationRef.schema = 'wrong'; }, 'INVALID_V40_ARTIFACT', 'observation schema drift');
    await expectHold(item, value => { value.action.artifact.leftHistory.commitmentRef.schema = 'wrong'; }, 'INVALID_V40_ARTIFACT', 'left commitment schema drift');
    await expectHold(item, value => { value.action.artifact.leftHistory.heldSettlementCount = value.action.artifact.leftHistory.settlementCount + 1; }, 'INVALID_V40_ARTIFACT', 'left held count inflation');
    await expectHold(item, value => { value.action.artifact.rightHistory.eventCount += 1; }, 'INVALID_V40_ARTIFACT', 'right event count mismatch');
    await expectHold(item, value => { value.action.artifact.comparison.commonNormalizedEventPrefixLength += 1; }, 'INVALID_V40_ARTIFACT', 'prefix and divergence mismatch');
    await expectHold(item, value => { value.action.artifact.comparison.earliestDivergence.eventIndex = 0; }, 'INVALID_V40_ARTIFACT', 'divergence index underflow');
    await expectHold(item, value => { const d=value.action.artifact.comparison.earliestDivergence; d.leftKind=d.rightKind; d.leftSequence=d.rightSequence; d.leftContentDigest=d.rightContentDigest; }, 'INVALID_V40_ARTIFACT', 'matching claimed divergence');
    await expectHold(item, value => { value.action.artifact.decision.holdRequired = false; }, 'INVALID_V40_ARTIFACT', 'hold requirement drift');
    await expectHold(item, value => { value.action.artifact.decision.reconciliationRequired = false; }, 'INVALID_V40_ARTIFACT', 'reconciliation requirement drift');
    await expectHold(item, value => { value.action.artifact.decision.bestAction = 'AUTOMATE'; }, 'INVALID_V40_ARTIFACT', 'best action drift');
    await expectHold(item, value => { value.action.artifact.truth.actualHumanReviewProven = true; }, 'INVALID_V40_ARTIFACT', 'human review truth inflation');
    await expectHold(item, value => { value.action.artifact.truth.reconciliationPerformed = true; }, 'INVALID_V40_ARTIFACT', 'reconciliation truth inflation');
    await expectHold(item, value => { value.action.artifact.truth.globallyConsistentHistoryProven = true; }, 'INVALID_V40_ARTIFACT', 'global history truth inflation');
    await expectHold(item, value => { value.action.artifact.truth.automaticCanon = true; }, 'INVALID_V40_ARTIFACT', 'CANON truth inflation');
    await expectHold(item, value => { delete value.action.artifact.truth.sourceOrSettlementPathEmbedded; }, 'INVALID_V40_ARTIFACT', 'missing minimization truth');
    await expectHold(item, value => { value.action.artifact.extra = true; }, 'INVALID_V40_ARTIFACT', 'artifact extra field');
    await expectHold(item, value => { value.action.artifact.artifactDigest = 'sha256:' + 'f'.repeat(64); }, 'ARTIFACT_SELF_DIGEST_MISMATCH', 'artifact self-digest drift');
    await expectHold(item, value => { value.action.artifact.pad = 'x'.repeat(View.MAX_ARTIFACT_CANONICAL_BYTES); }, 'OVERSIZED_ARTIFACT', 'oversized artifact');

    const held = await expectHold(item, value => { value.artifactDigest = '0'.repeat(64); }, 'ITEM_ARTIFACT_DIGEST_MISMATCH', 'rendered mismatch fixture');
    const heldHtml = View.render(held);
    check(heldHtml.includes('data-integrity-state="HOLD"'), 'held HTML exposes integrity hold');
    check(heldHtml.includes('Do not vote on this claimed divergence'), 'held HTML gives direct refusal guidance');
    check(heldHtml.includes('Voting is disabled'), 'held HTML states disabled vote');
    check(heldHtml.includes('ITEM_ARTIFACT_DIGEST_MISMATCH'), 'held HTML shows bounded reason code');
    check(!heldHtml.includes(exact.bestAction), 'held HTML does not present unverified content as decision context');
    check(View.renderPending().includes('Voting stays disabled'), 'pending HTML states fail-closed gating');
    check(View.renderUnavailable().includes('Voting is disabled'), 'unavailable HTML states fail-closed gating');

    const injected = copy(item); injected.state = '<img src=x onerror="globalThis.compromised=true">';
    await rehashArtifact(injected);
    const injectedView = await View.inspect(injected);
    equal(injectedView.state, 'VERIFIED', 'schema-valid hostile item state reaches safe renderer test');
    const injectedHtml = View.render(injectedView);
    check(!injectedHtml.includes('<img'), 'renderer escapes hostile HTML element');
    check(!injectedHtml.includes('onerror="'), 'renderer escapes hostile attribute syntax');
    check(injectedHtml.includes('&lt;img'), 'renderer retains escaped evidence text');
    equal(View.escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;', 'HTML escaping covers all active punctuation');

    const source = fs.readFileSync(path.join(__dirname, 'history-reconciliation-review-view.js'), 'utf8');
    check(!/\bfetch\s*\(|XMLHttpRequest|AXMOps|O\.post|review-service|operations-api/.test(source), 'renderer opens no API or service route');
    check(!/require\(['"]fs['"]\)|require\(['"]child_process['"]\)|require\(['"]https?['"]\)/.test(source), 'renderer imports no filesystem process or network module');
    check(source.includes('reconciliationOnApproval') && source.includes('automaticApply'), 'renderer validates reconciliation and automatic-apply boundaries');

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
