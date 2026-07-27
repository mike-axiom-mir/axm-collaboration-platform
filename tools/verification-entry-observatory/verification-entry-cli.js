#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/verification-entry-core');

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
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error('Missing value for --' + key);
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write([
      'AXM Verification Entry Observatory',
      '',
      'Usage:',
      '  node verification-entry-cli.js --root /path/to/workshop',
      '  node verification-entry-cli.js --root /path/to/workshop --output current-verification-entry-map.json --browser-output current-verification-entry-map.js --quiet',
      '  node verification-entry-cli.js --root /path/to/workshop --request-module technical-glasses --request-entry selftest.js --request-output request.json --browser-request-output request.js --quiet',
      '',
      'Optional: --ttl-hours 2',
      'No file is written unless an output flag is explicit. Request output requires one module and entry. Nothing is executed.'
    ].join('\n') + '\n');
    return;
  }
  const map = Core.scanWorkshop(args.root || process.cwd(), {
    ttlMs: args['ttl-hours'] === undefined ? undefined : Number(args['ttl-hours']) * 60 * 60 * 1000
  });
  if (args.output) writeText(args.output, JSON.stringify(map, null, 2) + '\n');
  if (args['browser-output']) {
    const safe = JSON.stringify(map, null, 2)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/\//g, '\\u002f');
    writeText(args['browser-output'], "'use strict';\nwindow.AXM_VERIFICATION_ENTRY_MAP = " + safe + ';\n');
  }
  const wantsRequest = Boolean(args['request-output'] || args['browser-request-output']);
  if (wantsRequest && (!args['request-module'] || !args['request-entry'])) {
    throw new Error('request output requires --request-module and --request-entry');
  }
  if ((args['request-module'] || args['request-entry']) && !wantsRequest) {
    throw new Error('request selection requires --request-output or --browser-request-output');
  }
  if (wantsRequest) {
    const request = Core.createRunRequest(map, args['request-module'], args['request-entry']);
    if (args['request-output']) writeText(args['request-output'], JSON.stringify(request, null, 2) + '\n');
    if (args['browser-request-output']) {
      const safeRequest = JSON.stringify(request, null, 2)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/\//g, '\\u002f');
      writeText(args['browser-request-output'], "'use strict';\nwindow.AXM_VERIFICATION_RUN_REQUEST = " + safeRequest + ';\n');
    }
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(map, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Verification entry scan refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
