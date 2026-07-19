'use strict';

const State = require('./state-language');
const ReasoningMemoryGuidance = require('../organs/reasoning-memory-guidance-organ');
const ReasoningStructuralFeatures = require('../organs/reasoning-structural-feature-organ');
const StrategyModel = require('../learning/reasoning-strategy-model');

const SCHEMA = 'axm.mirror.seam-report/v1';
const STANCES = Object.freeze([
  'evidence', 'contradiction', 'boundary', 'outcome',
  'calibration', 'recovery', 'lineage', 'access'
]);
const SEVERITY = Object.freeze({ info: 0, low: 1, medium: 2, high: 3, critical: 4 });

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 2000);
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = canonical(value[key]); return out; }, {});
}

function makeSeam(id, stance, severity, statement, evidenceRefs, disconfirmingCheck, options) {
  options = options || {};
  if (!STANCES.includes(stance)) throw new Error(`unknown seam stance ${stance}`);
  if (!Object.prototype.hasOwnProperty.call(SEVERITY, severity)) throw new Error(`unknown seam severity ${severity}`);
  return {
    id,
    stance,
    severity,
    status: options.status || 'OPEN',
    statement: text(statement),
    evidenceRefs: Array.from(new Set((evidenceRefs || []).map(item => text(item, 240)).filter(Boolean))),
    disconfirmingCheck: text(disconfirmingCheck),
    blocks: Array.from(new Set((options.blocks || []).map(item => text(item, 120)).filter(Boolean))),
    repairHint: text(options.repairHint) || null,
    closureHistory: []
  };
}

function finalize(subject, seams, meta) {
  meta = meta || {};
  const ordered = seams.slice().sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity] || a.id.localeCompare(b.id));
  const normalizedSubject = {
    id: text(subject && subject.id, 120) || 'unknown',
    kind: text(subject && subject.kind, 120) || 'unknown'
  };
  const subjectDigest = text(subject && subject.digest, 64);
  if (/^[a-f0-9]{64}$/.test(subjectDigest)) normalizedSubject.digest = subjectDigest;
  const basis = { subject: normalizedSubject, seams: ordered };
  return {
    schema: SCHEMA,
    reportId: `seams-${State.digest(basis)}`,
    identity: 'axm.machine.mirror/seed-0',
    subject: normalizedSubject,
    createdAt: text(meta.at, 80) || null,
    stances: STANCES.slice(),
    seams: ordered,
    summary: {
      open: ordered.filter(item => item.status === 'OPEN').length,
      blocked: ordered.filter(item => item.status === 'BLOCKED').length,
      closed: ordered.filter(item => item.status === 'CLOSED').length,
      highestSeverity: ordered.length ? ordered[0].severity : null
    },
    boundary: 'A seam is a typed gap or tension. It is not proof of failure, novelty, danger, intelligence, or resolution.'
  };
}

function verifyReportIntegrity(report) {
  if (!report || report.schema !== SCHEMA || !report.subject || !Array.isArray(report.seams)) throw new Error('invalid seam report');
  const expected = finalize(report.subject, report.seams, { at: report.createdAt });
  if (JSON.stringify(canonical(expected)) !== JSON.stringify(canonical(report))) throw new Error('seam report integrity mismatch');
  return true;
}

function inspectTrace(trace, meta) {
  if (!trace || trace.schema !== 'axm.mirror.trace/v1') throw new Error('Seam Cell requires an AXM Mirror trace');
  const seams = [];
  const evidenceIds = new Set(((trace.epistemic && trace.epistemic.evidence) || []).map(item => item.id));
  const selected = (trace.candidates || []).find(item => item.action && item.action.id === trace.decision.selectedActionId);
  const selectedAction = selected && selected.action;
  const unknowns = (trace.epistemic && trace.epistemic.unknowns) || [];
  const contradictions = (trace.epistemic && trace.epistemic.contradictions) || [];

  if (trace.decision.selectedActionId === 'hold-no-candidate') seams.push(makeSeam(
    'candidate-organ-missing', 'access', 'medium',
    'The goal reached a truthful hold because no action candidate was supplied or originated.',
    [trace.traceId], 'Supply an independently produced bounded candidate and confirm Seed-0 can evaluate it without changing permissions.',
    { blocks: ['goal-progress'], repairHint: 'Build or connect a candidate proposal organ; keep tool execution outside it.' }
  ));
  if (selectedAction && selectedAction.kind === 'hold' && trace.decision.value === 1) seams.push(makeSeam(
    'hold-labelled-success', 'outcome', 'high',
    'An explicit non-mutating hold is labelled as a successful decision.',
    [trace.traceId, selectedAction.id], 'The same request must return decision value 0 while preserving the hold action and zero mutation.',
    { blocks: ['training-intake', 'decision-metrics'], repairHint: 'Separate supported world actions from supported epistemic holds.' }
  ));
  const blockingUnknowns = unknowns.filter(item => item.blocking);
  if (blockingUnknowns.length) seams.push(makeSeam(
    'blocking-unknowns', 'evidence', 'medium',
    `${blockingUnknowns.length} declared unknown(s) still block interpretation or action.`,
    blockingUnknowns.map(item => item.id), 'Provide sourced observations that answer each blocking question, or retain the hold.',
    { blocks: ['factual-promotion'] }
  ));
  if (contradictions.length) seams.push(makeSeam(
    'unresolved-contradictions', 'contradiction', 'high',
    `${contradictions.length} evidence contradiction(s) remain unresolved and visible.`,
    contradictions.flat(), 'Run a check that discriminates between the conflicting evidence records without deleting either record.',
    { blocks: ['factual-promotion', 'automatic-training'] }
  ));
  if (trace.decision.value === 1 && selectedAction && !['ask', 'observe', 'hold'].includes(selectedAction.kind)) {
    const support = (selectedAction.supportingEvidence || []).filter(id => evidenceIds.has(id));
    if (!support.length) seams.push(makeSeam(
      'accepted-action-without-support', 'evidence', 'critical',
      'A mutating or propositional action passed without present supporting evidence.',
      [trace.traceId, selectedAction.id], 'The action must hold until at least one present evidence record supports it.',
      { blocks: ['tool-action', 'training-intake'] }
    ));
    if (!selectedAction.reversible || !selectedAction.recovery) seams.push(makeSeam(
      'accepted-action-without-recovery', 'recovery', 'critical',
      'A passing world action lacks a verified reversibility and recovery declaration.',
      [trace.traceId, selectedAction.id], 'Demonstrate rollback from an observed checkpoint before the action may pass.',
      { blocks: ['tool-action'] }
    ));
  }
  if (!trace.traceId || !trace.requestId || !trace.rootBundle || !trace.rootBundle.sha256) seams.push(makeSeam(
    'trace-lineage-incomplete', 'lineage', 'critical',
    'The trace cannot be reconstructed from identity, request and root bundle hashes.',
    [trace.traceId || 'trace-id-missing'], 'Recreate the trace with stable request, trace and immutable root-bundle identifiers.',
    { blocks: ['training-intake', 'canon-review'] }
  ));
  return finalize({ id: trace.traceId, kind: 'reason-trace' }, seams, meta);
}

