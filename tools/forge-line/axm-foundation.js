/* ============================================================
   AXM FOUNDATION  —  axm-foundation.js   (bundle v1.4.1)
   ------------------------------------------------------------
   The whole pre-hub SPINE in ONE file. One <script> tag, seven pieces:
     AXMStore  AXMWisdom  AXMIdentity  AXMConnect  AXMGate  AXMFriction  AXMTool
   ...plus AXM (orchestrator):
     await AXM.init({id,name,version});   wire everything
     await AXM.ask('...');                identity-grounded, optional AI
     await AXM.status();                  one "am I in a good state?" snapshot

   AI is OPTIONAL everywhere (no AI -> clean {noAI:true}, never a crash/fake).
   Spine, not skin. Nothing here is canon but the core.

   v1.4.1 — REPAIR ONLY: v1.4 accidentally shipped every module TWICE
   (old copies first, new copies after). Rebuilt clean from the seven
   source modules. No behaviour change vs what actually ran in v1.4
   (the new copies loaded last and won). Logged in CROSS_CHECK.txt.
   ============================================================ */


/* ========== axm-storage.js ========== */
/* ============================================================
   AXM STORAGE  —  axm-storage.js   (v1.0, stable base)
   ------------------------------------------------------------
   Standalone, no dependencies, local-first, fully offline.
   Drop into any AXM tool with one <script src="axm-storage.js"></script>.

   WHAT IT IS
   Save / load / version / export / import for AXM tools. One namespaced
   store per tool, named save slots, an autosave slot for no-loss-on-refresh,
   plus file export/import for backup and transfer.

   THREE LAYERS (from the brief)
     1. SESSION  — in-memory working values, lost on close.   AXMStore.session
     2. LOCAL    — IndexedDB (falls back to localStorage), persists.  save/load
     3. FILE     — download .json / read a file back.          exportFile/importFile
                    (BROWSER ONLY — uses document/Blob; not for pure Node)

   NAMESPACE
     axm_<tool>_<version>_<slot>     e.g.  axm_studio_v1_slotA
     autosave slot key:  axm_<tool>_<version>_auto

   WHY IndexedDB
   Image, 3D and audio tools blow past localStorage's ~5MB ceiling. IndexedDB
   has effectively no practical limit and is the right local layer for the
   whole tool universe. localStorage is kept only as a fallback. The API is
   identical either way. Because IndexedDB is async, this API is async too
   (every call returns a Promise).

   GROUND RULES HONOURED
     LOCAL FIRST : no server, no cloud, no login. Works offline, always.
     SAME GATES  : save/load/list/export are identical for human and AI.
     NO LOSS     : autosave + resume() mean a refresh never loses work.
     CLEAN WISDOM HOOK : storage events are emitted; an optional bridge can
                         file them into the wisdom layer (default OFF — no noise).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---- config (set by init) ------------------------------------------- */
  var cfg = { tool: 'tool', version: 'v1', db: 'axm_store', store: 'kv' };
  var backend = null;          // chosen persistence adapter (IDB or LS)
  var listeners = [];          // onEvent subscribers
  var wisdomBridge = false;    // file storage events into AXMWisdom as actions?

  /* ---- key helpers ----------------------------------------------------- */
  function keyFor(slot) { return 'axm_' + cfg.tool + '_' + cfg.version + '_' + slot; }
  function prefix()     { return 'axm_' + cfg.tool + '_' + cfg.version + '_'; }
  function now()        { return new Date().toISOString(); }
  function sizeOf(s)    { try { return (JSON.stringify(s) || '').length; } catch (e) { return 0; } }

  /* ---- event emit ------------------------------------------------------ */
  /* Every storage action emits {type, slot, ts, ...}. Tools listen via
     onEvent() to show a status line, and the optional wisdom bridge can
     turn these into kind:'action' wisdom entries. */
  function emit(type, info) {
    var ev = Object.assign({ type: type, ts: now(), tool: cfg.tool, version: cfg.version }, info || {});
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](ev); } catch (e) { /* a bad listener never breaks storage */ }
    }
    if (wisdomBridge && global.AXMWisdom && global.AXMWisdom.isOn && global.AXMWisdom.isOn()) {
      try {
        global.AXMWisdom.file(
          { text: 'storage: ' + type + (ev.slot ? ' [' + ev.slot + ']' : ''),
            author: 'system', kind: 'action', tags: ['storage'], context: ev });
      } catch (e) { /* wisdom optional */ }
    }
    return ev;
  }

  /* ====================================================================
     PERSISTENCE BACKENDS — both expose get/set/del/keys returning Promises
     ==================================================================== */

  /* IndexedDB adapter: one shared DB, one object store, full keys inside it. */
  function idbBackend(IDB) {
    var dbp = new Promise(function (resolve, reject) {
      var req = IDB.open(cfg.db, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(cfg.store)) db.createObjectStore(cfg.store);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    function tx(mode, fn) {
      return dbp.then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(cfg.store, mode);
          var os = t.objectStore(cfg.store);
          var out = fn(os);
          t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error); };
        });
      });
    }
    return {
      kind: 'indexeddb',
      get: function (k) { return tx('readonly',  function (os) { return os.get(k); }); },
      set: function (k, v) { return tx('readwrite', function (os) { return os.put(v, k); }); },
      del: function (k) { return tx('readwrite', function (os) { return os.delete(k); }); },
      keys: function () { return tx('readonly',  function (os) { return os.getAllKeys(); }); }
    };
  }

  /* localStorage adapter: same interface, for tiny tools or no-IDB browsers.
     NOTE: ~5MB origin cap — large payloads will fail here; that is exactly
     why IndexedDB is preferred. set() rejects loudly on quota so a tool can
     tell the user instead of losing data silently. */
  function lsBackend(LS) {
    return {
      kind: 'localstorage',
      get: function (k) { return Promise.resolve().then(function () { var r = LS.getItem(k); return r == null ? undefined : JSON.parse(r); }); },
      set: function (k, v) { return Promise.resolve().then(function () {
        try { LS.setItem(k, JSON.stringify(v)); }
        catch (e) { throw new Error('localStorage full (use IndexedDB for large data)'); } }); },
      del: function (k) { return Promise.resolve().then(function () { LS.removeItem(k); }); },
      keys: function () { return Promise.resolve().then(function () {
        var out = []; for (var i = 0; i < LS.length; i++) out.push(LS.key(i)); return out; }); }
    };
  }

  function pickBackend() {
    var IDB = global.indexedDB || global.mozIndexedDB || global.webkitIndexedDB || null;
    if (IDB) { try { return idbBackend(IDB); } catch (e) { /* fall through */ } }
    if (global.localStorage) return lsBackend(global.localStorage);
    // last resort: in-memory only (no persistence) so the API still works
    var mem = {};
    return {
      kind: 'memory',
      get: function (k) { return Promise.resolve(mem[k]); },
      set: function (k, v) { return Promise.resolve(void (mem[k] = v)); },
      del: function (k) { return Promise.resolve(void (delete mem[k])); },
      keys: function () { return Promise.resolve(Object.keys(mem)); }
    };
  }

  /* ---- the record we store -------------------------------------------- */
  function makeRecord(slot, data, meta) {
    return {
      format: 'axm-save', v: 1,
      tool: cfg.tool, version: cfg.version, slot: slot,
      saved: now(),
      meta: meta || {},          // small human-readable summary (title, counts...)
      data: data                 // the tool's full project payload (any JSON)
    };
  }

  /* ====================================================================
     PUBLIC API — async, same gates for human and AI
     ==================================================================== */
  var api = {

    /* init(opts) — call once on tool load.
       opts: { tool, version, db?, wisdomBridge? }. Returns a Promise that
       resolves with backend info once persistence is ready. */
    init: function (opts) {
      opts = opts || {};
      if (opts.tool)    cfg.tool = String(opts.tool);
      if (opts.version) cfg.version = String(opts.version);
      if (opts.db)      cfg.db = String(opts.db);
      if (opts.wisdomBridge) wisdomBridge = true;
      backend = pickBackend();
      // ensure IDB is actually open (and usable) before we report ready
      return backend.keys().then(function () {
        emit('ready', { backend: backend.kind });
        return { backend: backend.kind, namespace: prefix() };
      }).catch(function () {
        // IDB failed at runtime -> degrade to localStorage/memory
        backend = global.localStorage ? lsBackend(global.localStorage) : pickBackend();
        emit('ready', { backend: backend.kind, degraded: true });
        return { backend: backend.kind, namespace: prefix(), degraded: true };
      });
    },

    /* save(slot, data, meta?) — write a named slot. Returns the record. */
    save: function (slot, data, meta) {
      var rec = makeRecord(slot, data, meta);
      return backend.set(keyFor(slot), rec).then(function () {
        emit('save', { slot: slot, bytes: sizeOf(rec) });
        return rec;
      });
    },

    /* load(slot) — return the stored record (or null). The tool reads
       record.data and record.meta. */
    load: function (slot) {
      return backend.get(keyFor(slot)).then(function (rec) {
        emit('load', { slot: slot, found: !!rec });
        return rec || null;
      });
    },

    /* remove(slot) — delete a slot. */
    remove: function (slot) {
      return backend.del(keyFor(slot)).then(function () { emit('remove', { slot: slot }); return true; });
    },

    /* list() — slots for THIS tool/version, with light metadata, for a
       save-slot picker. Returns [{slot, saved, meta, bytes}] sorted newest first. */
    list: function () {
      var pre = prefix();
      return backend.keys().then(function (keys) {
        var slots = keys.filter(function (k) { return typeof k === 'string' && k.indexOf(pre) === 0; });
        return Promise.all(slots.map(function (k) {
          return backend.get(k).then(function (rec) {
            return { slot: k.slice(pre.length), saved: rec && rec.saved, meta: (rec && rec.meta) || {}, bytes: sizeOf(rec) };
          });
        }));
      }).then(function (rows) {
        return rows.sort(function (a, b) { return (b.saved || '').localeCompare(a.saved || ''); });
      });
    },

    /* ---- autosave / resume : no data loss on refresh ----------------- */
    /* autosave(data, meta?) — write the working state to the 'auto' slot. */
    autosave: function (data, meta) { return api.save('auto', data, meta); },
    /* resume() — load the autosave slot on tool start (returns record|null). */
    resume: function () { return api.load('auto'); },

    /* startAutosave(getData, ms?, getMeta?) — periodically autosave working
       state. getData() returns the current project payload. Returns a stop fn.
       Default interval 8s. Call stop() to end it. */
    startAutosave: function (getData, ms, getMeta) {
      var iv = setInterval(function () {
        try { api.autosave(getData(), getMeta ? getMeta() : undefined); } catch (e) {}
      }, ms || 8000);
      return function stop() { clearInterval(iv); };
    },

    /* ---- file layer : export / import -------------------------------- */
    /* exportFile(slotOrRecord, filename?) — download a slot (or a record/
       payload you pass in) as pretty JSON. Browser only. */
    exportFile: function (slotOrRecord, filename) {
      var p = (typeof slotOrRecord === 'string') ? api.load(slotOrRecord)
                                                 : Promise.resolve(slotOrRecord);
      return p.then(function (rec) {
        if (!rec) throw new Error('nothing to export');
        var name = filename || ('axm-' + cfg.tool + '-' + (rec.slot || 'export') + '.axm.json');
        var json = JSON.stringify(rec, null, 2);
        var a = global.document.createElement('a');
        a.download = name;
        a.href = global.URL.createObjectURL(new global.Blob([json], { type: 'application/json' }));
        a.click();
        emit('export', { slot: rec.slot, file: name, bytes: json.length });
        return name;
      });
    },

    /* exportJSON(slot) — get the pretty JSON string (for non-browser use,
       or to hand to another tool / the AI). */
    exportJSON: function (slot) {
      return api.load(slot).then(function (rec) { return rec ? JSON.stringify(rec, null, 2) : null; });
    },

    /* importText(text, intoSlot?) — parse a saved JSON string. If intoSlot is
       given, the record is written to that slot. Returns the record. */
    importText: function (text, intoSlot) {
      return Promise.resolve().then(function () {
        var rec = JSON.parse(text);
        if (!rec || rec.format !== 'axm-save') throw new Error('not an AXM save file');
        if (intoSlot) return api.save(intoSlot, rec.data, rec.meta).then(function () { emit('import', { slot: intoSlot }); return rec; });
        emit('import', { slot: rec.slot });
        return rec;
      });
    },

    /* importFile(intoSlot?) — open a file picker, read + parse the chosen
       .json, optionally write it to a slot. Returns the record. Browser only. */
    importFile: function (intoSlot) {
      return new Promise(function (resolve, reject) {
        var input = global.document.createElement('input');
        input.type = 'file'; input.accept = '.json,application/json';
        input.onchange = function (e) {
          var f = e.target.files[0];
          if (!f) { reject(new Error('no file chosen')); return; }
          var r = new global.FileReader();
          r.onload = function (ev) { api.importText(String(ev.target.result), intoSlot).then(resolve, reject); };
          r.onerror = function () { reject(new Error('could not read file')); };
          r.readAsText(f);
        };
        input.click();
      });
    },

    /* ---- session layer : in-memory, lost on close -------------------- */
    session: (function () {
      var m = {};
      return {
        set: function (k, v) { m[k] = v; return v; },
        get: function (k) { return m[k]; },
        all: function () { return Object.assign({}, m); },
        clear: function () { m = {}; }
      };
    })(),

    /* ---- wiring ------------------------------------------------------ */
    onEvent: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
    },
    /* logToWisdom(bool) — when on, storage events are filed into AXMWisdom as
       kind:'action' (only if AXMWisdom exists and is itself on). Default OFF so
       the wisdom store is not flooded with routine save/load noise. */
    logToWisdom: function (b) { wisdomBridge = !!b; return wisdomBridge; },

    /* meta */
    config: function () { return { tool: cfg.tool, version: cfg.version, db: cfg.db, namespace: prefix(), backend: backend && backend.kind }; },
    /* backend() — which persistence is live ('indexeddb' | 'localstorage' |
       'memory' | null before init). For AXM.status(). */
    backend: function () { return backend ? backend.kind : null; },

    VERSION: '1.1'
  };

  global.AXMStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

