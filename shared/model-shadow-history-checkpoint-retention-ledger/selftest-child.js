#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-history-checkpoint-retention-ledger');

function main() {
  const packagePath = process.argv[2];
  if (!packagePath) throw new Error('one trusted synthetic package path is required');
  const input = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!input || !['inspect', 'audit', 'propose', 'settle', 'verify-proposal', 'verify-settlement'].includes(input.action)) throw new Error('unsupported synthetic selftest action');
  const service = Ledger.createService(input.serviceOptions);
  let result;
  if (input.action === 'inspect') result = service.inspect();
  else if (input.action === 'audit') result = service.auditLatest(input.input);
  else if (input.action === 'propose') result = service.propose(input.input);
  else if (input.action === 'settle') result = service.settle(input.input);
  else if (input.action === 'verify-proposal') result = service.verifyProposalPersisted(input.input, input.receipt);
  else result = service.verifySettlementPersisted(input.input, input.receipt);
  process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, result }));
}

try { main(); }
catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, pid: process.pid, error: { name: error.name, code: error.code || null, message: error.message } }));
  process.exitCode = 1;
}
