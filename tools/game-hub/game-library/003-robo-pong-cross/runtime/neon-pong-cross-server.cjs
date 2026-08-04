#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const SeatInterface = require('./seat-interface.cjs');

const HOST = process.env.AXM_ROBO_PONG_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8793);
const TEST_MODE = process.env.AXM_TEST_MODE === '1';
const HUB_MODE = String(process.env.AXM_GAME_PLAY_MODE || '').toLowerCase();
const PLAY_MODE = HUB_MODE.includes('coop') ? 'coop' : 'versus';
const SESSION_ID = String(process.env.AXM_GAME_SESSION_ID || 'cross-local-session');
const CLIENT_FILE = path.join(__dirname, 'neon-pong-cross-client.html');
const CONTROLLER_SW_FILE = path.join(__dirname, 'controller-sw.js');
const MANIFEST_FILE = path.join(__dirname, 'manifest.webmanifest');
const CONTROLLER_ICON_FILE = path.join(__dirname, 'controller-icon.svg');
const LOCAL_ASSETS = path.join(__dirname, 'assets');
const WORKSHOP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const AETHERGLASS_V7_ROOT = path.join(WORKSHOP_ROOT, 'AXM_AETHERGLASS_VISUAL_ENGINE_v7_1_0', 'src');
const AETHERGLASS_SHARED_ROOT = path.join(WORKSHOP_ROOT, 'shared', 'aetherglass', 'src');
const AETHERGLASS_ROOT = fs.existsSync(AETHERGLASS_V7_ROOT) ? AETHERGLASS_V7_ROOT : AETHERGLASS_SHARED_ROOT;

const W = 1000;
const H = 1000;
const TICK_MS = 1000 / 60;
const CONTROLLER_DISCONNECT_MS = Math.max(100, Math.min(30000, Number(process.env.AXM_CONTROLLER_DISCONNECT_MS || 2500) || 2500));
const START_LIVES = 5;
const BALL_R = 15;
const BASE_SPEED = 510;
const PADDLE_LEN = 172;
const SHIELD_LEN = 270;
const PADDLE_THICK = 24;
const PADDLE_SPEED = 620;
const EDGE = 66;
const SPECIAL_COOLDOWN = 7600;
const SIDES = ['bottom', 'top', 'left', 'right'];
const COLORS = ['#46d7e7', '#ff3dd8', '#f0bd63', '#69dc9a'];

const ARENAS = [
  { id: 'cathedral-cross', label: 'Cathedral Cross', objective: 'SEAL THE BREACH', background: 'cathedral-cross-plate.png', diamondRadius: 82, boss: 8, core: 7, accent: '#69dc9a' },
  { id: 'shattered-line', label: 'Shattered Line', objective: 'HOLD THE FRACTURE', background: 'shattered-line-plate.png', diamondRadius: 68, boss: 10, core: 6, accent: '#46d7e7' },
  { id: 'relay-protocol', label: 'Relay Protocol', objective: 'BREAK THE WARDEN', background: 'relay-protocol-plate.png', diamondRadius: 108, boss: 12, core: 6, accent: '#f0bd63' }
];
const SPECIALS = {
  shield: { label: 'MEGA SHIELD', color: '#ff3dd8' },
  warp: { label: 'PADDLE WARP', color: '#f0bd63' },
  slow: { label: 'SLOW FIELD', color: '#76a9ff' },
  jammer: { label: 'RIVAL JAM', color: '#69dc9a' }
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function cleanName(value, fallback) {
  const text = String(value || '').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 20);
  return text || fallback;
}
function loadRoster() {
  let raw = [];
  try { raw = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]'); } catch (error) {}
  const count = raw.length ? clamp(raw.length, 3, 4) : 4;
  const defaults = ['MIKE', 'NOVA', 'GEMINI', 'CODEX'];
  const seats = Array.from({ length: 4 }, (_, index) => {
    const seat = raw[index] || {};
    const type = raw.length && ['human', 'adapter', 'ai'].includes(seat.type) ? seat.type : 'ai';
    return {
      seatId: String(seat.seat_id || seat.seat || 'seat_' + (index + 1)),
      slot: Number(seat.slot || index + 1),
      type,
      adapterId: type === 'adapter' ? String(seat.adapter_id || seat.adapterId || 'adapter-seat-' + (index + 1)) : null,
      name: cleanName(seat.display_name || process.env['AXM_P' + (index + 1) + '_NAME'], defaults[index]),
      participant: index < count
    };
  });
  return { seats, count };
}
const roster = loadRoster();

