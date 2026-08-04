#!/usr/bin/env node
'use strict';

const assert = require('assert');
const core = require('../runtime/game-core');

const races = 24;
const winners = { p1: 0, p2: 0, p3: 0, p4: 0 };
const elapsed = [];
let driftBoosts = 0;

function runRace(seed) {
  const roster = core.RACERS.map((character, index) => ({
    id: character.id,
    seatId: 'seat_' + (index + 1),
    displayName: character.name,
    type: 'ai'
  }));
  const state = core.createInitialState(roster, { seed, now: 0 });
  assert.equal(core.startRace(state, 0).ok, true);
  let now = core.METRICS.countdownMs;
  core.step(state, core.METRICS.countdownMs, now);
  for (let tick = 0; tick < 4200 && state.phase !== core.PHASES.RESULTS; tick += 1) {
    now += 40;
    core.step(state, 40, now);
  }
  assert.equal(state.phase, core.PHASES.RESULTS, 'seed ' + seed + ' did not resolve within the race budget');
  assert(state.result.elapsedMs > 12000, 'seed ' + seed + ' resolved implausibly fast');
  assert(state.result.elapsedMs <= core.METRICS.maxRaceMs, 'seed ' + seed + ' exceeded the declared race budget');
  assert.equal(new Set(state.result.ranking).size, 4);
  assert.equal(state.result.ranking.every(id => state.racers[id]), true);
  winners[state.result.winnerId] += 1;
  elapsed.push(state.result.elapsedMs);
  driftBoosts += state.result.totalDriftBoosts;
}

for (let seed = 1; seed <= races; seed += 1) runRace(15000 + seed * 97);

const winCounts = Object.values(winners);
const maxShare = Math.max.apply(null, winCounts) / races;
const averageMs = elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length;
assert(maxShare <= .58, 'one equal-spec starting seat won too often: ' + JSON.stringify(winners));
assert(winCounts.filter(value => value > 0).length >= 3, 'fewer than three seats won across held-out seeds: ' + JSON.stringify(winners));
assert(driftBoosts >= races * 2, 'AI did not exercise the shared drift contract often enough: ' + driftBoosts);
assert(averageMs >= 18000 && averageMs <= 90000, 'average race duration left the game-night target: ' + averageMs);

console.log('MIRRORSHIFT QUALITY SOAK PASS · ' + races + ' seeds · winners ' + JSON.stringify(winners) + ' · avg ' + Math.round(averageMs) + 'ms · drift boosts ' + driftBoosts);
