(() => {
  'use strict';
  const REG = window.AXM_REGISTRY;
  const APP = Object.freeze({name:'AXM Visual Mold Foundry',version:'0.9.1',storage_version:'v0.9'});
  const CORE_MOLDS = JSON.parse(JSON.stringify(REG.molds));
  const CORE_THEMES = JSON.parse(JSON.stringify(REG.themes||[]));
  const STORAGE = {
    presets: 'axm.visual-foundry.presets.v0.9',
    candidates: 'axm.visual-foundry.candidates.v0.9',
    snapshots: 'axm.visual-foundry.snapshots.v0.9',
    extensions: 'axm.visual-foundry.extensions.v0.9',
    themes: 'axm.visual-foundry.themes.v0.9',
    projects: 'axm.visual-foundry.projects.v0.9',
    batches: 'axm.visual-foundry.batches.v0.9',
    settings: 'axm.visual-foundry.settings.v0.9',
    recovery: 'axm.visual-foundry.recovery.v0.9',
    transactions: 'axm.visual-foundry.transactions.v0.9',
    rescue: 'axm.visual-foundry.rescue.v0.9',
    migration: 'axm.visual-foundry.migration.v0.9'
  };
  const LEGACY_STORAGES = [
    {
      version: 'v0.8',
      presets: 'axm.visual-foundry.presets.v0.8',
      candidates: 'axm.visual-foundry.candidates.v0.8',
      snapshots: 'axm.visual-foundry.snapshots.v0.8',
      extensions: 'axm.visual-foundry.extensions.v0.8',
      themes: 'axm.visual-foundry.themes.v0.8',
      projects: 'axm.visual-foundry.projects.v0.8',
      batches: 'axm.visual-foundry.batches.v0.8',
      settings: 'axm.visual-foundry.settings.v0.8',
      recovery: 'axm.visual-foundry.recovery.v0.8',
      transactions: 'axm.visual-foundry.transactions.v0.8',
      rescue: 'axm.visual-foundry.rescue.v0.8'
    },
    {
      version: 'v0.7',
      presets: 'axm.visual-foundry.presets.v0.7',
      candidates: 'axm.visual-foundry.candidates.v0.7',
      snapshots: 'axm.visual-foundry.snapshots.v0.7',
      extensions: 'axm.visual-foundry.extensions.v0.7',
      themes: 'axm.visual-foundry.themes.v0.7',
      projects: 'axm.visual-foundry.projects.v0.7',
      batches: 'axm.visual-foundry.batches.v0.7',
      settings: 'axm.visual-foundry.settings.v0.7',
      recovery: 'axm.visual-foundry.recovery.v0.7',
      transactions: 'axm.visual-foundry.transactions.v0.7'
    },
    {
      version: 'v0.6',
      presets: 'axm.visual-foundry.presets.v0.6',
      candidates: 'axm.visual-foundry.candidates.v0.6',
      snapshots: 'axm.visual-foundry.snapshots.v0.6',
      extensions: 'axm.visual-foundry.extensions.v0.6',
      themes: 'axm.visual-foundry.themes.v0.6',
      projects: 'axm.visual-foundry.projects.v0.6',
      batches: 'axm.visual-foundry.batches.v0.6',
      settings: 'axm.visual-foundry.settings.v0.6'
    },
    {
      version: 'v0.5',
      presets: 'axm.visual-foundry.presets.v0.5',
      candidates: 'axm.visual-foundry.candidates.v0.5',
      snapshots: 'axm.visual-foundry.snapshots.v0.5',
      extensions: 'axm.visual-foundry.extensions.v0.5',
      themes: 'axm.visual-foundry.themes.v0.5',
      settings: 'axm.visual-foundry.settings.v0.5'
    },
    {
      version: 'v0.4',
      presets: 'axm.visual-foundry.presets.v0.4',
      candidates: 'axm.visual-foundry.candidates.v0.4',
      snapshots: 'axm.visual-foundry.snapshots.v0.4',
      extensions: 'axm.visual-foundry.extensions.v0.4',
      themes: 'axm.visual-foundry.themes.v0.4',
      settings: 'axm.visual-foundry.settings.v0.4'
    },
    {
      version: 'v0.3',
      presets: 'axm.visual-foundry.presets.v0.3',
      candidates: 'axm.visual-foundry.candidates.v0.3',
      snapshots: 'axm.visual-foundry.snapshots.v0.3',
      extensions: 'axm.visual-foundry.extensions.v0.3',
      themes: 'axm.visual-foundry.themes.v0.3',
      settings: 'axm.visual-foundry.settings.v0.3'
    },
    {
      version: 'v0.2',
      presets: 'axm.visual-foundry.presets.v0.2',
      candidates: 'axm.visual-foundry.candidates.v0.2',
      snapshots: 'axm.visual-foundry.snapshots.v0.2',
      extensions: 'axm.visual-foundry.extensions.v0.2',
      themes: 'axm.visual-foundry.themes.v0.2',
      settings: 'axm.visual-foundry.settings.v0.2'
    },
    {
      version: 'v0.1',
      presets: 'axm.visual-foundry.presets.v0.1',
      candidates: 'axm.visual-foundry.candidates.v0.1',
      snapshots: 'axm.visual-foundry.snapshots.v0.1',
      extensions: 'axm.visual-foundry.extensions.v0.1',
      themes: 'axm.visual-foundry.themes.v0.1',
      settings: 'axm.visual-foundry.settings.v0.1'
    }
  ];
  const LEGACY_STORAGE = LEGACY_STORAGES[LEGACY_STORAGES.length - 1];
  const DEFAULT_STATE = {
    moldId: 'axm.mold.universal-visual-card',
    controls: {},
    variant: {theme:'aetherglass', format:'landscape', motion:'ambient', performance:'standard', state:'idle'},
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    lowPower: false,
    interfaceTheme: 'dark',
    onboardingComplete: false,
    lastSeenVersion: null,
    lastSafetyCapsuleAt: null,
    lastReadinessReportAt: null,
    lastRestoreAt: null,
    targetBrowserValidatedAt: null,
    targetBrowserValidationNote: null,
    sessionLog: []
  };
  const state = typeof structuredClone === 'function' ? structuredClone(DEFAULT_STATE) : JSON.parse(JSON.stringify(DEFAULT_STATE));
  let toastTimer = null;

  function clone(value){ return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function nowISO(){ return new Date().toISOString(); }
  function runtimeOrigin(){ return location.protocol==='file:'?'direct-file (separate browser storage)':location.origin; }
  function applicationMetadata(extra={}){ return {name:APP.name,version:APP.version,local_first:true,runtime_origin:runtimeOrigin(),...extra}; }
  function uid(prefix='axm.local'){ return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2,9)}`; }
  function slugify(text){ return String(text || 'untitled').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72) || 'untitled'; }
  function clamp(v,min=0,max=1){ return Math.min(max,Math.max(min,Number(v))); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function mapRange(v,a,b,c,d){ return c+(d-c)*((v-a)/(b-a)); }
  function escapeHTML(value){ return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function sanitizeText(value,max=5000){ return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g,' ').slice(0,max); }
  function safeText(value,max=500){ return sanitizeText(value,max); }

  function hasUnsafeKey(value){
    const stack=[value];
    while(stack.length){
      const current=stack.pop();if(!current||typeof current!=='object')continue;
      for(const [key,item] of Object.entries(current)){
        if(['__proto__','prototype','constructor'].includes(key))return true;
        if(item&&typeof item==='object')stack.push(item);
      }
    }
    return false;
  }
  function hasTraversal(value){
    const stack=[value];
    while(stack.length){
      const current=stack.pop();
      if(typeof current==='string'&&/(^|[\\/])\.\.([\\/]|$)|^[a-zA-Z]:\\|^\\\\/.test(current))return true;
      if(current&&typeof current==='object')stack.push(...Object.values(current));
    }
    return false;
  }
  function inspectShape(value,depth=0){
    if (depth > 32) throw new Error('JSON nesting exceeds the 32-level safety limit.');
    if (Array.isArray(value)) {
      if (value.length > 10000) throw new Error('JSON array exceeds the 10,000-item safety limit.');
      value.forEach(item=>inspectShape(item,depth+1));
    } else if (value && typeof value === 'object') {
      const entries=Object.entries(value);
      if (entries.length > 5000) throw new Error('JSON object exceeds the 5,000-field safety limit.');
      entries.forEach(([,item])=>inspectShape(item,depth+1));
    }
  }
  function safeParseJSON(text){
    const source=String(text);
    if (source.length > 16_000_000) throw new Error('JSON import exceeds the 16 MB safety limit.');
    const parsed=JSON.parse(source);
    if (hasUnsafeKey(parsed)) throw new Error('Unsafe object key rejected.');
    if (hasTraversal(parsed)) throw new Error('Path traversal-like value rejected.');
    inspectShape(parsed);
    return parsed;
  }
  function rawFingerprint(raw){
    const source=String(raw??'');let hash=2166136261;
    for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function recoveryLedgerDirect(){
    try { const raw=localStorage.getItem(STORAGE.recovery); const parsed=raw?JSON.parse(raw):[]; return Array.isArray(parsed)?parsed:[]; }
    catch { return []; }
  }
  function recordStorageIssue(key,error,raw=null){
    if(!key||key===STORAGE.recovery)return null;
    try {
      const source=raw===null?localStorage.getItem(key):raw,ledger=recoveryLedgerDirect(),fingerprint=rawFingerprint(source),existing=ledger.find(item=>item.key===key&&item.fingerprint===fingerprint&&item.status==='OPEN');
      if(existing){existing.last_seen_at=nowISO();existing.occurrences=Number(existing.occurrences||1)+1;existing.error=safeText(error?.message||error,500)}
      else ledger.unshift({id:uid('axm.recovery.issue'),key,status:'OPEN',first_seen_at:nowISO(),last_seen_at:nowISO(),occurrences:1,error:safeText(error?.message||error,500),raw_length:String(source||'').length,fingerprint,note:'Original browser storage value remains untouched until an explicit recovery action.'});
      localStorage.setItem(STORAGE.recovery,JSON.stringify(ledger.slice(0,60)));return existing||ledger[0];
    } catch { return null; }
  }
  function clearStorageIssue(key){
    if(!key||key===STORAGE.recovery)return false;
    try { const ledger=recoveryLedgerDirect().map(item=>item.key===key&&item.status==='OPEN'?{...item,status:'RESOLVED',resolved_at:nowISO()}:item);localStorage.setItem(STORAGE.recovery,JSON.stringify(ledger.slice(0,60)));return true; }
    catch { return false; }
  }
  function storageRead(key,fallback=[]){
    try {
      const value=localStorage.getItem(key);
      if(!value)return clone(fallback);
      const parsed=safeParseJSON(value);
      if(Array.isArray(fallback)&&!Array.isArray(parsed))throw new Error('Stored value has the wrong top-level shape; expected an array.');
      if(fallback&&typeof fallback==='object'&&!Array.isArray(fallback)&&(Array.isArray(parsed)||!parsed||typeof parsed!=='object'))throw new Error('Stored value has the wrong top-level shape; expected an object.');
      return parsed;
    }
    catch (err) { const raw=localStorage.getItem(key);recordStorageIssue(key,err,raw);log(`Storage read held for recovery: ${key} · ${err.message}`,'WARN'); return clone(fallback); }
  }
  function storageWrite(key,value){
    try { const serialized=JSON.stringify(value);safeParseJSON(serialized);localStorage.setItem(key,serialized);clearStorageIssue(key);return true; }
    catch (err) { recordStorageIssue(key,err);toast(`Could not save locally: ${err.message}`); log(`Storage write failed: ${key} · ${err.message}`,'FAIL'); return false; }
  }
  function requireStorageWrite(key,value){
    if(storageWrite(key,value))return true;
    throw new Error(`Local persistence failed for ${key}. The action was not recorded as complete.`);
  }
  function migrateLegacyStorage(){
    if (localStorage.getItem(STORAGE.migration)) return {migrated:false,count:0,source:'already-complete'};
    let count=0,failures=0;const sources=new Set();
    for (const legacy of LEGACY_STORAGES) {
      for (const name of ['presets','candidates','snapshots','extensions','themes','projects','batches','settings','recovery','transactions','rescue']) {
        if(!legacy[name]) continue;
        const oldRaw=localStorage.getItem(legacy[name]);
        const newRaw=localStorage.getItem(STORAGE[name]);
        if (oldRaw && !newRaw) {
          try {
            const parsed=safeParseJSON(oldRaw);
            requireStorageWrite(STORAGE[name],parsed);
            count += Array.isArray(parsed) ? parsed.length : 1;
            sources.add(legacy.version);
          } catch (err) { failures++;log(`Legacy ${name} migration held for retry: ${err.message}`,'WARN'); }
        }
      }
    }
    const source=sources.size?[...sources].join(', '):'none';
    const markerSaved=failures===0&&storageWrite(STORAGE.migration,{completed_at:nowISO(),source,items:count,complete:true});
    if (count&&markerSaved) log(`Migrated ${count} local records from ${source} without deleting the originals.`,'PASS');
    if(!markerSaved)log(`Legacy migration remains incomplete${failures?` after ${failures} held area(s)`:''}; it will retry on the next launch.`,'WARN');
    return {migrated:Boolean(count&&markerSaved),count,source,failures,marker_saved:markerSaved};
  }

  function downloadBlob(filename,data,type='application/octet-stream'){
    const blob=data instanceof Blob?data:new Blob([data],{type});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=filename; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000); log(`Exported ${filename}`,'PASS');
  }
  function downloadDataURL(filename,dataURL){ const a=document.createElement('a'); a.href=dataURL; a.download=filename; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); log(`Exported ${filename}`,'PASS'); }
  function toast(message){ const el=document.getElementById('toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2800); }
  function log(message,level='INFO'){ state.sessionLog.unshift({time:nowISO(),level,message:safeText(message,500)}); state.sessionLog=state.sessionLog.slice(0,120); window.dispatchEvent(new CustomEvent('axm:log')); }

  function getExtensions(includeInactive=true){
    const list=storageRead(STORAGE.extensions,[]);
    return includeInactive ? list : list.filter(item=>item.extension_state==='ACTIVE' && item.approval_state==='APPROVED');
  }
  function getAllMolds(options={}){
    const includeInactive=Boolean(options.includeInactive);
    return [...clone(REG.molds),...clone(getExtensions(includeInactive))];
  }
  function findMold(id){ return REG.molds.find(m=>m.id===id) || getExtensions(true).find(m=>m.id===id) || null; }
  function isMoldUsable(mold){ return Boolean(mold)&&(mold.source_kind!=='extension'||(mold.extension_state==='ACTIVE'&&mold.approval_state==='APPROVED')); }
  function getMold(id=state.moldId){ const mold=findMold(id); return isMoldUsable(mold)?mold:REG.molds[0]; }
  function getOrgan(id){ return REG.organs.find(o=>o.id===id) || null; }

  function getLocalThemes(includeInactive=true){
    const list=storageRead(STORAGE.themes,[]);
    return includeInactive ? list : list.filter(item=>item.theme_state==='ACTIVE'&&item.approval_state==='APPROVED');
  }
  function getAllThemes(options={}){
    const includeInactive=Boolean(options.includeInactive);
    return [...clone(REG.themes||[]),...clone(getLocalThemes(includeInactive))];
  }
  function findTheme(id){ return (REG.themes||[]).find(t=>t.id===id) || getLocalThemes(true).find(t=>t.id===id) || null; }
  function isThemeUsable(theme){ return Boolean(theme)&&(theme.source_kind!=='local-theme'||(theme.theme_state==='ACTIVE'&&theme.approval_state==='APPROVED')); }
  function getTheme(id=state.variant.theme){ const theme=findTheme(id); return isThemeUsable(theme)?theme:(REG.themes?.[0]||null); }
  function themeCompatibleWithMold(theme,mold){
    if(!theme||!mold)return false;
    if(theme.source_kind!=='local-theme')return (mold.variants?.theme||[]).includes(theme.id);
    const compatible=theme.compatible_renderers||[];
    return isThemeUsable(theme)&&(compatible.includes('*')||compatible.includes(mold.renderer));
  }
  function variantValues(mold,axis){
    const declared=[...(mold?.variants?.[axis]||[])];
    if(axis!=='theme')return declared;
    const additions=getLocalThemes(false).filter(theme=>themeCompatibleWithMold(theme,mold)).map(theme=>theme.id);
    return [...new Set([...declared,...additions])];
  }
  function defaultControls(mold){
    const out={};
    Object.entries(mold.inputs||{}).forEach(([key,spec])=>{
      out[key]=spec.default ?? (spec.type==='number' ? spec.minimum ?? 0 : spec.type==='boolean' ? false : spec.type==='enum' ? spec.values?.[0] ?? '' : '');
    });
    return out;
  }
  function defaultVariant(mold){ return Object.fromEntries(Object.keys(mold.variants||{}).map(axis=>[axis,variantValues(mold,axis)[0]])); }
  function setMold(id,preserve=false){
    const mold=getMold(id); state.moldId=mold.id;
    if(!preserve) state.controls=defaultControls(mold);
    Object.keys(mold.variants||{}).forEach(axis=>{const values=variantValues(mold,axis);if(!values.includes(state.variant[axis]))state.variant[axis]=values[0];});
    log(`Selected mold ${mold.name}`); window.dispatchEvent(new CustomEvent('axm:mold-change')); return mold;
  }
  function resolvePreset(preset){
    const parent=findMold(preset.parent); if(!parent)throw new Error(`Missing parent mold: ${preset.parent}`); if(!isMoldUsable(parent))throw new Error(`Preset parent is not active: ${preset.parent}`);
    const controls=defaultControls(parent), variant=defaultVariant(parent), overrides=preset.sparse_overrides||{};
    Object.keys(controls).forEach(key=>{if(key in overrides)controls[key]=overrides[key]});
    Object.keys(variant).forEach(axis=>{if(axis in overrides)variant[axis]=overrides[axis]});
    if(variant.theme){const theme=findTheme(variant.theme);if(!theme||!themeCompatibleWithMold(theme,parent))throw new Error(`Preset theme is unavailable or inactive: ${variant.theme}`)}
    return {mold:parent,controls,variant};
  }
  function applyPreset(preset){ const resolved=resolvePreset(preset); state.moldId=resolved.mold.id; state.controls=resolved.controls; state.variant={...state.variant,...resolved.variant}; log(`Applied preset ${preset.name}`,'PASS'); window.dispatchEvent(new CustomEvent('axm:mold-change')); return resolved; }
  function buildSparseOverrides(mold,controls,variant){
    const base=defaultControls(mold), defaults=defaultVariant(mold), out={};
    Object.entries(controls).forEach(([key,value])=>{if(JSON.stringify(value)!==JSON.stringify(base[key]))out[key]=value});
    Object.entries(variant).forEach(([axis,value])=>{if(axis in defaults && defaults[axis]!==value)out[axis]=value});
    return out;
  }
  function saveCurrentPreset(name,status='EXPERIMENTAL'){
    const mold=getMold(), presets=storageRead(STORAGE.presets,[]);
    const preset={schema:'axm.visual-preset/0.5',id:uid('axm.local.preset'),name:safeText(name||`${mold.name} preset`,100),version:'0.5.0',parent:mold.id,sparse_overrides:buildSparseOverrides(mold,state.controls,state.variant),approval_state:status,public_scope:'private',provenance:{author:'Local AXM user',source:`${APP.name} v${APP.version} local session`,license:'user-controlled',rights_scope:'private-local',consent:'explicit local save',transformation_history:['saved from current editor state']},created_at:nowISO(),updated_at:nowISO(),status:'BUILT'};
    presets.unshift(preset); requireStorageWrite(STORAGE.presets,presets); snapshot('preset-save',preset,{required:false}); log(`Saved preset ${preset.name}`,'PASS'); return preset;
  }
  function updateStoredPreset(id,patch){ const presets=storageRead(STORAGE.presets,[]),i=presets.findIndex(p=>p.id===id); if(i<0)return false; presets[i]={...presets[i],...clone(patch),updated_at:nowISO()}; requireStorageWrite(STORAGE.presets,presets); snapshot('preset-update',presets[i],{required:false}); return true; }
  function duplicatePreset(preset){ const copy={...clone(preset),schema:'axm.visual-preset/0.5',id:uid('axm.local.preset'),name:`${safeText(preset.name,90)} copy`,version:'0.5.0',approval_state:'EXPERIMENTAL',created_at:nowISO(),updated_at:nowISO()}; const presets=storageRead(STORAGE.presets,[]); presets.unshift(copy); requireStorageWrite(STORAGE.presets,presets); snapshot('preset-duplicate',copy,{required:false}); return copy; }
  function importPreset(raw){
    const source=typeof raw==='string'?safeParseJSON(raw):clone(raw);
    if(!source||!['axm.visual-preset/0.1','axm.visual-preset/0.2','axm.visual-preset/0.3','axm.visual-preset/0.4','axm.visual-preset/0.5'].includes(source.schema)||!source.parent||!source.sparse_overrides)throw new Error('Not a valid AXM visual preset.');
    if(!findMold(source.parent))throw new Error(`Missing parent mold: ${source.parent}`);
    source.schema='axm.visual-preset/0.5'; source.id=uid('axm.imported.preset'); source.name=safeText(source.name||'Imported preset',100); source.approval_state='EXPERIMENTAL'; source.public_scope='private'; source.created_at=nowISO(); source.updated_at=nowISO();
    const presets=storageRead(STORAGE.presets,[]); presets.unshift(source); requireStorageWrite(STORAGE.presets,presets); snapshot('preset-import',source,{required:false}); return source;
  }

  function stateFingerprint(moldId,controls,variant){
    const text=JSON.stringify({moldId,controls,variant}); let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function canonicalValue(value){
    if(Array.isArray(value))return value.map(canonicalValue);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalValue(value[key])]));
    return value;
  }
  function fingerprintValue(value){
    const source=JSON.stringify(canonicalValue(value));let hash=2166136261;
    for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function attachPacketIntegrity(packet,note='Deterministic local fingerprint; not a cryptographic signature.'){
    const copy=clone(packet);delete copy.integrity;
    return {...copy,integrity:{algorithm:'FNV-1a-32',fingerprint:fingerprintValue(copy),scope:'packet without integrity field',cryptographic_signature:false,note:safeText(note,300)}};
  }
  function verifyPacketIntegrity(packet){
    if(!packet?.integrity?.fingerprint)return {status:'MISSING',expected:null,actual:null};
    if(packet.integrity.algorithm!=='FNV-1a-32')return {status:'FAIL',expected:packet.integrity.fingerprint,actual:null,algorithm:packet.integrity.algorithm||'missing',error:'Unsupported or mislabeled integrity algorithm.'};
    const copy=clone(packet),expected=copy.integrity.fingerprint;delete copy.integrity;const actual=fingerprintValue(copy);
    return {status:expected===actual?'PASS':'FAIL',expected,actual,algorithm:packet.integrity.algorithm||'unknown'};
  }
  function themeValidation(theme,approvalOverride=null){
    const target=clone(theme||{});if(approvalOverride)target.approval_state=approvalOverride;
    const checks=[],add=(state,label,evidence)=>checks.push({state,label,evidence});
    const required=['id','name','material_language','surface','surface_2','panel','text','muted','accent','accent_2','warning','success','line','shadow','glow_rgb','contrast_target','motion_character','low_power_fallback','compatible_renderers','provenance'];
    const missing=required.filter(key=>target[key]===undefined||target[key]===null||target[key]==='');
    add(missing.length?'FAIL':'PASS','Theme manifest',missing.length?`Missing fields: ${missing.join(', ')}`:`All ${required.length} required fields are present.`);
    const duplicates=[...(REG.themes||[]),...getLocalThemes(true).filter(item=>item.id!==target.id)].filter(item=>item.id===target.id);
    add(duplicates.length?'FAIL':'PASS','Theme ID uniqueness',duplicates.length?`Duplicate theme ID: ${target.id}`:`${target.id||'draft'} is unique.`);
    const hexKeys=['surface','surface_2','text','muted','accent','accent_2','warning','success'];
    const invalidHex=hexKeys.filter(key=>!/^#[0-9a-f]{6}$/i.test(String(target[key]||'')));
    const cssKeys=['panel','line','shadow'],cssPattern=/^(#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?))?\s*\))$/i;
    const invalidCss=cssKeys.filter(key=>!cssPattern.test(String(target[key]||'')));
    const glowParts=String(target.glow_rgb||'').split(',').map(x=>Number(x.trim())),glowValid=glowParts.length===3&&glowParts.every(x=>Number.isInteger(x)&&x>=0&&x<=255);
    add(invalidHex.length||invalidCss.length||!glowValid?'FAIL':'PASS','Theme color grammar',invalidHex.length||invalidCss.length||!glowValid?`Invalid: ${[...invalidHex,...invalidCss,...(!glowValid?['glow_rgb']:[])].join(', ')}`:'Semantic colors use local declarative values only.');
    const ratio=contrastRatio(target.text,target.surface),targetRatio=Math.max(4.5,Number(target.contrast_target||4.5));
    add(ratio===null?'WARN':ratio<4.5?'FAIL':ratio<targetRatio?'WARN':'PASS','Theme contrast',ratio===null?'Contrast could not be calculated.':`${ratio.toFixed(2)}:1 against target ${targetRatio.toFixed(1)}:1.`);
    const renderers=Array.isArray(target.compatible_renderers)?target.compatible_renderers:[],allowed=new Set(REG.schema.allowed_renderers||['card','living-skin','portal-scene']),badRenderers=renderers.filter(item=>item!=='*'&&!allowed.has(item));
    add(!renderers.length||badRenderers.length?'FAIL':'PASS','Renderer compatibility',!renderers.length?'At least one compatible renderer is required.':badRenderers.length?`Unknown renderers: ${badRenderers.join(', ')}`:`Compatible with ${renderers.join(', ')}.`);
    const parentId=target.lineage?.parent||target.parent_theme||null,parent=parentId?findTheme(parentId):null;
    add(parentId&&!parent?'FAIL':'PASS','Theme lineage',parentId&&!parent?`Parent theme is missing: ${parentId}`:`Parent: ${parentId||'local root'}.`);
    const allowedStates=new Set(['QUARANTINED','ACTIVE','DEPRECATED','ARCHIVED']),themeState=target.theme_state||'QUARANTINED';
    add(!allowedStates.has(themeState)||(themeState==='ACTIVE'&&target.approval_state!=='APPROVED')?'FAIL':'PASS','Theme registry state',!allowedStates.has(themeState)?`Unknown state: ${themeState}`:themeState==='ACTIVE'&&target.approval_state!=='APPROVED'?'ACTIVE themes require explicit approval.':`State is explicit: ${themeState}.`);
    const forbiddenKeys=[];const scan=value=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(['script','javascript','code','shader','executable','remote_asset','font_file','url'].includes(key.toLowerCase()))forbiddenKeys.push(key);scan(item)}};scan(target);
    add(forbiddenKeys.length?'FAIL':'PASS','Declarative-only boundary',forbiddenKeys.length?`Executable or remote fields rejected: ${[...new Set(forbiddenKeys)].join(', ')}`:'No executable code, remote asset, or font-file fields are present.');
    const provenance=target.provenance||{},missingProvenance=['author','source','license','rights_scope','consent','transformation_history'].filter(key=>!provenance[key]);
    add(missingProvenance.length?'FAIL':'PASS','Theme provenance',missingProvenance.length?`Missing: ${missingProvenance.join(', ')}`:'Author, source, rights, consent, and transformation history are recorded.');
    const publicRights=target.public_scope!=='public-safe'||String(provenance.rights_scope||'').toLowerCase().includes('public');
    add(publicRights?'PASS':'FAIL','Public-safe rights',publicRights?`Scope remains explicit: ${target.public_scope||'private'}.`:'Public-safe theme lacks a public rights scope.');
    const ranges=[['glass',target.glass,0,1],['paper_noise',target.paper_noise,0,1],['contrast_target',target.contrast_target,4.5,21]],badRanges=ranges.filter(([,value,min,max])=>Number.isNaN(Number(value))||Number(value)<min||Number(value)>max);
    add(badRanges.length?'FAIL':'PASS','Theme numeric ranges',badRanges.length?badRanges.map(([key,value,min,max])=>`${key}=${value} outside ${min}..${max}`).join('; '):'Glass, noise, and contrast values remain inside declared bounds.');
    const summary=checks.reduce((acc,check)=>(acc[check.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0});
    return {schema:'axm.theme-validation/0.5',theme_id:target.id||null,checked_at:nowISO(),status:summary.fail?'FAIL':summary.warn?'WARN':'PASS',summary,checks};
  }
  function upsertTheme(theme){
    const list=storageRead(STORAGE.themes,[]),copy=clone(theme),index=list.findIndex(item=>item.id===copy.id);
    if(index>=0)list[index]=copy;else list.unshift(copy);requireStorageWrite(STORAGE.themes,list);window.dispatchEvent(new CustomEvent('axm:theme-change'));return copy;
  }
  function buildThemeDraft(baseOrId,fields={}){
    const base=typeof baseOrId==='string'?findTheme(baseOrId):baseOrId;if(!base)throw new Error('Base theme not found.');
    const name=safeText(fields.name||`${base.name} Child`,100),now=nowISO(),draft={...clone(base),...clone(fields)};
    draft.schema='axm.visual-theme/0.5';draft.id=fields.id||uid(`axm.theme.${slugify(name)}`);draft.name=name;draft.version='0.5.0';draft.source_kind='local-theme';draft.status='EXPERIMENTAL';draft.approval_state='EXPERIMENTAL';draft.theme_state='QUARANTINED';draft.local_only=true;draft.parent_theme=base.id;draft.lineage={parent:base.id,derived_from:[`${base.id}@${base.version||'core'}`],change_policy:'explicit-approval'};draft.compatible_renderers=Array.isArray(fields.compatible_renderers)&&fields.compatible_renderers.length?fields.compatible_renderers:['card','living-skin','portal-scene'];draft.created_at=fields.created_at||now;draft.updated_at=now;draft.provenance={author:safeText(fields.provenance?.author||'Local AXM user',120),source:base.id,license:safeText(fields.provenance?.license||'user-controlled',100),rights_scope:safeText(fields.provenance?.rights_scope||(fields.public_scope==='public-safe'?'public-safe-user-controlled':'private-local'),120),consent:'explicit local theme derivation',transformation_history:[...(base.provenance?.transformation_history||[]),...(fields.provenance?.transformation_history||[]),`derived declaratively in Theme Foundry v${APP.version}`]};
    return draft;
  }
  function saveThemeDraft(theme){
    const copy=clone(theme);copy.schema='axm.visual-theme/0.5';copy.version='0.5.0';copy.source_kind='local-theme';copy.theme_state='QUARANTINED';copy.approval_state='EXPERIMENTAL';copy.status='EXPERIMENTAL';copy.updated_at=nowISO();
    const report=themeValidation(copy);if(report.summary.fail)throw new Error('Theme save blocked by validation failures.');copy.validation=report;upsertTheme(copy);snapshot('theme-save',copy,{required:false});log(`Saved theme ${copy.name} into quarantine.`,'PASS');return copy;
  }
  function approveTheme(id){
    const theme=getLocalThemes(true).find(item=>item.id===id);if(!theme)throw new Error('Local theme not found.');const copy=clone(theme);copy.approval_state='APPROVED';copy.approved_at=nowISO();copy.approval_method='explicit-theme-registry-action';copy.updated_at=nowISO();const report=themeValidation(copy,'APPROVED');if(report.summary.fail)throw new Error('Theme approval blocked by validation failures.');copy.validation=report;upsertTheme(copy);snapshot('theme-approve',copy,{required:false});return copy;
  }
  function setThemeState(id,nextState){
    const theme=getLocalThemes(true).find(item=>item.id===id);if(!theme)throw new Error('Local theme not found.');const allowed=new Set(['ACTIVE','QUARANTINED','DEPRECATED','ARCHIVED']);if(!allowed.has(nextState))throw new Error(`Unsupported theme state: ${nextState}`);const copy=clone(theme);
    if(nextState==='ACTIVE'){
      if(copy.approval_state!=='APPROVED'||copy.approval_method!=='explicit-theme-registry-action')throw new Error('Theme requires explicit approval before activation.');
      const parentId=copy.lineage?.parent||copy.parent_theme,parent=parentId?findTheme(parentId):null;
      if(parent?.source_kind==='local-theme'&&!isThemeUsable(parent))throw new Error(`Theme activation blocked until parent theme is ACTIVE: ${parentId}`);
      const report=themeValidation(copy,'APPROVED');if(report.summary.fail)throw new Error('Theme activation blocked by validation failures.');copy.validation=report;copy.status='BUILT';copy.activated_at=nowISO();copy.activation_method='explicit-theme-registry-action';
    }
    else {
      const activeChildren=getLocalThemes(false).filter(item=>(item.lineage?.parent||item.parent_theme)===copy.id);
      const activeExtensions=getExtensions(false).filter(item=>(item.variants?.theme||[]).includes(copy.id));
      if(activeChildren.length)throw new Error(`Theme state change blocked: ${activeChildren.length} active child theme(s) depend on it.`);
      if(activeExtensions.length)throw new Error(`Theme state change blocked: ${activeExtensions.length} active extension(s) depend on it.`);
      if(nextState==='QUARANTINED'){copy.approval_state='EXPERIMENTAL';copy.status='EXPERIMENTAL';}
      else{copy.approval_state='DEPRECATED';copy.status='DEPRECATED';}
    }
    copy.theme_state=nextState;copy.updated_at=nowISO();upsertTheme(copy);
    if(nextState!=='ACTIVE'&&state.variant.theme===copy.id){const mold=getMold(),fallback=(mold.variants?.theme||[])[0]||REG.themes?.[0]?.id;state.variant.theme=fallback;window.dispatchEvent(new CustomEvent('axm:mold-change'));}
    snapshot(`theme-${nextState.toLowerCase()}`,copy,{required:false});log(`Theme ${copy.name} → ${nextState}`,'PASS');return copy;
  }
  function activateTheme(id){return setThemeState(id,'ACTIVE')}
  function deprecateTheme(id){return setThemeState(id,'DEPRECATED')}
  function archiveTheme(id){return setThemeState(id,'ARCHIVED')}
  function themePacket(themeOrId){
    const theme=typeof themeOrId==='string'?getLocalThemes(true).find(item=>item.id===themeOrId):themeOrId;if(!theme)throw new Error('Local theme not found.');
    return attachPacketIntegrity({schema:'axm.theme-package/0.5',version:'0.5.0',created_at:nowISO(),application:applicationMetadata(),theme:clone(theme),validation:themeValidation(theme),declarative_only:true},'Theme package fingerprint covers the declarative theme manifest and validation. Imports still enter quarantine.');
  }
  function exportThemePackage(themeOrId){const packet=themePacket(themeOrId),theme=packet.theme;downloadBlob(`${slugify(theme.name)}.axmtheme.json`,JSON.stringify(packet,null,2)+'\n','application/json');return packet}
  function importThemeRecord(source,origin='import'){
    if(!source||typeof source!=='object'||!source.name||!source.surface||!source.text)throw new Error('Theme manifest is missing required semantic color structure.');
    const originalId=source.id||uid('axm.unknown.theme'),parentId=source.lineage?.parent||source.parent_theme||null,base=findTheme(parentId)||REG.themes?.[0],copy=buildThemeDraft(base,{...clone(source),id:uid(`axm.theme.${slugify(source.name)}`),name:safeText(source.name,100),created_at:nowISO()});
    if(parentId&&!findTheme(parentId)){copy.parent_theme=parentId;copy.lineage={...(copy.lineage||{}),parent:parentId,derived_from:clone(source.lineage?.derived_from||[parentId]),change_policy:'explicit-approval'};}
    copy.imported_at=nowISO();copy.imported_from_id=originalId;copy.import_origin=safeText(origin,120);copy.theme_state='QUARANTINED';copy.approval_state='EXPERIMENTAL';copy.status='EXPERIMENTAL';copy.provenance={...(copy.provenance||{}),source:copy.provenance?.source||originalId,consent:'explicit local theme import',transformation_history:[...(copy.provenance?.transformation_history||[]),`imported into Theme Foundry quarantine v${APP.version}`]};
    const report=themeValidation(copy);copy.import_validation=report;upsertTheme(copy);snapshot('theme-import',copy,{required:false});log(`Imported theme ${copy.name} into quarantine.`,'WARN');return copy;
  }
  function importThemePackage(raw){
    const packet=typeof raw==='string'?safeParseJSON(raw):clone(raw);if(!packet||packet.schema!=='axm.theme-package/0.5'||!packet.theme)throw new Error('Not a valid AXM theme package.');const integrity=verifyPacketIntegrity(packet);if(integrity.status==='FAIL')throw new Error('Theme package integrity fingerprint does not match its contents.');const theme=importThemeRecord(packet.theme,'theme package');theme.import_integrity=integrity;upsertTheme(theme);return theme;
  }

  function coreIntegrityReport(){
    const currentMolds=REG.molds,moldChanged=[],moldMissing=[];
    for(const source of CORE_MOLDS){const live=currentMolds.find(item=>item.id===source.id);if(!live)moldMissing.push(source.id);else if(fingerprintValue(live)!==fingerprintValue(source))moldChanged.push(source.id)}
    const unexpectedMolds=currentMolds.filter(item=>!CORE_MOLDS.some(source=>source.id===item.id)).map(item=>item.id);
    const currentThemes=REG.themes||[],themeChanged=[],themeMissing=[];
    for(const source of CORE_THEMES){const live=currentThemes.find(item=>item.id===source.id);if(!live)themeMissing.push(source.id);else if(fingerprintValue(live)!==fingerprintValue(source))themeChanged.push(source.id)}
    const unexpectedThemes=currentThemes.filter(item=>!CORE_THEMES.some(source=>source.id===item.id)).map(item=>item.id);
    const changed=[...moldChanged,...themeChanged],missing=[...moldMissing,...themeMissing],unexpected=[...unexpectedMolds,...unexpectedThemes];
    return {status:changed.length||missing.length||unexpected.length?'FAIL':'PASS',core_count:CORE_MOLDS.length,theme_count:CORE_THEMES.length,changed,missing,unexpected,molds:{changed:moldChanged,missing:moldMissing,unexpected:unexpectedMolds},themes:{changed:themeChanged,missing:themeMissing,unexpected:unexpectedThemes},note:'Extensions and local themes are stored separately and are not appended to the protected package registries.'};
  }
  function healthReport(){
    const presets=storageRead(STORAGE.presets,[]),candidates=storageRead(STORAGE.candidates,[]),extensions=getExtensions(true),themes=getLocalThemes(true),snapshots=storageRead(STORAGE.snapshots,[]),checks=[];
    const add=(state,label,evidence)=>checks.push({state,label,evidence});
    const core=coreIntegrityReport();add(core.status,'Protected core registries',core.status==='PASS'?`${core.core_count} molds and ${core.theme_count} themes match their startup copies.`:`Changed ${core.changed.length}, missing ${core.missing.length}, unexpected ${core.unexpected.length}.`);
    const duplicateIds=[];const ids=[...presets,...candidates,...extensions,...themes,...snapshots].map(item=>item.id).filter(Boolean);ids.forEach((id,index)=>{if(ids.indexOf(id)!==index&&!duplicateIds.includes(id))duplicateIds.push(id)});add(duplicateIds.length?'FAIL':'PASS','Local record IDs',duplicateIds.length?`Duplicates: ${duplicateIds.join(', ')}`:`${ids.length} local record IDs are unique.`);
    const brokenPresets=presets.filter(item=>!findMold(item.parent)),blockedPresets=presets.filter(item=>findMold(item.parent)&&!isMoldUsable(findMold(item.parent))),blockedThemePresets=presets.filter(item=>item.sparse_overrides?.theme&&!isThemeUsable(findTheme(item.sparse_overrides.theme)));add(brokenPresets.length?'FAIL':blockedPresets.length||blockedThemePresets.length?'WARN':'PASS','Preset dependencies',brokenPresets.length?`${brokenPresets.length} preset parent(s) are missing.`:blockedPresets.length||blockedThemePresets.length?`${blockedPresets.length} preset(s) wait for extension activation; ${blockedThemePresets.length} wait for theme activation.`:`${presets.length} local presets resolve to usable molds and themes.`);
    const brokenCandidates=candidates.filter(item=>{const parent=item.lineage?.parent||item.parent;return parent&&!findMold(parent)});add(brokenCandidates.length?'FAIL':'PASS','Candidate parents',brokenCandidates.length?`${brokenCandidates.length} candidate parent(s) are missing.`:`${candidates.length} candidates retain resolvable lineage.`);
    const themeFailures=[],themeWarnings=[];themes.forEach(item=>{const report=themeValidation(item);if(report.summary.fail)themeFailures.push(item.id);else if(item.theme_state==='QUARANTINED'||report.summary.warn)themeWarnings.push(item.id)});add(themeFailures.length?'FAIL':themeWarnings.length?'WARN':'PASS','Local theme registry',themeFailures.length?`${themeFailures.length} theme(s) fail validation.`:themeWarnings.length?`${themeWarnings.length} theme(s) remain quarantined or warning-held.`:`${themes.length} local theme records are healthy.`);
    const extensionFailures=[],extensionWarnings=[];extensions.forEach(item=>{const report=extensionValidation(item);if(report.summary.fail)extensionFailures.push(item.id);else if(item.extension_state==='QUARANTINED'||report.summary.warn)extensionWarnings.push(item.id)});add(extensionFailures.length?'FAIL':extensionWarnings.length?'WARN':'PASS','Extension registry',extensionFailures.length?`${extensionFailures.length} extension(s) fail validation.`:extensionWarnings.length?`${extensionWarnings.length} extension(s) remain quarantined or warning-held.`:`${extensions.length} extension records are healthy.`);
    const brokenSnapshots=snapshots.filter(item=>!findMold(item.mold_id)),invalidSnapshots=snapshots.filter(item=>verifySnapshotIntegrity(item).status!=='PASS'),blockedSnapshots=snapshots.filter(item=>findMold(item.mold_id)&&!isMoldUsable(findMold(item.mold_id)));add(brokenSnapshots.length||invalidSnapshots.length?'FAIL':blockedSnapshots.length?'WARN':'PASS','Rollback snapshots',brokenSnapshots.length||invalidSnapshots.length?`${brokenSnapshots.length} snapshot mold(s) are missing; ${invalidSnapshots.length} snapshot fingerprint(s) fail.`:blockedSnapshots.length?`${blockedSnapshots.length} snapshot(s) reference inactive extensions.`:`${snapshots.length} snapshots remain restorable.`);
    const storageBytes=['presets','candidates','snapshots','extensions','themes','settings'].reduce((total,name)=>total+String(localStorage.getItem(STORAGE[name])||'').length*2,0);add(storageBytes>4_000_000?'WARN':'PASS','Local storage estimate',`${storageBytes.toLocaleString()} approximate UTF-16 bytes used by v0.9 records.`);
    const summary=checks.reduce((acc,check)=>(acc[check.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0});return attachPacketIntegrity({schema:'axm.health-report/0.5',created_at:nowISO(),summary,status:summary.fail?'FAIL':summary.warn?'WARN':'PASS',counts:{presets:presets.length,candidates:candidates.length,extensions:extensions.length,themes:themes.length,snapshots:snapshots.length},checks},'Health report fingerprint covers core, local themes, extensions, counts, and dependency checks; it is not a cryptographic signature.');
  }
  function exportHealthReport(){const report=healthReport();downloadBlob(`axm-visual-foundry-health-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(report,null,2)+'\n','application/json');return report}
  function snapshot(reason,payload=null,options={}){
    const snaps=storageRead(STORAGE.snapshots,[]);
    const snap={schema:'axm.visual-snapshot/0.5',id:uid('axm.snapshot'),created_at:nowISO(),reason:safeText(reason,80),mold_id:state.moldId,controls:clone(state.controls),variant:clone(state.variant),fingerprint:stateFingerprint(state.moldId,state.controls,state.variant),payload:payload?clone(payload):null,immutable:true};
    snaps.unshift(snap);const saved=storageWrite(STORAGE.snapshots,snaps.slice(0,80));
    if(!saved&&options.required!==false)throw new Error('Rollback snapshot was not persisted; the protected action was stopped.');
    log(saved?`Created rollback snapshot: ${reason}`:`Rollback snapshot not persisted: ${reason}`,saved?'PASS':'WARN');
    return {...snap,persisted:saved};
  }
  function getSnapshot(id){ return storageRead(STORAGE.snapshots,[]).find(s=>s.id===id)||null; }
  function verifySnapshotIntegrity(snap){const actual=stateFingerprint(snap?.mold_id,snap?.controls,snap?.variant);return {status:snap?.fingerprint&&snap.fingerprint===actual?'PASS':'FAIL',expected:snap?.fingerprint||null,actual};}
  function restoreSnapshot(id){ const snap=getSnapshot(id); if(!snap)throw new Error('Snapshot not found.');const integrity=verifySnapshotIntegrity(snap);if(integrity.status!=='PASS')throw new Error(`Snapshot integrity check failed: expected ${integrity.expected||'missing'}, calculated ${integrity.actual}.`); const target=findMold(snap.mold_id); if(!target)throw new Error(`Snapshot parent mold is unavailable: ${snap.mold_id}`); if(!isMoldUsable(target))throw new Error(`Snapshot mold is not active: ${snap.mold_id}`); snapshot('before-rollback',null,{required:true}); state.moldId=snap.mold_id; state.controls=clone(snap.controls); state.variant=clone(snap.variant); log(`Restored snapshot ${id}`,'PASS'); window.dispatchEvent(new CustomEvent('axm:mold-change')); return snap; }
  function stateDiff(left,right){
    const changes=[]; const walk=(a,b,path='')=>{
      const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);
      [...keys].sort().forEach(key=>{const pa=path?`${path}.${key}`:key,va=a?.[key],vb=b?.[key]; if(va&&vb&&typeof va==='object'&&typeof vb==='object'&&!Array.isArray(va)&&!Array.isArray(vb))walk(va,vb,pa); else if(JSON.stringify(va)!==JSON.stringify(vb))changes.push({path:pa,before:clone(va),after:clone(vb)});});
    };
    walk(left,right); return changes;
  }
  function compareWithSnapshot(id){ const snap=getSnapshot(id); if(!snap)throw new Error('Snapshot not found.'); return {snapshot:snap,current:{mold_id:state.moldId,controls:clone(state.controls),variant:clone(state.variant),fingerprint:stateFingerprint(state.moldId,state.controls,state.variant)},changes:stateDiff({mold_id:snap.mold_id,controls:snap.controls,variant:snap.variant},{mold_id:state.moldId,controls:state.controls,variant:state.variant})}; }

  function saveCandidate(candidate,options={}){ const list=storageRead(STORAGE.candidates,[]),copy=clone(candidate),idx=list.findIndex(x=>x.id===copy.id);if(idx>=0&&!options.update)throw new Error(`Candidate ID already exists: ${copy.id}. Use an explicit update action instead of replacing it silently.`);copy.updated_at=nowISO();if(idx>=0)list[idx]=copy;else list.unshift(copy); requireStorageWrite(STORAGE.candidates,list); snapshot(idx>=0?'candidate-update':'candidate-save',copy,{required:false}); return copy; }
  function getAllPresets(){ return [...clone(REG.presets),...storageRead(STORAGE.presets,[])]; }
  function getCandidates(){ return storageRead(STORAGE.candidates,[]); }
  function getSnapshots(){ return storageRead(STORAGE.snapshots,[]); }
  function setSettings(patch){ Object.assign(state,patch); requireStorageWrite(STORAGE.settings,{reducedMotion:state.reducedMotion,lowPower:state.lowPower,interfaceTheme:state.interfaceTheme,onboardingComplete:Boolean(state.onboardingComplete),lastSeenVersion:state.lastSeenVersion||null,lastSafetyCapsuleAt:state.lastSafetyCapsuleAt||null,lastReadinessReportAt:state.lastReadinessReportAt||null,lastRestoreAt:state.lastRestoreAt||null,targetBrowserValidatedAt:state.targetBrowserValidatedAt||null,targetBrowserValidationNote:state.targetBrowserValidationNote||null}); }
  function loadSettings(){ const saved=storageRead(STORAGE.settings,{}); Object.assign(state,{reducedMotion:saved.reducedMotion??state.reducedMotion,lowPower:saved.lowPower??false,interfaceTheme:saved.interfaceTheme||'dark',onboardingComplete:Boolean(saved.onboardingComplete),lastSeenVersion:saved.lastSeenVersion||null,lastSafetyCapsuleAt:saved.lastSafetyCapsuleAt||null,lastReadinessReportAt:saved.lastReadinessReportAt||null,lastRestoreAt:saved.lastRestoreAt||null,targetBrowserValidatedAt:saved.targetBrowserValidatedAt||null,targetBrowserValidationNote:saved.targetBrowserValidationNote||null}); }

  function upsertExtension(extension){
    const list=storageRead(STORAGE.extensions,[]),copy=clone(extension),index=list.findIndex(item=>item.id===copy.id);
    if(index>=0)list[index]=copy; else list.unshift(copy);
    requireStorageWrite(STORAGE.extensions,list); window.dispatchEvent(new CustomEvent('axm:registry-change')); return copy;
  }
  function extensionValidation(extension,approvalOverride=null){
    const target=clone(extension);
    if(approvalOverride) target.approval_state=approvalOverride;
    if(!window.AXMValidate) return {status:'WARN',summary:{pass:0,warn:1,fail:0},checks:[]};
    const extras=getExtensions(true).filter(item=>item.id!==target.id);
    return window.AXMValidate.validate(target,defaultControls(target),defaultVariant(target),{extraRegistry:extras,reducedMotion:state.reducedMotion});
  }
  function extensionReleaseGate(extensionOrId){
    const extension=typeof extensionOrId==='string'?getExtensions(true).find(item=>item.id===extensionOrId):extensionOrId;if(!extension)throw new Error('Extension not found.');
    const controls=defaultControls(extension),variant=defaultVariant(extension),proofCases=window.AXMExport?.proofCases?window.AXMExport.proofCases(extension,controls,variant):[{label:'Default',controls,variant}],proof=[],proofTarget={...clone(extension),approval_state:'EXPERIMENTAL',extension_state:'QUARANTINED'};
    const parentId=extension.lineage?.parent||extension.parent||null,parent=parentId?findMold(parentId):null,extras=getExtensions(true).filter(entry=>entry.id!==extension.id);
    const rank=status=>status==='FAIL'?2:status==='WARN'?1:0;
    for(const item of proofCases){
      const caseVariant={...item.variant,motion:item.variant.motion||'still'},context={extraRegistry:extras,reducedMotion:item.label==='Reduced motion'},report=window.AXMValidate.validate(proofTarget,item.controls,caseVariant,context);
      let baseline=null,regression=false;
      if(parent){baseline=window.AXMValidate.validate(parent,item.controls,caseVariant,{...context,extraRegistry:getExtensions(true).filter(entry=>entry.id!==parent.id)});regression=rank(report.status)>rank(baseline.status)}
      else regression=report.status==='FAIL';
      proof.push({label:item.label,status:report.status,summary:report.summary,baseline_status:baseline?.status||null,baseline_summary:baseline?.summary||null,regression});
    }
    const checks=[],add=(state,label,evidence)=>checks.push({state,label,evidence}),core=coreIntegrityReport();add(core.status,'Protected core integrity',core.status==='PASS'?`${core.core_count} molds and ${core.theme_count} themes match startup copies.`:'Protected core integrity failed.');
    add(parentId&&!parent?'FAIL':parent?.source_kind==='extension'&&!isMoldUsable(parent)?'FAIL':'PASS','Parent dependency',parentId&&!parent?`Missing parent: ${parentId}`:parent?.source_kind==='extension'&&!isMoldUsable(parent)?`Parent extension is not active: ${parentId}`:`Parent is usable: ${parentId||'local root'}.`);
    const missingOrgans=(extension.organs||[]).filter(id=>!getOrgan(id));add(missingOrgans.length?'FAIL':'PASS','Organ dependencies',missingOrgans.length?`Missing: ${missingOrgans.join(', ')}`:`${(extension.organs||[]).length} organ dependencies resolve.`);
    const themeIds=[...new Set(extension.variants?.theme||[])],missingThemes=[],inactiveThemes=[],incompatibleThemes=[];for(const id of themeIds){const theme=findTheme(id);if(!theme)missingThemes.push(id);else if(!isThemeUsable(theme))inactiveThemes.push(id);else if(!themeCompatibleWithMold(theme,extension))incompatibleThemes.push(id)}
    add(missingThemes.length||inactiveThemes.length||incompatibleThemes.length?'FAIL':'PASS','Theme dependencies',missingThemes.length||inactiveThemes.length||incompatibleThemes.length?`Missing: ${missingThemes.join(', ')||'none'}; inactive: ${inactiveThemes.join(', ')||'none'}; incompatible: ${incompatibleThemes.join(', ')||'none'}.`:`${themeIds.length} theme dependencies are active and compatible.`);
    const regressions=proof.filter(item=>item.regression),inheritedFails=proof.filter(item=>item.status==='FAIL'&&item.baseline_status==='FAIL'),warnings=proof.filter(item=>item.status==='WARN').length;
    add(regressions.length?'FAIL':inheritedFails.length||warnings?'WARN':'PASS','Proof matrix',regressions.length?`${regressions.length}/${proof.length} cases regress beyond the parent baseline.`:inheritedFails.length||warnings?`No regressions; ${inheritedFails.length} inherited stress failure(s) and ${warnings} warning case(s) remain visible.`:`All ${proof.length} cases pass without regression.`);
    const base=extensionValidation(extension,extension.approval_state);add(base.summary.fail?'FAIL':base.summary.warn?'WARN':'PASS','Base manifest validation',`${base.summary.pass} pass, ${base.summary.warn} warn, ${base.summary.fail} fail.`);
    const summary=checks.reduce((acc,check)=>(acc[check.state.toLowerCase()]++,acc),{pass:0,warn:0,fail:0});return attachPacketIntegrity({schema:'axm.extension-release-gate/0.5',extension_id:extension.id,parent_baseline:parent?.id||null,checked_at:nowISO(),status:summary.fail?'FAIL':summary.warn?'WARN':'PASS',summary,checks,proof_matrix:proof},'Release gate fingerprint covers core integrity, dependencies, parent-baseline comparison, base validation, and the proof matrix.');
  }
  function prepareExtensionRelease(id){const extension=getExtensions(true).find(item=>item.id===id);if(!extension)throw new Error('Extension not found.');const gate=extensionReleaseGate(extension),copy={...clone(extension),release_gate:gate,release_prepared_at:nowISO(),updated_at:nowISO()};upsertExtension(copy);snapshot('extension-release-gate',gate,{required:false});return gate}
  function promoteCandidate(candidateOrId){
    const candidateId=typeof candidateOrId==='string'?candidateOrId:candidateOrId?.id,candidate=getCandidates().find(item=>item.id===candidateId);
    if(!candidate)throw new Error('Candidate must be saved before promotion.');
    if(candidate.approval_state!=='APPROVED'||candidate.approval_method!=='explicit-human-button'||!candidate.approved_at)throw new Error('Candidate requires explicit recorded approval before promotion.');
    if(getExtensions(true).some(item=>item.origin_candidate_id===candidate.id&&item.extension_state!=='ARCHIVED'))throw new Error('This candidate already has a preserved local extension record.');
    const report=window.AXMValidate?.candidateFromText(JSON.stringify(candidate));if(report?.summary?.fail)throw new Error('Candidate promotion blocked by validation failures.');
    const parentId=candidate.lineage?.parent||candidate.parent||null;if(parentId&&!findMold(parentId))throw new Error(`Candidate parent is unavailable: ${parentId}`);
    const extension=clone(candidate);extension.schema='axm.visual-mold/0.5';extension.id=uid(`axm.extension.${slugify(candidate.name)}`);extension.version='0.5.0';extension.source_kind='extension';extension.source_manifest='local extension registry v0.9';extension.inherited_from=parentId;extension.lineage={...(candidate.lineage||{}),parent:parentId,derived_from:[...(candidate.lineage?.derived_from||[]),candidate.id],change_policy:'explicit-approval'};extension.approval_state='APPROVED';extension.approval_method='inherited-explicit-candidate-approval';extension.extension_state='QUARANTINED';extension.origin_candidate_id=candidate.id;extension.local_only=true;extension.installed_at=nowISO();extension.provenance={...(candidate.provenance||{}),source:candidate.id,consent:'explicit local candidate promotion',transformation_history:[...(candidate.provenance?.transformation_history||[]),'promoted to separate local extension registry v0.9 in quarantine']};
    const extensionReport=extensionValidation(extension,'APPROVED');if(extensionReport.summary.fail)throw new Error('Extension promotion blocked by extension validation failures.');extension.release_gate=extensionReleaseGate(extension);upsertExtension(extension);snapshot('extension-promote',extension,{required:false});log(`Promoted ${candidate.name} into extension quarantine; activation remains separate.`,'PASS');return extension;
  }
  function approveExtension(id){const extension=getExtensions(true).find(item=>item.id===id);if(!extension)throw new Error('Extension not found.');const copy=clone(extension);copy.approval_state='APPROVED';copy.approved_at=nowISO();copy.approval_method='explicit-extension-registry-approval';copy.updated_at=nowISO();const report=extensionValidation(copy,'APPROVED');if(report.summary.fail)throw new Error('Extension approval blocked by validation failures.');upsertExtension(copy);snapshot('extension-approve',copy,{required:false});return copy}
  function setExtensionState(id,nextState,acknowledgeWarnings=false){
    const extension=getExtensions(true).find(item=>item.id===id); if(!extension)throw new Error('Extension not found.');
    const allowed=new Set(['ACTIVE','DEPRECATED','ARCHIVED','QUARANTINED']); if(!allowed.has(nextState))throw new Error(`Unsupported extension state: ${nextState}`);
    const copy=clone(extension);
    if(nextState==='ACTIVE'){
      if(copy.approval_state!=='APPROVED'||!['inherited-explicit-candidate-approval','explicit-extension-registry-approval'].includes(copy.approval_method))throw new Error('Extension requires a separate explicit approval record before activation.');
      const gate=extensionReleaseGate(copy);if(gate.summary.fail)throw new Error('Activation blocked by release-gate failures.');if(gate.summary.warn&&!acknowledgeWarnings)throw new Error('Release gate has warnings; explicit warning acknowledgement is required.');copy.release_gate=gate;copy.release_warning_acknowledged=Boolean(gate.summary.warn&&acknowledgeWarnings);copy.activated_at=nowISO();copy.activation_method='explicit-extension-registry-action';
    } else {
      const activeChildren=getExtensions(false).filter(item=>(item.lineage?.parent||item.parent)===copy.id);
      if(activeChildren.length)throw new Error(`Extension state change blocked: ${activeChildren.length} active child extension(s) depend on it.`);
      if(nextState==='QUARANTINED')copy.approval_state=copy.approval_state==='APPROVED'?'APPROVED':'EXPERIMENTAL';
      else copy.approval_state='DEPRECATED';
    }
    copy.extension_state=nextState; copy.updated_at=nowISO();upsertExtension(copy);
    if(nextState!=='ACTIVE'&&state.moldId===copy.id){const parent=findMold(copy.lineage?.parent);setMold(isMoldUsable(parent)?parent.id:REG.molds[0].id)}
    snapshot(`extension-${nextState.toLowerCase()}`,copy,{required:false}); log(`Extension ${copy.name} → ${nextState}`,'PASS'); return copy;
  }
  function activateExtension(id,acknowledgeWarnings=false){ return setExtensionState(id,'ACTIVE',acknowledgeWarnings); }
  function deprecateExtension(id){ return setExtensionState(id,'DEPRECATED'); }
  function archiveExtension(id){ return setExtensionState(id,'ARCHIVED'); }
  function extensionPacket(extensionOrId){
    const extension=typeof extensionOrId==='string'?getExtensions(true).find(item=>item.id===extensionOrId):extensionOrId;
    if(!extension)throw new Error('Extension not found.');
    const themeIds=[...new Set(extension.variants?.theme||[])],localThemes=getLocalThemes(true).filter(theme=>themeIds.includes(theme.id));
    return attachPacketIntegrity({schema:'axm.extension-package/0.5',version:'0.5.0',created_at:nowISO(),application:applicationMetadata(),extension:clone(extension),dependencies:{organs:clone(extension.organs||[]),parent:extension.lineage?.parent||null,themes:clone(themeIds)},theme_summaries:clone(getAllThemes({includeInactive:true}).filter(theme=>themeIds.includes(theme.id))),local_themes:clone(localThemes),validation:extensionValidation(extension),release_gate:extension.release_gate||extensionReleaseGate(extension)},'Extension package fingerprint covers the manifest, dependencies, local declarative themes, validation, and release gate. Imported extensions and themes still enter quarantine.');
  }
  function exportExtensionPackage(extensionOrId){ const packet=extensionPacket(extensionOrId),extension=packet.extension; downloadBlob(`${slugify(extension.name)}.axmextension.json`,JSON.stringify(packet,null,2)+'\n','application/json'); return packet; }
  function importExtensionRecord(source,origin='import',themeMap=new Map()){
    if(!source||typeof source!=='object'||!source.name||!source.inputs||!source.variants||!source.renderer)throw new Error('Extension manifest is missing required visual mold structure.');
    const originalId=source.id||uid('axm.unknown.extension'),copy=clone(source);
    copy.schema='axm.visual-mold/0.5';copy.id=uid(`axm.extension.${slugify(copy.name)}`);copy.version='0.5.0';copy.source_kind='extension';copy.source_manifest=`local extension import · ${safeText(origin,80)}`;copy.approval_state='EXPERIMENTAL';copy.extension_state='QUARANTINED';copy.local_only=true;copy.imported_at=nowISO();copy.imported_from_id=originalId;copy.import_origin=safeText(origin,120);copy.release_gate=null;delete copy.activated_at;delete copy.activation_method;
    if(Array.isArray(copy.variants?.theme))copy.variants.theme=copy.variants.theme.map(id=>themeMap.get(id)||id);
    copy.provenance={...(copy.provenance||{}),source:copy.provenance?.source||originalId,consent:'explicit local extension import',transformation_history:[...(copy.provenance?.transformation_history||[]),'imported into quarantine in local extension registry v0.9']};
    const report=extensionValidation(copy);copy.import_validation={status:report.status,summary:report.summary,checked_at:nowISO()};upsertExtension(copy);snapshot('extension-import',copy,{required:false});log(`Imported extension ${copy.name} into quarantine.`,'WARN');return copy;
  }
  function importExtensionPackage(raw){
    const packet=typeof raw==='string'?safeParseJSON(raw):clone(raw);
    if(!packet||!['axm.extension-package/0.4','axm.extension-package/0.5'].includes(packet.schema)||!packet.extension)throw new Error('Not a valid AXM extension package.');
    const integrity=verifyPacketIntegrity(packet);if(integrity.status==='FAIL')throw new Error('Extension package integrity fingerprint does not match its contents.');
    const themeMap=new Map(),themePairs=[];
    for(const source of packet.local_themes||[]){const theme=importThemeRecord(source,'extension package');themeMap.set(source.id,theme.id);themePairs.push({source,theme})}
    themePairs.forEach(({source,theme})=>{const oldParent=source.lineage?.parent||source.parent_theme,newParent=themeMap.get(oldParent);if(newParent)upsertTheme({...theme,parent_theme:newParent,lineage:{...(theme.lineage||{}),parent:newParent},updated_at:nowISO()})});
    const extension=importExtensionRecord(packet.extension,'extension package',themeMap);extension.import_integrity=integrity;extension.imported_theme_ids=[...themeMap.values()];upsertExtension(extension);
    if(integrity.status==='MISSING')log(`Extension package ${extension.name} had no integrity fingerprint; quarantine preserved.`,'WARN');
    return extension;
  }

  function workspacePacket(){
    return attachPacketIntegrity({schema:'axm.visual-workspace/0.5',version:'0.5.0',created_at:nowISO(),application:applicationMetadata(),current:{mold_id:state.moldId,controls:clone(state.controls),variant:clone(state.variant)},presets:storageRead(STORAGE.presets,[]),candidates:storageRead(STORAGE.candidates,[]),extensions:storageRead(STORAGE.extensions,[]),themes:storageRead(STORAGE.themes,[]),snapshots:storageRead(STORAGE.snapshots,[]),settings:storageRead(STORAGE.settings,{})},'Workspace fingerprint covers current state, local themes, presets, candidates, extensions, snapshots, and settings. Imports still merge into new local IDs.');
  }
  function exportWorkspace(){ const packet=workspacePacket(); downloadBlob(`axm-visual-workspace-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(packet,null,2)+'\n','application/json'); return packet; }
  function importWorkspace(raw){
    const packet=typeof raw==='string'?safeParseJSON(raw):clone(raw);
    if(!packet||!['axm.visual-workspace/0.2','axm.visual-workspace/0.3','axm.visual-workspace/0.4','axm.visual-workspace/0.5','axm.visual-workspace/0.6'].includes(packet.schema)||!packet.current)throw new Error('Not a valid AXM workspace packet.');
    const integrity=verifyPacketIntegrity(packet);if(packet.schema==='axm.visual-workspace/0.6'&&integrity.status!=='PASS')throw new Error('Current workspace packets require a valid integrity fingerprint.');if(['axm.visual-workspace/0.4','axm.visual-workspace/0.5'].includes(packet.schema)&&integrity.status==='FAIL')throw new Error('Workspace integrity fingerprint does not match its contents.');
    snapshot('before-workspace-import',null,{required:true});
    const imported={themes:0,extensions:0,presets:0,candidates:0,snapshots:0,skipped:0},themeMap=new Map(),themePairs=[],idMap=new Map(),extensionPairs=[];
    for(const source of packet.themes||[]){try{const item=importThemeRecord(source,'workspace import');themeMap.set(source.id,item.id);themePairs.push({source,item});imported.themes++;}catch(err){imported.skipped++;log(`Workspace theme skipped: ${err.message}`,'WARN')}}
    themePairs.forEach(({source,item})=>{const oldParent=source.lineage?.parent||source.parent_theme,newParent=themeMap.get(oldParent);if(newParent)upsertTheme({...item,parent_theme:newParent,lineage:{...(item.lineage||{}),parent:newParent},updated_at:nowISO()})});
    for(const source of packet.extensions||[]){try{const item=importExtensionRecord(source,'workspace import',themeMap);idMap.set(source.id,item.id);extensionPairs.push({source,item});imported.extensions++;}catch(err){imported.skipped++;log(`Workspace extension skipped: ${err.message}`,'WARN')}}
    extensionPairs.forEach(({source,item})=>{const oldParent=source.lineage?.parent||source.parent,newParent=idMap.get(oldParent);let updated=item;if(newParent)updated={...item,lineage:{...(item.lineage||{}),parent:newParent},inherited_from:newParent};const report=extensionValidation(updated);updated={...updated,import_validation:{status:report.status,summary:report.summary,checked_at:nowISO()}};upsertExtension(updated)});
    for(const source of packet.presets||[]){
      const p=clone(source);p.id=uid('axm.workspace.preset');p.schema='axm.visual-preset/0.5';p.parent=idMap.get(p.parent)||p.parent;p.approval_state='EXPERIMENTAL';p.public_scope='private';p.updated_at=nowISO();if(p.sparse_overrides?.theme)p.sparse_overrides.theme=themeMap.get(p.sparse_overrides.theme)||p.sparse_overrides.theme;
      if(!findMold(p.parent)){imported.skipped++;continue}const list=storageRead(STORAGE.presets,[]);list.unshift(p);requireStorageWrite(STORAGE.presets,list);imported.presets++;
    }
    for(const source of packet.candidates||[]){
      const c=clone(source);c.id=uid('axm.workspace.candidate');c.approval_state='EXPERIMENTAL';c.updated_at=nowISO();if(c.lineage?.parent)c.lineage.parent=idMap.get(c.lineage.parent)||c.lineage.parent;if(c.parent)c.parent=idMap.get(c.parent)||c.parent;if(Array.isArray(c.variants?.theme))c.variants.theme=c.variants.theme.map(id=>themeMap.get(id)||id);if(c.sparse_overrides?.theme)c.sparse_overrides.theme=themeMap.get(c.sparse_overrides.theme)||c.sparse_overrides.theme;const list=storageRead(STORAGE.candidates,[]);list.unshift(c);requireStorageWrite(STORAGE.candidates,list);imported.candidates++;
    }
    for(const source of (packet.snapshots||[]).slice(0,30)){
      const s=clone(source);s.id=uid('axm.workspace.snapshot');s.mold_id=idMap.get(s.mold_id)||s.mold_id;s.reason=`Imported · ${safeText(s.reason,60)}`;s.immutable=true;if(s.variant?.theme)s.variant.theme=themeMap.get(s.variant.theme)||s.variant.theme;if(!findMold(s.mold_id)){imported.skipped++;continue}s.fingerprint=stateFingerprint(s.mold_id,s.controls,s.variant);const list=storageRead(STORAGE.snapshots,[]);list.unshift(s);requireStorageWrite(STORAGE.snapshots,list.slice(0,80));imported.snapshots++;
    }
    const desired=idMap.get(packet.current.mold_id)||packet.current.mold_id,desiredMold=findMold(desired),desiredVariant=clone(packet.current.variant||{});if(desiredVariant.theme)desiredVariant.theme=themeMap.get(desiredVariant.theme)||desiredVariant.theme;
    if(desiredMold&&isMoldUsable(desiredMold)){state.moldId=desired;state.controls=clone(packet.current.controls||defaultControls(desiredMold));state.variant={...state.variant,...desiredVariant};if(!themeCompatibleWithMold(findTheme(state.variant.theme),desiredMold))state.variant.theme=(desiredMold.variants?.theme||[])[0]||REG.themes?.[0]?.id;}
    snapshot('workspace-import-complete',imported,{required:false});window.dispatchEvent(new CustomEvent('axm:theme-change'));window.dispatchEvent(new CustomEvent('axm:registry-change'));window.dispatchEvent(new CustomEvent('axm:mold-change'));log(`Imported workspace: ${imported.themes} themes, ${imported.extensions} extensions, ${imported.presets} presets, ${imported.candidates} candidates, ${imported.snapshots} snapshots, ${imported.skipped} skipped.`,'PASS');return imported;
  }

  function familyRelatedIds(moldId){
    const ids=new Set(),all=getAllMolds({includeInactive:true});
    const addUp=id=>{if(!id||ids.has(id))return;ids.add(id);const mold=findMold(id);if(mold?.lineage?.parent)addUp(mold.lineage.parent)};
    const addDown=id=>{all.filter(m=>m.lineage?.parent===id).forEach(child=>{if(!ids.has(child.id)){ids.add(child.id);addDown(child.id)}})};
    addUp(moldId);addDown(moldId);return [...ids];
  }
  function familyPacket(mold=getMold(),controls=state.controls,variant=state.variant){
    const focus=mold||getMold(),familyIds=familyRelatedIds(focus.id),familyMolds=getAllMolds({includeInactive:true}).filter(item=>familyIds.includes(item.id)),localPresets=storageRead(STORAGE.presets,[]).filter(item=>familyIds.includes(item.parent)),localCandidates=storageRead(STORAGE.candidates,[]).filter(item=>familyIds.includes(item.lineage?.parent||item.parent||item.id)),localExtensions=storageRead(STORAGE.extensions,[]).filter(item=>familyIds.includes(item.id)),snapshots=storageRead(STORAGE.snapshots,[]).filter(item=>familyIds.includes(item.mold_id)).slice(0,24);
    const themeIds=[...new Set([...familyMolds.flatMap(item=>item.variants?.theme||[]),variant.theme,...localPresets.map(item=>item.sparse_overrides?.theme)].filter(Boolean))],themeSummaries=getAllThemes({includeInactive:true}).filter(item=>themeIds.includes(item.id)),localThemes=getLocalThemes(true).filter(item=>themeIds.includes(item.id)),proof_summary=window.AXMValidate.validate(focus,controls,variant,{reducedMotion:state.reducedMotion,extraRegistry:getExtensions(true).filter(item=>item.id!==focus.id)});
    return attachPacketIntegrity({schema:'axm.family-package/0.5',version:'0.5.0',created_at:nowISO(),application:applicationMetadata(),focus_mold:focus.id,focus_instance:{controls:clone(controls),variant:clone(variant)},family_graph:familyMolds.map(item=>({id:item.id,name:item.name,parent:item.lineage?.parent||null,source_kind:item.source_kind,approval_state:item.approval_state,extension_state:item.extension_state||null})),family_molds:clone(familyMolds),local_presets:clone(localPresets),local_candidates:clone(localCandidates),local_extensions:clone(localExtensions),local_themes:clone(localThemes),snapshots:clone(snapshots),themes:clone(themeSummaries),proof_summary},'Family fingerprint covers the focus state, lineage graph, local themes, local extensions, presets, candidates, snapshots, and proof summary.');
  }
  function exportFamilyPackage(mold=getMold(),controls=state.controls,variant=state.variant){const packet=familyPacket(mold,controls,variant);downloadBlob(`${slugify(mold.name)}-family.axmfamily.json`,JSON.stringify(packet,null,2)+'\n','application/json');return packet}
  function importFamilyPackage(raw){
    const packet=typeof raw==='string'?safeParseJSON(raw):clone(raw);if(!packet||!['axm.family-package/0.3','axm.family-package/0.4','axm.family-package/0.5'].includes(packet.schema)||!packet.focus_mold)throw new Error('Not a valid AXM family package.');const integrity=verifyPacketIntegrity(packet);if(packet.schema==='axm.family-package/0.5'&&integrity.status!=='PASS')throw new Error('Current family packages require a valid integrity fingerprint.');if(packet.schema==='axm.family-package/0.4'&&integrity.status==='FAIL')throw new Error('Family package integrity fingerprint does not match its contents.');
    snapshot('before-family-import',null,{required:true});const imported={themes:0,extensions:0,presets:0,candidates:0,snapshots:0,skipped:0},themeMap=new Map(),themePairs=[],idMap=new Map(),extensionPairs=[];
    for(const source of packet.local_themes||[]){try{const item=importThemeRecord(source,'family import');themeMap.set(source.id,item.id);themePairs.push({source,item});imported.themes++;}catch(err){imported.skipped++;log(`Family theme skipped: ${err.message}`,'WARN')}}themePairs.forEach(({source,item})=>{const oldParent=source.lineage?.parent||source.parent_theme,newParent=themeMap.get(oldParent);if(newParent)upsertTheme({...item,parent_theme:newParent,lineage:{...(item.lineage||{}),parent:newParent},updated_at:nowISO()})});
    for(const source of packet.local_extensions||[]){try{const item=importExtensionRecord(source,'family import',themeMap);idMap.set(source.id,item.id);extensionPairs.push({source,item});imported.extensions++;}catch(err){imported.skipped++;log(`Family extension skipped: ${err.message}`,'WARN')}}extensionPairs.forEach(({source,item})=>{const oldParent=source.lineage?.parent||source.parent,newParent=idMap.get(oldParent);let updated=item;if(newParent)updated={...item,lineage:{...(item.lineage||{}),parent:newParent},inherited_from:newParent};const report=extensionValidation(updated);updated={...updated,import_validation:{status:report.status,summary:report.summary,checked_at:nowISO()}};upsertExtension(updated)});
    for(const source of packet.local_presets||[]){const p=clone(source);p.id=uid('axm.family.preset');p.schema='axm.visual-preset/0.5';p.parent=idMap.get(p.parent)||p.parent;p.approval_state='EXPERIMENTAL';p.public_scope='private';p.updated_at=nowISO();if(p.sparse_overrides?.theme)p.sparse_overrides.theme=themeMap.get(p.sparse_overrides.theme)||p.sparse_overrides.theme;if(!findMold(p.parent)){imported.skipped++;continue}const list=storageRead(STORAGE.presets,[]);list.unshift(p);requireStorageWrite(STORAGE.presets,list);imported.presets++}
    for(const source of packet.local_candidates||[]){const c=clone(source);c.id=uid('axm.family.candidate');c.approval_state='EXPERIMENTAL';c.updated_at=nowISO();c.imported_from_family=packet.focus_mold;if(c.lineage?.parent)c.lineage.parent=idMap.get(c.lineage.parent)||c.lineage.parent;if(c.parent)c.parent=idMap.get(c.parent)||c.parent;if(Array.isArray(c.variants?.theme))c.variants.theme=c.variants.theme.map(id=>themeMap.get(id)||id);if(c.sparse_overrides?.theme)c.sparse_overrides.theme=themeMap.get(c.sparse_overrides.theme)||c.sparse_overrides.theme;const list=storageRead(STORAGE.candidates,[]);list.unshift(c);requireStorageWrite(STORAGE.candidates,list);imported.candidates++}
    for(const source of (packet.snapshots||[]).slice(0,24)){const s=clone(source);s.id=uid('axm.family.snapshot');s.mold_id=idMap.get(s.mold_id)||s.mold_id;s.reason=`Family import · ${safeText(s.reason,60)}`;s.immutable=true;if(s.variant?.theme)s.variant.theme=themeMap.get(s.variant.theme)||s.variant.theme;if(!findMold(s.mold_id)){imported.skipped++;continue}s.fingerprint=stateFingerprint(s.mold_id,s.controls,s.variant);const list=storageRead(STORAGE.snapshots,[]);list.unshift(s);requireStorageWrite(STORAGE.snapshots,list.slice(0,80));imported.snapshots++}
    const focusId=idMap.get(packet.focus_mold)||packet.focus_mold,focus=findMold(focusId),focusVariant=clone(packet.focus_instance?.variant||{});if(focusVariant.theme)focusVariant.theme=themeMap.get(focusVariant.theme)||focusVariant.theme;if(focus&&isMoldUsable(focus)){state.moldId=focusId;state.controls=clone(packet.focus_instance?.controls||defaultControls(focus));state.variant={...state.variant,...focusVariant};if(!themeCompatibleWithMold(findTheme(state.variant.theme),focus))state.variant.theme=(focus.variants?.theme||[])[0]||REG.themes?.[0]?.id;}
    snapshot('family-import-complete',imported,{required:false});window.dispatchEvent(new CustomEvent('axm:theme-change'));window.dispatchEvent(new CustomEvent('axm:registry-change'));window.dispatchEvent(new CustomEvent('axm:mold-change'));log(`Imported family package: ${imported.themes} themes, ${imported.extensions} extensions, ${imported.presets} presets, ${imported.candidates} candidates, ${imported.snapshots} snapshots, ${imported.skipped} skipped.`,'PASS');return imported;
  }

  function hexToRgb(hex){ const h=String(hex).replace('#',''); if(!/^[0-9a-f]{6}$/i.test(h))return null; return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
  function luminance(hex){ const rgb=hexToRgb(hex); if(!rgb)return null; const channels=[rgb.r,rgb.g,rgb.b].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}); return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]; }
  function contrastRatio(a,b){ const l1=luminance(a),l2=luminance(b); if(l1===null||l2===null)return null; return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); }
  function formatDimensions(format){ return ({square:[780,780],portrait:[700,930],landscape:[1100,620],phone:[430,860],ultrawide:[1300,520]})[format]||[900,620]; }
  function performanceBudget(tier){ return ({low:{particles:12,effects:3,blur:10},standard:{particles:40,effects:7,blur:24},ultra:{particles:90,effects:12,blur:48}})[tier]||{particles:40,effects:7,blur:24}; }
  function effectivePerformance(){ return state.lowPower?'low':state.variant.performance; }
  function openJSON(title,data){ const dialog=document.getElementById('jsonDialog'); document.getElementById('dialogTitle').textContent=title; document.getElementById('dialogContent').textContent=JSON.stringify(data,null,2); dialog.showModal(); }

  migrateLegacyStorage(); loadSettings(); setMold(state.moldId);
  window.AXM={APP,REG,CORE_MOLDS,CORE_THEMES,STORAGE,LEGACY_STORAGE,LEGACY_STORAGES,state,clone,nowISO,runtimeOrigin,applicationMetadata,uid,slugify,clamp,lerp,mapRange,escapeHTML,sanitizeText,safeText,safeParseJSON,rawFingerprint,recoveryLedgerDirect,recordStorageIssue,clearStorageIssue,storageRead,storageWrite,requireStorageWrite,migrateLegacyStorage,downloadBlob,downloadDataURL,toast,log,getExtensions,getAllMolds,findMold,isMoldUsable,getMold,getOrgan,getLocalThemes,getAllThemes,findTheme,isThemeUsable,getTheme,themeCompatibleWithMold,variantValues,defaultControls,defaultVariant,setMold,resolvePreset,applyPreset,buildSparseOverrides,saveCurrentPreset,updateStoredPreset,duplicatePreset,importPreset,stateFingerprint,canonicalValue,fingerprintValue,attachPacketIntegrity,verifyPacketIntegrity,themeValidation,buildThemeDraft,saveThemeDraft,approveTheme,setThemeState,activateTheme,deprecateTheme,archiveTheme,themePacket,exportThemePackage,upsertTheme,importThemeRecord,importThemePackage,coreIntegrityReport,healthReport,exportHealthReport,snapshot,getSnapshot,verifySnapshotIntegrity,restoreSnapshot,stateDiff,compareWithSnapshot,saveCandidate,getAllPresets,getCandidates,getSnapshots,setSettings,extensionValidation,extensionReleaseGate,prepareExtensionRelease,promoteCandidate,approveExtension,setExtensionState,activateExtension,deprecateExtension,archiveExtension,extensionPacket,exportExtensionPackage,upsertExtension,importExtensionRecord,importExtensionPackage,workspacePacket,exportWorkspace,importWorkspace,familyRelatedIds,familyPacket,exportFamilyPackage,importFamilyPackage,hexToRgb,luminance,contrastRatio,formatDimensions,performanceBudget,effectivePerformance,openJSON};
})();
