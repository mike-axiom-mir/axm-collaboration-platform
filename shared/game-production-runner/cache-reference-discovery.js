'use strict';

const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');
const Contracts = require('./contracts');
const StepReceipts = require('./step-receipt-contract');
const RunCheckpoints = require('./run-checkpoint-contract');

const SCHEMA = 'axm.production-artifact-cache-reference-set/v1';
const VERSION = '0.1.0';
const DIGEST = /^[a-f0-9]{64}$/;
const TERMINAL_STATES = Object.freeze(['CANDIDATE_READY', 'HUMAN_REVIEW', 'HELD', 'FAILED', 'CANCELLED']);
const PROTECTIVE_CACHE_STATES = Object.freeze(['HIT', 'MISS_STORED', 'MISS_ENTRY_EXISTS', 'MISS_CONFLICT']);
const DEFAULT_MAX_DIRECTORY_ENTRIES = 20000;
const DEFAULT_MAX_RUNS = 10000;
const DEFAULT_MAX_RECEIPTS = 100000;
const DEFAULT_MAX_LEDGER_BYTES = 268435456;
const DEFAULT_MAX_CHECKPOINTS = 100000;
const DEFAULT_MAX_CHECKPOINT_LEDGER_BYTES = 67108864;
const MAX_SINGLE_LEDGER_BYTES = 16777216;
const MAX_RUN_RECEIPT_BYTES = 1048576;
const RUN_RECEIPT_KEYS = Object.freeze([
  'schema', 'id', 'version', 'state', 'intent_ref', 'graph_ref', 'source_anchor',
  'started_at', 'updated_at', 'step_receipt_schema', 'step_receipts',
  'overall_verdict', 'human_review', 'authority', 'digest'
]);

class ReferenceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReferenceError';
    this.code = code;
  }
}

function fail(code) { throw new ReferenceError(code); }
function inside(root, candidate) {
  const base = normalizedPath(root), target = normalizedPath(candidate);
  return target === base || target.startsWith(base + path.sep);
}

function resolveExistingLinks(candidate) {
  let cursor = path.resolve(candidate);
  const tail = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    tail.unshift(path.basename(cursor));
    cursor = parent;
  }
  const existing = fs.existsSync(cursor) ? fs.realpathSync.native(cursor) : cursor;
  return path.resolve(existing, ...tail);
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function locateJobRoot(jobRoot, sourceRoot) {
  if (!path.isAbsolute(String(jobRoot || ''))) fail('REFERENCE_JOB_ROOT_NOT_ABSOLUTE');
  const requested = path.resolve(jobRoot), resolved = resolveExistingLinks(requested);
  if (resolved === path.parse(resolved).root) fail('REFERENCE_JOB_ROOT_IS_FILESYSTEM_ROOT');
  if (normalizedPath(requested) !== normalizedPath(resolved)) fail('REFERENCE_JOB_ROOT_TRAVERSES_LINK');
  if (sourceRoot) {
    const source = resolveExistingLinks(sourceRoot);
    if (inside(source, resolved) || inside(resolved, source)) fail('REFERENCE_JOB_ROOT_OVERLAPS_SOURCE');
  }
  const exists = fs.existsSync(resolved);
  if (exists) {
    const stat = fs.lstatSync(resolved);
    if (!stat.isDirectory() || stat.isSymbolicLink() || normalizedPath(fs.realpathSync.native(resolved)) !== normalizedPath(resolved)) fail('REFERENCE_JOB_ROOT_NOT_PLAIN_DIRECTORY');
  }
  return { root: resolved, exists };
}

function rootFingerprint(root) { return Codec.sha256(Buffer.from(normalizedPath(root), 'utf8')); }
function locatorDigest(relative) { return Codec.sha256(Buffer.from(String(relative).replace(/\\/g, '/'), 'utf8')); }

