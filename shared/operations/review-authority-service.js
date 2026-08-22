'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DeterministicJson = require('../../tools/deterministic-json-core');
const U = require('./operations-utils');

const POLICY_SCHEMA = 'axm.review-trust-policy/v1';
const ENVELOPE_SCHEMA = 'axm.authenticated-review-envelope/v1';
const SUBMIT_SCHEMA = 'axm.authenticated-review-submit/v1';
const VOTE_SCHEMA = 'axm.authenticated-review-vote/v1';
const VIEW_SCHEMA = 'axm.review-authority-view/v2';
const INDEX_SCHEMA = 'axm.review-authority-index/v2';
const LEDGER_SCHEMA = 'axm.review-authentication-ledger/v2';
const LEGACY_LEDGER_SCHEMA = 'axm.review-authentication-ledger/v1';
const RECOVERY_STATUS_SCHEMA = 'axm.review-projection-recovery-status/v1';
const RECOVERY_RESULT_SCHEMA = 'axm.review-projection-recovery-result/v1';
const RECOVERY_CONFIRMATION = 'RECOVER SIGNED REVIEW PROJECTION';
const AUTHORITY_ORIGIN = 'HOST_CONFIGURED_LOCAL_TRUST_ROOT';
const STATUS = 'TEST';
const MAX_POLICY_BYTES = 262144;
const MAX_CANDIDATE_BYTES = 2097152;
const MAX_ENVELOPE_BYTES = 131072;
const MAX_LEDGER_BYTES = 8388608;
const MAX_LEDGER_OPERATIONS = 10000;
const MAX_RECOVERY_VIEW_OPERATIONS = 200;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const RAW_DIGEST = /^[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PUBLIC_KEY_PEM = /^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END PUBLIC KEY-----(?:\r?\n)?$/;
const ROLES = Object.freeze(['review.submit', 'review.vote']);
const PRINCIPAL_KINDS = Object.freeze(['human', 'machine', 'collective', 'unknown']);
const VERDICTS = Object.freeze(['APPROVE', 'HOLD', 'REJECT']);

function stableStringify(value) { return DeterministicJson.canonicalJson(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) {
  const bytes = Buffer.isBuffer(value) || value instanceof Uint8Array ? value : (typeof value === 'string' ? value : stableStringify(value));
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}
function canonicalBytes(value, maximum, label) {
  let text;
  try { text = stableStringify(value); }
  catch (error) { throw new Error(label + ' is not strict deterministic JSON: ' + error.message); }
  if (Buffer.byteLength(text, 'utf8') > maximum) throw new Error(label + ' exceeds the byte limit');
  return text;
}
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}
function text(value, label, maximum, allowEmpty) {
  if (typeof value !== 'string' || value !== value.trim() || (!allowEmpty && !value)) throw new Error(label + ' must be exact' + (allowEmpty ? '' : ' non-empty') + ' text');
  if (value.length > maximum) throw new Error(label + ' is too long');
  return value;
}
function timestamp(value, label) {
  const result = text(value, label, 64, false);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || Number.isNaN(Date.parse(result))) throw new Error(label + ' must be an exact UTC millisecond timestamp');
  return result;
}
function digest(value, label) {
  const result = text(value, label, 71, false);
  if (!DIGEST.test(result)) throw new Error(label + ' must be an exact SHA-256 digest');
  return result;
}
function rawDigest(value, label) {
  const result = text(value, label, 64, false).toLowerCase();
  if (!RAW_DIGEST.test(result)) throw new Error(label + ' must be a raw SHA-256 digest');
  return result;
}
function withoutField(value, field) { const copy = clone(value); delete copy[field]; return copy; }
function policyDigest(policy) { return sha256(withoutField(policy, 'policyDigest')); }
function signingPayload(envelope) { return withoutField(envelope, 'signature'); }
function keyFingerprint(key) { return sha256(key.export({ type:'spki', format:'der' })); }
function actorForKey(keyId) { return ('host-key:' + keyId).slice(0, 120); }

function normalizeCandidate(input) {
  const body = input || {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('review candidate must be an object');
  const allowed = ['kind','title','sourceRef','artifactDigest','summary','requiredSeats','action','expiresAt'];
  const extras = Object.keys(body).filter(key => !allowed.includes(key));
  if (extras.length) throw new Error('review candidate has unknown fields: ' + extras.sort().join(', '));
  const artifactDigest = rawDigest(String(body.artifactDigest || '').toLowerCase(), 'review candidate artifactDigest');
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== '' && !Number.isFinite(Date.parse(body.expiresAt))) throw new Error('review candidate expiresAt is invalid');
  if (body.action !== undefined && body.action !== null && (typeof body.action !== 'object' || Array.isArray(body.action))) throw new Error('review candidate action must be an object or null');
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  const requiredSeats = body.requiredSeats === 'dual' ? 2 : Math.max(1, Math.min(10, Math.round(Number(body.requiredSeats) || 1)));
  return {
    kind: String(body.kind || 'proposal').slice(0, 80),
    title: String(body.title || 'Untitled proposal').slice(0, 180),
    sourceRef: String(body.sourceRef || '').slice(0, 300),
    artifactDigest,
    summary: String(body.summary || '').slice(0, 2000),
    requiredSeats,
    action: body.action && typeof body.action === 'object' && !Array.isArray(body.action) ? clone(body.action) : null,
    expiresAt
  };
}

