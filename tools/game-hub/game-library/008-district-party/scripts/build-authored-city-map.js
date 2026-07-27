'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'maps', 'tilburg-authored-city-alpha');
const CHUNKS = path.join(OUTPUT, 'map-chunks');
const WORLD = Object.freeze({ width: 12288, height: 8192, tileSize: 16, chunkSize: 1024 });

const verticalRoads = [
  { at: 384, width: 72, roadClass: 'local' },
  { at: 1024, width: 80, roadClass: 'collector' },
  { at: 2048, width: 136, roadClass: 'arterial' },
  { at: 2944, width: 76, roadClass: 'local' },
  { at: 3968, width: 84, roadClass: 'collector' },
  { at: 4864, width: 104, roadClass: 'boulevard' },
  { at: 6144, width: 144, roadClass: 'civic' },
  { at: 7424, width: 104, roadClass: 'boulevard' },
  { at: 8448, width: 136, roadClass: 'arterial' },
  { at: 9472, width: 80, roadClass: 'collector' },
  { at: 10560, width: 136, roadClass: 'arterial' },
  { at: 11776, width: 76, roadClass: 'local' },
];

const horizontalRoads = [
  { at: 384, width: 72, roadClass: 'local' },
  { at: 1152, width: 84, roadClass: 'collector' },
  { at: 2048, width: 136, roadClass: 'arterial' },
  { at: 2944, width: 84, roadClass: 'collector' },
  { at: 4096, width: 144, roadClass: 'civic' },
  { at: 5248, width: 104, roadClass: 'boulevard' },
  { at: 6400, width: 136, roadClass: 'arterial' },
  { at: 7552, width: 80, roadClass: 'collector' },
];

const reserved = [
  { id: 'party-house-plaza', x: 5160, y: 4300, w: 850, h: 610 },
  { id: 'central-depot', x: 7620, y: 4310, w: 650, h: 560 },
  { id: 'west-command', x: 620, y: 3520, w: 760, h: 920 },
  { id: 'east-command', x: 10880, y: 3520, w: 760, h: 920 },
  { id: 'central-station', x: 5150, y: 2200, w: 1980, h: 520 },
  { id: 'textile-works', x: 3150, y: 3180, w: 680, h: 500 },
  { id: 'city-market', x: 6450, y: 3240, w: 650, h: 470 },
  { id: 'ring-arena', x: 2780, y: 6560, w: 1160, h: 720 },
  { id: 'harbour-basin', x: 7500, y: 5580, w: 4788, h: 470 },
];

const chunks = new Map();

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return result >>> 0;
}

function chunkKey(column, row) { return `${column}:${row}`; }

function makeChunks() {
  for (let row = 0; row < WORLD.height / WORLD.chunkSize; row += 1) {
    for (let column = 0; column < WORLD.width / WORLD.chunkSize; column += 1) {
      const x = column * WORLD.chunkSize, y = row * WORLD.chunkSize;
      chunks.set(chunkKey(column, row), {
        id: `authored-city-${String(column).padStart(2, '0')}-${String(row).padStart(2, '0')}`,
        format: 'AXM_MAP_CHUNK_V1', column, row,
        bounds: { x, y, width: WORLD.chunkSize, height: WORLD.chunkSize },
        layers: { ground: [], roads: [], sidewalks: [], buildings: [], details_below: [], details_above: [], collision: [] },
      });
    }
  }
}

function rectSize(item) { return { width: Number(item.w ?? item.width) || 0, height: Number(item.h ?? item.height) || 0 }; }

function addRect(layer, item) {
  const { width, height } = rectSize(item);
  if (width <= 0 || height <= 0) return;
  const firstColumn = Math.max(0, Math.floor(item.x / WORLD.chunkSize));
  const lastColumn = Math.min(11, Math.floor((item.x + width - 0.001) / WORLD.chunkSize));
  const firstRow = Math.max(0, Math.floor(item.y / WORLD.chunkSize));
  const lastRow = Math.min(7, Math.floor((item.y + height - 0.001) / WORLD.chunkSize));
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const left = Math.max(item.x, column * WORLD.chunkSize);
      const top = Math.max(item.y, row * WORLD.chunkSize);
      const right = Math.min(item.x + width, (column + 1) * WORLD.chunkSize);
      const bottom = Math.min(item.y + height, (row + 1) * WORLD.chunkSize);
      if (right <= left || bottom <= top) continue;
      chunks.get(chunkKey(column, row)).layers[layer].push({
        ...item,
        sourceId: item.sourceId || item.id,
        sourceRect: item.sourceRect || { x: item.x, y: item.y, w: width, h: height },
        id: `${item.id}-c${column}-${row}`,
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
      });
    }
  }
}

function addPoint(layer, item) {
  const column = Math.max(0, Math.min(11, Math.floor(item.x / WORLD.chunkSize)));
  const row = Math.max(0, Math.min(7, Math.floor(item.y / WORLD.chunkSize)));
  chunks.get(chunkKey(column, row)).layers[layer].push(item);
}

function intersects(a, b, margin = 0) {
  const as = rectSize(a), bs = rectSize(b);
  return a.x < b.x + bs.width + margin && a.x + as.width > b.x - margin
    && a.y < b.y + bs.height + margin && a.y + as.height > b.y - margin;
}

