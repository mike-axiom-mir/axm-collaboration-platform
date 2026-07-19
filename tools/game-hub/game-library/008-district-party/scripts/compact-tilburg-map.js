'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.join(__dirname, '..');
const RASTER_LAYERS = Object.freeze([
  ['ground', 'park', false],
  ['roads', 'road', false],
  ['sidewalks', 'sidewalk', false],
  ['details_below', 'water', false],
  ['buildings', 'building', false],
  ['details_above', 'rail', false],
]);

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [ax, ay] = points[index];
    const [bx, by] = points[previous];
    if (((ay > y) !== (by > y)) && x < ((bx - ax) * (y - ay)) / ((by - ay) || Number.EPSILON) + ax) inside = !inside;
  }
  return inside;
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  return Math.abs(value) < 0.0001 ? 0 : value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) && b[0] >= Math.min(a[0], c[0])
    && b[1] <= Math.max(a[1], c[1]) && b[1] >= Math.min(a[1], c[1]);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(a, c, b)) || (o2 === 0 && onSegment(a, d, b))
    || (o3 === 0 && onSegment(c, a, d)) || (o4 === 0 && onSegment(c, b, d));
}

function polygonTouchesRectangle(points, left, top, right, bottom) {
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]];
  const centre = [(left + right) / 2, (top + bottom) / 2];
  if (pointInPolygon(centre[0], centre[1], points) || corners.some(([x, y]) => pointInPolygon(x, y, points))) return true;
  if (points.some(([x, y]) => x >= left && x <= right && y >= top && y <= bottom)) return true;
  const edges = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]]];
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (edges.some(([a, b]) => segmentsIntersect(start, end, a, b))) return true;
  }
  return false;
}

function polylineTouchesRectangle(points, left, top, right, bottom) {
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]];
  if (points.some(([x, y]) => x >= left && x <= right && y >= top && y <= bottom)) return true;
  const edges = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]]];
  for (let index = 0; index < points.length - 1; index += 1) {
    if (edges.some(([a, b]) => segmentsIntersect(points[index], points[index + 1], a, b))) return true;
  }
  return false;
}

function itemBounds(item) {
  return {
    left: Number(item.x) || 0,
    top: Number(item.y) || 0,
    right: (Number(item.x) || 0) + (Number(item.w ?? item.width) || 0),
    bottom: (Number(item.y) || 0) + (Number(item.h ?? item.height) || 0),
  };
}

function itemTouchesTile(item, left, top, right, bottom) {
  const bounds = itemBounds(item);
  if (bounds.right < left || bounds.left > right || bounds.bottom < top || bounds.top > bottom) return false;
  if (!Array.isArray(item.points)) return true;
  if (item.type === 'polygon') return polygonTouchesRectangle(item.points, left, top, right, bottom);
  if (item.type === 'polyline') return polylineTouchesRectangle(item.points, left, top, right, bottom);
  return true;
}

function rasterize(items, chunk, tileSize) {
  const columns = Math.ceil(chunk.bounds.width / tileSize);
  const rows = Math.ceil(chunk.bounds.height / tileSize);
  const grid = new Uint8Array(columns * rows);
  for (const item of items || []) {
    const bounds = itemBounds(item);
    const firstColumn = Math.max(0, Math.floor((bounds.left - chunk.bounds.x) / tileSize));
    const lastColumn = Math.min(columns - 1, Math.ceil((bounds.right - chunk.bounds.x) / tileSize) - 1);
    const firstRow = Math.max(0, Math.floor((bounds.top - chunk.bounds.y) / tileSize));
    const lastRow = Math.min(rows - 1, Math.ceil((bounds.bottom - chunk.bounds.y) / tileSize) - 1);
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const left = chunk.bounds.x + column * tileSize;
        const top = chunk.bounds.y + row * tileSize;
        if (itemTouchesTile(item, left, top, left + tileSize, top + tileSize)) grid[row * columns + column] = 1;
      }
    }
  }
  return { columns, rows, grid };
}

