#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Checkpoint = require('./model-shadow-portable-pin-settlement-history-checkpoint');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  let result;
  if (value.action === 'checkpoint') result = Checkpoint.createCheckpoint(value.input);
  else if (value.action === 'audit') result = Checkpoint.auditCheckpoint(value.input);
  else if (value.action === 'verify-checkpoint') result = Checkpoint.verifyCheckpointOrigin(value.input, value.receipt);
  else if (value.action === 'verify-audit') result = Checkpoint.verifyAudit(value.input, value.receipt);
  else throw new Error('unknown child action');
  process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, pid: process.pid, code: error.code || error.name, message: error.message }));
}
