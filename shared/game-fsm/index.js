'use strict';

const crypto = require('crypto');

const SCHEMA = 'axm.game-fsm/v1';
const TRACE_SCHEMA = 'axm.game-fsm-trace/v1';
const DEFAULT_TRACE_LIMIT = 200;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function list(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function transitionObject(value) { return typeof value === 'string' ? {target: value} : value; }

function validateDefinition(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {ok: false, errors: ['definition must be an object']};
  try { JSON.stringify(input); } catch (error) { errors.push('definition must be JSON-serializable'); }
  const walk = (value, path) => {
    if (typeof value === 'function') errors.push(`${path} embeds executable code; use a named handler`);
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${path}.${key}`));
  };
  walk(input, 'definition');
  if (input.schema !== SCHEMA) errors.push(`schema must be ${SCHEMA}`);
  if (!String(input.id || '').trim()) errors.push('id is required');
  if (!String(input.initial || '').trim()) errors.push('initial state is required');
  if (!input.states || typeof input.states !== 'object' || Array.isArray(input.states)) errors.push('states must be an object map');
  const states = input.states && typeof input.states === 'object' && !Array.isArray(input.states) ? input.states : {};
  if (!states[input.initial]) errors.push('initial state must exist');
  for (const [stateId, state] of Object.entries(states)) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) { errors.push(`state ${stateId} must be an object`); continue; }
    for (const name of [...list(state.enter), ...list(state.exit)]) if (typeof name !== 'string' || !name.trim()) errors.push(`state ${stateId} lifecycle handlers must be names`);
    for (const [event, raw] of Object.entries(state.on || {})) {
      const transition = transitionObject(raw);
      if (!transition || typeof transition !== 'object' || Array.isArray(transition)) { errors.push(`${stateId}.${event} transition is invalid`); continue; }
      if (!states[transition.target]) errors.push(`${stateId}.${event} targets missing state ${transition.target}`);
      for (const name of [...list(transition.guard), ...list(transition.action)]) if (typeof name !== 'string' || !name.trim()) errors.push(`${stateId}.${event} handlers must be names`);
    }
  }
  return {ok: errors.length === 0, errors};
}

function compileDefinition(input) {
  const result = validateDefinition(input);
  if (!result.ok) throw new TypeError(`Invalid game FSM: ${result.errors.join('; ')}`);
  return clone(input);
}

function createMachine(input, context = {}, handlers = {}, options = {}) {
  const definition = compileDefinition(input);
  const traceLimit = Math.max(1, Math.min(1000, Math.trunc(options.traceLimit || DEFAULT_TRACE_LIMIT)));
  const guards = handlers.guards || {};
  const actions = handlers.actions || {};
  let state = definition.initial;
  let sequence = 0;
  const trace = [];

  const getHandlers = (kind, names) => list(names).map((name) => {
    const source = kind === 'guard' ? guards : actions;
    if (typeof source[name] !== 'function') throw new Error(`Missing ${kind} handler: ${name}`);
    return {name, run: source[name]};
  });

  function record(entry) {
    trace.push(Object.assign({sequence: sequence += 1}, entry));
    if (trace.length > traceLimit) trace.splice(0, trace.length - traceLimit);
  }

  function inspect(event, payload) {
    const node = definition.states[state];
    const raw = node.on && node.on[event];
    if (!raw) return {status: 'IGNORED', node, transition: null, guards: []};
    const transition = transitionObject(raw);
    const resolved = getHandlers('guard', transition.guard);
    const envelope = {event, payload: clone(payload == null ? null : payload), from: state, to: transition.target, definition};
    const blockedBy = resolved.find((item) => !item.run(context, envelope));
    return {status: blockedBy ? 'BLOCKED' : 'READY', node, transition, guards: resolved.map((item) => item.name), blockedBy: blockedBy && blockedBy.name, envelope};
  }

  function can(event, payload) { return inspect(event, payload).status === 'READY'; }

  function send(event, payload) {
    const checked = inspect(event, payload);
    if (checked.status !== 'READY') {
      record({event, from: state, to: state, status: checked.status, blocked_by: checked.blockedBy || null});
      return state;
    }
    const from = state;
    const envelope = checked.envelope;
    getHandlers('action', checked.node.exit).forEach((item) => item.run(context, envelope));
    getHandlers('action', checked.transition.action).forEach((item) => item.run(context, envelope));
    state = checked.transition.target;
    getHandlers('action', definition.states[state].enter).forEach((item) => item.run(context, envelope));
    record({event, from, to: state, status: 'TRANSITIONED', clip: definition.states[state].meta && definition.states[state].meta.motion_block || null});
    return state;
  }

  return {
    schema: 'axm.game-fsm-runtime/v1',
    definition,
    context,
    get state() { return state; },
    can,
    send,
    meta() { return clone(definition.states[state].meta || {}); },
    trace() { return clone(trace); },
    traceEnvelope() {
      const envelope = {schema: TRACE_SCHEMA, machine_id: definition.id, definition_digest: digest(definition), current_state: state, events: clone(trace)};
      envelope.digest = `sha256:${digest(envelope)}`;
      return envelope;
    },
    reset() { state = definition.initial; sequence = 0; trace.length = 0; }
  };
}

function runTrace(definition, events, context = {}, handlers = {}) {
  const machine = createMachine(definition, clone(context), handlers);
  for (const item of events) machine.send(typeof item === 'string' ? item : item.event, typeof item === 'string' ? null : item.payload);
  return machine.traceEnvelope();
}

function toDiagram(input, activeState = null) {
  const definition = compileDefinition(input);
  const names = Object.keys(definition.states);
  const width = 640, height = 480, centerX = 320, centerY = 230, radius = 165, nodeRadius = 42;
  const positions = Object.fromEntries(names.map((name, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / names.length;
    return [name, {x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius}];
  }));
  let edges = '', nodes = '';
  for (const name of names) {
    for (const [event, raw] of Object.entries(definition.states[name].on || {})) {
      const target = transitionObject(raw).target;
      const a = positions[name], b = positions[target], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
      const ux = dx / length, uy = dy / length;
      const x1 = a.x + ux * nodeRadius, y1 = a.y + uy * nodeRadius, x2 = b.x - ux * (nodeRadius + 7), y2 = b.y - uy * (nodeRadius + 7);
      edges += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#43516c" fill="none" marker-end="url(#arrow)"/><text x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 - 5).toFixed(1)}" fill="#8fa0bd" text-anchor="middle" font-family="monospace" font-size="9">${event}</text>`;
    }
  }
  for (const name of names) {
    const point = positions[name], active = name === activeState, motion = definition.states[name].meta && definition.states[name].meta.motion_block || '';
    nodes += `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${nodeRadius}" fill="${active ? '#176b87' : '#182235'}" stroke="${active ? '#6ee7ff' : '#43516c'}" stroke-width="2"/><text x="${point.x.toFixed(1)}" y="${(point.y - 2).toFixed(1)}" fill="#fff" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700">${name}</text><text x="${point.x.toFixed(1)}" y="${(point.y + 14).toFixed(1)}" fill="#e6b450" text-anchor="middle" font-family="monospace" font-size="8">${motion}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#43516c"/></marker></defs><rect width="100%" height="100%" fill="#09111e"/><text x="20" y="28" fill="#fff" font-family="sans-serif" font-size="15" font-weight="700">${definition.id} · portable game FSM</text>${edges}${nodes}</svg>\n`;
}

const PLAYER_BODY = Object.freeze({
  schema: SCHEMA,
  id: 'player-body-example',
  initial: 'idle',
  states: {
    idle: {meta: {motion_block: 'idle-bob'}, on: {MOVE: 'walk', SPRINT: 'run', HIT: 'hit', DIE: 'defeat'}},
    walk: {meta: {motion_block: 'locomotion-walk'}, on: {STOP: 'idle', SPRINT: 'run', HIT: 'hit', DIE: 'defeat'}},
    run: {meta: {motion_block: 'locomotion-run'}, on: {STOP: 'idle', SLOW: 'walk', HIT: 'hit', DIE: 'defeat'}},
    hit: {meta: {motion_block: 'hit-pop'}, on: {RECOVER: 'idle', DIE: 'defeat'}},
    defeat: {meta: {motion_block: 'respawn-long-reach'}, on: {RESPAWN: 'idle'}}
  }
});

module.exports = {SCHEMA, TRACE_SCHEMA, PLAYER_BODY, validateDefinition, compileDefinition, createMachine, runTrace, toDiagram};
