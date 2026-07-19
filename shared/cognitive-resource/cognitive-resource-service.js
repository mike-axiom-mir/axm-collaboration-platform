'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./cognitive-resource-core');
const Workflows = require('./cognitive-resource-workflows');
const U = require('../operations/operations-utils');

const CATALOG_FILE = path.join(__dirname, 'provider-declarations.json');
const CATALOG = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const CONTROL_CATALOG_FILE = path.join(__dirname, 'command-center-controls.json');
const CONTROL_CATALOG = JSON.parse(fs.readFileSync(CONTROL_CATALOG_FILE, 'utf8'));
const INDEX_SCHEMA = 'axm.cognitive-resource-ledger-index/v1';
const RECORD_SCHEMA = 'axm.cognitive-resource-ledger-record/v1';
const HAND_RESULT_SCHEMA = 'axm.cognitive-resource-hand-result/v1';
const COMPUTE_TELEMETRY_SCHEMA = 'axm.cognitive-resource.compute-telemetry/v1';
const RECORD_ID = /^[a-z0-9][a-z0-9-]{1,159}$/;
const KIND = {
  OBSERVATION_DRAFT: { prefix:'cognitive-work-observation-draft', handIds:['goal-run-receipt-capture-hand'], outputKind:'COGNITIVE_WORK_OBSERVATION_DRAFT', contractSchema:Core.OBSERVATION_DRAFT_SCHEMA },
  ECONOMICS_PROFILE_DRAFT: { prefix:'cognitive-resource-economics-profile-draft', handIds:['billing-rate-schedule-capture-hand','local-hardware-rate-profile-hand'], outputKind:'COGNITIVE_RESOURCE_ECONOMICS_PROFILE_DRAFT', contractSchema:Core.ECONOMICS_DRAFT_SCHEMA },
  MACHINE_PROFILE: { prefix:'cognitive-machine-profile', handIds:['machine-profile-sealing-hand'], outputKind:'PRIVACY_SAFE_MACHINE_PROFILE_DIGEST', contractSchema:Core.PROFILE_SEAL_SCHEMA },
  COMPUTE_TELEMETRY: { prefix:'cognitive-compute-telemetry', handIds:['provider-compute-telemetry-capture-hand'], outputKind:'PROVIDER_COMPUTE_TELEMETRY', contractSchema:COMPUTE_TELEMETRY_SCHEMA }
};

function sleep(milliseconds) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds); }
function now() { return new Date().toISOString(); }
function hand(id) { const found = CATALOG.hands.find(item => item.id === id); if (!found) throw new Error('cognitive resource Hand declaration not found'); return Core.clone(found); }
function provider(id) { const found = CATALOG.providers.find(item => item.id === id); if (!found) throw new Error('provider declaration not found'); return Core.clone(found); }
function binding(schemaId) { const found = CATALOG.contractBindings.find(item => item.schemaId === schemaId); return found ? Core.clone(found) : null; }

