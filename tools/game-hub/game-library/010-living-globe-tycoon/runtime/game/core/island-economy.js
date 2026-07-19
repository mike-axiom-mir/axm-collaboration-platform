(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical,
    typeof module === 'object' && module.exports ? require('./island-goods') : root.AXMIslandGoods
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMIslandEconomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical, Goods) {
  'use strict';

  var VERSION = '0.4.0';
  var PRICE_ORDER = ['food', 'water', 'energy', 'materials', 'housing', 'leisure'];
  var SECTOR_ORDER = ['agriculture', 'industry', 'entertainment', 'commerce', 'publicServices'];
  var REFERENCE_PRICES = { food: 0.68, water: 0.18, energy: 0.42, materials: 0.85, housing: 1.15, leisure: 1.55 };
  var TAX_POLICY = {
    householdIncome: 0.06,
    businessProfit: 0.14,
    sales: 0.04,
    entertainmentReceipts: 0.10,
    exportDuty: 0.05,
    publicIndustryShare: 0.32,
    publicEntertainmentShare: 0.16
  };
  var SERVICE_SPECS = {
    HOUSING: { label: 'housing block', materials: 5, energy: 1, water: 0, attention: 1, labor: 6, equipment: 1.5, permit: 0.6, goodsBill: { lumber: 1.8, bricks: 1.3, tools: 0.2 }, why: 'Simple local construction; its form follows whether lumber or masonry is actually available.' },
    CLINIC: { label: 'clinic', materials: 4, energy: 2, water: 0, attention: 2, labor: 7, equipment: 6.5, permit: 1.0, goodsBill: { bricks: 1.3, lumber: 0.7, metalParts: 0.45, machinery: 0.12 }, why: 'A modest shell with specific metalwork and equipment as well as skilled installation.' },
    SCHOOL: { label: 'school', materials: 4, energy: 1, water: 0, attention: 2, labor: 6, equipment: 3.8, permit: 0.9, goodsBill: { bricks: 1.2, lumber: 1, furniture: 0.45, tools: 0.12 }, why: 'Classrooms need a shell, furniture and tools rather than anonymous material alone.' },
    MARKET: { label: 'market hall', materials: 2, energy: 1, water: 0, attention: 1, labor: 4, equipment: 1.4, permit: 0.5, goodsBill: { lumber: 0.7, bricks: 0.35, metalParts: 0.18, tools: 0.1 }, why: 'A light structure whose stalls and fittings depend on visible local goods.' },
    WATER_WORKS: { label: 'water works', materials: 5, energy: 2, water: 0, attention: 2, labor: 6, equipment: 4.8, permit: 1.0, goodsBill: { bricks: 1.1, metalParts: 0.8, machinery: 0.2, constructionKits: 0.45 }, why: 'Pumps, pipes and foundations require specific industrial products.' },
    SOLAR_COOP: { label: 'solar co-op', materials: 3, energy: 1, water: 0, attention: 2, labor: 5, equipment: 7.0, permit: 0.8, goodsBill: { metalParts: 0.75, machinery: 0.25, constructionKits: 0.45 }, why: 'Frames, wiring and power equipment are a small but specific capital-goods bill.' },
    FARM: { label: 'farm mosaic', materials: 2, energy: 0, water: 3, attention: 1, labor: 3, equipment: 1.6, permit: 0.4, goodsBill: { tools: 0.4, lumber: 0.35 }, why: 'A farm needs prepared ground, water, tools and a little lumber.' }
  };

  function clone(value) { return Canonical.clone(value); }
  function round(value, digits) { return Canonical.round(value, digits == null ? 3 : digits); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function sum(values) { return values.reduce(function (total, value) { return total + value; }, 0); }
  function average(values) { return values.length ? sum(values) / values.length : 0; }
  function byId(items, id) { return (items || []).filter(function (item) { return item.id === id; })[0] || null; }

  function emptySector(label) {
    return { label: label, jobsCapacity: 0, employed: 0, grossRevenue: 0, wageBill: 0, inputCosts: 0, operatingProfit: 0, treasuryContribution: 0, outputNote: 'No quarter recorded.' };
  }

  function initialize(state) {
    state.resources.funds.capacity = Math.max(state.resources.funds.capacity, 1000);
    state.economy = {
      schema: 'axm.living-world.island-economy/v0.4',
      version: VERSION,
      currency: { name: 'civic credit', symbol: '¤', note: 'Gameplay currency; not pegged to a real currency.' },
      prices: {},
      consumerPriceIndex: 100,
      labor: { laborForce: 0, jobsCapacity: 0, formalJobsCapacity: 0, localLivelihoodCapacity: 0, employed: 0, formalEmployed: 0, localLivelihoodEmployed: 0, unemploymentRate: 0, wagePerWorker: 1.05, productivity: 0.8, explanation: 'No quarter recorded.' },
      sectors: {
        agriculture: emptySector('Farms and food'),
        industry: emptySector('Industry and exports'),
        entertainment: emptySector('Entertainment and visitors'),
        commerce: emptySector('Markets and local trade'),
        publicServices: emptySector('Public services')
      },
      trade: { materialExports: 0, exportPrice: 0, exportRevenue: 0, reserveTarget: 0, explanation: 'No quarter recorded.' },
      households: { wageIncome: 0, localLivelihoodIncome: 0, essentialSpending: 0, leisureSpending: 0, taxes: 0, retainedIncome: 0 },
      treasury: {
        openingFunds: state.resources.funds.stock,
        income: { householdIncomeTax: 0, salesTax: 0, industryProfitTax: 0, industryDividend: 0, entertainmentTax: 0, entertainmentConcession: 0, commerceFees: 0, exportDuty: 0, total: 0 },
        expenses: { publicPayroll: 0, serviceOperations: 0, roadMaintenance: 0, ecologicalProtection: 0, total: 0 },
        produced: 0,
        consumed: 0,
        net: 0,
        closingFunds: state.resources.funds.stock,
        explanation: ['No economic quarter has advanced yet.']
      },
      constructionAssumptions: {
        localInventoryNotDoubleCharged: true,
        typedCommercialInputsRequired: true,
        note: 'Civic materials, water and energy are public stocks. A separate typed bill is consumed from private island supply; funds pay labor, equipment, site work, permits and contingency. Private sales never become treasury cash.'
      },
      goodsMarket: Goods.summary(state),
      priceHistory: [],
      ledger: []
    };
    recalculatePrices(state);
    recalculateLabor(state);
    return state.economy;
  }

  function ensure(state) {
    if (!state.economy) initialize(state);
    return state.economy;
  }

  function stockRatio(state, id) {
    var resource = state.resources[id];
    return resource ? clamp(resource.stock / Math.max(1, resource.capacity), 0, 1) : 0.55;
  }

  function priceEntry(state, id) {
    var reference = REFERENCE_PRICES[id];
    var ratio;
    if (id === 'housing') {
      var population = sum(state.districts.map(function (district) { return district.population; }));
      var capacity = sum(state.districts.map(function (district) { return district.housingCapacity; }));
      ratio = clamp((capacity - population) / Math.max(1, capacity), 0, 1);
      var housingScarcity = clamp(1.2 - ratio * 1.15, 0.78, 1.55);
      return { label: 'Quarterly housing cost', reference: reference, current: round(reference * housingScarcity, 3), scarcity: round(housingScarcity, 3), stockRatio: round(ratio, 3), explanation: housingScarcity > 1.08 ? 'Limited vacant housing is raising rents.' : 'Available housing is containing rents.' };
    }
    if (id === 'leisure') {
      var entertainmentZones = state.districts.filter(function (district) { return district.zone === 'ENTERTAINMENT'; }).length;
      var leisureFactor = clamp(1 + entertainmentZones * 0.03 + (stockRatio(state, 'energy') < 0.25 ? 0.12 : 0), 0.8, 1.35);
      return { label: 'Leisure visit', reference: reference, current: round(reference * leisureFactor, 3), scarcity: round(leisureFactor, 3), stockRatio: null, explanation: entertainmentZones ? 'Venues set the going leisure price.' : 'Few formal venues keep paid leisure limited.' };
    }
    ratio = stockRatio(state, id);
    var scarcity = clamp(1 + (0.55 - ratio) * 1.25, 0.62, 1.72);
    var energyCoupling = id === 'materials' || id === 'food' ? 1 + Math.max(0, 0.4 - stockRatio(state, 'energy')) * 0.35 : 1;
    var goodsCoupling = 1;
    if (state.supply && (id === 'materials' || id === 'food')) {
      var ids = id === 'food' ? ['crops', 'fish', 'preservedFood'] : ['lumber', 'bricks', 'metalParts', 'tools', 'constructionKits'];
      goodsCoupling = average(ids.map(function (good) { return state.supply.inventory[good].price / state.supply.inventory[good].referencePrice; }));
      goodsCoupling = clamp(0.62 + goodsCoupling * 0.38, 0.72, 1.55);
    }
    var current = round(reference * scarcity * energyCoupling * goodsCoupling, 3);
    return {
      label: { food: 'Food basket', water: 'Water unit', energy: 'Energy unit', materials: 'Material bundle' }[id],
      reference: reference,
      current: current,
      scarcity: round(scarcity, 3),
      stockRatio: round(ratio, 3),
      explanation: ratio < 0.35 ? 'Low public reserves are raising the price.' : goodsCoupling > 1.08 ? 'Specific shop and factory inputs are expensive even though the aggregate reserve may look adequate.' : ratio > 0.72 ? 'Healthy reserves and available product mixes are lowering the price.' : 'Public reserves and typed market supply are near the planning range.'
    };
  }

  function recalculatePrices(state) {
    var economy = ensure(state);
    PRICE_ORDER.forEach(function (id) { economy.prices[id] = priceEntry(state, id); });
    var weights = { food: 0.32, water: 0.10, energy: 0.15, materials: 0.08, housing: 0.25, leisure: 0.10 };
    economy.consumerPriceIndex = round(sum(PRICE_ORDER.map(function (id) { return economy.prices[id].current / economy.prices[id].reference * weights[id]; })) * 100, 2);
    return economy.prices;
  }

  function recalculateLabor(state) {
    var economy = ensure(state), districts = state.districts;
    var population = sum(districts.map(function (district) { return district.population; }));
    var health = average(districts.map(function (district) { return district.people.health; }));
    var education = average(districts.map(function (district) { return district.people.education; }));
    var farms = sum(districts.map(function (district) { return district.services.FARM; }));
    var markets = sum(districts.map(function (district) { return district.services.MARKET; }));
    var industryZones = districts.filter(function (district) { return district.zone === 'INDUSTRY'; }).length;
    var entertainmentZones = districts.filter(function (district) { return district.zone === 'ENTERTAINMENT'; }).length;
    var publicCapacity = sum(districts.map(function (district) {
      return district.services.CLINIC * 2.5 + district.services.SCHOOL * 2.2 + district.services.WATER_WORKS * 1.8 + district.services.SOLAR_COOP * 1.2 + district.services.HOUSING * 0.2;
    }));
    var enterpriseJobs = { agriculture: 0, industry: 0, entertainment: 0, commerce: 0, publicServices: 0 };
    if (state.supply) state.supply.enterprises.forEach(function (enterprise) {
      if (enterprise.lifecycle !== 'CLOSED') enterpriseJobs[enterprise.sector] = Number(enterpriseJobs[enterprise.sector] || 0) + Number(enterprise.jobs || 0);
    });
    var capacities = {
      agriculture: farms * 3 + enterpriseJobs.agriculture,
      industry: industryZones * 1.5 + enterpriseJobs.industry,
      entertainment: entertainmentZones * 1.8 + markets * 0.4 + enterpriseJobs.entertainment,
      commerce: markets * 1.5 + enterpriseJobs.commerce,
      publicServices: publicCapacity
    };
    var laborForce = Math.max(0, Math.round(population * 0.61));
    var formalJobsCapacity = sum(SECTOR_ORDER.map(function (id) { return capacities[id]; }));
    var localLivelihoodCapacity = population * 0.32;
    var formalEmployed = Math.min(laborForce, formalJobsCapacity);
    var localLivelihoodEmployed = Math.min(localLivelihoodCapacity, Math.max(0, laborForce - formalEmployed));
    var employedTotal = formalEmployed + localLivelihoodEmployed;
    var jobsCapacity = formalJobsCapacity + localLivelihoodCapacity;
    var productivity = clamp(0.55 + health * 0.0022 + education * 0.0023, 0.55, 1.05);
    var tightness = laborForce ? employedTotal / laborForce : 0;
    var wage = round(clamp(0.88 + tightness * 0.34 + (productivity - 0.75) * 0.22, 0.82, 1.55), 3);
    SECTOR_ORDER.forEach(function (id) {
      var share = formalJobsCapacity ? capacities[id] / formalJobsCapacity : 0;
      var employed = Math.min(capacities[id], formalEmployed * share);
      economy.sectors[id].jobsCapacity = round(capacities[id], 2);
      economy.sectors[id].employed = round(employed, 2);
    });
    economy.labor = {
      laborForce: laborForce,
      jobsCapacity: round(jobsCapacity, 2),
      formalJobsCapacity: round(formalJobsCapacity, 2),
      localLivelihoodCapacity: round(localLivelihoodCapacity, 2),
      employed: round(employedTotal, 2),
      formalEmployed: round(formalEmployed, 2),
      localLivelihoodEmployed: round(localLivelihoodEmployed, 2),
      unemploymentRate: round(laborForce ? clamp(1 - employedTotal / laborForce, 0, 1) : 0, 3),
      wagePerWorker: wage,
      productivity: round(productivity, 3),
      explanation: employedTotal < laborForce ? 'Formal jobs plus local fishing, repair, care and household livelihoods do not yet employ everyone.' : 'Formal employers and local livelihoods are competing for the available labor force.'
    };
    return economy.labor;
  }

  function constructionSpec(state, operation) {
    var payload = operation.payload || {};
    if (operation.type === 'PROPOSE_SERVICE') return clone(SERVICE_SPECS[payload.service] || {});
    if (operation.type === 'PROPOSE_ROAD') return { label: 'district road', materials: 6, energy: 2, water: 0, attention: 2, labor: 7, equipment: 2.8, permit: 0.8, goodsBill: { stone: 1.3, bricks: 1.1, tools: 0.2, constructionKits: 0.55 }, why: 'Roads require stone, drainage pieces, tools and site kits as well as surveying and crews.' };
    if (operation.type === 'PROPOSE_ECO_BUFFER') return { label: 'ecological buffer', materials: 1, energy: 0, water: 0, attention: 1, labor: 2.5, equipment: 0.5, permit: 0.5, goodsBill: { lumber: 0.15, tools: 0.08 }, why: 'Protection needs little construction stock; field tools, markers and habitat repair carry the cost.' };
    return { label: 'district direction review', materials: 0, energy: 0, water: 0, attention: 1, labor: 1.2, equipment: 0, permit: 0.8, goodsBill: {}, why: 'Changing direction is planning work, not instant construction.' };
  }

  function siteFactor(state, operation) {
    var payload = operation.payload || {}, districts = [];
    if (payload.districtId) districts.push(byId(state.districts, payload.districtId));
    if (payload.fromDistrictId) districts.push(byId(state.districts, payload.fromDistrictId));
    if (payload.toDistrictId) districts.push(byId(state.districts, payload.toDistrictId));
    districts = districts.filter(Boolean);
    var elevation = average(districts.map(function (district) { return Math.max(0, district.elevation); }));
    var erosion = average(districts.map(function (district) { return district.soil.erosion; }));
    var wet = districts.filter(function (district) { return district.waterAdjacency; }).length > 0;
    return round(clamp(0.45 + elevation * 0.8 + erosion * 0.018 + (wet && operation.type === 'PROPOSE_ROAD' ? 0.7 : 0), 0.35, 2.8), 3);
  }

  function estimateConstruction(state, operation) {
    ensure(state); recalculatePrices(state); recalculateLabor(state);
    var spec = constructionSpec(state, operation);
    if (!spec.label) return { ok: false, errors: ['construction specification not found'], costs: {}, breakdown: [], why: [] };
    var wage = state.economy.labor.wagePerWorker;
    var site = siteFactor(state, operation);
    var goodsSignals = Goods.constructionSignals(state, spec.goodsBill || {});
    var laborCost = spec.labor * wage;
    var equipmentIndex = clamp(0.72 + (state.economy.prices.energy.current / REFERENCE_PRICES.energy) * 0.16 + (state.economy.prices.materials.current / REFERENCE_PRICES.materials) * 0.12, 0.82, 1.3);
    var equipmentCost = round(spec.equipment * equipmentIndex, 3);
    var permitCost = spec.permit;
    var procurementCost = goodsSignals.marketValue;
    var subtotal = laborCost + equipmentCost + permitCost + site + procurementCost;
    var contingency = subtotal * 0.08;
    var funds = round(subtotal + contingency, 2);
    var costs = { funds: funds, attention: spec.attention };
    if (spec.materials) costs.materials = spec.materials;
    if (spec.energy) costs.energy = spec.energy;
    if (spec.water) costs.water = spec.water;
    var breakdown = [];
    if (spec.materials) breakdown.push({ component: 'Local material inventory', quantity: spec.materials, unit: 'material bundles', unitPrice: state.economy.prices.materials.current, value: round(spec.materials * state.economy.prices.materials.current, 2), paidAs: 'materials stock' });
    if (spec.energy) breakdown.push({ component: 'Setup energy', quantity: spec.energy, unit: 'energy units', unitPrice: state.economy.prices.energy.current, value: round(spec.energy * state.economy.prices.energy.current, 2), paidAs: 'energy stock' });
    if (spec.water) breakdown.push({ component: 'Establishment water', quantity: spec.water, unit: 'water units', unitPrice: state.economy.prices.water.current, value: round(spec.water * state.economy.prices.water.current, 2), paidAs: 'water stock' });
    goodsSignals.lines.forEach(function (line) { breakdown.push({ component: line.label, quantity: line.quantity, available: line.available, unit: line.unit, unitPrice: line.unitPrice, value: line.value, paidAs: 'funds', physicalSource: 'typed private supply', sufficient: line.sufficient }); });
    breakdown.push({ component: 'Local crews', quantity: spec.labor, unit: 'crew-quarters', unitPrice: wage, value: round(laborCost, 2), paidAs: 'funds' });
    if (equipmentCost) breakdown.push({ component: 'Equipment and fixtures', quantity: 1, unit: 'price-linked package', unitPrice: equipmentCost, value: equipmentCost, paidAs: 'funds', priceIndex: round(equipmentIndex, 3) });
    breakdown.push({ component: 'Site preparation', quantity: 1, unit: 'site factor', unitPrice: site, value: site, paidAs: 'funds' });
    breakdown.push({ component: 'Permits and design', quantity: 1, unit: 'review package', unitPrice: permitCost, value: permitCost, paidAs: 'funds' });
    breakdown.push({ component: 'Contingency', quantity: 0.08, unit: 'financial subtotal', unitPrice: round(subtotal, 2), value: round(contingency, 2), paidAs: 'funds' });
    return {
      ok: true,
      errors: [],
      label: spec.label,
      costs: costs,
      goodsBill: clone(spec.goodsBill || {}),
      goodsSignals: goodsSignals,
      breakdown: breakdown,
      why: [spec.why, goodsSignals.note, 'Public physical stocks and typed commercial inputs are deducted separately; neither private sales nor inventory value is booked as palace cash.', 'Cash follows the current wage, energy/material-linked equipment package, site conditions, permits and an 8% contingency.'],
      assumptions: clone(state.economy.constructionAssumptions)
    };
  }

  function sectorResult(entry, gross, wageBill, inputs, treasury, note) {
    entry.grossRevenue = round(gross, 3);
    entry.wageBill = round(wageBill, 3);
    entry.inputCosts = round(inputs, 3);
    entry.operatingProfit = round(gross - wageBill - inputs, 3);
    entry.treasuryContribution = round(treasury, 3);
    entry.outputNote = note;
  }

  function advance(state, context) {
    var economy = ensure(state), input = context || {};
    var goodsResult = input.goods || { sectorGross: {}, sectorInputCosts: {}, privateSales: 0, privateProfit: 0, shortages: [], tradeReadiness: { lots: [], totalValue: 0, explanation: 'Typed trade ledger unavailable.' } };
    recalculatePrices(state); recalculateLabor(state);
    var prices = economy.prices, labor = economy.labor, sectors = economy.sectors;
    var districts = state.districts;
    var farms = sum(districts.map(function (district) { return district.services.FARM; }));
    var markets = sum(districts.map(function (district) { return district.services.MARKET; }));
    var industryZones = districts.filter(function (district) { return district.zone === 'INDUSTRY'; }).length;
    var entertainmentZones = districts.filter(function (district) { return district.zone === 'ENTERTAINMENT'; }).length;
    var natureZones = districts.filter(function (district) { return district.zone === 'NATURE'; }).length;
    var meanHealth = average(districts.map(function (district) { return district.people.health; }));
    var meanBiodiversity = average(districts.map(function (district) { return district.ecology.biodiversity; }));
    var meanPollution = average(districts.map(function (district) { return district.ecology.pollution; }));
    var physicalProduced = input.produced || {};
    var productionPotential = input.productionPotential || physicalProduced;
    var materialReserve = state.resources.materials.capacity * 0.42;
    var materialSurplus = Math.max(0, state.resources.materials.stock - materialReserve);
    var docksOpen = !!(state.society && state.society.activeEdicts || []).filter(function (edict) { return edict.id === 'OPEN_DOCKS_WEEK'; })[0];
    var exportLimit = (productionPotential.materials || 0) * (docksOpen ? 0.72 : 0.42) + Math.max(0, industryZones - 1) * 0.8;
    var exports = round(Math.min(materialSurplus, exportLimit), 3);
    var materialBeforeExport = state.resources.materials.stock;
    state.resources.materials.stock = round(Math.max(0, materialBeforeExport - exports), 3);
    var exportPrice = round(prices.materials.current * (docksOpen ? 1.78 : 1.62), 3);
    var exportRevenue = round(exports * exportPrice, 3);

    var seasonFactor = state.calendar.season === 'SUMMER' ? 1.18 : state.calendar.season === 'WINTER' ? 0.78 : 1;
    var accessFactor = clamp(0.82 + state.roads.length * 0.08 + markets * 0.04, 0.72, 1.35);
    var appeal = clamp((meanHealth * 0.25 + meanBiodiversity * 0.35 + Math.max(0, 100 - meanPollution) * 0.25 + natureZones * 4) / 75, 0.42, 1.45);
    var visitors = round(entertainmentZones * 4.2 * seasonFactor * accessFactor * appeal + markets * 0.35, 2);
    var visitorGross = visitors * prices.leisure.current;
    var agricultureGross = Number(goodsResult.sectorGross.agriculture || 0) + (physicalProduced.food || 0) * prices.food.current * 0.22;
    var marketedMaterialOutput = Math.max(physicalProduced.materials || 0, exports);
    var industryGross = Number(goodsResult.sectorGross.industry || 0) + marketedMaterialOutput * prices.materials.current * 0.38 + exportRevenue;
    var localLivelihoodIncome = labor.localLivelihoodEmployed * labor.wagePerWorker * 0.68;
    var householdLaborIncome = sum(SECTOR_ORDER.map(function (id) { return sectors[id].employed; })) * labor.wagePerWorker + localLivelihoodIncome;
    var essentialSpending = Math.min(householdLaborIncome * 0.58, sum(districts.map(function (district) { return district.population; })) * prices.food.current * 0.25 + sum(districts.map(function (district) { return district.population; })) * prices.housing.current * 0.12);
    var leisureSpending = Math.min(householdLaborIncome * 0.14, entertainmentZones * prices.leisure.current * 2.5);
    var entertainmentGross = visitorGross + leisureSpending + Number(goodsResult.sectorGross.entertainment || 0);
    var commerceGross = Number(goodsResult.sectorGross.commerce || 0) + markets * 0.45;

    var agWages = sectors.agriculture.employed * labor.wagePerWorker + localLivelihoodIncome * 0.28;
    var industryWages = sectors.industry.employed * labor.wagePerWorker;
    var entertainmentWages = sectors.entertainment.employed * labor.wagePerWorker;
    var commerceWages = sectors.commerce.employed * labor.wagePerWorker;
    var publicWages = sectors.publicServices.employed * labor.wagePerWorker;
    var agricultureInputs = farms * (prices.water.current * 1.2 + prices.energy.current * 0.25) + Number(goodsResult.sectorInputCosts.agriculture || 0);
    var industryInputs = industryZones * prices.energy.current * 0.45 + Number(goodsResult.sectorInputCosts.industry || 0);
    var entertainmentInputs = entertainmentZones * prices.energy.current * 0.7 + visitors * 0.05 + Number(goodsResult.sectorInputCosts.entertainment || 0);
    var commerceInputs = markets * prices.energy.current * 0.25 + Number(goodsResult.sectorInputCosts.commerce || 0);
    var industryProfit = industryGross - industryWages - industryInputs;
    var entertainmentProfit = entertainmentGross - entertainmentWages - entertainmentInputs;
    var commerceProfit = commerceGross - commerceWages - commerceInputs;
    var agricultureProfit = agricultureGross - agWages - agricultureInputs;

    var income = {
      householdIncomeTax: householdLaborIncome * TAX_POLICY.householdIncome,
      salesTax: (essentialSpending + leisureSpending) * TAX_POLICY.sales,
      agricultureProfitTax: Math.max(0, agricultureProfit) * TAX_POLICY.businessProfit,
      industryProfitTax: Math.max(0, industryProfit) * TAX_POLICY.businessProfit,
      industryDividend: Math.max(0, industryProfit) * TAX_POLICY.publicIndustryShare,
      entertainmentTax: entertainmentGross * TAX_POLICY.entertainmentReceipts,
      entertainmentConcession: Math.max(0, entertainmentProfit) * TAX_POLICY.publicEntertainmentShare,
      commerceFees: markets * 0.35 + Math.max(0, commerceProfit) * TAX_POLICY.businessProfit,
      exportDuty: exportRevenue * TAX_POLICY.exportDuty
    };
    income.total = sum(Object.keys(income).filter(function (id) { return id !== 'total'; }).map(function (id) { return income[id]; }));
    var buffers = districts.filter(function (district) { return district.ecology.protectedBuffer; }).length;
    var serviceOperations = sum(districts.map(function (district) {
      return district.services.HOUSING * 0.16 + district.services.CLINIC * 1.15 + district.services.SCHOOL * 1.05 + district.services.MARKET * 0.18 + district.services.WATER_WORKS * 0.8 + district.services.SOLAR_COOP * 0.5 + district.services.FARM * 0.12;
    }));
    var expenses = {
      publicPayroll: publicWages,
      serviceOperations: serviceOperations,
      roadMaintenance: state.roads.length * 0.72,
      ecologicalProtection: buffers * 0.45
    };
    expenses.total = sum(Object.keys(expenses).filter(function (id) { return id !== 'total'; }).map(function (id) { return expenses[id]; }));
    var multiplier = input.fundsMultiplier == null ? 1 : input.fundsMultiplier;
    var produced = round(income.total * multiplier, 3), consumed = round(expenses.total, 3);

    sectorResult(sectors.agriculture, agricultureGross, agWages, agricultureInputs, income.agricultureProfitTax, 'Agriculture cash follows crops and fish actually sold through shops, plus a small public-reserve valuation; fertility, water and biodiversity constrain output.');
    sectorResult(sectors.industry, industryGross, industryWages, industryInputs, income.industryProfitTax + income.industryDividend + income.exportDuty, 'Industry cash follows typed goods actually sold, their consumed inputs, and only generic civic material stock safely exported above reserve.');
    sectorResult(sectors.entertainment, entertainmentGross, entertainmentWages, entertainmentInputs, income.entertainmentTax + income.entertainmentConcession, 'Local leisure, kitchens and visitor spending follow venues, stocked food, season, access, health, biodiversity and pollution.');
    sectorResult(sectors.commerce, commerceGross, commerceWages, commerceInputs, income.commerceFees, 'Commerce records the retail margin on products actually supplied; empty shelves create shortages, not imaginary sales.');
    sectorResult(sectors.publicServices, 0, publicWages, serviceOperations, -expenses.total, 'Public services create wellbeing and operating costs rather than fake sales revenue.');

    economy.trade = {
      materialExports: exports,
      exportPrice: exportPrice,
      exportRevenue: exportRevenue,
      reserveTarget: round(materialReserve, 2),
      materialBeforeExport: materialBeforeExport,
      materialAfterExport: state.resources.materials.stock,
      typedReadyLots: clone(goodsResult.tradeReadiness && goodsResult.tradeReadiness.lots || []),
      typedReadyValue: Number(goodsResult.tradeReadiness && goodsResult.tradeReadiness.totalValue || 0),
      externalTypedTradeConnected: false,
      explanation: (exports ? 'Industry sold ' + exports + ' civic material bundles above the protected reserve. ' : 'No civic material stock sat safely above the export reserve. ') + (goodsResult.tradeReadiness && goodsResult.tradeReadiness.explanation || 'No typed product lots were assessed.')
    };
    var householdTaxes = income.householdIncomeTax + income.salesTax;
    economy.households = {
      wageIncome: round(householdLaborIncome, 3),
      localLivelihoodIncome: round(localLivelihoodIncome, 3),
      essentialSpending: round(essentialSpending, 3),
      leisureSpending: round(leisureSpending, 3),
      taxes: round(householdTaxes, 3),
      retainedIncome: round(Math.max(0, householdLaborIncome - essentialSpending - leisureSpending - householdTaxes), 3)
    };
    Object.keys(income).forEach(function (id) { income[id] = round(income[id], 3); });
    Object.keys(expenses).forEach(function (id) { expenses[id] = round(expenses[id], 3); });
    economy.treasury = {
      openingFunds: state.resources.funds.stock,
      income: income,
      expenses: expenses,
      produced: produced,
      consumed: consumed,
      net: round(produced - consumed, 3),
      closingFunds: null,
      explanation: [
        'Industry contributed ' + round(sectors.industry.treasuryContribution, 2) + ' through profit tax, public dividend and export duty.',
        'Entertainment contributed ' + round(sectors.entertainment.treasuryContribution, 2) + ' from visitor receipts and concession share.',
        'Public payroll, services, roads and protected habitats cost ' + round(expenses.total, 2) + '.',
        'Private revenue is not treated as treasury cash; only named taxes, duties and public shares enter funds.'
      ]
    };
    economy.goodsMarket = Goods.summary(state);
    recalculatePrices(state);
    economy.priceHistory.push({ turn: state.turn, cpi: economy.consumerPriceIndex, prices: PRICE_ORDER.reduce(function (result, id) { result[id] = economy.prices[id].current; return result; }, {}) });
    if (economy.priceHistory.length > 24) economy.priceHistory.shift();
    var ledgerEntry = {
      turn: state.turn,
      income: clone(income),
      expenses: clone(expenses),
      net: economy.treasury.net,
      exports: clone(economy.trade),
      visitors: visitors,
      sectorContributions: SECTOR_ORDER.reduce(function (result, id) { result[id] = sectors[id].treasuryContribution; return result; }, {})
    };
    economy.ledger.push(ledgerEntry); if (economy.ledger.length > 24) economy.ledger.shift();
    return { fundsProduced: produced, fundsConsumed: consumed, materialExports: exports, materialBeforeExport: materialBeforeExport, materialAfterExport: state.resources.materials.stock, visitors: visitors, ledger: clone(ledgerEntry), warnings: economy.consumerPriceIndex > 125 ? ['Living costs are high because essential stocks or housing are tight.'] : [] };
  }

  function closeTreasury(state, closingFunds, actualExpenses, actualIncome) {
    var economy = ensure(state);
    var declaredExpenses = economy.treasury.consumed;
    economy.treasury.closingFunds = round(closingFunds, 3);
    if (actualIncome != null) economy.treasury.produced = round(actualIncome, 3);
    if (actualExpenses != null) economy.treasury.consumed = round(actualExpenses, 3);
    economy.treasury.net = round(economy.treasury.produced - economy.treasury.consumed, 3);
    if (economy.ledger.length) economy.ledger[economy.ledger.length - 1].net = economy.treasury.net;
    if (actualIncome != null && actualIncome + 0.0001 < economy.treasury.income.total) economy.treasury.explanation.push('Some assessed income exceeded the local treasury storage ceiling and was not booked.');
    if (actualExpenses != null && actualExpenses + 0.0001 < declaredExpenses) economy.treasury.explanation.push('The treasury could not fund every declared operating expense this quarter.');
    return economy.treasury;
  }

  function summary(state) {
    var economy = ensure(state);
    return {
      consumerPriceIndex: economy.consumerPriceIndex,
      wagePerWorker: economy.labor.wagePerWorker,
      unemploymentRate: economy.labor.unemploymentRate,
      treasuryNet: economy.treasury.net,
      treasuryIncome: economy.treasury.income.total,
      treasuryExpenses: economy.treasury.expenses.total,
      industryContribution: economy.sectors.industry.treasuryContribution,
      entertainmentContribution: economy.sectors.entertainment.treasuryContribution,
      visitors: economy.ledger.length ? economy.ledger[economy.ledger.length - 1].visitors : 0,
      exports: economy.trade.materialExports,
      goods: clone(economy.goodsMarket),
      prices: PRICE_ORDER.reduce(function (result, id) { result[id] = economy.prices[id].current; return result; }, {})
    };
  }

  function validate(state) {
    var errors = [], economy = state.economy;
    if (!economy || economy.schema !== 'axm.living-world.island-economy/v0.4' || economy.version !== VERSION) return { ok: false, errors: ['island economy v0.4 state required'] };
    PRICE_ORDER.forEach(function (id) { var entry = economy.prices[id]; if (!entry || !Number.isFinite(entry.current) || entry.current <= 0 || entry.current > 20) errors.push('invalid economy price ' + id); });
    SECTOR_ORDER.forEach(function (id) { var entry = economy.sectors[id]; if (!entry || !Number.isFinite(entry.grossRevenue) || !Number.isFinite(entry.treasuryContribution)) errors.push('invalid economy sector ' + id); });
    if (!economy.labor || !Number.isFinite(economy.labor.unemploymentRate) || economy.labor.unemploymentRate < 0 || economy.labor.unemploymentRate > 1 || !Number.isFinite(economy.labor.localLivelihoodEmployed)) errors.push('invalid labor state');
    if (!economy.treasury || !Number.isFinite(economy.treasury.net) || !Number.isFinite(economy.treasury.produced) || !Number.isFinite(economy.treasury.consumed)) errors.push('invalid treasury state');
    else {
      var incomeSum = sum(Object.keys(economy.treasury.income).filter(function (id) { return id !== 'total'; }).map(function (id) { return economy.treasury.income[id]; }));
      var expenseSum = sum(Object.keys(economy.treasury.expenses).filter(function (id) { return id !== 'total'; }).map(function (id) { return economy.treasury.expenses[id]; }));
      if (Math.abs(incomeSum - economy.treasury.income.total) > 0.01) errors.push('treasury income components do not sum');
      if (Math.abs(expenseSum - economy.treasury.expenses.total) > 0.01) errors.push('treasury expense components do not sum');
      if (Math.abs(economy.treasury.net - round(economy.treasury.produced - economy.treasury.consumed, 3)) > 0.001) errors.push('treasury net does not conserve funds');
    }
    if (!Array.isArray(economy.priceHistory) || !Array.isArray(economy.ledger)) errors.push('economy histories required');
    else if (economy.priceHistory.length > 24 || economy.ledger.length > 24) errors.push('economy histories exceed their bound');
    if (!economy.goodsMarket || !Number.isFinite(economy.goodsMarket.priceIndex) || !Number.isFinite(economy.goodsMarket.businessCapital)) errors.push('typed goods market summary required');
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    VERSION: VERSION,
    PRICE_ORDER: PRICE_ORDER,
    SECTOR_ORDER: SECTOR_ORDER,
    REFERENCE_PRICES: clone(REFERENCE_PRICES),
    TAX_POLICY: clone(TAX_POLICY),
    SERVICE_SPECS: clone(SERVICE_SPECS),
    initialize: initialize,
    ensure: ensure,
    recalculatePrices: recalculatePrices,
    recalculateLabor: recalculateLabor,
    estimateConstruction: estimateConstruction,
    advance: advance,
    closeTreasury: closeTreasury,
    summary: summary,
    validate: validate
  };
});
