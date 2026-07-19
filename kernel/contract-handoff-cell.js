'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/contract-handoff-compatibility-v1';
const SCHEMA = 'axm.mirror.contract-handoff-compatibility/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  const bytes = Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }

function text(value, maximum = 240) {
  const result = String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum);
  if (!result) throw new Error('contract handoff compatibility requires non-empty typed identifiers');
  return result;
}

function typedList(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const rows = value.map(item => text(item));
  if (new Set(rows).size !== rows.length) throw new Error(`${field} contains duplicate typed identifiers`);
  return rows.slice().sort();
}

function moduleRecord(value, role) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${role} module record is required`);
  const moduleId = text(value.moduleId, 120);
  const contractSha256 = text(value.contractSha256, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(contractSha256)) throw new Error(`${role} contract digest is invalid`);
  return {
    moduleId,
    contractSha256,
    emits: typedList(value.emits || [], `${role}.emits`),
    accepts: typedList(value.accepts || [], `${role}.accepts`)
  };
}

function verify(receipt) {
  if (!receipt || receipt.schema !== SCHEMA || !receipt.receiptDigest) throw new Error('invalid contract handoff compatibility receipt');
  if (receipt.cellId !== CELL_ID || receipt.learnedWeights !== false) throw new Error('contract handoff compatibility cell lineage mismatch');
  if (receipt.receiptDigest !== digest(without(receipt, 'receiptDigest'))) throw new Error('contract handoff compatibility receipt digest mismatch');
  const producer = moduleRecord(receipt.producer, 'producer');
  const consumer = moduleRecord(receipt.consumer, 'consumer');
  const handoffType = text(receipt.handoffType);
  const producerEmits = producer.emits.includes(handoffType);
  const consumerAccepts = consumer.accepts.includes(handoffType);
  if (receipt.checks.producerEmits !== producerEmits || receipt.checks.consumerAccepts !== consumerAccepts ||
      receipt.compatible !== (producerEmits && consumerAccepts) || receipt.verdict !== (producerEmits && consumerAccepts ? 'PASS' : 'FAIL')) {
    throw new Error('contract handoff compatibility verdict does not match exact typed membership');
  }
  if (!receipt.authority || Object.values(receipt.authority).some(Boolean)) throw new Error('contract handoff compatibility receipt gained authority');
  return true;
}

function evaluate(input) {
  input = input || {};
  const producer = moduleRecord(input.producer, 'producer');
  const consumer = moduleRecord(input.consumer, 'consumer');
  const handoffType = text(input.handoffType);
  const producerEmits = producer.emits.includes(handoffType);
  const consumerAccepts = consumer.accepts.includes(handoffType);
  const compatible = producerEmits && consumerAccepts;
  const receipt = {
    schema: SCHEMA,
    receiptDigest: null,
    cellId: CELL_ID,
    learnedWeights: false,
    producer,
    consumer,
    handoffType,
    checks: { producerEmits, consumerAccepts, exactStringEquality: true },
    compatible,
    verdict: compatible ? 'PASS' : 'FAIL',
    authority: {
      candidateGeneration: false,
      contractWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      permissionGrant: false,
      semanticTruthWrite: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'Compatibility is exact membership in producer handoffs.emits[] and consumer handoffs.accepts[]. Human wording, module names, and learned weights do not decide the verdict.'
  };
  receipt.receiptDigest = digest(without(receipt, 'receiptDigest'));
  verify(receipt);
  return receipt;
}

module.exports = { CELL_ID, SCHEMA, digest, evaluate, verify };
