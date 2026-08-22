#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Canonical = require('../core/canonical-state');
const Ecology = require('../core/island-ecology');
const Goods = require('../core/island-goods');
const Economy = require('../core/island-economy');
const Living = require('../core/living-state');
const BridgeApi = require('../core/steward-bridge');
const AISeat = require('../core/ai-player-seat');
const Missions = require('../core/walkable-missions');
const Metrics = require('../core/steward-metrics');
const TycoonAdapter = require('../game/tycoon-steward/core/globe-adapter');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;

function test(name, requirement, fn) {
  try {
    fn(); pass += 1; console.log('PASS [' + requirement + '] ' + name);
  } catch (error) {
    fail += 1; console.error('FAIL [' + requirement + '] ' + name + '\n  ' + String(error.stack || error).replace(/\n/g, '\n  '));
  }
}

function engine(seed) { return new Living.Engine(seed || 'living-test-seed'); }
function bridge(source) { return new BridgeApi.Bridge({ engine: source, nativeProvider: () => ({ treeCount: 14, fishAlive: 4, reedCount: 1, hareCount: 3, foxCount: 2, fireCount: 0, wood: 2, observedAtWorldAge: 5 }) }); }
function operation(type, payload) { return { type, payload }; }
function packet(e, operations, id) {
  return {
    schema: Living.PROPOSAL_SCHEMA,
    id: id || 'test-proposal-' + e.state.revision + '-' + operations[0].type.toLowerCase(),
    targetWorldId: e.state.worldId,
    targetRevision: e.state.revision,
    preconditions: [{ field: 'revision', equals: e.state.revision }],
    requestedOperations: operations,
    causeCostTrace: { source: 'test', costs: {} },
    reversibilityStatement: 'Discard before apply; undo latest apply.',
    risks: [], unknowns: [], consentReference: 'consent:test'
  };
}
function submit(e, op, id) { return e.submitCityPatchProposal(packet(e, [op], id), { actor: { id: 'test-human', type: 'HUMAN' } }); }
function approveAndApply(e, proposal, reason) {
  const reviewed = e.reviewProposal({ proposalId: proposal.id, decision: 'APPROVE', expectedRevision: e.state.revision, reason: reason || 'Approve visible test change.', actor: { id: 'test-human', type: 'HUMAN' } });
  assert.equal(reviewed.ok, true);
  const applied = e.applyApprovedProposal({ proposalId: proposal.id, approvalToken: reviewed.approvalToken, reason: reason || 'Apply visible test change.', actor: { id: 'test-human', type: 'HUMAN' } });
  assert.equal(applied.ok, true);
  return applied;
}
function connectedAI() {
  const created = AISeat.createState([0, 1, 0]);
  const result = AISeat.connect(created, { connectorId: 'test-ai-connector', label: 'Test AI Connector', reason: 'Connect the bounded AI test seat.' }, { worldAge: 2 });
  assert.equal(result.ok, true); return result.state;
}
function aiIntent(state, id, type, payload) {
  return { schema: AISeat.INTENT_SCHEMA, seatId: AISeat.SEAT_ID, connectorId: 'test-ai-connector', id, expectedSequence: state.commandSequence,
    type, reason: 'Exercise one explicit bounded player intent.', payload: payload || {} };
}

test('same seed produces byte-equivalent initial state', 'determinism', () => {
  assert.equal(Canonical.stableStringify(engine('same').exportState()), Canonical.stableStringify(engine('same').exportState()));
});

test('different seeds alter seeded district conditions', 'seed integrity', () => {
  assert.notEqual(Canonical.stableStringify(engine('alpha').state.districts), Canonical.stableStringify(engine('beta').state.districts));
});

test('constructing or observing an engine advances no strategic time', 'human agency', () => {
  const e = engine(); const before = Canonical.stableStringify(e.exportState()); e.observeState(); e.summary();
  assert.equal(e.state.turn, 0); assert.equal(e.state.revision, 0); assert.equal(Canonical.stableStringify(e.exportState()), before);
});

test('native observation increments revision only when meaningful counts change', 'revision safety', () => {
  const e = engine(), b = bridge(e); const first = b.syncNativeObservation(), second = b.syncNativeObservation();
  assert.equal(first.changed, true); assert.equal(second.changed, false); assert.equal(e.state.revision, 1); assert.equal(e.state.receipts.length, 1);
});

test('host snapshots expose terrain, resources and settlements at one revision', 'adapter seam', () => {
  const e = engine(), snapshots = e.hostSnapshots();
  ['terrain','resources','settlements'].forEach(key => { assert.equal(snapshots[key].schema, Living.SNAPSHOT_SCHEMA); assert.equal(snapshots[key].sourceWorldId, e.state.worldId); assert.equal(snapshots[key].sourceRevision, e.state.revision); });
});

test('preview reports costs without changing state', 'proposal-only preview', () => {
  const e = engine(), b = bridge(e); b.syncNativeObservation(); const before = Canonical.stableStringify(e.exportState());
  const preview = b.previewOperations([operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'CLINIC' })]);
  assert.equal(preview.applied, false); assert.equal(preview.affordable, true); assert.equal(preview.estimatedCosts.materials, 4); assert(preview.estimatedCosts.funds > 0); assert(preview.economicBreakdowns[0].breakdown.length >= 6); assert.equal(Canonical.stableStringify(e.exportState()), before);
});

test('proposal creation stores governance state but changes no world revision or stock', 'proposal gate', () => {
  const e = engine(), beforeRev = e.state.revision, beforeResources = Canonical.stableStringify(e.state.resources);
  const result = submit(e, operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'CLINIC' }));
  assert.equal(result.ok, true); assert.equal(result.applied, false); assert.equal(result.proposal.status, 'PROPOSAL_ONLY'); assert.equal(e.state.revision, beforeRev); assert.equal(Canonical.stableStringify(e.state.resources), beforeResources);
});

test('unsupported operations are refused', 'operation allowlist', () => {
  const e = engine(), result = e.submitCityPatchProposal(packet(e, [operation('DELETE_WORLD', {})], 'unsafe-operation'));
  assert.equal(result.ok, false); assert.equal(e.state.proposals.length, 0);
});

test('stale target revisions are refused', 'revision safety', () => {
  const e = engine(), p = packet(e, [operation('PROPOSE_ECO_BUFFER', { districtId: 'district-ridgeworks' })], 'stale'); p.targetRevision = 9;
  assert.equal(e.submitCityPatchProposal(p).ok, false); assert.equal(e.state.proposals.length, 0);
});

test('approval is a separate action and still changes no stock', 'consent gate', () => {
  const e = engine(), created = submit(e, operation('PROPOSE_SERVICE', { districtId: 'district-eastreach', service: 'SCHOOL' })); const before = Canonical.stableStringify(e.state.resources);
  const reviewed = e.reviewProposal({ proposalId: created.proposal.id, decision: 'APPROVE', expectedRevision: e.state.revision, reason: 'Approve for a separate apply test.' });
  assert.equal(reviewed.ok, true); assert.equal(reviewed.applied, false); assert.equal(reviewed.proposal.status, 'APPROVED_NOT_APPLIED'); assert.equal(Canonical.stableStringify(e.state.resources), before); assert.equal(e.state.revision, 0);
});

test('wrong approval token cannot apply', 'consent integrity', () => {
  const e = engine(), created = submit(e, operation('PROPOSE_SERVICE', { districtId: 'district-eastreach', service: 'SCHOOL' }));
  e.reviewProposal({ proposalId: created.proposal.id, decision: 'APPROVE', expectedRevision: 0, reason: 'Approve but test the token gate.' });
  const before = Canonical.stableStringify(e.exportState()); const result = e.applyApprovedProposal({ proposalId: created.proposal.id, approvalToken: 'wrong', reason: 'Attempt with a wrong approval token.' });
  assert.equal(result.ok, false); assert.equal(Canonical.stableStringify(e.exportState()), before);
});

test('approved service apply spends exact resources and changes the target district', 'atomic apply', () => {
  const e = engine(), created = submit(e, operation('PROPOSE_SERVICE', { districtId: 'district-eastreach', service: 'SCHOOL' })); const beforeFunds = e.state.resources.funds.stock;
  const result = approveAndApply(e, created.proposal);
  assert.equal(result.applied, true); assert.equal(e.state.resources.funds.stock, beforeFunds - created.proposal.estimatedCosts.funds); assert.equal(e.state.resources.materials.stock, 92 - 4); assert.equal(e.state.districts.find(d => d.id === 'district-eastreach').services.SCHOOL, 1); assert.equal(e.state.revision, 1);
});

test('rejected proposal can never apply', 'consent gate', () => {
  const e = engine(), created = submit(e, operation('PROPOSE_ECO_BUFFER', { districtId: 'district-ridgeworks' }));
  const reviewed = e.reviewProposal({ proposalId: created.proposal.id, decision: 'REJECT', expectedRevision: 0, reason: 'Reject this ecological placement test.' });
  assert.equal(reviewed.ok, true); assert.equal(e.applyApprovedProposal({ proposalId: created.proposal.id, approvalToken: reviewed.approvalToken, reason: 'Should remain rejected.' }).ok, false);
});

test('insufficient resources refuse a proposal without partial spending', 'resource conservation', () => {
  const state = engine().exportState(); state.resources.funds.stock = 0; const e = new Living.Engine(state), before = Canonical.stableStringify(e.exportState());
  const result = submit(e, operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'CLINIC' }));
  assert.equal(result.ok, false); assert.equal(Canonical.stableStringify(e.exportState()), before);
});

test('road apply creates one traceable link', 'steward integration', () => {
  const e = engine(), created = submit(e, operation('PROPOSE_ROAD', { fromDistrictId: 'district-northgrove', toDistrictId: 'district-eastreach' }));
  approveAndApply(e, created.proposal); assert.equal(e.state.roads.length, 1); assert.equal(e.state.roads[0].createdByProposalId, created.proposal.id);
});

