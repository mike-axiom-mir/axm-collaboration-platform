#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../runtime/game-core');
const verifier = require('../../../game-package-verifier');

const gameDir = path.resolve(__dirname, '..');
const checks = [];
function test(name, fn) {
  fn();
  checks.push(name);
  console.log('PASS', name);
}
function fresh(now = 100) {
  return core.createInitialState([{ seat_id: 'seat-real', display_name: 'Pippa', type: 'human' }], { seed: 13013, now });
}
function enterWave(state, now = 500) {
  core.applyAction(state, 'p1', { type: 'story-next' }, now - 40);
  core.applyAction(state, 'p1', { type: 'story-next' }, now - 30);
  core.applyAction(state, 'p1', { type: 'story-next' }, now - 20);
  core.applyAction(state, 'p1', { type: 'start' }, now);
  core.applyAction(state, 'p1', { type: 'interact' }, now + 10);
  return state;
}

test('initial state is deterministic and valid', () => {
  assert.deepStrictEqual(fresh(), fresh());
  assert.deepStrictEqual(core.validate(fresh()), { pass: true, errors: [] });
});

test('roster admits exactly one human and keeps Moxie outside the seat map', () => {
  const roster = core.normalizeRoster([
    { seat_id: 'human-a', display_name: 'Mike', type: 'human' },
    { seat_id: 'human-b', display_name: 'Second Human', type: 'human' },
    { seat_id: 'bot', display_name: 'Foreign Bot', type: 'ai' }
  ]);
  const state = core.createInitialState(roster, { now: 1, seed: 4 });
  assert.strictEqual(roster.length, 1);
  assert.strictEqual(roster[0].name, 'Mike');
  assert.strictEqual(state.roster.length, 1);
  assert.strictEqual(state.ally.id, 'moxie');
  assert.strictEqual(state.ally.kind, 'ai-companion');
  assert.deepStrictEqual(state.truth, { stateAuthority: 'managed-local-server', humanSeats: 1, aiCompanions: 1, splitScreen: false, internetRequired: false });
});

test('three story advances reach briefing and open Bloomvale exploration', () => {
  const state = fresh();
  assert.strictEqual(core.STORY.length, 3);
  core.applyAction(state, 'p1', { type: 'story-next' }, 200);
  core.applyAction(state, 'p1', { type: 'story-next' }, 210);
  const finalStory = core.applyAction(state, 'p1', { type: 'story-next' }, 220);
  assert.strictEqual(finalStory.phase, core.PHASES.BRIEFING);
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'start' }, 230).ok, true);
  assert.strictEqual(state.phase, core.PHASES.EXPLORE);
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'interact' }, 240).interaction, 'wave-start');
  assert.strictEqual(state.phase, core.PHASES.WAVE);
  assert.strictEqual(state.wave, 1);
  assert.strictEqual(state.waveTarget, 8);
});

test('expanded Bloomvale exposes five districts, five neighbors, four activities, and six unlocks', () => {
  const state = fresh();
  assert.strictEqual(core.DISTRICTS.length, 5);
  assert.strictEqual(core.NPCS.length, 5);
  assert.strictEqual(core.COLOR_WISPS.length, 10);
  assert.strictEqual(core.PRACTICE_TARGETS.length, 6);
  assert.strictEqual(Object.keys(core.UNLOCKS).length, 6);
  assert.strictEqual(state.npcs.length, 5);
  assert.strictEqual(state.colorWisps.length, 10);
  assert.strictEqual(state.practiceTargets.length, 6);
  Object.values(core.UNLOCKS).forEach(unlock => {
    assert(unlock.progress && unlock.progress.goal > 0);
    assert(unlock.progress.label);
  });
});

test('meeting neighbors grants the field map, Moxie overclock, and Heart Pocket', () => {
  const state = fresh();
  core.applyAction(state, 'p1', { type: 'story-next' }, 110);
  core.applyAction(state, 'p1', { type: 'story-next' }, 120);
  core.applyAction(state, 'p1', { type: 'story-next' }, 130);
  core.applyAction(state, 'p1', { type: 'start' }, 140);
  core.NPCS.forEach((npc, index) => {
    state.player.x = npc.x;
    state.player.y = npc.y;
    assert.strictEqual(core.applyAction(state, 'p1', { type: 'interact' }, 150 + index).ok, true);
  });
  assert.strictEqual(state.exploration.metNpcIds.length, 5);
  assert(core.hasUnlock(state, 'field-map'));
  assert(core.hasUnlock(state, 'moxie-overclock'));
  assert(core.hasUnlock(state, 'heart-pocket'));
  assert.strictEqual(state.player.maxHealth, 125);
  assert(state.exploration.completedActivityIds.includes('meet-the-neighbors'));
});

