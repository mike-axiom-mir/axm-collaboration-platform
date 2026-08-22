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
    cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}

const checks = json('CHECK_RESULTS.json');
equal(checks.status, 'PASS', 'bounded verification receipt passes');
equal(checks.summary.commands, 69, 'verification receipt contains 69 commands');
equal(checks.summary.passed, 69, 'all bounded commands pass');
equal(checks.summary.failed, 0, 'no bounded command fails');
equal(checks.summary.focusedAssertions, 6378, 'focused assertion aggregate is exact');
equal(checks.resultsDigest, canonicalDigest(checks, 'resultsDigest'), 'verification digest is canonical');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length, 10, 'all ten AGENTS commands are present');
equal(checks.commands.filter(item => item.phase === 'REQUIRED' && item.verdict === 'PASS').length, 10, 'all ten AGENTS commands pass');
check(checks.commands.some(item => item.command === 'node shared/operations/review-operation-lease-retirement-recovery-selftest.js' && item.assertions === 105 && item.verdict === 'PASS'), '105-assertion recovery suite is recorded');
check(checks.commands.some(item => item.command === 'node shared/operations/review-operation-lease-retirement-selftest.js' && item.assertions === 79 && item.verdict === 'PASS'), '79-assertion retirement suite is recorded');
check(checks.commands.some(item => item.command === 'node shared/operations/review-operation-lease-selftest.js' && item.assertions === 54 && item.verdict === 'PASS'), '54-assertion lease suite is recorded');
check(checks.commands.some(item => item.command === 'node tools/review-inbox/selftest.js' && item.assertions === 134 && item.verdict === 'PASS'), '134-assertion Review Inbox suite is recorded');
check(checks.commands.some(item => item.command === 'node tools/review-inbox/discovery-seam-review.js' && item.assertions === 24 && item.verdict === 'PASS'), '24-control discovery suite is recorded');

const baseline = json('BASELINE_INTERRUPTION_REPRODUCTION.json');
equal(baseline.status, 'REPRODUCED', 'both baseline interruption windows are reproduced');
equal(baseline.baselineCommit, 'db9b6c979d8bcf15cf302e502233dbb5b5f0ea61', 'baseline commit is exact');
equal(baseline.baselineTree, 'd7704d0b4f8388f0ab738aaaf5c83cf4d39a01e1', 'baseline tree is exact');
equal(baseline.source.exactGitBlobExecuted, true, 'exact baseline lease Git blob was executed');
equal(baseline.intentOnlyInterruption.errorCode, 'SIMULATED_INTERRUPTION_AFTER_INTENT', 'intent-only interruption is exact');
equal(baseline.intentOnlyInterruption.lockPathStillPresent, true, 'intent-only interruption retains lock');
equal(baseline.intentOnlyInterruption.lockDigestStillMatches, true, 'intent-only lock digest still matches');
equal(baseline.intentOnlyInterruption.evidenceCounts, { intentFiles:1, ownerEvidenceFiles:0, resultFiles:0 }, 'intent-only files are exact');
equal(baseline.quarantinedEvidenceInterruption.errorCode, 'SIMULATED_INTERRUPTION_AFTER_EVIDENCE', 'post-quarantine interruption is exact');
equal(baseline.quarantinedEvidenceInterruption.lockPathStillPresent, false, 'post-quarantine interruption frees lock path');
equal(baseline.quarantinedEvidenceInterruption.evidenceCounts, { intentFiles:1, ownerEvidenceFiles:1, resultFiles:0 }, 'post-quarantine files are exact');
equal(baseline.quarantinedEvidenceInterruption.retirementPlanState, 'FREE', 'ordinary v4.4 plan misses incomplete result state');
equal(Object.values(baseline.missingBaselineCapability).filter(Boolean).length, 0, 'baseline exports no recovery capability');
equal(baseline.boundary.productionInterruptionFrequencyProven, false, 'production frequency is not claimed');
equal(baseline.boundary.holderTerminationProven, false, 'holder termination is not claimed');
equal(baseline.boundary.recoverySafetyProven, false, 'recovery safety is not claimed');
equal(baseline.boundary.specialistPackagesInspected, false, 'specialist packages stayed excluded');