function normalizePolicy(input, nowValue) {
  canonicalBytes(input, MAX_POLICY_BYTES, 'review trust policy');
  const policy = clone(input);
  exactKeys(policy, ['schema','policyId','authorityOrigin','issuedAt','expiresAt','submitterMayReview','keys','policyDigest'], 'review trust policy');
  if (policy.schema !== POLICY_SCHEMA) throw new Error('review trust policy schema mismatch');
  const policyId = text(policy.policyId, 'review trust policy id', 180, false);
  if (policy.authorityOrigin !== AUTHORITY_ORIGIN) throw new Error('review trust policy authority origin mismatch');
  const issuedAt = timestamp(policy.issuedAt, 'review trust policy issuedAt');
  const expiresAt = timestamp(policy.expiresAt, 'review trust policy expiresAt');
  const nowMs = Number(nowValue);
  if (!Number.isFinite(nowMs)) throw new Error('review trust policy verification time is invalid');
  if (Date.parse(issuedAt) > nowMs) throw new Error('review trust policy is not active yet');
  if (Date.parse(expiresAt) <= nowMs) throw new Error('review trust policy is expired');
  if (typeof policy.submitterMayReview !== 'boolean') throw new Error('review trust policy submitterMayReview must be boolean');
  if (!Array.isArray(policy.keys) || policy.keys.length < 1 || policy.keys.length > 10) throw new Error('review trust policy requires one to ten keys');
  const keyIds = new Set(), fingerprints = new Set();
  const keys = policy.keys.map((entry, index) => {
    const label = 'review trust policy key[' + index + ']';
    exactKeys(entry, ['keyId','algorithm','publicKeyPem','principalDigest','principalKind','roles','kinds','enabled'], label);
    const keyId = text(entry.keyId, label + '.keyId', 100, false);
    if (entry.algorithm !== 'Ed25519') throw new Error(label + '.algorithm must be Ed25519');
    if (typeof entry.publicKeyPem !== 'string' || entry.publicKeyPem.length > 8192 || !PUBLIC_KEY_PEM.test(entry.publicKeyPem)) throw new Error(label + '.publicKeyPem must be one SPKI public key PEM');
    let key;
    try { key = crypto.createPublicKey(entry.publicKeyPem); }
    catch (_) { throw new Error(label + '.publicKeyPem is invalid'); }
    if (key.asymmetricKeyType !== 'ed25519') throw new Error(label + '.publicKeyPem must be an Ed25519 public key');
    const fingerprint = keyFingerprint(key);
    const principalDigest = digest(entry.principalDigest, label + '.principalDigest');
    const principalKind = text(entry.principalKind, label + '.principalKind', 40, false);
    if (!PRINCIPAL_KINDS.includes(principalKind)) throw new Error(label + '.principalKind is unsupported');
    if (!Array.isArray(entry.roles) || !entry.roles.length || entry.roles.some(role => !ROLES.includes(role)) || new Set(entry.roles).size !== entry.roles.length) throw new Error(label + '.roles must contain unique supported roles');
    if (!Array.isArray(entry.kinds) || !entry.kinds.length || entry.kinds.length > 50 || entry.kinds.some(kind => typeof kind !== 'string' || !kind.trim() || kind !== kind.trim() || kind.length > 80) || new Set(entry.kinds).size !== entry.kinds.length) throw new Error(label + '.kinds must contain unique exact review kinds');
    if (typeof entry.enabled !== 'boolean') throw new Error(label + '.enabled must be boolean');
    if (keyIds.has(keyId)) throw new Error('review trust policy key ids must be unique');
    if (fingerprints.has(fingerprint)) throw new Error('review trust policy public-key fingerprints must be unique');
    keyIds.add(keyId); fingerprints.add(fingerprint);
    return { keyId, algorithm:'Ed25519', key, publicKeyPem:entry.publicKeyPem, fingerprint, principalDigest, principalKind, roles:entry.roles.slice(), kinds:entry.kinds.slice(), enabled:entry.enabled };
  }).sort((left, right) => left.keyId.localeCompare(right.keyId));
  const declaredDigest = digest(policy.policyDigest, 'review trust policy digest');
  const rebuiltDigest = policyDigest(policy);
  if (declaredDigest !== rebuiltDigest) throw new Error('review trust policy digest mismatch');
  return { schema:POLICY_SCHEMA, policyId, authorityOrigin:AUTHORITY_ORIGIN, issuedAt, expiresAt, submitterMayReview:policy.submitterMayReview, keys, policyDigest:rebuiltDigest };
}

function normalizeEnvelope(input, operation, policy, nowValue) {
  canonicalBytes(input, MAX_ENVELOPE_BYTES, 'authenticated review envelope');
  const envelope = clone(input);
  exactKeys(envelope, ['schema','envelopeId','operation','policyDigest','keyId','issuedAt','expiresAt','payload','signatureAlgorithm','signature'], 'authenticated review envelope');
  if (envelope.schema !== ENVELOPE_SCHEMA) throw new Error('authenticated review envelope schema mismatch');
  const envelopeId = text(envelope.envelopeId, 'authenticated review envelope id', 180, false);
  if (envelope.operation !== operation) throw new Error('authenticated review envelope operation mismatch');
  if (digest(envelope.policyDigest, 'authenticated review envelope policyDigest') !== policy.policyDigest) throw new Error('authenticated review envelope policy digest mismatch');
  const keyId = text(envelope.keyId, 'authenticated review envelope keyId', 100, false);
  const key = policy.keys.find(entry => entry.keyId === keyId);
  if (!key || !key.enabled) throw new Error('authenticated review envelope key is not enabled by the host policy');
  const role = operation === 'SUBMIT' ? 'review.submit' : 'review.vote';
  if (!key.roles.includes(role)) throw new Error('authenticated review envelope key lacks the required role');
  const issuedAt = timestamp(envelope.issuedAt, 'authenticated review envelope issuedAt');
  const expiresAt = timestamp(envelope.expiresAt, 'authenticated review envelope expiresAt');
  const nowMs = Number(nowValue);
  if (Date.parse(issuedAt) > nowMs) throw new Error('authenticated review envelope is not active yet');
  if (Date.parse(expiresAt) <= nowMs) throw new Error('authenticated review envelope is expired');
  if (Date.parse(issuedAt) < Date.parse(policy.issuedAt) || Date.parse(expiresAt) > Date.parse(policy.expiresAt)) throw new Error('authenticated review envelope falls outside the host policy window');
  if (envelope.signatureAlgorithm !== 'Ed25519') throw new Error('authenticated review envelope signatureAlgorithm must be Ed25519');
  const signature = text(envelope.signature, 'authenticated review envelope signature', 128, false);
  if (!BASE64.test(signature)) throw new Error('authenticated review envelope signature must be canonical base64');
  const signatureBytes = Buffer.from(signature, 'base64');
  if (signatureBytes.length !== 64 || signatureBytes.toString('base64') !== signature) throw new Error('authenticated review envelope signature must be one canonical Ed25519 signature');
  let verified = false;
  try { verified = crypto.verify(null, Buffer.from(stableStringify(signingPayload(envelope)), 'utf8'), key.key, signatureBytes); }
  catch (_) { verified = false; }
  if (!verified) throw new Error('authenticated review envelope signature is invalid');
  return { envelope, envelopeId, key, issuedAt, expiresAt };
}

