#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE = 'd8e6644ce9d5bfd54fd0f122ebd9ebccbb2f7849';
const PRODUCT = '7b146a36d3e05041954050c7d5d5cd74440f6b50';
const TREE = 'a27d5fcb82b614d5e9ca7fc5f7a3624ac81234a6';
let checks = 0;
function check(value, label) { assert(value, label); checks += 1; }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; }
function json(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function read(name) { return fs.readFileSync(path.join(__dirname, name), 'utf8'); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digest(receipt, field) { const body = JSON.parse(JSON.stringify(receipt)); delete body[field]; return 'sha256:' + sha(JSON.stringify(body)); }
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git command failed');
  return result.stdout;
}
function runNode(name) {
  return childProcess.spawnSync(process.execPath, [name], { cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 });
}

const expectedJson = [
  'AGGREGATE_PROBE.json','BOUNDARY_PROBES.json','CAPABILITY_GAP_AFTER.json','CAPABILITY_GAP_BEFORE.json','CLEAN_EVIDENCE_REPLAY.json',
  'CAPABILITY_INVENTORY_AFTER.json','CAPABILITY_INVENTORY_BEFORE.json','CAPABILITY_REQUIREMENTS.json','CHECK_RESULTS.json',
  'CLEAN_PRODUCT_REPLAY.json','CURATION_RECEIPT.json','EVIDENCE_ROUTES.json','NATIVE_SURFACE_RECEIPT.json',
  'SENSITIVE_LITERAL_SCAN.json','SESSION_INDEX.json','SESSION_SEGMENT.seal.json','SESSION_SEGMENT_ADDENDUM.seal.json','SOURCE_SNAPSHOT.json'
];
expectedJson.forEach(name => check(json(name), name + ' parses'));

equal(String(git(['show','-s','--format=%T',PRODUCT])).trim(), TREE, 'product tree identity is exact');
equal(String(git(['show','-s','--format=%P',PRODUCT])).trim(), BASELINE, 'product parent identity is exact');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.baselineCommit, BASELINE, 'source snapshot binds baseline');
equal(source.commit, PRODUCT, 'source snapshot binds product');
equal(source.tree, TREE, 'source snapshot binds tree');
equal(source.files.map(file => file.path), [
  'shared/readiness/diagnostic-redaction-selftest.js',
  'shared/readiness/diagnostic-redaction.js',
  'shared/readiness/selftest.js',
  'shared/readiness/tool-readiness.js',
  'shared/readiness/tools-index-diagnostic-privacy-selftest.js',
  'tools-index.json'
], 'source snapshot names the exact six product files');
source.files.forEach(file => {
  const bytes = git(['show',PRODUCT + ':' + file.path], null);
  equal(file.bytes, bytes.length, file.path + ' byte count is exact');
  equal(file.sha256, 'sha256:' + sha(bytes), file.path + ' digest is exact');
});
equal(source.productDigest, digest(source, 'productDigest'), 'source product digest is exact');

const probes = json('BOUNDARY_PROBES.json');
equal(probes.status, 'PASS', 'boundary probes pass');
equal(probes.receiptDigest, digest(probes, 'receiptDigest'), 'boundary receipt digest is exact');
equal(Object.keys(probes.baseline.cases).length, 5, 'five baseline cases are observed');
equal(Object.keys(probes.product.cases).length, 5, 'five product cases are observed');
Object.values(probes.baseline.cases).forEach((row, index) => {
  equal(row.changed, false, 'baseline case ' + index + ' is unchanged');
  equal(row.markerPresent, false, 'baseline case ' + index + ' has no marker');
  equal(row.fixtureAbsent, false, 'baseline case ' + index + ' retains fixture evidence');
});
Object.values(probes.product.cases).forEach((row, index) => {
  equal(row.changed, true, 'product case ' + index + ' changes');
  equal(row.markerPresent, true, 'product case ' + index + ' exposes marker');
  equal(row.fixtureAbsent, true, 'product case ' + index + ' removes fixture evidence');
});
equal(probes.baseline.recognizedCredentialTruthDeclared, false, 'baseline lacks qualified truth');
equal(probes.product.recognizedCredentialTruthDeclared, true, 'product declares qualified truth');
equal(probes.nonRegression.toolCount, 211, 'tool count remains 211');
equal(probes.nonRegression.failureTails, 12, 'twelve current failure tails are observed');
equal(probes.nonRegression.summariesExact, true, 'tools-index summary stays exact');
equal(probes.nonRegression.sourceDigestsExact, true, 'tools-index source digest stays exact');
equal(probes.nonRegression.verdictHashesAndTailsExact, true, 'verdict hash and tail projection stays exact');
equal(probes.nonRegression.currentTailsIdempotentlySanitized, true, 'current tails are idempotently sanitized');
equal(probes.rawFixtureValuesRetained, false, 'probe receipt retains no raw fixture value');

