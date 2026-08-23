'use strict';

const crypto = require('crypto');
const STATUSES = new Set(['PASS', 'FAIL', 'WARN', 'PARTIAL', 'UNKNOWN', 'STALE']);

class EvidenceError extends Error {
  constructor(code, message, details) { super(message); this.name = 'EvidenceError'; this.code = code; this.details = details || null; }
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function validTime(value, field) { if (!Number.isFinite(Date.parse(value))) throw new EvidenceError('INVALID_EVIDENCE_TIME', `${field} must be an ISO-compatible date-time`); return String(value); }

function receipt(input) {
  const required = ['id', 'claim', 'subjectDigest', 'status', 'observedAt', 'verifier', 'sourceSnapshot', 'correlationId', 'payloadSchema'];
  for (const field of required) if (!input || input[field] == null || input[field] === '') throw new EvidenceError('INVALID_RECEIPT', `Receipt requires ${field}`);
  if (!STATUSES.has(input.status)) throw new EvidenceError('INVALID_RECEIPT_STATUS', `Unknown receipt status ${input.status}`);
  validTime(input.observedAt, 'observedAt');
  if (input.expiresAt != null) validTime(input.expiresAt, 'expiresAt');
  const base = {
    schema: 'axm.receipt/v1', id: String(input.id), claim: String(input.claim), subjectDigest: String(input.subjectDigest), status: input.status,
    observedAt: String(input.observedAt), expiresAt: input.expiresAt == null ? null : String(input.expiresAt), verifier: String(input.verifier), sourceSnapshot: String(input.sourceSnapshot),
    correlationId: String(input.correlationId), causationId: input.causationId == null ? null : String(input.causationId), evidenceRefs: Array.from(new Set((input.evidenceRefs || []).map(String))).sort(),
    payloadSchema: String(input.payloadSchema), payload: input.payload == null ? null : input.payload, grantsAuthority: false
  };
  return { ...base, receiptDigest: sha256(canonical(base)) };
}

function verifyReceipt(value) {
  if (!value || value.schema !== 'axm.receipt/v1') throw new EvidenceError('INVALID_RECEIPT', 'Expected axm.receipt/v1');
  const { receiptDigest, ...base } = value;
  if (sha256(canonical(base)) !== receiptDigest) throw new EvidenceError('RECEIPT_DIGEST_DRIFT', `Receipt ${value.id} fields do not match digest`);
  return true;
}

function freshness(value, input) {
  verifyReceipt(value);
  if (value.sourceSnapshot !== input.currentSourceSnapshot) return { state: 'STALE', reason: 'source-snapshot-drift' };
  if (value.expiresAt && Date.parse(input.now) >= Date.parse(value.expiresAt)) return { state: 'STALE', reason: 'receipt-expired' };
  return { state: value.status, reason: 'current-source-and-time' };
}

function summarize(receipts, input) {
  const groups = new Map();
  for (const raw of receipts || []) {
    const row = raw && raw.schema === 'axm.receipt/v1' && raw.receiptDigest ? (verifyReceipt(raw), raw) : receipt(raw);
    const fresh = freshness(row, input);
    const key = `${row.claim}:${row.subjectDigest}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ receipt: row, effectiveStatus: fresh.state });
  }
  const claims = [], conflicts = [], unknown = [];
  for (const [key, rows] of Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const statuses = Array.from(new Set(rows.map(row => row.effectiveStatus))).sort();
    const conflict = statuses.includes('PASS') && statuses.includes('FAIL');
    const status = conflict ? 'CONFLICT' : statuses.length === 1 ? statuses[0] : statuses.includes('FAIL') ? 'FAIL' : statuses.includes('PARTIAL') ? 'PARTIAL' : statuses.includes('STALE') ? 'STALE' : 'UNKNOWN';
    const item = { key, status, receiptDigests: rows.map(row => row.receipt.receiptDigest).sort() };
    claims.push(item);
    if (conflict) conflicts.push(item);
    if (['UNKNOWN', 'STALE', 'PARTIAL'].includes(status)) unknown.push(item);
  }
  const base = { schema: 'axm.evidence-summary/v1', claims, conflicts, unknown };
  return { ...base, summaryDigest: sha256(canonical(base)) };
}

function warningBaseline(input) {
  if (!input || !input.sourceSnapshot || !input.verifierVersion) throw new EvidenceError('INVALID_WARNING_BASELINE', 'Warning baseline requires sourceSnapshot and verifierVersion');
  const base = { schema: 'axm.warning-baseline/v1', sourceSnapshot: String(input.sourceSnapshot), verifierVersion: String(input.verifierVersion), warnings: Array.from(new Set((input.warnings || []).map(String))).sort() };
  return { ...base, baselineDigest: sha256(canonical(base)) };
}

function verifyWarningBaseline(value) {
  if (!value || value.schema !== 'axm.warning-baseline/v1') throw new EvidenceError('INVALID_WARNING_BASELINE', 'Expected axm.warning-baseline/v1');
  const { baselineDigest, ...base } = value;
  if (sha256(canonical(base)) !== baselineDigest) throw new EvidenceError('WARNING_BASELINE_DRIFT', 'Warning baseline fields do not match baselineDigest');
  return true;
}

function warningDelta(baseline, current) {
  verifyWarningBaseline(baseline);
  if (!current || !current.sourceSnapshot || !current.verifierVersion) throw new EvidenceError('INVALID_WARNING_INPUT', 'Current warning set requires sourceSnapshot and verifierVersion');
  const baselineWarnings = Array.from(new Set((baseline.warnings || []).map(String))).sort();
  const currentWarnings = Array.from(new Set((current.warnings || []).map(String))).sort();
  const stale = baseline.verifierVersion !== current.verifierVersion || baseline.sourceSnapshot !== current.baselineSourceSnapshot;
  const base = {
    schema: 'axm.warning-delta/v1', state: stale ? 'STALE' : 'CURRENT', baselineSourceSnapshot: baseline.sourceSnapshot, currentSourceSnapshot: current.sourceSnapshot,
    verifierVersion: current.verifierVersion, added: currentWarnings.filter(value => !baselineWarnings.includes(value)), resolved: baselineWarnings.filter(value => !currentWarnings.includes(value)),
    unchanged: currentWarnings.filter(value => baselineWarnings.includes(value)), renewalAuthorityDecisionRef: current.renewalAuthorityDecisionRef || null
  };
  if (!stale && current.renewBaseline === true && !base.renewalAuthorityDecisionRef) throw new EvidenceError('BASELINE_RENEWAL_UNAUTHORIZED', 'Baseline renewal requires an authority decision reference');
  return { ...base, deltaDigest: sha256(canonical(base)) };
}

module.exports = { STATUSES, EvidenceError, canonical, sha256, receipt, verifyReceipt, freshness, summarize, warningBaseline, verifyWarningBaseline, warningDelta };
