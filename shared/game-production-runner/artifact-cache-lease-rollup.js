'use strict';

const path = require('path');
const Codec = require('./canonical');
const ArtifactCache = require('./artifact-cache');
const CacheLeases = require('./artifact-cache-lease');

const PROPOSAL_SCHEMA = 'axm.production-artifact-cache-lease-archive-rollup-proposal/v1';
const APPLICATION_SCHEMA = 'axm.production-artifact-cache-lease-archive-rollup-application/v1';
const VERSION = '0.1.0';
const DIGEST = /^[a-f0-9]{64}$/;
const FILE_NAME = /^[a-f0-9]{64}(?:\.json|\.jsonl\.gz|\.rollup\.json|\.lineage\.json\.gz)$/;
const MAX_CANDIDATES = 1000;
const PROPOSAL_KEYS = Object.freeze([
  'schema', 'version', 'status', 'observed_at_ms', 'cache_root_fingerprint',
  'lease_set_digest', 'lease_set_snapshot_digest', 'archive_audit_digest',
  'policy', 'active_leases', 'considered_count', 'eligible_count',
  'inefficient_count', 'deferred_count', 'candidates', 'selected_source_files',
  'selected_source_bytes', 'selected_target_bytes',
  'projected_reduction_bytes', 'application_allowed', 'authority', 'digest'
]);
const CANDIDATE_KEYS = Object.freeze([
  'lease_id', 'owner_digest', 'state', 'expires_at_ms', 'inactive_age_ms',
  'source_anchor_digest', 'source_head_receipt_digest',
  'source_archive_snapshot_digest', 'source_segment_count',
  'source_file_count', 'source_storage_bytes', 'source_files',
  'history_event_count', 'tail_event_digest', 'target_rollup_receipt_digest',
  'target_anchor_digest', 'target_storage_bytes', 'projected_reduction_bytes'
]);

class LeaseRollupError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LeaseRollupError';
    this.code = code;
  }
}

function fail(code) { throw new LeaseRollupError(code); }
function finiteInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Codec.canonical(Object.keys(value).sort()) === Codec.canonical(expected.slice().sort());
}
function rootFingerprint(root) {
  const resolved = path.resolve(root);
  return Codec.sha256(Buffer.from(process.platform === 'win32' ? resolved.toLowerCase() : resolved, 'utf8'));
}

function normalizePolicy(value) {
  if (!exactKeys(value, ['minimum_released_age_ms', 'minimum_expired_age_ms', 'minimum_reclaim_bytes', 'max_candidates']) || !finiteInteger(value.minimum_released_age_ms) || !finiteInteger(value.minimum_expired_age_ms) || !finiteInteger(value.minimum_reclaim_bytes) || !Number.isInteger(value.max_candidates) || value.max_candidates < 1 || value.max_candidates > MAX_CANDIDATES) fail('CACHE_LEASE_ARCHIVE_ROLLUP_POLICY_INVALID');
  return { minimum_released_age_ms: value.minimum_released_age_ms, minimum_expired_age_ms: value.minimum_expired_age_ms, minimum_reclaim_bytes: value.minimum_reclaim_bytes, max_candidates: value.max_candidates };
}

