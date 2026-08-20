#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'BEFORE_FULL_CLOSURE.json');
const BASE_COMMIT = '462e0e222198fb0c03474517157817df9fa6b818';
const IDS = [
  'grounded-growth-challenger-lab',
  'grounded-growth-direction-handoff',
  'grounded-growth-frontier-gate',
  'grounded-growth-human-bridge',
  'grounded-growth-human-bridge-v2',
  'grounded-growth-human-handoff',
  'grounded-growth-human-route-coverage',
  'grounded-growth-knowledge-frontier',
  'grounded-growth-participation-frontier',
  'grounded-growth-phone-evidence-gate',
  'grounded-growth-signal-lineage'
];

function rawSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function sourcePath(id) { return 'shared/' + id + '/' + id + '.js'; }
function contractPath(id) { return 'shared/' + id + '/module.contract.json'; }

function normalizedSource(id) {
  return fs.readFileSync(path.join(ROOT, sourcePath(id)), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
}

function safeFixtures() {
  const shared = { x: 1 };
  return [
    ['sorted-object-keys', { z: 1, a: [true, null, 'x'] }],
    ['unicode-and-escaping', { 'line\nkey': 'snowman ☃ and quote "' }],
    ['negative-zero-normalization', { value: -0 }],
    ['nested-arrays-and-objects', [{ b: 2, a: 1 }, [], { deep: [false, 0, null] }]],
    ['finite-numbers', { negative: -12.5, positive: 42, small: 0.00025 }],
    ['repeated-non-cyclic-reference', { left: shared, right: shared }]
  ];
}

function unsafeBehavior(api) {
  try {
    const text = api.stableStringify({ safe: 1, lost: undefined });
    try {
      const parsed = JSON.parse(text);
      return Object.prototype.hasOwnProperty.call(parsed, 'lost') ? 'UNSAFE_VALUE_PRESERVED' : 'SILENT_FIELD_LOSS';
    } catch (_) {
      return 'INVALID_CANONICAL_TEXT';
    }
  } catch (_) {
    return 'REFUSED_UNSAFE_VALUE';
  }
}

function consumer(id) {
  const source = normalizedSource(id);
  const api = require(path.join(ROOT, sourcePath(id)));
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, contractPath(id)), 'utf8'));
  const safeCanonical = safeFixtures().map(([fixtureId, value]) => {
    const canonical = api.stableStringify(value);
    JSON.parse(canonical);
    return {
      fixtureId,
      canonical,
      canonicalSha256: rawSha256(canonical),
      strictCoreExact: canonical === Core.canonicalJson(value)
    };
  });
  return {
    id,
    path: sourcePath(id),
    sourceSha256: rawSha256(source),
    contractVersion: contract.version,
    dependencies: Array.from(source.matchAll(/require\(['"]\.\.\/(grounded-growth-[^/'"]+)/g)).map((match) => match[1]).sort(),
    unsafeBehavior: unsafeBehavior(api),
    safeCanonical
  };
}

function build() {
  const consumers = IDS.map(consumer);
  const result = {
    schema: 'axm.grounded-growth-json-full-closure-before/v1',
    version: '0.1.0',
    generatedAt: '2026-08-20T04:29:00.000Z',
    status: 'TEST',
    state: 'V03_ELEVEN_CONSUMER_BEFORE_STATE_CAPTURED',
    baseCommit: BASE_COMMIT,
    consumers,
    counts: {
      consumers: consumers.length,
      invalidCanonicalText: consumers.filter((item) => item.unsafeBehavior === 'INVALID_CANONICAL_TEXT').length,
      silentFieldLoss: consumers.filter((item) => item.unsafeBehavior === 'SILENT_FIELD_LOSS').length,
      unsafeValuesAlreadyRefused: consumers.filter((item) => item.unsafeBehavior === 'REFUSED_UNSAFE_VALUE').length,
      safeFixtureComparisons: consumers.reduce((sum, item) => sum + item.safeCanonical.length, 0),
      safeFixtureStrictCoreExact: consumers.reduce((sum, item) => sum + item.safeCanonical.filter((fixture) => fixture.strictCoreExact).length, 0)
    },
    authority: {
      sourceMutation: false,
      migrationStarted: false,
      install: false,
      promotion: false,
      merge: false,
      canon: false
    },
    snapshotDigest: null
  };
  const payload = JSON.parse(Core.canonicalJson(result));
  delete payload.snapshotDigest;
  result.snapshotDigest = rawSha256(Core.canonicalJson(payload));
  return result;
}

function verifyRecorded() {
  const value = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  const payload = JSON.parse(Core.canonicalJson(value));
  const digest = payload.snapshotDigest;
  delete payload.snapshotDigest;
  if (digest !== rawSha256(Core.canonicalJson(payload))) throw new Error('before-state snapshot digest mismatch');
  if (value.baseCommit !== BASE_COMMIT || value.consumers.length !== IDS.length) throw new Error('before-state identity mismatch');
  return value;
}

if (require.main === module) {
  if (process.argv.includes('--write')) {
    const value = build();
    fs.writeFileSync(OUTPUT, JSON.stringify(value, null, 2) + '\n', 'utf8');
  }
  const value = process.argv.includes('--write') ? verifyRecorded() : verifyRecorded();
  process.stdout.write(JSON.stringify({ state: value.state, counts: value.counts, digest: value.snapshotDigest }) + '\n');
}

module.exports = { ROOT, OUTPUT, BASE_COMMIT, IDS, build, verifyRecorded };
