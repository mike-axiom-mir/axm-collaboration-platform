'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const port = Number(process.env.AXM_SMOKE_PORT || 8796);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server/server.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (chunk) => { serverLog += chunk; });
child.stderr.on('data', (chunk) => { serverLog += chunk; });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestJson(route, options) {
  const response = await fetch(`${base}${route}`, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const result = await requestJson('/health');
      if (result.response.ok) return result.data;
    } catch {
      // The child may still be binding its loopback socket.
    }
    await delay(50);
  }
  throw new Error('Timed out waiting for the local health endpoint.');
}

async function run() {
  const health = await waitForHealth();
  const players = [1, 2, 3, 4].map((slot) => ({
    seatId: `seat_${slot}`,
    slot,
    displayName: `CLI P${slot}`,
    controllerType: 'human',
    ready: true,
  }));
  const started = await requestJson('/api/session/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode: 'AXM1', players }),
  });
  if (started.response.status !== 201 || !started.data.ok) throw new Error('Session start failed.');
  const session = started.data;
  const p1 = session.controllerLinks.find((link) => link.seatId === 'seat_1');
  const input = await requestJson('/api/input', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'AXM1', sessionId: session.sessionId, seatId: 'seat_1', token: p1.token,
      seq: 1, input: { moveY: -1 },
    }),
  });
  const state = await requestJson(`/api/state?roomCode=AXM1&sessionId=${encodeURIComponent(session.sessionId)}&view=party&party=party_a`);
  const display = await requestJson('/display/party_a');
  const asset = await fetch(`${base}/assets/selected/characters/player_01_urban.png`);
  const modernAssets = await Promise.all([
    '/assets/selected/characters/axm_generated/player_01_axm.png',
    '/assets/selected/characters/axm_generated/resident_woman_backpack-v2.png',
    '/assets/selected/vehicles/axm_generated/sport_red.png',
    '/assets/selected/shopkeepers/axm_generated/shopkeeper_axm.png',
    '/assets/selected/buildings/axm_generated/corner_cafe.png',
  ].map((route) => fetch(`${base}${route}`)));
  const interactableAssets = await Promise.all([
    '/assets/selected/interactables/axm_generated/parcel_box_taped.png',
    '/assets/selected/interactables/axm_generated/vending_red.png',
    '/assets/selected/interactables/axm_generated/bench_wood.png',
  ].map((route) => fetch(`${base}${route}`)));
  const userAssetManifest = await requestJson('/assets/USER_GENERATED_ASSET_MANIFEST.json');
  const interactableManifest = await requestJson('/assets/INTERACTABLE_ASSET_MANIFEST.json');
  const mapManifest = await requestJson('/data/map.json');
  const mapChunk = await requestJson('/data/map-chunks/chunk-00-00.json');
  const cityArt = await requestJson('/data/city-art.json');
  const wrongRoom = await requestJson(`/api/state?roomCode=AXM2&sessionId=${encodeURIComponent(session.sessionId)}&view=party&party=party_a`);
  const ended = await requestJson('/api/session/end', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: session.sessionId, hostToken: session.hostToken }),
  });
  const world = state.data.world;
  const result = {
    health: health.ok,
    sessionPlayers: session.players.length,
    controllerLinks: session.controllerLinks.length,
    inputActorId: input.data.actorId,
    acceptedSeq: input.data.acceptedSeq,
    actorCount: world.actors.length,
    npcCount: world.npcs.length,
    civilianCount: world.npcs.filter((npc) => npc.kind === 'civilian').length,
    rivalCount: world.npcs.filter((npc) => npc.kind === 'rival').length,
    vehicleCount: world.vehicles.length,
    displayStatus: display.data.status,
    displayRouteIsLocal: display.data.screenUrl?.startsWith('/game/') === true,
    assetStatus: asset.status,
    modernAssetStatuses: modernAssets.map((response) => response.status),
    interactableAssetStatuses: interactableAssets.map((response) => response.status),
    userAssetManifestStatus: userAssetManifest.response.status,
    userAssetRuntimeCount: userAssetManifest.data.runtimeAssets?.length,
    userAssetRawInputCount: userAssetManifest.data.rawInputs?.length,
    interactableManifestStatus: interactableManifest.response.status,
    interactableRuntimeCount: interactableManifest.data.runtimeAssets?.length,
    mapStatus: mapManifest.response.status,
    mapChunkCount: mapManifest.data.chunking?.chunks?.length,
    openInteriorCount: mapManifest.data.layers?.interior_zones?.length,
    openInteriorsRemainEmpty: mapManifest.data.layers?.interior_zones?.every((zone) => zone.status === 'floor_ready' && zone.contentModule === null),
    mapChunkStatus: mapChunk.response.status,
    mapChunkFormat: mapChunk.data.format,
    cityArtStatus: cityArt.response.status,
    cityArtDistricts: cityArt.data.districts?.length,
    cityArtLandmarks: cityArt.data.landmarks?.length,
    cityArtBuildingOverlays: cityArt.data.buildingOverlays?.length,
    cityArtStaticCharacters: cityArt.data.staticCharacters?.length,
    cityArtPropOverlays: cityArt.data.propOverlays?.length,
    wrongRoomStatus: wrongRoom.response.status,
    endStatus: ended.data.status,
  };
  const expected = {
    health: true,
    sessionPlayers: 4,
    controllerLinks: 4,
    inputActorId: 'actor-seat-1',
    acceptedSeq: 1,
    actorCount: 4,
    npcCount: 11,
    civilianCount: 8,
    rivalCount: 3,
    vehicleCount: 6,
    displayStatus: 'running',
    displayRouteIsLocal: true,
    assetStatus: 200,
    modernAssetStatuses: [200, 200, 200, 200, 200],
    interactableAssetStatuses: [200, 200, 200],
    userAssetManifestStatus: 200,
    userAssetRuntimeCount: 16,
    userAssetRawInputCount: 15,
    interactableManifestStatus: 200,
    interactableRuntimeCount: 14,
    mapStatus: 200,
    mapChunkCount: 96,
    openInteriorCount: 2,
    openInteriorsRemainEmpty: true,
    mapChunkStatus: 200,
    mapChunkFormat: 'AXM_MAP_CHUNK_V1',
    cityArtStatus: 200,
    cityArtDistricts: 13,
    cityArtLandmarks: 8,
    cityArtBuildingOverlays: 4,
    cityArtStaticCharacters: 2,
    cityArtPropOverlays: 28,
    wrongRoomStatus: 403,
    endStatus: 'ended',
  };
  if (JSON.stringify(result) !== JSON.stringify(expected)) {
    throw new Error(`Lifecycle result mismatch: ${JSON.stringify(result)}`);
  }
  console.log('CLI_LIFECYCLE_SMOKE: PASS');
  console.log(JSON.stringify(result, null, 2));
}

(async () => {
  let exitCode = 0;
  try {
    await run();
  } catch (error) {
    exitCode = 1;
    console.error('CLI_LIFECYCLE_SMOKE: FAIL');
    console.error(error.stack || error.message);
    if (serverLog) console.error(serverLog.trim());
  } finally {
    if (child.exitCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
        requestJson('/api/runtime/shutdown', { method: 'POST' }).catch(() => child.kill('SIGINT'));
      });
    }
    await delay(50);
    const pidRemoved = !fs.existsSync(path.join(root, '.axm-district-party.pid'));
    console.log(`CLEAN_SHUTDOWN_PID_FILE_REMOVED=${pidRemoved}`);
    if (!pidRemoved) exitCode = 1;
    process.exitCode = exitCode;
  }
})();
