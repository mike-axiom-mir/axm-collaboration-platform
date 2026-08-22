'use strict';

const fs = require('fs');
const path = require('path');
const Consent = require('./grounded-consent-scope-v1');
const Verifier = require('./schema-packet-mirror-verifier-v1');

let passed = 0;

function ok(condition, label) {
  if (!condition) throw new Error('FAIL: ' + label);
  passed += 1;
}

function same(left, right) {
  return Verifier.canonicalJson(left) === Verifier.canonicalJson(right);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function expectThrow(fn, pattern, label) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  ok(error && pattern.test(error.message), label + (error ? ': ' + error.message : ': no error'));
}

function retained() {
  const schemaRoot = path.resolve(
    __dirname,
    '../../docs/steward-runs/2026-08-22-code-capability-fabric-schema-compilation-v2.1/axm-fabric-creation-pilot-schema-trial-001'
  );
  const compositionRoot = path.resolve(
    __dirname,
    '../../docs/steward-runs/2026-08-22-code-capability-fabric-blueprint-composition-v2.0/axm-fabric-creation-pilot-blueprint-trial-001'
  );
  return {
    blueprintBytes: fs.readFileSync(path.join(compositionRoot, 'capability-blueprint.json')),
    compositionReceiptBytes: fs.readFileSync(path.join(compositionRoot, 'composition-receipt.json')),
    packetFiles: Verifier.EXPECTED_FILES.map((file) => ({
      path: file,
      bytes: fs.readFileSync(path.join(schemaRoot, file))
    }))
  };
}

function packet(role, files) {
  return {
    role,
    files: files.map((item) => ({ path: item.path, bytes: Buffer.from(item.bytes) }))
  };
}

function exactInput(options = {}) {
  const fixture = retained();
  const source = options.source || packet('SOURCE', fixture.packetFiles);
  const mirror = options.mirror || packet('MIRROR', fixture.packetFiles);
  return Verifier.buildExampleInput(
    fixture.blueprintBytes,
    fixture.compositionReceiptBytes,
    source,
    mirror
  );
}

function resealConsent(input, edits = {}) {
  const policyCore = clone(input.consentEvaluationInput.policy);
  delete policyCore.policyDigest;
  if (edits.policy) edits.policy(policyCore);
  const policy = Consent.sealPolicy(policyCore);
  const instanceCore = clone(input.consentEvaluationInput.instance);
  delete instanceCore.instanceDigest;
  instanceCore.policyRef = Consent.policyRef(policy);
  if (edits.instance) edits.instance(instanceCore);
  const instance = Consent.sealInstance(instanceCore);
  const consentEvaluationInput = {
    policy,
    instance,
    evaluatedAt: input.consentEvaluationInput.evaluatedAt
  };
  return {
    ...input,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput)
  };
}

function resealReceipt(value) {
  const core = clone(value);
  delete core.receiptDigest;
  let receiptBytes = core.resourceObservation.receiptBytes;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    core.resourceObservation.receiptBytes = receiptBytes;
    const sealed = { ...core, receiptDigest: Verifier.sha256(core) };
    const next = jsonBytes(sealed).length;
    if (next === receiptBytes) return sealed;
    receiptBytes = next;
  }
  throw new Error('test receipt length did not stabilize');
}

const input = exactInput();
const prepared = Verifier.prepare(input);
const receipt = Verifier.comparePackets(input);

