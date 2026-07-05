#!/usr/bin/env node
/* ============================================================
   AXM VERIFIER  —  verify.js   (v1.0)
   Run:  node verify.js     (from the AXM_WORKSHOP folder)
   ------------------------------------------------------------
   Audits the whole workshop against ITS OWN RULES — every check
   here is one Fable performed by hand during the build sessions,
   now automated so ANY future AI's zip is self-checkable at
   Mike's merge gate before a byte is trusted.
   Output: console + exports/verify-report.txt. Honest exit code:
   0 = all pass · 1 = failures found.
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = __dirname;
const out = []; let fails = 0, warns = 0;
function ok(m){ out.push('  PASS  ' + m); }
function fail(m){ out.push('  FAIL  ' + m); fails++; }
function warn(m){ out.push('  warn  ' + m); warns++; }
function read(p){ try { return fs.readFileSync(path.join(ROOT,p),'utf8'); } catch(e){ return null; } }
function sha(p){ const t = fs.readFileSync(path.join(ROOT,p)); return crypto.createHash('sha256').update(t).digest('hex').slice(0,16); }

/* 1 — SPINE INTEGRITY: every copy identical; fingerprint recorded */
const SPINE_SHA = '418f9ce4fb050602';   /* v1.4.1 canon fingerprint (bump ONLY via merge gate) */
const spines = [];
(function find(d){ fs.readdirSync(path.join(ROOT,d),{withFileTypes:true}).forEach(e=>{
  const p = d?d+'/'+e.name:e.name;
  if(e.isDirectory() && e.name!=='node_modules') find(p);
  else if(e.name==='axm-foundation.js') spines.push(p); }); })('');
spines.forEach(p => sha(p)===SPINE_SHA ? ok('spine intact: '+p)
  : fail('SPINE CHANGED: '+p+' ('+sha(p)+' != canon '+SPINE_SHA+') — spine changes need the merge gate'));
if(!spines.length) fail('no axm-foundation.js found at all');

/* 2 — MANIFESTS: valid json, required fields, uses declared, id rules, statuses */
const STATUSES = ['TEST','WORKING','CANON','SHELL','BROKEN'];
const ids = {};
const toolsDir = path.join(ROOT,'tools');
fs.readdirSync(toolsDir,{withFileTypes:true}).forEach(e=>{
  if(!e.isDirectory()) return;
  if(e.name[0]==='_'){ ok('underscore folder skipped by convention: tools/'+e.name); return; }
  const mp = 'tools/'+e.name+'/manifest.json';
  const raw = read(mp);
  if(!raw) return fail(mp+' missing');
  let m; try { m = JSON.parse(raw); } catch(err){ return fail(mp+' is not valid JSON'); }
  ['id','name','version','status','entry'].forEach(f => f in m ? null : fail(mp+' missing field: '+f));
  if(STATUSES.indexOf(m.status)<0) fail(mp+' bad status: '+m.status);
  if(!Array.isArray(m.uses)) fail(mp+' has NO uses declaration (trust charter #4: undeclared = trusted less)');
  else ok('tools/'+e.name+': uses declared ['+m.uses.join(',')+']');
  if(m.id in ids) fail('DUPLICATE tool id: '+m.id); ids[m.id]=1;
  if(m.id && m.id.toUpperCase()===m.id && m.id!=='CHANGE-ME') warn(mp+' shouty id: '+m.id);
  if(!fs.existsSync(path.join(ROOT,'tools',e.name,m.entry||'index.html'))) fail(mp+' entry file missing: '+m.entry);
});