test('district loop and color-wisp trail produce progress and stat-changing unlocks', () => {
  const state = fresh();
  core.applyAction(state, 'p1', { type: 'story-next' }, 110);
  core.applyAction(state, 'p1', { type: 'story-next' }, 120);
  core.applyAction(state, 'p1', { type: 'story-next' }, 130);
  core.applyAction(state, 'p1', { type: 'start' }, 140);
  core.DISTRICTS.forEach((district, index) => {
    state.player.x = district.x;
    state.player.y = district.y;
    core.step(state, 50, 200 + index * 50);
  });
  core.COLOR_WISPS.slice(0, 4).forEach((wisp, index) => {
    state.player.x = wisp.x;
    state.player.y = wisp.y;
    core.step(state, 50, 500 + index * 50);
  });
  assert.strictEqual(state.exploration.visitedDistrictIds.length, 5);
  assert.strictEqual(state.exploration.collectedWispIds.length, 4);
  assert(core.hasUnlock(state, 'trailblazer-boots'));
  assert(core.hasUnlock(state, 'chroma-reserve'));
  assert.strictEqual(state.beacon.maxHealth, core.CONFIG.beaconHealth + 40);
  assert(state.exploration.completedActivityIds.includes('district-loop'));
});

test('Patch range targets can be painted and unlock stronger Prism Paint shots', () => {
  const state = fresh();
  core.applyAction(state, 'p1', { type: 'story-next' }, 110);
  core.applyAction(state, 'p1', { type: 'story-next' }, 120);
  core.applyAction(state, 'p1', { type: 'story-next' }, 130);
  core.applyAction(state, 'p1', { type: 'start' }, 140);
  for (let index = 0; index < 5; index += 1) {
    const target = state.practiceTargets[index];
    state.player.x = target.x - 72;
    state.player.y = target.y;
    state.player.lastShotAt = -99999;
    state.projectiles = [];
    core.applyAction(state, 'p1', { type: 'input', seq: index + 1, aimX: 1, firing: true }, 1000 + index * 100);
    core.step(state, 50, 1000 + index * 100);
  }
  assert.strictEqual(state.exploration.paintedTargetIds.length, 5);
  assert(core.hasUnlock(state, 'prism-paint'));
  assert(state.exploration.completedActivityIds.includes('range-trial'));
});

test('semantic input rejects stale sequence numbers and unknown actors', () => {
  const state = enterWave(fresh());
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: 1, moveX: 1, aimX: .6, aimY: .8 }, 600).ok, true);
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: 1, moveX: -1 }, 601).reason, 'stale-sequence');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: 2, aimX: 1, aimY: 0 }, 602).ok, true);
  assert.strictEqual(state.input.aimY, 0, 'a zero aim axis must replace, not inherit, the prior diagonal component');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: Infinity }, 603).reason, 'invalid-sequence');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: 3.5 }, 604).reason, 'invalid-sequence');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: core.CONFIG.maxInputSeq + 1 }, 605).reason, 'invalid-sequence');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: state.lastInputSeq + core.CONFIG.maxInputSeqGap + 1 }, 606).reason, 'sequence-gap-too-large');
  assert.strictEqual(state.lastInputSeq, 2, 'rejected sequences must not poison the accepted counter');
  assert.strictEqual(core.applyAction(state, 'p2', { type: 'input', seq: 3 }, 603).reason, 'unknown-actor');
});

test('authoritative time is monotonic and validation rejects poisoned counters', () => {
  const state = fresh(500);
  core.applyAction(state, 'p1', { type: 'story-next' }, 100);
  assert.strictEqual(state.now, 500);
  const active = enterWave(fresh(500), 700);
  core.step(active, 50, 650);
  assert.strictEqual(active.now, 710);
  const poisonedSequence = fresh();
  poisonedSequence.lastInputSeq = Infinity;
  assert.strictEqual(core.validate(poisonedSequence).pass, false);
  assert(core.validate(poisonedSequence).errors.includes('input sequence invalid'));
  const poisonedTime = fresh();
  poisonedTime.now = Infinity;
  assert.strictEqual(core.validate(poisonedTime).pass, false);
  assert(core.validate(poisonedTime).errors.includes('authoritative time invalid'));
});

test('multi-seed action stress preserves monotonic, finite, bounded state', () => {
  function unit(x, y) {
    const size = Math.hypot(x, y) || 1;
    return { x: x / size, y: y / size };
  }
  for (let seed = 1; seed <= 12; seed += 1) {
    let randomState = seed >>> 0;
    const random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    const state = enterWave(fresh(1000 + seed), 2000 + seed);
    let clock = state.now;
    for (let tick = 0; tick < 2600 && ![core.PHASES.VICTORY, core.PHASES.DEFEAT].includes(state.phase); tick += 1) {
      const before = state.now;
      if (tick % 127 === 0) {
        const accepted = state.lastInputSeq;
        assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: Infinity }, clock).reason, 'invalid-sequence');
        assert.strictEqual(state.lastInputSeq, accepted);
      }
      if (tick % 313 === 0) {
        const accepted = state.lastInputSeq;
        const gap = accepted + core.CONFIG.maxInputSeqGap + 1;
        assert.strictEqual(core.applyAction(state, 'p1', { type: 'input', seq: gap }, clock).reason, 'sequence-gap-too-large');
        assert.strictEqual(state.lastInputSeq, accepted);
      }
      if (state.phase === core.PHASES.EXPLORE) {
        const towardBeacon = unit(state.beacon.x - state.player.x, state.beacon.y - state.player.y);
        if (Math.hypot(state.beacon.x - state.player.x, state.beacon.y - state.player.y) <= 180) {
          core.applyAction(state, 'p1', { type: 'interact' }, clock);
        } else {
          core.applyAction(state, 'p1', { type: 'input', seq: state.lastInputSeq + 1, moveX: towardBeacon.x, moveY: towardBeacon.y, aimX: towardBeacon.x, aimY: towardBeacon.y }, clock);
        }
      } else {
        const target = state.enemies.slice().sort((left, right) => Math.hypot(left.x - state.player.x, left.y - state.player.y) - Math.hypot(right.x - state.player.x, right.y - state.player.y))[0];
        const aim = target ? unit(target.x - state.player.x, target.y - state.player.y) : unit(state.beacon.x - state.player.x, state.beacon.y - state.player.y);
        const drift = unit(random() - .5, random() - .5);
        core.applyAction(state, 'p1', {
          type: 'input',
          seq: state.lastInputSeq + 1,
          moveX: drift.x,
          moveY: drift.y,
          aimX: aim.x,
          aimY: aim.y,
          firing: !!target,
          dash: tick % 41 === 0,
          pulse: tick % 173 === 0
        }, tick % 211 === 0 ? clock - 500 : clock);
      }
      clock += 50;
      core.step(state, 50, tick % 503 === 0 ? Infinity : clock);
      assert(state.now >= before);
      assert.deepStrictEqual(core.validate(state), { pass: true, errors: [] });
      assert(state.events.length <= 60);
      assert(state.effects.length <= 80);
      assert(state.enemies.length <= core.CONFIG.maxEnemies);
      assert(Number.isFinite(state.player.x) && Number.isFinite(state.player.y));
      assert(Number.isFinite(state.beacon.health) && Number.isSafeInteger(state.lastInputSeq));
    }
  }
});

