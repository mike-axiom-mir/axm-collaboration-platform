#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Separation = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-separation');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');

const [packagePath] = process.argv.slice(2);

try {
  const packageValue = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentSnapshot = Continuity.captureState(packageValue.observationOptions);
  const auditInput = {
    auditId: packageValue.auditId,
    checkedAt: packageValue.checkedAt,
    separationInput: packageValue.separationInput,
    separationReceipt: packageValue.separationReceipt,
    currentSnapshot
  };
  const audit = Separation.buildSeparatedAudit(auditInput);
  process.stdout.write(Separation.stableStringify({ pid: process.pid, currentSnapshot, auditInput, audit }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
