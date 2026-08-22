#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const core = require('./game-core');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8803);
const GAME_PREFIX = '/games/013/';
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
  let relative;
  try { relative = decodeURIComponent(String(urlPath || '/').split('?')[0]); }
  catch (_) { return null; }
  if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else if (relative === '/games/013') relative = '';
  else if (['/app.js', '/styles.css', '/game-core.js', '/index.html'].includes(relative)) relative = relative.slice(1);
  else if (relative === '/') relative = '';
  else return null;
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(__dirname, relative.replace(/^\/+/, ''));
  return candidate === __dirname || candidate.startsWith(__dirname + path.sep) ? candidate : null;
}

function transportError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const limit = maxBytes || 24 * 1024;
    let bytes = 0;
    let settled = false;
    request.on('data', chunk => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > limit) {
        settled = true;
        chunks.length = 0;
        request.resume();
        reject(transportError(413, 'request-body-too-large', 'request body too large'));
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      const body = Buffer.concat(chunks).toString('utf8');
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (_) { reject(transportError(400, 'invalid-json', 'invalid JSON')); }
    });
    request.on('error', error => {
      if (settled) return;
      settled = true;
      reject(transportError(400, 'request-stream-error', error.message || 'request stream failed'));
    });
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'cross-origin-resource-policy': 'same-origin',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(value));
}

