import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_VERSION,
  REVIEW_LIMIT,
  STARTING_DEBT,
  EVENTS,
  DECISION_LEGACY_CATALOG,
  createNewGame,
  derivedStats,
  spawnCustomer,
  serveNext,
  buyUpgrade,
  canBuyUpgrade,
  presentEvent,
  chooseEvent,
  decisionLegacy,
  decisionRevealFrame,
  debtLiberation,
  tickGame,
  arrivalForecast,
  queueConstellation,
  shiftAtmosphere,
  operationalAdvice,
  calculateScore,
  captureTelemetryPoint,
  sanitizeLoadedState,
  seededRandom
} from '../runtime/game-core.mjs';

function advance(state, seconds, random = seededRandom(1)) {
  const steps = Math.ceil(seconds / .1);
  for (let index = 0; index < steps && !state.ended; index += 1) {
    if (state.pendingEvent) {
      const event = EVENTS.find(item => item.id === state.pendingEvent);
      chooseEvent(state, event.id, event.choices[0].id, random);
    }
    tickGame(state, seconds / steps, random);
  }
  return state;
}

test('standard contract starts in debt with the authored 1,000-review limit', () => {
  const state = createNewGame('standard', 18018);
  assert.equal(state.totalDays, 21);
  assert.equal(state.debt, 720);
  assert.equal(state.badReviews, 64);
  assert.equal(REVIEW_LIMIT, 1000);
  assert.ok(derivedStats(state).leakRate > 0);
});

test('manual service consumes resources, pays debt, and records earnings', () => {
  const state = createNewGame('standard', 2);
  const random = () => .5;
  const customer = spawnCustomer(state, random, 'fuel');
  const beforeFuel = state.fuel;
  const beforeDebt = state.debt;
  const result = serveNext(state, 'fuel');
  assert.equal(result.ok, true);
  assert.equal(result.customer.id, customer.id);
  assert.ok(state.fuel < beforeFuel);
  assert.ok(state.debt < beforeDebt);
  assert.equal(state.stats.served, 1);
  assert.equal(state.stats.manual, 1);
  assert.equal(state.customers.length, 0);
  assert.equal(result.debtBefore, beforeDebt);
  assert.equal(result.debtAfter, state.debt);
  assert.equal(state.lastAction.debtShare, result.debtShare);
});

test('unserved customers leave bad reviews and can revoke the license', () => {
  const state = createNewGame('quick', 3);
  state.seenEvents = EVENTS.map(event => event.id);
  state.badReviews = 990;
  const customer = spawnCustomer(state, () => .1, 'garage');
  customer.patience = .02;
  tickGame(state, .1, () => .5);
  assert.equal(state.ended, true);
  assert.equal(state.outcome, 'reviews');
  assert.equal(state.badReviews, REVIEW_LIMIT);
});

test('repair upgrades visibly change leak math and enforce prerequisites', () => {
  const state = createNewGame('standard', 4);
  state.credits = 5000;
  assert.equal(canBuyUpgrade(state, 'nano-seal').reason, 'locked');
  assert.equal(buyUpgrade(state, 'patch-kit').ok, true);
  const patchedRate = derivedStats(state).leakRate;
  assert.ok(patchedRate > 0 && patchedRate < .05);
  assert.equal(buyUpgrade(state, 'nano-seal').ok, true);
  assert.equal(derivedStats(state).leakRate, 0);
  assert.equal(state.fuelCapacity, 130);
});

test('event choices mutate permanent run pressure and are one-shot', () => {
  const state = createNewGame('standard', 5);
  const event = EVENTS.find(item => item.id === 'opening-swarm');
  const result = chooseEvent(state, event.id, 'partner', () => .5);
  assert.equal(result.ok, true);
  assert.equal(state.modifiers.demand, .2);
  assert.equal(state.modifiers.reward, .18);
  assert.equal(chooseEvent(state, event.id, 'soft').ok, false);
});

test('event presentations are seeded, replayable, and mechanically neutral', () => {
  for (const event of EVENTS) {
    assert.ok(['forecourt', 'mart', 'engineering', 'vista'].includes(event.camera));
    assert.equal(event.dispatches.length, 1);
    assert.deepEqual(Object.keys(event.results).sort(), event.choices.map(choice => choice.id).sort());
    const presentation = presentEvent(event.id, 18018);
    assert.equal(presentation.id, event.id);
    assert.deepEqual(presentation.choices, event.choices);
    assert.equal(presentation.presentationCount, 2);
    assert.deepEqual(presentEvent(event.id, 18018), presentation);
    const authoredTitles = new Set(Array.from({ length: 32 }, (_, seed) => presentEvent(event.id, seed).title));
    assert.equal(authoredTitles.size, 2);
  }
  assert.equal(presentEvent('missing-event', 18018), null);
});

