#!/usr/bin/env node
'use strict';

const assert = require('assert');

const base = process.argv[2] || 'http://127.0.0.1:8803';
let sequence = 900000;

async function packet(route, options) {
  const response = await fetch(base + route, options);
  const value = await response.json();
  if (!response.ok) throw new Error(route + ' returned ' + response.status + ': ' + JSON.stringify(value));
  return value;
}
async function act(action) {
  const response = await fetch(base + '/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player: 'p1', action })
  });
  const value = await response.json();
  const terminalRace = !response.ok && ['victory', 'defeat'].includes(value.state?.phase);
  if (!response.ok && !terminalRace) {
    throw new Error('/api/action returned ' + response.status + ': ' + JSON.stringify(value));
  }
  return value;
}
function normalize(x, y) {
  const size = Math.hypot(x, y) || 1;
  return { x: x / size, y: y / size };
}
function nearest(state) {
  return state.enemies.slice().sort((left, right) =>
    Math.hypot(left.x - state.player.x, left.y - state.player.y) -
    Math.hypot(right.x - state.player.x, right.y - state.player.y)
  )[0] || null;
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async () => {
  const reset = await packet('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  sequence = Math.max(sequence, Number(reset.state?.lastInputSeq || 0) + 1);
  await act({ type: 'story-next' });
  await act({ type: 'story-next' });
  await act({ type: 'story-next' });
  await act({ type: 'start' });
  await act({ type: 'interact' });

  const started = Date.now();
  let lastReport = 0;
  let state;
  while (Date.now() - started < 180000) {
    state = (await packet('/api/state')).state;
    if (state.phase === 'victory' || state.phase === 'defeat') break;
    if (state.paused) await act({ type: 'pause' });
    if (state.phase === 'explore') {
      const toBeacon = normalize(state.beacon.x - state.player.x, state.beacon.y - state.player.y);
      const distanceToBeacon = Math.hypot(state.beacon.x - state.player.x, state.beacon.y - state.player.y);
      if (distanceToBeacon <= 180) await act({ type: 'interact' });
      else await act({ type: 'input', seq: sequence++, moveX: toBeacon.x, moveY: toBeacon.y, aimX: toBeacon.x, aimY: toBeacon.y, firing: false });
      await delay(48);
      continue;
    }
    const target = nearest(state);
    const aim = target ? normalize(target.x - state.player.x, target.y - state.player.y) : normalize(state.beacon.x - state.player.x, state.beacon.y - state.player.y);
    const targetDistance = target ? Math.hypot(target.x - state.player.x, target.y - state.player.y) : 0;
    const centerDistance = Math.hypot(state.beacon.x - state.player.x, state.beacon.y - state.player.y);
    let move = { x: 0, y: 0 };
    if (target && targetDistance > 260) move = normalize(target.x - state.player.x, target.y - state.player.y);
    else if (centerDistance > 190) move = normalize(state.beacon.x - state.player.x, state.beacon.y - state.player.y);
    else if (target && targetDistance < 80) move = normalize(state.player.x - target.x, state.player.y - target.y);
    const crowded = state.enemies.filter(enemy => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= 235).length;
    await act({
      type: 'input',
      seq: sequence++,
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      firing: !!target,
      dash: !!target && targetDistance > 430 && state.now >= state.dashReadyAt,
      pulse: crowded >= 2 && state.now >= state.pulseReadyAt
    });
    if (Date.now() - lastReport > 5000) {
      console.log(JSON.stringify({ phase: state.phase, wave: state.wave, enemies: state.enemies.length, beacon: Math.round(state.beacon.health), player: Math.round(state.player.health), score: state.score }));
      lastReport = Date.now();
    }
    await delay(48);
  }

  state = (await packet('/api/state')).state;
  console.log(JSON.stringify({ result: state.result, playerKills: state.player.kills, allyKills: state.ally.kills, playerShots: state.player.shots, elapsedMs: state.elapsedMs }));
  assert.strictEqual(state.phase, 'victory', 'semantic controller must be able to finish with a victory');
  assert.strictEqual(state.result.chronicle.clearedWatchIds.length, 5, 'victory must seal all five named watch receipts');
  assert.strictEqual(state.result.kills, 83, 'every authored watch slot must reconcile into the final kill count');
  assert(state.player.shots > 0, 'human semantic lane must fire');
  assert(state.player.kills > 0, 'human semantic lane must materially contribute a kill');
  console.log('Bloomvale live semantic driver: PASS');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