function normalizeSubmitPayload(value, candidate, policy, key) {
  exactKeys(value, ['schema','candidateDigest','artifactDigest','kind','sourceRef'], 'authenticated review submit payload');
  if (value.schema !== SUBMIT_SCHEMA) throw new Error('authenticated review submit payload schema mismatch');
  const candidateDigest = digest(value.candidateDigest, 'authenticated review submit candidateDigest');
  const expectedDigest = sha256(candidate);
  if (candidateDigest !== expectedDigest) throw new Error('authenticated review submit candidate digest mismatch');
  if (rawDigest(value.artifactDigest, 'authenticated review submit artifactDigest') !== candidate.artifactDigest) throw new Error('authenticated review submit artifact digest mismatch');
  if (text(value.kind, 'authenticated review submit kind', 80, false) !== candidate.kind || text(value.sourceRef, 'authenticated review submit sourceRef', 300, true) !== candidate.sourceRef) throw new Error('authenticated review submit route mismatch');
  if (!key.kinds.includes('*') && !key.kinds.includes(candidate.kind)) throw new Error('authenticated review submit key is not enabled for this review kind');
  return { candidateDigest };
}

function normalizeVotePayload(value, item, policy, key) {
  exactKeys(value, ['schema','reviewId','artifactDigest','kind','sourceRef','verdict','note','informedExplanation'], 'authenticated review vote payload');
  if (value.schema !== VOTE_SCHEMA) throw new Error('authenticated review vote payload schema mismatch');
  const reviewId = text(value.reviewId, 'authenticated review vote reviewId', 180, false);
  if (reviewId !== item.id) throw new Error('authenticated review vote review id mismatch');
  if (rawDigest(value.artifactDigest, 'authenticated review vote artifactDigest') !== item.artifactDigest) throw new Error('authenticated review vote artifact digest mismatch');
  if (text(value.kind, 'authenticated review vote kind', 80, false) !== item.kind || text(value.sourceRef, 'authenticated review vote sourceRef', 300, true) !== item.sourceRef) throw new Error('authenticated review vote route mismatch');
  const verdict = text(value.verdict, 'authenticated review vote verdict', 10, false).toUpperCase();
  if (!VERDICTS.includes(verdict)) throw new Error('authenticated review vote verdict is unsupported');
  const note = text(value.note, 'authenticated review vote note', 1000, true);
  if (typeof value.informedExplanation !== 'boolean') throw new Error('authenticated review vote informedExplanation must be boolean');
  if (!key.kinds.includes('*') && !key.kinds.includes(item.kind)) throw new Error('authenticated review vote key is not enabled for this review kind');
  return { reviewId, verdict, note, informedExplanation:value.informedExplanation };
}

function candidateFromItem(item) {
  return normalizeCandidate({ kind:item.kind, title:item.title, sourceRef:item.sourceRef, artifactDigest:item.artifactDigest, summary:item.summary, requiredSeats:item.requiredSeats, action:item.action, expiresAt:item.expiresAt });
}
function sameCandidate(left, right) { return stableStringify(left) === stableStringify(right); }
function reservedReviewId(checked, candidate) {
  const material = { schema:'axm.authenticated-review-projection-id/v1', envelopeId:checked.envelopeId, policyDigest:checked.envelope.policyDigest, candidateDigest:sha256(candidate) };
  return 'review-auth-' + sha256(material).slice('sha256:'.length);
}
function closedForVote(item) { return ['SUPERSEDED','REJECTED','REPAIR','CANCELLED','EXPIRED'].includes(item.state); }