function overlap(left, right) {
  const b = new Set(right || []);
  return (left || []).filter(item => b.has(item));
}

function inspectLearningCycle(cycle, meta) {
  if (!cycle || cycle.schema !== 'axm.mirror.learning-cycle/v1') throw new Error('Seam Cell requires an AXM Mirror learning cycle');
  const seams = [];
  const documents = cycle.corpus && Array.isArray(cycle.corpus.documents) ? cycle.corpus.documents : [];
  if (!cycle.corpus || Number(cycle.corpus.approvedTrainingEpisodes) < 1) seams.push(makeSeam(
    'approved-experience-missing', 'evidence', 'medium',
    'The training partition contains no reviewed session episode, so it cannot support a claim that Mirror learned from lived Workshop outcomes.',
    [cycle.cycleId], 'Add one explicitly permitted, outcome-verified session episode and keep it group-separated from held-out evaluation.',
    { blocks: ['experience-learning-claim'], repairHint: 'Capture observe, propose, decide, outcome, verify and repair—not raw private conversation.' }
  ));
  if (!cycle.corpus || Number(cycle.corpus.trainingTokenCount) < 50000) seams.push(makeSeam(
    'training-corpus-small', 'calibration', 'medium',
    `The training partition contains only ${Number(cycle.corpus && cycle.corpus.trainingTokenCount) || 0} tokens.`,
    [cycle.cycleId], 'Repeat with at least 50,000 permissioned, deduplicated training tokens while preserving the same held-out gates.',
    { blocks: ['broad-language-capability-claim'] }
  ));
  const unauthorized = documents.filter(item => item.usePermission !== 'allowed' || !item.sha256 || !item.permissionBasis);
  if (unauthorized.length) seams.push(makeSeam(
    'corpus-rights-or-lineage-gap', 'lineage', 'critical',
    `${unauthorized.length} corpus item(s) lack explicit permission, provenance basis, or a content hash.`,
    unauthorized.map(item => item.id || item.path), 'Every included item must carry usePermission=allowed, permissionBasis and a verified content hash.',
    { blocks: ['training', 'promotion'] }
  ));
  const splits = cycle.corpus && cycle.corpus.splits || {};
  const splitLineage = cycle.corpus && cycle.corpus.splitLineage;
  if (!splitLineage || splitLineage.schema !== 'axm.mirror.language-evaluation-split-lineage/v1' || splitLineage.assignmentPolicy !== 'IMMUTABLE_FIRST_OBSERVED_GROUP_ROLE_NEW_GROUPS_TRAIN_ONLY' || splitLineage.automaticEvaluationRoleReassignment !== false) seams.push(makeSeam(
    'evaluation-role-lineage-missing', 'lineage', 'critical',
    'The cycle does not bind an immutable longitudinal role for every previously observed train, validation, and test group.',
    [cycle.cycleId], 'Reconstruct verified prior cycle assignments, preserve every first-observed role, and assign unseen groups to training only.',
    { blocks: ['metric-interpretation', 'automatic-corpus-growth', 'promotion'] }
  ));
  const evaluationMoves = splitLineage && Array.isArray(splitLineage.evaluationGroupsMovedToTraining) ? splitLineage.evaluationGroupsMovedToTraining : [];
  const trainingMoves = splitLineage && Array.isArray(splitLineage.trainingGroupsMovedToEvaluation) ? splitLineage.trainingGroupsMovedToEvaluation : [];
  if (splitLineage && (splitLineage.historicalRoleConflicts !== 0 || evaluationMoves.length || trainingMoves.length)) seams.push(makeSeam(
    'longitudinal-evaluation-role-conflict', 'evidence', 'critical',
    'A previously exposed source group changed train, validation, or test role across learning cycles.',
    evaluationMoves.concat(trainingMoves, [cycle.cycleId]), 'Restore the first observed role for every group and preserve the conflicting cycle as failed evidence.',
    { blocks: ['training', 'metric-interpretation', 'promotion'] }
  ));
  const leakage = Array.from(new Set(overlap(splits.train, splits.validation).concat(overlap(splits.train, splits.test), overlap(splits.validation, splits.test))));
  if (leakage.length) seams.push(makeSeam(
    'evaluation-split-leakage', 'evidence', 'critical',
    'One or more source groups occur in multiple train/validation/test partitions.',
    leakage, 'Rebuild group-separated partitions and show that no source or episode family crosses the held-out boundary.',
    { blocks: ['metric-interpretation', 'promotion'] }
  ));
  if (!splits.train || !splits.validation || !splits.test || !splits.train.length || !splits.validation.length || !splits.test.length) seams.push(makeSeam(
    'evaluation-partition-missing', 'evidence', 'high',
    'Train, validation and training-excluded local regression partitions are not all present.',
    [cycle.cycleId], 'Run a cycle with non-empty, group-separated train, validation and test partitions.',
    { blocks: ['promotion'] }
  ));
  if (!cycle.evaluation || !cycle.evaluation.challenger || !cycle.evaluation.baseline) seams.push(makeSeam(
    'baseline-comparison-missing', 'calibration', 'high',
    'The challenger was not compared with an explicit baseline on the same held-out material.',
    [cycle.cycleId], 'Evaluate baseline and challenger on identical separated validation and training-excluded local regression partitions.',
    { blocks: ['promotion'] }
  ));
  if (!cycle.evaluation || cycle.evaluation.selectionUsedTestMetrics !== false) seams.push(makeSeam(
    'test-informed-model-selection', 'evidence', 'critical',
    'The cycle does not prove that challenger selection excluded local test metrics.',
    [cycle.cycleId], 'Choose every model and hyperparameter only from training and validation evidence, then evaluate the selected challenger once on the local regression partition.',
    { blocks: ['metric-interpretation', 'promotion'] }
  ));
  if (!cycle.evaluation || cycle.evaluation.testExcludedFromTraining !== true) seams.push(makeSeam(
    'test-training-exclusion-unproven', 'lineage', 'critical',
    'The local regression partition is not explicitly proven excluded from training.',
    [cycle.cycleId], 'Bind disjoint source groups and record testExcludedFromTraining=true before interpreting the regression metric.',
    { blocks: ['metric-interpretation', 'promotion'] }
  ));
  if (cycle.evaluation && cycle.evaluation.challenger && cycle.evaluation.baseline) {
    const challenger = Number(cycle.evaluation.challenger.testPerplexity);
    const baseline = Number(cycle.evaluation.baseline.testPerplexity);
    if (!Number.isFinite(challenger) || !Number.isFinite(baseline)) seams.push(makeSeam(
      'non-finite-evaluation', 'calibration', 'critical',
      'A held-out metric is absent, NaN or infinite.', [cycle.cycleId],
      'Repeat evaluation with finite token counts and finite loss on the training-excluded local regression partition.', { blocks: ['promotion'] }
    ));
    else if (challenger >= baseline) seams.push(makeSeam(
      'challenger-regression', 'outcome', 'high',
      `The challenger test perplexity ${challenger.toFixed(3)} did not beat baseline ${baseline.toFixed(3)}.`,
      [cycle.evaluation.challenger.artifactId, cycle.evaluation.baseline.artifactId],
      'Train a repaired challenger that improves the same training-excluded local regression metric without weakening safety or structure checks.',
      { blocks: ['promotion'], repairHint: 'Improve context, data quality or architecture; do not tune on the test partition.' }
    ));
  }
  if (!cycle.evaluation || !Array.isArray(cycle.evaluation.canaries) || !cycle.evaluation.canaries.length) seams.push(makeSeam(
    'behavior-canaries-missing', 'outcome', 'high',
    'Perplexity is not accompanied by behavioral canaries for structure, contradiction, permission and repair.',
    [cycle.cycleId], 'Run versioned canaries and preserve each raw pass/fail receipt.',
    { blocks: ['promotion'] }
  ));
  const failedCanaries = cycle.evaluation && Array.isArray(cycle.evaluation.canaries) ? cycle.evaluation.canaries.filter(item => item.status !== 'PASS') : [];
  if (failedCanaries.length) seams.push(makeSeam(
    'behavior-canary-failure', 'boundary', 'critical',
    `${failedCanaries.length} behavior canary check(s) did not pass.`,
    failedCanaries.map(item => item.id), 'Repair and rerun the same frozen canary set; do not rewrite failed receipts.',
    { blocks: ['promotion', 'tool-scope-growth'] }
  ));
  if (!cycle.recovery || !cycle.recovery.previousChampion || !cycle.recovery.rollbackProcedure) seams.push(makeSeam(
    'promotion-recovery-missing', 'recovery', 'critical',
    'The cycle lacks an explicit previous champion reference or rollback procedure.',
    [cycle.cycleId], 'Restore the previous champion in a dry run and record the resulting hash.',
    { blocks: ['promotion'] }
  ));
  if (!cycle.recovery || !String(cycle.recovery.rollbackDryRun || '').startsWith('PASS')) seams.push(makeSeam(
    'rollback-not-demonstrated', 'recovery', 'high',
    'A rollback path is described but has not been demonstrated by a passing dry-run receipt.',
    [cycle.cycleId], 'Run the rollback procedure without changing the active runtime and preserve the PASS receipt.',
    { blocks: ['promotion'] }
  ));
  if (cycle.promotion && cycle.promotion.automatic === true) seams.push(makeSeam(
    'automatic-promotion-enabled', 'access', 'critical',
    'The learning cycle permits automatic promotion into the runtime or identity.',
    [cycle.cycleId], 'Require an explicit reviewed promotion receipt and prove the runtime pointer remains unchanged before review.',
    { blocks: ['promotion', 'runtime-load'] }
  ));
  if (!cycle.promotion || cycle.promotion.reviewRequired !== true) seams.push(makeSeam(
    'explicit-review-gate-missing', 'access', 'critical',
    'The cycle does not require an explicit review before promotion.',
    [cycle.cycleId], 'Set reviewRequired=true and require a digest-bound promotion receipt.',
    { blocks: ['promotion'] }
  ));
  if (!cycle.promotion || cycle.promotion.runtimePointerChanged !== false) seams.push(makeSeam(
    'runtime-changed-before-review', 'access', 'critical',
    'The active runtime pointer changed, or its unchanged state was not explicitly proven, before review.',
    [cycle.cycleId], 'Restore the previous runtime pointer and record runtimePointerChanged=false before review.',
    { blocks: ['promotion', 'runtime-load'] }
  ));
  if (!cycle.seamInvocation || cycle.seamInvocation.mode !== 'deliberate' || cycle.seamInvocation.invoked !== true) seams.push(makeSeam(
    'deliberate-seam-review-missing', 'boundary', 'high',
    'The stronger Seam Cell judgement was not explicitly invoked for this learning cycle.',
    [cycle.cycleId], 'Invoke the Seam Cell deliberately at the learning judgement gate and preserve its report.',
    { blocks: ['promotion'] }
  ));
  if (!cycle.artifacts || !cycle.artifacts.length || !cycle.artifacts.every(item => item.path && /^[a-f0-9]{64}$/.test(String(item.sha256 || '')))) seams.push(makeSeam(
    'artifact-manifest-incomplete', 'lineage', 'critical',
    'One or more cycle artifacts lack a path and verified hash.',
    [cycle.cycleId], 'Hash every dataset, tokenizer, weight, configuration and report artifact before review.',
    { blocks: ['training-replay', 'promotion'] }
  ));
  return finalize({ id: cycle.cycleId, kind: 'learning-cycle', digest: cycle.resultDigest }, seams, meta);
}

