#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const core = require('../runtime/game-core');

const roster = core.RACERS.map((character, index) => ({
  id: character.id,
  seatId: 'reflection_' + (index + 1),
  displayName: character.name,
  type: 'ai'
}));
const seeds = [104729, 196613, 299993, 411527];

function reflectedIndex(index, count) {
  return index === 0 ? 0 : count - index;
}

assert.deepEqual(core.ROUTE_DIRECTION_CATALOG.map(direction => direction.id), ['forward', 'reflection']);
assert.equal(core.routeDirectionFor('missing').id, core.ROUTE_DIRECTION_IDS.FORWARD);
assert.equal(core.routeDirectionFor(core.ROUTE_DIRECTION_IDS.REFLECTION).changesVehicleStats, false);
assert.equal(core.routeDirectionFor(core.ROUTE_DIRECTION_IDS.REFLECTION).changesCatchup, false);

for (const trackId of Object.keys(core.TRACKS)) {
  const forward = core.TRACKS[trackId];
  const reflection = core.REFLECTION_TRACKS[trackId];
  const count = forward.points.length;
  assert.notEqual(reflection, forward);
  assert.equal(reflection.id, forward.id);
  assert.equal(reflection.points.length, count);
  assert.deepEqual(reflection.points[0], forward.points[0], trackId + ' finish line moved');
  assert.deepEqual(reflection.points[1], forward.points[count - 1], trackId + ' first reflected segment is wrong');
  assert.deepEqual(reflection.points[count - 1], forward.points[1], trackId + ' reflected loop is incomplete');
  assert.deepEqual(reflection.padIndices, forward.padIndices.map(index => reflectedIndex(index, count)).sort((a, b) => a - b));
  forward.shortcuts.forEach(shortcut => {
    const mirrored = reflection.shortcuts.find(candidate => candidate.id === shortcut.id);
    assert(mirrored, trackId + ' reflected shortcut missing');
    assert.equal(mirrored.entryIndex, reflectedIndex(shortcut.exitIndex, count));
    assert.equal(mirrored.exitIndex, reflectedIndex(shortcut.entryIndex, count));
    assert.deepEqual(mirrored.from, shortcut.to);
    assert.deepEqual(mirrored.to, shortcut.from);
  });
  forward.hazards.forEach(hazard => {
    const mirrored = reflection.hazards.find(candidate => candidate.id === hazard.id);
    assert(mirrored, trackId + ' reflected hazard missing');
    assert.equal(mirrored.x, hazard.x, trackId + ' hazard x moved');
    assert.equal(mirrored.y, hazard.y, trackId + ' hazard y moved');
    if (Number.isInteger(hazard.index)) assert.equal(mirrored.index, reflectedIndex(hazard.index, count));
  });
}

const selection = core.createInitialState(roster, { now: 0 });
assert.equal(selection.schema, 'axm.mirrorshift-state/v7');
assert.equal(selection.routeDirectionId, core.ROUTE_DIRECTION_IDS.FORWARD);
assert.equal(core.setRouteDirection(selection, core.ROUTE_DIRECTION_IDS.REFLECTION, 1).ok, true);
assert.equal(selection.routeDirectionId, core.ROUTE_DIRECTION_IDS.REFLECTION);
assert.equal(selection.track, core.REFLECTION_TRACKS[core.TRACK_IDS.FORGE]);
assert.equal(core.setTrack(selection, core.TRACK_IDS.GARDENS, 2).ok, true);
assert.equal(selection.track, core.REFLECTION_TRACKS[core.TRACK_IDS.GARDENS]);
assert.equal(core.setRaceVariant(selection, core.RACE_VARIANT_IDS.SPRINT, 3).ok, true);
assert.equal(selection.routeDirectionId, core.ROUTE_DIRECTION_IDS.REFLECTION);
assert.equal(core.startRace(selection, 4).ok, true);
assert.equal(core.setRouteDirection(selection, core.ROUTE_DIRECTION_IDS.FORWARD, 5).reason, 'route-direction-locked');

const tour = core.createInitialState(roster, { now: 0, mode: core.MODES.TOUR, routeDirectionId: core.ROUTE_DIRECTION_IDS.REFLECTION });
assert.equal(tour.routeDirectionId, core.ROUTE_DIRECTION_IDS.FORWARD);
assert.equal(core.setRouteDirection(tour, core.ROUTE_DIRECTION_IDS.REFLECTION, 1).reason, 'tour-itinerary');
const battle = core.createInitialState(roster, { now: 0, mode: core.MODES.BATTLE });
assert.equal(core.setRouteDirection(battle, core.ROUTE_DIRECTION_IDS.REFLECTION, 1).reason, 'battle-mode');

const canonicalBefore = JSON.stringify(core.TRACKS);
let races = 0;
let finishers = 0;
let shortcuts = 0;
let hazardsHit = 0;
const winners = {};
for (const trackId of Object.keys(core.TRACKS)) {
  for (const variant of core.RACE_VARIANT_CATALOG) {
    for (const seed of seeds) {
      const state = core.createInitialState(roster, {
        seed,
        now: 0,
        trackId,
        variantId: variant.id,
        routeDirectionId: core.ROUTE_DIRECTION_IDS.REFLECTION
      });
      assert.equal(state.track, core.REFLECTION_TRACKS[trackId]);
      assert.equal(core.startRace(state, 0).ok, true);
      for (let now = 40; now <= core.METRICS.maxRaceMs + core.METRICS.countdownMs + 1000 && state.phase !== core.PHASES.RESULTS; now += 40) {
        core.step(state, 40, now);
      }
      assert.equal(state.phase, core.PHASES.RESULTS, trackId + ' / ' + variant.id + ' / ' + seed + ' did not resolve');
      assert.equal(state.result.routeDirectionId, core.ROUTE_DIRECTION_IDS.REFLECTION);
      assert.equal(state.result.routeDirectionLabel, 'REFLECTION RUN');
      assert.equal(state.result.equalStats, true);
      winners[state.result.winnerId] = (winners[state.result.winnerId] || 0) + 1;
      const racers = Object.values(state.racers);
      finishers += racers.filter(racer => racer.finishedAt != null).length;
      shortcuts += racers.reduce((sum, racer) => sum + racer.stats.shortcuts, 0);
      hazardsHit += racers.reduce((sum, racer) => sum + racer.stats.hazardsHit, 0);
      races += 1;
    }
  }
}
assert.equal(JSON.stringify(core.TRACKS), canonicalBefore, 'reflection races mutated canonical authored tracks');
assert(Object.keys(winners).length >= 3, 'reflection winner diversity collapsed');
assert(finishers >= races * 3, 'reflection completion rate fell below 75%');
assert(shortcuts >= races, 'reflection shortcuts were not meaningfully exercised');
assert(hazardsHit >= races, 'reflection hazards were not meaningfully exercised');

assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: .985 });
assert.equal(core.METRICS.catchupByRank[3], 1.075);
assert.equal(core.POWERUP_WEIGHTS.filter(entry => core.ITEM_TYPES[entry.id].attack).reduce((sum, entry) => sum + entry.weight, 0), 85);
assert.equal(core.METRICS.shieldMax, 3);

console.log('MIRRORSHIFT REFLECTION ROUTES PASS · ' + JSON.stringify({ races, winners, finishRate: Math.round(finishers / (races * 4) * 1000) / 10, shortcuts, hazardsHit }));
