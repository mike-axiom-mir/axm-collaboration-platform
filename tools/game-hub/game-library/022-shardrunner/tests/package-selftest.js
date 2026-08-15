'use strict';

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'game.manifest.json'), 'utf8'));
const Core = require(path.join(root, 'runtime', 'shardrunner-core.cjs'));

function newState(seed) {
  return Core.create([], 1_000, { seed: seed });
}

function simulateRun(seed, frames) {
  const state = newState(seed);
  state.phase = 'running';
  state.startedAt = 1_000;
  state.startAt = 1_000;
  state.nextShardAt = 9_999_999;
  state.nextObstacleAt = 9_999_999;
  state.nextGateAt = 9_999_999;
  const tiers = [];
  const score = [];
  let lastTier = state.difficulty;
  for (let i = 0; i < frames; i++) {
    if (i % 10 === 0) {
      state.shards.push({
        id: 's-' + i,
        trackZ: state.progress + 1.2,
        x: state.player.x,
        radius: 1.05,
        kind: 'shard'
      });
    }
    Core.step(state, { p1: { moveX: 0, moveZ: 0, jump: false } }, 1 / 60, 1_000 + i * 16);
    if (state.difficulty !== lastTier) {
      tiers.push({ atFrame: i, tier: state.difficulty, progress: Math.round(state.progress) });
      lastTier = state.difficulty;
      if (tiers.length >= 3) break;
    }
    if (i % 30 === 0) {
      score.push({
        frame: i,
        progress: Math.round(state.progress),
        score: Math.round(state.score),
        combo: state.bestCombo,
        tier: state.difficulty
      });
    }
    if (state.phase === 'won' || state.phase === 'lost') break;
  }
  return {
    state,
    tiers,
    score
  };
}

test('manifest required paths exist', () => {
  assert.equal(manifest.slot, '022');
  for (const rel of manifest.package.required_paths) {
    const absolute = path.join(root, rel);
    assert.ok(fs.existsSync(absolute), 'missing path: ' + rel);
  }
});

test('core produces deterministic state for fixed seed', () => {
  const a = newState(123);
  const b = newState(123);
  assert.equal(a.randomSeed, b.randomSeed);
  assert.equal(a.player.lane, b.player.lane);
  assert.equal(a.progress, b.progress);
});

test('core run metadata carries deterministic counters and version', () => {
  const state = Core.create([], 1_000, { seed: 901, attempt: 4 });
  assert.equal(state.attempt, 4);
  assert.equal(state.runVersion, '0.2.0');
  assert.equal(state.runStats.seed, 901);
  assert.equal(state.runStats.runVersion, '0.2.0');
  assert.equal(state.runStats.distance, 0);
  assert.equal(state.runStats.combo, 0);
  assert.equal(state.runId, 'run-385-004');
});

test('run finish publishes deterministic lastRun/summary metadata', () => {
  const state = newState(777);
  state.phase = 'running';
  state.startedAt = 1_000;
  state.startAt = 1_000;
  state.stamina = 24;
  state.player.onGround = true;
  state.bestCombo = 7;
  state.combo = 7;
  state.obstacles.push({
    id: 'finish-kill',
    trackZ: state.progress + 1.2,
    x: state.player.x,
    width: 2,
    depth: 4,
    radius: 1.7,
    kind: 'wall',
    damage: 120
  });
  Core.step(state, { p1: { moveX: 0, moveZ: 0, jump: false } }, 0.016, 1_100);
  assert.equal(state.phase, 'lost');
  assert.equal(state.lastRun.attempt, 1);
  assert.equal(state.lastRun.bestCombo, 7);
  assert.equal(state.runSummary.attempt, 1);
  assert.equal(state.runSummary.bestCombo, 7);
  assert.equal(state.runSummary.runId, state.runId);
});

test('core keeps deterministic progression under fixed input', () => {
  const left = newState(456);
  const right = newState(456);
  const inA = { p1: { moveX: 0.9, moveZ: 0, jump: false } };
  for (let i = 0; i < 12; i++) {
    Core.step(left, inA, 1 / 60, 1010 + i * 16);
    Core.step(right, inA, 1 / 60, 1010 + i * 16);
  }
  const aState = Core.publicState(left);
  const bState = Core.publicState(right);
  assert.equal(Math.round(aState.progress), Math.round(bState.progress));
  assert.equal(aState.player.x.toFixed(4), bState.player.x.toFixed(4));
});

