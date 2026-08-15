'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const Profile = require('../kernel/pure-wasm-candidate-profile-cell');

const ORGAN_ID = 'axm.mirror.organ/disposable-pure-wasm-code-executor-v1';
const REQUEST_SCHEMA = 'axm.mirror.disposable-pure-wasm-code-execution-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.disposable-pure-wasm-code-execution-receipt/v1';
const WORKER_RESULT_SCHEMA = 'axm.mirror.pure-wasm-code-candidate-worker-result/v1';
const WORKER_PATH = path.resolve(__dirname, '..', 'kernel', 'pure-wasm-code-candidate-runner.js');
const PROFILE_PATH = path.resolve(__dirname, '..', 'kernel', 'pure-wasm-candidate-profile-cell.js');
const AUTHORITY_KEYS = Object.freeze([
  'candidateGeneration', 'behaviorCertification', 'evidenceAdmission', 'trainingAdmission',
  'mirrorSourceWrite', 'workshopSourceWrite', 'permissionGrant', 'installation',
  'promotion', 'canon', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const RECEIPT_STATES = Object.freeze([
  'PASS_BOUNDED_PURE_WASM_RESULT',
  'HOLD_EXECUTION_PERMISSION',
  'REFUSED_REQUESTED_AUTHORITY',
  'HOLD_CANDIDATE_DIGEST',
  'HOLD_CANDIDATE_SIZE',
  'HOLD_STATIC_PROFILE',
  'HOLD_ENGINE_VALIDATION',
  'HOLD_RUNNER_TIMEOUT',
  'HOLD_RUNNER_OUTPUT_BOUND',
  'HOLD_RUNNER_FAILURE',
  'HOLD_WRAPPER_BOUNDARY',
  'HOLD_REPLAY_MISMATCH',
  'HOLD_DISPOSAL_INCOMPLETE'
]);

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} fields changed`);
}

function identity(value, label, maximum = 160) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)) throw new Error(`${label} must be a bounded identity`);
  return value;
}

function nonEmptyText(value, label, maximum = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} must be bounded non-empty text`);
  return value;
}

function sha256(value) {
  return KeySafeJson.sha256Bytes(value);
}

function int32(value, label) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw new Error(`${label} must be an i32`);
  return value;
}

function boundedInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  return value;
}

function decodeCanonicalBase64(value) {
  if (typeof value !== 'string' || !value.length || value.length > 90 * 1024) throw new Error('candidate bytesBase64 must be a bounded non-empty string');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('candidate bytesBase64 must use canonical base64');
  return bytes;
}

function validateRequest(value) {
  const request = KeySafeJson.stable(value, { maxBytes: 128 * 1024, maxDepth: 12, maxNodes: 256 });
  exactKeys(request, ['candidate', 'input', 'limits', 'permission', 'requestId', 'requestedAuthority', 'schema', 'specialistId', 'status'], 'execution request');
  if (request.schema !== REQUEST_SCHEMA || request.status !== 'EXPERIMENTAL' || request.specialistId !== 'future-code-mirror') throw new Error('execution request identity changed');
  identity(request.requestId, 'requestId');

  exactKeys(request.candidate, ['bytesBase64', 'format', 'sha256'], 'candidate');
  if (request.candidate.format !== 'PURE_WASM_I32X2_TO_I32_V1' || !/^[a-f0-9]{64}$/.test(String(request.candidate.sha256 || ''))) throw new Error('candidate identity changed');
  decodeCanonicalBase64(request.candidate.bytesBase64);

  exactKeys(request.input, ['left', 'right'], 'candidate input');
  int32(request.input.left, 'candidate input left');
  int32(request.input.right, 'candidate input right');

  exactKeys(request.permission, ['basis', 'grantedById', 'grantedByKind', 'identityCertified', 'scope', 'state'], 'execution permission');
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(request.permission.state) || request.permission.scope !== 'ONE_EXACT_PURE_WASM_CANDIDATE_EXECUTION' || !['HUMAN_DECLARED_LOCAL', 'TEST_HARNESS'].includes(request.permission.grantedByKind) || request.permission.identityCertified !== false) throw new Error('execution permission fields changed');
  identity(request.permission.grantedById, 'permission grantedById');
  nonEmptyText(request.permission.basis, 'permission basis');

  exactKeys(request.limits, ['candidateBytes', 'replays', 'stdoutBytes', 'wallTimeMs'], 'execution limits');
  boundedInteger(request.limits.candidateBytes, 256, Profile.MAX_CANDIDATE_BYTES, 'candidate byte limit');
  boundedInteger(request.limits.stdoutBytes, 1024, 16 * 1024, 'stdout byte limit');
  boundedInteger(request.limits.wallTimeMs, 100, 2000, 'wall-time limit');
  if (request.limits.replays !== 2) throw new Error('execution requires exactly two disposable replays');

  exactKeys(request.requestedAuthority, ['executeExactCandidate', ...AUTHORITY_KEYS], 'requested authority');
  if (typeof request.requestedAuthority.executeExactCandidate !== 'boolean' || AUTHORITY_KEYS.some(key => typeof request.requestedAuthority[key] !== 'boolean')) throw new Error('requested authority values must be booleans');
  return request;
}