function plan(options, policyValue) {
  options = options || {};
  const policy = normalizePolicy(policyValue), observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(observedAt)) fail('CACHE_LEASE_ARCHIVE_ROLLUP_PLAN_TIME_INVALID');
  const leaseSet = CacheLeases.discover(Object.assign({}, options, { nowMs: observedAt }));
  const archiveAudit = CacheLeases.auditArchives(Object.assign({}, options, { nowMs: observedAt }));
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    status: 'NO_CHANGES',
    observed_at_ms: observedAt,
    cache_root_fingerprint: leaseSet.cache_root_fingerprint,
    lease_set_digest: leaseSet.digest,
    lease_set_snapshot_digest: leaseSet.snapshot_digest,
    archive_audit_digest: archiveAudit.digest,
    policy,
    active_leases: leaseSet.usage.active,
    considered_count: 0,
    eligible_count: 0,
    inefficient_count: 0,
    deferred_count: 0,
    candidates: [],
    selected_source_files: 0,
    selected_source_bytes: 0,
    selected_target_bytes: 0,
    projected_reduction_bytes: 0,
    application_allowed: false,
    authority: { read_only: true, source_archive_removal: false, explicit_approval_required: true, installed: false, promoted: false, canon: false }
  };
  if (leaseSet.status !== 'COMPLETE' || archiveAudit.status !== 'COMPLETE') {
    proposal.status = 'HELD';
    return { lease_set: leaseSet, archive_audit: archiveAudit, proposal: Codec.seal(proposal) };
  }
  const audited = new Map(archiveAudit.anchors.map((item) => [item.lease_id, item])), eligible = [];
  for (const lease of leaseSet.leases) {
    if (lease.state === 'ACTIVE' || lease.compaction_pending || lease.live_segment_digest !== null || lease.archived_segments < 2 || !audited.has(lease.lease_id)) continue;
    const inactiveAge = Math.max(0, observedAt - lease.expires_at_ms), minimumAge = lease.state === 'RELEASED' ? policy.minimum_released_age_ms : policy.minimum_expired_age_ms;
    if (inactiveAge < minimumAge) continue;
    proposal.considered_count += 1;
    const prepared = CacheLeases.prepareArchiveRollup(options, lease.lease_id, observedAt);
    if (prepared.projected_reduction_bytes <= 0 || prepared.projected_reduction_bytes < policy.minimum_reclaim_bytes) {
      proposal.inefficient_count += 1;
      continue;
    }
    eligible.push(Object.assign({ state: lease.state, expires_at_ms: lease.expires_at_ms, inactive_age_ms: inactiveAge }, prepared));
  }
  eligible.sort((left, right) => right.projected_reduction_bytes - left.projected_reduction_bytes || left.lease_id.localeCompare(right.lease_id));
  proposal.eligible_count = eligible.length;
  proposal.candidates = eligible.slice(0, policy.max_candidates);
  proposal.deferred_count = eligible.length - proposal.candidates.length;
  proposal.selected_source_files = proposal.candidates.reduce((sum, item) => sum + item.source_file_count, 0);
  proposal.selected_source_bytes = proposal.candidates.reduce((sum, item) => sum + item.source_storage_bytes, 0);
  proposal.selected_target_bytes = proposal.candidates.reduce((sum, item) => sum + item.target_storage_bytes, 0);
  proposal.projected_reduction_bytes = proposal.selected_source_bytes - proposal.selected_target_bytes;
  proposal.application_allowed = proposal.candidates.length > 0;
  proposal.status = proposal.candidates.length ? (proposal.deferred_count ? 'READY_WITH_LIMITS' : 'READY') : 'NO_CHANGES';
  return { lease_set: leaseSet, archive_audit: archiveAudit, proposal: Codec.seal(proposal) };
}

function validateSourceFile(item) {
  if (!exactKeys(item, ['name', 'bytes', 'content_digest']) || !FILE_NAME.test(String(item.name || '')) || !finiteInteger(item.bytes) || item.bytes < 1 || !DIGEST.test(String(item.content_digest || ''))) fail('CACHE_LEASE_ARCHIVE_ROLLUP_CANDIDATE_INVALID');
}

function validateCandidate(candidate, proposal) {
  if (!exactKeys(candidate, CANDIDATE_KEYS) || !DIGEST.test(String(candidate.lease_id || '')) || !DIGEST.test(String(candidate.owner_digest || '')) || !['EXPIRED', 'RELEASED'].includes(candidate.state) || !finiteInteger(candidate.expires_at_ms) || !finiteInteger(candidate.inactive_age_ms) || !DIGEST.test(String(candidate.source_anchor_digest || '')) || !DIGEST.test(String(candidate.source_head_receipt_digest || '')) || !DIGEST.test(String(candidate.source_archive_snapshot_digest || '')) || !Number.isInteger(candidate.source_segment_count) || candidate.source_segment_count < 2 || !Number.isInteger(candidate.source_file_count) || candidate.source_file_count < 4 || !finiteInteger(candidate.source_storage_bytes) || candidate.source_storage_bytes < 1 || !Array.isArray(candidate.source_files) || !Number.isInteger(candidate.history_event_count) || candidate.history_event_count < 2 || !DIGEST.test(String(candidate.tail_event_digest || '')) || !DIGEST.test(String(candidate.target_rollup_receipt_digest || '')) || !DIGEST.test(String(candidate.target_anchor_digest || '')) || !finiteInteger(candidate.target_storage_bytes) || candidate.target_storage_bytes < 1 || !Number.isSafeInteger(candidate.projected_reduction_bytes) || candidate.projected_reduction_bytes < 1) fail('CACHE_LEASE_ARCHIVE_ROLLUP_CANDIDATE_INVALID');
  candidate.source_files.forEach(validateSourceFile);
  if (candidate.source_files.length !== candidate.source_file_count || new Set(candidate.source_files.map((item) => item.name)).size !== candidate.source_files.length || Codec.canonical(candidate.source_files.slice().sort((left, right) => left.name.localeCompare(right.name))) !== Codec.canonical(candidate.source_files) || candidate.source_files.reduce((sum, item) => sum + item.bytes, 0) !== candidate.source_storage_bytes || candidate.source_storage_bytes - candidate.target_storage_bytes !== candidate.projected_reduction_bytes || candidate.inactive_age_ms !== Math.max(0, proposal.observed_at_ms - candidate.expires_at_ms) || candidate.inactive_age_ms < (candidate.state === 'RELEASED' ? proposal.policy.minimum_released_age_ms : proposal.policy.minimum_expired_age_ms) || candidate.projected_reduction_bytes < proposal.policy.minimum_reclaim_bytes) fail('CACHE_LEASE_ARCHIVE_ROLLUP_CANDIDATE_INVALID');
}