test('district direction apply changes only after approval', 'broad direction', () => {
  const e = engine(), target = e.state.districts.find(d => d.id === 'district-westmeadow'); const created = submit(e, operation('PROPOSE_DISTRICT', { districtId: target.id, zone: 'HOUSING' }));
  assert.equal(target.zone, 'NEUTRAL'); approveAndApply(e, created.proposal); assert.equal(e.state.districts.find(d => d.id === target.id).zone, 'HOUSING');
});

test('latest applied change can be undone with resources restored', 'reversibility', () => {
  const e = engine(), beforeResources = Canonical.stableStringify(e.state.resources), beforeDistricts = Canonical.stableStringify(e.state.districts);
  const created = submit(e, operation('PROPOSE_ECO_BUFFER', { districtId: 'district-ridgeworks' })); const applied = approveAndApply(e, created.proposal);
  const undone = e.undoProposal({ proposalId: created.proposal.id, reason: 'Reverse the latest applied test change.' });
  assert.equal(applied.ok, true); assert.equal(undone.ok, true); assert.equal(Canonical.stableStringify(e.state.resources), beforeResources); assert.equal(Canonical.stableStringify(e.state.districts), beforeDistricts); assert.equal(e.state.revision, 2);
});

test('undo is refused after a later world revision', 'reversibility boundary', () => {
  const e = engine(), created = submit(e, operation('PROPOSE_ECO_BUFFER', { districtId: 'district-ridgeworks' })); approveAndApply(e, created.proposal);
  assert.equal(e.advanceQuarter({ expectedRevision: 1, reason: 'Advance after the applied change.' }).ok, true);
  assert.equal(e.undoProposal({ proposalId: created.proposal.id, reason: 'Too late to reverse cleanly.' }).ok, false);
});

test('same explicit quarter sequence replays byte-equivalently', 'deterministic replay', () => {
  const a = engine('quarter-replay'), b = engine('quarter-replay');
  for (let i = 0; i < 8; i += 1) { assert.equal(a.advanceQuarter({ expectedRevision: a.state.revision, reason: 'Replay quarter ' + i + '.' }).ok, true); assert.equal(b.advanceQuarter({ expectedRevision: b.state.revision, reason: 'Replay quarter ' + i + '.' }).ok, true); }
  assert.equal(Canonical.stableStringify(a.exportState()), Canonical.stableStringify(b.exportState()));
});

test('quarter advances weather, calendar and resource flows explicitly', 'living state', () => {
  const e = engine(), result = e.advanceQuarter({ expectedRevision: 0, reason: 'Observe one causal strategic quarter.' });
  assert.equal(result.ok, true); assert.equal(e.state.turn, 1); assert.equal(e.state.calendar.season, 'SUMMER'); assert(Object.keys(e.state.flows.produced).length >= 6); assert.notEqual(e.state.climate.rainfallMm, 78);
});

