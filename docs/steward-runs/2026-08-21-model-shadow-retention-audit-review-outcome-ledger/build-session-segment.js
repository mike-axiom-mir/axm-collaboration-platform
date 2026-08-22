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
  ['v31_ephemeral_outcome_frontier_audited', 'v3.1 exact-rebuilds minimized outcomes but owns no persistence after the complete caller package or upstream observation root is unavailable.'],
  ['isolated_codex_branch_preserved', 'v3.2 work stayed on its dedicated codex branch and did not edit or reset the dirty shared main checkout.'],
  ['shared_workspace_lane_stable', 'The selected module and evidence directories were new additive leaves with no foreign active owner or shared registry edit.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing and session-curation instructions were read before their corresponding actions.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['capability_gap_before_compared', 'The baseline was BLOCKED with 3 required READY 22 required BLOCKED and 10 optional OPTIONAL_UNKNOWN routes.'],
  ['minimized_outcome_only_storage_selected', 'Persisting the complete v3.1 caller package was refused because it would retain raw Review Inbox actors and vote notes.'],
  ['v32_local_append_only_ledger_selected', 'A caller-owned local append-only ledger was selected for bounded continuity without live host custody or consequential authority.'],
  ['explicit_confirmation_and_exact_rebuild_proven', 'Every valid capture requires the exact unauthenticated confirmation and exact-rebuilds v3.1 before writing.'],
  ['root_separation_proven', 'Equal or nested ledger and upstream v2.8 observation roots fail before namespace creation.'],
  ['approved_outcome_persisted', 'One exact minimized APPROVED outcome was exclusive-created and file-synced while the retention hold stayed unresolved.'],
  ['held_outcome_persisted', 'One exact minimized HOLD outcome was appended to the same digest chain.'],
  ['rejected_outcome_persisted', 'One exact minimized REJECTED outcome was appended to the same digest chain.'],
  ['contiguous_digest_chain_proven', 'Manifest sequence previous-record outcome and record digests bind all three canonical files.'],
  ['duplicate_and_time_refusal_proven', 'Duplicate record or outcome reuse and non-forward caller time append no record.'],
  ['concurrent_writer_exclusion_proven', 'Exactly one of two separate-process duplicate writers succeeded and one failed closed.'],
  ['ordinary_corruption_refused', 'Corrupt manifest record chain outcome authority bytes gaps extras noncanonical content oversized files wrong identity and stale locks fail closed.'],
  ['resource_bounds_proven', 'Capture input record count artifact and aggregate storage have explicit bounds and oversized capture input fails before field processing.'],
  ['fresh_process_reload_proven', 'Fresh processes inspected the exact snapshot and read exact records from the ledger root.'],
  ['reload_after_upstream_loss_proven', 'Fresh-process inspect and read stayed exact after verified removal of all three synthetic upstream v2.8 observation roots.'],
  ['actor_digest_reload_boundary_preserved', 'Reload validates stored pseudonymous bytes but explicitly does not re-prove derivation from absent raw actors.'],
  ['full_local_rewrite_counterexample_preserved', 'A controller-recomputed single-record ledger with a changed actor digest remained internally loadable and declared full-rewrite exclusion false.'],
  ['replacement_manifest_identity_counterexample_preserved', 'Another ledger reused the same configured manifest identity with a different valid record, so configured identity is not original-history proof.'],
  ['joint_loss_counterexample_preserved', 'Verified original ledger-root removal ended original continuity while another internally exact local ledger remained possible.'],
  ['evidence_route_rewrite_contradiction_corrected', 'The initial claim route treated every self-consistent drift as detectable; it was corrected to distinguish partial chain drift from complete controller-owned replacement.'],
  ['durable_upstream_bytes_stable', 'Normalized upstream observation-tree digests were unchanged around approved held and rejected captures.'],
  ['runtime_authority_surface_bounded', 'Runtime imports filesystem and v3.1 only; it opens no Review Inbox network provider or process route.'],
  ['optional_json_schema_meta_validator_unavailable', 'No independent Draft 2020-12 validator was installed; schema claims are limited to static closure checks and runtime validation.'],
  ['browser_verification_not_applicable', 'v3.2 is a filesystem Node leaf with no browser surface, so no browser render or click claim was made.'],
  ['global_tools_index_untouched', 'The separately owned global tools-index refresh lane was left unchanged.'],
  ['human_review_identity_and_host_state_unproven', 'Synthetic caller-presented packages prove no live host observation authenticated identity or actual human participation.'],
  ['external_custody_and_hardware_durability_unproven', 'Caller-owned file fsync proves no external custody protected monotonic state directory entry device hardware cache or power-loss durability.'],
  ['hold_resolution_benefit_learning_and_authority_unproven', 'No hold resolution remediation provider evaluation benefit learning adoption execution promotion merge Foundation mutation or CANON is claimed.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 25 required routes READY and 10 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['source_snapshot_sealed', 'The normalized source snapshot binds ' + sources.sources.length + ' current and inherited inputs.'],
  ['session_segment_closed_for_sealing', 'Ordered TEST events are retained without raw command logs actor strings vote notes caller packages or synthetic filesystem state.'],
  ['mike_merge_and_canon_gate_preserved', 'The ledger remains TEST uninstalled and unpromoted; Mike Tobi or AXM remains the merge and CANON gate.']
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
