#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOST = process.env.AXM_ROBO_PONG_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8792);
const MODE = process.env.AXM_GAME_MODE || 'human-vs-ai';
const P1_HUMAN = MODE !== 'ai-vs-ai' && MODE !== 'ai-vs-human';
const P2_HUMAN = MODE === 'human-vs-human' || MODE === 'ai-vs-human';
const P1_NAME = cleanName(process.env.AXM_P1_NAME || (P1_HUMAN ? 'MIKE' : 'CODEX'));
const P2_NAME = cleanName(process.env.AXM_P2_NAME || (P2_HUMAN ? 'ERROL' : 'NOVA'));
const CLIENT_FILE = path.join(__dirname, 'ROBO_PONG_PHASER4_PHONE_CLIENT.html');

const W = 900;
const H = 1400;
const TICK_MS = 1000 / 60;
const WIN_SCORE = 7;
const BASE_PADDLE_W = 230;
const POWER_PADDLE_W = 370;
const PADDLE_H = 34;
const BALL_R = 22;
const PADDLE_SPEED = 820;
const SPECIAL_COOLDOWN = 7800;
const SPECIALS = {
  shield: { label: 'MEGA SHIELD', color: '#ff4fc8' },
  warp: { label: 'PADDLE WARP', color: '#ffc85a' },
  slow: { label: 'SLOW FIELD', color: '#76a9ff' },
  jammer: { label: 'PADDLE JAM', color: '#9cff63' }
};

function cleanName(value) {
  const text = String(value || '').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 20);
  return text || 'PLAYER';
}

function createPaddle(id, y, name) {
  return { id, name, x: W / 2, y, width: BASE_PADDLE_W, height: PADDLE_H, shieldUntil: 0, jammedUntil: 0 };
}

function randomSpecial(previous) {
  const choices = Object.keys(SPECIALS).filter(key => key !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}

function createSpecial() {
  return { kind: randomSpecial(), readyAt: 0, activeUntil: 0, activeLabel: '' };
}

function newRoom() {
  return {
    room: 'AXM1',
    version: '1.1.0-specials',
    mode: MODE,
    phase: 'ready',
    tick: 0,
    width: W,
    height: H,
    winScore: WIN_SCORE,
    scores: { p1: 0, p2: 0 },
    players: {
      p1: { id: 'p1', name: P1_NAME, kind: P1_HUMAN ? 'human' : 'adapter' },
      p2: { id: 'p2', name: P2_NAME, kind: P2_HUMAN ? 'human' : 'adapter' }
    },
    paddles: {
      p1: createPaddle('p1', H - 112, P1_NAME),
      p2: createPaddle('p2', 112, P2_NAME)
    },
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, radius: BALL_R },
    inputs: {
      p1: { left: false, right: false },
      p2: { left: false, right: false }
    },
    specials: { p1: createSpecial(), p2: createSpecial() },
    slowFieldUntil: 0,
    serveAt: 0,
    winner: null,
    event: 'READY',
    eventAt: Date.now()
  };
}

const room = newRoom();
const streams = new Set();
let lastTick = Date.now();

function announce(text) {
  room.event = text;
  room.eventAt = Date.now();
}

function resetBall(direction) {
  room.ball.x = W / 2;
  room.ball.y = H / 2;
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.serveDirection = direction || (Math.random() > 0.5 ? 1 : -1);
  room.serveAt = Date.now() + 850;
}

function startMatch() {
  room.phase = 'running';
  room.scores.p1 = 0;
  room.scores.p2 = 0;
  room.winner = null;
  room.paddles.p1.x = W / 2;
  room.paddles.p2.x = W / 2;
  room.paddles.p1.shieldUntil = 0;
  room.paddles.p2.shieldUntil = 0;
  room.paddles.p1.jammedUntil = 0;
  room.paddles.p2.jammedUntil = 0;
  room.specials.p1 = createSpecial();
  room.specials.p2 = createSpecial();
  room.slowFieldUntil = 0;
  resetBall(Math.random() > 0.5 ? 1 : -1);
  announce(P1_NAME + ' VS ' + P2_NAME);
}

function serveIfReady(now) {
  if (!room.serveAt || now < room.serveAt || room.phase !== 'running') return;
  const angle = (Math.random() * 0.7 - 0.35);
  const speed = 660;
  room.ball.vx = Math.sin(angle) * speed;
  room.ball.vy = Math.cos(angle) * speed * room.serveDirection;
  room.serveAt = 0;
  announce('GO');
}

