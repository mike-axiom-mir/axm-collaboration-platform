'use strict';

const crypto = require('crypto');

const ALLOWED = new Set(['schema', 'artifactId', 'source', 'task', 'evidenceRefs', 'alternatives', 'decision', 'verification', 'corrections', 'outcome', 'limitations']);
const SOURCE_ALLOWED = new Set(['provider', 'model', 'sessionRef', 'usePermission', 'permissionBasis', 'capturedBy']);
const FORBIDDEN_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 4000);
}

function list(value, maxItems, maxText) {
  return (Array.isArray(value) ? value : []).slice(0, maxItems).map(item => clean(item, maxText)).filter(Boolean);
}

function scanForbidden(value, path) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`private reasoning field refused at ${path}.${key}`);
    scanForbidden(nested, `${path}.${key}`);
  }
}

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('teacher artifact must be an object');
  scanForbidden(input, 'artifact');
  const extra = Object.keys(input).filter(key => !ALLOWED.has(key));
  if (extra.length) throw new Error(`unknown teacher artifact fields: ${extra.join(', ')}`);
  const source = input.source && typeof input.source === 'object' ? input.source : {};
  const sourceExtra = Object.keys(source).filter(key => !SOURCE_ALLOWED.has(key));
  if (sourceExtra.length) throw new Error(`unknown source fields: ${sourceExtra.join(', ')}`);
  if (source.usePermission !== 'allowed') throw new Error('future training intake requires explicit usePermission: allowed');
  const normalized = {
    schema: 'axm.mirror.teacher-artifact/v1',
    artifactId: clean(input.artifactId, 120) || null,
    source: {
      provider: clean(source.provider, 120), model: clean(source.model, 200),
      sessionRef: clean(source.sessionRef, 500) || null,
      usePermission: 'allowed', permissionBasis: clean(source.permissionBasis, 1000),
      capturedBy: clean(source.capturedBy, 120)
    },
    task: clean(input.task), evidenceRefs: list(input.evidenceRefs, 256, 1000),
    alternatives: list(input.alternatives, 128, 2000), decision: clean(input.decision),
    verification: list(input.verification, 256, 2000), corrections: list(input.corrections, 256, 2000),
    outcome: clean(input.outcome), limitations: list(input.limitations, 128, 2000),
    review: { state: 'CANDIDATE', promoted: false, reviewedBy: [], createdAt: new Date().toISOString() }
  };
  if (!normalized.source.provider || !normalized.source.model || !normalized.source.permissionBasis || !normalized.source.capturedBy) throw new Error('source provider, model, permissionBasis, and capturedBy are required');
  if (!normalized.task || !normalized.decision || !normalized.outcome || !normalized.verification.length) throw new Error('task, decision, verification, and outcome are required');
  if (!normalized.artifactId) normalized.artifactId = 'teacher-' + crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 20);
  return normalized;
}

module.exports = { normalize };
