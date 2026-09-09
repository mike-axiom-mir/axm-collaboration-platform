'use strict';

const crypto = require('crypto');
const SEMANTICS = new Set(['CRDT_MERGEABLE', 'APPEND_ONLY', 'LAST_WRITER_NOT_ALLOWED', 'HUMAN_RECONCILIATION_REQUIRED', 'SINGLE_AUTHORITY', 'IMMUTABLE']);
const SENSITIVE_NAMESPACE = /(?:^|[.:/_-])(foundation|canon|roots?|authority)(?:$|[.:/_-])/i;
const SHA256 = /^[a-f0-9]{64}$/;
const SNAPSHOT_KEYS = ['authorityDomain', 'id', 'namespace', 'parentDigests', 'revision', 'schema', 'snapshotDigest', 'value', 'valueSchema'];
const RULE_KEYS = ['id', 'namespace', 'owner', 'ruleDigest', 'schema', 'semantics', 'strategy'];
const ADMISSION_KEYS = ['admissionDigest', 'namespace', 'ruleDigest', 'schema'];

class SyncError extends Error {
  constructor(code, message, details) { super(message); this.name = 'SyncError'; this.code = code; this.details = details || null; }
}
function canonical(value, path = '$', ancestors = new Set()) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new SyncError('INVALID_CANONICAL_VALUE', `${path} contains a non-finite number`);
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new SyncError('INVALID_CANONICAL_VALUE', `${path} contains unsupported ${typeof value} data`);
  if (ancestors.has(value)) throw new SyncError('INVALID_CANONICAL_VALUE', `${path} contains a cycle`);
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      throw new SyncError('INVALID_CANONICAL_VALUE', `${path} must be a dense JSON array without extra properties`);
    }
  } else if (prototype !== Object.prototype && prototype !== null) {
    throw new SyncError('INVALID_CANONICAL_VALUE', `${path} must contain only plain JSON objects`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) throw new SyncError('INVALID_CANONICAL_VALUE', `${path} contains symbol keys`);
  const propertyNames = Object.getOwnPropertyNames(value).filter(key => !(Array.isArray(value) && key === 'length'));
  if (propertyNames.length !== Object.keys(value).length) throw new SyncError('INVALID_CANONICAL_VALUE', `${path} contains non-enumerable data`);
  for (const key of propertyNames) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new SyncError('INVALID_CANONICAL_VALUE', `${path}.${key} must be inert data, not an accessor`);
    }
  }
  ancestors.add(value);
  let output;
  if (Array.isArray(value)) {
    output = '[' + value.map((item, index) => canonical(item, `${path}[${index}]`, ancestors)).join(',') + ']';
  } else {
    output = '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key], `${path}.${key}`, ancestors)).join(',') + '}';
  }
  ancestors.delete(value);
  return output;
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function requireObject(value, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new SyncError(code, `${label} must be a plain object`);
  }
}
function requireString(value, code, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new SyncError(code, `${label} must be a non-empty string`);
  return value;
}
function requireInertProperties(value, code, label) {
  if (Object.getOwnPropertySymbols(value).length > 0) throw new SyncError(code, `${label} fields must not include symbols`);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new SyncError(code, `${label} fields must be enumerable inert data`);
    }
  }
}
function requireExactKeys(value, expected, code, label) {
  requireInertProperties(value, code, label);
  const actual = Object.getOwnPropertyNames(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new SyncError(code, `${label} fields must match its sealed contract`, { expected, actual });
  }
}
function requireDigest(value, code, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new SyncError(code, `${label} must be a lowercase SHA-256 digest`);
}

function snapshotPayload(input) {
  requireObject(input, 'INVALID_STATE_SNAPSHOT', 'Snapshot');
  requireInertProperties(input, 'INVALID_STATE_SNAPSHOT', 'Snapshot');
  const id = requireString(input.id, 'INVALID_STATE_SNAPSHOT', 'Snapshot id');
  const namespace = requireString(input.namespace, 'INVALID_STATE_SNAPSHOT', 'Snapshot namespace');
  const valueSchema = requireString(input.valueSchema, 'INVALID_STATE_SNAPSHOT', 'Snapshot valueSchema');
  const authorityDomain = requireString(input.authorityDomain, 'INVALID_STATE_SNAPSHOT', 'Snapshot authorityDomain');
  const revision = input.revision;
  if (!Number.isInteger(revision) || revision < 0) throw new SyncError('INVALID_STATE_REVISION', 'Snapshot revision must be a non-negative integer');
  if (!Array.isArray(input.parentDigests)) throw new SyncError('INVALID_SNAPSHOT_PARENTS', 'Snapshot parentDigests must be an array');
  canonical(input.parentDigests, '$.parentDigests');
  input.parentDigests.forEach((digest, index) => requireDigest(digest, 'INVALID_SNAPSHOT_PARENTS', `Snapshot parentDigests[${index}]`));
  const parentDigests = [...input.parentDigests].sort();
  if (new Set(parentDigests).size !== parentDigests.length) throw new SyncError('INVALID_SNAPSHOT_PARENTS', 'Snapshot parentDigests must be unique');
  canonical(input.value, '$.value');
  return { schema: 'axm.state-snapshot/v1', id, namespace, valueSchema, value: input.value, revision, parentDigests, authorityDomain };
}

