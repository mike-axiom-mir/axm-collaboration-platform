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
  ['v33_frontier_reaudited', 'v3.3 supplies a portable relative-history checkpoint but no authenticated origin separate retention custody policy authority or consequential authority.'],
  ['isolated_codex_branch_created', 'v3.4 work stayed on a dedicated codex branch based on committed v3.3 and did not edit or reset the dirty shared main checkout.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix and session-curation instructions were read before their corresponding actions.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['global_tools_index_untouched', 'The separately owned global tools-index lane was left unchanged.'],
  ['shared_workspace_lane_rechecked', 'The new additive module and evidence directories had no foreign active owner; active-seam reports reflected this task own files.'],
  ['existing_anchor_pattern_audited', 'The v2.2 two-layer checkpoint anchor was inspected as a proven pattern but remained bound to an incompatible v2.1 contract.'],
  ['bounded_additive_adapter_selected', 'An additive v3.4 adapter was selected rather than refactoring the stable v2.2 surface or pretending signatures establish trust.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 required READY 20 required BLOCKED and 12 optional OPTIONAL_GAP routes.'],
  ['exact_v33_checkpoint_validation_composed', 'Witness construction first invokes the exact v3.3 self-validator and binds its checkpoint id schema and digest.'],
  ['witness_policy_and_signatures_verified', 'Closed caller witness policy threshold domain validity window unique seats and detached Ed25519 signatures were verified.'],
  ['witness_receipt_minimized', 'Witness receipt retains references counts and set digests without public-key PEM signatures paths complete outcomes or raw review material.'],
  ['anchor_policy_commitment_and_signatures_verified', 'Closed caller anchor policy expected commitment threshold bindings validity window and detached Ed25519 authorizations were verified.'],
  ['cross_layer_nonoverlap_verified', 'Any verified public-key fingerprint or declared-principal digest reused across witness and anchor layers fails closed.'],
  ['anchored_receipt_minimized', 'Anchored receipt retains exact references observable separation counts and domain-separated commitments without raw key or signature material.'],
  ['unchanged_v33_audit_composed', 'Exact anchored-package rebuild precedes the unchanged v3.3 current-ledger audit and preserves its classifications decisions and zero actions.'],
  ['exact_forward_and_absent_classifications_verified', 'Focused tests preserve exact forward extension and valid-namespace absence classifications while retention hold remains unresolved.'],
  ['first_focused_replay_fixture_failed_honestly', 'The first focused run expected an exact child replay after the mutable ledger had already been extended; the child correctly returned FORWARD_HISTORY_EXTENSION.'],
  ['fresh_replay_fixture_corrected', 'A separate exact-ledger fixture was frozen for fresh-process replay without weakening runtime behavior or acceptance criteria.'],
  ['same_controller_counterexample_preserved', 'One test process generated all distinct witness and anchor keys and digests; the valid receipt explicitly refuses controller-independence proof.'],
  ['joint_package_replacement_counterexample_preserved', 'A separately regenerated checkpoint policies keys signatures and expected anchor formed another valid receipt that explicitly refuses original continuity.'],
  ['signature_and_resource_refusals_verified', 'Wrong signatures substitutions authority inflation insufficient thresholds expiry duplicate seats private PEM overlap extra fields and oversized receipts fail closed.'],
  ['parallel_v33_test_flake_observed', 'Concurrent inherited verification exposed a v3.3 selftest audit time derived from the earlier original checkpoint and therefore capable of predating the later replacement checkpoint.'],
  ['v33_test_flake_corrected', 'The v3.3 joint-replacement audit time now derives from the replacement checkpoint itself; production code and classification behavior were unchanged.'],
  ['focused_v34_verification_passed', 'The corrected v3.4 focused suite passed 109 assertions.'],
  ['inherited_v33_and_v32_verification_passed', 'The corrected v3.3 suite passed 136 assertions and the unchanged v3.2 ledger suite passed 160 assertions.'],
  ['optional_schema_validator_unavailable', 'No independent Draft 2020-12 validator was installed; schema evidence is limited to runtime validation static shape checks and JSON parsing.'],
  ['browser_verification_not_applicable', 'v3.4 adds no browser surface so no browser render or click claim was made.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 21 bounded required routes READY and 12 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['authority_and_benefit_boundaries_preserved', 'No authenticated policy identity controller independence retention custody trusted time hold resolution provider evaluation benefit learning execution adoption promotion merge Foundation mutation or CANON is claimed.'],
  ['source_and_session_evidence_prepared', 'The source snapshot binds ' + sources.sources.length + ' normalized inputs and ordered TEST events retain semantic outcomes without raw logs synthetic state public keys or signatures.'],
  ['evidence_browser_wording_match_corrected', 'The first evidence selftest found that the summary used Browser verification: not applicable while the assertion expected Browser verification is not applicable; the assertion was aligned to the exact durable wording without changing any product or boundary.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material only.']
].map((entry, index) => ({
  schema: 'axm.session-event/v1',
  eventId: 'evt-' + String(index + 1).padStart(3, '0'),
  event: entry[0], status: 'TEST', detail: entry[1],
  timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'
}));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
