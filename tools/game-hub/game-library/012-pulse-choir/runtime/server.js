#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const core = require('./game-core');
const checkpoints = require('./checkpoint-store');
const hubHandback = require('./hub-handback');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8802);
const GAME_PREFIX = '/games/012/';
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function parseRoster(env) {
  try {
    const parsed = JSON.parse(String((env || process.env).AXM_PLAYERS_JSON || '[]'));
    return core.normalizeRoster(parsed);
  } catch (_) {
    return core.normalizeRoster([]);
  }
}

function safeFile(urlPath) {
  let relative = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else if (relative === '/games/012') relative = '';
  else if (relative === '/controller.html') relative = 'controller.html';
  else if (relative === '/app.js') relative = 'app.js';
  else if (relative === '/styles.css') relative = 'styles.css';
  else if (relative === '/game-core.js') relative = 'game-core.js';
  else return null;
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(__dirname, relative.replace(/^\/+/, ''));
  return candidate === __dirname || candidate.startsWith(__dirname + path.sep) ? candidate : null;
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = '';
    const limit = maxBytes || 32 * 1024;
    request.on('data', chunk => {
      body += chunk;
      if (body.length > limit) request.destroy(new Error('request body too large'));
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (_) { reject(new Error('invalid JSON')); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type'
  });
  response.end(JSON.stringify(value));
}

function createRuntime(options) {
  const settings = options || {};
  const env = settings.env || process.env;
  const clock = typeof settings.clock === 'function' ? settings.clock : () => Date.now();
  const roster = core.normalizeRoster(settings.roster || parseRoster(env));
  const baseSeed = Number(env.PULSE_CHOIR_SEED || 12026);
  const checkpointStore = checkpoints.createCheckpointStore({
    clock,
    disabled: settings.checkpoint === false,
    env,
    filePath: settings.checkpoint && settings.checkpoint.filePath,
    roster,
    saveIntervalMs: settings.checkpoint && settings.checkpoint.saveIntervalMs,
    ttlMs: settings.checkpoint && settings.checkpoint.ttlMs
  });
  const loaded = checkpointStore.load();
  let state = loaded.state || core.createInitialState(roster, { seed: baseSeed, now: clock() });
  const conductorStateUpgraded = loaded.state ? core.normalizeConductorState(state) : false;
  let timer = null;
  let lastTickAt = clock();
  let lastPersistedRevision = loaded.state && !conductorStateUpgraded ? Number(state.revision) : -1;
  let suppressCheckpoint = false;
  let handbackStatus = 'ready';
  let handbackReceipt = null;
  const handbackConfig = hubHandback.configuration(env);
  const tickSamples = [];

  function persist(force) {
    if (suppressCheckpoint) return false;
    if (!force && Number(state.revision) === lastPersistedRevision) return false;
    const saved = checkpointStore.save(core.snapshot(state), Boolean(force));
    if (saved) lastPersistedRevision = Number(state.revision);
    return saved;
  }

  function handbackPacket() {
    return {
      schema: hubHandback.HANDBACK_SCHEMA,
      available: Boolean(handbackConfig.available),
      status: handbackStatus,
      hubUrl: handbackConfig.available ? handbackConfig.hubUrl : null,
      completedRounds: Number(state.show && state.show.completedRounds || 0),
      lastReceipt: handbackReceipt
    };
  }

  function statePacket() {
    return {
      ok: true,
      state: core.snapshot(state),
      metrics: core.METRICS,
      beatTypes: core.BEAT_TYPES,
      assetContract: core.ASSET_CONTRACT,
      authority: 'server',
      recovery: checkpointStore.info(),
      handback: handbackPacket()
    };
  }

  function launcherState() {
    return {
      ok: true,
      schema: 'axm.game-runtime-launcher-state/v1',
      gameId: core.GAME_ID,
      controllerLinks: roster.filter(seat => seat.type === 'human').map(seat => ({
        seatId: seat.seatId,
        player: seat.id,
        localPath: '/controller.html?room=AXM1&player=' + encodeURIComponent(seat.id)
      })),
      partyScreenLinks: { all: GAME_PREFIX + '?room=AXM1&player=screen' },
      authority: { session: 'managed-server', objective: 'managed-server', score: 'managed-server', show: 'managed-server' },
      recovery: checkpointStore.info(),
      handback: handbackPacket(),
      inputSchema: core.INPUT_SCHEMA,
      localOnly: true
    };
  }

  function advance(now) {
    const started = Date.now();
    const dt = Math.max(0, Math.min(100, now - lastTickAt));
    lastTickAt = now;
    core.tickAi(state, now);
    core.step(state, dt, now);
    persist(false);
    tickSamples.push(Date.now() - started);
    if (tickSamples.length > 120) tickSamples.shift();
  }

  function startLoop() {
    if (timer || settings.manualTick === true) return;
    lastTickAt = clock();
    timer = setInterval(() => advance(clock()), 50);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stopLoop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') return sendJson(response, 200, { ok: true });
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = url.pathname;

      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, {
          ok: true,
          gameId: core.GAME_ID,
          status: 'PLAYABLE ALPHA V4 · HUMAN-STEWARDSHIP LOCAL GAME NIGHT',
          localOnly: true,
          stateAuthority: 'server',
          seats: Object.keys(state.players).length,
          phase: state.phase,
          showRound: state.show && state.show.roundNumber || 0,
          completedRounds: state.show && state.show.completedRounds || 0,
          recovery: checkpointStore.info(),
          handback: handbackPacket()
        });
      }
      if (request.method === 'GET' && pathname === '/api/launcher-state') return sendJson(response, 200, launcherState());
      if (request.method === 'GET' && pathname === '/api/state') return sendJson(response, 200, statePacket());
      if (request.method === 'GET' && pathname === '/api/observe') {
        const actorId = String(url.searchParams.get('player') || 'p1');
        const observation = core.observe(state, actorId);
        return observation ? sendJson(response, 200, { ok: true, observation, recovery: checkpointStore.info() }) : sendJson(response, 404, { ok: false, error: 'unknown player' });
      }
      if (request.method === 'GET' && pathname === '/api/telemetry') {
        const sorted = tickSamples.slice().sort((a, b) => a - b);
        return sendJson(response, 200, {
          ok: true,
          schema: 'axm.pulse-choir-telemetry/v1',
          workload: '20 Hz authoritative simulation with current roster',
          sampleCount: sorted.length,
          tickMs: {
            average: sorted.length ? tickSamples.reduce((sum, value) => sum + value, 0) / sorted.length : 0,
            p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
            budget: 4
          },
          warning: 'Short local samples do not prove device-wide performance or smooth frame pacing.'
        });
      }
      if (request.method === 'POST' && pathname === '/api/start') {
        const result = core.startRound(state, clock());
        if (result.ok) persist(true);
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/action') {
        const body = await readJson(request);
        const actorId = String(body.player || body.actorId || 'p1');
        const result = core.applyAction(state, actorId, body.action || {}, clock());
        if (result.ok) persist(true);
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/room-signal') {
        const body = await readJson(request);
        const actorId = String(body.player || body.actorId || '');
        const result = core.applyRoomSignal(state, actorId, body.choice, clock());
        if (result.ok && result.changed) persist(true);
        const status = result.ok ? 200
          : result.reason === 'unknown-player' ? 404
          : result.reason === 'room-signal-human-only' ? 403
          : result.reason === 'invalid-room-signal' ? 400
          : 409;
        return sendJson(response, status, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/reset') {
        state = core.resetRoundState(state, clock(), { advance: false });
        lastTickAt = clock();
        persist(true);
        return sendJson(response, 200, statePacket());
      }
      if (request.method === 'POST' && pathname === '/api/new-show') {
        checkpointStore.clear();
        state = core.createInitialState(roster, { seed: baseSeed, now: clock() });
        lastTickAt = clock();
        lastPersistedRevision = -1;
        suppressCheckpoint = false;
        handbackStatus = 'ready';
        handbackReceipt = null;
        persist(true);
        return sendJson(response, 200, statePacket());
      }
      if (request.method === 'POST' && pathname === '/api/finish-show') {
        if (!handbackConfig.available) return sendJson(response, 409, Object.assign(statePacket(), { ok: false, reason: 'managed-handback-unavailable' }));
        if (!['lobby', 'results'].includes(state.phase) || !(state.show && state.show.completedRounds > 0)) {
          return sendJson(response, 409, Object.assign(statePacket(), { ok: false, reason: 'no-completed-show' }));
        }
        if (handbackStatus === 'scheduled' || handbackStatus === 'sent') {
          return sendJson(response, 409, Object.assign(statePacket(), { ok: false, reason: 'handback-already-' + handbackStatus }));
        }
        const summary = hubHandback.summarize(state, env);
        handbackStatus = 'scheduled';
        handbackReceipt = null;
        suppressCheckpoint = true;
        checkpointStore.clear();
        sendJson(response, 200, { ok: true, summary, handback: handbackPacket() });
        const callbackTimer = setTimeout(() => {
          hubHandback.notify(handbackConfig, summary).then(receipt => {
            handbackReceipt = receipt;
            handbackStatus = receipt.ok ? 'sent' : 'failed';
            if (!receipt.ok) {
              suppressCheckpoint = false;
              persist(true);
            }
          });
        }, 80);
        if (typeof callbackTimer.unref === 'function') callbackTimer.unref();
        return;
      }
      if (pathname === '/') {
        response.writeHead(302, { location: GAME_PREFIX + '?room=AXM1&player=screen', 'cache-control': 'no-store' });
        return response.end();
      }
      const file = safeFile(pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return response.end('Pulse Choir route not found.');
      }
      response.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': /\.(?:html|js|css|json)$/i.test(file) ? 'no-store' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'none'; object-src 'none'"
      });
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
  });

  server.on('listening', () => {
    startLoop();
    persist(true);
  });
  server.on('close', () => {
    stopLoop();
    persist(true);
  });
  return {
    advance,
    checkpoint: persist,
    checkpointPath: checkpointStore.filePath,
    clock,
    getRecovery: () => checkpointStore.info(),
    getHandback: handbackPacket,
    getState: () => core.snapshot(state),
    launcherState,
    roster,
    server,
    startLoop,
    stopLoop
  };
}

if (require.main === module) {
  const runtime = createRuntime();
  runtime.server.listen(PORT, HOST, () => {
    console.log('Pulse Choir listening on http://' + HOST + ':' + PORT);
  });
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.once(signal, () => {
      runtime.checkpoint(true);
      runtime.server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1200).unref();
    });
  });
}

module.exports = { GAME_PREFIX, HOST, PORT, createRuntime, parseRoster, safeFile };
