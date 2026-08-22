#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'SOURCE_SNAPSHOT.json');
const SOURCES = [
  'AGENTS.md',
  'shared/model-shadow-review-challenge-separation-gate/model-shadow-review-challenge-separation-gate.js',
  'shared/model-shadow-review-challenge-separation-gate/selftest.js',
  'shared/model-shadow-review-challenge-separation-gate/selftest-child.js',
  'shared/model-shadow-review-challenge-separation-gate/selftest-fixture.js',
  'shared/model-shadow-review-challenge-separation-gate/module.contract.json',
  'shared/model-shadow-review-challenge-separation-gate/README.md',
  'shared/model-shadow-review-challenge-separation-gate/model-shadow-review-challenge-separated-witness.schema.json',
  'shared/model-shadow-review-challenge-separation-gate/model-shadow-review-challenge-separated-continuity.schema.json',
  'shared/model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-gate.js',
  'shared/model-shadow-review-challenge-anchor-gate/selftest.js',
  'shared/model-shadow-review-challenge-anchor-gate/selftest-child.js',
  'shared/model-shadow-review-challenge-anchor-gate/module.contract.json',
  'shared/model-shadow-review-challenge-anchor-gate/README.md',
  'shared/model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-policy.schema.json',
  'shared/model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-authorization.schema.json',
  'shared/model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchored-witness.schema.json',
  'shared/model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchored-continuity.schema.json',
  'shared/model-shadow-review-challenge-witness/model-shadow-review-challenge-witness.js',
  'shared/model-shadow-review-challenge-witness/selftest.js',
  'shared/model-shadow-review-challenge-witness/selftest-child.js',
  'shared/model-shadow-review-challenge-witness/module.contract.json',
  'shared/model-shadow-review-challenge-witness/README.md',
  'shared/model-shadow-review-challenge-witness/model-shadow-review-challenge-witness-policy.schema.json',
  'shared/model-shadow-review-challenge-witness/model-shadow-review-challenge-witness-attestation.schema.json',
  'shared/model-shadow-review-challenge-witness/model-shadow-review-challenge-witness.schema.json',
  'shared/model-shadow-review-challenge-witness/model-shadow-review-challenge-witnessed-continuity.schema.json',
  'shared/model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity.js',
  'shared/model-shadow-review-challenge-continuity/module.contract.json',
  'shared/model-shadow-review-challenge-continuity/model-shadow-review-challenge-checkpoint.schema.json',
  'shared/model-shadow-review-challenge-continuity/model-shadow-review-challenge-ledger-snapshot.schema.json',
  'shared/model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger.js',
  'shared/model-shadow-review-challenge-ledger/module.contract.json',
  'shared/model-shadow-review-challenge-ledger/selftest-fixture.js',
  'shared/model-shadow-signed-review-evidence/model-shadow-signed-review-evidence.js',
  'shared/model-shadow-signed-review-evidence/module.contract.json',
  'tools/deterministic-json-core/index.js'
];

function digest(file) {
  const normalized = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}

const snapshot = {
  schema: 'axm.source-snapshot/v1',
  status: 'TEST',
  normalization: 'UTF-8 text with CRLF and CR normalized to LF before SHA-256',
  sources: SOURCES.map(file => ({ path: file, sha256: digest(file) }))
};
fs.writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('PASS wrote source snapshot for ' + snapshot.sources.length + ' normalized inputs');
