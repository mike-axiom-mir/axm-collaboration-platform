#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Core = require('../runtime/game-core');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('createRng is deterministic for a given seed', () => {
  const a = Core.createRng(42);
  const b = Core.createRng(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepStrictEqual(seqA, seqB);
});

test('normalizePlayerCount clamps to 1-4', () => {
  assert.strictEqual(Core.normalizePlayerCount(0), 1);
  assert.strictEqual(Core.normalizePlayerCount(2), 2);
  assert.strictEqual(Core.normalizePlayerCount(9), 4);
  assert.strictEqual(Core.normalizePlayerCount(undefined), 1);
});

test('waveForElapsed walks wave 1 -> 2 -> 3 across a 9 minute session', () => {
  const sessionLengthMs = 9 * 60 * 1000;
  assert.strictEqual(Core.waveForElapsed(0, sessionLengthMs).wave, 1);
  assert.strictEqual(Core.waveForElapsed(sessionLengthMs * 0.2, sessionLengthMs).wave, 1);
  assert.strictEqual(Core.waveForElapsed(sessionLengthMs * 0.5, sessionLengthMs).wave, 2);
  assert.strictEqual(Core.waveForElapsed(sessionLengthMs * 0.9, sessionLengthMs).wave, 3);
  assert.strictEqual(Core.waveForElapsed(sessionLengthMs, sessionLengthMs).wave, 3);
});

test('maxConcurrentFaults never exceeds crew size (fair difficulty, not oversubscription)', () => {
  // v0.1.0 let wave 3 spawn one MORE fault than there were players to cover
  // it, for every crew size — mathematically unwinnable regardless of
  // skill. Rebalanced: wave 1 gives one fewer slot than the full crew as
  // breathing room; waves 2-3 cap at exactly crew size, never above it.
  assert.strictEqual(Core.maxConcurrentFaults(1, 1), 1);
  assert.strictEqual(Core.maxConcurrentFaults(4, 1), 3);
  assert.strictEqual(Core.maxConcurrentFaults(4, 2), 4);
  assert.strictEqual(Core.maxConcurrentFaults(4, 3), 4);
  for (let players = 1; players <= 4; players += 1) {
    for (let wave = 1; wave <= 3; wave += 1) {
      assert.ok(Core.maxConcurrentFaults(players, wave) <= players, `wave ${wave} at ${players} players must never oversubscribe the crew`);
    }
  }
  assert.ok(Core.maxConcurrentFaults(9, 3) <= 6, 'never exceeds station count');
});

test('an active Bulkhead fault blocks new spawns once it uses up the crew\'s full capacity', () => {
  // Regression test for the 2-player win-rate collapse the bot sim found:
  // a Bulkhead (crew2) fault costs 2 capacity, not 1. For a 2-player crew
  // (cap == 2 from wave 2 on), an active Bulkhead fault must leave zero
  // room for anything else to spawn alongside it — otherwise that second
  // fault is guaranteed to expire untouched since both players are pinned
  // to the Bulkhead.
  const state = Core.createInitialState({ seed: 4, sessionMinutes: 9, playerCount: 2 });
  state.elapsedMs = state.sessionLengthMs * 0.5; // land inside wave 2, crewEnabled
  state.faults = [{ id: 100, stationId: 'bulkhead', verb: 'crew2', kind: 'real', effort: 0, spawnedAt: state.elapsedMs, ringMs: 5000, beatAnchorMs: state.elapsedMs }];
  state.lastSpawnAt = state.elapsedMs;
  state.nextSpawnInterval = 0; // spawner would fire immediately if capacity allowed it

  for (let i = 0; i < 20; i += 1) {
    Core.tick(state, 100, {});
    assert.strictEqual(state.faults.length, 1, 'no second fault should spawn while Bulkhead saturates a 2-player crew\'s capacity');
  }
});

test('solo play (1 player) never spawns an unresolvable Bulkhead fault', () => {
  // Regression test: a crew2 fault requires two players holding together,
  // which is mathematically impossible with one active player. Run a full
  // 12-minute session (all three waves, crewEnabled from wave 2 on) across
  // several seeds and confirm 'bulkhead' never appears in the fault log.
  for (let seed = 0; seed < 8; seed += 1) {
    const state = Core.createInitialState({ seed, sessionMinutes: 12, playerCount: 1 });
    const seenStations = new Set();
    while (state.status === 'running') {
      Core.tick(state, 250, {});
      state.faults.forEach(f => seenStations.add(f.stationId));
    }
    assert.ok(!seenStations.has('bulkhead'), `seed ${seed} spawned a Bulkhead fault in solo play`);
  }
});

