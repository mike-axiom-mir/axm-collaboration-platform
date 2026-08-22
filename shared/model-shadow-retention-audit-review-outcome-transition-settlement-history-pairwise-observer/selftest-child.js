'use strict';

const fs = require('fs');
const Observer = require('./model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer');

try {
  const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (request.action === 'build') {
    process.stdout.write(JSON.stringify({ ok: true, receipt: Observer.buildObservation(request.input) }));
  } else if (request.action === 'verify') {
    process.stdout.write(JSON.stringify({ ok: true, result: Observer.verifyObservation(request.input, request.receipt) }));
  } else throw new Error('unknown child action');
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: { name: error.name, code: error.code || null, message: error.message } }));
  process.exitCode = 1;
}
