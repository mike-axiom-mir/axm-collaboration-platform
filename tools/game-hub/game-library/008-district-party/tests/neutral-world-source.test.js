'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const exportRoot = path.join(root, 'exports', 'tilburg-authored-city-world-tile-source');
const manifest = JSON.parse(fs.readFileSync(path.join(exportRoot, 'world-source.json'), 'utf8'));
const layers = ['ground', 'road', 'sidewalk', 'building', 'park', 'water', 'rail'];
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

test('neutral world source is an exact 12x8 semantic companion to the raster', () => {
  assert.equal(manifest.schema, 'axm-neutral-world-tile-source/v1');
  assert.equal(manifest.catalogSlot, 1);
  assert.deepEqual(manifest.world, {
    width: 12288, height: 8192, origin: 'north-west', xAxis: 'east', yAxis: 'south', unitsPerRasterPixel: 1,
  });
  assert.deepEqual(manifest.layers.included, layers);
  assert.equal(manifest.chunking.count, 96);
  assert.equal(manifest.chunking.chunks.length, 96);
  assert.equal(new Set(manifest.chunking.chunks.map((entry) => `${entry.column}:${entry.row}`)).size, 96);
  const rasterManifest = JSON.parse(fs.readFileSync(path.join(root, 'exports', 'tilburg-authored-city-alpha-raster', 'raster-manifest.json'), 'utf8'));
  assert.equal(manifest.rasterAlignment.masterSha256, rasterManifest.master.sha256);
  assert.equal(manifest.rasterAlignment.width, 12288);
  assert.equal(manifest.rasterAlignment.height, 8192);
});

test('every semantic feature has bounded world/local geometry and explicit navigation flags', () => {
  const totals = Object.fromEntries(layers.map((layer) => [layer, 0]));
  for (const entry of manifest.chunking.chunks) {
    const buffer = fs.readFileSync(path.join(exportRoot, entry.file));
    assert.equal(sha256(buffer), entry.sha256);
    const text = buffer.toString('utf8');
    assert.doesNotMatch(text, /\b(mission|player|npc|rival|vehicle|party|territory|controller|save|session)\b/i);
    const chunk = JSON.parse(text);
    assert.deepEqual(Object.keys(chunk.layers), layers);
    for (const layer of layers) {
      for (const feature of chunk.layers[layer]) {
        assert.equal(typeof feature.walkable, 'boolean');
        assert.equal(typeof feature.collidable, 'boolean');
        assert.equal(Number.isFinite(feature.navigationPriority), true);
        const world = feature.geometry.world, local = feature.geometry.chunkLocal;
        assert.equal(local.x, world.x - entry.bounds.x);
        assert.equal(local.y, world.y - entry.bounds.y);
        assert.ok(world.x >= entry.bounds.x && world.y >= entry.bounds.y);
        assert.ok(world.x + world.width <= entry.bounds.x + entry.bounds.width);
        assert.ok(world.y + world.height <= entry.bounds.y + entry.bounds.height);
      }
      totals[layer] += chunk.layers[layer].length;
    }
  }
  assert.deepEqual(totals, manifest.layerTotals);
  assert.ok(totals.ground >= 96);
  assert.ok(totals.road > 0 && totals.sidewalk > 0 && totals.building > 0 && totals.park > 0 && totals.water > 0 && totals.rail > 0);
});

test('source and semantic digests reproduce independently', () => {
  const sourceDigest = crypto.createHash('sha256');
  sourceDigest.update(fs.readFileSync(path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha', 'map.json')));
  for (const name of fs.readdirSync(path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha', 'map-chunks')).filter((name) => name.endsWith('.json')).sort()) {
    sourceDigest.update(fs.readFileSync(path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha', 'map-chunks', name)));
  }
  assert.equal(sourceDigest.digest('hex'), manifest.source.mapAndChunksSha256);
  const semanticDigest = crypto.createHash('sha256');
  for (const entry of manifest.chunking.chunks) semanticDigest.update(fs.readFileSync(path.join(exportRoot, entry.file)));
  assert.equal(semanticDigest.digest('hex'), manifest.semanticChunksSha256);
});
