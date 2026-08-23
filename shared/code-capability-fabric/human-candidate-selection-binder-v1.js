'use strict';

const Consent = require('./grounded-consent-scope-v1');
const Repair = require('./workshop-contract-repair-planner-v1');

const VERSION = '1.0.0';
const DECLARATION_SCHEMA = 'axm.human-candidate-selection-declaration/v1';
const LEDGER_SCHEMA = 'axm.selection-replay-ledger-snapshot/v1';
const EVALUATION_SCHEMA = 'axm.human-candidate-selection-evaluation/v1';
const SCOPE = 'DETACHED_SELECTION_BINDING';
const ROOTS = ['TRUTH', 'AGENCY_NON_DOMINATION', 'CONTINUITY', 'WISDOM_OVER_SPEED'];
const MAX_DECLARATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const STATUSES = new Set([
  'CANDIDATE_HOLD',
  'CONSENT_EVALUATION_HOLD',
  'CONSENT_INSTANCE_HOLD',
  'CONSENT_BINDING_HOLD',
  'DECLARATION_HOLD',
  'LEDGER_HOLD',
  'BINDING_HOLD',
  'SELECTED_BYTES_HOLD',
  'TIME_WINDOW_HOLD',
  'REPLAY_HOLD',
  'AUTHENTICATION_REQUIRED'
]);
const LIMITATIONS = [
  'DECLARATION_IS_NOT_IDENTITY_AUTHENTICATION',
  'NATURAL_PERSON_IDENTITY_NOT_PROVEN',
  'INFORMED_UNDERSTANDING_NOT_PROVEN',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'PROVIDED_REPLAY_LEDGER_NOT_INDEPENDENTLY_TRUSTED',
  'ROOT_EVIDENCE_CONTENT_NOT_VERIFIED',
  'SELECTED_CANDIDATE_BYTES_NOT_RETAINED',
  'LIVE_REVOCATION_NOT_CHECKED',
  'HOST_AUTHORIZATION_NOT_GRANTED',
  'SEMANTIC_FITNESS_REMAINS_HUMAN_JUDGMENT',
  'SELECTION_DOES_NOT_AUTHORIZE_EXECUTION_OR_LIFECYCLE_CHANGE'
];
const STAGED_TRUTH_FIELDS = [
  'candidateIntegrityVerified',
  'consentEvaluationIntegrityVerified',
  'consentInstanceIntegrityVerified',
  'consentSubjectBound',
  'declarationIntegrityVerified',
  'candidateChoiceReferenceBound',
  'selectedCandidateBytesVerified',
  'declaredTimeWindowValid',
  'nonceAbsentFromProvidedLedger'
];
const FALSE_CEILING_FIELDS = [
  'authenticatedHumanDecisionVerified',
  'naturalPersonIdentityProven',
  'informedUnderstandingProven',
  'trustedClockObserved',
  'liveRevocationChecked',
  'replayLedgerIndependentlyTrusted',
  'hostAuthorizationGranted',
  'candidateExecuted',
  'testsExecuted',
  'sourceWritten',
  'permissionsChanged',
  'installed',
  'integrated',
  'published',
  'promoted',
  'canonChanged'
];
const TRUTH_FIELDS = [...STAGED_TRUTH_FIELDS, ...FALSE_CEILING_FIELDS];
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function clone(value) { return Repair.clone(value); }
function same(left, right) { return Repair.same(left, right); }
function hash(value) { return Repair.hashValue(value); }
function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function exact(value, fields, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = fields.slice().sort(compareText);
  const missing = expected.filter((field) => !actual.includes(field));
  const extras = actual.filter((field) => !expected.includes(field));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.join(', '));
  if (extras.length) throw new Error(label + ' has unsupported fields: ' + extras.join(', '));
}

function identifier(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(label + ' must be a portable identifier');
  return value;
}

function token(value, label) {
  if (typeof value !== 'string' || !TOKEN.test(value)) throw new Error(label + ' must be a portable contract token');
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !UTC.test(value)) throw new Error(label + ' must be a canonical UTC timestamp');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new Error(label + ' must be a valid canonical UTC timestamp');
  return value;
}

