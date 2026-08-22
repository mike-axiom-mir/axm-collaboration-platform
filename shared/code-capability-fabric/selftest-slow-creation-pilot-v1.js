#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Consent = require('./grounded-consent-scope-v1');
const Pilot = require('./slow-creation-pilot-v1');
const Cli = require('./slow-creation-pilot-cli');
const Nursery = require('../../tools/detached-candidate-nursery/core/nursery-core');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function rejects(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function clone(value) {
  return Pilot.clone(value);
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function localSchemaRefsResolve(file) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  function visit(value, root) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, root));
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) {
      const parts = value.$ref.slice(2).split('/').map((part) =>
        part.replace(/~1/g, '/').replace(/~0/g, '~'));
      let target = root;
      for (const part of parts) {
        if (!target || !Object.prototype.hasOwnProperty.call(target, part)) return false;
        target = target[part];
      }
    }
    return Object.values(value).every((item) => visit(item, root));
  }
  return visit(schema, schema);
}

function replaceInstance(input, mutate) {
  const changed = clone(input);
  const core = clone(changed.consentEvaluationInput.instance);
  delete core.instanceDigest;
  mutate(core);
  changed.consentEvaluationInput.instance = Consent.sealInstance(core);
  changed.consentEvaluation = Consent.evaluateGroundedConsent(changed.consentEvaluationInput);
  return changed;
}

const schemaFiles = [
  ['fabric-inert-creation-intent.schema.json', Pilot.INTENT_SCHEMA],
  ['fabric-inert-candidate-emitter-profile.schema.json', Pilot.PROFILE_SCHEMA],
  ['fabric-creation-pilot-receipt.schema.json', Pilot.RECEIPT_SCHEMA]
];
for (const [file, id] of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  check(schema.$id === id && schema.additionalProperties === false,
    file + ' binds its identity and closes top-level fields');
  check(schemaObjectNodesAreClosed(schema) && localSchemaRefsResolve(file),
    file + ' closes object records and resolves local references');
}

const contract = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'module-slow-creation-pilot-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' &&
  JSON.stringify(contract.permissions) === JSON.stringify(['candidate.output-write']),
'module remains TEST with only disposable candidate write permission');
check(contract.rootsGate.join('|') === Consent.ROOTS_GATE.join('|') &&
  contract.boundaries.refuses.includes('machine-wide-default-activation') &&
  contract.boundaries.refuses.includes('persistent-learning-admission'),
'module binds all four roots and refuses default activation and learning admission');

