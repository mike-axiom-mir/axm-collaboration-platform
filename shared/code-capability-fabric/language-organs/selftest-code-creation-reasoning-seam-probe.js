'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const probe = require('./code-creation-reasoning-seam-probe.js');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-creation-reasoning-seam-probe.contract.json'), 'utf8'));
assert.strictEqual(contract.schema, 'axm.module-contract/v1');
assert.strictEqual(contract.id, 'code-creation-reasoning-seam-probe');
assert.deepStrictEqual(contract.permissions, []);
assert.strictEqual(contract.truth.targetsCreationReasoningNotWaldo, true);
assert.strictEqual(contract.truth.probeHasNoAuthority, true);
assert(contract.boundaries.refuses.includes('raw private chain-of-thought'));

const shared = {
  projectId: 'creation-reasoning-fixture',
  taskDigest: 'sha256:create-specialist-backed-parser-repair',
  directionSha256: 'sha256:direction-current',
  batchSha256: 'sha256:production-batch',
  draftId: 'draft-03',
  draftRevisionSha256: 'sha256:draft-03-rev-4'
};

const deterministicTrace = probe.createTrace({
  ...shared,
  creationId: 'deterministic-creation-path',
  engineClass: 'DETERMINISTIC',
  traceEvidenceDigest: 'sha256:deterministic-trace-receipt',
  finalOutputDigests: ['sha256:final-structural-edit'],
  steps: [
    {
      stepId: 'direction-grounding',
      sequence: 1,
      stage: 'DIRECTION_GROUNDING',
      operationKey: 'bind-current-direction',
      mechanismClass: 'DETERMINISTIC_RULE',
      inputDigests: ['sha256:direction-current'],
      outputDigests: ['sha256:grounded-direction'],
      rule: {
        ref: 'creation.direction.current/v1',
        conditionDigest: 'sha256:direction-condition',
        selectedBranch: 'CURRENT',
        reasonCodes: ['DIRECTION_DIGEST_MATCH']
      },
      evidence: [{
        evidenceDigest: 'sha256:direction-evidence',
        rootEvidenceDigest: 'sha256:direction-root',
        sourceClass: 'WORK_CONTEXT_DOCK',
        freshness: 'CURRENT',
        claimKey: 'direction-current',
        polarity: 'SUPPORTS'
      }],
      cost: { workUnits: 1, latencyMs: 2, externalCalls: 0 }
    },
    {
      stepId: 'specialist-grammar',
      sequence: 2,
      stage: 'SPECIALIST_OBSERVATION',
      operationKey: 'inspect-parser-seam',
      mechanismClass: 'DETERMINISTIC_RULE',
      dependsOnStepIds: ['direction-grounding'],
      inputDigests: ['sha256:grounded-direction', 'sha256:parser-fixture'],
      outputDigests: ['sha256:grammar-specialist-output'],
      rule: {
        ref: 'specialist.grammar.inspect/v1',
        conditionDigest: 'sha256:grammar-inspection-condition',
        selectedBranch: 'AMBIGUOUS_TOKEN_BOUNDARY',
        reasonCodes: ['TOKEN_BOUNDARY_AMBIGUOUS']
      },
      evidence: [{
        evidenceDigest: 'sha256:ast-view',
        rootEvidenceDigest: 'sha256:parser-run-root',
        sourceClass: 'AST_VIEW',
        freshness: 'CURRENT',
        claimKey: 'parser-boundary-safe',
        polarity: 'SUPPORTS',
        claimedIndependent: true
      }],
      boundary: {
        metric: 'ambiguity-count',
        comparator: '>=',
        threshold: 2,
        observedValue: 2,
        neighborEvidenceDigests: []
      },
      cost: { workUnits: 5, latencyMs: 8, externalCalls: 0 }
    },
    {
      stepId: 'specialist-architecture',
      sequence: 3,
      stage: 'SPECIALIST_OBSERVATION',
      operationKey: 'inspect-interface-seam',
      mechanismClass: 'DETERMINISTIC_RULE',
      dependsOnStepIds: ['direction-grounding'],
      inputDigests: ['sha256:grounded-direction', 'sha256:parser-fixture'],
      outputDigests: ['sha256:architecture-specialist-output'],
      rule: {
        ref: 'specialist.architecture.inspect/v1',
        conditionDigest: 'sha256:architecture-condition',
        selectedBranch: 'INTERFACE_MATCH',
        reasonCodes: ['DECLARED_INTERFACE_MATCH']
      },
      evidence: [{
        evidenceDigest: 'sha256:interface-view',
        rootEvidenceDigest: 'sha256:parser-run-root',
        sourceClass: 'INTERFACE_VIEW',
        freshness: 'CURRENT',
        claimKey: 'parser-boundary-safe',
        polarity: 'CONTRADICTS',
        claimedIndependent: true
      }],
      cost: { workUnits: 5, latencyMs: 8, externalCalls: 0 }
    },
    {
      stepId: 'candidate-pass-a',
      sequence: 4,
      stage: 'CANDIDATE_FORMATION',
      operationKey: 'form-structural-edit',
      mechanismClass: 'DETERMINISTIC_RULE',
      dependsOnStepIds: ['specialist-grammar'],
      inputDigests: ['sha256:grammar-specialist-output'],
      outputDigests: ['sha256:candidate-plan-a'],
      rule: {
        ref: 'creation.candidate.form/v2',
        conditionDigest: 'sha256:candidate-condition',
        selectedBranch: 'MINIMAL_STRUCTURAL_EDIT',
        reasonCodes: ['PRESERVE_UNAFFECTED_NODES']
      },
      cost: { workUnits: 13, latencyMs: 21, externalCalls: 0 }
    },
    {
      stepId: 'candidate-pass-b',
      sequence: 5,
      stage: 'CANDIDATE_FORMATION',
      operationKey: 'form-structural-edit',
      mechanismClass: 'DETERMINISTIC_RULE',
      dependsOnStepIds: ['specialist-grammar'],
      inputDigests: ['sha256:grammar-specialist-output'],
      outputDigests: ['sha256:candidate-plan-a'],
      rule: {
        ref: 'creation.candidate.form/v2',
        conditionDigest: 'sha256:candidate-condition',
        selectedBranch: 'MINIMAL_STRUCTURAL_EDIT',
        reasonCodes: ['PRESERVE_UNAFFECTED_NODES']
      },
      cost: { workUnits: 13, latencyMs: 21, externalCalls: 0 }
    },
    {
      stepId: 'high-commitment-edit',
      sequence: 6,
      stage: 'STRUCTURAL_EDIT_PROGRAM',
      operationKey: 'emit-edit-program',
      mechanismClass: 'DETERMINISTIC_RULE',
      dependsOnStepIds: ['candidate-pass-a'],
      inputDigests: ['sha256:candidate-plan-a'],
      outputDigests: ['sha256:final-structural-edit'],
      rule: {
        ref: 'creation.edit.emit/v1',
        conditionDigest: 'sha256:edit-condition',
        selectedBranch: 'EMIT',
        reasonCodes: ['CANDIDATE_PLAN_PRESENT']
      },
      commitmentClass: 'HIGH',
      cost: { workUnits: 40, latencyMs: 55, externalCalls: 0 }
    },
    {
      stepId: 'late-quick-check',
      sequence: 7,
      stage: 'VERIFICATION_SELECTION',
      operationKey: 'select-affected-check',
      mechanismClass: 'DETERMINISTIC_RULE',
      dependsOnStepIds: ['high-commitment-edit'],
      inputDigests: ['sha256:final-structural-edit'],
      outputDigests: ['sha256:selected-check'],
      rule: {
        ref: 'creation.verification.select/v1',
        conditionDigest: 'sha256:verification-condition',
        selectedBranch: 'PARSER_FIXTURE',
        reasonCodes: ['AFFECTED_PARSER_PATH']
      },
      evidence: [{
        evidenceDigest: 'sha256:old-impact-map',
        rootEvidenceDigest: 'sha256:old-impact-map',
        sourceClass: 'RELATIONSHIP_PLANE',
        freshness: 'STALE',
        claimKey: 'affected-check-current',
        polarity: 'SUPPORTS'
      }],
      cost: { workUnits: 2, latencyMs: 3, externalCalls: 0 }
    }
  ]
});

