'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('./test-helpers');
const Emergence = require('../core/emergence-engine');
const Roads = require('../core/road-emergence');
const Consequences = require('../core/consequence-model');
const Supply = require('../core/supply-chain');

module.exports = ({ test }) => {
  test('every development has a versioned cause and cost or declared starter zero-cost reason', 'R3 traceable cause/cost', () => {
    const state = H.runPublicSequence('trace', 12).observeState();
    state.structures.forEach(structure => {
      assert(structure.cause.ruleId, structure.id);
      if (structure.createdTurn === 0) assert(structure.cause.zeroCostReason, structure.id + ' needs starter reason');
      else {
        assert(structure.cause.triggerNeedId, structure.id + ' trigger');
        assert(structure.cause.resourceTransactionIds.length > 0, structure.id + ' transactions');
        structure.cause.resourceTransactionIds.forEach(id => assert(state.ledger.transactions.some(tx => tx.transactionId === id), id));
      }
    });
    state.roads.forEach(road => {
      assert(road.cause.ruleId && road.cause.connectionPressure >= road.cause.threshold);
      assert(road.cause.resourceTransactionIds.length > 0);
    });
  });

  test('neutral land yields multiple valid deterministic outcomes across inputs', 'R4 neutral outcomes', () => {
    const state = H.Steward.createStarterState('neutral');
    const cell = state.map.cells.find(c => c.zone === 'NEUTRAL' && c.terrain.kind !== 'WETLAND');
    const housingNeeds = [{ id: 'need-housing', pressure: 90 }, { id: 'need-access', pressure: 10 }];
    const serviceNeeds = [{ id: 'need-services', pressure: 95 }, { id: 'need-housing', pressure: 5 }];
    const a = Emergence.chooseNeutralOutcome(state, cell, housingNeeds);
    const b = Emergence.chooseNeutralOutcome(state, cell, serviceNeeds);
    assert.equal(a, Emergence.chooseNeutralOutcome(state, cell, housingNeeds));
    assert.equal(a, 'SMALL_SETTLEMENT');
    assert.equal(b, 'PUBLIC_SERVICE');
    assert.notEqual(a, b);
  });

  test('roads require pressure and deterministic allowed paths', 'R5 road pressure', () => {
    const low = H.Steward.createStarterState('road-low');
    low.structures.forEach(s => { s.capacity = {}; });
    const refused = Roads.generateCandidate(low, [{ id: 'need-access', pressure: 0 }]);
    assert.equal(refused.candidate, null);
    assert.equal(refused.refusal, 'INSUFFICIENT_CONNECTION_PRESSURE');
    const high = H.Steward.createStarterState('road-high');
    const candidate = Roads.generateCandidate(high, [{ id: 'need-access', pressure: 90 }]).candidate;
    assert(candidate && candidate.connectionPressure >= candidate.threshold);
    const repeated = Roads.generateCandidate(high, [{ id: 'need-access', pressure: 90 }]).candidate;
    assert.deepEqual(candidate.path, repeated.path);
  });

  test('protected terrain changes or refuses a route until explicit override', 'R5 road pressure', () => {
    const state = H.Steward.createStarterState('road-barrier');
    state.map.cells.filter(c => c.x === 4).forEach(c => { c.protected = true; c.zone = 'NATURE'; });
    const blocked = Roads.findPath(state.map, 'cell-0-1', 'cell-7-1', { protectNature: true, natureRouteOverride: false });
    assert.equal(blocked.ok, false);
    const override = Roads.findPath(state.map, 'cell-0-1', 'cell-7-1', { protectNature: true, natureRouteOverride: true });
    assert.equal(override.ok, true);
  });

  test('failed district can be held, released, repaired and recovered without erasing history', 'R6 failure recovery', () => {
    const engine = H.Steward.createSteward('repair-path');
    H.expectOk(assert, H.decision(engine, 'decision-hold', 'HOLD_DISTRICT', { districtId: 'district-westfold' }, 'Hold while reviewing the recorded cause.'));
    assert.equal(engine.explainChange('district-westfold').data.lifecycleState, 'HELD');
    const historyAtHold = engine.explainChange('district-westfold').data.history.length;
    H.expectOk(assert, H.decision(engine, 'decision-release', 'RELEASE_DISTRICT', { districtId: 'district-westfold' }, 'Release for one explicit repair path.'));
    H.expectOk(assert, H.decision(engine, 'decision-repair', 'REPAIR_DISTRICT', { districtId: 'district-westfold', addressedCause: 'ENERGY_ISOLATION' }, 'Repair the exact recorded energy isolation.'));
    assert.equal(engine.explainChange('district-westfold').data.lifecycleState, 'REPAIRING');
    H.expectOk(assert, engine.advanceTurn({ count: 2 }));
    const district = engine.explainChange('district-westfold').data;
    assert.equal(district.lifecycleState, 'RECOVERED');
    assert(district.history.length > historyAtHold);
    assert(district.history.some(entry => entry.state === 'FAILED'));
  });

  test('unscored novelty affects no vital and cannot self-promote', 'R10 novelty review', () => {
    const engine = H.Steward.createSteward('novelty');
    const before = engine.observeState().vitals;
    const item = engine.observeState().noveltyReview[0];
    assert.equal(item.status, 'UNSCORED_REVIEW_REQUIRED');
    assert.equal(item.mayAffectVitals, false);
    engine.advanceTurn({ count: 1 });
    const after = engine.observeState().vitals;
    assert.equal(after.diversity - before.diversity, 0, 'unreviewed novelty must not alter diversity');
    const still = engine.observeState().noveltyReview[0];
    assert.equal(still.status, 'UNSCORED_REVIEW_REQUIRED');
    assert.equal(Emergence.noveltyEligibleForProposal(still), false);
  });

  test('explicit novelty review appends a promotion receipt but does not auto-place content', 'R10 novelty review', () => {
    const engine = H.Steward.createSteward('novelty-review');
    const beforeCount = engine.observeState().structures.length;
    const reviewed = H.decision(engine, 'decision-review-novelty', 'REVIEW_NOVELTY', { noveltyId: 'novelty-civic-weave', action: 'APPROVE', metricBindings: { livability: 2, diversity: 3, resilience: 1 } }, 'Approve explicit bounded bindings for later proposals.');
    H.expectOk(assert, reviewed);
    assert.equal(reviewed.receipt.kind, 'INTERNAL_PROMOTION');
    assert.equal(engine.observeState().structures.length, beforeCount);
    const item = engine.observeState().noveltyReview[0];
    assert.equal(Emergence.noveltyEligibleForProposal(item), true);
  });

  test('all known structures declare separate vital bindings and no composite score exists', 'Separate vitals', () => {
    assert.equal(Consequences.validateKnownBindings().ok, true);
    Emergence.RULES.forEach(rule => assert(Consequences.KNOWN_BINDINGS[rule.type], rule.type));
    assert.equal(Consequences.VITALS.includes('success'), false);
    assert.equal(Consequences.VITALS.includes('power'), false);
    assert.equal(Consequences.VITALS.length, 8);
  });

  test('available inputs strongly change which factory candidate is favored on the same zoned cell', 'Supply-led emergence', () => {
    const state = H.Steward.createStarterState('supply-choice'), cell = state.map.cells.find(c => c.zone === 'INDUSTRY' && !c.structureIds.length);
    const sawmill = Emergence.RULES.find(rule => rule.type === 'SAWMILL'), bricks = Emergence.RULES.find(rule => rule.type === 'BRICKWORKS');
    state.supplyChain.goods.timber.stock = state.supplyChain.goods.timber.capacity; state.supplyChain.goods.clay.stock = 0; state.supplyChain.goods.stone.stock = 0;
    const woodFavored = Supply.scoreCandidate(state, cell, sawmill, 70), clayStarved = Supply.scoreCandidate(state, cell, bricks, 70); assert(woodFavored.score > clayStarved.score);
    state.supplyChain.goods.timber.stock = 0; state.supplyChain.goods.clay.stock = state.supplyChain.goods.clay.capacity; state.supplyChain.goods.stone.stock = state.supplyChain.goods.stone.capacity;
    const woodStarved = Supply.scoreCandidate(state, cell, sawmill, 70), clayFavored = Supply.scoreCandidate(state, cell, bricks, 70); assert(clayFavored.score > woodStarved.score);
  });

  test('underlying cell deposits flip extractor preference without changing the zone', 'Deposit-led emergence', () => {
    const state = H.Steward.createStarterState('deposit-choice'), cell = state.map.cells.find(c => c.zone === 'INDUSTRY' && !c.structureIds.length);
    const timberRule = Emergence.RULES.find(rule => rule.type === 'TIMBER_CAMP'), clayRule = Emergence.RULES.find(rule => rule.type === 'CLAY_PIT'), deposits = state.supplyChain.deposits[cell.id];
    deposits.timber.quality = deposits.timber.remaining = 100; deposits.clay.quality = deposits.clay.remaining = 1;
    assert(Supply.scoreCandidate(state, cell, timberRule, 65).score > Supply.scoreCandidate(state, cell, clayRule, 65).score);
    deposits.timber.quality = deposits.timber.remaining = 1; deposits.clay.quality = deposits.clay.remaining = 100;
    assert(Supply.scoreCandidate(state, cell, clayRule, 65).score > Supply.scoreCandidate(state, cell, timberRule, 65).score);
  });

  test('emergent construction consumes an exact typed bill with traceable goods transactions', 'Typed construction conservation', () => {
    const engine = H.Steward.createSteward('typed-build-integration');
    H.expectOk(assert, H.decision(engine, 'decision-fund-industry-supply', 'ALLOCATE', { zone: 'INDUSTRY', amounts: { population: 3, energy: 24, materials: 32, funds: 50, attention: 6 } }, 'Fund industry while letting local supply choose the exact firm.'));
    H.expectOk(assert, engine.advanceTurn({ count: 1, actionId: 'typed-build-turn' }));
    const state = engine.observeState(), structure = state.structures.find(item => item.createdTurn === 1);
    assert(structure, 'expected one supply-aware structure'); assert(Object.keys(structure.goodsBuild).length > 0); assert(structure.cause.goodsTransactionIds.length > 0);
    structure.cause.goodsTransactionIds.forEach(id => { const tx = state.supplyChain.transactions.find(item => item.transactionId === id); assert(tx, id); assert.equal(tx.kind, 'CONSTRUCTION_INPUT'); });
    Object.keys(structure.goodsBuild).forEach(id => {
      const spent = structure.cause.goodsTransactionIds.map(txId => state.supplyChain.transactions.find(item => item.transactionId === txId)).filter(tx => tx.good === id).reduce((sum, tx) => sum + tx.amount, 0);
      assert(Math.abs(spent - structure.goodsBuild[id]) < 0.0001, id);
    });
  });

  test('missing operating inputs idle a processor and raise the scarce product price', 'Operating supply causality', () => {
    const state = H.Steward.createStarterState('idle-factory'), abundant = H.Canonical.clone(state);
    state.supplyChain.goods.lumber.stock = 0; state.supplyChain.goods.metalParts.stock = 0;
    abundant.supplyChain.goods.lumber.stock = abundant.supplyChain.goods.lumber.capacity; abundant.supplyChain.goods.metalParts.stock = abundant.supplyChain.goods.metalParts.capacity;
    Supply.advance(state, { energyFactor: 1 }); Supply.advance(abundant, { energyFactor: 1 });
    assert(state.supplyChain.lastQuarter.idleStructures.some(item => item.structureId === 'structure-starter-workshop'));
    assert(state.supplyChain.goods.lumber.price > abundant.supplyChain.goods.lumber.price);
  });

  test('typed surplus is trade-ready but cannot leave through an unconnected trade system', 'Future trade boundary', () => {
    const state = H.Steward.createStarterState('trade-ready'); Supply.GOOD_ORDER.forEach(id => { state.supplyChain.goods[id].stock = state.supplyChain.goods[id].capacity; });
    const result = Supply.advance(state, { energyFactor: 1 }); assert(result.tradeReady.length > 0); assert(result.tradeReady.every(lot => lot.status === 'READY_NOT_EXPORTED'));
    assert.equal(result.transactions.some(tx => /EXPORT/.test(tx.kind)), false); assert.equal(state.supplyChain.boundaries.externalTradeConnected, false);
  });

  test('simulation files contain no nondeterministic random or wall-clock calls', 'R1 deterministic replay', () => {
    const core = path.join(H.ROOT, 'core');
    const files = fs.readdirSync(core).filter(name => name.endsWith('.js'));
    files.forEach(name => {
      const source = fs.readFileSync(path.join(core, name), 'utf8');
      assert(!/Math\s*\.\s*random\s*\(/.test(source), name + ' random');
      assert(!/Date\s*\.\s*now\s*\(/.test(source), name + ' Date.now');
      assert(!/new\s+Date\s*\(/.test(source), name + ' current Date');
    });
  });
};