function scanBudget(options) {
  const maxDirectoryEntries = options.scanMaxDirectoryEntries == null ? DEFAULT_MAX_DIRECTORY_ENTRIES : options.scanMaxDirectoryEntries;
  const maxRuns = options.scanMaxRuns == null ? DEFAULT_MAX_RUNS : options.scanMaxRuns;
  const maxReceipts = options.scanMaxReceipts == null ? DEFAULT_MAX_RECEIPTS : options.scanMaxReceipts;
  const maxLedgerBytes = options.scanMaxLedgerBytes == null ? DEFAULT_MAX_LEDGER_BYTES : options.scanMaxLedgerBytes;
  const maxCheckpoints = options.scanMaxCheckpoints == null ? DEFAULT_MAX_CHECKPOINTS : options.scanMaxCheckpoints;
  const maxCheckpointLedgerBytes = options.scanMaxCheckpointLedgerBytes == null ? DEFAULT_MAX_CHECKPOINT_LEDGER_BYTES : options.scanMaxCheckpointLedgerBytes;
  if (!Number.isInteger(maxDirectoryEntries) || maxDirectoryEntries < 1 || maxDirectoryEntries > DEFAULT_MAX_DIRECTORY_ENTRIES || !Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > DEFAULT_MAX_RUNS || !Number.isInteger(maxReceipts) || maxReceipts < 1 || maxReceipts > DEFAULT_MAX_RECEIPTS || !Number.isSafeInteger(maxLedgerBytes) || maxLedgerBytes < 1 || maxLedgerBytes > DEFAULT_MAX_LEDGER_BYTES || !Number.isInteger(maxCheckpoints) || maxCheckpoints < 1 || maxCheckpoints > DEFAULT_MAX_CHECKPOINTS || !Number.isSafeInteger(maxCheckpointLedgerBytes) || maxCheckpointLedgerBytes < 1 || maxCheckpointLedgerBytes > DEFAULT_MAX_CHECKPOINT_LEDGER_BYTES) fail('REFERENCE_SCAN_BUDGET_INVALID');
  return { max_directory_entries: maxDirectoryEntries, max_runs: maxRuns, max_receipts: maxReceipts, max_ledger_bytes: maxLedgerBytes, max_single_ledger_bytes: MAX_SINGLE_LEDGER_BYTES, max_checkpoints: maxCheckpoints, max_checkpoint_ledger_bytes: maxCheckpointLedgerBytes, max_single_checkpoint_ledger_bytes: RunCheckpoints.MAX_LEDGER_BYTES };
}

function boundedDirectNames(root, maximum) {
  const directory = fs.opendirSync(root), names = [];
  let exceeded = false;
  try {
    for (;;) {
      const entry = directory.readSync();
      if (entry === null) break;
      if (names.length >= maximum) { exceeded = true; break; }
      names.push(entry.name);
    }
  } finally { directory.closeSync(); }
  return { names: names.sort(), exceeded };
}

function plainFile(directory, name, missingCode) {
  const file = path.join(directory, name);
  if (!fs.existsSync(file)) fail(missingCode);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || normalizedPath(fs.realpathSync.native(file)) !== normalizedPath(file)) fail('REFERENCE_RUN_FILE_NOT_PLAIN');
  return { file, stat };
}

function readBoundedFile(descriptor, maximum, limitCode) {
  const buffer = Buffer.allocUnsafe(maximum + 1);
  const handle = fs.openSync(descriptor.file, 'r');
  let offset = 0;
  try {
    const stat = fs.fstatSync(handle);
    if (!stat.isFile()) fail('REFERENCE_RUN_FILE_NOT_PLAIN');
    while (offset <= maximum) {
      const read = fs.readSync(handle, buffer, offset, buffer.length - offset, null);
      if (read === 0) break;
      offset += read;
    }
  } finally { fs.closeSync(handle); }
  if (offset > maximum) fail(limitCode);
  return buffer.subarray(0, offset);
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Codec.canonical(Object.keys(value).sort()) === Codec.canonical(expected.slice().sort());
}

