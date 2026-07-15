#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.AXM_ROBO_PONG_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8793);
const TEST_MODE = process.env.AXM_TEST_MODE === '1';
const CLIENT_FILE = path.join(__dirname, 'robo-pong-cross-client.html');
const CONTROLLER_SW_FILE = path.join(__dirname, 'controller-sw.js');
const MANIFEST_FILE = path.join(__dirname, 'manifest.webmanifest');
const CONTROLLER_ICON_FILE = path.join(__dirname, 'controller-icon.svg');
const W = 1000, H = 1000, TICK_MS = 1000 / 60, START_LIVES = 5;
const BALL_R = 17, BASE_SPEED = 535, PADDLE_LEN = 188, SHIELD_LEN = 290, PADDLE_THICK = 28, PADDLE_SPEED = 620;
const EDGE = 66, DIAMOND_R = 112, SPECIAL_COOLDOWN = 7600;
const SIDES = ['bottom', 'top', 'left', 'right'];
const COLORS = ['#35e6ff', '#ff4fc8', '#ffc85a', '#9cff63'];
const SPECIALS = {
  shield: { label: 'MEGA SHIELD', color: '#ff4fc8' },
  warp: { label: 'PADDLE WARP', color: '#ffc85a' },
  slow: { label: 'SLOW FIELD', color: '#76a9ff' },
  jammer: { label: 'RIVAL JAM', color: '#9cff63' },
  curve: { label: 'CHAOS CURVE', color: '#ff7a66' },
  overdrive: { label: 'POWER RETURN', color: '#f5f067' }
};

