'use strict';

const crypto = require('crypto');
const SEMANTICS = new Set(['CRDT_MERGEABLE', 'APPEND_ONLY', 'LAST_WRITER_NOT_ALLOWED', 'HUMAN_RECONCILIATION_REQUIRED', 'SINGLE_AUTHORITY', 'IMMUTABLE']);
const SENSITIVE_NAMESPACE = /(?:^|[.:/_-])(foundation|canon|roots?|authority)(?:$|[.:/_-])/i;

class SyncError extends Error {
  constructor(code, message, details) { super(message); this.name = 'SyncError'; this.code = code; this.details = details || null; }
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function snapshot(input) {
  if (!input || !input.id || !input.namespace || !input.valueSchema || !input.authorityDomain) throw new SyncError('INVALID_STATE_SNAPSHOT', 'Snapshot requires id, namespace, valueSchema, and authorityDomain');
  const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 0) throw new SyncError('INVALID_STATE_REVISION', 'Snapshot revision must be a non-negative integer');
  const base = { schema: 'axm.state-snapshot/v1', id: String(input.id), namespace: String(input.namespace), valueSchema: String(input.valueSchema), value: input.value == null ? null : input.value, revision, parentDigests: Array.from(new Set((input.parentDigests || []).map(String))).sort(), authorityDomain: String(input.authorityDomain) };
  return { ...base, snapshotDigest: sha256(canonical(base)) };
}

function rule(input) {
  if (!input || !input.id || !input.namespace || !input.owner || !SEMANTICS.has(input.semantics)) throw new SyncError('INVALID_MERGE_RULE', 'Merge rule requires id, namespace, owner, and known semantics');
  if (input.semantics === 'CRDT_MERGEABLE' && input.strategy !== 'G_SET') throw new SyncError('UNPROVEN_CRDT_STRATEGY', 'v0.1 proves only the grow-only set strategy');
  const base = { schema: 'axm.merge-rule/v1', id: String(input.id), namespace: String(input.namespace), semantics: input.semantics, strategy: input.strategy || null, owner: String(input.owner) };
  return { ...base, ruleDigest: sha256(canonical(base)) };
}

function verifySnapshot(value) {
  const expected = snapshot(value);
  if (value.snapshotDigest !== expected.snapshotDigest) throw new SyncError('SNAPSHOT_DIGEST_DRIFT', `Snapshot ${value.id} fields do not match digest`);
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

function merge(localValue, remoteValue, ruleValue) {
  const local = snapshot(localValue), remote = snapshot(remoteValue), mergeRule = rule(ruleValue);
  if (localValue.snapshotDigest && localValue.snapshotDigest !== local.snapshotDigest) throw new SyncError('SNAPSHOT_DIGEST_DRIFT', 'Local snapshot drift');
  if (remoteValue.snapshotDigest && remoteValue.snapshotDigest !== remote.snapshotDigest) throw new SyncError('SNAPSHOT_DIGEST_DRIFT', 'Remote snapshot drift');
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
      if (!item || !item.id) throw new SyncError('INVALID_APPEND_ONLY_ENTRY', 'Append-only entry requires id');
      const digest = sha256(canonical(item));
      if (rows.has(item.id) && rows.get(item.id).digest !== digest) return result('CONFLICT', mergeRule, local, remote, null, reconciliation(local, remote, mergeRule, `append-only-id-conflict:${item.id}`));
      rows.set(item.id, { digest, item });
    }
    mergedValue = Array.from(rows.values()).sort((a, b) => String(a.item.id).localeCompare(String(b.item.id))).map(row => row.item);
  }
  const candidate = snapshot({ id: `${local.id}+${remote.id}`, namespace: local.namespace, valueSchema: local.valueSchema, value: mergedValue, revision: Math.max(local.revision, remote.revision) + 1, parentDigests: [local.snapshotDigest, remote.snapshotDigest], authorityDomain: local.authorityDomain === remote.authorityDomain ? local.authorityDomain : 'MULTIPLE_RECONCILIATION_REQUIRED' });
  return result('CANDIDATE', mergeRule, local, remote, candidate, null);
}

module.exports = { SEMANTICS, SENSITIVE_NAMESPACE, SyncError, canonical, sha256, snapshot, rule, verifySnapshot, reconciliation, merge };
