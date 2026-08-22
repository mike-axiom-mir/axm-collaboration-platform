import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENTS,
  UPGRADES,
  createNewGame,
  seededRandom,
  tickGame,
  serveNext,
  buySupply,
  canBuyUpgrade,
  buyUpgrade,
  chooseEvent,
  queueSummary,
  calculateScore
} from '../runtime/game-core.mjs';

const preferredUpgrades = ['patch-kit','pump-bot','stock-drone','queue-beacon','nano-seal','garage-arm','solar-wings','twin-pumps','synth-kitchen','holo-canopy','service-clone','quantum-forecourt'];
const saferChoices = {
  'opening-swarm': 'soft',
  'builder-drone': 'recruit',
  'solar-bloom': 'shelter',
  'tour-bus': 'accept',
  inspector: 'repair',
  'retirement-broker': 'quiet',
  'legend-offer': 'protect'
};

function simulate(seed, active = true) {
  const state = createNewGame('standard', seed);
  const random = seededRandom(seed);
  let actionClock = 0;
  while (!state.ended && state.elapsed < 800) {
    if (state.pendingEvent) {
      const event = EVENTS.find(item => item.id === state.pendingEvent);
      const choice = active ? saferChoices[event.id] || event.choices[0].id : event.choices[0].id;
      chooseEvent(state, event.id, choice, random);
    }
    if (active) {
      if (state.fuel < 25 && state.credits >= 118) buySupply(state, 'fuel');
      if (state.stock < 15 && state.credits >= 84) buySupply(state, 'stock');
      for (const id of preferredUpgrades) {
        if (canBuyUpgrade(state, id).ok) { buyUpgrade(state, id); break; }
      }
      actionClock -= .1;
      if (actionClock <= 0) {
        const urgentLane = ['fuel','mart','garage']
          .map(lane => ({ lane, urgency: queueSummary(state, lane).urgency }))
          .sort((a, b) => b.urgency - a.urgency)[0];
        if (urgentLane.urgency > 0) serveNext(state, urgentLane.lane);
        actionClock = .38;
      }
    }
    tickGame(state, .1, random);
  }
  return state;
}

test('a competent active strategy can reach retirement on representative seeds', () => {
  const runs = [101, 202, 303, 404, 505].map(seed => simulate(seed, true));
  assert.ok(runs.every(run => run.outcome === 'retired'), runs.map(run => ({ outcome: run.outcome, reviews: run.badReviews, day: run.day })));
  assert.ok(runs.every(run => calculateScore(run) > 0));
  assert.ok(runs.some(run => run.upgrades.length >= 5));
});

test('doing nothing is not a viable strategy', () => {
  const run = simulate(909, false);
  assert.equal(run.outcome, 'reviews');
  assert.ok(run.elapsed < run.totalDays * run.dayLength);
});
