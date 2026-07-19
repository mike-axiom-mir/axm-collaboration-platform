'use strict';

const crypto = require('crypto');

const SCHEMA = 'axm.mirror.reasoning-strategy-model/v2';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value, length = 64) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0, length);
}

function clean(value, max = 160) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function token(value) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-');
}

function bucketCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (!count) return 'none';
  if (count === 1) return 'one';
  if (count <= 3) return 'few';
  return 'many';
}

function extractFeatures(context) {
  context = context || {};
  const problem = context.problemState || {};
  const trace = context.principleTrace || {};
  const profiles = context.pathSet && Array.isArray(context.pathSet.profiles)
    ? context.pathSet.profiles
    : Array.isArray(context.profiles) ? context.profiles : [];
  const evidence = Array.isArray(problem.evidence)
    ? problem.evidence
    : [].concat(problem.observations || [], problem.assertions || [], problem.derived || [], problem.predictions || []);
  const unknowns = Array.isArray(problem.unknowns) ? problem.unknowns : [];
  const assumptions = Array.isArray(problem.assumptions) ? problem.assumptions : [];
  const contradictions = Array.isArray(problem.contradictions) ? problem.contradictions : [];
  const constraints = Array.isArray(problem.constraints) ? problem.constraints : (trace.constraints || []);
  const permissions = Array.isArray(problem.permissions) ? problem.permissions : (trace.permissions || []);
  const candidates = Array.isArray(trace.candidates) ? trace.candidates : [];
  const candidateIds = new Set(candidates.map(item => item && item.action && item.action.id || item && item.id).filter(Boolean));
  const evidenceIds = new Set(evidence.map(item => item && item.id).filter(Boolean));
  const features = new Set();

  features.add(`unknown-count:${bucketCount(unknowns.length)}`);
  features.add(`blocking-unknown:${unknowns.some(item => item && item.blocking) ? 'present' : 'absent'}`);
  features.add(`contradiction:${contradictions.length ? 'present' : 'absent'}`);
  features.add(`open-assumption:${assumptions.some(item => !item || item.status === 'OPEN') ? 'present' : 'absent'}`);
  features.add(`permission-set:${permissions.length ? 'present' : 'empty'}`);
  features.add(`candidate-count:${bucketCount(candidates.length)}`);
  features.add(`path-count:${bucketCount(profiles.length)}`);
  features.add(`tool-request:${profiles.some(item => item && item.toolRequest) ? 'present' : 'absent'}`);
  features.add(`reversible-path:${profiles.some(item => item && item.reversible) ? 'present' : 'absent'}`);
  features.add(`irreversible-path:${profiles.some(item => item && item.reversible === false) ? 'present' : 'absent'}`);

  for (const item of evidence) {
    if (item && item.kind) features.add(`evidence-kind:${token(item.kind)}`);
    if (item && item.status) features.add(`evidence-status:${token(item.status)}`);
  }
  for (const item of constraints) if (item && item.type) features.add(`constraint-type:${token(item.type)}`);
  if (constraints.some(item => item && item.type === 'prohibit-action' &&
      Array.isArray(item.actionIds) && item.actionIds.some(actionId => candidateIds.has(actionId)))) features.add('candidate-prohibition:present');
  for (const item of candidates) {
    const action = item && item.action || item;
    if (!action) continue;
    if (action.kind) features.add(`action-kind:${token(action.kind)}`);
    if (action.risk) features.add(`risk:${token(action.risk)}`);
    const required = [].concat(action.preconditionEvidence || []);
    if (required.some(ref => !evidenceIds.has(ref))) features.add('precondition-evidence:missing');
  }
  for (const profile of profiles) {
    if (!profile) continue;
    if (profile.estimatedCost) features.add(`estimated-cost:${token(profile.estimatedCost)}`);
    for (const permission of profile.requiredPermissions || []) {
      if (!permissions.includes(permission)) features.add('path-permission:missing');
    }
  }
  return Array.from(features).filter(Boolean).sort();
}

