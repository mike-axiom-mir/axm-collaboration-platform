#!/usr/bin/env node
'use strict';

const DeclaredDisclosure = require('./model-shadow-review-challenge-transition-declared-disclosure');

let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { text += chunk; });
process.stdin.on('end', () => {
  try {
    const packet = JSON.parse(text);
    const roster = DeclaredDisclosure.buildRoster(packet.input.rosterInput);
    const receipt = DeclaredDisclosure.buildAssessment(packet.input);
    const rosterCheck = DeclaredDisclosure.verifyRoster(packet.input.rosterInput, roster);
    const receiptCheck = DeclaredDisclosure.verifyAssessment(packet.input, receipt);
    process.stdout.write(JSON.stringify({
      rosterPass: rosterCheck.pass,
      receiptPass: receiptCheck.pass,
      receiptDigest: receipt.receiptDigest,
      classification: receipt.decision.classification
    }));
  } catch (error) {
    process.stderr.write(error.stack || error.message);
    process.exitCode = 1;
  }
});