test('resource stocks remain finite and inside declared capacities over 40 quarters', 'resource bounds', () => {
  const e = engine('long-run');
  for (let i = 0; i < 40; i += 1) assert.equal(e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Long-run bounded quarter ' + i + '.' }).ok, true);
  Living.RESOURCE_ORDER.forEach(name => { assert(Number.isFinite(e.state.resources[name].stock)); assert(e.state.resources[name].stock >= 0); assert(e.state.resources[name].stock <= e.state.resources[name].capacity); });
  assert.equal(e.validate().ok, true);
});

test('v0.1 strategic saves migrate explicitly without inventing prior history', 'save migration', () => {
  const legacy = engine('legacy-save').exportState();
  legacy.version = '0.1.0'; legacy.schema = Living.LEGACY_STATE_SCHEMA;
  delete legacy.habitats; delete legacy.inhabitants; delete legacy.ecologyDynamics; delete legacy.society; delete legacy.economy;
  legacy.districts.forEach(district => { delete district.habitat; });
  delete legacy.boundaries.noAutomaticDilemmaResolution; delete legacy.boundaries.oneDilemmaAtATime; delete legacy.boundaries.politicalHumorIsFiction;
  const migrated = new Living.Engine(legacy);
  assert.equal(migrated.state.version, '0.5.0'); assert.equal(migrated.state.revision, 1);
  assert.equal(migrated.state.receipts.at(-1).kind, 'STRATEGIC_V0_5_TROPICAL_SUPPLY_MIGRATION'); assert(migrated.state.economy); assert(migrated.state.supply); assert.equal(migrated.validate().ok, true);
});

test('v0.2 saves gain economy books through one explicit migration receipt', 'save migration', () => {
  const prior = engine('v2-save').exportState(); delete prior.economy; prior.version = '0.2.0'; prior.schema = Living.LEGACY_V2_STATE_SCHEMA;
  delete prior.boundaries.privateRevenueSeparateFromTreasury; delete prior.boundaries.physicalInventoryNotDoubleCharged; delete prior.boundaries.pricesHaveVisibleCauses;
  const migrated = new Living.Engine(prior);
  assert.equal(migrated.state.version, '0.5.0'); assert.equal(migrated.state.revision, 1); assert.equal(migrated.state.receipts.at(-1).kind, 'STRATEGIC_V0_5_TROPICAL_SUPPLY_MIGRATION'); assert.equal(migrated.validate().ok, true);
});

test('v0.3 saves gain typed supply through one explicit migration receipt', 'save migration', () => {
  const prior = engine('v3-save').exportState(); delete prior.supply; prior.version = '0.3.0'; prior.schema = Living.LEGACY_V3_STATE_SCHEMA;
  prior.economy.version = '0.3.0'; prior.economy.schema = 'axm.living-world.island-economy/v0.3'; delete prior.economy.goodsMarket;
  delete prior.boundaries.typedGoodsConserved; delete prior.boundaries.privateEnterprisesMayEmergeOnlyOnExplicitQuarter; delete prior.boundaries.externalTypedTradeConnected;
  const migrated = new Living.Engine(prior);
  assert.equal(migrated.state.version, '0.5.0'); assert.equal(migrated.state.revision, 1); assert.equal(migrated.state.receipts.at(-1).kind, 'STRATEGIC_V0_5_TROPICAL_SUPPLY_MIGRATION');
  assert.equal(migrated.state.supply.boundaries.externalTradeNotConnected, true); assert.equal(migrated.validate().ok, true);
});

test('v0.4 saves gain four tropical guilds through one explicit migration receipt', 'save migration', () => {
  const prior = engine('v4-tropical-save').exportState();
  prior.version = '0.4.0'; prior.schema = Living.LEGACY_V4_STATE_SCHEMA;
  ['geckos','canopyBirds','landCrabs','iguanas'].forEach(id => { delete prior.inhabitants[id]; });
  ['seedDispersalService','shorelineRecycling','browsingPressure','foodWebHealth'].forEach(id => { delete prior.ecologyDynamics[id]; });
  prior.ecologyDynamics.notes = prior.ecologyDynamics.notes.filter(note => !/Tropical inhabitants/.test(note));
  const migrated = new Living.Engine(prior), receipt = migrated.state.receipts.at(-1);
  assert.equal(migrated.state.version, '0.5.0'); assert.equal(migrated.state.revision, 1); assert.equal(receipt.kind, 'STRATEGIC_V0_5_TROPICAL_WEB_MIGRATION');
  ['geckos','canopyBirds','landCrabs','iguanas'].forEach(id => { assert(migrated.state.inhabitants[id]); assert.equal(migrated.state.inhabitants[id].nativeStatus, 'NEWLY_CATALOGUED_GUILD'); });
  assert.deepEqual(receipt.changes.at(-1).guilds, ['geckos','canopyBirds','landCrabs','iguanas']); assert.equal(migrated.validate().ok, true);
});

test('edict preview is pure and exposes cost, duration and faction tradeoffs', 'casual stewardship', () => {
  const e = engine(), before = Canonical.stableStringify(e.exportState());
  const preview = e.previewEdict('MANDATORY_SIESTA');
  assert.equal(preview.ok, true); assert.equal(preview.applied, false); assert.equal(preview.duration, 2); assert.equal(preview.costs.funds, 6); assert(preview.factionEffects.workers > 0); assert(preview.factionEffects.merchants < 0);
  assert.equal(Canonical.stableStringify(e.exportState()), before);
});

test('issued edicts spend exact costs, act for declared quarters and expire', 'visible edict consequences', () => {
  const e = engine(), funds = e.state.resources.funds.stock, attention = e.state.resources.attention.stock;
  const issued = e.issueEdict({ id: 'MANDATORY_SIESTA', expectedRevision: 0, reason: 'Test a visible time-bounded edict.' });
  assert.equal(issued.ok, true); assert.equal(e.state.resources.funds.stock, funds - 6); assert.equal(e.state.resources.attention.stock, attention - 1); assert.equal(e.state.society.activeEdicts[0].remainingQuarters, 2);
  e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Use the first declared edict quarter.' });
  assert.equal(e.state.society.activeEdicts[0].remainingQuarters, 1);
  e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Use the second declared edict quarter.' });
  assert.equal(e.state.society.activeEdicts.some(edict => edict.id === 'MANDATORY_SIESTA'), false);
});

test('at most one dilemma opens and it remains unresolved until a human choice', 'human dilemma agency', () => {
  const e = engine(); e.advanceQuarter({ expectedRevision: 0, reason: 'Open one evidence-led dilemma.' });
  const id = e.state.society.currentDilemma.id, history = e.state.society.dilemmaHistory.length;
  e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Leave the existing dilemma for later.' });
  assert.equal(e.state.society.currentDilemma.id, id); assert.equal(e.state.society.currentDilemma.status, 'OPEN'); assert.equal(e.state.society.dilemmaHistory.length, history);
});

test('an unaffordable dilemma choice is refused atomically', 'dilemma conservation', () => {
  const e = engine(); e.advanceQuarter({ expectedRevision: 0, reason: 'Open a dilemma for atomic testing.' });
  const dilemma = e.state.society.currentDilemma; e.state.resources.attention.stock = 0;
  const choice = dilemma.choices.find(entry => entry.id === 'BIOSECURITY') || dilemma.choices.find(entry => entry.effects && entry.effects.resources && entry.effects.resources.attention < 0);
  assert(choice); const before = Canonical.stableStringify(e.exportState());
  const result = e.resolveDilemma({ dilemmaId: dilemma.id, choiceId: choice.id, expectedRevision: e.state.revision, reason: 'Test an unaffordable explicit choice.' });
  assert.equal(result.ok, false); assert.equal(Canonical.stableStringify(e.exportState()), before);
});

test('elections react deterministically and a weak result does not end the world', 'election pacing', () => {
  const a = engine('election-seed'), b = engine('election-seed');
  for (let i = 0; i < 7; i += 1) {
    a.advanceQuarter({ expectedRevision: a.state.revision, reason: 'Explicit election pacing quarter ' + i + '.' });
    b.advanceQuarter({ expectedRevision: b.state.revision, reason: 'Explicit election pacing quarter ' + i + '.' });
  }
  assert.equal(a.state.society.election.electionsHeld, 1); assert(a.state.society.election.lastResult); assert.equal(a.state.turn, 7); assert.equal(a.validate().ok, true);
  assert.equal(Canonical.stableStringify(a.exportState()), Canonical.stableStringify(b.exportState()));
});

test('pollinator abundance improves declared farm production', 'ecological causality', () => {
  const base = engine('pollination-cause').exportState(); base.districts.find(district => district.id === 'district-westmeadow').services.FARM = 2;
  const lowState = Canonical.clone(base), highState = Canonical.clone(base);
  lowState.inhabitants.pollinators.population = 0; highState.inhabitants.pollinators.population = highState.inhabitants.pollinators.capacity;
  const low = new Living.Engine(lowState), high = new Living.Engine(highState);
  low.advanceQuarter({ expectedRevision: 0, reason: 'Measure low-pollination food flow.' }); high.advanceQuarter({ expectedRevision: 0, reason: 'Measure high-pollination food flow.' });
  assert(high.state.flows.produced.food > low.state.flows.produced.food);
});

test('introduced predators suppress native ground life', 'food-web causality', () => {
  const base = engine('invasive-cause').exportState(), lowState = Canonical.clone(base), highState = Canonical.clone(base);
  lowState.inhabitants.invasivePredators.population = 0; highState.inhabitants.invasivePredators.population = highState.inhabitants.invasivePredators.capacity;
  const low = new Living.Engine(lowState), high = new Living.Engine(highState);
  low.advanceQuarter({ expectedRevision: 0, reason: 'Measure low introduced-predator pressure.' }); high.advanceQuarter({ expectedRevision: 0, reason: 'Measure high introduced-predator pressure.' });
  assert(high.state.inhabitants.nativeRodents.population < low.state.inhabitants.nativeRodents.population);
});

test('geckos join frogs and bats in lowering tropical insect pressure', 'food-web causality', () => {
  const low = engine('gecko-control').exportState(), high = Canonical.clone(low);
  low.inhabitants.geckos.population = 0; high.inhabitants.geckos.population = high.inhabitants.geckos.capacity;
  Ecology.recalculate(low); Ecology.recalculate(high);
  assert(high.ecologyDynamics.naturalPestControl > low.ecologyDynamics.naturalPestControl);
  assert(high.ecologyDynamics.pestPressure < low.ecologyDynamics.pestPressure);
  assert(high.ecologyDynamics.farmYieldMultiplier > low.ecologyDynamics.farmYieldMultiplier);
});

test('canopy birds and iguanas create a delayed woodland recovery service', 'food-web causality', () => {
  const low = engine('seed-service').exportState(), high = Canonical.clone(low);
  low.inhabitants.canopyBirds.population = 0; low.inhabitants.iguanas.population = 0;
  high.inhabitants.canopyBirds.population = high.inhabitants.canopyBirds.capacity; high.inhabitants.iguanas.population = high.inhabitants.iguanas.capacity;
  Ecology.recalculate(low); Ecology.recalculate(high); Ecology.recalculate(low); Ecology.recalculate(high);
  assert(high.ecologyDynamics.seedDispersalService > low.ecologyDynamics.seedDispersalService);
  assert(high.habitats.WOODLAND.quality > low.habitats.WOODLAND.quality);
});

test('land-crab recycling raises the wetland water-quality buffer', 'food-web causality', () => {
  const low = engine('crab-recycling').exportState(), high = Canonical.clone(low);
  low.inhabitants.landCrabs.population = 0; high.inhabitants.landCrabs.population = high.inhabitants.landCrabs.capacity;
  Ecology.recalculate(low); Ecology.recalculate(high);
  assert(high.ecologyDynamics.shorelineRecycling > low.ecologyDynamics.shorelineRecycling);
  assert(high.ecologyDynamics.waterQuality > low.ecologyDynamics.waterQuality);
});

test('introduced predators suppress every new native ground guild', 'food-web causality', () => {
  const base = engine('tropical-predator-cause').exportState(), lowState = Canonical.clone(base), highState = Canonical.clone(base);
  lowState.inhabitants.invasivePredators.population = 0; highState.inhabitants.invasivePredators.population = highState.inhabitants.invasivePredators.capacity;
  const low = new Living.Engine(lowState), high = new Living.Engine(highState);
  low.advanceQuarter({ expectedRevision: 0, reason: 'Measure native ground guilds with low predator pressure.' });
  high.advanceQuarter({ expectedRevision: 0, reason: 'Measure native ground guilds with high predator pressure.' });
  ['geckos','landCrabs','iguanas'].forEach(id => assert(high.state.inhabitants[id].population < low.state.inhabitants[id].population, id));
});

test('strategic weather stays warm while wet and dry tropical quarters vary', 'tropical climate', () => {
  const e = engine('tropical-weather'), regimes = new Set([e.state.climate.rainfallRegime]);
  assert(e.state.climate.temperatureC >= 20);
  for (let i = 0; i < 8; i += 1) { e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Observe a bounded warm-island weather quarter.' }); assert(e.state.climate.temperatureC >= 20); regimes.add(e.state.climate.rainfallRegime); }
  assert(regimes.has('WET')); assert(regimes.has('DRY') || regimes.has('TRADE_WIND'));
});

test('a reviewed road lowers habitat connectivity', 'fragmentation causality', () => {
  const e = engine(), before = e.state.ecologyDynamics.habitatConnectivity;
  const created = submit(e, operation('PROPOSE_ROAD', { fromDistrictId: 'district-northgrove', toDistrictId: 'district-eastreach' }), 'connectivity-road'); approveAndApply(e, created.proposal);
  assert(e.state.ecologyDynamics.habitatConnectivity < before);
});

test('a reviewed ecological buffer improves its habitat evidence', 'restoration causality', () => {
  const e = engine(), before = e.state.habitats.WETLAND_EDGE.quality;
  const created = submit(e, operation('PROPOSE_ECO_BUFFER', { districtId: 'district-lakeward' }), 'wetland-buffer'); approveAndApply(e, created.proposal);
  assert(e.state.habitats.WETLAND_EDGE.quality > before);
});

test('wetland condition jointly changes water quality, frog capacity and fish capacity', 'freshwater coupling', () => {
  const good = engine('wetland-cause').exportState(), poor = Canonical.clone(good), lakeward = poor.districts.find(district => district.id === 'district-lakeward');
  lakeward.ecology.vegetation = 0; lakeward.ecology.biodiversity = 0; lakeward.ecology.pollution = 100; lakeward.soil.moisture = 0.05;
  Ecology.recalculate(good); Ecology.recalculate(poor);
  assert(good.ecologyDynamics.waterQuality > poor.ecologyDynamics.waterQuality);
  assert(good.inhabitants.frogs.capacity > poor.inhabitants.frogs.capacity); assert(good.inhabitants.fish.capacity > poor.inhabitants.fish.capacity);
});

test('construction uses small physical quantities and an exact explained cash stack', 'causal construction costs', () => {
  const e = engine('cost-stack');
  const clinic = e.estimateOperations([operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'CLINIC' })]);
  const road = e.estimateOperations([operation('PROPOSE_ROAD', { fromDistrictId: 'district-northgrove', toDistrictId: 'district-eastreach' })]);
  assert.equal(clinic.costs.materials, 4); assert.equal(road.costs.materials, 6);
  const lines = clinic.economicBreakdowns[0].breakdown, fundSum = lines.filter(line => line.paidAs === 'funds').reduce((total, line) => total + line.value, 0);
  assert(Math.abs(fundSum - clinic.costs.funds) < 0.02); assert(lines.some(line => line.component === 'Local crews')); assert(lines.some(line => line.component === 'Equipment and fixtures')); assert(lines.some(line => line.physicalSource === 'typed private supply')); assert(clinic.economicBreakdowns[0].why.some(line => /Private sales never become treasury cash|neither private sales/i.test(line)));
});

test('approved civic construction consumes its exact typed product bill and undo restores it', 'typed construction conservation', () => {
  const e = engine('typed-build'), before = Canonical.clone(e.state.supply.inventory);
  const created = submit(e, operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'CLINIC' }), 'typed-clinic');
  const bill = created.proposal.economicBreakdowns[0].goodsBill; approveAndApply(e, created.proposal);
  Object.keys(bill).forEach(id => assert(Math.abs((before[id].stock - e.state.supply.inventory[id].stock) - bill[id]) < 0.0001, id));
  assert(e.state.receipts.at(-1).resourceChanges.some(change => /^goods:/.test(change.resource)));
  const undone = e.undoProposal({ proposalId: created.proposal.id, reason: 'Restore the exact typed construction inputs.' }); assert.equal(undone.ok, true);
  assert.equal(Canonical.stableStringify(e.state.supply.inventory), Canonical.stableStringify(before));
});

test('one explicit quarter conserves every typed product across recipes, shops and startup use', 'typed goods conservation', () => {
  const e = engine('goods-conservation'), before = Goods.GOOD_ORDER.reduce((out, id) => { out[id] = e.state.supply.inventory[id].stock; return out; }, {});
  const result = e.advanceQuarter({ expectedRevision: 0, reason: 'Audit every typed product movement.' }); assert.equal(result.ok, true);
  Goods.GOOD_ORDER.forEach(id => {
    const net = result.goods.transactions.filter(tx => tx.good === id).reduce((total, tx) => total + (tx.kind === 'PRODUCE' ? tx.quantity : -tx.quantity), 0);
    assert(Math.abs((e.state.supply.inventory[id].stock - before[id]) - net) < 0.001, id);
  });
});