function inspectReasoningSession(session, meta) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1') throw new Error('Seam Cell requires an AXM Mirror reasoning session');
  const seams = [];
  const trace = session.principleTrace;
  if (!trace || trace.schema !== 'axm.mirror.trace/v1') seams.push(makeSeam(
    'reasoning-principle-trace-missing', 'lineage', 'critical',
    'The reasoning foundation output is not linked to a valid Principle Cell trace.',
    [session.reasoningSessionId], 'Re-run the session through the Principle Cell and preserve the trace identifier and root hash.',
    { blocks: ['path-selection', 'consolidation', 'development-proposal'] }
  ));
  const selectedActionId = session.pathSet && session.pathSet.selectedActionId;
  const comparison = session.pathSet && Array.isArray(session.pathSet.comparisons)
    ? session.pathSet.comparisons.find(item => item.actionId === selectedActionId)
    : null;
  if (selectedActionId && (!comparison || comparison.gateValue !== 1 || comparison.eligible !== true)) seams.push(makeSeam(
    'reasoning-selection-bypassed-gate', 'boundary', 'critical',
    'The selected reasoning path did not pass the recorded evidence, permission, risk, and verification gates.',
    [session.reasoningSessionId, selectedActionId], 'Select only a path with gateValue=1 and eligible=true, or preserve HOLD.',
    { blocks: ['world-action', 'consolidation'] }
  ));
  if (selectedActionId && trace && trace.decision && trace.decision.selectedActionId !== selectedActionId) seams.push(makeSeam(
    'reasoning-selection-trace-mismatch', 'lineage', 'high',
    'The Reasoning Foundation selection and Principle Cell decision name different actions.',
    [session.reasoningSessionId, trace.traceId, selectedActionId, trace.decision.selectedActionId],
    'Replay the selected path through the Principle Cell and preserve one linked decision.',
    { blocks: ['consolidation'] }
  ));
  const toolAuthorityLeak = !!(session.authority && session.authority.toolUse) ||
    !!(session.pathSet && Array.isArray(session.pathSet.comparisons) && session.pathSet.comparisons.some(item => item.toolRequest && item.toolRequest.authorityGranted));
  if (toolAuthorityLeak) seams.push(makeSeam(
    'reasoning-tool-authority-leak', 'access', 'critical',
    'A reasoning or tool-request record granted tool authority inside the foundation.',
    [session.reasoningSessionId], 'Set every internal tool grant to false and route the request through an external permission gate.',
    { blocks: ['tool-use', 'promotion'] }
  ));
  const authority = session.authority || {};
  const forbiddenAuthority = ['worldAction', 'toolUse', 'permissionGrant', 'memoryWrite', 'trainingAdmission', 'runtimePromotion', 'canonChange', 'identityChange'].filter(key => authority[key] !== false);
  if (forbiddenAuthority.length) seams.push(makeSeam(
    'reasoning-authority-boundary-incomplete', 'access', 'critical',
    `Reasoning authority is not explicitly false for: ${forbiddenAuthority.join(', ')}.`,
    [session.reasoningSessionId], 'Record every authority field as false and keep execution and promotion in external gates.',
    { blocks: ['world-action', 'memory-write', 'promotion'] }
  ));
  if (!session.memoryRoute || !Array.isArray(session.memoryRoute.writesPerformed) || session.memoryRoute.writesPerformed.length) seams.push(makeSeam(
    'reasoning-memory-write-boundary-broken', 'boundary', 'critical',
    'The memory route is missing an explicit empty write receipt or reports a write.',
    [session.reasoningSessionId], 'Return proposal-only destinations with writesPerformed=[] and require separate admission.',
    { blocks: ['memory-admission', 'training'] }
  ));
  const strategyGuidance = session.pathSet && session.pathSet.strategyGuidance;
  const structuralProjection = strategyGuidance && strategyGuidance.structuralProjection;
  if (strategyGuidance) {
    let validStructuralProjection = true;
    let structuralProjectionError = null;
    try { ReasoningStructuralFeatures.verify(structuralProjection, session); } catch (error) { validStructuralProjection = false; structuralProjectionError = error; }
    if (!validStructuralProjection) seams.push(makeSeam(
      'reasoning-structural-feature-projection-integrity-failed', 'lineage', 'critical',
      `The schema-selected structural feature projection is missing, invalid, or no longer reconstructs from the reasoning session: ${structuralProjectionError && structuralProjectionError.message || 'unknown projection error'}`,
      [session.reasoningSessionId, structuralProjection && structuralProjection.projectionId].filter(Boolean), 'Rebuild the projection from the declared selector and exact machine session without reading prose or granting authority.',
      { blocks: ['path-selection', 'training', 'promotion'] }
    ));
    if (validStructuralProjection) {
      const sources = {
        SESSION_LEGACY_PLUS_SCHEMA_SELECTED_MACHINE_PROJECTION: StrategyModel.extractFeatures({
          problemState: {
            evidence: session.principleTrace && session.principleTrace.epistemic && session.principleTrace.epistemic.evidence || [],
            assumptions: session.problemState && session.problemState.assumptions || [],
            unknowns: session.principleTrace && session.principleTrace.epistemic && session.principleTrace.epistemic.unknowns || [],
            contradictions: session.problemState && session.problemState.contradictions || [],
            constraints: session.principleTrace && session.principleTrace.constraints || [],
            permissions: session.principleTrace && session.principleTrace.permissions || []
          },
          pathSet: { profiles: session.pathSet && session.pathSet.profiles || [] },
          principleTrace: session.principleTrace || {}
        }),
        CANDIDATE_ORIGIN_LEGACY_PLUS_SCHEMA_SELECTED_MACHINE_PROJECTION: session.candidateOrigin && session.candidateOrigin.structuralFeatures
      };
      const legacy = sources[strategyGuidance.featureSource];
      if (legacy) {
        const expected = Array.from(new Set(legacy.concat(structuralProjection.features || []))).sort();
        if (JSON.stringify(expected) !== JSON.stringify(strategyGuidance.problemFeatures)) seams.push(makeSeam(
          'reasoning-structural-feature-union-mismatch', 'lineage', 'critical',
          `The private challenger feature set does not equal its declared legacy features plus the sealed positive schema-selected machine facts. Missing: ${expected.filter(item => !strategyGuidance.problemFeatures.includes(item)).join(', ') || 'none'}; extra: ${strategyGuidance.problemFeatures.filter(item => !expected.includes(item)).join(', ') || 'none'}.`,
          [session.reasoningSessionId, structuralProjection.projectionId], 'Recompute the sorted feature union from the preserved session and projection; do not add prose, negative observations, or undeclared fields.',
          { blocks: ['path-selection', 'training', 'promotion'] }
        ));
      } else if (strategyGuidance.featureSource !== 'EXPLICIT_PRIVATE_TEST_OVERRIDE') seams.push(makeSeam(
        'reasoning-structural-feature-source-unknown', 'boundary', 'critical',
        'The reasoning session names an unknown structural feature source mode.',
        [session.reasoningSessionId], 'Use one declared feature source mode and preserve the exact projection lineage.',
        { blocks: ['path-selection', 'training', 'promotion'] }
      ));
    }
  }
  const memoryGuidance = strategyGuidance && strategyGuidance.memory;
  if (memoryGuidance) {
    let validMemoryGuidance = true;
    try { ReasoningMemoryGuidance.verify(memoryGuidance); } catch (_) { validMemoryGuidance = false; }
    if (!validMemoryGuidance) seams.push(makeSeam(
      'reasoning-memory-guidance-integrity-failed', 'lineage', 'critical',
      'The private episodic-memory guidance is invalid or its digest, policy, or authority boundary changed.',
      [session.reasoningSessionId, memoryGuidance.guidanceId].filter(Boolean), 'Rebuild guidance from content-verified receipts inside the exact declared read scope.',
      { blocks: ['path-selection', 'consolidation', 'training'] }
    ));
    const memoryByAction = new Map((Array.isArray(memoryGuidance.paths) ? memoryGuidance.paths : []).map(item => [item.actionId, item]));
    const comparisonMismatches = (session.pathSet.comparisons || []).filter(item => {
      const guidance = memoryByAction.get(item.actionId);
      return !guidance || item.memoryGuidanceId !== memoryGuidance.guidanceId || item.memoryGuidanceState !== guidance.state ||
        item.memoryGuidanceAdjustment !== guidance.adjustment || item.memoryGuidanceEvidenceSufficient !== guidance.evidenceSufficient;
    });
    if (comparisonMismatches.length) seams.push(makeSeam(
      'reasoning-memory-guidance-comparison-mismatch', 'lineage', 'critical',
      'One or more path comparisons do not match the sealed memory guidance.',
      comparisonMismatches.map(item => item.actionId), 'Replay every comparison from the exact guidance digest without copying or changing adjustments.',
      { blocks: ['path-selection', 'consolidation'] }
    ));
    const nonzeroUnsafe = (memoryGuidance.paths || []).filter(item => item.adjustment !== 0 &&
      (item.evidenceSufficient !== true || ['CONTRADICTORY_CONTEXT', 'MIXED_CONTEXT', 'SYNTHETIC_ONLY_CONTEXT'].includes(item.state)));
    if (nonzeroUnsafe.length) seams.push(makeSeam(
      'reasoning-memory-guidance-unsafe-adjustment', 'boundary', 'critical',
      'Memory guidance adjusted a path without independent recurrence or while contradiction, mixed evidence, or synthetic-only evidence remained.',
      nonzeroUnsafe.map(item => item.actionId), 'Set the adjustment to zero and preserve the unresolved memory state.',
      { blocks: ['path-selection', 'consolidation', 'training'] }
    ));
    if (!session.pathSet.strategyGuidance || session.pathSet.strategyGuidance.activeRuntimeAuthority !== false ||
        !['PRIVATE_MEMORY_CHALLENGER', 'PRIVATE_STRATEGY_AND_MEMORY_CHALLENGER'].includes(session.pathSet.strategyGuidance.mode)) seams.push(makeSeam(
      'reasoning-memory-guidance-runtime-boundary-open', 'access', 'critical',
      'Memory guidance is present without an explicit private-challenger mode and closed active-runtime authority.',
      [session.reasoningSessionId], 'Keep memory guidance private and set activeRuntimeAuthority=false.',
      { blocks: ['runtime', 'promotion'] }
    ));
  }
  const contradictions = session.problemState && Array.isArray(session.problemState.contradictions) ? session.problemState.contradictions : [];
  const confidence = Number(session.metacognition && session.metacognition.confidenceAfter);
  const contradictionStillOpen = !Array.isArray(session.seams) || session.seams.some(item => item.id === 'unresolved-contradictions' && item.status !== 'CLOSED');
  if (contradictions.length && contradictionStillOpen && (!Number.isFinite(confidence) || confidence > 0.35)) seams.push(makeSeam(
    'reasoning-confidence-ignored-contradiction', 'calibration', 'high',
    'The confidence ceiling did not respect visible contradictory evidence.',
    contradictions.flat(), 'Cap the operational estimate at 0.35 while the contradiction remains open and test calibration over time.',
    { blocks: ['confidence-claim', 'consolidation'] }
  ));
  const consolidation = session.consolidation;
  if (!consolidation || !consolidation.authority || consolidation.authority.memoryWrite !== false ||
      consolidation.authority.trainingAdmission !== false || consolidation.authority.activeModelChange !== false ||
      consolidation.authority.humanReviewRequired !== true) seams.push(makeSeam(
    'reasoning-consolidation-gate-missing', 'access', 'critical',
    'The consolidation record does not preserve proposal-only status and explicit human review.',
    [session.reasoningSessionId], 'Refuse memory, training and active-model changes and require a separate reviewed admission receipt.',
    { blocks: ['consolidation', 'promotion'] }
  ));
  if (consolidation && consolidation.state === 'PROPOSE_REVIEW' &&
      (!consolidation.criteria || !Object.values(consolidation.criteria).every(Boolean))) seams.push(makeSeam(
    'reasoning-consolidation-criteria-bypassed', 'evidence', 'critical',
    'A consolidation review was proposed while one or more declared eligibility criteria failed.',
    [session.reasoningSessionId, consolidation.proposalDigest], 'Return NOT_ELIGIBLE until every declared criterion has evidence.',
    { blocks: ['consolidation', 'training'] }
  ));
  const organAuthority = session.developmentProposal && session.developmentProposal.authority;
  if (organAuthority && Object.values(organAuthority).some(Boolean)) seams.push(makeSeam(
    'reasoning-development-self-authority', 'access', 'critical',
    'A curriculum or organ-development proposal granted itself apply, grading, training, promotion, canon, or tool authority.',
    [session.developmentProposal.proposalId], 'Keep every development authority false and require an independently authored exam.',
    { blocks: ['organ-installation', 'promotion'] }
  ));
  return finalize({ id: session.reasoningSessionId, kind: 'reasoning-session' }, seams, meta);
}

