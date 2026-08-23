'use strict';

const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');
const ArtifactCache = require('./artifact-cache');
const CacheLeases = require('./artifact-cache-lease');

const PACKAGE_SCHEMA = 'axm.production-artifact-cache-lease-tier-package/v1';
const PROPOSAL_SCHEMA = 'axm.production-artifact-cache-lease-tier-export-proposal/v1';
const APPLICATION_SCHEMA = 'axm.production-artifact-cache-lease-tier-export-application/v1';
const AUDIT_SCHEMA = 'axm.production-artifact-cache-lease-tier-package-audit/v1';
const RESTORE_SCHEMA = 'axm.production-artifact-cache-lease-tier-restore/v1';
const VERSION = '0.1.0';
const DIGEST = /^[a-f0-9]{64}$/;
const ARCHIVE_NAME = /^[a-f0-9]{64}(?:\.json|\.jsonl\.gz|\.rollup\.json|\.lineage\.json\.gz)$/;
const MAX_CANDIDATES = 100;
const MAX_PACKAGE_FILES = 20001;
const MAX_PACKAGE_BYTES = 268435456;
const MAX_TOTAL_PAYLOAD_BYTES = 536870912;
const MAX_MANIFEST_BYTES = 16777216;

const SUMMARY_KEYS = Object.freeze([
  'lease_id', 'anchor_digest', 'tail_event_digest', 'archived_segments',
  'history_events', 'latest_archive_receipt_digest', 'rollups',
  'archive_files', 'storage_bytes', 'storage_snapshot_digest'
]);
const PACKAGE_KEYS = Object.freeze([
  'schema', 'version', 'package_kind', 'lease_id',
  'owner_digest', 'source_anchor_digest', 'source_archive_summary',
  'payload_files', 'payload_file_count', 'payload_bytes',
  'payload_snapshot_digest', 'authority', 'digest'
]);
const CANDIDATE_KEYS = Object.freeze([
  'lease_id', 'owner_digest', 'state', 'expires_at_ms', 'inactive_age_ms',
  'source_anchor_digest', 'source_storage_snapshot_digest',
  'source_archive_summary_digest', 'history_event_count',
  'payload_file_count', 'payload_bytes', 'payload_snapshot_digest',
  'package_digest'
]);
const PROPOSAL_KEYS = Object.freeze([
  'schema', 'version', 'status', 'observed_at_ms', 'cache_root_fingerprint',
  'tier_root_fingerprint', 'lease_set_digest', 'lease_set_snapshot_digest',
  'archive_audit_digest', 'policy', 'active_leases', 'considered_count',
  'inefficient_count', 'eligible_count', 'oversized_count', 'deferred_count',
  'candidates', 'selected_history_events', 'selected_payload_files',
  'selected_payload_bytes', 'application_allowed', 'authority', 'digest'
]);

class LeaseTierError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LeaseTierError';
    this.code = code;
  }
}

