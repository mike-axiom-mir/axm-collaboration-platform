#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
let assertions = 0;
function check(value, label) { assert(value, label); assertions += 1; }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function json(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function read(name) { return fs.readFileSync(path.join(__dirname, name), 'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digestObject(value, field) { const body = JSON.parse(Core.canonicalJson(value)); delete body[field]; return 'sha256:' + sha256(Core.canonicalJson(body)); }
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git command failed');
  return result.stdout;
}

const product = 'ff0b8e3a2040de6f25082e83af83c13b6cff9237';
const parent = '8f41d9e039179245d9e7923202d7c82b82158932';
const tree = '9a9beb9f5f6cc13d6ad73f1ea55cc3d683e65c9c';
equal(String(git(['rev-parse', product + '^{tree}'])).trim(), tree, 'product tree identity is exact');
equal(String(git(['rev-parse', product + '^'])).trim(), parent, 'product parent identity is exact');

const reproduction = json('CONVERGENCE_REPRODUCTION.json');
equal(reproduction.status, 'REPRODUCED', 'exact-parent races are reproduced');
equal(reproduction.baseline.resume.outer.errorCode, 'ENOENT', 'parent resume race exposes ENOENT');
equal(reproduction.baseline.finalize.outer.errorCode, 'EEXIST', 'parent finalize race exposes EEXIST');
for (const name of ['resume','finalize']) {
  const outcome = reproduction.product[name];
  equal(outcome.inner.errorCode, null, name + ' inner product caller has no raw error');
  equal(outcome.outer.errorCode, null, name + ' outer product caller has no raw error');
  equal([outcome.inner.state,outcome.outer.state].sort(), ['ALREADY_COMPLETE','RECOVERED'], name + ' product callers converge');
  equal(outcome.finalStatus, 'CURRENT', name + ' product evidence is current');
  equal(outcome.evidenceFiles, 3, name + ' product evidence retains exactly three files');
}
equal(reproduction.boundary.generalSerializationProven, false, 'reproduction proves no general serialization');
equal(reproduction.boundary.cancellationSafetyProven, false, 'reproduction proves no cancellation safety');
equal(reproduction.boundary.specialistPackagesInspected, false, 'reproduction excludes specialist packages');

const checks = json('CHECK_RESULTS.json');
equal(checks.status, 'PASS', 'scoped verification passes');
equal(checks.summary, { commands:18, passed:18, failed:0, focusedAssertions:539 }, 'scoped verification counts are exact');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length, 10, 'all ten required commands are recorded');
equal(checks.commands.filter(item => item.phase === 'FOCUSED').length, 8, 'eight focused commands are recorded');
equal(checks.resultsDigest, digestObject(checks, 'resultsDigest'), 'verification result digest is canonical');

const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
equal(aggregate.status, 'FOREIGN_FAILURE', 'aggregate operations non-pass is preserved');
equal(aggregate.exitCode, 1, 'aggregate command exits nonzero');
check(Object.values(aggregate.reachedProductChecks).every(Boolean), 'aggregate reaches both product convergence passes');
equal(aggregate.failure.errorCode, 'CURATED_VERIFICATION_INTAKE_MISSING', 'aggregate failure is typed in evidence');
equal(aggregate.comparison.serviceBlobUnchanged, true, 'failing service blob is unchanged');
equal(aggregate.comparison.selftestBlobUnchanged, true, 'failing selftest blob is unchanged');
equal(aggregate.comparison.modularIntakeScriptUnchanged, true, 'modular-intake script is unchanged');
equal(aggregate.comparison.intakeTrackedAtBaseline, false, 'curated intake is absent from parent tree');
equal(aggregate.comparison.intakeTrackedAtProduct, false, 'curated intake is absent from product tree');
equal(aggregate.comparison.intakePresentInWorkspace, false, 'curated intake is absent from workspace');
equal(aggregate.comparison.productTouchedFailingLane, false, 'product does not touch failing lane');
equal(aggregate.classification.convertedToPass, false, 'foreign failure is not converted to pass');

const clean = json('CLEAN_PRODUCT_REPLAY.json');
equal(clean.status, 'PASS', 'clean archived product replay passes');
equal(clean.productCommit, product, 'clean replay binds product commit');
equal(clean.productTree, tree, 'clean replay binds product tree');
equal(clean.trackedFiles, 97, 'clean replay contains 97 tracked dependency-slice files');
equal(clean.summary, { commands:7, passed:7, failed:0 }, 'clean replay command counts are exact');
equal(clean.trackedFilesUnchangedAfterReplay, true, 'clean replay leaves tracked files unchanged');
equal(clean.changedTrackedFiles, [], 'clean replay records no tracked changes');
equal(clean.temporaryReplayPathRetained, false, 'clean replay retains no temp path');
equal(clean.replayDigest, digestObject(clean, 'replayDigest'), 'clean replay digest is canonical');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit, product, 'source snapshot binds product commit');
equal(source.parent, parent, 'source snapshot binds parent commit');
equal(source.tree, tree, 'source snapshot binds product tree');
equal(source.files.length, 13, 'source snapshot binds 13 product files');
equal(source.productDigest, digestObject(source, 'productDigest'), 'source snapshot digest is canonical');
source.files.forEach(item => {
  const bytes = git(['show', product + ':' + item.path], null);
  equal(item.bytes, bytes.length, item.path + ' byte count is exact');
  equal(item.sha256, 'sha256:' + sha256(bytes), item.path + ' digest is exact');
});
check(source.files.every(item => !item.path.startsWith('docs/steward-runs/')), 'source snapshot excludes evidence files');
check(!source.files.some(item => /\.(?:html|css)$/i.test(item.path) || /(?:^|\/)app\.js$/i.test(item.path)), 'product changes no browser-facing file');