function validateCatalog() {
  Core.exactKeys(CATALOG, ['schema','version','status','contractBindings','meterDefinitions','providers','hands','authority'], 'cognitive resource provider catalog');
  if (CATALOG.schema !== 'axm.cognitive-resource-hand-provider-catalog/v1' || CATALOG.status !== 'TEST') throw new Error('cognitive resource provider catalog identity changed');
  if (!Array.isArray(CATALOG.contractBindings) || CATALOG.contractBindings.length !== 2) throw new Error('cognitive resource provider catalog requires two contract bindings');
  if (!Array.isArray(CATALOG.providers) || CATALOG.providers.length < 3) throw new Error('cognitive resource provider catalog requires explicit provider states');
  if (!Array.isArray(CATALOG.hands) || CATALOG.hands.length !== 8) throw new Error('cognitive resource provider catalog requires exactly eight Hands');
  for (const collection of ['contractBindings','meterDefinitions','providers','hands']) {
    const ids = CATALOG[collection].map(item => String(item.id || item.schemaId || ''));
    if (ids.some(item => !item) || new Set(ids).size !== ids.length) throw new Error('cognitive resource provider catalog contains an invalid or duplicate ' + collection + ' id');
  }
  if (CATALOG.hands.some(item => item.status !== 'TEST' || item.automaticAuthority !== false)) throw new Error('cognitive resource Hands must remain TEST with zero automatic authority');
  const requiredProviderIds = ['codex-goal-completion-receipt/v1','local-hardware-process-meter/v1','declared-provider-compute-meter/v1','codex-goal-receipt-explicit-import/v1','workshop-server-process-window-meter/v1'];
  if (requiredProviderIds.some(id => !CATALOG.providers.some(item => item.id === id))) throw new Error('cognitive resource provider catalog is missing a required provider declaration');
  if (CATALOG.providers.some(item => item.automaticCapture !== false)) throw new Error('cognitive resource providers must remain explicit and non-automatic');
  const authorityKeys = ['calculatesMirrorResult','certifiesExternalFreshness','convertsTokensToUniversalCompute','ranksCandidates','selectsModelHardwareProviderOrPlan','allocatesBudget','changesPermission','writesMirror','trains','promotesCanon','actsOnWorld'];
  Core.exactKeys(CATALOG.authority, authorityKeys, 'cognitive resource authority declaration');
  if (authorityKeys.some(key => CATALOG.authority[key] !== false)) throw new Error('cognitive resource authority must remain false');
  Core.exactKeys(CONTROL_CATALOG,['schema','version','status','presentationOwner','controls','authority'],'cognitive command-center control catalog');if(CONTROL_CATALOG.schema!=='axm.cognitive-resource.command-center-controls/v1'||CONTROL_CATALOG.status!=='TEST'||!Array.isArray(CONTROL_CATALOG.controls)||!CONTROL_CATALOG.controls.length)throw new Error('cognitive command-center control catalog identity changed');const controlIds=CONTROL_CATALOG.controls.map(item=>item.id);if(new Set(controlIds).size!==controlIds.length||CONTROL_CATALOG.controls.some(item=>item.automatic!==false))throw new Error('cognitive command-center controls must be unique and non-automatic');if(Object.values(CONTROL_CATALOG.authority).some(value=>value!==false))throw new Error('cognitive command-center authority must remain false');
  return { providers:CATALOG.providers.length, requiredProviderIds, hands:CATALOG.hands.length, meterDefinitions:CATALOG.meterDefinitions.length, controls:CONTROL_CATALOG.controls.length, zeroAutomaticAuthority:true, zeroAutomaticCapture:true };
}

function validateContractBindings() {
  validateCatalog();
  return CATALOG.contractBindings.map(item => {
    const file = U.resolveUnder(__dirname, item.path), actual = U.fileSha256(file);
    if (actual !== item.sha256) throw new Error('copied contract digest changed for ' + item.schemaId);
    const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (schema.$id !== item.schemaId || schema.additionalProperties !== false) throw new Error('copied contract identity or strictness changed for ' + item.schemaId);
    return { schemaId:item.schemaId, path:item.path, sha256:actual, outputKind:item.outputKind, pass:true };
  });
}

