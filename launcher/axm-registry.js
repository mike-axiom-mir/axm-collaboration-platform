/* ============================================================
   AXM CONNECTION REGISTRY  —  axm-registry.js   (v0.1 · Phase 0)
   ------------------------------------------------------------
   Built EXACTLY to the locked seven-layer review decision
   (AXM_CONNECTION_REGISTRY_DEBRIEF__FINAL_BUILD_DECISION.txt).
   Status: APPROVED FOR BUILD · NOT CANON YET (validates through
   the Asset Bootstrap as first consumer). Sits BESIDE the spine —
   axm-foundation.js is untouched; AXM.ask() and AXMAssets keep
   working unchanged. No cliff, always ladder.

   HONEST LABEL (per the decision, verbatim intent):
   "Single gated connection path for visibility, consent, logging,
   and future rollback. NOT a complete sandbox or security boundary."

   THE BOUNDARY RULE (decided before coding, as required):
   Tool-private work stays in the tool. A connection MUST come here
   when: one tool sends/receives from another · a source/sink may be
   reused by multiple tools · data moves through a shared path
   (vault/folder/pipeline/cloud) · AI requests a cross-tool action ·
   the action needs gate/log/rollback visibility.

   LOCKED CONTRACT — connector: { id, kind, canHandle, handle, meta? }
   canHandle is PURE INSPECTION (contract rule, not sandbox-proven —
   said honestly): errors and side-effect attempts are treated as
   "cannot handle". Request/result envelopes fixed below.
   ============================================================ */
