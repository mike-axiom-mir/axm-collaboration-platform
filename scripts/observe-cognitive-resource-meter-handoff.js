'use strict';

const Handoff = require('../organs/cognitive-resource-meter-handoff-organ');

try {
  const result = Handoff.run();
  const assessment = result.assessment;
  process.stdout.write(JSON.stringify({
    ok: true,
    assessmentId: assessment.assessmentId,
    assessmentDigest: assessment.assessmentDigest,
    state: assessment.state,
    moduleId: assessment.source.moduleId,
    exportedFilesObserved: assessment.summary.exportedFilesObserved,
    opaqueBundleArchivesObserved: assessment.summary.opaqueBundleArchivesObserved,
    explicitIntakeCandidates: assessment.summary.explicitIntakeCandidates,
    heldOrRefusedExports: assessment.summary.heldOrRefusedExports,
    observationsAdmitted: 0,
    economicsProfilesAdmitted: 0,
    selections: 0,
    budgetAllocations: 0,
    trainingAdmissions: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`COGNITIVE-RESOURCE-METER HANDOFF REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
