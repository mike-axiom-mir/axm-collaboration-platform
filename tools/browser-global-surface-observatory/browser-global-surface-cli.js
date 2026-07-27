#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/browser-global-surface-core');

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const key = token.slice(2);
    if (key === 'help' || key === 'quiet') {
      output[key] = true;
    } else {
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
  const safe = JSON.stringify(value, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/\//g, '\\u002f');
  return "'use strict';\nwindow." + name + ' = ' + safe + ';\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write([
      'AXM Browser Global Surface Observatory',
      '',
      'Usage:',
      '  node browser-global-surface-cli.js --root /path/to/workshop --graph graph.json',
      '  node browser-global-surface-cli.js --root /path/to/workshop --graph graph.json --output map.json --browser-output map.js --quiet',
      '  node browser-global-surface-cli.js --root /path/to/workshop --graph graph.json --review-group ID --review-output request.json --browser-review-output request.js --quiet',
      '',
      'The graph is required. No browser is loaded and no JavaScript is executed.'
    ].join('\n') + '\n');
    return;
  }
  if (!args.graph) throw new Error('--graph is required');
  const graph = JSON.parse(fs.readFileSync(path.resolve(args.graph), 'utf8'));
  const map = Core.analyzeWorkshop(args.root || process.cwd(), graph);
  if (args.output) writeText(args.output, JSON.stringify(map, null, 2) + '\n');
  if (args['browser-output']) writeText(args['browser-output'], browserAssignment('AXM_BROWSER_GLOBAL_SURFACE', map));
  const wantsReview = Boolean(args['review-output'] || args['browser-review-output']);
  if (wantsReview && !args['review-group']) throw new Error('review output requires --review-group');
  if (args['review-group'] && !wantsReview) throw new Error('--review-group requires review output');
  if (wantsReview) {
    const request = Core.createReviewRequest(map, args['review-group']);
    if (args['review-output']) writeText(args['review-output'], JSON.stringify(request, null, 2) + '\n');
    if (args['browser-review-output']) writeText(args['browser-review-output'], browserAssignment('AXM_BROWSER_GLOBAL_REVIEW_REQUEST', request));
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(map, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Browser global analysis refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
