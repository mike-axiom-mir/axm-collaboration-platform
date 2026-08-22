#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Redaction = require('../../../shared/readiness/diagnostic-redaction');

const ROOT = path.resolve(__dirname, '../../..');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const json = name => JSON.parse(read(name));
let checks = 0;
function check(value, label) { assert(value, label); checks += 1; }
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); checks += 1; }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function jsonDigest(value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy[field];
  return 'sha256:' + sha(JSON.stringify(copy));
}
function canonicalDigest(value, field) {
  const copy = JSON.parse(Core.canonicalJson(value));
  delete copy[field];
  return 'sha256:' + sha(Core.canonicalJson(copy));
}
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}

const scoped = json('CHECK_RESULTS.json');
equal(scoped.status, 'PASS', 'scoped verification passes');
equal(scoped.productCommit, '0533987856b321d67ede5f6d8a3fd8867f9cfbfb', 'scoped receipt binds product commit');
equal(scoped.productTree, '6007cd2fc1143df2f2cf81ecc4639eed28c3274d', 'scoped receipt binds product tree');
equal(scoped.summary.commands, 19, 'scoped receipt records nineteen commands');
equal(scoped.summary.passed, 19, 'every scoped command passes');
equal(scoped.summary.failed, 0, 'no scoped command fails');
equal(scoped.summary.focusedAssertions, 186, 'focused assertion total is exact');
equal(scoped.summary.focusedControls, 255, 'package path control total is exact');
equal(scoped.summary.requiredCommands, 10, 'all ten required commands are present');
equal(scoped.commands.filter(row => row.phase === 'REQUIRED' && row.verdict === 'PASS').length, 10, 'all required commands pass');
equal(scoped.resultsDigest, jsonDigest(scoped, 'resultsDigest'), 'scoped receipt digest is exact');
equal(scoped.rawCommandOutputRetained, false, 'scoped receipt retains no raw command output');
check(scoped.commands.some(row => row.command === 'node shared/readiness/diagnostic-redaction-selftest.js' && row.assertions === 25), 'direct 25-assertion suite is recorded');
check(scoped.commands.some(row => row.command === 'node shared/readiness/tools-index-diagnostic-privacy-selftest.js' && row.assertions === 27), 'artifact 27-assertion suite is recorded');
check(scoped.commands.some(row => row.command === 'node tools/review-inbox/selftest.js' && row.assertions === 134), 'Review Inbox continuity suite is recorded');
check(scoped.commands.every(row => row.diagnostic === null), 'passing scoped results contain no diagnostic tails');

const baseline = json('BASELINE_MACHINE_PATH_LEAK.json');
equal(baseline.status, 'REPRODUCED', 'parent path leak is reproduced');
equal(baseline.baselineCommit, 'f9558a2cb1427167c1cf7cc5e42f9fe35f086884', 'baseline commit is exact');
equal(baseline.baselineTree, '24f5fbca08ca705932e47175105134c747fd84f1', 'baseline tree is exact');
equal(baseline.source.exactGitBlobsInspected, true, 'baseline uses exact Git blobs');
equal(baseline.source.workingTreeFilesUsed, false, 'baseline observation does not substitute working files');
equal(baseline.observation.retainedFailureTails, 12, 'baseline retained twelve failure tails');
equal(baseline.observation.failureTailsContainingAbsoluteMachinePaths, 11, 'eleven baseline tails contain absolute paths');
equal(baseline.observation.failureTailsContainingThisWorkspaceRoot, 11, 'eleven baseline tails contain the checkout root');
equal(baseline.observation.portableWorkspacePlaceholderPresent, false, 'baseline had no portable placeholder');
equal(baseline.observation.redactionTruthDeclared, false, 'baseline made no redaction truth declaration');
equal(baseline.cause.generatorSlicesRawFailureOutput, true, 'raw generator slice cause is bound');
equal(baseline.cause.generatorStoresRawErrorMessage, true, 'raw spawn error cause is bound');
equal(baseline.cause.readinessCopiesVerificationResultWithoutSanitizing, true, 'verbatim ingestion cause is bound');
equal(baseline.retention.rawFailureTailsRetained, false, 'baseline receipt retains no raw tail');
equal(baseline.retention.leakedMachinePathRetained, false, 'baseline receipt retains no leaked path');
equal(baseline.truth.historicalCommitsRewritten, false, 'historical rewrite is not claimed');
equal(baseline.truth.allRepositoryMachinePathDebtAudited, false, 'full repository audit is not claimed');

