#!/usr/bin/env node
'use strict';

const Canonical = require('../src/canonical-json');
const ShellPolicy = require('../src/shell-policy');

function usage() {
  return [
    'AXM Web shell policy — EXPERIMENTAL / read-only',
    '',
    'Usage:',
    '  node scripts/shell-policy.js [--pretty]',
    '',
    'Reports the deterministic trusted-loopback shell policy without starting a listener.'
  ].join('\n');
}

function main(argv) {
  const args = argv.slice();
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage() + '\n');
    return;
  }
  const pretty = args.includes('--pretty');
  const unknown = args.filter(function (arg) { return arg !== '--pretty'; });
  if (unknown.length) {
    process.stderr.write('unexpected argument: ' + unknown[0] + '\n\n' + usage() + '\n');
    process.exitCode = 2;
    return;
  }
  process.stdout.write(Canonical.stringify(ShellPolicy.buildShellPolicy(), pretty ? 2 : 0) + '\n');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { usage, main };
