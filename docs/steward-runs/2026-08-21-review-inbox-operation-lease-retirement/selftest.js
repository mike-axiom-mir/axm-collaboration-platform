#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const json = name => JSON.parse(read(name));
let assertions = 0;

function check(value, label) { assert(value, label); assertions += 1; }
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions += 1; }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function canonicalDigest(value, field) {
  const copy = JSON.parse(Core.canonicalJson(value));
  delete copy[field];
  return 'sha256:' + sha(Core.canonicalJson(copy));
}
function jsonDigest(value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy[field];
  return 'sha256:' + sha(JSON.stringify(copy));
}
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, {
    cwd: ROOT,
    encoding: encoding === null ? null : 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}

const checks = json('CHECK_RESULTS.json');
equal(checks.status, 'PASS', 'bounded verification receipt passes');
equal(checks.summary.commands, 68, 'verification receipt contains 68 commands');
equal(checks.summary.passed, 68, 'all recorded commands pass');
equal(checks.summary.failed, 0, 'no recorded command fails');
equal(checks.summary.focusedAssertions, 6253, 'focused assertion aggregate is exact');
equal(checks.resultsDigest, canonicalDigest(checks, 'resultsDigest'), 'verification digest is canonical');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length, 10, 'all ten AGENTS commands are present');
equal(checks.commands.filter(item => item.phase === 'REQUIRED' && item.verdict === 'PASS').length, 10, 'all ten AGENTS commands pass');
check(checks.commands.some(item => item.command === 'node shared/operations/review-operation-lease-retirement-selftest.js' && item.assertions === 79 && item.verdict === 'PASS'), '79-assertion retirement suite is recorded');
check(checks.commands.some(item => item.command === 'node shared/operations/review-operation-lease-selftest.js' && item.assertions === 54 && item.verdict === 'PASS'), '54-assertion lease suite is recorded');
check(checks.commands.some(item => item.command === 'node tools/review-inbox/selftest.js' && item.assertions === 117 && item.verdict === 'PASS'), '117-assertion Review Inbox suite is recorded');
check(checks.commands.some(item => item.command === 'node scripts/package-script-path-selftest.js' && item.verdict === 'PASS'), 'package script path suite is recorded');

const baseline = json('BASELINE_OPERABILITY_REPRODUCTION.json');
equal(baseline.status, 'REPRODUCED', 'baseline operability gap is reproduced');
equal(baseline.baselineCommit, 'b79a77036f32f2fc06994cc8cfe4a63bf9e626b0', 'baseline commit is exact');
equal(baseline.baselineTree, '954719d23a9dac013662655fc6c0d38c9030a5a5', 'baseline tree is exact');
equal(baseline.source.exactGitBlobExecuted, true, 'exact baseline lease Git blob was executed');
equal(baseline.result.crashChildExitCode, 23, 'crash child exit is exact');
equal(baseline.result.postCrashState, 'HELD', 'post-crash status is held');
equal(baseline.result.postCrashReasonCode, 'REVIEW_OPERATION_LEASE_PRESENT', 'post-crash reason is exact');
equal(baseline.result.nextMutationErrorCode, 'REVIEW_OPERATION_BUSY', 'next mutation fails typed busy');
equal(baseline.result.lockEvidenceRetainedAfterRefusal, true, 'baseline lock survives refusal');
equal(baseline.result.retirementPlanExported, false, 'baseline exported no retirement plan');
equal(baseline.result.retirementMethodExported, false, 'baseline exported no retirement method');
equal(baseline.boundary.productionCrashFrequencyProven, false, 'production crash frequency is not claimed');
equal(baseline.boundary.holderTerminationProven, false, 'holder termination is not claimed');
equal(baseline.boundary.manualDeletionSafeProven, false, 'manual deletion safety is not claimed');
equal(baseline.boundary.specialistPackagesInspected, false, 'specialist packages stayed excluded');
check(/^sha256:[0-9a-f]{64}$/.test(baseline.result.lockEvidenceSha256), 'baseline retains only a lock digest');