const results = json('CHECK_RESULTS.json');
equal(results.status, 'PASS', 'scoped verification passes');
equal(results.receiptDigest, digest(results, 'receiptDigest'), 'check receipt digest is exact');
equal(results.summary, { commands:17, passed:17, failed:0 }, 'all seventeen scoped commands pass');
equal(results.requiredChecks, { commands:10, passed:10 }, 'all ten required commands pass');
equal(results.focusedAssertions, 77, 'focused suites report seventy-seven assertions');
equal(results.packagePathControls, 255, 'package path suite reports 255 controls');
results.results.forEach(row => equal(row.verdict, 'PASS', row.id + ' passes'));
equal(results.results.find(row => row.id === 'focused-direct').reportedAssertions, 49, 'direct suite reports forty-nine assertions');
equal(results.results.find(row => row.id === 'focused-artifact').reportedAssertions, 28, 'artifact suite reports twenty-eight assertions');
equal(results.rawCommandLogsRetained, false, 'scoped receipt retains no raw logs');

const aggregate = json('AGGREGATE_PROBE.json');
equal(aggregate.verdict, 'FOREIGN_FAILURE', 'aggregate remains typed foreign failure');
equal(aggregate.failureCode, 'CURATED_VERIFICATION_INTAKE_MISSING', 'aggregate failure code is exact');
equal(aggregate.receiptDigest, digest(aggregate, 'receiptDigest'), 'aggregate receipt digest is exact');
equal(aggregate.reachedRetirementRecoveryPass, true, 'aggregate reaches retirement recovery pass');
equal(aggregate.unchangedBoundary.serviceExact, true, 'failing service is exact across baseline and product');
equal(aggregate.unchangedBoundary.operationsScriptExact, true, 'operations script is exact across baseline and product');
equal(aggregate.unchangedBoundary.intakePresentInBaseline, false, 'expected intake is absent in baseline');
equal(aggregate.unchangedBoundary.intakePresentInProduct, false, 'expected intake is absent in product');
equal(aggregate.unchangedBoundary.intakePresentInWorkspace, false, 'expected intake is absent in workspace');
equal(aggregate.v47ReadinessFilesOnFailingBoundary, false, 'v4.7 files are outside failing boundary');
equal(aggregate.substituteIntakeCreated, false, 'no substitute intake is claimed');
equal(aggregate.rawCommandLogRetained, false, 'aggregate retains no raw log');