test('movement is normalized and bounded inside the playfield', () => {
  const state = enterWave(fresh());
  state.player.x = core.CONFIG.worldWidth - 61;
  core.applyAction(state, 'p1', { type: 'input', seq: 1, moveX: 1, moveY: 1, aimX: 1 }, 600);
  core.step(state, 100, 700);
  assert(state.player.x <= core.CONFIG.worldWidth - 60);
  assert(state.player.y <= core.CONFIG.worldHeight - 55);
  assert(Math.hypot(state.player.vx, state.player.vy) <= core.CONFIG.playerSpeed + 0.001);
});

test('player fire resolves a server-side hit, kill, score, and combo', () => {
  const state = enterWave(fresh());
  state.nextSpawnAt = 999999;
  state.enemies.push({ id: 'target', kind: 'sprinter', x: state.player.x + 74, y: state.player.y, vx: 0, vy: 0, facingX: 0, facingY: 0, health: 24, maxHealth: 24, radius: 15, lastAttackAt: 0, lastHitAt: 0, wobble: 0 });
  core.applyAction(state, 'p1', { type: 'input', seq: 1, aimX: 1, aimY: 0, firing: true }, 1000);
  core.step(state, 50, 1000);
  assert.strictEqual(state.player.kills, 1);
  assert.strictEqual(state.kills, 1);
  assert(state.score >= 120);
  assert.strictEqual(state.combo, 1);
});

test('Moxie autonomously targets and fires at an enemy', () => {
  const state = enterWave(fresh());
  state.nextSpawnAt = 999999;
  state.enemies.push({ id: 'ai-target', kind: 'bruiser', x: state.ally.x + 260, y: state.ally.y, vx: 0, vy: 0, facingX: 0, facingY: 0, health: 105, maxHealth: 105, radius: 30, lastAttackAt: 0, lastHitAt: 0, wobble: 0 });
  core.step(state, 50, 1000);
  assert(state.projectiles.some(projectile => projectile.owner === 'moxie'));
  assert(state.ally.shots >= 1);
});

test('enemy contact records an authoritative defender hit with its source bearing', () => {
  const state = enterWave(fresh());
  state.nextSpawnAt = 999999;
  state.enemies.push({
    id: 'bearing-attacker', kind: 'nib', x: state.player.x + 30, y: state.player.y + 20,
    vx: 0, vy: 0, facingX: 0, facingY: 0, health: 34, maxHealth: 34, radius: 19,
    lastAttackAt: 0, lastHitAt: 0, wobble: 0
  });
  core.step(state, 50, 1000);
  assert.strictEqual(state.player.health, 100);
  assert.strictEqual(state.enemies[0].windupTargetId, 'p1');
  assert.strictEqual(state.enemies[0].windupUntil, 1000 + core.ENEMY_TYPES.nib.windupMs);
  const telegraph = core.observe(state).enemies.find(enemy => enemy.id === 'bearing-attacker').attack;
  assert.deepStrictEqual(telegraph, { targetId: 'p1', resolvesAt: 1360, remainingMs: 360 });
  core.step(state, 100, 1359);
  assert.strictEqual(state.player.health, 100);
  core.step(state, 1, 1360);
  const hit = state.effects.find(effect => effect.type === 'defender-hit' && effect.targetId === 'p1');
  assert(hit, 'expected an authoritative defender-hit effect');
  assert.strictEqual(state.player.health, 92);
  assert.strictEqual(state.player.lastHitAt, 1360);
  assert.strictEqual(hit.sourceKind, 'nib');
  assert.strictEqual(hit.amount, 8);
  assert(Number.isFinite(hit.sourceX) && Number.isFinite(hit.sourceY));
  assert(hit.sourceX > state.player.x && hit.sourceY > state.player.y);
});