test('underlying deposits strongly change which private enterprise is favored', 'deposit-led emergence', () => {
  const state = engine('deposit-choice').exportState(), district = state.districts.find(d => d.id === 'district-eastreach'); district.zone = 'INDUSTRY';
  const deposits = state.supply.deposits[district.id]; deposits.timber.quality = deposits.timber.remaining = 100; deposits.clay.quality = deposits.clay.remaining = 1;
  let candidates = Goods.candidateEnterprises(state).filter(item => item.districtId === district.id); const timber = candidates.find(item => item.type === 'TIMBER_CAMP'), clay = candidates.find(item => item.type === 'CLAY_PIT'); assert(timber.score > clay.score);
  deposits.timber.quality = deposits.timber.remaining = 1; deposits.clay.quality = deposits.clay.remaining = 100;
  candidates = Goods.candidateEnterprises(state).filter(item => item.districtId === district.id); assert(candidates.find(item => item.type === 'CLAY_PIT').score > candidates.find(item => item.type === 'TIMBER_CAMP').score);
});

test('typed surplus becomes trade-ready evidence but never auto-exports', 'future trade boundary', () => {
  const e = engine('typed-trade-ready'); Goods.GOOD_ORDER.forEach(id => { e.state.supply.inventory[id].stock = e.state.supply.inventory[id].capacity; });
  const result = Goods.advance(e.state, { energyFactor: 1, waterFactor: 1, visitors: 0 });
  assert(result.tradeReadiness.lots.length > 0); assert(result.tradeReadiness.lots.every(lot => lot.status === 'READY_NOT_EXPORTED'));
  assert.equal(result.transactions.some(tx => /EXPORT/.test(tx.kind)), false); assert.equal(e.state.supply.boundaries.externalTradeNotConnected, true);
});

test('scarce inputs raise both visible prices and price-linked equipment costs', 'price causality', () => {
  const abundant = engine('price-cause').exportState(), scarce = Canonical.clone(abundant);
  abundant.resources.energy.stock = abundant.resources.energy.capacity; abundant.resources.materials.stock = abundant.resources.materials.capacity;
  scarce.resources.energy.stock = 2; scarce.resources.materials.stock = 2;
  Economy.recalculatePrices(abundant); Economy.recalculatePrices(scarce);
  const op = operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'SOLAR_COOP' });
  const cheap = Economy.estimateConstruction(abundant, op), dear = Economy.estimateConstruction(scarce, op);
  assert(scarce.economy.prices.energy.current > abundant.economy.prices.energy.current); assert(scarce.economy.prices.materials.current > abundant.economy.prices.materials.current); assert(dear.costs.funds > cheap.costs.funds);
});

test('treasury movements equal named public income minus named expenses', 'financial conservation', () => {
  const e = engine('accounting'); const before = e.state.resources.funds.stock;
  e.advanceQuarter({ expectedRevision: 0, reason: 'Audit a named economic quarter.' });
  const t = e.state.economy.treasury;
  const incomeSum = Object.keys(t.income).filter(id => id !== 'total').reduce((sum, id) => sum + t.income[id], 0);
  const expenseSum = Object.keys(t.expenses).filter(id => id !== 'total').reduce((sum, id) => sum + t.expenses[id], 0);
  assert(Math.abs(incomeSum - t.income.total) < 0.002); assert(Math.abs(expenseSum - t.expenses.total) < 0.002);
  assert(Math.abs((e.state.resources.funds.stock - before) - (t.produced - t.consumed)) < 0.002); assert.equal(t.net, Canonical.round(t.produced - t.consumed, 3));
});

test('private sales and wages never appear wholesale as palace funds', 'accounting boundary', () => {
  const e = engine('private-boundary'); e.advanceQuarter({ expectedRevision: 0, reason: 'Trace private and public money separately.' });
  const economy = e.state.economy;
  const privateGross = Living.SECTOR_ORDER.filter(id => id !== 'publicServices').reduce((sum, id) => sum + economy.sectors[id].grossRevenue, 0);
  assert(privateGross > economy.treasury.income.total); assert(economy.households.wageIncome > economy.treasury.income.householdIncomeTax); assert.equal(e.state.boundaries.privateRevenueSeparateFromTreasury, true);
});

test('industry raises public finance but also creates an ecological tradeoff', 'industry causality', () => {
  const base = engine('industry-cause').exportState(), lowState = Canonical.clone(base), highState = Canonical.clone(base);
  lowState.districts.forEach(d => { if (d.zone === 'INDUSTRY') d.zone = 'NEUTRAL'; });
  highState.districts.find(d => d.id === 'district-westmeadow').zone = 'INDUSTRY';
  const low = new Living.Engine(lowState), high = new Living.Engine(highState);
  low.advanceQuarter({ expectedRevision: 0, reason: 'Measure an island without an industry zone.' }); high.advanceQuarter({ expectedRevision: 0, reason: 'Measure a more industrial island.' });
  const meanPollution = e => e.state.districts.reduce((sum, d) => sum + d.ecology.pollution, 0) / e.state.districts.length;
  assert(high.state.economy.sectors.industry.treasuryContribution > low.state.economy.sectors.industry.treasuryContribution); assert(high.state.flows.produced.materials > low.state.flows.produced.materials); assert(meanPollution(high) > meanPollution(low));
});

test('entertainment earns more when venues and access exist', 'entertainment causality', () => {
  const base = engine('entertainment-cause').exportState(), lowState = Canonical.clone(base), highState = Canonical.clone(base);
  lowState.districts.forEach(d => { if (d.zone === 'ENTERTAINMENT') d.zone = 'NEUTRAL'; });
  highState.districts.find(d => d.id === 'district-westmeadow').zone = 'ENTERTAINMENT'; highState.districts.find(d => d.id === 'district-southbank').services.MARKET = 1;
  highState.roads.push({ id: 'test-access-road', fromDistrictId: 'district-southbank', toDistrictId: 'district-westmeadow', condition: 100, createdByProposalId: 'test' });
  const low = new Living.Engine(lowState), high = new Living.Engine(highState);
  low.advanceQuarter({ expectedRevision: 0, reason: 'Measure limited entertainment access.' }); high.advanceQuarter({ expectedRevision: 0, reason: 'Measure venues with market and road access.' });
  assert(high.state.economy.ledger.at(-1).visitors > low.state.economy.ledger.at(-1).visitors); assert(high.state.economy.sectors.entertainment.treasuryContribution > low.state.economy.sectors.entertainment.treasuryContribution);
});

test('pollution visibly reduces visitors and entertainment finance', 'ecology-economy coupling', () => {
  const cleanState = engine('visitor-pollution').exportState(), dirtyState = Canonical.clone(cleanState);
  cleanState.districts.forEach(d => { d.ecology.pollution = 0; }); dirtyState.districts.forEach(d => { d.ecology.pollution = 100; });
  const clean = new Living.Engine(cleanState), dirty = new Living.Engine(dirtyState);
  clean.advanceQuarter({ expectedRevision: 0, reason: 'Measure clean-island visitor appeal.' }); dirty.advanceQuarter({ expectedRevision: 0, reason: 'Measure polluted-island visitor appeal.' });
  assert(clean.state.economy.ledger.at(-1).visitors > dirty.state.economy.ledger.at(-1).visitors); assert(clean.state.economy.sectors.entertainment.treasuryContribution > dirty.state.economy.sectors.entertainment.treasuryContribution);
});

test('material exports remove exact stock and never cross the protected reserve', 'trade conservation', () => {
  const e = engine('export-reserve'); e.advanceQuarter({ expectedRevision: 0, reason: 'Audit the protected export reserve.' });
  const trade = e.state.economy.trade;
  assert(Math.abs((trade.materialBeforeExport - trade.materialAfterExport) - trade.materialExports) < 0.002); assert(trade.materialAfterExport >= trade.reserveTarget); assert(e.state.flows.consumed.materials >= trade.materialExports);
});

test('industry can keep exporting after the material store reaches capacity', 'non-flat trade dynamics', () => {
  const e = engine('full-store-exports');
  for (let i = 0; i < 50; i += 1) e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Run a full-store export quarter ' + i + '.' });
  assert(e.state.resources.materials.stock <= e.state.resources.materials.capacity); assert(e.state.economy.trade.materialExports > 0); assert(e.state.economy.sectors.industry.treasuryContribution > 0);
});

test('clinics and schools create ongoing public costs instead of fake sales', 'service finance', () => {
  const base = engine('service-costs').exportState(), serviceState = Canonical.clone(base);
  serviceState.districts[0].services.CLINIC = 2; serviceState.districts[0].services.SCHOOL = 2;
  const plain = new Living.Engine(base), services = new Living.Engine(serviceState);
  plain.advanceQuarter({ expectedRevision: 0, reason: 'Measure starter public costs.' }); services.advanceQuarter({ expectedRevision: 0, reason: 'Measure clinic and school costs.' });
  assert(services.state.economy.treasury.expenses.total > plain.state.economy.treasury.expenses.total); assert.equal(services.state.economy.sectors.publicServices.grossRevenue, 0); assert(services.state.economy.sectors.publicServices.treasuryContribution < 0);
});

test('economy remains deterministic, finite and history-bounded over 200 quarters', 'economy bounds', () => {
  const a = engine('economy-long'), b = engine('economy-long');
  for (let i = 0; i < 200; i += 1) { a.advanceQuarter({ expectedRevision: a.state.revision, reason: 'Long economy quarter ' + i + '.' }); b.advanceQuarter({ expectedRevision: b.state.revision, reason: 'Long economy quarter ' + i + '.' }); }
  assert.equal(Canonical.stableStringify(a.state.economy), Canonical.stableStringify(b.state.economy)); assert.equal(a.validate().ok, true); assert(a.state.economy.ledger.length <= 24); assert(a.state.economy.priceHistory.length <= 24);
});

