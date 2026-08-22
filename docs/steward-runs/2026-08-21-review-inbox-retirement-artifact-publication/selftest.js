#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const product = 'c64dd671c0c4bed1f798a546de879b48c8ac93cc';
const parent = '0ac8c4d6b3aa30636a17955ea67c79dfcff45efa';
const tree = '18eca92357ec1aace6f9b0c0ee6e1a8c5df2c8a8';
let assertions = 0;
function check(value, label) { assert(value, label); assertions += 1; }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function json(name) { return JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8')); }
function read(name) { return fs.readFileSync(path.join(__dirname,name),'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digestObject(value, field) { const body = JSON.parse(Core.canonicalJson(value)); delete body[field]; return 'sha256:' + sha256(Core.canonicalJson(body)); }
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git evidence check failed');
  return result.stdout;
}

equal(String(git(['rev-parse',product + '^{tree}'])).trim(), tree, 'product tree identity is exact');
equal(String(git(['rev-parse',product + '^'])).trim(), parent, 'product parent identity is exact');

const baseline = json('BASELINE_PUBLICATION_REPRODUCTION.json');
equal(baseline.status, 'REPRODUCED', 'v4.9 authoritative-open crash is reproduced');
equal(baseline.sourceCommit, 'fa6f8fd94145ad58c6388bb64b62e5d75c19a46e', 'baseline binds exact v4.9 product commit');
equal(baseline.observations.map(item => item.artifact), ['intent','decision','result'], 'baseline covers all three retirement JSON artifacts');
check(baseline.observations.every(item => item.crashExitCode === 70 && item.authoritativeFileExists && item.authoritativeBytes === 0 && !item.authoritativeJsonValid && item.recoveryState === 'HELD'), 'each baseline crash leaves a zero-byte invalid authoritative artifact held');
equal(baseline.temporaryFixtureRetained, false, 'baseline retains no temp fixture');
equal(baseline.truth.currentProductEvaluated, false, 'baseline does not impersonate current-product evidence');
equal(baseline.truth.powerLossEvaluated, false, 'baseline makes no power-loss claim');
equal(baseline.receiptDigest, digestObject(baseline,'receiptDigest'), 'baseline receipt digest is canonical');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit, product, 'source snapshot binds product commit');
equal(source.parent, parent, 'source snapshot binds parent commit');
equal(source.tree, tree, 'source snapshot binds product tree');
equal(source.files.length, 18, 'source snapshot binds eighteen product files');
equal(source.browserFacingFilesChanged, false, 'product changes no browser-facing file');
equal(source.evidenceFilesIncluded, false, 'product commit excludes steward evidence');
equal(source.productDigest, digestObject(source,'productDigest'), 'source snapshot digest is canonical');
source.files.forEach(item => {
  const bytes = git(['show',product + ':' + item.path], null);
  equal(item.bytes, bytes.length, item.path + ' byte count is exact');
  equal(item.sha256, 'sha256:' + sha256(bytes), item.path + ' digest is exact');
});

const checks = json('CHECK_RESULTS.json');
equal(checks.status, 'PASS', 'scoped verification passes');
equal(checks.summary, { commands:20, passed:20, failed:0, focusedAssertions:725 }, 'verification counts are exact');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length, 10, 'all ten required commands are recorded');
equal(checks.commands.filter(item => item.phase === 'FOCUSED').length, 10, 'ten focused commands are recorded');
check(checks.commands.every(item => item.exitCode === 0 && item.verdict === 'PASS'), 'every scoped command exits zero');
check(checks.commands.some(item => item.command === 'node shared/operations/review-operation-lease-retirement-publication-selftest.js' && item.assertions === 125), '125-assertion publication suite is recorded');
equal(checks.resultsDigest, digestObject(checks,'resultsDigest'), 'verification receipt digest is canonical');

const clean = json('CLEAN_PRODUCT_REPLAY.json');
equal(clean.status, 'PASS', 'clean product replay passes');
equal(clean.productCommit, product, 'clean replay binds product commit');
equal(clean.productTree, tree, 'clean replay binds product tree');
equal(clean.trackedFiles, 104, 'clean replay binds 104 dependency-slice files');
equal(clean.summary, { commands:10, passed:10, failed:0, focusedAssertions:725 }, 'clean replay counts are exact');
equal(clean.trackedFilesUnchangedAfterReplay, true, 'clean replay changes no tracked bytes');
equal(clean.changedTrackedFiles, [], 'clean replay records no changed files');
equal(clean.temporaryReplayPathRetained, false, 'clean replay retains no temp root');
equal(clean.specialistPackageIntakeAttempted, false, 'clean replay does not enter specialist package lane');
equal(clean.replayDigest, digestObject(clean,'replayDigest'), 'clean replay digest is canonical');

