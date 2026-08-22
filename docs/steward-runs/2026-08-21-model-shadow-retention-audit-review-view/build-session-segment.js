#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const results = read('CHECK_RESULTS.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const sources = read('SOURCE_SNAPSHOT.json');
const visual = read('VISUAL_RECEIPT.json');
const events = [
  ['v29_review_request_frontier_audited', 'v2.9 emits an exact minimized held-retention-audit candidate, while Review Inbox previously exposed only generic raw action JSON.'],
  ['shared_workspace_snapshot_stable', 'The v2.9 branch was clean with no active shared seam before v3.0 work began.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing browser live-visual and session-curation instructions were read before their corresponding actions.'],
  ['review_inbox_authority_surface_audited', 'The existing vote route and static confirmation header were preserved; the header is not authenticated identity.'],
  ['caller_directed_server_file_read_refused', 'A typed server endpoint taking caller-presented v2.8 roots was rejected because it would widen the filesystem-read surface.'],
  ['v30_read_only_view_selected', 'A typed browser renderer was selected without a new route service submission discussion vote provider or filesystem call.'],
  ['capability_gap_before_compared', 'The deterministic baseline was BLOCKED with 3 required READY 17 required BLOCKED and 7 optional OPTIONAL_UNKNOWN routes.'],
  ['claims_limits_and_counterevidence_frozen', 'Digest authority desktop mismatch narrow and regression evidence routes were frozen before implementation.'],
  ['strict_v29_shape_detection_proven', 'Only the exact v2.9 action artifact nested fields held classification truth and zero-authority flags enter the typed verifier.'],
  ['browser_canonical_digest_binding_proven', 'Browser-compatible canonical JSON SHA-256 binds both the artifact self-digest and Review Inbox item digest.'],
  ['malformed_oversized_and_inflated_items_held', 'Malformed altered oversized and authority-inflated claimed held-audit fixtures remain HOLD and not vote-ready.'],
  ['hostile_text_escaped', 'A self-consistent schema-valid hostile bestAction reaches the renderer only as escaped evidence text.'],
  ['raw_json_evidence_preserved', 'Typed context is additive and the existing raw exact-item JSON remains visible.'],
  ['generic_review_nondisruption_proven', 'A generic exact-digest item receives no typed panel and retains its existing vote readiness.'],
  ['stale_async_selection_ignored', 'Selection revisions prevent a late digest result from replacing the currently selected item state.'],
  ['desktop_exact_journey_observed', 'At 1440 by 1000 the exact fixture visibly reached VERIFIED with full digest held context raw evidence and authority boundaries.'],
  ['desktop_mismatch_journey_observed', 'At 1440 by 1000 the corrupt item visibly reached INTEGRITY HOLD and its vote control stayed disabled.'],
  ['narrow_exact_journey_observed', 'At 390 by 844 facts collapsed to one column with wrapped digest static vote panel and no horizontal page overflow.'],
  ['rapid_selection_journey_observed', 'Five exact-to-mismatch switches ended with one HOLD panel zero VERIFIED panels and a disabled vote.'],
  ['fullpage_sticky_capture_counterevidence_preserved', 'The full-page baseline capture stitched sticky regions; DOM cardinality and ordinary viewport frames were used instead for settled-layout acceptance.'],
  ['read_only_visual_harness_proven', 'The bounded harness served three synthetic items via GET and returned 405 for every POST route.'],
  ['visual_temporary_material_cleaned', 'The browser tab closed the viewport override reset the harness root was removed and nine temporary screenshot or DOM buffers were deleted after receipt extraction.'],
  ['raw_visual_frames_not_retained', 'Six screenshot images were classified TEMPORARY_CAPTURE; only semantic measurements and transient-frame SHA-256 values remain in the receipt.'],
  ['global_tools_index_rewrite_refused', 'A generator trial exposed broad unrelated index and historical-receipt churn; only that clean-before trial output was reverted and coordinated refresh remains open.'],
  ['no_new_mutation_route_proven', 'The renderer imports no service filesystem process or network module and Review Inbox still contains exactly one pre-existing vote POST call.'],
  ['assistive_technology_audit_unproven', 'ARIA structure and DOM semantics were inspected but no assistive-technology compatibility audit was performed.'],
  ['human_review_and_identity_unproven', 'Synthetic selection proves no authenticated reviewer actual human participation vote decision approval or hold resolution.'],
  ['authority_benefit_and_learning_unproven', 'No execution adoption provider evaluation benefit learning promotion merge Foundation or CANON is claimed.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 20 required routes READY and 7 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['source_snapshot_sealed', 'The normalized source snapshot binds ' + sources.sources.length + ' current and inherited inputs.'],
  ['visual_receipt_recorded', 'The live browser receipt is ' + visual.status + ' and preserves exact mismatch generic stale-selection and narrow observations without retaining screenshot bytes.'],
  ['session_evidence_sealed', 'Ordered TEST events are retained in a byte-counted SHA-256 sealed JSONL segment without raw command logs or browser telemetry.'],
  ['mike_merge_and_canon_gate_preserved', 'The Review Inbox remains TEST and subject to Mike Tobi or AXM merge and CANON decisions.']
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
