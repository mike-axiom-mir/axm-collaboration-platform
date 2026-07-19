'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRuntime } = require('../server/server');

function tempRoot(prefix = 'circuitseed-test-') { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function remove(root) { fs.rmSync(root, { recursive: true, force: true }); }
function players(count, types = []) {
  return Array.from({ length: count }, (_, index) => ({
    seat_id: 'seat_' + (index + 1), slot: index + 1, type: types[index] || 'human',
    display_name: 'Tester ' + (index + 1), adapter_id: types[index] === 'adapter' ? 'adapter-' + (index + 1) : null, ready: true
  }));
}
function runtimeWithSession(count = 1, types = []) {
  const root = tempRoot();
  const runtime = createRuntime({ dataRoot: root, hubPlayers: players(count, types) });
  const response = runtime.sessionManager.createSession({ players: players(count, types), worldId: 'test-world', seed: 'fixed-test-seed' });
  runtime.missionSystem.ensureProgress(runtime.sessionManager.getRunning());
  return { root, runtime, response, session: runtime.sessionManager.getRunning() };
}

module.exports = { players, remove, runtimeWithSession, tempRoot };
