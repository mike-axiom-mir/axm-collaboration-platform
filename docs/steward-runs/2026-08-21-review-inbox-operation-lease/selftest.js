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
function canonicalDigest(value, field) { const copy = JSON.parse(Core.canonicalJson(value)); delete copy[field]; return 'sha256:' + sha(Core.canonicalJson(copy)); }
function jsonDigest(value, field) { const copy = JSON.parse(JSON.stringify(value)); delete copy[field]; return 'sha256:' + sha(JSON.stringify(copy)); }
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}

const checks = json('CHECK_RESULTS.json');
equal(checks.status, 'PASS', 'bounded verification receipt passes');
equal(checks.summary.commands, 66, 'verification receipt contains 66 commands');
equal(checks.summary.passed, 66, 'all recorded commands pass');
equal(checks.summary.failed, 0, 'no recorded command fails');
equal(checks.summary.focusedAssertions, 6152, 'focused assertion aggregate is exact');
equal(checks.resultsDigest, canonicalDigest(checks, 'resultsDigest'), 'verification digest is canonical');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length, 10, 'all ten AGENTS commands are present');
equal(checks.commands.filter(item => item.phase === 'REQUIRED' && item.verdict === 'PASS').length, 10, 'all ten AGENTS commands pass');
check(checks.commands.some(item => item.command === 'node shared/operations/review-operation-lease-selftest.js' && item.assertions === 48 && item.verdict === 'PASS'), '48-assertion lease suite is recorded');

const baseline = json('BASELINE_RACE_REPRODUCTION.json');
equal(baseline.status, 'REPRODUCED', 'baseline race is reproduced');
equal(baseline.result.expectedItems, 8, 'baseline expected eight items');
equal(baseline.result.actualItems, 1, 'baseline retained one item');
equal(baseline.result.lostItems, 7, 'baseline lost seven items');
equal(baseline.result.failedChildren, 4, 'baseline recorded four child failures');
equal(baseline.boundary.productionFrequencyProven, false, 'production frequency is not claimed');
equal(baseline.boundary.naturalUnsynchronizedAttemptConclusive, false, 'natural attempt stays inconclusive');
equal(baseline.boundary.specialistPackagesInspected, false, 'specialist packages stayed excluded');

const replay = json('CLEAN_PRODUCT_REPLAY.json');
equal(replay.status, 'PASS', 'clean product slice replay passes');
equal(replay.productCommit, '3b8730c522c7441eb7b17d10c4fed0e9ca2c39da', 'clean replay binds product commit');
equal(replay.productTree, '788be63cd49c73abbf3e7480e539d9769863e896', 'clean replay binds product tree');
equal(replay.trackedFiles, 583, 'clean slice contains 583 tracked files');
equal(replay.summary.commands, 9, 'clean replay contains nine commands');
equal(replay.summary.passed, 9, 'all clean replay commands pass');
equal(replay.summary.failed, 0, 'no clean replay command fails');
equal(replay.trackedFilesUnchangedAfterReplay, true, 'clean replay leaves tracked files unchanged');
equal(replay.changedTrackedFiles, [], 'clean replay records no changed tracked files');
equal(replay.replayDigest, jsonDigest(replay, 'replayDigest'), 'clean replay digest matches its deterministic JSON body');

const evidenceReplay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(evidenceReplay.status, 'PASS', 'clean archived evidence replay passes');
equal(evidenceReplay.evidenceCommit, '5e8cad7503b18a558fc6cadd751b54dd0c992471', 'evidence replay binds primary evidence commit');
equal(evidenceReplay.evidenceTree, '459f6f3b8ea5bc001b74d31c4bdb2748d5d310a1', 'evidence replay binds primary evidence tree');
equal(evidenceReplay.trackedFiles, 28, 'evidence replay contains 28 tracked files');
equal(evidenceReplay.selftest.verdict, 'PASS', 'archived evidence selftest passes');
check(evidenceReplay.selftest.stdout.includes('105 checks'), 'archived evidence selftest reports 105 checks');
equal(evidenceReplay.sealReplay.verdict, 'PASS', 'archived seal replay passes');
equal(evidenceReplay.sealReplay.eventLines, 30, 'archived seal replay observes 30 events');
equal(evidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'evidence replay did not mutate a source checkout or shared main');
equal(evidenceReplay.replayDigest, jsonDigest(evidenceReplay, 'replayDigest'), 'evidence replay digest matches its deterministic JSON body');

const visual = json('VISUAL_RECEIPT.json');
equal(visual.status, 'PASS', 'live visual receipt passes');
equal(visual.surfaces.length, 3, 'three selected screenshot digests are retained');
equal(visual.interaction.freeSelectedVoteDisabled, false, 'free selected ordinary vote is enabled');
equal(visual.interaction.heldSelectedVoteDisabled, true, 'held selected ordinary vote is disabled');
equal(visual.interaction.heldSelectedEvidenceContainsOperationLeaseEvidence, true, 'held selected evidence includes lease evidence');
equal(visual.interaction.unlockControlsFound, 0, 'no browser unlock control was found');
equal(visual.interaction.consoleWarnings, 0, 'no browser warning was observed');
equal(visual.interaction.consoleErrors, 0, 'no browser error was observed');
equal(visual.responsive.horizontalOverflow, false, 'narrow viewport has no horizontal overflow');
check(visual.surfaces.some(item => item.id === 'held-status-narrow' && item.viewport === '390x844'), 'narrow held surface is committed');
equal(visual.retention.screenshotsRetained, false, 'raw screenshots were not retained');
equal(visual.retention.rawCaptureFilesCreated, 0, 'no raw capture files were created');

