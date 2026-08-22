#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname,'../../..');
const product = 'a71cd29a3c0652279e5f2db1a42067e7b2c632e5';
const parent = 'aafff013093cf0a23a4f49ba6a5c73acdc068238';
const tree = 'db8b749c7597b9af7fa0b901c1f917f6ef149b88';
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

const baseline = json('BASELINE_STAGE_ACCUMULATION.json');
equal(baseline.status,'REPRODUCED','v5.0 stage accumulation is reproduced');
equal(baseline.sourceCommit,'c64dd671c0c4bed1f798a546de879b48c8ac93cc','baseline binds exact v5.0 product commit');
equal(baseline.observations.atBound.entries,200,'baseline records exact status bound');
equal(baseline.observations.atBound.state,'STAGED','two hundred stages remain visible');
equal(baseline.observations.overBound.entries,201,'baseline records exact over-bound count');
equal(baseline.observations.overBound.state,'HELD','the 201st stage holds status');
equal(baseline.observations.invalidJsonReportedAsStaged,true,'baseline records name-only validation');
equal(baseline.observations.exactPlanMethodAvailable,false,'baseline has no exact plan');
equal(baseline.observations.archivalMethodAvailable,false,'baseline has no archival method');
equal(baseline.temporaryFixtureRetained,false,'baseline retains no temp fixture');
equal(baseline.truth.specialistPackageIntakeAttempted,false,'baseline avoids specialist package lane');
equal(baseline.receiptDigest,'sha256:3d3961ccc4b746c18fd21e0d420a2d2407336f6dec66c0316ff360dc20e765d9','baseline receipt digest is exact');

const source = json('SOURCE_SNAPSHOT.json');
equal(source.commit,product,'source snapshot binds product commit');
equal(source.parent,parent,'source snapshot binds parent commit');
equal(source.tree,tree,'source snapshot binds product tree');
equal(source.files.length,15,'source snapshot binds fifteen product files');
equal(source.browserFacingFilesChanged,false,'product changes no browser-facing file');
equal(source.evidenceFilesIncluded,false,'product commit excludes steward evidence');
equal(source.specialistPackageFilesIncluded,false,'product commit excludes specialist packages');
equal(source.productDigest,digestObject(source,'productDigest'),'source snapshot digest is canonical');
source.files.forEach(item => {
  const bytes = git(['show',product + ':' + item.path],null);
  equal(item.bytes,bytes.length,item.path + ' byte count is exact');
  equal(item.sha256,'sha256:' + sha256(bytes),item.path + ' digest is exact');
});

const checks = json('CHECK_RESULTS.json');
equal(checks.status,'PASS','scoped verification passes');
equal(checks.summary,{ commands:21,passed:21,failed:0,focusedAssertions:930 },'verification counts are exact');
equal(checks.commands.filter(item => item.phase === 'REQUIRED').length,10,'all ten required commands are recorded');
equal(checks.commands.filter(item => item.phase === 'FOCUSED').length,11,'eleven focused commands are recorded');
check(checks.commands.every(item => item.exitCode === 0 && item.verdict === 'PASS'),'every scoped command exits zero');
check(checks.commands.some(item => item.command.endsWith('review-operation-lease-retirement-publication-stage-archival-selftest.js') && item.assertions === 183),'183-assertion archival suite is recorded');
equal(checks.resultsDigest,digestObject(checks,'resultsDigest'),'verification receipt digest is canonical');

const clean = json('CLEAN_PRODUCT_REPLAY.json');
equal(clean.status,'PASS','clean product replay passes');
equal(clean.productCommit,product,'clean replay binds product commit');
equal(clean.productTree,tree,'clean replay binds product tree');
equal(clean.trackedFiles,108,'clean replay binds 108 dependency-slice files');
equal(clean.summary,{ commands:11,passed:11,failed:0,focusedAssertions:930 },'clean replay counts are exact');
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
equal(before.requirements.filter(item => item.required && item.status === 'BLOCKED').length,9,'nine required archival gaps are initially blocked');
equal(after.overall,'DEGRADED','optional broad gaps keep the result degraded');
equal(after.requirements.filter(item => item.required && item.status === 'READY').length,9,'nine bounded required capabilities are ready');
equal(after.requirements.filter(item => item.required && item.status !== 'READY').length,0,'no bounded required capability remains open');
equal(after.requirements.filter(item => !item.required && item.status === 'OPTIONAL_GAP').length,6,'six optional broad gaps remain');
equal(after.missingCapabilities.sort(),[
  'review.retirement.publication-stage.durable-authorization-record','review.retirement.publication-stage.live-publisher-safety','review.retirement.publication-stage.lossless-archive-without-hard-links','review.retirement.publication-stage.storage-space-reclamation','storage.cross-file.atomicity','storage.power-loss-durability.proven'
],'optional missing capabilities remain exact');

