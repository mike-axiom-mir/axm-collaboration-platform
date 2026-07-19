(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMIslandEcology = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var HABITAT_ORDER = ['WETLAND_EDGE', 'WOODLAND', 'MEADOW', 'HIGHLAND', 'FARM_MOSAIC', 'SETTLEMENT'];
  var SPECIES_ORDER = ['pollinators', 'frogs', 'geckos', 'bats', 'canopyBirds', 'wadingBirds', 'landCrabs', 'iguanas', 'nativeRodents', 'invasivePredators', 'fish'];
  var TROPICAL_SPECIES_ORDER = ['geckos', 'canopyBirds', 'landCrabs', 'iguanas'];

  function clone(value) { return Canonical.clone(value); }
  function round(value, digits) { return Canonical.round(value, digits == null ? 3 : digits); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function sum(values) { return values.reduce(function (total, value) { return total + value; }, 0); }
  function average(values) { return values.length ? sum(values) / values.length : 0; }

  function habitat(label, quality, area, connectivity, role) {
    return { label: label, quality: round(quality, 2), area: round(area, 2), connectivity: round(connectivity, 2), intervention: 0, role: role };
  }

  function species(label, population, capacity, habitats, role, nativeStatus) {
    return {
      label: label,
      population: round(population, 2),
      capacity: round(capacity, 2),
      trend: 0,
      habitats: habitats,
      role: role,
      nativeStatus: nativeStatus,
      status: 'PRESENT'
    };
  }

  function tropicalSpecies() {
    return {
      geckos: species('Island geckos', 9, 16, ['WOODLAND', 'HIGHLAND', 'SETTLEMENT'], 'Warm-edge insect hunters that help frogs and bats keep crop pests in check.', 'NATIVE_GUILD'),
      canopyBirds: species('Canopy parrots and fruit doves', 7, 13, ['WOODLAND', 'MEADOW'], 'Fruit eaters that move seeds between tree islands and make fragmented woodland recover more slowly when they decline.', 'NATIVE_GUILD'),
      landCrabs: species('Shoreline land crabs', 8, 15, ['WETLAND_EDGE', 'WOODLAND'], 'Shoreline recyclers that return leaf litter to the wetland food web and improve nursery water.', 'NATIVE_GUILD'),
      iguanas: species('Island iguanas', 5, 10, ['HIGHLAND', 'WOODLAND', 'MEADOW'], 'Basking browsers and seed movers; useful in balance, hungry around farms when crowded.', 'NATIVE_GUILD')
    };
  }

  function migrateTropicalWeb(state) {
    if (!state || !state.inhabitants || !state.ecologyDynamics) return [];
    var defaults = tropicalSpecies(), added = [];
    TROPICAL_SPECIES_ORDER.forEach(function (id) {
      if (!state.inhabitants[id]) {
        state.inhabitants[id] = clone(defaults[id]);
        state.inhabitants[id].nativeStatus = 'NEWLY_CATALOGUED_GUILD';
        added.push(id);
      }
    });
    var dynamics = state.ecologyDynamics;
    if (!Number.isFinite(dynamics.seedDispersalService)) dynamics.seedDispersalService = 0.52;
    if (!Number.isFinite(dynamics.shorelineRecycling)) dynamics.shorelineRecycling = 0.5;
    if (!Number.isFinite(dynamics.browsingPressure)) dynamics.browsingPressure = 0.38;
    if (!Number.isFinite(dynamics.foodWebHealth)) dynamics.foodWebHealth = 0.58;
    dynamics.notes = Array.isArray(dynamics.notes) ? dynamics.notes : [];
    var note = 'Tropical inhabitants are functional guilds with bounded populations, not a scientific census.';
    if (dynamics.notes.indexOf(note) < 0) dynamics.notes.push(note);
    return added;
  }

  function activeEdict(state, id) {
    return !!(state.society && state.society.activeEdicts || []).filter(function (entry) { return entry.id === id && entry.remainingQuarters > 0; })[0];
  }

  function initialize(state) {
    state.habitats = {
      WETLAND_EDGE: habitat('Lake and reed wetland', 72, 18, 66, 'Water filtering, nursery habitat and drought refuge.'),
      WOODLAND: habitat('Mixed woodland', 70, 32, 70, 'Tree cover, roosts, shade and seed dispersal.'),
      MEADOW: habitat('Flower meadow', 68, 24, 72, 'Pollinator forage and small-animal cover.'),
      HIGHLAND: habitat('Rocky highland', 56, 12, 54, 'Dry refuge, basking sites and erosion-sensitive slopes.'),
      FARM_MOSAIC: habitat('Farm mosaic', 48, 6, 58, 'Food production interleaved with living margins.'),
      SETTLEMENT: habitat('Settled places', 44, 8, 62, 'Homes, civic services and human-wildlife edges.')
    };
    state.inhabitants = {
      pollinators: species('Butterflies and native bees', 38, 64, ['MEADOW', 'FARM_MOSAIC', 'WOODLAND'], 'Pollination supports fruiting crops and wild plants.', 'NATIVE_GUILD'),
      frogs: species('Wetland frogs', 12, 22, ['WETLAND_EDGE'], 'Insect predation and a visible water-quality signal.', 'NATIVE_GUILD'),
      geckos: tropicalSpecies().geckos,
      bats: species('Insect-eating bats', 8, 15, ['WOODLAND', 'SETTLEMENT'], 'Night insect control; requires roosts and dark routes.', 'NATIVE_GUILD'),
      canopyBirds: tropicalSpecies().canopyBirds,
      wadingBirds: species('Herons and other wading birds', 4, 8, ['WETLAND_EDGE'], 'Fish predation links the lake to shoreline nesting habitat.', 'NATIVE_GUILD'),
      landCrabs: tropicalSpecies().landCrabs,
      iguanas: tropicalSpecies().iguanas,
      nativeRodents: species('Island herbivores', 4, 10, ['WOODLAND', 'MEADOW'], 'Grazing, seed movement and prey for predators.', 'LEGACY_HARE_PROXY'),
      invasivePredators: species('Introduced mesopredators', 2, 5, ['SETTLEMENT', 'MEADOW'], 'Predation pressure on native ground life.', 'LEGACY_FOX_PROXY'),
      fish: species('Freshwater fish', 4, 10, ['WETLAND_EDGE'], 'Aquatic food web, fishing and prey for wading birds.', 'NATIVE_GUILD')
    };
    state.ecologyDynamics = {
      pollinationService: 0.59,
      pestPressure: 0.42,
      naturalPestControl: 0.48,
      waterQuality: 72,
      habitatConnectivity: 67,
      invasivePressure: 0.25,
      seedDispersalService: 0.52,
      shorelineRecycling: 0.5,
      browsingPressure: 0.38,
      foodWebHealth: 0.58,
      farmYieldMultiplier: 1,
      notes: ['Habitat and species values are bounded gameplay indices, not field surveys.', 'Tropical inhabitants are functional guilds with bounded populations, not a scientific census.'],
      lastEffects: []
    };
    assignDistrictHabitats(state);
    HABITAT_ORDER.forEach(function (id) { if (state.habitats[id] && !Number.isFinite(state.habitats[id].intervention)) state.habitats[id].intervention = 0; });
    recalculate(state);
    return state;
  }

  function assignDistrictHabitats(state) {
    var preferred = {
      'district-northgrove': 'WOODLAND',
      'district-lakeward': 'WETLAND_EDGE',
      'district-eastreach': 'SETTLEMENT',
      'district-southbank': 'MEADOW',
      'district-ridgeworks': 'HIGHLAND',
      'district-westmeadow': 'FARM_MOSAIC'
    };
    (state.districts || []).forEach(function (district) {
      if (!district.habitat) district.habitat = preferred[district.id] || (district.waterAdjacency ? 'WETLAND_EDGE' : 'MEADOW');
    });
  }

  function ensure(state) {
    if (!state.habitats || !state.inhabitants || !state.ecologyDynamics) initialize(state);
    migrateTropicalWeb(state);
    assignDistrictHabitats(state);
    HABITAT_ORDER.forEach(function (id) { if (state.habitats[id] && !Number.isFinite(state.habitats[id].intervention)) state.habitats[id].intervention = 0; });
    SPECIES_ORDER.forEach(function (id) {
      var entry = state.inhabitants[id];
      if (entry && entry.status == null) entry.status = entry.population <= 0 ? 'LOCALLY_ABSENT' : 'PRESENT';
    });
    return state;
  }

  function habitatInputs(state, habitatId) {
    var districts = state.districts.filter(function (district) { return district.habitat === habitatId; });
    if (!districts.length) districts = state.districts;
    return {
      districts: districts,
      vegetation: average(districts.map(function (district) { return district.ecology.vegetation; })),
      biodiversity: average(districts.map(function (district) { return district.ecology.biodiversity; })),
      pollution: average(districts.map(function (district) { return district.ecology.pollution; })),
      moisture: average(districts.map(function (district) { return district.soil.moisture; })) * 100,
      erosion: average(districts.map(function (district) { return district.soil.erosion; })),
      protectedCount: districts.filter(function (district) { return district.ecology.protectedBuffer; }).length,
      farms: sum(districts.map(function (district) { return district.services.FARM; })),
      population: sum(districts.map(function (district) { return district.population; }))
    };
  }

  function updateHabitats(state) {
    var roads = state.roads.length;
    var allBuffers = state.districts.filter(function (district) { return district.ecology.protectedBuffer; }).length;
    var seedService = Number(state.ecologyDynamics.seedDispersalService) || 0;
    var shorelineRecycling = Number(state.ecologyDynamics.shorelineRecycling) || 0;
    HABITAT_ORDER.forEach(function (id) {
      var input = habitatInputs(state, id), entry = state.habitats[id];
      var base = input.vegetation * 0.34 + input.biodiversity * 0.34 + input.moisture * 0.2 - input.pollution * 0.18 - input.erosion * 0.06;
      if (id === 'WETLAND_EDGE') base += state.climate.rainfallMm * 0.08 + input.protectedCount * 5 + shorelineRecycling * 3;
      if (id === 'WOODLAND') base += input.protectedCount * 6 + seedService * 4;
      if (id === 'MEADOW') base += Math.max(0, 65 - input.vegetation) * 0.08 + seedService * 1.5;
      if (id === 'HIGHLAND') base -= state.climate.stormRisk * 10;
      if (id === 'FARM_MOSAIC') base += input.farms * 4 - input.farms * Math.max(0, 55 - input.moisture) * 0.08;
      if (id === 'SETTLEMENT') base += Math.min(12, input.population * 0.15) - input.pollution * 0.1;
      entry.quality = round(clamp(base + entry.intervention, 0, 100), 2);
      entry.connectivity = round(clamp(74 - roads * 4.5 + allBuffers * 4 + (id === 'SETTLEMENT' ? 5 : 0), 12, 100), 2);
      var zoneCount = input.districts.length;
      entry.area = round(clamp(zoneCount * 12 + input.protectedCount * 3 + (id === 'FARM_MOSAIC' ? input.farms * 3 : 0), 3, 60), 2);
    });
  }

  function capacityFor(state, id) {
    var h = state.habitats, roads = state.roads.length;
    if (id === 'pollinators') return 12 + h.MEADOW.quality * 0.42 + h.FARM_MOSAIC.quality * 0.24 + h.WOODLAND.connectivity * 0.08;
    if (id === 'frogs') return 2 + h.WETLAND_EDGE.quality * 0.24 + state.climate.rainfallMm * 0.035;
    if (id === 'geckos') return 2 + h.SETTLEMENT.quality * 0.055 + h.WOODLAND.quality * 0.075 + h.HIGHLAND.quality * 0.045 - state.inhabitants.invasivePredators.population * 0.18;
    if (id === 'bats') return 2 + h.WOODLAND.quality * 0.11 + h.WOODLAND.connectivity * 0.06 + h.SETTLEMENT.quality * 0.025;
    if (id === 'canopyBirds') return 2 + h.WOODLAND.quality * 0.085 + h.WOODLAND.connectivity * 0.055 + h.MEADOW.quality * 0.018 - state.inhabitants.invasivePredators.population * 0.08;
    if (id === 'wadingBirds') return 1 + h.WETLAND_EDGE.quality * 0.06 + state.inhabitants.fish.population * 0.25;
    if (id === 'landCrabs') return 2 + h.WETLAND_EDGE.quality * 0.12 + h.WETLAND_EDGE.connectivity * 0.045 + state.districts.filter(function (district) { return district.waterAdjacency && district.ecology.protectedBuffer; }).length * 1.5 - state.inhabitants.invasivePredators.population * 0.14;
    if (id === 'iguanas') return 2 + h.HIGHLAND.quality * 0.055 + h.WOODLAND.quality * 0.045 + h.MEADOW.quality * 0.035 - state.inhabitants.invasivePredators.population * 0.2;
    if (id === 'nativeRodents') return 2 + h.WOODLAND.quality * 0.055 + h.MEADOW.quality * 0.05 - state.inhabitants.invasivePredators.population * 0.25;
    if (id === 'invasivePredators') {
      var groundPrey = state.inhabitants.nativeRodents.population + state.inhabitants.geckos.population + state.inhabitants.landCrabs.population + state.inhabitants.iguanas.population;
      return 1 + h.SETTLEMENT.quality * 0.025 + roads * 0.35 + Math.min(2.4, groundPrey * 0.045) + (activeEdict(state, 'OPEN_DOCKS_WEEK') ? 2 : 0);
    }
    return 2 + h.WETLAND_EDGE.quality * 0.11 + state.districts.filter(function (district) { return district.waterAdjacency && district.ecology.protectedBuffer; }).length * 2;
  }

  function recalculate(state) {
    ensure(state);
    updateHabitats(state);
    SPECIES_ORDER.forEach(function (id) { state.inhabitants[id].capacity = round(clamp(capacityFor(state, id), 0.5, 120), 2); });
    var inhabitants = state.inhabitants;
    var pollination = clamp(inhabitants.pollinators.population / Math.max(1, inhabitants.pollinators.capacity), 0, 1);
    var batControl = clamp(inhabitants.bats.population / Math.max(1, inhabitants.bats.capacity), 0, 1);
    var frogControl = clamp(inhabitants.frogs.population / Math.max(1, inhabitants.frogs.capacity), 0, 1);
    var geckoControl = clamp(inhabitants.geckos.population / Math.max(1, inhabitants.geckos.capacity), 0, 1);
    var canopyDispersal = clamp(inhabitants.canopyBirds.population / Math.max(1, inhabitants.canopyBirds.capacity), 0, 1);
    var crabRecycling = clamp(inhabitants.landCrabs.population / Math.max(1, inhabitants.landCrabs.capacity), 0, 1);
    var iguanaDispersal = clamp(inhabitants.iguanas.population / Math.max(1, inhabitants.iguanas.capacity), 0, 1);
    var rodentBrowsing = clamp(inhabitants.nativeRodents.population / Math.max(1, inhabitants.nativeRodents.capacity), 0, 1);
    var naturalControl = clamp(batControl * 0.32 + frogControl * 0.28 + geckoControl * 0.4, 0, 1);
    var seedDispersal = clamp(canopyDispersal * 0.72 + iguanaDispersal * 0.28, 0, 1);
    var browsing = clamp(rodentBrowsing * 0.38 + iguanaDispersal * 0.62, 0, 1);
    var farms = sum(state.districts.map(function (district) { return district.services.FARM; }));
    var pest = clamp(0.38 + farms * 0.055 + Math.max(0, state.climate.temperatureC - 18) * 0.011 - naturalControl * 0.42, 0.04, 0.95);
    var wetland = state.habitats.WETLAND_EDGE;
    var waterQuality = clamp(wetland.quality * 0.72 + wetland.connectivity * 0.18 + crabRecycling * 10 - state.inhabitants.invasivePredators.population * 0.25, 0, 100);
    var connectivity = average(HABITAT_ORDER.filter(function (id) { return id !== 'SETTLEMENT'; }).map(function (id) { return state.habitats[id].connectivity; }));
    var invasive = clamp(inhabitants.invasivePredators.population / Math.max(1, inhabitants.invasivePredators.capacity), 0, 1);
    state.ecologyDynamics.pollinationService = round(pollination, 3);
    state.ecologyDynamics.naturalPestControl = round(naturalControl, 3);
    state.ecologyDynamics.pestPressure = round(pest, 3);
    state.ecologyDynamics.waterQuality = round(waterQuality, 2);
    state.ecologyDynamics.habitatConnectivity = round(connectivity, 2);
    state.ecologyDynamics.invasivePressure = round(invasive, 3);
    state.ecologyDynamics.seedDispersalService = round(seedDispersal, 3);
    state.ecologyDynamics.shorelineRecycling = round(crabRecycling, 3);
    state.ecologyDynamics.browsingPressure = round(browsing, 3);
    state.ecologyDynamics.foodWebHealth = round(clamp(average([pollination, naturalControl, seedDispersal, crabRecycling, waterQuality / 100, 1 - invasive]), 0, 1), 3);
    state.ecologyDynamics.farmYieldMultiplier = round(clamp(0.72 + pollination * 0.25 + (1 - pest) * 0.17 + naturalControl * 0.05 + seedDispersal * 0.04 - Math.max(0, browsing - 0.65) * 0.08, 0.62, 1.2), 3);
    return state.ecologyDynamics;
  }

  function reconcileNative(state, observation) {
    ensure(state);
    var mapping = [
      ['fish', observation.fishAlive],
      ['nativeRodents', observation.hareCount],
      ['invasivePredators', observation.foxCount]
    ];
    mapping.forEach(function (pair) {
      if (pair[1] == null) return;
      var entry = state.inhabitants[pair[0]], before = entry.population;
      entry.population = round(pair[1], 2);
      entry.trend = round(entry.population - before, 2);
      entry.status = entry.population <= 0 ? 'LOCALLY_ABSENT' : 'PRESENT';
    });
    recalculate(state);
  }

  function toward(population, capacity, rate) {
    if (capacity <= 0) return -population;
    return (capacity - population) * rate;
  }

  function advance(state, context) {
    ensure(state);
    HABITAT_ORDER.forEach(function (id) { state.habitats[id].intervention = round(state.habitats[id].intervention * 0.86, 3); });
    var before = {};
    SPECIES_ORDER.forEach(function (id) { before[id] = state.inhabitants[id].population; });
    recalculate(state);
    var draw = context && context.draw || function () { return 0.5; };
    var inhabitants = state.inhabitants;
    var changes = {}, invasive = inhabitants.invasivePredators.population;
    changes.pollinators = toward(inhabitants.pollinators.population, inhabitants.pollinators.capacity, 0.2) - state.ecologyDynamics.pestPressure * 0.35;
    changes.frogs = toward(inhabitants.frogs.population, inhabitants.frogs.capacity, 0.18) - Math.max(0, 65 - state.ecologyDynamics.waterQuality) * 0.025;
    changes.geckos = toward(inhabitants.geckos.population, inhabitants.geckos.capacity, 0.17) + state.ecologyDynamics.pestPressure * 0.16 - invasive * 0.08;
    changes.bats = toward(inhabitants.bats.population, inhabitants.bats.capacity, 0.13) - Math.max(0, 55 - state.ecologyDynamics.habitatConnectivity) * 0.018;
    changes.canopyBirds = toward(inhabitants.canopyBirds.population, inhabitants.canopyBirds.capacity, 0.12) - invasive * 0.04 - Math.max(0, 58 - state.ecologyDynamics.habitatConnectivity) * 0.012;
    changes.wadingBirds = toward(inhabitants.wadingBirds.population, inhabitants.wadingBirds.capacity, 0.12) - invasive * 0.035;
    changes.landCrabs = toward(inhabitants.landCrabs.population, inhabitants.landCrabs.capacity, 0.16) - invasive * 0.075 - Math.max(0, 62 - state.ecologyDynamics.waterQuality) * 0.023;
    changes.iguanas = toward(inhabitants.iguanas.population, inhabitants.iguanas.capacity, 0.11) - invasive * 0.09 - Math.max(0, 52 - state.ecologyDynamics.habitatConnectivity) * 0.012;
    changes.nativeRodents = toward(inhabitants.nativeRodents.population, inhabitants.nativeRodents.capacity, 0.16) - invasive * 0.11;
    changes.invasivePredators = toward(inhabitants.invasivePredators.population, inhabitants.invasivePredators.capacity, activeEdict(state, 'OPEN_DOCKS_WEEK') ? 0.2 : 0.08);
    changes.fish = toward(inhabitants.fish.population, inhabitants.fish.capacity, 0.15) - inhabitants.wadingBirds.population * 0.025 - Math.max(0, 60 - state.ecologyDynamics.waterQuality) * 0.02;
    var effects = [], warnings = [];
    SPECIES_ORDER.forEach(function (id) {
      var entry = inhabitants[id];
      var noise = (draw() - 0.5) * Math.min(0.5, entry.capacity * 0.025);
      var delta = changes[id] + noise;
      var recolonize = entry.population <= 0.05 && entry.capacity >= 3 && state.turn % 4 === 0;
      if (recolonize) delta = Math.max(delta, 0.5);
      entry.population = round(clamp(entry.population + delta, 0, entry.capacity * 1.1), 2);
      entry.trend = round(entry.population - before[id], 2);
      entry.status = entry.population <= 0.05 ? 'LOCALLY_ABSENT' : entry.population < entry.capacity * 0.25 ? 'FRAGILE' : 'PRESENT';
      if (Math.abs(entry.trend) >= 0.2) effects.push({ type: 'INHABITANT_TREND', species: id, before: before[id], after: entry.population, capacity: entry.capacity });
      if (entry.status !== 'PRESENT') warnings.push(entry.label + ' are ' + entry.status.toLowerCase().replace(/_/g, ' ') + '.');
    });
    recalculate(state);
    if (state.ecologyDynamics.invasivePressure > 0.72) warnings.push('Introduced-predator pressure is high enough to suppress geckos, land crabs, iguanas and other native ground life.');
    if (state.ecologyDynamics.waterQuality < 45) warnings.push('Wetland water quality is poor; fish, frogs and shoreline recyclers are under pressure.');
    if (state.ecologyDynamics.habitatConnectivity < 42) warnings.push('Road fragmentation is isolating habitats.');
    if (state.ecologyDynamics.seedDispersalService < 0.3) warnings.push('Canopy seed dispersal is weak; woodland recovery is losing one of its living links.');
    if (state.ecologyDynamics.shorelineRecycling < 0.28) warnings.push('Land-crab recycling is weak; shoreline litter and nursery-water recovery lose a buffer.');
    state.ecologyDynamics.lastEffects = clone(effects);
    return { changes: effects, warnings: warnings, dynamics: clone(state.ecologyDynamics) };
  }

  function foodMultiplier(state) { ensure(state); return state.ecologyDynamics.farmYieldMultiplier; }

  function validate(state) {
    var errors = [];
    if (!state.habitats || !state.inhabitants || !state.ecologyDynamics) return { ok: false, errors: ['island ecology state required'] };
    HABITAT_ORDER.forEach(function (id) {
      var entry = state.habitats[id];
      if (!entry || !Number.isFinite(entry.quality) || entry.quality < 0 || entry.quality > 100) errors.push('invalid habitat ' + id);
    });
    SPECIES_ORDER.forEach(function (id) {
      var entry = state.inhabitants[id];
      if (!entry || !Number.isFinite(entry.population) || entry.population < 0 || !Number.isFinite(entry.capacity) || entry.capacity <= 0 || entry.population > entry.capacity * 1.11) errors.push('invalid inhabitant ' + id);
    });
    ['pollinationService', 'pestPressure', 'naturalPestControl', 'invasivePressure', 'seedDispersalService', 'shorelineRecycling', 'browsingPressure', 'foodWebHealth'].forEach(function (id) {
      var value = state.ecologyDynamics[id];
      if (!Number.isFinite(value) || value < 0 || value > 1) errors.push('invalid ecology dynamic ' + id);
    });
    ['waterQuality', 'habitatConnectivity'].forEach(function (id) {
      var value = state.ecologyDynamics[id];
      if (!Number.isFinite(value) || value < 0 || value > 100) errors.push('invalid ecology dynamic ' + id);
    });
    if (!Number.isFinite(state.ecologyDynamics.farmYieldMultiplier) || state.ecologyDynamics.farmYieldMultiplier < 0.62 || state.ecologyDynamics.farmYieldMultiplier > 1.2) errors.push('invalid farm yield multiplier');
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    HABITAT_ORDER: HABITAT_ORDER,
    SPECIES_ORDER: SPECIES_ORDER,
    initialize: initialize,
    ensure: ensure,
    migrateTropicalWeb: migrateTropicalWeb,
    assignDistrictHabitats: assignDistrictHabitats,
    reconcileNative: reconcileNative,
    recalculate: recalculate,
    advance: advance,
    foodMultiplier: foodMultiplier,
    validate: validate
  };
});