const leaseSource = String(git(['show', product + ':shared/operations/review-operation-lease.js']));
check(leaseSource.includes('function observeRecoveryCheckpoint('), 'product contains bounded checkpoint observer');
check(leaseSource.includes('cooperatingSingleHostRecoveryCheckpointConvergence:true'), 'product declares qualified checkpoint convergence');
check(leaseSource.includes('generalRecoverySerializationProven:false'), 'product denies general recovery serialization');
check(leaseSource.includes('retirementCancellationSafetyProven:false'), 'product denies cancellation safety');
check(!leaseSource.includes('generalRecoverySerializationProven:true'), 'product never asserts general recovery serialization');

const manifest = JSON.parse(String(git(['show', product + ':tools/review-inbox/manifest.json'])));
const contract = JSON.parse(String(git(['show', product + ':tools/review-inbox/module.contract.json'])));
equal(manifest.version, 'v1.0', 'Review Inbox manifest is v1.0');
equal(manifest.status, 'TEST', 'Review Inbox remains TEST');
equal(contract.version, manifest.version, 'manifest and contract versions agree');
check(contract.provides.includes('cooperating-single-host-interrupted-retirement-recovery-checkpoint-convergence'), 'contract provides qualified checkpoint convergence');
check(contract.provides.includes('typed-concurrent-recovery-checkpoint-collision-holds'), 'contract provides typed collision holds');
check(contract.boundaries.refuses.includes('recovery-checkpoint-convergence-as-general-serialization-cross-file-atomicity-or-cancellation-safety'), 'contract refuses boundary collapse');
const toolsIndex = JSON.parse(String(git(['show', product + ':tools-index.json'])));
const tool = toolsIndex.tools.find(item => item.id === 'review-inbox');
equal(toolsIndex.summary.capabilities, 1862, 'tools index records 1,862 capabilities');
equal(tool.version, 'v1.0', 'tools index records Review Inbox v1.0');
equal(tool.promotion.state, 'READY_FOR_HUMAN_REVIEW', 'tools index records readiness for human review only');

