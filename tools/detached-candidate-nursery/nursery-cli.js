#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/nursery-core');

function parseArgs(argv) {
  const result = { excludeFolders: [], excludeArchives: [] };
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
    if (key === 'exclude-folder') result.excludeFolders.push(argv[index + 1]);
    else if (key === 'exclude-archive') result.excludeArchives.push(argv[index + 1]);
    else result[key] = argv[index + 1];
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
    'AXM Detached Candidate Nursery',
    '',
    'Usage:',
    '  node nursery-cli.js --root /path/to/axm_module_candidates',
    '  node nursery-cli.js --root /path/to/candidates --output current-registry.json --quiet',
    '  node nursery-cli.js --root /path/to/candidates --browser-output current-registry.js',
    '  node nursery-cli.js --root /path/to/candidates --exclude-folder detached-candidate-nursery',
    '  node nursery-cli.js --root /path/to/candidates --exclude-archive AXM_Detached_Candidate_Nursery_EXPERIMENTAL_2026-07-25.zip',
    '',
    'Repeat --exclude-folder when a detached scanner must avoid a self-referential bundle verdict.',
    'No files are written unless --output or --browser-output is explicit.'
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(help() + '\n');
    return;
  }
  const registry = Core.scanSupply(args.root || process.cwd(), {
    excludeFolders: args.excludeFolders,
    excludeArchives: args.excludeArchives
  });
  if (args.output) writeText(args.output, JSON.stringify(registry, null, 2) + '\n');
  if (args['browser-output']) {
    const safe = JSON.stringify(registry, null, 2).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    writeText(args['browser-output'], "'use strict';\nwindow.AXM_CANDIDATE_REGISTRY = " + safe + ';\n');
  }
  if (!args.quiet) process.stdout.write(JSON.stringify(registry, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Nursery refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
