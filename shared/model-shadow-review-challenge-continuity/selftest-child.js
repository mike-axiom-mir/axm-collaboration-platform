#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Continuity = require('./model-shadow-review-challenge-continuity');

function emit(value) {
  process.stdout.write(JSON.stringify(value) + '\n');
}

try {
  const [checkpointPath, stateRoot, ledgerId, observationId, observedAt, auditId, checkedAt] = process.argv.slice(2);
  if (![checkpointPath, stateRoot, ledgerId, observationId, observedAt, auditId, checkedAt].every(Boolean)) {
    throw new Error('usage: selftest-child <checkpoint> <state-root> <ledger-id> <observation-id> <observed-at> <audit-id> <checked-at>');
  }
  const priorCheckpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  const currentSnapshot = Continuity.captureState({ stateRoot, ledgerId, observationId, observedAt });
  const audit = Continuity.buildAudit({ auditId, checkedAt, priorCheckpoint, currentSnapshot });
  emit({ ok: true, currentSnapshot, audit });
} catch (error) {
  emit({ ok: false, code: error.code || error.name || 'UNEXPECTED', message: error.message });
  process.exitCode = 1;
}
