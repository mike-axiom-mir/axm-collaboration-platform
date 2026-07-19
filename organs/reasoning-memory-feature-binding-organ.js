'use strict';

const fs = require('fs');
const path = require('path');
const Experience = require('./reasoning-experience-organ');
const MemoryContext = require('./reasoning-memory-context-organ');
const ReasoningStructuralFeatures = require('./reasoning-structural-feature-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const State = require('../kernel/state-language');

const ORGAN_ID = 'axm.mirror.organ/reasoning-memory-feature-binding-v1';
const SCHEMA = 'axm.mirror.reasoning-memory-feature-binding-batch/v1';
const MIN_SOURCE_GROUPS = 2;
const MIN_EVALUATORS = 2;
const MAX_TAGS = 32;
const MAX_FEATURES = 256;
const EXCLUDED_PREFIXES = Object.freeze([
  'action-kind:',
  'candidate-count:',
  'constraint-type:',
  'estimated-cost:',
  'evidence-kind:',
  'evidence-status:',
  'path-count:',
  'permission-set:',
  'risk:',
  'unknown-count:'
]);
const EXCLUDED_SUFFIXES = Object.freeze([':absent', ':empty', ':none', ':unknown']);
const LEGACY_BINDABLE_FEATURES = Object.freeze([
  'blocking-unknown:present',
  'candidate-prohibition:present',
  'contradiction:present',
  'irreversible-path:present',
  'open-assumption:present',
  'path-permission:missing',
  'precondition-evidence:missing',
  'reversible-path:present',
  'tool-request:present'
]);
const STRUCTURAL_FEATURE_PREFIX = 'structural-fact:';

function clean(value, maximum = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum);
}
function token(value) {
  return clean(value, 160).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-');
}
function uniqueTokens(value, maximum = 128) {
  return Array.from(new Set((Array.isArray(value) ? value.slice(0, maximum) : []).map(token).filter(Boolean))).sort();
}
function digest(value) { return State.digest(value, 64); }
function same(left, right) { return digest(left) === digest(right); }
function eligibleFeature(feature) {
  return typeof feature === 'string' &&
    (feature.startsWith(STRUCTURAL_FEATURE_PREFIX) || LEGACY_BINDABLE_FEATURES.includes(feature)) &&
    !EXCLUDED_PREFIXES.some(prefix => feature.startsWith(prefix)) &&
    !EXCLUDED_SUFFIXES.some(suffix => feature.endsWith(suffix));
}
function values(rows, selector) { return Array.from(new Set(rows.map(selector).filter(Boolean))).sort(); }
function counts(rows, selector) {
  const output = {};
  for (const row of rows) {
    const key = selector(row);
    if (key) output[key] = (output[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(output).sort((left, right) => left[0].localeCompare(right[0])));
}

function inventory(receipts, access) {
  if (!Array.isArray(receipts)) receipts = [];
  if (receipts.length > MemoryContext.MAX_RECEIPTS) throw new Error(`reasoning memory feature binding accepts at most ${MemoryContext.MAX_RECEIPTS} receipts`);
  const refused = [];
  const verified = [];
  for (const receipt of receipts) {
    try {
      Experience.verify(receipt);
      verified.push(receipt);
    } catch (_) {
      refused.push({ receiptId: clean(receipt && receipt.receiptId, 120) || null, reason: 'INVALID_OR_UNVERIFIED_RECEIPT' });
    }
  }
  const byId = new Map();
  for (const receipt of verified) {
    const group = byId.get(receipt.receiptId) || [];
    group.push(receipt);
    byId.set(receipt.receiptId, group);
  }
  const unique = [];
  for (const receiptId of Array.from(byId.keys()).sort()) {
    const group = byId.get(receiptId);
    const digests = values(group, item => item.receiptDigest);
    if (digests.length !== 1) {
      refused.push({ receiptId, reason: 'AMBIGUOUS_RECEIPT_ID_MULTIPLE_VALID_DIGESTS' });
      continue;
    }
    unique.push(group[0]);
    if (group.length > 1) refused.push({ receiptId, reason: 'DUPLICATE_IDENTICAL_RECEIPT_IGNORED' });
  }
  const records = [];
  const synthetic = [];
  for (const receipt of unique) {
    if (!MemoryContext.inScope(receipt.source.sourceGroup, access)) {
      refused.push({ receiptId: receipt.receiptId, reason: 'SOURCE_GROUP_OUT_OF_REQUEST_SCOPE' });
      continue;
    }
    const eligibility = Experience.trainingEligibility(receipt);
    if (!eligibility.eligible) {
      refused.push({ receiptId: receipt.receiptId, reason: eligibility.state });
      continue;
    }
    const featureProjection = ReasoningStructuralFeatures.create(receipt.reasoningSession);
    ReasoningStructuralFeatures.verify(featureProjection, receipt.reasoningSession);
    const row = {
      receiptId: receipt.receiptId,
      receiptDigest: receipt.receiptDigest,
      sourceGroup: receipt.source.sourceGroup,
      evaluatorId: receipt.source.evaluator.id,
      experienceKind: receipt.source.experienceKind || 'REAL_LOCAL_LESSON',
      outcome: receipt.trainingExample.outcome,
      features: uniqueTokens(receipt.trainingExample.features.concat(featureProjection.features), MAX_FEATURES),
      featureProjectionId: featureProjection.projectionId,
      featureProjectionDigest: featureProjection.projectionDigest,
      featureSelectorDigest: featureProjection.selector.selectorDigest,
      strategyTags: uniqueTokens(receipt.trainingExample.strategyTags, MAX_TAGS)
    };
    if (row.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE') synthetic.push(row);
    else records.push(row);
  }
  records.sort((left, right) => left.receiptId.localeCompare(right.receiptId));
  synthetic.sort((left, right) => left.receiptId.localeCompare(right.receiptId));
  refused.sort((left, right) => String(left.receiptId).localeCompare(String(right.receiptId)) || left.reason.localeCompare(right.reason));
  return { supplied: receipts.length, verified: verified.length, records, synthetic, refused };
}

function cohort(rows) {
  return {
    receipts: rows.length,
    sourceGroups: values(rows, item => item.sourceGroup),
    evaluators: values(rows, item => item.evaluatorId),
    experienceKinds: counts(rows, item => item.experienceKind),
    outcomes: counts(rows, item => item.outcome)
  };
}

function deriveBinding(strategyTag, records, synthetic) {
  const tagged = records.filter(item => item.strategyTags.includes(strategyTag));
  const contrast = records.filter(item => !item.strategyTags.includes(strategyTag));
  const syntheticTagged = synthetic.filter(item => item.strategyTags.includes(strategyTag));
  const universal = tagged.length
    ? tagged[0].features.filter(feature => tagged.every(item => item.features.includes(feature))).sort()
    : [];
  const exclusive = universal.filter(feature => contrast.every(item => !item.features.includes(feature))).sort();
  const candidates = exclusive.filter(eligibleFeature);
  const excluded = exclusive.filter(feature => !eligibleFeature(feature));
  const taggedCohort = cohort(tagged);
  const contrastCohort = cohort(contrast);
  let state;
  if (!tagged.length && syntheticTagged.length) state = 'HOLD_SYNTHETIC_ONLY_TAG_EVIDENCE';
  else if (!tagged.length) state = 'HOLD_NO_TAGGED_RECEIPTS';
  else if (taggedCohort.sourceGroups.length < MIN_SOURCE_GROUPS) state = 'HOLD_INSUFFICIENT_TAG_SOURCE_DIVERSITY';
  else if (taggedCohort.evaluators.length < MIN_EVALUATORS) state = 'HOLD_INSUFFICIENT_TAG_EVALUATOR_DIVERSITY';
  else if (!contrast.length) state = 'HOLD_NO_CONTRAST_RECEIPTS';
  else if (contrastCohort.sourceGroups.length < MIN_SOURCE_GROUPS) state = 'HOLD_INSUFFICIENT_CONTRAST_SOURCE_DIVERSITY';
  else if (contrastCohort.evaluators.length < MIN_EVALUATORS) state = 'HOLD_INSUFFICIENT_CONTRAST_EVALUATOR_DIVERSITY';
  else if (!candidates.length) state = 'HOLD_NO_EXACT_EXCLUSIVE_POSITIVE_FEATURE';
  else if (candidates.length > 1) state = 'HOLD_AMBIGUOUS_EXCLUSIVE_POSITIVE_FEATURES';
  else state = 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE';
  return {
    strategyTag,
    state,
    bindingFeature: state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE' ? candidates[0] : null,
    tagged: taggedCohort,
    contrast: contrastCohort,
    syntheticTaggedReceiptsHeld: syntheticTagged.length,
    universalFeatures: universal,
    universalExclusiveFeatures: exclusive,
    eligibleExclusivePositiveFeatures: candidates,
    excludedDescriptorOrNegativeFeatures: excluded,
    tagOnlyRetrievalAllowed: false,
    semanticTruth: false,
    decisionAuthority: false
  };
}

function build(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('reasoning memory feature binding input must be an object');
  const strategyTags = uniqueTokens(input.strategyTags, MAX_TAGS);
  const access = MemoryContext.normalizeAccess(input.access);
  const observed = inventory(input.receipts, access);
  const structuralSelector = ReasoningStructuralFeatures.loadSelector();
  const bindings = strategyTags.map(tag => deriveBinding(tag, observed.records, observed.synthetic));
  const sourceInventory = observed.records.concat(observed.synthetic).map(item => ({
    receiptId: item.receiptId,
    receiptDigest: item.receiptDigest,
    sourceGroup: item.sourceGroup,
    evaluatorId: item.evaluatorId,
    experienceKind: item.experienceKind,
    outcome: item.outcome,
    features: item.features,
    featureProjectionId: item.featureProjectionId,
    featureProjectionDigest: item.featureProjectionDigest,
    featureSelectorDigest: item.featureSelectorDigest,
    strategyTags: item.strategyTags
  })).sort((left, right) => left.receiptId.localeCompare(right.receiptId));
  const basis = {
    strategyTags,
    access: {
      requester: access.requester,
      purpose: access.purpose,
      usePermission: access.usePermission,
      permissionBasis: access.permissionBasis,
      allowedSourceGroups: access.allowedSourceGroups,
      allowedSourceGroupPrefixes: access.allowedSourceGroupPrefixes
    },
    sourceInventoryDigest: digest(sourceInventory),
    bindings,
    refused: observed.refused
  };
  const batch = {
    schema: SCHEMA,
    batchId: `reasoning-memory-feature-bindings-${digest(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST_PRIVATE_CONTRAST_BINDER', learnedWeights: false },
    source: {
      accessDigest: digest(basis.access),
      receiptInventoryDigest: basis.sourceInventoryDigest,
      structuralProjectionOrganId: ReasoningStructuralFeatures.ORGAN_ID,
      structuralSelectorId: structuralSelector.selectorId,
      structuralSelectorDigest: structuralSelector.selectorDigest,
      receiptsSupplied: observed.supplied,
      receiptsVerified: observed.verified,
      eligibleNonSyntheticReceipts: observed.records.length,
      syntheticReceiptsHeld: observed.synthetic.length,
      refusedReceipts: observed.refused.length
    },
    strategyTags,
    bindings,
    refused: observed.refused,
    summary: {
      strategiesAssessed: bindings.length,
      exactBindings: bindings.filter(item => item.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE').length,
      heldBindings: bindings.filter(item => item.state !== 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE').length,
      tagOnlyRetrievalsAllowed: 0,
      evidenceAdmissions: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      runtimePromotions: 0,
      worldActions: 0
    },
    policy: {
      minimumDistinctTaggedSourceGroups: MIN_SOURCE_GROUPS,
      minimumDistinctTaggedEvaluators: MIN_EVALUATORS,
      minimumDistinctContrastSourceGroups: MIN_SOURCE_GROUPS,
      minimumDistinctContrastEvaluators: MIN_EVALUATORS,
      syntheticEvidenceCanBind: false,
      exactUniversalFeatureRequired: true,
      exactContrastExclusionRequired: true,
      exactlyOneEligibleFeatureRequired: true,
      negativeOrAbsentFeatureCanBind: false,
      tagOnlyRetrievalAllowed: false,
      schemaSelectedMachineFeaturesCanBind: true,
      structuralFeaturePrefix: STRUCTURAL_FEATURE_PREFIX,
      legacyBindableFeatures: LEGACY_BINDABLE_FEATURES.slice(),
      excludedFeaturePrefixes: EXCLUDED_PREFIXES.slice(),
      excludedFeatureSuffixes: EXCLUDED_SUFFIXES.slice()
    },
    state: bindings.some(item => item.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE')
      ? bindings.every(item => item.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE')
        ? 'ALL_REQUESTED_STRATEGIES_EXACTLY_BOUND'
        : 'PARTIAL_EXACT_BINDINGS_WITH_VISIBLE_HOLDS'
      : 'HOLD_NO_REQUESTED_STRATEGY_EXACTLY_BOUND',
    authority: {
      privateBindingTraceWrite: true,
      semanticTruthWrite: false,
      evidenceAdmission: false,
      decisionAuthority: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'A binding is emitted only from one positive allowlisted legacy feature or selector-declared structural machine fact shared by every independently recurrent scoped non-synthetic tagged receipt and absent from every independently diverse contrast receipt. Descriptive, negative, absent, ambiguous, synthetic-only, and under-diverse evidence holds. A binding permits exact retrieval only; it is not semantic truth, outcome evidence, permission, a decision, training, promotion, CANON, or action.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verify(batch, input = null, runDir = null) {
  if (!batch || batch.schema !== SCHEMA || !/^reasoning-memory-feature-bindings-[a-f0-9]{24}$/.test(String(batch.batchId || '')) || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('reasoning memory feature binding batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('reasoning memory feature binding organ lineage changed');
  if (!batch.policy || batch.policy.minimumDistinctTaggedSourceGroups !== MIN_SOURCE_GROUPS || batch.policy.minimumDistinctTaggedEvaluators !== MIN_EVALUATORS || batch.policy.minimumDistinctContrastSourceGroups !== MIN_SOURCE_GROUPS || batch.policy.minimumDistinctContrastEvaluators !== MIN_EVALUATORS || batch.policy.tagOnlyRetrievalAllowed !== false || batch.policy.syntheticEvidenceCanBind !== false || batch.policy.exactUniversalFeatureRequired !== true || batch.policy.exactContrastExclusionRequired !== true || batch.policy.exactlyOneEligibleFeatureRequired !== true || batch.policy.negativeOrAbsentFeatureCanBind !== false || batch.policy.schemaSelectedMachineFeaturesCanBind !== true || batch.policy.structuralFeaturePrefix !== STRUCTURAL_FEATURE_PREFIX || !same(batch.policy.legacyBindableFeatures, LEGACY_BINDABLE_FEATURES) || !same(batch.policy.excludedFeaturePrefixes, EXCLUDED_PREFIXES) || !same(batch.policy.excludedFeatureSuffixes, EXCLUDED_SUFFIXES)) throw new Error('reasoning memory feature binding policy changed');
  if (!batch.source || batch.source.structuralProjectionOrganId !== ReasoningStructuralFeatures.ORGAN_ID || batch.source.structuralSelectorId !== ReasoningStructuralFeatures.loadSelector().selectorId || batch.source.structuralSelectorDigest !== ReasoningStructuralFeatures.loadSelector().selectorDigest) throw new Error('reasoning memory structural feature lineage changed');
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => key === 'privateBindingTraceWrite' ? value !== true : value !== false)) throw new Error('reasoning memory feature binding authority changed');
  const tags = uniqueTokens(batch.strategyTags, MAX_TAGS);
  const bindings = Array.isArray(batch.bindings) ? batch.bindings : [];
  if (!same(tags, batch.strategyTags) || bindings.length !== tags.length || !same(bindings.map(item => item.strategyTag), tags)) throw new Error('reasoning memory feature binding strategy inventory changed');
  for (const item of bindings) {
    const candidates = uniqueTokens(item.eligibleExclusivePositiveFeatures, MAX_FEATURES);
    const exact = item.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE';
    if (item.tagOnlyRetrievalAllowed !== false || item.semanticTruth !== false || item.decisionAuthority !== false || exact !== (typeof item.bindingFeature === 'string' && item.bindingFeature.length > 0) || exact !== (candidates.length === 1 && item.bindingFeature === candidates[0])) throw new Error('reasoning memory feature binding result boundary changed');
    if (!Array.isArray(item.universalFeatures) || !Array.isArray(item.universalExclusiveFeatures) || item.universalExclusiveFeatures.some(feature => !item.universalFeatures.includes(feature)) || candidates.some(feature => !item.universalExclusiveFeatures.includes(feature) || !eligibleFeature(feature))) throw new Error('reasoning memory feature binding feature proof changed');
  }
  const exactBindings = bindings.filter(item => item.state === 'BOUND_EXACT_EXCLUSIVE_POSITIVE_FEATURE').length;
  const expectedState = exactBindings ? exactBindings === bindings.length ? 'ALL_REQUESTED_STRATEGIES_EXACTLY_BOUND' : 'PARTIAL_EXACT_BINDINGS_WITH_VISIBLE_HOLDS' : 'HOLD_NO_REQUESTED_STRATEGY_EXACTLY_BOUND';
  if (!batch.summary || batch.summary.strategiesAssessed !== bindings.length || batch.summary.exactBindings !== exactBindings || batch.summary.heldBindings !== bindings.length - exactBindings || batch.summary.tagOnlyRetrievalsAllowed !== 0 || batch.summary.evidenceAdmissions !== 0 || batch.summary.trainingAdmissions !== 0 || batch.summary.permissionGrants !== 0 || batch.summary.runtimePromotions !== 0 || batch.summary.worldActions !== 0 || batch.state !== expectedState) throw new Error('reasoning memory feature binding summary authority changed');
  if (input && !same(build(input), batch)) throw new Error('reasoning memory feature binding reconstruction changed');
  if (runDir) {
    const file = path.join(runDir, 'batch.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('reasoning memory feature binding batch is not a real file');
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!same(disk, batch)) throw new Error('reasoning memory feature binding batch file changed');
  }
  return true;
}

function run(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const receiptsDir = path.resolve(options.receiptsDir || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-memory-feature-binding-runs'));
  const loaded = Experience.loadDirectory(receiptsDir);
  const input = {
    strategyTags: options.strategyTags || Array.from(new Set(loaded.flatMap(item => item.receipt.trainingExample.strategyTags))).sort(),
    access: options.access || {
      requester: ORGAN_ID,
      purpose: 'Derive private contrast-tested structural applicability bindings for verified reasoning strategies.',
      usePermission: 'allowed',
      permissionBasis: 'Standing local Workshop reasoning receipts under an explicit read-only private binding audit.',
      allowedSourceGroupPrefixes: ['workshop-reasoning/', 'workshop-contract-exam/'],
      maximumPerOutcome: 8
    },
    receipts: loaded.map(item => item.receipt)
  };
  const batch = build(input);
  verify(batch, input);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  try {
    fs.mkdirSync(stageDir, { recursive: false });
    fs.writeFileSync(path.join(stageDir, 'batch.json'), `${JSON.stringify(batch, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
    return { batch, runDir: commit.runDir, reused: commit.reused };
  } catch (error) {
    if (error && error.code !== 'IMMUTABLE_BATCH_DIVERGENCE' && fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  ORGAN_ID,
  SCHEMA,
  MIN_SOURCE_GROUPS,
  MIN_EVALUATORS,
  MAX_TAGS,
  MAX_FEATURES,
  EXCLUDED_PREFIXES,
  EXCLUDED_SUFFIXES,
  LEGACY_BINDABLE_FEATURES,
  STRUCTURAL_FEATURE_PREFIX,
  eligibleFeature,
  inventory,
  deriveBinding,
  build,
  verify,
  run
};
