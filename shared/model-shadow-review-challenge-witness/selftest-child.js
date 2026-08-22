#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Witness = require('./model-shadow-review-challenge-witness');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');

const [packagePath, stateRoot, ledgerId, observationId, observedAt, auditId, checkedAt] = process.argv.slice(2);

try {
  const witnessPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentSnapshot = Continuity.captureState({ stateRoot, ledgerId, observationId, observedAt });
  const auditInput = {
    auditId,
    checkedAt,
    witnessInput: witnessPackage.witnessInput,
    witnessReceipt: witnessPackage.witnessReceipt,
    currentSnapshot
  };
  const audit = Witness.buildWitnessedAudit(auditInput);
  process.stdout.write(Witness.stableStringify({ currentSnapshot, auditInput, audit }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
