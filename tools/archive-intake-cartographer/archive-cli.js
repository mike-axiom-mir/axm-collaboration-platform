#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/archive-map-core');

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

function writeText(file, body) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, body);
  fs.renameSync(temporary, target);
}

function help() {
  return [
    'AXM Archive Intake Cartographer',
    '',
    'Usage:',
    '  node archive-cli.js --root /path/to/archive-supply',
    '  node archive-cli.js --root /path/to/archive-supply --output current-archive-map.json --quiet',
    '  node archive-cli.js --root /path/to/archive-supply --browser-output current-archive-map.js',
    '',
    'The selected root is read recursively for ZIP files only.',
    'Archives are hashed and their central directories are parsed without extraction.',
    'No files are written unless --output or --browser-output is explicit.'
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(help() + '\n');
    return;
  }
  const map = Core.scanSupply(args.root || process.cwd());
  if (args.output) writeText(args.output, JSON.stringify(map, null, 2) + '\n');
  if (args['browser-output']) {
    const safe = JSON.stringify(map, null, 2).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    writeText(args['browser-output'], "'use strict';\nwindow.AXM_ARCHIVE_INTAKE_MAP = " + safe + ';\n');
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(map, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Archive Cartographer refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
