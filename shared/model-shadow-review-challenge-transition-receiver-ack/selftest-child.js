#!/usr/bin/env node
'use strict';

const ReceiverAck = require('./model-shadow-review-challenge-transition-receiver-ack');

let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { text += chunk; });
process.stdin.on('end', () => {
  try {
    const packet = JSON.parse(text);
    const receipt = ReceiverAck.buildWitness(packet.input);
    const check = ReceiverAck.verifyWitness(packet.input, receipt);
    process.stdout.write(JSON.stringify({
      pass: check.pass,
      receiptDigest: receipt.receiptDigest,
      classification: receipt.decision.classification,
      verifiedAcknowledgements: receipt.acknowledgementEvidence.verifiedAcknowledgements
    }));
  } catch (error) {
    process.stderr.write(error.stack || error.message);
    process.exitCode = 1;
  }
});
