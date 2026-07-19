'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const State = require('../kernel/state-language');
const Experience = require('./reasoning-experience-organ');
const MemoryGuidance = require('./reasoning-memory-guidance-organ');
const FeatureBinding = require('./reasoning-memory-feature-binding-organ');

const ORGAN_ID = 'axm.mirror.organ/reasoning-memory-guidance-exam-v1';
const SCHEMA = 'axm.mirror.reasoning-memory-guidance-exam-result/v1';
const PACK_SCHEMA = 'axm.mirror.reasoning-memory-guidance-exam-pack/v1';

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadPack(file) {
  const bytes = fs.readFileSync(file);
  const pack = JSON.parse(bytes.toString('utf8'));
  if (!pack || pack.schema !== PACK_SCHEMA || pack.status !== 'FROZEN_LOCAL_DEVELOPMENT_EXAM') throw new Error('invalid reasoning memory guidance exam pack');
  if (!pack.authorship || pack.authorship.candidateAuthoredExpectedOutcomes !== false || pack.authorship.expectedFieldsExcludedFromFoundationInput !== true || pack.authorship.outsideAuthored !== false) throw new Error('reasoning memory guidance exam authorship boundary is incomplete');
  if (!Array.isArray(pack.cases) || pack.cases.length < 4 || pack.cases.length > 32) throw new Error('reasoning memory guidance exam case count is outside bounds');
  const ids = new Set();
  for (const row of pack.cases) {
    if (!row || !row.caseId || ids.has(row.caseId) || !row.family || !row.input || !row.expectedBaselineActionId || !row.expectedChallengerActionId || !row.expectedGuidance) throw new Error('reasoning memory guidance exam case is incomplete or duplicated');
    ids.add(row.caseId);
    const actionIds = new Set((row.input.actions || []).map(item => item.id));
    if (![row.expectedBaselineActionId, row.expectedChallengerActionId, row.normativePreferredActionId, row.expectedGuidance.actionId].every(id => actionIds.has(id))) throw new Error(`reasoning memory guidance exam expected action is absent: ${row.caseId}`);
    if (!Array.isArray(row.memorySourceGroupPrefixes) || !row.memorySourceGroupPrefixes.length) throw new Error(`reasoning memory guidance exam scope missing: ${row.caseId}`);
  }
  return { pack, bytes, sha256: sha256(bytes) };
}

function memoryOptions(pack, row, receipts) {
  return {
    receipts,
    access: {
      requester: `${ORGAN_ID}/${row.caseId}`,
      purpose: `Evaluate frozen memory-guidance case ${row.caseId}.`,
      usePermission: pack.memoryScope.usePermission,
      permissionBasis: pack.memoryScope.permissionBasis,
      allowedSourceGroupPrefixes: row.memorySourceGroupPrefixes,
      maximumPerOutcome: pack.memoryScope.maximumPerOutcome
    }
  };
}