function createRuntime(options) {
  const settings = options || {};
  const env = settings.env || process.env;
  const clock = typeof settings.clock === 'function' ? settings.clock : () => Date.now();
  const roster = core.normalizeRoster(settings.roster || parseRoster(env));
  const adapterBindings = roster.filter(seat => seat.type === 'adapter').map(seat => ({
    seatId: seat.seatId,
    actorId: seat.id,
    adapterId: seat.adapterId || 'connected-ai',
    token: 'seat-' + crypto.randomBytes(18).toString('hex'),
    protocol: 'axm-semantic-input-v1',
    inputEndpoint: '/api/input',
    observationEndpoint: '/api/adapter-observation',
    controllerProfile: 'axm-universal-xbox-brawl-v0.2.1'
  }));
  const seed = Number(env.TOONFALL_SEED || 13013);
  let state = core.createInitialState(roster, { seed, now: clock() });
  let timer = null;
  let lastTickAt = clock();
  const tickSamples = [];

  function statePacket() {
    return {
      ok: true,
      state: core.snapshot(state),
      story: core.STORY,
      config: core.CONFIG,
      authority: 'managed-local-server'
    };
  }

  function launcherState() {
    return {
      ok: true,
      schema: 'axm.game-runtime-launcher-state/v1',
      gameId: core.GAME_ID,
      playablePath: GAME_PREFIX + '?room=AXM1&player=p1',
      controllerLinks: [],
      partyScreenLinks: { all: GAME_PREFIX + '?room=AXM1&player=screen' },
      team: { humanSeats: state.truth.humanSeats, connectedAiSeats: state.truth.connectedAiSeats, inGameAiSeats: state.truth.inGameAiSeats, partnerMode: state.truth.partnerMode, splitScreen: false },
      adapterBindings: adapterBindings.map(binding => Object.assign({}, binding)),
      authority: { session: 'managed-server', world: 'managed-server', combat: 'managed-server', score: 'managed-server' },
      inputSchema: core.INPUT_SCHEMA,
      localOnly: true
    };
  }

  function boundAdapter(request, url, body) {
    const seatId = String((body && (body.seatId || body.seat_id)) || url.searchParams.get('seat') || '');
    const token = String((body && body.token) || request.headers['x-axm-seat-token'] || '').replace(/^Bearer\s+/i, '');
    return adapterBindings.find(binding => binding.seatId === seatId && binding.token === token) || null;
  }

  function advance(now) {
    const started = Date.now();
    const dt = Math.max(0, Math.min(100, now - lastTickAt));
    lastTickAt = now;
    core.step(state, dt, now);
    tickSamples.push(Date.now() - started);
    if (tickSamples.length > 240) tickSamples.shift();
    return state;
  }

  function startLoop() {
    if (timer || settings.manualTick === true) return;
    lastTickAt = clock();
    timer = setInterval(() => advance(clock()), core.CONFIG.tickMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stopLoop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') return sendJson(response, 405, { ok: false, code: 'cross-origin-disabled', error: 'cross-origin requests are not supported' });
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = url.pathname;

      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, {
          ok: true,
          gameId: core.GAME_ID,
          status: 'PLAYABLE BETA',
          localOnly: true,
          stateAuthority: 'managed-local-server',
          humanSeats: state.truth.humanSeats,
          connectedAiSeats: state.truth.connectedAiSeats,
          inGameAiSeats: state.truth.inGameAiSeats,
          partnerMode: state.truth.partnerMode,
          splitScreen: false,
          phase: state.phase,
          wave: state.wave
        });
      }
      if (request.method === 'GET' && pathname === '/api/launcher-state') return sendJson(response, 200, launcherState());
      if (request.method === 'GET' && pathname === '/api/state') return sendJson(response, 200, statePacket());
      if (request.method === 'GET' && pathname === '/api/observe') return sendJson(response, 200, { ok: true, observation: core.observe(state) });
      if (request.method === 'GET' && pathname === '/api/adapter-observation') {
        const binding = boundAdapter(request, url, null);
        if (!binding) return sendJson(response, 403, { ok: false, code: 'invalid-adapter-binding', error: 'invalid connected-AI seat binding' });
        const observation = core.observe(state);
        observation.seatId = binding.seatId;
        observation.actorId = binding.actorId;
        observation.controls = { protocol: binding.protocol, inputEndpoint: binding.inputEndpoint, nextSequenceMinimum: state.lastInputSeqByActor[binding.actorId] + 1, intents: ['move', 'aim', 'fire', 'dash', 'heartburst'] };
        return sendJson(response, 200, { ok: true, observation });
      }
      if (request.method === 'GET' && pathname === '/api/telemetry') {
        const sorted = tickSamples.slice().sort((a, b) => a - b);
        return sendJson(response, 200, {
          ok: true,
          schema: 'axm.toonfall-telemetry/v1',
          workload: '20 Hz authoritative Bloomvale simulation with one human and one AI companion',
          sampleCount: sorted.length,
          actors: 2,
          enemies: state.enemies.length,
          projectiles: state.projectiles.length,
          tickMs: {
            average: sorted.length ? tickSamples.reduce((sum, value) => sum + value, 0) / sorted.length : 0,
            p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
            budget: core.CONFIG.tickMs
          },
          limitation: 'Short local samples do not prove smooth frame pacing on other devices.'
        });
      }
      if (request.method === 'POST' && pathname === '/api/action') {
        const body = await readJson(request);
        const result = core.applyAction(state, String(body.player || body.actorId || 'p1'), body.action || {}, clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), { actionResult: result }));
      }
      if (request.method === 'POST' && pathname === '/api/input') {
        const body = await readJson(request);
        const binding = boundAdapter(request, url, body);
        if (!binding) return sendJson(response, 403, { ok: false, code: 'invalid-adapter-binding', error: 'invalid connected-AI seat binding' });
        const semantic = body.input && typeof body.input === 'object' ? body.input : {};
        const result = core.applyAction(state, binding.actorId, {
          type: 'input', seq: Number(body.seq), moveX: semantic.moveX, moveY: semantic.moveY,
          aimX: semantic.aimX, aimY: semantic.aimY,
          firing: !!(semantic.firing || semantic.fire || semantic.attack),
          dash: !!semantic.dash, pulse: !!(semantic.pulse || semantic.heartburst)
        }, clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign({ ok: result.ok, actionResult: result }, result.ok ? {} : { code: result.reason }));
      }
      if (request.method === 'POST' && pathname === '/api/reset') {
        state = core.createInitialState(roster, { seed, now: clock() });
        lastTickAt = clock();
        return sendJson(response, 200, statePacket());
      }
      if (pathname === '/') {
        response.writeHead(302, { location: GAME_PREFIX + '?room=AXM1&player=p1', 'cache-control': 'no-store' });
        return response.end();
      }
      const file = safeFile(pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return response.end('Bloomvale route not found.');
      }
      response.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': /\.(?:html|js|css|json)$/i.test(file) ? 'no-store' : 'public, max-age=3600',
        'cross-origin-resource-policy': 'same-origin',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'none'; object-src 'none'; frame-ancestors 'self'"
      });
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      const status = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 500;
      sendJson(response, status, { ok: false, code: error.code || 'internal-error', error: error.message });
    }
  });

  server.on('listening', startLoop);
  server.on('close', stopLoop);
  return {
    advance,
    clock,
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
  runtime.server.listen(PORT, HOST, () => console.log('Bloomvale: Gatewatch listening on http://' + HOST + ':' + PORT));
}

module.exports = { GAME_PREFIX, HOST, PORT, createRuntime, parseRoster, safeFile };
