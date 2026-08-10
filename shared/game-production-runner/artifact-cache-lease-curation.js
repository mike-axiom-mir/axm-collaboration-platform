'use strict';

const path = require('path');
const Codec = require('./canonical');
const ArtifactCache = require('./artifact-cache');
const CacheLeases = require('./artifact-cache-lease');

const PROPOSAL_SCHEMA = 'axm.production-artifact-cache-lease-curation-proposal/v1';
const APPLICATION_SCHEMA = 'axm.production-artifact-cache-lease-curation-application/v1';
const VERSION = '0.1.0';
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_CANDIDATES = 10000;
const PROPOSAL_KEYS = Object.freeze([
  'schema', 'version', 'status', 'observed_at_ms', 'cache_root_fingerprint',
  'lease_set_digest', 'lease_set_snapshot_digest', 'scan_budget', 'policy',
  'active_leases', 'eligible_count', 'deferred_count', 'candidates',
  'selected_live_records', 'selected_live_bytes', 'application_allowed',
  'authority', 'digest'
]);
const SCAN_BUDGET_KEYS = Object.freeze([
  'max_directory_entries', 'max_ledgers', 'max_events', 'max_bytes',
  'max_single_ledger_bytes', 'max_events_per_ledger'
]);

class LeaseCurationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LeaseCurationError';
    this.code = code;
  }
}

function fail(code) { throw new LeaseCurationError(code); }
function finiteInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Codec.canonical(Object.keys(value).sort()) === Codec.canonical(expected.slice().sort());
}

function rootFingerprint(root) {
  const resolved = path.resolve(root);
  return Codec.sha256(Buffer.from(process.platform === 'win32' ? resolved.toLowerCase() : resolved, 'utf8'));
}

function normalizePolicy(value) {
  if (!exactKeys(value, ['minimum_released_age_ms', 'minimum_expired_age_ms', 'max_candidates']) || !finiteInteger(value.minimum_released_age_ms) || !finiteInteger(value.minimum_expired_age_ms) || !Number.isInteger(value.max_candidates) || value.max_candidates < 1 || value.max_candidates > MAX_CANDIDATES) fail('CACHE_LEASE_CURATION_POLICY_INVALID');
  return { minimum_released_age_ms: value.minimum_released_age_ms, minimum_expired_age_ms: value.minimum_expired_age_ms, max_candidates: value.max_candidates };
}

function plan(leaseSet, policyValue) {
  const leaseErrors = CacheLeases.validateSet(leaseSet);
  if (leaseErrors.length) fail('CACHE_LEASE_CURATION_LEASE_SET_INVALID');
  const policy = normalizePolicy(policyValue), eligible = [];
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    status: 'NO_CHANGES',
    observed_at_ms: leaseSet.observed_at_ms,
    cache_root_fingerprint: leaseSet.cache_root_fingerprint,
    lease_set_digest: leaseSet.digest,
    lease_set_snapshot_digest: leaseSet.snapshot_digest,
    scan_budget: Codec.clone(leaseSet.scan_budget),
    policy,
    active_leases: leaseSet.usage.active,
    eligible_count: 0,
    deferred_count: 0,
    candidates: [],
    selected_live_records: 0,
    selected_live_bytes: 0,
    application_allowed: false,
    authority: { read_only: true, source_segment_deletion: false, explicit_approval_required: true, installed: false, promoted: false, canon: false }
  };
  if (leaseSet.status !== 'COMPLETE') {
    proposal.status = 'HELD';
    return Codec.seal(proposal);
  }
  for (const lease of leaseSet.leases) {
    if (lease.state === 'ACTIVE' || lease.compaction_pending || lease.live_segment_digest === null) continue;
    const inactiveAge = Math.max(0, leaseSet.observed_at_ms - lease.expires_at_ms);
    const minimum = lease.state === 'RELEASED' ? policy.minimum_released_age_ms : policy.minimum_expired_age_ms;
    if (inactiveAge < minimum) continue;
    eligible.push({
      lease_id: lease.lease_id,
      owner_digest: lease.owner_digest,
      tail_event_digest: lease.tail_event_digest,
      state: lease.state,
      generation: lease.generation,
      expires_at_ms: lease.expires_at_ms,
      inactive_age_ms: inactiveAge,
      archive_anchor_digest: lease.archive_anchor_digest,
      live_segment_digest: lease.live_segment_digest,
      live_segment_events: lease.live_segment_events,
      live_segment_bytes: lease.live_segment_bytes
    });
  }
  eligible.sort((left, right) => right.inactive_age_ms - left.inactive_age_ms || left.lease_id.localeCompare(right.lease_id));
  proposal.eligible_count = eligible.length;
  proposal.candidates = eligible.slice(0, policy.max_candidates);
  proposal.deferred_count = eligible.length - proposal.candidates.length;
  proposal.selected_live_records = proposal.candidates.reduce((sum, item) => sum + item.live_segment_events, 0);
  proposal.selected_live_bytes = proposal.candidates.reduce((sum, item) => sum + item.live_segment_bytes, 0);
  proposal.application_allowed = proposal.candidates.length > 0;
  proposal.status = proposal.candidates.length ? (proposal.deferred_count ? 'READY_WITH_LIMITS' : 'READY') : 'NO_CHANGES';
  return Codec.seal(proposal);
}