test('a fault spawns within the wave-1 interval window for a fresh session', () => {
  const state = Core.createInitialState({ seed: 1, sessionMinutes: 9, playerCount: 4 });
  let spawned = false;
  for (let i = 0; i < 200 && !spawned; i += 1) {
    Core.tick(state, 50, {});
    if (state.faults.length > 0) spawned = true;
  }
  assert.ok(spawned, 'expected at least one fault to spawn within 10 simulated seconds');
});

test('an unresolved real fault damages hull and resets streak on expiry', () => {
  const state = Core.createInitialState({ seed: 7, sessionMinutes: 9, playerCount: 1 });
  state.currentStreak = 3;
  state.faults = [{ id: 999, stationId: 'engine-bay', verb: 'mash', kind: 'real', effort: 0, spawnedAt: state.elapsedMs, ringMs: 500, beatAnchorMs: state.elapsedMs }];
  const startHull = state.hull;
  // No inputs supplied, so the fault is never fed and must expire after ringMs.
  Core.tick(state, 600, {});
  assert.strictEqual(state.hull, startHull - 9);
  assert.strictEqual(state.stats.missed, 1);
  assert.strictEqual(state.currentStreak, 0);
});

test('feeding a mash fault at the right station resolves it and grants hull + streak', () => {
  const state = Core.createInitialState({ seed: 3, sessionMinutes: 9, playerCount: 1 });
  const station = Core.STATIONS.find(s => s.id === 'engine-bay');
  const pos = Core.stationPosition(station);
  state.players.p1.x = pos.x;
  state.players.p1.y = pos.y;
  state.faults = [{ id: 1, stationId: 'engine-bay', verb: 'mash', kind: 'real', effort: 0, spawnedAt: state.elapsedMs, ringMs: 7000, beatAnchorMs: state.elapsedMs }];
  state.hull = 90; // start below the cap so a successful regen is actually observable
  const startHull = state.hull;

  // Mash: repeated action-key edges, one per tick.
  for (let i = 0; i < 12 && state.faults.length > 0; i += 1) {
    Core.tick(state, 100, { p1: { moveX: 0, moveY: 0, action: true, actionEdge: true } });
  }
  assert.strictEqual(state.faults.length, 0, 'fault should be resolved and removed');
  assert.strictEqual(state.stats.resolved, 1);
  assert.strictEqual(state.currentStreak, 1);
  assert.ok(state.hull > startHull, 'hull should regen on a successful resolve');
});

test('a two-crew (bulkhead) fault cannot be resolved by one player alone', () => {
  const state = Core.createInitialState({ seed: 5, sessionMinutes: 9, playerCount: 2 });
  const station = Core.STATIONS.find(s => s.id === 'bulkhead');
  const pos = Core.stationPosition(station);
  state.players.p1.x = pos.x;
  state.players.p1.y = pos.y;
  state.players.p2.x = pos.x + 300; // p2 is far away, not present
  state.players.p2.y = pos.y + 300;
  state.faults = [{ id: 2, stationId: 'bulkhead', verb: 'crew2', kind: 'real', effort: 0, spawnedAt: state.elapsedMs, ringMs: 5000, beatAnchorMs: state.elapsedMs }];

  for (let i = 0; i < 40; i += 1) {
    Core.tick(state, 100, {
      p1: { moveX: 0, moveY: 0, action: true, actionEdge: i === 0 },
      p2: { moveX: 0, moveY: 0, action: false, actionEdge: false }
    });
  }
  const remaining = state.faults.find(f => f.id === 2);
  assert.ok(remaining, 'a solo-held bulkhead fault must still be unresolved');
  assert.strictEqual(remaining.effort, 0, 'effort must not accumulate from a single holder');
});