const aggregate = json('AGGREGATE_PROBES.json');
equal(aggregate.status, 'PASS_WITH_FOREIGN_FAILURE', 'aggregate receipt preserves mixed outcome');
equal(aggregate.readiness.verdict, 'PASS', 'readiness aggregate passes');
equal(aggregate.readiness.exitCode, 0, 'readiness aggregate exits zero');
equal(aggregate.readiness.directRedactionSuitePassed, true, 'readiness aggregate reaches direct suite');
equal(aggregate.readiness.derivedIndexPrivacySuitePassed, true, 'readiness aggregate reaches artifact suite');
equal(aggregate.operations.verdict, 'FOREIGN_FAILURE', 'operations non-pass is typed foreign');
equal(aggregate.operations.exitCode, 1, 'operations aggregate remains nonzero');
equal(aggregate.operations.reachedLeaseRecoverySuitePass, true, 'operations reaches inherited lease recovery pass');
equal(aggregate.operations.errorCode, 'CURATED_VERIFICATION_INTAKE_MISSING', 'foreign failure code is exact');
equal(aggregate.operations.exactMessageObserved, true, 'foreign failure message was observed');
equal(aggregate.baselineComparison.serviceBlobUnchanged, true, 'failing service blob is unchanged');
equal(aggregate.baselineComparison.operationsPackageScriptUnchanged, true, 'operations package script is unchanged');
equal(aggregate.baselineComparison.intakeDirectoryTrackedAtBaseline, false, 'intake is absent from baseline tree');
equal(aggregate.baselineComparison.intakeDirectoryTrackedAtProduct, false, 'intake is absent from product tree');
equal(aggregate.baselineComparison.intakeDirectoryPresentInWorkspace, false, 'intake is absent from workspace');
equal(aggregate.classification.v46RegressionProven, false, 'aggregate failure is not labeled a v4.6 regression');
equal(aggregate.classification.convertedToPass, false, 'foreign failure is not converted to pass');
equal(aggregate.retention.rawCommandLogsRetained, false, 'aggregate receipt retains no raw log');

const replay = json('CLEAN_PRODUCT_REPLAY.json');
equal(replay.status, 'PASS', 'clean product replay passes');
equal(replay.productCommit, scoped.productCommit, 'clean replay binds scoped product commit');
equal(replay.productTree, scoped.productTree, 'clean replay binds scoped product tree');
equal(replay.trackedFiles, 15, 'clean replay contains fifteen tracked files');
equal(replay.summary.commands, 5, 'clean replay records five commands');
equal(replay.summary.passed, 5, 'all clean replay commands pass');
equal(replay.summary.failed, 0, 'no clean replay command fails');
equal(replay.syntheticReadinessIngestion.verdict, 'PASS', 'fresh synthetic ingestion passes');
equal(replay.syntheticReadinessIngestion.portableWorkspaceContextRetained, true, 'synthetic ingestion preserves portable context');
equal(replay.syntheticReadinessIngestion.absoluteFixtureRootRetained, false, 'synthetic ingestion removes fixture root');
equal(replay.syntheticReadinessIngestion.sourceReceiptMutated, false, 'synthetic ingestion leaves source receipt unchanged');
equal(replay.trackedFilesUnchangedAfterReplay, true, 'clean replay leaves tracked files unchanged');
equal(replay.changedTrackedFiles, [], 'clean replay records no changed file');
equal(replay.temporaryReplayPathRetained, false, 'clean replay retains no temporary path');
equal(replay.replayDigest, jsonDigest(replay, 'replayDigest'), 'clean replay digest is exact');

