#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const output = path.join(root, 'module-bundle.json');
const files = [];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!entry.isFile() || absolute === output || entry.name.endsWith('.zip')) continue;
    const bytes = fs.readFileSync(absolute);
    files.push({
      path: path.relative(root, absolute).split(path.sep).join('/'),
      encoding: 'base64',
      content: bytes.toString('base64'),
      sha256: sha256(bytes)
    });
  }
}

walk(root);
if (!files.length || files.length > 300) throw new Error('bundle file count must stay between 1 and 300');
const bundle = {
  schema: 'axm.module-bundle/v1',
  requiredSeats: 1,
  files
};
fs.writeFileSync(output, JSON.stringify(bundle, null, 2) + '\n');
process.stdout.write('WROTE module-bundle.json · ' + files.length + ' files\n');
