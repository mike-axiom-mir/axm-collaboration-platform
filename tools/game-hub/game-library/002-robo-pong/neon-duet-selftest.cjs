'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { sampleStandardGamepad } = require('./runtime/neon-pong-duet.js');

const runtime = path.join(__dirname, 'runtime');
const serverFile = path.join(runtime, 'neon-pong-duet-server.cjs');
const clientSource = fs.readFileSync(path.join(runtime, 'neon-pong-duet.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(runtime, 'neon-pong-duet-client.html'), 'utf8');
const depthSource = fs.readFileSync(path.join(runtime, 'neon-pong-duet-depth.js'), 'utf8');
const serverSource = fs.readFileSync(serverFile, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'game.manifest.json'), 'utf8'));

assert.match(clientSource, /if \(player === 'screen'\) \{\s*mountAetherglass\(\);\s*pollGamepads\(\);\s*render\(\);\s*\}/, 'phone controller skips hidden canvas, lighting and gamepad render loops');
assert.match(clientSource, /STARTING IN/, 'shared screen exposes an explicit start countdown');
assert.match(clientSource, /startButton\.onclick = beginStartCountdown/, 'shared screen can begin the countdown');
assert.match(clientSource, /controllerStartButton\.onclick = beginStartCountdown/, 'phone controller can begin the same countdown');
assert.match(clientSource, /controllerName\.textContent = mine\.name\.toUpperCase\(\)/, 'phone identity label comes from the authoritative assigned seat');
assert.ok(htmlSource.includes('id="game3d"') && htmlSource.indexOf('neon-pong-duet-depth.js') < htmlSource.indexOf('neon-pong-duet.js'), 'shared screen loads a registered 3D canvas before game authority');
assert.ok(depthSource.includes("getContext('webgl'") && depthSource.includes('gl.enable(gl.DEPTH_TEST)'), 'presentation relief uses a depth-tested WebGL context');
assert.ok(depthSource.includes('var OCTAHEDRON = facetedVertices(') && depthSource.includes('floor(clamp(lit, 0.0, 1.0) * 15.0 + 0.5) / 15.0'), 'relief uses faceted geometry and a sixteen-step color shader');
assert.ok(depthSource.includes("canvas.dataset.modelProfile='duet-relief-v1'") && depthSource.includes('canvas.dataset.triangles=String(triangles)'), 'the live renderer discloses model profile and triangle submission');
assert.ok(clientSource.includes("canvas.dataset.visualAuthority = depthStage.available ? 'hybrid-webgl-canvas' : 'canvas-fallback'"), 'Canvas gameplay authority keeps an explicit no-WebGL fallback');
assert.ok(serverSource.includes("url.pathname === '/neon-pong-duet-depth.js'"), 'the local server delivers the WebGL module');
assert.ok(manifest.package.required_paths.includes('runtime/neon-pong-duet-depth.js'), 'the package requires its WebGL presentation module');
assert.equal(manifest.controls.intent_protocol, 'axm-semantic-input-v1');
assert.equal(manifest.controls.adapter_observation, 'axm-seat-screen-semantics-v1');

function gamepad(options = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  for (const index of options.buttons || []) buttons[index] = { pressed: true, value: 1 };
  return { id: 'TEST XBOX PAD', mapping: options.mapping || 'standard', axes: options.axes || [0, 0, 0, 0], buttons };
}

assert.deepEqual(sampleStandardGamepad(null), { connected: false, supported: false, left: false, right: false, primary: false, pause: false });
assert.equal(sampleStandardGamepad(gamepad({ axes: [-0.8, 0, 0, 0] })).left, true, 'left stick maps to paddle left');
assert.equal(sampleStandardGamepad(gamepad({ axes: [0.8, 0, 0, 0] })).right, true, 'left stick maps to paddle right');
assert.equal(sampleStandardGamepad(gamepad({ axes: [0.1, 0, 0, 0] })).right, false, 'stick dead zone stays neutral');
assert.equal(sampleStandardGamepad(gamepad({ buttons: [15] })).right, true, 'D-pad maps to paddle movement');
assert.equal(sampleStandardGamepad(gamepad({ buttons: [0] })).primary, true, 'A maps to power');
assert.equal(sampleStandardGamepad(gamepad({ buttons: [7] })).primary, true, 'right trigger maps to power');
assert.equal(sampleStandardGamepad(gamepad({ buttons: [9] })).pause, true, 'Menu maps to pause');
assert.equal(sampleStandardGamepad(gamepad({ mapping: 'nonstandard' })).supported, false, 'non-standard mappings fail visibly instead of guessing');

