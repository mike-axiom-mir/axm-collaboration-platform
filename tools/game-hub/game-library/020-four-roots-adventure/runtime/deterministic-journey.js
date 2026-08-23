'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Json = require('../../../../deterministic-json-core');
const Engine = require('./game-engine');

const SCHEMA = 'axm.four-roots-adventure-gameplay-replay/v1';
const VERSION = '1.0.0';
const CONTENT_PATH = 'tools/game-hub/game-library/020-four-roots-adventure/content/adventure-content.v0.2.json';
const ENGINE_PATH = 'tools/game-hub/game-library/020-four-roots-adventure/runtime/game-engine.js';
const EXPECTED_CONTENT = Object.freeze({
  id: 'four-roots-adventure-content-v0.2',
  schema: 'axm.four-roots-adventure-content/v1',
  path: CONTENT_PATH,
  sha256: 'sha256:fa5e159f6d7266bd4f3881983e567ae2cce21ca339ac26e7921912439f02dd8d',
  byteLength: 25693
});
const EXPECTED_ENGINE = Object.freeze({
  id: 'four-roots-adventure-engine-v0.2',
  schema: 'commonjs-module',
  path: ENGINE_PATH,
  sha256: 'sha256:03e9fa179208868df943591a0b5f17fb58a53df4666b6530f21dfc4c8a9159a9',
  byteLength: 10785
});
const ACTOR_SEQUENCE = Object.freeze([
  'archivist-luma', 'agency-path', 'truth-path', 'clear-witness', 'echo-witness', 'keeper-verity', 'truth-return',
  'agency-path', 'north-lantern', 'middle-lantern', 'south-lantern', 'keeper-iora', 'agency-return',
  'continuity-path', 'memory-before', 'memory-after', 'memory-bridge', 'keeper-anamnesis', 'continuity-return',
  'wisdom-path', 'still-pool', 'dissent-tree', 'consequence-stone', 'keeper-serein', 'wisdom-return', 'workshop-gate'
]);
const DIRECTIONS = Object.freeze([['up', 0, -1], ['left', -1, 0], ['right', 1, 0], ['down', 0, 1]]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Json.canonicalJson(value); }
function hashBytes(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function hashValue(value) { return hashBytes(Buffer.from(canonical(value), 'utf8')); }
function normalizedBytes(file) { return Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n'), 'utf8'); }
function exactRef(expected, file) {
  const bytes = normalizedBytes(file);
  const observed = { ...expected, sha256: hashBytes(bytes), byteLength: bytes.length };
  if (observed.sha256 !== expected.sha256 || observed.byteLength !== expected.byteLength) throw new Error(expected.id + ' byte lineage drift');
  return observed;
}
function key(x, y) { return x + ',' + y; }
function pathTo(content, state, targetX, targetY) {
  const zone = Engine.zoneById(content, state.zoneId);
  const queue = [{ x: state.x, y: state.y, moves: [] }];
  const seen = new Set([key(state.x, state.y)]);
  while (queue.length) {
    const current = queue.shift();
    if (current.x === targetX && current.y === targetY) return current.moves;
    for (const [direction, dx, dy] of DIRECTIONS) {
      const x = current.x + dx, y = current.y + dy;
      if (zone.map[y]?.[x] !== '.' || seen.has(key(x, y))) continue;
      seen.add(key(x, y));
      queue.push({ x, y, moves: current.moves.concat(direction) });
    }
  }
  throw new Error('no deterministic path to ' + targetX + ',' + targetY + ' in ' + zone.id);
}
function sampleEven(entries, count) {
  if (!Array.isArray(entries) || entries.length < 2 || count < 2) throw new Error('replay segment lacks source-state motion: ' + (Array.isArray(entries) ? entries.length : 'not-array') + ' for ' + count);
  return Array.from({ length: count }, (_, index) => entries[Math.floor(index * (entries.length - 1) / (count - 1))]);
}
function checkpoint(entry, sceneIndex, phase) {
  const state = entry.state;
  return {
    id: 'scene-' + sceneIndex + '-phase-' + phase,
    sceneIndex,
    phase,
    actionIndex: entry.actionIndex,
    stateDigest: entry.stateDigest,
    zoneId: state.zoneId,
    x: state.x,
    y: state.y,
    roots: state.roots.slice(),
    inventoryCount: state.inventory.length,
    completed: state.completed,
    lastActorId: state.lastActorId,
    message: state.message
  };
}

function build(content, contentDigest) {
  Engine.validateRuntimeContent(content);
  if (contentDigest !== EXPECTED_CONTENT.sha256) throw new Error('replay content digest drift');
  const gameRoot = path.resolve(__dirname, '..');
  const contentRef = exactRef(EXPECTED_CONTENT, path.join(gameRoot, 'content', 'adventure-content.v0.2.json'));
  const engineRef = exactRef(EXPECTED_ENGINE, path.join(gameRoot, 'runtime', 'game-engine.js'));
  let state = Engine.createInitialState(content, contentDigest);
  const actions = [];
  const states = [{ actionIndex: -1, stateDigest: hashValue(state), state: clone(state), targetActorId: null }];
  const visitedZones = new Set([state.zoneId]);

  function apply(input, targetActorId) {
    if (actions.length >= 256) throw new Error('replay action budget exceeded');
    const beforeStateDigest = hashValue(state);
    const next = Engine.applyAction(content, state, input);
    const afterStateDigest = hashValue(next);
    const record = { index: actions.length, targetActorId, input: clone(input), beforeStateDigest, afterStateDigest };
    actions.push(record);
    state = next;
    visitedZones.add(state.zoneId);
    states.push({ actionIndex: record.index, stateDigest: afterStateDigest, state: clone(state), targetActorId });
  }
  function interact(actorId) {
    const entry = Engine.actorById(content, actorId);
    if (!entry || entry.zone.id !== state.zoneId) throw new Error('actor is unavailable in replay state: ' + actorId);
    for (const direction of pathTo(content, state, entry.actor.x, entry.actor.y)) apply({ action: 'move', direction }, actorId);
    if (state.x !== entry.actor.x || state.y !== entry.actor.y) throw new Error('replay failed to reach actor: ' + actorId);
    apply({ action: 'interact' }, actorId);
    if (state.lastActorId !== actorId) throw new Error('replay interacted with unexpected actor: ' + actorId);
  }

  for (const actorId of ACTOR_SEQUENCE) interact(actorId);
  if (!state.completed || state.roots.join('|') !== Engine.ROOT_ORDER.join('|') || state.inventory.length !== 10 || state.moves !== 202) throw new Error('complete replay outcome drift');

  const actionFor = (actorId, occurrence) => {
    const matches = actions.filter((entry) => entry.targetActorId === actorId && entry.input.action === 'interact');
    if (!matches[occurrence]) throw new Error('missing replay interaction marker: ' + actorId);
    return matches[occurrence].index;
  };
  const firstTruthTravel = actionFor('truth-path', 0);
  const finalReturn = actionFor('wisdom-return', 0);
  const earlyCrossroads = states.filter((entry) => entry.actionIndex < firstTruthTravel && entry.state.zoneId === 'crossroads');
  const truth = states.filter((entry) => entry.state.zoneId === 'truth-hollow');
  const agency = states.filter((entry) => entry.state.zoneId === 'agency-garden');
  const continuity = states.filter((entry) => entry.state.zoneId === 'continuity-archive');
  const wisdom = states.filter((entry) => entry.state.zoneId === 'wisdom-grove');
  const finalCrossroads = states.filter((entry) => entry.actionIndex >= finalReturn && entry.state.zoneId === 'crossroads');
  const selected = [
    ...sampleEven(earlyCrossroads, 8).map((entry, phase) => ({ entry, sceneIndex: 1, phase })),
    ...sampleEven(truth, 8).map((entry, phase) => ({ entry, sceneIndex: 2, phase })),
    ...sampleEven(agency, 8).map((entry, phase) => ({ entry, sceneIndex: 3, phase })),
    ...sampleEven(continuity, 4).map((entry, phase) => ({ entry, sceneIndex: 4, phase })),
    ...sampleEven(wisdom, 4).map((entry, phase) => ({ entry, sceneIndex: 4, phase: phase + 4 })),
    ...sampleEven(finalCrossroads, 8).map((entry, phase) => ({ entry, sceneIndex: 5, phase }))
  ];
  const checkpoints = selected.map(({ entry, sceneIndex, phase }) => checkpoint(entry, sceneIndex, phase));
  const phaseStates = new Map(selected.map(({ entry, sceneIndex, phase }) => [sceneIndex + ':' + phase, clone(entry.state)]));
  const finalView = Engine.publicSnapshot(content, state, { mode: 'TEST', contentBound: true, reload: 'RESUME', restart: 'RESUME', resetAvailable: true });
  const core = {
    schema: SCHEMA,
    version: VERSION,
    status: 'TEST',
    id: 'four-roots-adventure-complete-replay-v0.1',
    contentRef,
    engineRef,
    recipe: { id: 'four-roots-complete-journey-v1', actorSequence: ACTOR_SEQUENCE.slice(), pathOrder: DIRECTIONS.map((entry) => entry[0]) },
    actions,
    checkpoints,
    summary: {
      actions: actions.length,
      moves: state.moves,
      interactionAttempts: actions.filter((entry) => entry.input.action === 'interact').length,
      recordedInteractions: Object.values(state.interactions).reduce((sum, count) => sum + count, 0),
      zonesVisited: Array.from(visitedZones),
      roots: state.roots.slice(),
      inventory: state.inventory.length,
      completedQuests: finalView.progress.quests.filter((quest) => quest.complete).length,
      ending: finalView.ending.title,
      completed: state.completed
    },
    resources: { maxActions: 256, actions: actions.length, maxCheckpoints: 40, checkpoints: checkpoints.length, maxRecordBytes: 262144, childProcesses: 0, networkRequests: 0, enforced: true },
    truth: { nativeGameEngineExecuted: true, deterministicReplay: true, reconstructedFramesPlanned: true, browserCapture: false, livePlayerInput: false, providerCalled: false, aiUsed: false, published: false, canonChanged: false },
    rights: { internalWorkshopReview: 'MIKE_AUTHORIZED_TEST', publicDistribution: 'HOLD' },
    authority: 'NONE'
  };
  const record = { ...core, replayDigest: hashValue(core) };
  const recordBytes = Buffer.byteLength(JSON.stringify(record, null, 2) + '\n', 'utf8');
  if (recordBytes > core.resources.maxRecordBytes) throw new Error('replay record byte budget exceeded');
  return { record, recordBytes, states, phaseStates, finalState: clone(state), finalView };
}

function verify(record, content, contentDigest) {
  try {
    const rebuilt = build(content, contentDigest);
    return canonical(record) === canonical(rebuilt.record)
      ? { pass: true, errors: [], recordBytes: rebuilt.recordBytes }
      : { pass: false, errors: ['replay differs from deterministic native-engine rebuild'] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

module.exports = {
  SCHEMA, VERSION, CONTENT_PATH, ENGINE_PATH, EXPECTED_CONTENT, EXPECTED_ENGINE, ACTOR_SEQUENCE, DIRECTIONS,
  clone, canonical, hashBytes, hashValue, pathTo, sampleEven, build, verify
};
