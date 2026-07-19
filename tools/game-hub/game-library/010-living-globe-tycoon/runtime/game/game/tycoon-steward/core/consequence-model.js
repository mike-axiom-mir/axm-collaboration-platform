(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonConsequences = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var VITALS = ['livability', 'access', 'resilience', 'ecologicalHealth', 'economicCirculation', 'diversity', 'unmetNeeds', 'stewardTrust'];
  var BASELINE = { livability: 46, access: 34, resilience: 42, ecologicalHealth: 58, economicCirculation: 38, diversity: 44, unmetNeeds: 54, stewardTrust: 52 };
  var KNOWN_BINDINGS = {
    COTTAGE_CLUSTER: { livability: 5, ecologicalHealth: -2, economicCirculation: 1, diversity: 1, unmetNeeds: -3 },
    COURTYARD_HOMES: { livability: 4, access: 1, resilience: 1, ecologicalHealth: -2, diversity: 2, unmetNeeds: -4 },
    WORKSHOP_YARD: { livability: -1, resilience: 2, ecologicalHealth: -3, economicCirculation: 5, diversity: 1, unmetNeeds: -2 },
    REPAIR_COOPERATIVE: { resilience: 4, ecologicalHealth: -1, economicCirculation: 3, diversity: 2, unmetNeeds: -2 },
    FESTIVAL_GREEN: { livability: 3, ecologicalHealth: 1, economicCirculation: 2, diversity: 3, unmetNeeds: -2 },
    COMMON_HALL: { livability: 3, resilience: 1, economicCirculation: 1, diversity: 3, unmetNeeds: -2 },
    POCKET_PARK: { livability: 2, resilience: 1, ecologicalHealth: 5, economicCirculation: -1, diversity: 1, unmetNeeds: -1 },
    WETLAND_BUFFER: { resilience: 4, ecologicalHealth: 7, economicCirculation: -1, diversity: 1, unmetNeeds: -1 },
    ENERGY_COOP: { livability: 1, resilience: 6, ecologicalHealth: -1, economicCirculation: 2, unmetNeeds: -4 },
    CIVIC_STOP: { livability: 1, access: 6, ecologicalHealth: -1, economicCirculation: 2, unmetNeeds: -3 },
    PUBLIC_SERVICE: { livability: 4, access: 2, resilience: 3, economicCirculation: 1, diversity: 1, unmetNeeds: -5 },
    MIXED_QUARTER: { livability: 3, access: 2, resilience: 1, ecologicalHealth: -2, economicCirculation: 4, diversity: 4, unmetNeeds: -4 },
    SMALL_SETTLEMENT: { livability: 3, access: -1, resilience: 1, ecologicalHealth: -2, economicCirculation: 2, diversity: 2, unmetNeeds: -3 },
    TRADE_PATH: { access: 4, ecologicalHealth: -1, economicCirculation: 4, diversity: 1, unmetNeeds: -2 },
    ECO_BUFFER: { livability: 1, resilience: 3, ecologicalHealth: 6, economicCirculation: -1, diversity: 2, unmetNeeds: -2 },
    TIMBER_CAMP: { resilience: 1, ecologicalHealth: -3, economicCirculation: 3, diversity: 1, unmetNeeds: -1 },
    CLAY_PIT: { resilience: 1, ecologicalHealth: -2, economicCirculation: 3, unmetNeeds: -1 },
    STONE_QUARRY: { resilience: 2, ecologicalHealth: -4, economicCirculation: 4, unmetNeeds: -1 },
    ORE_YARD: { resilience: 2, ecologicalHealth: -5, economicCirculation: 4, unmetNeeds: -1 },
    SAWMILL: { resilience: 2, ecologicalHealth: -2, economicCirculation: 5, diversity: 1, unmetNeeds: -2 },
    BRICKWORKS: { resilience: 3, ecologicalHealth: -3, economicCirculation: 5, unmetNeeds: -2 },
    METALWORKS: { resilience: 4, ecologicalHealth: -5, economicCirculation: 6, diversity: 1, unmetNeeds: -2 },
    CANNERY: { livability: 1, resilience: 3, ecologicalHealth: -2, economicCirculation: 5, diversity: 2, unmetNeeds: -3 },
    FURNITURE_WORKSHOP: { livability: 1, resilience: 2, ecologicalHealth: -2, economicCirculation: 5, diversity: 3, unmetNeeds: -2 },
    CONSTRUCTION_YARD: { resilience: 5, ecologicalHealth: -3, economicCirculation: 5, unmetNeeds: -3 },
    MARKET_ROW: { livability: 2, access: 1, resilience: 1, economicCirculation: 5, diversity: 2, unmetNeeds: -3 },
    FOOD_HALL: { livability: 3, resilience: 1, ecologicalHealth: -1, economicCirculation: 4, diversity: 3, unmetNeeds: -3 }
  };

  function clamp(value) { return Math.max(0, Math.min(100, Canonical.round(value, 2))); }
  function bindingFor(structure) {
    if (structure.metricStatus === 'UNSCORED_REVIEW_REQUIRED') return null;
    return structure.vitalBindings || KNOWN_BINDINGS[structure.type] || null;
  }

  function calculate(state) {
    var values = Canonical.clone(BASELINE);
    state.structures.forEach(function (structure) {
      var bindings = bindingFor(structure);
      if (!bindings || structure.lifecycle === 'FAILED') return;
      Object.keys(bindings).sort().forEach(function (vital) { values[vital] = Number(values[vital] || 0) + bindings[vital]; });
    });
    values.access += state.roads.reduce(function (sum, road) { return sum + Math.min(5, road.path.length / 2); }, 0);
    values.ecologicalHealth += state.map.cells.filter(function (cell) { return cell.zone === 'NATURE'; }).length * 0.35;
    values.ecologicalHealth -= state.map.cells.filter(function (cell) { return cell.zone === 'INDUSTRY'; }).length * 0.22;
    values.resilience -= state.districts.filter(function (district) { return district.lifecycleState === 'FAILED'; }).length * 7;
    values.livability -= state.districts.filter(function (district) { return district.lifecycleState === 'STALLED'; }).length * 3;
    values.unmetNeeds = state.needs.length ? state.needs.reduce(function (sum, item) { return sum + item.pressure; }, 0) / state.needs.length : 0;
    var trust = state.governance || {};
    values.stewardTrust = 50 + Number(trust.reasonsRecorded || 0) * 0.6 + Number(trust.repairsCompleted || 0) * 5 + Number(trust.commitmentsKept || 0) * 1.5;
    values.stewardTrust -= Number(trust.hiddenCostWarnings || 0) * 3 + Number(trust.protectedOverrides || 0) * 5 + Number(trust.staleAttempts || 0) * 0.5;
    if (state.lastTurnShortages && state.lastTurnShortages.length) {
      values.resilience -= state.lastTurnShortages.length * 4;
      values.livability -= state.lastTurnShortages.length * 2;
    }
    var out = {};
    VITALS.forEach(function (name) { out[name] = clamp(values[name]); });
    return out;
  }

  function delta(previous, next) {
    var out = {};
    VITALS.forEach(function (name) { out[name] = Canonical.round(Number(next[name] || 0) - Number(previous[name] || 0), 2); });
    return out;
  }

  function validateKnownBindings() {
    var errors = [];
    Object.keys(KNOWN_BINDINGS).sort().forEach(function (type) {
      Object.keys(KNOWN_BINDINGS[type]).forEach(function (vital) {
        if (VITALS.indexOf(vital) < 0) errors.push(type + ' binds unknown vital ' + vital);
        if (!Number.isFinite(KNOWN_BINDINGS[type][vital])) errors.push(type + ' binding must be finite');
      });
    });
    return { ok: errors.length === 0, errors: errors };
  }

  return { VITALS: VITALS, BASELINE: BASELINE, KNOWN_BINDINGS: KNOWN_BINDINGS, bindingFor: bindingFor, calculate: calculate, delta: delta, validateKnownBindings: validateKnownBindings };
});
