#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const results = JSON.parse(fs.readFileSync(path.join(dir, 'CHECK_RESULTS.json'), 'utf8'));
const eventNames = [
  'persistent_objective_resumed',
  'isolated_branch_and_dirty_main_boundary_confirmed',
  'specialist_zip_lane_excluded',
  'applicable_stewardship_capability_and_evidence_skills_applied',
  'grounded_growth_frontier_independently_audited',
  'portable_checkpoint_anchor_seam_selected',
  'capability_gap_before_compared',
  'two_layer_signature_and_nonoverlap_design_frozen',
  'v21_checkpoint_witness_layer_implemented',
  'checkpoint_witness_anchor_layer_implemented',
  'anchored_read_only_v21_audit_composed',
  'public_receipt_data_minimization_implemented',
  'shared_key_counterexample_fixture_miss_preserved',
  'shared_key_counterexample_fixture_corrected',
  'absent_ledger_fixture_configuration_miss_preserved',
  'absent_ledger_fixture_corrected',
  'focused_verification_passed',
  'same_controller_distinct_identity_counterexample_proven',
  'joint_package_replacement_counterexample_proven',
  'workshop_contract_shape_validated',
  'capability_gap_after_compared',
  'full_inherited_verification_passed',
  'claim_routes_and_open_evidence_preserved',
  'nonvisual_browser_boundary_recorded',
  'mike_merge_and_canon_gate_preserved'
];
const baseTime = Date.parse('2026-08-21T10:00:00.000Z');
const events = eventNames.map((event, index) => ({
  schema: 'axm.steward-session-event/v1',
  eventId: 'evt-' + String(index + 1).padStart(3, '0'),
  occurredAt: new Date(baseTime + index * 1000).toISOString(),
  timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED',
  status: 'TEST',
  event,
  evidence: index === 20
    ? ['CAPABILITY_GAP_AFTER.json']
    : index === 21
      ? ['CHECK_RESULTS.json']
      : index === 22
        ? ['EVIDENCE_ROUTES.md', 'SESSION_SUMMARY.md']
        : []
}));
const segment = events.map(event => JSON.stringify(event)).join('\n') + '\n';
const segmentFile = 'SESSION_SEGMENT.jsonl';
fs.writeFileSync(path.join(dir, segmentFile), segment, 'utf8');
const seal = {
  schema: 'axm.session-segment-seal/v1',
  status: 'TEST',
  segment: segmentFile,
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
  'authenticated controller independence',
  'cross-layer collusion exclusion',
  'authenticated human participation',
  'authenticated host entrypoint',
  'externally trusted time',
  'global transition uniqueness',
  'globally consistent log',
  'atomic multi-file ledger snapshot',
  'later ledger currentness',
  'provider execution',
  'held-out evaluation',
  'held-out human benefit or learning',
  'adoption or execution authority',
  'promotion, merge, or CANON decision'
];
const index = {
  schema: 'axm.session-evidence-index/v1',
  sessionId: 'model-shadow-portable-history-checkpoint-anchor:2026-08-21',
  status: 'TEST',
  summary: 'SESSION_SUMMARY.md',
  routes: 'EVIDENCE_ROUTES.md',
  segment: segmentFile,
  seal: 'SESSION_SEGMENT.seal.json',
  curationReceipt: 'CURATION_RECEIPT.json',
  checkResults: 'CHECK_RESULTS.json',
  sourceSnapshot: 'SOURCE_SNAPSHOT.json',
  openEvidence
};
fs.writeFileSync(path.join(dir, 'SESSION_INDEX.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
const curation = {
  schema: 'axm.session-curation-receipt/v1',
  sessionId: index.sessionId,
  status: 'TEST',
  sealedSegment: segmentFile,
  seal: 'SESSION_SEGMENT.seal.json',
  sealDigest: 'sha256:' + seal.sha256,
  durableEventsPreserved: events.length,
  telemetryAggregation: {
    retainedRawLogs: false,
    commandOutcomes: results.summary.commands,
    failedCommands: results.summary.failed,
    focusedAssertions: results.summary.focusedAssertions,
    summary: 'CHECK_RESULTS.json retains bounded command outcomes and failure diagnostics; passing stdout and repeated healthy logs were not retained.'
  },
  temporaryMaterialDeleted: {
    count: null,
    countKnown: false,
    reason: 'Focused cryptographic, restart, audit, overlap, and replacement fixtures used verified temporary roots removed by test cleanup. No specialist ZIP, user source, provider artifact, identity attestation, screenshot, recording, raw signature, private key, or raw log was retained.'
  },
  explicitRetentionExceptions: [
    'The v2.2 implementation, schemas, tests, and contract are TEST review candidates rather than disposable session evidence.',
    'Bounded capability reports, check results, source snapshot, claim routes, summary, index, and sealed event segment are retained for review.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated stewardship on an isolated codex branch. Synthetic writes were limited to verified temporary roots and the reviewable worktree. No shared-main mutation, specialist-ZIP intake, provider, identity, human-review, retention, protected-storage, rollback-prevention, permission, adoption, install, promotion, merge, or CANON authority used.'
};
fs.writeFileSync(path.join(dir, 'CURATION_RECEIPT.json'), JSON.stringify(curation, null, 2) + '\n', 'utf8');
console.log('PASS sealed ' + events.length + ' durable events at sha256:' + seal.sha256);
