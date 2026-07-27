#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const Core = require('./axm-workshop-updater-core');

let now = Date.parse('2026-07-27T06:00:00.000Z');
let state = Core.createState(now);
assert.equal(Core.status(state, now).networkPolicy, 'OFF_ZERO_NETWORK');
assert.equal(Core.status(state, now).applyAuthority, 'NONE');
assert.throws(() => Core.configure(state, { enabled: true }, 'test', now), /confirmation/i);

state = Core.configure(state, { enabled: true, confirmation: Core.ENABLE_CONFIRMATION, intervalMs: 3600000 }, 'test', now);
assert.equal(state.config.enabled, true);
assert.equal(state.config.mode, 'CHECK_ONLY');
assert.equal(state.nextCheckAt, '2026-07-27T07:00:00.000Z');
assert.equal(state.receipts.at(-1).networkEffect, 'NONE');
assert.throws(() => Core.configure(state, { mode: 'AUTO_STAGE' }, 'test', now), /download confirmation/i);
state = Core.configure(state, { mode: 'AUTO_STAGE', stageConfirmation: Core.STAGE_CONFIRMATION }, 'test', now);
assert.equal(state.config.mode, 'AUTO_STAGE');
assert(state.config.stageConsentAt);

const commitSha = 'a'.repeat(40);
const archiveBytes = Buffer.from('fixture archive');
const manifest = {
  schema: Core.MANIFEST_SCHEMA,
  releaseId: 'release-fixture-1',
  version: 'v1.0.0',
  repository: Core.CANONICAL_REPOSITORY,
  commitSha,
  publishedAt: '2026-07-27T06:00:00.000Z',
  minimumUpdaterVersion: Core.VERSION,
  archive: {
    url: 'https://codeload.github.com/' + Core.CANONICAL_REPOSITORY + '/zip/' + commitSha,
    sha256: crypto.createHash('sha256').update(archiveBytes).digest('hex'),
    bytes: archiveBytes.length
  },
  signatures: []
};
const pair = crypto.generateKeyPairSync('ed25519');
manifest.signatures.push({
  keyId: 'fixture-key',
  algorithm: 'ed25519',
  signature: crypto.sign(null, Buffer.from(Core.canonicalManifest(manifest)), pair.privateKey).toString('base64')
});
assert.equal(Core.validateManifest(manifest, { repository: Core.CANONICAL_REPOSITORY, commitSha }).ok, true);
const trust = Core.verifyManifest(manifest, [{ keyId: 'fixture-key', algorithm: 'ed25519', publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }) }]);
assert.equal(trust.trusted, true);
const tampered = JSON.parse(JSON.stringify(manifest));
tampered.version = 'v1.0.1';
assert.equal(Core.verifyManifest(tampered, [{ keyId: 'fixture-key', algorithm: 'ed25519', publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }) }]).trusted, false);
assert.equal(Core.validateManifest(Object.assign({}, manifest, { repository: 'someone/else' }), { repository: Core.CANONICAL_REPOSITORY, commitSha }).ok, false);

state = Core.configure(state, { enabled: false }, 'test', now);
assert.equal(Core.status(state, now).networkPolicy, 'OFF_ZERO_NETWORK');
assert.equal(state.nextCheckAt, null);
console.log('PASS Workshop Updater core - explicit network consent, signed manifest, no apply authority');