test('perfect dodge cancels contact damage and arms one authoritative Prism Counter', () => {
  const state = enterWave(fresh());
  state.nextSpawnAt = 999999;
  state.ally.downUntil = 999999;
  state.enemies.push({
    id: 'dodge-attacker', kind: 'nib', x: state.player.x + 30, y: state.player.y + 20,
    vx: 0, vy: 0, facingX: 0, facingY: 0, health: 34, maxHealth: 34, radius: 19,
    lastAttackAt: 0, lastHitAt: 0, wobble: 0
  });
  core.step(state, 50, 1000);
  const resolvesAt = state.enemies[0].windupUntil;
  assert.strictEqual(resolvesAt, 1360);
  core.applyAction(state, 'p1', { type: 'input', seq: 1, moveX: -1, moveY: 0, aimX: 1, aimY: 0, dash: true }, 1050);
  core.step(state, 50, 1050);
  assert(state.player.x < 1000, 'dash should move Pippa clear of contact');
  core.step(state, 100, resolvesAt);
  assert.strictEqual(state.player.health, 100);
  assert.strictEqual(state.enemies[0].windupUntil, 0);
  assert.strictEqual(state.enemies[0].lastAttackAt, resolvesAt);
  const miss = state.effects.find(effect => effect.type === 'enemy-miss' && effect.targetId === 'p1');
  assert(miss);
  assert.strictEqual(miss.targetX, state.player.x);
  assert.strictEqual(miss.targetY, state.player.y);
  assert.strictEqual(state.perfectDodges, 1);
  assert.strictEqual(state.score, core.CONFIG.perfectDodgeScore);
  assert.strictEqual(state.counterReadyUntil, resolvesAt + core.CONFIG.prismCounterMs);
  assert(state.events.some(event => event.type === 'perfect-dodge' && event.detail.readyUntil === state.counterReadyUntil));
  assert.deepStrictEqual(core.observe(state).player.counter, {
    readyUntil: state.counterReadyUntil,
    remainingMs: core.CONFIG.prismCounterMs,
    damageMultiplier: core.CONFIG.prismCounterMultiplier
  });

  const target = state.enemies[0];
  target.x = state.player.x + 100;
  target.y = state.player.y;
  target.health = 100;
  target.maxHealth = 100;
  target.lastAttackAt = 999999;
  core.applyAction(state, 'p1', { type: 'input', seq: 2, aimX: 1, aimY: 0, firing: true }, resolvesAt + 10);
  core.step(state, 10, resolvesAt + 10);
  const shot = state.projectiles.find(projectile => projectile.owner === 'p1');
  assert(shot && shot.counter);
  assert.strictEqual(shot.damage, 24 * core.CONFIG.prismCounterMultiplier);
  assert.strictEqual(shot.radius, 10);
  assert.strictEqual(state.counterReadyUntil, 0);
  assert(state.events.some(event => event.type === 'prism-counter' && event.detail.damage === shot.damage));
  core.step(state, 100, resolvesAt + 110);
  assert.strictEqual(target.health, 100 - shot.damage);
  assert(state.effects.some(effect => effect.type === 'counter-hit' && effect.damage === shot.damage));
  assert(state.events.some(event => event.type === 'counter-hit' && event.detail.damage === shot.damage && event.detail.defeated === false));
  const impactAt = state.effects.find(effect => effect.type === 'counter-hit').at;
  core.applyAction(state, 'p1', { type: 'input', seq: 3, aimX: 1, aimY: 0, firing: false }, impactAt + 1);
  core.step(state, 100, impactAt + 1799);
  assert(state.effects.some(effect => effect.type === 'counter-hit'), 'counter confirmation should remain readable for 1.8 seconds');
  core.step(state, 1, impactAt + 1800);
  assert(!state.effects.some(effect => effect.type === 'counter-hit'));
});

test('Prism Counter expires exactly and is discarded when Pippa goes down', () => {
  const state = enterWave(fresh());
  state.nextSpawnAt = 999999;
  state.ally.downUntil = 999999;
  state.counterReadyUntil = 1000;
  core.step(state, 100, 999);
  assert.strictEqual(state.counterReadyUntil, 1000);
  core.step(state, 1, 1000);
  assert.strictEqual(state.counterReadyUntil, 0);

  state.player.health = core.ENEMY_TYPES.nib.damage;
  state.counterReadyUntil = 2000;
  state.enemies.push({
    id: 'counter-clear-attacker', kind: 'nib', x: state.player.x + 30, y: state.player.y,
    vx: 0, vy: 0, facingX: -1, facingY: 0, health: 34, maxHealth: 34, radius: 19,
    lastAttackAt: 0, lastHitAt: 0, wobble: 0, windupStartedAt: 700, windupUntil: 1001,
    windupTargetId: 'p1', attackAimX: -1, attackAimY: 0
  });
  core.step(state, 1, 1001);
  assert.strictEqual(state.player.health, 0);
  assert.strictEqual(state.counterReadyUntil, 0);
});

