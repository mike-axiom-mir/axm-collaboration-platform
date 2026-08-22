'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { createEvidenceHarness, evidencePlayers } = require('./blocking-overlay-browser-harness');

test('browser evidence harness stages production starter, discovery and encounter states', async t => {
  const harness = createEvidenceHarness();
  let closed = false;
  t.after(async () => { if (!closed) await harness.close(); });
  const address = await harness.listen();
  const base = 'http://127.0.0.1:' + address.port;

  let response = await fetch(base + '/health');
  assert.equal(response.status, 200);
  response = await fetch(base + '/api/session/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ players: evidencePlayers(), worldId: 'overlay-evidence-world', seed: 'overlay-evidence-seed' })
  });
  assert.equal(response.status, 201);

  let staged = harness.stage('starter');
  assert.equal(staged.missionId, 'm02-unfinished-need');
  assert.equal(staged.occupiedSeats, 2);

  staged = harness.stage('discovery');
  assert.match(staged.pointId, /^memory-echo-/);
  assert.equal(staged.discoveries.includes(staged.pointId), true);

  staged = harness.stage('encounter');
  assert.equal(staged.encounterId, 'corewild-breach');
  assert.equal(staged.encounterStatus, 'running');

  const dataRoot = harness.dataRoot;
  await harness.close();
  closed = true;
  assert.equal(fs.existsSync(dataRoot), false);
});