/* ========== axm-wisdom-layer.js ========== */
/* ============================================================
   AXM WISDOM LAYER  —  axm-wisdom-layer.js   (v1.0, stable base)
   ------------------------------------------------------------
   Standalone, no dependencies, local-first.
   Drop into any AXM tool with one <script src="axm-wisdom-layer.js"></script>.

   WHAT IT IS
   A small store for "wisdom" — short lessons an AI (or a human) genuinely
   learns while using a tool. Wisdom is filed, kept append-only, fed back into
   an AI's prompt as soft guidance, and can be exported / imported as a map.

   WHY IT EXISTS
   This is the stable base. Today each tool keeps its own wisdom locally.
   Later, ALL wisdom from ALL tools can be routed to one identity storage so
   the AI identity can learn and grow across everything. That routing is a
   single hook here: AXMWisdom.setSink(fn). Nothing else has to change.

   GROUND RULES HONOURED
   - LOCAL FIRST  : works fully offline. The sink (identity storage) is optional.
   - SAME GATES   : file() / all() / context() are identical for human and AI.
   - APPEND ONLY  : the local store is never rewritten or compressed. No loss.
   - NO FAKE DONE : action-logging, drift-flagging and the identity store
                    itself are NOT built here. They are documented seams only.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---- internal state (per page load) ---------------------------------- */
  var cfg = { tool: 'tool', version: 'v1' };  // set by init()
  var enabled = false;        // the toggle. OFF by default (faithful to Studio)
  var sessionLog = [];        // entries filed during THIS session
  var loadedLog = [];         // entries imported from a map (past sessions)
  var subscribers = [];       // UI listeners, called after any change
  var sinks = [defaultSink];  // entries are sent to EVERY sink (local + identity, etc.)

  /* ---- tiny helpers ---------------------------------------------------- */
  function now() { return new Date().toISOString(); }
  function uid() {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function storeKey() { return 'axm_wisdom_' + cfg.tool + '_' + cfg.version; }
  function isStr(x) { return typeof x === 'string'; }

  /* Turn a string OR a partial object into a full, stamped wisdom entry.
     A bare string (how Studio files today) becomes a 'lesson' entry. */
  function normalize(input, defaults) {
    defaults = defaults || {};
    var e = isStr(input) ? { text: input } : (input || {});
    return {
      id:      e.id      || uid(),
      ts:      e.ts      || now(),
      tool:    e.tool    || cfg.tool,
      version: e.version || cfg.version,
      author:  e.author  || defaults.author || 'unknown', // 'ai1','ai2','human',name
      kind:    e.kind    || defaults.kind   || 'lesson',   // reserved: 'action','flag','principle'
      text:    String(e.text == null ? '' : e.text).trim(),
      tags:    Array.isArray(e.tags) ? e.tags : [],
      context: e.context || null                            // optional freeform
    };
  }

  function notify() {
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](api); } catch (err) { /* a bad listener never breaks the layer */ }
    }
  }

  /* ---- the default sink: append-only localStorage ---------------------- */
  /* The sink is the ONLY place persistence happens. Replace it with
     setSink() to route wisdom to identity storage. The default keeps a
     per-tool append-only array on disk so wisdom survives refreshes and
     even a "New project" (wisdom is identity-level, not project-level). */
  function defaultSink(entry) {
    try {
      var raw = global.localStorage.getItem(storeKey());
      var arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);                                    // APPEND ONLY
      global.localStorage.setItem(storeKey(), JSON.stringify(arr));
    } catch (err) { /* private mode / quota — layer still works in-memory */ }
  }

  /* Read the persistent append-only store back (e.g. on tool start). */
  function readStore() {
    try {
      var raw = global.localStorage.getItem(storeKey());
      return raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
  }

  /* ====================================================================
     PUBLIC API  —  the same gates for human and AI
     ==================================================================== */
  var api = {

    /* init(opts)
       Call once when the tool loads. opts:
         tool    : short tool id, e.g. 'studio'  (namespaces the store)
         version : e.g. 'v1'
         sink    : optional custom sink fn(entry) — your identity storage
         resume  : if true, pull the persistent store into loadedLog so past
                   wisdom is available to the AI immediately. Default true. */
    init: function (opts) {
      opts = opts || {};
      if (opts.tool)    cfg.tool = String(opts.tool);
      if (opts.version) cfg.version = String(opts.version);
      if (typeof opts.sink === 'function') sink = opts.sink;
      if (opts.resume !== false) {
        var prior = readStore();
        if (prior.length) loadedLog = loadedLog.concat(prior);
      }
      notify();
      return api;
    },

    /* file(input, defaults)
       The one write path. Accepts a string (back-compat with Studio) or a
       full/partial entry object. Stamps it, keeps it in session, and sends
       it to the sink (local store today, identity storage later).
       Returns the stored entry, or null if the toggle is off or text empty. */
    file: function (input, defaults) {
      if (!enabled) return null;                 // faithful: off means off
      var entry = normalize(input, defaults);
      if (!entry.text) return null;              // never file an empty nugget
      sessionLog.push(entry);
      for (var si = 0; si < sinks.length; si++) { try { sinks[si](entry); } catch (err) { /* one sink offline never blocks the others or the session */ } }
      notify();
      return entry;
    },

    /* fileSeam(opts)  —  the seam-visibility helper.
       A seam is where one decision touches another: an assumption this tool /
       module makes about how a DIFFERENT module behaves. Logging the seam (not
       just the action) is how a contradiction between two tools becomes visible
       BEFORE it becomes a bug. This is the AI-side of the seam-visibility idea;
       it does NOT detect drift, and there is NO human-facing version here.
       opts:
         assumption : what is being assumed (required)
         about      : which module / tool / decision the assumption is about
         why        : optional reasoning behind it
         by         : which module is making it (defaults to this tool)
         author     : 'human' | 'ai1' | ...
       Goes through file(), so it obeys the same toggle and the same gates. */
    fileSeam: function (opts) {
      opts = opts || {};
      var assumption = String(opts.assumption || '').trim();
      if (!assumption) return null;
      var about = opts.about ? String(opts.about) : 'another module';
      var text = 'assumes [' + about + ']: ' + assumption + (opts.why ? ' \u2014 because ' + opts.why : '');
      return api.file({
        text: text,
        kind: 'seam',
        author: opts.author,
        tags: ['seam'].concat(Array.isArray(opts.tags) ? opts.tags : []),
        context: { assumption: assumption, about: about, by: opts.by || cfg.tool, why: opts.why || null }
      }, { author: opts.author || 'unknown' });
    },

    /* all()      every entry the AI should consider: loaded + this session
       session()  only what was filed this session
       loaded()   only what was imported / resumed from the store          */
    all:     function () { return loadedLog.concat(sessionLog); },
    session: function () { return sessionLog.slice(); },
    loaded:  function () { return loadedLog.slice(); },

    /* seams()    only seam entries (assumptions about other modules)
       lessons()  everything that is NOT a seam (the applyable wisdom)        */
    seams:   function () { return api.all().filter(function (e) { return e.kind === 'seam'; }); },
    lessons: function () { return api.all().filter(function (e) { return e.kind !== 'seam'; }); },

    /* context(opts)
       Build the guidance block to inject into an AI prompt. Lessons keep their
       original framing (loaded vs gathered, "apply as guidance"). Seams get a
       SEPARATE block, framed as assumptions to VERIFY rather than apply — so
       the AI checks them instead of treating them as rules. Returns '' when the
       toggle is off or there is nothing to say. opts.label overrides the
       lesson framing line. */
    context: function (opts) {
      opts = opts || {};
      if (!enabled) return '';
      var notSeam = function (e) { return e.kind !== 'seam'; };
      var isSeam  = function (e) { return e.kind === 'seam'; };
      var loadedL = loadedLog.filter(notSeam), sessionL = sessionLog.filter(notSeam);
      var seamsAll = api.all().filter(isSeam);

      var lessonParts = [];
      if (loadedL.length)  lessonParts.push('Loaded wisdom map:\n'  + loadedL.map(fmtLine).join('\n'));
      if (sessionL.length) lessonParts.push('Gathered this session:\n' + sessionL.map(fmtLine).join('\n'));

      var blocks = [];
      if (lessonParts.length) {
        var label = opts.label || 'WISDOM (apply as guidance, not rules):';
        blocks.push(label + '\n' + lessonParts.join('\n\n'));
      }
      if (seamsAll.length) {
        blocks.push('SEAMS (assumptions about other modules \u2014 verify these still hold, do not just apply):\n' + seamsAll.map(fmtLine).join('\n'));
      }
      return blocks.length ? '\n' + blocks.join('\n\n') + '\n' : '';
    },

    /* on(bool) / isOn()  — the toggle. */
    on:   function (b) { enabled = !!b; notify(); return enabled; },
    isOn: function () { return enabled; },

    /* exportMap()  — plain-text map (faithful "AXM WISDOM MAP" header),
                      readable by a human or an AI alike. For copy-to-file. */
    exportMap: function () {
      var lines = api.all().map(fmtLine);
      return 'AXM WISDOM MAP\n' + (lines.length ? lines.join('\n') : '(empty)');
    },

    /* exportJSON() — structured form, the preferred transfer format and the
                      shape identity storage will ingest. */
    exportJSON: function () {
      return JSON.stringify({
        format: 'axm-wisdom', v: 1, tool: cfg.tool, version: cfg.version,
        exported: now(), entries: api.all()
      }, null, 2);
    },

    /* importMap(text)
       Accepts EITHER exportJSON() output OR the plain "AXM WISDOM MAP" text
       OR Studio's old loose "- nugget" lines. Parsed entries become loaded
       wisdom (they are NOT re-filed to the sink — import is read, not write). */
    importMap: function (text) {
      text = String(text || '');
      var entries = [];
      // try JSON first
      try {
        var j = JSON.parse(text);
        if (j && Array.isArray(j.entries)) entries = j.entries.map(function (e) { return normalize(e); });
      } catch (err) { /* not JSON — fall through to line parsing */ }
      if (!entries.length) {
        text.replace(/^AXM WISDOM MAP\s*/i, '')
          .split('\n')
          .forEach(function (ln) {
            var t = ln.replace(/^\s*[-•]\s*/, '').trim();
            if (t && t !== '(empty)') entries.push(normalize({ text: t, author: 'imported' }));
          });
      }
      loadedLog = entries;
      notify();
      return loadedLog.length;
    },

    /* setSink(fn) — REPLACE all sinks with this one (back-compat). Pass null
       to reset to the default local store. */
    setSink: function (fn) { sinks = [(typeof fn === 'function') ? fn : defaultSink]; return api; },

    /* addSink(fn) — ADD a destination without dropping the others. This is how
       a tool routes wisdom to the identity store AND keeps its own local copy,
       so a reload never loses history. (identity.wireWisdom uses this.) */
    addSink: function (fn) { if (typeof fn === 'function') sinks.push(fn); return api; },

    /* subscribe(fn) — UI listeners (e.g. re-render the wisdom log). Returns
       an unsubscribe function. */
    subscribe: function (fn) {
      if (typeof fn === 'function') subscribers.push(fn);
      return function () { subscribers = subscribers.filter(function (s) { return s !== fn; }); };
    },

    /* ---- back-compat with Studio's existing project blob -------------- */
    /* toLegacy()  — produce {log, loaded, on} in Studio's old shape so the
                     current Save project keeps working untouched.
       fromLegacy(o) — ingest that shape on load. These let the module drop
       into Studio without breaking save/load round-trips. */
    toLegacy: function () {
      return {
        log: sessionLog.map(function (e) { return e.text; }),
        loaded: loadedLog.map(fmtLine).join('\n'),
        on: enabled
      };
    },
    fromLegacy: function (o) {
      o = o || {};
      enabled = !!o.on;
      sessionLog = (o.log || []).map(function (t) { return normalize({ text: t, author: 'ai1' }); });
      if (o.loaded) api.importMap(String(o.loaded));
      else notify();
      return api;
    },

    /* meta */
    config: function () { return { tool: cfg.tool, version: cfg.version, key: storeKey() }; },
    VERSION: '1.2'
  };

  function fmtLine(e) { return '- ' + (isStr(e) ? e : e.text); }

  /* expose */
  global.AXMWisdom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

/* ========== axm-identity.js ========== */
/* ============================================================
   AXM IDENTITY STORE  —  axm-identity.js   (v1.1, stable base)
   ------------------------------------------------------------
   Standalone, no dependencies, local-first, fully offline.

   WHAT IT IS
   The one place wisdom from ALL tools pools, so the AI identity can learn and
   grow across everything. Holds two things kept apart on purpose:
     THE CORE   — who the identity is (the four roots / values). Canon.
     THE MEMORY — everything learned since. Append-only, never lost.

   v1.1 ADDS — DUPLICATE GATE (Mike's design):
   Append-only protects against LOSS but, unguarded, fills with near-copies.
   So a check runs BEFORE every append:
     - EXACT copy        -> not re-added; the existing entry is reinforced
                            (a "seen N times" count — repeated lessons matter).
     - NEAR copy         -> NOT added yet. A merge proposal is queued for a
                            human or AI to decide. This is the ONLY moment an
                            existing entry can change.
     - genuinely new     -> appended normally.
   A merge folds the new nuance into the old entry as a NEW VERSION, keeping
   the old version underneath. Nothing is erased, nothing is duplicated, and
   entries can't be edited anywhere else. Even an AI merge is fully reversible
   because the originals are preserved.
   ============================================================ */
(function (global) {
  'use strict';

  var DB = 'axm_identity';
  var backend = null;
  var listeners = [];
  var dedup = { mode: 'ask', near: 0.6, ignoreKinds: ['action'] };   // mode: 'ask' | 'off'
  var chain = Promise.resolve();            // serialise absorbs (avoid races)

  function now() { return new Date().toISOString(); }
  function uid(p) { return (p || 'id_') + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  function emit(type, info) { var ev = Object.assign({ type: type, ts: now() }, info || {}); for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) {} } }

  /* ---- similarity (no AI needed): normalise + light stem + score --------- */
  var STOP = { the:1,a:1,an:1,is:1,are:1,to:1,of:1,on:1,in:1,for:1,and:1,it:1,that:1,this:1,be:1,with:1,as:1 };
  function stem(w) { return w.length > 3 ? w.replace(/(ing|ed|er|es|s)$/,'') : w; }
  function tokens(t) {
    return String(t || '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
      .filter(function (w) { return w && !STOP[w]; }).map(stem);
  }
  function tokenSet(t) { var s = {}; tokens(t).forEach(function (w) { s[w] = 1; }); return s; }
  function normExact(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
  function similarity(a, b) {
    var A = tokenSet(a), B = tokenSet(b);
    var ak = Object.keys(A), bk = Object.keys(B);
    if (!ak.length || !bk.length) return 0;
    var inter = 0; ak.forEach(function (w) { if (B[w]) inter++; });
    var union = ak.length + bk.length - inter;
    var jaccard = inter / union;
    var containment = inter / Math.min(ak.length, bk.length);   // is the smaller mostly inside the larger?
    return 0.5 * jaccard + 0.5 * containment;
  }

  /* ---- IndexedDB backend (v2: entries, core, pending, skipped) ----------- */
  function idbBackend(IDB) {
    var dbp = new Promise(function (resolve, reject) {
      var req = IDB.open(DB, 2);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('core'))    db.createObjectStore('core', { autoIncrement: true });
        if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('skipped')) db.createObjectStore('skipped', { autoIncrement: true });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    function tx(store, mode, fn) {
      return dbp.then(function (db) { return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode), os = t.objectStore(store), rq = fn(os);
        t.oncomplete = function () { resolve(rq && rq.result); }; t.onerror = function () { reject(t.error); };
      }); });
    }
    return {
      kind: 'indexeddb',
      putEntry: function (e) { return tx('entries','readwrite',function(os){return os.put(e);}); },
      allEntries: function () { return tx('entries','readonly',function(os){return os.getAll();}); },
      getEntry: function (id) { return tx('entries','readonly',function(os){return os.get(id);}); },
      pushCore: function (c) { return tx('core','readwrite',function(os){return os.add(c);}); },
      allCore: function () { return tx('core','readonly',function(os){return os.getAll();}); },
      putPending: function (p) { return tx('pending','readwrite',function(os){return os.put(p);}); },
      allPending: function () { return tx('pending','readonly',function(os){return os.getAll();}); },
      delPending: function (id) { return tx('pending','readwrite',function(os){return os.delete(id);}); },
      pushSkipped: function (s) { return tx('skipped','readwrite',function(os){return os.add(s);}); },
      allSkipped: function () { return tx('skipped','readonly',function(os){return os.getAll();}); }
    };
  }

  /* ---- localStorage / memory fallback ------------------------------------ */
  var _mem = {}; function memGet(k){return k in _mem?_mem[k]:null;} function memSet(k,v){_mem[k]=String(v);}
  function kvBackend(get, set) {
    function rd(k,d){ try{var v=get(k);return v==null?d:JSON.parse(v);}catch(e){return d;} }
    function wr(k,v){ try{set(k,JSON.stringify(v));}catch(e){} }
    return {
      kind: get === memGet ? 'memory' : 'localstorage',
      putEntry:function(e){var a=rd('aie',[]);var i=a.findIndex(function(x){return x.id===e.id;});if(i>=0)a[i]=e;else a.push(e);wr('aie',a);return Promise.resolve();},
      allEntries:function(){return Promise.resolve(rd('aie',[]));},
      getEntry:function(id){return Promise.resolve(rd('aie',[]).find(function(x){return x.id===id;}));},
      pushCore:function(c){var a=rd('aic',[]);a.push(c);wr('aic',a);return Promise.resolve();},
      allCore:function(){return Promise.resolve(rd('aic',[]));},
      putPending:function(p){var a=rd('aip',[]);var i=a.findIndex(function(x){return x.id===p.id;});if(i>=0)a[i]=p;else a.push(p);wr('aip',a);return Promise.resolve();},
      allPending:function(){return Promise.resolve(rd('aip',[]));},
      delPending:function(id){wr('aip',rd('aip',[]).filter(function(x){return x.id!==id;}));return Promise.resolve();},
      pushSkipped:function(s){var a=rd('ais',[]);a.push(s);wr('ais',a);return Promise.resolve();},
      allSkipped:function(){return Promise.resolve(rd('ais',[]));}
    };
  }
  function pickBackend() {
    var IDB = global.indexedDB || global.mozIndexedDB || global.webkitIndexedDB || null;
    if (IDB) { try { return idbBackend(IDB); } catch (e) {} }
    if (global.localStorage) return kvBackend(function(k){return global.localStorage.getItem(k);}, function(k,v){global.localStorage.setItem(k,v);});
    return kvBackend(memGet, memSet);
  }

  /* ---- helpers ----------------------------------------------------------- */
  function normalizeIncoming(entry) {
    var e = (typeof entry === 'string') ? { text: entry } : (entry || {});
    return {
      id: e.id || uid(), ts: e.ts || now(),
      tool: e.tool || 'unknown', author: e.author || 'unknown',
      kind: e.kind || 'lesson', text: String(e.text == null ? '' : e.text),
      tags: Array.isArray(e.tags) ? e.tags : [], context: e.context || null
    };
  }
  function newRecord(inc) {
    return {
      id: inc.id, ts: inc.ts, lastTs: inc.ts, tool: inc.tool, author: inc.author,
      kind: inc.kind, text: inc.text, tags: inc.tags, context: inc.context,
      seenCount: 1, versions: [{ text: inc.text, ts: inc.ts, author: inc.author }], sources: []
    };
  }
  function defaultMerge(existingText, incomingText) {
    var a = tokenSet(existingText), b = tokenSet(incomingText);
    var aIn = Object.keys(a).every(function (w) { return b[w]; });
    var bIn = Object.keys(b).every(function (w) { return a[w]; });
    if (bIn) return existingText;                 // incoming adds nothing new
    if (aIn) return incomingText;                 // incoming is the richer one
    return existingText + ' | also: ' + incomingText;  // both have nuance — keep both, lossless
  }

  /* ====================================================================
     PUBLIC API
     ==================================================================== */
  var api = {

    init: function () {
      backend = pickBackend();
      return backend.allEntries().then(function () { emit('ready', { backend: backend.kind }); return { backend: backend.kind }; })
        .catch(function () { backend = global.localStorage ? kvBackend(function(k){return global.localStorage.getItem(k);}, function(k,v){global.localStorage.setItem(k,v);}) : kvBackend(memGet, memSet); return { backend: backend.kind, degraded: true }; });
    },

    /* setDedup({mode,near}) — mode 'ask' (gate on) or 'off' (pure append).
       near = similarity threshold 0..1 for a NEAR match (default 0.6). */
    setDedup: function (o) { o = o || {}; if (o.mode) dedup.mode = o.mode; if (typeof o.near === 'number') dedup.near = o.near; if (Array.isArray(o.ignoreKinds)) dedup.ignoreKinds = o.ignoreKinds; return dedup; },

    /* ---- core (canon) ---- */
    setCore: function (core) { var rec = { ts: now(), core: core }; return backend.pushCore(rec).then(function () { emit('core', {}); return rec; }); },
    core: function () { return backend.allCore().then(function (a) { return a && a.length ? a[a.length - 1].core : null; }); },
    coreHistory: function () { return backend.allCore(); },

    /* absorb(entry) — THE memory write path, now with the duplicate gate.
       Resolves to:
         { status:'added',      entry }              brand-new, appended
         { status:'reinforced', entry }              exact copy -> count bumped
         { status:'pending',    pendingId, similarTo, score }  near -> needs a decision
       Serialised internally so concurrent absorbs can't race past each other. */
    absorb: function (entry) {
      var run = function () { return api._absorb(entry); };
      var p = chain.then(run, run);
      chain = p.catch(function () {});
      return p;
    },
    _absorb: function (entry) {
      if (!backend) return Promise.resolve(null);
      var inc = normalizeIncoming(entry);
      if (!inc.text) return Promise.resolve(null);
      // identity is for what's LEARNED (lessons, seams, milestones), not routine
      // telemetry. Skip 'action' entries unless explicitly allowed.
      if (dedup.ignoreKinds && dedup.ignoreKinds.indexOf(inc.kind) >= 0) { emit('ignored', { kind: inc.kind }); return Promise.resolve({ status: 'ignored', kind: inc.kind }); }

      if (dedup.mode === 'off') {
        return backend.putEntry(newRecord(inc)).then(function () { emit('absorb', { id: inc.id, tool: inc.tool, kind: inc.kind }); return { status: 'added', entry: inc }; });
      }

      return backend.allEntries().then(function (all) {
        var same = (all || []).filter(function (e) { return e.kind === inc.kind; });
        var incExact = normExact(inc.text);
        // exact match -> reinforce
        for (var i = 0; i < same.length; i++) {
          if (normExact(same[i].text) === incExact) {
            var e = same[i]; e.seenCount = (e.seenCount || 1) + 1; e.lastTs = now();
            if (e.sources && inc.id) e.sources.push(inc.id);
            return backend.putEntry(e).then(function () { emit('reinforced', { id: e.id, seenCount: e.seenCount }); return { status: 'reinforced', entry: e }; });
          }
        }
        // best near match
        var best = null, bestScore = 0;
        for (var j = 0; j < same.length; j++) { var sc = similarity(inc.text, same[j].text); if (sc > bestScore) { bestScore = sc; best = same[j]; } }
        if (best && bestScore >= dedup.near) {
          var proposal = { id: uid('mrg_'), ts: now(), incoming: inc, similarTo: best.id, existingText: best.text, score: Math.round(bestScore * 100) / 100 };
          return backend.putPending(proposal).then(function () { emit('pending-merge', { pendingId: proposal.id, similarTo: best.id, score: proposal.score }); return { status: 'pending', pendingId: proposal.id, similarTo: best.id, score: proposal.score }; });
        }
        // genuinely new
        return backend.putEntry(newRecord(inc)).then(function () { emit('absorb', { id: inc.id, tool: inc.tool, kind: inc.kind }); return { status: 'added', entry: inc }; });
      });
    },

    /* ---- the one merge door: resolve a pending near-duplicate ---- */
    pending: function () { return backend.allPending(); },
    skipped: function () { return backend.allSkipped(); },

    /* resolveMerge(pendingId, decision, opts)
         decision 'merge'    -> fold incoming into the existing entry as a NEW
                                version (old kept). opts.text overrides the
                                merged wording; opts.by = who decided.
         decision 'separate' -> keep both: append incoming as its own entry.
         decision 'skip'     -> drop incoming, but log it (recoverable).
       This is the ONLY place an existing entry gains a new version. */
    resolveMerge: function (pendingId, decision, opts) {
      opts = opts || {};
      return backend.allPending().then(function (list) {
        var prop = (list || []).find(function (p) { return p.id === pendingId; });
        if (!prop) throw new Error('no such pending merge');
        var inc = prop.incoming;

        if (decision === 'separate') {
          return backend.putEntry(newRecord(inc)).then(function () { return backend.delPending(pendingId); }).then(function () { emit('separated', { id: inc.id }); return { status: 'separated', entry: inc }; });
        }
        if (decision === 'skip') {
          return backend.pushSkipped({ ts: now(), by: opts.by || 'unknown', incoming: inc, similarTo: prop.similarTo, reason: opts.reason || '' }).then(function () { return backend.delPending(pendingId); }).then(function () { emit('skipped', { similarTo: prop.similarTo }); return { status: 'skipped' }; });
        }
        // 'merge' (default)
        return backend.getEntry(prop.similarTo).then(function (ex) {
          if (!ex) { return backend.putEntry(newRecord(inc)).then(function () { return backend.delPending(pendingId); }).then(function () { return { status: 'separated', entry: inc, note: 'original gone, kept as new' }; }); }
          var mergedText = opts.text || defaultMerge(ex.text, inc.text);
          ex.versions = ex.versions || [{ text: ex.text, ts: ex.ts, author: ex.author }];
          ex.versions.push({ text: mergedText, ts: now(), author: opts.by || inc.author, mergedFrom: inc.id });
          ex.text = mergedText; ex.lastTs = now();
          ex.sources = ex.sources || []; ex.sources.push(inc.id);
          if (Array.isArray(inc.tags)) inc.tags.forEach(function (t) { if (ex.tags.indexOf(t) < 0) ex.tags.push(t); });
          return backend.putEntry(ex).then(function () { return backend.delPending(pendingId); }).then(function () { emit('merged', { into: ex.id, from: inc.id }); return { status: 'merged', entry: ex }; });
        });
      });
    },

    /* ---- reading (read-only) ---- */
    all: function (filter) {
      filter = filter || {};
      return backend.allEntries().then(function (a) {
        a = (a || []).slice().sort(function (x, y) { return (x.ts || '').localeCompare(y.ts || ''); });
        return a.filter(function (e) {
          if (filter.tool && e.tool !== filter.tool) return false;
          if (filter.author && e.author !== filter.author) return false;
          if (filter.kind && e.kind !== filter.kind) return false;
          if (filter.since && (e.ts || '') < filter.since) return false;
          return true;
        });
      });
    },

    context: function (opts) {
      opts = opts || {}; var recent = opts.recent || 20;
      return Promise.all([api.core(), api.all()]).then(function (r) {
        var core = r[0], mem = r[1], out = [];
        if (core) out.push('IDENTITY CORE (who — canon, read-only):\n' + (typeof core === 'string' ? core : JSON.stringify(core, null, 2)));
        var lessons = mem.filter(function (e) { return e.kind !== 'seam'; });
        var seams = mem.filter(function (e) { return e.kind === 'seam'; });
        function line(e) { return '- [' + e.tool + '/' + e.author + '] ' + e.text + ((e.seenCount > 1) ? (' (\u00d7' + e.seenCount + ')') : ''); }
        if (lessons.length) { var tail = lessons.slice(-recent); out.push('CONTINUITY (what we\'ve learned — most recent ' + tail.length + ' of ' + lessons.length + '):\n' + tail.map(line).join('\n')); }
        if (seams.length) out.push('SEAMS to keep in mind:\n' + seams.map(function (e) { return '- [' + e.tool + '] ' + e.text; }).join('\n'));
        if (!out.length) return '';
        return (opts.label || 'AXM IDENTITY') + '\n\n' + out.join('\n\n') + '\n';
      });
    },

    stats: function () {
      return api.all().then(function (a) {
        var s = { total: a.length, byTool: {}, byAuthor: {}, byKind: {}, reinforced: 0, first: a[0] && a[0].ts, last: a[a.length - 1] && a[a.length - 1].ts };
        a.forEach(function (e) { s.byTool[e.tool] = (s.byTool[e.tool] || 0) + 1; s.byAuthor[e.author] = (s.byAuthor[e.author] || 0) + 1; s.byKind[e.kind] = (s.byKind[e.kind] || 0) + 1; if ((e.seenCount || 1) > 1) s.reinforced++; });
        return s;
      });
    },

    wireWisdom: function (W) {
      if (!W) return api;
      // ADD identity as a destination without dropping the tool's own local
      // store, so a reload never loses the tool's wisdom view.
      if (W.addSink) W.addSink(function (entry) { api.absorb(entry); });
      else if (W.setSink) W.setSink(function (entry) { api.absorb(entry); });
      if (W.all) { try { W.all().forEach(function (e) { api.absorb(e); }); } catch (e) {} }
      emit('wired', {}); return api;
    },

    export: function () { return Promise.all([api.coreHistory(), api.all(), api.pending(), api.skipped()]).then(function (r) { return JSON.stringify({ format: 'axm-identity', v: 1, exported: now(), coreHistory: r[0], memory: r[1], pending: r[2], skipped: r[3] }, null, 2); }); },
    import: function (text) {
      var data; try { data = JSON.parse(text); } catch (e) { return Promise.reject(new Error('not an AXM identity file')); }
      if (!data || data.format !== 'axm-identity') return Promise.reject(new Error('not an AXM identity file'));
      var jobs = [];
      (data.coreHistory || []).forEach(function (c) { jobs.push(backend.pushCore(c)); });
      (data.memory || []).forEach(function (e) { jobs.push(backend.putEntry(e)); });   // restore as-is (keeps versions/seenCount)
      return Promise.all(jobs).then(function () { emit('import', { entries: (data.memory || []).length }); return true; });
    },

    subscribe: function (fn) { if (typeof fn === 'function') listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; },
    VERSION: '1.2'
  };

  global.AXMIdentity = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

/* ========== axm-connector.js ========== */
/* ============================================================
   AXM CONNECTOR  —  axm-connector.js   (v1.0, stable base)
   ------------------------------------------------------------
   Standalone, no dependencies, local-first.
   Drop into any AXM tool with one <script src="axm-connector.js"></script>.

   WHAT IT IS
   The one shared "call an AI" plug. Every tool that talks to an AI calls
   AXMConnect.ask(...). Which AI actually answers is swappable: a cloud model,
   a local model on your own machine, or the Local Bridge — without the tool
   knowing or caring which. Multiple AIs can be connected at once.

   WHY IT EXISTS
   Right now each tool reinvents this (the Sound Forge has its own AI call
   wired in). That means keys, endpoints and quirks are scattered. This pulls
   it into one piece so: tools stay simple, the Friction Portal can reuse it,
   and the Local Bridge slots in as just another provider.

   GROUND RULES HONOURED
     KEYS NEVER LIVE IN THE TOOL. There is no apiKey parameter anywhere. A
       provider reaches a backend that holds its own key (the runtime injects
       it, or the Bridge holds it on your machine, or a local model needs none).
       The tool can't leak a key it never holds.
     LOCAL FIRST. Local / Bridge providers are preferred; cloud is the
       fallback, never a default dependency. If nothing is reachable, ask()
       fails CLEARLY — it never invents an answer.
     SAME GATES. Human and AI call ask() identically. A pluggable gate() runs
       before every call (the seam for the future Gate System; default allow).
     SWAPPABLE + MULTI. Providers are registered; the caller can force one,
       set a default, or let availability decide.
   ============================================================ */
(function (global) {
  'use strict';

  var providers = {};          // id -> provider
  var order = [];              // preference order (first = tried first)
  var activeId = null;         // forced default, if the user picked one
  var gate = function () { return true; };   // seam for the Gate System
  var listeners = [];
  var availCache = {};         // id -> { ok, ts }
  var AVAIL_TTL = 5000;        // ms to trust an availability check
  var PING_MS = 700;           // how long to wait on a reachability ping

  function emit(type, info) {
    var ev = Object.assign({ type: type, ts: new Date().toISOString() }, info || {});
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) {} }
    return ev;
  }
  function err(msg, code) { var e = new Error(msg); e.axm = code || 'connector'; return e; }

  /* normalise a string or message array into [{role, content}] */
  function toMessages(input) {
    if (typeof input === 'string') return [{ role: 'user', content: input }];
    if (Array.isArray(input)) return input;
    if (input && input.messages) return input.messages;
    return [{ role: 'user', content: String(input == null ? '' : input) }];
  }

  /* short, abortable reachability ping for local/bridge providers */
  function ping(url) {
    if (!global.fetch) return Promise.resolve(false);
    var ctrl = ('AbortController' in global) ? new global.AbortController() : null;
    var t = setTimeout(function () { ctrl && ctrl.abort(); }, PING_MS);
    return global.fetch(url, { method: 'GET', signal: ctrl ? ctrl.signal : undefined })
      .then(function () { clearTimeout(t); return true; })
      .catch(function () { clearTimeout(t); return false; });
  }

  function cachedAvailable(p) {
    var c = availCache[p.id];
    if (c && (Date.now() - c.ts) < AVAIL_TTL) return Promise.resolve(c.ok);
    return Promise.resolve(p.available ? p.available() : true).then(function (ok) {
      availCache[p.id] = { ok: !!ok, ts: Date.now() };
      return !!ok;
    }).catch(function () { availCache[p.id] = { ok: false, ts: Date.now() }; return false; });
  }

  /* ====================================================================
     BUILT-IN PROVIDERS  (each only "available" when truly reachable)
     ==================================================================== */

  /* 1) Cloud — the "Claude in the runtime" pattern. NO key is passed; the
        host runtime injects it. Follows the in-artifact API shape. */
  var cfgCloud = { model: 'claude-sonnet-4-6', maxTokens: 1024 };
  var cloud = {
    id: 'cloud', label: 'Cloud model (runtime-keyed)', kind: 'cloud',
    available: function () { return !!global.fetch; },   // optimistic; send() surfaces real errors
    send: function (messages, opts) {
      opts = opts || {};
      var body = { model: opts.model || cfgCloud.model, max_tokens: opts.maxTokens || cfgCloud.maxTokens, messages: messages };
      if (opts.system) body.system = opts.system;
      return global.fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }).then(function (r) { return r.json(); }).then(function (data) {
        var text = (data && Array.isArray(data.content))
          ? data.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n')
          : '';
        return { text: text, raw: data };
      });
    }
  };

  /* 2) Bridge — the future Local Bridge on your own machine holds the keys
        and brokers the real call. Configure its URL with configure(). */
  var cfgBridge = { url: 'http://localhost:8787' };
  var bridge = {
    id: 'bridge', label: 'Local Bridge (keys on your machine)', kind: 'bridge',
    available: function () { return ping(cfgBridge.url + '/health'); },
    send: function (messages, opts) {
      return global.fetch(cfgBridge.url + '/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, opts: opts || {} })
      }).then(function (r) { return r.json(); }).then(function (data) {
        return { text: (data && data.text) || '', raw: data };
      });
    }
  };

  /* 3) Local model — an OpenAI-compatible server on your machine
        (e.g. LM Studio running your Nova/Echo-1). No key needed. */
  var cfgLocal = { url: 'http://localhost:1234', model: 'local-model' };
  var localModel = {
    id: 'local', label: 'Local model (on your machine)', kind: 'local',
    available: function () { return ping(cfgLocal.url + '/v1/models'); },
    send: function (messages, opts) {
      opts = opts || {};
      var msgs = opts.system ? [{ role: 'system', content: opts.system }].concat(messages) : messages;
      return global.fetch(cfgLocal.url + '/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: opts.model || cfgLocal.model, messages: msgs, max_tokens: opts.maxTokens || 1024 })
      }).then(function (r) { return r.json(); }).then(function (data) {
        var text = data && data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content : '';
        return { text: text || '', raw: data };
      });
    }
  };

  /* ====================================================================
     PUBLIC API
     ==================================================================== */
  var api = {

    /* register(provider) — add or replace a provider. A provider is:
         { id, label, kind, available()->bool|Promise, send(messages,opts)->{text,raw} }
       atFront=true makes it preferred over the others. */
    register: function (provider, atFront) {
      if (!provider || !provider.id || typeof provider.send !== 'function') throw err('invalid provider');
      providers[provider.id] = provider;
      order = order.filter(function (id) { return id !== provider.id; });
      if (atFront) order.unshift(provider.id); else order.push(provider.id);
      delete availCache[provider.id];
      emit('register', { id: provider.id, kind: provider.kind });
      return api;
    },

    /* configure(id, settings) — adjust a built-in provider (url, model…). */
    configure: function (id, settings) {
      settings = settings || {};
      if (id === 'cloud')  Object.assign(cfgCloud, settings);
      if (id === 'bridge') Object.assign(cfgBridge, settings);
      if (id === 'local')  Object.assign(cfgLocal, settings);
      delete availCache[id];
      return api;
    },

    /* use(id) — set the default provider (null = decide by availability). */
    use: function (id) { activeId = id || null; return api; },

    /* providers() — list registered providers with live availability,
       for a picker UI. */
    providers: function () {
      return Promise.all(order.map(function (id) {
        var p = providers[id];
        return cachedAvailable(p).then(function (ok) {
          return { id: id, label: p.label, kind: p.kind, available: ok, active: id === activeId };
        });
      }));
    },

    /* ask(input, opts) — THE one call. Same for human and AI.
         input : a string, or [{role,content}], or {messages,...}
         opts  : { provider, system, model, maxTokens, fallback }
       Routing: opts.provider forces one; else the active one; else the first
       AVAILABLE in preference order. fallback (default true) tries the next
       available provider if the chosen one is down or errors. Never invents a
       reply — if nothing is reachable it throws a clear offline error.
       Returns { text, provider, raw }.
       NOTE: a direct AXMConnect.ask() is NOT grounded in identity. To have the
       AI grounded in "who I am + what we've learned", call AXM.ask() from the
       bundle (it injects AXMIdentity.context() as the system prompt), or pass
       your own opts.system here. */
    ask: function (input, opts) {
      opts = opts || {};
      var messages = toMessages(input);

      // the gate runs before anything leaves the tool (seam for Gate System)
      return Promise.resolve(gate({ messages: messages, opts: opts })).then(function (ok) {
        if (!ok) {
          emit('refused', { reason: 'gate' });
          if (opts.strict) throw err('refused by gate', 'refused');
          return { text: '', denied: true, provider: null, reason: 'refused by gate' };
        }

        // build the candidate list
        var candidates;
        if (opts.provider) candidates = [opts.provider];
        else if (activeId) candidates = [activeId].concat(order.filter(function (id) { return id !== activeId; }));
        else candidates = order.slice();
        if (opts.fallback === false) candidates = candidates.slice(0, 1);

        emit('ask', { candidates: candidates });

        // walk candidates: first available that succeeds wins
        var i = 0;
        function tryNext(lastErr) {
          if (i >= candidates.length) {
            // NO AI is a NORMAL, supported state — AI is optional. We never
            // crash the tool and never fake an answer: we return a clean,
            // clearly-marked empty result the tool can flow past. (Pass
            // opts.strict:true if you'd rather have an exception.)
            emit('no-ai', { reason: 'no-provider' });
            if (opts.strict) throw err('no AI reachable — offline, or no provider available' + (lastErr ? (' (' + lastErr.message + ')') : ''), 'offline');
            return { text: '', noAI: true, provider: null, reason: 'no AI connected (AI is optional)' };
          }
          var id = candidates[i++]; var p = providers[id];
          if (!p) return tryNext(lastErr);
          return cachedAvailable(p).then(function (avail) {
            if (!avail) { emit('skip', { id: id, reason: 'unavailable' }); return tryNext(lastErr); }
            emit('route', { id: id });
            return Promise.resolve(p.send(messages, opts)).then(function (res) {
              emit('response', { id: id });
              return { text: (res && res.text) || '', provider: id, raw: res && res.raw };
            }).catch(function (e) {
              availCache[id] = { ok: false, ts: Date.now() };  // mark down
              emit('fallback', { id: id, error: e.message });
              return tryNext(e);
            });
          });
        }
        return tryNext(null);
      });
    },

    /* setGate(fn) — plug in the Gate System later. fn({messages,opts}) -> bool
       (sync or Promise). Default allows everything. */
    setGate: function (fn) { gate = (typeof fn === 'function') ? fn : function () { return true; }; return api; },

    /* onEvent(fn) — observe routing for logging / wisdom. Types: register,
       ask, route, response, skip, fallback, refused, error. Returns an
       unsubscribe fn. */
    onEvent: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
    },

    /* refresh() — forget cached availability so the next providers()/ask()
       re-checks live. Call this after the user starts a local model or the
       Bridge, so it's noticed immediately instead of after the cache expires. */
    refresh: function () { availCache = {}; return api; },

    VERSION: '1.2'
  };

  /* register the three built-ins. Order encodes local-first:
     prefer the Bridge, then a local model, then cloud as fallback. */
  api.register(bridge);
  api.register(localModel);
  api.register(cloud);

  global.AXMConnect = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