function requestAuthorityIsClosed(request) {
  return request.requestedAuthority.executeExactCandidate === true && AUTHORITY_KEYS.every(key => request.requestedAuthority[key] === false);
}

function finding(code, severity, statement, detail = null) {
  return { code, severity, statement, detail };
}

function workerInput(request) {
  return {
    candidateBase64: request.candidate.bytesBase64,
    candidateDigest: request.candidate.sha256,
    left: request.input.left,
    profileDigest: Profile.PROFILE_DIGEST,
    profileId: Profile.PROFILE_ID,
    right: request.input.right
  };
}

function verifyWorkerResult(value, request) {
  const result = KeySafeJson.stable(value, { maxBytes: 16 * 1024, maxDepth: 10, maxNodes: 128 });
  exactKeys(result, ['candidateDigest', 'checks', 'input', 'profileDigest', 'profileId', 'result', 'schema'], 'worker result');
  if (result.schema !== WORKER_RESULT_SCHEMA || result.candidateDigest !== request.candidate.sha256 || result.profileId !== Profile.PROFILE_ID || result.profileDigest !== Profile.PROFILE_DIGEST) throw new Error('worker result binding changed');
  exactKeys(result.input, ['left', 'right'], 'worker result input');
  if (result.input.left !== request.input.left || result.input.right !== request.input.right) throw new Error('worker result input changed');
  int32(result.result, 'worker result');
  exactKeys(result.checks, ['ambientImports', 'engineValidation', 'environmentKeyCount', 'environmentKeyNames', 'exports', 'networkPermissionScopeAvailable', 'permissionModelActive', 'permissionScopes', 'staticProfile'], 'worker checks');
  exactKeys(result.checks.permissionScopes, ['addons', 'child', 'fs.read', 'fs.write', 'inspector', 'wasi', 'worker'], 'worker permission scopes');
  const scopesClosed = Object.values(result.checks.permissionScopes).every(value => value === false);
  const allowedWindowsBaseKeys = new Set(['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'PATH', 'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'USERDOMAIN', 'USERNAME', 'USERPROFILE', 'WINDIR']);
  const expectedEnvironmentKeys = process.platform === 'win32'
    ? Array.isArray(result.checks.environmentKeyNames) && result.checks.environmentKeyNames.every(key => allowedWindowsBaseKeys.has(key))
    : Array.isArray(result.checks.environmentKeyNames) && result.checks.environmentKeyNames.length === 0;
  if (result.checks.staticProfile !== 'PASS' || result.checks.engineValidation !== 'PASS' || result.checks.ambientImports !== 0 || !Array.isArray(result.checks.exports) || result.checks.exports.length !== 1 || result.checks.exports[0] !== 'run:function' || result.checks.environmentKeyCount !== result.checks.environmentKeyNames.length || !expectedEnvironmentKeys || result.checks.permissionModelActive !== true || !scopesClosed || typeof result.checks.networkPermissionScopeAvailable !== 'boolean') throw new Error('worker wrapper boundary did not close');
  return result;
}

function prepareTempRoot(selectedRoot) {
  const root = path.resolve(selectedRoot || os.tmpdir());
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('disposable root must be an ordinary directory');
  return fs.realpathSync(root);
}

function removeExactRunDirectory(runDirectory, tempRoot) {
  const resolved = path.resolve(runDirectory);
  if (path.dirname(resolved) !== tempRoot || !path.basename(resolved).startsWith('axm-code-wasm-')) throw new Error('disposable run path escaped its exact root');
  fs.rmSync(resolved, { recursive: true, force: true });
  return !fs.existsSync(resolved);
}

