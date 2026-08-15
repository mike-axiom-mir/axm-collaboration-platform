'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const PackCell = require('../kernel/pure-wasm-behavior-pack-cell');
const Executor = require('./disposable-pure-wasm-code-executor-organ');
const Profile = require('../kernel/pure-wasm-candidate-profile-cell');

const ORGAN_ID = PackCell.VERIFIER_ID;
const REQUEST_SCHEMA = 'axm.mirror.pure-wasm-behavior-verification-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.pure-wasm-behavior-verification-receipt/v1';
const AUTHORITY_KEYS = Object.freeze([
  'candidateGeneration', 'independenceCertification', 'evidenceAdmission', 'trainingAdmission',
  'mirrorSourceWrite', 'workshopSourceWrite', 'permissionGrant', 'installation',
  'promotion', 'canon', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const RECEIPT_STATES = Object.freeze([
  'PASS_SYNTHETIC_BEHAVIOR_MECHANICS_ONLY',
  'PASS_DECLARED_INDEPENDENT_BEHAVIOR_PROPOSAL_ONLY',
  'HOLD_VERIFICATION_PERMISSION',
  'REFUSED_REQUESTED_AUTHORITY',
  'HOLD_CANDIDATE_TRACE',
  'HOLD_EXECUTOR_RESULT',
  'HOLD_BEHAVIOR_MISMATCH'
]);

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} fields changed`);
}

function identity(value, label, maximum = 160) {
  if (typeof value !== 'string' || !value || value.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)) throw new Error(`${label} must be a bounded identity`);
  return value;
}

function text(value, label, maximum = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} must be bounded non-empty text`);
  return value;
}

function int32(value, label) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw new Error(`${label} must be an i32`);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validateRequest(value) {
  const request = KeySafeJson.stable(value, { maxBytes: 256 * 1024, maxDepth: 32, maxNodes: 4096 });
  exactKeys(request, ['candidate', 'limits', 'pack', 'permission', 'requestedAuthority', 'schema', 'specialistId', 'status', 'verificationId'], 'behavior verification request');
  if (request.schema !== REQUEST_SCHEMA || request.status !== 'EXPERIMENTAL' || request.specialistId !== 'future-code-mirror') throw new Error('behavior verification request identity changed');
  identity(request.verificationId, 'verification ID');
  request.pack = PackCell.verifyPack(request.pack);

  exactKeys(request.candidate, ['authorId', 'bytesBase64', 'format', 'sha256'], 'behavior verification candidate');
  if (request.candidate.format !== 'PURE_WASM_I32X2_TO_I32_V1' || !/^[a-f0-9]{64}$/.test(String(request.candidate.sha256 || ''))) throw new Error('behavior verification candidate identity changed');
  identity(request.candidate.authorId, 'candidate author');
  Executor.decodeCanonicalBase64(request.candidate.bytesBase64);

  exactKeys(request.permission, ['basis', 'grantedById', 'grantedByKind', 'identityCertified', 'scope', 'state'], 'behavior verification permission');
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(request.permission.state) || request.permission.scope !== 'ONE_EXACT_BEHAVIOR_PACK_VERIFICATION' || !['HUMAN_DECLARED_LOCAL', 'TEST_HARNESS'].includes(request.permission.grantedByKind) || request.permission.identityCertified !== false) throw new Error('behavior verification permission fields changed');
  identity(request.permission.grantedById, 'permission grantor');
  text(request.permission.basis, 'permission basis');

  exactKeys(request.limits, ['candidateBytes', 'caseCount', 'executorReplaysPerCase', 'stdoutBytes', 'wallTimeMs'], 'behavior verification limits');
  if (request.limits.caseCount !== 3 || request.limits.executorReplaysPerCase !== 2) throw new Error('behavior verification requires exactly three cases and two executor replays per case');
  if (!Number.isInteger(request.limits.candidateBytes) || request.limits.candidateBytes < 256 || request.limits.candidateBytes > Profile.MAX_CANDIDATE_BYTES) throw new Error('behavior verification candidate byte limit changed');
  if (!Number.isInteger(request.limits.stdoutBytes) || request.limits.stdoutBytes < 1024 || request.limits.stdoutBytes > 16 * 1024) throw new Error('behavior verification output limit changed');
  if (!Number.isInteger(request.limits.wallTimeMs) || request.limits.wallTimeMs < 100 || request.limits.wallTimeMs > 2000) throw new Error('behavior verification wall-time limit changed');

  exactKeys(request.requestedAuthority, ['executeBoundCandidateCases', ...AUTHORITY_KEYS], 'behavior verification requested authority');
  if (typeof request.requestedAuthority.executeBoundCandidateCases !== 'boolean' || AUTHORITY_KEYS.some(key => typeof request.requestedAuthority[key] !== 'boolean')) throw new Error('behavior verification authority values must be booleans');
  return request;
}