function create(options) {
  if (!options || !options.reviewService) throw new Error('review authority service requires ReviewService');
  const review = options.reviewService;
  if (typeof review.withExclusive !== 'function') throw new Error('review authority service requires shared Review Inbox operation serialization');
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const stateRoot = path.resolve(options.stateRoot || path.join(process.cwd(), 'state'));
  const policyFile = path.resolve(options.policyFile || path.join(stateRoot, 'review-inbox', 'trusted-review-keys.json'));
  const ledgerFile = path.join(stateRoot, 'review-inbox', 'authentication.json');

  function currentTimestamp() {
    const value = new Date(now()).toISOString();
    return timestamp(value, 'review authentication local record time');
  }
  function loadPolicy() {
    let source;
    if (options.reviewTrustPolicy) source = clone(options.reviewTrustPolicy);
    else {
      if (!fs.existsSync(policyFile)) throw new Error('host review trust policy is not configured');
      if (fs.statSync(policyFile).size > MAX_POLICY_BYTES) throw new Error('review trust policy exceeds the byte limit');
      source = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
    }
    return normalizePolicy(source, now());
  }
  function policyStatus() {
    try {
      const policy = loadPolicy();
      return { state:'READY', schema:policy.schema, policyId:policy.policyId, policyDigest:policy.policyDigest, authorityOrigin:policy.authorityOrigin, expiresAt:policy.expiresAt, enabledKeys:policy.keys.filter(key => key.enabled).length, realWorldIdentityProven:false, actualHumanParticipationProven:false, trustedTimeProven:false };
    } catch (error) {
      return { state:fs.existsSync(policyFile) || options.reviewTrustPolicy ? 'INVALID_POLICY' : 'NOT_CONFIGURED', schema:POLICY_SCHEMA, policyId:null, policyDigest:null, authorityOrigin:AUTHORITY_ORIGIN, expiresAt:null, enabledKeys:0, reason:String(error.message || error).slice(0,500), realWorldIdentityProven:false, actualHumanParticipationProven:false, trustedTimeProven:false };
    }
  }
  function legacyOperations(state) {
    if (!Array.isArray(state.records) || state.records.length > MAX_LEDGER_OPERATIONS) throw new Error('legacy review authentication ledger is invalid');
    const reviewIds = new Set(), envelopeIds = new Set(), operations = [];
    for (const record of state.records) {
      exactKeys(record, ['reviewId','submission','votes'], 'legacy review authentication record');
      const reviewId = text(record.reviewId, 'legacy review authentication reviewId', 180, false);
      if (reviewIds.has(reviewId) || (record.submission !== null && typeof record.submission !== 'object') || !Array.isArray(record.votes) || record.votes.length > 10) throw new Error('legacy review authentication record is invalid');
      reviewIds.add(reviewId);
      for (const entry of (record.submission ? [record.submission] : []).concat(record.votes)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !entry.envelope || !entry.proof) throw new Error('legacy review authentication evidence is invalid');
        const envelopeId = text(entry.envelope.envelopeId, 'legacy review authentication envelopeId', 180, false);
        if (envelopeIds.has(envelopeId)) throw new Error('review authentication ledger envelope ids are duplicated');
        envelopeIds.add(envelopeId);
        const operation = entry.envelope.operation;
        if (!['SUBMIT','VOTE'].includes(operation)) throw new Error('legacy review authentication operation is invalid');
        operations.push({ envelope:clone(entry.envelope), candidate:null, reviewId, recordedAt:timestamp(entry.proof.verifiedAt, 'legacy review authentication verifiedAt'), supersededBy:null });
      }
    }
    return operations;
  }
  function normalizeOperation(input, envelopeIds) {
    exactKeys(input, ['envelope','candidate','reviewId','recordedAt','supersededBy'], 'review authentication operation');
    if (!input.envelope || typeof input.envelope !== 'object' || Array.isArray(input.envelope)) throw new Error('review authentication operation envelope is invalid');
    const envelope = clone(input.envelope), envelopeId = text(envelope.envelopeId, 'review authentication operation envelopeId', 180, false);
    if (envelopeIds.has(envelopeId)) throw new Error('review authentication ledger envelope ids are duplicated');
    envelopeIds.add(envelopeId);
    if (!['SUBMIT','VOTE'].includes(envelope.operation)) throw new Error('review authentication operation kind is invalid');
    const reviewId = input.reviewId === null ? null : text(input.reviewId, 'review authentication operation reviewId', 180, false);
    let candidate = null;
    if (input.candidate !== null) {
      candidate = normalizeCandidate(input.candidate);
      if (!sameCandidate(candidate, input.candidate)) throw new Error('review authentication operation candidate is not exact normalized content');
      canonicalBytes(candidate, MAX_CANDIDATE_BYTES, 'review authentication operation candidate');
    }
    if (envelope.operation === 'SUBMIT' && !candidate && !reviewId) throw new Error('submission intent needs a candidate or legacy review binding');
    if (envelope.operation === 'VOTE' && (candidate !== null || !reviewId)) throw new Error('vote intent needs only an exact review binding');
    const supersededBy = input.supersededBy === null ? null : text(input.supersededBy, 'review authentication operation supersededBy', 180, false);
    if (envelope.operation !== 'VOTE' && supersededBy) throw new Error('only vote intents can be superseded');
    if (supersededBy === envelopeId) throw new Error('review authentication operation cannot supersede itself');
    return { envelope, candidate, reviewId, recordedAt:timestamp(input.recordedAt, 'review authentication operation recordedAt'), supersededBy };
  }
  function readLedger() {
    if (!fs.existsSync(ledgerFile)) return { schema:LEDGER_SCHEMA, version:2, operations:[] };
    if (fs.statSync(ledgerFile).size > MAX_LEDGER_BYTES) throw new Error('review authentication ledger exceeds the byte limit');
    const source = U.loadJson(ledgerFile, null);
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('review authentication ledger is invalid');
    let operations;
    if (source.schema === LEGACY_LEDGER_SCHEMA) {
      const extras = Object.keys(source).filter(key => !['schema','records','updatedAt'].includes(key));
      if (extras.length) throw new Error('legacy review authentication ledger has unknown fields');
      operations = legacyOperations(source);
    } else {
      exactKeys(source, ['schema','version','operations','updatedAt'], 'review authentication ledger');
      if (source.schema !== LEDGER_SCHEMA || source.version !== 2 || !Array.isArray(source.operations) || source.operations.length > MAX_LEDGER_OPERATIONS) throw new Error('review authentication ledger is invalid');
      timestamp(source.updatedAt, 'review authentication ledger updatedAt');
      const envelopeIds = new Set();
      operations = source.operations.map(operation => normalizeOperation(operation, envelopeIds));
      const known = new Map(operations.map(operation => [operation.envelope.envelopeId, operation]));
      operations.forEach(operation => {
        if (!operation.supersededBy) return;
        const target = known.get(operation.supersededBy);
        if (!target || target.envelope.operation !== 'VOTE' || target.reviewId !== operation.reviewId) throw new Error('review authentication vote supersession target is invalid');
      });
    }
    return { schema:LEDGER_SCHEMA, version:2, operations };
  }
  function writeLedger(state) {
    if (!state || !Array.isArray(state.operations) || state.operations.length > MAX_LEDGER_OPERATIONS) throw new Error('review authentication ledger operation limit exceeded');
    const value = { schema:LEDGER_SCHEMA, version:2, operations:clone(state.operations), updatedAt:currentTimestamp() };
    canonicalBytes(value, MAX_LEDGER_BYTES, 'review authentication ledger');
    U.atomicJson(ledgerFile, value);
  }
  function assertFreshEnvelope(state, envelopeId) {
    if (state.operations.some(operation => operation.envelope.envelopeId === envelopeId)) throw new Error('authenticated review envelope id was already used');
  }
  function submissionOperations(state, reviewId) { return state.operations.filter(operation => operation.envelope.operation === 'SUBMIT' && operation.reviewId === reviewId); }
  function voteOperations(state, reviewId) { return state.operations.filter(operation => operation.envelope.operation === 'VOTE' && operation.reviewId === reviewId); }
  function activeVoteOperations(state, reviewId) { return voteOperations(state, reviewId).filter(operation => !operation.supersededBy); }
  function verifyStoredSubmission(operation, item, policy) {
    if (!operation || operation.envelope.operation !== 'SUBMIT' || operation.reviewId !== item.id) throw new Error('stored authenticated submission review binding drifted');
    const candidate = candidateFromItem(item);
    if (operation.candidate && !sameCandidate(operation.candidate, candidate)) throw new Error('stored authenticated submission candidate drifted');
    const checked = normalizeEnvelope(operation.envelope, 'SUBMIT', policy, now());
    normalizeSubmitPayload(checked.envelope.payload, candidate, policy, checked.key);
    return checked;
  }
  function currentSubmission(state, item, policy) {
    const found = submissionOperations(state, item.id);
    if (found.length !== 1) throw new Error(found.length ? 'review item has ambiguous authenticated submission evidence' : 'review item has no authenticated submission evidence');
    return { operation:found[0], checked:verifyStoredSubmission(found[0], item, policy) };
  }
  function verifyStoredVote(operation, item, policy) {
    if (!operation || operation.envelope.operation !== 'VOTE' || operation.reviewId !== item.id) throw new Error('stored authenticated vote review binding drifted');
    const checked = normalizeEnvelope(operation.envelope, 'VOTE', policy, now());
    const payload = normalizeVotePayload(checked.envelope.payload, item, policy, checked.key);
    const actor = actorForKey(checked.key.keyId);
    const informedBindingRequired = item.kind === 'code-improvement-draft' && checked.key.principalKind !== 'machine';
    const matchingVote = Array.isArray(item.votes) && item.votes.find(vote => vote.actor === actor && vote.actorKind === checked.key.principalKind && vote.verdict === payload.verdict && vote.note === payload.note && vote.artifactDigest === item.artifactDigest && (!informedBindingRequired || vote.informedExplanation === payload.informedExplanation));
    return { checked, payload, actor, projected:!!matchingVote };
  }
  function laterVote(left, right) {
    const delta = Date.parse(left.checked.issuedAt) - Date.parse(right.checked.issuedAt);
    return delta > 0 || (delta === 0 && left.operation.envelope.envelopeId.localeCompare(right.operation.envelope.envelopeId) > 0);
  }
  function verifyVoteSupersessions(state, item, policy) {
    const groups = new Map();
    for (const operation of voteOperations(state, item.id)) {
      const verified = verifyStoredVote(operation, item, policy), principal = verified.checked.key.principalDigest;
      if (!groups.has(principal)) groups.set(principal, []);
      groups.get(principal).push({ operation, checked:verified.checked });
    }
    for (const group of groups.values()) {
      group.sort((left, right) => {
        const delta = Date.parse(left.checked.issuedAt) - Date.parse(right.checked.issuedAt);
        return delta || left.operation.envelope.envelopeId.localeCompare(right.operation.envelope.envelopeId);
      });
      group.forEach((entry, index) => {
        const expected = index + 1 < group.length ? group[index + 1].operation.envelope.envelopeId : null;
        if (entry.operation.supersededBy !== expected) throw new Error('stored authenticated vote supersession chain is not signed-order exact');
      });
    }
  }

  function submit(candidateInput, envelopeInput) {
    if (typeof review.submitReserved !== 'function') throw new Error('review service lacks reserved authenticated projection support');
    const candidate = normalizeCandidate(candidateInput);
    canonicalBytes(candidate, MAX_CANDIDATE_BYTES, 'normalized review candidate');
    const policy = loadPolicy(), checked = normalizeEnvelope(envelopeInput, 'SUBMIT', policy, now());
    normalizeSubmitPayload(checked.envelope.payload, candidate, policy, checked.key);
    const active = review.list().filter(item => item.kind === candidate.kind && item.sourceRef === candidate.sourceRef && item.artifactDigest === candidate.artifactDigest && !['REJECTED','SUPERSEDED','EXPIRED'].includes(item.state));
    if (active.length > 1) throw new Error('authenticated review candidate projection is ambiguous');
    if (active[0] && !sameCandidate(candidate, candidateFromItem(active[0]))) throw new Error('existing review item does not match the signed normalized candidate');
    if (active[0] && active[0].state === 'REPAIR') throw new Error('repair needs a changed plan digest before review can reopen');
    const reviewId = active[0] ? active[0].id : reservedReviewId(checked, candidate);
    const state = readLedger();
    assertFreshEnvelope(state, checked.envelopeId);
    if (state.operations.some(operation => operation.envelope.operation === 'SUBMIT' && operation.candidate && sha256(operation.candidate) === sha256(candidate))) throw new Error('exact candidate already has a signed submission intent');
    if (submissionOperations(state, reviewId).length) throw new Error('review item already has authenticated submission evidence');
    state.operations.push({ envelope:checked.envelope, candidate, reviewId, recordedAt:currentTimestamp(), supersededBy:null });
    writeLedger(state);
    const item = active[0] || review.submitReserved(candidate, reviewId);
    if (!item || item.id !== reviewId || !sameCandidate(candidate, candidateFromItem(item))) throw new Error('signed submission intent is durable but Review Inbox projection did not match');
    return { item, authority:assess(item) };
  }

  function vote(envelopeInput) {
    const policy = loadPolicy(), checked = normalizeEnvelope(envelopeInput, 'VOTE', policy, now());
    const item = review.get(checked.envelope.payload && checked.envelope.payload.reviewId);
    if (!item) throw new Error('authenticated review vote item not found');
    if (closedForVote(item)) throw new Error('authenticated review vote item is closed');
    const payload = normalizeVotePayload(checked.envelope.payload, item, policy, checked.key);
    const state = readLedger();
    assertFreshEnvelope(state, checked.envelopeId);
    let submission;
    try { submission = currentSubmission(state, item, policy); }
    catch (_) { throw new Error('authenticated review vote requires a current valid authenticated submission'); }
    if (!policy.submitterMayReview && submission.checked.key.principalDigest === checked.key.principalDigest) throw new Error('host review policy separates submitter and reviewer principals');
    verifyVoteSupersessions(state, item, policy);
    const incoming = { operation:{ envelope:checked.envelope }, checked };
    for (const prior of activeVoteOperations(state, item.id)) {
      let verified;
      try { verified = verifyStoredVote(prior, item, policy); }
      catch (_) { throw new Error('existing authenticated vote evidence is invalid'); }
      if (verified.checked.key.principalDigest === checked.key.principalDigest) {
        if (!laterVote(incoming, { operation:prior, checked:verified.checked })) throw new Error('replacement signed vote must be later in signed order');
        prior.supersededBy = checked.envelopeId;
      }
    }
    state.operations.push({ envelope:checked.envelope, candidate:null, reviewId:item.id, recordedAt:currentTimestamp(), supersededBy:null });
    writeLedger(state);
    const updated = review.vote(item.id, { actor:actorForKey(checked.key.keyId), actorKind:checked.key.principalKind, verdict:payload.verdict, note:payload.note, artifactDigest:item.artifactDigest, informedExplanation:payload.informedExplanation });
    return { item:updated, authority:assess(updated) };
  }

  function baseView(item) {
    return {
      schema:VIEW_SCHEMA, status:STATUS, reviewId:item && item.id || null, artifactDigest:item && item.artifactDigest || null,
      reviewState:item && item.state || 'MISSING', authorityState:'HELD', reasonCode:'REVIEW_ITEM_MISSING', projectionState:'NONE', pendingProjectionEnvelopeIds:[],
      submissionAssurance:'NONE', requiredSeats:item && item.requiredSeats || 0, authenticatedApprovalSeats:0, authenticatedHoldSeats:0, authenticatedRejectSeats:0, authenticatedPrincipalDigests:[],
      policy:policyStatus(),
      truth:{ hostConfiguredPolicyActive:false, authenticationIntentPersisted:false, reviewProjectionVerified:false, submissionKeyPossessionVerified:false, reviewKeyPossessionVerified:false, distinctAuthenticatedPrincipalsVerified:false, automaticRecovery:false, browserRecoveryRoute:false, crossFileAtomicityProven:false, multiProcessSerializationProven:false, rollbackPreventionProven:false, externalCustodyProven:false, realWorldIdentityProven:false, actualHumanParticipationProven:false, trustedTimeProven:false, reconciliationAuthorized:false, executionAuthorized:false, adoptionAuthorized:false, permissionGranted:false, promotionAuthorized:false, mergeAuthorized:false, canonAuthorized:false, foundationMutationAuthorized:false }
    };
  }
  function assess(itemInput) {
    const item = itemInput && itemInput.id ? JSON.parse(JSON.stringify(itemInput)) : null, base = baseView(item);
    if (!item) return base;
    let policy;
    try { policy = loadPolicy(); base.truth.hostConfiguredPolicyActive = true; }
    catch (_) { base.reasonCode = policyStatus().state === 'NOT_CONFIGURED' ? 'HOST_TRUST_POLICY_NOT_CONFIGURED' : 'HOST_TRUST_POLICY_INVALID'; return base; }
    let state;
    try { state = readLedger(); }
    catch (_) { base.reasonCode = 'AUTHENTICATION_LEDGER_INVALID'; base.projectionState = 'INVALID'; return base; }
    let submission;
    try { submission = currentSubmission(state, item, policy); }
    catch (error) {
      base.reasonCode = /no authenticated submission/.test(error.message) ? 'AUTHENTICATED_SUBMISSION_MISSING' : 'AUTHENTICATED_SUBMISSION_INVALID';
      base.projectionState = /no authenticated submission/.test(error.message) ? 'NONE' : 'INVALID';
      return base;
    }
    base.submissionAssurance = 'HOST_TRUSTED_KEY_POSSESSION';
    base.projectionState = 'PROJECTED';
    base.truth.authenticationIntentPersisted = true;
    base.truth.reviewProjectionVerified = true;
    base.truth.submissionKeyPossessionVerified = true;
    const principals = new Map();
    let invalidVoteEvidence = false;
    try { verifyVoteSupersessions(state, item, policy); }
    catch (_) { base.reasonCode = 'AUTHENTICATED_VOTE_EVIDENCE_INVALID'; base.projectionState = 'INVALID'; return base; }
    for (const operation of activeVoteOperations(state, item.id)) {
      try {
        const verified = verifyStoredVote(operation, item, policy);
        if (!policy.submitterMayReview && verified.checked.key.principalDigest === submission.checked.key.principalDigest) { invalidVoteEvidence = true; continue; }
        const value = { operation, checked:verified.checked, payload:verified.payload, projected:verified.projected };
        const prior = principals.get(verified.checked.key.principalDigest);
        if (!prior || laterVote(value, prior)) principals.set(verified.checked.key.principalDigest, value);
      } catch (_) { invalidVoteEvidence = true; }
    }
    const values = Array.from(principals.values());
    const projected = values.filter(value => value.projected);
    const pending = values.filter(value => !value.projected);
    base.authenticatedApprovalSeats = projected.filter(value => value.payload.verdict === 'APPROVE').length;
    base.authenticatedHoldSeats = projected.filter(value => value.payload.verdict === 'HOLD').length;
    base.authenticatedRejectSeats = projected.filter(value => value.payload.verdict === 'REJECT').length;
    base.authenticatedPrincipalDigests = projected.map(value => value.checked.key.principalDigest).sort();
    base.pendingProjectionEnvelopeIds = pending.map(value => value.operation.envelope.envelopeId).sort();
    base.truth.reviewKeyPossessionVerified = values.length > 0;
    base.truth.distinctAuthenticatedPrincipalsVerified = values.length > 0 && values.length === principals.size;
    if (invalidVoteEvidence) { base.reasonCode = 'AUTHENTICATED_VOTE_EVIDENCE_INVALID'; base.projectionState = 'INVALID'; return base; }
    if (pending.length) { base.reasonCode = 'AUTHENTICATED_VOTE_PROJECTION_PENDING'; base.projectionState = 'PENDING'; return base; }
    if (item.state !== 'APPROVED') { base.reasonCode = 'REVIEW_ITEM_NOT_APPROVED'; return base; }
    if (base.authenticatedRejectSeats || base.authenticatedHoldSeats) { base.reasonCode = 'AUTHENTICATED_CONFLICTING_VOTE'; return base; }
    if (base.authenticatedApprovalSeats < item.requiredSeats) { base.reasonCode = 'AUTHENTICATED_SEAT_THRESHOLD_NOT_MET'; return base; }
    base.authorityState = 'HOST_KEY_AUTHENTICATED_APPROVED';
    base.reasonCode = 'HOST_CONFIGURED_KEY_POSSESSION_THRESHOLD_MET';
    return base;
  }

  function operationStatus(operation, state, policy) {
    const envelopeId = operation.envelope.envelopeId, kind = operation.envelope.operation;
    if (kind === 'SUBMIT') {
      const item = operation.reviewId && review.get(operation.reviewId);
      if (item) {
        try { verifyStoredSubmission(operation, item, policy); return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'PROJECTED', reasonCode:'EXACT_REVIEW_ITEM_PRESENT', recoveryAvailable:false }; }
        catch (_) { return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'INVALID', reasonCode:'SUBMISSION_INTENT_OR_PROJECTION_INVALID', recoveryAvailable:false }; }
      }
      if (!operation.candidate) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'BLOCKED', reasonCode:'LEGACY_SUBMISSION_CANDIDATE_UNAVAILABLE', recoveryAvailable:false };
      try {
        const checked = normalizeEnvelope(operation.envelope, 'SUBMIT', policy, now());
        normalizeSubmitPayload(checked.envelope.payload, operation.candidate, policy, checked.key);
      } catch (_) { return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'INVALID', reasonCode:'SUBMISSION_INTENT_INVALID', recoveryAvailable:false }; }
      const conflict = review.list().find(itemValue => itemValue.id !== operation.reviewId && itemValue.kind === operation.candidate.kind && itemValue.sourceRef === operation.candidate.sourceRef && itemValue.artifactDigest === operation.candidate.artifactDigest && !['REJECTED','SUPERSEDED','EXPIRED'].includes(itemValue.state));
      if (conflict) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'BLOCKED', reasonCode:'RESERVED_REVIEW_ID_CONFLICT', recoveryAvailable:false };
      return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'PENDING', reasonCode:'SIGNED_SUBMISSION_PROJECTION_PENDING', recoveryAvailable:true };
    }
    const item = operation.reviewId && review.get(operation.reviewId);
    if (!item) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'BLOCKED', reasonCode:'REVIEW_ITEM_MISSING', recoveryAvailable:false };
    try {
      verifyVoteSupersessions(state, item, policy);
      const submission = currentSubmission(state, item, policy), verified = verifyStoredVote(operation, item, policy);
      if (operation.supersededBy) {
        const replacement = state.operations.find(entry => entry.envelope.envelopeId === operation.supersededBy);
        if (!replacement) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'INVALID', reasonCode:'VOTE_SUPERSESSION_TARGET_MISSING', recoveryAvailable:false };
        const replacementVerified = verifyStoredVote(replacement, item, policy);
        if (replacementVerified.checked.key.principalDigest !== verified.checked.key.principalDigest) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'INVALID', reasonCode:'VOTE_SUPERSESSION_PRINCIPAL_MISMATCH', recoveryAvailable:false };
        return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'SUPERSEDED', reasonCode:'NEWER_SIGNED_VOTE_INTENT_RECORDED', recoveryAvailable:false };
      }
      if (!policy.submitterMayReview && submission.checked.key.principalDigest === verified.checked.key.principalDigest) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'INVALID', reasonCode:'SUBMITTER_REVIEWER_SEPARATION_VIOLATED', recoveryAvailable:false };
      if (verified.projected) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'PROJECTED', reasonCode:'EXACT_REVIEW_VOTE_PRESENT', recoveryAvailable:false };
      if (closedForVote(item)) return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'BLOCKED', reasonCode:'REVIEW_ITEM_CLOSED', recoveryAvailable:false };
      return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'PENDING', reasonCode:'SIGNED_VOTE_PROJECTION_PENDING', recoveryAvailable:true };
    } catch (_) { return { envelopeId, operation:kind, reviewId:operation.reviewId, state:'INVALID', reasonCode:'VOTE_INTENT_OR_SUBMISSION_INVALID', recoveryAvailable:false }; }
  }
  function projectionStatus() {
    const truth = { automaticRecovery:false, browserRecoveryRoute:false, explicitHostConfirmationRequired:true, crossFileAtomicityProven:false, multiProcessSerializationProven:false, rollbackPreventionProven:false, externalCustodyProven:false, realWorldIdentityProven:false, actualHumanParticipationProven:false, executionAuthorized:false, reconciliationAuthorized:false, canonAuthorized:false };
    let policy, state;
    try { policy = loadPolicy(); }
    catch (_) { return { schema:RECOVERY_STATUS_SCHEMA, status:STATUS, state:'HELD', reasonCode:policyStatus().state === 'NOT_CONFIGURED' ? 'HOST_TRUST_POLICY_NOT_CONFIGURED' : 'HOST_TRUST_POLICY_INVALID', totalOperations:0, projectedOperations:0, supersededOperations:0, pendingOperations:0, blockedOperations:0, invalidOperations:0, operations:[], operationsTruncated:false, confirmationRequired:RECOVERY_CONFIRMATION, truth }; }
    try { state = readLedger(); }
    catch (_) { return { schema:RECOVERY_STATUS_SCHEMA, status:STATUS, state:'HELD', reasonCode:'AUTHENTICATION_LEDGER_INVALID', totalOperations:0, projectedOperations:0, supersededOperations:0, pendingOperations:0, blockedOperations:0, invalidOperations:0, operations:[], operationsTruncated:false, confirmationRequired:RECOVERY_CONFIRMATION, truth }; }
    const details = state.operations.map(operation => operationStatus(operation, state, policy));
    const pending = details.filter(detail => detail.state === 'PENDING').length, blocked = details.filter(detail => detail.state === 'BLOCKED').length, invalid = details.filter(detail => detail.state === 'INVALID').length;
    return { schema:RECOVERY_STATUS_SCHEMA, status:STATUS, state:invalid || blocked ? 'HELD' : pending ? 'RECOVERY_REQUIRED' : 'CURRENT', reasonCode:invalid ? 'INVALID_SIGNED_PROJECTION_EVIDENCE' : blocked ? 'SIGNED_PROJECTION_BLOCKED' : pending ? 'SIGNED_PROJECTION_PENDING' : 'ALL_CURRENT_SIGNED_INTENTS_PROJECTED', totalOperations:details.length, projectedOperations:details.filter(detail => detail.state === 'PROJECTED').length, supersededOperations:details.filter(detail => detail.state === 'SUPERSEDED').length, pendingOperations:pending, blockedOperations:blocked, invalidOperations:invalid, operations:details.slice(-MAX_RECOVERY_VIEW_OPERATIONS), operationsTruncated:details.length > MAX_RECOVERY_VIEW_OPERATIONS, confirmationRequired:RECOVERY_CONFIRMATION, truth };
  }
  function recoverProjection(envelopeIdInput, confirmation) {
    const envelopeId = text(envelopeIdInput, 'review projection recovery envelopeId', 180, false);
    if (confirmation !== RECOVERY_CONFIRMATION) throw new Error('exact signed review projection recovery confirmation is required');
    const policy = loadPolicy(), state = readLedger(), operation = state.operations.find(entry => entry.envelope.envelopeId === envelopeId);
    if (!operation) throw new Error('signed review projection intent not found');
    if (operation.supersededBy) throw new Error('superseded signed vote projection cannot be recovered');
    let item, result = 'PROJECTED';
    if (operation.envelope.operation === 'SUBMIT') {
      item = operation.reviewId && review.get(operation.reviewId);
      if (item) { verifyStoredSubmission(operation, item, policy); result = 'ALREADY_PROJECTED'; }
      else {
        if (!operation.candidate) throw new Error('legacy signed submission has no recoverable candidate');
        const checked = normalizeEnvelope(operation.envelope, 'SUBMIT', policy, now());
        normalizeSubmitPayload(checked.envelope.payload, operation.candidate, policy, checked.key);
        item = review.submitReserved(operation.candidate, operation.reviewId);
        verifyStoredSubmission(operation, item, policy);
      }
    } else {
      item = operation.reviewId && review.get(operation.reviewId);
      if (!item) throw new Error('signed vote projection review item is missing');
      const submission = currentSubmission(state, item, policy), verified = verifyStoredVote(operation, item, policy);
      if (!policy.submitterMayReview && submission.checked.key.principalDigest === verified.checked.key.principalDigest) throw new Error('host review policy separates submitter and reviewer principals');
      if (verified.projected) result = 'ALREADY_PROJECTED';
      else {
        if (closedForVote(item)) throw new Error('signed vote projection review item is closed');
        item = review.vote(item.id, { actor:verified.actor, actorKind:verified.checked.key.principalKind, verdict:verified.payload.verdict, note:verified.payload.note, artifactDigest:item.artifactDigest, informedExplanation:verified.payload.informedExplanation });
      }
    }
    return { schema:RECOVERY_RESULT_SCHEMA, status:STATUS, envelopeId, operation:operation.envelope.operation, result, item, authority:assess(item), truth:{ signedIntentReverified:true, explicitHostConfirmationReceived:true, automaticRecovery:false, browserRecoveryRoute:false, crossFileAtomicityProven:false, rollbackPreventionProven:false, externalCustodyProven:false, realWorldIdentityProven:false, actualHumanParticipationProven:false, reconciliationAuthorized:false, executionAuthorized:false, canonAuthorized:false } };
  }
  function assessAll(items) {
    const byReviewId = {};
    (Array.isArray(items) ? items : []).forEach(item => { byReviewId[item.id] = assess(item); });
    return { schema:INDEX_SCHEMA, status:STATUS, policy:policyStatus(), recovery:projectionStatus(), byReviewId };
  }
  function authenticatedApproved(id, artifactDigest) {
    const item = review.get(id);
    if (!item || item.artifactDigest !== String(artifactDigest || '').toLowerCase()) return false;
    return assess(item).authorityState === 'HOST_KEY_AUTHENTICATED_APPROVED';
  }

  return {
    POLICY_SCHEMA, ENVELOPE_SCHEMA, SUBMIT_SCHEMA, VOTE_SCHEMA, VIEW_SCHEMA, INDEX_SCHEMA, LEDGER_SCHEMA, LEGACY_LEDGER_SCHEMA,
    RECOVERY_STATUS_SCHEMA, RECOVERY_RESULT_SCHEMA, RECOVERY_CONFIRMATION, AUTHORITY_ORIGIN, STATUS, policyFile, ledgerFile,
    policyStatus, projectionStatus,
    recoverProjection:(envelopeId, confirmation) => review.withExclusive(() => recoverProjection(envelopeId, confirmation)),
    submit:(candidate, envelope) => review.withExclusive(() => submit(candidate, envelope)),
    vote:envelope => review.withExclusive(() => vote(envelope)),
    assess, assessAll, authenticatedApproved
  };
}

module.exports = { POLICY_SCHEMA, ENVELOPE_SCHEMA, SUBMIT_SCHEMA, VOTE_SCHEMA, VIEW_SCHEMA, INDEX_SCHEMA, LEDGER_SCHEMA, LEGACY_LEDGER_SCHEMA, RECOVERY_STATUS_SCHEMA, RECOVERY_RESULT_SCHEMA, RECOVERY_CONFIRMATION, AUTHORITY_ORIGIN, STATUS, MAX_POLICY_BYTES, MAX_CANDIDATE_BYTES, MAX_ENVELOPE_BYTES, MAX_LEDGER_BYTES, MAX_LEDGER_OPERATIONS, MAX_RECOVERY_VIEW_OPERATIONS, stableStringify, sha256, policyDigest, signingPayload, normalizeCandidate, normalizePolicy, reservedReviewId, create };