function observableStrategyTags(features, options = {}) {
  const present = new Set(Array.isArray(features) ? features : []);
  const tags = [];
  if (present.has('path-permission:missing')) tags.push('respect-missing-permission');
  if (present.has('candidate-prohibition:present') ||
      (present.has('candidate-count:none') && present.has('constraint-type:prohibit-action'))) tags.push('respect-explicit-prohibition');
  if (present.has('blocking-unknown:present') || present.has('precondition-evidence:missing')) tags.push('ask-blocking-unknown');
  if (present.has('contradiction:present')) tags.push('discriminate-conflict');
  if (present.has('tool-request:present')) tags.push('request-bounded-tool');
  if (present.has('open-assumption:present')) tags.push('test-open-assumption');
  if (present.has('irreversible-path:present')) tags.push('require-recovery-before-action');
  if (!tags.length && options.includeBoundedAction === true && Number(options.decisionValue) === 1 && present.has('reversible-path:present')) tags.push('bounded-reversible-action');
  if (!tags.length && options.fallback === true) tags.push('verify-before-commit');
  return Array.from(new Set(tags));
}

function verify(model) {
  if (!model || model.schema !== SCHEMA) throw new Error('invalid reasoning strategy model');
  if (!model.modelDigest || !/^[a-f0-9]{64}$/.test(model.modelDigest)) throw new Error('reasoning strategy model digest missing');
  const basis = Object.assign({}, model);
  delete basis.modelDigest;
  if (digest(basis) !== model.modelDigest) throw new Error('reasoning strategy model digest mismatch');
  if (!model.labels || !Object.keys(model.labels).length) throw new Error('reasoning strategy model has no learned labels');
  if (!model.sequences || !Object.keys(model.sequences).length) throw new Error('reasoning strategy model has no learned sequences');
  if (!model.negativeLabels || typeof model.negativeLabels !== 'object' || !model.negativeSequences || typeof model.negativeSequences !== 'object') throw new Error('reasoning strategy model negative evidence maps are missing');
  for (const [sequenceKey, record] of Object.entries(model.sequences)) {
    if (!record || !Array.isArray(record.strategyTags) || !record.strategyTags.length ||
        record.strategyTags.join('>then>') !== sequenceKey || !record.prototype) {
      throw new Error(`reasoning strategy model sequence is incomplete: ${sequenceKey}`);
    }
  }
  if (!Array.isArray(model.featureVocabulary)) throw new Error('reasoning strategy model feature vocabulary missing');
  return true;
}

function eligibleSession(session) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1') return { ok: false, reason: 'not a reasoning session' };
  if (!session.independentSeamReview || session.independentSeamReview.summary.open !== 0) return { ok: false, reason: 'independent seam review is not clean' };
  if (!session.consolidation || session.consolidation.state !== 'PROPOSE_REVIEW') return { ok: false, reason: 'consolidation is not review-eligible' };
  if (!session.verification || !session.verification.finalOutcome || session.verification.finalOutcome.verified !== true) return { ok: false, reason: 'verified outcome missing' };
  if (Object.entries(session.authority || {}).some(([key, value]) => key !== 'proposalOnly' && value !== false)) return { ok: false, reason: 'reasoning authority boundary is not clean' };
  const selected = session.pathSet && session.pathSet.profiles && session.pathSet.profiles.find(item => item.actionId === session.pathSet.selectedActionId);
  if (!selected || !Array.isArray(selected.strategyTags) || !selected.strategyTags.length) return { ok: false, reason: 'selected path has no reusable strategy tag' };
  return { ok: true, selected };
}