function text(value, label, maximum = 1000) {
  if (typeof value !== 'string' || !value.length || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(label + ' must be bounded canonical text');
  }
  return value;
}

function reference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return { id: identifier(value.id, label + '.id'), schema: token(value.schema, label + '.schema'), sha256: digest(value.sha256, label + '.sha256') };
}

function digestReference(value, label) {
  exact(value, ['schema', 'sha256'], label);
  return { schema: token(value.schema, label + '.schema'), sha256: digest(value.sha256, label + '.sha256') };
}

function fileReference(value, label) {
  return Repair.fileRef(value, label);
}

function evidenceReferences(values, label) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 8) throw new Error(label + ' must contain from 1 to 8 references');
  const normalized = values.map((value, index) => reference(value, label + '[' + index + ']'))
    .sort((left, right) => compareText(Repair.canonical(left), Repair.canonical(right)));
  if (new Set(normalized.map(Repair.canonical)).size !== normalized.length) throw new Error(label + ' contains duplicate references');
  return normalized;
}

function rootsGate(value) {
  if (!Array.isArray(value) || value.length !== ROOTS.length) throw new Error('selection declaration rootsGate must contain the four roots');
  return value.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'selection declaration.rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index] || entry.verdict !== 'PASS') throw new Error('selection declaration rootsGate must preserve ordered PASS roots');
    const evidenceRefs = evidenceReferences(entry.evidenceRefs, 'selection declaration.rootsGate[' + index + '].evidenceRefs');
    if (evidenceRefs.some((ref) => ref.schema !== 'axm.four-root-technical-review/v1')) {
      throw new Error('selection declaration rootsGate evidence schema is unsupported');
    }
    return { root: entry.root, verdict: 'PASS', evidenceRefs };
  });
}

function selectedAlternative(value, label) {
  exact(value, ['id', 'kind', 'candidateRef'], label);
  if (!Repair.ALLOWED_KINDS.includes(value.kind) || value.id !== 'kind-' + value.kind) throw new Error(label + ' kind and id disagree');
  return { id: value.id, kind: value.kind, candidateRef: fileReference(value.candidateRef, label + '.candidateRef') };
}

function declarationCore(value) {
  exact(value, [
    'schema', 'version', 'status', 'id', 'seatRef', 'candidateRef', 'selection',
    'consentEvaluationRef', 'consentInstanceRef', 'scope', 'issuedAt', 'expiresAt', 'nonce',
    'rootsGate', 'authentication', 'revocation', 'authority'
  ], 'selection declaration');
  if (value.schema !== DECLARATION_SCHEMA || value.version !== VERSION || value.status !== 'DECLARED_NOT_AUTHENTICATED') {
    throw new Error('selection declaration identity drifted');
  }
  if (value.scope !== SCOPE || value.authentication !== 'NOT_PROVEN' || value.revocation !== 'NOT_CHECKED' || value.authority !== 'NONE') {
    throw new Error('selection declaration exceeds inert authority');
  }
  const issuedAt = timestamp(value.issuedAt, 'selection declaration.issuedAt');
  const expiresAt = timestamp(value.expiresAt, 'selection declaration.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(issuedAt) || Date.parse(expiresAt) - Date.parse(issuedAt) > MAX_DECLARATION_WINDOW_MS) {
    throw new Error('selection declaration time window is invalid or exceeds one day');
  }
  const seatRef = reference(value.seatRef, 'selection declaration.seatRef');
  if (seatRef.schema !== 'axm.human-review-seat/v1') throw new Error('selection declaration seat schema is unsupported');
  return {
    schema: DECLARATION_SCHEMA,
    version: VERSION,
    status: 'DECLARED_NOT_AUTHENTICATED',
    id: identifier(value.id, 'selection declaration.id'),
    seatRef,
    candidateRef: reference(value.candidateRef, 'selection declaration.candidateRef'),
    selection: selectedAlternative(value.selection, 'selection declaration.selection'),
    consentEvaluationRef: digestReference(value.consentEvaluationRef, 'selection declaration.consentEvaluationRef'),
    consentInstanceRef: reference(value.consentInstanceRef, 'selection declaration.consentInstanceRef'),
    scope: SCOPE,
    issuedAt,
    expiresAt,
    nonce: identifier(value.nonce, 'selection declaration.nonce'),
    rootsGate: rootsGate(value.rootsGate),
    authentication: 'NOT_PROVEN',
    revocation: 'NOT_CHECKED',
    authority: 'NONE'
  };
}

