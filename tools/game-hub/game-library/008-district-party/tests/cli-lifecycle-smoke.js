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
    vehicleCount: 2,
    displayStatus: 'running',
    displayRouteIsLocal: true,
    assetStatus: 200,
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
        child.kill('SIGINT');
      });
    }
    await delay(50);
    const pidRemoved = !fs.existsSync(path.join(root, '.axm-district-party.pid'));
    console.log(`CLEAN_SHUTDOWN_PID_FILE_REMOVED=${pidRemoved}`);
    if (!pidRemoved) exitCode = 1;
    process.exitCode = exitCode;
  }
})();
