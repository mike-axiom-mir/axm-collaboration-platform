#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Witness = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-witness');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');

const [packagePath] = process.argv.slice(2);

try {
  const packageValue = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentSnapshot = Continuity.captureState(packageValue.observationOptions);
  const auditInput = {
    auditId: packageValue.auditId,
    checkedAt: packageValue.checkedAt,
    witnessInput: packageValue.witnessInput,
    witnessReceipt: packageValue.witnessReceipt,
    currentSnapshot
  };
  const audit = Witness.buildWitnessedAudit(auditInput);
  process.stdout.write(Witness.stableStringify({ pid: process.pid, currentSnapshot, auditInput, audit }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