ok(Verifier.PROFILE.kind === 'PURE_DATA_COMPARISON', 'profile is a pure data comparison');
ok(Verifier.PROFILE.filesystemReads === 'DISABLED_HOST_SUPPLIES_BYTES', 'profile requires host-supplied bytes');
ok(Verifier.PROFILE.filesystemWrites === 'DISABLED', 'profile disables filesystem writes');
ok(Verifier.PROFILE.gitCommands === 'DISABLED', 'profile disables Git commands');
ok(Verifier.PROFILE.network === 'DISABLED', 'profile disables network');
ok(Verifier.PROFILE.childProcesses === 'DISABLED', 'profile disables child processes');
ok(Verifier.PROFILE.packetExecution === 'DISABLED', 'profile disables packet execution');
ok(Verifier.PROFILE.authority === 'NONE', 'profile grants no authority');
ok(same(prepared.instance.permissions, []), 'grounded consent permissions remain empty');
ok(same(prepared.instance.networkDomains, []), 'grounded consent network remains empty');
ok(Object.values(prepared.instance.lifecycle).every((value) => value === false), 'all lifecycle effects remain false');
ok(receipt.status === 'MATCH', 'exact retained copy produces MATCH');
ok(receipt.source.packetRef.sha256 === receipt.mirror.packetRef.sha256, 'exact packet digests match');
ok(receipt.fileDelta.unchanged.length === 4, 'all four exact files are unchanged');
ok(receipt.fileDelta.added.length === 0 && receipt.fileDelta.removed.length === 0 && receipt.fileDelta.changed.length === 0, 'exact match has no drift categories');
ok(receipt.truth.sourceExactCompilationPacketVerified, 'trusted source packet is exactly verified');
ok(receipt.truth.mirrorExactCompilationPacketVerified, 'exact copied packet is exactly verified');
ok(receipt.truth.exactPacketByteEqualityProven, 'exact packet equality is proven');
ok(!receipt.truth.mirrorDriftObserved, 'exact packet does not claim drift');
ok(!receipt.truth.fileContentRetainedInReceipt && !JSON.stringify(receipt).includes('"bytes"'), 'receipt retains no file content field');
ok(!receipt.truth.gitObjectDatabaseInspected && !receipt.truth.gitRefsInspected, 'receipt denies Git object and ref inspection');
ok(!receipt.truth.gitRemoteContacted && !receipt.truth.transportDeliveryProven, 'receipt denies remote and transport proof');
ok(!receipt.truth.fullCloneCompletenessProven, 'receipt denies full clone completeness');
ok(!receipt.truth.mirrorCodeCloneConnected && !receipt.truth.mirrorCodeCloneExecuted, 'receipt denies mirror clone connection and execution');
ok(!receipt.truth.automaticMergePerformed && !receipt.truth.canonChanged, 'receipt denies merge and CANON authority');
ok(!receipt.resourceObservation.attemptCountEnforced, 'cross-invocation attempt enforcement is not overclaimed');
ok(!receipt.resourceObservation.durationEnforced && !receipt.resourceObservation.memoryEnforced, 'duration and memory enforcement are not overclaimed');
ok(receipt.resourceObservation.writtenFiles === 0, 'pure comparison reports no written files');
ok(receipt.resourceObservation.verifierInputBytes <= Verifier.MAX_VERIFIER_INPUT_BYTES, 'observed verifier input is within the fixed ceiling');
ok(receipt.resourceObservation.receiptBytes === jsonBytes(receipt).length, 'receipt byte observation is exact');
ok(Verifier.verifyReceipt(receipt, input).receiptDigest === receipt.receiptDigest, 'receipt verifies against exact bound inputs');

const reversed = exactInput({
  source: { role: 'SOURCE', files: packet('SOURCE', retained().packetFiles).files.reverse() },
  mirror: { role: 'MIRROR', files: packet('MIRROR', retained().packetFiles).files.reverse() }
});
ok(same(Verifier.comparePackets(reversed), receipt), 'input file ordering cannot change the deterministic receipt');
ok(receipt.fileDelta.unchanged.every((item, index, values) => index === 0 || values[index - 1].path < item.path), 'emitted file delta order is canonical');

for (const expectedPath of Verifier.EXPECTED_FILES) {
  const fixture = retained();
  const mirror = packet('MIRROR', fixture.packetFiles);
  const target = mirror.files.find((item) => item.path === expectedPath);
  target.bytes[target.bytes.length - 2] ^= 1;
  const driftInput = exactInput({ mirror });
  const drift = Verifier.comparePackets(driftInput);
  ok(drift.status === 'DRIFT', expectedPath + ' byte mutation produces DRIFT');
  ok(drift.fileDelta.changed.length === 1 && drift.fileDelta.changed[0].path === expectedPath, expectedPath + ' drift is precisely located');
  ok(!drift.truth.exactPacketByteEqualityProven && drift.truth.mirrorDriftObserved, expectedPath + ' drift cannot inflate equality truth');
}

