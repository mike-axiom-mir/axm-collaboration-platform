'use strict';

const { parentPort, workerData } = require('worker_threads');
const Observatory = require('./axm-workshop-observatory');

try {
  const startedAt = Date.now();
  const observatory = Observatory.scan(workerData.root, {
    verificationReceiptFile:workerData.verificationReceiptFile
  });
  parentPort.postMessage({
    ok:true,
    result:{
      observatory,
      status:{
        schema:'axm.workshop-observatory-scan-status/v1',
        state:'CURRENT',
        durationMs:Date.now() - startedAt,
        measuredAt:observatory.measuredAt,
        execution:'isolated-worker',
        mainThreadFileWalk:false
      }
    }
  });
} catch (error) {
  parentPort.postMessage({ ok:false, error:String(error && error.message || error).slice(0, 500) });
}