const leaseSource = String(git(['show',product + ':shared/operations/review-operation-lease.js']));
check(leaseSource.indexOf('fs.linkSync(stagePath, archivePath)') < leaseSource.indexOf('fs.unlinkSync(stagePath)'),'product preserves archive-link then active-stage-unlink order');
check(leaseSource.includes('function retirementPublicationStagePlan(stageFile)'),'product exposes exact stage plan');
check(leaseSource.includes('function archiveRetirementPublicationStage(input)'),'product exposes explicit stage archival');
check(leaseSource.includes('validPublicationStageArtifact(evidence.value, identity)'),'product validates staged JSON against artifact identity');
check(leaseSource.includes("value !== value.toLowerCase()"),'runtime and closed request schema agree on lowercase stage names');
check(leaseSource.includes('authoritativeTargetMutatedByArchival:false') && leaseSource.includes('ownerLockMutatedByArchival:false'),'runtime preserves authority and owner lock');
check(leaseSource.includes('stageBytesDeletedByArchival:false') && leaseSource.includes('storageSpaceReclaimed:false'),'runtime refuses deletion and reclamation inflation');
check(leaseSource.includes('durableArchivalAuthorizationRecordProvided:false') && leaseSource.includes('livePublisherSafetyProven:false'),'runtime refuses authorization-record and publisher-safety inflation');
check(!leaseSource.includes('storageSpaceReclaimed:true') && !leaseSource.includes('livePublisherSafetyProven:true'),'runtime never inflates missing optional capabilities');
const archivalTest = String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-stage-archival-selftest.js']));
check(archivalTest.includes("for (const artifact of ['intent','decision','result'])") && archivalTest.includes("for (const phase of ['pre-link','post-link','post-unlink'])"),'product test covers nine artifact-phase crash cases');
check(archivalTest.includes("Promise.all([spawnWorker"),'product test launches two real archival callers');

