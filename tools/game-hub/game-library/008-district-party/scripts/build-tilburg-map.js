'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compactChunks } = require('./compact-tilburg-map');
const { placeGameplay } = require('./tilburg-gameplay-placement');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUT_DIRECTORY = path.join(PROJECT_ROOT, 'data', 'map-chunks');
const WORLD = Object.freeze({ width: 12288, height: 8192, tileSize: 16, chunkSize: 1024 });
const BBOX = Object.freeze({ west: 5.0028, south: 51.5186, east: 5.1798, north: 51.5924 });
const SNAPSHOT = '2026-07-18T00:00:00Z';
const API_ROOT = 'https://api.pdok.nl/lv/bgt/ogc/v1';
const COLLECTIONS = Object.freeze([
  { id: 'begroeidterreindeel', layer: 'ground', material: 'park' },
  { id: 'waterdeel', layer: 'details_below', material: 'water', collision: true },
  { id: 'wegdeel', layer: 'roads', material: 'road', classifyRoad: true },
  { id: 'spoor', layer: 'details_above', material: 'rail' },
  { id: 'pand', layer: 'buildings', material: 'building', collision: true },
]);

const OPEN_VENUES = Object.freeze({
  small: Object.freeze({
    id: 'small-venue-shell', name: 'SMALL VENUE SHELL', type: 'walkable_building',
    x: 5904, y: 4272, w: 336, h: 240, material: 'building', walkable: true,
    interiorKind: 'future_venue_shell', interiorZoneId: 'small-venue-interior',
    floorMaterial: 'interiorFloor', wallMaterial: 'interiorWall', accentMaterial: 'interiorAccent',
    subtitle: 'EMPTY INTERIOR · FLOOR READY',
    entrance: Object.freeze({ side: 'north', x: 6032, y: 4272, w: 64, h: 12 }),
  }),
  large: Object.freeze({
    id: 'large-venue-shell', name: 'LARGE VENUE SHELL', type: 'walkable_building',
    x: 6528, y: 4352, w: 768, h: 480, material: 'building', walkable: true,
    interiorKind: 'future_venue_shell', interiorZoneId: 'large-venue-interior',
    floorMaterial: 'interiorFloor', wallMaterial: 'interiorWall', accentMaterial: 'interiorAccent',
    subtitle: 'EMPTY HALL · FUTURE VENUE',
    entrance: Object.freeze({ side: 'north', x: 6864, y: 4352, w: 96, h: 12 }),
  }),
});

const RESERVED_CLEARINGS = Object.freeze([
  { id: 'party-house-clearing', x: 6380, y: 5960, w: 820, h: 560 },
  { id: 'courier-depot-clearing', x: 5760, y: 4970, w: 900, h: 620 },
  { id: 'command-a-clearing', x: 10720, y: 3690, w: 1000, h: 820 },
  { id: 'command-b-clearing', x: 560, y: 3690, w: 1000, h: 820 },
  { id: 'small-venue-clearing', x: 5840, y: 4176, w: 464, h: 400 },
  { id: 'large-venue-clearing', x: 6448, y: 4192, w: 976, h: 720 },
]);

function round(value, precision = 1) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function toWorld(coordinate) {
  return [
    round((coordinate[0] - BBOX.west) / (BBOX.east - BBOX.west) * WORLD.width),
    round((BBOX.north - coordinate[1]) / (BBOX.north - BBOX.south) * WORLD.height),
  ];
}

function squaredDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  const dx = end[0] - x;
  const dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const amount = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (amount > 1) { x = end[0]; y = end[1]; }
    else if (amount > 0) { x += dx * amount; y += dy * amount; }
  }
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

function simplify(points, tolerance = 1.5) {
  if (points.length <= 4) return points;
  const toleranceSquared = tolerance ** 2;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maximum = toleranceSquared;
    let selected = -1;
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredDistance(points[index], points[first], points[last]);
      if (distance > maximum) { maximum = distance; selected = index; }
    }
    if (selected >= 0) {
      keep[selected] = 1;
      stack.push([first, selected], [selected, last]);
    }
  }
  return points.filter((point, index) => keep[index]);
}

function cleanPoints(source, polygon) {
  let points = (source || []).map(toWorld).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (polygon && points.length > 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) points = points.slice(0, -1);
  }
  points = points.filter((point, index) => !index || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
  points = simplify(points, polygon ? 1.6 : 1.2);
  return points;
}

