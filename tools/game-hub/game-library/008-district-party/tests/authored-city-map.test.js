'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { collidesObstacle } = require('../server/spatial-index');
const { loadMapCatalog, publicMapCatalog, resolveMapSelection } = require('../server/map-catalog');
const { loadStaticMap } = require('../server/world-state');

const root = path.join(__dirname, '..');
const mapRoot = path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('map catalog makes the authored city Map 1 and preserves the old city as Map 2', () => {
  const catalog = loadMapCatalog(root);
  assert.equal(catalog.defaultMapId, 'tilburg-authored-city-alpha');
  assert.deepEqual(catalog.maps.map((entry) => entry.id), [
    'tilburg-authored-city-alpha',
    'tilburg-streetscape-foundation',
  ]);
  assert.deepEqual(catalog.maps.map((entry) => entry.slot), [1, 2]);
  assert.equal(publicMapCatalog(root).maps.length, 2);
  assert.equal(resolveMapSelection(root).mapUrl, '/data/maps/tilburg-authored-city-alpha/map.json');
  assert.equal(resolveMapSelection(root, 'tilburg-streetscape-foundation').mapUrl, '/data/map.json');
  assert.throws(() => resolveMapSelection(root, '../outside'), /Unknown map selection/);
});

test('authored city has the exact requested size, complete chunk grid and reproducible source hash', () => {
  const map = readJson('data/maps/tilburg-authored-city-alpha/map.json');
  const index = readJson('data/maps/tilburg-authored-city-alpha/build-index.json');
  assert.deepEqual(map.world, { width: 12288, height: 8192 });
  assert.equal(map.chunking.chunkSize, 1024);
  assert.equal(map.chunking.columns, 12);
  assert.equal(map.chunking.rows, 8);
  assert.equal(map.chunking.chunks.length, 96);
  assert.equal(new Set(map.chunking.chunks.map((entry) => `${entry.column}:${entry.row}`)).size, 96);
  const digest = crypto.createHash('sha256');
  for (const file of [path.join(mapRoot, 'map.json'), ...fs.readdirSync(path.join(mapRoot, 'map-chunks')).sort().map((name) => path.join(mapRoot, 'map-chunks', name))]) {
    digest.update(fs.readFileSync(file));
  }
  assert.equal(digest.digest('hex'), index.mapAndChunksSha256);
});

test('authored city loads as a distinct authoritative world with safe player and vehicle spawns', () => {
  const original = loadStaticMap(root, 'tilburg-streetscape-foundation');
  const authored = loadStaticMap(root);
  assert.equal(original.mapSelectionId, 'tilburg-streetscape-foundation');
  assert.equal(authored.mapSelectionId, 'tilburg-authored-city-alpha');
  assert.equal(authored.width, 12288);
  assert.equal(authored.height, 8192);
  assert.notEqual(authored.id, original.id);
  assert.ok(authored.roads.length >= 200, 'authored street grid is populated');
  assert.ok(authored.obstacles.length >= 800, 'authored collision world is populated');
  assert.equal(authored.playerSpawns.length, 8);
  for (const [index, spawn] of authored.playerSpawns.entries()) {
    assert.equal(collidesObstacle(authored, spawn, 10), false, `player spawn ${index + 1} is open`);
  }
  for (const spawn of authored.vehicleSpawns) {
    assert.equal(collidesObstacle(authored, spawn, 20), false, `${spawn.id} is open`);
  }
});

test('authored presentation is honestly marked alpha and introduces no external asset claim', () => {
  const profile = readJson('data/maps/tilburg-authored-city-alpha/city-art.json');
  const index = readJson('data/maps/tilburg-authored-city-alpha/build-index.json');
  assert.match(profile.presentation.status, /pending-human-visual-approval/);
  assert.match(index.maturity, /alpha pending human visual approval/);
  assert.equal(index.assetPolicy, 'No new external assets imported. Candidate sources are deferred and require per-asset verification.');
});
