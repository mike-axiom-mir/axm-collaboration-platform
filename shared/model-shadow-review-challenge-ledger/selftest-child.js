#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-review-challenge-ledger');

function emit(value) {
  process.stdout.write(JSON.stringify(value) + '\n');
}

try {
  const requestPath = process.argv[2];
  const stateRoot = process.argv[3];
  const ledgerId = process.argv[4];
  if (!requestPath || !stateRoot || !ledgerId) throw new Error('usage: selftest-child <request-json> <state-root> <ledger-id>');
  const input = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  const service = Ledger.createService({ stateRoot, ledgerId });
  const receipt = service.consume(input);
  emit({ ok: true, receipt });
} catch (error) {
  emit({ ok: false, code: error.code || 'UNEXPECTED', message: error.message });
  process.exitCode = error.code === 'CHALLENGE_ALREADY_CONSUMED' ? 17 : 1;
}