function validateProposal(proposal) {
  if (!exactKeys(proposal, PROPOSAL_KEYS) || proposal.schema !== PROPOSAL_SCHEMA || proposal.version !== VERSION || !Codec.validDigest(proposal) || !['READY', 'READY_WITH_LIMITS', 'NO_CHANGES', 'HELD'].includes(proposal.status) || !finiteInteger(proposal.observed_at_ms) || !DIGEST.test(String(proposal.cache_root_fingerprint || '')) || !DIGEST.test(String(proposal.lease_set_digest || '')) || !DIGEST.test(String(proposal.lease_set_snapshot_digest || '')) || !DIGEST.test(String(proposal.archive_audit_digest || '')) || !finiteInteger(proposal.active_leases) || !finiteInteger(proposal.considered_count) || !finiteInteger(proposal.eligible_count) || !finiteInteger(proposal.inefficient_count) || !finiteInteger(proposal.deferred_count) || !Array.isArray(proposal.candidates) || !finiteInteger(proposal.selected_source_files) || !finiteInteger(proposal.selected_source_bytes) || !finiteInteger(proposal.selected_target_bytes) || !finiteInteger(proposal.projected_reduction_bytes) || typeof proposal.application_allowed !== 'boolean') fail('CACHE_LEASE_ARCHIVE_ROLLUP_PROPOSAL_INVALID');
  normalizePolicy(proposal.policy);
  proposal.candidates.forEach((candidate) => validateCandidate(candidate, proposal));
  const applicable = proposal.candidates.length > 0, expectedStatus = proposal.deferred_count ? 'READY_WITH_LIMITS' : 'READY';
  if (proposal.candidates.length > proposal.policy.max_candidates || new Set(proposal.candidates.map((item) => item.lease_id)).size !== proposal.candidates.length || proposal.eligible_count !== proposal.candidates.length + proposal.deferred_count || proposal.considered_count !== proposal.eligible_count + proposal.inefficient_count || proposal.selected_source_files !== proposal.candidates.reduce((sum, item) => sum + item.source_file_count, 0) || proposal.selected_source_bytes !== proposal.candidates.reduce((sum, item) => sum + item.source_storage_bytes, 0) || proposal.selected_target_bytes !== proposal.candidates.reduce((sum, item) => sum + item.target_storage_bytes, 0) || proposal.projected_reduction_bytes !== proposal.selected_source_bytes - proposal.selected_target_bytes || proposal.application_allowed !== applicable || (applicable ? proposal.status !== expectedStatus : !['NO_CHANGES', 'HELD'].includes(proposal.status)) || !exactKeys(proposal.authority, ['read_only', 'source_archive_removal', 'explicit_approval_required', 'installed', 'promoted', 'canon']) || proposal.authority.read_only !== true || proposal.authority.source_archive_removal !== false || proposal.authority.explicit_approval_required !== true || Object.entries(proposal.authority).some(([key, value]) => !['read_only', 'source_archive_removal', 'explicit_approval_required'].includes(key) && value !== false)) fail('CACHE_LEASE_ARCHIVE_ROLLUP_PROPOSAL_INVALID');
  return proposal;
}

