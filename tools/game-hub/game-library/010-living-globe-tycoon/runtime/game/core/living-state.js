(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical,
    typeof module === 'object' && module.exports ? require('./island-ecology') : root.AXMIslandEcology,
    typeof module === 'object' && module.exports ? require('./island-society') : root.AXMIslandSociety,
    typeof module === 'object' && module.exports ? require('./island-goods') : root.AXMIslandGoods,
    typeof module === 'object' && module.exports ? require('./island-economy') : root.AXMIslandEconomy
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMLivingState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical, Ecology, Society, Goods, Economy) {
  'use strict';

  var VERSION = '0.5.0';
  var STATE_SCHEMA = 'axm.living-world.strategic-state/v0.5';
  var LEGACY_V4_STATE_SCHEMA = 'axm.living-world.strategic-state/v0.4';
  var LEGACY_V3_STATE_SCHEMA = 'axm.living-world.strategic-state/v0.3';
  var LEGACY_V2_STATE_SCHEMA = 'axm.living-world.strategic-state/v0.2';
  var LEGACY_STATE_SCHEMA = 'axm.living-world.strategic-state/v0.1';
  var PROPOSAL_SCHEMA = 'axm.tycoon-steward.city-patch-proposal/v0.1';
  var SNAPSHOT_SCHEMA = 'axm.tycoon-steward.host-snapshot/v0.1';
  var WORLD_ID = 'world.grafthold.globe.local-vnext';
  var OPERATIONS = ['PROPOSE_DISTRICT', 'PROPOSE_ROAD', 'PROPOSE_SERVICE', 'PROPOSE_ECO_BUFFER'];
  var ZONES = ['HOUSING', 'INDUSTRY', 'ENTERTAINMENT', 'NATURE', 'INFRASTRUCTURE', 'NEUTRAL'];
  var SERVICES = ['HOUSING', 'CLINIC', 'SCHOOL', 'MARKET', 'WATER_WORKS', 'SOLAR_COOP', 'FARM'];
  var SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
  var RESOURCE_ORDER = ['water', 'food', 'energy', 'materials', 'funds', 'attention'];

  function clone(value) { return Canonical.clone(value); }
  function round(value, digits) { return Canonical.round(value, digits == null ? 3 : digits); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function sum(values) { return values.reduce(function (total, value) { return total + value; }, 0); }
  function average(values) { return values.length ? sum(values) / values.length : 0; }
  function byId(items, id) { return (items || []).filter(function (item) { return item.id === id; })[0] || null; }
  function safeReason(value) { return typeof value === 'string' && value.trim().length >= 4; }

  function seedNumber(seed) {
    return parseInt(Canonical.sha256(String(seed)).slice(0, 8), 16) >>> 0 || 0x6d2b79f5;
  }

  function draw(state) {
    var x = state.prng.state >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.prng.state = x >>> 0 || 0x6d2b79f5;
    state.prng.draws += 1;
    return state.prng.state / 4294967296;
  }

  function resource(stock, capacity, unit) {
    return { stock: stock, capacity: capacity, unit: unit };
  }

  function district(id, name, direction, zone, population, waterAdjacency, elevation, fertility, moisture, biodiversity) {
    return {
      id: id,
      name: name,
      direction: direction,
      zone: zone,
      population: population,
      housingCapacity: population + 5,
      jobs: Math.max(2, population - 2),
      services: { HOUSING: 1, CLINIC: 0, SCHOOL: 0, MARKET: 0, WATER_WORKS: 0, SOLAR_COOP: 0, FARM: 0 },
      waterAdjacency: waterAdjacency,
      elevation: elevation,
      soil: { moisture: moisture, fertility: fertility, erosion: round((1 - fertility) * 18, 2) },
      ecology: { vegetation: round(55 + biodiversity * 0.25, 2), biodiversity: biodiversity, pollution: zone === 'INDUSTRY' ? 16 : 4, protectedBuffer: false },
      people: { health: 62, education: 48, foodAccess: 70, waterAccess: waterAdjacency ? 82 : 66 },
      needs: {},
      history: []
    };
  }

  function createInitialState(seed) {
    var sourceSeed = String(seed == null ? 'grafthold-vnext-001' : seed).slice(0, 120);
    var n = seedNumber(sourceSeed);
    var jitter = function (salt, scale) {
      var h = parseInt(Canonical.sha256(sourceSeed + ':' + salt).slice(0, 8), 16) / 4294967296;
      return round((h - 0.5) * scale, 3);
    };
    var districts = [
      district('district-northgrove', 'Northgrove', [0, 1, 0], 'HOUSING', 18, false, 0.46, clamp(0.72 + jitter('n-fert', 0.12), 0.2, 0.95), 0.58, 68),
      district('district-lakeward', 'Lakeward', [0.7, 0.45, 0.55], 'NATURE', 7, true, -0.08, clamp(0.84 + jitter('l-fert', 0.08), 0.2, 0.98), 0.86, 84),
      district('district-eastreach', 'Eastreach', [1, 0, 0], 'NEUTRAL', 12, false, 0.18, clamp(0.66 + jitter('e-fert', 0.12), 0.2, 0.95), 0.61, 62),
      district('district-southbank', 'Southbank', [0, -1, 0], 'ENTERTAINMENT', 10, true, 0.02, clamp(0.74 + jitter('s-fert', 0.1), 0.2, 0.95), 0.75, 70),
      district('district-ridgeworks', 'Ridgeworks', [-1, 0.05, 0], 'INDUSTRY', 9, false, 0.9, clamp(0.5 + jitter('r-fert', 0.1), 0.2, 0.9), 0.42, 45),
      district('district-westmeadow', 'Westmeadow', [-0.62, 0.35, 0.7], 'NEUTRAL', 6, false, 0.25, clamp(0.78 + jitter('w-fert', 0.08), 0.2, 0.98), 0.67, 76)
    ];
    var state = {
      schema: STATE_SCHEMA,
      version: VERSION,
      status: 'EXPERIMENTAL LOCAL TEST',
      worldId: WORLD_ID,
      worldSeed: sourceSeed,
      turn: 0,
      revision: 0,
      prng: { state: n, draws: 0 },
      calendar: { year: 1, quarter: 1, season: 'SPRING' },
      climate: { temperatureC: 26, rainfallMm: 112, rainfallRegime: 'TRADE_WIND', droughtIndex: 0.12, stormRisk: 0.16, note: 'Seeded warm-island weather; not a scientific forecast.' },
      districts: districts,
      roads: [],
      resources: {
        water: resource(150, 220, 'water units'),
        food: resource(104, 180, 'food units'),
        energy: resource(86, 160, 'energy units'),
        materials: resource(92, 160, 'material units'),
        funds: resource(150, 260, 'civic credits'),
        attention: resource(22, 30, 'attention points')
      },
      flows: { produced: {}, consumed: {}, shortages: [], explanation: ['No strategic quarter has advanced yet.'] },
      nativeObservation: { treeCount: null, fishAlive: null, reedCount: null, hareCount: null, foxCount: null, fireCount: null, wood: null, observedAtWorldAge: null },
      proposals: [],
      receiptSequence: 0,
      receipts: [],
      receiptHead: null,
      boundaries: {
        stateOwner: 'living-world',
        gamesAttachAsRulesets: true,
        gamesMayOwnWorld: false,
        gamesMayResetWorld: false,
        noAutomaticStrategicTurns: true,
        approvalSeparateFromApplication: true,
        noAutomaticDilemmaResolution: true,
        oneDilemmaAtATime: true,
        politicalHumorIsFiction: true,
        privateRevenueSeparateFromTreasury: true,
        physicalInventoryNotDoubleCharged: true,
        pricesHaveVisibleCauses: true,
        typedGoodsConserved: true,
        privateEnterprisesMayEmergeOnlyOnExplicitQuarter: true,
        externalTypedTradeConnected: false,
        scientificModel: false,
        localBrowserState: true
      },
      limitations: [
        'Strategic ecology, weather, economy and population are compact gameplay abstractions, not forecasts.',
        'Habitats, inhabitants, factions, elections and edicts are bounded gameplay abstractions, not scientific or political forecasts.',
        'Tropical species are modeled as functional guilds with habitat and food-web dependencies, not as a field census.',
        'The walkable ecology and strategic quarter model use different clocks and reconcile only at declared seams.',
        'Single-browser local state is not shared or authoritative multiplayer state.',
        'No autonomous steward applies a proposal.'
      ]
    };
    recalculateNeeds(state);
    Ecology.initialize(state);
    Goods.initialize(state);
    Economy.initialize(state);
    Society.initialize(state);
    return state;
  }

  function stateForHash(state) {
    var copy = clone(state);
    delete copy.receipts;
    delete copy.receiptHead;
    return copy;
  }

  function hashState(state) { return Canonical.sha256(Canonical.stableStringify(stateForHash(state))); }

  function appendReceipt(state, kind, detail) {
    state.receiptSequence += 1;
    var receipt = {
      schema: 'axm.living-world.receipt/v0.1',
      id: 'globe-receipt-' + String(state.receiptSequence).padStart(5, '0'),
      sequence: state.receiptSequence,
      logicalTurn: state.turn,
      worldRevision: state.revision,
      kind: kind,
      actor: clone(detail.actor || { id: 'local-human-steward', type: 'HUMAN' }),
      reason: String(detail.reason || 'Recorded world transition.'),
      changes: clone(detail.changes || []),
      resourceChanges: clone(detail.resourceChanges || []),
      warnings: clone(detail.warnings || []),
      limitations: clone(detail.limitations || []),
      proposalId: detail.proposalId || null,
      postStateHash: hashState(state),
      previousReceiptHash: state.receiptHead,
      currentReceiptHash: ''
    };
    receipt.currentReceiptHash = Canonical.sha256(Canonical.stableStringify(receipt));
    state.receipts.push(receipt);
    state.receiptHead = receipt.currentReceiptHash;
    return receipt;
  }

  function verifyReceipts(receipts) {
    var previous = null;
    var errors = [];
    (receipts || []).forEach(function (receipt, index) {
      if (receipt.sequence !== index + 1) errors.push('receipt sequence mismatch at ' + index);
      if (receipt.previousReceiptHash !== previous) errors.push('receipt link mismatch at ' + index);
      var copy = clone(receipt); var current = copy.currentReceiptHash; copy.currentReceiptHash = '';
      var expected = Canonical.sha256(Canonical.stableStringify(copy));
      if (current !== expected) errors.push('receipt hash mismatch at ' + index);
      previous = current;
    });
    return { ok: errors.length === 0, errors: errors, head: previous };
  }

  function recalculateNeeds(state) {
    state.districts.forEach(function (d) {
      var serviceCount = sum(Object.keys(d.services).map(function (key) { return d.services[key]; }));
      d.jobs = Math.max(0, Math.round(d.services.MARKET * 4 + d.services.FARM * 4 + d.services.WATER_WORKS * 3 + d.services.SOLAR_COOP * 3 + (d.zone === 'INDUSTRY' ? 9 : 2) + serviceCount));
      d.needs = {
        housingGap: Math.max(0, d.population - d.housingCapacity),
        jobsGap: Math.max(0, d.population - d.jobs),
        careGap: Math.max(0, Math.ceil(d.population / 18) - d.services.CLINIC),
        educationGap: Math.max(0, Math.ceil(d.population / 22) - d.services.SCHOOL),
        waterGap: Math.max(0, 70 - d.people.waterAccess),
        foodGap: Math.max(0, 70 - d.people.foodAccess),
        ecologicalPressure: round(d.ecology.pollution + d.soil.erosion + Math.max(0, 55 - d.ecology.biodiversity), 2)
      };
    });
  }

  function validateState(state) {
    var errors = [];
    if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, errors: ['state must be an object'] };
    if (state.schema !== STATE_SCHEMA) errors.push('unsupported strategic state schema');
    if (state.version !== VERSION) errors.push('unsupported strategic state version');
    if (state.worldId !== WORLD_ID) errors.push('world ID mismatch');
    if (!Number.isInteger(state.turn) || state.turn < 0) errors.push('turn must be a non-negative integer');
    if (!Number.isInteger(state.revision) || state.revision < 0) errors.push('revision must be a non-negative integer');
    if (!Array.isArray(state.districts) || state.districts.length !== 6) errors.push('six strategic districts required');
    if (!Array.isArray(state.roads) || !Array.isArray(state.proposals) || !Array.isArray(state.receipts)) errors.push('roads, proposals and receipts arrays required');
    if (!state.boundaries || state.boundaries.stateOwner !== 'living-world' || state.boundaries.gamesMayOwnWorld !== false) errors.push('living-world ownership boundary required');
    if (!state.boundaries || state.boundaries.privateRevenueSeparateFromTreasury !== true || state.boundaries.physicalInventoryNotDoubleCharged !== true || state.boundaries.pricesHaveVisibleCauses !== true || state.boundaries.typedGoodsConserved !== true || state.boundaries.privateEnterprisesMayEmergeOnlyOnExplicitQuarter !== true || state.boundaries.externalTypedTradeConnected !== false) errors.push('causal economy accounting boundaries required');
    RESOURCE_ORDER.forEach(function (name) {
      var item = state.resources && state.resources[name];
      if (!item || !Number.isFinite(item.stock) || item.stock < 0 || item.stock > item.capacity) errors.push('invalid resource ' + name);
    });
    var receiptCheck = verifyReceipts(state.receipts || []);
    if (!receiptCheck.ok) errors = errors.concat(receiptCheck.errors);
    if (receiptCheck.head !== state.receiptHead) errors.push('receipt head mismatch');
    var ecologyCheck = Ecology.validate(state);
    var societyCheck = Society.validate(state);
    var economyCheck = Economy.validate(state);
    var goodsCheck = Goods.validate(state);
    if (!ecologyCheck.ok) errors = errors.concat(ecologyCheck.errors);
    if (!societyCheck.ok) errors = errors.concat(societyCheck.errors);
    if (!economyCheck.ok) errors = errors.concat(economyCheck.errors);
    if (!goodsCheck.ok) errors = errors.concat(goodsCheck.errors);
    if (Canonical.findUnsafeKey(state)) errors.push('unsafe key refused');
    Canonical.validateFinite(state, '$', errors);
    return { ok: errors.length === 0, errors: errors };
  }

  function migrateState(input) {
    var state = clone(input);
    if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
    if (state.version === VERSION && state.schema === STATE_SCHEMA) return state;
    var fromV4 = state.version === '0.4.0' && state.schema === LEGACY_V4_STATE_SCHEMA;
    var fromV3 = state.version === '0.3.0' && state.schema === LEGACY_V3_STATE_SCHEMA;
    var fromV2 = state.version === '0.2.0' && state.schema === LEGACY_V2_STATE_SCHEMA;
    var fromV1 = state.version === '0.1.0' && state.schema === LEGACY_STATE_SCHEMA;
    if (!fromV4 && !fromV3 && !fromV2 && !fromV1) return state;
    var beforeSchema = state.schema;
    state.schema = STATE_SCHEMA;
    state.version = VERSION;
    state.boundaries = state.boundaries || {};
    state.boundaries.noAutomaticDilemmaResolution = true;
    state.boundaries.oneDilemmaAtATime = true;
    state.boundaries.politicalHumorIsFiction = true;
    state.boundaries.privateRevenueSeparateFromTreasury = true;
    state.boundaries.physicalInventoryNotDoubleCharged = true;
    state.boundaries.pricesHaveVisibleCauses = true;
    state.boundaries.typedGoodsConserved = true;
    state.boundaries.privateEnterprisesMayEmergeOnlyOnExplicitQuarter = true;
    state.boundaries.externalTypedTradeConnected = false;
    state.limitations = Array.isArray(state.limitations) ? state.limitations : [];
    if (!fromV4) state.limitations.push('v0.4 typed deposits, goods, private enterprises, product prices and trade-ready lots are causal gameplay abstractions added by an explicit local migration.');
    state.limitations.push('v0.5 tropical species are functional guilds with habitat and food-web dependencies, not a reconstructed census.');
    if (state.climate && !state.climate.rainfallRegime) state.climate.rainfallRegime = state.climate.rainfallMm >= 130 ? 'WET' : state.climate.rainfallMm <= 75 ? 'DRY' : 'TRADE_WIND';
    recalculateNeeds(state);
    if (fromV1) {
      Ecology.initialize(state);
      Society.initialize(state);
    }
    if (!fromV4) {
      Goods.initialize(state);
      Economy.initialize(state);
    }
    var addedTropicalGuilds = Ecology.migrateTropicalWeb(state);
    Ecology.recalculate(state);
    addedTropicalGuilds.forEach(function (id) {
      var entry = state.inhabitants[id];
      entry.population = round(Math.min(entry.population, entry.capacity * 0.72), 2);
      entry.status = entry.population <= 0.05 ? 'LOCALLY_ABSENT' : entry.population < entry.capacity * 0.25 ? 'FRAGILE' : 'PRESENT';
    });
    Ecology.recalculate(state);
    state.revision += 1;
    appendReceipt(state, fromV4 ? 'STRATEGIC_V0_5_TROPICAL_WEB_MIGRATION' : 'STRATEGIC_V0_5_TROPICAL_SUPPLY_MIGRATION', {
      actor: { id: 'living-world-local-migrator', type: 'SYSTEM' },
      reason: fromV4 ? 'Explicitly migrated a local strategic save to the v0.5 tropical food-web schema.' : 'Explicitly migrated a local strategic save to the v0.5 typed supply, causal economy and tropical food-web schema.',
      changes: (fromV4 ? [] : [
        { type: 'SCHEMA_MIGRATED', before: beforeSchema, after: STATE_SCHEMA },
        { type: 'TYPED_ISLAND_SUPPLY_INITIALIZED' },
        { type: 'CAUSAL_ISLAND_ECONOMY_V0_4_INITIALIZED' }
      ]).concat(fromV4 ? [{ type: 'SCHEMA_MIGRATED', before: beforeSchema, after: STATE_SCHEMA }] : []).concat([
        { type: 'TROPICAL_FOOD_WEB_INITIALIZED', guilds: addedTropicalGuilds }
      ]),
      warnings: ['Pending proposals keep their original target revision and therefore become stale for safety.'],
      limitations: [(fromV4 ? 'Migration catalogs bounded baseline guilds from the current habitat state; it does not invent sightings or reconstruct an unobserved ecological history.' : 'Migration initializes typed supply and bounded tropical guild baselines from visible seed/district state; it does not reconstruct unobserved commercial or ecological history.')]
    });
    return state;
  }

  function normalObservation(input) {
    var source = input || {};
    function integer(name) { return source[name] == null ? null : Math.max(0, Math.floor(Number(source[name]) || 0)); }
    return {
      treeCount: integer('treeCount'), fishAlive: integer('fishAlive'), reedCount: integer('reedCount'),
      hareCount: integer('hareCount'), foxCount: integer('foxCount'), fireCount: integer('fireCount'),
      wood: integer('wood'), observedAtWorldAge: source.observedAtWorldAge == null ? null : round(Math.max(0, Number(source.observedAtWorldAge) || 0), 2)
    };
  }

  function observationSignature(observation) {
    var copy = clone(observation); delete copy.observedAtWorldAge;
    return Canonical.stableStringify(copy);
  }

  function operationEstimate(state, operation) { return Economy.estimateConstruction(state, operation); }

  function addCosts(target, cost) {
    Object.keys(cost).forEach(function (name) { target[name] = round((target[name] || 0) + Number(cost[name]), 3); });
    return target;
  }

  function inspectOperations(state, operations) {
    var errors = [], costs = {}, risks = [], unknowns = [], effects = [], economicBreakdowns = [];
    if (!Array.isArray(operations) || !operations.length) errors.push('one or more requested operations required');
    (operations || []).forEach(function (operation, index) {
      if (!operation || OPERATIONS.indexOf(operation.type) < 0) { errors.push('unsupported operation at index ' + index); return; }
      if (Canonical.findUnsafeKey(operation)) { errors.push('unsafe operation key at index ' + index); return; }
      var payload = operation.payload || {};
      var target = byId(state.districts, payload.districtId);
      if (operation.type === 'PROPOSE_DISTRICT') {
        if (!target) errors.push('district proposal requires a known districtId');
        if (ZONES.indexOf(payload.zone) < 0) errors.push('district proposal requires a supported zone');
        if (target && target.zone === payload.zone) errors.push(target.name + ' already has zone ' + payload.zone);
        effects.push('Change broad direction in ' + (target ? target.name : payload.districtId) + ' to ' + payload.zone + '.');
        risks.push('A zone direction changes incentives; it does not guarantee a building or outcome.');
      } else if (operation.type === 'PROPOSE_ROAD') {
        var from = byId(state.districts, payload.fromDistrictId), to = byId(state.districts, payload.toDistrictId);
        if (!from || !to || from.id === to.id) errors.push('road requires two different known districts');
        if (from && to && state.roads.some(function (road) { return (road.fromDistrictId === from.id && road.toDistrictId === to.id) || (road.fromDistrictId === to.id && road.toDistrictId === from.id); })) errors.push('districts already have a direct road');
        effects.push('Add a maintained access link between ' + (from ? from.name : '?') + ' and ' + (to ? to.name : '?') + '.');
        risks.push('Road construction fragments habitat and creates ongoing maintenance demand.');
      } else if (operation.type === 'PROPOSE_SERVICE') {
        if (!target) errors.push('service proposal requires a known districtId');
        if (SERVICES.indexOf(payload.service) < 0) errors.push('unsupported service');
        effects.push('Add one ' + payload.service + ' service in ' + (target ? target.name : payload.districtId) + '.');
        if (payload.service === 'HOUSING') risks.push('New housing increases future water, food, energy and service demand.');
        if (payload.service === 'FARM') risks.push('Food production consumes water and can exhaust soil without ecological recovery.');
      } else if (operation.type === 'PROPOSE_ECO_BUFFER') {
        if (!target) errors.push('eco buffer requires a known districtId');
        if (target && target.ecology.protectedBuffer) errors.push(target.name + ' already has an ecological buffer');
        effects.push('Establish a protected ecological buffer in ' + (target ? target.name : payload.districtId) + '.');
        risks.push('Protection limits some later development options and uses civic attention.');
      }
      var estimate = operationEstimate(state, operation);
      if (!estimate.ok) errors = errors.concat(estimate.errors || ['economic estimate unavailable']);
      else {
        if (estimate.goodsSignals && !estimate.goodsSignals.affordable) errors.push('specific construction inputs unavailable: ' + estimate.goodsSignals.missing.join(', '));
        addCosts(costs, estimate.costs);
        economicBreakdowns.push({ operationIndex: index, operationType: operation.type, label: estimate.label, costs: estimate.costs, goodsBill: estimate.goodsBill, goodsSignals: estimate.goodsSignals, breakdown: estimate.breakdown, why: estimate.why, assumptions: estimate.assumptions });
      }
    });
    Object.keys(costs).forEach(function (name) {
      if (!state.resources[name] || state.resources[name].stock < costs[name]) errors.push('insufficient ' + name + ' for proposal');
    });
    unknowns.push('Human playtesting has not established balance or fun.');
    unknowns.push('Strategic districts approximate locations on the walkable sphere; they are not surveyed parcels.');
    return { ok: errors.length === 0, errors: errors, costs: costs, economicBreakdowns: economicBreakdowns, risks: risks.filter(function (v, i, a) { return a.indexOf(v) === i; }), unknowns: unknowns, effects: effects };
  }

  function Engine(seedOrState) {
    this.state = seedOrState && typeof seedOrState === 'object' ? migrateState(seedOrState) : createInitialState(seedOrState);
    var check = validateState(this.state);
    if (!check.ok) throw new Error('Invalid living state: ' + check.errors.join('; '));
  }

  Engine.prototype.observeState = function () { return clone(this.state); };
  Engine.prototype.exportState = function () { return clone(this.state); };
  Engine.prototype.validate = function () { return validateState(this.state); };
  Engine.prototype.importState = function (state) {
    var migrated = migrateState(state);
    var check = validateState(migrated);
    if (!check.ok) return { ok: false, errors: check.errors, state: this.observeState() };
    this.state = migrated;
    return { ok: true, errors: [], state: this.observeState() };
  };

  Engine.prototype.syncNativeObservation = function (input, context) {
    var next = normalObservation(input);
    var beforeSignature = observationSignature(this.state.nativeObservation);
    var changed = beforeSignature !== observationSignature(next);
    if (!changed) {
      this.state.nativeObservation.observedAtWorldAge = next.observedAtWorldAge;
      return { ok: true, changed: false, revision: this.state.revision, state: this.observeState() };
    }
    var draft = clone(this.state);
    var previous = draft.nativeObservation;
    var previousInhabitants = clone(draft.inhabitants);
    draft.nativeObservation = next;
    Ecology.reconcileNative(draft, next);
    draft.revision += 1;
    appendReceipt(draft, 'NATIVE_WORLD_OBSERVED', {
      actor: context && context.actor || { id: 'living-globe-runtime', type: 'WORLD' },
      reason: 'Reconciled visible walkable-world counts with the strategic seam.',
      changes: [
        { type: 'NATIVE_OBSERVATION_CHANGED', before: previous, after: next },
        { type: 'DECLARED_SPECIES_SEAM_RECONCILED', before: previousInhabitants, after: draft.inhabitants }
      ],
      limitations: ['Observation counts do not claim full ecological equivalence with the strategic model.']
    });
    this.state = draft;
    return { ok: true, changed: true, revision: draft.revision, state: this.observeState() };
  };

  function weatherFor(draft) {
    var season = SEASONS[draft.turn % 4];
    var baseTemp = { SPRING: 26, SUMMER: 28.5, AUTUMN: 27, WINTER: 24.5 }[season];
    var baseRain = { SPRING: 118, SUMMER: 165, AUTUMN: 132, WINTER: 62 }[season];
    var temp = round(baseTemp + (draw(draft) - 0.5) * 4.5, 1);
    var rainfall = round(clamp(baseRain + (draw(draft) - 0.5) * 90, 25, 210), 1);
    var drought = round(clamp((78 - rainfall) / 105 + Math.max(0, temp - 29) / 20, 0, 1), 3);
    var storm = round(clamp((rainfall - 112) / 145 + draw(draft) * 0.22, 0.02, 0.8), 3);
    var rainfallRegime = rainfall >= 130 ? 'WET' : rainfall <= 75 ? 'DRY' : 'TRADE_WIND';
    return { season: season, temperatureC: temp, rainfallMm: rainfall, rainfallRegime: rainfallRegime, droughtIndex: drought, stormRisk: storm, note: 'Seeded warm-island wet/dry weather; not a scientific forecast.' };
  }

  function resourceDelta(draft, name, produced, consumed, producedRecord, consumedRecord, shortages) {
    var item = draft.resources[name];
    var before = item.stock;
    var actualProduced = Math.min(Math.max(0, item.capacity - before), produced);
    var available = before + actualProduced;
    var actualConsumed = Math.min(available, consumed);
    item.stock = round(available - actualConsumed, 3);
    producedRecord[name] = round(actualProduced, 3);
    consumedRecord[name] = round(actualConsumed, 3);
    if (actualConsumed + 0.0001 < consumed) shortages.push({ resource: name, required: round(consumed, 3), supplied: round(actualConsumed, 3), gap: round(consumed - actualConsumed, 3) });
    return { before: before, after: item.stock };
  }

  Engine.prototype.advanceQuarter = function (input) {
    var options = input || {};
    if (!Number.isInteger(options.expectedRevision) || options.expectedRevision !== this.state.revision) return { ok: false, code: 'STALE_REVISION', errors: ['expectedRevision must match the current world revision'], state: this.observeState() };
    if (!safeReason(options.reason)) return { ok: false, code: 'REASON_REQUIRED', errors: ['a visible reason of at least four characters is required'], state: this.observeState() };
    var draft = clone(this.state);
    var beforeResources = clone(draft.resources);
    draft.turn += 1;
    draft.revision += 1;
    var climate = weatherFor(draft);
    draft.calendar.quarter = (draft.turn % 4) + 1;
    draft.calendar.year = Math.floor(draft.turn / 4) + 1;
    draft.calendar.season = climate.season;
    draft.climate = climate;
    var societyModifiers = Society.modifiers(draft);
    Ecology.recalculate(draft);

    var totalPopulation = sum(draft.districts.map(function (d) { return d.population; }));
    var farms = sum(draft.districts.map(function (d) { return d.services.FARM; }));
    var waterWorks = sum(draft.districts.map(function (d) { return d.services.WATER_WORKS; }));
    var solar = sum(draft.districts.map(function (d) { return d.services.SOLAR_COOP; }));
    var industrial = draft.districts.filter(function (d) { return d.zone === 'INDUSTRY'; }).length;
    var serviceCount = sum(draft.districts.map(function (d) { return sum(Object.keys(d.services).map(function (key) { return d.services[key]; })); }));
    var roadCount = draft.roads.length;
    var meanFertility = average(draft.districts.map(function (d) { return d.soil.fertility; }));
    var meanMoisture = average(draft.districts.map(function (d) { return d.soil.moisture; }));

    var produced = {}, consumed = {}, shortages = [], resourceChanges = [];
    var foodProduction = (7 + farms * 11 * meanFertility * clamp(meanMoisture + 0.35, 0.35, 1.2)) * Ecology.foodMultiplier(draft);
    var waterProduction = climate.rainfallMm * 0.42 + waterWorks * 13;
    var energyProduction = 9 + solar * (climate.season === 'SUMMER' ? 12 : climate.season === 'WINTER' ? 6 : 9) + industrial * 3;
    var materialProduction = industrial * 5;
    var attentionProduction = 3 + societyModifiers.attentionProduction;
    var demands = {
      food: totalPopulation * 0.31,
      water: totalPopulation * 0.43 + farms * 4,
      energy: totalPopulation * 0.19 + serviceCount * 1.2 + roadCount * 0.5,
      materials: roadCount * 0.15,
      attention: 1 + Math.max(0, serviceCount - 12) * 0.08
    };
    var productions = { food: foodProduction, water: waterProduction, energy: energyProduction, materials: materialProduction, attention: attentionProduction };
    ['water', 'food', 'energy', 'materials', 'attention'].forEach(function (name) { productions[name] = (productions[name] || 0) * societyModifiers.resourceMultipliers[name]; });
    ['water', 'food', 'energy', 'materials', 'attention'].forEach(function (name) {
      var delta = resourceDelta(draft, name, productions[name] || 0, demands[name] || 0, produced, consumed, shortages);
      resourceChanges.push({ resource: name, before: delta.before, after: delta.after, produced: produced[name], consumed: consumed[name] });
    });
    var foodShort = shortages.filter(function (s) { return s.resource === 'food'; })[0];
    var waterShort = shortages.filter(function (s) { return s.resource === 'water'; })[0];
    var energyShort = shortages.filter(function (s) { return s.resource === 'energy'; })[0];

    var populationChanges = [];
    draft.districts.forEach(function (d) {
      var rainFactor = climate.rainfallMm / 90;
      var waterBonus = d.waterAdjacency ? 0.1 : 0;
      var farmDraw = d.services.FARM * 0.07;
      d.soil.moisture = round(clamp(d.soil.moisture * 0.62 + rainFactor * 0.28 + waterBonus + d.services.WATER_WORKS * 0.04 - farmDraw - climate.droughtIndex * 0.18, 0.05, 1), 3);
      var protectedRecovery = (d.ecology.protectedBuffer || d.zone === 'NATURE' ? 0.025 : 0) + societyModifiers.habitatRecovery * 0.0015;
      var industryPressure = d.zone === 'INDUSTRY' ? 0.028 : 0;
      var farmPressure = d.services.FARM * 0.012;
      d.soil.fertility = round(clamp(d.soil.fertility + protectedRecovery * 0.45 - farmPressure - d.soil.erosion * 0.0008, 0.1, 1), 3);
      d.soil.erosion = round(clamp(d.soil.erosion + climate.stormRisk * (d.elevation > 0.5 ? 2.2 : 0.8) - protectedRecovery * 8, 0, 100), 3);
      d.ecology.pollution = round(clamp(d.ecology.pollution + industryPressure * 100 + d.population * 0.012 + societyModifiers.pollutionBonus - protectedRecovery * 10, 0, 100), 3);
      d.ecology.vegetation = round(clamp(d.ecology.vegetation + (d.soil.moisture - 0.45) * 4 + protectedRecovery * 10 - industryPressure * 12, 0, 100), 3);
      d.ecology.biodiversity = round(clamp(d.ecology.biodiversity + protectedRecovery * 8 + (d.ecology.vegetation - 50) * 0.012 - d.ecology.pollution * 0.008 - roadCount * 0.04, 0, 100), 3);
      var waterAccessTarget = waterShort ? 42 : 68 + d.services.WATER_WORKS * 18 + (d.waterAdjacency ? 7 : 0);
      var foodAccessTarget = foodShort ? 45 : 67 + d.services.MARKET * 9 + d.services.FARM * 5;
      d.people.waterAccess = round(clamp(d.people.waterAccess * 0.7 + waterAccessTarget * 0.3, 0, 100), 2);
      d.people.foodAccess = round(clamp(d.people.foodAccess * 0.7 + foodAccessTarget * 0.3, 0, 100), 2);
      var healthTarget = 52 + d.services.CLINIC * 16 + d.people.waterAccess * 0.16 + d.people.foodAccess * 0.12 + societyModifiers.healthBonus - d.ecology.pollution * 0.18 - (energyShort ? 8 : 0);
      d.people.health = round(clamp(d.people.health * 0.75 + healthTarget * 0.25, 0, 100), 2);
      var educationTarget = 42 + d.services.SCHOOL * 24 + d.services.CLINIC * 2;
      d.people.education = round(clamp(d.people.education * 0.8 + educationTarget * 0.2, 0, 100), 2);
      var beforePop = d.population;
      var severeShortage = !!foodShort || !!waterShort;
      if (severeShortage) d.population = Math.max(0, d.population - Math.max(1, Math.ceil(d.population * 0.025)));
      else if (d.population < d.housingCapacity && d.people.health >= 58 && (d.services.MARKET || d.services.WATER_WORKS || d.waterAdjacency)) d.population += 1;
      if (d.population !== beforePop) populationChanges.push({ districtId: d.id, before: beforePop, after: d.population, cause: severeShortage ? 'resource shortage' : 'available housing and services' });
      d.history.push({ turn: draft.turn, season: climate.season, population: d.population, moisture: d.soil.moisture, fertility: d.soil.fertility, biodiversity: d.ecology.biodiversity, pollution: d.ecology.pollution });
      if (d.history.length > 20) d.history.shift();
    });
    recalculateNeeds(draft);
    if (societyModifiers.pollinatorBoost && draft.inhabitants.pollinators) {
      draft.inhabitants.pollinators.population = round(clamp(draft.inhabitants.pollinators.population + draft.inhabitants.pollinators.capacity * societyModifiers.pollinatorBoost, 0, draft.inhabitants.pollinators.capacity * 1.1), 2);
    }
    if ((societyModifiers.invasiveBoost || societyModifiers.invasiveControl) && draft.inhabitants.invasivePredators) {
      var invasiveEntry = draft.inhabitants.invasivePredators;
      invasiveEntry.population = round(clamp(invasiveEntry.population + invasiveEntry.capacity * (societyModifiers.invasiveBoost - societyModifiers.invasiveControl), 0, invasiveEntry.capacity * 1.1), 2);
    }
    var ecologyResult = Ecology.advance(draft, { draw: function () { return draw(draft); } });
    var projectedVisitors = draft.districts.filter(function (district) { return district.zone === 'ENTERTAINMENT'; }).length * 4 + draft.roads.length * 0.5;
    var goodsResult = Goods.advance(draft, { energyFactor: energyShort ? 0.45 : 1, waterFactor: waterShort ? 0.55 : 1, visitors: projectedVisitors });
    var economyResult = Economy.advance(draft, { produced: produced, productionPotential: productions, consumed: consumed, shortages: shortages, fundsMultiplier: societyModifiers.resourceMultipliers.funds, goods: goodsResult });
    var materialChange = resourceChanges.filter(function (change) { return change.resource === 'materials'; })[0];
    consumed.materials = round((consumed.materials || 0) + economyResult.materialExports, 3);
    if (materialChange) {
      materialChange.after = draft.resources.materials.stock;
      materialChange.consumed = consumed.materials;
      materialChange.exported = economyResult.materialExports;
    }
    var fundsDelta = resourceDelta(draft, 'funds', economyResult.fundsProduced, economyResult.fundsConsumed, produced, consumed, shortages);
    resourceChanges.push({ resource: 'funds', before: fundsDelta.before, after: fundsDelta.after, produced: produced.funds, consumed: consumed.funds, incomeComponents: clone(draft.economy.treasury.income), expenseComponents: clone(draft.economy.treasury.expenses) });
    Economy.closeTreasury(draft, draft.resources.funds.stock, consumed.funds, produced.funds);
    draft.flows = {
      produced: produced,
      consumed: consumed,
      shortages: shortages,
      explanation: [
        'Rainfall, stored water and water works supplied this quarter.',
        'Food followed farms, soil fertility, moisture, pollination and natural pest control; consumption followed population.',
        'Energy and materials followed local production; exports removed only material stock above the protected reserve.',
        'Treasury funds came only from named taxes, duties and public shares; private wages and sales stayed outside the treasury.',
        'Typed products were conserved through extraction, recipes, shops and civic procurement; empty shelves became visible shortages.',
        'At most one private enterprise could emerge inside a compatible zone after supply, demand, access, labor, ecology and startup inputs were scored.',
        'Typed surplus lots were marked ready for a later trade route but were not exported without a connected trade system.',
        'Services, public payroll, roads and habitat protection created visible operating expenses.',
        'Active edicts modified only their declared production, health, pollution, habitat or fiscal rules.',
        'No public building, dilemma choice or strategic turn was created automatically; private enterprise emergence occurred only inside this explicitly advanced quarter.'
      ]
    };
    var societyResult = Society.advance(draft);
    var receipt = appendReceipt(draft, 'STRATEGIC_QUARTER', {
      actor: options.actor,
      reason: options.reason,
      changes: [{ type: 'WEATHER', climate: climate }, { type: 'ECONOMY_QUARTER', cpi: draft.economy.consumerPriceIndex, goodsPriceIndex: draft.supply.priceIndex, treasuryNet: draft.economy.treasury.net, privateSales: goodsResult.privateSales, privateProfit: goodsResult.privateProfit, industryContribution: draft.economy.sectors.industry.treasuryContribution, entertainmentContribution: draft.economy.sectors.entertainment.treasuryContribution, materialExports: economyResult.materialExports, typedTradeReadyLots: draft.supply.tradeReadiness.lots.length, visitors: economyResult.visitors }].concat(populationChanges, ecologyResult.changes, goodsResult.changes, societyResult.changes, societyResult.factionChanges),
      resourceChanges: resourceChanges,
      warnings: shortages.map(function (s) { return s.resource + ' shortage of ' + s.gap; }).concat(ecologyResult.warnings, goodsResult.warnings, economyResult.warnings, societyResult.warnings),
      limitations: [
        'Quarter results are deterministic gameplay rules, not policy or scientific predictions.',
        'Political characters, factions and headlines are fictional satire; no real population is being modeled.',
        'The economy is a causal game model, not a financial forecast.',
        'An open dilemma is never resolved automatically.'
      ]
    });
    this.state = draft;
    return { ok: true, state: this.observeState(), receipt: clone(receipt), ecology: clone(ecologyResult), goods: clone(goodsResult), economy: clone(economyResult), society: clone(societyResult), errors: [] };
  };

  Engine.prototype.previewEdict = function (id) { return clone(Society.previewEdict(this.state, id)); };

  Engine.prototype.issueEdict = function (input) {
    var options = input || {};
    if (!Number.isInteger(options.expectedRevision) || options.expectedRevision !== this.state.revision) return { ok: false, code: 'STALE_REVISION', errors: ['expectedRevision must match the current world revision'], state: this.observeState() };
    if (!safeReason(options.reason)) return { ok: false, code: 'REASON_REQUIRED', errors: ['a visible reason of at least four characters is required'], state: this.observeState() };
    var draft = clone(this.state);
    var issued = Society.issueEdict(draft, options.id);
    if (!issued.ok) return { ok: false, errors: clone(issued.errors || ['edict could not be issued']), state: this.observeState() };
    Ecology.recalculate(draft);
    Economy.recalculatePrices(draft);
    Economy.recalculateLabor(draft);
    Society.updateRequests(draft);
    draft.revision += 1;
    var receipt = appendReceipt(draft, 'EDICT_ISSUED', {
      actor: options.actor || { id: 'local-human-steward', type: 'HUMAN' },
      reason: options.reason,
      changes: issued.changes.concat(issued.factionChanges),
      resourceChanges: issued.resourceChanges,
      warnings: issued.warnings,
      limitations: ['Edicts are fictional, visible, time-bounded gameplay modifiers.']
    });
    this.state = draft;
    return { ok: true, issued: clone(issued), receipt: clone(receipt), state: this.observeState(), errors: [] };
  };

  Engine.prototype.resolveDilemma = function (input) {
    var options = input || {};
    if (!Number.isInteger(options.expectedRevision) || options.expectedRevision !== this.state.revision) return { ok: false, code: 'STALE_REVISION', errors: ['expectedRevision must match the current world revision'], state: this.observeState() };
    if (!safeReason(options.reason)) return { ok: false, code: 'REASON_REQUIRED', errors: ['a visible reason of at least four characters is required'], state: this.observeState() };
    var draft = clone(this.state);
    var resolved = Society.resolveDilemma(draft, options.dilemmaId, options.choiceId);
    if (!resolved.ok) return { ok: false, errors: clone(resolved.errors || ['dilemma could not be resolved']), state: this.observeState() };
    recalculateNeeds(draft);
    Ecology.recalculate(draft);
    Economy.recalculatePrices(draft);
    Economy.recalculateLabor(draft);
    Society.updateRequests(draft);
    draft.revision += 1;
    var receipt = appendReceipt(draft, 'DILEMMA_RESOLVED', {
      actor: options.actor || { id: 'local-human-steward', type: 'HUMAN' },
      reason: options.reason,
      changes: resolved.changes.concat(resolved.factionChanges),
      resourceChanges: resolved.resourceChanges,
      warnings: resolved.warnings,
      limitations: ['The dilemma choice was explicit and human-triggered; no choice was inferred or automated.']
    });
    this.state = draft;
    return { ok: true, resolved: clone(resolved), receipt: clone(receipt), state: this.observeState(), errors: [] };
  };

  Engine.prototype.estimateOperations = function (operations) { return clone(inspectOperations(this.state, operations)); };

  Engine.prototype.submitCityPatchProposal = function (input, context) {
    var errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, applied: false, errors: ['proposal input must be an object'], state: this.observeState() };
    if (input.schema && input.schema !== PROPOSAL_SCHEMA) errors.push('unsupported proposal schema');
    if (input.targetWorldId !== this.state.worldId) errors.push('target world ID mismatch');
    if (!Number.isInteger(input.targetRevision) || input.targetRevision !== this.state.revision) errors.push('stale target revision refused');
    if (Canonical.findUnsafeKey(input)) errors.push('unsafe proposal key refused');
    var inspected = inspectOperations(this.state, input.requestedOperations);
    errors = errors.concat(inspected.errors);
    if (errors.length) return { ok: false, applied: false, errors: errors, state: this.observeState() };
    var id = String(input.id || 'city-patch-' + Canonical.sha256(Canonical.stableStringify(input)).slice(0, 16));
    if (byId(this.state.proposals, id)) return { ok: false, applied: false, errors: ['duplicate proposal ID refused'], state: this.observeState() };
    var draft = clone(this.state);
    var proposal = {
      schema: PROPOSAL_SCHEMA,
      id: id,
      status: 'PROPOSAL_ONLY',
      targetWorldId: draft.worldId,
      targetRevision: input.targetRevision,
      preconditions: clone(input.preconditions || [{ field: 'revision', equals: input.targetRevision }]),
      requestedOperations: clone(input.requestedOperations),
      causeCostTrace: clone(input.causeCostTrace || { source: 'local-steward-console', costs: inspected.costs }),
      estimatedCosts: inspected.costs,
      economicBreakdowns: inspected.economicBreakdowns,
      expectedEffects: inspected.effects,
      reversibilityStatement: String(input.reversibilityStatement || 'Before apply, discard freely. After apply, undo is available only while this remains the latest world revision.'),
      risks: clone((input.risks || []).concat(inspected.risks).filter(function (v, i, a) { return a.indexOf(v) === i; })),
      unknowns: clone((input.unknowns || []).concat(inspected.unknowns).filter(function (v, i, a) { return a.indexOf(v) === i; })),
      consentReference: input.consentReference || 'local-human-review-required',
      sourcePackageHash: input.packageHash || null,
      packageHash: '',
      liveHostMutation: false,
      hostApplicationPerformed: false,
      createdBy: clone(context && context.actor || { id: 'local-human-steward', type: 'HUMAN' }),
      review: null,
      approvalToken: null,
      appliedRevision: null,
      undo: null
    };
    proposal.packageHash = Canonical.sha256(Canonical.stableStringify(proposal));
    draft.proposals.push(proposal);
    var receipt = appendReceipt(draft, 'PROPOSAL_RECEIVED', {
      actor: proposal.createdBy,
      reason: 'Created a reviewable city patch proposal; no world state was applied.',
      proposalId: proposal.id,
      changes: [{ type: 'PROPOSAL_STORED_NOT_APPLIED', proposalId: proposal.id }]
    });
    this.state = draft;
    return { ok: true, proposal: clone(proposal), applied: false, receipt: clone(receipt), state: this.observeState() };
  };

  Engine.prototype.reviewProposal = function (input) {
    var options = input || {}, proposal = byId(this.state.proposals, options.proposalId);
    if (!proposal) return { ok: false, errors: ['proposal not found'], state: this.observeState() };
    if (proposal.status !== 'PROPOSAL_ONLY') return { ok: false, errors: ['proposal is not awaiting review'], state: this.observeState() };
    if (!Number.isInteger(options.expectedRevision) || options.expectedRevision !== this.state.revision || proposal.targetRevision !== this.state.revision) return { ok: false, code: 'STALE_REVISION', errors: ['proposal revision no longer matches the world'], state: this.observeState() };
    if (['APPROVE', 'REJECT'].indexOf(options.decision) < 0) return { ok: false, errors: ['decision must be APPROVE or REJECT'], state: this.observeState() };
    if (!safeReason(options.reason)) return { ok: false, errors: ['a visible review reason of at least four characters is required'], state: this.observeState() };
    var draft = clone(this.state), target = byId(draft.proposals, proposal.id);
    target.review = { decision: options.decision, reason: options.reason.trim(), actor: clone(options.actor || { id: 'local-human-steward', type: 'HUMAN' }), reviewedAtTurn: draft.turn, reviewedAtRevision: draft.revision };
    target.status = options.decision === 'APPROVE' ? 'APPROVED_NOT_APPLIED' : 'REJECTED';
    if (options.decision === 'APPROVE') target.approvalToken = Canonical.sha256(Canonical.stableStringify([target.id, target.targetRevision, target.review])).slice(0, 32);
    var receipt = appendReceipt(draft, options.decision === 'APPROVE' ? 'PROPOSAL_APPROVED_NOT_APPLIED' : 'PROPOSAL_REJECTED', {
      actor: target.review.actor,
      reason: target.review.reason,
      proposalId: target.id,
      changes: [{ type: target.status, proposalId: target.id }]
    });
    this.state = draft;
    return { ok: true, proposal: clone(target), applied: false, approvalToken: target.approvalToken, receipt: clone(receipt), state: this.observeState() };
  };

  function spend(resources, costs) {
    var changes = [];
    Object.keys(costs).forEach(function (name) {
      var before = resources[name].stock;
      resources[name].stock = round(before - costs[name], 3);
      changes.push({ resource: name, before: before, after: resources[name].stock, spent: costs[name] });
    });
    return changes;
  }

  function applyOperation(draft, operation, proposalId) {
    var payload = operation.payload || {}, target = byId(draft.districts, payload.districtId);
    if (operation.type === 'PROPOSE_DISTRICT') {
      var oldZone = target.zone; target.zone = payload.zone;
      return { type: 'DISTRICT_ZONE_CHANGED', districtId: target.id, before: oldZone, after: target.zone };
    }
    if (operation.type === 'PROPOSE_ROAD') {
      var road = { id: 'road-' + Canonical.sha256(proposalId + ':' + payload.fromDistrictId + ':' + payload.toDistrictId).slice(0, 12), fromDistrictId: payload.fromDistrictId, toDistrictId: payload.toDistrictId, condition: 100, createdByProposalId: proposalId };
      draft.roads.push(road);
      return { type: 'ROAD_BUILT', road: clone(road) };
    }
    if (operation.type === 'PROPOSE_SERVICE') {
      target.services[payload.service] += 1;
      if (payload.service === 'HOUSING') target.housingCapacity += 8;
      if (payload.service === 'WATER_WORKS') target.people.waterAccess = clamp(target.people.waterAccess + 12, 0, 100);
      if (payload.service === 'CLINIC') target.people.health = clamp(target.people.health + 5, 0, 100);
      if (payload.service === 'SCHOOL') target.people.education = clamp(target.people.education + 5, 0, 100);
      return { type: 'SERVICE_BUILT', districtId: target.id, service: payload.service, count: target.services[payload.service] };
    }
    target.ecology.protectedBuffer = true;
    target.ecology.biodiversity = round(clamp(target.ecology.biodiversity + 4, 0, 100), 3);
    target.soil.erosion = round(clamp(target.soil.erosion - 3, 0, 100), 3);
    return { type: 'ECO_BUFFER_ESTABLISHED', districtId: target.id };
  }

  Engine.prototype.applyApprovedProposal = function (input) {
    var options = input || {}, proposal = byId(this.state.proposals, options.proposalId);
    if (!proposal) return { ok: false, applied: false, errors: ['proposal not found'], state: this.observeState() };
    if (proposal.status !== 'APPROVED_NOT_APPLIED') return { ok: false, applied: false, errors: ['proposal is not approved for apply'], state: this.observeState() };
    if (options.approvalToken !== proposal.approvalToken) return { ok: false, applied: false, errors: ['approval token mismatch'], state: this.observeState() };
    if (proposal.targetRevision !== this.state.revision) return { ok: false, applied: false, code: 'STALE_REVISION', errors: ['approved proposal became stale before apply'], state: this.observeState() };
    if (!safeReason(options.reason)) return { ok: false, applied: false, errors: ['a visible apply reason of at least four characters is required'], state: this.observeState() };
    var inspected = inspectOperations(this.state, proposal.requestedOperations);
    if (!inspected.ok) return { ok: false, applied: false, errors: inspected.errors, state: this.observeState() };
    var draft = clone(this.state), target = byId(draft.proposals, proposal.id);
    target.undo = { resources: clone(draft.resources), districts: clone(draft.districts), roads: clone(draft.roads), supply: clone(draft.supply), economy: clone(draft.economy) };
    var resourceChanges = spend(draft.resources, inspected.costs);
    var typedTransactions = [];
    inspected.economicBreakdowns.forEach(function (entry) {
      var consumed = Goods.consumeConstruction(draft, entry.goodsBill || {}, 'proposal:' + target.id + ':operation:' + entry.operationIndex, 'APPROVED_CIVIC_CONSTRUCTION/v1');
      if (consumed.ok) typedTransactions = typedTransactions.concat(consumed.transactions);
    });
    resourceChanges = resourceChanges.concat(typedTransactions.map(function (transaction) { return { resource: 'goods:' + transaction.good, before: null, after: draft.supply.inventory[transaction.good].stock, consumed: transaction.quantity, transactionId: transaction.id, unit: transaction.unit }; }));
    var changes = target.requestedOperations.map(function (operation) { return applyOperation(draft, operation, target.id); });
    if (typedTransactions.length) changes.push({ type: 'TYPED_CONSTRUCTION_INPUTS_CONSUMED', proposalId: target.id, transactionIds: typedTransactions.map(function (transaction) { return transaction.id; }) });
    draft.revision += 1;
    recalculateNeeds(draft);
    Ecology.recalculate(draft);
    Economy.recalculatePrices(draft);
    Economy.recalculateLabor(draft);
    draft.economy.goodsMarket = Goods.summary(draft);
    Society.updateRequests(draft);
    target.status = 'APPLIED';
    target.hostApplicationPerformed = true;
    target.appliedRevision = draft.revision;
    var receipt = appendReceipt(draft, 'APPROVED_PROPOSAL_APPLIED', {
      actor: options.actor || { id: 'local-human-steward', type: 'HUMAN' },
      reason: options.reason,
      proposalId: target.id,
      changes: changes,
      resourceChanges: resourceChanges,
      warnings: target.risks,
      limitations: ['Apply affected only the local strategic living-state layer.', 'Typed commercial inputs were consumed only after separate approval and exact revalidation.']
    });
    this.state = draft;
    return { ok: true, applied: true, proposal: clone(target), receipt: clone(receipt), state: this.observeState() };
  };

  Engine.prototype.undoProposal = function (input) {
    var options = input || {}, proposal = byId(this.state.proposals, options.proposalId);
    if (!proposal) return { ok: false, errors: ['proposal not found'], state: this.observeState() };
    if (proposal.status !== 'APPLIED' || !proposal.undo) return { ok: false, errors: ['proposal has no available undo'], state: this.observeState() };
    if (this.state.revision !== proposal.appliedRevision) return { ok: false, errors: ['undo refused because later world changes exist'], state: this.observeState() };
    if (!safeReason(options.reason)) return { ok: false, errors: ['a visible undo reason of at least four characters is required'], state: this.observeState() };
    var draft = clone(this.state), target = byId(draft.proposals, proposal.id), undo = target.undo;
    draft.resources = clone(undo.resources); draft.districts = clone(undo.districts); draft.roads = clone(undo.roads); draft.supply = clone(undo.supply); draft.economy = clone(undo.economy);
    draft.revision += 1;
    target.status = 'UNDONE'; target.undo = null;
    recalculateNeeds(draft);
    Ecology.recalculate(draft);
    Economy.recalculatePrices(draft);
    Economy.recalculateLabor(draft);
    Society.updateRequests(draft);
    var receipt = appendReceipt(draft, 'APPLIED_PROPOSAL_UNDONE', {
      actor: options.actor || { id: 'local-human-steward', type: 'HUMAN' },
      reason: options.reason,
      proposalId: target.id,
      changes: [{ type: 'PROPOSAL_EFFECTS_REVERSED', proposalId: target.id }]
    });
    this.state = draft;
    return { ok: true, undone: true, proposal: clone(target), receipt: clone(receipt), state: this.observeState() };
  };

  Engine.prototype.hostSnapshots = function () {
    var state = this.state;
    function packet(kind, units, data, limitations, context) {
      return {
        schema: SNAPSHOT_SCHEMA,
        sourceWorldId: state.worldId,
        sourceRevision: state.revision,
        provenance: ['AXM Living Globe supplied hardcopy', 'local strategic state v' + VERSION, kind],
        units: units,
        uncertainty: ['Compact gameplay abstraction; untested balance.'],
        limitations: limitations,
        consentReference: 'local-human-review-required',
        context: clone(context || {}),
        data: clone(data)
      };
    }
    return {
      terrain: packet('terrain', { direction: 'unit vector', elevation: 'relative terrain units', ecology: '0-100 gameplay indices' }, state.districts.map(function (d) { return { id: d.id, name: d.name, direction: d.direction, elevation: d.elevation, waterAdjacency: d.waterAdjacency, soil: d.soil, ecology: d.ecology, habitat: d.habitat, zone: d.zone }; }), ['Districts approximate broad spherical regions, not surveyed parcels.', 'Habitat quality and connectivity are bounded gameplay indices, not field measurements.'], { habitats: state.habitats, ecologyDynamics: state.ecologyDynamics }),
      resources: packet('resources', RESOURCE_ORDER.reduce(function (out, name) { out[name] = state.resources[name].unit; return out; }, {}), { resources: state.resources, flows: state.flows, climate: state.climate, inhabitants: state.inhabitants, economy: state.economy, supply: state.supply }, ['Stocks, typed goods, prices, firms, deposits and flows are gameplay units, not real-world inventories or forecasts.', 'Private sector revenue and business capital are kept separate from treasury funds.', 'Typed surplus lots are trade-ready evidence only; external trade is not connected.', 'Inhabitant populations are abstract guild/count indices; visible hare and fox counts are declared legacy proxies.']),
      settlements: packet('settlements', { population: 'abstract residents', services: 'service sites', access: '0-100 gameplay indices', factionSupport: '0-100 gameplay index' }, state.districts.map(function (d) { return { id: d.id, name: d.name, population: d.population, housingCapacity: d.housingCapacity, jobs: d.jobs, services: d.services, people: d.people, needs: d.needs }; }), ['Population represents a tiny-world strategic layer, not people tracking.', 'Political characters, factions, elections and approval are fictional satire.'], { society: state.society, labor: state.economy.labor, sectors: state.economy.sectors })
    };
  };

  Engine.prototype.summary = function () {
    var state = this.state;
    return {
      worldId: state.worldId,
      revision: state.revision,
      turn: state.turn,
      calendar: clone(state.calendar),
      climate: clone(state.climate),
      population: sum(state.districts.map(function (d) { return d.population; })),
      resources: RESOURCE_ORDER.reduce(function (out, name) { out[name] = state.resources[name].stock; return out; }, {}),
      meanBiodiversity: round(average(state.districts.map(function (d) { return d.ecology.biodiversity; })), 2),
      meanSoilFertility: round(average(state.districts.map(function (d) { return d.soil.fertility; })) * 100, 2),
      waterQuality: state.ecologyDynamics.waterQuality,
      habitatConnectivity: state.ecologyDynamics.habitatConnectivity,
      invasivePressure: state.ecologyDynamics.invasivePressure,
      inhabitants: Ecology.SPECIES_ORDER.reduce(function (out, id) { out[id] = { population: state.inhabitants[id].population, capacity: state.inhabitants[id].capacity, trend: state.inhabitants[id].trend, status: state.inhabitants[id].status }; return out; }, {}),
      publicApproval: state.society.publicApproval,
      legitimacy: state.society.legitimacy,
      election: clone(state.society.election),
      factions: clone(state.society.factions),
      currentDilemma: clone(state.society.currentDilemma),
      headline: clone(state.society.headlines[state.society.headlines.length - 1] || null),
      economy: Economy.summary(state),
      supply: Goods.summary(state),
      roads: state.roads.length,
      pendingProposals: state.proposals.filter(function (p) { return p.status === 'PROPOSAL_ONLY' || p.status === 'APPROVED_NOT_APPLIED'; }).length,
      receiptHead: state.receiptHead,
      boundaries: clone(state.boundaries)
    };
  };

  return {
    VERSION: VERSION,
    STATE_SCHEMA: STATE_SCHEMA,
    LEGACY_V4_STATE_SCHEMA: LEGACY_V4_STATE_SCHEMA,
    LEGACY_V3_STATE_SCHEMA: LEGACY_V3_STATE_SCHEMA,
    LEGACY_V2_STATE_SCHEMA: LEGACY_V2_STATE_SCHEMA,
    LEGACY_STATE_SCHEMA: LEGACY_STATE_SCHEMA,
    PROPOSAL_SCHEMA: PROPOSAL_SCHEMA,
    SNAPSHOT_SCHEMA: SNAPSHOT_SCHEMA,
    WORLD_ID: WORLD_ID,
    OPERATIONS: OPERATIONS,
    ZONES: ZONES,
    SERVICES: SERVICES,
    RESOURCE_ORDER: RESOURCE_ORDER,
    PRICE_ORDER: Economy.PRICE_ORDER,
    SECTOR_ORDER: Economy.SECTOR_ORDER,
    GOOD_ORDER: Goods.GOOD_ORDER,
    EDICT_ORDER: Society.EDICT_ORDER,
    EDICTS: clone(Society.EDICTS),
    FACTION_ORDER: Society.FACTION_ORDER,
    HABITAT_ORDER: Ecology.HABITAT_ORDER,
    SPECIES_ORDER: Ecology.SPECIES_ORDER,
    createInitialState: createInitialState,
    migrateState: migrateState,
    validateState: validateState,
    verifyReceipts: verifyReceipts,
    inspectOperations: inspectOperations,
    Engine: Engine
  };
});