function train(sessions, options = {}) {
  sessions = Array.isArray(sessions) ? sessions : [];
  const labels = Object.create(null);
  const sequences = Object.create(null);
  const negativeLabels = Object.create(null);
  const negativeSequences = Object.create(null);
  const vocabulary = new Set();
  const sources = [];
  const refused = [];

  function positive(tags, features, prototype, sourceId) {
    const prototypeId = `prototype-${digest(prototype, 24)}`;
    for (const label of tags) {
      if (!labels[label]) labels[label] = { examples: 0, featureCounts: Object.create(null), sourceSessionIds: [], prototypeCandidates: Object.create(null) };
      labels[label].examples += 1;
      labels[label].sourceSessionIds.push(sourceId);
      for (const feature of features) labels[label].featureCounts[feature] = (labels[label].featureCounts[feature] || 0) + 1;
      if (!labels[label].prototypeCandidates[prototypeId]) labels[label].prototypeCandidates[prototypeId] = { count: 0, prototype };
      labels[label].prototypeCandidates[prototypeId].count += 1;
    }
    const sequenceKey = tags.join('>then>');
    if (!sequences[sequenceKey]) sequences[sequenceKey] = {
      examples: 0,
      strategyTags: tags,
      featureCounts: Object.create(null),
      sourceSessionIds: [],
      prototypeCandidates: Object.create(null)
    };
    sequences[sequenceKey].examples += 1;
    sequences[sequenceKey].sourceSessionIds.push(sourceId);
    for (const feature of features) sequences[sequenceKey].featureCounts[feature] = (sequences[sequenceKey].featureCounts[feature] || 0) + 1;
    if (!sequences[sequenceKey].prototypeCandidates[prototypeId]) sequences[sequenceKey].prototypeCandidates[prototypeId] = { count: 0, prototype };
    sequences[sequenceKey].prototypeCandidates[prototypeId].count += 1;
  }

  function negative(tags, features, sourceId) {
    for (const label of tags) {
      if (!negativeLabels[label]) negativeLabels[label] = { examples: 0, featureCounts: Object.create(null), sourceReceiptIds: [] };
      negativeLabels[label].examples += 1;
      negativeLabels[label].sourceReceiptIds.push(sourceId);
      for (const feature of features) negativeLabels[label].featureCounts[feature] = (negativeLabels[label].featureCounts[feature] || 0) + 1;
    }
    const sequenceKey = tags.join('>then>');
    if (!negativeSequences[sequenceKey]) negativeSequences[sequenceKey] = { examples: 0, strategyTags: tags, featureCounts: Object.create(null), sourceReceiptIds: [] };
    negativeSequences[sequenceKey].examples += 1;
    negativeSequences[sequenceKey].sourceReceiptIds.push(sourceId);
    for (const feature of features) negativeSequences[sequenceKey].featureCounts[feature] = (negativeSequences[sequenceKey].featureCounts[feature] || 0) + 1;
  }

  for (const session of sessions) {
    const eligibility = eligibleSession(session);
    if (!eligibility.ok) {
      refused.push({ reasoningSessionId: session && session.reasoningSessionId || null, reason: eligibility.reason });
      continue;
    }
    const features = extractFeatures(session);
    features.forEach(feature => vocabulary.add(feature));
    const strategyTags = Array.from(new Set(eligibility.selected.strategyTags.map(token).filter(Boolean)));
    const selectedEvaluation = session.principleTrace.candidates.find(item => item.action.id === session.pathSet.selectedActionId);
    const selectedAction = selectedEvaluation && selectedEvaluation.action;
    if (!selectedAction) {
      refused.push({ reasoningSessionId: session.reasoningSessionId, reason: 'selected action missing from Principle trace' });
      continue;
    }
    const prototype = {
      kind: ['ask', 'observe', 'hold'].includes(selectedAction.kind) ? selectedAction.kind : 'ask',
      approach: eligibility.selected.approach,
      estimatedCost: eligibility.selected.estimatedCost,
      informationValue: eligibility.selected.informationValue,
      reversible: true,
      risk: 'low',
      toolRequestRequired: !!eligibility.selected.toolRequest,
      failureConditions: eligibility.selected.failureConditions || [],
      boundary: 'Learned prototypes may originate only non-mutating ask, observe, or hold candidates.'
    };
    positive(strategyTags, features, prototype, session.reasoningSessionId);
    sources.push({
      sourceKind: 'VERIFIED_CONSOLIDATION_SESSION',
      sourceId: session.reasoningSessionId,
      reasoningSessionId: session.reasoningSessionId,
      consolidationDigest: session.consolidation.proposalDigest,
      outcomeEvidenceRefs: session.verification.finalOutcome.evidenceRefs,
      usePermission: session.verification.finalOutcome.usePermission,
      permissionBasis: session.verification.finalOutcome.permissionBasis,
      strategyTags
    });
  }

  const experienceReceipts = Array.isArray(options.experienceReceipts) ? options.experienceReceipts : [];
  for (const receipt of experienceReceipts) {
    const example = receipt && receipt.trainingExample;
    if (!receipt || !['axm.mirror.reasoning-experience-receipt/v2', 'axm.mirror.reasoning-experience-receipt/v3', 'axm.mirror.reasoning-experience-receipt/v4', 'axm.mirror.reasoning-experience-receipt/v5'].includes(receipt.schema) || !example ||
        !['WORKED', 'DID_NOT_WORK'].includes(example.outcome) || !Array.isArray(example.features) || !example.features.length ||
        !Array.isArray(example.strategyTags) || !example.strategyTags.length || example.semanticConsolidation !== false) {
      refused.push({ reasoningExperienceReceiptId: receipt && receipt.receiptId || null, reason: 'invalid episodic reasoning training example' });
      continue;
    }
    const features = Array.from(new Set(example.features.map(item => clean(item, 200)).filter(Boolean))).sort();
    const strategyTags = Array.from(new Set(example.strategyTags.map(token).filter(Boolean)));
    features.forEach(feature => vocabulary.add(feature));
    if (example.outcome === 'WORKED') {
      if (!example.prototype || !['ask', 'observe', 'hold'].includes(example.prototype.kind)) {
        refused.push({ reasoningExperienceReceiptId: receipt.receiptId, reason: 'worked episodic example lacks a safe prototype' });
        continue;
      }
      positive(strategyTags, features, example.prototype, receipt.receiptId);
    } else {
      negative(strategyTags, features, receipt.receiptId);
    }
    sources.push({
      sourceKind: example.outcome === 'WORKED' ? 'POSITIVE_EPISODIC_EXPERIENCE' : 'NEGATIVE_EPISODIC_EXPERIENCE',
      experienceKind: receipt.source && receipt.source.experienceKind || 'REAL_LOCAL_LESSON',
      sourceId: receipt.receiptId,
      reasoningSessionId: receipt.reasoningSession && receipt.reasoningSession.reasoningSessionId || null,
      reasoningExperienceReceiptId: receipt.receiptId,
      evaluatorId: receipt.source && receipt.source.evaluator && receipt.source.evaluator.id || null,
      evaluatorSourceDigest: receipt.source && receipt.source.evaluator && receipt.source.evaluator.sourceDigest || null,
      usePermission: receipt.source && receipt.source.usePermission,
      permissionBasis: receipt.source && receipt.source.permissionBasis,
      strategyTags
    });
  }
  if (!sources.length) throw new Error('reasoning strategy training requires at least one review-eligible verified session');
  for (const row of Object.values(labels)) {
    row.sourceSessionIds.sort();
    row.featureCounts = stable(row.featureCounts);
    row.prototypeCandidates = stable(row.prototypeCandidates);
    row.prototype = Object.entries(row.prototypeCandidates)
      .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))[0][1].prototype;
  }
  for (const row of Object.values(sequences)) {
    row.sourceSessionIds.sort();
    row.featureCounts = stable(row.featureCounts);
    row.prototypeCandidates = stable(row.prototypeCandidates);
    row.prototype = Object.entries(row.prototypeCandidates)
      .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))[0][1].prototype;
  }
  for (const row of Object.values(negativeLabels).concat(Object.values(negativeSequences))) {
    row.sourceReceiptIds.sort();
    row.featureCounts = stable(row.featureCounts);
  }
  const model = {
    schema: SCHEMA,
    modelId: null,
    status: 'PRIVATE_CHALLENGER',
    createdAt: clean(options.at, 80) || null,
    featurePolicy: 'structural-state-only-no-goal-word-features',
    featureVocabulary: Array.from(vocabulary).sort(),
    labels: stable(labels),
    sequences: stable(sequences),
    negativeLabels: stable(negativeLabels),
    negativeSequences: stable(negativeSequences),
    training: {
      suppliedSessions: sessions.length,
      suppliedExperienceReceipts: experienceReceipts.length,
      admittedSessions: sources.filter(item => item.sourceKind === 'VERIFIED_CONSOLIDATION_SESSION').length,
      admittedPositiveExperiences: sources.filter(item => item.sourceKind === 'POSITIVE_EPISODIC_EXPERIENCE').length,
      admittedNegativeExperiences: sources.filter(item => item.sourceKind === 'NEGATIVE_EPISODIC_EXPERIENCE').length,
      admittedRealLocalExperiences: sources.filter(item => item.experienceKind === 'REAL_LOCAL_LESSON').length,
      admittedSyntheticCounterexamples: sources.filter(item => item.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE').length,
      admittedContractDerivedExams: sources.filter(item => item.experienceKind === 'CONTRACT_DERIVED_EXAM').length,
      admittedExamples: sources.length,
      refusedSessions: refused,
      labelObservations: Object.values(labels).reduce((sum, item) => sum + item.examples, 0),
      negativeLabelObservations: Object.values(negativeLabels).reduce((sum, item) => sum + item.examples, 0),
      sourceLineage: sources.sort((a, b) => a.sourceId.localeCompare(b.sourceId))
    },
    authority: {
      activeRuntime: false,
      toolUse: false,
      permissionGrant: false,
      memoryWrite: false,
      canonChange: false,
      identityChange: false,
      selfPromotion: false
    },
    boundary: 'This model learns positive and negative associations between structural problem features and arbitrary strategy tags. Review-eligible consolidation, real local episodes, parent-linked synthetic counterexamples, and typed contract-derived exams remain distinct evidence classes. Generated practice cannot impersonate a real-world outcome. This is a private challenger, not semantic truth or active reasoning authority.'
  };
  model.modelId = `reasoning-strategy-${digest(model, 24)}`;
  model.modelDigest = digest(model);
  return model;
}

