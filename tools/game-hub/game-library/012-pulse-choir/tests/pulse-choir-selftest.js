#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../runtime/game-core');
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

function playingState(roster) {
  const state = core.createInitialState(roster, { seed: 12026, now: 0 });
  assert.equal(core.startRound(state, 0).ok, true);
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  assert.equal(state.phase, core.PHASES.PLAYING);
  return state;
}

test('capability plan applies all twenty balanced Atlas domains', () => {
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'CAPABILITY_PLAN.json'), 'utf8'));
  assert.equal(plan.schema, 'axm.game-capability-plan/v1');
  assert.equal(plan.baselineModules.length, 20);
  assert.equal(new Set(plan.baselineModules.map(item => item.id)).size, 20);
  assert(plan.baselineModules.every(item => item.application && item.application.length > 24));
  assert(plan.supportingModules.includes('AXM-GAME-KNOWLEDGE-471'));
  assert(plan.supportingModules.includes('AXM-GAME-KNOWLEDGE-474'));
});

test('same seed and roster produce the same authoritative starting state', () => {
  const a = core.createInitialState([], { seed: 12026, now: 0 });
  const b = core.createInitialState([], { seed: 12026, now: 0 });
  assert.deepEqual(a.beats, b.beats);
  assert.deepEqual(a.players, b.players);
  assert.equal(a.beats.length, core.METRICS.targetBeatCount);
  assert.equal(a.setlist.conductor.mode, 'opening');
  assert.equal(a.show.next.conductor.schema, core.CONDUCTOR_SCHEMA);
});

test('Constellation Circuit is a deterministic five-venue show with distinct mechanical tuning', () => {
  assert.equal(core.METRICS.showArcRounds, 5);
  assert.equal(core.VENUE_CIRCUIT.length, 5);
  assert.equal(new Set(core.VENUE_CIRCUIT.map(venue => venue.id)).size, 5);
  assert(core.VENUE_CIRCUIT.every(venue => venue.beatCount >= 14 && venue.glitchCadenceMs >= 4000 && venue.rule.length > 24));
  assert.deepEqual(core.venueForRound(1), core.venueForRound(6));
  assert.equal(core.showPosition(5).roundInShow, 5);
  assert.deepEqual(core.showPosition(6), { showNumber: 2, roundInShow: 1 });
  const prism = core.createInitialState([], { seed: 12027, roundNumber: 2, show: { roundNumber: 2, completedRounds: 1 }, now: 0 });
  assert.equal(prism.venue.id, 'prism-causeway');
  assert.equal(prism.beats.length, 16);
  assert.equal(prism.show.next.venue.id, 'prism-causeway');
});

test('venue visits and mastery stamps migrate safely and persist across the full circuit', () => {
  const show = core.createShowMemory(12026);
  const receipts = {
    'moonwell-atrium': { actsCleared: 1 },
    'prism-causeway': { bestStreak: 3 },
    'static-garden': { totalGlitchHits: 0 },
    'twin-comet-bridge': { perfectSurges: 1 },
    'dawn-archive': { actsCleared: 3 }
  };
  core.VENUE_CIRCUIT.forEach((venue, index) => {
    assert.equal(core.recordVenueVisit(show, venue, Object.assign({ roundNumber: index + 1, score: 1000 + index }, receipts[venue.id])), true);
  });
  assert.equal(show.tour.schema, core.TOUR_SCHEMA);
  assert.equal(Object.keys(show.tour.visits).length, 5);
  assert.equal(Object.keys(show.tour.masteries).length, 5);
  const migrated = core.createShowMemory(12026, JSON.parse(JSON.stringify(show)));
  assert.deepEqual(migrated.tour, show.tour);
  const failed = core.recordVenueVisit(migrated, core.VENUE_CIRCUIT[4], { roundNumber: 6, score: 12, actsCleared: 2 });
  assert.equal(failed, false);
  assert.equal(migrated.tour.visits['dawn-archive'].count, 2);
  assert.equal(migrated.tour.masteries['dawn-archive'].count, 1);
});