assert.strictEqual(deterministicTrace.result, 'CREATION_REASONING_TRACE_READY');
assert.strictEqual(deterministicTrace.engineClass, 'DETERMINISTIC');
assert.strictEqual(deterministicTrace.truth.neuralDecisionSummaryIsNotHiddenCausalAccess, true);
assert.deepStrictEqual(probe.createTrace({
  ...shared,
  creationId: 'deterministic-creation-path',
  engineClass: 'DETERMINISTIC',
  traceEvidenceDigest: 'sha256:deterministic-trace-receipt',
  finalOutputDigests: ['sha256:final-structural-edit'],
  steps: deterministicTrace.steps
}), deterministicTrace);

const deterministicAnalysis = probe.analyzeTrace({ trace: deterministicTrace });
assert.strictEqual(deterministicAnalysis.result, 'CREATION_REASONING_SEAMS_OBSERVED_NOT_JUDGED');
const deterministicCodes = new Set(deterministicAnalysis.findings.map(finding => finding.code));
[
  'CONTRADICTORY_EVIDENCE_PRESERVED',
  'DETERMINISTIC_DECISION_BOUNDARY_UNPROBED',
  'EXACT_REASONING_SUBPATH_REPEATED',
  'SHARED_ROOT_NOT_INDEPENDENT_CORROBORATION',
  'STALE_OR_UNKNOWN_EVIDENCE_AT_TRANSITION',
  'UNCONSUMED_SPECIALIST_OUTPUT',
  'VERIFICATION_DISCRIMINATOR_AFTER_HIGH_COMMITMENT'
].forEach(code => assert(deterministicCodes.has(code), code));
assert.strictEqual(deterministicAnalysis.whyMap.find(row => row.stepId === 'specialist-grammar').why.claimClass, 'SUPPLIED_EXACT_RULE_RECEIPT');
assert.strictEqual(deterministicAnalysis.truth.analysisTargetsCreationMachineryNotWaldo, true);
assert.strictEqual(deterministicAnalysis.truth.noReasoningChangeApplied, true);
assert(deterministicAnalysis.seamCandidates.every(candidate => candidate.autoApply === false && candidate.authority === 'NONE'));