function validateCandidate(candidate) {
  if (!exactKeys(candidate, ['lease_id', 'owner_digest', 'tail_event_digest', 'state', 'generation', 'expires_at_ms', 'inactive_age_ms', 'archive_anchor_digest', 'live_segment_digest', 'live_segment_events', 'live_segment_bytes']) || !DIGEST.test(String(candidate.lease_id || '')) || !DIGEST.test(String(candidate.owner_digest || '')) || !DIGEST.test(String(candidate.tail_event_digest || '')) || !['EXPIRED', 'RELEASED'].includes(candidate.state) || !Number.isInteger(candidate.generation) || candidate.generation < 1 || !finiteInteger(candidate.expires_at_ms) || !finiteInteger(candidate.inactive_age_ms) || (candidate.archive_anchor_digest !== null && !DIGEST.test(String(candidate.archive_anchor_digest || ''))) || !DIGEST.test(String(candidate.live_segment_digest || '')) || !Number.isInteger(candidate.live_segment_events) || candidate.live_segment_events < 1 || !finiteInteger(candidate.live_segment_bytes) || candidate.live_segment_bytes < 1) fail('CACHE_LEASE_CURATION_CANDIDATE_INVALID');
}

function validateProposal(proposal) {
  if (!exactKeys(proposal, PROPOSAL_KEYS) || proposal.schema !== PROPOSAL_SCHEMA || proposal.version !== VERSION || !Codec.validDigest(proposal) || !['READY', 'READY_WITH_LIMITS', 'NO_CHANGES', 'HELD'].includes(proposal.status) || !finiteInteger(proposal.observed_at_ms) || !DIGEST.test(String(proposal.cache_root_fingerprint || '')) || !DIGEST.test(String(proposal.lease_set_digest || '')) || !DIGEST.test(String(proposal.lease_set_snapshot_digest || '')) || !exactKeys(proposal.scan_budget, SCAN_BUDGET_KEYS) || Object.values(proposal.scan_budget).some((value) => !Number.isSafeInteger(value) || value < 1) || !finiteInteger(proposal.active_leases) || !finiteInteger(proposal.eligible_count) || !finiteInteger(proposal.deferred_count) || !Array.isArray(proposal.candidates) || !finiteInteger(proposal.selected_live_records) || !finiteInteger(proposal.selected_live_bytes) || typeof proposal.application_allowed !== 'boolean') fail('CACHE_LEASE_CURATION_PROPOSAL_INVALID');
  normalizePolicy(proposal.policy);
  proposal.candidates.forEach(validateCandidate);
  const applicable = proposal.candidates.length > 0;
  const expectedReadyStatus = proposal.deferred_count ? 'READY_WITH_LIMITS' : 'READY';
  const sortedCandidates = proposal.candidates.slice().sort((left, right) => right.inactive_age_ms - left.inactive_age_ms || left.lease_id.localeCompare(right.lease_id));
  if (new Set(proposal.candidates.map((item) => item.lease_id)).size !== proposal.candidates.length || Codec.canonical(sortedCandidates) !== Codec.canonical(proposal.candidates) || proposal.candidates.length > proposal.policy.max_candidates || proposal.eligible_count !== proposal.candidates.length + proposal.deferred_count || proposal.candidates.some((item) => item.inactive_age_ms !== Math.max(0, proposal.observed_at_ms - item.expires_at_ms) || item.inactive_age_ms < (item.state === 'RELEASED' ? proposal.policy.minimum_released_age_ms : proposal.policy.minimum_expired_age_ms)) || proposal.selected_live_records !== proposal.candidates.reduce((sum, item) => sum + item.live_segment_events, 0) || proposal.selected_live_bytes !== proposal.candidates.reduce((sum, item) => sum + item.live_segment_bytes, 0) || proposal.application_allowed !== applicable || (applicable ? proposal.status !== expectedReadyStatus : !['NO_CHANGES', 'HELD'].includes(proposal.status)) || !exactKeys(proposal.authority, ['read_only', 'source_segment_deletion', 'explicit_approval_required', 'installed', 'promoted', 'canon']) || proposal.authority.read_only !== true || proposal.authority.source_segment_deletion !== false || proposal.authority.explicit_approval_required !== true || Object.entries(proposal.authority).some(([key, value]) => !['read_only', 'source_segment_deletion', 'explicit_approval_required'].includes(key) && value !== false)) fail('CACHE_LEASE_CURATION_PROPOSAL_INVALID');
  return proposal;
}

