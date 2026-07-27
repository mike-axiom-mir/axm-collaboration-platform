const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);

const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value, label) => {
  const result = String(value || '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  return result;
};
const finite = (value, label) => {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new TypeError(`${label} must be finite`);
  return result;
};
const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
};

function normalizeCondition(input, parameters, triggers) {
  if (input?.trigger) {
    const trigger = text(input.trigger, 'transition trigger');
    if (!triggers.has(trigger)) throw new Error(`missing trigger ${trigger}`);
    return { trigger };
  }
  if (input?.complete === true) return { complete: true };
  if (input?.state_time_gte_ms != null) return { state_time_gte_ms: finite(input.state_time_gte_ms, 'state time') };
  if (input?.parameter) {
    const parameter = text(input.parameter, 'transition parameter');
    const definition = parameters.get(parameter);
    if (!definition) throw new Error(`missing parameter ${parameter}`);
    const op = input.op || 'eq';
    if (!OPS.has(op)) throw new Error(`unsupported condition operator ${op}`);
    if (typeof input.value !== definition.type) throw new TypeError(`condition ${parameter} value must be ${definition.type}`);
    return { parameter, op, value: input.value };
  }
  throw new TypeError('transition conditions must be explicit');
}

export function compileAnimationGraph(input) {
  if (!input || typeof input !== 'object') throw new TypeError('animation graph must be an object');
  const id = text(input.id, 'graph id');
  const parameterList = Object.entries(input.parameters || {}).map(([parameterId, definition]) => {
    const type = definition?.type || typeof definition?.default;
    if (!['boolean', 'number', 'string'].includes(type) || typeof definition.default !== type) throw new TypeError(`parameter ${parameterId} has an invalid default`);
    return { id: parameterId, type, default: definition.default };
  });
  const parameters = new Map(parameterList.map((item) => [item.id, item]));
  const triggers = new Set((input.triggers || []).map((item) => text(item, 'trigger id')));
  if (triggers.size !== (input.triggers || []).length) throw new Error('trigger ids must be unique');

  const states = (input.states || []).map((raw) => {
    const stateId = text(raw.id, 'state id');
    const duration = finite(raw.duration_ms, `state ${stateId} duration`);
    if (duration <= 0) throw new RangeError(`state ${stateId} duration must be positive`);
    const events = (raw.events || []).map((event) => ({
      id: text(event.id, `state ${stateId} event id`),
      at_ms: finite(event.at_ms, `state ${stateId} event time`),
      kind: String(event.kind || 'gameplay'),
      payload: clone(event.payload || {})
    })).sort((a, b) => a.at_ms - b.at_ms || a.id.localeCompare(b.id));
    if (events.some((event) => event.at_ms < 0 || event.at_ms > duration)) throw new RangeError(`state ${stateId} has an event outside its clip`);
    if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error(`state ${stateId} event ids must be unique`);
    return {
      id: stateId,
      clip: text(raw.clip, `state ${stateId} clip`),
      duration_ms: duration,
      loop: raw.loop !== false,
      playback_rate: finite(raw.playback_rate ?? 1, `state ${stateId} playback rate`),
      locomotion_mps: finite(raw.locomotion_mps ?? 0, `state ${stateId} locomotion speed`),
      tags: [...new Set((raw.tags || []).map(String))].sort(),
      events
    };
  });
  if (!states.length) throw new Error('animation graph needs states');
  const stateIds = new Set(states.map((state) => state.id));
  if (stateIds.size !== states.length) throw new Error('state ids must be unique');
  const initialState = text(input.initial_state, 'initial state');
  if (!stateIds.has(initialState)) throw new Error(`initial state ${initialState} is missing`);

  const transitions = (input.transitions || []).map((raw) => {
    const transition = {
      id: text(raw.id, 'transition id'), from: raw.from === '*' ? '*' : text(raw.from, 'transition from'), to: text(raw.to, 'transition to'),
      priority: Math.trunc(finite(raw.priority ?? 0, 'transition priority')),
      duration_ms: finite(raw.duration_ms ?? 140, 'transition duration'),
      interruptible: raw.interruptible !== false,
      conditions: (raw.conditions || []).map((condition) => normalizeCondition(condition, parameters, triggers))
    };
    if (transition.from !== '*' && !stateIds.has(transition.from)) throw new Error(`transition ${transition.id} has a missing source`);
    if (!stateIds.has(transition.to)) throw new Error(`transition ${transition.id} has a missing target`);
    if (transition.from === transition.to) throw new Error(`transition ${transition.id} targets itself`);
    if (!transition.conditions.length) throw new Error(`transition ${transition.id} needs a condition`);
    if (transition.duration_ms < 0 || transition.duration_ms > 2000) throw new RangeError(`transition ${transition.id} blend is outside 0-2000ms`);
    return transition;
  }).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  if (new Set(transitions.map((transition) => transition.id)).size !== transitions.length) throw new Error('transition ids must be unique');

  return freeze({
    schema: 'axm.game-animation-graph/v1', id, initial_state: initialState,
    parameters: Object.fromEntries(parameterList.map((item) => [item.id, item])),
    triggers: [...triggers].sort(), states, transitions,
    human_visual_review: { required: true, approved: false }
  });
}

