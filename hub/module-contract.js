/* ============================================================
   AXM Hub — ModuleContract  (module-contract.js)
   The passport every module carries + the pure reducer that turns
   a module's postMessage events into hub state. Written UMD-style so
   the SAME validation/reducer runs in the browser shell AND in
   hub-selftest.js under Node (no-fake-done: the logic is testable).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMContract = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Hub lifecycle labels — DISTINCT from a manifest's build `status`
     (TEST/WORKING/CANON/SHELL/BROKEN, which the verifier owns).
     These describe how far a module has been proven inside the hub. */
  const LIFECYCLE = ['CLAIMED', 'NEEDS VERIFY', 'WORKING', 'SAVED CHECKPOINT', 'TEST-HOLD', 'CANON CANDIDATE'];

  /* The module passport. Fields marked required must be present for a
     module to be trusted with anything beyond "render in a frame".
     A legacy tool with only a manifest still loads — it just gets a
     minimal passport derived from that manifest and no extra grants. */
  const PASSPORT_REQUIRED = ['id', 'name', 'version', 'hubApiVersion'];
  const PASSPORT_OPTIONAL = ['icon', 'permissions', 'settingsSchema', 'savesState', 'handlesShutdown', 'notes'];
  const HUB_API_VERSION = '1.0';

  function validatePassport(p) {
    const errors = [];
    if (!p || typeof p !== 'object') return { ok: false, errors: ['passport is not an object'] };
    PASSPORT_REQUIRED.forEach(f => { if (!(f in p)) errors.push('missing required field: ' + f); });
    if (p.permissions && !Array.isArray(p.permissions)) errors.push('permissions must be an array');
    if (p.hubApiVersion && p.hubApiVersion.split('.')[0] !== HUB_API_VERSION.split('.')[0])
      errors.push('hubApiVersion major mismatch: module ' + p.hubApiVersion + ' vs hub ' + HUB_API_VERSION);
    if (p.settingsSchema && typeof p.settingsSchema !== 'object') errors.push('settingsSchema must be an object');
    return { ok: errors.length === 0, errors };
  }

  /* Derive a minimal, honest passport for a legacy tool that never
     calls hub:ready. Nothing is invented — permissions stay empty. */
  function passportFromManifest(m) {
    return {
      id: m.id, name: m.name, version: m.version || '?',
      hubApiVersion: HUB_API_VERSION, icon: null,
      permissions: [], settingsSchema: null,
      savesState: false, handlesShutdown: false,
      legacy: true, notes: 'legacy tool — manifest-derived passport (no hub bridge)'
    };
  }

  /* PURE REDUCER. Given current per-module hub record + an incoming
     bridge message, return the next record + any side-effect intents
     (log lines, permission decisions). No DOM, no globals — so the
     self-test can drive it deterministically. */
  function reduce(record, msg) {
    const rec = Object.assign({
      id: null, passport: null, lifecycle: 'CLAIMED',
      grantedPermissions: [], settings: {}, lastError: null, savedOnce: false
    }, record || {});
    const intents = [];
    switch (msg && msg.type) {
      case 'hub:ready': {
        const v = validatePassport(msg.passport);
        rec.passport = msg.passport;
        if (!v.ok) { rec.lastError = 'passport invalid: ' + v.errors.join('; '); rec.lifecycle = 'TEST-HOLD';
          intents.push({ kind: 'log', level: 'error', msg: rec.id + ' bad passport: ' + v.errors.join('; ') }); }
        else { rec.lifecycle = rec.lifecycle === 'CLAIMED' ? 'NEEDS VERIFY' : rec.lifecycle;
          intents.push({ kind: 'log', level: 'ok', msg: rec.id + ' opened (' + msg.passport.name + ')' }); }
        break;
      }
      case 'hub:log':
        intents.push({ kind: 'log', level: msg.level || 'info', msg: rec.id + ': ' + msg.msg });
        break;
      case 'hub:permission:request': {
        const p = msg.perm;
        const declared = rec.passport && Array.isArray(rec.passport.permissions) && rec.passport.permissions.indexOf(p) >= 0;
        if (declared && rec.grantedPermissions.indexOf(p) < 0) rec.grantedPermissions.push(p);
        intents.push({ kind: 'permission', perm: p, granted: declared, id: rec.id });
        intents.push({ kind: 'log', level: declared ? 'ok' : 'warn',
          msg: rec.id + (declared ? ' granted ' : ' DENIED (undeclared) ') + p });
        break;
      }
      case 'hub:settings:set':
        rec.settings = Object.assign({}, rec.settings, msg.patch || {});
        intents.push({ kind: 'persist-settings', id: rec.id, settings: rec.settings });
        intents.push({ kind: 'log', level: 'info', msg: rec.id + ' settings updated' });
        break;
      case 'hub:save':
        rec.savedOnce = true;
        if (rec.lifecycle === 'WORKING') rec.lifecycle = 'SAVED CHECKPOINT';
        intents.push({ kind: 'persist-state', id: rec.id, state: msg.state });
        intents.push({ kind: 'log', level: 'ok', msg: rec.id + ' saved checkpoint' });
        break;
      case 'hub:error':
        rec.lastError = msg.msg;
        intents.push({ kind: 'log', level: 'error', msg: rec.id + ' error: ' + msg.msg });
        break;
      case 'hub:verify:pass':
        rec.lifecycle = rec.savedOnce ? 'SAVED CHECKPOINT' : 'WORKING';
        intents.push({ kind: 'log', level: 'ok', msg: rec.id + ' verification passed → ' + rec.lifecycle });
        break;
    }
    return { record: rec, intents };
  }

  return { LIFECYCLE, HUB_API_VERSION, PASSPORT_REQUIRED, PASSPORT_OPTIONAL,
           validatePassport, passportFromManifest, reduce };
});
