#!/usr/bin/env node
'use strict';

const { parentPort, workerData } = require('worker_threads');
const Service = require('./cognitive-resource-service');

try {
  const ledger = Service.create(workerData.options);
  const result = ledger.captureObservation(workerData.draft);
  parentPort.postMessage({ ok:true, recordId:result.record.id, reused:result.reused });
} catch (error) {
  parentPort.postMessage({ ok:false, error:String(error && error.message || error) });
}
