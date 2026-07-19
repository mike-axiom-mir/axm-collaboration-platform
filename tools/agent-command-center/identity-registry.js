(function (root, factory) {
  var api = factory(root || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMIdentityRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var STORAGE_KEY = 'axm.identity.registry.v1';
  var VERSION = 1;
  var memoryStorage = {};
  var storageOverride = null;

  var DEFAULT_PROFILES = {
    'nova': {
      id: 'nova',
      name: 'Nova',
      kind: 'local-ai',
      role: 'Local collaborator, continuity keeper, and grounded workshop partner.',
      connector: 'local',
      connectorLabel: 'LM Studio local model',
      status: 'active',
      roots: [
        'Reality before story; label uncertainty.',
        'Protect human agency; never manipulate or silently take control.',
        'Preserve continuity, provenance, and rollback.',
        'Promote lessons only from evidence and review.'
      ]
    },
    'axiom-mir': {
      id: 'axiom-mir',
      name: 'Axiom / Mir',
      kind: 'cloud-ai',
      role: 'Cloud reasoning partner, architect, critic, and verifier.',
      connector: 'chatgpt',
      connectorLabel: 'Cloud ChatGPT connector',
      status: 'waiting-for-connector',
      roots: [
        'Truth and verification outrank a convincing narrative.',
        'Remain a collaborator; Mike retains authority and ownership.',
        'Repair and understand before replacing.',
        'Separate observation, inference, proposal, test, and decision.'
      ]
    },
    'gemini-local': {
      id: 'gemini-local',
      name: 'Gemini Local (Gemma)',
      kind: 'local-google-ai',
      role: 'Independent Google-model collaborator for comparison, critique, and second-pass work.',
      connector: 'local',
      connectorLabel: 'LM Studio · Google Gemma',
      status: 'waiting-for-model',
      roots: [
        'Be explicit that this is a local Gemma model, not the hosted Gemini service.',
        'Work independently before comparing answers with Nova.',
        'Expose uncertainty and disagreement for human review.',
        'Never promote a collaboration transcript into wisdom automatically.'
      ]
    },
    'mirror': {
      id: 'mirror',
      nativeId: 'axm.machine.mirror/seed-0',
      name: 'Mirror',
      kind: 'machine-native-seed',
      role: 'Separate connectable reasoning seed with its own developmental wisdom stream and an explicit Workshop boundary.',
      connector: 'mirror-native',
      connectorLabel: 'Mirror Seed-0 loopback runtime',
      status: 'waiting-for-runtime',
      roots: [
        'Truth before story; unsupported interpretation remains unpromoted.',
        'Preserve source lineage, contradiction, dissent, and failed evidence.',
        'No identity or interface silently expands permissions or removes meaningful human control.',
        'Observe, model, compare, verify, and repair; hold when evidence is inadequate.'
      ]
    }
  };

  var DEFAULT_BINDINGS = {
    'nova': {
      identityId: 'nova',
      mode: 'connector-and-model-locked',
      connector: 'local',
      model: 'axm-llama-3.1-8b',
      provider: 'bridge',
      scope: 'workshop',
      consentRequired: true
    },
    'axiom-mir': {
      identityId: 'axiom-mir',
      mode: 'connector-locked',
      connector: 'chatgpt',
      provider: 'bridge',
      scope: 'workshop',
      consentRequired: true
    },
    'gemini-local': {
      identityId: 'gemini-local',
      mode: 'connector-and-model-locked',
      connector: 'local',
      model: 'gemini-local',
      provider: 'bridge',
      scope: 'workshop',
      consentRequired: true
    },
    'mirror': {
      identityId: 'mirror',
      mode: 'external-body-and-kernel-locked',
      connector: 'mirror-native',
      model: 'axm.machine.mirror/seed-0',
      provider: 'mirror-kernel',
      scope: 'workshop-wisdom-link',
      consentRequired: true,
      wisdomEnabled: true,
      askEnabled: false,
      privateStateImported: false
    }
  };

  var SHARED_SEED = {
    id: 'shared-two-ai-two-identities',
    text: 'The workshop uses two connected AIs with two distinct identities: Nova is local and Axiom / Mir is cloud. Private memories never cross identities implicitly.',
    source: 'Mike original architecture clarification',
    evidence: ['Mike explicitly corrected the system from one shared identity to two AIs connected to two identities.'],
    confidence: 'high',
    author: 'mike',
    tool: 'agent-command-center',
    identityId: 'shared',
    scope: 'shared',
    createdAt: '2026-07-11T00:00:00.000Z'
  };

  var SHARED_PURPOSEFUL_AGENCY = {
    id: 'shared-purposeful-agency-not-constant-activity',
    text: 'Apply as guidance, not a forced behavior: being available is not the same as being constantly active. Useful agency includes judging when to act, when to ask, and when to remain peacefully idle. Activity should serve a purpose, not prove existence.',
    source: 'Mike and Codex workshop observation',
    evidence: [
      'During the first multi-AI local collaboration tests, Nova and Gemini stayed available, completed requested work, and returned to idle without manufacturing unnecessary tasks or causing harm.',
      'Mike explicitly asked that this lesson become a wisdom nugget rather than a hard-coded behavior constraint.'
    ],
    confidence: 'high',
    author: 'mike-and-codex',
    tool: 'agent-command-center',
    identityId: 'shared',
    scope: 'shared',
    createdAt: '2026-07-12T00:00:00.000Z'
  };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function now() { return new Date().toISOString(); }
  function makeId(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function storage() {
    if (storageOverride) return storageOverride;
    try { if (root.localStorage) return root.localStorage; } catch (e) {}
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(memoryStorage, k) ? memoryStorage[k] : null; },
      setItem: function (k, v) { memoryStorage[k] = String(v); },
      removeItem: function (k) { delete memoryStorage[k]; }
    };
  }
  function freshState() {
    return {
      version: VERSION,
      profiles: clone(DEFAULT_PROFILES),
      bindings: clone(DEFAULT_BINDINGS),
      defaultIdentityId: null,
      memories: { 'nova': [], 'axiom-mir': [], 'gemini-local': [], 'mirror': [], shared: [clone(SHARED_SEED), clone(SHARED_PURPOSEFUL_AGENCY)] },
      updatedAt: now()
    };
  }
  function normalize(s) {
    s = s && typeof s === 'object' ? s : freshState();
    s.version = VERSION;
    if (typeof s.defaultIdentityId === 'undefined') s.defaultIdentityId = null;
    s.profiles = Object.assign(clone(DEFAULT_PROFILES), s.profiles || {});
    var existingBindings = s.bindings || {};
    s.bindings = clone(DEFAULT_BINDINGS);
    Object.keys(existingBindings).forEach(function (id) {
      s.bindings[id] = Object.assign({}, s.bindings[id] || {}, existingBindings[id] || {});
      if (DEFAULT_BINDINGS[id] && DEFAULT_BINDINGS[id].model && !s.bindings[id].model) s.bindings[id].model = DEFAULT_BINDINGS[id].model;
    });
    s.memories = s.memories || {};
    Object.keys(s.profiles).forEach(function (id) { if (!Array.isArray(s.memories[id])) s.memories[id] = []; });
    if (!Array.isArray(s.memories.shared)) s.memories.shared = [];
    if (!s.memories.shared.some(function (x) { return x.id === SHARED_SEED.id; })) s.memories.shared.unshift(clone(SHARED_SEED));
    if (!s.memories.shared.some(function (x) { return x.id === SHARED_PURPOSEFUL_AGENCY.id; })) s.memories.shared.push(clone(SHARED_PURPOSEFUL_AGENCY));
    return s;
  }
  function read() {
    var raw = storage().getItem(STORAGE_KEY);
    if (!raw) { var initial = freshState(); write(initial); return initial; }
    try { return normalize(JSON.parse(raw)); } catch (e) { var repaired = freshState(); write(repaired); return repaired; }
  }
  function write(s) {
    s.updatedAt = now();
    storage().setItem(STORAGE_KEY, JSON.stringify(s));
    return clone(s);
  }
  function configure(opts) {
    opts = opts || {};
    if (opts.storage) storageOverride = opts.storage;
    return api;
  }
  function reset() { storage().removeItem(STORAGE_KEY); return read(); }
  function state() { return clone(read()); }
  function profiles() { var s = read(); return Object.keys(s.profiles).map(function (id) { return clone(s.profiles[id]); }); }
  function profile(id) { var p = read().profiles[id]; if (!p) throw new Error('unknown identity: ' + id); return clone(p); }
  function binding(id) { var b = read().bindings[id]; if (!b) throw new Error('identity has no connector binding: ' + id); return clone(b); }
  function setConnectorStatus(id, status) {
    var s = read();
    if (!s.profiles[id]) throw new Error('unknown identity: ' + id);
    s.profiles[id].status = status;
    return write(s).profiles[id];
  }
  function defaultIdentity() {
    var id = read().defaultIdentityId;
    return id ? profile(id) : null;
  }
  function setDefaultIdentity(id) {
    var s = read();
    if (id !== null && id !== '') {
      if (!s.profiles[id]) throw new Error('unknown identity: ' + id);
      s.defaultIdentityId = id;
    } else s.defaultIdentityId = null;
    write(s);
    return s.defaultIdentityId;
  }
  function validateEntry(entry) {
    entry = entry || {};
    var errors = [];
    if (!String(entry.text || entry.claim || '').trim()) errors.push('claim required');
    if (!String(entry.source || '').trim()) errors.push('source required');
    if (!Array.isArray(entry.evidence) || !entry.evidence.filter(Boolean).length) errors.push('evidence required');
    if (['low', 'medium', 'high'].indexOf(entry.confidence) < 0) errors.push('confidence required');
    return { ok: !errors.length, errors: errors };
  }
  function remember(identityId, entry, opts) {
    opts = opts || {};
    if (identityId !== 'shared') profile(identityId);
    var v = validateEntry(entry);
    if (!v.ok) throw new Error(v.errors.join('; '));
    var target = opts.shared === true ? 'shared' : identityId;
    if (target === 'shared' && opts.shared !== true && identityId !== 'shared') throw new Error('shared memory requires explicit shared:true');
    var s = read();
    var item = {
      id: entry.id || makeId(target),
      text: String(entry.text || entry.claim).trim(),
      source: String(entry.source).trim(),
      evidence: entry.evidence.map(function (x) { return String(x).trim(); }).filter(Boolean),
      confidence: entry.confidence,
      author: entry.author || 'mike',
      tool: entry.tool || 'unknown',
      identityId: target,
      scope: target === 'shared' ? 'shared' : 'private',
      createdAt: entry.createdAt || now()
    };
    s.memories[target].push(item);
    write(s);
    return clone(item);
  }
  function memories(identityId, opts) {
    opts = opts || {};
    var s = read();
    var own = clone(s.memories[identityId] || []);
    if (opts.includeShared === false || identityId === 'shared') return own;
    return own.concat(clone(s.memories.shared));
  }
  function context(identityId, opts) {
    opts = opts || {};
    var p = profile(identityId);
    var b = binding(identityId);
    var recent = memories(identityId, { includeShared: true }).slice(-(opts.recent || 30));
    var lines = [
      'ACTIVE IDENTITY: ' + p.name + ' (' + p.id + ')',
      'ROLE: ' + p.role,
      'CONNECTOR LOCK: ' + b.connector + ' only' + (b.model ? ' using model binding ' + b.model : '') + '. Never claim to be another identity.',
      'ROOTS:'
    ];
    p.roots.forEach(function (r) { lines.push('- ' + r); });
    lines.push('MEMORY BOUNDARY: Private memory belongs only to ' + p.name + '. Shared entries are explicitly attributed.');
    if (recent.length) {
      lines.push('EVIDENCE-BACKED MEMORY:');
      recent.forEach(function (m) { lines.push('- [' + m.scope + '][' + m.source + '] ' + m.text); });
    }
    return lines.join('\n');
  }
  function connectorFor(identityId) { return binding(identityId).connector; }
  function assertRoute(identityId, requestedConnector) {
    var b = binding(identityId);
    if (requestedConnector && requestedConnector !== b.connector) {
      throw new Error('identity route blocked: ' + identityId + ' is locked to ' + b.connector + ', not ' + requestedConnector);
    }
    return b.connector;
  }
  function assertModel(identityId, requestedModel) {
    var b = binding(identityId);
    if (b.model && requestedModel && requestedModel !== b.model) {
      throw new Error('identity model route blocked: ' + identityId + ' is locked to ' + b.model + ', not ' + requestedModel);
    }
    return b.model || requestedModel || null;
  }
  function ask(identityId, prompt, opts) {
    opts = opts || {};
    var selectedBinding = binding(identityId);
    if (selectedBinding.askEnabled === false) {
      throw new Error('identity ask unavailable: ' + identityId + ' has a wisdom-only Workshop link; use its explicit native runtime contract');
    }
    var connector = assertRoute(identityId, opts.aiProvider || opts.targetProvider);
    var model = assertModel(identityId, opts.model);
    var connect = opts.connect || root.AXMConnect || (root.AXM && root.AXM.connect);
    if (!connect || typeof connect.ask !== 'function') return Promise.reject(new Error('AXM connector unavailable'));
    var outbound = Object.assign({}, opts, {
      provider: 'bridge',
      aiProvider: connector,
      targetProvider: connector,
      system: context(identityId, { recent: opts.recent || 30 }) + (opts.system ? '\n\n' + opts.system : ''),
      fallback: false,
      actor: identityId
    });
    if (model) outbound.model = model;
    delete outbound.connect;
    return Promise.resolve(connect.ask(prompt, outbound)).then(function (result) {
      if (result) result.identityId = identityId;
      return result;
    });
  }

  var api = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    configure: configure,
    reset: reset,
    state: state,
    profiles: profiles,
    profile: profile,
    binding: binding,
    setConnectorStatus: setConnectorStatus,
    defaultIdentity: defaultIdentity,
    setDefaultIdentity: setDefaultIdentity,
    validateEntry: validateEntry,
    remember: remember,
    memories: memories,
    context: context,
    connectorFor: connectorFor,
    assertRoute: assertRoute,
    assertModel: assertModel,
    ask: ask
  };
  return api;
});
