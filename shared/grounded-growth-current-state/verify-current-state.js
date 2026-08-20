#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Current = require('./grounded-growth-current-state');

function run(argv) {
  if (argv.length !== 1) {
    return {
      exitCode: 2,
      output: {
        schema: Current.DETACHED_VERIFICATION_SCHEMA,
        pass: false,
        verdict: 'USAGE_ERROR',
        usage: 'node verify-current-state.js <receipt.json>',
        writes: false,
        network: false
      }
    };
  }
  try {
    const file = path.resolve(argv[0]);
    const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
    const output = Current.inspectDetached(receipt);
    return { exitCode: output.pass ? 0 : 1, output };
  } catch (error) {
    return {
      exitCode: 1,
      output: {
        schema: Current.DETACHED_VERIFICATION_SCHEMA,
        pass: false,
        verdict: 'PORTABLE_INPUT_ERROR',
        sourceVerification: {
          nativeRebuild: 'NOT_RUN',
          sourceTruth: 'UNKNOWN',
          sourceCurrentness: 'UNKNOWN'
        },
        authority: { writes: false, network: false },
        issues: [{ section: 'INPUT', code: 'INPUT_UNREADABLE_OR_INVALID_JSON', detail: error.message }]
      }
    };
  }
}

if (require.main === module) {
  const result = run(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result.output, null, 2) + '\n');
  process.exitCode = result.exitCode;
}

module.exports = { run };