test('dash is gated and Heartburst damages nearby enemies while healing the team', () => {
  const state = enterWave(fresh());
  state.nextSpawnAt = 999999;
  state.player.health = 50;
  state.beacon.health = 300;
  state.ally.downUntil = 999999;
  state.enemies.push({ id: 'pulse-target', kind: 'bruiser', x: state.player.x + 100, y: state.player.y, vx: 0, vy: 0, facingX: 0, facingY: 0, health: 105, maxHealth: 105, radius: 30, lastAttackAt: 999999, lastHitAt: 0, wobble: 0 });
  state.enemies.push({ id: 'pulse-pop', kind: 'nib', x: state.player.x + 150, y: state.player.y, vx: 0, vy: 0, facingX: 0, facingY: 0, health: 34, maxHealth: 34, radius: 19, lastAttackAt: 999999, lastHitAt: 0, wobble: 0 });
  const beforeX = state.player.x;
  core.applyAction(state, 'p1', { type: 'input', seq: 1, moveX: 1, aimX: 1, dash: true, pulse: true }, 1000);
  core.step(state, 50, 1000);
  assert(state.player.x > beforeX + 100);
  assert.strictEqual(state.enemies[0].health, 57);
  assert(!state.enemies.some(enemy => enemy.id === 'pulse-pop'));
  assert.strictEqual(state.kills, 1);
  assert.strictEqual(state.player.kills, 1);
  assert(state.events.some(event => event.type === 'heartburst' && event.detail.affected === 2 && event.detail.popped === 1));
  assert.strictEqual(state.player.health, 66);
  assert.strictEqual(state.beacon.health, 318);
  const dashReadyAt = state.dashReadyAt;
  core.applyAction(state, 'p1', { type: 'input', seq: 2, moveX: 1, aimX: 1, dash: true, pulse: true }, 1050);
  core.step(state, 50, 1050);
  assert.strictEqual(state.dashReadyAt, dashReadyAt);
  assert.strictEqual(state.enemies[0].health, 57);
});

test('pause freezes simulation time and resumes through the same action', () => {
  const state = enterWave(fresh());
  state.counterReadyUntil = 1300;
  state.dashReadyAt = 1400;
  core.applyAction(state, 'p1', { type: 'pause' }, 700);
  const elapsed = state.elapsedMs;
  const pausedNow = state.now;
  core.step(state, 100, 5000);
  assert.strictEqual(state.elapsedMs, elapsed);
  assert.strictEqual(state.paused, true);
  assert.strictEqual(state.now, pausedNow);
  assert.strictEqual(state.counterReadyUntil - state.now, 600);
  assert.strictEqual(state.dashReadyAt - state.now, 700);
  assert.deepStrictEqual(core.applyAction(state, 'p1', { type: 'input', seq: 1, firing: true }, 5050), { ok: false, reason: 'paused' });
  assert.strictEqual(state.lastInputSeq, 0);
  core.applyAction(state, 'p1', { type: 'pause' }, 5100);
  assert.strictEqual(state.now, pausedNow);
  core.step(state, 50, 5150);
  assert.strictEqual(state.paused, false);
  assert.strictEqual(state.elapsedMs, elapsed + 50);
  assert.strictEqual(state.now, pausedNow + 50);
  assert.strictEqual(state.counterReadyUntil - state.now, 550);
  assert.strictEqual(state.dashReadyAt - state.now, 650);
});

test('a downed defender reboots after the server timer', () => {
  const state = enterWave(fresh());
  state.player.health = 0;
  state.player.downUntil = 1000;
  core.step(state, 50, 1050);
  assert.strictEqual(state.player.downUntil, 0);
  assert.strictEqual(state.player.health, 70);
});

test('downed input edges cannot auto-fire on authoritative reboot', () => {
  const state = enterWave(fresh());
  state.player.health = 0;
  state.player.downUntil = 1000;
  state.player.invulnerableUntil = 2200;
  state.dashReadyAt = 0;
  state.pulseReadyAt = 0;
  const startX = state.player.x;
  const accepted = core.applyAction(state, 'p1', { type: 'input', seq: 1, moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: true, dash: true, pulse: true }, 900);
  assert.strictEqual(accepted.ok, true);
  assert.deepStrictEqual({ firing: state.input.firing, dash: state.input.dash, pulse: state.input.pulse }, { firing: false, dash: false, pulse: false });
  state.input.firing = true;
  state.input.dash = true;
  state.input.pulse = true;
  core.step(state, 50, 950);
  assert.deepStrictEqual({ firing: state.input.firing, dash: state.input.dash, pulse: state.input.pulse }, { firing: false, dash: false, pulse: false });
  core.applyAction(state, 'p1', { type: 'input', seq: 2, moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: true, dash: true, pulse: true }, 990);
  const observation = core.observe(state);
  assert.strictEqual(observation.player.down, true);
  assert.strictEqual(observation.player.dashReady, false);
  assert.strictEqual(observation.player.pulseReady, false);
  assert.deepStrictEqual(observation.allowedActions, ['wait-for-reboot', 'pause']);
  core.step(state, 50, 1000);
  assert.strictEqual(state.player.health, 70);
  assert.strictEqual(state.player.x, startX);
  assert.strictEqual(state.dashReadyAt, 0);
  assert.strictEqual(state.pulseReadyAt, 0);
  assert.strictEqual(state.effects.some(effect => effect.type === 'dash' || effect.type === 'pulse'), false);
});