function executeReplay(request, replayIndex, tempRoot) {
  const runDirectory = fs.mkdtempSync(path.join(tempRoot, 'axm-code-wasm-'));
  let removed = false;
  try {
    const encoded = JSON.stringify(workerInput(request));
    const execution = childProcess.spawnSync(process.execPath, [
      '--permission',
      `--allow-fs-read=${WORKER_PATH}`,
      `--allow-fs-read=${PROFILE_PATH}`,
      '--max-old-space-size=32',
      '--stack_size=256',
      WORKER_PATH
    ], {
      cwd: runDirectory,
      encoding: 'utf8',
      env: {},
      input: encoded,
      killSignal: 'SIGKILL',
      maxBuffer: request.limits.stdoutBytes,
      shell: false,
      timeout: request.limits.wallTimeMs,
      windowsHide: true
    });
    const stdout = execution.stdout || '';
    const stderr = execution.stderr || '';
    const base = {
      replayIndex,
      processStatus: execution.status,
      signal: execution.signal || null,
      stdoutBytes: Buffer.byteLength(stdout),
      stdoutDigest: sha256(stdout),
      stderrBytes: Buffer.byteLength(stderr),
      stderrDigest: sha256(stderr),
      workerResultDigest: null,
      result: null,
      checks: null,
      failureCode: null
    };
    if (execution.error) {
      const code = execution.error.code || 'RUNNER_ERROR';
      if (code === 'ETIMEDOUT') return Object.assign(base, { state: 'TIMEOUT', failureCode: code });
      if (code === 'ENOBUFS') return Object.assign(base, { state: 'OUTPUT_BOUND', failureCode: code });
      return Object.assign(base, { state: 'RUNNER_ERROR', failureCode: code });
    }
    if (execution.status !== 0) return Object.assign(base, { state: 'RUNNER_ERROR', failureCode: `EXIT_${execution.status}` });
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (_error) {
      return Object.assign(base, { state: 'RUNNER_ERROR', failureCode: 'WORKER_OUTPUT_NOT_JSON' });
    }
    let verified;
    try {
      verified = verifyWorkerResult(parsed, request);
    } catch (_error) {
      return Object.assign(base, { state: 'WRAPPER_BOUNDARY_FAILED', failureCode: 'WORKER_RESULT_BOUNDARY' });
    }
    return Object.assign(base, {
      state: 'PASS',
      workerResultDigest: KeySafeJson.digest(verified),
      result: verified.result,
      checks: verified.checks
    });
  } finally {
    removed = removeExactRunDirectory(runDirectory, tempRoot);
    if (!removed) throw new Error('disposable run directory remained after execution');
  }
}

