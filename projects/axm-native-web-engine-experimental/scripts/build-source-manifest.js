#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Digest = require('../src/digest');
const Canonical = require('../src/canonical-json');

const root = path.resolve(__dirname, '..');
const outputRelative = 'manifests/source-manifest.json';
const excluded = new Set([outputRelative]);

function walk(dir, prefix, rows) {
  fs.readdirSync(dir, { withFileTypes: true }).sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (entry) {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, relative, rows);
    else if (entry.isFile() && !excluded.has(relative) && !relative.endsWith('.zip')) rows.push(relative);
  });
}

function build() {
  const paths = [];
  walk(root, '', paths);
  const files = paths.map(function (relative) {
    const bytes = fs.readFileSync(path.join(root, relative));
    return { path: relative, bytes: bytes.length, sha256: Digest.sha256Hex(bytes) };
  });
  const material = {
    schema: 'axm.web.source-manifest/v1',
    engineVersion: '0.4.0-experimental.1',
    repositoryCheckpoint: 'fd6ec98a6a98a6666a980c359730ccec57a8cbe9',
    generatedAt: null,
    excludes: [outputRelative, '*.zip'],
    files
  };
  return Object.assign({}, material, { manifestDigest: Digest.canonicalDigest(material) });
}

function main(argv) {
  const expected = Canonical.stringify(build(), 2) + '\n';
  const output = path.join(root, outputRelative);
  if (argv.includes('--write')) {
    fs.writeFileSync(output, expected, 'utf8');
    process.stdout.write('wrote ' + outputRelative + '\n');
    return;
  }
  if (argv.includes('--verify')) {
    const actual = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
    if (actual !== expected) {
      process.stderr.write('source manifest mismatch; run npm run manifest:update after reviewed changes\n');
      process.exitCode = 1;
      return;
    }
    process.stdout.write('source manifest verified\n');
    return;
  }
  throw new Error('choose --write or --verify');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { build, main };