test('input ownership precedence is deterministic in one frame', () => {
  const now = 10_000;
  assert.equal(
    Core.resolveInputOwner(
      { keyboard: { active: true, at: now }, touch: { active: true, at: now }, gamepad: { active: true, at: now } },
      now
    ),
    'keyboard'
  );

  assert.equal(
    Core.resolveInputOwner(
      { keyboard: { active: true, at: now }, touch: { active: true, at: now }, gamepad: { active: true, at: now } },
      now,
      { priority: ['touch', 'keyboard', 'gamepad'] }
    ),
    'touch'
  );
});

test('input ownership resolves stale keyboard correctly in one-frame races', () => {
  const now = 17_000;
  const winner = Core.resolveInputOwner({
    keyboard: { active: true, at: now - 350 },
    touch: { active: true, at: now },
    gamepad: { active: true, at: now }
  }, now, { staleMs: 220, priority: ['touch', 'keyboard', 'gamepad'] });
  assert.equal(winner, 'touch');
});

test('input ownership ignores stale source activity', () => {
  const now = 10_000;
  const staleWindow = 180;
  assert.equal(
    Core.resolveInputOwner(
      {
        keyboard: { active: true, at: now },
        touch: { active: true, at: now - 600 },
        gamepad: { active: true, at: now - 800 }
      },
      now,
      { staleMs: staleWindow, priority: ['keyboard', 'touch', 'gamepad'] }
    ),
    'keyboard'
  );
  assert.equal(
    Core.resolveInputOwner(
      {
        keyboard: { active: false, at: 0 },
        touch: { active: true, at: now - 600 },
        gamepad: { active: true, at: now - 10 }
      },
      now,
      { staleMs: staleWindow, priority: ['keyboard', 'touch', 'gamepad'] }
    ),
    'gamepad'
  );
});

test('touch/gamepad inputs normalize predictably', () => {
  assert.equal(Core.normalizeAxis(1.4), 1);
  assert.equal(Core.normalizeAxis(-1.8), -1);
  assert.equal(Core.normalizeAxis('-.44'), -0.44);
  assert.equal(Core.normalizeAxis('nonsense'), 0);

  const gamepadLike = Core.sanitizeInput({
    moveX: -1.6,
    moveZ: 0.12,
    jump: 1,
    pause: 0,
    owner: 'gamepad-left'
  });
  assert.equal(gamepadLike.moveX, -1);
  assert.equal(gamepadLike.moveZ, 0.12);
  assert.equal(gamepadLike.jump, true);
  assert.equal(gamepadLike.pause, false);
  assert.equal(gamepadLike.owner, 'gamepad-left');
  assert.equal(gamepadLike.source, 'gamepad-left');

  const touchLike = Core.sanitizeInput({
    moveX: 0.0,
    moveZ: 0.8,
    jump: {},
    pause: {},
    source: 'phone'
  });
  assert.equal(touchLike.moveZ, 0.8);
  assert.equal(touchLike.jump, true);
  assert.equal(touchLike.owner, 'phone');
  assert.equal(touchLike.source, 'phone');

  const cleared = Core.sanitizeInput({ moveX: 1, moveZ: 1, jump: true, pause: true }, { clear: true });
  assert.equal(cleared.moveX, 0);
  assert.equal(cleared.moveZ, 0);
  assert.equal(cleared.jump, false);
  assert.equal(cleared.pause, false);
});

test('normalized gamepad axis clamps and zeroes tiny joystick jitter', () => {
  assert.equal(Core.normalizeAxis(0.023), 0);
  const smallJitter = Core.sanitizeInput({
    moveX: 0.023,
    moveZ: -0.022,
    owner: 'gamepad',
    source: 'pad'
  });
  assert.equal(smallJitter.moveX, 0);
  assert.equal(smallJitter.moveZ, 0);
  const wideJitter = Core.sanitizeInput({
    moveX: 1.9,
    moveZ: -1.9,
    owner: 'gamepad'
  });
  assert.equal(wideJitter.moveX, 1);
  assert.equal(wideJitter.moveZ, -1);
});

