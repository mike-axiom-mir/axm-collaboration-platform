'use strict';

const STATE_SCHEMA = 'axm.four-roots-adventure-state/v1';
const DIRECTIONS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
const ROOT_ORDER = Object.freeze(['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return Array.from(new Set(values)); }
function zoneById(content, id) { return content.zones.find((zone) => zone.id === id) || null; }
function actorById(content, id) {
  for (const zone of content.zones) {
    const actor = zone.actors.find((entry) => entry.id === id);
    if (actor) return { zone, actor };
  }
  return null;
}
function itemById(content, id) { return content.items.find((item) => item.id === id) || null; }
function rootById(content, id) { return content.roots.find((root) => root.id === id) || null; }

function validateRuntimeContent(content) {
  if (!content || content.schema !== 'axm.four-roots-adventure-content/v1' || content.status !== 'TEST') throw new Error('unsupported adventure content');
  if (!Array.isArray(content.zones) || content.zones.length !== 5 || !Array.isArray(content.roots) || content.roots.length !== 4) throw new Error('adventure content topology is incomplete');
  if (JSON.stringify(content).length > 262144) throw new Error('adventure content exceeds runtime byte ceiling');
  const zoneIds = new Set();
  const actorIds = new Set();
  for (const zone of content.zones) {
    if (!zone || typeof zone.id !== 'string' || zoneIds.has(zone.id)) throw new Error('zone ids must be unique');
    zoneIds.add(zone.id);
    if (!Array.isArray(zone.map) || zone.map.length !== 11 || zone.map.some((row) => typeof row !== 'string' || row.length !== 15 || !/^[.#~]+$/.test(row))) throw new Error('zone map is invalid: ' + zone.id);
    if (!Number.isInteger(zone.spawn?.x) || !Number.isInteger(zone.spawn?.y) || zone.map[zone.spawn.y]?.[zone.spawn.x] !== '.') throw new Error('zone spawn is invalid: ' + zone.id);
    if (!Array.isArray(zone.actors)) throw new Error('zone actors are missing');
    for (const actor of zone.actors) {
      if (!actor || typeof actor.id !== 'string' || actorIds.has(actor.id)) throw new Error('actor ids must be unique');
      actorIds.add(actor.id);
      if (!Number.isInteger(actor.x) || !Number.isInteger(actor.y) || zone.map[actor.y]?.[actor.x] !== '.') throw new Error('actor position is invalid: ' + actor.id);
    }
  }
  for (const zone of content.zones) for (const actor of zone.actors) if (actor.travel && !zoneIds.has(actor.travel.zoneId)) throw new Error('unknown travel zone: ' + actor.id);
  if (!zoneIds.has('crossroads') || content.roots.map((root) => root.id).join('|') !== ROOT_ORDER.join('|')) throw new Error('root order or crossroads identity drift');
  return content;
}

function createInitialState(content, contentDigest) {
  validateRuntimeContent(content);
  const start = zoneById(content, 'crossroads');
  return {
    schema: STATE_SCHEMA,
    contentDigest,
    zoneId: start.id,
    x: start.spawn.x,
    y: start.spawn.y,
    roots: [],
    flags: [],
    inventory: [],
    interactions: {},
    moves: 0,
    revision: 0,
    completed: false,
    lastActorId: null,
    message: content.introMessage
  };
}

function normalizeSavedState(content, contentDigest, value) {
  if (!value || value.schema !== STATE_SCHEMA || value.contentDigest !== contentDigest) throw new Error('save content lineage mismatch');
  const zone = zoneById(content, value.zoneId);
  if (!zone || !Number.isInteger(value.x) || !Number.isInteger(value.y) || zone.map[value.y]?.[value.x] !== '.') throw new Error('save position is invalid');
  if (!Array.isArray(value.roots) || value.roots.some((id) => !rootById(content, id)) || value.roots.join('|') !== ROOT_ORDER.slice(0, value.roots.length).join('|')) throw new Error('save root order is invalid');
  if (!Array.isArray(value.flags) || value.flags.some((entry) => typeof entry !== 'string') || !Array.isArray(value.inventory) || value.inventory.some((id) => !itemById(content, id))) throw new Error('save flags or inventory are invalid');
  if (!value.interactions || typeof value.interactions !== 'object' || Array.isArray(value.interactions)) throw new Error('save interactions are invalid');
  for (const [id, count] of Object.entries(value.interactions)) if (!actorById(content, id) || !Number.isSafeInteger(count) || count < 1 || count > 100000) throw new Error('save interaction record is invalid');
  if (!Number.isSafeInteger(value.moves) || value.moves < 0 || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.completed !== 'boolean' || (value.lastActorId !== null && !actorById(content, value.lastActorId)) || typeof value.message !== 'string' || value.message.length > 1000) throw new Error('save scalar fields are invalid');
  const normalized = {
    schema: STATE_SCHEMA, contentDigest, zoneId: zone.id, x: value.x, y: value.y,
    roots: unique(value.roots), flags: unique(value.flags), inventory: unique(value.inventory), interactions: clone(value.interactions),
    moves: value.moves, revision: value.revision, completed: value.completed, lastActorId: value.lastActorId, message: value.message
  };
  if (JSON.stringify(normalized) !== JSON.stringify(value)) throw new Error('save canonical shape is invalid');
  return normalized;
}

function hasAll(haystack, needles) { return needles.every((entry) => haystack.includes(entry)); }
function actorReady(state, actor) {
  return hasAll(state.flags, actor.requires.allFlags) && actor.requires.notFlags.every((flag) => !state.flags.includes(flag)) && hasAll(state.roots, actor.requires.allRoots) && hasAll(state.inventory, actor.requires.allItems);
}
function nearbyActors(content, state) {
  const zone = zoneById(content, state.zoneId);
  return zone.actors
    .map((actor) => ({ actor, distance: Math.abs(actor.x - state.x) + Math.abs(actor.y - state.y) }))
    .filter((entry) => entry.distance <= 1)
    .sort((left, right) => left.distance - right.distance || left.actor.id.localeCompare(right.actor.id));
}

function applyMove(content, state, direction) {
  const vector = DIRECTIONS[direction];
  if (!vector) throw new Error('unknown movement direction');
  const zone = zoneById(content, state.zoneId);
  const x = state.x + vector[0];
  const y = state.y + vector[1];
  const terrain = zone.map[y]?.[x];
  if (terrain !== '.') {
    state.message = terrain === '~' ? 'Water marks the broken route. Find the kept crossing.' : 'The path is closed here.';
    return state;
  }
  state.x = x;
  state.y = y;
  state.moves += 1;
  const nearby = nearbyActors(content, state)[0];
  state.message = nearby ? nearby.actor.label + ' is close enough to interact with.' : zone.subtitle;
  return state;
}

function applyInteraction(content, state) {
  const entry = nearbyActors(content, state)[0];
  if (!entry) {
    state.message = 'Nothing nearby asks for interaction.';
    state.lastActorId = null;
    return state;
  }
  const actor = entry.actor;
  state.lastActorId = actor.id;
  const previousCount = Number(state.interactions[actor.id] || 0);
  if (!actorReady(state, actor)) {
    state.message = previousCount > 0 ? actor.repeatMessage : actor.blockedMessage;
    return state;
  }
  for (const flag of actor.grants.flags) if (!state.flags.includes(flag)) state.flags.push(flag);
  for (const item of actor.grants.items) if (!state.inventory.includes(item)) state.inventory.push(item);
  for (const root of actor.grants.roots) {
    if (!state.roots.includes(root)) {
      const expected = ROOT_ORDER[state.roots.length];
      if (root !== expected) throw new Error('content attempted to grant roots out of order');
      state.roots.push(root);
    }
  }
  state.interactions[actor.id] = previousCount + 1;
  state.message = previousCount > 0 ? actor.repeatMessage : actor.message;
  if (actor.travel) {
    const destination = zoneById(content, actor.travel.zoneId);
    if (!destination || destination.map[actor.travel.y]?.[actor.travel.x] !== '.') throw new Error('content travel target became invalid');
    state.zoneId = destination.id;
    state.x = actor.travel.x;
    state.y = actor.travel.y;
  }
  if (actor.complete) state.completed = true;
  return state;
}

function applyAction(content, previous, input) {
  validateRuntimeContent(content);
  const state = clone(previous);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('action input must be an object');
  if (input.action === 'move') applyMove(content, state, input.direction);
  else if (input.action === 'interact') applyInteraction(content, state);
  else throw new Error('unknown action');
  state.revision += 1;
  return state;
}

function questComplete(state, quest) {
  return hasAll(state.flags, quest.conditions.allFlags) && hasAll(state.roots, quest.conditions.allRoots) && hasAll(state.inventory, quest.conditions.allItems) && (!quest.conditions.completed || state.completed);
}

function publicSnapshot(content, state, persistence) {
  const zone = zoneById(content, state.zoneId);
  const nearby = nearbyActors(content, state)[0]?.actor || null;
  return {
    schema: 'axm.four-roots-adventure-view/v1',
    release: { id: content.id, version: content.version, status: content.status, title: content.title, tagline: content.tagline, contentDigest: state.contentDigest },
    zone: { id: zone.id, name: zone.name, subtitle: zone.subtitle, accent: zone.accent, map: zone.map.slice(), actors: clone(zone.actors.map(({ requires, grants, travel, complete, message, repeatMessage, blockedMessage, ...actor }) => actor)) },
    player: { x: state.x, y: state.y },
    progress: {
      roots: content.roots.map((root) => ({ ...clone(root), acquired: state.roots.includes(root.id) })),
      inventory: state.inventory.map((id) => clone(itemById(content, id))),
      quests: content.quests.map((quest) => ({ id: quest.id, title: quest.title, description: quest.description, complete: questComplete(state, quest) })),
      moves: state.moves, completed: state.completed
    },
    interaction: nearby ? { available: true, actorId: nearby.id, label: nearby.label, kind: nearby.kind } : { available: false, actorId: null, label: null, kind: null },
    message: state.message,
    lastActorId: state.lastActorId,
    revision: state.revision,
    persistence: clone(persistence),
    ending: state.completed ? clone(content.ending) : null,
    authority: clone(content.authority),
    limitations: content.limitations.slice()
  };
}

module.exports = {
  STATE_SCHEMA, DIRECTIONS, ROOT_ORDER, clone, validateRuntimeContent, createInitialState, normalizeSavedState,
  zoneById, actorById, nearbyActors, actorReady, applyAction, questComplete, publicSnapshot
};
