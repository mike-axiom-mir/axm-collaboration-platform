/* ============================================================
   AXM Hub — HubShell + ModuleRegistry + HubStore  (hub-shell.js)
   Outer stable. The shell owns chrome + persistence + the viewport
   that hosts modules by <iframe> (same URL the old launcher opened
   in a tab — so every existing tool works here UNCHANGED).
   UMD: pure store/registry logic is exported for Node self-test.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.HubCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NS = 'axm.hub.';
  const GOVERNED_FOUNDATION_WAVE1 = Object.freeze([
    'recovery-center', 'module-installer', 'machine-host', 'review-inbox', 'module-contract-workbench',
    'secrets-permissions-console', 'diagnostics-operations-center', 'workshop-search-provenance', 'asset-filesystem-service', 'device-handoff'
  ]);
  const GOVERNED_FOUNDATION_WAVE2 = Object.freeze([
    'browser-lan-hardware-qa-lab', 'template-runtime-pack-engine', 'source-connector-hub', 'media-render-transcode-service', 'living-world-state-server',
    'multiplayer-controller-transport', 'living-world-ruleset-physics-adapter-kit', 'read-only-mirror-world-adapter', 'novelty-diversity-engine', 'public-release-deployment-adapter'
  ]);
  const GOVERNED_FOUNDATION_ASSIGNMENTS = Object.freeze({
    'asset-filesystem-service':'create', 'device-handoff':'create', 'presentation-spine':'create', 'ui-fx':'create',
    'module-installer':'build', 'module-contract-workbench':'build', 'diagnostics-operations-center':'build', 'workshop-search-provenance':'build',
    'recovery-center':'publish', 'review-inbox':'publish',
    'machine-host':'ai-team', 'secrets-permissions-console':'ai-team',
    'template-runtime-pack-engine':'create', 'media-render-transcode-service':'create',
    'browser-lan-hardware-qa-lab':'build', 'source-connector-hub':'build', 'living-world-state-server':'build', 'novelty-diversity-engine':'build',
    'public-release-deployment-adapter':'publish',
    'multiplayer-controller-transport':'play', 'living-world-ruleset-physics-adapter-kit':'play',
    'read-only-mirror-world-adapter':'ai-team'
  });
  const ROADMAP_PARENT_LAYERS = Object.freeze({ Create:'create', Build:'build', Publish:'publish', Play:'play', 'AI Team':'ai-team' });
  /* Fast human-owned labels for the local Hub only. Deliberately capped at
     WORKING: CANON remains in the separate governed promotion path. */
  const QUICK_LIFECYCLE_STATES = Object.freeze(['CLAIMED', 'NEEDS VERIFY', 'WORKING']);

  function quickLifecycleTransition(current, target) {
    const previous = String(current || 'CLAIMED');
    const next = String(target || '').trim();
    if (QUICK_LIFECYCLE_STATES.indexOf(next) < 0) {
      return { ok:false, previous, lifecycle:previous, reason:'quick lifecycle stops at WORKING' };
    }
    return { ok:true, previous, lifecycle:next, changed:previous !== next, authority:'LOCAL_LIFECYCLE_ONLY', canon:false };
  }

  /* ---- HubStore: one persistence interface, swappable backend ----
     browser -> localStorage ; node/self-test -> in-memory map.
     Everything the hub must survive-a-reload lives here. */
  function memoryBackend() {
    const m = {};
    return {
      get: k => (k in m ? m[k] : null),
      set: (k, v) => { m[k] = v; },
      remove: k => { delete m[k]; },
      keys: () => Object.keys(m)
    };
  }
  function localStorageBackend() {
    return {
      get: k => window.localStorage.getItem(k),
      set: (k, v) => window.localStorage.setItem(k, v),
      remove: k => window.localStorage.removeItem(k),
      keys: () => Object.keys(window.localStorage)
    };
  }
  function makeStore(backend) {
    function j(v) { try { return JSON.stringify(v); } catch (e) { return null; } }
    function p(s) { try { return JSON.parse(s); } catch (e) { return null; } }
    return {
      _b: backend,
      getState() { return p(backend.get(NS + 'state')) || { lastModuleId: null }; },
      setState(s) { backend.set(NS + 'state', j(s)); },
      getSettings(id) { return p(backend.get(NS + 'settings.' + id)) || {}; },
      setSettings(id, s) { backend.set(NS + 'settings.' + id, j(s)); },
      getModuleState(id) { return p(backend.get(NS + 'mstate.' + id)); },
      setModuleState(id, st) { backend.set(NS + 'mstate.' + id, j(st)); },
      getLifecycle(id) { return backend.get(NS + 'life.' + id) || 'CLAIMED'; },
      setLifecycle(id, l) { backend.set(NS + 'life.' + id, l); },
      cacheRegistry(list) { backend.set(NS + 'registry', j(list)); },
      cachedRegistry() { return p(backend.get(NS + 'registry')) || []; },
      appendLog(entry, cap) {
        const log = p(backend.get(NS + 'log')) || [];
        log.push(entry); while (log.length > (cap || 200)) log.shift();
        backend.set(NS + 'log', j(log)); return log;
      },
      readLog() { return p(backend.get(NS + 'log')) || []; },
      clearLog() { backend.set(NS + 'log', j([])); },
      /* which modules the user has ADDED to their system. null = never chosen
         yet (first run) so the caller can seed it without forcing a set. */
      getEnabled() { const e = p(backend.get(NS + 'enabled')); return Array.isArray(e) ? e : null; },
      setEnabled(list) { backend.set(NS + 'enabled', j(list)); },
      /* ---- layers: organisation, never authorisation ---- */
      getLayers() { const l = p(backend.get(NS + 'layers')); return Array.isArray(l) ? l : null; },
      setLayers(list) { backend.set(NS + 'layers', j(list)); },
      getAssign() { return p(backend.get(NS + 'assign')) || {}; },
      setAssign(map) { backend.set(NS + 'assign', j(map)); },
      getActiveLayer() { return backend.get(NS + 'activeLayer') || null; },
      setActiveLayer(id) { backend.set(NS + 'activeLayer', id); },
      getPresentationMode(id) { const value = backend.get(NS + 'presentation.mode.' + id); return value === 'shared' || value === 'module' ? value : null; },
      setPresentationMode(id, mode) {
        if (mode !== 'shared' && mode !== 'module') throw new Error('Unknown presentation mode: ' + mode);
        backend.set(NS + 'presentation.mode.' + id, mode);
      },
      getSharedPresentationProfile() {
        const value = backend.get(NS + 'presentation.profile');
        return ['auto','cockpit','studio','dashboard','lab'].indexOf(value) >= 0 ? value : 'auto';
      },
      setSharedPresentationProfile(profile) {
        if (['auto','cockpit','studio','dashboard','lab'].indexOf(profile) < 0) throw new Error('Unknown shared profile: ' + profile);
        backend.set(NS + 'presentation.profile', profile);
      },
      getPresentationLayers() {
        const value = p(backend.get(NS + 'presentation.layers'));
        const defaults = { surface:'glass', depth:'raised', motion:'responsive', density:'balanced', signal:'clear' };
        const allowed = {surface:['glass','solid','minimal'],depth:['flat','raised','dimensional'],motion:['still','responsive','ambient'],density:['compact','balanced','comfortable'],signal:['quiet','clear','luminous']};
        if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
        Object.keys(defaults).forEach(key => { if (allowed[key].indexOf(value[key]) >= 0) defaults[key] = value[key]; });
        return defaults;
      },
      setPresentationLayers(layers) {
        if (!layers || typeof layers !== 'object' || Array.isArray(layers)) throw new Error('Presentation layers must be an object');
        backend.set(NS + 'presentation.layers', j(layers));
      }
    };
  }

  /* ---- Registry: normalize whatever /api/tools returns ---- */
  function normalizeRegistry(apiTools) {
    return (apiTools || []).map(t => ({
      id: t.id, name: t.name || t.id, folder: t.folder || t.id,
      entry: t.entry || 'index.html', version: t.version || '?',
      rank: Number.isInteger(t.rank) ? t.rank : null, phase: t.phase || null,
      status: t.status || 'TEST', tags: t.tags || [], uses: t.uses || [],
      audience: t.audience || 'human', layer: t.layer || null,
      integratedInto: t.integratedInto || null, serviceRole: t.serviceRole || null,
      summary: t.summary || '', notes: t.notes || '', category: t.category || '',
      risk: t.risk || null, card: t.card && typeof t.card === 'object' ? t.card : null,
      presentation: t.presentation && typeof t.presentation === 'object' ? t.presentation : null,
      actions: t.actions || [], accepts: t.accepts || [], produces: t.produces || [], readiness: t.readiness || [],
      capabilityMetadataSource: t.capabilityMetadataSource || 'manifest'
    }));
  }

  const FRIENDLY_NAMES = {
    'ai-team': 'AI Team', 'workshop-command-center': 'Workshop Command Center', 'marketplace-deployment': 'Marketplace & Deployment', 'publish-library': 'Publish & Library', 'game-forge': 'Game Forge', 'knowledge-canvas': 'Knowledge Canvas', 'learning-lab': 'Learning Lab', 'finance-world-room': 'Finance World Room', 'workshop-direction': 'Workshop Direction', 'evolution-foundry': 'Evolution Foundry', 'body-pulse': 'Body Pulse', 'governed-evolution-lab': 'Living World Lineage', 'asset-fabric': 'Asset Fabric', 'audio-studio': 'Audio Studio', 'film-motion-studio': 'Film & Motion Studio', 'spatial-studio': 'Spatial Studio', 'agent-command-center': 'AI Command Center', 'agent-tool-forge': 'Agent Tool Forge', 'deterministic-organ-fabric': 'Deterministic Organ Fabric', 'capability-fabric': 'Capability Fabric',
    'asset-pack-lab': 'Asset Pack Lab', 'asset-vault': 'Asset Vault', 'chatgpt-connector': 'ChatGPT', 'duo-test': 'Nova + Gemini',
    'evidence-desk': 'Evidence Desk', forge: 'Tool Forge', 'forge-line': 'Forge Line',
    'game-hub': 'Game Hub', graft: 'Graft', 'hermes-local': 'Local Runtime',
    'hub-test-room': 'Test Room', 'launcher-card-installer': 'Launcher Cards', 'main-hub': 'Main Hub',
    'model-lab': 'Model Lab', prehub: 'Notes', 'project-room': 'Project Room', 'prompt-vault': 'Prompt Vault',
    'reasoning-shell': 'Reasoning Shell', route: 'Route', runner: 'Verification Desk',
    sandbox: 'Sandbox', skinner: 'Skinner', studio: 'Studio', 'ui-ux-builder': 'UI/UX Builder', verifier: 'Verifier'
  };
  function friendlyName(module) {
    if (!module) return 'Module';
    return FRIENDLY_NAMES[module.id] || String(module.name || module.id || 'Module').replace(/^AXM\s+/i, '');
  }

  /* pure log-entry factory (timestamp injected by caller for testability) */
  function logEntry(level, msg, ts) { return { t: ts, level: level, msg: msg }; }

  /* Startup may still be loading shared lifecycle state when a human opens a
     workspace. A late restore is allowed only when navigation has remained
     untouched since boot began; an explicit screen choice always wins. */
  function shouldRestoreBootDestination(bootSequence, currentSequence) {
    return Number.isInteger(bootSequence) && Number.isInteger(currentSequence) && bootSequence === currentSequence;
  }

  /* pure: given everything discovered + the user's added set, produce the
     catalog (each module flagged enabled) and the active/visible list.
     Stale enabled ids (folder removed) are dropped, not errored. */
  function resolveModules(available, enabledList) {
    const avail = available || [];
    const enabled = (enabledList || []).filter(id => avail.some(m => m.id === id));
    return {
      enabled,
      visible: avail.filter(m => enabled.indexOf(m.id) >= 0 && !m.integratedInto),
      catalog: avail.map(m => Object.assign({}, m, { enabled: enabled.indexOf(m.id) >= 0 }))
    };
  }

  /* Preserve an existing choice when an upgrade consolidates destinations.
     The parent becomes visible; children stay enabled for saved-data and
     compatibility routes but integrated modules do not clutter the sidebar. */
  function promoteIntegratedParents(available, enabledList) {
    const avail = available || [], out = Array.isArray(enabledList) ? enabledList.slice() : [];
    avail.filter(m => m.integratedInto && out.indexOf(m.id) >= 0).forEach(child => {
      if (avail.some(m => m.id === child.integratedInto) && out.indexOf(child.integratedInto) < 0) out.push(child.integratedInto);
    });
    return out;
  }

  /* ============================================================
     LAYERS — organisation, never authorisation.
     A layer groups modules. It can be:
       - door-signed (gate:'passphrase') so collaborators don't wander in
         by accident. NOT security: files are on disk, check runs in browser.
       - hidden (hidden:true) so machine-native modules don't clutter a
         human's sidebar. Hidden is NOT secret: the Layers screen always
         reports how many modules are tucked away, and one click reveals them.
     Nothing about a layer changes what a module may do. Permissions come
     from the module's passport and nowhere else (same-gates root).

     `host` is RESERVED for a future hosted/remote layer. It is currently
     ignored by every code path — declared so the shape exists, not faked.
     ============================================================ */
  const DEFAULT_LAYERS = [
    { id: 'open',    name: 'Open',      gate: 'none',       order: 0, audience: 'human',   hidden: false, host: 'local',
      note: 'Default. Anyone using this machine.' },
    { id: 'private', name: 'Private',   gate: 'passphrase', order: 1, audience: 'human',   hidden: false, host: 'local',
      note: 'Collaborators. A door sign, not a lock.' },
    { id: 'machine', name: 'AI-Native', gate: 'none',       order: 2, audience: 'machine', hidden: true,  host: 'local',
      note: 'Machine-native modules. Hidden from the sidebar so humans are not bothered — not secret, just out of the way. Same gates as everywhere.' }
  ];

  /* tiny non-cryptographic hash. Purpose: keep the phrase out of plaintext
     in storage so a casual glance doesn't reveal it. It is deliberately NOT
     a password hash and provides NO protection against anyone who looks. */
  function doorHash(s) {
    let h = 5381;
    for (let i = 0; i < String(s).length; i++) h = ((h << 5) + h + String(s).charCodeAt(i)) >>> 0;
    return 'd' + h.toString(16);
  }

  /* which layer a module belongs to: user assignment wins, then the module's
     own manifest suggestion (`layer`), then its declared `audience` (a module
     that says audience:"machine" lands in the first machine layer by itself,
     so a human never has to sort it), else the first layer. Unknown layer ids
     fall back rather than making a module disappear (no-loss). */
  function layerOf(mod, layers, assign) {
    const ids = layers.map(l => l.id);
    const a = assign && assign[mod.id];
    if (a && ids.indexOf(a) >= 0) return a;
    if (mod.layer && ids.indexOf(mod.layer) >= 0) return mod.layer;
    if (mod.audience === 'machine') {
      const m = layers.find(l => l.audience === 'machine');
      if (m) return m.id;
    }
    return ids[0];
  }

  /* group visible modules by layer. `unlocked` = layer ids opened this session.
     `revealed` = hidden layer ids the human has chosen to show right now. */
  function resolveLayers(visibleModules, layers, assign, unlocked, revealed) {
    const ls = (layers || DEFAULT_LAYERS).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const un = unlocked || [], rv = revealed || [];
    return ls.map(l => ({
      id: l.id, name: l.name, gate: l.gate || 'none', note: l.note || '',
      audience: l.audience || 'human',
      hidden: !!l.hidden && rv.indexOf(l.id) < 0,   /* hidden unless revealed */
      locked: (l.gate === 'passphrase') && un.indexOf(l.id) < 0,
      modules: (visibleModules || []).filter(m => layerOf(m, ls, assign) === l.id)
    }));
  }

  /* the door check. Returns true only on match; an unset phrase means the
     layer is open (a gate with no phrase is not a gate). */
  function checkDoor(layer, attempt) {
    if (!layer || layer.gate !== 'passphrase' || !layer.hash) return true;
    return doorHash(attempt) === layer.hash;
  }

  /* Beginner-facing workflow layout. Modules stay separate and keep the same
     permissions; only their sidebar grouping changes. The existing private
     door hash is preserved so applying the layout never resets Mike's sign. */
  function workflowLayout(modules, existingLayers) {
    const old = existingLayers || DEFAULT_LAYERS;
    const oldPrivate = old.find(l => l.id === 'private') || {};
    const layers = [
      { id: 'create', name: 'Create', gate: 'none', order: 0, audience: 'human', hidden: false, host: 'local', note: 'Studio and visual production.' },
      { id: 'build', name: 'Build', gate: 'none', order: 1, audience: 'human', hidden: false, host: 'local', note: 'Forge, sandbox, evidence, and packaging.' },
      { id: 'publish', name: 'Marketplace & Deployment', gate: 'none', order: 2, audience: 'human', hidden: false, host: 'local', note: 'Catalog, rights, reviews, releases, packages, deployment plans, galleries, and updates.' },
      { id: 'play', name: 'Play', gate: 'none', order: 3, audience: 'human', hidden: false, host: 'local', note: 'Games and playable experiences.' },
      { id: 'ai-team', name: 'AI Team', gate: 'none', order: 4, audience: 'human', hidden: false, host: 'local', note: 'One collaboration, agent, prompt, model and connector control room.' },
      Object.assign({ id: 'private', gate: 'passphrase' }, oldPrivate, { id: 'private', name: 'Closed Door / Advanced', order: 5, audience: 'human', hidden: false, host: 'local', note: 'Routing, verification, and advanced controls. Door sign only; not filesystem security.' }),
      { id: 'machine', name: 'System Internals', gate: 'none', order: 6, audience: 'machine', hidden: true, host: 'local', note: 'Hub internals and test rooms; hidden from the everyday sidebar.' }
    ];
    const groups = {
      create: ['studio','audio-studio','film-motion-studio','spatial-studio','ps2-asset-forge','asset-filesystem-service','device-handoff','template-runtime-pack-engine','media-render-transcode-service','presentation-spine','ui-fx'],
      build: ['agent-tool-forge','browser-lan-hardware-qa-lab','capability-fabric','cognitive-resource-meter','deterministic-organ-fabric','diagnostics-operations-center','evidence-desk','evolution-foundry','finance-world-room','forge','forge-line','graft','knowledge-canvas','learning-lab','living-world-state-server','module-contract-workbench','module-installer','novelty-diversity-engine','project-room','sandbox','source-connector-hub','workshop-search-provenance'],
      publish: ['marketplace-deployment','recovery-center','review-inbox','public-release-deployment-adapter'],
      play: ['game-forge','multiplayer-controller-transport','living-world-ruleset-physics-adapter-kit'],
      'ai-team': ['ai-team','machine-host','secrets-permissions-console','read-only-mirror-world-adapter'],
      private: ['hermes-local','route','runner','verifier'],
      machine: ['hub-test-room','main-hub','prehub']
    };
    const assign = {};
    Object.keys(groups).forEach(layerId => groups[layerId].forEach(id => { assign[id] = layerId; }));
    (modules || []).forEach(m => {
      if (m.integratedInto) assign[m.id] = 'machine';
      else if (!assign[m.id]) assign[m.id] = Number.isInteger(m.rank) && m.rank >= 1 && m.rank <= 50
        ? (ROADMAP_PARENT_LAYERS[m.category] || 'build')
        : 'build';
    });
    return { layers, assign };
  }

  /* Migrate only the untouched three-layer starter layout. Browsers keep
     separate localStorage, so Edge may still have this older flat layout
     even when another browser already uses the workflow categories. Any
     assignment or extra/renamed layer makes the layout user-owned and is
     deliberately left alone. */
  function upgradeLegacyOpenLayout(layers, assign, modules) {
    const ls = Array.isArray(layers) ? layers : [];
    const as = assign && typeof assign === 'object' ? assign : {};
    const expected = DEFAULT_LAYERS;
    const untouched = ls.length === expected.length
      && Object.keys(as).length === 0
      && expected.every(template => ls.some(layer => layer.id === template.id
        && layer.name === template.name
        && layer.gate === template.gate
        && !!layer.hidden === !!template.hidden));
    if (!untouched) return { layers: ls, assign: as, changed: false };
    const next = workflowLayout(modules, ls);
    return { layers: next.layers, assign: next.assign, changed: true };
  }

  /* Upgrade only the known beginner workflow layout when Publish & Library
     arrives. Preserve user layers, assignments and the closed-door hash;
     custom/non-workflow layouts are left untouched. */
  function upgradePublishLayer(layers, assign, modules) {
    const ls = Array.isArray(layers) ? layers.map(l => Object.assign({}, l)) : [];
    const as = Object.assign({}, assign || {});
    const ids = ls.map(l => l.id);
    const standard = ['create','build','play','ai-team'].every(id => ids.indexOf(id) >= 0);
    if (!standard) return { layers: ls, assign: as, changed: false };
    let changed = false;
    if (ids.indexOf('publish') < 0) {
      ls.forEach(l => { if ((l.order || 0) >= 2) l.order = (l.order || 0) + 1; });
      ls.push({ id:'publish', name:'Publish & Library', gate:'none', order:2, audience:'human', hidden:false, host:'local', note:'Assets, releases, packages, backups, and distribution.' });
      changed = true;
    }
    const hasMarketplace = (modules || []).some(m => m.id === 'marketplace-deployment');
    const primary = hasMarketplace ? 'marketplace-deployment' : 'publish-library';
    if (hasMarketplace) {
      const publishLayer = ls.find(l => l.id === 'publish');
      if (publishLayer && publishLayer.name === 'Publish & Library') {
        publishLayer.name = 'Marketplace & Deployment';
        publishLayer.note = 'Catalog, rights, reviews, releases, packages, deployment plans, galleries, and updates.';
        changed = true;
      }
    }
    if (as[primary] !== 'publish') { as[primary] = 'publish'; changed = true; }
    (modules || []).filter(m => m.integratedInto === primary || (hasMarketplace && m.id === 'publish-library') || (hasMarketplace && m.integratedInto === 'publish-library')).forEach(m => {
      if (as[m.id] !== 'machine') { as[m.id] = 'machine'; changed = true; }
    });
    return { layers: ls.sort((a,b)=>(a.order||0)-(b.order||0)), assign: as, changed };
  }

  /* Place all governed roadmap foundations in existing standard workflow
     layouts. Only previously unassigned arrivals move; a person's custom
     placement is never overwritten. */
  function upgradeFoundationRoadmap(layers, assign, modules) {
    const ls = Array.isArray(layers) ? layers.map(l => Object.assign({}, l)) : [], as = Object.assign({}, assign || {}), ids = ls.map(l => l.id);
    if (!['create','build','publish','play','ai-team','private','machine'].every(id => ids.indexOf(id) >= 0)) return { layers:ls, assign:as, changed:false };
    let changed = false; (modules || []).forEach(module => {
      const rankedLayer = Number.isInteger(module.rank) && module.rank >= 1 && module.rank <= 50 ? ROADMAP_PARENT_LAYERS[module.category] : null;
      const layer = GOVERNED_FOUNDATION_ASSIGNMENTS[module.id] || rankedLayer;
      if (layer && !as[module.id]) { as[module.id]=layer; changed=true; }
    });
    return { layers:ls, assign:as, changed };
  }

  /* Early builds of the ranked wave reached existing browser profiles before
     their parent metadata was routed. The old generic fallback placed those
     arrivals in Build. Repair only that exact fallback once; all other custom
     placements remain untouched. */
  function upgradeRankedRoadmapPlacement(layers, assign, modules) {
    const ls = Array.isArray(layers) ? layers.map(layer => Object.assign({}, layer)) : [], as = Object.assign({}, assign || {}), ids = ls.map(layer => layer.id);
    if (!['create','build','publish','play','ai-team'].every(id => ids.indexOf(id) >= 0)) return { layers:ls, assign:as, changed:false };
    let changed = false;
    (modules || []).forEach(module => {
      if (!Number.isInteger(module.rank) || module.rank < 1 || module.rank > 50) return;
      const target = ROADMAP_PARENT_LAYERS[module.category];
      if (!target) return;
      if (!as[module.id] || (as[module.id] === 'build' && target !== 'build')) { as[module.id] = target; changed = true; }
    });
    return { layers:ls, assign:as, changed };
  }

  /* Compatibility name for callers saved before the full-roadmap migration. */
  const upgradeFoundationWave2 = upgradeFoundationRoadmap;

  /* Human-facing routes are destination-first. Integrated compatibility
     modules may point at the same workspace, but showing each internal match
     makes a capable front door look broken. Keep the strongest honest result
     per destination and separate usable routes from explanations. */
  function organizeCapabilityRoutes(matches) {
    const stateRank = { READY:0, AVAILABLE:1, NEEDS_ACTION:2, BLOCKED:3, UNKNOWN:4 };
    const byDestination = {};
    (matches || []).forEach(match => {
      const id = match.destinationId || match.id;
      if (!id) return;
      const state = match.readiness && match.readiness.state || 'UNKNOWN';
      const current = byDestination[id];
      if (!current) { byDestination[id] = match; return; }
      const currentState = current.readiness && current.readiness.state || 'UNKNOWN';
      if ((stateRank[state] == null ? 9 : stateRank[state]) < (stateRank[currentState] == null ? 9 : stateRank[currentState])
        || (state === currentState && Number(match.score || 0) > Number(current.score || 0))) byDestination[id] = match;
    });
    const ordered = Object.keys(byDestination).map(id => byDestination[id]).sort((a,b) => {
      const as=a.readiness&&a.readiness.state||'UNKNOWN', bs=b.readiness&&b.readiness.state||'UNKNOWN';
      return (stateRank[as] == null ? 9 : stateRank[as]) - (stateRank[bs] == null ? 9 : stateRank[bs]) || Number(b.score||0)-Number(a.score||0);
    });
    return {
      usable: ordered.filter(match => ['READY','AVAILABLE','NEEDS_ACTION'].indexOf(match.readiness&&match.readiness.state||'UNKNOWN') >= 0),
      blocked: ordered.filter(match => ['READY','AVAILABLE','NEEDS_ACTION'].indexOf(match.readiness&&match.readiness.state||'UNKNOWN') < 0)
    };
  }

  /* Skinner is normally hosted inside Studio, but its direct and standalone
     routes are still valid. Resolve all persistence seams by their explicit
     checkpoint time; a timestamp-free legacy direct state keeps priority over
     another timestamp-free state. */
  function selectSkinState(directState, studioState, localState) {
    const embeddedState = studioState && studioState.skinner;
    const candidates = [directState, embeddedState, localState].filter(Boolean);
    if (!candidates.length) return null;
    return candidates.reduce((selected, candidate) => {
      const selectedTime = Date.parse(selected.updatedAt || '') || 0;
      const candidateTime = Date.parse(candidate.updatedAt || '') || 0;
      return candidateTime > selectedTime ? candidate : selected;
    });
  }

  return { NS, memoryBackend, localStorageBackend, makeStore, normalizeRegistry, logEntry, shouldRestoreBootDestination, resolveModules, promoteIntegratedParents,
           DEFAULT_LAYERS, GOVERNED_FOUNDATION_WAVE1, GOVERNED_FOUNDATION_WAVE2, GOVERNED_FOUNDATION_ASSIGNMENTS, ROADMAP_PARENT_LAYERS,
           QUICK_LIFECYCLE_STATES, quickLifecycleTransition,
           doorHash, layerOf, resolveLayers, checkDoor, workflowLayout, upgradeLegacyOpenLayout, upgradePublishLayer, upgradeFoundationRoadmap, upgradeRankedRoadmapPlacement, upgradeFoundationWave2, friendlyName, organizeCapabilityRoutes, selectSkinState };
});

