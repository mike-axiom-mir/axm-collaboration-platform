#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const results = read('CHECK_RESULTS.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const sources = read('SOURCE_SNAPSHOT.json');
const events = [
  ['v36_frontier_reaudited', 'v3.6 exact-rebuilds a caller-owned local forward-entry ledger but has no separate proposal and settlement phases external custody global uniqueness protected monotonic state authority or CANON decision.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix and session-curation instructions governed the work.'],
  ['isolated_codex_branch_created', 'v3.7 work stayed on a dedicated codex branch based on committed v3.6 and did not edit or reset the dirty shared main checkout.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['foreign_worktrees_and_global_index_untouched', 'Other active worktrees and the separately owned global tools-index lane were not edited.'],
  ['two_phase_settlement_seam_selected', 'The next reachable seam separates exact v3.6 proposal admission from a later independently confirmed local settlement.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 required READY 27 required BLOCKED and 12 optional OPTIONAL_GAP routes.'],
  ['proposal_gate_added', 'Proposal exact-verifies one persisted v3.6 entry under equal bracketing source snapshots and leaves the local settled head unchanged.'],
  ['settlement_gate_added', 'Settlement separately rebuilds the exact pending proposal package and rechecks the v3.6 source before writing one exact or held receipt.'],
  ['typed_hold_semantics_added', 'Source absence invalidity change or entry mismatch clears the pending proposal with a typed held receipt while preserving the previous settled head.'],
  ['exclusive_local_persistence_added', 'Canonical self-digested manifest proposal and settlement files use exclusive create file fsync a fixed transient lock and exact local reload.'],
  ['first_focused_fixture_shape_failure_preserved', 'The first focused run addressed the proposal wrapper at pending.proposal instead of pending.result.proposal and failed before product verification.'],
  ['focused_fixture_shape_corrected', 'The fixture now follows the public pending result shape without changing runtime behavior or acceptance criteria.'],
  ['second_focused_fixture_time_failure_preserved', 'The next run recorded entry C before its v3.5 comparison time and correctly failed the inherited timestamp boundary.'],
  ['focused_fixture_timeline_corrected', 'Synthetic v3.7 entry times were moved after the latest upstream comparison while retaining their intended order.'],
  ['third_focused_rollback_expectation_failure_preserved', 'The rollback fixture expected PROPOSAL_TIME_ROLLBACK but first violated the earlier entry-recording bound and returned PROPOSAL_TIME_INVALID.'],
  ['focused_rollback_fixture_corrected', 'The rollback time now remains valid for the source entry while preceding the prior settlement time.'],
  ['fourth_focused_namespace_failure_preserved', 'A held-source fixture used the v3.7 namespace helper against a v3.6 root and therefore did not remove the intended source namespace.'],
  ['focused_source_namespace_corrected', 'The fixture now resolves the exact fixed v3.6 namespace before verified task-owned removal and restoration.'],
  ['focused_initial_green', 'The corrected initial focused suite passed 151 assertions.'],
  ['post_green_settlement_truth_gap_found', 'A truth audit found source verification was discarded when snapshots changed and one snapshot claim described a nonexistent settlement-to-settlement digest chain.'],
  ['settlement_truth_narrowed', 'Settlement truth now preserves verification and bracketing facts independently and snapshot truth names the actual proposal chain plus settlement bindings.'],
  ['all_held_classifications_added', 'Focused fixtures now execute invalid source exact-entry absence and source change during check in addition to exact and absent outcomes.'],
  ['post_green_capture_state_gap_found', 'A second audit found null snapshot references alone could not distinguish absent from invalid and validation partly conflated source verification with capture health.'],
  ['capture_state_model_added', 'Observations now record PRESENT ABSENT or INVALID for each capture and rederive classification separately from exact-entry verification and snapshot equality.'],
  ['focused_final_green', 'The final v3.7 focused suite passed 176 assertions and exercised every source-observation and settlement classification.'],
  ['exact_and_held_head_behavior_verified', 'Only exact stable source evidence advances this local settled head; every held classification preserves the prior head and authorizes zero autonomous actions.'],
  ['source_advance_between_phases_verified', 'A proposed entry still settles when a later valid source entry also exists because the exact proposed entry remains persisted.'],
  ['concurrency_and_lock_boundaries_verified', 'Exactly one concurrent proposal wins and a stale fixed operation lock fails inspection closed.'],
  ['fsync_uncertainty_verified', 'Injected proposal and settlement fsync failures return typed durability uncertainty while the written artifact may remain inspectable.'],
  ['independent_root_counterexample_preserved', 'Independent caller-owned source and settlement pairs can settle divergent candidates from one genesis.'],
  ['joint_replacement_counterexample_preserved', 'Joint replacement of source and settlement namespaces can reopen a divergent sequence one.'],
  ['resource_corruption_and_minimization_verified', 'Corrupt noncanonical gapped unmatched unexpected or oversized state fails closed while persisted artifacts omit caller packages keys signatures paths review material model output and private context.'],
  ['capability_comparator_path_failure_preserved', 'The first comparator invocation used an outdated capability_gap_comparator.py filename and failed before replacing inherited generated reports.'],
  ['capability_comparator_path_corrected', 'The declared compare_capabilities.py script produced the deterministic before and after reports.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 28 bounded required routes READY and 12 broader routes OPTIONAL_UNKNOWN.'],
  ['optional_schema_validator_unavailable', 'No independent Draft 2020-12 validator was installed; runtime validation and recursively closed topology checks passed.'],
  ['browser_verification_not_applicable', 'No browser surface changed so no render or click claim was made.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['authority_retention_and_benefit_boundaries_preserved', 'No authenticated authority external retention global consistency atomic currentness protected monotonic state trusted durability benefit learning consequential action or CANON is claimed.'],
  ['source_and_session_evidence_prepared', 'The source snapshot binds ' + sources.sources.length + ' normalized inputs and ordered TEST events retain semantic outcomes without raw command logs synthetic state or unchanged polls.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material only.']
].map((entry, index) => ({
  schema: 'axm.session-event/v1', eventId: 'evt-' + String(index + 1).padStart(3, '0'),
  event: entry[0], status: 'TEST', detail: entry[1], timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'
}));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
