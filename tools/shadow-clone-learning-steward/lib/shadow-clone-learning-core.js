'use strict';

const crypto = require('node:crypto');

const SNAPSHOT_SET_SCHEMA = 'axm.shadow-clone.compact-snapshot-set/v1';
const LEDGER_SCHEMA = 'axm.shadow-clone.learning-ledger/v1';
const PICKUP_REQUEST_SCHEMA = 'axm.shadow-clone.pickup-request/v1';
const PICKUP_SCHEMA = 'axm.shadow-clone.anti-drift-pickup/v1';
const MIRROR_REQUEST_SCHEMA = 'axm.shadow-clone.mirror-proposal-request/v1';
const MIRROR_PROPOSAL_SCHEMA = 'axm.mirror.private-lesson-proposal/v1';
const VALUE_TRIAL_SCHEMA = 'axm.shadow-clone.scored-value-trial/v1';
const VALUE_RECEIPT_SCHEMA = 'axm.shadow-clone.scored-value-receipt/v1';
const TRIAL_ASSIGNMENT_REQUEST_SCHEMA = 'axm.shadow-clone.trial-assignment-request/v1';
const TRIAL_ASSIGNMENT_SCHEMA = 'axm.shadow-clone.trial-assignment/v1';
const REVIEW_DECISION_SCHEMA = 'axm.shadow-clone.candidate-review-decision/v1';
const FOUNDATION_REVIEW_RECEIPT_SCHEMA = 'axm.review-receipt/v1';
const REVIEW_INTAKE_REQUEST_SCHEMA = 'axm.shadow-clone.candidate-review-intake-request/v1';
const REVIEW_DECISION_V2_SCHEMA = 'axm.shadow-clone.candidate-review-decision/v2';
const PARTICIPATION_RECEIPT_SCHEMA = 'axm.shadow-clone.trial-participation-receipt/v1';
const TRIAL_ASSIGNMENT_REQUEST_V2_SCHEMA = 'axm.shadow-clone.trial-assignment-request/v2';
const TRIAL_ASSIGNMENT_V2_SCHEMA = 'axm.shadow-clone.trial-assignment/v2';
const EVIDENCE_VALUE_TRIAL_SCHEMA = 'axm.shadow-clone.evidence-bound-value-trial/v1';
const EVIDENCE_VALUE_RECEIPT_SCHEMA = 'axm.shadow-clone.evidence-bound-value-receipt/v1';
const PRESENTATION_ACK_SCHEMA = 'axm.shadow-clone.lesson-presentation-ack/v1';
const ARM_OUTCOME_SCHEMA = 'axm.shadow-clone.trial-arm-outcome/v1';
const CASE_EVALUATION_SCHEMA = 'axm.shadow-clone.trial-case-evaluation/v1';
const CAPABILITY_SCHEMA = 'axm.shadow-clone.provider-capability-receipt/v1';
const GRAND_GARDEN_LEDGER_SCHEMA = 'axm.grand-garden.instance-learning-steward-ledger/v1';
const SHA = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,119}$/;
const ROLES = new Set(['BUILDER', 'TESTER', 'STEWARD']);
const TASK_STATES = new Set(['ACTIVE', 'COMPLETE', 'NEEDS_ATTENTION']);
const SOURCE_KINDS = new Set(['COMPACT_TASK_SNAPSHOT', 'FINAL_SUMMARY', 'HANDOFF_RECEIPT', 'TEST_RECEIPT', 'DIFF_RECEIPT', 'DECLARED_USER_FEEDBACK']);
const EVIDENCE_KINDS = new Set(['STATUS_SUMMARY', 'FINAL_SUMMARY', 'HANDOFF_RECEIPT', 'TEST_RECEIPT', 'DIFF_RECEIPT', 'USER_SIDE_FEEDBACK']);
const STANCES = new Set(['SUPPORTS', 'CONTRADICTS', 'QUALIFIES']);
const RESULTS = new Set(['PASS', 'FAIL', 'UNKNOWN', 'OBSERVED']);
const CONSUMERS = new Set(['GENERIC', 'ASSET_IMPROVER', 'CODE_CAPABILITY_FABRIC', 'MIRROR_PRIVATE_LESSON']);

