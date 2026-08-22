#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const product = 'fa6f8fd94145ad58c6388bb64b62e5d75c19a46e';
const parent = '5087e5dc6d7744b9814d6b4697a1ae299e44b773';
const tree = '4527ff55d6270fdea33894fc9d4ff2126aad5f2a';
let assertions = 0;
function check(value, label) { assert(value, label); assertions += 1; }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function json(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function read(name) { return fs.readFileSync(path.join(__dirname, name), 'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digestObject(value, field) { const body = JSON.parse(Core.canonicalJson(value)); delete body[field]; return 'sha256:' + sha256(Core.canonicalJson(body)); }
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git evidence check failed');
  return result.stdout;
}

equal(String(git(['rev-parse',product + '^{tree}'])).trim(), tree, 'product tree identity is exact');
equal(String(git(['rev-parse',product + '^'])).trim(), parent, 'product parent identity is exact');

const baseline = json('BASELINE_FRONTIER_AUDIT.json');
equal(baseline.status, 'BLOCKED', 'parent bounded seam is blocked');
equal(baseline.sourceCommit, parent, 'baseline binds exact parent');
check(Object.values(baseline.runtime).every(value => value === false), 'parent runtime exports no withdrawal or decision capability');
check(Object.values(baseline.source).every(value => value === false), 'parent sources and contract expose no withdrawal seam');
equal(baseline.receiptDigest, digestObject(baseline, 'receiptDigest'), 'baseline receipt digest is canonical');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit, product, 'source snapshot binds product commit');
equal(source.parent, parent, 'source snapshot binds parent commit');
equal(source.tree, tree, 'source snapshot binds product tree');
equal(source.files.length, 20, 'source snapshot binds twenty product files');
equal(source.productDigest, digestObject(source, 'productDigest'), 'source snapshot digest is canonical');
source.files.forEach(item => {
  const bytes = git(['show',product + ':' + item.path], null);
  equal(item.bytes, bytes.length, item.path + ' byte count is exact');
  equal(item.sha256, 'sha256:' + sha256(bytes), item.path + ' digest is exact');
});
check(source.files.every(item => !item.path.startsWith('docs/steward-runs/')), 'source snapshot excludes evidence files');
check(!source.files.some(item => /\.(?:html|css)$/i.test(item.path) || /(?:^|\/)app\.js$/i.test(item.path)), 'product changes no browser-facing file');

const checks = json('CHECK_RESULTS.json');
equal(checks.status, 'PASS', 'scoped verification passes');
equal(checks.summary, { commands:19, passed:19, failed:0, focusedAssertions:586 }, 'verification counts are exact');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length, 10, 'all ten required commands are recorded');
equal(checks.commands.filter(item => item.phase === 'FOCUSED').length, 9, 'nine focused commands are recorded');
equal(checks.resultsDigest, digestObject(checks, 'resultsDigest'), 'verification result digest is canonical');

const clean = json('CLEAN_PRODUCT_REPLAY.json');
equal(clean.status, 'PASS', 'clean product replay passes');
equal(clean.productCommit, product, 'clean replay binds product commit');
equal(clean.productTree, tree, 'clean replay binds product tree');
equal(clean.trackedFiles, 102, 'clean replay binds 102 tracked dependency-slice files');
equal(clean.summary, { commands:9, passed:9, failed:0, focusedAssertions:586 }, 'clean replay counts are exact');
equal(clean.trackedFilesUnchangedAfterReplay, true, 'clean replay changes no tracked bytes');
equal(clean.changedTrackedFiles, [], 'clean replay records no changed files');
equal(clean.temporaryReplayPathRetained, false, 'clean replay retains no temp root');
equal(clean.replayDigest, digestObject(clean, 'replayDigest'), 'clean replay digest is canonical');

