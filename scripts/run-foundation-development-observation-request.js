'use strict';

const Request = require('../organs/foundation-development-observation-request-organ');

try {
  const result = Request.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    requestId: result.request.requestId,
    state: result.request.state,
    subjectDigest: result.request.observation.subjectDigest,
    evidenceDigest: result.request.observation.evidenceDigest,
    priorSnapshotsExamined: result.request.prior.snapshotsExamined,
    exactSnapshotIds: result.request.prior.exactSnapshotIds,
    observationExecuted: false,
    trainingAdmissions: 0,
    repairs: 0,
    promotions: 0,
    written: result.written,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION OBSERVATION REQUEST REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
