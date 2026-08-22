#!/usr/bin/env node
'use strict';

const fs = require('fs');
const AnchorGate = require('./model-shadow-review-challenge-anchor-gate');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');

const [packagePath, stateRoot, ledgerId, observationId, observedAt, auditId, checkedAt] = process.argv.slice(2);

try {
  const anchoredPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentSnapshot = Continuity.captureState({ stateRoot, ledgerId, observationId, observedAt });
  const auditInput = {
    auditId,
    checkedAt,
    anchoredWitnessInput: anchoredPackage.anchoredWitnessInput,
    anchoredWitnessReceipt: anchoredPackage.anchoredWitnessReceipt,
    currentSnapshot
  };
  const audit = AnchorGate.buildAnchoredAudit(auditInput);
  process.stdout.write(AnchorGate.stableStringify({ currentSnapshot, auditInput, audit }) + '\n');
} catch (error) {
  process.stderr.write(String(error && error.stack || error) + '\n');
  process.exitCode = 1;
}
