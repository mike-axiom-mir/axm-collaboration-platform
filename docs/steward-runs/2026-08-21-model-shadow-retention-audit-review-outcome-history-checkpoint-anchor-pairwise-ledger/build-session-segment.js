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
  ['v35_frontier_reaudited', 'v3.5 provides exact relative pairwise anchored-history classification but no serialized local head global uniqueness retention authority or protected monotonic state.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix and session-curation instructions governed the work.'],
  ['isolated_codex_branch_created', 'v3.6 work stayed on a dedicated codex branch based on committed v3.5 and did not edit or reset the dirty shared main checkout.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['foreign_worktrees_and_global_index_untouched', 'Other active worktrees and the separately owned global tools-index lane were not edited.'],
  ['bounded_local_ledger_selected', 'The next reachable seam was a caller-owned local admission ledger for exact v3.5 forward receipts.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 required READY 24 required BLOCKED and 12 optional OPTIONAL_GAP routes.'],
  ['exact_genesis_and_head_pinned', 'Configured genesis and current state bind exact anchored-package checkpoint and caller-epoch references.'],
  ['stable_policy_profiles_pinned', 'The first transition pins stable anchor and witness policy identities and continuity-profile digests across the local sequence.'],
  ['exclusive_canonical_sequence_added', 'Manifest and contiguous entry files use canonical JSON self-digests exclusive create and file fsync beneath one fixed namespace.'],
  ['postwrite_and_fresh_process_reload_added', 'Successful return reloads exact bytes and fresh-process inspect derives the same validated local head.'],
  ['caller_package_rebuild_boundary_preserved', 'Stored minimized receipts self-validate but exact upstream rebuild after reload still requires the caller package.'],
  ['first_focused_fixture_order_failure_preserved', 'The first focused run failed because its first recording time was too early for a later rollback-time fixture.'],
  ['fixture_order_corrected', 'Focused fixture times were explicitly ordered without changing the runtime gate or acceptance criteria.'],
  ['focused_initial_green', 'The corrected focused suite initially passed 123 assertions.'],
  ['post_green_persisted_truth_gap_found', 'A source audit found prewrite bytes claimed exclusive-create fsync and reload completion before those operations occurred.'],
  ['persisted_truth_narrowed', 'Entry truth now states successful-return requirements and explicitly denies separately persisted write-and-reload completion.'],
  ['fsync_failure_injected', 'The entry fsync was forced to fail after write; the call returned durability uncertainty while the canonical entry remained inspectable.'],
  ['focused_final_green', 'The final v3.6 focused suite passed 129 assertions.'],
  ['same_root_branch_refusal_verified', 'A second candidate from a consumed local head is refused, including alternate anchoring of the same checkpoint.'],
  ['concurrent_writer_contention_verified', 'Exactly one of two concurrent local genesis writers wins the exclusive sequence entry.'],
  ['independent_root_counterexample_preserved', 'Two independent roots accept distinct candidates from the same configured genesis.'],
  ['deletion_counterexample_preserved', 'Deleting the caller namespace removes the head and permits a different genesis branch.'],
  ['rollback_counterexample_preserved', 'Restoring earlier namespace bytes permits a different next branch.'],
  ['resource_corruption_and_minimization_verified', 'Corrupt noncanonical gapped unexpected and oversized state fails closed while persisted artifacts omit packages keys signatures paths outcomes raw material output and private context.'],
  ['first_inherited_clock_failure_preserved', 'The first 54-command inherited run exposed a v3.4 selftest whose live review timestamps exceeded its fixed checkpoint time.'],
  ['v34_selftest_clock_pinned', 'Only the v3.4 test clock was pinned to its declared synthetic timeline; runtime behavior and acceptance criteria were unchanged.'],
  ['v34_repair_verified', 'The repaired inherited selftest passed all 109 assertions.'],
  ['optional_schema_validator_unavailable', 'No independent Draft 2020-12 validator was installed; runtime validation and recursively closed topology checks passed.'],
  ['browser_verification_not_applicable', 'No browser surface changed so no render or click claim was made.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 25 bounded required routes READY and 12 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['authority_retention_and_benefit_boundaries_preserved', 'No authenticated authority external retention global consistency protected monotonic state trusted durability benefit learning consequential action or CANON is claimed.'],
  ['source_and_session_evidence_prepared', 'The source snapshot binds ' + sources.sources.length + ' normalized inputs and ordered TEST events retain semantic outcomes without raw command logs or synthetic state.'],
  ['evidence_fsync_matcher_failure_preserved', 'The first evidence selftest expected the wrapped README fsync warning on one physical line and failed without contradicting the durable product claim.'],
  ['evidence_fsync_matcher_corrected', 'The evidence matcher now accepts ordinary Markdown whitespace while preserving the exact fsync-uncertainty wording and acceptance criterion.'],
  ['reseal_overwrite_refusal_preserved', 'The sealing utility correctly refused to overwrite the prior generated seal after the event segment changed.'],
  ['reseal_exact_target_replaced', 'Only the exact task-owned generated seal target was removed before producing the replacement seal for the expanded segment.'],
  ['evidence_schema_ref_failure_preserved', 'The next evidence selftest tried to inspect truth properties directly instead of following the schemas local definition reference.'],
  ['evidence_schema_ref_assertion_corrected', 'The evidence assertion now addresses the declared local truth definition without changing the product schema or criterion.'],
  ['evidence_clock_summary_matcher_failure_preserved', 'A later evidence matcher expected the inherited selftest clock phrase on one physical Markdown line and failed.'],
  ['evidence_clock_summary_matcher_corrected', 'The summary matcher now accepts the existing Markdown line wrap without changing the recorded clock failure repair or claim.'],
  ['first_detached_checkout_path_too_long', 'The first detached replay checkout failed before testing because its Windows path was still too long for inherited schema filenames.'],
  ['short_detached_replay_path_selected', 'The failed checkout left no registered worktree or directory; replay was redirected to the explicit shorter path C-colon backslash AXM_MIRROR_LOCAL backslash v36r.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material only.']
].map((entry, index) => ({
  schema: 'axm.session-event/v1', eventId: 'evt-' + String(index + 1).padStart(3, '0'),
  event: entry[0], status: 'TEST', detail: entry[1], timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'
}));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
