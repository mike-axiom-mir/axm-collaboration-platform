'use strict';

const U = require('./foundation-utils');

const RECEIPT_SCHEMA = 'axm.asset-hand-fuzz-receipt/v1';
const SAFE_CODES = new Set(['INVALID_INPUT', 'UNSUPPORTED_CANVAS', 'MISSING_HAND', 'SCHEMA_VALIDATION']);

function random(seed) {
  let state = Number.parseInt(U.sha256(String(seed)).slice(0, 8), 16) >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function mutate(value, next, index) {
  const copy = U.clone(value);
  const mode = index % 8;
  if (mode === 0) return null;
  if (mode === 1) return { unexpected: 'x'.repeat(1 + Math.floor(next() * 128)) };
  if (mode === 2) return Array.from({ length: 1 + Math.floor(next() * 20) }, () => Math.floor(next() * 100000));
  if (mode === 3) return '\u0000<>"\\'.repeat(1 + Math.floor(next() * 8));
  if (mode === 4 && copy && typeof copy === 'object' && !Array.isArray(copy)) {
    const keys = Object.keys(copy);
    if (keys.length) delete copy[keys[Math.floor(next() * keys.length)]];
    return copy;
  }
  if (mode === 5 && copy && typeof copy === 'object' && !Array.isArray(copy)) {
    copy['__unexpected_' + index] = { nested: [null, -Infinity, 'x'] };
    return copy;
  }
  if (mode === 6) return Number.MAX_VALUE;
  return 'x'.repeat(1024 + Math.floor(next() * 4096));
}

function run(spec, target) {
  spec = spec || {};
  U.ensure(typeof target === 'function', 'fuzz target function required');
  const cases = Math.max(1, Math.min(1000, Math.floor(U.finite(spec.cases || 100, 'fuzz cases'))));
  const maxInputBytes = Math.max(64, Math.min(1024 * 1024, Math.floor(U.finite(spec.max_input_bytes || 65536, 'max fuzz input bytes'))));
  const caseBudgetMs = Math.max(1, Math.min(10000, U.finite(spec.case_budget_ms || 100, 'fuzz case budget')));
  const next = random(spec.seed || 'axm-fuzz');
  const base = U.clone(spec.base_input || {});
  const results = [];
  for (let index = 0; index < cases; index += 1) {
    let input = mutate(base, next, index);
    const encoded = Buffer.from(JSON.stringify(input), 'utf8');
    if (encoded.length > maxInputBytes) input = { truncated_fuzz_case_sha256: U.sha256(encoded), original_bytes: encoded.length };
    const started = process.hrtime.bigint();
    let outcome = 'ACCEPTED_INVALID';
    let errorCode = null;
    try {
      target(U.clone(input), { index, expected_valid: false });
    } catch (error) {
      errorCode = error && error.code || null;
      outcome = SAFE_CODES.has(errorCode) ? 'SAFE_REJECTION' : 'CRASH';
    }
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    if (elapsedMs > caseBudgetMs) outcome = 'TIME_BUDGET_EXCEEDED';
    results.push({ index, input_digest: U.sha256(input), input_bytes: U.jsonBytes(input), outcome, error_code: errorCode, duration_ms: Number(elapsedMs.toFixed(6)) });
  }
  const failures = results.filter((item) => item.outcome !== 'SAFE_REJECTION');
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: '1.0.0',
    target_id: U.text(spec.target_id, 120, 'fuzz target id'),
    seed: U.text(spec.seed || 'axm-fuzz', 100, 'fuzz seed'),
    limits: { cases, max_input_bytes: maxInputBytes, case_budget_ms: caseBudgetMs },
    counts: {
      safe_rejections: results.filter((item) => item.outcome === 'SAFE_REJECTION').length,
      accepted_invalid: results.filter((item) => item.outcome === 'ACCEPTED_INVALID').length,
      crashes: results.filter((item) => item.outcome === 'CRASH').length,
      time_budget_exceeded: results.filter((item) => item.outcome === 'TIME_BUDGET_EXCEEDED').length,
    },
    failures,
    status: failures.length ? 'FAIL' : 'PASS',
    isolation: 'in-process-bounded-input; execution termination requires the signed extension sandbox',
  };
  receipt.id = U.receiptId('fuzz', receipt);
  receipt.digest = U.sha256(receipt);
  return receipt;
}

module.exports = { RECEIPT_SCHEMA, SAFE_CODES, mutate, run };
