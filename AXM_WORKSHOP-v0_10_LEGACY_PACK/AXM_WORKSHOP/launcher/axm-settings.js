/* ============================================================
   AXM GLOBAL SETTINGS  —  axm-settings.js   (v0.1 · v0.8 TEST)
   ------------------------------------------------------------
   GLOBAL settings = foundation/user DEFAULTS, one per person.
   TOOL settings = each tool's own business (may override locally;
   the global stays visible). This is NOT an account system.

   Storage: the spine slot 'axm-settings' — reserved in
   TEMPLATE_SEAMS.txt back when it cost one paragraph; used now.
   Exportable by design ({format:1,...} = suitcase-ready).
   Changes are GATED ('settings.set', key logged, value not).

   HONESTY: some settings are DEFAULTS FOR TOOLS TO READ, not
   wires that already pull. Each carries wired:true/false and the
   UI shows it — a saved-but-not-yet-wired setting is labeled so,
   never pretended. No cloud, no account, local-first.
   Status: ACCEPT FOR TEST ONLY — not canon.
   ============================================================ */
(function (global) {
  'use strict';

  var SLOT = 'axm-settings';
  var subs = [];

  /* key -> { value: safe default, wired: does anything consume it TODAY,
              label, options? } */
  var DEFAULTS = {
    'ai.defaultProvider': { value: 'none', wired: false,
      label: 'Default AI mind', options: ['none','claude','chatgpt','local'],
      note: 'tools adopt this next — stored, shown, not yet pulled' },
    'ai.bridgeMode':      { value: 'ask', wired: false,
      label: 'Bridge use', options: ['ask','use-default'],
      note: 'tools adopt this next' },
    'ai.actionMode':      { value: 'propose-only', wired: true,
      label: 'AI meaningful actions', options: ['propose-only'],
      note: 'ENFORCED by AXMRegistry: AI writes are proposal-first. No silent AI write/export/share. Only honest option exists.' },
    'connectors.defaultSink':   { value: null, wired: true,
      label: 'Default export destination',
      note: 'null = ask every time. Only an EXPLICIT save here lets the registry skip the picker.' },
    'connectors.defaultSource': { value: 'local.assets', wired: true,
      label: 'Default asset source',
      note: 'reads fall back here (registration order already does this; shown for visibility)' },
    'appearance.accent':  { value: '#38d6ec', wired: true,
      label: 'Accent color' },
    'appearance.compact': { value: false, wired: true,
      label: 'Compact mode' },
    'appearance.theme':   { value: 'axm-dark', wired: true,
      label: 'Theme', options: ['axm-dark'],
      note: 'one real theme exists; packs land via the asset system later, never hardcoded' },
    'logs.level':         { value: 'minimal', wired: true,
      label: 'Log level', options: ['minimal','debug'],
      note: 'minimal = metadata only (current behavior). debug = reserved, NOT BUILT — saving it changes nothing yet and the UI says so.' }
  };

  var values = {};   /* user overrides only; defaults stay in DEFAULTS */
  var ready = false;

  function notify() { subs.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  var api = {
    init: function () {
      return global.AXM.store.load(SLOT).then(function (rec) {
        values = (rec && rec.data && rec.data.values) || {};
        ready = true; notify();
        return { ok: true };
      }).catch(function () { ready = true; return { ok: true }; });
    },
    isReady: function () { return ready; },

    get: function (key) {
      if (key in values) return values[key];
      return DEFAULTS[key] ? DEFAULTS[key].value : undefined;
    },

    /* describe() — everything the UI needs, honesty flags included */
    describe: function () {
      return Object.keys(DEFAULTS).map(function (k) {
        var d = DEFAULTS[k];
        return { key: k, label: d.label, value: api.get(k), isDefault: !(k in values),
                 wired: d.wired, options: d.options || null, note: d.note || '' };
      });
    },

    set: function (key, value, who) {
      if (!DEFAULTS[key]) return Promise.resolve({ allow: false, reason: 'unknown setting: ' + key });
      if (DEFAULTS[key].options && DEFAULTS[key].options.indexOf(value) < 0 && value !== null) {
        return Promise.resolve({ allow: false, reason: 'not an option for ' + key });
      }
      var v = global.AXMGate.submit({ action: 'settings.set',
        actor: (who && who.actor) || 'mike', actorType: (who && who.actorType) || 'human',
        tool: 'axm-settings', detail: { key: key } });   /* key logged, value not */
      if (!v.allow) return Promise.resolve({ allow: false, reason: v.reason });
      values[key] = value;
      return global.AXM.store.save(SLOT, { format: 1, values: values })
        .then(function () { notify(); return { allow: true, key: key }; });
    },

    /* reset() — back to safe defaults; the reset itself is gated + logged */
    reset: function (who) {
      var v = global.AXMGate.submit({ action: 'settings.reset',
        actor: (who && who.actor) || 'mike', actorType: (who && who.actorType) || 'human',
        tool: 'axm-settings', detail: { hadOverrides: Object.keys(values).length } });
      if (!v.allow) return Promise.resolve({ allow: false, reason: v.reason });
      values = {};
      return global.AXM.store.save(SLOT, { format: 1, values: values })
        .then(function () { notify(); return { allow: true }; });
    },

    exportSettings: function () {
      return JSON.stringify({ axmSettings: true, format: 1, exported: Date.now(), values: values }, null, 2);
    },

    subscribe: function (fn) { subs.push(fn); },
    VERSION: '0.1'
  };

  global.AXMSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