test('Live Setlist is deterministic per seed while still varying future rounds', () => {
  const players = { p1: {}, p2: {}, p3: {} };
  const a = core.createSetlist(1, players);
  const b = core.createSetlist(1, players);
  const c = core.createSetlist(2, players);
  const d = core.createSetlist(3, players);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.acts.map(act => act.kind), c.acts.map(act => act.kind));
  assert.notDeepEqual(c.acts.map(act => act.kind), d.acts.map(act => act.kind));
  assert.equal(new Set([a,c,d].map(setlist => setlist.acts.map(act => act.kind).join(','))).size, 3);
  assert.equal(a.acts.length, 3);
  assert.equal(a.acts[0].humanRequired, true);
  assert.equal(a.acts[1].target, 3);
  assert(a.acts.every(act => act.status === 'queued' && act.reward > 0));
});

test('Live Conductor deterministically turns receipts into transparent next-round plans', () => {
  const reconnect = core.deriveConductorPlan({ history: [{ roundNumber: 1, rank: 'WARM-UP', actsCleared: 0, humanBanked: 0, humanPulses: 0 }] });
  assert.equal(reconnect.mode, 'reconnect');
  assert.deepEqual(reconnect.actKinds, ['human-pulses', 'all-seat-bank', 'chain-four']);
  assert(reconnect.reason.includes('Round 1'));
  const lockInReceipt = { roundNumber: 2, rank: 'IN RHYTHM', actsCleared: 2, humanBanked: 5, humanPulses: 3, perfectSurges: 0, bestStreak: 2 };
  const lockInA = core.deriveConductorPlan({ history: [lockInReceipt] }, 12027);
  const lockInB = core.deriveConductorPlan({ history: [lockInReceipt] }, 12027);
  assert.deepEqual(lockInA, lockInB);
  assert.equal(lockInA.mode, 'lock-in');
  assert(lockInA.actKinds.includes('perfect-choir'));
  assert(lockInA.actKinds.includes('chain-four'));
  const headliner = core.deriveConductorPlan({ history: [{ roundNumber: 3, rank: 'ENCORE', actsCleared: 3, humanBanked: 7, humanPulses: 4, perfectSurges: 1, bestStreak: 5 }] });
  assert.equal(headliner.mode, 'headliner');
  assert.deepEqual(headliner.actKinds, ['human-triad', 'perfect-choir', 'wild-two']);
  const adapted = core.createSetlist(12027, { p1: {}, p2: {} }, lockInA);
  assert.deepEqual(adapted.acts.map(act => act.kind), lockInA.actKinds);
  assert.deepEqual(adapted.conductor, lockInA);
  const legacy = playingState([{ slot: 1, display_name: 'Legacy Lead', type: 'human' }]);
  core.finishRound(legacy, 80000);
  delete legacy.show.next.conductor;
  delete legacy.setlist.conductor;
  assert.equal(core.normalizeConductorState(legacy), true);
  assert.equal(legacy.show.next.conductor.mode, 'reconnect');
  assert.equal(legacy.show.next.conductor.cue, 'CLEARER HUMAN LINK');
  assert.equal(legacy.setlist.conductor.mode, 'opening');
  assert.equal(legacy.result.show.next.conductor.cue, 'CLEARER HUMAN LINK');
  assert.equal(legacy.result.setlist.conductor.mode, 'opening');
});