for (const expectedPath of Verifier.EXPECTED_FILES) {
  const fixture = retained();
  const mirror = packet('MIRROR', fixture.packetFiles.filter((item) => item.path !== expectedPath));
  const drift = Verifier.comparePackets(exactInput({ mirror }));
  ok(drift.status === 'DRIFT' && drift.fileDelta.removed[0].path === expectedPath, expectedPath + ' removal is precise DRIFT');
  ok(drift.mirror.issues.includes('EXPECTED_FILE_MISSING'), expectedPath + ' removal has a typed missing-file issue');
}

const extraFixture = retained();
const extraMirror = packet('MIRROR', extraFixture.packetFiles);
extraMirror.files.push({ path: 'inert-review-helper.js', bytes: Buffer.from('not executed\n', 'utf8') });
const extraInput = exactInput({ mirror: extraMirror });
const extraReceipt = Verifier.comparePackets(extraInput);
ok(extraReceipt.status === 'DRIFT' && extraReceipt.fileDelta.added[0].path === 'inert-review-helper.js', 'unexpected executable-like file is added DRIFT');
ok(extraReceipt.mirror.issues.includes('UNEXPECTED_FILE_PRESENT'), 'unexpected file has a typed issue');
ok(same(extraReceipt.executableLikePathsPresent, ['inert-review-helper.js']), 'executable-like path is visible without executing content');
ok(extraReceipt.mirror.embeddedCompilationVerified && !extraReceipt.mirror.exactCompilationPacketVerified, 'valid embedded four-file packet plus extra file is not exact');

const invalidJsonMirror = packet('MIRROR', retained().packetFiles);
invalidJsonMirror.files.find((item) => item.path === 'schema-compilation-receipt.json').bytes = Buffer.from('{', 'utf8');
const invalidJsonReceipt = Verifier.comparePackets(exactInput({ mirror: invalidJsonMirror }));
ok(invalidJsonReceipt.mirror.issues.includes('RECEIPT_JSON_INVALID'), 'invalid embedded receipt JSON is typed DRIFT');

const invalidObjectMirror = packet('MIRROR', retained().packetFiles);
const invalidObjectFile = invalidObjectMirror.files.find((item) => item.path === 'schema-compilation-receipt.json');
const invalidObject = JSON.parse(invalidObjectFile.bytes.toString('utf8'));
invalidObject.surprise = true;
invalidObjectFile.bytes = jsonBytes(invalidObject);
const invalidObjectReceipt = Verifier.comparePackets(exactInput({ mirror: invalidObjectMirror }));
ok(invalidObjectReceipt.mirror.issues.includes('RECEIPT_OBJECT_INVALID'), 'invalid embedded receipt object is typed DRIFT');

const noncanonicalReceiptMirror = packet('MIRROR', retained().packetFiles);
const noncanonicalFile = noncanonicalReceiptMirror.files.find((item) => item.path === 'schema-compilation-receipt.json');
noncanonicalFile.bytes = Buffer.from(JSON.stringify(JSON.parse(noncanonicalFile.bytes.toString('utf8'))), 'utf8');
const noncanonicalReceipt = Verifier.comparePackets(exactInput({ mirror: noncanonicalReceiptMirror }));
ok(noncanonicalReceipt.mirror.issues.includes('RECEIPT_BYTES_NOT_DETERMINISTIC'), 'valid but non-deterministic receipt bytes are typed DRIFT');

expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [] }, 'SOURCE'), /1 to 8/, 'empty packet is rejected');
expectThrow(() => Verifier.decodePacket({ role: 'MIRROR', files: [{ path: 'a', bytes: Buffer.from('a') }] }, 'SOURCE'), /role/, 'wrong packet role is rejected');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [{ path: 'a', bytes: Buffer.from('a'), extra: true }] }, 'SOURCE'), /unsupported fields/, 'file record extra fields are rejected');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [{ path: 'a', bytes: Buffer.from('a') }], extra: true }, 'SOURCE'), /unsupported fields/, 'packet extra fields are rejected');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [{ path: 'a', bytes: 'a' }] }, 'SOURCE'), /Buffer/, 'non-Buffer content is rejected');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [{ path: 'a', bytes: Buffer.alloc(0) }] }, 'SOURCE'), /byte length/, 'empty file bytes are rejected');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [{ path: 'a', bytes: Buffer.alloc(Verifier.MAX_FILE_BYTES + 1) }] }, 'SOURCE'), /byte length/, 'per-file byte ceiling is enforced');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [
  { path: 'a', bytes: Buffer.alloc(50000) },
  { path: 'b', bytes: Buffer.alloc(50000) },
  { path: 'c', bytes: Buffer.alloc(50000) }
] }, 'SOURCE'), /total bytes/, 'aggregate packet byte ceiling is enforced');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: Array.from({ length: 9 }, (_, index) => ({ path: 'f' + index, bytes: Buffer.from('x') })) }, 'SOURCE'), /1 to 8/, 'packet file-count ceiling is enforced');
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [
  { path: 'Case.json', bytes: Buffer.from('a') },
  { path: 'case.json', bytes: Buffer.from('b') }
] }, 'SOURCE'), /case-insensitive duplicate/, 'case-insensitive path alias is rejected');

const unsafePaths = [
  ['/absolute.json', /unsafe|relative/, 'absolute path'],
  ['C:/drive.json', /unsafe|relative/, 'drive path'],
  ['../escape.json', /unsafe|relative/, 'traversal path'],
  ['dir\\file.json', /unsafe|relative/, 'backslash alias'],
  ['.', /canonical/, 'dot path'],
  ['dir//file.json', /canonical|unsafe|portable/, 'duplicate separator alias'],
  ['dir/file.json.', /non-portable/, 'trailing dot alias'],
  ['dir/file.json ', /non-portable/, 'trailing space alias'],
  ['dir/data:stream', /non-portable/, 'Windows alternate data stream'],
  ['dir/a?.json', /non-portable/, 'Windows invalid filename character'],
  ['dir/CON', /reserved Windows/, 'Windows device name'],
  ['dir/com1.txt', /reserved Windows/, 'Windows device alias with extension'],
  ['e\u0301.json', /canonical NFC/, 'Unicode normalization alias'],
  ['a'.repeat(256), /non-portable/, 'oversized path segment']
];
unsafePaths.forEach(([unsafePath, pattern, label]) => expectThrow(
  () => Verifier.decodePacket({ role: 'SOURCE', files: [{ path: unsafePath, bytes: Buffer.from('x') }] }, 'SOURCE'),
  pattern,
  label + ' is rejected'
));
expectThrow(() => Verifier.decodePacket({ role: 'SOURCE', files: [{ path: 7, bytes: Buffer.from('x') }] }, 'SOURCE'), /string/, 'non-string path is rejected');
ok(Verifier.safePacketPath('dir/portable-file.json') === 'dir/portable-file.json', 'portable nested relative path is accepted');

const invalidSource = packet('SOURCE', retained().packetFiles);
invalidSource.files[0].bytes[invalidSource.files[0].bytes.length - 2] ^= 1;
expectThrow(() => Verifier.comparePackets(exactInput({ source: invalidSource })), /source packet is not an exact verified/, 'invalid source can never become comparison ground truth');

const packetDriftAfterConsent = exactInput();
packetDriftAfterConsent.mirrorPacket.files[0].bytes[0] ^= 1;
expectThrow(() => Verifier.prepare(packetDriftAfterConsent), /bind the exact packet bytes/, 'packet drift after consent binding is rejected');

const staleEvaluation = exactInput();
staleEvaluation.consentEvaluation.evaluatedAt = '2026-08-22T14:00:00.000Z';
expectThrow(() => Verifier.prepare(staleEvaluation), /evaluation|digest/, 'forged stale consent evaluation is rejected');

const wrongAck = exactInput();
wrongAck.authorization.acknowledgement = 'COMPARE SOMETHING';
expectThrow(() => Verifier.prepare(wrongAck), /authorization/, 'ambiguous interactive acknowledgement is rejected');

const forgedInstruction = exactInput();
forgedInstruction.authorization.instructionRef.sha256 = Verifier.sha256('forged');
expectThrow(() => Verifier.prepare(forgedInstruction), /authorization/, 'forged instruction reference is rejected');

