'use strict';

const U = require('./foundation-utils');

const RECEIPT_SCHEMA = 'axm.asset-hand-benchmark-receipt/v1';
const VERSION = '1.1.0';
const MEASUREMENT_SOURCES = new Set(['caller-supplied', 'runtime-observed']);
const RESERVED_METRICS = new Set([
  'duration_ms',
  'mean_duration_ms',
  'median_duration_ms',
  'p95_duration_ms',
  'max_duration_ms',
  'min_duration_ms',
  'peak_heap_bytes',
  'max_observed_heap_delta_bytes',
  'output_bytes',
  'execution_failures',
]);

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

function normalizeMeasurements(value) {
  const measurements = {};
  for (const key of Object.keys(value || {}).sort()) {
    measurements[U.text(key, 100, 'measurement name')] = U.finite(value[key], 'measurement ' + key);
  }
  U.ensure(Object.keys(measurements).length > 0, 'at least one benchmark measurement is required');
  return measurements;
}

function normalizeFailure(value, fallbackIndex) {
  value = value && typeof value === 'object' ? value : {};
  const phase = value.phase === 'warmup' ? 'warmup' : 'measurement';
  const name = String(value.name || 'Error').trim().slice(0, 100) || 'Error';
  const message = String(value.message || 'workload failed').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || 'workload failed';
  return {
    phase,
    index: Math.max(0, Math.floor(Number.isFinite(Number(value.index)) ? Number(value.index) : fallbackIndex || 0)),
    name,
    message,
  };
}

function normalizeSamples(value) {
  return U.boundedArray(Array.isArray(value) ? value : [], 0, 1000, 'benchmark samples').map((sample, index) => {
    sample = sample && typeof sample === 'object' ? sample : {};
    const metrics = {};
    for (const key of Object.keys(sample.metrics || {}).sort()) {
      U.ensure(!RESERVED_METRICS.has(key), 'sample domain metric uses reserved name: ' + key);
      metrics[U.text(key, 100, 'sample metric name')] = U.finite(sample.metrics[key], 'sample metric ' + key);
    }
    return {
      index: Math.max(0, Math.floor(Number.isFinite(Number(sample.index)) ? Number(sample.index) : index)),
      status: sample.status === 'FAIL' ? 'FAIL' : 'PASS',
      duration_ms: Math.max(0, U.finite(sample.duration_ms || 0, 'sample duration')),
      observed_heap_delta_bytes: Math.max(0, U.finite(sample.observed_heap_delta_bytes || 0, 'sample heap delta')),
      output_bytes: Math.max(0, U.finite(sample.output_bytes || 0, 'sample output bytes')),
      metrics,
    };
  });
}

function distribution(values) {
  const sorted = values.map((value) => U.finite(value, 'distribution value')).sort((left, right) => left - right);
  if (!sorted.length) return { count: 0, minimum: 0, median: 0, p95: 0, maximum: 0, mean: 0, total: 0 };
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const nearest = (quantile) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1))];
  return {
    count: sorted.length,
    minimum: Number(sorted[0].toFixed(6)),
    median: Number(nearest(0.5).toFixed(6)),
    p95: Number(nearest(0.95).toFixed(6)),
    maximum: Number(sorted[sorted.length - 1].toFixed(6)),
    mean: Number((total / sorted.length).toFixed(6)),
    total: Number(total.toFixed(6)),
  };
}

function statisticsFor(samples) {
  return {
    duration_ms: distribution(samples.map((sample) => sample.duration_ms)),
    observed_heap_delta_bytes: distribution(samples.map((sample) => sample.observed_heap_delta_bytes)),
    output_bytes: distribution(samples.map((sample) => sample.output_bytes)),
  };
}

function observedEnvironment(spec) {
  const declared = spec && spec.environment || {};
  return {
    runtime: process.version,
    platform: process.platform,
    architecture: process.arch,
    isolation: String(declared.isolation || 'in-process-synchronous').trim().slice(0, 100) || 'in-process-synchronous',
    observation: 'runtime-observed',
  };
}

function boundedExecutionCount(value, fallback, maximum) {
  const numeric = Number(value);
  const selected = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(0, Math.min(maximum, Math.floor(selected)));
}

