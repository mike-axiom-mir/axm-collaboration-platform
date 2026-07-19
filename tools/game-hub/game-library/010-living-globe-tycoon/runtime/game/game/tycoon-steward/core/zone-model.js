(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./deterministic-rng') : root.AXMTycoonRng,
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonZones = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Rng, Canonical) {
  'use strict';

  var ZONES = ['HOUSING', 'INDUSTRY', 'ENTERTAINMENT', 'NATURE', 'INFRASTRUCTURE', 'NEUTRAL'];
  var TERRAIN = ['MEADOW', 'CLAY', 'WOODLAND', 'WETLAND', 'RIDGE'];
  var WIDTH = 8;
  var HEIGHT = 8;

  function zoneForCoordinate(x, y) {
    if (y >= 6) return 'NATURE';
    if (x <= 1 && y <= 3) return 'HOUSING';
    if (x >= 6 && y <= 3) return 'INDUSTRY';
    if ((x === 3 || x === 4) && y <= 4) return 'INFRASTRUCTURE';
    if (x >= 1 && x <= 3 && y >= 4 && y <= 5) return 'ENTERTAINMENT';
    return 'NEUTRAL';
  }

  function districtForCoordinate(x, y) {
    if (x < 4 && y < 4) return 'district-hearthside';
    if (x >= 4 && y < 4) return 'district-kilnward';
    if (x < 4 && y >= 4) return 'district-reedbank';
    return 'district-westfold';
  }

  function createStarterMap(seed) {
    var rng = Rng.create(String(seed) + ':terrain');
    var cells = [];
    for (var y = 0; y < HEIGHT; y += 1) {
      for (var x = 0; x < WIDTH; x += 1) {
        var kind = TERRAIN[rng.int(0, TERRAIN.length - 1)];
        var zone = zoneForCoordinate(x, y);
        var habitat = kind === 'WOODLAND' || kind === 'WETLAND' ? 4 : kind === 'MEADOW' ? 3 : 1;
        var slope = kind === 'RIDGE' ? 3 : rng.int(0, 2);
        cells.push({
          id: 'cell-' + x + '-' + y,
          x: x,
          y: y,
          districtId: districtForCoordinate(x, y),
          zone: zone,
          terrain: {
            kind: kind,
            slope: slope,
            fertility: kind === 'CLAY' ? 4 : kind === 'MEADOW' ? 3 : 2,
            habitat: habitat,
            waterAffinity: kind === 'WETLAND' ? 4 : 1,
            buildCostFactor: Canonical.round(1 + slope * 0.18 + (kind === 'WETLAND' ? 0.35 : 0), 2)
          },
          protected: zone === 'NATURE' && (kind === 'WOODLAND' || kind === 'WETLAND'),
          structureIds: [],
          roadIds: []
        });
      }
    }
    return { schema: 'axm.tycoon-steward.region/v0.1', width: WIDTH, height: HEIGHT, cells: cells };
  }

  function createStarterDistricts() {
    return [
      {
        id: 'district-hearthside', name: 'Hearthside', lifecycleState: 'HEALTHY', held: false, heldFrom: null,
        stress: 2, failureCause: null, repair: null,
        history: [{ turn: 0, state: 'HEALTHY', cause: 'STARTER_WORLD_SEED/v1', note: 'Established mixed housing quarter.' }]
      },
      {
        id: 'district-kilnward', name: 'Kilnward', lifecycleState: 'STRAINED', held: false, heldFrom: null,
        stress: 6, failureCause: null, repair: null,
        history: [{ turn: 0, state: 'STRAINED', cause: 'STARTER_WORLD_SEED/v1', note: 'Industry has energy and access pressure.' }]
      },
      {
        id: 'district-reedbank', name: 'Reedbank', lifecycleState: 'STALLED', held: false, heldFrom: null,
        stress: 10, failureCause: 'ACCESS_GAP', repair: null,
        history: [{ turn: 0, state: 'STALLED', cause: 'STARTER_WORLD_SEED/v1', note: 'A civic project stalled at the wet ground crossing.' }]
      },
      {
        id: 'district-westfold', name: 'Westfold Edge', lifecycleState: 'FAILED', held: false, heldFrom: null,
        stress: 16, failureCause: 'ENERGY_ISOLATION', repair: null,
        history: [{ turn: 0, state: 'FAILED', cause: 'STARTER_WORLD_SEED/v1', note: 'A prior settlement failed; its history is intentionally retained.' }]
      }
    ];
  }

  function getCell(state, cellId) {
    return state.map.cells.filter(function (cell) { return cell.id === cellId; })[0] || null;
  }

  function neighbors(map, cellId) {
    var cell = map.cells.filter(function (candidate) { return candidate.id === cellId; })[0];
    if (!cell) return [];
    return map.cells.filter(function (candidate) {
      return Math.abs(candidate.x - cell.x) + Math.abs(candidate.y - cell.y) === 1;
    }).sort(function (a, b) { return a.id.localeCompare(b.id); });
  }

  function validateZone(zone) { return ZONES.indexOf(String(zone || '').toUpperCase()) >= 0; }

  function paintZones(state, cellIds, zone) {
    var targetZone = String(zone || '').toUpperCase();
    if (!validateZone(targetZone)) return { ok: false, errors: ['unsupported zone'] };
    var unique = Array.from(new Set((cellIds || []).map(String))).sort();
    if (!unique.length || unique.length > 20) return { ok: false, errors: ['paint 1 to 20 cells per explicit action'] };
    var missing = unique.filter(function (id) { return !getCell(state, id); });
    if (missing.length) return { ok: false, errors: ['unknown cells: ' + missing.join(', ')] };
    var changes = [];
    unique.forEach(function (id) {
      var cell = getCell(state, id);
      if (cell.zone !== targetZone) {
        changes.push({ cellId: id, from: cell.zone, to: targetZone });
        cell.zone = targetZone;
      }
    });
    return { ok: true, changes: changes, errors: [] };
  }

  return {
    ZONES: ZONES,
    TERRAIN: TERRAIN,
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    createStarterMap: createStarterMap,
    createStarterDistricts: createStarterDistricts,
    getCell: getCell,
    neighbors: neighbors,
    validateZone: validateZone,
    paintZones: paintZones
  };
});
