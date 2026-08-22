#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'SOURCE_SNAPSHOT.json');
const PRIOR = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/SOURCE_SNAPSHOT.json'
), 'utf8')).sources.map(item => item.path);
const CURRENT = [
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger.js',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-entry.schema.json',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-manifest.schema.json',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-snapshot.schema.json',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/module.contract.json',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/README.md',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/selftest-fixture.js',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/selftest-child.js',
  'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/selftest.js'
];
const SOURCES = Array.from(new Set(CURRENT.concat(PRIOR))).sort();

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
