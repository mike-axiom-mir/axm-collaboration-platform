'use strict';

const U = require('./foundation-utils');

const RECEIPT_SCHEMA = 'axm.asset-hand-benchmark-receipt/v1';

function normalizeBudget(budget) {
  budget = U.clone(budget || {});
  const normalized = {};
  for (const key of Object.keys(budget).sort()) {
    const value = U.finite(budget[key], 'budget ' + key);
    U.ensure(value >= 0, 'budget values cannot be negative');
    normalized[U.text(key, 100, 'budget name')] = value;
  }
  return normalized;
}

function record(spec) {
  spec = U.clone(spec || {});
  const measurements = {};
  for (const key of Object.keys(spec.measurements || {}).sort()) measurements[U.text(key, 100, 'measurement name')] = U.finite(spec.measurements[key], 'measurement ' + key);
  const budgets = normalizeBudget(spec.budgets);
  const checks = Object.keys(budgets).map((key) => ({
    metric: key,
    measured: Object.prototype.hasOwnProperty.call(measurements, key) ? measurements[key] : null,
    budget: budgets[key],
    pass: Object.prototype.hasOwnProperty.call(measurements, key) && measurements[key] <= budgets[key],
  }));
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: '1.0.0',
    workload: {
      id: U.text(spec.workload && spec.workload.id, 120, 'workload id'),
      digest: U.text(spec.workload && spec.workload.digest, 128, 'workload digest'),
      description: U.text(spec.workload && spec.workload.description, 500, 'workload description'),
    },
    environment: {
      runtime: U.text(spec.environment && spec.environment.runtime, 120, 'benchmark runtime'),
      platform: U.text(spec.environment && spec.environment.platform, 120, 'benchmark platform'),
      architecture: U.text(spec.environment && spec.environment.architecture, 60, 'benchmark architecture'),
      isolation: U.text(spec.environment && spec.environment.isolation, 100, 'benchmark isolation'),
    },
    repetitions: Math.max(1, Math.min(1000, Math.floor(U.finite(spec.repetitions || 1, 'benchmark repetitions')))),
    measurements,
    budgets,
    checks,
    status: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
    scope: 'claims apply only to the named workload, environment, and measurements',
  };
  receipt.id = U.receiptId('benchmark', receipt);
  receipt.digest = U.sha256(receipt);
  return receipt;
}

function run(spec, workload) {
  U.ensure(typeof workload === 'function', 'benchmark workload function required');
  const repetitions = Math.max(1, Math.min(1000, Math.floor(Number(spec && spec.repetitions) || 1)));
  const startHeap = process.memoryUsage().heapUsed;
  let peakHeap = startHeap;
  let outputBytes = 0;
  let domainMetrics = {};
  const started = process.hrtime.bigint();
  for (let index = 0; index < repetitions; index += 1) {
    const result = workload(index);
    U.ensure(!(result && typeof result.then === 'function'), 'benchmark.run accepts synchronous workloads only');
    peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
    if (result && Object.prototype.hasOwnProperty.call(result, 'output')) {
      const output = Buffer.isBuffer(result.output) ? result.output : Buffer.from(typeof result.output === 'string' ? result.output : JSON.stringify(result.output), 'utf8');
      outputBytes += output.length;
    }
    for (const key of Object.keys(result && result.metrics || {})) domainMetrics[key] = (domainMetrics[key] || 0) + U.finite(result.metrics[key], 'domain metric ' + key);
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const measurements = Object.assign({ duration_ms: Number(elapsedMs.toFixed(6)), peak_heap_bytes: Math.max(0, peakHeap - startHeap), output_bytes: outputBytes }, domainMetrics);
  return record(Object.assign({}, spec, { repetitions, measurements }));
}

module.exports = { RECEIPT_SCHEMA, record, run };
