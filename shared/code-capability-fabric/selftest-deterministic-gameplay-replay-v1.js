'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Replay = require('../../tools/game-hub/game-library/020-four-roots-adventure/runtime/deterministic-journey');

const content = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', Replay.CONTENT_PATH), 'utf8'));
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function build() { return Replay.build(content, Replay.EXPECTED_CONTENT.sha256); }

test('replay schema closes every declared object boundary', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'four-roots-gameplay-replay.schema.json'), 'utf8'));
  assert.strictEqual(schema.additionalProperties, false);
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object' && node.properties) assert.strictEqual(node.additionalProperties, false);
    Object.values(node).forEach(walk);
  };
  walk(schema);
});

test('exact content and trusted engine bytes are lineage-bound', () => {
  const result = build();
  assert.deepStrictEqual(result.record.contentRef, Replay.EXPECTED_CONTENT);
  assert.deepStrictEqual(result.record.engineRef, Replay.EXPECTED_ENGINE);
  assert(!result.record.contentRef.path.includes('\\'));
  assert(!result.record.engineRef.path.includes('\\'));
});

test('identical inputs produce byte-identical replay records', () => {
  const first = build(), second = build();
  assert.strictEqual(Replay.canonical(first.record), Replay.canonical(second.record));
  assert.strictEqual(first.record.replayDigest, second.record.replayDigest);
  assert.deepStrictEqual(Replay.verify(first.record, content, Replay.EXPECTED_CONTENT.sha256).pass, true);
});

test('all 228 actions form an unbroken state-digest chain', () => {
  const actions = build().record.actions;
  assert.strictEqual(actions.length, 228);
  actions.forEach((entry, index) => {
    assert.strictEqual(entry.index, index);
    if (index > 0) assert.strictEqual(entry.beforeStateDigest, actions[index - 1].afterStateDigest);
  });
});

test('the real engine reaches the exact complete adventure outcome', () => {
  const result = build();
  assert.deepStrictEqual(result.record.summary, {
    actions: 228, moves: 202, interactionAttempts: 26, recordedInteractions: 25,
    zonesVisited: ['crossroads', 'truth-hollow', 'agency-garden', 'continuity-archive', 'wisdom-grove'],
    roots: ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'],
    inventory: 10, completedQuests: 6, ending: 'A Door Into Review', completed: true
  });
});

test('the blocked Agency attempt stays before Truth and cannot travel', () => {
  const result = build();
  const action = result.record.actions.find((entry) => entry.targetActorId === 'agency-path' && entry.input.action === 'interact');
  const state = result.states.find((entry) => entry.actionIndex === action.index).state;
  assert.strictEqual(state.zoneId, 'crossroads');
  assert.deepStrictEqual(state.roots, []);
  assert.match(state.message, /refuses to skip Truth/);
});

test('40 byte-bound checkpoints cover all five zones and five gameplay scenes', () => {
  const result = build(), checkpoints = result.record.checkpoints;
  assert.strictEqual(checkpoints.length, 40);
  assert.deepStrictEqual(Array.from(new Set(checkpoints.map((entry) => entry.sceneIndex))), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(Array.from(new Set(checkpoints.map((entry) => entry.zoneId))), ['crossroads', 'truth-hollow', 'agency-garden', 'continuity-archive', 'wisdom-grove']);
  for (const entry of checkpoints) {
    const source = result.states.find((state) => state.actionIndex === entry.actionIndex && state.stateDigest === entry.stateDigest);
    assert(source, 'checkpoint has no exact replay source state');
    assert.strictEqual(source.state.x, entry.x);
    assert.strictEqual(source.state.y, entry.y);
  }
});

test('forged action, checkpoint, and replay digests fail reconstruction', () => {
  for (const mutate of [
    (value) => { value.actions[10].input.direction = 'down'; },
    (value) => { value.checkpoints[5].x += 1; },
    (value) => { value.replayDigest = 'sha256:' + '0'.repeat(64); }
  ]) {
    const value = clone(build().record); mutate(value);
    assert.strictEqual(Replay.verify(value, content, Replay.EXPECTED_CONTENT.sha256).pass, false);
  }
});

test('root, authority, rights, and provider truth cannot drift silently', () => {
  for (const mutate of [
    (value) => { value.summary.roots.reverse(); },
    (value) => { value.authority = 'HOST'; },
    (value) => { value.rights.publicDistribution = 'ALLOW'; },
    (value) => { value.truth.providerCalled = true; }
  ]) {
    const value = clone(build().record); mutate(value);
    assert.strictEqual(Replay.verify(value, content, Replay.EXPECTED_CONTENT.sha256).pass, false);
  }
});

test('replay resource declarations are measured and enforced', () => {
  const result = build(), resources = result.record.resources;
  assert.deepStrictEqual(resources, {maxActions:256,actions:228,maxCheckpoints:40,checkpoints:40,maxRecordBytes:262144,childProcesses:0,networkRequests:0,enforced:true});
  assert(result.recordBytes > 0 && result.recordBytes <= resources.maxRecordBytes);
});

test('the replay distinguishes reconstruction from capture or live input', () => {
  assert.deepStrictEqual(build().record.truth, {nativeGameEngineExecuted:true,deterministicReplay:true,reconstructedFramesPlanned:true,browserCapture:false,livePlayerInput:false,providerCalled:false,aiUsed:false,published:false,canonChanged:false});
});

process.stdout.write('Deterministic gameplay replay selftest passed: ' + passed + ' cases.\n');