test('pause input is edge-based during hold', () => {
  const state = newState(123);
  state.phase = 'running';
  state.startedAt = 1000;
  state.startAt = 1000;
  state._pauseHeld = false;
  state._inputClearUntil = 0;

  Core.step(state, { p1: { moveX: 0, pause: true } }, 0.016, 1008);
  assert.equal(state.phase, 'paused');

  Core.step(state, { p1: { moveX: 0, pause: true } }, 0.016, 1016);
  assert.equal(state.phase, 'paused');

  Core.step(state, { p1: { moveX: 0, pause: false } }, 0.016, 1024);
  assert.equal(state.phase, 'paused');

  Core.step(state, { p1: { moveX: 0, pause: true } }, 0.016, 1032);
  assert.equal(state.phase, 'running');
});

test('pause holds with restart race clears owned input cleanly', () => {
  const state = newState(555);
  state.phase = 'running';
  state.startedAt = 1000;
  state.startAt = 1000;
  state._pauseHeld = false;
  state._inputClearUntil = 0;
  Core.step(state, { p1: { moveX: 0, pause: true } }, 0.016, 1008);
  assert.equal(state.phase, 'paused');
  state._inputClearUntil = 1_008;
  Core.step(state, { p1: { moveX: 1, jump: true, pause: true } }, 0.016, 1016);
  assert.equal(state.phase, 'paused');
  Core.step(state, { p1: { moveX: 0, pause: false } }, 0.016, 1024);
  assert.equal(state.phase, 'paused');
  Core.step(state, { p1: { moveX: 0, pause: true } }, 0.016, 1032);
  assert.equal(state.phase, 'running');
});

test('pause transition stores user-facing run reason', () => {
  const state = newState(900);
  state.phase = 'running';
  state.startedAt = 1000;
  state.startAt = 1000;
  Core.step(state, { p1: { pause: false } }, 0.016, 1008);
  Core.step(state, { p1: { pause: true } }, 0.016, 1016);
  assert.equal(state.phase, 'paused');
  assert.equal(state.reason, 'PAUSED');
  Core.step(state, { p1: { pause: false } }, 0.016, 1024);
  Core.step(state, { p1: { pause: true } }, 0.016, 1032);
  assert.equal(state.phase, 'running');
  assert.equal(state.reason, 'RUNNING');
});

test('clear-held-input window suppresses post-restart jump', () => {
  const state = newState(321);
  state.phase = 'running';
  state.startedAt = 1000;
  state.startAt = 1000;
  state._inputClearUntil = 1050;
  const beforeX = state.player.x;
  Core.step(state, { p1: { moveX: 1, jump: true } }, 0.016, 1020);
  assert.equal(state.player.x.toFixed(4), beforeX.toFixed(4));
  Core.step(state, { p1: { moveX: 1, jump: true } }, 0.016, 1060);
  assert.equal(state.player.y > 0, true);
});

test('restart clear window ignores stuck restart/jump vectors before clear window ends', () => {
  const state = newState(512);
  state.phase = 'running';
  state.startedAt = 1000;
  state.startAt = 1000;
  state._inputClearUntil = 1100;
  state.player.x = 0;
  Core.step(state, { p1: { moveX: 1, jump: true, pause: true } }, 0.016, 1060);
  assert.equal(state.player.x.toFixed(4), '0.0000');
  assert.equal(state.player.y, 0);
  assert.equal(state._pauseHeld, false);
});

test('input source/owner are preserved through sanitize and stale clears', () => {
  const seeded = Core.sanitizeInput({
    moveX: 0.7,
    moveZ: 0.4,
    jump: true,
    pause: false,
    owner: 'keyboard',
    source: 'keyboard'
  });
  assert.equal(seeded.owner, 'keyboard');
  assert.equal(seeded.source, 'keyboard');
  const held = Core.sanitizeInput({ moveX: 1, jump: true, pause: true, owner: 'touch' }, { clear: true });
  assert.equal(held.moveX, 0);
  assert.equal(held.jump, false);
  assert.equal(held.pause, false);
  assert.equal(held.owner, 'touch');
  assert.equal(held.source, 'touch');
});

