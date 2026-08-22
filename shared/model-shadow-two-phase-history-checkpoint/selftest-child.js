#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Checkpoint = require('./model-shadow-two-phase-history-checkpoint');

function main() {
  const packagePath = process.argv[2];
  if (!packagePath) throw new Error('package path is required');
  const value = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  let result;
  if (value.action === 'checkpoint') result = Checkpoint.createCheckpoint(value.input);
  else if (value.action === 'audit') result = Checkpoint.auditCheckpoint(value.input);
  else if (value.action === 'verify-checkpoint') result = Checkpoint.verifyCheckpointOrigin(value.input, value.receipt);
  else if (value.action === 'verify-audit') result = Checkpoint.verifyAudit(value.input, value.receipt);
  else throw new Error('unsupported child action');
  process.stdout.write(JSON.stringify({ pid: process.pid, result }));
}

try { main(); }
catch (error) {
  process.stdout.write(JSON.stringify({ pid: process.pid, code: error.code || 'UNCLASSIFIED', message: error.message }));
  process.exitCode = 1;
}
