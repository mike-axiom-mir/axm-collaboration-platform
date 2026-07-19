'use strict';

const assert = require('assert');
const H = require('./test-helpers');
const Patterns = require('../core/emergence-patterns');
const Emergence = require('../core/emergence-engine');
const Rng = require('../core/deterministic-rng');
const Receipts = require('../core/receipt-log');

function captureWorkingPattern(seed) {
  const engine = H.runPublicSequence(seed, 8);
  const state = engine.observeState();
  const source = state.districts.find(district =>
    ['HEALTHY', 'STRAINED', 'RECOVERED'].includes(district.lifecycleState) &&
    state.structures.some(structure => structure.districtId === district.id && structure.createdTurn > 0 && structure.lifecycle !== 'FAILED')
  );
  assert(source, 'fixture needs one viable district with observed post-starter emergence');
  const result = H.decision(engine, 'decision-capture-pattern', 'CAPTURE_EMERGENCE', { districtId: source.id, label: source.name + ' remembered pattern' }, 'Capture the observed district as causal evidence for a later goal.');
  H.expectOk(assert, result);
  return { engine, sourceId: source.id, patternId: engine.observeState().emergenceMemory.patterns[0].id };
}

function applyWorkingLayer(seed, mode) {
  const fixture = captureWorkingPattern(seed);
  const engine = fixture.engine;
  let state = engine.observeState();
  const pattern = Patterns.patternById(state, fixture.patternId);
  const preferred = pattern.profile.structureMix.slice().sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))[0];
  const rule = Emergence.ruleByType(preferred.id);
  const targetZone = rule.zones[0];
  const targetCells = state.map.cells.filter(cell => {
    const district = state.districts.find(item => item.id === cell.districtId);
    return cell.districtId !== fixture.sourceId && !cell.structureIds.length && !district.held && !['FAILED', 'HELD', 'REPAIRING'].includes(district.lifecycleState);
  }).slice(0, 4).map(cell => cell.id);
  assert.equal(targetCells.length, 4, 'fixture needs four empty cells outside the source district');
  H.expectOk(assert, H.decision(engine, 'decision-paint-goal-target', 'PAINT_ZONE', { cellIds: targetCells, zone: targetZone }, 'Give the target cells a compatible broad zone without selecting buildings.'));
  H.expectOk(assert, H.decision(engine, 'decision-apply-goal-layer', 'APPLY_GOAL_LAYER', { patternId: fixture.patternId, cellIds: targetCells, mode: mode }, 'Apply the remembered pattern as guidance without bypassing local gates.'));
  state = engine.observeState();
  return { engine, state, pattern: Patterns.patternById(state, fixture.patternId), layer: state.emergenceMemory.goalLayers[0], targetCells, targetZone, sourceId: fixture.sourceId };
}

function legacyPacketWithReceipts() {
  const engine = H.runPublicSequence('legacy-pattern-migration', 2);
  const legacy = engine.observeState();
  delete legacy.emergenceMemory;
  delete legacy.boundaries.capturedEmergenceRequiresExplicitDecision;
  delete legacy.boundaries.goalLayersCannotBypassCosts;
  legacy.receipts[legacy.receipts.length - 1].postStateHash = H.Canonical.hashState(legacy);
  let previous = null;
  legacy.receipts.forEach(receipt => {
    receipt.previousReceiptHash = previous;
    receipt.currentReceiptHash = Receipts.hashReceipt(receipt);
    previous = receipt.currentReceiptHash;
  });
  legacy.receiptHead = previous;
  return H.Canonical.makeExportPacket(legacy);
}

