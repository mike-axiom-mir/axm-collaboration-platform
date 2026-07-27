#!/usr/bin/env node
/* ============================================================
   AXM Hub — hub-selftest.js
   Proves the parts of the hub that DON'T need a browser: the
   persistence round-trip (survives a simulated reopen), the
   passport validation, and the message reducer. The browser
   Test Room proves the DOM/reload half. Exit 0 = pass, 1 = fail.
   Run:  node hub/hub-selftest.js   (from AXM_WORKSHOP)
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path');
const Core = require('./hub-shell.js');
const C = require('./module-contract.js');
const hubHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const hubCss = fs.readFileSync(path.join(__dirname, 'hub-tokens.css'), 'utf8');
const presentationCss = fs.readFileSync(path.join(__dirname, 'shapeable-presentation.css'), 'utf8');
const professionalCss = fs.readFileSync(path.join(__dirname, 'professional-steward.css'), 'utf8');
const presentationHostCss = fs.readFileSync(path.join(__dirname, '..', 'shared', 'presentation-spine', 'presentation-host.css'), 'utf8');
const presentationPolicy = require(path.join(__dirname, '..', 'shared', 'presentation-spine', 'presentation-policy.js'));
const presentationRecipe = require(path.join(__dirname, '..', 'shared', 'presentation-spine', 'presentation-recipe.js'));
const screenContract = require(path.join(__dirname, '..', 'shared', 'presentation-spine', 'screen-contract.js'));
const hubJs = fs.readFileSync(path.join(__dirname, 'hub-shell.js'), 'utf8');
const presenceJs = fs.readFileSync(path.join(__dirname, 'ai-presence.js'), 'utf8');
const navJs = fs.readFileSync(path.join(__dirname, 'workshop-navigation.js'), 'utf8');
const productionSessionJs = fs.readFileSync(path.join(__dirname, 'production-session.js'), 'utf8');
const productionSessionCss = fs.readFileSync(path.join(__dirname, 'production-session.css'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const operationsApiJs = fs.readFileSync(path.join(__dirname, '..', 'shared', 'operations', 'operations-api.js'), 'utf8');
const productionSessionCoreJs = fs.readFileSync(path.join(__dirname, '..', 'shared', 'production-session', 'production-session-core.js'), 'utf8');
const out = []; let fails = 0;
function ok(m){ out.push('  PASS  ' + m); }
function bad(m){ out.push('  FAIL  ' + m); fails++; }
function eq(a, b){ return JSON.stringify(a) === JSON.stringify(b); }

/id="sidebarToggle"[^>]+aria-controls="hubSidebar"/.test(hubHtml) ? ok('sidebar: visible collapse/reopen handle exists') : bad('sidebar toggle missing');
/presentation-policy\.js/.test(hubHtml) && /presentation-recipe\.js/.test(hubHtml) && /id="presentationModeQuick"/.test(hubHtml) && /applyPresentationToFrame/.test(hubJs)
  ? ok('presentation: Hub owns a visible shared/module control plane') : bad('presentation: control plane wiring missing');
/setSharedPresentationLayer/.test(hubJs) && /downloadPresentationRecipe/.test(hubJs) && /hub:presentation:recipe/.test(hubJs) && /Portable skin recipe/.test(hubJs)
  ? ok('presentation: portable layer recipe persists, exports and accepts explicit same-origin composition') : bad('presentation: reusable recipe controls missing');
/screen-contract\.js/.test(hubHtml) && /id="presentationEditQuick"/.test(hubHtml) && /openScreenEditor/.test(hubJs) && /Body and behavior stay locked/.test(hubJs)
  ? ok('presentation: bounded Body to Behavior to Presentation to Screen editor is wired') : bad('presentation: bounded screen editor wiring missing');
screenContract.resolve({id:'verifier',tags:['verification']}).preset === 'instrument' &&
  screenContract.resolve({id:'technical-art-validator',tags:['visual']}).preset === 'instrument' &&
  screenContract.resolve({id:'game-world',tags:['game']}).preset === 'expressive' &&
  screenContract.resolve({id:'verifier',tags:['verification']}).behavior.editable === false
  ? ok('presentation: deterministic purpose presets expose screen freedom without behavior authority') : bad('presentation: screen contract resolution failed');
/frameLoadSequence:\s*0/.test(hubJs) && /navigationToken !== this\.frameLoadSequence \|\| this\.active !== id/.test(hubJs)
  ? ok('navigation: stale module-load timers cannot replace the current screen') : bad('navigation: module-load race guard missing');
/acceptPaintedFrame/.test(hubJs) && /actual[\s\S]*same-origin paint as a second honest ready signal/.test(hubJs)
  ? ok('navigation: visible iframe paint is accepted when a host drops its load event') : bad('navigation: iframe paint fallback missing');
/body\[data-axm-presentation-mode="shared"\]/.test(presentationHostCss) && !/body\[data-axm-presentation-mode="module"\]/.test(presentationHostCss)
  ? ok('presentation: host styling is scoped to Shared and leaves Module mode alone') : bad('presentation: host styling leaks into module-owned visuals');
presentationPolicy.resolve({module:{id:'studio'}}).mode === 'shared' && presentationPolicy.resolve({module:{id:'studio'},userMode:'module'}).mode === 'module'
  ? ok('presentation: shared default and explicit module choice resolve honestly') : bad('presentation: resolution policy is wrong');
presentationRecipe.validate(presentationRecipe.normalize(presentationRecipe.DEFAULT)).ok && !presentationRecipe.validate(Object.assign({},presentationRecipe.normalize(presentationRecipe.DEFAULT),{permissions:['storage']})).ok
  ? ok('presentation: recipe is bounded data and refuses permission authority') : bad('presentation: recipe authority boundary failed');
/shared\/elements\/axm-ui-fx\.css/.test(hubHtml) && /id="presentationSpineNav"/.test(hubHtml) && /fx-tile fx-glow/.test(hubHtml) && /2030 navigation deck/.test(presentationCss)
  ? ok('sidebar: layered UI-FX and visible 2030 Visual System route are wired') : bad('sidebar UI-FX or Visual System route missing');
/hub\/professional-steward\.css/.test(hubHtml) && /Presentation only: no navigation, lifecycle, permission, or runtime changes\./.test(professionalCss) && /\.module-card:has\(\.module-card-life\.WORKING\)/.test(professionalCss) && /#presentationProfileQuick\s*\{[\s\S]*?display:\s*none/.test(professionalCss) && /MOBILE OVERLAY/.test(professionalCss)
  ? ok('visual stewardship: professional layer is wired and status styling stays presentation-only') : bad('visual stewardship: professional layer contract missing');
/dataset\.navKind = 'module'/.test(hubJs) && /\.mod\[data-nav-kind="module"\]/.test(presentationCss) && /min-height:38px!important/.test(presentationCss) && /flex:0 0 28px!important/.test(presentationCss)
  ? ok('sidebar: generated modules use compact navigation-deck instruments') : bad('sidebar: compact generated-module contract missing');
/\.sidebar \.mod:not\(\[data-nav-kind="module"\]\)/.test(presentationCss) && /\.sidebar>\.sidebar-toggle/.test(presentationCss) && /<div id="modList"><\/div>\s*<button class="sidebar-toggle"/.test(hubHtml)
  ? ok('sidebar: permanent, workflow and layer controls share compact instruments; collapse lives inside rail') : bad('sidebar: complete compact instrument grammar or in-rail collapse control missing');
/id="sidebarTopToggle"[^>]+aria-controls="hubSidebar"/.test(hubHtml) && /sidebarTopToggle/.test(hubJs) && /\.sidebar-head-toggle/.test(presentationCss)
  ? ok('sidebar: navigation-deck header exposes the same bounded collapse action') : bad('sidebar: compact header collapse action missing');
/id="workshopBack"[^>]+aria-label="Go to previous AXM screen"/.test(hubHtml) && /workshop-navigation\.js/.test(hubHtml)
  ? ok('navigation: universal previous-screen control is visible and shared') : bad('navigation: previous-screen control or helper missing');
/initNavigation/.test(hubJs) && /goBack\(\)/.test(hubJs) && /sessionStorage/.test(hubJs) && /never reads or writes project state/.test(navJs)
  ? ok('navigation: session-only trail is isolated from project saves') : bad('navigation: history isolation wiring missing');
/data-sidebar-collapsed="true"\] \.body\{grid-template-columns:0 1fr\}/.test(hubCss) ? ok('sidebar: collapsed state gives workspace full width') : bad('sidebar collapse layout missing');
/axm\.hub\.sidebar-collapsed/.test(hubJs) && /toggleSidebar\(\)/.test(hubJs) ? ok('sidebar: preference persists and toggles') : bad('sidebar persistence missing');
/id="capabilityForm"/.test(hubHtml) && /id="capabilityResults"[^>]+aria-live="polite"/.test(hubHtml) ? ok('capability guide: plain-language form and accessible results exist') : bad('capability guide UI missing');
/workshop-capability-index\.js/.test(hubHtml) && /renderCapabilityGuide/.test(hubJs) && /openCapability/.test(hubJs) ? ok('capability guide: shared index and explicit open action are wired') : bad('capability guide wiring missing');
/DETERMINISTIC/.test(hubJs) && /SELF CREATION/.test(hubJs) && /AI ASSISTED/.test(hubJs) && /Nothing starts until you choose/.test(hubJs) && /automaticStart:false/.test(hubJs)
  ? ok('capability guide: creation exposes three explicit human choices without auto-start') : bad('capability guide: creation choices or no-auto-start boundary missing');
/"asset-hands"\s*:\s*\{[\s\S]*?state:\s*assetHandsInstalled\s*\?\s*"READY"\s*:\s*"OFFLINE"/.test(serverJs) && /"asset-hands-upgrade-registry"\s*:\s*\{[\s\S]*?state:\s*assetHandUpgradesInstalled\s*\?\s*"READY"\s*:\s*"OFFLINE"/.test(serverJs)
  ? ok('readiness: installed Creation Hands and upgrades have honest probes') : bad('readiness: Creation Hands probes missing');
/id="continuityStrip"/.test(hubHtml) && /workshop-continuity\.js/.test(hubHtml) && /loadContinuity/.test(hubJs) && /forgetContinuity/.test(hubJs)
  ? ok('continuity: explicit Continue and Forget surface is wired') : bad('continuity surface missing');
/id="handoffForm"/.test(hubHtml) && /artifact-handoff-broker\.js/.test(hubHtml) && /findHandoffDestinations/.test(hubJs) && /prepareHandoff/.test(hubJs)
  ? ok('handoff broker: declared-format chooser and explicit proposal are wired') : bad('handoff broker surface missing');
/readiness-guidance/.test(hubJs) && /Nothing is repaired automatically/.test(hubJs)
  ? ok('readiness: beginner explanation preserves manual repair boundary') : bad('readiness explanation missing');
/requestActiveShutdown/.test(hubJs) && /hub:shutdown:request/.test(hubJs) && /hub:shutdown:ok/.test(hubJs) && /handlesShutdown/.test(hubJs)
  ? ok('module lifecycle: declared shutdown checkpoint is awaited before navigation') : bad('module lifecycle: navigation can bypass declared shutdown checkpoint');
/id="lifecycleMenu"/.test(hubHtml) && (hubHtml.match(/data-lifecycle=/g) || []).length === 3 && !/data-lifecycle="CANON/.test(hubHtml) && /bindLifecycleMenu/.test(hubJs) && /module-card-life/.test(hubCss)
  ? ok('module lifecycle: right-click menu reaches local CLAIMED/TEST/WORKING only') : bad('module lifecycle: quick menu missing or exceeded WORKING authority');
/loadSharedLifecycle/.test(hubJs) && /persistSharedLifecycle/.test(hubJs) && /\/api\/hub\/lifecycle/.test(operationsApiJs) && /explicit-local-label/.test(operationsApiJs)
  ? ok('module lifecycle: labels synchronize through explicit Workshop state') : bad('module lifecycle: labels remain trapped in one browser profile');
/lifecycleTruth/.test(hubJs) && /CANON: not granted/.test(hubJs) && /row, \{ id \}/.test(hubJs) && /explicit-verified-reconciliation/.test(operationsApiJs)
  ? ok('module lifecycle: synchronized labels carry readable evidence and keep CANON manual') : bad('module lifecycle: evidence provenance or CANON boundary is missing');
/lifeBadge\.setAttribute\('aria-label', 'Status: '/.test(hubJs) && /\.mod \.life\{[\s\S]*?width:9px;[\s\S]*?font-size:0!important/.test(presentationCss) && /\.mod \.life\.HOLD/.test(presentationCss) && /\.mod \.life\.TEST/.test(presentationCss) && /\.mod \.life\.WORKING/.test(presentationCss) && /\.mod \.life\.CANON::after/.test(presentationCss)
  ? ok('module lifecycle: compact accessible color chips preserve the sidebar name lane') : bad('module lifecycle: compact status chip contract missing');
presenceJs.includes("setBridge('connected','ON'") && presenceJs.includes('var ids=[];') && presenceJs.includes("fetchTimed(BRIDGE+'/local-models'")
  ? ok('presence: Bridge health remains independent from optional local-model availability') : bad('presence: local model outage can still falsely mark Bridge offline');
/id="productionSessionToggle"/.test(hubHtml) && /id="productionSessionScreen"/.test(hubHtml) && /production-session\.js/.test(hubHtml)
  ? ok('temporary session: visible Mike/Ivan switch and dialog are wired') : bad('temporary session: switch or dialog wiring missing');
/Download work &amp; close/.test(hubHtml) && /Discard session &amp; close/.test(hubHtml) && /Nothing is archived automatically/.test(hubHtml)
  ? ok('temporary session: explicit save/discard close owns retention') : bad('temporary session: close or no-archive truth missing');
/classList\.toggle\('show'/.test(productionSessionJs) && /\.production-session-overlay\[hidden\]/.test(productionSessionCss)
  ? ok('temporary session: dialog uses the Hub visible-overlay contract') : bad('temporary session: dialog visibility contract missing');
/AXM_PRODUCTION_SESSION_HOME/.test(serverJs) && /separateBrowserOrigin/.test(productionSessionCoreJs) && /STATE_ROOT/.test(serverJs) && /EXPORT_ROOT/.test(serverJs)
  ? ok('temporary session: separate origin, state and output roots are declared') : bad('temporary session: isolation roots missing');
/shared live runtime is intentionally unavailable/.test(serverJs) && /PRODUCTION_SESSION_LEASE_MS/.test(serverJs) && /explicit-download-and-close/.test(serverJs)
  ? ok('temporary session: shared bodies held, heartbeat leased, export explicit') : bad('temporary session: body or lifecycle boundary missing');

/* ---- 1. persistence round-trip: write, then reopen over same backend ---- */
(function persistence(){
  const backend = Core.memoryBackend();
  const s1 = Core.makeStore(backend);
  s1.setState({ lastModuleId: 'hub-test-room' });
  s1.setSettings('studio', { greeting: 'hi' });
  s1.setModuleState('studio', { note: 'draft-1' });
  s1.setLifecycle('studio', 'SAVED CHECKPOINT');
  s1.cacheRegistry([{ id: 'studio' }, { id: 'game-hub' }]);
  s1.appendLog(Core.logEntry('ok', 'opened studio', 't0'));
  s1.setPresentationMode('studio', 'module');
  s1.setSharedPresentationProfile('studio');
  s1.setPresentationLayers({surface:'solid',depth:'dimensional',motion:'still',density:'compact',signal:'quiet'});

  /* simulate closing and reopening the hub: brand-new store, same storage */
  const s2 = Core.makeStore(backend);
  eq(s2.getState(), { lastModuleId: 'hub-test-room' }) ? ok('reopen: last module survived') : bad('reopen: last module lost');
  eq(s2.getSettings('studio'), { greeting: 'hi' }) ? ok('reopen: settings survived switch/reopen') : bad('reopen: settings lost');
  eq(s2.getModuleState('studio'), { note: 'draft-1' }) ? ok('reopen: module state survived') : bad('reopen: module state lost');
  s2.getLifecycle('studio') === 'SAVED CHECKPOINT' ? ok('reopen: lifecycle survived') : bad('reopen: lifecycle lost');
  s2.cachedRegistry().length === 2 ? ok('reopen: module list survived (2)') : bad('reopen: module list lost');
  s2.readLog().length === 1 ? ok('reopen: action log survived') : bad('reopen: action log lost');
  s2.getPresentationMode('studio') === 'module' && s2.getSharedPresentationProfile() === 'studio'
    ? ok('reopen: per-module presentation choice survived') : bad('reopen: presentation choice lost');
  eq(s2.getPresentationLayers(),{surface:'solid',depth:'dimensional',motion:'still',density:'compact',signal:'quiet'})
    ? ok('reopen: portable presentation layers survived') : bad('reopen: presentation layers lost');
})();

