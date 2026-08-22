#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Settlement = require('./model-shadow-retention-audit-review-outcome-transition-settlement-ledger');

try {
  const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const service = Settlement.createService(request.serviceOptions);
  let result;
  if (request.action === 'inspect') result = service.inspect();
  else if (request.action === 'propose') result = service.propose(request.input);
  else if (request.action === 'settle') result = service.settle(request.input);
  else if (request.action === 'verify-proposal') result = service.verifyProposalPersisted(request.input, request.evidence, request.receipt);
  else if (request.action === 'verify-settlement') result = service.verifySettlementPersisted(request.input, request.evidence, request.receipt);
  else throw new Error('unknown child action');
  process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, pid: process.pid, error: { code: error.code || error.name, message: error.message } }));
}