function fail(code) { throw new LeaseTierError(code); }
function finiteInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function digest(value) { return DIGEST.test(String(value || '')); }
function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Codec.canonical(Object.keys(value).sort()) === Codec.canonical(expected.slice().sort());
}
function normalized(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
function fingerprint(value) { return Codec.sha256(Buffer.from(normalized(value), 'utf8')); }
function inside(root, candidate) {
  const base = normalized(root), target = normalized(candidate);
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
function createDirectoryOnce(directory) {
  try { fs.mkdirSync(directory, { recursive: false }); }
  catch (error) { if (!error || error.code !== 'EEXIST') throw error; }
}
function assertPlainDirectory(directory, code) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || normalized(fs.realpathSync.native(directory)) !== normalized(directory)) fail(code);
}
function assertSeparated(root, others) {
  for (const other of others.filter(Boolean)) {
    const resolved = resolveExistingLinks(other);
    if (inside(root, resolved) || inside(resolved, root)) fail('CACHE_LEASE_TIER_ROOT_OVERLAP');
  }
}
function tierRootState(tierRootValue, create, otherRoots) {
  if (!path.isAbsolute(String(tierRootValue || ''))) fail('CACHE_LEASE_TIER_ROOT_NOT_ABSOLUTE');
  const root = path.resolve(tierRootValue), resolved = resolveExistingLinks(root), parsed = path.parse(resolved);
  if (resolved === parsed.root) fail('CACHE_LEASE_TIER_ROOT_IS_FILESYSTEM_ROOT');
  if (normalized(root) !== normalized(resolved)) fail('CACHE_LEASE_TIER_ROOT_TRAVERSES_LINK');
  assertSeparated(root, otherRoots || []);
  if (create && !fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  const exists = fs.existsSync(root);
  if (exists) assertPlainDirectory(root, 'CACHE_LEASE_TIER_ROOT_NOT_PLAIN');
  const packagesRoot = path.join(root, 'packages');
  if (create) createDirectoryOnce(packagesRoot);
  const packagesExist = fs.existsSync(packagesRoot);
  if (packagesExist) assertPlainDirectory(packagesRoot, 'CACHE_LEASE_TIER_PACKAGES_ROOT_NOT_PLAIN');
  return { root, exists, packagesRoot, packagesExist, fingerprint: fingerprint(root) };
}

function normalizePolicy(value) {
  if (!exactKeys(value, ['minimum_released_age_ms', 'minimum_expired_age_ms', 'minimum_history_bytes', 'maximum_package_bytes', 'maximum_total_payload_bytes', 'max_candidates']) || !finiteInteger(value.minimum_released_age_ms) || !finiteInteger(value.minimum_expired_age_ms) || !finiteInteger(value.minimum_history_bytes) || !Number.isSafeInteger(value.maximum_package_bytes) || value.maximum_package_bytes < 1 || value.maximum_package_bytes > MAX_PACKAGE_BYTES || !Number.isSafeInteger(value.maximum_total_payload_bytes) || value.maximum_total_payload_bytes < 1 || value.maximum_total_payload_bytes > MAX_TOTAL_PAYLOAD_BYTES || !Number.isInteger(value.max_candidates) || value.max_candidates < 1 || value.max_candidates > MAX_CANDIDATES) fail('CACHE_LEASE_TIER_POLICY_INVALID');
  return Codec.clone(value);
}

function validateSummary(summary) {
  if (!exactKeys(summary, SUMMARY_KEYS) || !digest(summary.lease_id) || !digest(summary.anchor_digest) || !digest(summary.tail_event_digest) || !Number.isInteger(summary.archived_segments) || summary.archived_segments < 1 || !Number.isInteger(summary.history_events) || summary.history_events < 1 || !digest(summary.latest_archive_receipt_digest) || !finiteInteger(summary.rollups) || summary.rollups > summary.archived_segments || !Number.isInteger(summary.archive_files) || summary.archive_files < 2 || summary.archive_files > MAX_PACKAGE_FILES - 1 || !Number.isSafeInteger(summary.storage_bytes) || summary.storage_bytes < 1 || !digest(summary.storage_snapshot_digest)) fail('CACHE_LEASE_TIER_ARCHIVE_SUMMARY_INVALID');
  return summary;
}
function validatePayloadFile(item, leaseId) {
  if (!exactKeys(item, ['path', 'bytes', 'content_digest']) || typeof item.path !== 'string' || !finiteInteger(item.bytes) || item.bytes < 1 || !digest(item.content_digest)) fail('CACHE_LEASE_TIER_PAYLOAD_FILE_INVALID');
  const anchor = 'leases/' + leaseId + '.anchor.json', prefix = 'lease-archives/' + leaseId + '/';
  if (item.path !== anchor && !(item.path.startsWith(prefix) && ARCHIVE_NAME.test(item.path.slice(prefix.length)))) fail('CACHE_LEASE_TIER_PAYLOAD_FILE_INVALID');
}
function validatePackage(manifest) {
  if (!exactKeys(manifest, PACKAGE_KEYS) || manifest.schema !== PACKAGE_SCHEMA || manifest.version !== VERSION || manifest.package_kind !== 'LEASE_ARCHIVE' || !Codec.validDigest(manifest) || !digest(manifest.lease_id) || !digest(manifest.owner_digest) || !digest(manifest.source_anchor_digest) || !Array.isArray(manifest.payload_files) || !Number.isInteger(manifest.payload_file_count) || manifest.payload_file_count < 3 || manifest.payload_file_count > MAX_PACKAGE_FILES || !Number.isSafeInteger(manifest.payload_bytes) || manifest.payload_bytes < 1 || manifest.payload_bytes > MAX_PACKAGE_BYTES || !digest(manifest.payload_snapshot_digest)) fail('CACHE_LEASE_TIER_PACKAGE_INVALID');
  const summary = validateSummary(manifest.source_archive_summary);
  manifest.payload_files.forEach((item) => validatePayloadFile(item, manifest.lease_id));
  const sorted = manifest.payload_files.slice().sort((left, right) => left.path.localeCompare(right.path));
  const anchorPath = 'leases/' + manifest.lease_id + '.anchor.json';
  if (manifest.source_anchor_digest !== summary.anchor_digest || summary.lease_id !== manifest.lease_id || manifest.payload_file_count !== manifest.payload_files.length || manifest.payload_file_count !== summary.archive_files + 1 || new Set(manifest.payload_files.map((item) => item.path)).size !== manifest.payload_files.length || Codec.canonical(sorted) !== Codec.canonical(manifest.payload_files) || manifest.payload_files.filter((item) => item.path === anchorPath).length !== 1 || manifest.payload_files.reduce((sum, item) => sum + item.bytes, 0) !== manifest.payload_bytes || Codec.digest(manifest.payload_files) !== manifest.payload_snapshot_digest || !exactKeys(manifest.authority, ['read_only_evidence', 'source_history_deletion', 'external_immutability', 'restore_requires_explicit_approval', 'installed', 'promoted', 'canon']) || manifest.authority.read_only_evidence !== true || manifest.authority.source_history_deletion !== false || manifest.authority.external_immutability !== false || manifest.authority.restore_requires_explicit_approval !== true || Object.entries(manifest.authority).some(([key, value]) => !['read_only_evidence', 'restore_requires_explicit_approval'].includes(key) && value !== false)) fail('CACHE_LEASE_TIER_PACKAGE_INVALID');
  return manifest;
}

function plainFileBytes(file, maximum, code) {
  let stat;
  try { stat = fs.lstatSync(file); } catch (_) { fail(code); }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maximum) fail(code);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== stat.size) fail(code);
  return bytes;
}
function sourceOverview(cacheRoot, leaseId, auditSummary) {
  validateSummary(auditSummary);
  const anchorFile = path.join(cacheRoot, 'leases', leaseId + '.anchor.json'), archiveRoot = path.join(cacheRoot, 'lease-archives', leaseId);
  const anchorStat = fs.lstatSync(anchorFile);
  assertPlainDirectory(archiveRoot, 'CACHE_LEASE_TIER_SOURCE_ARCHIVE_NOT_PLAIN');
  if (!anchorStat.isFile() || anchorStat.isSymbolicLink()) fail('CACHE_LEASE_TIER_SOURCE_ANCHOR_NOT_PLAIN');
  const names = fs.readdirSync(archiveRoot).sort();
  if (names.length !== auditSummary.archive_files || names.some((name) => !ARCHIVE_NAME.test(name))) fail('CACHE_LEASE_TIER_SOURCE_STALE');
  const archiveBytes = names.reduce((sum, name) => {
    const stat = fs.lstatSync(path.join(archiveRoot, name));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) fail('CACHE_LEASE_TIER_SOURCE_ARCHIVE_NOT_PLAIN');
    return sum + stat.size;
  }, 0);
  if (archiveBytes !== auditSummary.storage_bytes) fail('CACHE_LEASE_TIER_SOURCE_STALE');
  return { anchorFile, archiveRoot, names, payloadBytes: anchorStat.size + archiveBytes, payloadFiles: names.length + 1 };
}
function captureSource(cacheRoot, lease, auditSummary, maximumPackageBytes) {
  const overview = sourceOverview(cacheRoot, lease.lease_id, auditSummary);
  if (overview.payloadBytes > maximumPackageBytes) fail('CACHE_LEASE_TIER_PACKAGE_BYTE_LIMIT');
  const anchorBytes = plainFileBytes(overview.anchorFile, MAX_MANIFEST_BYTES, 'CACHE_LEASE_TIER_SOURCE_ANCHOR_INVALID');
  let anchor;
  try { anchor = JSON.parse(anchorBytes.toString('utf8')); } catch (_) { fail('CACHE_LEASE_TIER_SOURCE_ANCHOR_INVALID'); }
  if (!Codec.validDigest(anchor) || anchor.schema !== CacheLeases.ARCHIVE_ANCHOR_SCHEMA || anchor.digest !== auditSummary.anchor_digest || anchor.lease_id !== lease.lease_id) fail('CACHE_LEASE_TIER_SOURCE_ANCHOR_INVALID');
  const fileBytes = new Map(), archiveDescriptors = [], payload = [];
  const anchorRelative = 'leases/' + lease.lease_id + '.anchor.json';
  payload.push({ path: anchorRelative, bytes: anchorBytes.length, content_digest: Codec.sha256(anchorBytes) });
  fileBytes.set(anchorRelative, anchorBytes);
  for (const name of overview.names) {
    const bytes = plainFileBytes(path.join(overview.archiveRoot, name), MAX_PACKAGE_BYTES, 'CACHE_LEASE_TIER_SOURCE_ARCHIVE_INVALID');
    const contentDigest = Codec.sha256(bytes), relative = 'lease-archives/' + lease.lease_id + '/' + name;
    archiveDescriptors.push({ name, bytes: bytes.length, content_digest: contentDigest });
    payload.push({ path: relative, bytes: bytes.length, content_digest: contentDigest });
    fileBytes.set(relative, bytes);
  }
  archiveDescriptors.sort((left, right) => left.name.localeCompare(right.name));
  payload.sort((left, right) => left.path.localeCompare(right.path));
  if (Codec.digest(archiveDescriptors) !== auditSummary.storage_snapshot_digest || payload.reduce((sum, item) => sum + item.bytes, 0) !== overview.payloadBytes) fail('CACHE_LEASE_TIER_SOURCE_STALE');
  const manifest = validatePackage(Codec.seal({
    schema: PACKAGE_SCHEMA,
    version: VERSION,
    package_kind: 'LEASE_ARCHIVE',
    lease_id: lease.lease_id,
    owner_digest: lease.owner_digest,
    source_anchor_digest: auditSummary.anchor_digest,
    source_archive_summary: Codec.clone(auditSummary),
    payload_files: payload,
    payload_file_count: payload.length,
    payload_bytes: overview.payloadBytes,
    payload_snapshot_digest: Codec.digest(payload),
    authority: { read_only_evidence: true, source_history_deletion: false, external_immutability: false, restore_requires_explicit_approval: true, installed: false, promoted: false, canon: false }
  }));
  return { manifest, fileBytes, overview };
}
function candidateFrom(lease, capture, observedAt) {
  const summary = capture.manifest.source_archive_summary;
  return {
    lease_id: lease.lease_id,
    owner_digest: lease.owner_digest,
    state: lease.state,
    expires_at_ms: lease.expires_at_ms,
    inactive_age_ms: Math.max(0, observedAt - lease.expires_at_ms),
    source_anchor_digest: summary.anchor_digest,
    source_storage_snapshot_digest: summary.storage_snapshot_digest,
    source_archive_summary_digest: Codec.digest(summary),
    history_event_count: summary.history_events,
    payload_file_count: capture.manifest.payload_file_count,
    payload_bytes: capture.manifest.payload_bytes,
    payload_snapshot_digest: capture.manifest.payload_snapshot_digest,
    package_digest: capture.manifest.digest
  };
}

