'use strict';

module.exports = {
  Core: require('./core'),
  Goals: require('./goal-normalizer'),
  Scanner: require('./workshop-scanner'),
  Classifier: require('./gap-classifier'),
  Questions: require('./question-compiler'),
  Hypotheses: require('./hypothesis-router'),
  Experiments: require('./experiment-designer'),
  Backlog: require('./backlog-ranker'),
  Ledger: require('./evidence-ledger'),
  Reports: require('./report-compiler'),
  Runner: require('./runner')
};