function snapshot(input) {
  const base = snapshotPayload(input);
  return { ...base, snapshotDigest: sha256(canonical(base)) };
}

function rulePayload(input) {
  requireObject(input, 'INVALID_MERGE_RULE', 'Merge rule');
  requireInertProperties(input, 'INVALID_MERGE_RULE', 'Merge rule');
  const id = requireString(input.id, 'INVALID_MERGE_RULE', 'Merge rule id');
  const namespace = requireString(input.namespace, 'INVALID_MERGE_RULE', 'Merge rule namespace');
  const owner = requireString(input.owner, 'INVALID_MERGE_RULE', 'Merge rule owner');
  if (!SEMANTICS.has(input.semantics)) throw new SyncError('INVALID_MERGE_RULE', 'Merge rule requires known semantics');
  if (input.semantics === 'CRDT_MERGEABLE' && input.strategy !== 'G_SET') throw new SyncError('UNPROVEN_CRDT_STRATEGY', 'v0.1 proves only the grow-only set strategy');
  if (input.semantics !== 'CRDT_MERGEABLE' && input.strategy != null) throw new SyncError('UNEXPECTED_MERGE_STRATEGY', 'Only CRDT_MERGEABLE rules may name a strategy');
  return { schema: 'axm.merge-rule/v1', id, namespace, semantics: input.semantics, strategy: input.strategy || null, owner };
}

function rule(input) {
  const base = rulePayload(input);
  return { ...base, ruleDigest: sha256(canonical(base)) };
}

function verifySnapshot(value) {
  requireObject(value, 'INVALID_STATE_SNAPSHOT', 'Snapshot');
  requireExactKeys(value, SNAPSHOT_KEYS, 'SNAPSHOT_ENVELOPE_DRIFT', 'Snapshot');
  if (value.schema !== 'axm.state-snapshot/v1') throw new SyncError('SNAPSHOT_SCHEMA_DRIFT', 'Snapshot schema must be axm.state-snapshot/v1');
  requireDigest(value.snapshotDigest, 'INVALID_SNAPSHOT_DIGEST', 'Snapshot snapshotDigest');
  const base = snapshotPayload(value);
  if (canonical(value.parentDigests) !== canonical(base.parentDigests)) throw new SyncError('SNAPSHOT_PARENT_ORDER_DRIFT', 'Snapshot parentDigests must be sorted');
  const expectedDigest = sha256(canonical(base));
  if (value.snapshotDigest !== expectedDigest) throw new SyncError('SNAPSHOT_DIGEST_DRIFT', `Snapshot ${value.id} fields do not match digest`);
  return true;
}

function verifyRule(value) {
  requireObject(value, 'INVALID_MERGE_RULE', 'Merge rule');
  requireExactKeys(value, RULE_KEYS, 'RULE_ENVELOPE_DRIFT', 'Merge rule');
  if (value.schema !== 'axm.merge-rule/v1') throw new SyncError('RULE_SCHEMA_DRIFT', 'Merge rule schema must be axm.merge-rule/v1');
  requireDigest(value.ruleDigest, 'INVALID_RULE_DIGEST', 'Merge rule ruleDigest');
  const base = rulePayload(value);
  const expectedDigest = sha256(canonical(base));
  if (value.ruleDigest !== expectedDigest) throw new SyncError('RULE_DIGEST_DRIFT', `Merge rule ${value.id} fields do not match digest`);
  return true;
}

function admissionPayload(input) {
  requireObject(input, 'INVALID_MERGE_ADMISSION', 'Merge admission');
  requireInertProperties(input, 'INVALID_MERGE_ADMISSION', 'Merge admission');
  const namespace = requireString(input.namespace, 'INVALID_MERGE_ADMISSION', 'Merge admission namespace');
  requireDigest(input.ruleDigest, 'INVALID_MERGE_ADMISSION', 'Merge admission ruleDigest');
  return { schema: 'axm.merge-admission/v1', namespace, ruleDigest: input.ruleDigest };
}

function admission(input) {
  const base = admissionPayload(input);
  return { ...base, admissionDigest: sha256(canonical(base)) };
}

function verifyAdmission(value) {
  requireObject(value, 'INVALID_MERGE_ADMISSION', 'Merge admission');
  requireExactKeys(value, ADMISSION_KEYS, 'ADMISSION_ENVELOPE_DRIFT', 'Merge admission');
  if (value.schema !== 'axm.merge-admission/v1') throw new SyncError('ADMISSION_SCHEMA_DRIFT', 'Merge admission schema must be axm.merge-admission/v1');
  requireDigest(value.admissionDigest, 'INVALID_ADMISSION_DIGEST', 'Merge admission admissionDigest');
  const base = admissionPayload(value);
  const expectedDigest = sha256(canonical(base));
  if (value.admissionDigest !== expectedDigest) throw new SyncError('ADMISSION_DIGEST_DRIFT', 'Merge admission fields do not match digest');
  return true;
}

