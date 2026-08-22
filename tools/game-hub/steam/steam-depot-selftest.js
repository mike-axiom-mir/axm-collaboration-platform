#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const Depot = require('./build-steam-depot-candidate');

function temporaryRootIsSafe(directory) {
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(directory));
  return path.basename(directory).startsWith('axm-steam-depot-test-')
    && relative !== ''
    && relative !== '..'
    && !relative.startsWith('..' + path.sep)
    && !path.isAbsolute(relative);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

function requestJson(port, route, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const payload = body === null ? null : Buffer.from(JSON.stringify(body));
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: route,
      method,
      timeout: method === 'POST' ? 15000 : 2000,
      headers: payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {}
    }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        try { resolve({ statusCode: response.statusCode, body: JSON.parse(text) }); }
        catch (error) { reject(new Error(`non-JSON response from ${method} ${route}`)); }
      });
    });
    request.once('timeout', () => request.destroy(new Error(`request timed out: ${method} ${route}`)));
    request.once('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function waitFor(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await predicate()) return true; } catch (error) { /* service is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
}

async function stopOwnedProcess(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const result = await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))]);
  if (!result && child.exitCode === null) child.kill('SIGKILL');
}

async function removeTemporaryRoot(directory) {
  if (!temporaryRootIsSafe(directory)) throw new Error('refusing unsafe temporary cleanup: ' + directory);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      fs.rmSync(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code) || attempt === 23) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}

function assertExcluded(candidate) {
  const relativeFiles = Depot.inventoryDirectory(candidate).map(item => item.relative.toLowerCase());
  const forbiddenSegments = ['/docs/', '/evidence/', '/exports/', '/local-data/', '/node_modules/', '/scripts/', '/source/', '/tests/'];
  for (const file of relativeFiles) {
    const wrapped = '/' + file;
    assert.ok(!forbiddenSegments.some(segment => wrapped.includes(segment)), `forbidden depot segment present: ${file}`);
    assert.ok(!/(^|\/)\.env(?:\.|$)/.test(file), `environment file present: ${file}`);
    assert.ok(!file.endsWith('/steam_appid.txt') && file !== 'steam_appid.txt', `Steam development ID file present: ${file}`);
  }
  assert.ok(!relativeFiles.some(file => file.includes('/assets/draft/')), 'Steam draft art must not be inside the depot');
  assert.ok(!relativeFiles.some(file => file.includes('/asset-inbox/')), 'Workshop asset inbox must not be inside the depot');
  assert.ok(!relativeFiles.some(file => file.includes('/002-robo-pong/runtime/processed/')), 'Robo Pong processed source must remain excluded');
  assert.ok(!relativeFiles.some(file => file.includes('/005-briarfront/grafthold-source/')), 'Briarfront preserved source package must remain excluded');
}

function assertRightsEvidence(candidate, games) {
  const accepted = new Set(['ASSET_LICENSES.md', 'ASSET_PROVENANCE.md', 'LICENSE_STATUS.md', 'THIRD_PARTY_SOFTWARE.md']);
  for (const game of games) {
    const directory = path.join(candidate, 'tools', 'game-hub', 'game-library', game);
    assert.ok(fs.existsSync(path.join(directory, 'game.manifest.json')), `game manifest missing: ${game}`);
    assert.ok(fs.readdirSync(directory).some(file => accepted.has(file)), `rights evidence missing: ${game}`);
  }
}

function relativeTree(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      entries.push(path.relative(directory, full).replaceAll('\\', '/') + (entry.isDirectory() ? '/' : ''));
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(directory);
  return entries.sort();
}

