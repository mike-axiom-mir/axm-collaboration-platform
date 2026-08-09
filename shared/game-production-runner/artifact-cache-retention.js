'use strict';

const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');
const Contracts = require('./contracts');
const ArtifactCache = require('./artifact-cache');

const INVENTORY_SCHEMA = 'axm.production-artifact-cache-inventory/v1';
const PROPOSAL_SCHEMA = 'axm.production-artifact-cache-retention-proposal/v1';
const APPLICATION_SCHEMA = 'axm.production-artifact-cache-retention-application/v1';
const VERSION = '0.1.0';
const DIGEST = /^[a-f0-9]{64}$/;
const PREFIX = /^[a-f0-9]{2}$/;
const DEFAULT_SCAN_MAX_ENTRIES = 100000;
const DEFAULT_SCAN_MAX_FILES = 1000000;
const MAX_MANIFEST_BYTES = 1048576;

class RetentionError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RetentionError';
    this.code = code;
  }
}

function fail(code) { throw new RetentionError(code); }
function finiteInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function exactKeys(value, allowed) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key)); }

function normalizePolicy(policy) {
  if (!exactKeys(policy, ['max_entries', 'max_logical_bytes', 'max_filesystem_age_ms'])) fail('RETENTION_POLICY_SHAPE_INVALID');
  for (const key of ['max_entries', 'max_logical_bytes', 'max_filesystem_age_ms']) if (!finiteInteger(policy[key])) fail('RETENTION_POLICY_VALUE_INVALID');
  return { max_entries: policy.max_entries, max_logical_bytes: policy.max_logical_bytes, max_filesystem_age_ms: policy.max_filesystem_age_ms };
}

function normalizeProtectedKeys(keys) {
  if (!Array.isArray(keys) || keys.length > DEFAULT_SCAN_MAX_ENTRIES || keys.some((key) => !DIGEST.test(String(key || '')))) fail('RETENTION_PROTECTED_KEYS_INVALID');
  return Array.from(new Set(keys)).sort();
}

function scanBudget(options) {
  const entries = options && options.scanMaxEntries == null ? DEFAULT_SCAN_MAX_ENTRIES : options.scanMaxEntries;
  const files = options && options.scanMaxFiles == null ? DEFAULT_SCAN_MAX_FILES : options.scanMaxFiles;
  if (!Number.isInteger(entries) || entries < 1 || entries > DEFAULT_SCAN_MAX_ENTRIES || !Number.isInteger(files) || files < 1 || files > DEFAULT_SCAN_MAX_FILES) fail('RETENTION_SCAN_BUDGET_INVALID');
  return { max_entries: entries, max_files: files };
}

function locatorDigest(relative) { return Codec.sha256(Buffer.from(String(relative).replace(/\\/g, '/'), 'utf8')); }
function rootFingerprint(root) {
  const resolved = path.resolve(root);
  return Codec.sha256(Buffer.from(process.platform === 'win32' ? resolved.toLowerCase() : resolved, 'utf8'));
}

function walkPlainTree(root, budget, counters) {
  const files = [], directories = [];
  function walk(directory, relative) {
    const names = fs.readdirSync(directory).sort();
    for (const name of names) {
      counters.files += 1;
      if (counters.files > budget.max_files) fail('RETENTION_SCAN_FILE_LIMIT');
      const target = path.join(directory, name), childRelative = relative ? relative + '/' + name : name;
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) fail('RETENTION_ENTRY_LINK_REFUSED');
      if (stat.isDirectory()) {
        directories.push(childRelative);
        walk(target, childRelative);
      } else if (stat.isFile()) {
        files.push({ relative: childRelative, bytes: stat.size, mtime_ms: Math.trunc(stat.mtimeMs) });
      } else fail('RETENTION_ENTRY_SPECIAL_FILE_REFUSED');
    }
  }
  walk(root, '');
  return { files, directories };
}

function expectedDirectories(artifactPaths) {
  const expected = new Set(['artifacts']);
  for (const artifactPath of artifactPaths) {
    let cursor = path.posix.dirname('artifacts/' + artifactPath);
    while (cursor !== '.' && cursor !== '') {
      expected.add(cursor);
      cursor = path.posix.dirname(cursor);
    }
  }
  return Array.from(expected).sort();
}