/* ========== axm-gate.js ========== */
/* ============================================================
   AXM GATE  —  axm-gate.js   (v1.0, stable base)
   ------------------------------------------------------------
   Standalone, no dependencies, local-first.
   Drop in with one <script src="axm-gate.js"></script>.

   WHAT IT IS
   The one checkpoint every action passes through. It does not DO a thing the
   way storage/wisdom/connector do — it CHECKS things. Every action, by a human
   or an AI, goes the same way:

         request  ->  check (rules)  ->  allow / deny  ->  logged

   This is what turns "same gates" from a promise into something the code
   enforces, and it is where the visible audit trail the hub will show comes
   from.

   THE DESIGN CHOICE (named, not hidden)
   The Gate is ADVISORY-BY-DEFAULT, not a lock. With no rules set it ALLOWS —
   because a gate that blocked everything out of the box would break every tool
   on day one. You add rules as you need them. Its real job is to make every
   action visible and checkable, and to enforce exactly the rules you chose.
   It governs LIVE actions; the human merge-gate still governs what becomes
   real. Different jobs.

   GROUND RULES HONOURED
     SAME GATES  : human and AI submit() identically. The actor is just a tag.
     LOCAL FIRST : the log persists locally (append-only). Works offline.
     APPEND ONLY : the decision log is never rewritten. Every check is recorded.
     HONEST      : a denied action is denied clearly, with a reason. Nothing
                   is silently dropped or silently allowed.
   ============================================================ */
