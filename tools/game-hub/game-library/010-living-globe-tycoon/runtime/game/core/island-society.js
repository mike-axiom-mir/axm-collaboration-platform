(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMIslandSociety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var FACTION_ORDER = ['workers', 'merchants', 'ecologists', 'traditionalists', 'scholars'];
  var EDICT_ORDER = ['MANDATORY_SIESTA', 'CONSERVATION_SUNDAY', 'FREE_LUNCH_FOR_ALL', 'OPEN_DOCKS_WEEK', 'PALACE_GARDEN_DECREE', 'PAPERWORK_REDUCTION_COMMISSION'];

  var EDICTS = {
    MANDATORY_SIESTA: {
      label: 'Officially Optional Mandatory Siesta', duration: 2,
      costs: { funds: 6, attention: 1 },
      summary: 'Health and worker support rise; production and merchant patience briefly dip.',
      factionEffects: { workers: 5, merchants: -2, ecologists: 0, traditionalists: 2, scholars: 1 },
      modifiers: { funds: 0.96, materials: 0.96, healthBonus: 4 }
    },
    CONSERVATION_SUNDAY: {
      label: 'Conservation Sunday (Every Day This Sunday)', duration: 3,
      costs: { funds: 3, attention: 2 },
      summary: 'Habitat recovery improves while industrial output slows slightly.',
      factionEffects: { workers: -1, merchants: -3, ecologists: 6, traditionalists: 3, scholars: 2 },
      modifiers: { materials: 0.93, habitatRecovery: 3, invasiveControl: 0.08 }
    },
    FREE_LUNCH_FOR_ALL: {
      label: 'Free Lunch, Including the Committee', duration: 1,
      costs: { food: 12, funds: 5, attention: 1 },
      summary: 'Food access and worker support rise immediately. Lunch remains subject to chewing.',
      factionEffects: { workers: 6, merchants: -1, ecologists: 0, traditionalists: 3, scholars: 2 },
      modifiers: { healthBonus: 3 }
    },
    OPEN_DOCKS_WEEK: {
      label: 'Open Docks, Open Ledgers, Open Questions', duration: 3,
      costs: { attention: 2 },
      summary: 'Trade income and materials rise, alongside pollution and invasive-species risk.',
      factionEffects: { workers: 1, merchants: 6, ecologists: -5, traditionalists: -2, scholars: 0 },
      modifiers: { funds: 1.16, materials: 1.12, pollutionBonus: 2.5, invasiveBoost: 0.12 }
    },
    PALACE_GARDEN_DECREE: {
      label: 'Palace Garden for National Pollinator Morale', duration: 4,
      costs: { materials: 8, funds: 10, attention: 2 },
      summary: 'Flower habitat and pollinators improve. The palace takes full credit for photosynthesis.',
      factionEffects: { workers: 0, merchants: -1, ecologists: 5, traditionalists: 3, scholars: 2 },
      modifiers: { pollinatorBoost: 0.12, habitatRecovery: 1.5 }
    },
    PAPERWORK_REDUCTION_COMMISSION: {
      label: 'Commission to Reduce Paperwork Commissions', duration: 4,
      costs: { funds: 6, attention: 2 },
      summary: 'Future civic attention recovers faster after an entirely reasonable quantity of forms.',
      factionEffects: { workers: 1, merchants: 3, ecologists: 0, traditionalists: 0, scholars: 3 },
      modifiers: { attentionProduction: 1.5 }
    }
  };

  var DILEMMA_TEMPLATES = {
    FISH_PETITION: {
      title: 'The Fish Have Filed a Petition',
      briefing: 'The lake is unwell. The petition is damp, unsigned, and nevertheless persuasive.',
      choices: [
        { id: 'REST_THE_LAKE', label: 'Declare a fishing rest', summary: 'Spend attention and let fish recover.', effects: { resources: { attention: -2, funds: -3 }, species: { fish: 2 }, factions: { ecologists: 4, traditionalists: 2, merchants: -1 } } },
        { id: 'MORE_REEDS', label: 'Fund reed habitat', summary: 'Repair the wetland edge and improve fish capacity.', effects: { resources: { materials: -3, funds: -6, attention: -1 }, habitats: { WETLAND_EDGE: 6 }, factions: { ecologists: 5, scholars: 2 } } },
        { id: 'FISH_MINISTER', label: 'Appoint a Minister of Fish', summary: 'Create excellent minutes and modest actual recovery.', effects: { resources: { funds: -3, attention: -1 }, species: { fish: 0.5 }, factions: { scholars: 2, workers: 1 } } }
      ]
    },
    MANGO_SURPLUS: {
      title: 'The Great Fruit Surplus',
      briefing: 'Warehouses are full. The cabinet has eaten three samples and reached no conclusion.',
      choices: [
        { id: 'NATIONAL_FEAST', label: 'Hold a national feast', summary: 'Spend food and funds for health and broad support.', effects: { resources: { food: -15, funds: -4 }, factions: { workers: 4, traditionalists: 4, merchants: 1 }, peopleHealth: 3 } },
        { id: 'EXPORT_CRATES', label: 'Export the best crates', summary: 'Trade food for funds; merchants approve loudly.', effects: { resources: { food: -12, funds: 17 }, factions: { merchants: 5, workers: -1, ecologists: -1 } } },
        { id: 'PRESERVE_PANTRY', label: 'Expand the public pantry', summary: 'Spend attention to increase safe food storage.', effects: { resources: { food: -8, attention: -1 }, capacities: { food: 10 }, factions: { workers: 3, scholars: 2 } } }
      ]
    },
    INVASIVE_GUESTS: {
      title: 'Uninvited Guests at the Docks',
      briefing: 'Introduced predators have discovered that customs forms are optional if one is sufficiently small.',
      choices: [
        { id: 'BIOSECURITY', label: 'Fund humane biosecurity', summary: 'Reduce invasive pressure with inspections and habitat-safe control.', effects: { resources: { funds: -8, attention: -3 }, species: { invasivePredators: -1.2 }, factions: { ecologists: 5, scholars: 3, merchants: -2 } } },
        { id: 'ADAPT_AND_MONITOR', label: 'Monitor before acting', summary: 'Cheaper now, but native species keep carrying the risk.', effects: { resources: { attention: -1 }, factions: { scholars: 2, ecologists: -2, merchants: 1 } } },
        { id: 'NEW_MASCOT', label: 'Declare them the port mascot', summary: 'Tourism paperwork improves; ecology does not.', effects: { resources: { funds: 5 }, species: { invasivePredators: 0.4, nativeRodents: -0.4 }, factions: { merchants: 3, ecologists: -5 } } }
      ]
    },
    ELECTION_SPEECH: {
      title: 'The Balcony Microphone Is On',
      briefing: 'An election approaches. The speechwriter requests one promise and immunity from follow-up questions.',
      choices: [
        { id: 'PROMISE_HOUSING', label: 'Promise more housing', summary: 'Workers respond now; the promise is checked in three quarters.', effects: { resources: { attention: -1 }, factions: { workers: 4 }, promise: 'HOUSING' } },
        { id: 'PROMISE_CLEAN_WATER', label: 'Promise clean water', summary: 'Environmental and traditional blocs respond; evidence is checked later.', effects: { resources: { attention: -1 }, factions: { ecologists: 3, traditionalists: 3, scholars: 1 }, promise: 'CLEAN_WATER' } },
        { id: 'PROMISE_NOTHING', label: 'Promise only another speech', summary: 'A daring commitment to procedural honesty.', effects: { factions: { scholars: 2, workers: -2, merchants: -1 } } }
      ]
    },
    RAIN_WITHOUT_PERMIT: {
      title: 'Rain Falls Without a Permit',
      briefing: 'The storm is real. The Ministry of Sunshine maintains that reality is outside its jurisdiction.',
      choices: [
        { id: 'UMBRELLAS', label: 'Issue public umbrellas', summary: 'Spend materials and funds to protect health.', effects: { resources: { materials: -4, funds: -4 }, peopleHealth: 2, factions: { workers: 3, traditionalists: 1 } } },
        { id: 'OFFICIAL_SUNSHINE', label: 'Declare official sunshine', summary: 'Cheap, funny, and visibly contradicted by the weather.', effects: { resources: { attention: -1 }, factions: { scholars: -4, merchants: 1 } } },
        { id: 'WETLAND_WORKS', label: 'Let the wetland do its job', summary: 'Fund buffers that absorb runoff and shelter wildlife.', effects: { resources: { funds: -6, attention: -2 }, habitats: { WETLAND_EDGE: 5 }, factions: { ecologists: 4, scholars: 2 } } }
      ]
    },
    TREASURY_AUDIT: {
      title: 'The Treasury Has Misplaced a Decimal',
      briefing: 'Funds are low. The comptroller insists the missing money may simply be standing sideways.',
      choices: [
        { id: 'FAIR_AUDIT', label: 'Run a transparent audit', summary: 'Spend attention, recover some funds, and earn scholar trust.', effects: { resources: { attention: -2, funds: 8 }, factions: { scholars: 4, merchants: -1, workers: 1 } } },
        { id: 'TOURISM_POSTER', label: 'Print a very confident poster', summary: 'Spend a little now for merchant enthusiasm and uncertain returns.', effects: { resources: { funds: -3, attention: -1 }, factions: { merchants: 4, ecologists: -1 }, temporaryEdict: 'TOURISM_POSTER' } },
        { id: 'COUNT_AGAIN', label: 'Count the treasury again', summary: 'Recover two credits from under the calculator.', effects: { resources: { attention: -1, funds: 2 }, factions: { scholars: -1, workers: 1 } } }
      ]
    },
    POLLINATOR_PAPERWORK: {
      title: 'Butterflies Ignore the Flight Plan',
      briefing: 'Pollinators continue crossing district lines without permits, improving crops and undermining administrative confidence.',
      choices: [
        { id: 'FLOWER_CORRIDORS', label: 'Plant flower corridors', summary: 'Spend modest resources to improve pollinators and connectivity.', effects: { resources: { funds: -5, materials: -2, attention: -1 }, species: { pollinators: 3 }, habitats: { MEADOW: 4, FARM_MOSAIC: 3 }, factions: { ecologists: 4, traditionalists: 2 } } },
        { id: 'STAMP_TINY_FORMS', label: 'Print smaller forms', summary: 'Excellent bureaucracy; negligible ecology.', effects: { resources: { funds: -2, attention: -1 }, factions: { scholars: 1, merchants: 1 } } },
        { id: 'LET_THEM_WORK', label: 'Let the butterflies work', summary: 'No cost and no theatrical intervention.', effects: { factions: { workers: 1, ecologists: 1 } } }
      ]
    }
  };

  function clone(value) { return Canonical.clone(value); }
  function round(value, digits) { return Canonical.round(value, digits == null ? 3 : digits); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function sum(values) { return values.reduce(function (total, value) { return total + value; }, 0); }
  function average(values) { return values.length ? sum(values) / values.length : 0; }

  function faction(id, label, support, concern) {
    return { id: id, label: label, support: support, trend: 0, concern: concern, request: 'No current request.' };
  }

  function initialize(state) {
    state.society = {
      cabinet: [
        { id: 'chief-paperwork', name: 'Chief Pilar Paperwork', office: 'Office of Offices', specialty: 'Turns emergencies into numbered forms.' },
        { id: 'doctor-ibis', name: 'Dr. Basil Ibis', office: 'Ministry of Living Things', specialty: 'Counts frogs before approving speeches.' },
        { id: 'comptroller-ledger', name: 'Comptroller Coco Ledger', office: 'Treasury of Almost Exact Numbers', specialty: 'Can find a deficit in any celebration.' },
        { id: 'captain-tide', name: 'Captain Mira Tide', office: 'Ports and Questionable Crates', specialty: 'Knows what entered the island and what pretended not to.' }
      ],
      factions: {
        workers: faction('workers', 'Workers’ Assembly', 56, 'Housing, food, health and jobs.'),
        merchants: faction('merchants', 'Market Guild', 52, 'Trade, funds, roads and reliable energy.'),
        ecologists: faction('ecologists', 'Living Island League', 58, 'Habitat, clean water, native species and low pollution.'),
        traditionalists: faction('traditionalists', 'Island Traditions Council', 55, 'Farms, food security, local places and restraint.'),
        scholars: faction('scholars', 'Academy of Useful Questions', 54, 'Schools, clinics, evidence and transparent receipts.')
      },
      publicApproval: 55,
      legitimacy: 60,
      election: { cycleQuarters: 8, quartersUntilElection: 6, lastResult: null, electionsHeld: 0 },
      activeEdicts: [],
      promises: [],
      currentDilemma: null,
      dilemmaHistory: [],
      headlines: [{ turn: 0, text: 'PALACE OPENS NEW DEPARTMENT TO DETERMINE WHETHER THE PALACE IS OPEN' }],
      lastCabinetLine: 'Chief Pilar Paperwork: “Welcome, Presidente. The world is alive and the forms are already breeding.”',
      lastFactionChanges: [],
      oneDilemmaPerQuarter: true
    };
    updateRequests(state);
    return state;
  }

  function ensure(state) { if (!state.society) initialize(state); return state.society; }
  function activeEdict(state, id) { return ensure(state).activeEdicts.filter(function (entry) { return entry.id === id && entry.remainingQuarters > 0; })[0] || null; }

  function modifiers(state) {
    var result = {
      resourceMultipliers: { water: 1, food: 1, energy: 1, materials: 1, funds: 1, attention: 1 },
      healthBonus: 0, habitatRecovery: 0, pollinatorBoost: 0, pollutionBonus: 0, invasiveBoost: 0, invasiveControl: 0, attentionProduction: 0
    };
    ensure(state).activeEdicts.forEach(function (active) {
      var definition = EDICTS[active.id];
      if (!definition && active.id === 'TOURISM_POSTER') { result.resourceMultipliers.funds *= 1.1; result.pollutionBonus += 0.8; return; }
      if (!definition) return;
      var m = definition.modifiers || {};
      ['water','food','energy','materials','funds','attention'].forEach(function (name) { if (m[name] != null) result.resourceMultipliers[name] *= m[name]; });
      ['healthBonus','habitatRecovery','pollinatorBoost','pollutionBonus','invasiveBoost','invasiveControl','attentionProduction'].forEach(function (name) { result[name] += Number(m[name] || 0); });
    });
    Object.keys(result.resourceMultipliers).forEach(function (name) { result.resourceMultipliers[name] = round(result.resourceMultipliers[name], 3); });
    return result;
  }

  function previewEdict(state, id) {
    ensure(state);
    var definition = EDICTS[id], errors = [];
    if (!definition) errors.push('unknown edict');
    if (activeEdict(state, id)) errors.push('edict is already active');
    if (definition) Object.keys(definition.costs).forEach(function (name) { if (!state.resources[name] || state.resources[name].stock < definition.costs[name]) errors.push('insufficient ' + name); });
    return definition ? { ok: errors.length === 0, errors: errors, id: id, label: definition.label, duration: definition.duration, costs: clone(definition.costs), summary: definition.summary, factionEffects: clone(definition.factionEffects), applied: false } : { ok: false, errors: errors, applied: false };
  }

  function addHeadline(state, text) {
    var society = ensure(state);
    society.headlines.push({ turn: state.turn, text: String(text).toUpperCase() });
    if (society.headlines.length > 16) society.headlines.shift();
  }

  function adjustFaction(state, id, delta, cause) {
    var entry = ensure(state).factions[id]; if (!entry || !delta) return null;
    var before = entry.support; entry.support = round(clamp(entry.support + delta, 0, 100), 2); entry.trend = round(entry.support - before, 2);
    ensure(state).publicApproval = round(average(FACTION_ORDER.map(function (factionId) { return ensure(state).factions[factionId].support; })), 2);
    return { faction: id, before: before, after: entry.support, delta: entry.trend, cause: cause };
  }

  function spendOrGain(state, deltas) {
    var errors = [];
    Object.keys(deltas || {}).forEach(function (name) { var item = state.resources[name], delta = Number(deltas[name]); if (!item) errors.push('unknown resource ' + name); else if (delta < 0 && item.stock + delta < 0) errors.push('insufficient ' + name); });
    if (errors.length) return { ok: false, errors: errors, changes: [] };
    var changes = [];
    Object.keys(deltas || {}).forEach(function (name) { var item = state.resources[name], before = item.stock; item.stock = round(clamp(item.stock + Number(deltas[name]), 0, item.capacity), 3); changes.push({ resource: name, before: before, after: item.stock, delta: round(item.stock - before, 3) }); });
    return { ok: true, errors: [], changes: changes };
  }

  function issueEdict(state, id) {
    var preview = previewEdict(state, id); if (!preview.ok) return preview;
    var definition = EDICTS[id], deltas = {}; Object.keys(definition.costs).forEach(function (name) { deltas[name] = -definition.costs[name]; });
    var resources = spendOrGain(state, deltas); if (!resources.ok) return resources;
    ensure(state).activeEdicts.push({ id: id, label: definition.label, issuedTurn: state.turn, remainingQuarters: definition.duration });
    var factionChanges = [];
    Object.keys(definition.factionEffects).forEach(function (factionId) { var change = adjustFaction(state, factionId, definition.factionEffects[factionId], 'edict ' + id); if (change) factionChanges.push(change); });
    if (id === 'FREE_LUNCH_FOR_ALL') state.districts.forEach(function (district) { district.people.foodAccess = round(clamp(district.people.foodAccess + 7, 0, 100), 2); });
    if (id === 'PALACE_GARDEN_DECREE' && state.inhabitants) {
      state.inhabitants.pollinators.population = round(clamp(state.inhabitants.pollinators.population + 3, 0, state.inhabitants.pollinators.capacity * 1.1), 2);
    }
    addHeadline(state, definition.label + ' issued; palace assures nation the title is perfectly normal');
    ensure(state).lastCabinetLine = 'Chief Pilar Paperwork: “The edict is active. We have filed the consequences under C for Completely Intended.”';
    return { ok: true, id: id, label: definition.label, resourceChanges: resources.changes, factionChanges: factionChanges, changes: [{ type: 'EDICT_ISSUED', id: id, duration: definition.duration }], warnings: definition.summary ? [definition.summary] : [] };
  }

  function factionEvidence(state) {
    var districts = state.districts;
    var housingGap = sum(districts.map(function (d) { return d.needs.housingGap; }));
    var jobsGap = sum(districts.map(function (d) { return d.needs.jobsGap; }));
    var careGap = sum(districts.map(function (d) { return d.needs.careGap; }));
    var educationGap = sum(districts.map(function (d) { return d.needs.educationGap; }));
    var foodAccess = average(districts.map(function (d) { return d.people.foodAccess; }));
    var waterAccess = average(districts.map(function (d) { return d.people.waterAccess; }));
    var health = average(districts.map(function (d) { return d.people.health; }));
    var education = average(districts.map(function (d) { return d.people.education; }));
    var biodiversity = average(districts.map(function (d) { return d.ecology.biodiversity; }));
    var pollution = average(districts.map(function (d) { return d.ecology.pollution; }));
    var farms = sum(districts.map(function (d) { return d.services.FARM; }));
    var markets = sum(districts.map(function (d) { return d.services.MARKET; }));
    var schools = sum(districts.map(function (d) { return d.services.SCHOOL; }));
    var clinics = sum(districts.map(function (d) { return d.services.CLINIC; }));
    return { housingGap: housingGap, jobsGap: jobsGap, careGap: careGap, educationGap: educationGap, foodAccess: foodAccess, waterAccess: waterAccess, health: health, education: education, biodiversity: biodiversity, pollution: pollution, farms: farms, markets: markets, schools: schools, clinics: clinics, roads: state.roads.length, funds: state.resources.funds.stock, invasive: state.ecologyDynamics ? state.ecologyDynamics.invasivePressure : 0 };
  }

  function updateRequests(state) {
    var society = ensure(state), e = factionEvidence(state);
    society.factions.workers.request = e.housingGap > 0 ? 'Close the housing gap (' + e.housingGap + ').' : e.jobsGap > 0 ? 'Create reachable work for ' + e.jobsGap + ' residents.' : e.foodAccess < 70 ? 'Improve average food access (' + round(e.foodAccess, 1) + ').' : 'Protect health and wages while the basics hold.';
    society.factions.merchants.request = e.funds < 55 ? 'Stabilize the treasury (' + round(e.funds, 1) + ' credits).' : e.markets < 2 ? 'Support another market link.' : e.roads < 2 ? 'Connect daily destinations with a reviewed road.' : 'Keep trade moving without surprise decrees.';
    society.factions.ecologists.request = e.invasive > 0.55 ? 'Reduce invasive pressure (' + round(e.invasive * 100, 0) + '%).' : e.pollution > 18 ? 'Lower mean pollution (' + round(e.pollution, 1) + ').' : e.biodiversity < 62 ? 'Recover biodiversity (' + round(e.biodiversity, 1) + ').' : 'Protect habitat connectivity before expanding roads.';
    society.factions.traditionalists.request = e.farms < 1 ? 'Establish one farm mosaic.' : e.foodAccess < 72 ? 'Strengthen local food access.' : 'Keep farms, wetlands and gathering places in balance.';
    society.factions.scholars.request = e.educationGap > 0 ? 'Address ' + e.educationGap + ' education-service gap.' : e.careGap > 0 ? 'Address ' + e.careGap + ' care-service gap.' : e.education < 62 ? 'Raise education access (' + round(e.education, 1) + ').' : 'Keep evidence, receipts and ecological limits visible.';
    return e;
  }

  function updateFactionSupport(state) {
    var society = ensure(state), e = updateRequests(state), changes = [];
    var deltas = {
      workers: clamp((e.health - 60) * 0.025 + (e.foodAccess - 65) * 0.025 - e.housingGap * 0.25 - e.jobsGap * 0.12, -3, 3),
      merchants: clamp((e.funds - 65) * 0.018 + e.markets * 0.25 + e.roads * 0.12 - (state.flows.shortages || []).length * 0.5, -3, 3),
      ecologists: clamp((e.biodiversity - 58) * 0.025 - e.pollution * 0.018 - e.invasive * 1.6, -3, 3),
      traditionalists: clamp((e.foodAccess - 65) * 0.02 + e.farms * 0.35 + (e.waterAccess - 65) * 0.01 - e.pollution * 0.01, -3, 3),
      scholars: clamp((e.education - 50) * 0.02 + e.schools * 0.25 + e.clinics * 0.2 - e.educationGap * 0.25 - e.careGap * 0.2, -3, 3)
    };
    FACTION_ORDER.forEach(function (id) { var change = adjustFaction(state, id, round(deltas[id], 2), 'quarter evidence'); if (change) changes.push(change); });
    society.publicApproval = round(average(FACTION_ORDER.map(function (id) { return society.factions[id].support; })), 2);
    society.legitimacy = round(clamp(society.legitimacy + (society.publicApproval - 50) * 0.025 - (state.flows.shortages || []).length * 0.2, 0, 100), 2);
    society.lastFactionChanges = clone(changes);
    return changes;
  }

  function promiseFulfilled(state, promise) {
    var e = factionEvidence(state);
    if (promise.kind === 'HOUSING') return e.housingGap === 0;
    if (promise.kind === 'CLEAN_WATER') return e.waterAccess >= 72 && (!state.ecologyDynamics || state.ecologyDynamics.waterQuality >= 65);
    return false;
  }

  function checkPromises(state) {
    var society = ensure(state), changes = [];
    society.promises.forEach(function (promise) {
      if (promise.status !== 'OPEN' || state.turn < promise.dueTurn) return;
      var kept = promiseFulfilled(state, promise); promise.status = kept ? 'KEPT' : 'BROKEN'; promise.resolvedTurn = state.turn;
      var ids = promise.kind === 'HOUSING' ? ['workers'] : ['ecologists','traditionalists','scholars'];
      ids.forEach(function (id) { var change = adjustFaction(state, id, kept ? 5 : -7, (kept ? 'kept ' : 'broke ') + promise.kind + ' promise'); if (change) changes.push(change); });
      addHeadline(state, kept ? 'PALACE KEEPS A PROMISE; ARCHIVISTS ASK IF THIS SETS A PRECEDENT' : 'PROMISE MISSES DEADLINE; CALENDAR BLAMED FOR EXCESSIVE ACCURACY');
    });
    return changes;
  }

  function chooseDilemmaId(state) {
    var society = ensure(state), e = factionEvidence(state);
    if (state.inhabitants && (state.inhabitants.fish.status !== 'PRESENT' || state.ecologyDynamics.waterQuality < 48)) return 'FISH_PETITION';
    if (state.ecologyDynamics && state.ecologyDynamics.invasivePressure > 0.58) return 'INVASIVE_GUESTS';
    if (society.election.quartersUntilElection <= 2) return 'ELECTION_SPEECH';
    if (state.climate.stormRisk > 0.5) return 'RAIN_WITHOUT_PERMIT';
    if (state.resources.funds.stock < 42) return 'TREASURY_AUDIT';
    if (state.resources.food.stock > state.resources.food.capacity * 0.72) return 'MANGO_SURPLUS';
    return 'POLLINATOR_PAPERWORK';
  }

  function createDilemma(state) {
    var id = chooseDilemmaId(state), template = DILEMMA_TEMPLATES[id];
    return { schema: 'axm.living-world.dilemma/v0.2', id: id + '-t' + state.turn, templateId: id, createdTurn: state.turn, status: 'OPEN', title: template.title, briefing: template.briefing, choices: clone(template.choices) };
  }

  function applyEffects(state, effects) {
    var result = spendOrGain(state, effects.resources || {}); if (!result.ok) return result;
    var factionChanges = [], changes = [];
    Object.keys(effects.factions || {}).forEach(function (id) { var change = adjustFaction(state, id, effects.factions[id], 'dilemma choice'); if (change) factionChanges.push(change); });
    Object.keys(effects.species || {}).forEach(function (id) { if (!state.inhabitants || !state.inhabitants[id]) return; var entry = state.inhabitants[id], before = entry.population; entry.population = round(clamp(entry.population + effects.species[id], 0, entry.capacity * 1.1), 2); changes.push({ type: 'SPECIES_CHANGED', species: id, before: before, after: entry.population }); });
    Object.keys(effects.habitats || {}).forEach(function (id) { if (!state.habitats || !state.habitats[id]) return; var entry = state.habitats[id], before = entry.quality; entry.intervention = round(clamp(Number(entry.intervention || 0) + effects.habitats[id], 0, 25), 3); entry.quality = round(clamp(entry.quality + effects.habitats[id], 0, 100), 2); changes.push({ type: 'HABITAT_INTERVENTION', habitat: id, before: before, after: entry.quality, temporaryBoost: effects.habitats[id] }); });
    Object.keys(effects.capacities || {}).forEach(function (name) { if (!state.resources[name]) return; var before = state.resources[name].capacity; state.resources[name].capacity = round(Math.max(state.resources[name].stock, before + effects.capacities[name]), 2); changes.push({ type: 'CAPACITY_CHANGED', resource: name, before: before, after: state.resources[name].capacity }); });
    if (effects.peopleHealth) state.districts.forEach(function (district) { district.people.health = round(clamp(district.people.health + effects.peopleHealth, 0, 100), 2); });
    if (effects.promise) ensure(state).promises.push({ id: 'promise-' + effects.promise.toLowerCase() + '-t' + state.turn, kind: effects.promise, madeTurn: state.turn, dueTurn: state.turn + 3, status: 'OPEN' });
    if (effects.temporaryEdict) ensure(state).activeEdicts.push({ id: effects.temporaryEdict, label: 'Very Confident Tourism Poster', issuedTurn: state.turn, remainingQuarters: 2 });
    return { ok: true, errors: [], resourceChanges: result.changes, factionChanges: factionChanges, changes: changes };
  }

  function resolveDilemma(state, dilemmaId, choiceId) {
    var society = ensure(state), dilemma = society.currentDilemma;
    if (!dilemma || dilemma.id !== dilemmaId || dilemma.status !== 'OPEN') return { ok: false, errors: ['open dilemma not found'] };
    var choice = dilemma.choices.filter(function (entry) { return entry.id === choiceId; })[0];
    if (!choice) return { ok: false, errors: ['dilemma choice not found'] };
    var applied = applyEffects(state, choice.effects || {}); if (!applied.ok) return applied;
    dilemma.status = 'RESOLVED'; dilemma.choiceId = choice.id; dilemma.choiceLabel = choice.label; dilemma.resolvedTurn = state.turn;
    society.dilemmaHistory.push(clone(dilemma)); if (society.dilemmaHistory.length > 20) society.dilemmaHistory.shift(); society.currentDilemma = null;
    addHeadline(state, dilemma.title + ': palace selects ' + choice.label);
    society.lastCabinetLine = 'Dr. Basil Ibis: “A decision! The ecosystem has noted it, even if the minutes have not.”';
    return { ok: true, dilemma: clone(dilemma), choice: clone(choice), resourceChanges: applied.resourceChanges, factionChanges: applied.factionChanges, changes: [{ type: 'DILEMMA_RESOLVED', dilemmaId: dilemma.id, choiceId: choice.id }].concat(applied.changes), warnings: [choice.summary] };
  }

  function quarterHeadline(state, electionResult) {
    if (electionResult) return electionResult === 'MANDATE_RENEWED' ? 'ELECTION RETURNS PALACE; BALCONY CLAIMS STRONG PERSONAL PERFORMANCE' : 'ELECTION PRODUCES HUNG BALCONY; CHAIRS REQUEST NEGOTIATIONS';
    if ((state.flows.shortages || []).length) return 'SHORTAGE REPORTED; MINISTRY CONFIRMS EMPTY SHELVES ARE EXTREMELY EASY TO DUST';
    if (state.ecologyDynamics && state.ecologyDynamics.invasivePressure > 0.6) return 'PORT WELCOMES TINY UNDECLARED PASSENGERS; ECOLOGISTS LESS ENTHUSIASTIC';
    if (state.climate.rainfallMm > 95) return 'RAIN EXCEEDS QUARTERLY TARGET WITHOUT FIRST SEEKING APPROVAL';
    if (state.resources.funds.stock > 150) return 'TREASURY HEALTHY; COMPTROLLER WARNS AGAINST UNCONTROLLED OPTIMISM';
    return 'ISLAND COMPLETES ANOTHER QUARTER; PALACE TAKES CREDIT FOR CONTINUED ROTATION';
  }

  function cabinetLine(state) {
    var society = ensure(state), lowest = FACTION_ORDER.map(function (id) { return society.factions[id]; }).sort(function (a, b) { return a.support - b.support || a.id.localeCompare(b.id); })[0];
    if (society.currentDilemma) return 'Chief Pilar Paperwork: “One dilemma only, Presidente. Even chaos must queue politely.”';
    if (state.ecologyDynamics && state.ecologyDynamics.waterQuality < 55) return 'Dr. Basil Ibis: “The frogs have stopped applauding. I recommend we treat that as evidence.”';
    if (state.resources.funds.stock < 45) return 'Comptroller Coco Ledger: “The treasury is not empty. It contains several excellent echoes.”';
    return 'Captain Mira Tide: “The ' + lowest.label + ' are least amused this quarter. I would not schedule fireworks outside their window.”';
  }

  function advance(state) {
    var society = ensure(state), changes = [];
    var factionChanges = updateFactionSupport(state).concat(checkPromises(state));
    society.election.quartersUntilElection -= 1;
    var electionResult = null;
    if (society.election.quartersUntilElection <= 0) {
      electionResult = society.publicApproval >= 50 ? 'MANDATE_RENEWED' : 'HUNG_BALCONY';
      society.election.lastResult = { turn: state.turn, result: electionResult, approval: society.publicApproval };
      society.election.electionsHeld += 1; society.election.quartersUntilElection = society.election.cycleQuarters;
      society.legitimacy = round(clamp(society.legitimacy + (electionResult === 'MANDATE_RENEWED' ? 5 : -8), 0, 100), 2);
      changes.push({ type: 'ELECTION_RESULT', result: electionResult, approval: society.publicApproval });
    }
    var expired = [];
    society.activeEdicts.forEach(function (active) { active.remainingQuarters -= 1; if (active.remainingQuarters <= 0) expired.push(active.id); });
    society.activeEdicts = society.activeEdicts.filter(function (active) { return active.remainingQuarters > 0; });
    expired.forEach(function (id) { changes.push({ type: 'EDICT_EXPIRED', id: id }); });
    if (!society.currentDilemma) { society.currentDilemma = createDilemma(state); changes.push({ type: 'DILEMMA_OPENED', dilemmaId: society.currentDilemma.id }); }
    addHeadline(state, quarterHeadline(state, electionResult)); society.lastCabinetLine = cabinetLine(state);
    return { changes: changes, factionChanges: factionChanges, warnings: society.currentDilemma ? [society.currentDilemma.title + ' awaits a human choice.'] : [], electionResult: electionResult, dilemma: clone(society.currentDilemma) };
  }

  function validate(state) {
    var errors = [], society = state.society;
    if (!society || !society.factions || !Array.isArray(society.activeEdicts) || !Array.isArray(society.headlines)) return { ok: false, errors: ['island society state required'] };
    FACTION_ORDER.forEach(function (id) { var entry = society.factions[id]; if (!entry || !Number.isFinite(entry.support) || entry.support < 0 || entry.support > 100) errors.push('invalid faction ' + id); });
    if (!Number.isFinite(society.publicApproval) || society.publicApproval < 0 || society.publicApproval > 100) errors.push('invalid public approval');
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    FACTION_ORDER: FACTION_ORDER,
    EDICT_ORDER: EDICT_ORDER,
    EDICTS: clone(EDICTS),
    initialize: initialize,
    ensure: ensure,
    modifiers: modifiers,
    previewEdict: previewEdict,
    issueEdict: issueEdict,
    resolveDilemma: resolveDilemma,
    updateRequests: updateRequests,
    advance: advance,
    validate: validate
  };
});