function inspectEntry(entryRoot, key, budget, counters) {
  const rootStat = fs.lstatSync(entryRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('RETENTION_ENTRY_NOT_PLAIN_DIRECTORY');
  const tree = walkPlainTree(entryRoot, budget, counters);
  const manifestDescriptor = tree.files.find((item) => item.relative === 'entry.json');
  if (!manifestDescriptor) fail('RETENTION_ENTRY_MANIFEST_MISSING');
  if (manifestDescriptor.bytes > MAX_MANIFEST_BYTES) fail('RETENTION_ENTRY_MANIFEST_TOO_LARGE');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(entryRoot, 'entry.json'), 'utf8')); }
  catch (_) { fail('RETENTION_ENTRY_MANIFEST_UNREADABLE'); }
  if (!manifest || manifest.schema !== ArtifactCache.ENTRY_SCHEMA || manifest.version !== VERSION || manifest.key !== key || !Codec.validDigest(manifest)) fail('RETENTION_ENTRY_MANIFEST_INVALID');
  if (!manifest.binding || Codec.digest(manifest.binding) !== key) fail('RETENTION_ENTRY_BINDING_INVALID');
  if (!manifest.authority || manifest.authority.execution !== false || manifest.authority.installed !== false || manifest.authority.promoted !== false || manifest.authority.canon !== false || manifest.authority.released !== false) fail('RETENTION_ENTRY_AUTHORITY_INVALID');
  if (!Array.isArray(manifest.artifacts) || !manifest.artifacts.length) fail('RETENTION_ENTRY_ARTIFACTS_INVALID');
  const artifactPaths = [];
  for (const descriptor of manifest.artifacts) {
    if (!descriptor || !Contracts.safeRelative(descriptor.path) || descriptor.entry_relative_path !== 'artifacts/' + descriptor.path || !Number.isInteger(descriptor.bytes) || descriptor.bytes < 0 || !DIGEST.test(String(descriptor.digest || ''))) fail('RETENTION_ENTRY_ARTIFACT_DESCRIPTOR_INVALID');
    artifactPaths.push(descriptor.path);
    const observed = tree.files.find((item) => item.relative === descriptor.entry_relative_path);
    if (!observed || observed.bytes !== descriptor.bytes) fail('RETENTION_ENTRY_ARTIFACT_LAYOUT_INVALID');
  }
  if (new Set(artifactPaths).size !== artifactPaths.length) fail('RETENTION_ENTRY_ARTIFACT_DUPLICATE');
  const expectedFiles = ['entry.json'].concat(artifactPaths.map((item) => 'artifacts/' + item)).sort();
  if (Codec.canonical(tree.files.map((item) => item.relative).sort()) !== Codec.canonical(expectedFiles)) fail('RETENTION_ENTRY_UNDECLARED_FILE');
  if (Codec.canonical(tree.directories.sort()) !== Codec.canonical(expectedDirectories(artifactPaths))) fail('RETENTION_ENTRY_UNDECLARED_DIRECTORY');
  const logicalBytes = tree.files.reduce((sum, item) => sum + item.bytes, 0);
  const observedMtime = Math.max(Math.trunc(rootStat.mtimeMs), ...tree.files.map((item) => item.mtime_ms));
  return {
    key,
    entry_digest: manifest.digest,
    logical_bytes: logicalBytes,
    file_count: tree.files.length,
    observed_mtime_ms: observedMtime,
    classification: 'TEMPORARY_CAPTURE',
    integrity_scope: 'SEALED_MANIFEST_LAYOUT_AND_SIZE'
  };
}

function snapshotDigest(receipt) {
  return Codec.digest({
    root_fingerprint: receipt.root_fingerprint,
    root_exists: receipt.root_exists,
    entries_root_exists: receipt.entries_root_exists,
    entries: receipt.entries,
    unclassified: receipt.unclassified,
    temporary_publishers: receipt.temporary_publishers
  });
}