const before = json('CAPABILITY_GAP_BEFORE.json'), after = json('CAPABILITY_GAP_AFTER.json');
equal(before.overall, 'BLOCKED', 'parent bounded seam is blocked');
equal(after.overall, 'DEGRADED', 'optional broad gaps keep product degraded');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'all bounded required gaps are closed');
equal(after.requirements.filter(item => !item.required && item.status !== 'READY').length, 6, 'six broad optional gaps remain open');
check(after.proposedHands.every(item => item.contractStatus === 'SPEC_REQUIRED' && item.installed === false), 'open hands remain uninstalled specifications');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 9, 'nine claim-specific evidence routes are retained');
check(routes.routes.every(item => item.verdict === 'PASS' && item.counterevidence), 'every route has passing evidence and counterevidence');
check(routes.routes.some(item => item.kind === 'behavioral'), 'behavioral claims use behavioral evidence');
check(routes.routes.some(item => item.kind === 'persistence'), 'persistence claims use replay evidence');
check(routes.routes.some(item => item.kind === 'authorization'), 'authority claims use authorization evidence');
equal(routes.routesDigest, 'sha256:' + sha256(Core.canonicalJson(routes.routes)), 'evidence routes digest is canonical');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status, 'PASS', 'native surface receipt passes');
equal(native.browserFacingFilesChanged, false, 'no browser-facing file changed');
equal(native.liveBrowserRerun, false, 'no browser rerun is claimed');
equal(native.truth.generalSerializationProven, false, 'native receipt denies general serialization');
equal(native.truth.cancellationSafetyProven, false, 'native receipt denies cancellation safety');
equal(native.truth.actualHumanParticipationProven, false, 'native receipt denies human participation proof');
equal(native.truth.humanBenefitProven, false, 'native receipt denies human benefit proof');
equal(native.truth.canonAuthorized, false, 'native receipt grants no CANON authority');

const seal = json('SESSION_SEGMENT.seal.json'), segment = read('SESSION_SEGMENT.jsonl');
equal(seal.parseStatus, 'valid', 'session segment parses');
equal(seal.eventLines, 18, 'session segment retains 18 semantic events');
equal(seal.validJsonLines, 18, 'every session line is valid JSON');
equal(seal.sha256, sha256(segment), 'session seal digest matches');
const lines = segment.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(lines.map(item => item.sequence), Array.from({ length:18 }, (_, index) => index + 1), 'session sequence is contiguous');
check(lines.some(item => item.status === 'FOREIGN_FAILURE'), 'session preserves aggregate foreign failure');
check(lines.some(item => item.status === 'BROKEN'), 'session preserves exact parent broken behavior');
const index = json('SESSION_INDEX.json'), curation = json('CURATION_RECEIPT.json');
equal(index.broadGoalComplete, false, 'broad objective remains active');
equal(index.mergeGate, 'Mike Tobi / AXM', 'merge gate remains Mike Tobi / AXM');
equal(index.canonGate, 'Mike Tobi / AXM', 'CANON gate remains Mike Tobi / AXM');
equal(index.installed, false, 'product is not installed by this run');
equal(index.promoted, false, 'product is not promoted by this run');
equal(curation.status, 'PASS', 'curation receipt passes');
equal(curation.durableEventsPreserved, 18, 'curation preserves 18 semantic events');
equal(curation.retainedRawLogs, false, 'curation retains no raw logs');
equal(curation.retainedRawOwnerBytes, false, 'curation retains no raw owner bytes');
equal(curation.aggregateOperationsStatus, 'FOREIGN_FAILURE', 'curation preserves aggregate foreign failure');
equal(curation.broadGoalComplete, false, 'curation leaves broad objective active');

const files = fs.readdirSync(__dirname).filter(name => fs.statSync(path.join(__dirname, name)).isFile());
check(!files.some(name => /\.(?:png|jpe?g|webp|mp4|webm|zip)$/i.test(name)), 'no raw media or package is retained');
const retained = files.map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(retained), 'evidence contains no machine-local path');
const excludedPackageMarker = new RegExp(['AXM','MIRROR','SHADOW','SPECIALIST'].join('_'), 'i');
check(!excludedPackageMarker.test(retained), 'evidence contains no specialist-package material');
check(/Mike Tobi \/ AXM remains the merge and\s+`CANON` gate/.test(read('README.md')), 'README preserves the human gate');
check(read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'), 'frontier audit preserves goal continuity');

console.log('PASS Review Inbox retirement recovery convergence evidence: ' + assertions + ' checks');