function plan(options, policyValue) {
  options = options || {};
  const policy = normalizePolicy(policyValue), observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(observedAt)) fail('CACHE_LEASE_TIER_PLAN_TIME_INVALID');
  const cache = ArtifactCache.locate(options), tier = tierRootState(options.tierRoot, false, [cache.root, options.sourceRoot, options.jobRoot]);
  const leaseSet = CacheLeases.discover(Object.assign({}, options, { nowMs: observedAt })), archiveAudit = CacheLeases.auditArchives(Object.assign({}, options, { nowMs: observedAt }));
  const proposal = {
    schema: PROPOSAL_SCHEMA, version: VERSION, status: 'NO_CHANGES', observed_at_ms: observedAt,
    cache_root_fingerprint: leaseSet.cache_root_fingerprint, tier_root_fingerprint: tier.fingerprint,
    lease_set_digest: leaseSet.digest, lease_set_snapshot_digest: leaseSet.snapshot_digest,
    archive_audit_digest: archiveAudit.digest, policy, active_leases: leaseSet.usage.active,
    considered_count: 0, inefficient_count: 0, eligible_count: 0, oversized_count: 0,
    deferred_count: 0, candidates: [], selected_history_events: 0,
    selected_payload_files: 0, selected_payload_bytes: 0, application_allowed: false,
    authority: { read_only: true, tier_write: false, source_history_deletion: false, explicit_approval_required: true, installed: false, promoted: false, canon: false }
  };
  if (leaseSet.status !== 'COMPLETE' || archiveAudit.status !== 'COMPLETE') {
    proposal.status = 'HELD';
    return { lease_set: leaseSet, archive_audit: archiveAudit, proposal: Codec.seal(proposal) };
  }
  const audited = new Map(archiveAudit.anchors.map((item) => [item.lease_id, item])), selectable = [];
  for (const lease of leaseSet.leases) {
    if (lease.state === 'ACTIVE' || lease.compaction_pending || lease.live_segment_digest !== null || !audited.has(lease.lease_id)) continue;
    const inactiveAge = Math.max(0, observedAt - lease.expires_at_ms), minimumAge = lease.state === 'RELEASED' ? policy.minimum_released_age_ms : policy.minimum_expired_age_ms;
    if (inactiveAge < minimumAge) continue;
    proposal.considered_count += 1;
    const summary = audited.get(lease.lease_id);
    if (summary.storage_bytes < policy.minimum_history_bytes) { proposal.inefficient_count += 1; continue; }
    const overview = sourceOverview(cache.root, lease.lease_id, summary);
    if (overview.payloadBytes > policy.maximum_package_bytes) { proposal.oversized_count += 1; continue; }
    proposal.eligible_count += 1;
    selectable.push({ lease, summary, overview });
  }
  selectable.sort((left, right) => right.overview.payloadBytes - left.overview.payloadBytes || left.lease.lease_id.localeCompare(right.lease.lease_id));
  for (const item of selectable) {
    if (proposal.candidates.length >= policy.max_candidates || proposal.selected_payload_bytes + item.overview.payloadBytes > policy.maximum_total_payload_bytes) { proposal.deferred_count += 1; continue; }
    const capture = captureSource(cache.root, item.lease, item.summary, policy.maximum_package_bytes), candidate = candidateFrom(item.lease, capture, observedAt);
    proposal.candidates.push(candidate);
    proposal.selected_history_events += candidate.history_event_count;
    proposal.selected_payload_files += candidate.payload_file_count;
    proposal.selected_payload_bytes += candidate.payload_bytes;
  }
  proposal.application_allowed = proposal.candidates.length > 0;
  proposal.status = proposal.candidates.length ? (proposal.deferred_count || proposal.oversized_count ? 'READY_WITH_LIMITS' : 'READY') : (proposal.oversized_count || proposal.deferred_count ? 'HELD' : 'NO_CHANGES');
  return { lease_set: leaseSet, archive_audit: archiveAudit, proposal: Codec.seal(proposal) };
}

