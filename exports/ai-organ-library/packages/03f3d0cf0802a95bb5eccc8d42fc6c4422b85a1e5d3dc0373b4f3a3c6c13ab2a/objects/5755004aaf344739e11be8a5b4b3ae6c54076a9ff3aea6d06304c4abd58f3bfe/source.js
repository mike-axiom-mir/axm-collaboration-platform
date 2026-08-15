'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');

const ORGAN_ID = 'axm.mirror.organ/game-tester-mission-behavioral-exam-v1';
const PACK_SCHEMA = 'axm.mirror.game-tester-mission-behavioral-exam-pack/v1';
const RECEIPT_SCHEMA = 'axm.mirror.game-tester-mission-behavioral-exam-receipt/v1';
const RUNNER_INPUT_SCHEMA = 'axm.mirror.game-tester-mission-behavioral-exam-input/v1';
const RUNNER_OUTPUT_SCHEMA = 'axm.mirror.game-tester-mission-behavioral-exam-output/v1';
const ROOT = path.resolve(__dirname, '..');
const CANDIDATE_PATH = 'organs/game-tester-mission-organ.js';
const CANDIDATE_ORGAN_ID = 'axm.mirror.organ/game-tester-mission-compiler-v1';
const RUNNER_PATH = path.join(ROOT, 'kernel', 'game-tester-mission-exam-runner.js');
const OPERATIONS = Object.freeze(['READY_PLAN', 'MISSING_PROVIDER', 'PROVIDER_STATE', 'FORBIDDEN_AUTHORITY', 'TAMPER_REQUEST', 'ASSESS_RETURN']);
const CLAIM_KINDS = Object.freeze(['DETERMINISTIC_BEHAVIOR', 'AUTHORIZATION_BOUNDARY', 'FAILURE_PRESERVATION']);
const AUTHORITY_KEYS = Object.freeze(['launch', 'control', 'targetWrite', 'parentMirrorWrite', 'permissionGrant', 'releaseDecision', 'promotion', 'canon', 'worldAction', 'independentCertification']);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));

function stable(value) { return KeySafeJson.stable(value, { maxBytes: 1024 * 1024, maxDepth: 32, maxNodes: 20000 }); }
function digest(value) { return KeySafeJson.digest(value, { maxBytes: 1024 * 1024, maxDepth: 32, maxNodes: 20000 }); }
function same(left, right) { return KeySafeJson.same(left, right, { maxBytes: 1024 * 1024, maxDepth: 32, maxNodes: 20000 }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} fields changed`);
}

function boundedText(value, label, maximum = 240) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u001f]/.test(value)) throw new Error(`${label} must be bounded text`);
  return value.trim();
}

function identifier(value, label, maximum = 180) {
  const output = boundedText(value, label, maximum);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(output) || output.includes('..')) throw new Error(`${label} must be a bounded identity`);
  return output;
}

function sha(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value || ''))) throw new Error(`${label} must be sha256`);
  return value;
}

function integer(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${label} is outside its bound`);
  return value;
}

function reverseObjectOrder(value) {
  if (Array.isArray(value)) return value.map(reverseObjectOrder);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const key of Object.keys(value).reverse()) output[key] = reverseObjectOrder(value[key]);
  return output;
}