function roadSurfaces() {
  for (const [direction, roads] of [['vertical', verticalRoads], ['horizontal', horizontalRoads]]) {
    for (const road of roads) {
      const vertical = direction === 'vertical';
      const surface = vertical
        ? { x: road.at - road.width / 2, y: 0, w: road.width, h: WORLD.height }
        : { x: 0, y: road.at - road.width / 2, w: WORLD.width, h: road.width };
      addRect('sidewalks', {
        id: `authored-${direction}-pavement-${road.at}`, type: 'rect', material: 'sidewalk', authored: true,
        x: surface.x - 28, y: surface.y - 28, w: surface.w + 56, h: surface.h + 56,
      });
      addRect('roads', {
        id: `authored-${direction}-road-${road.at}`, type: 'rect', material: 'road', authored: true,
        direction, roadClass: road.roadClass, ...surface,
      });
      if (road.roadClass !== 'local') {
        const length = vertical ? WORLD.height : WORLD.width;
        for (let distance = 180; distance < length; distance += 320) {
          for (const side of [-1, 1]) addPoint('details_above', vertical ? {
            id: `lamp-v-${road.at}-${distance}-${side}`, type: 'circle', material: 'street_lamp', authored: true,
            x: road.at + side * (road.width / 2 + 16), y: distance, r: 4,
          } : {
            id: `lamp-h-${road.at}-${distance}-${side}`, type: 'circle', material: 'street_lamp', authored: true,
            x: distance, y: road.at + side * (road.width / 2 + 16), r: 4,
          });
        }
      }
    }
  }

  for (const [direction, roads, crossings] of [
    ['vertical', verticalRoads, horizontalRoads],
    ['horizontal', horizontalRoads, verticalRoads],
  ]) {
    for (const road of roads) {
      const stops = [{ at: 0, width: 0 }, ...crossings, { at: direction === 'vertical' ? WORLD.height : WORLD.width, width: 0 }];
      for (let index = 0; index < stops.length - 1; index += 1) {
        const start = stops[index].at + stops[index].width / 2 + 34;
        const end = stops[index + 1].at - stops[index + 1].width / 2 - 34;
        if (end - start < 70) continue;
        addRect('details_above', direction === 'vertical' ? {
          id: `mark-v-${road.at}-${index}`, type: 'rect', material: 'road_marking', authored: true,
          direction, roadClass: road.roadClass, x: road.at - road.width / 2, y: start, w: road.width, h: end - start,
        } : {
          id: `mark-h-${road.at}-${index}`, type: 'rect', material: 'road_marking', authored: true,
          direction, roadClass: road.roadClass, x: start, y: road.at - road.width / 2, w: end - start, h: road.width,
        });
      }
    }
  }

  for (const vertical of verticalRoads) {
    for (const horizontal of horizontalRoads) {
      if (vertical.roadClass === 'local' && horizontal.roadClass === 'local') continue;
      addRect('details_above', {
        id: `crosswalk-${vertical.at}-${horizontal.at}`, type: 'authored_crosswalk', material: 'road_marking', authored: true,
        x: vertical.at - vertical.width / 2, y: horizontal.at - horizontal.width / 2,
        w: vertical.width, h: horizontal.width,
        verticalClass: vertical.roadClass, horizontalClass: horizontal.roadClass,
      });
    }
  }
}

function openIntervals(roads, limit) {
  const intervals = [];
  let cursor = 64;
  for (const road of roads) {
    const edge = road.at - road.width / 2 - 29;
    if (edge - cursor >= 150) intervals.push([cursor, edge]);
    cursor = road.at + road.width / 2 + 29;
  }
  if (limit - 64 - cursor >= 150) intervals.push([cursor, limit - 64]);
  return intervals;
}

function districtFor(x, y) {
  if (y < 2500 && x > 4500 && x < 7600) return 'rail-quarter';
  if (x < 4300 && y > 2700 && y < 5200) return 'textile-quarter';
  if (x > 7600 && y > 5200) return 'harbour-works';
  if (x > 4700 && x < 7600 && y > 2700 && y < 5400) return 'old-centre';
  if (x < 4700 && y > 5600) return 'ring-park';
  if (x > 7600 && y < 3000) return 'north-campus';
  if (x > 7800) return 'east-terraces';
  return 'garden-districts';
}

function buildingStyle(district, seed) {
  const styles = {
    'old-centre': ['terrace', 'shop-row', 'civic-slab'],
    'rail-quarter': ['brick-loft', 'office', 'workshop'],
    'textile-quarter': ['sawtooth', 'brick-loft', 'warehouse'],
    'harbour-works': ['warehouse', 'sawtooth', 'industrial-slab'],
    'ring-park': ['apartment', 'terrace', 'sports-hall'],
    'north-campus': ['campus', 'glass-office', 'civic-slab'],
    'east-terraces': ['apartment', 'row-house', 'shop-row'],
    'garden-districts': ['row-house', 'terrace', 'apartment'],
  }[district];
  return styles[seed % styles.length];
}

function addTrees(rect, seed, count) {
  const { width, height } = rectSize(rect);
  for (let index = 0; index < count; index += 1) {
    const x = rect.x + 18 + hash(`${seed}:tree-x:${index}`) % Math.max(1, Math.floor(width - 36));
    const y = rect.y + 18 + hash(`${seed}:tree-y:${index}`) % Math.max(1, Math.floor(height - 36));
    addPoint('details_above', {
      id: `tree-${seed}-${index}`, type: 'circle', material: 'authored_tree', authored: true,
      x, y, r: 9 + hash(`${seed}:tree-r:${index}`) % 7,
    });
  }
}

