'use strict';

const fs = require('fs');
const path = require('path');
const Experience = require('./reasoning-experience-organ');
const ReasoningStructuralFeatures = require('./reasoning-structural-feature-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const State = require('../kernel/state-language');

const ORGAN_ID = 'axm.mirror.organ/reasoning-memory-context-v1';
const SCHEMA = 'axm.mirror.reasoning-memory-context/v1';
const MAX_RECEIPTS = 512;

function clean(value, maximum = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum);
}

function token(value) {
  return clean(value, 160).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-');
}

function list(value, maximum = 128) {
  return Array.isArray(value) ? value.slice(0, maximum) : [];
}

function uniqueTokens(value, maximum = 128) {
  return Array.from(new Set(list(value, maximum).map(token).filter(Boolean))).sort();
}

function uniqueText(value, maximum = 128) {
  return Array.from(new Set(list(value, maximum).map(item => clean(item, 240)).filter(Boolean))).sort();
}

function normalizeQuery(value) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const query = {
    queryId: token(value.queryId || value.id) || 'reasoning-memory-query',
    requiredFeatures: uniqueTokens(value.requiredFeatures),
    requiredStrategyTags: uniqueTokens(value.requiredStrategyTags),
    requiredSeamIds: uniqueTokens(value.requiredSeamIds)
  };
  if (!query.requiredFeatures.length && !query.requiredStrategyTags.length && !query.requiredSeamIds.length) {
    throw new Error('reasoning memory query requires at least one exact structural feature, strategy tag, or seam ID');
  }
  return query;
}

function normalizeAccess(value) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const access = {
    requester: token(value.requester),
    purpose: clean(value.purpose, 1000),
    usePermission: clean(value.usePermission, 40),
    permissionBasis: clean(value.permissionBasis, 1000),
    allowedSourceGroups: uniqueText(value.allowedSourceGroups),
    allowedSourceGroupPrefixes: uniqueText(value.allowedSourceGroupPrefixes),
    maximumPerOutcome: Math.max(1, Math.min(32, Number(value.maximumPerOutcome) || 8))
  };
  if (!access.requester || !access.purpose || access.usePermission !== 'allowed' || !access.permissionBasis) {
    throw new Error('reasoning memory retrieval requires an attributed requester, purpose, and explicit allowed-use basis');
  }
  if (!access.allowedSourceGroups.length && !access.allowedSourceGroupPrefixes.length) {
    throw new Error('reasoning memory retrieval requires at least one exact source group or bounded source-group prefix');
  }
  if (access.allowedSourceGroupPrefixes.some(prefix => prefix === '/' || prefix === '.' || prefix === '*')) {
    throw new Error('reasoning memory source-group prefix is too broad');
  }
  return access;
}

function inScope(sourceGroup, access) {
  return access.allowedSourceGroups.includes(sourceGroup) ||
    access.allowedSourceGroupPrefixes.some(prefix => sourceGroup.startsWith(prefix));
}

function classifyNegative(receipt) {
  const evaluation = receipt.evaluation || {};
  if (evaluation.result !== 'DID_NOT_WORK') return null;
  if (receipt.schema === Experience.SCHEMA) {
    if (evaluation.decisionMatched === false) return 'DECISION_MISMATCH';
    if (evaluation.decisionMatched === true && evaluation.outcomeSucceeded === false) return 'VERIFIED_OUTCOME_FAILURE';
  }
  return 'LEGACY_BEHAVIOR_MISMATCH';
}

function featureView(receipt) {
  const projection = ReasoningStructuralFeatures.create(receipt.reasoningSession);
  ReasoningStructuralFeatures.verify(projection, receipt.reasoningSession);
  return {
    features: uniqueTokens(receipt.trainingExample.features.concat(projection.features), 256),
    projection
  };
}

function contextSignature(receipt, features = null) {
  return State.digest({
    features: features || featureView(receipt).features,
    strategyTags: uniqueTokens(receipt.trainingExample && receipt.trainingExample.strategyTags, 128)
  }, 64);
}

function exactMatch(receipt, query, featureList = null) {
  const features = new Set(featureList || featureView(receipt).features);
  const strategyTags = new Set(uniqueTokens(receipt.trainingExample && receipt.trainingExample.strategyTags, 128));
  const seamIds = new Set(uniqueTokens(receipt.evaluation && receipt.evaluation.unexpectedSeams, 128));
  return query.requiredFeatures.every(item => features.has(item)) &&
    query.requiredStrategyTags.every(item => strategyTags.has(item)) &&
    query.requiredSeamIds.every(item => seamIds.has(item));
}

