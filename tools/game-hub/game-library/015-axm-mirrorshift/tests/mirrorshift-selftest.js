#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../runtime/game-core');
const recorderCore = require('../runtime/performance-recorder');
const lanCore = require('../runtime/lan-qualification');
const verifier = require('../../../game-package-verifier');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS ' + name);
  } catch (error) {
    console.error('FAIL ' + name + '\n  ' + error.stack);
    process.exitCode = 1;
  }
}

function racingState(roster) {
  const state = core.createInitialState(roster || [], { seed: 15015, now: 0 });
  assert.equal(core.startRace(state, 0).ok, true);
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  assert.equal(state.phase, core.PHASES.RACING);
  return state;
}

function battleState() {
  const roster = core.RACERS.map(item => ({ id: item.id, displayName: item.name, seatId: item.id, type: 'human' }));
  const state = core.createInitialState(roster, { seed: 26015, now: 0, mode: core.MODES.BATTLE });
  assert.equal(core.startRace(state, 0).ok, true);
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  assert.equal(state.phase, core.PHASES.RACING);
  return state;
}

test('roster contains the four requested original AXM characters and four vehicle styles', () => {
  assert.deepEqual(core.RACERS.map(item => item.name), ['Mike', 'Axiom/Mir', 'Codex', 'Mirror']);
  assert.equal(new Set(core.RACERS.map(item => item.vehicle)).size, 4);
  assert.equal(new Set(core.RACERS.map(item => item.color)).size, 4);
});

test('all racers use one frozen equal-performance base stat contract', () => {
  assert(Object.isFrozen(core.BASE_STATS));
  assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
  const state = core.createInitialState([], { now: 0 });
  assert(Object.values(state.racers).every(racer => racer.speed === 0));
});

test('catch-up stays slight and caps fourth place at seven point five percent', () => {
  assert.deepEqual(core.METRICS.catchupByRank, [1, 1.025, 1.05, 1.075]);
  const state = racingState();
  state.racers.p1.progress = 4;
  state.racers.p2.progress = 3;
  state.racers.p3.progress = 2;
  state.racers.p4.progress = 1;
  core.updateRanking(state);
  assert.equal(state.racers.p1.catchup, 1);
  assert.equal(state.racers.p4.catchup, 1.075);
});

test('item table is eighty-five percent attack and fifteen percent repair', () => {
  const total = core.POWERUP_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  const attack = core.POWERUP_WEIGHTS.filter(item => core.ITEM_TYPES[item.id].attack).reduce((sum, item) => sum + item.weight, 0);
  assert.equal(total, 100);
  assert.equal(attack, 85);
  assert.equal(core.POWERUP_WEIGHTS.find(item => item.id === 'repair').weight, 15);
});

test('Mirror Core is a lobby-selected server mode with a ninety-percent attack pool', () => {
  const state = core.createInitialState([], { now: 0 });
  assert.equal(state.mode, core.MODES.RACE);
  assert.equal(core.setMode(state, core.MODES.BATTLE, 1).ok, true);
  assert.equal(state.mode, core.MODES.BATTLE);
  assert.equal(state.track.centerX, 640);
  assert.equal(state.pads.length, 12);
  const attackWeight = core.BATTLE_POWERUP_WEIGHTS.filter(entry => core.ITEM_TYPES[entry.id].attack).reduce((sum, entry) => sum + entry.weight, 0);
  assert.equal(attackWeight, 90);
  core.startRace(state, 2);
  assert.equal(core.setMode(state, core.MODES.RACE, 3).reason, 'mode-locked');
});

test('Mirror Core scores guard breaks and clean wipes without chain-stun farming', () => {
  const state = battleState();
  const attacker = state.racers.p1;
  const target = state.racers.p2;
  let now = core.METRICS.countdownMs + 1000;
  assert.equal(core.applyHit(state, target, 'fixture', now, attacker.id), true);
  assert.equal(attacker.score, 1);
  assert.equal(target.shield, 2);
  assert.equal(core.applyHit(state, target, 'fixture', now + 100, attacker.id), false);
  assert.equal(attacker.score, 1);
  now += core.METRICS.battleHitCooldownMs;
  core.applyHit(state, target, 'fixture', now, attacker.id);
  now += core.METRICS.battleHitCooldownMs;
  core.applyHit(state, target, 'fixture', now, attacker.id);
  assert.equal(target.shield, 0);
  assert.equal(attacker.score, 3);
  now += core.METRICS.battleHitCooldownMs;
  core.applyHit(state, target, 'fixture', now, attacker.id);
  assert.equal(attacker.score, 5);
  assert.equal(attacker.knockouts, 1);
  assert(target.respawnAt > now);
});

test('Mirror Core wipe recovery restores the base guard under temporary spawn protection', () => {
  const state = battleState();
  const attacker = state.racers.p1;
  const target = state.racers.p2;
  let now = core.METRICS.countdownMs + 1000;
  target.shield = 0;
  core.applyHit(state, target, 'fixture', now, attacker.id);
  const respawnAt = target.respawnAt;
  core.step(state, respawnAt - now, respawnAt);
  assert.equal(target.respawnAt, 0);
  assert.equal(target.shield, core.METRICS.shieldMax);
  assert.equal(target.stats.respawns, 1);
  assert.equal(core.applyHit(state, target, 'fixture', respawnAt + 10, attacker.id), false);
  assert(target.spawnProtectionUntil > respawnAt);
});

test('Mirror Core resolves by timer with score ranking and mode-specific results', () => {
  const state = battleState();
  state.racers.p3.score = 7;
  state.racers.p1.score = 5;
  const finishAt = state.battleEndsAt;
  core.step(state, core.METRICS.battleDurationMs, finishAt);
  assert.equal(state.phase, core.PHASES.RESULTS);
  assert.equal(state.result.mode, core.MODES.BATTLE);
  assert.equal(state.result.winnerId, 'p3');
  assert.equal(state.result.attackDropRate, .9);
  assert.equal(state.result.scores.p3, 7);
});

test('three hits remove Flux Guard and the next hit causes a full wipeout', () => {
  const state = racingState();
  const racer = state.racers.p1;
  racer.item = 'bolt';
  assert.equal(racer.shield, 3);
  core.applyHit(state, racer, 'fixture', 4000);
  core.applyHit(state, racer, 'fixture', 5000);
  core.applyHit(state, racer, 'fixture', 6000);
  assert.equal(racer.shield, 0);
  core.applyHit(state, racer, 'fixture', 7000);
  assert.equal(racer.item, null);
  assert(racer.spinUntil >= 8150);
  assert.equal(racer.stats.hits, 4);
});