test('habitats, inhabitants and factions remain finite and bounded over 120 quarters', 'emergent bounds', () => {
  const e = engine('ecology-long-run');
  for (let i = 0; i < 120; i += 1) assert.equal(e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Bounded living-system quarter ' + i + '.' }).ok, true);
  assert.equal(e.validate().ok, true);
  Living.HABITAT_ORDER.forEach(id => { assert(e.state.habitats[id].quality >= 0 && e.state.habitats[id].quality <= 100); });
  Living.SPECIES_ORDER.forEach(id => { assert(Number.isFinite(e.state.inhabitants[id].population)); assert(e.state.inhabitants[id].population >= 0); });
  Living.FACTION_ORDER.forEach(id => { assert(e.state.society.factions[id].support >= 0 && e.state.society.factions[id].support <= 100); });
});

test('receipt hash chain verifies after decisions, apply and turns', 'receipt integrity', () => {
  const e = engine(), created = submit(e, operation('PROPOSE_SERVICE', { districtId: 'district-lakeward', service: 'WATER_WORKS' })); approveAndApply(e, created.proposal); e.advanceQuarter({ expectedRevision: e.state.revision, reason: 'Advance with a verified chain.' });
  const check = Living.verifyReceipts(e.state.receipts); assert.equal(check.ok, true); assert.equal(check.head, e.state.receiptHead);
});

test('actual Tycoon GlobeAdapter proposal packet is accepted for review, not applied', 'Tycoon compatibility', () => {
  const e = engine();
  const adapter = new TycoonAdapter.GlobeAdapter({ mode: 'proposal_only', worldId: e.state.worldId, revision: e.state.revision });
  const proposed = adapter.submitCityPatchProposal(packet(e, [operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'MARKET' })], 'from-real-tycoon-adapter'));
  assert.equal(proposed.ok, true); const before = Canonical.stableStringify(e.state.resources); const received = e.submitCityPatchProposal(proposed.proposal, { actor: { id: 'tycoon-steward', type: 'RULESET' } });
  assert.equal(received.ok, true); assert.equal(received.applied, false); assert.equal(Canonical.stableStringify(e.state.resources), before);
});

test('living world remains state owner and games may neither own nor reset it', 'ownership', () => {
  const e = engine(); assert.equal(e.state.boundaries.stateOwner, 'living-world'); assert.equal(e.state.boundaries.gamesMayOwnWorld, false); assert.equal(e.state.boundaries.gamesMayResetWorld, false); assert.equal(e.state.boundaries.approvalSeparateFromApplication, true);
});

test('duplicate proposal IDs are refused', 'idempotency', () => {
  const e = engine(), op = operation('PROPOSE_SERVICE', { districtId: 'district-northgrove', service: 'MARKET' }); assert.equal(submit(e, op, 'duplicate-id').ok, true); assert.equal(submit(e, op, 'duplicate-id').ok, false);
});

test('unsafe object keys are refused', 'input safety', () => {
  const e = engine(), p = packet(e, [operation('PROPOSE_ECO_BUFFER', { districtId: 'district-ridgeworks' })], 'unsafe-key'); Object.defineProperty(p, '__proto__', { value: { polluted: true }, enumerable: true });
  assert.equal(e.submitCityPatchProposal(p).ok, false);
});

test('invalid imported state is refused without replacement', 'state validation', () => {
  const e = engine(), bad = e.exportState(); bad.boundaries.stateOwner = 'game'; const before = Canonical.stableStringify(e.exportState()); const result = e.importState(bad); assert.equal(result.ok, false); assert.equal(Canonical.stableStringify(e.exportState()), before);
});

function missionContext(cooperative) {
  return { cooperative: cooperative === true, fishAlive: 100, rawFish: 100, cookedFish: 0, rod: true, fires: 10, wood: 100, treeCount: 100 };
}
function startMission(seed, cooperative) {
  return Missions.advance(Missions.createState(seed || 'mission-test'), 0, missionContext(cooperative)).state;
}

test('mission selection and state transitions replay deterministically', 'mission determinism', () => {
  const a = startMission('same-mission-seed', false), b = startMission('same-mission-seed', false);
  assert.equal(Canonical.stableStringify(a), Canonical.stableStringify(b));
  assert.equal(a.active.status, 'ACTIVE'); assert.equal(a.active.startedAt, 0); assert.equal(Missions.validate(a).ok, true);
});

test('missions remain open six active minutes and completed errands keep the four-minute start cadence', 'mission timing', () => {
  let state = startMission('mission-clock', false);
  let result = Missions.advance(state, 359, missionContext(false)); state = result.state;
  assert(state.active); assert.equal(result.events.length, 0);
  result = Missions.advance(state, 1, missionContext(false)); state = result.state;
  assert.deepEqual(result.events.map(event => event.type), ['MISSION_FAILED', 'MISSION_STARTED']);
  assert.equal(state.active.startedAt, 360); assert.equal(state.currency.balance, 0);

  state = startMission('mission-early-finish', false);
  state = Missions.record(state, { eventKind: state.active.eventKind, amount: state.active.goal, side: 'human' }).state;
  state = Missions.advance(state, 239, missionContext(false)).state; assert.equal(state.active, null);
  result = Missions.advance(state, 1, missionContext(false));
  assert.equal(result.events[0].type, 'MISSION_STARTED'); assert.equal(result.state.active.startedAt, 240);
});

test('two completed starter errands unlock six expanded mission variants', 'mission content progression', () => {
  let state = startMission('expanded-catalog', false), summary = Missions.summary(state);
  assert.equal(Missions.MISSION_ORDER.length, 12); assert.equal(summary.catalog.unlocked, 6); assert.equal(summary.catalog.expandedUnlocked, false);
  for (let i = 0; i < 2; i += 1) {
    state = Missions.record(state, { eventKind: state.active.eventKind, amount: state.active.goal, side: 'human' }).state;
    if (i === 0) state = Missions.advance(state, Missions.INTERVAL_SECONDS, missionContext(false)).state;
  }
  summary = Missions.summary(state);
  assert.equal(summary.catalog.unlocked, 12); assert.equal(summary.catalog.expandedUnlocked, true);
  assert.deepEqual(Missions.MISSION_ORDER.filter(id => Missions.DEFINITIONS[id].tier === 'EXPANDED'), ['SHORELINE_SURVEY', 'NURSERY_PROMISE', 'WINDBREAK_WORKS', 'LAKE_RECOVERY', 'BEACON_CHAIN', 'FESTIVAL_TABLE']);
});

test('four completed errands finish a repeatable stewardship tour and grant one bounded bonus', 'longer mission route', () => {
  let state = startMission('four-errand-tour', false), ordinaryRewards = 0, finalEvents = [];
  for (let i = 0; i < Missions.TOUR_MISSIONS; i += 1) {
    ordinaryRewards += state.active.reward.amount;
    const result = Missions.record(state, { eventKind: state.active.eventKind, amount: state.active.goal, side: 'human' });
    state = result.state; finalEvents = result.events;
    if (i < Missions.TOUR_MISSIONS - 1) state = Missions.advance(state, Missions.INTERVAL_SECONDS, missionContext(false)).state;
  }
  assert.deepEqual(finalEvents.map(event => event.type), ['MISSION_PROGRESS', 'MISSION_COMPLETED', 'MISSION_TOUR_COMPLETED']);
  assert.equal(state.currency.balance, ordinaryRewards + Missions.TOUR_BONUS);
  assert.equal(state.progression.toursCompleted, 1); assert.equal(state.progression.tourNumber, 2);
  assert.equal(state.progression.completedInTour, 0); assert.equal(state.progression.totalCompleted, 4);
  assert.equal(state.progression.currentStreak, 4); assert.equal(state.progression.bestStreak, 4);
  assert.equal(Missions.validate(state).ok, true);
});

test('v0.1 mission saves preserve Laurels and bounded history while gaining tour progression', 'mission save migration', () => {
  const legacy = Missions.createState('legacy-missions');
  legacy.schema = Missions.LEGACY_STATE_SCHEMA; legacy.version = '0.1.0'; legacy.currency.balance = 7;
  legacy.history = [{ id: 'legacy-complete', status: 'COMPLETED' }]; delete legacy.progression;
  const migrated = Missions.migrate(legacy, 'legacy-missions');
  assert.equal(migrated.schema, Missions.STATE_SCHEMA); assert.equal(migrated.version, Missions.VERSION);
  assert.equal(migrated.currency.balance, 7); assert.equal(migrated.history.length, 1);
  assert.equal(migrated.progression.totalCompleted, 1); assert.equal(migrated.progression.completedInTour, 1);
  assert.equal(migrated.boundaries.tourBonusIsCeremonial, true); assert.equal(Missions.validate(migrated).ok, true);
});

test('co-op snapshots twice the solo goal and reward for the same mission', 'cooperative missions', () => {
  const solo = startMission('same-coop-seed', false).active, coop = startMission('same-coop-seed', true).active;
  assert.equal(coop.definitionId, solo.definitionId); assert.equal(coop.goal, solo.goal * 2); assert.equal(coop.reward.amount, solo.reward.amount * 2);
  assert.equal(coop.cooperative, true); assert.equal(solo.cooperative, false);
});

test('human and AI contributions combine toward one co-op mission and reward exactly once', 'cooperative missions', () => {
  let state = startMission('shared-mission', true), active = state.active, half = active.goal / 2;
  let result = Missions.record(state, { eventKind: active.eventKind, amount: half, side: 'human' }); state = result.state;
  assert.equal(result.counted, true); assert.equal(state.active.contributions.human, half); assert.equal(state.currency.balance, 0);
  result = Missions.record(state, { eventKind: active.eventKind, amount: active.goal, side: 'ai' }); state = result.state;
  assert.equal(result.events.at(-1).type, 'MISSION_COMPLETED'); assert.equal(state.active, null);
  assert.equal(state.history.at(-1).contributions.human, half); assert.equal(state.history.at(-1).contributions.ai, half);
  assert.equal(state.currency.balance, active.reward.amount);
  result = Missions.record(state, { eventKind: active.eventKind, amount: active.goal, side: 'human' });
  assert.equal(result.counted, false); assert.equal(result.state.currency.balance, active.reward.amount);
});

