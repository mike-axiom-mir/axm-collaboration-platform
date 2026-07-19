(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./zone-model') : root.AXMTycoonZones,
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonRoads = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Zones, Canonical) {
  'use strict';

  var RULE_ID = 'ROAD_PRESSURE_PATH/v1';
  var PRESSURE_THRESHOLD = 35;

  function cellById(map, id) { return map.cells.filter(function (cell) { return cell.id === id; })[0] || null; }
  function heuristic(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function cellCost(cell, options) {
    if (cell.protected && options.protectNature && !options.natureRouteOverride) return Infinity;
    var cost = Number(cell.terrain.buildCostFactor || 1);
    if (cell.zone === 'NATURE') cost += options.protectNature ? 8 : 2;
    if (cell.terrain.kind === 'WETLAND') cost += 2;
    if (cell.roadIds.length) cost *= 0.25;
    return Canonical.round(cost, 4);
  }

  function findPath(map, startId, endId, options) {
    var start = cellById(map, startId), end = cellById(map, endId);
    if (!start || !end) return { ok: false, reason: 'UNKNOWN_ENDPOINT', path: [] };
    var opts = Object.assign({ protectNature: true, natureRouteOverride: false }, options || {});
    var open = [{ id: start.id, g: 0, f: heuristic(start, end), path: [start.id] }];
    var best = {}; best[start.id] = 0;
    while (open.length) {
      open.sort(function (a, b) { return a.f - b.f || a.g - b.g || a.id.localeCompare(b.id) || a.path.join('|').localeCompare(b.path.join('|')); });
      var current = open.shift();
      if (current.id === end.id) return { ok: true, path: current.path, cost: Canonical.round(current.g, 4) };
      Zones.neighbors(map, current.id).forEach(function (neighbor) {
        var step = cellCost(neighbor, opts);
        if (!Number.isFinite(step)) return;
        var nextG = Canonical.round(current.g + step, 4);
        if (best[neighbor.id] != null && best[neighbor.id] <= nextG) return;
        best[neighbor.id] = nextG;
        open.push({ id: neighbor.id, g: nextG, f: Canonical.round(nextG + heuristic(neighbor, end), 4), path: current.path.concat(neighbor.id) });
      });
    }
    return { ok: false, reason: 'NO_ALLOWED_ROUTE', path: [] };
  }

  function alreadyConnected(state, originId, destinationId) {
    return state.roads.some(function (road) {
      return (road.originCellId === originId && road.destinationCellId === destinationId) || (road.originCellId === destinationId && road.destinationCellId === originId);
    });
  }

  function connectionPairs(state, needs) {
    var accessNeed = (needs || []).filter(function (item) { return item.id === 'need-access'; })[0];
    var origins = state.structures.filter(function (structure) { return structure.category === 'HOUSING' || structure.type === 'SMALL_SETTLEMENT'; });
    var destinations = state.structures.filter(function (structure) { return ['INDUSTRY', 'ENTERTAINMENT', 'SERVICE', 'INFRASTRUCTURE'].indexOf(structure.category) >= 0; });
    var pairs = [];
    origins.forEach(function (origin) {
      destinations.forEach(function (destination) {
        if (origin.cellId === destination.cellId || alreadyConnected(state, origin.cellId, destination.cellId)) return;
        var a = cellById(state.map, origin.cellId), b = cellById(state.map, destination.cellId);
        var distance = heuristic(a, b);
        var movement = Number(origin.capacity && origin.capacity.residents || 1) + Number(destination.capacity && (destination.capacity.jobs || destination.capacity.leisure || destination.capacity.service) || 1);
        var pressure = Canonical.round(Number(accessNeed && accessNeed.pressure || 0) * 0.55 + movement * 2.4 + Math.max(0, 8 - distance), 2);
        pairs.push({ origin: origin, destination: destination, pressure: pressure, distance: distance });
      });
    });
    return pairs.sort(function (a, b) { return b.pressure - a.pressure || a.origin.id.localeCompare(b.origin.id) || a.destination.id.localeCompare(b.destination.id); });
  }

  function generateCandidate(state, needs) {
    var pair = connectionPairs(state, needs)[0];
    if (!pair) return { candidate: null, refusal: 'NO_UNCONNECTED_ORIGIN_DESTINATION' };
    if (pair.pressure < PRESSURE_THRESHOLD) return { candidate: null, refusal: 'INSUFFICIENT_CONNECTION_PRESSURE', pressure: pair.pressure };
    var route = findPath(state.map, pair.origin.cellId, pair.destination.cellId, state.policies.constraints);
    if (!route.ok) return { candidate: null, refusal: route.reason, pressure: pair.pressure };
    var length = Math.max(1, route.path.length - 1);
    return {
      candidate: {
        id: 'road-candidate-t' + (state.turn + 1) + '-' + pair.origin.cellId + '-' + pair.destination.cellId,
        kind: 'ROAD',
        ruleId: RULE_ID,
        ruleVersion: '1',
        originCellId: pair.origin.cellId,
        destinationCellId: pair.destination.cellId,
        path: route.path,
        pathCost: route.cost,
        connectionPressure: pair.pressure,
        threshold: PRESSURE_THRESHOLD,
        zone: 'INFRASTRUCTURE',
        costs: { materials: Math.ceil(length * 1.8), funds: Math.ceil(length * 2.2), attention: Math.max(1, Math.ceil(length / 5)) },
        benefits: ['connects measured origin and destination', 'may improve access and circulation'],
        risks: state.policies.constraints.natureRouteOverride ? ['protected-nature override is active and recorded'] : ['construction consumes land and materials'],
        limitations: ['movement pressure is an abstract local simulation signal, not observed transport data'],
        tieBreaker: pair.origin.id + '|' + pair.destination.id + '|' + route.path.join('>')
      }
    };
  }

  return { RULE_ID: RULE_ID, PRESSURE_THRESHOLD: PRESSURE_THRESHOLD, cellCost: cellCost, findPath: findPath, connectionPairs: connectionPairs, generateCandidate: generateCandidate };
});
