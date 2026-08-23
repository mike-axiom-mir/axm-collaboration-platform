#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const Canonical = require('../src/canonical-json');
const SessionVerifier = require('../src/session-verifier');

function usage() {
  return [
    'AXM Web session verifier — EXPERIMENTAL / read-only',
    '',
    'Usage:',
    '  node scripts/verify-session.js <session.json|-> [--pretty] [--max-bytes <n>]',
    '',
    'The verifier mutates nothing and grants no install, promotion, canon, or world authority.'
  ].join('\n');
}

function positiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(flag + ' requires a positive integer');
  return number;
}

function parseArgs(argv) {
  const args = argv.slice();
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  const pretty = args.includes('--pretty');
  const filtered = args.filter(function (arg) { return arg !== '--pretty'; });
  let maxInputBytes = SessionVerifier.DEFAULT_MAX_INPUT_BYTES;
  const maxAt = filtered.indexOf('--max-bytes');
  if (maxAt !== -1) {
    if (maxAt + 1 >= filtered.length) throw new Error('--max-bytes requires a value');
    maxInputBytes = positiveInteger(filtered[maxAt + 1], '--max-bytes');
    filtered.splice(maxAt, 2);
  }
  if (filtered.length !== 1) throw new Error('exactly one session JSON input is required');
  return { input: filtered[0], pretty, maxInputBytes };
}

function readInput(input) {
  return input === '-' ? fs.readFileSync(0) : fs.readFileSync(input);
}

function main(argv) {
  let options;
  try { options = parseArgs(argv); }
  catch (error) {
    process.stderr.write(String(error.message || error) + '\n\n' + usage() + '\n');
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(usage() + '\n');
    return;
  }
  let bytes;
  try { bytes = readInput(options.input); }
  catch (_error) {
    process.stderr.write('session input could not be read\n');
    process.exitCode = 2;
    return;
  }
  const receipt = SessionVerifier.verifySessionBytes(bytes, { maxInputBytes: options.maxInputBytes });
  process.stdout.write(Canonical.stringify(receipt, options.pretty ? 2 : 0) + '\n');
  if (receipt.status !== 'PASS') process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { usage, parseArgs, main };
