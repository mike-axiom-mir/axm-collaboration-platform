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
const visual = read('VISUAL_RECEIPT.json');
const events = [
  ['v39_frontier_reaudited', 'Committed v3.9 exact-rebuilds caller-presented complete histories and locates first divergence but emits no review candidate or typed human-facing context.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix browser visual-verification and session-curation instructions governed the work.'],
  ['stable_workspace_snapshot_observed', 'The isolated v3.9 branch started clean with no active file shared seam truncation collision caution or status entry.'],
  ['isolated_codex_branch_created', 'v4.0 work stayed on a dedicated codex branch based on committed v3.9 and did not edit or reset the dirty shared main checkout.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['foreign_worktrees_and_global_index_untouched', 'Other worktrees and the separately owned global tools-index lane were not edited.'],
  ['review_inbox_contract_audited', 'The existing exact-digest queue accepted generic candidates and had one strict v2.9 typed renderer but no v3.9 divergence-specific human-readable verifier.'],
  ['human_context_capability_gap_found', 'A v3.9 divergence could appear only as opaque generic JSON without fail-closed typed commitment and first-divergence context.'],
  ['bounded_review_bridge_selected', 'The selected seam was a data-only exact-rebuild request plus typed Inbox view rather than invented custody identity human benefit or reconciliation.'],
  ['v40_bridge_contract_added', 'The new v4.0 TEST module remains uninstalled unpromoted state-owning-none and preserves Mike Tobi or AXM as merge gate.'],
  ['v39_exact_rebuild_required', 'Every request reruns unchanged v3.9 verification against both explicit roots and rejects stale altered or invalid evidence.'],
  ['divergence_only_admission_added', 'Exact replay normalized match prefix source-identity hold and history-observation hold cannot enter reconciliation review.'],
  ['minimized_reconciliation_artifact_added', 'The artifact retains both commitments snapshots counts common prefix first divergence and best action without copying full histories or configured roots.'],
  ['zero_reconciliation_action_added', 'The exact action fixes automatic apply reconciliation execution adoption promotion merge and CANON fields false.'],
  ['host_submission_descriptor_added', 'The request declares the existing explicit-submit route and header but opens no ReviewService network or state mutation surface.'],
  ['synthetic_receiver_compatibility_verified', 'A task-owned ReviewService root accepted idempotently reloaded and then removed the pending exact candidate with zero votes and discussion.'],
  ['bridge_focused_green', 'The v4.0 bridge suite passed 107 assertions including fresh-process exact rebuild minimization corruption bounds and source-tree immutability.'],
  ['browser_renderer_added', 'A separate v4.0 UMD renderer performs closed-shape validation browser canonical SHA-256 and item-artifact digest binding.'],
  ['renderer_corruption_suite_green', 'The renderer suite passed 191 assertions including authority inflation mismatch oversized content safe escaping and zero API surface.'],
  ['multi_renderer_routing_added', 'Review Inbox selects a renderer only by its exact dedicated kind while claimed known kinds fail closed when their verifier is unavailable.'],
  ['review_inbox_v04_contract_updated', 'Review Inbox manifest and contract moved to v0.4 TEST with explicit transition-history capabilities and approval-as-reconciliation refusals.'],
  ['shared_ui_regressions_green', 'The updated Inbox passed 45 assertions and repository HTML script compilation passed including five local Review Inbox scripts.'],
  ['browser_and_visual_rules_loaded', 'The in-app browser and live-visual verifier governed one-claim interactions responsive evidence and temporary-frame cleanup.'],
  ['read_only_visual_harness_started', 'A local GET-only harness exposed exact mismatch legacy-v2.9 and generic synthetic items while all write routes returned 405.'],
  ['unsupported_networkidle_wait_observed', 'The browser surface did not support networkidle; verification continued after the supported load state without weakening the claim.'],
  ['browser_baseline_verified', 'The default viewport showed four cards an empty typed region a disabled vote and no horizontal overflow.'],
  ['browser_exact_selection_verified', 'Exact v4.0 selection showed one VERIFIED context both commitments event one boundaries raw JSON and enabled only the vote control.'],
  ['browser_mismatch_selection_verified', 'The mismatched twin showed one HOLD with ITEM_ARTIFACT_DIGEST_MISMATCH raw JSON and a disabled vote.'],
  ['legacy_and_generic_browser_paths_verified', 'The v2.9 renderer remained VERIFIED and generic selection kept the typed panel absent without disabling ordinary exact-digest voting.'],
  ['rapid_selection_stale_result_guard_verified', 'Five exact-mismatch cycles settled on the mismatched card with one HOLD zero verified panels and disabled voting.'],
  ['narrow_layout_verified', 'At 390 by 844 the view used one fact column static vote panel wrapped the full digest and had no horizontal page overflow.'],
  ['browser_console_clean', 'The live page emitted zero browser warnings or errors during the bounded journey.'],
  ['visual_harness_cleanup_verified', 'The viewport override reset tab closed and the exact temporary visual harness root was absent after shutdown.'],
  ['temporary_frames_curated', 'Seven in-memory screenshot buffers were cleared; five selected frame digests and semantic measurements remain while raw frames and telemetry do not.'],
  ['static_evidence_generator_syntax_failure_found', 'The first static evidence generator run failed on one missing parenthesis before producing capability files.'],
  ['static_evidence_generator_corrected', 'Only the generator syntax was corrected and its full rerun wrote the requirements baseline and six evidence routes.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 bounded required route READY 27 BLOCKED and 11 optional gaps.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 28 bounded required routes READY and 11 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['required_agents_checks_passed', 'verify hub selftests route graft skin verify-plus HTML syntax tool-forge agent-tool-forge and evidence-desk all passed.'],
  ['independent_schema_validator_unavailable', 'Ajv and Python jsonschema were checked and unavailable; no dependency was installed and meta-validation remains unrun.'],
  ['normalized_source_snapshot_built', 'The source snapshot binds ' + sources.sources.length + ' normalized inherited and current product inputs.'],
  ['visual_receipt_bound', 'The live visual receipt remains ' + visual.status + ' with five selected proof-frame digests and explicit synthetic counterevidence.'],
  ['authority_identity_reconciliation_boundaries_preserved', 'No live submission identity human review reconciliation resolution custody globality benefit learning consequential action or CANON is claimed.'],
  ['reviewable_branch_and_lane_boundaries_preserved', 'Only task-owned product and evidence files changed on the isolated branch; shared main specialist packages foreign worktrees and global index remained outside scope.'],
  ['source_and_session_evidence_prepared', 'Ordered TEST events preserve outcomes failures corrections checks cleanup and open seams without raw logs screenshots synthetic state or unchanged polls.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material only.'],
  ['broad_grounded_growth_goal_remains_active', 'Authenticated submission review reconciliation independent custody human benefit learning and consequential adoption remain future work rather than fabricated completion.']
].map((entry, index) => ({ schema:'axm.session-event/v1', eventId:'evt-' + String(index + 1).padStart(3, '0'), event:entry[0], status:'TEST', detail:entry[1], timeAuthority:'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED' }));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
