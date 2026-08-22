#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Transition = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');

const packagePath = process.argv[2];

try {
  const transitionPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const rebuilt = Transition.buildTransition(transitionPackage.transitionInput);
  const verification = Transition.verifyTransition(transitionPackage.transitionInput, transitionPackage.transitionReceipt);
  process.stdout.write(Transition.stableStringify({ pid: process.pid, rebuilt, verification }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
