#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_WORKSHOP_PORT = 8790;
const DEFAULT_GAME_HUB_PORT = 8789;

function requestJson(port, route, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: route, timeout: timeoutMs }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve({ statusCode: response.statusCode, body: JSON.parse(body) }); }
        catch (error) { reject(new Error('health response was not JSON')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('health request timed out')));
    request.on('error', reject);
  });
}

function expectedSteamShellHealth(result) {
  return !!(result && result.statusCode === 200 && result.body && result.body.ok === true && result.body.name === 'AXM Steam GameHub Shell' && result.body.distribution === 'steam');
}

function expectedGameHubHealth(result) {
  return !!(result && result.statusCode === 200 && result.body && result.body.ok === true && result.body.name === 'AXM Game Hub');
}

function gameHubUrl(port) {
  return `http://127.0.0.1:${port}/tools/game-hub/index.html?distribution=steam`;
}

async function probe(port, route, predicate) {
  try { return predicate(await requestJson(port, route)); }
  catch (error) { return false; }
}

async function waitFor(port, route, predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe(port, route, predicate)) return true;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
}

function localStateRoot() {
  const base = process.env.LOCALAPPDATA || process.env.APPDATA;
  return base ? path.join(base, 'AXM', 'LocalGameHub') : path.join(ROOT, 'state', 'steam-gamehub');
}

function spawnNode(entry, environment) {
  return childProcess.spawn(process.execPath, [path.join(ROOT, entry)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, environment),
    stdio: 'ignore',
    windowsHide: true
  });
}

function openBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'rundll32.exe';
    args = ['url.dll,FileProtocolHandler', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }
  const child = childProcess.spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    try { child.kill(); } catch (error) { clearTimeout(timer); resolve(); }
  });
}

function assertLaunchInputs() {
  const required = [
    'tools/game-hub/game-hub-server.js',
    'tools/game-hub/index.html',
    'tools/game-hub/steam/steam-shell-server.js'
  ];
  const missing = required.filter(file => !fs.existsSync(path.join(ROOT, file)));
  if (missing.length) throw new Error('Steam GameHub launch input missing: ' + missing.join(', '));
  return required;
}

async function main(argv = process.argv.slice(2)) {
  assertLaunchInputs();
  const shellPort = Number(process.env.AXM_STEAM_SHELL_PORT || process.env.AXM_WORKSHOP_PORT || DEFAULT_WORKSHOP_PORT);
  const gameHubPort = Number(process.env.AXM_GAME_HUB_PORT || DEFAULT_GAME_HUB_PORT);
  const owned = [];
  let shuttingDown = false;

  async function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of owned.slice().reverse()) await stopChild(child);
    if (Number.isInteger(code)) process.exitCode = code;
  }

  const shellReady = await probe(shellPort, '/health', expectedSteamShellHealth);
  if (!shellReady) {
    owned.push(spawnNode('tools/game-hub/steam/steam-shell-server.js', {
      AXM_STEAM_SHELL_PORT: String(shellPort),
      AXM_GAME_HUB_PORT: String(gameHubPort)
    }));
    if (!await waitFor(shellPort, '/health', expectedSteamShellHealth)) {
      await shutdown(1);
      throw new Error(`AXM Steam GameHub Shell did not become healthy on port ${shellPort}`);
    }
  }

  const gameHubReady = await probe(gameHubPort, '/health', expectedGameHubHealth);
  if (!gameHubReady) {
    owned.push(spawnNode('tools/game-hub/game-hub-server.js', {
      AXM_GAME_HUB_PORT: String(gameHubPort),
      AXM_GAME_IDLE_TIMEOUT_MS: '1800000',
      AXM_WORKSHOP_PORT: String(shellPort),
      AXM_GAME_HUB_DISTRIBUTION: 'steam',
      AXM_GAME_HUB_DATA_ROOT: path.join(localStateRoot(), 'state', 'games'),
      AXM_GAME_HUB_RESULT_DIR: path.join(localStateRoot(), 'state', 'game-night')
    }));
    if (!await waitFor(gameHubPort, '/health', expectedGameHubHealth)) {
      await shutdown(1);
      throw new Error(`AXM GameHub did not become healthy on port ${gameHubPort}`);
    }
  }

  const url = gameHubUrl(shellPort);
  console.log(`AXM Local GameHub TEST ready at ${url}`);
  if (!argv.includes('--no-open') && !argv.includes('--exit-after-ready')) openBrowser(url);
  if (argv.includes('--exit-after-ready')) return shutdown(0);

  const onSignal = () => { shutdown(0).finally(() => process.exit()); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  owned.forEach(child => child.once('exit', code => {
    if (!shuttingDown) shutdown(code === 0 ? 1 : code || 1).finally(() => process.exit());
  }));
  setInterval(() => {}, 60000);
  return { url, ownedProcesses: owned.length };
}

if (require.main === module) {
  main().catch(error => {
    console.error('AXM Local GameHub launch failed: ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = { ROOT, assertLaunchInputs, expectedGameHubHealth, expectedSteamShellHealth, gameHubUrl, localStateRoot, main, requestJson };
