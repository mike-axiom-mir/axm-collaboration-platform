#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const PRIOR = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/steward-runs/2026-08-21-model-shadow-history-checkpoint-retention-ledger/SOURCE_SNAPSHOT.json'), 'utf8')).sources.map(item => item.path);
const CURRENT = [
  'shared/model-shadow-retention-audit-observation-ledger/model-shadow-retention-audit-observation-ledger.js',
  'shared/model-shadow-retention-audit-observation-ledger/manifest.schema.json',
  'shared/model-shadow-retention-audit-observation-ledger/observation.schema.json',
  'shared/model-shadow-retention-audit-observation-ledger/snapshot.schema.json',
  'shared/model-shadow-retention-audit-observation-ledger/module.contract.json',
  'shared/model-shadow-retention-audit-observation-ledger/README.md',
  'shared/model-shadow-retention-audit-observation-ledger/selftest-fixture.js',
  'shared/model-shadow-retention-audit-observation-ledger/selftest-child.js',
  'shared/model-shadow-retention-audit-observation-ledger/selftest.js'
];
const sources = Array.from(new Set(CURRENT.concat(PRIOR))).sort();
function digest(file) {
  const normalized = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}
const output = {
  schema: 'axm.source-snapshot/v1',
  status: 'TEST',
  normalization: 'UTF-8 text with CRLF and CR normalized to LF before SHA-256',
  sources: sources.map(file => ({ path: file, sha256: digest(file) }))
};
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote source snapshot for ' + output.sources.length + ' normalized inputs');