function reconciliation(local, remote, mergeRule, reason) {
  const base = { schema: 'axm.reconciliation-request/v1', namespace: local.namespace, reason, localDigest: local.snapshotDigest, remoteDigest: remote.snapshotDigest, ruleDigest: mergeRule.ruleDigest, requiresHuman: true, grantsAuthority: false };
  return { ...base, requestDigest: sha256(canonical(base)) };
}

function result(state, mergeRule, local, remote, candidate, request) {
  const base = { schema: 'axm.merge-result/v1', state, semantics: mergeRule.semantics, localDigest: local.snapshotDigest, remoteDigest: remote.snapshotDigest, candidate: candidate || null, reconciliation: request || null, applied: false };
  return { ...base, resultDigest: sha256(canonical(base)) };
}

function merge(localValue, remoteValue, ruleValue, admissionValue) {
  verifySnapshot(localValue);
  verifySnapshot(remoteValue);
  verifyRule(ruleValue);
  verifyAdmission(admissionValue);
  const local = snapshot(localValue), remote = snapshot(remoteValue), mergeRule = rule(ruleValue);
  if (admissionValue.namespace !== local.namespace || admissionValue.namespace !== remote.namespace) throw new SyncError('ADMISSION_NAMESPACE_MISMATCH', 'Merge admission does not pin both snapshot namespaces');
  if (admissionValue.ruleDigest !== mergeRule.ruleDigest) throw new SyncError('ADMISSION_RULE_MISMATCH', 'Merge admission does not pin the presented merge rule');
  if (local.namespace !== remote.namespace || local.namespace !== mergeRule.namespace) throw new SyncError('MERGE_NAMESPACE_DRIFT', 'Snapshots and rule must name the same namespace');
  if (local.valueSchema !== remote.valueSchema) return result('CONFLICT', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, 'value-schema-drift'));
  if (local.snapshotDigest === remote.snapshotDigest) return result('IDENTICAL', mergeRule, local, remote, local, null);
  if (SENSITIVE_NAMESPACE.test(local.namespace)) return result('HOLD', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, 'sensitive-namespace-never-auto-merges'));
  if (mergeRule.semantics === 'IMMUTABLE') return result('CONFLICT', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, 'immutable-values-differ'));
  if (mergeRule.semantics === 'LAST_WRITER_NOT_ALLOWED') return result('HOLD', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, 'last-writer-selection-refused'));
  if (mergeRule.semantics === 'HUMAN_RECONCILIATION_REQUIRED') return result('HOLD', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, 'rule-requires-human-reconciliation'));
  if (mergeRule.semantics === 'SINGLE_AUTHORITY') return result('HOLD', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, local.authorityDomain === remote.authorityDomain ? 'single-authority-divergence-needs-owner-decision' : 'authority-domain-conflict'));
  let mergedValue;
  if (mergeRule.semantics === 'CRDT_MERGEABLE') {
    if (!Array.isArray(local.value) || !Array.isArray(remote.value)) throw new SyncError('INVALID_G_SET_VALUE', 'G_SET values must be arrays');
    mergedValue = Array.from(new Set([...local.value, ...remote.value].map(canonical))).sort().map(value => JSON.parse(value));
  } else if (mergeRule.semantics === 'APPEND_ONLY') {
    if (!Array.isArray(local.value) || !Array.isArray(remote.value)) throw new SyncError('INVALID_APPEND_ONLY_VALUE', 'APPEND_ONLY values must be arrays of id-bearing entries');
    const rows = new Map();
    for (const item of [...local.value, ...remote.value]) {
      if (!item || typeof item.id !== 'string' || item.id.trim() === '') throw new SyncError('INVALID_APPEND_ONLY_ENTRY', 'Append-only entry requires a non-empty string id');
      const digest = sha256(canonical(item));
      if (rows.has(item.id) && rows.get(item.id).digest !== digest) return result('CONFLICT', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, `append-only-id-conflict:${item.id}`));
      rows.set(item.id, { digest, item });
    }
    mergedValue = Array.from(rows.values()).sort((a, b) => String(a.item.id).localeCompare(String(b.item.id))).map(row => row.item);
  }
  const candidate = snapshot({ id: `${local.id}+${remote.id}`, namespace: local.namespace, valueSchema: local.valueSchema, value: mergedValue, revision: Math.max(local.revision, remote.revision) + 1, parentDigests: [local.snapshotDigest, remote.snapshotDigest], authorityDomain: local.authorityDomain === remote.authorityDomain ? local.authorityDomain : 'MULTIPLE_RECONCILIATION_REQUIRED' });
  return result('CANDIDATE', mergeRule, local, remote, candidate, null);
}

module.exports = { SEMANTICS, SENSITIVE_NAMESPACE, SyncError, canonical, sha256, snapshot, rule, admission, verifySnapshot, verifyRule, verifyAdmission, reconciliation, merge };