test('Guard Patch repairs one segment and converts to boost when already full', () => {
  const state = racingState();
  const racer = state.racers.p1;
  racer.shield = 1;
  racer.item = 'repair';
  assert.equal(core.useItem(state, racer, 4000).ok, true);
  assert.equal(racer.shield, 2);
  assert.equal(racer.stats.repairs, 1);
  racer.shield = 3;
  racer.item = 'repair';
  core.useItem(state, racer, 5000);
  assert(racer.boostUntil > 5000);
});

test('EMP is an offensive area item that consumes nearby guard segments', () => {
  const state = racingState();
  const attacker = state.racers.p1;
  const target = state.racers.p2;
  target.x = attacker.x + 20;
  target.y = attacker.y;
  attacker.item = 'emp';
  const result = core.useItem(state, attacker, 4000);
  assert.equal(result.ok, true);
  assert(result.hits >= 1);
  assert.equal(target.shield, 2);
});

test('semantic drive input is clamped and stale sequences are refused', () => {
  const state = racingState([{ type: 'human', display_name: 'Mike' }]);
  const accepted = core.applyAction(state, 'p1', { type: 'drive', throttle: 8, brake: -2, steer: 5, seq: 3 }, 4000);
  assert.equal(accepted.ok, true);
  assert.deepEqual(state.racers.p1.input, { throttle: 1, brake: 0, steer: 1 });
  const stale = core.applyAction(state, 'p1', { type: 'drive', throttle: 0, steer: -1, seq: 3 }, 4100);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'stale-sequence');
});

test('empty seats are AI-filled while supplied human seats remain human', () => {
  const roster = core.normalizeRoster([{ seat_id: 'seat_a', display_name: 'Mike', type: 'human' }]);
  assert.equal(roster.length, 4);
  assert.equal(roster[0].type, 'human');
  assert(roster.slice(1).every(seat => seat.type === 'ai'));
  const state = core.createInitialState(roster, { now: 0 });
  assert.equal(state.racers.p1.ai, false);
  assert.equal(state.racers.p4.ai, true);
});

test('lobby character draft atomically swaps unique identities without changing seat ownership or performance', () => {
  const state = core.createInitialState([
    { seatId: 'seat_1', displayName: 'Mike', type: 'human' },
    { seatId: 'seat_2', displayName: 'Friend', type: 'human' }
  ], { now: 0, assists: { p1: { steering: true } } });
  const p1Before = { id: state.racers.p1.id, displayName: state.racers.p1.displayName, seatId: state.racers.p1.seatId, ai: state.racers.p1.ai, assists: state.racers.p1.assists };
  const p3Vehicle = state.racers.p3.vehicle;
  const result = core.setCharacter(state, 'p1', 'p3', 100);
  assert.equal(result.ok, true);
  assert.equal(result.swappedWith, 'p3');
  assert.equal(state.racers.p1.characterId, 'p3');
  assert.equal(state.racers.p1.character, 'Codex');
  assert.equal(state.racers.p1.vehicle, p3Vehicle);
  assert.equal(state.racers.p3.characterId, 'p1');
  assert.equal(state.racers.p3.character, 'Mike');
  assert.equal(new Set(Object.values(state.racers).map(racer => racer.characterId)).size, 4);
  assert.deepEqual({ id: state.racers.p1.id, displayName: state.racers.p1.displayName, seatId: state.racers.p1.seatId, ai: state.racers.p1.ai, assists: state.racers.p1.assists }, p1Before);
  assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
  assert.equal(core.startRace(state, 200).ok, true);
  assert.equal(core.setCharacter(state, 'p1', 'p2', 300).reason, 'character-locked');
});

test('four frozen character-expression contracts move with identity and never change performance', () => {
  assert(Object.isFrozen(core.CHARACTER_EXPRESSIONS));
  const expressions = Object.values(core.CHARACTER_EXPRESSIONS);
  assert.equal(expressions.length, 4);
  assert.equal(new Set(expressions.map(expression => expression.id)).size, 4);
  assert.equal(new Set(expressions.map(expression => expression.visual)).size, 4);
  assert.equal(new Set(expressions.map(expression => expression.motif.join(','))).size, 4);
  expressions.forEach(expression => {
    assert(Object.isFrozen(expression));
    assert(Object.isFrozen(expression.motif));
    assert.equal(expression.motif.length, 4);
    assert.equal(expression.changesPerformance, false);
  });
  const baseBefore = JSON.stringify(core.BASE_STATS);
  const state = core.createInitialState([], { now: 0 });
  const result = core.setCharacter(state, 'p1', 'p4', 100);
  assert.equal(result.ok, true);
  assert.equal(state.racers.p1.expressionId, 'prism-echo');
  assert.equal(state.racers.p1.expressionLabel, 'RETURN SIGNAL');
  assert.equal(state.racers.p1.signatureQuote, 'I saw that move coming back.');
  assert.equal(state.racers.p4.expressionId, 'maker-ratchet');
  const draftEvent = state.events[state.events.length - 1];
  assert.equal(draftEvent.characterId, 'p4');
  assert.equal(draftEvent.expressionId, 'prism-echo');
  core.startRace(state, 200);
  const countdownEvent = state.events[state.events.length - 1];
  assert.equal(countdownEvent.characterId, 'p4');
  assert.equal(countdownEvent.expressionId, 'prism-echo');
  assert.equal(JSON.stringify(core.BASE_STATS), baseBefore);
});

test('four kinetic identity rigs remain presentation-only and reduced-motion aware', () => {
  assert(Object.isFrozen(core.KINETIC_RIGS));
  const rigs = Object.values(core.KINETIC_RIGS);
  assert.equal(rigs.length, 4);
  assert.equal(new Set(rigs.map(rig => rig.id)).size, 4);
  assert.equal(new Set(rigs.map(rig => rig.motion)).size, 4);
  rigs.forEach(rig => {
    assert(Object.isFrozen(rig));
    assert.equal(rig.changesPerformance, false);
  });
  const state = core.createInitialState([], { now: 0 });
  state.racers.p1.speed = 220;
  state.racers.p1.input = { throttle: 1, brake: 0, steer: .8 };
  state.racers.p1.drifting = true;
  state.racers.p1.driftDirection = 1;
  const before = JSON.stringify(state);
  const full = core.vehicleAnimationPose(state.racers.p1, 2400, 1000, false);
  const reduced = core.vehicleAnimationPose(state.racers.p1, 2400, 1000, true);
  assert.equal(full.schema, 'axm.vehicle-animation-pose/v1');
  assert.equal(full.rigId, 'maker-piston-rig');
  assert.equal(full.state, 'drift');
  assert.equal(full.changesPerformance, false);
  assert.equal(reduced.wheelSpin, 0);
  assert.equal(reduced.signaturePhase, .5);
  assert(Math.abs(reduced.bodyRoll) < Math.abs(full.bodyRoll));
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: .985 });
});

