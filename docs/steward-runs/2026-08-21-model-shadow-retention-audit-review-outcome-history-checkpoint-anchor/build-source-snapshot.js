#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const PRIOR = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome-history-checkpoint/SOURCE_SNAPSHOT.json'), 'utf8')).sources.map(item => item.path);
const CURRENT = [
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint/selftest.js',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/README.md',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/anchor-authorization.schema.json',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/anchor-policy.schema.json',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/anchored-audit.schema.json',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/anchored-checkpoint.schema.json',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor.js',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/module.contract.json',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/selftest-child.js',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/selftest.js',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/witness-attestation.schema.json',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/witness-policy.schema.json',
  'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/witness.schema.json'
];
const sources = Array.from(new Set(PRIOR.concat(CURRENT))).sort();
function digest(file) {
  const normalized = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}
const output = {
  schema: 'axm.source-snapshot/v1', status: 'TEST',
  normalization: 'UTF-8 text with CRLF and CR normalized to LF before SHA-256',
  sources: sources.map(file => ({ path: file, sha256: digest(file) }))
};
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote source snapshot for ' + output.sources.length + ' normalized inputs');
