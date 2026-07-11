/* AXM Agent Tool Forge — deterministic draft/package core (v0.2)
   Pure and connector-neutral: browser UI and machine adapter call this same core.
   It drafts files only. It never installs, overwrites, promotes, executes, or canonizes. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMForgeCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 'axm.forge-draft/v1';
  const PACKAGE_SCHEMA = 'axm.forge-package/v1';
  const VERSION = '0.2';
  const TYPES = {
    'foundation-tool': { label: 'Foundation tool', human: true, foundation: true, hub: false, machine: false },
    'hub-module': { label: 'Hub module', human: true, foundation: false, hub: true, machine: false },
    'dual-door-tool': { label: 'Dual-door tool', human: true, foundation: true, hub: true, machine: true },
    'proposal-analyzer': { label: 'Proposal-only analyzer', human: true, foundation: false, hub: true, machine: false },
    'machine-capability': { label: 'Machine-only capability', human: false, foundation: false, hub: false, machine: true }
  };
  const CAPABILITIES = ['storage', 'wisdom', 'identity', 'ai', 'gate', 'export', 'files', 'network', 'bridge'];
  const RISKS = ['LOW', 'MEDIUM', 'HIGH'];

  function text(v) { return String(v == null ? '' : v).trim(); }
  function list(v) {
    const a = Array.isArray(v) ? v : text(v).split(',');
    return Array.from(new Set(a.map(text).filter(Boolean)));
  }
  function safeId(v) {
    return text(v).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  }
  function normalize(input) {
    input = input || {};
    const kind = TYPES[input.kind] ? input.kind : 'foundation-tool';
    const risk = RISKS.indexOf(String(input.risk || '').toUpperCase()) >= 0 ? String(input.risk).toUpperCase() : 'LOW';
    return {
      schema: SCHEMA,
      id: safeId(input.id || input.name || 'untitled-draft'),
      name: text(input.name) || 'Untitled draft',
      version: text(input.version) || 'v0.1',
      kind,
      risk,
      status: 'DRAFT',
      purpose: text(input.purpose),
      primary_output: text(input.primary_output),
      capabilities: list(input.capabilities).filter(x => CAPABILITIES.indexOf(x) >= 0),
      tags: list(input.tags),
      boundaries: list(Array.isArray(input.boundaries) ? input.boundaries : text(input.boundaries).split(/\r?\n/)),
      actor: { id: text(input.actor && input.actor.id) || 'local-user', type: text(input.actor && input.actor.type) || 'human' }
    };
  }

  function newDraft(seed) { return normalize(seed); }
  function updateDraft(draft, patch) { return normalize(Object.assign({}, normalize(draft), patch || {})); }

  function validateDraft(input) {
    const d = normalize(input), errors = [], warnings = [];
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(d.id)) errors.push('id must be 2-64 lowercase letters, numbers, dots, underscores or hyphens');
    if (!d.name || d.name === 'Untitled draft') errors.push('name is required');
    if (!d.purpose) errors.push('purpose is required');
    if (!d.primary_output) errors.push('primary output is required');
    if (!d.boundaries.length) errors.push('at least one explicit boundary is required');
    if (d.risk === 'HIGH') warnings.push('HIGH risk drafts require isolated testing and explicit install approval');
    if (d.capabilities.indexOf('network') >= 0) warnings.push('network is declared; generated code does not activate it');
    if (d.capabilities.indexOf('files') >= 0) warnings.push('files is declared; generated code does not activate it');
    if (d.kind === 'machine-capability' && d.capabilities.indexOf('gate') < 0) warnings.push('machine capability should normally declare gate');
    return { ok: errors.length === 0, draft: d, errors, warnings };
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  function utf8(s) {
    const out = [];
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function sha256(s) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const b = utf8(s), bitLen = b.length * 8;
    b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    for (let i = 7; i >= 0; i--) b.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    const rr = (x,n) => (x >>> n) | (x << (32-n));
    for (let off=0; off<b.length; off+=64) {
      const w = new Array(64);
      for (let i=0;i<16;i++) w[i]=((b[off+i*4]<<24)|(b[off+i*4+1]<<16)|(b[off+i*4+2]<<8)|b[off+i*4+3])>>>0;
      for (let i=16;i<64;i++) { const a=w[i-15],z=w[i-2]; const s0=rr(a,7)^rr(a,18)^(a>>>3),s1=rr(z,17)^rr(z,19)^(z>>>10); w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0; }
      let [a,c,d,e,f,g,h,i] = H;
      for (let n=0;n<64;n++) { const S1=rr(f,6)^rr(f,11)^rr(f,25),ch=(f&g)^((~f)&h),t1=(i+S1+ch+K[n]+w[n])>>>0,S0=rr(a,2)^rr(a,13)^rr(a,22),maj=(a&c)^(a&d)^(c&d),t2=(S0+maj)>>>0; i=h;h=g;g=f;f=(e+t1)>>>0;e=d;d=c;c=a;a=(t1+t2)>>>0; }
      H[0]=(H[0]+a)>>>0;H[1]=(H[1]+c)>>>0;H[2]=(H[2]+d)>>>0;H[3]=(H[3]+e)>>>0;H[4]=(H[4]+f)>>>0;H[5]=(H[5]+g)>>>0;H[6]=(H[6]+h)>>>0;H[7]=(H[7]+i)>>>0;
    }
    return H.map(x=>x.toString(16).padStart(8,'0')).join('');
  }

  function manifestFor(d) {
    const t = TYPES[d.kind], m = {
      id:d.id,name:d.name,version:d.version,status:'EXPERIMENTAL',entry:'index.html',
      type:t.hub?'hub-module':(t.machine&&!t.human?'machine-capability':'local-module'),
      tags:d.tags,uses:d.capabilities,risk:d.risk,
      notes:d.purpose + ' Drafted by AXM Agent Tool Forge; installation and promotion were not performed.',
      boundaries:d.boundaries
    };
    if (t.hub) Object.assign(m,{hubApiVersion:'1.0',permissions:[],audience:'human'});
    if (!t.human) Object.assign(m,{audience:'machine',layer:'ai-native'});
    if (t.machine) m.machine={apiVersion:'1.0',entry:'machine.js',status:'EXPERIMENTAL',actions:{describe:{description:'Return the declared draft contract.',effect:'read-only',inputSchema:{type:'object'}}}};
    m.forge={schema:SCHEMA,kind:d.kind,draftStatus:'DRAFT',actor:d.actor};
    return m;
  }

  function screenHtml(d) {
    const t=TYPES[d.kind], scripts=[];
    if(t.foundation) scripts.push('<script src="axm-foundation.js"><\/script>');
    if(t.hub) scripts.push('<script src="/hub/axm-hub-module.js"><\/script>');
    const boundaryItems=d.boundaries.map(x=>'<li>'+esc(x)+'</li>').join('');
    const capItems=(d.capabilities.length?d.capabilities:['none']).map(x=>'<span>'+esc(x)+'</span>').join('');
    const controls=t.foundation?'<section><label for="work">Working note</label><textarea id="work" placeholder="Bounded local working state"></textarea><div class="actions"><button id="save">Save locally</button><button id="resume">Resume</button></div></section>':'';
    const js=[];
    if(t.foundation) js.push("await AXM.init({id:"+JSON.stringify(d.id)+",name:"+JSON.stringify(d.name)+",version:"+JSON.stringify(d.version)+"});", "document.getElementById('save').onclick=async()=>{const v=AXMGate.submit({action:"+JSON.stringify(d.id+'.draft.save')+",actor:'local-user',actorType:'human',tool:"+JSON.stringify(d.id)+",detail:{effect:'local-write'}});if(v.allow){await AXM.store.save('latest',{format:1,note:document.getElementById('work').value},{title:"+JSON.stringify(d.name)+"});document.getElementById('state').textContent='saved locally';}};", "document.getElementById('resume').onclick=async()=>{const r=await AXM.store.load('latest');if(r){document.getElementById('work').value=(r.data&&r.data.note)||'';document.getElementById('state').textContent='resumed';}};");
    if(t.hub) js.push("AXMHub.ready({id:"+JSON.stringify(d.id)+",name:"+JSON.stringify(d.name)+",version:"+JSON.stringify(d.version)+",hubApiVersion:'1.0',permissions:[],savesState:false});", "AXMHub.log("+JSON.stringify(d.name+' opened as EXPERIMENTAL')+");");
    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(d.name)+'</title>'+scripts.join('')+'<style>:root{--bg:#10151c;--panel:#18212c;--line:#2c3a4c;--text:#e4ebf3;--muted:#8d9aad;--cy:#38d6ec;--gold:#e8b54a}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,sans-serif}.wrap{max-width:850px;margin:auto;padding:24px}.badge,span{font:11px ui-monospace,monospace;border:1px solid var(--line);border-radius:99px;padding:4px 9px;color:var(--gold)}h1{margin:7px 0}.lead{color:var(--muted)}section{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px;margin-top:14px}textarea{width:100%;min-height:120px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:9px}button{margin:9px 7px 0 0;padding:8px 12px;border:1px solid var(--cy);border-radius:9px;background:transparent;color:var(--cy);cursor:pointer}li{margin:6px 0}</style></head><body><main class="wrap"><div class="badge">EXPERIMENTAL · '+esc(d.risk)+' RISK</div><h1>'+esc(d.name)+'</h1><p class="lead">'+esc(d.purpose)+'</p><section><b>Primary output</b><p>'+esc(d.primary_output)+'</p><div>'+capItems+'</div></section><section><b>Boundaries</b><ul>'+boundaryItems+'</ul></section>'+controls+'<p id="state" class="lead">Generated skeleton · not promoted or canonized.</p></main><script>(async()=>{'+js.join('\n')+'})().catch(e=>{document.getElementById(\'state\').textContent=\'Startup failed: \'+e.message;});<\/script></body></html>';
  }

  function machineJs(d) {
    return "'use strict';\nconst contract="+JSON.stringify({id:d.id,name:d.name,purpose:d.purpose,primary_output:d.primary_output,boundaries:d.boundaries,capabilities:d.capabilities,risk:d.risk},null,2)+";\nasync function run(request,host){\n  request=request||{}; host=host||{};\n  if(typeof host.authorize!=='function') return {ok:false,refused:true,reason:'host authorize function required'};\n  const verdict=await host.authorize({action:'"+d.id+".describe',effect:'read-only',actor:request.actor||{id:'machine',type:'ai'}});\n  if(!verdict||!verdict.allow) return {ok:false,refused:true,reason:(verdict&&verdict.reason)||'gate denied'};\n  if(request.action!=='describe') return {ok:false,error:'unsupported action'};\n  return {ok:true,status:'EXPERIMENTAL',contract};\n}\nmodule.exports={run,contract};\n";
  }

  function readme(d) {
    return '# '+d.name+'\n\nStatus: EXPERIMENTAL / '+d.risk+' risk\n\n'+d.purpose+'\n\nPrimary output: '+d.primary_output+'\n\nBoundaries:\n'+d.boundaries.map(x=>'- '+x).join('\n')+'\n\nThis package was drafted by AXM Agent Tool Forge. It was not installed, executed, promoted, or made canon. Review the package fingerprint and run the Workshop verifier before adding it.\n';
  }

  function renderFiles(input, assets) {
    const v=validateDraft(input); if(!v.ok) return {ok:false,errors:v.errors,warnings:v.warnings,files:{}};
    const d=v.draft,t=TYPES[d.kind],files={};
    files['manifest.json']=JSON.stringify(manifestFor(d),null,2)+'\n';
    files['index.html']=screenHtml(d)+'\n';
    files['README.md']=readme(d);
    files['draft.json']=JSON.stringify(d,null,2)+'\n';
    if(t.foundation) {
      if(!assets||!assets.foundationSource) return {ok:false,errors:['foundation source is required for this package type'],warnings:v.warnings,files:{}};
      files['axm-foundation.js']=String(assets.foundationSource);
    }
    if(t.machine) files['machine.js']=machineJs(d);
    return {ok:true,draft:d,errors:[],warnings:v.warnings,files};
  }
  function fingerprintDraft(input) { return sha256(stable(normalize(input))); }
  function fingerprintFiles(files) { return sha256(stable(Object.keys(files).sort().map(path=>({path,content:String(files[path])})))); }
  function buildPackage(input, assets) {
    const r=renderFiles(input,assets); if(!r.ok) return r;
    return {ok:true,schema:PACKAGE_SCHEMA,forgeVersion:VERSION,draft:r.draft,draftFingerprint:fingerprintDraft(r.draft),packageFingerprint:fingerprintFiles(r.files),warnings:r.warnings,files:r.files,install:{performed:false,target:'tools/'+r.draft.id,statusRequested:'EXPERIMENTAL'}};
  }

  return {SCHEMA,PACKAGE_SCHEMA,VERSION,TYPES,CAPABILITIES,RISKS,newDraft,updateDraft,normalize,validateDraft,renderFiles,fingerprintDraft,fingerprintFiles,buildPackage,sha256,stable};
});
