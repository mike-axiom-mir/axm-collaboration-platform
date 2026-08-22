#!/usr/bin/env node
'use strict';

const fs = require('fs');
const TransitionGate = require('./model-shadow-review-challenge-transition-gate');

const packagePath = process.argv[2];

try {
  const transitionPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const rebuilt = TransitionGate.buildTransition(transitionPackage.transitionInput);
  const verification = TransitionGate.verifyTransition(transitionPackage.transitionInput, transitionPackage.transitionReceipt);
  process.stdout.write(TransitionGate.stableStringify({ rebuilt, verification }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
