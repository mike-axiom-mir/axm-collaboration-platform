#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const PRIOR = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-request/SOURCE_SNAPSHOT.json'), 'utf8')).sources.map(item => item.path);
const CURRENT = [
  'tools/review-inbox/README.md',
  'tools/review-inbox/app.js',
  'tools/review-inbox/index.html',
  'tools/review-inbox/manifest.json',
  'tools/review-inbox/module.contract.json',
  'tools/review-inbox/review-inbox.css',
  'tools/review-inbox/selftest.js',
  'tools/review-inbox/retention-audit-review-view.js',
  'tools/review-inbox/retention-audit-review-view-selftest.js',
  'tools/deterministic-json-core/index.js',
  'shared/operations/operations-client.js',
  'shared/operations/review-service.js',
  'docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-view/visual-harness.js'
];
const sources = Array.from(new Set(PRIOR.concat(CURRENT))).sort();
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
