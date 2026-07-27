#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/lineage-core');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const key = token.slice(2);
    if (key === 'help' || key === 'quiet') {
      result[key] = true;
      continue;
    }
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      throw new Error('Missing value for --' + key);
    }
    result[key] = argv[index + 1];
    index += 1;
  }
  return result;
}

function readBundle(file) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('bundle input must be a regular non-symlink file');
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function writeText(file, body) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, body);
  fs.renameSync(temporary, target);
}

function help() {
  return [
    'AXM Module Lineage Comparator',
    '',
    'Usage:',
    '  node lineage-cli.js --left baseline.module-bundle.json --right candidate.module-bundle.json',
    '  node lineage-cli.js --left baseline.json --right candidate.json --output comparison.json',
    '  node lineage-cli.js --left baseline.json --right candidate.json --browser-output current-comparison.js',
    '',
    'Optional:',
    '  --left-label baseline-name --right-label candidate-name --ttl-hours 2 --quiet',
    '',
    'No files are written unless --output or --browser-output is explicit.'
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(help() + '\n');
    return;
  }
  if (!args.left || !args.right) throw new Error('--left and --right are required');
  const leftPath = path.resolve(args.left);
  const rightPath = path.resolve(args.right);
  const comparison = Core.compareBundles(readBundle(leftPath), readBundle(rightPath), {
    leftLabel: args['left-label'] || path.basename(leftPath),
    rightLabel: args['right-label'] || path.basename(rightPath),
    ttlMs: args['ttl-hours'] === undefined ? undefined : Number(args['ttl-hours']) * 60 * 60 * 1000
  });
  if (args.output) writeText(args.output, JSON.stringify(comparison, null, 2) + '\n');
  if (args['browser-output']) {
    const safe = JSON.stringify(comparison, null, 2).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    writeText(args['browser-output'], "'use strict';\nwindow.AXM_MODULE_LINEAGE_COMPARISON = " + safe + ';\n');
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(comparison, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Lineage comparison refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