const replay = json('CLEAN_PRODUCT_REPLAY.json');
equal(replay.status, 'PASS', 'clean product replay passes');
equal(replay.productCommit, PRODUCT, 'clean replay binds product commit');
equal(replay.productTree, TREE, 'clean replay binds product tree');
equal(replay.trackedFiles, 15, 'clean replay contains fifteen tracked files');
equal(replay.summary, { commands:5, passed:5, failed:0 }, 'clean replay passes five commands');
replay.commands.forEach((row, index) => equal(row.verdict, 'PASS', 'clean replay command ' + index + ' passes'));
equal(replay.syntheticReadinessIngestion.verdict, 'PASS', 'synthetic ingestion passes');
equal(replay.syntheticReadinessIngestion.portableWorkspaceContextRetained, true, 'ingestion retains portable path context');
equal(replay.syntheticReadinessIngestion.explicitCredentialMarkerRetained, true, 'ingestion retains credential marker');
equal(replay.syntheticReadinessIngestion.absoluteFixtureRootRetained, false, 'ingestion drops absolute root');
equal(replay.syntheticReadinessIngestion.recognizedFixtureCredentialRetained, false, 'ingestion drops recognized credential');
equal(replay.syntheticReadinessIngestion.rawOutputDigestPreserved, true, 'ingestion preserves raw output digest');
equal(replay.syntheticReadinessIngestion.sourceReceiptMutated, false, 'ingestion does not mutate source receipt');
equal(replay.syntheticReadinessIngestion.qualifiedTruthDeclared, true, 'ingestion exposes qualified truth');
equal(replay.trackedFilesUnchangedAfterReplay, true, 'clean replay leaves tracked files unchanged');
equal(replay.changedTrackedFiles, [], 'clean replay records no changed files');
equal(replay.sourceCheckoutOrSharedMainMutated, false, 'clean replay does not mutate source checkout or shared main');
equal(replay.temporaryReplayPathRetained, false, 'clean replay retains no temporary path');
equal(replay.replayDigest, digest(replay, 'replayDigest'), 'clean replay digest is exact');

const evidenceReplay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(evidenceReplay.status, 'PASS', 'clean evidence replay passes');
equal(evidenceReplay.replayDigest, digest(evidenceReplay, 'replayDigest'), 'clean evidence replay digest is exact');
equal(evidenceReplay.evidenceCommit, '5e3a017752dba5d9998c942ab0eb5a7d20f4f8e6', 'clean evidence replay binds primary evidence commit');
equal(evidenceReplay.evidenceTree, '84826e2bc08dec0b4ce937dceb3455ea2ea43559', 'clean evidence replay binds primary evidence tree');
equal(evidenceReplay.trackedFiles, 32, 'clean evidence replay contains thirty-two tracked files');
equal(evidenceReplay.selftest.verdict, 'PASS', 'archived evidence selftest passes');
check(evidenceReplay.selftest.stdout.includes('215 checks'), 'archived evidence selftest reports 215 checks');
equal(evidenceReplay.sealReplay.verdict, 'PASS', 'archived primary seal replay passes');
equal(evidenceReplay.sealReplay.eventLines, 38, 'archived primary seal observes thirty-eight events');
equal(evidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'evidence replay does not mutate source checkout or shared main');
equal(evidenceReplay.temporaryReplayPathRetained, false, 'evidence replay retains no temporary path');

const requirements = json('CAPABILITY_REQUIREMENTS.json');
const before = json('CAPABILITY_GAP_BEFORE.json');
const after = json('CAPABILITY_GAP_AFTER.json');
equal(requirements.requirements.length, 27, 'capability contract contains twenty-seven requirements');
equal(before.overall, 'BLOCKED', 'capability route begins blocked');
equal(after.overall, 'DEGRADED', 'capability route ends degraded rather than complete');
equal(before.requirements.filter(row => row.required && row.status !== 'READY').length, 13, 'before report has thirteen required gaps');
equal(after.requirements.filter(row => row.required && row.status !== 'READY').length, 0, 'after report has zero bounded required gaps');
equal(after.requirements.filter(row => !row.required && row.status !== 'READY').length, 6, 'after report preserves six optional broader gaps');