function authorityIsClosed(request) {
  return request.requestedAuthority.executeBoundCandidateCases === true && AUTHORITY_KEYS.every(key => request.requestedAuthority[key] === false);
}

function candidateTraceMatches(request) {
  const bytes = Executor.decodeCanonicalBase64(request.candidate.bytesBase64);
  return sha256(bytes) === request.candidate.sha256 &&
    request.candidate.sha256 === request.pack.candidateBinding.candidateDigest &&
    request.candidate.authorId === request.pack.candidateBinding.candidateAuthorId &&
    request.candidate.format === request.pack.candidateBinding.candidateFormat;
}

function buildExecutorRequest(request, behaviorCase) {
  const executionIdentity = KeySafeJson.digest({ verificationId: request.verificationId, packId: request.pack.packId, caseId: behaviorCase.caseId });
  return {
    schema: Executor.REQUEST_SCHEMA,
    status: 'EXPERIMENTAL',
    requestId: `behavior-execution/${executionIdentity.slice(0, 24)}`,
    specialistId: 'future-code-mirror',
    candidate: {
      format: request.candidate.format,
      bytesBase64: request.candidate.bytesBase64,
      sha256: request.candidate.sha256
    },
    input: { left: behaviorCase.input.left, right: behaviorCase.input.right },
    permission: {
      state: request.permission.state,
      scope: 'ONE_EXACT_PURE_WASM_CANDIDATE_EXECUTION',
      grantedByKind: request.permission.grantedByKind,
      grantedById: request.permission.grantedById,
      identityCertified: false,
      basis: request.permission.basis
    },
    limits: {
      candidateBytes: request.limits.candidateBytes,
      stdoutBytes: request.limits.stdoutBytes,
      wallTimeMs: request.limits.wallTimeMs,
      replays: request.limits.executorReplaysPerCase
    },
    requestedAuthority: {
      executeExactCandidate: true,
      ...Object.fromEntries(Executor.AUTHORITY_KEYS.map(key => [key, false]))
    }
  };
}

function forbiddenAnswerKeys(value) {
  let count = 0;
  function visit(current) {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) return current.forEach(visit);
    for (const [key, child] of Object.entries(current)) {
      if (/expected|answer|oracle|behaviorPack|packDigest/i.test(key)) count += 1;
      visit(child);
    }
  }
  visit(value);
  return count;
}

function validateExecutorReceipt(value, executorRequest) {
  const receipt = KeySafeJson.stable(value, { maxBytes: 128 * 1024, maxDepth: 32, maxNodes: 4096 });
  exactKeys(receipt, ['authority', 'boundary', 'executions', 'findings', 'isolation', 'limitations', 'organ', 'profile', 'receiptDigest', 'receiptId', 'replay', 'request', 'result', 'schema', 'state', 'status', 'substrate'], 'executor receipt');
  const basis = Object.fromEntries(Object.entries(receipt).filter(([key]) => !['receiptId', 'receiptDigest'].includes(key)));
  if (receipt.schema !== Executor.RECEIPT_SCHEMA || receipt.status !== 'TEST' || receipt.receiptDigest !== KeySafeJson.digest(basis) || receipt.receiptId !== `pure-wasm-execution-${receipt.receiptDigest.slice(0, 24)}`) throw new Error('executor receipt content address changed');
  if (!receipt.organ || receipt.organ.id !== Executor.ORGAN_ID || receipt.organ.learnedWeights !== false) throw new Error('executor receipt organ changed');
  if (receipt.request.requestDigest !== KeySafeJson.digest(Executor.validateRequest(executorRequest)) || receipt.request.candidateDigest !== executorRequest.candidate.sha256 || !KeySafeJson.same(receipt.request.input, executorRequest.input)) throw new Error('executor receipt request binding changed');
  if (receipt.state !== 'PASS_BOUNDED_PURE_WASM_RESULT' || receipt.profile.profileId !== Profile.PROFILE_ID || receipt.profile.profileDigest !== Profile.PROFILE_DIGEST || receipt.profile.ambientImports !== 0) throw new Error('executor receipt did not establish the bounded profile result');
  if (receipt.replay.completed !== 2 || receipt.replay.exactWorkerReceiptsMatch !== true || receipt.replay.exactResultsMatch !== true || receipt.isolation.residueObserved !== false || receipt.isolation.parentWrite !== 'NO_HOST_IMPORT_PATH') throw new Error('executor receipt replay, cleanup, or parent boundary changed');
  int32(receipt.result, 'executor result');
  return receipt;
}

