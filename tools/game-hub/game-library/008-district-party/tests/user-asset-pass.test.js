'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { collidesObstacle } = require('../server/spatial-index');
const { loadStaticMap } = require('../server/world-state');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative));
const readText = (relative) => read(relative).toString('utf8');
const json = (relative) => JSON.parse(readText(relative));
const sha256 = (relative) => crypto.createHash('sha256').update(read(relative)).digest('hex');

function pngInfo(relative) {
  const data = read(relative);
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG', `${relative} is a PNG`);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colourType: data[25],
  };
}

const runtimeAssets = {
  characters: [
    'player_01_axm.png', 'player_02_axm.png', 'player_03_axm.png', 'player_04_axm.png',
    'resident_old_man.png', 'resident_man_backpack.png', 'resident_woman_backpack-v2.png', 'resident_woman_tote.png',
  ],
  shopkeepers: ['shopkeeper_neutral.png', 'shopkeeper_axm.png'],
  vehicles: ['sport_red.png', 'sedan_silver.png'],
  buildings: ['corner_cafe.png', 'corner_shop_house.png', 'apartment_blue_doors.png', 'row_houses.png'],
};

test('user supplied originals remain preserved apart from curated runtime assets', () => {
  const manifest = json('assets/USER_GENERATED_ASSET_MANIFEST.json');
  const rawRoot = path.join(root, 'assets/source/user_generated/2026-07-19/raw');
  const raw = fs.readdirSync(path.join(rawRoot, 'batch_1')).length + fs.readdirSync(path.join(rawRoot, 'batch_2')).length;
  assert.equal(raw, 15);
  assert.equal(fs.readdirSync(path.join(rawRoot, 'batch_1')).length, 10);
  assert.equal(fs.readdirSync(path.join(rawRoot, 'batch_2')).length, 5);
  assert.equal(manifest.rawInputs.length, 15);
  for (const source of manifest.rawInputs) assert.equal(sha256(source.path), source.sha256, `${source.path} hash matches intake record`);
  for (const asset of manifest.runtimeAssets) assert.equal(sha256(asset.runtimeFile), asset.sha256, `${asset.runtimeFile} hash matches runtime record`);
});

test('curated runtime art has local RGBA PNGs at bounded browser sizes', () => {
  const directories = {
    characters: 'assets/selected/characters/axm_generated',
    shopkeepers: 'assets/selected/shopkeepers/axm_generated',
    vehicles: 'assets/selected/vehicles/axm_generated',
    buildings: 'assets/selected/buildings/axm_generated',
  };
  for (const [group, names] of Object.entries(runtimeAssets)) {
    for (const name of names) {
      const relative = `${directories[group]}/${name}`;
      const info = pngInfo(relative);
      assert.equal(info.colourType, 6, `${relative} retains true alpha`);
      assert.ok(info.width <= 512 && info.height <= 512, `${relative} is runtime bounded`);
    }
  }
});

test('party runtime keeps modern art available but restores animated legacy players', () => {
  const scene = readText('client/game/scenes/CityScene.js');
  const renderer = readText('client/game/rendering/entity-renderer.js');
  for (const key of ['modernPlayer1', 'resident1', 'sportRed', 'sedanSilver', 'shopkeeperNeutral', 'shopkeeperAxm', 'buildingCafe', 'buildingRow']) {
    assert.match(scene, new RegExp(`${key}:`), `${key} has a local load contract`);
  }
  assert.doesNotMatch(scene, /resident_woman_backpack\.png'/, 'rejected first matte is not loaded');
  assert.match(renderer, /if \(legacySprite\) \{ const frame = this\.frameFor\(actor\)/, 'animated legacy sheet is the active player route');
  assert.match(renderer, /else if \(modernSprite\)/, 'single-frame modern player remains a fallback for later repair');
  assert.match(renderer, /modernResident/);
  assert.match(renderer, /hashString\(npc\.id\)/, 'civilian appearance is stable across state order changes');
  assert.match(renderer, /modernPlayer\$\{identity\}/, 'slots 5-8 safely cycle the four visible identities');
});

test('landmark art aligns with existing host collision and leaves an open approach', () => {
  const art = json('data/city-art.json');
  const staticMap = loadStaticMap(root, 'tilburg-streetscape-foundation');
  assert.equal(art.buildingOverlays.length, 4);
  assert.equal(art.staticCharacters.length, 2);
  for (const building of art.buildingOverlays) {
    const footprint = building.footprint;
    const centre = { x: footprint.x + footprint.w / 2, y: footprint.y + footprint.h / 2 };
    assert.equal(building.authority, 'existing-map-collision');
    assert.equal(collidesObstacle(staticMap, centre, 2), true, `${building.id} is backed by host collision`);
    assert.equal(collidesObstacle(staticMap, building.approach, 10), false, `${building.id} has an open approach`);
  }
  for (const character of art.staticCharacters) {
    assert.equal(character.interaction, 'not-implemented');
    assert.equal(collidesObstacle(staticMap, character, 8), false, `${character.id} is displayed on open floor`);
  }
});
