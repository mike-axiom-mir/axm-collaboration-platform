#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/host-assumption-core');

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
      'AXM Host Assumption Observatory',
      '',
      'Usage:',
      '  node host-assumption-cli.js --root /path/to/workshop',
      '  node host-assumption-cli.js --root /path/to/workshop --output assumptions.json --quiet',
      '  node host-assumption-cli.js --root /path/to/workshop --browser-output assumptions.js --quiet',
      '  node host-assumption-cli.js --root /path/to/workshop --probe-module body-pulse --probe-output probe.json --browser-probe-output probe.js --quiet',
      '',
      'Optional: --ttl-hours 2',
      'No file is written unless an output flag is explicit. Probe output requires --probe-module.'
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
    writeText(args['browser-output'], "'use strict';\nwindow.AXM_HOST_ASSUMPTION_MAP = " + safe + ';\n');
  }
  if ((args['probe-output'] || args['browser-probe-output']) && !args['probe-module']) {
    throw new Error('--probe-output and --browser-probe-output require --probe-module');
  }
  if (args['probe-module'] && !args['probe-output'] && !args['browser-probe-output']) {
    throw new Error('--probe-module requires --probe-output or --browser-probe-output');
  }
  if (args['probe-output'] || args['browser-probe-output']) {
    const request = Core.createProbeRequest(map, args['probe-module']);
    if (args['probe-output']) writeText(args['probe-output'], JSON.stringify(request, null, 2) + '\n');
    if (args['browser-probe-output']) {
      const safeRequest = JSON.stringify(request, null, 2)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/\//g, '\\u002f');
      writeText(args['browser-probe-output'], "'use strict';\nwindow.AXM_ENVIRONMENT_PROBE_REQUEST = " + safeRequest + ';\n');
    }
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(map, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Host assumption scan refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
