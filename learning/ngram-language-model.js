'use strict';

const SCHEMA = 'axm.mirror.language-model/ngram-v1';

function keyOf(context) { return context.join(','); }

function train(sequences, options) {
  options = options || {};
  const order = Math.max(2, Math.min(6, Number(options.order) || 3));
  const bos = Number(options.bos);
  const eos = Number(options.eos);
  if (!Number.isInteger(bos) || !Number.isInteger(eos)) throw new Error('ngram training requires BOS and EOS token ids');
  const counts = Object.create(null);
  const unigram = Object.create(null);
  let tokenCount = 0;
  for (const input of (Array.isArray(sequences) ? sequences : [])) {
    const sequence = [...Array(order - 1).fill(bos), ...(Array.isArray(input) ? input : []), eos];
    for (let i = order - 1; i < sequence.length; i += 1) {
      const context = sequence.slice(i - order + 1, i);
      const next = sequence[i];
      const key = keyOf(context);
      if (!counts[key]) counts[key] = Object.create(null);
      counts[key][next] = (counts[key][next] || 0) + 1;
      unigram[next] = (unigram[next] || 0) + 1;
      tokenCount += 1;
    }
  }
  if (!tokenCount) throw new Error('ngram training requires token sequences');
  return { schema: SCHEMA, order, bos, eos, tokenCount, counts, unigram };
}

function distribution(model, context) {
  const width = model.order - 1;
  const padded = [...Array(Math.max(0, width - context.length)).fill(model.bos), ...context.slice(-width)];
  return model.counts[keyOf(padded)] || model.unigram;
}

function choose(distributionMap, randomValue) {
  const entries = Object.entries(distributionMap).map(([token, count]) => [Number(token), Number(count)]).sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  let cursor = Math.max(0, Math.min(0.999999999, randomValue)) * total;
  for (const entry of entries) {
    cursor -= entry[1];
    if (cursor < 0) return entry[0];
  }
  return entries[entries.length - 1][0];
}

function rng(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function generate(model, promptTokens, options) {
  if (!model || model.schema !== SCHEMA) throw new Error('invalid AXM ngram model');
  options = options || {};
  const output = Array.isArray(promptTokens) ? promptTokens.slice() : [];
  const random = rng(options.seed || 1);
  const maxNewTokens = Math.max(1, Math.min(4096, Number(options.maxNewTokens) || 128));
  for (let i = 0; i < maxNewTokens; i += 1) {
    const next = choose(distribution(model, output), random());
    if (next === model.eos) break;
    output.push(next);
  }
  return output;
}

function evaluate(model, sequences) {
  let negativeLogLikelihood = 0;
  let tokenCount = 0;
  const vocabulary = Math.max(1, Object.keys(model.unigram).length);
  for (const input of (Array.isArray(sequences) ? sequences : [])) {
    const sequence = [...Array(model.order - 1).fill(model.bos), ...input, model.eos];
    for (let i = model.order - 1; i < sequence.length; i += 1) {
      const observed = sequence[i];
      const dist = distribution(model, sequence.slice(0, i));
      const total = Object.values(dist).reduce((sum, count) => sum + Number(count), 0);
      const probability = ((dist[observed] || 0) + 1) / (total + vocabulary);
      negativeLogLikelihood -= Math.log(probability);
      tokenCount += 1;
    }
  }
  return { tokenCount, negativeLogLikelihood, perplexity: tokenCount ? Math.exp(negativeLogLikelihood / tokenCount) : null };
}

module.exports = { SCHEMA, train, generate, evaluate };