(function (global) {
  'use strict';

  var rules = [];          // [{ id, name, match, decide }]
  var listeners = [];
  var logKey = 'axm_gate_log';
  var maxLog = 2000;       // keep the local log bounded (full history can be exported)
  var memLog = null;       // in-memory mirror when no localStorage

  function now() { return new Date().toISOString(); }
  function uid() { return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  function emit(type, info) { var ev = Object.assign({ type: type, ts: now() }, info || {}); for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) {} } }

  /* ---- append-only local decision log ---------------------------------- */
  function readLog() {
    if (memLog) return memLog.slice();
    try { var r = global.localStorage.getItem(logKey); return r ? JSON.parse(r) : []; }
    catch (e) { memLog = memLog || []; return memLog.slice(); }
  }
  function appendLog(entry) {
    var arr;
    try {
      if (memLog) { memLog.push(entry); if (memLog.length > maxLog) memLog = memLog.slice(-maxLog); return; }
      arr = readLog(); arr.push(entry); if (arr.length > maxLog) arr = arr.slice(-maxLog);
      global.localStorage.setItem(logKey, JSON.stringify(arr));
    } catch (e) { memLog = readLog(); memLog.push(entry); }   // fall back to memory, no loss in-session
  }

  /* ====================================================================
     A REQUEST looks like:
       { action:'storage.save', actor:'ai1', actorType:'ai'|'human',
         tool:'forge', detail:{...} }
     A DECISION looks like:
       { id, ts, request, allow:true|false, reason, rule }
     ==================================================================== */

  var api = {

    /* addRule(rule) — rule = {
         id?    : optional id (auto if omitted)
         name   : human-readable label
         match  : (request) => bool   — does this rule apply to this request?
         decide : (request) => true | false | { allow, reason }
                  true = allow, false = deny. Return an object to give a reason.
       }
       Rules are checked in order. The FIRST rule that both matches AND returns
       a definite allow/deny decides. A rule may match but return undefined to
       "pass" (let later rules decide). atFront=true checks it before others. */
    addRule: function (rule, atFront) {
      if (!rule || typeof rule.match !== 'function' || typeof rule.decide !== 'function') throw new Error('rule needs match() and decide()');
      rule.id = rule.id || uid();
      if (atFront) rules.unshift(rule); else rules.push(rule);
      emit('rule-added', { id: rule.id, name: rule.name });
      return rule.id;
    },
    removeRule: function (id) { rules = rules.filter(function (r) { return r.id !== id; }); return api; },
    rules: function () { return rules.map(function (r) { return { id: r.id, name: r.name }; }); },

    /* check(request) — run the rules WITHOUT logging or performing anything.
       A pure "what would the gate say?" Returns { allow, reason, rule }.
       Default with no matching rule: ALLOW (advisory-by-default). */
    check: function (request) {
      request = request || {};
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        var applies; try { applies = r.match(request); } catch (e) { applies = false; }
        if (!applies) continue;
        var d; try { d = r.decide(request); } catch (e) { d = { allow: false, reason: 'rule error: ' + e.message }; }
        if (d === undefined || d === null) continue;             // rule passes to the next
        if (typeof d === 'boolean') return { allow: d, reason: d ? 'allowed by ' + (r.name || r.id) : 'denied by ' + (r.name || r.id), rule: r.id };
        return { allow: !!d.allow, reason: d.reason || (d.allow ? 'allowed' : 'denied'), rule: r.id };
      }
      return { allow: true, reason: 'no rule blocked it (advisory-by-default)', rule: null };
    },

    /* submit(request) — THE entry point. Checks, LOGS the decision (allow or
       deny, with reason), and returns { allow, reason, rule, id }. Same call
       for human and AI. This never performs the action itself — the caller
       does that only if allow is true. */
    submit: function (request) {
      request = request || {};
      var verdict = api.check(request);
      var entry = { id: uid(), ts: now(), request: request, allow: verdict.allow, reason: verdict.reason, rule: verdict.rule };
      appendLog(entry);
      emit(verdict.allow ? 'allow' : 'deny', { action: request.action, actor: request.actor, reason: verdict.reason, id: entry.id });
      return { allow: verdict.allow, reason: verdict.reason, rule: verdict.rule, id: entry.id };
    },

    /* guard(request, fn) — convenience: submit, and only run fn() if allowed.
       Returns a Promise of { allow, reason, result? }. The honest path: a
       denied action does NOT run, and you get told why. */
    guard: function (request, fn) {
      var v = api.submit(request);
      if (!v.allow) return Promise.resolve({ allow: false, reason: v.reason, id: v.id });
      return Promise.resolve().then(fn).then(function (result) { return { allow: true, reason: v.reason, id: v.id, result: result }; });
    },

    /* connectTo(connector) — wire the Gate into the Connector's setGate seam,
       so every AI call passes the checkpoint. One line. */
    connectTo: function (connector) {
      if (connector && connector.setGate) {
        connector.setGate(function (req) {
          return api.submit({ action: 'connector.ask', actor: (req.opts && req.opts.actor) || 'ai', actorType: 'ai', detail: { provider: req.opts && req.opts.provider } }).allow;
        });
        emit('connected', {});
      }
      return api;
    },

    /* ---- the visible audit trail ---- */
    log: function (filter) {
      filter = filter || {};
      return readLog().filter(function (e) {
        if (filter.action && (!e.request || e.request.action !== filter.action)) return false;
        if (filter.actor && (!e.request || e.request.actor !== filter.actor)) return false;
        if (typeof filter.allow === 'boolean' && e.allow !== filter.allow) return false;
        if (filter.since && (e.ts || '') < filter.since) return false;
        return true;
      });
    },
    stats: function () {
      var l = readLog(); var s = { total: l.length, allowed: 0, denied: 0, byAction: {}, byActor: {} };
      l.forEach(function (e) {
        if (e.allow) s.allowed++; else s.denied++;
        var a = e.request && e.request.action || '?'; s.byAction[a] = (s.byAction[a] || 0) + 1;
        var who = e.request && e.request.actor || '?'; s.byActor[who] = (s.byActor[who] || 0) + 1;
      });
      return s;
    },
    exportLog: function () { return JSON.stringify({ format: 'axm-gate-log', v: 1, exported: now(), log: readLog() }, null, 2); },

    onEvent: function (fn) { if (typeof fn === 'function') listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; },
    VERSION: '1.0'
  };

  global.AXMGate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