function geometryParts(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.slice(0, 1).map((points) => ({ type: 'polygon', points }));
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((polygon) => ({ type: 'polygon', points: polygon[0] || [] }));
  if (geometry.type === 'LineString') return [{ type: 'polyline', points: geometry.coordinates }];
  if (geometry.type === 'MultiLineString') return geometry.coordinates.map((points) => ({ type: 'polyline', points }));
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(geometryParts);
  return [];
}

function boundsForPoints(points) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { x, y, w: round(right - x), h: round(bottom - y), right, bottom };
}

function intersects(a, b) {
  return a.right >= b.x && a.x <= b.x + b.w && a.bottom >= b.y && a.y <= b.y + b.h;
}

function safeId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(-48);
}

function classifyRoad(properties) {
  const functionName = String(properties?.functie || properties?.plus_functie || '').toLowerCase();
  if (['voetpad', 'fietspad', 'ruiterpad', 'voetgangersgebied'].some((value) => functionName.includes(value))) {
    return { layer: 'sidewalks', material: 'sidewalk' };
  }
  return { layer: 'roads', material: 'road' };
}

function makeChunks() {
  const chunks = new Map();
  const columns = Math.ceil(WORLD.width / WORLD.chunkSize);
  const rows = Math.ceil(WORLD.height / WORLD.chunkSize);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const id = `tilburg-${String(column).padStart(2, '0')}-${String(row).padStart(2, '0')}`;
      chunks.set(`${column}:${row}`, {
        id,
        format: 'AXM_MAP_CHUNK_V1',
        column,
        row,
        bounds: {
          x: column * WORLD.chunkSize,
          y: row * WORLD.chunkSize,
          width: Math.min(WORLD.chunkSize, WORLD.width - column * WORLD.chunkSize),
          height: Math.min(WORLD.chunkSize, WORLD.height - row * WORLD.chunkSize),
        },
        layers: { ground: [], roads: [], sidewalks: [], buildings: [], details_below: [], details_above: [], collision: [] },
      });
    }
  }
  return chunks;
}

function addToChunks(chunks, layer, item, bounds) {
  const columns = Math.ceil(WORLD.width / WORLD.chunkSize);
  const rows = Math.ceil(WORLD.height / WORLD.chunkSize);
  const firstColumn = Math.max(0, Math.floor(bounds.x / WORLD.chunkSize));
  const lastColumn = Math.min(columns - 1, Math.floor(bounds.right / WORLD.chunkSize));
  const firstRow = Math.max(0, Math.floor(bounds.y / WORLD.chunkSize));
  const lastRow = Math.min(rows - 1, Math.floor(bounds.bottom / WORLD.chunkSize));
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) chunks.get(`${column}:${row}`).layers[layer].push(item);
  }
}

function transformFeature(chunks, collection, feature, counters) {
  const parts = geometryParts(feature.geometry);
  parts.forEach((part, partIndex) => {
    const points = cleanPoints(part.points, part.type === 'polygon');
    if (points.length < (part.type === 'polygon' ? 3 : 2)) return;
    const bounds = boundsForPoints(points);
    if (bounds.right < 0 || bounds.bottom < 0 || bounds.x > WORLD.width || bounds.y > WORLD.height) return;
    if (collection.id === 'pand' && (bounds.w < 2 || bounds.h < 2)) return;
    if (collection.collision && RESERVED_CLEARINGS.some((clearing) => intersects(bounds, clearing))) return;
    const roadClass = collection.classifyRoad ? classifyRoad(feature.properties) : null;
    const layer = roadClass?.layer || collection.layer;
    const material = roadClass?.material || collection.material;
    const item = {
      id: `bgt-${collection.id}-${safeId(feature.id)}-${partIndex}`,
      type: part.type,
      points,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      material,
    };
    if (part.type === 'polyline') item.lineWidth = collection.id === 'spoor' ? 5 : 3;
    if (collection.collision) item.collision = true;
    addToChunks(chunks, layer, item, bounds);
    counters[layer] = (counters[layer] || 0) + 1;
  });
}

function bboxString() {
  return [BBOX.west, BBOX.south, BBOX.east, BBOX.north].join(',');
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, retries = 4) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/geo+json, application/json', 'User-Agent': 'AXM-District-Party-local-map-builder/0.2' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(500 * attempt);
    }
  }
  throw new Error(`PDOK request failed after ${retries} attempts: ${lastError?.message || 'unknown error'} (${url})`);
}

