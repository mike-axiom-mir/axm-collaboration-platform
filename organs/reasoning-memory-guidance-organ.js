'use strict';

const MemoryContext = require('./reasoning-memory-context-organ');
const FeatureBinding = require('./reasoning-memory-feature-binding-organ');
const State = require('../kernel/state-language');

const ORGAN_ID = 'axm.mirror.organ/reasoning-memory-guidance-v2';
const SCHEMA = 'axm.mirror.reasoning-memory-guidance/v2';
const MAX_ADJUSTMENT = 12;
const MIN_SOURCE_GROUPS = 2;
const MIN_EVALUATORS = 2;
const MAX_PATHS = 128;
const MAX_TAGS = 32;

function clean(value, maximum = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum);
}

function token(value) {
  return clean(value, 160).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-');
}

function unique(value, maximum = 128) {
  return Array.from(new Set((Array.isArray(value) ? value.slice(0, maximum) : []).map(token).filter(Boolean)));
}

function normalizeProfiles(value) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > MAX_PATHS) throw new Error(`reasoning memory guidance accepts at most ${MAX_PATHS} paths`);
  const seen = new Set();
  return rows.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`reasoning memory path ${index} must be an object`);
    const actionId = token(item.actionId || item.action_id);
    if (!actionId || seen.has(actionId)) throw new Error(`reasoning memory path ${index} has a missing or duplicate action ID`);
    seen.add(actionId);
    return { actionId, strategyTags: unique(item.strategyTags || item.strategy_tags, MAX_TAGS) };
  });
}

function uniqueSummaries(rows) {
  const byId = new Map();
  for (const row of rows) if (!byId.has(row.receiptId)) byId.set(row.receiptId, row);
  return Array.from(byId.values()).sort((left, right) => left.receiptId.localeCompare(right.receiptId));
}

function summarizeReceipt(row) {
  return {
    receiptId: row.receiptId,
    receiptDigest: row.receiptDigest,
    sourceGroup: row.sourceGroup,
    experienceKind: row.experienceKind,
    evaluatorId: row.evaluator.id,
    contextSignature: row.contextSignature,
    outcome: row.outcome
  };
}

