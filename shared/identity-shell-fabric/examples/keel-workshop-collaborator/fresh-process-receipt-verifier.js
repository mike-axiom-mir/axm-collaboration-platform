'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DeterministicJson = require('../../../../tools/deterministic-json-core');
const Independent = require('../../independent-verifier');

function canonical(value) {
  return DeterministicJson.canonicalJson(value);
}

function copy(value) {
  return JSON.parse(canonical(value));
}

function sha256(value) {
  const bytes = typeof value === 'string' ? value : canonical(value);
  return 'sha256:' + crypto.createHash('sha256').update(Buffer.from(bytes, 'utf8')).digest('hex');
}

function resign(value, digestKey) {
  const payload = copy(value);
  delete payload[digestKey];
  value[digestKey] = sha256(payload);
  return value;
}

const compilerPath = path.join(__dirname, '..', '..', 'identity-shell-fabric.js');
const importsCompiler = Object.prototype.hasOwnProperty.call(require.cache, require.resolve(compilerPath));
const buildReceipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'keel-workshop-collaborator.build-gap-receipt.json'), 'utf8'));
const lineageReceipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'keel-workshop-collaborator.lineage-receipt.json'), 'utf8'));

assert.strictEqual(importsCompiler, false);
assert.strictEqual(Independent.verifyBuildGapReceipt(buildReceipt).verdict, 'PASS');
assert.strictEqual(Independent.verifyLineageReceipt(lineageReceipt).verdict, 'PASS');

const attacks = [];
let value = copy(buildReceipt);
value.status = 'HOLD';
attacks.push(Independent.verifyBuildGapReceipt(resign(value, 'receiptDigest')));

value = copy(buildReceipt);
value.truth.runtimeClaimFollows = true;
attacks.push(Independent.verifyBuildGapReceipt(resign(value, 'receiptDigest')));

value = copy(lineageReceipt);
value.state = 'FORK_RECORDED';
attacks.push(Independent.verifyLineageReceipt(resign(value, 'receiptDigest')));

value = copy(lineageReceipt);
value.truth.automaticPromotion = true;
attacks.push(Independent.verifyLineageReceipt(resign(value, 'receiptDigest')));

attacks.forEach(result => assert.strictEqual(result.verdict, 'FAIL'));

process.stdout.write(JSON.stringify({
  status: 'PASS',
  verifierProcess: 'FRESH_NODE_PROCESS',
  importsCompiler,
  validBuildReceipt: 'PASS',
  validLineageReceipt: 'PASS',
  resignedReceiptAttacksRejected: attacks.length,
  evidenceCeiling: 'static-receipts-only'
}) + '\n');
