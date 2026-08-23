#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const DIR = __dirname, ROOT = path.resolve(DIR,'../../..');
const product = '04294776eefdbb8a31604bf2be2725708bc6d3e0', parent = 'f5c4029959a0ca4f82d52c04e00f033b223fbb43', tree = '2722e79a578711819bbd492aa329e591d53c2bcb';
const json = name => JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8'));
const digest = value => 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(value)).digest('hex');
const blob = (commit,file) => childProcess.spawnSync('git',['rev-parse',commit + ':' + file],{ cwd:ROOT,encoding:'utf8',windowsHide:true }).stdout.trim();
let checks = 0;
function check(value,label) { assert(value,label); checks += 1; }
function equal(actual,expected,label) { assert.deepStrictEqual(actual,expected,label); checks += 1; }
function exactDigest(value,key,label) { const body = JSON.parse(Core.canonicalJson(value)); const actual = body[key]; delete body[key]; equal(actual,digest(body),label); }

const baseline = json('BASELINE_REASON_PRIVACY_GAP.json');
equal(baseline.status,'REPRODUCED','baseline reproduced');
equal(baseline.sourceCommit,'b707aa08f0adf958f6344babf0839c37ab1b9dca','baseline binds exact v5.2 product');
for (const key of ['rawReasonPersistedInState','recognizedCredentialPersistedInState','machinePathPersistedInState','rawReasonReturnedByRuntime','recognizedCredentialReturnedByRuntime','machinePathReturnedByRuntime','rawReasonEmittedByCli']) equal(baseline.observations[key],true,'baseline observes ' + key);
equal(baseline.observations.reasonDigestFieldAvailable,false,'v5.2 result has no reason digest field');
equal(baseline.observations.reasonRedactionFieldAvailable,false,'v5.2 result has no redaction field');
equal(baseline.truth.rawStateBytesRetained,false,'baseline retains no raw state');
equal(baseline.truth.rawCliOutputRetained,false,'baseline retains no raw CLI output');
exactDigest(baseline,'receiptDigest','baseline digest exact');

const before = json('FRONTIER_GAP_BEFORE.json'), after = json('FRONTIER_GAP_AFTER.json');
equal(before.overall,'BLOCKED','before gap blocked');
equal(before.summary.requiredReady,2,'before has two inherited ready requirements');
equal(before.summary.requiredMissing,8,'before has eight missing required capabilities');
equal(after.overall,'DEGRADED','after gap preserves optional gaps');
equal(after.summary.requiredReady,10,'after has ten bounded ready requirements');
equal(after.summary.requiredMissing,0,'after has no missing bounded required requirement');
equal(after.summary.optionalMissing,7,'after preserves seven optional gaps');
exactDigest(before,'reportDigest','before gap digest exact');
exactDigest(after,'reportDigest','after gap digest exact');

const capabilities = json('FRONTIER_CAPABILITIES_AFTER.json');
equal(capabilities.sourceCommit,product,'capabilities bind product');
equal(capabilities.productTree,tree,'capabilities bind product tree');
equal(capabilities.available.length,10,'ten bounded capabilities are available');
equal(capabilities.missing.length,7,'seven optional capabilities remain missing');
check(capabilities.missing.includes('review.retirement.publication-stage.archival-intent.reason.arbitrary-or-encoded-secret-absence'),'arbitrary secret absence remains missing');
check(capabilities.missing.includes('review.retirement.publication-stage.archival-intent.authenticated-actor-authorization'),'actor authentication remains missing');
exactDigest(capabilities,'inventoryDigest','after inventory digest exact');

const checksReceipt = json('CHECK_RESULTS.json');
equal(checksReceipt.status,'PASS','verification receipt passes');
equal(checksReceipt.summary.commands,22,'twenty-two scoped commands recorded');
equal(checksReceipt.summary.passed,22,'all scoped commands pass');
equal(checksReceipt.summary.failed,0,'no scoped command fails');
equal(checksReceipt.summary.focusedAssertions,1230,'focused assertion/control total exact');
equal(checksReceipt.commands.filter(item => item.phase === 'FOCUSED').length,12,'twelve focused commands');
equal(checksReceipt.commands.filter(item => item.phase === 'REQUIRED').length,10,'ten required commands');
exactDigest(checksReceipt,'resultsDigest','verification receipt digest exact');

