'use strict';

function bounds(rect) {
  const x = Number(rect.x) || 0;
  const y = Number(rect.y) || 0;
  const width = Number(rect.w ?? rect.width) || 0;
  const height = Number(rect.h ?? rect.height) || 0;
  return { x, y, right: x + width, bottom: y + height };
}

function overlaps(a, b) {
  const first = bounds(a);
  const second = bounds(b);
  return first.right > second.x && first.x < second.right && first.bottom > second.y && first.y < second.bottom;
}

function tileAligned(rect, tileSize, world) {
  const source = bounds(rect);
  const x = Math.max(0, Math.floor(source.x / tileSize) * tileSize);
  const y = Math.max(0, Math.floor(source.y / tileSize) * tileSize);
  const right = Math.min(world.width, Math.ceil(source.right / tileSize) * tileSize);
  const bottom = Math.min(world.height, Math.ceil(source.bottom / tileSize) * tileSize);
  return { id: rect.id, x, y, w: right - x, h: bottom - y };
}

function subtractRectangle(item, clearing, suffix = '') {
  if (!overlaps(item, clearing)) return [item];
  const source = bounds(item);
  const cut = bounds(clearing);
  const left = Math.max(source.x, cut.x);
  const right = Math.min(source.right, cut.right);
  const top = Math.max(source.y, cut.y);
  const bottom = Math.min(source.bottom, cut.bottom);
  const pieces = [
    { x: source.x, y: source.y, w: source.right - source.x, h: top - source.y },
    { x: source.x, y: bottom, w: source.right - source.x, h: source.bottom - bottom },
    { x: source.x, y: top, w: left - source.x, h: bottom - top },
    { x: right, y: top, w: source.right - right, h: bottom - top },
  ].filter((piece) => piece.w > 0 && piece.h > 0);
  return pieces.map((piece, index) => ({ ...item, ...piece, id: `${item.id}-cut${suffix}-${index}` }));
}

function clearCollisionGeometry(chunks, requestedClearings, world) {
  const tileSize = world.tileSize || 16;
  const clearings = requestedClearings.map((entry) => tileAligned(entry, tileSize, world));
  let affected = 0;
  for (const chunk of chunks.values()) {
    for (const layer of ['buildings', 'details_below', 'collision']) {
      const output = [];
      for (const item of chunk.layers[layer] || []) {
        const sourceObstacle = layer === 'collision'
          || layer === 'buildings'
          || (layer === 'details_below' && (item.collision === true || item.material === 'water'));
        if (!sourceObstacle) { output.push(item); continue; }
        let pieces = [item];
        clearings.forEach((clearing, index) => {
          const before = pieces.length;
          pieces = pieces.flatMap((piece) => subtractRectangle(piece, clearing, `-${index}`));
          if (pieces.length !== before || !pieces.includes(item)) affected += 1;
        });
        output.push(...pieces);
      }
      chunk.layers[layer] = output;
    }
  }
  return { clearings, affectedRuntimeRectangles: affected };
}

function collisionGrid(chunks, world, globalCollision = []) {
  const tileSize = world.tileSize || 16;
  const columns = Math.ceil(world.width / tileSize);
  const rows = Math.ceil(world.height / tileSize);
  const grid = new Uint8Array(columns * rows);
  for (const chunk of chunks.values()) {
    for (const layer of ['buildings', 'details_below', 'collision']) {
      for (const item of chunk.layers[layer] || []) {
        if (layer !== 'collision' && item.collision !== true) continue;
        const box = bounds(item);
        const firstColumn = Math.max(0, Math.floor(box.x / tileSize));
        const lastColumn = Math.min(columns - 1, Math.ceil(box.right / tileSize) - 1);
        const firstRow = Math.max(0, Math.floor(box.y / tileSize));
        const lastRow = Math.min(rows - 1, Math.ceil(box.bottom / tileSize) - 1);
        for (let row = firstRow; row <= lastRow; row += 1) {
          for (let column = firstColumn; column <= lastColumn; column += 1) grid[row * columns + column] = 1;
        }
      }
    }
  }
  for (const item of globalCollision) {
    const box = bounds(item);
    const firstColumn = Math.max(0, Math.floor(box.x / tileSize));
    const lastColumn = Math.min(columns - 1, Math.ceil(box.right / tileSize) - 1);
    const firstRow = Math.max(0, Math.floor(box.y / tileSize));
    const lastRow = Math.min(rows - 1, Math.ceil(box.bottom / tileSize) - 1);
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) grid[row * columns + column] = 1;
    }
  }
  return { grid, columns, rows, tileSize };
}

function cellOpen(index, reserved, column, row, clearance) {
  for (let y = row - clearance; y <= row + clearance; y += 1) {
    for (let x = column - clearance; x <= column + clearance; x += 1) {
      if (x < 1 || y < 1 || x >= index.columns - 1 || y >= index.rows - 1) return false;
      const offset = y * index.columns + x;
      if (index.grid[offset] || reserved?.[offset]) return false;
    }
  }
  return true;
}

