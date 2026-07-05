#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_TICK_RATE,
  DEFAULT_FPS,
  createEngineState,
  assignSeat,
  readySeat,
  startSession,
  queueInput,
  engineTick,
  endSession
} = require('./game-engine/engine-core');

const ROOT = __dirname;
const HOST = process.env.AXM_GAME_HUB_HOST || '0.0.0.0';
const PORT = Number(process.env.AXM_GAME_HUB_PORT || 8788);
const LIBRARY_DIR = path.join(ROOT, 'game-library');

const state = createEngineState();
let loop = null;

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(obj, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', d => { buf += d; if (buf.length > 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); }
      catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function listGames() {
  if (!fs.existsSync(LIBRARY_DIR)) return [];
  const games = [];
  for (const item of fs.readdirSync(LIBRARY_DIR)) {
    const gameDir = path.join(LIBRARY_DIR, item);
    if (!fs.statSync(gameDir).isDirectory()) continue;
    const manifestPath = path.join(gameDir, 'game.manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      games.push(Object.assign({ manifest_path: path.relative(ROOT, manifestPath) }, manifest));
    } catch (e) {
      games.push({ game_id: item, status: 'manifest-error', error: e.message });
    }
  }
  return games;
}

function findGame(gameId) {
  const games = listGames();
  return games.find(game => game.game_id === gameId) || null;
}

function startLoop() {
  stopLoop();
  const ms = Math.round(1000 / DEFAULT_TICK_RATE);
  loop = setInterval(() => {
    engineTick(state, null);
  }, ms);
}

function stopLoop() {
  if (loop) clearInterval(loop);
  loop = null;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, {
        ok: true,
        name: 'AXM Game Hub',
        status: state.status,
        default_tick_rate: DEFAULT_TICK_RATE,
        default_fps: DEFAULT_FPS,
        max_seats: state.lobby.max_seats,
        default_visible_seats: state.lobby.default_visible_seats
      });
    }

    if (req.method === 'GET' && req.url === '/state') return send(res, 200, { ok: true, state });
    if (req.method === 'GET' && req.url === '/seats') return send(res, 200, { ok: true, seats: state.lobby.seats });
    if (req.method === 'GET' && req.url === '/games') return send(res, 200, { ok: true, games: listGames() });

    if (req.method === 'POST' && req.url === '/seat/assign') {
      const p = await readBody(req);
      return send(res, 200, { ok: true, seat: assignSeat(state, p.seat_id, p.patch || {}) });
    }

    if (req.method === 'POST' && req.url === '/seat/ready') {
      const p = await readBody(req);
      return send(res, 200, { ok: true, seat: readySeat(state, p.seat_id, !!p.ready) });
    }

    if (req.method === 'POST' && req.url === '/game/start') {
      const p = await readBody(req);
      const game = findGame(p.game_id) || p.game_manifest;
      if (!game) return send(res, 404, { ok: false, error: 'game not found' });
      const session = startSession(state, game);
      startLoop();
      return send(res, 200, { ok: true, session, tick_rate: DEFAULT_TICK_RATE, fps: DEFAULT_FPS });
    }

    if (req.method === 'POST' && req.url === '/input') {
      const p = await readBody(req);
      return send(res, 200, { ok: true, result: queueInput(state, p) });
    }

    if (req.method === 'POST' && req.url === '/game/end') {
      const p = await readBody(req);
      stopLoop();
      return send(res, 200, { ok: true, result: endSession(state, p.summary || {}) });
    }

    send(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    send(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log('AXM Game Hub v0.1');
  console.log(`Listening: http://${HOST}:${PORT}`);
  console.log(`Engine default: ${DEFAULT_TICK_RATE} TPS / ${DEFAULT_FPS} FPS`);
  console.log('Health: /health');
});
