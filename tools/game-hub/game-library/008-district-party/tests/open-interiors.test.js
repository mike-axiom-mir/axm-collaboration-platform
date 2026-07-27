'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { collidesObstacle } = require('../server/spatial-index');
const { loadStaticMap } = require('../server/world-state');

const root = path.join(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(root, 'data', 'map.json'), 'utf8'));

test('map reserves one small and one large empty walkable venue shell', () => {
  assert.equal(map.layers.interior_zones.length, 2);
  const small = map.layers.interior_zones.find((zone) => zone.id === 'small-venue-interior');
  const large = map.layers.interior_zones.find((zone) => zone.id === 'large-venue-interior');
  assert.deepEqual({ w: small.w, h: small.h }, { w: 312, h: 216 });
  assert.deepEqual({ w: large.w, h: large.h }, { w: 744, h: 456 });
  assert.ok(large.w * large.h > small.w * small.h * 4);

  for (const zone of [small, large]) {
    assert.equal(zone.kind, 'future_venue_shell');
    assert.equal(zone.status, 'floor_ready');
    assert.equal(zone.contentModule, null, 'no casino or other activity is installed yet');
    const building = map.layers.buildings.find((entry) => entry.interiorZoneId === zone.id);
    assert.equal(building.walkable, true);
    assert.equal(building.type, 'walkable_building');
    assert.equal(building.entrance.side, 'north');
  }
});

test('both empty venue floors and north door paths are host-collision open', () => {
  const staticMap = loadStaticMap(root, 'tilburg-streetscape-foundation');
  assert.equal(staticMap.interiorZones.length, 2, 'host keeps the future attachment zones');
  const openPoints = [
    { id: 'small-centre', x: 6072, y: 4392 },
    { id: 'small-door-outside', x: 6064, y: 4256 },
    { id: 'small-door-inside', x: 6064, y: 4296 },
    { id: 'large-centre', x: 6912, y: 4592 },
    { id: 'large-door-outside', x: 6912, y: 4320 },
    { id: 'large-door-inside', x: 6912, y: 4384 },
  ];
  for (const point of openPoints) {
    assert.equal(collidesObstacle(staticMap, point, 8), false, `${point.id} remains walkable`);
  }

  assert.equal(collidesObstacle(staticMap, { x: 5908, y: 4392 }, 4), true, 'small west wall blocks movement');
  assert.equal(collidesObstacle(staticMap, { x: 7290, y: 4592 }, 4), true, 'large east wall blocks movement');
});

test('empty venue shells do not inherit Party House regeneration or safe-zone rules', () => {
  const venueIds = new Set(map.layers.interior_zones.map((zone) => zone.id));
  assert.equal(map.layers.base_zones.some((zone) => venueIds.has(zone.id)), false);
  for (const zone of map.layers.interior_zones) {
    assert.equal(Object.hasOwn(zone, 'healthRegenPerSecond'), false);
    assert.equal(map.layers.safe_zones.some((safe) => safe.x === zone.x && safe.y === zone.y), false);
  }
});

test('runtime renderer supports venue-specific floor, wall, accent and honest empty labels', () => {
  const renderer = fs.readFileSync(path.join(root, 'client', 'game', 'rendering', 'entity-renderer.js'), 'utf8');
  assert.match(renderer, /b\.interiorKind === 'future_venue_shell'/);
  assert.match(renderer, /palette\[b\.floorMaterial\]/);
  assert.match(renderer, /palette\[b\.wallMaterial\]/);
  assert.match(renderer, /b\.subtitle \|\| 'BASE REGEN/);
});