function applicationReceipt(proposalDigest, approvedDigest, status, explicit, recordedAt, beforeAudit, afterAudit, outcomes) {
  return Codec.seal({
    schema: APPLICATION_SCHEMA,
    version: VERSION,
    proposal_digest: String(proposalDigest || ''),
    approved_digest: approvedDigest == null ? null : String(approvedDigest),
    status,
    explicit: explicit === true,
    recorded_at_ms: recordedAt,
    before_archive_audit_digest: beforeAudit || null,
    after_archive_audit_digest: afterAudit || null,
    outcomes: outcomes || [],
    source_files_removed: (outcomes || []).reduce((sum, item) => sum + item.source_files_removed, 0),
    projected_reduction_bytes: (outcomes || []).reduce((sum, item) => sum + item.projected_reduction_bytes, 0),
    authority: { source_archive_files_removed: (outcomes || []).some((item) => item.source_files_removed > 0), installed: false, promoted: false, canon: false }
  });
}

function applicationNotRequested(approvedDigest) { return applicationReceipt('', approvedDigest, 'NOT_REQUESTED', false, Date.now(), null, null, []); }

function apply(options) {
  options = options || {};
  const proposal = validateProposal(options.proposal), recordedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(recordedAt)) fail('CACHE_LEASE_ARCHIVE_ROLLUP_APPLICATION_TIME_INVALID');
  if (options.explicit !== true) return applicationReceipt(proposal.digest, options.approvedDigest, 'NOT_APPROVED', false, recordedAt, proposal.archive_audit_digest, null, []);
  if (options.approvedDigest !== proposal.digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'APPROVAL_MISMATCH', true, recordedAt, proposal.archive_audit_digest, null, []);
  if (!proposal.application_allowed) return applicationReceipt(proposal.digest, options.approvedDigest, 'PROPOSAL_NOT_APPLICABLE', true, recordedAt, proposal.archive_audit_digest, proposal.archive_audit_digest, []);
  if (recordedAt < proposal.observed_at_ms || rootFingerprint(ArtifactCache.locate(options).root) !== proposal.cache_root_fingerprint) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, recordedAt, proposal.archive_audit_digest, null, []);
  const outcomes = [];
  let halt = null;
  for (const candidate of proposal.candidates) {
    try {
      const result = CacheLeases.applyArchiveRollupCandidate(options, candidate, proposal.observed_at_ms);
      outcomes.push({ lease_id: candidate.lease_id, status: result.status, source_files_removed: result.source_files_removed, rollup_receipt_digest: result.rollup_receipt_digest, archive_anchor_digest: result.archive_anchor_digest, history_event_count: result.history_event_count, projected_reduction_bytes: candidate.projected_reduction_bytes });
    } catch (error) {
      if (error instanceof CacheLeases.LeaseError && error.code === 'CACHE_LEASE_COORDINATION_BUSY') halt = 'COORDINATION_BUSY';
      else if (error instanceof CacheLeases.LeaseError && error.code.includes('STALE')) halt = 'STALE';
      else throw error;
      outcomes.push({ lease_id: candidate.lease_id, status: halt, source_files_removed: 0, rollup_receipt_digest: null, archive_anchor_digest: null, history_event_count: candidate.history_event_count, projected_reduction_bytes: 0 });
      break;
    }
  }
  let after = null;
  try { after = CacheLeases.auditArchives(Object.assign({}, options, { nowMs: recordedAt })); } catch (_) {}
  const succeeded = outcomes.filter((item) => ['ROLLED_UP', 'RECOVERED', 'ALREADY_ROLLED_UP'].includes(item.status)).length;
  const all = succeeded === proposal.candidates.length && outcomes.length === proposal.candidates.length;
  const status = all && after && after.status === 'COMPLETE' ? 'APPLIED' : succeeded ? 'PARTIAL' : halt || 'PARTIAL';
  return applicationReceipt(proposal.digest, options.approvedDigest, status, true, recordedAt, proposal.archive_audit_digest, after && after.digest, outcomes);
}

module.exports = {
  PROPOSAL_SCHEMA,
  APPLICATION_SCHEMA,
  VERSION,
  MAX_CANDIDATES,
  LeaseRollupError,
  normalizePolicy,
  plan,
  validateProposal,
  apply,
  applicationNotRequested
};
