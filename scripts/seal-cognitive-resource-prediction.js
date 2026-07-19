'use strict';

const fs = require('fs');
const path = require('path');
const Stewardship = require('../organs/cognitive-resource-calibration-stewardship-organ');

try {
  const input = process.argv[2];
  if (!input) throw new Error('usage: node scripts/seal-cognitive-resource-prediction.js <prediction-draft.json>');
  const draft = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const result = Stewardship.sealPrediction(draft);
  process.stdout.write(JSON.stringify({
    ok: true,
    state: result.state,
    predictionId: result.prediction.predictionId,
    calibrationKey: result.prediction.calibrationKey,
    chronologyState: result.prediction.assessment.chronologyState,
    externalTimeCertified: false,
    calibrationClaims: 0,
    selections: 0,
    trainingAdmissions: 0,
    promotions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`COGNITIVE-RESOURCE PREDICTION REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
