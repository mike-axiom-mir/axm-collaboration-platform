#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./axm-workshop-updater-core');
const Service = require('./axm-workshop-updater-service');
const PulseService = require('../pulse/axm-body-pulse-service');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-updater-test-'));
if (!path.resolve(tempRoot).startsWith(path.resolve(os.tmpdir()))) throw new Error('temporary updater test escaped the OS temp directory');
let stored = null;
let now = Date.parse('2026-07-27T06:00:00.000Z');
let calls = [];
let pulseState = null;
const pulse = PulseService.create({ read: () => pulseState, write: value => { pulseState = value; }, measure: () => ({ cpuUsedRatio: 0.1, memoryUsedRatio: 0.1, gpuUsedRatio: 0, gpuTemperatureC: 40, batteryPercent: 100, onBattery: false, temperatureSource: 'deterministic-fixture' }) });
pulse.setMode({ mode: 'ACTIVE', actorId: 'test' });
const archive = Buffer.from('signed fixture workshop archive');
const commitSha = 'b'.repeat(40);
const pair = crypto.generateKeyPairSync('ed25519');
const trustedKey = { keyId: 'fixture-key', algorithm: 'ed25519', publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }) };
const manifest = {
  schema: Core.MANIFEST_SCHEMA,
  releaseId: 'fixture-release',
  version: 'v1.0.0',
  repository: Core.CANONICAL_REPOSITORY,
  commitSha,
  publishedAt: '2026-07-27T06:00:00.000Z',
  minimumUpdaterVersion: Core.VERSION,
  archive: {
    url: 'https://codeload.github.com/' + Core.CANONICAL_REPOSITORY + '/zip/' + commitSha,
    sha256: crypto.createHash('sha256').update(archive).digest('hex'),
    bytes: archive.length
  },
  signatures: []
};
manifest.signatures.push({ keyId: trustedKey.keyId, algorithm: 'ed25519', signature: crypto.sign(null, Buffer.from(Core.canonicalManifest(manifest)), pair.privateKey).toString('base64') });

async function fixtureFetch(url) {
  calls.push(String(url));
  if (String(url).startsWith('https://api.github.com/')) return new Response(JSON.stringify({ sha: commitSha, html_url: 'https://github.com/' + Core.CANONICAL_REPOSITORY + '/commit/' + commitSha, commit: { committer: { date: '2026-07-27T06:00:00.000Z' } } }), { status: 200 });
  if (String(url).startsWith('https://raw.githubusercontent.com/')) return new Response(JSON.stringify(manifest), { status: 200 });
  if (String(url).startsWith('https://codeload.github.com/')) return new Response(archive, { status: 200, headers: { 'content-length': String(archive.length) } });
  return new Response('missing fixture', { status: 404 });
}

(async () => {
  try {
    const untrusted = Service.create({ root: tempRoot, stateRoot: path.join(tempRoot, 'state'), stagingRoot: path.join(tempRoot, 'state', 'workshop-updater', 'staging'), bodyPulse: pulse, read: () => stored, write: value => { stored = value; }, now: () => now, fetchImpl: fixtureFetch, trustedKeys: [] });
    await assert.rejects(() => untrusted.check({ reason: 'EXPLICIT' }), /off/i);
    assert.equal(calls.length, 0, 'OFF must call no network adapter');
    untrusted.configure({ enabled: true, confirmation: Core.ENABLE_CONFIRMATION, actorId: 'test' });
    const held = await untrusted.check({ reason: 'EXPLICIT' });
    assert.equal(held.lastReason, 'update-held-untrusted-release');
    assert.equal(held.candidate, null);
    assert.equal(held.pulseBridge.required, true);
    assert.equal(calls.length, 2, 'untrusted release must not download an archive');

    const trusted = Service.create({ root: tempRoot, stateRoot: path.join(tempRoot, 'state'), stagingRoot: path.join(tempRoot, 'state', 'workshop-updater', 'staging'), bodyPulse: pulse, read: () => stored, write: value => { stored = value; }, now: () => now, fetchImpl: fixtureFetch, trustedKeys: [trustedKey] });
    trusted.configure({ mode: 'AUTO_STAGE', stageConfirmation: Core.STAGE_CONFIRMATION, actorId: 'test' });
    const staged = await trusted.check({ reason: 'EXPLICIT' });
    assert.equal(staged.lastReason, 'verified-update-staged');
    assert.equal(staged.candidate.state, 'STAGED_HELD_FOR_INSTALLER');
    assert.equal(staged.candidate.archive.sha256, manifest.archive.sha256);
    assert.equal(staged.applyAuthority, 'NONE');
    assert.equal(staged.installerState, 'MISSING_GOVERNED_WHOLE_WORKSHOP_INSTALLER');
    assert(fs.existsSync(path.join(tempRoot, staged.candidate.archive.path)));
    assert(fs.existsSync(path.join(tempRoot, staged.candidate.evidencePath)));
    const evidence = JSON.parse(fs.readFileSync(path.join(tempRoot, staged.candidate.evidencePath), 'utf8'));
    assert.equal(evidence.schema, 'axm.workshop-update-staging-evidence/v1');
    assert.equal(evidence.applyAuthority, 'NONE');
    assert.equal(evidence.trust.keyId, trustedKey.keyId);
    assert.equal(calls.length, 5);
    assert.equal(pulse.status().recentReceipts.filter(item => item.moduleId === 'workshop-updater').length, 2);

    const beforeNotDue = calls.length;
    const notDue = await trusted.onBeat({ kind: 'SCHEDULED', beatId: 'beat-1' });
    assert.equal(notDue.started, false);
    assert.equal(notDue.reason, 'updater-not-due');
    assert.equal(calls.length, beforeNotDue);
    trusted.configure({ enabled: false, actorId: 'test' });
    const off = await trusted.onBeat({ kind: 'SCHEDULED', beatId: 'beat-2' });
    assert.equal(off.reason, 'updater-off-zero-network');
    assert.equal(calls.length, beforeNotDue);
    console.log('PASS Workshop Updater service - OFF is zero network, trusted staging is bounded, install remains held');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
