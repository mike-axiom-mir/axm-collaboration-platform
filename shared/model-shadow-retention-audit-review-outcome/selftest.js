#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Outcome = require('./model-shadow-retention-audit-review-outcome');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target), resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function rehash(value) {
  const payload = copy(value); delete payload.outcomeDigest;
  value.outcomeDigest = Outcome.sha256(payload);
  return value;
}
function expectBuildError(base, mutate, pattern, label) {
  const value = copy(base); mutate(value);
  assert.throws(() => Outcome.buildOutcome(value), pattern, label);
  checks += 1; console.log('PASS ' + label);
}
function expectValidateError(base, mutate, pattern, label, shouldRehash) {
  const value = copy(base); mutate(value); if (shouldRehash) rehash(value);
  assert.throws(() => Outcome.validateOutcome(value), pattern, label);
  checks += 1; console.log('PASS ' + label);
}
function walkFiles(root, base, rows) {
  if (!fs.existsSync(root)) return rows;
  for (const name of fs.readdirSync(root).sort()) {
    const full = path.join(root, name), relative = path.relative(base, full).replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, base, rows);
    else rows.push({ path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') });
  }
  return rows;
}
function treeDigest(roots) {
  const rows = [];
  roots.forEach((root, index) => walkFiles(root, root, []).forEach(row => rows.push({ root: index, path: row.path, sha256: row.sha256 })));
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-retention-audit-review-outcome-'));
  try {
    const approvedFixture = Fixture.approved(tempRoot, 'approved');
    const heldFixture = Fixture.held(tempRoot, 'held');
    const rejectedFixture = Fixture.rejected(tempRoot, 'rejected');
    const stableRoots = [approvedFixture.pending.fixture.observationRoot, approvedFixture.pending.reviewRoot];
    const stableBefore = treeDigest(stableRoots);

    equal(Outcome.OUTCOME_SCHEMA, 'axm.model-shadow-retention-audit-review-outcome/v1', 'outcome schema identity is exact');
    equal(Outcome.VERSION, '3.1.0', 'outcome version is exact');
    equal(Outcome.STATUS, 'TEST', 'outcome status remains TEST');
    equal(Outcome.MODE, 'DATA_ONLY_CALLER_PRESENTED_REVIEW_OUTCOME_UNAUTHENTICATED', 'outcome mode admits caller-presented unauthenticated data');
    equal(Outcome.SUPPORTED_STATES, ['APPROVED', 'HOLD', 'REJECTED'], 'only three post-pending states are supported');
    equal(Outcome.MAX_INPUT_CANONICAL_BYTES, 33554432, 'input bound is exact');
    equal(Outcome.MAX_OUTCOME_CANONICAL_BYTES, 2097152, 'output bound is exact');
    equal(Outcome.MAX_VOTES, 10, 'vote bound is exact');

    const approved = Outcome.buildOutcome(copy(approvedFixture.input));
    const held = Outcome.buildOutcome(copy(heldFixture.input));
    const rejected = Outcome.buildOutcome(copy(rejectedFixture.input));
    equal(approved.state, 'EXACT_ARTIFACT_APPROVAL_OBSERVED_RETENTION_HOLD_UNRESOLVED', 'approved item maps to bounded approval observation');
    equal(held.state, 'EXACT_ARTIFACT_HOLD_OBSERVED_RETENTION_HOLD_UNRESOLVED', 'held item maps to bounded hold observation');
    equal(rejected.state, 'EXACT_ARTIFACT_REJECTION_OBSERVED_RETENTION_HOLD_UNRESOLVED', 'rejected item maps to bounded rejection observation');
    [approved, held, rejected].forEach((value, index) => {
      equal(Outcome.validateOutcome(value), value, 'runtime validates outcome ' + index);
      equal(Outcome.verifyOutcome([approvedFixture, heldFixture, rejectedFixture][index].input, value).pass, true, 'exact verifier rebuilds outcome ' + index);
      equal(value.outcomeDigest, Outcome.sha256((() => { const payload = copy(value); delete payload.outcomeDigest; return payload; })()), 'outcome self digest is exact ' + index);
      equal(value.truth.holdResolved, false, 'retention hold stays unresolved ' + index);
      equal(value.truth.executionAuthorized, false, 'execution remains unauthorized ' + index);
      equal(value.truth.automaticCanon, false, 'CANON remains automatic false ' + index);
    });

    equal(approved.reviewOutcome.state, 'APPROVED', 'approved evidence retains exact state');
    equal(approved.reviewOutcome.requiredSeats, 2, 'approved evidence retains required seats');
    equal(approved.reviewOutcome.voteCount, 2, 'approved evidence retains vote count');
    equal(approved.reviewOutcome.approvalCount, 2, 'approved evidence counts approvals');
    equal(approved.reviewOutcome.holdCount, 0, 'approved evidence has no hold vote');
    equal(approved.reviewOutcome.rejectionCount, 0, 'approved evidence has no rejection vote');
    equal(approved.reviewOutcome.declaredHumanVoteCount, 1, 'approved evidence counts declared-human vote');
    equal(approved.reviewOutcome.declaredHumanApprovalCount, 1, 'approved evidence counts declared-human approval');
    equal(held.reviewOutcome.holdCount, 1, 'held evidence requires one hold vote');
    equal(held.reviewOutcome.approvalCount, 0, 'held evidence has no approval');
    equal(rejected.reviewOutcome.rejectionCount, 1, 'rejected evidence requires one rejection vote');
    equal(rejected.reviewOutcome.declaredHumanVoteCount, 1, 'rejected evidence preserves declared-human count without identity claim');
    check(approved.reviewOutcome.votes.every(vote => /^sha256:[a-f0-9]{64}$/.test(vote.actorDigest)), 'public votes retain only actor digests');
    equal(approved.reviewOutcome.votes.map(vote => vote.actorDigest), approved.reviewOutcome.votes.map(vote => vote.actorDigest).slice().sort(), 'public votes use canonical actor-digest order');
    check(!fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome.js'), 'utf8').includes('actorDigest.localeCompare'), 'actor digest ordering is locale-neutral');
    check(approved.reviewOutcome.votes.some(vote => vote.actorDigest === Outcome.sha256('review-actor:alice reviewer')), 'actor digest is case-normalized and deterministic');
    check(approved.reviewOutcome.votes.every(vote => vote.artifactDigest === approvedFixture.pending.request.reviewCandidate.artifactDigest), 'every public vote binds exact artifact digest');
    equal(approved.truth.declaredHumanApprovalPresent, true, 'approval truth reports declared-human approval');
    equal(approved.truth.reviewActorAuthenticated, false, 'declared seat is not called authenticated');
    equal(approved.truth.actualHumanReviewProven, false, 'synthetic item is not called actual human review');
    equal(approved.truth.liveHostOutcomeObserved, false, 'caller-presented item is not called live host observation');
    equal(approved.truth.authenticatedStewardRemediationDecisionProven, false, 'artifact approval is not called remediation decision');
    equal(approved.truth.reviewOutcomeGrantsRemediationAuthority, false, 'outcome grants no remediation authority');
    equal(approved.nextGate, Outcome.NEXT_GATE, 'next gate requires separate authenticated steward decision or repair');
    equal(approved.reviewContext.v27Classification, approvedFixture.pending.request.reviewArtifact.v27Classification, 'review context preserves held classification');
    equal(approved.reviewContext.bestAction, approvedFixture.pending.request.reviewArtifact.decision.bestAction, 'review context preserves bounded best action');

    const publicText = JSON.stringify(approved);
    ['Alice Reviewer', 'Machine Seat', 'Alice exact artifact approval note', 'Machine exact artifact approval note'].forEach(secret => {
      check(!publicText.includes(secret), 'public outcome omits raw vote material: ' + secret);
    });
    [
      approvedFixture.pending.fixture.observationRoot,
      approvedFixture.pending.reviewRoot,
      approvedFixture.pending.requestInput.observationServiceOptions.root
    ].forEach(secretPath => check(!publicText.includes(secretPath), 'public outcome omits configured path'));
    ['pendingHandoffInput', 'pendingHandoff', 'reviewItem', 'reviewCandidate', 'reviewArtifact'].forEach(key => {
      check(!Object.prototype.hasOwnProperty.call(approved, key), 'public outcome omits complete package field ' + key);
    });
    equal(approved.truth.rawActorIdentityEmbedded, false, 'truth reports no raw actor identity');
    equal(approved.truth.voteNotesRetained, false, 'truth reports no vote-note retention');
    equal(approved.truth.reviewDiscussionIngested, false, 'truth reports no discussion ingestion');
    equal(approved.truth.sourceOrReceiverPathEmbedded, false, 'truth reports no path embedding');

    const immutableMutations = [
      ['id', value => { value.reviewItem.id += '-drift'; }],
      ['kind', value => { value.reviewItem.kind = 'proposal'; }],
      ['title', value => { value.reviewItem.title += ' drift'; }],
      ['sourceRef', value => { value.reviewItem.sourceRef += ':drift'; }],
      ['artifactDigest', value => { value.reviewItem.artifactDigest = '0'.repeat(64); }],
      ['summary', value => { value.reviewItem.summary += ' drift'; }],
      ['requiredSeats', value => { value.reviewItem.requiredSeats = 3; }],
      ['action', value => { value.reviewItem.action.automaticApply = true; }],
      ['createdAt', value => { value.reviewItem.createdAt = Fixture.after(value.reviewItem.createdAt); }],
      ['expiresAt', value => { value.reviewItem.expiresAt = Fixture.after(value.reviewItem.updatedAt, 60000); }]
    ];
    immutableMutations.forEach(([field, mutate]) => expectBuildError(approvedFixture.input, mutate, /immutable/, 'immutable review item ' + field + ' drift is refused'));
    expectBuildError(approvedFixture.input, value => { value.reviewItem.state = 'PENDING'; }, /post-pending|APPROVED HOLD or REJECTED/, 'pending state is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.state = 'REPAIR'; }, /post-pending|APPROVED HOLD or REJECTED/, 'repair state is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.extra = true; }, /fields are not exact/, 'review item extra field is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.discussion.push({ body: 'private discussion' }); }, /zero discussion/, 'review discussion is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes = []; }, /one to 10 votes/, 'zero-vote outcome is refused');
    expectBuildError(approvedFixture.input, value => {
      const template = copy(value.reviewItem.votes[0]);
      value.reviewItem.votes = Array.from({ length: 11 }, (_, index) => Object.assign(copy(template), { actor: 'Actor ' + index }));
    }, /one to 10 votes/, 'more than ten votes are refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[1].actor = 'ALICE REVIEWER'; }, /case-insensitively distinct/, 'case-variant duplicate actor is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].actor = ' Alice Reviewer '; }, /already be trimmed/, 'untrimmed actor is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].actor = ''; }, /actor is invalid/, 'empty actor is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].actorKind = 'person'; }, /actor kind is unsupported/, 'unknown actor kind is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].verdict = 'CONTINUE'; }, /verdict is unsupported/, 'unknown vote verdict is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].note = 'x'.repeat(1001); }, /note is invalid/, 'oversized vote note is refused before omission');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].artifactDigest = '0'.repeat(64); }, /does not match/, 'vote artifact digest drift is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].at = 'not-time'; }, /canonical UTC|invalid/, 'invalid vote time is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].at = '2020-01-01T00:00:00.000Z'; }, /outside the pending-to-outcome transition/, 'vote before pending handoff is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].at = Fixture.after(value.reviewItem.updatedAt); }, /outside the pending-to-outcome transition/, 'vote after outcome item update is refused');
    expectBuildError(approvedFixture.input, value => { delete value.reviewItem.votes[0].note; }, /fields are not exact/, 'missing vote field is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes[0].extra = true; }, /fields are not exact/, 'extra vote field is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes.pop(); }, /lacks its required distinct approvals/, 'approved outcome with insufficient approvals is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.votes.forEach(vote => { vote.actorKind = 'machine'; }); }, /declared human approval seat/, 'machine-only approval is refused');
    expectBuildError(approvedFixture.input, value => {
      value.reviewItem.votes.push({ actor: 'Hold Counterevidence', actorKind: 'machine', verdict: 'HOLD', note: '', artifactDigest: value.reviewItem.artifactDigest, at: value.reviewItem.updatedAt });
    }, /conflicting exact-digest vote/, 'approved outcome with HOLD counterevidence is refused');
    expectBuildError(heldFixture.input, value => { value.reviewItem.votes[0].verdict = 'APPROVE'; }, /held item vote evidence contradicts/, 'held outcome without hold vote is refused');
    expectBuildError(heldFixture.input, value => {
      ['A', 'B'].forEach((actor, index) => value.reviewItem.votes.push({ actor: 'Approver ' + actor, actorKind: index ? 'machine' : 'human', verdict: 'APPROVE', note: '', artifactDigest: value.reviewItem.artifactDigest, at: value.reviewItem.updatedAt }));
    }, /held item vote evidence contradicts/, 'held outcome at approval threshold is refused');
    expectBuildError(rejectedFixture.input, value => { value.reviewItem.votes[0].verdict = 'HOLD'; }, /rejected item lacks a rejection vote/, 'rejected outcome without rejection vote is refused');
    expectBuildError(approvedFixture.input, value => { value.reviewItem.updatedAt = Fixture.after(value.observedAt); }, /observation predates/, 'outcome observation before item update is refused');
    expectBuildError(approvedFixture.input, value => { value.observedAt = '2020-01-01T00:00:00.000Z'; }, /predates the pending handoff/, 'outcome observation before pending handoff is refused');
    expectBuildError(approvedFixture.input, value => { value.pendingHandoff.handoffDigest = 'sha256:' + '0'.repeat(64); }, /pending handoff does not exact-rebuild/, 'altered pending handoff is refused');
    expectBuildError(approvedFixture.input, value => { value.pendingHandoffInput.request.requestDigest = 'sha256:' + '0'.repeat(64); }, /pending handoff does not exact-rebuild/, 'altered v2.9 request package is refused');
    expectBuildError(approvedFixture.input, value => { value.extra = true; }, /fields are not exact/, 'input extra field is refused');
    expectBuildError(approvedFixture.input, value => { value.pad = 'x'.repeat(Outcome.MAX_INPUT_CANONICAL_BYTES); }, /exceeds 33554432 canonical bytes/, 'oversized input is refused before field processing');

    expectValidateError(approved, value => { value.extra = true; }, /fields are not exact/, 'outcome extra field is refused');
    expectValidateError(approved, value => { value.state = held.state; }, /state or next gate mismatch/, 'derived outcome state drift is refused', true);
    expectValidateError(approved, value => { value.truth.actualHumanReviewProven = true; }, /truth boundary mismatch/, 'human review truth inflation is refused', true);
    expectValidateError(approved, value => { value.truth.holdResolved = true; }, /truth boundary mismatch/, 'hold resolution truth inflation is refused', true);
    expectValidateError(approved, value => { value.truth.executionAuthorized = true; }, /truth boundary mismatch/, 'execution truth inflation is refused', true);
    expectValidateError(approved, value => { value.reviewOutcome.approvalCount = 1; }, /vote counts are inconsistent/, 'approval count drift is refused', true);
    expectValidateError(approved, value => { value.reviewOutcome.votes.reverse(); }, /canonical actor-digest order/, 'noncanonical vote order is refused', true);
    const actorDigestRewrite = copy(approved);
    actorDigestRewrite.reviewOutcome.votes[0].actorDigest = Outcome.sha256('review-actor:different-presented-actor');
    actorDigestRewrite.reviewOutcome.votes.sort((left, right) => left.actorDigest < right.actorDigest ? -1 : (left.actorDigest > right.actorDigest ? 1 : 0));
    rehash(actorDigestRewrite);
    equal(Outcome.validateOutcome(actorDigestRewrite), actorDigestRewrite, 'standalone validator admits self-consistent pseudonymous digest rewrite');
    equal(actorDigestRewrite.truth.standaloneActorDigestProvenanceProven, false, 'standalone truth refuses actor-digest provenance proof');
    equal(Outcome.verifyOutcome(approvedFixture.input, actorDigestRewrite).pass, false, 'exact input rebuild refuses pseudonymous actor digest rewrite');
    expectValidateError(approved, value => { value.reviewOutcome.votes[0].artifactDigest = '0'.repeat(64); }, /votes do not bind the exact artifact/, 'public vote digest drift is refused', true);
    expectValidateError(approved, value => { value.reviewContext.v27Classification = 'EXACT_HISTORY_MATCH'; }, /classification is not held/, 'non-held review context is refused', true);
    expectValidateError(approved, value => { value.reviewArtifactRef.schema = 'wrong'; }, /reference schema mismatch/, 'artifact reference schema drift is refused', true);
    expectValidateError(approved, value => { value.outcomeDigest = 'sha256:' + '0'.repeat(64); }, /outcome digest mismatch/, 'outcome digest drift is refused');
    const verifyCorrupt = copy(approved); verifyCorrupt.reviewContext.bestAction += ' drift'; rehash(verifyCorrupt);
    equal(Outcome.verifyOutcome(approvedFixture.input, verifyCorrupt).pass, false, 'exact verifier refuses self-consistent altered output');

    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-outcome.schema.json'), 'utf8'));
    equal(schema.$id, Outcome.OUTCOME_SCHEMA, 'JSON schema id matches runtime');
    equal(schema.additionalProperties, false, 'JSON schema closes outcome top-level fields');
    equal(schema.properties.reviewContext.additionalProperties, false, 'JSON schema closes review context');
    equal(schema.properties.reviewOutcome.additionalProperties, false, 'JSON schema closes review outcome evidence');
    equal(schema.properties.truth.additionalProperties, false, 'JSON schema closes truth fields');
    equal(schema.$defs.vote.additionalProperties, false, 'JSON schema closes pseudonymous vote rows');
    equal(schema.properties.truth.properties.holdResolved.const, false, 'JSON schema fixes hold resolution false');
    equal(schema.properties.truth.properties.actualHumanReviewProven.const, false, 'JSON schema fixes actual human review false');
    equal(schema.properties.truth.properties.automaticCanon.const, false, 'JSON schema fixes automatic CANON false');

    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
    equal(contract.id, 'model-shadow-retention-audit-review-outcome', 'contract id is exact');
    equal(contract.version, 'v3.1', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status remains TEST');
    check(contract.permissions.some(value => value.includes('caller-owned v2.8 observation root')), 'contract declares inherited v2.8 read authority');
    check(contract.permissions.some(value => value.includes('transient operation lock')), 'contract declares inherited transient-lock authority');
    check(contract.permissions.some(value => value.includes('no Review Inbox mutation')), 'contract refuses Review Inbox mutation permission');
    equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
    check(contract.boundaries.refuses.includes('declared-human-seat-as-authenticated-human'), 'contract refuses declared human as authenticated identity');
    check(contract.boundaries.refuses.includes('artifact-approval-as-retention-hold-resolution'), 'contract refuses approval as hold resolution');
    check(contract.boundaries.refuses.includes('review-outcome-as-remediation-execution-or-adoption-authority'), 'contract refuses consequential outcome authority');

    const runtimeSource = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome.js'), 'utf8');
    check(!/review-service|ReviewService|operations-api|AXMOps|\bfetch\s*\(|XMLHttpRequest/.test(runtimeSource), 'runtime imports or calls no ReviewService operations API or browser network');
    check(!/require\(['"]fs['"]\)|require\(['"]child_process['"]\)|require\(['"]https?['"]\)/.test(runtimeSource), 'runtime imports no filesystem process or network module');
    check(runtimeSource.includes("require('../model-shadow-retention-audit-review-request/"), 'runtime composes exact v2.9 verifier');
    check(runtimeSource.includes('verifyPendingReviewHandoff'), 'runtime exact-rebuilds pending handoff');

    const packagePath = path.join(tempRoot, 'fresh-process-package.json');
    fs.writeFileSync(packagePath, JSON.stringify({ input: approvedFixture.input, outcome: approved }), 'utf8');
    const child = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
      cwd: __dirname, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024
    });
    equal(child.status, 0, 'fresh process rebuild exits zero');
    const childReceipt = JSON.parse(child.stdout);
    equal(childReceipt.pass, true, 'fresh process reports exact rebuild pass');
    equal(childReceipt.outcomeDigest, approved.outcomeDigest, 'fresh process binds identical outcome digest');
    equal(childReceipt.state, approved.state, 'fresh process binds identical outcome state');

    const stableAfter = treeDigest(stableRoots);
    equal(stableAfter, stableBefore, 'outcome builds and fresh process leave source and Review Inbox trees byte-identical');
    equal(fs.existsSync(path.join(approvedFixture.pending.fixture.observationRoot, '.model-shadow-retention-audit-observation-ledger.lock')), false, 'inherited transient operation lock is removed');
    equal(approved.truth.durableSourceStateChangedByModule, false, 'outcome truth reports no durable source change');
    equal(approved.truth.durableReviewInboxStateChangedByModule, false, 'outcome truth reports no durable Review Inbox change');
    equal(approved.truth.receiverStateFileFsyncProven, false, 'outcome truth refuses receiver fsync proof');
    equal(approved.truth.independentReceiverProcessProven, false, 'fresh process is not called independent receiver proof');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

try { main(); }
catch (error) { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; }
