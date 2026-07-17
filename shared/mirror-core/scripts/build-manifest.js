#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'BUILD_MANIFEST.json');

function excluded(relative) {
  return relative === 'BUILD_MANIFEST.json' ||
    relative.startsWith('storage/runtime/') ||
    relative === 'storage/runtime' ||
    relative.endsWith('.zip') ||
    relative.startsWith('node_modules/');
}

function filesIn(dir) {
  const found = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (excluded(relative)) return;
    if (entry.isSymbolicLink()) throw new Error('symbolic links are not allowed in the package: ' + relative);
    if (entry.isDirectory()) found.push.apply(found, filesIn(absolute));
    else if (entry.isFile()) found.push(relative);
  });
  return found;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const files = filesIn(root).sort().map(function (relative) {
  const file = path.join(root, relative);
  return {
    path: relative,
    bytes: fs.statSync(file).size,
    sha256: sha256(file)
  };
});

const manifest = {
  schema: 'axm.mirror.build-manifest/v1',
  build: 'AXM Mirror Core',
  version: '0.1.0-local-prototype',
  status: 'WORKING TEST',
  localOnly: true,
  runtimeInternetRequired: false,
  worldImplemented: false,
  physicsImplemented: false,
  vrImplemented: false,
  realCompanyConnectionImplemented: false,
  foundationInstalled: false,
  foundationCompatibilityHarness: true,
  githubModified: false,
  sourceHeadSha: '33a87549259d8b4a7ce4753ee1fab49e0ee8091d',
  generatedAt: new Date().toISOString(),
  fileCount: files.length,
  exclusions: ['BUILD_MANIFEST.json (self-referential)', 'storage/runtime/** (mutable local state)', '*.zip', 'node_modules/**'],
  files
};

fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
process.stdout.write(JSON.stringify({ status: 'PASS', output: 'BUILD_MANIFEST.json', files: files.length }, null, 2) + '\n');
