#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const Core = require('./cognitive-resource-core');
const Service = require('./cognitive-resource-service');
const Workflows = require('./cognitive-resource-workflows');

let pass = 0;
function ok(name) { pass += 1; console.log('PASS cognitive resource · ' + name); }
function check(name, fn) { fn(); ok(name); }
function refuses(name, fn, pattern) {
  assert.throws(fn, pattern || /refused|required|changed|missing|mismatch|invalid|unavailable|unbound|collision/i);
  ok(name);
}
function digest(label) { return Core.digest('fixture:' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function options(root) { return { root, stateRoot:path.join(root,'state'), exportRoot:path.join(root,'exports') }; }

function observation(overrides) {
  const draft = {
    schema:Core.OBSERVATION_DRAFT_SCHEMA,
    source:{sourceSystemId:'openai.codex.goal-tracker',sourceRecordId:'goal-run-001',sourceRecordDigest:digest('goal-run-001'),collectionMethod:'DIRECT_MACHINE_METER',authorshipState:'DECLARED_NOT_CERTIFIED',measurementDefinitionDigest:digest('goal-meter-definition')},
    objective:{objectiveKind:'SOFTWARE_BUILD',objectiveDigest:digest('objective'),startingStateDigest:digest('start'),endingStateDigest:digest('end')},
    workShape:{operationKinds:['BUILD'],domainKinds:['SOFTWARE'],requestedOutputKinds:['WORKSHOP_MODULE'],riskTier:'MEDIUM',requiredVerificationKinds:['SELFTEST']},
    execution:{
      modelProfileDigest:digest('model-profile'),toolchainDigest:digest('toolchain-profile'),environmentDigest:digest('environment-profile'),hardwareProfileDigest:digest('hardware-profile'),
      tokenMeter:{definitionId:'axm.workshop.codex-goal-total-tokens/v1',coverage:'COMPLETE',inputTokens:40,cachedInputTokens:10,outputTokens:30,reasoningTokens:20,totalTokens:100},
      computeMeter:{definitionId:'axm.workshop.local-process-time/v1',coverage:'COMPLETE',cpuCoreMilliseconds:1200,acceleratorMilliseconds:null,peakMemoryBytes:4096,providerComputeUnitsMicros:null},
      timing:{wallMilliseconds:900,toolMilliseconds:400},
      workCounts:{filesExamined:7,filesChanged:3,linesAdded:120,linesRemoved:9,toolCalls:14},
      verification:{testsExecuted:3,testsPassed:3,testsFailed:0,testsNotRun:0,verificationDigest:digest('verification')}
    },
    outcome:{state:'VERIFIED_COMPLETE',status:'TEST',preexistingImplementationState:'PARTIAL'},
    costObservation:{basis:'UNKNOWN',profileDigest:null,currency:null,moneyMicros:null,energyMilliwattHours:null,carbonMilligrams:null},
    permission:{status:'ALLOWED',basisDigest:digest('permission')}
  };
  return Object.assign(draft, overrides || {});
}

function economics(mode, overrides) {
  const modes = {
    PROVIDER_TOKEN_BILLING:{
      scope:{accountingMode:'PROVIDER_TOKEN_BILLING',currency:'USD',modelProfileDigest:digest('model-profile'),hardwareProfileDigest:null,tokenMeterDefinitionId:'axm.workshop.codex-goal-total-tokens/v1',computeMeterDefinitionId:null},
      components:[{metric:'TOTAL_TOKENS',quantityDenominator:1000000,moneyMicrosPerQuantity:2500000,energyMilliwattHoursPerQuantity:null,carbonMilligramsPerQuantity:null}]
    },
    PROVIDER_COMPUTE_UNIT_BILLING:{
      scope:{accountingMode:'PROVIDER_COMPUTE_UNIT_BILLING',currency:'USD',modelProfileDigest:digest('model-profile'),hardwareProfileDigest:null,tokenMeterDefinitionId:null,computeMeterDefinitionId:'provider.compute-unit/v1'},
      components:[{metric:'PROVIDER_COMPUTE_UNITS_MICROS',quantityDenominator:1000000,moneyMicrosPerQuantity:4000000,energyMilliwattHoursPerQuantity:null,carbonMilligramsPerQuantity:null}]
    },
    LOCAL_HARDWARE_TIME:{
      scope:{accountingMode:'LOCAL_HARDWARE_TIME',currency:'EUR',modelProfileDigest:null,hardwareProfileDigest:digest('hardware-profile'),tokenMeterDefinitionId:null,computeMeterDefinitionId:'axm.workshop.local-process-time/v1'},
      components:[{metric:'CPU_CORE_MILLISECONDS',quantityDenominator:3600000,moneyMicrosPerQuantity:150000,energyMilliwattHoursPerQuantity:22000,carbonMilligramsPerQuantity:8000}]
    }
  };
  const selected = copy(modes[mode]);
  const draft = {
    schema:Core.ECONOMICS_DRAFT_SCHEMA,
    source:{sourceSystemId:'declared-rate-source',sourceRecordId:'rate-'+mode.toLowerCase(),sourceRecordDigest:digest('source-'+mode),collectionMethod:'MANUAL_DECLARATION',authorshipState:'DECLARED_NOT_CERTIFIED',rateScheduleDigest:digest('schedule-'+mode),effectiveWindowId:'window-2026-07',freshnessState:'CURRENT_DECLARED_NOT_CERTIFIED'},
    scope:selected.scope,
    components:selected.components,
    permission:{status:'ALLOWED',basisDigest:digest('rate-permission')}
  };
  return Object.assign(draft, overrides || {});
}

function profile(kind, recordId) {
  const attributes = {
    MODEL:{providerDeclarationId:'provider-declaration',modelId:'model-id',modelVersion:'declared-version',contextWindowTokens:128000,capabilities:['TEXT']},
    TOOLCHAIN:{toolIds:['node'],runtimeVersions:['node-24']},
    ENVIRONMENT:{osFamily:'windows',osVersion:'declared',architecture:'x64',containerized:false,runtimeVersions:['node-24']},
    HARDWARE:{cpuArchitecture:'x64',cpuModelClass:'declared-class',cpuLogicalCores:8,memoryBytes:17179869184,acceleratorClass:null,acceleratorCount:0},
    TOKEN_METER_DEFINITION:{definitionId:'axm.workshop.codex-goal-total-tokens/v1',coverageMeaning:'provider-total-only',observedFields:['totalTokens'],universalComputeClaim:false},
    COMPUTE_METER_DEFINITION:{definitionId:'axm.workshop.local-process-time/v1',unitKind:'direct-process-time',observedFields:['cpuCoreMilliseconds'],universalFlopsClaim:false}
  };
  return {schema:Core.PROFILE_SEAL_SCHEMA,kind,source:{sourceSystemId:'axm.workshop.profile-sealer',sourceRecordId:recordId || 'profile-001',sourceRecordDigest:digest(recordId || 'profile-001'),collectionMethod:'MANUAL_DECLARATION',authorshipState:'DECLARED_NOT_CERTIFIED'},attributes:attributes[kind],permission:{status:'ALLOWED',basisDigest:digest('profile-permission')}};
}

function goalReceipt(recordId) {
  return {schema:Workflows.GOAL_RECEIPT_SCHEMA,goalRunId:recordId||'imported-goal-001',objectiveDigest:digest('imported-objective'),startingStateDigest:null,endingStateDigest:null,workShape:{operationKinds:['BUILD'],domainKinds:['SOFTWARE'],requestedOutputKinds:['WORKSHOP_MODULE'],riskTier:'MEDIUM',requiredVerificationKinds:['SELFTEST']},profiles:{modelProfileDigest:null,toolchainDigest:null,environmentDigest:null,hardwareProfileDigest:null},totalTokens:329000,timing:{wallMilliseconds:1200000,toolMilliseconds:null},workCounts:{filesExamined:null,filesChanged:null,linesAdded:null,linesRemoved:null,toolCalls:null},verification:{testsExecuted:4,testsPassed:4,testsFailed:0,testsNotRun:null,verificationDigest:null},outcome:{state:'VERIFIED_PARTIAL',status:'TEST',preexistingImplementationState:'UNKNOWN'},permission:{status:'ALLOWED',basisDigest:digest('goal-import-permission')}};
}

function worker(file, data) {
  return new Promise((resolve, reject) => {
    const instance = new Worker(file, { workerData:data });
    instance.once('message', resolve);
    instance.once('error', reject);
    instance.once('exit', code => { if (code !== 0) reject(new Error('worker exited ' + code)); });
  });
}

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-cognitive-resource-'));
  try {
    const ledger = Service.create(options(temp));
    const bindings = ledger.validateContractBindings();
    check('copied Mirror contracts retain exact schema identities and SHA-256 bindings', () => {
      assert.deepStrictEqual(bindings.map(item => item.sha256), ['74a135eca16239f502d73ecbee296ae49fa8a09316cae4437188b923c500286d','fa66b93360b0a43da9ac35bd6b128d2c62e9e341d06a4f1fad9c15f31f073ef3']);
      assert(bindings.every(item => item.pass));
    });
    check('catalog keeps required provider IDs unique and explicit while allowing additive providers', () => {
      const catalog=Service.validateCatalog(),required=['codex-goal-completion-receipt/v1','local-hardware-process-meter/v1','declared-provider-compute-meter/v1','codex-goal-receipt-explicit-import/v1','workshop-server-process-window-meter/v1'],ids=Service.CATALOG.providers.map(item=>item.id);
      assert(required.every(id=>ids.includes(id)));assert.strictEqual(new Set(ids).size,ids.length);assert(Service.CATALOG.providers.every(item=>item.automaticCapture===false));assert(catalog.providers>=required.length);assert.strictEqual(catalog.hands,8);assert(catalog.meterDefinitions>=3);assert.strictEqual(catalog.zeroAutomaticAuthority,true);assert.strictEqual(catalog.zeroAutomaticCapture,true);
    });
    check('Workshop Command Center catalog is additive, unique, nonautomatic, and authority-free', () => {
      const required=['cognitive-stack-status','cognitive-goal-import','cognitive-local-meter-start','cognitive-local-meter-stop','cognitive-evidence-bundle','cognitive-explorer-open','cognitive-calibration-capture','human-attention-capture','sustainability-capture','mirror-intake-import','workshop-direction-open','workshop-direction-status','workshop-direction-preview','workshop-direction-commit','workshop-direction-lifecycle'];
      const controls=Service.CONTROL_CATALOG.controls,ids=controls.map(item=>item.id),status=ledger.status();
      assert(required.every(id=>ids.includes(id)));assert.strictEqual(new Set(ids).size,ids.length);assert(controls.length>=required.length);assert(controls.every(item=>item.automatic===false));assert(Object.values(Service.CONTROL_CATALOG.authority).every(value=>value===false));assert.strictEqual(Service.CONTROL_CATALOG.presentationOwner,'workshop-command-center');assert.deepStrictEqual(status.commandCenterControls,Service.CONTROL_CATALOG);
    });
    check('privacy-safe Codex goal receipt adapts into the exact observation contract', () => { const draft=Workflows.observationFromGoalReceipt(goalReceipt(),Service.CATALOG); assert.strictEqual(draft.source.collectionMethod,'IMPORTED_ATTESTATION'); assert.strictEqual(draft.execution.tokenMeter.totalTokens,329000); assert.strictEqual(draft.execution.tokenMeter.definitionId,'axm.workshop.codex-goal-total-tokens/v1'); });
    refuses('goal receipt import refuses hidden prompt fields', () => { const value=goalReceipt();value.prompt='private';Workflows.normalizeGoalReceipt(value); }, /privacy boundary refused/);
    const importedGoal=ledger.importGoalReceipt({receipt:goalReceipt(),supersedesId:null});
    check('explicit goal receipt import archives through the provider-bound goal Hand', () => { assert.strictEqual(importedGoal.hand.id,'goal-run-receipt-capture-hand');assert.strictEqual(importedGoal.artifact.source.sourceRecordId,'imported-goal-001'); });
    check('goal preview explains incomplete evidence without persisting or auto-repairing', () => { const before=ledger.list().length,value=ledger.previewGoalReceipt(goalReceipt('preview-goal'));assert.strictEqual(value.persisted,false);assert(value.explanation.issues.some(item=>item.code==='MODEL_PROFILE_DIGEST_MISSING'));assert.strictEqual(value.explanation.automaticRepair,false);assert.strictEqual(ledger.list().length,before); });
    check('exact observation schema normalizes to the same top-level contract', () => {
      assert.deepStrictEqual(Object.keys(Core.normalizeObservationDraft(observation())), ['costObservation','execution','objective','outcome','permission','schema','source','workShape']);
    });
    check('all three separated economics modes normalize independently', () => {
      for (const mode of ['PROVIDER_TOKEN_BILLING','PROVIDER_COMPUTE_UNIT_BILLING','LOCAL_HARDWARE_TIME']) assert.strictEqual(Core.normalizeEconomicsDraft(economics(mode)).scope.accountingMode, mode);
    });
    refuses('extra observation fields are refused', () => { const value=observation(); value.story='no'; Core.normalizeObservationDraft(value); }, /fields changed/);
    refuses('extra economics fields are refused', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.components[0].discount='silent'; Core.normalizeEconomicsDraft(value); }, /fields changed/);

    const original = observation();
    const captured = ledger.captureProviderRun({providerDeclarationId:'codex-goal-completion-receipt/v1',draft:original,supersedesId:null});
    original.objective.objectiveDigest = digest('mutated-after-capture');
    check('captured evidence is detached from later caller mutation', () => assert.strictEqual(ledger.get(captured.record.id).record.objective.objectiveDigest, digest('objective')));
    check('complete machine-bound receipt reaches independent-intake readiness without calculation', () => {
      assert.strictEqual(captured.assessment.state, 'READY_FOR_MIRROR_INDEPENDENT_INTAKE'); assert.strictEqual(captured.truth.calculationPerformed, false);
    });
    refuses('same source record cannot drift to changed content', () => { const value=observation(); value.execution.timing.wallMilliseconds=901; ledger.captureObservation(value); }, /source record content drift refused/);
    refuses('same source record cannot drift to a new source digest', () => { const value=observation(); value.source.sourceRecordDigest=digest('different-source-bytes'); ledger.captureObservation(value); }, /source record digest drift refused/);

    const firstRate = ledger.captureEconomicsProfile(economics('PROVIDER_TOKEN_BILLING'), {supersedesId:null});
    check('provider billing schedule capture identifies its typed Hand', () => assert.strictEqual(firstRate.hand.id,'billing-rate-schedule-capture-hand'));
    refuses('rate schedule content cannot silently refresh in place', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.source.rateScheduleDigest=digest('silent-refresh'); ledger.captureEconomicsProfile(value,{supersedesId:null}); }, /content drift refused/);
    const replacementRateDraft = economics('PROVIDER_TOKEN_BILLING'); replacementRateDraft.source.sourceRecordId='rate-provider-token-billing-v2'; replacementRateDraft.source.sourceRecordDigest=digest('source-token-v2'); replacementRateDraft.source.rateScheduleDigest=digest('schedule-token-v2'); replacementRateDraft.source.freshnessState='HISTORICAL';
    const replacementRate = ledger.captureEconomicsProfile(replacementRateDraft,{supersedesId:firstRate.record.id});
    check('append-and-supersede preserves rate lineage and historical freshness', () => { assert.strictEqual(ledger.list().find(item=>item.id===firstRate.record.id).state,'SUPERSEDED'); assert.strictEqual(replacementRate.artifact.source.freshnessState,'HISTORICAL'); });
    check('unknown freshness remains UNKNOWN rather than certified', () => { const value=economics('LOCAL_HARDWARE_TIME'); value.source.freshnessState='UNKNOWN'; assert.strictEqual(Core.economicsAssessment(value).normalized.source.freshnessState,'UNKNOWN'); });

    const beforeHold = ledger.list().length, held=observation(); held.permission={status:'UNKNOWN',basisDigest:null};
    const holdResult=ledger.captureObservation(held);
    check('permission hold validates but archives no private record', () => { assert.strictEqual(holdResult.state,'HOLD_PERMISSION_NOT_ARCHIVED'); assert.strictEqual(holdResult.record,null); assert.strictEqual(ledger.list().length,beforeHold); });
    refuses('ALLOWED permission requires an explicit basis digest', () => { const value=observation(); value.permission.basisDigest=null; Core.normalizeObservationDraft(value); }, /requires a basis digest/);

    const currencyObservation=observation(); currencyObservation.costObservation={basis:'PROFILE_ESTIMATED',profileDigest:digest('cost-profile'),currency:'EUR',moneyMicros:1,energyMilliwattHours:null,carbonMilligrams:null};
    check('currency mismatch is reported and no calculation is performed', () => { const result=Core.compatibility(currencyObservation,economics('PROVIDER_TOKEN_BILLING')); assert(result.issues.includes('CURRENCY_MISMATCH')); assert.strictEqual(result.calculationPerformed,false); });
    check('missing model, hardware, and meter bindings hold the correct modes', () => {
      const token=economics('PROVIDER_TOKEN_BILLING'); token.scope.modelProfileDigest=null; token.scope.tokenMeterDefinitionId=null;
      const hardware=economics('LOCAL_HARDWARE_TIME'); hardware.scope.hardwareProfileDigest=null; hardware.scope.computeMeterDefinitionId=null;
      const compute=economics('PROVIDER_COMPUTE_UNIT_BILLING'); compute.scope.modelProfileDigest=null; compute.scope.computeMeterDefinitionId=null;
      assert.deepStrictEqual(Core.economicsAssessment(token).issues.filter(x=>/MISSING/.test(x)),['MODEL_PROFILE_DIGEST_MISSING','TOKEN_METER_DEFINITION_ID_MISSING']);
      assert.deepStrictEqual(Core.economicsAssessment(hardware).issues.filter(x=>/MISSING/.test(x)),['COMPUTE_METER_DEFINITION_ID_MISSING','HARDWARE_PROFILE_DIGEST_MISSING']);
      assert.deepStrictEqual(Core.economicsAssessment(compute).issues.filter(x=>/MISSING/.test(x)),['COMPUTE_METER_DEFINITION_ID_MISSING','MODEL_PROFILE_DIGEST_MISSING']);
    });
    refuses('TOTAL_TOKENS cannot coexist with token-component rates', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.components.push({metric:'INPUT_TOKENS',quantityDenominator:1000000,moneyMicrosPerQuantity:1,energyMilliwattHoursPerQuantity:null,carbonMilligramsPerQuantity:null}); Core.normalizeEconomicsDraft(value); }, /cannot be combined/);
    refuses('token metrics cannot enter local hardware accounting', () => { const value=economics('LOCAL_HARDWARE_TIME'); value.components[0].metric='INPUT_TOKENS'; Core.normalizeEconomicsDraft(value); }, /non-hardware-time metric/);
    refuses('hardware time cannot enter provider token billing', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.components[0].metric='CPU_CORE_MILLISECONDS'; Core.normalizeEconomicsDraft(value); }, /non-token metric/);
    refuses('provider units cannot be relabelled as local hardware time', () => { const value=economics('LOCAL_HARDWARE_TIME'); value.components[0].metric='PROVIDER_COMPUTE_UNITS_MICROS'; Core.normalizeEconomicsDraft(value); }, /non-hardware-time metric/);

    const partial=observation(); partial.execution.tokenMeter={definitionId:'axm.workshop.codex-goal-total-tokens/v1',coverage:'PARTIAL',inputTokens:null,cachedInputTokens:null,outputTokens:null,reasoningTokens:null,totalTokens:null};
    check('partial meters and unavailable quantities remain explicit compatibility holds', () => { const result=Core.compatibility(partial,economics('PROVIDER_TOKEN_BILLING')); assert(result.issues.includes('TOKEN_METER_NOT_COMPLETE')); assert(result.issues.includes('RESOURCE_METRIC_UNAVAILABLE_TOTAL_TOKENS')); });
    refuses('UNKNOWN meters cannot carry inferred quantities', () => { const value=observation(); value.execution.computeMeter.coverage='UNKNOWN'; value.execution.computeMeter.definitionId=null; value.execution.computeMeter.cpuCoreMilliseconds=1; Core.normalizeObservationDraft(value); }, /cannot carry inferred/);
    refuses('components without money, energy, or carbon rates are refused', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.components[0].moneyMicrosPerQuantity=null; Core.normalizeEconomicsDraft(value); }, /requires at least one declared rate/);
    check('zero and maximum-safe-integer rates are preserved exactly', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.components[0].moneyMicrosPerQuantity=0; value.components[0].energyMilliwattHoursPerQuantity=Number.MAX_SAFE_INTEGER; const item=Core.normalizeEconomicsDraft(value).components[0]; assert.strictEqual(item.moneyMicrosPerQuantity,0); assert.strictEqual(item.energyMilliwattHoursPerQuantity,Number.MAX_SAFE_INTEGER); });
    refuses('rates above the maximum safe integer are refused', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.components[0].moneyMicrosPerQuantity=Number.MAX_SAFE_INTEGER+1; Core.normalizeEconomicsDraft(value); }, /safe integer/);
    check('rounding boundaries are retained as evidence and never calculated', () => { const value=economics('PROVIDER_TOKEN_BILLING'); value.components[0].quantityDenominator=3; value.components[0].moneyMicrosPerQuantity=1; const normalized=Core.economicsAssessment(value); assert.strictEqual(normalized.normalized.components[0].quantityDenominator,3); assert.strictEqual(normalized.normalized.components[0].moneyMicrosPerQuantity,1); assert.strictEqual(normalized.automaticSelection,false); });
    check('money, energy, and carbon rates stay in distinct fields', () => { const value=economics('LOCAL_HARDWARE_TIME'); const item=Core.normalizeEconomicsDraft(value).components[0]; assert.deepStrictEqual([item.moneyMicrosPerQuantity,item.energyMilliwattHoursPerQuantity,item.carbonMilligramsPerQuantity],[150000,22000,8000]); });
    const localRate=ledger.captureEconomicsProfile(economics('LOCAL_HARDWARE_TIME'),{supersedesId:null});
    check('local hardware rates execute the distinct local-hardware Hand', () => assert.strictEqual(localRate.hand.id,'local-hardware-rate-profile-hand'));

    refuses('prompts are excluded from every capture shape', () => { const value=observation(); value.source.prompt='private'; Core.normalizeObservationDraft(value); }, /privacy boundary refused/);
    refuses('identities are excluded from nested profile attributes', () => { const value=profile('HARDWARE','unsafe-profile'); value.attributes.userIdentity='private'; Core.normalizeProfileSeal(value); }, /privacy boundary refused/);
    refuses('secrets are excluded from direct telemetry', () => ledger.captureComputeTelemetry({schema:Service.COMPUTE_TELEMETRY_SCHEMA,providerDeclarationId:'local-hardware-process-meter/v1',sourceSystemId:'axm.workshop.local-hardware-meter',sourceRecordId:'telemetry-1',sourceRecordDigest:digest('telemetry-1'),computeMeter:observation().execution.computeMeter,permission:{status:'ALLOWED',basisDigest:digest('telemetry-permission')},secret:'x'}), /privacy boundary refused/);
    refuses('universal token-to-compute profile claims are refused', () => { const value=profile('TOKEN_METER_DEFINITION','universal-token'); value.attributes.universalComputeClaim=true; Core.normalizeProfileSeal(value); }, /universal compute or FLOP claim refused/);
    const sealed=ledger.sealProfile(profile('HARDWARE','hardware-seal'));
    check('privacy-safe hardware profile seals to content-addressed cold detail', () => { assert.strictEqual(sealed.state,'ARCHIVED_PRIVATE_EVIDENCE'); assert.strictEqual(ledger.get(sealed.record.id).record.kind,'HARDWARE'); });
    const telemetry=ledger.captureComputeTelemetry({schema:Service.COMPUTE_TELEMETRY_SCHEMA,providerDeclarationId:'local-hardware-process-meter/v1',sourceSystemId:'axm.workshop.local-hardware-meter',sourceRecordId:'telemetry-2',sourceRecordDigest:digest('telemetry-2'),computeMeter:observation().execution.computeMeter,permission:{status:'ALLOWED',basisDigest:digest('telemetry-permission')}});
    check('direct compute telemetry preserves provider units without FLOP relabelling', () => { assert.strictEqual(telemetry.state,'ARCHIVED_PRIVATE_EVIDENCE'); assert.strictEqual(telemetry.artifact.computeMeter.definitionId,'axm.workshop.local-process-time/v1'); });
    refuses('unbound provider declarations hold instead of guessing identity', () => ledger.captureComputeTelemetry({schema:Service.COMPUTE_TELEMETRY_SCHEMA,providerDeclarationId:'declared-provider-compute-meter/v1',sourceSystemId:'guessed',sourceRecordId:'guess-1',sourceRecordDigest:digest('guess'),computeMeter:observation().execution.computeMeter,permission:{status:'ALLOWED',basisDigest:digest('telemetry-permission')}}), /remains unbound/);
    const meterStart=ledger.startLocalProcessMeter({objectiveDigest:digest('meter-window-objective'),permission:{status:'ALLOWED',basisDigest:digest('meter-window-permission')}});for(let i=0,total=0;i<20000;i++)total+=i;const meterStop=ledger.stopLocalProcessMeter({sessionId:meterStart.session.id});
    check('explicit local process window uses native counters and archives partial telemetry', () => { assert.strictEqual(meterStart.state,'MEASURING_EXPLICIT_WINDOW');assert.strictEqual(meterStop.state,'MEASURED_PARTIAL_PROCESS_WINDOW');assert.strictEqual(meterStop.telemetry.artifact.computeMeter.definitionId,'axm.workshop.server-process-window/v1');assert.strictEqual(meterStop.truth.taskIsolation,false);assert.strictEqual(ledger.status().counts.activeLocalMeters,0); });
    check('local process permission hold starts no measurement session', () => { const held=ledger.startLocalProcessMeter({objectiveDigest:digest('held-meter'),permission:{status:'UNKNOWN',basisDigest:null}});assert.strictEqual(held.state,'HOLD_PERMISSION_NOT_STARTED');assert.strictEqual(ledger.status().counts.activeLocalMeters,0); });

    refuses('record path traversal is refused', () => ledger.get('../../outside'), /invalid/);
    const symlinkRoot=fs.mkdtempSync(path.join(os.tmpdir(),'axm-cognitive-symlink-')), symlinkLedger=Service.create(options(symlinkRoot));
    const symlinkTarget=path.join(symlinkRoot,'junction-target'); fs.mkdirSync(symlinkTarget); fs.writeFileSync(path.join(symlinkTarget,'record.json'),'{}');
    fs.symlinkSync(symlinkTarget,path.join(symlinkLedger.coldDir,'evil-record'),process.platform==='win32'?'junction':'dir');
    refuses('symlinked cold-record directories are refused', () => symlinkLedger.get('evil-record'), /symlink/);
    fs.rmSync(symlinkRoot,{recursive:true,force:true});

    const tamperFile=path.join(ledger.coldDir,captured.record.id,'record.json'), pristine=fs.readFileSync(tamperFile,'utf8'), wrapper=JSON.parse(pristine);
    wrapper.record.execution.timing.wallMilliseconds=999999; fs.writeFileSync(tamperFile,JSON.stringify(wrapper));
    refuses('cold-detail tampering is detected before use', () => ledger.get(captured.record.id), /tampered/);
    fs.writeFileSync(tamperFile,pristine);
    const collisionRoot=fs.mkdtempSync(path.join(os.tmpdir(),'axm-cognitive-collision-')), collision=Service.create(Object.assign(options(collisionRoot),{addressDigest:()=> 'a'.repeat(64)}));
    collision.sealProfile(profile('HARDWARE','collision-one'));
    refuses('divergent content-address collisions are refused', () => collision.sealProfile(profile('HARDWARE','collision-two')), /divergent content-address collision refused/);
    fs.rmSync(collisionRoot,{recursive:true,force:true});

    const concurrencyRoot=fs.mkdtempSync(path.join(os.tmpdir(),'axm-cognitive-concurrent-')), concurrencyOptions=options(concurrencyRoot), concurrencyDraft=observation(); concurrencyDraft.source.sourceRecordId='concurrent-record'; concurrencyDraft.source.sourceRecordDigest=digest('concurrent-record');
    const workerFile=path.join(__dirname,'concurrent-worker.js'), concurrent=await Promise.all([worker(workerFile,{options:concurrencyOptions,draft:concurrencyDraft}),worker(workerFile,{options:concurrencyOptions,draft:concurrencyDraft})]);
    check('concurrent identical append converges on one immutable record', () => { assert(concurrent.every(item=>item.ok)); assert.strictEqual(new Set(concurrent.map(item=>item.recordId)).size,1); const concurrentLedger=Service.create(concurrencyOptions); assert.strictEqual(concurrentLedger.list().length,1); assert.strictEqual(fs.readFileSync(concurrentLedger.eventsFile,'utf8').trim().split(/\r?\n/).length,2); });
    fs.rmSync(concurrencyRoot,{recursive:true,force:true});

    check('archive and rollback execute the archive Hand as explicit recoverable index transitions', () => { const archived=ledger.archive(captured.record.id,'ARCHIVE COGNITIVE RECORD'); assert.strictEqual(archived.hand.id,'cognitive-ledger-archive-hand'); assert.strictEqual(archived.transition.state,'ARCHIVED'); assert.strictEqual(ledger.restore(captured.record.id,'RESTORE COGNITIVE RECORD').transition.state,'ACTIVE'); assert.strictEqual(ledger.get(captured.record.id).recordDigest,captured.record.digest); });
    refuses('archive without exact confirmation is refused', () => ledger.archive(captured.record.id,'yes'), /exact cognitive ledger confirmation/);
    const exportReceipt=ledger.exportRecord(captured.record.id,'EXPORT EXACT COGNITIVE DRAFT');
    check('exact observation export executes its Hand, reproduces JSON, and performs no Mirror write', () => { const exported=JSON.parse(fs.readFileSync(path.join(temp,exportReceipt.file),'utf8')); assert.deepStrictEqual(exported,ledger.get(captured.record.id).record); assert.strictEqual(exportReceipt.hand.id,'mirror-observation-draft-export-hand'); assert.strictEqual(exportReceipt.mirrorWrite,false); assert.strictEqual(exportReceipt.calculationPerformed,false); });
    const economicsExport=ledger.exportRecord(replacementRate.record.id,'EXPORT EXACT COGNITIVE DRAFT');
    check('exact economics export executes its separate typed Hand', () => assert.strictEqual(economicsExport.hand.id,'mirror-economics-profile-draft-export-hand'));
    refuses('profile seals cannot be mislabeled as Mirror draft exports', () => ledger.exportRecord(sealed.record.id,'EXPORT EXACT COGNITIVE DRAFT'), /only exact Mirror draft/);
    check('profile and rate vaults expose typed immutable records without refreshing rates', () => { const value=ledger.vaults();assert(value.profiles.some(item=>item.recordId===sealed.record.id));assert(value.rateSchedules.some(item=>item.recordId===replacementRate.record.id));assert.strictEqual(value.automaticRefresh,false); });
    check('resource timeline keeps observations rates and dimensions separate with no composite', () => { const value=ledger.resourceTimeline();assert(value.observations.length>=2);assert(value.rates.length>=2);assert(value.dimensions.includes('CARBON'));assert.strictEqual(value.compositeScore,false);assert.strictEqual(value.calculationPerformed,false); });
    const bundle=ledger.exportBundle({recordIds:[captured.record.id,replacementRate.record.id,sealed.record.id],confirmation:'EXPORT COGNITIVE EVIDENCE BUNDLE'});
    check('portable evidence bundle is a dependency-free ZIP with exact record count', () => { const file=path.join(temp,bundle.file),bytes=fs.readFileSync(file);assert.strictEqual(bytes.readUInt32LE(0),0x04034b50);assert.strictEqual(bundle.records,3);assert.deepStrictEqual(bundle.requiredThirdPartyDependencies,[]);assert(/^[a-f0-9]{64}$/.test(bundle.sha256)); });
    refuses('evidence bundle requires exact confirmation', () => ledger.exportBundle({recordIds:[captured.record.id],confirmation:'yes'}), /exact cognitive evidence bundle confirmation/);

    check('module requires no third-party runtime and exposes zero automatic authority', () => {
      const status=ledger.status(), files=['cognitive-resource-core.js','cognitive-resource-service.js','concurrent-worker.js','selftest.js'];
      assert.deepStrictEqual(status.requiredThirdPartyDependencies,[]); assert.strictEqual(status.networkPriceRefresh,false);
      assert(Object.values(status.authority).every(value=>value===false)); assert(status.hands.every(hand=>hand.automaticAuthority===false));
      const source=files.map(file=>fs.readFileSync(path.join(__dirname,file),'utf8')).join('\n');
      for (const match of source.matchAll(/require\(['\"]([^'\"]+)['\"]\)/g)) assert(match[1].startsWith('.') || ['assert','crypto','fs','os','path','worker_threads'].includes(match[1]), 'third-party require: '+match[1]);
    });
    check('runtime evidence exercises all eight declared Hands', () => {
      const observed=new Set([captured.hand.id,telemetry.hand.id,sealed.hand.id,firstRate.hand.id,localRate.hand.id,exportReceipt.hand.id,economicsExport.hand.id,'cognitive-ledger-archive-hand']);
      assert.deepStrictEqual([...observed].sort(),Service.CATALOG.hands.map(item=>item.id).sort());
    });
    check('claim ceiling remains TEST and excludes ranking, selection, budgets, training, CANON, and world action', () => { const status=ledger.status(); assert.strictEqual(status.claimCeiling,'TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER'); assert.deepStrictEqual(status.authority,{calculatesMirrorResult:false,certifiesExternalFreshness:false,convertsTokensToUniversalCompute:false,ranksCandidates:false,selectsModelHardwareProviderOrPlan:false,allocatesBudget:false,changesPermission:false,writesMirror:false,trains:false,promotesCanon:false,actsOnWorld:false}); });

    console.log('\n' + pass + ' PASS · 0 FAIL · cognitive resource focused adversarial suite');
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
}

main().catch(error => { console.error('FAIL cognitive resource · '+String(error && error.stack || error)); process.exitCode=1; });
