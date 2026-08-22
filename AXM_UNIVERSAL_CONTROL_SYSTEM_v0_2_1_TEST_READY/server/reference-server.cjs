#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { acceptWebSocket } = require('./websocket-lite.cjs');
const { PROTOCOL_VERSION, validateInputFrame } = require('./input-frame-validator.cjs');

const ROOT = path.resolve(__dirname, '..');
const ACTION_DOCUMENT = JSON.parse(fs.readFileSync(path.join(ROOT,'profiles','core-actions.json'),'utf8'));
const ALLOWED_ACTION_IDS = new Set(ACTION_DOCUMENT.actions.map(action=>action.id));
const HOST = process.env.AXM_CONTROL_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8787);
const PAIR_CODE = String(process.env.AXM_PAIR_CODE || crypto.randomInt(100000, 999999));
const MAX_CONTROLLERS = Number(process.env.AXM_MAX_CONTROLLERS || 4);
const STALE_CONTROLLER_MS = Number(process.env.AXM_CONTROLLER_STALE_MS || 3000);
const LEASE_RETENTION_MS = Number(process.env.AXM_CONTROLLER_LEASE_MS || 10 * 60 * 1000);
const screens = new Set();
const controllers = new Map();
const controllerLeases = new Map();
const lastSequence = new Map();
const runtimeStats = {
  startedAt: Date.now(), connections: 0, resumes: 0, disconnects: 0, staleTimeouts: 0,
  rejectedFrames: 0, forwardedFrames: 0, pings: 0, disconnectReasons: {}, events: []
};

function recordServerEvent(type, details = {}) {
  const event = { at: Date.now(), type, ...details };
  runtimeStats.events.push(event);
  while (runtimeStats.events.length > 120) runtimeStats.events.shift();
  return event;
}
function diagnosticsInfo() {
  const now = Date.now();
  return {
    ok: true, version: '0.2.1-test-ready', protocol: PROTOCOL_VERSION, now,
    uptimeMs: now - runtimeStats.startedAt,
    controllers: [...controllers.values()].map(item => ({
      playerId: item.playerId, deviceId: item.deviceId, connectedAt: item.connectedAt,
      lastSeenAt: item.lastSeenAt, lastSeenAgeMs: now - item.lastSeenAt, neutralized: item.neutralized
    })),
    activeScreens: screens.size, retainedLeases: controllerLeases.size,
    totals: {
      connections: runtimeStats.connections, resumes: runtimeStats.resumes, disconnects: runtimeStats.disconnects,
      staleTimeouts: runtimeStats.staleTimeouts, rejectedFrames: runtimeStats.rejectedFrames,
      forwardedFrames: runtimeStats.forwardedFrames, pings: runtimeStats.pings
    },
    disconnectReasons: {...runtimeStats.disconnectReasons},
    recentEvents: runtimeStats.events.slice(-60)
  };
}

const mime = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8','.svg':'image/svg+xml'
};