const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
equal(aggregate.status, 'FOREIGN_FAILURE', 'aggregate non-pass is preserved');
equal(aggregate.exitCode, 1, 'aggregate exits nonzero');
check(Object.values(aggregate.reachedProductChecks).every(Boolean), 'aggregate reaches both v4.9 product checks');
equal(aggregate.failure.errorCode, 'CURATED_VERIFICATION_INTAKE_MISSING', 'aggregate failure has an exact evidence code');
equal(aggregate.failure.exactMessagePresent, true, 'aggregate output contains the exact missing-intake message');
equal(aggregate.comparison.serviceBlobUnchanged, true, 'failing service blob is unchanged');
equal(aggregate.comparison.selftestBlobUnchanged, true, 'failing selftest blob is unchanged');
equal(aggregate.comparison.modularIntakeScriptUnchanged, true, 'modular-intake script is unchanged');
equal(aggregate.comparison.intakeTrackedAtBaseline, false, 'curated intake is absent from parent');
equal(aggregate.comparison.intakeTrackedAtProduct, false, 'curated intake is absent from product');
equal(aggregate.comparison.intakePresentInWorkspace, false, 'curated intake is absent from workspace');
equal(aggregate.comparison.productTouchedFailingLane, false, 'product does not touch failing lane');
equal(aggregate.classification.convertedToPass, false, 'foreign failure is not converted to pass');
equal(aggregate.receiptDigest, digestObject(aggregate, 'receiptDigest'), 'aggregate receipt digest is canonical');

const before = json('FRONTIER_GAP_BEFORE.json'), after = json('FRONTIER_GAP_AFTER.json');
equal(before.overall, 'BLOCKED', 'capability comparator starts blocked');
equal(after.overall, 'DEGRADED', 'optional broad gaps keep the product degraded');
equal(after.requirements.filter(item => item.required && item.status === 'READY').length, 6, 'six bounded requirements are ready');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'no bounded required gap remains');
equal(after.requirements.filter(item => !item.required && item.status === 'OPTIONAL_GAP').length, 3, 'three optional broad gaps remain');
equal(after.missingCapabilities.sort(), ['review.lease.holder-liveness.authenticated','review.retirement.cancel.general-safety','storage.cross-file.atomicity'], 'missing capability identifiers remain exact');

const leaseSource = String(git(['show',product + ':shared/operations/review-operation-lease.js']));
check(leaseSource.includes('function withdrawRetirement(input)'), 'product contains explicit withdrawal');
check(leaseSource.includes('function claimRetirementDecision('), 'product contains exclusive decision claim');
check(leaseSource.includes('ownerLockMutatedByWithdrawal:false'), 'runtime denies withdrawal owner-lock mutation');
check(leaseSource.includes('generalRetirementCancellationSafetyProven:false'), 'runtime denies general cancellation safety');
check(!leaseSource.includes('generalRetirementCancellationSafetyProven:true'), 'runtime never asserts general cancellation safety');
const manifest = JSON.parse(String(git(['show',product + ':tools/review-inbox/manifest.json'])));
const contract = JSON.parse(String(git(['show',product + ':tools/review-inbox/module.contract.json'])));
equal(manifest.version, 'v1.1', 'Review Inbox manifest is v1.1');
equal(manifest.status, 'TEST', 'Review Inbox remains TEST');
equal(contract.version, manifest.version, 'manifest and contract versions agree');
check(contract.provides.includes('cooperating-single-host-retirement-decision-arbitration'), 'contract declares qualified decision arbitration');
check(contract.provides.includes('owner-lock-preserving-retirement-intent-withdrawal'), 'contract declares owner-lock-preserving withdrawal');
check(contract.boundaries.refuses.includes('retirement-intent-withdrawal-as-lease-release-holder-liveness-or-general-cancellation-safety'), 'contract refuses safety collapse');
check(contract.boundaries.refuses.includes('decision-arbitration-as-cross-file-atomicity-multi-host-or-external-writer-exclusion'), 'contract refuses substrate collapse');
const toolsIndex = JSON.parse(String(git(['show',product + ':tools-index.json'])));
const reviewTool = toolsIndex.tools.find(item => item.id === 'review-inbox');
equal(toolsIndex.summary.capabilities, 1869, 'tools index records 1,869 capabilities');
equal(reviewTool.version, 'v1.1', 'tools index records Review Inbox v1.1');
equal(reviewTool.promotion.state, 'READY_FOR_HUMAN_REVIEW', 'tools index records queue readiness only');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 10, 'ten claim-specific evidence routes are retained');
check(routes.routes.every(item => item.verdict === 'PASS' && item.counterevidence), 'every route has evidence and counterevidence');
check(routes.routes.some(item => item.kind === 'behavioral'), 'behavioral claims use behavioral evidence');
check(routes.routes.some(item => item.kind === 'persistence'), 'persistence claims use clean replay evidence');
check(routes.routes.some(item => item.kind === 'authorization'), 'authority claims use contract evidence');
equal(routes.routesDigest, 'sha256:' + sha256(Core.canonicalJson(routes.routes)), 'evidence routes digest is canonical');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status, 'PASS', 'native surface receipt passes');
equal(native.browserFacingFilesChanged, false, 'no browser-facing file changed');
equal(native.liveBrowserRerun, false, 'no browser rerun is claimed');
equal(native.truth.cooperatingSingleHostProceedWithdrawArbitration, true, 'qualified arbitration claim is retained');
equal(native.truth.generalCancellationSafetyProven, false, 'general cancellation safety remains false');
equal(native.truth.holderLivenessOrTerminationProven, false, 'holder state remains unproven');
equal(native.truth.actualHumanParticipationProven, false, 'human participation remains unproven');
equal(native.truth.humanBenefitProven, false, 'human benefit remains unproven');
equal(native.truth.canonAuthorized, false, 'CANON authority remains false');

