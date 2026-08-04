'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const U = require('./foundation-utils');
const Benchmark = require('./benchmark');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function spec(overrides) {
  return Object.assign({
    workload: { id: 'bounded-json-encode', digest: U.sha256('bounded-json-encode/v1'), description: 'Encode one bounded JSON fixture.' },
    environment: { runtime: 'declared-runtime', platform: 'declared-platform', architecture: 'declared-arch', isolation: 'single-process-selftest' },
    repetitions: 5,
    warmup_repetitions: 2,
    budgets: { duration_ms: 10000, p95_duration_ms: 10000, output_bytes: 100000 },
  }, overrides || {});
}

const measured = Benchmark.run(spec(), (index, context) => ({
  output: { index, phase: context.phase, payload: 'x'.repeat(index + 1) },
  metrics: { objects_encoded: 1 },
}));
check(measured.status === 'PASS', 'bounded measured workload passes its generous budgets');
check(measured.measurement_source === 'runtime-observed' && measured.environment.observation === 'runtime-observed', 'runtime observation is distinguished from caller supplied records');
check(measured.environment.runtime === process.version && measured.environment.platform === process.platform && measured.environment.architecture === process.arch, 'runtime, platform and architecture are observed from the executing host');
check(/^[a-f0-9]{64}$/.test(measured.workload.observed_function_digest), 'runtime receipt binds the observed workload function without retaining executable code');
check(measured.execution.requested_repetitions === 5 && measured.execution.completed_repetitions === 5 && measured.execution.warmup_repetitions === 2, 'warmup and measured repetition counts remain separate');
check(measured.samples.length === 5 && measured.samples.every((sample) => sample.status === 'PASS'), 'one bounded sample is retained per measured repetition');
check(measured.statistics.duration_ms.count === 5 && measured.measurements.p95_duration_ms === measured.statistics.duration_ms.p95, 'distribution statistics bind the p95 measurement');
check(measured.measurements.objects_encoded === 5 && measured.measurements.output_bytes > 0, 'domain and byte measurements are derived from real outputs');
check(measured.limitations.some((item) => /may miss transient allocations/.test(item)), 'heap sampling limitation remains visible');
check(Benchmark.verify(measured).pass, 'measured receipt verifies its ID and SHA-256 digest');

const repeatedRecordSpec = {
  workload: { id: 'fixture', digest: U.sha256('fixture'), description: 'Caller-supplied compatibility fixture.' },
  environment: { runtime: 'node-test', platform: 'test', architecture: 'test', isolation: 'fixture' },
  repetitions: 2,
  measurements: { duration_ms: 4, output_bytes: 32 },
  budgets: { duration_ms: 5, output_bytes: 64 },
};
const firstRecord = Benchmark.record(repeatedRecordSpec);
const secondRecord = Benchmark.record(repeatedRecordSpec);
check(firstRecord.status === 'PASS' && firstRecord.measurement_source === 'caller-supplied', 'legacy caller-supplied record path remains compatible and honest');
check(firstRecord.workload.observed_function_digest === null, 'caller-supplied compatibility record does not invent an observed function digest');
check(firstRecord.digest === secondRecord.digest, 'same caller-supplied record remains deterministic');

const budgetFailure = Benchmark.record(Object.assign({}, repeatedRecordSpec, { measurements: { duration_ms: 8, output_bytes: 32 } }));
check(budgetFailure.status === 'FAIL' && budgetFailure.checks.some((item) => item.metric === 'duration_ms' && !item.pass), 'budget overrun fails visibly');

let invocations = 0;
const failed = Benchmark.run(spec({ repetitions: 4, warmup_repetitions: 0 }), (index) => {
  invocations += 1;
  if (index === 1) throw new Error('bounded fixture failure');
  return { output: Buffer.from([index]), metrics: { completed_items: 1 } };
});
check(failed.status === 'FAIL' && failed.failures.length === 1, 'workload failure becomes a bounded FAIL receipt');
check(failed.failures[0].message === 'bounded fixture failure' && !Object.prototype.hasOwnProperty.call(failed.failures[0], 'stack'), 'failure receipt excludes stack and private paths');
check(failed.execution.completed_repetitions === 1 && invocations === 2, 'fail-fast stops after the first measured workload failure');
check(Benchmark.verify(failed).pass, 'FAIL evidence receipt remains cryptographically verifiable');

const warmupFailed = Benchmark.run(spec({ repetitions: 3, warmup_repetitions: 2 }), () => {
  throw new Error('warmup fixture failure');
});
check(warmupFailed.status === 'FAIL' && warmupFailed.execution.completed_repetitions === 0 && warmupFailed.samples.length === 0, 'warmup failure records zero completed measurements instead of falling back to the requested count');

const tampered = JSON.parse(JSON.stringify(measured));
tampered.measurements.output_bytes += 1;
check(!Benchmark.verify(tampered).pass, 'tampered measurement invalidates the receipt digest');

const asyncFailure = Benchmark.run(spec({ repetitions: 1, warmup_repetitions: 0 }), () => Promise.resolve({ output: 'not-supported' }));
check(asyncFailure.status === 'FAIL' && /synchronous workloads only/.test(asyncFailure.failures[0].message), 'unsupported async workload fails as evidence instead of disappearing');
assert.throws(() => Benchmark.record(Object.assign({}, repeatedRecordSpec, { budgets: { duration_ms: -1 } })), /cannot be negative/); checks += 1;
assert.throws(() => Benchmark.run(spec({ repetitions: 1, warmup_repetitions: 0 }), () => ({ output: 'x', metrics: { duration_ms: 9 } })), /reserved name/); checks += 1;

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmark-receipt.schema.json'), 'utf8'));
check(schema.$id === Benchmark.RECEIPT_SCHEMA && schema.properties.version.const === Benchmark.VERSION, 'portable schema matches the executable receipt contract');
check(measured.scope.includes('named workload') && measured.status !== 'READY', 'receipt never turns a measurement into production readiness');

console.log('Asset Hand runtime benchmark selftest: PASS - ' + checks + ' checks');
