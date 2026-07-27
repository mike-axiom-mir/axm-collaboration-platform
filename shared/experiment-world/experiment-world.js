(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMExperimentWorld = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var WORLD_SCHEMA = 'axm.experiment-world/v1';
  var INTENT_SCHEMA = 'axm.experiment-intent/v1';
  var FRAME_SCHEMA = 'axm.experiment-sensor-frame/v1';
  var CHECKPOINT_SCHEMA = 'axm.experiment-checkpoint/v1';
  var ALLOWED_MODES = ['directed', 'curiosity', 'repair', 'unknown-hunt'];
  var ALLOWED_EFFECTS = ['candidate-memory'];
  var BLOCKED_EFFECTS = ['network', 'canonical-write', 'credential-read', 'outside-filesystem', 'process-execute', 'permission-change', 'publish', 'install'];
  var READY_CAPABILITIES = [
    { id: 'artifact.compose.typed', status: 'READY', note: 'Typed candidate artifacts only' },
    { id: 'artifact.unknown.capsule', status: 'READY', note: 'Unclassified results remain explicit' },
    { id: 'state.checkpoint.explicit', status: 'READY', note: 'Manual browser checkpoint or download' },
    { id: 'observer.sensor-frame.structured', status: 'READY', note: 'Human and machine receive the same candidate truth' },
    { id: 'mirror.intent.external', status: 'DEGRADED', note: 'Contract ready; no live Mirror broker attached' },
    { id: 'code.execute.isolated', status: 'BLOCKED', note: 'No isolated execution host in v0.1' },
    { id: 'network.external', status: 'BLOCKED', note: 'Network is outside the shoebox membrane' },
    { id: 'canonical.promote', status: 'BLOCKED', note: 'Promotion always requires a separate review gate' }
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce(function (out, key) {
        if (value[key] !== undefined) out[key] = stable(value[key]);
        return out;
      }, {});
    }
    return value;
  }
  function digest(value) {
    var text = JSON.stringify(stable(value));
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'fnv1a32-' + (hash >>> 0).toString(16).padStart(8, '0');
  }
  function artifactDigest(artifact) {
    var clean = clone(artifact);
    delete clean.digest;
    return digest(clean);
  }
  function text(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 500);
  }
  function finite(value, fallback, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = fallback;
    return Math.max(min, Math.min(max, value));
  }
  function slug(value, fallback) {
    var result = text(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return result || fallback;
  }
  function nextId(state, prefix) { return prefix + '-' + String(state.sequence + 1).padStart(3, '0'); }
  function withoutDigest(state) {
    var clean = clone(state);
    delete clean.worldDigest;
    return clean;
  }
  function seal(state) {
    state.worldDigestAlgorithm = 'fnv1a32-stable-json';
    state.worldDigest = digest(withoutDigest(state));
    return state;
  }
  function event(state, type, actor, message, detail) {
    state.sequence += 1;
    state.events.push({
      id: 'event-' + String(state.sequence).padStart(3, '0'),
      sequence: state.sequence,
      type: type,
      actor: text(actor || 'system', 80),
      message: text(message, 360),
      detail: detail ? clone(detail) : null
    });
  }
  function normalizeBudgets(input) {
    input = input || {};
    return {
      timeMinutes: finite(input.timeMinutes, 5, 1, 480),
      storageMb: finite(input.storageMb, 50, 1, 4096),
      computePercent: finite(input.computePercent, 20, 1, 100),
      maxArtifacts: Math.round(finite(input.maxArtifacts, 24, 3, 250)),
      maxForks: Math.round(finite(input.maxForks, 3, 1, 24)),
      network: false
    };
  }
  function create(config) {
    config = config || {};
    var mode = ALLOWED_MODES.indexOf(config.mode) >= 0 ? config.mode : 'curiosity';
    var goal = text(config.goal || 'Explore a useful possibility without assuming its final form.', 1000);
    var createdAt = text(config.createdAt || new Date().toISOString(), 80);
    var world = {
      schema: WORLD_SCHEMA,
      version: '0.1.0',
      id: 'shoebox-' + slug(config.id || goal, 'experiment'),
      title: text(config.title || 'Mirror Holo Shoebox', 160),
      goal: goal,
      mode: mode,
      status: 'DRAFT',
      branch: 'candidate/' + slug(config.branch || goal, 'experiment'),
      createdAt: createdAt,
      sequence: 0,
      pulse: 0,
      budgets: normalizeBudgets(config.budgets),
      usage: { timeMinutes: 0, storageMb: 0, computePercentPeak: 0, artifacts: 0, forks: 1 },
      capabilities: clone(READY_CAPABILITIES),
      artifacts: [],
      links: [],
      events: [],
      refusals: [],
      truth: {
        canonicalWorkshopChanged: false,
        mirrorConnected: false,
        arbitraryCodeExecuted: false,
        externalNetworkUsed: false,
        observerCanMutateWorld: false,
        promotionRequiresSeparateReview: true,
        deterministicRehearsal: true,
        resourceUsageMeasured: false,
        resourceEnvelope: 'declared-intent-budget'
      }
    };
    event(world, 'experiment.created', 'human', 'Disposable candidate world opened.', { mode: mode, branch: world.branch });
    var rootArtifact = {
      id: 'artifact-intent',
      kind: 'intent',
      title: 'Creative direction',
      summary: goal,
      status: 'CANDIDATE',
      createdBy: 'human',
      sequence: world.sequence,
      inputs: [],
      facets: { mode: mode, branch: world.branch },
      evidence: []
    };
    rootArtifact.digest = artifactDigest(rootArtifact);
    world.artifacts.push(rootArtifact);
    world.usage.artifacts = 1;
    return seal(world);
  }
  function validate(state) {
    var errors = [];
    if (!state || state.schema !== WORLD_SCHEMA) errors.push('schema must be ' + WORLD_SCHEMA);
    if (!state || !Array.isArray(state.artifacts)) errors.push('artifacts must be an array');
    if (!state || !Array.isArray(state.events)) errors.push('events must be an array');
    if (!state || !state.budgets || state.budgets.network !== false) errors.push('network budget must remain false');
    if (state && ['DRAFT', 'ACTIVE', 'HELD', 'FROZEN'].indexOf(state.status) < 0) errors.push('unsupported status');
    if (state && state.worldDigest && state.worldDigest !== digest(withoutDigest(state))) errors.push('world digest mismatch');
    return { ok: errors.length === 0, errors: errors };
  }
  function normalizeIntent(intent) {
    intent = intent || {};
    return {
      schema: intent.schema || INTENT_SCHEMA,
      id: text(intent.id || 'intent', 120),
      type: text(intent.type, 120),
      actor: {
        id: text(intent.actor && intent.actor.id || 'unknown-seat', 100),
        kind: text(intent.actor && intent.actor.kind || 'machine', 30)
      },
      artifact: intent.artifact ? clone(intent.artifact) : null,
      sourceIds: Array.isArray(intent.sourceIds) ? intent.sourceIds.map(function (id) { return text(id, 120); }) : [],
      evidence: intent.evidence ? clone(intent.evidence) : null,
      note: text(intent.note, 600),
      effects: Array.isArray(intent.effects) ? intent.effects.map(function (item) { return text(item, 80).toLowerCase(); }) : [],
      resource: {
        timeMinutes: finite(intent.resource && intent.resource.timeMinutes, 0.2, 0, 480),
        storageMb: finite(intent.resource && intent.resource.storageMb, 0.1, 0, 4096),
        computePercent: finite(intent.resource && intent.resource.computePercent, 5, 0, 100)
      }
    };
  }
  function hold(state, intent, code, message, options) {
    if (!options || options.preserveStatus !== true) state.status = 'HELD';
    var refusal = { code: code, intentId: intent.id, effects: intent.effects.slice(), message: message };
    state.refusals.push(refusal);
    event(state, 'intent.refused', intent.actor.id, message, refusal);
    seal(state);
    return { ok: false, state: state, refusal: refusal };
  }
  function artifactExists(state, id) { return state.artifacts.some(function (item) { return item.id === id; }); }
  function applyIntent(current, rawIntent) {
    var check = validate(current);
    if (!check.ok) throw new Error('invalid experiment world: ' + check.errors.join('; '));
    var state = clone(current);
    var intent = normalizeIntent(rawIntent);
    if (intent.schema !== INTENT_SCHEMA) return hold(state, intent, 'UNSUPPORTED_INTENT_SCHEMA', 'Intent schema is not supported.');
    if (state.status === 'FROZEN') return hold(state, intent, 'WORLD_FROZEN', 'Frozen candidate content cannot be changed.', { preserveStatus: true });
    var forbidden = intent.effects.filter(function (effect) { return BLOCKED_EFFECTS.indexOf(effect) >= 0; });
    if (forbidden.length) return hold(state, intent, 'AUTHORITY_BOUNDARY', 'Shoebox refused outside authority: ' + forbidden.join(', ') + '.');
    var undeclared = intent.effects.filter(function (effect) { return ALLOWED_EFFECTS.indexOf(effect) < 0; });
    if (undeclared.length) return hold(state, intent, 'UNDECLARED_EFFECT', 'Shoebox refused undeclared effects: ' + undeclared.join(', ') + '.');
    var nextUsage = {
      timeMinutes: state.usage.timeMinutes + intent.resource.timeMinutes,
      storageMb: state.usage.storageMb + intent.resource.storageMb,
      computePercentPeak: Math.max(state.usage.computePercentPeak, intent.resource.computePercent),
      artifacts: state.usage.artifacts,
      forks: state.usage.forks
    };
    if (nextUsage.timeMinutes > state.budgets.timeMinutes || nextUsage.storageMb > state.budgets.storageMb || nextUsage.computePercentPeak > state.budgets.computePercent) {
      return hold(state, intent, 'RESOURCE_BUDGET', 'Intent exceeds the declared intent resource envelope.');
    }
    if (intent.type === 'experiment.freeze') {
      state.usage = nextUsage;
      state.status = 'FROZEN';
      event(state, 'experiment.frozen', intent.actor.id, 'Candidate frozen for review.', { promotion: 'still-blocked' });
      return { ok: true, state: seal(state), artifact: null };
    }
    if (intent.type === 'experiment.note') {
      state.usage = nextUsage;
      state.status = 'ACTIVE';
      event(state, 'experiment.note', intent.actor.id, intent.note || 'Note recorded.', null);
      return { ok: true, state: seal(state), artifact: null };
    }
    if (intent.type !== 'artifact.create' && intent.type !== 'artifact.transform' && intent.type !== 'evidence.record') {
      return hold(state, intent, 'UNSUPPORTED_INTENT_TYPE', 'Intent type is not available in this shoebox version.');
    }
    if (intent.type === 'evidence.record') {
      var evidenceTarget = intent.sourceIds[0];
      var target = state.artifacts.find(function (item) { return item.id === evidenceTarget; });
      if (!target) return hold(state, intent, 'MISSING_SOURCE', 'Evidence target does not exist in the candidate world.');
      target.evidence.push({ id: nextId(state, 'evidence'), claim: text(intent.evidence && intent.evidence.claim, 300), verdict: text(intent.evidence && intent.evidence.verdict || 'UNKNOWN', 20), surface: text(intent.evidence && intent.evidence.surface || 'unverified', 100) });
      target.digest = artifactDigest(target);
      state.usage = nextUsage;
      state.status = 'ACTIVE';
      event(state, 'evidence.recorded', intent.actor.id, 'Evidence attached to ' + target.title + '.', { targetId: target.id });
      return { ok: true, state: seal(state), artifact: clone(target) };
    }
    if (intent.type === 'artifact.transform' && (!intent.sourceIds.length || !intent.sourceIds.every(function (id) { return artifactExists(state, id); }))) {
      return hold(state, intent, 'MISSING_SOURCE', 'Transform source is missing from the candidate world.');
    }
    if (state.usage.artifacts + 1 > state.budgets.maxArtifacts) return hold(state, intent, 'ARTIFACT_BUDGET', 'Artifact count reached the declared limit.');
    var supplied = intent.artifact || {};
    var id = nextId(state, 'artifact');
    var artifact = {
      id: id,
      kind: slug(supplied.kind || 'unknown-capsule', 'unknown-capsule'),
      title: text(supplied.title || 'Untitled candidate', 180),
      summary: text(supplied.summary || 'No summary supplied.', 800),
      status: 'CANDIDATE',
      createdBy: intent.actor.id,
      sequence: state.sequence + 1,
      inputs: intent.sourceIds.slice(),
      facets: supplied.facets && typeof supplied.facets === 'object' ? clone(supplied.facets) : {},
      evidence: []
    };
    if (artifact.kind === 'unknown-capsule') {
      artifact.facets.classification = artifact.facets.classification || 'UNCLASSIFIED';
      artifact.facets.proposedContract = artifact.facets.proposedContract || 'axm.artifact.proposal/unresolved';
    }
    artifact.digest = artifactDigest(artifact);
    state.artifacts.push(artifact);
    intent.sourceIds.forEach(function (sourceId) {
      state.links.push({ from: sourceId, to: artifact.id, relation: intent.type === 'artifact.transform' ? 'transformed-into' : 'informed' });
    });
    nextUsage.artifacts += 1;
    state.usage = nextUsage;
    state.status = 'ACTIVE';
    event(state, intent.type, intent.actor.id, artifact.title + ' entered the candidate world.', { artifactId: artifact.id, kind: artifact.kind });
    return { ok: true, state: seal(state), artifact: clone(artifact) };
  }
  var PULSE_FORMS = [
    { kind: 'possibility-map', title: 'Possibility field', summary: 'Maps several honest directions without selecting a winner.', facet: 'structure' },
    { kind: 'visual-draft', title: 'Visible shape', summary: 'Turns the current possibility into a reviewable visual proposition.', facet: 'appearance' },
    { kind: 'rule-prototype', title: 'Behavior seed', summary: 'Describes one bounded interaction or transformation rule.', facet: 'behavior' },
    { kind: 'code-proposal', title: 'Executable anatomy proposal', summary: 'Names code boundaries and tests without executing arbitrary code.', facet: 'logic' },
    { kind: 'experience-fragment', title: 'Playable or usable fragment', summary: 'Connects presentation, behavior and a human-facing purpose.', facet: 'experience' },
    { kind: 'unknown-capsule', title: 'Unclassified possibility', summary: 'Preserves a result that does not honestly fit a known output category.', facet: 'unknown' }
  ];
  function pulseIntent(state) {
    var index = state.pulse % PULSE_FORMS.length;
    if (state.mode === 'unknown-hunt') index = (index + 5) % PULSE_FORMS.length;
    if (state.mode === 'repair') index = (index + 2) % (PULSE_FORMS.length - 1);
    var form = PULSE_FORMS[index];
    var sources = state.artifacts.length ? [state.artifacts[state.artifacts.length - 1].id] : [];
    return {
      schema: INTENT_SCHEMA,
      id: 'rehearsal-pulse-' + String(state.pulse + 1).padStart(3, '0'),
      type: sources.length ? 'artifact.transform' : 'artifact.create',
      actor: { id: 'mirror-rehearsal', kind: 'machine' },
      sourceIds: sources,
      effects: ['candidate-memory'],
      resource: { timeMinutes: 0.35, storageMb: 0.4, computePercent: Math.min(12, state.budgets.computePercent) },
      artifact: {
        kind: form.kind,
        title: form.title,
        summary: form.summary + ' Direction: ' + state.goal,
        facets: { primary: form.facet, mode: state.mode, rehearsal: true, executable: false }
      }
    };
  }
  function runPulse(current) {
    var intent = pulseIntent(current);
    var result = applyIntent(current, intent);
    if (result.ok) {
      result.state.pulse += 1;
      event(result.state, 'rehearsal.pulse', 'mirror-rehearsal', 'Deterministic Mirror-compatible pulse completed.', { pulse: result.state.pulse });
      seal(result.state);
    }
    result.intent = intent;
    return result;
  }
  function observe(state, observer) {
    var check = validate(state);
    if (!check.ok) throw new Error('cannot observe invalid experiment world: ' + check.errors.join('; '));
    observer = observer || { id: 'observer', kind: 'machine' };
    var frame = {
      schema: FRAME_SCHEMA,
      version: '0.1.0',
      worldId: state.id,
      worldDigest: state.worldDigest,
      observer: { id: text(observer.id || 'observer', 100), kind: text(observer.kind || 'machine', 30) },
      status: state.status,
      goal: state.goal,
      mode: state.mode,
      branch: state.branch,
      budgets: clone(state.budgets),
      usage: clone(state.usage),
      artifacts: state.artifacts.map(function (artifact) {
        return { id: artifact.id, kind: artifact.kind, title: artifact.title, summary: artifact.summary, status: artifact.status, inputs: artifact.inputs.slice(), evidenceCount: artifact.evidence.length, digest: artifact.digest };
      }),
      links: clone(state.links),
      recentEvents: clone(state.events.slice(-12)),
      capabilities: clone(state.capabilities),
      refusals: clone(state.refusals),
      truth: clone(state.truth)
    };
    frame.frameDigestAlgorithm = 'fnv1a32-stable-json';
    frame.frameDigest = digest(frame);
    return frame;
  }
  function checkpoint(state) {
    var check = validate(state);
    if (!check.ok) throw new Error('cannot checkpoint invalid experiment world: ' + check.errors.join('; '));
    var result = { schema: CHECKPOINT_SCHEMA, version: '0.1.0', world: clone(state), truth: { explicit: true, canonicalWorkshopChanged: false } };
    result.checkpointDigest = digest(result);
    return result;
  }
  function restore(candidate) {
    if (!candidate || candidate.schema !== CHECKPOINT_SCHEMA || !candidate.world) throw new Error('unsupported checkpoint');
    var expected = candidate.checkpointDigest;
    var clean = clone(candidate);
    delete clean.checkpointDigest;
    if (expected !== digest(clean)) throw new Error('checkpoint digest mismatch');
    var check = validate(candidate.world);
    if (!check.ok) throw new Error('checkpoint world invalid: ' + check.errors.join('; '));
    return clone(candidate.world);
  }

  return {
    WORLD_SCHEMA: WORLD_SCHEMA,
    INTENT_SCHEMA: INTENT_SCHEMA,
    FRAME_SCHEMA: FRAME_SCHEMA,
    CHECKPOINT_SCHEMA: CHECKPOINT_SCHEMA,
    ALLOWED_MODES: ALLOWED_MODES.slice(),
    ALLOWED_EFFECTS: ALLOWED_EFFECTS.slice(),
    BLOCKED_EFFECTS: BLOCKED_EFFECTS.slice(),
    create: create,
    validate: validate,
    applyIntent: applyIntent,
    pulseIntent: pulseIntent,
    runPulse: runPulse,
    observe: observe,
    checkpoint: checkpoint,
    restore: restore,
    digest: digest,
    stable: stable,
    clone: clone
  };
});