test('coarse lobby countdown racing state machine and visible observation contract are explicit', () => {
  const state = core.createInitialState([], { now: 0 });
  assert.equal(state.phase, 'lobby');
  core.startRace(state, 0);
  assert.equal(state.phase, 'countdown');
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  assert.equal(state.phase, 'racing');
  const observation = core.observe(state, 'p1');
  assert.equal(observation.hiddenStateExcluded, true);
  assert.deepEqual(observation.allowedIntents, ['drive', 'item', 'start', 'character']);
  assert.equal(observation.visibleRace.length, 4);
  assert(!Object.prototype.hasOwnProperty.call(observation, 'rng'));
});

test('human throttle advances the shared authoritative simulation', () => {
  const state = racingState([{ type: 'human' }]);
  const before = { x: state.racers.p1.x, y: state.racers.p1.y };
  core.applyAction(state, 'p1', { type: 'drive', throttle: 1, steer: 0, seq: 1 }, 3300);
  for (let index = 0; index < 20; index += 1) core.step(state, 50, 3350 + index * 50);
  assert(state.racers.p1.speed > 0);
  assert(Math.hypot(state.racers.p1.x - before.x, state.racers.p1.y - before.y) > 10);
});

test('brake plus throttle plus steering charges an equal-spec drift and release grants boost', () => {
  const state = racingState([{ type: 'human' }]);
  const racer = state.racers.p1;
  racer.speed = 155;
  core.applyAction(state, 'p1', { type: 'drive', throttle: 1, brake: .45, steer: .85, seq: 1 }, 3300);
  for (let index = 0; index < 9; index += 1) core.step(state, 40, 3340 + index * 40);
  assert.equal(racer.drifting, true);
  assert(racer.driftCharge >= core.METRICS.driftTierThresholds[0]);
  const chargedTier = racer.driftTier;
  core.applyAction(state, 'p1', { type: 'drive', throttle: 1, brake: 0, steer: .85, seq: 2 }, 3740);
  core.step(state, 40, 3780);
  assert.equal(racer.drifting, false);
  assert(racer.boostUntil > 3780);
  assert.equal(racer.stats.drifts, 1);
  assert.equal(racer.stats.bestDriftTier, chargedTier);
  assert(state.events.some(event => event.type === 'drift'));
});

test('drift tiers map to blue violet and overdrive with increasing equal boost contracts', () => {
  assert.equal(core.driftTierForCharge(.23), 0);
  assert.equal(core.driftTierForCharge(.24), 1);
  assert.equal(core.driftTierForCharge(.55), 2);
  assert.equal(core.driftTierForCharge(.86), 3);
  assert(core.METRICS.driftBoostPower[3] > core.METRICS.driftBoostPower[2]);
  assert(core.METRICS.driftBoostMs[2] > core.METRICS.driftBoostMs[1]);
  const state = racingState([{ type: 'human' }]);
  const racer = state.racers.p1;
  racer.drifting = true;
  racer.driftCharge = .9;
  racer.driftTier = 3;
  assert.equal(core.releaseDrift(state, racer, 4000), 3);
  assert.equal(racer.boostPower, core.METRICS.driftBoostPower[3]);
  assert.equal(racer.stats.bestDriftTier, 3);
});

test('combat hits cancel charged drift and boost so shield damage remains meaningful', () => {
  const state = racingState();
  const racer = state.racers.p1;
  racer.drifting = true;
  racer.driftCharge = .7;
  racer.driftTier = 2;
  racer.boostUntil = 9000;
  racer.boostPower = 1.18;
  core.applyHit(state, racer, 'fixture', 4000);
  assert.equal(racer.drifting, false);
  assert.equal(racer.driftCharge, 0);
  assert.equal(racer.boostUntil, 0);
  assert.equal(racer.boostPower, 1);
});

test('seat-visible observation exposes drift charge without leaking authoritative hidden state', () => {
  const state = racingState([{ type: 'human' }]);
  const racer = state.racers.p1;
  racer.drifting = true;
  racer.driftCharge = .6;
  racer.driftTier = 2;
  const observation = core.observe(state, 'p1');
  assert.deepEqual(observation.self.drift, { active: true, charge: .6, tier: 2, boosting: false, boostPower: 1 });
  assert(!Object.prototype.hasOwnProperty.call(observation, 'projectiles'));
});

test('AI racers cannot register false lap wraps during the opening ten seconds', () => {
  const state = racingState();
  for (let index = 0; index < 200; index += 1) core.step(state, 50, 3250 + index * 50);
  assert.equal(state.phase, core.PHASES.RACING);
  assert(Object.values(state.racers).every(racer => racer.finishedAt == null));
  assert(Object.values(state.racers).every(racer => racer.lap <= 1));
});

test('an off-route nearest-point jump cannot counterfeit a completed lap', () => {
  const state = racingState([{ type: 'human' }]);
  const racer = state.racers.p1;
  const high = Math.floor(core.TRACK.points.length * .82);
  const low = Math.floor(core.TRACK.points.length * .08);
  racer.trackIndex = high;
  racer.lastTrackIndex = high;
  racer.lapCheckpoint = 0;
  racer.speed = 90;
  racer.x = core.TRACK.points[low].x;
  racer.y = core.TRACK.points[low].y;
  racer.heading = 0;
  racer.lastInputAt = core.METRICS.countdownMs;
  core.step(state, 1, core.METRICS.countdownMs + 1);
  assert.equal(racer.lap, 0);
  assert.equal(racer.lapCheckpoint, 0);
});