function cityBlocks() {
  const xIntervals = openIntervals(verticalRoads, WORLD.width);
  const yIntervals = openIntervals(horizontalRoads, WORLD.height);
  let buildingNumber = 0;
  for (let yi = 0; yi < yIntervals.length; yi += 1) {
    for (let xi = 0; xi < xIntervals.length; xi += 1) {
      const [left, right] = xIntervals[xi], [top, bottom] = yIntervals[yi];
      const block = { id: `block-${xi}-${yi}`, x: left, y: top, w: right - left, h: bottom - top };
      const seed = hash(block.id), centreX = (left + right) / 2, centreY = (top + bottom) / 2;
      const district = districtFor(centreX, centreY);
      const overlapsReserved = reserved.some((zone) => intersects(block, zone));

      if (!overlapsReserved && seed % 10 === 0) {
        addRect('ground', { ...block, id: `${block.id}-park`, type: 'rect', material: 'park', authored: true, district });
        addRect('details_above', {
          id: `${block.id}-park-path-h`, type: 'rect', material: 'park_path', authored: true,
          x: left + 18, y: centreY - 9, w: block.w - 36, h: 18,
        });
        addRect('details_above', {
          id: `${block.id}-park-path-v`, type: 'rect', material: 'park_path', authored: true,
          x: centreX - 9, y: top + 18, w: 18, h: block.h - 36,
        });
        addTrees(block, seed, Math.min(18, Math.max(6, Math.floor(block.w * block.h / 28000))));
        continue;
      }

      if (!overlapsReserved && seed % 13 === 0) {
        addRect('ground', { ...block, id: `${block.id}-parking`, type: 'rect', material: 'parking', authored: true, district });
        for (let px = left + 28; px < right - 44; px += 58) {
          addRect('details_above', { id: `${block.id}-bay-${px}`, type: 'rect', material: 'parking_bay', authored: true, x: px, y: top + 24, w: 38, h: Math.min(76, block.h - 48) });
        }
        addTrees({ x: left, y: top, w: block.w, h: Math.min(46, block.h) }, seed, Math.min(8, Math.floor(block.w / 130)));
        continue;
      }

      const industrial = ['textile-quarter', 'harbour-works'].includes(district);
      const columns = industrial ? Math.max(1, Math.min(2, Math.floor(block.w / 320))) : Math.max(1, Math.min(4, Math.floor(block.w / 205)));
      const rows = industrial ? Math.max(1, Math.min(2, Math.floor(block.h / 290))) : Math.max(1, Math.min(3, Math.floor(block.h / 190)));
      const gap = industrial ? 34 : 20;
      const cellWidth = (block.w - gap * (columns + 1)) / columns;
      const cellHeight = (block.h - gap * (rows + 1)) / rows;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const lotSeed = hash(`${block.id}:${column}:${row}`);
          const inset = industrial ? 5 + lotSeed % 11 : 5 + lotSeed % 16;
          const candidate = {
            x: left + gap + column * (cellWidth + gap) + inset,
            y: top + gap + row * (cellHeight + gap) + inset,
            w: Math.max(74, cellWidth - inset * 2),
            h: Math.max(70, cellHeight - inset * 2),
          };
          if (reserved.some((zone) => intersects(candidate, zone, 18))) continue;
          buildingNumber += 1;
          addRect('buildings', {
            id: `authored-building-${String(buildingNumber).padStart(4, '0')}`,
            type: 'rect', material: 'building', authored: true, collision: true, district,
            roofStyle: buildingStyle(district, lotSeed), roofTone: lotSeed % 9,
            ...candidate,
          });
          if (!industrial && lotSeed % 3 === 0) {
            const treeLine = { x: candidate.x, y: candidate.y + candidate.h + 5, w: candidate.w, h: 22 };
            if (treeLine.y + treeLine.h < bottom) addTrees(treeLine, lotSeed, Math.min(4, Math.max(1, Math.floor(candidate.w / 100))));
          }
        }
      }
    }
  }
}

