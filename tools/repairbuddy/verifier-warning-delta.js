'use strict';

const crypto = require('node:crypto');
const DeterministicJson = require('../deterministic-json-core');

const BASELINE_SCHEMA = 'axm.repairbuddy.warning-baseline/v1';
const DELTA_SCHEMA = 'axm.repairbuddy.warning-delta/v1';
const BASELINE_STATUS = 'KNOWN_OPEN_NOT_ACKNOWLEDGED';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalDigest(value) {
  return sha256(Buffer.from(DeterministicJson.canonicalJson(value), 'utf8'));
}

function fail(message) {
  throw new TypeError(message);
}

function messageText(value, label) {
  const text = String(value === undefined || value === null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!text) fail(label + ' is required');
  if (text.length > 1200) fail(label + ' exceeds 1200 characters');
  if (/[\u0000-\u001f\u007f]/.test(text)) fail(label + ' contains control characters');
  return text;
}

function stableId(value) {
  return 'warn-' + sha256(Buffer.from(value, 'utf8'));
}

function classifyWarning(message) {
  let match = message.match(/^game package ([^:]+): (.+)$/);
  if (match) {
    const subject = match[1];
    const warning = match[2];
    return { id:stableId('game|' + subject + '|' + warning), category:'GAME_PACKAGE', subject, message };
  }
  match = message.match(/^promotion claim needs reverification: ([^ ·]+)(?: · .+)?$/);
  if (match) return { id:stableId('promotion|' + match[1]), category:'PROMOTION_EVIDENCE', subject:match[1], message };
  if (message.startsWith('manifest kind migration backlog:')) {
    return { id:stableId('manifest-kind-migration-backlog'), category:'MANIFEST_MIGRATION', subject:'tool-manifests', message };
  }
  if (message.startsWith('tools-index.json is stale') || message.startsWith('tools-index.json missing or invalid')) {
    return { id:stableId('tools-index-readiness'), category:'GENERATED_INDEX', subject:'tools-index.json', message };
  }
  return { id:stableId('unclassified|' + message), category:'UNCLASSIFIED', subject:'workshop', message };
}

function normalizeMessages(messages, label) {
  if (!Array.isArray(messages)) fail((label || 'messages') + ' must be an array');
  if (messages.length > 10000) fail((label || 'messages') + ' exceeds 10000 entries');
  const seenMessages = new Set();
  const seenIds = new Map();
  const rows = [];
  messages.forEach((value, index) => {
    const message = messageText(value, (label || 'messages') + '[' + index + ']');
    if (seenMessages.has(message)) fail('warning message is duplicated: ' + message);
    seenMessages.add(message);
    const row = classifyWarning(message);
    if (seenIds.has(row.id)) fail('warning identity collision between: ' + seenIds.get(row.id) + ' and ' + message);
    seenIds.set(row.id, message);
    rows.push(row);
  });
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

function baselineSource(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('baseline source must be an object');
  const ref = String(input.ref || '').trim();
  const commit = String(input.commit || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9._/-]+$/.test(ref) || ref.includes('..')) fail('baseline source ref is invalid');
  if (!/^[a-f0-9]{40,64}$/.test(commit)) fail('baseline source commit is invalid');
  return { ref, commit, verifier:'node verify.js' };
}

function baselineBody(id, messages, source) {
  const baselineId = String(id || '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(baselineId)) fail('baseline id must be a stable identifier');
  const rows = normalizeMessages(messages, 'baseline.messages');
  return {
    schema:BASELINE_SCHEMA,
    id:baselineId,
    status:BASELINE_STATUS,
    source:baselineSource(source),
    messages:rows.map(row => row.message),
    truth:{ warningsOpen:true, warningsAcknowledged:0, warningsSuppressed:0, automaticRepair:false }
  };
}

function buildBaseline(id, messages, source) {
  const body = baselineBody(id, messages, source);
  return Object.assign({}, body, { baselineDigest:canonicalDigest(body) });
}

function validateBaseline(baseline) {
  const errors = [];
  let expected = null;
  try {
    if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) fail('baseline must be an object');
    if (baseline.schema !== BASELINE_SCHEMA) errors.push('schema must be ' + BASELINE_SCHEMA);
    expected = String(baseline.baselineDigest || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) errors.push('baselineDigest must be SHA-256');
    const body = baselineBody(baseline.id, baseline.messages, baseline.source);
    if (baseline.status !== body.status) errors.push('baseline status must preserve known-open truth');
    if (!baseline.truth || DeterministicJson.canonicalJson(baseline.truth) !== DeterministicJson.canonicalJson(body.truth)) errors.push('baseline truth boundary changed');
    if (expected !== canonicalDigest(body)) errors.push('baseline digest mismatch');
  } catch (error) { errors.push(String(error.message || error)); }
  return { pass:errors.length === 0, errors };
}