test('three authored circuits expose distinct geometry hazards landmarks and shortcuts', () => {
  assert.equal(core.TRACK_CATALOG.length, 3);
  assert.deepEqual(core.TRACK_CATALOG.map(track => track.id), ['mirror-forge', 'splitglass-gardens', 'null-foundry']);
  const tracks = Object.values(core.TRACKS);
  assert.equal(new Set(tracks.map(track => track.points.slice(0, 24).map(point => point.x + ':' + point.y).join('|'))).size, 3);
  assert.equal(new Set(tracks.map(track => track.theme.road)).size, 3);
  assert.equal(new Set(tracks.map(track => track.hazards[0].type)).size, 3);
  assert(tracks.every(track => track.landmarks.length >= 3));
  assert(tracks.every(track => track.shortcuts.length >= 1));
});

test('circuit selection is lobby-only persists in observation and does not alter equal stats', () => {
  const state = core.createInitialState([], { now: 0 });
  assert.equal(core.setTrack(state, core.TRACK_IDS.GARDENS, 10).ok, true);
  assert.equal(state.trackId, core.TRACK_IDS.GARDENS);
  assert.equal(state.track.name, 'Splitglass Gardens');
  assert.equal(core.observe(state, 'p1').trackId, core.TRACK_IDS.GARDENS);
  assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
  core.startRace(state, 20);
  assert.equal(core.setTrack(state, core.TRACK_IDS.FOUNDRY, 30).reason, 'track-locked');
  const battle = core.createInitialState([], { now: 0, mode: core.MODES.BATTLE, trackId: core.TRACK_IDS.GARDENS });
  assert.equal(core.setTrack(battle, core.TRACK_IDS.FOUNDRY, 1).reason, 'battle-mode');
  assert.equal(battle.trackId, core.TRACK_IDS.GARDENS);
});

test('reflection routes are lobby-locked server state with fixed finish geometry and unchanged mechanics', () => {
  assert.deepEqual(core.ROUTE_DIRECTION_CATALOG.map(direction => direction.id), ['forward', 'reflection']);
  const state = core.createInitialState([], { now: 0 });
  const forward = state.track;
  assert.equal(core.setRouteDirection(state, core.ROUTE_DIRECTION_IDS.REFLECTION, 10).ok, true);
  assert.equal(state.routeDirectionId, core.ROUTE_DIRECTION_IDS.REFLECTION);
  assert.deepEqual(state.track.points[0], forward.points[0]);
  assert.deepEqual(state.track.points[1], forward.points[forward.points.length - 1]);
  assert.equal(core.observe(state, 'p1').routeDirectionLabel, 'REFLECTION RUN');
  assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
  assert.deepEqual(core.METRICS.catchupByRank, [1, 1.025, 1.05, 1.075]);
  core.startRace(state, 20);
  assert.equal(core.setRouteDirection(state, core.ROUTE_DIRECTION_IDS.FORWARD, 30).reason, 'route-direction-locked');
  const tour = core.createInitialState([], { now: 0, mode: core.MODES.TOUR, routeDirectionId: core.ROUTE_DIRECTION_IDS.REFLECTION });
  assert.equal(tour.routeDirectionId, core.ROUTE_DIRECTION_IDS.FORWARD);
  assert.equal(core.setRouteDirection(tour, core.ROUTE_DIRECTION_IDS.REFLECTION, 1).reason, 'tour-itinerary');
});

test('three lobby-locked race variants change shared format pressure without changing car stats or catch-up', () => {
  assert.equal(core.RACE_VARIANT_CATALOG.length, 3);
  assert.deepEqual(core.RACE_VARIANT_CATALOG.map(variant => variant.id), ['clear-signal', 'shardline-sprint', 'redline-gauntlet']);
  assert.deepEqual(core.RACE_VARIANT_CATALOG.map(variant => variant.laps), [3, 2, 4]);
  assert(core.RACE_VARIANT_CATALOG.every(variant => Object.isFrozen(variant)));
  assert(core.RACE_VARIANT_CATALOG.every(variant => variant.changesVehicleStats === false && variant.changesCatchup === false && variant.lobbyLocked === true));
  const state = core.createInitialState([], { now: 0 });
  assert.equal(core.setRaceVariant(state, core.RACE_VARIANT_IDS.SPRINT, 10).ok, true);
  assert.equal(state.variantId, core.RACE_VARIANT_IDS.SPRINT);
  assert.equal(state.raceLaps, 2);
  assert.equal(core.observe(state, 'p1').variantLabel, 'SHARDLINE SPRINT');
  assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
  assert.deepEqual(core.METRICS.catchupByRank, [1, 1.025, 1.05, 1.075]);
  const hazard = core.TRACKS[core.TRACK_IDS.FORGE].hazards[0];
  let clearSamples = 0;
  let redlineSamples = 0;
  for (let now = 0; now < 10000; now += 40) {
    clearSamples += core.hazardActive(hazard, now, core.RACE_VARIANT_IDS.CLEAR) ? 1 : 0;
    redlineSamples += core.hazardActive(hazard, now, core.RACE_VARIANT_IDS.GAUNTLET) ? 1 : 0;
  }
  assert(redlineSamples > clearSamples * 1.25);
  core.startRace(state, 20);
  assert.equal(core.setRaceVariant(state, core.RACE_VARIANT_IDS.GAUNTLET, 30).reason, 'variant-locked');
  const battle = core.createInitialState([], { now: 0, mode: core.MODES.BATTLE });
  assert.equal(core.setRaceVariant(battle, core.RACE_VARIANT_IDS.GAUNTLET, 1).reason, 'battle-mode');
});

test('driving assists are transparent lobby-owned input transforms with equal stats unchanged', () => {
  const roster = core.RACERS.map((item, index) => ({ id: item.id, type: index === 0 ? 'human' : 'ai' }));
  const state = core.createInitialState(roster, { now: 0 });
  const enabled = core.setAssists(state, 'p1', { steering: true, autoAccelerate: true }, 10);
  assert.equal(enabled.ok, true);
  assert.deepEqual(state.racers.p1.assists, { steering: core.ASSIST_CONTRACT.steeringStrength, autoAccelerate: true });
  assert.equal(core.ASSIST_CONTRACT.changesVehicleStats, false);
  assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
  assert.deepEqual(core.observe(state, 'p1').self.assists, state.racers.p1.assists);
  core.startRace(state, 20);
  assert.equal(core.setAssists(state, 'p1', { steering: false }, 30).reason, 'assists-locked');
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs + 20);
  for (let index = 0; index < 20; index += 1) core.step(state, 40, core.METRICS.countdownMs + 60 + index * 40);
  assert.equal(state.racers.p1.input.throttle, 0);
  assert(state.racers.p1.speed > 0);
  assert.equal(state.racers.p1.assistActive.autoAccelerate, true);
});

