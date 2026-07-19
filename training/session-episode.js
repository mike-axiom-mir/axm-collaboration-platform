'use strict';

const crypto = require('crypto');

const SCHEMA = 'axm.mirror.session-episode/v1';
const ALLOWED = new Set([
  'schema', 'episodeId', 'groupId', 'source', 'goal', 'observations', 'evidenceRefs',
  'candidates', 'decision', 'outcome', 'verification', 'repairs', 'limitations'
]);
const SOURCE_ALLOWED = new Set([
  'provider', 'model', 'sessionRef', 'usePermission', 'permissionBasis', 'capturedBy'
]);
const FORBIDDEN_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 4000);
}

function list(value, maxItems, maxText) {
  return (Array.isArray(value) ? value : []).slice(0, maxItems).map(item => clean(item, maxText)).filter(Boolean);
}

function scanForbidden(value, location) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`private reasoning field refused at ${location}.${key}`);
    scanForbidden(nested, `${location}.${key}`);
  }
}

function coreOf(episode) {
  const copy = JSON.parse(JSON.stringify(episode));
  delete copy.digest;
  delete copy.review;
  return copy;
}

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('session episode must be an object');
  scanForbidden(input, 'episode');
  const extra = Object.keys(input).filter(key => !ALLOWED.has(key));
  if (extra.length) throw new Error(`unknown session episode fields: ${extra.join(', ')}`);
  const source = input.source && typeof input.source === 'object' && !Array.isArray(input.source) ? input.source : {};
  const sourceExtra = Object.keys(source).filter(key => !SOURCE_ALLOWED.has(key));
  if (sourceExtra.length) throw new Error(`unknown session source fields: ${sourceExtra.join(', ')}`);
  if (source.usePermission !== 'allowed') throw new Error('session learning requires explicit usePermission: allowed');

  const episode = {
    schema: SCHEMA,
    episodeId: clean(input.episodeId, 120) || null,
    groupId: clean(input.groupId, 160),
    source: {
      provider: clean(source.provider, 120),
      model: clean(source.model, 200),
      sessionRef: clean(source.sessionRef, 500) || null,
      usePermission: 'allowed',
      permissionBasis: clean(source.permissionBasis, 1000),
      capturedBy: clean(source.capturedBy, 120)
    },
    goal: clean(input.goal),
    observations: list(input.observations, 256, 2000),
    evidenceRefs: list(input.evidenceRefs, 256, 1000),
    candidates: list(input.candidates, 128, 2000),
    decision: clean(input.decision),
    outcome: clean(input.outcome),
    verification: list(input.verification, 256, 2000),
    repairs: list(input.repairs, 256, 2000),
    limitations: list(input.limitations, 128, 2000)
  };
  if (!episode.groupId) throw new Error('groupId is required to prevent train/test family leakage');
  if (!episode.source.provider || !episode.source.model || !episode.source.permissionBasis || !episode.source.capturedBy) throw new Error('source provider, model, permissionBasis, and capturedBy are required');
  if (!episode.goal || !episode.observations.length || !episode.candidates.length || !episode.decision || !episode.outcome || !episode.verification.length) throw new Error('goal, observations, candidates, decision, outcome, and verification are required');
  const identityDigest = digest(coreOf(episode));
  episode.episodeId = episode.episodeId || `episode-${identityDigest.slice(0, 20)}`;
  episode.digest = digest(coreOf(episode));
  episode.review = { state: 'CANDIDATE', promoted: false, reviewedBy: [], reviewedAt: null, statement: null };
  return episode;
}

function verify(episode) {
  if (!episode || episode.schema !== SCHEMA) throw new Error('invalid session episode schema');
  const actual = digest(coreOf(episode));
  if (actual !== episode.digest) throw new Error('session episode digest mismatch');
  return true;
}

function approve(episode, approval) {
  verify(episode);
  approval = approval || {};
  const reviewer = clean(approval.reviewer, 120);
  const statement = clean(approval.statement, 1000);
  const expectedDigest = clean(approval.expectedDigest, 64);
  if (!reviewer || !statement || !expectedDigest) throw new Error('approval requires reviewer, statement, and expectedDigest');
  if (expectedDigest !== episode.digest) throw new Error('approval digest does not match the reviewed episode');
  if (!episode.verification.length || !episode.outcome) throw new Error('an unverified outcome cannot be approved');
  const output = JSON.parse(JSON.stringify(episode));
  output.review = {
    state: 'APPROVED',
    promoted: false,
    reviewedBy: [reviewer],
    reviewedAt: clean(approval.reviewedAt, 80) || null,
    statement
  };
  return output;
}

function toTrainingText(episode) {
  verify(episode);
  if (!episode.review || episode.review.state !== 'APPROVED') throw new Error('only reviewed APPROVED episodes may enter a learning cycle');
  return [
    '<OBSERVE>', `Goal: ${episode.goal}`,
    ...episode.observations.map(value => `Observation: ${value}`),
    ...episode.evidenceRefs.map(value => `Evidence: ${value}`),
    '<PROPOSE>', ...episode.candidates.map(value => `Candidate: ${value}`),
    `Decision: ${episode.decision}`,
    '<VERIFY>', `Outcome: ${episode.outcome}`,
    ...episode.verification.map(value => `Verification: ${value}`),
    '<REPAIR>', ...episode.repairs.map(value => `Repair: ${value}`),
    ...episode.limitations.map(value => `Limitation: ${value}`)
  ].join('\n');
}

module.exports = { SCHEMA, normalize, verify, approve, toTrainingText, digest };