function fail(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  throw error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function digest(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
}

function without(value, key) {
  const copy = clone(value);
  delete copy[key];
  return copy;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function exactKeys(value, required, label, optional) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SHAPE', label + ' must be an object');
  const allowed = new Set(required.concat(optional || []));
  const keys = Object.keys(value);
  const missing = required.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  const extra = keys.filter(key => !allowed.has(key));
  if (missing.length || extra.length) fail('SHAPE', label + ' fields are invalid', { missing, extra });
}

function dateMs(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail('DATE', label + ' must be a canonical ISO date-time');
  return parsed;
}

function validId(value, label) {
  if (!ID.test(String(value || ''))) fail('IDENTITY', label + ' is invalid');
}

function validDigest(value, label) {
  if (!SHA.test(String(value || ''))) fail('DIGEST', label + ' must be a SHA-256 digest');
}

function assertNoPrivateData(value, label) {
  const forbiddenKeys = /^(?:threadId|taskId|sessionId|sessionPath|machinePath|rawPrompt|rawTranscript|rawChat|providerPayload|credentials|authorizationHeader|apiKey|accountData|privateProject)$/i;
  const stringRules = [
    ['windows-machine-path', /(?:^|[\s"'])\\?[A-Za-z]:\\[^\s"']+/i],
    ['user-home-path', /(?:^|[\s"'])(?:\/Users\/|\/home\/|\/root\/|~\/)/i],
    ['codex-session-path', /\.codex[\\/](?:sessions|threads|history)/i],
    ['provider-object-identifier', /\b(?:thread|turn|cthr|cthi|msg)_[A-Za-z0-9_-]{6,}\b/i],
    ['uuid-shaped-private-identifier', /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i],
    ['email-address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ['credential-shaped-content', /\b(?:Bearer\s+[A-Za-z0-9._-]{12,}|sk-(?:proj-)?[A-Za-z0-9_-]{12,}|api[_-]?key\s*[:=])/i],
    ['raw-chat-marker', /(?:^|\n)\s*(?:user|assistant|system)\s*:\s+/i]
  ];
  function visit(item, route) {
    if (Array.isArray(item)) return item.forEach((child, index) => visit(child, route + '[' + index + ']'));
    if (item && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        if (forbiddenKeys.test(key)) fail('PRIVATE_FIELD_LEAKAGE', label + ' contains forbidden private field ' + route + '.' + key);
        visit(child, route + '.' + key);
      }
      return;
    }
    if (typeof item === 'string') {
      for (const [kind, pattern] of stringRules) if (pattern.test(item)) fail('PRIVATE_FIELD_LEAKAGE', label + ' contains ' + kind, { route });
    }
  }
  visit(value, '$');
}

function validateSignal(signal, kind) {
  const idField = kind === 'USER_FEEDBACK' ? 'feedbackId' : 'signalId';
  exactKeys(signal, [idField, 'lessonKey', 'pattern', 'consumer', 'evidenceKind', 'statement', 'stance', 'result', 'evidenceDigest'], kind.toLowerCase());
  validId(signal[idField], kind.toLowerCase() + ' id');
  validId(signal.lessonKey, 'lesson key');
  if (typeof signal.pattern !== 'string' || !signal.pattern.trim() || signal.pattern.length > 1200) fail('SIGNAL', 'signal pattern is invalid');
  if (typeof signal.statement !== 'string' || !signal.statement.trim() || signal.statement.length > 1600) fail('SIGNAL', 'signal statement is invalid');
  if (!CONSUMERS.has(signal.consumer) || !EVIDENCE_KINDS.has(signal.evidenceKind) || !STANCES.has(signal.stance) || !RESULTS.has(signal.result)) fail('SIGNAL', 'signal classification is invalid');
  validDigest(signal.evidenceDigest, 'evidence digest');
}

function validateVerification(item) {
  exactKeys(item, ['verificationId', 'lessonKey', 'statement', 'result', 'implementationDigest', 'testReceiptDigest', 'replayInputDigest', 'expectedOutputDigest', 'observedOutputDigest'], 'verification');
  validId(item.verificationId, 'verification id');
  validId(item.lessonKey, 'verification lesson key');
  if (typeof item.statement !== 'string' || !item.statement.trim() || item.statement.length > 1600) fail('VERIFICATION', 'verification statement is invalid');
  if (!new Set(['PASS', 'FAIL', 'UNKNOWN']).has(item.result)) fail('VERIFICATION', 'verification result is invalid');
  ['implementationDigest', 'testReceiptDigest', 'replayInputDigest', 'expectedOutputDigest', 'observedOutputDigest'].forEach(key => validDigest(item[key], key));
  if (item.result === 'PASS' && item.expectedOutputDigest !== item.observedOutputDigest) fail('VERIFICATION_DIGEST', 'a PASS verification must reproduce its expected output digest');
}

function validateLedgerDigest(ledger) {
  if (!ledger || ledger.schema !== LEDGER_SCHEMA) fail('LEDGER', 'previous ledger schema is invalid');
  validDigest(ledger.ledgerDigest, 'previous ledger digest');
  if (digest(without(ledger, 'ledgerDigest')) !== ledger.ledgerDigest) fail('LEDGER_DIGEST', 'previous ledger digest does not match its contents');
  return ledger;
}

function validateSnapshotSet(input) {
  assertNoPrivateData(input, 'compact snapshot set');
  exactKeys(input, ['schema', 'collectionId', 'asOf', 'authorization', 'providerBoundary', 'activeTaskAliases', 'sourceDigests', 'snapshots', 'previousLedger', 'limits', 'retention'], 'compact snapshot set');
  if (input.schema !== SNAPSHOT_SET_SCHEMA) fail('SNAPSHOT_SET', 'snapshot set schema is invalid');
  validId(input.collectionId, 'collection id');
  const asOf = dateMs(input.asOf, 'snapshot set asOf');

  exactKeys(input.authorization, ['authority', 'scope', 'authorizationReceiptDigest', 'declaredConsent'], 'authorization');
  if (input.authorization.authority !== 'MIKE_DECLARED' || input.authorization.scope !== 'ACTIVE_AXM_CODEX_COMPACT_LEARNING' || input.authorization.declaredConsent !== true) fail('LEARNING_AUTHORITY', 'explicit Mike authorization for compact AXM task learning is required');
  validDigest(input.authorization.authorizationReceiptDigest, 'authorization receipt digest');

  exactKeys(input.providerBoundary, ['mode', 'capabilityReceiptDigest', 'automaticEnumeration', 'taskHistoryRead', 'compactSnapshotsOnly', 'crossTaskMessaging', 'credentialInspection', 'rawTaskDataPresent'], 'provider boundary');
  if (input.providerBoundary.mode !== 'HOST_SUPPLIED_REDACTED_COMPACT_SNAPSHOTS' || input.providerBoundary.taskHistoryRead !== false || input.providerBoundary.compactSnapshotsOnly !== true || input.providerBoundary.crossTaskMessaging !== false || input.providerBoundary.credentialInspection !== false || input.providerBoundary.rawTaskDataPresent !== false || typeof input.providerBoundary.automaticEnumeration !== 'boolean') fail('PROVIDER_AUTHORITY', 'only compact, redacted, no-history provider input is accepted');
  validDigest(input.providerBoundary.capabilityReceiptDigest, 'provider capability receipt digest');

  exactKeys(input.limits, ['maxCycles', 'maxLessons', 'maxSignals', 'maxActiveTasks'], 'limits');
  if (!Number.isInteger(input.limits.maxCycles) || input.limits.maxCycles < 1 || input.limits.maxCycles > 32 || !Number.isInteger(input.limits.maxLessons) || input.limits.maxLessons < 1 || input.limits.maxLessons > 256 || !Number.isInteger(input.limits.maxSignals) || input.limits.maxSignals < 2 || input.limits.maxSignals > 8192 || !Number.isInteger(input.limits.maxActiveTasks) || input.limits.maxActiveTasks < 2 || input.limits.maxActiveTasks > 64) fail('LIMITS', 'snapshot limits are outside the bounded range');

  exactKeys(input.retention, ['localOnly', 'rawTaskDataRetained', 'retainUntil', 'refreshAfter'], 'retention');
  const retainUntil = dateMs(input.retention.retainUntil, 'retainUntil');
  const refreshAfter = dateMs(input.retention.refreshAfter, 'refreshAfter');
  if (input.retention.localOnly !== true || input.retention.rawTaskDataRetained !== false || retainUntil <= asOf || refreshAfter < asOf || refreshAfter > retainUntil || retainUntil - asOf > 30 * 86400000) fail('RETENTION', 'retention must be local, raw-free, positive, and no longer than 30 days');

  if (!Array.isArray(input.activeTaskAliases) || input.activeTaskAliases.length < 2 || input.activeTaskAliases.length > input.limits.maxActiveTasks) fail('ACTIVE_SET', 'active task alias set is outside the bound');
  input.activeTaskAliases.forEach(alias => validId(alias, 'active task alias'));
  if (uniqueSorted(input.activeTaskAliases).length !== input.activeTaskAliases.length) fail('ACTIVE_SET', 'active task aliases must be unique');
  const activeAliases = new Set(input.activeTaskAliases);

  if (!Array.isArray(input.sourceDigests) || input.sourceDigests.length < 2 || uniqueSorted(input.sourceDigests).length !== input.sourceDigests.length) fail('SOURCE_BINDING', 'at least two unique allowlisted source digests are required');
  input.sourceDigests.forEach(value => validDigest(value, 'source allowlist digest'));
  const allowedSources = new Set(input.sourceDigests);

  if (!Array.isArray(input.snapshots) || input.snapshots.length < 2 || input.snapshots.length > input.limits.maxActiveTasks) fail('MISSING_CAPABILITY_OR_AUTHORIZATION', 'at least two compact snapshots are required; no live provider is inferred');
  const snapshotIds = new Set();
  const snapshotAliases = new Set();
  let signals = 0;
  for (const snapshot of input.snapshots) {
    exactKeys(snapshot, ['snapshotId', 'sourceKind', 'sourceDigest', 'sourceVersion', 'task', 'observedAt', 'expiresAt', 'observations', 'userFeedback', 'verifications', 'declaredLimits'], 'compact snapshot');
    validId(snapshot.snapshotId, 'snapshot id');
    if (snapshotIds.has(snapshot.snapshotId)) fail('DUPLICATE_RECEIPT', 'snapshot ids must be unique');
    snapshotIds.add(snapshot.snapshotId);
    if (!SOURCE_KINDS.has(snapshot.sourceKind)) fail('SOURCE_BINDING', 'snapshot source kind is invalid');
    validDigest(snapshot.sourceDigest, 'snapshot source digest');
    if (!allowedSources.has(snapshot.sourceDigest)) fail('SOURCE_BINDING', 'snapshot source digest is not allowlisted');
    if (typeof snapshot.sourceVersion !== 'string' || !snapshot.sourceVersion.trim() || snapshot.sourceVersion.length > 160) fail('SOURCE_BINDING', 'snapshot source version is invalid');
    exactKeys(snapshot.task, ['alias', 'role', 'status'], 'snapshot task');
    validId(snapshot.task.alias, 'snapshot task alias');
    if (!activeAliases.has(snapshot.task.alias)) fail('ACTIVE_SET_AUTHORITY', 'snapshot alias is outside the authorized active set');
    if (snapshotAliases.has(snapshot.task.alias)) fail('DUPLICATE_RECEIPT', 'one compact snapshot per active alias is allowed in a cycle');
    snapshotAliases.add(snapshot.task.alias);
    if (!ROLES.has(snapshot.task.role) || !TASK_STATES.has(snapshot.task.status)) fail('ACTIVE_SET', 'snapshot role or status is invalid');
    const observedAt = dateMs(snapshot.observedAt, 'snapshot observedAt');
    const expiresAt = dateMs(snapshot.expiresAt, 'snapshot expiresAt');
    if (observedAt > asOf || expiresAt <= observedAt) fail('DATE', 'snapshot observation and expiry bounds are invalid');
    if (!Array.isArray(snapshot.observations) || !Array.isArray(snapshot.userFeedback) || !Array.isArray(snapshot.verifications)) fail('SHAPE', 'snapshot evidence fields must be arrays');
    if (snapshot.observations.length > 128 || snapshot.userFeedback.length > 64 || snapshot.verifications.length > 64 || snapshot.observations.length + snapshot.userFeedback.length + snapshot.verifications.length === 0) fail('EMPTY_LEARNING', 'snapshot evidence is empty or exceeds its bound');
    if (snapshot.userFeedback.length && (snapshot.task.role !== 'TESTER' || snapshot.sourceKind !== 'DECLARED_USER_FEEDBACK')) fail('USER_FEEDBACK_AUTHORITY', 'user-side feedback requires a tester and declared feedback source');
    if (snapshot.verifications.length && (snapshot.task.role !== 'TESTER' || snapshot.sourceKind !== 'TEST_RECEIPT')) fail('VERIFICATION_AUTHORITY', 'verification requires a tester and test receipt source');
    snapshot.observations.forEach(item => validateSignal(item, 'OBSERVATION'));
    snapshot.userFeedback.forEach(item => validateSignal(item, 'USER_FEEDBACK'));
    snapshot.verifications.forEach(validateVerification);
    if (snapshot.verifications.some(item => item.testReceiptDigest !== snapshot.sourceDigest)) fail('SOURCE_BINDING', 'verification test receipt digest must match its compact test-receipt source');
    if (!Array.isArray(snapshot.declaredLimits) || snapshot.declaredLimits.length > 64 || snapshot.declaredLimits.some(item => typeof item !== 'string' || !item.trim() || item.length > 1000)) fail('LIMITS', 'declared limits are invalid');
    signals += snapshot.observations.length + snapshot.userFeedback.length;
  }
  if (signals > input.limits.maxSignals) fail('LIMITS', 'signal capacity is exceeded');
  if (input.previousLedger !== null) validateLedgerDigest(input.previousLedger);
  return input;
}

function normalizeEvidence(input, asOfMs) {
  const observations = [];
  const userFeedback = [];
  const verifications = [];
  const seenSignals = new Set();
  let duplicatesRemoved = 0;
  for (const snapshot of input.snapshots) {
    const base = { taskAlias: snapshot.task.alias, taskRole: snapshot.task.role, taskStatus: snapshot.task.status, sourceKind: snapshot.sourceKind, sourceDigest: snapshot.sourceDigest, observedAt: snapshot.observedAt, expiresAt: snapshot.expiresAt, stale: dateMs(snapshot.expiresAt, 'expiresAt') <= asOfMs };
    for (const [kind, list] of [['OBSERVATION', snapshot.observations], ['USER_FEEDBACK', snapshot.userFeedback]]) {
      for (const raw of list) {
        const normalized = Object.assign({}, base, clone(raw), { kind });
        normalized.signalDigest = digest(normalized);
        if (seenSignals.has(normalized.signalDigest)) { duplicatesRemoved += 1; continue; }
        seenSignals.add(normalized.signalDigest);
        (kind === 'OBSERVATION' ? observations : userFeedback).push(normalized);
      }
    }
    for (const raw of snapshot.verifications) {
      const normalized = Object.assign({}, base, clone(raw));
      normalized.replay = raw.result === 'PASS' ? 'PASS_RECORDED_OUTPUT_DIGEST_MATCH' : raw.result === 'FAIL' ? 'FAIL_RECORDED_OUTPUT' : 'UNKNOWN_NOT_VERIFIED';
      normalized.verificationDigest = digest(normalized);
      verifications.push(normalized);
    }
  }
  return {
    observations: observations.sort((a, b) => a.signalDigest.localeCompare(b.signalDigest)),
    userFeedback: userFeedback.sort((a, b) => a.signalDigest.localeCompare(b.signalDigest)),
    verifications: verifications.sort((a, b) => a.verificationDigest.localeCompare(b.verificationDigest)),
    duplicatesRemoved
  };
}

function deriveCandidates(evidence, input) {
  const groups = new Map();
  for (const signal of evidence.observations.concat(evidence.userFeedback)) {
    if (!groups.has(signal.lessonKey)) groups.set(signal.lessonKey, []);
    groups.get(signal.lessonKey).push(signal);
  }
  const candidates = [];
  const conflicts = [];
  for (const [lessonKey, signals] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const fresh = signals.filter(item => !item.stale);
    const stale = signals.filter(item => item.stale);
    const supports = fresh.filter(item => item.stance === 'SUPPORTS' && ['PASS', 'OBSERVED'].includes(item.result));
    const contradicts = fresh.filter(item => item.stance === 'CONTRADICTS' || item.result === 'FAIL');
    const qualifies = fresh.filter(item => item.stance === 'QUALIFIES' || item.result === 'UNKNOWN');
    const patterns = uniqueSorted(fresh.map(item => item.pattern));
    const consumers = uniqueSorted(fresh.map(item => item.consumer));
    const supportAliases = uniqueSorted(supports.map(item => item.taskAlias));
    const supportSources = uniqueSorted(supports.map(item => item.sourceDigest));
    if (stale.length) conflicts.push({ kind: 'STALE_OBSERVATION', lessonKey, signalDigests: stale.map(item => item.signalDigest).sort(), statement: 'Expired evidence is retained as refresh-required uncertainty and does not increase confidence.' });
    if (contradicts.length) conflicts.push({ kind: 'DIRECT_CONTRADICTION', lessonKey, signalDigests: contradicts.map(item => item.signalDigest).sort(), statement: 'Contradictory evidence remains explicit and is not averaged into the lesson.' });
    if (patterns.length > 1) conflicts.push({ kind: 'INCOMPATIBLE_PATTERN', lessonKey, signalDigests: fresh.map(item => item.signalDigest).sort(), statement: 'Signals use incompatible reusable patterns under one lesson key.' });
    if (consumers.length > 1) conflicts.push({ kind: 'INCOMPATIBLE_CONSUMER', lessonKey, signalDigests: fresh.map(item => item.signalDigest).sort(), statement: 'Signals disagree about the intended proposal consumer.' });
    let status = 'INSUFFICIENT_EVIDENCE';
    if (!fresh.length && stale.length) status = 'REFRESH_REQUIRED';
    else if (contradicts.length || patterns.length > 1 || consumers.length > 1) status = 'CONTESTED';
    else if (supportAliases.length >= 2 && supportSources.length >= 2) status = 'CANDIDATE';
    const confidence = status === 'CANDIDATE' ? (supportAliases.length >= 3 ? 'HIGH' : 'MEDIUM') : 'LOW';
    const refreshRequiredAt = signals.map(item => item.expiresAt).sort()[0];
    const sourceBindings = signals.map(item => ({ taskAlias: item.taskAlias, sourceDigest: item.sourceDigest, signalDigest: item.signalDigest, kind: item.kind, stance: item.stance, stale: item.stale })).sort((a, b) => a.signalDigest.localeCompare(b.signalDigest));
    const verificationRows = evidence.verifications.filter(item => item.lessonKey === lessonKey);
    const passed = verificationRows.filter(item => item.replay === 'PASS_RECORDED_OUTPUT_DIGEST_MATCH');
    const candidate = {
      lessonKey,
      candidateDigest: null,
      status,
      confidence,
      pattern: patterns.length === 1 ? patterns[0] : null,
      consumer: consumers.length === 1 ? consumers[0] : null,
      refreshRequiredAt,
      sourceBindings,
      supportTaskAliases: supportAliases,
      supportSourceDigests: supportSources,
      qualificationSignalDigests: qualifies.map(item => item.signalDigest).sort(),
      contradictionSignalDigests: contradicts.map(item => item.signalDigest).sort(),
      verificationState: passed.length ? 'PASS_REPLAY_BOUND' : verificationRows.length ? 'NOT_PASSED' : 'NOT_YET_VERIFIED',
      verificationDigests: verificationRows.map(item => item.verificationDigest).sort(),
      reversible: true,
      inherited: false
    };
    candidate.candidateDigest = digest(without(candidate, 'candidateDigest'));
    candidates.push(candidate);
  }
  return { candidates, conflicts };
}

function compileSnapshotSet(snapshotSet) {
  const input = clone(snapshotSet);
  validateSnapshotSet(input);
  const asOfMs = dateMs(input.asOf, 'asOf');
  const previous = input.previousLedger;
  const legacyBoundSourceDigests = previous && Array.isArray(previous.lessons)
    ? previous.lessons.flatMap(item => Array.isArray(item.sourceBindings) ? item.sourceBindings.map(binding => binding.sourceDigest).filter(Boolean) : [])
    : [];
  const previousSourceDigests = previous && previous.source
    ? (Array.isArray(previous.source.seenSourceDigests)
        ? previous.source.seenSourceDigests
        : uniqueSorted((previous.source.sourceDigests || []).concat(legacyBoundSourceDigests)))
    : [];
  const seenSourceDigests = new Set(previousSourceDigests);
  const novelSnapshots = input.snapshots.filter(item => !seenSourceDigests.has(item.sourceDigest));
  const duplicateSourceSnapshotsRemoved = input.snapshots.length - novelSnapshots.length;
  if (previous && novelSnapshots.length < 2) fail('INSUFFICIENT_NOVEL_EVIDENCE', 'a cumulative cycle requires at least two source-digest-novel compact snapshots', { duplicateSourceSnapshotsRemoved, novelSnapshots: novelSnapshots.length });
  const effectiveInput = clone(input);
  effectiveInput.snapshots = novelSnapshots;
  const evidence = normalizeEvidence(effectiveInput, asOfMs);
  const derived = deriveCandidates(evidence, effectiveInput);
  const proposals = derived.candidates.filter(item => item.status === 'CANDIDATE').map(item => {
    const proposal = {
      proposalId: 'proposal-' + item.candidateDigest.slice(0, 20),
      proposalDigest: null,
      lessonKey: item.lessonKey,
      candidateDigest: item.candidateDigest,
      consumer: item.consumer,
      state: 'PROPOSED_NOT_APPLIED',
      reversible: true,
      crossTaskControl: false,
      parentWrites: 0,
      canonicalWrites: 0,
      inherited: false
    };
    proposal.proposalDigest = digest(without(proposal, 'proposalDigest'));
    return proposal;
  });
  const priorHistory = previous ? clone(previous.cycleHistory) : [];
  if (priorHistory.length + 1 > input.limits.maxCycles) fail('LEDGER_ROTATION_REQUIRED', 'cycle capacity reached; seal this ledger and start a linked successor');
  const lessonsByKey = new Map((previous ? previous.lessons : []).map(item => [item.lessonKey, clone(item)]));
  const priorLessonVersions = previous
    ? clone(Array.isArray(previous.lessonVersions) ? previous.lessonVersions : (previous.lessons || []))
    : [];
  const lessonVersionsByDigest = new Map(priorLessonVersions.map(item => [item.candidateDigest, item]));
  const supersededLessonKeys = [];
  let newLessonVersions = 0;
  for (const candidate of derived.candidates) {
    const prior = lessonsByKey.get(candidate.lessonKey);
    if (prior && prior.candidateDigest !== candidate.candidateDigest) supersededLessonKeys.push(candidate.lessonKey);
    lessonsByKey.set(candidate.lessonKey, candidate);
    if (!lessonVersionsByDigest.has(candidate.candidateDigest)) {
      lessonVersionsByDigest.set(candidate.candidateDigest, clone(candidate));
      newLessonVersions += 1;
    }
  }
  if (lessonsByKey.size > input.limits.maxLessons) fail('LEDGER_ROTATION_REQUIRED', 'lesson capacity reached; seal this ledger and start a linked successor');
  if (lessonVersionsByDigest.size > input.limits.maxLessons) fail('LEDGER_ROTATION_REQUIRED', 'lesson-version capacity reached; seal this ledger and start a linked successor');
  const activeAliases = input.activeTaskAliases.slice().sort();
  const observedAliases = uniqueSorted(input.snapshots.map(item => item.task.alias));
  const novelObservedAliases = uniqueSorted(novelSnapshots.map(item => item.task.alias));
  const reusableAliases = uniqueSorted(derived.candidates.filter(item => ['CANDIDATE', 'CONTESTED'].includes(item.status)).flatMap(item => item.sourceBindings.map(binding => binding.taskAlias)));
  const inputDigest = digest(without(input, 'previousLedger'));
  const cycleHistory = priorHistory.concat([{
    collectionId: input.collectionId,
    asOf: input.asOf,
    inputDigest,
    previousLedgerDigest: previous ? previous.ledgerDigest : null,
    activeTaskCount: activeAliases.length,
    observedTaskCount: observedAliases.length,
    candidateLessons: derived.candidates.filter(item => item.status === 'CANDIDATE').length,
    contestedLessons: derived.candidates.filter(item => item.status === 'CONTESTED').length,
    sourceDigests: novelSnapshots.map(item => item.sourceDigest).sort(),
    duplicateSourceSnapshotsRemoved,
    newLessonVersions,
    preservedPriorLessonVersions: priorLessonVersions.length,
    supersededLessonKeys: uniqueSorted(supersededLessonKeys),
    duplicateSignalsRemoved: evidence.duplicatesRemoved
  }]);
  const demonstrated = derived.candidates.some(item => item.status === 'CANDIDATE' && item.verificationState === 'PASS_REPLAY_BOUND') && proposals.length > 0;
  const ledger = {
    schema: LEDGER_SCHEMA,
    ledgerDigest: null,
    ledgerId: previous ? previous.ledgerId : 'shadow-clone-ledger-' + input.authorization.authorizationReceiptDigest.slice(0, 16),
    status: 'EXPERIMENTAL',
    state: demonstrated ? 'PASS_BOUNDED_REPLAYABLE_LESSON' : derived.candidates.some(item => item.status === 'CANDIDATE') ? 'CANDIDATE_LESSONS_AWAIT_VERIFICATION' : derived.candidates.some(item => item.status === 'CONTESTED') ? 'DISSENT_PRESERVED_NO_ELIGIBLE_LESSON' : 'INSUFFICIENT_EVIDENCE',
    asOf: input.asOf,
    authorization: clone(input.authorization),
    providerBoundary: clone(input.providerBoundary),
    retention: clone(input.retention),
    limits: clone(input.limits),
    source: {
      collectionId: input.collectionId,
      inputDigest,
      sourceDigests: input.sourceDigests.slice().sort(),
      novelSourceDigests: novelSnapshots.map(item => item.sourceDigest).sort(),
      seenSourceDigests: uniqueSorted(previousSourceDigests.concat(novelSnapshots.map(item => item.sourceDigest)))
    },
    cycleHistory,
    observations: evidence.observations,
    userFeedback: evidence.userFeedback,
    candidateLessons: derived.candidates,
    contradictions: derived.conflicts,
    proposedImprovements: proposals,
    verificationReceipts: evidence.verifications,
    lessons: [...lessonsByKey.values()].sort((a, b) => a.lessonKey.localeCompare(b.lessonKey)),
    lessonVersions: [...lessonVersionsByDigest.values()].sort((a, b) => a.lessonKey.localeCompare(b.lessonKey) || a.candidateDigest.localeCompare(b.candidateDigest)),
    deduplication: { exactSignalDuplicatesRemoved: evidence.duplicatesRemoved, duplicateSourceSnapshotsRemoved },
    activeSet: {
      taskAliases: activeAliases,
      observedTaskAliases: observedAliases,
      novelObservedTaskAliases: novelObservedAliases,
      duplicateSourceTaskAliases: observedAliases.filter(alias => !novelObservedAliases.includes(alias)),
      missingTaskAliases: activeAliases.filter(alias => !observedAliases.includes(alias)),
      reusableOrDissentTaskAliases: reusableAliases
    },
    learningClaim: {
      demonstrated,
      storedTextAloneCountsAsLearning: false,
      doubleValueProven: false,
      modelWeightsChanged: false,
      claimBoundary: 'This proves only deterministic compact evidence routing for this bounded input. A held-out scored trial is required for any 2x value claim.'
    },
    inheritanceDecision: { state: 'EXTERNAL_HUMAN_GATE_ONLY', automatic: false, parentWrites: 0, canonicalWrites: 0, canon: false },
    authority: { providerExecution: 'HOST_SUPPLIED_OR_INERT', taskHistoryRead: false, crossTaskMessaging: false, permissionEscalation: false, promptRewrite: false, modelWeightTraining: false, automaticIntegration: false, canon: false }
  };
  ledger.ledgerDigest = digest(without(ledger, 'ledgerDigest'));
  return ledger;
}

function validatePickupRequest(request) {
  assertNoPrivateData(request, 'pickup request');
  exactKeys(request, ['schema', 'requestId', 'consumerAlias', 'baseContextDigest', 'asOf', 'lessonKeys', 'includeDissent', 'candidateMode', 'authority'], 'pickup request');
  if (request.schema !== PICKUP_REQUEST_SCHEMA) fail('PICKUP_REQUEST', 'pickup request schema is invalid');
  validId(request.requestId, 'pickup request id');
  validId(request.consumerAlias, 'pickup consumer alias');
  validDigest(request.baseContextDigest, 'base context digest');
  dateMs(request.asOf, 'pickup asOf');
  if (!Array.isArray(request.lessonKeys) || request.lessonKeys.length > 64) fail('PICKUP_REQUEST', 'pickup lesson selection is invalid');
  request.lessonKeys.forEach(value => validId(value, 'pickup lesson key'));
  if (request.includeDissent !== true) fail('PICKUP_REQUEST', 'anti-drift pickup must preserve dissent');
  if (!new Set(['VERIFIED_ONLY', 'INCLUDE_UNVERIFIED_AS_HOLD']).has(request.candidateMode)) fail('PICKUP_REQUEST', 'pickup candidate mode is invalid');
  exactKeys(request.authority, ['explicitSelection', 'automaticPromptRewrite', 'automaticInheritance'], 'pickup authority');
  if (request.authority.explicitSelection !== true || request.authority.automaticPromptRewrite !== false || request.authority.automaticInheritance !== false) fail('PICKUP_AUTHORITY', 'pickup requires explicit selection and cannot rewrite prompts or inherit automatically');
}

function createPickup(ledgerValue, requestValue) {
  const ledger = validateLedgerDigest(clone(ledgerValue));
  const request = clone(requestValue);
  validatePickupRequest(request);
  const asOf = dateMs(request.asOf, 'pickup asOf');
  const requested = new Set(request.lessonKeys);
  const freshCandidates = ledger.lessons.filter(item => item.status === 'CANDIDATE' && dateMs(item.refreshRequiredAt, 'lesson refreshRequiredAt') > asOf && (!requested.size || requested.has(item.lessonKey)));
  const eligible = freshCandidates.filter(item => item.verificationState === 'PASS_REPLAY_BOUND');
  const heldCandidates = request.candidateMode === 'INCLUDE_UNVERIFIED_AS_HOLD' ? freshCandidates.filter(item => item.verificationState !== 'PASS_REPLAY_BOUND') : [];
  if (!eligible.length && !heldCandidates.length) fail('NO_ELIGIBLE_LESSON', 'no fresh lesson is eligible for verified pickup or candidate hold');
  const found = new Set(eligible.concat(heldCandidates).map(item => item.lessonKey));
  const missing = request.lessonKeys.filter(key => !found.has(key));
  if (missing.length) fail('NO_ELIGIBLE_LESSON', 'requested lessons are not fresh and replay-bound', { missing });
  const lessonVersions = Array.isArray(ledger.lessonVersions) ? ledger.lessonVersions : ledger.lessons;
  const dissent = lessonVersions.filter(item => ['CONTESTED', 'REFRESH_REQUIRED'].includes(item.status)).map(item => ({ lessonKey: item.lessonKey, status: item.status, candidateDigest: item.candidateDigest, sourceBindings: item.sourceBindings })).sort((a, b) => a.lessonKey.localeCompare(b.lessonKey) || a.candidateDigest.localeCompare(b.candidateDigest));
  const expiresAt = eligible.concat(heldCandidates).map(item => item.refreshRequiredAt).sort()[0];
  const pickup = {
    schema: PICKUP_SCHEMA,
    pickupDigest: null,
    pickupId: 'pickup-' + digest({ requestId: request.requestId, ledgerDigest: ledger.ledgerDigest }).slice(0, 20),
    status: 'EXPERIMENTAL',
    state: eligible.length ? 'EXPLICIT_ANTI_DRIFT_PROFILE_READY' : 'HOLD_CANDIDATES_AWAIT_VERIFICATION',
    sourceLedgerDigest: ledger.ledgerDigest,
    consumerAlias: request.consumerAlias,
    baseContextDigest: request.baseContextDigest,
    createdAt: request.asOf,
    expiresAt,
    cloneProfile: {
      kind: 'EPHEMERAL_EVIDENCE_PROFILE_NOT_IDENTITY',
      roots: ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'],
      lessons: eligible.map(item => ({ lessonKey: item.lessonKey, pattern: item.pattern, consumer: item.consumer, confidence: item.confidence, candidateDigest: item.candidateDigest, sourceBindings: item.sourceBindings, verificationDigests: item.verificationDigests, refreshRequiredAt: item.refreshRequiredAt })),
      candidateLessons: heldCandidates.map(item => ({ lessonKey: item.lessonKey, pattern: item.pattern, consumer: item.consumer, confidence: item.confidence, candidateDigest: item.candidateDigest, sourceBindings: item.sourceBindings, verificationState: item.verificationState, refreshRequiredAt: item.refreshRequiredAt, adoptionState: 'PROPOSAL_ONLY_DO_NOT_APPLY' })),
      dissent,
      trainingMeaning: 'EXPLICIT_CONTEXTUAL_LESSON_PROPOSAL_NOT_MODEL_WEIGHT_TRAINING'
    },
    adoption: { explicitHostPresentationRequired: true, automaticPromptRewrite: false, automaticInheritance: false, automaticMerge: false, permissionChange: false, crossTaskMessaging: false, canon: false },
    claimBoundary: 'A pickup profile is a source-bound anti-drift context proposal. It is not a person, consciousness, autonomous clone, provider identity, or permission grant.'
  };
  pickup.pickupDigest = digest(without(pickup, 'pickupDigest'));
  return pickup;
}

function adaptGrandGardenLedger(value) {
  const garden = clone(value);
  assertNoPrivateData(garden, 'Grand Garden compact ledger');
  exactKeys(garden, ['schema', 'ledgerDigest', 'ledgerId', 'status', 'state', 'asOf', 'authorization', 'retention', 'limits', 'cycleHistory', 'activeSet', 'contributionReceipts', 'lessons', 'signalDigestsSeen', 'valueAmplification', 'authority', 'boundary'], 'Grand Garden compact ledger');
  if (garden.schema !== GRAND_GARDEN_LEDGER_SCHEMA || garden.status !== 'EXPERIMENTAL') fail('GARDEN_LEDGER', 'Grand Garden ledger schema or status is invalid');
  validDigest(garden.ledgerDigest, 'Grand Garden ledger digest');
  if (digest(without(garden, 'ledgerDigest')) !== garden.ledgerDigest) fail('GARDEN_LEDGER_DIGEST', 'Grand Garden ledger digest does not match its compact contents');
  dateMs(garden.asOf, 'Grand Garden ledger asOf');
  if (!Array.isArray(garden.lessons) || !Array.isArray(garden.cycleHistory) || !garden.activeSet || !garden.valueAmplification || !garden.authority) fail('GARDEN_LEDGER', 'Grand Garden ledger structure is incomplete');
  if (garden.authority.crossTaskMessaging !== false || garden.authority.permissionEscalation !== false || garden.authority.automaticIntegration !== false || garden.authority.canon !== false || Number(garden.authority.parentWrites || 0) !== 0 || Number(garden.authority.canonicalWrites || 0) !== 0) fail('GARDEN_AUTHORITY', 'Grand Garden ledger carries forbidden authority');
  const mapped = garden.lessons.map(item => {
    validId(item.lessonKey, 'Grand Garden lesson key');
    const variants = Array.isArray(item.patternVariants) ? item.patternVariants : [];
    const patterns = uniqueSorted(variants.map(row => row.pattern).filter(Boolean));
    const consumers = uniqueSorted(variants.map(row => row.consumer).filter(Boolean));
    const candidateDigests = Array.isArray(item.candidateDigests) ? item.candidateDigests.slice().sort() : [];
    candidateDigests.forEach(value => validDigest(value, 'Grand Garden candidate digest'));
    const latestCandidateDigest = candidateDigests[candidateDigests.length - 1] || digest({ gardenLedgerDigest: garden.ledgerDigest, lessonKey: item.lessonKey });
    const state = item.currentState === 'CANDIDATE' ? 'CANDIDATE' : item.currentState === 'CONTESTED' ? 'CONTESTED' : item.currentState === 'EXPIRED_REFRESH_REQUIRED' ? 'REFRESH_REQUIRED' : 'INSUFFICIENT_EVIDENCE';
    const sourceAliases = uniqueSorted(Array.isArray(item.sourceTaskAliases) ? item.sourceTaskAliases : []);
    const verificationDigests = Array.isArray(item.verificationReceiptDigests) ? item.verificationReceiptDigests.slice().sort() : [];
    verificationDigests.forEach(value => validDigest(value, 'Grand Garden verification receipt digest'));
    return {
      lessonKey: item.lessonKey,
      candidateDigest: latestCandidateDigest,
      status: state,
      confidence: Array.isArray(item.currentConfidenceLabels) && item.currentConfidenceLabels.length === 1 ? item.currentConfidenceLabels[0] : 'LOW',
      pattern: patterns.length === 1 ? patterns[0] : null,
      consumer: consumers.length === 1 ? consumers[0] : null,
      refreshRequiredAt: item.refreshRequiredAt,
      sourceBindings: sourceAliases.map(taskAlias => ({ taskAlias, sourceLedgerDigest: garden.ledgerDigest, candidateDigest: latestCandidateDigest })),
      supportTaskAliases: sourceAliases,
      supportSourceDigests: [garden.ledgerDigest],
      qualificationSignalDigests: [],
      contradictionSignalDigests: Array.isArray(item.contradictionDigests) ? item.contradictionDigests.slice().sort() : [],
      verificationState: verificationDigests.length ? 'PRESENT_REQUIRES_DETACHED_REPLAY_IMPORT' : 'NOT_YET_VERIFIED',
      verificationDigests,
      reversible: true,
      inherited: false
    };
  }).sort((a, b) => a.lessonKey.localeCompare(b.lessonKey));
  const contradictions = mapped.filter(item => item.status === 'CONTESTED' || item.status === 'REFRESH_REQUIRED').map(item => ({ kind: item.status === 'CONTESTED' ? 'IMPORTED_GARDEN_DISSENT' : 'IMPORTED_GARDEN_STALE', lessonKey: item.lessonKey, candidateDigest: item.candidateDigest, contradictionDigests: item.contradictionSignalDigests }));
  const proposedImprovements = garden.lessons.flatMap(item => (Array.isArray(item.proposalDigests) ? item.proposalDigests : []).map(proposalDigest => ({ lessonKey: item.lessonKey, proposalDigest, state: 'PROPOSED_NOT_APPLIED', importedFromGardenLedgerDigest: garden.ledgerDigest, reversible: true, inherited: false })));
  proposedImprovements.forEach(item => validDigest(item.proposalDigest, 'Grand Garden proposal digest'));
  const adapted = {
    schema: LEDGER_SCHEMA,
    ledgerDigest: null,
    ledgerId: 'workshop-import-' + garden.ledgerDigest.slice(0, 20),
    status: 'EXPERIMENTAL',
    state: mapped.some(item => item.status === 'CANDIDATE') ? 'IMPORTED_CANDIDATES_AWAIT_WORKSHOP_VERIFICATION' : contradictions.length ? 'IMPORTED_DISSENT_NO_ELIGIBLE_LESSON' : 'IMPORTED_INSUFFICIENT_EVIDENCE',
    asOf: garden.asOf,
    authorization: clone(garden.authorization),
    providerBoundary: { mode: 'IMPORTED_DIGEST_VERIFIED_GRAND_GARDEN_LEDGER', sourceSchema: GRAND_GARDEN_LEDGER_SCHEMA, sourceLedgerDigest: garden.ledgerDigest, rawTaskDataPresent: false, taskHistoryRead: false, crossTaskMessaging: false },
    retention: clone(garden.retention),
    limits: clone(garden.limits),
    source: { collectionId: garden.ledgerId, inputDigest: garden.ledgerDigest, sourceDigests: [garden.ledgerDigest] },
    cycleHistory: clone(garden.cycleHistory),
    observations: [],
    userFeedback: [],
    candidateLessons: mapped,
    contradictions,
    proposedImprovements,
    verificationReceipts: [],
    lessons: mapped,
    lessonVersions: mapped,
    deduplication: { exactSignalDuplicatesRemoved: Number(garden.valueAmplification.duplicateSignalsSkipped || 0) },
    activeSet: { taskAliases: clone(garden.activeSet.taskAliases || []), observedTaskAliases: clone(garden.activeSet.taskAliases || []), missingTaskAliases: clone(garden.activeSet.missingTaskAliases || []), reusableOrDissentTaskAliases: clone(garden.activeSet.reusedTaskAliases || []) },
    learningClaim: { demonstrated: false, storedTextAloneCountsAsLearning: false, doubleValueProven: garden.valueAmplification.doubleComputeOutcomeProven === true, modelWeightsChanged: false, claimBoundary: 'The Grand Garden compact ledger digest is verified, but detached verification details were not imported. Candidate lessons remain held until Workshop replay evidence is supplied.' },
    inheritanceDecision: { state: 'EXTERNAL_HUMAN_GATE_ONLY', automatic: false, parentWrites: 0, canonicalWrites: 0, canon: false },
    authority: { providerExecution: 'INERT_IMPORT_ONLY', taskHistoryRead: false, crossTaskMessaging: false, permissionEscalation: false, promptRewrite: false, modelWeightTraining: false, automaticIntegration: false, canon: false },
    compatibility: { sourceSchema: GRAND_GARDEN_LEDGER_SCHEMA, sourceLedgerDigest: garden.ledgerDigest, sourceDigestVerified: true, rawSourceSnapshotsImported: false, runtimeDependencyOnGarden: false }
  };
  adapted.ledgerDigest = digest(without(adapted, 'ledgerDigest'));
  return adapted;
}

function createMirrorProposal(ledgerValue, requestValue) {
  const ledger = validateLedgerDigest(clone(ledgerValue));
  const request = clone(requestValue);
  assertNoPrivateData(request, 'Mirror proposal request');
  exactKeys(request, ['schema', 'requestId', 'lessonKey', 'reviewerAlias', 'asOf', 'target', 'explicitReview'], 'Mirror proposal request');
  if (request.schema !== MIRROR_REQUEST_SCHEMA) fail('MIRROR_REQUEST', 'Mirror proposal request schema is invalid');
  validId(request.requestId, 'Mirror request id');
  validId(request.lessonKey, 'Mirror lesson key');
  validId(request.reviewerAlias, 'Mirror reviewer alias');
  const asOf = dateMs(request.asOf, 'Mirror proposal asOf');
  if (request.target !== 'MIRROR_PRIVATE_ACTION_LESSON_INTAKE' || request.explicitReview !== true) fail('MIRROR_AUTHORITY', 'Mirror lesson export requires the private proposal intake and explicit review');
  const lesson = ledger.lessons.find(item => item.lessonKey === request.lessonKey);
  if (!lesson || lesson.status !== 'CANDIDATE' || lesson.verificationState !== 'PASS_REPLAY_BOUND' || dateMs(lesson.refreshRequiredAt, 'lesson refreshRequiredAt') <= asOf) fail('LESSON_NOT_VERIFIED', 'Mirror proposal requires one fresh replay-bound candidate lesson');
  const proposal = {
    schema: MIRROR_PROPOSAL_SCHEMA,
    proposalDigest: null,
    proposalId: 'mirror-proposal-' + digest({ requestId: request.requestId, candidateDigest: lesson.candidateDigest }).slice(0, 20),
    status: 'EXPERIMENTAL',
    state: 'REVIEW_REQUIRED',
    target: 'service:mirror-native:private-action-lesson-intake-only',
    reviewerAlias: request.reviewerAlias,
    sourceLedgerDigest: ledger.ledgerDigest,
    lesson: { lessonKey: lesson.lessonKey, pattern: lesson.pattern, confidence: lesson.confidence, candidateDigest: lesson.candidateDigest, sourceBindings: lesson.sourceBindings, verificationDigests: lesson.verificationDigests, refreshRequiredAt: lesson.refreshRequiredAt },
    trainingMeaning: 'PRIVATE_LESSON_PROPOSAL_NOT_MODEL_WEIGHT_TRAINING',
    authority: { applied: false, inherited: false, promptRewrite: false, modelWeightsChanged: false, parentWrites: 0, canonicalWrites: 0, automaticMerge: false, canon: false },
    createdAt: request.asOf
  };
  proposal.proposalDigest = digest(without(proposal, 'proposalDigest'));
  return proposal;
}

function providerCapabilityReceipt(asOf) {
  dateMs(asOf, 'capability asOf');
  const receipt = {
    schema: CAPABILITY_SCHEMA,
    receiptDigest: null,
    capabilityId: 'codex.task.compact-snapshot.read',
    status: 'MISSING_CAPABILITY_OR_AUTHORIZATION',
    execution: 'INERT',
    checkedAt: asOf,
    automaticEnumeration: false,
    compactSnapshotsOnly: true,
    taskHistoryRead: false,
    crossTaskMessaging: false,
    credentialInspection: false,
    providerImpersonation: false,
    automaticIntegration: false,
    canon: false,
    boundary: 'This repository module has no Codex task provider. A separately authorized provider may supply compact redacted snapshots through the declared interface.'
  };
  receipt.receiptDigest = digest(without(receipt, 'receiptDigest'));
  return receipt;
}

function validateValueRubric(rubric) {
  exactKeys(rubric, ['predeclared', 'sameRubricBothArms', 'heldOutRequired', 'scoreMin', 'scoreMax', 'approachTargetRatio', 'primaryMetric', 'secondaryMetric', 'overheadMetric'], 'value rubric');
  const metrics = ['primaryMetric', 'secondaryMetric', 'overheadMetric'];
  if (rubric.predeclared !== true || rubric.sameRubricBothArms !== true || rubric.heldOutRequired !== true || rubric.scoreMin !== 0 || rubric.scoreMax !== 100 || typeof rubric.approachTargetRatio !== 'number' || rubric.approachTargetRatio < 1 || rubric.approachTargetRatio > 2 || metrics.some(key => typeof rubric[key] !== 'string' || !rubric[key].trim() || rubric[key].length > 240)) fail('VALUE_RUBRIC', 'the scored trial rubric is not claimable');
  return rubric;
}

function validateReviewDecision(value) {
  const decision = clone(value);
  const v2 = decision.schema === REVIEW_DECISION_V2_SCHEMA;
  exactKeys(decision, v2
    ? ['schema', 'receiptDigest', 'decisionId', 'decisionOwner', 'decision', 'decidedAt', 'sourceLedgerDigest', 'candidateDigest', 'reviewPacketDigest', 'reviewReceiptDigest', 'authorizationReceiptDigest', 'prospectivePlanDigest', 'assignmentRequestId', 'reviewSubjectDigest', 'hostAuthenticated']
    : ['schema', 'receiptDigest', 'decisionId', 'decisionOwner', 'decision', 'decidedAt', 'sourceLedgerDigest', 'candidateDigest', 'reviewPacketDigest'], 'candidate review decision');
  if (decision.schema !== REVIEW_DECISION_SCHEMA && !v2) fail('REVIEW_DECISION', 'candidate review decision schema is invalid');
  validDigest(decision.receiptDigest, 'review decision receipt digest');
  if (digest(without(decision, 'receiptDigest')) !== decision.receiptDigest) fail('REVIEW_DECISION_DIGEST', 'candidate review decision digest does not match its contents');
  validId(decision.decisionId, 'review decision id');
  if (decision.decisionOwner !== 'MIKE' || !new Set(['ACCEPT_FOR_ONE_HELD_OUT_TRIAL_CASE', 'HOLD_FOR_REFRESH', 'REJECT_CANDIDATE']).has(decision.decision)) fail('REVIEW_DECISION', 'candidate review decision is outside Mike-owned choices');
  dateMs(decision.decidedAt, 'review decision decidedAt');
  validDigest(decision.sourceLedgerDigest, 'review decision source ledger digest');
  validDigest(decision.candidateDigest, 'review decision candidate digest');
  validDigest(decision.reviewPacketDigest, 'review packet digest');
  if (v2) {
    validDigest(decision.reviewReceiptDigest, 'foundation review receipt digest');
    validDigest(decision.authorizationReceiptDigest, 'review authorization receipt digest');
    validDigest(decision.prospectivePlanDigest, 'review prospective plan digest');
    validId(decision.assignmentRequestId, 'review assignment request id');
    validDigest(decision.reviewSubjectDigest, 'review subject digest');
    if (decision.hostAuthenticated !== true) fail('REVIEW_DECISION_AUTHORITY', 'v2 review decision must retain authenticated host provenance');
    const subject = digest({ sourceLedgerDigest: decision.sourceLedgerDigest, candidateDigest: decision.candidateDigest, reviewPacketDigest: decision.reviewPacketDigest, prospectivePlanDigest: decision.prospectivePlanDigest, assignmentRequestId: decision.assignmentRequestId });
    if (subject !== decision.reviewSubjectDigest) fail('REVIEW_SUBJECT_DIGEST', 'review subject digest does not match the exact proposed case');
  }
  return decision;
}

function validateFoundationReviewReceipt(value) {
  const receipt = clone(value);
  exactKeys(receipt, ['schema', 'receiptId', 'constitutionId', 'action', 'seatId', 'reviewer', 'artifact', 'verdict', 'evidence', 'issuedAt'], 'Foundation review receipt');
  if (receipt.schema !== FOUNDATION_REVIEW_RECEIPT_SCHEMA) fail('FOUNDATION_REVIEW_RECEIPT', 'shared Workshop review receipt schema is invalid');
  if (typeof receipt.receiptId !== 'string' || !receipt.receiptId.trim() || receipt.receiptId.length > 160 || typeof receipt.constitutionId !== 'string' || !receipt.constitutionId.trim() || receipt.constitutionId.length > 120) fail('FOUNDATION_REVIEW_RECEIPT', 'shared Workshop review receipt identity is invalid');
  if (receipt.action !== 'shadow-clone-heldout-trial-review' || receipt.seatId !== 'mike-final-gate') fail('FOUNDATION_REVIEW_BINDING', 'shared review receipt is not for the Mike held-out-trial gate');
  exactKeys(receipt.reviewer, ['identityId', 'kind', 'displayName'], 'Foundation review reviewer');
  if (typeof receipt.reviewer.identityId !== 'string' || !receipt.reviewer.identityId.trim() || receipt.reviewer.identityId.length > 120 || String(receipt.reviewer.kind).toLowerCase() !== 'human') fail('FOUNDATION_REVIEW_IDENTITY', 'shared review receipt must occupy an attributed human seat');
  exactKeys(receipt.artifact, ['artifactId', 'digest'], 'Foundation review artifact');
  validId(receipt.artifact.artifactId, 'Foundation review artifact id');
  validDigest(receipt.artifact.digest, 'Foundation review artifact digest');
  if (!new Set(['UP', 'DOWN', 'HOLD']).has(receipt.verdict)) fail('FOUNDATION_REVIEW_VERDICT', 'shared review verdict is invalid');
  exactKeys(receipt.evidence, ['summary', 'refs'], 'Foundation review evidence');
  if (typeof receipt.evidence.summary !== 'string' || !receipt.evidence.summary.trim() || receipt.evidence.summary.length > 1000 || !Array.isArray(receipt.evidence.refs) || receipt.evidence.refs.length > 32) fail('FOUNDATION_REVIEW_EVIDENCE', 'shared review evidence is invalid');
  dateMs(receipt.issuedAt, 'Foundation review issuedAt');
  return receipt;
}

function createReviewDecision(ledgerValue, requestValue) {
  const ledger = validateLedgerDigest(clone(ledgerValue));
  const request = clone(requestValue);
  assertNoPrivateData(request, 'candidate review intake request');
  exactKeys(request, ['schema', 'requestId', 'asOf', 'lessonKey', 'candidateDigest', 'reviewPacketDigest', 'prospectivePlanDigest', 'assignmentRequestId', 'reviewReceipt', 'authorization'], 'candidate review intake request');
  if (request.schema !== REVIEW_INTAKE_REQUEST_SCHEMA) fail('REVIEW_INTAKE_REQUEST', 'candidate review intake request schema is invalid');
  validId(request.requestId, 'review intake request id');
  validId(request.lessonKey, 'review intake lesson key');
  validDigest(request.candidateDigest, 'review intake candidate digest');
  validDigest(request.reviewPacketDigest, 'review packet digest');
  validDigest(request.prospectivePlanDigest, 'review prospective plan digest');
  validId(request.assignmentRequestId, 'review assignment request id');
  const asOf = dateMs(request.asOf, 'review intake asOf');
  exactKeys(request.authorization, ['hostAuthenticatedReviewReceipt', 'authenticatedMikeIdentityDigest', 'authorizationReceiptDigest', 'automaticDecision'], 'review intake authorization');
  validDigest(request.authorization.authenticatedMikeIdentityDigest, 'authenticated Mike identity digest');
  validDigest(request.authorization.authorizationReceiptDigest, 'review authorization receipt digest');
  if (request.authorization.hostAuthenticatedReviewReceipt !== true || request.authorization.automaticDecision !== false) fail('REVIEW_INTAKE_AUTHORITY', 'host-authenticated Mike review and a non-automatic decision are required');

  const lesson = ledger.lessons.find(item => item.lessonKey === request.lessonKey && item.candidateDigest === request.candidateDigest);
  if (!lesson || lesson.status !== 'CANDIDATE' || lesson.verificationState !== 'PASS_REPLAY_BOUND') fail('REVIEW_CANDIDATE', 'review intake requires the current replay-bound candidate');
  if (dateMs(lesson.refreshRequiredAt, 'lesson refreshRequiredAt') <= asOf) fail('REVIEW_CANDIDATE_STALE', 'candidate requires refresh before review intake');
  const review = validateFoundationReviewReceipt(request.reviewReceipt);
  const issuedAt = dateMs(review.issuedAt, 'Foundation review issuedAt');
  if (issuedAt < dateMs(ledger.asOf, 'ledger asOf') || issuedAt > asOf) fail('FOUNDATION_REVIEW_TIME', 'shared review receipt is outside the current candidate review window');
  if (digest(review.reviewer.identityId) !== request.authorization.authenticatedMikeIdentityDigest) fail('FOUNDATION_REVIEW_IDENTITY', 'authenticated Mike identity digest does not match the review seat');
  const reviewSubjectDigest = digest({ sourceLedgerDigest: ledger.ledgerDigest, candidateDigest: request.candidateDigest, reviewPacketDigest: request.reviewPacketDigest, prospectivePlanDigest: request.prospectivePlanDigest, assignmentRequestId: request.assignmentRequestId });
  if (review.artifact.artifactId !== request.assignmentRequestId || review.artifact.digest !== reviewSubjectDigest) fail('FOUNDATION_REVIEW_BINDING', 'shared review receipt does not bind the exact ledger, candidate, packet, plan, and proposed case');
  const mapped = { UP: 'ACCEPT_FOR_ONE_HELD_OUT_TRIAL_CASE', HOLD: 'HOLD_FOR_REFRESH', DOWN: 'REJECT_CANDIDATE' }[review.verdict];
  const decision = {
    schema: REVIEW_DECISION_V2_SCHEMA,
    receiptDigest: null,
    decisionId: 'candidate-decision-' + digest({ requestId: request.requestId, reviewReceipt: digest(review) }).slice(0, 20),
    decisionOwner: 'MIKE',
    decision: mapped,
    decidedAt: review.issuedAt,
    sourceLedgerDigest: ledger.ledgerDigest,
    candidateDigest: request.candidateDigest,
    reviewPacketDigest: request.reviewPacketDigest,
    reviewReceiptDigest: digest(review),
    authorizationReceiptDigest: request.authorization.authorizationReceiptDigest,
    prospectivePlanDigest: request.prospectivePlanDigest,
    assignmentRequestId: request.assignmentRequestId,
    reviewSubjectDigest,
    hostAuthenticated: true
  };
  decision.receiptDigest = digest(without(decision, 'receiptDigest'));
  return decision;
}

function validateParticipationReceipt(value, asOfValue) {
  const receipt = clone(value);
  exactKeys(receipt, ['schema', 'receiptDigest', 'participationId', 'prospectivePlanDigest', 'candidateDigest', 'assignmentRequestId', 'seat', 'recipientAlias', 'baseContextDigest', 'requestedAt', 'expiresAt', 'state', 'withdrawalReceiptDigest', 'automaticEnrollment'], 'trial participation receipt');
  if (receipt.schema !== PARTICIPATION_RECEIPT_SCHEMA) fail('PARTICIPATION_RECEIPT', 'trial participation receipt schema is invalid');
  validDigest(receipt.receiptDigest, 'participation receipt digest');
  if (digest(without(receipt, 'receiptDigest')) !== receipt.receiptDigest) fail('PARTICIPATION_RECEIPT_DIGEST', 'trial participation receipt digest does not match its contents');
  validId(receipt.participationId, 'participation id');
  validDigest(receipt.prospectivePlanDigest, 'participation prospective plan digest');
  validDigest(receipt.candidateDigest, 'participation candidate digest');
  validId(receipt.assignmentRequestId, 'participation assignment request id');
  if (!new Set(['BASELINE', 'LEARNING_ROUTE']).has(receipt.seat)) fail('PARTICIPATION_RECEIPT', 'participation seat is invalid');
  validId(receipt.recipientAlias, 'participation recipient alias');
  validDigest(receipt.baseContextDigest, 'participation base context digest');
  const requestedAt = dateMs(receipt.requestedAt, 'participation requestedAt');
  const expiresAt = dateMs(receipt.expiresAt, 'participation expiresAt');
  if (expiresAt <= requestedAt || expiresAt - requestedAt > 7 * 86400000) fail('PARTICIPATION_EXPIRY', 'participation receipt must be positive and no longer than seven days');
  if (receipt.state !== 'OPT_IN_ONE_HELD_OUT_CASE' || receipt.withdrawalReceiptDigest !== null || receipt.automaticEnrollment !== false) fail('PARTICIPATION_AUTHORITY', 'participation must be active, one-case, unwithdrawn, and non-automatic');
  if (asOfValue !== undefined && (requestedAt > asOfValue || expiresAt <= asOfValue)) fail('PARTICIPATION_EXPIRY', 'participation receipt is not active at assignment time');
  return receipt;
}

function prepareTrialAssignment(ledgerValue, requestValue) {
  const ledger = validateLedgerDigest(clone(ledgerValue));
  const request = clone(requestValue);
  assertNoPrivateData(request, 'trial assignment request');
  exactKeys(request, ['schema', 'requestId', 'asOf', 'prospectivePlanDigest', 'lessonKey', 'candidateDigest', 'reviewDecision', 'recipients', 'rubric', 'authority'], 'trial assignment request');
  const receiptBound = request.schema === TRIAL_ASSIGNMENT_REQUEST_V2_SCHEMA;
  if (request.schema !== TRIAL_ASSIGNMENT_REQUEST_SCHEMA && !receiptBound) fail('TRIAL_ASSIGNMENT_REQUEST', 'trial assignment request schema is invalid');
  validId(request.requestId, 'trial assignment request id');
  const asOf = dateMs(request.asOf, 'trial assignment asOf');
  validDigest(request.prospectivePlanDigest, 'prospective plan digest');
  validId(request.lessonKey, 'trial assignment lesson key');
  validDigest(request.candidateDigest, 'trial assignment candidate digest');
  validateValueRubric(request.rubric);
  exactKeys(request.recipients, ['baseline', 'learningRoute'], 'trial assignment recipients');
  const normalizedRecipients = {};
  for (const [key, recipient] of Object.entries(request.recipients)) {
    exactKeys(recipient, receiptBound ? ['alias', 'baseContextDigest', 'participationReceipt'] : ['alias', 'baseContextDigest', 'explicitRequest'], key + ' recipient');
    validId(recipient.alias, key + ' recipient alias');
    validDigest(recipient.baseContextDigest, key + ' recipient base context digest');
    if (!receiptBound) {
      if (typeof recipient.explicitRequest !== 'boolean') fail('TRIAL_RECIPIENT', key + ' explicit request must be boolean');
      normalizedRecipients[key] = { alias: recipient.alias, baseContextDigest: recipient.baseContextDigest, explicitRequest: recipient.explicitRequest, participationReceipt: null };
    } else if (recipient.participationReceipt === null) {
      normalizedRecipients[key] = { alias: recipient.alias, baseContextDigest: recipient.baseContextDigest, explicitRequest: false, participationReceipt: null };
    } else {
      const participation = validateParticipationReceipt(recipient.participationReceipt, asOf);
      const expectedSeat = key === 'baseline' ? 'BASELINE' : 'LEARNING_ROUTE';
      if (participation.prospectivePlanDigest !== request.prospectivePlanDigest || participation.candidateDigest !== request.candidateDigest || participation.assignmentRequestId !== request.requestId || participation.seat !== expectedSeat || participation.recipientAlias !== recipient.alias || participation.baseContextDigest !== recipient.baseContextDigest) fail('PARTICIPATION_BINDING', key + ' participation receipt does not match the exact proposed case and seat');
      if (dateMs(participation.requestedAt, 'participation requestedAt') < dateMs(ledger.asOf, 'ledger asOf')) fail('PARTICIPATION_BINDING', key + ' participation predates the selected learning ledger');
      normalizedRecipients[key] = { alias: recipient.alias, baseContextDigest: recipient.baseContextDigest, explicitRequest: true, participationReceipt: participation };
    }
  }
  exactKeys(request.authority, receiptBound ? ['hostAuthenticatedMikeReview', 'hostAuthenticatedRecipientRequests', 'automaticPresentation', 'crossTaskMessaging', 'automaticApplication', 'automaticInheritance'] : ['hostAuthenticatedMikeReview', 'automaticPresentation', 'crossTaskMessaging', 'automaticApplication', 'automaticInheritance'], 'trial assignment authority');
  if (typeof request.authority.hostAuthenticatedMikeReview !== 'boolean' || (receiptBound && typeof request.authority.hostAuthenticatedRecipientRequests !== 'boolean') || request.authority.automaticPresentation !== false || request.authority.crossTaskMessaging !== false || request.authority.automaticApplication !== false || request.authority.automaticInheritance !== false) fail('TRIAL_ASSIGNMENT_AUTHORITY', 'trial assignment cannot widen presentation, messaging, application, or inheritance authority');

  const review = request.reviewDecision === null ? null : validateReviewDecision(request.reviewDecision);
  if (review && (review.sourceLedgerDigest !== ledger.ledgerDigest || review.candidateDigest !== request.candidateDigest)) fail('REVIEW_BINDING', 'review decision is not bound to this ledger and candidate');
  if (review && dateMs(review.decidedAt, 'review decision decidedAt') > asOf) fail('REVIEW_BINDING', 'review decision cannot postdate the assignment request');
  if (receiptBound && review && (review.schema !== REVIEW_DECISION_V2_SCHEMA || review.prospectivePlanDigest !== request.prospectivePlanDigest || review.assignmentRequestId !== request.requestId)) fail('REVIEW_BINDING', 'receipt-bound assignment requires a v2 decision for this exact plan and case request');

  const lesson = ledger.lessons.find(item => item.lessonKey === request.lessonKey && item.candidateDigest === request.candidateDigest);
  const historical = Array.isArray(ledger.lessonVersions) && ledger.lessonVersions.some(item => item.lessonKey === request.lessonKey && item.candidateDigest === request.candidateDigest);
  const blockers = [];
  function block(code, gapType, statement) { blockers.push({ code, gapType, statement }); }
  if (!lesson) block(historical ? 'CANDIDATE_NOT_CURRENT' : 'CANDIDATE_NOT_FOUND', 'EVIDENCE', 'The selected candidate is not the current digest-bound lesson version.');
  else {
    if (lesson.status !== 'CANDIDATE') block('CANDIDATE_NOT_ELIGIBLE', 'EVIDENCE', 'The selected lesson is not a candidate.');
    if (lesson.verificationState !== 'PASS_REPLAY_BOUND') block('CANDIDATE_NOT_REPLAY_BOUND', 'EVIDENCE', 'The selected candidate lacks a replay-bound verification receipt.');
    if (dateMs(lesson.refreshRequiredAt, 'lesson refreshRequiredAt') <= asOf) block('CANDIDATE_REFRESH_REQUIRED', 'EVIDENCE', 'The selected candidate is stale and must be refreshed before assignment.');
  }
  if (!review) block('MISSING_SPECIFIC_MIKE_REVIEW', 'AUTHORITY', 'Mike has not supplied a digest-bound decision for this specific candidate.');
  else if (review.decision !== 'ACCEPT_FOR_ONE_HELD_OUT_TRIAL_CASE') block(review.decision === 'HOLD_FOR_REFRESH' ? 'MIKE_REVIEW_HELD' : 'MIKE_REVIEW_REJECTED', 'AUTHORITY', 'Mike did not accept this candidate for one held-out trial case.');
  if (!request.authority.hostAuthenticatedMikeReview) block('MISSING_AUTHENTICATED_REVIEW_PROVIDER', 'AUTHORITY', 'The host did not authenticate the Mike review decision.');
  if (receiptBound && !request.authority.hostAuthenticatedRecipientRequests) block('MISSING_AUTHENTICATED_RECIPIENT_PROVIDER', 'AUTHORITY', 'The host did not authenticate the two recipient participation receipts.');
  if (normalizedRecipients.baseline.alias === normalizedRecipients.learningRoute.alias) block('PAIRED_RECIPIENTS_NOT_DISTINCT', 'CONTRACT', 'Baseline and learning-route recipients must be distinct held-out seats.');
  for (const [key, recipient] of Object.entries(normalizedRecipients)) {
    if (!recipient.explicitRequest) block(key === 'baseline' ? 'MISSING_BASELINE_RECIPIENT_REQUEST' : 'MISSING_LEARNING_RECIPIENT_REQUEST', 'AUTHORITY', 'Each held-out recipient must explicitly request its own trial seat.');
    if (lesson && lesson.supportTaskAliases.includes(recipient.alias)) block(key === 'baseline' ? 'BASELINE_RECIPIENT_DERIVED_LESSON' : 'LEARNING_RECIPIENT_DERIVED_LESSON', 'EVIDENCE', 'A task that derived the lesson is not held out for that lesson.');
  }

  const ready = blockers.length === 0;
  const assignmentId = 'trial-assignment-' + digest({ requestId: request.requestId, ledgerDigest: ledger.ledgerDigest, candidateDigest: request.candidateDigest }).slice(0, 20);
  const caseAlias = 'heldout-case-' + digest({ assignmentId, recipients: receiptBound ? normalizedRecipients : request.recipients }).slice(0, 16);
  const expiryCandidates = lesson ? [lesson.refreshRequiredAt] : [request.asOf];
  if (receiptBound) for (const recipient of Object.values(normalizedRecipients)) if (recipient.participationReceipt) expiryCandidates.push(recipient.participationReceipt.expiresAt);
  const expiresAt = expiryCandidates.sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const assignment = {
    schema: receiptBound ? TRIAL_ASSIGNMENT_V2_SCHEMA : TRIAL_ASSIGNMENT_SCHEMA,
    assignmentDigest: null,
    assignmentId,
    status: 'EXPERIMENTAL',
    state: ready ? 'READY_RECIPIENT_INITIATED_PAIRED_TRIAL' : 'HOLD_TRIAL_ASSIGNMENT',
    createdAt: request.asOf,
    expiresAt,
    sourceLedgerDigest: ledger.ledgerDigest,
    prospectivePlanDigest: request.prospectivePlanDigest,
    candidate: {
      lessonKey: request.lessonKey,
      candidateDigest: request.candidateDigest,
      verificationState: lesson ? lesson.verificationState : 'NOT_AVAILABLE',
      verificationDigests: lesson ? clone(lesson.verificationDigests) : [],
      pattern: ready ? lesson.pattern : null
    },
    reviewBinding: review ? (receiptBound ? { decisionSchema: review.schema, decisionReceiptDigest: review.receiptDigest, decision: review.decision, reviewPacketDigest: review.reviewPacketDigest, reviewReceiptDigest: review.reviewReceiptDigest, authorizationReceiptDigest: review.authorizationReceiptDigest, reviewSubjectDigest: review.reviewSubjectDigest, hostAuthenticated: request.authority.hostAuthenticatedMikeReview } : { decisionReceiptDigest: review.receiptDigest, decision: review.decision, reviewPacketDigest: review.reviewPacketDigest, hostAuthenticated: request.authority.hostAuthenticatedMikeReview }) : null,
    recipients: {
      baseline: Object.assign({ alias: normalizedRecipients.baseline.alias, baseContextDigest: normalizedRecipients.baseline.baseContextDigest, explicitRequest: normalizedRecipients.baseline.explicitRequest, lessonExcluded: true }, receiptBound ? { participationReceiptDigest: normalizedRecipients.baseline.participationReceipt ? normalizedRecipients.baseline.participationReceipt.receiptDigest : null, hostAuthenticated: request.authority.hostAuthenticatedRecipientRequests } : {}),
      learningRoute: Object.assign({ alias: normalizedRecipients.learningRoute.alias, baseContextDigest: normalizedRecipients.learningRoute.baseContextDigest, explicitRequest: normalizedRecipients.learningRoute.explicitRequest, lessonPresented: false }, receiptBound ? { participationReceiptDigest: normalizedRecipients.learningRoute.participationReceipt ? normalizedRecipients.learningRoute.participationReceipt.receiptDigest : null, hostAuthenticated: request.authority.hostAuthenticatedRecipientRequests } : {})
    },
    blockers,
    trialCaseTemplate: ready ? {
      caseAlias,
      heldOut: true,
      rubric: clone(request.rubric),
      rubricDigest: digest(request.rubric),
      baseline: { recipientAlias: normalizedRecipients.baseline.alias, lessonExcluded: true, outcomeReceiptRequired: true, testReceiptRequired: true, evaluatorScoreRequired: true },
      learningRoute: { recipientAlias: normalizedRecipients.learningRoute.alias, lessonPresentation: { candidateDigest: request.candidateDigest, pattern: lesson.pattern, presented: false, recipientAcknowledgementRequired: true }, outcomeReceiptRequired: true, testReceiptRequired: true, evaluatorScoreRequired: true },
      minimumIndependentEvaluatorAliases: 2
    } : null,
    adoption: { presented: false, applied: false, crossTaskMessaging: false, automaticPromptRewrite: false, automaticInheritance: false, automaticMerge: false, canon: false },
    claimBoundary: ready ? (receiptBound ? 'This receipt-bound packet prepares one recipient-initiated held-out paired case. The host must separately present the lesson, collect acknowledgements and outcome receipts, and obtain independent evaluator scores; no value is established yet.' : 'This legacy boolean-bound packet prepares one recipient-initiated held-out paired case for compatibility only. A real value claim requires receipt-bound v2 review and participation evidence.') : 'This typed hold identifies missing authority, evidence, or recipient consent. It does not reveal the lesson pattern, message a task, apply a lesson, or establish value.'
  };
  assignment.assignmentDigest = digest(without(assignment, 'assignmentDigest'));
  return assignment;
}

function validateReceiptBoundAssignment(value) {
  const assignment = clone(value);
  assertNoPrivateData(assignment, 'receipt-bound trial assignment');
  exactKeys(assignment, ['schema', 'assignmentDigest', 'assignmentId', 'status', 'state', 'createdAt', 'expiresAt', 'sourceLedgerDigest', 'prospectivePlanDigest', 'candidate', 'reviewBinding', 'recipients', 'blockers', 'trialCaseTemplate', 'adoption', 'claimBoundary'], 'receipt-bound trial assignment');
  if (assignment.schema !== TRIAL_ASSIGNMENT_V2_SCHEMA) fail('ASSIGNMENT_NOT_RECEIPT_BOUND', 'evidence-bound scoring requires a v2 receipt-bound assignment');
  validDigest(assignment.assignmentDigest, 'trial assignment digest');
  if (digest(without(assignment, 'assignmentDigest')) !== assignment.assignmentDigest) fail('TRIAL_ASSIGNMENT_DIGEST', 'trial assignment digest does not match its contents');
  validId(assignment.assignmentId, 'trial assignment id');
  if (assignment.status !== 'EXPERIMENTAL' || assignment.state !== 'READY_RECIPIENT_INITIATED_PAIRED_TRIAL' || !Array.isArray(assignment.blockers) || assignment.blockers.length || !assignment.trialCaseTemplate) fail('TRIAL_ASSIGNMENT_STATE', 'only a blocker-free ready v2 assignment can enter evidence scoring');
  dateMs(assignment.createdAt, 'trial assignment createdAt');
  dateMs(assignment.expiresAt, 'trial assignment expiresAt');
  validDigest(assignment.sourceLedgerDigest, 'trial assignment source ledger digest');
  validDigest(assignment.prospectivePlanDigest, 'trial assignment prospective plan digest');
  exactKeys(assignment.candidate, ['lessonKey', 'candidateDigest', 'verificationState', 'verificationDigests', 'pattern'], 'trial assignment candidate');
  validId(assignment.candidate.lessonKey, 'trial assignment lesson key');
  validDigest(assignment.candidate.candidateDigest, 'trial assignment candidate digest');
  if (assignment.candidate.verificationState !== 'PASS_REPLAY_BOUND' || !Array.isArray(assignment.candidate.verificationDigests) || !assignment.candidate.verificationDigests.length || typeof assignment.candidate.pattern !== 'string' || !assignment.candidate.pattern.trim()) fail('TRIAL_ASSIGNMENT_EVIDENCE', 'ready assignment candidate evidence is incomplete');
  assignment.candidate.verificationDigests.forEach(item => validDigest(item, 'trial assignment verification digest'));
  exactKeys(assignment.reviewBinding, ['decisionSchema', 'decisionReceiptDigest', 'decision', 'reviewPacketDigest', 'reviewReceiptDigest', 'authorizationReceiptDigest', 'reviewSubjectDigest', 'hostAuthenticated'], 'trial assignment review binding');
  if (assignment.reviewBinding.decisionSchema !== REVIEW_DECISION_V2_SCHEMA || assignment.reviewBinding.decision !== 'ACCEPT_FOR_ONE_HELD_OUT_TRIAL_CASE' || assignment.reviewBinding.hostAuthenticated !== true) fail('TRIAL_ASSIGNMENT_AUTHORITY', 'ready assignment lacks receipt-bound Mike review');
  ['decisionReceiptDigest', 'reviewPacketDigest', 'reviewReceiptDigest', 'authorizationReceiptDigest', 'reviewSubjectDigest'].forEach(key => validDigest(assignment.reviewBinding[key], 'trial assignment ' + key));
  exactKeys(assignment.recipients, ['baseline', 'learningRoute'], 'trial assignment recipients');
  exactKeys(assignment.recipients.baseline, ['alias', 'baseContextDigest', 'explicitRequest', 'lessonExcluded', 'participationReceiptDigest', 'hostAuthenticated'], 'baseline assignment recipient');
  exactKeys(assignment.recipients.learningRoute, ['alias', 'baseContextDigest', 'explicitRequest', 'lessonPresented', 'participationReceiptDigest', 'hostAuthenticated'], 'learning assignment recipient');
  for (const recipient of Object.values(assignment.recipients)) {
    validId(recipient.alias, 'trial assignment recipient alias');
    validDigest(recipient.baseContextDigest, 'trial assignment recipient base-context digest');
    validDigest(recipient.participationReceiptDigest, 'trial assignment participation receipt digest');
    if (recipient.explicitRequest !== true || recipient.hostAuthenticated !== true) fail('TRIAL_ASSIGNMENT_AUTHORITY', 'ready assignment lacks authenticated recipient opt-in');
  }
  if (assignment.recipients.baseline.alias === assignment.recipients.learningRoute.alias || assignment.recipients.baseline.lessonExcluded !== true || assignment.recipients.learningRoute.lessonPresented !== false) fail('TRIAL_ASSIGNMENT_PAIR', 'ready assignment paired-arm boundary is invalid');
  exactKeys(assignment.trialCaseTemplate, ['caseAlias', 'heldOut', 'rubric', 'rubricDigest', 'baseline', 'learningRoute', 'minimumIndependentEvaluatorAliases'], 'trial case template');
  validId(assignment.trialCaseTemplate.caseAlias, 'trial case alias');
  validateValueRubric(assignment.trialCaseTemplate.rubric);
  validDigest(assignment.trialCaseTemplate.rubricDigest, 'trial case rubric digest');
  if (digest(assignment.trialCaseTemplate.rubric) !== assignment.trialCaseTemplate.rubricDigest || assignment.trialCaseTemplate.heldOut !== true || assignment.trialCaseTemplate.minimumIndependentEvaluatorAliases < 2) fail('TRIAL_ASSIGNMENT_RUBRIC', 'trial case template is not a held-out common-rubric case');
  exactKeys(assignment.adoption, ['presented', 'applied', 'crossTaskMessaging', 'automaticPromptRewrite', 'automaticInheritance', 'automaticMerge', 'canon'], 'trial assignment adoption');
  if (Object.values(assignment.adoption).some(Boolean)) fail('TRIAL_ASSIGNMENT_AUTHORITY', 'assignment cannot enter evidence scoring with automatic authority');
  return assignment;
}

function validatePresentationAck(value, assignment, asOf) {
  const receipt = clone(value);
  exactKeys(receipt, ['schema', 'receiptDigest', 'presentationId', 'assignmentDigest', 'caseAlias', 'candidateDigest', 'recipientAlias', 'senderReceiptDigest', 'recipientAcknowledgementDigest', 'presentedAt', 'acknowledgedAt', 'recipientAcknowledged', 'recipientElectedUse', 'automaticPromptRewrite'], 'lesson presentation acknowledgement');
  if (receipt.schema !== PRESENTATION_ACK_SCHEMA) fail('PRESENTATION_ACK', 'lesson presentation acknowledgement schema is invalid');
  validDigest(receipt.receiptDigest, 'presentation acknowledgement digest');
  if (digest(without(receipt, 'receiptDigest')) !== receipt.receiptDigest) fail('PRESENTATION_ACK_DIGEST', 'presentation acknowledgement digest does not match its contents');
  validId(receipt.presentationId, 'presentation id');
  ['assignmentDigest', 'candidateDigest', 'senderReceiptDigest', 'recipientAcknowledgementDigest'].forEach(key => validDigest(receipt[key], 'presentation ' + key));
  validId(receipt.caseAlias, 'presentation case alias');
  validId(receipt.recipientAlias, 'presentation recipient alias');
  const presentedAt = dateMs(receipt.presentedAt, 'lesson presentedAt');
  const acknowledgedAt = dateMs(receipt.acknowledgedAt, 'lesson acknowledgedAt');
  if (receipt.assignmentDigest !== assignment.assignmentDigest || receipt.caseAlias !== assignment.trialCaseTemplate.caseAlias || receipt.candidateDigest !== assignment.candidate.candidateDigest || receipt.recipientAlias !== assignment.recipients.learningRoute.alias) fail('PRESENTATION_BINDING', 'lesson presentation acknowledgement does not match the assigned learning seat');
  if (presentedAt < dateMs(assignment.createdAt, 'assignment createdAt') || acknowledgedAt < presentedAt || acknowledgedAt >= dateMs(assignment.expiresAt, 'assignment expiresAt') || acknowledgedAt > asOf) fail('PRESENTATION_TIME', 'lesson presentation acknowledgement is outside the fresh assigned case window');
  if (receipt.recipientAcknowledged !== true || receipt.recipientElectedUse !== true || receipt.automaticPromptRewrite !== false) fail('PRESENTATION_AUTHORITY', 'learning-seat use must be acknowledged, recipient-elected, and not an automatic prompt rewrite');
  return receipt;
}

function validateArmOutcome(value, assignment, arm, asOf, earliestTime) {
  const receipt = clone(value);
  exactKeys(receipt, ['schema', 'receiptDigest', 'outcomeId', 'assignmentDigest', 'caseAlias', 'arm', 'recipientAlias', 'baseContextDigest', 'completedAt', 'finalSummaryDigest', 'outcomeDigest', 'testReceiptDigest', 'primaryOutcomeVerified', 'lessonUse'], arm + ' outcome receipt');
  if (receipt.schema !== ARM_OUTCOME_SCHEMA) fail('ARM_OUTCOME', 'trial arm outcome receipt schema is invalid');
  validDigest(receipt.receiptDigest, arm + ' outcome receipt digest');
  if (digest(without(receipt, 'receiptDigest')) !== receipt.receiptDigest) fail('ARM_OUTCOME_DIGEST', arm + ' outcome receipt digest does not match its contents');
  validId(receipt.outcomeId, arm + ' outcome id');
  ['assignmentDigest', 'baseContextDigest', 'finalSummaryDigest', 'outcomeDigest', 'testReceiptDigest'].forEach(key => validDigest(receipt[key], arm + ' outcome ' + key));
  validId(receipt.caseAlias, arm + ' outcome case alias');
  validId(receipt.recipientAlias, arm + ' outcome recipient alias');
  const key = arm === 'BASELINE' ? 'baseline' : 'learningRoute';
  const recipient = assignment.recipients[key];
  if (receipt.assignmentDigest !== assignment.assignmentDigest || receipt.caseAlias !== assignment.trialCaseTemplate.caseAlias || receipt.arm !== arm || receipt.recipientAlias !== recipient.alias || receipt.baseContextDigest !== recipient.baseContextDigest) fail('ARM_OUTCOME_BINDING', arm + ' outcome does not match its assigned task seat');
  const completedAt = dateMs(receipt.completedAt, arm + ' outcome completedAt');
  if (completedAt < earliestTime || completedAt >= dateMs(assignment.expiresAt, 'assignment expiresAt') || completedAt > asOf) fail('ARM_OUTCOME_TIME', arm + ' outcome is outside the fresh assigned case window');
  if (receipt.primaryOutcomeVerified !== true) fail('ARM_OUTCOME_EVIDENCE', arm + ' primary outcome lacks a verified final and test receipt');
  exactKeys(receipt.lessonUse, ['candidateDigest', 'recipientElectedUse', 'automaticPromptRewrite'], arm + ' outcome lesson use');
  if (receipt.lessonUse.automaticPromptRewrite !== false) fail('ARM_OUTCOME_AUTHORITY', 'trial outcome cannot claim automatic prompt rewriting');
  if (arm === 'BASELINE') {
    if (receipt.lessonUse.candidateDigest !== null || receipt.lessonUse.recipientElectedUse !== false) fail('BASELINE_CONTAMINATION', 'baseline outcome must exclude the candidate lesson');
  } else if (receipt.lessonUse.candidateDigest !== assignment.candidate.candidateDigest || receipt.lessonUse.recipientElectedUse !== true) fail('LEARNING_ROUTE_USE', 'learning outcome must bind the recipient-elected candidate lesson');
  return receipt;
}

function validateCaseEvaluation(value, assignment, outcomes, rubricDigest, asOf) {
  const receipt = clone(value);
  exactKeys(receipt, ['schema', 'receiptDigest', 'evaluationId', 'assignmentDigest', 'caseAlias', 'evaluatorAlias', 'evaluatedAt', 'rubricDigest', 'outcomeReceiptDigests', 'independence', 'scores', 'statement'], 'trial case evaluation');
  if (receipt.schema !== CASE_EVALUATION_SCHEMA) fail('CASE_EVALUATION', 'trial case evaluation schema is invalid');
  validDigest(receipt.receiptDigest, 'case evaluation receipt digest');
  if (digest(without(receipt, 'receiptDigest')) !== receipt.receiptDigest) fail('CASE_EVALUATION_DIGEST', 'case evaluation receipt digest does not match its contents');
  validId(receipt.evaluationId, 'case evaluation id');
  validDigest(receipt.assignmentDigest, 'case evaluation assignment digest');
  validId(receipt.caseAlias, 'case evaluation case alias');
  validId(receipt.evaluatorAlias, 'case evaluator alias');
  const evaluatedAt = dateMs(receipt.evaluatedAt, 'case evaluatedAt');
  validDigest(receipt.rubricDigest, 'case evaluation rubric digest');
  if (receipt.assignmentDigest !== assignment.assignmentDigest || receipt.caseAlias !== assignment.trialCaseTemplate.caseAlias || receipt.rubricDigest !== rubricDigest || evaluatedAt < Math.max(dateMs(outcomes.baseline.completedAt, 'baseline completedAt'), dateMs(outcomes.learningRoute.completedAt, 'learning completedAt')) || evaluatedAt > asOf) fail('CASE_EVALUATION_BINDING', 'case evaluation is not bound to the completed assigned case and rubric');
  if (!Array.isArray(receipt.outcomeReceiptDigests) || receipt.outcomeReceiptDigests.length !== 2 || receipt.outcomeReceiptDigests[0] !== outcomes.baseline.receiptDigest || receipt.outcomeReceiptDigests[1] !== outcomes.learningRoute.receiptDigest) fail('CASE_EVALUATION_BINDING', 'case evaluation outcome receipts are incomplete or reordered');
  exactKeys(receipt.independence, ['fromRecipients', 'fromLessonSources', 'hostAuthenticatedEvaluator'], 'case evaluator independence');
  if (receipt.independence.fromRecipients !== true || receipt.independence.fromLessonSources !== true || receipt.independence.hostAuthenticatedEvaluator !== true || receipt.evaluatorAlias === assignment.recipients.baseline.alias || receipt.evaluatorAlias === assignment.recipients.learningRoute.alias) fail('CASE_EVALUATOR_INDEPENDENCE', 'case evaluator is not independently authenticated from recipients and lesson sources');
  exactKeys(receipt.scores, ['baseline', 'learningRoute'], 'case evaluation scores');
  function validateScores(scores, label) {
    exactKeys(scores, ['primaryValue', 'secondaryReusableValue', 'overhead'], label + ' scores');
    for (const key of ['primaryValue', 'secondaryReusableValue', 'overhead']) if (typeof scores[key] !== 'number' || scores[key] < 0 || scores[key] > 100) fail('VALUE_SCORE', label + ' score is outside 0-100');
  }
  validateScores(receipt.scores.baseline, 'baseline');
  validateScores(receipt.scores.learningRoute, 'learning route');
  if (receipt.scores.baseline.primaryValue !== receipt.scores.learningRoute.primaryValue) fail('VALUE_RUBRIC', 'each evaluator must hold primary outcome equal across paired arms');
  if (receipt.scores.baseline.secondaryReusableValue !== 0) fail('VALUE_RUBRIC', 'baseline secondary lesson value must remain zero');
  if (typeof receipt.statement !== 'string' || !receipt.statement.trim() || receipt.statement.length > 1200) fail('CASE_EVALUATION', 'case evaluator statement is required');
  const baselineNet = receipt.scores.baseline.primaryValue + receipt.scores.baseline.secondaryReusableValue - receipt.scores.baseline.overhead;
  const learningNet = receipt.scores.learningRoute.primaryValue + receipt.scores.learningRoute.secondaryReusableValue - receipt.scores.learningRoute.overhead;
  if (baselineNet <= 0) fail('VALUE_SCORE', 'evaluator baseline net value must be greater than zero');
  return { receipt, baselineNet, learningNet, ratio: Number((learningNet / baselineNet).toFixed(6)) };
}

function scoreEvidenceBoundTrial(value) {
  const input = clone(value);
  assertNoPrivateData(input, 'evidence-bound value trial');
  exactKeys(input, ['schema', 'trialId', 'asOf', 'prospectivePlanDigest', 'rubric', 'cases', 'authority'], 'evidence-bound value trial');
  if (input.schema !== EVIDENCE_VALUE_TRIAL_SCHEMA) fail('EVIDENCE_VALUE_TRIAL', 'evidence-bound value trial schema is invalid');
  validId(input.trialId, 'evidence-bound trial id');
  const asOf = dateMs(input.asOf, 'evidence-bound trial asOf');
  validDigest(input.prospectivePlanDigest, 'evidence-bound prospective plan digest');
  validateValueRubric(input.rubric);
  const rubricDigest = digest(input.rubric);
  if (!Array.isArray(input.cases) || !input.cases.length || input.cases.length > 64) fail('EVIDENCE_VALUE_TRIAL', 'evidence-bound cases are outside the bound');
  exactKeys(input.authority, ['hostAuthenticatedEvidenceReceipts', 'automaticPresentation', 'automaticApplication', 'automaticScoring', 'automaticInheritance'], 'evidence-bound trial authority');
  if (typeof input.authority.hostAuthenticatedEvidenceReceipts !== 'boolean' || input.authority.automaticPresentation !== false || input.authority.automaticApplication !== false || input.authority.automaticScoring !== false || input.authority.automaticInheritance !== false) fail('EVIDENCE_VALUE_AUTHORITY', 'evidence-bound scoring cannot widen presentation, application, scoring, or inheritance authority');

  const assessments = [];
  const assignmentDigests = new Set();
  const caseAliases = new Set();
  const reviewDigests = new Set();
  const participationDigests = new Set();
  const evaluatorAliases = new Set();
  const globalBlockers = [];
  if (!input.authority.hostAuthenticatedEvidenceReceipts) globalBlockers.push({ code: 'MISSING_AUTHENTICATED_EVIDENCE_PROVIDER', gapType: 'AUTHORITY', statement: 'The host did not authenticate presentation, outcome, test, and evaluator receipts.' });

  for (const item of input.cases) {
    exactKeys(item, ['assignment', 'presentation', 'outcomes', 'evaluations'], 'evidence-bound trial case');
    const blockers = [];
    let assignment;
    try { assignment = validateReceiptBoundAssignment(item.assignment); }
    catch (error) {
      if (error.code === 'ASSIGNMENT_NOT_RECEIPT_BOUND' || error.code === 'TRIAL_ASSIGNMENT_STATE') blockers.push({ code: error.code, gapType: error.code === 'ASSIGNMENT_NOT_RECEIPT_BOUND' ? 'CONTRACT' : 'EVIDENCE', statement: error.message });
      else throw error;
    }
    if (!assignment) {
      assessments.push({ caseAlias: null, assignmentDigest: item.assignment && item.assignment.assignmentDigest || null, state: 'HOLD_CASE_EVIDENCE', blockers, evaluatorAssessments: [], disagreement: { state: 'NOT_EVALUATED', targetClassifications: [] }, conservativeRatio: null, ratioRange: null, evidenceDigests: [] });
      continue;
    }
    if (assignmentDigests.has(assignment.assignmentDigest) || caseAliases.has(assignment.trialCaseTemplate.caseAlias)) fail('TRIAL_EVIDENCE_REUSE', 'an assignment or held-out case was reused inside the evidence trial');
    assignmentDigests.add(assignment.assignmentDigest);
    caseAliases.add(assignment.trialCaseTemplate.caseAlias);
    if (reviewDigests.has(assignment.reviewBinding.decisionReceiptDigest)) fail('TRIAL_EVIDENCE_REUSE', 'one-case Mike review decision was reused');
    reviewDigests.add(assignment.reviewBinding.decisionReceiptDigest);
    for (const recipient of Object.values(assignment.recipients)) {
      if (participationDigests.has(recipient.participationReceiptDigest)) fail('TRIAL_EVIDENCE_REUSE', 'one-case recipient participation receipt was reused');
      participationDigests.add(recipient.participationReceiptDigest);
    }
    if (assignment.prospectivePlanDigest !== input.prospectivePlanDigest || assignment.trialCaseTemplate.rubricDigest !== rubricDigest) fail('EVIDENCE_TRIAL_BINDING', 'assignment plan or rubric differs from the predeclared evidence trial');

    let presentation = null;
    if (item.presentation === null) blockers.push({ code: 'MISSING_PRESENTATION_ACK', gapType: 'TRANSPORT', statement: 'The learning seat lacks sender and recipient acknowledgement evidence.' });
    else presentation = validatePresentationAck(item.presentation, assignment, asOf);
    exactKeys(item.outcomes, ['baseline', 'learningRoute'], 'evidence-bound trial outcomes');
    let baseline = null;
    let learningRoute = null;
    if (item.outcomes.baseline === null) blockers.push({ code: 'MISSING_BASELINE_OUTCOME', gapType: 'EVIDENCE', statement: 'The baseline task lacks final, outcome, and test receipts.' });
    else baseline = validateArmOutcome(item.outcomes.baseline, assignment, 'BASELINE', asOf, dateMs(assignment.createdAt, 'assignment createdAt'));
    if (item.outcomes.learningRoute === null) blockers.push({ code: 'MISSING_LEARNING_OUTCOME', gapType: 'EVIDENCE', statement: 'The learning-route task lacks final, outcome, and test receipts.' });
    else if (!presentation) blockers.push({ code: 'LEARNING_OUTCOME_WITHOUT_PRESENTATION', gapType: 'TRANSPORT', statement: 'A learning-route outcome cannot precede acknowledged lesson presentation.' });
    else learningRoute = validateArmOutcome(item.outcomes.learningRoute, assignment, 'LEARNING_ROUTE', asOf, dateMs(presentation.acknowledgedAt, 'presentation acknowledgedAt'));

    if (!Array.isArray(item.evaluations) || item.evaluations.length > 16) fail('CASE_EVALUATION', 'case evaluations are outside the bound');
    const evaluatorAssessments = [];
    if (item.evaluations.length < 2) blockers.push({ code: 'MISSING_INDEPENDENT_EVALUATORS', gapType: 'EVIDENCE', statement: 'At least two independent evaluator receipts are required for each paired case.' });
    if (baseline && learningRoute) {
      const seenCaseEvaluators = new Set();
      for (const evaluation of item.evaluations) {
        const checked = validateCaseEvaluation(evaluation, assignment, { baseline, learningRoute }, rubricDigest, asOf);
        if (seenCaseEvaluators.has(checked.receipt.evaluatorAlias)) fail('CASE_EVALUATOR_DUPLICATE', 'one evaluator alias cannot fill two seats in the same case');
        seenCaseEvaluators.add(checked.receipt.evaluatorAlias);
        evaluatorAliases.add(checked.receipt.evaluatorAlias);
        evaluatorAssessments.push({ evaluatorAlias: checked.receipt.evaluatorAlias, evaluationReceiptDigest: checked.receipt.receiptDigest, scores: checked.receipt.scores, baselineNet: checked.baselineNet, learningNet: checked.learningNet, ratio: checked.ratio, targetClassification: checked.ratio >= input.rubric.approachTargetRatio ? 'AT_OR_ABOVE_TARGET' : 'BELOW_TARGET', statement: checked.receipt.statement });
      }
    }
    const classifications = uniqueSorted(evaluatorAssessments.map(item => item.targetClassification));
    const contested = classifications.length > 1;
    const ratios = evaluatorAssessments.map(item => item.ratio);
    const caseState = blockers.length ? 'HOLD_CASE_EVIDENCE' : contested ? 'CONTESTED_EVALUATION' : 'PASS_EVIDENCE_BOUND_CASE';
    assessments.push({
      caseAlias: assignment.trialCaseTemplate.caseAlias,
      assignmentDigest: assignment.assignmentDigest,
      state: caseState,
      blockers,
      evaluatorAssessments,
      disagreement: { state: contested ? 'PRESERVED_INCOMPATIBLE_TARGET_CLASSIFICATION' : evaluatorAssessments.length > 1 && new Set(ratios).size > 1 ? 'PRESERVED_SCORE_VARIATION_SAME_CLASSIFICATION' : 'NONE', targetClassifications: classifications },
      conservativeRatio: ratios.length ? Math.min(...ratios) : null,
      ratioRange: ratios.length ? { minimum: Math.min(...ratios), maximum: Math.max(...ratios) } : null,
      evidenceDigests: [presentation && presentation.receiptDigest, baseline && baseline.receiptDigest, learningRoute && learningRoute.receiptDigest].concat(evaluatorAssessments.map(item => item.evaluationReceiptDigest)).filter(Boolean)
    });
  }

  const caseBlockers = assessments.flatMap(item => item.blockers.map(blocker => Object.assign({ caseAlias: item.caseAlias }, blocker)));
  const contestedCases = assessments.filter(item => item.state === 'CONTESTED_EVALUATION');
  const completeCases = assessments.filter(item => item.state === 'PASS_EVIDENCE_BOUND_CASE');
  const allRatios = completeCases.flatMap(item => item.evaluatorAssessments.map(evaluation => evaluation.ratio));
  const claimable = !globalBlockers.length && !caseBlockers.length && !contestedCases.length && assessments.length >= 3 && completeCases.length === assessments.length && evaluatorAliases.size >= 2;
  const conservativeRatio = allRatios.length ? Math.min(...allRatios) : null;
  let state = 'IN_PROGRESS_NOT_CLAIMABLE';
  let conclusion = 'INSUFFICIENT_HELD_OUT_EVIDENCE';
  if (globalBlockers.length || caseBlockers.length) { state = 'HOLD_EVIDENCE_BOUND_VALUE_TRIAL'; conclusion = 'MISSING_AUTHORITY_OR_EVIDENCE'; }
  else if (contestedCases.length) { state = 'CONTESTED_EVALUATION'; conclusion = 'EVALUATOR_DISAGREEMENT_PRESERVED_NO_VALUE_CLAIM'; }
  else if (claimable && conservativeRatio >= input.rubric.approachTargetRatio) { state = 'BOUNDED_TARGET_MET'; conclusion = 'ALL_BOUND_EVALUATIONS_APPROACH_OR_EXCEED_PREDECLARED_TARGET'; }
  else if (claimable) { state = 'BOUNDED_TARGET_NOT_MET'; conclusion = 'AT_LEAST_ONE_BOUND_EVALUATION_IS_BELOW_PREDECLARED_TARGET'; }
  const receipt = {
    schema: EVIDENCE_VALUE_RECEIPT_SCHEMA,
    receiptDigest: null,
    trialId: input.trialId,
    status: 'EXPERIMENTAL',
    state,
    asOf: input.asOf,
    inputDigest: digest(input),
    prospectivePlanDigest: input.prospectivePlanDigest,
    rubricDigest,
    cases: assessments,
    blockers: globalBlockers.concat(caseBlockers),
    summary: { casesSubmitted: assessments.length, completeHeldOutCases: completeCases.length, contestedCases: contestedCases.length, independentEvaluatorAliases: evaluatorAliases.size, lowestObservedAmplificationRatio: conservativeRatio, highestObservedAmplificationRatio: allRatios.length ? Math.max(...allRatios) : null, approachTargetRatio: input.rubric.approachTargetRatio, claimable, conclusion, literalTwoXBoundedObservation: claimable && conservativeRatio >= 2 },
    authority: { automaticPresentation: false, automaticApplication: false, automaticScoring: false, automaticInheritance: false, automaticMerge: false, modelWeightTraining: false, canon: false },
    claimBoundary: 'This conservative result uses the lowest receipt-bound evaluator ratio and preserves every evaluator statement and score. It applies only to these predeclared held-out cases and does not establish general compute doubling, intelligence, consciousness, or production value.'
  };
  receipt.receiptDigest = digest(without(receipt, 'receiptDigest'));
  return receipt;
}

function scoreValueTrial(value) {
  const input = clone(value);
  assertNoPrivateData(input, 'scored value trial');
  exactKeys(input, ['schema', 'trialId', 'asOf', 'rubric', 'cases'], 'scored value trial');
  if (input.schema !== VALUE_TRIAL_SCHEMA) fail('VALUE_TRIAL', 'value trial schema is invalid');
  validId(input.trialId, 'trial id');
  dateMs(input.asOf, 'trial asOf');
  validateValueRubric(input.rubric);
  if (!Array.isArray(input.cases) || !input.cases.length || input.cases.length > 64) fail('VALUE_TRIAL', 'trial cases are outside the bound');
  const rows = [];
  const evaluators = new Set();
  for (const item of input.cases) {
    exactKeys(item, ['caseAlias', 'heldOut', 'baseline', 'learningRoute'], 'value trial case');
    validId(item.caseAlias, 'case alias');
    function arm(armValue, label) {
      exactKeys(armValue, ['primaryValue', 'secondaryReusableValue', 'overhead', 'evidenceDigest', 'evaluatorAlias'], label);
      for (const key of ['primaryValue', 'secondaryReusableValue', 'overhead']) if (typeof armValue[key] !== 'number' || armValue[key] < 0 || armValue[key] > 100) fail('VALUE_SCORE', label + ' score is outside 0-100');
      validDigest(armValue.evidenceDigest, label + ' evidence digest');
      validId(armValue.evaluatorAlias, label + ' evaluator alias');
      evaluators.add(armValue.evaluatorAlias);
      return armValue.primaryValue + armValue.secondaryReusableValue - armValue.overhead;
    }
    const baselineNet = arm(item.baseline, 'baseline arm');
    const learningNet = arm(item.learningRoute, 'learning route arm');
    if (item.baseline.primaryValue !== item.learningRoute.primaryValue) fail('VALUE_RUBRIC', 'primary outcome score must remain equal across arms to isolate secondary value');
    if (baselineNet <= 0) fail('VALUE_SCORE', 'baseline net value must be greater than zero');
    rows.push({ caseAlias: item.caseAlias, heldOut: item.heldOut === true, baselineNet, learningNet, ratio: Number((learningNet / baselineNet).toFixed(6)), evidenceDigests: [item.baseline.evidenceDigest, item.learningRoute.evidenceDigest] });
  }
  const meanRatio = Number((rows.reduce((sum, item) => sum + item.ratio, 0) / rows.length).toFixed(6));
  const claimable = rows.length >= 3 && rows.every(item => item.heldOut) && evaluators.size >= 2;
  const conclusion = !claimable ? 'TRIAL_NOT_CLAIMABLE' : meanRatio >= input.rubric.approachTargetRatio ? 'SUPPLIED_SCORES_APPROACH_OR_EXCEED_PREDECLARED_TARGET' : 'SUPPLIED_SCORES_BELOW_PREDECLARED_TARGET';
  const receipt = {
    schema: VALUE_RECEIPT_SCHEMA,
    receiptDigest: null,
    trialId: input.trialId,
    status: 'EXPERIMENTAL',
    asOf: input.asOf,
    inputDigest: digest(input),
    rows,
    summary: { cases: rows.length, independentEvaluatorAliases: evaluators.size, meanAmplificationRatio: meanRatio, approachTargetRatio: input.rubric.approachTargetRatio, claimable, realWorldClaimable: false, evidenceAssurance: 'SUPPLIED_SCORES_NOT_RECEIPT_BOUND', conclusion, suppliedScoresReachTwoX: claimable && meanRatio >= 2, literalTwoXProven: false },
    authority: { automaticInheritance: false, automaticMerge: false, modelWeightTraining: false, canon: false },
    claimBoundary: 'This compatibility scorer measures supplied numbers only. Real-world claims require the evidence-bound route; this receipt does not establish compute doubling, broad intelligence gain, or production value.'
  };
  receipt.receiptDigest = digest(without(receipt, 'receiptDigest'));
  return receipt;
}

module.exports = {
  SNAPSHOT_SET_SCHEMA,
  LEDGER_SCHEMA,
  PICKUP_REQUEST_SCHEMA,
  PICKUP_SCHEMA,
  MIRROR_REQUEST_SCHEMA,
  MIRROR_PROPOSAL_SCHEMA,
  VALUE_TRIAL_SCHEMA,
  VALUE_RECEIPT_SCHEMA,
  TRIAL_ASSIGNMENT_REQUEST_SCHEMA,
  TRIAL_ASSIGNMENT_SCHEMA,
  REVIEW_DECISION_SCHEMA,
  FOUNDATION_REVIEW_RECEIPT_SCHEMA,
  REVIEW_INTAKE_REQUEST_SCHEMA,
  REVIEW_DECISION_V2_SCHEMA,
  PARTICIPATION_RECEIPT_SCHEMA,
  TRIAL_ASSIGNMENT_REQUEST_V2_SCHEMA,
  TRIAL_ASSIGNMENT_V2_SCHEMA,
  EVIDENCE_VALUE_TRIAL_SCHEMA,
  EVIDENCE_VALUE_RECEIPT_SCHEMA,
  PRESENTATION_ACK_SCHEMA,
  ARM_OUTCOME_SCHEMA,
  CASE_EVALUATION_SCHEMA,
  CAPABILITY_SCHEMA,
  GRAND_GARDEN_LEDGER_SCHEMA,
  assertNoPrivateData,
  adaptGrandGardenLedger,
  canonical,
  clone,
  compileSnapshotSet,
  createMirrorProposal,
  createPickup,
  createReviewDecision,
  digest,
  prepareTrialAssignment,
  providerCapabilityReceipt,
  scoreEvidenceBoundTrial,
  scoreValueTrial,
  validateLedgerDigest,
  validateParticipationReceipt,
  validateReviewDecision,
  validateSnapshotSet
};
