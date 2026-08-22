'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const runtime = path.join(__dirname, 'runtime');
const serverFile = path.join(runtime, 'neon-pong-duet-server.cjs');

async function request(port, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const json = await response.json();
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
    env: { ...process.env, PORT: String(port), AXM_GAME_PLAY_MODE: mode, AXM_PLAYERS_JSON: JSON.stringify(roster), AXM_TEST_MODE: '1' },
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
    assert.equal(state.players.p2.kind, 'adapter');
    state = (await request(18942, '/start', {})).state;
    assert.equal(state.phase, 'running');
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
    await request(18943, '/start', {});
    await request(18943, '/test/set', { phase: 'running', scores: { p1: 6 }, ball: { y: -60, vy: -500, vx: 0 } });
    await new Promise(resolve => setTimeout(resolve, 120));
    const state = await request(18943, '/state');
    assert.equal(state.playMode, 'versus');
    assert.equal(state.phase, 'gameover');
    assert.equal(state.winner, 'p1');
    assert.equal(state.scores.p1, 7);
  });

  console.log('PASS AXM Pong: Duet selftest');
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
