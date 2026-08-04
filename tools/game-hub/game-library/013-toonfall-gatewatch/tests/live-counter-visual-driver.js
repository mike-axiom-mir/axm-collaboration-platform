#!/usr/bin/env node
'use strict';

const base = String(process.argv[2] || 'http://127.0.0.1:8804').replace(/\/$/, '');
const requestedMode = process.argv[3];
const mode = requestedMode === 'hit' || requestedMode === 'shot' ? requestedMode : 'armed';
const timeoutMs = Math.max(5000, Number(process.argv[4]) || 24000);

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function direction(dx, dy) {
  const size = Math.hypot(dx, dy) || 1;
  return { x: dx / size, y: dy / size };
}
async function json(route, options) {
  const response = await fetch(base + route, options);
  const value = await response.json();
  if (!response.ok) throw new Error(route + ' returned ' + response.status + ': ' + JSON.stringify(value));
  return value;
}
async function act(action) {
  return json('/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player: 'p1', action })
  });
}

(async () => {
  await json('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  await act({ type: 'story-next' });
  await act({ type: 'story-next' });
  await act({ type: 'story-next' });
  await act({ type: 'start' });
  await act({ type: 'interact' });

  let armedSeen = false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const packet = await json('/api/state');
    const state = packet.state;
    const counterActive = state.counterReadyUntil > state.now;
    const counterShot = state.projectiles.find(projectile => projectile.counter);
    const counterHit = state.effects.slice().reverse().find(effect => effect.type === 'counter-hit');
    if (counterActive) armedSeen = true;
    if ((mode === 'armed' && counterActive) || (mode === 'shot' && armedSeen && counterShot) || (mode === 'hit' && armedSeen && counterHit)) {
      await act({ type: 'pause' });
      await sleep(80);
      const finalState = (await json('/api/state')).state;
      console.log(JSON.stringify({
        mode,
        now: finalState.now,
        player: { x: finalState.player.x, y: finalState.player.y, health: finalState.player.health },
        score: finalState.score,
        perfectDodges: finalState.perfectDodges,
        counterRemainingMs: Math.max(0, finalState.counterReadyUntil - finalState.now),
        counterProjectile: finalState.projectiles.find(projectile => projectile.counter) || null,
        counterHit: finalState.effects.slice().reverse().find(effect => effect.type === 'counter-hit') || null,
        latestEvents: finalState.events.slice(-4).map(event => event.type)
      }));
      return;
    }

    const living = state.enemies.filter(enemy => enemy.health > 0);
    const incoming = living
      .filter(enemy => enemy.windupTargetId === 'p1' && enemy.windupUntil > state.now)
      .sort((left, right) => left.windupUntil - right.windupUntil)[0];
    const nearest = living
      .map(enemy => ({ enemy, distance: Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) }))
      .sort((left, right) => left.distance - right.distance)[0];
    let move = { x: 0, y: 0 };
    let aim = { x: state.player.facingX || 1, y: state.player.facingY || 0 };
    let dash = false;
    let firing = false;

    if (counterActive && (mode === 'hit' || mode === 'shot') && nearest) {
      aim = mode === 'shot'
        ? direction(state.player.x - nearest.enemy.x, state.player.y - nearest.enemy.y)
        : direction(nearest.enemy.x - state.player.x, nearest.enemy.y - state.player.y);
      firing = true;
    } else if (incoming) {
      move = direction(state.player.x - incoming.x, state.player.y - incoming.y);
      aim = direction(incoming.x - state.player.x, incoming.y - state.player.y);
      dash = state.now >= state.dashReadyAt;
    } else if (nearest) {
      move = direction(nearest.enemy.x - state.player.x, nearest.enemy.y - state.player.y);
      aim = move;
    }

    await act({ type: 'input', seq: state.lastInputSeq + 1, moveX: move.x, moveY: move.y, aimX: aim.x, aimY: aim.y, firing, dash });
    await sleep(45);
  }
  throw new Error('Timed out before producing a ' + mode + ' Prism Counter frame.');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
