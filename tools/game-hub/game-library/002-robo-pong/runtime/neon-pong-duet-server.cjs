#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOST = process.env.AXM_ROBO_PONG_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8792);
const TEST_MODE = process.env.AXM_TEST_MODE === '1';
const HUB_MODE = String(process.env.AXM_GAME_PLAY_MODE || '').toLowerCase();
const PLAY_MODE = HUB_MODE.includes('versus') ? 'versus' : 'story-coop';
const CLIENT_FILE = path.join(__dirname, 'neon-pong-duet-client.html');
const LOCAL_ASSETS = path.join(__dirname, 'assets');
const WORKSHOP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const AETHERGLASS_V7_ROOT = path.join(WORKSHOP_ROOT, 'AXM_AETHERGLASS_VISUAL_ENGINE_v7_1_0', 'src');
const AETHERGLASS_SHARED_ROOT = path.join(WORKSHOP_ROOT, 'shared', 'aetherglass', 'src');
const AETHERGLASS_ROOT = fs.existsSync(AETHERGLASS_V7_ROOT) ? AETHERGLASS_V7_ROOT : AETHERGLASS_SHARED_ROOT;

const W = 1200;
const H = 800;
const TICK_MS = 1000 / 60;
const BALL_R = 16;
const PADDLE_H = 24;
const PADDLE_SPEED = 720;
const DUEL_PADDLE_W = 178;
const COOP_PADDLE_W = 158;
const WARDEN_W = 270;
const WIN_SCORE = 7;
const SPECIAL_COOLDOWN = 7600;

const ARENAS = [
  { id: 'cathedral-cross', label: 'Cathedral Cross', chapter: 'CHAPTER 01', objective: 'SEAL THE BREACH', target: 12, core: 5, background: 'cathedral-cross-plate.png', accent: '#69dc9a' },
  { id: 'shattered-line', label: 'Shattered Line', chapter: 'CHAPTER 02', objective: 'THE SHATTERED LINE', target: 16, core: 5, background: 'shattered-line-plate.png', accent: '#46d7e7' },
  { id: 'relay-protocol', label: 'Relay Protocol', chapter: 'CHAPTER 03', objective: 'LIGHT THE RELAY', target: 21, core: 4, background: 'relay-protocol-plate.png', accent: '#f0bd63' }
];

const SPECIALS = {
  shield: { label: 'MEGA SHIELD', color: '#ff3dd8' },
  warp: { label: 'PADDLE WARP', color: '#f0bd63' },
  slow: { label: 'SLOW FIELD', color: '#76a9ff' },
  jammer: { label: 'SIGNAL JAM', color: '#69dc9a' }
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function cleanName(value, fallback) {
  const text = String(value || '').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 20);
  return text || fallback;
}
function loadSeats() {
  let raw = [];
  try { raw = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]'); } catch (error) {}
  const fallbackMode = process.env.AXM_GAME_MODE || 'human-vs-ai';
  return Array.from({ length: 2 }, (_, index) => {
    const seat = raw[index] || {};
    const fallbackHuman = index === 0 ? fallbackMode !== 'ai-vs-ai' && fallbackMode !== 'ai-vs-human' : fallbackMode === 'human-vs-human' || fallbackMode === 'ai-vs-human';
    return {
      name: cleanName(seat.display_name || process.env['AXM_P' + (index + 1) + '_NAME'], index === 0 ? 'MIKE' : 'NOVA'),
      human: raw.length ? seat.type === 'human' : fallbackHuman,
      seatId: seat.seat_id || null
    };
  });
}
const seats = loadSeats();