async function acquireCollection(chunks, collection, counters) {
  const initial = new URL(`${API_ROOT}/collections/${collection.id}/items`);
  initial.searchParams.set('bbox', bboxString());
  initial.searchParams.set('datetime', SNAPSHOT);
  initial.searchParams.set('limit', '1000');
  initial.searchParams.set('f', 'json');
  let next = initial.href;
  let pages = 0;
  let features = 0;
  while (next) {
    const data = await fetchJson(next);
    pages += 1;
    for (const feature of data.features || []) {
      transformFeature(chunks, collection, feature, counters);
      features += 1;
    }
    next = (data.links || []).find((link) => link.rel === 'next')?.href || null;
    process.stdout.write(`[Tilburg map] ${collection.id}: page ${pages}, ${features} source features\n`);
    if (pages > 500) throw new Error(`Pagination safety stop reached for ${collection.id}`);
  }
  return { collection: collection.id, pages, sourceFeatureCount: features, initialQuery: initial.href };
}

function walkableBuildingWalls(building) {
  const wall = 12;
  const entrance = building.entrance;
  const prefix = building.id.replace(/-(?:shell|house)$/, '');
  const walls = [
    { id: `${prefix}-wall-west`, type: 'rect', x: building.x, y: building.y, w: wall, h: building.h, kind: 'interior-wall' },
    { id: `${prefix}-wall-east`, type: 'rect', x: building.x + building.w - wall, y: building.y, w: wall, h: building.h, kind: 'interior-wall' },
  ];
  if (entrance.side === 'south') {
    walls.push(
      { id: `${prefix}-wall-north`, type: 'rect', x: building.x, y: building.y, w: building.w, h: wall, kind: 'interior-wall' },
      { id: `${prefix}-wall-south-west`, type: 'rect', x: building.x, y: building.y + building.h - wall, w: entrance.x - building.x, h: wall, kind: 'interior-wall' },
      { id: `${prefix}-wall-south-east`, type: 'rect', x: entrance.x + entrance.w, y: building.y + building.h - wall, w: building.x + building.w - entrance.x - entrance.w, h: wall, kind: 'interior-wall' },
    );
  } else {
    walls.push(
      { id: `${prefix}-wall-south`, type: 'rect', x: building.x, y: building.y + building.h - wall, w: building.w, h: wall, kind: 'interior-wall' },
      { id: `${prefix}-wall-north-west`, type: 'rect', x: building.x, y: building.y, w: entrance.x - building.x, h: wall, kind: 'interior-wall' },
      { id: `${prefix}-wall-north-east`, type: 'rect', x: entrance.x + entrance.w, y: building.y, w: building.x + building.w - entrance.x - entrance.w, h: wall, kind: 'interior-wall' },
    );
  }
  return walls;
}