const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
equal(aggregate.status, 'FOREIGN_FAILURE', 'aggregate nonpass is preserved');
equal(aggregate.exitCode, 1, 'aggregate exits nonzero');
check(Object.values(aggregate.reachedProductChecks).every(Boolean), 'aggregate reaches all recorded product checks');
equal(aggregate.failure.errorCode, 'CURATED_VERIFICATION_INTAKE_MISSING', 'aggregate failure has exact evidence code');
equal(aggregate.failure.exactMessagePresent, true, 'aggregate contains exact missing-intake message');
check(aggregate.comparison.serviceBlobUnchanged && aggregate.comparison.selftestBlobUnchanged && aggregate.comparison.modularIntakeScriptUnchanged, 'failing lane and route remain unchanged');
equal(aggregate.comparison.intakePresentInWorkspace, false, 'missing curated intake remains absent');
equal(aggregate.comparison.productTouchedFailingLane, false, 'product does not touch failing lane');
equal(aggregate.classification.convertedToPass, false, 'foreign failure is not converted to pass');
equal(aggregate.receiptDigest, digestObject(aggregate,'receiptDigest'), 'aggregate receipt digest is canonical');

const before = json('FRONTIER_GAP_BEFORE.json'), after = json('FRONTIER_GAP_AFTER.json');
equal(before.overall, 'BLOCKED', 'capability comparator starts blocked');
equal(before.requirements.filter(item => item.required && item.status === 'BLOCKED').length, 7, 'seven required publication gaps are initially blocked');
equal(after.overall, 'DEGRADED', 'optional broad gaps keep the result degraded');
equal(after.requirements.filter(item => item.required && item.status === 'READY').length, 7, 'seven bounded required capabilities are ready');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'no bounded required capability remains open');
equal(after.requirements.filter(item => !item.required && item.status === 'OPTIONAL_GAP').length, 4, 'four optional broad gaps remain');
equal(after.missingCapabilities.sort(), ['review.retirement.json.atomic-publication-without-hard-links','review.retirement.json.stale-stage-reclamation','storage.cross-file.atomicity','storage.power-loss-durability.proven'], 'optional missing capabilities remain exact');

const leaseSource = String(git(['show',product + ':shared/operations/review-operation-lease.js']));
check(leaseSource.indexOf("fs.openSync(stageFile, 'wx', 0o600)") < leaseSource.indexOf('fs.fsyncSync(handle)') && leaseSource.indexOf('fs.fsyncSync(handle)') < leaseSource.indexOf('fs.linkSync(stageFile, file)'), 'product source preserves stage-open, fsync, hard-link order');
check(!leaseSource.includes("fs.openSync(file, 'wx'"), 'publisher never opens authoritative path for write');
check(leaseSource.includes('function retirementPublicationStatus()'), 'product exposes bounded host-local publication status');
check(leaseSource.includes('staleStageReclamationProvided:false') && leaseSource.includes('hardLinkFreeAtomicFallbackProvided:false') && leaseSource.includes('powerLossDurabilityProven:false'), 'runtime retains declared storage limits');
check(!leaseSource.includes('powerLossDurabilityProven:true') && !leaseSource.includes('crossFileAtomicityProven:true'), 'runtime never inflates durability or atomicity');
const publicationTest = String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-selftest.js']));
check(publicationTest.includes("for (const artifact of ['intent','decision','result'])") && publicationTest.includes("for (const phase of ['pre','post'])"), 'product test covers six artifact-phase crash cases');
check(publicationTest.includes("process.exit(phase === 'pre' ? 70 : 71)"), 'crash matrix uses real child-process termination');