const evidenceReplay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(evidenceReplay.status, 'PASS', 'clean archived evidence replay passes');
equal(evidenceReplay.evidenceCommit, 'fafb67c7abda18e276c8b4942912bffe11b07add', 'evidence replay binds primary evidence commit');
equal(evidenceReplay.evidenceTree, '3c7f674e84a884bb4f6740885e4ede22de8561c2', 'evidence replay binds primary evidence tree');
equal(evidenceReplay.trackedFiles, 31, 'evidence replay contains thirty-one tracked files');
equal(evidenceReplay.selftest.verdict, 'PASS', 'archived evidence selftest passes');
check(evidenceReplay.selftest.stdout.includes('169 checks'), 'archived evidence selftest reports 169 checks');
equal(evidenceReplay.sealReplay.verdict, 'PASS', 'archived primary seal replay passes');
equal(evidenceReplay.sealReplay.eventLines, 30, 'archived seal replay observes thirty events');
equal(evidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'evidence replay did not mutate source checkout or shared main');
equal(evidenceReplay.temporaryReplayPathRetained, false, 'evidence replay retains no temporary path');
equal(evidenceReplay.replayDigest, jsonDigest(evidenceReplay, 'replayDigest'), 'evidence replay digest is exact');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status, 'PASS', 'native surface receipt passes');
equal(native.surface, 'NODE_DIAGNOSTIC_RECEIPT_AND_DERIVED_JSON_INDEX', 'native surface is exact');
equal(native.browserFacingFilesChanged, false, 'no browser-facing file changed');
equal(native.liveBrowserRerun, false, 'no browser rerun is claimed');
equal(native.runtimeEvidence.directRedactionAssertions, 25, 'native receipt binds direct assertions');
equal(native.runtimeEvidence.derivedIndexPrivacyAssertions, 27, 'native receipt binds artifact assertions');
equal(native.runtimeEvidence.retainedFailureTailsChecked, 12, 'native receipt binds all current tails');
equal(native.retention.rawBaselineFailureTailsRetained, false, 'native receipt retains no raw baseline tail');
equal(native.truth.secretOrTokenRedactionProven, false, 'secret redaction is not claimed');
equal(native.truth.arbitraryFieldRedactionProven, false, 'arbitrary-field redaction is not claimed');
equal(native.truth.historicalGitObjectsRewritten, false, 'historical Git rewrite is denied');
equal(native.truth.fullRepositoryPrivacyAuditProven, false, 'full privacy audit is denied');
equal(native.truth.browserBehaviorProven, false, 'browser behavior is unproven');
equal(native.truth.promotionAuthorized, false, 'promotion authority is denied');
equal(native.truth.mergeAuthorized, false, 'merge authority is denied');
equal(native.truth.canonAuthorized, false, 'CANON authority is denied');

const before = json('CAPABILITY_GAP_BEFORE.json'), after = json('CAPABILITY_GAP_AFTER.json');
equal(before.overall, 'BLOCKED', 'before capability route is blocked');
equal(before.requirements.filter(item => item.required && item.status !== 'READY').length, 10, 'before route has ten required gaps');
equal(after.overall, 'DEGRADED', 'after route remains degraded');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length, 0, 'after route closes bounded required gaps');
equal(after.requirements.filter(item => !item.required && item.status !== 'READY').length, 5, 'after route preserves five optional gaps');
equal(after.proposedHands.length, 5, 'five optional candidates remain specification-only');
check(after.proposedHands.every(item => item.contractStatus === 'SPEC_REQUIRED'), 'every optional candidate still requires a contract');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 10, 'ten claim-specific evidence routes are present');
equal(routes.routes.filter(route => route.verdict === 'PASS').length, 10, 'every bounded evidence route passes');
check(routes.routes.every(route => route.counterevidence), 'every route names counterevidence');
check(routes.routes.some(route => route.kind === 'authorization'), 'authority claims use authorization evidence');
check(routes.routes.some(route => route.kind === 'persistence'), 'clean replay claim uses persistence evidence');
check(routes.routes.some(route => route.id === 'aggregate-nonpass-preserved'), 'aggregate non-pass has a dedicated route');

