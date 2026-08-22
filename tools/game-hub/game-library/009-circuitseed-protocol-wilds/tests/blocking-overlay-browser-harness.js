'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const world = require('../data/world.json');
const { createHttpServer, createRuntime, processPulses } = require('../server/server');

const TEMP_PREFIX = 'circuitseed-overlay-browser-';

function evidencePlayers() {
  return [1, 2].map(slot => ({
    seat_id: 'seat_' + slot,
    slot,
    type: 'human',
    display_name: 'Overlay Evidence Tester ' + slot,
    adapter_id: null,
    ready: true
  }));
}

function assertOwnedTempRoot(root) {
  const resolved = path.resolve(root);
  const tempRoot = fs.realpathSync(os.tmpdir());
  const relative = path.relative(tempRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('evidence-root-outside-os-temp');
  if (!path.basename(resolved).startsWith(TEMP_PREFIX)) throw new Error('evidence-root-prefix-mismatch');
  return resolved;
}

function removeOwnedTempRoot(root) {
  const resolved = assertOwnedTempRoot(root);
  if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
}

function createEvidenceHarness(options = {}) {
  const ownsDataRoot = !options.dataRoot;
  const dataRoot = options.dataRoot || fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  if (ownsDataRoot) assertOwnedTempRoot(dataRoot);
  const runtime = createRuntime({ dataRoot, hubPlayers: evidencePlayers() });
  const app = createHttpServer(runtime);
  let closed = false;

  function runningSession() {
    const session = runtime.sessionManager.getRunning();
    if (!session) throw new Error('evidence-session-not-running');
    return session;
  }

  function state() {
    const session = runtime.sessionManager.getRunning();
    if (!session) return { session: 'waiting', missionId: null, encounterId: null, discoveries: [] };
    const actor = session.actors.seat_1;
    const profile = runtime.profileStore.get(actor.profileId);
    return {
      session: session.status,
      missionId: runtime.missionSystem.current(session)?.id || null,
      encounterId: session.encounter?.id || null,
      encounterStatus: session.encounter?.status || null,
      discoveries: profile.discoveries.map(item => item.id || item),
      occupiedSeats: Object.values(session.actors).filter(item => item.occupied).length
    };
  }

  function stage(command) {
    const session = runningSession();
    const actor = session.actors.seat_1;
    if (command === 'starter') {
      session.encounter = null;
      session.worldRuntime.story.stageIndex = 1;
      session.missionProgress = null;
      runtime.missionSystem.ensureProgress(session);
      session.events.push({ type: 'test-evidence-stage', state: 'starter-choice' });
      return state();
    }
    if (command === 'discovery') {
      session.encounter = null;
      const profile = runtime.profileStore.get(actor.profileId);
      const known = new Set(profile.discoveries.map(item => item.id || item));
      const point = world.points.find(item => item.kind === 'memory-echo' && !known.has(item.id));
      if (!point) throw new Error('no-undiscovered-memory-echo');
      actor.position = { x: point.x, y: point.y };
      actor.currentRegionId = point.regionId;
      actor.pendingPulses.scan = true;
      processPulses(runtime, session, actor);
      return { ...state(), pointId: point.id };
    }
    if (command === 'encounter') {
      session.encounter = null;
      runtime.encounterSystem.start(session, 'corewild-breach');
      return state();
    }
    if (command === 'clear-encounter') {
      session.encounter = null;
      return state();
    }
    if (command === 'state') return state();
    throw new Error('unknown-evidence-command');
  }

  async function listen(port = 0, host = '127.0.0.1') {
    if (app.server.listening) return app.server.address();
    await new Promise((resolve, reject) => {
      app.server.once('error', reject);
      app.server.listen(port, host, resolve);
    });
    return app.server.address();
  }

  async function close() {
    if (closed) return;
    closed = true;
    if (app.server.listening) await new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
    if (ownsDataRoot) removeOwnedTempRoot(dataRoot);
  }

  return { app, close, dataRoot, listen, runtime, stage, state };
}

async function runCli() {
  const harness = createEvidenceHarness();
  const address = await harness.listen();
  const url = 'http://127.0.0.1:' + address.port + '/';
  process.stdout.write(JSON.stringify({ event: 'ready', url }) + '\n');
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let shuttingDown = false;

  async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    input.close();
    try { await harness.close(); } catch (error) { process.stderr.write(error.stack + '\n'); code = 1; }
    process.exit(code);
  }

  input.on('line', line => {
    const command = String(line).trim();
    if (!command) return;
    if (command === 'shutdown') return void shutdown(0);
    try {
      process.stdout.write(JSON.stringify({ event: 'stage', command, result: harness.stage(command) }) + '\n');
    } catch (error) {
      process.stdout.write(JSON.stringify({ event: 'error', command, error: error.message }) + '\n');
    }
  });
  input.on('close', () => { if (!shuttingDown) void shutdown(0); });
  process.on('SIGINT', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));
}

if (require.main === module) runCli().catch(error => { process.stderr.write(error.stack + '\n'); process.exit(1); });

module.exports = { TEMP_PREFIX, assertOwnedTempRoot, createEvidenceHarness, evidencePlayers, removeOwnedTempRoot };