test('Heartlight reaching zero produces an explicit defeat result', () => {
  const state = enterWave(fresh());
  state.beacon.health = 1;
  state.enemies.push({ id: 'finisher', kind: 'bruiser', x: state.beacon.x + 20, y: state.beacon.y, vx: 0, vy: 0, facingX: 0, facingY: 0, health: 105, maxHealth: 105, radius: 30, lastAttackAt: 0, lastHitAt: 0, wobble: 0 });
  core.step(state, 50, 2000);
  assert.strictEqual(state.phase, core.PHASES.WAVE);
  assert.strictEqual(state.beacon.health, 1);
  core.step(state, 100, 2000 + core.ENEMY_TYPES.bruiser.windupMs);
  assert.strictEqual(state.phase, core.PHASES.DEFEAT);
  assert.strictEqual(state.result.victory, false);
  assert.strictEqual(state.result.beaconHealth, 0);
});

test('cleared waves reopen exploration and final wave produces victory', () => {
  const state = enterWave(fresh());
  state.waveSpawned = state.waveTarget;
  state.enemies = [];
  core.step(state, 50, 1000);
  assert.strictEqual(state.phase, core.PHASES.EXPLORE);
  state.wave = core.CONFIG.waveCounts.length;
  state.phase = core.PHASES.WAVE;
  state.waveTarget = core.CONFIG.waveCounts[2];
  state.waveSpawned = state.waveTarget;
  state.enemies = [];
  core.step(state, 50, 1100);
  assert.strictEqual(state.phase, core.PHASES.VICTORY);
  assert.strictEqual(state.result.victory, true);
});

test('observation and snapshots are detached read-only transport values', () => {
  const state = enterWave(fresh());
  const observation = core.observe(state);
  const packet = core.snapshot(state);
  observation.player.health = -10;
  packet.player.health = -20;
  assert.strictEqual(state.player.health, 100);
  assert.strictEqual(observation.authority, 'observation-only');
  assert(observation.allowedActions.includes('move-aim-fire-dash-heartburst'));
});