function sealDeclaration(value) {
  const core = declarationCore(value);
  return { ...core, declarationDigest: hash(core) };
}

function normalizeDeclaration(value) {
  exact(value, [
    'schema', 'version', 'status', 'id', 'seatRef', 'candidateRef', 'selection',
    'consentEvaluationRef', 'consentInstanceRef', 'scope', 'issuedAt', 'expiresAt', 'nonce',
    'rootsGate', 'authentication', 'revocation', 'authority', 'declarationDigest'
  ], 'selection declaration');
  const { declarationDigest, ...unsealed } = value;
  const sealed = sealDeclaration(unsealed);
  if (sealed.declarationDigest !== digest(declarationDigest, 'selection declaration.declarationDigest')) {
    throw new Error('selection declaration digest mismatch');
  }
  if (!same(sealed, value)) throw new Error('selection declaration is not in canonical normalized form');
  return sealed;
}

function declarationReference(value) {
  const declaration = normalizeDeclaration(value);
  return { id: declaration.id, schema: declaration.schema, sha256: declaration.declarationDigest };
}

function ledgerCore(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'observedAt', 'consumedNonces', 'authority'], 'selection replay ledger');
  if (value.schema !== LEDGER_SCHEMA || value.version !== VERSION || value.status !== 'HOST_SNAPSHOT_DECLARED' || value.authority !== 'NONE') {
    throw new Error('selection replay ledger identity drifted');
  }
  if (!Array.isArray(value.consumedNonces) || value.consumedNonces.length > 1024) throw new Error('selection replay ledger is unbounded');
  const consumedNonces = value.consumedNonces.map((nonce, index) => identifier(nonce, 'selection replay ledger.consumedNonces[' + index + ']')).sort(compareText);
  if (new Set(consumedNonces).size !== consumedNonces.length) throw new Error('selection replay ledger contains duplicate nonces');
  return {
    schema: LEDGER_SCHEMA,
    version: VERSION,
    status: 'HOST_SNAPSHOT_DECLARED',
    id: identifier(value.id, 'selection replay ledger.id'),
    observedAt: timestamp(value.observedAt, 'selection replay ledger.observedAt'),
    consumedNonces,
    authority: 'NONE'
  };
}

function sealLedger(value) {
  const core = ledgerCore(value);
  return { ...core, ledgerDigest: hash(core) };
}

function normalizeLedger(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'observedAt', 'consumedNonces', 'authority', 'ledgerDigest'], 'selection replay ledger');
  const { ledgerDigest, ...unsealed } = value;
  const sealed = sealLedger(unsealed);
  if (sealed.ledgerDigest !== digest(ledgerDigest, 'selection replay ledger.ledgerDigest')) throw new Error('selection replay ledger digest mismatch');
  if (!same(sealed, value)) throw new Error('selection replay ledger is not in canonical normalized form');
  return sealed;
}

function ledgerReference(value) {
  const ledger = normalizeLedger(value);
  return { id: ledger.id, schema: ledger.schema, sha256: ledger.ledgerDigest };
}

function candidateReference(candidate) {
  return { id: candidate.id, schema: candidate.schema, sha256: candidate.candidateDigest };
}

function consentEvaluationReference(evaluation) {
  return { schema: evaluation.schema, sha256: evaluation.evaluationDigest };
}

function emptyTruth() {
  return Object.fromEntries(TRUTH_FIELDS.map((field) => [field, false]));
}