const clean = json('CLEAN_PRODUCT_REPLAY.json');
equal(clean.status,'PASS','clean product replay passes');
equal(clean.productCommit,product,'clean replay binds product');
equal(clean.productTree,tree,'clean replay binds tree');
equal(clean.summary.commands,12,'clean replay has twelve focused commands');
equal(clean.summary.passed,12,'clean replay commands pass');
equal(clean.summary.focusedAssertions,1230,'clean replay assertion/control total exact');
equal(clean.trackedFilesUnchangedAfterReplay,true,'clean replay changes no tracked bytes');
equal(clean.changedTrackedFiles,[],'clean replay changed-file list empty');
equal(clean.temporaryReplayPathRetained,false,'clean replay temp removed');
exactDigest(clean,'replayDigest','clean replay digest exact');

const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
equal(aggregate.status,'FOREIGN_FAILURE','aggregate failure classified foreign');
equal(aggregate.exitCode,1,'aggregate command exits one');
check(Object.values(aggregate.reachedProductChecks).every(Boolean),'aggregate reaches every product check');
equal(aggregate.failure.targetedExitCode,1,'unchanged failing lane exits one');
equal(aggregate.failure.targetedExactMessagePresent,true,'unchanged failing lane exposes exact missing-intake message');
equal(aggregate.comparison.serviceBlobUnchanged,true,'failing service unchanged');
equal(aggregate.comparison.selftestBlobUnchanged,true,'failing selftest unchanged');
equal(aggregate.comparison.productTouchedFailingLane,false,'product does not touch failing lane');
exactDigest(aggregate,'receiptDigest','aggregate receipt digest exact');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit,product,'source snapshot binds product');
equal(source.parent,parent,'source snapshot binds parent');
equal(source.tree,tree,'source snapshot binds tree');
equal(source.files.length,12,'source snapshot has twelve product files');
equal(source.browserFacingFilesChanged,false,'no browser-facing product file changed');
equal(source.evidenceFilesIncluded,false,'product commit excludes evidence files');
equal(source.specialistPackageFilesIncluded,false,'product excludes specialist packages');
check(source.files.some(item => item.path.endsWith('archival-intent-v2.schema.json')),'source includes intent v2 schema');
check(source.files.some(item => item.path.endsWith('archival-authorization-status-v2.schema.json')),'source includes status v2 schema');
check(source.files.some(item => item.path.endsWith('archival-result-v3.schema.json')),'source includes result v3 schema');
check(!source.files.some(item => item.path.endsWith('archival-intent.schema.json')),'historical intent v1 schema is outside product diff');
equal(blob(parent,'shared/operations/review-operation-lease-retirement-publication-archival-intent.schema.json'),blob(product,'shared/operations/review-operation-lease-retirement-publication-archival-intent.schema.json'),'intent v1 blob unchanged');
equal(blob(parent,'shared/operations/review-operation-lease-retirement-publication-archival-authorization-status.schema.json'),blob(product,'shared/operations/review-operation-lease-retirement-publication-archival-authorization-status.schema.json'),'status v1 blob unchanged');
equal(blob(parent,'shared/operations/review-operation-lease-retirement-publication-archival-result-v2.schema.json'),blob(product,'shared/operations/review-operation-lease-retirement-publication-archival-result-v2.schema.json'),'result v2 blob unchanged');
exactDigest(source,'productDigest','source snapshot digest exact');

