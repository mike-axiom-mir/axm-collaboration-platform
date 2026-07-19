'use strict';

const crypto = require('crypto');

const SCHEMA = 'axm.mirror.typed-trace-language-model/v1';
const FEATURES = Object.freeze([
  'decision',
  'unknowns',
  'contradictions',
  'boundaryViolation',
  'missingEvidence',
  'repairabilityGap'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function cleanToken(value, field) {
  const token = String(value == null ? '' : value).trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(token)) throw new Error(`${field} requires a bounded machine token`);
  return token;
}

function normalizeFeatures(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('typed trace language features must be an object');
  const unknown = Object.keys(value).filter(key => !FEATURES.includes(key));
  if (unknown.length) throw new Error(`unknown typed trace language features: ${unknown.join(', ')}`);
  const out = {};
  for (const feature of FEATURES) out[feature] = cleanToken(value[feature], `features.${feature}`);
  return out;
}

function normalizeExample(example, index) {
  if (!example || typeof example !== 'object') throw new Error(`example ${index} must be an object`);
  if (example.usePermission !== 'allowed' || !String(example.permissionBasis || '').trim()) {
    throw new Error(`example ${index} lacks explicit training permission`);
  }
  const split = cleanToken(example.split, `examples[${index}].split`);
  if (!['TRAIN', 'HELD_OUT'].includes(split)) throw new Error(`example ${index} has unsupported split ${split}`);
  return {
    id: String(example.id || `example-${index + 1}`).trim(),
    groupId: String(example.groupId || '').trim(),
    split,
    features: normalizeFeatures(example.features),
    expectedPlanId: cleanToken(example.expectedPlanId, `examples[${index}].expectedPlanId`)
  };
}

function normalizeExamples(examples) {
  if (!Array.isArray(examples) || !examples.length) throw new Error('typed trace language training requires examples');
  const normalized = examples.map(normalizeExample);
  const ids = new Set();
  for (const example of normalized) {
    if (!example.id || ids.has(example.id)) throw new Error(`duplicate or empty example id: ${example.id || '(empty)'}`);
    if (!example.groupId) throw new Error(`example ${example.id} requires groupId`);
    ids.add(example.id);
  }
  const trainGroups = new Set(normalized.filter(item => item.split === 'TRAIN').map(item => item.groupId));
  const overlap = normalized.filter(item => item.split === 'HELD_OUT' && trainGroups.has(item.groupId)).map(item => item.groupId);
  if (overlap.length) throw new Error(`held-out group leakage: ${Array.from(new Set(overlap)).join(', ')}`);
  return normalized;
}

function seal(model) {
  const basis = stable(Object.assign({}, model));
  delete basis.modelDigest;
  return Object.assign({}, basis, { modelDigest: digest(basis) });
}

function assertModel(model) {
  if (!model || model.schema !== SCHEMA) throw new Error('invalid typed trace language model schema');
  if (!Array.isArray(model.features) || JSON.stringify(model.features) !== JSON.stringify(FEATURES)) throw new Error('typed trace language model feature contract changed');
  if (!Array.isArray(model.labels) || !model.labels.length || !model.classCounts || !model.valueCounts || !model.featureVocabulary) throw new Error('typed trace language model is incomplete');
  const expected = seal(model).modelDigest;
  if (model.modelDigest !== expected) throw new Error('typed trace language model digest mismatch');
}

function train(examples, options = {}) {
  const normalized = normalizeExamples(examples);
  const rows = normalized.filter(item => item.split === 'TRAIN');
  if (!rows.length) throw new Error('typed trace language model requires TRAIN examples');
  const alpha = Number(options.alpha == null ? 0.5 : options.alpha);
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 10) throw new Error('alpha must be in (0, 10]');
  const labels = Array.from(new Set(rows.map(item => item.expectedPlanId))).sort();
  const classCounts = Object.fromEntries(labels.map(label => [label, 0]));
  const valueCounts = Object.fromEntries(labels.map(label => [label, Object.fromEntries(FEATURES.map(feature => [feature, {}]))]));
  const featureVocabulary = Object.fromEntries(FEATURES.map(feature => [feature, []]));
  for (const row of rows) {
    classCounts[row.expectedPlanId] += 1;
    for (const feature of FEATURES) {
      const value = row.features[feature];
      const counts = valueCounts[row.expectedPlanId][feature];
      counts[value] = (counts[value] || 0) + 1;
      if (!featureVocabulary[feature].includes(value)) featureVocabulary[feature].push(value);
    }
  }
  for (const feature of FEATURES) featureVocabulary[feature].sort();
  return seal({
    schema: SCHEMA,
    architecture: 'laplace-smoothed-categorical-surface-plan-classifier',
    features: Array.from(FEATURES),
    labels,
    alpha,
    classCounts,
    valueCounts,
    featureVocabulary,
    training: {
      exampleCount: rows.length,
      groupCount: new Set(rows.map(item => item.groupId)).size,
      randomInitialization: false,
      gradientEpochs: 0,
      method: 'supervised-categorical-maximum-likelihood-with-laplace-smoothing',
      claimBoundary: 'Posterior scores rank learned surface plans. They are not probabilities of truth, safety, permission, or correctness.'
    },
    authority: {
      factPromotion: false,
      decisionChange: false,
      permissionGrant: false,
      toolUse: false,
      memoryWrite: false,
      trainingAdmission: false,
      runtimePromotion: false
    }
  });
}