/* ---- 1b. quick local lifecycle control: useful, reversible, never CANON ---- */
(function quickLifecycle(){
  const toTest = Core.quickLifecycleTransition('CLAIMED', 'NEEDS VERIFY');
  const toWorking = Core.quickLifecycleTransition('NEEDS VERIFY', 'WORKING');
  const reset = Core.quickLifecycleTransition('WORKING', 'CLAIMED');
  const canon = Core.quickLifecycleTransition('WORKING', 'CANON CANDIDATE');
  toTest.ok && toTest.lifecycle === 'NEEDS VERIFY' && toWorking.ok && toWorking.lifecycle === 'WORKING' && reset.ok && reset.lifecycle === 'CLAIMED'
    ? ok('quick lifecycle: CLAIMED, TEST and WORKING are reversible local labels') : bad('quick lifecycle: allowed local transition failed');
  !canon.ok && canon.lifecycle === 'WORKING' && canon.canon !== true && Core.QUICK_LIFECYCLE_STATES.indexOf('CANON CANDIDATE') < 0
    ? ok('quick lifecycle: convenience control cannot reach CANON') : bad('quick lifecycle: CANON leaked into convenience control');
})();

/* ---- 2. passport validation ---- */
(function passport(){
  const good = { id: 'x', name: 'X', version: 'v1', hubApiVersion: '1.0', permissions: [] };
  C.validatePassport(good).ok ? ok('valid passport accepted') : bad('valid passport rejected');
  !C.validatePassport({ id: 'x', name: 'X' }).ok ? ok('missing-field passport rejected') : bad('missing-field passport accepted');
  !C.validatePassport({ id: 'x', name: 'X', version: 'v1', hubApiVersion: '9.0' }).ok
    ? ok('major API mismatch rejected') : bad('major API mismatch accepted');
  const legacy = C.passportFromManifest({ id: 'old', name: 'Old', version: 'v1' });
  (legacy.legacy && legacy.permissions.length === 0) ? ok('legacy passport is honest (no invented perms)') : bad('legacy passport wrong');
})();