/* 3 — DOM ORDER + NO HARDCODED ASSET PATHS in every html (the v0.3 lesson) */
(function scanHtml(d){ fs.readdirSync(path.join(ROOT,d),{withFileTypes:true}).forEach(e=>{
  const p = d?d+'/'+e.name:e.name;
  if(e.isDirectory()) return scanHtml(p);
  if(!e.name.endsWith('.html')) return;
  const h = read(p);
  const pos = h.lastIndexOf('<script>');
  if(pos<0) return;
  const script = h.slice(pos);
  const used = new Set((script.match(/\$\('([\w-]+)'\)/g)||[]).map(s=>s.slice(3,-2)));
  const staticIds = new Set((h.slice(0,pos).match(/id="([\w-]+)"/g)||[]).map(s=>s.slice(4,-1)));
  /* Some tools create controls dynamically before binding handlers. Count ids that appear
     inside script-built HTML strings as present so verifier catches real missing ids
     without rejecting deliberate dynamic UI modules. */
  const dynamicIds = new Set((script.match(/id="([\w-]+)"/g)||[]).map(s=>s.slice(4,-1)));
  const have = new Set([...staticIds, ...dynamicIds]);
  const missing = [...used].filter(x=>!have.has(x));
  missing.length ? fail(p+' script references ids not in DOM before it: '+missing.join(','))
                 : ok(p+' DOM order clean');
  if(p.startsWith('launcher') && h.includes("'/assets/local")) fail(p+' hardcodes an asset path — must ask AXMAssets');
}); })('');

/* 4 — NAMESPACES: every packs shelf carries its contract */
['launcher','sound','music','video','lang','template'].forEach(s=>{
  const p = 'assets/packs/'+s+'/base/NAMESPACE.txt';
  read(p)!==null ? ok('namespace declared: '+p) : fail('missing namespace contract: '+p);
});

/* 5 — TEMPLATE INDEX honesty: entries with no file must carry a status */
try {
  const ix = JSON.parse(read('assets/local/template/index.json'));
  ix.templates.forEach(t=>{
    if(t.file===null && !/plan|design|seed/i.test(t.status||'')) fail('template '+t.id+' has no file and no honest status');
    if(t.file && !fs.existsSync(path.join(ROOT,'assets/local/template',t.file))) fail('template '+t.id+' points at missing file '+t.file);
  });
  ok('template index honest ('+ix.templates.length+' entries)');
} catch(e){ fail('template index unreadable: '+e.message); }

/* 6 — REGISTRY + SETTINGS contracts present and unforked */
const reg = read('launcher/axm-registry.js')||'';
reg.includes('needsUserChoice') && reg.includes('proposal first') && reg.includes('raw.ok === false')
  ? ok('registry: user-choice rule, AI proposal-first, truth patch all present')
  : fail('registry contract pieces missing — was it rewritten?');
(read('launcher/axm-settings.js')||'').includes("'axm-settings'")
  ? ok('settings use the reserved spine slot') : fail('settings slot drifted from reserved name');

/* 7 — SHELL branch discipline: proposal-only + rejection_reason validation */
const sh = read('tools/reasoning-shell/index.html')||'';
if(sh){ sh.includes("status:'proposal'") && sh.includes('rejection_reason')
  ? ok('reasoning-shell: tweaks proposal-only, rejection_reason enforced')
  : fail('reasoning-shell lost a locked rule'); }

/* 8 — TRUST FILES exist where promised */
['TRUST_CHARTER.txt','TEMPLATE_SEAMS.txt','prompts/local/axm-core.txt','WORKSHOP_TESTS_RUN.txt']
  .forEach(p => read(p)!==null ? ok('present: '+p) : fail('missing: '+p));
(read('prompts/local/axm-core.txt')||'').includes('CANON BASE')
  ? ok('core roots file is the CANON BASE version') : warn('core file lacks CANON BASE marker — check which version this is');

/* ---- report ---- */
const head = 'AXM VERIFY — '+new Date().toISOString()+'\n'+
  fails+' FAIL · '+warns+' warn · spine '+SPINE_SHA+'\n'+
  'A failing zip is not evil — it is UNREVIEWED. Hand this report to the builder.\n\n';
const report = head + out.join('\n') + '\n';
console.log(report);
try { fs.mkdirSync(path.join(ROOT,'exports'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,'exports','verify-report.txt'), report); } catch(e){}
process.exit(fails ? 1 : 0);
