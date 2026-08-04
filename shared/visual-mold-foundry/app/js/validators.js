(() => {
  'use strict';
  const {REG,contrastRatio,performanceBudget}=window.AXM;
  const required=REG.schema.required||[];
  const result=(id,label,state,confidence,evidence)=>({id,label,state,confidence,evidence});
  function valueAtPath(source,path){return String(path||'').split('.').filter(Boolean).reduce((value,key)=>value==null?undefined:value[key],source)}
  function sameValue(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  function protectedChangeAnalysis(parent,candidate){
    const protectedPaths=[...new Set(parent?.core?.protected||[])],requested=[...new Set(Array.isArray(candidate?.protected_change_request)?candidate.protected_change_request:[])];
    const actual=protectedPaths.filter(path=>!sameValue(valueAtPath(parent,path),valueAtPath(candidate,path)));
    const approved=actual.filter(path=>requested.includes(path)),unrequested=actual.filter(path=>!requested.includes(path));
    const stale=requested.filter(path=>protectedPaths.includes(path)&&!actual.includes(path)),invalid=requested.filter(path=>!protectedPaths.includes(path));
    return {protectedPaths,requested,actual,approved,unrequested,stale,invalid};
  }

  function schemaCheck(mold){const missing=required.filter(key=>!(key in (mold||{})));return missing.length?result('schema','Manifest schema','FAIL',1,`Missing required fields: ${missing.join(', ')}`):result('schema','Manifest schema','PASS',1,`All ${required.length} required fields are present.`)}
  function duplicateCheck(mold,extra=[]){const ids=[...REG.molds,...REG.organs,...REG.tokens,...REG.presets,...window.AXM.getLocalThemes(true),...extra].map(item=>item.id).filter(Boolean),hits=ids.filter((id,index)=>ids.indexOf(id)!==index&&id===mold.id);return hits.length?result('duplicate-id','ID uniqueness','FAIL',1,`Duplicate ID: ${mold.id}`):result('duplicate-id','ID uniqueness','PASS',1,`${mold.id} is unique in the loaded registry.`)}
  function dependencyCheck(mold){const organIds=new Set(REG.organs.map(o=>o.id)),missing=(mold.organs||[]).filter(id=>!organIds.has(id));return missing.length?result('dependency','Dependencies','FAIL',1,`Missing organs: ${missing.join(', ')}`):result('dependency','Dependencies','PASS',1,`${(mold.organs||[]).length} organ references resolved.`)}
  function boundsCheck(mold,controls){const invalid=[];for(const [key,spec] of Object.entries(mold.inputs||{})){const value=controls?.[key];if(spec.type==='number'&&(Number.isNaN(Number(value))||Number(value)<spec.minimum||Number(value)>spec.maximum))invalid.push(`${key}=${value} outside ${spec.minimum}..${spec.maximum}`);if(spec.type==='enum'&&!spec.values?.includes(value))invalid.push(`${key}=${value} is not one of ${spec.values?.join(', ')}`)}return invalid.length?result('range','Typed input ranges','FAIL',1,invalid.join('; ')):result('range','Typed input ranges','PASS',1,'Numeric and enum controls are inside their declared contracts.')}
  function overflowCheck(mold,controls){const over=[];for(const [key,spec] of Object.entries(mold.inputs||{})){if(spec.type==='text'&&String(controls?.[key]??'').length>(spec.maximum_characters||Infinity))over.push(`${key}: ${String(controls[key]).length}/${spec.maximum_characters}`)}if(over.length)return result('overflow','Text overflow','FAIL',1,over.join('; '));const title=String(controls?.title||''),limit=mold.inputs?.title?.maximum_characters||70;if(title.length>limit*.85)return result('overflow','Text overflow','WARN',.94,`Title uses ${title.length}/${limit} characters; inspect narrow formats.`);return result('overflow','Text overflow','PASS',.96,'Declared text limits are respected.')}
  function safeAreaCheck(mold,controls,variant){const [w,h]=window.AXM.formatDimensions(variant.format),ratio=w/h,title=String(controls.title||''),message=String(controls.message||''),risk=(title.length>52&&ratio<.72)||(message.length>260&&h<700)||(String(controls.cta||'').length>36&&ratio<.65);return risk?result('safe-area','Safe area','WARN',.82,'Content density may press protected margins in this format; proof inspection is required.'):result('safe-area','Safe area','PASS',.88,`${variant.format} remains within the renderer's protected inset model.`)}
  function contrastCheck(mold,controls,variant){const p=window.AXM.getTheme(variant.theme);if(!p)return result('contrast','Minimum contrast','FAIL',1,`Theme is unavailable: ${variant.theme}`);const ratio=contrastRatio(p.text,p.surface);if(ratio===null)return result('contrast','Minimum contrast','WARN',.6,'Could not calculate text/surface contrast from non-hex theme values.');const target=Math.max(4.5,Number(p.contrast_target||4.5));return ratio<4.5?result('contrast','Minimum contrast','FAIL',.99,`Estimated contrast is ${ratio.toFixed(2)}:1; minimum is 4.5:1.`):ratio<target?result('contrast','Minimum contrast','WARN',.96,`Estimated contrast is ${ratio.toFixed(2)}:1; usable but below the theme target ${target.toFixed(1)}:1.`):result('contrast','Minimum contrast','PASS',.99,`Estimated contrast is ${ratio.toFixed(2)}:1 against a ${target.toFixed(1)}:1 theme target.`)}
  function formatCheck(mold,controls,variant){
    const allowedAxes=new Set(REG.schema.variant_axes||['theme','format','motion','performance','state']),unknownAxes=Object.keys(mold.variants||{}).filter(axis=>!allowedAxes.has(axis)),invalid=[];
    if(unknownAxes.length)invalid.push(`unknown axes: ${unknownAxes.join(', ')}`);
    for(const axis of Object.keys(mold.variants||{})){
      const supported=window.AXM.variantValues(mold,axis);
      if(!supported.includes(variant?.[axis]))invalid.push(`${axis}=${variant?.[axis]??'missing'} (allowed: ${supported.join(', ')})`);
    }
    return invalid.length
      ? result('format','Variant axes','FAIL',1,`Unsupported variant selection(s): ${invalid.join('; ')}`)
      : result('format','Variant axes','PASS',1,`${Object.keys(mold.variants||{}).length} declared variant axes resolve to allowed values.`);
  }
  function themeCheck(mold,controls,variant){const theme=window.AXM.findTheme(variant.theme);if(!theme)return result('theme','Theme contract','FAIL',1,`Theme registry entry is missing: ${variant.theme}`);if(!window.AXM.isThemeUsable(theme))return result('theme','Theme contract','FAIL',1,`${variant.theme} is not ACTIVE and approved.`);if(!window.AXM.themeCompatibleWithMold(theme,mold))return result('theme','Theme contract','FAIL',1,`${variant.theme} is not compatible with the ${mold.renderer} renderer.`);return result('theme','Theme contract','PASS',1,`${theme.name} resolves through the ${theme.source_kind==='local-theme'?'local governed':'protected package'} theme registry.`)}
  function rendererCheck(mold){const allowed=new Set(REG.schema.allowed_renderers||['card','living-skin','portal-scene']);if(!allowed.has(mold.renderer))return result('renderer','Renderer contract','FAIL',1,`Unknown renderer: ${mold.renderer}`);if(mold.renderer==='card'&&!mold.renderer_options?.layout)return result('renderer','Renderer contract','FAIL',1,'Card renderer requires renderer_options.layout.');if(mold.renderer==='card'&&window.AXMRender?.CARD_LAYOUTS&&!window.AXMRender.CARD_LAYOUTS.has(mold.renderer_options.layout))return result('renderer','Renderer contract','FAIL',1,`Unsupported card layout recipe: ${mold.renderer_options.layout}`);return result('renderer','Renderer contract','PASS',1,`${mold.renderer} renderer uses ${mold.renderer_options?.layout||mold.renderer} at composition level ${mold.composition_level}.`)}
  function previewCheck(mold){return mold.preview?result('preview','Preview reference','PASS',1,`Preview path declared: ${mold.preview}`):result('preview','Preview reference','FAIL',1,'No preview path is declared.')}
  function provenanceCheck(mold){const p=mold.provenance||{},missing=['author','source','license','rights_scope','consent','transformation_history'].filter(key=>!p[key]);return missing.length?result('provenance','Provenance + rights','FAIL',1,`Missing: ${missing.join(', ')}`):result('provenance','Provenance + rights','PASS',1,'Source, author, rights scope, consent, and transformation history are present.')}
  function performanceCheck(mold,controls,variant){const budget=performanceBudget(variant.performance),low=variant.performance==='low';let estimated=0;const high=['glow','edge_glow','inner_glow','beam_strength','reflection'].filter(key=>Number(controls[key])>.45).length;estimated+=high;if(!low&&Number(controls.fog_density??controls.fog)>0.3)estimated++;if(Number(controls.particle_density??controls.particles)>0.25)estimated+=low?1:2;if(!low&&Number(controls.energy_movement)>0.25)estimated++;if(!low&&Number(controls.density)>0.65)estimated++;if(!low&&variant.motion!=='still')estimated++;if(estimated>budget.effects)return result('performance','Performance budget','FAIL',.92,`Estimated effect cost ${estimated} exceeds ${variant.performance} budget ${budget.effects}.`);if(estimated===budget.effects)return result('performance','Performance budget','WARN',.86,`Estimated effect cost is at the ${variant.performance} limit (${budget.effects}).`);return result('performance','Performance budget','PASS',.87,`Estimated post-fallback effect cost ${estimated}/${budget.effects}; renderer particle cap ${budget.particles}.`)}
  function reducedMotionCheck(mold,controls,variant,context){const animated=variant.motion&&variant.motion!=='still',hasFallback=(mold.organs||[]).includes('axm.state.reduced-motion');if(animated&&!hasFallback)return result('reduced-motion','Reduced motion','FAIL',1,'Motion is enabled but no reduced-motion organ is declared.');if(animated&&context?.reducedMotion)return result('reduced-motion','Reduced motion','PASS',1,'The session replaces motion with a still frame.');return result('reduced-motion','Reduced motion','PASS',1,hasFallback?'A reduced-motion fallback is declared.':'No continuous motion is active.')}
  function protectedMutationCheck(mold,context){
    const unrequested=context?.unrequestedProtectedChanges||[],invalid=context?.invalidProtectedRequests||[],stale=context?.staleProtectedRequests||[],approved=context?.approvedProtectedChanges||[];
    if(invalid.length)return result('protected-field','Protected field request','FAIL',1,`Unknown protected paths requested: ${invalid.join(', ')}`);
    if(unrequested.length)return result('protected-field','Protected field mutation','FAIL',1,`Protected changes were not explicitly requested: ${unrequested.join(', ')}`);
    if(stale.length)return result('protected-field','Protected field request','WARN',.98,`Declared protected changes do not match an actual change: ${stale.join(', ')}`);
    if(approved.length)return result('protected-field','Protected field change evidence','PASS',1,`Actual protected changes explicitly requested: ${approved.join(', ')}`);
    return result('protected-field','Protected field mutation','PASS',1,`${mold.core?.protected?.length||0} protected paths remain unchanged.`)
  }
  function exportReadinessCheck(mold){const supported=new Set(['json','html','svg','png','webp','proof-html','proof-png','token-package','skin-manifest','mold-package','theme-css','theme-book','family-package','extension-package','health-report','batch-gallery','workspace']),unknown=(mold.outputs||[]).filter(x=>!supported.has(x));return unknown.length?result('export','Export readiness','WARN',.96,`Declared but not implemented in-browser: ${unknown.join(', ')}`):result('export','Export readiness','PASS',.97,`${(mold.outputs||[]).length} declared outputs map to local exporters or governed packages.`)}
  function approvalCheck(mold){return ['EXPERIMENTAL','APPROVED','DEPRECATED'].includes(mold.approval_state)?result('approval','Approval state','PASS',1,`Explicit state: ${mold.approval_state}.`):result('approval','Approval state','FAIL',1,'Approval state must be EXPERIMENTAL, APPROVED, or DEPRECATED.')}
  function lineageCheck(mold){const line=mold.lineage||{},parent=line.parent;if(!('parent'in line)||!Array.isArray(line.derived_from)||!line.change_policy)return result('lineage','Lineage contract','FAIL',1,'Lineage must declare parent, derived_from, and change_policy.');if(parent&&!window.AXM.findMold(parent))return result('lineage','Lineage contract','FAIL',1,`Parent is missing: ${parent}`);return result('lineage','Lineage contract','PASS',1,`Parent: ${parent||'root'}; source kind: ${mold.source_kind||'unspecified'}; policy: ${line.change_policy}.`)}
  function inheritanceCheck(mold){if(mold.source_kind==='derived'){if(!mold.inherited_from||mold.inherited_from!==mold.lineage?.parent)return result('inheritance','Sparse inheritance','FAIL',1,'Derived mold does not resolve to its declared parent.');return result('inheritance','Sparse inheritance','PASS',1,`Resolved non-destructively from ${mold.inherited_from}; source remains ${mold.source_manifest}.`)}if(mold.source_kind==='extension'){const parent=mold.lineage?.parent;if(parent&&mold.inherited_from!==parent)return result('inheritance','Extension inheritance','FAIL',1,'Extension inherited_from does not match its lineage parent.');return result('inheritance','Extension inheritance','PASS',1,`Separate local extension derived from ${parent||'an explicit local root'}.`)}return result('inheritance','Sparse inheritance','PASS',1,`Root mold source: ${mold.source_manifest||'registry manifest'}.`)}
  function publicScopeCheck(mold){if(mold.public_scope==='public-safe'){const p=mold.provenance||{};if(!String(p.rights_scope||'').includes('public'))return result('public-scope','Public-safe scope','FAIL',1,'Public-safe mold lacks a public rights scope.');if(mold.approval_state!=='APPROVED')return result('public-scope','Public-safe scope','WARN',1,'Structure is marked public-safe but remains EXPERIMENTAL until explicit approval.');}return result('public-scope','Public-safe scope','PASS',.98,`Scope is ${mold.public_scope||'private'} and remains explicit.`)}


  function extensionStateCheck(mold){
    if(mold.source_kind!=='extension')return result('extension-state','Extension registry state','PASS',1,'Core/derived registry mold is outside the local extension state machine.');
    const allowed=new Set(['ACTIVE','QUARANTINED','DEPRECATED','ARCHIVED']),state=mold.extension_state;
    if(!allowed.has(state))return result('extension-state','Extension registry state','FAIL',1,`Unknown extension state: ${state||'missing'}`);
    if(state==='ACTIVE'&&mold.approval_state!=='APPROVED')return result('extension-state','Extension registry state','FAIL',1,'ACTIVE extensions must be explicitly APPROVED.');
    if(state==='QUARANTINED'&&mold.approval_state==='APPROVED')return result('extension-state','Extension registry state','WARN',1,'Quarantined extension carries approval but still requires explicit activation.');
    return result('extension-state','Extension registry state','PASS',1,`Local extension state is explicit: ${state}.`)
  }


  function releaseGateEvidenceCheck(mold){
    if(mold.source_kind!=='extension')return result('release-gate','Extension release gate','PASS',1,'Core/derived registry mold does not require a local extension release packet.');
    if(mold.extension_state!=='ACTIVE')return result('release-gate','Extension release gate','PASS',1,'Inactive extension remains outside the usable Atlas.');
    if(!mold.release_gate)return result('release-gate','Extension release gate','FAIL',1,'ACTIVE extension has no recorded release gate.');
    const integrity=window.AXM.verifyPacketIntegrity(mold.release_gate);if(integrity.status==='FAIL')return result('release-gate','Extension release gate','FAIL',1,'Release-gate fingerprint does not match its contents.');
    if(mold.release_gate.summary?.fail)return result('release-gate','Extension release gate','FAIL',1,'Recorded release gate contains failures.');
    if(mold.release_gate.summary?.warn&&!mold.release_warning_acknowledged)return result('release-gate','Extension release gate','FAIL',1,'Release warnings were not explicitly acknowledged.');
    return result('release-gate','Extension release gate',mold.release_gate.summary?.warn?'WARN':'PASS',1,`${mold.release_gate.proof_matrix?.length||0} proof cases recorded; warning acknowledgement: ${Boolean(mold.release_warning_acknowledged)}.`)
  }

  function compositionCheck(mold){const level=Number(mold.composition_level);if(!Number.isInteger(level)||level<2||level>7)return result('composition','Composition level','FAIL',1,`Composition level must be an integer from 2 to 7, received ${mold.composition_level}.`);const reusable=(mold.organs||[]).length>=6;return reusable?result('composition','Composition level','PASS',.96,`Level ${level} combines ${(mold.organs||[]).length} governed organs.`):result('composition','Composition level','WARN',.86,`Level ${level} declares only ${(mold.organs||[]).length} organs; composability may be shallow.`)}

  function validate(mold,controls={},variant={},context={}){
    const checks=[schemaCheck(mold),duplicateCheck(mold,context.extraRegistry||[]),dependencyCheck(mold),boundsCheck(mold,controls),overflowCheck(mold,controls),safeAreaCheck(mold,controls,variant),contrastCheck(mold,controls,variant),formatCheck(mold,controls,variant),themeCheck(mold,controls,variant),rendererCheck(mold),previewCheck(mold),provenanceCheck(mold),performanceCheck(mold,controls,variant),reducedMotionCheck(mold,controls,variant,context),protectedMutationCheck(mold,context),exportReadinessCheck(mold),approvalCheck(mold),lineageCheck(mold),inheritanceCheck(mold),publicScopeCheck(mold),extensionStateCheck(mold),releaseGateEvidenceCheck(mold),compositionCheck(mold)];
    const summary=checks.reduce((acc,check)=>(acc[check.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0});return {schema:'axm.validation-report/0.5',mold_id:mold.id,checked_at:new Date().toISOString(),summary,checks,status:summary.fail?'FAIL':summary.warn?'WARN':'PASS'};
  }
  function addCandidateCheck(report,check){
    report.checks.unshift(check);report.summary[check.state.toLowerCase()]++;report.status=report.summary.fail?'FAIL':report.summary.warn?'WARN':'PASS';return report
  }
  function candidateIntentCheck(candidate){
    const intent=candidate?.intent||{},missing=[];
    if(!String(intent.purpose||'').trim())missing.push('intent.purpose');
    if(!String(intent.change_summary||'').trim())missing.push('intent.change_summary');
    if(missing.length)return result('candidate-intent','Candidate intent','FAIL',1,`Missing: ${missing.join(', ')}`);
    return result('candidate-intent','Candidate intent','PASS',1,`Purpose and change summary are explicit; ${(intent.tags||[]).length||0} tag(s) recorded.`)
  }
  function candidateFromText(text){
    const candidate=window.AXM.safeParseJSON(text),parentId=candidate.lineage?.parent||candidate.parent,parent=parentId?window.AXM.findMold(parentId):null,controls=window.AXM.defaultControls(candidate),variant=window.AXM.defaultVariant(candidate);
    const change=parent?protectedChangeAnalysis(parent,candidate):{approved:[],unrequested:[],stale:[],invalid:[]};
    const report=validate(candidate,controls,variant,{extraRegistry:window.AXM.getCandidates(),approvedProtectedChanges:change.approved,unrequestedProtectedChanges:change.unrequested,staleProtectedRequests:change.stale,invalidProtectedRequests:change.invalid,reducedMotion:window.AXM.state.reducedMotion});
    addCandidateCheck(report,candidateIntentCheck(candidate));
    const coreIds=new Set([...REG.molds,...REG.organs,...REG.tokens,...REG.presets,...window.AXM.getExtensions(true),...window.AXM.getLocalThemes(true)].map(item=>item.id));
    if(coreIds.has(candidate.id))addCandidateCheck(report,result('candidate-id-collision','Candidate ID collision','FAIL',1,`Candidate ID already belongs to a core registry item: ${candidate.id}`));
    if(parentId&&!parent)addCandidateCheck(report,result('candidate-parent','Candidate parent','FAIL',1,`Candidate parent is unavailable: ${parentId}`));
    return report;
  }
  window.AXMValidate={validate,candidateFromText,valueAtPath,protectedChangeAnalysis};
})();