const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
equal(aggregate.status, 'FOREIGN_FAILURE', 'aggregate operations non-pass is preserved');
equal(aggregate.exitCode, 1, 'aggregate operations exit is nonzero');
equal(aggregate.reachedNewRecoverySelftestPass, true, 'aggregate command passed v4.5 before foreign failure');
equal(aggregate.failure.errorCode, 'CURATED_VERIFICATION_INTAKE_MISSING', 'aggregate failure has exact typed code');
equal(aggregate.failure.exactMessageObserved, true, 'aggregate failure message was observed');
equal(aggregate.baselineComparison.serviceBlobUnchanged, true, 'failing service blob is unchanged from baseline');
equal(aggregate.baselineComparison.intakeDirectoryTrackedAtBaseline, false, 'intake is absent from baseline tree');
equal(aggregate.baselineComparison.intakeDirectoryTrackedAtProduct, false, 'intake is absent from product tree');
equal(aggregate.baselineComparison.intakeDirectoryPresentInWorkspace, false, 'intake is absent from workspace');
equal(aggregate.baselineComparison.productTouchedVerificationProofLane, false, 'product did not touch failing lane');
equal(aggregate.classification.v45RegressionProven, false, 'aggregate probe proves no v4.5 regression');
equal(aggregate.classification.convertedToPass, false, 'aggregate failure was not converted to success');
equal(aggregate.retention.rawCommandLogRetained, false, 'aggregate probe retains no raw log');
equal(aggregate.retention.specialistPackagesInspected, false, 'aggregate probe excludes specialist packages');

const replay = json('CLEAN_PRODUCT_REPLAY.json');
equal(replay.status, 'PASS', 'clean product slice replay passes');
equal(replay.productCommit, 'e3c131254dd3d23fc053b2802d4bb39dd0a75a0f', 'clean replay binds product commit');
equal(replay.productTree, '277940971097ee7114e0bbe7c0f7eee8138b8268', 'clean replay binds product tree');
equal(replay.trackedFiles, 594, 'clean slice contains 594 tracked files');
equal(replay.summary.commands, 11, 'clean replay contains eleven commands');
equal(replay.summary.passed, 11, 'all clean replay commands pass');
equal(replay.summary.failed, 0, 'no clean replay command fails');
equal(replay.trackedFilesUnchangedAfterReplay, true, 'clean replay leaves tracked files unchanged');
equal(replay.changedTrackedFiles, [], 'clean replay records no changed tracked files');
equal(replay.temporaryReplayPathRetained, false, 'clean replay retains no temporary path');
equal(replay.replayDigest, jsonDigest(replay, 'replayDigest'), 'clean replay digest matches deterministic JSON body');

const evidenceReplay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(evidenceReplay.status, 'PASS', 'clean archived evidence replay passes');
equal(evidenceReplay.evidenceCommit, '178adc0a5d047e7b449116ae4150bb7de56f1a00', 'evidence replay binds primary evidence commit');
equal(evidenceReplay.evidenceTree, 'e36c5f7e0a611e09f53750f56e512defc034cbdd', 'evidence replay binds primary evidence tree');
equal(evidenceReplay.trackedFiles, 30, 'evidence replay contains thirty tracked files');
equal(evidenceReplay.selftest.verdict, 'PASS', 'archived evidence selftest passes');
check(evidenceReplay.selftest.stdout.includes('158 checks'), 'archived evidence selftest reports 158 checks');
equal(evidenceReplay.sealReplay.verdict, 'PASS', 'archived primary seal replay passes');
equal(evidenceReplay.sealReplay.eventLines, 37, 'archived seal replay observes 37 events');
equal(evidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'evidence replay did not mutate a source checkout or shared main');
equal(evidenceReplay.temporaryReplayPathRetained, false, 'evidence replay retains no temporary path');
equal(evidenceReplay.replayDigest, jsonDigest(evidenceReplay, 'replayDigest'), 'evidence replay digest matches deterministic JSON body');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status, 'PASS', 'native surface receipt passes');
equal(native.browserFacingFilesChanged, false, 'no browser-facing file changed');
equal(native.liveBrowserRerun, false, 'no new browser run is claimed');
equal(native.runtimeEvidence.recoverySelftest.assertions, 105, 'native receipt records recovery assertions');
equal(native.runtimeEvidence.cliRecoveryStatusCovered, true, 'CLI status is covered');
equal(native.runtimeEvidence.cliWrongRecoveryRefused, true, 'wrong CLI recovery is refused');
equal(native.runtimeEvidence.cliExactRecoveryCovered, true, 'exact CLI recovery is covered');
equal(native.runtimeEvidence.apiRecoveryRouteFound, false, 'no API recovery route was found');
equal(native.runtimeEvidence.browserRecoveryRouteFound, false, 'no browser recovery route was found');
equal(native.retention.rawOwnerBytesRetainedInEvidenceFolder, false, 'raw owner bytes are not retained');
equal(native.truth.holderTerminationProven, false, 'native evidence does not prove holder termination');
equal(native.truth.recoverySafetyProven, false, 'native evidence does not prove recovery safety');
equal(native.truth.mergeAuthorized, false, 'native path grants no merge authority');
equal(native.truth.canonAuthorized, false, 'native path grants no CANON authority');