function validateCandidate(candidate, proposal) {
  if (!exactKeys(candidate, CANDIDATE_KEYS) || !digest(candidate.lease_id) || !digest(candidate.owner_digest) || !['EXPIRED', 'RELEASED'].includes(candidate.state) || !finiteInteger(candidate.expires_at_ms) || !finiteInteger(candidate.inactive_age_ms) || !digest(candidate.source_anchor_digest) || !digest(candidate.source_storage_snapshot_digest) || !digest(candidate.source_archive_summary_digest) || !Number.isInteger(candidate.history_event_count) || candidate.history_event_count < 1 || !Number.isInteger(candidate.payload_file_count) || candidate.payload_file_count < 3 || candidate.payload_file_count > MAX_PACKAGE_FILES || !Number.isSafeInteger(candidate.payload_bytes) || candidate.payload_bytes < 1 || candidate.payload_bytes > proposal.policy.maximum_package_bytes || !digest(candidate.payload_snapshot_digest) || !digest(candidate.package_digest) || candidate.inactive_age_ms !== Math.max(0, proposal.observed_at_ms - candidate.expires_at_ms) || candidate.inactive_age_ms < (candidate.state === 'RELEASED' ? proposal.policy.minimum_released_age_ms : proposal.policy.minimum_expired_age_ms)) fail('CACHE_LEASE_TIER_CANDIDATE_INVALID');
}
function validateProposal(proposal) {
  if (!exactKeys(proposal, PROPOSAL_KEYS) || proposal.schema !== PROPOSAL_SCHEMA || proposal.version !== VERSION || !Codec.validDigest(proposal) || !['READY', 'READY_WITH_LIMITS', 'NO_CHANGES', 'HELD'].includes(proposal.status) || !finiteInteger(proposal.observed_at_ms) || !digest(proposal.cache_root_fingerprint) || !digest(proposal.tier_root_fingerprint) || !digest(proposal.lease_set_digest) || !digest(proposal.lease_set_snapshot_digest) || !digest(proposal.archive_audit_digest) || !finiteInteger(proposal.active_leases) || !finiteInteger(proposal.considered_count) || !finiteInteger(proposal.inefficient_count) || !finiteInteger(proposal.eligible_count) || !finiteInteger(proposal.oversized_count) || !finiteInteger(proposal.deferred_count) || !Array.isArray(proposal.candidates) || !finiteInteger(proposal.selected_history_events) || !finiteInteger(proposal.selected_payload_files) || !finiteInteger(proposal.selected_payload_bytes) || typeof proposal.application_allowed !== 'boolean') fail('CACHE_LEASE_TIER_PROPOSAL_INVALID');
  normalizePolicy(proposal.policy);
  proposal.candidates.forEach((candidate) => validateCandidate(candidate, proposal));
  const applicable = proposal.candidates.length > 0, limited = proposal.deferred_count > 0 || proposal.oversized_count > 0;
  const sorted = proposal.candidates.slice().sort((left, right) => right.payload_bytes - left.payload_bytes || left.lease_id.localeCompare(right.lease_id));
  const statusValid = applicable ? proposal.status === (limited ? 'READY_WITH_LIMITS' : 'READY') : limited ? proposal.status === 'HELD' : ['NO_CHANGES', 'HELD'].includes(proposal.status);
  if (proposal.candidates.length > proposal.policy.max_candidates || new Set(proposal.candidates.map((item) => item.lease_id)).size !== proposal.candidates.length || Codec.canonical(sorted) !== Codec.canonical(proposal.candidates) || proposal.considered_count !== proposal.inefficient_count + proposal.eligible_count + proposal.oversized_count || proposal.eligible_count !== proposal.candidates.length + proposal.deferred_count || proposal.selected_history_events !== proposal.candidates.reduce((sum, item) => sum + item.history_event_count, 0) || proposal.selected_payload_files !== proposal.candidates.reduce((sum, item) => sum + item.payload_file_count, 0) || proposal.selected_payload_bytes !== proposal.candidates.reduce((sum, item) => sum + item.payload_bytes, 0) || proposal.selected_payload_bytes > proposal.policy.maximum_total_payload_bytes || proposal.application_allowed !== applicable || !statusValid || !exactKeys(proposal.authority, ['read_only', 'tier_write', 'source_history_deletion', 'explicit_approval_required', 'installed', 'promoted', 'canon']) || proposal.authority.read_only !== true || proposal.authority.tier_write !== false || proposal.authority.source_history_deletion !== false || proposal.authority.explicit_approval_required !== true || Object.entries(proposal.authority).some(([key, value]) => !['read_only', 'explicit_approval_required'].includes(key) && value !== false)) fail('CACHE_LEASE_TIER_PROPOSAL_INVALID');
  return proposal;
}

