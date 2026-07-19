'use strict';

const fs = require('fs');
const path = require('path');
const Stewardship = require('../organs/cognitive-resource-economics-stewardship-organ');

try {
  const input = process.argv[2];
  if (!input) throw new Error('usage: node scripts/seal-cognitive-resource-economics-profile.js <profile-draft.json>');
  const draft = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const result = Stewardship.intakeProfile(draft);
  process.stdout.write(JSON.stringify({
    ok: true,
    state: result.state,
    profileId: result.profile.profileId,
    profileDigest: result.profile.profileDigest,
    estimateEligible: result.profile.assessment.estimateEligible,
    issues: result.profile.assessment.issues,
    rateEvidenceClass: result.profile.assessment.rateEvidenceClass,
    billedCostClaims: 0,
    measuredCostClaims: 0,
    calibratedCostClaims: 0,
    selections: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`COGNITIVE-RESOURCE ECONOMICS PROFILE REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
