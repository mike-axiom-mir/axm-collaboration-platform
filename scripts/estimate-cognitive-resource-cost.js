'use strict';

const Stewardship = require('../organs/cognitive-resource-economics-stewardship-organ');

try {
  const sourceKind = process.argv[2];
  const sourceId = process.argv[3];
  const economicsProfileId = process.argv[4];
  if (!sourceKind || !sourceId || !economicsProfileId) {
    throw new Error('usage: node scripts/estimate-cognitive-resource-cost.js <observation|prediction> <source-id> <economics-profile-id>');
  }
  const result = Stewardship.estimate(sourceKind, sourceId, economicsProfileId);
  process.stdout.write(JSON.stringify({
    ok: true,
    state: result.estimate.assessment.state,
    estimateId: result.estimate.estimateId,
    estimateDigest: result.estimate.estimateDigest,
    source: result.estimate.source,
    totals: result.estimate.totals,
    issues: result.estimate.assessment.issues,
    billedCostClaims: 0,
    measuredCostClaims: 0,
    calibratedCostClaims: 0,
    rankings: 0,
    selections: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`COGNITIVE-RESOURCE COST ESTIMATE REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