function validateRunReceipt(receipt) {
  if (!exactKeys(receipt, RUN_RECEIPT_KEYS)) fail('REFERENCE_RUN_RECEIPT_SHAPE_INVALID');
  if (receipt.schema !== Contracts.SCHEMAS.run || receipt.version !== VERSION || !Contracts.portableId(receipt.id) || !TERMINAL_STATES.includes(receipt.state) || !Contracts.exactRef(receipt.intent_ref) || !Contracts.exactRef(receipt.graph_ref) || typeof receipt.source_anchor !== 'string' || !receipt.source_anchor || typeof receipt.started_at !== 'string' || !receipt.started_at || typeof receipt.updated_at !== 'string' || !receipt.updated_at) fail('REFERENCE_RUN_RECEIPT_CONTRACT_INVALID');
  if (!Object.values(StepReceipts.SCHEMAS).includes(receipt.step_receipt_schema) || !Array.isArray(receipt.step_receipts) || receipt.step_receipts.some((item) => !DIGEST.test(String(item || ''))) || new Set(receipt.step_receipts).size !== receipt.step_receipts.length) fail('REFERENCE_RUN_RECEIPT_STEP_BINDING_INVALID');
  const expectedVerdict = receipt.state === 'CANDIDATE_READY' ? 'VERIFIED' : receipt.state === 'HUMAN_REVIEW' ? 'HUMAN_REVIEW' : receipt.state === 'FAILED' ? 'FAILED' : 'HELD';
  if (receipt.overall_verdict !== expectedVerdict || receipt.human_review !== (receipt.state === 'HUMAN_REVIEW')) fail('REFERENCE_RUN_RECEIPT_VERDICT_INVALID');
  if (!exactKeys(receipt.authority, ['installed', 'promoted', 'canon', 'released']) || Object.values(receipt.authority).some((value) => value !== false)) fail('REFERENCE_RUN_RECEIPT_AUTHORITY_INVALID');
  if (!Codec.validDigest(receipt)) fail('REFERENCE_RUN_RECEIPT_DIGEST_INVALID');
  return receipt;
}

function parseLedger(raw, expectedSchema, runId, counters, budget) {
  const trimmed = raw.trim();
  const lines = trimmed ? trimmed.split(/\r?\n/) : [];
  counters.receipts += lines.length;
  if (counters.receipts > budget.max_receipts) fail('REFERENCE_SCAN_RECEIPT_LIMIT');
  const receipts = lines.map((line) => {
    let receipt;
    try { receipt = JSON.parse(line); } catch (_) { fail('REFERENCE_LEDGER_JSON_INVALID'); }
    if (!Codec.validDigest(receipt)) fail('REFERENCE_LEDGER_DIGEST_INVALID');
    return receipt;
  });
  let observedSchema;
  try { observedSchema = StepReceipts.inferSchema(receipts, expectedSchema); }
  catch (_) { fail('REFERENCE_LEDGER_SCHEMA_INVALID'); }
  if (observedSchema !== expectedSchema) fail('REFERENCE_LEDGER_SCHEMA_INVALID');
  const seen = new Set();
  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index];
    if (StepReceipts.validate(receipt, observedSchema).length) fail('REFERENCE_LEDGER_CONTRACT_INVALID');
    if (receipt.run_id !== runId) fail('REFERENCE_LEDGER_RUN_BINDING_INVALID');
    if (seen.has(receipt.digest)) fail('REFERENCE_LEDGER_DUPLICATE_DIGEST');
    seen.add(receipt.digest);
    const expectedPrevious = index === 0 ? null : receipts[index - 1].digest;
    if (receipt.previous_receipt_digest !== expectedPrevious) fail('REFERENCE_LEDGER_CHAIN_INVALID');
  }
  return receipts;
}

function protectiveReferences(receipts) {
  const references = [];
  for (const receipt of receipts.filter((item) => item.state === 'VERIFIED')) {
    if (!PROTECTIVE_CACHE_STATES.includes(receipt.cache.state)) continue;
    if (!DIGEST.test(String(receipt.cache.entry_digest || ''))) fail('REFERENCE_CACHE_ENTRY_DIGEST_MISSING');
    references.push({ key: receipt.cache.key, entry_digest: receipt.cache.entry_digest, cache_state: receipt.cache.state, step_receipt_digest: receipt.digest });
  }
  return references;
}

function inspectedRun(anchorDigest, evidenceKind, state, ledgerSchema, receipts, references, checkpointCount, relative) {
  const verified = receipts.filter((receipt) => receipt.state === 'VERIFIED');
  return {
    run: {
      evidence_kind: evidenceKind,
      anchor_receipt_digest: anchorDigest,
      state,
      ledger_schema: ledgerSchema,
      receipt_count: receipts.length,
      verified_receipt_count: verified.length,
      ledger_tail: receipts.length ? receipts[receipts.length - 1].digest : null,
      reference_count: references.length,
      checkpoint_count: checkpointCount
    },
    references,
    locator_digest: locatorDigest(relative)
  };
}