function expectedDirectories(files) {
  const dirs = new Set();
  for (const item of files) {
    const parts = item.path.split('/');
    for (let index = 1; index < parts.length; index += 1) dirs.add(parts.slice(0, index).join('/'));
  }
  return dirs;
}
function walkTree(root, maximumFiles) {
  const files = [], directories = [];
  function visit(directory, relative) {
    assertPlainDirectory(directory, 'CACHE_LEASE_TIER_STORAGE_NOT_PLAIN');
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name), childRelative = relative ? relative + '/' + name : name, stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) fail('CACHE_LEASE_TIER_STORAGE_NOT_PLAIN');
      if (stat.isDirectory()) { directories.push(childRelative); visit(target, childRelative); }
      else if (stat.isFile()) { files.push(childRelative); if (files.length > maximumFiles) fail('CACHE_LEASE_TIER_PACKAGE_FILE_LIMIT'); }
      else fail('CACHE_LEASE_TIER_STORAGE_NOT_PLAIN');
    }
  }
  visit(root, '');
  return { files, directories };
}
function ensureRelativeParents(root, relative) {
  const parts = relative.split('/').slice(0, -1);
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    createDirectoryOnce(cursor);
    assertPlainDirectory(cursor, 'CACHE_LEASE_TIER_STORAGE_NOT_PLAIN');
  }
}
function writeExactFile(root, relative, bytes) {
  ensureRelativeParents(root, relative);
  const file = path.join(root, ...relative.split('/'));
  try { fs.writeFileSync(file, bytes, { flag: 'wx' }); return true; }
  catch (error) {
    if (!error || error.code !== 'EEXIST') throw error;
    const existing = plainFileBytes(file, Math.max(bytes.length, 1), 'CACHE_LEASE_TIER_EXISTING_FILE_INVALID');
    if (existing.length !== bytes.length || !existing.equals(bytes)) fail('CACHE_LEASE_TIER_EXISTING_FILE_CONFLICT');
    return false;
  }
}
function readPackageOrFail(tier, packageDigest) {
  if (!digest(packageDigest) || !tier.packagesExist) fail('CACHE_LEASE_TIER_PACKAGE_MISSING');
  const packageRoot = path.join(tier.packagesRoot, packageDigest);
  if (!fs.existsSync(packageRoot)) fail('CACHE_LEASE_TIER_PACKAGE_MISSING');
  assertPlainDirectory(packageRoot, 'CACHE_LEASE_TIER_PACKAGE_NOT_PLAIN');
  const manifestBytes = plainFileBytes(path.join(packageRoot, 'manifest.json'), MAX_MANIFEST_BYTES, 'CACHE_LEASE_TIER_PACKAGE_MANIFEST_MISSING');
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch (_) { fail('CACHE_LEASE_TIER_PACKAGE_MANIFEST_INVALID'); }
  validatePackage(manifest);
  if (manifest.digest !== packageDigest) fail('CACHE_LEASE_TIER_PACKAGE_DIGEST_MISMATCH');
  const expectedFiles = new Set(['manifest.json', ...manifest.payload_files.map((item) => 'payload/' + item.path)]), expectedDirs = expectedDirectories(manifest.payload_files.map((item) => ({ path: 'payload/' + item.path })));
  expectedDirs.add('payload');
  const tree = walkTree(packageRoot, manifest.payload_file_count + 1);
  if (Codec.canonical(tree.files) !== Codec.canonical(Array.from(expectedFiles).sort()) || tree.directories.some((item) => !expectedDirs.has(item))) fail('CACHE_LEASE_TIER_PACKAGE_UNCLASSIFIED_CONTENT');
  const fileBytes = new Map();
  let total = 0;
  for (const descriptor of manifest.payload_files) {
    const bytes = plainFileBytes(path.join(packageRoot, 'payload', ...descriptor.path.split('/')), descriptor.bytes, 'CACHE_LEASE_TIER_PACKAGE_PAYLOAD_INVALID');
    if (bytes.length !== descriptor.bytes || Codec.sha256(bytes) !== descriptor.content_digest) fail('CACHE_LEASE_TIER_PACKAGE_PAYLOAD_INVALID');
    total += bytes.length;
    if (total > MAX_PACKAGE_BYTES) fail('CACHE_LEASE_TIER_PACKAGE_BYTE_LIMIT');
    fileBytes.set(descriptor.path, bytes);
  }
  if (total !== manifest.payload_bytes || Codec.digest(manifest.payload_files) !== manifest.payload_snapshot_digest) fail('CACHE_LEASE_TIER_PACKAGE_PAYLOAD_INVALID');
  return { manifest, manifestBytes, fileBytes, packageRoot };
}
function writePackage(tier, capture) {
  validatePackage(capture.manifest);
  const packageRoot = path.join(tier.packagesRoot, capture.manifest.digest);
  createDirectoryOnce(packageRoot);
  assertPlainDirectory(packageRoot, 'CACHE_LEASE_TIER_PACKAGE_NOT_PLAIN');
  const expectedFiles = new Set(['manifest.json', ...capture.manifest.payload_files.map((item) => 'payload/' + item.path)]), expectedDirs = expectedDirectories(capture.manifest.payload_files.map((item) => ({ path: 'payload/' + item.path })));
  expectedDirs.add('payload');
  const before = walkTree(packageRoot, capture.manifest.payload_file_count + 1);
  if (before.files.some((item) => !expectedFiles.has(item)) || before.directories.some((item) => !expectedDirs.has(item))) fail('CACHE_LEASE_TIER_PACKAGE_UNCLASSIFIED_CONTENT');
  let filesWritten = 0;
  for (const descriptor of capture.manifest.payload_files) if (writeExactFile(packageRoot, 'payload/' + descriptor.path, capture.fileBytes.get(descriptor.path))) filesWritten += 1;
  const manifestBytes = Buffer.from(JSON.stringify(capture.manifest, null, 2) + '\n', 'utf8');
  if (manifestBytes.length > MAX_MANIFEST_BYTES) fail('CACHE_LEASE_TIER_PACKAGE_MANIFEST_BYTE_LIMIT');
  const manifestWritten = writeExactFile(packageRoot, 'manifest.json', manifestBytes);
  readPackageOrFail(tier, capture.manifest.digest);
  return { status: before.files.length === 0 ? 'EXPORTED' : filesWritten || manifestWritten ? 'RECOVERED' : 'EXISTS', filesWritten, manifestWritten };
}