function inventory(options) {
  options = options || {};
  const location = ArtifactCache.locate(options), budget = scanBudget(options);
  const observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(observedAt)) fail('RETENTION_OBSERVATION_TIME_INVALID');
  const receipt = {
    schema: INVENTORY_SCHEMA,
    version: VERSION,
    status: 'COMPLETE',
    observed_at_ms: observedAt,
    root_fingerprint: rootFingerprint(location.root),
    root_exists: location.exists,
    entries_root_exists: location.entriesExist,
    scan_budget: budget,
    entries: [],
    unclassified: [],
    temporary_publishers: 0,
    usage: { entries: 0, logical_bytes: 0, unclassified: 0 }
  };
  if (location.entriesExist) {
    const counters = { entries: 0, files: 0 };
    outer: for (const prefix of fs.readdirSync(location.entriesRoot).sort()) {
      const prefixRoot = path.join(location.entriesRoot, prefix), prefixStat = fs.lstatSync(prefixRoot);
      if (!PREFIX.test(prefix) || !prefixStat.isDirectory() || prefixStat.isSymbolicLink()) {
        receipt.unclassified.push({ locator_digest: locatorDigest('entries/' + prefix), reason: 'RETENTION_PREFIX_LAYOUT_INVALID' });
        continue;
      }
      for (const name of fs.readdirSync(prefixRoot).sort()) {
        if (name.includes('.next-')) { receipt.temporary_publishers += 1; continue; }
        const relative = 'entries/' + prefix + '/' + name;
        if (!DIGEST.test(name) || name.slice(0, 2) !== prefix) {
          receipt.unclassified.push({ locator_digest: locatorDigest(relative), reason: 'RETENTION_ENTRY_KEY_LAYOUT_INVALID' });
          continue;
        }
        counters.entries += 1;
        if (counters.entries > budget.max_entries) {
          receipt.status = 'LIMIT_EXCEEDED';
          receipt.unclassified.push({ key: name, reason: 'RETENTION_SCAN_ENTRY_LIMIT' });
          break outer;
        }
        try { receipt.entries.push(inspectEntry(path.join(prefixRoot, name), name, budget, counters)); }
        catch (error) {
          if (error instanceof RetentionError && error.code === 'RETENTION_SCAN_FILE_LIMIT') {
            receipt.status = 'LIMIT_EXCEEDED';
            receipt.unclassified.push({ key: name, reason: error.code });
            break outer;
          }
          receipt.unclassified.push({ key: name, reason: error instanceof RetentionError ? error.code : 'RETENTION_ENTRY_INSPECTION_FAILED' });
        }
      }
    }
    receipt.entries.sort((left, right) => left.key.localeCompare(right.key));
    receipt.unclassified.sort((left, right) => String(left.key || left.locator_digest).localeCompare(String(right.key || right.locator_digest)));
    if (receipt.status === 'COMPLETE' && (receipt.unclassified.length || receipt.temporary_publishers)) receipt.status = 'REVIEW_REQUIRED';
  }
  receipt.usage = {
    entries: receipt.entries.length,
    logical_bytes: receipt.entries.reduce((sum, item) => sum + item.logical_bytes, 0),
    unclassified: receipt.unclassified.length
  };
  receipt.snapshot_digest = snapshotDigest(receipt);
  return Codec.seal(receipt);
}

function validateInventory(receipt) {
  if (!receipt || receipt.schema !== INVENTORY_SCHEMA || receipt.version !== VERSION || !Codec.validDigest(receipt) || !DIGEST.test(String(receipt.snapshot_digest || '')) || receipt.snapshot_digest !== snapshotDigest(receipt)) fail('RETENTION_INVENTORY_INVALID');
}