function guidanceForPath(profile, contextsByTag, featureBinding) {
  const entries = profile.strategyTags.map(tag => contextsByTag.get(tag)).filter(Boolean);
  const allExactlyBoundAndPresent = entries.length === profile.strategyTags.length && entries.every(item => item.context && item.binding.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE' && item.currentFeatureMatched === true);
  const contexts = allExactlyBoundAndPresent ? entries : [];
  const bindingRefs = entries.map(item => ({
    strategyTag: item.tag,
    bindingBatchId: featureBinding.batchId,
    bindingBatchDigest: featureBinding.batchDigest,
    bindingState: item.binding.state,
    bindingFeature: item.binding.bindingFeature,
    currentFeatureMatched: item.currentFeatureMatched,
    contextId: item.context && item.context.contextId || null,
    contextDigest: item.context && item.context.contextDigest || null
  }));
  const rawSupporting = uniqueSummaries(contexts.flatMap(item => item.context.supporting));
  const rawCounterevidence = uniqueSummaries(contexts.flatMap(item => item.context.counterevidence));
  const syntheticHeld = uniqueSummaries(rawSupporting.concat(rawCounterevidence).filter(item => item.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE'));
  const supporting = rawSupporting.filter(item => item.experienceKind !== 'SYNTHETIC_COUNTEREXAMPLE');
  const counterevidence = rawCounterevidence.filter(item => item.experienceKind !== 'SYNTHETIC_COUNTEREXAMPLE');
  const contradictionSignatures = Array.from(new Set(contexts.flatMap(item => item.context.contradictions.map(row => row.contextSignature)))).sort();
  const evidence = supporting.concat(counterevidence);
  const sourceGroups = Array.from(new Set(evidence.map(item => item.sourceGroup))).sort();
  const evaluators = Array.from(new Set(evidence.map(item => item.evaluator.id))).sort();
  const experienceKinds = Array.from(new Set(evidence.map(item => item.experienceKind))).sort();
  const sufficient = sourceGroups.length >= MIN_SOURCE_GROUPS && evaluators.length >= MIN_EVALUATORS;
  let state = 'NO_CONTEXT';
  let adjustment = 0;
  if (!allExactlyBoundAndPresent && entries.some(item => item.binding.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE' && item.currentFeatureMatched === false)) state = 'CONTEXT_FEATURE_MISMATCH';
  else if (!allExactlyBoundAndPresent && entries.some(item => item.binding.state === 'HOLD_SYNTHETIC_ONLY_TAG_EVIDENCE')) state = 'SYNTHETIC_ONLY_CONTEXT';
  else if (!allExactlyBoundAndPresent && entries.some(item => item.binding.state.includes('INSUFFICIENT'))) state = 'INSUFFICIENT_INDEPENDENCE';
  else if (!allExactlyBoundAndPresent && entries.some(item => item.binding.state === 'HOLD_NO_TAGGED_RECEIPTS')) state = 'NO_CONTEXT';
  else if (!allExactlyBoundAndPresent && entries.length) state = 'UNBOUND_STRATEGY_CONTEXT';
  else if (contradictionSignatures.length) state = 'CONTRADICTORY_CONTEXT';
  else if (supporting.length && counterevidence.length) state = 'MIXED_CONTEXT';
  else if (!supporting.length && !counterevidence.length && syntheticHeld.length) state = 'SYNTHETIC_ONLY_CONTEXT';
  else if ((supporting.length || counterevidence.length) && !sufficient) state = 'INSUFFICIENT_INDEPENDENCE';
  else if (supporting.length) { state = 'SUPPORTING_CONTEXT'; adjustment = MAX_ADJUSTMENT; }
  else if (counterevidence.length) { state = 'COUNTEREVIDENCE_CONTEXT'; adjustment = -MAX_ADJUSTMENT; }
  return {
    actionId: profile.actionId,
    strategyTags: profile.strategyTags,
    bindingRefs,
    exactFeatureBindingsUsed: allExactlyBoundAndPresent ? entries.map(item => item.binding.bindingFeature).sort() : [],
    tagOnlyRetrievals: 0,
    state,
    adjustment,
    supporting: supporting.map(summarizeReceipt),
    counterevidence: counterevidence.map(summarizeReceipt),
    syntheticHeld: syntheticHeld.map(summarizeReceipt),
    contradictionSignatures,
    distinctSourceGroups: sourceGroups,
    distinctEvaluators: evaluators,
    experienceKinds,
    evidenceSufficient: sufficient,
    boundary: 'The bounded adjustment can order only paths that already passed deterministic evidence and permission gates.'
  };
}

function create(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('reasoning memory guidance input must be an object');
  const problemFeatures = unique(input.problemFeatures, 256).sort();
  const presentFeatures = new Set(problemFeatures);
  const profiles = normalizeProfiles(input.pathProfiles);
  const tags = Array.from(new Set(profiles.flatMap(item => item.strategyTags))).sort();
  if (tags.length > MAX_TAGS) throw new Error(`reasoning memory guidance accepts at most ${MAX_TAGS} distinct strategy tags`);
  const featureBinding = FeatureBinding.build({ strategyTags: tags, access: input.access, receipts: input.receipts });
  FeatureBinding.verify(featureBinding);
  const bindingsByTag = new Map(featureBinding.bindings.map(item => [item.strategyTag, item]));
  const contextsByTag = new Map();
  for (const tag of tags) {
    const binding = bindingsByTag.get(tag);
    const currentFeatureMatched = !!(binding && binding.bindingFeature && presentFeatures.has(binding.bindingFeature));
    const context = binding && binding.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE' && currentFeatureMatched
      ? MemoryContext.retrieve({
          query: {
            queryId: `memory-guidance-${tag}`,
            requiredFeatures: [binding.bindingFeature],
            requiredStrategyTags: [tag],
            requiredSeamIds: []
          },
          access: input.access,
          receipts: input.receipts
        })
      : null;
    contextsByTag.set(tag, { tag, binding, currentFeatureMatched, context });
  }
  const paths = profiles.map(profile => guidanceForPath(profile, contextsByTag, featureBinding));
  const basis = {
    problemFeatures,
    pathProfiles: profiles,
    contextRefs: tags.map(tag => {
      const entry = contextsByTag.get(tag);
      const context = entry.context;
      return {
        strategyTag: tag,
        bindingBatchId: featureBinding.batchId,
        bindingBatchDigest: featureBinding.batchDigest,
        bindingState: entry.binding.state,
        bindingFeature: entry.binding.bindingFeature,
        currentFeatureMatched: entry.currentFeatureMatched,
        contextId: context && context.contextId || null,
        contextDigest: context && context.contextDigest || null,
        state: context && context.state || null,
        exactMatches: context && context.inventory.exactMatches || 0,
        supporting: context && context.inventory.supporting || 0,
        counterevidence: context && context.inventory.counterevidence || 0,
        unknowns: context ? context.unknowns : ['NO_EXACT_CONTRAST_TESTED_FEATURE_BINDING_FOR_CURRENT_CONTEXT']
      };
    }),
    featureBindingDigest: featureBinding.batchDigest,
    paths
  };
  const output = {
    schema: SCHEMA,
    guidanceId: `reasoning-memory-guidance-${State.digest(basis).slice(0, 24)}`,
    organ: { id: ORGAN_ID, status: 'TEST_PRIVATE_CONTRAST_BOUND_CHALLENGER', learnedWeights: false },
    problemFeatures,
    featureBinding,
    contextRefs: basis.contextRefs,
    paths,
    policy: {
      maximumAdjustment: MAX_ADJUSTMENT,
      minimumDistinctSourceGroups: MIN_SOURCE_GROUPS,
      minimumDistinctEvaluators: MIN_EVALUATORS,
      syntheticEvidenceCanAdjust: false,
      contradictoryOrMixedEvidenceCanAdjust: false,
      exactContrastTestedFeatureBindingRequired: true,
      tagOnlyRetrievalAllowed: false,
      ambiguousOrSyntheticFeatureBindingCanAdjust: false,
      eligibilityGateMutation: false
    },
    authority: {
      activeRuntime: false,
      memoryWrite: false,
      semanticTruthWrite: false,
      evidenceAdmission: false,
      decisionAuthority: false,
      eligibilityMutation: false,
      permissionGrant: false,
      trainingAdmission: false,
      toolUse: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This private challenger may retrieve memory only through one independently recurrent, contrast-exclusive positive structural feature learned for each strategy tag. Tag-only, ambiguous, synthetic-only, under-diverse, and current-feature-mismatched retrieval stays neutral. A bounded adjustment is not truth, confidence, eligibility, permission, or a decision. The Reasoning Foundation and Seam Cell retain final deterministic gates.'
  };
  output.guidanceDigest = State.digest(output, 64);
  return output;
}

function verify(value) {
  if (!value || value.schema !== SCHEMA || !/^reasoning-memory-guidance-[a-f0-9]{24}$/.test(value.guidanceId || '')) throw new Error('invalid reasoning memory guidance');
  const copy = JSON.parse(JSON.stringify(value));
  const suppliedDigest = copy.guidanceDigest;
  delete copy.guidanceDigest;
  if (!/^[a-f0-9]{64}$/.test(suppliedDigest || '') || State.digest(copy, 64) !== suppliedDigest) throw new Error('reasoning memory guidance digest mismatch');
  if (!value.organ || value.organ.id !== ORGAN_ID || value.organ.learnedWeights !== false) throw new Error('reasoning memory guidance organ lineage mismatch');
  FeatureBinding.verify(value.featureBinding);
  if (!value.policy || value.policy.maximumAdjustment !== MAX_ADJUSTMENT || value.policy.minimumDistinctSourceGroups !== MIN_SOURCE_GROUPS || value.policy.minimumDistinctEvaluators !== MIN_EVALUATORS || value.policy.syntheticEvidenceCanAdjust !== false || value.policy.contradictoryOrMixedEvidenceCanAdjust !== false || value.policy.exactContrastTestedFeatureBindingRequired !== true || value.policy.tagOnlyRetrievalAllowed !== false || value.policy.ambiguousOrSyntheticFeatureBindingCanAdjust !== false || value.policy.eligibilityGateMutation !== false) throw new Error('reasoning memory guidance policy mismatch');
  if (!value.authority || Object.values(value.authority).some(Boolean)) throw new Error('reasoning memory guidance authority boundary is open');
  const seen = new Set();
  const features = new Set(Array.isArray(value.problemFeatures) ? value.problemFeatures : []);
  const bindings = new Map(value.featureBinding.bindings.map(item => [item.strategyTag, item]));
  for (const path of Array.isArray(value.paths) ? value.paths : []) {
    if (!path.actionId || seen.has(path.actionId)) throw new Error('reasoning memory guidance path identity is missing or duplicated');
    seen.add(path.actionId);
    const expected = path.state === 'SUPPORTING_CONTEXT' ? MAX_ADJUSTMENT : path.state === 'COUNTEREVIDENCE_CONTEXT' ? -MAX_ADJUSTMENT : 0;
    if (path.adjustment !== expected || Math.abs(path.adjustment) > MAX_ADJUSTMENT) throw new Error('reasoning memory guidance adjustment exceeds its evidence state');
    if (path.adjustment !== 0 && path.evidenceSufficient !== true) throw new Error('reasoning memory guidance adjusted without independent recurrence');
    if (!Array.isArray(path.bindingRefs) || path.bindingRefs.length !== path.strategyTags.length || path.tagOnlyRetrievals !== 0) throw new Error('reasoning memory guidance binding trace changed');
    for (const ref of path.bindingRefs) {
      const binding = bindings.get(ref.strategyTag);
      if (!binding || ref.bindingBatchId !== value.featureBinding.batchId || ref.bindingBatchDigest !== value.featureBinding.batchDigest || ref.bindingState !== binding.state || ref.bindingFeature !== binding.bindingFeature || ref.currentFeatureMatched !== !!(binding.bindingFeature && features.has(binding.bindingFeature))) throw new Error('reasoning memory guidance binding reference changed');
    }
    if (path.adjustment !== 0 && path.bindingRefs.some(item => item.bindingState !== 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE' || item.currentFeatureMatched !== true || !item.bindingFeature)) throw new Error('reasoning memory guidance adjusted without exact contrast-tested feature binding');
    const sourceGroups = Array.isArray(path.distinctSourceGroups) ? path.distinctSourceGroups : [];
    const evaluators = Array.isArray(path.distinctEvaluators) ? path.distinctEvaluators : [];
    if (path.evidenceSufficient !== (sourceGroups.length >= MIN_SOURCE_GROUPS && evaluators.length >= MIN_EVALUATORS)) throw new Error('reasoning memory guidance independence summary changed');
  }
  const expectedBasis = {
    problemFeatures: value.problemFeatures,
    pathProfiles: value.paths.map(path => ({ actionId: path.actionId, strategyTags: path.strategyTags })),
    contextRefs: value.contextRefs,
    featureBindingDigest: value.featureBinding.batchDigest,
    paths: value.paths
  };
  if (value.guidanceId !== `reasoning-memory-guidance-${State.digest(expectedBasis).slice(0, 24)}`) throw new Error('reasoning memory guidance identity changed');
  return true;
}

module.exports = { ORGAN_ID, SCHEMA, MAX_ADJUSTMENT, MIN_SOURCE_GROUPS, MIN_EVALUATORS, create, verify };