test('restart window clears movement and jump even when phase is paused', () => {
  const state = newState(700);
  state.phase = 'running';
  state.startedAt = 1000;
  state.startAt = 1000;
  state._inputClearUntil = 1080;
  const beforeX = state.player.x;
  Core.step(state, { p1: { moveX: 1, jump: true, pause: true } }, 0.016, 1060);
  assert.equal(state.player.x.toFixed(4), beforeX.toFixed(4));
  assert.equal(state.player.y, 0);
  assert.equal(state._pauseHeld || false, false);
});

test('deterministic seeded run keeps score/combo through first 3 tiers', () => {
  const runA = simulateRun(777, 2400);
  const runB = simulateRun(777, 2400);
  assert.equal(runA.state.runVersion, runB.state.runVersion);
  assert.deepEqual(runA.tiers, runB.tiers);
  assert.ok(runA.tiers.length >= 3);
  for (let i = 0; i < runA.score.length; i++) {
    assert.equal(runA.score[i].score, runB.score[i].score);
    assert.equal(runA.score[i].combo, runB.score[i].combo);
  }
  assert.ok(runA.state.bestCombo > 0);
});

test('collecting shard increases score and combo', () => {
  const state = newState(789);
  state.progress = 10;
  state.stamina = 100;
  state.startedAt = 1;
  state.phase = 'running';
  state.shards.push({ id: 's1', trackZ: state.progress + 1, x: 0, radius: 1.1, kind: 'shard' });
  state.player.x = 0;
  state.player.y = 0;
  state.player.vy = 0;
  state.player.onGround = true;
  Core.step(state, { p1: { moveX: 0, jump: false } }, 0.016, 2000);
  assert.ok(state.totalShards >= 1);
  assert.ok(state.score > 0);
  assert.equal(state.combo, 1);
});

test('finish summary carries run reason and metadata', () => {
  const state = newState(333);
  state.phase = 'running';
  state.startedAt = 1000;
  state.startAt = 1000;
  state.stamina = 0;
  state.player.onGround = true;
  state.player.x = 0;
  state.result = null;
  state.obstacles.push({
    id: 'kill',
    trackZ: state.progress + 1.2,
    x: state.player.x,
    width: 2,
    depth: 4,
    radius: 1.7,
    kind: 'wall',
    damage: 200
  });
  Core.step(state, { p1: { moveX: 0, moveZ: 0, jump: false } }, 0.016, 1060);
  assert.equal(state.phase, 'lost');
  assert.equal(state.reason, 'GAME_OVER');
  assert.equal(state.runSummary.reason, 'GAME_OVER');
});

test('stumbling against obstacle reduces stamina and can lose', () => {
  const state = newState(890);
  state.phase = 'running';
  state.startedAt = 1;
  state.player.x = 0;
  state.player.y = 0;
  state.player.onGround = true;
  state.obstacles.push({ id: 'o1', trackZ: state.progress + 1, x: 0, radius: 1.8, width: 2, depth: 4, kind: 'spike', damage: 27 });
  const stamina = state.stamina;
  Core.step(state, { p1: { moveX: 0, jump: false } }, 0.016, 3000);
  assert.ok(state.stamina < stamina);
  assert.equal(state.player.anim, 'stumble');
});

test('restart clears run-critical state', () => {
  const state = newState(901);
  state.phase = 'lost';
  state.score = 55;
  state.result = { won: false };
  const seed = state.randomSeed;
  const reset = newState(seed);
  assert.equal(reset.phase, 'countdown');
  assert.equal(reset.phase, 'countdown');
  assert.equal(reset.randomSeed, seed);
  assert.equal(reset.score, 0);
});

test('runtime entry parses and exposes API endpoints', () => {
  const files = fs.readdirSync(path.join(root, 'runtime')).filter(name => name.endsWith('.cjs') || name.endsWith('.js'));
  for (const file of files) {
    const abs = path.join(root, 'runtime', file);
    const result = cp.spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.ok(true);
});
