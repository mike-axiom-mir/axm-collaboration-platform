(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMErrolCoreReturnExamples = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MODEL = {
    model_id: 'model:workshop-capability-view',
    version: 4,
    created_at: '2026-08-15T08:00:00.000Z',
    evidence_refs: ['evidence:capability-atlas-snapshot', 'evidence:module-contract-scan'],
    state: {
      beginner_view: { modules: 3, next_step: 'inspect the held candidate' },
      builder_view: { contracts: 3, unresolved_seams: 1 },
      safety_view: { installed: false, promoted: false, execution: false },
      private_notes: { visibility: 'private', exported: false }
    }
  };

  var FRAME = {
    label: 'builder and safety orientation',
    focus_keys: ['builder_view', 'safety_view', 'missing_live_permission'],
    rationale: 'Show implementation and safety seams without claiming this frame is the whole model.',
    missing_key_policy: 'report',
    created_at: '2026-08-15T08:05:00.000Z',
    expires_at: '2026-08-15T10:05:00.000Z'
  };

  var TRIAD = {
    schema: 'axm.emergence-triad-evaluation-input/v1',
    entities: [
      { entity_id: 'organ:capability-atlas', label: 'Capability Atlas', roles: ['source-bound capability truth'] },
      { entity_id: 'organ:human-interface-intelligence', label: 'Human Interface Intelligence', roles: ['context-bound interface choice'] },
      { entity_id: 'organ:grounded-evolution-intelligence', label: 'Grounded Evolution Intelligence', roles: ['reversible improvement proposal'] }
    ],
    relationships: [
      { left_id: 'organ:capability-atlas', right_id: 'organ:human-interface-intelligence', relation_type: 'capability-to-interface', evidence_refs: ['evidence:atlas-hii-adapter'] },
      { left_id: 'organ:capability-atlas', right_id: 'organ:grounded-evolution-intelligence', relation_type: 'capability-to-evolution', evidence_refs: ['evidence:atlas-gei-probe'] },
      { left_id: 'organ:human-interface-intelligence', right_id: 'organ:grounded-evolution-intelligence', relation_type: 'interface-to-evolution-signal', evidence_refs: ['evidence:hii-gei-receipt'] }
    ],
    measurement: {
      proposed_center_label: 'Grounded adaptive capability loop',
      role_pattern: 'source truth -> interface choice -> reversible improvement proposal',
      joint_score: 0.82,
      pair_scores: [
        { left_id: 'organ:capability-atlas', right_id: 'organ:human-interface-intelligence', score: 0.58, evidence_refs: ['run:pair-atlas-hii'], sample_count: 4 },
        { left_id: 'organ:capability-atlas', right_id: 'organ:grounded-evolution-intelligence', score: 0.55, evidence_refs: ['run:pair-atlas-gei'], sample_count: 4 },
        { left_id: 'organ:human-interface-intelligence', right_id: 'organ:grounded-evolution-intelligence', score: 0.57, evidence_refs: ['run:pair-hii-gei'], sample_count: 4 }
      ],
      separate_description_cost: 100,
      unified_description_cost: 68,
      stability_score: 0.9,
      sample_count: 4,
      measurement_confidence: 0.85,
      evidence_refs: ['run:joint-1', 'run:joint-2', 'run:joint-3', 'run:joint-4'],
      counterevidence_refs: ['counterevidence:shared-input-risk'],
      counterevidence_search_performed: true,
      counterevidence_search_summary: 'Checked whether a pair or shared catalog input explained the measured gain; neither reproduced the joint result in this synthetic lab example.',
      alternative_explanations: ['Shared input may correlate the three organs without a higher-level capability.'],
      falsification_tests: ['Remove each organ in turn and repeat the same held-out task.'],
      measurement_method: 'deterministic held-out workflow replay',
      task_ref: 'task:capability-to-reversible-interface-improvement',
      benchmark_ref: 'benchmark:synthetic-local-adapter-v1',
      metric_name: 'normalized_workflow_utility',
      scorer_version: 'scorer:local-replay-v1',
      replicate_scores: [0.8, 0.82, 0.84, 0.82]
    }
  };

  return { MODEL: MODEL, FRAME: FRAME, TRIAD: TRIAD };
});