function arenaById(id) { return ARENAS.find(arena => arena.id === id) || ARENAS[0]; }
function randomSpecial(previous) {
  const choices = Object.keys(SPECIALS).filter(key => key !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}
function makeSpecial() { return { kind: randomSpecial(), readyAt: 0, activeUntil: 0, activeLabel: '' }; }
function makePaddle(id, side) {
  const horizontal = side === 'bottom' || side === 'top';
  return { id, side, horizontal, x: horizontal ? W / 2 : (side === 'left' ? EDGE : W - EDGE), y: horizontal ? (side === 'top' ? EDGE : H - EDGE) : H / 2, length: PADDLE_LEN, thickness: PADDLE_THICK, axisVelocity: 0, shieldUntil: 0, jammedUntil: 0 };
}
function makeBall(id, active) { return { id, x: W / 2, y: H / 2, vx: 0, vy: 0, radius: id === 'core' ? BALL_R : BALL_R - 2, active: !!active, serveAt: 0, lastTouch: null }; }
function newRoom() {
  const arena = arenaById(process.env.AXM_PONG_ARENA);
  const players = {}, paddles = {}, inputs = {}, lives = {}, specials = {};
  roster.seats.forEach((seat, index) => {
    const id = 'p' + (index + 1);
    const participant = seat.participant;
    const warden = PLAY_MODE === 'coop' && roster.count === 3 && index === 3;
    const kind = warden ? 'ai' : seat.type;
    players[id] = {
      id,
      seatId: warden ? null : seat.seatId,
      slot: warden ? null : seat.slot,
      adapterId: kind === 'adapter' ? seat.adapterId : null,
      name: warden ? 'WARDEN' : seat.name,
      side: SIDES[index],
      kind,
      color: warden ? '#f2877f' : COLORS[index],
      alive: participant || warden,
      participant,
      team: warden ? 'warden' : (PLAY_MODE === 'coop' ? 'relay' : id),
      role: warden ? 'warden' : 'player',
      controllerConnected: ['human', 'adapter'].includes(kind) ? false : null,
      adapterConsent: kind === 'adapter' ? true : null
    };
    paddles[id] = makePaddle(id, SIDES[index]);
    inputs[id] = { left: false, right: false, lastSeenAt: 0, sequence: -1, rateWindow: [] };
    lives[id] = participant ? START_LIVES : 0;
    specials[id] = makeSpecial();
  });
  return {
    room: 'AXM1', version: '2.1.0-neon-cross', phase: 'ready', playMode: PLAY_MODE, seatCount: roster.count,
    arenaId: arena.id, tick: 0, width: W, height: H, startLives: START_LIVES,
    players, paddles, inputs, lives, specials,
    balls: [makeBall('core', true), makeBall('echo', PLAY_MODE === 'versus' && roster.count === 4)],
    diamond: { x: W / 2, y: H / 2, radius: arena.diamondRadius, angle: 0, rotationSpeed: 0.12 },
    mission: { core: arena.core, coreMax: arena.core, boss: arena.boss, bossMax: arena.boss, relayChain: [], relayArmed: false, wave: 1, status: 'READY', wardenId: PLAY_MODE === 'coop' && roster.count === 3 ? 'p4' : null },
    slowFieldUntil: 0, serveAt: 0, winner: null, outcome: null,
    event: PLAY_MODE === 'coop' ? arena.objective : roster.count + '-PLAYER CROSS READY', eventAt: Date.now()
  };
}

const room = newRoom();
const seatBindings = SeatInterface.createSeatBindings(room);
const streams = new Set();
let lastTick = Date.now();

function announce(text) { room.event = text; room.eventAt = Date.now(); }
function participantIds() { return Object.keys(room.players).filter(id => room.players[id].participant); }
function livingVersusIds() { return participantIds().filter(id => room.players[id].alive); }
function teamIds() { return participantIds().filter(id => room.players[id].team === 'relay'); }
function activeBalls() { return room.balls.filter(ball => ball.active); }
function axisOf(paddle) { return paddle.horizontal ? paddle.x : paddle.y; }
function setAxis(paddle, value) {
  const half = paddle.length / 2;
  if (paddle.horizontal) paddle.x = clamp(value, EDGE + half, W - EDGE - half);
  else paddle.y = clamp(value, EDGE + half, H - EDGE - half);
}
function configureArena() {
  const arena = arenaById(room.arenaId);
  room.diamond.radius = arena.diamondRadius;
  room.diamond.angle = 0;
  Object.keys(room.paddles).forEach(id => { room.paddles[id] = makePaddle(id, room.players[id].side); });
}
function resetMission() {
  const arena = arenaById(room.arenaId);
  room.mission = { core: arena.core, coreMax: arena.core, boss: arena.boss, bossMax: arena.boss, relayChain: [], relayArmed: false, wave: 1, status: 'ACTIVE', wardenId: room.playMode === 'coop' && room.seatCount === 3 ? 'p4' : null };
}
function resetBall(ball, delay) {
  ball.x = W / 2;
  ball.y = H / 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.lastTouch = null;
  ball.serveAt = Date.now() + (delay == null ? 850 : delay);
}
function resetAllBalls(delay) {
  room.balls[0].active = true;
  room.balls[1].active = room.playMode === 'versus' && room.seatCount === 4;
  room.balls.forEach(function (ball, index) { resetBall(ball, (delay == null ? 900 : delay) + index * 260); });
  room.serveAt = Date.now() + (delay == null ? 900 : delay);
}
function startMatch() {
  room.phase = 'running';
  room.winner = null;
  room.outcome = null;
  room.slowFieldUntil = 0;
  configureArena();
  resetMission();
  Object.keys(room.players).forEach(id => {
    const player = room.players[id];
    player.alive = player.participant || player.role === 'warden';
    room.lives[id] = player.participant ? START_LIVES : 0;
    room.specials[id] = makeSpecial();
  });
  resetAllBalls(950);
  announce(room.playMode === 'coop' ? arenaById(room.arenaId).objective : room.seatCount + '-WAY START');
}
function setArena(id) {
  const arena = arenaById(id);
  room.arenaId = arena.id;
  room.phase = 'ready';
  room.winner = null;
  room.outcome = null;
  configureArena();
  resetMission();
  room.balls.forEach(ball => { ball.vx = 0; ball.vy = 0; ball.x = W / 2; ball.y = H / 2; ball.serveAt = 0; });
  room.serveAt = 0;
  announce(arena.objective);
  return arena;
}
function randomServeAngle() {
  let angle;
  do { angle = Math.random() * Math.PI * 2; } while (Math.abs(Math.sin(angle)) < 0.3 || Math.abs(Math.cos(angle)) < 0.3);
  return angle;
}
function serveBall(ball, now) {
  if (!ball.active || !ball.serveAt || now < ball.serveAt || room.phase !== 'running') return;
  const angle = randomServeAngle();
  const speed = BASE_SPEED * (ball.id === 'echo' ? 0.9 : 1);
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.serveAt = 0;
  announce(ball.id === 'echo' ? 'ECHO BALL LIVE' : 'CORE BALL LIVE');
}
function usePower(player, now) {
  if (room.phase !== 'running' || !room.players[player].alive || !room.players[player].participant) return false;
  const slot = room.specials[player];
  const paddle = room.paddles[player];
  if (now < slot.readyAt) return false;
  const used = slot.kind;
  if (used === 'shield') { paddle.shieldUntil = now + 2700; slot.activeUntil = paddle.shieldUntil; }
  else if (used === 'warp') {
    const ball = threatBall(paddle);
    setAxis(paddle, paddle.horizontal ? ball.x : ball.y);
    slot.activeUntil = now + 600;
  } else if (used === 'slow') { room.slowFieldUntil = now + 2400; slot.activeUntil = room.slowFieldUntil; }
  else if (used === 'jammer') {
    const targets = Object.keys(room.players).filter(id => id !== player && room.players[id].alive);
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (target) { room.paddles[target].jammedUntil = now + 2200; slot.activeUntil = room.paddles[target].jammedUntil; }
  }
  slot.activeLabel = SPECIALS[used].label;
  slot.kind = randomSpecial(used);
  slot.readyAt = now + SPECIAL_COOLDOWN;
  announce(room.players[player].name + ' · ' + SPECIALS[used].label);
  return true;
}
function controlPaddle(player, dt, now) {
  const paddle = room.paddles[player];
  const input = room.inputs[player];
  paddle.length = now < paddle.shieldUntil ? SHIELD_LEN : PADDLE_LEN;
  const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const factor = now < paddle.jammedUntil ? 0.3 : 1;
  paddle.axisVelocity = axis * PADDLE_SPEED * factor;
  setAxis(paddle, axisOf(paddle) + paddle.axisVelocity * dt);
}
function ballApproaching(side, ball) {
  if (side === 'bottom') return ball.vy > 0;
  if (side === 'top') return ball.vy < 0;
  if (side === 'left') return ball.vx < 0;
  return ball.vx > 0;
}
function threatBall(paddle) {
  const choices = activeBalls().slice().sort(function (a, b) {
    const aApproach = ballApproaching(paddle.side, a) ? 0 : 1;
    const bApproach = ballApproaching(paddle.side, b) ? 0 : 1;
    if (aApproach !== bApproach) return aApproach - bApproach;
    return (paddle.horizontal ? Math.abs(a.y - paddle.y) : Math.abs(a.x - paddle.x)) - (paddle.horizontal ? Math.abs(b.y - paddle.y) : Math.abs(b.x - paddle.x));
  });
  return choices[0] || room.balls[0];
}
function aiPaddle(player, dt, now) {
  const paddle = room.paddles[player];
  paddle.length = now < paddle.shieldUntil ? SHIELD_LEN : PADDLE_LEN;
  const ball = threatBall(paddle);
  const target = paddle.horizontal ? ball.x + ball.vx * 0.08 : ball.y + ball.vy * 0.08;
  const factor = now < paddle.jammedUntil ? 0.3 : 1;
  const step = (room.players[player].role === 'warden' ? 510 : 460) * factor * dt;
  const before = axisOf(paddle);
  setAxis(paddle, before + clamp(target - before, -step, step));
  paddle.axisVelocity = dt > 0 ? (axisOf(paddle) - before) / dt : 0;
}
function addRelayTouch(player) {
  if (room.playMode !== 'coop' || room.players[player].role !== 'player') return;
  const chain = room.mission.relayChain;
  if (chain[chain.length - 1] !== player && chain.indexOf(player) < 0) chain.push(player);
  const required = Math.min(3, teamIds().length);
  room.mission.relayArmed = chain.length >= required;
  announce(room.players[player].name + ' · RELAY ' + chain.length + '/' + required);
}
function bouncePaddle(player, ball) {
  const paddle = room.paddles[player];
  const relative = clamp((paddle.horizontal ? ball.x - paddle.x : ball.y - paddle.y) / (paddle.length / 2), -1, 1);
  const speed = Math.min(930, Math.hypot(ball.vx, ball.vy) + 22);
  const tangent = clamp(relative * speed * 0.68 + paddle.axisVelocity * 0.25, -speed * 0.88, speed * 0.88);
  const direct = Math.sqrt(Math.max(100000, speed * speed - tangent * tangent));
  if (paddle.side === 'bottom') { ball.vx = tangent; ball.vy = -direct; ball.y = paddle.y - PADDLE_THICK / 2 - ball.radius - 1; }
  else if (paddle.side === 'top') { ball.vx = tangent; ball.vy = direct; ball.y = paddle.y + PADDLE_THICK / 2 + ball.radius + 1; }
  else if (paddle.side === 'left') { ball.vy = tangent; ball.vx = direct; ball.x = paddle.x + PADDLE_THICK / 2 + ball.radius + 1; }
  else { ball.vy = tangent; ball.vx = -direct; ball.x = paddle.x - PADDLE_THICK / 2 - ball.radius - 1; }
  ball.lastTouch = player;
  addRelayTouch(player);
  if (room.players[player].role === 'warden') announce('WARDEN RETURN');
}
function finishCoop(success) {
  room.phase = 'gameover';
  room.outcome = success ? 'victory' : 'defeat';
  room.winner = success ? 'relay' : 'warden';
  room.mission.status = success ? 'WARDEN BROKEN' : 'CORE LOST';
  room.balls.forEach(ball => { ball.vx = 0; ball.vy = 0; ball.serveAt = 0; });
  announce(success ? 'RELAY COMPLETE' : 'CORE LOST');
}
function damageBoss(amount, ball) {
  room.mission.boss = Math.max(0, room.mission.boss - (amount || 1));
  room.mission.relayChain = [];
  room.mission.relayArmed = false;
  room.mission.wave = 1 + Math.floor((room.mission.bossMax - room.mission.boss) / 3);
  announce('WARDEN HIT · ' + room.mission.boss + ' REMAIN');
  if (room.mission.boss <= 0) finishCoop(true);
  else if (ball) resetBall(ball, 540);
}
function diamondBounce(ball) {
  const dx = ball.x - W / 2;
  const dy = ball.y - H / 2;
  const expanded = room.diamond.radius + ball.radius * 1.42;
  const angle = room.diamond.angle;
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const lx = dx * cosA + dy * sinA;
  const ly = -dx * sinA + dy * cosA;
  const distance = Math.abs(lx) + Math.abs(ly);
  if (distance >= expanded) return;
  const sx = lx === 0 ? 1 : Math.sign(lx);
  const sy = ly === 0 ? 1 : Math.sign(ly);
  const localNx = sx / Math.SQRT2, localNy = sy / Math.SQRT2;
  const nx = localNx * cosA - localNy * sinA, ny = localNx * sinA + localNy * cosA;
  const dot = ball.vx * nx + ball.vy * ny;
  const push = (expanded - distance + 2) / Math.SQRT2;
  ball.x += nx * push;
  ball.y += ny * push;
  if (dot < 0) { ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny; }
  const chaos = (Math.random() - 0.5) * 0.24;
  const cosC = Math.cos(chaos), sinC = Math.sin(chaos), vx = ball.vx, vy = ball.vy;
  ball.vx = vx * cosC - vy * sinC;
  ball.vy = vx * sinC + vy * cosC;
  if (room.playMode === 'coop' && room.mission.relayArmed) damageBoss(1);
  else announce(room.playMode === 'coop' ? 'RELAY NEEDS TEAM' : 'PRISM CHAOS');
}
function checkPaddles(ball, previousX, previousY) {
  for (const id of Object.keys(room.players)) {
    const player = room.players[id];
    if (!player.alive) continue;
    const paddle = room.paddles[id];
    if (paddle.side === 'bottom' && ball.vy > 0 && previousY + ball.radius <= paddle.y - PADDLE_THICK / 2 && ball.y + ball.radius >= paddle.y - PADDLE_THICK / 2 && Math.abs(ball.x - paddle.x) <= paddle.length / 2 + ball.radius) return bouncePaddle(id, ball);
    if (paddle.side === 'top' && ball.vy < 0 && previousY - ball.radius >= paddle.y + PADDLE_THICK / 2 && ball.y - ball.radius <= paddle.y + PADDLE_THICK / 2 && Math.abs(ball.x - paddle.x) <= paddle.length / 2 + ball.radius) return bouncePaddle(id, ball);
    if (paddle.side === 'left' && ball.vx < 0 && previousX - ball.radius >= paddle.x + PADDLE_THICK / 2 && ball.x - ball.radius <= paddle.x + PADDLE_THICK / 2 && Math.abs(ball.y - paddle.y) <= paddle.length / 2 + ball.radius) return bouncePaddle(id, ball);
    if (paddle.side === 'right' && ball.vx > 0 && previousX + ball.radius <= paddle.x - PADDLE_THICK / 2 && ball.x + ball.radius >= paddle.x - PADDLE_THICK / 2 && Math.abs(ball.y - paddle.y) <= paddle.length / 2 + ball.radius) return bouncePaddle(id, ball);
  }
}
function closedWallBounce(ball) {
  const closed = function (id) { return !room.players[id].alive; };
  if (closed('p1') && ball.y + BALL_R > H - 24 && ball.vy > 0) { ball.y = H - 24 - BALL_R; ball.vy = -Math.abs(ball.vy); }
  if (closed('p2') && ball.y - BALL_R < 24 && ball.vy < 0) { ball.y = 24 + BALL_R; ball.vy = Math.abs(ball.vy); }
  if (closed('p3') && ball.x - BALL_R < 24 && ball.vx < 0) { ball.x = 24 + BALL_R; ball.vx = Math.abs(ball.vx); }
  if (closed('p4') && ball.x + BALL_R > W - 24 && ball.vx > 0) { ball.x = W - 24 - BALL_R; ball.vx = -Math.abs(ball.vx); }
}
function versusMiss(player, ball) {
  if (!room.players[player].alive) return;
  room.lives[player] -= 1;
  if (room.lives[player] <= 0) { room.lives[player] = 0; room.players[player].alive = false; announce(room.players[player].name + ' ELIMINATED'); }
  else announce(room.players[player].name + ' LOST A LIFE');
  const alive = livingVersusIds();
  if (alive.length <= 1) {
    room.phase = 'gameover';
    room.winner = alive[0] || ball.lastTouch;
    room.outcome = 'victory';
    room.balls.forEach(item => { item.vx = 0; item.vy = 0; item.active = item.id === 'core'; item.serveAt = 0; });
    announce(room.winner ? room.players[room.winner].name + ' WINS' : 'DRAW');
    return;
  }
  if (alive.length <= 2) room.balls[1].active = false;
  resetBall(ball, 480);
}
function coopMiss(player, ball) {
  if (room.players[player].role === 'warden') { damageBoss(2, ball); return; }
  room.mission.core -= 1;
  room.mission.relayChain = [];
  room.mission.relayArmed = false;
  if (room.mission.core <= 0) { room.mission.core = 0; finishCoop(false); return; }
  announce(room.players[player].name + ' · CORE ' + room.mission.core);
  resetBall(ball, 520);
}
function checkGoals(ball) {
  let player = null;
  if (ball.y > H + BALL_R * 2 && room.players.p1.alive) player = 'p1';
  else if (ball.y < -BALL_R * 2 && room.players.p2.alive) player = 'p2';
  else if (ball.x < -BALL_R * 2 && room.players.p3.alive) player = 'p3';
  else if (ball.x > W + BALL_R * 2 && room.players.p4.alive) player = 'p4';
  if (!player) return;
  if (room.playMode === 'coop') coopMiss(player, ball); else versusMiss(player, ball);
}
function updateBall(ball, dt, now) {
  serveBall(ball, now);
  if (!ball.active || (!ball.vx && !ball.vy)) return;
  const previousX = ball.x, previousY = ball.y;
  const factor = now < room.slowFieldUntil ? 0.55 : 1;
  ball.x += ball.vx * dt * factor;
  ball.y += ball.vy * dt * factor;
  diamondBounce(ball);
  checkPaddles(ball, previousX, previousY);
  closedWallBounce(ball);
  checkGoals(ball);
}
function tick() {
  const now = Date.now();
  const dt = Math.min(0.04, Math.max(0.001, (now - lastTick) / 1000));
  lastTick = now;
  room.tick += 1;
  room.diamond.angle = (room.diamond.angle + room.diamond.rotationSpeed * dt) % (Math.PI * 2);
  if (room.phase !== 'paused') {
    Object.keys(room.players).forEach(id => {
      const player = room.players[id];
      if (!player.alive) return;
      if (player.kind === 'human' || player.kind === 'adapter') {
        const input = room.inputs[id];
        if (input.lastSeenAt && now - input.lastSeenAt > CONTROLLER_DISCONNECT_MS) {
          input.left = false;
          input.right = false;
          input.lastSeenAt = 0;
          player.controllerConnected = false;
        }
        controlPaddle(id, dt, now);
      } else aiPaddle(id, dt, now);
    });
  }
  if (room.phase === 'running') activeBalls().forEach(ball => updateBall(ball, dt, now));
}
function publicPower(id, now) {
  const slot = room.specials[id];
  const info = SPECIALS[slot.kind];
  return { kind: slot.kind, label: info.label, color: info.color, active: now < slot.activeUntil, activeLabel: now < slot.activeUntil ? slot.activeLabel : '', readyIn: Math.max(0, slot.readyAt - now) };
}
function publicState() {
  const now = Date.now(), power = {};
  Object.keys(room.specials).forEach(id => { power[id] = publicPower(id, now); });
  return {
    room: room.room, version: room.version, phase: room.phase, playMode: room.playMode, seatCount: room.seatCount,
    arenaId: room.arenaId, arenas: ARENAS, tick: room.tick, width: W, height: H, startLives: START_LIVES,
    players: room.players, paddles: room.paddles, lives: room.lives, balls: activeBalls(), ball: room.balls[0],
    diamond: room.diamond, mission: room.mission, winner: room.winner, outcome: room.outcome,
    event: room.event, eventAt: room.eventAt, power,
    effects: { slowField: now < room.slowFieldUntil, echoBall: room.balls[1].active }
  };
}
function sendJson(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-axm-seat-token' });
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
function safeAsset(root, requestPath) {
  const relative = String(requestPath || '').replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return resolved.startsWith(prefix) ? resolved : null;
}
function sendFile(res, file, type, cache) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJson(res, 404, { ok: false, error: 'asset not found' });
  res.writeHead(200, { 'content-type': type, 'cache-control': cache || 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}
function isLoopback(req) {
  const remote = String(req.socket && req.socket.remoteAddress || '');
  return /^(?:127\.|::1$|::ffff:127\.)/.test(remote);
}
function hostBootstrap() {
  const bindings = Object.values(seatBindings);
  return {
    ok: true,
    launch: {
      controllers: bindings.filter(binding => binding.controllerType === 'human').map(binding => ({
        seatId: binding.seatId,
        slot: binding.slot,
        displayName: binding.displayName,
        partyId: 'A',
        url: '/controller-shell?room=AXM1&player=' + binding.playerId + '#seat=' + encodeURIComponent(binding.seatId) + '&token=' + encodeURIComponent(binding.token)
      })),
      adapterBindings: bindings.filter(binding => binding.controllerType === 'adapter'),
      partyScreens: [{ partyId: 'A', url: '/?room=AXM1&player=screen' }]
    }
  };
}
function bearer(req) { return String(req.headers['x-axm-seat-token'] || req.headers.authorization || '').replace(/^Bearer\s+/i, ''); }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/controller-shell')) return sendFile(res, CLIENT_FILE, 'text/html; charset=utf-8', 'public, max-age=120');
    if (req.method === 'GET' && url.pathname === '/neon-pong-cross.css') return sendFile(res, path.join(__dirname, 'neon-pong-cross.css'), 'text/css; charset=utf-8', 'no-cache');
    if (req.method === 'GET' && url.pathname === '/neon-pong-cross.js') return sendFile(res, path.join(__dirname, 'neon-pong-cross.js'), 'text/javascript; charset=utf-8', 'no-cache');
    if (req.method === 'GET' && url.pathname === '/controller-sw.js') return sendFile(res, CONTROLLER_SW_FILE, 'text/javascript; charset=utf-8', 'no-cache');
    if (req.method === 'GET' && url.pathname === '/manifest.webmanifest') return sendFile(res, MANIFEST_FILE, 'application/manifest+json; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/controller-icon.svg') return sendFile(res, CONTROLLER_ICON_FILE, 'image/svg+xml; charset=utf-8');
    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) return sendFile(res, safeAsset(LOCAL_ASSETS, url.pathname.slice('/assets/'.length)), /\.png$/i.test(url.pathname) ? 'image/png' : 'application/octet-stream');
    if (req.method === 'GET' && url.pathname.startsWith('/aetherglass/')) return sendFile(res, safeAsset(AETHERGLASS_ROOT, url.pathname.slice('/aetherglass/'.length)), /\.css$/i.test(url.pathname) ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'no-cache');
    if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, name: 'AXM Pong · Cross', version: room.version, room: room.room, playMode: room.playMode, minPlayers: 3, maxPlayers: 4, seatCount: room.seatCount, arenas: ARENAS.map(arena => arena.id), aetherglass: fs.existsSync(AETHERGLASS_ROOT) });
    if (req.method === 'GET' && url.pathname === '/api/host/bootstrap') {
      if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: 'host-bootstrap-loopback-only' });
      return sendJson(res, 200, hostBootstrap());
    }
    if (req.method === 'GET' && url.pathname === '/state') return sendJson(res, 200, publicState());
    if (req.method === 'GET' && url.pathname === '/api/adapter-observation') {
      const result = SeatInterface.buildAdapterObservation(room, {
        roomCode: url.searchParams.get('room'),
        seatId: url.searchParams.get('seat'),
        token: bearer(req)
      }, { bindings: seatBindings, publicState, sessionId: SESSION_ID });
      return sendJson(res, result.statusCode || (result.ok ? 200 : 400), result);
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
      res.write('retry: 1000\n\n');
      streams.add(res);
      req.on('close', () => streams.delete(res));
      return;
    }
    if (TEST_MODE && req.method === 'POST' && url.pathname === '/test/set') {
      const patch = await readJson(req);
      if (patch.ball) Object.assign(room.balls[0], patch.ball);
      if (patch.mission) Object.assign(room.mission, patch.mission);
      if (patch.lives) Object.keys(patch.lives).forEach(id => { if (id in room.lives) room.lives[id] = Number(patch.lives[id]); });
      if (patch.phase) room.phase = patch.phase;
      return sendJson(res, 200, { ok: true, state: publicState() });
    }
    if (req.method === 'POST' && url.pathname === '/api/input') {
      const packet = await readJson(req);
      const result = SeatInterface.routeSemanticInput(room, packet, { bindings: seatBindings, requireToken: true, usePower });
      return sendJson(res, result.statusCode || (result.ok ? 200 : 400), result);
    }
    if (req.method === 'POST' && url.pathname === '/input') {
      const requested = url.searchParams.get('player');
      const player = /^p[1-4]$/.test(requested || '') ? requested : 'p1';
      const input = await readJson(req);
      const result = SeatInterface.routeSemanticInput(room, {
        intent: { axis: (input.right ? 1 : 0) - (input.left ? 1 : 0), power: input.power === true }
      }, { playerId: player, requireToken: false, usePower });
      return sendJson(res, result.statusCode || (result.ok ? 200 : 400), result.ok ? result : Object.assign({ error: result.reason }, result));
    }
    if (req.method === 'POST' && url.pathname === '/arena') {
      const input = await readJson(req);
      if (room.phase === 'running' || room.phase === 'paused') return sendJson(res, 409, { ok: false, error: 'finish or reset the active match before changing arena' });
      const arena = setArena(input.arenaId);
      return sendJson(res, 200, { ok: true, arena, state: publicState() });
    }
    if (req.method === 'POST' && (url.pathname === '/start' || url.pathname === '/reset')) { startMatch(); return sendJson(res, 200, { ok: true, state: publicState() }); }
    if (req.method === 'POST' && url.pathname === '/pause') {
      if (room.phase === 'running') { room.phase = 'paused'; announce('PAUSED'); }
      else if (room.phase === 'paused') { room.phase = 'running'; announce('CROSS LIVE'); }
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
  console.log('AXM Pong · Cross ' + room.version + ' · ' + room.playMode + ' · ' + room.seatCount + ' seats');
  console.log('Local: http://127.0.0.1:' + PORT + '/?room=AXM1&player=screen');
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
