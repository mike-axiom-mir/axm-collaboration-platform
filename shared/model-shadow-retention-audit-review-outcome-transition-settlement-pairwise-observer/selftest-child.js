#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Observer = require('./model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer');

try {
  const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  let result;
  if (request.action === 'build') result = Observer.buildObservation(request.input);
  else if (request.action === 'verify') result = Observer.verifyObservation(request.input, request.receipt);
  else throw new Error('unknown child action');
  process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, pid: process.pid, error: { name: error.name, code: error.code || null, message: error.message } }));
}
