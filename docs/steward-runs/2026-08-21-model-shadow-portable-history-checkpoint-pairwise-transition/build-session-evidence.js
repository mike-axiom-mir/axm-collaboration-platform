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
  'specialist_zip_lane_remained_excluded',
  'stewardship_capability_evidence_and_curation_skills_applied',
  'v22_frontier_and_v18_pairwise_pattern_audited',
  'v23_pairwise_seam_selected',
  'v23_isolated_branch_created',
  'capability_gap_before_compared',
  'closed_pairwise_classification_contract_frozen',
  'normalized_policy_profile_design_frozen',
  'v23_pairwise_runtime_implemented',
  'all_fifteen_classifications_exercised',
  'two_real_independent_fork_candidates_proven',
  'withheld_branch_nonexclusion_preserved',
  'joint_pair_replacement_counterexample_proven',
  'fresh_process_and_read_only_behavior_proven',
  'public_receipt_minimization_proven',
  'capability_gap_after_compared',
  'full_inherited_verification_passed',
  'claim_routes_and_open_evidence_preserved',
  'policy_rotation_authority_remains_open',
  'nonvisual_browser_boundary_recorded',
  'source_snapshot_sealed',
  'mike_merge_and_canon_gate_preserved'
];
const base = Date.parse('2026-08-21T11:00:00.000Z');
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
  sessionId: 'model-shadow-portable-history-checkpoint-pairwise-transition:2026-08-21',
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
    reason: 'Focused ledger forks, signature packages, and restart fixtures used verified temporary roots removed by test cleanup. No specialist ZIP, user source, provider artifact, identity attestation, screenshot, recording, raw signature, private key, or raw log was retained.'
  },
  explicitRetentionExceptions: [
    'Implementation, schema, tests, fixture, and contract are TEST review candidates rather than disposable evidence.',
    'Bounded comparator reports, check results, source snapshot, routes, summary, index, and sealed session segment remain for review.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated stewardship on an isolated codex branch. Synthetic writes were limited to verified temporary roots and the reviewable worktree. No shared-main mutation, specialist-ZIP intake, provider, identity, human-review, retention, protected-storage, rollback-prevention, policy-rotation, permission, adoption, install, promotion, merge, or CANON authority used.'
};
fs.writeFileSync(path.join(dir, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('PASS sealed ' + events.length + ' durable events at sha256:' + seal.sha256);
