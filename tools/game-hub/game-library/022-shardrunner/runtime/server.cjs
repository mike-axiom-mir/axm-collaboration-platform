#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const Core = require('./shardrunner-core.cjs');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 8820);
const ROOT = __dirname;
const CLIENT_FILE = path.join(ROOT, 'index.html');
const TICK_MS = 1000 / 30;
const STREAM_MS = 45;
const BASE_SEED = Number(process.env.GAME_SEED || 0x6a09e667) >>> 0;
const DEFAULT_SETTINGS = {
  audio: true,
  reduced_motion: false,
  haptics_hint: false,
  camera_tilt_lock: false
};
const INPUT_CLEAR_MS = 340;
const MAX_RUN_HISTORY = 20;
const BUILD_VERSION = '0.2.0';

const sessions = new Map();
const streams = new Set();
let last = Date.now();

function toBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
}

function sessionKey(room, player) {
  return room + '|' + player;
}

function emptyInput() {
  return {
    moveX: 0,
    moveZ: 0,
    jump: false,
    pause: false,
    restart: false,
    _prevRestart: false,
    owner: 'system',
    source: 'system'
  };
}

function createDefaults() {
  return {
    room: null,
    player: null,
    attempts: 0,
    bestScore: 0,
    lastRun: null,
    runHistory: [],
    settings: { ...DEFAULT_SETTINGS },
    inputClearUntil: 0,
    game: null,
    inputs: Object.create(null)
  };
}

function getSession(room, player) {
  const key = sessionKey(room, player);
  if (!sessions.has(key)) {
    const session = createDefaults();
    session.room = room;
    session.player = player;
    session.inputs[player] = emptyInput();
    sessions.set(key, session);
  }
  return sessions.get(key);
}

function getSessionInput(session) {
  if (!session.inputs[session.player]) {
    session.inputs[session.player] = emptyInput();
  }
  return session.inputs[session.player];
}

function getGameForSession(session) {
  if (!session.game) {
    session.game = createRun(session);
  }
  return session.game;
}

function applyStateSettings(state, session) {
  const cloneState = Core.publicState(state);
  cloneState.bestScore = session.bestScore;
  cloneState.lastRun = session.lastRun || state.lastRun || null;
  cloneState.lastRunSummary = state.runSummary || null;
  cloneState.history = session.runHistory.slice();
  cloneState.buildVersion = state.buildVersion || state.runVersion || BUILD_VERSION;
  cloneState.runVersion = cloneState.buildVersion;
  cloneState.reason = state.reason || null;
  cloneState.seed = state.randomSeed || state.seed || 0;
  cloneState.attempt = state.attempt || 1;
  cloneState.runId = state.runId;
  cloneState.runStats = cloneState.runStats || {};
  cloneState.runStats.fallReason = cloneState.runStats.fallReason || cloneState.diedBy || null;
  cloneState.runSummary = {
    runId: state.runId,
    attempt: state.attempt || 1,
    distance: Math.round(state.progress || 0),
    shards: state.totalShards || 0,
    combo: state.bestCombo || state.combo || 0,
    bestCombo: state.bestCombo || state.combo || 0,
    stamina: Math.max(0, Math.round(state.stamina || 0)),
    seed: state.randomSeed || state.seed || 0,
    runVersion: cloneState.buildVersion,
    bestScore: session.bestScore || 0
  };
  return cloneState;
}

function sanitizeSettings(raw) {
  const next = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return next;
  if (Object.prototype.hasOwnProperty.call(raw, 'audio')) next.audio = toBool(raw.audio, next.audio);
  if (Object.prototype.hasOwnProperty.call(raw, 'reduced_motion')) next.reduced_motion = toBool(raw.reduced_motion, next.reduced_motion);
  if (Object.prototype.hasOwnProperty.call(raw, 'haptics_hint')) next.haptics_hint = toBool(raw.haptics_hint, next.haptics_hint);
  if (Object.prototype.hasOwnProperty.call(raw, 'camera_tilt_lock')) next.camera_tilt_lock = toBool(raw.camera_tilt_lock, next.camera_tilt_lock);
  return next;
}