function baseCaseRecord(behaviorCase) {
  return {
    caseId: behaviorCase.caseId,
    sourceGroupId: behaviorCase.sourceGroupId,
    family: behaviorCase.family,
    inputDigest: KeySafeJson.digest(behaviorCase.input),
    expectedDigest: KeySafeJson.digest(behaviorCase.expected),
    expectedResult: behaviorCase.expected.result,
    executorRequestId: null,
    executorRequestDigest: null,
    executorReceiptId: null,
    executorReceiptDigest: null,
    executorState: 'NOT_RUN',
    actualResult: null,
    exactMatch: false,
    answerFieldsInExecutorRequest: 0,
    state: 'NOT_RUN_PREEXECUTION_HOLD'
  };
}

function finding(code, severity, statement, detail = null) {
  return { code, severity, statement, detail };
}

function buildReceipt({ request, state, findings, cases }) {
  if (!RECEIPT_STATES.includes(state)) throw new Error('behavior receipt state escaped its closed set');
  const passedCases = cases.filter(item => item.state === 'PASS_EXACT_BEHAVIOR').length;
  const mismatchedCases = cases.filter(item => item.state === 'FAIL_BEHAVIOR_MISMATCH').length;
  const executorHolds = cases.filter(item => item.state === 'HOLD_EXECUTOR_RESULT').length;
  const authorKind = request.pack.author.authorKind;
  const pass = state.startsWith('PASS_');
  const declaredOutside = authorKind === 'INDEPENDENT_EXAM_AUTHOR_DECLARED';
  const requestDigest = KeySafeJson.digest(request);
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    verification: {
      verificationId: request.verificationId,
      requestDigest,
      packId: request.pack.packId,
      packDigest: request.pack.packDigest,
      behaviorContractId: request.pack.behaviorContract.contractId,
      behaviorContractDigest: request.pack.behaviorContract.contractDigest,
      candidateDigest: request.candidate.sha256,
      candidateAuthorId: request.candidate.authorId,
      packAuthorId: request.pack.author.authorId,
      packAuthorKind: authorKind,
      verifierId: ORGAN_ID,
      executorId: Executor.ORGAN_ID,
      permission: request.permission,
      limits: request.limits
    },
    state,
    findings,
    cases,
    summary: {
      requiredCases: 3,
      casesRun: cases.filter(item => item.executorState !== 'NOT_RUN').length,
      executorReplaysPerRunCase: 2,
      passedCases,
      mismatchedCases,
      executorHolds,
      allCasesPass: passedCases === 3 && mismatchedCases === 0 && executorHolds === 0,
      candidateProcessReplaysObserved: cases.filter(item => item.executorState === 'PASS_BOUNDED_PURE_WASM_RESULT').length * 2
    },
    behaviorEvidence: {
      machineState: pass ? 'PASS' : (mismatchedCases ? 'FAIL' : 'NOT_RUN'),
      claimClass: pass ? (declaredOutside ? 'DECLARED_INDEPENDENT_PROPOSAL_ONLY' : 'SYNTHETIC_SEPARATION_MECHANICS_ONLY') : 'HELD',
      relationToCandidateAuthor: request.pack.author.relationToCandidateAuthor,
      verifierRelationToCandidateAuthor: request.pack.verifierBinding.relationToCandidateAuthor,
      authorshipIdentityCertified: false,
      independenceCryptographicallyProven: false,
      independenceExternallyVerified: false,
      eligibleForCodeStoryBehaviorClaim: pass && declaredOutside,
      evidenceAdmission: false,
      trainingAdmission: false
    },
    separation: {
      candidateAuthorId: request.candidate.authorId,
      packAuthorId: request.pack.author.authorId,
      verifierId: ORGAN_ID,
      executorId: Executor.ORGAN_ID,
      allDeclaredSeatsDistinct: new Set([request.candidate.authorId, request.pack.author.authorId, ORGAN_ID, Executor.ORGAN_ID]).size === 4,
      packFrozenBeforeFirstVerification: request.pack.frozenBeforeFirstVerification,
      expectedAnswerFieldsInExecutorRequests: cases.reduce((sum, item) => sum + item.answerFieldsInExecutorRequest, 0),
      expectedOutputsSentToCandidateProcess: false,
      candidateProcessInputKeys: ['candidateBase64', 'candidateDigest', 'left', 'profileDigest', 'profileId', 'right'],
      directCurrentExecutorInvocation: cases.some(item => item.executorState !== 'NOT_RUN'),
      submittedThirdPartyExecutorReceiptsAccepted: false
    },
    authority: {
      verificationScope: 'ONE_EXACT_PERMISSIONED_THREE_CASE_PURE_WASM_BEHAVIOR_PACK',
      automaticExecution: false,
      generalCandidateExecution: false,
      exactBehaviorVerificationPerformed: cases.some(item => item.executorState !== 'NOT_RUN'),
      ...ZERO_AUTHORITY
    },
    limitations: [
      'TEST_HARNESS packs prove only packing, answer-hiding, execution, comparison, and hold mechanics; they are never real independent behavior evidence.',
      'An INDEPENDENT_EXAM_AUTHOR_DECLARED pack remains a content-bound declaration. Mirror does not certify author identity, chronology, non-collusion, or that the candidate author never saw the expected answers.',
      'Three exact cases establish only those inputs and outputs under the bounded pure-Wasm executor. They do not prove general correctness, regression safety, novelty, usefulness, or learning improvement.',
      'Expected outputs remain in the host verifier and are not included in executor requests or candidate-process inputs; this does not prove the candidate was never trained or authored against equivalent answers elsewhere.',
      'A passing receipt proposes later Code Story evidence assembly only when the pack is declared outside-authored. It does not admit evidence or training, install, promote, change CANON, or act.'
    ],
    boundary: 'Runs one exact permissioned candidate against a frozen three-family behavior pack through the existing zero-import pure-Wasm executor, compares expected outputs only after each execution, and emits proposal-only evidence. It certifies no identity or independence and grants no admission, training, source-write, installation, promotion, CANON, or world authority.'
  };
  const receiptDigest = KeySafeJson.digest(basis);
  return Object.assign({ receiptId: `pure-wasm-behavior-${receiptDigest.slice(0, 24)}`, receiptDigest }, basis);
}

