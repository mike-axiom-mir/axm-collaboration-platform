'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sourceRoot = path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha');
const exportRoot = path.join(root, 'exports', 'tilburg-authored-city-world-tile-source');
const manifestPath = path.join(exportRoot, 'world-source.json');
const receiptPath = path.join(exportRoot, 'world-source-verification.json');
const LAYERS = Object.freeze(['ground', 'road', 'sidewalk', 'building', 'park', 'water', 'rail']);
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function sourceDigest(manifest) {
  const digest = crypto.createHash('sha256');
  digest.update(fs.readFileSync(path.join(sourceRoot, 'map.json')));
  const names = fs.readdirSync(path.join(sourceRoot, 'map-chunks')).filter((name) => name.endsWith('.json')).sort();
  for (const name of names) digest.update(fs.readFileSync(path.join(sourceRoot, 'map-chunks', name)));
  const actual = digest.digest('hex');
  if (actual !== manifest.source.mapAndChunksSha256) throw new Error('Source map digest mismatch.');
  return actual;
}

function validateFeature(feature, layer, bounds) {
  if (typeof feature.id !== 'string' || !feature.id.startsWith(`${layer}-`)) throw new Error(`Invalid neutral ${layer} feature id.`);
  if (typeof feature.walkable !== 'boolean' || typeof feature.collidable !== 'boolean') throw new Error(`${feature.id} is missing boolean walkability flags.`);
  if (!Number.isFinite(feature.navigationPriority)) throw new Error(`${feature.id} is missing navigation priority.`);
  const world = feature.geometry?.world, local = feature.geometry?.chunkLocal;
  if (feature.geometry?.type !== 'rect' || !world || !local) throw new Error(`${feature.id} does not contain both world and chunk-local rect geometry.`);
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(world[key]) || !Number.isFinite(local[key])) throw new Error(`${feature.id} has invalid ${key}.`);
  }
  if (world.width <= 0 || world.height <= 0 || local.width !== world.width || local.height !== world.height) throw new Error(`${feature.id} has invalid dimensions.`);
  if (local.x !== world.x - bounds.x || local.y !== world.y - bounds.y) throw new Error(`${feature.id} world/local coordinate mismatch.`);
  if (world.x < bounds.x || world.y < bounds.y || world.x + world.width > bounds.x + bounds.width || world.y + world.height > bounds.y + bounds.height) {
    throw new Error(`${feature.id} escapes its declared chunk.`);
  }
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== 'axm-neutral-world-tile-source/v1') throw new Error('Unexpected world source schema.');
  if (manifest.world?.width !== 12288 || manifest.world?.height !== 8192 || manifest.world?.unitsPerRasterPixel !== 1) throw new Error('World/raster coordinate contract mismatch.');
  if (manifest.catalogSlot !== 1) throw new Error('Authored world source is not catalogued as Map 1.');
  if (JSON.stringify(manifest.layers?.included) !== JSON.stringify(LAYERS)) throw new Error('Semantic layer contract mismatch.');
  if (manifest.chunking?.columns !== 12 || manifest.chunking?.rows !== 8 || manifest.chunking?.count !== 96 || manifest.chunking?.chunks?.length !== 96) {
    throw new Error('World source must contain exactly 12x8 chunks.');
  }

  const occupied = new Set();
  const totals = Object.fromEntries(LAYERS.map((layer) => [layer, 0]));
  const semanticDigest = crypto.createHash('sha256');
  for (const entry of manifest.chunking.chunks) {
    const key = `${entry.column}:${entry.row}`;
    if (occupied.has(key)) throw new Error(`Duplicate chunk ${key}.`);
    occupied.add(key);
    if (entry.bounds.x !== entry.column * 1024 || entry.bounds.y !== entry.row * 1024 || entry.bounds.width !== 1024 || entry.bounds.height !== 1024) {
      throw new Error(`${entry.id} is off the exact chunk grid.`);
    }
    const buffer = fs.readFileSync(path.join(exportRoot, entry.file));
    if (sha256(buffer) !== entry.sha256 || buffer.length !== entry.bytes) throw new Error(`${entry.file} hash or byte receipt mismatch.`);
    semanticDigest.update(buffer);
    const chunkText = buffer.toString('utf8');
    if (/\b(mission|player|npc|rival|vehicle|party|territory|controller|save|session)\b/i.test(chunkText)) throw new Error(`${entry.file} contains excluded runtime-domain language.`);
    const chunk = JSON.parse(chunkText);
    if (chunk.column !== entry.column || chunk.row !== entry.row || JSON.stringify(Object.keys(chunk.layers)) !== JSON.stringify(LAYERS)) throw new Error(`${entry.file} structure mismatch.`);
    for (const layer of LAYERS) {
      if (chunk.layers[layer].length !== entry.featureCounts[layer]) throw new Error(`${entry.file} ${layer} count mismatch.`);
      for (const feature of chunk.layers[layer]) validateFeature(feature, layer, entry.bounds);
      totals[layer] += chunk.layers[layer].length;
    }
    if (chunk.layers.ground.length < 1 || chunk.layers.ground[0].role !== 'base_surface') throw new Error(`${entry.file} lacks its complete base ground surface.`);
  }
  for (let row = 0; row < 8; row += 1) for (let column = 0; column < 12; column += 1) if (!occupied.has(`${column}:${row}`)) throw new Error(`Missing chunk ${column}:${row}.`);
  if (JSON.stringify(totals) !== JSON.stringify(manifest.layerTotals)) throw new Error('Manifest semantic totals do not match chunk contents.');
  const semanticChunksSha256 = semanticDigest.digest('hex');
  if (semanticChunksSha256 !== manifest.semanticChunksSha256) throw new Error('Combined semantic chunk digest mismatch.');
  const mapAndChunksSha256 = sourceDigest(manifest);

  const rasterManifest = JSON.parse(fs.readFileSync(path.join(root, 'exports', 'tilburg-authored-city-alpha-raster', 'raster-manifest.json'), 'utf8'));
  const rasterFile = path.join(root, 'exports', 'tilburg-authored-city-alpha-raster', rasterManifest.master.file);
  const rasterHash = sha256(fs.readFileSync(rasterFile));
  if (rasterHash !== manifest.rasterAlignment.masterSha256 || rasterHash !== rasterManifest.master.sha256) throw new Error('Raster alignment hash mismatch.');
  if (manifest.rasterAlignment.width !== 12288 || manifest.rasterAlignment.height !== 8192) throw new Error('Raster alignment dimensions mismatch.');

  const receipt = {
    schema: 'axm-neutral-world-source-verification/v1',
    verifiedAt: new Date().toISOString(),
    result: 'PASS',
    world: manifest.world,
    chunks: { columns: 12, rows: 8, count: occupied.size, exactGridCoverage: true },
    layers: totals,
    flags: { walkableAndCollidableAreBooleanOnEveryFeature: true, navigationPriorityOnEveryFeature: true },
    coordinates: { worldAndChunkLocalRectsOnEveryFeature: true, allFeaturesWithinChunkBounds: true },
    excludedRuntimeDomainsAbsentFromChunks: true,
    mapAndChunksSha256,
    semanticChunksSha256,
    alignedRasterSha256: rasterHash,
    verdict: 'Technically ready for semantic remapping. Farm design suitability remains a separate human/game-design decision.',
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`NEUTRAL_WORLD_TILE_SOURCE_VERIFY: PASS (${occupied.size} chunks, ${Object.values(totals).reduce((sum, value) => sum + value, 0)} features, raster-aligned)\n`);
}

try { main(); }
catch (error) {
  process.stderr.write(`NEUTRAL_WORLD_TILE_SOURCE_VERIFY: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
}
