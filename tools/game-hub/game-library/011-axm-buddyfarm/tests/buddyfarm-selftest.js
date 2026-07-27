#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const core = require('../runtime/game-core');
const motion = require('../runtime/farm-motion');
const { createWorldAdapter } = require('../runtime/world-adapter');
const { createRuntime } = require('../runtime/server');
const { inspectTransparentPng } = require('../scripts/generate-blank-world');

const roster = [
  { slot: 1, seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
  { slot: 2, seat_id: 'seat_2', display_name: 'Buddy', type: 'human' },
  { slot: 3, seat_id: 'seat_3', display_name: 'Farm Helper', type: 'ai' }
];

function face(actor, scene, x, y, direction) {
  actor.scene = scene;
  actor.x = x;
  actor.y = y;
  actor.facing = direction;
}

function testFarmLoop() {
  const state = core.createInitialState(roster);
  assert.deepStrictEqual(Object.keys(state.actors), ['p1', 'p2', 'p3']);
  assert.deepStrictEqual(Object.keys(state.inventory).sort(), ['buddyCarrots', 'seeds']);
  assert.strictEqual(state.actors.p1.fieldKit.level, 1);
  assert.strictEqual(state.farm.unlockedPlots, 1);

  face(state.actors.p1, 'farm', 15, 13, 'down');
  assert.ok(core.applyAction(state, 'p1', { type: 'work' }).tilled);
  assert.ok(core.applyAction(state, 'p1', { type: 'work' }).planted);
  assert.ok(core.applyAction(state, 'p1', { type: 'work' }).watered);

  face(state.actors.p1, 'house', 3, 3, 'up');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'action', holdMs: 0 }).day, 2);
  face(state.actors.p1, 'farm', 15, 13, 'down');
  assert.ok(core.applyAction(state, 'p1', { type: 'work' }).watered);
  face(state.actors.p1, 'house', 3, 3, 'up');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'action', holdMs: 0 }).day, 3);
  face(state.actors.p1, 'farm', 15, 13, 'down');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'work' }).harvested, true);
  assert.strictEqual(state.inventory.buddyCarrots, 1);
  assert.strictEqual(state.farm.growthTokens, 1);

  state.farm.growthTokens = 2;
  face(state.actors.p1, 'farm', 24, 17, 'right');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'action' }).expanded, 'east-meadow');
  assert.strictEqual(state.farm.unlockedPlots, 2);
}

function testTravelHoldAndIntentSeparation() {
  const state = core.createInitialState(roster);
  const actor = state.actors.p1;
  face(actor, 'farm', core.WORLD.portals.farmDoor.approach.x, core.WORLD.portals.farmDoor.approach.y, 'up');
  const tap = core.applyAction(state, 'p1', { type: 'action', holdMs: 199 });
  assert.strictEqual(tap.reason, 'hold-required');
  assert.strictEqual(tap.requiredHoldMs, 200);
  assert.strictEqual(actor.scene, 'farm');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'action', holdMs: 200 }).transition, 'house');
  assert.deepStrictEqual(actor.walkState.from, core.WORLD.portals.houseExit.approach);
  assert.deepStrictEqual(actor.walkState.to, core.WORLD.portals.houseExit.approach);

  for (let count = 0; count < 5; count += 1) assert.strictEqual(core.move(state, 'p1', 'right').ok, true);
  for (let count = 0; count < 5; count += 1) assert.strictEqual(core.move(state, 'p1', 'up').ok, true);
  assert.deepStrictEqual({ x: actor.x, y: actor.y }, core.WORLD.portals.houseStairs.approach);
  assert.strictEqual(core.move(state, 'p1', 'up').ok, false);
  assert.strictEqual(actor.facing, 'up');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'action', holdMs: 200 }).transition, 'cellar');
  assert.deepStrictEqual(actor.walkState.to, core.WORLD.portals.cellarStairs.approach);

  assert.deepStrictEqual({ x: actor.x, y: actor.y }, core.WORLD.portals.cellarStairs.approach);
  assert.strictEqual(core.move(state, 'p1', 'up').ok, false);
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'action', holdMs: 200 }).transition, 'house');
  assert.deepStrictEqual({ x: actor.x, y: actor.y }, core.WORLD.portals.houseStairs.approach);

  for (let count = 0; count < 5; count += 1) assert.strictEqual(core.move(state, 'p1', 'down').ok, true);
  for (let count = 0; count < 5; count += 1) assert.strictEqual(core.move(state, 'p1', 'left').ok, true);
  assert.deepStrictEqual({ x: actor.x, y: actor.y }, core.WORLD.portals.houseExit.approach);
  assert.strictEqual(core.move(state, 'p1', 'down').ok, false);
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'action', holdMs: 200 }).transition, 'farm');
  assert.deepStrictEqual({ x: actor.x, y: actor.y }, core.WORLD.portals.farmDoor.approach);

  face(actor, 'house', 6, 8, 'down');
  assert.strictEqual(core.applyAction(state, 'p1', { type: 'work' }).reason, 'use-interact');
}