function normalizeParameters(operation, value) {
  if (operation === 'READY_PLAN') exactKeys(value, [], `${operation} parameters`);
  else if (operation === 'MISSING_PROVIDER') {
    exactKeys(value, ['capabilityId'], `${operation} parameters`);
    identifier(value.capabilityId, 'missing provider capabilityId');
  } else if (operation === 'PROVIDER_STATE') {
    exactKeys(value, ['capabilityId', 'declarationState', 'verificationState', 'authorityGateState'], `${operation} parameters`);
    identifier(value.capabilityId, 'provider state capabilityId');
    if (!['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN'].includes(value.declarationState)) throw new Error('provider declarationState is invalid');
    if (!['PASS_INDEPENDENT', 'PASS_SAME_BUILDER', 'FAIL', 'NOT_RUN'].includes(value.verificationState)) throw new Error('provider verificationState is invalid');
    if (!['VERIFIED_EXTERNAL_GATE', 'UNVERIFIED_EXTERNAL_GATE', 'NOT_REQUIRED'].includes(value.authorityGateState)) throw new Error('provider authorityGateState is invalid');
  } else if (operation === 'FORBIDDEN_AUTHORITY') {
    exactKeys(value, ['field'], `${operation} parameters`);
    if (!['parentMirrorWrite', 'testedTargetSourceWrite', 'testedTargetPersistentStateWrite', 'permissionGrant', 'releaseDecision', 'promotion', 'canonChange', 'externalNetwork'].includes(value.field)) throw new Error('forbidden authority field is invalid');
  } else if (operation === 'TAMPER_REQUEST') {
    exactKeys(value, ['field'], `${operation} parameters`);
    if (!['requestDigest'].includes(value.field)) throw new Error('tamper field is invalid');
  } else if (operation === 'ASSESS_RETURN') {
    const keys = ['caseState', 'targetDigestChanged', 'sourceTreeUnchanged', 'persistentStateUnchanged', 'cleanupComplete', 'rawVisualBytesRetained', 'rawVisualItemsRetained', 'targetSourceWrites', 'targetPersistentStateWrites', 'parentMirrorWrites', 'permissionGrants', 'releaseDecisions', 'canonChanges'];
    exactKeys(value, keys, `${operation} parameters`);
    if (!['PASS', 'FAIL', 'UNKNOWN', 'CONTRADICTORY', 'NOT_APPLICABLE', 'NOT_RUN'].includes(value.caseState)) throw new Error('assessment caseState is invalid');
    for (const key of ['targetDigestChanged', 'sourceTreeUnchanged', 'persistentStateUnchanged', 'cleanupComplete']) if (typeof value[key] !== 'boolean') throw new Error(`${key} must be boolean`);
    integer(value.rawVisualBytesRetained, 0, 67108864, 'rawVisualBytesRetained');
    integer(value.rawVisualItemsRetained, 0, 256, 'rawVisualItemsRetained');
    for (const key of ['targetSourceWrites', 'targetPersistentStateWrites', 'parentMirrorWrites', 'permissionGrants', 'releaseDecisions', 'canonChanges']) integer(value[key], 0, 1000000, key);
  } else throw new Error('behavioral exam operation is not declared');
  return stable(value);
}