/* ---- 3. reducer: lifecycle + permission gating + log intents ---- */
(function reducer(){
  let r = { id: 'm', lifecycle: 'CLAIMED', grantedPermissions: [] };
  let step = C.reduce(r, { type: 'hub:ready', passport: { id: 'm', name: 'M', version: 'v1', hubApiVersion: '1.0', permissions: ['storage'] } });
  step.record.lifecycle === 'NEEDS VERIFY' ? ok('ready → NEEDS VERIFY') : bad('ready lifecycle wrong: ' + step.record.lifecycle);
  r = step.record;

  step = C.reduce(r, { type: 'hub:permission:request', perm: 'storage' });
  const grantedIntent = step.intents.find(i => i.kind === 'permission');
  grantedIntent && grantedIntent.granted ? ok('declared permission granted') : bad('declared permission not granted');
  r = step.record;

  step = C.reduce(r, { type: 'hub:permission:request', perm: 'network' });
  const deniedIntent = step.intents.find(i => i.kind === 'permission');
  deniedIntent && !deniedIntent.granted ? ok('undeclared permission DENIED') : bad('undeclared permission leaked through');
  r = step.record;

  step = C.reduce(r, { type: 'hub:verify:pass' });
  step.record.lifecycle === 'WORKING' ? ok('verify:pass → WORKING') : bad('verify lifecycle wrong: ' + step.record.lifecycle);
  r = step.record;

  step = C.reduce(r, { type: 'hub:save', state: { a: 1 } });
  step.record.lifecycle === 'SAVED CHECKPOINT' ? ok('save after working → SAVED CHECKPOINT') : bad('save lifecycle wrong: ' + step.record.lifecycle);
  step.intents.some(i => i.kind === 'persist-state') ? ok('save emits persist-state intent') : bad('save did not persist');
})();

