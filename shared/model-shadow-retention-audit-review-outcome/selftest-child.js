#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Outcome = require('./model-shadow-retention-audit-review-outcome');

const packagePath = process.argv[2];
if (!packagePath) throw new Error('package path is required');
const value = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const rebuilt = Outcome.buildOutcome(value.input);
const verification = Outcome.verifyOutcome(value.input, value.outcome);
if (!verification.pass || Outcome.stableStringify(rebuilt) !== Outcome.stableStringify(value.outcome)) {
  throw new Error('fresh process outcome rebuild failed: ' + verification.errors.join('; '));
}
process.stdout.write(JSON.stringify({ pass: true, outcomeDigest: rebuilt.outcomeDigest, state: rebuilt.state }));
