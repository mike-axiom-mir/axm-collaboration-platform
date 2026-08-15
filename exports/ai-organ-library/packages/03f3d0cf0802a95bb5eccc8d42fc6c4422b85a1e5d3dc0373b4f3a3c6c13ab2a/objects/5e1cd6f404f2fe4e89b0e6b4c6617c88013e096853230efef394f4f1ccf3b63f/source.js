'use strict';

const crypto = require('node:crypto');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const BaselineCell = require('../kernel/pure-wasm-regression-baseline-cell');
const Executor = require('./disposable-pure-wasm-code-executor-organ');
const BehaviorVerifier = require('./pure-wasm-independent-behavior-verifier-organ');
const Profile = require('../kernel/pure-wasm-candidate-profile-cell');

const ORGAN_ID = BaselineCell.REGRESSION_VERIFIER_ID;
const REQUEST_SCHEMA = 'axm.mirror.pure-wasm-regression-verification-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.pure-wasm-regression-verification-receipt/v1';
const AUTHORITY_KEYS = Object.freeze([
  'candidateGeneration', 'baselineAdmissionCertification', 'behaviorCertification',
  'evidenceAdmission', 'trainingAdmission', 'mirrorSourceWrite', 'workshopSourceWrite',
  'permissionGrant', 'installation', 'promotion', 'canon', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const RECEIPT_STATES = Object.freeze([
  'PASS_SYNTHETIC_REGRESSION_MECHANICS_ONLY',
  'PASS_DECLARED_BASELINE_PRESERVATION_PROPOSAL_ONLY',
  'HOLD_REGRESSION_PERMISSION',
  'REFUSED_REQUESTED_AUTHORITY',
  'HOLD_CANDIDATE_TRACE',
  'HOLD_BASELINE_EXECUTOR_RESULT',
  'HOLD_BASELINE_DRIFT',
  'HOLD_CANDIDATE_EXECUTOR_RESULT',
  'HOLD_REGRESSION_MISMATCH'
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

function text(value, label, maximum = 1200) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} must be bounded non-empty text`);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validateRequest(value) {
  const request = KeySafeJson.stable(value, { maxBytes: 512 * 1024, maxDepth: 48, maxNodes: 12288 });
  exactKeys(request, ['baseline', 'candidate', 'limits', 'permission', 'regressionId', 'requestedAuthority', 'schema', 'specialistId', 'status'], 'regression verification request');
  if (request.schema !== REQUEST_SCHEMA || request.status !== 'EXPERIMENTAL' || request.specialistId !== 'future-code-mirror') throw new Error('regression verification request identity changed');
  identity(request.regressionId, 'regression verification ID');
  request.baseline = BaselineCell.verifyBaseline(request.baseline);

  exactKeys(request.candidate, ['authorId', 'bytesBase64', 'changeHypothesis', 'format', 'sha256'], 'regression proposed candidate');
  if (request.candidate.format !== 'PURE_WASM_I32X2_TO_I32_V1' || !/^[a-f0-9]{64}$/.test(String(request.candidate.sha256 || ''))) throw new Error('regression proposed candidate identity changed');
  identity(request.candidate.authorId, 'regression proposed candidate author');
  text(request.candidate.changeHypothesis, 'regression change hypothesis');
  Executor.decodeCanonicalBase64(request.candidate.bytesBase64);

  exactKeys(request.permission, ['basis', 'grantedById', 'grantedByKind', 'identityCertified', 'scope', 'state'], 'regression verification permission');
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(request.permission.state) || request.permission.scope !== 'ONE_EXACT_PURE_WASM_REGRESSION_COMPARISON' || !['HUMAN_DECLARED_LOCAL', 'TEST_HARNESS'].includes(request.permission.grantedByKind) || request.permission.identityCertified !== false) throw new Error('regression verification permission fields changed');
  identity(request.permission.grantedById, 'regression permission grantor');
  text(request.permission.basis, 'regression permission basis');

  exactKeys(request.limits, ['candidateBytesPerSubject', 'caseCountPerSubject', 'executorReplaysPerCase', 'stdoutBytesPerReplay', 'subjects', 'wallTimeMsPerReplay'], 'regression verification limits');
  if (request.limits.subjects !== 2 || request.limits.caseCountPerSubject !== 3 || request.limits.executorReplaysPerCase !== 2) throw new Error('regression verification requires two subjects, three cases each, and two replays per case');
  if (!Number.isInteger(request.limits.candidateBytesPerSubject) || request.limits.candidateBytesPerSubject < 256 || request.limits.candidateBytesPerSubject > Profile.MAX_CANDIDATE_BYTES) throw new Error('regression candidate byte limit changed');
  if (!Number.isInteger(request.limits.stdoutBytesPerReplay) || request.limits.stdoutBytesPerReplay < 1024 || request.limits.stdoutBytesPerReplay > 16 * 1024) throw new Error('regression output limit changed');
  if (!Number.isInteger(request.limits.wallTimeMsPerReplay) || request.limits.wallTimeMsPerReplay < 100 || request.limits.wallTimeMsPerReplay > 2000) throw new Error('regression wall-time limit changed');

  exactKeys(request.requestedAuthority, ['executeBoundBaselineAndCandidateCases', ...AUTHORITY_KEYS], 'regression requested authority');
  if (typeof request.requestedAuthority.executeBoundBaselineAndCandidateCases !== 'boolean' || AUTHORITY_KEYS.some(key => typeof request.requestedAuthority[key] !== 'boolean')) throw new Error('regression authority values must be booleans');
  return request;
}

function authorityIsClosed(request) {
  return request.requestedAuthority.executeBoundBaselineAndCandidateCases === true && AUTHORITY_KEYS.every(key => request.requestedAuthority[key] === false);
}

function candidateTraceMatches(request) {
  const bytes = Executor.decodeCanonicalBase64(request.candidate.bytesBase64);
  if (bytes.length > request.limits.candidateBytesPerSubject) return false;
  if (sha256(bytes) !== request.candidate.sha256) return false;
  const forbiddenSeats = [ORGAN_ID, Executor.ORGAN_ID, request.baseline.curator.curatorId];
  return !forbiddenSeats.includes(request.candidate.authorId);
}

function subjectCandidate(request, subject) {
  return subject === 'BASELINE' ? request.baseline.baselineCandidate : request.candidate;
}

function buildExecutorRequest(request, comparisonCase, subject) {
  if (!['BASELINE', 'PROPOSED_CANDIDATE'].includes(subject)) throw new Error('regression subject changed');
  const candidate = subjectCandidate(request, subject);
  const executionIdentity = KeySafeJson.digest({ regressionId: request.regressionId, baselineId: request.baseline.baselineId, caseId: comparisonCase.caseId, subject });
  return {
    schema: Executor.REQUEST_SCHEMA,
    status: 'EXPERIMENTAL',
    requestId: `regression-execution/${executionIdentity.slice(0, 24)}`,
    specialistId: 'future-code-mirror',
    candidate: {
      format: candidate.format,
      bytesBase64: candidate.bytesBase64,
      sha256: candidate.sha256
    },
    input: { left: comparisonCase.input.left, right: comparisonCase.input.right },
    permission: {
      state: request.permission.state,
      scope: 'ONE_EXACT_PURE_WASM_CANDIDATE_EXECUTION',
      grantedByKind: request.permission.grantedByKind,
      grantedById: request.permission.grantedById,
      identityCertified: false,
      basis: request.permission.basis
    },
    limits: {
      candidateBytes: request.limits.candidateBytesPerSubject,
      stdoutBytes: request.limits.stdoutBytesPerReplay,
      wallTimeMs: request.limits.wallTimeMsPerReplay,
      replays: request.limits.executorReplaysPerCase
    },
    requestedAuthority: {
      executeExactCandidate: true,
      ...Object.fromEntries(Executor.AUTHORITY_KEYS.map(key => [key, false]))
    }
  };
}

function forbiddenRegressionKeys(value) {
  let count = 0;
  function visit(current) {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) return current.forEach(visit);
    for (const [key, child] of Object.entries(current)) {
      if (/expected|answer|oracle|baselineResult|sealedResult|behaviorPack|packDigest/i.test(key)) count += 1;
      visit(child);
    }
  }
  visit(value);
  return count;
}

function baseCaseRecord(comparisonCase, subject) {
  return {
    subject,
    caseId: comparisonCase.caseId,
    sourceGroupId: comparisonCase.sourceGroupId,
    family: comparisonCase.family,
    inputDigest: comparisonCase.inputDigest,
    sealedExpectedDigest: comparisonCase.expectedDigest,
    sealedExpectedResult: comparisonCase.sealedExpectedResult,
    executorRequestId: null,
    executorRequestDigest: null,
    executorReceiptId: null,
    executorReceiptDigest: null,
    executorState: 'NOT_RUN',
    actualResult: null,
    comparisonResult: null,
    exactMatch: false,
    answerFieldsInExecutorRequest: 0,
    state: 'NOT_RUN_PREEXECUTION_HOLD'
  };
}

function executeSubject(request, subject, options = {}) {
  const records = [];
  let stopped = false;
  for (const comparisonCase of request.baseline.comparisonCases) {
    if (stopped) {
      const skipped = baseCaseRecord(comparisonCase, subject);
      skipped.state = 'NOT_RUN_AFTER_EXECUTOR_HOLD';
      records.push(skipped);
      continue;
    }
    const executorRequest = buildExecutorRequest(request, comparisonCase, subject);
    const answerFields = forbiddenRegressionKeys(executorRequest);
    if (answerFields !== 0) throw new Error('regression answer field leaked into executor request');
    const record = baseCaseRecord(comparisonCase, subject);
    record.executorRequestId = executorRequest.requestId;
    record.executorRequestDigest = KeySafeJson.digest(Executor.validateRequest(executorRequest));
    record.answerFieldsInExecutorRequest = answerFields;
    const rawReceipt = Executor.execute(executorRequest, { tempRoot: options.tempRoot });
    let executorReceipt;
    try {
      executorReceipt = BehaviorVerifier.validateExecutorReceipt(rawReceipt, executorRequest);
    } catch (_error) {
      record.executorReceiptId = rawReceipt && rawReceipt.receiptId || null;
      record.executorReceiptDigest = rawReceipt && rawReceipt.receiptDigest || null;
      record.executorState = rawReceipt && rawReceipt.state || 'INVALID_EXECUTOR_RECEIPT';
      record.state = subject === 'BASELINE' ? 'HOLD_BASELINE_EXECUTOR_RESULT' : 'HOLD_CANDIDATE_EXECUTOR_RESULT';
      records.push(record);
      stopped = true;
      continue;
    }
    record.executorReceiptId = executorReceipt.receiptId;
    record.executorReceiptDigest = executorReceipt.receiptDigest;
    record.executorState = executorReceipt.state;
    record.actualResult = executorReceipt.result;
    record.comparisonResult = subject === 'BASELINE' ? comparisonCase.sealedExpectedResult : null;
    record.exactMatch = subject === 'BASELINE' && executorReceipt.result === comparisonCase.sealedExpectedResult;
    record.state = subject === 'BASELINE'
      ? (record.exactMatch ? 'PASS_BASELINE_REPRODUCED' : 'FAIL_BASELINE_DRIFT')
      : 'AWAITING_BASELINE_COMPARISON';
    records.push(record);
  }
  return records;
}

function candidateNotRunRecords(request, state) {
  return request.baseline.comparisonCases.map(item => Object.assign(baseCaseRecord(item, 'PROPOSED_CANDIDATE'), { state }));
}

function compareCandidateWithBaseline(baselineRecords, candidateRecords) {
  return candidateRecords.map(record => {
    if (record.state !== 'AWAITING_BASELINE_COMPARISON') return record;
    const baseline = baselineRecords.find(item => item.caseId === record.caseId);
    record.comparisonResult = baseline.actualResult;
    record.exactMatch = record.actualResult === baseline.actualResult;
    record.state = record.exactMatch ? 'PASS_BASELINE_PRESERVED' : 'FAIL_REGRESSION_MISMATCH';
    return record;
  });
}

function finding(code, severity, statement, detail = null) {
  return { code, severity, statement, detail };
}

function buildReceipt({ request, state, findings, baselineCases, candidateCases }) {
  if (!RECEIPT_STATES.includes(state)) throw new Error('regression receipt state escaped its closed set');
  const baselinePasses = baselineCases.filter(item => item.state === 'PASS_BASELINE_REPRODUCED').length;
  const baselineDrifts = baselineCases.filter(item => item.state === 'FAIL_BASELINE_DRIFT').length;
  const candidatePasses = candidateCases.filter(item => item.state === 'PASS_BASELINE_PRESERVED').length;
  const regressions = candidateCases.filter(item => item.state === 'FAIL_REGRESSION_MISMATCH').length;
  const executorHolds = [...baselineCases, ...candidateCases].filter(item => /HOLD_.*EXECUTOR_RESULT/.test(item.state)).length;
  const pass = state.startsWith('PASS_');
  const declaredBaseline = request.baseline.baselineClass === 'DECLARED_CODE_STORY_BASELINE';
  const requestDigest = KeySafeJson.digest(request);
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    verification: {
      regressionId: request.regressionId,
      requestDigest,
      baselineId: request.baseline.baselineId,
      baselineDigest: request.baseline.baselineDigest,
      baselineClass: request.baseline.baselineClass,
      baselineCandidateDigest: request.baseline.baselineCandidate.sha256,
      baselineCandidateAuthorId: request.baseline.baselineCandidate.authorId,
      proposedCandidateDigest: request.candidate.sha256,
      proposedCandidateAuthorId: request.candidate.authorId,
      historicalBehaviorReceiptId: request.baseline.historicalBehaviorReceipt.receiptId,
      historicalBehaviorReceiptDigest: request.baseline.historicalBehaviorReceipt.receiptDigest,
      behaviorPackId: request.baseline.behaviorPack.packId,
      behaviorPackDigest: request.baseline.behaviorPack.packDigest,
      verifierId: ORGAN_ID,
      executorId: Executor.ORGAN_ID,
      permission: request.permission,
      limits: request.limits,
      changeHypothesis: request.candidate.changeHypothesis,
      humanRenderingNonAuthoritative: true
    },
    state,
    findings,
    baselineCases,
    candidateCases,
    summary: {
      requiredCasesPerSubject: 3,
      baselineCasesRun: baselineCases.filter(item => item.executorState !== 'NOT_RUN').length,
      candidateCasesRun: candidateCases.filter(item => item.executorState !== 'NOT_RUN').length,
      executorReplaysPerRunCase: 2,
      baselinePasses,
      baselineDrifts,
      candidatePasses,
      regressions,
      executorHolds,
      baselineReproduced: baselinePasses === 3 && baselineDrifts === 0,
      allBaselineCasesPreserved: candidatePasses === 3 && regressions === 0,
      freshCandidateProcessReplaysObserved: [...baselineCases, ...candidateCases].filter(item => item.executorState === 'PASS_BOUNDED_PURE_WASM_RESULT').length * 2
    },
    regressionEvidence: {
      machineState: pass ? 'PASS' : (regressions || baselineDrifts ? 'FAIL' : 'NOT_RUN'),
      claimClass: pass ? (declaredBaseline ? 'DECLARED_BASELINE_PRESERVATION_PROPOSAL_ONLY' : 'SYNTHETIC_REGRESSION_MECHANICS_ONLY') : 'HELD',
      baselineAdmissionCertified: false,
      externalBaselineChronologyCertified: false,
      historicalBehaviorAuthorshipCertified: false,
      exactThreeCaseBaselinePreserved: pass,
      eligibleForCodeStoryRegressionClaim: false,
      evidenceAdmission: false,
      trainingAdmission: false
    },
    comparison: {
      baselineCandidateDigest: request.baseline.baselineCandidate.sha256,
      proposedCandidateDigest: request.candidate.sha256,
      candidateBytesDifferFromBaseline: request.baseline.baselineCandidate.sha256 !== request.candidate.sha256,
      candidateAuthorMatchesBaselineAuthor: request.baseline.baselineCandidate.authorId === request.candidate.authorId,
      baselineReplayedBeforeCandidate: candidateCases.some(item => item.executorState !== 'NOT_RUN') ? baselinePasses === 3 : true,
      candidateComparedWithCurrentBaselineResults: candidateCases.some(item => ['PASS_BASELINE_PRESERVED', 'FAIL_REGRESSION_MISMATCH'].includes(item.state)),
      baselineHistoricalReceiptReexecutedNotTrustedAlone: true,
      submittedThirdPartyExecutorReceiptsAccepted: false
    },
    separation: {
      baselineAuthorId: request.baseline.baselineCandidate.authorId,
      proposedCandidateAuthorId: request.candidate.authorId,
      baselineCuratorId: request.baseline.curator.curatorId,
      regressionVerifierId: ORGAN_ID,
      executorId: Executor.ORGAN_ID,
      expectedAnswerFieldsInExecutorRequests: [...baselineCases, ...candidateCases].reduce((sum, item) => sum + item.answerFieldsInExecutorRequest, 0),
      expectedOutputsSentToEitherCandidateProcess: false,
      candidateProcessInputKeys: ['candidateBase64', 'candidateDigest', 'left', 'profileDigest', 'profileId', 'right'],
      directCurrentExecutorInvocation: [...baselineCases, ...candidateCases].some(item => item.executorState !== 'NOT_RUN')
    },
    authority: {
      verificationScope: 'ONE_EXACT_PERMISSIONED_PURE_WASM_BASELINE_AND_CANDIDATE_COMPARISON',
      automaticExecution: false,
      generalCandidateExecution: false,
      exactRegressionVerificationPerformed: [...baselineCases, ...candidateCases].some(item => item.executorState !== 'NOT_RUN'),
      ...ZERO_AUTHORITY
    },
    limitations: [
      'The current baseline is a synthetic or declared-but-unadmitted baseline. This receipt certifies no prior Code Story admission, external chronology, author identity, or independent historical genuineness.',
      'Three exact inputs establish only that the proposed candidate preserved those exact current baseline outputs under the bounded pure-Wasm executor. They do not prove broad regression safety.',
      'Different candidate bytes with equal outputs do not prove improvement, novelty, usefulness, maintainability, performance, or story quality.',
      'Expected outputs remain in the host comparator and are never included in executor requests or candidate-process inputs; this does not prove an author never saw equivalent tests elsewhere.',
      'A passing receipt is proposal-only. It does not admit evidence or training, install code, modify parent Mirror, promote a runtime, change CANON, or act.'
    ],
    boundary: 'Replays one exact sealed baseline and one exact proposed candidate under the same zero-import pure-Wasm profile, compares results only after execution, preserves drift and mismatch evidence, and emits proposal-only regression mechanics. It certifies no historical admission, improvement, broad correctness, permission, installation, promotion, CANON, or world authority.'
  };
  const receiptDigest = KeySafeJson.digest(basis);
  return Object.assign({ receiptId: `pure-wasm-regression-${receiptDigest.slice(0, 24)}`, receiptDigest }, basis);
}

function verify(value, options = {}) {
  const request = validateRequest(value);
  const emptyBaseline = request.baseline.comparisonCases.map(item => baseCaseRecord(item, 'BASELINE'));
  const emptyCandidate = candidateNotRunRecords(request, 'NOT_RUN_PREEXECUTION_HOLD');
  if (request.permission.state !== 'ALLOWED') {
    return buildReceipt({ request, state: 'HOLD_REGRESSION_PERMISSION', findings: [finding('REGRESSION_EXECUTION_NOT_ALLOWED', 'HOLD', 'The exact regression comparison permission is not ALLOWED; neither subject ran.')], baselineCases: emptyBaseline, candidateCases: emptyCandidate });
  }
  if (!authorityIsClosed(request)) {
    return buildReceipt({ request, state: 'REFUSED_REQUESTED_AUTHORITY', findings: [finding('REGRESSION_VERIFIER_AUTHORITY_GROWTH', 'REFUSE', 'Only the exact baseline and candidate cases may execute; every other requested authority must remain false.')], baselineCases: emptyBaseline, candidateCases: emptyCandidate });
  }
  if (!candidateTraceMatches(request)) {
    return buildReceipt({ request, state: 'HOLD_CANDIDATE_TRACE', findings: [finding('REGRESSION_CANDIDATE_TRACE_MISMATCH', 'HOLD', 'Proposed candidate bytes, digest, author, format, limits, and verifier separation are not one exact trace.')], baselineCases: emptyBaseline, candidateCases: emptyCandidate });
  }

  const baselineCases = executeSubject(request, 'BASELINE', options);
  if (baselineCases.some(item => item.state === 'HOLD_BASELINE_EXECUTOR_RESULT')) {
    return buildReceipt({ request, state: 'HOLD_BASELINE_EXECUTOR_RESULT', findings: [finding('BASELINE_EXECUTOR_DID_NOT_RETURN_PASS', 'HOLD', 'The sealed baseline did not complete its exact executor boundary; the proposed candidate was not run.')], baselineCases, candidateCases: candidateNotRunRecords(request, 'NOT_RUN_BASELINE_UNAVAILABLE') });
  }
  const drifts = baselineCases.filter(item => item.state === 'FAIL_BASELINE_DRIFT');
  if (drifts.length) {
    return buildReceipt({ request, state: 'HOLD_BASELINE_DRIFT', findings: [finding('CURRENT_BASELINE_DIFFERS_FROM_FROZEN_BEHAVIOR', 'HOLD', `${drifts.length} of 3 current baseline results differ from the frozen behavior receipt; the proposed candidate was not run.`, { caseIds: drifts.map(item => item.caseId) })], baselineCases, candidateCases: candidateNotRunRecords(request, 'NOT_RUN_AFTER_BASELINE_DRIFT') });
  }

  let candidateCases = executeSubject(request, 'PROPOSED_CANDIDATE', options);
  if (candidateCases.some(item => item.state === 'HOLD_CANDIDATE_EXECUTOR_RESULT')) {
    return buildReceipt({ request, state: 'HOLD_CANDIDATE_EXECUTOR_RESULT', findings: [finding('PROPOSED_CANDIDATE_EXECUTOR_DID_NOT_RETURN_PASS', 'HOLD', 'The proposed candidate did not complete its exact executor boundary; later candidate cases were not run.')], baselineCases, candidateCases });
  }
  candidateCases = compareCandidateWithBaseline(baselineCases, candidateCases);
  const regressions = candidateCases.filter(item => item.state === 'FAIL_REGRESSION_MISMATCH');
  if (regressions.length) {
    return buildReceipt({ request, state: 'HOLD_REGRESSION_MISMATCH', findings: [finding('PROPOSED_CANDIDATE_CHANGED_BASELINE_RESULT', 'HOLD', `${regressions.length} of 3 proposed-candidate results differ from the matching current baseline results.`, { caseIds: regressions.map(item => item.caseId) })], baselineCases, candidateCases });
  }
  const state = request.baseline.baselineClass === 'SYNTHETIC_TEST_HARNESS'
    ? 'PASS_SYNTHETIC_REGRESSION_MECHANICS_ONLY'
    : 'PASS_DECLARED_BASELINE_PRESERVATION_PROPOSAL_ONLY';
  return buildReceipt({
    request,
    state,
    findings: [finding(
      state === 'PASS_SYNTHETIC_REGRESSION_MECHANICS_ONLY' ? 'SYNTHETIC_BASELINE_AND_CANDIDATE_CASES_MATCH' : 'DECLARED_BASELINE_AND_CANDIDATE_CASES_MATCH',
      'INFO',
      state === 'PASS_SYNTHETIC_REGRESSION_MECHANICS_ONLY'
        ? 'The baseline reproduced and all three proposed-candidate outputs matched it, but the baseline is TEST_HARNESS mechanics evidence only.'
        : 'The declared baseline reproduced and all three proposed-candidate outputs matched it; prior admission and chronology remain uncertified and the result is proposal-only.'
    )],
    baselineCases,
    candidateCases
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
  forbiddenRegressionKeys,
  baseCaseRecord,
  executeSubject,
  compareCandidateWithBaseline,
  buildReceipt,
  verify
};
