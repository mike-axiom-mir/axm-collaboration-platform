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
  ['v32_replacement_frontier_audited', 'v3.2 reloads exact minimized outcomes but cannot distinguish a complete controller-recomputed replacement when no prior reference survives.'],
  ['isolated_codex_branch_preserved', 'v3.3 work stayed on its dedicated codex branch and did not edit or reset the dirty shared main checkout.'],
  ['shared_workspace_lane_stable', 'The new checkpoint and evidence directories plus the bounded v3.2 read seam had no foreign active owner or shared registry edit.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix and session-curation instructions were read before their corresponding actions.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['global_tools_index_untouched', 'The separately owned global tools-index refresh lane was left unchanged.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 required READY 24 required BLOCKED and 10 optional OPTIONAL_GAP routes.'],
  ['portable_checkpoint_adapter_selected', 'A caller-portable read-only full-history checkpoint was selected instead of a second writer or false external-retention claim.'],
  ['v32_single_load_read_added', 'v3.2 gained one additive readAll method that validates and returns the complete bounded chain from one load.'],
  ['v32_single_load_read_verified', 'The updated v3.2 focused suite passed 160 assertions including fresh-process complete-history read.'],
  ['checkpoint_origin_exact_rebuild_proven', 'Checkpoint creation brackets one complete v3.2 read with equal snapshots and exact origin rebuild succeeds while the ledger remains present.'],
  ['checkpoint_minimized_history_committed', 'The checkpoint commits ordered record and outcome references times and classifications without complete records outcomes actors votes notes discussion or paths.'],
  ['checkpoint_self_validation_proven', 'Closed counts endpoints sequences reference schemas history digest truth boundary and self-digest validate without a ledger root.'],
  ['exact_history_classified', 'The same complete ledger and checkpoint classify as exact history with no continuity hold and zero actions.'],
  ['forward_history_classified', 'A strict extension of every checkpoint entry classifies as forward history and remains review-only.'],
  ['rollback_history_classified', 'A shorter exact prefix classifies as strict rollback relative to the presented checkpoint.'],
  ['fork_history_classified', 'A shared prefix followed by a different record classifies as replacement or fork.'],
  ['identity_drift_classified', 'A different manifest reference classifies as ledger identity drift.'],
  ['absence_classified', 'A valid configured state root without the v3.2 namespace classifies as ledger absent without inventing a cause.'],
  ['invalid_ledger_and_configuration_classified', 'Corrupt canonical bytes and an invalid root configuration both produce the typed invalid classification with bounded upstream codes.'],
  ['bracketing_movement_refused', 'A changed final snapshot after the one complete read failed with LEDGER_MOVED_DURING_PRESENTATION.'],
  ['resource_and_corruption_bounds_proven', 'Oversized input checkpoint sequence endpoint classification audit digest authority and incoherent fork drift fail closed.'],
  ['initial_absence_test_boundary_corrected', 'The first focused run reached 125 assertions before distinguishing removed configured root as invalid configuration from missing namespace as ledger absence.'],
  ['focused_v33_verification_passed', 'After the exact loss-test correction the v3.3 focused suite passed 136 assertions.'],
  ['durable_v32_bytes_stable', 'Normalized synthetic v3.2 tree digests stayed byte-identical around checkpoint and audit calls after transient-lock removal.'],
  ['fresh_process_self_validation_proven', 'A fresh process validated exact checkpoint and audit data after bounded origin namespace removal.'],
  ['origin_rebuild_after_loss_refused', 'Checkpoint self-validation survived origin loss while exact origin verification correctly failed.'],
  ['retained_checkpoint_rewrite_detection_proven', 'The original checkpoint held a same-manifest whole-ledger replacement relative to its committed history.'],
  ['joint_replacement_counterexample_preserved', 'A checkpoint regenerated from the replacement audited that replacement as exact and still refused original-history proof.'],
  ['runtime_authority_surface_bounded', 'The v3.3 runtime imports only v3.2 and v3.1 modules and opens no direct filesystem network Review Inbox provider or process route.'],
  ['optional_json_schema_meta_validator_unavailable', 'No independent Draft 2020-12 validator was installed; schema claims are limited to runtime validation and static closure checks.'],
  ['browser_verification_not_applicable', 'v3.3 adds no browser surface so no browser render or click claim was made.'],
  ['human_review_identity_and_host_state_unproven', 'Synthetic caller-presented outcomes prove no live host observation authenticated reviewer or actual human participation.'],
  ['retention_durability_and_origin_unproven', 'Checkpoint data proves no separate retention authenticated origin external custody protected state hardware durability trusted time or atomic snapshot.'],
  ['hold_resolution_benefit_learning_and_authority_unproven', 'No hold resolution remediation provider evaluation benefit learning execution adoption promotion merge Foundation mutation or CANON is claimed.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 25 required routes READY and 10 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['evidence_readme_match_corrected', 'The first evidence selftest failed because a README boundary regex did not tolerate a Markdown line wrap; the assertion was narrowed to whitespace-tolerant matching without changing product behavior or the boundary.'],
  ['evidence_reseal_guard_and_second_match_corrected', 'The seal tool correctly refused to overwrite the earlier seal and the second README regex still assumed adjacent words across a line break; the stale task-owned seal was selected for replacement and the assertion was widened across whitespace.'],
  ['evidence_remaining_prose_matches_corrected', 'A third evidence pass exposed another line-wrap-sensitive README assertion before later prose checks; remaining assertions were aligned to whitespace-tolerant or exact semantic phrases without changing runtime or contract behavior.'],
  ['evidence_summary_wording_match_corrected', 'A fourth evidence pass found that the summary retained the phrase initial focused run while the assertion expected first focused run; the assertion was aligned to the exact durable wording.'],
  ['generic_machine_path_pattern_removed', 'A final source scan found no persisted machine path but did find a generic Windows user-path literal in an evidence assertion; the harness now verifies runtime path injection without committing that pattern.'],
  ['source_and_session_evidence_closed', 'The source snapshot binds ' + sources.sources.length + ' normalized inputs and ordered TEST events retain semantic outcomes without raw logs or synthetic state; Mike Tobi or AXM remains the merge and CANON gate.']
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