const replay = json('CLEAN_PRODUCT_REPLAY.json');
equal(replay.status, 'PASS', 'clean product slice replay passes');
equal(replay.productCommit, '309f0e397da6bb4c6a8fc409812f0bfc8c8db2c0', 'clean replay binds product commit');
equal(replay.productTree, '5f11c51929a1424cea047313f21ffbb2443fb998', 'clean replay binds product tree');
equal(replay.trackedFiles, 590, 'clean slice contains 590 tracked files');
equal(replay.summary.commands, 10, 'clean replay contains ten commands');
equal(replay.summary.passed, 10, 'all clean replay commands pass');
equal(replay.summary.failed, 0, 'no clean replay command fails');
equal(replay.trackedFilesUnchangedAfterReplay, true, 'clean replay leaves tracked files unchanged');
equal(replay.changedTrackedFiles, [], 'clean replay records no changed tracked files');
equal(replay.temporaryReplayPathRetained, false, 'clean replay retains no temporary path');
equal(replay.replayDigest, jsonDigest(replay, 'replayDigest'), 'clean replay digest matches its deterministic JSON body');

const evidenceReplay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(evidenceReplay.status, 'PASS', 'clean archived evidence replay passes');
equal(evidenceReplay.evidenceCommit, '27dc1812b8c96e71b089a184d46e22bb21aa51c2', 'evidence replay binds primary evidence commit');
equal(evidenceReplay.evidenceTree, '03fc925c3be6ea76877020730ec2b1c6920b6eda', 'evidence replay binds primary evidence tree');
equal(evidenceReplay.trackedFiles, 28, 'evidence replay contains 28 tracked files');
equal(evidenceReplay.selftest.verdict, 'PASS', 'archived evidence selftest passes');
check(evidenceReplay.selftest.stdout.includes('139 checks'), 'archived evidence selftest reports 139 checks');
equal(evidenceReplay.sealReplay.verdict, 'PASS', 'archived primary seal replay passes');
equal(evidenceReplay.sealReplay.eventLines, 30, 'archived seal replay observes 30 events');
equal(evidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'evidence replay did not mutate a source checkout or shared main');
equal(evidenceReplay.temporaryReplayPathRetained, false, 'evidence replay retains no temporary path');
equal(evidenceReplay.replayDigest, jsonDigest(evidenceReplay, 'replayDigest'), 'evidence replay digest matches its deterministic JSON body');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status, 'PASS', 'native surface receipt passes');
equal(native.browserFacingFilesChanged, false, 'no browser-facing file changed');
equal(native.liveBrowserRerun, false, 'no new browser run is claimed');
equal(native.runtimeEvidence.retirementSelftest.assertions, 79, 'native receipt records retirement assertions');
equal(native.runtimeEvidence.leaseSelftest.assertions, 54, 'native receipt records lease assertions');
equal(native.runtimeEvidence.cliInspectCovered, true, 'CLI inspect is covered');
equal(native.runtimeEvidence.cliWrongRetireRefused, true, 'wrong CLI retire is refused');
equal(native.runtimeEvidence.cliExactRetireCovered, true, 'exact CLI retire is covered');
equal(native.runtimeEvidence.apiRetirementRouteFound, false, 'no API route was found');
equal(native.runtimeEvidence.browserRetirementRouteFound, false, 'no browser route was found');
equal(native.retention.rawLockBytesRetainedInEvidenceFolder, false, 'raw lock bytes are not retained');
equal(native.truth.holderTerminationProven, false, 'native evidence does not prove holder termination');
equal(native.truth.retirementSafetyProven, false, 'native evidence does not prove retirement safety');
equal(native.truth.mergeAuthorized, false, 'native path grants no merge authority');
equal(native.truth.canonAuthorized, false, 'native path grants no CANON authority');

