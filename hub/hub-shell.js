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
      setActiveLayer(id) { backend.set(NS + 'activeLayer', id); }
    };
  }

  /* ---- Registry: normalize whatever /api/tools returns ---- */
  function normalizeRegistry(apiTools) {
    return (apiTools || []).map(t => ({
      id: t.id, name: t.name || t.id, folder: t.folder || t.id,
      entry: t.entry || 'index.html', version: t.version || '?',
      status: t.status || 'TEST', tags: t.tags || [], uses: t.uses || [],
      audience: t.audience || 'human', layer: t.layer || null
    }));
  }

  /* pure log-entry factory (timestamp injected by caller for testability) */
  function logEntry(level, msg, ts) { return { t: ts, level: level, msg: msg }; }

  /* pure: given everything discovered + the user's added set, produce the
     catalog (each module flagged enabled) and the active/visible list.
     Stale enabled ids (folder removed) are dropped, not errored. */
  function resolveModules(available, enabledList) {
    const avail = available || [];
    const enabled = (enabledList || []).filter(id => avail.some(m => m.id === id));
    return {
      enabled,
      visible: avail.filter(m => enabled.indexOf(m.id) >= 0),
      catalog: avail.map(m => Object.assign({}, m, { enabled: enabled.indexOf(m.id) >= 0 }))
    };
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

  return { NS, memoryBackend, localStorageBackend, makeStore, normalizeRegistry, logEntry, resolveModules,
           DEFAULT_LAYERS, doorHash, layerOf, resolveLayers, checkDoor };
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
    registry: [], visible: [], enabled: [], active: null, records: {}, store,
    layers: [], assign: {}, unlocked: [], revealed: [],   /* unlocked+revealed = this session only */
    /* lifecycle badge classes for the sidebar */
    lifeClass(l) {
      return ({ 'CLAIMED': 'CLAIMED', 'NEEDS VERIFY': 'TEST', 'WORKING': 'WORKING',
        'SAVED CHECKPOINT': 'SAVED', 'TEST-HOLD': 'HOLD', 'CANON CANDIDATE': 'CANON' }[l]) || 'CLAIMED';
    },
    log(level, msg) {
      const e = Core.logEntry(level, msg, now());
      store.appendLog(e);
      const tail = $('logTail'); if (tail) tail.textContent = hhmm() + '  ' + msg;
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
      /* seed the three starting layers once; after that the user owns them */
      let ly = store.getLayers();
      if (ly === null) { ly = JSON.parse(JSON.stringify(Core.DEFAULT_LAYERS)); store.setLayers(ly); }
      this.layers = ly; this.assign = store.getAssign();
      /* unlocks are session-only: closing the hub re-locks the door */
      try { this.unlocked = JSON.parse(sessionStorage.getItem('axm.hub.unlocked') || '[]'); } catch (e) { this.unlocked = []; }
      try { this.revealed = JSON.parse(sessionStorage.getItem('axm.hub.revealed') || '[]'); } catch (e) { this.revealed = []; }
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
      this.log('ok', 'added module: ' + (m ? m.name : id) + ' — now part of the system');
      this.resolve(); this.renderModules();
    },
    disable(id) {
      this.enabled = this.enabled.filter(x => x !== id); store.setEnabled(this.enabled);
      const m = this.registry.find(x => x.id === id);
      this.log('info', 'removed module: ' + (m ? m.name : id) + ' (its saved data is kept)');
      if (this.active === id) this.showHome();
      this.resolve(); this.renderModules();
    },
    renderSidebar() {
      const nav = $('modList'); nav.innerHTML = '';
      const groups = Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed);
      let hiddenMods = 0, hiddenLayers = 0;
      groups.forEach(g => {
        /* hidden (machine-native) layers stay out of the human's way */
        if (g.hidden) { hiddenMods += g.modules.length; hiddenLayers++; return; }
        if (!g.modules.length && g.gate !== 'passphrase') return;   /* hide empty open layers */
        const cap = document.createElement('div'); cap.className = 'side-cap';
        cap.textContent = g.name + (g.locked ? '  ·  locked' : '');
        nav.appendChild(cap);
        if (g.locked) {
          const d = document.createElement('button'); d.className = 'mod';
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
        g.modules.forEach(m => {
          const life = store.getLifecycle(m.id);
          const b = document.createElement('button'); b.className = 'mod'; b.dataset.id = m.id;
          b.innerHTML = '<span class="ic">' + iconFor(m) + '</span><span class="nm"></span>'
            + '<span class="life ' + this.lifeClass(life) + '"></span>';
          b.querySelector('.nm').textContent = m.name;
          b.querySelector('.life').textContent = shortLife(life);
          b.onclick = () => this.open(m.id);
          nav.appendChild(b);
        });
      });
      /* hidden ≠ secret: always say what's tucked away, one click to reveal */
      if (hiddenLayers) {
        const f = document.createElement('button'); f.className = 'mod';
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
      const shown = [];
      groups.forEach(gr => { if (!gr.locked && !gr.hidden) gr.modules.forEach(m => shown.push(m)); });
      shown.forEach(m => {
        const c = document.createElement('div'); c.className = 'hcard';
        c.innerHTML = '<h3></h3><p></p><div class="open">Open →</div>';
        c.querySelector('h3').textContent = m.name;
        c.querySelector('p').textContent = (m.tags || []).join(' · ') || m.status;
        c.onclick = () => this.open(m.id);
        g.appendChild(c);
      });
      /* always-present: add/remove modules — you never carry what you don't want */
      const add = document.createElement('div'); add.className = 'hcard';
      add.style.borderStyle = 'dashed';
      const avail = this.registry.length, on = this.visible.length;
      add.innerHTML = '<h3>＋ Modules</h3><p>' + on + ' of ' + avail + ' added. Add or remove modules — removing keeps their saved data.</p><div class="open">Manage →</div>';
      add.onclick = () => this.openModules();
      g.appendChild(add);
      const lay = document.createElement('div'); lay.className = 'hcard';
      lay.style.borderStyle = 'dashed';
      const lockedCount = groups.filter(x => x.locked).length;
      lay.innerHTML = '<h3>▤ Layers</h3><p>' + groups.length + ' layers' + (lockedCount ? ' · ' + lockedCount + ' locked' : '') + '. Group modules into spaces. Door signs, not locks.</p><div class="open">Manage →</div>';
      lay.onclick = () => this.openLayers();
      g.appendChild(lay);
    },
    showHome() {
      this.active = null;
      $('viewFrame').style.display = 'none';
      $('homeScreen').style.display = 'block';
      $('activeName').textContent = 'Home';
      [...document.querySelectorAll('.mod')].forEach(x => x.classList.remove('active'));
      $('homeBtn').classList.add('active');
      store.setState({ lastModuleId: null });
    },
    open(id) {
      const m = this.registry.find(x => x.id === id);
      if (!m) { this.log('error', 'no such module: ' + id); return; }
      /* a module in a locked layer knocks first. NOTE: this is a door sign,
         not a permission boundary — it changes nothing about what the module
         may do once open. Permissions come only from its passport. */
      const lid = Core.layerOf(m, this.layers, this.assign);
      const grp = Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed).find(g => g.id === lid);
      if (grp && grp.locked) { this.knock(lid); if (this.unlocked.indexOf(lid) < 0) return; }
      this.active = id;
      $('homeScreen').style.display = 'none';
      const err = $('vpError'); err.classList.remove('show');
      const load = $('vpLoading'); load.classList.add('show');
      const f = $('viewFrame'); f.style.display = 'block';
      /* blank-screen guard: if the frame hasn't reported ready or painted, show recovery */
      let painted = false;
      const url = '/tools/' + encodeURIComponent(m.folder) + '/' + m.entry;
      f.onload = () => {
        load.classList.remove('show');
        try { painted = !!(f.contentDocument && f.contentDocument.body && f.contentDocument.body.childNodes.length); }
        catch (e) { painted = true; /* cross-doc but loaded = not blank */ }
        if (!painted) this.showError(m, 'Module loaded but its screen is empty.');
      };
      f.onerror = () => { load.classList.remove('show'); this.showError(m, 'Module failed to load.'); };
      setTimeout(() => { if (load.classList.contains('show')) { load.classList.remove('show'); this.showError(m, 'Module timed out.'); } }, 8000);
      f.src = url;
      $('activeName').textContent = m.name;
      [...document.querySelectorAll('.mod')].forEach(x => x.classList.toggle('active', x.dataset.id === id));
      $('homeBtn').classList.remove('active');
      /* record + persist which module is open, and bump CLAIMED->NEEDS VERIFY */
      if (!this.records[id]) this.records[id] = { id, lifecycle: store.getLifecycle(id) };
      store.setState({ lastModuleId: id });
      this.log('info', 'switched to ' + m.name);
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
      const id = this.active; if (!id) return;
      const cur = this.records[id] || { id, lifecycle: store.getLifecycle(id) };
      cur.id = id;
      const { record, intents } = C.reduce(cur, msg);
      this.records[id] = record;
      store.setLifecycle(id, record.lifecycle);
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
    openSettings() {
      const s = $('setBody'); s.innerHTML = '';
      const gs = store.getState();
      s.appendChild(rowEl('Last module on reopen', gs.lastModuleId || '(home)', ''));
      const id = this.active;
      if (id) {
        const rec = this.records[id] || {};
        const sc = rec.passport && rec.passport.settingsSchema;
        s.appendChild(rowEl('Active module', id, 'lifecycle: ' + store.getLifecycle(id)));
        if (sc) Object.keys(sc).forEach(k => {
          const cur = store.getSettings(id)[k]; s.appendChild(settingRow(id, k, sc[k], cur, this));
        });
        else s.appendChild(rowEl('Module settings', 'none declared', 'this module exposes no settings schema'));
      }
      $('setScreen').classList.add('show');
    },
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
    /* ---- module catalog: add/remove modules (the opt-in layer) ---- */
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
        info.querySelector('.d').textContent = (m.tags || []).join(' · ') + '  ·  ' + m.version;
        const btn = document.createElement('button');
        btn.className = 'btn' + (m.enabled ? ' ghost' : '');
        btn.textContent = m.enabled ? 'Remove' : 'Add';
        btn.onclick = () => m.enabled ? this.disable(m.id) : this.enable(m.id);
        r.appendChild(info); r.appendChild(btn); s.appendChild(r);
      });
    },
    /* ---- layers manager ---- */
    openLayers() { this.renderLayers(); $('layScreen').classList.add('show'); },
    saveLayers() { store.setLayers(this.layers); store.setAssign(this.assign); this.resolve(); this.renderLayers(); },
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
    boot() {
      /* ---- skin: freedom in safety ----
         A saved skin is re-checked EVERY boot, never trusted because it was
         accepted once. ?safe=1 ignores skins entirely, so a bad skin can
         never lock you out. Reset lives in the Skinner and in this URL. */
      try {
        const safe = /[?&]safe=1/.test(location.search);
        const saved = store.getModuleState('skinner');
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
            /* after paint: the elements must still be there and visible */
            setTimeout(() => {
              const e = window.AXMSkin.checkElements(probe);
              if (!e.ok) {
                Object.keys(m.tokens).forEach(k => document.documentElement.style.removeProperty(k));
                this.log('error', 'skin hid ' + e.failures.map(f => '#' + f.id).join(', ') + ' — reverted to default');
              } else this.log('ok', 'skin applied: ' + (sk.name || 'unnamed') + ' (' + window.AXMSkin.diff(sk).length + ' changes)');
            }, 0);
          }
        }
      } catch (e) { this.log('warn', 'skin check failed, default kept'); }

      window.addEventListener('message', e => this.onMessage(e));
      $('homeBtn').onclick = () => this.showHome();
      $('btnSettings').onclick = () => this.openSettings();
      $('btnPerm').onclick = () => this.openPerm();
      $('btnExport').onclick = () => this.openExport();
      $('btnModules').onclick = () => this.openModules();
      $('btnLayers').onclick = () => this.openLayers();
      [...document.querySelectorAll('[data-close]')].forEach(b => b.onclick = () => $(b.dataset.close).classList.remove('show'));
      this.loadRegistry().then(() => {
        const last = store.getState().lastModuleId;
        const openable = last && Core.resolveLayers(this.visible, this.layers, this.assign, this.unlocked, this.revealed)
          .filter(g => !g.locked).some(g => g.modules.some(m => m.id === last));
        if (openable) { this.log('info', 'reopened at last module: ' + last); this.open(last); }
        else { if (last) this.log('info', 'last module sits in a locked layer — starting at Home'); this.showHome(); }
        this.log('ok', 'hub ready — ' + this.visible.length + ' of ' + this.registry.length + ' modules added');
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
  function shortLife(l) { return ({ 'NEEDS VERIFY': 'TEST', 'SAVED CHECKPOINT': 'SAVED', 'CANON CANDIDATE': 'CANON', 'TEST-HOLD': 'HOLD' }[l]) || l; }
  function iconFor(m) {
    const t = (m.tags || []).join(' ');
    const g = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">';
    if (/game|lobby/.test(t)) return g + '<rect x="2" y="7" width="20" height="10" rx="3"/><line x1="7" y1="12" x2="9" y2="12"/><circle cx="16" cy="11" r="1"/></svg>';
    if (/canvas|graphic|creative/.test(t)) return g + '<path d="M4 20l4-1 9-9-3-3-9 9z"/></svg>';
    if (/bridge|connect/.test(t)) return g + '<path d="M8 8a4 4 0 010 8M16 8a4 4 0 000 8M8 12h8"/></svg>';
    if (/template/.test(t)) return g + '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
    if (/log|memory|prompt/.test(t)) return g + '<path d="M6 3h9l3 3v15H6z"/><line x1="9" y1="9" x2="15" y2="9"/></svg>';
    return g + '<rect x="4" y="4" width="16" height="16" rx="3"/></svg>';
  }
})();
