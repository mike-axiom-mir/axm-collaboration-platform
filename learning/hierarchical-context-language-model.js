'use strict';

const SCHEMA = 'axm.mirror.language-model/hierarchical-context-transition-v1';
const INDEX_CACHE = new WeakMap();

function randomGenerator(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function contextKey(context) { return context.join(','); }

function compareContext(left, right) {
  const width = left.length - right.length;
  if (width) return width;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function boundedOrder(value) {
  return Math.max(2, Math.min(6, Number(value) || 3));
}

function assertToken(token, vocabSize, label) {
  if (!Number.isInteger(token) || token < 0 || token >= vocabSize) throw new Error(`${label} is outside the model vocabulary`);
}

function assertModel(model, weights) {
  if (!model || model.schema !== SCHEMA || !Array.isArray(model.contextRows)) throw new Error('invalid hierarchical context model');
  if (!Number.isInteger(model.vocabSize) || model.vocabSize < 2) throw new Error('hierarchical context vocabulary changed');
  if (!Number.isInteger(model.order) || model.order < 2 || model.order > 6) throw new Error('hierarchical context order changed');
  assertToken(model.bos, model.vocabSize, 'BOS');
  assertToken(model.eos, model.vocabSize, 'EOS');
  if (!Number.isFinite(model.unigramSmoothingAlpha) || model.unigramSmoothingAlpha <= 0) throw new Error('hierarchical context smoothing changed');
  let expectedOffset = 0;
  let unigramRows = 0;
  const seen = new Set();
  for (const row of model.contextRows) {
    if (!row || !Number.isInteger(row.width) || row.width < 0 || row.width >= model.order) throw new Error('hierarchical context row width changed');
    if (!Array.isArray(row.context) || row.context.length !== row.width) throw new Error('hierarchical context row shape changed');
    for (const token of row.context) assertToken(token, model.vocabSize, 'context token');
    const id = `${row.width}|${contextKey(row.context)}`;
    if (seen.has(id)) throw new Error('duplicate hierarchical context row');
    seen.add(id);
    if (row.width === 0) unigramRows += 1;
    if (!Number.isInteger(row.offset) || row.offset !== expectedOffset) throw new Error('hierarchical context offset changed');
    if (!Number.isInteger(row.total) || row.total < 1) throw new Error('hierarchical context total changed');
    if (!Array.isArray(row.targets) || row.targets.length < 1 || row.distinctTargets !== row.targets.length) throw new Error('hierarchical context targets changed');
    let previous = -1;
    for (const token of row.targets) {
      assertToken(token, model.vocabSize, 'target token');
      if (token <= previous) throw new Error('hierarchical context targets are not canonical');
      previous = token;
    }
    expectedOffset += row.targets.length;
  }
  if (unigramRows !== 1 || !model.contextRows.length || model.contextRows[0].width !== 0) throw new Error('hierarchical context unigram row changed');
  if (model.parameterCount !== expectedOffset) throw new Error('hierarchical context parameter count changed');
  if (weights) {
    if (!(weights instanceof Float32Array) || weights.length !== model.parameterCount) throw new Error('hierarchical context weight size mismatch');
    for (let i = 0; i < weights.length; i += 1) {
      if (!Number.isFinite(weights[i]) || weights[i] <= 0) throw new Error('hierarchical context count changed');
    }
  }
}

function runtimeIndex(model) {
  let index = INDEX_CACHE.get(model);
  if (index) return index;
  assertModel(model);
  index = new Map();
  for (const row of model.contextRows) index.set(`${row.width}|${contextKey(row.context)}`, row);
  INDEX_CACHE.set(model, index);
  return index;
}

function targetCount(row, weights, target) {
  let low = 0;
  let high = row.targets.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const token = row.targets[middle];
    if (token === target) return weights[row.offset + middle];
    if (token < target) low = middle + 1;
    else high = middle - 1;
  }
  return 0;
}

function probability(model, weights, history, target) {
  assertToken(target, model.vocabSize, 'target token');
  const index = runtimeIndex(model);
  const unigram = index.get('0|');
  const alpha = model.unigramSmoothingAlpha;
  let result = (targetCount(unigram, weights, target) + alpha) / (unigram.total + alpha * model.vocabSize);
  for (let width = 1; width < model.order; width += 1) {
    if (history.length < width) break;
    const context = history.slice(-width);
    const row = index.get(`${width}|${contextKey(context)}`);
    if (!row) continue;
    const interpolation = row.total / (row.total + row.distinctTargets);
    const direct = targetCount(row, weights, target) / row.total;
    result = interpolation * direct + (1 - interpolation) * result;
  }
  return Math.max(1e-12, result);
}

function observations(sequences, order, bos, eos, vocabSize) {
  const output = [];
  for (const input of (Array.isArray(sequences) ? sequences : [])) {
    if (!Array.isArray(input)) throw new Error('hierarchical context training requires token arrays');
    for (const token of input) assertToken(token, vocabSize, 'training token');
    const sequence = [...Array(order - 1).fill(bos), ...input, eos];
    for (let i = order - 1; i < sequence.length; i += 1) output.push({ history: sequence.slice(0, i), target: sequence[i] });
  }
  return output;
}

function train(sequences, options) {
  options = options || {};
  const vocabSize = Math.max(2, Number(options.vocabSize) || 0);
  const bos = Number(options.bos);
  const eos = Number(options.eos);
  const order = boundedOrder(options.order);
  const unigramSmoothingAlpha = Math.max(0.0001, Math.min(10, Number(options.unigramSmoothingAlpha) || 0.5));
  if (!Number.isInteger(vocabSize)) throw new Error('hierarchical context model requires an integer vocabulary size');
  assertToken(bos, vocabSize, 'BOS');
  assertToken(eos, vocabSize, 'EOS');
  const events = observations(sequences, order, bos, eos, vocabSize);
  if (!events.length) throw new Error('hierarchical context training requires token sequences');

  const tables = Array.from({ length: order }, () => new Map());
  for (const event of events) {
    for (let width = 0; width < order; width += 1) {
      const normalized = width ? event.history.slice(-width) : [];
      const key = contextKey(normalized);
      let row = tables[width].get(key);
      if (!row) {
        row = { width, context: normalized, total: 0, counts: new Map() };
        tables[width].set(key, row);
      }
      row.total += 1;
      row.counts.set(event.target, (row.counts.get(event.target) || 0) + 1);
    }
  }

  const rawRows = tables.flatMap(table => Array.from(table.values())).sort((left, right) => compareContext(left.context, right.context));
  const values = [];
  const contextRows = rawRows.map(row => {
    const entries = Array.from(row.counts.entries()).sort((left, right) => left[0] - right[0]);
    const offset = values.length;
    for (const entry of entries) values.push(entry[1]);
    return {
      width: row.width,
      context: row.context,
      offset,
      total: row.total,
      distinctTargets: entries.length,
      targets: entries.map(entry => entry[0])
    };
  });
  const weights = Float32Array.from(values);
  const model = {
    schema: SCHEMA,
    vocabSize,
    bos,
    eos,
    order,
    architecture: 'sparse-hierarchical-witten-bell-context-transition',
    parameterCount: weights.length,
    countEncoding: 'float32-little-endian-canonical-sparse-row-counts',
    unigramSmoothingAlpha,
    contextRows,
    training: {
      method: 'hierarchical-witten-bell-backoff-maximum-likelihood',
      tokenCount: events.length,
      contextRowCount: contextRows.length,
      observedTransitions: weights.length,
      randomInitialization: false,
      gradientEpochs: 0
    }
  };
  assertModel(model, weights);
  const fitted = evaluate(model, weights, sequences);
  model.training.meanNegativeLogLikelihood = fitted.negativeLogLikelihood / fitted.tokenCount;
  model.training.trainingPerplexity = fitted.perplexity;
  return { model, weights };
}

function evaluate(model, weights, sequences) {
  assertModel(model, weights);
  const events = observations(sequences, model.order, model.bos, model.eos, model.vocabSize);
  let negativeLogLikelihood = 0;
  for (const event of events) negativeLogLikelihood -= Math.log(probability(model, weights, event.history, event.target));
  return {
    tokenCount: events.length,
    negativeLogLikelihood,
    perplexity: events.length ? Math.exp(negativeLogLikelihood / events.length) : null
  };
}

function sample(model, weights, promptTokens, options) {
  assertModel(model, weights);
  options = options || {};
  const output = Array.isArray(promptTokens) ? promptTokens.slice() : [];
  for (const token of output) assertToken(token, model.vocabSize, 'prompt token');
  const history = [...Array(model.order - 1).fill(model.bos), ...output];
  const random = randomGenerator(options.seed || 1);
  const maxNewTokens = Math.max(1, Math.min(4096, Number(options.maxNewTokens) || 128));
  const distribution = new Float64Array(model.vocabSize);
  for (let step = 0; step < maxNewTokens; step += 1) {
    let total = 0;
    for (let token = 0; token < model.vocabSize; token += 1) {
      distribution[token] = probability(model, weights, history, token);
      total += distribution[token];
    }
    let cursor = random() * total;
    let next = model.eos;
    for (let token = 0; token < model.vocabSize; token += 1) {
      cursor -= distribution[token];
      if (cursor <= 0) { next = token; break; }
    }
    if (next === model.eos) break;
    output.push(next);
    history.push(next);
  }
  return output;
}

function weightsToBuffer(weights) {
  if (!(weights instanceof Float32Array)) throw new Error('hierarchical context weights must be Float32Array');
  return Buffer.from(weights.buffer, weights.byteOffset, weights.byteLength);
}

function weightsFromBuffer(buffer, parameterCount) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength !== parameterCount * 4) throw new Error('hierarchical context weight size mismatch');
  const restored = new Float32Array(parameterCount);
  new Uint8Array(restored.buffer).set(buffer);
  return restored;
}

module.exports = { SCHEMA, train, evaluate, sample, probability, weightsToBuffer, weightsFromBuffer };