const before = json('CAPABILITY_GAP_BEFORE.json');
const after = json('CAPABILITY_GAP_AFTER.json');
equal(before.overall, 'BLOCKED', 'before comparison is blocked');
equal(before.requirements.filter(item => item.required && item.status !== 'READY').length, 15, 'before comparison exposes fifteen required gaps');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'after comparison closes every bounded required gap');
equal(after.requirements.filter(item => !item.required && item.status !== 'READY').length, 10, 'ten optional capability groups remain open');
equal(after.overall, 'DEGRADED', 'optional gaps prevent a broad ready claim');
equal(after.proposedHands.length, 10, 'comparator emits ten optional contract candidates, not installed hands');
check(after.proposedHands.every(item => item.contractStatus === 'SPEC_REQUIRED'), 'every optional contract candidate still requires a spec');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 9, 'nine claim-specific evidence routes are present');
equal(routes.routes.filter(item => item.verdict === 'PASS').length, 9, 'every bounded evidence route passes');
check(routes.routes.some(item => item.kind === 'persistence'), 'persistence claims use persistence evidence');
check(routes.routes.some(item => item.kind === 'authorization'), 'authority claims use authorization evidence');
check(routes.routes.some(item => item.id === 'baseline-crash-residue-operability-gap'), 'baseline claim has a dedicated route');
check(routes.routes.every(item => item.counterevidence), 'every route preserves counterevidence');

const seal = json('SESSION_SEGMENT.seal.json');
const addendumSeal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
equal(seal.parseStatus, 'valid', 'session segment parses');
equal(seal.eventLines, 30, 'session segment retains 30 semantic events');
equal(seal.validJsonLines, 30, 'every session line is valid JSON');
equal(seal.sha256, sha(fs.readFileSync(path.join(__dirname, seal.source))), 'session seal digest matches');
equal(addendumSeal.parseStatus, 'valid', 'session addendum parses');
equal(addendumSeal.eventLines, 4, 'session addendum retains four semantic events');
equal(addendumSeal.sha256, sha(fs.readFileSync(path.join(__dirname, addendumSeal.source))), 'session addendum seal digest matches');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit, '309f0e397da6bb4c6a8fc409812f0bfc8c8db2c0', 'source snapshot binds product commit');
equal(source.parent, 'b79a77036f32f2fc06994cc8cfe4a63bf9e626b0', 'source snapshot binds baseline parent');
equal(source.tree, '5f11c51929a1424cea047313f21ffbb2443fb998', 'source snapshot binds product tree');
equal(source.files.length, 15, 'source snapshot binds fifteen product files');
equal(source.productDigest, canonicalDigest(source, 'productDigest'), 'source snapshot digest is canonical');
check(source.files.every(item => !item.path.startsWith('docs/steward-runs/') && !/AXM_MIRROR_SHADOW_SPECIALIST/i.test(item.path)), 'snapshot excludes evidence and specialist package lane');
source.files.forEach(item => {
  const bytes = git(['show', source.commit + ':' + item.path], null);
  assert.equal(item.bytes, bytes.length, item.path + ' byte count drifted');
  assert.equal(item.sha256, 'sha256:' + sha(bytes), item.path + ' digest drifted');
});
assertions += source.files.length * 2;

const changed = String(git(['diff-tree', '--no-commit-id', '--name-only', '-r', source.parent, source.commit]))
  .split(/\r?\n/).filter(Boolean);
check(!changed.some(file => /\.(?:html|css)$/i.test(file) || /(?:^|\/)app\.js$/i.test(file)), 'product commit changes no browser-facing UI file');
check(!changed.some(file => /AXM_MIRROR_SHADOW_SPECIALIST/i.test(file)), 'product commit excludes specialist package lane');

