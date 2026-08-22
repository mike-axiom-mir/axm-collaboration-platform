#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'SOURCE_SNAPSHOT.json');
const SOURCES = [
  'AGENTS.md',
  'shared/model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger.js',
  'shared/model-shadow-review-challenge-ledger/selftest.js',
  'shared/model-shadow-review-challenge-ledger/selftest-child.js',
  'shared/model-shadow-review-challenge-ledger/selftest-fixture.js',
  'shared/model-shadow-review-challenge-ledger/module.contract.json',
  'shared/model-shadow-review-challenge-ledger/README.md',
  'shared/model-shadow-review-challenge-ledger/model-shadow-review-challenge-consumption.schema.json',
  'shared/model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger-manifest.schema.json',
  'shared/model-shadow-signed-review-evidence/model-shadow-signed-review-evidence.js',
  'shared/model-shadow-signed-review-evidence/selftest-fixture.js',
  'shared/model-shadow-signed-review-evidence/model-shadow-signed-review-receipt.schema.json',
  'shared/model-shadow-signed-review-evidence/module.contract.json',
  'shared/model-shadow-challenger-gate/model-shadow-challenger-gate.js',
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