function buildReceipt({ request, state, findings, profile, executions, disposable, result }) {
  if (!RECEIPT_STATES.includes(state)) throw new Error('execution receipt state escaped its closed set');
  const requestDigest = KeySafeJson.digest(request);
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    request: {
      requestId: request.requestId,
      requestDigest,
      specialistId: request.specialistId,
      candidateDigest: request.candidate.sha256,
      candidateBytes: Buffer.from(request.candidate.bytesBase64, 'base64').length,
      input: request.input,
      permission: request.permission,
      limits: request.limits
    },
    state,
    findings,
    profile,
    substrate: {
      id: 'node-webassembly-core-zero-import-child-v1',
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      platform: process.platform,
      architecture: process.arch,
      workerPath: 'kernel/pure-wasm-code-candidate-runner.js',
      workerSha256: sha256(fs.readFileSync(WORKER_PATH)),
      profileCellPath: 'kernel/pure-wasm-candidate-profile-cell.js',
      profileCellSha256: sha256(fs.readFileSync(PROFILE_PATH)),
      isolationClaim: 'BOUNDED_CORE_WASM_ZERO_IMPORT_PROFILE_ONLY',
      nodePermissionModelRole: 'DEFENSE_IN_DEPTH_ONLY_NOT_A_MALICIOUS_CODE_SECURITY_BOUNDARY'
    },
    executions,
    replay: {
      required: request.limits.replays,
      completed: executions.filter(item => item.state === 'PASS').length,
      exactWorkerReceiptsMatch: executions.length === request.limits.replays && executions.every(item => item.state === 'PASS') && new Set(executions.map(item => item.workerResultDigest)).size === 1,
      exactResultsMatch: executions.length === request.limits.replays && executions.every(item => item.state === 'PASS') && new Set(executions.map(item => item.result)).size === 1
    },
    result,
    isolation: {
      candidateLanguage: 'WASM_CORE_BINARY_PROFILED',
      ambientImports: profile ? profile.ambientImports : null,
      filesystem: profile ? 'NO_HOST_IMPORT_PATH' : 'NOT_ESTABLISHED',
      environment: profile ? 'NO_HOST_IMPORT_PATH' : 'NOT_ESTABLISHED',
      process: profile ? 'NO_HOST_IMPORT_PATH' : 'NOT_ESTABLISHED',
      network: profile ? 'NO_HOST_IMPORT_PATH' : 'NOT_ESTABLISHED',
      parentWrite: profile ? 'NO_HOST_IMPORT_PATH' : 'NOT_ESTABLISHED',
      wrapperEnvironment: executions.length ? 'REDUCED_OS_BASE_KEYS_NOT_IMPORTED_TO_CANDIDATE' : 'NOT_STARTED',
      wrapperPermissionModel: executions.length ? 'ENABLED_DEFENSE_IN_DEPTH_ONLY' : 'NOT_STARTED',
      disposableRunsCreated: disposable.created,
      disposableRunsRemoved: disposable.removed,
      residueObserved: disposable.residueObserved
    },
    authority: {
      executionScope: 'ONE_EXACT_PERMISSIONED_PURE_WASM_REQUEST',
      automaticExecution: false,
      executeOtherCandidate: false,
      ...ZERO_AUTHORITY
    },
    limitations: [
      'This is a narrow pure Wasm integer-function lane, not general JavaScript, TypeScript, package, UI, file, tool, network, WASI, or operating-system code execution.',
      'The Node permission model is defense in depth only. Node documents that malicious code may bypass it; isolation here depends on the separately checked zero-import core Wasm profile.',
      'A timeout bounds observed wall time and kills the child, but it is not a hard kernel CPU or memory quota and it does not eliminate engine vulnerabilities or hardware side channels.',
      'Two matching replays establish only this exact candidate, input, wrapper, engine, and machine observation. They do not certify broad determinism, correctness, usefulness, novelty, regression safety, or independent behavior verification.',
      'The permission record is caller-declared and content-bound; this organ does not certify the human identity behind it.',
      'A passing receipt does not admit evidence or training, generate code, install anything, modify parent Mirror or Workshop, promote a runtime, change CANON, or act in the world.'
    ],
    boundary: 'Executes only one explicitly permissioned, content-addressed, memory-free, table-free, start-free, zero-import core Wasm candidate with signature (i32,i32)->i32 in two cleared-environment disposable child processes. All broader code execution remains held.'
  };
  const receiptDigest = KeySafeJson.digest(basis);
  return Object.assign({ receiptId: `pure-wasm-execution-${receiptDigest.slice(0, 24)}`, receiptDigest }, basis);
}