function authoredLandmarks() {
  const buildings = [
    { id: 'central-station-building', x: 5210, y: 2215, w: 1860, h: 270, roofStyle: 'station', district: 'rail-quarter' },
    { id: 'textile-works-building', x: 3220, y: 3250, w: 540, h: 350, roofStyle: 'sawtooth', district: 'textile-quarter' },
    { id: 'city-market-building', x: 6510, y: 3310, w: 530, h: 320, roofStyle: 'market-hall', district: 'old-centre' },
    { id: 'ring-arena-building', x: 2860, y: 6640, w: 1000, h: 560, roofStyle: 'arena', district: 'ring-park' },
    { id: 'harbour-warehouse-a', x: 8650, y: 5300, w: 620, h: 220, roofStyle: 'warehouse', district: 'harbour-works' },
    { id: 'harbour-warehouse-b', x: 9720, y: 5300, w: 610, h: 220, roofStyle: 'sawtooth', district: 'harbour-works' },
    { id: 'party-house-building', x: 5200, y: 4350, w: 330, h: 150, roofStyle: 'brick-loft', district: 'old-centre' },
  ];
  for (const building of buildings) addRect('buildings', { ...building, type: 'rect', material: 'building', authored: true, landmark: true, collision: true, roofTone: hash(building.id) % 9 });

  addRect('details_below', { id: 'harbour-water', type: 'rect', material: 'water', authored: true, x: 7500, y: 5700, w: 4788, h: 230 });
  addRect('sidewalks', { id: 'north-quay', type: 'rect', material: 'sidewalk', authored: true, x: 7500, y: 5628, w: 4788, h: 72 });
  addRect('sidewalks', { id: 'south-quay', type: 'rect', material: 'sidewalk', authored: true, x: 7500, y: 5930, w: 4788, h: 72 });
  const bridgeAxes = verticalRoads.filter((road) => road.at >= 7500).map((road) => ({ start: road.at - road.width / 2 - 18, end: road.at + road.width / 2 + 18 }));
  let cursor = 7500;
  for (const bridge of bridgeAxes) {
    if (bridge.start > cursor) addRect('collision', { id: `harbour-bank-${cursor}`, type: 'rect', material: 'water', x: cursor, y: 5700, w: bridge.start - cursor, h: 230 });
    cursor = Math.max(cursor, bridge.end);
  }
  if (cursor < WORLD.width) addRect('collision', { id: `harbour-bank-${cursor}`, type: 'rect', material: 'water', x: cursor, y: 5700, w: WORLD.width - cursor, h: 230 });

  addRect('details_above', { id: 'rail-mainline', type: 'rect', material: 'rail', authored: true, x: 0, y: 2520, w: WORLD.width, h: 68 });
  addRect('details_above', { id: 'station-platform-north', type: 'rect', material: 'station_platform', authored: true, x: 5030, y: 2470, w: 2240, h: 36 });
  addRect('details_above', { id: 'station-platform-south', type: 'rect', material: 'station_platform', authored: true, x: 5030, y: 2602, w: 2240, h: 36 });

  addRect('ground', { id: 'party-house-court', type: 'rect', material: 'baseFloor', authored: true, x: 5160, y: 4300, w: 850, h: 610 });
  addRect('details_above', { id: 'party-house-court-pattern', type: 'rect', material: 'plaza_detail', authored: true, x: 5190, y: 4330, w: 790, h: 550 });
  addTrees({ x: 5180, y: 4320, w: 810, h: 570 }, hash('party-house-court'), 10);
  addRect('ground', { id: 'central-depot-yard', type: 'rect', material: 'parking', authored: true, x: 7620, y: 4310, w: 650, h: 560 });
  for (let row = 0; row < 4; row += 1) addRect('details_above', { id: `depot-bay-${row}`, type: 'rect', material: 'parking_bay', authored: true, x: 7700 + row * 128, y: 4380, w: 84, h: 180 });

  for (const base of [
    { id: 'west-command-yard', x: 620, y: 3520, w: 760, h: 920 },
    { id: 'east-command-yard', x: 10880, y: 3520, w: 760, h: 920 },
  ]) {
    addRect('ground', { ...base, type: 'rect', material: 'baseFloor', authored: true });
    addRect('details_above', { id: `${base.id}-mark`, type: 'rect', material: 'plaza_detail', authored: true, x: base.x + 28, y: base.y + 28, w: base.w - 56, h: base.h - 56 });
  }
}

function gameplayLayers() {
  const playerSpawns = [
    [5780, 4520], [5820, 4520], [5860, 4520], [5900, 4520],
    [5780, 4580], [5820, 4580], [5860, 4580], [5900, 4580],
  ].map(([x, y], index) => ({ id: `player-spawn-${index + 1}`, slot: index + 1, x, y }));
  return {
    ground: [], roads: [], sidewalks: [], buildings: [], collision: [], interior_zones: [],
    player_spawns: playerSpawns,
    npc_spawns: [
      { id: 'npc-centre-a', x: 6144, y: 3620, routeId: 'route-centre-grid' },
      { id: 'npc-centre-b', x: 7000, y: 4096, routeId: 'route-centre-grid' },
      { id: 'npc-rail-a', x: 4864, y: 2048, routeId: 'route-rail-quarter' },
      { id: 'npc-rail-b', x: 7424, y: 2944, routeId: 'route-rail-quarter' },
      { id: 'npc-west-a', x: 2048, y: 4096, routeId: 'route-west-loop' },
      { id: 'npc-east-a', x: 9472, y: 4096, routeId: 'route-east-loop' },
      { id: 'npc-south-a', x: 4864, y: 6400, routeId: 'route-south-loop' },
      { id: 'npc-harbour-a', x: 8448, y: 5248, routeId: 'route-harbour-loop' },
    ],
    rival_spawns: [
      { id: 'rival-authored-1', x: 3968, y: 4096, role: 'rusher' },
      { id: 'rival-authored-2', x: 7424, y: 4096, role: 'skirmisher' },
      { id: 'rival-authored-3', x: 6144, y: 2944, role: 'blocker' },
    ],
    vehicle_spawns: vehicles().vehicles,
    mission_zones: [
      { id: 'party-house-mission-board', kind: 'mission_board', x: 5790, y: 4450, w: 100, h: 64 },
      { id: 'depot-pickup', kind: 'pickup', label: 'Central Depot', x: 7720, y: 4620, w: 420, h: 150 },
      { id: 'delivery-west', kind: 'delivery', label: 'West Workshops', x: 1934, y: 2868, w: 228, h: 152 },
      { id: 'delivery-north', kind: 'delivery', label: 'North Campus', x: 7310, y: 1076, w: 228, h: 152 },
      { id: 'delivery-centre', kind: 'delivery', label: 'Civic Boulevard', x: 7310, y: 4018, w: 228, h: 156 },
      { id: 'delivery-east', kind: 'delivery', label: 'East Terraces', x: 10446, y: 4016, w: 228, h: 160 },
      { id: 'delivery-south', kind: 'delivery', label: 'Ring Arena', x: 3854, y: 6320, w: 228, h: 160 },
    ],
    safe_zones: [{ id: 'party-house-safe', x: 5160, y: 4300, w: 850, h: 610 }],
    base_zones: [{ id: 'party-house-base', partyId: 'party_a', x: 5160, y: 4300, w: 850, h: 610, healthRegenPerSecond: 10 }],
    save_terminals: [{ id: 'party-house-save-computer', name: 'GROUP SAVE COMPUTER', x: 5270, y: 4510, w: 44, h: 34, interactionDistance: 54, saveSlotCount: 9 }],
  };
}