const seal = json('SESSION_SEGMENT.seal.json');
const addendumSeal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
equal(seal.parseStatus, 'valid', 'session seal parses');
equal(seal.eventLines, 30, 'session segment contains thirty events');
equal(seal.validJsonLines, 30, 'every session line is valid JSON');
equal(seal.invalidJsonLines, 0, 'session has no invalid line');
equal(seal.sha256, sha(fs.readFileSync(path.join(__dirname, seal.source))), 'session seal digest matches');
equal(addendumSeal.parseStatus, 'valid', 'session addendum parses');
equal(addendumSeal.eventLines, 4, 'session addendum contains four events');
equal(addendumSeal.validJsonLines, 4, 'every addendum line is valid JSON');
equal(addendumSeal.sha256, sha(fs.readFileSync(path.join(__dirname, addendumSeal.source))), 'session addendum seal digest matches');
equal(read('SESSION_SEGMENT_ADDENDUM.jsonl').trim().split(/\r?\n/).map(line => JSON.parse(line).sequence), [31,32,33,34], 'session addendum continues without a sequence gap');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.baselineCommit, baseline.baselineCommit, 'source snapshot and baseline receipt agree');
equal(source.firstProductCommit, '4488f78661073e03d1493dbc1cd93677310aa58c', 'source snapshot binds first product commit');
equal(source.commit, scoped.productCommit, 'source snapshot binds final product commit');
equal(source.immediateParent, source.firstProductCommit, 'source snapshot binds product commit chain');
equal(source.tree, scoped.productTree, 'source snapshot binds final product tree');
equal(source.files.length, 9, 'source snapshot binds nine product files');
equal(source.productDigest, canonicalDigest(source, 'productDigest'), 'source snapshot digest is canonical');
check(source.files.every(item => !item.path.startsWith('docs/steward-runs/') && !/AXM_MIRROR_SHADOW_SPECIALIST/i.test(item.path)), 'source snapshot excludes evidence and specialist lane');
source.files.forEach(item => {
  const bytes = git(['show',source.commit + ':' + item.path], null);
  assert.equal(item.bytes, bytes.length, item.path + ' byte count drifted');
  assert.equal(item.sha256, 'sha256:' + sha(bytes), item.path + ' digest drifted');
});
checks += source.files.length * 2;

const changed = String(git(['diff-tree','--no-commit-id','--name-only','-r',source.baselineCommit,source.commit])).split(/\r?\n/).filter(Boolean).sort();
equal(changed, source.files.map(item => item.path).sort(), 'source snapshot covers every product change');
check(!changed.some(file => /\.(?:html|css)$/i.test(file) || /(?:^|\/)app\.js$/i.test(file)), 'product changes no browser-facing file');
check(!changed.some(file => /AXM_MIRROR_SHADOW_SPECIALIST/i.test(file)), 'product excludes specialist package lane');

const redactorSource = String(git(['show',source.commit + ':shared/readiness/diagnostic-redaction.js']));
check(redactorSource.includes("label:'<WORKSPACE>'"), 'product redactor contains portable workspace placeholder');
check(redactorSource.includes("'$1<UNC_PATH>'"), 'product redactor contains UNC placeholder');
check(redactorSource.includes('sanitizeVerificationResult'), 'product redactor exports result sanitizer');
check(redactorSource.includes('.slice(-limit)'), 'product tail remains bounded after redaction');
const generatorSource = String(git(['show',source.commit + ':scripts/generate-tools-index.js']));
const dailySource = String(git(['show',source.commit + ':scripts/daily-verification.js']));
const readinessSource = String(git(['show',source.commit + ':shared/readiness/tool-readiness.js']));
check(generatorSource.includes('DiagnosticRedaction.failureTail'), 'tool index generator redacts writer diagnostics');
check(!generatorSource.includes('(stderr || stdout).slice(-1200)'), 'tool index generator no longer stores raw bounded tail');
check(dailySource.includes('DiagnosticRedaction.failureTail'), 'daily verifier redacts writer diagnostics');
check(readinessSource.includes('DiagnosticRedaction.sanitizeVerificationResult'), 'readiness ingestion sanitizes supplied results');
check(readinessSource.includes('failureDiagnosticsMachinePathRedacted: true'), 'readiness truth declares narrow redaction property');
const packageJson = JSON.parse(String(git(['show',source.commit + ':package.json'])));
check(packageJson.scripts['test:readiness'].includes('diagnostic-redaction-selftest.js'), 'readiness aggregate includes direct suite');
check(packageJson.scripts['test:readiness'].includes('tools-index-diagnostic-privacy-selftest.js'), 'readiness aggregate includes artifact suite');