test('adaptive score director maps track mode pressure and outcome to layered music states', () => {
  const lobby = core.createInitialState([], { now: 0, trackId: core.TRACK_IDS.GARDENS });
  assert.deepEqual(core.musicStateFor(lobby, 'p1'), {
    schema: 'axm.adaptive-music-state/v1', id: 'gardens-clear-signal-lobby', profile: 'gardens', variantId: 'clear-signal', cue: 'lobby', intensity: 0,
    tempo: 100, rootMidi: 53, scale: [0, 2, 5, 7, 9], layers: ['pulse'], reason: 'waiting in lobby'
  });
  core.startRace(lobby, 0);
  assert.equal(core.musicStateFor(lobby, 'p1').cue, 'charge');
  core.step(lobby, core.METRICS.countdownMs, core.METRICS.countdownMs);
  const racer = lobby.racers.p1;
  racer.rank = 4;
  assert.equal(core.musicStateFor(lobby, 'p1').cue, 'chase');
  racer.shield = 1;
  assert.equal(core.musicStateFor(lobby, 'p1').cue, 'danger');
  racer.shield = 3;
  racer.boostUntil = lobby.now + 1000;
  assert.equal(core.musicStateFor(lobby, 'p1').cue, 'overdrive');
  racer.boostUntil = 0;
  racer.lap = 2;
  assert.equal(core.musicStateFor(lobby, 'p1').cue, 'final-lap');
  lobby.phase = core.PHASES.RESULTS;
  lobby.result = { winnerId: 'p1' };
  assert.equal(core.musicStateFor(lobby, 'p1').cue, 'victory');
  const gauntlet = core.createInitialState([], { now: 0, trackId: core.TRACK_IDS.GARDENS, variantId: core.RACE_VARIANT_IDS.GAUNTLET });
  assert.equal(core.musicStateFor(gauntlet, 'p1').tempo, 109);
  assert.equal(core.musicStateFor(gauntlet, 'p1').variantId, core.RACE_VARIANT_IDS.GAUNTLET);

  const battle = battleState();
  assert.equal(core.musicStateFor(battle, 'p1').cue, 'core-pressure');
  battle.battleEndsAt = battle.now + 14000;
  assert.equal(core.musicStateFor(battle, 'p1').cue, 'core-showdown');
  assert.equal(core.musicStateFor(battle, 'p1').intensity, 3);
  assert(core.musicStateFor(battle, 'p1').layers.includes('spark'));
  assert.equal(new Set(Object.values(core.MUSIC_PROFILES).map(profile => profile.rootMidi)).size, 4);
});

test('shortcut corridors require physical entry and advance ordered progress', () => {
  const state = core.createInitialState(core.RACERS.map(item => ({ id: item.id, type: 'human' })), { seed: 15015, now: 0, trackId: core.TRACK_IDS.FORGE });
  core.startRace(state, 0);
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  const racer = state.racers.p1;
  const shortcut = state.track.shortcuts[0];
  racer.x = shortcut.from.x;
  racer.y = shortcut.from.y;
  racer.trackIndex = shortcut.entryIndex;
  racer.lastTrackIndex = shortcut.entryIndex;
  racer.heading = Math.atan2(shortcut.to.y - shortcut.from.y, shortcut.to.x - shortcut.from.x);
  racer.speed = 120;
  racer.lastInputAt = state.now;
  core.step(state, 40, state.now + 40);
  assert.equal(racer.activeShortcutId, shortcut.id);
  assert.equal(racer.stats.shortcuts, 1);
  assert.equal(racer.offRoad, false);
  assert(racer.trackIndex >= shortcut.entryIndex);
});

test('live circuit hazards disrupt speed on cooldown without consuming Flux Guard', () => {
  const roster = core.RACERS.map(item => ({ id: item.id, type: 'human' }));
  const state = core.createInitialState(roster, { seed: 15, now: 0, trackId: core.TRACK_IDS.FOUNDRY });
  core.startRace(state, 0);
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  const racer = state.racers.p1;
  const hazard = state.track.hazards[0];
  let now = state.now;
  while (!core.hazardActive(hazard, now)) now += 20;
  racer.x = hazard.x;
  racer.y = hazard.y;
  racer.trackIndex = hazard.index;
  racer.speed = 200;
  racer.lastInputAt = now;
  core.step(state, 1, now);
  assert.equal(racer.stats.hazardsHit, 1);
  assert.equal(racer.shield, core.METRICS.shieldMax);
  assert(racer.speed < 100);
  const cooldown = racer.hazardCooldownUntil;
  core.step(state, 1, now + 1);
  assert.equal(racer.stats.hazardsHit, 1);
  assert(cooldown > now);
});

test('presentation interpolation smooths packet poses without mutating authoritative state', () => {
  const previous = { x: 10, y: 30, heading: Math.PI - .1, speed: 140 };
  const current = { x: 30, y: 50, heading: -Math.PI + .1, speed: 160 };
  const previousReceipt = JSON.stringify(previous);
  const currentReceipt = JSON.stringify(current);
  const midpoint = core.interpolatePresentationPose(previous, current, .5, 180);
  assert.equal(midpoint.x, 20);
  assert.equal(midpoint.y, 40);
  assert(Math.abs(Math.abs(midpoint.heading) - Math.PI) < .001, 'heading follows the shortest wrap-safe arc');
  assert.equal(midpoint.interpolated, true);
  assert.equal(midpoint.snapped, false);
  const snapped = core.interpolatePresentationPose(previous, { x: 500, y: 500, heading: 0 }, .5, 180);
  assert.equal(snapped.x, 500);
  assert.equal(snapped.y, 500);
  assert.equal(snapped.interpolated, false);
  assert.equal(snapped.snapped, true);
  assert.equal(JSON.stringify(previous), previousReceipt);
  assert.equal(JSON.stringify(current), currentReceipt);
});

