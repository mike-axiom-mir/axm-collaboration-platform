#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Lease = require('./review-operation-lease');

const publicationTest = path.join(__dirname,'review-operation-lease-retirement-publication-selftest.js');

function archivalInput(plan) {
  return {
    schema:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA,
    stageFile:plan.stageFile,
    stageDigest:plan.stageDigest,
    assertion:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION,
    confirmation:plan.confirmationRequired || Lease.RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + plan.stageFile + ' ' + plan.stageDigest,
    reason:'Operator asserts the exact publication stage publisher terminated or abandoned this stage.'
  };
}

function waitForPeers(stateRoot) {
  const deadline = Date.now() + 10000;
  while (fs.readdirSync(stateRoot).filter(name => /^archive-worker-.+\.ready$/.test(name)).length < 2) {
    if (Date.now() >= deadline) throw new Error('archive worker barrier timeout');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);
  }
}

function archiveCrashChild(stateRoot, stageFile, stageDigest, phase) {
  const lease = Lease.create({ stateRoot, timeoutMs:0 }), plan = lease.retirementPublicationStagePlan(stageFile), input = archivalInput(plan);
  input.stageDigest = stageDigest;
  input.confirmation = Lease.RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + stageFile + ' ' + stageDigest;
  const originalLink = fs.linkSync, originalUnlink = fs.unlinkSync;
  fs.linkSync = (source,target) => {
    if (path.resolve(target) === path.resolve(lease.retirementPublicationArchivalIntentDirectory,stageFile + '.archival-intent.json')) {
      if (phase === 'pre-intent-link') process.exit(84);
      const linked = originalLink(source,target);
      if (phase === 'post-intent-link') process.exit(85);
      return linked;
    }
    if (path.resolve(target) === path.resolve(lease.retirementPublicationArchiveDirectory,stageFile + '.archived')) {
      if (phase === 'pre-link') process.exit(80);
      const linked = originalLink(source,target);
      if (phase === 'post-link') process.exit(81);
      return linked;
    }
    return originalLink(source,target);
  };
  fs.unlinkSync = file => {
    if (phase === 'post-unlink' && path.resolve(file) === path.resolve(lease.retirementPublicationDirectory,stageFile)) {
      const unlinked = originalUnlink(file);
      process.exit(82);
      return unlinked;
    }
    return originalUnlink(file);
  };
  lease.archiveRetirementPublicationStage(input);
  process.exit(83);
}

function archiveWorker(stateRoot, stageFile, stageDigest, workerId) {
  const lease = Lease.create({ stateRoot, timeoutMs:0 }), plan = lease.retirementPublicationStagePlan(stageFile), input = archivalInput(plan);
  input.stageDigest = stageDigest;
  input.confirmation = Lease.RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + stageFile + ' ' + stageDigest;
  const ready = path.join(stateRoot,'archive-worker-' + workerId + '.ready'), originalLink = fs.linkSync;
  let entered = false;
  try {
    fs.linkSync = (source,target) => {
      if (!entered && path.resolve(target) === path.resolve(lease.retirementPublicationArchiveDirectory,stageFile + '.archived')) {
        entered = true;
        fs.writeFileSync(ready,'ready',{ flag:'wx' });
        waitForPeers(stateRoot);
        if (workerId === 'later') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30);
      }
      return originalLink(source,target);
    };
    const result = lease.archiveRetirementPublicationStage(input);
    process.stdout.write(JSON.stringify({ ok:true, state:result.state, entered }) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok:false, code:error.code || 'UNTYPED', entered }) + '\n');
    process.exitCode = 1;
  } finally { fs.linkSync = originalLink; }
}

if (process.argv[2] === '--archive-crash-child') archiveCrashChild(path.resolve(process.argv[3]),process.argv[4],process.argv[5],process.argv[6]);
if (process.argv[2] === '--archive-worker') archiveWorker(path.resolve(process.argv[3]),process.argv[4],process.argv[5],process.argv[6]);