function summary(receipt, query, view = null) {
  view = view || featureView(receipt);
  const features = new Set(view.features);
  const strategyTags = new Set(uniqueTokens(receipt.trainingExample.strategyTags, 128));
  const seamIds = new Set(uniqueTokens(receipt.evaluation.unexpectedSeams, 128));
  return {
    receiptId: receipt.receiptId,
    receiptDigest: receipt.receiptDigest,
    sourceGroup: receipt.source.sourceGroup,
    experienceKind: receipt.source.experienceKind || 'REAL_LOCAL_LESSON',
    evaluator: {
      id: receipt.source.evaluator.id,
      sourceDigest: receipt.source.evaluator.sourceDigest,
      independent: receipt.source.evaluator.independent === true
    },
    outcome: receipt.evaluation.result,
    negativeClass: classifyNegative(receipt),
    evidenceRole: receipt.trainingExample.evidenceRole,
    matched: {
      features: query.requiredFeatures.filter(item => features.has(item)),
      strategyTags: query.requiredStrategyTags.filter(item => strategyTags.has(item)),
      seamIds: query.requiredSeamIds.filter(item => seamIds.has(item))
    },
    featureProjectionId: view.projection.projectionId,
    featureProjectionDigest: view.projection.projectionDigest,
    featureSelectorDigest: view.projection.selector.selectorDigest,
    contextSignature: contextSignature(receipt, view.features),
    semanticTruth: false,
    decisionAuthority: false
  };
}