test('Room Signal gives only humans deterministic round-bound authority over the next Setlist', () => {
  let state = playingState([
    { slot: 1, display_name: 'Lead', type: 'human' },
    { slot: 2, display_name: 'Guest', type: 'human' },
    { slot: 3, display_name: 'Tempo', type: 'ai' }
  ]);
  core.finishRound(state, 80000);
  assert.equal(state.show.roomSignal.schema, core.ROOM_SIGNAL_SCHEMA);
  assert.equal(state.show.roomSignal.targetRound, 2);
  assert.deepEqual(state.show.roomSignal.votes, {});
  assert.equal(core.applyRoomSignal(state, 'p3', 'bold', 80001).reason, 'room-signal-human-only');
  assert.equal(core.applyRoomSignal(state, 'p1', 'unknown', 80002).reason, 'invalid-room-signal');

  let vote = core.applyRoomSignal(state, 'p1', 'flow', 80003);
  assert.equal(vote.ok, true);
  assert.equal(vote.roomSignal.choice, 'flow');
  vote = core.applyRoomSignal(state, 'p2', 'bold', 80004);
  assert.equal(vote.roomSignal.choice, 'bold');
  assert.deepEqual(vote.roomSignal.counts, { together: 0, bold: 1, flow: 1 });
  assert.equal(vote.roomSignal.totalVotes, 2);
  assert.deepEqual(state.show.next.acts.map(act => act.kind), core.ROOM_SIGNAL_CHOICES.bold.actKinds);
  assert.notDeepEqual(state.setlist.acts.map(act => act.kind), core.ROOM_SIGNAL_CHOICES.bold.actKinds);
  assert.deepEqual(state.show.next.conductor.baseActKinds, ['human-pulses', 'all-seat-bank', 'chain-four']);

  vote = core.applyRoomSignal(state, 'p1', 'bold', 80005);
  assert.equal(vote.roomSignal.choice, 'bold');
  assert.equal(vote.roomSignal.count, 2);
  assert.equal(vote.roomSignal.totalVotes, 2);
  assert.equal(state.show.roomSignal.votes.p1, 'bold');
  assert.equal(core.applyRoomSignal(state, 'p1', 'bold', 80006).changed, false);

  const expectedRoundTwoSeed = state.show.next.seed;
  state = core.resetRoundState(state, 80500, { advance: false });
  assert.equal(state.phase, core.PHASES.LOBBY);
  assert.equal(state.show.roundNumber, 2);
  assert.equal(state.seed, expectedRoundTwoSeed);
  assert.deepEqual(state.setlist.acts.map(act => act.kind), core.ROOM_SIGNAL_CHOICES.bold.actKinds);
  const roundTwoPlan = core.clone(state.show.next.conductor);
  core.startRound(state, 81000);
  assert.deepEqual(state.setlist.conductor, roundTwoPlan);
  assert.deepEqual(state.setlist.acts.map(act => act.kind), core.ROOM_SIGNAL_CHOICES.bold.actKinds);
  assert.equal(core.applyRoomSignal(state, 'p1', 'together', 81001).reason, 'room-signal-round-active');
  core.step(state, core.METRICS.countdownMs, 84000);
  core.finishRound(state, 160000);
  assert.equal(state.show.history.at(-1).roomSignal.choice, 'bold');
  assert.equal(state.show.roomSignal.targetRound, 3);
  assert.deepEqual(state.show.roomSignal.votes, {});
  assert.equal(state.show.next.conductor.roomSignal.choice, null);
});

test('server-owned show memory advances replay without losing deterministic history', () => {
  const state = core.createInitialState([
    { slot: 1, display_name: 'Lead', type: 'human' },
    { slot: 2, display_name: 'Tempo', type: 'ai' },
    { slot: 3, display_name: 'Echo', type: 'ai' }
  ], { seed: 12026, now: 0 });
  core.startRound(state, 0);
  const firstSeed = state.seed;
  const firstActs = state.setlist.acts.map(act => act.kind);
  assert.equal(state.show.roundNumber, 1);
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  core.finishRound(state, 80000);
  const preview = state.show.next;
  assert.equal(state.show.completedRounds, 1);
  assert.equal(state.show.history.length, 1);
  assert.equal(state.result.show.totalScore, state.score);
  assert.notEqual(preview.seed, firstSeed);
  assert.notDeepEqual(preview.acts.map(act => act.kind), firstActs);
  assert.equal(preview.conductor.mode, 'reconnect');
  assert.equal(preview.conductor.sourceRound, 1);
  core.startRound(state, 81000);
  assert.equal(state.show.roundNumber, 2);
  assert.equal(state.seed, preview.seed);
  assert.deepEqual(state.setlist.acts.map(act => act.kind), preview.acts.map(act => act.kind));
  assert.deepEqual(state.setlist.conductor, preview.conductor);
  const aborted = core.resetRoundState(state, 82000, { advance: false });
  assert.equal(aborted.phase, core.PHASES.LOBBY);
  assert.equal(aborted.show.roundNumber, 2);
  assert.equal(aborted.seed, preview.seed);
  assert.equal(aborted.show.completedRounds, 1);
  assert.equal(aborted.show.next.roundNumber, 2);
  core.startRound(aborted, 83000);
  assert.equal(aborted.show.roundNumber, 2);
  assert.equal(aborted.seed, preview.seed);
});

