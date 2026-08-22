'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { privateLanAddresses } = require('../server/server');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('required launcher, controller, party receiver, and game controls exist', () => {
  const expectedIds = {
    'client/launcher/launcher.html': [
      'game-mode', 'seat-grid', 'seat-grid-b', 'enable-eight', 'host-ai-fill', 'start-session', 'combat-enabled', 'ff-a', 'ff-b', 'cross-party',
      'ally-knockback', 'lan-address', 'restart-session', 'end-session', 'open-party', 'open-party-b',
    ],
    'client/controller/controller.html': [
      'player-name', 'party-label', 'connection', 'stick', 'action', 'attack', 'sprint', 'brake',
      'shield', 'inventory-toggle', 'inventory-prev', 'inventory-next', 'inventory-activate',
    ],
    'client/party-screen/party-screen.html': ['waiting', 'game-frame', 'party-title'],
    'client/game/game.html': [
      'city-canvas', 'connection-banner', 'tether-warning', 'friendly-fire', 'debug',
      'base-regen', 'inventory-overlays', 'map-toggle', 'mission-menu', 'results', 'justice-status', 'gamepad-status', 'territory-zones', 'city-vehicle-build',
    ],
  };
  for (const [relative, ids] of Object.entries(expectedIds)) {
    const source = read(relative);
    for (const id of ids) assert.match(source, new RegExp(`id=["']${id}["']`), `${relative} contains #${id}`);
  }
});

test('District Dominion data defines city-scale zones, mirrored commands, eight spawns, and bounded reinforcement rules', () => {
  const territory = JSON.parse(read('data/territory-zones.json'));
  assert.equal(territory.mode, 'district_dominion');
  assert.equal(territory.zones.length, 13);
  assert.equal(territory.playerSpawns.length, 8);
  assert.deepEqual(territory.playerSpawns.map((spawn) => spawn.slot), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(territory.commandPosts.party_a);
  assert.ok(territory.commandPosts.party_b);
  assert.ok(territory.vehicleSpawns.length >= 6);
  assert.equal(territory.reinforcement.squadSize, 2);
  assert.equal(territory.reinforcement.maxActivePerParty, 4);
  assert.ok(territory.reinforcement.costCents > 0);
});

test('locally vendored QR generator is present without a remote QR API', () => {
  const qrPath = path.join(root, 'client/vendor/qrcode.js');
  assert.ok(fs.statSync(qrPath).size > 20_000);
  assert.match(read('client/vendor/qrcode.js'), /qrcode/);
  assert.doesNotMatch(read('client/launcher/launcher.js'), /fetch\s*\(\s*['"]https?:\/\//i);
});

test('launcher escapes host-supplied player labels before join-board HTML', () => {
  const source = read('client/launcher/launcher.js');
  assert.match(source, /escapeHtml\(player\.displayName\)/);
  assert.match(source, /escapeHtml\(player\.seatId\)/);
});

test('launcher defaults to sparse ready seats and keeps Host AI substitution explicitly opt-in', () => {
  const html = read('client/launcher/launcher.html');
  const source = read('client/launcher/launcher.js');
  assert.match(html, /District Dominion · 1–4 vs 1–4/);
  assert.match(html, /id="host-ai-fill" type="checkbox"/);
  assert.doesNotMatch(html, /id="host-ai-fill"[^>]*checked/);
  assert.match(source, /enabled\.checked = slot === 1 \|\| slot === 5/);
  assert.match(source, /hostAiFillEmptySeats: fillWithHostAi/);
  assert.doesNotMatch(source, /players\.length !== 8/);
});

test('structured city map contains the required gameplay layer semantics', () => {
  const map = JSON.parse(read('data/map.json'));
  assert.equal(map.generatedWithTiled, false);
  assert.equal(map.world.width, 12288);
  assert.equal(map.world.height, 8192);
  assert.equal(map.format, 'AXM_CHUNKED_CITY_MAP');
  assert.equal(map.chunking.enabled, true);
  assert.equal(map.chunking.chunks.length, 96);
  assert.equal(map.statistics.groundAreaComparedWithV017, 96);
  for (const layer of [
    'ground', 'roads', 'sidewalks', 'buildings', 'details_below', 'details_above',
    'collision', 'player_spawns', 'vehicle_spawns', 'npc_spawns', 'mission_zones',
    'safe_zones', 'party_regroup_zones', 'base_zones', 'interior_zones',
  ]) assert.ok(Array.isArray(map.layers[layer]), `map layer ${layer}`);
  assert.equal(map.layers.player_spawns.length, 8);
  assert.ok(map.layers.vehicle_spawns.length >= 2);
  assert.ok(map.layers.npc_spawns.length >= 8);
  assert.ok(map.layers.mission_zones.some((zone) => zone.kind === 'pickup'));
  assert.ok(map.layers.mission_zones.some((zone) => zone.kind === 'mission_board'));
  assert.ok(map.layers.mission_zones.filter((zone) => zone.kind === 'delivery').length >= 2);
  for (const chunk of map.chunking.chunks) {
    assert.ok(fs.statSync(path.join(root, chunk.path.replace(/^\//, ''))).size > 0, chunk.path);
  }
  const partyBase = map.layers.base_zones.find((zone) => zone.kind === 'party_base');
  assert.ok(partyBase, 'walkable party base zone');
  for (const spawn of map.layers.player_spawns.filter((entry) => entry.slot <= 4)) {
    assert.ok(spawn.x >= partyBase.x && spawn.x <= partyBase.x + partyBase.w, `seat ${spawn.slot} starts inside base x`);
    assert.ok(spawn.y >= partyBase.y && spawn.y <= partyBase.y + partyBase.h, `seat ${spawn.slot} starts inside base y`);
  }
});

test('every first-party runtime asset referenced by CityScene exists locally', () => {
  for (const relative of [
    'assets/selected/characters/player_01_urban.png',
    'assets/selected/characters/player_02_urban.png',
    'assets/selected/characters/player_03_urban.png',
    'assets/selected/characters/player_04_urban.png',
    'assets/selected/characters/npc_01_urban.png',
    'assets/selected/characters/npc_02_urban.png',
    'assets/selected/vehicles/urban_car_green_wide_a.png',
    'assets/selected/vehicles/urban_car_yellow_wide_a.png',
    'assets/selected/props/package_box.png',
    'assets/selected/props/tree_green_small.png',
  ]) assert.ok(fs.statSync(path.join(root, relative)).size > 0, relative);
});

test('first-party runtime scripts contain no external network request literal', () => {
  const firstPartyScripts = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'vendor') visit(full);
      } else if (entry.name.endsWith('.js')) firstPartyScripts.push(full);
    }
  }
  visit(path.join(root, 'client'));
  const forbidden = /(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\([^\n]{0,120}https?:\/\//i;
  for (const file of firstPartyScripts) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), forbidden, path.relative(root, file));
});

test('LAN detection failure is handled as NOT FOUND instead of breaking health/startup', () => {
  const original = os.networkInterfaces;
  os.networkInterfaces = () => { throw Object.assign(new Error('uv_interface_addresses failed'), { code: 'ERR_SYSTEM_ERROR' }); };
  try {
    assert.deepEqual(privateLanAddresses(), []);
  } finally {
    os.networkInterfaces = original;
  }
});