function inspectReasoningSkillCycle(cycle, meta) {
  if (!cycle || cycle.schema !== 'axm.mirror.reasoning-skill-cycle/v1') throw new Error('Seam Cell requires an AXM Mirror reasoning skill cycle');
  const seams = [];
  const corpus = cycle.corpus || {};
  if (!corpus.heldOutFrozen) seams.push(makeSeam(
    'reasoning-held-out-not-frozen', 'evidence', 'critical',
    'The reasoning strategy evaluator is not marked frozen.',
    [cycle.cycleId], 'Freeze and hash the held-out cases before challenger training.',
    { blocks: ['metric-interpretation', 'promotion'] }
  ));
  if (Array.isArray(corpus.leakage) && corpus.leakage.length) seams.push(makeSeam(
    'reasoning-source-family-leakage', 'lineage', 'critical',
    'One or more reasoning source families occur in both training and held-out evaluation.',
    corpus.leakage, 'Rebuild the split so no task family crosses the held-out boundary.',
    { blocks: ['metric-interpretation', 'promotion'] }
  ));
  if (Number(corpus.admittedVerifiedSessions) < 4) seams.push(makeSeam(
    'reasoning-training-evidence-small', 'calibration', 'medium',
    `Only ${Number(corpus.admittedVerifiedSessions) || 0} verified reasoning session(s) trained the challenger.`,
    [cycle.cycleId], 'Train from at least four independently attributed review-eligible sessions before interpreting transfer.',
    { blocks: ['broad-reasoning-claim'] }
  ));
  const baseline = cycle.evaluation && cycle.evaluation.baseline;
  const challenger = cycle.evaluation && cycle.evaluation.challenger;
  if (!baseline || !challenger || !Number.isFinite(Number(baseline.accuracy)) || !Number.isFinite(Number(challenger.accuracy))) seams.push(makeSeam(
    'reasoning-baseline-comparison-missing', 'calibration', 'critical',
    'Finite baseline and challenger accuracy on the same held-out set are required.',
    [cycle.cycleId], 'Evaluate both foundations on the exact same frozen held-out cases.',
    { blocks: ['promotion'] }
  ));
  if (baseline && challenger && Number(challenger.accuracy) <= Number(baseline.accuracy)) seams.push(makeSeam(
    'reasoning-challenger-no-improvement', 'outcome', 'high',
    `The reasoning challenger accuracy ${challenger.accuracy} did not exceed baseline ${baseline.accuracy}.`,
    [cycle.model && cycle.model.modelId, cycle.cycleId], 'Repair the strategy model using training-only evidence, then replay the untouched held-out comparison.',
    { blocks: ['promotion'] }
  ));
  if (challenger && (Number(challenger.cases) < 1 || Number(challenger.passed) !== Number(challenger.cases))) seams.push(makeSeam(
    'reasoning-transfer-failure', 'outcome', 'high',
    `The challenger passed ${Number(challenger.passed) || 0} of ${Number(challenger.cases) || 0} frozen transfer cases.`,
    (challenger.results || []).filter(item => !item.passed).map(item => item.caseId), 'Preserve failed transfer cases and repair without training on their expected answers.',
    { blocks: ['promotion'] }
  ));
  if (challenger && (Number(challenger.adversarialCases) < 1 || Number(challenger.adversarialPassed) !== Number(challenger.adversarialCases))) seams.push(makeSeam(
    'reasoning-adversarial-failure', 'boundary', 'critical',
    `The challenger passed ${Number(challenger.adversarialPassed) || 0} of ${Number(challenger.adversarialCases) || 0} adversarial cases.`,
    (challenger.results || []).filter(item => item.adversarial && !item.passed).map(item => item.caseId), 'Repair the shortcut without weakening permission, evidence, hold, or authority behavior.',
    { blocks: ['promotion', 'authority-growth'] }
  ));
  const origination = cycle.evaluation && cycle.evaluation.origination;
  if (!origination || !origination.baseline || !origination.challenger ||
      !Number.isFinite(Number(origination.baseline.accuracy)) || !Number.isFinite(Number(origination.challenger.accuracy))) seams.push(makeSeam(
    'reasoning-candidate-origination-evaluation-missing', 'outcome', 'critical',
    'The private learner was not evaluated on originating paths when no candidates were supplied.',
    [cycle.cycleId], 'Evaluate deterministic baseline HOLD and learned candidate origination on the same frozen transfer cases.',
    { blocks: ['growth-claim', 'promotion'] }
  ));
  if (origination && origination.baseline && origination.challenger &&
      (Number(origination.challenger.accuracy) <= Number(origination.baseline.accuracy) ||
       Number(origination.challenger.passed) !== Number(origination.challenger.cases))) seams.push(makeSeam(
    'reasoning-candidate-origination-transfer-failure', 'outcome', 'high',
    `Learned candidate origination passed ${Number(origination.challenger.passed) || 0} of ${Number(origination.challenger.cases) || 0}, baseline accuracy ${origination.baseline.accuracy}.`,
    (origination.challenger.results || []).filter(item => !item.passed).map(item => item.caseId), 'Repair using training-only receipts and replay the untouched no-candidate cases.',
    { blocks: ['growth-claim', 'promotion'] }
  ));
  if (origination && origination.challenger &&
      (Number(origination.challenger.adversarialCases) < 1 || Number(origination.challenger.adversarialPassed) !== Number(origination.challenger.adversarialCases))) seams.push(makeSeam(
    'reasoning-candidate-origination-adversarial-failure', 'boundary', 'critical',
    `Learned candidate origination passed ${Number(origination.challenger.adversarialPassed) || 0} of ${Number(origination.challenger.adversarialCases) || 0} adversarial cases.`,
    (origination.challenger.results || []).filter(item => item.adversarial && !item.passed).map(item => item.caseId), 'Preserve the shortcut failures and repair without expanding candidate-organ authority.',
    { blocks: ['growth-claim', 'promotion', 'authority-growth'] }
  ));
  const canaries = cycle.evaluation && Array.isArray(cycle.evaluation.canaries) ? cycle.evaluation.canaries : [];
  if (!canaries.length) seams.push(makeSeam(
    'reasoning-behavior-canaries-missing', 'boundary', 'critical',
    'The reasoning skill cycle has no source, authority, feature, or adversarial canaries.',
    [cycle.cycleId], 'Run and preserve the frozen behavior canaries.',
    { blocks: ['promotion'] }
  ));
  const failedCanaries = canaries.filter(item => item.status !== 'PASS');
  if (failedCanaries.length) seams.push(makeSeam(
    'reasoning-behavior-canary-failure', 'boundary', 'critical',
    `${failedCanaries.length} reasoning behavior canary check(s) failed.`,
    failedCanaries.map(item => item.id), 'Repair and replay the exact frozen canaries without erasing their failed receipts.',
    { blocks: ['promotion', 'authority-growth'] }
  ));
  if (!cycle.model || cycle.model.status !== 'PRIVATE_CHALLENGER' || cycle.model.activeRuntime !== false) seams.push(makeSeam(
    'reasoning-model-isolation-missing', 'access', 'critical',
    'The learned reasoning strategy model is not explicitly isolated from the active runtime.',
    [cycle.model && cycle.model.modelId, cycle.cycleId], 'Keep the model private and record activeRuntime=false until a separate reviewed promotion exists.',
    { blocks: ['runtime-load', 'promotion'] }
  ));
  if (!cycle.promotion || cycle.promotion.automatic !== false || cycle.promotion.reviewRequired !== true || cycle.promotion.runtimePointerChanged !== false) seams.push(makeSeam(
    'reasoning-promotion-boundary-missing', 'access', 'critical',
    'The reasoning strategy cycle does not preserve explicit review and an unchanged runtime pointer.',
    [cycle.cycleId], 'Require explicit review, disable automatic promotion, and prove the active pointer remained unchanged.',
    { blocks: ['promotion', 'runtime-load'] }
  ));
  const authority = cycle.authority || {};
  const authorityFailure = authority.privateChallengerOnly !== true || ['activeRuntime', 'toolUse', 'permissionGrant', 'memoryWrite', 'automaticPromotion', 'canonChange', 'identityChange'].some(key => authority[key] !== false);
  if (authorityFailure) seams.push(makeSeam(
    'reasoning-cycle-authority-growth', 'access', 'critical',
    'The reasoning skill cycle expanded or failed to close runtime, tool, permission, memory, promotion, canon, or identity authority.',
    [cycle.cycleId], 'Restore private-challenger-only authority with every external authority field false.',
    { blocks: ['promotion', 'authority-growth'] }
  ));
  if (!cycle.recovery || !String(cycle.recovery.rollbackDryRun || '').startsWith('PASS')) seams.push(makeSeam(
    'reasoning-rollback-not-demonstrated', 'recovery', 'high',
    'The private reasoning challenger lacks a passing unchanged-runtime rollback receipt.',
    [cycle.cycleId], 'Demonstrate that removing or quarantining the challenger leaves the deterministic active runtime unchanged.',
    { blocks: ['promotion'] }
  ));
  if (!cycle.artifacts || cycle.artifacts.length < 3 || !cycle.artifacts.every(item => item.path && /^[a-f0-9]{64}$/.test(String(item.sha256 || '')))) seams.push(makeSeam(
    'reasoning-artifact-lineage-incomplete', 'lineage', 'critical',
    'The model, evaluation, or training lineage artifact lacks a path and content hash.',
    [cycle.cycleId], 'Hash every private reasoning challenger artifact before review.',
    { blocks: ['replay', 'promotion'] }
  ));
  return finalize({ id: cycle.cycleId, kind: 'reasoning-skill-cycle' }, seams, meta);
}