const before = json('CAPABILITY_GAP_BEFORE.json'), after = json('CAPABILITY_GAP_AFTER.json');
equal(before.overall, 'BLOCKED', 'before comparison is blocked');
equal(before.requirements.filter(item => item.required && item.status !== 'READY').length, 18, 'before comparison exposes eighteen required gaps');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'after comparison closes every bounded required gap');
equal(after.requirements.filter(item => !item.required && item.status !== 'READY').length, 10, 'ten optional capability groups remain open');
equal(after.overall, 'DEGRADED', 'optional gaps prevent a broad ready claim');
equal(after.proposedHands.length, 10, 'comparator emits ten optional contract candidates, not installed hands');
check(after.proposedHands.every(item => item.contractStatus === 'SPEC_REQUIRED'), 'every optional candidate still requires a contract');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 10, 'ten claim-specific evidence routes are present');
equal(routes.routes.filter(item => item.verdict === 'PASS').length, 10, 'every bounded evidence route passes');
check(routes.routes.some(item => item.kind === 'persistence'), 'persistence claims use persistence evidence');
check(routes.routes.some(item => item.kind === 'authorization'), 'authority claims use authorization evidence');
check(routes.routes.some(item => item.id === 'aggregate-operations-nonpass'), 'foreign aggregate failure has a dedicated route');
check(routes.routes.every(item => item.counterevidence), 'every route preserves counterevidence');

const seal = json('SESSION_SEGMENT.seal.json');
const addendumSeal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
equal(seal.parseStatus, 'valid', 'session segment parses');
equal(seal.eventLines, 37, 'session segment retains 37 semantic events');
equal(seal.validJsonLines, 37, 'every session line is valid JSON');
equal(seal.sha256, sha(fs.readFileSync(path.join(__dirname, seal.source))), 'session seal digest matches');
equal(addendumSeal.parseStatus, 'valid', 'session addendum parses');
equal(addendumSeal.eventLines, 4, 'session addendum retains four semantic events');
equal(addendumSeal.validJsonLines, 4, 'every session addendum line is valid JSON');
equal(addendumSeal.sha256, sha(fs.readFileSync(path.join(__dirname, addendumSeal.source))), 'session addendum seal digest matches');
equal(read('SESSION_SEGMENT_ADDENDUM.jsonl').trim().split(/\r?\n/).map(line => JSON.parse(line).sequence), [38,39,40,41], 'session addendum sequence continues without a gap');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit, 'e3c131254dd3d23fc053b2802d4bb39dd0a75a0f', 'source snapshot binds product commit');
equal(source.parent, 'db9b6c979d8bcf15cf302e502233dbb5b5f0ea61', 'source snapshot binds baseline parent');
equal(source.tree, '277940971097ee7114e0bbe7c0f7eee8138b8268', 'source snapshot binds product tree');
equal(source.files.length, 14, 'source snapshot binds fourteen product files');
equal(source.productDigest, canonicalDigest(source, 'productDigest'), 'source snapshot digest is canonical');
check(source.files.every(item => !item.path.startsWith('docs/steward-runs/') && !/AXM_MIRROR_SHADOW_SPECIALIST/i.test(item.path)), 'snapshot excludes evidence and specialist package lane');
source.files.forEach(item => {
  const bytes = git(['show', source.commit + ':' + item.path], null);
  assert.equal(item.bytes, bytes.length, item.path + ' byte count drifted');
  assert.equal(item.sha256, 'sha256:' + sha(bytes), item.path + ' digest drifted');
});
assertions += source.files.length * 2;

const changed = String(git(['diff-tree', '--no-commit-id', '--name-only', '-r', source.parent, source.commit])).split(/\r?\n/).filter(Boolean);
check(!changed.some(file => /\.(?:html|css)$/i.test(file) || /(?:^|\/)app\.js$/i.test(file)), 'product commit changes no browser-facing UI file');
check(!changed.some(file => /AXM_MIRROR_SHADOW_SPECIALIST/i.test(file)), 'product commit excludes specialist package lane');