function usePower(player, now) {
  if (room.phase !== 'running') return false;
  const paddle = room.paddles[player];
  const opponent = player === 'p1' ? 'p2' : 'p1';
  const slot = room.specials[player];
  if (now < slot.readyAt) return false;
  const used = slot.kind;
  if (used === 'shield') {
    paddle.shieldUntil = now + 2800;
    slot.activeUntil = paddle.shieldUntil;
  } else if (used === 'warp') {
    paddle.x = Math.max(BASE_PADDLE_W / 2 + 24, Math.min(W - BASE_PADDLE_W / 2 - 24, room.ball.x));
    slot.activeUntil = now + 650;
  } else if (used === 'slow') {
    room.slowFieldUntil = Math.max(room.slowFieldUntil, now + 2600);
    slot.activeUntil = room.slowFieldUntil;
  } else if (used === 'jammer') {
    room.paddles[opponent].jammedUntil = now + 2300;
    slot.activeUntil = room.paddles[opponent].jammedUntil;
  }
  slot.activeLabel = SPECIALS[used].label;
  slot.kind = randomSpecial(used);
  slot.readyAt = now + SPECIAL_COOLDOWN;
  announce(paddle.name + ' · ' + SPECIALS[used].label);
  return true;
}

function controlPaddle(player, dt, now) {
  const paddle = room.paddles[player];
  const input = room.inputs[player];
  paddle.width = now < paddle.shieldUntil ? POWER_PADDLE_W : BASE_PADDLE_W;
  const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const speedFactor = now < paddle.jammedUntil ? 0.32 : 1;
  paddle.x += axis * PADDLE_SPEED * speedFactor * dt;
  paddle.x = Math.max(paddle.width / 2 + 24, Math.min(W - paddle.width / 2 - 24, paddle.x));
}

function aiPaddle(player, dt, now) {
  const paddle = room.paddles[player];
  paddle.width = now < paddle.shieldUntil ? POWER_PADDLE_W : BASE_PADDLE_W;
  const target = room.ball.x + room.ball.vx * 0.09;
  const error = target - paddle.x;
  const speed = (player === 'p2' ? 650 : 620) * (now < paddle.jammedUntil ? 0.32 : 1);
  paddle.x += Math.max(-speed * dt, Math.min(speed * dt, error));
  paddle.x = Math.max(paddle.width / 2 + 24, Math.min(W - paddle.width / 2 - 24, paddle.x));
  const ballApproaching = player === 'p1' ? room.ball.vy > 0 : room.ball.vy < 0;
  if (ballApproaching && Math.abs(room.ball.y - paddle.y) < 310 && (Math.abs(error) > BASE_PADDLE_W * 0.38 || Math.hypot(room.ball.vx, room.ball.vy) > 860)) usePower(player, now);
}

function bounceFrom(paddle, direction) {
  const relative = Math.max(-1, Math.min(1, (room.ball.x - paddle.x) / (paddle.width / 2)));
  const speed = Math.min(1040, Math.hypot(room.ball.vx, room.ball.vy) + 26);
  room.ball.vx = relative * speed * 0.86;
  room.ball.vy = direction * Math.sqrt(Math.max(180000, speed * speed - room.ball.vx * room.ball.vx));
  room.ball.y = paddle.y + direction * (PADDLE_H / 2 + BALL_R + 1);
  announce(paddle.name + ' RETURN');
}

function score(player) {
  room.scores[player] += 1;
  const scorer = room.players[player];
  announce(scorer.name + ' +1');
  if (room.scores[player] >= WIN_SCORE) {
    room.phase = 'gameover';
    room.winner = player;
    room.ball.vx = 0;
    room.ball.vy = 0;
    room.serveAt = 0;
    announce(scorer.name + ' WINS');
    return;
  }
  resetBall(player === 'p1' ? -1 : 1);
}

function updateBall(dt, now) {
  serveIfReady(now);
  const ball = room.ball;
  if (!ball.vx && !ball.vy) return;
  const previousY = ball.y;
  const fieldFactor = now < room.slowFieldUntil ? 0.56 : 1;
  ball.x += ball.vx * dt * fieldFactor;
  ball.y += ball.vy * dt * fieldFactor;

  if (ball.x - BALL_R < 20) {
    ball.x = 20 + BALL_R;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + BALL_R > W - 20) {
    ball.x = W - 20 - BALL_R;
    ball.vx = -Math.abs(ball.vx);
  }

  const p1 = room.paddles.p1;
  const p2 = room.paddles.p2;
  if (ball.vy > 0 && previousY + BALL_R <= p1.y - PADDLE_H / 2 && ball.y + BALL_R >= p1.y - PADDLE_H / 2 && Math.abs(ball.x - p1.x) <= p1.width / 2 + BALL_R) {
    bounceFrom(p1, -1);
  } else if (ball.vy < 0 && previousY - BALL_R >= p2.y + PADDLE_H / 2 && ball.y - BALL_R <= p2.y + PADDLE_H / 2 && Math.abs(ball.x - p2.x) <= p2.width / 2 + BALL_R) {
    bounceFrom(p2, 1);
  }

  if (ball.y < -BALL_R * 2) score('p1');
  else if (ball.y > H + BALL_R * 2) score('p2');
}

