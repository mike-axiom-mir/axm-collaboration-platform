#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/protocol-version-core');

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
    'AXM Protocol Version Observatory',
    '',
    'Usage:',
    '  node protocol-cli.js --root /path/to/workshop',
    '  node protocol-cli.js --root /path/to/workshop --output current-protocol-surface.json --quiet',
    '  node protocol-cli.js --root /path/to/workshop --browser-output current-protocol-surface.js --quiet',
    '',
    'Optional: --ttl-hours 2',
    'No file is written unless --output or --browser-output is explicit.'
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(help() + '\n');
    return;
  }
  const surface = Core.scanWorkshop(args.root || process.cwd(), {
    ttlMs: args['ttl-hours'] === undefined
      ? undefined
      : Number(args['ttl-hours']) * 60 * 60 * 1000
  });
  if (args.output) writeText(args.output, JSON.stringify(surface, null, 2) + '\n');
  if (args['browser-output']) {
    const safe = JSON.stringify(surface, null, 2)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    writeText(
      args['browser-output'],
      "'use strict';\nwindow.AXM_PROTOCOL_VERSION_SURFACE = " + safe + ';\n'
    );
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(surface, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Protocol version scan refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
