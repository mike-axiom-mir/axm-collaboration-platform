#!/usr/bin/env node
'use strict';

const fs = require('fs');
const SeparationGate = require('./model-shadow-review-challenge-separation-gate');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');

const [packagePath, stateRoot, ledgerId, observationId, observedAt, auditId, checkedAt] = process.argv.slice(2);

try {
  const separatedPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentSnapshot = Continuity.captureState({ stateRoot, ledgerId, observationId, observedAt });
  const auditInput = {
    auditId,
    checkedAt,
    separationInput: separatedPackage.separationInput,
    separationReceipt: separatedPackage.separationReceipt,
    currentSnapshot
  };
  const audit = SeparationGate.buildSeparatedAudit(auditInput);
  process.stdout.write(SeparationGate.stableStringify({ currentSnapshot, auditInput, audit }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