function plan(inventoryReceipt, policyValue, protectedKeysValue) {
  validateInventory(inventoryReceipt);
  const policy = normalizePolicy(policyValue), protectedKeys = normalizeProtectedKeys(protectedKeysValue || []), protectedSet = new Set(protectedKeys);
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    status: 'READY',
    inventory_digest: inventoryReceipt.digest,
    inventory_snapshot_digest: inventoryReceipt.snapshot_digest,
    inventory_observed_at_ms: inventoryReceipt.observed_at_ms,
    inventory_scan_budget: Codec.clone(inventoryReceipt.scan_budget),
    root_fingerprint: inventoryReceipt.root_fingerprint,
    policy,
    references: { protected_keys: protectedKeys, absent_keys: protectedKeys.filter((key) => !inventoryReceipt.entries.some((entry) => entry.key === key)) },
    usage_before: Codec.clone(inventoryReceipt.usage),
    candidates: [],
    protected: [],
    predicted_after: { entries: inventoryReceipt.usage.entries, logical_bytes: inventoryReceipt.usage.logical_bytes, policy_satisfied: false },
    application_allowed: false,
    authority: { read_only: true, deletion: false, explicit_approval_required: true, installed: false, promoted: false, canon: false }
  };
  if (inventoryReceipt.status !== 'COMPLETE') {
    proposal.status = 'HELD';
    return Codec.seal(proposal);
  }
  const observedAt = inventoryReceipt.observed_at_ms;
  const ordered = inventoryReceipt.entries.slice().sort((left, right) => left.observed_mtime_ms - right.observed_mtime_ms || left.key.localeCompare(right.key));
  const selected = new Map();
  for (const entry of ordered) {
    const age = Math.max(0, observedAt - entry.observed_mtime_ms);
    if (protectedSet.has(entry.key)) {
      proposal.protected.push({ key: entry.key, entry_digest: entry.entry_digest, logical_bytes: entry.logical_bytes, filesystem_age_ms: age });
      continue;
    }
    if (age > policy.max_filesystem_age_ms) selected.set(entry.key, ['FILESYSTEM_AGE']);
  }
  let remainingEntries = inventoryReceipt.usage.entries - selected.size;
  let remainingBytes = inventoryReceipt.usage.logical_bytes - ordered.filter((entry) => selected.has(entry.key)).reduce((sum, entry) => sum + entry.logical_bytes, 0);
  for (const entry of ordered) {
    if (protectedSet.has(entry.key) || selected.has(entry.key)) continue;
    if (remainingEntries <= policy.max_entries && remainingBytes <= policy.max_logical_bytes) break;
    const reasons = [];
    if (remainingEntries > policy.max_entries) reasons.push('ENTRY_COUNT');
    if (remainingBytes > policy.max_logical_bytes) reasons.push('LOGICAL_BYTES');
    selected.set(entry.key, reasons);
    remainingEntries -= 1;
    remainingBytes -= entry.logical_bytes;
  }
  proposal.candidates = ordered.filter((entry) => selected.has(entry.key)).map((entry) => ({
    key: entry.key,
    entry_digest: entry.entry_digest,
    logical_bytes: entry.logical_bytes,
    observed_mtime_ms: entry.observed_mtime_ms,
    reasons: selected.get(entry.key)
  }));
  const protectedAgeViolation = proposal.protected.some((entry) => entry.filesystem_age_ms > policy.max_filesystem_age_ms);
  const policySatisfied = remainingEntries <= policy.max_entries && remainingBytes <= policy.max_logical_bytes && !protectedAgeViolation;
  proposal.predicted_after = { entries: remainingEntries, logical_bytes: remainingBytes, policy_satisfied: policySatisfied };
  proposal.status = proposal.candidates.length ? (policySatisfied ? 'READY' : 'READY_WITH_LIMITS') : (policySatisfied ? 'NO_CHANGES' : 'HELD');
  proposal.application_allowed = proposal.candidates.length > 0 && ['READY', 'READY_WITH_LIMITS'].includes(proposal.status);
  return Codec.seal(proposal);
}

function applicationReceipt(proposalDigest, approvedDigest, status, explicit, outcomes, usageAfter, policySatisfied, recordedAtValue) {
  const recordedAt = recordedAtValue == null ? Date.now() : recordedAtValue;
  if (!finiteInteger(recordedAt)) fail('RETENTION_APPLICATION_TIME_INVALID');
  return Codec.seal({
    schema: APPLICATION_SCHEMA,
    version: VERSION,
    proposal_digest: String(proposalDigest || ''),
    approved_digest: String(approvedDigest || ''),
    status,
    explicit: explicit === true,
    recorded_at_ms: recordedAt,
    outcomes: outcomes || [],
    usage_after: usageAfter || null,
    policy_satisfied: policySatisfied === true,
    authority: { deletion_performed: !!(outcomes && outcomes.some((item) => item.entry_removed)), installed: false, promoted: false, canon: false }
  });
}

function applicationNotRequested(approvedDigest) { return applicationReceipt('', approvedDigest, 'NOT_REQUESTED', false, [], null, false); }