function json(res, status, value) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});
  res.end(JSON.stringify(value));
}
function safeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'demo/host.html';
  const mapped = clean === 'phone' ? 'demo/phone.html' : clean === 'host' ? 'demo/host.html' : clean;
  const resolved = path.resolve(ROOT, mapped);
  return resolved === ROOT || resolved.startsWith(ROOT + path.sep) ? resolved : null;
}
function serveFile(res, urlPath) {
  const file = safeFile(urlPath);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, {ok:false,error:'not found'});
  res.writeHead(200, {'content-type':mime[path.extname(file)] || 'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
}
function lanAddresses() {
  const addresses = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|wsl|loopback/i.test(name)) continue;
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')) addresses.push(entry.address);
    }
  }
  return addresses;
}
function sessionInfo(req) {
  const hostHeader = req?.headers?.host || `127.0.0.1:${PORT}`;
  return {
    ok:true, protocol:PROTOCOL_VERSION, version:'0.2.1-test-ready', pairCode:PAIR_CODE,
    maxControllers:MAX_CONTROLLERS, staleControllerMs:STALE_CONTROLLER_MS,
    hostUrl:`http://${hostHeader}/host`, phoneUrl:`http://${hostHeader}/phone?code=${PAIR_CODE}`,
    connectedControllers:[...controllers.values()].map(item => ({playerId:item.playerId,deviceId:item.deviceId,lastSeenAt:item.lastSeenAt}))
  };
}
function broadcast(set, message) {
  for (const connection of set) {
    try { connection.sendJSON(message); } catch {}
  }
}
function occupiedPlayers(exceptDeviceId = null) {
  return new Set([...controllers.values()].filter(item => item.deviceId !== exceptDeviceId).map(item => item.playerId));
}
function nextPlayer(requested, exceptDeviceId = null) {
  const occupied = occupiedPlayers(exceptDeviceId);
  if (/^p[1-4]$/.test(requested || '') && !occupied.has(requested)) return requested;
  for (let index=1; index<=MAX_CONTROLLERS; index++) if (!occupied.has(`p${index}`)) return `p${index}`;
  return null;
}
function makeResumeToken() { return crypto.randomBytes(24).toString('base64url'); }
function neutralFrame(controller, context = 'disconnect') {
  return {
    protocol:PROTOCOL_VERSION, type:'input_frame', deviceId:controller.deviceId, playerId:controller.playerId,
    sequence:(lastSequence.get(controller.deviceId) || 0) + 1, clientSentAt:Date.now(), serverReceivedAt:Date.now(),
    serverSentAt:Date.now(), fullState:true, context,
    actions:[
      {id:'MOVE',value:{x:0,y:0}},{id:'AIM',value:{x:0,y:0}},{id:'LOOK',value:{x:0,y:0}},
      {id:'PRIMARY_ACTION',value:0},{id:'SECONDARY_ACTION',value:0},{id:'JUMP',value:0},{id:'DODGE',value:0},
      {id:'ATTACK',value:0},{id:'INTERACT',value:0},{id:'USE_ITEM',value:0},{id:'SPRINT',value:0},
      {id:'CROUCH',value:0},{id:'RELOAD',value:0},{id:'OPEN_MENU',value:0},{id:'PAUSE',value:0},
      {id:'CONFIRM',value:0},{id:'CANCEL',value:0},{id:'ACCELERATE',value:0},{id:'BRAKE',value:0}
    ]
  };
}
function releaseController(controller, reason = 'disconnect') {
  if (!controller || controller.released) return;
  runtimeStats.disconnects += 1;
  runtimeStats.disconnectReasons[reason] = (runtimeStats.disconnectReasons[reason] || 0) + 1;
  if (reason === 'stale-timeout') runtimeStats.staleTimeouts += 1;
  recordServerEvent('controller_disconnected', { deviceId: controller.deviceId, playerId: controller.playerId, reason });
  controller.released = true;
  if (controllers.get(controller.deviceId)?.connection === controller.connection) controllers.delete(controller.deviceId);
  const lease = controllerLeases.get(controller.deviceId);
  if (lease) {
    lease.playerId = controller.playerId;
    lease.expiresAt = Date.now() + LEASE_RETENTION_MS;
  }
  if (!controller.neutralized) {
    controller.neutralized = true;
    broadcast(screens, neutralFrame(controller, reason));
  }
  broadcast(screens,{type:'controller_disconnected',deviceId:controller.deviceId,playerId:controller.playerId,reason});
}

const server = http.createServer((req,res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/session') return json(res,200,sessionInfo(req));
  if (req.method === 'GET' && url.pathname === '/health') return json(res,200,{ok:true,name:'AXM Universal Control Reference',version:'0.2.1-test-ready',protocol:PROTOCOL_VERSION});
  if (req.method === 'GET' && url.pathname === '/diagnostics') return json(res,200,diagnosticsInfo());
  if (req.method === 'GET') return serveFile(res,url.pathname);
  return json(res,405,{ok:false,error:'method not allowed'});
});

