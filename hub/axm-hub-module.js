/* ============================================================
   AXM Hub — child bridge  (axm-hub-module.js)
   Include this ONE script in a module's index.html to become a
   first-class hub module. It is NOT the spine (axm-foundation.js);
   it only talks to the shell over postMessage. A module that omits
   it still renders in the viewport — it just gets no hub services.

     AXMHub.ready(passport)         announce yourself, receive init
     AXMHub.log(msg, level)         append to the shared action log
     AXMHub.settings.get()          -> Promise(settings object)
     AXMHub.settings.set(patch)     persist per-module settings
     AXMHub.permission.request(p)   ask for a declared permission
     AXMHub.save(state)             checkpoint module state
     AXMHub.onInit(fn)              fn({moduleId, settings, moduleState, granted})
     AXMHub.onShutdown(fn)          be asked to flush before switch/close
   ============================================================ */
(function () {
  'use strict';
  if (window.top === window.self) { /* opened standalone, not inside the hub */
    window.AXMHub = stub(); return;
  }
  const parent = window.parent;
  const initCbs = [], shutdownCbs = [], settingsResolvers = [];
  let inited = null;

  function post(m) { parent.postMessage(m, '*'); }

  window.addEventListener('message', function (ev) {
    const m = ev.data; if (!m || typeof m.type !== 'string') return;
    if (m.type === 'hub:init') { inited = m; initCbs.forEach(fn => { try { fn(m); } catch (e) {} }); }
    if (m.type === 'hub:settings:value') { const r = settingsResolvers.shift(); if (r) r(m.settings || {}); }
    if (m.type === 'hub:shutdown:request') {
      Promise.all(shutdownCbs.map(fn => { try { return fn(); } catch (e) { return null; } }))
        .then(() => post({ type: 'hub:shutdown:ok' }));
    }
  });

  const AXMHub = {
    ready(passport) { post({ type: 'hub:ready', passport: passport }); },
    log(msg, level) { post({ type: 'hub:log', msg: String(msg), level: level || 'info' }); },
    settings: {
      get() { return new Promise(res => { settingsResolvers.push(res); post({ type: 'hub:settings:get' }); }); },
      set(patch) { post({ type: 'hub:settings:set', patch: patch }); }
    },
    permission: { request(p) { post({ type: 'hub:permission:request', perm: p }); } },
    save(state) { post({ type: 'hub:save', state: state }); },
    verifyPass() { post({ type: 'hub:verify:pass' }); },
    error(msg) { post({ type: 'hub:error', msg: String(msg) }); },
    onInit(fn) { initCbs.push(fn); if (inited) fn(inited); },
    onShutdown(fn) { shutdownCbs.push(fn); },
    inHub: true
  };
  window.AXMHub = AXMHub;

  function stub() {
    const noop = () => {}; const emptyP = () => Promise.resolve({});
    return { ready: noop, log: noop, settings: { get: emptyP, set: noop },
      permission: { request: noop }, save: noop, verifyPass: noop, error: noop,
      onInit: noop, onShutdown: noop, inHub: false };
  }
})();
