(() => {
  'use strict';
  const A=window.AXM;
  if(!A)throw new Error('AXM Recovery and Intake Center requires the core runtime.');
  const MANAGED_KEYS=Object.entries(A.STORAGE).filter(([name])=>!['migration'].includes(name));
  const ARRAY_KEYS=new Set(['presets','candidates','snapshots','extensions','themes','projects','batches','recovery','transactions','rescue']);
  const RESTORABLE_NAMES=['presets','candidates','snapshots','extensions','themes','projects','batches','settings'];
  const CAPSULE_KEYS=MANAGED_KEYS.filter(([name])=>name!=='rescue');
  const RESCUE_LIMIT=5;
  const transactionNames=['importWorkspace','importFamilyPackage','importThemePackage','importExtensionPackage','importPreset','importProjectPackage','importBatchPackage'];
  let inspected=null,stagedCapsule=null,lastReadiness=null;

  function directRead(key){return localStorage.getItem(key)}
  function directWrite(key,value){const serialized=String(value);localStorage.setItem(key,serialized);if(localStorage.getItem(key)!==serialized)throw new Error(`Browser storage did not retain ${key}.`)}
  function directRemove(key){localStorage.removeItem(key);if(localStorage.getItem(key)!==null)throw new Error(`Browser storage did not remove ${key}.`)}
  function safeKeyName(key){return String(key||'storage').replace(/[^a-z0-9._-]+/gi,'-').slice(-90)}
  function rawSnapshot(pairs=MANAGED_KEYS){return Object.fromEntries(pairs.map(([,key])=>[key,directRead(key)]))}
  function restoreRawSnapshot(snapshot){
    for(const [,key] of MANAGED_KEYS){const raw=snapshot[key];if(raw===null||raw===undefined)directRemove(key);else directWrite(key,raw)}
  }
  function stateSnapshot(){return A.clone(A.state)}
  function restoreState(snapshot){for(const key of Object.keys(A.state))delete A.state[key];Object.assign(A.state,A.clone(snapshot))}
  function transactionRecords(){
    try{const raw=directRead(A.STORAGE.transactions),parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[]}
    catch{return []}
  }
  function recordTransaction(record){
    try{const list=transactionRecords();list.unshift(record);directWrite(A.STORAGE.transactions,JSON.stringify(list.slice(0,60)));return record}
    catch{return record}
  }
  function assertManagedStorageReadable(){
    for(const [name,key] of MANAGED_KEYS){
      const raw=directRead(key);if(raw===null)continue;
      const parsed=A.safeParseJSON(raw),expectsArray=ARRAY_KEYS.has(name);
      if(expectsArray&&!Array.isArray(parsed))throw new Error(`Managed storage verification failed for ${name}: expected an array.`);
      if(!expectsArray&&(Array.isArray(parsed)||!parsed||typeof parsed!=='object'))throw new Error(`Managed storage verification failed for ${name}: expected an object.`);
    }
  }
  function withStorageTransaction(label,operation){
    const storageBefore=rawSnapshot(),stateBefore=stateSnapshot(),started=A.nowISO(),id=A.uid('axm.transaction');
    try{
      const result=operation();if(result===false)throw new Error(`${label} reported that its intended mutation was not persisted.`);assertManagedStorageReadable();
      recordTransaction({id,label:A.safeText(label,100),status:'COMMIT',started_at:started,completed_at:A.nowISO(),note:'All managed storage mutations completed without an uncaught error.'});
      A.log(`Committed storage transaction: ${label}`,'PASS');
      window.dispatchEvent(new CustomEvent('axm:recovery-change'));
      return result;
    }catch(err){
      try{restoreRawSnapshot(storageBefore);restoreState(stateBefore)}catch(restoreErr){A.recordStorageIssue(A.STORAGE.transactions,restoreErr)}
      recordTransaction({id,label:A.safeText(label,100),status:'ROLLBACK',started_at:started,completed_at:A.nowISO(),error:A.safeText(err?.message||err,600),note:'Managed browser storage and active state were restored to their pre-transaction values.'});
      A.log(`Rolled back storage transaction: ${label} · ${err.message}`,'FAIL');
      for(const event of ['axm:theme-change','axm:registry-change','axm:mold-change','axm:project-change','axm:batch-change','axm:recovery-change'])window.dispatchEvent(new CustomEvent(event));
      throw err;
    }
  }
  function wrapImport(name){
    const original=A[name];if(typeof original!=='function'||original.__axmTransactionWrapped)return;
    const wrapped=function(...args){return withStorageTransaction(name,()=>original.apply(A,args))};
    wrapped.__axmTransactionWrapped=true;wrapped.__axmOriginal=original;A[name]=wrapped;
  }
  transactionNames.forEach(wrapImport);

  function inspectStorage(){
    const entries=[],issues=A.recoveryLedgerDirect().filter(item=>item.status==='OPEN'),issueKeys=new Set(issues.map(item=>item.key));let totalBytes=0,corrupt=0,warnings=0;
    for(const [name,key] of MANAGED_KEYS){
      const raw=directRead(key),bytes=String(raw||'').length*2;totalBytes+=bytes;
      if(raw===null){entries.push({name,key,state:'EMPTY',bytes:0,count:0,evidence:'No local record stored.'});continue}
      try{
        const value=A.safeParseJSON(raw),expectedArray=ARRAY_KEYS.has(name),shapeOk=expectedArray?Array.isArray(value):Boolean(value&&typeof value==='object'&&!Array.isArray(value));
        const count=Array.isArray(value)?value.length:Object.keys(value||{}).length,state=shapeOk?(issueKeys.has(key)?'WARN':'PASS'):'WARN';if(state==='WARN')warnings++;
        entries.push({name,key,state,bytes,count,fingerprint:A.rawFingerprint(raw),evidence:shapeOk?(issueKeys.has(key)?'Data parses, but an unresolved prior issue remains recorded.':'JSON parses and matches the expected top-level shape.'):`Expected ${expectedArray?'an array':'an object'} at the top level.`});
      }catch(err){corrupt++;A.recordStorageIssue(key,err,raw);entries.push({name,key,state:'FAIL',bytes,count:null,fingerprint:A.rawFingerprint(raw),evidence:err.message});}
    }
    const pending=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('axm.visual-foundry.')&&key.endsWith('.pending'))pending.push(key)}
    if(pending.length)warnings++;
    const status=corrupt?'FAIL':warnings||issues.length||pending.length?'WARN':'PASS';
    return {schema:'axm.storage-audit/0.8',created_at:A.nowISO(),status,summary:{pass:entries.filter(item=>item.state==='PASS').length,warn:entries.filter(item=>item.state==='WARN').length+(pending.length?1:0),fail:corrupt},total_bytes:totalBytes,entries,pending_keys:pending,open_issues:A.recoveryLedgerDirect().filter(item=>item.status==='OPEN'),transactions:transactionRecords().slice(0,20)};
  }
  function exportRawStorageKey(key){
    if(!MANAGED_KEYS.some(([,managed])=>managed===key))throw new Error('Storage key is outside the managed AXM v0.9 area.');
    const raw=directRead(key);if(raw===null)throw new Error('No raw storage value exists for this key.');
    A.downloadBlob(`axm-recovery-raw-${safeKeyName(key)}-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`,raw,'text/plain');return {key,length:raw.length,fingerprint:A.rawFingerprint(raw)};
  }
  function resetStorageKey(key,confirmation){
    if(confirmation!=='RESET')throw new Error('Reset cancelled. The exact confirmation word RESET is required.');
    if(!MANAGED_KEYS.some(([,managed])=>managed===key))throw new Error('Storage key is outside the managed AXM v0.9 area.');
    const raw=directRead(key);if(raw!==null)exportRawStorageKey(key);
    directRemove(key);A.clearStorageIssue(key);recordTransaction({id:A.uid('axm.transaction'),label:`reset ${key}`,status:'EXPLICIT-RESET',completed_at:A.nowISO(),note:'Raw value was exported before explicit removal.'});
    A.log(`Explicitly reset local storage area: ${key}`,'WARN');window.dispatchEvent(new CustomEvent('axm:recovery-change'));return true;
  }
  function recoverPendingKey(pendingKey){
    if(!String(pendingKey).endsWith('.pending'))throw new Error('Not a pending storage key.');const target=String(pendingKey).slice(0,-8),raw=directRead(pendingKey);if(raw===null)throw new Error('Pending value is missing.');A.safeParseJSON(raw);directWrite(target,raw);directRemove(pendingKey);A.clearStorageIssue(target);recordTransaction({id:A.uid('axm.transaction'),label:`recover ${target}`,status:'RECOVERED-PENDING',completed_at:A.nowISO()});window.dispatchEvent(new CustomEvent('axm:recovery-change'));return target;
  }
  function safetyCapsule(){
    const raw=Object.fromEntries(CAPSULE_KEYS.map(([name,key])=>[name,{key,raw:directRead(key),fingerprint:A.rawFingerprint(directRead(key)||''),bytes:String(directRead(key)||'').length*2}]));
    const packet={schema:'axm.safety-capsule/0.9',version:'0.9.0',created_at:A.nowISO(),application:A.applicationMetadata(),health:A.healthReport(),storage_audit:inspectStorage(),workspace:A.workspacePacket(),raw_storage:raw,rescue_points:rescuePoints().map(item=>({id:item.id,created_at:item.created_at,reason:item.reason,integrity:item.integrity})),session_log:A.clone(A.state.sessionLog),recovery_note:'This capsule preserves a normal workspace packet plus raw managed browser-storage values. Restore is staged, compared, rescue-protected, and requires an explicit RESTORE confirmation. Raw values are never executed.'};
    return A.attachPacketIntegrity(packet,'Safety capsule fingerprint covers the workspace, health report, audit, raw managed storage values, and session log.');
  }
  function exportSafetyCapsule(){const packet=safetyCapsule();A.downloadBlob(`axm-visual-foundry-safety-capsule-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(packet,null,2)+'\n','application/json');A.setSettings({lastSafetyCapsuleAt:A.nowISO()});return packet}

  function rescuePoints(){return A.storageRead(A.STORAGE.rescue,[])}
  function createRescuePoint(reason='manual rescue point'){
    const raw=Object.fromEntries(RESTORABLE_NAMES.map(name=>{const key=A.STORAGE[name],value=directRead(key);return [name,{key,raw:value,fingerprint:A.rawFingerprint(value||''),bytes:String(value||'').length*2}]}));
    const base={schema:'axm.rescue-point/0.9',version:'0.9.0',id:A.uid('axm.rescue'),created_at:A.nowISO(),reason:A.safeText(reason,120),state:stateSnapshot(),raw_storage:raw,note:'Compact local rescue point. It excludes recovery, transaction, migration, and rescue ledgers to prevent recursive growth.'};
    const point=A.attachPacketIntegrity(base,'Rescue point fingerprint covers restorable browser storage and active Studio state.');
    const list=rescuePoints();list.unshift(point);A.requireStorageWrite(A.STORAGE.rescue,list.slice(0,RESCUE_LIMIT));window.dispatchEvent(new CustomEvent('axm:recovery-change'));return point;
  }
  function exportRescuePoint(id){const point=rescuePoints().find(item=>item.id===id);if(!point)throw new Error('Rescue point not found.');A.downloadBlob(`${A.slugify(point.reason)}-${point.id}.axmrescue.json`,JSON.stringify(point,null,2)+'\n','application/json');return point}
  function deleteRescuePoint(id,confirmation){if(confirmation!=='DELETE')throw new Error('Delete cancelled. The exact confirmation word DELETE is required.');const list=rescuePoints(),next=list.filter(item=>item.id!==id);if(next.length===list.length)throw new Error('Rescue point not found.');A.requireStorageWrite(A.STORAGE.rescue,next);window.dispatchEvent(new CustomEvent('axm:recovery-change'));return true}
  function validateRawEntry(name,entry,options={}){
    if(!entry||typeof entry!=='object')return {name,state:'WARN',evidence:'No raw storage entry is present in this capsule.',changed:true};
    const raw=entry.raw;if(raw!==null&&typeof raw!=='string')return {name,state:'FAIL',evidence:'Raw entry must be a string or null.',changed:true};
    const actual=A.rawFingerprint(raw||'');if(options.requireFingerprint&&!entry.fingerprint)return {name,state:'FAIL',evidence:'Current capsule raw entries require a fingerprint.',changed:true};const fingerprintOk=!entry.fingerprint||entry.fingerprint===actual;if(!fingerprintOk)return {name,state:'FAIL',evidence:`Raw fingerprint mismatch: expected ${entry.fingerprint}, calculated ${actual}.`,changed:true};
    if(raw!==null){try{const parsed=A.safeParseJSON(raw),arrayExpected=ARRAY_KEYS.has(name),shapeOk=arrayExpected?Array.isArray(parsed):Boolean(parsed&&typeof parsed==='object'&&!Array.isArray(parsed));if(!shapeOk)return {name,state:'FAIL',evidence:`Expected ${arrayExpected?'an array':'an object'} at the top level.`,changed:true};}catch(err){return {name,state:'FAIL',evidence:`Raw JSON is invalid: ${err.message}`,changed:true}}}
    const current=directRead(A.STORAGE[name]),changed=A.rawFingerprint(current||'')!==actual;return {name,state:'PASS',evidence:raw===null?'Capsule intentionally contains no stored value.':`Raw JSON validates and fingerprint ${actual} matches.`,changed,current_fingerprint:A.rawFingerprint(current||''),capsule_fingerprint:actual,bytes:String(raw||'').length*2};
  }
  function stageSafetyCapsule(raw){
    const packet=typeof raw==='string'?A.safeParseJSON(raw):A.clone(raw);if(!packet||!['axm.safety-capsule/0.7','axm.safety-capsule/0.8','axm.safety-capsule/0.9'].includes(packet.schema)||!packet.raw_storage||!packet.workspace)throw new Error('Not a valid AXM safety capsule.');
    const legacy=packet.schema==='axm.safety-capsule/0.7',integrity=A.verifyPacketIntegrity(packet),integrityState=integrity.status==='PASS'?'PASS':legacy&&integrity.status==='MISSING'?'WARN':'FAIL',entries=RESTORABLE_NAMES.map(name=>validateRawEntry(name,packet.raw_storage[name],{requireFingerprint:!legacy})),checks=[{state:integrityState,label:'Capsule integrity',evidence:integrity.status==='PASS'?`Fingerprint matches: ${integrity.actual}`:legacy&&integrity.status==='MISSING'?'Legacy capsule has no integrity fingerprint.':'Current capsule integrity is missing, mismatched, or mislabeled.'},{state:packet.workspace?'PASS':'FAIL',label:'Workspace fallback',evidence:packet.workspace?`Embedded workspace schema: ${packet.workspace.schema||'unknown'}.`:'No workspace fallback is present.'},...entries.map(item=>({state:item.state,label:`Raw area · ${item.name}`,evidence:item.evidence}))];
    const summary=checks.reduce((acc,item)=>(acc[item.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0}),changed=entries.filter(item=>item.changed).length;
    const report={schema:'axm.safety-capsule-stage/0.9',created_at:A.nowISO(),capsule_schema:packet.schema,capsule_created_at:packet.created_at||null,status:summary.fail?'FAIL':summary.warn?'WARN':'PASS',summary,changed_areas:changed,entries,checks,integrity};stagedCapsule={packet,report};window.dispatchEvent(new CustomEvent('axm:recovery-change'));return A.clone(report);
  }
  function getStagedCapsule(){return stagedCapsule?A.clone(stagedCapsule.report):null}
  function clearStagedCapsule(){stagedCapsule=null;window.dispatchEvent(new CustomEvent('axm:recovery-change'));return true}
  function applyRestoredState(packet){
    const settingsEntry=packet.raw_storage?.settings,settings=settingsEntry?.raw?A.safeParseJSON(settingsEntry.raw):{},current=packet.workspace?.current||{};Object.assign(A.state,{reducedMotion:settings.reducedMotion??A.state.reducedMotion,lowPower:settings.lowPower??A.state.lowPower,interfaceTheme:settings.interfaceTheme||A.state.interfaceTheme,onboardingComplete:Boolean(settings.onboardingComplete),lastSeenVersion:settings.lastSeenVersion||A.state.lastSeenVersion,lastSafetyCapsuleAt:settings.lastSafetyCapsuleAt||A.state.lastSafetyCapsuleAt,targetBrowserValidatedAt:settings.targetBrowserValidatedAt||A.state.targetBrowserValidatedAt,targetBrowserValidationNote:settings.targetBrowserValidationNote||A.state.targetBrowserValidationNote});
    const target=current.mold_id?A.findMold(current.mold_id):null;if(target&&A.isMoldUsable(target)){A.state.moldId=target.id;A.state.controls=A.clone(current.controls||A.defaultControls(target));A.state.variant={...A.defaultVariant(target),...A.clone(current.variant||{})};}else{const root=A.findMold('axm.mold.universal-visual-card')||A.getAllMolds()[0];A.state.moldId=root.id;A.state.controls=A.defaultControls(root);A.state.variant=A.defaultVariant(root)}
  }
  function restoreRawStoragePacket(packet,label){
    for(const name of RESTORABLE_NAMES){const entry=packet.raw_storage?.[name];if(!entry)continue;const check=validateRawEntry(name,entry);if(check.state==='FAIL')throw new Error(`${name}: ${check.evidence}`);const key=A.STORAGE[name];if(entry.raw===null)directRemove(key);else directWrite(key,entry.raw);A.clearStorageIssue(key)}applyRestoredState(packet);const health=A.healthReport();if(health.summary.fail)throw new Error(`Restored data fails health checks: ${health.summary.fail} failure(s).`);A.setSettings({lastRestoreAt:A.nowISO()});for(const event of ['axm:theme-change','axm:registry-change','axm:mold-change','axm:project-change','axm:batch-change','axm:recovery-change'])window.dispatchEvent(new CustomEvent(event));return {mode:'replace',label,health_status:health.status,restored_areas:RESTORABLE_NAMES.filter(name=>packet.raw_storage?.[name]).length};
  }
  function restoreStagedCapsule(mode='replace',confirmation=''){
    if(!stagedCapsule)throw new Error('No safety capsule is staged.');if(stagedCapsule.report.summary.fail)throw new Error('Restore blocked by staged capsule failures.');if(confirmation!=='RESTORE')throw new Error('Restore cancelled. The exact confirmation word RESTORE is required.');const rescue=createRescuePoint(`before ${mode} capsule restore`),packet=A.clone(stagedCapsule.packet);
    let result;if(mode==='merge'){if(!packet.workspace)throw new Error('Staged capsule has no workspace fallback.');result=A.importWorkspace(packet.workspace);A.setSettings({lastRestoreAt:A.nowISO()});result={mode:'merge',rescue_id:rescue.id,...result};}else if(mode==='replace'){result=A.withStorageTransaction('restore staged safety capsule',()=>restoreRawStoragePacket(packet,'staged safety capsule'));result.rescue_id=rescue.id;}else throw new Error(`Unknown restore mode: ${mode}`);recordTransaction({id:A.uid('axm.transaction'),label:`safety capsule ${mode}`,status:'RESTORE',completed_at:A.nowISO(),note:`Pre-restore rescue point: ${rescue.id}.`});A.log(`Restored staged safety capsule using ${mode} mode.`,'PASS');return result;
  }
  function restoreRescuePoint(id,confirmation=''){
    const point=rescuePoints().find(item=>item.id===id);if(!point)throw new Error('Rescue point not found.');if(confirmation!=='RESTORE')throw new Error('Restore cancelled. The exact confirmation word RESTORE is required.');const integrity=A.verifyPacketIntegrity(point);if(integrity.status!=='PASS')throw new Error('Rescue point requires a valid integrity fingerprint.');const guard=createRescuePoint(`before rescue restore ${id}`),packet={raw_storage:point.raw_storage,workspace:{current:{mold_id:point.state?.moldId||null,controls:point.state?.controls||{},variant:point.state?.variant||{}}}};const result=A.withStorageTransaction('restore rescue point',()=>restoreRawStoragePacket(packet,'rescue point'));result.rescue_id=guard.id;recordTransaction({id:A.uid('axm.transaction'),label:`restore rescue ${id}`,status:'RESTORE',completed_at:A.nowISO(),note:`Guard rescue point: ${guard.id}.`});return result;
  }
  function markTargetBrowserValidated(note='Manual Windows Chrome or Edge visual check completed'){A.setSettings({targetBrowserValidatedAt:A.nowISO(),targetBrowserValidationNote:A.safeText(note,300)});window.dispatchEvent(new CustomEvent('axm:readiness-change'));return {checked_at:A.state.targetBrowserValidatedAt,note:A.state.targetBrowserValidationNote}}
  function intakeReadinessReport(){
    const checks=[],add=(state,label,evidence,blocking=false)=>checks.push({state,label,evidence,blocking:Boolean(blocking)}),core=A.coreIntegrityReport(),audit=inspectStorage(),health=A.healthReport();add(core.status,'Protected core integrity',core.status==='PASS'?`${core.core_count} molds and ${core.theme_count} themes are unchanged.`:'Protected core mismatch detected.',true);add(audit.summary.fail?'FAIL':audit.open_issues.length?'FAIL':audit.status,'Storage and recovery',audit.summary.fail?`${audit.summary.fail} corrupt area(s) remain.`:audit.open_issues.length?`${audit.open_issues.length} unresolved recovery issue(s) remain.`:`Storage audit ${audit.status}; ${audit.total_bytes.toLocaleString()} approximate bytes.`,true);add(health.summary.fail?'FAIL':health.status,'Workspace health',`${health.summary.pass} pass, ${health.summary.warn} warn, ${health.summary.fail} fail.`,true);
    const activeExtensions=A.getExtensions(true).filter(item=>item.extension_state==='ACTIVE'),badGates=activeExtensions.filter(item=>!item.release_gate||item.release_gate.summary?.fail||A.verifyPacketIntegrity(item.release_gate).status==='FAIL');add(badGates.length?'FAIL':'PASS','Active extension release evidence',badGates.length?`${badGates.length} active extension(s) lack valid release-gate evidence.`:`${activeExtensions.length} active extension(s) retain valid release evidence.`,true);
    const activeThemes=A.getLocalThemes(true).filter(item=>item.theme_state==='ACTIVE'),badThemes=activeThemes.filter(item=>item.approval_state!=='APPROVED'||A.themeValidation(item).summary.fail);add(badThemes.length?'FAIL':'PASS','Active local themes',badThemes.length?`${badThemes.length} active theme(s) fail approval or validation.`:`${activeThemes.length} active local theme(s) are approved and valid.`,true);
    const projects=typeof A.getProjects==='function'?A.getProjects(true):[],batches=typeof A.getBatches==='function'?A.getBatches(true):[],projectFails=projects.filter(item=>{const report=A.projectValidation(item);return Boolean(report.summary.fail)||(item.project_state==='APPROVED'&&report.status!=='PASS')}).length,batchFails=batches.filter(item=>{const report=A.batchValidation(item);return Boolean(report.summary.fail)||(item.batch_state==='APPROVED'&&report.status!=='PASS')}).length,drafts=projects.filter(item=>item.project_state==='DRAFT').length+batches.filter(item=>item.batch_state==='DRAFT').length;add(projectFails||batchFails?'FAIL':drafts?'WARN':'PASS','Project and batch registry',projectFails||batchFails?`${projectFails} project and ${batchFails} batch validation or approved-readiness failure(s).`:drafts?`${drafts} project/batch record(s) remain draft; they are excluded from release claims.`:`${projects.length} projects and ${batches.length} batches are approved or archived cleanly.`,Boolean(projectFails||batchFails));
    const capsuleAt=A.state.lastSafetyCapsuleAt,ageDays=capsuleAt?(Date.now()-Date.parse(capsuleAt))/86400000:null;add(!capsuleAt||ageDays>7?'WARN':'PASS','Recent safety capsule',!capsuleAt?'No safety capsule export is recorded.':ageDays>7?`Last safety capsule is ${Math.floor(ageDays)} days old.`:`Safety capsule exported ${new Date(capsuleAt).toLocaleString()}.`);add(location.protocol==='file:'?'WARN':'PASS','Local runtime mode',location.protocol==='file:'?'Direct-file mode is active; localhost validation is recommended.':'Localhost mode is active.');add(A.state.targetBrowserValidatedAt?'PASS':'WARN','Target browser visual check',A.state.targetBrowserValidatedAt?`Recorded ${new Date(A.state.targetBrowserValidatedAt).toLocaleString()} · ${A.state.targetBrowserValidationNote||'manual check'}.`:'Windows Chrome or Edge visual inspection has not been recorded.');
    const adapterCount=Object.values(A.REG.adapters||{}).filter(item=>item.status==='LOCAL VALIDATION REQUIRED').length;add(adapterCount?'WARN':'PASS','Downstream adapter validation',adapterCount?`${adapterCount} adapter scaffold(s) remain LOCAL VALIDATION REQUIRED; cross-engine parity is not claimed.`:'All declared adapters are locally validated.');
    const summary=checks.reduce((acc,item)=>(acc[item.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0}),gate=summary.fail?'BLOCKED':summary.warn?'READY_WITH_LOCAL_VALIDATION':'READY';const report=A.attachPacketIntegrity({schema:'axm.intake-readiness/0.9',version:'0.9.0',created_at:A.nowISO(),gate,status:summary.fail?'FAIL':summary.warn?'WARN':'PASS',summary,counts:{active_extensions:activeExtensions.length,active_themes:activeThemes.length,projects:projects.length,batches:batches.length,rescue_points:rescuePoints().length},checks},'Intake readiness fingerprint covers protected core, storage/recovery, health, active growth evidence, assembly records, backup freshness, runtime, browser check, and adapter status.');lastReadiness=report;window.dispatchEvent(new CustomEvent('axm:readiness-change'));return A.clone(report);
  }
  function getIntakeReadiness(){return lastReadiness?A.clone(lastReadiness):null}
  function exportIntakeReadinessReport(){const report=intakeReadinessReport();A.downloadBlob(`axm-intake-readiness-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(report,null,2)+'\n','application/json');A.setSettings({lastReadinessReportAt:A.nowISO()});return report}
  function intakeHandoffPacket(){const readiness=intakeReadinessReport(),packet={schema:'axm.local-intake-handoff/0.9',version:'0.9.0',created_at:A.nowISO(),application:A.applicationMetadata(),readiness,health:A.healthReport(),storage_audit:inspectStorage(),core:A.coreIntegrityReport(),workspace:A.workspacePacket(),rescue_points:rescuePoints().map(item=>({id:item.id,created_at:item.created_at,reason:item.reason,integrity:item.integrity})),adapter_status:Object.fromEntries(Object.entries(A.REG.adapters||{}).map(([id,item])=>[id,{target:item.target,status:item.status,visual_parity_claim:item.visual_parity_claim}])),handoff_note:'Import as a local checkpoint. Protected core remains authoritative. Local themes, extensions, projects, and batches do not silently become protected canon.'};return A.attachPacketIntegrity(packet,'Local intake handoff fingerprint covers readiness, health, audit, core, workspace, rescue summaries, and adapter status.');}
  function exportIntakeHandoffPacket(){const packet=intakeHandoffPacket();A.downloadBlob(`axm-visual-foundry-v0.9-local-intake-handoff.json`,JSON.stringify(packet,null,2)+'\n','application/json');A.setSettings({lastReadinessReportAt:A.nowISO()});return packet}

  const packetTypes={
    'axm.visual-workspace/0.2':{type:'workspace',label:'Legacy workspace',importer:'importWorkspace'},
    'axm.visual-workspace/0.3':{type:'workspace',label:'Legacy workspace',importer:'importWorkspace'},
    'axm.visual-workspace/0.4':{type:'workspace',label:'Legacy workspace',importer:'importWorkspace'},
    'axm.visual-workspace/0.5':{type:'workspace',label:'Legacy workspace',importer:'importWorkspace'},
    'axm.visual-workspace/0.6':{type:'workspace',label:'Workspace',importer:'importWorkspace',requiresIntegrity:true},
    'axm.family-package/0.3':{type:'family',label:'Legacy family package',importer:'importFamilyPackage'},
    'axm.family-package/0.4':{type:'family',label:'Legacy family package',importer:'importFamilyPackage'},
    'axm.family-package/0.5':{type:'family',label:'Family package',importer:'importFamilyPackage',requiresIntegrity:true},
    'axm.theme-package/0.5':{type:'theme',label:'Theme package',importer:'importThemePackage'},
    'axm.extension-package/0.5':{type:'extension',label:'Extension package',importer:'importExtensionPackage'},
    'axm.visual-project-package/0.6':{type:'project',label:'Visual project package',importer:'importProjectPackage',requiresIntegrity:true},
    'axm.data-batch-package/0.6':{type:'batch',label:'Data batch package',importer:'importBatchPackage',requiresIntegrity:true},
    'axm.visual-preset/0.1':{type:'preset',label:'Legacy visual preset',importer:'importPreset'},
    'axm.visual-preset/0.2':{type:'preset',label:'Legacy visual preset',importer:'importPreset'},
    'axm.visual-preset/0.3':{type:'preset',label:'Legacy visual preset',importer:'importPreset'},
    'axm.visual-preset/0.5':{type:'preset',label:'Visual preset',importer:'importPreset'},
    'axm.visual-preset/0.4':{type:'preset',label:'Legacy visual preset',importer:'importPreset'},
    'axm.safety-capsule/0.7':{type:'safety-capsule',label:'Legacy safety capsule',importer:null},
    'axm.safety-capsule/0.8':{type:'safety-capsule',label:'Legacy safety capsule',importer:null,requiresIntegrity:true},
    'axm.safety-capsule/0.9':{type:'safety-capsule',label:'Safety capsule',importer:null,requiresIntegrity:true},
    'axm.local-intake-handoff/0.8':{type:'intake-handoff',label:'Legacy local intake handoff',importer:null,requiresIntegrity:true},
    'axm.local-intake-handoff/0.9':{type:'intake-handoff',label:'Local intake handoff',importer:null,requiresIntegrity:true},
    'axm.rescue-point/0.8':{type:'rescue-point',label:'Legacy rescue point',importer:null,requiresIntegrity:true},
    'axm.rescue-point/0.9':{type:'rescue-point',label:'Rescue point',importer:null,requiresIntegrity:true},
    'axm.mold-package/0.3':{type:'mold-package',label:'Legacy read-only mold package',importer:null},
    'axm.mold-package/0.5':{type:'mold-package',label:'Read-only mold package',importer:null,requiresIntegrity:true},
    'axm.extension-package/0.4':{type:'extension',label:'Legacy extension package',importer:'importExtensionPackage'}
  };
  function packetCounts(packet){
    const keys=['presets','candidates','snapshots','extensions','themes','projects','batches','local_presets','local_candidates','local_extensions','local_themes','items','rows'];const counts={};
    for(const key of keys)if(Array.isArray(packet[key]))counts[key]=packet[key].length;
    if(packet.project?.items)counts.project_items=packet.project.items.length;if(packet.batch?.rows)counts.batch_rows=packet.batch.rows.length;
    return counts;
  }
  function inspectPacket(raw){
    const packet=typeof raw==='string'?A.safeParseJSON(raw):A.clone(raw),descriptor=packetTypes[packet?.schema];if(!descriptor)throw new Error(`Unsupported or unknown package schema: ${packet?.schema||'missing'}`);
    const integrity=packet.integrity?.fingerprint?A.verifyPacketIntegrity(packet):{status:'MISSING',expected:null,actual:null},checks=[];
    checks.push({state:'PASS',label:'Recognized schema',evidence:`${descriptor.label} · ${packet.schema}`});
    checks.push({state:integrity.status==='FAIL'||(descriptor.requiresIntegrity&&integrity.status!=='PASS')?'FAIL':integrity.status==='MISSING'?'WARN':'PASS',label:'Packet integrity',evidence:integrity.status==='PASS'?`Fingerprint matches: ${integrity.actual}`:descriptor.requiresIntegrity?'This schema requires a valid, correctly labeled integrity fingerprint.':integrity.status==='FAIL'?`Expected ${integrity.expected}, calculated ${integrity.actual}.`:'No integrity fingerprint is present; this may be a legacy data format.'});
    checks.push({state:descriptor.importer?'PASS':'WARN',label:'Import route',evidence:descriptor.importer?`Explicit local importer available: ${descriptor.importer}.`:'This packet is inspectable/exportable but has no automated restore route.'});
    const text=JSON.stringify(packet),remote=/https?:\/\//i.test(text),executable=/\b(?:javascript:|vbscript:|<script|onerror\s*=|onclick\s*=)/i.test(text);checks.push({state:executable?'FAIL':remote?'WARN':'PASS',label:'Content boundary',evidence:executable?'Executable-looking content was detected.':remote?'Remote-looking URLs are present and require human review.':'No executable-looking content or remote URL was detected.'});
    const summary=checks.reduce((acc,item)=>(acc[item.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0});
    inspected={schema:'axm.package-inspection/0.8',created_at:A.nowISO(),packet_schema:packet.schema,type:descriptor.type,label:descriptor.label,importer:descriptor.importer,integrity,counts:packetCounts(packet),byte_estimate:text.length*2,status:summary.fail?'FAIL':summary.warn?'WARN':'PASS',summary,checks,packet};
    return A.clone(inspected);
  }
  function getInspectedPacket(){return inspected?A.clone(inspected):null}
  function importInspectedPacket(){
    if(!inspected)throw new Error('No inspected package is loaded.');if(inspected.summary.fail)throw new Error('Import blocked by package-inspection failures.');if(!inspected.importer)throw new Error('This packet has no automated import route.');const fn=A[inspected.importer];if(typeof fn!=='function')throw new Error(`Importer unavailable: ${inspected.importer}`);const result=fn(A.clone(inspected.packet));A.log(`Imported inspected ${inspected.label}.`,'PASS');return {type:inspected.type,label:inspected.label,result};
  }
  function clearInspectedPacket(){inspected=null}
  function completeOnboarding(){A.setSettings({onboardingComplete:true,lastSeenVersion:A.APP.version});window.dispatchEvent(new CustomEvent('axm:onboarding-change'));return true}
  function reopenOnboarding(){A.setSettings({onboardingComplete:false,lastSeenVersion:A.APP.version});window.dispatchEvent(new CustomEvent('axm:onboarding-change'));return true}
  function onboardingStatus(){
    const audit=inspectStorage(),health=A.healthReport(),hasData=MANAGED_KEYS.some(([name,key])=>!['settings','recovery','transactions'].includes(name)&&directRead(key));return {complete:Boolean(A.state.onboardingComplete),version:A.APP.version,mode:location.protocol==='file:'?'direct-file':'localhost',health:health.status,storage:audit.status,has_local_data:hasData,last_safety_capsule_at:A.storageRead(A.STORAGE.settings,{}).lastSafetyCapsuleAt||null};
  }

  const baseHealth=A.healthReport.bind(A);
  A.healthReport=function(){
    const base=A.clone(baseHealth());delete base.integrity;const audit=inspectStorage(),rolledBack=transactionRecords().filter(item=>item.status==='ROLLBACK').length,openIssues=audit.open_issues.length,rescues=rescuePoints();
    base.schema='axm.health-report/0.8';base.counts={...(base.counts||{}),open_recovery_issues:openIssues,transactions:transactionRecords().length,rescue_points:rescues.length};base.checks=[...(base.checks||[]),{state:audit.status,label:'Browser storage audit',evidence:`${audit.summary.pass} pass, ${audit.summary.warn} warn, ${audit.summary.fail} fail across ${audit.entries.length} managed areas.`},{state:rolledBack?'WARN':'PASS',label:'Import transaction history',evidence:rolledBack?`${rolledBack} import transaction(s) rolled back safely; inspect the Recovery Center for details.`:'No rolled-back import transactions are recorded.'},{state:openIssues?'WARN':'PASS',label:'Recovery issue ledger',evidence:openIssues?`${openIssues} unresolved storage issue(s) are preserved for explicit review.`:'No unresolved storage issues are recorded.'},{state:rescues.length?'PASS':'WARN',label:'Local rescue points',evidence:rescues.length?`${rescues.length} compact rescue point(s) are available.`:'No compact rescue point is available yet.'}];base.summary=base.checks.reduce((acc,item)=>(acc[item.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0});base.status=base.summary.fail?'FAIL':base.summary.warn?'WARN':'PASS';return A.attachPacketIntegrity(base,'Health report fingerprint includes protected core, local growth, projects, batches, storage audit, transaction history, and recovery issues.');
  };
  A.exportHealthReport=function(){const report=A.healthReport();A.downloadBlob(`axm-visual-foundry-health-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(report,null,2)+'\n','application/json');return report};

  Object.assign(A,{withStorageTransaction,inspectStorage,transactionRecords,exportRawStorageKey,resetStorageKey,recoverPendingKey,safetyCapsule,exportSafetyCapsule,rescuePoints,createRescuePoint,exportRescuePoint,deleteRescuePoint,restoreRescuePoint,stageSafetyCapsule,getStagedCapsule,clearStagedCapsule,restoreStagedCapsule,markTargetBrowserValidated,intakeReadinessReport,getIntakeReadiness,exportIntakeReadinessReport,intakeHandoffPacket,exportIntakeHandoffPacket,inspectPacket,getInspectedPacket,importInspectedPacket,clearInspectedPacket,completeOnboarding,reopenOnboarding,onboardingStatus});
  window.dispatchEvent(new CustomEvent('axm:recovery-ready'));
})();