function vehicles() {
  return { vehicles: [
    { id: 'vehicle-001', kind: 'district-runner', x: 6000, y: 4096, rotation: 0, maxOccupants: 4, health: 50, style: 'teal' },
    { id: 'vehicle-002', kind: 'courier-van', x: 6280, y: 4096, rotation: Math.PI, maxOccupants: 4, health: 50, style: 'amber' },
    { id: 'vehicle-003', kind: 'district-runner', x: 2048, y: 3100, rotation: Math.PI / 2, maxOccupants: 4, health: 50, style: 'teal' },
    { id: 'vehicle-004', kind: 'courier-van', x: 8448, y: 4700, rotation: Math.PI / 2, maxOccupants: 4, health: 50, style: 'amber' },
    { id: 'vehicle-005', kind: 'district-runner', x: 10560, y: 6500, rotation: -Math.PI / 2, maxOccupants: 4, health: 50, style: 'teal' },
    { id: 'vehicle-006', kind: 'courier-van', x: 4864, y: 6400, rotation: 0, maxOccupants: 4, health: 50, style: 'amber' },
  ] };
}

function routes() {
  const route = (id, points) => ({ id, closed: true, points: points.map(([x, y]) => ({ x, y })) });
  return { routes: [
    route('route-centre-grid', [[4864, 2944], [7424, 2944], [7424, 5248], [4864, 5248]]),
    route('route-rail-quarter', [[3968, 2048], [8448, 2048], [8448, 2944], [3968, 2944]]),
    route('route-west-loop', [[1024, 2048], [3968, 2048], [3968, 5248], [1024, 5248]]),
    route('route-east-loop', [[8448, 2944], [11776, 2944], [11776, 5248], [8448, 5248]]),
    route('route-south-loop', [[2048, 6400], [7424, 6400], [7424, 7552], [2048, 7552]]),
    route('route-harbour-loop', [[7424, 5248], [11776, 5248], [11776, 6400], [7424, 6400]]),
  ] };
}

function missions() {
  return {
    modes: ['supply_sweep', 'hold_relay', 'courier_chaos', 'chaos_call', 'free_roam'],
    sessionModes: ['coop_adventure', 'district_dominion'], defaultMode: 'free_roam',
    layoutSource: 'mission-layouts.json', layoutSelection: 'host-shuffled-route-deck-no-immediate-repeat',
    supply_sweep: { title: 'Supply Sweep', description: 'Search one of four authored districts for six supplies.', roundSeconds: 120, goal: 6, rewardCents: 1500, start: { x: 6144, y: 3600 } },
    hold_relay: { title: 'Hold the Relay', description: 'Protect a relay in one of four readable city arenas.', roundSeconds: 150, waves: 3, relayHealth: 30, rewardCents: 2500, start: { x: 4864, y: 5248 } },
    courier_chaos: { title: 'Courier Chaos', description: 'Collect parcels at the central depot and choose a city route.', roundSeconds: 420, deliveryGoal: 8, packageSpawnZoneId: 'depot-pickup', deliveryZoneIds: ['delivery-west', 'delivery-north', 'delivery-centre', 'delivery-east', 'delivery-south'], scorePerDelivery: 100, vehicleAssistBonus: 25, rewardCents: 2000, start: { x: 7900, y: 4700 }, finalPackage: { implemented: false, reservedRule: 'vehicle-required' } },
    chaos_call: { title: 'Call the Heat', description: 'Trigger a short justice response in a deliberate street arena.', roundSeconds: 90, rewardCents: 0, start: { x: 6144, y: 4096 } },
  };
}