test('client sources are local-only and the document exposes a responsive viewport', () => {
  const sources = ['runtime/index.html', 'runtime/styles.css', 'runtime/app.js', 'runtime/game-core.js'].map(relative => fs.readFileSync(path.join(gameDir, relative), 'utf8')).join('\n');
  assert(!/(?:src|href)=["']https?:\/\//i.test(sources));
  assert(/name=["']viewport["']/i.test(sources));
  assert(/prefers-reduced-motion/i.test(sources));
});

test('client immediately resynchronizes semantic input after reload or reconnect', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  assert(/const sessionRestarted = !firstPacket && nextEventSeq < lastServerEventSeq/.test(app));
  assert(/inputSeq = sessionRestarted \? acceptedInputSeq : Math\.max\(inputSeq, acceptedInputSeq\)/.test(app));
  assert(/\['stale-sequence', 'invalid-sequence', 'sequence-gap-too-large'\]\.includes\(result\.reason\)/.test(app));
  assert(/inputSeq = Number\(state && state\.lastInputSeq\) \|\| 0/.test(app));
  assert(/const firstPacket\s*=\s*packet === null/.test(app));
  assert(/if \(firstPacket\).*seenEvents\.add\(event\.id\)/s.test(app));
  assert(/let fireRequested = false/.test(app));
  assert(/const queuedShot = fireRequested/.test(app));
  assert(/if \(result && result\.ok !== false\)[\s\S]*if \(queuedShot\) fireRequested = false/.test(app));
});

test('connection loss and recovery are visible, bounded, and accessible', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(gameDir, 'runtime/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(gameDir, 'runtime/styles.css'), 'utf8');
  assert(/let connectionKnown = false/.test(app));
  assert(/classList\.toggle\('warn', !ok\)/.test(app));
  assert(/if \(!ok && \(!wasKnown \|\| wasConnected\)\) showToast\('LINK PAUSED/.test(app));
  assert(/if \(ok && wasKnown && !wasConnected\) showToast\('LINK RESTORED/.test(app));
  assert(!/eventToast'\)\.textContent = 'Connection held:/.test(app));
  assert(html.includes('id="connection" role="status" aria-live="polite" aria-atomic="true"'));
  assert(/\.connection\.warn::before/.test(css));
  assert(/\.connection:not\(\.ok\):not\(\.warn\)::before/.test(css));
});

test('map, help, and Escape share one safe pause-and-focus lifecycle', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  assert(/async function closeHelpPanel/.test(app));
  assert(/async function closeMapOverlay/.test(app));
  assert(/async function handleEscape\(\)[\s\S]*closeMapOverlay\(\)[\s\S]*closeHelpPanel\(\)[\s\S]*togglePause\(\)/.test(app));
  assert(/focusSoon\(\$\('closeMap'\)\)/.test(app));
  assert(/focusSoon\(\$\('closeHelp'\)\)/.test(app));
  assert(/function activeDialog\(\)/.test(app));
  assert(/function trapModalFocus\(event\)/.test(app));
  assert(/if \(trapModalFocus\(event\)\) return/.test(app));
});

test('active dialogs isolate canvas and footer pointer interaction', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  assert(/function syncModalIsolation\(\)/.test(app));
  assert(/Array\.from\(stage\.children\)\.forEach\(element => \{[\s\S]*element\.inert = !!dialog && element !== dialog/.test(app));
  assert(/document\.querySelector\('\.team-rail'\)\.inert = !!dialog/.test(app));
  assert((app.match(/syncModalIsolation\(\);/g) || []).length >= 5);
});

test('wayfinding and normalized health feedback cover the expanded-world unlock route', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(gameDir, 'runtime/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(gameDir, 'runtime/styles.css'), 'utf8');
  assert(/function nextRouteTarget\(\)/.test(app));
  assert(/function routeDirection\(route\)/.test(app));
  assert(/const directions = \['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'\]/.test(app));
  assert(/setAttribute\('aria-label', 'Next lead: '/.test(app));
  assert(/return verb \+ ' ' \+ route\.label \+ ' · ' \+ heading\.distance\.toLowerCase\(\)/.test(app));
  assert(/function renderHealth\(entity, barId, meterId, textId, cardId, stateId, label\)/.test(app));
  assert(/current \/ maximum \* 100/.test(app));
  assert(html.includes('id="wayfinder"'));
  assert(html.includes('id="playerHealthMeter" role="progressbar"'));
  assert(/\.map-svg \.map-marker\.route/.test(css));
});

test('compact play-first layout preserves the objective and clears the arena', () => {
  const css = fs.readFileSync(path.join(gameDir, 'runtime/styles.css'), 'utf8');
  assert(/@media \(max-width: 1040px\)[\s\S]*?\.mission \{[\s\S]*?display: grid;/.test(css));
  assert(/@media \(min-width: 821px\) and \(max-width: 1040px\)[\s\S]*?\.explore-progress \{\s*display: none;/.test(css));
  assert(/@media \(max-width: 820px\)[\s\S]*?\.mission \{\s*display: none;/.test(css));
  assert(!/@media \(max-width: 720px\)/.test(css));
  assert(!/min-width: 721px/.test(css));
  assert(/#playerName \{\s*max-width: 72px;\s*font-size: 10px;/.test(css));
  assert(/#playerName::after \{\s*content: none;/.test(css));
  assert(!/content: "PIPPA"/.test(css));
});

test('off-screen combat threats expose bounded visual and accessible direction cues', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(gameDir, 'runtime/index.html'), 'utf8');
  assert(/function threatCompassState\(\)/.test(app));
  assert(/state\.phase !== Core\.PHASES\.WAVE/.test(app));
  assert(/const padding = Math\.max\(12 \* pixel, \(enemy\.radius \+ 9\) \* view\.scale\)/.test(app));
  assert(/function threatEdgePoint\(group, compass\)/.test(app));
  assert(/groups\.slice\(0, 4\)\.forEach/.test(app));
  assert(/ctx\.setTransform\(1,0,0,1,0,0\);\s*drawPlayerDamageCompass\(\);\s*drawThreatCompass\(time\)/.test(app));
  assert(/Off-screen threats:/.test(app));
  assert(html.includes('id="threatAnnouncer" role="status" aria-live="polite" aria-atomic="true"'));
  assert(html.includes('aria-describedby="threatAnnouncer"'));
});

test('defender damage feedback carries authority bearing into world, screen, HUD, and semantics', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(gameDir, 'runtime/styles.css'), 'utf8');
  assert(/function latestDefenderHit\(targetId\)/.test(app));
  assert(/effect\.type === 'defender-hit' && effect\.targetId === targetId/.test(app));
  assert(/function drawPlayerDamageCompass\(\)/.test(app));
  assert(/meter\.setAttribute\('aria-valuetext',[\s\S]*hit from/.test(app));
  assert(/\.team-card\.is-hit:not\(\.is-downed\)/.test(css));
  assert(/\.team-card\.is-returned \.team-state/.test(css));
  assert(/@keyframes defenderHit/.test(css));
});

test('enemy windups expose distinct dodge telegraphs and bounded semantic warning', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  assert(/function enemyWindupActive\(enemy\)/.test(app));
  assert(/function drawEnemyTelegraph\(enemy, time\)/.test(app));
  assert(/enemy\.kind === 'bruiser'[\s\S]*ctx\.setLineDash/.test(app));
  assert(/enemy\.kind === 'sprinter'[\s\S]*reach \+ 22/.test(app));
  assert(/enemy\.windupTargetId === 'p1' \? 'DODGE' : '!'/ .test(app));
  assert(/effect\.type === 'enemy-miss'[\s\S]*PERFECT DODGE/.test(app));
  assert(/Dodge now:/.test(app));
  assert(/Dodge confirmed\./.test(app));
  assert(/group\.incoming \? '!' : String\(group\.count\)/.test(app));
});

test('perfect dodge mastery loop exposes counter authority, HUD charge, impact, and onboarding', () => {
  const coreSource = fs.readFileSync(path.join(gameDir, 'runtime/game-core.js'), 'utf8');
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(gameDir, 'runtime/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(gameDir, 'runtime/styles.css'), 'utf8');
  assert(/perfectDodges: 0/.test(coreSource));
  assert(/counterReadyUntil: 0/.test(coreSource));
  assert(/type: 'counter-ready'/.test(coreSource));
  assert(/event\(state, 'perfect-dodge'/.test(coreSource));
  assert(/baseDamage \* CONFIG\.prismCounterMultiplier/.test(coreSource));
  assert(/event\(state, 'prism-counter'/.test(coreSource));
  assert(/event\(state, 'counter-hit'/.test(coreSource));
  assert(/counter: state\.counterReadyUntil > state\.now/.test(coreSource));
  assert(/classList\.toggle\('is-counter', counterActive/.test(app));
  assert(/classList\.toggle\('is-counter-hit', !!recentCounterHit/.test(app));
  assert(/effect\.type === 'counter-hit'[\s\S]*< 1800/.test(app));
  assert(/PRISM COUNTER/.test(app));
  assert(/COUNTER HIT/.test(app));
  assert(/effect\.type === 'counter-ready'[\s\S]*PRISM COUNTER ARMED/.test(app));
  assert(/effect\.type === 'counter-hit'[\s\S]*×2  PRISM COUNTER/.test(app));
  assert(/projectile\.counter[\s\S]*#61edff/.test(app));
  assert(/\.ability-card\.is-counter/.test(css));
  assert(/\.ability-card\.is-counter-hit/.test(css));
  assert(html.includes('DASH + COUNTER'));
  assert(html.includes('Prism Counter'));
});

test('Heartlight damage has persistent, transient, and accessible urgency feedback', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(gameDir, 'runtime/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(gameDir, 'runtime/styles.css'), 'utf8');
  assert(/function signalBeaconHit\(\)/.test(app));
  assert(/event\.type === 'beacon-hit'[\s\S]*signalBeaconHit\(\)/.test(app));
  assert(/percent <= 40[\s\S]*Heartlight critical/.test(app));
  assert(/percent <= 65[\s\S]*Heartlight under attack/.test(app));
  assert(/beaconCard\.classList\.toggle\('is-critical'/.test(app));
  assert(/beaconCard\.setAttribute\('aria-valuetext'/.test(app));
  assert(/Heartlight critical at /.test(app));
  assert(html.includes('id="beaconCard" role="progressbar"'));
  assert(html.includes('id="beaconAnnouncer" role="status" aria-live="polite"'));
  assert(/body\.heartlight-critical \.stage-vignette/.test(css));
  assert(/@keyframes heartlightHit/.test(css));
  assert(/@keyframes heartlightCritical/.test(css));
});

test('downed defenders expose persistent reboot progress, priority, and recovery semantics', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(gameDir, 'runtime/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(gameDir, 'runtime/styles.css'), 'utf8');
  assert(html.includes('id="playerCard"'));
  assert(html.includes('id="playerState" aria-hidden="true" hidden'));
  assert(html.includes('id="allyState" aria-hidden="true" hidden'));
  assert(html.includes('id="abilityCard" aria-label="Scout kit status"'));
  assert(html.includes('id="abilityLabel"'));
  assert(/event\.type === 'defender-down'[\s\S]*Rebooting in/.test(app));
  assert(/playerReboot > 0[\s\S]*Pippa rebooting/.test(app));
  assert(/allyReboot > 0[\s\S]*Moxie rebooting/.test(app));
  assert(/card\.classList\.toggle\('is-downed', rebooting\)/.test(app));
  assert(/reboot progress/.test(app));
  assert(/Rebooting, '[\s\S]*remaining/.test(app));
  assert(/function playerControlsOnline\(current\)/.test(app));
  assert(/classList\.toggle\('is-offline', scoutKitOffline\)/.test(app));
  assert(/DASH OFFLINE/.test(app));
  assert(/BURST OFFLINE/.test(app));
  assert(/if \(!playerControlsOnline\(state\)\)[\s\S]*dashRequested = false/.test(app));
  assert(/\.team-card\.is-downed/.test(css));
  assert(/\.ability-card\.is-offline/.test(css));
  assert(/\.ability-row span\.offline/.test(css));
  assert(/@media \(max-width: 820px\)[\s\S]*\.ability-card[\s\S]*width: 240px/.test(css));
  assert(/@media \(max-width: 430px\)[\s\S]*\.ability-card \.ability-row kbd[\s\S]*display: none/.test(css));
  assert(/@keyframes defenderReboot/.test(css));
  assert(/\.team-card\.is-downed #playerName[\s\S]*max-width: none/.test(css));
});

test('accessibility and gamepad polish expose modal, motion, and menu contracts', () => {
  const app = fs.readFileSync(path.join(gameDir, 'runtime/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(gameDir, 'runtime/index.html'), 'utf8');
  assert.strictEqual((html.match(/role="dialog"/g) || []).length, 6);
  assert.strictEqual((html.match(/role="progressbar"/g) || []).length, 3);
  assert(html.includes('View map · Menu pause'));
  assert(/function pollGamepadControls\(\)/.test(app));
  assert(/pad\.buttons\[9\]/.test(app));
  assert(/motionPreferenceOverridden/.test(app));
  assert(/visibilitychange/.test(app));
});

test('manifest truth stays one-human, one-AI, no split-screen', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, 'game.manifest.json'), 'utf8'));
  assert.strictEqual(manifest.max_players, 1);
  assert.strictEqual(manifest.rules.fixed_human_seats, 1);
  assert.strictEqual(manifest.rules.server_owned_ai_companions, 1);
  assert.strictEqual(manifest.rules.split_screen, false);
  assert.strictEqual(manifest.rules.defense_waves, 3);
});

test('complete game package passes the shared package verifier', () => {
  const result = verifier.verifyGameDir(gameDir);
  assert.deepStrictEqual(result.errors, []);
});

console.log('\nBloomvale self-test: PASS (' + checks.length + ' checks)');
