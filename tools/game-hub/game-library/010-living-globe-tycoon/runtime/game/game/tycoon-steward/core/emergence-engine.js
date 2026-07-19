(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical,
    typeof module === 'object' && module.exports ? require('./deterministic-rng') : root.AXMTycoonRng,
    typeof module === 'object' && module.exports ? require('./resource-ledger') : root.AXMTycoonLedger,
    typeof module === 'object' && module.exports ? require('./needs-model') : root.AXMTycoonNeeds,
    typeof module === 'object' && module.exports ? require('./road-emergence') : root.AXMTycoonRoads,
    typeof module === 'object' && module.exports ? require('./consequence-model') : root.AXMTycoonConsequences,
    typeof module === 'object' && module.exports ? require('./supply-chain') : root.AXMTycoonSupply,
    typeof module === 'object' && module.exports ? require('./emergence-patterns') : root.AXMTycoonPatterns
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonEmergence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical, Rng, Ledger, Needs, Roads, Consequences, Supply, Patterns) {
  'use strict';

  var RULES = [
    { id: 'HOUSING_COTTAGES/v1', type: 'COTTAGE_CLUSTER', label: 'Cottage cluster', category: 'HOUSING', zones: ['HOUSING'], trigger: 'need-housing', costs: { population: 2, energy: 5, materials: 10, funds: 14, attention: 2 }, labor: 2, capacity: { residents: 8 }, operating: { energy: 1, funds: 1 }, terrain: ['MEADOW', 'CLAY'] },
    { id: 'HOUSING_COURTYARD/v1', type: 'COURTYARD_HOMES', label: 'Courtyard homes', category: 'HOUSING', zones: ['HOUSING'], trigger: 'need-housing', costs: { population: 3, energy: 7, materials: 14, funds: 18, attention: 2 }, labor: 3, capacity: { residents: 12 }, operating: { energy: 2, funds: 1 }, terrain: ['MEADOW', 'CLAY', 'RIDGE'] },
    { id: 'INDUSTRY_WORKSHOP/v1', type: 'WORKSHOP_YARD', label: 'Workshop yard', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-work', costs: { population: 1, energy: 8, materials: 12, funds: 16, attention: 2 }, labor: 3, capacity: { jobs: 7 }, operating: { energy: 3, funds: 1 }, terrain: ['CLAY', 'RIDGE'] },
    { id: 'INDUSTRY_REPAIR_COOP/v1', type: 'REPAIR_COOPERATIVE', label: 'Repair cooperative', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-repair', costs: { population: 1, energy: 6, materials: 9, funds: 15, attention: 3 }, labor: 3, capacity: { jobs: 5, service: 2 }, operating: { energy: 2, funds: 2 }, terrain: ['CLAY', 'MEADOW'] },
    { id: 'ENTERTAINMENT_GREEN/v1', type: 'FESTIVAL_GREEN', label: 'Festival green', category: 'ENTERTAINMENT', zones: ['ENTERTAINMENT'], trigger: 'need-leisure', costs: { population: 1, energy: 4, materials: 6, funds: 13, attention: 3 }, labor: 2, capacity: { leisure: 7 }, operating: { energy: 1, funds: 2 }, terrain: ['MEADOW', 'WOODLAND'] },
    { id: 'ENTERTAINMENT_HALL/v1', type: 'COMMON_HALL', label: 'Common hall', category: 'ENTERTAINMENT', zones: ['ENTERTAINMENT'], trigger: 'need-leisure', costs: { population: 1, energy: 6, materials: 10, funds: 15, attention: 2 }, labor: 2, capacity: { leisure: 8, service: 1 }, operating: { energy: 2, funds: 2 }, terrain: ['CLAY', 'RIDGE'] },
    { id: 'NATURE_POCKET_PARK/v1', type: 'POCKET_PARK', label: 'Pocket park', category: 'NATURE', zones: ['NATURE'], trigger: 'need-ecology', costs: { energy: 2, materials: 5, funds: 8, attention: 2 }, labor: 2, capacity: { leisure: 2 }, operating: { funds: 1 }, terrain: ['MEADOW', 'WOODLAND', 'CLAY'] },
    { id: 'NATURE_WETLAND_BUFFER/v1', type: 'WETLAND_BUFFER', label: 'Wetland buffer', category: 'NATURE', zones: ['NATURE'], trigger: 'need-ecology', costs: { energy: 2, materials: 6, funds: 9, attention: 3 }, labor: 2, capacity: {}, operating: { funds: 1 }, terrain: ['WETLAND'] },
    { id: 'INFRA_ENERGY_COOP/v1', type: 'ENERGY_COOP', label: 'Energy cooperative', category: 'INFRASTRUCTURE', zones: ['INFRASTRUCTURE'], trigger: 'need-energy', costs: { population: 1, energy: 4, materials: 14, funds: 20, attention: 3 }, labor: 4, capacity: { energy: 14, jobs: 2 }, operating: { funds: 2 }, terrain: ['RIDGE', 'MEADOW', 'CLAY'] },
    { id: 'INFRA_CIVIC_STOP/v1', type: 'CIVIC_STOP', label: 'Civic stop', category: 'INFRASTRUCTURE', zones: ['INFRASTRUCTURE'], trigger: 'need-access', costs: { energy: 3, materials: 8, funds: 12, attention: 2 }, labor: 2, capacity: { service: 2 }, operating: { energy: 1, funds: 1 }, terrain: ['MEADOW', 'CLAY', 'RIDGE'] },
    { id: 'NEUTRAL_MIXED_QUARTER/v1', type: 'MIXED_QUARTER', label: 'Mixed quarter', category: 'MIXED', zones: ['NEUTRAL'], trigger: 'need-work', costs: { population: 2, energy: 7, materials: 12, funds: 18, attention: 3 }, labor: 3, capacity: { residents: 5, jobs: 4, leisure: 1 }, operating: { energy: 2, funds: 2 }, terrain: ['MEADOW', 'CLAY', 'RIDGE'] },
    { id: 'NEUTRAL_SETTLEMENT/v1', type: 'SMALL_SETTLEMENT', label: 'Small settlement', category: 'HOUSING', zones: ['NEUTRAL'], trigger: 'need-housing', costs: { population: 2, energy: 6, materials: 9, funds: 13, attention: 2 }, labor: 2, capacity: { residents: 7, jobs: 1 }, operating: { energy: 2, funds: 1 }, terrain: ['MEADOW', 'CLAY'] },
    { id: 'NEUTRAL_TRADE_PATH/v1', type: 'TRADE_PATH', label: 'Trade path', category: 'INFRASTRUCTURE', zones: ['NEUTRAL'], trigger: 'need-access', costs: { energy: 2, materials: 7, funds: 11, attention: 2 }, labor: 2, capacity: { jobs: 2 }, operating: { funds: 1 }, terrain: ['MEADOW', 'CLAY', 'RIDGE'] },
    { id: 'NEUTRAL_PUBLIC_SERVICE/v1', type: 'PUBLIC_SERVICE', label: 'Neighbourhood service', category: 'SERVICE', zones: ['NEUTRAL'], trigger: 'need-services', costs: { population: 1, energy: 5, materials: 9, funds: 16, attention: 3 }, labor: 3, capacity: { service: 6, jobs: 3 }, operating: { energy: 2, funds: 3 }, terrain: ['MEADOW', 'CLAY', 'RIDGE'] },
    { id: 'NEUTRAL_ECO_BUFFER/v1', type: 'ECO_BUFFER', label: 'Ecological buffer', category: 'NATURE', zones: ['NEUTRAL'], trigger: 'need-ecology', costs: { energy: 2, materials: 5, funds: 8, attention: 3 }, labor: 2, capacity: {}, operating: { funds: 1 }, terrain: ['WETLAND', 'WOODLAND', 'MEADOW'] },
    { id: 'SUPPLY_TIMBER_CAMP/v1', type: 'TIMBER_CAMP', label: 'Timber camp', category: 'INDUSTRY', zones: ['INDUSTRY', 'NEUTRAL'], neutralEligible: true, trigger: 'need-work', costs: { population: 1, energy: 4, materials: 6, funds: 10, attention: 2 }, labor: 3, capacity: { jobs: 4 }, operating: { energy: 1, funds: 1 }, terrain: ['WOODLAND'] },
    { id: 'SUPPLY_CLAY_PIT/v1', type: 'CLAY_PIT', label: 'Clay pit', category: 'INDUSTRY', zones: ['INDUSTRY', 'NEUTRAL'], neutralEligible: true, trigger: 'need-work', costs: { population: 1, energy: 5, materials: 6, funds: 11, attention: 2 }, labor: 3, capacity: { jobs: 4 }, operating: { energy: 1, funds: 1 }, terrain: ['CLAY', 'WETLAND'] },
    { id: 'SUPPLY_STONE_QUARRY/v1', type: 'STONE_QUARRY', label: 'Stone quarry', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-work', costs: { population: 1, energy: 7, materials: 8, funds: 15, attention: 2 }, labor: 4, capacity: { jobs: 5 }, operating: { energy: 2, funds: 1 }, terrain: ['RIDGE'] },
    { id: 'SUPPLY_ORE_YARD/v1', type: 'ORE_YARD', label: 'Ore yard', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-work', costs: { population: 1, energy: 8, materials: 9, funds: 17, attention: 3 }, labor: 4, capacity: { jobs: 5 }, operating: { energy: 3, funds: 1 }, terrain: ['RIDGE'] },
    { id: 'SUPPLY_SAWMILL/v1', type: 'SAWMILL', label: 'Sawmill', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-work', costs: { population: 1, energy: 7, materials: 9, funds: 15, attention: 2 }, labor: 4, capacity: { jobs: 6 }, operating: { energy: 2, funds: 1 }, terrain: ['WOODLAND', 'CLAY'] },
    { id: 'SUPPLY_BRICKWORKS/v1', type: 'BRICKWORKS', label: 'Brickworks', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-work', costs: { population: 1, energy: 8, materials: 10, funds: 16, attention: 2 }, labor: 4, capacity: { jobs: 6 }, operating: { energy: 3, funds: 1 }, terrain: ['CLAY', 'RIDGE'] },
    { id: 'SUPPLY_METALWORKS/v1', type: 'METALWORKS', label: 'Metalworks', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-work', costs: { population: 1, energy: 10, materials: 12, funds: 20, attention: 3 }, labor: 5, capacity: { jobs: 7 }, operating: { energy: 4, funds: 2 }, terrain: ['RIDGE', 'CLAY'] },
    { id: 'SUPPLY_CANNERY/v1', type: 'CANNERY', label: 'Island cannery', category: 'INDUSTRY', zones: ['INDUSTRY'], trigger: 'need-work', costs: { population: 1, energy: 8, materials: 10, funds: 18, attention: 2 }, labor: 4, capacity: { jobs: 6, service: 1 }, operating: { energy: 3, funds: 1 }, terrain: ['WETLAND', 'CLAY', 'MEADOW'] },
    { id: 'SUPPLY_FURNITURE/v1', type: 'FURNITURE_WORKSHOP', label: 'Furniture workshop', category: 'INDUSTRY', zones: ['INDUSTRY', 'NEUTRAL'], neutralEligible: true, trigger: 'need-work', costs: { population: 1, energy: 6, materials: 9, funds: 16, attention: 2 }, labor: 4, capacity: { jobs: 6 }, operating: { energy: 2, funds: 1 }, terrain: ['WOODLAND', 'MEADOW', 'CLAY'] },
    { id: 'SUPPLY_CONSTRUCTION_YARD/v1', type: 'CONSTRUCTION_YARD', label: 'Construction yard', category: 'INDUSTRY', zones: ['INDUSTRY', 'INFRASTRUCTURE'], trigger: 'need-work', costs: { population: 1, energy: 7, materials: 11, funds: 18, attention: 2 }, labor: 4, capacity: { jobs: 6, service: 1 }, operating: { energy: 2, funds: 1 }, terrain: ['CLAY', 'RIDGE', 'MEADOW'] },
    { id: 'SUPPLY_MARKET_ROW/v1', type: 'MARKET_ROW', label: 'Market row', category: 'SERVICE', zones: ['HOUSING', 'ENTERTAINMENT', 'NEUTRAL'], neutralEligible: true, trigger: 'need-services', costs: { population: 1, energy: 5, materials: 8, funds: 15, attention: 2 }, labor: 3, capacity: { jobs: 4, service: 3 }, operating: { energy: 1, funds: 1 }, terrain: ['MEADOW', 'CLAY', 'RIDGE'] },
    { id: 'SUPPLY_FOOD_HALL/v1', type: 'FOOD_HALL', label: 'Food hall', category: 'ENTERTAINMENT', zones: ['ENTERTAINMENT', 'NEUTRAL'], neutralEligible: true, trigger: 'need-leisure', costs: { population: 1, energy: 6, materials: 9, funds: 16, attention: 2 }, labor: 3, capacity: { jobs: 4, leisure: 5, service: 1 }, operating: { energy: 2, funds: 1 }, terrain: ['MEADOW', 'CLAY', 'WETLAND'] }
  ];

  function ruleByType(type) { return RULES.filter(function (rule) { return rule.type === type; })[0] || null; }
  function needById(needs, id) { return (needs || []).filter(function (item) { return item.id === id; })[0] || { id: id, label: id, pressure: 0 }; }

  function starterStructure(id, type, label, category, cellId, capacity) {
    return {
      id: id,
      type: type,
      label: label,
      category: category,
      cellId: cellId,
      districtId: null,
      createdTurn: 0,
      lifecycle: 'ACTIVE',
      capacity: capacity || {},
      operatingCosts: ruleByType(type) ? Canonical.clone(ruleByType(type).operating) : {},
      metricStatus: 'KNOWN_BINDINGS',
      vitalBindings: Canonical.clone(Consequences.KNOWN_BINDINGS[type] || {}),
      cause: {
        trigger: 'STARTER_REGION_FIXTURE',
        ruleId: 'STARTER_WORLD_SEED/v1',
        ruleVersion: '1',
        zeroCostReason: 'This structure is declared pre-existing fixture state; it was not generated during a simulated turn.',
        decisionIds: [],
        resourceTransactionIds: []
      },
      risks: ['Pre-existing fixture capacity is illustrative and unbalanced.'],
      limitations: ['Starter fixture is abstract civic simulation data.']
    };
  }

  function createStarterStructures(map) {
    var structures = [
      starterStructure('structure-starter-cottages', 'COTTAGE_CLUSTER', 'Old Orchard Cottages', 'HOUSING', 'cell-0-1', { residents: 10 }),
      starterStructure('structure-starter-workshop', 'WORKSHOP_YARD', 'Kilnward Workshop', 'INDUSTRY', 'cell-7-1', { jobs: 6 }),
      starterStructure('structure-starter-hall', 'COMMON_HALL', 'Reedbank Common Hall', 'ENTERTAINMENT', 'cell-2-4', { leisure: 5, service: 1 }),
      starterStructure('structure-starter-energy', 'ENERGY_COOP', 'Sunridge Energy Shed', 'INFRASTRUCTURE', 'cell-3-2', { energy: 10, jobs: 2 })
    ];
    structures.forEach(function (structure) {
      var cell = map.cells.filter(function (candidate) { return candidate.id === structure.cellId; })[0];
      structure.districtId = cell.districtId;
      cell.structureIds.push(structure.id);
    });
    return structures;
  }

  function chooseNeutralOutcome(state, cell, needs) {
    var priority = state.policies.priority;
    if (cell.terrain.kind === 'WETLAND' || cell.protected || priority === 'ECOLOGICAL_REPAIR') return 'ECO_BUFFER';
    var mapping = {
      'need-housing': 'SMALL_SETTLEMENT',
      'need-access': 'TRADE_PATH',
      'need-services': 'PUBLIC_SERVICE',
      'need-work': 'MIXED_QUARTER',
      'need-ecology': 'ECO_BUFFER'
    };
    var ranked = (needs || []).filter(function (item) { return mapping[item.id]; });
    ranked.sort(function (a, b) { return b.pressure - a.pressure || a.id.localeCompare(b.id); });
    if (ranked.length && ranked[0].pressure >= 20) return mapping[ranked[0].id];
    var options = ['MIXED_QUARTER', 'SMALL_SETTLEMENT', 'TRADE_PATH', 'PUBLIC_SERVICE', 'ECO_BUFFER'];
    var hash = Canonical.sha256(state.seed + '|' + state.turn + '|' + cell.id + '|neutral');
    return options[parseInt(hash.slice(0, 8), 16) % options.length];
  }

  function priorityBoost(priority, rule) {
    var map = {
      BALANCED: [],
      HOMES_FIRST: ['HOUSING'],
      LOCAL_WORK: ['INDUSTRY', 'MIXED'],
      ACCESS_FIRST: ['INFRASTRUCTURE'],
      CIVIC_CARE: ['SERVICE'],
      ECOLOGICAL_REPAIR: ['NATURE']
    };
    return (map[priority] || []).indexOf(rule.category) >= 0 ? 12 : 0;
  }

  function rulesForCell(state, cell, needs) {
    if (cell.zone === 'NEUTRAL') {
      var outcome = chooseNeutralOutcome(state, cell, needs);
      return RULES.filter(function (rule) { return rule.type === outcome || (rule.neutralEligible && rule.zones.indexOf('NEUTRAL') >= 0); });
    }
    return RULES.filter(function (rule) { return rule.zones.indexOf(cell.zone) >= 0; });
  }

  function generateCandidates(state, needs, rng) {
    var candidates = [], refused = [];
    state.map.cells.slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).forEach(function (cell) {
      if (cell.structureIds.length) return;
      var district = state.districts.filter(function (item) { return item.id === cell.districtId; })[0];
      if (district.held || ['FAILED', 'HELD', 'REPAIRING'].indexOf(district.lifecycleState) >= 0) {
        refused.push({ cellId: cell.id, reason: 'DISTRICT_NOT_OPEN_FOR_EMERGENCE', districtState: district.lifecycleState });
        return;
      }
      rulesForCell(state, cell, needs).forEach(function (rule) {
        var trigger = needById(needs, rule.trigger);
        var supplyScore = Supply.scoreCandidate(state, cell, rule, trigger.pressure);
        var goal = Patterns.influenceForCandidate(state, cell, Object.assign({}, rule, { operatingGoods: supplyScore.operatingInputs, outputGoods: supplyScore.outputs }));
        if (goal.blocked) {
          refused.push({ cellId: cell.id, ruleId: rule.id, type: rule.type, reason: goal.reasons[0], reasons: Canonical.clone(goal.reasons), goalLayerIds: Canonical.clone(goal.layerRefs), goalMode: goal.mode, goalMatch: goal.match });
          return;
        }
        var terrainFit = rule.terrain.indexOf(cell.terrain.kind) >= 0 ? 4 : -5;
        var policy = priorityBoost(state.policies.priority, rule) * 0.55;
        var tie = rng.int(0, 999);
        var costWeight = Object.keys(rule.costs).reduce(function (sum, name) { return sum + rule.costs[name]; }, 0) / 10;
        var score = Canonical.round(supplyScore.score + goal.bonus + terrainFit + policy - costWeight * 0.35 + tie / 100000, 4);
        candidates.push({
          id: 'candidate-t' + (state.turn + 1) + '-' + cell.id + '-' + rule.type.toLowerCase(),
          kind: 'STRUCTURE',
          ruleId: rule.id,
          ruleVersion: '1',
          type: rule.type,
          label: rule.label,
          category: rule.category,
          zone: cell.zone,
          cellId: cell.id,
          districtId: cell.districtId,
          terrain: Canonical.clone(cell.terrain),
          triggerNeed: Canonical.clone(trigger),
          costs: Canonical.clone(rule.costs),
          goodsBuild: Canonical.clone(supplyScore.build.bill),
          goodsBuildValue: supplyScore.build.value,
          operatingGoods: Canonical.clone(supplyScore.operatingInputs),
          outputGoods: Canonical.clone(supplyScore.outputs),
          underlyingDeposit: supplyScore.deposit,
          goalInfluence: Canonical.clone(goal),
          laborRequired: rule.labor,
          capacity: Canonical.clone(rule.capacity),
          operatingCosts: Canonical.clone(rule.operating),
          vitalBindings: Canonical.clone(Consequences.KNOWN_BINDINGS[rule.type]),
          selectionScore: score,
          scoreComponents: Object.assign({}, supplyScore.components, goal.components, { terrainRuleFit: terrainFit, policyBoost: Canonical.round(policy, 4), genericCostWeight: Canonical.round(-costWeight * 0.35, 4) }),
          tieBreaker: { draw: tie, stableId: cell.id + '|' + rule.id },
          benefits: Object.keys(Consequences.KNOWN_BINDINGS[rule.type] || {}).filter(function (name) { return Consequences.KNOWN_BINDINGS[rule.type][name] > 0; }),
          risks: Object.keys(Consequences.KNOWN_BINDINGS[rule.type] || {}).filter(function (name) { return Consequences.KNOWN_BINDINGS[rule.type][name] < 0; }),
          limitations: ['Candidate score selects among rules only; it is not a universal value or victory score.', 'Typed input supply is a strong pressure, not destiny; demand, access, labor, terrain, policy and a small deterministic founder variation still matter.', 'A captured goal may add preference or cap further emergence, but it never grants a zone exception or waives any cost.']
        });
      });
    });
    candidates.sort(function (a, b) { return b.selectionScore - a.selectionScore || a.tieBreaker.stableId.localeCompare(b.tieBreaker.stableId); });
    return { candidates: candidates, refused: refused };
  }

  function reservationFor(state, zone, costs) {
    var reservations = Object.keys(state.ledger.reservations).map(function (id) { return state.ledger.reservations[id]; }).filter(function (reservation) {
      if (reservation.status !== 'ACTIVE' || reservation.zone !== zone) return false;
      return Object.keys(costs).every(function (name) { return Number(reservation.remaining[name] || 0) >= costs[name]; });
    });
    reservations.sort(function (a, b) { return a.createdTurn - b.createdTurn || a.id.localeCompare(b.id); });
    return reservations[0] || null;
  }

  function affordability(state, candidate) {
    var reservation = reservationFor(state, candidate.zone, candidate.costs);
    var reasons = [];
    if (!reservation) reasons.push('NO_MATCHING_FUNDED_ZONE_ALLOCATION');
    if (state.resources.labor.available < Number(candidate.laborRequired || 1)) reasons.push('INSUFFICIENT_AVAILABLE_LABOR');
    if (candidate.kind !== 'ROAD' && candidate.type) {
      var goods = Supply.buildCheck(state, candidate.type);
      goods.missing.forEach(function (id) { reasons.push('INSUFFICIENT_TYPED_' + id.toUpperCase()); });
    }
    return { affordable: reasons.length === 0, reasons: reasons, reservationId: reservation && reservation.id };
  }

  function commitStructure(state, candidate, receiptReference) {
    var check = affordability(state, candidate);
    if (!check.affordable) return { ok: false, state: state, errors: check.reasons, transactions: [] };
    var structureId = 'structure-t' + state.turn + '-' + candidate.cellId + '-' + candidate.type.toLowerCase();
    var reserved = Ledger.commitReservation(state, {
      reservationId: check.reservationId,
      amounts: candidate.costs,
      transactionId: 'tx-' + structureId + '-allocated',
      cause: candidate.ruleId,
      destination: 'structure:' + structureId,
      turn: state.turn,
      decisionReference: state.ledger.reservations[check.reservationId].decisionReference,
      receiptReference: receiptReference
    });
    if (!reserved.ok) return { ok: false, state: state, errors: reserved.errors, transactions: [] };
    var labor = Ledger.spendAvailable(reserved.state, {
      amounts: { labor: Number(candidate.laborRequired || 1) },
      transactionId: 'tx-' + structureId + '-labor',
      cause: candidate.ruleId,
      destination: 'structure:' + structureId,
      turn: state.turn,
      decisionReference: state.ledger.reservations[check.reservationId].decisionReference,
      receiptReference: receiptReference
    });
    if (!labor.ok) return { ok: false, state: state, errors: labor.errors, transactions: [] };
    var draft = labor.state;
    var goods = Supply.consumeBuild(draft, candidate.type, 'structure:' + structureId, candidate.ruleId);
    if (!goods.ok) return { ok: false, state: state, errors: goods.errors, transactions: [], goodsTransactions: [] };
    var structure = {
      id: structureId,
      type: candidate.type,
      label: candidate.label,
      category: candidate.category,
      cellId: candidate.cellId,
      districtId: candidate.districtId,
      createdTurn: state.turn,
      lifecycle: 'ACTIVE',
      capacity: Canonical.clone(candidate.capacity),
      operatingCosts: Canonical.clone(candidate.operatingCosts),
      goodsBuild: Canonical.clone(candidate.goodsBuild),
      operatingGoods: Canonical.clone(candidate.operatingGoods),
      outputGoods: Canonical.clone(candidate.outputGoods),
      underlyingDeposit: candidate.underlyingDeposit,
      metricStatus: 'KNOWN_BINDINGS',
      vitalBindings: Canonical.clone(candidate.vitalBindings),
      cause: {
        triggerNeedId: candidate.triggerNeed.id,
        triggerPressure: candidate.triggerNeed.pressure,
        ruleId: candidate.ruleId,
        ruleVersion: candidate.ruleVersion,
        zone: candidate.zone,
        terrain: Canonical.clone(candidate.terrain),
        policy: draft.policies.priority,
        candidateId: candidate.id,
        selectionScore: candidate.selectionScore,
        scoreComponents: Canonical.clone(candidate.scoreComponents),
        tieBreaker: Canonical.clone(candidate.tieBreaker),
        allocationReservationId: check.reservationId,
        decisionIds: [state.ledger.reservations[check.reservationId].decisionReference],
        resourceTransactionIds: reserved.transactions.concat(labor.transactions).map(function (tx) { return tx.transactionId; }),
        goodsTransactionIds: goods.transactions.map(function (tx) { return tx.transactionId; }),
        goodsBuildValue: goods.value,
        capturedGoal: Canonical.clone(candidate.goalInfluence || { match: 'NONE', layerRefs: [], bonus: 0 })
      },
      benefits: Canonical.clone(candidate.benefits),
      risks: Canonical.clone(candidate.risks),
      limitations: Canonical.clone(candidate.limitations)
    };
    draft.structures.push(structure);
    var cell = draft.map.cells.filter(function (item) { return item.id === candidate.cellId; })[0];
    cell.structureIds.push(structureId);
    if (structure.type === 'ENERGY_COOP') draft.resources.energy.inflow += Number(structure.capacity.energy || 0);
    return { ok: true, state: draft, structure: structure, transactions: reserved.transactions.concat(labor.transactions), goodsTransactions: goods.transactions, errors: [] };
  }

  function commitRoad(state, candidate, receiptReference) {
    var roadCandidate = Object.assign({}, candidate, { laborRequired: 2 });
    var check = affordability(state, roadCandidate);
    if (!check.affordable) return { ok: false, state: state, errors: check.reasons, transactions: [] };
    var roadId = 'road-t' + state.turn + '-' + candidate.originCellId + '-' + candidate.destinationCellId;
    var reserved = Ledger.commitReservation(state, {
      reservationId: check.reservationId,
      amounts: candidate.costs,
      transactionId: 'tx-' + roadId + '-allocated', cause: candidate.ruleId, destination: 'road:' + roadId,
      turn: state.turn, decisionReference: state.ledger.reservations[check.reservationId].decisionReference, receiptReference: receiptReference
    });
    if (!reserved.ok) return { ok: false, state: state, errors: reserved.errors, transactions: [] };
    var labor = Ledger.spendAvailable(reserved.state, {
      amounts: { labor: 2 }, transactionId: 'tx-' + roadId + '-labor', cause: candidate.ruleId, destination: 'road:' + roadId,
      turn: state.turn, decisionReference: state.ledger.reservations[check.reservationId].decisionReference, receiptReference: receiptReference
    });
    if (!labor.ok) return { ok: false, state: state, errors: labor.errors, transactions: [] };
    var draft = labor.state;
    var road = {
      id: roadId, originCellId: candidate.originCellId, destinationCellId: candidate.destinationCellId,
      path: Canonical.clone(candidate.path), createdTurn: state.turn, lifecycle: 'ACTIVE',
      cause: {
        triggerNeedId: 'need-access', connectionPressure: candidate.connectionPressure, threshold: candidate.threshold,
        ruleId: candidate.ruleId, ruleVersion: candidate.ruleVersion, pathCost: candidate.pathCost,
        policy: Canonical.clone(draft.policies.constraints), tieBreaker: candidate.tieBreaker,
        allocationReservationId: check.reservationId,
        decisionIds: [state.ledger.reservations[check.reservationId].decisionReference],
        resourceTransactionIds: reserved.transactions.concat(labor.transactions).map(function (tx) { return tx.transactionId; })
      },
      benefits: Canonical.clone(candidate.benefits), risks: Canonical.clone(candidate.risks), limitations: Canonical.clone(candidate.limitations)
    };
    draft.roads.push(road);
    road.path.forEach(function (cellId) {
      var cell = draft.map.cells.filter(function (item) { return item.id === cellId; })[0];
      if (cell && cell.roadIds.indexOf(roadId) < 0) cell.roadIds.push(roadId);
    });
    return { ok: true, state: draft, road: road, transactions: reserved.transactions.concat(labor.transactions), errors: [] };
  }

  function updateOperatingFlows(state) {
    var totals = { labor: 1, energy: 6, funds: 5, attention: 1 };
    state.structures.forEach(function (structure) {
      if (structure.lifecycle === 'FAILED') return;
      Object.keys(structure.operatingCosts || {}).forEach(function (name) { totals[name] = Number(totals[name] || 0) + Number(structure.operatingCosts[name] || 0); });
    });
    Object.keys(totals).forEach(function (name) { state.resources[name].outflow = Canonical.round(totals[name], 4); });
  }

  function transitionDistrict(district, next, turn, cause, note) {
    if (district.lifecycleState === next) return null;
    var previous = district.lifecycleState;
    district.lifecycleState = next;
    district.history.push({ turn: turn, state: next, previous: previous, cause: cause, note: note });
    return { type: 'DISTRICT_LIFECYCLE', id: district.id, from: previous, to: next, summary: district.name + ': ' + previous + ' → ' + next };
  }

  function updateDistricts(state) {
    var changes = [];
    var shortagePressure = (state.lastTurnShortages || []).reduce(function (sum, item) { return sum + item.shortfall; }, 0);
    state.districts.forEach(function (district) {
      if (district.held || district.lifecycleState === 'HELD') return;
      if (district.lifecycleState === 'REPAIRING') {
        district.repair.turnsRemaining -= 1;
        if (district.repair.turnsRemaining <= 0) {
          district.stress = 3;
          district.failureCause = null;
          district.repair.completedTurn = state.turn;
          state.governance.repairsCompleted += 1;
          state.governance.commitmentsKept += 1;
          var repaired = transitionDistrict(district, 'RECOVERED', state.turn, district.repair.decisionId, 'Costed repair completed; earlier failure history retained.');
          if (repaired) changes.push(repaired);
        }
        return;
      }
      if (district.lifecycleState === 'FAILED' || district.lifecycleState === 'RECOVERED') return;
      var districtRoads = state.map.cells.filter(function (cell) { return cell.districtId === district.id && cell.roadIds.length; }).length;
      district.stress = Math.max(0, Canonical.round(district.stress + (shortagePressure > 0 ? 2 : -1) + (districtRoads ? -0.5 : 0.6), 2));
      var next = district.stress >= 14 ? 'FAILED' : district.stress >= 9 ? 'STALLED' : district.stress >= 5 ? 'STRAINED' : 'HEALTHY';
      if (next === 'FAILED' && !district.failureCause) district.failureCause = shortagePressure ? 'RESOURCE_SHORTAGE' : 'PROLONGED_UNMET_ACCESS';
      var changed = transitionDistrict(district, next, state.turn, 'DISTRICT_STRESS_RULE/v1', 'State follows visible stress thresholds; no history was erased.');
      if (changed) changes.push(changed);
    });
    return changes;
  }

  function runTurn(inputState, receiptReference) {
    var state = Canonical.clone(inputState);
    var preSeed = Canonical.clone(state.prng);
    state.turn += 1;
    updateOperatingFlows(state);
    var flow = Ledger.applyTurnFlows(state, {
      transactionId: 'tx-turn-' + String(state.turn).padStart(4, '0'),
      cause: 'TURN_RESOURCE_FLOW/v1', turn: state.turn, decisionReference: null, receiptReference: receiptReference
    });
    state = flow.state;
    state.lastTurnShortages = flow.shortages;
    var energyShortage = flow.shortages.filter(function (item) { return item.resource === 'energy'; })[0];
    var supplyResult = Supply.advance(state, { energyFactor: energyShortage ? 0.45 : 1 });
    var goalBefore = Patterns.refresh(state);
    state.needs = Needs.calculate(state);
    var observedNeeds = Canonical.clone(state.needs);
    var rng = Rng.create(state.prng);
    var generated = generateCandidates(state, state.needs, rng);
    var candidateRecords = generated.refused.slice();
    var proposals = generated.candidates.slice(0, 12).map(function (candidate) { return { id: candidate.id, kind: candidate.kind, ruleId: candidate.ruleId, selectionScore: candidate.selectionScore, scoreComponents: candidate.scoreComponents }; });
    var transactions = flow.transactions.concat(supplyResult.transactions);
    var changes = supplyResult.changes.concat(goalBefore.changes), warnings = supplyResult.warnings.concat(goalBefore.warnings);
    var chosen = null;
    for (var i = 0; i < generated.candidates.length; i += 1) {
      var candidate = generated.candidates[i];
      var check = affordability(state, candidate);
      if (!check.affordable) {
        candidateRecords.push({ id: candidate.id, selected: false, reasons: check.reasons, selectionScore: candidate.selectionScore });
        continue;
      }
      chosen = candidate;
      var built = commitStructure(state, candidate, receiptReference);
      if (built.ok) {
        state = built.state; transactions = transactions.concat(built.transactions, built.goodsTransactions || []);
        changes.push({ type: 'STRUCTURE_CREATED', id: built.structure.id, cellId: built.structure.cellId, summary: built.structure.label + ' emerged from ' + candidate.triggerNeed.label + ', local supply and product demand' + (candidate.goalInfluence && candidate.goalInfluence.match !== 'NONE' ? ', guided by ' + candidate.goalInfluence.match.toLowerCase().replace(/_/g, ' ') : '') + '.' });
        candidateRecords.push({ id: candidate.id, selected: true, reasons: [], selectionScore: candidate.selectionScore, scoreComponents: Canonical.clone(candidate.scoreComponents), goalInfluence: Canonical.clone(candidate.goalInfluence), goodsBuild: Canonical.clone(candidate.goodsBuild), goodsTransactionIds: Canonical.clone(built.structure.cause.goodsTransactionIds) });
      } else warnings.push('Selected structure candidate failed atomic commit: ' + built.errors.join(', '));
      break;
    }
    if (!chosen) warnings.push('No structure emerged: no candidate had a matching allocation, labor and the required typed construction inputs.');

    var goalAfter = Patterns.refresh(state);
    changes = changes.concat(goalAfter.changes); warnings = warnings.concat(goalAfter.warnings);
    state.needs = Needs.calculate(state);
    var roadResult = Roads.generateCandidate(state, state.needs);
    if (roadResult.candidate) {
      var roadCheck = affordability(state, Object.assign({}, roadResult.candidate, { laborRequired: 2 }));
      if (roadCheck.affordable) {
        var roadBuilt = commitRoad(state, roadResult.candidate, receiptReference);
        if (roadBuilt.ok) {
          state = roadBuilt.state; transactions = transactions.concat(roadBuilt.transactions);
          changes.push({ type: 'ROAD_CREATED', id: roadBuilt.road.id, summary: 'Road emerged between ' + roadBuilt.road.originCellId + ' and ' + roadBuilt.road.destinationCellId + ' from measured connection pressure.' });
          candidateRecords.push({ id: roadResult.candidate.id, kind: 'ROAD', selected: true, reasons: [], connectionPressure: roadResult.candidate.connectionPressure });
        }
      } else candidateRecords.push({ id: roadResult.candidate.id, kind: 'ROAD', selected: false, reasons: roadCheck.reasons, connectionPressure: roadResult.candidate.connectionPressure });
    } else candidateRecords.push({ kind: 'ROAD', selected: false, reasons: [roadResult.refusal], connectionPressure: roadResult.pressure || 0 });

    changes = changes.concat(updateDistricts(state));
    state.prng = rng.snapshot();
    state.needs = Needs.calculate(state);
    var previousVitals = Canonical.clone(inputState.vitals);
    state.vitals = Consequences.calculate(state);
    var vitalDeltas = Consequences.delta(previousVitals, state.vitals);
    return {
      ok: true,
      state: state,
      seedPreState: preSeed,
      seedPostState: Canonical.clone(state.prng),
      needsObserved: observedNeeds,
      proposalsConsidered: proposals,
      candidates: candidateRecords,
      transactions: transactions,
      changes: changes,
      vitalDeltas: vitalDeltas,
      warnings: warnings,
      limitations: ['Rules are transparent civic-game heuristics, not a scientific city or economic model.', 'Candidate score is a local selection device, not a victory value.', 'Captured goals preserve evidence and influence candidates; they never clone stock, buildings or money and never waive ordinary gates.', 'Typed surplus is marked trade-ready but no external trade route is connected.'],
      noveltyFlags: state.noveltyReview.filter(function (item) { return item.status === 'UNSCORED_REVIEW_REQUIRED'; }).map(function (item) { return item.id; })
    };
  }

  function addNoveltyFixture(state, input) {
    var draft = Canonical.clone(state);
    var id = String(input && input.id || 'novelty-test-fixture');
    if (draft.noveltyReview.some(function (item) { return item.id === id; })) return { ok: false, state: state, errors: ['duplicate novelty ID'] };
    draft.noveltyReview.push({
      id: id,
      label: String(input && input.label || 'Unbound civic novelty'),
      status: 'UNSCORED_REVIEW_REQUIRED',
      proposedCellId: input && input.cellId || null,
      proposedEffects: Canonical.clone(input && input.proposedEffects || {}),
      metricBindings: null,
      source: 'TEST FIXTURE',
      mayAffectVitals: false,
      mayEnterGlobeProposal: false,
      reviewHistory: []
    });
    return { ok: true, state: draft, item: draft.noveltyReview[draft.noveltyReview.length - 1], errors: [] };
  }

  function noveltyEligibleForProposal(item) {
    return !!item && item.status === 'REVIEWED_WITH_BINDINGS' && item.mayEnterGlobeProposal === true;
  }

  return {
    RULES: RULES,
    ruleByType: ruleByType,
    createStarterStructures: createStarterStructures,
    chooseNeutralOutcome: chooseNeutralOutcome,
    generateCandidates: generateCandidates,
    reservationFor: reservationFor,
    affordability: affordability,
    commitStructure: commitStructure,
    commitRoad: commitRoad,
    updateDistricts: updateDistricts,
    runTurn: runTurn,
    addNoveltyFixture: addNoveltyFixture,
    noveltyEligibleForProposal: noveltyEligibleForProposal
  };
});
