'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

test('Tilburg art profile supplies bounded district identity and original visual landmarks', () => {
  const art = json('data/city-art.json');
  const map = json('data/map.json');
  assert.equal(art.schemaVersion, 2);
  assert.equal(art.districts.length, 13);
  assert.ok(art.landmarks.length >= 8);
  assert.ok(art.streetDetails.length >= 8);
  assert.match(art.palette.road, /^#[0-9a-f]{6}$/i);
  assert.match(art.runtimeRule, /visual-only/i);
  const ids = [...art.districts, ...art.landmarks].map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'art identifiers remain unique');
  for (const entry of [...art.districts, ...art.landmarks]) {
    assert.ok(entry.x >= 0 && entry.x <= map.world.width, `${entry.id} x remains inside the city`);
    assert.ok(entry.y >= 0 && entry.y <= map.world.height, `${entry.id} y remains inside the city`);
    assert.match(entry.accent, /^#[0-9a-f]{6}$/i);
  }
});

test('art renderer pre-renders layered ground, roads, water, rail and building masses per chunk', () => {
  const renderer = read('client/game/rendering/entity-renderer.js');
  for (const seam of ['drawChunkFoundation', 'drawRoad', 'drawSidewalk', 'drawWater', 'drawRail', 'drawBuildingMass', 'drawCityArt', 'drawBuildingOverlay', 'drawStaticCharacter', 'drawStreetDetail', 'drawLandmarkMotif']) {
    assert.match(renderer, new RegExp(`${seam}\\(`), `${seam} remains in the runtime renderer`);
  }
  assert.match(renderer, /chunk\.__axmSurface\s*=\s*surface/);
  assert.match(renderer, /setLineDash\(\[14, 14\]\)/, 'major-road lane markings are present');
  assert.doesNotMatch(renderer, /tile-buildings-[\s\S]{0,120}fillText\(b\.name/, 'source building strips are not labelled like separate buildings');
});

test('party screen loads the local art profile and gives the overview a schematic street/water layer', () => {
  const scene = read('client/game/scenes/CityScene.js');
  const overview = read('client/game/ui/city-map.js');
  assert.match(scene, /fetch\('\/data\/city-art\.json'/);
  assert.match(scene, /this\.cityArt\?\.palette/);
  assert.match(scene, /renderer\.drawCityArt\(ctx, this\.cityArt\)/);
  assert.match(scene, /drawCityMap\([^\n]+this\.cityArt\)/);
  assert.match(overview, /overview\?\.waterways/);
  assert.match(overview, /overview\?\.arterials/);
  assert.match(overview, /map\.chunking\?\.columns/);
});