function normalizePack(value) {
  const pack = stable(value);
  exactKeys(pack, ['schema', 'packId', 'packDigest', 'status', 'candidate', 'authorship', 'fixture', 'cases', 'limits', 'authority', 'boundary'], 'behavioral exam pack');
  if (pack.schema !== PACK_SCHEMA || pack.status !== 'EXPERIMENTAL') throw new Error('behavioral exam pack identity changed');
  if (pack.packId !== null) identifier(pack.packId, 'packId');
  if (pack.packDigest !== null) sha(pack.packDigest, 'packDigest');
  exactKeys(pack.candidate, ['organId', 'path', 'sha256'], 'behavioral exam candidate');
  if (pack.candidate.organId !== CANDIDATE_ORGAN_ID || pack.candidate.path !== CANDIDATE_PATH) throw new Error('behavioral exam candidate identity changed');
  sha(pack.candidate.sha256, 'candidate sha256');
  exactKeys(pack.authorship, ['caseAuthorId', 'caseAuthorKind', 'relationToCandidateBuilder', 'identityCertified'], 'behavioral exam authorship');
  identifier(pack.authorship.caseAuthorId, 'caseAuthorId');
  if (!['DECLARED_AI_STEWARD', 'DECLARED_HUMAN_LOCAL_STEWARD'].includes(pack.authorship.caseAuthorKind) || !['SAME_BUILDER', 'DECLARED_DISTINCT_AUTHOR_UNCERTIFIED'].includes(pack.authorship.relationToCandidateBuilder) || pack.authorship.identityCertified !== false) throw new Error('behavioral exam authorship claim changed');
  if (!pack.fixture || pack.fixture.schema !== 'axm.mirror.game-tester-mission-request/v1') throw new Error('behavioral exam fixture identity changed');
  if (!Array.isArray(pack.cases) || pack.cases.length < 8 || pack.cases.length > 32) throw new Error('behavioral exam cases are outside their bound');
  const ids = new Set();
  pack.cases = pack.cases.map((item, index) => {
    exactKeys(item, ['caseId', 'claimId', 'claimKind', 'operation', 'parameters', 'expected'], `behavioral exam case ${index}`);
    const caseId = identifier(item.caseId, `case ${index} caseId`);
    if (ids.has(caseId)) throw new Error('behavioral exam caseId is duplicated');
    ids.add(caseId);
    identifier(item.claimId, `case ${index} claimId`);
    if (!CLAIM_KINDS.includes(item.claimKind) || !OPERATIONS.includes(item.operation)) throw new Error(`behavioral exam case ${caseId} classification changed`);
    if (!item.expected || typeof item.expected !== 'object' || Array.isArray(item.expected)) throw new Error(`behavioral exam case ${caseId} expected projection is invalid`);
    return stable({ caseId, claimId: item.claimId, claimKind: item.claimKind, operation: item.operation, parameters: normalizeParameters(item.operation, item.parameters), expected: item.expected });
  });
  exactKeys(pack.limits, ['cases', 'replaysPerCase', 'wallTimeMs', 'stdoutBytes'], 'behavioral exam limits');
  if (pack.limits.cases !== pack.cases.length || pack.limits.replaysPerCase !== 2) throw new Error('behavioral exam coverage or replay count changed');
  integer(pack.limits.wallTimeMs, 250, 5000, 'behavioral exam wallTimeMs');
  integer(pack.limits.stdoutBytes, 16384, 1048576, 'behavioral exam stdoutBytes');
  exactKeys(pack.authority, AUTHORITY_KEYS, 'behavioral exam pack authority');
  if (AUTHORITY_KEYS.some(key => pack.authority[key] !== false)) throw new Error('behavioral exam pack gained authority');
  pack.boundary = boundedText(pack.boundary, 'behavioral exam pack boundary', 2000);
  return stable(pack);
}

function sealPack(draft) {
  const pack = normalizePack(Object.assign({}, clone(draft), { packId: null, packDigest: null }));
  pack.packId = `game-tester-mission-behavioral-exam-pack-${digest(pack).slice(0, 24)}`;
  pack.packDigest = digest(Object.assign({}, pack, { packDigest: null }));
  return stable(pack);
}

function verifyPack(value) {
  const pack = normalizePack(value);
  const expected = sealPack(pack);
  if (!same(pack, expected)) throw new Error('behavioral exam pack content address changed');
  return true;
}

