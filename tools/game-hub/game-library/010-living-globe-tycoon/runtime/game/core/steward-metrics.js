(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMStewardMetrics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.1.0';
  var STATE_SCHEMA = 'axm.living-world.steward-metric-history/v0.1';
  var REPORT_SCHEMA = 'axm.living-world.steward-infographic/v0.1';
  var HISTORY_LIMIT = 24;
  var SOURCE_PATHS = Object.freeze({
    foodWeb: 'strategic.ecologyDynamics.foodWebHealth',
    waterQuality: 'strategic.ecologyDynamics.waterQuality',
    biodiversity: 'mean(strategic.districts[].ecology.biodiversity)',
    connectivity: 'strategic.ecologyDynamics.habitatConnectivity',
    invasivePressure: 'strategic.ecologyDynamics.invasivePressure',
    pestPressure: 'strategic.ecologyDynamics.pestPressure',
    approval: 'strategic.society.publicApproval',
    legitimacy: 'strategic.society.legitimacy',
    factionFloor: 'min(strategic.society.factions[].support)',
    unemployment: 'strategic.economy.labor.unemploymentRate',
    election: 'strategic.society.election.quartersUntilElection',
    treasuryNet: 'strategic.economy.treasury.net',
    funds: 'strategic.resources.funds.stock',
    income: 'strategic.economy.treasury.produced',
    expenses: 'strategic.economy.treasury.consumed',
    cpi: 'strategic.economy.consumerPriceIndex',
    visitors: 'strategic.economy.ledger[-1].visitors',
    supplyPrices: 'strategic.supply.priceIndex',
    shortages: 'strategic.supply.market.shortages',
    activeFirms: 'strategic.supply.enterprises[].lifecycle',
    businessCapital: 'strategic.supply.finance.businessCapital',
    tradeLots: 'strategic.supply.tradeReadiness.lots',
    missionProgress: 'mission.active.progress / mission.active.goal',
    timeRemaining: 'mission.active.secondsRemaining | mission.nextMissionIn',
    laurels: 'mission.currency.balance',
    aiSeat: 'players.aiConnection.status',
    twoShores: 'players.cooperativeProject.status'
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function finite(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : (fallback == null ? 0 : fallback); }
  function round(value, digits) { var p = Math.pow(10, digits == null ? 2 : digits); return Math.round(finite(value) * p) / p; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, finite(value))); }
  function mean(values) { return values.length ? values.reduce(function (sum, value) { return sum + finite(value); }, 0) / values.length : 0; }
  function percent(value) { return Math.round(finite(value)) + '%'; }
  function money(value) { var n = round(value, 2); return (n > 0 ? '+¤' : n < 0 ? '−¤' : '¤') + Math.abs(n).toFixed(2).replace(/\.00$/, ''); }
  function words(value) { return String(value || '').replace(/_/g, ' ').toLowerCase(); }
  function resources(state) { return state && state.resources || {}; }
  function ratio(resource) { return resource && finite(resource.capacity) > 0 ? clamp(finite(resource.stock) / finite(resource.capacity), 0, 1) : 0; }

  function strategicValues(state) {
    var districts = state.districts || [], ecology = state.ecologyDynamics || {}, economy = state.economy || {}, supply = state.supply || {};
    var society = state.society || {}, factions = society.factions || {}, ledger = economy.ledger || [];
    var factionValues = Object.keys(factions).map(function (id) { return finite(factions[id].support); });
    var publicStocks = resources(state), enterprises = supply.enterprises || [];
    return {
      foodWeb: round(finite(ecology.foodWebHealth) * 100, 2),
      waterQuality: round(ecology.waterQuality, 2),
      biodiversity: round(mean(districts.map(function (district) { return district.ecology && district.ecology.biodiversity; })), 2),
      connectivity: round(ecology.habitatConnectivity, 2),
      invasivePressure: round(finite(ecology.invasivePressure) * 100, 2),
      pestPressure: round(finite(ecology.pestPressure) * 100, 2),
      approval: round(society.publicApproval, 2),
      legitimacy: round(society.legitimacy, 2),
      factionFloor: round(factionValues.length ? Math.min.apply(Math, factionValues) : 0, 2),
      unemploymentPct: round(finite(economy.labor && economy.labor.unemploymentRate) * 100, 2),
      cpi: round(economy.consumerPriceIndex, 2),
      funds: finite(publicStocks.funds && publicStocks.funds.stock),
      treasuryIncome: finite(economy.treasury && economy.treasury.produced),
      treasuryExpenses: finite(economy.treasury && economy.treasury.consumed),
      treasuryNet: finite(economy.treasury && economy.treasury.net),
      industryContribution: finite(economy.sectors && economy.sectors.industry && economy.sectors.industry.treasuryContribution),
      entertainmentContribution: finite(economy.sectors && economy.sectors.entertainment && economy.sectors.entertainment.treasuryContribution),
      visitors: finite(ledger.length ? ledger[ledger.length - 1].visitors : 0),
      supplyPriceIndex: round(supply.priceIndex, 2),
      shortages: (supply.market && supply.market.shortages || []).length,
      shortfallTotal: round((supply.market && supply.market.shortages || []).reduce(function (sum, entry) { return sum + finite(entry.shortfall); }, 0), 2),
      activeFirms: enterprises.filter(function (firm) { return firm.lifecycle === 'ACTIVE'; }).length,
      idleFirms: enterprises.filter(function (firm) { return firm.lifecycle === 'IDLE'; }).length,
      businessCapital: round(supply.finance && supply.finance.businessCapital, 2),
      waterRatio: round(ratio(publicStocks.water) * 100, 2),
      foodRatio: round(ratio(publicStocks.food) * 100, 2),
      energyRatio: round(ratio(publicStocks.energy) * 100, 2),
      materialsRatio: round(ratio(publicStocks.materials) * 100, 2),
      attentionRatio: round(ratio(publicStocks.attention) * 100, 2)
    };
  }

  function createState() {
    return { schema: STATE_SCHEMA, version: VERSION, records: [], boundaries: { oneRecordPerStrategicRevision: true, reportReadOnly: true, noWallClock: true, noOverallScore: true } };
  }

  function migrate(input) {
    var fresh = createState();
    if (!input || input.schema !== STATE_SCHEMA || input.version !== VERSION || !Array.isArray(input.records)) return fresh;
    var records = input.records.filter(function (record) {
      return record && Number.isInteger(record.revision) && record.revision >= 0 && record.values && typeof record.values === 'object';
    }).map(function (record) {
      return { revision: record.revision, turn: Math.max(0, Math.floor(finite(record.turn))), calendar: clone(record.calendar || {}), values: clone(record.values) };
    }).sort(function (a, b) { return a.revision - b.revision; });
    var unique = [];
    records.forEach(function (record) {
      if (unique.length && unique[unique.length - 1].revision === record.revision) unique[unique.length - 1] = record;
      else unique.push(record);
    });
    fresh.records = unique.slice(-HISTORY_LIMIT);
    return fresh;
  }

  function capture(input, strategicState) {
    var history = migrate(input);
    if (!strategicState || !Number.isInteger(strategicState.revision) || strategicState.revision < 0) return history;
    var record = {
      revision: strategicState.revision,
      turn: Math.max(0, Math.floor(finite(strategicState.turn))),
      calendar: clone(strategicState.calendar || {}),
      values: strategicValues(strategicState)
    };
    var found = false;
    history.records = history.records.map(function (existing) {
      if (existing.revision !== record.revision) return existing;
      found = true; return record;
    });
    if (!found) history.records.push(record);
    history.records.sort(function (a, b) { return a.revision - b.revision; });
    history.records = history.records.slice(-HISTORY_LIMIT);
    return history;
  }

  function trend(history, key, current, polarity) {
    var records = history.records || [], prior = records.length > 1 ? records[records.length - 2] : null;
    if (!prior || !prior.values || !Number.isFinite(Number(prior.values[key]))) return { direction: 'FLAT', delta: 0, display: 'new reading', tone: 'INFO' };
    var delta = round(finite(current) - finite(prior.values[key]), 2);
    if (Math.abs(delta) < 0.005) return { direction: 'FLAT', delta: 0, display: 'steady', tone: 'INFO' };
    var direction = delta > 0 ? 'UP' : 'DOWN', good = polarity === 'HIGH_GOOD' ? delta > 0 : polarity === 'LOW_GOOD' ? delta < 0 : null;
    return { direction: direction, delta: delta, display: (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta), tone: good == null ? 'INFO' : good ? 'GOOD' : 'RISK' };
  }

  function metric(history, options) {
    var item = {
      id: options.id,
      label: options.label,
      value: round(options.value, options.digits == null ? 2 : options.digits),
      display: options.display,
      barValue: round(clamp(options.barValue == null ? options.value : options.barValue, 0, 100), 2),
      polarity: options.polarity || 'CONTEXT',
      status: options.status || 'INFO',
      source: options.source || SOURCE_PATHS[options.id] || 'derived from declared report inputs',
      explanation: options.explanation || ''
    };
    if (options.reference != null) item.reference = options.reference;
    if (options.historyKey) item.trend = trend(history, options.historyKey, options.value, item.polarity);
    if (options.seriesKey) item.series = (history.records || []).map(function (record) { return round(record.values[options.seriesKey], 2); });
    return item;
  }

  function highStatus(value, good, watch) { return value >= good ? 'GOOD' : value >= watch ? 'WATCH' : 'RISK'; }
  function lowStatus(value, good, watch) { return value <= good ? 'GOOD' : value <= watch ? 'WATCH' : 'RISK'; }
  function card(id, icon, title, subtitle, visual, primary, metrics, causes, levers, extra) {
    var result = { id: id, icon: icon, title: title, subtitle: subtitle, visual: visual, primary: primary, metrics: metrics, causes: causes, levers: levers };
    Object.keys(extra || {}).forEach(function (key) { result[key] = extra[key]; });
    return result;
  }

  function buildEcology(history, state, values) {
    var ecology = state.ecologyDynamics || {}, districts = state.districts || [];
    var worstHabitat = Object.keys(state.habitats || {}).map(function (id) { return state.habitats[id]; }).sort(function (a, b) { return finite(a.quality) - finite(b.quality); })[0];
    var causes = [
      'Pollination ' + percent(finite(ecology.pollinationService) * 100) + ' · natural insect control ' + percent(finite(ecology.naturalPestControl) * 100) + ' · seed dispersal ' + percent(finite(ecology.seedDispersalService) * 100) + '.',
      'Shore recycling is ' + percent(finite(ecology.shorelineRecycling) * 100) + '; introduced-species pressure is ' + percent(values.invasivePressure) + '.',
      (worstHabitat ? worstHabitat.label + ' is the weakest habitat at ' + percent(worstHabitat.quality) + '.' : 'No habitat reading is available yet.')
    ];
    return card('ecology', '🌿', 'Living island', 'Food web, habitat and water are separate readings.', 'RING_SPARK',
      metric(history, { id: 'foodWeb', label: 'Food web health', value: values.foodWeb, display: percent(values.foodWeb), barValue: values.foodWeb, polarity: 'HIGH_GOOD', status: highStatus(values.foodWeb, 65, 50), historyKey: 'foodWeb', seriesKey: 'foodWeb', explanation: 'A bounded guild-and-habitat gameplay index; not a wildlife census.' }),
      [
        metric(history, { id: 'waterQuality', label: 'Water quality', value: values.waterQuality, display: percent(values.waterQuality), polarity: 'HIGH_GOOD', status: highStatus(values.waterQuality, 70, 50), historyKey: 'waterQuality', explanation: 'Wetland condition, pollution and rainfall feed this reading.' }),
        metric(history, { id: 'biodiversity', label: 'District biodiversity', value: values.biodiversity, display: percent(values.biodiversity), polarity: 'HIGH_GOOD', status: highStatus(values.biodiversity, 65, 50), historyKey: 'biodiversity', explanation: 'Mean of the six current district biodiversity readings.' }),
        metric(history, { id: 'connectivity', label: 'Habitat links', value: values.connectivity, display: percent(values.connectivity), polarity: 'HIGH_GOOD', status: highStatus(values.connectivity, 65, 45), historyKey: 'connectivity', explanation: 'Connected habitat helps guilds survive disturbances.' }),
        metric(history, { id: 'invasivePressure', label: 'Introduced pressure', value: values.invasivePressure, display: percent(values.invasivePressure), polarity: 'LOW_GOOD', status: lowStatus(values.invasivePressure, 40, 65), historyKey: 'invasivePressure', explanation: 'Lower is better; open-dock and biosecurity choices can move this.' }),
        metric(history, { id: 'pestPressure', label: 'Crop pest pressure', value: values.pestPressure, display: percent(values.pestPressure), polarity: 'LOW_GOOD', status: lowStatus(values.pestPressure, 30, 55), historyKey: 'pestPressure', explanation: 'Predation and habitat condition counter crop pest pressure.' })
      ], causes,
      ['Protect ecological buffers in weak districts.', 'Keep habitat links intact; roads can fragment them.', 'Use explicit biosecurity choices when introduced pressure rises.'],
      { habitatCount: Object.keys(state.habitats || {}).length, guildCount: Object.keys(state.inhabitants || {}).length, districtCount: districts.length });
  }

  function buildPeople(history, state, values) {
    var society = state.society || {}, factions = society.factions || {};
    var factionList = Object.keys(factions).map(function (id) { return factions[id]; }).sort(function (a, b) { return finite(a.support) - finite(b.support) || String(a.id).localeCompare(String(b.id)); });
    var weakest = factionList[0], districts = state.districts || [];
    var health = mean(districts.map(function (district) { return district.people && district.people.health; }));
    var education = mean(districts.map(function (district) { return district.people && district.people.education; }));
    var causes = [
      weakest ? weakest.label + ' is least convinced at ' + percent(weakest.support) + ': ' + weakest.request : 'No faction reading is available.',
      'Employment is ' + percent(100 - values.unemploymentPct) + '; average health is ' + percent(health) + ' and education is ' + percent(education) + '.',
      society.currentDilemma ? 'Open cabinet dilemma: ' + society.currentDilemma.title + '.' : 'No unresolved cabinet dilemma is currently open.'
    ];
    return card('people', '🗣️', 'People & politics', 'Approval is not legitimacy, and no faction speaks for everyone.', 'GAUGE_LIST',
      metric(history, { id: 'approval', label: 'Public approval', value: values.approval, display: percent(values.approval), polarity: 'HIGH_GOOD', status: highStatus(values.approval, 60, 45), historyKey: 'approval', seriesKey: 'approval', explanation: 'Current aggregate approval under the fictional society rules.' }),
      [
        metric(history, { id: 'legitimacy', label: 'Legitimacy', value: values.legitimacy, display: percent(values.legitimacy), polarity: 'HIGH_GOOD', status: highStatus(values.legitimacy, 60, 45), historyKey: 'legitimacy', explanation: 'Political standing is tracked separately from popularity.' }),
        metric(history, { id: 'factionFloor', label: 'Least-supported faction', value: values.factionFloor, display: percent(values.factionFloor), polarity: 'HIGH_GOOD', status: highStatus(values.factionFloor, 55, 40), historyKey: 'factionFloor', explanation: weakest ? weakest.label + ': ' + weakest.request : 'No faction request available.' }),
        metric(history, { id: 'unemployment', label: 'Unemployment', value: values.unemploymentPct, display: percent(values.unemploymentPct), polarity: 'LOW_GOOD', status: lowStatus(values.unemploymentPct, 7, 15), historyKey: 'unemploymentPct', explanation: state.economy && state.economy.labor ? state.economy.labor.explanation : '' }),
        metric(history, { id: 'election', label: 'Election', value: society.election && society.election.quartersUntilElection, display: (society.election ? society.election.quartersUntilElection : 0) + ' quarters', barValue: society.election ? 100 - clamp(society.election.quartersUntilElection / Math.max(1, society.election.cycleQuarters) * 100, 0, 100) : 0, polarity: 'CONTEXT', status: society.election && society.election.quartersUntilElection <= 2 ? 'WATCH' : 'INFO', explanation: 'A weak result changes politics; it does not delete the island.' })
      ], causes,
      ['Read the least-supported faction request before choosing a project.', 'Services and reachable work affect lived conditions.', 'Resolve dilemmas and issue edicts only through explicit Palace choices.'],
      { weakestFaction: weakest ? { id: weakest.id, label: weakest.label, support: weakest.support, request: weakest.request } : null, openDilemma: society.currentDilemma ? { id: society.currentDilemma.id, title: society.currentDilemma.title } : null });
  }

  function sectorFlow(state, id) {
    var sector = state.economy && state.economy.sectors && state.economy.sectors[id] || {};
    return { id: id, label: sector.label || words(id), grossRevenue: finite(sector.grossRevenue), operatingProfit: finite(sector.operatingProfit), treasuryContribution: finite(sector.treasuryContribution) };
  }

  function buildEconomy(history, state, values) {
    var economy = state.economy || {}, treasury = economy.treasury || {}, supply = state.supply || {};
    var flow = { openingFunds: finite(treasury.openingFunds), income: values.treasuryIncome, expenses: values.treasuryExpenses, net: values.treasuryNet, closingFunds: finite(treasury.closingFunds), sectors: ['agriculture','industry','entertainment','commerce','publicServices'].map(function (id) { return sectorFlow(state, id); }) };
    var causes = (treasury.explanation || []).slice(0, 3);
    causes.push('Private product sales ' + money(supply.market && supply.market.salesRevenue) + ' stay with firms; they are not palace income.');
    causes.push('Industry contributes ' + money(values.industryContribution) + ' and entertainment contributes ' + money(values.entertainmentContribution) + ' to public books this quarter.');
    return card('economy', '📒', 'Public books', 'Income, expenses, private sales and prices keep separate ledgers.', 'FLOW',
      metric(history, { id: 'treasuryNet', label: 'Treasury net', value: values.treasuryNet, display: money(values.treasuryNet), barValue: 50 + clamp(values.treasuryNet, -50, 50), polarity: 'HIGH_GOOD', status: values.treasuryNet < 0 ? 'RISK' : values.treasuryNet > 0 ? 'GOOD' : 'INFO', historyKey: 'treasuryNet', seriesKey: 'treasuryNet', explanation: 'Exact recorded public income minus exact recorded public expenses.' }),
      [
        metric(history, { id: 'funds', label: 'Public funds', value: values.funds, display: '¤' + values.funds, barValue: ratio(resources(state).funds) * 100, polarity: 'HIGH_GOOD', status: ratio(resources(state).funds) < 0.1 ? 'RISK' : 'INFO', historyKey: 'funds', explanation: 'Spendable civic reserve; private business capital is separate.' }),
        metric(history, { id: 'income', label: 'Income', value: values.treasuryIncome, display: '¤' + values.treasuryIncome, barValue: values.treasuryIncome ? clamp(values.treasuryIncome / Math.max(values.treasuryIncome, values.treasuryExpenses, 1) * 100, 0, 100) : 0, polarity: 'CONTEXT', status: 'INFO', historyKey: 'treasuryIncome', explanation: 'Taxes, fees, duties and declared public shares.' }),
        metric(history, { id: 'expenses', label: 'Expenses', value: values.treasuryExpenses, display: '¤' + values.treasuryExpenses, barValue: values.treasuryExpenses ? clamp(values.treasuryExpenses / Math.max(values.treasuryIncome, values.treasuryExpenses, 1) * 100, 0, 100) : 0, polarity: 'CONTEXT', status: 'INFO', historyKey: 'treasuryExpenses', explanation: 'Payroll, services, roads and ecological protection.' }),
        metric(history, { id: 'cpi', label: 'Living-cost index', value: values.cpi, display: values.cpi.toFixed(1), barValue: clamp(values.cpi / 1.5, 0, 100), polarity: 'LOW_GOOD', status: lowStatus(values.cpi, 105, 115), historyKey: 'cpi', explanation: '100 is the reference basket; stock and typed product prices move it.' }),
        metric(history, { id: 'visitors', label: 'Visitors', value: values.visitors, display: String(values.visitors), barValue: clamp(values.visitors * 4, 0, 100), polarity: 'CONTEXT', status: 'INFO', historyKey: 'visitors', explanation: 'Recorded in the latest completed strategic quarter.' })
      ], causes,
      ['Inspect named income and expense lines before advancing.', 'Relieve typed shortages to lower product costs.', 'Grow industry or entertainment only where labor, inputs and demand support it.'],
      { flow: flow, privateMarket: { sales: finite(supply.market && supply.market.salesRevenue), businessCapital: values.businessCapital, note: 'Private market money is not public treasury cash.' } });
  }

  function buildSupply(history, state, values) {
    var supply = state.supply || {}, inventory = supply.inventory || {}, publicStocks = resources(state);
    var reserveIds = ['water','food','energy','materials'];
    var reserves = reserveIds.map(function (id) {
      var resource = publicStocks[id] || {}, pct = round(ratio(resource) * 100, 2);
      return { id: id, label: id.charAt(0).toUpperCase() + id.slice(1), stock: round(resource.stock, 2), capacity: round(resource.capacity, 2), unit: resource.unit || 'units', ratio: pct, status: highStatus(pct, 50, 25), source: 'strategic.resources.' + id };
    });
    var goods = Object.keys(inventory).map(function (id) {
      var good = inventory[id], stockRatio = finite(good.capacity) ? finite(good.stock) / finite(good.capacity) : 0, priceRatio = finite(good.referencePrice) ? finite(good.price) / finite(good.referencePrice) : 1;
      return { id: id, label: good.label, stock: round(good.stock, 2), capacity: round(good.capacity, 2), unit: good.unit, stockRatio: round(stockRatio * 100, 2), price: round(good.price, 3), referencePrice: round(good.referencePrice, 3), priceRatio: round(priceRatio, 3), lastShortfall: round(good.lastShortfall, 2) };
    }).sort(function (a, b) { return b.priceRatio - a.priceRatio || a.stockRatio - b.stockRatio || a.id.localeCompare(b.id); });
    var bottleneck = goods[0] || null, shortages = (supply.market && supply.market.shortages || []).slice().sort(function (a, b) { return finite(b.shortfall) - finite(a.shortfall); });
    var causes = [
      bottleneck ? bottleneck.label + ' is the strongest price pressure: ¤' + bottleneck.price + ' versus ¤' + bottleneck.referencePrice + ', with ' + bottleneck.stock + '/' + bottleneck.capacity + ' ' + bottleneck.unit + ' stored.' : 'No typed product inventory is available.',
      shortages.length ? shortages.length + ' typed shortage' + (shortages.length === 1 ? '' : 's') + ' left ' + values.shortfallTotal + ' units of orders unfilled.' : 'No typed orders were left unfilled in the last recorded quarter.',
      (supply.tradeReadiness && supply.tradeReadiness.explanation || 'No trade-readiness reading.') + ' External trade remains disconnected.'
    ];
    return card('supply', '🏭', 'Supply & industry', 'Public reserves and private goods are linked, but never merged.', 'RESERVES',
      metric(history, { id: 'supplyPrices', label: 'Product price index', value: values.supplyPriceIndex, display: values.supplyPriceIndex.toFixed(1), barValue: clamp(values.supplyPriceIndex / 1.7, 0, 100), polarity: 'LOW_GOOD', status: lowStatus(values.supplyPriceIndex, 110, 135), historyKey: 'supplyPriceIndex', seriesKey: 'supplyPriceIndex', explanation: '100 is the named-goods reference basket.' }),
      [
        metric(history, { id: 'shortages', label: 'Typed shortages', value: values.shortages, display: String(values.shortages), barValue: clamp(values.shortages * 18, 0, 100), polarity: 'LOW_GOOD', status: values.shortages === 0 ? 'GOOD' : values.shortages <= 2 ? 'WATCH' : 'RISK', historyKey: 'shortages', explanation: values.shortfallTotal + ' total units unfilled in the last market clearing.' }),
        metric(history, { id: 'activeFirms', label: 'Active firms', value: values.activeFirms, display: String(values.activeFirms), barValue: clamp(values.activeFirms / Math.max(1, values.activeFirms + values.idleFirms) * 100, 0, 100), polarity: 'HIGH_GOOD', status: values.idleFirms > values.activeFirms ? 'RISK' : 'GOOD', historyKey: 'activeFirms', explanation: values.idleFirms + ' idle; closed firms are excluded.' }),
        metric(history, { id: 'businessCapital', label: 'Private capital', value: values.businessCapital, display: '¤' + values.businessCapital, barValue: clamp(values.businessCapital / 2, 0, 100), polarity: 'CONTEXT', status: 'INFO', historyKey: 'businessCapital', explanation: 'Firm money for inputs and emergence; never public treasury cash.' }),
        metric(history, { id: 'tradeLots', label: 'Trade-ready lots', value: supply.tradeReadiness && supply.tradeReadiness.lots && supply.tradeReadiness.lots.length, display: String(supply.tradeReadiness && supply.tradeReadiness.lots && supply.tradeReadiness.lots.length || 0), barValue: clamp((supply.tradeReadiness && supply.tradeReadiness.lots && supply.tradeReadiness.lots.length || 0) * 15, 0, 100), polarity: 'CONTEXT', status: 'INFO', explanation: 'Protected surplus marked READY_NOT_EXPORTED; no buyer or ship is invented.' })
      ], causes,
      ['Relieve the named bottleneck with deposits, inputs, logistics and labor.', 'Keep civic water, food, energy and material reserves above their risk bands.', 'Treat trade-ready lots as evidence for later trade, not automatic revenue.'],
      { publicReserves: reserves, bottleneck: bottleneck, shortages: shortages.slice(0, 5).map(function (entry) { return { good: entry.good, label: entry.label, demanded: round(entry.demanded, 2), supplied: round(entry.supplied, 2), shortfall: round(entry.shortfall, 2) }; }), firms: { active: values.activeFirms, idle: values.idleFirms, closed: (supply.enterprises || []).filter(function (firm) { return firm.lifecycle === 'CLOSED'; }).length }, tradeReadiness: { lots: supply.tradeReadiness && supply.tradeReadiness.lots ? supply.tradeReadiness.lots.length : 0, value: round(supply.tradeReadiness && supply.tradeReadiness.totalValue, 2) } });
  }

  function buildMission(history, state, context) {
    var mission = context.mission || {}, active = mission.active || null, currency = mission.currency || { balance: 0, symbol: '✦' };
    var ai = context.aiConnection || {}, project = context.cooperativeProject || {}, connected = ai.status === 'CONNECTED' || context.aiConnected === true;
    var progressPct = active && finite(active.goal) > 0 ? clamp(finite(active.progress) / finite(active.goal) * 100, 0, 100) : 0;
    var primary = metric(history, { id: 'missionProgress', label: active ? active.label : 'Next palace errand', value: progressPct, display: active ? percent(progressPct) : 'waiting', barValue: progressPct, polarity: 'CONTEXT', status: active && active.secondsRemaining <= 60 && progressPct < 75 ? 'WATCH' : active ? 'INFO' : 'GOOD', explanation: active ? round(active.progress, 1) + '/' + active.goal + ' ' + active.unit + ' with ' + active.secondsRemaining + ' active seconds remaining.' : 'Next mission in ' + Math.max(0, Math.ceil(finite(mission.nextMissionIn))) + ' active seconds.' });
    var causes = active ? [
      (active.cooperative ? 'Co-op goal is locked at mission start; both seats count.' : 'Solo goal is locked at mission start; AI actions do not count.') + ' Reward: ' + currency.symbol + active.reward.amount + '.',
      'Human contribution ' + round(active.contributions && active.contributions.human, 1) + ' · AI contribution ' + round(active.contributions && active.contributions.ai, 1) + '.',
      'Mission time is active-play time only and cannot advance a strategic quarter.'
    ] : [
      'Next errand in ' + Math.max(0, Math.ceil(finite(mission.nextMissionIn))) + ' active seconds; it stays open for five active minutes.',
      'Festival Laurels balance: ' + currency.symbol + ' ' + Math.max(0, Math.floor(finite(currency.balance))) + '. They are ceremonial and have no spend action yet.',
      connected ? 'AI seat is connected and the next mission will start in co-op mode.' : 'AI seat is disconnected; the next mission will start solo unless it connects first.'
    ];
    return card('mission', '🎖️', 'Mission & co-op', 'Both seats see one task, one clock and one evidence trail.', 'MISSION', primary,
      [
        metric(history, { id: 'timeRemaining', label: active ? 'Time left' : 'Next mission', value: active ? active.secondsRemaining : mission.nextMissionIn, display: Math.floor(Math.max(0, finite(active ? active.secondsRemaining : mission.nextMissionIn)) / 60) + ':' + String(Math.ceil(Math.max(0, finite(active ? active.secondsRemaining : mission.nextMissionIn))) % 60).padStart(2, '0'), barValue: active ? clamp(finite(active.secondsRemaining) / 3, 0, 100) : clamp(100 - finite(mission.nextMissionIn) / 6, 0, 100), polarity: 'CONTEXT', status: active && active.secondsRemaining <= 60 ? 'WATCH' : 'INFO', explanation: 'Active-play seconds; strategic time remains untouched.' }),
        metric(history, { id: 'laurels', label: 'Festival Laurels', value: currency.balance, display: currency.symbol + ' ' + Math.max(0, Math.floor(finite(currency.balance))), barValue: clamp(finite(currency.balance) * 10, 0, 100), polarity: 'CONTEXT', status: 'INFO', explanation: 'Separate from treasury, business capital and trade goods.' }),
        metric(history, { id: 'aiSeat', label: 'AI player seat', value: connected ? 1 : 0, display: connected ? 'connected' : 'offline', barValue: connected ? 100 : 0, polarity: 'CONTEXT', status: connected ? 'GOOD' : 'INFO', explanation: connected ? String(ai.label || 'Explicit AI connector') : 'Requires an explicit connector; no autonomous loop is bundled.' }),
        metric(history, { id: 'twoShores', label: 'Two-Shores route', value: project.status === 'COMPLETE' ? 1 : 0, display: words(project.status || 'awaiting both'), barValue: project.status === 'COMPLETE' ? 100 : project.status === 'AWAITING_AI' || project.status === 'AWAITING_HUMAN' ? 50 : 0, polarity: 'CONTEXT', status: project.status === 'COMPLETE' ? 'GOOD' : 'INFO', explanation: 'Each declared player must place its own opposite-shore endpoint.' })
      ], causes,
      ['Complete ordinary walking or tool actions; there is no hidden mission button.', 'Connect the AI before a mission starts to activate the shared ×2 goal and reward.', 'Failure has no penalty; Laurels wait for a later explicit festival or monument rule.'],
      { active: active ? clone(active) : null, nextMissionIn: Math.max(0, Math.ceil(finite(mission.nextMissionIn))), currency: clone(currency), aiConnection: { status: connected ? 'CONNECTED' : 'DISCONNECTED', label: ai.label || null }, cooperativeProject: clone(project), modeLockedAtStart: true, bothSeatsCountWhenCooperative: true, strategicAuthority: false });
  }

  function signal(severity, domain, headline, because, lever, evidence) { return { severity: severity, domain: domain, headline: headline, because: because, lever: lever, evidence: evidence }; }
  function buildSignals(state, values, context) {
    var signals = [], supply = state.supply || {}, society = state.society || {}, factions = society.factions || {};
    ['water','food','energy','materials'].forEach(function (id) {
      var resource = resources(state)[id], pct = ratio(resource) * 100;
      if (resource && pct < 25) signals.push(signal('RISK', 'SUPPLY', id.toUpperCase() + ' reserve is thin', round(resource.stock, 1) + '/' + round(resource.capacity, 1) + ' ' + resource.unit + ' remains.', 'Inspect demand and production before spending more.', { metric: id + 'Ratio', value: round(pct, 2), threshold: 25 }));
    });
    if (values.treasuryNet < 0) signals.push(signal('RISK', 'ECONOMY', 'Public books are shrinking', 'Expenses exceed income by ¤' + Math.abs(values.treasuryNet) + ' this quarter.', 'Inspect the named expense and sector contribution lines.', { metric: 'treasuryNet', value: values.treasuryNet, threshold: 0 }));
    if (values.cpi > 115) signals.push(signal('RISK', 'ECONOMY', 'Living costs are high', 'The basket index is ' + values.cpi + ' against a 100 reference.', 'Relieve the exact reserves and typed product shortages underneath it.', { metric: 'cpi', value: values.cpi, threshold: 115 }));
    else if (values.cpi > 105) signals.push(signal('WATCH', 'ECONOMY', 'Living costs are rising', 'The basket index is ' + values.cpi + ' against a 100 reference.', 'Watch food, housing and named product prices.', { metric: 'cpi', value: values.cpi, threshold: 105 }));
    if (values.shortages > 0) signals.push(signal(values.shortages > 2 ? 'RISK' : 'WATCH', 'SUPPLY', values.shortages + ' typed shortage' + (values.shortages === 1 ? '' : 's'), values.shortfallTotal + ' units of orders were unfilled.', 'Open Supply & industry and act on the named bottleneck.', { metric: 'shortages', value: values.shortages, shortfall: values.shortfallTotal, threshold: 0 }));
    if (values.approval < 45) signals.push(signal('RISK', 'PEOPLE', 'Public approval is fragile', 'Approval is ' + percent(values.approval) + '.', 'Read district gaps and faction requests before the next choice.', { metric: 'approval', value: values.approval, threshold: 45 }));
    if (values.factionFloor < 40) {
      var weakest = Object.keys(factions).map(function (id) { return factions[id]; }).sort(function (a, b) { return a.support - b.support; })[0];
      signals.push(signal('RISK', 'PEOPLE', 'A faction is being left behind', (weakest ? weakest.label + ': ' + weakest.request : 'Lowest support is ') + ' (' + percent(values.factionFloor) + ').', 'Use the request as evidence, not as an automatic order.', { metric: 'factionFloor', value: values.factionFloor, threshold: 40 }));
    }
    if (values.foodWeb < 50) signals.push(signal('RISK', 'ECOLOGY', 'Food web is strained', 'The current bounded health index is ' + percent(values.foodWeb) + '.', 'Protect weak habitat and reduce introduced or pest pressure.', { metric: 'foodWeb', value: values.foodWeb, threshold: 50 }));
    if (values.waterQuality < 50) signals.push(signal('RISK', 'ECOLOGY', 'Water quality is strained', 'The wetland-linked reading is ' + percent(values.waterQuality) + '.', 'Reduce pollution and protect wetland buffers.', { metric: 'waterQuality', value: values.waterQuality, threshold: 50 }));
    if (values.connectivity < 45) signals.push(signal('RISK', 'ECOLOGY', 'Habitat links are fragmented', 'Connectivity is ' + percent(values.connectivity) + '.', 'Prefer buffers and avoid unnecessary road fragmentation.', { metric: 'connectivity', value: values.connectivity, threshold: 45 }));
    if (values.invasivePressure > 70) signals.push(signal('RISK', 'ECOLOGY', 'Introduced pressure is high', 'Introduced pressure is ' + percent(values.invasivePressure) + '.', 'Choose explicit biosecurity when offered; open docks carry risk.', { metric: 'invasivePressure', value: values.invasivePressure, threshold: 70 }));
    if (values.unemploymentPct > 15) signals.push(signal('RISK', 'PEOPLE', 'Too many residents lack work', 'Unemployment is ' + percent(values.unemploymentPct) + '.', 'Support reachable firms and services with real inputs and demand.', { metric: 'unemploymentPct', value: values.unemploymentPct, threshold: 15 }));
    if (society.election && society.election.quartersUntilElection <= 2) signals.push(signal('WATCH', 'PEOPLE', 'Election is close', society.election.quartersUntilElection + ' strategic quarter' + (society.election.quartersUntilElection === 1 ? '' : 's') + ' remain.', 'Read approval, legitimacy and the weakest faction separately.', { metric: 'electionQuarters', value: society.election.quartersUntilElection, threshold: 2 }));
    if (society.currentDilemma) signals.push(signal('WATCH', 'PEOPLE', 'A cabinet dilemma is waiting', society.currentDilemma.title + ' remains unresolved.', 'Open the Palace; no choice is automatic.', { metric: 'currentDilemma', value: society.currentDilemma.id }));
    var active = context.mission && context.mission.active;
    if (active && active.secondsRemaining <= 60 && finite(active.progress) / Math.max(1, finite(active.goal)) < 0.75) signals.push(signal('WATCH', 'MISSION', 'Palace errand is nearly over', active.secondsRemaining + ' seconds remain at ' + round(finite(active.progress) / Math.max(1, finite(active.goal)) * 100, 1) + '% progress.', 'Use the ordinary action named by the mission; failure has no penalty.', { metric: 'missionSeconds', value: active.secondsRemaining, progress: active.progress, goal: active.goal }));
    var rank = { RISK: 0, WATCH: 1, INFO: 2 };
    return signals.sort(function (a, b) { return rank[a.severity] - rank[b.severity] || a.domain.localeCompare(b.domain) || a.headline.localeCompare(b.headline); }).slice(0, 6);
  }

  function buildReport(historyInput, strategicState, contextInput) {
    var history = capture(historyInput, strategicState), context = contextInput || {}, values = strategicValues(strategicState || {});
    var cards = [buildEcology(history, strategicState || {}, values), buildPeople(history, strategicState || {}, values), buildEconomy(history, strategicState || {}, values), buildSupply(history, strategicState || {}, values), buildMission(history, strategicState || {}, context)];
    var report = {
      schema: REPORT_SCHEMA,
      version: VERSION,
      sourceWorldId: strategicState && strategicState.worldId || null,
      sourceRevision: strategicState && strategicState.revision || 0,
      turn: strategicState && strategicState.turn || 0,
      calendar: clone(strategicState && strategicState.calendar || {}),
      noOverallScore: true,
      generatedFrom: ['strategic living-world state', 'walkable mission state', 'declared player-seat state'],
      cards: cards,
      signals: buildSignals(strategicState || {}, values, context),
      quick: cards.map(function (entry) { return { id: entry.id, icon: entry.icon, label: entry.title, value: entry.primary.display, status: entry.primary.status, barValue: entry.primary.barValue }; }),
      historyWindow: { records: history.records.length, limit: HISTORY_LIMIT, firstRevision: history.records.length ? history.records[0].revision : null, lastRevision: history.records.length ? history.records[history.records.length - 1].revision : null },
      limitations: ['No overall island score exists; ecology, people, public books, supply and missions remain separate.', 'Indices and thresholds are transparent fictional gameplay aids, not scientific, financial or policy advice.', 'Reading this report cannot advance strategic time, choose a dilemma, approve a proposal or issue an edict.']
    };
    return report;
  }

  function validate(input) {
    var errors = [], history = input;
    if (!history || history.schema !== STATE_SCHEMA || history.version !== VERSION) return { ok: false, errors: ['metric history schema/version required'] };
    if (!Array.isArray(history.records) || history.records.length > HISTORY_LIMIT) errors.push('metric records must be bounded');
    var previous = -1;
    (history.records || []).forEach(function (record) {
      if (!record || !Number.isInteger(record.revision) || record.revision <= previous || !record.values) errors.push('metric records must have unique ascending revisions');
      previous = record && record.revision;
    });
    if (!history.boundaries || history.boundaries.reportReadOnly !== true || history.boundaries.noWallClock !== true || history.boundaries.noOverallScore !== true) errors.push('metric authority boundaries required');
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    VERSION: VERSION,
    STATE_SCHEMA: STATE_SCHEMA,
    REPORT_SCHEMA: REPORT_SCHEMA,
    HISTORY_LIMIT: HISTORY_LIMIT,
    SOURCE_PATHS: SOURCE_PATHS,
    createState: createState,
    migrate: migrate,
    capture: capture,
    buildReport: buildReport,
    validate: validate
  };
});
