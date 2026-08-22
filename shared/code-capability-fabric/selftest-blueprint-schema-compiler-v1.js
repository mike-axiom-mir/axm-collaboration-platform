'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Consent = require('./grounded-consent-scope-v1');
const Compiler = require('./blueprint-schema-compiler-v1');

let passed = 0;

function ok(condition, label) {
  if (!condition) throw new Error('FAIL: ' + label);
  passed += 1;
}

function same(left, right) {
  return Compiler.canonicalJson(left) === Compiler.canonicalJson(right);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function retainedBytes() {
  const root = path.resolve(
    __dirname,
    '../../docs/steward-runs/2026-08-22-code-capability-fabric-blueprint-composition-v2.0/axm-fabric-creation-pilot-blueprint-trial-001'
  );
  return {
    blueprint: fs.readFileSync(path.join(root, 'capability-blueprint.json')),
    receipt: fs.readFileSync(path.join(root, 'composition-receipt.json'))
  };
}

function example() {
  const bytes = retainedBytes();
  return Compiler.buildExampleInput(bytes.blueprint, bytes.receipt);
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

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

const input = example();
const prepared = Compiler.prepare(input);
const packetA = Compiler.expectedPacket(input);
const packetB = Compiler.expectedPacket(example());

ok(Compiler.PROFILE.kind === 'PURE_DATA_TRANSFORM', 'profile is a pure data transform');
ok(Compiler.PROFILE.generatedCode === 'DISABLED', 'profile disables generated code');
ok(Compiler.PROFILE.generatedCodeExecution === 'DISABLED', 'profile disables generated code execution');
ok(Compiler.PROFILE.network === 'DISABLED', 'profile disables network');
ok(Compiler.PROFILE.childProcesses === 'DISABLED', 'profile disables child processes');
ok(same(packetA.compiled.inputSchema, packetB.compiled.inputSchema), 'input schema is deterministic');
ok(same(packetA.compiled.outputSchema, packetB.compiled.outputSchema), 'output schema is deterministic');
ok(packetA.compiled.matrix.matrixDigest === packetB.compiled.matrix.matrixDigest, 'acceptance matrix is deterministic');
ok(packetA.receipt.receiptDigest === packetB.receipt.receiptDigest, 'receipt is deterministic');
ok(packetA.compiled.inputSchema.additionalProperties === false, 'input schema is closed');
ok(packetA.compiled.outputSchema.additionalProperties === false, 'output schema is closed');
ok(same(packetA.compiled.inputSchema.required, ['capability-catalog', 'change-request', 'known-failures']), 'input required fields are exact');
ok(same(packetA.compiled.outputSchema.required, ['candidate-specification']), 'all declared outputs are required');
ok(packetA.compiled.inputSchema.properties['capability-catalog'].type === 'array', 'input field type is compiled');
ok(packetA.compiled.outputSchema.properties['candidate-specification'].type === 'object', 'output field type is compiled');
ok(packetA.compiled.inputSchema.$id === 'urn:axm:fabric:bounded-code-change-proposal:input:v1', 'input schema id is portable and stable');
ok(packetA.compiled.outputSchema.$id === 'urn:axm:fabric:bounded-code-change-proposal:output:v1', 'output schema id is portable and stable');
ok(!JSON.stringify(packetA.compiled.outputSchema).includes('"source"'), 'internal output source token is not exposed');
ok(packetA.compiled.matrix.cases.every((item) => item.verdict === 'UNRUN'), 'all acceptance verdicts remain unrun');
ok(packetA.compiled.matrix.desiredOutcomeReviews.every((item) => item.reviewStatus === 'HUMAN_REVIEW_REQUIRED'), 'quality outcomes remain human review gates');
ok(packetA.compiled.matrix.truth.anyAcceptanceCaseExecuted === false, 'matrix denies execution evidence');
ok(packetA.compiled.matrix.truth.runtimeQualityProven === false, 'matrix denies runtime quality proof');
ok(same(packetA.compiled.matrix.rootsGate, Consent.ROOTS_GATE), 'matrix preserves four roots in order');
ok(prepared.artifacts.length === 2, 'exactly two source artifacts are consent-bound');
ok(prepared.artifacts.every((item) => item.byteLength > 0 && /^sha256:[a-f0-9]{64}$/.test(item.sha256)), 'source artifacts are byte-bound');
ok(packetA.receipt.inputArtifactRefs.every((item, index) => same(item, prepared.artifacts[index])), 'receipt preserves source artifact lineage');
ok(packetA.receipt.resourceObservation.totalFilesWritten === 4, 'receipt reports exactly four files');
ok(packetA.receipt.resourceObservation.totalBytesWritten === packetA.compiled.inputSchemaBytes.length + packetA.compiled.outputSchemaBytes.length + packetA.compiled.matrixBytes.length + packetA.receiptBytes.length, 'receipt byte total is exact');
ok(packetA.receipt.resourceObservation.durationEnforced === false, 'duration enforcement is not overclaimed');
ok(packetA.receipt.resourceObservation.memoryEnforced === false, 'memory enforcement is not overclaimed');
ok(packetA.receipt.truth.generatedExecutableCodePresent === false, 'receipt denies executable generation');
ok(packetA.receipt.truth.candidateCodeExecuted === false, 'receipt denies candidate execution');
ok(packetA.receipt.truth.machineDefaultActivated === false, 'receipt denies machine default activation');
ok(packetA.receipt.truth.persistentLearningAdmitted === false, 'receipt denies persistent learning');
ok(packetA.receipt.truth.canonChanged === false, 'receipt denies CANON change');
ok(packetA.receipt.limitations.includes('DIRECT_REUSE_RIGHTS_FOR_FUTURE_CODE_NOT_EVALUATED'), 'direct-reuse rights remain held');

const artifactBytes = {
  [Compiler.INPUT_SCHEMA_FILE]: packetA.compiled.inputSchemaBytes,
  [Compiler.OUTPUT_SCHEMA_FILE]: packetA.compiled.outputSchemaBytes,
  [Compiler.MATRIX_FILE]: packetA.compiled.matrixBytes
};
const verified = Compiler.verifyCompilationArtifacts(packetA.receipt, artifactBytes, input);
ok(verified.matrix.matrixDigest === packetA.compiled.matrix.matrixDigest, 'exact packet verification succeeds');

const forgedBlueprint = Buffer.from(input.blueprintBytes);
forgedBlueprint[forgedBlueprint.length - 2] ^= 1;
expectThrow(() => Compiler.prepare({ ...input, blueprintBytes: forgedBlueprint }), /blueprint artifact/, 'blueprint byte drift is rejected');

const forgedSourceReceipt = Buffer.from(input.compositionReceiptBytes);
forgedSourceReceipt[forgedSourceReceipt.length - 3] ^= 1;
expectThrow(() => Compiler.prepare({ ...input, compositionReceiptBytes: forgedSourceReceipt }), /receipt|JSON|digest/, 'composition receipt byte drift is rejected');

const wrongIntent = clone(input.intent);
wrongIntent.purpose += ' drift';
delete wrongIntent.intentDigest;
wrongIntent.intentDigest = Compiler.sha256(wrongIntent);
expectThrow(() => Compiler.prepare({ ...input, intent: wrongIntent }), /intent|blueprint/, 'intent lineage drift is rejected');

const staleEvaluation = clone(input.consentEvaluation);
staleEvaluation.evaluatedAt = '2026-08-22T04:00:00.000Z';
expectThrow(() => Compiler.prepare({ ...input, consentEvaluation: staleEvaluation }), /evaluation|digest/, 'stale forged evaluation is rejected');

const wrongAck = { ...input, authorization: clone(input.authorization) };
wrongAck.authorization.acknowledgement = 'TRY IT';
expectThrow(() => Compiler.prepare(wrongAck), /authorization/, 'ambiguous acknowledgement is rejected');

const wrongInstruction = { ...input, authorization: clone(input.authorization) };
wrongInstruction.authorization.instructionRef.sha256 = Compiler.sha256('forged');
expectThrow(() => Compiler.prepare(wrongInstruction), /authorization/, 'forged instruction reference is rejected');

const networkInput = resealConsent(input, {
  policy(policy) { policy.domainRules[0].allowedNetworkDomains = ['example.com']; },
  instance(instance) { instance.networkDomains = ['example.com']; }
});
expectThrow(() => Compiler.prepare(networkInput), /network/, 'network authority is rejected even when declared policy allows it');

const permissionInput = resealConsent(input, {
  policy(policy) { policy.domainRules[0].allowedPermissions.push('workspace.read'); },
  instance(instance) { instance.permissions.push('workspace.read'); }
});
expectThrow(() => Compiler.prepare(permissionInput), /permission scope/, 'extra workspace permission is rejected');

const actionInput = resealConsent(input, {
  policy(policy) { policy.domainRules[0].allowedActions.push('code.execute'); },
  instance(instance) { instance.actions.push('code.execute'); }
});
expectThrow(() => Compiler.prepare(actionInput), /action scope/, 'extra action is rejected');

const lifecycleInput = resealConsent(input, {
  policy(policy) { policy.domainRules[0].allowedLifecycle.install = true; },
  instance(instance) { instance.lifecycle.install = true; }
});
expectThrow(() => Compiler.prepare(lifecycleInput), /lifecycle/, 'install lifecycle authority is rejected');

const inputBudget = resealConsent(input, {
  policy(policy) { policy.domainRules[0].resourceCeilings.maxInputBytes = 11000; },
  instance(instance) { instance.resources.maxInputBytes = 11000; }
});
expectThrow(() => Compiler.prepare(inputBudget), /input byte budget/, 'full compiler input budget is enforced beyond artifact sum');

const outputBudget = resealConsent(input, {
  policy(policy) { policy.domainRules[0].resourceCeilings.maxOutputBytes = 13000; },
  instance(instance) { instance.resources.maxOutputBytes = 13000; }
});
expectThrow(() => Compiler.expectedPacket(outputBudget), /output exceeds/, 'exact output byte budget is enforced');

const artifactDriftInput = { ...input, consentEvaluationInput: clone(input.consentEvaluationInput) };
artifactDriftInput.consentEvaluationInput.instance.inputArtifacts[0].sha256 = Compiler.sha256('drift');
expectThrow(() => Compiler.prepare(artifactDriftInput), /evaluation|digest/, 'forged consent artifact digest is rejected');

const passedMatrix = clone(packetA.compiled.matrix);
passedMatrix.cases[0].verdict = 'PASS';
const passedBytes = { ...artifactBytes, [Compiler.MATRIX_FILE]: jsonBytes(passedMatrix) };
expectThrow(() => Compiler.verifyCompilationArtifacts(packetA.receipt, passedBytes, input), /bytes do not match/, 'forged PASS verdict is rejected');

const reroutedMatrix = clone(packetA.compiled.matrix);
reroutedMatrix.cases[0].evidenceKind = 'TRUST_ME';
const reroutedBytes = { ...artifactBytes, [Compiler.MATRIX_FILE]: jsonBytes(reroutedMatrix) };
expectThrow(() => Compiler.verifyCompilationArtifacts(packetA.receipt, reroutedBytes, input), /bytes do not match/, 'forged evidence route is rejected');

const forgedOutput = Buffer.from(packetA.compiled.outputSchemaBytes);
forgedOutput[forgedOutput.length - 2] ^= 1;
expectThrow(() => Compiler.verifyCompilationArtifacts(packetA.receipt, { ...artifactBytes, [Compiler.OUTPUT_SCHEMA_FILE]: forgedOutput }, input), /bytes do not match/, 'compiled schema byte drift is rejected');

const forgedReceipt = clone(packetA.receipt);
forgedReceipt.truth.runtimeQualityProven = true;
const { receiptDigest: ignoredDigest, ...forgedCore } = forgedReceipt;
forgedReceipt.receiptDigest = Compiler.sha256(forgedCore);
expectThrow(() => Compiler.normalizeReceipt(forgedReceipt), /truth.*runtimeQualityProven/, 'self-consistent runtime quality overclaim is rejected');

const wrongReceiptDigest = clone(packetA.receipt);
wrongReceiptDigest.receiptDigest = Compiler.sha256('wrong');
expectThrow(() => Compiler.normalizeReceipt(wrongReceiptDigest), /digest mismatch/, 'receipt digest drift is rejected');

const versionAmbiguity = clone(packetA.receipt);
versionAmbiguity.version = '0.2.0';
delete versionAmbiguity.receiptDigest;
versionAmbiguity.receiptDigest = Compiler.sha256(versionAmbiguity);
expectThrow(() => Compiler.normalizeReceipt(versionAmbiguity), /identity mismatch/, 'receipt version ambiguity is rejected');

const malformedReceipt = clone(packetA.receipt);
malformedReceipt.surprise = true;
delete malformedReceipt.receiptDigest;
malformedReceipt.receiptDigest = Compiler.sha256(malformedReceipt);
expectThrow(() => Compiler.normalizeReceipt(malformedReceipt), /unsupported fields/, 'receipt extra fields are rejected');

const reorderedReceipt = clone(packetA.receipt);
reorderedReceipt.inputArtifactRefs.reverse();
delete reorderedReceipt.receiptDigest;
reorderedReceipt.receiptDigest = Compiler.sha256(reorderedReceipt);
expectThrow(() => Compiler.normalizeReceipt(reorderedReceipt), /artifact order/, 'source artifact order ambiguity is rejected');

const forgedCompositionObject = JSON.parse(input.compositionReceiptBytes.toString('utf8'));
forgedCompositionObject.blueprintRef.sha256 = Compiler.sha256('forged-blueprint-object');
delete forgedCompositionObject.receiptDigest;
forgedCompositionObject.receiptDigest = Compiler.sha256(forgedCompositionObject);
expectThrow(() => Compiler.prepare({ ...input, compositionReceiptBytes: jsonBytes(forgedCompositionObject) }), /blueprint object digest/, 'self-consistent forged source object lineage is rejected');

const sourceText = fs.readFileSync(path.join(__dirname, 'blueprint-schema-compiler-v1.js'), 'utf8');
ok(!/require\(['"](?:child_process|http|https|net|tls|vm|worker_threads)['"]\)/.test(sourceText), 'compiler imports no executor or network primitive');
ok(!/process\.env|\beval\s*\(|new Function/.test(sourceText), 'compiler has no ambient secret or dynamic evaluation access');

const schemaFiles = [
  'fabric-blueprint-schema-compilation-subject.schema.json',
  'fabric-blueprint-acceptance-matrix.schema.json',
  'fabric-blueprint-schema-compiler-profile.schema.json',
  'fabric-blueprint-schema-compilation-receipt.schema.json'
];
schemaFiles.forEach((file) => ok(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).additionalProperties === false, file + ' is strict'));

const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-schema-compiler-selftest-'));
try {
  const faultNames = ['AFTER_INPUT_SCHEMA', 'AFTER_OUTPUT_SCHEMA', 'AFTER_MATRIX', 'AFTER_RECEIPT'];
  faultNames.forEach((fault, index) => {
    const rootName = Compiler.ROOT_PREFIX + 'fault-' + index;
    expectThrow(() => Compiler.emit(input, { allowedParent: tempParent, rootName, faultAt: fault }), /bounded injected/, fault + ' is contained');
    ok(!fs.existsSync(path.join(tempParent, rootName)), fault + ' cleans only its owned root');
  });

  expectThrow(() => Compiler.emit(input, { allowedParent: tempParent, rootName: '../escape', faultAt: null }), /fixed schema prefix/, 'path traversal root is rejected');
  expectThrow(() => Compiler.emit(input, { allowedParent: tempParent, rootName: 'axm-fabric-creation-pilot-wrong', faultAt: null }), /fixed schema prefix/, 'non-schema pilot prefix is rejected');

  const existingName = Compiler.ROOT_PREFIX + 'existing';
  fs.mkdirSync(path.join(tempParent, existingName));
  expectThrow(() => Compiler.emit(input, { allowedParent: tempParent, rootName: existingName, faultAt: null }), /must not already exist/, 'existing output root is never overwritten');
  fs.rmdirSync(path.join(tempParent, existingName));

  if (process.platform === 'win32') {
    const alias = tempParent[0].toLowerCase() + tempParent.slice(1);
    expectThrow(() => Compiler.emit(input, { allowedParent: alias, rootName: Compiler.ROOT_PREFIX + 'alias', faultAt: null }), /canonical.*Windows drive/, 'Windows drive-letter alias is rejected');
  } else {
    ok(true, 'Windows drive-letter alias test is not applicable on this host');
  }

  const rootA = Compiler.ROOT_PREFIX + 'determinism-a';
  const rootB = Compiler.ROOT_PREFIX + 'determinism-b';
  Compiler.emit(input, { allowedParent: tempParent, rootName: rootA, faultAt: null });
  Compiler.emit(input, { allowedParent: tempParent, rootName: rootB, faultAt: null });
  const expectedFiles = [Compiler.INPUT_SCHEMA_FILE, Compiler.MATRIX_FILE, Compiler.OUTPUT_SCHEMA_FILE, Compiler.RECEIPT_FILE].sort();
  const filesA = fs.readdirSync(path.join(tempParent, rootA)).sort();
  const filesB = fs.readdirSync(path.join(tempParent, rootB)).sort();
  ok(same(filesA, expectedFiles), 'successful emit writes only the four owned JSON files');
  ok(same(filesB, expectedFiles), 'second emit writes only the four owned JSON files');
  expectedFiles.forEach((file) => ok(
    fs.readFileSync(path.join(tempParent, rootA, file)).equals(fs.readFileSync(path.join(tempParent, rootB, file))),
    file + ' is byte-identical across roots'
  ));

  [rootA, rootB].forEach((rootName) => {
    expectedFiles.forEach((file) => fs.unlinkSync(path.join(tempParent, rootName, file)));
    fs.rmdirSync(path.join(tempParent, rootName));
  });
} finally {
  const leftovers = fs.readdirSync(tempParent);
  if (leftovers.length) throw new Error('selftest refused broad cleanup because temporary parent was not empty: ' + leftovers.join(', '));
  fs.rmdirSync(tempParent);
}

console.log('Code Capability Fabric blueprint schema compiler selftest: ' + passed + ' checks passed.');
