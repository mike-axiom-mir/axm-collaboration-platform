'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');
const Steward = require(path.join(ROOT, 'core', 'steward-state.js'));
const Canonical = require(path.join(ROOT, 'core', 'canonical-state.js'));

function decision(engine, id, type, payload, reason) {
  return engine.applyStewardDecision({
    schema: Steward.DECISION_SCHEMA,
    id,
    type,
    expectedRevision: engine.observeState({ summary: true }).revision,
    reason: reason || 'Explicit test stewardship reason.',
    payload: payload || {}
  }, { actor: { id: 'test-human', type: 'HUMAN', displayName: 'Test steward' } });
}

function expectOk(assert, result) {
  assert.equal(result.ok, true, JSON.stringify(result.errors || []));
  return result;
}

function fundedEngine(seed) {
  const engine = Steward.createSteward(seed || 'funded-test');
  const allocations = [
    ['housing', 'HOUSING', { population: 5, energy: 18, materials: 28, funds: 36, attention: 4 }],
    ['infra', 'INFRASTRUCTURE', { energy: 16, materials: 28, funds: 38, attention: 4 }],
    ['neutral', 'NEUTRAL', { population: 4, energy: 14, materials: 24, funds: 32, attention: 4 }]
  ];
  allocations.forEach(([id, zone, amounts]) => {
    const result = decision(engine, 'decision-fund-' + id, 'ALLOCATE', { zone, amounts }, 'Fund the ' + zone.toLowerCase() + ' envelope for a deterministic test.');
    if (!result.ok) throw new Error('fixture allocation failed: ' + JSON.stringify(result.errors));
  });
  return engine;
}

function runPublicSequence(seed, turns) {
  const engine = fundedEngine(seed);
  decision(engine, 'decision-policy-homes', 'SET_POLICY', { priority: 'HOMES_FIRST', constraints: { protectNature: true, natureRouteOverride: false } }, 'Prioritize unmet housing while protecting nature.');
  decision(engine, 'decision-hold-westfold', 'HOLD_DISTRICT', { districtId: 'district-westfold' }, 'Pause the failed district before choosing repair.');
  decision(engine, 'decision-release-westfold', 'RELEASE_DISTRICT', { districtId: 'district-westfold' }, 'Release only for the recorded repair path.');
  decision(engine, 'decision-repair-westfold', 'REPAIR_DISTRICT', { districtId: 'district-westfold', addressedCause: 'ENERGY_ISOLATION' }, 'Repair the recorded energy isolation with visible costs.');
  for (let i = 0; i < (turns || 24); i += 1) {
    const advanced = engine.advanceTurn({ count: 1, actionId: 'sample-turn-' + String(i + 1).padStart(2, '0'), actor: { id: 'test-human', type: 'HUMAN' } });
    if (!advanced.ok) throw new Error('turn failed: ' + JSON.stringify(advanced.errors));
  }
  return engine;
}

module.exports = { ROOT, Steward, Canonical, decision, expectOk, fundedEngine, runPublicSequence };