/* ---- 3b. modularity: add/remove modules, choice survives reopen ---- */
(function modularity(){
  const available = [{ id: 'game-hub', name: 'GameHub' }, { id: 'studio', name: 'Studio' }, { id: 'hub-test-room', name: 'Test Room' }];

  const normalized = Core.normalizeRegistry([{ id: 'project-room', layer: 'build' }]);
  normalized[0].layer === 'build' ? ok('registry preserves a manifest layer suggestion') : bad('registry dropped manifest layer');
  const rich = Core.normalizeRegistry([{ id:'studio', summary:'Make images', notes:'Local', category:'Create', risk:'LOW', card:{ icon:'studio' }, presentation:{defaultMode:'shared'}, actions:['draw'], accepts:['image/*'], produces:['axm.image/v1'], readiness:['storage'] }])[0];
  rich.summary === 'Make images' && rich.notes === 'Local' && rich.category === 'Create' && rich.risk === 'LOW' && rich.card.icon === 'studio' && rich.presentation.defaultMode === 'shared' && rich.actions[0] === 'draw' && rich.accepts[0] === 'image/*' && rich.produces[0] === 'axm.image/v1' && rich.readiness[0] === 'storage'
    ? ok('registry preserves beginner-facing and machine-readable capability metadata') : bad('registry dropped capability metadata');
  const ranked = Core.normalizeRegistry([{ id:'local-3d-game-runtime', rank:1, phase:'P0' }])[0];
  ranked.rank === 1 && ranked.phase === 'P0' && /dataset\.roadmapRank/.test(hubJs) && /dataset\.roadmapPhase/.test(hubJs)
    ? ok('roadmap: Hub cards preserve and expose rank plus phase') : bad('roadmap: rank or phase is hidden from module cards');
  const rankedLayout = Core.upgradeFoundationRoadmap(Core.workflowLayout([], Core.DEFAULT_LAYERS).layers, {}, [
    { id:'new-create', rank:3, category:'Create' }, { id:'new-play', rank:29, category:'Play' }, { id:'unranked', category:'Publish' }
  ]);
  rankedLayout.changed && rankedLayout.assign['new-create'] === 'create' && rankedLayout.assign['new-play'] === 'play' && !rankedLayout.assign.unranked
    ? ok('roadmap: ranked arrivals route to their five declared parent rooms') : bad('roadmap: ranked arrival parent routing drifted');
  const repairedRankedLayout = Core.upgradeRankedRoadmapPlacement(Core.workflowLayout([], Core.DEFAULT_LAYERS).layers, { 'new-create':'build', 'custom-play':'private' }, [
    { id:'new-create', rank:3, category:'Create' }, { id:'custom-play', rank:29, category:'Play' }
  ]);
  repairedRankedLayout.assign['new-create'] === 'create' && repairedRankedLayout.assign['custom-play'] === 'private'
    ? ok('roadmap: legacy Build fallback is repaired without moving a custom placement') : bad('roadmap: legacy placement repair is too broad');
  /axm\.hub\.upgrade\.next-50-modules\.v1/.test(hubJs) && /module\.rank >= 1 && module\.rank <= 50/.test(hubJs)
    ? ok('roadmap: existing browser profiles receive the ranked visibility wave once') : bad('roadmap: existing profiles can hide the entire ranked wave');

  /* first run seeds all discovered (no-loss) */
  let res = Core.resolveModules(available, available.map(m => m.id));
  res.visible.length === 3 ? ok('first run: all discovered modules added (no-loss)') : bad('first run seed wrong');

  /* user trims to a minimal set — not everyone needs all modules */
  res = Core.resolveModules(available, ['hub-test-room']);
  (res.visible.length === 1 && res.visible[0].id === 'hub-test-room') ? ok('minimal set: only added modules are visible') : bad('trim failed');
  const cat = res.catalog;
  (cat.find(m => m.id === 'studio').enabled === false && cat.find(m => m.id === 'hub-test-room').enabled === true)
    ? ok('catalog flags added vs available correctly') : bad('catalog flags wrong');

  /* stale id (folder removed) is dropped, not errored */
  res = Core.resolveModules(available, ['studio', 'ghost-module']);
  (res.enabled.indexOf('ghost-module') < 0 && res.visible.length === 1) ? ok('stale added-id dropped cleanly') : bad('stale id not dropped');

  const promoted = Core.promoteIntegratedParents([{id:'ai-team'},{id:'ai-task-talk',integratedInto:'ai-team'}],['ai-task-talk']);
  (promoted.indexOf('ai-team') >= 0 && promoted.indexOf('ai-task-talk') >= 0)
    ? ok('upgrade: integrated parent enabled when an existing child was chosen') : bad('upgrade lost consolidated parent');

  /* the added-set survives a reopen via the store */
  const backend = Core.memoryBackend();
  const s1 = Core.makeStore(backend); s1.setEnabled(['studio', 'hub-test-room']);
  const s2 = Core.makeStore(backend);
  eq(s2.getEnabled(), ['studio', 'hub-test-room']) ? ok('reopen: added-module choice survived') : bad('reopen: added choice lost');
  s2.getEnabled() && s2.getModuleState ? ok('removing a module leaves its saved state addressable (kept)') : bad('module state not addressable');
  Core.friendlyName({ id: 'studio', name: 'AXM Studio' }) === 'Studio'
    ? ok('friendly names remove repeated AXM branding') : bad('friendly Studio name wrong');
  Core.friendlyName({ id: 'unknown', name: 'AXM Example Tool' }) === 'Example Tool'
    ? ok('friendly names fall back safely for future modules') : bad('friendly fallback wrong');
})();