const promotion = json('PROMOTION_SELFTEST_RECEIPT.json');
equal(promotion.status,'MIXED','promotion receipt preserves mixed state');
equal(promotion.summary.notPass,12,'twelve unrelated promotion selftests remain nonpass');
equal(promotion.reviewInbox.verdict,'PASS','Review Inbox promotion selftest passes');
equal(promotion.reviewInbox.exactCurrentSelftestDigest,true,'Review Inbox promotion digest current');
equal(promotion.reviewInbox.indexPromotionState,'READY_FOR_HUMAN_REVIEW','Review Inbox ready for human review');
equal(promotion.truth.readyForHumanReviewIsPromotion,false,'readiness is not promotion');
equal(promotion.truth.readyForHumanReviewIsCanon,false,'readiness is not canon');
exactDigest(promotion,'receiptDigest','promotion receipt digest exact');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status,'PASS','native receipt passes');
equal(native.productCommit,product,'native receipt binds product');
equal(native.browserRenderClickTest,'NOT_RUN_HOST_LOCAL_NO_BROWSER_ROUTE','browser run honestly not run');
for (const key of ['exactRawReasonAbsentFromNewV2IntentObserved','exactRawReasonAbsentFromV3RuntimeAndCliJsonObserved','exactRawReasonDigestCommitmentObserved','recognizedCredentialValueExcludedFromNewIntentResultAndCliJsonObserved','machinePathExcludedFromNewIntentResultAndCliJsonObserved','unchangedReasonWithheldMarkerObserved','legacyV1RawReasonIntentTypedAndRetryable','corruptedReasonDigestAndSummaryHeld']) equal(native.truth[key],true,'native truth confirms ' + key);
for (const key of ['legacyV1IntentRewrittenOrDeleted','arbitraryOrEncodedSecretAbsenceProven','commandLineArgumentOrShellHistorySanitized','callerAssertionAuthenticated','livePublisherSafetyProven','humanBenefitProven','learningProven','promotionAuthorized','mergeAuthorized','canonAuthorized']) equal(native.truth[key],false,'native truth refuses ' + key);
exactDigest(native,'receiptDigest','native receipt digest exact');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.status,'TEST','evidence routes remain TEST');
equal(routes.routes.length,15,'fifteen claim-specific evidence routes');
check(routes.routes.every(item => item.verdict === 'PASS' && item.counterevidence),'every route has pass verdict and counterevidence');
equal(routes.routesDigest,digest(routes.routes),'evidence route digest exact');

const segment = fs.readFileSync(path.join(DIR,'SESSION_SEGMENT.jsonl'),'utf8'), lines = segment.trim().split(/\r?\n/);
const seal = json('SESSION_SEGMENT.seal.json'), index = json('SESSION_INDEX.json'), curation = json('CURATION_RECEIPT.json');
equal(lines.length,20,'twenty semantic events sealed');
check(lines.every(line => { JSON.parse(line); return true; }),'every session event parses');
equal(seal.status,'PASS','session seal passes');
equal(seal.sha256,crypto.createHash('sha256').update(segment).digest('hex'),'session segment hash exact');
equal(index.productCommit,product,'session index binds product');
equal(index.broadGoalComplete,false,'broad goal remains active');
equal(index.mergeGate,'Mike Tobi / AXM','merge gate preserved');
equal(index.canonGate,'Mike Tobi / AXM','CANON gate preserved');
equal(curation.retainedRawLogs,false,'raw logs not retained');
equal(curation.retainedFailureTails,false,'failure tails not retained');
equal(curation.retainedRawFixtureReasons,false,'raw fixture reasons not retained');
equal(curation.retainedRawCliOutput,false,'raw CLI output not retained');
equal(curation.retainedSpecialistPackages,false,'specialist packages not retained');
equal(curation.broadGoalComplete,false,'curation keeps broad goal active');

const intentV2 = json('../../../shared/operations/review-operation-lease-retirement-publication-archival-intent-v2.schema.json');
const statusV2 = json('../../../shared/operations/review-operation-lease-retirement-publication-archival-authorization-status-v2.schema.json');
const resultV3 = json('../../../shared/operations/review-operation-lease-retirement-publication-archival-result-v3.schema.json');
equal(intentV2.$id,'axm.review-operation-lease-retirement-publication-archival-intent/v2','intent v2 schema id exact');
equal(statusV2.$id,'axm.review-operation-lease-retirement-publication-archival-authorization-status/v2','status v2 schema id exact');
equal(resultV3.$id,'axm.review-operation-lease-retirement-publication-archival-result/v3','result v3 schema id exact');
check(intentV2.required.includes('reasonDigest') && !intentV2.required.includes('reason'),'intent v2 requires digest and omits raw reason');
check(resultV3.required.includes('reasonDigest') && !resultV3.required.includes('reason'),'result v3 requires digest and omits raw reason');

console.log('Review Inbox archival-intent reason privacy evidence selftest: PASS (' + checks + ' assertions, exact v5.2 gap, v5.3 reason minimization, legacy compatibility, truth ceilings, sealed evidence)');