const sensitive = json('SENSITIVE_LITERAL_SCAN.json');
equal(sensitive.status, 'PASS', 'sensitive literal scan passes');
equal(sensitive.receiptDigest, digest(sensitive, 'receiptDigest'), 'sensitive scan digest is exact');
equal(sensitive.scope, { productFiles:6, evidenceFiles:27, totalFiles:33 }, 'sensitive scan scope is exact');
Object.entries(sensitive.recognizedLiteralPatternHits).forEach(([name, count]) => equal(count, 0, name + ' has zero literal hits'));
equal(sensitive.currentWorkspacePathHits, 0, 'sensitive scan finds zero workspace path hits');
equal(sensitive.assembledFixtureCredentialHits, 0, 'sensitive scan finds zero assembled fixture hits');
equal(sensitive.arbitrarySecretAbsenceProven, false, 'sensitive scan does not claim arbitrary secret absence');
equal(sensitive.rawMatchedValuesRetained, false, 'sensitive scan retains no matched values');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length, 10, 'ten atomic evidence routes are recorded');
routes.routes.forEach(route => equal(route.verdict, 'PASS', route.id + ' route passes'));
check(routes.routes.some(route => route.risk === 'high' && route.secondarySurface), 'high-risk routes include second evidence surfaces');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status, 'PASS', 'native receipt passes');
equal(native.browserFacingFilesChanged, false, 'no browser-facing file changed');
equal(native.browserRenderClickRun, false, 'no browser run is claimed');
equal(native.authority.providerInvoked, false, 'no provider invocation is claimed');
equal(native.authority.humanParticipationProven, false, 'no human participation is claimed');
equal(native.authority.promotionGranted, false, 'no promotion is claimed');
equal(native.authority.canonClaimed, false, 'no CANON is claimed');

const seal = json('SESSION_SEGMENT.seal.json');
const addendumSeal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
equal(seal.parseStatus, 'valid', 'session seal parses');
equal(seal.eventLines, 38, 'session segment contains thirty-eight events');
equal(seal.validJsonLines, 38, 'every session event is valid JSON');
equal(seal.invalidJsonLines, 0, 'session contains no invalid JSON line');
equal(seal.sha256, sha(fs.readFileSync(path.join(__dirname, seal.source))), 'session seal digest matches segment bytes');
const sequences = read('SESSION_SEGMENT.jsonl').trim().split(/\r?\n/).map(line => JSON.parse(line).sequence);
equal(sequences, Array.from({ length:38 }, (_, index) => index + 1), 'session sequence is contiguous');
equal(addendumSeal.parseStatus, 'valid', 'session addendum seal parses');
equal(addendumSeal.eventLines, 13, 'session addendum contains thirteen events');
equal(addendumSeal.validJsonLines, 13, 'every session addendum event is valid JSON');
equal(addendumSeal.invalidJsonLines, 0, 'session addendum contains no invalid line');
equal(addendumSeal.sha256, sha(fs.readFileSync(path.join(__dirname, addendumSeal.source))), 'session addendum seal digest matches bytes');
equal(read('SESSION_SEGMENT_ADDENDUM.jsonl').trim().split(/\r?\n/).map(line => JSON.parse(line).sequence), Array.from({ length:13 }, (_, index) => index + 39), 'session addendum continues without a sequence gap');

const index = json('SESSION_INDEX.json');
equal(index.productCommit, PRODUCT, 'session index binds product');
equal(index.primaryEvidenceCommit, '5e3a017752dba5d9998c942ab0eb5a7d20f4f8e6', 'session index binds primary evidence commit');
equal(index.continuationSegments.length, 1, 'session index records one continuation');
check(index.derivedViews.includes('CLEAN_EVIDENCE_REPLAY.json'), 'session index includes clean evidence replay view');
equal(index.broadGoalComplete, false, 'broad objective remains active');
equal(index.mergeGate, 'Mike Tobi / AXM', 'merge gate remains Mike Tobi / AXM');
equal(index.canonGate, 'Mike Tobi / AXM', 'CANON gate remains Mike Tobi / AXM');
equal(index.specialistPackageLaneInspected, false, 'specialist package lane remains excluded');

