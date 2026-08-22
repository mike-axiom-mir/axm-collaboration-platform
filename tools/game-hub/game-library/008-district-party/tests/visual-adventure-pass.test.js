'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('city renderer layers architectural depth without changing map authority', () => {
  const renderer = read('client/game/rendering/entity-renderer.js');
  assert.match(renderer, /dark southern extrusion/);
  assert.match(renderer, /roofLight\.addColorStop/);
  assert.match(renderer, /lit edge windows/i);
  assert.match(renderer, /panelCell/);
  assert.match(renderer, /facadeLight\.addColorStop/);
  assert.match(renderer, /const frontageY/);
  assert.doesNotMatch(renderer, /collision\s*=/i, 'presentation pass does not rewrite authoritative collision');
});

test('venues have distinct storefronts and interactions gain animated route breadcrumbs', () => {
  const renderer = read('client/game/rendering/entity-renderer.js');
  const scene = read('client/game/scenes/CityScene.js');
  for (const seam of ['drawVenueFacade', 'drawVenueIcon', 'drawAdventureTrail', 'drawCityAtmosphere']) assert.match(renderer, new RegExp(`${seam}\\(`));
  for (const kind of ['armory', 'casino', 'garage', 'chop-shop']) assert.match(renderer, new RegExp(`kind === '${kind.replace('-', '\\-')}'`));
  assert.match(renderer, /setLineDash\(\[7, 12\]\)/, 'world route is visibly animated');
  assert.match(scene, /drawCityAtmosphere\(ctx, this\.map, world\.cityLife, this\.cityArt\)/);
  assert.match(scene, /drawCityLife\(ctx, world\.cityLife, world\.actors\)/);
});

test('landmarks and full city map expose animated and navigational adventure cues', () => {
  const renderer = read('client/game/rendering/entity-renderer.js');
  const cityMap = read('client/game/ui/city-map.js');
  assert.match(renderer, /const trainX/);
  assert.match(renderer, /Math\.sin\(phase\)/);
  assert.match(renderer, /ctx\.ellipse\(x, y, width \* \.62, height \* \.76/);
  assert.doesNotMatch(renderer, /ctx\.font = '1000 /, 'renderer-safe labels avoid ambiguous 1000-weight parsing');
  assert.match(cityMap, /function drawAdventureRoutes/);
  assert.match(cityMap, /quadraticCurveTo/);
  assert.match(cityMap, /drawAdventureRoutes\(ctx, layout, markers, full\)/);
});