function validateProposal(proposal) {
  if (!proposal || proposal.schema !== PROPOSAL_SCHEMA || proposal.version !== VERSION || !Codec.validDigest(proposal)) fail('RETENTION_PROPOSAL_INVALID');
  if (!finiteInteger(proposal.inventory_observed_at_ms) || !proposal.inventory_scan_budget || !Number.isInteger(proposal.inventory_scan_budget.max_entries) || !Number.isInteger(proposal.inventory_scan_budget.max_files)) fail('RETENTION_PROPOSAL_INVENTORY_BINDING_INVALID');
  normalizePolicy(proposal.policy);
  normalizeProtectedKeys(proposal.references && proposal.references.protected_keys || []);
  if (!Array.isArray(proposal.candidates) || proposal.candidates.some((item) => !item || !DIGEST.test(String(item.key || '')) || !DIGEST.test(String(item.entry_digest || '')) || !finiteInteger(item.logical_bytes) || !finiteInteger(item.observed_mtime_ms))) fail('RETENTION_PROPOSAL_CANDIDATES_INVALID');
}

function apply(options) {
  options = options || {};
  const proposal = options.proposal;
  const recordedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(recordedAt)) fail('RETENTION_APPLICATION_TIME_INVALID');
  validateProposal(proposal);
  if (options.explicit !== true) return applicationReceipt(proposal.digest, options.approvedDigest, 'NOT_APPROVED', false, [], null, false, recordedAt);
  if (options.approvedDigest !== proposal.digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'APPROVAL_MISMATCH', true, [], null, false, recordedAt);
  if (!proposal.application_allowed) return applicationReceipt(proposal.digest, options.approvedDigest, 'PROPOSAL_NOT_APPLICABLE', true, [], proposal.usage_before, proposal.predicted_after.policy_satisfied, recordedAt);
  const current = inventory(Object.assign({}, options, {
    nowMs: proposal.inventory_observed_at_ms,
    scanMaxEntries: proposal.inventory_scan_budget.max_entries,
    scanMaxFiles: proposal.inventory_scan_budget.max_files
  }));
  if (current.status !== 'COMPLETE' || current.root_fingerprint !== proposal.root_fingerprint || current.snapshot_digest !== proposal.inventory_snapshot_digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, [], current.usage, false, recordedAt);
  if (current.digest !== proposal.inventory_digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, [], current.usage, false, recordedAt);
  const reproduced = plan(current, proposal.policy, proposal.references.protected_keys);
  if (reproduced.digest !== proposal.digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'PROPOSAL_NOT_REPRODUCIBLE', true, [], current.usage, false, recordedAt);
  const currentByKey = new Map(current.entries.map((entry) => [entry.key, entry]));
  for (const candidate of proposal.candidates) {
    const observed = currentByKey.get(candidate.key);
    if (!observed || observed.entry_digest !== candidate.entry_digest || observed.logical_bytes !== candidate.logical_bytes || observed.observed_mtime_ms !== candidate.observed_mtime_ms) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, [], current.usage, false, recordedAt);
  }
  const cache = ArtifactCache.open(options), outcomes = [];
  for (const candidate of proposal.candidates) {
    const result = cache.invalidate(candidate.key, { explicit: true });
    outcomes.push({ key: candidate.key, entry_digest: candidate.entry_digest, classification: 'TEMPORARY_CAPTURE', status: result.status, entry_removed: result.entry_removed === true, invalidation_receipt_digest: result.digest });
    if (result.status !== 'REMOVED') break;
  }
  const after = inventory(options), afterPlan = plan(after, proposal.policy, proposal.references.protected_keys);
  const allRemoved = outcomes.length === proposal.candidates.length && outcomes.every((item) => item.entry_removed);
  const policySatisfied = after.status === 'COMPLETE' && afterPlan.predicted_after.policy_satisfied && afterPlan.candidates.length === 0;
  const status = allRemoved ? (policySatisfied ? 'APPLIED' : 'APPLIED_WITH_LIMITS') : 'PARTIAL';
  return applicationReceipt(proposal.digest, options.approvedDigest, status, true, outcomes, after.usage, policySatisfied, recordedAt);
}

module.exports = {
  INVENTORY_SCHEMA,
  PROPOSAL_SCHEMA,
  APPLICATION_SCHEMA,
  VERSION,
  RetentionError,
  inventory,
  plan,
  apply,
  applicationNotRequested,
  normalizePolicy,
  validateInventory,
  validateProposal
};
