'use strict';

const fs = require('fs');
const path = require('path');
const Stewardship = require('../organs/cognitive-resource-stewardship-organ');

try {
  const input = process.argv[2];
  if (!input) throw new Error('usage: node scripts/record-cognitive-work-observation.js <draft.json>');
  const draft = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const result = Stewardship.intake(draft);
  process.stdout.write(JSON.stringify({
    ok: true,
    state: result.state,
    observationId: result.observation.observationId,
    comparisonKey: result.observation.comparisonKey,
    resourceProfileEligible: result.observation.assessment.resourceProfileEligible,
    issues: result.observation.assessment.issues,
    forecastClaims: 0,
    selections: 0,
    trainingAdmissions: 0,
    promotions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`COGNITIVE-WORK OBSERVATION REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