test('AI progress is refused on a mission that started solo', 'mission authority', () => {
  const state = startMission('solo-seat-gate', false), active = state.active;
  const result = Missions.record(state, { eventKind: active.eventKind, amount: active.goal, side: 'ai' });
  assert.equal(result.counted, false); assert.equal(result.state.active.progress, 0);
  assert.equal(result.events[0].type, 'MISSION_PROGRESS_REFUSED');
});

test('Festival Laurels are bounded mission currency and never treasury cash', 'mission economy boundary', () => {
  const e = engine('laurel-boundary'), fundsBefore = e.state.resources.funds.stock;
  let state = startMission('laurel-boundary', false), active = state.active;
  const tampered = Canonical.clone(state); tampered.active.reward.amount = 999;
  assert.equal(Missions.migrate(tampered, 'laurel-boundary').active, null, 'a forged active reward must not survive migration');
  state = Missions.record(state, { eventKind: active.eventKind, amount: active.goal, side: 'human' }).state;
  assert(state.currency.balance > 0); assert.equal(e.state.resources.funds.stock, fundsBefore);
  assert.equal(Missions.CURRENCY.treasuryEquivalent, false); assert.equal(Missions.CURRENCY.tradeable, false);
  assert.equal(Missions.CURRENCY.spendingConnected, false); assert.equal(typeof Missions.spend, 'undefined');
  assert.equal(state.boundaries.noAutomaticStrategicTurn, true); assert.equal(Missions.validate(state).ok, true);
});

test('mission history remains bounded through repeated completions', 'mission save bounds', () => {
  let state = startMission('mission-history', true);
  for (let i = 0; i < Missions.HISTORY_LIMIT + 7; i += 1) {
    const active = state.active;
    state = Missions.record(state, { eventKind: active.eventKind, amount: active.goal, side: i % 2 ? 'ai' : 'human' }).state;
    if (i < Missions.HISTORY_LIMIT + 6) state = Missions.advance(state, Missions.INTERVAL_SECONDS, missionContext(true)).state;
  }
  assert.equal(state.history.length, Missions.HISTORY_LIMIT); assert.equal(state.history[0].id, 'island-mission-00008');
  assert.equal(Missions.validate(state).ok, true);
});

function metricMissionContext(cooperative) {
  const mission = Missions.advance(Missions.createState('metric-mission'), 0, missionContext(cooperative)).state;
  return { mission: Missions.summary(mission), aiConnection: { status: cooperative ? 'CONNECTED' : 'DISCONNECTED', label: cooperative ? 'Test AI Connector' : null }, cooperativeProject: { status: cooperative ? 'AWAITING_HUMAN' : 'AWAITING_BOTH' } };
}

test('shared steward report is deterministic, read-only and keeps five truths separate', 'metric truth boundary', () => {
  const e = engine('metric-determinism'), history = Metrics.capture(Metrics.createState(), e.state), context = metricMissionContext(false);
  const beforeState = Canonical.stableStringify(e.exportState()), beforeHistory = Canonical.stableStringify(history);
  const first = Metrics.buildReport(history, e.state, context), second = Metrics.buildReport(history, e.state, context);
  assert.equal(Canonical.stableStringify(first), Canonical.stableStringify(second));
  assert.deepEqual(first.cards.map(card => card.id), ['ecology', 'people', 'economy', 'supply', 'mission']);
  assert.equal(first.noOverallScore, true); assert.equal(Object.prototype.hasOwnProperty.call(first, 'overallScore'), false);
  assert.equal(first.cards[0].primary.source, 'strategic.ecologyDynamics.foodWebHealth'); assert.equal(first.cards[2].primary.source, 'strategic.economy.treasury.net');
  assert.equal(Canonical.stableStringify(e.exportState()), beforeState); assert.equal(Canonical.stableStringify(history), beforeHistory);
});

test('metric history stores one reading per revision, replaces same-revision readings and stays bounded', 'metric save bounds', () => {
  const base = engine('metric-history').exportState(); let history = Metrics.createState();
  for (let revision = 0; revision < Metrics.HISTORY_LIMIT + 6; revision += 1) {
    const state = Canonical.clone(base); state.revision = revision; state.turn = revision; state.society.publicApproval = 40 + revision;
    history = Metrics.capture(history, state);
    if (revision === 4) { state.society.publicApproval = 91; history = Metrics.capture(history, state); }
  }
  assert.equal(history.records.length, Metrics.HISTORY_LIMIT); assert.equal(history.records[0].revision, 6); assert.equal(history.records.at(-1).revision, Metrics.HISTORY_LIMIT + 5);
  const revisionFourOnly = Metrics.capture(Metrics.createState(), Object.assign(Canonical.clone(base), { revision: 4 }));
  const replacement = Canonical.clone(base); replacement.revision = 4; replacement.society.publicApproval = 91;
  const replaced = Metrics.capture(revisionFourOnly, replacement); assert.equal(replaced.records.length, 1); assert.equal(replaced.records[0].values.approval, 91);
  assert.equal(Metrics.validate(history).ok, true);
});

test('public-book infographic preserves exact accounts and keeps private sales outside the treasury flow', 'metric economic causality', () => {
  const e = engine('metric-books'); e.advanceQuarter({ expectedRevision: 0, reason: 'Create exact books for the shared brief.' });
  const before = Canonical.stableStringify(e.exportState()), report = Metrics.buildReport(Metrics.createState(), e.state, metricMissionContext(false));
  const card = report.cards.find(entry => entry.id === 'economy'), treasury = e.state.economy.treasury;
  assert.equal(card.flow.income, treasury.produced); assert.equal(card.flow.expenses, treasury.consumed); assert.equal(card.flow.net, treasury.net); assert.equal(card.flow.closingFunds, treasury.closingFunds);
  assert.equal(card.privateMarket.sales, e.state.supply.market.salesRevenue); assert.equal(Object.prototype.hasOwnProperty.call(card.flow, 'privateSales'), false);
  assert.equal(card.flow.sectors.find(sector => sector.id === 'industry').treasuryContribution, e.state.economy.sectors.industry.treasuryContribution);
  assert.equal(card.flow.sectors.find(sector => sector.id === 'entertainment').treasuryContribution, e.state.economy.sectors.entertainment.treasuryContribution);
  assert.equal(Canonical.stableStringify(e.exportState()), before);
});

test('ecology infographic and warnings move from exact water and introduced-pressure readings', 'metric ecological causality', () => {
  const state = engine('metric-ecology').exportState(); state.ecologyDynamics.waterQuality = 31; state.ecologyDynamics.invasivePressure = 0.81; state.ecologyDynamics.foodWebHealth = 0.44;
  const report = Metrics.buildReport(Metrics.createState(), state, metricMissionContext(false)), card = report.cards.find(entry => entry.id === 'ecology');
  assert.equal(card.metrics.find(metric => metric.id === 'waterQuality').value, 31); assert.equal(card.metrics.find(metric => metric.id === 'waterQuality').status, 'RISK');
  assert.equal(card.metrics.find(metric => metric.id === 'invasivePressure').value, 81); assert.equal(card.metrics.find(metric => metric.id === 'invasivePressure').status, 'RISK');
  assert(report.signals.some(signal => signal.evidence.metric === 'waterQuality' && signal.evidence.value === 31));
  assert(report.signals.some(signal => signal.evidence.metric === 'invasivePressure' && signal.evidence.value === 81));
});

test('supply infographic exposes exact civic reserves, named bottlenecks and typed shortfalls', 'metric supply causality', () => {
  const state = engine('metric-supply').exportState(); state.resources.water = { stock: 17, capacity: 100, unit: 'water units' };
  state.supply.market.shortages = [{ good: 'bricks', label: 'Bricks', demanded: 8, supplied: 3, shortfall: 5 }];
  const report = Metrics.buildReport(Metrics.createState(), state, metricMissionContext(false)), card = report.cards.find(entry => entry.id === 'supply'), water = card.publicReserves.find(entry => entry.id === 'water');
  assert.equal(water.stock, 17); assert.equal(water.capacity, 100); assert.equal(water.ratio, 17); assert.equal(water.status, 'RISK');
  assert.equal(card.metrics.find(metric => metric.id === 'shortages').value, 1); assert.equal(card.shortages[0].good, 'bricks'); assert.equal(card.shortages[0].shortfall, 5);
  assert(card.bottleneck && card.bottleneck.label); assert(report.signals.some(signal => signal.evidence.metric === 'waterRatio' && signal.evidence.value === 17));
});

test('people and mission cards expose the weakest request and both cooperative contributions', 'metric co-op evidence', () => {
  const state = engine('metric-people').exportState(); state.society.factions.workers.support = 32; state.society.factions.workers.request = 'Bring reachable work to Northgrove.';
  let mission = Missions.advance(Missions.createState('metric-coop'), 0, missionContext(true)).state;
  mission = Missions.record(mission, { eventKind: mission.active.eventKind, amount: mission.active.goal / 4, side: 'human' }).state;
  mission = Missions.record(mission, { eventKind: mission.active.eventKind, amount: mission.active.goal / 4, side: 'ai' }).state;
  const report = Metrics.buildReport(Metrics.createState(), state, { mission: Missions.summary(mission), aiConnection: { status: 'CONNECTED', label: 'Test AI Connector' }, cooperativeProject: { status: 'AWAITING_HUMAN' } });
  const people = report.cards.find(entry => entry.id === 'people'), task = report.cards.find(entry => entry.id === 'mission');
  assert.equal(people.weakestFaction.id, 'workers'); assert.equal(people.weakestFaction.support, 32); assert(people.causes.some(line => /Bring reachable work/.test(line)));
  assert.equal(task.active.cooperative, true); assert.equal(task.active.contributions.human, mission.active.goal / 4); assert.equal(task.active.contributions.ai, mission.active.goal / 4);
  assert.equal(task.bothSeatsCountWhenCooperative, true); assert.equal(task.strategicAuthority, false);
});