function testTravelCopyContracts() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'game.manifest.json'), 'utf8'));
  assert.strictEqual(manifest.rules.travel_hold_ms, 200);
  const files = [
    path.join(__dirname, '..', 'runtime', 'controller.html'),
    path.join(__dirname, '..', 'docs', 'INPUT_INTENT_CONTRACT.md'),
    path.join(__dirname, '..', 'README_FIRST.md'),
    path.join(__dirname, '..', 'KNOWN_LIMITS.md')
  ];
  const copy = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.match(copy, /0\.2 sec|200 ms/);
  assert.doesNotMatch(copy, /travel[^.\n]*(?:1000|900 ms|one second)/i);
}

function testMotionAdapter() {
  assert.strictEqual(motion.CONTRACT, 'axm.buddyfarm-motion-adapter/v1');
  assert.strictEqual(motion.windSway(1.25, { amp: 3, phase: 2 }), motion.windSway(1.25, { amp: 3, phase: 2 }));
  assert.deepStrictEqual(motion.idleBob(0.5, { phase: 1 }), motion.idleBob(0.5, { phase: 1 }));
  assert.strictEqual(motion.growthStage(1, 3).stage, 2);
  assert.deepStrictEqual(
    motion.interpolateGridMove({ x: 2, y: 4 }, { x: 3, y: 4 }, 75, 150),
    { x: 2.5, y: 4, progress: 0.5, moving: true }
  );
  assert.deepStrictEqual(
    ['up', 'down', 'left', 'right'].map(direction => motion.walkCycle(direction, .5).direction),
    ['up', 'down', 'left', 'right']
  );
  assert.strictEqual(motion.walkCycle('left', .5).footstepContact, true);
  assert.strictEqual(motion.crossedFootstep(.49, .5), true);
  assert.strictEqual(motion.workPulse(460, 460).active, false);

  const state = core.createInitialState(roster);
  const before = { x: state.actors.p1.x, y: state.actors.p1.y };
  assert.strictEqual(core.move(state, 'p1', 'left').ok, true);
  assert.strictEqual(state.actors.p1.walkState.sequence, 1);
  assert.deepStrictEqual(state.actors.p1.walkState.from, before);
  assert.deepStrictEqual(state.actors.p1.walkState.to, { x: before.x - 1, y: before.y });
  assert.strictEqual(state.actors.p1.walkState.durationMs, 150);
  assert.strictEqual(state.actors.p1.walkState.footstepAtMs, 75);
}

function testSharedPresentationContract() {
  const app = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'app.js'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'index.html'), 'utf8');
  assert.match(app, /canvases\.get\('shared'\)/);
  assert.match(app, /ONE SHARED WORLD/);
  assert.doesNotMatch(app, /forEach\(actor => renderActor/);
  assert.match(app, /drawTransparentSubstrates/);
  assert.match(app, /interpolateGridMove/);
  assert.match(app, /12,288×8,192/);
  assert.match(page, /id="map-toggle"/);
  assert.match(page, /One shared BuddyFarm world/);
}