const planSchema = JSON.parse(String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-stage-plan.schema.json'])));
const requestSchema = JSON.parse(String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-archival-request.schema.json'])));
const resultSchema = JSON.parse(String(git(['show',product + ':shared/operations/review-operation-lease-retirement-publication-archival-result.schema.json'])));
check(planSchema.additionalProperties === false && requestSchema.additionalProperties === false && resultSchema.additionalProperties === false,'all three archival schemas are closed');
equal(requestSchema.properties.assertion.const,'I_ASSERT_THE_RETIREMENT_PUBLICATION_STAGE_PUBLISHER_TERMINATED_OR_ABANDONED_THIS_STAGE','request schema preserves exact assertion');

const manifest = JSON.parse(String(git(['show',product + ':tools/review-inbox/manifest.json'])));
const contract = JSON.parse(String(git(['show',product + ':tools/review-inbox/module.contract.json'])));
equal(manifest.version,'v1.3','Review Inbox manifest is v1.3');
equal(manifest.status,'TEST','Review Inbox remains TEST');
equal(contract.version,manifest.version,'manifest and contract versions agree');
check(contract.provides.includes('assertion-and-exact-digest-bound-lossless-retirement-publication-stage-archival'),'contract declares bounded archival capability');
check(contract.boundaries.refuses.includes('retirement-publication-stage-archival-as-byte-deletion-or-storage-space-reclamation'),'contract refuses deletion and space inflation');
check(contract.boundaries.refuses.includes('retirement-publication-stage-archival-as-live-publisher-safety-or-publisher-termination-proof'),'contract refuses publisher-safety inflation');
check(contract.boundaries.refuses.includes('automatic-api-or-browser-retirement-publication-stage-archival'),'contract refuses automatic/API/browser archival');
const toolsIndex = JSON.parse(String(git(['show',product + ':tools-index.json'])));
const reviewTool = toolsIndex.tools.find(item => item.id === 'review-inbox');
equal(toolsIndex.summary.capabilities,1879,'tools index records 1,879 capabilities');
equal(reviewTool.version,'v1.3','tools index records Review Inbox v1.3');
equal(reviewTool.promotion.state,'BLOCKED','tools index preserves stale promotion evidence as blocked');
equal(reviewTool.promotion.blockers,['selftest result is stale for the current selftest digest'],'tools index names the exact current promotion blocker');

const routes = json('EVIDENCE_ROUTES.json');
equal(routes.routes.length,14,'fourteen claim-specific evidence routes are retained');
check(routes.routes.every(item => item.verdict === 'PASS' && item.counterevidence),'every route has evidence and counterevidence');
check(routes.routes.some(item => item.kind === 'behavioral'),'behavioral claims use behavioral evidence');
check(routes.routes.some(item => item.kind === 'persistence'),'persistence claims use replay evidence');
check(routes.routes.some(item => item.kind === 'authorization'),'authorization claims use bounded contract evidence');
check(routes.routes.some(item => item.kind === 'visual'),'browser-scope claim has an explicit visual route');
equal(routes.routesDigest,'sha256:' + sha256(Core.canonicalJson(routes.routes)),'evidence routes digest is canonical');

const native = json('NATIVE_SURFACE_RECEIPT.json');
equal(native.status,'PASS','bounded native surface receipt passes');
equal(native.liveBrowserRerun,false,'no browser rerun is claimed');
equal(native.browserRenderClickTest,'NOT_RUN_HOST_LOCAL_NO_BROWSER_ROUTE','browser test status is exact');
equal(native.archivalRealChildProcessCrashCases,9,'native receipt records nine archival crash cases');
equal(native.realCooperatingArchivalProcesses,2,'native receipt records two real archival callers');
equal(native.promotionReady,false,'native receipt does not claim promotion readiness');
equal(native.promotionBlocker,'selftest result is stale for the current selftest digest','native receipt preserves exact promotion blocker');
equal(native.truth.losslessArchiveBytesObserved,true,'native receipt records exact preserved bytes');
equal(native.truth.stageBytesDeletedByArchival,false,'native receipt denies byte deletion');
equal(native.truth.storageSpaceReclaimed,false,'native receipt denies space reclamation');
equal(native.truth.livePublisherSafetyProven,false,'native receipt denies live-publisher safety');
equal(native.truth.humanBenefitProven,false,'human benefit remains unproven');
equal(native.truth.canonAuthorized,false,'CANON authority remains false');
equal(native.receiptDigest,digestObject(native,'receiptDigest'),'native receipt digest is canonical');

const seal = json('SESSION_SEGMENT.seal.json'), segment = read('SESSION_SEGMENT.jsonl');
equal(seal.parseStatus,'valid','session segment parses');
equal(seal.eventLines,19,'session segment retains nineteen semantic events');
equal(seal.validJsonLines,19,'every session line is valid JSON');
equal(seal.sha256,sha256(segment),'session seal digest matches');
const events = segment.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence),Array.from({ length:19 },(_,index) => index + 1),'session sequence is contiguous');
check(events.some(item => item.status === 'FOREIGN_FAILURE'),'session preserves aggregate foreign failure');
check(events.some(item => item.kind === 'promotion' && item.status === 'BLOCKED'),'session preserves promotion block');
const sessionIndex = json('SESSION_INDEX.json');
equal(sessionIndex.broadGoalComplete,false,'broad objective remains active');
equal(sessionIndex.mergeGate,'Mike Tobi / AXM','merge gate remains Mike Tobi / AXM');
equal(sessionIndex.canonGate,'Mike Tobi / AXM','CANON gate remains Mike Tobi / AXM');
equal(sessionIndex.specialistPackageIntakeAttempted,false,'specialist package lane remains untouched');
const curation = json('CURATION_RECEIPT.json');
equal(curation.status,'PASS','curation receipt passes');
equal(curation.durableEventsPreserved,19,'curation retains nineteen semantic events');
equal(curation.retainedRawLogs,false,'curation retains no raw logs');
equal(curation.retainedRawStageBytes,false,'curation retains no raw stage bytes');
equal(curation.aggregateOperationsStatus,'FOREIGN_FAILURE','curation preserves aggregate failure');
equal(curation.broadGoalComplete,false,'curation leaves broad objective active');

const files = fs.readdirSync(__dirname).filter(name => fs.statSync(path.join(__dirname,name)).isFile());
check(!files.some(name => /\.(?:png|jpe?g|webp|mp4|webm|zip)$/i.test(name)),'no raw media or package is retained');
const retained = files.map(read).join('\n');
check(!/[A-Z]:\\(?:Users|CODEX_WORKTREES|AXM_ACTIVE)\\/i.test(retained),'evidence contains no machine-local path');
check(/Mike Tobi \/ AXM remains the merge and `CANON` gate/.test(read('README.md')),'README preserves the human gate');
check(read('FRONTIER_AUDIT.md').includes('broad grounded-growth objective remains active'),'frontier audit preserves goal continuity');

console.log('PASS Review Inbox retirement stage archival v5.1 evidence: ' + assertions + ' checks');