function evaluationCore(status, details = {}) {
  if (!STATUSES.has(status)) throw new Error('selection evaluation status is unsupported');
  const core = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    status,
    evaluatedAt: details.evaluatedAt || null,
    candidateRef: details.candidateRef || null,
    consentEvaluationRef: details.consentEvaluationRef || null,
    consentInstanceRef: details.consentInstanceRef || null,
    declarationRef: details.declarationRef || null,
    replayLedgerRef: details.replayLedgerRef || null,
    selectedAlternative: details.selectedAlternative || null,
    effect: 'INERT_REVIEW_BINDING',
    holds: (details.holds || []).slice(),
    limitations: LIMITATIONS.slice(),
    nextGate: status === 'AUTHENTICATION_REQUIRED'
      ? 'AUTHENTICATE_EXACT_DECLARATION_WITH_TRUSTED_CLOCK_LIVE_REVOCATION_AND_HOST_AUTHORIZATION'
      : 'REPAIR_SELECTION_INPUTS_THEN_REEVALUATE',
    truth: { ...emptyTruth(), ...(details.truth || {}) },
    authority: 'NONE'
  };
  return { ...core, evaluationDigest: hash(core) };
}

function hold(status, details, message) {
  return evaluationCore(status, { ...details, holds: [...(details.holds || []), message] });
}

function noLifecycleAuthority(instance) {
  return Object.values(instance.lifecycle).every((value) => value === false);
}

function selectedBytes(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) throw new Error('selected candidate bytes must be a Buffer or Uint8Array');
  const normalized = Buffer.from(value);
  if (!normalized.length || normalized.length > 8 * 1024 * 1024) throw new Error('selected candidate bytes exceed the bounded in-memory envelope');
  return normalized;
}