function applicationReceipt(proposalDigest, approvedDigest, status, explicit, recordedAt, beforeSnapshot, afterSnapshot, outcomes, usageAfter) {
  return Codec.seal({
    schema: APPLICATION_SCHEMA,
    version: VERSION,
    proposal_digest: String(proposalDigest || ''),
    approved_digest: approvedDigest == null ? null : String(approvedDigest),
    status,
    explicit: explicit === true,
    recorded_at_ms: recordedAt,
    before_lease_snapshot_digest: beforeSnapshot || null,
    after_lease_snapshot_digest: afterSnapshot || null,
    outcomes: outcomes || [],
    usage_after: usageAfter || null,
    authority: { source_segments_removed: (outcomes || []).some((item) => item.source_removed === true), installed: false, promoted: false, canon: false }
  });
}

function applicationNotRequested(approvedDigest) {
  return applicationReceipt('', approvedDigest, 'NOT_REQUESTED', false, Date.now(), null, null, [], null);
}

function apply(options) {
  options = options || {};
  const proposal = validateProposal(options.proposal), recordedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(recordedAt)) fail('CACHE_LEASE_CURATION_APPLICATION_TIME_INVALID');
  if (options.explicit !== true) return applicationReceipt(proposal.digest, options.approvedDigest, 'NOT_APPROVED', false, recordedAt, proposal.lease_set_snapshot_digest, null, [], null);
  if (options.approvedDigest !== proposal.digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'APPROVAL_MISMATCH', true, recordedAt, proposal.lease_set_snapshot_digest, null, [], null);
  if (!proposal.application_allowed) return applicationReceipt(proposal.digest, options.approvedDigest, 'PROPOSAL_NOT_APPLICABLE', true, recordedAt, proposal.lease_set_snapshot_digest, proposal.lease_set_snapshot_digest, [], null);
  if (recordedAt < proposal.observed_at_ms) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, recordedAt, proposal.lease_set_snapshot_digest, null, [], null);
  if (rootFingerprint(ArtifactCache.locate(options).root) !== proposal.cache_root_fingerprint) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, recordedAt, proposal.lease_set_snapshot_digest, null, [], null);
  const outcomes = [];
  let halt = null;
  for (const candidate of proposal.candidates) {
    try {
      const archived = CacheLeases.archiveCandidate(options, candidate, recordedAt);
      outcomes.push({ lease_id: candidate.lease_id, source_segment_digest: candidate.live_segment_digest, status: archived.status, source_removed: archived.source_removed, archive_receipt_digest: archived.archive_receipt_digest, archive_anchor_digest: archived.archive_anchor_digest, archived_event_count: archived.archived_event_count });
      if (!archived.source_removed) { halt = 'PARTIAL'; break; }
    } catch (error) {
      if (error instanceof CacheLeases.LeaseError && error.code === 'CACHE_LEASE_COORDINATION_BUSY') halt = 'COORDINATION_BUSY';
      else if (error instanceof CacheLeases.LeaseError && ['CACHE_LEASE_ARCHIVE_CANDIDATE_STALE', 'CACHE_LEASE_COMPACTION_INCOMPLETE'].includes(error.code)) halt = 'STALE';
      else throw error;
      outcomes.push({ lease_id: candidate.lease_id, source_segment_digest: candidate.live_segment_digest, status: halt, source_removed: false, archive_receipt_digest: null, archive_anchor_digest: null, archived_event_count: 0 });
      break;
    }
  }
  let after;
  try { after = CacheLeases.discover(Object.assign({}, options, { nowMs: recordedAt })); }
  catch (_) { after = null; }
  if (after && CacheLeases.validateSet(after).length) after = null;
  const succeeded = outcomes.filter((item) => item.source_removed).length;
  const all = succeeded === proposal.candidates.length && outcomes.length === proposal.candidates.length;
  const status = all && after && after.status === 'COMPLETE' ? 'APPLIED' : succeeded ? 'PARTIAL' : halt || 'PARTIAL';
  return applicationReceipt(proposal.digest, options.approvedDigest, status, true, recordedAt, proposal.lease_set_snapshot_digest, after && after.snapshot_digest, outcomes, after && after.usage);
}

module.exports = {
  PROPOSAL_SCHEMA,
  APPLICATION_SCHEMA,
  VERSION,
  MAX_CANDIDATES,
  LeaseCurationError,
  normalizePolicy,
  plan,
  validateProposal,
  apply,
  applicationNotRequested,
  audit: CacheLeases.auditArchives
};