module.exports = ({ test }) => {
  test('starter fixtures cannot be captured as if they were observed emergence', 'Captured emergence authority', () => {
    const engine = H.Steward.createSteward('capture-gate');
    const before = H.Canonical.stableStringify(engine.observeState());
    const result = H.decision(engine, 'decision-capture-too-early', 'CAPTURE_EMERGENCE', { districtId: 'district-hearthside', label: 'Premature nostalgia' }, 'Try to capture a starter district before new emergence exists.');
    assert.equal(result.ok, false);
    assert(result.errors.some(error => /no observed post-starter emergence/i.test(error.message)));
    assert.equal(H.Canonical.stableStringify(engine.observeState()), before, 'refused capture must spend no attention or revision');
  });

  test('a captured pattern stores causal roles and conditions without cloning state', 'Captured emergence evidence', () => {
    const fixture = captureWorkingPattern('capture-evidence');
    const state = fixture.engine.observeState();
    const pattern = Patterns.patternById(state, fixture.patternId);
    assert(pattern.profile.structureMix.length > 0);
    assert(pattern.profile.sourceStructureCount > 0);
    assert(pattern.sourceStructureIds.every(id => state.structures.find(structure => structure.id === id).createdTurn > 0));
    assert(Number.isFinite(pattern.profile.accessRatio));
    assert(Object.keys(pattern.profile.deposits).length === 6);
    assert.equal(Object.prototype.hasOwnProperty.call(pattern, 'inventory'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(pattern, 'funds'), false);
    assert.equal(state.receipts[state.receipts.length - 1].changes[0].type, 'EMERGENCE_PATTERN_CAPTURED');
    assert.equal(H.Steward.validateState(state).ok, true);
  });

  test('applying a goal layer costs attention but paints and builds nothing', 'Goal layer authority', () => {
    const fixture = captureWorkingPattern('goal-no-magic');
    const engine = fixture.engine;
    const before = engine.observeState();
    const cells = before.map.cells.filter(cell => cell.districtId !== fixture.sourceId && !cell.structureIds.length).slice(0, 3).map(cell => cell.id);
    const zonesBefore = cells.map(id => before.map.cells.find(cell => cell.id === id).zone);
    const structuresBefore = before.structures.length;
    const attentionBefore = before.resources.attention.stock;
    const applied = H.decision(engine, 'decision-goal-no-magic', 'APPLY_GOAL_LAYER', { patternId: fixture.patternId, cellIds: cells, mode: 'EVOLVE' }, 'Guide these cells while leaving all normal development gates intact.');
    H.expectOk(assert, applied);
    const after = engine.observeState(), layer = after.emergenceMemory.goalLayers[0];
    assert.equal(after.structures.length, structuresBefore);
    assert.deepEqual(cells.map(id => after.map.cells.find(cell => cell.id === id).zone), zonesBefore);
    assert.equal(attentionBefore - after.resources.attention.stock, 2);
    assert.equal(layer.mode, 'EVOLVE');
    assert.equal(layer.progress.target >= 1, true);
    assert.equal(layer.cause.note.includes('product bills remain mandatory'), true);
  });

  test('goal preference cannot grant a zone exception or waive affordability', 'Goal layer non-bypass', () => {
    const fixture = applyWorkingLayer('goal-non-bypass', 'EVOLVE');
    const state = fixture.engine.observeState();
    const desired = fixture.layer.desiredTypes[0];
    const rule = Emergence.ruleByType(desired.type);
    const targetCell = state.map.cells.find(cell => cell.id === fixture.targetCells[0]);
    const influence = Patterns.influenceForCandidate(state, targetCell, rule);
    assert.equal(influence.blocked, false);
    assert(influence.bonus >= 20, 'exact remembered role should receive a strong disclosed preference');
    const generated = Emergence.generateCandidates(state, state.needs, Rng.create(state.prng));
    const exact = generated.candidates.find(candidate => fixture.targetCells.includes(candidate.cellId) && candidate.type === desired.type);
    assert(exact && exact.scoreComponents.capturedGoal >= 20);
    const starved = H.Canonical.clone(state);
    Object.values(starved.ledger.reservations).forEach(reservation => { reservation.status = 'COMMITTED'; });
    starved.resources.labor.available = 0;
    starved.supplyChain.goods.tools.stock = 0;
    const check = Emergence.affordability(starved, exact);
    assert.equal(check.affordable, false);
    assert(check.reasons.includes('NO_MATCHING_FUNDED_ZONE_ALLOCATION'));
    assert(check.reasons.includes('INSUFFICIENT_AVAILABLE_LABOR'));
    const wrongZone = H.Canonical.clone(state), wrongCell = wrongZone.map.cells.find(cell => cell.id === fixture.targetCells[0]);
    wrongCell.zone = rule.zones.includes('INDUSTRY') ? 'HOUSING' : 'INDUSTRY';
    const wrongGenerated = Emergence.generateCandidates(wrongZone, wrongZone.needs, Rng.create(wrongZone.prng));
    assert.equal(wrongGenerated.candidates.some(candidate => candidate.cellId === wrongCell.id && candidate.type === desired.type), false, 'goal must not insert a rule forbidden by the current broad zone');
  });

  test('Preserve holds new growth at the functional baseline while retaining empty land', 'Preserve goal mode', () => {
    const fixture = applyWorkingLayer('goal-preserve', 'PRESERVE');
    const state = H.Canonical.clone(fixture.state), layer = state.emergenceMemory.goalLayers[0], desired = layer.desiredTypes[0];
    const target = state.map.cells.find(cell => cell.id === fixture.targetCells[0]);
    const source = state.structures.find(structure => structure.type === desired.type && structure.createdTurn > 0);
    assert(source, 'captured source should contain the desired exact role');
    const structure = H.Canonical.clone(source);
    structure.id = 'structure-goal-preserve-fixture'; structure.cellId = target.id; structure.districtId = target.districtId; structure.createdTurn = state.turn + 1;
    state.structures.push(structure); target.structureIds.push(structure.id);
    Patterns.refresh(state);
    assert.equal(layer.status, 'TARGET_HELD');
    const empty = state.map.cells.find(cell => fixture.targetCells.includes(cell.id) && !cell.structureIds.length);
    const blocked = Patterns.influenceForCandidate(state, empty, Emergence.ruleByType(desired.type));
    assert.equal(blocked.blocked, true);
    assert(blocked.reasons.includes('PRESERVE_GOAL_BASELINE_REACHED'));
    assert(state.map.cells.some(cell => fixture.targetCells.includes(cell.id) && !cell.structureIds.length), 'preserve must not fill or erase unused target land');
  });

  test('Evolve reopens a completed baseline and favors a higher-tier next step', 'Evolve goal mode', () => {
    const fixture = applyWorkingLayer('goal-evolve', 'PRESERVE');
    const state = H.Canonical.clone(fixture.state), layer = state.emergenceMemory.goalLayers[0], desired = layer.desiredTypes[0];
    const target = state.map.cells.find(cell => cell.id === fixture.targetCells[0]);
    const source = state.structures.find(structure => structure.type === desired.type && structure.createdTurn > 0);
    const structure = H.Canonical.clone(source);
    structure.id = 'structure-goal-evolve-fixture'; structure.cellId = target.id; structure.districtId = target.districtId; structure.createdTurn = state.turn + 1;
    state.structures.push(structure); target.structureIds.push(structure.id); Patterns.refresh(state);
    assert.equal(layer.status, 'TARGET_HELD');
    H.expectOk(assert, Patterns.setMode(state, { layerId: layer.id, mode: 'EVOLVE', decisionId: 'test-evolve-mode' }));
    assert.equal(layer.status, 'BASELINE_REACHED');
    const empty = state.map.cells.find(cell => fixture.targetCells.includes(cell.id) && !cell.structureIds.length);
    const higher = Emergence.RULES.filter(rule => Patterns.tierForType(rule.type) > layer.baselineTier).sort((a, b) => Patterns.tierForType(b.type) - Patterns.tierForType(a.type) || a.type.localeCompare(b.type))[0];
    const influence = Patterns.influenceForCandidate(state, empty, higher);
    assert.equal(influence.blocked, false);
    assert.equal(influence.match, 'EVOLUTION_STEP');
    assert(influence.bonus >= 8);
  });

  test('older state gains empty emergence memory through a visible bounded migration', 'Emergence memory migration', () => {
    const target = H.Steward.createSteward('migration-target');
    const imported = target.importState(legacyPacketWithReceipts());
    H.expectOk(assert, imported);
    const state = target.observeState();
    assert.equal(state.emergenceMemory.patterns.length, 0);
    assert.equal(state.emergenceMemory.goalLayers.length, 0);
    assert.equal(state.receipts[state.receipts.length - 1].kind, 'STATE_MIGRATION');
    assert(state.receipts[state.receipts.length - 1].changes.some(change => change.type === 'EMERGENCE_MEMORY_INITIALIZED'));
    assert.equal(H.Steward.validateState(state).ok, true);
  });

  test('the same capture, overlay and turn sequence replays byte-equivalently', 'Captured emergence determinism', () => {
    function run(seed) {
      const fixture = applyWorkingLayer(seed, 'EVOLVE');
      H.expectOk(assert, fixture.engine.advanceTurn({ count: 3, actionId: 'goal-sequence-turns', actor: { id: 'test-human', type: 'HUMAN' } }));
      return fixture.engine.exportState();
    }
    assert.equal(H.Canonical.stableStringify(run('goal-determinism')), H.Canonical.stableStringify(run('goal-determinism')));
  });
};
