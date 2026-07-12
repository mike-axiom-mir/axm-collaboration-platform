#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.AXM_FOREST_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8795);
const CLIENT_FILE = path.join(__dirname, 'briarfront-client.html');
const SOURCE_FILE = path.join(__dirname, 'grafthold-source.html');
const WORLD_SIZE = 120;
const DIVIDER_X = WORLD_SIZE / 2, DIVIDER_HALF = 4.5, BRIDGES = [{ z: 34, half: 5.5 }, { z: 86, half: 5.5 }];
const TEAM_TARGET = 30;
const ARROW_COOLDOWN_MS = 1000 / 1.2;
const MAX_ARROWS = 12, ARROW_RELOAD_MS = 1500;
const WAVE_MS = 60000;
const GIFT_MS = 5 * 60 * 1000;
const TICK_MS = 1000 / 30;
const STREAM_MS = 40;
const COLORS = ['#63d68a', '#58c8ff', '#e8b54a', '#e86fb5'];

function cleanName(value, fallback) {
  const text = String(value || '').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 20);
  return text || fallback;
}
function loadSeats() {
  let raw = [];
  try { raw = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]'); } catch (e) {}
  if (!raw.length) raw = [{ display_name: 'Explorer', type: 'human' }];
  return raw.slice(0, 4).map((seat, i) => ({
    id: 'p' + (i + 1), name: cleanName(seat.display_name, 'Explorer ' + (i + 1)),
    kind: seat.type === 'human' ? 'human' : 'adapter', color: COLORS[i]
  }));
}
function seeded(seed) { let value = seed >>> 0; return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296); }
function makeTrees() {
  const random = seeded(5052026), trees = [];
  for (let i = 0; i < 104; i++) {
    let x, z;
    do { x = 5 + random() * (WORLD_SIZE - 10); z = 5 + random() * (WORLD_SIZE - 10); } while (Math.abs(x - DIVIDER_X) < DIVIDER_HALF + 2 || Math.hypot(x - WORLD_SIZE / 2, z - WORLD_SIZE / 2) < 10);
    trees.push({ id: 't' + i, x: Number(x.toFixed(2)), z: Number(z.toFixed(2)), radius: Number((0.7 + random() * 0.65).toFixed(2)), height: Number((5.5 + random() * 5.5).toFixed(2)), health: 3 });
  }
  return trees;
}
function makeMobs() {
  return [
    { id: 'm1', name: 'ELITE STAG', elite: true, x: 60, z: 34, health: 70, maxHealth: 70, color: '#d866ff' },
    { id: 'm2', name: 'BOAR', elite: false, x: 18, z: 24, health: 20, maxHealth: 20, color: '#d19a62' },
    { id: 'm3', name: 'BOAR', elite: false, x: 38, z: 94, health: 20, maxHealth: 20, color: '#d19a62' },
    { id: 'm4', name: 'WOLF', elite: false, x: 82, z: 24, health: 20, maxHealth: 20, color: '#9aaec2' },
    { id: 'm5', name: 'WOLF', elite: false, x: 101, z: 92, health: 20, maxHealth: 20, color: '#9aaec2' }
  ];
}