test('AI observation receives the same bounded read-only steward report', 'shared player metrics', () => {
  const seat = AISeat.createState([0, 1, 0]), report = Metrics.buildReport(Metrics.createState(), engine('metric-ai').state, metricMissionContext(false));
  const before = Canonical.stableStringify(seat), observed = AISeat.observe(seat, { stewardMetrics: report });
  assert.equal(observed.stewardMetrics.schema, Metrics.REPORT_SCHEMA); assert.equal(observed.stewardMetrics.noOverallScore, true); assert.equal(observed.stewardMetrics.cards.length, 5);
  assert.equal(Canonical.stableStringify(seat), before);
});

test('AI player seat starts tangent and across the globe from the human', 'AI seat identity', () => {
  const state = AISeat.createState([0, 1, 0]);
  assert.equal(state.id, AISeat.SEAT_ID); assert.equal(state.role, 'AI_PLAYER'); assert.equal(state.connection.status, 'DISCONNECTED');
  assert(Math.abs(state.transform.position[1] + 1) < 1e-9); assert(Math.abs(state.transform.position.reduce((n, v, i) => n + v * state.transform.forward[i], 0)) < 1e-9);
  assert.equal(AISeat.validate(state).ok, true);
});

test('observing a disconnected AI seat is bounded and changes no state', 'AI observation', () => {
  const state = AISeat.createState([0, 1, 0]), before = Canonical.stableStringify(state);
  const observed = AISeat.observe(state, { sharedInventory: { wood: 3 }, nearby: { trees: [{ id: 'tree-1', distance: 2 }] }, mission: { active: { label: 'Test errand', progress: 1, goal: 2 } }, world: { worldAge: 4 } });
  assert.equal(observed.schema, AISeat.OBSERVATION_SCHEMA); assert.equal(observed.sharedInventory.wood, 3); assert.equal(observed.nearby.trees.length, 1);
  assert.equal(observed.mission.active.label, 'Test errand');
  assert.equal(observed.connection.status, 'DISCONNECTED'); assert.equal(Canonical.stableStringify(state), before); assert(observed.limitations.some(line => /No autonomous loop/.test(line)));
});

test('disconnected AI seat cannot move or act', 'AI connection gate', () => {
  const state = AISeat.createState([0, 1, 0]), before = Canonical.stableStringify(state);
  const intent = { schema: AISeat.INTENT_SCHEMA, seatId: AISeat.SEAT_ID, connectorId: 'nobody', id: 'blocked-move', expectedSequence: 0, type: 'MOVE', reason: 'Try a disconnected move.', payload: { forward: 1, distance: 1 } };
  const result = AISeat.submitIntent(state, intent, {}, { radius: 24 });
  assert.equal(result.ok, false); assert(/DISCONNECTED/.test(result.errors[0])); assert.equal(Canonical.stableStringify(state), before);
});

test('AI connection is explicit, named and receipt-linked', 'AI connection receipt', () => {
  const state = connectedAI();
  assert.equal(state.connection.status, 'CONNECTED'); assert.equal(state.connection.connectorId, 'test-ai-connector'); assert.equal(state.receipts.length, 1);
  assert.equal(state.receipts[0].kind, 'AI_SEAT_CONNECTED'); assert.equal(state.receipts[0].status, 'ACCEPTED'); assert.equal(state.receiptHead, state.receipts[0].hash);
});

test('browser reload releases a stale AI connection and requires an explicit reconnect', 'AI connection lifecycle', () => {
  const restored = AISeat.migrate(connectedAI(), [0, 1, 0]);
  assert.equal(restored.connection.status, 'DISCONNECTED'); assert.equal(restored.connection.connectorId, null);
  assert.equal(restored.receipts.at(-1).kind, 'AI_SEAT_RUNTIME_RELOAD'); assert.equal(AISeat.validate(restored).ok, true);
});

test('wrong connector and stale sequence are refused before mutation', 'AI command integrity', () => {
  const state = connectedAI(), before = Canonical.stableStringify(state);
  const wrong = aiIntent(state, 'wrong-owner', 'WAIT'); wrong.connectorId = 'other-connector';
  assert.equal(AISeat.submitIntent(state, wrong, {}, {}).ok, false);
  const stale = aiIntent(state, 'stale-command', 'WAIT'); stale.expectedSequence = 9;
  assert.equal(AISeat.submitIntent(state, stale, {}, {}).ok, false); assert.equal(Canonical.stableStringify(state), before);
});

test('same AI move intent produces the same bounded spherical transport', 'AI deterministic movement', () => {
  const a = connectedAI(), b = connectedAI();
  const ia = aiIntent(a, 'move-east-one', 'MOVE', { forward: 0.7, strafe: 0.4, distance: 2.25 });
  const ib = aiIntent(b, 'move-east-one', 'MOVE', { forward: 0.7, strafe: 0.4, distance: 2.25 });
  const ra = AISeat.submitIntent(a, ia, {}, { radius: 24, worldAge: 3 }), rb = AISeat.submitIntent(b, ib, {}, { radius: 24, worldAge: 3 });
  assert.equal(ra.ok, true); assert.equal(Canonical.stableStringify(ra.state), Canonical.stableStringify(rb.state));
  const p = ra.state.transform.position, f = ra.state.transform.forward;
  assert(Math.abs(Math.hypot(...p) - 1) < 1e-9); assert(Math.abs(Math.hypot(...f) - 1) < 1e-9); assert(Math.abs(p.reduce((n, v, i) => n + v * f[i], 0)) < 1e-9);
});

test('AI tools and world actions require separate explicit intents', 'AI action allowlist', () => {
  let state = connectedAI(), calls = 0;
  let selected = AISeat.submitIntent(state, aiIntent(state, 'select-coop', 'SET_TOOL', { tool: 'coop' }), {}, { worldAge: 4 });
  assert.equal(selected.ok, true); assert.equal(selected.state.tool, 'coop'); assert.equal(calls, 0); state = selected.state;
  const acted = AISeat.submitIntent(state, aiIntent(state, 'place-coop', 'ACT'), { act: context => { calls += 1; assert.equal(context.tool, 'coop'); return { ok: true, summary: 'AI placed its works endpoint.', changes: { endpoint: 'ai', wood: -2 } }; } }, { worldAge: 5 });
  assert.equal(acted.ok, true); assert.equal(calls, 1); assert.equal(acted.receipt.changes.endpoint, 'ai'); assert.equal(acted.state.commandSequence, 2);
});

test('a refused AI world action is still audited and cannot be replayed', 'AI refusal receipt', () => {
  const state = connectedAI(), intent = aiIntent(state, 'refused-act', 'ACT');
  const refused = AISeat.submitIntent(state, intent, { act: () => ({ ok: false, summary: 'Need two wood before building.', changes: {} }) }, { worldAge: 7 });
  assert.equal(refused.ok, false); assert.equal(refused.receipt.status, 'REFUSED'); assert.equal(refused.state.commandSequence, 1); assert.equal(refused.state.tool, 'chop');
  const replay = AISeat.submitIntent(refused.state, Object.assign({}, intent, { expectedSequence: 1 }), { act: () => ({ ok: true }) }, {});
  assert.equal(replay.ok, false); assert(replay.errors.some(error => /already processed/.test(error)));
});

test('AI receipt hashes form a verifiable bounded chain', 'AI receipt integrity', () => {
  let state = connectedAI();
  for (let i = 0; i < 130; i += 1) {
    const result = AISeat.submitIntent(state, aiIntent(state, 'wait-' + i, 'WAIT'), {}, { worldAge: i + 3 }); assert.equal(result.ok, true); state = result.state;
  }
  assert.equal(state.receipts.length, AISeat.MAX_RECEIPTS); assert.equal(state.processedIntentIds.length, 100); assert.equal(state.commandSequence, 130);
  for (let i = 0; i < state.receipts.length; i += 1) {
    const receipt = Canonical.clone(state.receipts[i]), hash = receipt.hash; delete receipt.hash;
    assert.equal(Canonical.sha256(Canonical.stableStringify(receipt)), hash);
    if (i > 0) assert.equal(state.receipts[i].previousHash, state.receipts[i - 1].hash);
  }
  assert.equal(state.receiptHead, state.receipts.at(-1).hash); assert.equal(AISeat.validate(state).ok, true);
});

test('tampered AI receipts are rejected on restore or reuse', 'AI receipt integrity', () => {
  const state = connectedAI(); state.receipts[0].label = 'Rewritten connector label';
  const checked = AISeat.validate(state); assert.equal(checked.ok, false); assert(checked.errors.some(error => /hash mismatch/.test(error)));
});

test('AI seat boundary tampering is detected', 'AI authority boundary', () => {
  const state = connectedAI(); state.boundaries.autonomousLoop = true; state.boundaries.strategicAuthority = true;
  const checked = AISeat.validate(state); assert.equal(checked.ok, false); assert(checked.errors.some(error => /boundaries were weakened/.test(error)));
});

test('globe exposes one human seat, one AI screen and a two-ended co-op project', 'AI Hub integration', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(/core\/ai-player-seat\.js/.test(html)); assert(/id="aiViewport"/.test(html)); assert(/AI_FOCUS/.test(html)); assert(/preferredSurface:'laptop'/.test(html));
  assert(/phoneTouch:false/.test(html)); assert(/humanTouchControls:false/.test(html)); assert(/Two-Shores Works Route/.test(html)); assert(/minimumSeparation:TUNE\.coopMinSeparation/.test(html));
  assert(/aiPlayerSeat:Object\.freeze/.test(html)); assert(/submitIntent:\(intent\)=>submitAIPlayerIntent/.test(html));
});

test('PC controls act once, relock predictably, normalize diagonals and give the AI an honest aim view', 'casual control polish', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(/function requestHumanPointerLock\(\)/.test(html));
  assert(/if\(!locked&&canvas\.requestPointerLock\)\{ requestHumanPointerLock\(\); return; \}/.test(html));
  assert(!/canvas\.addEventListener\('click',[^\n]*act\(\)/.test(html), 'canvas click must not duplicate the pointerup action');
  assert(/const inputMagnitude=Math\.hypot\(inF,inS\)/.test(html));
  assert(/if\(inputMagnitude>1\)\{ inF\/=inputMagnitude; inS\/=inputMagnitude; \}/.test(html));
  assert(/aiDisplayActor/.test(html)); assert(/function aiAimObservation\(\)/.test(html)); assert(/aim:aiAimObservation\(\)/.test(html));
  assert(/renderer\.toneMapping=THREE\.ACESFilmicToneMapping/.test(html)); assert(/<kbd>'\+key\+'<\/kbd>/.test(html));
});