const permissionInput = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].allowedPermissions.push('workspace.read'); },
  instance(instance) { instance.permissions.push('workspace.read'); }
});
expectThrow(() => Verifier.prepare(permissionInput), /permission scope/, 'permission expansion is rejected even when policy allows it');

const networkInput = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].allowedNetworkDomains.push('example.com'); },
  instance(instance) { instance.networkDomains.push('example.com'); }
});
expectThrow(() => Verifier.prepare(networkInput), /network/, 'network expansion is rejected even when policy allows it');

const actionInput = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].allowedActions.push('code.execute'); },
  instance(instance) { instance.actions.push('code.execute'); }
});
expectThrow(() => Verifier.prepare(actionInput), /action scope/, 'action expansion is rejected even when policy allows it');

const lifecycleInput = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].allowedLifecycle.install = true; },
  instance(instance) { instance.lifecycle.install = true; }
});
expectThrow(() => Verifier.prepare(lifecycleInput), /lifecycle/, 'install lifecycle expansion is rejected');

const attemptInput = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].resourceCeilings.maxAttempts = 2; },
  instance(instance) { instance.resources.maxAttempts = 2; }
});
expectThrow(() => Verifier.prepare(attemptInput), /resource scope/, 'attempt declaration above one is rejected');

const processInput = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].resourceCeilings.maxProcesses = 2; },
  instance(instance) { instance.resources.maxProcesses = 2; }
});
expectThrow(() => Verifier.prepare(processInput), /resource scope/, 'process declaration above one is rejected');

const inputBudget = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].resourceCeilings.maxInputBytes = 30000; },
  instance(instance) { instance.resources.maxInputBytes = 30000; }
});
expectThrow(() => Verifier.prepare(inputBudget), /input byte budget/, 'conservative full verifier input ceiling is enforced');

const outputBudget = resealConsent(exactInput(), {
  policy(policy) { policy.domainRules[0].resourceCeilings.maxOutputBytes = 6000; },
  instance(instance) { instance.resources.maxOutputBytes = 6000; }
});
expectThrow(() => Verifier.comparePackets(outputBudget), /output byte budget/, 'receipt output byte ceiling is enforced');

const wrongRequestDigest = clone(input.request);
wrongRequestDigest.requestDigest = Verifier.sha256('wrong');
expectThrow(() => Verifier.normalizeRequest(wrongRequestDigest), /digest mismatch/, 'request digest drift is rejected');
expectThrow(() => Verifier.buildRequest(input.sourcePacket, input.mirrorPacket, 'A'), /id is invalid/, 'ambiguous request id is rejected');

const wrongReceiptDigest = clone(receipt);
wrongReceiptDigest.receiptDigest = Verifier.sha256('wrong');
expectThrow(() => Verifier.normalizeReceipt(wrongReceiptDigest), /digest mismatch/, 'receipt digest drift is rejected');

const versionAmbiguity = clone(receipt);
versionAmbiguity.version = '0.2.0';
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(versionAmbiguity)), /identity mismatch/, 'receipt version ambiguity is rejected');

const extraField = clone(receipt);
extraField.surprise = true;
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(extraField)), /unsupported fields/, 'receipt extra fields are rejected');

const truthInflation = clone(receipt);
truthInflation.truth.gitRefsInspected = true;
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(truthInflation)), /truth.*gitRefsInspected/, 'self-consistent Git ref truth inflation is rejected');

const statusFlip = clone(receipt);
statusFlip.status = 'DRIFT';
statusFlip.truth.mirrorExactCompilationPacketVerified = false;
statusFlip.truth.exactPacketByteEqualityProven = false;
statusFlip.truth.mirrorDriftObserved = true;
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(statusFlip)), /status contradicts/, 'self-consistent status flip is rejected by packet evidence');

const noncanonicalDelta = clone(receipt);
noncanonicalDelta.fileDelta.unchanged.reverse();
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(noncanonicalDelta)), /non-canonical/, 'non-canonical emitted delta order is rejected');

const duplicateDelta = clone(receipt);
duplicateDelta.fileDelta.added.push(clone(duplicateDelta.fileDelta.unchanged[0]));
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(duplicateDelta)), /multiple delta categories/, 'path duplicated across delta categories is rejected');