test('a two-crew (bulkhead) fault resolves once two players hold together', () => {
  const state = Core.createInitialState({ seed: 5, sessionMinutes: 9, playerCount: 2 });
  const station = Core.STATIONS.find(s => s.id === 'bulkhead');
  const pos = Core.stationPosition(station);
  state.players.p1.x = pos.x;
  state.players.p1.y = pos.y;
  state.players.p2.x = pos.x;
  state.players.p2.y = pos.y;
  state.faults = [{ id: 3, stationId: 'bulkhead', verb: 'crew2', kind: 'real', effort: 0, spawnedAt: state.elapsedMs, ringMs: 5000, beatAnchorMs: state.elapsedMs }];

  for (let i = 0; i < 40 && state.faults.length > 0; i += 1) {
    Core.tick(state, 100, {
      p1: { moveX: 0, moveY: 0, action: true, actionEdge: false },
      p2: { moveX: 0, moveY: 0, action: true, actionEdge: false }
    });
  }
  assert.strictEqual(state.faults.length, 0, 'fault should resolve once both crew hold together');
  assert.strictEqual(state.stats.resolved, 1);
});

test('resolving a false-alarm fault costs hull instead of granting it', () => {
  const state = Core.createInitialState({ seed: 9, sessionMinutes: 9, playerCount: 1 });
  const station = Core.STATIONS.find(s => s.id === 'radio');
  const pos = Core.stationPosition(station);
  state.players.p1.x = pos.x;
  state.players.p1.y = pos.y;
  state.faults = [{ id: 4, stationId: 'radio', verb: 'mash', kind: 'false', effort: 0, spawnedAt: state.elapsedMs, ringMs: 5000, beatAnchorMs: state.elapsedMs }];
  const startHull = state.hull;

  for (let i = 0; i < 12 && state.faults.length > 0; i += 1) {
    Core.tick(state, 100, { p1: { moveX: 0, moveY: 0, action: true, actionEdge: true } });
  }
  assert.strictEqual(state.stats.falseAlarmsMisresolved, 1);
  assert.ok(state.hull < startHull, 'a mis-resolved false alarm should cost hull');
});

test('letting a false-alarm fault expire is the correct play and costs nothing', () => {
  const state = Core.createInitialState({ seed: 9, sessionMinutes: 9, playerCount: 1 });
  state.faults = [{ id: 5, stationId: 'radio', verb: 'mash', kind: 'false', effort: 0, spawnedAt: state.elapsedMs, ringMs: 400, beatAnchorMs: state.elapsedMs }];
  const startHull = state.hull;
  Core.tick(state, 500, {});
  assert.strictEqual(state.hull, startHull);
  assert.strictEqual(state.stats.falseAlarmsAvoided, 1);
  assert.strictEqual(state.currentStreak, 0, 'ignoring a false alarm is not a scoring event either way');
});

test('session ends in "won" once elapsed time reaches the chosen length with hull remaining', () => {
  const state = Core.createInitialState({ seed: 11, sessionMinutes: 6, playerCount: 1 });
  Core.tick(state, state.sessionLengthMs + 100, {});
  assert.strictEqual(state.status, 'won');
  assert.ok(state.summary, 'a finished session must produce a result summary');
  assert.strictEqual(state.summary.outcome, 'won');
});

test('session ends in "lost" once hull reaches zero, with a matching summary', () => {
  const state = Core.createInitialState({ seed: 13, sessionMinutes: 9, playerCount: 1 });
  state.hull = 5;
  state.faults = [{ id: 6, stationId: 'engine-bay', verb: 'mash', kind: 'real', effort: 0, spawnedAt: state.elapsedMs, ringMs: 100, beatAnchorMs: state.elapsedMs }];
  Core.tick(state, 200, {});
  assert.strictEqual(state.status, 'lost');
  assert.strictEqual(state.hull, 0);
  assert.strictEqual(state.summary.outcome, 'lost');
});

test('result summary carries the full expected shape', () => {
  const state = Core.createInitialState({ seed: 21, sessionMinutes: 6, playerCount: 3 });
  Core.tick(state, state.sessionLengthMs + 1, {});
  const summary = state.summary;
  ['outcome', 'finalHull', 'resolved', 'missed', 'falseAlarmsAvoided', 'falseAlarmsMisresolved', 'bestStreak', 'durationMs', 'playerCount']
    .forEach(key => assert.ok(Object.prototype.hasOwnProperty.call(summary, key), `summary missing "${key}"`));
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log(`\n${tests.length - failed}/${tests.length} passed`);
if (failed > 0) process.exit(1);
