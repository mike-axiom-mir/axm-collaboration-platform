#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./workspace-activity-core');

const MAX_INPUT_BYTES = 32 * 1024 * 1024;

function readSnapshot(file) {
  if (file === '-') {
    const body = fs.readFileSync(0);
    if (body.length > MAX_INPUT_BYTES) throw new Error('snapshot JSON exceeds the 32 MiB read limit');
    return JSON.parse(body.toString('utf8'));
  }
  const absolute = path.resolve(file || '');
  if (!file || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error('an existing snapshot JSON file is required');
  const size = fs.statSync(absolute).size;
  if (size > MAX_INPUT_BYTES) throw new Error('snapshot JSON exceeds the 32 MiB read limit');
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function main(argv) {
  if (argv.length < 1 || argv.length > 2) throw new Error('usage: node workspace-activity-cli.js <snapshot.json> [after-snapshot.json]');
  if (argv.length === 2 && argv.includes('-')) throw new Error('standard input can supply only a single snapshot analysis');
  const before = readSnapshot(argv[0]);
  const result = argv[1] ? Core.compareSnapshots(before, readSnapshot(argv[1])) : Core.analyzeSnapshot(before);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(String(error && error.message || error) + '\n');
  process.exitCode = 1;
}
