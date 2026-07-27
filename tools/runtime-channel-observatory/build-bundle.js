#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const output = path.join(root, 'module-bundle.json');
const files = [];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && absolute !== output && !entry.name.endsWith('.zip')) {
      const bytes = fs.readFileSync(absolute);
      files.push({ path: path.relative(root, absolute).split(path.sep).join('/'), encoding: 'base64', content: bytes.toString('base64'), sha256: sha256(bytes) });
    }
  }
}
walk(root);
if (!files.length || files.length > 300) throw new Error('bundle file count must stay between 1 and 300');
fs.writeFileSync(output, JSON.stringify({ schema: 'axm.module-bundle/v1', requiredSeats: 1, files }, null, 2) + '\n');
process.stdout.write('WROTE module-bundle.json · ' + files.length + ' files\n');