const baselineIndex = JSON.parse(String(git(['show',source.baselineCommit + ':tools-index.json'])));
const productIndex = JSON.parse(String(git(['show',source.commit + ':tools-index.json'])));
equal(productIndex.summary.tools, 211, 'product index retains 211 tools');
equal(productIndex.summary.capabilities, 1860, 'product index retains 1860 capabilities');
equal(productIndex.truth.failureDiagnosticsMachinePathRedacted, true, 'product index declares diagnostic path redaction');
const baselineResults = baselineIndex.tools.map(tool => tool.selftest && tool.selftest.result).filter(Boolean);
const productResults = productIndex.tools.map(tool => tool.selftest && tool.selftest.result).filter(Boolean);
const productTails = productResults.map(result => result.failureTail).filter(value => typeof value === 'string' && value.length);
equal(productTails.length, 12, 'product index retains twelve bounded failure tails');
equal(productTails.filter(tail => tail.includes('<WORKSPACE>')).length, 11, 'eleven product tails retain portable workspace context');
check(productTails.every(tail => Redaction.redactDiagnostic(tail, { workspaceRoot:ROOT }) === tail), 'every product tail is stable under a second redaction pass');
check(productTails.every(tail => tail.length <= 1200), 'every product tail remains bounded');
check(!productTails.some(tail => tail.toLowerCase().includes(ROOT.toLowerCase())), 'product tails contain no current checkout root');
equal(productResults.map(result => result.outputSha256), baselineResults.map(result => result.outputSha256), 'raw output digests remain exact across redaction');
equal(productResults.map(result => result.verdict), baselineResults.map(result => result.verdict), 'selftest verdicts remain unchanged across redaction');
equal(String(git(['show','-s','--format=%T',source.baselineCommit])).trim(), baseline.baselineTree, 'baseline Git object remains reachable and unchanged');

const curation = json('CURATION_RECEIPT.json'), index = json('SESSION_INDEX.json');
equal(curation.durableEventsPreserved, 34, 'curation preserves every semantic event');
equal(curation.sealDigest, 'sha256:' + seal.sha256, 'curation binds primary seal');
equal(curation.continuationSegments[0].sealDigest, 'sha256:' + addendumSeal.sha256, 'curation binds addendum seal');
equal(curation.telemetryAggregation.scopedCommandOutcomes, 19, 'curation aggregates scoped outcomes');
equal(curation.telemetryAggregation.retainedRawLogs, false, 'curation retains no raw logs');
equal(curation.telemetryAggregation.aggregateForeignFailures, 1, 'curation preserves one foreign aggregate failure');
equal(curation.temporaryMaterialDeleted.cleanReplayTemporaryRootsRemaining, 0, 'no product replay root remains');
equal(curation.temporaryMaterialDeleted.cleanEvidenceReplayTemporaryRootsRemaining, 0, 'no evidence replay root remains');
equal(curation.temporaryMaterialDeleted.leakedMachinePathRetained, false, 'curation retains no leaked path');
equal(curation.cleanProductReplay.syntheticReadinessIngestionPassed, true, 'curation records synthetic ingestion');
equal(curation.capabilityComparison.overallAfter, 'DEGRADED', 'curation keeps broad capability status degraded');
equal(curation.cleanEvidenceReplay.trackedFiles, 31, 'curation records exact evidence slice');
equal(curation.cleanEvidenceReplay.evidenceSelftestChecksPassed, 169, 'curation records archived evidence checks');
equal(curation.cleanEvidenceReplay.sessionSealReplayPassed, true, 'curation records archived seal replay');
equal(curation.cleanEvidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'curation records no source or shared-main mutation');
equal(index.broadGoalComplete, false, 'session index leaves broad objective active');
equal(index.productCommit, source.commit, 'session index and source snapshot agree');
equal(index.continuationSegments.length, 1, 'session index records one sealed continuation');
equal(index.mergeGate, 'Mike Tobi / AXM', 'merge gate remains Mike Tobi / AXM');
equal(index.canonGate, 'Mike Tobi / AXM', 'CANON gate remains Mike Tobi / AXM');
equal(index.specialistPackageLaneInspected, false, 'session index excludes specialist package lane');

const evidenceFiles = fs.readdirSync(__dirname);
check(!evidenceFiles.some(name => /\.(?:png|jpe?g|webp|mp4|webm|log)$/i.test(name)), 'no raw media or log is retained');
const retainedText = evidenceFiles.filter(name => fs.statSync(path.join(__dirname,name)).isFile()).map(read).join('\n');
check(!retainedText.toLowerCase().includes(ROOT.toLowerCase()), 'evidence contains no current machine-local workspace path');
check(/Mike\s+Tobi \/ AXM remains the merge/.test(read('README.md')) && read('FRONTIER_AUDIT.md').includes('broad\ngrounded-growth objective remains active'), 'gate and active broad objective remain explicit');

console.log('PASS readiness diagnostic evidence redaction evidence: ' + checks + ' checks');