function missionLayouts() {
  return {
    schemaVersion: 1, selectionPolicy: 'host-shuffled-route-deck-no-immediate-repeat', modes: {
      supply_sweep: { layouts: [
        { id: 'market-cache', label: 'Market Cache', start: { x: 6144, y: 3600 }, twist: 'Short sight lines around the market.', packageOffsets: [[-100,-60],[0,-70],[100,-50],[-90,70],[0,80],[90,60]], guardCount: 1, guardOffsets: [[0,-180]] },
        { id: 'textile-cache', label: 'Textile Works Cache', start: { x: 3968, y: 3500 }, twist: 'Long industrial edges with two lookouts.', packageOffsets: [[-120,-70],[-40,-70],[40,-70],[120,-70],[-65,70],[65,70]], guardCount: 2, guardOffsets: [[-190,0],[190,0]] },
        { id: 'campus-ring-cache', label: 'Campus Ring Cache', start: { x: 8448, y: 1152 }, twist: 'A broad ring pattern beside the northern green.', packageOffsets: [[-110,0],[-55,-88],[55,-88],[110,0],[55,88],[-55,88]], guardCount: 1, guardOffsets: [[0,170]] },
        { id: 'harbour-row-cache', label: 'Harbour Row Cache', start: { x: 9472, y: 5248 }, twist: 'Two crate rows make the bridge approach easy to read.', packageOffsets: [[-110,-60],[-35,-60],[40,-60],[110,-60],[-55,70],[55,70]], guardCount: 0, guardOffsets: [] },
      ] },
      hold_relay: { layouts: [
        { id: 'centre-relay', label: 'Centre Relay', start: { x: 6144, y: 4096 }, twist: 'Four connected approaches.', enemySpawnOffsets: [[-260,0],[260,0],[0,-260],[0,260],[-190,-190],[190,190]], waveRoles: [['rusher','skirmisher'],['rusher','blocker','skirmisher'],['blocker','rusher','skirmisher']] },
        { id: 'arena-relay', label: 'Arena Relay', start: { x: 3968, y: 6400 }, twist: 'Wide roads and a southern flank.', enemySpawnOffsets: [[-260,0],[260,0],[0,-240],[0,240],[-180,180],[180,180]], waveRoles: [['rusher','rusher'],['skirmisher','blocker'],['blocker','rusher','skirmisher']] },
        { id: 'rail-relay', label: 'Rail Quarter Relay', start: { x: 7424, y: 2048 }, twist: 'Diagonal entries cross the station approaches.', enemySpawnOffsets: [[-220,-220],[220,-220],[-220,220],[220,220],[0,-280],[0,280]], waveRoles: [['skirmisher','rusher'],['rusher','blocker','skirmisher'],['blocker','rusher','skirmisher']] },
        { id: 'west-relay', label: 'West Boulevard Relay', start: { x: 2048, y: 5248 }, twist: 'Long east-west sight lines hide a late northern flank.', enemySpawnOffsets: [[-280,-60],[-280,60],[280,-60],[280,60],[0,-260],[0,260]], waveRoles: [['rusher','rusher'],['skirmisher','blocker'],['blocker','skirmisher','rusher']] },
      ] },
      courier_chaos: { layouts: [
        { id: 'central-depot-dispatch', label: 'Central Depot Dispatch', start: { x: 7900, y: 4700 }, twist: 'Central dispatch with four connected drop choices.', packageOffsets: [[-72,-30],[-24,-30],[24,-30],[72,-30],[-72,30],[-24,30],[24,30],[72,30]], deliveryZoneIds: ['delivery-centre','delivery-north','delivery-east','delivery-south'] },
        { id: 'west-workshops-dispatch', label: 'West Workshops Dispatch', start: { x: 2048, y: 3100 }, twist: 'A close west drop and three deliberate cross-city routes.', packageOffsets: [[-72,-30],[-24,-30],[24,-30],[72,-30],[-72,30],[-24,30],[24,30],[72,30]], deliveryZoneIds: ['delivery-west','delivery-centre','delivery-north','delivery-south'] },
        { id: 'north-ring-dispatch', label: 'North Ring Dispatch', start: { x: 7424, y: 2048 }, twist: 'Northern pickup with campus, centre, east and west choices.', packageOffsets: [[-72,-30],[-24,-30],[24,-30],[72,-30],[-72,30],[-24,30],[24,30],[72,30]], deliveryZoneIds: ['delivery-north','delivery-centre','delivery-east','delivery-west'] },
        { id: 'east-ring-dispatch', label: 'East Ring Dispatch', start: { x: 9472, y: 4096 }, twist: 'East-side pickup keeps one quick drop and three longer routes.', packageOffsets: [[-72,-30],[-24,-30],[24,-30],[72,-30],[-72,30],[-24,30],[24,30],[72,30]], deliveryZoneIds: ['delivery-east','delivery-centre','delivery-north','delivery-south'] },
      ] },
      chaos_call: { layouts: [
        { id: 'civic-heat', label: 'Civic Spine Heat', start: { x: 6144, y: 4096 }, twist: 'Broad cross streets support a readable pursuit.' },
        { id: 'harbour-heat', label: 'Harbour Heat', start: { x: 8448, y: 5248 }, twist: 'Bridges create deliberate escape choices.' },
        { id: 'campus-heat', label: 'North Campus Heat', start: { x: 8448, y: 2048 }, twist: 'Green edges and long roads create a rotating chase.' },
        { id: 'arena-heat', label: 'Ring Arena Heat', start: { x: 3968, y: 6400 }, twist: 'The southern arterial rewards staying together.' },
      ] },
    },
  };
}