test('Live Setlist rotates missed acts on the authoritative clock', () => {
  const state = playingState([{ slot: 1, display_name: 'Lead', type: 'human' }]);
  const first = state.setlist.acts[0];
  assert.equal(state.setlist.activeIndex, 0);
  assert.equal(first.status, 'active');
  core.step(state, 16, first.endsAt);
  assert.equal(first.status, 'missed');
  assert.equal(state.setlist.missed, 1);
  core.step(state, 16, state.setlist.advanceAt);
  assert.equal(state.setlist.activeIndex, 1);
  assert.equal(state.setlist.acts[1].status, 'active');
});

test('support AI cannot clear a human spotlight but a human TRIAD earns the setlist bonus', () => {
  const state = core.createInitialState([
    { slot: 1, display_name: 'Lead', type: 'human' },
    { slot: 2, display_name: 'Tempo', type: 'ai' }
  ], { seed: 1, now: 0 });
  core.startRound(state, 0);
  core.step(state, core.METRICS.countdownMs, core.METRICS.countdownMs);
  const act = state.setlist.acts[0];
  assert.equal(act.kind, 'human-triad');
  const support = state.players.p2;
  support.carrying = ['spark', 'chord', 'wild'];
  support.x = state.core.x;
  support.y = state.core.y;
  core.step(state, 16, 3100);
  assert.equal(act.status, 'active');
  assert.equal(state.setlist.completed, 0);
  const lead = state.players.p1;
  lead.carrying = ['spark', 'chord', 'wild'];
  lead.x = state.core.x;
  lead.y = state.core.y;
  core.step(state, 16, 3200);
  assert.equal(act.status, 'completed');
  assert.deepEqual(act.contributors, ['p1']);
  assert.equal(state.setlist.completed, 1);
  assert.equal(state.setlist.bonusScore, act.reward);
  assert(state.events.some(event => event.type === 'setlist-complete'));
});

test('roster remains bounded to four visible human or AI seats', () => {
  const roster = core.normalizeRoster(Array.from({ length: 7 }, (_, index) => ({ slot: index + 1, display_name: 'Seat ' + index, type: index % 2 ? 'ai' : 'adapter' })));
  assert.equal(roster.length, 4);
  assert.equal(new Set(roster.map(item => item.id)).size, 4);
  assert(roster.every(item => ['human', 'ai'].includes(item.type)));
});

test('coarse lobby countdown playing results state machine is explicit', () => {
  const state = core.createInitialState([], { seed: 4, now: 0 });
  assert.equal(state.phase, 'lobby');
  core.startRound(state, 10);
  assert.equal(state.phase, 'countdown');
  core.step(state, core.METRICS.countdownMs, 10 + core.METRICS.countdownMs);
  assert.equal(state.phase, 'playing');
  core.finishRound(state, 9000);
  assert.equal(state.phase, 'results');
  assert(state.result && state.result.rank);
});

test('semantic movement is normalized sequenced and stale input is refused', () => {
  const state = playingState([{ slot: 1, seat_id: 'seat_1', display_name: 'P1', type: 'human' }]);
  const player = state.players.p1;
  const before = player.x;
  const accepted = core.applyAction(state, 'p1', { type: 'move', x: 9, y: 0, seq: 1 }, 3100);
  assert.equal(accepted.ok, true);
  assert.equal(player.input.x, 1);
  core.step(state, 100, 3200);
  assert(player.x > before);
  const stale = core.applyAction(state, 'p1', { type: 'move', x: -1, y: 0, seq: 1 }, 3210);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'stale-sequence');
});

test('contacts resolve after motion and collecting respects the carry cap', () => {
  const state = playingState([{ slot: 1, display_name: 'P1', type: 'human' }]);
  const player = state.players.p1;
  state.beats = [
    { id: 'fixture-1', kind: 'spark', x: player.x, y: player.y, bornAt: 0 },
    { id: 'fixture-2', kind: 'chord', x: player.x, y: player.y, bornAt: 0 },
    { id: 'fixture-3', kind: 'wild', x: player.x, y: player.y, bornAt: 0 },
    { id: 'fixture-4', kind: 'wild', x: player.x, y: player.y, bornAt: 0 }
  ];
  core.step(state, 16, 3050);
  assert.equal(player.carrying.length, core.METRICS.maxCarry);
  assert.equal(player.collected, core.METRICS.maxCarry);
  assert.equal(state.beats.length, core.METRICS.targetBeatCount);
});