const manifest = JSON.parse(String(git(['show',product + ':tools/review-inbox/manifest.json'])));
const contract = JSON.parse(String(git(['show',product + ':tools/review-inbox/module.contract.json'])));
equal(manifest.version, 'v1.2', 'Review Inbox manifest is v1.2');
equal(manifest.status, 'TEST', 'Review Inbox remains TEST');
equal(contract.version, manifest.version, 'manifest and contract versions agree');
check(contract.provides.includes('process-crash-consistent-intent-decision-result-publication'), 'contract declares bounded publication capability');
check(contract.boundaries.refuses.includes('retirement-artifact-publication-as-power-loss-durability-or-cross-file-atomicity'), 'contract refuses durability and transaction collapse');
check(contract.boundaries.refuses.includes('browser-or-api-retirement-publication-status'), 'contract refuses browser/API publication status');
const toolsIndex = JSON.parse(String(git(['show',product + ':tools-index.json'])));
const reviewTool = toolsIndex.tools.find(item => item.id === 'review-inbox');
equal(toolsIndex.summary.capabilities, 1873, 'tools index records 1,873 capabilities');
equal(reviewTool.version, 'v1.2', 'tools index records Review Inbox v1.2');
equal(reviewTool.promotion.state, 'READY_FOR_HUMAN_REVIEW', 'tools index records queue readiness only');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 12, 'twelve claim-specific evidence routes are retained');
check(routes.routes.every(item => item.verdict === 'PASS' && item.counterevidence), 'every route has evidence and counterevidence');
check(routes.routes.some(item => item.kind === 'behavioral'), 'behavioral claims use behavioral evidence');
check(routes.routes.some(item => item.kind === 'persistence'), 'persistence claims use replay evidence');
check(routes.routes.some(item => item.kind === 'authorization'), 'authority claims use contract evidence');
check(routes.routes.some(item => item.kind === 'visual'), 'browser-scope claim has an explicit visual route');
equal(routes.routesDigest, 'sha256:' + sha256(Core.canonicalJson(routes.routes)), 'evidence routes digest is canonical');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status, 'PASS', 'bounded native surface receipt passes');
equal(native.liveBrowserRerun, false, 'no browser rerun is claimed');
equal(native.browserRenderClickTest, 'NOT_RUN_NO_BROWSER_FILES_CHANGED', 'browser test status is exact');
equal(native.realChildProcessCrashCases, 6, 'native receipt records six crash cases');
equal(native.truth.perArtifactProcessCrashConsistencyObserved, true, 'qualified process-crash consistency is retained');
equal(native.truth.powerLossDurabilityProven, false, 'power-loss durability remains false');
equal(native.truth.crossFileAtomicityProven, false, 'cross-file atomicity remains false');
equal(native.truth.humanBenefitProven, false, 'human benefit remains unproven');
equal(native.truth.canonAuthorized, false, 'CANON authority remains false');
equal(native.receiptDigest, digestObject(native,'receiptDigest'), 'native receipt digest is canonical');

const seal = json('SESSION_SEGMENT.seal.json'), segment = read('SESSION_SEGMENT.jsonl');
equal(seal.parseStatus, 'valid', 'session segment parses');
equal(seal.eventLines, 16, 'session segment retains sixteen semantic events');
equal(seal.validJsonLines, 16, 'every session line is valid JSON');
equal(seal.sha256, sha256(segment), 'session seal digest matches');
const events = segment.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence), Array.from({ length:16 }, (_, index) => index + 1), 'session sequence is contiguous');
check(events.some(item => item.status === 'FOREIGN_FAILURE'), 'session preserves aggregate foreign failure');
const sessionIndex = json('SESSION_INDEX.json');
equal(sessionIndex.broadGoalComplete, false, 'broad objective remains active');
equal(sessionIndex.mergeGate, 'Mike Tobi / AXM', 'merge gate remains Mike Tobi / AXM');
equal(sessionIndex.canonGate, 'Mike Tobi / AXM', 'CANON gate remains Mike Tobi / AXM');
equal(sessionIndex.specialistPackageIntakeAttempted, false, 'specialist package lane remains untouched');
const curation = json('CURATION_RECEIPT.json');
equal(curation.status, 'PASS', 'curation receipt passes');
equal(curation.durableEventsPreserved, 16, 'curation retains sixteen semantic events');
equal(curation.retainedRawLogs, false, 'curation retains no raw logs');
equal(curation.retainedRawOwnerBytes, false, 'curation retains no raw owner bytes');
equal(curation.aggregateOperationsStatus, 'FOREIGN_FAILURE', 'curation preserves aggregate failure');
equal(curation.broadGoalComplete, false, 'curation leaves broad objective active');

const files = fs.readdirSync(__dirname).filter(name => fs.statSync(path.join(__dirname,name)).isFile());
check(!files.some(name => /\.(?:png|jpe?g|webp|mp4|webm|zip)$/i.test(name)), 'no raw media or package is retained');
const retained = files.map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(retained), 'evidence contains no machine-local path');
check(/Mike Tobi \/ AXM remains the merge and `CANON` gate/.test(read('README.md')), 'README preserves the human gate');
check(read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'), 'frontier audit preserves goal continuity');

console.log('PASS Review Inbox retirement artifact publication v5.0 evidence: ' + assertions + ' checks');