function compare(actual, op, expected) {
  if (op === 'eq') return actual === expected;
  if (op === 'neq') return actual !== expected;
  if (op === 'gt') return actual > expected;
  if (op === 'gte') return actual >= expected;
  if (op === 'lt') return actual < expected;
  if (op === 'lte') return actual <= expected;
  return false;
}

function crossedEvents(state, previous, next) {
  if (next <= previous) return [];
  if (!state.loop) return state.events.filter((event) => event.at_ms > previous && event.at_ms <= next);
  const result = [];
  for (let loop = Math.floor(previous / state.duration_ms); loop <= Math.floor(next / state.duration_ms); loop += 1) {
    for (const event of state.events) {
      const absolute = loop * state.duration_ms + event.at_ms;
      if (absolute > previous && absolute <= next) result.push(event);
    }
  }
  return result;
}

export function createAnimationController(compiled) {
  const graph = compiled?.schema === 'axm.game-animation-graph/v1' ? compiled : compileAnimationGraph(compiled);
  const states = new Map(graph.states.map((state) => [state.id, state]));
  const parameters = Object.fromEntries(Object.entries(graph.parameters).map(([id, definition]) => [id, definition.default]));
  const pendingTriggers = new Set();
  let stateId = graph.initial_state, stateTimeMs = 0, blend = null, tick = 0;

  const conditionPasses = (condition, completed) => {
    if (condition.trigger) return pendingTriggers.has(condition.trigger);
    if (condition.complete) return completed;
    if (condition.state_time_gte_ms != null) return stateTimeMs >= condition.state_time_gte_ms;
    return compare(parameters[condition.parameter], condition.op, condition.value);
  };
  const snapshot = (events = [], started = null, rootMotion = 0) => {
    const state = states.get(stateId);
    const progress = blend ? Math.min(1, blend.elapsed_ms / Math.max(1, blend.duration_ms)) : 1;
    return {
      schema: 'axm.game-animation-frame/v1', tick, state: stateId, clip: state.clip, state_time_ms: stateTimeMs,
      normalized_time: state.loop ? (stateTimeMs % state.duration_ms) / state.duration_ms : Math.min(1, stateTimeMs / state.duration_ms),
      blend: blend ? { from: blend.from, to: blend.to, progress, from_weight: 1 - progress, to_weight: progress, duration_ms: blend.duration_ms } : null,
      transition_started: started, events, root_motion_meters: rootMotion,
      human_visual_review: graph.human_visual_review
    };
  };

  return Object.freeze({
    graph,
    setParameter(id, value) {
      const definition = graph.parameters[id];
      if (!definition) throw new Error(`unknown animation parameter ${id}`);
      if (typeof value !== definition.type) throw new TypeError(`animation parameter ${id} must be ${definition.type}`);
      parameters[id] = value;
    },
    trigger(id) {
      if (!graph.triggers.includes(id)) throw new Error(`unknown animation trigger ${id}`);
      pendingTriggers.add(id);
    },
    update(deltaMs) {
      const delta = finite(deltaMs, 'animation delta');
      if (delta < 0 || delta > 1000) throw new RangeError('animation delta must stay between 0 and 1000ms');
      tick += 1;
      const state = states.get(stateId), previous = stateTimeMs;
      stateTimeMs = state.loop ? stateTimeMs + delta * state.playback_rate : Math.min(state.duration_ms, stateTimeMs + delta * state.playback_rate);
      const events = crossedEvents(state, previous, stateTimeMs).map((event) => ({ ...clone(event), state: stateId }));
      const completed = !state.loop && stateTimeMs >= state.duration_ms;
      if (blend) {
        blend.elapsed_ms = Math.min(blend.duration_ms, blend.elapsed_ms + delta);
        if (blend.elapsed_ms >= blend.duration_ms) blend = null;
      }
      const transition = graph.transitions.find((candidate) => (candidate.from === '*' || candidate.from === stateId) && (!blend || candidate.interruptible) && candidate.conditions.every((condition) => conditionPasses(condition, completed)));
      let started = null;
      if (transition) {
        const from = stateId;
        stateId = transition.to;
        stateTimeMs = 0;
        blend = transition.duration_ms ? { from, to: stateId, duration_ms: transition.duration_ms, elapsed_ms: 0 } : null;
        started = { id: transition.id, from, to: stateId, duration_ms: transition.duration_ms };
        events.push({ id: 'state-exit', kind: 'lifecycle', state: from, payload: { to: stateId } });
        events.push({ id: 'state-enter', kind: 'lifecycle', state: stateId, payload: { from } });
      }
      pendingTriggers.clear();
      return snapshot(events, started, state.locomotion_mps * delta / 1000);
    },
    snapshot: () => snapshot(),
    parameters: () => clone(parameters)
  });
}

