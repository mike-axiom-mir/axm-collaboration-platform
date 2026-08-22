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
  ['v38_frontier_reaudited', 'v3.8 compares current snapshots and latest receipts but explicitly leaves complete proposal and settlement histories unexamined.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix and session-curation instructions governed the work.'],
  ['stable_workspace_snapshot_observed', 'The isolated v3.8 branch was clean with no active files active shared seams truncation or collision cautions.'],
  ['isolated_codex_branch_created', 'v3.9 work stayed on a dedicated codex branch based on committed v3.8 and did not edit or reset the dirty shared main checkout.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['foreign_worktrees_and_global_index_untouched', 'Other worktrees and the separately owned global tools-index lane were not edited.'],
  ['independent_schema_validator_checked_unavailable', 'Python jsonschema Ajv Hyperjump and Node jsonschema were unavailable and no dependency was installed to conceal the gap.'],
  ['complete_history_contract_gap_found', 'v3.7 validates the full chain but its snapshot commits counts heads and last references rather than every intermediate settlement receipt.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 required READY 21 required BLOCKED and 12 optional OPTIONAL_GAP routes.'],
  ['read_only_history_adapter_selected', 'The cheapest honest seam was a leaf adapter over fixed canonical v3.7 history files rather than a v3.7 API rewrite or another custody claim.'],
  ['triple_inspect_double_capture_added', 'Each side performs three unchanged v3.7 full-chain inspections around two canonical complete-history captures.'],
  ['artifact_self_digest_recheck_added', 'Both captures recheck every fixed manifest proposal and settlement self-digest under v3.7 byte and count limits.'],
  ['complete_history_commitment_added', 'Path-independent artifact-sequence and normalized-event commitments retain complete local history coverage without raw records.'],
  ['normalized_history_classification_added', 'Seven pairwise classifications cover exact artifact replay normalized equality either prefix direction earliest divergence source mismatch and observation hold.'],
  ['minimization_test_false_positive_found', 'A receipt minimization assertion matched the explicit negative field privateContextEmbedded rather than an embedded private context payload.'],
  ['minimization_test_narrowed', 'The assertion now checks actual serialized payload field names while retaining the negative truth declaration.'],
  ['undefined_export_test_harness_failure_found', 'A nonexport assertion attempted to canonicalize JavaScript undefined and failed inside the test helper after product and schema checks passed.'],
  ['undefined_export_test_harness_fixed', 'The nonexport assertion now uses direct identity and the divergence object gained explicit closed-shape coverage.'],
  ['focused_initial_green', 'The first complete focused suite passed 164 assertions.'],
  ['post_green_exact_snapshot_blind_spot_found', 'A truth audit found the hidden-held-history counterexample could be strengthened because v3.7 last-settlement snapshots do not commit earlier held receipts.'],
  ['same_snapshot_counterexample_strengthened', 'Two valid roots now share one exact v3.7 snapshot reference final head counts ids and latest receipt while their first held settlements differ.'],
  ['focused_final_green', 'The strengthened final v3.9 focused suite passed 168 assertions.'],
  ['all_side_and_pairwise_classifications_verified', 'All six side observations and all seven pairwise classifications execute.'],
  ['exact_and_normalized_replay_verified', 'Exact artifact replay is separated from matching normalized history under distinct local ids times and bindings.'],
  ['complete_prefix_both_directions_verified', 'Either complete normalized history can be a strict prefix of the other without claiming global order.'],
  ['earliest_divergence_verified', 'Different histories retain only the first divergent event index kind sequence and content digests.'],
  ['same_snapshot_hidden_held_history_verified', 'v3.8 exact snapshot replay coexists with v3.9 first-settlement divergence for different intermediate held-source outcomes.'],
  ['fresh_process_and_read_only_behavior_verified', 'Fresh-process build and exact rebuild pass while source and settlement tree digests remain byte-identical across observation.'],
  ['capture_failure_and_change_states_verified', 'Absent invalid changing capture-invalid and snapshot-mismatched sides retain distinct closed observations.'],
  ['transient_mutation_boundary_preserved', 'Sequential equal captures and inspections explicitly do not exclude adversarial mutation and reversion or prove later currentness.'],
  ['joint_pair_replacement_counterexample_preserved', 'A different jointly presented complete history can also exact-replay while original-pair continuity remains false.'],
  ['resource_schema_and_minimization_verified', 'Bounded closed receipts omit raw artifacts paths caller packages keys signatures review material model output and private context.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 22 bounded required routes READY and 12 broader routes OPTIONAL_UNKNOWN.'],
  ['browser_verification_not_applicable', 'No browser surface changed so no render or click claim was made.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['post_run_workspace_change_classified', 'The only active post-run file was the task-owned CHECK_RESULTS receipt and no shared seam or foreign file was active.'],
  ['authority_custody_globality_and_benefit_boundaries_preserved', 'No atomicity authenticated independence external custody globality trusted time benefit learning reconciliation consequential action or CANON is claimed.'],
  ['source_and_session_evidence_prepared', 'The source snapshot binds ' + sources.sources.length + ' normalized inputs and ordered TEST events retain semantic outcomes without raw command logs synthetic state or unchanged polls.'],
  ['evidence_selftest_label_mismatch_found', 'The first capability evidence selftest searched a shortened read-only assertion label and failed after earlier capability checks passed.'],
  ['evidence_selftest_label_corrected', 'The evidence selftest now checks the exact focused assertion label without weakening the read-only requirement.'],
  ['frontier_evidence_phrase_mismatch_found', 'The next capability evidence run required the phrase exact snapshot replay while the frontier accurately used exact replay and failed at that prose check.'],
  ['frontier_evidence_phrase_corrected', 'The evidence assertion now matches the exact frontier wording while retaining the same complete-history counterevidence requirement.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material only.']
].map((entry, index) => ({ schema: 'axm.session-event/v1', eventId: 'evt-' + String(index + 1).padStart(3, '0'), event: entry[0], status: 'TEST', detail: entry[1], timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED' }));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