test('supplied hardcopy is preserved byte-for-byte in source/', 'source integrity', () => {
  const original = fs.readFileSync(path.join(ROOT, 'source', 'globe-walk-1-original.html'));
  assert.equal(Canonical.sha256(original.toString('utf8')), 'bf14582156717f660efd09289aa26d65a6f5641ba116a99627330d29548582fc');
});

test('runtime uses local Three.js, restored API and no Math.random or remote URL', 'local runtime boundary', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(/\.\/vendor\/three\.module\.js/.test(html)); assert(/window\.AXMLivingWorld/.test(html)); assert(!/Math\.random\s*\(/.test(html)); assert(!/https?:\/\//.test(html)); assert(fs.statSync(path.join(ROOT, 'vendor', 'three.module.js')).size > 1000000);
});

test('tropical food-web inhabitants are local bounded procedural visuals', 'inhabitant rendering', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const visuals = fs.readFileSync(path.join(ROOT, 'core', 'island-inhabitants-visuals.js'), 'utf8');
  assert(/createIslandInhabitantVisuals/.test(html));
  ['pollinators','frogs','geckos','bats','canopyBirds','wadingBirds','landCrabs','iguanas'].forEach(id => assert(new RegExp(id).test(visuals)));
  assert(!/fetch\s*\(|https?:\/\//.test(visuals)); assert(/SphereGeometry|BufferGeometry/.test(visuals));
  assert(/tropical food-web inhabitants/.test(visuals)); assert(/visibleCount/.test(visuals));
});

test('vNext save key is namespaced away from the hardcopy legacy key', 'save isolation', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(/SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V10'/.test(html)); assert(/PRIOR_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V9'/.test(html));
  assert(/OLDER_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V8'/.test(html)); assert(/OLDEST_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V7'/.test(html)); assert(/ANCIENT_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V6'/.test(html)); assert(/EARLIEST_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V5'/.test(html)); assert(/ORIGINAL_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V4'/.test(html)); assert(/FOUNDING_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V3'/.test(html)); assert(/ORIGIN_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V2'/.test(html)); assert(/GENESIS_VNEXT_SAVE_KEY='AXM_LIVING_GLOBE_STEWARD_VNEXT_V1'/.test(html));
  assert(/schema:'axm\.living-globe\.local-save\/v11'/.test(html)); assert(/aiSeat:JSON\.parse/.test(html)); assert(/cooperativeProject:coopSnapshot/.test(html)); assert(/missions:missionSnapshot/.test(html)); assert(/stewardMetrics:metricSnapshot/.test(html)); assert(/LEGACY_SAVE_KEY='GLOBE_SAVE_V1'/.test(html));
});

test('walkable missions are wired to both seats, real actions, saves and the public read API', 'mission integration', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ai = fs.readFileSync(path.join(ROOT, 'core', 'ai-player-seat.js'), 'utf8');
  const missions = fs.readFileSync(path.join(ROOT, 'core', 'walkable-missions.js'), 'utf8');
  assert(/core\/walkable-missions\.js/.test(html)); assert(/id="missionCard"/.test(html));
  assert(/advanceMissionClock\(dt\)/.test(html)); assert(/missionMovementTick\(\)/.test(html));
  ['PLANT_LIFE','CATCH_FISH','GATHER_WOOD','COOK_FISH','BUILD_FIRE','TRAVEL'].forEach(kind => assert(new RegExp("recordMissionEvent\\('" + kind).test(html)));
  assert(/mission:window\.AXMWalkableMissions\.summary\(missionState\)/.test(html)); assert(/mission: compact\(context\.mission/.test(ai));
  assert(/MISSION_TOUR_COMPLETED/.test(html)); assert(/catalogSize:window\.AXMWalkableMissions\.MISSION_ORDER\.length/.test(html));
  assert(/missions:Object\.freeze/.test(html)); assert(/selected-snapshot\/v10/.test(html));
  assert(!/Math\.random\s*\(|Date\.now\s*\(|fetch\s*\(|https?:\/\//.test(missions));
});

test('shared Island Brief is wired to both screens, saves and a read-only public API', 'metric infographic integration', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const metrics = fs.readFileSync(path.join(ROOT, 'core', 'steward-metrics.js'), 'utf8');
  const graphics = fs.readFileSync(path.join(ROOT, 'core', 'steward-infographics.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'steward-infographics.css'), 'utf8');
  assert(/steward-infographics\.css/.test(html)); assert(/core\/steward-metrics\.js/.test(html)); assert(/core\/steward-infographics\.js/.test(html));
  assert(/id="aiMetricStrip"/.test(html)); assert(/stewardMetrics:currentStewardMetricReport\(\)/.test(html)); assert(/stewardMetrics: compact\(context\.stewardMetrics/.test(fs.readFileSync(path.join(ROOT, 'core', 'ai-player-seat.js'), 'utf8')));
  assert(/metrics:Object\.freeze/.test(html)); assert(/noOverallScore:true/.test(html)); assert(/sameReportForBothSeats:true/.test(html));
  assert(/stewardMetricState=window\.AXMStewardMetrics\.migrate\(d\.stewardMetrics\)/.test(html)); assert(/axm-infographics-open/.test(html)); assert(/axm-palace-open/.test(fs.readFileSync(path.join(ROOT, 'core', 'steward-panel.js'), 'utf8')));
  assert(/axm-brief-open/.test(html)); assert(/axm-palace-open/.test(html)); assert(/player\.keys=\{\}/.test(html));
  ['ecology','people','economy','supply','mission'].forEach(id => assert(new RegExp("card\\('" + id).test(metrics)));
  assert(/NO OVERALL ISLAND SCORE/.test(graphics)); assert(/Because… and what can I do\?/.test(graphics)); assert(/@media\(max-width:760px\)/.test(css)); assert(/prefers-reduced-motion:reduce/.test(css));
  assert(!/Math\.random\s*\(|Date\.now\s*\(|fetch\s*\(/.test(metrics + '\n' + graphics));
  assert(!/https?:\/\//.test(metrics)); assert(!/https?:\/\//.test(graphics.replaceAll("http://www.w3.org/2000/svg", '')));
});

test('captured emergence is explicit guidance and never a construction bypass', 'emergence memory boundary', () => {
  const html = fs.readFileSync(path.join(ROOT, 'game', 'tycoon-steward', 'index.html'), 'utf8');
  const patterns = fs.readFileSync(path.join(ROOT, 'game', 'tycoon-steward', 'core', 'emergence-patterns.js'), 'utf8');
  const emergence = fs.readFileSync(path.join(ROOT, 'game', 'tycoon-steward', 'core', 'emergence-engine.js'), 'utf8');
  const state = fs.readFileSync(path.join(ROOT, 'game', 'tycoon-steward', 'core', 'steward-state.js'), 'utf8');
  assert(html.indexOf('core/emergence-patterns.js') < html.indexOf('core/emergence-engine.js'));
  assert(/CAPTURE_EMERGENCE/.test(state)); assert(/APPLY_GOAL_LAYER/.test(state)); assert(/SET_GOAL_LAYER_MODE/.test(state));
  assert(/capturedEmergenceRequiresExplicitDecision:\s*true/.test(state)); assert(/goalLayersCannotBypassCosts:\s*true/.test(state));
  assert(/PRESERVE_GOAL_BASELINE_REACHED/.test(patterns)); assert(/PRESERVE/.test(patterns)); assert(/EVOLVE/.test(patterns));
  assert(/capturedGoal/.test(emergence)); assert(!/Math\.random\s*\(|Date\.now\s*\(/.test(patterns));
});

test('runtime contains no flat population-to-funds rule and exposes economy books', 'non-flat economy surface', () => {
  const living = fs.readFileSync(path.join(ROOT, 'core', 'living-state.js'), 'utf8'); const panel = fs.readFileSync(path.join(ROOT, 'core', 'steward-panel.js'), 'utf8');
  assert(!/fundProduction\s*=\s*totalPopulation/.test(living)); assert(/Economy\.advance/.test(living)); assert(/Economy books · why money moved/.test(panel)); assert(/Private money is not palace money/.test(panel));
});

test('included Tycoon UI has an explicit file-based host proposal round trip', 'usable ruleset handoff', () => {
  const html = fs.readFileSync(path.join(ROOT, 'game', 'tycoon-steward', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'game', 'tycoon-steward', 'app.js'), 'utf8');
  assert(/loadHostBridgeButton/.test(html)); assert(/exportHostProposalButton/.test(html));
  assert(/new window\.AXMTycoonGlobeAdapter\.GlobeAdapter/.test(app)); assert(/PROPOSAL_ONLY|proposal_only/.test(app));
  assert(/steward-bridge\/v0\.4/.test(app));
  assert(!/fetch\s*\(/.test(app));
});

test('walkable globe visual polish stays local, faceted and presentation-only', 'visual presentation', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const polish = fs.readFileSync(path.join(ROOT, 'core', 'island-visual-polish.js'), 'utf8');
  assert(/core\/island-visual-polish\.js/.test(html));
  assert(/AXMIslandVisualPolishFactory/.test(html));
  assert(/visualPolish\.setPlanet\(planet\)/.test(html));
  assert(/visualPolish\.updateSky/.test(html));
  assert(/IcosahedronGeometry/.test(polish));
  assert(/EdgesGeometry/.test(polish));
  assert(/BasicShadowMap/.test(polish));
  assert(/presentation-only/.test(polish));
  assert(!/Math\.random\s*\(|fetch\s*\(|https?:\/\//.test(polish));
});

console.log('\nAXM LIVING GLOBE STEWARD vNEXT HONEST EXAM — ' + pass + ' PASS · ' + fail + ' FAIL');
console.log('Node ' + process.version + ' · dependency-free core tests · browser click test separate');
process.exitCode = fail ? 1 : 0;