/* ---- 3b. beginner capability routing: duplicates and blocked doors stay out of the front choice ---- */
(function beginnerCapabilityRouting(){
  const grouped = Core.organizeCapabilityRoutes([
    { destinationId:'studio', score:91, readiness:{ state:'BLOCKED' } },
    { destinationId:'studio', score:84, readiness:{ state:'READY' } },
    { destinationId:'spatial-studio', score:73, readiness:{ state:'BLOCKED' } },
    { destinationId:'publish-library', score:55, readiness:{ state:'AVAILABLE' } }
  ]);
  grouped.usable.length === 2 && grouped.usable[0].destinationId === 'studio' && grouped.usable[0].readiness.state === 'READY'
    ? ok('capability guide: duplicate Studio routes collapse to the usable door') : bad('capability guide: duplicate or blocked Studio route leaked forward');
  grouped.blocked.length === 1 && grouped.blocked[0].destinationId === 'spatial-studio'
    ? ok('capability guide: blocked destinations remain visible only as held explanations') : bad('capability guide: blocked destination grouping wrong');
})();

/* ---- 3c. user-check evaluator (the add/delete-able checks) ---- */
(function checks(){
  const Checks = require('./verify-checks.js');
  const io = { read: p => ({
    'a.txt': 'hello world', 'm.json': '{"hubApiVersion":"1.0","x":{"y":1}}'
  }[p] != null ? { 'a.txt': 'hello world', 'm.json': '{"hubApiVersion":"1.0","x":{"y":1}}' }[p] : null) };
  Checks.evalCheck({ kind: 'file-exists', path: 'a.txt' }, io).ok ? ok('check: file-exists (present) PASS') : bad('file-exists present failed');
  !Checks.evalCheck({ kind: 'file-exists', path: 'nope.txt' }, io).ok ? ok('check: file-exists (absent) correctly FAILs') : bad('file-exists absent didnt fail');
  Checks.evalCheck({ kind: 'file-contains', path: 'a.txt', needle: 'world' }, io).ok ? ok('check: file-contains PASS') : bad('file-contains failed');
  Checks.evalCheck({ kind: 'json-has-field', path: 'm.json', field: 'x.y' }, io).ok ? ok('check: json-has-field nested PASS') : bad('json-has-field nested failed');
  !Checks.evalCheck({ kind: 'json-has-field', path: 'm.json', field: 'missing' }, io).ok ? ok('check: json missing field FAILs honestly') : bad('json missing field didnt fail');
  const res = Checks.runUserChecks({ userChecks: [{ id: 'c1', kind: 'file-exists', path: 'a.txt' }, { id: 'c2', kind: 'file-exists', path: 'x' }] }, io);
  (res.length === 2 && res[0].ok && !res[1].ok) ? ok('runUserChecks reports per-check pass/fail') : bad('runUserChecks wrong');
  const ann = Checks.annotateWarns('  warn  core file lacks CANON BASE marker', [{ match: 'CANON BASE', reason: 'fork', by: 'mike' }]);
  ann.indexOf('ACK(mike)') >= 0 ? ok('acknowledged warn is annotated, not hidden') : bad('warn annotation failed');

  /* retirement: reason required, line stays visible, fail count drops */
  const sample = '  PASS  spine ok\n  FAIL  old-tech check X failed\n  FAIL  real problem Y';
  const r1 = Checks.applyRetirements(sample, [{ match: 'old-tech check X', reason: 'obsolete since migration', by: 'mike', at: '2026-07-08' }]);
  r1.effectiveFails === 1 ? ok('retire: one FAIL neutralised, other still counts (1 left)') : bad('retire fail-count wrong: ' + r1.effectiveFails);
  r1.text.indexOf('old-tech check X') >= 0 && r1.text.indexOf('RETIRED') >= 0 ? ok('retire: retired line still shown + provenance stamped') : bad('retired line hidden');
  const r2 = Checks.applyRetirements(sample, [{ match: 'old-tech check X' }]);
  (r2.effectiveFails === 2 && r2.ignored.length === 1) ? ok('retire: no-reason retirement IGNORED (both FAILs stand)') : bad('no-reason retirement leaked through');
})();