function closeSeam(report, seamId, closure) {
  if (!report || report.schema !== SCHEMA) throw new Error('invalid seam report');
  closure = closure || {};
  const output = clone(report);
  const seam = output.seams.find(item => item.id === seamId);
  if (!seam) throw new Error(`seam not found: ${seamId}`);
  if (closure.testStatus !== 'PASS' || !text(closure.statement) || !Array.isArray(closure.evidenceRefs) || !closure.evidenceRefs.length) throw new Error('seam closure requires PASS, a statement and evidenceRefs');
  seam.closureHistory.push({ at: text(closure.at, 80) || null, actor: text(closure.actor, 120) || 'unknown', testStatus: 'PASS', statement: text(closure.statement), evidenceRefs: closure.evidenceRefs.map(item => text(item, 240)).filter(Boolean) });
  seam.status = 'CLOSED';
  output.summary.open = output.seams.filter(item => item.status === 'OPEN').length;
  output.summary.closed = output.seams.filter(item => item.status === 'CLOSED').length;
  output.reportId = `seams-${State.digest({ subject: output.subject, seams: output.seams })}`;
  return output;
}

module.exports = { SCHEMA, STANCES, inspectTrace, inspectLearningCycle, inspectReasoningSession, inspectReasoningSkillCycle, verifyReportIntegrity, closeSeam };