test('banking creates the shared objective and buffered pulse joins the legal window', () => {
  const state = playingState([{ slot: 1, display_name: 'P1', type: 'human' }]);
  const player = state.players.p1;
  state.core.charge = 90;
  player.carrying = ['spark'];
  player.x = state.core.x;
  player.y = state.core.y;
  const buffered = core.applyAction(state, 'p1', { type: 'pulse', seq: 1 }, 3100);
  assert.equal(buffered.buffered, true);
  core.step(state, 16, 3116);
  assert.equal(state.surgeCount, 1);
  assert.equal(state.bestSync, 1);
  assert(state.score >= 215);
  assert.deepEqual(state.pulseLedger.slice(-3).map(item => item.stage), ['intent', 'active', 'result']);
});

test('wild banking accelerates a telegraphed glitch without skipping warning', () => {
  const state = playingState([{ slot: 1, display_name: 'P1', type: 'human' }]);
  const player = state.players.p1;
  state.nextGlitchAt = 10000;
  player.carrying = ['wild'];
  player.x = state.core.x;
  player.y = state.core.y;
  core.step(state, 16, 4000);
  assert(state.nextGlitchAt < 10000);
  core.step(state, 16, state.nextGlitchAt);
  assert(state.glitch);
  assert.equal(state.glitch.phase, 'telegraph');
  const warningUntil = state.glitch.warningUntil;
  const coordinate = state.glitch.line;
  if (state.glitch.axis === 'horizontal') player.y = coordinate;
  else player.x = coordinate;
  player.carrying = ['spark'];
  core.step(state, 16, warningUntil);
  assert.equal(state.glitch.phase, 'active');
  assert.equal(player.glitchHits, 1);
  assert.equal(player.carrying.length, 0);
});

test('a mixed full carry creates a TRIAD bonus and a timed harmony chain', () => {
  const state = playingState([{ slot: 1, display_name: 'P1', type: 'human' }]);
  const player = state.players.p1;
  state.beats = [];
  player.carrying = ['spark', 'chord', 'wild'];
  player.x = state.core.x;
  player.y = state.core.y;
  core.step(state, 16, 3100);
  assert.equal(state.core.charge, 72);
  assert.equal(state.score, 130);
  assert.equal(state.harmony.streak, 1);
  assert.equal(state.events.slice(-1)[0].type, 'triad-bank');
  player.carrying = ['spark'];
  core.step(state, 16, 3200);
  assert.equal(state.harmony.streak, 2);
  assert.equal(state.harmony.multiplier, 1.25);
  assert.equal(state.score, 143);
  core.step(state, 16, 10000);
  assert.equal(state.harmony.streak, 0);
  assert.equal(state.harmony.multiplier, 1);
});

test('a perfect choir grants a shield that visibly blocks the next glitch hit', () => {
  const state = playingState([
    { slot: 1, display_name: 'P1', type: 'human' },
    { slot: 2, display_name: 'P2', type: 'human' }
  ]);
  state.core.charge = 100;
  core.openSync(state, 3100);
  core.applyAction(state, 'p1', { type: 'pulse', seq: 1 }, 3110);
  core.applyAction(state, 'p2', { type: 'pulse', seq: 1 }, 3120);
  core.step(state, 16, 3136);
  assert.equal(state.perfectSurges, 1);
  assert.equal(state.players.p1.shieldCharges, 1);
  const player = state.players.p1;
  player.carrying = ['wild'];
  state.glitch = { id: 'fixture-glitch', axis: 'horizontal', line: player.y, phase: 'active', warningUntil: 0, activeUntil: 5000 };
  core.step(state, 16, 3200);
  assert.equal(player.shieldCharges, 0);
  assert.equal(player.glitchHits, 0);
  assert.deepEqual(player.carrying, ['wild']);
  assert.equal(state.events.slice(-1)[0].type, 'glitch-block');
});