function applicationReceipt(proposalDigest, approvedDigest, status, explicit, recordedAt, tierFingerprint, outcomes) {
  outcomes = outcomes || [];
  return Codec.seal({
    schema: APPLICATION_SCHEMA, version: VERSION, proposal_digest: String(proposalDigest || ''),
    approved_digest: approvedDigest == null ? null : String(approvedDigest), status,
    explicit: explicit === true, recorded_at_ms: recordedAt,
    tier_root_fingerprint: tierFingerprint || null, outcomes,
    packages_written: outcomes.filter((item) => item.status !== 'EXISTS').length,
    payload_files_written: outcomes.reduce((sum, item) => sum + item.payload_files_written, 0),
    source_files_removed: 0,
    authority: { tier_packages_written: outcomes.some((item) => item.status !== 'EXISTS'), source_history_deleted: false, external_immutability: false, installed: false, promoted: false, canon: false }
  });
}
function applicationNotRequested(approvedDigest) { return applicationReceipt('', approvedDigest, 'NOT_REQUESTED', false, Date.now(), null, []); }
function apply(options) {
  options = options || {};
  const proposal = validateProposal(options.proposal), recordedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(recordedAt)) fail('CACHE_LEASE_TIER_APPLICATION_TIME_INVALID');
  if (options.explicit !== true) return applicationReceipt(proposal.digest, options.approvedDigest, 'NOT_APPROVED', false, recordedAt, proposal.tier_root_fingerprint, []);
  if (options.approvedDigest !== proposal.digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'APPROVAL_MISMATCH', true, recordedAt, proposal.tier_root_fingerprint, []);
  if (!proposal.application_allowed) return applicationReceipt(proposal.digest, options.approvedDigest, 'PROPOSAL_NOT_APPLICABLE', true, recordedAt, proposal.tier_root_fingerprint, []);
  const cache = ArtifactCache.locate(options), tier = tierRootState(options.tierRoot, false, [cache.root, options.sourceRoot, options.jobRoot]);
  if (recordedAt < proposal.observed_at_ms || fingerprint(cache.root) !== proposal.cache_root_fingerprint || tier.fingerprint !== proposal.tier_root_fingerprint) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, recordedAt, proposal.tier_root_fingerprint, []);
  const leaseSet = CacheLeases.discover(Object.assign({}, options, { nowMs: proposal.observed_at_ms })), archiveAudit = CacheLeases.auditArchives(Object.assign({}, options, { nowMs: proposal.observed_at_ms }));
  if (leaseSet.status !== 'COMPLETE' || archiveAudit.status !== 'COMPLETE' || leaseSet.digest !== proposal.lease_set_digest || leaseSet.snapshot_digest !== proposal.lease_set_snapshot_digest || archiveAudit.digest !== proposal.archive_audit_digest) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, recordedAt, tier.fingerprint, []);
  const leases = new Map(leaseSet.leases.map((item) => [item.lease_id, item])), audited = new Map(archiveAudit.anchors.map((item) => [item.lease_id, item])), captures = [];
  try {
    for (const candidate of proposal.candidates) {
      const lease = leases.get(candidate.lease_id), summary = audited.get(candidate.lease_id);
      if (!lease || !summary || lease.state === 'ACTIVE' || lease.live_segment_digest !== null) fail('CACHE_LEASE_TIER_SOURCE_STALE');
      const capture = captureSource(cache.root, lease, summary, proposal.policy.maximum_package_bytes), observed = candidateFrom(lease, capture, proposal.observed_at_ms);
      if (Codec.canonical(observed) !== Codec.canonical(candidate)) fail('CACHE_LEASE_TIER_SOURCE_STALE');
      captures.push(capture);
    }
  } catch (error) {
    if (error instanceof LeaseTierError && error.code.includes('STALE')) return applicationReceipt(proposal.digest, options.approvedDigest, 'STALE', true, recordedAt, tier.fingerprint, []);
    throw error;
  }
  const writableTier = tierRootState(options.tierRoot, true, [cache.root, options.sourceRoot, options.jobRoot]), outcomes = [];
  try {
    for (const capture of captures) {
      const written = writePackage(writableTier, capture);
      outcomes.push({ lease_id: capture.manifest.lease_id, status: written.status, package_digest: capture.manifest.digest, payload_file_count: capture.manifest.payload_file_count, payload_bytes: capture.manifest.payload_bytes, payload_files_written: written.filesWritten, manifest_written: written.manifestWritten, source_files_removed: 0 });
    }
  } catch (error) {
    if (!(error instanceof LeaseTierError)) throw error;
    return applicationReceipt(proposal.digest, options.approvedDigest, outcomes.length ? 'PARTIAL' : 'TIER_REVIEW_REQUIRED', true, recordedAt, writableTier.fingerprint, outcomes);
  }
  return applicationReceipt(proposal.digest, options.approvedDigest, 'APPLIED', true, recordedAt, writableTier.fingerprint, outcomes);
}