function categoryCounts(rows) {
  const counts = {};
  rows.forEach(row => { counts[row.category] = (counts[row.category] || 0) + 1; });
  return Object.fromEntries(Object.keys(counts).sort().map(key => [key, counts[key]]));
}

function compareWarnings(messages, baseline) {
  const checked = validateBaseline(baseline);
  if (!checked.pass) fail('warning baseline is invalid: ' + checked.errors.join('; '));
  const current = normalizeMessages(messages, 'current.messages');
  const known = normalizeMessages(baseline.messages, 'baseline.messages');
  const currentById = new Map(current.map(row => [row.id, row]));
  const knownById = new Map(known.map(row => [row.id, row]));
  const added = current.filter(row => !knownById.has(row.id));
  const resolved = known.filter(row => !currentById.has(row.id));
  const changed = current.filter(row => knownById.has(row.id) && knownById.get(row.id).message !== row.message).map(row => ({
    id:row.id,
    category:row.category,
    subject:row.subject,
    before:knownById.get(row.id).message,
    after:row.message
  }));
  const unchanged = current.filter(row => knownById.has(row.id) && knownById.get(row.id).message === row.message).length;
  const state = !added.length && !resolved.length && !changed.length ? 'MATCH' : 'DRIFT';
  const body = {
    schema:DELTA_SCHEMA,
    state,
    baseline:{ id:baseline.id, digest:baseline.baselineDigest, source:baselineSource(baseline.source), warnings:known.length },
    current:{ digest:canonicalDigest(current), warnings:current.length, categories:categoryCounts(current) },
    summary:{ added:added.length, resolved:resolved.length, changed:changed.length, unchanged },
    added,
    resolved,
    changed,
    truth:{ warningsOpen:true, warningsAcknowledged:0, warningsSuppressed:0, automaticRepair:false, resolvedWarningsNotDeletedFromDelta:true }
  };
  return Object.assign({}, body, { deltaDigest:canonicalDigest(body) });
}

function validateDelta(delta) {
  const errors = [];
  try {
    if (!delta || delta.schema !== DELTA_SCHEMA) errors.push('delta schema required');
    const copy = JSON.parse(JSON.stringify(delta));
    const digest = String(copy.deltaDigest || '').toLowerCase();
    delete copy.deltaDigest;
    if (!/^[a-f0-9]{64}$/.test(digest) || digest !== canonicalDigest(copy)) errors.push('delta digest mismatch');
    if (!delta.truth || delta.truth.warningsOpen !== true || delta.truth.warningsAcknowledged !== 0 || delta.truth.warningsSuppressed !== 0 || delta.truth.automaticRepair !== false) errors.push('delta truth boundary changed');
    if (!Array.isArray(delta.added) || !Array.isArray(delta.resolved) || !Array.isArray(delta.changed)) errors.push('delta difference arrays are required');
    if (!delta.summary || delta.summary.added !== delta.added.length || delta.summary.resolved !== delta.resolved.length || delta.summary.changed !== delta.changed.length || !Number.isSafeInteger(delta.summary.unchanged) || delta.summary.unchanged < 0) errors.push('delta summary does not match difference arrays');
    if (!delta.current || !Number.isSafeInteger(delta.current.warnings) || delta.current.warnings !== delta.summary.added + delta.summary.changed + delta.summary.unchanged) errors.push('current warning count does not match delta');
    if (!delta.baseline || !Number.isSafeInteger(delta.baseline.warnings) || delta.baseline.warnings !== delta.summary.resolved + delta.summary.changed + delta.summary.unchanged) errors.push('baseline warning count does not match delta');
    const differenceCount = Number(delta.summary && delta.summary.added) + Number(delta.summary && delta.summary.resolved) + Number(delta.summary && delta.summary.changed);
    if ((delta.state === 'MATCH') !== (differenceCount === 0)) errors.push('delta state does not match differences');
  } catch (error) { errors.push(String(error.message || error)); }
  return { pass:errors.length === 0, errors };
}

function extractWarningMessages(coreText) {
  return String(coreText || '').split(/\r?\n/).map(line => line.trim()).filter(line => /^warn\s{2}/.test(line)).map(line => line.replace(/^warn\s+/, ''));
}

function messagesFromVerifyReport(report) {
  if (!report || !Array.isArray(report.checks)) fail('verify report checks are required');
  return report.checks.filter(row => row && row.verdict === 'WARN').map(row => row.message);
}

module.exports = {
  BASELINE_SCHEMA,
  DELTA_SCHEMA,
  BASELINE_STATUS,
  canonicalDigest,
  classifyWarning,
  normalizeMessages,
  buildBaseline,
  validateBaseline,
  compareWarnings,
  validateDelta,
  extractWarningMessages,
  messagesFromVerifyReport
};
