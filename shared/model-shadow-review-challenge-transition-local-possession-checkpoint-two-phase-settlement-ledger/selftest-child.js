#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const service = Ledger.createService(value.options);
  let result;
  if (value.action === 'inspect') {
    result = {
      snapshot: service.inspect(),
      proposalVerification: value.proposalInput ? service.verifyProposalPersisted(value.proposalInput, value.prewriteEvidence, value.proposalReceipt) : null,
      settlementVerification: value.settlementInput ? service.verifySettlementPersisted(value.settlementInput, value.postwriteEvidence, value.settlementReceipt) : null
    };
  } else if (value.action === 'propose') {
    result = service.propose(value.proposalInput);
  } else if (value.action === 'settle') {
    result = service.settle(value.settlementInput);
  } else {
    throw new Error('unknown child action');
  }
  process.stdout.write(JSON.stringify({ ok: true, pid: process.pid, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, pid: process.pid, code: error.code || 'ERROR', message: error.message }));
  process.exitCode = 2;
}