function record(spec) {
  spec = U.clone(spec || {});
  const measurements = normalizeMeasurements(spec.measurements);
  const budgets = normalizeBudget(spec.budgets);
  const repetitions = Math.max(1, Math.min(1000, Math.floor(U.finite(spec.repetitions || 1, 'benchmark repetitions'))));
  const failures = U.boundedArray(Array.isArray(spec.failures) ? spec.failures : [], 0, 1000, 'benchmark failures').map(normalizeFailure);
  const samples = normalizeSamples(spec.samples);
  const measurementSource = MEASUREMENT_SOURCES.has(spec.measurement_source) ? spec.measurement_source : 'caller-supplied';
  const execution = {
    requested_repetitions: repetitions,
    completed_repetitions: boundedExecutionCount(
      spec.execution && spec.execution.completed_repetitions,
      repetitions - failures.filter((item) => item.phase === 'measurement').length,
      repetitions
    ),
    failed_repetitions: failures.filter((item) => item.phase === 'measurement').length,
    warmup_repetitions: boundedExecutionCount(spec.execution && spec.execution.warmup_repetitions, 0, 100),
    synchronous: true,
    fail_fast: spec.execution && spec.execution.fail_fast === false ? false : true,
  };
  const checks = [{
    metric: 'execution_failures',
    measured: failures.length,
    budget: 0,
    pass: failures.length === 0 && execution.completed_repetitions === repetitions,
  }].concat(Object.keys(budgets).map((key) => ({
    metric: key,
    measured: Object.prototype.hasOwnProperty.call(measurements, key) ? measurements[key] : null,
    budget: budgets[key],
    pass: Object.prototype.hasOwnProperty.call(measurements, key) && measurements[key] <= budgets[key],
  })));
  const environment = spec.environment || {};
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    workload: {
      id: U.text(spec.workload && spec.workload.id, 120, 'workload id'),
      digest: U.text(spec.workload && spec.workload.digest, 128, 'workload digest'),
      description: U.text(spec.workload && spec.workload.description, 500, 'workload description'),
      observed_function_digest: spec.workload && spec.workload.observed_function_digest
        ? U.text(spec.workload.observed_function_digest, 64, 'observed workload function digest')
        : null,
    },
    environment: {
      runtime: U.text(environment.runtime, 120, 'benchmark runtime'),
      platform: U.text(environment.platform, 120, 'benchmark platform'),
      architecture: U.text(environment.architecture, 60, 'benchmark architecture'),
      isolation: U.text(environment.isolation, 100, 'benchmark isolation'),
      observation: environment.observation === 'runtime-observed' ? 'runtime-observed' : 'caller-supplied',
    },
    measurement_source: measurementSource,
    repetitions,
    execution,
    samples,
    statistics: spec.statistics && typeof spec.statistics === 'object' ? U.clone(spec.statistics) : statisticsFor(samples),
    measurements,
    budgets,
    checks,
    failures,
    status: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
    scope: 'claims apply only to the named workload, observed environment, repetitions and measurements',
    limitations: [
      'in-process timing includes host scheduling and runtime noise',
      'heap is sampled at repetition boundaries and may miss transient allocations',
      'PASS is a bounded performance receipt, not production or visual-quality approval',
    ],
  };
  receipt.id = U.receiptId('benchmark', receipt);
  receipt.digest = U.sha256(receipt);
  return receipt;
}

function outputBytes(result) {
  if (!result || !Object.prototype.hasOwnProperty.call(result, 'output')) return 0;
  const output = Buffer.isBuffer(result.output)
    ? result.output
    : Buffer.from(typeof result.output === 'string' ? result.output : JSON.stringify(result.output), 'utf8');
  return output.length;
}

