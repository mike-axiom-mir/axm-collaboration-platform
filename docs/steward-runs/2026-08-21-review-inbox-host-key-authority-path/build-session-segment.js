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
  ['v40_frontier_reaudited', 'Committed v4.0 exact-rebuilt and rendered transition-history divergence evidence, but Review Inbox actor names remained caller-supplied attribution without authentication.'],
  ['governance_and_skill_boundaries_loaded', 'AGENTS and shared-workspace capability-gap claim-routing browser visual-verification and evidence-curation instructions governed this branch.'],
  ['isolated_codex_branch_created', 'v4.1 work stayed on codex/grounded-growth-host-trusted-review-path-v4.1 based on committed v4.0 and did not edit or reset shared main.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['foreign_worktrees_and_global_index_untouched', 'Other worktrees and the separately owned global tools-index lane were not edited.'],
  ['review_identity_gap_found', 'Distinct caller-supplied labels could reach legacy APPROVED but could not prove people machines organizations or independent controllers.'],
  ['permission_service_not_identity_proof', 'Permission decisions describe attributed actors and declared scopes; they do not authenticate an actor.'],
  ['caller_key_signature_modules_not_reused_as_trust_root', 'Existing Model Shadow signed modules explicitly treat caller keys as unauthenticated and therefore could not establish host authority.'],
  ['host_trust_root_precedent_found', 'A host-configured default-empty updater trust root supplied the bounded repository precedent for a separate authority path.'],
  ['bounded_host_key_seam_selected', 'The selected seam proves configured Ed25519 key possession and exact bindings without inventing identity human review reconciliation or consequential authority.'],
  ['default_empty_policy_path_added', 'The authority service reads a host-local policy path that Review Inbox cannot create or change; missing policy holds authority.'],
  ['expired_empty_example_added', 'The committed policy example is expired and contains no keys so it cannot accidentally activate the path.'],
  ['closed_self_digested_policy_added', 'Policy shape canonical digest Ed25519 SPKI keys roles review kinds enabled flags principal digests and active window are closed and checked.'],
  ['policy_preparse_byte_bound_added', 'Host policy file size is checked before JSON parsing and injected test policy canonical bytes are bounded.'],
  ['signed_submission_binding_added', 'Detached submission signatures bind the current policy and exact canonical normalized review candidate digest route kind and artifact digest.'],
  ['signed_vote_binding_added', 'Detached vote signatures bind the exact current item id route kind artifact digest verdict note and informed-explanation flag.'],
  ['signed_submission_prerequisite_added', 'A signed vote refuses to mutate an item unless its signed submission still validates under the current host policy.'],
  ['global_envelope_replay_refusal_added', 'Submission and vote envelope identifiers are refused after first persistence across all ledger records.'],
  ['principal_seat_uniqueness_added', 'Rotated key labels with one declared principal digest collapse to one authenticated seat.'],
  ['submitter_reviewer_separation_added', 'Host policy can refuse the signed submission principal as a review principal.'],
  ['separate_authentication_ledger_added', 'Public signature evidence persists separately and revalidates against the current item and policy after fresh service construction.'],
  ['policy_and_ledger_corruption_failclosed', 'Policy replacement malformed ledger signature tamper item drift and expiry return typed held authority.'],
  ['legacy_approved_compatibility_preserved', 'Ordinary actor labels still follow legacy ReviewService behavior but contribute zero authenticated seats.'],
  ['separate_authority_index_added', 'GET reviews exposes a distinct authority index; legacy state was not redefined.'],
  ['explicit_signed_api_routes_added', 'Signed submit and vote routes require different explicit mutation headers and accept no caller-supplied trust policy.'],
  ['private_key_and_network_boundaries_preserved', 'The runtime generates and receives no private key and opens no network or provider evaluation path.'],
  ['atomicity_boundary_made_explicit', 'Review and authentication files are not one transaction; a second-write failure stays authority-held but does not prove atomic persistence.'],
  ['protected_storage_boundary_made_explicit', 'Local ledger state proves no protected monotonic storage rollback prevention or external custody.'],
  ['review_inbox_v05_ui_added', 'Review Inbox now distinguishes policy held or ready states attributed and authenticated counts and APPROVED AUTHORITY HELD versus APPROVED HOST KEY.'],
  ['one_human_surface_claim_removed', 'The header now says ONE REVIEW SURFACE because actual human participation remains unproven.'],
  ['focused_authority_suite_green', 'Review Authority passed 59 assertions including current signed-submission prerequisite replay principal separation corruption and byte-bound checks.'],
  ['focused_api_suite_green', 'Review Authority API passed 18 assertions over explicit routes legacy separation and fresh GET assessment.'],
  ['incorrect_inherited_test_paths_failed', 'Two exploratory commands targeted nonexistent operations-selftest.js and operations-wave2-selftest.js paths and failed with MODULE_NOT_FOUND.'],
  ['actual_inherited_test_paths_resolved', 'The actual shared/operations/selftest.js and shared/operations/wave2-selftest.js paths were located and passed 86 and 49 checks.'],
  ['live_no_policy_ui_verified', 'Read-only desktop and narrow browser states showed NOT_CONFIGURED held authority existing typed view behavior and no horizontal overflow.'],
  ['live_ready_policy_ui_verified', 'Read-only desktop and narrow states distinguished legacy authority-held and host-key-approved cards with configured-key-only boundary copy.'],
  ['browser_console_clean', 'The bounded live journey emitted zero warnings and zero errors.'],
  ['temporary_browser_material_curated', 'Seven screenshot buffers were cleared; seven SHA-256 frame commitments remain while raw browser telemetry screenshots and synthetic v4 harness state do not.'],
  ['capability_before_compared', 'The v4.0 baseline capability report is ' + before.overall + ' for the selected bounded authority seam.'],
  ['capability_after_compared', 'The v4.1 capability report is ' + after.overall + ': all nineteen bounded requirements are READY while thirteen real-world routes remain OPTIONAL_UNKNOWN.'],
  ['full_verification_green', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions.'],
  ['required_agents_checks_green', 'All ten required verify hub route graft skin verify-plus HTML tool-forge agent-tool-forge and evidence-desk checks passed.'],
  ['independent_schema_validator_unavailable', 'Ajv and Python jsonschema were unavailable; no dependency was installed and independent Draft 2020-12 meta-validation remains open.'],
  ['normalized_source_snapshot_built', 'The source snapshot binds ' + sources.sources.length + ' inherited and current normalized product inputs.'],
  ['visual_receipt_bound', 'The curated visual receipt is ' + visual.status + ' and retains exactly seven semantic frame commitments with synthetic counterevidence.'],
  ['workspace_snapshot_rechecked', 'The shared-workspace scan saw only task-owned active paths in this isolated branch; no unexpected diff change appeared across the check.'],
  ['authority_truth_boundaries_preserved', 'Identity human participation trusted time reconciliation execution adoption permission promotion merge Foundation CANON benefit and learning remain unproven.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material.'],
  ['broad_grounded_growth_goal_remains_active', 'Real policy installation signed review identity custody reconciliation benefit learning and authorized adoption remain future work rather than fabricated completion.']
].map((entry, index) => ({ schema:'axm.session-event/v1', eventId:'evt-' + String(index + 1).padStart(3, '0'), event:entry[0], status:'TEST', detail:entry[1], timeAuthority:'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED' }));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