test('target session recorder is bounded partial-aware and authority-read-only', () => {
  let recorderNow = 0;
  const recorder = recorderCore.createSession({ requestedDurationMs: 10000, now: () => recorderNow, wallNow: () => 0 });
  assert.equal(recorder.start({ label: 'FOCUSED SMOKE', viewportWidth: 1280, viewportHeight: 720 }), true);
  for (let index = 0; index < 600; index += 1) {
    recorderNow += 16.67;
    recorder.recordFrame(16.67);
  }
  recorder.recordDiagnostics({ averageRenderMs: 1.5, uiUpdateAverageMs: .6, schedulingWaitMs: 15.1, authorityPacketMs: 91, interpolationFrames: 80, poseSnapFrames: 0, workload: 'race:mirror-forge:clear-signal:racing' });
  recorderNow = 10000;
  const receipt = recorder.stop('duration-complete');
  assert.equal(receipt.status, 'complete');
  assert.equal(receipt.thirtyMinuteGateEligible, false);
  assert.equal(receipt.durationClass, 'bounded-smoke');
  assert.equal(receipt.frameMs.samples, 600);
  assert.equal(receipt.privacy.rawFramesRetained, false);
  assert.equal(receipt.privacy.userAgentRetained, false);
  assert.equal(receipt.interpolation.snaps, 0);
  assert(!Object.prototype.hasOwnProperty.call(receipt, 'authorityState'));
});

test('four-phone LAN qualification preserves the external physical-device verdict', () => {
  let qualificationNow = 0;
  const qualification = lanCore.createQualification({ requestedDurationMs: 10000, now: () => qualificationNow, wallNow: () => 0 });
  assert.equal(qualification.start(), true);
  qualification.recordTelemetry({ ok: true, transport: { actionReceipts: {}, sessions: [] } });
  qualificationNow = 10000;
  const receipt = qualification.stop('focused-smoke');
  assert.equal(receipt.schema, lanCore.SCHEMA);
  assert.equal(receipt.status, 'complete');
  assert.equal(receipt.durationClass, 'bounded-smoke');
  assert.equal(receipt.eligibleForStewardReview, false);
  assert.equal(receipt.physicalGateVerdict, 'requires-external-steward-review');
  assert.equal(receipt.privacy.sessionIdsRetained, false);
  assert.equal(receipt.seats.length, 4);
});

