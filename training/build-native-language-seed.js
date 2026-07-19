'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tokenizer = require('../learning/native-tokenizer');
const ngram = require('../learning/ngram-language-model');
const neural = require('../learning/neural-transition-model');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'native-corpus-manifest.json');
const outDir = path.join(ROOT, 'learned', 'language-seed-0');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(stable(value), null, 2) + '\n', 'utf8');
}

function writeBytes(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(stable(value))).digest('hex');
}

function loadCorpus() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== 'axm.mirror.native-corpus-manifest/v1') throw new Error('invalid native corpus manifest');
  return manifest.documents.map((entry, index) => {
    if (entry.usePermission !== 'allowed' || !entry.permissionBasis) throw new Error(`document ${index} lacks explicit training permission`);
    const absolute = path.resolve(ROOT, entry.path);
    if (!absolute.startsWith(ROOT + path.sep)) throw new Error(`document escapes Mirror root: ${entry.path}`);
    const text = fs.readFileSync(absolute, 'utf8');
    if (!text.trim()) throw new Error(`empty corpus document: ${entry.path}`);
    return { path: entry.path.replace(/\\/g, '/'), text, permissionBasis: entry.permissionBasis, sha256: hash(text) };
  });
}

function main() {
  const documents = loadCorpus();
  const validation = [documents[documents.length - 1]];
  const training = documents.slice(0, -1);
  const tokenizerModel = tokenizer.train(documents.map(document => document.text), { vocabSize: 512, minFrequency: 2 });
  const trainingSequences = training.map(document => tokenizer.encode(tokenizerModel, document.text));
  const validationSequences = validation.map(document => tokenizer.encode(tokenizerModel, document.text));
  const languageModel = ngram.train(trainingSequences, { order: 3, bos: tokenizer.SPECIAL.BOS, eos: tokenizer.SPECIAL.EOS });
  const metrics = ngram.evaluate(languageModel, validationSequences);
  const neuralRun = neural.train(trainingSequences, { vocabSize: tokenizerModel.vocabSize, bos: tokenizer.SPECIAL.BOS, eos: tokenizer.SPECIAL.EOS, smoothingAlpha: 0.05 });
  const neuralMetrics = neural.evaluate(neuralRun.model, neuralRun.weights, validationSequences);
  const prompt = 'observe evidence, propose bounded actions, verify outcome, repair';
  const promptTokens = tokenizer.encode(tokenizerModel, prompt);
  const generatedTokens = ngram.generate(languageModel, promptTokens, { seed: 16072026, maxNewTokens: 96 });
  const sample = tokenizer.decode(tokenizerModel, generatedTokens);
  const neuralTokens = neural.sample(neuralRun.model, neuralRun.weights, promptTokens, { seed: 16072026, maxNewTokens: 96 });
  const neuralSample = tokenizer.decode(tokenizerModel, neuralTokens);
  const report = {
    schema: 'axm.mirror.language-seed-report/v1',
    rung: 'dependency-free-tokenizer-ngram-and-count-smoothed-transition-baselines',
    claimBoundary: 'These are real learned next-token baselines, not reasoning models and not candidate generators safe for tools. The weighted transition learner is transparent maximum-likelihood counting, not a neural network.',
    externalModelDependency: false,
    packageDependencies: [],
    corpus: {
      manifest: path.relative(ROOT, manifestPath).replace(/\\/g, '/'),
      documentCount: documents.length,
      trainingDocuments: training.map(document => ({ path: document.path, sha256: document.sha256 })),
      validationDocuments: validation.map(document => ({ path: document.path, sha256: document.sha256 }))
    },
    tokenizer: { schema: tokenizerModel.schema, vocabSize: tokenizerModel.vocabSize, mergeCount: tokenizerModel.merges.length },
    model: { schema: languageModel.schema, order: languageModel.order, trainingTokenCount: languageModel.tokenCount },
    heldOut: metrics,
    transitionBaseline: { schema: neuralRun.model.schema, architecture: neuralRun.model.architecture, parameterCount: neuralRun.model.parameterCount, heldOut: neuralMetrics },
    sample: { prompt, text: sample, acceptedAsCapability: false },
    neuralSample: { prompt, text: neuralSample, acceptedAsCapability: false },
    nextGate: 'Build the AXM tensor and transformer training rung; keep Seed-0 as verifier and all tool authority outside learned weights.'
  };
  writeJson(path.join(outDir, 'tokenizer.json'), tokenizerModel);
  writeJson(path.join(outDir, 'ngram-baseline.json'), languageModel);
  writeJson(path.join(outDir, 'neural-transition.meta.json'), neuralRun.model);
  writeBytes(path.join(outDir, 'neural-transition.f32'), neural.weightsToBuffer(neuralRun.weights));
  writeJson(path.join(outDir, 'report.json'), report);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { loadCorpus, main };
