'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tokenizer = require('../learning/native-tokenizer');
const ngram = require('../learning/ngram-language-model');
const neural = require('../learning/neural-transition-model');
const hierarchical = require('../learning/hierarchical-context-language-model');

const documents = [
  'observe → model → compare → verify → repair',
  'truth before story; permission before action; evidence before promotion',
  'mens en machine werken samen — eerlijk, zichtbaar, herstelbaar'
];

test('AXM tokenizer round-trips UTF-8 without an external vocabulary', () => {
  const model = tokenizer.train(documents, { vocabSize: 320, minFrequency: 2 });
  for (const text of documents) assert.equal(tokenizer.decode(model, tokenizer.encode(model, text)), text);
  assert.equal(model.encoding, 'utf-8-byte-fallback');
});

test('tokenizer training is deterministic and inspectable', () => {
  const left = tokenizer.train(documents, { vocabSize: 320, minFrequency: 2 });
  const right = tokenizer.train(documents, { vocabSize: 320, minFrequency: 2 });
  assert.deepEqual(left, right);
  assert.ok(left.merges.every(merge => Number.isInteger(merge.left) && Number.isInteger(merge.right)));
});

test('dependency-free ngram rung learns and emits tokens deterministically', () => {
  const tokenModel = tokenizer.train(documents, { vocabSize: 320, minFrequency: 2 });
  const sequences = documents.map(text => tokenizer.encode(tokenModel, text));
  const languageModel = ngram.train(sequences, { order: 3, bos: tokenizer.SPECIAL.BOS, eos: tokenizer.SPECIAL.EOS });
  const prompt = tokenizer.encode(tokenModel, 'observe');
  const a = ngram.generate(languageModel, prompt, { seed: 42, maxNewTokens: 20 });
  const b = ngram.generate(languageModel, prompt, { seed: 42, maxNewTokens: 20 });
  assert.deepEqual(a, b);
  assert.ok(ngram.evaluate(languageModel, sequences).perplexity >= 1);
});

test('AXM count-smoothed transition rung creates reloadable learned weights', () => {
  const tokenModel = tokenizer.train(documents, { vocabSize: 320, minFrequency: 2 });
  const sequences = documents.map(text => tokenizer.encode(tokenModel, text));
  const run = neural.train(sequences, { vocabSize: tokenModel.vocabSize, bos: tokenizer.SPECIAL.BOS, eos: tokenizer.SPECIAL.EOS, smoothingAlpha: 0.05 });
  assert.equal(run.model.parameterCount, tokenModel.vocabSize * tokenModel.vocabSize);
  assert.equal(run.model.training.method, 'count-smoothed-maximum-likelihood');
  assert.equal(run.model.training.randomInitialization, false);
  assert.ok(run.model.training.trainingPerplexity < tokenModel.vocabSize);
  const restored = neural.weightsFromBuffer(neural.weightsToBuffer(run.weights), run.model.parameterCount);
  assert.deepEqual(Array.from(restored.slice(0, 32)), Array.from(run.weights.slice(0, 32)));
  assert.deepEqual(neural.sample(run.model, restored, [], { seed: 9, maxNewTokens: 12 }), neural.sample(run.model, run.weights, [], { seed: 9, maxNewTokens: 12 }));
  const repeated = neural.train(sequences, { vocabSize: tokenModel.vocabSize, bos: tokenizer.SPECIAL.BOS, eos: tokenizer.SPECIAL.EOS, smoothingAlpha: 0.05 });
  assert.deepEqual(neural.weightsToBuffer(repeated.weights), neural.weightsToBuffer(run.weights));
});

test('AXM hierarchical context rung learns sparse backoff state and reloads deterministically', () => {
  const tokenModel = tokenizer.train(documents, { vocabSize: 320, minFrequency: 2 });
  const sequences = documents.map(text => tokenizer.encode(tokenModel, text));
  const run = hierarchical.train(sequences, {
    vocabSize: tokenModel.vocabSize,
    bos: tokenizer.SPECIAL.BOS,
    eos: tokenizer.SPECIAL.EOS,
    order: 3,
    unigramSmoothingAlpha: 0.5
  });
  assert.equal(run.model.schema, hierarchical.SCHEMA);
  assert.equal(run.model.architecture, 'sparse-hierarchical-witten-bell-context-transition');
  assert.ok(run.model.parameterCount < tokenModel.vocabSize * tokenModel.vocabSize);
  assert.equal(run.model.training.randomInitialization, false);
  assert.ok(run.model.training.trainingPerplexity >= 1);
  const bytes = hierarchical.weightsToBuffer(run.weights);
  const restored = hierarchical.weightsFromBuffer(bytes, run.model.parameterCount);
  assert.deepEqual(Array.from(restored), Array.from(run.weights));
  assert.deepEqual(
    hierarchical.sample(run.model, restored, [], { seed: 19, maxNewTokens: 20 }),
    hierarchical.sample(run.model, run.weights, [], { seed: 19, maxNewTokens: 20 })
  );
  const repeated = hierarchical.train(sequences, {
    vocabSize: tokenModel.vocabSize,
    bos: tokenizer.SPECIAL.BOS,
    eos: tokenizer.SPECIAL.EOS,
    order: 3,
    unigramSmoothingAlpha: 0.5
  });
  assert.deepEqual(repeated.model, run.model);
  assert.deepEqual(hierarchical.weightsToBuffer(repeated.weights), bytes);
});
