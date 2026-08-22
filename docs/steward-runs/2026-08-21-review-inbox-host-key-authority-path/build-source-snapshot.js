#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/steward-runs/2026-08-21-model-shadow-transition-history-reconciliation-review-bridge/SOURCE_SNAPSHOT.json'), 'utf8')).sources.map(item => item.path);
const current = [
  'shared/operations/operations-api.js',
  'shared/operations/REVIEW_AUTHORITY.md',
  'shared/operations/authenticated-review-envelope.schema.json',
  'shared/operations/review-authority-api-selftest.js',
  'shared/operations/review-authority-service-selftest.js',
  'shared/operations/review-authority-service.js',
  'shared/operations/review-authority-view.schema.json',
  'shared/operations/review-trust-policy.example.json',
  'shared/operations/review-trust-policy.schema.json',
  'tools/review-inbox/README.md',
  'tools/review-inbox/app.js',
  'tools/review-inbox/discovery-seam-review.js',
  'tools/review-inbox/index.html',
  'tools/review-inbox/manifest.json',
  'tools/review-inbox/module.contract.json',
  'tools/review-inbox/review-inbox.css',
  'tools/review-inbox/selftest.js'
];
const sources = Array.from(new Set(prior.concat(current))).sort();
const items = sources.map(file => {
  const normalized = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');
  return { path:file, sha256:'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') };
});
const output = { schema:'axm.source-snapshot/v1', status:'TEST', normalization:'UTF-8 text with CRLF and CR normalized to LF before SHA-256', sources:items };
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote source snapshot for ' + items.length + ' normalized inputs');
