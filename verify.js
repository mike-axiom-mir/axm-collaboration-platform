#!/usr/bin/env node
/* ============================================================
   AXM VERIFIER  —  verify.js   (v1.0)
   Run:  node verify.js     (from the AXM_WORKSHOP folder)
   ------------------------------------------------------------
   Audits the whole workshop against ITS OWN RULES — every check
   here is one Fable performed by hand during the build sessions,
   now automated so ANY future AI's zip is self-checkable at
   Mike's merge gate before a byte is trusted.
   Output: console + exports/verify-report.txt + verify-report.json. Honest exit code:
   0 = all pass · 1 = failures found.
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ToolReadiness = require('./shared/readiness/tool-readiness');
const ROOT = __dirname;
const out = [], records = []; let fails = 0, warns = 0;
let gameWarningReport = null, moduleSeamReport = null;
function ok(m){ out.push('  PASS  ' + m); records.push({verdict:'PASS',message:m}); }
function fail(m){ out.push('  FAIL  ' + m); records.push({verdict:'FAIL',message:m}); fails++; }
function warn(m){ out.push('  warn  ' + m); records.push({verdict:'WARN',message:m}); warns++; }
function read(p){ try { return fs.readFileSync(path.join(ROOT,p),'utf8'); } catch(e){ return null; } }
function sha(p){ const t = fs.readFileSync(path.join(ROOT,p)); return crypto.createHash('sha256').update(t).digest('hex').slice(0,16); }

/* 1 — SPINE INTEGRITY: every copy identical; fingerprint recorded */
const SPINE_SHA = 'b618c5762240070c';   /* Mirror Native provider merge gate approved by Mike, 2026-07-16 */
const spines = [];
(function find(d){
  let entries;
  try { entries = fs.readdirSync(path.join(ROOT,d),{withFileTypes:true}); }
  catch(e) {
    fail('spine scan could not read '+(d||'.')+': '+(e.code||e.message));
    return;
  }
  entries.forEach(e=>{
  const p = d?d+'/'+e.name:e.name;
  if(e.isDirectory() && !['.git','node_modules','tmp'].includes(e.name)) find(p);
  else if(e.name==='axm-foundation.js') spines.push(p); }); })('');
const activeSpines = spines.filter(p => !p.replace(/\\/g, '/').startsWith('exports/workshop-packages/'));
const historicalSpines = spines.filter(p => !activeSpines.includes(p));
activeSpines.forEach(p => sha(p)===SPINE_SHA ? ok('spine intact: '+p)
  : fail('SPINE CHANGED: '+p+' ('+sha(p)+' != canon '+SPINE_SHA+') — spine changes need the merge gate'));
if(!activeSpines.length) fail('no active axm-foundation.js found at all');
if(historicalSpines.length) ok('historical package spines preserved outside the current canon lock: '+historicalSpines.length);

/* 2 — MANIFESTS: valid json, required fields, uses declared, id rules, statuses */
const STATUSES = ['EXPERIMENTAL','TEST','WORKING','CANON','SHELL','BROKEN'];
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
  if(m.type && ['hub-module','local-module','machine-capability'].indexOf(m.type)<0) fail(mp+' unknown type: '+m.type);
  if(m.type==='hub-module') {
    if(!m.hubApiVersion) fail(mp+' hub-module missing hubApiVersion');
    if(!Array.isArray(m.permissions)) fail(mp+' hub-module permissions must be an array');
  }
  if(m.risk && ['LOW','MEDIUM','HIGH'].indexOf(m.risk)<0) fail(mp+' bad risk: '+m.risk);
  if(m.machine) {
    if(!m.machine.entry) fail(mp+' machine contract missing entry');
    else if(!fs.existsSync(path.join(ROOT,'tools',e.name,m.machine.entry))) fail(mp+' machine entry missing: '+m.machine.entry);
    const actions=m.machine.actions;
    if(!(Array.isArray(actions)?actions.length:(actions&&typeof actions==='object'&&Object.keys(actions).length))) fail(mp+' machine contract has no actions');
  }
  if(m.id in ids) fail('DUPLICATE tool id: '+m.id); ids[m.id]=1;
  if(m.id && m.id.toUpperCase()===m.id && m.id!=='CHANGE-ME') warn(mp+' shouty id: '+m.id);
  if(!fs.existsSync(path.join(ROOT,'tools',e.name,m.entry||'index.html'))) fail(mp+' entry file missing: '+m.entry);
});