const seal = json('SESSION_SEGMENT.seal.json'), segment = read('SESSION_SEGMENT.jsonl');
equal(seal.parseStatus, 'valid', 'session segment parses');
equal(seal.eventLines, 18, 'session segment retains 18 semantic events');
equal(seal.validJsonLines, 18, 'every session line is valid JSON');
equal(seal.sha256, sha256(segment), 'session seal digest matches');
const events = segment.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence), Array.from({ length:18 }, (_, index) => index + 1), 'session sequence is contiguous');
check(events.some(item => item.status === 'FOREIGN_FAILURE'), 'session preserves aggregate foreign failure');
equal(json('SESSION_INDEX.json').broadGoalComplete, false, 'broad objective remains active');
equal(json('SESSION_INDEX.json').mergeGate, 'Mike Tobi / AXM', 'merge gate remains Mike Tobi / AXM');
equal(json('SESSION_INDEX.json').canonGate, 'Mike Tobi / AXM', 'CANON gate remains Mike Tobi / AXM');
const curation = json('CURATION_RECEIPT.json');
equal(curation.status, 'PASS', 'curation receipt passes');
equal(curation.durableEventsPreserved, 18, 'curation retains 18 semantic events');
equal(curation.retainedRawLogs, false, 'curation retains no raw logs');
equal(curation.retainedRawOwnerBytes, false, 'curation retains no raw owner bytes');
equal(curation.aggregateOperationsStatus, 'FOREIGN_FAILURE', 'curation preserves aggregate failure');
equal(curation.broadGoalComplete, false, 'curation leaves broad objective active');

const files = fs.readdirSync(__dirname).filter(name => fs.statSync(path.join(__dirname,name)).isFile());
check(!files.some(name => /\.(?:png|jpe?g|webp|mp4|webm|zip)$/i.test(name)), 'no raw media or package is retained');
const retained = files.map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(retained), 'evidence contains no machine-local path');
check(/Mike Tobi \/ AXM remains the merge and\s+`CANON` gate/.test(read('README.md')), 'README preserves the human gate');
check(read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'), 'frontier audit preserves goal continuity');

console.log('PASS Review Inbox retirement-intent withdrawal v4.9 evidence: ' + assertions + ' checks');
