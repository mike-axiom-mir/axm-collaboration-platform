(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonNeeds = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  function clamp(value) { return Math.max(0, Math.min(100, Canonical.round(value, 2))); }
  function capacity(state, field) {
    return state.structures.reduce(function (sum, structure) {
      return sum + Number(structure.capacity && structure.capacity[field] || 0);
    }, 0);
  }
  function countByCategory(state, category) {
    return state.structures.filter(function (structure) { return structure.category === category && structure.lifecycle !== 'FAILED'; }).length;
  }
  function affected(state, predicate) {
    return state.districts.filter(predicate).map(function (district) { return district.id; }).sort();
  }
  function need(id, label, pressure, evidence, locations, constraints, disconfirmers, zones) {
    return {
      id: id,
      label: label,
      pressure: clamp(pressure),
      evidence: evidence,
      affectedLocations: locations,
      constraints: constraints,
      couldBeDisconfirmedBy: disconfirmers,
      candidateZones: zones
    };
  }

  function calculate(state) {
    var population = state.resources.population.stock;
    var housingCapacity = capacity(state, 'residents');
    var jobCapacity = capacity(state, 'jobs');
    var leisureCapacity = capacity(state, 'leisure');
    var serviceCapacity = capacity(state, 'service');
    var energyDemand = state.resources.energy.outflow;
    var energySupply = state.resources.energy.inflow + state.resources.energy.available;
    var failed = state.districts.filter(function (district) { return district.lifecycleState === 'FAILED'; });
    var stalled = state.districts.filter(function (district) { return district.lifecycleState === 'STALLED'; });
    var disconnectedStructures = state.structures.filter(function (structure) {
      var cell = state.map.cells.filter(function (candidate) { return candidate.id === structure.cellId; })[0];
      return cell && !cell.roadIds.length;
    }).length;
    var natureCells = state.map.cells.filter(function (cell) { return cell.zone === 'NATURE'; }).length;
    var builtCells = state.map.cells.filter(function (cell) { return cell.structureIds.length > 0; }).length;
    var allDistricts = state.districts.map(function (district) { return district.id; }).sort();
    var needs = [
      need('need-housing', 'Homes with room to breathe', Math.max(0, population - housingCapacity) * 7,
        [{ metric: 'population', value: population }, { metric: 'housingCapacity', value: housingCapacity }], allDistricts,
        ['Requires housing or valid neutral land', 'Consumes population allocation, materials, funds and energy'],
        ['Housing capacity reaches current population with no crowding signal'], ['HOUSING', 'NEUTRAL']),
      need('need-work', 'Meaningful local work', Math.max(0, state.resources.labor.stock - jobCapacity) * 5,
        [{ metric: 'availableLabor', value: state.resources.labor.stock }, { metric: 'jobCapacity', value: jobCapacity }], allDistricts,
        ['Industry pressure may reduce ecology or livability', 'Jobs require operating energy'],
        ['Job capacity matches available labor without harmful overcapacity'], ['INDUSTRY', 'NEUTRAL']),
      need('need-energy', 'Reliable energy margin', Math.max(0, energyDemand + 18 - energySupply) * 4 + (state.resources.energy.available < 20 ? 30 : 0),
        [{ metric: 'energyDemand', value: energyDemand }, { metric: 'energySupplyAndStock', value: energySupply }, { metric: 'availableEnergy', value: state.resources.energy.available }], allDistricts,
        ['Energy infrastructure has material and ecological costs'],
        ['Available energy remains above two turns of demand'], ['INFRASTRUCTURE', 'NEUTRAL']),
      need('need-access', 'Connections between daily places', disconnectedStructures * 9 + Math.max(0, 3 - state.roads.length) * 13,
        [{ metric: 'disconnectedStructures', value: disconnectedStructures }, { metric: 'emergentRoads', value: state.roads.length }],
        affected(state, function (district) { return district.lifecycleState !== 'HEALTHY'; }),
        ['Roads arise only from measured origin-destination pressure', 'Protected nature may block a shortest route'],
        ['Origins and destinations are connected or movement pressure falls below threshold'], ['INFRASTRUCTURE', 'NEUTRAL']),
      need('need-leisure', 'Shared leisure and belonging', Math.max(0, Math.ceil(population / 6) - leisureCapacity) * 9,
        [{ metric: 'population', value: population }, { metric: 'leisureCapacity', value: leisureCapacity }], allDistricts,
        ['Entertainment uses funds, attention and energy'], ['Leisure capacity meets the current local need'], ['ENTERTAINMENT', 'NEUTRAL']),
      need('need-services', 'Nearby civic care', Math.max(0, Math.ceil(population / 8) - serviceCapacity) * 10,
        [{ metric: 'population', value: population }, { metric: 'serviceCapacity', value: serviceCapacity }, { metric: 'serviceStructures', value: countByCategory(state, 'SERVICE') }], allDistricts,
        ['Services need continuing funds and labor'], ['Service capacity covers the current population'], ['INFRASTRUCTURE', 'NEUTRAL']),
      need('need-ecology', 'Ecological breathing room', Math.max(0, 18 - natureCells) * 3 + builtCells * 1.2 + Math.max(0, 45 - state.vitals.ecologicalHealth),
        [{ metric: 'natureCells', value: natureCells }, { metric: 'builtCells', value: builtCells }, { metric: 'ecologicalHealth', value: state.vitals.ecologicalHealth }], allDistricts,
        ['Restoration competes for land, materials and attention'], ['Ecological health and habitat cover remain stable across turns'], ['NATURE', 'NEUTRAL']),
      need('need-repair', 'Repair before erasure', failed.length * 35 + stalled.length * 18,
        [{ metric: 'failedDistricts', value: failed.length }, { metric: 'stalledDistricts', value: stalled.length }],
        failed.concat(stalled).map(function (district) { return district.id; }).sort(),
        ['Repair must address the recorded cause and consume resources'], ['No district remains failed or stalled without an explicit hold'], ['INFRASTRUCTURE'])
    ];
    needs.sort(function (a, b) { return b.pressure - a.pressure || a.id.localeCompare(b.id); });
    needs.forEach(function (item, index) { item.rank = index + 1; });
    return needs;
  }

  function query(state, input) {
    var options = input || {};
    return calculate(state).filter(function (item) {
      if (options.kind && item.id !== options.kind) return false;
      if (options.districtId && item.affectedLocations.indexOf(options.districtId) < 0) return false;
      if (Number.isFinite(options.minPressure) && item.pressure < options.minPressure) return false;
      return true;
    });
  }

  return { calculate: calculate, query: query };
});