async function rawRequest(port, route, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? { headers } : {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body)
  });
  const json = await response.json();
  return { response, status: response.status, json };
}

async function request(port, route, body, headers) {
  const result = await rawRequest(port, route, body, headers);
  const { response, json } = result;
  if (!response.ok) throw new Error(`${route}: ${json.error || response.status}`);
  return json;
}

async function waitForHealth(port) {
  const until = Date.now() + 6000;
  while (Date.now() < until) {
    try { return await request(port, '/health'); } catch (error) { await new Promise(resolve => setTimeout(resolve, 80)); }
  }
  throw new Error(`server on ${port} did not become healthy`);
}

async function withServer(port, mode, roster, run) {
  const child = spawn(process.execPath, [serverFile], {
    cwd: runtime,
    env: { ...process.env, PORT: String(port), AXM_GAME_PLAY_MODE: mode, AXM_PLAYERS_JSON: JSON.stringify(roster), AXM_TEST_MODE: '1', AXM_PONG_COUNTDOWN_MS: '80' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  try { await waitForHealth(port); await run(); }
  catch (error) { error.message += `\n${output}`; throw error; }
  finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1200))]);
  }
}

(async () => {
  await withServer(18942, 'story_coop', [{ seat: 'p1', display_name: 'SOLO', type: 'human', controller_id: 'p1' }], async () => {
    const health = await request(18942, '/health');
    assert.equal(health.playMode, 'story-coop');
    assert.equal(health.arenas.length, 3);
    let state = await request(18942, '/state');
    assert.equal(state.phase, 'ready', 'launch waits in ready state');
    assert.equal(state.arenaId, 'cathedral-cross', 'story co-op starts at chapter 1 when no arena is requested');
    await new Promise(resolve => setTimeout(resolve, 300));
    state = await request(18942, '/state');
    assert.equal(state.phase, 'ready', 'room never auto-starts while players get ready');
    assert.equal(state.players.p2.kind, 'ai', 'an unfilled wingmate seat is built-in AI, not an external collaborator');
    state = (await request(18942, '/start', {})).state;
    assert.equal(state.phase, 'countdown', 'phone or screen start enters a shared countdown');
    const duplicateStart = await fetch('http://127.0.0.1:18942/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(duplicateStart.status, 409, 'a duplicate start cannot reset an active countdown');
    await new Promise(resolve => setTimeout(resolve, 120));
    state = await request(18942, '/state');
    assert.equal(state.phase, 'running', 'the authoritative countdown starts the match');
    await request(18942, '/input?player=p1', { left: false, right: false, power: true });
    state = await request(18942, '/state');
    assert.ok(state.power.p1.readyIn > 6000, 'phone power input starts its cooldown');
    state = (await request(18942, '/pause', {})).state;
    assert.equal(state.phase, 'paused');
    await request(18942, '/pause', {});
    await request(18942, '/test/set', { phase: 'running', mission: { charge: state.mission.target - 1 }, ball: { y: -60, vy: -500, vx: 0 } });
    await new Promise(resolve => setTimeout(resolve, 120));
    state = await request(18942, '/state');
    assert.equal(state.phase, 'gameover');
    assert.equal(state.winner, 'team');
  });

  await withServer(18943, 'duet_versus', [
    { seat: 'p1', display_name: 'ALPHA', type: 'human', controller_id: 'p1' },
    { seat: 'p2', display_name: 'BETA', type: 'human', controller_id: 'p2' }
  ], async () => {
    const readyState = await request(18943, '/state');
    assert.equal(readyState.players.p1.name, 'ALPHA', 'seat 1 keeps the Game Hub roster identity');
    assert.equal(readyState.players.p2.name, 'BETA', 'seat 2 keeps the Game Hub roster identity instead of a stale phone name');
    await request(18943, '/start', {});
    await new Promise(resolve => setTimeout(resolve, 120));
    await request(18943, '/test/set', { phase: 'running', scores: { p1: 6 }, ball: { y: -60, vy: -500, vx: 0 } });
    await new Promise(resolve => setTimeout(resolve, 120));
    const state = await request(18943, '/state');
    assert.equal(state.playMode, 'versus');
    assert.equal(state.phase, 'gameover');
    assert.equal(state.winner, 'p1');
    assert.equal(state.scores.p1, 7);
  });

  await withServer(18944, 'duet_versus', [
    { seat_id: 'seat_1', display_name: 'HUMAN', type: 'human' },
    { seat_id: 'seat_2', display_name: 'NOVA', type: 'adapter', adapter_id: 'nova-local' }
  ], async () => {
    const bootstrap = await request(18944, '/api/host/bootstrap');
    const adapter = bootstrap.launch.adapterBindings.find(binding => binding.seatId === 'seat_2');
    assert.ok(adapter && adapter.token, 'host-local bootstrap issues the external collaborator capability');
    assert.equal(adapter.protocol, 'axm-semantic-input-v1');
    assert.equal(adapter.observation, 'axm-seat-screen-semantics-v1');

    let state = await request(18944, '/state');
    assert.equal(state.players.p2.kind, 'adapter');
    assert.equal(JSON.stringify(state).includes(adapter.token), false, 'public match state never exposes seat capabilities');
    const initialX = state.paddles.p2.x;

    const wrongObservation = await rawRequest(18944, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': 'wrong' });
    assert.equal(wrongObservation.status, 403);
    assert.equal(wrongObservation.json.reason, 'seat-token-rejected');
    let observation = await request(18944, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.schema, 'axm-seat-screen-semantics-v1');
    assert.equal(observation.scope, 'seat-screen-visible-only');
    assert.equal(observation.self.seatId, 'seat_2');
    assert.equal(observation.controls.nextSequenceMinimum, 0);
    const serialized = JSON.stringify(observation);
    assert.equal(serialized.includes(adapter.token), false);
    assert.equal(serialized.includes('rateWindow'), false);
    assert.equal(serialized.includes('lastSeenAt'), false);
    assert.equal(serialized.includes('adapterConsent'), false);

    const wrongToken = await rawRequest(18944, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: 'wrong', sequence: 0, intent: { axis: 1 } });
    assert.equal(wrongToken.status, 403);
    assert.equal(wrongToken.json.reason, 'seat-token-rejected');
    const outcomeClaim = await rawRequest(18944, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { winner: 'seat_2' } });
    assert.equal(outcomeClaim.status, 400);
    assert.equal(outcomeClaim.json.reason, 'machine-or-outcome-action-rejected');

    const adapterInput = await request(18944, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { axis: 1, power: false } });
    const humanInput = await request(18944, '/input?player=p1', { left: false, right: true, power: false });
    assert.equal(adapterInput.gate, 'duet-seat-authority-v1');
    assert.equal(humanInput.gate, adapterInput.gate);
    assert.deepEqual(humanInput.sanitized, adapterInput.sanitized, 'human and adapter intentions share one sanitizer and authority gate');
    const replay = await rawRequest(18944, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { axis: 1 } });
    assert.equal(replay.status, 409);
    assert.equal(replay.json.reason, 'stale-sequence');
    await new Promise(resolve => setTimeout(resolve, 90));
    state = await request(18944, '/state');
    assert.ok(state.paddles.p2.x > initialX, 'accepted collaborator intent moves its authoritative paddle');
    observation = await request(18944, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.controls.nextSequenceMinimum, 1);
  });

  console.log('PASS AXM Pong: Duet selftest');
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
