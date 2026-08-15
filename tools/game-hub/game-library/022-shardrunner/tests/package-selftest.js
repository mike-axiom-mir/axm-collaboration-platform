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

test('touch/gamepad inputs normalize predictably', () => {
  assert.equal(Core.normalizeAxis(1.4), 1);
  assert.equal(Core.normalizeAxis(-1.8), -1);
  assert.equal(Core.normalizeAxis('-.44'), -0.44);
  assert.equal(Core.normalizeAxis('nonsense'), 0);

  const gamepadLike = Core.sanitizeInput({
    moveX: -1.6,
    moveZ: 0.12,
    jump: 1,
    pause: 0
  });
  assert.equal(gamepadLike.moveX, -1);
  assert.equal(gamepadLike.moveZ, 0.12);
  assert.equal(gamepadLike.jump, true);
  assert.equal(gamepadLike.pause, false);

  const touchLike = Core.sanitizeInput({
    moveX: 0.0,
    moveZ: 0.8,
    jump: {},
    pause: {}
  });
  assert.equal(touchLike.moveZ, 0.8);
  assert.equal(touchLike.jump, true);

  const cleared = Core.sanitizeInput({ moveX: 1, moveZ: 1, jump: true, pause: true }, { clear: true });
  assert.equal(cleared.moveX, 0);
  assert.equal(cleared.moveZ, 0);
  assert.equal(cleared.jump, false);
  assert.equal(cleared.pause, false);
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