function inspectTerminalRun(runRoot, relative, budget, counters) {
  const receiptDescriptor = plainFile(runRoot, 'run-receipt.json', 'REFERENCE_RUN_RECEIPT_MISSING');
  const ledgerDescriptor = plainFile(runRoot, 'step-receipts.jsonl', 'REFERENCE_LEDGER_MISSING');
  const receiptRaw = readBoundedFile(receiptDescriptor, MAX_RUN_RECEIPT_BYTES, 'REFERENCE_RUN_RECEIPT_TOO_LARGE');
  const ledgerRaw = readBoundedFile(ledgerDescriptor, budget.max_single_ledger_bytes, 'REFERENCE_SINGLE_LEDGER_LIMIT');
  counters.ledgerBytes += ledgerRaw.length;
  if (counters.ledgerBytes > budget.max_ledger_bytes) fail('REFERENCE_SCAN_LEDGER_BYTE_LIMIT');
  let runReceipt;
  try { runReceipt = JSON.parse(receiptRaw.toString('utf8')); }
  catch (_) { fail('REFERENCE_RUN_RECEIPT_JSON_INVALID'); }
  validateRunReceipt(runReceipt);
  const receipts = parseLedger(ledgerRaw.toString('utf8'), runReceipt.step_receipt_schema, runReceipt.id, counters, budget);
  const verified = receipts.filter((receipt) => receipt.state === 'VERIFIED');
  if (Codec.canonical(verified.map((receipt) => receipt.digest)) !== Codec.canonical(runReceipt.step_receipts)) fail('REFERENCE_RUN_RECEIPT_LEDGER_MISMATCH');
  const references = protectiveReferences(receipts);
  return inspectedRun(runReceipt.digest, 'TERMINAL_RUN_RECEIPT', runReceipt.state, runReceipt.step_receipt_schema, receipts, references, 0, relative);
}

function inspectCheckpointRun(runRoot, relative, budget, counters) {
  const checkpointDescriptor = plainFile(runRoot, 'run-checkpoints.jsonl', 'REFERENCE_CHECKPOINT_LEDGER_MISSING');
  const ledgerDescriptor = plainFile(runRoot, 'step-receipts.jsonl', 'REFERENCE_LEDGER_MISSING');
  const checkpointRaw = readBoundedFile(checkpointDescriptor, budget.max_single_checkpoint_ledger_bytes, 'REFERENCE_SINGLE_CHECKPOINT_LEDGER_LIMIT');
  const ledgerRaw = readBoundedFile(ledgerDescriptor, budget.max_single_ledger_bytes, 'REFERENCE_SINGLE_LEDGER_LIMIT');
  counters.checkpointLedgerBytes += checkpointRaw.length;
  counters.ledgerBytes += ledgerRaw.length;
  if (counters.checkpointLedgerBytes > budget.max_checkpoint_ledger_bytes) fail('REFERENCE_SCAN_CHECKPOINT_LEDGER_BYTE_LIMIT');
  if (counters.ledgerBytes > budget.max_ledger_bytes) fail('REFERENCE_SCAN_LEDGER_BYTE_LIMIT');
  let checkpoints;
  try { checkpoints = RunCheckpoints.parseLedger(checkpointRaw); }
  catch (error) {
    if (error instanceof RunCheckpoints.CheckpointError && error.code === 'RUN_CHECKPOINT_LEDGER_COUNT_LIMIT') fail('REFERENCE_SINGLE_CHECKPOINT_COUNT_LIMIT');
    fail('REFERENCE_CHECKPOINT_LEDGER_INVALID');
  }
  if (!checkpoints.length) fail('REFERENCE_CHECKPOINT_LEDGER_EMPTY');
  counters.checkpoints += checkpoints.length;
  if (counters.checkpoints > budget.max_checkpoints) fail('REFERENCE_SCAN_CHECKPOINT_LIMIT');
  const latest = checkpoints[checkpoints.length - 1];
  const receipts = parseLedger(ledgerRaw.toString('utf8'), latest.step_receipt_schema, latest.run_id, counters, budget);
  try { RunCheckpoints.assertLedgerHistory(checkpoints, receipts); }
  catch (_) { fail('REFERENCE_CHECKPOINT_HISTORY_LEDGER_MISMATCH'); }
  if (!RunCheckpoints.matchesLedger(latest, receipts)) fail('REFERENCE_CHECKPOINT_LEDGER_MISMATCH');
  const references = protectiveReferences(receipts);
  return inspectedRun(latest.digest, 'NONTERMINAL_CHECKPOINT', latest.state, latest.step_receipt_schema, receipts, references, checkpoints.length, relative);
}

