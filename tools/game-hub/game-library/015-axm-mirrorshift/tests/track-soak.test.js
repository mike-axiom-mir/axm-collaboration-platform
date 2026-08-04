#!/usr/bin/env node
'use strict';

const assert = require('assert');
const core = require('../runtime/game-core');

const roster = core.RACERS.map((character, index) => ({
  id: character.id,
  seatId: 'soak_' + (index + 1),
  displayName: character.name,
  type: 'ai'
}));
const seeds = [104729, 130363, 155921, 196613, 225307, 262147, 299993, 337013, 374009, 411527, 448531, 485519];
const report = {};

for (const trackId of Object.keys(core.TRACKS)) {
  const winners = {};
  let elapsedTotal = 0;
  let shortcuts = 0;
  let hazardsHit = 0;
  let totalFinishers = 0;
  for (const seed of seeds) {
    const state = core.createInitialState(roster, { seed, now: 0, trackId });
    assert.equal(core.startRace(state, 0).ok, true);
    for (let now = 40; now <= core.METRICS.maxRaceMs + core.METRICS.countdownMs + 1000 && state.phase !== core.PHASES.RESULTS; now += 40) {
      core.step(state, 40, now);
    }
    assert.equal(state.phase, core.PHASES.RESULTS, trackId + ' seed ' + seed + ' did not resolve');
    assert.equal(state.result.trackId, trackId);
    assert.equal(state.result.equalStats, true);
    winners[state.result.winnerId] = (winners[state.result.winnerId] || 0) + 1;
    elapsedTotal += state.result.elapsedMs;
    const racers = Object.values(state.racers);
    shortcuts += racers.reduce((sum, racer) => sum + racer.stats.shortcuts, 0);
    hazardsHit += racers.reduce((sum, racer) => sum + racer.stats.hazardsHit, 0);
    totalFinishers += racers.filter(racer => racer.finishedAt != null).length;
  }
  assert(Object.keys(winners).length >= 2, trackId + ' winner diversity collapsed');
  assert(shortcuts >= seeds.length * 2, trackId + ' shortcut was not meaningfully exercised');
  assert(hazardsHit >= seeds.length, trackId + ' hazards were not meaningfully exercised');
  assert(totalFinishers >= seeds.length * 3, trackId + ' AI completion rate fell below 75%');
  report[trackId] = {
    winners,
    averageElapsedMs: Math.round(elapsedTotal / seeds.length),
    shortcuts,
    hazardsHit,
    finishRate: Math.round(totalFinishers / (seeds.length * 4) * 1000) / 10
  };
}

console.log('MIRRORSHIFT THREE-TRACK SOAK PASS · ' + JSON.stringify(report));
