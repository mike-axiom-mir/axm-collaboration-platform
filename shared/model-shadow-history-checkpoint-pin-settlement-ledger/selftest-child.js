#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-history-checkpoint-pin-settlement-ledger');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const service = Ledger.createService(value.options);
  let result;
  if (value.action === 'inspect') result = service.inspect();
  else if (value.action === 'propose') result = service.propose(value.input);
  else if (value.action === 'settle') result = service.settle(value.input);
  else throw new Error('unknown child action');
  process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, pid: process.pid, code: error.code || error.name, message: error.message }));
}