function reserveCell(index, reserved, column, row, clearance) {
  for (let y = row - clearance; y <= row + clearance; y += 1) {
    for (let x = column - clearance; x <= column + clearance; x += 1) reserved[y * index.columns + x] = 1;
  }
}

function nearestOpenPoint(index, point, clearance = 1, reserved = null, maximumRing = 96) {
  const startColumn = Math.max(1, Math.min(index.columns - 2, Math.floor(point.x / index.tileSize)));
  const startRow = Math.max(1, Math.min(index.rows - 2, Math.floor(point.y / index.tileSize)));
  for (let ring = 0; ring <= maximumRing; ring += 1) {
    const candidates = [];
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (ring && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        candidates.push({ column: startColumn + dx, row: startRow + dy, distance: dx * dx + dy * dy });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const candidate of candidates) {
      if (!cellOpen(index, reserved, candidate.column, candidate.row, clearance)) continue;
      if (reserved) reserveCell(index, reserved, candidate.column, candidate.row, clearance);
      return {
        x: candidate.column * index.tileSize + index.tileSize / 2,
        y: candidate.row * index.tileSize + index.tileSize / 2,
      };
    }
  }
  return { x: point.x, y: point.y };
}

function snapEntries(index, entries, clearance, reserved, stats, label) {
  for (const entry of entries || []) {
    const original = { x: Number(entry.x) || 0, y: Number(entry.y) || 0 };
    const snapped = nearestOpenPoint(index, original, clearance, reserved);
    entry.x = snapped.x;
    entry.y = snapped.y;
    if (entry.x !== original.x || entry.y !== original.y) stats[label] = (stats[label] || 0) + 1;
  }
}

function gameplayClearings(layers, territory, fixed = []) {
  const clearings = [...fixed];
  for (const zone of layers.mission_zones || []) {
    const margin = zone.kind === 'mission_board' ? 20 : 48;
    clearings.push({ id: `clear-${zone.id}`, x: zone.x - margin, y: zone.y - margin, w: zone.w + margin * 2, h: zone.h + margin * 2 });
  }
  for (const zone of layers.base_zones || []) clearings.push({ id: `clear-${zone.id}`, x: zone.x - 24, y: zone.y - 24, w: zone.w + 48, h: zone.h + 48 });
  for (const post of Object.values(territory.commandPosts || {})) {
    if (post.safeZone) clearings.push({ id: `clear-${post.id}`, x: post.safeZone.x, y: post.safeZone.y, w: post.safeZone.width, h: post.safeZone.height });
  }
  return clearings;
}

function placeGameplay({ chunks, layers, territory, missions, routes, vehicles, world, fixedClearings = [] }) {
  const clearings = gameplayClearings(layers, territory, fixedClearings);
  const clearingStats = clearCollisionGeometry(chunks, clearings, world);
  const index = collisionGrid(chunks, world, layers.collision || []);
  const stats = {};
  const coopReserved = new Uint8Array(index.grid.length);
  snapEntries(index, layers.player_spawns, 1, coopReserved, stats, 'playerSpawnsSnapped');
  snapEntries(index, vehicles.vehicles, 2, coopReserved, stats, 'vehicleSpawnsSnapped');
  layers.vehicle_spawns = vehicles.vehicles.map((entry) => ({ ...entry }));
  snapEntries(index, layers.npc_spawns, 1, null, stats, 'npcSpawnsSnapped');
  snapEntries(index, layers.rival_spawns, 1, null, stats, 'rivalSpawnsSnapped');
  for (const route of routes.routes || []) snapEntries(index, route.points, 1, null, stats, 'routePointsSnapped');
  snapEntries(index, Object.values(missions).filter((entry) => entry?.start).map((entry) => entry.start), 2, null, stats, 'missionStartsSnapped');

  const territoryReserved = new Uint8Array(index.grid.length);
  snapEntries(index, territory.playerSpawns, 1, territoryReserved, stats, 'territoryPlayerSpawnsSnapped');
  snapEntries(index, territory.vehicleSpawns, 2, territoryReserved, stats, 'territoryVehicleSpawnsSnapped');
  snapEntries(index, territory.zones, 2, null, stats, 'territoryZonesSnapped');
  const posts = Object.values(territory.commandPosts || {});
  snapEntries(index, posts, 2, null, stats, 'commandPostsSnapped');
  snapEntries(index, posts.map((post) => post.reinforcementSpawn), 2, null, stats, 'reinforcementSpawnsSnapped');
  return { ...clearingStats, snapped: stats };
}

module.exports = {
  clearCollisionGeometry,
  collisionGrid,
  gameplayClearings,
  nearestOpenPoint,
  placeGameplay,
  subtractRectangle,
};