function cleanName(value, fallback) {
  const text = String(value || '').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 20);
  return text || fallback;
}
function loadSeats() {
  let raw = [];
  try { raw = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]'); } catch (e) {}
  const defaults = ['Mike', 'Nova', 'Gemini', 'Codex'];
  return Array.from({ length: 4 }, (_, i) => {
    const seat = raw[i] || {};
    return { name: cleanName(seat.display_name || process.env['AXM_P' + (i + 1) + '_NAME'], defaults[i]), human: seat.type === 'human' };
  });
}
const seats = loadSeats();
function randomSpecial(previous) {
  const choices = Object.keys(SPECIALS).filter(key => key !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}
function makeSpecial() { return { kind: randomSpecial(), readyAt: 0, activeUntil: 0, activeLabel: '' }; }
function makePaddle(id, side) {
  const horizontal = side === 'bottom' || side === 'top';
  return { id, side, horizontal, x: horizontal ? W / 2 : (side === 'left' ? EDGE : W - EDGE), y: horizontal ? (side === 'top' ? EDGE : H - EDGE) : H / 2, baseLength: PADDLE_LEN, length: PADDLE_LEN, thickness: PADDLE_THICK, axisVelocity: 0, shieldUntil: 0, jammedUntil: 0, attackUntil: 0 };
}
function newRoom() {
  const players = {}, paddles = {}, inputs = {}, lives = {}, specials = {};
  seats.forEach((seat, i) => {
    const id = 'p' + (i + 1), side = SIDES[i];
    players[id] = { id, name: seat.name, side, kind: seat.human ? 'human' : 'adapter', color: COLORS[i], alive: true };
    paddles[id] = makePaddle(id, side); inputs[id] = { left: false, right: false }; lives[id] = START_LIVES; specials[id] = makeSpecial();
  });
  return { room: 'AXM1', version: '0.1.1-cross', phase: 'ready', tick: 0, width: W, height: H, startLives: START_LIVES, players, paddles, inputs, lives, specials,
    diamond: { x: W / 2, y: H / 2, radius: DIAMOND_R, angle: 0, rotationSpeed: 0.17 }, ball: { id: 'core', x: W / 2, y: H / 2, vx: 0, vy: 0, radius: BALL_R, lastTouch: null, loopPair: '', loopHits: 0, serveAt: 0, active: true }, bonusBall: { id: 'chaos', x: W / 2, y: H / 2, vx: 0, vy: 0, radius: BALL_R - 2, lastTouch: null, loopPair: '', loopHits: 0, serveAt: 0, active: true }, thirdBall: { id: 'surge', x: W / 2, y: H / 2, vx: 0, vy: 0, radius: BALL_R - 3, lastTouch: null, loopPair: '', loopHits: 0, serveAt: 0, active: true },
    serveAt: 0, winner: null, event: 'CROSS ARENA READY', eventAt: Date.now(), slowFieldUntil: 0 };
}
const room = newRoom();
const streams = new Set();
let lastTick = Date.now();
function announce(text) { room.event = text; room.eventAt = Date.now(); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function aliveIds() { return Object.keys(room.players).filter(id => room.players[id].alive); }
function activeBalls() { return [room.ball].concat(room.bonusBall.active ? [room.bonusBall] : []).concat(room.thirdBall.active ? [room.thirdBall] : []); }
function resetBall(delay) {
  room.ball.x = W / 2; room.ball.y = H / 2; room.ball.vx = 0; room.ball.vy = 0; room.ball.lastTouch = null; room.ball.loopPair = ''; room.ball.loopHits = 0; room.ball.serveAt = 0;
  const survivors = aliveIds().length;
  room.bonusBall.active = survivors >= 2; room.bonusBall.x = W / 2; room.bonusBall.y = H / 2; room.bonusBall.vx = 0; room.bonusBall.vy = 0; room.bonusBall.lastTouch = null; room.bonusBall.loopPair = ''; room.bonusBall.loopHits = 0; room.bonusBall.serveAt = 0;
  room.thirdBall.active = survivors > 2; room.thirdBall.x = W / 2; room.thirdBall.y = H / 2; room.thirdBall.vx = 0; room.thirdBall.vy = 0; room.thirdBall.lastTouch = null; room.thirdBall.loopPair = ''; room.thirdBall.loopHits = 0; room.thirdBall.serveAt = 0;
  room.serveAt = Date.now() + (delay == null ? 900 : delay);
}
function startMatch() {
  room.phase = 'running'; room.winner = null; room.slowFieldUntil = 0;
  Object.keys(room.players).forEach(id => {
    room.players[id].alive = true; room.lives[id] = START_LIVES; room.paddles[id] = makePaddle(id, room.players[id].side); room.specials[id] = makeSpecial();
  });
  resetBall(950); announce('FOUR-WAY START');
}
function randomServeAngle() {
  let angle;
  do { angle = Math.random() * Math.PI * 2; } while (Math.abs(Math.sin(angle)) < 0.28 || Math.abs(Math.cos(angle)) < 0.28);
  return angle;
}
function launchBall(ball, angle, speedScale) {
  const speed = BASE_SPEED * (speedScale || 1);
  ball.vx = Math.cos(angle) * speed; ball.vy = Math.sin(angle) * speed; ball.serveAt = 0;
}
function serveIfReady(now) {
  if (!room.serveAt || now < room.serveAt || room.phase !== 'running') return;
  const angle = randomServeAngle(); room.serveAt = 0;
  launchBall(room.ball, angle, 1); announce('CHAOS SERVE');
  if (room.bonusBall.active) { launchBall(room.bonusBall, angle + Math.PI * (0.58 + Math.random() * 0.34), 0.94); announce('DOUBLE CHAOS SERVE'); }
  if (room.thirdBall.active) { launchBall(room.thirdBall, angle - Math.PI * (0.54 + Math.random() * 0.38), 0.9); announce('TRIPLE CHAOS SERVE'); }
}
function respawnScoringBall(ball, delay) {
  if (!ball || !ball.active) return;
  ball.x = W / 2; ball.y = H / 2; ball.vx = 0; ball.vy = 0; ball.lastTouch = null; ball.loopPair = ''; ball.loopHits = 0;
  ball.serveAt = Date.now() + (delay == null ? 420 : delay);
}
function serveRespawnedBall(ball, now) {
  if (!ball.active || !ball.serveAt || now < ball.serveAt || room.phase !== 'running') return;
  const scale = ball.id === 'core' ? 1 : ball.id === 'chaos' ? 0.94 : 0.9;
  launchBall(ball, randomServeAngle(), scale);
}
function axisOf(paddle) { return paddle.horizontal ? paddle.x : paddle.y; }
function setAxis(paddle, value) {
  const half = paddle.length / 2;
  if (paddle.horizontal) paddle.x = clamp(value, EDGE + half, W - EDGE - half);
  else paddle.y = clamp(value, EDGE + half, H - EDGE - half);
}
function chooseJammerTarget(player) {
  const choices = aliveIds().filter(id => id !== player);
  return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
}
function targetPoint(player) {
  const side = room.players[player].side;
  if (side === 'bottom') return { x: W / 2, y: H + 120 };
  if (side === 'top') return { x: W / 2, y: -120 };
  if (side === 'left') return { x: -120, y: H / 2 };
  return { x: W + 120, y: H / 2 };
}
function curveAttack(player) {
  const ownSide = room.players[player].side, candidates = activeBalls().filter(ball => !ballApproaching(ownSide)(ball));
  const choices = candidates.length ? candidates : activeBalls();
  choices.sort((a, b) => Math.hypot(a.x - W / 2, a.y - H / 2) - Math.hypot(b.x - W / 2, b.y - H / 2));
  const ball = choices[0]; if (!ball) return null;
  const rival = chooseJammerTarget(player); if (!rival) return null;
  const point = targetPoint(rival), dx = point.x - ball.x, dy = point.y - ball.y, length = Math.max(1, Math.hypot(dx, dy)), currentSpeed = Math.max(BASE_SPEED, Math.hypot(ball.vx, ball.vy)), speed = Math.min(980, currentSpeed * 1.1);
  const aimX = dx / length, aimY = dy / length, currentLength = Math.max(1, Math.hypot(ball.vx, ball.vy)), currentX = ball.vx / currentLength, currentY = ball.vy / currentLength;
  let blendX = currentX * 0.38 + aimX * 0.62, blendY = currentY * 0.38 + aimY * 0.62, blendLength = Math.max(0.01, Math.hypot(blendX, blendY));
  ball.vx = blendX / blendLength * speed; ball.vy = blendY / blendLength * speed; ball.lastTouch = player; ball.loopHits = 0; ball.loopPair = '';
  return rival;
}
function usePower(player, now) {
  if (room.phase !== 'running' || !room.players[player].alive) return false;
  const slot = room.specials[player], paddle = room.paddles[player];
  if (now < slot.readyAt) return false;
  const used = slot.kind; slot.activeLabel = '';
  if (used === 'shield') { paddle.shieldUntil = now + 2700; slot.activeUntil = paddle.shieldUntil; }
  else if (used === 'warp') { const threat = threatBall(paddle); setAxis(paddle, paddle.horizontal ? threat.x : threat.y); slot.activeUntil = now + 650; }
  else if (used === 'slow') { room.slowFieldUntil = Math.max(room.slowFieldUntil, now + 2400); slot.activeUntil = room.slowFieldUntil; }
  else if (used === 'jammer') { const target = chooseJammerTarget(player); if (target) { room.paddles[target].jammedUntil = now + 2200; slot.activeUntil = room.paddles[target].jammedUntil; } }
  else if (used === 'curve') { const target = curveAttack(player); slot.activeUntil = now + 750; if (target) slot.activeLabel = 'CURVING TO ' + room.players[target].name.toUpperCase(); }
  else if (used === 'overdrive') { paddle.attackUntil = now + 5000; slot.activeUntil = paddle.attackUntil; }
  if (!slot.activeLabel || used !== 'curve') slot.activeLabel = SPECIALS[used].label; slot.kind = randomSpecial(used); slot.readyAt = now + SPECIAL_COOLDOWN;
  announce(room.players[player].name + ' · ' + slot.activeLabel); return true;
}
function controlPaddle(player, dt, now) {
  const paddle = room.paddles[player], input = room.inputs[player];
  paddle.length = now < paddle.shieldUntil ? SHIELD_LEN : paddle.baseLength;
  const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0), factor = now < paddle.jammedUntil ? 0.3 : 1;
  paddle.axisVelocity = axis * PADDLE_SPEED * factor;
  setAxis(paddle, axisOf(paddle) + paddle.axisVelocity * dt);
}
function ballApproaching(side) {
  return function(ball){ if (side === 'bottom') return ball.vy > 0; if (side === 'top') return ball.vy < 0; if (side === 'left') return ball.vx < 0; return ball.vx > 0; };
}
function threatBall(paddle) {
  const approaching = activeBalls().filter(ballApproaching(paddle.side));
  const choices = approaching.length ? approaching : activeBalls();
  choices.sort((a, b) => (paddle.horizontal ? Math.abs(a.y - paddle.y) : Math.abs(a.x - paddle.x)) - (paddle.horizontal ? Math.abs(b.y - paddle.y) : Math.abs(b.x - paddle.x)));
  return choices[0] || room.ball;
}
function aiPaddle(player, dt, now) {
  const paddle = room.paddles[player]; paddle.length = now < paddle.shieldUntil ? SHIELD_LEN : paddle.baseLength;
  const threat = threatBall(paddle), target = paddle.horizontal ? threat.x + threat.vx * 0.08 : threat.y + threat.vy * 0.08;
  const error = target - axisOf(paddle), factor = now < paddle.jammedUntil ? 0.3 : 1, step = 475 * factor * dt, before = axisOf(paddle);
  setAxis(paddle, before + clamp(error, -step, step)); paddle.axisVelocity = dt > 0 ? (axisOf(paddle) - before) / dt : 0;
  const distance = paddle.horizontal ? Math.abs(threat.y - paddle.y) : Math.abs(threat.x - paddle.x);
  if (ballApproaching(paddle.side)(threat) && distance < 285 && (Math.abs(error) > paddle.length * 0.38 || Math.hypot(threat.vx, threat.vy) > 760)) usePower(player, now);
}
function bouncePaddle(player, b) {
  const p = room.paddles[player], relative = clamp(((p.horizontal ? b.x - p.x : b.y - p.y) / (p.length / 2)), -1, 1), priorTouch = b.lastTouch;
  const boosted = Date.now() < p.attackUntil, speed = Math.min(boosted ? 1120 : 950, Math.hypot(b.vx, b.vy) + (boosted ? 175 : 23)), tangent = clamp(relative * speed * 0.68 + p.axisVelocity * (boosted ? 0.43 : 0.27), -speed * 0.88, speed * 0.88), direct = Math.sqrt(Math.max(90000, speed * speed - tangent * tangent));
  if (p.side === 'bottom') { b.vx = tangent; b.vy = -direct; b.y = p.y - PADDLE_THICK / 2 - b.radius - 1; }
  else if (p.side === 'top') { b.vx = tangent; b.vy = direct; b.y = p.y + PADDLE_THICK / 2 + b.radius + 1; }
  else if (p.side === 'left') { b.vy = tangent; b.vx = direct; b.x = p.x + PADDLE_THICK / 2 + b.radius + 1; }
  else { b.vy = tangent; b.vx = -direct; b.x = p.x - PADDLE_THICK / 2 - b.radius - 1; }
  let loopBroken = false;
  if (priorTouch && priorTouch !== player) {
    const pair = [priorTouch, player].sort().join(':');
    if (pair === b.loopPair) b.loopHits += 1; else { b.loopPair = pair; b.loopHits = 1; }
    if (b.loopHits >= 6) { const nudge = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.16), cos = Math.cos(nudge), sin = Math.sin(nudge), vx = b.vx, vy = b.vy; b.vx = vx * cos - vy * sin; b.vy = vx * sin + vy * cos; b.loopHits = 0; loopBroken = true; }
  } else if (priorTouch === player) { b.loopHits = 0; b.loopPair = ''; }
  if (boosted) { p.attackUntil = 0; room.specials[player].activeUntil = 0; }
  p.baseLength *= 0.99;
  if (Date.now() >= p.shieldUntil) p.length = p.baseLength;
  b.lastTouch = player; announce(loopBroken ? 'ANTI-LOOP CHAOS' : boosted ? room.players[player].name + ' POWER RETURN' : room.players[player].name + ' SPIN RETURN');
}
function diamondBounce(b) {
  const dx = b.x - W / 2, dy = b.y - H / 2, expanded = DIAMOND_R + b.radius * 1.42, angle = room.diamond.angle, cosA = Math.cos(angle), sinA = Math.sin(angle);
  const lx = dx * cosA + dy * sinA, ly = -dx * sinA + dy * cosA, distance = Math.abs(lx) + Math.abs(ly);
  if (distance >= expanded) return;
  let sx = lx === 0 ? (b.vx > 0 ? -1 : 1) : Math.sign(lx), sy = ly === 0 ? (b.vy > 0 ? -1 : 1) : Math.sign(ly);
  const localNx = sx / Math.SQRT2, localNy = sy / Math.SQRT2, nx = localNx * cosA - localNy * sinA, ny = localNx * sinA + localNy * cosA, dot = b.vx * nx + b.vy * ny;
  const push = (expanded - distance + 2) / Math.SQRT2; b.x += nx * push; b.y += ny * push;
  if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
  const chaos = (Math.random() - 0.5) * 0.46, cosC = Math.cos(chaos), sinC = Math.sin(chaos), vx = b.vx, vy = b.vy;
  b.vx = vx * cosC - vy * sinC; b.vy = vx * sinC + vy * cosC; announce('DIAMOND CHAOS');
}
function resolveBallPair(a, b) {
  if (a.serveAt || b.serveAt) return;
  const dx = b.x - a.x, dy = b.y - a.y, min = a.radius + b.radius, distance = Math.hypot(dx, dy);
  if (!distance || distance >= min) return;
  const nx = dx / distance, ny = dy / distance, relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny, overlap = min - distance + 1;
  a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2;
  if (relative < 0) { const av = a.vx * nx + a.vy * ny, bv = b.vx * nx + b.vy * ny, swapA = bv - av, swapB = av - bv; a.vx += swapA * nx; a.vy += swapA * ny; b.vx += swapB * nx; b.vy += swapB * ny; }
  announce('BALL CLASH');
}
function resolveBallCollisions() { const balls = activeBalls(); for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) resolveBallPair(balls[i], balls[j]); }
function closedWallBounce(b) {
  if (!room.players.p1.alive && b.y + BALL_R > H - 25 && b.vy > 0) { b.y = H - 25 - BALL_R; b.vy = -Math.abs(b.vy); }
  if (!room.players.p2.alive && b.y - BALL_R < 25 && b.vy < 0) { b.y = 25 + BALL_R; b.vy = Math.abs(b.vy); }
  if (!room.players.p3.alive && b.x - BALL_R < 25 && b.vx < 0) { b.x = 25 + BALL_R; b.vx = Math.abs(b.vx); }
  if (!room.players.p4.alive && b.x + BALL_R > W - 25 && b.vx > 0) { b.x = W - 25 - BALL_R; b.vx = -Math.abs(b.vx); }
}
function loseLife(player, scoringBall) {
  if (!room.players[player].alive) return;
  room.lives[player] -= 1;
  if (room.lives[player] <= 0) { room.lives[player] = 0; room.players[player].alive = false; announce(room.players[player].name + ' ELIMINATED'); }
  else announce(room.players[player].name + ' LOST A LIFE');
  const alive = aliveIds();
  if (alive.length <= 2) { room.thirdBall.active = false; room.thirdBall.vx = 0; room.thirdBall.vy = 0; room.thirdBall.serveAt = 0; }
  if (alive.length <= 1) { room.phase = 'gameover'; room.winner = alive[0] || room.ball.lastTouch; room.ball.vx = 0; room.ball.vy = 0; room.bonusBall.active = false; room.thirdBall.active = false; room.serveAt = 0; announce(room.winner ? room.players[room.winner].name + ' WINS' : 'DRAW'); return; }
  respawnScoringBall(scoringBall, 420);
}
function checkPaddles(b, previousX, previousY) {
  const p1 = room.paddles.p1, p2 = room.paddles.p2, p3 = room.paddles.p3, p4 = room.paddles.p4;
  if (room.players.p1.alive && b.vy > 0 && previousY + b.radius <= p1.y - PADDLE_THICK / 2 && b.y + b.radius >= p1.y - PADDLE_THICK / 2 && Math.abs(b.x - p1.x) <= p1.length / 2 + b.radius) bouncePaddle('p1', b);
  else if (room.players.p2.alive && b.vy < 0 && previousY - b.radius >= p2.y + PADDLE_THICK / 2 && b.y - b.radius <= p2.y + PADDLE_THICK / 2 && Math.abs(b.x - p2.x) <= p2.length / 2 + b.radius) bouncePaddle('p2', b);
  else if (room.players.p3.alive && b.vx < 0 && previousX - b.radius >= p3.x + PADDLE_THICK / 2 && b.x - b.radius <= p3.x + PADDLE_THICK / 2 && Math.abs(b.y - p3.y) <= p3.length / 2 + b.radius) bouncePaddle('p3', b);
  else if (room.players.p4.alive && b.vx > 0 && previousX + b.radius <= p4.x - PADDLE_THICK / 2 && b.x + b.radius >= p4.x - PADDLE_THICK / 2 && Math.abs(b.y - p4.y) <= p4.length / 2 + b.radius) bouncePaddle('p4', b);
}
function checkGoals(b) {
  const exits = [];
  if (room.players.p1.alive && b.y > H + BALL_R * 2) exits.push(['p1', b.y - H]);
  if (room.players.p2.alive && b.y < -BALL_R * 2) exits.push(['p2', -b.y]);
  if (room.players.p3.alive && b.x < -BALL_R * 2) exits.push(['p3', -b.x]);
  if (room.players.p4.alive && b.x > W + BALL_R * 2) exits.push(['p4', b.x - W]);
  if (exits.length) { exits.sort((a, c) => c[1] - a[1]); loseLife(exits[0][0], b); return true; }
  return false;
}
function updateOneBall(b, dt, now) {
  serveRespawnedBall(b, now);
  if (!b.active || (!b.vx && !b.vy)) return;
  const previousX = b.x, previousY = b.y, factor = now < room.slowFieldUntil ? 0.55 : 1;
  b.x += b.vx * dt * factor; b.y += b.vy * dt * factor;
  diamondBounce(b); checkPaddles(b, previousX, previousY); closedWallBounce(b); checkGoals(b);
}
function updateBall(dt, now) {
  serveIfReady(now);
  const balls = activeBalls().slice();
  for (const ball of balls) { if (room.serveAt || room.phase !== 'running') break; updateOneBall(ball, dt, now); }
  if (!room.serveAt && room.phase === 'running') resolveBallCollisions();
}
function tick() {
  const now = Date.now(), dt = Math.min(0.04, Math.max(0.001, (now - lastTick) / 1000)); lastTick = now; room.tick += 1; room.diamond.angle = (room.diamond.angle + room.diamond.rotationSpeed * dt) % (Math.PI * 2);
  Object.keys(room.players).forEach(id => { if (!room.players[id].alive) return; if (room.players[id].kind === 'human') controlPaddle(id, dt, now); else aiPaddle(id, dt, now); });
  if (room.phase === 'running') updateBall(dt, now);
}
function publicState() {
  const now = Date.now(), power = {};
  Object.keys(room.specials).forEach(id => { const slot = room.specials[id], info = SPECIALS[slot.kind]; power[id] = { kind: slot.kind, label: info.label, color: info.color, active: now < slot.activeUntil, activeLabel: now < slot.activeUntil ? slot.activeLabel : '', readyIn: Math.max(0, slot.readyAt - now) }; });
  return { room: room.room, version: room.version, phase: room.phase, tick: room.tick, width: W, height: H, startLives: START_LIVES, players: room.players, paddles: room.paddles, lives: room.lives, ball: room.ball, balls: activeBalls(), diamond: room.diamond, winner: room.winner, event: room.event, eventAt: room.eventAt, serveIn: room.serveAt ? Math.max(0, room.serveAt - now) : 0, power, effects: { slowField: now < room.slowFieldUntil, doubleBall: room.bonusBall.active, tripleBall: room.thirdBall.active } };
}
function sendJson(res, code, value) { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }); res.end(JSON.stringify(value)); }
function readJson(req) { return new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 16384) req.destroy(new Error('body too large')); }); req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(new Error('bad json')); } }); req.on('error', reject); }); }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/controller-shell')) { const html = fs.readFileSync(CLIENT_FILE); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, stale-while-revalidate=86400' }); return res.end(html); }
    if (req.method === 'GET' && url.pathname === '/controller-sw.js') { const script = fs.readFileSync(CONTROLLER_SW_FILE); res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(script); }
    if (req.method === 'GET' && url.pathname === '/manifest.webmanifest') { const manifest = fs.readFileSync(MANIFEST_FILE); res.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600' }); return res.end(manifest); }
    if (req.method === 'GET' && url.pathname === '/controller-icon.svg') { const icon = fs.readFileSync(CONTROLLER_ICON_FILE); res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' }); return res.end(icon); }
    if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, name: 'Robo Pong Cross', version: room.version, room: room.room, players: 4 });
    if (req.method === 'GET' && url.pathname === '/state') return sendJson(res, 200, publicState());
    if (req.method === 'GET' && url.pathname === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' }); res.write('retry: 1000\n\n'); streams.add(res); req.on('close', () => streams.delete(res)); return; }
    if (TEST_MODE && req.method === 'POST' && url.pathname === '/test/set') { const patch = await readJson(req); if (patch.ball) Object.assign(room.ball, patch.ball); if (patch.bonusBall) Object.assign(room.bonusBall, patch.bonusBall); if (patch.thirdBall) Object.assign(room.thirdBall, patch.thirdBall); if (patch.lives) Object.keys(patch.lives).forEach(id => { if (id in room.lives) room.lives[id] = Number(patch.lives[id]); }); if (patch.alive) Object.keys(patch.alive).forEach(id => { if (room.players[id]) room.players[id].alive = !!patch.alive[id]; }); if (patch.specials) Object.keys(patch.specials).forEach(id => { if (room.specials[id]) Object.assign(room.specials[id], patch.specials[id]); }); if (patch.paddles) Object.keys(patch.paddles).forEach(id => { if (room.paddles[id]) Object.assign(room.paddles[id], patch.paddles[id]); }); if (patch.phase) room.phase = patch.phase; if (patch.serveAt != null) room.serveAt = Number(patch.serveAt); return sendJson(res, 200, { ok: true, state: publicState() }); }
    if (req.method === 'POST' && url.pathname === '/input') { const requested = url.searchParams.get('player'), player = /^p[1-4]$/.test(requested || '') ? requested : 'p1'; if (room.players[player].kind !== 'human') return sendJson(res, 409, { ok: false, error: player + ' is adapter-controlled' }); const input = await readJson(req); room.inputs[player].left = !!input.left; room.inputs[player].right = !!input.right; if (input.power) usePower(player, Date.now()); return sendJson(res, 200, { ok: true, player }); }
    if (req.method === 'POST' && (url.pathname === '/start' || url.pathname === '/reset')) { startMatch(); return sendJson(res, 200, { ok: true, state: publicState() }); }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    return sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); }
});
const physicsLoop = setInterval(tick, TICK_MS);
const streamLoop = setInterval(() => { if (!streams.size) return; const packet = 'data: ' + JSON.stringify(publicState()) + '\n\n'; for (const stream of streams) { try { stream.write(packet); } catch (e) { streams.delete(stream); } } }, 40);
server.listen(PORT, HOST, () => { console.log('Robo Pong Cross ' + room.version + ' · four-player arena'); console.log('Local: http://127.0.0.1:' + PORT + '/'); });
function shutdown() { clearInterval(physicsLoop); clearInterval(streamLoop); for (const stream of streams) { try { stream.end(); } catch (e) {} } server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 500).unref(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