function globalGameplayLayers() {
  const base = { x: 6500, y: 6060, w: 560, h: 330 };
  const entrance = { side: 'south', x: 6745, y: base.y + base.h - 12, w: 70, h: 12 };
  const smallVenue = OPEN_VENUES.small;
  const largeVenue = OPEN_VENUES.large;
  return {
    ground: [
      { id: 'party-house-yard', type: 'rect', x: 6380, y: 5960, w: 820, h: 560, material: 'park' },
      { id: 'command-yard-a', type: 'rect', x: 10720, y: 3690, w: 1000, h: 820, material: 'park' },
      { id: 'command-yard-b', type: 'rect', x: 560, y: 3690, w: 1000, h: 820, material: 'park' },
    ],
    roads: [
      { id: 'party-house-drive', type: 'rect', x: 6240, y: 6400, w: 1120, h: 96, material: 'road' },
      { id: 'depot-access', type: 'rect', x: 5920, y: 4920, w: 112, h: 1220, material: 'road' },
    ],
    sidewalks: [
      { id: 'party-house-walk', type: 'rect', x: 6400, y: 6496, w: 900, h: 44, material: 'sidewalk' },
      { id: 'small-venue-approach', type: 'rect', x: 6016, y: 4208, w: 96, h: 64, material: 'sidewalk' },
      { id: 'large-venue-approach', type: 'rect', x: 6848, y: 4256, w: 128, h: 96, material: 'sidewalk' },
    ],
    buildings: [
      { id: 'courier-depot', name: 'AXM TILBURG COURIER DEPOT', type: 'rect', x: 6060, y: 5140, w: 480, h: 310, material: 'building' },
      { id: 'party-base-house', name: 'AXM PARTY HOUSE', type: 'walkable_building', ...base, material: 'building', walkable: true, interiorZoneId: 'party-base-interior', entrance },
      { ...smallVenue },
      { ...largeVenue },
    ],
    details_below: [
      { id: 'party-base-floor', type: 'rect', x: base.x + 12, y: base.y + 12, w: base.w - 24, h: base.h - 24, material: 'baseFloor' },
      { id: 'small-venue-floor', type: 'rect', x: smallVenue.x + 12, y: smallVenue.y + 12, w: smallVenue.w - 24, h: smallVenue.h - 24, material: 'interiorFloor' },
      { id: 'large-venue-floor', type: 'rect', x: largeVenue.x + 12, y: largeVenue.y + 12, w: largeVenue.w - 24, h: largeVenue.h - 24, material: 'interiorFloor' },
    ],
    details_above: [
      { id: 'party-yard-tree-a', type: 'circle', x: 6440, y: 6015, r: 20, material: 'tree' },
      { id: 'party-yard-tree-b', type: 'circle', x: 7135, y: 6015, r: 20, material: 'tree' },
    ],
    collision: [
      { id: 'world-wall-north', type: 'rect', x: 0, y: 0, w: WORLD.width, h: 24 },
      { id: 'world-wall-south', type: 'rect', x: 0, y: WORLD.height - 24, w: WORLD.width, h: 24 },
      { id: 'world-wall-west', type: 'rect', x: 0, y: 0, w: 24, h: WORLD.height },
      { id: 'world-wall-east', type: 'rect', x: WORLD.width - 24, y: 0, w: 24, h: WORLD.height },
      { id: 'depot-building', type: 'rect', x: 6060, y: 5140, w: 480, h: 310 },
      { id: 'party-base-wall-west', type: 'rect', x: base.x, y: base.y, w: 12, h: base.h, kind: 'base-wall' },
      { id: 'party-base-wall-east', type: 'rect', x: base.x + base.w - 12, y: base.y, w: 12, h: base.h, kind: 'base-wall' },
      { id: 'party-base-wall-north', type: 'rect', x: base.x, y: base.y, w: base.w, h: 12, kind: 'base-wall' },
      { id: 'party-base-wall-south-west', type: 'rect', x: base.x, y: base.y + base.h - 12, w: entrance.x - base.x, h: 12, kind: 'base-wall' },
      { id: 'party-base-wall-south-east', type: 'rect', x: entrance.x + entrance.w, y: base.y + base.h - 12, w: base.x + base.w - entrance.x - entrance.w, h: 12, kind: 'base-wall' },
      ...walkableBuildingWalls(smallVenue),
      ...walkableBuildingWalls(largeVenue),
    ],
    player_spawns: [
      { id: 'spawn-1', slot: 1, x: 6590, y: 6215, baseZoneId: 'party-base-interior' },
      { id: 'spawn-2', slot: 2, x: 6700, y: 6215, baseZoneId: 'party-base-interior' },
      { id: 'spawn-3', slot: 3, x: 6810, y: 6215, baseZoneId: 'party-base-interior' },
      { id: 'spawn-4', slot: 4, x: 6920, y: 6215, baseZoneId: 'party-base-interior' },
      { id: 'spawn-5', slot: 5, x: 1060, y: 4060 },
      { id: 'spawn-6', slot: 6, x: 1180, y: 4060 },
      { id: 'spawn-7', slot: 7, x: 1060, y: 4200 },
      { id: 'spawn-8', slot: 8, x: 1180, y: 4200 },
    ],
    vehicle_spawns: vehicleSpawns(),
    npc_spawns: npcSpawns(),
    rival_spawns: [
      { id: 'rival-city-1', x: 7350, y: 5600, role: 'rusher' },
      { id: 'rival-city-2', x: 7480, y: 5680, role: 'skirmisher' },
      { id: 'rival-city-3', x: 7380, y: 5800, role: 'blocker' },
    ],
    mission_zones: [
      { id: 'party-house-mission-board', kind: 'mission_board', x: 6540, y: 6140, w: 400, h: 92 },
      { id: 'depot-pickup', kind: 'pickup', x: 6080, y: 5500, w: 440, h: 130 },
      { id: 'delivery-reeshof', kind: 'delivery', x: 1980, y: 4300, w: 120, h: 120 },
      { id: 'delivery-centre', kind: 'delivery', x: 6070, y: 3920, w: 120, h: 120 },
      { id: 'delivery-north', kind: 'delivery', x: 6900, y: 2180, w: 120, h: 120 },
      { id: 'delivery-east', kind: 'delivery', x: 9670, y: 4240, w: 120, h: 120 },
      { id: 'delivery-south', kind: 'delivery', x: 6180, y: 7180, w: 120, h: 120 },
    ],
    safe_zones: [
      { id: 'party-house-safe', name: 'PARTY HOUSE SAFE SPAWN', x: 6380, y: 5960, w: 820, h: 560 },
      { id: 'depot-safe', name: 'COURIER SAFE ZONE', x: 5980, y: 5460, w: 640, h: 220 },
    ],
    base_zones: [
      { id: 'party-base-interior', name: 'AXM PARTY HOUSE', kind: 'party_base', partyId: 'party_a', x: base.x + 12, y: base.y + 12, w: base.w - 24, h: base.h - 24, healthRegenPerSecond: 10, defaultHealthRegenCap: 100, shieldRegenPerSecond: 0 },
    ],
    interior_zones: [
      { id: 'small-venue-interior', name: 'SMALL VENUE SHELL', kind: 'future_venue_shell', status: 'floor_ready', contentModule: null, x: smallVenue.x + 12, y: smallVenue.y + 12, w: smallVenue.w - 24, h: smallVenue.h - 24, entrance: { ...smallVenue.entrance } },
      { id: 'large-venue-interior', name: 'LARGE VENUE SHELL', kind: 'future_venue_shell', status: 'floor_ready', contentModule: null, x: largeVenue.x + 12, y: largeVenue.y + 12, w: largeVenue.w - 24, h: largeVenue.h - 24, entrance: { ...largeVenue.entrance } },
    ],
    party_regroup_zones: [
      { id: 'tilburg-centre-regroup', x: 5980, y: 3820, w: 320, h: 320 },
    ],
  };
}

