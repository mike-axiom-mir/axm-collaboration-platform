#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Gate = require('./return-gate-core');

function usage() {
  return [
    'AXM Branch Module Return Gate',
    '',
    'Inspect only:',
    '  node intake-cli.js inspect --source <folder> [--output <inspection.json>]',
    '',
    'Build an inert deterministic intake package:',
    '  node intake-cli.js pack --source <folder> --out <package.json> [--receipt <receipt.json>]',
    '',
    'Verify a previously built package:',
    '  node intake-cli.js verify --package <package.json> [--receipt <receipt.json>]',
    '',
    'No command installs, stages, promotes, executes, merges or pushes the candidate.'
  ].join('\n');
}

function argsOf(argv) {
  const values = { command: argv[0] || '' };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('unexpected argument: ' + token);
    const key = token.slice(2);
    if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error('missing value for --' + key);
    values[key] = argv[++index];
  }
  return values;
}

function readJson(file, label) {
  if (!file) return null;
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, ''));
}

function writeNew(file, value) {
  const absolute = path.resolve(file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  return absolute;
}

function assertNewOutputs(files) {
  const absolute = files.map(file => path.resolve(file));
  if (new Set(absolute.map(file => file.toLowerCase())).size !== absolute.length) throw new Error('package and receipt outputs must be different files');
  absolute.forEach(file => {
    if (fs.existsSync(file)) throw new Error('output already exists; refusing overwrite: ' + file);
  });
}

function emit(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function main() {
  const args = argsOf(process.argv.slice(2));
  if (!args.command || args.command === 'help' || args.command === '--help') {
    process.stdout.write(usage() + '\n');
    return 0;
  }
  if (args.command === 'inspect') {
    if (!args.source) throw new Error('--source is required');
    const report = Gate.inspectSource(args.source);
    if (args.output) writeNew(args.output, report);
    emit(report);
    return report.pass ? 0 : 2;
  }
  if (args.command === 'pack') {
    if (!args.source || !args.out) throw new Error('--source and --out are required');
    const built = Gate.buildPackage(args.source);
    const requestedReceipt = args.receipt || args.out + '.receipt.json';
    assertNewOutputs([args.out, requestedReceipt]);
    const packagePath = writeNew(args.out, built.package);
    const receiptPath = writeNew(requestedReceipt, built.receipt);
    emit({
      schema: 'axm.branch-return-cli-result/v1',
      status: 'READY_FOR_GOVERNED_INTAKE',
      packagePath,
      receiptPath,
      packageDigest: built.receipt.packageDigest,
      authority: built.receipt.authority
    });
    return 0;
  }
  if (args.command === 'verify') {
    if (!args.package) throw new Error('--package is required');
    const checked = Gate.verifyPackage(readJson(args.package, 'package'), args.receipt ? readJson(args.receipt, 'receipt') : null);
    emit(checked);
    return checked.pass ? 0 : 3;
  }
  throw new Error('unknown command: ' + args.command + '\n\n' + usage());
}

try { process.exitCode = main(); }
catch (error) {
  if (error.report) emit(error.report);
  else process.stderr.write('REFUSED: ' + error.message + '\n');
  process.exitCode = 1;
}
