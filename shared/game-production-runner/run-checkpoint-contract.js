'use strict';

const fs = require('fs');
const Codec = require('./canonical');
const Contracts = require('./contracts');
const StepReceipts = require('./step-receipt-contract');

const SCHEMA = 'axm.production-run-checkpoint/v1';
const VERSION = '0.1.0';
const MAX_CHECKPOINTS = 10000;
const MAX_LEDGER_BYTES = 16777216;
const DIGEST = /^[a-f0-9]{64}$/;
const KEYS = Object.freeze([
  'schema', 'version', 'run_id', 'state', 'plan_digest', 'intent_ref',
  'graph_ref', 'source_anchor', 'started_at', 'updated_at',
  'step_receipt_schema', 'ledger_count', 'ledger_tail',
  'verified_step_receipts', 'previous_checkpoint_digest', 'authority', 'digest'
]);
const AUTHORITY_KEYS = Object.freeze(['execution', 'source_write', 'installed', 'promoted', 'canon', 'released']);

class CheckpointError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CheckpointError';
    this.code = code;
  }
}

function fail(code) { throw new CheckpointError(code); }
function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Codec.canonical(Object.keys(value).sort()) === Codec.canonical(expected.slice().sort());
}
function text(value) { return typeof value === 'string' && value.length > 0; }
function digest(value) { return DIGEST.test(String(value || '')); }

function validate(checkpoint) {
  const errors = [];
  if (!exactKeys(checkpoint, KEYS)) return ['run checkpoint shape is invalid'];
  if (checkpoint.schema !== SCHEMA || checkpoint.version !== VERSION || !Codec.validDigest(checkpoint)) errors.push('run checkpoint integrity is invalid');
  if (!Contracts.portableId(checkpoint.run_id) || checkpoint.state !== 'INTERRUPTED' || !digest(checkpoint.plan_digest) || !Contracts.exactRef(checkpoint.intent_ref) || !Contracts.exactRef(checkpoint.graph_ref)) errors.push('run checkpoint binding is invalid');
  if (!text(checkpoint.source_anchor) || !text(checkpoint.started_at) || !text(checkpoint.updated_at) || !Object.values(StepReceipts.SCHEMAS).includes(checkpoint.step_receipt_schema)) errors.push('run checkpoint context is invalid');
  if (!Number.isSafeInteger(checkpoint.ledger_count) || checkpoint.ledger_count < 0 || (checkpoint.ledger_count === 0 ? checkpoint.ledger_tail !== null : !digest(checkpoint.ledger_tail))) errors.push('run checkpoint ledger position is invalid');
  if (!Array.isArray(checkpoint.verified_step_receipts) || checkpoint.verified_step_receipts.length > checkpoint.ledger_count || checkpoint.verified_step_receipts.some((item) => !digest(item)) || new Set(checkpoint.verified_step_receipts).size !== checkpoint.verified_step_receipts.length) errors.push('run checkpoint verified receipt binding is invalid');
  if (checkpoint.previous_checkpoint_digest !== null && !digest(checkpoint.previous_checkpoint_digest)) errors.push('run checkpoint previous digest is invalid');
  if (!exactKeys(checkpoint.authority, AUTHORITY_KEYS) || Object.values(checkpoint.authority).some((value) => value !== false)) errors.push('run checkpoint authority is invalid');
  return errors;
}

function assertValid(checkpoint) {
  const errors = validate(checkpoint);
  if (errors.length) fail('RUN_CHECKPOINT_INVALID:' + errors.join('; '));
  return checkpoint;
}

function create(state, plan, previousCheckpointDigest) {
  if (!state || state.status !== 'INTERRUPTED' || !plan) fail('RUN_CHECKPOINT_SOURCE_INVALID');
  if (state.plan_digest !== plan.digest) fail('RUN_CHECKPOINT_SOURCE_PLAN_MISMATCH');
  const checkpoint = {
    schema: SCHEMA,
    version: VERSION,
    run_id: state.id,
    state: 'INTERRUPTED',
    plan_digest: state.plan_digest,
    intent_ref: Codec.clone(plan.intent_ref),
    graph_ref: Codec.clone(plan.graph_ref),
    source_anchor: plan.source_anchor,
    started_at: state.started_at,
    updated_at: state.updated_at,
    step_receipt_schema: state.step_receipt_schema,
    ledger_count: state.ledger_count,
    ledger_tail: state.ledger_tail,
    verified_step_receipts: Object.values(state.steps || {}).map((step) => step.receipt_digest),
    previous_checkpoint_digest: previousCheckpointDigest == null ? null : previousCheckpointDigest,
    authority: { execution: false, source_write: false, installed: false, promoted: false, canon: false, released: false }
  };
  return assertValid(Codec.seal(checkpoint));
}

