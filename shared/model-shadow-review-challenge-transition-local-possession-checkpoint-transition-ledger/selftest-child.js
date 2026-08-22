#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const service = Ledger.createService(value.options);
  if (value.action === 'inspect') {
    process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, snapshot: service.inspect(), verification: service.verifyPersisted(value.input, value.evidence, value.entry) }));
  } else if (value.action === 'record') {
    const result = service.record(value.input);
    process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, result }));
  } else {
    throw new Error('unknown child action');
  }
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, pid: process.pid, code: error.code || 'ERROR', message: error.message }));
  process.exitCode = 2;
}
