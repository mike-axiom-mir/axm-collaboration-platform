#!/usr/bin/env node
'use strict';

const assert = require('assert');
const core = require('../runtime/game-core');

const roster = core.RACERS.map((character, index) => ({
  id: character.id,
  seatId: 'variant_soak_' + (index + 1),
  displayName: character.name,
  type: 'ai'
}));
const seeds = [104729, 155921, 225307, 299993, 374009, 448531, 523499, 598687];
const report = {};

for (const variant of core.RACE_VARIANT_CATALOG) {
  const winners = {};
  let elapsedTotal = 0;
  let races = 0;
  let finishers = 0;
  let shortcuts = 0;
  let hazardsHit = 0;
  for (const trackId of Object.keys(core.TRACKS)) {
    for (const seed of seeds) {
      const state = core.createInitialState(roster, { seed, now: 0, trackId, variantId: variant.id });
      assert.equal(state.raceLaps, variant.laps);
      assert.equal(core.startRace(state, 0).ok, true);
      for (let now = 40; now <= core.METRICS.maxRaceMs + core.METRICS.countdownMs + 1000 && state.phase !== core.PHASES.RESULTS; now += 40) {
        core.step(state, 40, now);
      }
      assert.equal(state.phase, core.PHASES.RESULTS, variant.id + ' / ' + trackId + ' / ' + seed + ' did not resolve');
      assert.equal(state.result.variantId, variant.id);
      assert.equal(state.result.variantLabel, variant.label);
      assert.equal(state.result.raceLaps, variant.laps);
      assert.equal(state.result.equalStats, true);
      winners[state.result.winnerId] = (winners[state.result.winnerId] || 0) + 1;
      elapsedTotal += state.result.elapsedMs;
      races += 1;
      const racers = Object.values(state.racers);
      finishers += racers.filter(racer => racer.finishedAt != null).length;
      shortcuts += racers.reduce((sum, racer) => sum + racer.stats.shortcuts, 0);
      hazardsHit += racers.reduce((sum, racer) => sum + racer.stats.hazardsHit, 0);
    }
  }
  const averageElapsedMs = Math.round(elapsedTotal / races);
  assert(Object.keys(winners).length >= 3, variant.id + ' winner diversity collapsed');
  assert(averageElapsedMs >= 15000 && averageElapsedMs <= 115000, variant.id + ' duration left the game-night envelope');
  assert(finishers >= races * 3, variant.id + ' completion rate fell below 75%');
  assert(shortcuts >= races, variant.id + ' shortcut contract was not meaningfully exercised');
  assert(hazardsHit >= races, variant.id + ' hazard pressure was not meaningfully exercised');
  report[variant.id] = {
    laps: variant.laps,
    winners,
    averageElapsedMs,
    finishRate: Math.round(finishers / (races * 4) * 1000) / 10,
    shortcuts,
    hazardsHit
  };
}

console.log('MIRRORSHIFT NINE-FORMAT VARIANT SOAK PASS · ' + JSON.stringify(report));