function randomSpecial(previous) {
  const choices = Object.keys(SPECIALS).filter(key => key !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}
function makeSpecial() { return { kind: randomSpecial(), readyAt: 0, activeUntil: 0, activeLabel: '' }; }
function makePaddle(id, name, y, width) {
  return { id, name, x: W / 2, y, width, height: PADDLE_H, shieldUntil: 0, jammedUntil: 0 };
}
function arenaById(id) { return ARENAS.find(arena => arena.id === id) || ARENAS[1]; }

function newRoom() {
  const arena = arenaById(process.env.AXM_PONG_ARENA);
  return {
    room: 'AXM1',
    version: '2.0.0-neon-duet',
    phase: 'ready',
    playMode: PLAY_MODE,
    arenaId: arena.id,
    width: W,
    height: H,
    tick: 0,
    players: {
      p1: { id: 'p1', name: seats[0].name, kind: seats[0].human ? 'human' : 'adapter', color: '#46d7e7', team: PLAY_MODE === 'versus' ? 'cyan' : 'duet' },
      p2: { id: 'p2', name: seats[1].name, kind: seats[1].human ? 'human' : 'adapter', color: '#ff3dd8', team: PLAY_MODE === 'versus' ? 'magenta' : 'duet' }
    },
    paddles: {
      p1: makePaddle('p1', seats[0].name, H - 70, PLAY_MODE === 'versus' ? DUEL_PADDLE_W : COOP_PADDLE_W),
      p2: makePaddle('p2', seats[1].name, PLAY_MODE === 'versus' ? 70 : H - 70, PLAY_MODE === 'versus' ? DUEL_PADDLE_W : COOP_PADDLE_W),
      warden: makePaddle('warden', 'WARDEN', 70, WARDEN_W)
    },
    inputs: { p1: { left: false, right: false }, p2: { left: false, right: false } },
    scores: { p1: 0, p2: 0 },
    mission: { core: arena.core, coreMax: arena.core, charge: 0, target: arena.target, wave: 1, relay: 0, status: 'READY' },
    specials: { p1: makeSpecial(), p2: makeSpecial() },
    slowFieldUntil: 0,
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, radius: BALL_R, lastTouch: null },
    serveAt: 0,
    serveDirection: 1,
    winner: null,
    outcome: null,
    event: PLAY_MODE === 'versus' ? 'DUEL READY' : arena.objective,
    eventAt: Date.now()
  };
}

const room = newRoom();
const streams = new Set();
let lastTick = Date.now();