server.on('upgrade',(req,socket,head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const role = url.searchParams.get('role');
  const code = url.searchParams.get('code');
  const deviceId = String(url.searchParams.get('deviceId') || crypto.randomUUID()).slice(0,80);
  if (code !== PAIR_CODE) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  const connection = acceptWebSocket(req,socket,head);
  if (!connection) return;

  if (role === 'screen') {
    screens.add(connection);
    connection.sendJSON({type:'welcome',role:'screen',protocol:PROTOCOL_VERSION,pairCode:PAIR_CODE,controllers:sessionInfo(req).connectedControllers});
    recordServerEvent('screen_connected');
    connection.on('message',text => {
      try {
        const message=JSON.parse(text);
        if (message.type === 'ping') { runtimeStats.pings += 1; connection.sendJSON({type:'pong',clientSentAt:message.clientSentAt,serverAt:Date.now()}); }
        if (message.type === 'host_state') broadcast(new Set([...controllers.values()].map(item=>item.connection)),message);
      } catch {}
    });
    connection.on('close',()=>screens.delete(connection));
    return;
  }

  if (role !== 'controller') { connection.close(1008,'controller role unavailable'); return; }

  const suppliedToken = String(url.searchParams.get('resumeToken') || '');
  const lease = controllerLeases.get(deviceId);
  const validResume = Boolean(lease && suppliedToken && timingSafeEqualText(lease.resumeToken, suppliedToken) && lease.expiresAt > Date.now());
  const existing = controllers.get(deviceId);
  if (existing && !validResume) { connection.close(1008,'device already connected'); return; }
  if (!existing && controllers.size >= MAX_CONTROLLERS) { connection.close(1008,'all player slots occupied'); return; }

  let playerId = validResume && !occupiedPlayers(deviceId).has(lease.playerId)
    ? lease.playerId
    : nextPlayer(url.searchParams.get('player'), deviceId);
  if (!playerId) { connection.close(1008,'all player slots occupied'); return; }

  const resumeToken = validResume ? lease.resumeToken : makeResumeToken();
  if (existing) {
    existing.replaced = true;
    existing.connection.close(4001,'replaced by resumed connection');
  }
  lastSequence.delete(deviceId); // a page reload may restart its local sequence counter
  const controller = {connection,deviceId,playerId,resumeToken,connectedAt:Date.now(),lastSeenAt:Date.now(),neutralized:false,released:false,replaced:false};
  controllers.set(deviceId,controller);
  controllerLeases.set(deviceId,{resumeToken,playerId,expiresAt:Date.now()+LEASE_RETENTION_MS});
  runtimeStats.connections += 1;
  if (validResume) runtimeStats.resumes += 1;
  recordServerEvent(validResume ? 'controller_resumed' : 'controller_connected', {deviceId, playerId});
  connection.sendJSON({
    type:'welcome',role:'controller',protocol:PROTOCOL_VERSION,deviceId,playerId,pairCode:PAIR_CODE,
    resumeToken,resumed:validResume,staleControllerMs:STALE_CONTROLLER_MS
  });
  broadcast(screens,{type:validResume?'controller_resumed':'controller_connected',deviceId,playerId});

  connection.on('message',text => {
    controller.lastSeenAt = Date.now();
    let message;
    try { message=JSON.parse(text); } catch { connection.sendJSON({type:'input_rejected',errors:['invalid JSON']}); return; }
    if (message.type === 'ping') { runtimeStats.pings += 1; connection.sendJSON({type:'pong',clientSentAt:message.clientSentAt,serverAt:Date.now()}); return; }
    const errors = validateInputFrame(message,{allowedActionIds:ALLOWED_ACTION_IDS});
    if (errors.length) { runtimeStats.rejectedFrames += 1; recordServerEvent('input_rejected',{deviceId,playerId,sequence:message?.sequence ?? null,errors:errors.slice(0,3)}); connection.sendJSON({type:'input_rejected',sequence:message?.sequence ?? null,errors:errors.slice(0,8)}); return; }
    const previous = lastSequence.get(deviceId);
    if (Number.isInteger(previous) && message.sequence <= previous) {
      runtimeStats.rejectedFrames += 1;
      recordServerEvent('input_rejected',{deviceId,playerId,sequence:message.sequence,errors:['stale or repeated sequence']});
      connection.sendJSON({type:'input_rejected',sequence:message.sequence,errors:['stale or repeated sequence']});
      return;
    }
    lastSequence.set(deviceId,message.sequence);
    const serverReceivedAt = Date.now();
    const forwarded = {...message,deviceId,playerId,serverReceivedAt,serverSentAt:Date.now()};
    runtimeStats.forwardedFrames += 1;
    broadcast(screens,forwarded);
  });

  connection.on('close',() => {
    if (controller.replaced) return;
    releaseController(controller,'disconnect');
  });
});

const watchdog = setInterval(() => {
  const now = Date.now();
  for (const controller of controllers.values()) {
    if (now - controller.lastSeenAt <= STALE_CONTROLLER_MS) continue;
    releaseController(controller,'stale-timeout');
    controller.connection.close(4000,'controller heartbeat timeout');
  }
  for (const [deviceId,lease] of controllerLeases.entries()) {
    if (lease.expiresAt <= now && !controllers.has(deviceId)) controllerLeases.delete(deviceId);
  }
}, Math.max(250, Math.min(1000, Math.floor(STALE_CONTROLLER_MS / 3))));
watchdog.unref?.();

server.listen(PORT,HOST,() => {
  console.log('');
  console.log('AXM UNIVERSAL CONTROL SYSTEM v0.2.1 TEST READY');
  console.log(`Pair code: ${PAIR_CODE}`);
  console.log(`PC host:   http://127.0.0.1:${PORT}/host`);
  for (const address of lanAddresses()) console.log(`Phone:     http://${address}:${PORT}/phone?code=${PAIR_CODE}`);
  console.log('');
});

function timingSafeEqualText(left,right) {
  const a=Buffer.from(String(left)); const b=Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
function shutdown() {
  clearInterval(watchdog);
  broadcast(screens,{type:'server_shutdown'});
  for (const screen of screens) screen.close(1001,'server shutdown');
  for (const item of controllers.values()) item.connection.close(1001,'server shutdown');
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),500).unref();
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