(function (global) {
  'use strict';

  var connectors = [];          /* registration order = read fallback order */
  var listeners = {};           /* event -> [fn] */
  var seq = 0;

  var READ_ACTIONS = { read: 1, list: 1, resolve: 1 };

  function emit(event, data) {
    (listeners[event] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
  }

  /* gate + minimal metadata log — NEVER payload contents (locked rule 5) */
  function gated(action, detail, actor) {
    var req = { action: action, actor: (actor && actor.actor) || 'unknown',
                actorType: (actor && actor.actorType) || 'human',
                tool: 'axm-registry', detail: detail };
    if (global.AXMGate && global.AXMGate.submit) return global.AXMGate.submit(req);
    return { allow: true, reason: 'no gate present (spine not loaded?)' };
  }

  function envelope(fields) {   /* locked result envelope — every answer wears it */
    var r = { ok: false, handled: false, kind: fields.kind || null };
    for (var k in fields) r[k] = fields[k];
    return r;
  }

  function safeCanHandle(c, request) {
    try { return c.canHandle(request) === true; }   /* throw or weirdness = false */
    catch (e) { return false; }
  }

  var api = {

    /* register(connector) — makes a connector AVAILABLE. Availability is
       not permission: nothing auto-connects by registration (locked rule 6). */
    register: function (connector, actor) {
      if (!connector || typeof connector.id !== 'string' || typeof connector.kind !== 'string'
          || typeof connector.canHandle !== 'function' || typeof connector.handle !== 'function') {
        return envelope({ error: 'invalid connector: need {id, kind, canHandle, handle}' });
      }
      if (connectors.some(function (c) { return c.id === connector.id; })) {
        return envelope({ error: 'id already registered: ' + connector.id });
      }
      var v = gated('registry.register', { id: connector.id, kind: connector.kind }, actor);
      if (!v.allow) return envelope({ error: 'gate: ' + v.reason, gate: v });
      connectors.push(connector);
      emit('register', { id: connector.id, kind: connector.kind });
      return envelope({ ok: true, handled: true, connectorId: connector.id, kind: connector.kind });
    },

    unregister: function (id, actor) {
      var v = gated('registry.unregister', { id: id }, actor);
      if (!v.allow) return envelope({ error: 'gate: ' + v.reason, gate: v });
      var before = connectors.length;
      connectors = connectors.filter(function (c) { return c.id !== id; });
      emit('unregister', { id: id });
      return envelope({ ok: connectors.length < before, handled: true, connectorId: id });
    },

    list: function (filter) {
      filter = filter || {};
      return connectors
        .filter(function (c) { return !filter.kind || c.kind === filter.kind; })
        .map(function (c) { return { id: c.id, kind: c.kind, meta: c.meta || {} }; });
    },

    on: function (event, fn) { (listeners[event] = listeners[event] || []).push(fn); },

    /* connect(request) — THE one door.
       request (locked): { kind, action, payload, options?, actor?, context?, requestId? } */
    connect: function (request) {
      request = request || {};
      var rid = request.requestId || ('r' + Date.now() + '-' + (++seq));
      if (typeof request.kind !== 'string' || typeof request.action !== 'string') {
        return Promise.resolve(envelope({ error: 'bad request: kind and action are required', requestId: rid }));
      }
      var isRead = !!READ_ACTIONS[request.action];
      var actor = request.actor || {};
      var candidates = connectors.filter(function (c) {
        return c.kind === request.kind && safeCanHandle(c, request);
      });

      if (!candidates.length) {
        gated('registry.connect', { kind: request.kind, action: request.action,
              requestId: rid, matched: 0, outcome: 'no-connector' }, actor);
        return Promise.resolve(envelope({ kind: request.kind, action: request.action,
          error: 'no connector can handle this', requestId: rid }));
      }

      /* LOCKED SELECTION RULE (risk-based):
         reads may fall back to first match; write-class with multiple
         matches needs the USER'S choice (or an explicit options.connectorId);
         AI-initiated write-class is proposal-first unless the user already
         approved (options.approvedByUser). Never a random meaningful write. */
      var chosen = null;
      if (request.options && request.options.connectorId) {
        chosen = candidates.filter(function (c) { return c.id === request.options.connectorId; })[0] || null;
        if (!chosen) return Promise.resolve(envelope({ kind: request.kind, action: request.action,
          error: 'requested connector not available: ' + request.options.connectorId, requestId: rid }));
      } else if (isRead) {
        chosen = candidates[0];
      } else if (candidates.length > 1) {
        var saved = global.AXMSettings && global.AXMSettings.get('connectors.defaultSink');
        var savedHit = saved && candidates.filter(function (c) { return c.id === saved; })[0];
        if (savedHit) { chosen = savedHit; }   /* user EXPLICITLY saved this default */
        else return Promise.resolve(envelope({ kind: request.kind, action: request.action,
          needsUserChoice: true, requestId: rid,
          choices: candidates.map(function (c) { return { id: c.id, meta: c.meta || {} }; }) }));
      } else {
        chosen = candidates[0];
      }
      if (!isRead && actor.actorType === 'ai' && !(request.options && request.options.approvedByUser)) {
        return Promise.resolve(envelope({ kind: request.kind, action: request.action,
          needsUserChoice: true, requestId: rid,
          choices: [{ id: chosen.id, meta: chosen.meta || {} }],
          error: 'ai-initiated write: proposal first (locked rule)' }));
      }

      var v = gated('registry.connect', { kind: request.kind, action: request.action,
            connectorId: chosen.id, requestId: rid, actorType: actor.actorType || 'human' }, actor);
      if (!v.allow) {
        emit('denied', { requestId: rid, connectorId: chosen.id });
        return Promise.resolve(envelope({ kind: request.kind, action: request.action,
          connectorId: chosen.id, error: 'gate: ' + v.reason, gate: v, requestId: rid }));
      }

      return Promise.resolve().then(function () { return chosen.handle(request); })
        .then(function (raw) {
          /* TRUTH PATCH: a connector saying ok:false is a FAILURE — surface it,
             never hide it inside result (Mike's rule, v0.8). */
          var failed = raw && typeof raw === 'object' && raw.ok === false;
          var r = envelope({ ok: !failed, handled: true, connectorId: chosen.id,
            kind: request.kind, action: request.action, result: raw, requestId: rid,
            error: failed ? (raw.error || 'connector reported failure') : undefined });
          emit('handled', { requestId: rid, connectorId: chosen.id, kind: request.kind,
                            action: request.action, ok: !failed });
          return r;
        })
        .catch(function (e) {
          emit('handled', { requestId: rid, connectorId: chosen.id, kind: request.kind,
                            action: request.action, ok: false });
          return envelope({ handled: true, connectorId: chosen.id, kind: request.kind,
            action: request.action, error: String(e && e.message || e), requestId: rid });
        });
    },

    VERSION: '0.1'
  };

  global.AXMRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ---- BUILT-IN LOCAL CONNECTORS (the only ones that ship — locked) ----
     One strategy system, two doors: local.assets DELEGATES to AXMAssets,
     so the bootstrap's resolver and the registry answer identically and
     no second resolver abstraction exists (Sharpened Decision 2). */
  if (global.AXMAssets) {
    api.register({ id: 'local.assets', kind: 'asset.source',
      meta: { title: 'Local shelves (via AXMAssets)' },
      canHandle: function (q) { return q.action === 'resolve' && q.payload && typeof q.payload.assetId === 'string'; },
      handle: function (q) { return { path: global.AXMAssets.getAssetPath(q.payload.assetId, q.context) }; }
    }, { actor: 'axm', actorType: 'system' });
  }
  if (typeof fetch === 'function') {
    api.register({ id: 'local.export', kind: 'asset.sink',
      meta: { title: 'Workshop /exports folder' },
      canHandle: function (q) { return q.action === 'write' && q.payload && typeof q.payload.filename === 'string'; },
      handle: function (q) {
        return fetch('/api/export', { method: 'POST',
          body: JSON.stringify({ filename: q.payload.filename, content: q.payload.content }) })
          .then(function (r) { return r.json(); });
      }
    }, { actor: 'axm', actorType: 'system' });
    api.register({ id: 'local.prompts', kind: 'prompt.source',
      meta: { title: 'Canonical prompt shelf' },
      canHandle: function (q) { return q.action === 'resolve' && q.payload && typeof q.payload.promptId === 'string'; },
      handle: function (q) { return { path: '/prompts/local/' + q.payload.promptId }; }
    }, { actor: 'axm', actorType: 'system' });
    api.register({ id: 'local.templates', kind: 'template.source',
      meta: { title: 'Template library (index.json)' },
      canHandle: function (q) { return (q.action === 'list') || (q.action === 'resolve' && q.payload && typeof q.payload.templateId === 'string'); },
      handle: function (q) {
        return fetch('/assets/local/template/index.json').then(function (r) { return r.json(); })
          .then(function (ix) {
            if (q.action === 'list') return ix;
            var hit = (ix.templates || []).filter(function (t) { return t.id === q.payload.templateId; })[0];
            if (!hit) throw new Error('unknown template: ' + q.payload.templateId);
            if (!hit.file) throw new Error('template ' + hit.id + ' is ' + hit.status + ' — no file exists yet (no fake done)');
            return { path: '/assets/local/template/' + hit.file, entry: hit };
          });
      }
    }, { actor: 'axm', actorType: 'system' });
  }
})(typeof window !== 'undefined' ? window : this);
