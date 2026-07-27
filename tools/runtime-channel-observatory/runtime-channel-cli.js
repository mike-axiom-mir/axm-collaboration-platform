#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/runtime-channel-core');

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const key = token.slice(2);
    if (key === 'help' || key === 'quiet') output[key] = true;
    else {
      if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error('Missing value for --' + key);
      output[key] = argv[++index];
    }
  }
  return output;
}

function writeText(file, body) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, body);
  fs.renameSync(temporary, target);
}

function browserAssignment(name, value) {
  return "'use strict';\nwindow." + name + ' = ' + JSON.stringify(value, null, 2)
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029').replace(/\//g, '\\u002f') + ';\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write([
      'AXM Runtime Channel Observatory',
      '',
      'Usage:',
      '  node runtime-channel-cli.js --root /path/to/workshop --graph graph.json',
      '  node runtime-channel-cli.js --root /path/to/workshop --graph graph.json --output map.json --browser-output map.js --quiet',
      '  node runtime-channel-cli.js --root /path/to/workshop --graph graph.json --review-channel ID --review-output request.json --browser-review-output request.js --quiet',
      '',
      'No browser, channel, socket, event stream, or producer is run.'
    ].join('\n') + '\n');
    return;
  }
  if (!args.graph) throw new Error('--graph is required');
  const graph = JSON.parse(fs.readFileSync(path.resolve(args.graph), 'utf8'));
  const map = Core.analyzeWorkshop(args.root || process.cwd(), graph);
  if (args.output) writeText(args.output, JSON.stringify(map, null, 2) + '\n');
  if (args['browser-output']) writeText(args['browser-output'], browserAssignment('AXM_RUNTIME_CHANNEL_MAP', map));
  const wantsReview = Boolean(args['review-output'] || args['browser-review-output']);
  if (wantsReview && !args['review-channel']) throw new Error('review output requires --review-channel');
  if (args['review-channel'] && !wantsReview) throw new Error('--review-channel requires review output');
  if (wantsReview) {
    const request = Core.createReviewRequest(map, args['review-channel']);
    if (args['review-output']) writeText(args['review-output'], JSON.stringify(request, null, 2) + '\n');
    if (args['browser-review-output']) writeText(args['browser-review-output'], browserAssignment('AXM_RUNTIME_CHANNEL_REVIEW_REQUEST', request));
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(map, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Runtime channel analysis refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