function vehicleSpawns() {
  return [
    { id: 'vehicle-001', kind: 'district-runner', x: 6380, y: 6535, rotation: 0, maxOccupants: 4, health: 50, style: 'teal' },
    { id: 'vehicle-002', kind: 'courier-van', x: 6500, y: 6535, rotation: 0, maxOccupants: 4, health: 50, style: 'amber' },
    { id: 'vehicle-003', kind: 'district-runner', x: 2360, y: 4260, rotation: 0, maxOccupants: 4, health: 50, style: 'teal' },
    { id: 'vehicle-004', kind: 'courier-van', x: 5100, y: 3930, rotation: Math.PI / 2, maxOccupants: 4, health: 50, style: 'amber' },
    { id: 'vehicle-005', kind: 'district-runner', x: 8200, y: 3970, rotation: Math.PI, maxOccupants: 4, health: 50, style: 'teal' },
    { id: 'vehicle-006', kind: 'courier-van', x: 9720, y: 4540, rotation: Math.PI / 2, maxOccupants: 4, health: 50, style: 'amber' },
    { id: 'vehicle-007', kind: 'district-runner', x: 6900, y: 2280, rotation: 0, maxOccupants: 4, health: 50, style: 'teal' },
    { id: 'vehicle-008', kind: 'courier-van', x: 6080, y: 7100, rotation: Math.PI, maxOccupants: 4, health: 50, style: 'amber' },
  ];
}

function routeDefinitions() {
  const rectangles = [
    ['route-reeshof-west', 1100, 3350, 2850, 4750],
    ['route-west-ring', 3100, 3000, 4700, 5000],
    ['route-centre-loop', 5200, 3300, 7100, 4550],
    ['route-north-loop', 5100, 1700, 7600, 2950],
    ['route-east-loop', 7600, 3200, 10100, 5000],
    ['route-south-loop', 5000, 5600, 7600, 7350],
    ['route-outer-west', 900, 1900, 4700, 6400],
    ['route-outer-east', 7400, 1700, 11100, 6500],
    ['route-spoorzone', 4300, 2850, 7600, 3550],
    ['route-piushaven', 6300, 4200, 8200, 5500],
    ['route-stappegoor', 4800, 6200, 6800, 7600],
    ['route-municipal', 3600, 2500, 9100, 6900],
  ];
  return rectangles.map(([id, left, top, right, bottom]) => ({
    id,
    closed: true,
    points: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }],
  }));
}

function npcSpawns() {
  return routeDefinitions().flatMap((route, routeIndex) => [0, 2].map((pointIndex, copy) => ({
    id: `npc-${String(routeIndex * 2 + copy + 1).padStart(3, '0')}`,
    x: route.points[pointIndex].x + 28 + copy * 18,
    y: route.points[pointIndex].y + 28,
    routeId: route.id,
  })));
}

