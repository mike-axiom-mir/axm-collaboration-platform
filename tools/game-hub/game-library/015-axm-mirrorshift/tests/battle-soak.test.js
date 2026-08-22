#!/usr/bin/env node
'use strict';

const assert = require('assert');
const core = require('../runtime/game-core');

const matches = 32;
const winners = { p1: 0, p2: 0, p3: 0, p4: 0 };
let totalGuardBreaks = 0;
let totalKnockouts = 0;
let totalRespawns = 0;
let totalDuration = 0;

function runBattle(seed) {
  const roster = core.RACERS.map((character, index) => ({
    id: character.id,
    seatId: 'seat_' + (index + 1),
    displayName: character.name,
    type: 'ai'
  }));
  const state = core.createInitialState(roster, { seed, now: 0, mode: core.MODES.BATTLE });
  assert.equal(core.startRace(state, 0).ok, true);
  let now = core.METRICS.countdownMs;
  core.step(state, core.METRICS.countdownMs, now);
  for (let tick = 0; tick < 1800 && state.phase !== core.PHASES.RESULTS; tick += 1) {
    now += 40;
    core.step(state, 40, now);
  }
  assert.equal(state.phase, core.PHASES.RESULTS, 'seed ' + seed + ' did not resolve');
  assert.equal(state.result.mode, core.MODES.BATTLE);
  assert(state.result.elapsedMs > 10000, 'seed ' + seed + ' resolved too quickly');
  assert(state.result.elapsedMs <= core.METRICS.battleDurationMs, 'seed ' + seed + ' exceeded the battle timer');
  assert.equal(new Set(state.result.ranking).size, 4);
  const scores = state.result.ranking.map(id => state.result.scores[id]);
  assert(scores.every(Number.isFinite));
  assert(scores[0] >= scores[scores.length - 1]);
  winners[state.result.winnerId] += 1;
  totalDuration += state.result.elapsedMs;
  Object.values(state.racers).forEach(racer => {
    totalGuardBreaks += racer.guardBreaks;
    totalKnockouts += racer.knockouts;
    totalRespawns += racer.stats.respawns;
  });
}

for (let seed = 1; seed <= matches; seed += 1) runBattle(26000 + seed * 131);

const winCounts = Object.values(winners);
const maxShare = Math.max.apply(null, winCounts) / matches;
const averageDuration = totalDuration / matches;
assert(maxShare <= .6, 'one battle spawn dominated the held-out seeds: ' + JSON.stringify(winners));
assert(winCounts.filter(value => value > 0).length >= 3, 'fewer than three seats won: ' + JSON.stringify(winners));
assert(totalGuardBreaks >= matches * 10, 'battle attack pressure was too low: ' + totalGuardBreaks);
assert(totalKnockouts >= matches * 2, 'battle did not exercise clean wipes: ' + totalKnockouts);
assert(totalRespawns > 0, 'battle never exercised protected re-entry');
assert(averageDuration >= 14000 && averageDuration <= core.METRICS.battleDurationMs, 'battle duration left the target window: ' + averageDuration);

console.log('MIRROR CORE SOAK PASS · ' + matches + ' seeds · winners ' + JSON.stringify(winners) + ' · avg ' + Math.round(averageDuration) + 'ms · guard breaks ' + totalGuardBreaks + ' · wipes ' + totalKnockouts + ' · respawns ' + totalRespawns);