let assertions = 0;
function equal(actual,expected,label) { assert.deepStrictEqual(actual,expected,label); assertions += 1; }
function check(value,label) { assert(value,label); assertions += 1; }
function exactKeys(value,schema,label) { equal(Object.keys(value).sort(),Object.keys(schema.properties).sort(),label); }
function capture(action) { try { return { result:action(), error:null }; } catch (error) { return { result:null,error }; } }
function refused(action,label) { const value = capture(action); equal(value.error && value.error.code,'REVIEW_OPERATION_RETIREMENT_PUBLICATION_ARCHIVAL_REFUSED',label); return value.error; }
function cli(args) { return childProcess.spawnSync(process.execPath,[path.join(__dirname,'review-operation-lease-admin.js'),...args],{ encoding:'utf8', windowsHide:true }); }
function publicationCrash(stateRoot,artifact,phase) {
  const child = childProcess.spawnSync(process.execPath,[publicationTest,'--crash-child',stateRoot,artifact,phase || 'pre'],{ encoding:'utf8', windowsHide:true });
  equal(child.status,(phase || 'pre') === 'pre' ? 70 : 71,artifact + ' publication fixture exits at exact ' + (phase || 'pre') + '-link checkpoint');
  const lease = Lease.create({ stateRoot, timeoutMs:0 }), status = lease.retirementPublicationStatus();
  equal(status.stagedCandidates,1,artifact + ' publication fixture leaves one stage');
  const stageFile = status.records[0].file, plan = lease.retirementPublicationStagePlan(stageFile);
  return {
    lease,stageFile,plan,
    stagePath:path.join(lease.retirementPublicationDirectory,stageFile),
    archivePath:path.join(lease.retirementPublicationArchiveDirectory,stageFile + '.archived'),
    targetPath:path.join(lease.retirementsDirectory,plan.targetFile),
    intentPath:path.join(lease.retirementPublicationArchivalIntentDirectory,stageFile + '.archival-intent.json')
  };
}
function spawnWorker(stateRoot,stageFile,digest,workerId) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath,[__filename,'--archive-worker',stateRoot,stageFile,digest,workerId],{ windowsHide:true, stdio:['ignore','pipe','pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data',chunk => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data',chunk => { stderr += chunk.toString('utf8'); });
    child.on('close',code => resolve({ code,stdout,stderr }));
  });
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'axm-retirement-stage-archival-'));
  try {
    const planSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-stage-plan.schema.json'),'utf8'));
    const requestSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-archival-request.schema.json'),'utf8'));
    const legacyIntentSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-archival-intent.schema.json'),'utf8'));
    const intentSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-archival-intent-v2.schema.json'),'utf8'));
    const legacyAuthorizationStatusSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-archival-authorization-status.schema.json'),'utf8'));
    const authorizationStatusSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-archival-authorization-status-v2.schema.json'),'utf8'));
    const legacyResultSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-archival-result-v2.schema.json'),'utf8'));
    const resultSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'review-operation-lease-retirement-publication-archival-result-v3.schema.json'),'utf8'));
    equal(planSchema.$id,Lease.RETIREMENT_PUBLICATION_STAGE_PLAN_SCHEMA,'stage plan schema id matches runtime');
    equal(requestSchema.$id,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA,'archival request schema id matches runtime');
    equal(legacyIntentSchema.$id,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1,'legacy archival intent schema remains explicit');
    equal(intentSchema.$id,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA,'archival intent schema id matches runtime');
    equal(legacyAuthorizationStatusSchema.$id,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA_V1,'legacy archival authorization status schema remains explicit');
    equal(authorizationStatusSchema.$id,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA,'archival authorization status schema id matches runtime');
    equal(legacyResultSchema.$id,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA_V2,'legacy archival result schema remains explicit');
    equal(resultSchema.$id,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA,'archival result schema id matches runtime');
    [planSchema,requestSchema,legacyIntentSchema,intentSchema,legacyAuthorizationStatusSchema,authorizationStatusSchema,legacyResultSchema,resultSchema].forEach(schema => equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema',schema.$id + ' uses exact dialect'));

    const unpublished = publicationCrash(path.join(root,'unpublished'),'intent','pre');
    equal(unpublished.plan.state,'ARCHIVAL_REQUIRES_OPERATOR_ASSERTION','exact unpublished stage requires explicit archival assertion');
    equal(unpublished.plan.reasonCode,'EXACT_UNPUBLISHED_STAGE_REQUIRES_ARCHIVAL_ASSERTION','unpublished stage has exact reason');
    equal(unpublished.plan.targetState,'ABSENT','unpublished stage observes absent authoritative target');
    equal(unpublished.plan.archiveState,'MISSING','unpublished stage observes absent archive');
    equal(unpublished.plan.assertionRequired,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION,'plan exposes exact publisher-abandonment assertion');
    equal(unpublished.plan.confirmationRequired,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + unpublished.stageFile + ' ' + unpublished.plan.stageDigest,'plan binds exact filename and digest confirmation');
    exactKeys(unpublished.plan,planSchema,'stage plan matches closed schema');
    exactKeys(unpublished.plan.truth,planSchema.$defs.truth,'stage plan truth matches closed schema');
    const authorizationRequired = unpublished.lease.retirementPublicationArchivalAuthorizationStatus(unpublished.stageFile);
    equal(authorizationRequired.state,'AUTHORIZATION_REQUIRED','exact active stage requires durable archival intent');
    equal(authorizationRequired.reasonCode,'DURABLE_ARCHIVAL_INTENT_REQUIRED','missing durable intent has exact reason');
    exactKeys(authorizationRequired,authorizationStatusSchema,'authorization status matches closed schema');
    exactKeys(authorizationRequired.truth,authorizationStatusSchema.properties.truth,'authorization truth matches closed schema');
    const unpublishedBytes = fs.readFileSync(unpublished.stagePath), request = archivalInput(unpublished.plan);
    const fixtureCredential = ['axm','fixture','credential'].join('-'), fixtureMachinePath = 'C:\\private\\publisher\\evidence.log';
    request.reason = 'Fixture evidence OPENAI_API_KEY="' + fixtureCredential + '" at ' + fixtureMachinePath + ' remains held for operator inspection.';
    exactKeys(request,requestSchema,'archival request matches closed schema');
    refused(() => unpublished.lease.archiveRetirementPublicationStage({ ...request,schema:'wrong' }),'wrong archival schema is refused');
    refused(() => unpublished.lease.archiveRetirementPublicationStage({ ...request,stageDigest:'sha256:' + '0'.repeat(64) }),'wrong stage digest is refused');
    refused(() => unpublished.lease.archiveRetirementPublicationStage({ ...request,assertion:'MAYBE' }),'wrong publisher assertion is refused');
    refused(() => unpublished.lease.archiveRetirementPublicationStage({ ...request,confirmation:'ARCHIVE' }),'wrong archival confirmation is refused');
    refused(() => unpublished.lease.archiveRetirementPublicationStage({ ...request,reason:'short' }),'short archival reason is refused');
    refused(() => unpublished.lease.archiveRetirementPublicationStage({ ...request,reason:' leading archival reason is explicitly refused' }),'untrimmed archival reason is refused');
    refused(() => unpublished.lease.archiveRetirementPublicationStage({ ...request,extra:true }),'open archival request is refused');
    equal(fs.readFileSync(unpublished.stagePath),unpublishedBytes,'refusals preserve exact stage bytes');
    equal(fs.existsSync(unpublished.targetPath),false,'refusals do not create authoritative target');
    const archived = unpublished.lease.archiveRetirementPublicationStage(request);
    equal(archived.state,'ARCHIVED','exact unpublished stage is archived');
    exactKeys(archived,resultSchema,'archival result matches closed schema');
    exactKeys(archived.truth,resultSchema.$defs.truth,'archival result truth matches closed schema');
    equal(fs.existsSync(unpublished.stagePath),false,'archival removes active stage path');
    equal(fs.readFileSync(unpublished.archivePath),unpublishedBytes,'archival preserves exact stage bytes losslessly');
    equal(fs.existsSync(unpublished.targetPath),false,'unpublished archival leaves authoritative target absent');
    equal(unpublished.lease.retirementPublicationStatus().state,'CURRENT','archival clears active staging status');
    equal(unpublished.lease.retirementPublicationStagePlan(unpublished.stageFile).state,'ALREADY_ARCHIVED','post-archive plan is exact observation');
    const authorized = unpublished.lease.retirementPublicationArchivalAuthorizationStatus(unpublished.stageFile);
    equal(authorized.state,'AUTHORIZED','post-archive status preserves exact durable authorization');
    equal(authorized.intentState,'EXACT_STAGE_BINDING','durable intent binds exact stage digest');
    equal(authorized.intentSchema,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA,'authorization status types the private intent schema');
    equal(authorized.exactRawReasonPersisted,false,'authorization status denies exact raw reason persistence for v2 intent');
    equal(authorized.reasonDigest,Lease.publicationArchivalReasonDigest(request.reason),'authorization status exposes exact reason digest');
    equal(authorized.reasonRedactionApplied,true,'authorization status reports reason redaction');
    equal(authorized.truth.reasonDigestStructurallyValid,true,'authorization truth validates v2 reason digest structure');
    equal(authorized.truth.reasonDigestBoundToRequestDigest,true,'authorization truth binds v2 reason digest into the recomputed request digest');
    equal(authorized.truth.exactRawReasonPersisted,false,'authorization truth denies exact raw reason persistence');
    equal(authorized.truth.arbitrarySecretAbsenceProven,false,'authorization truth denies arbitrary secret absence proof');
    equal(authorized.truth.commandLineHistorySanitized,false,'authorization truth excludes shell history from its claim');
    equal(authorized.residualIntentStages,0,'normal intent publication leaves no residual intent stage');
    exactKeys(authorized,authorizationStatusSchema,'authorized status matches closed schema');
    const intent = JSON.parse(fs.readFileSync(unpublished.intentPath,'utf8'));
    equal(Lease.validPublicationArchivalIntent(intent,Object.assign({ stageFile:unpublished.stageFile },Lease.publicationStageIdentity(unpublished.stageFile))),true,'persisted intent is exact');
    equal(intent.requestDigest,Lease.publicationArchivalRequestDigest(request),'persisted intent binds exact closed request digest');
    equal(intent.reasonDigest,Lease.publicationArchivalReasonDigest(request.reason),'persisted intent commits to exact raw reason bytes');
    equal(Object.prototype.hasOwnProperty.call(intent,'reason'),false,'v2 intent omits raw reason property');
    equal(intent.reasonRedactionApplied,true,'v2 intent reports applied redaction');
    check(intent.reasonRedacted.includes('<REDACTED_CREDENTIAL>'),'v2 intent retains explicit credential-redaction marker');
    check(intent.reasonRedacted.includes('<ABSOLUTE_PATH>'),'v2 intent retains explicit machine-path redaction marker');
    check(!intent.reasonRedacted.includes(fixtureCredential),'v2 intent excludes recognized credential value');
    check(!intent.reasonRedacted.includes(fixtureMachinePath),'v2 intent excludes machine path');
    check(!fs.readFileSync(unpublished.intentPath,'utf8').includes(fixtureCredential),'durable v2 intent bytes exclude recognized credential value');
    check(!fs.readFileSync(unpublished.intentPath,'utf8').includes(fixtureMachinePath),'durable v2 intent bytes exclude machine path');
    exactKeys(intent,intentSchema,'persisted intent matches closed schema');
    exactKeys(intent.truth,intentSchema.properties.truth,'persisted intent truth matches closed schema');
    equal(unpublished.lease.archiveRetirementPublicationStage(request).state,'ALREADY_ARCHIVED','repeated exact archival is idempotent observation');
    equal(archived.truth.losslessArchiveBytesPreserved,true,'result confirms archive bytes preserved');
    equal(archived.truth.stagePathRemoved,true,'result confirms active stage path removed');
    equal(archived.truth.authoritativeTargetMutatedByArchival,false,'result denies authoritative-target mutation');
    equal(archived.truth.stageBytesDeletedByArchival,false,'result denies stage-byte deletion');
    equal(archived.truth.storageSpaceReclaimed,false,'result denies storage-space reclamation');
    equal(archived.truth.durableArchivalAuthorizationRecordProvided,true,'result confirms durable authorization record');
    equal(archived.truth.publisherTerminatedOrAbandonedProven,false,'result denies publisher-state proof');
    equal(archived.truth.falseAssertionCanInterruptLivePublication,true,'result discloses false-assertion live-publication risk');
    equal(archived.truth.livePublisherSafetyProven,false,'result denies live-publisher safety');
    equal(Object.prototype.hasOwnProperty.call(archived,'reason'),false,'v3 result omits raw reason property');
    equal(archived.reasonDigest,Lease.publicationArchivalReasonDigest(request.reason),'v3 result commits to exact raw reason bytes');
    equal(archived.reasonRedactionApplied,true,'v3 result reports applied redaction');
    check(!JSON.stringify(archived).includes(fixtureCredential),'v3 result excludes recognized credential value');
    check(!JSON.stringify(archived).includes(fixtureMachinePath),'v3 result excludes machine path');
    equal(archived.truth.exactRawReasonReturned,false,'result truth denies exact raw reason return');
    equal(archived.truth.arbitrarySecretAbsenceProven,false,'result truth denies arbitrary secret absence proof');
    equal(archived.truth.commandLineHistorySanitized,false,'result truth excludes shell history from its claim');
    equal(archived.truth.browserRoute,false,'result denies browser route');
    equal(archived.truth.apiRoute,false,'result denies API route');
    equal(archived.truth.canonAuthorized,false,'result grants no CANON authority');

    const redundant = publicationCrash(path.join(root,'redundant'),'intent','post'), redundantFinal = fs.readFileSync(redundant.targetPath), redundantStage = fs.readFileSync(redundant.stagePath);
    equal(redundant.plan.targetState,'EXACT_MATCH','post-publication stage matches authoritative bytes');
    equal(redundant.plan.reasonCode,'EXACT_REDUNDANT_STAGE_REQUIRES_ARCHIVAL_ASSERTION','redundant stage has exact reason');
    const redundantRequest = archivalInput(redundant.plan);
    const redundantResult = redundant.lease.archiveRetirementPublicationStage(redundantRequest);
    equal(redundantResult.state,'ARCHIVED','redundant exact stage is archived');
    const redundantIntent = JSON.parse(fs.readFileSync(redundant.intentPath,'utf8'));
    equal(redundantIntent.reasonRedacted,'<REASON_WITHHELD>','unchanged free-form reason is withheld instead of persisted raw');
    equal(redundantResult.reasonRedacted,'<REASON_WITHHELD>','unchanged free-form reason is withheld from result JSON');
    check(!fs.readFileSync(redundant.intentPath,'utf8').includes(redundantRequest.reason),'durable v2 intent excludes an otherwise unchanged raw reason');
    equal(fs.readFileSync(redundant.targetPath),redundantFinal,'redundant archival preserves authoritative bytes');
    equal(fs.readFileSync(redundant.archivePath),redundantStage,'redundant archival preserves archive bytes');

    for (const artifact of ['decision','result']) {
      const value = publicationCrash(path.join(root,'coverage-' + artifact),artifact,'pre'), bytes = fs.readFileSync(value.stagePath);
      equal(value.plan.truth.stageArtifactExact,true,artifact + ' stage is exact artifact-bound evidence');
      equal(value.lease.archiveRetirementPublicationStage(archivalInput(value.plan)).state,'ARCHIVED',artifact + ' stage archives');
      equal(fs.readFileSync(value.archivePath),bytes,artifact + ' archive preserves exact bytes');
      equal(value.lease.retirementPublicationArchivalAuthorizationStatus(value.stageFile).state,'AUTHORIZED',artifact + ' archive retains exact durable intent');
    }

    for (const artifact of ['intent','decision','result']) {
      for (const phase of ['pre-intent-link','post-intent-link']) {
        const value = publicationCrash(path.join(root,'intent-publication-crash-' + artifact + '-' + phase),artifact,'pre');
        const child = childProcess.spawnSync(process.execPath,[__filename,'--archive-crash-child',value.lease.stateRoot,value.stageFile,value.plan.stageDigest,phase],{ encoding:'utf8',windowsHide:true });
        equal(child.status,phase === 'pre-intent-link' ? 84 : 85,artifact + ' ' + phase + ' exits at exact durable-intent publication checkpoint');
        const interrupted = value.lease.retirementPublicationArchivalAuthorizationStatus(value.stageFile);
        equal(interrupted.state,phase === 'pre-intent-link' ? 'AUTHORIZATION_REQUIRED' : 'AUTHORIZED',artifact + ' ' + phase + ' leaves exact authorization state');
        equal(interrupted.residualIntentStages,1,artifact + ' ' + phase + ' exposes one non-authoritative exact intent stage');
        equal(interrupted.truth.residualIntentPublicationStagesAuthoritative,false,artifact + ' ' + phase + ' does not promote the residual intent stage');
        equal(fs.existsSync(value.stagePath),true,artifact + ' ' + phase + ' leaves active retirement publication stage untouched');
        equal(fs.existsSync(value.archivePath),false,artifact + ' ' + phase + ' performs no archive mutation');
        const recovered = value.lease.archiveRetirementPublicationStage(archivalInput(value.lease.retirementPublicationStagePlan(value.stageFile)));
        equal(recovered.state,'ARCHIVED',artifact + ' ' + phase + ' exact retry archives after durable intent convergence');
        equal(recovered.truth.durableArchivalAuthorizationRecordProvided,true,artifact + ' ' + phase + ' retry result confirms durable intent');
        equal(value.lease.retirementPublicationArchivalAuthorizationStatus(value.stageFile).state,'AUTHORIZED',artifact + ' ' + phase + ' retry retains exact intent');
      }
    }

    const conflictingIntent = publicationCrash(path.join(root,'conflicting-intent-request'),'intent','pre');
    const conflictingChild = childProcess.spawnSync(process.execPath,[__filename,'--archive-crash-child',conflictingIntent.lease.stateRoot,conflictingIntent.stageFile,conflictingIntent.plan.stageDigest,'post-intent-link'],{ encoding:'utf8',windowsHide:true });
    equal(conflictingChild.status,85,'conflicting request fixture stops after exact durable intent publication');
    const firstRequest = archivalInput(conflictingIntent.lease.retirementPublicationStagePlan(conflictingIntent.stageFile));
    const changedRequest = { ...firstRequest,reason:firstRequest.reason + ' Changed request must not overwrite the append-only intent.' };
    const conflictError = refused(() => conflictingIntent.lease.archiveRetirementPublicationStage(changedRequest),'changed archival request cannot replace durable intent');
    equal(conflictError.retirementPublicationArchivalAuthorizationStatus.state,'AUTHORIZED','conflicting request exposes the existing exact authorization');
    equal(fs.existsSync(conflictingIntent.stagePath),true,'conflicting request preserves active stage');
    equal(fs.existsSync(conflictingIntent.archivePath),false,'conflicting request performs no archive mutation');

    const corruptIntent = publicationCrash(path.join(root,'corrupt-intent'),'intent','pre');
    fs.mkdirSync(corruptIntent.lease.retirementPublicationArchivalIntentDirectory,{ recursive:true });
    fs.writeFileSync(corruptIntent.intentPath,'{}\n','utf8');
    const corruptAuthorization = corruptIntent.lease.retirementPublicationArchivalAuthorizationStatus(corruptIntent.stageFile);
    equal(corruptAuthorization.state,'HELD','corrupt authoritative intent holds archival');
    equal(corruptAuthorization.intentState,'INVALID','corrupt authoritative intent is typed invalid');
    refused(() => corruptIntent.lease.archiveRetirementPublicationStage(archivalInput(corruptIntent.plan)),'corrupt authoritative intent cannot authorize archival');
    equal(fs.existsSync(corruptIntent.stagePath),true,'corrupt intent preserves active stage');

    const corruptRequestDigest = publicationCrash(path.join(root,'corrupt-intent-request-digest'),'result','pre');
    const corruptDigestChild = childProcess.spawnSync(process.execPath,[__filename,'--archive-crash-child',corruptRequestDigest.lease.stateRoot,corruptRequestDigest.stageFile,corruptRequestDigest.plan.stageDigest,'post-intent-link'],{ encoding:'utf8',windowsHide:true });
    equal(corruptDigestChild.status,85,'request-digest corruption fixture publishes intent before stopping');
    const changedIntent = JSON.parse(fs.readFileSync(corruptRequestDigest.intentPath,'utf8'));
    changedIntent.requestDigest = 'sha256:' + '0'.repeat(64);
    fs.writeFileSync(corruptRequestDigest.intentPath,JSON.stringify(changedIntent,null,2) + '\n','utf8');
    equal(corruptRequestDigest.lease.retirementPublicationArchivalAuthorizationStatus(corruptRequestDigest.stageFile).intentState,'INVALID','self-inconsistent request digest invalidates intent');
    refused(() => corruptRequestDigest.lease.archiveRetirementPublicationStage(archivalInput(corruptRequestDigest.plan)),'self-inconsistent request digest cannot authorize archival');
    equal(fs.existsSync(corruptRequestDigest.stagePath),true,'request-digest corruption preserves active stage');

    const corruptReasonDigest = publicationCrash(path.join(root,'corrupt-intent-reason-digest'),'decision','pre');
    const corruptReasonDigestChild = childProcess.spawnSync(process.execPath,[__filename,'--archive-crash-child',corruptReasonDigest.lease.stateRoot,corruptReasonDigest.stageFile,corruptReasonDigest.plan.stageDigest,'post-intent-link'],{ encoding:'utf8',windowsHide:true });
    equal(corruptReasonDigestChild.status,85,'reason-digest corruption fixture publishes intent before stopping');
    const changedReasonDigestIntent = JSON.parse(fs.readFileSync(corruptReasonDigest.intentPath,'utf8'));
    changedReasonDigestIntent.reasonDigest = 'sha256:' + '0'.repeat(64);
    fs.writeFileSync(corruptReasonDigest.intentPath,JSON.stringify(changedReasonDigestIntent,null,2) + '\n','utf8');
    equal(corruptReasonDigest.lease.retirementPublicationArchivalAuthorizationStatus(corruptReasonDigest.stageFile).intentState,'INVALID','reason digest inconsistent with request digest invalidates intent');
    refused(() => corruptReasonDigest.lease.archiveRetirementPublicationStage(archivalInput(corruptReasonDigest.plan)),'corrupt reason digest cannot authorize archival');

    const corruptReasonSummary = publicationCrash(path.join(root,'corrupt-intent-reason-summary'),'result','pre');
    const corruptReasonSummaryChild = childProcess.spawnSync(process.execPath,[__filename,'--archive-crash-child',corruptReasonSummary.lease.stateRoot,corruptReasonSummary.stageFile,corruptReasonSummary.plan.stageDigest,'post-intent-link'],{ encoding:'utf8',windowsHide:true });
    equal(corruptReasonSummaryChild.status,85,'reason-summary corruption fixture publishes intent before stopping');
    const changedReasonSummaryIntent = JSON.parse(fs.readFileSync(corruptReasonSummary.intentPath,'utf8'));
    changedReasonSummaryIntent.reasonRedacted = 'Fixture OPENAI_API_KEY=' + ['unredacted','fixture','credential'].join('-') + ' must remain held.';
    fs.writeFileSync(corruptReasonSummary.intentPath,JSON.stringify(changedReasonSummaryIntent,null,2) + '\n','utf8');
    equal(corruptReasonSummary.lease.retirementPublicationArchivalAuthorizationStatus(corruptReasonSummary.stageFile).intentState,'INVALID','non-idempotent redacted summary invalidates intent');
    refused(() => corruptReasonSummary.lease.archiveRetirementPublicationStage(archivalInput(corruptReasonSummary.plan)),'unredacted summary cannot authorize archival');

    const invalidIntentStage = publicationCrash(path.join(root,'invalid-intent-stage'),'decision','pre');
    fs.mkdirSync(invalidIntentStage.lease.retirementPublicationArchivalIntentStagingDirectory,{ recursive:true });
    const invalidIntentStageName = invalidIntentStage.stageFile + '.archival-intent.json.' + crypto.randomUUID() + '.stage';
    fs.writeFileSync(path.join(invalidIntentStage.lease.retirementPublicationArchivalIntentStagingDirectory,invalidIntentStageName),'{}\n','utf8');
    const invalidResidualStatus = invalidIntentStage.lease.retirementPublicationArchivalAuthorizationStatus(invalidIntentStage.stageFile);
    equal(invalidResidualStatus.state,'AUTHORIZATION_REQUIRED','invalid non-authoritative intent stage grants no authorization');
    equal(invalidResidualStatus.invalidIntentStages,1,'invalid non-authoritative intent stage is visible');
    equal(invalidIntentStage.lease.archiveRetirementPublicationStage(archivalInput(invalidIntentStage.plan)).state,'ARCHIVED','invalid residual cannot impersonate intent or block a new exact intent');
    equal(invalidIntentStage.lease.retirementPublicationArchivalAuthorizationStatus(invalidIntentStage.stageFile).state,'AUTHORIZED','new exact intent becomes authoritative beside invalid residual');

    const legacyRawIntent = publicationCrash(path.join(root,'legacy-v1-raw-intent'),'intent','pre');
    const legacyRawIntentChild = childProcess.spawnSync(process.execPath,[__filename,'--archive-crash-child',legacyRawIntent.lease.stateRoot,legacyRawIntent.stageFile,legacyRawIntent.plan.stageDigest,'post-intent-link'],{ encoding:'utf8',windowsHide:true });
    equal(legacyRawIntentChild.status,85,'legacy v1 compatibility fixture first publishes exact v2 intent');
    const legacyRawRequest = archivalInput(legacyRawIntent.lease.retirementPublicationStagePlan(legacyRawIntent.stageFile));
    const currentIntent = JSON.parse(fs.readFileSync(legacyRawIntent.intentPath,'utf8'));
    const v1Truth = { ...currentIntent.truth };
    for (const key of ['exactReasonDigestRequired','exactRawReasonPersisted','recognizedCredentialRedactionPolicyApplied','machinePathRedactionPolicyApplied','arbitrarySecretAbsenceProven','commandLineHistorySanitized']) delete v1Truth[key];
    const v1Intent = { ...currentIntent, schema:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1, reason:legacyRawRequest.reason, requestDigest:Lease.publicationArchivalRequestDigestV1(legacyRawRequest), truth:v1Truth };
    delete v1Intent.reasonDigest;
    delete v1Intent.reasonRedacted;
    delete v1Intent.reasonRedactionApplied;
    fs.writeFileSync(legacyRawIntent.intentPath,JSON.stringify(v1Intent,null,2) + '\n','utf8');
    const legacyRawBytes = fs.readFileSync(legacyRawIntent.intentPath);
    equal(Lease.validPublicationArchivalIntent(v1Intent,Object.assign({ stageFile:legacyRawIntent.stageFile },Lease.publicationStageIdentity(legacyRawIntent.stageFile))),true,'legacy v1 raw-reason intent remains exact-valid');
    exactKeys(v1Intent,legacyIntentSchema,'legacy v1 intent still matches unchanged schema');
    const legacyRawStatus = legacyRawIntent.lease.retirementPublicationArchivalAuthorizationStatus(legacyRawIntent.stageFile);
    equal(legacyRawStatus.state,'LEGACY_AUTHORIZED_RAW_REASON','legacy v1 intent is authorized but explicitly typed raw-reason');
    equal(legacyRawStatus.intentSchema,Lease.RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1,'legacy authorization status exposes v1 schema');
    equal(legacyRawStatus.exactRawReasonPersisted,true,'legacy authorization status discloses exact raw reason persistence');
    equal(legacyRawStatus.reasonDigest,null,'legacy authorization status invents no reason digest');
    equal(legacyRawStatus.truth.legacyRawReasonRecord,true,'legacy authorization truth types raw-reason record');
    equal(legacyRawStatus.truth.exactRawReasonPersisted,true,'legacy authorization truth discloses exact raw reason persistence');
    const legacyRawResult = legacyRawIntent.lease.archiveRetirementPublicationStage(legacyRawRequest);
    equal(legacyRawResult.state,'ARCHIVED','exact retry of legacy v1 intent remains operational');
    equal(fs.readFileSync(legacyRawIntent.intentPath),legacyRawBytes,'legacy v1 intent is not rewritten or migrated');
    equal(Object.prototype.hasOwnProperty.call(legacyRawResult,'reason'),false,'legacy retry returns privacy-minimized v3 result');

    const legacy = publicationCrash(path.join(root,'legacy-archive'),'result','pre'), legacyBytes = fs.readFileSync(legacy.stagePath);
    fs.mkdirSync(legacy.lease.retirementPublicationArchiveDirectory,{ recursive:true });
    fs.linkSync(legacy.stagePath,legacy.archivePath);
    fs.unlinkSync(legacy.stagePath);
    const legacyPlan = legacy.lease.retirementPublicationStagePlan(legacy.stageFile);
    equal(legacyPlan.state,'ALREADY_ARCHIVED','legacy v5.1 fixture has exact archive and no active stage');
    const legacyAuthorization = legacy.lease.retirementPublicationArchivalAuthorizationStatus(legacy.stageFile);
    equal(legacyAuthorization.state,'LEGACY_ARCHIVE_AUTHORIZATION_UNKNOWN','legacy archive is explicitly authorization-unknown');
    const legacyResult = legacy.lease.archiveRetirementPublicationStage(archivalInput(legacyPlan));
    equal(legacyResult.state,'LEGACY_ALREADY_ARCHIVED_AUTHORIZATION_UNKNOWN','legacy observation does not invent post-hoc intent');
    equal(legacyResult.truth.durableArchivalAuthorizationRecordProvided,false,'legacy observation denies durable authorization');
    equal(fs.existsSync(legacy.intentPath),false,'legacy observation creates no retrospective intent');
    equal(fs.readFileSync(legacy.archivePath),legacyBytes,'legacy observation preserves exact archive bytes');

    const legacyCheckpoint = publicationCrash(path.join(root,'legacy-archive-checkpoint'),'decision','pre'), legacyCheckpointBytes = fs.readFileSync(legacyCheckpoint.stagePath);
    fs.mkdirSync(legacyCheckpoint.lease.retirementPublicationArchiveDirectory,{ recursive:true });
    fs.linkSync(legacyCheckpoint.stagePath,legacyCheckpoint.archivePath);
    const legacyCheckpointPlan = legacyCheckpoint.lease.retirementPublicationStagePlan(legacyCheckpoint.stageFile);
    equal(legacyCheckpointPlan.state,'ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK','legacy v5.1 checkpoint has exact archive and active stage');
    const legacyCheckpointAuthorization = legacyCheckpoint.lease.retirementPublicationArchivalAuthorizationStatus(legacyCheckpoint.stageFile);
    equal(legacyCheckpointAuthorization.state,'LEGACY_ARCHIVE_AUTHORIZATION_UNKNOWN','legacy archive checkpoint is explicitly authorization-unknown');
    equal(legacyCheckpointAuthorization.reasonCode,'ARCHIVE_CHECKPOINT_EXISTS_WITHOUT_DURABLE_ARCHIVAL_INTENT','legacy archive checkpoint has exact authorization reason');
    const legacyCheckpointError = refused(() => legacyCheckpoint.lease.archiveRetirementPublicationStage(archivalInput(legacyCheckpointPlan)),'legacy archive checkpoint cannot receive retrospective intent or stage unlink');
    equal(legacyCheckpointError.retirementPublicationArchivalAuthorizationStatus.state,'LEGACY_ARCHIVE_AUTHORIZATION_UNKNOWN','legacy archive checkpoint refusal exposes authorization-unknown status');
    equal(fs.existsSync(legacyCheckpoint.intentPath),false,'legacy archive checkpoint creates no retrospective intent');
    equal(fs.readFileSync(legacyCheckpoint.stagePath),legacyCheckpointBytes,'legacy archive checkpoint preserves active stage bytes');
    equal(fs.readFileSync(legacyCheckpoint.archivePath),legacyCheckpointBytes,'legacy archive checkpoint preserves archive bytes');

    const intentLimit = publicationCrash(path.join(root,'intent-stage-limit'),'intent','pre');
    fs.mkdirSync(intentLimit.lease.retirementPublicationArchivalIntentStagingDirectory,{ recursive:true });
    for (let index = 0; index < Lease.MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES + 1; index += 1) {
      const name = intentLimit.stageFile + '.archival-intent.json.' + crypto.randomUUID() + '.stage';
      fs.writeFileSync(path.join(intentLimit.lease.retirementPublicationArchivalIntentStagingDirectory,name),'{}\n','utf8');
    }
    const limitedIntentStatus = intentLimit.lease.retirementPublicationArchivalAuthorizationStatus(intentLimit.stageFile);
    equal(limitedIntentStatus.state,'HELD','over-bound intent publication staging is held');
    equal(limitedIntentStatus.reasonCode,'ARCHIVAL_INTENT_STAGING_LIMIT_EXCEEDED','intent stage limit has exact reason');
    equal(limitedIntentStatus.intentStagesTruncated,true,'intent stage status discloses truncation');
    equal(limitedIntentStatus.invalidIntentStages,Lease.MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES + 1,'intent stage status reads only one entry beyond the bound');

    const invalidName = Lease.create({ stateRoot:path.join(root,'invalid-name') });
    equal(invalidName.retirementPublicationStagePlan('../escape.stage').state,'HELD','path traversal stage name is held');
    equal(invalidName.retirementPublicationStagePlan('../escape.stage').reasonCode,'PUBLICATION_STAGE_NAME_INVALID','invalid name has exact reason');
    const uppercaseName = crypto.randomUUID().toUpperCase() + '.intent.json.' + crypto.randomUUID() + '.stage';
    equal(invalidName.retirementPublicationStagePlan(uppercaseName).reasonCode,'PUBLICATION_STAGE_NAME_INVALID','runtime refuses uppercase stage names outside the closed request schema');
    const invalidJson = Lease.create({ stateRoot:path.join(root,'invalid-json') }), invalidJsonName = crypto.randomUUID() + '.intent.json.' + crypto.randomUUID() + '.stage';
    fs.mkdirSync(invalidJson.retirementPublicationDirectory,{ recursive:true });
    fs.writeFileSync(path.join(invalidJson.retirementPublicationDirectory,invalidJsonName),'{}\n','utf8');
    const invalidJsonPlan = invalidJson.retirementPublicationStagePlan(invalidJsonName);
    equal(invalidJsonPlan.state,'HELD','invalid staged JSON is held');
    equal(invalidJsonPlan.reasonCode,'PUBLICATION_STAGE_ARTIFACT_INVALID','invalid staged JSON has exact reason');
    refused(() => invalidJson.archiveRetirementPublicationStage({ ...archivalInput({ ...invalidJsonPlan,stageDigest:'sha256:' + '0'.repeat(64) }),stageFile:invalidJsonName }),'invalid staged artifact cannot archive');
    equal(fs.existsSync(path.join(invalidJson.retirementPublicationDirectory,invalidJsonName)),true,'invalid stage stays preserved');

    const targetConflict = publicationCrash(path.join(root,'target-conflict'),'intent','pre'), conflictBytes = Buffer.from('conflicting authoritative bytes\n');
    fs.writeFileSync(targetConflict.targetPath,conflictBytes,{ flag:'wx' });
    const targetConflictPlan = targetConflict.lease.retirementPublicationStagePlan(targetConflict.stageFile);
    equal(targetConflictPlan.state,'HELD','conflicting authoritative target holds archival');
    equal(targetConflictPlan.reasonCode,'AUTHORITATIVE_PUBLICATION_TARGET_CONFLICT','target conflict has exact reason');
    refused(() => targetConflict.lease.archiveRetirementPublicationStage({ ...archivalInput(targetConflictPlan),confirmation:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + targetConflict.stageFile + ' ' + targetConflictPlan.stageDigest }),'target conflict refuses archival');
    equal(fs.readFileSync(targetConflict.targetPath),conflictBytes,'target conflict bytes stay unchanged');
    equal(fs.existsSync(targetConflict.stagePath),true,'target conflict preserves stage');

    const targetInvalid = publicationCrash(path.join(root,'target-invalid'),'intent','pre');
    fs.mkdirSync(targetInvalid.targetPath);
    equal(targetInvalid.lease.retirementPublicationStagePlan(targetInvalid.stageFile).reasonCode,'AUTHORITATIVE_PUBLICATION_TARGET_EVIDENCE_HELD','invalid target kind holds archival');
    equal(fs.existsSync(targetInvalid.stagePath),true,'invalid target kind preserves stage');

    const archiveConflict = publicationCrash(path.join(root,'archive-conflict'),'intent','pre'), changed = JSON.parse(fs.readFileSync(archiveConflict.stagePath,'utf8'));
    changed.reason = changed.reason + ' Changed but still structurally valid.';
    fs.mkdirSync(archiveConflict.lease.retirementPublicationArchiveDirectory,{ recursive:true });
    fs.writeFileSync(archiveConflict.archivePath,JSON.stringify(changed,null,2) + '\n','utf8');
    const archiveConflictPlan = archiveConflict.lease.retirementPublicationStagePlan(archiveConflict.stageFile);
    equal(archiveConflictPlan.state,'HELD','conflicting valid archive holds archival');
    equal(archiveConflictPlan.reasonCode,'PUBLICATION_STAGE_ARCHIVE_CONFLICT','archive conflict has exact reason');
    equal(fs.existsSync(archiveConflict.stagePath),true,'archive conflict preserves stage');

    for (const artifact of ['intent','decision','result']) {
      for (const phase of ['pre-link','post-link','post-unlink']) {
        const value = publicationCrash(path.join(root,'crash-' + artifact + '-' + phase),artifact,'pre'), before = fs.readFileSync(value.stagePath);
        const child = childProcess.spawnSync(process.execPath,[__filename,'--archive-crash-child',value.lease.stateRoot,value.stageFile,value.plan.stageDigest,phase],{ encoding:'utf8', windowsHide:true });
        equal(child.status,{ 'pre-link':80,'post-link':81,'post-unlink':82 }[phase],artifact + ' ' + phase + ' child exits at exact archive checkpoint');
        const interruptedPlan = value.lease.retirementPublicationStagePlan(value.stageFile);
        equal(interruptedPlan.state,{ 'pre-link':'ARCHIVAL_REQUIRES_OPERATOR_ASSERTION','post-link':'ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK','post-unlink':'ALREADY_ARCHIVED' }[phase],artifact + ' ' + phase + ' leaves exact typed plan');
        const recovered = value.lease.archiveRetirementPublicationStage({ ...archivalInput(interruptedPlan),stageDigest:value.plan.stageDigest,confirmation:Lease.RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + value.stageFile + ' ' + value.plan.stageDigest });
        equal(recovered.state,{ 'pre-link':'ARCHIVED','post-link':'RECOVERED_ARCHIVE_CHECKPOINT','post-unlink':'ALREADY_ARCHIVED' }[phase],artifact + ' ' + phase + ' retry converges exactly');
        equal(recovered.truth.durableArchivalAuthorizationRecordProvided,true,artifact + ' ' + phase + ' retry remains intent-first');
        equal(fs.existsSync(value.stagePath),false,artifact + ' ' + phase + ' retry removes active stage path');
        equal(fs.readFileSync(value.archivePath),before,artifact + ' ' + phase + ' retry preserves exact bytes');
        equal(value.lease.retirementPublicationArchivalAuthorizationStatus(value.stageFile).state,'AUTHORIZED',artifact + ' ' + phase + ' retains exact durable intent');
      }
    }

    const reentrant = publicationCrash(path.join(root,'reentrant'),'intent','pre'), reentrantInput = archivalInput(reentrant.plan), originalLink = fs.linkSync;
    let inner = null, entered = false;
    try {
      fs.linkSync = (source,target) => {
        if (!entered && path.resolve(target) === path.resolve(reentrant.archivePath)) { entered = true; inner = capture(() => reentrant.lease.archiveRetirementPublicationStage(reentrantInput)); }
        return originalLink(source,target);
      };
      reentrant.outer = capture(() => reentrant.lease.archiveRetirementPublicationStage(reentrantInput));
    } finally { fs.linkSync = originalLink; }
    equal(entered,true,'reentrant callers meet at archive hard-link checkpoint');
    equal(inner.error,null,'inner archival caller succeeds');
    equal(reentrant.outer.error,null,'outer archival caller converges without raw error');
    check([inner.result.state,reentrant.outer.result.state].includes('ARCHIVED'),'one reentrant caller creates archive');
    equal(reentrant.lease.retirementPublicationStagePlan(reentrant.stageFile).state,'ALREADY_ARCHIVED','reentrant callers leave exact archived plan');
    equal(reentrant.lease.retirementPublicationArchivalAuthorizationStatus(reentrant.stageFile).state,'AUTHORIZED','reentrant callers retain one exact durable intent');

    const processRace = publicationCrash(path.join(root,'process-race'),'result','pre');
    const workers = await Promise.all([spawnWorker(processRace.lease.stateRoot,processRace.stageFile,processRace.plan.stageDigest,'first'),spawnWorker(processRace.lease.stateRoot,processRace.stageFile,processRace.plan.stageDigest,'later')]);
    workers.forEach((worker,index) => {
      equal(worker.code,0,'archive worker ' + index + ' exits zero');
      equal(worker.stderr,'','archive worker ' + index + ' emits no raw stderr');
    });
    const workerResults = workers.map(worker => JSON.parse(worker.stdout.trim()));
    check(workerResults.every(item => item.ok && item.entered),'both real archive workers reach checkpoint and succeed');
    check(workerResults.some(item => item.state === 'ARCHIVED'),'one real archive worker creates archive');
    equal(processRace.lease.retirementPublicationStagePlan(processRace.stageFile).state,'ALREADY_ARCHIVED','real process race leaves exact archived plan');
    equal(processRace.lease.retirementPublicationArchivalAuthorizationStatus(processRace.stageFile).state,'AUTHORIZED','real process race retains exact durable intent');

    const bounded = publicationCrash(path.join(root,'bounded'),'intent','pre'), boundedBytes = fs.readFileSync(bounded.stagePath), boundedIdentity = Lease.publicationStageIdentity(bounded.stageFile);
    for (let index = 0; index < Lease.MAX_RETIREMENT_PUBLICATION_RECORDS; index += 1) {
      const name = boundedIdentity.targetFile + '.' + crypto.randomUUID() + '.stage';
      fs.writeFileSync(path.join(bounded.lease.retirementPublicationDirectory,name),boundedBytes,{ flag:'wx' });
    }
    equal(bounded.lease.retirementPublicationStatus().state,'HELD','201 exact stage artifacts exceed bounded status');
    equal(bounded.lease.archiveRetirementPublicationStage(archivalInput(bounded.lease.retirementPublicationStagePlan(bounded.stageFile))).state,'ARCHIVED','direct exact plan can archive one stage while aggregate status is held');
    equal(bounded.lease.retirementPublicationStatus().state,'STAGED','archiving one of 201 stages restores bounded status visibility');
    equal(bounded.lease.retirementPublicationStatus().stagedCandidates,200,'restored bounded status reports remaining 200 stages');

    const cliFixture = publicationCrash(path.join(root,'cli'),'decision','pre');
    const cliPlanResult = cli(['publication-stage-plan','--state-root',cliFixture.lease.stateRoot,'--stage-file',cliFixture.stageFile]);
    equal(cliPlanResult.status,0,'CLI publication-stage-plan succeeds');
    const cliPlan = JSON.parse(cliPlanResult.stdout).result;
    equal(cliPlan.stageDigest,cliFixture.plan.stageDigest,'CLI plan exposes exact digest');
    const cliAuthorizationRequired = cli(['publication-stage-authorization-status','--state-root',cliFixture.lease.stateRoot,'--stage-file',cliFixture.stageFile]);
    equal(cliAuthorizationRequired.status,0,'CLI publication-stage-authorization-status succeeds before archival');
    equal(JSON.parse(cliAuthorizationRequired.stdout).result.state,'AUTHORIZATION_REQUIRED','CLI exposes missing durable intent');
    const cliRequest = archivalInput(cliPlan);
    cliRequest.reason = 'CLI fixture OPENAI_API_KEY="' + fixtureCredential + '" at ' + fixtureMachinePath + ' remains held for exact inspection.';
    const wrongCli = cli(['archive-publication-stage','--state-root',cliFixture.lease.stateRoot,'--stage-file',cliRequest.stageFile,'--stage-digest',cliRequest.stageDigest,'--assertion',cliRequest.assertion,'--confirmation','wrong','--reason',cliRequest.reason]);
    equal(wrongCli.status,1,'CLI refuses wrong archival confirmation');
    equal(JSON.parse(wrongCli.stderr).code,'REVIEW_OPERATION_RETIREMENT_PUBLICATION_ARCHIVAL_REFUSED','CLI refusal is typed');
    const exactCli = cli(['archive-publication-stage','--state-root',cliFixture.lease.stateRoot,'--stage-file',cliRequest.stageFile,'--stage-digest',cliRequest.stageDigest,'--assertion',cliRequest.assertion,'--confirmation',cliRequest.confirmation,'--reason',cliRequest.reason]);
    equal(exactCli.status,0,'CLI exact archival succeeds');
    const exactCliResult = JSON.parse(exactCli.stdout).result;
    equal(exactCliResult.state,'ARCHIVED','CLI returns typed archival result');
    equal(Object.prototype.hasOwnProperty.call(exactCliResult,'reason'),false,'CLI result omits raw reason property');
    check(!exactCli.stdout.includes(fixtureCredential),'CLI JSON excludes recognized credential value');
    check(!exactCli.stdout.includes(fixtureMachinePath),'CLI JSON excludes machine path');
    check(exactCliResult.reasonRedacted.includes('<REDACTED_CREDENTIAL>'),'CLI JSON exposes credential-redaction marker');
    check(exactCliResult.reasonRedacted.includes('<ABSOLUTE_PATH>'),'CLI JSON exposes path-redaction marker');
    const cliAuthorized = cli(['publication-stage-authorization-status','--state-root',cliFixture.lease.stateRoot,'--stage-file',cliFixture.stageFile]);
    equal(cliAuthorized.status,0,'CLI authorization status succeeds after archival');
    equal(JSON.parse(cliAuthorized.stdout).result.state,'AUTHORIZED','CLI exposes exact durable intent after archival');

    const leaseSource = fs.readFileSync(path.join(__dirname,'review-operation-lease.js'),'utf8');
    const apiSource = fs.readFileSync(path.join(__dirname,'operations-api.js'),'utf8');
    const appSource = fs.readFileSync(path.join(__dirname,'../../tools/review-inbox/app.js'),'utf8');
    check(!/Date\.now\(\).{0,100}(archive|unlink)|process\.kill|kill\s*\(/i.test(leaseSource),'archival uses no age or process-kill inference');
    check(!apiSource.includes('archiveRetirementPublicationStage') && !/publication.{0,30}archive/i.test(apiSource),'operations API exposes no archival route');
    check(!appSource.includes('archiveRetirementPublicationStage') && !/publication.{0,30}archive/i.test(appSource),'browser UI exposes no archival control');
    check(!apiSource.includes('retirementPublicationArchivalAuthorizationStatus'),'operations API exposes no archival authorization status route');
    check(!appSource.includes('retirementPublicationArchivalAuthorizationStatus'),'browser UI exposes no archival authorization status control');

    console.log('Review operation lease retirement publication stage archival selftest: PASS (' + assertions + ' assertions, v2 reason privacy and exact digest commitment, v1 raw-reason compatibility, exact stage/target/request intent binding, fifteen crash-matrix checkpoints plus adversarial crash fixtures, two real caller convergence, legacy honesty, lossless archive, no arbitrary-secret-absence/shell-history/authentication/deletion/API/browser claim)');
  } finally { fs.rmSync(root,{ recursive:true, force:true }); }
}

if (process.argv[2] !== '--archive-worker') main().catch(error => { console.error(error); process.exitCode = 1; });
