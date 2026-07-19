'use strict';

const SCHEMA = 'axm.mirror.language-model/count-smoothed-transition-v2';

function randomGenerator(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function probabilities(weights, vocabSize, previous, scratch) {
  const output = scratch || new Float64Array(vocabSize);
  const row = previous * vocabSize;
  let maximum = -Infinity;
  for (let token = 0; token < vocabSize; token += 1) maximum = Math.max(maximum, weights[row + token]);
  let sum = 0;
  for (let token = 0; token < vocabSize; token += 1) {
    output[token] = Math.exp(weights[row + token] - maximum);
    sum += output[token];
  }
  for (let token = 0; token < vocabSize; token += 1) output[token] /= sum;
  return output;
}

function pairs(sequences, bos, eos) {
  const output = [];
  for (const input of sequences) {
    const sequence = [bos, ...input, eos];
    for (let i = 1; i < sequence.length; i += 1) output.push([sequence[i - 1], sequence[i]]);
  }
  return output;
}

function evaluate(model, weights, sequences) {
  const observations = pairs(sequences, model.bos, model.eos);
  const scratch = new Float64Array(model.vocabSize);
  let negativeLogLikelihood = 0;
  for (const [previous, target] of observations) {
    const p = probabilities(weights, model.vocabSize, previous, scratch);
    negativeLogLikelihood -= Math.log(Math.max(1e-12, p[target]));
  }
  return {
    tokenCount: observations.length,
    negativeLogLikelihood,
    perplexity: observations.length ? Math.exp(negativeLogLikelihood / observations.length) : null
  };
}

function train(sequences, options) {
  options = options || {};
  const vocabSize = Math.max(2, Number(options.vocabSize) || 0);
  const bos = Number(options.bos);
  const eos = Number(options.eos);
  const smoothingAlpha = Math.max(0.0001, Math.min(10, Number(options.smoothingAlpha) || 0.05));
  if (!Number.isInteger(bos) || !Number.isInteger(eos) || bos >= vocabSize || eos >= vocabSize) throw new Error('neural transition model requires bounded BOS and EOS ids');
  const observations = pairs(sequences, bos, eos);
  if (!observations.length) throw new Error('neural transition training requires token sequences');
  const counts = new Float64Array(vocabSize * vocabSize);
  const totals = new Float64Array(vocabSize);
  for (const [previous, target] of observations) {
    counts[previous * vocabSize + target] += 1;
    totals[previous] += 1;
  }
  const weights = new Float32Array(vocabSize * vocabSize);
  let observedRows = 0;
  for (let previous = 0; previous < vocabSize; previous += 1) {
    if (totals[previous]) observedRows += 1;
    const denominator = totals[previous] + smoothingAlpha * vocabSize;
    const row = previous * vocabSize;
    for (let token = 0; token < vocabSize; token += 1) {
      weights[row + token] = Math.log((counts[row + token] + smoothingAlpha) / denominator);
    }
  }
  const model = {
    schema: SCHEMA,
    vocabSize,
    bos,
    eos,
    architecture: 'count-smoothed-one-token-transition',
    parameterCount: weights.length,
    weightEncoding: 'float32-little-endian-row-major',
    training: {
      method: 'count-smoothed-maximum-likelihood',
      smoothingAlpha,
      tokenCount: observations.length,
      observedRows,
      randomInitialization: false,
      gradientEpochs: 0
    }
  };
  const fitted = evaluate(model, weights, sequences);
  model.training.meanNegativeLogLikelihood = fitted.negativeLogLikelihood / fitted.tokenCount;
  model.training.trainingPerplexity = fitted.perplexity;
  return { model, weights };
}

function sample(model, weights, promptTokens, options) {
  options = options || {};
  const output = Array.isArray(promptTokens) ? promptTokens.slice() : [];
  let previous = output.length ? output[output.length - 1] : model.bos;
  const random = randomGenerator(options.seed || 1);
  const scratch = new Float64Array(model.vocabSize);
  const maxNewTokens = Math.max(1, Math.min(4096, Number(options.maxNewTokens) || 128));
  for (let step = 0; step < maxNewTokens; step += 1) {
    const p = probabilities(weights, model.vocabSize, previous, scratch);
    let cursor = random();
    let next = model.eos;
    for (let token = 0; token < model.vocabSize; token += 1) {
      cursor -= p[token];
      if (cursor <= 0) { next = token; break; }
    }
    if (next === model.eos) break;
    output.push(next);
    previous = next;
  }
  return output;
}

function weightsToBuffer(weights) {
  return Buffer.from(weights.buffer, weights.byteOffset, weights.byteLength);
}

function weightsFromBuffer(buffer, parameterCount) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength !== parameterCount * 4) throw new Error('neural transition weight size mismatch');
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, parameterCount);
}

module.exports = { SCHEMA, train, evaluate, sample, weightsToBuffer, weightsFromBuffer };