function auditPackage(options) {
  options = options || {};
  const observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(observedAt) || !digest(options.packageDigest)) fail('CACHE_LEASE_TIER_AUDIT_INPUT_INVALID');
  const tier = tierRootState(options.tierRoot, false, [options.cacheRoot, options.sourceRoot, options.jobRoot]), audit = {
    schema: AUDIT_SCHEMA, version: VERSION, status: 'COMPLETE', observed_at_ms: observedAt,
    tier_root_fingerprint: tier.fingerprint, package_digest: options.packageDigest,
    manifest_digest: null, lease_id: null, payload_file_count: 0, payload_bytes: 0,
    payload_snapshot_digest: null, source_archive_summary_digest: null, holds: [],
    authority: { read_only: true, restore: false, source_history_deletion: false, external_immutability: false, installed: false, promoted: false, canon: false }
  };
  try {
    const read = readPackageOrFail(tier, options.packageDigest);
    audit.manifest_digest = read.manifest.digest;
    audit.lease_id = read.manifest.lease_id;
    audit.payload_file_count = read.manifest.payload_file_count;
    audit.payload_bytes = read.manifest.payload_bytes;
    audit.payload_snapshot_digest = read.manifest.payload_snapshot_digest;
    audit.source_archive_summary_digest = Codec.digest(read.manifest.source_archive_summary);
  } catch (error) {
    audit.status = 'REVIEW_REQUIRED';
    audit.holds.push({ locator_digest: Codec.sha256(Buffer.from(String(options.packageDigest), 'utf8')), reason: error instanceof LeaseTierError ? error.code : 'CACHE_LEASE_TIER_PACKAGE_AUDIT_FAILED' });
  }
  return Codec.seal(audit);
}