function territoryData() {
  return {
    id: 'tilburg-district-dominion-v0-2',
    mode: 'district_dominion',
    title: 'Tilburg District Dominion',
    roundSeconds: 600,
    scoreGoal: 360,
    captureRatePerSecond: 15,
    scoreIntervalSeconds: 1,
    startingPartyFundCents: 5000,
    incomeIntervalSeconds: 5,
    incomePerOwnedZoneCents: 100,
    reinforcement: { costCents: 2500, squadSize: 2, maxActivePerParty: 4, lifetimeSeconds: 120, purchaseCooldownSeconds: 3 },
    playerSpawns: [
      { slot: 1, partyId: 'party_a', x: 11080, y: 4050 }, { slot: 2, partyId: 'party_a', x: 11080, y: 4160 },
      { slot: 3, partyId: 'party_a', x: 11210, y: 4050 }, { slot: 4, partyId: 'party_a', x: 11210, y: 4160 },
      { slot: 5, partyId: 'party_b', x: 1060, y: 4050 }, { slot: 6, partyId: 'party_b', x: 1060, y: 4160 },
      { slot: 7, partyId: 'party_b', x: 1190, y: 4050 }, { slot: 8, partyId: 'party_b', x: 1190, y: 4160 },
    ],
    vehicleSpawns: [
      { id: 'vehicle-001', x: 10940, y: 4380, rotation: Math.PI, maxOccupants: 4, health: 50, style: 'teal' },
      { id: 'vehicle-002', x: 11200, y: 4380, rotation: Math.PI, maxOccupants: 4, health: 50, style: 'amber' },
      { id: 'vehicle-003', x: 1340, y: 4380, rotation: 0, maxOccupants: 4, health: 50, style: 'teal' },
      { id: 'vehicle-004', x: 1080, y: 4380, rotation: 0, maxOccupants: 4, health: 50, style: 'amber' },
      { id: 'vehicle-005', x: 6120, y: 3520, rotation: Math.PI / 2, maxOccupants: 4, health: 50, style: 'teal' },
      { id: 'vehicle-006', x: 6160, y: 5150, rotation: -Math.PI / 2, maxOccupants: 4, health: 50, style: 'amber' },
    ],
    commandPosts: {
      party_a: {
        id: 'command-post-a', label: 'Party A East Command', x: 11150, y: 4110, radius: 120,
        reinforcementSpawn: { x: 10880, y: 4110 },
        safeZone: { id: 'dominion-safe-a', x: 10820, y: 3830, width: 650, height: 560 },
        baseZone: { id: 'dominion-base-a', partyId: 'party_a', x: 10820, y: 3830, width: 650, height: 560, healthRegenPerSecond: 10 },
      },
      party_b: {
        id: 'command-post-b', label: 'Party B West Command', x: 1130, y: 4110, radius: 120,
        reinforcementSpawn: { x: 1400, y: 4110 },
        safeZone: { id: 'dominion-safe-b', x: 810, y: 3830, width: 650, height: 560 },
        baseZone: { id: 'dominion-base-b', partyId: 'party_b', x: 810, y: 3830, width: 650, height: 560, healthRegenPerSecond: 10 },
      },
    },
    zones: [
      { id: 'reeshof-west', label: 'Reeshof West', x: 2050, y: 4180, radius: 95, initialOwnerPartyId: 'party_b' },
      { id: 'wandelbos', label: 'Wandelbos', x: 3520, y: 2650, radius: 90, initialOwnerPartyId: null },
      { id: 'west-ring', label: 'West Ring', x: 4100, y: 4200, radius: 95, initialOwnerPartyId: null },
      { id: 'northwest-gate', label: 'Northwest Gate', x: 4950, y: 1900, radius: 90, initialOwnerPartyId: null },
      { id: 'spoorzone', label: 'Spoorzone', x: 5700, y: 3250, radius: 105, initialOwnerPartyId: null },
      { id: 'city-centre', label: 'City Centre', x: 6200, y: 4030, radius: 115, initialOwnerPartyId: null },
      { id: 'north-ring', label: 'North Ring', x: 6900, y: 2100, radius: 90, initialOwnerPartyId: null },
      { id: 'piushaven', label: 'Piushaven', x: 7050, y: 4900, radius: 100, initialOwnerPartyId: null },
      { id: 'stappegoor', label: 'Stappegoor', x: 6150, y: 6950, radius: 95, initialOwnerPartyId: null },
      { id: 'south-gate', label: 'South Gate', x: 8100, y: 6500, radius: 90, initialOwnerPartyId: null },
      { id: 'east-ring', label: 'East Ring', x: 8450, y: 4050, radius: 95, initialOwnerPartyId: null },
      { id: 'moerenburg', label: 'Moerenburg', x: 9800, y: 5000, radius: 90, initialOwnerPartyId: null },
      { id: 'east-gate', label: 'East Gate', x: 10400, y: 4100, radius: 95, initialOwnerPartyId: 'party_a' },
    ],
  };
}