const source = fs.readFileSync(path.join(__dirname, 'slow-creation-pilot-v1.js'), 'utf8');
check(!/require\(['"](?:child_process|http|https|net|tls|dgram|vm|worker_threads)['"]\)/.test(source) &&
  !source.includes('process.env'),
'emitter source imports no process, execution, network, VM, worker, or environment authority');

const example = Pilot.buildExampleInput();
check(example.consentEvaluation.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' &&
  Pilot.prepare(example).intent.id === 'modular-capability-observation-card',
'example reaches only the explicit human-decision gate before host write authority');
check(Pilot.sha256(Pilot.PROFILE) === Pilot.profileRef().sha256,
'fixed emitter profile reference is byte-bound');

const builtA = Pilot.buildCandidateFiles(example.intent);
const builtB = Pilot.buildCandidateFiles(example.intent);
check(Pilot.canonicalJson(builtA.files.map((file) => ({
  path: file.path,
  sha256: Pilot.sha256(file.bytes),
  byteLength: file.bytes.length
}))) === Pilot.canonicalJson(builtB.files.map((file) => ({
  path: file.path,
  sha256: Pilot.sha256(file.bytes),
  byteLength: file.bytes.length
}))), 'fixed candidate bytes are deterministic');
check(JSON.stringify(builtA.files.map((file) => file.path)) ===
  JSON.stringify(Pilot.CANDIDATE_FILE_PATHS),
'candidate uses the exact portable six-file shape');
const html = builtA.files.find((file) => file.path === 'index.html').bytes.toString('utf8');
check(!/<script\b/i.test(html) && !/javascript:/i.test(html),
'fixed HTML candidate contains no script or javascript URL');

rejects(() => Pilot.prepare({ ...clone(example), unexpected: true }), /unsupported fields/,
  'unknown pilot input fields are rejected');
const wrongAck = clone(example);
wrongAck.authorization.acknowledgement = 'YES';
rejects(() => Pilot.prepare(wrongAck), /exact acknowledgement/,
  'ambiguous acknowledgement is rejected');
const declarationDrift = clone(example);
declarationDrift.authorization.instructionRef.sha256 = 'sha256:' + 'e'.repeat(64);
rejects(() => Pilot.prepare(declarationDrift), /does not bind the exact declaration/,
  'declaration digest drift is rejected');
const forgedEvaluation = clone(example);
forgedEvaluation.consentEvaluation.truth.hostAuthorizationGranted = true;
rejects(() => Pilot.prepare(forgedEvaluation), /truth ceiling|must remain false|digest mismatch/,
  'forged grounded-consent truth is rejected');
const intentDrift = clone(example);
const intentCore = clone(intentDrift.intent);
delete intentCore.intentDigest;
intentCore.purpose += ' Changed after consent.';
intentDrift.intent = Pilot.sealIntent(intentCore);
rejects(() => Pilot.prepare(intentDrift), /does not bind the exact creation intent/,
  'intent digest drift cannot reuse earlier consent');

const profileDrift = replaceInstance(example, (instance) => {
  instance.domainProfileRef.sha256 = 'sha256:' + 'f'.repeat(64);
});
rejects(() => Pilot.prepare(profileDrift), /hold-free|fixed emitter/,
  'emitter profile drift cannot borrow consent');
const widenedPermission = replaceInstance(example, (instance) => {
  instance.permissions = ['candidate.output-write', 'workspace.source-write'];
});
rejects(() => Pilot.prepare(widenedPermission), /hold-free|permission scope/,
  'permission widening is held by the policy intersection');
const networkRequest = replaceInstance(example, (instance) => {
  instance.networkDomains = ['example.test'];
});
rejects(() => Pilot.prepare(networkRequest), /hold-free|network/,
  'network widening is held by the policy intersection');
const sourceArtifact = replaceInstance(example, (instance) => {
  instance.inputArtifacts = [{
    id: 'source-content',
    schema: 'axm.code-source-artifact/v1',
    sha256: 'sha256:' + 'a'.repeat(64),
    byteLength: 12
  }];
});
rejects(() => Pilot.prepare(sourceArtifact), /cannot read input artifacts/,
  'source artifacts are refused even when within byte budget');
const expired = clone(example);
expired.consentEvaluationInput.evaluatedAt = '2026-08-24T00:00:00.000Z';
expired.consentEvaluation = Consent.evaluateGroundedConsent(expired.consentEvaluationInput);
rejects(() => Pilot.prepare(expired), /hold-free/,
  'stale declared consent window is held');

const parsedArgs = Cli.parseArguments([
  '--allowed-parent', 'absolute-parent-selected-by-host',
  '--root-name', 'axm-fabric-creation-pilot-example',
  '--acknowledge', Pilot.ACKNOWLEDGEMENT
]);
check(parsedArgs['--acknowledge'] === Pilot.ACKNOWLEDGEMENT,
'CLI requires the exact acknowledgement as a separate bounded input');
rejects(() => Cli.parseArguments(['--unknown', 'value']), /unsupported/,
  'CLI rejects unknown authority-bearing arguments');

const temporaryBase = fs.realpathSync(os.tmpdir());
const temporaryParent = fs.mkdtempSync(path.join(temporaryBase, 'axm-slow-create-selftest-'));
const cleanupParent = () => {
  const resolved = fs.realpathSync(temporaryParent);
  if (path.dirname(resolved) !== temporaryBase ||
    !path.basename(resolved).startsWith('axm-slow-create-selftest-')) {
    throw new Error('selftest cleanup boundary refused');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
};

try {
  const successName = 'axm-fabric-creation-pilot-selftest-success';
  const receipt = Pilot.emit(example, {
    allowedParent: temporaryParent,
    rootName: successName,
    faultAt: null
  });
  const successRoot = path.join(temporaryParent, successName);
  const candidateRoot = path.join(successRoot, example.intent.id);
  check(fs.existsSync(path.join(successRoot, 'pilot-receipt.json')) &&
    fs.readdirSync(candidateRoot).sort().join('|') === Pilot.CANDIDATE_FILE_PATHS.slice().sort().join('|'),
  'one successful attempt retains only its candidate and path-free pilot receipt');
  check(Pilot.normalizeReceipt(receipt).receiptDigest === receipt.receiptDigest &&
    receipt.truth.candidateCodeExecuted === false &&
    receipt.truth.machineDefaultActivated === false &&
    receipt.truth.persistentLearningAdmitted === false &&
    receipt.truth.interactiveDeclarationReplayPrevented === false,
  'receipt verifies while execution, machine default, and learning remain false');
  const nursery = Nursery.inspectCandidate(candidateRoot, example.intent.id);
  check(nursery.status === 'READY_FOR_LATER_INTAKE' && nursery.errors.length === 0 &&
    nursery.truth.codeExecuted === false,
  'Detached Candidate Nursery independently accepts structure without execution');

  const tamperedReceipt = clone(receipt);
  tamperedReceipt.candidateFiles[0].path = 'replacement.txt';
  rejects(() => Pilot.normalizeReceipt(tamperedReceipt), /fixed exact set|digest mismatch/,
    'receipt cannot substitute another six-file shape');
  const ambiguousVersion = clone(receipt);
  ambiguousVersion.candidate.version = 'v0.2';
  rejects(() => Pilot.normalizeReceipt(ambiguousVersion), /version mismatch/,
    'candidate version ambiguity is rejected');
  const digestDrift = clone(receipt);
  digestDrift.candidateFiles[0].sha256 = 'sha256:' + '0'.repeat(64);
  rejects(() => Pilot.normalizeReceipt(digestDrift), /digest mismatch/,
    'candidate byte-lineage digest drift is rejected');
  const overBudgetReceipt = clone(receipt);
  const previousFirstLength = overBudgetReceipt.candidateFiles[0].byteLength;
  overBudgetReceipt.candidateFiles[0].byteLength = Pilot.MAX_OUTPUT_BYTES;
  overBudgetReceipt.resourceObservation.candidateBytes +=
    Pilot.MAX_OUTPUT_BYTES - previousFirstLength;
  rejects(() => Pilot.normalizeReceipt(overBudgetReceipt), /exceed the fixed ceiling/,
    'receipt normalizer rejects resource observations beyond the fixed byte ceiling');

  const existingName = 'axm-fabric-creation-pilot-existing';
  fs.mkdirSync(path.join(temporaryParent, existingName));
  rejects(() => Pilot.emit(example, {
    allowedParent: temporaryParent,
    rootName: existingName,
    faultAt: null
  }), /must not already exist/, 'existing output roots are never overwritten');
  rejects(() => Pilot.validateNewRoot(temporaryParent, 'nested/root'), /fixed pilot prefix/,
    'nested or non-prefixed output names are rejected');
  rejects(() => Pilot.validateNewRoot(temporaryParent + path.sep + '.',
    'axm-fabric-creation-pilot-alias'), /canonical path/,
  'dot-segment parent aliases are rejected at the path boundary');

  const faultName = 'axm-fabric-creation-pilot-selftest-fault';
  rejects(() => Pilot.emit(example, {
    allowedParent: temporaryParent,
    rootName: faultName,
    faultAt: 'AFTER_FIRST_FILE'
  }), /bounded injected/, 'bounded fault injection aborts the attempt');
  check(!fs.existsSync(path.join(temporaryParent, faultName)),
    'failed attempt removes only its newly owned root');

  const oneByteBudget = replaceInstance(example, (instance) => {
    instance.resources.maxOutputBytes = 1;
  });
  const budgetName = 'axm-fabric-creation-pilot-selftest-budget';
  rejects(() => Pilot.emit(oneByteBudget, {
    allowedParent: temporaryParent,
    rootName: budgetName,
    faultAt: null
  }), /exceed consented output budget/, 'actual candidate bytes enforce the consented output budget');
  check(!fs.existsSync(path.join(temporaryParent, budgetName)),
    'budget refusal occurs before an output root is created');
} finally {
  cleanupParent();
}

process.stdout.write('Slow-creation pilot selftest: ' + checks + ' checks passed.\n');