function territory() {
  const playerSpawns = [
    [11144, 4056], [11256, 4056], [11144, 4144], [11256, 4144],
    [844, 4056], [956, 4056], [844, 4144], [956, 4144],
  ].map(([x, y], index) => ({ slot: index + 1, partyId: index < 4 ? 'party_a' : 'party_b', x, y }));
  return {
    id: 'tilburg-authored-district-dominion-alpha', mode: 'district_dominion', title: 'Authored City District Dominion',
    roundSeconds: 600, scoreGoal: 360, captureRatePerSecond: 15, scoreIntervalSeconds: 1,
    startingPartyFundCents: 5000, incomeIntervalSeconds: 5, incomePerOwnedZoneCents: 100,
    reinforcement: { costCents: 2500, squadSize: 2, maxActivePerParty: 4, lifetimeSeconds: 120, purchaseCooldownSeconds: 3 },
    playerSpawns,
    vehicleSpawns: vehicles().vehicles,
    commandPosts: {
      party_a: { id: 'command-post-a', label: 'Party A East Command', x: 11200, y: 4100, radius: 120, reinforcementSpawn: { x: 10960, y: 4100 }, safeZone: { id: 'dominion-safe-a', x: 10880, y: 3520, width: 760, height: 920 }, baseZone: { id: 'dominion-base-a', partyId: 'party_a', x: 10880, y: 3520, width: 760, height: 920, healthRegenPerSecond: 10 } },
      party_b: { id: 'command-post-b', label: 'Party B West Command', x: 900, y: 4100, radius: 120, reinforcementSpawn: { x: 1400, y: 4100 }, safeZone: { id: 'dominion-safe-b', x: 620, y: 3520, width: 760, height: 920 }, baseZone: { id: 'dominion-base-b', partyId: 'party_b', x: 620, y: 3520, width: 760, height: 920, healthRegenPerSecond: 10 } },
    },
    zones: [
      { id: 'west-workshops', label: 'West Workshops', x: 2048, y: 4096, radius: 100, initialOwnerPartyId: 'party_b' },
      { id: 'textile-works', label: 'Textile Works', x: 3968, y: 4096, radius: 95, initialOwnerPartyId: null },
      { id: 'rail-quarter', label: 'Rail Quarter', x: 6144, y: 2048, radius: 100, initialOwnerPartyId: null },
      { id: 'city-market', label: 'City Market', x: 6144, y: 4096, radius: 115, initialOwnerPartyId: null },
      { id: 'north-campus', label: 'North Campus', x: 8448, y: 2048, radius: 95, initialOwnerPartyId: null },
      { id: 'harbour-gate', label: 'Harbour Gate', x: 8448, y: 5248, radius: 100, initialOwnerPartyId: null },
      { id: 'ring-arena', label: 'Ring Arena', x: 3968, y: 6400, radius: 100, initialOwnerPartyId: null },
      { id: 'east-terraces', label: 'East Terraces', x: 10560, y: 4096, radius: 100, initialOwnerPartyId: 'party_a' },
    ],
  };
}

function cityArt() {
  return {
    schemaVersion: 4,
    id: 'axm-tilburg-authored-city-alpha-v0-4-0',
    runtimeRule: 'Presentation-only authored primitives; authoritative collision and gameplay coordinates come from this map package.',
    presentation: {
      passId: 'tilburg-authored-city-alpha-v0-4-0', passName: 'Tilburg Authored City · Alpha',
      mode: 'authored-city-alpha', status: 'playable-art-alpha-pending-human-visual-approval',
      maturity: 'Original deterministic authored street plan and procedural building vocabulary; external texture and model sourcing is deliberately deferred.',
      sourceTruth: 'This is a new fictionalized Tilburg-scale layout, not a navigation map and not derived from Map 1 geometry.',
      assetStatus: 'No new external assets imported in this pass. Candidate sources require per-asset verification later.',
      roofPalette: ['#c35f4f','#9e493f','#d07a58','#745e64','#b98659','#75443e','#597078','#a8644d','#88735e'],
      roadMarking: '#f1df9d', sidewalkJoint: '#77756b',
      proceduralVocabulary: ['arterial hierarchy','curbs','lane markings','zebra crossings','parking bays','quays','bridges','rail platforms','varied roof families','roof equipment','street trees','district landmarks'],
    },
    palette: {
      ground: '#1d2b27', road: '#252a2c', roadEdge: '#a39d87', sidewalk: '#aaa38f',
      building: '#765049', buildingRoof: '#bd6955', baseFloor: '#35645a', baseWall: '#73cfb0',
      park: '#3f7543', water: '#31718b', rail: '#a9aaa2', parking: '#34383a', park_path: '#b6a980',
      parking_bay: '#e7dfbd', plaza_detail: '#b9ad91', station_platform: '#807c71', safe: '#59e0b8'
    },
    districts: [
      { id: 'garden-districts', label: 'Garden Districts', subtitle: 'brick rows · pocket greens', x: 1700, y: 1350, radius: 62, accent: '#8ecf7e' },
      { id: 'textile-quarter', label: 'Textile Quarter', subtitle: 'mills · workshops', x: 3500, y: 3450, radius: 64, accent: '#e1875e' },
      { id: 'rail-quarter', label: 'Rail Quarter', subtitle: 'station · lofts', x: 6100, y: 2320, radius: 66, accent: '#8fc7d2' },
      { id: 'old-centre', label: 'Old Centre', subtitle: 'market · civic spine', x: 6500, y: 3500, radius: 68, accent: '#f2c76e' },
      { id: 'north-campus', label: 'North Campus', subtitle: 'labs · offices', x: 9200, y: 1500, radius: 62, accent: '#8bb8f0' },
      { id: 'east-terraces', label: 'East Terraces', subtitle: 'apartments · shops', x: 10300, y: 3600, radius: 62, accent: '#d99add' },
      { id: 'harbour-works', label: 'Harbour Works', subtitle: 'quays · warehouses', x: 9400, y: 5480, radius: 66, accent: '#7fd6d7' },
      { id: 'ring-park', label: 'Ring Park', subtitle: 'arena · recreation', x: 3300, y: 6900, radius: 68, accent: '#91d26b' }
    ],
    landmarks: [
      { id: 'central-station', type: 'station', label: 'Central Station', subtitle: 'rail quarter', districtId: 'rail-quarter', x: 6140, y: 2350, w: 820, h: 150, accent: '#8fc7d2' },
      { id: 'textile-works', type: 'market', label: 'Textile Works', subtitle: 'sawtooth halls', districtId: 'textile-quarter', x: 3490, y: 3420, w: 360, h: 150, accent: '#e1875e' },
      { id: 'city-market', type: 'market', label: 'City Market', subtitle: 'old centre', districtId: 'old-centre', x: 6780, y: 3480, w: 340, h: 150, accent: '#f2c76e' },
      { id: 'harbour-basin', type: 'harbour', label: 'Harbour Basin', subtitle: 'working quays', districtId: 'harbour-works', x: 9400, y: 5790, w: 660, h: 220, accent: '#7fd6d7' },
      { id: 'ring-arena', type: 'arena', label: 'Ring Arena', subtitle: 'south park', districtId: 'ring-park', x: 3360, y: 6900, w: 500, h: 300, accent: '#91d26b' },
      { id: 'party-house', type: 'plaza', label: 'Party House', subtitle: 'group base', x: 5585, y: 4605, w: 430, h: 300, accent: '#59e0b8' }
    ],
    streetDetails: [], buildingOverlays: [], propOverlays: [], staticCharacters: [],
    overview: {
      waterways: [{ id: 'harbour-canal', width: 4, points: [[7500,5815],[12288,5815]] }],
      arterials: [
        { id: 'civic-west-east', kind: 'arterial', points: [[0,4096],[12288,4096]] },
        { id: 'civic-north-south', kind: 'arterial', points: [[6144,0],[6144,8192]] },
        { id: 'north-ring', kind: 'arterial', points: [[0,2048],[12288,2048]] },
        { id: 'south-ring', kind: 'arterial', points: [[0,6400],[12288,6400]] },
        { id: 'west-spine', kind: 'arterial', points: [[2048,0],[2048,8192]] },
        { id: 'east-spine', kind: 'arterial', points: [[8448,0],[8448,8192]] }
      ]
    }
  };
}