function predict(model, features) {
  verify(model);
  const present = new Set(Array.isArray(features) ? features : []);
  function rank(records, negativeRecords, mapper) {
    const entries = Object.entries(records);
    const totalExamples = entries.reduce((sum, entry) => sum + Number(entry[1].examples || 0), 0);
    const raw = entries.map(([label, record]) => {
      const examples = Number(record.examples || 0);
      let logScore = Math.log((examples + 1) / (totalExamples + entries.length));
      for (const feature of model.featureVocabulary) {
        const probability = ((record.featureCounts[feature] || 0) + 1) / (examples + 2);
        logScore += present.has(feature) ? Math.log(probability) : Math.log(1 - probability);
      }
      const negative = negativeRecords[label] || null;
      let negativeFeaturePenalty = 0;
      if (negative) {
        const negativeExamples = Math.max(1, Number(negative.examples || 0));
        let matched = 0;
        for (const feature of present) matched += Math.min(1, Number(negative.featureCounts[feature] || 0) / negativeExamples);
        negativeFeaturePenalty = Number(((matched / Math.max(1, present.size)) * Math.log1p(negativeExamples) * 6).toFixed(8));
        logScore -= negativeFeaturePenalty;
      }
      return { key: label, record, logScore, negativeExamples: negative ? Number(negative.examples || 0) : 0, negativeFeaturePenalty };
    });
    const maximum = Math.max(...raw.map(item => item.logScore));
    const exponentials = raw.map(item => Math.exp(item.logScore - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
    return raw.map((item, index) => mapper(item.key, item.record, Number((exponentials[index] / total).toFixed(8)), item.negativeExamples, item.negativeFeaturePenalty))
      .sort((left, right) => right.support - left.support || JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  const rankings = rank(model.labels, model.negativeLabels, (label, _record, support, negativeEvidenceExamples, negativeFeaturePenalty) => ({
    strategyTag: label, support, negativeEvidenceExamples, negativeFeaturePenalty, operationalSupportNotProbabilityOfTruth: true
  }));
  const sequenceRankings = rank(model.sequences || {}, model.negativeSequences, (sequenceKey, record, support, negativeEvidenceExamples, negativeFeaturePenalty) => ({
    sequenceKey,
    strategyTags: record.strategyTags,
    support,
    negativeEvidenceExamples,
    negativeFeaturePenalty,
    operationalSupportNotProbabilityOfTruth: true
  }));
  return {
    schema: 'axm.mirror.reasoning-strategy-prediction/v1',
    modelId: model.modelId,
    modelDigest: model.modelDigest,
    features: Array.from(present).sort(),
    rankings,
    sequenceRankings,
    authority: 'ADVISORY_PRIVATE_CHALLENGER'
  };
}

function supportForTags(prediction, tags) {
  const wanted = new Set((Array.isArray(tags) ? tags : []).map(token).filter(Boolean));
  return prediction.rankings.filter(item => wanted.has(item.strategyTag)).reduce((sum, item) => sum + item.support, 0);
}

function supportForSequence(prediction, tags) {
  const key = (Array.isArray(tags) ? tags : []).map(token).filter(Boolean).join('>then>');
  const row = (prediction.sequenceRankings || []).find(item => item.sequenceKey === key);
  return row ? row.support : 0;
}

module.exports = { SCHEMA, digest, extractFeatures, observableStrategyTags, eligibleSession, train, verify, predict, supportForTags, supportForSequence };