/* ============================================================
   BROWSER-ONLY CONTROLLER
   (skipped under Node because there is no window)
   ============================================================ */
if (typeof window !== 'undefined') (function () {
  'use strict';
  const Core = window.HubCore, C = window.AXMContract;
  const store = Core.makeStore(Core.localStorageBackend());
  const $ = id => document.getElementById(id);
  const now = () => new Date().toISOString();
  const hhmm = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const Hub = window.AXMHubShell = {
    registry: [], visible: [], enabled: [], active: null, homeLayer: null, mode: 'simple', sidebarCollapsed: false, records: {}, store, continuityRecords: [], navigation: null, pendingShutdown: null, frameLoadSequence: 0,
    humanUsabilityByModule: null, humanUsabilityPromise: null, humanUsabilityError: null,
    layers: [], assign: {}, unlocked: [], revealed: [],   /* unlocked+revealed = this session only */
    /* lifecycle badge classes for the sidebar */
    lifeClass(l) {
      return ({ 'CLAIMED': 'CLAIMED', 'NEEDS VERIFY': 'TEST', 'WORKING': 'WORKING',
        'SAVED CHECKPOINT': 'SAVED', 'TEST-HOLD': 'HOLD', 'CANON CANDIDATE': 'CANON' }[l]) || 'CLAIMED';
    },
    lifecycleTruth(id, lifecycle) {
      const record = this.records[id] || {};
      const evidence = record.evidence || null;
      const parts = ['Status: ' + shortLife(lifecycle)];
      if (!evidence) return parts.concat(['Evidence: local label only', 'CANON: not granted']).join(' · ');
      const basis = ({
        CURRENT_SELFTEST_AND_STRUCTURAL_REVIEW_READY:'current build checks passed',
        CURRENT_MANIFEST_CLAIM:'current declared Working checks passed',
        PRESERVED_EXPLICIT_LOCAL_JUDGMENT:'preserved explicit local judgment',
        DECLARED_TEST_WITH_NAMED_HOLDS:'test build with remaining checks',
        NOT_YET_VERIFIED:'verification still needed'
      })[evidence.basis] || String(evidence.basis || 'evidence recorded').toLowerCase().replace(/_/g, ' ');
      parts.push('Evidence: ' + basis);
      if (evidence.manifestStatus) parts.push('Manifest: ' + evidence.manifestStatus);
      if (evidence.selftestVerdict) parts.push('Selftest: ' + evidence.selftestVerdict);
      if (evidence.visualEvidenceState === 'LEGACY_RUNTIME_AND_EYE_REFERENCE') parts.push('Visual check: recorded earlier');
      else if (evidence.visualEvidenceState === 'LIVE_BROWSER_VERIFIED_2026-07-24') parts.push('Visual check: current live browser');
      const remaining = Array.isArray(evidence.namedHolds) ? evidence.namedHolds.slice(0, 3) : [];
      if (remaining.length) parts.push('Still needs: ' + remaining.join('; '));
      parts.push('CANON: not granted');
      return parts.join(' · ');
    },
    closeLifecycleMenu() {
      const menu = $('lifecycleMenu');
      if (!menu) return;
      menu.hidden = true;
      menu.removeAttribute('data-module-id');
    },
    openLifecycleMenu(id, clientX, clientY) {
      const module = this.registry.find(item => item.id === id);
      const menu = $('lifecycleMenu');
      if (!module || !menu) return;
      const lifecycle = store.getLifecycle(id);
      menu.dataset.moduleId = id;
      $('lifecycleMenuName').textContent = Core.friendlyName(module);
      $('lifecycleMenuState').textContent = 'Current: ' + shortLife(lifecycle);
      [...menu.querySelectorAll('[data-lifecycle]')].forEach(button => {
        const active = button.dataset.lifecycle === lifecycle;
        button.classList.toggle('active', active);
        button.setAttribute('aria-current', active ? 'true' : 'false');
      });
      menu.hidden = false;
      const margin = 8;
      const x = Math.max(margin, Math.min(Number(clientX) || margin, window.innerWidth - menu.offsetWidth - margin));
      const y = Math.max(margin, Math.min(Number(clientY) || margin, window.innerHeight - menu.offsetHeight - margin));
      menu.style.left = x + 'px'; menu.style.top = y + 'px';
      const selected = menu.querySelector('[aria-current="true"]') || menu.querySelector('[data-lifecycle]');
      if (selected) selected.focus();
    },
    bindLifecycleMenu(element, module) {
      if (!element || !module) return;
      element.dataset.lifecycleMenu = 'true';
      element.oncontextmenu = event => {
        event.preventDefault(); event.stopPropagation();
        this.openLifecycleMenu(module.id, event.clientX, event.clientY);
      };
      element.onkeydown = event => {
        if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
          event.preventDefault();
          const rect = element.getBoundingClientRect();
          this.openLifecycleMenu(module.id, rect.left + Math.min(rect.width, 36), rect.top + Math.min(rect.height, 36));
        }
      };
      element.title = (element.title ? element.title + ' · ' : '') + 'Right-click to change Workshop status (stops at WORKING)';
    },
    async setQuickLifecycle(id, target) {
      const module = this.registry.find(item => item.id === id);
      const result = Core.quickLifecycleTransition(store.getLifecycle(id), target);
      if (!module || !result.ok) {
        this.log('warn', 'local lifecycle change refused · quick menu stops at WORKING');
        this.closeLifecycleMenu(); return false;
      }
      store.setLifecycle(id, result.lifecycle);
      if (!this.records[id]) this.records[id] = { id, lifecycle:result.lifecycle, evidence:null };
      else { this.records[id].lifecycle = result.lifecycle; this.records[id].evidence = null; }
      this.closeLifecycleMenu();
      this.renderSidebar(); this.renderHome();
      const shared = await this.persistSharedLifecycle(id, result.lifecycle, 'hub-menu');
      this.log(shared ? (result.lifecycle === 'WORKING' ? 'ok' : 'info') : 'warn', Core.friendlyName(module) + ' lifecycle → ' + shortLife(result.lifecycle) + (shared ? ' · shared across Workshop browsers · no CANON authority' : ' · browser fallback only; shared state unavailable'));
      return true;
    },
    initNavigation() {
      const Nav = window.AXMWorkshopNavigation;
      if (!Nav) return;
      /* Two deliberately separate trails:
         - route trail: Hub <-> standalone AXM pages in this browser tab
         - logical trail: Home <-> modules inside the stable Hub viewport
         Both live in sessionStorage and contain no project/save data. */
      Nav.installStandalone({ button: false });
      let storage; try { storage = sessionStorage; } catch (e) { storage = Nav.memoryStorage(); }
      this.navigation = Nav.createHistory(storage, 'axm.hub.screen-history.v1', 60);
      this.refreshBackButton();
    },
    recordScreen(destination) {
      if (this.navigation) this.navigation.record(destination);
      this.refreshBackButton();
    },
    refreshBackButton() {
      const button = $('workshopBack'); if (!button) return;
      const logical = !!(this.navigation && this.navigation.canBack());
      let routed = false;
      try { routed = !!(window.AXMWorkshopNavigation && window.AXMWorkshopNavigation.routeHistory(window).canBack()); } catch (e) {}
      button.disabled = !(logical || routed);
      const previous = logical ? this.navigation.previous() : null;
      button.title = previous && previous.label
        ? 'Back to ' + previous.label + ' · saved work is unchanged'
        : 'Previous AXM screen · saved work is unchanged';
    },
    goBack() {
      const destination = this.navigation && this.navigation.back();
      if (destination) {
        if (destination.kind === 'module') this.open(destination.id, { history: false });
        else this.showHome(destination.layerId || null, { history: false });
        return;
      }
      if (window.AXMWorkshopNavigation && window.AXMWorkshopNavigation.navigateRouteBack(window)) return;
      this.refreshBackButton();
    },
    setMode(mode, silent) {
      this.mode = mode === 'advanced' ? 'advanced' : 'simple';
      document.body.dataset.mode = this.mode;
      try { localStorage.setItem('axm.hub.view-mode', this.mode); } catch (e) {}
      const b = $('modeToggle');
      if (b) {
        b.textContent = this.mode === 'simple' ? 'View: Simple' : 'View: Advanced';
        b.setAttribute('aria-pressed', this.mode === 'advanced' ? 'true' : 'false');
        b.title = this.mode === 'simple' ? 'Switch to Advanced controls' : 'Switch to Simple controls';
      }
      const quick = $('viewModeQuick');
      if (quick) {
        $('viewModeQuickTitle').textContent = this.mode === 'simple' ? 'Simple view' : 'Advanced view';
        $('viewModeQuickHint').textContent = this.mode === 'simple' ? 'Advanced available' : 'Full controls visible';
        quick.setAttribute('aria-pressed', this.mode === 'advanced' ? 'true' : 'false');
        quick.title = this.mode === 'simple'
          ? 'Switch to Advanced view · all tools, data and controls remain available'
          : 'Switch to Simple view · saved work and capabilities stay unchanged';
      }
      this.renderSystemDeck();
      if (this.mode === 'simple' && this.active) {
        const m = this.registry.find(x => x.id === this.active);
        const layer = m && Core.layerOf(m, this.layers, this.assign);
        if (layer === 'private' || layer === 'machine') this.showHome();
      }
      this.renderSidebar();
      this.renderHome();
      if (!silent) this.log('info', 'view mode → ' + this.mode);
    },
    toggleMode() { this.setMode(this.mode === 'simple' ? 'advanced' : 'simple'); },
    setSidebarCollapsed(collapsed, silent, persist = true) {
      this.sidebarCollapsed = !!collapsed;
      document.body.dataset.sidebarCollapsed = this.sidebarCollapsed ? 'true' : 'false';
      [$('sidebarToggle'), $('sidebarTopToggle')].filter(Boolean).forEach(b => {
        b.setAttribute('aria-expanded', this.sidebarCollapsed ? 'false' : 'true');
        b.setAttribute('aria-label', this.sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation');
        b.title = this.sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation';
      });
      if (persist) {
        try { localStorage.setItem('axm.hub.sidebar-collapsed', this.sidebarCollapsed ? 'true' : 'false'); } catch (e) {}
      }
      if (!silent) this.log('info', this.sidebarCollapsed ? 'navigation collapsed · workspace expanded' : 'navigation expanded');
    },
    toggleSidebar() { this.setSidebarCollapsed(!this.sidebarCollapsed); },
    log(level, msg) {
      const e = Core.logEntry(level, msg, now());
      store.appendLog(e);
      const tail = $('logTail'); if (tail) tail.textContent = hhmm() + '  ' + msg;
    },
    async loadSharedLifecycle() {
      try {
        const response = await fetch('/api/hub/lifecycle');
        const envelope = await response.json();
        const shared = envelope && envelope.ok && envelope.result;
        if (!response.ok || !shared || !shared.lifecycles) throw new Error(envelope && envelope.error || 'shared lifecycle unavailable');
        let applied = 0;
        Object.keys(shared.lifecycles).forEach(id => {
          if (!this.registry.some(module => module.id === id)) return;
          const row = shared.lifecycles[id];
          if (!row || !row.lifecycle) return;
          store.setLifecycle(id, row.lifecycle);
          this.records[id] = Object.assign({}, this.records[id] || { id }, row, { id });
          applied += 1;
        });
        if (applied) this.log('ok', 'synchronized ' + applied + ' Workshop lifecycle label' + (applied === 1 ? '' : 's') + ' across browser profiles');
        return applied;
      } catch (error) {
        this.log('warn', 'shared lifecycle unavailable · this browser keeps its last local labels');
        return 0;
      }
    },
    async persistSharedLifecycle(id, lifecycle, source) {
      try {
        const response = await fetch('/api/hub/lifecycle', {
          method:'POST',
          headers:{ 'content-type':'application/json', 'x-axm-hub-lifecycle':'explicit-local-label' },
          body:JSON.stringify({ id, lifecycle, source:source || 'hub-menu', actor:'local-user' })
        });
        const envelope = await response.json();
        if (!response.ok || !envelope.ok) throw new Error(envelope && envelope.error || 'shared lifecycle update failed');
        return true;
      } catch (error) {
        return false;
      }
    },
    async loadRegistry() {
      let tools = [];
      try {
        const r = await fetch('/api/tools');
        tools = (await r.json()).tools || [];
        this.registry = Core.normalizeRegistry(tools);
        store.cacheRegistry(this.registry);           /* survive next reload even offline */
      } catch (e) {
        this.registry = store.cachedRegistry();        /* module list survives reload */
        this.log('warn', 'API unreachable — module list restored from cache (' + this.registry.length + ')');
      }
      /* first run: seed the added-set with everything discovered (no-loss —
         nothing vanishes on upgrade). After that, the user's choice rules. */
      let en = store.getEnabled();
      if (en === null) { en = this.registry.map(m => m.id); store.setEnabled(en); }
      else { en = Core.promoteIntegratedParents(this.registry, en); store.setEnabled(en); }
      /* One-time arrival migration for the new visible Knowledge Canvas.
         After this marker is written, hiding it remains the user's choice. */
      try {
        const marker = 'axm.hub.upgrade.knowledge-canvas.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'knowledge-canvas')) {
          if (en.indexOf('knowledge-canvas') < 0) en.push('knowledge-canvas');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Knowledge Canvas workspace · future visibility remains user-controlled');
        }
      } catch (e) {}
      /* One-time arrival migration for Audio Studio. The marker prevents a
         later intentional hide from being undone on every reload. */
      try {
        const marker = 'axm.hub.upgrade.audio-studio.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'audio-studio')) {
          if (en.indexOf('audio-studio') < 0) en.push('audio-studio');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Audio Studio workspace · future visibility remains user-controlled');
        }
      } catch (e) {}
      /* One-time arrival migration for Film & Motion Studio. A later manual
         hide remains respected because the marker is never cleared. */
      try {
        const marker = 'axm.hub.upgrade.film-motion-studio.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'film-motion-studio')) {
          if (en.indexOf('film-motion-studio') < 0) en.push('film-motion-studio');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Film & Motion Studio workspace · future visibility remains user-controlled');
        }
      } catch (e) {}
      /* One-time arrival migration for Spatial Studio. It is a visible parent
         workspace; future hiding remains a user-controlled choice. */
      try {
        const marker = 'axm.hub.upgrade.spatial-studio.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'spatial-studio')) {
          if (en.indexOf('spatial-studio') < 0) en.push('spatial-studio');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Spatial Studio workspace · future visibility remains user-controlled');
        }
      } catch (e) {}
      /* One-time arrival migration for Visual Mold Foundry. The first local
         intake makes the workspace visible; a later manual hide remains the
         user's choice because this marker is never cleared. */
      try {
        const marker = 'axm.hub.upgrade.visual-mold-foundry.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'visual-mold-foundry')) {
          if (en.indexOf('visual-mold-foundry') < 0) en.push('visual-mold-foundry');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Visual Mold Foundry workspace · future visibility remains user-controlled');
        }
      } catch (e) {}
      /* One-time arrival migration for Learning Lab. The machine-native
         school remains enabled as an integrated child, while the new parent
         becomes the visible everyday route. */
      try {
        const marker = 'axm.hub.upgrade.learning-lab.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'learning-lab')) {
          if (en.indexOf('learning-lab') < 0) en.push('learning-lab');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Learning Lab parent · separate school state preserved');
        }
      } catch (e) {}
      /* One-time arrival migration for the final Marketplace & Deployment
         parent. Publish & Library remains enabled as its independently
         executable child while the new parent becomes the everyday door. */
      try {
        const marker = 'axm.hub.upgrade.marketplace-deployment.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'marketplace-deployment')) {
          if (en.indexOf('marketplace-deployment') < 0) en.push('marketplace-deployment');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Marketplace & Deployment parent - Publish & Library foundation preserved');
        }
      } catch (e) {}
      /* One-time arrival migration for the Finance World Room. It remains an
         experimental sandbox, and the human can hide it again afterward. */
      try {
        const marker = 'axm.hub.upgrade.finance-world-room.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'finance-world-room')) {
          if (en.indexOf('finance-world-room') < 0) en.push('finance-world-room');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Finance World Room sandbox · future visibility remains user-controlled');
        }
      } catch (e) {}
      /* One-time arrival migration for the Cognitive Resource Meter. It is a
         TEST evidence producer in Build; later hiding remains user-owned. */
      try {
        const marker = 'axm.hub.upgrade.cognitive-resource-meter.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'cognitive-resource-meter')) {
          if (en.indexOf('cognitive-resource-meter') < 0) en.push('cognitive-resource-meter');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Cognitive Resource Meter TEST workspace');
        }
      } catch (e) {}
      /* PS2 Asset Forge is an explicit Create room. Its catalog entries are
         reusable source parts, while generated previews remain memory-only. */
      try {
        const marker = 'axm.hub.upgrade.ps2-asset-forge.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'ps2-asset-forge')) {
          if (en.indexOf('ps2-asset-forge') < 0) en.push('ps2-asset-forge');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added PS2 Asset Forge to Create · generated previews remain temporary');
        }
      } catch (e) {}
      /* The beginner Command Center is a top-level doorway above the five
         workflow parents. Enable its dashboard once; a later hide remains
         user-owned, while its dedicated Hub door preserves the architecture. */
      try {
        const marker = 'axm.hub.upgrade.workshop-command-center.v1';
        if (!localStorage.getItem(marker) && this.registry.some(m => m.id === 'workshop-command-center')) {
          if (en.indexOf('workshop-command-center') < 0) en.push('workshop-command-center');
          store.setEnabled(en); localStorage.setItem(marker, 'done');
          this.log('ok', 'added Workshop Command Center above the five parent workspaces');
        }
      } catch (e) {}
      /* The technical cognitive evidence rooms stay integrated behind the
         Meter. Enable each arrival once without adding five everyday cards. */
      try {
        const marker = 'axm.hub.upgrade.cognitive-evidence-stack.v1';
        if (!localStorage.getItem(marker)) {
          const children = ['cognitive-evidence-explorer','cognitive-calibration-lab','human-attention-ledger','sustainability-metrology-lab','mirror-intake-monitor'];
          let added = 0; children.forEach(id => { if (this.registry.some(m => m.id === id) && en.indexOf(id) < 0) { en.push(id); added += 1; } });
          if (added) { store.setEnabled(en); this.log('ok', 'enabled ' + added + ' integrated cognitive evidence room(s) behind the Meter'); }
          localStorage.setItem(marker, 'done');
        }
      } catch (e) {}
      /* One-time arrival of each governed foundation wave. A marker preserves
         a later intentional hide, while layout placement stays editable. */
      try {
        const marker = 'axm.hub.upgrade.foundation-wave1.v1';
        if (!localStorage.getItem(marker)) {
          let added = 0;
          Core.GOVERNED_FOUNDATION_WAVE1.forEach(id => { if (this.registry.some(m => m.id === id) && en.indexOf(id) < 0) { en.push(id); added += 1; } });
          if (added) { store.setEnabled(en); this.log('ok', 'added ' + added + ' governed foundation dashboard(s)'); }
          localStorage.setItem(marker, 'done');
        }
      } catch (e) {}
      try {
        const marker = 'axm.hub.upgrade.foundation-wave2.v1';
        if (!localStorage.getItem(marker)) {
          let added = 0;
          Core.GOVERNED_FOUNDATION_WAVE2.forEach(id => { if (this.registry.some(m => m.id === id) && en.indexOf(id) < 0) { en.push(id); added += 1; } });
          if (added) { store.setEnabled(en); this.log('ok', 'added ' + added + ' governed foundation dashboard(s)'); }
          localStorage.setItem(marker, 'done');
        }
      } catch (e) {}
      /* One-time visibility migration for the ranked 1..50 game-production
         wave. Rank metadata identifies this exact delivery; later manual
         hiding stays user-owned because the marker is never cleared. */
      try {
        const marker = 'axm.hub.upgrade.next-50-modules.v1';
        if (!localStorage.getItem(marker)) {
          const arrivals = this.registry.filter(module => Number.isInteger(module.rank) && module.rank >= 1 && module.rank <= 50);
          let added = 0;
          arrivals.forEach(module => { if (en.indexOf(module.id) < 0) { en.push(module.id); added += 1; } });
          if (added) { store.setEnabled(en); this.log('ok', 'added ' + added + ' ranked game-production foundation dashboard(s)'); }
          localStorage.setItem(marker, 'done');
        }
      } catch (e) {}
      /* One-time visibility upgrade for the shared visual system. It preserves
         every saved layer and assignment and never re-enables a tool after a
         later explicit hide. */
      try {
        const marker = 'axm.hub.upgrade.presentation-spine-visible.v1';
        if (!localStorage.getItem(marker)) {
          ['presentation-spine','ui-fx'].forEach(id => {
            if (this.registry.some(module => module.id === id) && en.indexOf(id) < 0) en.push(id);
          });
          store.setEnabled(en);
          localStorage.setItem(marker, 'done');
        }
      } catch (e) {}
      /* New browser profiles start with the beginner workflow. Older Edge or
         in-app-browser profiles may still carry the untouched flat Open
         layout; migrate only that exact legacy shape. */
      let ly = store.getLayers();
      let as = store.getAssign();
      if (ly === null) {
        const firstLayout = Core.workflowLayout(this.registry, Core.DEFAULT_LAYERS);
        ly = firstLayout.layers; as = firstLayout.assign;
        store.setLayers(ly); store.setAssign(as);
      } else {
        const legacyUpgrade = Core.upgradeLegacyOpenLayout(ly, as, this.registry);
        if (legacyUpgrade.changed) {
          ly = legacyUpgrade.layers; as = legacyUpgrade.assign;
          store.setLayers(ly); store.setAssign(as);
          this.log('ok', 'restored workflow categories for this browser profile');
        }
      }
      const publishUpgrade = Core.upgradePublishLayer(ly, as, this.registry);
      if (publishUpgrade.changed) {
        ly = publishUpgrade.layers; as = publishUpgrade.assign;
        store.setLayers(ly); store.setAssign(as);
        this.log('ok', 'upgraded workflow layout with Publish & Library · custom assignments preserved');
      }
      const foundationUpgrade = Core.upgradeFoundationRoadmap(ly, as, this.registry);
      if (foundationUpgrade.changed) {
        ly = foundationUpgrade.layers; as = foundationUpgrade.assign;
        store.setLayers(ly); store.setAssign(as);
        this.log('ok', 'placed governed roadmap foundations into the existing workflow');
      }
      try {
        const marker = 'axm.hub.upgrade.next-50-placement.v1';
        if (!localStorage.getItem(marker)) {
          const rankedUpgrade = Core.upgradeRankedRoadmapPlacement(ly, as, this.registry);
          if (rankedUpgrade.changed) {
            ly = rankedUpgrade.layers; as = rankedUpgrade.assign;
            store.setLayers(ly); store.setAssign(as);
            this.log('ok', 'placed ranked modules into their five parent workspaces');
          }
          localStorage.setItem(marker, 'done');
        }
      } catch (e) {}
      this.layers = ly; this.assign = as;
      /* unlocks are session-only: closing the hub re-locks the door */
      try { this.unlocked = JSON.parse(sessionStorage.getItem('axm.hub.unlocked') || '[]'); } catch (e) { this.unlocked = []; }
      try { this.revealed = JSON.parse(sessionStorage.getItem('axm.hub.revealed') || '[]'); } catch (e) { this.revealed = []; }
      await this.loadSharedLifecycle();
      this.resolve();
    },
    resolve() {
      const r = Core.resolveModules(this.registry, store.getEnabled() || []);
      this.enabled = r.enabled; this.visible = r.visible;
      store.setEnabled(this.enabled);                  /* prune stale ids */
      this.renderSidebar(); this.renderHome();
    },
    enable(id) {
      if (this.enabled.indexOf(id) < 0) { this.enabled.push(id); store.setEnabled(this.enabled); }
      const m = this.registry.find(x => x.id === id);
      this.log('ok', 'dashboard shown: ' + (m ? m.name : id) + ' — service and lifecycle unchanged');
      this.resolve(); this.renderModules();
    },
    disable(id) {
      this.enabled = this.enabled.filter(x => x !== id); store.setEnabled(this.enabled);
      const m = this.registry.find(x => x.id === id);
      this.log('info', 'dashboard hidden: ' + (m ? m.name : id) + ' — not retired or stopped; saved data kept');
      if (this.active === id) this.showHome();
      this.resolve(); this.renderModules();
    },
    renderSidebar() {
      const nav = $('modList'); nav.innerHTML = '';
      const commandDoor = $('commandCenterNav'); if (commandDoor) commandDoor.hidden = !this.registry.some(m => m.id === 'workshop-command-center');
      const commandModule = this.registry.find(m => m.id === 'workshop-command-center');
      if (commandDoor && commandModule) this.bindLifecycleMenu(commandDoor, commandModule);
      const visualDoor = $('presentationSpineNav');
      const visualModule = this.visible.find(m => m.id === 'presentation-spine');
      if (visualDoor) {
        visualDoor.hidden = !visualModule;
        visualDoor.onclick = visualModule ? () => this.open('presentation-spine') : null;
        if (visualModule) this.bindLifecycleMenu(visualDoor, visualModule);
      }
      const groups = Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed);
      if (this.mode === 'simple') {
        const labels = {
          create: ['Create', 'Design and make'],
          build: ['Build', 'Turn ideas into working projects'],
          publish: ['Publish & Library', 'Package and share safely'],
          play: ['Play', 'Games and experiences'],
          'ai-team': ['AI Team', 'Work with your collaborators']
        };
        ['create','build','publish','play','ai-team'].forEach(id => {
          const group = groups.find(item => item.id === id && !item.hidden && !item.locked);
          if (!group) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'mod workflow-nav' + (!this.active && this.homeLayer === id ? ' active' : '');
          button.dataset.layer = id;
          button.innerHTML = '<span class="ic">' + workflowIcon(id) + '</span><span class="nm"><b></b><small></small></span><span class="nav-arrow" aria-hidden="true">›</span>';
          button.querySelector('.nm b').textContent = labels[id][0];
          button.querySelector('.nm small').textContent = labels[id][1];
          button.title = labels[id][0] + ' · ' + group.modules.length + ' tool' + (group.modules.length === 1 ? '' : 's');
          button.onclick = () => this.showHome(id);
          nav.appendChild(button);
        });
        return;
      }
      let hiddenMods = 0, hiddenLayers = 0;
      groups.forEach(g => {
        /* hidden (machine-native) layers stay out of the human's way */
        if (g.hidden) { hiddenMods += g.modules.length; hiddenLayers++; return; }
        if (!g.modules.length && g.gate !== 'passphrase') return;   /* hide empty open layers */
        const cap = document.createElement('div'); cap.className = 'side-cap'; cap.dataset.layer = g.id;
        cap.textContent = g.name + (g.locked ? '  ·  locked' : '');
        nav.appendChild(cap);
        if (g.locked) {
          const d = document.createElement('button'); d.className = 'mod'; d.dataset.layer = g.id;
          d.innerHTML = '<span class="ic">🚪</span><span class="nm">Open this layer</span>';
          d.title = 'A door sign, not a lock — see Layers for what that means';
          d.onclick = () => this.knock(g.id);
          nav.appendChild(d);
          return;
        }
        if (!g.modules.length) {
          const e = document.createElement('div'); e.className = 'side-cap';
          e.style.cssText = 'color:var(--muted-2);letter-spacing:0;text-transform:none;font-size:11px';
          e.textContent = 'no modules here yet'; nav.appendChild(e); return;
        }
        g.modules.filter(m => m.id !== 'workshop-command-center' && m.id !== 'presentation-spine').forEach(m => {
          const life = store.getLifecycle(m.id);
          const b = document.createElement('button'); b.className = 'mod fx-lift'; b.dataset.id = m.id; b.dataset.layer = g.id; b.dataset.navKind = 'module';
          b.innerHTML = '<span class="ic fx-tile fx-glow">' + iconFor(m) + '</span><span class="nm"></span>'
            + '<span class="life ' + this.lifeClass(life) + '"></span>';
          b.querySelector('.nm').textContent = Core.friendlyName(m);
          b.title = m.name + ' · ' + m.id;
          const lifeBadge = b.querySelector('.life');
          const lifeLabel = shortLife(life);
          lifeBadge.textContent = lifeLabel;
          lifeBadge.setAttribute('aria-label', 'Status: ' + lifeLabel);
          lifeBadge.title = this.lifecycleTruth(m.id, life);
          b.onclick = () => this.open(m.id);
          this.bindLifecycleMenu(b, m);
          nav.appendChild(b);
        });
      });
      /* hidden ≠ secret: always say what's tucked away, one click to reveal */
      if (hiddenLayers) {
        const f = document.createElement('button'); f.className = 'mod'; f.dataset.technical = 'true';
        f.style.cssText = 'margin-top:10px;opacity:.7;font-size:12px';
        f.innerHTML = '<span class="ic">◇</span><span class="nm"></span>';
        f.querySelector('.nm').textContent = hiddenMods + ' machine module' + (hiddenMods === 1 ? '' : 's') + ' hidden';
        f.title = 'Machine-native modules, kept out of your way. Click to show.';
        f.onclick = () => this.openLayers();
        nav.appendChild(f);
      }
    },
    /* knock on a door-signed layer. Honest: this is not security. */
    knock(layerId) {
      const l = this.layers.find(x => x.id === layerId); if (!l) return;
      if (!l.hash) { this.unlock(layerId); return; }   /* gate with no phrase is not a gate */
      const a = prompt('"' + l.name + '" has a door sign.\n\nThis is NOT security — it only stops accidental entry. Anyone who wants in can get in.\n\nPassphrase:');
      if (a === null) return;
      if (Core.checkDoor(l, a)) { this.unlock(layerId); this.log('ok', 'opened layer ' + l.name); }
      else { this.log('warn', 'wrong passphrase for layer ' + l.name); alert('Not that one.'); }
    },
    unlock(layerId) {
      if (this.unlocked.indexOf(layerId) < 0) this.unlocked.push(layerId);
      try { sessionStorage.setItem('axm.hub.unlocked', JSON.stringify(this.unlocked)); } catch (e) {}
      this.renderSidebar(); this.renderHome();
    },
    lock(layerId) {
      this.unlocked = this.unlocked.filter(x => x !== layerId);
      try { sessionStorage.setItem('axm.hub.unlocked', JSON.stringify(this.unlocked)); } catch (e) {}
      const g = Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed).find(x => x.id === layerId);
      if (g && this.active && g.modules.some(m => m.id === this.active)) this.showHome();
      this.log('info', 'locked layer ' + layerId);
      this.renderSidebar(); this.renderHome();
    },
    renderHome() {
      const g = $('homeGrid'); if (!g) return; g.innerHTML = '';
      const groups = Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed);
      const title = $('homeTitle'), intro = $('homeIntro');
      this.renderSystemDeck();
      const makeModuleCard = m => {
        const priority = Number.isInteger(m.rank) ? '#' + String(m.rank).padStart(2, '0') : null;
        const identity = [priority, m.phase, m.name, m.id].filter(Boolean);
        const lifecycle = store.getLifecycle(m.id);
        const c = document.createElement('button'); c.type = 'button'; c.className = 'hcard module-card'; c.title = identity.join(' · '); c.dataset.id = m.id;
        c.innerHTML = '<div class="hcard-icon">' + iconFor(m) + '</div><span class="life module-card-life"></span><h3></h3><p></p><div class="open">Open →</div>';
        const lifecycleBadge = c.querySelector('.module-card-life');
        lifecycleBadge.textContent = shortLife(lifecycle);
        lifecycleBadge.classList.add(this.lifeClass(lifecycle));
        lifecycleBadge.setAttribute('aria-label', 'Status: ' + shortLife(lifecycle));
        lifecycleBadge.title = this.lifecycleTruth(m.id, lifecycle);
        c.querySelector('h3').textContent = Core.friendlyName(m);
        c.querySelector('p').textContent = [priority, m.phase, ...(m.tags || []).slice(0, 3)].filter(Boolean).join(' · ') || m.status;
        if (priority) c.dataset.roadmapRank = String(m.rank);
        if (m.phase) c.dataset.roadmapPhase = m.phase;
        c.onclick = () => this.open(m.id); this.bindLifecycleMenu(c, m); return c;
      };
      const selected = this.homeLayer && groups.find(x => x.id === this.homeLayer && !x.locked && !x.hidden);
      if (selected) {
        title.textContent = selected.name;
        intro.textContent = selected.note || 'Choose a tool in this workspace.';
        const back = document.createElement('button'); back.type = 'button'; back.className = 'hcard utility-card'; back.innerHTML = '<div class="hcard-icon">←</div><h3>All workspaces</h3><p>Return to the simple Home screen.</p><div class="open">Back</div>'; back.onclick = () => this.showHome(); g.appendChild(back);
        selected.modules.filter(m => m.id !== 'workshop-command-center').forEach(m => g.appendChild(makeModuleCard(m)));
        return;
      }
      this.homeLayer = null;
      title.textContent = 'What would you like to make today?';
      intro.textContent = 'Tell AXM what you want to do, or choose a workspace below. You can reach the full toolset whenever you need it.';
      const order = ['create','build','publish','play','ai-team'];
      const descriptions = { create:'Shape an idea, design the experience, and make the pieces.', build:'Turn an idea into something working, checked, and recoverable.', publish:'Find assets, export versions, package safely, and release honestly.', play:'Start a game or shared experience.', 'ai-team':'Talk, create, and solve things with your machine collaborators.' };
      const humanLabels = { create:'Make something', build:'Make it work', publish:'Share the result', play:'Enjoy together', 'ai-team':'Work together' };
      const commandCenter = this.registry.find(m => m.id === 'workshop-command-center');
      if (commandCenter) {
        const command = document.createElement('button'); command.type = 'button'; command.className = 'hcard command-center-home-card';
        command.innerHTML = '<div class="command-home-core" aria-hidden="true"><b>AXM</b><i></i></div><div class="command-home-copy"><span>ONE-PAGE BEGINNER COCKPIT</span><h3>Workshop Command Center</h3><p>Tell AXM what you want, inspect the plan, queue up to ten independent reviews, cast your vote, and watch real Workshop output.</p><div class="open">Enter Command Center</div></div><div class="command-home-state"><b>TOP LEVEL</b><span>Above 5 parent rooms</span></div>';
        command.onclick = () => this.open('workshop-command-center'); g.appendChild(command);
      }
      order.forEach((id, index) => {
        const gr = groups.find(x => x.id === id); if (!gr) return;
        const c = document.createElement('button'); c.type = 'button'; c.className = 'hcard workflow-card'; c.dataset.workflow = id;
        c.innerHTML = '<span class="workflow-index" aria-hidden="true"></span><div class="workflow-icon">' + workflowIcon(id) + '</div><div class="workflow-copy"><div class="human-label"></div><h3></h3><p></p><div class="workflow-preview"></div><div class="open">Enter workspace</div></div>';
        c.querySelector('.workflow-index').textContent = String(index + 1).padStart(2, '0');
        c.querySelector('.human-label').textContent = humanLabels[id];
        c.querySelector('h3').textContent = gr.name;
        c.querySelector('p').textContent = descriptions[id];
        c.querySelector('.workflow-preview').textContent = gr.modules.length + ' tool' + (gr.modules.length === 1 ? '' : 's') + ' inside · open to choose';
        c.onclick = () => this.showHome(id); g.appendChild(c);
      });
      const directionModule = this.registry.find(m => m.id === 'workshop-direction');
      if (directionModule) {
        const direction = document.createElement('button'); direction.type = 'button'; direction.className = 'hcard utility-card direction-home-card';
        direction.innerHTML = '<div class="hcard-icon">&#8644;</div><h3>Workshop Direction</h3><p>Give AXM a goal, route it to the required modules, and expose missing hands before work begins.</p><div class="open">Open direction layer &rarr;</div>';
        direction.onclick = () => this.open('workshop-direction');
        g.appendChild(direction);
      }
      const growth = document.createElement('button'); growth.type = 'button'; growth.className = 'hcard utility-card technical-card growth-home-card';
      growth.innerHTML = '<div class="hcard-icon">&#10022;</div><h3>Workshop Growth</h3><p>Files, characters, lines, modules, games and milestone snapshots.</p><div class="open">Open infographic &rarr;</div>';
      growth.onclick = () => { if (window.AXMWorkshopGrowth) window.AXMWorkshopGrowth.open(); };
      g.appendChild(growth);
      /* always-present dashboard visibility control. This never claims to
         install, retire, connect, or stop the underlying module/service. */
      const add = document.createElement('button'); add.type = 'button'; add.className = 'hcard utility-card technical-card';
      add.style.borderStyle = 'dashed';
      const avail = this.registry.length, on = this.visible.length;
      const integrated = this.registry.filter(m => !!m.integratedInto).length;
      add.innerHTML = '<h3>＋ Dashboards</h3><p>' + on + ' visible · ' + Math.max(0, avail - on) + ' hidden. Visibility never retires or stops a service.</p><div class="open">Choose visibility →</div>';
      if (integrated) add.querySelector('p').textContent = on + ' visible · ' + integrated + ' integrated into workspaces · ' + Math.max(0, avail - on - integrated) + ' hidden. Integration never retires a service.';
      add.onclick = () => this.openModules();
      g.appendChild(add);
      const lay = document.createElement('button'); lay.type = 'button'; lay.className = 'hcard utility-card technical-card';
      lay.style.borderStyle = 'dashed';
      const lockedCount = groups.filter(x => x.locked).length;
      lay.innerHTML = '<h3>▤ Layers</h3><p>' + groups.length + ' layers' + (lockedCount ? ' · ' + lockedCount + ' locked' : '') + '. Group modules into spaces. Door signs, not locks.</p><div class="open">Manage →</div>';
      lay.onclick = () => this.openLayers();
      g.appendChild(lay);
    },
    async loadHumanUsabilityCatalog() {
      if (this.humanUsabilityByModule) return this.humanUsabilityByModule;
      if (this.humanUsabilityPromise) return this.humanUsabilityPromise;
      this.humanUsabilityPromise = fetch('/shared/capability-intelligence/generated/platform-usability/catalog.json', {cache:'no-store'})
        .then(response => { if (!response.ok) throw Error('HTTP ' + response.status); return response.json(); })
        .then(payload => {
          if (!payload || payload.schema !== 'axm.platform-human-usability-catalog/v1' || !Array.isArray(payload.items)) throw Error('catalog contract mismatch');
          if (!payload.coverage || !payload.coverage.all_registered_modules_guided) throw Error('catalog coverage is incomplete');
          const index = {};
          payload.items.forEach(item => { if (item && item.module_id) index[item.module_id] = item; });
          this.humanUsabilityByModule = index;
          this.humanUsabilityError = null;
          this.updateHumanGuideQuick();
          return index;
        })
        .catch(error => {
          this.humanUsabilityError = String(error && error.message || error);
          this.humanUsabilityPromise = null;
          this.updateHumanGuideQuick();
          this.log('warn', 'human usability guide unavailable · module behavior unchanged');
          return null;
        });
      return this.humanUsabilityPromise;
    },
    humanUsabilityFor(id, destinationId) {
      const index = this.humanUsabilityByModule || {};
      return index[id] || index[destinationId] || null;
    },
    updateHumanGuideQuick() {
      const button = $('humanGuideQuick'); if (!button) return;
      button.hidden = !this.active;
      if (!this.active) return;
      const record = this.humanUsabilityFor(this.active);
      button.disabled = !record && !this.humanUsabilityError;
      button.title = record ? 'Understand ' + record.module_name + ' before using it' : this.humanUsabilityError ? 'Human guide unavailable' : 'Loading human guide';
    },
    async openHumanGuide(id) {
      const screen = $('humanGuideScreen'), body = $('humanGuideBody'), state = $('humanGuideState'), title = $('humanGuideTitle');
      if (!screen || !body || !state || !title) return;
      screen.classList.add('show'); body.replaceChildren(); state.textContent = 'Loading source-bound guidance…';
      await this.loadHumanUsabilityCatalog();
      const record = this.humanUsabilityFor(id || this.active);
      if (!record) { title.textContent = 'Human guide unavailable'; state.textContent = 'The catalog could not be loaded. The module remains unchanged and no guidance is guessed.'; return; }
      title.textContent = record.module_name;
      state.textContent = record.status + ' · risk ' + record.risk + ' · source-bound TEST guidance';
      const addCard = (label, heading, text, list, wide) => {
        const card=document.createElement('section');card.className='human-guide-card'+(wide?' wide':'');
        const eyebrow=document.createElement('span');eyebrow.textContent=label;const h=document.createElement('h3');h.textContent=heading;const p=document.createElement('p');p.textContent=text||'';
        card.appendChild(eyebrow);card.appendChild(h);card.appendChild(p);
        if(Array.isArray(list)&&list.length){const ul=document.createElement('ul');list.slice(0,8).forEach(value=>{const li=document.createElement('li');li.textContent=value;ul.appendChild(li);});card.appendChild(ul);}
        body.appendChild(card);return card;
      };
      addCard('MODULE 1 · UNDERSTAND', 'What it does', record.module1.plain_explanation, [record.module1.why_it_matters], true);
      addCard('DECLARED ENVELOPE', 'What it needs', 'Inputs declared by this module:', record.module1.inputs);
      addCard('DECLARED ENVELOPE', 'What it produces', 'Outputs declared by this module:', record.module1.outputs);
      const pattern = record.module2.interface_name || 'No safe interface selected';
      const interfaceCard=addCard('MODULE 2 · INTERFACE', pattern, record.module2.interface_name ? 'Recommended for a beginner, desktop/phone, local-first and screen-reader-aware context.' : 'The recommendation is held because critical source information is missing.', null, true);
      const chips=document.createElement('div');chips.className='human-guide-chip-row';(record.module2.required_controls||[]).forEach(value=>{const chip=document.createElement('span');chip.className='human-guide-chip';chip.textContent=value.replace(/_/g,' ');chips.appendChild(chip);});interfaceCard.appendChild(chips);
      const assurance=document.createElement('span');assurance.className='human-guide-status'+(record.module2.assurance_status==='PASS'?'':' review');assurance.textContent='ASSURANCE ' + record.module2.assurance_status + ' · ' + record.module2.recommendation_status.replace(/_/g,' ');interfaceCard.appendChild(assurance);
      const gapText = record.module3.gap_state === 'GUIDANCE_READY' ? 'The advisory guidance passed deterministic assurance. Implementation and visual approval remain separate.' : 'Module 3 retained this as a review need; nothing was auto-fixed, promoted, or canonized.';
      addCard('MODULE 3 · EVOLVE SAFELY', record.module3.gap_state.replace(/_/g,' '), gapText, record.module3.candidate_id ? ['Candidate: ' + record.module3.candidate_id] : []);
      const sourceCard=addCard('SOURCE & LIMITS', 'How much to trust', 'Manifest: ' + record.source.manifest + ' · SHA-256 ' + record.source.manifest_sha256, record.module1.known_limitations);sourceCard.classList.add('human-guide-source');
    },
    async renderCapabilityGuide(query) {
      const out = $('capabilityResults'), input = $('capabilityQuery'); if (!out || !window.AXMCapabilityIndex) return;
      const q = String(query == null ? (input && input.value) : query).trim().slice(0, 200); if (input) input.value = q;
      out.innerHTML = ''; if (!q) return;
      await this.loadHumanUsabilityCatalog();
      let matches = [];
      try { const response=await fetch('/api/workshop/capabilities?q='+encodeURIComponent(q),{cache:'no-store'}); if(!response.ok)throw Error('HTTP '+response.status); matches=(await response.json()).matches||[]; }
      catch(e){ matches=window.AXMCapabilityIndex.search(this.registry,q,{limit:6}); this.log('warn','capability readiness unavailable · local recommendations kept'); }
      if (!matches.length) { const empty=document.createElement('div'); empty.className='capability-empty'; empty.textContent='No clear route yet. Try a simpler goal, or open a workspace below and explore freely.'; out.appendChild(empty); return; }
      const routes=Core.organizeCapabilityRoutes(matches), primary=routes.usable[0], makeCard=(match,blocked,hideOpen) => {
        const card=document.createElement('article');card.className='capability-result';
        const readiness=match.readiness&&match.readiness.state||'UNKNOWN';card.dataset.readiness=readiness;
        const title=document.createElement('b');title.textContent=Core.friendlyName(this.registry.find(x=>x.id===match.destinationId)||{id:match.destinationId,name:match.destinationName});
        const summary=document.createElement('span');summary.textContent=match.summary||match.reason;
        const ready=document.createElement('small');ready.textContent=blocked?'Not usable yet · '+readiness.replace('_',' '):'Usable now · '+readiness.replace('_',' ');
        card.appendChild(title);card.appendChild(summary);card.appendChild(ready);
        if(blocked&&match.readiness&&match.readiness.attention&&match.readiness.attention.length){const guidance=document.createElement('span'),first=match.readiness.attention[0];guidance.className='readiness-guidance';guidance.textContent=first.label+': '+first.nextStep;card.appendChild(guidance);}
        const human=this.humanUsabilityFor(match.id,match.destinationId);
        if(human){const guide=document.createElement('div');guide.className='human-usability';const label=document.createElement('small');label.textContent='HUMAN GUIDE · 1 → 2 → 3';const explanation=document.createElement('span');explanation.textContent=human.module1.plain_explanation;const pattern=document.createElement('em');pattern.textContent=human.module2.interface_name?'Best interface: '+human.module2.interface_name+' · assurance '+human.module2.assurance_status:'Interface held: critical source information is missing';const see=document.createElement('button');see.type='button';see.className='capability-human-open';see.textContent='Understand inputs, outputs, controls and limits';see.onclick=()=>this.openHumanGuide(human.module_id);guide.appendChild(label);guide.appendChild(explanation);guide.appendChild(pattern);guide.appendChild(see);card.appendChild(guide);}
        if(!blocked&&!hideOpen){const open=document.createElement('button');open.type='button';open.className='capability-open';open.textContent='Open '+title.textContent;open.onclick=()=>this.openCapability(match.destinationId,{goal:q,creationMode:'self'});card.appendChild(open);}
        return card;
      };
      if(primary){
        const intro=document.createElement('section');intro.className='capability-best';
        const eyebrow=document.createElement('small');eyebrow.textContent='BEST PLACE TO START';
        const heading=document.createElement('h3');heading.textContent='AXM can route this goal.';
        const text=document.createElement('p');text.textContent='Choose how you want the work to happen. Nothing starts until you choose.';
        const isStudioCreation=primary.destinationId==='studio'&&/\b(design|draw|paint|create|make|crest|logo|icon|art|image|skin|poster|sprite)\b/i.test(q);
        intro.appendChild(eyebrow);intro.appendChild(heading);intro.appendChild(text);intro.appendChild(makeCard(primary,false,isStudioCreation));
        if(isStudioCreation){
          const chooser=document.createElement('div');chooser.className='creation-mode-chooser';
          const chooserTitle=document.createElement('h4');chooserTitle.textContent='How do you want to create it?';chooser.appendChild(chooserTitle);
          [
            ['deterministic','DETERMINISTIC','Make a bounded draft','Workshop Creation Hands build an editable candidate from declared rules.'],
            ['self','SELF CREATION','I want to make it','Open the editable Studio tools with this goal already loaded.'],
            ['ai','AI ASSISTED','Create with AI help','Your brief waits in Studio until an AI is connected; nothing starts automatically.']
          ].forEach(option=>{const button=document.createElement('button');button.type='button';button.className='creation-mode';button.dataset.mode=option[0];const label=document.createElement('small');label.textContent=option[1];const name=document.createElement('b');name.textContent=option[2];const detail=document.createElement('span');detail.textContent=option[3];button.appendChild(label);button.appendChild(name);button.appendChild(detail);button.onclick=()=>this.openCapability(primary.destinationId,{goal:q,creationMode:option[0]});chooser.appendChild(button);});
          intro.appendChild(chooser);
        }
        out.appendChild(intro);
      }
      if(routes.usable.length>1){const more=document.createElement('details');more.className='capability-alternatives';const summary=document.createElement('summary');summary.textContent='Other usable places ('+(routes.usable.length-1)+')';const grid=document.createElement('div');grid.className='capability-grid';routes.usable.slice(1).forEach(match=>grid.appendChild(makeCard(match,false)));more.appendChild(summary);more.appendChild(grid);out.appendChild(more);}
      if(routes.blocked.length){const blocked=document.createElement('details');blocked.className='capability-alternatives capability-blocked';const summary=document.createElement('summary');summary.textContent='Not usable yet ('+routes.blocked.length+')';const note=document.createElement('p');note.textContent='These are explanations, not recommendations. Nothing is repaired automatically.';const grid=document.createElement('div');grid.className='capability-grid';routes.blocked.forEach(match=>grid.appendChild(makeCard(match,true)));blocked.appendChild(summary);blocked.appendChild(note);blocked.appendChild(grid);out.appendChild(blocked);}
      if(!primary){const empty=document.createElement('div');empty.className='capability-empty';empty.textContent='AXM found related modules, but none can honestly do this yet. Open “Not usable yet” to see what is missing.';out.insertBefore(empty,out.firstChild);}
      this.log('info','capability guide · '+routes.usable.length+' usable destination(s) · '+routes.blocked.length+' held for "'+q+'"');
    },
    openCapability(id, options) {
      options=options||{};
      const module=this.registry.find(x=>x.id===id); if (!module) return this.log('warn','capability destination unavailable: '+id);
      if(options.goal){try{sessionStorage.setItem('axm.capability.goal-handoff.v1',JSON.stringify({schema:'axm.capability-goal-handoff/v1',destinationId:id,goal:String(options.goal).slice(0,600),creationMode:['deterministic','self','ai'].indexOf(options.creationMode)>=0?options.creationMode:'self',createdAt:now(),automaticStart:false}));}catch(e){this.log('warn','could not preserve capability goal handoff');}}
      if (this.enabled.indexOf(id)<0) this.enable(id);
      this.open(id);
    },
    async loadContinuity() {
      try { const response=await fetch('/api/workshop/recents',{cache:'no-store'}); if(!response.ok)throw Error('HTTP '+response.status); this.continuityRecords=(await response.json()).records||[]; }
      catch(e){ this.continuityRecords=[]; this.log('warn','recent-work references unavailable · workspaces still open normally'); }
      this.renderContinuity();
    },
    async recordContinuity(record) {
      try { const response=await fetch('/api/workshop/recents',{method:'POST',headers:{'content-type':'application/json','x-axm-continuity':'explicit-workspace-event'},body:JSON.stringify({record:record})}); if(!response.ok)throw Error('HTTP '+response.status); await this.loadContinuity(); }
      catch(e){ this.log('warn','could not update recent-work reference'); }
    },
    async forgetContinuity(id) {
      try { const response=await fetch('/api/workshop/recents?id='+encodeURIComponent(id),{method:'DELETE',headers:{'x-axm-continuity':'explicit-forget'}}); if(!response.ok)throw Error('HTTP '+response.status); await this.loadContinuity(); this.log('info','forgot one recent-work reference · project data unchanged'); }
      catch(e){ this.log('warn','could not forget recent-work reference'); }
    },
    renderContinuity() {
      const strip=$('continuityStrip'),list=$('continuityList'); if(!strip||!list)return; list.innerHTML=''; const records=(this.continuityRecords||[]).slice(0,8); strip.hidden=!records.length;
      records.forEach(record=>{const item=document.createElement('article');item.className='continuity-item';const open=document.createElement('button');open.type='button';open.className='continuity-open';const title=document.createElement('b');title.textContent=record.projectName||record.workspaceName;const meta=document.createElement('span');meta.textContent=(record.workspaceName||record.workspaceId)+' · '+new Date(record.updatedAt).toLocaleString();const hint=document.createElement('small');hint.textContent=record.resumeHint||'Open saved state';open.appendChild(title);open.appendChild(meta);open.appendChild(hint);open.onclick=()=>this.openCapability(record.workspaceId);const forget=document.createElement('button');forget.type='button';forget.className='continuity-forget';forget.setAttribute('aria-label','Forget '+(record.projectName||record.workspaceName)+' from recent work');forget.title='Forget this reference · project data stays';forget.textContent='×';forget.onclick=()=>this.forgetContinuity(record.id);item.appendChild(open);item.appendChild(forget);list.appendChild(item);});
      this.renderSystemDeck();
    },
    renderSystemDeck() {
      const tools = $('heroToolCount'), resumes = $('heroResumeCount'), mode = $('heroModeState'), signal = $('heroSystemSignal'), deck = $('heroSystemDeck');
      if (tools) tools.textContent = String((this.visible || []).length);
      if (resumes) resumes.textContent = String((this.continuityRecords || []).length);
      if (mode) mode.textContent = this.mode === 'advanced' ? 'Advanced' : 'Simple';
      const source = $('systemStatus');
      if (signal && source) signal.textContent = source.textContent || 'Checking';
      if (deck && source) deck.dataset.tone = source.classList.contains('degraded') ? 'warning' : source.classList.contains('paused') ? 'paused' : source.classList.contains('checking') ? 'checking' : 'ready';
    },
    loadHandoffBroker() {
      const source=$('handoffSource'),artifact=$('handoffArtifact');if(!source||!artifact)return;
      const candidates=this.registry.filter(x=>!x.integratedInto&&Array.isArray(x.produces)&&x.produces.length);
      source.innerHTML='';candidates.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=Core.friendlyName(item);source.appendChild(option);});
      const update=()=>{artifact.innerHTML='';const item=this.registry.find(x=>x.id===source.value);(item&&item.produces||[]).forEach(kind=>{const option=document.createElement('option');option.value=kind;option.textContent=kind;artifact.appendChild(option);});$('handoffResults').innerHTML='';};
      source.onchange=update;update();
    },
    async findHandoffDestinations() {
      const source=$('handoffSource').value,artifact=$('handoffArtifact').value,out=$('handoffResults');out.innerHTML='';if(!source||!artifact)return;
      try{const response=await fetch('/api/workshop/handoffs?source='+encodeURIComponent(source)+'&artifact='+encodeURIComponent(artifact),{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||('HTTP '+response.status));const matches=data.matches||[];if(!matches.length){const empty=document.createElement('div');empty.className='handoff-empty';empty.textContent='No workspace currently declares this format. Nothing was converted or moved.';out.appendChild(empty);return;}matches.forEach(match=>{const card=document.createElement('article');card.className='handoff-result';const title=document.createElement('b');title.textContent=Core.friendlyName(this.registry.find(x=>x.id===match.destinationId)||{id:match.destinationId,name:match.destinationName});const detail=document.createElement('span');detail.textContent=match.artifactKind+' is accepted as '+match.acceptedAs+'.';const mode=document.createElement('small');mode.textContent=(match.match==='exact'?'Exact format':'Declared format family')+' · proposal only';const button=document.createElement('button');button.type='button';button.className='handoff-prepare';button.textContent='Prepare handoff';button.onclick=()=>this.prepareHandoff(match);card.appendChild(title);card.appendChild(detail);card.appendChild(mode);card.appendChild(button);out.appendChild(card);});this.log('info','handoff broker · '+matches.length+' declared destination(s)');}
      catch(e){const empty=document.createElement('div');empty.className='handoff-empty';empty.textContent='Handoff check unavailable. No project data moved.';out.appendChild(empty);this.log('warn','handoff broker unavailable');}
    },
    async prepareHandoff(match) {
      const out=$('handoffResults');try{const response=await fetch('/api/workshop/handoffs',{method:'POST',headers:{'content-type':'application/json','x-axm-handoff':'explicit-prepare-proposal'},body:JSON.stringify({sourceId:match.sourceId,artifactKind:match.artifactKind,destinationId:match.destinationId,acceptedAs:match.acceptedAs,note:'Prepared from Hub after an explicit choice'})});const data=await response.json();if(!response.ok)throw Error(data.error||('HTTP '+response.status));const message=document.createElement('div');message.className='handoff-confirmation';message.textContent='Handoff proposal prepared for '+match.destinationName+'. No file was copied, imported, opened or converted. Open the destination only when you choose.';out.prepend(message);this.log('ok','handoff proposal prepared · review required · no data copied');}
      catch(e){this.log('warn','handoff proposal refused · '+e.message);}
    },
    requestActiveShutdown() {
      const id = this.active, frame = $('viewFrame'), record = id && this.records[id];
      if (!id || !frame || !frame.contentWindow || !record || !record.passport || record.passport.handlesShutdown !== true) return Promise.resolve({ requested: false });
      if (this.pendingShutdown && this.pendingShutdown.promise) return this.pendingShutdown.promise;
      let finish;
      const promise = new Promise(resolve => { finish = resolve; });
      const pending = { id, promise, finish: result => {
        if (this.pendingShutdown !== pending) return;
        clearTimeout(pending.timer); this.pendingShutdown = null; finish(result);
      } };
      pending.timer = setTimeout(() => {
        this.log('warn', id + ' shutdown checkpoint timed out; navigation continued');
        pending.finish({ requested: true, acknowledged: false });
      }, 800);
      this.pendingShutdown = pending;
      frame.contentWindow.postMessage({ type: 'hub:shutdown:request', moduleId: id }, '*');
      return promise;
    },
    async showHome(layerId, options) {
      options = options || {};
      const navigationToken = ++this.frameLoadSequence;
      if (this.active && options.skipShutdown !== true) await this.requestActiveShutdown();
      if (navigationToken !== this.frameLoadSequence) return;
      this.active = null;
      this.homeLayer = layerId || null;
      $('viewFrame').style.display = 'none';
      $('homeScreen').style.display = 'block';
      /* Home is a destination, not a restored reading position. Returning to
         it midway down made the workflow cards look as if they had vanished. */
      $('homeScreen').scrollTop = 0;
      $('activeName').textContent = this.homeLayer ? ((this.layers.find(l => l.id === this.homeLayer) || {}).name || 'Home') : 'Home';
      this.updatePresentationQuick();
      this.updateHumanGuideQuick();
      [...document.querySelectorAll('.mod')].forEach(x => x.classList.remove('active'));
      const workflowHome = this.homeLayer && document.querySelector('.workflow-nav[data-layer="' + this.homeLayer + '"]');
      if (workflowHome) workflowHome.classList.add('active');
      else $('homeBtn').classList.add('active');
      store.setState({ lastModuleId: null });
      this.renderHome();
      this.renderContinuity();
      if (options.history !== false) this.recordScreen({ kind: 'home', layerId: this.homeLayer || '', label: $('activeName').textContent || 'Home' });
      else this.refreshBackButton();
    },
    async open(id, options) {
      options = options || {};
      const m = this.registry.find(x => x.id === id);
      if (!m) { this.log('error', 'no such module: ' + id); return; }
      /* a module in a locked layer knocks first. NOTE: this is a door sign,
         not a permission boundary — it changes nothing about what the module
         may do once open. Permissions come only from its passport. */
      const lid = Core.layerOf(m, this.layers, this.assign);
      const grp = Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed).find(g => g.id === lid);
      if (grp && grp.locked) { this.knock(lid); if (this.unlocked.indexOf(lid) < 0) return; }
      const navigationToken = ++this.frameLoadSequence;
      if (this.active && options.skipShutdown !== true) await this.requestActiveShutdown();
      if (navigationToken !== this.frameLoadSequence) return;
      this.active = id;
      this.updatePresentationQuick();
      this.updateHumanGuideQuick();
      $('homeScreen').style.display = 'none';
      const err = $('vpError'); err.classList.remove('show');
      const load = $('vpLoading'); load.classList.add('show');
      const f = $('viewFrame'); f.style.display = 'block';
      /* blank-screen guard: if the frame hasn't reported ready or painted, show recovery */
      let painted = false;
      let paintProbe = null;
      const url = '/tools/' + encodeURIComponent(m.folder) + '/' + m.entry;
      const acceptPaintedFrame = () => {
        if (navigationToken !== this.frameLoadSequence || this.active !== id) return false;
        try {
          painted = !!(f.contentDocument && f.contentDocument.body && f.contentDocument.body.childNodes.length);
          if (!painted) return false;
          load.classList.remove('show');
          this.applyPresentationToFrame(m);
          if (paintProbe) { clearInterval(paintProbe); paintProbe = null; }
          return true;
        } catch (e) { return false; }
      };
      f.onload = () => {
        if (navigationToken !== this.frameLoadSequence || this.active !== id) return;
        load.classList.remove('show');
        try {
          const loadedRoute = (f.contentWindow.location.pathname || '') + (f.contentWindow.location.search || '') + (f.contentWindow.location.hash || '');
          if (window.AXMWorkshopNavigation && window.AXMWorkshopNavigation.isHubHomeRoute(loadedRoute)) {
            painted = true;
            f.onload = null;
            f.removeAttribute('src');
            this.log('info', 'module returned to Home · cleared nested Hub frame');
            this.showHome(null, { skipShutdown: true });
            return;
          }
          acceptPaintedFrame();
        }
        catch (e) { painted = true; /* cross-doc but loaded = not blank */ }
        if (paintProbe) { clearInterval(paintProbe); paintProbe = null; }
        if (!painted) this.showError(m, 'Module loaded but its screen is empty.');
      };
      f.onerror = () => {
        if (navigationToken !== this.frameLoadSequence || this.active !== id) return;
        if (paintProbe) { clearInterval(paintProbe); paintProbe = null; }
        load.classList.remove('show'); this.showError(m, 'Module failed to load.');
      };
      /* Some embedded local documents paint correctly without emitting a
         reliable iframe load event in every browser host. Observe the actual
         same-origin paint as a second honest ready signal. */
      paintProbe = setInterval(() => {
        if (navigationToken !== this.frameLoadSequence || this.active !== id) {
          clearInterval(paintProbe); paintProbe = null; return;
        }
        acceptPaintedFrame();
      }, 250);
      setTimeout(() => {
        if (navigationToken !== this.frameLoadSequence || this.active !== id) return;
        if (paintProbe) { clearInterval(paintProbe); paintProbe = null; }
        if (load.classList.contains('show') && !acceptPaintedFrame()) { load.classList.remove('show'); this.showError(m, 'Module timed out.'); }
      }, 8000);
      f.src = url;
      $('activeName').textContent = Core.friendlyName(m);
      [...document.querySelectorAll('.mod')].forEach(x => x.classList.toggle('active', x.dataset.id === id));
      $('homeBtn').classList.remove('active');
      /* record + persist which module is open, and bump CLAIMED->NEEDS VERIFY */
      if (!this.records[id]) this.records[id] = { id, lifecycle: store.getLifecycle(id) };
      store.setState({ lastModuleId: id });
      this.log('info', 'switched to ' + m.name);
      this.recordContinuity({workspaceId:id,workspaceName:Core.friendlyName(m),projectId:'workspace',projectName:Core.friendlyName(m),documentSchema:'axm.workspace-reference/v1',route:url,resumeHint:'Open the workspace and continue from its own local saved state.',updatedAt:now(),source:'workspace-open'});
      if (options.history !== false) this.recordScreen({ kind: 'module', id: id, label: Core.friendlyName(m) });
      else this.refreshBackButton();
    },
    presentationResolution(module) {
      if (!window.AXMPresentationPolicy || !module) return null;
      return window.AXMPresentationPolicy.resolve({
        module,
        userMode: store.getPresentationMode(module.id),
        sharedProfile: store.getSharedPresentationProfile()
      });
    },
    screenContract(module) {
      if (!window.AXMScreenContract || !module) return null;
      return window.AXMScreenContract.resolve(module);
    },
    sharedPresentationRecipe() {
      if (!window.AXMPresentationRecipe) return null;
      return window.AXMPresentationRecipe.normalize({
        schema: window.AXMPresentationRecipe.SCHEMA,
        id: 'shared-workshop',
        name: 'Shared Workshop',
        author: 'Mike + AXM',
        profile: store.getSharedPresentationProfile(),
        layers: store.getPresentationLayers()
      });
    },
    boundedPresentationRecipe(module) {
      const recipe = this.sharedPresentationRecipe();
      const contract = this.screenContract(module);
      return window.AXMScreenContract && recipe && contract
        ? window.AXMScreenContract.limitRecipe(window.AXMPresentationRecipe, recipe, contract)
        : recipe;
    },
    applyPresentationToFrame(module) {
      const frame = $('viewFrame'), resolution = this.presentationResolution(module);
      if (!frame || !resolution || !frame.contentDocument) return { applied:false, reason:'presentation-policy-unavailable' };
      try {
        const result = window.AXMPresentationPolicy.applyToDocument(frame.contentDocument, resolution);
        let recipeResult = null;
        if (window.AXMPresentationRecipe) {
          recipeResult = resolution.mode === 'shared'
            ? window.AXMPresentationRecipe.applyToDocument(frame.contentDocument, this.boundedPresentationRecipe(module), {mode:'shared'})
            : window.AXMPresentationRecipe.clearFromDocument(frame.contentDocument);
        }
        this.updatePresentationQuick();
        if (result.applied) this.log('info', Core.friendlyName(module) + ' look: ' + resolution.mode + (resolution.mode === 'shared' ? ' / ' + resolution.profile + (recipeResult && recipeResult.fingerprint ? ' / '+recipeResult.fingerprint : '') : ' / module-owned'));
        return Object.assign({}, result, { recipe:recipeResult });
      } catch (error) {
        this.log('warn', 'presentation switch unavailable for ' + module.id + ' - module view kept');
        return { applied:false, reason:error.message };
      }
    },
    setActivePresentationMode(mode) {
      const module = this.registry.find(item => item.id === this.active);
      if (!module) return;
      const contract = this.screenContract(module);
      if (contract && !contract.presentation.modeEditable) return;
      store.setPresentationMode(module.id, mode);
      this.applyPresentationToFrame(module);
    },
    setSharedPresentationLayer(layer, value) {
      if (!window.AXMPresentationRecipe || !window.AXMPresentationRecipe.LAYERS[layer] || window.AXMPresentationRecipe.LAYERS[layer].indexOf(value) < 0) {
        throw new Error('Unknown presentation layer choice: ' + layer + '/' + value);
      }
      const layers = store.getPresentationLayers(); layers[layer] = value; store.setPresentationLayers(layers);
      const module = this.registry.find(item => item.id === this.active);
      if (module) this.applyPresentationToFrame(module);
    },
    downloadPresentationRecipe() {
      const recipe = this.sharedPresentationRecipe(); if (!recipe) return;
      const blob = new Blob([JSON.stringify(recipe, null, 2) + '\n'], {type:'application/json'});
      const href = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = href; anchor.download = 'axm-shared-presentation-' + window.AXMPresentationRecipe.fingerprint(recipe) + '.json';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(href), 0);
      this.log('ok', 'presentation recipe exported: ' + window.AXMPresentationRecipe.fingerprint(recipe));
    },
    resetPresentationRecipe(screenOnly) {
      const recipe = window.AXMPresentationRecipe && window.AXMPresentationRecipe.DEFAULT;
      if (!recipe) return;
      store.setSharedPresentationProfile(recipe.profile); store.setPresentationLayers(Object.assign({}, recipe.layers));
      const module = this.registry.find(item => item.id === this.active); if (module) this.applyPresentationToFrame(module);
      this.log('info', 'shared presentation recipe reset');
      screenOnly ? this.openScreenEditor() : this.openSettings();
    },
    updatePresentationQuick() {
      const control = $('presentationQuick'), select = $('presentationModeQuick'), note = $('presentationProfileQuick'), edit = $('presentationEditQuick');
      const module = this.registry.find(item => item.id === this.active);
      if (!control || !select) return;
      control.hidden = !module;
      if (!module) return;
      const resolution = this.presentationResolution(module);
      if (!resolution) { control.hidden = true; return; }
      const contract = this.screenContract(module);
      select.value = resolution.mode;
      select.disabled = !resolution.moduleVisual || !!(contract && !contract.presentation.modeEditable);
      if (note) note.textContent = resolution.mode === 'shared' ? resolution.profile : 'own';
      if (edit) {
        edit.disabled = !contract || !contract.presentation.editable;
        edit.title = contract
          ? contract.preset + ' screen · editable: ' + (contract.presentation.editableLayers.join(', ') || 'mode only')
          : 'Screen contract unavailable';
      }
      control.title = resolution.mode === 'shared'
        ? 'Shared ' + resolution.profile + ' presentation. Module behavior and data are unchanged.' + (contract ? ' ' + contract.preset + ' edit boundary.' : '')
        : 'This module keeps its own visual design. Module behavior and data are unchanged.';
    },
    showError(m, why) {
      const err = $('vpError'); err.classList.add('show');
      $('viewFrame').style.display = 'none';
      $('vpErrTitle').textContent = m ? (m.name + ' unavailable') : 'Module unavailable';
      $('vpErrMsg').textContent = why + ' Nothing was lost — pick another module or retry.';
      $('vpRetry').onclick = () => m && this.open(m.id);
      this.log('error', (m ? m.name : 'module') + ': ' + why);
    },
    /* ---- bridge: receive a module's postMessage, run the pure reducer ---- */
    onMessage(ev) {
      const msg = ev.data; if (!msg || typeof msg.type !== 'string' || msg.type.indexOf('hub:') !== 0) return;
      if (msg.type === 'hub:presentation:recipe') {
        if ((!ev.origin || ev.origin !== location.origin) || this.active !== 'presentation-spine' || ev.source !== $('viewFrame').contentWindow || !window.AXMPresentationRecipe) return;
        const checked = window.AXMPresentationRecipe.validate(msg.recipe);
        if (!checked.ok) { this.log('error', 'presentation recipe refused: ' + checked.errors[0]); return; }
        const recipe = window.AXMPresentationRecipe.normalize(msg.recipe);
        store.setSharedPresentationProfile(recipe.profile); store.setPresentationLayers(Object.assign({}, recipe.layers));
        this.applyPresentationToFrame(this.registry.find(item => item.id === this.active));
        this.log('ok', 'shared presentation recipe applied: ' + window.AXMPresentationRecipe.fingerprint(recipe));
        return;
      }
      if (msg.type === 'hub:shutdown:ok') {
        const pending = this.pendingShutdown;
        if (pending && pending.id === this.active && ev.source === $('viewFrame').contentWindow) pending.finish({ requested: true, acknowledged: true });
        return;
      }
      const id = this.active; if (!id) return;
      if (msg.type === 'hub:continuity:upsert') {
        if (ev.origin && ev.origin !== location.origin) return;
        const module=this.registry.find(x=>x.id===id)||{id:id,name:id};
        const record=Object.assign({},msg.record||{},{workspaceId:id,workspaceName:Core.friendlyName(module),route:'/tools/'+encodeURIComponent(module.folder||id)+'/'+(module.entry||'index.html'),source:'workspace-project-save'});
        this.recordContinuity(record); return;
      }
      const cur = this.records[id] || { id, lifecycle: store.getLifecycle(id) };
      const previousLifecycle = store.getLifecycle(id);
      cur.id = id;
      const { record, intents } = C.reduce(cur, msg);
      if (previousLifecycle !== record.lifecycle) record.evidence = null;
      this.records[id] = record;
      store.setLifecycle(id, record.lifecycle);
      if (previousLifecycle !== record.lifecycle) this.persistSharedLifecycle(id, record.lifecycle, 'module-message').then(shared => {
        if (!shared) this.log('warn', id + ' lifecycle changed locally but shared state was unavailable');
      });
      intents.forEach(it => {
        if (it.kind === 'log') this.log(it.level, it.msg);
        if (it.kind === 'persist-settings') store.setSettings(it.id, it.settings);
        if (it.kind === 'persist-state') store.setModuleState(it.id, it.state);
        if (it.kind === 'permission') this.refreshPerm();
      });
      /* answer the module where a reply is expected */
      const frame = $('viewFrame');
      if (msg.type === 'hub:ready') {
        frame.contentWindow.postMessage({ type: 'hub:init', moduleId: id,
          settings: store.getSettings(id), moduleState: store.getModuleState(id),
          granted: record.grantedPermissions }, '*');
      }
      if (msg.type === 'hub:settings:get')
        frame.contentWindow.postMessage({ type: 'hub:settings:value', settings: store.getSettings(id) }, '*');
      this.renderSidebar(); /* reflect lifecycle badge changes */
      const mod = this.registry.find(x => x.id === id);
      [...document.querySelectorAll('.mod')].forEach(x => x.classList.toggle('active', x.dataset.id === id));
    },
    /* ---- shared screens ---- */
    openSettings(options) {
      options = options || {};
      const screenOnly = !!options.screenOnly;
      const s = $('setBody'); s.innerHTML = '';
      const title = $('setTitle'), subtitle = $('setSubtitle');
      if (title) title.textContent = screenOnly ? 'Edit screen' : 'Settings';
      if (subtitle) subtitle.textContent = screenOnly
        ? 'Presentation can move, restyle, or simplify the visible screen without changing behavior, permissions, saved work, or the runtime body.'
        : 'Global hub settings and the active module\'s declared settings.';
      const gs = store.getState();
      if (!screenOnly) s.appendChild(rowEl('Last module on reopen', gs.lastModuleId || '(home)', ''));
      s.appendChild(choiceRow('Shared visual profile', 'Used when a workspace is set to Shared. Auto selects a profile from its declared purpose.',
        ['auto','cockpit','studio','dashboard','lab'], store.getSharedPresentationProfile(), value => {
          store.setSharedPresentationProfile(value);
          const module = this.registry.find(item => item.id === this.active);
          if (module) this.applyPresentationToFrame(module);
        }));
      if (window.AXMPresentationRecipe) {
        const layers = store.getPresentationLayers();
        const labels = {
          surface:['Surface material','Glass, solid, or minimal module surfaces.'],
          depth:['Depth','Flat, raised, or dimensional separation.'],
          motion:['Motion','Still, responsive, or ambient movement; reduced-motion always wins.'],
          density:['Density','Compact, balanced, or comfortable control spacing.'],
          signal:['Signal','Quiet, clear, or luminous emphasis.']
        };
        const activeModule = this.registry.find(item => item.id === this.active);
        const activeContract = this.screenContract(activeModule);
        const editableLayers = screenOnly && activeContract
          ? activeContract.presentation.editableLayers
          : Object.keys(window.AXMPresentationRecipe.LAYERS);
        if (screenOnly && activeContract) s.appendChild(rowEl(
          activeContract.preset + ' screen contract',
          editableLayers.length ? editableLayers.join(' / ') : 'fixed presentation',
          'Body and behavior stay locked. Screen edits are presentation-only.'
        ));
        Object.keys(window.AXMPresentationRecipe.LAYERS).forEach(layer => {
          if (!screenOnly || editableLayers.indexOf(layer) >= 0) {
            s.appendChild(choiceRow(labels[layer][0], labels[layer][1], window.AXMPresentationRecipe.LAYERS[layer], layers[layer], value => this.setSharedPresentationLayer(layer,value)));
          }
        });
        s.appendChild(actionRow('Portable skin recipe', 'Exports presentation data only—no CSS, scripts, permissions, behavior or saved work.', [
          {label:'Download recipe', action:()=>this.downloadPresentationRecipe()},
          {label:'Reset layers', action:()=>this.resetPresentationRecipe(screenOnly)}
        ]));
        s.appendChild(rowEl('Base skin', 'Open Skinner for colors, fonts, assets and layout slots.', 'Recipes compose those foundations; they do not duplicate them.'));
      }
      const id = this.active;
      if (id) {
        const rec = this.records[id] || {};
        const sc = rec.passport && rec.passport.settingsSchema;
        s.appendChild(rowEl('Active module', id, 'lifecycle: ' + store.getLifecycle(id)));
        const module = this.registry.find(item => item.id === id);
        const resolution = this.presentationResolution(module);
        const contract = this.screenContract(module);
        s.appendChild(choiceRow('Active module look', 'Shared keeps the Workshop visually coherent. Module preserves the creator\'s own presentation.',
          ['shared','module'], resolution ? resolution.mode : 'shared', value => this.setActivePresentationMode(value),
          (resolution && !resolution.moduleVisual) || (contract && !contract.presentation.modeEditable)));
        if (!screenOnly && sc) Object.keys(sc).forEach(k => {
          const cur = store.getSettings(id)[k]; s.appendChild(settingRow(id, k, sc[k], cur, this));
        });
        else if (!screenOnly) s.appendChild(rowEl('Module settings', 'none declared', 'this module exposes no settings schema'));
      }
      $('setScreen').classList.add('show');
    },
    openScreenEditor() { this.openSettings({screenOnly:true}); },
    refreshPerm() {
      const s = $('permBody'); if (!s) return; s.innerHTML = '';
      const id = this.active; const rec = id && this.records[id];
      if (!rec || !rec.passport) { s.appendChild(rowEl('Permissions', 'no active module', '')); return; }
      const declared = rec.passport.permissions || [];
      if (!declared.length) s.appendChild(rowEl('Permissions', 'none requested', 'module runs with no elevated access'));
      declared.forEach(p => {
        const granted = (rec.grantedPermissions || []).indexOf(p) >= 0;
        const r = rowEl(p, granted ? 'granted' : 'denied', granted ? '' : 'not in passport / withheld');
        r.querySelector('.k').nextSibling && (r.querySelector('div:nth-child(2)').className = granted ? 'grant' : 'deny');
        s.appendChild(r);
      });
    },
    openPerm() { this.refreshPerm(); $('permScreen').classList.add('show'); },
    openExport() {
      const s = $('expBody'); s.innerHTML = '';
      const log = store.readLog();
      s.appendChild(rowEl('Action log entries', String(log.length), 'shared across all modules'));
      s.appendChild(rowEl('Cached module list', String(store.cachedRegistry().length), 'survives reload'));
      $('expDownload').onclick = () => {
        const blob = new Blob([JSON.stringify({ exportedAt: now(), log, registry: store.cachedRegistry() }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'axm-hub-export.json'; a.click();
        this.log('ok', 'exported hub log + registry');
      };
      $('expScreen').classList.add('show');
    },
    /* ---- module catalog: dashboard visibility, not lifecycle ---- */
    openModules() { this.renderModules(); $('modScreen').classList.add('show'); },
    renderModules() {
      const s = $('modBody'); if (!s) return; s.innerHTML = '';
      const cat = Core.resolveModules(this.registry, this.enabled).catalog;
      if (!cat.length) { s.appendChild(rowEl('No modules found', '', 'drop a folder with a manifest.json into /tools')); return; }
      cat.forEach(m => {
        const r = document.createElement('div'); r.className = 'row';
        const info = document.createElement('div');
        info.innerHTML = '<div class="k"></div><div class="d"></div>';
        info.querySelector('.k').textContent = m.name;
        info.querySelector('.d').textContent = (m.enabled ? 'Shown in Hub navigation' : 'Dashboard hidden · service/lifecycle unchanged')
          + '  ·  ' + (m.tags || []).join(' · ') + '  ·  ' + m.version;
        if (m.integratedInto) info.querySelector('.d').textContent = 'Integrated into ' + Core.friendlyName(this.registry.find(x => x.id === m.integratedInto) || { id:m.integratedInto }) + ' · compatibility route and saved data kept · ' + m.version;
        const btn = document.createElement('button');
        btn.className = 'btn' + (m.enabled ? ' ghost' : '');
        btn.textContent = m.enabled ? 'Hide dashboard' : 'Show dashboard';
        btn.onclick = () => m.enabled ? this.disable(m.id) : this.enable(m.id);
        if (m.integratedInto) {
          btn.className = 'btn ghost'; btn.textContent = 'Open Studio';
          btn.onclick = () => { $('modScreen').classList.remove('show'); this.open(m.integratedInto); };
        }
        r.appendChild(info); r.appendChild(btn); s.appendChild(r);
      });
    },
    /* ---- layers manager ---- */
    openLayers() { this.renderLayers(); $('layScreen').classList.add('show'); },
    saveLayers() { store.setLayers(this.layers); store.setAssign(this.assign); this.resolve(); this.renderLayers(); },
    applyWorkflowLayout() {
      const layout = Core.workflowLayout(this.registry, this.layers);
      this.layers = layout.layers; this.assign = layout.assign;
      this.log('ok', 'applied simple workflow layout: Create · Build · Publish & Library · Play · AI Team · Closed Door / Advanced');
      this.saveLayers();
    },
    renderLayers() {
      const s = $('layBody'); if (!s) return; s.innerHTML = '';
      const groups = Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed);
      groups.forEach(g => {
        const layer = this.layers.find(l => l.id === g.id);
        const r = document.createElement('div'); r.className = 'row';
        const info = document.createElement('div');
        info.innerHTML = '<div class="k"></div><div class="d"></div>';
        info.querySelector('.k').textContent = g.name
          + (g.gate === 'passphrase' ? (g.locked ? '  🚪 locked' : '  🚪 open now') : '')
          + (layer.hidden ? (g.hidden ? '  ◇ hidden' : '  ◇ shown now') : '');
        info.querySelector('.d').textContent = g.modules.length + ' module(s) · ' + (g.audience === 'machine' ? 'machine-native · ' : '') + (g.note || '');
        const btns = document.createElement('div');
        const mk = (t, fn, ghost) => { const b = document.createElement('button'); b.className = 'btn' + (ghost ? ' ghost' : ''); b.style.marginLeft = '6px'; b.textContent = t; b.onclick = fn; return b; };
        /* hidden layers: reveal for this session, or stop hiding entirely */
        if (layer.hidden) btns.appendChild(mk(g.hidden ? 'Show now' : 'Hide again', () => {
          if (g.hidden) { if (this.revealed.indexOf(g.id) < 0) this.revealed.push(g.id); }
          else this.revealed = this.revealed.filter(x => x !== g.id);
          try { sessionStorage.setItem('axm.hub.revealed', JSON.stringify(this.revealed)); } catch (e) {}
          this.log('info', (g.hidden ? 'showing' : 'hiding') + ' layer ' + g.name);
          this.renderSidebar(); this.renderHome(); this.renderLayers();
        }, true));
        btns.appendChild(mk(layer.hidden ? 'Always show' : 'Hide from sidebar', () => {
          layer.hidden = !layer.hidden;
          if (!layer.hidden) this.revealed = this.revealed.filter(x => x !== layer.id);
          this.log('info', layer.name + (layer.hidden ? ' hidden from sidebar' : ' always shown'));
          this.saveLayers();
        }, true));
        btns.appendChild(mk('Rename', () => {
          const n = prompt('Layer name:', layer.name); if (n && n.trim()) { layer.name = n.trim(); this.saveLayers(); }
        }, true));
        btns.appendChild(mk(layer.gate === 'passphrase' ? 'Change sign' : 'Add door sign', () => {
          const p = prompt('Door sign passphrase for "' + layer.name + '".\n\nThis is NOT security — it only prevents accidental entry.\nLeave empty to remove the sign.');
          if (p === null) return;
          if (!p.trim()) { layer.gate = 'none'; delete layer.hash; this.log('info', 'removed door sign on ' + layer.name); }
          else { layer.gate = 'passphrase'; layer.hash = Core.doorHash(p.trim()); this.unlocked = this.unlocked.filter(x => x !== layer.id); this.log('info', 'set door sign on ' + layer.name); }
          try { sessionStorage.setItem('axm.hub.unlocked', JSON.stringify(this.unlocked)); } catch (e) {}
          this.saveLayers();
        }, true));
        if (g.gate === 'passphrase' && !g.locked) btns.appendChild(mk('Lock now', () => { this.lock(g.id); this.renderLayers(); }, true));
        if (this.layers.length > 1) btns.appendChild(mk('Delete', () => {
          if (!confirm('Delete layer "' + layer.name + '"?\n\nIts modules are NOT deleted — they move to "' + this.layers[0].name + '".')) return;
          const fallback = this.layers.find(l => l.id !== layer.id).id;
          Object.keys(this.assign).forEach(k => { if (this.assign[k] === layer.id) this.assign[k] = fallback; });
          this.visible.forEach(m => { if (Core.layerOf(m, this.layers, this.assign) === layer.id) this.assign[m.id] = fallback; });
          this.layers = this.layers.filter(l => l.id !== layer.id);
          this.log('info', 'deleted layer ' + layer.name + ' (modules moved, not lost)');
          this.saveLayers();
        }, true));
        r.appendChild(info); r.appendChild(btns); s.appendChild(r);
      });

      const presetRow = document.createElement('div'); presetRow.className = 'row';
      const presetInfo = document.createElement('div'); presetInfo.innerHTML = '<div class="k">Recommended simple layout</div><div class="d">Organises the sidebar without merging modules or changing permissions.</div>';
      const presetBtn = document.createElement('button'); presetBtn.className = 'btn'; presetBtn.textContent = 'Apply Create / Build / Publish / Play / AI Team'; presetBtn.onclick = () => this.applyWorkflowLayout();
      presetRow.appendChild(presetInfo); presetRow.appendChild(presetBtn); s.appendChild(presetRow);

      const addRow = document.createElement('div'); addRow.className = 'row';
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = '＋ New layer';
      b.onclick = () => {
        const n = prompt('Name the new layer (e.g. Entertainment, Creative):'); if (!n || !n.trim()) return;
        const id = n.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Math.random().toString(16).slice(2, 6);
        this.layers.push({ id, name: n.trim(), gate: 'none', order: this.layers.length, note: '' });
        this.log('ok', 'created layer ' + n.trim()); this.saveLayers();
      };
      addRow.appendChild(document.createTextNode('')); addRow.appendChild(b); s.appendChild(addRow);

      /* module → layer assignment */
      const cap = document.createElement('div'); cap.className = 'row';
      cap.innerHTML = '<div><div class="k">Assign modules</div><div class="d">A module\'s layer is where it appears. It never changes what the module is allowed to do.</div></div><div></div>';
      s.appendChild(cap);
      this.visible.forEach(m => {
        const r = document.createElement('div'); r.className = 'row';
        const info = document.createElement('div'); info.innerHTML = '<div class="k"></div>';
        info.querySelector('.k').textContent = m.name;
        const sel = document.createElement('select');
        this.layers.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; sel.appendChild(o); });
        sel.value = Core.layerOf(m, this.layers, this.assign);
        sel.onchange = () => { this.assign[m.id] = sel.value; this.log('info', m.name + ' → layer ' + sel.value); this.saveLayers(); };
        r.appendChild(info); r.appendChild(sel); s.appendChild(r);
      });
    },
    async applySkinAssets(assets) {
      if (!window.AXMSkinRenderer) {
        if (assets && Object.keys(assets).length) this.log('warn', 'skin assets declared but the renderer is unavailable');
        return;
      }
      const r = await window.AXMSkinRenderer.apply(assets || {}, {
        root: document.documentElement,
        body: document.body,
        fetch: window.fetch.bind(window),
        Image: window.Image
      });
      if (r.error) { this.log('warn', 'skin assets not applied — ' + r.error); return; }
      if (r.refused.length) this.log('error', r.refused.length + ' skin asset reference(s) refused');
      if (r.missing.length) this.log('warn', r.missing.length + ' skin asset(s) missing — colours/layout kept');
      if (r.applied.length) this.log('ok', r.applied.length + ' local skin asset(s) rendered');
    },
    boot() {
      const bootNavigationSequence = this.frameLoadSequence;
      this.initNavigation();
      let savedMode = 'simple'; try { savedMode = localStorage.getItem('axm.hub.view-mode') || 'simple'; } catch (e) {}
      this.setMode(savedMode, true);
      let savedSidebar = false;
      try { savedSidebar = localStorage.getItem('axm.hub.sidebar-collapsed') === 'true'; } catch (e) {}
      /* The desktop rail is useful context. On a phone it is an overlay, so
         begin with the work surface visible and let the existing edge control
         open navigation explicitly. This also repairs older saved "open"
         state that could cover the entire narrow interface at boot. */
      const narrowSidebar = !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
      this.setSidebarCollapsed(narrowSidebar || savedSidebar, true, !narrowSidebar);
      /* ---- skin: freedom in safety ----
         A saved skin is re-checked EVERY boot, never trusted because it was
         accepted once. ?safe=1 ignores skins entirely, so a bad skin can
         never lock you out. Reset lives in the Skinner and in this URL. */
      try {
        const safe = /[?&]safe=1/.test(location.search);
        let localSaved = null;
        try { localSaved = JSON.parse(localStorage.getItem('axm.skinner.state.v2') || 'null'); } catch (_) {}
        const saved = Core.selectSkinState(store.getModuleState('skinner'), store.getModuleState('studio'), localSaved);
        const sk = saved && saved.skin;
        if (safe) { this.log('warn', 'safe mode — skins ignored, default shell'); }
        else if (sk && window.AXMSkin) {
          const probe = id => { const el = document.getElementById(id);
            return el ? { present:true, visible: !!el.offsetParent || id==='modList', w: el.offsetWidth, h: el.offsetHeight } : { present:false }; };
          const a = window.AXMSkin.accept(sk, null);   /* colour/surface gate before paint */
          if (!a.ok) this.log('error', 'saved skin REFUSED at ' + a.stage + ' — default kept: ' + a.errors[0]);
          else {
            const m = window.AXMSkin.resolve(sk);
            Object.keys(m.tokens).forEach(k => document.documentElement.style.setProperty(k, /^--radius/.test(k) ? m.tokens[k] + 'px' : m.tokens[k]));
            document.body.dataset.nav = m.slots.nav; document.body.dataset.density = m.slots.density;
            /* Aetherglass is mounted only from the accepted, allowlisted skin
               config. Its bridge owns every node/style and can tear down without
               touching shell classes or later platform changes. */
            if (window.AXMSkinAetherglass) {
              const visual = window.AXMSkinAetherglass.apply(sk, { root:document.body, applyToDocument:true });
              if (!visual.ok) this.log('warn', 'Aetherglass skin layer not applied — ' + visual.reason);
              else if (visual.enabled) this.log('ok', 'Aetherglass v' + visual.version + ' mounted · ' + m.visuals.lightPreset);
            }
            /* Asset refs were previously validated but never painted. Resolve
               them through the local vault index; missing files are logged and
               never block the readable token/layout skin. */
            this.applySkinAssets(m.assets);
            /* after paint: the elements must still be there and visible */
            setTimeout(() => {
              const e = window.AXMSkin.checkElements(probe);
              if (!e.ok) {
                if (window.AXMSkinAetherglass) window.AXMSkinAetherglass.destroy(document.body);
                Object.keys(m.tokens).forEach(k => document.documentElement.style.removeProperty(k));
                this.log('error', 'skin hid ' + e.failures.map(f => '#' + f.id).join(', ') + ' — reverted to default');
              } else this.log('ok', 'skin applied: ' + (sk.name || 'unnamed') + ' (' + window.AXMSkin.diff(sk).length + ' changes)');
            }, 0);
          }
        }
      } catch (e) { this.log('warn', 'skin check failed, default kept'); }

      window.addEventListener('message', e => this.onMessage(e));
      $('workshopBack').onclick = () => this.goBack();
      $('homeBtn').onclick = () => this.showHome();
      $('commandCenterNav').onclick = () => this.open('workshop-command-center');
      $('growthNavBtn').onclick = () => {
        if (window.AXMWorkshopGrowth) window.AXMWorkshopGrowth.open();
      };
      $('sidebarToggle').onclick = () => this.toggleSidebar();
      $('sidebarTopToggle').onclick = () => this.toggleSidebar();
      $('modeToggle').onclick = () => this.toggleMode();
      $('viewModeQuick').onclick = () => this.toggleMode();
      $('presentationModeQuick').onchange = event => this.setActivePresentationMode(event.target.value);
      $('presentationEditQuick').onclick = () => this.openScreenEditor();
      $('humanGuideQuick').onclick = () => this.openHumanGuide(this.active);
      this.loadHumanUsabilityCatalog();
      const systemSource = $('systemStatus');
      if (systemSource && window.MutationObserver) {
        new MutationObserver(() => this.renderSystemDeck()).observe(systemSource, { childList:true, characterData:true, subtree:true, attributes:true });
      }
      $('btnSettings').onclick = () => this.openSettings();
      $('btnPerm').onclick = () => this.openPerm();
      $('btnExport').onclick = () => this.openExport();
      $('btnModules').onclick = () => this.openModules();
      $('btnLayers').onclick = () => this.openLayers();
      $('capabilityForm').onsubmit = e => { e.preventDefault(); this.renderCapabilityGuide(); };
      $('handoffForm').onsubmit = e => { e.preventDefault(); this.findHandoffDestinations(); };
      const lifecycleMenu = $('lifecycleMenu');
      if (lifecycleMenu) {
        [...lifecycleMenu.querySelectorAll('[data-lifecycle]')].forEach(button => button.onclick = () => this.setQuickLifecycle(lifecycleMenu.dataset.moduleId, button.dataset.lifecycle));
        document.addEventListener('pointerdown', event => { if (!lifecycleMenu.hidden && !lifecycleMenu.contains(event.target)) this.closeLifecycleMenu(); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') this.closeLifecycleMenu(); });
        window.addEventListener('resize', () => this.closeLifecycleMenu());
        document.addEventListener('scroll', () => this.closeLifecycleMenu(), true);
      }
      document.querySelectorAll('[data-capability-query]').forEach(b => b.onclick = () => this.renderCapabilityGuide(b.dataset.capabilityQuery));
      [...document.querySelectorAll('[data-close]')].forEach(b => b.onclick = () => $(b.dataset.close).classList.remove('show'));
      this.loadRegistry().then(() => {
        const last = store.getState().lastModuleId;
        const openable = last && Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed)
          .filter(g => !g.locked).some(g => g.modules.some(m => m.id === last));
        this.loadContinuity();
        this.loadHandoffBroker();
        if (Core.shouldRestoreBootDestination(bootNavigationSequence, this.frameLoadSequence)) {
          if (openable) { this.log('info', 'reopened at last module: ' + last); this.open(last); }
          else { if (last) this.log('info', 'last module sits in a locked layer — starting at Home'); this.showHome(); }
        } else {
          this.log('info', 'kept the screen chosen during startup');
          this.refreshBackButton();
        }
        this.log('ok', 'hub ready — ' + this.visible.length + ' dashboards visible · ' + Math.max(0, this.registry.length - this.visible.length) + ' hidden');
      });
    }
  };

  /* ---- small view helpers ---- */
  function rowEl(k, v, d) {
    const r = document.createElement('div'); r.className = 'row';
    r.innerHTML = '<div><div class="k"></div><div class="d"></div></div><div></div>';
    r.querySelector('.k').textContent = k; r.querySelector('.d').textContent = d || '';
    r.children[1].textContent = v; return r;
  }
  function settingRow(id, key, def, cur, hub) {
    const r = document.createElement('div'); r.className = 'row';
    const wrap = document.createElement('div');
    const lbl = document.createElement('div'); lbl.className = 'k'; lbl.textContent = def.label || key; wrap.appendChild(lbl);
    r.appendChild(wrap);
    let input;
    if (def.type === 'select') {
      input = document.createElement('select');
      (def.options || []).forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; input.appendChild(op); });
    } else { input = document.createElement('input'); input.type = 'text'; }
    input.value = (cur != null ? cur : (def.default != null ? def.default : ''));
    input.onchange = () => {
      const s = hub.store.getSettings(id); s[key] = input.value; hub.store.setSettings(id, s);
      hub.log('info', id + ' setting "' + key + '" = ' + input.value);
      const f = document.getElementById('viewFrame');
      if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'hub:settings:value', settings: hub.store.getSettings(id) }, '*');
    };
    r.appendChild(input); return r;
  }
  function choiceRow(label, description, options, current, onChange, disabled) {
    const r = document.createElement('div'); r.className = 'row presentation-setting-row';
    const wrap = document.createElement('div');
    const title = document.createElement('div'); title.className = 'k'; title.textContent = label;
    const note = document.createElement('div'); note.className = 'd'; note.textContent = description;
    wrap.appendChild(title); wrap.appendChild(note); r.appendChild(wrap);
    const select = document.createElement('select'); select.disabled = !!disabled;
    options.forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value.charAt(0).toUpperCase() + value.slice(1); select.appendChild(option); });
    select.value = current; select.onchange = () => onChange(select.value); r.appendChild(select);
    return r;
  }
  function actionRow(label, description, actions) {
    const r = document.createElement('div'); r.className = 'row presentation-setting-row presentation-action-row';
    const wrap = document.createElement('div');
    const title = document.createElement('div'); title.className = 'k'; title.textContent = label;
    const note = document.createElement('div'); note.className = 'd'; note.textContent = description;
    wrap.appendChild(title); wrap.appendChild(note); r.appendChild(wrap);
    const controls = document.createElement('div'); controls.className = 'presentation-actions';
    (actions || []).forEach(item => { const button = document.createElement('button'); button.type = 'button'; button.textContent = item.label; button.onclick = item.action; controls.appendChild(button); });
    r.appendChild(controls); return r;
  }
  function shortLife(l) { return ({ 'NEEDS VERIFY': 'TEST', 'SAVED CHECKPOINT': 'SAVED', 'CANON CANDIDATE': 'CANON', 'TEST-HOLD': 'HOLD' }[l]) || l; }
  function workflowIcon(id) {
    const g = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
    if (id === 'create') return g + '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M13 8l3 3"/></svg>';
    if (id === 'build') return g + '<path d="M14 5l5 5-9 9H5v-5z"/><path d="M13 6l2-2 5 5-2 2"/></svg>';
    if (id === 'publish') return g + '<path d="M12 3v11M8 10l4 4 4-4"/><rect x="4" y="17" width="16" height="4" rx="1"/></svg>';
    if (id === 'play') return g + '<rect x="2" y="7" width="20" height="10" rx="4"/><path d="M7 12h4M9 10v4"/><circle cx="16" cy="11" r="1"/><circle cx="18" cy="14" r="1"/></svg>';
    return g + '<circle cx="8" cy="12" r="4"/><circle cx="17" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M12 11l2-2M12 13l2 2"/></svg>';
  }
  function iconFor(m) {
    const id = m.id || '', t = (m.tags || []).join(' ');
    const g = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">';
    if (/game-forge|game-hub/.test(id)||/game|lobby/.test(t)) return g + '<rect x="2" y="7" width="20" height="10" rx="3"/><path d="M6 12h5M8.5 9.5v5"/><circle cx="17" cy="11" r="1"/><circle cx="19" cy="14" r="1"/></svg>';
    if (/audio-studio/.test(id)||/audio|music|midi|sound/.test(t)) return g + '<path d="M4 15V9M8 18V6M12 20V4M16 17V7M20 14v-4"/></svg>';
    if (/film-motion-studio/.test(id)||/film|video|animation|vfx/.test(t)) return g + '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2zM7 10h6M7 14h4"/></svg>';
    if (/spatial-studio/.test(id)||/spatial|3d|modeling|voxel/.test(t)) return g + '<path d="M12 2l8 5-8 5-8-5zM4 7v10l8 5 8-5V7M12 12v10"/></svg>';
    if (/learning-lab|mirror-learning-shell/.test(id)||/learning|lesson|assessment|school|curriculum/.test(t)) return g + '<path d="M4 5.5C6.8 4.2 9.5 4.4 12 6v13c-2.5-1.6-5.2-1.8-8-.5zM20 5.5c-2.8-1.3-5.5-1.1-8 .5v13c2.5-1.6 5.2-1.8 8-.5z"/><path d="M12 6v13"/></svg>';
    if (/studio|skinner|ui-ux-builder/.test(id)||/canvas|graphic|creative|design/.test(t)) return g + '<path d="M4 20l4-1 9-9-3-3-9 9z"/><path d="M14 7l3 3"/></svg>';
    if (/marketplace-deployment/.test(id)) return g + '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/><path d="M17 7l3-3M17 4h3v3"/></svg>';
    if (/publish-library/.test(id)) return g + '<path d="M12 3v11M8 10l4 4 4-4"/><rect x="4" y="17" width="16" height="4" rx="1"/></svg>';
    if (/asset/.test(id)) return g + '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>';
    if (/workshop-command-center/.test(id)) return g + '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>';
    if (/ai-team|agent-command|chatgpt-connector|duo-test|model-lab|reasoning-shell/.test(id)) return g + '<circle cx="8" cy="12" r="4"/><circle cx="17" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M12 11l2-2M12 13l2 2"/></svg>';
    if (/forge|sandbox|graft/.test(id)) return g + '<path d="M5 19l5-5M14 4l6 6-9 9H5v-6z"/></svg>';
    if (/verifier|runner|evidence/.test(id)) return g + '<path d="M12 3l8 3v6c0 5-3 8-8 9-5-1-8-4-8-9V6z"/><path d="M8 12l3 3 5-6"/></svg>';
    if (/hermes|route/.test(id)||/bridge|connect/.test(t)) return g + '<path d="M8 8a4 4 0 010 8M16 8a4 4 0 000 8M8 12h8"/></svg>';
    if (/launcher-card/.test(id)) return g + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/></svg>';
    if (/main-hub|hub-test/.test(id)) return g + '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
    if (/prehub|prompt/.test(id)||/log|memory|prompt/.test(t)) return g + '<path d="M6 3h9l3 3v15H6z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>';
    return g + '<rect x="4" y="4" width="16" height="16" rx="3"/></svg>';
  }
})();