function testBlankWorldCoverageAndStreaming() {
  const root = path.join(__dirname, '..', 'runtime', 'world');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'blank-world-source.json'), 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'blank-world-verification.json'), 'utf8'));
  assert.strictEqual(manifest.schema, 'axm.buddyfarm-blank-world-source/v1');
  assert.deepStrictEqual([manifest.world.width, manifest.world.height], [12288, 8192]);
  assert.deepStrictEqual(
    [manifest.chunking.tileWidth, manifest.chunking.tileHeight, manifest.chunking.columns, manifest.chunking.rows, manifest.tiles.length],
    [1024, 1024, 12, 8, 96]
  );
  assert.strictEqual(manifest.contentPolicy.transparentSubstrateOnly, true);
  assert.strictEqual(manifest.contentPolicy.authoredCityRasterImported, false);
  assert.strictEqual(manifest.contentPolicy.authoredCitySemanticLayersImported, false);
  assert.strictEqual(receipt.result, 'PASS');
  assert.strictEqual(receipt.pixels.everyTileFullyTransparent, true);
  assert.strictEqual(receipt.chunks.exactNoGapNoOverlapCoverage, true);

  const coordinateKeys = new Set();
  let coveredArea = 0;
  manifest.tiles.forEach(tile => {
    coordinateKeys.add(tile.column + ',' + tile.row);
    assert.deepStrictEqual(tile.bounds, {
      x: tile.column * 1024,
      y: tile.row * 1024,
      width: 1024,
      height: 1024
    });
    const bytes = fs.readFileSync(path.join(root, tile.file));
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.tileSha256);
    assert.strictEqual(tile.alpha, 'fully-transparent');
    coveredArea += tile.bounds.width * tile.bounds.height;
  });
  assert.strictEqual(coordinateKeys.size, 96);
  assert.strictEqual(coveredArea, 12288 * 8192);
  const pixels = inspectTransparentPng(fs.readFileSync(path.join(root, manifest.tiles[0].file)));
  assert.deepStrictEqual(
    { width: pixels.width, height: pixels.height, alphaNonZero: pixels.alphaNonZero, rgbNonZero: pixels.rgbNonZero },
    { width: 1024, height: 1024, alphaNonZero: 0, rgbNonZero: 0 }
  );

  const adapter = createWorldAdapter();
  const state = core.createInitialState(roster);
  const nearView = adapter.viewForState(state);
  assert.deepStrictEqual([adapter.grid.width, adapter.grid.height], [384, 256]);
  assert.strictEqual(nearView.activeChunkCount, 4);
  assert.ok(nearView.activeChunkCount < 96);
  assert.ok(nearView.chunks.some(chunk => chunk.explored === false));
  nearView.chunks.forEach(chunk => {
    assert.strictEqual(chunk.substrate.alpha, 'fully-transparent');
    assert.deepStrictEqual(chunk.gameLayers.map(layer => layer.layer), ['meadow-foundation']);
    assert.doesNotMatch(chunk.gameLayers.map(layer => layer.layer + ' ' + layer.material).join(' '), /building|road|sidewalk|rail|park|city/i);
  });

  state.actors.p2.x = 70;
  state.actors.p2.y = 70;
  const farView = adapter.viewForState(state);
  assert.ok(farView.activeChunkCount <= Object.keys(state.actors).length * 9);
  assert.ok(farView.activeChunkCount < 96);
  assert.ok(state.exploration.exploredChunks.includes('2,2'));
  const exported = core.snapshot(state);
  assert.deepStrictEqual(exported.exploration, state.exploration);
  assert.strictEqual(adapter.isWalkableCell(383, 255), true);
  assert.strictEqual(adapter.isWalkableCell(384, 255), false);
}

function testSharedWorldAndControllerRouting() {
  const state = core.createInitialState(roster);
  face(state.actors.p1, 'farm', 15, 13, 'down');
  face(state.actors.p2, 'farm', 15, 13, 'down');
  assert.ok(core.applyAction(state, 'p1', { type: 'work' }).tilled);
  assert.ok(core.applyAction(state, 'p2', { type: 'work' }).planted);
  assert.strictEqual(Object.keys(state.farm.cells).length, 1);
  assert.strictEqual(state.inventory.seeds, 11);
  assert.strictEqual(state.actors.p1.workState.kind, 'prepare');
  assert.strictEqual(state.actors.p2.workState.kind, 'plant');

  const defaults = core.normalizeRoster([]);
  assert.deepStrictEqual(defaults.map(seat => [seat.id, seat.type]), [['p1', 'human'], ['p2', 'human']]);
  assert.deepStrictEqual(core.gamepadPlayerIds(state.actors, 'p1', 1), ['p2']);
  assert.deepStrictEqual(core.gamepadPlayerIds(state.actors, 'p1', 2), ['p1', 'p2']);
  assert.strictEqual(core.gamepadPlayerIds(defaults, 'p1', 3).includes('p3'), false);
}