const neuralTrace = probe.createTrace({
  ...shared,
  creationId: 'neural-specialist-creation-path',
  engineClass: 'HYBRID',
  traceEvidenceDigest: 'sha256:neural-hybrid-trace-receipt',
  finalOutputDigests: ['sha256:neural-edit-program'],
  steps: [
    {
      stepId: 'neural-specialist-synthesis',
      sequence: 1,
      stage: 'SPECIALIST_SYNTHESIS',
      operationKey: 'synthesize-specialist-observations',
      mechanismClass: 'NEURAL_DECISION_SUMMARY',
      inputDigests: ['sha256:direction-current', 'sha256:parser-fixture'],
      outputDigests: ['sha256:neural-synthesis'],
      decisionSummary: 'Prefer a local parser boundary repair because the supplied fixture isolates the failure and preserves the declared interface.',
      alternatives: ['broader parser rewrite', 'adapter-only workaround'],
      uncertainties: ['The temporary missing-evidence fixture has not been observed.'],
      evidence: [{
        evidenceDigest: 'sha256:fixture-observation',
        rootEvidenceDigest: 'sha256:fixture-observation',
        sourceClass: 'FIXTURE',
        freshness: 'CURRENT',
        claimKey: 'local-repair-sufficient',
        polarity: 'SUPPORTS'
      }],
      cost: { workUnits: 25, latencyMs: 40, externalCalls: 1 }
    },
    {
      stepId: 'deterministic-handoff',
      sequence: 2,
      stage: 'CREATION_HANDOFF',
      operationKey: 'translate-synthesis-to-edit-program',
      mechanismClass: 'HYBRID_HANDOFF',
      dependsOnStepIds: ['neural-specialist-synthesis'],
      inputDigests: ['sha256:neural-synthesis'],
      outputDigests: ['sha256:neural-edit-program'],
      decisionSummary: 'Translate the selected local repair into the structural keyboard program.',
      preservedUncertaintyRefs: [],
      cost: { workUnits: 3, latencyMs: 4, externalCalls: 0 }
    }
  ]
});
assert.strictEqual(neuralTrace.result, 'CREATION_REASONING_TRACE_READY');
const neuralAnalysis = probe.analyzeTrace({ trace: neuralTrace });
assert(neuralAnalysis.findings.some(finding => finding.code === 'UNCERTAINTY_NOT_PRESERVED_ACROSS_CREATION_HANDOFF'));
assert.strictEqual(neuralAnalysis.whyMap[0].why.claimClass, 'REPORTED_DECISION_SUMMARY_NOT_INNER_CAUSAL_PROOF');

