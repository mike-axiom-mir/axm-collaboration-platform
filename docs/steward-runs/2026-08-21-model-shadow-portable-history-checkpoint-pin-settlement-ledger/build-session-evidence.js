#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const results = JSON.parse(fs.readFileSync(path.join(dir, 'CHECK_RESULTS.json'), 'utf8'));
const names = [
  'persistent_objective_continued',
  'clean_isolated_workspace_confirmed',
  'package_intake_lane_remained_excluded',
  'stewardship_capability_evidence_and_curation_skills_applied',
  'v24_pin_replacement_frontier_audited',
  'v25_stateful_pin_settlement_ledger_seam_selected',
  'v25_isolated_branch_created',
  'capability_gap_before_compared',
  'two_phase_settlement_contracts_frozen',
  'v25_runtime_implemented',
  'contract_lifecycle_vocabulary_defect_diagnosed_and_corrected',
  'schema_truth_boundaries_closed',
  'ineligible_transition_preflight_no_write_proven',
  'proposal_pending_settled_head_unchanged_proven',
  'fresh_process_pending_recovery_proven',
  'separate_settlement_local_head_advance_proven',
  'persisted_caller_package_exact_verification_proven',
  'concurrent_first_writer_resolution_proven',
  'stale_operation_lock_fails_closed',
  'corruption_and_namespace_fail_closed_proven',
  'independent_root_divergence_counterexample_preserved',
  'deletion_reopen_counterexample_preserved',
  'resource_path_and_symlink_boundaries_proven',
  'public_artifact_minimization_proven',
  'capability_gap_after_compared',
  'full_inherited_verification_passed',
  'claim_routes_and_open_evidence_preserved',
  'authenticated_retention_durability_and_global_authority_remain_open',
  'nonvisual_browser_boundary_recorded',
  'source_snapshot_sealed',
  'mike_merge_and_canon_gate_preserved'
];
const base = Date.parse('2026-08-21T15:00:00.000Z');
const events = names.map((event, index) => ({
  schema: 'axm.steward-session-event/v1',
  eventId: 'evt-' + String(index + 1).padStart(3, '0'),
  occurredAt: new Date(base + index * 1000).toISOString(),
  timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED',
  status: 'TEST',
  event,
  evidence: event === 'capability_gap_after_compared' ? ['CAPABILITY_GAP_AFTER.json']
    : event === 'full_inherited_verification_passed' ? ['CHECK_RESULTS.json']
      : event === 'claim_routes_and_open_evidence_preserved' ? ['EVIDENCE_ROUTES.md', 'SESSION_SUMMARY.md']
        : event === 'source_snapshot_sealed' ? ['SOURCE_SNAPSHOT.json'] : []
}));
const segment = events.map(event => JSON.stringify(event)).join('\n') + '\n';
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), segment, 'utf8');
const seal = {
  schema: 'axm.session-segment-seal/v1',
  status: 'TEST',
  segment: 'SESSION_SEGMENT.jsonl',
  parseStatus: 'valid',
  eventLines: events.length,
  validJsonLines: events.length,
  byteLength: Buffer.byteLength(segment),
  sha256: crypto.createHash('sha256').update(segment).digest('hex'),
  bytePolicy: 'exact UTF-8 bytes including final LF; no normalization'
};
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.seal.json'), JSON.stringify(seal, null, 2) + '\n', 'utf8');
const openEvidence = [
  'authenticated checkpoint origin or pin',
  'external independent retention',
  'protected monotonic state',
  'deletion or rollback prevention',
  'directory-entry or hardware power-loss durability',
  'authenticated policy rotation',
  'authenticated controller independence',
  'cross-layer collusion exclusion',
  'authenticated human participation',
  'authenticated host entrypoint',
  'externally trusted time',
  'global transition uniqueness',
  'globally consistent log',
  'atomic multi-file ledger snapshot',
  'provider execution',
  'held-out evaluation',
  'held-out human benefit or learning',
  'adoption or execution authority',
  'promotion, merge, or CANON decision'
];
const index = {
  schema: 'axm.session-evidence-index/v1',
  sessionId: 'model-shadow-portable-history-checkpoint-pin-settlement-ledger:2026-08-21',
  status: 'TEST',
  summary: 'SESSION_SUMMARY.md',
  routes: 'EVIDENCE_ROUTES.md',
  segment: 'SESSION_SEGMENT.jsonl',
  seal: 'SESSION_SEGMENT.seal.json',
  curationReceipt: 'CURATION_RECEIPT.json',
  checkResults: 'CHECK_RESULTS.json',
  sourceSnapshot: 'SOURCE_SNAPSHOT.json',
  openEvidence
};
fs.writeFileSync(path.join(dir, 'SESSION_INDEX.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  sessionId: index.sessionId,
  status: 'TEST',
  sealedSegment: 'SESSION_SEGMENT.jsonl',
  seal: 'SESSION_SEGMENT.seal.json',
  sealDigest: 'sha256:' + seal.sha256,
  durableEventsPreserved: events.length,
  telemetryAggregation: {
    retainedRawLogs: false,
    commandOutcomes: results.summary.commands,
    failedCommands: results.summary.failed,
    focusedAssertions: results.summary.focusedAssertions,
    summary: 'CHECK_RESULTS.json retains bounded outcomes and failure diagnostics; passing stdout and repeated healthy output were not retained.'
  },
  temporaryMaterialDeleted: {
    count: null,
    countKnown: false,
    reason: 'Focused ledgers, upstream rebuild packages, fresh-process packages, corrupt copies, links, locks, and concurrency fixtures used verified temporary roots removed by test cleanup. No user source, provider artifact, identity attestation, screenshot, recording, raw signature, private key, or raw log was retained.'
  },
  explicitRetentionExceptions: [
    'Implementation, schemas, tests, and contract are TEST review candidates rather than disposable evidence.',
    'Bounded comparator reports, exact check results, source snapshot, routes, summary, index, and sealed session segment remain for review.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated stewardship on an isolated codex branch. Synthetic writes were limited to verified temporary roots and the reviewable worktree. No shared-main mutation, package intake, provider, identity, authenticated human review, external retention, protected storage, rollback prevention, durability, policy rotation, permission, adoption, install, promotion, merge, or CANON authority used.'
};
fs.writeFileSync(path.join(dir, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('PASS sealed ' + events.length + ' durable events at sha256:' + seal.sha256);