function parseLedger(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(String(raw || ''), 'utf8');
  if (bytes > MAX_LEDGER_BYTES) fail('RUN_CHECKPOINT_LEDGER_BYTE_LIMIT');
  const trimmed = Buffer.isBuffer(raw) ? raw.toString('utf8').trim() : String(raw || '').trim();
  const lines = trimmed ? trimmed.split(/\r?\n/) : [];
  if (lines.length > MAX_CHECKPOINTS) fail('RUN_CHECKPOINT_LEDGER_COUNT_LIMIT');
  const checkpoints = lines.map((line) => {
    let checkpoint;
    try { checkpoint = JSON.parse(line); } catch (_) { fail('RUN_CHECKPOINT_LEDGER_JSON_INVALID'); }
    return assertValid(checkpoint);
  });
  for (let index = 0; index < checkpoints.length; index += 1) {
    const checkpoint = checkpoints[index], previous = index === 0 ? null : checkpoints[index - 1];
    if (checkpoint.previous_checkpoint_digest !== (previous && previous.digest)) fail('RUN_CHECKPOINT_LEDGER_CHAIN_INVALID');
    if (!previous) continue;
    if (checkpoint.run_id !== previous.run_id || checkpoint.plan_digest !== previous.plan_digest || Codec.canonical(checkpoint.intent_ref) !== Codec.canonical(previous.intent_ref) || Codec.canonical(checkpoint.graph_ref) !== Codec.canonical(previous.graph_ref) || checkpoint.source_anchor !== previous.source_anchor || checkpoint.started_at !== previous.started_at || checkpoint.step_receipt_schema !== previous.step_receipt_schema) fail('RUN_CHECKPOINT_LEDGER_BINDING_DRIFT');
    if (checkpoint.ledger_count < previous.ledger_count || previous.verified_step_receipts.some((item, receiptIndex) => checkpoint.verified_step_receipts[receiptIndex] !== item)) fail('RUN_CHECKPOINT_LEDGER_ROLLBACK');
  }
  return checkpoints;
}

function readBoundedFile(file) {
  if (!fs.existsSync(file)) return Buffer.alloc(0);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('RUN_CHECKPOINT_LEDGER_NOT_PLAIN');
  const buffer = Buffer.allocUnsafe(MAX_LEDGER_BYTES + 1);
  const handle = fs.openSync(file, 'r');
  let offset = 0;
  try {
    const opened = fs.fstatSync(handle);
    if (!opened.isFile()) fail('RUN_CHECKPOINT_LEDGER_NOT_PLAIN');
    while (offset <= MAX_LEDGER_BYTES) {
      const read = fs.readSync(handle, buffer, offset, buffer.length - offset, null);
      if (read === 0) break;
      offset += read;
    }
  } finally { fs.closeSync(handle); }
  if (offset > MAX_LEDGER_BYTES) fail('RUN_CHECKPOINT_LEDGER_BYTE_LIMIT');
  return buffer.subarray(0, offset);
}

function readFile(file) {
  return parseLedger(readBoundedFile(file));
}

function appendFile(file, checkpoint) {
  assertValid(checkpoint);
  const existing = readBoundedFile(file);
  const separator = existing.length && existing[existing.length - 1] !== 10 && existing[existing.length - 1] !== 13 ? '\n' : '';
  const addition = Buffer.from(separator + JSON.stringify(checkpoint) + '\n', 'utf8');
  if (existing.length + addition.length > MAX_LEDGER_BYTES) fail('RUN_CHECKPOINT_LEDGER_BYTE_LIMIT');
  parseLedger(Buffer.concat([existing, addition]));
  fs.appendFileSync(file, addition, { flag: 'a' });
  return checkpoint;
}

function assertHistory(checkpoints, context) {
  if (!Array.isArray(checkpoints)) fail('RUN_CHECKPOINT_HISTORY_INVALID');
  for (const checkpoint of checkpoints) {
    if (checkpoint.run_id !== context.runId || checkpoint.plan_digest !== context.plan.digest || Codec.canonical(checkpoint.intent_ref) !== Codec.canonical(context.plan.intent_ref) || Codec.canonical(checkpoint.graph_ref) !== Codec.canonical(context.plan.graph_ref) || checkpoint.source_anchor !== context.plan.source_anchor || checkpoint.step_receipt_schema !== context.stepReceiptSchema) fail('RUN_CHECKPOINT_HISTORY_CONTEXT_MISMATCH');
  }
  return checkpoints;
}

function matchesLedger(checkpoint, receipts) {
  if (!checkpoint || !Array.isArray(receipts)) return false;
  return checkpoint.ledger_count === receipts.length && matchesLedgerPrefix(checkpoint, receipts);
}

function matchesLedgerPrefix(checkpoint, receipts) {
  if (!checkpoint || !Array.isArray(receipts) || checkpoint.ledger_count > receipts.length) return false;
  const prefix = receipts.slice(0, checkpoint.ledger_count);
  const verified = prefix.filter((receipt) => receipt.state === 'VERIFIED').map((receipt) => receipt.digest);
  const tail = prefix.length ? prefix[prefix.length - 1].digest : null;
  return checkpoint.ledger_tail === tail && Codec.canonical(checkpoint.verified_step_receipts) === Codec.canonical(verified);
}

function assertLedgerHistory(checkpoints, receipts) {
  if (!Array.isArray(checkpoints) || !Array.isArray(receipts) || checkpoints.some((checkpoint) => !matchesLedgerPrefix(checkpoint, receipts))) fail('RUN_CHECKPOINT_HISTORY_LEDGER_MISMATCH');
  return checkpoints;
}

module.exports = {
  SCHEMA,
  VERSION,
  MAX_CHECKPOINTS,
  MAX_LEDGER_BYTES,
  CheckpointError,
  validate,
  assertValid,
  create,
  parseLedger,
  readFile,
  appendFile,
  assertHistory,
  matchesLedger,
  matchesLedgerPrefix,
  assertLedgerHistory
};