function announce(text) { room.event = text; room.eventAt = Date.now(); }
function configurePaddles() {
  const coop = room.playMode === 'story-coop';
  const p1 = room.paddles.p1;
  const p2 = room.paddles.p2;
  p1.y = H - 70;
  p1.width = coop ? COOP_PADDLE_W : DUEL_PADDLE_W;
  p1.x = coop ? W * 0.29 : W / 2;
  p2.y = coop ? H - 70 : 70;
  p2.width = coop ? COOP_PADDLE_W : DUEL_PADDLE_W;
  p2.x = coop ? W * 0.71 : W / 2;
  room.paddles.warden.x = W / 2;
  room.paddles.warden.y = 70;
}
function resetBall(direction, delay) {
  room.ball.x = W / 2;
  room.ball.y = H / 2;
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.ball.lastTouch = null;
  room.serveDirection = direction || (Math.random() > 0.5 ? 1 : -1);
  room.serveAt = Date.now() + (delay == null ? 850 : delay);
}
function resetMission() {
  const arena = arenaById(room.arenaId);
  room.mission = { core: arena.core, coreMax: arena.core, charge: 0, target: arena.target, wave: 1, relay: 0, status: 'ACTIVE' };
}
function startMatch() {
  room.phase = 'running';
  room.winner = null;
  room.outcome = null;
  room.scores.p1 = 0;
  room.scores.p2 = 0;
  room.specials.p1 = makeSpecial();
  room.specials.p2 = makeSpecial();
  room.slowFieldUntil = 0;
  configurePaddles();
  resetMission();
  resetBall(room.playMode === 'story-coop' ? 1 : (Math.random() > 0.5 ? 1 : -1), 950);
  const arena = arenaById(room.arenaId);
  announce(room.playMode === 'story-coop' ? arena.objective : room.players.p1.name + ' VS ' + room.players.p2.name);
}
function setArena(id) {
  const arena = arenaById(id);
  room.arenaId = arena.id;
  room.phase = 'ready';
  room.winner = null;
  room.outcome = null;
  configurePaddles();
  resetMission();
  resetBall(1, 0);
  room.serveAt = 0;
  announce(arena.objective);
  return arena;
}
function nextArena() {
  const index = ARENAS.findIndex(arena => arena.id === room.arenaId);
  return setArena(ARENAS[(index + 1) % ARENAS.length].id);
}
function serveIfReady(now) {
  if (!room.serveAt || now < room.serveAt || room.phase !== 'running') return;
  const speed = room.playMode === 'story-coop' ? 525 : 565;
  const angle = Math.random() * 0.72 - 0.36;
  room.ball.vx = Math.sin(angle) * speed;
  room.ball.vy = Math.cos(angle) * speed * room.serveDirection;
  room.serveAt = 0;
  announce('LIGHT LIVE');
}
function usePower(player, now) {
  if (room.phase !== 'running') return false;
  const slot = room.specials[player];
  const paddle = room.paddles[player];
  if (now < slot.readyAt) return false;
  const used = slot.kind;
  const rival = player === 'p1' ? 'p2' : 'p1';
  if (used === 'shield') { paddle.shieldUntil = now + 2800; slot.activeUntil = paddle.shieldUntil; }
  else if (used === 'warp') { paddle.x = room.ball.x; slot.activeUntil = now + 600; }
  else if (used === 'slow') { room.slowFieldUntil = now + 2500; slot.activeUntil = room.slowFieldUntil; }
  else if (used === 'jammer') {
    const target = room.playMode === 'versus' ? rival : 'warden';
    room.paddles[target].jammedUntil = now + 2200;
    slot.activeUntil = room.paddles[target].jammedUntil;
  }
  slot.activeLabel = SPECIALS[used].label;
  slot.kind = randomSpecial(used);
  slot.readyAt = now + SPECIAL_COOLDOWN;
  announce(room.players[player].name + ' · ' + SPECIALS[used].label);
  return true;
}
function paddleLimits(player, paddle) {
  if (room.playMode === 'versus') return [paddle.width / 2 + 34, W - paddle.width / 2 - 34];
  if (player === 'p1') return [paddle.width / 2 + 34, W / 2 - paddle.width / 2 - 12];
  return [W / 2 + paddle.width / 2 + 12, W - paddle.width / 2 - 34];
}
function controlPaddle(player, dt, now) {
  const paddle = room.paddles[player];
  const input = room.inputs[player];
  const base = room.playMode === 'versus' ? DUEL_PADDLE_W : COOP_PADDLE_W;
  paddle.width = now < paddle.shieldUntil ? base * 1.55 : base;
  const limits = paddleLimits(player, paddle);
  const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const factor = now < paddle.jammedUntil ? 0.32 : 1;
  paddle.x = clamp(paddle.x + axis * PADDLE_SPEED * factor * dt, limits[0], limits[1]);
}
function aiPaddle(player, dt, now) {
  const paddle = room.paddles[player];
  const base = room.playMode === 'versus' ? DUEL_PADDLE_W : COOP_PADDLE_W;
  paddle.width = now < paddle.shieldUntil ? base * 1.55 : base;
  const limits = paddleLimits(player, paddle);
  const target = room.ball.x + room.ball.vx * 0.09;
  const factor = now < paddle.jammedUntil ? 0.32 : 1;
  const step = 520 * factor * dt;
  paddle.x = clamp(paddle.x + clamp(target - paddle.x, -step, step), limits[0], limits[1]);
}
function wardenPaddle(dt, now) {
  if (room.playMode !== 'story-coop') return;
  const paddle = room.paddles.warden;
  const factor = now < paddle.jammedUntil ? 0.28 : 1;
  const step = (420 + room.mission.wave * 22) * factor * dt;
  paddle.x = clamp(paddle.x + clamp(room.ball.x + room.ball.vx * 0.1 - paddle.x, -step, step), paddle.width / 2 + 34, W - paddle.width / 2 - 34);
}
function bounceHorizontal(paddle, direction, owner) {
  const relative = clamp((room.ball.x - paddle.x) / (paddle.width / 2), -1, 1);
  const speed = Math.min(940, Math.hypot(room.ball.vx, room.ball.vy) + 18);
  room.ball.vx = relative * speed * 0.78;
  room.ball.vy = direction * Math.sqrt(Math.max(140000, speed * speed - room.ball.vx * room.ball.vx));
  room.ball.y = paddle.y + direction * (PADDLE_H / 2 + BALL_R + 1);
  room.ball.lastTouch = owner;
  if (room.playMode === 'story-coop' && owner !== 'warden') {
    room.mission.relay += 1;
    room.mission.charge += 1;
    room.mission.wave = 1 + Math.floor(room.mission.charge / 7);
    announce(room.players[owner].name + ' · RELAY ' + room.mission.charge + '/' + room.mission.target);
    if (room.mission.charge >= room.mission.target) finishCoop(true);
  } else announce(owner === 'warden' ? 'WARDEN RETURN' : room.players[owner].name + ' RETURN');
}
function finishCoop(success) {
  room.phase = 'gameover';
  room.outcome = success ? 'victory' : 'defeat';
  room.winner = success ? 'team' : 'warden';
  room.mission.status = success ? 'SEALED' : 'CORE LOST';
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.serveAt = 0;
  announce(success ? 'BREACH SEALED' : 'CORE LOST');
}
function score(player) {
  room.scores[player] += 1;
  announce(room.players[player].name + ' +1');
  if (room.scores[player] >= WIN_SCORE) {
    room.phase = 'gameover';
    room.winner = player;
    room.outcome = 'victory';
    room.ball.vx = 0;
    room.ball.vy = 0;
    room.serveAt = 0;
    announce(room.players[player].name + ' WINS');
    return;
  }
  resetBall(player === 'p1' ? -1 : 1);
}
function missCore() {
  room.mission.core -= 1;
  room.mission.relay = 0;
  if (room.mission.core <= 0) { room.mission.core = 0; finishCoop(false); return; }
  announce('CORE HIT · ' + room.mission.core + ' REMAIN');
  resetBall(1, 800);
}
function updateBall(dt, now) {
  serveIfReady(now);
  const ball = room.ball;
  if (!ball.vx && !ball.vy) return;
  const previousY = ball.y;
  const factor = now < room.slowFieldUntil ? 0.56 : 1;
  ball.x += ball.vx * dt * factor;
  ball.y += ball.vy * dt * factor;
  if (ball.x - BALL_R < 24) { ball.x = 24 + BALL_R; ball.vx = Math.abs(ball.vx); }
  else if (ball.x + BALL_R > W - 24) { ball.x = W - 24 - BALL_R; ball.vx = -Math.abs(ball.vx); }

  const p1 = room.paddles.p1;
  const p2 = room.paddles.p2;
  if (room.playMode === 'versus') {
    if (ball.vy > 0 && previousY + BALL_R <= p1.y - PADDLE_H / 2 && ball.y + BALL_R >= p1.y - PADDLE_H / 2 && Math.abs(ball.x - p1.x) <= p1.width / 2 + BALL_R) bounceHorizontal(p1, -1, 'p1');
    else if (ball.vy < 0 && previousY - BALL_R >= p2.y + PADDLE_H / 2 && ball.y - BALL_R <= p2.y + PADDLE_H / 2 && Math.abs(ball.x - p2.x) <= p2.width / 2 + BALL_R) bounceHorizontal(p2, 1, 'p2');
    if (ball.y < -BALL_R * 2) score('p1');
    else if (ball.y > H + BALL_R * 2) score('p2');
    return;
  }

  const warden = room.paddles.warden;
  if (ball.vy < 0 && previousY - BALL_R >= warden.y + PADDLE_H / 2 && ball.y - BALL_R <= warden.y + PADDLE_H / 2 && Math.abs(ball.x - warden.x) <= warden.width / 2 + BALL_R) bounceHorizontal(warden, 1, 'warden');
  else if (ball.vy > 0 && previousY + BALL_R <= p1.y - PADDLE_H / 2 && ball.y + BALL_R >= p1.y - PADDLE_H / 2) {
    if (Math.abs(ball.x - p1.x) <= p1.width / 2 + BALL_R) bounceHorizontal(p1, -1, 'p1');
    else if (Math.abs(ball.x - p2.x) <= p2.width / 2 + BALL_R) bounceHorizontal(p2, -1, 'p2');
  }
  if (ball.y < -BALL_R * 2) {
    room.mission.charge = Math.min(room.mission.target, room.mission.charge + 2);
    announce('WARDEN BREACHED · +2');
    if (room.mission.charge >= room.mission.target) finishCoop(true); else resetBall(1, 650);
  } else if (ball.y > H + BALL_R * 2) missCore();
}
function tick() {
  const now = Date.now();
  const dt = Math.min(0.04, Math.max(0.001, (now - lastTick) / 1000));
  lastTick = now;
  room.tick += 1;
  if (room.phase !== 'paused') {
    if (room.players.p1.kind === 'human') controlPaddle('p1', dt, now); else aiPaddle('p1', dt, now);
    if (room.players.p2.kind === 'human') controlPaddle('p2', dt, now); else aiPaddle('p2', dt, now);
    wardenPaddle(dt, now);
  }
  if (room.phase === 'running') updateBall(dt, now);
}
function publicPower(player, now) {
  const slot = room.specials[player];
  const info = SPECIALS[slot.kind];
  return { kind: slot.kind, label: info.label, color: info.color, active: now < slot.activeUntil, activeLabel: now < slot.activeUntil ? slot.activeLabel : '', readyIn: Math.max(0, slot.readyAt - now) };
}
function publicState() {
  const now = Date.now();
  return {
    room: room.room, version: room.version, phase: room.phase, playMode: room.playMode, arenaId: room.arenaId,
    arenas: ARENAS, width: W, height: H, tick: room.tick, winScore: WIN_SCORE,
    players: room.players, paddles: room.paddles, scores: room.scores, mission: room.mission,
    ball: room.ball, winner: room.winner, outcome: room.outcome, event: room.event, eventAt: room.eventAt,
    serveIn: room.serveAt ? Math.max(0, room.serveAt - now) : 0,
    power: { p1: publicPower('p1', now), p2: publicPower('p2', now) },
    effects: { slowField: now < room.slowFieldUntil }
  };
}
function sendJson(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(value));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 16384) req.destroy(new Error('body too large')); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
function sendFile(res, file, type, cache) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJson(res, 404, { ok: false, error: 'asset not found' });
  res.writeHead(200, { 'content-type': type, 'cache-control': cache || 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}
function safeAsset(root, requestPath) {
  const relative = String(requestPath || '').replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return resolved.startsWith(prefix) ? resolved : null;
}
function lanAddresses() {
  const found = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|wsl|loopback/i.test(name)) continue;
    for (const item of entries || []) if (item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.')) found.push(item.address);
  }
  return found;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return sendFile(res, CLIENT_FILE, 'text/html; charset=utf-8', 'no-store');
    if (req.method === 'GET' && url.pathname === '/neon-pong-duet.css') return sendFile(res, path.join(__dirname, 'neon-pong-duet.css'), 'text/css; charset=utf-8', 'no-cache');
    if (req.method === 'GET' && url.pathname === '/neon-pong-duet.js') return sendFile(res, path.join(__dirname, 'neon-pong-duet.js'), 'text/javascript; charset=utf-8', 'no-cache');
    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) return sendFile(res, safeAsset(LOCAL_ASSETS, url.pathname.slice('/assets/'.length)), /\.png$/i.test(url.pathname) ? 'image/png' : 'application/octet-stream');
    if (req.method === 'GET' && url.pathname.startsWith('/aetherglass/')) {
      const file = safeAsset(AETHERGLASS_ROOT, url.pathname.slice('/aetherglass/'.length));
      return sendFile(res, file, /\.css$/i.test(url.pathname) ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'no-cache');
    }
    if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, name: 'AXM Pong · Duet', version: room.version, room: room.room, playMode: room.playMode, minPlayers: 1, maxPlayers: 2, arenas: ARENAS.map(arena => arena.id), aetherglass: fs.existsSync(AETHERGLASS_ROOT) });
    if (req.method === 'GET' && url.pathname === '/state') return sendJson(res, 200, publicState());
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
      res.write('retry: 1000\n\n');
      streams.add(res);
      req.on('close', () => streams.delete(res));
      return;
    }
    if (TEST_MODE && req.method === 'POST' && url.pathname === '/test/set') {
      const patch = await readJson(req);
      if (patch.ball) Object.assign(room.ball, patch.ball);
      if (patch.mission) Object.assign(room.mission, patch.mission);
      if (patch.scores) Object.assign(room.scores, patch.scores);
      if (patch.phase) room.phase = patch.phase;
      return sendJson(res, 200, { ok: true, state: publicState() });
    }
    if (req.method === 'POST' && url.pathname === '/input') {
      const player = url.searchParams.get('player') === 'p2' ? 'p2' : 'p1';
      if (room.players[player].kind !== 'human') return sendJson(res, 409, { ok: false, error: player + ' is adapter-controlled' });
      const input = await readJson(req);
      room.inputs[player].left = !!input.left;
      room.inputs[player].right = !!input.right;
      if (input.power) usePower(player, Date.now());
      return sendJson(res, 200, { ok: true, player });
    }
    if (req.method === 'POST' && url.pathname === '/arena') {
      const input = await readJson(req);
      if (room.phase === 'running' || room.phase === 'paused') return sendJson(res, 409, { ok: false, error: 'finish or reset the active match before changing arena' });
      const arena = setArena(input.arenaId);
      return sendJson(res, 200, { ok: true, arena, state: publicState() });
    }
    if (req.method === 'POST' && url.pathname === '/next-arena') return sendJson(res, 200, { ok: true, arena: nextArena(), state: publicState() });
    if (req.method === 'POST' && (url.pathname === '/start' || url.pathname === '/reset')) { startMatch(); return sendJson(res, 200, { ok: true, state: publicState() }); }
    if (req.method === 'POST' && url.pathname === '/pause') {
      if (room.phase === 'running') { room.phase = 'paused'; announce('PAUSED'); }
      else if (room.phase === 'paused') { room.phase = 'running'; announce('LIGHT LIVE'); }
      return sendJson(res, 200, { ok: true, state: publicState() });
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    return sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); }
});

const physicsLoop = setInterval(tick, TICK_MS);
const streamLoop = setInterval(() => {
  if (!streams.size) return;
  const packet = 'data: ' + JSON.stringify(publicState()) + '\n\n';
  for (const stream of streams) { try { stream.write(packet); } catch (error) { streams.delete(stream); } }
}, 40);

server.listen(PORT, HOST, () => {
  console.log('AXM Pong · Duet ' + room.version + ' · ' + room.playMode);
  console.log('Local: http://127.0.0.1:' + PORT + '/?room=AXM1&player=screen');
  for (const address of lanAddresses()) console.log('LAN:   http://' + address + ':' + PORT + '/?room=AXM1&player=p1');
});

function shutdown() {
  clearInterval(physicsLoop);
  clearInterval(streamLoop);
  for (const stream of streams) { try { stream.end(); } catch (error) {} }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
