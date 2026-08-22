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
  ['v37_frontier_reaudited', 'v3.7 separates proposal from settlement beneath caller-owned roots but exposes no comparison between two current local settlement frontiers.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix and session-curation instructions governed the work.'],
  ['stable_workspace_snapshot_observed', 'The isolated v3.7 branch was clean with no active files active shared seams or collision cautions.'],
  ['isolated_codex_branch_created', 'v3.8 work stayed on a dedicated codex branch based on committed v3.7 and did not edit or reset the dirty shared main checkout.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['foreign_worktrees_and_global_index_untouched', 'Other worktrees and the separately owned global tools-index lane were not edited.'],
  ['independent_schema_validator_checked_unavailable', 'Python jsonschema Ajv Hyperjump and Node jsonschema were unavailable and no dependency was installed to conceal the gap.'],
  ['pairwise_frontier_observer_selected', 'The next reachable seam was a read-only observer for two caller-presented current v3.7 settlement packages and roots.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 required READY 20 required BLOCKED and 13 optional OPTIONAL_GAP routes.'],
  ['per_side_current_package_gate_added', 'Each side brackets exact v3.7 settlement-package verification with equal inspect snapshots and requires no pending proposal plus current last-receipt and head match.'],
  ['closed_side_observations_added', 'Exact absent invalid changing pending nonexact and older-but-exact noncurrent states form one closed side vocabulary.'],
  ['relative_pairwise_classification_added', 'Compatible admitted sides compare source identity current heads latest receipts and bounded relative relations without complete-history claims.'],
  ['read_only_receipt_added', 'The observer emits one self-digested minimized receipt and performs no filesystem or network write.'],
  ['focused_initial_green', 'The first complete focused suite passed 93 assertions.'],
  ['post_green_exactness_and_surface_gap_found', 'A truth audit found exact-but-noncurrent packages would lose their exact rebuild fact and settlement-root snapshots were mislabeled as source observations.'],
  ['exactness_and_surface_truth_narrowed', 'Package exactness and current-receipt match are now independent facts and truth explicitly denies live v3.6 source recapture and source-entry currentness.'],
  ['focused_second_green', 'The corrected suite passed 97 assertions.'],
  ['post_green_different_head_overclaim_found', 'A second audit found one divergent-head label could call different epochs a fork even when missing complete histories could contain unseen ancestry.'],
  ['same_epoch_and_unresolved_epoch_split', 'Same local epoch with different heads is separated from different local epochs whose relation remains unresolved; exact-package time ordering is checked independently per side.'],
  ['focused_final_green', 'The final v3.8 focused suite passed 103 assertions.'],
  ['all_side_and_pairwise_classifications_verified', 'All seven side observations and all eight pairwise classifications execute.'],
  ['exact_replay_and_matching_head_verified', 'Exact replay and matching settled heads in distinct local snapshots are distinguished without claiming complete history equivalence.'],
  ['relative_extension_both_directions_verified', 'Either presented latest exact settlement can expose one direct relative extension of the other current head without claiming global order.'],
  ['same_epoch_contradiction_verified', 'Different compatible heads at the same local epoch are exposed as a co-presented contradiction while global exhaustiveness remains false.'],
  ['different_epoch_relation_unresolved_verified', 'Different local epochs without a latest-receipt link remain unresolved and are not called a contradiction or fork.'],
  ['observation_and_identity_holds_verified', 'Changing absent invalid pending tampered noncurrent and source-identity mismatch fixtures all remain held.'],
  ['fresh_process_and_read_only_behavior_verified', 'Fresh-process build and exact rebuild pass while source and settlement tree digests remain byte-identical across observation.'],
  ['withheld_frontier_counterexample_preserved', 'An exact replay pair cannot expose the separately co-presentable same-epoch contradictory frontier.'],
  ['joint_pair_replacement_counterexample_preserved', 'A different jointly presented exact pair can also pass while original pair continuity remains unproven.'],
  ['resource_schema_and_minimization_verified', 'Bounded closed artifacts omit paths service options caller packages keys signatures review material model output and private context.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 21 bounded required routes READY and 13 broader routes OPTIONAL_UNKNOWN.'],
  ['browser_verification_not_applicable', 'No browser surface changed so no render or click claim was made.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['authority_retention_and_benefit_boundaries_preserved', 'No authenticated independence external custody complete-history globality trusted time benefit learning consequential action or CANON is claimed.'],
  ['source_and_session_evidence_prepared', 'The source snapshot binds ' + sources.sources.length + ' normalized inputs and ordered TEST events retain semantic outcomes without raw command logs synthetic state or unchanged polls.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material only.']
].map((entry, index) => ({ schema: 'axm.session-event/v1', eventId: 'evt-' + String(index + 1).padStart(3, '0'), event: entry[0], status: 'TEST', detail: entry[1], timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED' }));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
