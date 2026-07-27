#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Graph = require('./core/entry-resource-graph-core');

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

function positiveInteger(value, label) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(label + ' must be a positive integer');
  return parsed;
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
      'AXM Entry Resource Graph',
      '',
      'Usage:',
      '  node entry-resource-graph-cli.js --root /path/to/workshop',
      '  node entry-resource-graph-cli.js --root /path/to/workshop --output current-entry-resource-graph.json --browser-output current-entry-resource-graph.js --quiet',
      '',
      'Optional bounds:',
      '  --max-depth 12 --max-nodes 500 --max-text-bytes 2097152 --max-module-text-bytes 12582912',
      '',
      'No output file is written unless explicitly selected. Local text is parsed as static patterns only; nothing is executed, rendered, fetched, or decoded.'
    ].join('\n') + '\n');
    return;
  }
  const graph = Graph.scanWorkshop(args.root || process.cwd(), {
    maxDepth: args['max-depth'] === undefined ? undefined : Number(args['max-depth']),
    maxNodesPerModule: positiveInteger(args['max-nodes'], '--max-nodes'),
    maxTextBytes: positiveInteger(args['max-text-bytes'], '--max-text-bytes'),
    maxTextBytesPerModule: positiveInteger(args['max-module-text-bytes'], '--max-module-text-bytes')
  });
  if (args.output) writeText(args.output, JSON.stringify(graph, null, 2) + '\n');
  if (args['browser-output']) {
    const safe = JSON.stringify(graph, null, 2)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/\//g, '\\u002f');
    writeText(args['browser-output'], "'use strict';\nwindow.AXM_ENTRY_RESOURCE_GRAPH = " + safe + ';\n');
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(graph, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Entry resource graph refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
