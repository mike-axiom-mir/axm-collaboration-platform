'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionManager } = require('../server/session-manager');
const { serializeStaticWorld } = require('../server/display-state');
const { collidesObstacle, queryFeatures } = require('../server/spatial-index');
const { loadStaticMap } = require('../server/world-state');

const root = path.join(__dirname, '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

test('Tilburg foundation is 96 old-map areas split into 96 bounded local chunks', () => {
  const map = readJson('data/map.json');
  assert.deepEqual(map.world, { width: 12288, height: 8192 });
  assert.deepEqual(map.sourceGrid, { columns: 768, rows: 512 });
  assert.equal(map.statistics.groundAreaComparedWithV017, 96);
  assert.equal(map.chunking.chunkSize, 1024);
  assert.equal(map.chunking.columns, 12);
  assert.equal(map.chunking.rows, 8);
  assert.equal(map.chunking.chunks.length, 96);
  assert.equal(new Set(map.chunking.chunks.map((entry) => `${entry.column}:${entry.row}`)).size, 96);
  for (const entry of map.chunking.chunks) {
    const file = path.join(root, entry.path.replace(/^\//, ''));
    assert.ok(fs.statSync(file).size < 600_000, `${entry.id} remains a local viewport-sized payload`);
    const chunk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(chunk.format, 'AXM_MAP_CHUNK_V1');
    assert.equal(chunk.column, entry.column);
    assert.equal(chunk.row, entry.row);
  }
});

test('official BGT source index retains exact acquisition counts, snapshot and CC0 record', () => {
  const source = readJson('data/tilburg-source-index.json');
  assert.equal(source.source.publisher, 'PDOK / Dutch BGT source holders');
  assert.equal(source.source.license, 'CC0 1.0');
  assert.equal(source.query.snapshotDatetime, '2026-07-18T00:00:00Z');
  assert.deepEqual(Object.fromEntries(source.query.collections.map((entry) => [entry.collection, entry.sourceFeatureCount])), {
    begroeidterreindeel: 71916,
    waterdeel: 4491,
    wegdeel: 79695,
    spoor: 469,
    pand: 132560,
  });
  assert.equal(source.transform.rawSourceArchivesIncluded, false);
  assert.match(source.output.sha256MapAndChunks, /^[a-f0-9]{64}$/);
});

test('compiled gameplay spawns and commands are host-collision-safe', () => {
  const staticMap = loadStaticMap(root);
  const territory = readJson('data/territory-zones.json');
  const entries = [
    ...staticMap.playerSpawns.map((entry) => ({ ...entry, radius: 10 })),
    ...staticMap.vehicleSpawns.map((entry) => ({ ...entry, radius: 20 })),
    ...staticMap.npcSpawns.map((entry) => ({ ...entry, radius: 8 })),
    ...staticMap.rivalSpawns.map((entry) => ({ ...entry, radius: 8 })),
    ...territory.playerSpawns.map((entry) => ({ ...entry, radius: 10 })),
    ...territory.vehicleSpawns.map((entry) => ({ ...entry, radius: 20 })),
    ...territory.zones.map((entry) => ({ ...entry, radius: 8 })),
    ...Object.values(territory.commandPosts).flatMap((post) => [
      { id: post.id, x: post.x, y: post.y, radius: 8 },
      { id: `${post.id}-reinforcement`, ...post.reinforcementSpawn, radius: 10 },
    ]),
  ];
  for (const entry of entries) assert.equal(collidesObstacle(staticMap, entry, entry.radius), false, `${entry.id || entry.slot} is open`);
});

test('spatial queries touch nearby buckets instead of scanning the complete city feature set', () => {
  const staticMap = loadStaticMap(root);
  const aroundBase = { left: 6200, right: 7300, top: 5800, bottom: 6800 };
  const nearby = queryFeatures(staticMap, 'obstacles', aroundBase);
  assert.ok(nearby.length > 0);
  assert.ok(nearby.length < staticMap.obstacles.length / 4);
  assert.ok(staticMap.obstacles.length > 10_000, 'test exercises a genuinely city-scale collision set');
});

test('static world endpoint advertises the local chunk manifest without broadcasting collision geometry', () => {
  const manager = new SessionManager({ projectRoot: root });
  const launch = manager.createSession({ players: [{ slot: 1, controllerType: 'human' }] });
  const payload = serializeStaticWorld(manager.getSession(launch.sessionId));
  const serialized = JSON.stringify(payload);
  assert.equal(payload.mapUrl, '/data/map.json');
  assert.equal(payload.map.chunking.chunks.length, 96);
  assert.ok(serialized.length < 100_000);
  assert.doesNotMatch(serialized, /"obstacles"/);
});

test('party renderer uses visible chunk loading and pre-rendered chunk surfaces', () => {
  const scene = fs.readFileSync(path.join(root, 'client/game/scenes/CityScene.js'), 'utf8');
  const loader = fs.readFileSync(path.join(root, 'client/game/rendering/map-chunk-loader.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'client/game/rendering/entity-renderer.js'), 'utf8');
  assert.match(scene, /visibleBounds/);
  assert.match(scene, /visibleChunks/);
  assert.match(loader, /prefetchMarginChunks/);
  assert.match(loader, /cacheLimit/);
  assert.match(renderer, /__axmSurface/);
  assert.match(renderer, /OffscreenCanvas/);
});