function predict(model, features) {
  assertModel(model);
  const input = normalizeFeatures(features);
  const totalRows = Object.values(model.classCounts).reduce((sum, count) => sum + Number(count), 0);
  const classDenominator = totalRows + model.alpha * model.labels.length;
  const logs = model.labels.map(label => {
    let logScore = Math.log((model.classCounts[label] + model.alpha) / classDenominator);
    for (const feature of FEATURES) {
      const vocabularySize = model.featureVocabulary[feature].length + 1;
      const count = Number(model.valueCounts[label][feature][input[feature]] || 0);
      const denominator = model.classCounts[label] + model.alpha * vocabularySize;
      logScore += Math.log((count + model.alpha) / denominator);
    }
    return { planId: label, logScore };
  });
  const maximum = Math.max(...logs.map(item => item.logScore));
  let sum = 0;
  for (const item of logs) {
    item.score = Math.exp(item.logScore - maximum);
    sum += item.score;
  }
  const ranked = logs.map(item => ({
    planId: item.planId,
    probability: Number((item.score / sum).toFixed(12))
  })).sort((left, right) => right.probability - left.probability || left.planId.localeCompare(right.planId));
  return {
    planId: ranked[0].planId,
    confidence: ranked[0].probability,
    margin: Number((ranked[0].probability - (ranked[1] ? ranked[1].probability : 0)).toFixed(12)),
    distribution: ranked,
    boundary: model.training.claimBoundary
  };
}

function evaluate(model, examples) {
  const rows = normalizeExamples(examples).filter(item => item.split === 'HELD_OUT');
  if (!rows.length) throw new Error('typed trace language evaluation requires HELD_OUT examples');
  const results = rows.map(row => {
    const prediction = predict(model, row.features);
    return {
      id: row.id,
      groupId: row.groupId,
      expectedPlanId: row.expectedPlanId,
      predictedPlanId: prediction.planId,
      matched: prediction.planId === row.expectedPlanId,
      confidence: prediction.confidence,
      margin: prediction.margin
    };
  });
  const matched = results.filter(item => item.matched).length;
  return {
    exampleCount: results.length,
    matched,
    mismatched: results.length - matched,
    accuracy: Number((matched / results.length).toFixed(12)),
    minimumConfidence: Math.min(...results.map(item => item.confidence)),
    minimumMargin: Math.min(...results.map(item => item.margin)),
    results,
    boundary: 'Held-out surface-plan classification only. This does not measure general language, neutrality, wisdom, reasoning, or world truth.'
  };
}

module.exports = { SCHEMA, FEATURES, stable, digest, normalizeFeatures, train, predict, evaluate, assertModel, seal };
