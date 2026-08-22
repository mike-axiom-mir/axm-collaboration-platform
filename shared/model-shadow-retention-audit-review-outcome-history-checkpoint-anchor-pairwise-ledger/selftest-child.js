#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const service = Ledger.createService(value.serviceOptions);
  let result;
  if (value.action === 'record') result = service.record(value.input);
  else if (value.action === 'inspect') result = service.inspect();
  else if (value.action === 'verify') result = service.verifyPersisted(value.input, value.receipt);
  else throw new Error('unsupported child action');
  process.stdout.write(JSON.stringify({ pid: process.pid, ok: true, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ pid: process.pid, ok: false, error: { code: error.code || null, message: error.message } }));
}
