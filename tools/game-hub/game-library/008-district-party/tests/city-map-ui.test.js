'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadCityMapFunctions() {
  const source = read('client/game/ui/city-map.js').replace(/^export /gm, '');
  return Function(`${source}\nreturn { normalizeMapMode, mapViewportLayout, collectCityMapMarkers };`)();
}

const { normalizeMapMode, mapViewportLayout, collectCityMapMarkers } = loadCityMapFunctions();
const map = { world: { width: 12288, height: 8192 }, layers: {} };

test('city map modes default safely to a persistent minimap', () => {
  assert.equal(normalizeMapMode(), 'minimap');
  assert.equal(normalizeMapMode('minimap'), 'minimap');
  assert.equal(normalizeMapMode('full'), 'full');
  assert.equal(normalizeMapMode(false), 'hidden');
  assert.equal(normalizeMapMode('external-url'), 'minimap');
});

test('minimap and full-map layouts preserve the Tilburg aspect ratio and stay on screen', () => {
  const viewport = { width: 1920, height: 1080 };
  const minimap = mapViewportLayout(viewport, map, 'minimap');
  const full = mapViewportLayout(viewport, map, 'full');
  assert.ok(minimap.width >= 184 && minimap.width <= 286);
  assert.equal(Math.round(minimap.x + minimap.width / 2), viewport.width / 2);
  assert.ok(minimap.y + minimap.height <= viewport.height - 60);
  assert.ok(full.x >= 0 && full.y >= 0);
  assert.ok(full.x + full.width <= viewport.width);
  assert.ok(full.y + full.height <= viewport.height);
  assert.ok(Math.abs(full.width / full.height - 1.5) < 0.0001);

  const compact = mapViewportLayout({ width: 480, height: 540 }, map, 'minimap');
  assert.ok(compact.x >= 0 && compact.y >= 0);
  assert.ok(compact.x + compact.width <= 480);
  assert.ok(compact.y + compact.height <= 540);
});

test('map markers expose public city goals while filtering actors to the requested party', () => {
  const fixtureMap = {
    ...map,
    layers: {
      base_zones: [{ id: 'base', name: 'Party House', x: 100, y: 200, w: 80, h: 60 }],
      interior_zones: [{ id: 'venue', name: 'Open Hall', x: 500, y: 600, w: 100, h: 80 }],
      mission_zones: [
        { id: 'pickup', kind: 'pickup', x: 700, y: 800, w: 40, h: 40 },
        { id: 'delivery', kind: 'delivery', x: 900, y: 1000, w: 40, h: 40 },
      ],
    },
  };
  const world = {
    actors: [
      { id: 'a', slot: 1, partyId: 'party_a', alive: true, position: { x: 10, y: 20 } },
      { id: 'b', slot: 5, partyId: 'party_b', alive: true, position: { x: 30, y: 40 } },
      { id: 'dead', slot: 2, partyId: 'party_a', alive: false, position: { x: 50, y: 60 } },
    ],
    vehicles: [
      { id: 'car', position: { x: 70, y: 80 } },
      { id: 'enemy-car', driverActorId: 'b', partyOwnerId: 'party_b', position: { x: 75, y: 85 } },
    ],
    territory: { zones: [{ id: 'zone', x: 90, y: 100, ownerPartyId: 'party_b', contested: true }] },
  };
  const partyA = collectCityMapMarkers(fixtureMap, world, 'party_a');
  const all = collectCityMapMarkers(fixtureMap, world, 'all');
  assert.deepEqual(partyA.filter((entry) => entry.kind === 'actor').map((entry) => entry.id), ['a']);
  assert.deepEqual(all.filter((entry) => entry.kind === 'actor').map((entry) => entry.id), ['a', 'b']);
  for (const id of ['base', 'venue', 'pickup', 'delivery', 'car', 'zone']) assert.ok(partyA.some((entry) => entry.id === id), id);
  assert.equal(partyA.some((entry) => entry.id === 'enemy-car'), false, 'opposing occupied vehicle is not an off-screen locator');
  assert.equal(all.some((entry) => entry.id === 'enemy-car'), true, 'combined development view may show both parties');
  assert.equal(partyA.find((entry) => entry.id === 'zone').contested, true);
});

test('active mission route replaces stale static pickup and delivery markers', () => {
  const fixtureMap = {
    ...map,
    layers: {
      mission_zones: [
        { id: 'board', kind: 'mission_board', x: 20, y: 20, w: 20, h: 20 },
        { id: 'old-pickup', kind: 'pickup', x: 100, y: 100, w: 20, h: 20 },
        { id: 'old-drop', kind: 'delivery', x: 200, y: 200, w: 20, h: 20 },
      ],
    },
  };
  const world = {
    actors: [], vehicles: [], territory: { zones: [] },
    mission: {
      status: 'active',
      layout: { id: 'route-2', label: 'Route 2' },
      pickupZone: { id: 'new-dispatch', label: 'New Dispatch', x: 300, y: 300, width: 40, height: 40 },
      deliveryZones: [{ id: 'new-drop', label: 'New Drop', x: 400, y: 400, width: 40, height: 40 }],
    },
  };
  const markers = collectCityMapMarkers(fixtureMap, world, 'party_a');
  assert.ok(markers.some((entry) => entry.id === 'board'));
  assert.ok(markers.some((entry) => entry.id === 'new-dispatch'));
  assert.ok(markers.some((entry) => entry.id === 'new-drop'));
  assert.equal(markers.some((entry) => entry.id === 'old-pickup'), false);
  assert.equal(markers.some((entry) => entry.id === 'old-drop'), false);
});

test('shared screen provides click, keyboard and escape controls without splitting the city view', () => {
  const html = read('client/game/game.html');
  const css = read('client/game/game.css');
  const scene = read('client/game/scenes/CityScene.js');
  assert.match(html, /id="map-toggle"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(css, /\.map-open \.mission-hud/);
  assert.match(scene, /this\.mapMode = 'minimap'/);
  assert.match(scene, /e\.code === 'KeyM'/);
  assert.match(scene, /e\.code === 'Escape'/);
  assert.match(scene, /this\.mapButton\?\.addEventListener\('click'/);
  assert.match(scene, /drawCityMap\([^\n]+this\.mapMode, this\.cityArt\)/);
  assert.doesNotMatch(html, /split[- ]screen/i);
});
