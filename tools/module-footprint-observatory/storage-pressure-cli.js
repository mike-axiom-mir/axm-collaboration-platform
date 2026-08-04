#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/storage-pressure-core');

function parseArgs(argv) {
  const result = { roots: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const key = token.slice(2);
    if (key === 'help' || key === 'quiet') {
      result[key] = true;
      continue;
    }
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error('Missing value for --' + key);
    const value = argv[index + 1];
    if (key === 'root') result.roots.push(value);
    else result[key] = value;
    index += 1;
  }
  return result;
}

function rootSpec(value) {
  const separator = String(value).indexOf('=');
  if (separator <= 0 || separator === value.length - 1) throw new Error('--root requires ID=PATH');
  return { id: value.slice(0, separator), path: path.resolve(value.slice(separator + 1)) };
}

function writeText(file, body) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, body);
  fs.renameSync(temporary, target);
}

function browserAssignment(value) {
  const safe = JSON.stringify(value, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/\//g, '\\u002f');
  return "'use strict';\nwindow.AXM_STORAGE_PRESSURE_MAP = " + safe + ';\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write([
      'AXM Storage Pressure Observatory',
      '',
      'Usage:',
      '  node storage-pressure-cli.js --root workshop=D:\\AXM_ACTIVE\\workshop --root mirror=D:\\AXM_ACTIVE\\mirror',
      '  node storage-pressure-cli.js --root workshop=PATH --root mirror=PATH --output snapshot.json --browser-output snapshot.js --quiet',
      '',
      'Optional: --previous prior-snapshot.json --allocation-unit 4096 --hash duplicates|none --hash-classes CLASS,CLASS --max-hash-bytes N',
      'No output is written unless --output or --browser-output is explicit. No source file is changed or deleted.'
    ].join('\n') + '\n');
    return;
  }
  if (!args.roots.length) throw new Error('at least one --root ID=PATH is required');
  if (args.hash && !['duplicates', 'none'].includes(args.hash)) throw new Error('--hash must be duplicates or none');
  const hashClasses = args['hash-classes']
    ? args['hash-classes'].split(',').map(value => value.trim()).filter(Boolean)
    : null;
  if (hashClasses && hashClasses.some(value => !Core.CLASSES.includes(value))) {
    throw new Error('--hash-classes contains an unknown retention class');
  }
  const previous = args.previous ? JSON.parse(fs.readFileSync(path.resolve(args.previous), 'utf8')) : null;
  const map = Core.scanRoots(args.roots.map(rootSpec), {
    previous,
    allocationUnit: args['allocation-unit'] === undefined ? undefined : Number(args['allocation-unit']),
    hashMode: args.hash,
    hashClasses,
    maxHashBytes: args['max-hash-bytes'] === undefined ? undefined : Number(args['max-hash-bytes'])
  });
  if (args.output) writeText(args.output, JSON.stringify(map, null, 2) + '\n');
  if (args['browser-output']) writeText(args['browser-output'], browserAssignment(map));
  if (!args.quiet) process.stdout.write(JSON.stringify(map, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('Storage pressure scan refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