test('retirement completes at the selected timer and preserves a payout', () => {
  const state = createNewGame('quick', 6);
  state.seenEvents = EVENTS.map(event => event.id);
  state.credits = 1200;
  state.badReviews = 100;
  state.elapsed = state.totalDays * state.dayLength - .05;
  tickGame(state, .1, () => .9);
  assert.equal(state.ended, true);
  assert.equal(state.outcome, 'retired');
  assert.ok(calculateScore(state) > 0);
});

test('loaded saves are versioned, bounded, and keep nested defaults', () => {
  const source = createNewGame('legend', 7);
  source.credits = 777;
  delete source.manualCooldowns.garage;
  const loaded = sanitizeLoadedState(JSON.parse(JSON.stringify(source)));
  assert.equal(loaded.credits, 777);
  assert.equal(loaded.manualCooldowns.garage, 0);
  const migrated = sanitizeLoadedState({ ...source, version: '0.9.0-beta', telemetry: undefined });
  assert.equal(migrated.version, GAME_VERSION);
  assert.equal(migrated.telemetry.at(-1).reason, 'migrated');
  assert.equal(sanitizeLoadedState({ ...source, version: '0.10.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.11.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.12.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.13.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.14.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.15.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.16.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.17.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.18.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.19.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.20.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.21.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.22.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.23.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: '0.24.0-beta' }).version, GAME_VERSION);
  assert.equal(sanitizeLoadedState({ ...source, version: 'old' }), null);
});

test('every authored event choice projects one unique permanent station trace', () => {
  const authored = EVENTS.flatMap(event => event.choices.map(choice => ({ event, choice })));
  assert.equal(authored.length, 17);
  assert.equal(Object.keys(DECISION_LEGACY_CATALOG).length, authored.length);
  const legacyIds = new Set();
  for (const { event, choice } of authored) {
    const key = `${event.id}:${choice.id}`;
    const metadata = DECISION_LEGACY_CATALOG[key];
    assert.ok(metadata, `missing decision legacy metadata for ${key}`);
    assert.match(metadata.id, /^[a-z0-9-]+$/);
    assert.match(metadata.label, /^[A-Z0-9 -]+$/);
    assert.ok(['teal', 'amber', 'violet', 'red', 'blue'].includes(metadata.tone));
    assert.match(metadata.shape, /^[a-z]+$/);
    assert.equal(legacyIds.has(metadata.id), false, `duplicate decision legacy id: ${metadata.id}`);
    legacyIds.add(metadata.id);

    const state = createNewGame(event.modes?.[0] || 'standard', 2300);
    state.stats.choices = [{ eventId: event.id, choiceId: choice.id, day: event.day }];
    const projected = decisionLegacy(state);
    assert.equal(projected.count, 1);
    assert.equal(projected.latest.id, metadata.id);
    assert.equal(projected.latest.camera, event.camera);
  }
});

test('decision legacy is deterministic, state-neutral, ordered, and de-duplicates malformed history', () => {
  const state = createNewGame('legend', 2301);
  state.stats.choices = [
    { eventId: 'inspector', choiceId: 'hide', day: 16 },
    { eventId: 'opening-swarm', choiceId: 'partner', day: 2 },
    { eventId: 'opening-swarm', choiceId: 'soft', day: 3 },
    { eventId: 'missing', choiceId: 'nope', day: 4 },
    { eventId: 'tour-bus', choiceId: 'missing', day: 11 },
    { eventId: 'legend-offer', choiceId: 'protect', day: 25 }
  ];
  const before = JSON.stringify(state);
  const projected = decisionLegacy(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(decisionLegacy(state), projected);
  assert.equal(projected.count, 3);
  assert.deepEqual(projected.ids, ['opening-swarm:partner', 'inspector:hide', 'legend-offer:protect']);
  assert.equal(projected.latest.id, 'escape-vault');
});

test('save migration preserves valid decision history and removes duplicates and unknown choices', () => {
  const source = createNewGame('legend', 2302);
  source.version = '0.22.0-beta';
  source.stats.choices = [
    { eventId: 'opening-swarm', choiceId: 'soft', day: 2 },
    { eventId: 'opening-swarm', choiceId: 'partner', day: 3 },
    { eventId: 'inspector', choiceId: 'repair', day: 'bad' },
    { eventId: 'inspector', choiceId: 'unknown', day: 15 },
    { eventId: 'unknown', choiceId: 'unknown', day: 99 }
  ];
  const migrated = sanitizeLoadedState(source);
  assert.deepEqual(migrated.stats.choices, [
    { eventId: 'opening-swarm', choiceId: 'soft', day: 2 },
    { eventId: 'inspector', choiceId: 'repair', day: 15 }
  ]);
  assert.equal(decisionLegacy(migrated).count, 2);
});

test('consequence reveal frames are deterministic and Reduced Motion removes spatial travel', () => {
  const start = decisionRevealFrame(0, false);
  const midpoint = decisionRevealFrame(.5, false);
  const settled = decisionRevealFrame(1, false);
  assert.ok(Math.abs(start.artifactScale - .12) < Number.EPSILON * 2);
  assert.equal(start.beamOpacity, .28);
  assert.equal(start.ringOpacity, 0);
  assert.ok(midpoint.artifactScale > 1);
  assert.ok(midpoint.ringOpacity > .5);
  assert.equal(midpoint.ringLift, 2.2);
  assert.ok(midpoint.shardOrbit > 0);
  assert.equal(settled.artifactScale, 1);
  assert.equal(settled.beamOpacity, 0);
  assert.ok(Math.abs(settled.ringOpacity) < Number.EPSILON);
  assert.deepEqual(decisionRevealFrame(.5, false), midpoint);
  assert.deepEqual(decisionRevealFrame(-9, false), start);
  assert.deepEqual(decisionRevealFrame(9, false), settled);

  const reducedStart = decisionRevealFrame(0, true);
  const reducedLater = decisionRevealFrame(.8, true);
  assert.equal(reducedStart.artifactScale, 1);
  assert.equal(reducedStart.ringLift, 0);
  assert.equal(reducedStart.shardLift, 0);
  assert.equal(reducedStart.shardOrbit, 0);
  assert.deepEqual(
    { ...reducedStart, progress: 0 },
    { ...reducedLater, progress: 0 },
    'Reduced Motion changes only semantic progress, not spatial presentation'
  );
});

test('debt liberation is deterministic, state-neutral, and exposes every authored lien stage', () => {
  const state = createNewGame('standard', 2500);
  const before = JSON.stringify(state);
  const locked = debtLiberation(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(debtLiberation(state), locked);
  assert.equal(locked.debt, STARTING_DEBT);
  assert.equal(locked.progress, 0);
  assert.equal(locked.links, 6);
  assert.equal(locked.phase, 'LIEN LOCKED');

  state.debt = 420;
  const cracking = debtLiberation(state);
  assert.equal(cracking.phase, 'LIEN CRACKING');
  assert.equal(cracking.links, 4);
  assert.ok(cracking.progress > .4 && cracking.progress < .43);

  state.debt = 14;
  const finalClaim = debtLiberation(state);
  assert.equal(finalClaim.phase, 'FINAL CLAIM');
  assert.equal(finalClaim.tone, 'opportunity');
  assert.equal(finalClaim.links, 1);

  state.debt = 0;
  assert.deepEqual(debtLiberation(state), {
    debt: 0,
    paid: STARTING_DEBT,
    progress: 1,
    remaining: 0,
    links: 0,
    phase: 'STATION YOURS',
    tone: 'clear',
    cleared: true
  });
  assert.equal(debtLiberation({ debt: 9999 }).debt, STARTING_DEBT);
  assert.equal(debtLiberation({ debt: -50 }).debt, 0);
});

test('telemetry captures day boundaries and a single final point', () => {
  const state = createNewGame('quick', 42);
  state.seenEvents = EVENTS.map(event => event.id);
  state.elapsed = state.dayLength - .05;
  tickGame(state, .1, () => .9);
  assert.equal(state.telemetry.at(-1).reason, 'day');
  state.elapsed = state.totalDays * state.dayLength - .05;
  tickGame(state, .1, () => .9);
  assert.equal(state.telemetry.at(-1).reason, 'final');
  const count = state.telemetry.length;
  captureTelemetryPoint(state, 'final');
  assert.equal(state.telemetry.length, count);
});

test('automation can serve a queued customer without manual energy use', () => {
  const state = createNewGame('standard', 8);
  state.credits = 1000;
  buyUpgrade(state, 'pump-bot');
  const customer = spawnCustomer(state, () => .5, 'fuel');
  customer.patience = 30;
  customer.maxPatience = 30;
  state.spawnClock = 100;
  const beforeEnergy = state.energy;
  advance(state, 6, () => .5);
  assert.equal(state.customers.length, 0);
  assert.equal(state.stats.automated, 1);
  assert.ok(state.energy >= beforeEnergy);
});

test('seeded random is deterministic and stays in range', () => {
  const a = seededRandom(99);
  const b = seededRandom(99);
  const valuesA = Array.from({ length: 12 }, a);
  const valuesB = Array.from({ length: 12 }, b);
  assert.deepEqual(valuesA, valuesB);
  assert.ok(valuesA.every(value => value >= 0 && value < 1));
});

test('operational advice is deterministic, state-neutral, and routes the live constraint', () => {
  const base = createNewGame('standard', 1819);
  const before = JSON.stringify(base);
  assert.equal(operationalAdvice(base).action.id, 'patch-kit');
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(operationalAdvice(base), operationalAdvice(base));

  base.upgrades.push('patch-kit');
  const urgent = spawnCustomer(base, () => .5, 'garage');
  urgent.patience = urgent.maxPatience * .12;
  assert.deepEqual(operationalAdvice(base).action, { type: 'serve', lane: 'garage', label: 'FOCUS BAY' });

  base.stock = 0;
  assert.equal(operationalAdvice(base).action.kind, 'stock');
  base.stock = base.stockCapacity;
  base.energy = 0;
  assert.equal(operationalAdvice(base).action.type, 'rest');

  base.energy = base.maxEnergy;
  base.badReviews = 820;
  const critical = operationalAdvice(base);
  assert.equal(critical.tone, 'danger');
  assert.match(critical.title, /License/);

  base.customers = [];
  base.badReviews = 64;
  base.credits = 1000;
  const build = operationalAdvice(base);
  assert.equal(build.action.type, 'upgrade');
  assert.ok(build.action.id);
});

test('arrival forecast exposes the existing spawn clock without mutating simulation state', () => {
  const state = createNewGame('standard', 1820);
  const before = JSON.stringify(state);
  const initial = arrivalForecast(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(arrivalForecast(state), initial);
  assert.ok(initial.progress >= 0 && initial.progress <= 1);
  assert.match(initial.eta, /SEC/);

  state.spawnClock = .35;
  assert.equal(arrivalForecast(state).phase, 'FINAL APPROACH');
  state.burstRemaining = 3;
  const surge = arrivalForecast(state);
  assert.equal(surge.phase, 'CONVOY SURGE');
  assert.equal(surge.tone, 'danger');
  assert.equal(surge.burst, 3);

  state.spawnClock = 99;
  state.burstRemaining = 0;
  assert.equal(arrivalForecast(state).phase, 'SIGNAL HELD');
  state.ended = true;
  assert.equal(arrivalForecast(state).phase, 'SHIFT CLOSED');
});

test('queue constellation is deterministic, state-neutral, and caps its visible stack', () => {
  const state = createNewGame('standard', 1821);
  const fuelFront = spawnCustomer(state, () => .2, 'fuel');
  spawnCustomer(state, () => .3, 'fuel');
  const martFront = spawnCustomer(state, () => .4, 'mart');
  const garageFront = spawnCustomer(state, () => .5, 'garage');
  for (let index = 0; index < 6; index += 1) spawnCustomer(state, () => .6, 'garage');
  fuelFront.maxPatience = 100;
  fuelFront.patience = 12;
  martFront.maxPatience = 100;
  martFront.patience = 45;
  garageFront.maxPatience = 100;
  garageFront.patience = 88;

  const before = JSON.stringify(state);
  const telemetry = queueConstellation(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(queueConstellation(state), telemetry);
  assert.equal(telemetry.total, 10);
  assert.equal(telemetry.dominantLane, 'fuel');
  assert.equal(telemetry.lanes.find(lane => lane.lane === 'fuel').tone, 'danger');
  assert.equal(telemetry.lanes.find(lane => lane.lane === 'mart').tone, 'warning');
  assert.equal(telemetry.lanes.find(lane => lane.lane === 'garage').visiblePips, 5);
  assert.equal(telemetry.lanes.find(lane => lane.lane === 'garage').overflow, 2);

  const empty = queueConstellation(createNewGame('standard', 1822));
  assert.equal(empty.total, 0);
  assert.equal(empty.dominantLane, null);
  assert.ok(empty.lanes.every(lane => lane.phase === 'CLEAR'));
});

test('shift atmosphere is deterministic, state-neutral, and covers the authored orbit phases', () => {
  const state = createNewGame('standard', 1822);
  const before = JSON.stringify(state);
  const phases = [
    [.08, 'FIRST LIGHT', 'dawn', '08:26'],
    [.38, 'HIGH ORBIT', 'day', '13:50'],
    [.66, 'EMBER SHIFT', 'dusk', '18:52'],
    [.88, 'DEEP WATCH', 'night', '22:50']
  ];
  for (const [progress, phase, tone, time] of phases) {
    state.elapsed = progress * state.dayLength;
    const atmosphere = shiftAtmosphere(state);
    assert.equal(atmosphere.phase, phase);
    assert.equal(atmosphere.tone, tone);
    assert.equal(atmosphere.time, time);
    assert.deepEqual(shiftAtmosphere(state), atmosphere);
  }
  state.elapsed = 0;
  assert.equal(JSON.stringify(state), before);
});
