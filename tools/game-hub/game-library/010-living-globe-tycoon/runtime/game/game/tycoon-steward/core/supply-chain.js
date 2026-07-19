(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonSupply = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var SCHEMA = 'axm.tycoon-steward.supply-chain/v0.1';
  var GOOD_ORDER = ['crops', 'fish', 'timber', 'clay', 'stone', 'ore', 'lumber', 'bricks', 'metalParts', 'preservedFood', 'tools', 'furniture', 'constructionKits'];
  var GOODS = {
    crops: { label: 'Crops', stage: 'RAW', referencePrice: 0.36, capacity: 70, starter: 15 },
    fish: { label: 'Fish', stage: 'RAW', referencePrice: 0.54, capacity: 42, starter: 7 },
    timber: { label: 'Timber', stage: 'RAW', referencePrice: 0.43, capacity: 64, starter: 14 },
    clay: { label: 'Clay', stage: 'RAW', referencePrice: 0.3, capacity: 58, starter: 13 },
    stone: { label: 'Stone', stage: 'RAW', referencePrice: 0.5, capacity: 52, starter: 11 },
    ore: { label: 'Ore', stage: 'RAW', referencePrice: 0.8, capacity: 38, starter: 6 },
    lumber: { label: 'Lumber', stage: 'INTERMEDIATE', referencePrice: 0.92, capacity: 48, starter: 15 },
    bricks: { label: 'Bricks', stage: 'INTERMEDIATE', referencePrice: 0.76, capacity: 52, starter: 16 },
    metalParts: { label: 'Metal parts', stage: 'INTERMEDIATE', referencePrice: 1.55, capacity: 34, starter: 9 },
    preservedFood: { label: 'Preserved food', stage: 'INTERMEDIATE', referencePrice: 0.96, capacity: 42, starter: 8 },
    tools: { label: 'Tools', stage: 'FINISHED', referencePrice: 2.1, capacity: 28, starter: 8 },
    furniture: { label: 'Furniture', stage: 'FINISHED', referencePrice: 2.05, capacity: 30, starter: 7 },
    constructionKits: { label: 'Construction kits', stage: 'FINISHED', referencePrice: 2.68, capacity: 30, starter: 9 }
  };

  var STRUCTURE_ECONOMY = {
    COTTAGE_CLUSTER: { build: { lumber: 3.4, bricks: 1.2, tools: 0.25 }, demand: { furniture: 0.28, preservedFood: 0.15 } },
    COURTYARD_HOMES: { build: { bricks: 4, lumber: 2.2, metalParts: 0.35, tools: 0.3 }, demand: { furniture: 0.4, preservedFood: 0.22 } },
    WORKSHOP_YARD: { build: { lumber: 1.4, bricks: 1.4, metalParts: 0.5, tools: 0.35 }, inputs: { metalParts: 0.35, lumber: 0.25 }, outputs: { tools: 0.32 } },
    REPAIR_COOPERATIVE: { build: { lumber: 1.1, bricks: 0.9, tools: 0.45 }, inputs: { tools: 0.12 }, outputs: {}, serviceDemand: 'tools' },
    FESTIVAL_GREEN: { build: { lumber: 0.8, tools: 0.18 }, demand: { preservedFood: 0.35, furniture: 0.06 } },
    COMMON_HALL: { build: { bricks: 1.4, lumber: 1.3, furniture: 0.35, tools: 0.14 }, demand: { preservedFood: 0.25 } },
    POCKET_PARK: { build: { lumber: 0.35, tools: 0.1 } },
    WETLAND_BUFFER: { build: { lumber: 0.2, tools: 0.12 } },
    ENERGY_COOP: { build: { metalParts: 1.2, constructionKits: 0.7, tools: 0.28 } },
    CIVIC_STOP: { build: { bricks: 1, lumber: 0.8, metalParts: 0.25, tools: 0.12 } },
    PUBLIC_SERVICE: { build: { bricks: 1.3, lumber: 0.9, furniture: 0.25, tools: 0.15 } },
    MIXED_QUARTER: { build: { bricks: 2.2, lumber: 2, metalParts: 0.25, tools: 0.25 }, demand: { furniture: 0.32, preservedFood: 0.2 } },
    SMALL_SETTLEMENT: { build: { lumber: 2.8, bricks: 0.9, tools: 0.2 }, demand: { furniture: 0.24, preservedFood: 0.16 } },
    TRADE_PATH: { build: { stone: 1, lumber: 0.4, tools: 0.15 } },
    ECO_BUFFER: { build: { lumber: 0.2, tools: 0.1 } },
    TIMBER_CAMP: { build: { lumber: 0.4, tools: 0.55 }, deposit: 'timber', outputs: { timber: 2.5 } },
    CLAY_PIT: { build: { lumber: 0.35, tools: 0.5 }, deposit: 'clay', outputs: { clay: 2.6 } },
    STONE_QUARRY: { build: { lumber: 0.5, tools: 0.65, constructionKits: 0.25 }, deposit: 'stone', outputs: { stone: 2.25 } },
    ORE_YARD: { build: { lumber: 0.5, tools: 0.7, constructionKits: 0.3 }, deposit: 'ore', outputs: { ore: 1.7 } },
    SAWMILL: { build: { bricks: 0.9, lumber: 0.7, tools: 0.55, constructionKits: 0.3 }, inputs: { timber: 1.7 }, outputs: { lumber: 1.3 } },
    BRICKWORKS: { build: { bricks: 0.8, tools: 0.55, constructionKits: 0.3 }, inputs: { clay: 1.8, stone: 0.3 }, outputs: { bricks: 1.55 } },
    METALWORKS: { build: { bricks: 1, tools: 0.7, constructionKits: 0.4 }, inputs: { ore: 1.4 }, outputs: { metalParts: 0.78 } },
    CANNERY: { build: { bricks: 0.8, metalParts: 0.35, tools: 0.5, constructionKits: 0.3 }, inputs: { fish: 0.8, crops: 0.65, metalParts: 0.1 }, outputs: { preservedFood: 1.25 } },
    FURNITURE_WORKSHOP: { build: { lumber: 0.9, bricks: 0.5, tools: 0.55 }, inputs: { lumber: 0.9, tools: 0.1 }, outputs: { furniture: 0.58 } },
    CONSTRUCTION_YARD: { build: { lumber: 0.8, bricks: 0.8, tools: 0.6 }, inputs: { lumber: 0.7, bricks: 0.85, metalParts: 0.22 }, outputs: { constructionKits: 0.66 } },
    MARKET_ROW: { build: { lumber: 0.9, bricks: 0.55, tools: 0.2 }, demand: { crops: 0.3, fish: 0.18, preservedFood: 0.3, tools: 0.06, furniture: 0.1 } },
    FOOD_HALL: { build: { bricks: 0.8, lumber: 0.7, tools: 0.25 }, demand: { crops: 0.45, fish: 0.3, preservedFood: 0.35 } }
  };

  function clone(value) { return Canonical.clone(value); }
  function round(value, digits) { return Canonical.round(value, digits == null ? 4 : digits); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function sum(values) { return values.reduce(function (total, value) { return total + value; }, 0); }
  function hashUnit(value) { return parseInt(Canonical.sha256(String(value)).slice(0, 8), 16) / 4294967295; }

  function depositsForCell(seed, cell) {
    var kind = cell.terrain.kind, jitter = function (id) { return (hashUnit(seed + '|' + cell.id + '|' + id) - 0.5) * 18; };
    var base = {
      timber: kind === 'WOODLAND' ? 88 : kind === 'MEADOW' ? 38 : 15,
      clay: kind === 'CLAY' ? 90 : kind === 'WETLAND' ? 48 : kind === 'MEADOW' ? 30 : 18,
      stone: kind === 'RIDGE' ? 86 : kind === 'CLAY' ? 42 : 24,
      ore: kind === 'RIDGE' ? 72 : kind === 'CLAY' ? 32 : 12,
      crops: kind === 'MEADOW' ? 84 : kind === 'CLAY' ? 66 : kind === 'WETLAND' ? 48 : 22,
      fish: kind === 'WETLAND' ? 84 : 6
    };
    var out = {};
    Object.keys(base).forEach(function (id) { out[id] = { quality: round(clamp(base[id] + jitter(id), 0, 100), 2), remaining: round(clamp(base[id] + 10 + jitter(id + ':remaining'), 10, 100), 2), renewable: id === 'timber' || id === 'crops' || id === 'fish' }; });
    return out;
  }

  function initialize(state) {
    state.supplyChain = {
      schema: SCHEMA,
      version: '0.1.0',
      goods: GOOD_ORDER.reduce(function (out, id) { var spec = GOODS[id]; out[id] = { id: id, label: spec.label, stage: spec.stage, stock: spec.starter, capacity: spec.capacity, referencePrice: spec.referencePrice, price: spec.referencePrice, lastProduced: 0, lastConsumed: 0, lastShortfall: 0 }; return out; }, {}),
      deposits: state.map.cells.reduce(function (out, cell) { out[cell.id] = depositsForCell(state.seed, cell); return out; }, {}),
      market: { demand: {}, supplied: {}, shortages: [], salesValue: 0 },
      pricesIndex: 100,
      tradeReady: [],
      ledgerSequence: 0,
      transactions: [],
      lastQuarter: { turn: 0, production: {}, consumption: {}, shortages: [], idleStructures: [], headline: 'The stores are open; some shelves are optimistic.' },
      history: [],
      boundaries: { exactTypedConservation: true, externalTradeConnected: false, zonesArePermissionsNotBlueprints: true, supplyAffectsSelectionScore: true }
    };
    recalculatePrices(state);
    return state.supplyChain;
  }

  function ensure(state) { if (!state.supplyChain) initialize(state); return state.supplyChain; }
  function good(state, id) { return ensure(state).goods[id]; }
  function record(state, kind, id, quantity, source, destination, cause) {
    var supply = ensure(state); supply.ledgerSequence += 1;
    var tx = { transactionId: 'supply-tx-' + String(supply.ledgerSequence).padStart(6, '0'), kind: kind, resource: 'goods:' + id, good: id, amount: round(quantity), unit: 'product-unit', unitPrice: good(state, id).price, value: round(quantity * good(state, id).price), source: source, destination: destination, cause: cause, turn: state.turn };
    supply.transactions.push(tx); if (supply.transactions.length > 800) supply.transactions.splice(0, supply.transactions.length - 800);
    return tx;
  }
  function add(state, id, quantity, source, cause, transactions) {
    var item = good(state, id), actual = round(Math.min(Math.max(0, quantity), item.capacity - item.stock));
    if (actual <= 0) return 0;
    item.stock = round(item.stock + actual); item.lastProduced = round(item.lastProduced + actual);
    transactions.push(record(state, 'GOODS_PRODUCED', id, actual, source, 'inventory:' + id, cause)); return actual;
  }
  function take(state, id, quantity, destination, cause, transactions, kind) {
    var item = good(state, id), actual = round(Math.min(Math.max(0, quantity), item.stock));
    if (actual <= 0) return 0;
    item.stock = round(item.stock - actual); item.lastConsumed = round(item.lastConsumed + actual);
    transactions.push(record(state, kind || 'GOODS_CONSUMED', id, actual, 'inventory:' + id, destination, cause)); return actual;
  }
  function recalculatePrices(state) {
    var supply = ensure(state), total = 0;
    GOOD_ORDER.forEach(function (id) {
      var item = supply.goods[id], target = item.capacity * (item.stage === 'RAW' ? 0.42 : item.stage === 'INTERMEDIATE' ? 0.36 : 0.3);
      var scarcity = clamp((target - item.stock) / Math.max(1, target), -0.85, 1.4), demand = supply.market.demand[id] || 0, short = item.lastShortfall || 0;
      item.price = round(item.referencePrice * clamp(1 + scarcity * 0.75 + (demand ? short / demand : 0) * 0.45, 0.55, 2.9), 3);
      total += item.price / item.referencePrice;
    });
    supply.pricesIndex = round(total / GOOD_ORDER.length * 100, 2); return supply.pricesIndex;
  }

  function billFor(type) { return clone((STRUCTURE_ECONOMY[type] && STRUCTURE_ECONOMY[type].build) || {}); }
  function buildCheck(state, type) {
    var bill = billFor(type), missing = [];
    Object.keys(bill).forEach(function (id) { if (!good(state, id) || good(state, id).stock + 0.0001 < bill[id]) missing.push(id); });
    return { affordable: !missing.length, bill: bill, missing: missing, value: round(sum(Object.keys(bill).map(function (id) { return bill[id] * good(state, id).price; })), 3) };
  }
  function consumeBuild(state, type, destination, cause) {
    var check = buildCheck(state, type), transactions = [];
    if (!check.affordable) return { ok: false, errors: check.missing.map(function (id) { return 'INSUFFICIENT_' + id.toUpperCase(); }), transactions: [] };
    Object.keys(check.bill).sort().forEach(function (id) { take(state, id, check.bill[id], destination, cause, transactions, 'CONSTRUCTION_INPUT'); });
    recalculatePrices(state); return { ok: true, errors: [], transactions: transactions, bill: check.bill, value: check.value };
  }

  function accessScore(state, cell) {
    var roadCells = state.map.cells.filter(function (entry) { return entry.districtId === cell.districtId && entry.roadIds.length; }).length;
    var nearbyStructures = state.map.cells.filter(function (entry) { return entry.districtId === cell.districtId && entry.structureIds.length; }).length;
    return clamp(30 + roadCells * 7 + nearbyStructures * 3, 0, 100);
  }
  function depositScore(state, cell, spec) {
    if (!spec || !spec.deposit) return 60;
    var item = ensure(state).deposits[cell.id] && ensure(state).deposits[cell.id][spec.deposit];
    return item ? clamp(item.quality * 0.62 + item.remaining * 0.38, 0, 100) : 0;
  }
  function inputScore(state, spec) {
    var names = Object.keys(spec && spec.inputs || {});
    if (!names.length) return 65;
    return clamp(sum(names.map(function (id) { return Math.min(1, good(state, id).stock / Math.max(0.01, spec.inputs[id] * 3)); })) / names.length * 100, 0, 100);
  }
  function outputDemandScore(state, spec) {
    var ids = Object.keys(spec && spec.outputs || {});
    if (!ids.length) return 55;
    return clamp(sum(ids.map(function (id) { var item = good(state, id); return clamp((item.price / item.referencePrice - 0.62) * 72 + item.lastShortfall * 12, 0, 100); })) / ids.length, 0, 100);
  }
  function scoreCandidate(state, cell, rule, triggerPressure) {
    var spec = STRUCTURE_ECONOMY[rule.type] || {}, input = spec.deposit ? depositScore(state, cell, spec) : inputScore(state, spec), demand = outputDemandScore(state, spec);
    if (rule.category === 'HOUSING') demand = clamp(triggerPressure, 0, 100);
    if (rule.category === 'ENTERTAINMENT') demand = clamp(triggerPressure * 0.7 + demand * 0.3, 0, 100);
    var logistics = accessScore(state, cell), workforce = clamp(state.resources.labor.available / Math.max(1, state.resources.labor.capacity) * 100, 0, 100);
    var terrainResource = spec.deposit ? depositScore(state, cell, spec) : (rule.terrain.indexOf(cell.terrain.kind) >= 0 ? 82 : 35);
    var variation = hashUnit(state.seed + '|' + state.turn + '|' + cell.id + '|' + rule.id) * 5;
    var components = {
      needPressure: round(clamp(triggerPressure, 0, 100) * 0.15, 3),
      productDemand: round(demand * 0.2, 3),
      inputSupply: round(input * 0.25, 3),
      logistics: round(logistics * 0.15, 3),
      workforce: round(workforce * 0.1, 3),
      terrainResource: round(terrainResource * 0.1, 3),
      localFounder: round(variation, 3)
    };
    return { score: round(sum(Object.keys(components).map(function (id) { return components[id]; })), 4), components: components, build: buildCheck(state, rule.type), operatingInputs: clone(spec.inputs || {}), outputs: clone(spec.outputs || {}), deposit: spec.deposit || null };
  }

  function refreshDeposits(state) {
    var supply = ensure(state);
    state.map.cells.forEach(function (cell) {
      var table = supply.deposits[cell.id];
      ['timber', 'crops', 'fish'].forEach(function (id) { if (table[id].renewable) table[id].remaining = round(clamp(table[id].remaining + (id === 'timber' ? cell.terrain.habitat * 0.22 : id === 'crops' ? cell.terrain.fertility * 0.3 : cell.terrain.waterAffinity * 0.25), 0, 100), 3); });
    });
  }
  function backgroundLivelihoods(state, transactions) {
    var supply = ensure(state), totals = {};
    ['crops', 'fish', 'timber', 'clay', 'stone', 'ore'].forEach(function (id) {
      var best = state.map.cells.slice().sort(function (a, b) { return supply.deposits[b.id][id].quality - supply.deposits[a.id][id].quality || a.id.localeCompare(b.id); })[0];
      var deposit = supply.deposits[best.id][id], rate = (id === 'crops' ? 0.8 : id === 'fish' ? 0.42 : 0.28) * deposit.quality / 100;
      var produced = add(state, id, rate, 'local-livelihoods:' + best.id, 'BACKGROUND_LOCAL_LIVELIHOODS/v1', transactions);
      deposit.remaining = round(clamp(deposit.remaining - produced * (deposit.renewable ? 0.2 : 0.55), 0, 100), 3); totals[id] = produced;
    });
    return totals;
  }
  function operateStructures(state, energyFactor, transactions) {
    var supply = ensure(state), production = {}, idle = [];
    state.structures.slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).forEach(function (structure) {
      var spec = STRUCTURE_ECONOMY[structure.type]; if (!spec || structure.lifecycle === 'FAILED') return;
      if (spec.deposit) {
        var deposit = supply.deposits[structure.cellId] && supply.deposits[structure.cellId][spec.deposit];
        var id = Object.keys(spec.outputs)[0], potential = spec.outputs[id] * (deposit ? deposit.quality / 100 : 0) * energyFactor;
        var extracted = add(state, id, potential, 'structure:' + structure.id, structure.type + '_EXTRACTION/v1', transactions);
        if (deposit) deposit.remaining = round(clamp(deposit.remaining - extracted * (deposit.renewable ? 0.32 : 0.72), 0, 100), 3);
        production[id] = round((production[id] || 0) + extracted);
        if (extracted < potential * 0.1) idle.push({ structureId: structure.id, reason: 'DEPOSIT_OR_STORAGE_CONSTRAINT' });
      } else if (spec.inputs && Object.keys(spec.inputs).length) {
        var ratios = Object.keys(spec.inputs).map(function (id) { return good(state, id).stock / Math.max(0.001, spec.inputs[id]); });
        var batches = clamp(Math.min.apply(Math, ratios.concat([energyFactor, 1])), 0, 1), consumed = 0;
        Object.keys(spec.inputs).sort().forEach(function (id) { consumed += take(state, id, spec.inputs[id] * batches, 'structure:' + structure.id, structure.type + '_RECIPE/v1', transactions, 'PROCESS_INPUT'); });
        Object.keys(spec.outputs || {}).sort().forEach(function (id) { var made = add(state, id, spec.outputs[id] * batches, 'structure:' + structure.id, structure.type + '_RECIPE/v1', transactions); production[id] = round((production[id] || 0) + made); });
        if (batches < 0.1) idle.push({ structureId: structure.id, reason: consumed ? 'OUTPUT_STORAGE_FULL' : 'MISSING_OPERATING_INPUTS' });
      }
    });
    return { production: production, idle: idle };
  }
  function satisfyDemand(state, transactions) {
    var supply = ensure(state), population = state.resources.population.stock, marketRows = state.structures.filter(function (structure) { return structure.type === 'MARKET_ROW' || structure.type === 'MIXED_QUARTER'; }).length;
    var demand = { crops: population * 0.035, fish: population * 0.018, preservedFood: population * 0.028, tools: 0.08 + state.structures.length * 0.012, furniture: Math.max(0, state.needs.filter(function (item) { return item.id === 'need-housing'; })[0] && state.needs.filter(function (item) { return item.id === 'need-housing'; })[0].pressure || 0) * 0.006 };
    var channel = 3 + marketRows * 5 + state.roads.length * 1.5, shortages = [], sales = 0;
    Object.keys(demand).sort().forEach(function (id) {
      var requested = demand[id], supplied = take(state, id, Math.min(requested, channel), 'households-and-firms', 'LOCAL_MARKET_DEMAND/v1', transactions, 'MARKET_SALE');
      channel = Math.max(0, channel - supplied); var short = round(Math.max(0, requested - supplied));
      supply.market.demand[id] = round(requested); supply.market.supplied[id] = supplied; good(state, id).lastShortfall = short; sales += supplied * good(state, id).price;
      if (short > 0.01) shortages.push({ good: id, label: good(state, id).label, demanded: round(requested), supplied: supplied, shortfall: short });
    });
    supply.market.shortages = shortages; supply.market.salesValue = round(sales, 3); return shortages;
  }
  function tradeReady(state) {
    var supply = ensure(state), lots = [];
    GOOD_ORDER.forEach(function (id) { var item = good(state, id), reserve = item.capacity * (item.stage === 'FINISHED' ? 0.25 : 0.38), quantity = round(Math.max(0, item.stock - reserve), 3); if (quantity >= 0.5) lots.push({ good: id, label: item.label, quantity: quantity, reserve: round(reserve, 3), value: round(quantity * item.price, 3), status: 'READY_NOT_EXPORTED' }); });
    lots.sort(function (a, b) { return b.value - a.value || a.good.localeCompare(b.good); }); supply.tradeReady = lots; return lots;
  }
  function advance(state, context) {
    var supply = ensure(state), transactions = [], energyFactor = clamp(context && context.energyFactor == null ? 1 : Number(context && context.energyFactor), 0, 1);
    GOOD_ORDER.forEach(function (id) { var item = good(state, id); item.lastProduced = 0; item.lastConsumed = 0; item.lastShortfall = 0; });
    supply.market = { demand: {}, supplied: {}, shortages: [], salesValue: 0 };
    refreshDeposits(state); var local = backgroundLivelihoods(state, transactions), operated = operateStructures(state, energyFactor, transactions);
    recalculatePrices(state); var shortages = satisfyDemand(state, transactions); recalculatePrices(state); var ready = tradeReady(state);
    var headline = shortages.length ? shortages[0].label + ' shelves are thin; zoning has noticed.' : ready.length ? ready[0].label + ' has a surplus waiting for a future trade route.' : 'Workshops exchanged real inputs; no invisible goods appeared.';
    supply.lastQuarter = { turn: state.turn, backgroundProduction: local, production: operated.production, shortages: clone(shortages), idleStructures: clone(operated.idle), salesValue: supply.market.salesValue, transactionIds: transactions.map(function (tx) { return tx.transactionId; }), headline: headline };
    supply.history.push(clone(supply.lastQuarter)); if (supply.history.length > 32) supply.history.shift();
    return { transactions: transactions, shortages: shortages, idleStructures: operated.idle, tradeReady: ready, headline: headline, changes: operated.idle.map(function (entry) { return { type: 'STRUCTURE_IDLED', id: entry.structureId, summary: entry.structureId + ' idled: ' + entry.reason + '.' }; }), warnings: shortages.slice(0, 3).map(function (entry) { return entry.label + ' shortfall ' + entry.shortfall; }) };
  }

  function validate(state) {
    var supply = state.supplyChain, errors = [];
    if (!supply || supply.schema !== SCHEMA) return { ok: false, errors: ['typed supply-chain state required'] };
    GOOD_ORDER.forEach(function (id) { var item = supply.goods && supply.goods[id]; if (!item || !Number.isFinite(item.stock) || item.stock < 0 || item.stock > item.capacity || !Number.isFinite(item.price) || item.price <= 0) errors.push('invalid good ' + id); });
    state.map.cells.forEach(function (cell) { var table = supply.deposits && supply.deposits[cell.id]; ['timber', 'clay', 'stone', 'ore', 'crops', 'fish'].forEach(function (id) { var item = table && table[id]; if (!item || !Number.isFinite(item.quality) || !Number.isFinite(item.remaining) || item.quality < 0 || item.quality > 100 || item.remaining < 0 || item.remaining > 100) errors.push('invalid deposit ' + cell.id + ':' + id); }); });
    if (!Array.isArray(supply.transactions) || supply.transactions.length > 800 || !Array.isArray(supply.history) || supply.history.length > 32) errors.push('supply histories missing or unbounded');
    if (!supply.boundaries || supply.boundaries.exactTypedConservation !== true || supply.boundaries.externalTradeConnected !== false || supply.boundaries.supplyAffectsSelectionScore !== true) errors.push('supply boundaries weakened');
    Canonical.validateFinite(supply, '$.supplyChain', errors); return { ok: errors.length === 0, errors: errors };
  }

  return { SCHEMA: SCHEMA, GOOD_ORDER: GOOD_ORDER, GOODS: clone(GOODS), STRUCTURE_ECONOMY: clone(STRUCTURE_ECONOMY), initialize: initialize, ensure: ensure, recalculatePrices: recalculatePrices, billFor: billFor, buildCheck: buildCheck, consumeBuild: consumeBuild, scoreCandidate: scoreCandidate, advance: advance, validate: validate };
});