test('manifest, responsive controller, key art and capability evidence are package-valid', () => {
  const report = verifier.verifyGameDir(ROOT);
  assert.deepEqual(report.errors, []);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.manifest.json'), 'utf8'));
  assert.equal(manifest.rules.equal_base_vehicle_stats, true);
  assert.equal(manifest.rules.equal_drift_contract, true);
  assert.equal(manifest.rules.drift_tiers, 3);
  assert.equal(manifest.rules.battle_attack_item_probability, .9);
  assert.equal(manifest.rules.battle_score_to_win, core.METRICS.battleScoreToWin);
  assert(manifest.rules.available_modes.includes('mirror-core'));
  assert(manifest.rules.available_modes.includes('signal-tour'));
  assert.equal(manifest.rules.signal_tour_schema, core.SIGNAL_TOUR.schema);
  assert.equal(manifest.rules.signal_tour_server_authoritative, true);
  assert.deepEqual(manifest.rules.signal_tour_points, [9, 6, 4, 2]);
  assert.equal(manifest.rules.signal_tour_changes_vehicle_stats, false);
  assert.equal(manifest.rules.signal_tour_changes_catchup, false);
  assert.equal(manifest.rules.signal_tour_changes_item_weights, false);
  assert.equal(manifest.rules.signal_tour_changes_flux_guard, false);
  assert.equal(manifest.rules.signal_tour_route_direction_locked, 'forward');
  assert.deepEqual(manifest.rules.available_tracks, core.TRACK_CATALOG.map(track => track.id));
  assert.equal(manifest.rules.route_direction_schema, 'axm.route-direction/v1');
  assert.deepEqual(manifest.rules.available_route_directions, core.ROUTE_DIRECTION_CATALOG.map(direction => direction.id));
  assert.equal(manifest.rules.route_direction_server_authoritative, true);
  assert.equal(manifest.rules.route_direction_changes_vehicle_stats, false);
  assert.equal(manifest.rules.route_direction_changes_catchup, false);
  assert.equal(manifest.rules.route_direction_lobby_locked, true);
  assert.equal(manifest.rules.reflection_route_finish_line_fixed, true);
  assert.equal(manifest.rules.physical_shortcuts, true);
  assert.equal(manifest.rules.timed_track_hazards, true);
  assert.deepEqual(manifest.rules.available_race_variants, core.RACE_VARIANT_CATALOG.map(variant => variant.id));
  assert.deepEqual(manifest.rules.race_variant_laps, { 'clear-signal': 3, 'shardline-sprint': 2, 'redline-gauntlet': 4 });
  assert.equal(manifest.rules.race_variants_change_vehicle_stats, false);
  assert.equal(manifest.rules.race_variants_change_catchup, false);
  assert.equal(manifest.rules.race_variants_lobby_locked, true);
  assert.equal(manifest.rules.presentation_only_pose_interpolation, true);
  assert.equal(manifest.rules.presentation_interpolation_changes_authority, false);
  assert.equal(manifest.rules.presentation_interpolation_snap_distance, 180);
  assert.equal(manifest.rules.render_diagnostics_schema, 'axm.render-performance-diagnostics/v1');
  assert.equal(manifest.rules.target_session_performance_recorder, true);
  assert.equal(manifest.rules.target_session_recorder_changes_authority, false);
  assert.equal(manifest.rules.target_session_recorder_schema, recorderCore.SCHEMA);
  assert.equal(manifest.rules.target_session_recorder_max_minutes, 30);
  assert.equal(manifest.rules.four_phone_lan_qualification_recorder, true);
  assert.equal(manifest.rules.lan_qualification_changes_authority, false);
  assert.equal(manifest.rules.lan_qualification_schema, lanCore.SCHEMA);
  assert.equal(manifest.rules.lan_qualification_preflight_schema, lanCore.PREFLIGHT_SCHEMA);
  assert.equal(manifest.rules.lan_qualification_start_requires_four_stable_controller_seats, true);
  assert.equal(manifest.rules.controller_seat_confirmation_schema, 'axm.mirrorshift-seat-confirmation/v1');
  assert.equal(manifest.rules.lan_qualification_start_requires_controller_confirmation, true);
  assert.equal(manifest.rules.controller_confirmation_self_certifies_physical_hardware, false);
  assert.equal(manifest.rules.lan_qualification_self_certifies_physical_hardware, false);
  assert.equal(manifest.rules.assists_change_vehicle_stats, false);
  assert.equal(manifest.rules.assists_lobby_locked, true);
  assert.equal(manifest.rules.adaptive_music, true);
  assert.deepEqual(manifest.rules.adaptive_music_profiles, ['forge', 'gardens', 'foundry', 'core']);
  assert.equal(manifest.rules.music_respects_mute, true);
  assert.equal(manifest.rules.resumable_input_sessions, true);
  assert.equal(manifest.rules.action_acknowledgement_receipts, true);
  assert.equal(manifest.rules.client_round_trip_telemetry, true);
  assert.equal(manifest.rules.session_heartbeat_ms, 1000);
  assert.equal(manifest.rules.same_seat_multi_client_sessions, true);
  assert.equal(manifest.rules.input_owner_lease_ms, 900);
  assert.equal(manifest.rules.lobby_character_selection, true);
  assert.equal(manifest.rules.character_duplicate_policy, 'atomic-swap');
  assert.equal(manifest.rules.character_expression_profiles, 4);
  assert.deepEqual(manifest.rules.character_expression_modalities, ['signature-callout', 'launch-flourish', 'four-note-motif', 'winner-quote']);
  assert.equal(manifest.rules.character_expression_changes_vehicle_stats, false);
  assert.equal(manifest.rules.character_expression_respects_reduced_motion, true);
  assert.equal(manifest.rules.kinetic_identity_schema, 'axm.vehicle-animation-pose/v1');
  assert.deepEqual(manifest.rules.kinetic_identity_rigs, Object.values(core.KINETIC_RIGS).map(rig => rig.id));
  assert.deepEqual(manifest.rules.kinetic_identity_states, ['idle', 'drive', 'brake', 'drift', 'boost', 'impact']);
  assert.equal(manifest.rules.kinetic_identity_changes_vehicle_stats, false);
  assert.equal(manifest.rules.kinetic_identity_changes_authority, false);
  assert.equal(manifest.rules.kinetic_identity_respects_reduced_motion, true);
  assert.equal(manifest.rules.result_stage_schema, 'axm.result-stage-pose/v1');
  assert.equal(manifest.rules.result_stage_diagnostics_schema, 'axm.result-stage-diagnostics/v1');
  assert.deepEqual(manifest.rules.result_stage_moments, Object.values(core.RESULT_STAGE_MOMENTS).map(moment => moment.id));
  assert.equal(manifest.rules.result_stage_entrant_count, 4);
  assert.equal(manifest.rules.result_stage_changes_vehicle_stats, false);
  assert.equal(manifest.rules.result_stage_changes_authority, false);
  assert.equal(manifest.rules.result_stage_respects_reduced_motion, true);
  assert.equal(manifest.rules.mirror_echo_schema, 'axm.mirror-echo/v2');
  assert.equal(manifest.rules.mirror_echo_course_slots, 18);
  assert.equal(manifest.rules.mirror_echo_storage, 'bounded-browser-session-memory');
  assert.equal(manifest.rules.mirror_echo_changes_vehicle_stats, false);
  assert.equal(manifest.rules.mirror_echo_changes_authority, false);
  assert.equal(manifest.rules.mirror_echo_collision, false);
  assert.equal(manifest.rules.mirror_echo_visible_racer_count_change, 0);
  assert.equal(manifest.rules.local_virtual_rotation_soak_minutes, 30);
  assert.deepEqual(manifest.controls.keyboard_layouts, ['wasd-arrows', 'ijkl', 'esdf']);
  assert.deepEqual(manifest.controls.driving_assists, ['light-steering', 'auto-accelerate']);
  assert.equal(manifest.rules.attack_item_probability, 0.85);
  assert.equal(manifest.rules.starting_shield_segments, 3);
  const controller = fs.readFileSync(path.join(ROOT, 'runtime', 'controller.html'), 'utf8');
  assert(/name="viewport"/.test(controller));
  assert(/pointerdown/.test(controller));
  assert(/DRIFT READY/.test(controller));
  assert(/CONFIRM SEAT/.test(controller));
  const screen = fs.readFileSync(path.join(ROOT, 'runtime', 'index.html'), 'utf8');
  assert(/id="driftFill"/.test(screen));
  assert(/id="threatAlert"/.test(screen));
  assert(/data-control="brake"/.test(screen));
  assert(/data-mode="battle"/.test(screen));
  assert(/data-mode="tour"/.test(screen));
  assert(/SIGNAL TOUR/.test(screen));
  assert(/id="modePill"/.test(screen));
  assert(/id="keyboardLayout"/.test(screen));
  assert(/id="steeringAssist"/.test(screen));
  assert(/id="autoAccelerate"/.test(screen));
  assert(/id="echoButton"/.test(screen));
  assert(/mirror-echo\.js\?v=0\.21\.0/.test(screen));
  assert(/id="musicStatus"/.test(screen));
  assert(/id="resultsSignature"/.test(screen));
  assert(/id="variantGrid"/.test(screen));
  assert(/data-variant="shardline-sprint"/.test(screen));
  assert(/data-variant="redline-gauntlet"/.test(screen));
  assert(/data-route-direction="reflection"/.test(screen));
  assert(/MIRROR CORE/.test(screen));
  assert(/id="performancePanel"/.test(screen));
  assert(/performance-recorder\.js\?v=0\.13\.0/.test(screen));
  assert(/performance-ui\.js\?v=0\.13\.0/.test(screen));
  assert(/lan-qualification\.js\?v=0\.16\.0/.test(screen));
  assert(/lan-lab-ui\.js\?v=0\.16\.0/.test(screen));
  assert(/id="lanLabPanel"/.test(screen));
  const app = fs.readFileSync(path.join(ROOT, 'runtime', 'app.js'), 'utf8');
  assert(/mirrorshift-keyboard-layout/.test(app));
  assert(/createMusicDirector/.test(app));
  assert(/__MIRRORSHIFT_AUDIO__/.test(app));
  assert(/__MIRRORSHIFT_EXPRESSION__/.test(app));
  assert(/__MIRRORSHIFT_KINETIC__/.test(app));
  assert(/__MIRRORSHIFT_RESULT_STAGE__/.test(app));
  assert(/__MIRRORSHIFT_ECHO__/.test(app));
  assert(/__MIRRORSHIFT_ROUTE__/.test(app));
  assert(/drawMirrorEcho/.test(app));
  assert(/vehicleAnimationPose/.test(app));
  assert(/drawKineticIdentityRig/.test(app));
  assert(/playCharacterMotif/.test(app));
  assert(/drawCharacterFlourish/.test(app));
  assert(/__MIRRORSHIFT_VARIANT__/.test(app));
  assert(/__MIRRORSHIFT_RENDER__/.test(app));
  assert(/interpolatePresentationPose/.test(app));
  assert(/renderSchedulerLimited/.test(app));
  assert(/drawRaceVariantAtmosphere/.test(app));
  assert(/\/api\/variant/.test(app));
  assert(/\/api\/route-direction/.test(app));
  assert(/\/api\/tour\/advance/.test(app));
  assert(/__MIRRORSHIFT_TRANSPORT__/.test(app));
  assert(/\/api\/session/.test(app));
  assert(/\/api\/client-telemetry/.test(app));
  assert(/\/api\/heartbeat/.test(app));
  assert(/id="steerAssist"/.test(controller));
  assert(/id="autoGas"/.test(controller));
  assert(/id="previousCharacter"/.test(controller));
  assert(/id="nextCharacter"/.test(controller));
  assert(/\/api\/character/.test(controller));
  assert(/__MIRRORSHIFT_CONTROLLER_TRANSPORT__/.test(controller));
  assert(/\/api\/session/.test(controller));
  assert(/\/api\/client-telemetry/.test(controller));
  assert(/\/api\/heartbeat/.test(controller));
  assert(/\/api\/seat-confirm/.test(controller));
  assert(/data-character-id/.test(app));
  assert(/selectCharacter/.test(app));
  const performanceUi = fs.readFileSync(path.join(ROOT, 'runtime', 'performance-ui.js'), 'utf8');
  assert(/__MIRRORSHIFT_PERFORMANCE__/.test(performanceUi));
  assert(/\/api\/telemetry/.test(performanceUi));
  assert(/authorityWrites:\s*0/.test(performanceUi));
  assert(/SECOND BOUNDED SMOKE/.test(performanceUi));
  assert(/performancePrivacyRawFrames/.test(performanceUi));
  const lanUi = fs.readFileSync(path.join(ROOT, 'runtime', 'lan-lab-ui.js'), 'utf8');
  assert(/__MIRRORSHIFT_LAN_QUALIFICATION__/.test(lanUi));
  assert(/\/api\/telemetry/.test(lanUi));
  assert(/authorityWrites:\s*0/.test(lanUi));
  assert(/PHYSICAL GATE STILL OPEN/.test(lanUi));
  assert(/inspectPreflight/.test(lanUi));
  assert(/PREFLIGHT PASS/.test(lanUi));
  assert(manifest.package.required_paths.includes('tests/reliability-soak.test.js'));
  assert(manifest.package.required_paths.includes('tests/restart-recovery.test.js'));
  assert(manifest.package.required_paths.includes('tests/presentation-pipeline-soak.test.js'));
  assert(manifest.package.required_paths.includes('tests/target-session-recorder.test.js'));
  assert(manifest.package.required_paths.includes('evidence/target-session-recorder-contract.md'));
  assert(manifest.package.required_paths.includes('tests/four-phone-lan-qualification.test.js'));
  assert(manifest.package.required_paths.includes('evidence/four-phone-lan-qualification-contract.md'));
  assert(manifest.package.required_paths.includes('tests/signal-tour.test.js'));
  assert(manifest.package.required_paths.includes('evidence/signal-tour-contract.md'));
  assert(manifest.package.required_paths.includes('tests/kinetic-rig.test.js'));
  assert(manifest.package.required_paths.includes('evidence/kinetic-identity-contract.md'));
  assert(manifest.package.required_paths.includes('tests/result-stage.test.js'));
  assert(manifest.package.required_paths.includes('evidence/mirror-podium-contract.md'));
  assert(manifest.package.required_paths.includes('runtime/mirror-echo.js'));
  assert(manifest.package.required_paths.includes('tests/mirror-echo.test.js'));
  assert(manifest.package.required_paths.includes('evidence/mirror-echo-contract.md'));
  assert(manifest.package.required_paths.includes('tests/reflection-route.test.js'));
  assert(manifest.package.required_paths.includes('evidence/reflection-route-contract.md'));
  assert(fs.statSync(path.join(ROOT, 'runtime', 'assets', 'mirrorshift-roster-key-art-v1.png')).size > 500000);
  const gap = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence', 'capability-gap-report.json'), 'utf8'));
  assert.equal(gap.overall, 'UNKNOWN');
  assert.equal(gap.requirements.find(item => item.id === 'identity').status, 'READY');
  assert.equal(gap.requirements.find(item => item.id === 'driving-feel').status, 'READY');
  assert.equal(gap.requirements.find(item => item.id === 'accessibility').status, 'READY');
  assert.equal(gap.requirements.find(item => item.id === 'game-night').status, 'UNKNOWN');
  assert(gap.requirements.find(item => item.id === 'game-night').available.includes('state.reconnect.resume'));
  assert(gap.requirements.find(item => item.id === 'game-night').available.includes('qa.four-phone-lan.start-preflight'));
  assert(gap.requirements.find(item => item.id === 'game-night').available.includes('qa.four-phone-lan.controller-seat-confirmation'));
  assert(!gap.missingCapabilities.includes('content.mode.shield-battle'));
  assert(gap.requirements.find(item => item.id === 'content').available.includes('content.mode.signal-tour'));
  assert(gap.requirements.find(item => item.id === 'content').available.includes('content.routes.reflection'));
  assert(gap.requirements.find(item => item.id === 'content').available.includes('content.replay.mirror-echo'));
  assert(gap.requirements.find(item => item.id === 'presentation').available.includes('visual.motion.kinetic-identity'));
  assert(gap.requirements.find(item => item.id === 'presentation').available.includes('visual.motion.result-stage'));
  assert(gap.requirements.find(item => item.id === 'presentation').available.includes('visual.motion.environment-choreography'));
  assert(!gap.missingCapabilities.includes('content.tracks.three'));
  assert(!gap.missingCapabilities.includes('accessibility.input-remap'));
  assert(!gap.missingCapabilities.includes('accessibility.assists'));
  assert(!gap.missingCapabilities.includes('audio.music.adaptive'));
  assert.equal(gap.missingCapabilities.length, 0);
});

process.on('exit', () => {
  if (!process.exitCode) console.log('MIRRORSHIFT CORE SELFTEST PASS · ' + passed + ' checks');
});
