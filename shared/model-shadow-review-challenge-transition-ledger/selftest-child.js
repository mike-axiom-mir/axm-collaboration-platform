#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-review-challenge-transition-ledger');

function emit(value) {
  process.stdout.write(JSON.stringify(value) + '\n');
}

try {
  const packagePath = process.argv[2];
  const stateRoot = process.argv[3];
  if (!packagePath || !stateRoot) throw new Error('usage: selftest-child <package-json> <state-root>');
  const value = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const service = Ledger.createService({
    stateRoot,
    logId: value.logId,
    genesisSeparatedWitnessRef: value.genesisSeparatedWitnessRef
  });
  if (value.action === 'inspect') {
    emit({ ok: true, snapshot: service.inspect() });
  } else if (value.action === 'verify') {
    emit({ ok: true, verification: service.verifyPersisted(value.advanceInput, value.entry) });
  } else if (value.action === 'advance') {
    emit({ ok: true, entry: service.advance(value.advanceInput) });
  } else {
    throw new Error('unknown selftest child action');
  }
} catch (error) {
  emit({ ok: false, code: error.code || 'UNEXPECTED', message: error.message });
  process.exitCode = error.code === 'STALE_LOCAL_HEAD' ||
    error.code === 'TRANSITION_ALREADY_RECORDED' ||
    error.code === 'TRANSITION_LEDGER_SEQUENCE_CONFLICT' ? 17 : 1;
}