function execute(value, options = {}) {
  const request = validateRequest(value);
  const bytes = decodeCanonicalBase64(request.candidate.bytesBase64);
  const disposable = { created: 0, removed: 0, residueObserved: false };
  const base = { request, profile: null, executions: [], disposable, result: null };

  if (request.permission.state !== 'ALLOWED') {
    return buildReceipt(Object.assign(base, { state: 'HOLD_EXECUTION_PERMISSION', findings: [finding('EXACT_EXECUTION_PERMISSION_NOT_ALLOWED', 'HOLD', 'Candidate bytes were inspected as data only; execution permission is not ALLOWED.')] }));
  }
  if (!requestAuthorityIsClosed(request)) {
    return buildReceipt(Object.assign(base, { state: 'REFUSED_REQUESTED_AUTHORITY', findings: [finding('REQUESTED_AUTHORITY_OUTSIDE_EXECUTOR', 'REFUSE', 'The executor accepts only one exact execution request and no generation, write, admission, install, promotion, CANON, or world authority.')] }));
  }
  if (sha256(bytes) !== request.candidate.sha256) {
    return buildReceipt(Object.assign(base, { state: 'HOLD_CANDIDATE_DIGEST', findings: [finding('CANDIDATE_CONTENT_ADDRESS_MISMATCH', 'HOLD', 'Candidate bytes do not match their declared SHA-256 digest.')] }));
  }
  if (bytes.length > request.limits.candidateBytes || bytes.length > Profile.MAX_CANDIDATE_BYTES) {
    return buildReceipt(Object.assign(base, { state: 'HOLD_CANDIDATE_SIZE', findings: [finding('CANDIDATE_BYTE_LIMIT_EXCEEDED', 'HOLD', 'Candidate bytes exceed the request or profile ceiling.', { candidateBytes: bytes.length, requestLimit: request.limits.candidateBytes, profileLimit: Profile.MAX_CANDIDATE_BYTES })] }));
  }

  let profile;
  try {
    profile = Profile.inspect(bytes);
  } catch (error) {
    if (!(error instanceof Profile.ProfileError)) throw error;
    return buildReceipt(Object.assign(base, { state: 'HOLD_STATIC_PROFILE', findings: [finding(error.code, 'HOLD', error.message, error.detail)] }));
  }

  const tempRoot = prepareTempRoot(options.tempRoot);
  const executions = [];
  try {
    for (let replayIndex = 1; replayIndex <= request.limits.replays; replayIndex += 1) {
      disposable.created += 1;
      const execution = executeReplay(request, replayIndex, tempRoot);
      disposable.removed += 1;
      executions.push(execution);
      if (execution.state !== 'PASS') break;
    }
  } catch (error) {
    disposable.residueObserved = disposable.removed !== disposable.created;
    return buildReceipt({ request, state: 'HOLD_DISPOSAL_INCOMPLETE', findings: [finding('DISPOSABLE_RUN_CLEANUP_FAILED', 'HOLD', error.message)], profile, executions, disposable, result: null });
  }
  disposable.residueObserved = disposable.removed !== disposable.created;
  if (disposable.residueObserved) return buildReceipt({ request, state: 'HOLD_DISPOSAL_INCOMPLETE', findings: [finding('DISPOSABLE_RESIDUE_OBSERVED', 'HOLD', 'One or more disposable run directories remain.')], profile, executions, disposable, result: null });

  const failed = executions.find(item => item.state !== 'PASS');
  if (failed) {
    const mapping = {
      TIMEOUT: ['HOLD_RUNNER_TIMEOUT', 'RUNNER_WALL_TIME_EXCEEDED', 'Candidate execution exceeded the exact wall-time ceiling and the disposable child was terminated.'],
      OUTPUT_BOUND: ['HOLD_RUNNER_OUTPUT_BOUND', 'RUNNER_OUTPUT_LIMIT_EXCEEDED', 'The trusted runner exceeded its exact output ceiling.'],
      WRAPPER_BOUNDARY_FAILED: ['HOLD_WRAPPER_BOUNDARY', 'TRUSTED_WRAPPER_CHECK_FAILED', 'The trusted wrapper did not reproduce its closed environment and permission checks.'],
      RUNNER_ERROR: ['HOLD_RUNNER_FAILURE', 'RUNNER_DID_NOT_RETURN_PASS', 'The disposable child did not produce a valid passing worker receipt.']
    };
    const [state, code, statement] = mapping[failed.state] || mapping.RUNNER_ERROR;
    return buildReceipt({ request, state, findings: [finding(code, 'HOLD', statement, { replayIndex: failed.replayIndex, failureCode: failed.failureCode })], profile, executions, disposable, result: null });
  }

  const exactWorkerReceiptsMatch = new Set(executions.map(item => item.workerResultDigest)).size === 1;
  const exactResultsMatch = new Set(executions.map(item => item.result)).size === 1;
  if (!exactWorkerReceiptsMatch || !exactResultsMatch) {
    return buildReceipt({ request, state: 'HOLD_REPLAY_MISMATCH', findings: [finding('DISPOSABLE_REPLAYS_DIVERGED', 'HOLD', 'The two fresh-process executions did not return one exact worker receipt and result.')], profile, executions, disposable, result: null });
  }
  return buildReceipt({
    request,
    state: 'PASS_BOUNDED_PURE_WASM_RESULT',
    findings: [finding('EXACT_PURE_WASM_REPLAYS_PASS', 'INFO', 'Two disposable zero-import pure Wasm executions returned one exact bounded result.')],
    profile,
    executions,
    disposable,
    result: executions[0].result
  });
}

module.exports = {
  ORGAN_ID,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  WORKER_RESULT_SCHEMA,
  WORKER_PATH,
  PROFILE_PATH,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  RECEIPT_STATES,
  exactKeys,
  decodeCanonicalBase64,
  validateRequest,
  requestAuthorityIsClosed,
  verifyWorkerResult,
  execute
};
