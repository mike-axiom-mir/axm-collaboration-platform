#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const results = read('CHECK_RESULTS.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const sources = read('SOURCE_SNAPSHOT.json');
const events = [
  ['v30_review_view_frontier_audited', 'v3.0 verifies and presents the pristine v2.9 held-audit item but does not represent its later persisted Review Inbox outcome.'],
  ['isolated_codex_branch_preserved', 'v3.1 work stayed on its dedicated codex branch and did not edit or reset the dirty shared main checkout.'],
  ['shared_workspace_snapshot_stable', 'The starting v3.0 branch was clean and no active task owned the selected additive leaf.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing and session-curation instructions were read before their corresponding actions.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['capability_gap_before_compared', 'The baseline was BLOCKED with 3 required READY 21 required BLOCKED and 9 optional OPTIONAL_UNKNOWN routes.'],
  ['v31_data_only_outcome_leaf_selected', 'The bounded route exact-rebuilds v2.9 and consumes one caller-presented persisted item without a service host provider filesystem network or process call.'],
  ['approved_outcome_observed', 'A consistent exact-digest APPROVED fixture with two distinct approvals and one declared-human seat produced a minimized approval observation.'],
  ['held_outcome_observed', 'A consistent exact-digest HOLD fixture produced a minimized hold observation.'],
  ['rejected_outcome_observed', 'A consistent exact-digest REJECTED fixture produced a minimized rejection observation.'],
  ['immutable_transition_binding_proven', 'Item identity route artifact action seats creation and expiry are bound to the pristine v2.9 handoff.'],
  ['vote_integrity_proven', 'One to ten case-insensitively distinct exact-artifact votes are bounded and checked against the resulting state.'],
  ['pseudonymous_minimization_proven', 'Public evidence retains actor digests kinds verdicts artifact digests and times while omitting raw actors notes discussion paths and complete packages.'],
  ['standalone_actor_digest_provenance_limit_discovered', 'A self-consistent pseudonymous actor-digest rewrite passed standalone validation, proving that standalone structure cannot establish derivation from a raw actor string.'],
  ['exact_rebuild_provenance_boundary_added', 'Truth contract README and tests now require exact rebuild from the caller package for actor-digest provenance; the rewrite is rejected there.'],
  ['contract_lifecycle_failure_corrected', 'The first full focused contract check rejected unsupported reload and cleanup labels; both were corrected to not-applicable with explicit details.'],
  ['state_vote_contradictions_refused', 'Unsupported states duplicate actors wrong digests time drift conflicting approvals and state-vote contradictions fail closed.'],
  ['authority_inflation_refused', 'Declared-human is not authenticated-human actual review hold resolution remediation execution adoption or consequential authority.'],
  ['fresh_process_rebuild_proven', 'A fresh Node process rebuilt the same minimized outcome from the same caller-owned package.'],
  ['source_and_receiver_bytes_stable', 'Normalized source-observation and synthetic Review Inbox tree digests were unchanged around outcome builds and fresh-process verification.'],
  ['runtime_authority_absent', 'Runtime source imports only the v2.9 public verifier and no ReviewService filesystem process HTTP or browser network facility.'],
  ['resource_bounds_proven', 'Input output votes strings and arrays are bounded; oversized or structurally open packages fail.'],
  ['optional_json_schema_meta_validator_unavailable', 'No independent Draft 2020-12 validator was installed; schema claims are limited to static closure checks and runtime validation.'],
  ['browser_verification_not_applicable', 'v3.1 is a data-only Node leaf with no new browser surface, so no browser render or click claim was made.'],
  ['global_tools_index_untouched', 'The separately owned global tools-index refresh lane was left unchanged.'],
  ['human_review_identity_and_host_state_unproven', 'Synthetic caller-presented items prove no live host observation authenticated identity or actual human participation.'],
  ['hold_resolution_benefit_and_learning_unproven', 'No hold resolution provider evaluation human benefit learning adoption execution promotion merge Foundation mutation or CANON is claimed.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 24 required routes READY and 9 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['source_snapshot_sealed', 'The normalized source snapshot binds ' + sources.sources.length + ' current and inherited inputs.'],
  ['session_segment_closed_for_sealing', 'Ordered TEST events are retained without raw command logs synthetic votes raw identities or repetitive telemetry.'],
  ['mike_merge_and_canon_gate_preserved', 'The leaf remains TEST uninstalled and unpromoted; Mike Tobi or AXM remains the merge and CANON gate.']
].map((entry, index) => ({
  schema: 'axm.session-event/v1',
  eventId: 'evt-' + String(index + 1).padStart(3, '0'),
  event: entry[0],
  status: 'TEST',
  detail: entry[1],
  timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'
}));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
