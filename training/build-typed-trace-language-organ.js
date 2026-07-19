'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');

const ROOT = path.resolve(__dirname, '..');
const CORPUS_PATH = path.join(__dirname, 'typed-trace-language-wisdom.json');
const OUT_DIR = path.join(ROOT, 'learned', 'language-trace-1');

function stable(value) { return LanguageModel.stable(value); }
function digestBytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(stable(value), null, 2) + '\n', 'utf8');
}

function loadCorpus(file = CORPUS_PATH) {
  const bytes = fs.readFileSync(file);
  const corpus = JSON.parse(bytes.toString('utf8'));
  if (corpus.schema !== 'axm.mirror.typed-trace-language-corpus/v1' || !Array.isArray(corpus.examples)) throw new Error('invalid typed trace language corpus');
  // Training performs the permission, split, group, feature, and label checks.
  LanguageModel.train(corpus.examples);
  return { corpus, sha256: digestBytes(bytes) };
}

function build(options = {}) {
  const loaded = loadCorpus(options.corpusPath || CORPUS_PATH);
  const model = LanguageModel.train(loaded.corpus.examples, { alpha: 0.5 });
  const heldOut = LanguageModel.evaluate(model, loaded.corpus.examples);
  const report = {
    schema: 'axm.mirror.typed-trace-language-training-report/v1',
    runId: `typed-trace-language-${model.modelDigest.slice(0, 20)}`,
    state: heldOut.mismatched === 0 ? 'TEST_HELD_OUT_SURFACE_PLAN_MATCH' : 'KNOWN_FAIL_HELD_OUT_SURFACE_PLAN_MISMATCH',
    corpus: {
      path: path.relative(ROOT, options.corpusPath || CORPUS_PATH).replace(/\\/g, '/'),
      sha256: loaded.sha256,
      statement: loaded.corpus.statement,
      claimBoundary: loaded.corpus.claimBoundary,
      trainingExamples: loaded.corpus.examples.filter(item => item.split === 'TRAIN').length,
      heldOutExamples: loaded.corpus.examples.filter(item => item.split === 'HELD_OUT').length,
      privateSources: 0,
      runtimeStateSources: 0,
      workshopSources: 0,
      hiddenReasoningSources: 0
    },
    model: {
      path: 'learned/language-trace-1/surface-plan-model.json',
      schema: model.schema,
      modelDigest: model.modelDigest,
      architecture: model.architecture,
      learnedWeights: true,
      runtimeAuthority: false
    },
    heldOut,
    authority: model.authority,
    acceptedAsRuntimeLanguageOrgan: false,
    nextGate: 'Evaluate trace-faithful shadow renderings on independent real typed traces, adversarial wording, distribution shift, and calibration before any runtime rendering proposal.',
    boundary: 'This is a real learned surface-plan rung over typed machine state. It is not a general language model, neutral oracle, reasoning authority, or runtime renderer.'
  };
  return { model, report };
}

function main() {
  const result = build();
  writeJson(path.join(OUT_DIR, 'surface-plan-model.json'), result.model);
  writeJson(path.join(OUT_DIR, 'report.json'), result.report);
  process.stdout.write(JSON.stringify(stable(result.report), null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { ROOT, CORPUS_PATH, OUT_DIR, loadCorpus, build, main };