function validateRestoreTarget(root, manifest) {
  if (!fs.existsSync(root)) return;
  assertPlainDirectory(root, 'CACHE_LEASE_TIER_RESTORE_ROOT_NOT_PLAIN');
  const expectedFiles = new Set(manifest.payload_files.map((item) => item.path)), expectedDirs = expectedDirectories(manifest.payload_files);
  expectedDirs.add('entries');
  const tree = walkTree(root, manifest.payload_file_count);
  if (tree.files.some((item) => !expectedFiles.has(item)) || tree.directories.some((item) => !expectedDirs.has(item))) fail('CACHE_LEASE_TIER_RESTORE_TARGET_NOT_FRESH');
}
function restoreReceipt(packageDigest, approvedDigest, status, explicit, recordedAt, tierFingerprint, targetFingerprint, packageAuditDigest, filesWritten, equivalence) {
  return Codec.seal({
    schema: RESTORE_SCHEMA, version: VERSION, package_digest: String(packageDigest || ''),
    approved_digest: approvedDigest == null ? null : String(approvedDigest), status,
    explicit: explicit === true, recorded_at_ms: recordedAt,
    tier_root_fingerprint: tierFingerprint || null, target_cache_root_fingerprint: targetFingerprint || null,
    package_audit_digest: packageAuditDigest || null, payload_files_written: filesWritten || 0,
    source_files_removed: 0, full_audit_equivalence: equivalence || null,
    authority: { cache_history_written: (filesWritten || 0) > 0, source_history_deleted: false, external_immutability: false, installed: false, promoted: false, canon: false }
  });
}
function restoreNotRequested(packageDigest, approvedDigest) { return restoreReceipt(packageDigest, approvedDigest, 'NOT_REQUESTED', false, Date.now(), null, null, null, 0, null); }
function restore(options) {
  options = options || {};
  const recordedAt = options.nowMs == null ? Date.now() : options.nowMs, packageDigest = options.packageDigest;
  if (!finiteInteger(recordedAt) || !digest(packageDigest)) fail('CACHE_LEASE_TIER_RESTORE_INPUT_INVALID');
  if (options.explicit !== true) return restoreReceipt(packageDigest, options.approvedDigest, 'NOT_APPROVED', false, recordedAt, null, null, null, 0, null);
  if (options.approvedDigest !== packageDigest) return restoreReceipt(packageDigest, options.approvedDigest, 'APPROVAL_MISMATCH', true, recordedAt, null, null, null, 0, null);
  if (!path.isAbsolute(String(options.restoreCacheRoot || ''))) fail('CACHE_LEASE_TIER_RESTORE_ROOT_NOT_ABSOLUTE');
  const targetRoot = path.resolve(options.restoreCacheRoot), targetLocated = ArtifactCache.locate({ cacheRoot: targetRoot, sourceRoot: options.sourceRoot, jobRoot: options.jobRoot });
  const tier = tierRootState(options.tierRoot, false, [targetLocated.root, options.sourceRoot, options.jobRoot]);
  const packageAudit = auditPackage({ tierRoot: tier.root, packageDigest, nowMs: recordedAt, cacheRoot: targetLocated.root, sourceRoot: options.sourceRoot, jobRoot: options.jobRoot });
  if (packageAudit.status !== 'COMPLETE') return restoreReceipt(packageDigest, options.approvedDigest, 'PACKAGE_REVIEW_REQUIRED', true, recordedAt, tier.fingerprint, fingerprint(targetRoot), packageAudit.digest, 0, null);
  const read = readPackageOrFail(tier, packageDigest);
  validateRestoreTarget(targetRoot, read.manifest);
  ArtifactCache.open({ cacheRoot: targetRoot, sourceRoot: options.sourceRoot, jobRoot: options.jobRoot });
  validateRestoreTarget(targetRoot, read.manifest);
  let filesWritten = 0;
  const anchorPath = 'leases/' + read.manifest.lease_id + '.anchor.json';
  for (const descriptor of read.manifest.payload_files.filter((item) => item.path !== anchorPath)) if (writeExactFile(targetRoot, descriptor.path, read.fileBytes.get(descriptor.path))) filesWritten += 1;
  if (writeExactFile(targetRoot, anchorPath, read.fileBytes.get(anchorPath))) filesWritten += 1;
  const restoredAudit = CacheLeases.auditArchives({ cacheRoot: targetRoot, sourceRoot: options.sourceRoot, jobRoot: options.jobRoot, nowMs: recordedAt });
  const restoredSet = CacheLeases.discover({ cacheRoot: targetRoot, sourceRoot: options.sourceRoot, jobRoot: options.jobRoot, nowMs: recordedAt });
  const equivalent = restoredAudit.status === 'COMPLETE' && restoredAudit.anchors.length === 1 && Codec.canonical(restoredAudit.anchors[0]) === Codec.canonical(read.manifest.source_archive_summary) && restoredSet.status === 'COMPLETE' && restoredSet.leases.length === 1 && restoredSet.leases[0].lease_id === read.manifest.lease_id && restoredSet.leases[0].archive_anchor_digest === read.manifest.source_anchor_digest && restoredSet.leases[0].generation === read.manifest.source_archive_summary.history_events;
  if (!equivalent) fail('CACHE_LEASE_TIER_RESTORE_AUDIT_MISMATCH');
  const equivalence = { source_archive_summary_digest: Codec.digest(read.manifest.source_archive_summary), restored_archive_summary_digest: Codec.digest(restoredAudit.anchors[0]), restored_archive_audit_digest: restoredAudit.digest, restored_lease_set_digest: restoredSet.digest };
  return restoreReceipt(packageDigest, options.approvedDigest, filesWritten ? 'RESTORED' : 'ALREADY_RESTORED', true, recordedAt, tier.fingerprint, fingerprint(targetRoot), packageAudit.digest, filesWritten, equivalence);
}

module.exports = {
  PACKAGE_SCHEMA, PROPOSAL_SCHEMA, APPLICATION_SCHEMA, AUDIT_SCHEMA, RESTORE_SCHEMA,
  VERSION, MAX_CANDIDATES, MAX_PACKAGE_FILES, MAX_PACKAGE_BYTES, MAX_TOTAL_PAYLOAD_BYTES,
  LeaseTierError, normalizePolicy, validatePackage, validateProposal, plan, apply,
  applicationNotRequested, auditPackage, restore, restoreNotRequested
};