function missionData() {
  return {
    modes: ['supply_sweep', 'hold_relay', 'courier_chaos', 'chaos_call', 'free_roam'],
    sessionModes: ['coop_adventure', 'district_dominion'],
    defaultMode: 'free_roam',
    layoutSource: 'data/mission-layouts.json',
    layoutSelection: 'host-shuffled-route-deck-no-immediate-repeat',
    supply_sweep: { title: 'Supply Sweep', description: 'Search one of four Tilburg activity areas for six supplies; some routes include light rival resistance.', roundSeconds: 120, goal: 6, rewardCents: 1500, start: { x: 6200, y: 4040 } },
    hold_relay: { title: 'Hold the Relay', description: 'Protect a relay at one of four district sites through three short, location-specific rival waves.', roundSeconds: 150, waves: 3, relayHealth: 30, rewardCents: 2500, start: { x: 7050, y: 4900 } },
    courier_chaos: { title: 'Courier Chaos', description: "Collect packages from one of four dispatch points and choose among that route's active city drop zones.", roundSeconds: 420, deliveryGoal: 8, packageSpawnZoneId: 'depot-pickup', deliveryZoneIds: ['delivery-reeshof', 'delivery-centre', 'delivery-north', 'delivery-east', 'delivery-south'], scorePerDelivery: 100, vehicleAssistBonus: 25, rewardCents: 2000, start: { x: 6300, y: 5570 }, finalPackage: { implemented: false, reservedRule: 'vehicle-required' } },
    chaos_call: { title: 'Call the Heat', description: 'Willingly trigger a short justice response from one of four city districts.', roundSeconds: 90, rewardCents: 0, start: { x: 6200, y: 4040 } },
  };
}

function buildMapManifest(chunks, counters, runtimeRectangles, gameplayLayers, placement) {
  const chunkEntries = [...chunks.values()].map((chunk) => ({
    id: chunk.id,
    column: chunk.column,
    row: chunk.row,
    x: chunk.bounds.x,
    y: chunk.bounds.y,
    width: chunk.bounds.width,
    height: chunk.bounds.height,
    path: `/data/map-chunks/chunk-${String(chunk.column).padStart(2, '0')}-${String(chunk.row).padStart(2, '0')}.json`,
    featureCount: Object.values(chunk.layers).reduce((sum, features) => sum + features.length, 0),
  }));
  return {
    id: 'tilburg-city-foundation-v0-2',
    format: 'AXM_CHUNKED_CITY_MAP',
    generatedWithTiled: false,
    generatedFrom: 'PDOK BGT OGC API plus original AXM gameplay overlays',
    tileSize: WORLD.tileSize,
    sourceGrid: { columns: WORLD.width / WORLD.tileSize, rows: WORLD.height / WORLD.tileSize },
    world: { width: WORLD.width, height: WORLD.height },
    geography: { place: 'Tilburg, Noord-Brabant, Netherlands', bboxWgs84: [BBOX.west, BBOX.south, BBOX.east, BBOX.north], snapshot: SNAPSHOT, gameScale: 'approximately one world pixel per metre; stylized and not navigation-accurate' },
    palette: { ground: '#233a35', road: '#303942', roadEdge: '#66737b', sidewalk: '#a8a79b', building: '#6e5960', buildingRoof: '#9f7880', baseFloor: '#34554d', baseWall: '#75c8ae', interiorFloor: '#34343c', interiorWall: '#d49a62', interiorAccent: '#ffd27e', park: '#39754c', water: '#3e7890', rail: '#868b87', safe: '#4ec6a5' },
    chunking: { enabled: true, strategy: 'party-camera-visible-plus-one-chunk', chunkSize: WORLD.chunkSize, columns: WORLD.width / WORLD.chunkSize, rows: WORLD.height / WORLD.chunkSize, prefetchMarginChunks: 1, cacheLimit: 32, chunks: chunkEntries },
    statistics: { sourceDerivedFeatures: counters, runtimeRectangles, compaction: 'BGT geometry raster-indexed to the declared 16px source-tile grid, then contiguous tiles merged into rectangles', gameplayPlacement: placement, chunkCount: chunkEntries.length, groundAreaComparedWithV017: 96 },
    layers: gameplayLayers,
  };
}

