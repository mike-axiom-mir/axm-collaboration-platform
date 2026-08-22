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
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}

const checks = json('CHECK_RESULTS.json');
equal(checks.status, 'PASS', 'verification receipt passes');
equal(checks.summary.commands, 62, 'verification receipt contains 62 bounded commands');
equal(checks.summary.passed, 62, 'every recorded command passes');
equal(checks.summary.failed, 0, 'no recorded command fails');
equal(checks.summary.focusedAssertions, 5945, 'focused assertion aggregate is exact');
equal(checks.resultsDigest, canonicalDigest(checks, 'resultsDigest'), 'verification receipt digest is canonical');
check(checks.commands.some(item => item.command === 'node shared/operations/review-projection-recovery-selftest.js' && item.verdict === 'PASS'), 'new recovery suite is recorded');
const required = checks.commands.filter(item => item.phase === 'REQUIRED');
equal(required.length, 10, 'all ten AGENTS checks are present');
equal(required.filter(item => item.verdict === 'PASS').length, 10, 'all ten AGENTS checks pass');

const visual = json('VISUAL_RECEIPT.json');
equal(visual.status, 'PASS', 'live visual receipt passes');
equal(visual.surfaces.length, 7, 'seven selected visual commitments are retained');
equal(visual.interaction.recoveryControlsFound, 0, 'no browser recovery control was found');
equal(visual.interaction.consoleWarnings, 0, 'no browser warning was observed');
equal(visual.interaction.consoleErrors, 0, 'no browser error was observed');
equal(visual.retention.screenshotsRetained, false, 'raw screenshots were not retained');
equal(visual.retention.rawCaptureFilesCreated, 0, 'no raw capture file was created');
check(visual.surfaces.some(item => item.id === 'recovery-required-narrow' && item.viewport === '390x844'), 'narrow recovery-required state is committed');
check(visual.surfaces.some(item => item.id === 'invalid-held-desktop'), 'invalid held state is committed');

const before = json('CAPABILITY_GAP_BEFORE.json'), after = json('CAPABILITY_GAP_AFTER.json');
equal(before.requirements.filter(item => item.required && item.status !== 'READY').length, 15, 'before comparison exposes fifteen required gaps');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'after comparison closes every bounded required gap');
equal(after.requirements.filter(item => !item.required && item.status !== 'READY').length, 8, 'eight optional real-world capabilities remain open');
equal(after.overall, 'DEGRADED', 'optional gaps prevent a broad ready claim');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 7, 'seven claim-specific evidence routes are present');
equal(routes.routes.filter(item => item.verdict === 'PASS').length, 7, 'every bounded evidence route passes');
check(routes.routes.some(item => item.kind === 'persistence'), 'persistence claims use persistence evidence');
check(routes.routes.some(item => item.kind === 'authorization'), 'authority claims use authorization evidence');
check(routes.routes.some(item => item.kind === 'visual'), 'visual claims use live visual evidence');
check(routes.routes.every(item => item.counterevidence), 'every route preserves counterevidence');

const primarySeal = json('SESSION_SEGMENT.seal.json'), addendumSeal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
equal(primarySeal.parseStatus, 'valid', 'primary session segment parses');
equal(primarySeal.eventLines, 26, 'primary segment retains 26 semantic events');
equal(primarySeal.sha256, sha(fs.readFileSync(path.join(__dirname, primarySeal.source))), 'primary segment seal digest matches');
equal(addendumSeal.parseStatus, 'valid', 'addendum session segment parses');
equal(addendumSeal.eventLines, 9, 'addendum retains nine post-seal events');
equal(addendumSeal.sha256, sha(fs.readFileSync(path.join(__dirname, addendumSeal.source))), 'addendum seal digest matches');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit, '42cd6ab6965a2be0778f4737e320948e2eaaf2ed', 'source snapshot binds the product commit');
equal(source.tree, '459de8844ffddc43f70a98afc82a91feb2fb804e', 'source snapshot binds the product tree');
equal(source.files.length, 19, 'source snapshot binds nineteen product files');
equal(source.productDigest, canonicalDigest(source, 'productDigest'), 'source snapshot digest is canonical');
check(source.files.every(item => !item.path.startsWith('docs/steward-runs/') && !/AXM_MIRROR_SHADOW_SPECIALIST/i.test(item.path)), 'snapshot excludes evidence and specialist ZIP lane');
source.files.forEach(item => {
  const bytes = git(['show',source.commit + ':' + item.path], null);
  assert.equal(item.bytes, bytes.length, item.path + ' byte count drifted');
  assert.equal(item.sha256, 'sha256:' + sha(bytes), item.path + ' digest drifted');
});
assertions += source.files.length * 2;

const curation = json('CURATION_RECEIPT.json'), index = json('SESSION_INDEX.json');
equal(curation.durableEventsPreserved, 35, 'curation receipt preserves all semantic events');
equal(curation.telemetryAggregation.commandOutcomes, 62, 'curation aggregates exact command outcomes');
equal(curation.telemetryAggregation.retainedRawLogs, false, 'curation retains no raw command logs');
equal(curation.detachedReplay.recordedCommandsPassed, 62, 'detached replay covers every recorded command');
equal(curation.detachedReplay.cleanAfterReplay, true, 'detached replay stayed clean');
equal(curation.detachedReplay.pathRemoved, true, 'detached replay path was removed');
equal(index.broadGoalComplete, false, 'session index leaves the broad objective active');
equal(index.productCommit, source.commit, 'session index and source snapshot commit agree');

const evidenceFiles = fs.readdirSync(__dirname);
check(!evidenceFiles.some(name => /\.(png|jpe?g|webp|mp4|webm)$/i.test(name)), 'no raw screenshot or recording is retained');
const committedEvidence = evidenceFiles.filter(name => fs.statSync(path.join(__dirname, name)).isFile()).map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(committedEvidence), 'evidence contains no machine-local absolute path');
check(read('README.md').includes('Mike Tobi / AXM remains the merge and') && read('FRONTIER_AUDIT.md').includes('broad grounded-growth\nobjective remains active'), 'merge/CANON gate and open broad objective remain explicit');

console.log('PASS Review Projection Recovery evidence: ' + assertions + ' checks');
