#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core/conveyor-core');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const key = token.slice(2);
    if (key === 'help' || key === 'quiet' || key === 'resume') {
      result[key] = true;
      continue;
    }
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error('Missing value for --' + key);
    result[key] = argv[index + 1];
    index += 1;
  }
  return result;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(label + ' is not readable JSON: ' + error.message);
  }
}

function writeText(file, body) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, body);
  fs.renameSync(temporary, target);
}

function safeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'archive';
}

function writeReceiptSet(root, receipt) {
  const runRoot = path.resolve(root, 'run-' + receipt.receiptDigest.slice(0, 16));
  writeText(path.join(runRoot, 'master-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  writeText(path.join(runRoot, 'worklist.json'), JSON.stringify({
    schema: 'axm.bulk-intake-worklist/v1',
    receiptDigest: receipt.receiptDigest,
    queues: receipt.queues,
    batches: receipt.batches,
    handoff: receipt.handoff
  }, null, 2) + '\n');
  for (const archive of receipt.archives) {
    const name = safeFileName(archive.relativePath) + '-' + String(archive.sha256 || 'no-digest').slice(0, 12) + '.json';
    writeText(path.join(runRoot, 'archives', name), JSON.stringify(archive, null, 2) + '\n');
  }
  return runRoot;
}

function help() {
  return [
    'AXM Bulk Intake Conveyor',
    '',
    'Usage:',
    '  node intake-cli.js --root C:\\path\\to\\incoming-zips',
    '  node intake-cli.js --root C:\\incoming --output C:\\state\\intake.json --quiet',
    '  node intake-cli.js --root C:\\incoming --output C:\\state\\intake.json --resume --receipt-dir C:\\state\\receipts',
    '',
    'Options:',
    '  --root PATH           Explicit ZIP supply folder (required)',
    '  --workshop-root PATH  Active Workshop used for name-collision evidence',
    '  --batch-size N        Candidate work items per bounded batch (default 50, max 100)',
    '  --previous FILE       Prior conveyor receipt used for resume evidence',
    '  --resume              Reuse --output as prior receipt when that file exists',
    '  --output FILE         Atomically write the master receipt',
    '  --receipt-dir PATH    Write a digest-named receipt set and per-archive records',
    '  --quiet               Suppress JSON stdout',
    '',
    'The conveyor inventories and queues only. It never extracts, executes, approves, installs, promotes, pushes, or changes CANON.'
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(help() + '\n');
    return;
  }
  if (!args.root) throw new Error('--root is required; intake never guesses a supply folder');
  let previousReceipt = null;
  if (args.previous) previousReceipt = readJson(args.previous, '--previous');
  if (args.resume && args.output && fs.existsSync(path.resolve(args.output))) {
    previousReceipt = readJson(args.output, '--output resume receipt');
  }
  const receipt = Core.buildReceipt({
    sourceRoot: args.root,
    workshopRoot: args['workshop-root'] || path.resolve(__dirname, '..', '..'),
    batchSize: args['batch-size'] === undefined ? undefined : Number(args['batch-size']),
    previousReceipt
  });
  if (args.output) writeText(args.output, JSON.stringify(receipt, null, 2) + '\n');
  let receiptDirectory = null;
  if (args['receipt-dir']) receiptDirectory = writeReceiptSet(args['receipt-dir'], receipt);
  if (!args.quiet) {
    process.stdout.write(JSON.stringify({
      schema: receipt.schema,
      receiptDigest: receipt.receiptDigest,
      summary: receipt.summary,
      batches: receipt.batches,
      performance: receipt.performance,
      receiptDirectory,
      truth: receipt.truth
    }, null, 2) + '\n');
  }
}

try {
  main();
} catch (error) {
  process.stderr.write('Bulk Intake Conveyor refused: ' + (error && error.message || error) + '\n');
  process.exitCode = 1;
}