const curation = json('CURATION_RECEIPT.json');
equal(curation.status, 'PASS', 'curation receipt passes');
equal(curation.durableEventsPreserved, 51, 'curation preserves every durable event');
equal(curation.sealDigest, 'sha256:' + seal.sha256, 'curation binds session seal');
equal(curation.continuationSegments[0].sealDigest, 'sha256:' + addendumSeal.sha256, 'curation binds addendum seal');
equal(curation.telemetryAggregation.scopedCommandOutcomes, 17, 'curation aggregates scoped outcomes');
equal(curation.telemetryAggregation.aggregateForeignFailures, 1, 'curation preserves foreign aggregate failure');
equal(curation.temporaryMaterialDeleted.rawCredentialFixtureValuesRetained, false, 'curation retains no raw assembled fixture value');
equal(curation.temporaryMaterialDeleted.rawCommandLogsRetained, false, 'curation retains no raw command log');
equal(curation.temporaryMaterialDeleted.machinePathsRetained, false, 'curation retains no machine path');
equal(curation.temporaryMaterialDeleted.cleanEvidenceReplayTemporaryRootsRemaining, 0, 'curation records no evidence replay root');
equal(curation.cleanProductReplay.syntheticReadinessIngestionPassed, true, 'curation records synthetic ingestion');
equal(curation.cleanEvidenceReplay.trackedFiles, 32, 'curation records exact clean evidence slice');
equal(curation.cleanEvidenceReplay.evidenceSelftestChecksPassed, 215, 'curation records archived evidence checks');
equal(curation.cleanEvidenceReplay.sessionSealReplayPassed, true, 'curation records archived seal replay');
equal(curation.cleanEvidenceReplay.sourceCheckoutOrSharedMainMutated, false, 'curation records no source or shared-main mutation');
equal(curation.cleanEvidenceReplay.temporaryPathRemoved, true, 'curation records evidence replay cleanup');
equal(curation.capabilityComparison.requiredGapsAfter, 0, 'curation records zero bounded required gaps');
equal(curation.sensitiveLiteralScan.totalFiles, 33, 'curation records exact sensitive scan scope');
equal(curation.sensitiveLiteralScan.recognizedPatternHits, 0, 'curation records zero recognized literal hits');
equal(curation.sensitiveLiteralScan.arbitrarySecretAbsenceProven, false, 'curation preserves the arbitrary-secret limit');
equal(curation.broadGoalComplete, false, 'curation leaves broad goal active');
equal(curation.evidenceSelftest.status, 'PASS', 'curation records evidence selftest pass');
equal(curation.evidenceSelftest.checks, 244, 'curation records exact evidence check count');

const direct = runNode('shared/readiness/diagnostic-redaction-selftest.js');
equal(direct.status, 0, 'current direct redaction selftest passes');
check(String(direct.stdout).includes('49 assertions'), 'current direct selftest reports forty-nine assertions');
const artifact = runNode('shared/readiness/tools-index-diagnostic-privacy-selftest.js');
equal(artifact.status, 0, 'current artifact privacy selftest passes');
check(String(artifact.stdout).includes('28 assertions across 12'), 'current artifact selftest reports twenty-eight assertions across twelve tails');

const evidenceFiles = fs.readdirSync(__dirname, { withFileTypes:true }).filter(entry => entry.isFile()).map(entry => entry.name);
const evidenceText = evidenceFiles.map(name => read(name)).join('\n');
check(!evidenceText.includes(ROOT), 'evidence contains no current workspace path');
check(!evidenceText.includes(['axm','fixture','credential'].join('-')), 'evidence contains no assembled fixture credential');
check(!evidenceText.includes(['bridge','bridge-token.txt'].join('/')), 'evidence contains no bridge token path');
check(!evidenceText.includes(['AXM','MIRROR','SHADOW','SPECIALIST'].join('_')), 'evidence contains no specialist package name or content');

console.log('PASS readiness diagnostic credential redaction evidence: ' + checks + ' checks');