function chunkManifest() {
  return [...chunks.values()].map((chunk) => ({
    id: chunk.id, column: chunk.column, row: chunk.row, ...chunk.bounds,
    path: `/data/maps/tilburg-authored-city-alpha/map-chunks/chunk-${String(chunk.column).padStart(2, '0')}-${String(chunk.row).padStart(2, '0')}.json`,
    featureCount: Object.values(chunk.layers).reduce((sum, entries) => sum + entries.length, 0),
  }));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  makeChunks();
  roadSurfaces();
  cityBlocks();
  authoredLandmarks();
  fs.mkdirSync(CHUNKS, { recursive: true });
  for (const name of fs.readdirSync(CHUNKS)) if (/^chunk-\d+-\d+\.json$/.test(name)) fs.unlinkSync(path.join(CHUNKS, name));
  for (const chunk of chunks.values()) {
    writeJson(path.join(CHUNKS, `chunk-${String(chunk.column).padStart(2, '0')}-${String(chunk.row).padStart(2, '0')}.json`), chunk);
  }
  const layers = gameplayLayers();
  const manifest = {
    id: 'tilburg-authored-city-alpha-v0-4-0', format: 'AXM_CHUNKED_CITY_MAP', generatedWithTiled: false,
    generatedFrom: 'Original deterministic AXM authored-city generator', tileSize: WORLD.tileSize,
    sourceGrid: { columns: WORLD.width / WORLD.tileSize, rows: WORLD.height / WORLD.tileSize },
    world: { width: WORLD.width, height: WORLD.height },
    geography: { placeIdentity: 'Fictionalized Tilburg-scale city', gameScale: '12,288 × 8,192 world units; not navigation-accurate' },
    palette: cityArt().palette,
    chunking: { enabled: true, strategy: 'party-camera-visible-plus-one-chunk', chunkSize: WORLD.chunkSize, columns: 12, rows: 8, prefetchMarginChunks: 1, cacheLimit: 32, chunks: chunkManifest() },
    statistics: { chunkCount: 96, authoredFeatureCount: [...chunks.values()].reduce((sum, chunk) => sum + Object.values(chunk.layers).reduce((count, entries) => count + entries.length, 0), 0), layout: 'new independent authored street plan' },
    layers,
  };
  writeJson(path.join(OUTPUT, 'map.json'), manifest);
  writeJson(path.join(OUTPUT, 'city-art.json'), cityArt());
  writeJson(path.join(OUTPUT, 'missions.json'), missions());
  writeJson(path.join(OUTPUT, 'mission-layouts.json'), missionLayouts());
  writeJson(path.join(OUTPUT, 'npc-routes.json'), routes());
  writeJson(path.join(OUTPUT, 'vehicle-spawns.json'), vehicles());
  writeJson(path.join(OUTPUT, 'territory-zones.json'), territory());
  const digest = crypto.createHash('sha256');
  for (const file of [path.join(OUTPUT, 'map.json'), ...fs.readdirSync(CHUNKS).sort().map((name) => path.join(CHUNKS, name))]) digest.update(fs.readFileSync(file));
  writeJson(path.join(OUTPUT, 'build-index.json'), {
    id: 'tilburg-authored-city-alpha-build-v0-4-0', generatedAt: new Date().toISOString(), generator: 'scripts/build-authored-city-map.js',
    world: { width: WORLD.width, height: WORLD.height }, chunkCount: 96, mapAndChunksSha256: digest.digest('hex'),
    assetPolicy: 'No new external assets imported. Candidate sources are deferred and require per-asset verification.',
    maturity: 'playable authored-city art alpha pending human visual approval',
  });
  process.stdout.write(`AUTHORED_CITY_BUILD: PASS (${manifest.statistics.authoredFeatureCount} features, 96 chunks)\n`);
}

if (require.main === module) main();

module.exports = { WORLD, horizontalRoads, verticalRoads };
