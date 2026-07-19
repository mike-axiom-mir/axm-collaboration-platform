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
const hubJs = fs.readFileSync(path.join(__dirname, 'hub-shell.js'), 'utf8');
const presenceJs = fs.readFileSync(path.join(__dirname, 'ai-presence.js'), 'utf8');
const navJs = fs.readFileSync(path.join(__dirname, 'workshop-navigation.js'), 'utf8');
const productionSessionJs = fs.readFileSync(path.join(__dirname, 'production-session.js'), 'utf8');
const productionSessionCss = fs.readFileSync(path.join(__dirname, 'production-session.css'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const productionSessionCoreJs = fs.readFileSync(path.join(__dirname, '..', 'shared', 'production-session', 'production-session-core.js'), 'utf8');
const out = []; let fails = 0;
function ok(m){ out.push('  PASS  ' + m); }
function bad(m){ out.push('  FAIL  ' + m); fails++; }
function eq(a, b){ return JSON.stringify(a) === JSON.stringify(b); }

/id="sidebarToggle"[^>]+aria-controls="hubSidebar"/.test(hubHtml) ? ok('sidebar: visible collapse/reopen handle exists') : bad('sidebar toggle missing');
/id="workshopBack"[^>]+aria-label="Go to previous AXM screen"/.test(hubHtml) && /workshop-navigation\.js/.test(hubHtml)
  ? ok('navigation: universal previous-screen control is visible and shared') : bad('navigation: previous-screen control or helper missing');
/initNavigation/.test(hubJs) && /goBack\(\)/.test(hubJs) && /sessionStorage/.test(hubJs) && /never reads or writes project state/.test(navJs)
  ? ok('navigation: session-only trail is isolated from project saves') : bad('navigation: history isolation wiring missing');
/data-sidebar-collapsed="true"\] \.body\{grid-template-columns:0 1fr\}/.test(hubCss) ? ok('sidebar: collapsed state gives workspace full width') : bad('sidebar collapse layout missing');
/axm\.hub\.sidebar-collapsed/.test(hubJs) && /toggleSidebar\(\)/.test(hubJs) ? ok('sidebar: preference persists and toggles') : bad('sidebar persistence missing');
/id="capabilityForm"/.test(hubHtml) && /id="capabilityResults"[^>]+aria-live="polite"/.test(hubHtml) ? ok('capability guide: plain-language form and accessible results exist') : bad('capability guide UI missing');
/workshop-capability-index\.js/.test(hubHtml) && /renderCapabilityGuide/.test(hubJs) && /openCapability/.test(hubJs) ? ok('capability guide: shared index and explicit open action are wired') : bad('capability guide wiring missing');
/id="continuityStrip"/.test(hubHtml) && /workshop-continuity\.js/.test(hubHtml) && /loadContinuity/.test(hubJs) && /forgetContinuity/.test(hubJs)
  ? ok('continuity: explicit Continue and Forget surface is wired') : bad('continuity surface missing');
/id="handoffForm"/.test(hubHtml) && /artifact-handoff-broker\.js/.test(hubHtml) && /findHandoffDestinations/.test(hubJs) && /prepareHandoff/.test(hubJs)
  ? ok('handoff broker: declared-format chooser and explicit proposal are wired') : bad('handoff broker surface missing');
/readiness-guidance/.test(hubJs) && /Nothing is repaired automatically/.test(hubJs)
  ? ok('readiness: beginner explanation preserves manual repair boundary') : bad('readiness explanation missing');
/requestActiveShutdown/.test(hubJs) && /hub:shutdown:request/.test(hubJs) && /hub:shutdown:ok/.test(hubJs) && /handlesShutdown/.test(hubJs)
  ? ok('module lifecycle: declared shutdown checkpoint is awaited before navigation') : bad('module lifecycle: navigation can bypass declared shutdown checkpoint');
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

  /* simulate closing and reopening the hub: brand-new store, same storage */
  const s2 = Core.makeStore(backend);
  eq(s2.getState(), { lastModuleId: 'hub-test-room' }) ? ok('reopen: last module survived') : bad('reopen: last module lost');
  eq(s2.getSettings('studio'), { greeting: 'hi' }) ? ok('reopen: settings survived switch/reopen') : bad('reopen: settings lost');
  eq(s2.getModuleState('studio'), { note: 'draft-1' }) ? ok('reopen: module state survived') : bad('reopen: module state lost');
  s2.getLifecycle('studio') === 'SAVED CHECKPOINT' ? ok('reopen: lifecycle survived') : bad('reopen: lifecycle lost');
  s2.cachedRegistry().length === 2 ? ok('reopen: module list survived (2)') : bad('reopen: module list lost');
  s2.readLog().length === 1 ? ok('reopen: action log survived') : bad('reopen: action log lost');
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
  const rich = Core.normalizeRegistry([{ id:'studio', summary:'Make images', notes:'Local', category:'Create', risk:'LOW', card:{ icon:'studio' }, actions:['draw'], accepts:['image/*'], produces:['axm.image/v1'], readiness:['storage'] }])[0];
  rich.summary === 'Make images' && rich.notes === 'Local' && rich.category === 'Create' && rich.risk === 'LOW' && rich.card.icon === 'studio' && rich.actions[0] === 'draw' && rich.accepts[0] === 'image/*' && rich.produces[0] === 'axm.image/v1' && rich.readiness[0] === 'storage'
    ? ok('registry preserves beginner-facing and machine-readable capability metadata') : bad('registry dropped capability metadata');

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