const leaseSource = String(git(['show', source.commit + ':shared/operations/review-operation-lease.js']));
check(leaseSource.includes('MAX_RETIREMENT_RECOVERY_RECORDS = 200'), 'product source binds record limit');
check(leaseSource.includes('MAX_RETIREMENT_EVIDENCE_BYTES = 64 * 1024'), 'product source binds file limit');
check(leaseSource.includes("RETIREMENT_RECOVERY_ACTIONS = Object.freeze(['RESUME_RETIREMENT','FINALIZE_RESULT'])"), 'product source binds exact actions');
check(leaseSource.includes('function retirementRecoveryStatus()'), 'product source contains read-only status');
check(leaseSource.includes('function recoverRetirement(input)'), 'product source contains explicit recovery');
check(leaseSource.includes('holderTerminatedOrAbandonedProven:false'), 'product truth denies holder-death proof');
check(leaseSource.includes('recoverySafetyProven:false'), 'product truth denies recovery-safety proof');
check(!/process\.kill|kill\s*\(/.test(leaseSource), 'product source contains no process kill call');

const adminSource = String(git(['show', source.commit + ':shared/operations/review-operation-lease-admin.js']));
check(adminSource.includes("'recovery-status','recover'"), 'CLI contains both recovery commands');
check(adminSource.includes('stateRoot === path.parse(stateRoot).root'), 'CLI refuses filesystem roots');
const manifest = JSON.parse(String(git(['show', source.commit + ':tools/review-inbox/manifest.json'])));
equal(manifest.version, 'v0.9', 'Review Inbox manifest is v0.9');
equal(manifest.status, 'TEST', 'Review Inbox remains TEST');
const toolsIndex = JSON.parse(String(git(['show', source.commit + ':tools-index.json'])));
const indexTool = toolsIndex.tools.find(item => item.id === 'review-inbox');
equal(toolsIndex.tools.length, 211, 'tools index retains 211 tools');
equal(toolsIndex.capabilities.length, 1860, 'tools index records 1860 capabilities');
equal(indexTool.version, 'v0.9', 'tools index records Review Inbox v0.9');
equal(indexTool.promotion.state, 'BLOCKED', 'Review Inbox promotion remains blocked');
check(indexTool.promotion.blockers.includes('selftest result is stale for the current selftest digest'), 'stale aggregate receipt remains explicit');

const curation = json('CURATION_RECEIPT.json'), index = json('SESSION_INDEX.json');
equal(curation.durableEventsPreserved, 41, 'curation preserves every semantic event');
equal(curation.sealDigest, 'sha256:' + seal.sha256, 'curation binds the session seal');
equal(curation.continuationSegments[0].sealDigest, 'sha256:' + addendumSeal.sha256, 'curation binds the addendum seal');
equal(curation.telemetryAggregation.boundedCommandOutcomes, 69, 'curation aggregates exact bounded command outcomes');
equal(curation.telemetryAggregation.retainedRawLogs, false, 'curation retains no raw command logs');
equal(curation.telemetryAggregation.aggregateOperationsForeignFailures, 1, 'curation preserves aggregate foreign failure');
equal(curation.cleanProductReplay.recordedCommandsPassed, 11, 'curation records eleven clean replay passes');
equal(curation.cleanProductReplay.trackedFilesUnchanged, true, 'curation records clean replay immutability');
equal(curation.temporaryMaterialDeleted.cleanReplayTemporaryRootsRemaining, 0, 'no replay root remains');
equal(curation.temporaryMaterialDeleted.cleanEvidenceReplayTemporaryRootsRemaining, 0, 'no evidence replay root remains');
equal(curation.temporaryMaterialDeleted.rawOwnerBytesRetained, false, 'no raw owner bytes remain');
equal(curation.aggregateOperationsProbe.status, 'FOREIGN_FAILURE', 'curation retains aggregate non-pass classification');
equal(curation.capabilityComparison.overallAfter, 'DEGRADED', 'curation keeps broad capability status degraded');
equal(curation.cleanEvidenceReplay.trackedFiles, 30, 'curation records the exact archived evidence slice');
equal(curation.cleanEvidenceReplay.evidenceSelftestChecksPassed, 158, 'curation records the archived evidence checks');
equal(curation.cleanEvidenceReplay.sessionSealReplayPassed, true, 'curation records the archived seal replay');
equal(curation.cleanEvidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'curation records no source or shared-main mutation');
equal(index.broadGoalComplete, false, 'session index leaves the broad objective active');
equal(index.productCommit, source.commit, 'session index and source snapshot agree');
equal(index.continuationSegments.length, 1, 'session index records one sealed continuation');
equal(index.mergeGate, 'Mike Tobi / AXM', 'merge gate remains Mike Tobi / AXM');
equal(index.canonGate, 'Mike Tobi / AXM', 'CANON gate remains Mike Tobi / AXM');

const evidenceFiles = fs.readdirSync(__dirname);
check(!evidenceFiles.some(name => /\.(png|jpe?g|webp|mp4|webm)$/i.test(name)), 'no raw screenshot or recording is retained');
const retainedText = evidenceFiles.filter(name => fs.statSync(path.join(__dirname, name)).isFile()).map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(retainedText), 'evidence contains no machine-local personal or workspace path');
check(/Mike\s+Tobi \/ AXM remains the merge/.test(read('README.md')) && read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'), 'merge and CANON gate plus active broad objective remain explicit');

console.log('PASS Review Inbox interrupted retirement recovery evidence: ' + assertions + ' checks');
