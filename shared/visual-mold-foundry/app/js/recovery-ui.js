(() => {
  'use strict';
  const A=window.AXM,$=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)];
  if(!A)throw new Error('AXM Recovery + Intake UI requires the core runtime.');
  let audit=null;
  const metric=(value,label)=>`<div class="metric"><b>${A.escapeHTML(String(value))}</b><span>${A.escapeHTML(label)}</span></div>`;
  const statusClass=state=>['PASS','COMMIT','RESTORE','READY'].includes(state)?'built':['FAIL','ROLLBACK','BLOCKED'].includes(state)?'experimental':'tested';
  const validationRows=checks=>(checks||[]).map(item=>`<div class="validation-row ${String(item.state).toLowerCase()}"><span class="check-state">${A.escapeHTML(item.state)}</span><div><b>${A.escapeHTML(item.label)}</b><p>${A.escapeHTML(item.evidence)}${item.blocking?' · blocking':''}</p></div></div>`).join('');

  function renderOnboarding(){
    const panel=$('#firstRunPanel');if(!panel)return;const status=A.onboardingStatus();panel.hidden=status.complete;
    const readiness=A.getIntakeReadiness?.(),items=[
      {state:status.mode==='localhost'?'PASS':'WARN',label:'Local runtime',evidence:status.mode==='localhost'?'Localhost mode is active.':'Direct-file mode works, but it uses a separate browser workspace from localhost.'},
      {state:status.storage,label:'Browser storage',evidence:`Managed storage audit status: ${status.storage}.`},
      {state:status.health,label:'Workspace health',evidence:`Current health status: ${status.health}.`},
      {state:status.last_safety_capsule_at?'PASS':'WARN',label:'Safety capsule',evidence:status.last_safety_capsule_at?`Last exported ${new Date(status.last_safety_capsule_at).toLocaleString()}.`:'No safety capsule export is recorded in current settings yet.'},
      {state:readiness?.status||'WARN',label:'Intake gate',evidence:readiness?`${readiness.gate} · ${readiness.summary.pass}/${readiness.summary.warn}/${readiness.summary.fail}.`:'The intake-readiness gate has not been run yet.'}
    ];
    $('#onboardingChecklist').innerHTML=items.map(item=>`<div class="readiness-item ${item.state.toLowerCase()}"><b>${A.escapeHTML(item.label)}</b><span>${A.escapeHTML(item.evidence)}</span></div>`).join('');
  }
  function bindRecoveryActions(root=document){
    $$('[data-export-raw]',root).forEach(button=>button.onclick=()=>{try{A.exportRawStorageKey(button.dataset.exportRaw);A.toast('Raw storage copy exported.')}catch(err){A.toast(err.message)}});
    
    $$('[data-recover-pending]',root).forEach(button=>button.onclick=()=>{try{A.recoverPendingKey(button.dataset.recoverPending);render();A.toast('Pending value recovered.')}catch(err){A.toast(`Pending recovery blocked: ${err.message}`)}});
  }
  function renderStorageEntries(){
    const list=$('#recoveryStorageList');if(!list||!audit)return;
    list.innerHTML=audit.entries.map(item=>`<div class="snapshot recovery-entry" data-key="${A.escapeHTML(item.key)}"><div><b>${A.escapeHTML(item.name)} · ${A.escapeHTML(item.state)}</b><span>${item.bytes.toLocaleString()} bytes · ${item.count===null?'unreadable':item.count+' records/fields'} · ${A.escapeHTML(item.evidence)}</span></div><div class="button-row">${item.bytes?`<button class="quiet-button" data-export-raw="${A.escapeHTML(item.key)}" type="button">Export raw</button>`:''}${item.state==='FAIL'?`<button class="danger-button" data-reset-key="${A.escapeHTML(item.key)}" type="button">Reset area</button>`:''}</div></div>`).join('')||'<p class="muted">No managed storage areas found.</p>';
    audit.pending_keys.forEach(key=>list.insertAdjacentHTML('beforeend',`<div class="snapshot"><div><b>Pending write · WARN</b><span>${A.escapeHTML(key)} can be recovered only after its JSON validates.</span></div><button class="secondary-button" data-recover-pending="${A.escapeHTML(key)}" type="button">Recover pending</button></div>`));bindRecoveryActions(list);
  }
  function renderIssues(){
    const issues=audit?.open_issues||[],list=$('#recoveryIssueList');if(!list)return;$('#recoveryIssueCount').textContent=`${issues.length} open`;
    list.innerHTML=issues.length?issues.map(item=>`<div class="snapshot"><div><b>${A.escapeHTML(item.key)}</b><span>${A.escapeHTML(item.error)} · ${item.raw_length.toLocaleString()} chars · seen ${item.occurrences} time${item.occurrences===1?'':'s'}</span></div><div class="button-row"><button class="quiet-button" data-export-raw="${A.escapeHTML(item.key)}" type="button">Export raw</button><button class="danger-button" data-reset-key="${A.escapeHTML(item.key)}" type="button">Reset area</button></div></div>`).join(''):'<p class="muted">No unresolved recovery issues.</p>';bindRecoveryActions(list);
  }
  function renderTransactions(){
    const items=A.transactionRecords(),list=$('#transactionList');if(!list)return;
    list.innerHTML=items.length?items.map(item=>`<div class="snapshot"><div><b>${A.escapeHTML(item.status)} · ${A.escapeHTML(item.label)}</b><span>${A.escapeHTML(item.completed_at||item.started_at||'')} ${item.error?'· '+A.escapeHTML(item.error):''} ${item.note?'· '+A.escapeHTML(item.note):''}</span></div><span class="status-pill ${statusClass(item.status)}">${A.escapeHTML(item.status)}</span></div>`).join(''):'<p class="muted">No storage transactions recorded yet.</p>';
  }
  function renderInspector(){
    const report=A.getInspectedPacket(),container=$('#packageInspectorReport'),pill=$('#packageInspectorState'),button=$('#packageImportButton');if(!container||!pill||!button)return;
    if(!report){pill.textContent='EMPTY';pill.className='status-pill tested';button.disabled=true;container.innerHTML='<p class="muted">No package loaded. Inspection verifies schema, integrity, import route, and executable-looking content before an import transaction begins.</p>';return}
    pill.textContent=report.status;pill.className=`status-pill ${statusClass(report.status)}`;button.disabled=Boolean(report.summary.fail||!report.importer);
    const counts=Object.entries(report.counts||{}).map(([key,value])=>`${key}: ${value}`).join(' · ')||'no collection counts';container.innerHTML=`<div class="readout"><b>${A.escapeHTML(report.label)}</b><br>${A.escapeHTML(report.packet_schema)} · ${report.byte_estimate.toLocaleString()} bytes · ${A.escapeHTML(counts)}</div>${validationRows(report.checks)}`;
  }
  function renderCapsuleStage(){
    const report=A.getStagedCapsule(),container=$('#capsuleStageReport'),pill=$('#capsuleStageState'),merge=$('#capsuleMergeButton'),replace=$('#capsuleReplaceButton');if(!container||!pill)return;
    if(!report){pill.textContent='EMPTY';pill.className='status-pill tested';merge.disabled=true;replace.disabled=true;container.innerHTML='<p class="muted">No safety capsule staged.</p>';return}
    pill.textContent=report.status;pill.className=`status-pill ${statusClass(report.status)}`;merge.disabled=Boolean(report.summary.fail);replace.disabled=Boolean(report.summary.fail);
    const changes=report.entries.filter(item=>item.changed).map(item=>item.name).join(', ')||'none';container.innerHTML=`<div class="readout"><b>${A.escapeHTML(report.capsule_schema)}</b><br>${report.changed_areas} restorable area(s) differ · changed: ${A.escapeHTML(changes)}</div>${validationRows(report.checks)}`;
  }
  function bindRescueActions(root){
    $$('[data-rescue-export]',root).forEach(button=>button.onclick=()=>{try{A.exportRescuePoint(button.dataset.rescueExport);A.toast('Rescue point exported.')}catch(err){A.toast(err.message)}});
    $$('[data-rescue-restore]',root).forEach(button=>button.onclick=async()=>{const confirmation=await window.AXMDialog.confirmPhrase({title:'Restore rescue point',message:'A new guard rescue point is created first. The restoration then runs through a protected storage transaction.',label:'Exact confirmation',expectedValue:'RESTORE',confirmLabel:'Restore rescue point',danger:true});if(confirmation===null)return;try{A.restoreRescuePoint(button.dataset.rescueRestore,confirmation);render();A.toast('Rescue point restored through a protected transaction.')}catch(err){A.toast(`Rescue restore blocked: ${err.message}`)}});
    $$('[data-rescue-delete]',root).forEach(button=>button.onclick=async()=>{const confirmation=await window.AXMDialog.confirmPhrase({title:'Delete rescue point',message:'This removes only the selected compact rescue point. It does not alter the active workspace.',label:'Exact confirmation',expectedValue:'DELETE',confirmLabel:'Delete rescue point',danger:true});if(confirmation===null)return;try{A.deleteRescuePoint(button.dataset.rescueDelete,confirmation);render();A.toast('Rescue point deleted explicitly.')}catch(err){A.toast(err.message)}});
  }
  function renderRescuePoints(){
    const list=$('#rescuePointList'),items=A.rescuePoints();if(!list)return;list.innerHTML=items.length?items.map(item=>`<div class="snapshot"><div><b>${A.escapeHTML(item.reason)}</b><span>${new Date(item.created_at).toLocaleString()} · ${A.escapeHTML(item.id)} · ${A.escapeHTML(item.integrity?.fingerprint||'no fingerprint')}</span></div><div class="button-row"><button class="quiet-button" data-rescue-export="${item.id}" type="button">Export</button><button class="secondary-button" data-rescue-restore="${item.id}" type="button">Restore</button><button class="danger-button" data-rescue-delete="${item.id}" type="button">Delete</button></div></div>`).join(''):'<p class="muted">No compact rescue points yet.</p>';bindRescueActions(list);
  }
  function renderReadiness(){
    const report=A.getIntakeReadiness(),container=$('#readinessReport'),pill=$('#readinessState'),metrics=$('#readinessMetrics');if(!container||!pill||!metrics)return;
    if(!report){pill.textContent='NOT RUN';pill.className='status-pill tested';metrics.innerHTML='';container.innerHTML='<p class="muted">The gate has not been run in this session.</p>';return}
    pill.textContent=report.gate;pill.className=`status-pill ${statusClass(report.gate)}`;metrics.innerHTML=metric(report.summary.pass,'PASS')+metric(report.summary.warn,'WARN')+metric(report.summary.fail,'FAIL')+metric(report.counts.rescue_points,'rescue points');container.innerHTML=validationRows(report.checks);
  }
  function render(){
    audit=A.inspectStorage();const health=A.healthReport(),rollbacks=A.transactionRecords().filter(item=>item.status==='ROLLBACK').length,rescues=A.rescuePoints().length,stage=A.getStagedCapsule(),readiness=A.getIntakeReadiness();
    $('#recoveryMetrics').innerHTML=metric(audit.status,'storage audit')+metric(audit.total_bytes.toLocaleString(),'approximate bytes')+metric(audit.open_issues.length,'open issues')+metric(rollbacks,'safe rollbacks')+metric(rescues,'rescue points')+metric(stage?.status||'EMPTY','capsule stage')+metric(readiness?.gate||'NOT RUN','intake gate')+metric(health.status,'workspace health');
    $('#recoveryAuditState').textContent=audit.status;$('#recoveryAuditState').className=`status-pill ${statusClass(audit.status)}`;renderStorageEntries();renderIssues();renderTransactions();renderInspector();renderCapsuleStage();renderRescuePoints();renderReadiness();renderOnboarding();
  }
  function importInspected(){try{const outcome=A.importInspectedPacket();render();for(const event of ['axm:theme-change','axm:registry-change','axm:mold-change','axm:project-change','axm:batch-change'])window.dispatchEvent(new CustomEvent(event));A.toast(`${outcome.label} imported through a protected transaction.`)}catch(err){render();A.toast(`Inspected import blocked: ${err.message}`)}}
  async function restoreCapsule(mode){const confirmation=await window.AXMDialog.confirmPhrase({title:mode==='replace'?'Replace restorable storage areas':'Merge staged safety capsule',message:`${mode==='replace'?'Restorable areas will be replaced':'The embedded workspace will be merged'}. A compact rescue point is created first.`,label:'Exact confirmation',expectedValue:'RESTORE',confirmLabel:mode==='replace'?'Replace areas':'Merge workspace',danger:true});if(confirmation===null)return;try{A.restoreStagedCapsule(mode,confirmation);render();A.toast(`Safety capsule restored using ${mode} mode.`)}catch(err){render();A.toast(`Capsule restore blocked: ${err.message}`)}}
  function runReadiness(){try{A.intakeReadinessReport();render();A.toast('Intake-readiness gate complete.')}catch(err){A.toast(`Readiness gate failed: ${err.message}`)}}
  function init(){
    $('#recoveryAuditButton').onclick=()=>{render();A.toast('Storage audit complete.')};
    $('#recoveryCapsuleButton').onclick=()=>{try{A.exportSafetyCapsule();render();A.toast('Safety capsule exported.')}catch(err){A.toast(`Safety capsule failed: ${err.message}`)}};
    $('#rescuePointButton').onclick=()=>{try{A.createRescuePoint('manual recovery checkpoint');render();A.toast('Compact rescue point created.')}catch(err){A.toast(`Rescue point failed: ${err.message}`)}};
    $('#reopenGuideButton').onclick=()=>{A.reopenOnboarding();renderOnboarding();document.querySelector('[data-view="overview"]')?.click()};
    $('#packageInspectButton').onclick=()=>$('#packageInspectFile').click();
    $('#packageInspectFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>16_000_000){A.toast('Package rejected before reading: the 16 MB JSON limit was exceeded.');event.target.value='';return}const reader=new FileReader();reader.onload=()=>{try{A.inspectPacket(String(reader.result));renderInspector();A.toast('Package inspection complete.')}catch(err){A.clearInspectedPacket();renderInspector();A.toast(`Package inspection rejected: ${err.message}`)}};reader.onerror=()=>A.toast('Package file could not be read locally.');reader.readAsText(file);event.target.value=''});
    $('#packageImportButton').onclick=importInspected;$('#packageClearButton').onclick=()=>{A.clearInspectedPacket();renderInspector()};
    $('#capsuleStageButton').onclick=()=>$('#capsuleStageFile').click();
    $('#capsuleStageFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>16_000_000){A.toast('Safety capsule rejected before reading: the 16 MB JSON limit was exceeded.');event.target.value='';return}const reader=new FileReader();reader.onload=()=>{try{A.stageSafetyCapsule(String(reader.result));render();A.toast('Safety capsule staged without changing storage.')}catch(err){A.clearStagedCapsule();render();A.toast(`Capsule staging rejected: ${err.message}`)}};reader.onerror=()=>A.toast('Safety capsule file could not be read locally.');reader.readAsText(file);event.target.value=''});
    $('#capsuleMergeButton').onclick=()=>restoreCapsule('merge');$('#capsuleReplaceButton').onclick=()=>restoreCapsule('replace');$('#capsuleClearButton').onclick=()=>{A.clearStagedCapsule();render()};
    $('#readinessRunButton').onclick=runReadiness;$('#readinessExportButton').onclick=()=>{try{A.exportIntakeReadinessReport();render();A.toast('Readiness report exported.')}catch(err){A.toast(err.message)}};$('#handoffExportButton').onclick=()=>{try{A.exportIntakeHandoffPacket();render();A.toast('Local-intake handoff exported.')}catch(err){A.toast(err.message)}};
    $('#browserValidatedButton').onclick=async()=>{const note=await window.AXMDialog.askText({title:'Record target-browser validation',message:'Describe what you actually inspected in Windows Chrome or Edge. This becomes local readiness evidence; it does not claim engine parity.',label:'Validation note',defaultValue:'Main Studio views, previews, focus states, exports',required:true,confirmLabel:'Record validation'});if(note===null)return;A.markTargetBrowserValidated(note);runReadiness();A.toast('Target-browser visual check recorded locally.')};
    $('#onboardingCapsuleButton').onclick=()=>{try{A.exportSafetyCapsule();renderOnboarding();A.toast('Safety capsule exported.')}catch(err){A.toast(err.message)}};
    $('#onboardingReadinessButton').onclick=()=>{document.querySelector('[data-view="recovery"]')?.click();runReadiness()};
    $('#onboardingCompleteButton').onclick=()=>{A.completeOnboarding();renderOnboarding();A.toast('First-run guide hidden for now. You can reopen it from Recovery + Intake.')};
    window.addEventListener('axm:recovery-change',render);window.addEventListener('axm:onboarding-change',renderOnboarding);window.addEventListener('axm:readiness-change',()=>{renderReadiness();renderOnboarding()});renderOnboarding();
  }
  window.AXMRecoveryUI={init,render,renderOnboarding,renderInspector,renderCapsuleStage,renderReadiness,renderRescuePoints};
})();