const before = json('CAPABILITY_GAP_BEFORE.json'), after = json('CAPABILITY_GAP_AFTER.json');
equal(before.requirements.filter(item => item.required && item.status !== 'READY').length, 9, 'before comparison exposes nine required component gaps');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'after comparison closes every bounded required gap');
equal(after.requirements.filter(item => !item.required && item.status !== 'READY').length, 8, 'eight optional capability groups remain open');
equal(after.overall, 'DEGRADED', 'optional gaps prevent a broad ready claim');
equal(after.proposedHands, [], 'no new hand is proposed by this bounded milestone');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 7, 'seven claim-specific evidence routes are present');
equal(routes.routes.filter(item => item.verdict === 'PASS').length, 7, 'every bounded evidence route passes');
check(routes.routes.some(item => item.kind === 'persistence'), 'persistence claims use persistence evidence');
check(routes.routes.some(item => item.kind === 'authorization'), 'authority claims use authorization evidence');
check(routes.routes.some(item => item.kind === 'visual'), 'visual claims use visual evidence');
check(routes.routes.every(item => item.counterevidence), 'every route preserves counterevidence');

const seal = json('SESSION_SEGMENT.seal.json'), addendumSeal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
equal(seal.parseStatus, 'valid', 'session segment parses');
equal(seal.eventLines, 30, 'session segment retains 30 semantic events');
equal(seal.sha256, sha(fs.readFileSync(path.join(__dirname, seal.source))), 'session seal digest matches');
equal(addendumSeal.parseStatus, 'valid', 'session addendum parses');
equal(addendumSeal.eventLines, 4, 'session addendum retains four semantic events');
equal(addendumSeal.sha256, sha(fs.readFileSync(path.join(__dirname, addendumSeal.source))), 'session addendum seal digest matches');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit, '3b8730c522c7441eb7b17d10c4fed0e9ca2c39da', 'source snapshot binds product commit');
equal(source.tree, '788be63cd49c73abbf3e7480e539d9769863e896', 'source snapshot binds product tree');
equal(source.files.length, 17, 'source snapshot binds seventeen product files');
equal(source.productDigest, canonicalDigest(source, 'productDigest'), 'source snapshot digest is canonical');
check(source.files.every(item => !item.path.startsWith('docs/steward-runs/') && !/AXM_MIRROR_SHADOW_SPECIALIST/i.test(item.path)), 'snapshot excludes evidence and specialist ZIP lane');
source.files.forEach(item => {
  const bytes = git(['show',source.commit + ':' + item.path], null);
  assert.equal(item.bytes, bytes.length, item.path + ' byte count drifted');
  assert.equal(item.sha256, 'sha256:' + sha(bytes), item.path + ' digest drifted');
});
assertions += source.files.length * 2;

const curation = json('CURATION_RECEIPT.json'), index = json('SESSION_INDEX.json');
equal(curation.durableEventsPreserved, 34, 'curation preserves every semantic event');
equal(curation.sealDigest, 'sha256:' + seal.sha256, 'curation binds the session seal');
equal(curation.continuationSegments[0].sealDigest, 'sha256:' + addendumSeal.sha256, 'curation binds the addendum seal');
equal(curation.telemetryAggregation.commandOutcomes, 66, 'curation aggregates exact command outcomes');
equal(curation.telemetryAggregation.retainedRawLogs, false, 'curation retains no raw command logs');
equal(curation.cleanProductReplay.recordedCommandsPassed, 9, 'curation records nine clean replay passes');
equal(curation.cleanProductReplay.trackedFilesUnchanged, true, 'curation records clean replay immutability');
equal(curation.temporaryMaterialDeleted.cleanReplayTemporaryRootsRemaining, 0, 'no replay root remains');
equal(curation.temporaryMaterialDeleted.cleanReplayRegistrationsRemaining, 0, 'no replay registration remains');
equal(curation.cleanEvidenceReplay.evidenceSelftestChecksPassed, 105, 'curation records the archived evidence checks');
equal(curation.cleanEvidenceReplay.sessionSealReplayPassed, true, 'curation records the archived seal replay');
equal(curation.temporaryMaterialDeleted.cleanEvidenceReplayTemporaryRootsRemaining, 0, 'no evidence replay root remains');
equal(index.broadGoalComplete, false, 'session index leaves the broad objective active');
equal(index.productCommit, source.commit, 'session index and source snapshot agree');
equal(index.continuationSegments.length, 1, 'session index records one sealed continuation');

const evidenceFiles = fs.readdirSync(__dirname);
check(!evidenceFiles.some(name => /\.(png|jpe?g|webp|mp4|webm)$/i.test(name)), 'no raw screenshot or recording is retained');
const committedEvidence = evidenceFiles.filter(name => fs.statSync(path.join(__dirname, name)).isFile()).map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(committedEvidence), 'evidence contains no machine-local personal or workspace path');
check(read('README.md').includes('Mike Tobi / AXM remains the merge') && read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'), 'merge and CANON gate plus active broad objective remain explicit');

console.log('PASS Review Inbox operation lease evidence: ' + assertions + ' checks');