function rectanglesFromGrid(raster, chunk, tileSize, layer, material, collision) {
  const results = [];
  let active = new Map();
  const finish = (record) => {
    const item = {
      id: `tile-${layer}-${chunk.column}-${chunk.row}-${record.startColumn}-${record.startRow}-${record.rowCount}`,
      type: 'rect',
      x: chunk.bounds.x + record.startColumn * tileSize,
      y: chunk.bounds.y + record.startRow * tileSize,
      w: record.columnCount * tileSize,
      h: record.rowCount * tileSize,
      material,
    };
    if (collision) item.collision = true;
    results.push(item);
  };
  for (let row = 0; row < raster.rows; row += 1) {
    const runs = [];
    for (let column = 0; column < raster.columns;) {
      if (!raster.grid[row * raster.columns + column]) { column += 1; continue; }
      const startColumn = column;
      while (column < raster.columns && raster.grid[row * raster.columns + column]) column += 1;
      runs.push({ startColumn, columnCount: column - startColumn });
    }
    const next = new Map();
    for (const run of runs) {
      const key = `${run.startColumn}:${run.columnCount}`;
      const continued = active.get(key);
      next.set(key, continued ? { ...continued, rowCount: continued.rowCount + 1 } : { ...run, startRow: row, rowCount: 1 });
    }
    for (const [key, record] of active) if (!next.has(key)) finish(record);
    active = next;
  }
  for (const record of active.values()) finish(record);
  return results;
}

function compactChunk(chunk, tileSize = 16) {
  const compacted = { ground: [], roads: [], sidewalks: [], buildings: [], details_below: [], details_above: [], collision: [] };
  const rasters = {};
  for (const [layer, material, collision] of RASTER_LAYERS) {
    const items = (chunk.layers[layer] || []).filter((item) => item.material === material || !item.material);
    const raster = rasterize(items, chunk, tileSize);
    rasters[layer] = raster;
    compacted[layer] = rectanglesFromGrid(raster, chunk, tileSize, layer, material, collision);
  }
  const collisionRaster = {
    columns: rasters.buildings.columns,
    rows: rasters.buildings.rows,
    grid: new Uint8Array(rasters.buildings.grid.length),
  };
  for (let index = 0; index < collisionRaster.grid.length; index += 1) {
    const occupied = rasters.buildings.grid[index] || rasters.details_below.grid[index];
    const publicWay = rasters.roads.grid[index] || rasters.sidewalks.grid[index];
    collisionRaster.grid[index] = occupied && !publicWay ? 1 : 0;
  }
  compacted.collision = rectanglesFromGrid(collisionRaster, chunk, tileSize, 'collision', 'collision', true);
  chunk.layers = compacted;
  return Object.fromEntries(Object.entries(compacted).map(([layer, items]) => [layer, items.length]));
}

function compactChunks(chunks, world) {
  const totals = {};
  for (const chunk of chunks.values()) {
    const counts = compactChunk(chunk, world.tileSize || 16);
    for (const [layer, count] of Object.entries(counts)) totals[layer] = (totals[layer] || 0) + count;
  }
  return totals;
}

function digest(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function runFromDisk() {
  const mapPath = path.join(PROJECT_ROOT, 'data', 'map.json');
  const sourcePath = path.join(PROJECT_ROOT, 'data', 'tilburg-source-index.json');
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const chunks = new Map();
  for (const entry of map.chunking.chunks) {
    const file = path.join(PROJECT_ROOT, entry.path.replace(/^\//, ''));
    const chunk = JSON.parse(fs.readFileSync(file, 'utf8'));
    chunks.set(`${chunk.column}:${chunk.row}`, chunk);
  }
  const runtimeRectangles = compactChunks(chunks, { tileSize: map.tileSize });
  const files = [];
  for (const chunk of chunks.values()) {
    const file = path.join(PROJECT_ROOT, 'data', 'map-chunks', `chunk-${String(chunk.column).padStart(2, '0')}-${String(chunk.row).padStart(2, '0')}.json`);
    fs.writeFileSync(file, `${JSON.stringify(chunk)}\n`);
    files.push(file);
    const entry = map.chunking.chunks.find((candidate) => candidate.column === chunk.column && candidate.row === chunk.row);
    entry.featureCount = Object.values(chunk.layers).reduce((sum, items) => sum + items.length, 0);
  }
  map.statistics.runtimeRectangles = runtimeRectangles;
  map.statistics.compaction = 'BGT geometry raster-indexed to the declared 16px source-tile grid, then contiguous tiles merged into rectangles';
  fs.writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  source.transform.runtimeCompaction = map.statistics.compaction;
  source.output.runtimeRectangles = runtimeRectangles;
  source.output.sha256MapAndChunks = digest([mapPath, ...files]);
  fs.writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
  process.stdout.write(`[Tilburg map] compacted to ${Object.values(runtimeRectangles).reduce((sum, count) => sum + count, 0)} runtime rectangles\n`);
}

if (require.main === module) runFromDisk();

module.exports = { compactChunk, compactChunks, itemTouchesTile, pointInPolygon, rectanglesFromGrid };