const leaseSource = String(git(['show', source.commit + ':shared/operations/review-operation-lease.js']));
check(leaseSource.includes('RETIREMENT_ASSERTION = \'HOLDER_TERMINATED_OR_ABANDONED\''), 'product source binds the exact assertion');
check(leaseSource.includes('fs.renameSync(leaseFile, evidenceFile)'), 'product source quarantines via exact rename');
check(leaseSource.includes('holderTerminatedOrAbandonedProven:false'), 'product truth denies holder-death proof');
check(leaseSource.includes('retirementSafetyProven:false'), 'product truth denies retirement-safety proof');
check(leaseSource.includes("['EEXIST','EPERM'].includes(error.code)"), 'product source handles bounded EPERM contention');
check(!/kill\s*\(/.test(leaseSource), 'product source contains no process kill call');

const adminSource = String(git(['show', source.commit + ':shared/operations/review-operation-lease-admin.js']));
check(adminSource.includes("if (!values['state-root'])"), 'CLI requires state root');
check(adminSource.includes('stateRoot === path.parse(stateRoot).root'), 'CLI refuses filesystem roots');
const manifest = JSON.parse(String(git(['show', source.commit + ':tools/review-inbox/manifest.json'])));
equal(manifest.version, 'v0.8', 'Review Inbox manifest is v0.8');
equal(manifest.status, 'TEST', 'Review Inbox remains TEST');

const indexTool = JSON.parse(String(git(['show', source.commit + ':tools-index.json']))).tools.find(item => item.id === 'review-inbox');
equal(indexTool.version, 'v0.8', 'tools index records Review Inbox v0.8');
equal(indexTool.promotion.state, 'BLOCKED', 'Review Inbox promotion remains blocked');
check(indexTool.promotion.blockers.includes('selftest result is stale for the current selftest digest'), 'stale aggregate receipt remains explicit');

const curation = json('CURATION_RECEIPT.json');
const index = json('SESSION_INDEX.json');
equal(curation.durableEventsPreserved, 34, 'curation preserves every semantic event');
equal(curation.sealDigest, 'sha256:' + seal.sha256, 'curation binds the session seal');
equal(curation.continuationSegments[0].sealDigest, 'sha256:' + addendumSeal.sha256, 'curation binds the addendum seal');
equal(curation.telemetryAggregation.commandOutcomes, 68, 'curation aggregates exact command outcomes');
equal(curation.telemetryAggregation.retainedRawLogs, false, 'curation retains no raw command logs');
equal(curation.cleanProductReplay.recordedCommandsPassed, 10, 'curation records ten clean replay passes');
equal(curation.cleanProductReplay.trackedFilesUnchanged, true, 'curation records clean replay immutability');
equal(curation.temporaryMaterialDeleted.cleanReplayTemporaryRootsRemaining, 0, 'no replay root remains');
equal(curation.temporaryMaterialDeleted.cleanEvidenceReplayTemporaryRootsRemaining, 0, 'no evidence replay root remains');
equal(curation.temporaryMaterialDeleted.rawCrashLockBytesRetained, false, 'no raw crash lock bytes remain');
equal(curation.capabilityComparison.overallAfter, 'DEGRADED', 'curation keeps broad capability status degraded');
equal(curation.cleanEvidenceReplay.evidenceSelftestChecksPassed, 139, 'curation records the archived evidence checks');
equal(curation.cleanEvidenceReplay.sessionSealReplayPassed, true, 'curation records the archived seal replay');
equal(curation.cleanEvidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'curation records no source or shared-main mutation');
equal(index.broadGoalComplete, false, 'session index leaves the broad objective active');
equal(index.productCommit, source.commit, 'session index and source snapshot agree');
equal(index.continuationSegments.length, 1, 'session index records one sealed continuation');
equal(index.mergeGate, 'Mike Tobi / AXM', 'merge gate remains Mike Tobi / AXM');
equal(index.canonGate, 'Mike Tobi / AXM', 'CANON gate remains Mike Tobi / AXM');

const evidenceFiles = fs.readdirSync(__dirname);
check(!evidenceFiles.some(name => /\.(png|jpe?g|webp|mp4|webm)$/i.test(name)), 'no raw screenshot or recording is retained');
const retainedText = evidenceFiles
  .filter(name => fs.statSync(path.join(__dirname, name)).isFile())
  .map(read)
  .join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(retainedText), 'evidence contains no machine-local personal or workspace path');
check(/Mike\s+Tobi \/ AXM remains the merge/.test(read('README.md')) && read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'), 'merge and CANON gate plus active broad objective remain explicit');

console.log('PASS Review Inbox operation lease retirement evidence: ' + assertions + ' checks');