export function matchSemanticClips(clips) {
  const available = (clips || []).map((clip) => ({ name: text(clip.name, 'clip name'), duration_ms: Math.max(1, Math.round(finite(clip.duration, `clip ${clip.name} duration`) * 1000)) }));
  const patterns = { idle: /idle/i, stand: /standing/i, walk: /walk(?!ingjump)/i, run: /(?:^|[|_ -])run(?:$|[|_ -])/i, jump: /jump/i, action: /punch|slash|attack|interact/i, emote: /clap|wave|cheer|dance/i, hit: /hit|hurt|damage|stun/i, defeat: /death|defeat|knockout/i, recover: /recover|getup|standing/i };
  const result = {};
  for (const [semantic, pattern] of Object.entries(patterns)) {
    const match = available.find((clip) => pattern.test(clip.name));
    if (match) result[semantic] = match;
  }
  if (!result.idle && result.stand) result.idle = result.stand;
  if (!result.idle && available[0]) result.idle = available[0];
  return result;
}

const phaseEvent = (id, phase, duration, kind = 'gameplay') => ({ id, at_ms: Math.round(duration * phase), kind });

export function buildHumanoidGameplayGraph(clips, options = {}) {
  const semantic = matchSemanticClips(clips);
  if (!semantic.idle) throw new Error('humanoid graph needs at least one clip');
  const states = [];
  const addState = (id, clip, config = {}) => { if (clip) states.push({ id, clip: clip.name, duration_ms: clip.duration_ms, ...config }); };
  addState('idle', semantic.idle, { loop: true, tags: ['idle'] });
  addState('walk', semantic.walk, { loop: true, locomotion_mps: options.walk_mps ?? 1.15, tags: ['locomotion'], events: [phaseEvent('foot-left', .18, semantic.walk?.duration_ms, 'contact'), phaseEvent('foot-right', .68, semantic.walk?.duration_ms, 'contact')] });
  addState('run', semantic.run, { loop: true, locomotion_mps: options.run_mps ?? 3.2, tags: ['locomotion'], events: [phaseEvent('foot-left', .14, semantic.run?.duration_ms, 'contact'), phaseEvent('foot-right', .62, semantic.run?.duration_ms, 'contact')] });
  addState('emote', semantic.emote, { loop: false, tags: ['action', 'emote'], events: [phaseEvent('emote-accent', .48, semantic.emote?.duration_ms)] });
  addState('action', semantic.action, { loop: false, tags: ['action'], events: [phaseEvent('action-impact', .45, semantic.action?.duration_ms, 'impact')] });
  addState('hit', semantic.hit, { loop: false, tags: ['reaction'], events: [phaseEvent('hit-react', .2, semantic.hit?.duration_ms, 'impact')] });
  addState('defeat', semantic.defeat, { loop: false, tags: ['terminal', 'defeat'] });
  if (semantic.recover?.name !== semantic.idle.name) addState('recover', semantic.recover, { loop: false, tags: ['recovery'] });
  const has = (id) => states.some((state) => state.id === id), transitions = [];
  const add = (id, from, to, conditions, priority, duration_ms) => { if (has(to) && (from === '*' || has(from))) transitions.push({ id, from, to, conditions, priority, duration_ms }); };
  add('idle-to-walk', 'idle', 'walk', [{ parameter: 'speed', op: 'gt', value: .12 }], 20, 180);
  add('walk-to-idle', 'walk', 'idle', [{ parameter: 'speed', op: 'lte', value: .12 }], 25, 190);
  add('walk-to-run', 'walk', 'run', [{ parameter: 'speed', op: 'gt', value: 2.2 }], 30, 170);
  add('run-to-walk', 'run', 'walk', [{ parameter: 'speed', op: 'lte', value: 2.2 }, { parameter: 'speed', op: 'gt', value: .12 }], 30, 180);
  add('run-to-idle', 'run', 'idle', [{ parameter: 'speed', op: 'lte', value: .12 }], 35, 210);
  add('emote-trigger', '*', 'emote', [{ trigger: 'emote' }], 60, 120);
  add('emote-complete', 'emote', 'idle', [{ complete: true }], 50, 180);
  add('action-trigger', '*', 'action', [{ trigger: 'action' }], 70, 90);
  add('action-complete', 'action', 'idle', [{ complete: true }], 50, 150);
  add('hit-trigger', '*', 'hit', [{ trigger: 'hit' }], 80, 70);
  add('hit-complete', 'hit', 'idle', [{ complete: true }], 50, 140);
  add('defeat-trigger', '*', 'defeat', [{ trigger: 'defeat' }], 100, 100);
  add('recover-trigger', 'defeat', 'recover', [{ trigger: 'recover' }], 110, 220);
  add('recover-complete', 'recover', 'idle', [{ complete: true }], 50, 180);
  return compileAnimationGraph({ id: options.id || 'axm.humanoid-gameplay.default', initial_state: 'idle', parameters: { speed: { type: 'number', default: 0 }, grounded: { type: 'boolean', default: true } }, triggers: ['action', 'defeat', 'emote', 'hit', 'recover'], states, transitions });
}