const missingWhyTrace = probe.createTrace({
  ...shared,
  creationId: 'missing-why-path',
  engineClass: 'NEURAL',
  traceEvidenceDigest: 'sha256:missing-why-receipt',
  steps: [{
    stepId: 'neural-step',
    sequence: 1,
    stage: 'CANDIDATE_FORMATION',
    operationKey: 'form-candidate',
    mechanismClass: 'NEURAL_DECISION_SUMMARY',
    inputDigests: ['sha256:fixture'],
    outputDigests: ['sha256:candidate']
  }]
});
assert.strictEqual(missingWhyTrace.result, 'CREATION_REASONING_TRACE_READY_WITH_WHY_GAPS');
assert(probe.analyzeTrace({ trace: missingWhyTrace }).findings.some(finding => finding.code === 'WHY_RECEIPT_MISSING_OR_INCOMPLETE'));

assert.strictEqual(probe.createTrace({
  ...shared,
  creationId: 'raw-inner-reasoning',
  engineClass: 'NEURAL',
  traceEvidenceDigest: 'sha256:raw-refusal',
  steps: [{ stepId: 'x', sequence: 1, mechanismClass: 'NEURAL_DECISION_SUMMARY', chainOfThought: 'private raw reasoning' }]
}).result, 'RAW_PRIVATE_INNER_REASONING_REFUSED');
assert.strictEqual(probe.createTrace({
  ...shared,
  creationId: 'invalid-mechanism',
  engineClass: 'NEURAL',
  traceEvidenceDigest: 'sha256:invalid-mechanism',
  steps: [{ stepId: 'x', sequence: 1, mechanismClass: 'UNDECLARED_MAGIC' }]
}).result, 'CREATION_TRACE_MECHANISM_CLASS_INVALID');
assert.strictEqual(probe.createTrace({
  ...shared,
  creationId: 'bad-dependency',
  engineClass: 'DETERMINISTIC',
  traceEvidenceDigest: 'sha256:bad-dependency',
  steps: [{ stepId: 'first', sequence: 1, mechanismClass: 'DETERMINISTIC_RULE', dependsOnStepIds: ['later'] }]
}).result, 'CREATION_TRACE_DEPENDENCY_GRAPH_INVALID');

const authorityTrace = probe.createTrace({
  ...shared,
  creationId: 'authority-seam-path',
  engineClass: 'DETERMINISTIC',
  traceEvidenceDigest: 'sha256:authority-seam',
  steps: [{
    stepId: 'bad-effect',
    sequence: 1,
    stage: 'CANDIDATE_FORMATION',
    operationKey: 'form-and-promote',
    mechanismClass: 'DETERMINISTIC_RULE',
    outputDigests: ['sha256:bad-effect'],
    rule: { ref: 'bad/v1', conditionDigest: 'sha256:bad', selectedBranch: 'PROMOTE', reasonCodes: ['BAD_EFFECT'] },
    declaredEffects: ['PROMOTION', 'SOURCE_WORKSPACE_MUTATION']
  }]
});
assert(probe.analyzeTrace({ trace: authorityTrace }).findings.some(finding => finding.code === 'UNEXPECTED_AUTHORITY_EFFECT_IN_REASONING_STEP'));

const divergentDeterministicTrace = probe.createTrace({
  ...shared,
  creationId: 'divergent-deterministic-receipts',
  engineClass: 'DETERMINISTIC',
  traceEvidenceDigest: 'sha256:divergent-deterministic-receipts',
  steps: [1, 2].map((sequence, index) => ({
    stepId: `same-receipt-${sequence}`,
    sequence,
    stage: 'CANDIDATE_FORMATION',
    operationKey: 'same-declared-operation',
    mechanismClass: 'DETERMINISTIC_RULE',
    inputDigests: ['sha256:same-declared-input'],
    outputDigests: [`sha256:divergent-output-${index + 1}`],
    rule: {
      ref: 'creation.same-receipt/v1',
      conditionDigest: 'sha256:same-condition',
      selectedBranch: 'SAME_BRANCH',
      reasonCodes: ['SAME_REASON']
    }
  }))
});
assert(probe.analyzeTrace({ trace: divergentDeterministicTrace }).findings.some(finding => finding.code === 'DETERMINISTIC_SAME_RECEIPT_DIVERGENT_OUTPUT'));

