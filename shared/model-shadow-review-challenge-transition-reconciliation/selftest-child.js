#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Reconciliation = require('./model-shadow-review-challenge-transition-reconciliation');

try {
  const packagePath = process.argv[2];
  if (!packagePath) throw new Error('usage: selftest-child <package-json>');
  const value = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const rebuilt = Reconciliation.buildReconciliation(value.input);
  const verification = Reconciliation.verifyReconciliation(value.input, value.receipt);
  process.stdout.write(Reconciliation.stableStringify({ rebuilt, verification }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