function create(options) {
  const root = path.resolve(options.root), stateDir = path.join(options.stateRoot, 'cognitive-resource-meter'), coldDir = path.join(stateDir, 'cold'), indexFile = path.join(stateDir, 'hot-index.json'), eventsFile = path.join(stateDir, 'events.jsonl'), lockFile = path.join(stateDir, '.ledger.lock'), exportDir = path.join(options.exportRoot, 'cognitive-resource-meter'), bundleDir=path.join(exportDir,'bundles'), addressDigest = options.addressDigest || Core.digest, processMeters=new Map();
  function realDirectory(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive:true });
    const stat = fs.lstatSync(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('cognitive resource ledger requires a real directory');
  }
  function ensureRoots() { realDirectory(stateDir); realDirectory(coldDir); realDirectory(exportDir); realDirectory(bundleDir); }
  function emptyIndex() { return { schema:INDEX_SCHEMA, version:1, updatedAt:null, records:[] }; }
  function readIndex() {
    const value = U.loadJson(indexFile, emptyIndex());
    Core.exactKeys(value,['schema','version','updatedAt','records'],'cognitive resource hot index');
    if (value.schema !== INDEX_SCHEMA || value.version !== 1 || !Array.isArray(value.records)) throw new Error('cognitive resource hot index changed');
    return value;
  }
  function acquireLock() {
    ensureRoots(); const started = Date.now();
    for (;;) {
      try { const fd = fs.openSync(lockFile,'wx'); fs.writeFileSync(fd, String(process.pid) + ' ' + now()); return fd; }
      catch (error) {
        if (!['EEXIST','EPERM'].includes(error.code)) throw error;
        try { const stat=fs.lstatSync(lockFile); if (stat.isSymbolicLink()) throw new Error('ledger lock symlink refused'); if (Date.now()-stat.mtimeMs>10000) fs.rmSync(lockFile,{force:true}); } catch (inspectError) { if (/symlink/.test(inspectError.message)) throw inspectError; }
        if (Date.now()-started>2500) throw new Error('cognitive resource ledger lock unavailable'); sleep(10);
      }
    }
  }
  function withLock(fn) { const fd=acquireLock(); try { return fn(); } finally { try{fs.closeSync(fd);}catch(_){} try{fs.rmSync(lockFile,{force:true});}catch(_){} } }
  function appendEvent(event) { U.appendJsonl(eventsFile, Object.assign({ schema:'axm.cognitive-resource-ledger-event/v1', at:now() }, event)); }
  function recordPath(recordId) { if (!RECORD_ID.test(String(recordId||''))) throw new Error('cognitive record id is invalid'); return U.resolveUnder(coldDir, recordId + '/record.json'); }
  function get(recordId) {
    const file=recordPath(recordId), dir=path.dirname(file); if(!fs.existsSync(file))throw new Error('cognitive record not found');
    for(const candidate of [dir,file]){const stat=fs.lstatSync(candidate);if(stat.isSymbolicLink()||(candidate===dir&&!stat.isDirectory())||(candidate===file&&!stat.isFile()))throw new Error('cognitive record symlink or type boundary refused');}
    const wrapper=JSON.parse(fs.readFileSync(file,'utf8')); Core.exactKeys(wrapper,['schema','recordId','recordDigest','contentDigest','kind','handId','outputKind','contractBinding','record'],'cognitive ledger record');
    if(wrapper.schema!==RECORD_SCHEMA||wrapper.recordId!==recordId||!KIND[wrapper.kind]||!KIND[wrapper.kind].handIds.includes(wrapper.handId))throw new Error('cognitive ledger record identity changed');
    if(Core.digest(wrapper.record)!==wrapper.contentDigest||wrapper.recordDigest!==wrapper.contentDigest)throw new Error('cognitive ledger record content was tampered');
    const expected=KIND[wrapper.kind], currentBinding=expected.contractSchema.startsWith('axm.mirror.')?binding(expected.contractSchema):null;
    if(currentBinding&&(!wrapper.contractBinding||wrapper.contractBinding.sha256!==currentBinding.sha256||wrapper.contractBinding.schemaId!==currentBinding.schemaId))throw new Error('cognitive ledger contract binding changed');
    return Core.clone(wrapper);
  }
  function handResult(state, kind, assessment, wrapper, reused, handId) {
    const definition=KIND[kind], declared=hand(handId || wrapper&&wrapper.handId || definition.handIds[0]);
    const publicAssessment=Object.assign({},assessment);delete publicAssessment.normalized;
    return { schema:HAND_RESULT_SCHEMA, state, hand:{id:declared.id,version:declared.version,status:declared.status}, outputKind:definition.outputKind, record:wrapper?{id:wrapper.recordId,digest:wrapper.recordDigest,contentDigest:wrapper.contentDigest,kind:wrapper.kind}:null, artifact:wrapper?Core.clone(wrapper.record):Core.clone(assessment.normalized), assessment:Core.clone(publicAssessment), contractBinding:wrapper?Core.clone(wrapper.contractBinding):(binding(definition.contractSchema)||null), reused:reused===true, truth:{evidenceProducerOnly:true,mirrorWrite:false,calculationPerformed:false,externalFreshnessCertified:false,universalTokenComputeConversion:false,ranking:false,selection:false,budgetAuthority:false,permissionChange:false,training:false,canon:false,worldAction:false} };
  }
  function commit(kind, record, assessment, metadata) {
    ensureRoots(); const definition=KIND[kind]; if(!definition)throw new Error('cognitive record kind refused');
    const contentDigest=Core.digest(record), address=String(addressDigest(record)); if(!/^[a-f0-9]{64}$/.test(address))throw new Error('content address function must return SHA-256 form');
    const recordId=definition.prefix+'-'+address.slice(0,24), dir=U.resolveUnder(coldDir,recordId), file=path.join(dir,'record.json'), contract=definition.contractSchema.startsWith('axm.mirror.')?binding(definition.contractSchema):null;
    const handId=metadata&&metadata.handId||definition.handIds[0];if(!definition.handIds.includes(handId))throw new Error('cognitive record Hand binding changed');
    const wrapper={schema:RECORD_SCHEMA,recordId,recordDigest:contentDigest,contentDigest,kind,handId,outputKind:definition.outputKind,contractBinding:contract,record:Core.clone(record)};
    let reused=false;
    if(fs.existsSync(dir)){const existing=get(recordId);if(!Core.same(existing,wrapper))throw new Error('divergent content-address collision refused');reused=true;}
    else {
      const stage=path.join(stateDir,'.stage-'+recordId+'-'+process.pid+'-'+Math.random().toString(16).slice(2)); fs.mkdirSync(stage,{recursive:false}); U.atomicJson(path.join(stage,'record.json'),wrapper);
      try{fs.renameSync(stage,dir);}catch(error){try{U.assertUnder(stage,stateDir);fs.rmSync(stage,{recursive:true,force:true});}catch(_){}if(!fs.existsSync(dir))throw error;const existing=get(recordId);if(!Core.same(existing,wrapper))throw new Error('divergent content-address collision refused');reused=true;}
    }
    withLock(()=>{const index=readIndex(),existing=index.records.find(item=>item.id===recordId),at=now();if(!existing){index.records.unshift({id:recordId,kind,digest:contentDigest,contentDigest,handId,outputKind:definition.outputKind,contractDigest:contract&&contract.sha256||null,state:'ACTIVE',createdAt:at,lastEventAt:at});index.records=index.records.slice(0,10000);}else if(existing.digest!==contentDigest||existing.kind!==kind)throw new Error('hot index content address collision refused');index.updatedAt=at;U.atomicJson(indexFile,index);appendEvent({type:reused?'REUSED_IDENTICAL':'APPENDED',recordId,digest:contentDigest,kind,handId,relation:metadata&&metadata.relation||null});});
    return handResult('ARCHIVED_PRIVATE_EVIDENCE',kind,assessment,wrapper,reused,handId);
  }
  function findSourceDrift(kind, record) {
    if(!record.source)return;const index=readIndex();for(const item of index.records.filter(entry=>entry.kind===kind)){const existing=get(item.id).record;if(!existing.source)continue;if(existing.source.sourceSystemId===record.source.sourceSystemId&&existing.source.sourceRecordId===record.source.sourceRecordId&&!Core.same(existing,record)){if(existing.source.sourceRecordDigest!==record.source.sourceRecordDigest)throw new Error('source record digest drift refused; append a new sourceRecordId with lineage');throw new Error('source record content drift refused; immutable sourceRecordId already exists');}}
  }
  function supersede(previousId,nextId,kind) {
    if(!previousId)return;const previous=get(previousId),next=get(nextId);if(previous.kind!==kind||next.kind!==kind)throw new Error('supersede requires the same cognitive record kind');if(previous.record.source&&next.record.source&&previous.record.source.sourceSystemId!==next.record.source.sourceSystemId)throw new Error('supersede source lineage changed');
    withLock(()=>{const index=readIndex(),item=index.records.find(entry=>entry.id===previousId);if(!item)throw new Error('superseded record is missing from hot index');item.state='SUPERSEDED';item.supersededBy=nextId;item.lastEventAt=now();index.updatedAt=item.lastEventAt;U.atomicJson(indexFile,index);appendEvent({type:'SUPERSEDED',recordId:previousId,digest:previous.recordDigest,kind,nextRecordId:nextId});});
  }
  function captureObservation(draft,input) { validateContractBindings();const assessment=Core.observationAssessment(draft);if(assessment.normalized.permission.status!=='ALLOWED')return handResult('HOLD_PERMISSION_NOT_ARCHIVED','OBSERVATION_DRAFT',assessment,null,false);findSourceDrift('OBSERVATION_DRAFT',assessment.normalized);const result=commit('OBSERVATION_DRAFT',assessment.normalized,assessment,{relation:input&&input.supersedesId||null});if(input&&input.supersedesId)supersede(input.supersedesId,result.record.id,'OBSERVATION_DRAFT');return result; }
  function captureProviderRun(input) { Core.exactKeys(input,['providerDeclarationId','draft','supersedesId'],'provider run capture');const declared=provider(input.providerDeclarationId);if(declared.status==='HOLD_UNBOUND_PROVIDER')throw new Error('provider declaration remains unbound');const normalized=Core.normalizeObservationDraft(input.draft);if(declared.sourceSystemId&&normalized.source.sourceSystemId!==declared.sourceSystemId)throw new Error('provider source binding mismatch');if(declared.tokenMeterDefinitionId&&normalized.execution.tokenMeter.definitionId!==declared.tokenMeterDefinitionId)throw new Error('provider token meter definition mismatch');if(declared.computeMeterDefinitionId&&normalized.execution.computeMeter.definitionId!==declared.computeMeterDefinitionId)throw new Error('provider compute meter definition mismatch');return captureObservation(normalized,{supersedesId:input.supersedesId}); }
  function importGoalReceipt(input) { Core.exactKeys(input,['receipt','supersedesId'],'goal receipt import');const draft=Workflows.observationFromGoalReceipt(input.receipt,CATALOG);return captureProviderRun({providerDeclarationId:'codex-goal-receipt-explicit-import/v1',draft,supersedesId:input.supersedesId}); }
  function captureComputeTelemetry(input) { Core.assertPrivacySafe(input);Core.exactKeys(input,['schema','providerDeclarationId','sourceSystemId','sourceRecordId','sourceRecordDigest','computeMeter','permission'],'provider compute telemetry');if(input.schema!==COMPUTE_TELEMETRY_SCHEMA)throw new Error('provider compute telemetry schema changed');const declared=provider(input.providerDeclarationId);if(declared.status==='HOLD_UNBOUND_PROVIDER')throw new Error('provider declaration remains unbound');const record=Core.stableValue({schema:COMPUTE_TELEMETRY_SCHEMA,providerDeclarationId:declared.id,sourceSystemId:Core.id(input.sourceSystemId,'sourceSystemId'),sourceRecordId:Core.id(input.sourceRecordId,'sourceRecordId'),sourceRecordDigest:Core.sha(input.sourceRecordDigest,'sourceRecordDigest',true),computeMeter:Core.normalizeComputeMeter(input.computeMeter),permission:Core.permission(input.permission,'compute telemetry permission')});if(declared.sourceSystemId&&record.sourceSystemId!==declared.sourceSystemId)throw new Error('provider source binding mismatch');if(declared.computeMeterDefinitionId&&record.computeMeter.definitionId!==declared.computeMeterDefinitionId)throw new Error('provider compute meter definition mismatch');const assessment={normalized:record,state:record.permission.status==='ALLOWED'?'READY_FOR_OBSERVATION_BINDING':'HOLD_PERMISSION',issues:record.permission.status==='ALLOWED'?[]:['INTAKE_PERMISSION_NOT_ALLOWED']};if(record.permission.status!=='ALLOWED')return handResult('HOLD_PERMISSION_NOT_ARCHIVED','COMPUTE_TELEMETRY',assessment,null,false);return commit('COMPUTE_TELEMETRY',record,assessment); }
  function captureEconomicsProfile(draft,input) { validateContractBindings();const assessment=Core.economicsAssessment(draft),handId=assessment.normalized.scope.accountingMode==='LOCAL_HARDWARE_TIME'?'local-hardware-rate-profile-hand':'billing-rate-schedule-capture-hand';if(assessment.normalized.permission.status!=='ALLOWED')return handResult('HOLD_PERMISSION_NOT_ARCHIVED','ECONOMICS_PROFILE_DRAFT',assessment,null,false,handId);findSourceDrift('ECONOMICS_PROFILE_DRAFT',assessment.normalized);const result=commit('ECONOMICS_PROFILE_DRAFT',assessment.normalized,assessment,{relation:input&&input.supersedesId||null,handId});if(input&&input.supersedesId)supersede(input.supersedesId,result.record.id,'ECONOMICS_PROFILE_DRAFT');return result; }
  function sealProfile(value) { const normalized=Core.normalizeProfileSeal(value),assessment={normalized,state:normalized.permission.status==='ALLOWED'?'SEALED_PRIVATE_PROFILE':'HOLD_PERMISSION',issues:normalized.permission.status==='ALLOWED'?[]:['INTAKE_PERMISSION_NOT_ALLOWED'],profileDigest:Core.digest(normalized)};if(normalized.permission.status!=='ALLOWED')return handResult('HOLD_PERMISSION_NOT_ARCHIVED','MACHINE_PROFILE',assessment,null,false);findSourceDrift('MACHINE_PROFILE',normalized);return commit('MACHINE_PROFILE',normalized,assessment); }
  function previewObservation(draft) { const assessment=Core.observationAssessment(draft);return {schema:'axm.cognitive-resource.observation-preview/v1',draft:assessment.normalized,assessment:Object.assign({},assessment,{normalized:undefined}),explanation:Workflows.explainAssessment(assessment),persisted:false}; }
  function previewGoalReceipt(receipt) { const draft=Workflows.observationFromGoalReceipt(receipt,CATALOG),preview=previewObservation(draft);return Object.assign(preview,{schema:'axm.cognitive-resource.goal-receipt-preview/v1',receipt:Workflows.normalizeGoalReceipt(receipt),persisted:false}); }
  function previewEconomics(draft) { const assessment=Core.economicsAssessment(draft);return {schema:'axm.cognitive-resource.economics-preview/v1',draft:assessment.normalized,assessment:Object.assign({},assessment,{normalized:undefined}),explanation:Workflows.explainAssessment(assessment),persisted:false,calculationPerformed:false}; }
  function startLocalProcessMeter(input) {
    Core.exactKeys(input,['objectiveDigest','permission'],'local process meter start');const permission=Core.permission(input.permission,'local process meter permission'),objectiveDigest=Core.sha(input.objectiveDigest,'objectiveDigest');
    if(permission.status!=='ALLOWED')return {schema:'axm.cognitive-resource.local-process-window/v1',state:'HOLD_PERMISSION_NOT_STARTED',session:null,permission};
    const sessionId=U.uid('process-window'),startedAt=now(),session={sessionId,objectiveDigest,permission,startedAt,startedHr:process.hrtime.bigint(),startedCpu:process.cpuUsage(),maxRssBytes:process.memoryUsage().rss,samples:1,timer:null};
    session.timer=setInterval(()=>{session.maxRssBytes=Math.max(session.maxRssBytes,process.memoryUsage().rss);session.samples+=1;},100);if(session.timer.unref)session.timer.unref();processMeters.set(sessionId,session);
    return {schema:'axm.cognitive-resource.local-process-window/v1',state:'MEASURING_EXPLICIT_WINDOW',session:{id:sessionId,startedAt,objectiveDigest},scope:'WHOLE_WORKSHOP_SERVER_PROCESS',acceleratorMeasured:false,automaticCapture:false};
  }
  function stopLocalProcessMeter(input) {
    Core.exactKeys(input,['sessionId'],'local process meter stop');const session=processMeters.get(String(input.sessionId||''));if(!session)throw new Error('local process meter session not found');clearInterval(session.timer);processMeters.delete(session.sessionId);session.maxRssBytes=Math.max(session.maxRssBytes,process.memoryUsage().rss);session.samples+=1;
    const elapsedNs=process.hrtime.bigint()-session.startedHr,cpu=process.cpuUsage(session.startedCpu),wallMilliseconds=Number(elapsedNs/1000000n),cpuCoreMilliseconds=Math.round((cpu.user+cpu.system)/1000),stoppedAt=now();
    const source={sessionId:session.sessionId,objectiveDigest:session.objectiveDigest,startedAt:session.startedAt,stoppedAt,wallMilliseconds,cpuCoreMilliseconds,peakMemoryBytes:session.maxRssBytes,samples:session.samples,scope:'WHOLE_WORKSHOP_SERVER_PROCESS'};
    const telemetry=captureComputeTelemetry({schema:COMPUTE_TELEMETRY_SCHEMA,providerDeclarationId:'workshop-server-process-window-meter/v1',sourceSystemId:'axm.workshop.server-process-window',sourceRecordId:session.sessionId,sourceRecordDigest:Core.digest(source),computeMeter:{definitionId:'axm.workshop.server-process-window/v1',coverage:'PARTIAL',cpuCoreMilliseconds,acceleratorMilliseconds:null,peakMemoryBytes:session.maxRssBytes,providerComputeUnitsMicros:null},permission:session.permission});
    return {schema:'axm.cognitive-resource.local-process-window-result/v1',state:'MEASURED_PARTIAL_PROCESS_WINDOW',source,telemetry,observationPatch:{computeMeter:telemetry.artifact.computeMeter,timing:{wallMilliseconds,toolMilliseconds:null}},truth:{wholeServerProcess:true,taskIsolation:false,acceleratorMeasured:false,peakMemorySampled:true,universalComputeClaim:false}};
  }
  function cancelLocalProcessMeter(input) { Core.exactKeys(input,['sessionId','confirmation'],'local process meter cancel');if(input.confirmation!=='CANCEL LOCAL PROCESS METER')throw new Error('exact local process meter cancellation confirmation is required');const session=processMeters.get(String(input.sessionId||''));if(!session)throw new Error('local process meter session not found');clearInterval(session.timer);processMeters.delete(session.sessionId);return {schema:'axm.cognitive-resource.local-process-window-cancel/v1',sessionId:session.sessionId,state:'CANCELLED_NOT_ARCHIVED'}; }
  function transition(recordId,state,confirmation) { const allowed={ARCHIVED:'ARCHIVE COGNITIVE RECORD',ACTIVE:'RESTORE COGNITIVE RECORD'};if(confirmation!==allowed[state])throw new Error('exact cognitive ledger confirmation is required');const wrapper=get(recordId);return withLock(()=>{const index=readIndex(),item=index.records.find(entry=>entry.id===recordId);if(!item)throw new Error('cognitive record is missing from hot index');item.state=state;item.lastEventAt=now();if(state==='ACTIVE')delete item.supersededBy;index.updatedAt=item.lastEventAt;U.atomicJson(indexFile,index);appendEvent({type:state==='ACTIVE'?'RESTORED':'ARCHIVED',recordId,digest:wrapper.recordDigest,kind:wrapper.kind,handId:'cognitive-ledger-archive-hand'});return {schema:'axm.cognitive-resource-archive-hand-receipt/v1',hand:hand('cognitive-ledger-archive-hand'),transition:Core.clone(item),record:{id:wrapper.recordId,digest:wrapper.recordDigest,kind:wrapper.kind},automaticAuthority:false};}); }
  function exportRecord(recordId,confirmation) { if(confirmation!=='EXPORT EXACT COGNITIVE DRAFT')throw new Error('exact cognitive draft export confirmation is required');validateContractBindings();const wrapper=get(recordId);if(!['OBSERVATION_DRAFT','ECONOMICS_PROFILE_DRAFT'].includes(wrapper.kind))throw new Error('only exact Mirror draft records may be exported');const handId=wrapper.kind==='OBSERVATION_DRAFT'?'mirror-observation-draft-export-hand':'mirror-economics-profile-draft-export-hand',file=path.join(exportDir,recordId+'.json'),bytes=JSON.stringify(wrapper.record,null,2)+'\n';if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==bytes)throw new Error('existing cognitive export content changed');fs.writeFileSync(file,bytes,'utf8');appendEvent({type:'EXPORTED_EXACT_DRAFT',recordId,digest:wrapper.recordDigest,kind:wrapper.kind,handId,path:path.relative(root,file).replace(/\\/g,'/')});return {schema:'axm.cognitive-resource-export-receipt/v1',hand:hand(handId),recordId,digest:wrapper.recordDigest,outputKind:wrapper.outputKind,file:path.relative(root,file).replace(/\\/g,'/'),url:'/'+path.relative(root,file).replace(/\\/g,'/').split('/').map(encodeURIComponent).join('/'),contractBinding:wrapper.contractBinding,mirrorWrite:false,calculationPerformed:false}; }
  function list() { ensureRoots();return readIndex().records.map(Core.clone); }
  function records(input) { const filter=Object.assign({kind:null,state:null,limit:500},input||{}),limit=Math.max(1,Math.min(2000,Number(filter.limit)||500));return list().filter(item=>(!filter.kind||item.kind===filter.kind)&&(!filter.state||item.state===filter.state)).slice(0,limit).map(item=>Object.assign(get(item.id),{indexState:item.state,createdAt:item.createdAt,lastEventAt:item.lastEventAt,supersededBy:item.supersededBy||null})); }
  function vaults() { const all=records({limit:2000});return {schema:'axm.cognitive-resource.vaults/v1',profiles:all.filter(item=>item.kind==='MACHINE_PROFILE'),rateSchedules:all.filter(item=>item.kind==='ECONOMICS_PROFILE_DRAFT'),meterReceipts:all.filter(item=>item.kind==='COMPUTE_TELEMETRY'),automaticRefresh:false}; }
  function resourceTimeline() { return Workflows.timeline(records({limit:2000})); }
  function exportBundle(input) {
    Core.exactKeys(input,['recordIds','confirmation'],'cognitive evidence bundle export');if(input.confirmation!=='EXPORT COGNITIVE EVIDENCE BUNDLE')throw new Error('exact cognitive evidence bundle confirmation is required');if(!Array.isArray(input.recordIds)||!input.recordIds.length||input.recordIds.length>200)throw new Error('cognitive evidence bundle requires one to 200 record ids');
    const ids=Array.from(new Set(input.recordIds.map(String)));if(ids.length!==input.recordIds.length)throw new Error('cognitive evidence bundle contains duplicate record ids');const wrappers=ids.map(get),bundleId=U.uid('cognitive-evidence-bundle'),stage=U.resolveUnder(stateDir,'.bundle-stage-'+bundleId),output=path.join(bundleDir,bundleId+'.zip');
    fs.mkdirSync(path.join(stage,'records'),{recursive:true});fs.mkdirSync(path.join(stage,'contracts'),{recursive:true});
    try {
      wrappers.forEach(wrapper=>U.atomicJson(path.join(stage,'records',wrapper.recordId+'.json'),wrapper));
      CATALOG.contractBindings.forEach(item=>fs.copyFileSync(U.resolveUnder(__dirname,item.path),path.join(stage,'contracts',path.basename(item.path))));
      fs.copyFileSync(CATALOG_FILE,path.join(stage,'provider-declarations.json'));
      const manifest={schema:'axm.cognitive-resource.evidence-bundle/v1',bundleId,createdAt:now(),records:wrappers.map(wrapper=>({id:wrapper.recordId,digest:wrapper.recordDigest,kind:wrapper.kind,outputKind:wrapper.outputKind,handId:wrapper.handId,contractBinding:wrapper.contractBinding})),providerCatalogDigest:Core.digest(CATALOG),contractBindings:Core.clone(CATALOG.contractBindings),truth:{mirrorWrite:false,calculationPerformed:false,ranking:false,selection:false,automaticAuthority:false}};
      U.atomicJson(path.join(stage,'BUNDLE_MANIFEST.json'),manifest);const zipped=U.zipDirectory(stage,output,{maxFiles:220,maxBytes:50*1024*1024}),sha256=U.fileSha256(output);appendEvent({type:'EXPORTED_EVIDENCE_BUNDLE',bundleId,sha256,recordIds:ids});return {schema:'axm.cognitive-resource.evidence-bundle-receipt/v1',bundleId,sha256,records:ids.length,archiveBytes:zipped.archiveBytes,requiredThirdPartyDependencies:[],file:path.relative(root,output).replace(/\\/g,'/'),url:'/'+path.relative(root,output).replace(/\\/g,'/').split('/').map(encodeURIComponent).join('/'),automaticAuthority:false};
    } finally { try{U.assertUnder(stage,stateDir);fs.rmSync(stage,{recursive:true,force:true});}catch(_){} }
  }
  function stop() { for(const session of processMeters.values())clearInterval(session.timer);processMeters.clear();return {stopped:true}; }
  function status() { const contracts=validateContractBindings(),records=list();return {schema:'axm.cognitive-resource-meter-status/v1',status:'TEST',claimCeiling:'TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER',records,counts:{records:records.length,active:records.filter(item=>item.state==='ACTIVE').length,archived:records.filter(item=>item.state==='ARCHIVED').length,superseded:records.filter(item=>item.state==='SUPERSEDED').length,profiles:records.filter(item=>item.kind==='MACHINE_PROFILE').length,rateSchedules:records.filter(item=>item.kind==='ECONOMICS_PROFILE_DRAFT').length,observations:records.filter(item=>item.kind==='OBSERVATION_DRAFT').length,activeLocalMeters:processMeters.size},activeLocalMeters:[...processMeters.values()].map(item=>({id:item.sessionId,startedAt:item.startedAt,objectiveDigest:item.objectiveDigest,scope:'WHOLE_WORKSHOP_SERVER_PROCESS'})),providers:Core.clone(CATALOG.providers),hands:Core.clone(CATALOG.hands),meterDefinitions:Core.clone(CATALOG.meterDefinitions),contracts,issueGuidance:Core.clone(Workflows.ISSUE_GUIDANCE),commandCenterControls:Core.clone(CONTROL_CATALOG),requiredThirdPartyDependencies:[],networkPriceRefresh:false,authority:Core.clone(CATALOG.authority),privateStateExclusions:['prompts','responses','hidden reasoning','secrets','identities','private memories','content snapshots'],knownLimits:['linear profile declarations only','provider token totals are not universal compute','freshness and authorship are declared not certified','explicit local process windows cover the whole Workshop server process rather than one isolated task','sampled RSS is not an operating-system certified lifetime peak','no automatic provider compute telemetry without a bound declaration','no nonlinear billing tiers minimums reservations taxes credits concurrency or effective-period engine','no measured billed or calibrated cost claim']}; }
  ensureRoots(); validateContractBindings();
  return { status,list,records,get,vaults,resourceTimeline,previewGoalReceipt,previewObservation,previewEconomics,importGoalReceipt,startLocalProcessMeter,stopLocalProcessMeter,cancelLocalProcessMeter,captureObservation,captureProviderRun,captureComputeTelemetry,captureEconomicsProfile,sealProfile,compatibility:Core.compatibility,archive:(id,confirmation)=>transition(id,'ARCHIVED',confirmation),restore:(id,confirmation)=>transition(id,'ACTIVE',confirmation),exportRecord,exportBundle,stop,validateContractBindings,stateDir,indexFile,eventsFile,coldDir,exportDir,bundleDir };
}

module.exports = { CATALOG, CONTROL_CATALOG, KIND, INDEX_SCHEMA, RECORD_SCHEMA, HAND_RESULT_SCHEMA, COMPUTE_TELEMETRY_SCHEMA, GOAL_RECEIPT_SCHEMA:Workflows.GOAL_RECEIPT_SCHEMA, validateCatalog, validateContractBindings, create };
