'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sourceRoot = path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha');
const outputRoot = path.join(root, 'exports', 'tilburg-authored-city-world-tile-source');
const outputChunks = path.join(outputRoot, 'chunks');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const LAYER_NAMES = Object.freeze(['ground', 'road', 'sidewalk', 'building', 'park', 'water', 'rail']);

function cleanOutputChunks() {
  fs.mkdirSync(outputChunks, { recursive: true });
  for (const name of fs.readdirSync(outputChunks)) {
    if (/^chunk-\d{2}-\d{2}\.json$/.test(name)) fs.unlinkSync(path.join(outputChunks, name));
  }
}

function sourceDigest(map) {
  const digest = crypto.createHash('sha256');
  digest.update(fs.readFileSync(path.join(sourceRoot, 'map.json')));
  const names = map.chunking.chunks.map((entry) => path.basename(entry.path)).sort();
  for (const name of names) digest.update(fs.readFileSync(path.join(sourceRoot, 'map-chunks', name)));
  return digest.digest('hex');
}

function rectFeature(layer, index, item, bounds, semantics, extras = {}) {
  const x = Number(item.x), y = Number(item.y);
  const width = Number(item.w ?? item.width), height = Number(item.h ?? item.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error(`Invalid ${layer} rectangle in chunk ${bounds.column}:${bounds.row}.`);
  }
  return {
    id: `${layer}-${String(bounds.column).padStart(2, '0')}-${String(bounds.row).padStart(2, '0')}-${String(index).padStart(4, '0')}`,
    geometry: {
      type: 'rect',
      world: { x, y, width, height },
      chunkLocal: { x: x - bounds.x, y: y - bounds.y, width, height },
    },
    ...semantics,
    ...extras,
  };
}

function exportChunk(entry, sourceChunk) {
  const bounds = { column: entry.column, row: entry.row, x: entry.x, y: entry.y, width: entry.width, height: entry.height };
  const layers = Object.fromEntries(LAYER_NAMES.map((name) => [name, []]));
  layers.ground.push(rectFeature('ground', 0, { x: entry.x, y: entry.y, w: entry.width, h: entry.height }, bounds, {
    material: 'default_ground', role: 'base_surface', walkable: true, collidable: false, navigationPriority: 0,
  }));

  for (const item of sourceChunk.layers.ground || []) {
    if (item.material === 'park') {
      layers.park.push(rectFeature('park', layers.park.length, item, bounds, {
        material: 'green_space', role: 'surface', walkable: true, collidable: false, navigationPriority: 20,
      }));
    } else {
      const material = item.material === 'parking' ? 'parking_surface' : 'paved_surface';
      layers.ground.push(rectFeature('ground', layers.ground.length, item, bounds, {
        material, role: 'surface_override', walkable: true, collidable: false, navigationPriority: 10,
      }));
    }
  }

  for (const item of sourceChunk.layers.roads || []) {
    layers.road.push(rectFeature('road', layers.road.length, item, bounds, {
      material: 'road', role: 'surface', walkable: true, collidable: false, navigationPriority: 50,
    }, { direction: item.direction || null, roadClass: item.roadClass || 'local' }));
  }
  for (const item of sourceChunk.layers.sidewalks || []) {
    layers.sidewalk.push(rectFeature('sidewalk', layers.sidewalk.length, item, bounds, {
      material: 'sidewalk', role: 'surface', walkable: true, collidable: false, navigationPriority: 45,
    }));
  }
  for (const item of sourceChunk.layers.buildings || []) {
    layers.building.push(rectFeature('building', layers.building.length, item, bounds, {
      material: 'building', role: 'solid_footprint', walkable: false, collidable: true, navigationPriority: 100,
    }, { style: item.roofStyle || 'generic' }));
  }
  for (const item of sourceChunk.layers.details_above || []) {
    if (item.material === 'park_path') {
      layers.park.push(rectFeature('park', layers.park.length, item, bounds, {
        material: 'park_path', role: 'path_surface', walkable: true, collidable: false, navigationPriority: 30,
      }));
    } else if (item.material === 'rail') {
      layers.rail.push(rectFeature('rail', layers.rail.length, item, bounds, {
        material: 'rail', role: 'surface', walkable: true, collidable: false, navigationPriority: 40,
      }));
    }
  }
  for (const item of sourceChunk.layers.details_below || []) {
    if (item.material !== 'water') continue;
    layers.water.push(rectFeature('water', layers.water.length, item, bounds, {
      material: 'water', role: 'surface', walkable: false, collidable: false, navigationPriority: 15,
    }));
  }
  for (const item of sourceChunk.layers.collision || []) {
    if (item.material !== 'water') continue;
    layers.water.push(rectFeature('water', layers.water.length, item, bounds, {
      material: 'water', role: 'collision_mask', walkable: false, collidable: true, navigationPriority: 100,
    }));
  }

  return {
    schema: 'axm-neutral-world-chunk/v1',
    column: entry.column,
    row: entry.row,
    bounds: { x: entry.x, y: entry.y, width: entry.width, height: entry.height },
    coordinateSpace: 'world pixels; north-west origin; x east; y south',
    layers,
  };
}