function run(spec, workload) {
  U.ensure(typeof workload === 'function', 'benchmark workload function required');
  spec = U.clone(spec || {});
  const repetitions = Math.max(1, Math.min(1000, Math.floor(Number(spec.repetitions) || 1)));
  const warmupRepetitions = Math.max(0, Math.min(100, Math.floor(Number(spec.warmup_repetitions) || 0)));
  const failFast = spec.fail_fast !== false;
  const samples = [];
  const failures = [];
  const domainMetrics = {};

  function execute(index, phase) {
    const heapBefore = process.memoryUsage().heapUsed;
    const started = process.hrtime.bigint();
    let result = null;
    let failure = null;
    try {
      result = workload(index, { phase });
      U.ensure(!(result && typeof result.then === 'function'), 'benchmark.run accepts synchronous workloads only');
    } catch (error) {
      failure = normalizeFailure({ phase, index, name: error && error.name, message: error && error.message }, index);
    }
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const heapAfter = process.memoryUsage().heapUsed;
    let bytes = 0;
    if (!failure) {
      try { bytes = outputBytes(result); }
      catch (error) { failure = normalizeFailure({ phase, index, name: error && error.name, message: 'output measurement failed: ' + (error && error.message) }, index); }
    }
    const sample = {
      index,
      status: failure ? 'FAIL' : 'PASS',
      duration_ms: Number(durationMs.toFixed(6)),
      observed_heap_delta_bytes: Math.max(0, heapAfter - heapBefore),
      output_bytes: failure ? 0 : bytes,
      metrics: {},
    };
    if (!failure) {
      for (const key of Object.keys(result && result.metrics || {}).sort()) {
        U.ensure(!RESERVED_METRICS.has(key), 'domain metric uses reserved name: ' + key);
        const value = U.finite(result.metrics[key], 'domain metric ' + key);
        sample.metrics[key] = value;
        if (phase === 'measurement') domainMetrics[key] = (domainMetrics[key] || 0) + value;
      }
    }
    return { sample, failure };
  }

  for (let index = 0; index < warmupRepetitions; index += 1) {
    const observed = execute(index, 'warmup');
    if (observed.failure) {
      failures.push(observed.failure);
      if (failFast) break;
    }
  }
  if (!failures.length || !failFast) {
    for (let index = 0; index < repetitions; index += 1) {
      const observed = execute(index, 'measurement');
      samples.push(observed.sample);
      if (observed.failure) {
        failures.push(observed.failure);
        if (failFast) break;
      }
    }
  }
  const statistics = statisticsFor(samples);
  const completed = samples.filter((sample) => sample.status === 'PASS');
  const measurements = Object.assign({}, domainMetrics, {
    duration_ms: statistics.duration_ms.total,
    mean_duration_ms: statistics.duration_ms.mean,
    median_duration_ms: statistics.duration_ms.median,
    p95_duration_ms: statistics.duration_ms.p95,
    max_duration_ms: statistics.duration_ms.maximum,
    min_duration_ms: statistics.duration_ms.minimum,
    peak_heap_bytes: statistics.observed_heap_delta_bytes.maximum,
    max_observed_heap_delta_bytes: statistics.observed_heap_delta_bytes.maximum,
    output_bytes: completed.reduce((sum, sample) => sum + sample.output_bytes, 0),
    execution_failures: failures.length,
  });
  return record(Object.assign({}, spec, {
    repetitions,
    workload: Object.assign({}, spec.workload, {
      observed_function_digest: U.sha256(Function.prototype.toString.call(workload)),
    }),
    environment: observedEnvironment(spec),
    measurement_source: 'runtime-observed',
    measurements,
    samples,
    statistics,
    failures,
    execution: {
      completed_repetitions: completed.length,
      warmup_repetitions: warmupRepetitions,
      fail_fast: failFast,
    },
  }));
}

function verify(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA) errors.push('receipt schema mismatch');
  if (!receipt || receipt.version !== VERSION) errors.push('receipt version mismatch');
  if (!receipt || !/^[a-f0-9]{64}$/.test(String(receipt.digest || ''))) errors.push('receipt digest missing');
  if (!receipt || !/^benchmark-[a-f0-9]{24}$/.test(String(receipt.id || ''))) errors.push('receipt id missing');
  if (!errors.length) {
    const body = U.clone(receipt);
    const digest = body.digest;
    delete body.digest;
    if (U.sha256(body) !== digest) errors.push('receipt digest mismatch');
    const identityBody = U.clone(body);
    const id = identityBody.id;
    delete identityBody.id;
    if (U.receiptId('benchmark', identityBody) !== id) errors.push('receipt id mismatch');
  }
  if (receipt && receipt.status === 'PASS' && ((receipt.failures || []).length || (receipt.checks || []).some((check) => !check.pass))) errors.push('PASS receipt contains failed evidence');
  return { pass: errors.length === 0, errors };
}

module.exports = { RECEIPT_SCHEMA, VERSION, record, run, verify, distribution };
