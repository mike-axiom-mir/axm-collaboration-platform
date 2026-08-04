#!/usr/bin/env node
'use strict';

const assert = require('assert');
const core = require('../runtime/game-core');

function finishRound(state, ranking, startAt) {
  assert.equal(state.phase, core.PHASES.LOBBY);
  assert.equal(core.startRace(state, startAt).ok, true);
  const raceAt = startAt + core.METRICS.countdownMs;
  core.step(state, core.METRICS.countdownMs, raceAt);
  assert.equal(state.phase, core.PHASES.RACING);
  ranking.forEach((id, index) => {
    state.racers[id].finishedAt = raceAt + 100 + index;
    state.racers[id].finishPlace = index + 1;
  });
  state.winnerAt = raceAt + 100;
  const resultAt = raceAt + 200;
  core.step(state, 200, resultAt);
  assert.equal(state.phase, core.PHASES.RESULTS);
  return resultAt;
}

const assists = { p1: { steering: true, autoAccelerate: true } };
const state = core.createInitialState([], { seed: 17015, now: 0, mode: core.MODES.TOUR, trackId: core.TRACK_IDS.FOUNDRY, variantId: core.RACE_VARIANT_IDS.GAUNTLET, routeDirectionId: core.ROUTE_DIRECTION_IDS.REFLECTION, assists });

assert.equal(state.schema, 'axm.mirrorshift-state/v7');
assert.equal(state.mode, core.MODES.TOUR);
assert.equal(state.tour.schema, 'axm.mirrorshift-signal-tour/v1');
assert.equal(state.tour.roundCount, 3);
assert.deepEqual(state.tour.pointsTable, [9, 6, 4, 2]);
assert.equal(state.trackId, core.TRACK_IDS.FORGE);
assert.equal(state.variantId, core.RACE_VARIANT_IDS.CLEAR);
assert.equal(state.routeDirectionId, core.ROUTE_DIRECTION_IDS.FORWARD);
assert.equal(state.raceLaps, 3);
assert.equal(core.setTrack(state, core.TRACK_IDS.FOUNDRY, 1).reason, 'tour-itinerary');
assert.equal(core.setRaceVariant(state, core.RACE_VARIANT_IDS.GAUNTLET, 1).reason, 'tour-itinerary');
assert.equal(core.setRouteDirection(state, core.ROUTE_DIRECTION_IDS.REFLECTION, 1).reason, 'tour-itinerary');
assert.equal(core.isRaceMode(core.MODES.TOUR), true);
assert(Object.isFrozen(core.SIGNAL_TOUR));
assert(Object.isFrozen(core.SIGNAL_TOUR.rounds));
assert(Object.isFrozen(core.SIGNAL_TOUR.points));

let now = finishRound(state, ['p1', 'p2', 'p3', 'p4'], 10);
assert.equal(state.result.roundWinnerId, 'p1');
assert.equal(state.result.winnerId, 'p1');
assert.deepEqual(state.result.tour.points, { p1: 9, p2: 6, p3: 4, p4: 2 });
assert.deepEqual(state.result.tour.standings, ['p1', 'p2', 'p3', 'p4']);
assert.equal(state.result.tour.complete, false);
assert.deepEqual(state.result.tour.nextRound, { number: 2, trackId: core.TRACK_IDS.GARDENS, variantId: core.RACE_VARIANT_IDS.SPRINT });
const pointsAfterFirst = JSON.stringify(state.tour.points);
core.step(state, 500, now + 500);
assert.equal(JSON.stringify(state.tour.points), pointsAfterFirst, 'results ticks must not award a round twice');

state.racers.p1.stats.drifts = 7;
assert.equal(core.advanceTour(state, now + 600).ok, true);
assert.equal(state.phase, core.PHASES.LOBBY);
assert.equal(state.trackId, core.TRACK_IDS.GARDENS);
assert.equal(state.variantId, core.RACE_VARIANT_IDS.SPRINT);
assert.equal(state.routeDirectionId, core.ROUTE_DIRECTION_IDS.FORWARD);
assert.equal(state.raceLaps, 2);
assert.equal(state.racers.p1.stats.drifts, 0);
assert.equal(state.racers.p1.shield, 3);
assert.equal(state.racers.p1.assists.steering, .22);
assert.equal(state.racers.p1.assists.autoAccelerate, true);

now = finishRound(state, ['p2', 'p1', 'p4', 'p3'], now + 700);
assert.deepEqual(state.result.tour.points, { p1: 15, p2: 15, p3: 6, p4: 6 });
assert.deepEqual(state.result.tour.standings, ['p2', 'p1', 'p4', 'p3'], 'latest round placement breaks equal-point ties');
assert.equal(state.tour.roundResults.length, 2);
assert.equal(state.tour.roundResults.reduce((total, round) => total + Object.values(round.pointsAwarded).reduce((sum, value) => sum + value, 0), 0), 42);

assert.equal(core.advanceTour(state, now + 100).ok, true);
assert.equal(state.trackId, core.TRACK_IDS.FOUNDRY);
assert.equal(state.variantId, core.RACE_VARIANT_IDS.GAUNTLET);
assert.equal(state.routeDirectionId, core.ROUTE_DIRECTION_IDS.FORWARD);
assert.equal(state.raceLaps, 4);
now = finishRound(state, ['p4', 'p3', 'p1', 'p2'], now + 200);

assert.equal(state.result.tour.complete, true);
assert.equal(state.result.tour.championId, 'p1');
assert.equal(state.result.winnerId, 'p1', 'final presentation winner is the cumulative champion');
assert.equal(state.result.roundWinnerId, 'p4', 'final race winner remains explicit when different from champion');
assert.deepEqual(state.result.tour.points, { p1: 19, p2: 17, p3: 12, p4: 15 });
assert.deepEqual(state.result.tour.standings, ['p1', 'p2', 'p4', 'p3']);
assert.equal(state.tour.roundResults.length, 3);
assert.equal(state.tour.roundResults.reduce((total, round) => total + Object.values(round.pointsAwarded).reduce((sum, value) => sum + value, 0), 0), 63);
assert.equal(core.advanceTour(state, now + 100).reason, 'tour-complete');

assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
assert.deepEqual(core.METRICS.catchupByRank, [1, 1.025, 1.05, 1.075]);
assert.equal(core.POWERUP_WEIGHTS.filter(entry => core.ITEM_TYPES[entry.id].attack).reduce((sum, entry) => sum + entry.weight, 0), 85);
assert.equal(core.METRICS.shieldMax, 3);

console.log('MIRRORSHIFT SIGNAL TOUR PASS · 3 server-owned rounds · 63 awarded points · latest-round tie-break · champion/result split · no double award · frozen mechanics intact');