/* ========== axm-friction.js ========== */
/* ============================================================
   AXM FRICTION PORTAL  —  axm-friction.js   (v1.0, stable base)
   ------------------------------------------------------------
   Standalone, no dependencies, local-first.
   Drop in with one <script src="axm-friction.js"></script>.

   WHAT IT IS
   A way to mark exactly WHERE confusion happens — point at a phrase, a button,
   a line of code, a concept — WITHOUT first having to explain why it's
   confusing or phrase a coherent question. You point; the portal asks ONE
   narrow question back; then it gets you an answer.

   "POINT, DON'T EXPLAIN."
   The hard part of being stuck is you often can't yet say what you don't know.
   So this flips it: marking the spot is enough. The system does the work of
   narrowing the gap, instead of assuming you already know its shape.

   EYES FOR THE AI TOO (same gate)
   The same wordless-stuck moment happens to an AI hitting an unclear spec or
   tool. So an AI points the SAME way a human does — point()/clarify()/respond()
   are identical; the only difference is a 'by' tag. A human can answer an AI's
   stuck point, or another AI can. Neither is left without a tool for it.

   GROUND RULES HONOURED
     LOCAL FIRST : works with no AI connected — the friction is still captured
                   and routed to a human. The AI side is optional, via the
                   Connector (swappable, multi-AI).
     SAME GATES  : human and AI use the identical calls.
     SEAM-AWARE  : a friction point IS a seam — the gap between what a tool
                   assumes you know and what you actually know. If the wisdom
                   layer is wired, each point is logged as a seam, and each
                   resolution as a lesson, so builders can SEE where people get
                   stuck.
   ============================================================ */
