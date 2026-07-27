'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

test('Tilburg streetscape profile supplies bounded identity and an honest presentation contract', () => {
  const art = json('data/city-art.json');
  const map = json('data/map.json');
  assert.equal(art.schemaVersion, 3);
  assert.equal(art.id, 'axm-tilburg-streetscape-foundation-v0-3-0');
  assert.match(art.presentation.status, /pending-human-visual-approval/);
  assert.match(art.presentation.maturity, /coarse 16 px BGT classification/i);
  assert.match(art.presentation.sourceTruth, /clipped to the existing local material masks/i);
  assert.ok(art.presentation.roofPalette.length >= 6);
  assert.ok(art.presentation.proceduralVocabulary.includes('street lamps'));
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

test('art renderer pre-renders streetscape structure and deterministic props per chunk', () => {
  const renderer = read('client/game/rendering/entity-renderer.js');
  for (const seam of ['drawChunkFoundation', 'drawSourceRoadDetails', 'drawSourceSidewalkDetails', 'drawSourceParkDetails', 'drawSourceWaterDetails', 'drawSourceRailDetails', 'drawBuildingMass', 'drawCityArt', 'drawBuildingOverlay', 'drawStaticCharacter', 'drawStreetDetail', 'drawLandmarkMotif']) {
    assert.match(renderer, new RegExp(`${seam}\\(`), `${seam} remains in the runtime renderer`);
  }
  assert.match(renderer, /chunk\.__axmSurface\s*=\s*surface/);
  assert.match(renderer, /setPresentationClock\(clock\)/, 'preview harness can freeze presentation-only animation without changing runtime time');
  assert.match(renderer, /setLineDash\(\[14, 14\]\)/, 'major-road lane markings are present');
  assert.match(renderer, /setLineDash\(\[10, 10\]\)/, 'source-aligned road runs gain readable lane dashes');
  assert.match(renderer, /hashString\(`street-prop:/, 'street lamps use stable world-coordinate identity');
  assert.match(renderer, /hashString\(`park-canopy:/, 'park canopies use stable world-coordinate identity');
  assert.doesNotMatch(renderer, /tile-buildings-[\s\S]{0,120}fillText\(b\.name/, 'source building strips are not labelled like separate buildings');
});

test('public ways remain visible above overlapping source roofs without rectangle seams', () => {
  const renderer = read('client/game/rendering/entity-renderer.js');
  const layerStart = renderer.indexOf('drawLayerSet(ctx, layers');
  const layerEnd = renderer.indexOf('tracePoints(ctx, points', layerStart);
  const layerMethod = renderer.slice(layerStart, layerEnd);
  const roofIndex = layerMethod.indexOf('const buildings = layers.buildings');
  const sidewalkIndex = layerMethod.indexOf('this.drawSourceLayer(ctx, layers.sidewalks');
  const roadIndex = layerMethod.indexOf('this.drawSourceLayer(ctx, layers.roads');
  assert.ok(roofIndex >= 0 && sidewalkIndex > roofIndex, 'pavement paints above source roof mass');
  assert.ok(roadIndex > sidewalkIndex, 'roads paint above pavement and source roof mass');
  assert.match(renderer, /item\.id\?\.startsWith\('tile-sidewalks-'\)/);
  assert.match(renderer, /item\.id\?\.startsWith\('tile-roads-'\)/);
  assert.match(renderer, /if \(!sourceTile\) \{[\s\S]{0,180}strokeRect/, 'generated map rectangles suppress internal edge seams');
});

test('source tiles form continuous streets and connected roof components with topology-aware boundaries', () => {
  const renderer = read('client/game/rendering/entity-renderer.js');
  assert.match(renderer, /sourceTileCells\(items, tileSize = 16\)/, 'source runs are reconstructed as one tile mask');
  assert.match(renderer, /sourceTileComponents\(cells, tileSize = 16\)/, 'source roof cells are grouped into connected building components');
  assert.match(renderer, /strokeSourceTileBoundary\(ctx, cells/, 'external boundaries derive from neighboring cells');
  assert.match(renderer, /material === 'sidewalk'\) ctx\.globalAlpha = \.97/, 'pavement remains readable without becoming an opaque collision layer');
  assert.match(renderer, /hashString\(`roof-component:/, 'roof style uses stable source-component identity');
  assert.match(renderer, /const roofPalette = this\.cityArt\?\.presentation\?\.roofPalette/, 'roof variety is data-driven by the presentation profile');
  assert.doesNotMatch(renderer, /for \(let diagonal = left - span/, 'the failed full-mass diagonal hatching is gone');
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
