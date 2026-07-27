#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/dual-door-core');

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
      'AXM Dual Door Observatory',
      '',
      'Usage:',
      '  node dual-door-cli.js --root /path/to/workshop',
      '  node dual-door-cli.js --root /path/to/workshop --output current-dual-door-map.json --browser-output current-dual-door-map.js --quiet',
      '  node dual-door-cli.js --root /path/to/workshop --request-module evidence-desk --request-door machine --request-action validate --review-output request.json --browser-review-output request.js --quiet',
      '',
      'Optional: --ttl-hours 2',
      'No file is written unless an output flag is explicit. Review output requires one module and door; MACHINE also requires one declared action. Nothing is opened or executed.'
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
    writeText(args['browser-output'], "'use strict';\nwindow.AXM_DUAL_DOOR_MAP = " + safe + ';\n');
  }
  const wantsReview = Boolean(args['review-output'] || args['browser-review-output']);
  const hasReviewSelection = Boolean(args['request-module'] || args['request-door'] || args['request-action']);
  if (wantsReview && (!args['request-module'] || !args['request-door'])) {
    throw new Error('review output requires --request-module and --request-door');
  }
  if (hasReviewSelection && !wantsReview) {
    throw new Error('review selection requires --review-output or --browser-review-output');
  }
  if (wantsReview) {
    const request = Core.createDoorReviewRequest(map, args['request-module'], args['request-door'], {
      actionId: args['request-action']
    });
    if (args['review-output']) writeText(args['review-output'], JSON.stringify(request, null, 2) + '\n');
    if (args['browser-review-output']) {
      const safeRequest = JSON.stringify(request, null, 2)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replace(/\//g, '\\u002f');
      writeText(args['browser-review-output'], "'use strict';\nwindow.AXM_DOOR_REVIEW_REQUEST = " + safeRequest + ';\n');
    }
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(map, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Dual door scan refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