test('AI supports the core but cannot score a human-value TRIAD on autopilot', () => {
  const humanState = playingState([{ slot: 1, display_name: 'Lead', type: 'human' }]);
  const aiState = playingState([{ slot: 1, display_name: 'Support', type: 'ai' }]);
  [humanState, aiState].forEach(state => {
    state.beats = [];
    state.players.p1.carrying = ['spark', 'chord', 'wild'];
    state.players.p1.x = state.core.x;
    state.players.p1.y = state.core.y;
    core.step(state, 16, 3100);
  });
  assert.equal(humanState.core.charge, aiState.core.charge);
  assert.equal(humanState.score, 130);
  assert.equal(aiState.score, 52);
});

test('two support AIs cannot carry an idle human seat to HEADLINER', () => {
  const state = core.createInitialState([
    { slot: 1, display_name: 'Idle Lead', type: 'human' },
    { slot: 2, display_name: 'Tempo', type: 'ai' },
    { slot: 3, display_name: 'Echo', type: 'ai' }
  ], { seed: 12026, now: 0 });
  core.startRound(state, 0);
  for (let now = 50; now <= 79000; now += 50) {
    core.tickAi(state, now);
    core.step(state, 50, now);
  }
  assert.equal(state.phase, core.PHASES.RESULTS);
  assert.equal(state.perfectSurges, 0);
  assert(state.score < core.METRICS.rankHeadliner);
  assert.notEqual(state.result.rank, 'HEADLINER');
});

test('AI decision and execution are separate and use the same sequenced gate', () => {
  const state = playingState([{ slot: 1, display_name: 'Tempo', type: 'ai' }]);
  const decision = core.chooseAiIntent(state, 'p1', 3100);
  assert.equal(decision.type, 'move');
  const result = core.executeAiIntent(state, 'p1', decision, 3100);
  assert.equal(result.ok, true);
  assert.equal(state.players.p1.lastSequence, 1);
  assert.equal(state.inputLedger.slice(-1)[0].player, 'p1');
  const lobby = core.createInitialState([{ slot: 1, display_name: 'Tempo', type: 'ai' }], { seed: 12026, now: 0 });
  core.tickAi(lobby, 1000);
  core.tickAi(lobby, 1300);
  assert.equal(lobby.players.p1.lastSequence, 0);
  assert.equal(lobby.inputLedger.length, 0);
  assert.equal(lobby.players.p1.ai.intent, 'round-not-playing');
});

test('seat observation exposes legal shared facts and names server authority', () => {
  const state = playingState([{ slot: 1, display_name: 'P1', type: 'human' }, { slot: 2, display_name: 'P2', type: 'human' }]);
  const observation = core.observe(state, 'p1');
  assert.equal(observation.authority, 'server');
  assert.equal(observation.player.id, 'p1');
  assert.equal(observation.teammates.length, 1);
  assert(observation.legalActions.includes('pulse'));
  assert(observation.setlist && observation.setlist.acts.length === 3);
});

test('round result keeps contribution evidence for every visible player', () => {
  const state = playingState();
  state.score = 3500;
  state.surgeCount = 3;
  state.bestSync = 2;
  core.finishRound(state, 9000);
  assert.equal(state.result.rank, 'ENCORE');
  assert.equal(state.result.players.length, 3);
  assert(state.result.players.every(player => ['collected','banked','pulses','glitchHits'].every(key => Number.isInteger(player[key]))));
  assert.equal(state.result.setlist.acts.length, 3);
  assert(state.result.setlist.acts.every(act => ['completed','missed'].includes(act.status)));
  assert.equal(state.result.show.completedRounds, 1);
  assert.equal(state.result.show.history[0].score, state.result.score);
  assert.equal(state.result.show.history[0].perfectSurges, state.result.perfectSurges);
  assert(Number.isInteger(state.result.show.history[0].humanBanked));
});