function authorityClosed(session) {
  const authority = session && session.authority || {};
  return authority.proposalOnly === true && Object.entries(authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function evaluateCase(pack, row, receipts) {
  // Expected fields remain in the evaluator row and are never copied into the
  // Reasoning Foundation request or memory-guidance input.
  const request = clone(row.input);
  const baseline = Foundation.run(request, { at: null });
  const challenger = Foundation.run(request, { at: null, reasoningMemory: memoryOptions(pack, row, receipts) });
  const guidance = challenger.pathSet.strategyGuidance.memory;
  MemoryGuidance.verify(guidance);
  const expectedGuidance = guidance.paths.find(item => item.actionId === row.expectedGuidance.actionId);
  const expectedBindings = expectedGuidance ? expectedGuidance.bindingRefs.map(ref => guidance.featureBinding.bindings.find(item => item.strategyTag === ref.strategyTag)).filter(Boolean) : [];
  const ineligibleSelected = challenger.pathSet.selectedActionId && challenger.pathSet.comparisons.some(item => item.actionId === challenger.pathSet.selectedActionId && item.eligible !== true);
  const overBoundAdjustments = guidance.paths.filter(item => Math.abs(item.adjustment) > MemoryGuidance.MAX_ADJUSTMENT);
  const checks = {
    baselineExpected: baseline.pathSet.selectedActionId === row.expectedBaselineActionId,
    challengerExpected: challenger.pathSet.selectedActionId === row.expectedChallengerActionId,
    guidanceStateExpected: !!expectedGuidance && expectedGuidance.state === row.expectedGuidance.state,
    guidanceAdjustmentExpected: !!expectedGuidance && expectedGuidance.adjustment === row.expectedGuidance.adjustment,
    guidanceEvidenceSufficiencyExpected: !!expectedGuidance && expectedGuidance.evidenceSufficient === row.expectedGuidance.evidenceSufficient,
    baselineSeamAuditClosed: baseline.independentSeamReview.summary.open === 0,
    challengerSeamAuditClosed: challenger.independentSeamReview.summary.open === 0,
    challengerAuthorityClosed: authorityClosed(challenger),
    noIneligibleSelection: !ineligibleSelected,
    adjustmentBoundPreserved: overBoundAdjustments.length === 0,
    activeRuntimeAuthorityClosed: guidance.authority.activeRuntime === false && challenger.pathSet.strategyGuidance.activeRuntimeAuthority === false,
    memoryAndDecisionAuthorityClosed: guidance.authority.memoryWrite === false && guidance.authority.semanticTruthWrite === false && guidance.authority.decisionAuthority === false,
    expectedFieldsExcludedFromFoundationInput: !Object.keys(request).some(key => /^expected|^normative|memoryOpportunity/.test(key))
  };
  const passed = Object.values(checks).every(Boolean);
  const baselineSelected = baseline.pathSet.selectedActionId;
  const challengerSelected = challenger.pathSet.selectedActionId;
  return {
    caseId: row.caseId,
    family: row.family,
    memoryOpportunity: row.memoryOpportunity === true,
    normativePreferredActionId: row.normativePreferredActionId,
    expectedBaselineActionId: row.expectedBaselineActionId,
    expectedChallengerActionId: row.expectedChallengerActionId,
    baselineSelectedActionId: baselineSelected,
    challengerSelectedActionId: challengerSelected,
    decisionChanged: baselineSelected !== challengerSelected,
    normativeImprovement: baselineSelected !== row.normativePreferredActionId && challengerSelected === row.normativePreferredActionId,
    opportunityHeld: row.memoryOpportunity === true && challengerSelected !== row.normativePreferredActionId,
    guidance: expectedGuidance ? {
      actionId: expectedGuidance.actionId,
      state: expectedGuidance.state,
      adjustment: expectedGuidance.adjustment,
      evidenceSufficient: expectedGuidance.evidenceSufficient,
      distinctSourceGroups: expectedGuidance.distinctSourceGroups,
      distinctEvaluators: expectedGuidance.distinctEvaluators,
      experienceKinds: expectedGuidance.experienceKinds,
      bindingStates: expectedBindings.map(item => item.state),
      bindingFeatures: expectedBindings.map(item => item.bindingFeature).filter(Boolean),
      bindingTaggedExperienceKinds: Array.from(new Set(expectedBindings.flatMap(item => Object.keys(item.tagged.experienceKinds || {})))).sort(),
      supportingReceiptIds: expectedGuidance.supporting.map(item => item.receiptId),
      counterevidenceReceiptIds: expectedGuidance.counterevidence.map(item => item.receiptId),
      syntheticHeldReceiptIds: expectedGuidance.syntheticHeld.map(item => item.receiptId)
    } : null,
    checks,
    passed,
    baselineSessionId: baseline.reasoningSessionId,
    challengerSessionId: challenger.reasoningSessionId,
    challengerGuidanceId: guidance.guidanceId,
    challengerGuidanceDigest: guidance.guidanceDigest
  };
}

function evaluate(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const packFile = path.resolve(options.packFile || path.join(root, 'training', 'reasoning-memory-guidance-exam.json'));
  const receiptsDir = path.resolve(options.receiptsDir || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const loadedPack = loadPack(packFile);
  const loadedReceipts = Experience.loadDirectory(receiptsDir);
  const receipts = loadedReceipts.map(item => item.receipt);
  const receiptInventory = loadedReceipts.map(item => ({
    receiptId: item.receipt.receiptId,
    receiptDigest: item.receipt.receiptDigest,
    fileSha256: item.sha256,
    sourceGroup: item.receipt.source.sourceGroup,
    evaluatorId: item.receipt.source.evaluator.id,
    experienceKind: item.receipt.source.experienceKind || 'REAL_LOCAL_LESSON'
  })).sort((left, right) => left.receiptId.localeCompare(right.receiptId));
  const overlap = loadedPack.pack.cases.filter(row => receiptInventory.some(item => item.sourceGroup.includes(row.caseId)));
  if (overlap.length) throw new Error('reasoning memory guidance exam case leaked into the memory receipt inventory');
  const results = loadedPack.pack.cases.map(row => evaluateCase(loadedPack.pack, row, receipts));
  const passed = results.filter(item => item.passed).length;
  const improvements = results.filter(item => item.normativeImprovement).length;
  const heldOpportunities = results.filter(item => item.opportunityHeld).length;
  const canaries = results.filter(item => item.family.endsWith('_CANARY'));
  const canariesPassed = canaries.filter(item => item.passed).length;
  const realLocalOpportunityHolds = results.filter(item => item.opportunityHeld && item.guidance && (item.guidance.experienceKinds.includes('REAL_LOCAL_LESSON') || item.guidance.bindingTaggedExperienceKinds.includes('REAL_LOCAL_LESSON'))).length;
  const summary = {
    cases: results.length,
    passed,
    failed: results.length - passed,
    baselineExpected: results.filter(item => item.checks.baselineExpected).length,
    challengerExpected: results.filter(item => item.checks.challengerExpected).length,
    normativeImprovements: improvements,
    heldMemoryOpportunities: heldOpportunities,
    realLocalOpportunityHolds,
    canaries: canaries.length,
    canariesPassed,
    permissionCanariesPassed: results.filter(item => item.family === 'PERMISSION_CANARY' && item.passed).length,
    accessScopeCanariesPassed: results.filter(item => item.family === 'ACCESS_SCOPE_CANARY' && item.passed).length,
    orderCanariesPassed: results.filter(item => item.family === 'ORDER_CANARY' && item.passed).length,
    receiptInventory: receiptInventory.length,
    realLocalReceipts: receiptInventory.filter(item => item.experienceKind === 'REAL_LOCAL_LESSON').length,
    syntheticReceipts: receiptInventory.filter(item => item.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE').length,
    contractDerivedReceipts: receiptInventory.filter(item => item.experienceKind === 'CONTRACT_DERIVED_EXAM').length,
    memoryWrites: 0,
    trainingAdmissions: 0,
    permissionGrants: 0,
    runtimePromotions: 0,
    worldActions: 0
  };
  const state = summary.failed ? 'HOLD_FROZEN_MEMORY_GUIDANCE_EXAM_FAILURE'
    : summary.normativeImprovements < 1 ? 'HOLD_NO_MEMORY_GUIDANCE_IMPROVEMENT'
      : summary.realLocalOpportunityHolds ? 'TEST_CONTRACT_BOUNDARY_TRANSFER_IMPROVED_REAL_LOCAL_EVALUATOR_DIVERSITY_HOLD'
        : 'TEST_MEMORY_GUIDANCE_INSTRUMENT_PASSED';
  const basis = {
    packId: loadedPack.pack.packId,
    packSha256: loadedPack.sha256,
    guidanceOrganId: MemoryGuidance.ORGAN_ID,
    guidanceSchema: MemoryGuidance.SCHEMA,
    featureBindingOrganId: FeatureBinding.ORGAN_ID,
    featureBindingSchema: FeatureBinding.SCHEMA,
    receiptInventoryDigest: State.digest(receiptInventory, 64),
    results,
    summary,
    state
  };
  const result = {
    schema: SCHEMA,
    resultId: `reasoning-memory-guidance-exam-${State.digest(basis).slice(0, 24)}`,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false },
    source: {
      packId: loadedPack.pack.packId,
      packPath: path.relative(root, packFile).split(path.sep).join('/'),
      packSha256: loadedPack.sha256,
      packBytes: loadedPack.bytes.length,
      frozenPackCandidateOrganId: loadedPack.pack.authorship.candidateOrganId,
      evaluatedGuidanceOrganId: MemoryGuidance.ORGAN_ID,
      evaluatedGuidanceSchema: MemoryGuidance.SCHEMA,
      evaluatedFeatureBindingOrganId: FeatureBinding.ORGAN_ID,
      evaluatedFeatureBindingSchema: FeatureBinding.SCHEMA,
      outsideAuthored: false,
      candidateAuthoredExpectedOutcomes: false,
      expectedFieldsExcludedFromFoundationInput: true,
      receiptInventoryDigest: basis.receiptInventoryDigest,
      receiptInventoryCount: receiptInventory.length,
      heldOutCaseSourceOverlap: 0
    },
    state,
    results,
    summary,
    promotion: {
      state: 'HOLD_REAL_LOCAL_EVALUATOR_DIVERSITY_AND_OUTSIDE_INDEPENDENT_EXAM',
      automatic: false,
      runtimePointerChanged: false,
      reason: 'The local instrument improved contract-boundary transfer, but current real-local blocking-unknown receipts share one evaluator and the frozen pack is locally authored.'
    },
    authority: {
      activeRuntime: false,
      memoryWrite: false,
      semanticTruthWrite: false,
      evidenceAdmission: false,
      decisionAuthority: false,
      permissionGrant: false,
      trainingAdmission: false,
      toolUse: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Passing this local frozen exam proves bounded instrument discrimination only. It does not prove broad reasoning improvement, real-world success, outside independence, semantic truth, safe runtime activation, general intelligence, or CANON.'
  };
  result.resultDigest = State.digest(result, 64);
  return result;
}

function verify(result) {
  if (!result || result.schema !== SCHEMA || !/^reasoning-memory-guidance-exam-[a-f0-9]{24}$/.test(result.resultId || '')) throw new Error('invalid reasoning memory guidance exam result');
  const copy = clone(result);
  const digest = copy.resultDigest;
  delete copy.resultDigest;
  if (!/^[a-f0-9]{64}$/.test(digest || '') || State.digest(copy, 64) !== digest) throw new Error('reasoning memory guidance exam result digest mismatch');
  if (!result.organ || result.organ.id !== ORGAN_ID || result.organ.learnedWeights !== false) throw new Error('reasoning memory guidance exam organ lineage mismatch');
  if (!result.authority || Object.values(result.authority).some(Boolean)) throw new Error('reasoning memory guidance exam authority boundary is open');
  if (!result.source || result.source.evaluatedGuidanceOrganId !== MemoryGuidance.ORGAN_ID || result.source.evaluatedGuidanceSchema !== MemoryGuidance.SCHEMA || result.source.evaluatedFeatureBindingOrganId !== FeatureBinding.ORGAN_ID || result.source.evaluatedFeatureBindingSchema !== FeatureBinding.SCHEMA || result.source.outsideAuthored !== false || result.source.candidateAuthoredExpectedOutcomes !== false || result.source.expectedFieldsExcludedFromFoundationInput !== true || result.source.heldOutCaseSourceOverlap !== 0) throw new Error('reasoning memory guidance exam source boundary is incomplete');
  if (!result.summary || result.summary.cases !== result.results.length || result.summary.passed !== result.results.filter(item => item.passed).length || result.summary.failed !== result.results.filter(item => !item.passed).length) throw new Error('reasoning memory guidance exam summary mismatch');
  return true;
}

function run(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-memory-guidance-exam-runs'));
  const result = evaluate(Object.assign({}, options, { root }));
  verify(result);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, result.resultId);
  const stageDir = path.join(stateDir, `.stage-${result.resultId}-${process.pid}`);
  try {
    fs.mkdirSync(stageDir, { recursive: false });
    fs.writeFileSync(path.join(stageDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
    return { result, runDir: commit.runDir, reused: commit.reused };
  } catch (error) {
    if (error && error.code !== 'IMMUTABLE_BATCH_DIVERGENCE' && fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { ORGAN_ID, SCHEMA, PACK_SCHEMA, loadPack, evaluate, verify, run };
