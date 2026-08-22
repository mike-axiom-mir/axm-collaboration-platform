#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_COMMIT = '309f0e397da6bb4c6a8fc409812f0bfc8c8db2c0';
const PRODUCT_TREE = '5f11c51929a1424cea047313f21ffbb2443fb998';
const EVIDENCE_PREFIX = 'docs/steward-runs/2026-08-21-review-inbox-operation-lease-retirement/';

function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, {
    cwd: ROOT,
    encoding: encoding === null ? null : 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git command failed'));
  return result.stdout;
}

const parent = String(git(['rev-parse', PRODUCT_COMMIT + '^'])).trim();
const tree = String(git(['rev-parse', PRODUCT_COMMIT + '^{tree}'])).trim();
if (tree !== PRODUCT_TREE) throw new Error('product tree identity mismatch');
const changed = String(git(['diff-tree', '--no-commit-id', '--name-only', '-r', parent, PRODUCT_COMMIT]))
  .split(/\r?\n/)
  .filter(Boolean);
if (changed.some(file => /AXM_MIRROR_SHADOW_SPECIALIST/i.test(file))) {
  throw new Error('excluded specialist package lane appeared in the product commit');
}
const files = changed
  .filter(file => !file.startsWith(EVIDENCE_PREFIX))
  .sort()
  .map(file => {
    const bytes = git(['show', PRODUCT_COMMIT + ':' + file], null);
    return {
      path: file.replace(/\\/g, '/'),
      bytes: bytes.length,
      sha256: 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex')
    };
  });
if (!files.length) throw new Error('source snapshot found no product files');
const snapshot = {
  schema: 'axm.normalized-source-snapshot/v1',
  status: 'TEST',
  commit: PRODUCT_COMMIT,
  parent,
  tree,
  exclusions: [EVIDENCE_PREFIX + '**', 'incoming AXM_MIRROR_SHADOW_SPECIALIST packages'],
  files,
  productDigest: null
};
const payload = JSON.parse(Core.canonicalJson(snapshot));
delete payload.productDigest;
snapshot.productDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('PASS source snapshot ' + files.length + ' product files ' + snapshot.productDigest);