function verify(value, options = {}) {
  const request = validateRequest(value);
  const cases = request.pack.cases.map(baseCaseRecord);
  const base = { request, cases };
  if (request.permission.state !== 'ALLOWED') {
    return buildReceipt(Object.assign(base, { state: 'HOLD_VERIFICATION_PERMISSION', findings: [finding('BEHAVIOR_PACK_EXECUTION_NOT_ALLOWED', 'HOLD', 'The exact pack verification permission is not ALLOWED; no candidate case ran.')] }));
  }
  if (!authorityIsClosed(request)) {
    return buildReceipt(Object.assign(base, { state: 'REFUSED_REQUESTED_AUTHORITY', findings: [finding('BEHAVIOR_VERIFIER_AUTHORITY_GROWTH', 'REFUSE', 'Only the three exact candidate cases may execute; every other requested authority must remain false.')] }));
  }
  if (!candidateTraceMatches(request)) {
    return buildReceipt(Object.assign(base, { state: 'HOLD_CANDIDATE_TRACE', findings: [finding('PACK_CANDIDATE_TRACE_MISMATCH', 'HOLD', 'Candidate bytes, digest, author, format, and frozen pack binding are not one exact trace.')] }));
  }

  const records = [];
  let executorStopped = false;
  for (const behaviorCase of request.pack.cases) {
    if (executorStopped) {
      const skipped = baseCaseRecord(behaviorCase);
      skipped.state = 'NOT_RUN_AFTER_EXECUTOR_HOLD';
      records.push(skipped);
      continue;
    }
    const executorRequest = buildExecutorRequest(request, behaviorCase);
    const answerFields = forbiddenAnswerKeys(executorRequest);
    if (answerFields !== 0) throw new Error('expected-answer field leaked into executor request');
    const record = baseCaseRecord(behaviorCase);
    record.executorRequestId = executorRequest.requestId;
    record.executorRequestDigest = KeySafeJson.digest(Executor.validateRequest(executorRequest));
    record.answerFieldsInExecutorRequest = answerFields;
    const rawReceipt = Executor.execute(executorRequest, { tempRoot: options.tempRoot });
    let executorReceipt;
    try {
      executorReceipt = validateExecutorReceipt(rawReceipt, executorRequest);
    } catch (_error) {
      record.executorReceiptId = rawReceipt && rawReceipt.receiptId || null;
      record.executorReceiptDigest = rawReceipt && rawReceipt.receiptDigest || null;
      record.executorState = rawReceipt && rawReceipt.state || 'INVALID_EXECUTOR_RECEIPT';
      record.state = 'HOLD_EXECUTOR_RESULT';
      records.push(record);
      executorStopped = true;
      continue;
    }
    record.executorReceiptId = executorReceipt.receiptId;
    record.executorReceiptDigest = executorReceipt.receiptDigest;
    record.executorState = executorReceipt.state;
    record.actualResult = executorReceipt.result;
    record.exactMatch = executorReceipt.result === behaviorCase.expected.result;
    record.state = record.exactMatch ? 'PASS_EXACT_BEHAVIOR' : 'FAIL_BEHAVIOR_MISMATCH';
    records.push(record);
  }

  if (records.some(item => item.state === 'HOLD_EXECUTOR_RESULT')) {
    return buildReceipt({ request, cases: records, state: 'HOLD_EXECUTOR_RESULT', findings: [finding('BOUNDED_EXECUTOR_DID_NOT_RETURN_PASS', 'HOLD', 'One case failed the exact executor receipt boundary; later cases were not run.')] });
  }
  const mismatches = records.filter(item => item.state === 'FAIL_BEHAVIOR_MISMATCH');
  if (mismatches.length) {
    return buildReceipt({ request, cases: records, state: 'HOLD_BEHAVIOR_MISMATCH', findings: [finding('EXPECTED_AND_OBSERVED_I32_RESULTS_DIFFER', 'HOLD', `${mismatches.length} of 3 frozen behavior cases mismatched.`, { caseIds: mismatches.map(item => item.caseId) })] });
  }
  const state = request.pack.author.authorKind === 'TEST_HARNESS'
    ? 'PASS_SYNTHETIC_BEHAVIOR_MECHANICS_ONLY'
    : 'PASS_DECLARED_INDEPENDENT_BEHAVIOR_PROPOSAL_ONLY';
  return buildReceipt({
    request,
    cases: records,
    state,
    findings: [finding(
      state === 'PASS_SYNTHETIC_BEHAVIOR_MECHANICS_ONLY' ? 'SYNTHETIC_THREE_CASE_BEHAVIOR_MECHANICS_PASS' : 'DECLARED_OUTSIDE_AUTHORED_THREE_CASE_BEHAVIOR_PASS',
      'INFO',
      state === 'PASS_SYNTHETIC_BEHAVIOR_MECHANICS_ONLY'
        ? 'All three cases matched, but the TEST_HARNESS pack is mechanics evidence only.'
        : 'All three frozen declared-outside-authored cases matched; the result is proposal-only and authorship remains uncertified.'
    )]
  });
}

module.exports = {
  ORGAN_ID,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  RECEIPT_STATES,
  exactKeys,
  validateRequest,
  authorityIsClosed,
  candidateTraceMatches,
  buildExecutorRequest,
  forbiddenAnswerKeys,
  validateExecutorReceipt,
  verify
};
