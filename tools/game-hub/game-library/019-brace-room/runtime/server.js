#!/usr/bin/env node
'use strict';

/**
 * Brace Room — static file + health server, a phone-input relay, and an
 * AI-native adapter seat interface (see docs/AI_NATIVE_SEAT_CONTRACT.md).
 *
 * The game's SIMULATION stays browser-local (see game-core.js, loaded
 * straight into the shared-screen page) — this server does not compute
 * hull integrity, faults, or waves itself. What it owns is two short-lived
 * relay buffers, both cleared on restart with no persistence:
 *
 *   1. Phone input relay (POST/GET /api/input) — a phone that joined
 *      through Game Hub's existing QR/lobby seam (lobby-controller.html,
 *      one level up) posts touch input here; the shared-screen tab polls
 *      it as an alternative to that seat's keyboard cluster.
 *   2. Adapter observation relay (POST /api/state, GET
 *      /api/adapter-observation) — the shared-screen tab pushes a
 *      snapshot of the live simulation here at ~8Hz; any external agent
 *      (an "adapter" seat — Codex, another Claude, a bot) can poll it to
 *      see the game and then drive a seat through the same /api/input
 *      endpoint the phone uses. This is what turns Brace Room from
 *      "watch a headless bot in a terminal" into "an AI can actually play
 *      the real running session."
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8819);
const GAME_ID = '019-brace-room';
const GAME_PREFIX = '/games/019/';
const INPUT_TTL_MS = 400; // a phone packet older than this is treated as "not sending" by app.js

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const RUNTIME_DIR = __dirname;
const VALID_PLAYERS = new Set(['p1', 'p2', 'p3', 'p4']);
const OBSERVATION_STALE_MS = 1000; // if the tab stops pushing (closed/crashed), say so honestly
const OBSERVATION_SCHEMA = 'axm.brace-room-observation/v1';

function safeFile(urlPath) {
  let relative = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (relative === '/' || relative === GAME_PREFIX) relative = 'index.html';
  else if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else relative = relative.replace(/^\/+/, '');

  if (!relative || relative.endsWith('/')) relative += 'index.html';

  const candidate = path.resolve(RUNTIME_DIR, relative);
  if (candidate !== RUNTIME_DIR && !candidate.startsWith(RUNTIME_DIR + path.sep)) return null;
  return candidate;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  response.end(JSON.stringify(value));
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = '';
    const limit = maxBytes || 8 * 1024;
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

function clampAxis(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function createServer() {
  const inputs = {}; // player id -> { moveX, moveY, action, actionEdge, updatedAt }
  let observation = null; // last snapshot pushed by the shared-screen tab
  let observationSequence = 0;
  let observationUpdatedAt = 0;

  const server = http.createServer(async (request, response) => {
    const urlPath = request.url || '/';
    const pathname = urlPath.split('?')[0];

    if (pathname === '/health') {
      sendJson(response, 200, { ok: true, status: 'ok', gameId: GAME_ID, stateAuthority: 'browser-local' });
      return;
    }

    if (pathname === '/api/input' && request.method === 'POST') {
      try {
        const body = await readJson(request);
        const player = String(body.player || '');
        if (!VALID_PLAYERS.has(player)) { sendJson(response, 400, { error: 'unknown player id' }); return; }
        inputs[player] = {
          moveX: clampAxis(body.moveX),
          moveY: clampAxis(body.moveY),
          action: Boolean(body.action),
          actionEdge: Boolean(body.actionEdge),
          updatedAt: Date.now()
        };
        sendJson(response, 200, { ok: true });
      } catch (err) {
        sendJson(response, 400, { error: err.message });
      }
      return;
    }

    if (pathname === '/api/input' && request.method === 'GET') {
      const now = Date.now();
      const fresh = {};
      for (const player of Object.keys(inputs)) {
        if (now - inputs[player].updatedAt <= INPUT_TTL_MS) fresh[player] = inputs[player];
      }
      sendJson(response, 200, { inputs: fresh, ttlMs: INPUT_TTL_MS });
      return;
    }

    // The shared-screen tab pushes here (~8Hz) so an adapter seat has
    // something to observe. Deliberately unauthenticated and unvalidated
    // beyond size/shape: Brace Room has no hidden information by design
    // (every player already sees everything on the shared screen), it's
    // bound to 127.0.0.1 by default, and there's no competitive stake to
    // protect an observation channel against. See
    // docs/AI_NATIVE_SEAT_CONTRACT.md for why this is a deliberately
    // simpler trust model than 003-robo-pong-cross's cross-seat-authority.
    if (pathname === '/api/state' && request.method === 'POST') {
      try {
        const body = await readJson(request, 64 * 1024);
        observation = body;
        observationSequence += 1;
        observationUpdatedAt = Date.now();
        sendJson(response, 200, { ok: true, sequence: observationSequence });
      } catch (err) {
        sendJson(response, 400, { error: err.message });
      }
      return;
    }

    if (pathname === '/api/adapter-observation' && request.method === 'GET') {
      const requestUrl = new URL(urlPath, `http://${request.headers.host || HOST}`);
      const seat = requestUrl.searchParams.get('seat');
      if (seat && !VALID_PLAYERS.has(seat)) {
        sendJson(response, 400, { error: 'unknown seat id' });
        return;
      }

      const now = Date.now();
      const isStale = !observation || now - observationUpdatedAt > OBSERVATION_STALE_MS;
      if (isStale) {
        sendJson(response, 200, {
          schema: OBSERVATION_SCHEMA,
          sessionActive: false,
          sequence: observationSequence,
          note: observation ? 'stale: the shared-screen tab stopped pushing state' : 'no session has started yet'
        });
        return;
      }

      const payload = Object.assign({ schema: OBSERVATION_SCHEMA, sessionActive: true, sequence: observationSequence }, observation);
      if (seat && payload.players) payload.seat = Object.assign({ id: seat }, payload.players[seat]);
      sendJson(response, 200, payload);
      return;
    }

    const filePath = safeFile(urlPath);
    if (!filePath) {
      sendJson(response, 404, { error: 'not found' });
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        sendJson(response, 404, { error: 'not found', path: urlPath });
        return;
      }
      const ext = path.extname(filePath);
      response.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      response.end(data);
    });
  });
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Brace Room server listening on http://${HOST}:${PORT}/`);
  });
}

module.exports = { createServer, GAME_ID, PORT, HOST };