(function (global) {
  'use strict';

  var deps = { connector: null, wisdom: null, identity: null };
  var listeners = [];
  var key = 'axm_friction';
  var memStore = null;

  function now() { return new Date().toISOString(); }
  function uid() { return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  function emit(type, info) { var ev = Object.assign({ type: type, ts: now() }, info || {}); for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) {} } }

  /* ---- small local store (friction points persist so a human can answer an
          AI's stuck point later) ---------------------------------------- */
  function readAll() {
    if (memStore) return memStore.slice();
    try { var r = global.localStorage.getItem(key); return r ? JSON.parse(r) : []; } catch (e) { memStore = memStore || []; return memStore.slice(); }
  }
  function writeOne(rec) {
    var arr = readAll(); var i = arr.findIndex(function (x) { return x.id === rec.id; });
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    try { if (memStore) { memStore = arr; } else { global.localStorage.setItem(key, JSON.stringify(arr)); } }
    catch (e) { memStore = arr; }
  }

  function normTarget(target, opts) {
    if (typeof target === 'string') return { kind: opts.kind || 'concept', ref: target, where: opts.where || 'unknown' };
    return { kind: target.kind || 'concept', ref: target.ref || '', where: target.where || opts.where || 'unknown' };
  }

  /* default narrowing question when there's no AI to ask one */
  /* default narrowing question when there's no AI. Configurable so it needn't
     assume a human, or English. Set via configure({ fallback: {question, options} }). */
  var fallback = { question: 'What part is unclear?', options: ['What it does', 'How to use it', 'Why it\'s here', 'Where it leads'] };

  /* ask the connected AI for ONE narrow clarifying question (JSON) */
  function aiClarify(rec) {
    var prompt = 'Someone pointed at this and got stuck, WITHOUT explaining why: "' + rec.target.ref + '".'
      + ' Where: ' + rec.target.where + '. They are a ' + rec.byType + '.'
      + ' Ask EXACTLY ONE short, narrow question that best pinpoints what confuses them — do not answer yet.'
      + ' Also give 2-4 short tap-friendly options. Reply ONLY as JSON: {"question":"...","options":["...","..."]} and nothing else.';
    return deps.connector.ask(prompt, { actor: rec.by, maxTokens: 300 }).then(function (r) {
      var t = (r.text || '').replace(/```json|```/g, '').trim();
      try { var j = JSON.parse(t); if (j && j.question) return { question: j.question, options: Array.isArray(j.options) ? j.options : [] }; } catch (e) {}
      return { question: t || fallback.question, options: [] };
    });
  }

  /* ask the connected AI for the actual help, given the narrowing answer */
  function aiRespond(rec) {
    var prompt = 'Someone was confused about "' + rec.target.ref + '" (where: ' + rec.target.where + ').'
      + (rec.clarifyQuestion ? ' Asked "' + rec.clarifyQuestion + '", they answered: "' + rec.clarifyAnswer + '".' : '')
      + (rec.note ? ' They added: "' + rec.note + '".' : '')
      + ' Give a clear, short, plain-language answer that resolves exactly that gap. No preamble.';
    return deps.connector.ask(prompt, { actor: rec.by, maxTokens: 500 }).then(function (r) { return { text: r.text || '', provider: r.provider }; });
  }

  var api = {

    /* configure({connector, wisdom, identity}) — all optional. Without a
       connector the portal still captures friction and routes to a human. */
    configure: function (o) { o = o || {}; if (o.connector) deps.connector = o.connector; if (o.wisdom) deps.wisdom = o.wisdom; if (o.identity) deps.identity = o.identity; if (o.fallback && o.fallback.question) fallback = { question: o.fallback.question, options: Array.isArray(o.fallback.options) ? o.fallback.options : [] }; return api; },

    /* point(target, opts) — mark a friction point. target = a string (the
       thing) or { kind, ref, where }. opts: { by, byType:'human'|'ai', where,
       note }. note is usually EMPTY — pointing is enough. Returns the record.
       Files a seam (if wisdom wired) so builders can see where people stick. */
    point: function (target, opts) {
      opts = opts || {};
      var rec = {
        id: uid(), ts: now(), status: 'open',
        by: opts.by || 'someone', byType: opts.byType || 'human',
        target: normTarget(target, opts), note: opts.note || ''
      };
      writeOne(rec);
      if (deps.wisdom && deps.wisdom.fileSeam) {
        try { deps.wisdom.fileSeam({ assumption: '"' + rec.target.ref + '" is clear on its own', about: rec.target.where, why: 'a ' + rec.byType + ' got stuck here', author: rec.by, tags: ['friction'] }); } catch (e) {}
      }
      emit('point', { id: rec.id, by: rec.by, ref: rec.target.ref });
      return rec;
    },

    /* clarify(id) — the "system asks ONE narrow question back" step.
       Uses the connected AI if present, else a sensible default.
       Returns Promise<{ question, options }>. */
    clarify: function (id) {
      var rec = api.get(id); if (!rec) return Promise.reject(new Error('no such friction point'));
      var p = (deps.connector) ? aiClarify(rec).catch(function () { return fallback; }) : Promise.resolve(fallback);
      return p.then(function (q) {
        rec.status = 'clarifying'; rec.clarifyQuestion = q.question; writeOne(rec);
        emit('clarify', { id: id, question: q.question });
        return q;
      });
    },

    /* respond(id, {answer, provider}) — get the actual help, given the answer
       to the narrowing question. If no AI is connected, the friction is left
       OPEN and routed to a human — returns { needsHuman:true }, never a faked
       answer. On success, files a lesson (if wisdom wired). */
    respond: function (id, opts) {
      opts = opts || {};
      var rec = api.get(id); if (!rec) return Promise.reject(new Error('no such friction point'));
      if (opts.answer != null) rec.clarifyAnswer = String(opts.answer);
      writeOne(rec);
      if (!deps.connector) { emit('needs-human', { id: id }); return Promise.resolve({ needsHuman: true, friction: rec }); }
      return aiRespond(rec).then(function (res) {
        rec.status = 'answered'; rec.answer = res.text; rec.answeredBy = res.provider; writeOne(rec);
        if (deps.wisdom && deps.wisdom.file) {
          try { deps.wisdom.file({ text: 'friction at "' + rec.target.ref + '" (' + rec.target.where + ') resolved: ' + (rec.clarifyAnswer || rec.note || 'clarified'), author: rec.by, tags: ['friction-resolved'] }); } catch (e) {}
        }
        emit('answered', { id: id, provider: res.provider });
        return { text: res.text, provider: res.provider };
      });
    },

    /* resolve(id) — mark a friction point fully resolved (the person/AI says
       "got it"). Open points stay listed until resolved, so an AI's stuck
       point a human still needs to answer doesn't disappear. */
    resolve: function (id) { var rec = api.get(id); if (rec) { rec.status = 'resolved'; rec.resolvedAt = now(); writeOne(rec); emit('resolved', { id: id }); } return rec; },

    get: function (id) { return readAll().find(function (x) { return x.id === id; }) || null; },
    list: function (filter) {
      filter = filter || {};
      return readAll().filter(function (e) {
        if (filter.status && e.status !== filter.status) return false;
        if (filter.byType && e.byType !== filter.byType) return false;
        if (filter.where && e.target.where !== filter.where) return false;
        return true;
      });
    },

    onEvent: function (fn) { if (typeof fn === 'function') listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; },
    VERSION: '1.1'
  };

  global.AXMFriction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

/* ========== axm-tool.js ========== */
/* ============================================================
   AXM TOOL ID  —  axm-tool.js   (v1.1, hook only)
   ------------------------------------------------------------
   Standalone, no dependencies, local-first.

   WHAT IT IS
   The tiny "ID card" a tool declares so the foundation knows which tool is
   running and which gate it needs. THAT'S ALL it does at the pre-hub level.

   BOUNDARY (repaired after cross-check)
   Discovery, a registry of all tools, launching, categories, routing — those
   are the HUB's job (the skin), not the spine. An earlier version of this file
   built a shared registry; that crossed the line and has been removed. The
   pre-hub card is just:  { id, name, version, required_gate }.

   START SMALL. The hub extends the card later with description, category, icon,
   etc. — none of that lives here.

   GROUND RULES HONOURED
     SPINE, NOT SKIN : declaration only. No registry, no launch, no categories.
     SAME FOR ALL    : 'name' is a readable label (vs the machine id) — a human
                       OR an AI sets it the same way. No human assumed.
     TIES TO THE GATE: required_gate connects a tool to the Gate's checkpoint.
   ============================================================ */
(function (global) {
  'use strict';

  var current = null;
  var ID_RE = /^[a-z0-9][a-z0-9_-]*$/;   // lowercase machine id

  function normalize(card) {
    card = card || {};
    return {
      id: String(card.id || '').trim(),                 // machine name (namespacing)
      name: String(card.name || '').trim(),             // readable label (human or AI)
      version: String(card.version || '').trim(),       // e.g. v1
      required_gate: card.required_gate || 'default'    // which gate profile it needs (the Gate/hub interprets)
    };
  }

  var api = {

    /* validate(card) -> { ok, errors, warnings }. Required: id, name, version. */
    validate: function (card) {
      card = card || {};
      var errors = [], warnings = [];
      if (!card.id) errors.push('id is required');
      else if (!ID_RE.test(String(card.id))) errors.push('id must be lowercase letters/digits with - or _ (e.g. "soundforge")');
      if (!card.name) errors.push('name is required');
      if (!card.version) errors.push('version is required');
      if (!card.required_gate) warnings.push('no required_gate (defaults to "default")');
      return { ok: errors.length === 0, errors: errors, warnings: warnings };
    },

    /* define(card) — declare THIS tool's card. Validates and holds it as the
       current tool. Does NOT register it anywhere shared — that's the hub's
       job. Returns the normalized card. Throws on a missing/invalid required field. */
    define: function (card) {
      var v = api.validate(card);
      if (!v.ok) throw new Error('invalid tool card: ' + v.errors.join('; '));
      current = normalize(card); current._warnings = v.warnings;
      return current;
    },

    /* current() — the card declared this session (this tool), or null. */
    current: function () { return current; },

    VERSION: '1.1'
  };

  global.AXMTool = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

/* ========== AXM ORCHESTRATOR ========== */
(function (global) {
  'use strict';
  var ready = false, card = null, wiredWisdom = false;
  var AXM = {
    store: global.AXMStore, wisdom: global.AXMWisdom, identity: global.AXMIdentity,
    connect: global.AXMConnect, gate: global.AXMGate, friction: global.AXMFriction, tool: global.AXMTool,
    init: function (opts) {
      opts = opts || {};
      var c = opts.card || { id: opts.id || opts.tool, name: opts.name || (opts.id || opts.tool), version: opts.version || 'v1', required_gate: opts.required_gate };
      card = global.AXMTool.define(c);
      var id = card.id, version = card.version;
      return Promise.all([ global.AXMStore.init({ tool: id, version: version }), global.AXMIdentity.init() ]).then(function (r) {
        global.AXMWisdom.init({ tool: id, version: version });
        global.AXMIdentity.wireWisdom(global.AXMWisdom); wiredWisdom = true;
        global.AXMGate.connectTo(global.AXMConnect);
        if (opts.wireFriction !== false) global.AXMFriction.configure({ connector: global.AXMConnect, wisdom: global.AXMWisdom, identity: global.AXMIdentity });
        if (opts.core) global.AXMIdentity.setCore(opts.core);
        ready = true;
        return { card: card, storageBackend: r[0] && r[0].backend, identityBackend: r[1] && r[1].backend };
      });
    },
    ask: function (prompt, opts) {
      opts = opts || {};
      return global.AXMIdentity.context().then(function (sys) {
        var o = Object.assign({}, opts);
        if (sys) o.system = sys + (opts.system ? ('\n\n' + opts.system) : '');
        return global.AXMConnect.ask(prompt, o);
      });
    },
    /* status() — one snapshot of "am I in a good state?" for a human OR a
       machine agent with no human watching. Composes the parts; never throws
       (each part is guarded). Returns a plain object. */
    status: function () {
      var snap = { ready: ready, tool: (global.AXMTool.current && global.AXMTool.current()) || null,
        storage: null, wisdom: { on: null, wiredToIdentity: wiredWisdom },
        identity: { entries: null, pendingMerges: null }, gate: { rules: null, allowed: null, denied: null },
        connector: null, friction: { open: null } };
      try { snap.storage = global.AXMStore.backend ? global.AXMStore.backend() : null; } catch (e) {}
      try { snap.wisdom.on = global.AXMWisdom.isOn ? global.AXMWisdom.isOn() : null; } catch (e) {}
      try { var gs = global.AXMGate.stats(); snap.gate = { rules: (global.AXMGate.rules() || []).length, allowed: gs.allowed, denied: gs.denied, total: gs.total }; } catch (e) {}
      try { snap.friction.open = global.AXMFriction.list({ status: 'open' }).length + global.AXMFriction.list({ status: 'clarifying' }).length; } catch (e) {}
      // async parts: identity stats + pending, connector availability
      var jobs = [];
      jobs.push(Promise.resolve().then(function () { return global.AXMIdentity.stats(); }).then(function (s) { snap.identity.entries = s.total; }).catch(function () {}));
      jobs.push(Promise.resolve().then(function () { return global.AXMIdentity.pending(); }).then(function (p) { snap.identity.pendingMerges = (p || []).length; }).catch(function () {}));
      jobs.push(Promise.resolve().then(function () { return global.AXMConnect.providers(); }).then(function (pr) { snap.connector = (pr || []).map(function (x) { return { id: x.id, available: x.available }; }); }).catch(function () {}));
      return Promise.all(jobs).then(function () { return snap; });
    },
    card: function () { return card; }, isReady: function () { return ready; }, VERSION: '1.4.1'
  };
  global.AXM = AXM;
  if (typeof module !== 'undefined' && module.exports) module.exports = AXM;
})(typeof window !== 'undefined' ? window : this);