test('shared-screen and controller surfaces expose the promised controls and accessibility cues', () => {
  const html = fs.readFileSync(path.join(ROOT, 'runtime', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'runtime', 'app.js'), 'utf8');
  const controller = fs.readFileSync(path.join(ROOT, 'runtime', 'controller.html'), 'utf8');
  const checkpoint = fs.readFileSync(path.join(ROOT, 'runtime', 'checkpoint-store.js'), 'utf8');
  const stage3d = fs.readFileSync(path.join(ROOT, 'runtime', 'arena-3d.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.manifest.json'), 'utf8'));
  assert(html.includes('id="startButton"'));
  assert(html.includes('id="returnButton"'));
  assert(html.includes('id="motionToggle"'));
  assert(html.includes('id="contrastToggle"'));
  assert(html.includes('id="resultDebrief"') && html.includes('id="resultPlayers"'));
  assert(html.includes('id="setlistPanel"') && html.includes('id="resultSetlist"'));
  assert(html.includes('id="showArc"') && html.includes('id="resultShowMemory"'));
  assert(html.includes('id="conductorPlan"') && html.includes('id="conductorReason"'));
  assert(html.includes('id="arena3d"') && html.includes('id="venueBadge"') && html.includes('id="tourStamps"'));
  assert(stage3d.includes("getContext('webgl'") && stage3d.includes("renderer: gl ? 'webgl' : 'fallback'"));
  assert(stage3d.includes('gl.DEPTH_TEST') && stage3d.includes('gl.drawArrays(gl.TRIANGLES'));
  assert(stage3d.includes("canvas.dataset.motion = motion ? 'full' : 'reduced'") && stage3d.includes('canvas.dataset.cameraDrift'));
  new Function(stage3d);
  assert(app.includes("state.phase === core.PHASES.LOBBY") && app.includes('Start when the room is ready.'));
  assert(html.includes('aria-live="assertive"'));
  assert(app.includes("code==='Escape'"));
  assert(app.includes("type:'pulse'"));
  assert.equal(manifest.controls.gamepad_profile, 'axm-universal-xbox-brawl-v0.2.1');
  assert(app.includes('pad.buttons[15]') && app.includes('pad.buttons[12]'), 'D-pad movement is mapped');
  assert(app.includes('pad.buttons[9]') && app.includes("api('/api/start'"), 'Menu starts or replays');
  assert(app.includes('function replayChallenge') && app.includes('function renderResultDebrief'));
  assert(app.includes('HOST RESTORED') && app.includes("'/api/new-show'"));
  assert(app.includes("'/api/finish-show'") && app.includes('CONFIRM RETURN'));
  assert(app.includes('LIVE CONDUCTOR') && app.includes('context.conductor.reason'));
  assert(app.includes('function roomSignalLabel') && app.includes('VOTE ON PHONES'));
  assert(/name="viewport"/.test(controller));
  assert(controller.includes('id="joystick"'));
  assert(controller.includes('id="pulse"'));
  assert(controller.includes('id="directive"') && controller.includes('directiveProgress'));
  assert(controller.includes('ROUND \'') && controller.includes('o.show'));
  assert(controller.includes('REJOINED') && controller.includes('value.recovery'));
  assert(controller.includes('CONDUCTOR · ') && controller.includes('conductor.reason'));
  assert(controller.includes("venue=(['lobby','results'].includes(o.phase)&&next.venue)||o.venue"));
  assert(controller.includes('id="roomSignal"') && controller.includes("'/api/room-signal'"));
  assert(controller.includes('data-room-signal="together"') && controller.includes('data-room-signal="bold"') && controller.includes('data-room-signal="flow"'));
  assert(checkpoint.includes('axm.pulse-choir-checkpoint/v1') && checkpoint.includes('fs.renameSync'));
  assert(app.includes('pulse-choir-arena-v2.png'));
  assert(fs.existsSync(path.join(ROOT, 'runtime', 'assets', 'pulse-choir-arena-v2.png')));
  assert(html.includes('id="combo"'));
  assert(html.includes('TRIAD'));
  const inlineScript = controller.match(/<script>([\s\S]*?)<\/script>/);
  assert(inlineScript && inlineScript[1]);
  new Function(inlineScript[1]);
});

test('Game Hub package verifier accepts the new isolated slot', () => {
  const report = verifier.verifyGameDir(ROOT);
  assert.deepEqual(report.errors, []);
  assert.equal(report.slot, '012');
});

if (process.exitCode) process.exit(process.exitCode);
console.log('Pulse Choir selftest: PASS (' + passed + ' checks)');