function resolveCandidate(pack, root = ROOT) {
  const resolvedRoot = path.resolve(root);
  const candidatePath = path.resolve(resolvedRoot, pack.candidate.path);
  const relation = path.relative(resolvedRoot, candidatePath);
  if (!relation || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) throw new Error('behavioral exam candidate escaped Mirror root');
  const stat = fs.lstatSync(candidatePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('behavioral exam candidate must be one bounded ordinary file');
  const bytes = fs.readFileSync(candidatePath);
  if (KeySafeJson.sha256Bytes(bytes) !== pack.candidate.sha256) throw new Error('behavioral exam candidate bytes changed after pack seal');
  const source = bytes.toString('utf8');
  const imports = Array.from(source.matchAll(/require\((['"])([^'"]+)\1\)/g), match => match[2]).sort();
  if (!same(imports, ['crypto']) || /\b(?:fetch|WebSocket|eval)\s*\(|\bnew\s+Function\b|node:(?:fs|net|http|https|dgram|child_process|worker_threads)|require\((['"])(?:fs|net|http|https|dgram|child_process|worker_threads)\1\)/.test(source)) throw new Error('behavioral exam candidate static execution boundary changed');
  return { candidatePath, bytes: bytes.length, sha256: pack.candidate.sha256, imports };
}

function runnerEnvironment() {
  const output = {};
  for (const key of ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP']) if (typeof process.env[key] === 'string') output[key] = process.env[key];
  return output;
}

function executeReplay(pack, item, replayIndex, candidate) {
  const baseInput = stable({ schema: RUNNER_INPUT_SCHEMA, fixture: pack.fixture, operation: item.operation, parameters: item.parameters });
  const input = replayIndex === 1 ? baseInput : reverseObjectOrder(baseInput);
  const execution = childProcess.spawnSync(process.execPath, [
    '--permission',
    `--allow-fs-read=${RUNNER_PATH}`,
    `--allow-fs-read=${candidate.candidatePath}`,
    '--max-old-space-size=64',
    '--stack_size=512',
    RUNNER_PATH,
    candidate.candidatePath
  ], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    env: runnerEnvironment(),
    input: JSON.stringify(input),
    killSignal: 'SIGKILL',
    maxBuffer: pack.limits.stdoutBytes,
    shell: false,
    timeout: pack.limits.wallTimeMs,
    windowsHide: true
  });
  const stdout = String(execution.stdout || '');
  const stderr = String(execution.stderr || '');
  let response = null;
  try { response = JSON.parse(stdout); } catch (_) {}
  let wrapperClosed = false;
  let responseValid = false;
  try {
    exactKeys(response, ['schema', 'inputDigest', 'output', 'outputDigest', 'wrapper'], 'behavioral exam runner response');
    exactKeys(response.wrapper, ['permissionModelActive', 'fsWriteAllowed', 'childAllowed', 'workerAllowed'], 'behavioral exam runner wrapper');
    wrapperClosed = response.wrapper.permissionModelActive === true && response.wrapper.fsWriteAllowed === false && response.wrapper.childAllowed === false && response.wrapper.workerAllowed === false;
    responseValid = response.schema === RUNNER_OUTPUT_SCHEMA && response.inputDigest === digest(input) && response.outputDigest === digest(response.output);
  } catch (_) {}
  const expectedMatch = responseValid && same(response.output, item.expected);
  return stable({
    replayIndex,
    state: execution.status === 0 && !execution.error && wrapperClosed && responseValid && expectedMatch ? 'PASS' : 'FAIL',
    processStatus: Number.isInteger(execution.status) ? execution.status : null,
    signal: execution.signal || null,
    timeout: !!(execution.error && execution.error.code === 'ETIMEDOUT'),
    stdoutBytes: Buffer.byteLength(stdout),
    stdoutDigest: KeySafeJson.sha256Bytes(stdout),
    stderrBytes: Buffer.byteLength(stderr),
    stderrDigest: KeySafeJson.sha256Bytes(stderr),
    responseValid,
    wrapperClosed,
    expectedMatch,
    outputDigest: responseValid ? response.outputDigest : null
  });
}

function runExam(value, examiner, options = {}) {
  verifyPack(value);
  const pack = normalizePack(value);
  exactKeys(examiner, ['examinerId', 'examinerKind', 'relationToCandidateBuilder', 'identityCertified'], 'behavioral examiner');
  const examinerId = identifier(examiner.examinerId, 'examinerId');
  if (!['DECLARED_AI_STEWARD', 'DECLARED_HUMAN_LOCAL_STEWARD', 'TEST_HARNESS'].includes(examiner.examinerKind) || !['SAME_BUILDER', 'DECLARED_INDEPENDENT'].includes(examiner.relationToCandidateBuilder) || examiner.identityCertified !== false) throw new Error('behavioral examiner declaration changed');
  const resolvedCandidate = resolveCandidate(pack, options.root || ROOT);
  const caseResults = pack.cases.map(item => {
    const replays = [1, 2].map(index => executeReplay(pack, item, index, resolvedCandidate));
    const replayMatch = replays.every(row => row.outputDigest !== null) && new Set(replays.map(row => row.outputDigest)).size === 1;
    return stable({
      caseId: item.caseId,
      claimId: item.claimId,
      claimKind: item.claimKind,
      operation: item.operation,
      expectedDigest: digest(item.expected),
      replays,
      replayMatch,
      state: replays.every(row => row.state === 'PASS') && replayMatch ? 'PASS' : 'FAIL'
    });
  });
  const passed = caseResults.filter(row => row.state === 'PASS').length;
  const allPass = passed === caseResults.length;
  let state = 'FAIL_BEHAVIORAL_EXAM';
  if (allPass && examiner.relationToCandidateBuilder === 'SAME_BUILDER') state = 'PASS_SAME_BUILDER_BEHAVIOR_OBSERVED_INDEPENDENT_EXAM_STILL_REQUIRED';
  else if (allPass) state = 'PASS_DECLARED_INDEPENDENT_BEHAVIOR_OBSERVED_IDENTITY_NOT_CERTIFIED';
  const claims = caseResults.map(row => stable({
    claimId: row.claimId,
    claimKind: row.claimKind,
    risk: row.claimKind === 'AUTHORIZATION_BOUNDARY' ? 'HIGH' : 'MEDIUM',
    passCondition: 'Two fresh reduced-permission child processes return the frozen expected projection and one exact output digest.',
    primarySurface: 'FRESH_PROCESS_DETERMINISTIC_EXECUTION',
    counterevidence: 'Candidate source drift, process failure, wrapper permission drift, expected-output mismatch, or replay divergence.',
    observedEvidence: { caseId: row.caseId, expectedDigest: row.expectedDigest, replayOutputDigests: row.replays.map(item => item.outputDigest), wrapperClosed: row.replays.every(item => item.wrapperClosed) },
    verdict: row.state,
    namedSeam: row.state === 'PASS' ? null : 'GAME_TESTER_MISSION_COMPILER_BEHAVIOR_DIVERGED_FROM_FROZEN_CASE'
  }));
  const basis = stable({
    schema: RECEIPT_SCHEMA,
    receiptId: null,
    receiptDigest: null,
    status: 'TEST',
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    pack: { packId: pack.packId, packDigest: pack.packDigest, caseAuthorId: pack.authorship.caseAuthorId, relationToCandidateBuilder: pack.authorship.relationToCandidateBuilder, identityCertified: false },
    candidate: { organId: CANDIDATE_ORGAN_ID, path: CANDIDATE_PATH, bytes: resolvedCandidate.bytes, sha256: resolvedCandidate.sha256, imports: resolvedCandidate.imports },
    examiner: { id: examinerId, kind: examiner.examinerKind, relationToCandidateBuilder: examiner.relationToCandidateBuilder, identityCertified: false },
    state,
    claims,
    caseResults,
    counts: { cases: caseResults.length, passed, failed: caseResults.length - passed, childProcesses: caseResults.length * pack.limits.replaysPerCase, liveGamesLaunched: 0, controlsExecuted: 0, targetWrites: 0, parentMirrorWrites: 0, permissionGrants: 0, releaseDecisions: 0, canonChanges: 0, worldActions: 0 },
    authority: ZERO_AUTHORITY,
    nextGate: allPass ? 'A_DISTINCT_STEWARD_MUST_RUN_OR_AUTHOR_AN_INDEPENDENT_EXAM_BEFORE_THE_AUTHORITY_GATED_LAUNCH_HAND_CAN_ENTER_BEHAVIORAL_REVIEW' : 'PRESERVE_FAILURE_AND_REPAIR_THE_NAMED_CASE_WITHOUT_WEAKENING_ITS_EXPECTATION',
    limitations: [
      'The frozen cases and candidate were produced in the same stewardship lineage, so this run is same-builder evidence unless a genuinely distinct examiner supplies stronger provenance.',
      'Fresh reduced-permission processes test deterministic compiler behavior; they do not launch a game, execute controls, inspect visuals, prove a human identity, verify a permission lease, or establish operating-system network isolation.',
      'Static import closure is bound to the exact candidate digest. It is useful evidence for this source, not a general malicious-code sandbox claim.',
      'A passing receipt does not install, activate, promote, release, grant permission, change CANON, certify fun or accessibility, or write Mirror, Workshop, or a tested target.'
    ],
    boundary: 'This TEST organ replays a content-addressed Game Tester mission-compiler exam in fresh reduced-permission child processes and emits evidence only. It has no game-launch, control, write, permission, release, promotion, CANON, independent-certification, or world authority.'
  });
  const content = Object.assign({}, basis, { receiptId: null, receiptDigest: null });
  basis.receiptId = `game-tester-mission-behavioral-exam-${digest(content).slice(0, 24)}`;
  basis.receiptDigest = digest(Object.assign({}, basis, { receiptDigest: null }));
  return stable(basis);
}

function verifyReceipt(receipt, pack = null, examiner = null, options = {}) {
  exactKeys(receipt, ['schema', 'receiptId', 'receiptDigest', 'status', 'organ', 'pack', 'candidate', 'examiner', 'state', 'claims', 'caseResults', 'counts', 'authority', 'nextGate', 'limitations', 'boundary'], 'behavioral exam receipt');
  if (receipt.schema !== RECEIPT_SCHEMA || receipt.status !== 'TEST' || receipt.organ.id !== ORGAN_ID || receipt.organ.learnedWeights !== false) throw new Error('behavioral exam receipt identity changed');
  if (!['PASS_SAME_BUILDER_BEHAVIOR_OBSERVED_INDEPENDENT_EXAM_STILL_REQUIRED', 'PASS_DECLARED_INDEPENDENT_BEHAVIOR_OBSERVED_IDENTITY_NOT_CERTIFIED', 'FAIL_BEHAVIORAL_EXAM'].includes(receipt.state)) throw new Error('behavioral exam receipt state changed');
  exactKeys(receipt.authority, AUTHORITY_KEYS, 'behavioral exam receipt authority');
  if (AUTHORITY_KEYS.some(key => receipt.authority[key] !== false)) throw new Error('behavioral exam receipt gained authority');
  const expectedId = `game-tester-mission-behavioral-exam-${digest(Object.assign({}, receipt, { receiptId: null, receiptDigest: null })).slice(0, 24)}`;
  const expectedDigest = digest(Object.assign({}, receipt, { receiptDigest: null }));
  if (receipt.receiptId !== expectedId || receipt.receiptDigest !== expectedDigest) throw new Error('behavioral exam receipt content address changed');
  if (pack || examiner) {
    if (!pack || !examiner || !same(receipt, runExam(pack, examiner, options))) throw new Error('behavioral exam receipt no longer replays from its sources');
  }
  return true;
}

module.exports = {
  ORGAN_ID,
  PACK_SCHEMA,
  RECEIPT_SCHEMA,
  RUNNER_INPUT_SCHEMA,
  RUNNER_OUTPUT_SCHEMA,
  CANDIDATE_PATH,
  CANDIDATE_ORGAN_ID,
  RUNNER_PATH,
  OPERATIONS,
  CLAIM_KINDS,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  stable,
  digest,
  same,
  sealPack,
  verifyPack,
  resolveCandidate,
  runExam,
  verifyReceipt
};
