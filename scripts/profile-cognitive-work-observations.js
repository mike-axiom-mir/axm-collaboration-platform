'use strict';

const Stewardship = require('../organs/cognitive-resource-stewardship-organ');

try {
  const comparisonKey = process.argv[2];
  if (!comparisonKey) throw new Error('usage: node scripts/profile-cognitive-work-observations.js <comparison-key>');
  const result = Stewardship.profile(comparisonKey);
  process.stdout.write(JSON.stringify({
    ok: true,
    profileId: result.profile.profileId,
    state: result.profile.state,
    calibration: result.profile.calibration,
    source: result.profile.source,
    outcomes: result.profile.outcomes,
    resources: result.profile.resources,
    forecastClaims: 0,
    selections: 0,
    promotions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`COGNITIVE-RESOURCE PROFILE REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
