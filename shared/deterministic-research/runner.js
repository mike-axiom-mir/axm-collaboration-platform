'use strict';

const Goals = require('./goal-normalizer');
const Scanner = require('./workshop-scanner');
const Classifier = require('./gap-classifier');
const Questions = require('./question-compiler');
const Hypotheses = require('./hypothesis-router');
const Experiments = require('./experiment-designer');
const Backlog = require('./backlog-ranker');
const Ledger = require('./evidence-ledger');
const Reports = require('./report-compiler');

function run(options) {
  options = options || {};
  const goal = options.goal && options.goal.schema === Goals.SCHEMA ? Goals.normalize(options.goal) : Goals.normalize(options.goal || {});
  const snapshot = Scanner.scan(options.root);
  const classified = Classifier.classify(goal, snapshot, options.includeWorkshopGaps);
  const questions = Questions.compile(classified.gaps);
  const hypotheses = Hypotheses.route(classified.gaps, snapshot);
  const experiments = Experiments.design(classified.gaps, questions, hypotheses);
  const backlog = Backlog.rank(classified.gaps, hypotheses, experiments);
  const ledger = Ledger.create(experiments);
  const report = Reports.compile({ observedAt: options.observedAt || new Date().toISOString(), goal, snapshot, classified, questions, hypotheses, experiments, backlog, ledger });
  return { report, markdown: Reports.markdown(report), inventory: snapshot, ledger };
}

module.exports = { run };