function testBoundedAiHelper() {
  const state = core.createInitialState(roster);
  for (let index = 0; index < 100; index += 1) core.helperStep(state, 'p3');
  assert.strictEqual(state.actors.p3.helperBudget.completedTasks, 3);
  assert.strictEqual(state.inventory.seeds, 11);
  assert.strictEqual(Object.keys(state.farm.cells).length, 1);
  assert.strictEqual(Object.values(state.farm.cells)[0].watered, true);
}

async function testRuntime() {
  const runtime = createRuntime({ roster: core.normalizeRoster(roster) });
  assert.strictEqual(runtime.aiEnabled, false);
  await new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    runtime.server.listen(0, '127.0.0.1', resolve);
  });
  const port = runtime.server.address().port;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then(response => response.json());
    assert.strictEqual(health.ok, true);
    assert.strictEqual(health.seats, 3);
    const controller = await fetch(`http://127.0.0.1:${port}/controller.html?player=p2`).then(response => response.text());
    assert.match(controller, /viewport/i);
    assert.match(controller, /Action/i);
    assert.match(controller, /Work/i);
    assert.match(controller, /0\.2 seconds/i);
    const launcher = await fetch(`http://127.0.0.1:${port}/api/launcher-state`).then(response => response.json());
    assert.strictEqual(launcher.controllerLinks.length, 2);
    assert.strictEqual(launcher.optionalAiHelper.enabled, false);
    assert.strictEqual(launcher.world.fullyTransparent, true);
    assert.strictEqual(launcher.world.authoredCityContentImported, false);
    const statePacket = await fetch(`http://127.0.0.1:${port}/api/state`).then(response => response.json());
    assert.strictEqual(statePacket.worldView.schema, 'axm.buddyfarm-world-view/v1');
    assert.ok(statePacket.worldView.activeChunkCount < 96);
    assert.strictEqual(statePacket.worldView.overview.length, 96);
    const worldReceipt = await fetch(`http://127.0.0.1:${port}/api/world-receipt`).then(response => response.json());
    assert.strictEqual(worldReceipt.world.noGapNoOverlapCoverage, true);
    const move = await fetch(`http://127.0.0.1:${port}/api/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p2', action: { type: 'move', direction: 'left' } })
    }).then(response => response.json());
    assert.strictEqual(move.ok, true);
    assert.strictEqual(move.state.actors.p2.walkState.sequence, 1);
    assert.strictEqual(move.worldView.activeChunkCount < 96, true);
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
}

function testOptionalAiSeatContract() {
  const noAiRoster = core.normalizeRoster([
    { slot: 1, seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
    { slot: 2, seat_id: 'seat_2', display_name: 'Buddy', type: 'human' },
    { slot: 3, seat_id: 'seat_3', display_name: 'Guest', type: 'human' }
  ]);
  const humanRuntime = createRuntime({ roster: noAiRoster });
  assert.strictEqual(humanRuntime.aiEnabled, false);
  assert.strictEqual(humanRuntime.roster[2].type, 'human');
  humanRuntime.stopAi();

  const explicitAiRuntime = createRuntime({ roster: core.normalizeRoster(roster), aiEnabled: true });
  assert.strictEqual(explicitAiRuntime.aiEnabled, true);
  assert.strictEqual(explicitAiRuntime.roster[2].type, 'ai');
  assert.strictEqual(explicitAiRuntime.launcherState().optionalAiHelper.default, false);
  explicitAiRuntime.stopAi();
}

(async function main() {
  testFarmLoop();
  testTravelHoldAndIntentSeparation();
  testTravelCopyContracts();
  testMotionAdapter();
  testSharedPresentationContract();
  testBlankWorldCoverageAndStreaming();
  testSharedWorldAndControllerRouting();
  testBoundedAiHelper();
  testOptionalAiSeatContract();
  await testRuntime();
  console.log('BuddyFarm playtest-recovery selftest: PASS');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
