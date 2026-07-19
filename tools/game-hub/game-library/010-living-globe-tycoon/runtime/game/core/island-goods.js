(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMIslandGoods = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var VERSION = '0.1.0';
  var SCHEMA = 'axm.living-world.island-goods/v0.1';
  var GOOD_ORDER = [
    'crops', 'fish', 'timber', 'clay', 'stone', 'ore',
    'lumber', 'bricks', 'metalParts', 'textiles', 'preservedFood',
    'tools', 'machinery', 'furniture', 'consumerGoods', 'constructionKits'
  ];
  var GOODS = {
    crops: { label: 'Crops', stage: 'RAW', family: 'FOOD', unit: 'crate', referencePrice: 0.38, capacity: 72, starter: 18 },
    fish: { label: 'Fresh fish', stage: 'RAW', family: 'FOOD', unit: 'basket', referencePrice: 0.56, capacity: 42, starter: 8 },
    timber: { label: 'Timber', stage: 'RAW', family: 'BUILDING', unit: 'log bundle', referencePrice: 0.44, capacity: 64, starter: 15 },
    clay: { label: 'Clay', stage: 'RAW', family: 'BUILDING', unit: 'barrow', referencePrice: 0.31, capacity: 58, starter: 12 },
    stone: { label: 'Stone', stage: 'RAW', family: 'BUILDING', unit: 'block pallet', referencePrice: 0.52, capacity: 48, starter: 9 },
    ore: { label: 'Ore', stage: 'RAW', family: 'INDUSTRIAL', unit: 'ore basket', referencePrice: 0.82, capacity: 36, starter: 5 },
    lumber: { label: 'Lumber', stage: 'INTERMEDIATE', family: 'BUILDING', unit: 'board bundle', referencePrice: 0.94, capacity: 50, starter: 11 },
    bricks: { label: 'Bricks', stage: 'INTERMEDIATE', family: 'BUILDING', unit: 'brick pallet', referencePrice: 0.78, capacity: 52, starter: 12 },
    metalParts: { label: 'Metal parts', stage: 'INTERMEDIATE', family: 'INDUSTRIAL', unit: 'parts crate', referencePrice: 1.58, capacity: 34, starter: 6 },
    textiles: { label: 'Textiles', stage: 'INTERMEDIATE', family: 'CONSUMER', unit: 'cloth bolt', referencePrice: 1.22, capacity: 34, starter: 6 },
    preservedFood: { label: 'Preserved food', stage: 'INTERMEDIATE', family: 'FOOD', unit: 'case', referencePrice: 0.98, capacity: 42, starter: 7 },
    tools: { label: 'Tools', stage: 'FINISHED', family: 'CAPITAL', unit: 'tool set', referencePrice: 2.15, capacity: 26, starter: 6 },
    machinery: { label: 'Machinery', stage: 'FINISHED', family: 'CAPITAL', unit: 'machine lot', referencePrice: 4.35, capacity: 15, starter: 2.5 },
    furniture: { label: 'Furniture', stage: 'FINISHED', family: 'CONSUMER', unit: 'room set', referencePrice: 2.05, capacity: 28, starter: 5 },
    consumerGoods: { label: 'Household goods', stage: 'FINISHED', family: 'CONSUMER', unit: 'shop crate', referencePrice: 1.64, capacity: 38, starter: 7 },
    constructionKits: { label: 'Construction kits', stage: 'FINISHED', family: 'CAPITAL', unit: 'site kit', referencePrice: 2.72, capacity: 26, starter: 5 }
  };
  var EXTRACTORS = {
    GRAIN_GROWERS: { label: 'Grain growers', sector: 'agriculture', zones: ['NEUTRAL', 'HOUSING'], deposit: 'crops', output: 'crops', rate: 4.4, energy: 0.25, water: 0.9, jobs: 3, startupCapital: 7, startupGoods: { tools: 0.35 } },
    LAKE_FISHERY: { label: 'Lake fishery', sector: 'agriculture', zones: ['NATURE', 'NEUTRAL', 'ENTERTAINMENT'], deposit: 'fish', output: 'fish', rate: 3.1, energy: 0.2, water: 0, jobs: 2, startupCapital: 8, startupGoods: { tools: 0.3 } },
    TIMBER_CAMP: { label: 'Timber camp', sector: 'industry', zones: ['INDUSTRY', 'NEUTRAL'], deposit: 'timber', output: 'timber', rate: 3.8, energy: 0.45, water: 0, jobs: 3, startupCapital: 9, startupGoods: { tools: 0.55 } },
    CLAY_PIT: { label: 'Clay pit', sector: 'industry', zones: ['INDUSTRY', 'NEUTRAL'], deposit: 'clay', output: 'clay', rate: 3.7, energy: 0.55, water: 0.15, jobs: 3, startupCapital: 9, startupGoods: { tools: 0.5 } },
    STONE_QUARRY: { label: 'Stone quarry', sector: 'industry', zones: ['INDUSTRY'], deposit: 'stone', output: 'stone', rate: 3.2, energy: 0.8, water: 0, jobs: 4, startupCapital: 12, startupGoods: { tools: 0.7, machinery: 0.12 } },
    ORE_YARD: { label: 'Ore yard', sector: 'industry', zones: ['INDUSTRY'], deposit: 'ore', output: 'ore', rate: 2.2, energy: 1.1, water: 0.1, jobs: 4, startupCapital: 15, startupGoods: { tools: 0.8, machinery: 0.18 } }
  };
  var PROCESSORS = {
    SAWMILL: { label: 'Sawmill', sector: 'industry', zones: ['INDUSTRY'], inputs: { timber: 2 }, outputs: { lumber: 1.55 }, energy: 1.2, water: 0.1, jobs: 4, startupCapital: 13, startupGoods: { tools: 0.6, constructionKits: 0.45 } },
    BRICKWORKS: { label: 'Brickworks', sector: 'industry', zones: ['INDUSTRY'], inputs: { clay: 2, stone: 0.35 }, outputs: { bricks: 1.85 }, energy: 1.5, water: 0.35, jobs: 4, startupCapital: 14, startupGoods: { tools: 0.55, constructionKits: 0.5 } },
    METALWORKS: { label: 'Metalworks', sector: 'industry', zones: ['INDUSTRY'], inputs: { ore: 1.5 }, outputs: { metalParts: 0.92 }, energy: 2.1, water: 0.2, jobs: 5, startupCapital: 19, startupGoods: { tools: 0.75, machinery: 0.18, constructionKits: 0.55 } },
    TEXTILE_WORKSHOP: { label: 'Textile workshop', sector: 'industry', zones: ['INDUSTRY', 'NEUTRAL'], inputs: { crops: 1.5 }, outputs: { textiles: 0.82 }, energy: 0.8, water: 0.35, jobs: 4, startupCapital: 12, startupGoods: { tools: 0.5, constructionKits: 0.35 } },
    CANNERY: { label: 'Island cannery', sector: 'industry', zones: ['INDUSTRY'], inputs: { fish: 0.9, crops: 0.7, metalParts: 0.12 }, outputs: { preservedFood: 1.45 }, energy: 1.25, water: 0.4, jobs: 4, startupCapital: 16, startupGoods: { tools: 0.55, machinery: 0.12, constructionKits: 0.45 } },
    TOOLWORKS: { label: 'Toolworks', sector: 'industry', zones: ['INDUSTRY'], inputs: { metalParts: 0.7, lumber: 0.35 }, outputs: { tools: 0.58 }, energy: 1.15, water: 0, jobs: 4, startupCapital: 17, startupGoods: { tools: 0.4, machinery: 0.12, constructionKits: 0.45 } },
    MACHINERY_SHOP: { label: 'Machinery shop', sector: 'industry', zones: ['INDUSTRY'], inputs: { metalParts: 1.2, tools: 0.35 }, outputs: { machinery: 0.34 }, energy: 1.8, water: 0, jobs: 5, startupCapital: 24, startupGoods: { tools: 0.7, machinery: 0.2, constructionKits: 0.65 } },
    FURNITURE_WORKSHOP: { label: 'Furniture workshop', sector: 'industry', zones: ['INDUSTRY', 'NEUTRAL'], inputs: { lumber: 1.15, textiles: 0.22, tools: 0.12 }, outputs: { furniture: 0.72 }, energy: 0.8, water: 0, jobs: 4, startupCapital: 16, startupGoods: { tools: 0.55, constructionKits: 0.4 } },
    CONSTRUCTION_YARD: { label: 'Construction yard', sector: 'industry', zones: ['INDUSTRY', 'INFRASTRUCTURE'], inputs: { lumber: 0.9, bricks: 1.1, metalParts: 0.3 }, outputs: { constructionKits: 0.82 }, energy: 1.15, water: 0.1, jobs: 4, startupCapital: 18, startupGoods: { tools: 0.65, machinery: 0.1, constructionKits: 0.35 } },
    GENERAL_GOODS_WORKSHOP: { label: 'Household-goods workshop', sector: 'industry', zones: ['INDUSTRY', 'NEUTRAL'], inputs: { textiles: 0.5, metalParts: 0.2 }, outputs: { consumerGoods: 0.62 }, energy: 0.75, water: 0, jobs: 4, startupCapital: 15, startupGoods: { tools: 0.5, constructionKits: 0.35 } }
  };
  var STORES = {
    RETAIL_HALL: { label: 'Retail hall', sector: 'commerce', zones: ['HOUSING', 'ENTERTAINMENT', 'NEUTRAL'], jobs: 3, startupCapital: 12, startupGoods: { lumber: 0.5, bricks: 0.5, tools: 0.2 } },
    ISLAND_KITCHEN: { label: 'Island kitchen', sector: 'entertainment', zones: ['ENTERTAINMENT', 'NEUTRAL'], jobs: 3, startupCapital: 11, startupGoods: { lumber: 0.35, tools: 0.18, preservedFood: 0.25 } },
    STOREHOUSE: { label: 'Storehouse', sector: 'commerce', zones: ['INFRASTRUCTURE', 'INDUSTRY', 'NEUTRAL'], jobs: 2, startupCapital: 14, startupGoods: { lumber: 0.6, bricks: 0.65, tools: 0.25 } }
  };
  var ENTERPRISES = Object.assign({}, EXTRACTORS, PROCESSORS, STORES);
  var DEMAND_PER_PERSON = { crops: 0.08, fish: 0.035, preservedFood: 0.065, textiles: 0.018, tools: 0.006, furniture: 0.009, consumerGoods: 0.042 };

  function clone(value) { return Canonical.clone(value); }
  function round(value, digits) { return Canonical.round(value, digits == null ? 3 : digits); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function sum(values) { return values.reduce(function (total, value) { return total + value; }, 0); }
  function byId(items, id) { return (items || []).filter(function (item) { return item.id === id; })[0] || null; }
  function districtById(state, id) { return byId(state.districts, id); }
  function hashUnit(seed) { return parseInt(Canonical.sha256(String(seed)).slice(0, 8), 16) / 4294967295; }

  function inventoryEntry(id) {
    var spec = GOODS[id];
    return { id: id, label: spec.label, stage: spec.stage, family: spec.family, unit: spec.unit, stock: spec.starter, capacity: spec.capacity, referencePrice: spec.referencePrice, price: spec.referencePrice, lastProduced: 0, lastConsumed: 0, lastShortfall: 0 };
  }

  function deposit(seed, district, id) {
    var jitter = (hashUnit(seed + ':' + district.id + ':' + id) - 0.5) * 18;
    var fertility = Number(district.soil && district.soil.fertility || 0.5) * 100;
    var vegetation = Number(district.ecology && district.ecology.vegetation || 50);
    var biodiversity = Number(district.ecology && district.ecology.biodiversity || 50);
    var elevation = Math.max(0, Number(district.elevation || 0));
    var water = district.waterAdjacency ? 1 : 0;
    var quality = {
      crops: fertility * 0.82 + (district.waterAdjacency ? 8 : 0),
      fish: water ? 50 + biodiversity * 0.45 : 2,
      timber: vegetation * 0.62 + biodiversity * 0.25,
      clay: 35 + (1 - Math.min(1, elevation)) * 28 + fertility * 0.12,
      stone: 24 + elevation * 48 + (100 - fertility) * 0.12,
      ore: 12 + elevation * 58 + (100 - fertility) * 0.08
    }[id] + jitter;
    quality = round(clamp(quality, 0, 100), 2);
    return {
      id: id,
      quality: quality,
      remaining: round(id === 'crops' || id === 'fish' || id === 'timber' ? clamp(quality + 12, 20, 100) : clamp(quality + 24, 15, 100), 2),
      renewable: id === 'crops' || id === 'fish' || id === 'timber',
      note: id === 'fish' ? 'Fish potential follows water access and biodiversity.' : id === 'crops' ? 'Crop potential follows fertility and water.' : id === 'timber' ? 'Timber potential follows vegetation and biodiversity.' : 'Finite geological availability is a compact gameplay abstraction.'
    };
  }

  function createDeposits(state) {
    var result = {};
    state.districts.forEach(function (district) {
      result[district.id] = {};
      ['crops', 'fish', 'timber', 'clay', 'stone', 'ore'].forEach(function (id) { result[district.id][id] = deposit(state.worldSeed, district, id); });
    });
    return result;
  }

  function starterEnterprise(id, type, districtId) {
    var spec = ENTERPRISES[type];
    return {
      id: id,
      type: type,
      label: spec.label,
      sector: spec.sector,
      districtId: districtId,
      createdTurn: 0,
      lifecycle: 'ACTIVE',
      idleQuarters: 0,
      jobs: spec.jobs,
      lastQuarter: { utilization: 0, produced: {}, consumed: {}, revenue: 0, inputCost: 0, reason: 'Pre-existing starter enterprise.' },
      cause: { ruleId: 'STARTER_PRIVATE_ECONOMY/v1', zeroCostReason: 'Declared pre-existing commercial fixture; no simulated startup was invented.', scoreComponents: null, transactionIds: [] }
    };
  }

  function initialize(state) {
    state.supply = {
      schema: SCHEMA,
      version: VERSION,
      status: 'EXPERIMENTAL GAME ECONOMY',
      inventory: GOOD_ORDER.reduce(function (out, id) { out[id] = inventoryEntry(id); return out; }, {}),
      deposits: createDeposits(state),
      enterprises: [
        starterEnterprise('enterprise-starter-growers', 'GRAIN_GROWERS', 'district-westmeadow'),
        starterEnterprise('enterprise-starter-fishery', 'LAKE_FISHERY', 'district-lakeward'),
        starterEnterprise('enterprise-starter-timber', 'TIMBER_CAMP', 'district-ridgeworks'),
        starterEnterprise('enterprise-starter-sawmill', 'SAWMILL', 'district-ridgeworks'),
        starterEnterprise('enterprise-starter-bricks', 'BRICKWORKS', 'district-ridgeworks'),
        starterEnterprise('enterprise-starter-retail', 'RETAIL_HALL', 'district-eastreach'),
        starterEnterprise('enterprise-starter-kitchen', 'ISLAND_KITCHEN', 'district-southbank')
      ],
      prices: {},
      priceIndex: 100,
      market: { demand: {}, supplied: {}, shortages: [], salesRevenue: 0, explanation: 'No commercial quarter recorded.' },
      finance: { businessCapital: 74, lastProfit: 0, cumulativePrivateSales: 0, note: 'Private business capital is not public treasury cash.' },
      tradeReadiness: { lots: [], totalValue: 0, explanation: 'No typed export lots prepared.' },
      lastEnterpriseEvent: null,
      casualHeadline: 'The warehouses are counting everything twice, which is still better than not counting.',
      ledgerSequence: 0,
      ledger: [],
      priceHistory: [],
      quarterHistory: [],
      boundaries: {
        privateInventorySeparateFromTreasury: true,
        exactGoodsConservation: true,
        externalTradeNotConnected: true,
        onePrivateEnterpriseMayEmergePerExplicitQuarter: true,
        zoneIsPermissionNotBlueprint: true
      },
      limitations: [
        'Goods, firms, deposits, prices and demand are deterministic gameplay abstractions, not economic or geological forecasts.',
        'External trade partners, shipping contracts and foreign exchange are not connected in this build.',
        'Private market inventory is separate from the civic construction reserve to prevent private sales from becoming palace cash.'
      ]
    };
    recalculatePrices(state);
    return state.supply;
  }

  function ensure(state) { if (!state.supply) initialize(state); return state.supply; }
  function priceOf(state, id) { return ensure(state).inventory[id].price; }
  function available(state, id) { var item = ensure(state).inventory[id]; return item ? item.stock : 0; }
  function record(state, input) {
    var supply = ensure(state);
    supply.ledgerSequence += 1;
    var entry = {
      id: 'goods-tx-' + String(supply.ledgerSequence).padStart(6, '0'),
      turn: state.turn,
      kind: input.kind,
      good: input.good,
      quantity: round(input.quantity, 4),
      unit: GOODS[input.good].unit,
      source: input.source,
      destination: input.destination,
      unitPrice: round(input.unitPrice == null ? priceOf(state, input.good) : input.unitPrice, 4),
      value: round(input.quantity * (input.unitPrice == null ? priceOf(state, input.good) : input.unitPrice), 4),
      cause: input.cause
    };
    supply.ledger.push(entry);
    if (supply.ledger.length > 600) supply.ledger.splice(0, supply.ledger.length - 600);
    return entry;
  }

  function addStock(state, id, quantity, source, cause, transactions) {
    var item = ensure(state).inventory[id];
    var added = round(Math.min(Math.max(0, quantity), item.capacity - item.stock), 4);
    if (added <= 0) return 0;
    item.stock = round(item.stock + added, 4); item.lastProduced = round(item.lastProduced + added, 4);
    transactions.push(record(state, { kind: 'PRODUCE', good: id, quantity: added, source: source, destination: 'market-inventory:' + id, cause: cause }));
    return added;
  }

  function takeStock(state, id, quantity, destination, cause, transactions, kind) {
    var item = ensure(state).inventory[id];
    var taken = round(Math.min(Math.max(0, quantity), item.stock), 4);
    if (taken <= 0) return 0;
    item.stock = round(item.stock - taken, 4); item.lastConsumed = round(item.lastConsumed + taken, 4);
    transactions.push(record(state, { kind: kind || 'CONSUME', good: id, quantity: taken, source: 'market-inventory:' + id, destination: destination, cause: cause }));
    return taken;
  }

  function recalculatePrices(state) {
    var supply = ensure(state), weighted = 0, weightTotal = 0;
    GOOD_ORDER.forEach(function (id) {
      var item = supply.inventory[id], target = item.capacity * (item.stage === 'RAW' ? 0.42 : item.stage === 'INTERMEDIATE' ? 0.36 : 0.3);
      var scarcity = clamp((target - item.stock) / Math.max(1, target), -0.9, 1.4);
      var demand = supply.market.demand[id] || 0, shortfall = item.lastShortfall || 0;
      var demandPressure = demand ? clamp(shortfall / demand, 0, 1) : 0;
      item.price = round(item.referencePrice * clamp(1 + scarcity * 0.72 + demandPressure * 0.45, 0.55, 2.85), 3);
      supply.prices[id] = { label: item.label, reference: item.referencePrice, current: item.price, stock: item.stock, capacity: item.capacity, explanation: item.stock < target * 0.55 ? 'Thin stock is raising the local price.' : item.stock > target * 1.45 ? 'A full store is lowering the local price.' : demandPressure > 0.25 ? 'Unfilled orders are raising the local price.' : 'Stock and orders are near the trading range.' };
      var weight = item.family === 'FOOD' ? 0.13 : item.family === 'BUILDING' ? 0.1 : item.family === 'CAPITAL' ? 0.06 : 0.04;
      weighted += item.price / item.referencePrice * weight; weightTotal += weight;
    });
    supply.priceIndex = round(weightTotal ? weighted / weightTotal * 100 : 100, 2);
    return supply.prices;
  }

  function refreshDeposits(state) {
    var supply = ensure(state);
    state.districts.forEach(function (district) {
      var deposits = supply.deposits[district.id];
      if (!deposits) return;
      deposits.crops.quality = round(clamp(district.soil.fertility * 84 + (district.waterAdjacency ? 8 : 0), 0, 100), 2);
      deposits.fish.quality = round(clamp(district.waterAdjacency ? 42 + district.ecology.biodiversity * 0.5 - district.ecology.pollution * 0.35 : 2, 0, 100), 2);
      deposits.timber.quality = round(clamp(district.ecology.vegetation * 0.64 + district.ecology.biodiversity * 0.24, 0, 100), 2);
      deposits.crops.remaining = round(clamp(deposits.crops.remaining + district.soil.fertility * 2.1, 0, 100), 2);
      deposits.fish.remaining = round(clamp(deposits.fish.remaining + district.ecology.biodiversity * 0.014 - district.ecology.pollution * 0.008, 0, 100), 2);
      deposits.timber.remaining = round(clamp(deposits.timber.remaining + district.ecology.vegetation * 0.009, 0, 100), 2);
    });
  }

  function resetQuarter(supply) {
    GOOD_ORDER.forEach(function (id) { var item = supply.inventory[id]; item.lastProduced = 0; item.lastConsumed = 0; item.lastShortfall = 0; });
    supply.market = { demand: {}, supplied: {}, shortages: [], salesRevenue: 0, explanation: '' };
    supply.lastEnterpriseEvent = null;
  }

  function enterpriseSpec(type) { return ENTERPRISES[type] || null; }
  function utilizationForInputs(state, inputs) {
    var ratios = Object.keys(inputs || {}).map(function (id) { return available(state, id) / Math.max(0.0001, inputs[id]); });
    return ratios.length ? clamp(Math.min.apply(Math, ratios), 0, 1) : 1;
  }

  function operateExtractor(state, enterprise, spec, context, transactions, sectorCosts) {
    var depositEntry = ensure(state).deposits[enterprise.districtId] && ensure(state).deposits[enterprise.districtId][spec.deposit];
    if (!depositEntry || depositEntry.quality < 4 || depositEntry.remaining < 0.5) return { utilization: 0, produced: {}, consumed: {}, revenue: 0, inputCost: 0, reason: 'The local deposit cannot support useful output.' };
    var energyFactor = spec.energy ? context.energyFactor : 1, waterFactor = spec.water ? context.waterFactor : 1;
    var utilization = clamp(Math.min(energyFactor, waterFactor, depositEntry.remaining / 20), 0, 1);
    var potential = spec.rate * (0.35 + depositEntry.quality / 155) * utilization;
    var produced = addStock(state, spec.output, potential, 'enterprise:' + enterprise.id, spec.label + ' extraction recipe/v1', transactions);
    var depletion = produced * (depositEntry.renewable ? 0.34 : 0.82);
    depositEntry.remaining = round(clamp(depositEntry.remaining - depletion, 0, 100), 2);
    sectorCosts[spec.sector] += round(produced * priceOf(state, spec.output) * 0.18, 3);
    return { utilization: round(potential ? produced / potential : 0, 3), produced: (function () { var out = {}; out[spec.output] = produced; return out; })(), consumed: {}, revenue: 0, inputCost: round(produced * priceOf(state, spec.output) * 0.18, 3), reason: produced ? 'Output followed the local deposit, ecological condition and utility availability.' : 'Storage is full, so extraction paused.' };
  }

  function operateProcessor(state, enterprise, spec, context, transactions, sectorCosts) {
    var utility = clamp(Math.min(spec.energy ? context.energyFactor : 1, spec.water ? context.waterFactor : 1), 0, 1);
    var inputFit = utilizationForInputs(state, spec.inputs), outputFit = Math.min.apply(Math, Object.keys(spec.outputs).map(function (id) { return (ensure(state).inventory[id].capacity - available(state, id)) / Math.max(0.0001, spec.outputs[id]); }));
    var batches = clamp(Math.min(1, utility, inputFit, outputFit), 0, 1);
    var consumed = {}, produced = {}, inputCost = 0;
    Object.keys(spec.inputs).sort().forEach(function (id) {
      var quantity = takeStock(state, id, spec.inputs[id] * batches, 'enterprise:' + enterprise.id, spec.label + ' recipe/v1', transactions, 'PROCESS_INPUT');
      consumed[id] = quantity; inputCost += quantity * priceOf(state, id);
    });
    Object.keys(spec.outputs).sort().forEach(function (id) { produced[id] = addStock(state, id, spec.outputs[id] * batches, 'enterprise:' + enterprise.id, spec.label + ' recipe/v1', transactions); });
    sectorCosts[spec.sector] += round(inputCost, 3);
    return { utilization: round(batches, 3), produced: produced, consumed: consumed, revenue: 0, inputCost: round(inputCost, 3), reason: batches < 0.05 ? 'The workshop idled because inputs, utilities or storage were missing.' : batches < 0.75 ? 'The workshop ran below capacity because a real input or utility constrained it.' : 'The workshop ran near its current one-quarter recipe capacity.' };
  }

  function operateEnterprises(state, context, transactions) {
    var supply = ensure(state), sectorCosts = { agriculture: 0, industry: 0, commerce: 0, entertainment: 0 }, changes = [];
    supply.enterprises.slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).forEach(function (enterprise) {
      var spec = enterpriseSpec(enterprise.type), result;
      if (!spec || enterprise.lifecycle === 'CLOSED') return;
      if (EXTRACTORS[enterprise.type]) result = operateExtractor(state, enterprise, spec, context, transactions, sectorCosts);
      else if (PROCESSORS[enterprise.type]) result = operateProcessor(state, enterprise, spec, context, transactions, sectorCosts);
      else result = { utilization: 1, produced: {}, consumed: {}, revenue: 0, inputCost: 0, reason: 'The shop opened as a distribution channel.' };
      enterprise.lastQuarter = result;
      if (result.utilization < 0.05) {
        enterprise.idleQuarters += 1; enterprise.lifecycle = enterprise.idleQuarters >= 2 ? 'IDLE' : 'ACTIVE';
      } else { enterprise.idleQuarters = 0; enterprise.lifecycle = 'ACTIVE'; }
      if (enterprise.lifecycle === 'IDLE') changes.push({ type: 'ENTERPRISE_IDLED', enterpriseId: enterprise.id, label: enterprise.label, districtId: enterprise.districtId, reason: result.reason });
    });
    return { costs: sectorCosts, changes: changes };
  }

  function retailDemand(state, context, transactions) {
    var supply = ensure(state), population = sum(state.districts.map(function (district) { return district.population; }));
    var markets = sum(state.districts.map(function (district) { return district.services.MARKET; }));
    var retailHalls = supply.enterprises.filter(function (enterprise) { return enterprise.type === 'RETAIL_HALL' && enterprise.lifecycle !== 'CLOSED'; }).length;
    var kitchens = supply.enterprises.filter(function (enterprise) { return enterprise.type === 'ISLAND_KITCHEN' && enterprise.lifecycle !== 'CLOSED'; }).length;
    var channelCapacity = 4 + markets * 8 + retailHalls * 7 + kitchens * 4 + state.roads.length * 1.4;
    var remainingChannel = channelCapacity;
    var salesRevenue = 0, sectorGross = { agriculture: 0, industry: 0, commerce: 0, entertainment: 0 };
    Object.keys(DEMAND_PER_PERSON).sort().forEach(function (id) {
      var visitorDemand = (id === 'fish' || id === 'preservedFood' || id === 'consumerGoods') ? Number(context.visitors || 0) * 0.025 : 0;
      var demand = round(population * DEMAND_PER_PERSON[id] + visitorDemand, 3);
      var requested = Math.min(demand, remainingChannel), supplied = takeStock(state, id, requested, 'households-and-visitors', 'Retail demand/v1', transactions, 'RETAIL_SALE');
      remainingChannel = Math.max(0, remainingChannel - supplied);
      var shortfall = round(Math.max(0, demand - supplied), 3), revenue = round(supplied * priceOf(state, id), 3);
      supply.market.demand[id] = demand; supply.market.supplied[id] = supplied; supply.inventory[id].lastShortfall = shortfall;
      if (shortfall > 0.01) supply.market.shortages.push({ good: id, label: GOODS[id].label, demanded: demand, supplied: supplied, shortfall: shortfall });
      salesRevenue += revenue;
      var producerShare = revenue * 0.78, retailShare = revenue * 0.22;
      if (GOODS[id].stage === 'RAW') sectorGross.agriculture += producerShare;
      else sectorGross.industry += producerShare;
      var kitchenShare = (id === 'fish' || id === 'preservedFood' || id === 'crops') && kitchens ? retailShare * 0.55 : 0;
      sectorGross.entertainment += kitchenShare; sectorGross.commerce += retailShare - kitchenShare;
    });
    supply.market.salesRevenue = round(salesRevenue, 3);
    supply.market.explanation = supply.market.shortages.length ? supply.market.shortages.length + ' product lines had unfilled orders; shops can now attract suppliers or substitutes.' : 'Stores covered the modeled household and visitor orders this quarter.';
    Object.keys(sectorGross).forEach(function (id) { sectorGross[id] = round(sectorGross[id], 3); });
    return sectorGross;
  }

  function outputGoods(spec) { return spec.outputs ? Object.keys(spec.outputs) : spec.output ? [spec.output] : []; }
  function depositFit(state, districtId, spec) {
    if (!spec.deposit) return 50;
    var entry = ensure(state).deposits[districtId] && ensure(state).deposits[districtId][spec.deposit];
    return entry ? clamp(entry.quality * 0.62 + entry.remaining * 0.38, 0, 100) : 0;
  }
  function inputFitScore(state, spec) {
    var names = Object.keys(spec.inputs || spec.startupGoods || {});
    if (!names.length) return 68;
    return clamp(sum(names.map(function (id) { var need = (spec.inputs || spec.startupGoods)[id]; return Math.min(1, available(state, id) / Math.max(0.01, need * 3)); })) / names.length * 100, 0, 100);
  }
  function demandScore(state, spec) {
    var outputs = outputGoods(spec);
    if (!outputs.length) {
      if (spec.sector === 'commerce') return clamp(35 + ensure(state).market.shortages.length * 11, 0, 100);
      if (spec.sector === 'entertainment') return clamp(state.districts.filter(function (d) { return d.zone === 'ENTERTAINMENT'; }).length * 32, 20, 90);
      return 40;
    }
    return clamp(sum(outputs.map(function (id) {
      var item = ensure(state).inventory[id], shortage = item.lastShortfall || 0;
      return clamp((item.price / item.referencePrice - 0.7) * 65 + shortage * 12, 0, 100);
    })) / outputs.length, 0, 100);
  }
  function logisticsScore(state, districtId) {
    var districtRoads = state.roads.filter(function (road) { return road.fromDistrictId === districtId || road.toDistrictId === districtId; }).length;
    var district = districtById(state, districtId), markets = district ? district.services.MARKET : 0;
    return clamp(35 + districtRoads * 18 + markets * 22, 0, 100);
  }

  function candidateEnterprises(state) {
    var supply = ensure(state), candidates = [];
    state.districts.slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).forEach(function (district) {
      Object.keys(ENTERPRISES).sort().forEach(function (type) {
        var spec = ENTERPRISES[type];
        if (spec.zones.indexOf(district.zone) < 0) return;
        var same = supply.enterprises.filter(function (enterprise) { return enterprise.type === type && enterprise.districtId === district.id && enterprise.lifecycle !== 'CLOSED'; }).length;
        if (same >= 2) return;
        var supplyFit = spec.deposit ? depositFit(state, district.id, spec) : inputFitScore(state, spec);
        var demand = demandScore(state, spec), logistics = logisticsScore(state, district.id);
        var workforce = state.economy && state.economy.labor ? clamp((1 - state.economy.labor.unemploymentRate) * 45 + state.economy.labor.unemploymentRate * 95, 20, 100) : 60;
        var ecology = spec.deposit === 'fish' || spec.deposit === 'timber' || spec.deposit === 'crops' ? clamp(district.ecology.biodiversity * 0.55 + district.ecology.vegetation * 0.25 + (100 - district.ecology.pollution) * 0.2, 0, 100) : clamp(70 - district.ecology.pollution * 0.25, 20, 90);
        var variation = hashUnit(state.worldSeed + '|' + state.turn + '|' + district.id + '|' + type) * 5;
        var scoreComponents = {
          demandProfit: round(demand * 0.25, 3),
          inputSupply: round(supplyFit * 0.25, 3),
          logistics: round(logistics * 0.15, 3),
          workforce: round(workforce * 0.1, 3),
          zoneAffinity: 10,
          terrainEcology: round(ecology * 0.1, 3),
          founderVariation: round(variation, 3)
        };
        var score = round(sum(Object.keys(scoreComponents).map(function (id) { return scoreComponents[id]; })), 3);
        var startupMissing = Object.keys(spec.startupGoods || {}).filter(function (id) { return available(state, id) + 0.0001 < spec.startupGoods[id]; });
        candidates.push({ id: 'enterprise-candidate-t' + state.turn + '-' + district.id + '-' + type.toLowerCase(), type: type, label: spec.label, districtId: district.id, zone: district.zone, score: score, scoreComponents: scoreComponents, startupCapital: spec.startupCapital, startupGoods: clone(spec.startupGoods || {}), affordable: supply.finance.businessCapital >= spec.startupCapital && !startupMissing.length, refusalReasons: (supply.finance.businessCapital < spec.startupCapital ? ['INSUFFICIENT_PRIVATE_CAPITAL'] : []).concat(startupMissing.map(function (id) { return 'MISSING_STARTUP_' + id.toUpperCase(); })) });
      });
    });
    candidates.sort(function (a, b) { return b.score - a.score || a.id.localeCompare(b.id); });
    return candidates;
  }

  function emergeEnterprise(state, transactions) {
    var supply = ensure(state);
    if (supply.enterprises.length >= 24) return { candidate: null, enterprise: null, reason: 'ENTERPRISE_CAP_REACHED' };
    var candidates = candidateEnterprises(state), chosen = null;
    for (var i = 0; i < candidates.length; i += 1) {
      if (candidates[i].score >= 52 && candidates[i].affordable) { chosen = candidates[i]; break; }
    }
    if (!chosen) return { candidate: candidates[0] || null, enterprise: null, reason: candidates.length ? 'NO_CANDIDATE_CLEARED_SCORE_AND_STARTUP_INPUTS' : 'NO_ZONE_COMPATIBLE_CANDIDATE' };
    var spec = ENTERPRISES[chosen.type], transactionIds = [];
    Object.keys(chosen.startupGoods).sort().forEach(function (id) {
      var beforeLength = transactions.length;
      takeStock(state, id, chosen.startupGoods[id], 'enterprise-startup:' + chosen.id, spec.label + ' startup bill/v1', transactions, 'STARTUP_INPUT');
      for (var t = beforeLength; t < transactions.length; t += 1) transactionIds.push(transactions[t].id);
    });
    supply.finance.businessCapital = round(supply.finance.businessCapital - chosen.startupCapital, 3);
    var enterprise = {
      id: 'enterprise-t' + state.turn + '-' + chosen.districtId + '-' + chosen.type.toLowerCase(),
      type: chosen.type, label: chosen.label, sector: spec.sector, districtId: chosen.districtId, createdTurn: state.turn,
      lifecycle: 'ACTIVE', idleQuarters: 0, jobs: spec.jobs,
      lastQuarter: { utilization: 0, produced: {}, consumed: {}, revenue: 0, inputCost: 0, reason: 'Opened after this quarter; production begins next quarter.' },
      cause: { ruleId: 'PRIVATE_ENTERPRISE_EMERGENCE/v1', score: chosen.score, scoreComponents: clone(chosen.scoreComponents), zone: chosen.zone, startupCapital: chosen.startupCapital, startupGoods: clone(chosen.startupGoods), transactionIds: transactionIds, rejectedAlternatives: candidates.slice(0, 5).filter(function (item) { return item.id !== chosen.id; }).map(function (item) { return { id: item.id, type: item.type, score: item.score, affordable: item.affordable, refusalReasons: item.refusalReasons }; }) }
    };
    supply.enterprises.push(enterprise); supply.lastEnterpriseEvent = { type: 'ENTERPRISE_EMERGED', enterpriseId: enterprise.id, label: enterprise.label, districtId: enterprise.districtId, score: chosen.score, scoreComponents: clone(chosen.scoreComponents) };
    return { candidate: chosen, enterprise: enterprise, reason: null };
  }

  function tradeReadiness(state) {
    var supply = ensure(state), lots = [];
    GOOD_ORDER.forEach(function (id) {
      var item = supply.inventory[id], reserve = item.capacity * (item.stage === 'FINISHED' ? 0.25 : 0.38), surplus = round(Math.max(0, item.stock - reserve), 3);
      if (surplus >= 0.5) lots.push({ good: id, label: item.label, quantity: surplus, unit: item.unit, reserve: round(reserve, 3), indicativeValue: round(surplus * item.price, 3), status: 'READY_NOT_EXPORTED' });
    });
    lots.sort(function (a, b) { return b.indicativeValue - a.indicativeValue || a.good.localeCompare(b.good); });
    supply.tradeReadiness = { lots: lots, totalValue: round(sum(lots.map(function (lot) { return lot.indicativeValue; })), 3), explanation: lots.length ? lots.length + ' typed surplus lots are ready for a later trade route; none left the island automatically.' : 'No product sits above its protected commercial reserve.' };
    return supply.tradeReadiness;
  }

  function headline(supply) {
    if (supply.lastEnterpriseEvent) return supply.lastEnterpriseEvent.label + ' opened after discovering that demand is more persuasive than a decree.';
    if (supply.market.shortages.length) {
      var first = supply.market.shortages.slice().sort(function (a, b) { return b.shortfall - a.shortfall || a.good.localeCompare(b.good); })[0];
      return first.label + ' is scarce. The Palace has formed a committee to glare at the empty shelf.';
    }
    var fullest = GOOD_ORDER.slice().sort(function (a, b) { return supply.inventory[b].stock / supply.inventory[b].capacity - supply.inventory[a].stock / supply.inventory[a].capacity || a.localeCompare(b); })[0];
    if (fullest === 'lumber') return 'Lumber is cheap, Presidente. Apparently trees have unionized into furniture.';
    if (fullest === 'bricks') return 'The brick store is full. Even the pigeons are considering masonry.';
    return supply.market.explanation || 'Goods moved, shops opened, and the treasury has been reminded that private money remains private.';
  }

  function advance(state, context) {
    var supply = ensure(state), input = context || {}, transactions = [];
    resetQuarter(supply); refreshDeposits(state); recalculatePrices(state);
    var operations = operateEnterprises(state, { energyFactor: clamp(input.energyFactor == null ? 1 : input.energyFactor, 0, 1), waterFactor: clamp(input.waterFactor == null ? 1 : input.waterFactor, 0, 1) }, transactions);
    recalculatePrices(state);
    var sectorGross = retailDemand(state, { visitors: input.visitors || 0 }, transactions);
    recalculatePrices(state);
    var emergence = emergeEnterprise(state, transactions);
    var revenue = supply.market.salesRevenue, operatingCost = sum(Object.keys(operations.costs).map(function (id) { return operations.costs[id]; })) + supply.enterprises.filter(function (enterprise) { return enterprise.lifecycle !== 'CLOSED'; }).length * 0.22;
    var profit = round(revenue - operatingCost, 3);
    supply.finance.lastProfit = profit;
    supply.finance.businessCapital = round(clamp(supply.finance.businessCapital + profit * 0.44, 0, 500), 3);
    supply.finance.cumulativePrivateSales = round(supply.finance.cumulativePrivateSales + revenue, 3);
    tradeReadiness(state);
    supply.casualHeadline = headline(supply);
    supply.priceHistory.push({ turn: state.turn, index: supply.priceIndex, prices: GOOD_ORDER.reduce(function (out, id) { out[id] = supply.inventory[id].price; return out; }, {}) });
    supply.quarterHistory.push({ turn: state.turn, sectorGross: clone(sectorGross), sectorInputCosts: clone(operations.costs), privateSales: revenue, privateProfit: profit, shortages: clone(supply.market.shortages), enterpriseEvent: clone(supply.lastEnterpriseEvent), transactionIds: transactions.map(function (entry) { return entry.id; }) });
    if (supply.priceHistory.length > 24) supply.priceHistory.shift();
    if (supply.quarterHistory.length > 24) supply.quarterHistory.shift();
    return {
      sectorGross: sectorGross,
      sectorInputCosts: operations.costs,
      privateSales: revenue,
      privateProfit: profit,
      shortages: clone(supply.market.shortages),
      transactions: clone(transactions),
      changes: operations.changes.concat(supply.lastEnterpriseEvent ? [clone(supply.lastEnterpriseEvent)] : []),
      enterpriseEvent: clone(supply.lastEnterpriseEvent),
      tradeReadiness: clone(supply.tradeReadiness),
      casualHeadline: supply.casualHeadline,
      warnings: supply.market.shortages.slice(0, 3).map(function (item) { return item.label + ' shortfall ' + item.shortfall; })
    };
  }

  function constructionSignals(state, bill) {
    var supply = ensure(state), goodsBill = clone(bill || {}), missing = [], lines = [], value = 0;
    Object.keys(goodsBill).sort().forEach(function (id) {
      var quantity = goodsBill[id], item = supply.inventory[id];
      if (!item) { missing.push(id); return; }
      var availableQuantity = item.stock, lineValue = quantity * item.price; value += lineValue;
      if (availableQuantity + 0.0001 < quantity) missing.push(id);
      lines.push({ good: id, label: item.label, quantity: quantity, available: availableQuantity, unit: item.unit, unitPrice: item.price, value: round(lineValue, 3), sufficient: availableQuantity + 0.0001 >= quantity });
    });
    return { affordable: !missing.length, missing: missing, lines: lines, marketValue: round(value, 3), note: missing.length ? 'Specific commercial inputs are scarce; the civic material reserve alone cannot name a substitute.' : 'Specific inputs are visible in the private supply ledger; public approval and civic stock remain separate gates.' };
  }

  function consumeConstruction(state, bill, destination, cause) {
    var signals = constructionSignals(state, bill), transactions = [];
    if (!signals.affordable) return { ok: false, errors: ['missing typed construction inputs: ' + signals.missing.join(', ')], transactions: [] };
    Object.keys(bill || {}).sort().forEach(function (id) {
      takeStock(state, id, Number(bill[id]), destination || 'civic-construction', cause || 'CIVIC_CONSTRUCTION_BILL/v1', transactions, 'CIVIC_CONSTRUCTION_INPUT');
    });
    state.supply.finance.businessCapital = round(clamp(state.supply.finance.businessCapital + signals.marketValue * 0.8, 0, 500), 3);
    recalculatePrices(state);
    return { ok: true, errors: [], transactions: transactions, signals: signals };
  }

  function summary(state) {
    var supply = ensure(state), active = supply.enterprises.filter(function (enterprise) { return enterprise.lifecycle === 'ACTIVE'; }).length;
    return { priceIndex: supply.priceIndex, activeEnterprises: active, idleEnterprises: supply.enterprises.filter(function (enterprise) { return enterprise.lifecycle === 'IDLE'; }).length, businessCapital: supply.finance.businessCapital, privateSales: supply.market.salesRevenue, privateProfit: supply.finance.lastProfit, shortages: clone(supply.market.shortages), tradeReadyLots: supply.tradeReadiness.lots.length, tradeReadyValue: supply.tradeReadiness.totalValue, headline: supply.casualHeadline };
  }

  function validate(state) {
    var supply = state.supply, errors = [];
    if (!supply || supply.schema !== SCHEMA || supply.version !== VERSION) return { ok: false, errors: ['island goods v0.1 state required'] };
    GOOD_ORDER.forEach(function (id) {
      var item = supply.inventory && supply.inventory[id];
      if (!item || !Number.isFinite(item.stock) || item.stock < 0 || item.stock > item.capacity || !Number.isFinite(item.price) || item.price <= 0) errors.push('invalid goods inventory ' + id);
    });
    state.districts.forEach(function (district) {
      var table = supply.deposits && supply.deposits[district.id];
      ['crops', 'fish', 'timber', 'clay', 'stone', 'ore'].forEach(function (id) { var item = table && table[id]; if (!item || !Number.isFinite(item.quality) || !Number.isFinite(item.remaining) || item.quality < 0 || item.quality > 100 || item.remaining < 0 || item.remaining > 100) errors.push('invalid deposit ' + district.id + ':' + id); });
    });
    var seen = {};
    (supply.enterprises || []).forEach(function (enterprise) { if (seen[enterprise.id]) errors.push('duplicate enterprise ' + enterprise.id); seen[enterprise.id] = true; if (!ENTERPRISES[enterprise.type]) errors.push('unknown enterprise type ' + enterprise.type); if (!districtById(state, enterprise.districtId)) errors.push('enterprise district missing ' + enterprise.id); });
    if (!supply.finance || !Number.isFinite(supply.finance.businessCapital) || supply.finance.businessCapital < 0) errors.push('invalid private finance');
    if (!Array.isArray(supply.ledger) || supply.ledger.length > 600 || !Array.isArray(supply.priceHistory) || supply.priceHistory.length > 24 || !Array.isArray(supply.quarterHistory) || supply.quarterHistory.length > 24) errors.push('goods histories are missing or unbounded');
    if (!supply.boundaries || supply.boundaries.privateInventorySeparateFromTreasury !== true || supply.boundaries.externalTradeNotConnected !== true || supply.boundaries.zoneIsPermissionNotBlueprint !== true) errors.push('goods boundaries were weakened');
    Canonical.validateFinite(supply, '$.supply', errors);
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    GOOD_ORDER: GOOD_ORDER,
    GOODS: clone(GOODS),
    ENTERPRISES: clone(ENTERPRISES),
    initialize: initialize,
    ensure: ensure,
    recalculatePrices: recalculatePrices,
    candidateEnterprises: candidateEnterprises,
    constructionSignals: constructionSignals,
    consumeConstruction: consumeConstruction,
    advance: advance,
    summary: summary,
    validate: validate
  };
});