async function main() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-steam-depot-test-'));
  assert.ok(temporaryRootIsSafe(temporaryRoot), 'temporary depot root did not satisfy the cleanup boundary');
  const candidate = path.join(temporaryRoot, 'candidate');
  const appData = path.join(temporaryRoot, 'app-data');
  let launcher = null;
  let passMessage = '';
  try {
    const manifest = Depot.buildCandidate({ output: candidate });
    assert.strictEqual(manifest.status, 'TEST');
    assert.strictEqual(manifest.human_approval, false);
    assert.strictEqual(manifest.steam_upload_performed, false);
    assert.strictEqual(manifest.game_count, 19);
    assert.strictEqual(manifest.safety_scan.verdict, 'PASS');
    assert.ok(fs.existsSync(path.join(candidate, 'runtime', 'node', 'node.exe')), 'bundled Windows Node runtime missing');
    assert.ok(fs.existsSync(path.join(candidate, 'tools', 'game-hub', 'steam', 'start-steam-gamehub.js')), 'Steam launcher missing');
    assertExcluded(candidate);
    assertRightsEvidence(candidate, manifest.games);

    const firstVerification = Depot.verifyCandidate(candidate);
    assert.strictEqual(firstVerification.manifest.content_sha256, manifest.content_sha256);
    const shellPort = await freePort();
    let gameHubPort = await freePort();
    while (gameHubPort === shellPort) gameHubPort = await freePort();
    const stagedNode = path.join(candidate, 'runtime', 'node', 'node.exe');
    const stagedLauncher = path.join(candidate, 'tools', 'game-hub', 'steam', 'start-steam-gamehub.js');
    let launchStdout = '';
    let launchStderr = '';
    launcher = childProcess.spawn(stagedNode, [stagedLauncher, '--no-open'], {
      cwd: candidate,
      env: Object.assign({}, process.env, {
        LOCALAPPDATA: appData,
        AXM_STEAM_SHELL_PORT: String(shellPort),
        AXM_GAME_HUB_PORT: String(gameHubPort)
      }),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    launcher.stdout.on('data', chunk => { launchStdout += chunk; });
    launcher.stderr.on('data', chunk => { launchStderr += chunk; });
    assert.ok(await waitFor(async () => {
      const health = await requestJson(shellPort, '/health');
      return health.statusCode === 200 && health.body.name === 'AXM Steam GameHub Shell';
    }), `isolated Steam shell did not become healthy\nstdout: ${launchStdout}\nstderr: ${launchStderr}`);
    assert.ok(await waitFor(async () => {
      const health = await requestJson(gameHubPort, '/health');
      return health.statusCode === 200 && health.body.name === 'AXM Game Hub';
    }), `isolated GameHub did not become healthy\nstdout: ${launchStdout}\nstderr: ${launchStderr}`);

    const assigned = await requestJson(gameHubPort, '/seat/assign', 'POST', { seat_id: 'seat_1', patch: { type: 'human', display_name: 'Depot Selftest' } });
    assert.strictEqual(assigned.statusCode, 200, `seat assignment failed: ${JSON.stringify(assigned.body)}`);
    const ready = await requestJson(gameHubPort, '/seat/ready', 'POST', { seat_id: 'seat_1', ready: true });
    assert.strictEqual(ready.statusCode, 200, `seat readiness failed: ${JSON.stringify(ready.body)}`);
    const started = await requestJson(gameHubPort, '/game/start', 'POST', { game_id: '008-district-party' });
    assert.strictEqual(started.statusCode, 200, `staged game launch failed: ${JSON.stringify(started.body)}`);
    assert.strictEqual(started.body.session.selected_game.game_id, '008-district-party');
    const externalGameRoot = path.join(appData, 'AXM', 'LocalGameHub', 'state', 'games', '008-district-party');
    assert.ok(fs.existsSync(externalGameRoot), `GameHub did not create its per-game data root under external local application data; observed: ${relativeTree(appData).join(', ') || '(empty)'}`);
    const saveCatalog = await requestJson(started.body.runtime_port, '/api/group-saves');
    assert.strictEqual(saveCatalog.statusCode, 200, `staged District Party save catalog failed: ${JSON.stringify(saveCatalog.body)}`);
    assert.strictEqual(saveCatalog.body.slotCount, 9);
    const StagedDistrictParty = require(path.join(candidate, 'tools', 'game-hub', 'game-library', '008-district-party', 'server', 'server.js'));
    const districtStorage = path.join(externalGameRoot, 'district-party');
    const routedRuntime = StagedDistrictParty.createDistrictPartyServer({ storageRoot: districtStorage, port: 0, autoStartLoop: false });
    assert.strictEqual(routedRuntime.sessionManager.groupSaveStore.directory, path.join(districtStorage, 'group-saves'));
    assert.ok(!Depot.inventoryDirectory(candidate).some(item => item.relative.endsWith('/.axm-district-party.pid')), 'District Party wrote its PID inside the depot');
    const ended = await requestJson(gameHubPort, '/game/end', 'POST', { summary: { reason: 'steam-depot-selftest' }, reflect: false });
    assert.strictEqual(ended.statusCode, 200, `staged game shutdown failed: ${JSON.stringify(ended.body)}`);
    assert.ok(fs.existsSync(path.join(appData, 'AXM', 'LocalGameHub', 'state', 'game-night', 'results.json')), 'game result ledger was not written under external local application data');
    await stopOwnedProcess(launcher);
    launcher = null;
    assert.match(launchStdout, /AXM Local GameHub TEST ready/);

    const finalVerification = Depot.verifyCandidate(candidate);
    assert.strictEqual(finalVerification.manifest.content_sha256, manifest.content_sha256, 'staged launch changed depot payload');
    passMessage = `steam depot selftest: PASS · ${manifest.file_count} files · ${manifest.game_count} games · isolated launch · unchanged ${manifest.content_sha256}`;
  } finally {
    await stopOwnedProcess(launcher);
    await removeTemporaryRoot(temporaryRoot);
  }
  console.log(passMessage);
}

main().catch(error => {
  console.error('steam depot selftest: FAIL · ' + error.stack);
  process.exitCode = 1;
});