function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  cleanOutputChunks();
  const map = readJson(path.join(sourceRoot, 'map.json'));
  const buildIndex = readJson(path.join(sourceRoot, 'build-index.json'));
  const rasterManifest = readJson(path.join(root, 'exports', 'tilburg-authored-city-alpha-raster', 'raster-manifest.json'));
  const actualSourceDigest = sourceDigest(map);
  if (actualSourceDigest !== buildIndex.mapAndChunksSha256) throw new Error('Authored map source digest does not match its build index.');

  const chunks = [];
  const layerTotals = Object.fromEntries(LAYER_NAMES.map((name) => [name, 0]));
  const semanticDigest = crypto.createHash('sha256');
  for (const entry of [...map.chunking.chunks].sort((a, b) => (a.row - b.row) || (a.column - b.column))) {
    const sourceChunk = readJson(path.join(root, entry.path.replace(/^\/+/, '')));
    const outputChunk = exportChunk(entry, sourceChunk);
    const buffer = Buffer.from(`${JSON.stringify(outputChunk, null, 2)}\n`);
    const name = `chunk-${String(entry.column).padStart(2, '0')}-${String(entry.row).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(outputChunks, name), buffer);
    semanticDigest.update(buffer);
    const featureCounts = Object.fromEntries(LAYER_NAMES.map((layer) => [layer, outputChunk.layers[layer].length]));
    for (const layer of LAYER_NAMES) layerTotals[layer] += featureCounts[layer];
    chunks.push({
      id: `world-${String(entry.column).padStart(2, '0')}-${String(entry.row).padStart(2, '0')}`,
      column: entry.column,
      row: entry.row,
      bounds: { x: entry.x, y: entry.y, width: entry.width, height: entry.height },
      file: `chunks/${name}`,
      sha256: sha256(buffer),
      bytes: buffer.length,
      featureCounts,
    });
  }

  const manifest = {
    schema: 'axm-neutral-world-tile-source/v1',
    id: 'tilburg-authored-city-neutral-world-source',
    generatedAt: new Date().toISOString(),
    purpose: 'Neutral environment geometry aligned with the clean raster for remapping into other games.',
    sourceMapId: map.id,
    catalogSlot: 1,
    world: { width: map.world.width, height: map.world.height, origin: 'north-west', xAxis: 'east', yAxis: 'south', unitsPerRasterPixel: 1 },
    layers: {
      included: LAYER_NAMES,
      excludedRuntimeDomains: ['missions', 'players', 'non-player characters', 'vehicles', 'territory', 'controllers', 'saves', 'session state'],
      navigationResolution: 'Any collidable=true feature blocks. Otherwise the overlapping feature with the highest navigationPriority supplies walkable.',
    },
    chunking: { tileWidth: 1024, tileHeight: 1024, columns: 12, rows: 8, count: chunks.length, chunks },
    layerTotals,
    source: {
      mapAndChunksSha256: actualSourceDigest,
      buildIndex: 'data/maps/tilburg-authored-city-alpha/build-index.json',
      generator: 'scripts/export-neutral-world-tile-source.js',
    },
    semanticChunksSha256: semanticDigest.digest('hex'),
    rasterAlignment: {
      master: '../tilburg-authored-city-alpha-raster/tilburg-authored-city-clean-12288x8192.png',
      masterSha256: rasterManifest.master.sha256,
      width: rasterManifest.master.width,
      height: rasterManifest.master.height,
      note: 'Raster is presentation only. This JSON package supplies the remappable world meaning.',
    },
    assetPolicy: 'No external asset is embedded or newly licensed by this semantic export.',
  };
  fs.writeFileSync(path.join(outputRoot, 'world-source.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`NEUTRAL_WORLD_TILE_SOURCE: PASS (${chunks.length} chunks, ${Object.values(layerTotals).reduce((sum, value) => sum + value, 0)} semantic features)\n`);
}

try { main(); }
catch (error) {
  process.stderr.write(`NEUTRAL_WORLD_TILE_SOURCE: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
}
