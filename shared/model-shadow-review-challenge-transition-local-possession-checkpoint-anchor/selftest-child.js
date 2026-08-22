#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Anchor = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-anchor');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');

const [packagePath] = process.argv.slice(2);

try {
  const packageValue = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentSnapshot = Continuity.captureState(packageValue.observationOptions);
  const auditInput = {
    auditId: packageValue.auditId,
    checkedAt: packageValue.checkedAt,
    anchoredWitnessInput: packageValue.anchoredWitnessInput,
    anchoredWitnessReceipt: packageValue.anchoredWitnessReceipt,
    currentSnapshot
  };
  const audit = Anchor.buildAnchoredAudit(auditInput);
  process.stdout.write(Anchor.stableStringify({ pid: process.pid, currentSnapshot, auditInput, audit }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
