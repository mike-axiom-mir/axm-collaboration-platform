'use strict';

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const OperationsUtils = require('../operations/operations-utils');
const Observatory = require('./axm-workshop-observatory');

const CACHE_SCHEMA = 'axm.workshop-observatory-cache/v1';

function create(options) {
  const input = options || {}, WorkerClass = input.WorkerImpl || Worker;
  const root = path.resolve(String(input.root || ''));
  const cacheFile = path.resolve(String(input.cacheFile || ''));
  const workerFile = path.resolve(String(input.workerFile || ''));
  const verificationReceiptFile = path.resolve(String(input.verificationReceiptFile || path.join(root, 'state', 'tool-readiness', 'latest-selftests.json')));
  const timeoutMs = Math.max(1000, Number(input.timeoutMs) || 120000);
  const staleAfterMs = Math.max(1000, Number(input.staleAfterMs) || 5 * 60 * 1000);
  let inFlight = null, latest = null, lastError = null, scans = 0, coalesced = 0;

  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cached && cached.schema === CACHE_SCHEMA && cached.observatory && cached.observatory.schema === Observatory.SCHEMA) latest = cached;
  } catch (_) {}

  function freshness() {
    if (!latest) return { state:inFlight ? 'MEASURING' : lastError ? 'UNAVAILABLE' : 'NOT_MEASURED', ageMs:null, stale:true };
    const ageMs = Math.max(0, Date.now() - Date.parse(latest.savedAt || latest.observatory.measuredAt || ''));
    return { state:ageMs <= staleAfterMs ? 'CURRENT' : 'STALE', ageMs:Number.isFinite(ageMs) ? ageMs : null, stale:!Number.isFinite(ageMs) || ageMs > staleAfterMs };
  }

  function refresh() {
    if (inFlight) { coalesced++; return inFlight; }
    scans++;
    inFlight = new Promise((resolve,reject) => {
      let settled = false;
      const worker = new WorkerClass(workerFile, { workerData:{ root, verificationReceiptFile } });
      const timer = setTimeout(() => finish(new Error('Workshop Observatory scan timed out')), timeoutMs);
      function finish(error, result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeAllListeners();
        try { const termination = worker.terminate(); if (termination && typeof termination.catch === 'function') termination.catch(() => {}); } catch (_) {}
        if (error) reject(error); else resolve(result);
      }
      worker.once('message', message => message && message.ok === true && message.result ? finish(null, message.result) : finish(new Error(message && message.error || 'Workshop Observatory worker returned no result')));
      worker.once('error', error => finish(error));
      worker.once('exit', code => { if (!settled) finish(new Error('Workshop Observatory worker exited with code ' + code)); });
    }).then(result => {
      latest = { schema:CACHE_SCHEMA, savedAt:new Date().toISOString(), observatory:result.observatory, scanStatus:result.status };
      lastError = null;
      try { OperationsUtils.atomicJson(cacheFile, latest); } catch (error) { latest.scanStatus.persistenceError = String(error && error.message || error).slice(0, 240); }
      return latest;
    }).catch(error => {
      lastError = String(error && error.message || error).slice(0, 500);
      throw error;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  function read() {
    return {
      ready:!!latest,
      observatory:latest && latest.observatory || null,
      freshness:freshness(),
      scanStatus:latest && latest.scanStatus || null,
      error:lastError,
      stats:{ scans, coalesced, inFlight:!!inFlight }
    };
  }

  return { refresh, read };
}

module.exports = { CACHE_SCHEMA, create };