function tick() {
  const now = Date.now();
  const dt = Math.min(0.04, Math.max(0.001, (now - lastTick) / 1000));
  lastTick = now;
  room.tick += 1;
  if (P1_HUMAN) controlPaddle('p1', dt, now); else aiPaddle('p1', dt, now);
  if (P2_HUMAN) controlPaddle('p2', dt, now); else aiPaddle('p2', dt, now);
  if (room.phase === 'running') updateBall(dt, now);
}

function publicState() {
  const now = Date.now();
  function publicPower(player) {
    const slot = room.specials[player];
    const info = SPECIALS[slot.kind];
    return {
      kind: slot.kind,
      label: info.label,
      color: info.color,
      active: now < slot.activeUntil,
      activeLabel: now < slot.activeUntil ? slot.activeLabel : '',
      readyIn: Math.max(0, slot.readyAt - now)
    };
  }
  return {
    room: room.room,
    version: room.version,
    mode: room.mode,
    phase: room.phase,
    tick: room.tick,
    width: W,
    height: H,
    winScore: WIN_SCORE,
    scores: room.scores,
    players: room.players,
    paddles: room.paddles,
    ball: room.ball,
    winner: room.winner,
    event: room.event,
    eventAt: room.eventAt,
    serveIn: room.serveAt ? Math.max(0, room.serveAt - now) : 0,
    power: { p1: publicPower('p1'), p2: publicPower('p2') },
    effects: { slowField: now < room.slowFieldUntil }
  };
}

function sendJson(res, code, value) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(JSON.stringify(value));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 16384) req.destroy(new Error('body too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function lanAddresses() {
  const found = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|wsl|loopback/i.test(name)) continue;
    for (const item of entries || []) {
      if (item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.')) found.push(item.address);
    }
  }
  return found;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = fs.readFileSync(CLIENT_FILE);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, name: 'Robo Pong', version: room.version, mode: MODE, room: room.room });
    if (req.method === 'GET' && url.pathname === '/state') return sendJson(res, 200, publicState());
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'access-control-allow-origin': '*'
      });
      res.write('retry: 1000\n\n');
      streams.add(res);
      req.on('close', () => streams.delete(res));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/input') {
      const player = url.searchParams.get('player') === 'p2' ? 'p2' : 'p1';
      if ((player === 'p1' && !P1_HUMAN) || (player === 'p2' && !P2_HUMAN)) return sendJson(res, 409, { ok: false, error: player + ' is adapter-controlled in this match' });
      const input = await readJson(req);
      room.inputs[player].left = !!input.left;
      room.inputs[player].right = !!input.right;
      if (input.power) usePower(player, Date.now());
      return sendJson(res, 200, { ok: true, player });
    }
    if (req.method === 'POST' && url.pathname === '/start') {
      startMatch();
      return sendJson(res, 200, { ok: true, state: publicState() });
    }
    if (req.method === 'POST' && url.pathname === '/reset') {
      startMatch();
      return sendJson(res, 200, { ok: true, state: publicState() });
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    return sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
});

const physicsLoop = setInterval(tick, TICK_MS);
const streamLoop = setInterval(() => {
  if (!streams.size) return;
  const packet = 'data: ' + JSON.stringify(publicState()) + '\n\n';
  for (const stream of streams) {
    try { stream.write(packet); } catch (e) { streams.delete(stream); }
  }
}, 50);

server.listen(PORT, HOST, () => {
  console.log('Robo Pong ' + room.version + ' · ' + MODE);
  console.log('Local: http://127.0.0.1:' + PORT + '/');
  for (const address of lanAddresses()) console.log('LAN:   http://' + address + ':' + PORT + '/?room=AXM1&player=p2');
});

function shutdown() {
  clearInterval(physicsLoop);
  clearInterval(streamLoop);
  for (const stream of streams) { try { stream.end(); } catch (e) {} }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
