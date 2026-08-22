#!/usr/bin/env node
'use strict';

const http = require('node:http');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const serverFile = path.resolve(__dirname, '..', 'runtime', 'neon-pong-duet-server.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function evidenceRoster() {
  return [
    { seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
    { seat_id: 'seat_2', display_name: 'Nova', type: 'human' }
  ];
}

async function startOrigin(port) {
  const child = spawn(process.execPath, [serverFile], {
    env: {
      ...process.env,
      PORT: String(port),
      AXM_ROBO_PONG_HOST: '127.0.0.1',
      AXM_PLAYERS_JSON: JSON.stringify(evidenceRoster()),
      AXM_SESSION_ID: 'robo-pong-disconnect-evidence-session',
      AXM_PONG_COUNTDOWN_MS: '80'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let stderr = '';
  child.stdout.on('data', () => {});
  child.stderr.on('data', chunk => { stderr += chunk; });
  const origin = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error('Robo-Pong origin exited early: ' + stderr.trim());
    try {
      const response = await fetch(origin + '/health');
      if (response.ok) return { child, origin };
    } catch (_) {}
    await wait(50);
  }
  child.kill('SIGTERM');
  throw new Error('Robo-Pong origin did not become ready: ' + stderr.trim());
}

async function stopOrigin(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), wait(1400)]);
}

function createFaultProxy(origin) {
  let offline = false;
  const active = new Set();
  const target = new URL(origin);
  const server = http.createServer((request, response) => {
    if (offline) {
      request.socket.destroy();
      return;
    }
    const upstream = http.request({
      hostname: target.hostname,
      port: target.port,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: target.host }
    });
    const tunnel = { response, upstream, upstreamResponse: null };
    active.add(tunnel);
    const forget = () => active.delete(tunnel);
    upstream.on('response', upstreamResponse => {
      tunnel.upstreamResponse = upstreamResponse;
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
      upstreamResponse.on('close', forget);
      upstreamResponse.on('end', forget);
    });
    upstream.on('error', () => { response.destroy(); forget(); });
    response.on('close', forget);
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });

  async function listen() {
    if (!server.listening) await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return server.address();
  }

  function drop() {
    offline = true;
    for (const tunnel of active) {
      tunnel.upstream.destroy();
      tunnel.upstreamResponse?.destroy();
      tunnel.response.destroy();
    }
    active.clear();
  }

  function restore() { offline = false; }

  async function close() {
    drop();
    if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }

  return { close, drop, isOffline: () => offline, listen, restore };
}

async function createEvidenceHarness(options = {}) {
  const preferredPort = Number(options.originPort) || 23240 + Math.floor(Math.random() * 1000);
  let originRuntime = null;
  let lastError = null;
  for (let offset = 0; offset < 6 && !originRuntime; offset += 1) {
    try { originRuntime = await startOrigin(preferredPort + offset); }
    catch (error) { lastError = error; }
  }
  if (!originRuntime) throw lastError || new Error('unable to start Robo-Pong origin');
  const proxy = createFaultProxy(originRuntime.origin);
  try {
    const address = await proxy.listen();
    let closed = false;
    return {
      drop: proxy.drop,
      isOffline: proxy.isOffline,
      origin: originRuntime.origin,
      restore: proxy.restore,
      url: 'http://127.0.0.1:' + address.port,
      async close() {
        if (closed) return;
        closed = true;
        await proxy.close();
        await stopOrigin(originRuntime.child);
      }
    };
  } catch (error) {
    await stopOrigin(originRuntime.child);
    throw error;
  }
}

async function runCli() {
  const harness = await createEvidenceHarness();
  process.stdout.write(JSON.stringify({ event: 'ready', url: harness.url, origin: harness.origin }) + '\n');
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let shuttingDown = false;
  async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    input.close();
    try { await harness.close(); }
    catch (error) { process.stderr.write(error.stack + '\n'); code = 1; }
    process.exit(code);
  }
  input.on('line', line => {
    const command = String(line).trim().toLowerCase();
    if (!command) return;
    if (command === 'shutdown') return void shutdown(0);
    if (command === 'offline') harness.drop();
    else if (command === 'online') harness.restore();
    else {
      process.stdout.write(JSON.stringify({ event: 'error', command, error: 'unknown-command' }) + '\n');
      return;
    }
    process.stdout.write(JSON.stringify({ event: 'transport', command, offline: harness.isOffline() }) + '\n');
  });
  input.on('close', () => { if (!shuttingDown) void shutdown(0); });
  process.on('SIGINT', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));
}

if (require.main === module) runCli().catch(error => {
  process.stderr.write(error.stack + '\n');
  process.exit(1);
});

module.exports = { createEvidenceHarness, createFaultProxy, evidenceRoster };
