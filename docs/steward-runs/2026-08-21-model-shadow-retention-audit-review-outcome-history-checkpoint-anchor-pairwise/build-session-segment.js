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
  ['v34_frontier_reaudited', 'v3.4 supplies two-layer caller-policy key-possession evidence over a v3.3 history checkpoint but no authenticated origin authority separate retention custody trusted time or monotonic state.'],
  ['repository_and_skill_boundaries_loaded', 'AGENTS shared-workspace capability-gap evidence-routing evidence-matrix and session-curation instructions governed the work.'],
  ['isolated_codex_branch_created', 'v3.5 work stayed on a dedicated codex branch based on committed v3.4 and did not edit or reset the dirty shared main checkout.'],
  ['specialist_zip_lane_excluded', 'No incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP package was inspected or modified.'],
  ['foreign_worktrees_and_global_index_untouched', 'Other active worktrees and the separately owned global tools-index lane were not edited.'],
  ['promoted_trust_root_absent', 'The audited Workshop updater trust-root registry contained no promoted release key, so no trust-root authority was reused or invented.'],
  ['bounded_pairwise_adapter_selected', 'The next reachable seam was an additive two-package v3.4 exact-rebuild and complete-history comparison adapter.'],
  ['capability_gap_before_compared', 'The deterministic baseline was ' + before.overall + ' with 1 required READY 23 required BLOCKED and 12 optional OPTIONAL_GAP routes.'],
  ['stable_policy_profiles_defined', 'Witness and anchor continuity profiles retain policy identity scope thresholds key fingerprints and declared-principal digests while excluding checkpoint-specific times bindings self-digests and caller epoch.'],
  ['two_exact_v34_packages_composed', 'Both caller packages exact-rebuild their v3.4 receipts and both nested v3.3 checkpoints self-validate before comparison.'],
  ['complete_ordered_history_compared', 'Every ordered v3.3 history entry is compared for equality prefix rollback or divergence together with ledger identity and snapshot binding.'],
  ['caller_epoch_checks_added', 'Exact-history recheckpoint and forward extension require exactly the next caller epoch while rollback nonadvance and gaps remain held.'],
  ['history_ancestry_precedes_epoch_symptom', 'Strict rollback and divergent history are classified before epoch symptoms so co-presented same-next-epoch forks remain visible.'],
  ['all_nineteen_classifications_observed', 'Focused tests exercised every closed classification including exact replay recheckpoint forward drift time equivocation alternate package epoch both snapshot-history incoherence directions rollback and fork outcomes.'],
  ['same_next_epoch_counterexample_preserved', 'Two independent candidates each extended the same previous package at epoch two and compared against one another as a divergent-history hold.'],
  ['withheld_branch_counterexample_preserved', 'The truth boundary explicitly records that unpresented branches are not observed or excluded.'],
  ['joint_pair_replacement_counterexample_preserved', 'A different controller-generated authority and redigested previous/candidate pair formed another internally valid forward comparison while original-pair continuity stayed false.'],
  ['first_focused_classifier_failure_preserved', 'The first focused run exposed that equal histories satisfy both prefix predicates and were incorrectly classified as strict rollback.'],
  ['strict_prefix_predicate_corrected', 'Rollback classification was narrowed to non-equal candidate prefixes without weakening any acceptance criterion.'],
  ['focused_v35_verification_passed', 'The corrected v3.5 focused suite passed 200 assertions and observed all nineteen classifications.'],
  ['post_green_snapshot_coherence_gap_found', 'A post-green code audit found that a redigested self-valid checkpoint could extend ordered history while retaining the previous snapshot binding.'],
  ['inverse_snapshot_history_hold_added', 'A nineteenth typed hold and adversarial fixture now refuse history extension without snapshot change; full verification was rerun afterward.'],
  ['resource_and_minimization_boundaries_verified', 'Receipt size is bounded and receipts omit public keys signatures private keys paths complete outcomes raw review material model output and private context.'],
  ['no_runtime_mutation_verified', 'Runtime source imports no filesystem and performs no write network signing key-generation provider experiment or evaluation action.'],
  ['optional_schema_validator_unavailable', 'No independent Draft 2020-12 validator was installed; exact runtime enum closed-topology parsing and shape checks passed.'],
  ['browser_verification_not_applicable', 'v3.5 adds no browser surface so no render or click claim was made.'],
  ['capability_gap_after_compared', 'The deterministic result is ' + after.overall + ' with all 24 bounded required routes READY and 12 broader routes OPTIONAL_UNKNOWN.'],
  ['full_inherited_verification_passed', 'All ' + results.summary.commands + ' recorded commands passed with ' + results.summary.focusedAssertions + ' focused assertions including all ten AGENTS checks.'],
  ['authority_and_benefit_boundaries_preserved', 'No authenticated authority identity controller independence retention trusted time global uniqueness hold resolution benefit learning execution adoption promotion merge Foundation mutation or CANON is claimed.'],
  ['source_and_session_evidence_prepared', 'The source snapshot binds ' + sources.sources.length + ' normalized inputs and ordered TEST events retain semantic outcomes without raw logs synthetic state public keys or signatures.'],
  ['evidence_readme_matcher_first_correction_failed', 'The first evidence selftest expected unhyphenated same next epoch while the README used a line break and the hyphenated token same-next-epoch; a whitespace-only matcher correction remained false.'],
  ['evidence_readme_matcher_second_correction', 'The evidence matcher was aligned to the durable hyphenated README wording without changing the README product evidence or claim.'],
  ['evidence_frontier_matcher_corrected', 'A later evidence assertion expected the paraphrase no promoted trust root while the frontier audit states no promoted release key; the matcher was aligned to the exact durable wording.'],
  ['mike_merge_and_canon_gate_preserved', 'Mike Tobi or AXM remains the only merge and CANON gate; this branch is reviewable TEST material only.']
].map((entry, index) => ({
  schema: 'axm.session-event/v1',
  eventId: 'evt-' + String(index + 1).padStart(3, '0'),
  event: entry[0], status: 'TEST', detail: entry[1],
  timeAuthority: 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'
}));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' durable session events');