function normalizeSeed(raw) {
  const seed = Number(raw);
  if (!Number.isFinite(seed)) return null;
  return seed >>> 0;
}

function createRun(session, options) {
  const now = Date.now();
  const requestedSeed = normalizeSeed(options && options.seed);
  const seed = requestedSeed || (BASE_SEED + (session.attempts * 0x9e3779b9) + (now & 0xffff)) >>> 0;
  session.attempts += 1;
  return Core.create([], now, { seed, attempt: session.attempts });
}

function resetInputStateForRestart(session, options) {
  const inputState = getSessionInput(session);
  Object.assign(inputState, emptyInput(), {
    owner: 'system',
    source: 'system'
  });
  session.inputClearUntil = Date.now() + INPUT_CLEAR_MS;
  const game = createRun(session, options);
  game._inputClearUntil = session.inputClearUntil;
  session.game = game;
  return game;
}

function recordRun(session, state) {
  if (!state || !state.result || state._persisted) return;
  const entry = {
    runId: state.runId,
    attempt: state.attempt,
    won: !!state.result.won,
    score: state.result.score,
    shards: state.result.shards,
    combo: state.combo || state.bestCombo || 0,
    bestCombo: state.bestCombo || 0,
    dieReason: state.diedBy || null,
    distance: state.result.distance,
    diedBy: state.diedBy || null,
    buildVersion: state.buildVersion || state.runVersion || '0.2.0',
    runVersion: state.buildVersion || state.runVersion || BUILD_VERSION,
    durationMs: state.result.durationMs || 0,
    seed: state.randomSeed || 0,
    at: Date.now()
  };
  session.lastRun = entry;
  session.bestScore = Math.max(session.bestScore, entry.score);
  session.runHistory.push(entry);
  if (session.runHistory.length > MAX_RUN_HISTORY) {
    session.runHistory = session.runHistory.slice(-MAX_RUN_HISTORY);
  }
  state._persisted = true;
}

function parseRoomPlayer(url) {
  return {
    room: url.searchParams.get('room') || 'AXM1',
    player: url.searchParams.get('player') || 'p1'
  };
}

function parseInputJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 18000) req.destroy();
    });
    req.on('end', () => {
      if (!raw.length) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function sendBadRequest(res, message) {
  return sendJson(res, 400, { ok: false, error: message });
}

function sendJson(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  res.end(data);
}

function sendFile(file, res, type) {
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  fs.createReadStream(file).pipe(res);
}

function tick() {
  const now = Date.now();
  const dt = Math.min((now - last) / 1000, 0.08);
  last = now;
  for (const session of sessions.values()) {
    const game = getGameForSession(session);
    const input = getSessionInput(session);

    if (session.inputClearUntil && session.inputClearUntil < now) {
      session.inputClearUntil = 0;
      game._inputClearUntil = 0;
      input.owner = input.source = 'system';
    }

    const restartRequested = !!input.restart;
    const restartEdge = restartRequested && !input._prevRestart;
    input._prevRestart = restartRequested;

    if (restartEdge && !session.inputClearUntil) {
      session.game = resetInputStateForRestart(session);
      continue;
    }

    game._inputClearUntil = Math.max(0, session.inputClearUntil);
    Core.step(game, input, dt, now);

    recordRun(session, game);
  }
}

function stream() {
  for (const client of streams) {
    const session = getSession(client.room, client.player);
    const game = getGameForSession(session);
    try {
      client.res.write('data: ' + JSON.stringify(applyStateSettings(game, session)) + '\n\n');
    } catch (e) {
      streams.delete(client);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    });
    return res.end();
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return sendFile(CLIENT_FILE, res, 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    const { room, player } = parseRoomPlayer(url);
    const session = getSession(room, player);
    const game = getGameForSession(session);
    return sendJson(res, 200, {
      ok: true,
      phase: game.phase,
      seat: game.seat && game.seat.id,
      version: game.buildVersion,
      room,
      player
    });
  }

  if (req.method === 'GET' && url.pathname === '/state') {
    const { room, player } = parseRoomPlayer(url);
    const session = getSession(room, player);
    const game = getGameForSession(session);
    return sendJson(res, 200, applyStateSettings(game, session));
  }

  if (req.method === 'GET' && url.pathname === '/settings') {
    const { room, player } = parseRoomPlayer(url);
    const session = getSession(room, player);
    return sendJson(res, 200, { ok: true, settings: session.settings });
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    const { room, player } = parseRoomPlayer(url);
    const session = getSession(room, player);
    const game = getGameForSession(session);
    const entry = { room, player, res };
    streams.add(entry);
    req.on('close', () => streams.delete(entry));
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*'
    });
    res.write('retry: 700\n\n');
    res.write('data: ' + JSON.stringify(applyStateSettings(game, session)) + '\n\n');
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/vendor/')) {
    const file = path.resolve(ROOT, url.pathname.slice(1));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      return sendJson(res, 404, { ok: false });
    }
    const ext = path.extname(file).toLowerCase();
    const map = {
      '.js': 'application/javascript; charset=utf-8',
      '.wasm': 'application/octet-stream'
    };
    return sendFile(file, res, map[ext] || 'application/octet-stream');
  }

  if (req.method === 'POST' && url.pathname === '/input') {
    const raw = await parseInputJson(req);
    if (raw === null) return sendBadRequest(res, 'invalid-json');
    const { room, player } = parseRoomPlayer(url);
    if (player !== 'p1') return sendJson(res, 403, { ok: false, error: 'single-seat experiment' });
    const session = getSession(room, player);
    const now = Date.now();
    const sanitized = Core.sanitizeInput(raw, { clear: now < session.inputClearUntil });
    const owner = sanitized.owner || 'system';
    const target = getSessionInput(session);
    target.moveX = Number(sanitized.moveX) || 0;
    target.moveZ = Number(sanitized.moveZ) || 0;
    target.jump = !!sanitized.jump;
    target.pause = !!sanitized.pause;
    target.restart = !!sanitized.restart;
    target.owner = owner;
    target.source = sanitized.source || owner;
    if (session.inputClearUntil) {
      target.jump = false;
      target.pause = false;
      target.moveX = 0;
      target.moveZ = 0;
      target.restart = false;
    }
    return sendJson(res, 200, { ok: true, owner, source: target.source || owner });
  }

  if (req.method === 'POST' && url.pathname === '/restart') {
    const { room, player } = parseRoomPlayer(url);
    if (player !== 'p1') return sendJson(res, 403, { ok: false, error: 'single-seat experiment' });
    const session = getSession(room, player);
    const payload = await parseInputJson(req);
    if (payload === null) return sendBadRequest(res, 'invalid-json');
    const restartSeed = payload && payload.seed;
    if (session.inputClearUntil && session.inputClearUntil > Date.now()) {
      return sendJson(res, 429, {
        ok: false,
        error: 'restart-pending'
      });
    }
    const game = resetInputStateForRestart(session, { seed: restartSeed });
    return sendJson(res, 200, {
      ok: true,
      state: applyStateSettings(game, session)
    });
  }

  if (req.method === 'POST' && url.pathname === '/settings') {
    const { room, player } = parseRoomPlayer(url);
    const session = getSession(room, player);
    const raw = await parseInputJson(req);
    if (raw === null) return sendBadRequest(res, 'invalid-json');
    session.settings = sanitizeSettings(raw);
    return sendJson(res, 200, { ok: true, settings: session.settings });
  }

  return sendJson(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log('Shardrunner 022 listening on http://127.0.0.1:' + PORT + '/?room=AXM1&player=p1');
});

setInterval(tick, TICK_MS);
setInterval(stream, STREAM_MS);
