#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const core = require('./game-core');
const { createWorldAdapter } = require('./world-adapter');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8801);
const GAME_PREFIX = '/games/011/';
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
  else if (relative === '/games/011') relative = '';
  else if (relative === '/controller.html') relative = 'controller.html';
  else return null;
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(__dirname, relative.replace(/^\/+/, ''));
  return candidate === __dirname || candidate.startsWith(__dirname + path.sep) ? candidate : null;
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = '';
    const limit = maxBytes || 64 * 1024;
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
    'access-control-allow-origin': '*'
  });
  response.end(JSON.stringify(value, null, 2));
}

function createRuntime(options) {
  const settings = options || {};
  const env = settings.env || process.env;
  const roster = settings.roster || parseRoster(env);
  const aiEnabled = settings.aiEnabled === true || String(env.BUDDYFARM_AI_ENABLED || '') === '1';
  const worldAdapter = settings.worldAdapter || createWorldAdapter(settings.worldOptions);
  let state = core.createInitialState(roster);
  worldAdapter.revealForActors(state);
  let aiTimer = null;

  function statePacket() {
    return {
      state: core.snapshot(state),
      world: core.WORLD,
      worldView: worldAdapter.viewForState(state)
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
      partyScreenLinks: { all: GAME_PREFIX },
      authority: { session: 'managed-server', world: 'managed-server-shared-farm' },
      optionalAiHelper: { enabled: aiEnabled, default: false },
      world: worldAdapter.receiptSummary()
    };
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
          status: 'LARGE BLANK WORLD / WORKING TEST',
          localOnly: true,
          seats: Object.keys(state.actors).length,
          world: { width: 12288, height: 8192, chunks: 96, substrate: 'fully-transparent' }
        });
      }
      if (request.method === 'GET' && pathname === '/api/launcher-state') return sendJson(response, 200, launcherState());
      if (request.method === 'GET' && pathname === '/api/state') {
        return sendJson(response, 200, Object.assign({ ok: true }, statePacket()));
      }
      if (request.method === 'GET' && pathname === '/api/world-receipt') return sendJson(response, 200, { ok: true, world: worldAdapter.receiptSummary() });
      if (request.method === 'GET' && pathname === '/api/observe') {
        const actorId = String(url.searchParams.get('player') || 'p1');
        if (!state.actors[actorId]) return sendJson(response, 404, { ok: false, error: 'unknown player' });
        return sendJson(response, 200, {
          ok: true,
          schema: 'axm.buddyfarm-seat-observation/v1',
          player: core.clone(state.actors[actorId]),
          sharedFarm: core.snapshot(state).farm,
          inventory: core.clone(state.inventory),
          day: state.day,
          message: state.message,
          legalActions: ['move:up', 'move:down', 'move:left', 'move:right', 'action:tap-context', 'action:hold-travel', 'work']
        });
      }
      if (request.method === 'GET' && pathname === '/api/export') {
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': 'attachment; filename="axm-buddyfarm-save.json"',
          'cache-control': 'no-store'
        });
        return response.end(JSON.stringify(core.snapshot(state), null, 2));
      }
      if (request.method === 'POST' && pathname === '/api/action') {
        const body = await readJson(request);
        const actorId = String(body.player || body.actorId || 'p1');
        if (!state.actors[actorId]) return sendJson(response, 404, { ok: false, error: 'unknown player' });
        const result = core.applyAction(state, actorId, body.action || {}, { worldAdapter });
        worldAdapter.revealForActors(state);
        return sendJson(response, result.ok ? 200 : 409, Object.assign({ ok: result.ok, result }, statePacket()));
      }
      if (request.method === 'POST' && pathname === '/api/reset') {
        state = core.createInitialState(roster);
        worldAdapter.revealForActors(state);
        return sendJson(response, 200, Object.assign({ ok: true }, statePacket()));
      }
      if (pathname === '/') {
        response.writeHead(302, { location: GAME_PREFIX, 'cache-control': 'no-store' });
        return response.end();
      }
      const file = safeFile(pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return response.end('BuddyFarm route not found.');
      }
      response.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': /\.(?:html|js|css|json)$/i.test(file) ? 'no-store' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff'
      });
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
  });

  function startAi() {
    if (!aiEnabled || aiTimer || !roster.some(seat => seat.type === 'ai')) return;
    aiTimer = setInterval(() => {
      roster.filter(seat => seat.type === 'ai').forEach(seat => core.helperStep(state, seat.id, { worldAdapter }));
      worldAdapter.revealForActors(state);
    }, 700);
    if (typeof aiTimer.unref === 'function') aiTimer.unref();
  }

  function stopAi() {
    if (aiTimer) clearInterval(aiTimer);
    aiTimer = null;
  }

  server.on('listening', startAi);
  server.on('close', stopAi);
  return { server, getState: () => core.snapshot(state), launcherState, roster, aiEnabled, startAi, stopAi, worldAdapter };
}

if (require.main === module) {
  const runtime = createRuntime();
  runtime.server.listen(PORT, HOST, () => {
    console.log('AXM BuddyFarm listening on http://' + HOST + ':' + PORT);
  });
}

module.exports = { GAME_PREFIX, HOST, PORT, createRuntime, parseRoster, safeFile };