function evaluateSelection(input) {
  exact(input, ['candidate', 'consentEvaluation', 'consentInstance', 'declaration', 'selectedCandidateBytes', 'replayLedger', 'evaluatedAt'], 'selection evaluation input');
  const details = { truth: {} };
  let candidate;
  try {
    candidate = Repair.normalizeCandidate(input.candidate);
  } catch (error) {
    return hold('CANDIDATE_HOLD', details, 'CANDIDATE_INVALID:' + error.message);
  }
  details.candidateRef = candidateReference(candidate);
  details.truth.candidateIntegrityVerified = true;

  let consentEvaluation;
  try {
    consentEvaluation = Consent.normalizeEvaluation(input.consentEvaluation);
  } catch (error) {
    return hold('CONSENT_EVALUATION_HOLD', details, 'CONSENT_EVALUATION_INVALID:' + error.message);
  }
  details.consentEvaluationRef = consentEvaluationReference(consentEvaluation);
  if (consentEvaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' || consentEvaluation.holds.length) {
    return hold('CONSENT_EVALUATION_HOLD', details, 'CONSENT_SCOPE_NOT_READY_FOR_HUMAN_DECISION');
  }
  details.truth.consentEvaluationIntegrityVerified = true;

  let consentInstance;
  try {
    consentInstance = Consent.normalizeInstance(input.consentInstance);
  } catch (error) {
    return hold('CONSENT_INSTANCE_HOLD', details, 'CONSENT_INSTANCE_INVALID:' + error.message);
  }
  details.consentInstanceRef = Consent.instanceRef(consentInstance);
  details.truth.consentInstanceIntegrityVerified = true;
  if (!same(consentEvaluation.instanceRef, details.consentInstanceRef) ||
      !same(consentInstance.subjectRef, details.candidateRef) ||
      consentInstance.domain !== 'code' ||
      !same(consentInstance.actions, ['code.bind-detached-selection', 'code.inspect']) ||
      consentInstance.permissions.length || consentInstance.networkDomains.length ||
      !noLifecycleAuthority(consentInstance)) {
    return hold('CONSENT_BINDING_HOLD', details, 'CONSENT_INSTANCE_NOT_BOUND_TO_INERT_CANDIDATE_SELECTION');
  }
  details.truth.consentSubjectBound = true;

  let declaration;
  try {
    declaration = normalizeDeclaration(input.declaration);
  } catch (error) {
    return hold('DECLARATION_HOLD', details, 'DECLARATION_INVALID:' + error.message);
  }
  details.declarationRef = declarationReference(declaration);
  details.truth.declarationIntegrityVerified = true;

  let replayLedger;
  try {
    replayLedger = normalizeLedger(input.replayLedger);
  } catch (error) {
    return hold('LEDGER_HOLD', details, 'REPLAY_LEDGER_INVALID:' + error.message);
  }
  details.replayLedgerRef = ledgerReference(replayLedger);

  if (!same(declaration.candidateRef, details.candidateRef) ||
      !same(declaration.consentEvaluationRef, details.consentEvaluationRef) ||
      !same(declaration.consentInstanceRef, details.consentInstanceRef)) {
    return hold('BINDING_HOLD', details, 'DECLARATION_REFERENCE_MISMATCH');
  }
  const alternative = candidate.alternatives.find((entry) => entry.id === declaration.selection.id);
  if (!alternative || alternative.kind !== declaration.selection.kind ||
      !same(alternative.candidateRef, declaration.selection.candidateRef)) {
    return hold('BINDING_HOLD', details, 'DECLARED_ALTERNATIVE_BYTES_MISMATCH');
  }
  details.selectedAlternative = clone(declaration.selection);
  details.truth.candidateChoiceReferenceBound = true;

  let exactCandidateBytes;
  try {
    exactCandidateBytes = selectedBytes(input.selectedCandidateBytes);
  } catch (error) {
    return hold('SELECTED_BYTES_HOLD', details, 'SELECTED_CANDIDATE_BYTES_INVALID:' + error.message);
  }
  if (exactCandidateBytes.length !== declaration.selection.candidateRef.byteLength ||
      Repair.hashBytes(exactCandidateBytes) !== declaration.selection.candidateRef.sha256) {
    return hold('SELECTED_BYTES_HOLD', details, 'SELECTED_CANDIDATE_BYTES_DIGEST_OR_LENGTH_MISMATCH');
  }
  details.truth.selectedCandidateBytesVerified = true;

  let evaluatedAt;
  try {
    evaluatedAt = timestamp(input.evaluatedAt, 'selection evaluation input.evaluatedAt');
  } catch (error) {
    return hold('TIME_WINDOW_HOLD', details, 'EVALUATION_TIME_INVALID:' + error.message);
  }
  details.evaluatedAt = evaluatedAt;
  if (replayLedger.observedAt !== evaluatedAt || Date.parse(evaluatedAt) < Date.parse(declaration.issuedAt) ||
      Date.parse(evaluatedAt) >= Date.parse(declaration.expiresAt)) {
    return hold('TIME_WINDOW_HOLD', details, 'DECLARATION_OR_LEDGER_TIME_WINDOW_INVALID');
  }
  details.truth.declaredTimeWindowValid = true;

  if (replayLedger.consumedNonces.includes(declaration.nonce)) {
    return hold('REPLAY_HOLD', details, 'DECLARATION_NONCE_ALREADY_CONSUMED');
  }
  details.truth.nonceAbsentFromProvidedLedger = true;
  return evaluationCore('AUTHENTICATION_REQUIRED', details);
}

function normalizeHolds(values) {
  if (!Array.isArray(values) || values.length > 16) throw new Error('selection evaluation holds are unbounded');
  return values.map((value, index) => text(value, 'selection evaluation.holds[' + index + ']'));
}

function normalizeTruth(value) {
  exact(value, TRUTH_FIELDS, 'selection evaluation.truth');
  const normalized = {};
  for (const field of TRUTH_FIELDS) {
    if (typeof value[field] !== 'boolean') throw new Error('selection evaluation.truth.' + field + ' must be boolean');
    normalized[field] = value[field];
  }
  for (const field of FALSE_CEILING_FIELDS) {
    if (normalized[field]) throw new Error('selection evaluation.truth.' + field + ' violates the inert truth ceiling');
  }
  return normalized;
}