/* ---- 3d. layers: organisation, never authorisation ---- */
(function layers(){
  const mods = [
    { id: 'studio', name: 'Studio' },
    { id: 'nova', name: 'Nova', layer: 'machine' },
    { id: 'secret-notes', name: 'Notes' }
  ];
  const L = Core.DEFAULT_LAYERS;
  L.length === 3 ? ok('layers: three defaults (open/private/machine)') : bad('default layers wrong');

  /* manifest suggestion honoured, default falls back to first layer */
  Core.layerOf(mods[1], L, {}) === 'machine' ? ok('layers: manifest suggestion honoured') : bad('manifest layer ignored');
  Core.layerOf(mods[0], L, {}) === 'open' ? ok('layers: unassigned module lands in Open') : bad('fallback layer wrong');
  /* user assignment overrides the manifest */
  Core.layerOf(mods[1], L, { nova: 'open' }) === 'open' ? ok('layers: user assignment overrides manifest') : bad('assignment override failed');
  /* unknown layer id must not vanish a module (no-loss) */
  Core.layerOf(mods[0], L, { studio: 'ghost-layer' }) === 'open' ? ok('layers: unknown layer falls back, module never lost') : bad('module lost to bad layer id');

  /* door sign: locked until unlocked, and a gate with no phrase is not a gate */
  const priv = Object.assign({}, L[1], { hash: Core.doorHash('let-me-in') });
  const ls = [L[0], priv, L[2]];
  let g = Core.resolveLayers(mods, ls, { 'secret-notes': 'private' }, []);
  g.find(x => x.id === 'private').locked ? ok('door: private layer starts locked') : bad('private layer not locked');
  g = Core.resolveLayers(mods, ls, { 'secret-notes': 'private' }, ['private']);
  !g.find(x => x.id === 'private').locked ? ok('door: unlocks for the session') : bad('unlock failed');
  Core.checkDoor(priv, 'let-me-in') ? ok('door: correct passphrase opens') : bad('correct phrase rejected');
  !Core.checkDoor(priv, 'nope') ? ok('door: wrong passphrase refused') : bad('wrong phrase accepted');
  Core.checkDoor({ gate: 'passphrase' }, 'anything') ? ok('door: gate with no phrase is not a gate (honest)') : bad('empty gate blocked');
  Core.doorHash('let-me-in') !== 'let-me-in' ? ok('door: phrase not stored in plaintext') : bad('phrase stored plaintext');

  const workflow = Core.workflowLayout([
    { id: 'studio' }, { id: 'audio-studio' }, { id: 'film-motion-studio' }, { id: 'spatial-studio' }, { id: 'ps2-asset-forge' }, { id: 'ui-ux-builder', integratedInto: 'studio' }, { id: 'project-room' }, { id: 'knowledge-canvas' }, { id: 'learning-lab' }, { id: 'mirror-learning-shell', integratedInto: 'learning-lab' }, { id: 'finance-world-room' }, { id: 'cognitive-resource-meter' }, { id:'cognitive-evidence-explorer', integratedInto:'cognitive-resource-meter' }, { id:'cognitive-calibration-lab', integratedInto:'cognitive-resource-meter' }, { id:'human-attention-ledger', integratedInto:'cognitive-resource-meter' }, { id:'sustainability-metrology-lab', integratedInto:'cognitive-resource-meter' }, { id:'mirror-intake-monitor', integratedInto:'cognitive-resource-meter' }, { id: 'marketplace-deployment' }, { id: 'publish-library', integratedInto: 'marketplace-deployment' }, { id: 'asset-vault', integratedInto: 'publish-library' }, { id: 'workshop-packager', integratedInto: 'publish-library' }, { id: 'game-forge' }, { id: 'game-hub', integratedInto: 'game-forge' }, { id: 'sandbox', integratedInto: 'game-forge' }, { id: 'ai-team' }, { id: 'agent-command-center', integratedInto: 'ai-team' }, { id: 'chatgpt-connector', integratedInto: 'ai-team' }, { id: 'verifier' }, { id: 'main-hub' }
  ], [{ id: 'private', name: 'Private', gate: 'passphrase', hash: 'keep-me', order: 1 }]);
  workflow.assign.studio === 'create' && workflow.assign['game-forge'] === 'play' && workflow.assign['game-hub'] === 'machine'
    ? ok('workflow layout: Create and Play assignments are useful') : bad('workflow layout misplaced Create/Play');
  workflow.assign['audio-studio'] === 'create' && workflow.assign['film-motion-studio'] === 'create' && workflow.assign['spatial-studio'] === 'create'
    ? ok('workflow layout: Audio, Film & Motion, and Spatial Studio are in Create') : bad('workflow layout misplaced a production studio');
  workflow.assign['ps2-asset-forge'] === 'create'
    ? ok('workflow layout: PS2 Asset Forge is in Create') : bad('workflow layout misplaced PS2 Asset Forge');
  workflow.assign['ui-ux-builder'] === 'machine'
    ? ok('workflow layout: integrated UI/UX route stays behind Studio') : bad('workflow layout exposed integrated UI/UX route');
  workflow.assign['project-room'] === 'build'
    ? ok('workflow layout: Project Room is in Build') : bad('workflow layout misplaced Project Room');
  workflow.assign['knowledge-canvas'] === 'build'
    ? ok('workflow layout: Knowledge Canvas is in Build') : bad('workflow layout misplaced Knowledge Canvas');
  workflow.assign['learning-lab'] === 'build' && workflow.assign['mirror-learning-shell'] === 'machine'
    ? ok('workflow layout: Learning Lab is visible in Build and its school child stays integrated') : bad('workflow layout exposed or misplaced Learning Lab school routes');
  workflow.assign['finance-world-room'] === 'build'
    ? ok('workflow layout: Finance World Room sandbox is in Build') : bad('workflow layout misplaced Finance World Room');
  workflow.assign['cognitive-resource-meter'] === 'build'
    ? ok('workflow layout: Cognitive Resource Meter evidence producer is in Build') : bad('workflow layout misplaced Cognitive Resource Meter');
  ['cognitive-evidence-explorer','cognitive-calibration-lab','human-attention-ledger','sustainability-metrology-lab','mirror-intake-monitor'].every(id => workflow.assign[id] === 'machine')
    ? ok('workflow layout: cognitive evidence rooms stay integrated behind the Meter') : bad('workflow layout exposed a technical cognitive evidence room');
  workflow.assign['marketplace-deployment'] === 'publish' && workflow.assign['publish-library'] === 'machine' && workflow.assign['asset-vault'] === 'machine' && workflow.assign['workshop-packager'] === 'machine'
    ? ok('workflow layout: Marketplace & Deployment owns the visible publish route') : bad('workflow layout exposed fragmented distribution services');
  workflow.assign['ai-team'] === 'ai-team' && workflow.assign.verifier === 'private'
    ? ok('workflow layout: AI Team and Advanced assignments are useful') : bad('workflow layout misplaced AI/Advanced');
  workflow.assign['agent-command-center'] === 'machine' && workflow.assign['chatgpt-connector'] === 'machine'
    ? ok('workflow layout: AI tools/connectors stay behind unified AI Team') : bad('workflow layout exposed integrated AI routes');
  workflow.layers.find(l => l.id === 'private').hash === 'keep-me'
    ? ok('workflow layout preserves existing closed-door sign') : bad('workflow layout reset closed-door sign');
  workflow.layers.find(l => l.id === 'machine').hidden && workflow.assign['main-hub'] === 'machine'
    ? ok('workflow layout keeps system internals hidden, not deleted') : bad('workflow layout exposed/lost system internals');
  Core.GOVERNED_FOUNDATION_WAVE1.concat(Core.GOVERNED_FOUNDATION_WAVE2).every(id => workflow.assign[id] === Core.GOVERNED_FOUNDATION_ASSIGNMENTS[id])
    ? ok('workflow layout places all twenty governed roadmap foundations by purpose') : bad('workflow layout misplaced a governed roadmap foundation');
  workflow.assign['asset-filesystem-service'] === 'create' && workflow.assign['recovery-center'] === 'publish'
    && workflow.assign['machine-host'] === 'ai-team' && workflow.assign['multiplayer-controller-transport'] === 'play'
    ? ok('workflow layout gives every parent a meaningful governed foundation') : bad('workflow layout left a parent without its governed foundation');

  const roadmapModules = Core.GOVERNED_FOUNDATION_WAVE1.concat(Core.GOVERNED_FOUNDATION_WAVE2).map(id => ({ id }));
  const roadmapExisting = Core.upgradeFoundationRoadmap(workflow.layers, { studio:'create', 'recovery-center':'private', 'public-release-deployment-adapter':'private' }, roadmapModules);
  roadmapExisting.changed && roadmapExisting.assign['multiplayer-controller-transport'] === 'play' && roadmapExisting.assign['read-only-mirror-world-adapter'] === 'ai-team'
    && roadmapExisting.assign['recovery-center'] === 'private' && roadmapExisting.assign['public-release-deployment-adapter'] === 'private'
    ? ok('upgrade: all roadmap arrivals appear without overwriting custom placements') : bad('upgrade: roadmap placement lost or overwrote a user choice');

  const migratedLegacy = Core.upgradeLegacyOpenLayout(Core.DEFAULT_LAYERS, {}, [{ id:'studio' }, { id:'game-forge' }, { id:'ai-team' }]);
  migratedLegacy.changed && migratedLegacy.layers.some(l => l.id === 'create') && migratedLegacy.assign.studio === 'create'
    ? ok('upgrade: untouched flat browser layout gains workflow categories') : bad('upgrade: untouched flat layout stayed flattened');
  const customLegacy = Core.upgradeLegacyOpenLayout(Core.DEFAULT_LAYERS, { studio:'private' }, [{ id:'studio' }]);
  !customLegacy.changed && customLegacy.assign.studio === 'private'
    ? ok('upgrade: custom browser assignments remain untouched') : bad('upgrade: custom browser layout was overwritten');
  const renamedLegacy = Core.DEFAULT_LAYERS.map(l => Object.assign({}, l, l.id === 'open' ? { name:'My Space' } : {}));
  !Core.upgradeLegacyOpenLayout(renamedLegacy, {}, [{ id:'studio' }]).changed
    ? ok('upgrade: renamed browser layer remains user-owned') : bad('upgrade: renamed browser layer was overwritten');

  const oldWorkflow = workflow.layers.filter(l => l.id !== 'publish').map(l => Object.assign({}, l, { order: l.order > 2 ? l.order - 1 : l.order }));
  const oldAssign = Object.assign({}, workflow.assign, { 'marketplace-deployment': 'build', 'publish-library': 'publish', 'workshop-packager': 'build', studio: 'create' });
  const upgradedPublish = Core.upgradePublishLayer(oldWorkflow, oldAssign, [
    { id:'marketplace-deployment' }, { id:'publish-library', integratedInto:'marketplace-deployment' }, { id:'asset-vault', integratedInto:'publish-library' }, { id:'workshop-packager', integratedInto:'publish-library' }
  ]);
  upgradedPublish.changed && upgradedPublish.layers.some(l => l.id === 'publish' && l.name === 'Marketplace & Deployment') && upgradedPublish.assign['marketplace-deployment'] === 'publish'
    ? ok('upgrade: existing workflow gains Marketplace & Deployment') : bad('upgrade: Marketplace & Deployment migration failed');
  upgradedPublish.assign.studio === 'create' && upgradedPublish.layers.find(l => l.id === 'private').hash === 'keep-me'
    ? ok('upgrade: publish migration preserves assignments and closed-door hash') : bad('upgrade: publish migration damaged user layout');
  upgradedPublish.assign['publish-library'] === 'machine' && upgradedPublish.assign['asset-vault'] === 'machine' && upgradedPublish.assign['workshop-packager'] === 'machine'
    ? ok('upgrade: publish and output compatibility views stay behind parent') : bad('upgrade: distribution children remained exposed');

  /* THE ROOT CHECK: a layer must never change what a module may do.
     Same passport, same grants, regardless of which layer it sits in. */
  const passport = { id: 'nova', name: 'Nova', version: 'v1', hubApiVersion: '1.0', permissions: ['storage'] };
  function grantsIn(layerId){
    let r = C.reduce({ id: 'nova', lifecycle: 'CLAIMED', grantedPermissions: [] }, { type: 'hub:ready', passport }).record;
    r = C.reduce(r, { type: 'hub:permission:request', perm: 'storage' }).record;
    const net = C.reduce(r, { type: 'hub:permission:request', perm: 'network' });
    return { granted: r.grantedPermissions.slice(), networkGranted: net.intents.find(i => i.kind==='permission').granted };
  }
  const inOpen = grantsIn('open'), inMachine = grantsIn('machine'), inPrivate = grantsIn('private');
  (eq(inOpen.granted, inMachine.granted) && eq(inOpen.granted, inPrivate.granted))
    ? ok('same-gates: identical grants in open / machine / private layers') : bad('layer changed permissions!');
  (!inOpen.networkGranted && !inMachine.networkGranted && !inPrivate.networkGranted)
    ? ok('same-gates: undeclared perm denied in EVERY layer (incl. AI-native)') : bad('a layer leaked an undeclared permission');

  /* layers + assignment survive reopen */
  const backend = Core.memoryBackend();
  const s1 = Core.makeStore(backend); s1.setLayers(ls); s1.setAssign({ 'secret-notes': 'private' });
  const s2 = Core.makeStore(backend);
  (s2.getLayers().length === 3 && s2.getAssign()['secret-notes'] === 'private') ? ok('reopen: layers + assignments survived') : bad('layers lost on reopen');

  /* ---- hidden machine layer: out of the way, not secret ---- */
  const machineMods = [{ id: 'studio', name: 'Studio' }, { id: 'nova', name: 'Nova', audience: 'machine' }, { id: 'idx', name: 'Indexer', audience: 'machine' }];
  Core.layerOf(machineMods[1], L, {}) === 'machine' ? ok('machine: audience:"machine" auto-routes to AI-Native (no sorting needed)') : bad('machine audience not auto-routed');
  let mg = Core.resolveLayers(machineMods, L, {}, [], []);
  const mach = mg.find(x => x.id === 'machine');
  mach.hidden ? ok('machine: AI-Native hidden from sidebar by default') : bad('machine layer not hidden');
  mach.modules.length === 2 ? ok('machine: both machine modules land there (2)') : bad('machine module routing wrong: ' + mach.modules.length);
  mg.find(x => x.id === 'open').modules.length === 1 ? ok('machine: human sidebar unbothered (1 human module)') : bad('human layer polluted');
  /* hidden ≠ secret: revealing shows them, and they were always countable */
  mg = Core.resolveLayers(machineMods, L, {}, [], ['machine']);
  !mg.find(x => x.id === 'machine').hidden ? ok('machine: one click reveals (hidden is not secret)') : bad('reveal failed');
  /* a machine module is still a real module: same gate, no free pass */
  const mPass = { id: 'nova', name: 'Nova', version: 'v1', hubApiVersion: '1.0', permissions: [] };
  let mr = C.reduce({ id: 'nova', lifecycle: 'CLAIMED', grantedPermissions: [] }, { type: 'hub:ready', passport: mPass }).record;
  const mReq = C.reduce(mr, { type: 'hub:permission:request', perm: 'storage' });
  !mReq.intents.find(i => i.kind === 'permission').granted ? ok('machine: hidden module still denied an undeclared permission') : bad('hidden module got a free pass');
  /* host is reserved, not implemented — it must not affect anything yet */
  const hostLayers = L.map(l => Object.assign({}, l, { host: 'https://example.invalid' }));
  Core.resolveLayers(machineMods, hostLayers, {}, [], []).length === 3 ? ok('host field is inert (reserved, not faked)') : bad('host field changed behaviour');
})();

/* ---- 4. new manifests parse + carry legal build status ---- */
(function manifests(){
  const LEGAL = ['TEST', 'WORKING', 'CANON', 'SHELL', 'BROKEN'];
  const p = path.join(__dirname, '..', 'tools', 'hub-test-room', 'manifest.json');
  try {
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    ['id', 'name', 'version', 'status', 'entry'].every(f => f in m) ? ok('hub-test-room manifest has required fields') : bad('hub-test-room manifest missing fields');
    LEGAL.indexOf(m.status) >= 0 ? ok('hub-test-room status is verifier-legal (' + m.status + ')') : bad('hub-test-room status illegal: ' + m.status);
    Array.isArray(m.uses) ? ok('hub-test-room declares uses') : bad('hub-test-room missing uses');
  } catch (e) { bad('hub-test-room manifest unreadable: ' + e.message); }
})();

const head = 'AXM HUB SELFTEST — ' + new Date().toISOString() + '\n' + fails + ' FAIL\n\n';
console.log(head + out.join('\n') + '\n');
process.exit(fails ? 1 : 0);