/* 3 — DOM ORDER + NO HARDCODED ASSET PATHS in every html (the v0.3 lesson) */
(function scanHtml(d){
  let entries;
  try { entries = fs.readdirSync(path.join(ROOT,d),{withFileTypes:true}); }
  catch(e) {
    fail('HTML scan could not read '+(d||'.')+': '+(e.code||e.message));
    return;
  }
  entries.forEach(e=>{
  const p = d?d+'/'+e.name:e.name;
  if(e.isDirectory()) {
    if(['.git','node_modules','exports','backups','state','logs','tmp'].includes(e.name)) return;
    return scanHtml(p);
  }
  if(!e.name.endsWith('.html')) return;
  const h = read(p);
  const pos = h.lastIndexOf('<script>');
  if(pos<0) return;
  const used = new Set((h.slice(pos).match(/\$\('([\w-]+)'\)/g)||[]).map(s=>s.slice(3,-2)));
  const have = new Set((h.slice(0,pos).match(/id="([\w-]+)"/g)||[]).map(s=>s.slice(4,-1)));
  /* non-hidden convention: a tool may DECLARE ids it builds at runtime via
     <!-- axm-verify-dynamic-ids: id1 id2 -->. Declared = visible + intentional,
     not a silent loosening. Undeclared ids still fail the DOM-order check. */
  ((h.match(/axm-verify-dynamic-ids:\s*([\w\s-]+?)\s*--/)||[,''])[1].trim().split(/\s+/).filter(Boolean)).forEach(x=>have.add(x));
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

/* 9 - NESTED MODULE ADAPTERS: the top-level verifier delegates to each
   module's narrow contract instead of pretending every package has the same
   shape. START_AXM_FULL uses this same adapter to gate Game Hub only. */
try {
  const gameV = require('./tools/game-hub/game-package-verifier');
  const engineSeams = require('./tools/game-hub/game-engine/engine-seam-selftest');
  const engineResult = engineSeams.run();
  ok('shared game engine seams: '+engineResult.assertions+' regression assertion(s) passed');
  const gr = gameV.verifyLibrary(path.join(ROOT,'tools','game-hub','game-library'));
  gameWarningReport = gr;
  fs.mkdirSync(path.join(ROOT, 'exports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'exports', 'game-night-seam-report.json'), JSON.stringify(gr, null, 2));
  if(gr.pass) ok('game-library adapter: '+gr.games.length+' modular game package(s) verified');
  else gr.games.forEach(g => g.errors.forEach(e => fail('game package '+g.game+': '+e)));
  gr.games.forEach(g => (g.warnings || []).forEach(e => warn('game package '+g.game+': '+e)));
} catch(e) { fail('game-library adapter could not run: '+e.message); }

/* 10 - DECLARED MODULE CONTRACTS: modules may opt into the shared v1
   contract without forcing legacy tools to pretend they already migrated. */
try {
  const contractV = require('./hub/module-contract-verifier');
  const cr = contractV.verifyDeclaredContracts(ROOT);
  cr.results.forEach(r => {
    if(r.pass) ok('module contract: '+r.id+' ('+r.path+')');
    else r.errors.forEach(e => fail('module contract '+r.id+': '+e));
  });
  if(!cr.results.length) warn('no modules declare a shared module contract yet');
} catch(e) { fail('module contract adapter could not run: '+e.message); }

/* 11 - LIFECYCLE SEAM INVENTORY: legacy modules are not falsely failed,
   but missing reload/disconnect/cleanup decisions can no longer disappear.
   New module templates declare these seams from birth. */
try {
  const seamV = require('./hub/module-seam-audit');
  const sr = seamV.auditModules(ROOT);
  moduleSeamReport = sr;
  fs.mkdirSync(path.join(ROOT, 'exports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'exports', 'module-seam-gaps.json'), JSON.stringify(sr, null, 2));
  if (sr.gapCount) warn('module lifecycle seam inventory: '+sr.gapCount+' older gap(s) across '+sr.openModuleCount+' module(s) - see exports/module-seam-gaps.json');
  else ok('module lifecycle seam inventory complete: '+sr.moduleCount+' module(s) declared');
} catch(e) { fail('module lifecycle seam inventory could not run: '+e.message); }

/* 12 - REPAIRBUDDY WARNING ROUTE: warnings keep their original verifier
   authority, while a structured queue says which ones need evidence, a
   repair design, or an exact frozen replay. Routing never suppresses a warn. */
try {
  const warningRouter = require('./tools/repairbuddy/verifier-warning-router');
  const queue = warningRouter.buildWarningQueue(gameWarningReport, moduleSeamReport, { root: ROOT });
  const checked = warningRouter.validateWarningQueue(queue);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  fs.mkdirSync(path.join(ROOT, 'exports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'exports', 'repairbuddy-warning-queue.json'), JSON.stringify(queue, null, 2));
  ok('RepairBuddy warning route: '+queue.summary.routedItems+' item(s) from '+queue.summary.routedVerifierWarningLines+' warning line(s); '+queue.summary.replayable+' replayable, '+queue.summary.evidenceRequired+' evidence, '+queue.summary.repairDesignRequired+' repair design');
} catch(e) { fail('RepairBuddy warning routing could not run: '+e.message); }

/* 13 - TOOL READINESS INDEX: promotion evidence and missing declarations stay
   visible without automatically promoting, archiving, or granting authority. */
try {
  const verificationResults = JSON.parse(read('state/tool-readiness/latest-selftests.json')||'null');
  const liveIndex = ToolReadiness.buildIndex(ROOT, { verificationResults });
  const checked = ToolReadiness.validateIndex(liveIndex);
  if(!checked.pass) checked.errors.forEach(error => fail('tools index: '+error));
  else ok('tools index schema valid: '+liveIndex.summary.tools+' tools · '+liveIndex.summary.capabilities+' contract capabilities');
  const idMismatches = liveIndex.tools.filter(tool => tool.id !== tool.folder && !(JSON.parse(read(tool.manifest.path)||'{}').folderAlias === tool.folder));
  idMismatches.forEach(tool => fail('tool id must match folder: '+tool.folder+' declares '+tool.id));
  const missingPermissions = liveIndex.tools.filter(tool => !tool.permissionsDeclared);
  const missingContracts = liveIndex.tools.filter(tool => !tool.contract.present);
  const missingSelftests = liveIndex.tools.filter(tool => !tool.selftest.paths.length);
  const missingKinds = liveIndex.tools.filter(tool => tool.kind === 'UNDECLARED');
  if(missingPermissions.length) warn('manifest completeness backlog: '+missingPermissions.length+' tool(s) omit permissions · '+missingPermissions.map(tool=>tool.id).join(','));
  else ok('all tool manifests declare permissions');
  if(missingContracts.length) warn('module contract backlog: '+missingContracts.length+' tool(s) have no contract · '+missingContracts.map(tool=>tool.id).join(','));
  else ok('all tools have module contracts');
  if(missingSelftests.length) warn('selftest backlog: '+missingSelftests.length+' tool(s) have no executable selftest · '+missingSelftests.map(tool=>tool.id).join(','));
  else ok('all tools have executable selftests');
  if(missingKinds.length) warn('manifest kind migration backlog: '+missingKinds.length+' tool(s) remain legacy UNDECLARED');
  else ok('all tool manifests declare kind');
  liveIndex.promotionQueue.claimsNeedingReverification.forEach(item => warn('promotion claim needs reverification: '+item.id+' · '+item.blockers.join('; ')));
  const stored = JSON.parse(read('tools-index.json')||'null');
  const storedCheck = ToolReadiness.validateIndex(stored);
  if(!storedCheck.pass) warn('tools-index.json missing or invalid; run npm run index:tools');
  else if(stored.sourceDigest !== liveIndex.sourceDigest) warn('tools-index.json is stale for current manifests/contracts/selftests; run npm run index:tools');
  else ok('tools-index.json matches current structural source digest');
} catch(e) { fail('tool readiness index could not run: '+e.message); }

/* ---- report ---- */
const generatedAt = new Date().toISOString();
const head = 'AXM VERIFY — '+generatedAt+'\n'+
  fails+' FAIL · '+warns+' warn · spine '+SPINE_SHA+'\n'+
  'A failing zip is not evil — it is UNREVIEWED. Hand this report to the builder.\n\n';
const report = head + out.join('\n') + '\n';
console.log(report);
try { fs.mkdirSync(path.join(ROOT,'exports'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,'exports','verify-report.txt'), report);
  fs.writeFileSync(path.join(ROOT,'exports','verify-report.json'), JSON.stringify({
    schema:'axm.verify-report/v1',
    generatedAt,
    summary:{passes:records.filter(row=>row.verdict==='PASS').length,failures:fails,warnings:warns,verdict:fails?'FAIL':'PASS'},
    spineSha256Prefix:SPINE_SHA,
    checks:records,
    truth:{warningsSuppressed:false,automaticRepair:false,automaticPromotion:false}
  },null,2)+'\n');
} catch(e){}
process.exit(fails ? 1 : 0);