function normalizeEvaluation(value) {
  exact(value, [
    'schema', 'version', 'status', 'evaluatedAt', 'candidateRef', 'consentEvaluationRef', 'consentInstanceRef',
    'declarationRef', 'replayLedgerRef', 'selectedAlternative', 'effect', 'holds',
    'limitations', 'nextGate', 'truth', 'authority', 'evaluationDigest'
  ], 'selection evaluation');
  if (value.schema !== EVALUATION_SCHEMA || value.version !== VERSION || !STATUSES.has(value.status) ||
      value.effect !== 'INERT_REVIEW_BINDING' || value.authority !== 'NONE' || !same(value.limitations, LIMITATIONS)) {
    throw new Error('selection evaluation identity or limitations drifted');
  }
  const expectedNextGate = value.status === 'AUTHENTICATION_REQUIRED'
    ? 'AUTHENTICATE_EXACT_DECLARATION_WITH_TRUSTED_CLOCK_LIVE_REVOCATION_AND_HOST_AUTHORIZATION'
    : 'REPAIR_SELECTION_INPUTS_THEN_REEVALUATE';
  if (value.nextGate !== expectedNextGate) throw new Error('selection evaluation next gate conflicts with status');
  const core = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    status: value.status,
    evaluatedAt: value.evaluatedAt === null ? null : timestamp(value.evaluatedAt, 'selection evaluation.evaluatedAt'),
    candidateRef: value.candidateRef === null ? null : reference(value.candidateRef, 'selection evaluation.candidateRef'),
    consentEvaluationRef: value.consentEvaluationRef === null ? null : digestReference(value.consentEvaluationRef, 'selection evaluation.consentEvaluationRef'),
    consentInstanceRef: value.consentInstanceRef === null ? null : reference(value.consentInstanceRef, 'selection evaluation.consentInstanceRef'),
    declarationRef: value.declarationRef === null ? null : reference(value.declarationRef, 'selection evaluation.declarationRef'),
    replayLedgerRef: value.replayLedgerRef === null ? null : reference(value.replayLedgerRef, 'selection evaluation.replayLedgerRef'),
    selectedAlternative: value.selectedAlternative === null ? null : selectedAlternative(value.selectedAlternative, 'selection evaluation.selectedAlternative'),
    effect: 'INERT_REVIEW_BINDING',
    holds: normalizeHolds(value.holds),
    limitations: LIMITATIONS.slice(),
    nextGate: expectedNextGate,
    truth: normalizeTruth(value.truth),
    authority: 'NONE'
  };
  if (value.status === 'AUTHENTICATION_REQUIRED') {
    if (core.holds.length || STAGED_TRUTH_FIELDS.some((field) => !core.truth[field]) || core.selectedAlternative === null) {
      throw new Error('authentication-required evaluation is not fully byte-bound and hold-free');
    }
  } else if (!core.holds.length) {
    throw new Error('selection hold evaluation must preserve a reason');
  }
  const evaluationDigest = digest(value.evaluationDigest, 'selection evaluation.evaluationDigest');
  if (hash(core) !== evaluationDigest) throw new Error('selection evaluation digest mismatch');
  const normalized = { ...core, evaluationDigest };
  if (!same(normalized, value)) throw new Error('selection evaluation is not in canonical normalized form');
  return normalized;
}

function verifyEvaluation(value, input) {
  try {
    const normalized = normalizeEvaluation(value);
    const rebuilt = evaluateSelection(input);
    return same(normalized, rebuilt) ? { pass: true, errors: [] } : { pass: false, errors: ['selection evaluation differs from deterministic rebuild'] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

module.exports = {
  VERSION,
  DECLARATION_SCHEMA,
  LEDGER_SCHEMA,
  EVALUATION_SCHEMA,
  SCOPE,
  ROOTS,
  MAX_DECLARATION_WINDOW_MS,
  LIMITATIONS,
  STAGED_TRUTH_FIELDS,
  FALSE_CEILING_FIELDS,
  clone,
  hash,
  sealDeclaration,
  normalizeDeclaration,
  declarationReference,
  sealLedger,
  normalizeLedger,
  ledgerReference,
  evaluateSelection,
  normalizeEvaluation,
  verifyEvaluation
};
