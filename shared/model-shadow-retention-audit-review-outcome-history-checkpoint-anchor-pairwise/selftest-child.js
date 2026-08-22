#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Pairwise = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  process.stdout.write(JSON.stringify({ pid: process.pid, result: Pairwise.buildTransition(value.input) }));
} catch (error) {
  process.stderr.write(error.stack || error.message);
  process.exitCode = 1;
}