function retrieve(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('reasoning memory input must be an object');
  const query = normalizeQuery(input.query);
  const access = normalizeAccess(input.access);
  const supplied = list(input.receipts, MAX_RECEIPTS);
  const refused = [];
  const verified = [];

  for (let index = 0; index < supplied.length; index += 1) {
    const receipt = supplied[index];
    try {
      Experience.verify(receipt);
      verified.push(receipt);
    } catch (error) {
      refused.push({ receiptId: clean(receipt && receipt.receiptId, 120) || null, reason: 'INVALID_OR_UNVERIFIED_RECEIPT' });
    }
  }

  const byId = new Map();
  for (const receipt of verified) {
    const group = byId.get(receipt.receiptId) || [];
    group.push(receipt);
    byId.set(receipt.receiptId, group);
  }

  const uniqueVerified = [];
  for (const receiptId of Array.from(byId.keys()).sort()) {
    const group = byId.get(receiptId);
    const digests = Array.from(new Set(group.map(item => item.receiptDigest))).sort();
    if (digests.length > 1) {
      refused.push({ receiptId, reason: 'AMBIGUOUS_RECEIPT_ID_MULTIPLE_VALID_DIGESTS' });
      continue;
    }
    uniqueVerified.push(group[0]);
    if (group.length > 1) refused.push({ receiptId, reason: 'DUPLICATE_IDENTICAL_RECEIPT_IGNORED', duplicateCount: group.length - 1 });
  }

  const accessible = [];
  for (const receipt of uniqueVerified) {
    if (!inScope(receipt.source.sourceGroup, access)) {
      refused.push({ receiptId: receipt.receiptId, reason: 'SOURCE_GROUP_OUT_OF_REQUEST_SCOPE' });
      continue;
    }
    accessible.push(receipt);
  }

  const featureViews = new Map(accessible.map(receipt => [receipt.receiptId, featureView(receipt)]));
  const matching = accessible.filter(receipt => exactMatch(receipt, query, featureViews.get(receipt.receiptId).features))
    .map(receipt => summary(receipt, query, featureViews.get(receipt.receiptId)));
  matching.sort((left, right) => left.contextSignature.localeCompare(right.contextSignature) || left.receiptId.localeCompare(right.receiptId));
  const allSupporting = matching.filter(item => item.outcome === 'WORKED');
  const allCounterevidence = matching.filter(item => item.outcome === 'DID_NOT_WORK');
  const supporting = allSupporting.slice(0, access.maximumPerOutcome);
  const counterevidence = allCounterevidence.slice(0, access.maximumPerOutcome);

  const bySignature = new Map();
  for (const item of matching) {
    const group = bySignature.get(item.contextSignature) || [];
    group.push(item);
    bySignature.set(item.contextSignature, group);
  }
  const contradictions = [];
  for (const signature of Array.from(bySignature.keys()).sort()) {
    const group = bySignature.get(signature);
    const positive = group.filter(item => item.outcome === 'WORKED').map(item => item.receiptId).sort();
    const negative = group.filter(item => item.outcome === 'DID_NOT_WORK').map(item => item.receiptId).sort();
    if (positive.length && negative.length) contradictions.push({ contextSignature: signature, supportingReceiptIds: positive, counterevidenceReceiptIds: negative });
  }

  let state = 'NO_EXACT_STRUCTURAL_MATCH';
  if (contradictions.length) state = 'CONTRADICTORY_RELEVANT_EXPERIENCE';
  else if (allSupporting.length && allCounterevidence.length) state = 'MIXED_RELEVANT_EXPERIENCE';
  else if (allCounterevidence.length) state = 'COUNTEREVIDENCE_ONLY';
  else if (allSupporting.length) state = 'SUPPORTING_EXPERIENCE_ONLY';

  const unknowns = [];
  if (!matching.length) unknowns.push('NO_EXACT_STRUCTURAL_MEMORY_MATCH');
  if (!allSupporting.length) unknowns.push('NO_RELEVANT_POSITIVE_EXPERIENCE_OBSERVED');
  if (!allCounterevidence.length) unknowns.push('NO_RELEVANT_NEGATIVE_EXPERIENCE_OBSERVED');
  if (supporting.length < allSupporting.length || counterevidence.length < allCounterevidence.length) unknowns.push('RELEVANT_RESULTS_TRUNCATED');
  if (refused.some(item => item.reason === 'SOURCE_GROUP_OUT_OF_REQUEST_SCOPE')) unknowns.push('OUT_OF_SCOPE_RECEIPTS_NOT_USED');
  if (refused.some(item => item.reason === 'INVALID_OR_UNVERIFIED_RECEIPT')) unknowns.push('INVALID_RECEIPTS_NOT_USED');

  refused.sort((left, right) => String(left.receiptId).localeCompare(String(right.receiptId)) || left.reason.localeCompare(right.reason));
  const basis = {
    query,
    access,
    featureProjection: {
      organId: ReasoningStructuralFeatures.ORGAN_ID,
      selectorId: ReasoningStructuralFeatures.loadSelector().selectorId,
      selectorDigest: ReasoningStructuralFeatures.loadSelector().selectorDigest,
      positiveFactsOnly: true
    },
    inventory: {
      supplied: supplied.length,
      verifiedUnique: uniqueVerified.length,
      accessible: accessible.length,
      exactMatches: matching.length,
      supporting: allSupporting.length,
      counterevidence: allCounterevidence.length,
      refused: refused.length
    },
    state,
    supporting,
    counterevidence,
    contradictions,
    refused,
    unknowns
  };
  const output = {
    schema: SCHEMA,
    contextId: `reasoning-memory-context-${State.digest(basis).slice(0, 24)}`,
    organ: { id: ORGAN_ID, status: 'EXPERIMENTAL', learnedWeights: false },
    query,
    access: {
      requester: access.requester,
      purpose: access.purpose,
      usePermission: 'allowed',
      permissionBasis: access.permissionBasis,
      allowedSourceGroups: access.allowedSourceGroups,
      allowedSourceGroupPrefixes: access.allowedSourceGroupPrefixes,
      maximumPerOutcome: access.maximumPerOutcome,
      scopeDigest: State.digest(access, 64)
    },
    featureProjection: basis.featureProjection,
    inventory: basis.inventory,
    state,
    supporting,
    counterevidence,
    contradictions,
    refused,
    unknowns,
    retrievalRule: 'Only content-verified receipts inside the explicit source scope may match every supplied machine-structural query obligation. Legacy receipt features are joined at read time with positive facts from the sealed schema-selected projection; negative observations never become retrieval matches. Success and counterevidence remain separate and equal-result limits prevent positive volume from hiding negative evidence.',
    authority: {
      memoryReadBeyondScope: false,
      memoryWrite: false,
      semanticTruthWrite: false,
      evidenceAdmission: false,
      decisionAuthority: false,
      trainingAdmission: false,
      toolUse: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This packet is bounded advisory context, not truth, a probability, a decision, or permission. Exact structural matching can reduce irrelevant context but cannot prove that a past episode applies to the present case.'
  };
  output.contextDigest = State.digest(output, 64);
  return output;
}

function run(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const receiptsDir = path.resolve(options.receiptsDir || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-memory-context-runs'));
  const loaded = Experience.loadDirectory(receiptsDir);
  const context = retrieve({
    query: options.query || {
      queryId: 'blocking-unknown-real-local-precedents',
      requiredFeatures: ['blocking-unknown:present'],
      requiredStrategyTags: ['ask-blocking-unknown'],
      requiredSeamIds: []
    },
    access: options.access || {
      requester: 'axm.mirror.reasoning-foundation/seed-0',
      purpose: 'Retrieve a bounded real-local structural context packet for inspection before future reasoning integration.',
      usePermission: 'allowed',
      permissionBasis: 'Standing local Workshop practice receipts with an explicit read-only reasoning-memory audit scope.',
      allowedSourceGroupPrefixes: ['workshop-reasoning/'],
      maximumPerOutcome: 8
    },
    receipts: loaded.map(item => item.receipt)
  });
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, context.contextId);
  const stageDir = path.join(stateDir, `.stage-${context.contextId}-${process.pid}`);
  try {
    fs.mkdirSync(stageDir, { recursive: false });
    fs.writeFileSync(path.join(stageDir, 'context.json'), `${JSON.stringify(context, null, 2)}\n`, 'utf8');
    const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
    return { context, runDir: commit.runDir, reused: commit.reused };
  } catch (error) {
    if (error && error.code !== 'IMMUTABLE_BATCH_DIVERGENCE' && fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { ORGAN_ID, SCHEMA, MAX_RECEIPTS, uniqueTokens, normalizeAccess, inScope, featureView, retrieve, run };