function inspectRun(runRoot, relative, budget, counters) {
  if (fs.existsSync(path.join(runRoot, 'run-receipt.json'))) return inspectTerminalRun(runRoot, relative, budget, counters);
  if (fs.existsSync(path.join(runRoot, 'run-checkpoints.jsonl'))) return inspectCheckpointRun(runRoot, relative, budget, counters);
  fail('REFERENCE_RUN_ANCHOR_MISSING');
}

function snapshotDigest(receipt) {
  return Codec.digest({
    job_root_fingerprint: receipt.job_root_fingerprint,
    root_exists: receipt.root_exists,
    scan_budget: receipt.scan_budget,
    runs: receipt.runs,
    references: receipt.references,
    holds: receipt.holds,
    ignored_files: receipt.ignored_files
  });
}

function discover(options) {
  options = options || {};
  const location = locateJobRoot(options.jobRoot, options.sourceRoot), budget = scanBudget(options);
  const observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!Number.isSafeInteger(observedAt) || observedAt < 0) fail('REFERENCE_OBSERVATION_TIME_INVALID');
  const receipt = {
    schema: SCHEMA,
    version: VERSION,
    status: 'COMPLETE',
    observed_at_ms: observedAt,
    job_root_fingerprint: rootFingerprint(location.root),
    root_exists: location.exists,
    scan_budget: budget,
    runs: [],
    references: [],
    protected_keys: [],
    holds: [],
    ignored_files: 0,
    usage: { runs: 0, receipts: 0, ledger_bytes: 0, checkpoints: 0, checkpoint_ledger_bytes: 0, references: 0 },
    authority: { read_only: true, protection_granted: false, deletion: false, installed: false, promoted: false, canon: false }
  };
  if (!location.exists) {
    receipt.status = 'REVIEW_REQUIRED';
    receipt.holds.push({ locator_digest: locatorDigest('job-root'), reason: 'REFERENCE_JOB_ROOT_MISSING' });
  } else {
    const counters = { runs: 0, receipts: 0, ledgerBytes: 0, checkpoints: 0, checkpointLedgerBytes: 0 }, aggregated = new Map();
    const direct = boundedDirectNames(location.root, budget.max_directory_entries);
    for (const name of direct.names) {
      const target = path.join(location.root, name), stat = fs.lstatSync(target), relative = 'runs/' + name;
      if (stat.isSymbolicLink()) {
        receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'REFERENCE_RUN_DIRECTORY_LINK_REFUSED' });
        continue;
      }
      if (!stat.isDirectory()) { receipt.ignored_files += 1; continue; }
      counters.runs += 1;
      if (counters.runs > budget.max_runs) {
        receipt.status = 'LIMIT_EXCEEDED';
        receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'REFERENCE_SCAN_RUN_LIMIT' });
        break;
      }
      try {
        const inspected = inspectRun(target, relative, budget, counters);
        receipt.runs.push(inspected.run);
        for (const reference of inspected.references) {
          if (!aggregated.has(reference.key)) aggregated.set(reference.key, { key: reference.key, entryDigests: new Set(), anchorReceipts: new Set(), stepReceipts: new Set(), states: new Set(), evidenceKinds: new Set() });
          const item = aggregated.get(reference.key);
          item.entryDigests.add(reference.entry_digest);
          item.anchorReceipts.add(inspected.run.anchor_receipt_digest);
          item.stepReceipts.add(reference.step_receipt_digest);
          item.states.add(reference.cache_state);
          item.evidenceKinds.add(inspected.run.evidence_kind);
        }
      } catch (error) {
        const reason = error instanceof ReferenceError ? error.code : 'REFERENCE_RUN_INSPECTION_FAILED';
        if (['REFERENCE_SCAN_RECEIPT_LIMIT', 'REFERENCE_SCAN_LEDGER_BYTE_LIMIT', 'REFERENCE_SCAN_CHECKPOINT_LIMIT', 'REFERENCE_SCAN_CHECKPOINT_LEDGER_BYTE_LIMIT', 'REFERENCE_SINGLE_CHECKPOINT_LEDGER_LIMIT', 'REFERENCE_SINGLE_CHECKPOINT_COUNT_LIMIT'].includes(reason)) receipt.status = 'LIMIT_EXCEEDED';
        receipt.holds.push({ locator_digest: locatorDigest(relative), reason });
        if (receipt.status === 'LIMIT_EXCEEDED') break;
      }
    }
    if (direct.exceeded && receipt.status !== 'LIMIT_EXCEEDED') {
      receipt.status = 'LIMIT_EXCEEDED';
      receipt.holds.push({ locator_digest: locatorDigest('directory-entry-limit'), reason: 'REFERENCE_SCAN_DIRECTORY_ENTRY_LIMIT' });
    }
    receipt.runs.sort((left, right) => left.anchor_receipt_digest.localeCompare(right.anchor_receipt_digest));
    receipt.references = Array.from(aggregated.values()).map((item) => ({
      key: item.key,
      entry_digests: Array.from(item.entryDigests).sort(),
      anchor_receipt_digests: Array.from(item.anchorReceipts).sort(),
      step_receipt_digests: Array.from(item.stepReceipts).sort(),
      cache_states: Array.from(item.states).sort(),
      evidence_kinds: Array.from(item.evidenceKinds).sort()
    })).sort((left, right) => left.key.localeCompare(right.key));
    for (const reference of receipt.references) if (reference.entry_digests.length !== 1) receipt.holds.push({ key: reference.key, reason: 'REFERENCE_ENTRY_DIGEST_CONFLICT' });
    receipt.holds.sort((left, right) => String(left.key || left.locator_digest).localeCompare(String(right.key || right.locator_digest)) || left.reason.localeCompare(right.reason));
    if (receipt.status === 'COMPLETE' && receipt.holds.length) receipt.status = 'REVIEW_REQUIRED';
    receipt.protected_keys = receipt.references.map((item) => item.key);
    receipt.usage = { runs: receipt.runs.length, receipts: counters.receipts, ledger_bytes: counters.ledgerBytes, checkpoints: counters.checkpoints, checkpoint_ledger_bytes: counters.checkpointLedgerBytes, references: receipt.references.length };
  }
  receipt.authority.protection_granted = receipt.status === 'COMPLETE';
  receipt.snapshot_digest = snapshotDigest(receipt);
  return Codec.seal(receipt);
}