function runtimeCounts(chunks) {
  const counts = {};
  for (const chunk of chunks.values()) {
    for (const [layer, items] of Object.entries(chunk.layers)) counts[layer] = (counts[layer] || 0) + items.length;
  }
  return counts;
}

function hashFiles(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function writeJson(relativePath, value) {
  const output = path.join(PROJECT_ROOT, relativePath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
  return output;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  for (const name of fs.readdirSync(OUTPUT_DIRECTORY)) {
    if (/^chunk-\d+-\d+\.json$/.test(name)) fs.unlinkSync(path.join(OUTPUT_DIRECTORY, name));
  }
  const chunks = makeChunks();
  const counters = {};
  const acquisition = await Promise.all(
    COLLECTIONS.map((collection) => acquireCollection(chunks, collection, counters)),
  );
  compactChunks(chunks, WORLD);
  const gameplayLayers = globalGameplayLayers();
  const territory = territoryData();
  const missions = missionData();
  const routes = { routes: routeDefinitions() };
  const vehicles = { vehicles: gameplayLayers.vehicle_spawns.map((entry) => ({ ...entry })) };
  const placement = placeGameplay({
    chunks,
    layers: gameplayLayers,
    territory,
    missions,
    routes,
    vehicles,
    world: WORLD,
    fixedClearings: RESERVED_CLEARINGS,
  });
  const runtimeRectangles = runtimeCounts(chunks);

  const chunkFiles = [];
  for (const chunk of chunks.values()) {
    const filename = `chunk-${String(chunk.column).padStart(2, '0')}-${String(chunk.row).padStart(2, '0')}.json`;
    chunkFiles.push(writeJson(path.join('data', 'map-chunks', filename), chunk));
  }
  const map = buildMapManifest(chunks, counters, runtimeRectangles, gameplayLayers, placement);
  const mapFile = writeJson(path.join('data', 'map.json'), map);
  writeJson(path.join('data', 'npc-routes.json'), routes);
  writeJson(path.join('data', 'vehicle-spawns.json'), vehicles);
  writeJson(path.join('data', 'territory-zones.json'), territory);
  writeJson(path.join('data', 'missions.json'), missions);
  const generatedHash = hashFiles([mapFile, ...chunkFiles]);
  const index = {
    id: 'tilburg-pdok-bgt-source-index-v0-2',
    generatedAt: new Date().toISOString(),
    source: { publisher: 'PDOK / Dutch BGT source holders', api: API_ROOT, datasetDocumentation: 'https://www.pdok.nl/ogc-apis/-/article/basisregistratie-grootschalige-topografie-bgt-', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    query: { bboxWgs84: [BBOX.west, BBOX.south, BBOX.east, BBOX.north], snapshotDatetime: SNAPSHOT, collections: acquisition },
    transform: { world: WORLD, projection: 'linear WGS84 bbox to local game coordinates', geometrySimplificationPixels: { polygon: 1.6, polyline: 1.2 }, polygonInteriorRings: 'omitted in first ground pass', runtimeCompaction: 'BGT geometry raster-indexed to the declared 16px source-tile grid, then contiguous tiles merged into rectangles', gameplayPlacement: placement, style: 'original AXM palette; no map imagery copied', rawSourceArchivesIncluded: false },
    output: { map: 'data/map.json', chunkDirectory: 'data/map-chunks', chunkCount: chunkFiles.length, sourceDerivedFeatures: counters, runtimeRectangles, sha256MapAndChunks: generatedHash },
    limitations: ['Game geometry is stylized and must not be used for navigation.', 'First pass keeps outer polygon rings only.', 'Handcrafted gameplay clearings override some source buildings around bases and mission staging.'],
  };
  writeJson(path.join('data', 'tilburg-source-index.json'), index);
  process.stdout.write(`[Tilburg map] complete: ${chunkFiles.length} chunks, hash ${generatedHash}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[Tilburg map] build failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { BBOX, COLLECTIONS, SNAPSHOT, WORLD, boundsForPoints, classifyRoad, geometryParts, simplify, toWorld };
