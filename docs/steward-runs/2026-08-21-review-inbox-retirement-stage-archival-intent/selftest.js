#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname,'../../..');
const product = 'b707aa08f0adf958f6344babf0839c37ab1b9dca';
const parent = '9e648f447538928825b4fbca306c6072af461933';
const tree = '0f2aa8e9e2fad6e19416c93667cf426899955eed';
let assertions = 0;
function check(value,label) { assert(value,label); assertions += 1; }
function equal(actual,expected,label) { assert.deepStrictEqual(actual,expected,label); assertions += 1; }
function json(name) { return JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8')); }
function read(name) { return fs.readFileSync(path.join(__dirname,name),'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digestObject(value,field) { const body = JSON.parse(Core.canonicalJson(value)); delete body[field]; return 'sha256:' + sha256(Core.canonicalJson(body)); }
function git(args,encoding) {
  const result = childProcess.spawnSync('git',args,{ cwd:ROOT,encoding:encoding === null ? null : 'utf8',windowsHide:true,maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git evidence check failed');
  return result.stdout;
}

equal(String(git(['rev-parse',product + '^{tree}'])).trim(),tree,'product tree identity is exact');
equal(String(git(['rev-parse',product + '^'])).trim(),parent,'product parent identity is exact');

const baseline = json('BASELINE_AUTHORIZATION_GAP.json');
equal(baseline.status,'REPRODUCED','v5.1 missing authorization record is reproduced');
equal(baseline.sourceCommit,'a71cd29a3c0652279e5f2db1a42067e7b2c632e5','baseline binds exact v5.1 product');
equal(baseline.observations.fixtureCrashExitCode,70,'baseline uses exact pre-publication crash fixture');
equal(baseline.observations.stageStateBeforeArchive,'ARCHIVAL_REQUIRES_OPERATOR_ASSERTION','baseline stage is eligible only after assertion');
equal(baseline.observations.archivalResultState,'ARCHIVED','baseline archival succeeds');
equal(baseline.observations.resultDeclaredDurableAuthorizationRecord,false,'v5.1 result denies durable authorization');
equal(baseline.observations.archivalReasonPersistedInState,false,'v5.1 reason is not persisted');
equal(baseline.observations.authorizationIntentSchemaAvailable,false,'v5.1 has no intent schema');
equal(baseline.observations.authorizationStatusMethodAvailable,false,'v5.1 has no authorization status');
equal(baseline.observations.authorizationStatusCliAvailable,false,'v5.1 has no authorization CLI');
equal(baseline.temporaryFixtureRetained,false,'baseline retains no fixture');
equal(baseline.truth.specialistPackageIntakeAttempted,false,'baseline avoids specialist package lane');
equal(baseline.receiptDigest,digestObject(baseline,'receiptDigest'),'baseline receipt digest is canonical');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit,product,'source snapshot binds product commit');
equal(source.parent,parent,'source snapshot binds product parent');
equal(source.tree,tree,'source snapshot binds product tree');
equal(source.files.length,14,'source snapshot binds fourteen product files');
equal(source.browserFacingFilesChanged,false,'product changes no browser-facing file');
equal(source.evidenceFilesIncluded,false,'product commit excludes steward evidence');
equal(source.specialistPackageFilesIncluded,false,'product excludes specialist packages');
equal(source.productDigest,digestObject(source,'productDigest'),'source snapshot digest is canonical');
source.files.forEach(item => {
  const bytes = git(['show',product + ':' + item.path],null);
  equal(item.bytes,bytes.length,item.path + ' byte count is exact');
  equal(item.sha256,'sha256:' + sha256(bytes),item.path + ' digest is exact');
});

const checks = json('CHECK_RESULTS.json');
equal(checks.status,'PASS','scoped verification passes');
equal(checks.summary,{ commands:21,passed:21,failed:0,focusedAssertions:1110 },'verification counts are exact');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length,10,'all ten required commands are recorded');
equal(checks.commands.filter(item => item.phase === 'FOCUSED').length,11,'eleven focused commands are recorded');
check(checks.commands.every(item => item.exitCode === 0 && item.verdict === 'PASS'),'every scoped command exits zero');
check(checks.commands.some(item => item.command.endsWith('review-operation-lease-retirement-publication-stage-archival-selftest.js') && item.assertions === 342),'342-assertion archival-intent suite is recorded');
equal(checks.resultsDigest,digestObject(checks,'resultsDigest'),'verification receipt digest is canonical');

const clean = json('CLEAN_PRODUCT_REPLAY.json');
equal(clean.status,'PASS','clean product replay passes');
equal(clean.productCommit,product,'clean replay binds product commit');
equal(clean.productTree,tree,'clean replay binds product tree');
equal(clean.trackedFiles,111,'clean replay binds 111 dependency-slice files');
equal(clean.summary,{ commands:11,passed:11,failed:0,focusedAssertions:1110 },'clean replay counts are exact');
equal(clean.trackedFilesUnchangedAfterReplay,true,'clean replay changes no tracked bytes');
equal(clean.changedTrackedFiles,[],'clean replay records no changed files');
equal(clean.temporaryReplayPathRetained,false,'clean replay retains no temp root');
equal(clean.specialistPackageIntakeAttempted,false,'clean replay avoids specialist package lane');
equal(clean.replayDigest,digestObject(clean,'replayDigest'),'clean replay digest is canonical');

const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
equal(aggregate.status,'FOREIGN_FAILURE','aggregate nonpass is preserved');
equal(aggregate.exitCode,1,'aggregate exits nonzero');
check(Object.values(aggregate.reachedProductChecks).every(Boolean),'aggregate reaches every recorded product check');
equal(aggregate.failure.errorCode,'CURATED_VERIFICATION_INTAKE_MISSING','aggregate failure has exact evidence code');
equal(aggregate.failure.exactMessagePresent,true,'aggregate contains exact missing-intake message');
check(aggregate.comparison.serviceBlobUnchanged && aggregate.comparison.selftestBlobUnchanged && aggregate.comparison.modularIntakeScriptUnchanged,'failing lane and route remain unchanged');
equal(aggregate.comparison.intakePresentInWorkspace,false,'missing curated intake remains absent');
equal(aggregate.comparison.productTouchedFailingLane,false,'product does not touch failing lane');
equal(aggregate.classification.convertedToPass,false,'foreign failure is not converted to pass');
equal(aggregate.receiptDigest,digestObject(aggregate,'receiptDigest'),'aggregate receipt digest is canonical');

const before = json('FRONTIER_GAP_BEFORE.json'), after = json('FRONTIER_GAP_AFTER.json');
equal(before.overall,'BLOCKED','capability comparator starts blocked');
equal(before.requirements.filter(item => item.required && item.status === 'BLOCKED').length,10,'ten required intent gaps are initially blocked');
equal(after.overall,'DEGRADED','optional broad gaps keep the result degraded');
equal(after.requirements.filter(item => item.required && item.status === 'READY').length,10,'ten bounded required capabilities are ready');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length,0,'no bounded required capability remains open');
equal(after.requirements.filter(item => !item.required && item.status === 'OPTIONAL_GAP').length,6,'six optional broad gaps remain');
equal(after.missingCapabilities.sort(),[
  'review.retirement.publication-stage.archival-intent.authenticated-actor-authorization',
  'review.retirement.publication-stage.live-publisher-safety',
  'review.retirement.publication-stage.lossless-archive-without-hard-links',
  'review.retirement.publication-stage.storage-space-reclamation',
  'storage.cross-file.atomicity','storage.power-loss-durability.proven'
],'optional missing capabilities remain exact');

const leaseSource = String(git(['show',product + ':shared/operations/review-operation-lease.js']));
const archivalFunction = leaseSource.slice(leaseSource.indexOf('function archiveRetirementPublicationStage(input)'),leaseSource.indexOf('function retirementRecoveryStatus()'));
check(archivalFunction.indexOf('ensureRetirementPublicationArchivalIntent(input, initial)') < archivalFunction.indexOf('fs.linkSync(stagePath, archivePath)'),'product publishes intent before archive link');
check(archivalFunction.indexOf('ensureRetirementPublicationArchivalIntent(input, initial)') < archivalFunction.indexOf('fs.unlinkSync(stagePath)'),'product publishes intent before active-stage unlink');
check(leaseSource.includes('function publicationArchivalRequestDigest(input)'),'product exposes exact closed request digest');
check(leaseSource.includes('function validPublicationArchivalIntent(value, identity)'),'product validates closed archival intent');
check(leaseSource.includes('value.requestDigest === publicationArchivalRequestDigest({'),'product recomputes request digest during validation');
check(leaseSource.includes('MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES = 200'),'intent-stage status is bounded');
check(leaseSource.includes("state:'LEGACY_ARCHIVE_AUTHORIZATION_UNKNOWN'") && leaseSource.includes('legacy archive checkpoint has no durable pre-mutation intent'),'legacy archive and checkpoint honesty is explicit');
check(leaseSource.includes('authoritativeTargetMutatedByArchival:false') && leaseSource.includes('ownerLockMutatedByArchival:false'),'runtime preserves authority target and owner lock');
check(leaseSource.includes('callerAssertionAuthenticated:false') && leaseSource.includes('livePublisherSafetyProven:false'),'runtime refuses actor-authentication and publisher-safety inflation');
check(!leaseSource.includes('callerAssertionAuthenticated:true') && !leaseSource.includes('livePublisherSafetyProven:true'),'runtime never inflates missing authorization or safety');

const oldResult = git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-archival-result.schema.json'],null);
const parentResult = git(['show',parent + ':shared/operations/review-operation-lease-retirement-publication-archival-result.schema.json'],null);
equal(sha256(oldResult),sha256(parentResult),'v1 archival-result schema is byte-preserved');
const intentSchema = JSON.parse(String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-archival-intent.schema.json'])));
const statusSchema = JSON.parse(String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-archival-authorization-status.schema.json'])));
const resultV2Schema = JSON.parse(String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-archival-result-v2.schema.json'])));
equal(intentSchema.$id,'axm.review-operation-lease-retirement-publication-archival-intent/v1','intent schema id is exact');
equal(statusSchema.$id,'axm.review-operation-lease-retirement-publication-archival-authorization-status/v1','status schema id is exact');
equal(resultV2Schema.$id,'axm.review-operation-lease-retirement-publication-archival-result/v2','new result schema uses v2');
check(intentSchema.additionalProperties === false && statusSchema.additionalProperties === false && resultV2Schema.additionalProperties === false,'new schemas are closed');

const manifest = JSON.parse(String(git(['show',product + ':tools/review-inbox/manifest.json'])));
const contract = JSON.parse(String(git(['show',product + ':tools/review-inbox/module.contract.json'])));
equal(manifest.version,'v1.4','Review Inbox manifest is v1.4');
equal(manifest.status,'TEST','Review Inbox remains TEST');
equal(contract.version,manifest.version,'manifest and contract versions agree');
check(contract.provides.includes('durable-intent-before-retirement-publication-stage-archival-mutation'),'contract declares intent-before-mutation capability');
check(contract.provides.includes('legacy-archive-authorization-unknown-without-posthoc-intent'),'contract declares legacy honesty');
check(contract.boundaries.refuses.includes('durable-archival-intent-as-authenticated-actor-consent-permission-or-safe-publisher-termination-proof'),'contract refuses authorization inflation');
check(contract.boundaries.refuses.includes('automatic-api-or-browser-archival-intent-publication-or-status'),'contract refuses automatic/API/browser intent surfaces');

const toolsIndex = JSON.parse(String(git(['show',product + ':tools-index.json'])));
const reviewTool = toolsIndex.tools.find(item => item.id === 'review-inbox');
equal(toolsIndex.summary.capabilities,1885,'tools index records 1,885 capabilities');
equal(reviewTool.version,'v1.4','tools index records Review Inbox v1.4');
equal(reviewTool.promotion.state,'READY_FOR_HUMAN_REVIEW','tools index records bounded readiness');
equal(reviewTool.promotion.blockers,[],'Review Inbox has no current selftest blocker');

const promotion = json('PROMOTION_SELFTEST_RECEIPT.json');
equal(promotion.status,'MIXED','global promotion selftests preserve mixed result');
equal(promotion.summary,{ total:123,pass:111,notPass:12 },'promotion counts are exact');
equal(promotion.reviewInbox.verdict,'PASS','Review Inbox promotion selftest passes');
equal(promotion.reviewInbox.exactCurrentSelftestDigest,true,'Review Inbox selftest digest is current');
equal(promotion.reviewInbox.indexPromotionState,'READY_FOR_HUMAN_REVIEW','promotion receipt matches tools index');
equal(promotion.preservedNonPass.length,12,'twelve other nonpasses are preserved');
equal(promotion.truth.readyForHumanReviewIsPromotion,false,'readiness is not promotion');
equal(promotion.truth.readyForHumanReviewIsCanon,false,'readiness is not CANON');
equal(promotion.truth.failureTailsRetained,false,'raw failure tails are not retained');
equal(promotion.receiptDigest,digestObject(promotion,'receiptDigest'),'promotion receipt digest is canonical');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length,16,'sixteen claim-specific evidence routes are retained');
check(routes.routes.every(item => item.verdict === 'PASS' && item.counterevidence),'every route has evidence and counterevidence');
check(routes.routes.some(item => item.kind === 'behavioral'),'behavioral claims use behavioral evidence');
check(routes.routes.some(item => item.kind === 'persistence'),'persistence claims use crash/replay evidence');
check(routes.routes.some(item => item.kind === 'authorization'),'authorization claims use bounded contract evidence');
check(routes.routes.some(item => item.kind === 'visual'),'browser-scope claim has an explicit visual route');
equal(routes.routesDigest,'sha256:' + sha256(Core.canonicalJson(routes.routes)),'evidence routes digest is canonical');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status,'PASS','bounded native surface receipt passes');
equal(native.liveBrowserRerun,false,'no browser rerun is claimed');
equal(native.browserRenderClickTest,'NOT_RUN_HOST_LOCAL_NO_BROWSER_ROUTE','browser test status is exact');
equal(native.intentPublicationRealChildProcessCrashCases,6,'native receipt records six intent crashes');
equal(native.archivalRealChildProcessCrashCases,9,'native receipt records nine archive crashes');
equal(native.realCooperatingArchivalProcesses,2,'native receipt records two real archival callers');
equal(native.truth.durableExactArchivalIntentObserved,true,'native receipt records durable exact intent');
equal(native.truth.legacyArchiveCheckpointStageUnlinkRefused,true,'native receipt records legacy checkpoint hold');
equal(native.truth.callerAssertionAuthenticated,false,'native receipt denies actor authentication');
equal(native.truth.storageSpaceReclaimed,false,'native receipt denies space reclamation');
equal(native.truth.livePublisherSafetyProven,false,'native receipt denies live-publisher safety');
equal(native.truth.humanBenefitProven,false,'human benefit remains unproven');
equal(native.truth.learningProven,false,'learning remains unproven');
equal(native.truth.canonAuthorized,false,'CANON authority remains false');
equal(native.receiptDigest,digestObject(native,'receiptDigest'),'native receipt digest is canonical');

const seal = json('SESSION_SEGMENT.seal.json'), segment = read('SESSION_SEGMENT.jsonl');
equal(seal.parseStatus,'valid','session segment parses');
equal(seal.eventLines,20,'session segment retains twenty semantic events');
equal(seal.validJsonLines,20,'every session line is valid JSON');
equal(seal.sha256,sha256(segment),'session seal digest matches');
const events = segment.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence),Array.from({ length:20 },(_,index) => index + 1),'session sequence is contiguous');
check(events.some(item => item.status === 'FOREIGN_FAILURE'),'session preserves aggregate foreign failure');
check(events.some(item => item.kind === 'promotion-selftest' && item.status === 'MIXED'),'session preserves other promotion nonpasses');
check(events.some(item => item.kind === 'readiness' && item.status === 'READY_FOR_HUMAN_REVIEW'),'session records bounded readiness');
const sessionIndex = json('SESSION_INDEX.json');
equal(sessionIndex.broadGoalComplete,false,'broad objective remains active');
equal(sessionIndex.mergeGate,'Mike Tobi / AXM','merge gate remains Mike Tobi / AXM');
equal(sessionIndex.canonGate,'Mike Tobi / AXM','CANON gate remains Mike Tobi / AXM');
equal(sessionIndex.specialistPackageIntakeAttempted,false,'specialist package lane remains untouched');
const curation = json('CURATION_RECEIPT.json');
equal(curation.status,'PASS','curation receipt passes');
equal(curation.durableEventsPreserved,20,'curation retains twenty semantic events');
equal(curation.retainedRawLogs,false,'curation retains no raw logs');
equal(curation.retainedFailureTails,false,'curation retains no failure tails');
equal(curation.retainedRawStageBytes,false,'curation retains no raw stage bytes');
equal(curation.aggregateOperationsStatus,'FOREIGN_FAILURE','curation preserves aggregate failure');
equal(curation.broadGoalComplete,false,'curation leaves broad objective active');

const files = fs.readdirSync(__dirname).filter(name => fs.statSync(path.join(__dirname,name)).isFile());
check(!files.some(name => /\.(?:png|jpe?g|webp|mp4|webm|zip)$/i.test(name)),'no raw media or package is retained');
const retained = files.map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(retained),'evidence contains no machine-local path');
check(/Mike Tobi \/ AXM remains the merge and `CANON` gate/.test(read('README.md')),'README preserves the human gate');
check(read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'),'frontier audit preserves goal continuity');

console.log('PASS Review Inbox archival intent v5.2 evidence: ' + assertions + ' checks');