const comparison = probe.compareTraces({
  leftTrace: deterministicTrace,
  rightTrace: neuralTrace,
  leftAnalysis: deterministicAnalysis,
  rightAnalysis: neuralAnalysis
});
assert.strictEqual(comparison.result, 'CREATION_REASONING_PATHS_COMPARED_NO_WINNER');
assert.strictEqual(comparison.truth.fewerStepsIsNotAutomaticallyBetter, true);
assert.strictEqual(comparison.truth.comparisonDoesNotRankOrSelect, true);
assert.strictEqual(probe.compareTraces({ leftTrace: deterministicTrace, rightTrace: { ...neuralTrace, taskDigest: 'sha256:foreign-task' } }).result, 'TWO_CURRENT_CREATION_TRACES_REQUIRED');

const reuseSeam = deterministicAnalysis.seamCandidates.find(candidate => candidate.seamCode === 'CACHE_OR_REUSE_EXACT_SUBPATH');
assert(reuseSeam);
const trial = probe.createOptimizationTrial({
  trace: deterministicTrace,
  seamCandidate: reuseSeam,
  metricContracts: [
    { metricId: 'target-shift-cancellation-ticks', desiredDirection: 'MINIMIZE', evidenceRoute: 'sha256:target-shift-fixture', invariant: 'same final verification' },
    { metricId: 'missing-evidence-quality', desiredDirection: 'MAXIMIZE', evidenceRoute: 'sha256:missing-evidence-fixture', invariant: 'contradiction preserved' },
    { metricId: 'stable-case-events', desiredDirection: 'MINIMIZE', evidenceRoute: 'sha256:stable-case-fixture', invariant: 'same output digest' }
  ]
});
assert.strictEqual(trial.result, 'CREATION_REASONING_OPTIMIZATION_TRIAL_READY_NOT_RUN');
assert.strictEqual(trial.truth.noAutomaticTuningOrSelfModification, true);

const mixed = probe.recordTrialObservation({
  trial,
  baselineTrace: deterministicTrace,
  candidateTrace: neuralTrace,
  metricObservations: [
    { metricId: 'target-shift-cancellation-ticks', baselineValue: 11, candidateValue: 2, evidenceDigest: 'sha256:early-cancel-observation' },
    { metricId: 'missing-evidence-quality', baselineValue: 100, candidateValue: 30, evidenceDigest: 'sha256:missing-evidence-regression' },
    { metricId: 'stable-case-events', baselineValue: 18, candidateValue: 27, evidenceDigest: 'sha256:stable-case-regression' }
  ]
});
assert.strictEqual(mixed.result, 'MIXED_CREATION_REASONING_OBSERVATIONS_PRESERVED_NO_WINNER');
assert.strictEqual(mixed.mixed, true);
assert(mixed.observations.some(observation => observation.relation === 'IMPROVED'));
assert(mixed.observations.some(observation => observation.relation === 'REGRESSED'));
assert.strictEqual(mixed.truth.metricsNotAveragedIntoScore, true);
assert.strictEqual(mixed.truth.improvementDoesNotEraseRegression, true);

const incomplete = probe.recordTrialObservation({
  trial,
  baselineTrace: deterministicTrace,
  candidateTrace: neuralTrace,
  metricObservations: [{ metricId: 'target-shift-cancellation-ticks', baselineValue: 11, candidateValue: 2, evidenceDigest: 'sha256:only-one-metric' }]
});
assert.strictEqual(incomplete.result, 'TRIAL_METRIC_EVIDENCE_INCOMPLETE');

const snapshot = probe.snapshot();
assert.strictEqual(snapshot.target, 'CODE_CREATION_REASONING_PATHS');
assert.strictEqual(snapshot.authority, 'NONE');
assert.strictEqual(snapshot.whySurfaces.neural, 'REPORTED_DECISION_SUMMARY_NOT_PRIVATE_CHAIN_OF_THOUGHT');

console.log(JSON.stringify({
  ok: true,
  target: snapshot.target,
  deterministicTraceSha256: deterministicTrace.traceSha256,
  deterministicFindingCodes: [...deterministicCodes].sort(),
  neuralTraceSha256: neuralTrace.traceSha256,
  neuralFindingCodes: neuralAnalysis.findings.map(finding => finding.code),
  seamCandidateCount: deterministicAnalysis.seamCandidates.length,
  comparison: comparison.result,
  mixedTrial: mixed.result,
  authority: snapshot.authority
}, null, 2));