const seats = loadSeats();
const players = {}, inputs = {};
seats.forEach((seat, i) => {
  const west = i < 2, lane = i % 2;
  players[seat.id] = { id: seat.id, name: seat.name, kind: seat.kind, color: seat.color, territory: west ? 'west' : 'east', spawnLane: lane, x: west ? 25 : WORLD_SIZE - 25, z: lane ? 76 : 44, yaw: west ? Math.PI / 2 : -Math.PI / 2, pitch: 0, wood: 0, woodProgress: 0, alive: true, health: 100, maxHealth: 100, ammo: MAX_ARROWS, lastReloadAt: Date.now(), abilityReadyAt: 0, kills: 0, deaths: 0, respawnAt: 0, respawnHealth: 0, lastFireAt: 0, lastBuyAt: 0, actionUntil: 0 };
  inputs[seat.id] = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, updatedAt: 0 };
});
const world = { game_id: '005-briarfront', version: '0.6-bow-experiment', phase: 'running', mode: '2v2-bow', size: WORLD_SIZE, divider: { x: DIVIDER_X, halfWidth: DIVIDER_HALF, bridges: BRIDGES }, woodTarget: TEAM_TARGET, teamScore: { west: 0, east: 0 }, combatScore: { west: 0, east: 0 }, healthJar: { west: 550, east: 550 }, waveQueue: { west: [], east: [] }, waveEndsAt: Date.now() + WAVE_MS, nextMob: 100, gifts: [], nextGift: 1, giftEndsAt: Date.now() + GIFT_MS, winner: null, age: 0, trees: makeTrees(), mobs: makeMobs(), arrows: [], nextArrow: 1, players, event: 'WEST 2v2 EAST · SHARED HEALTH JARS 550', eventAt: Date.now(), chopped: 0 };
const streams = new Set();
let lastTick = Date.now();

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function wrapAngle(value) { while (value > Math.PI) value -= Math.PI * 2; while (value < -Math.PI) value += Math.PI * 2; return value; }
function announce(text) { world.event = text; world.eventAt = Date.now(); }
function chop(player) {
  if (world.phase !== 'running') return;
  let target = null, score = Infinity;
  for (const tree of world.trees) {
    const dx = tree.x - player.x, dz = tree.z - player.z, distance = Math.hypot(dx, dz);
    if (distance > 5.2) continue;
    const angle = Math.abs(wrapAngle(Math.atan2(dx, dz) - player.yaw));
    const aimScore = distance + angle * 6;
    if (angle < 0.6 && aimScore < score) { target = tree; score = aimScore; }
  }
  player.actionUntil = Date.now() + 240;
  if (!target) { announce(player.name + ' SWUNG AT THE MIST'); return; }
  target.health -= 1;
  if (target.health <= 0) {
    world.trees = world.trees.filter(tree => tree.id !== target.id); player.wood += 3; world.teamScore[player.territory] += 3; world.chopped += 1;
    announce(player.name + ' FELLED A TREE · +3 WOOD');
  } else announce(player.name + ' CHOPPED A TREE · ' + target.health + ' HITS LEFT');
}
function respawn(player) {
  player.alive = true; player.health = player.respawnHealth; player.respawnHealth = 0; player.respawnAt = 0; player.x = player.territory === 'west' ? 25 : WORLD_SIZE - 25; player.z = player.spawnLane ? 76 : 44; player.yaw = player.territory === 'west' ? Math.PI / 2 : -Math.PI / 2; player.pitch = 0;
}
function fireArrow(player, now, special) {
  const piercing = !!special;
  if (world.phase !== 'running' || !player.alive || now - player.lastFireAt < ARROW_COOLDOWN_MS) return false;
  if (piercing && (now < player.abilityReadyAt || player.ammo < 4)) return false;
  const cost = piercing ? 4 : 1;
  if (player.ammo < cost) return false;
  if (player.ammo === MAX_ARROWS) player.lastReloadAt = now; player.ammo -= cost; player.lastFireAt = now; player.actionUntil = now + 180;
  if (piercing) player.abilityReadyAt = now + 10000;
  const speed = piercing ? 76 : 38, critical = Math.random() < 0.2, damage = (critical ? 20 : 10) * (piercing ? 1.5 : 1);
  world.arrows.push({ id: 'a' + world.nextArrow++, owner: player.id, team: player.territory, x: player.x + Math.sin(player.yaw) * 1.5, z: player.z + Math.cos(player.yaw) * 1.5, vx: Math.sin(player.yaw) * speed, vz: Math.cos(player.yaw) * speed, damage, critical, piercing, hitIds: [], bornAt: now });
  announce(player.name + (piercing ? ' FIRED BODY-PIERCING SHOT' : ' FIRED')); return true;
}
function buyMob(player, kind, now) {
  if (world.phase !== 'running' || !player.alive || !['small', 'big'].includes(kind)) return false;
  const cost = kind === 'big' ? 25 : 5, pool = world.teamScore[player.territory];
  if (pool < cost) return false;
  world.teamScore[player.territory] -= cost; world.waveQueue[player.territory].push({ kind, buyer: player.id }); player.lastBuyAt = now;
  announce(player.name + ' QUEUED ' + (kind === 'big' ? 'BIG 70HP' : 'SMALL 20HP') + ' MOB'); return true;
}
function spawnWaves(now) {
  ['west', 'east'].forEach(team => {
    const queue = world.waveQueue[team];
    queue.forEach((order, index) => { const big = order.kind === 'big', lane = index % 2, buyer = players[order.buyer]; world.mobs.push({ id: 'm' + world.nextMob++, name: big ? 'BIG ALLY' : 'SMALL ALLY', elite: big, team, buyer: order.buyer, x: team === 'west' ? 12 : WORLD_SIZE - 12, z: lane ? 78 : 42, health: big ? 70 : 20, maxHealth: big ? 70 : 20, color: team === 'west' ? '#63d68a' : '#e86fb5', speed: big ? 1.7 : 2.7, lane }); if (buyer) buyer.actionUntil = now + 250; });
    world.waveQueue[team] = [];
  });
  world.waveEndsAt = now + WAVE_MS; announce('BOTH SIDES RELEASED THEIR WAVE');
}
function spawnGifts(now) {
  Object.keys(players).forEach((id, index) => { const player = players[id], side = index % 2 ? -1 : 1; world.gifts.push({ id: 'g' + world.nextGift++, owner: id, x: clamp(player.x + Math.cos(player.yaw) * 2.2 * side, 1, WORLD_SIZE - 1), z: clamp(player.z - Math.sin(player.yaw) * 2.2 * side, 1, WORLD_SIZE - 1), status: 'sealed', spawnedAt: now }); });
  world.giftEndsAt = now + GIFT_MS; announce('MYSTERY GIFTS DROPPED BESIDE EVERY PLAYER');
}
function updateMobs(dt) {
  for (const mob of world.mobs) {
    if (!mob.team) continue;
    const bridge = BRIDGES[mob.lane % BRIDGES.length], crossed = mob.team === 'west' ? mob.x > DIVIDER_X + DIVIDER_HALF : mob.x < DIVIDER_X - DIVIDER_HALF;
    const targetX = crossed ? (mob.team === 'west' ? WORLD_SIZE - 8 : 8) : DIVIDER_X, targetZ = crossed ? mob.z : bridge.z;
    const dx = targetX - mob.x, dz = targetZ - mob.z, length = Math.max(0.01, Math.hypot(dx, dz));
    if (length > 1) { mob.x += dx / length * mob.speed * dt; mob.z += dz / length * mob.speed * dt; }
  }
}
function updateArrows(dt, now) {
  const survivors = [];
  for (const arrow of world.arrows) {
    arrow.x += arrow.vx * dt; arrow.z += arrow.vz * dt;
    if (now - arrow.bornAt > 2600 || arrow.x < 0 || arrow.z < 0 || arrow.x > WORLD_SIZE || arrow.z > WORLD_SIZE) continue;
    let hitMob = null;
    for (const mob of world.mobs) { if (mob.team === arrow.team || arrow.hitIds.includes(mob.id) || Math.hypot(mob.x - arrow.x, mob.z - arrow.z) >= (mob.elite ? 2 : 1.5)) continue; hitMob = mob; break; }
    const critical = arrow.critical, damage = arrow.damage;
    if (hitMob) {
      hitMob.health -= damage;
      const shooter = players[arrow.owner];
      if (hitMob.health <= 0) { const reward = hitMob.elite ? 7 : 2; world.mobs = world.mobs.filter(mob => mob.id !== hitMob.id); if (shooter) { shooter.wood += reward; world.teamScore[shooter.territory] += reward; } announce((shooter ? shooter.name : 'AN ARROW') + ' DEFEATED ' + hitMob.name + ' · +' + reward + ' WOOD'); }
      else announce((critical ? 'CRITICAL · ' : '') + hitMob.name + ' -' + damage + ' HP · ' + hitMob.health + ' LEFT');
      if (!arrow.piercing) continue;
      arrow.hitIds.push(hitMob.id);
    }
    let hit = null;
    for (const id of Object.keys(players)) { const target = players[id]; if (!target.alive || target.territory === arrow.team || id === arrow.owner || arrow.hitIds.includes(id)) continue; if (Math.hypot(target.x - arrow.x, target.z - arrow.z) < 1.55) { hit = target; break; } }
    if (hit) {
      const shooter = players[arrow.owner]; hit.health = Math.max(0, hit.health - damage);
      if (hit.health <= 0) {
        hit.alive = false; hit.deaths += 1; if (shooter) shooter.kills += 1; world.combatScore[arrow.team] += 1;
        const reserve = world.healthJar[hit.territory], respawnHealth = Math.min(100, reserve); hit.respawnHealth = respawnHealth; hit.respawnAt = respawnHealth > 0 ? now + 2100 : 0; world.healthJar[hit.territory] = reserve - respawnHealth;
        announce((shooter ? shooter.name : arrow.team.toUpperCase()) + ' DOWNED ' + hit.name + (respawnHealth ? ' · JAR -' + respawnHealth : ' · NO RESERVE'));
        const teamPlayers = Object.keys(players).map(id => players[id]).filter(other => other.territory === hit.territory), canReturn = teamPlayers.some(other => other.alive || other.respawnAt > 0);
        if (!canReturn) { world.phase = 'gameover'; world.winner = arrow.team; world.arrows = []; announce(arrow.team.toUpperCase() + ' TEAM WINS · RIVAL JAR EMPTY'); return; }
      }
      else announce((critical ? 'CRITICAL · ' : '') + hit.name + ' -' + damage + ' HP · ' + hit.health + ' LEFT');
      if (!arrow.piercing) continue;
      arrow.hitIds.push(hit.id);
    }
    survivors.push(arrow);
  }
  world.arrows = survivors;
}
function movePlayer(player, input, dt, now) {
  if (player.ammo < MAX_ARROWS && now - player.lastReloadAt >= ARROW_RELOAD_MS) { const restored = Math.floor((now - player.lastReloadAt) / ARROW_RELOAD_MS); player.ammo = Math.min(MAX_ARROWS, player.ammo + restored); player.lastReloadAt += restored * ARROW_RELOAD_MS; }
  else if (player.ammo === MAX_ARROWS) player.lastReloadAt = now;
  if (!player.alive) { if (world.phase === 'running' && player.respawnAt > 0 && now >= player.respawnAt) respawn(player); else return; }
  if (player.kind !== 'human') {
    const seed = Number(player.id.slice(1)), seconds = now / 1000;
    input.lookX = clamp(Math.sin(seconds * 0.47 + seed * 2.1) * 0.48 + Math.sin(seconds * 1.13 + seed) * 0.16, -1, 1); input.lookY = Math.sin(seconds * 0.31 + seed * 1.7) * 0.18;
    input.moveX = Math.sin(seconds * 0.59 + seed * 2.4) * 0.56; input.moveY = 0.38 + Math.sin(seconds * 0.37 + seed) * 0.34;
    const visible = Object.keys(players).map(id => players[id]).filter(other => other.alive && other.territory !== player.territory).map(other => ({ other, distance: Math.hypot(other.x-player.x,other.z-player.z), angle: Math.abs(wrapAngle(Math.atan2(other.x-player.x,other.z-player.z)-player.yaw)) })).filter(view => view.distance < 46 && view.angle < 0.11);
    if (visible.length && Math.random() < 0.14) fireArrow(player, now, now >= player.abilityReadyAt && player.ammo >= 4 && Math.random() < 0.16);
    if (now - player.lastBuyAt > 8500) { if (world.teamScore[player.territory] >= 25 && Math.random() < 0.28) buyMob(player, 'big', now); else if (world.teamScore[player.territory] >= 5) buyMob(player, 'small', now); }
  } else if (now - input.updatedAt > 420) { input.moveX = 0; input.moveY = 0; input.lookX = 0; input.lookY = 0; }
  player.yaw = wrapAngle(player.yaw - input.lookX * 2.35 * dt);
  player.pitch = clamp(player.pitch - input.lookY * 1.7 * dt, -0.62, 0.62);
  const length = Math.min(1, Math.hypot(input.moveX, input.moveY)), speed = 8.4 * length;
  if (length > 0.02) {
    const mx = -input.moveX / Math.max(1, length), my = input.moveY / Math.max(1, length);
    const dx = (Math.cos(player.yaw) * mx + Math.sin(player.yaw) * my) * speed * dt;
    const dz = (-Math.sin(player.yaw) * mx + Math.cos(player.yaw) * my) * speed * dt;
    const nextX = clamp(player.x + dx, 1.5, WORLD_SIZE - 1.5), nextZ = clamp(player.z + dz, 1.5, WORLD_SIZE - 1.5);
    const crossing = Math.abs(nextX - DIVIDER_X) < DIVIDER_HALF, onBridge = BRIDGES.some(bridge => Math.abs(nextZ - bridge.z) <= bridge.half);
    if (!crossing || onBridge) player.x = nextX;
    player.z = nextZ;
  }
  const enemySide = player.territory === 'west' ? player.x > DIVIDER_X + DIVIDER_HALF : player.x < DIVIDER_X - DIVIDER_HALF;
  player.woodProgress += (enemySide ? 2 : 1) * dt;
  if (player.woodProgress >= 1) { const gained = Math.floor(player.woodProgress); player.woodProgress -= gained; player.wood += gained; world.teamScore[player.territory] += gained; }
}
function tick() {
  const now = Date.now(), dt = Math.min(0.06, Math.max(0.001, (now - lastTick) / 1000)); lastTick = now; world.age += dt;
  Object.keys(players).forEach(id => movePlayer(players[id], inputs[id], dt, now));
  if (world.phase === 'running') { updateArrows(dt, now); updateMobs(dt); if (now >= world.waveEndsAt) spawnWaves(now); if (now >= world.giftEndsAt) spawnGifts(now); }
}
function publicState() { const now = Date.now(), publicPlayers = {}; Object.keys(world.players).forEach(id => { const player = world.players[id]; publicPlayers[id] = Object.assign({}, player, { abilityIn: Math.max(0, player.abilityReadyAt - now) }); }); return { game_id: world.game_id, version: world.version, phase: world.phase, mode: world.mode, size: world.size, divider: world.divider, woodTarget: world.woodTarget, teamScore: world.teamScore, combatScore: world.combatScore, healthJar: world.healthJar, waveQueue: world.waveQueue, waveIn: Math.max(0, world.waveEndsAt - now), gifts: world.gifts, giftIn: Math.max(0, world.giftEndsAt - now), winner: world.winner, age: Number(world.age.toFixed(2)), trees: world.trees, mobs: world.mobs, arrows: world.arrows, players: publicPlayers, event: world.event, eventAt: world.eventAt, chopped: world.chopped }; }
function sendJson(res, code, value) { const body = JSON.stringify(value); res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'access-control-allow-origin': '*' }); res.end(body); }
function readJson(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 20000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local.axm');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }); res.end(); return; }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); fs.createReadStream(CLIENT_FILE).pipe(res); return; }
    if (req.method === 'GET' && url.pathname === '/source') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); fs.createReadStream(SOURCE_FILE).pipe(res); return; }
    if (req.method === 'GET' && (url.pathname === '/state' || url.pathname === '/health')) { sendJson(res, 200, publicState()); return; }
    if (req.method === 'GET' && url.pathname === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' }); res.write('retry: 1000\n\n'); streams.add(res); req.on('close', () => streams.delete(res)); return; }
    if (req.method === 'POST' && url.pathname === '/input') {
      const id = /^p[1-4]$/.test(url.searchParams.get('player') || '') ? url.searchParams.get('player') : '';
      if (!players[id] || players[id].kind !== 'human') { sendJson(res, 403, { ok: false, error: 'seat is not a human controller' }); return; }
      const body = await readJson(req), input = inputs[id];
      input.moveX = clamp(Number(body.moveX) || 0, -1, 1); input.moveY = clamp(Number(body.moveY) || 0, -1, 1); input.lookX = clamp(Number(body.lookX) || 0, -1, 1); input.lookY = clamp(Number(body.lookY) || 0, -1, 1); input.updatedAt = Date.now();
      if (body.fire) fireArrow(players[id], Date.now(), !!body.special);
      if (body.buy) buyMob(players[id], String(body.buy), Date.now());
      sendJson(res, 200, { ok: true }); return;
    }
    sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (error) { sendJson(res, 400, { ok: false, error: error.message }); }
});

const physicsLoop = setInterval(tick, TICK_MS);
const streamLoop = setInterval(() => { const data = 'data: ' + JSON.stringify(publicState()) + '\n\n'; for (const stream of streams) { try { stream.write(data); } catch (e) { streams.delete(stream); } } }, STREAM_MS);
server.listen(PORT, HOST, () => { console.log('Briarfront ' + world.version + ' · shared forest experiment'); console.log('Local: http://127.0.0.1:' + PORT + '/'); });
function shutdown() { clearInterval(physicsLoop); clearInterval(streamLoop); for (const stream of streams) { try { stream.end(); } catch (e) {} } server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 500).unref(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