const malformedDeltaArray = clone(receipt);
malformedDeltaArray.fileDelta.added = {};
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(malformedDeltaArray)), /bounded array/, 'malformed emitted delta array is rejected explicitly');

const forgedPacketTotal = clone(receipt);
forgedPacketTotal.source.totalBytes += 1;
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(forgedPacketTotal)), /packet summaries contradict/, 'forged packet byte total is rejected');

const wrongRequestLineage = clone(receipt);
wrongRequestLineage.requestRef.id = 'other-request';
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(wrongRequestLineage)), /reference lineage/, 'forged request lineage is rejected');

const missingExecutableDisclosure = clone(extraReceipt);
missingExecutableDisclosure.executableLikePathsPresent = [];
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(missingExecutableDisclosure)), /executable-like path list/, 'executable-like path omission is rejected');

const attemptOverclaim = clone(receipt);
attemptOverclaim.resourceObservation.attemptCountEnforced = true;
expectThrow(() => Verifier.normalizeReceipt(resealReceipt(attemptOverclaim)), /resource observation mismatch/, 'attempt enforcement overclaim is rejected');

const wrongByteObservation = clone(receipt);
wrongByteObservation.resourceObservation.receiptBytes += 10;
delete wrongByteObservation.receiptDigest;
wrongByteObservation.receiptDigest = Verifier.sha256(wrongByteObservation);
expectThrow(() => Verifier.normalizeReceipt(wrongByteObservation), /byte observation mismatch/, 'forged receipt byte observation is rejected');

const comparisonDriftMirror = packet('MIRROR', retained().packetFiles);
comparisonDriftMirror.files[0].bytes[comparisonDriftMirror.files[0].bytes.length - 2] ^= 1;
expectThrow(() => Verifier.verifyReceipt(receipt, exactInput({ mirror: comparisonDriftMirror })), /differs from deterministic rebuild/, 'receipt cannot be replayed against different packet bytes');

const moduleSource = fs.readFileSync(path.join(__dirname, 'schema-packet-mirror-verifier-v1.js'), 'utf8');
ok(!/require\(['"](?:fs|child_process|http|https|net|tls|vm|worker_threads)['"]\)/.test(moduleSource), 'verifier imports no filesystem, executor, or network primitive');
ok(!/process\.env|\beval\s*\(|new Function/.test(moduleSource), 'verifier has no ambient secret or dynamic evaluation access');
ok(!/mirror-code-clone|\bgit\s+(?:clone|fetch|push|remote|show-ref|rev-parse)/i.test(moduleSource), 'verifier does not connect to clone code or invoke Git');
ok(/\.bytes\.equals\(/.test(moduleSource), 'exact match uses direct buffer equality in addition to digests');

const schemaFiles = [
  'fabric-schema-packet-mirror-verification-request.schema.json',
  'fabric-schema-packet-mirror-verifier-profile.schema.json',
  'fabric-schema-packet-mirror-verification-receipt.schema.json'
];
schemaFiles.forEach((file) => ok(
  JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).additionalProperties === false,
  file + ' is strict'
));

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-schema-packet-mirror-verifier-v1.contract.json'), 'utf8'));
ok(contract.status === 'TEST', 'module contract remains TEST');
ok(same(contract.permissions, []), 'module contract grants no permissions');
ok(contract.boundaries.writes.length === 0, 'module contract declares no writes');
ok(contract.boundaries.refuses.includes('full-clone-reliability-claim'), 'module contract refuses full clone reliability claims');
ok(contract.boundaries.refuses.includes('automatic-canon'), 'module contract refuses automatic CANON');
ok(Verifier.LIMITATIONS.includes('WINDOWS_SHORT_NAME_ALIASES_NOT_RESOLVED'), 'Windows short-name ambiguity remains explicit');
ok(Verifier.NEXT_GAPS.includes('mirror.git-object-set.compare'), 'Git object-set comparison remains a future gap');
ok(Verifier.NEXT_GAPS.includes('mirror.recovery.replay-test'), 'mirror recovery replay remains a future gap');

console.log('Code Capability Fabric schema-packet mirror verifier selftest: ' + passed + ' checks passed.');