function validate(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== SCHEMA || receipt.version !== VERSION || !Codec.validDigest(receipt)) return ['cache reference set integrity is invalid'];
  if (!exactKeys(receipt, ['schema', 'version', 'status', 'observed_at_ms', 'job_root_fingerprint', 'root_exists', 'scan_budget', 'runs', 'references', 'protected_keys', 'holds', 'ignored_files', 'usage', 'authority', 'snapshot_digest', 'digest'])) errors.push('cache reference set shape is invalid');
  if (!['COMPLETE', 'REVIEW_REQUIRED', 'LIMIT_EXCEEDED'].includes(receipt.status)) errors.push('cache reference set status is invalid');
  if (!Number.isSafeInteger(receipt.observed_at_ms) || receipt.observed_at_ms < 0 || typeof receipt.root_exists !== 'boolean' || !Number.isSafeInteger(receipt.ignored_files) || receipt.ignored_files < 0) errors.push('cache reference set observation is invalid');
  let snapshotValid = false;
  try { snapshotValid = receipt.snapshot_digest === snapshotDigest(receipt); } catch (_) { snapshotValid = false; }
  if (!DIGEST.test(String(receipt.job_root_fingerprint || '')) || !DIGEST.test(String(receipt.snapshot_digest || '')) || !snapshotValid) errors.push('cache reference set snapshot is invalid');
  const budget = receipt.scan_budget;
  if (!exactKeys(budget, ['max_directory_entries', 'max_runs', 'max_receipts', 'max_ledger_bytes', 'max_single_ledger_bytes', 'max_checkpoints', 'max_checkpoint_ledger_bytes', 'max_single_checkpoint_ledger_bytes']) || !Number.isInteger(budget.max_directory_entries) || budget.max_directory_entries < 1 || budget.max_directory_entries > DEFAULT_MAX_DIRECTORY_ENTRIES || !Number.isInteger(budget.max_runs) || budget.max_runs < 1 || budget.max_runs > DEFAULT_MAX_RUNS || !Number.isInteger(budget.max_receipts) || budget.max_receipts < 1 || budget.max_receipts > DEFAULT_MAX_RECEIPTS || !Number.isSafeInteger(budget.max_ledger_bytes) || budget.max_ledger_bytes < 1 || budget.max_ledger_bytes > DEFAULT_MAX_LEDGER_BYTES || budget.max_single_ledger_bytes !== MAX_SINGLE_LEDGER_BYTES || !Number.isInteger(budget.max_checkpoints) || budget.max_checkpoints < 1 || budget.max_checkpoints > DEFAULT_MAX_CHECKPOINTS || !Number.isSafeInteger(budget.max_checkpoint_ledger_bytes) || budget.max_checkpoint_ledger_bytes < 1 || budget.max_checkpoint_ledger_bytes > DEFAULT_MAX_CHECKPOINT_LEDGER_BYTES || budget.max_single_checkpoint_ledger_bytes !== RunCheckpoints.MAX_LEDGER_BYTES) errors.push('cache reference scan budget is invalid');
  if (!Array.isArray(receipt.runs) || receipt.runs.some((run) => !exactKeys(run, ['evidence_kind', 'anchor_receipt_digest', 'state', 'ledger_schema', 'receipt_count', 'verified_receipt_count', 'ledger_tail', 'reference_count', 'checkpoint_count']) || !['TERMINAL_RUN_RECEIPT', 'NONTERMINAL_CHECKPOINT'].includes(run.evidence_kind) || !DIGEST.test(String(run.anchor_receipt_digest || '')) || !(TERMINAL_STATES.includes(run.state) || run.state === 'INTERRUPTED') || (run.evidence_kind === 'TERMINAL_RUN_RECEIPT' && (!TERMINAL_STATES.includes(run.state) || run.checkpoint_count !== 0)) || (run.evidence_kind === 'NONTERMINAL_CHECKPOINT' && (run.state !== 'INTERRUPTED' || !Number.isSafeInteger(run.checkpoint_count) || run.checkpoint_count < 1)) || !Object.values(StepReceipts.SCHEMAS).includes(run.ledger_schema) || !Number.isSafeInteger(run.receipt_count) || run.receipt_count < 0 || !Number.isSafeInteger(run.verified_receipt_count) || run.verified_receipt_count < 0 || run.verified_receipt_count > run.receipt_count || !Number.isSafeInteger(run.reference_count) || run.reference_count < 0 || run.reference_count > run.verified_receipt_count || (run.receipt_count === 0 ? run.ledger_tail !== null : !DIGEST.test(String(run.ledger_tail || ''))))) errors.push('cache reference run summaries are invalid');
  if (!Array.isArray(receipt.references) || receipt.references.some((item) => !exactKeys(item, ['key', 'entry_digests', 'anchor_receipt_digests', 'step_receipt_digests', 'cache_states', 'evidence_kinds']) || !DIGEST.test(String(item.key || '')) || !Array.isArray(item.entry_digests) || !item.entry_digests.length || item.entry_digests.some((digest) => !DIGEST.test(String(digest || ''))) || new Set(item.entry_digests).size !== item.entry_digests.length || !Array.isArray(item.anchor_receipt_digests) || !item.anchor_receipt_digests.length || item.anchor_receipt_digests.some((digest) => !DIGEST.test(String(digest || ''))) || new Set(item.anchor_receipt_digests).size !== item.anchor_receipt_digests.length || !Array.isArray(item.step_receipt_digests) || !item.step_receipt_digests.length || item.step_receipt_digests.some((digest) => !DIGEST.test(String(digest || ''))) || new Set(item.step_receipt_digests).size !== item.step_receipt_digests.length || !Array.isArray(item.cache_states) || !item.cache_states.length || item.cache_states.some((state) => !PROTECTIVE_CACHE_STATES.includes(state)) || new Set(item.cache_states).size !== item.cache_states.length || !Array.isArray(item.evidence_kinds) || !item.evidence_kinds.length || item.evidence_kinds.some((kind) => !['TERMINAL_RUN_RECEIPT', 'NONTERMINAL_CHECKPOINT'].includes(kind)) || new Set(item.evidence_kinds).size !== item.evidence_kinds.length)) errors.push('cache reference bindings are invalid');
  const referenceKeys = Array.isArray(receipt.references) ? receipt.references.filter((item) => item && DIGEST.test(String(item.key || ''))).map((item) => item.key).sort() : [];
  if (!Array.isArray(receipt.protected_keys) || receipt.protected_keys.some((key) => !DIGEST.test(String(key || ''))) || new Set(receipt.protected_keys).size !== receipt.protected_keys.length || Codec.canonical(receipt.protected_keys.slice().sort()) !== Codec.canonical(referenceKeys)) errors.push('cache reference protected keys are invalid');
  if (!Array.isArray(receipt.holds) || receipt.holds.some((hold) => !hold || typeof hold.reason !== 'string' || !hold.reason || (!DIGEST.test(String(hold.key || '')) && !DIGEST.test(String(hold.locator_digest || ''))) || (hold.key != null && hold.locator_digest != null) || !exactKeys(hold, hold.key != null ? ['key', 'reason'] : ['locator_digest', 'reason']))) errors.push('cache reference holds are invalid');
  const usage = receipt.usage;
  const inspectedReceipts = Array.isArray(receipt.runs) ? receipt.runs.reduce((sum, run) => sum + (run && Number.isSafeInteger(run.receipt_count) ? run.receipt_count : 0), 0) : 0;
  const inspectedCheckpoints = Array.isArray(receipt.runs) ? receipt.runs.reduce((sum, run) => sum + (run && Number.isSafeInteger(run.checkpoint_count) ? run.checkpoint_count : 0), 0) : 0;
  if (!exactKeys(usage, ['runs', 'receipts', 'ledger_bytes', 'checkpoints', 'checkpoint_ledger_bytes', 'references']) || !Number.isSafeInteger(usage.runs) || usage.runs !== (Array.isArray(receipt.runs) ? receipt.runs.length : -1) || !Number.isSafeInteger(usage.receipts) || usage.receipts < inspectedReceipts || !Number.isSafeInteger(usage.ledger_bytes) || usage.ledger_bytes < 0 || !Number.isSafeInteger(usage.checkpoints) || usage.checkpoints < inspectedCheckpoints || !Number.isSafeInteger(usage.checkpoint_ledger_bytes) || usage.checkpoint_ledger_bytes < 0 || !Number.isSafeInteger(usage.references) || usage.references !== (Array.isArray(receipt.references) ? receipt.references.length : -1)) errors.push('cache reference usage is invalid');
  if (receipt.status === 'COMPLETE' && (!Array.isArray(receipt.holds) || !Array.isArray(receipt.references) || receipt.holds.length || receipt.references.some((item) => !item || !Array.isArray(item.entry_digests) || item.entry_digests.length !== 1))) errors.push('complete cache reference set contains unresolved holds');
  if (!receipt.root_exists && (receipt.status === 'COMPLETE' || (!Array.isArray(receipt.runs) || receipt.runs.length) || (!Array.isArray(receipt.references) || receipt.references.length) || (!Array.isArray(receipt.protected_keys) || receipt.protected_keys.length) || (exactKeys(receipt.usage, ['runs', 'receipts', 'ledger_bytes', 'checkpoints', 'checkpoint_ledger_bytes', 'references']) && Object.values(receipt.usage).some((value) => value !== 0)))) errors.push('missing cache reference root contains invented observations');
  if (!exactKeys(receipt.authority, ['read_only', 'protection_granted', 'deletion', 'installed', 'promoted', 'canon']) || receipt.authority.read_only !== true || receipt.authority.deletion !== false || receipt.authority.installed !== false || receipt.authority.promoted !== false || receipt.authority.canon !== false || receipt.authority.protection_granted !== (receipt.status === 'COMPLETE')) errors.push('cache reference authority is invalid');
  return errors;
}

function assertValid(receipt) {
  const errors = validate(receipt);
  if (errors.length) throw new Error(errors.join('; '));
  return receipt;
}

module.exports = { SCHEMA, VERSION, TERMINAL_STATES, PROTECTIVE_CACHE_STATES, ReferenceError, discover, validate, assertValid };
