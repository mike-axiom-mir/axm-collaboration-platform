#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('./semantic-candidate-materializer-v1');
const Semantic = require('./semantic-candidate-generator-v1');
const Readiness = require('./code-capability-readiness-v1');
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
  return JSON.parse(JSON.stringify(value));
}

function keyRecord(id, pair) {
  return {
    schema: 'axm.code-trust-key/v1',
    id,
    algorithm: 'Ed25519',
    publicKeySpkiDerBase64: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  };
}

function signDecision(unsigned, privateKey) {
  return M.attachDecisionSignature(
    unsigned,
    crypto.sign(null, M.buildDecisionSignaturePayload(unsigned), privateKey).toString('base64')
  );
}

function signRevocation(unsigned, privateKey) {
  return M.attachRevocationSignature(
    unsigned,
    crypto.sign(null, M.buildRevocationSignaturePayload(unsigned), privateKey).toString('base64')
  );
}

function resealDecision(value, privateKey) {
  const unsigned = clone(value);
  delete unsigned.signatureBase64;
  delete unsigned.decisionDigest;
  unsigned.decisionDigest = M.sha256Value(unsigned);
  return signDecision(unsigned, privateKey);
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function schemaRefsResolve(file) {
  const cache = new Map();
  function read(name) {
    if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')));
    return cache.get(name);
  }
  function visit(value, current, seen) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, current, seen));
    if (typeof value.$ref === 'string') {
      const [targetFile, fragment] = value.$ref.split('#');
      if (/^[a-z]+:/i.test(targetFile || '')) return true;
      const targetName = targetFile || current;
      const key = targetName + '#' + (fragment || '');
      if (!seen.has(key)) {
        const target = read(targetName);
        let cursor = target;
        if (fragment) {
          const parts = fragment.replace(/^\//, '').split('/').filter(Boolean);
          for (const part of parts) cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
          if (cursor === undefined) return false;
        }
        const nextSeen = new Set(seen);
        nextSeen.add(key);
        if (!visit(cursor, targetName, nextSeen)) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current, seen));
  }
  return visit(read(file), file, new Set([file + '#']));
}

const schemaFiles = [
  ['human-decision-trust-policy.schema.json', M.TRUST_POLICY_SCHEMA],
  ['semantic-candidate-materialization-subject.schema.json', M.SUBJECT_SCHEMA],
  ['authenticated-human-decision.schema.json', M.DECISION_SCHEMA],
  ['human-decision-revocation-snapshot.schema.json', M.REVOCATION_SCHEMA],
  ['authenticated-human-decision-evaluation.schema.json', M.EVALUATION_SCHEMA],
  ['human-decision-replay-reservation.schema.json', M.RESERVATION_SCHEMA],
  ['semantic-candidate-materialization-receipt.schema.json', M.RECEIPT_SCHEMA]
];

for (const [file, id] of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  check(schema.$id === id && schema.additionalProperties === false, file + ' has the exact closed root contract');
  check(schemaObjectNodesAreClosed(schema), file + ' closes every typed object boundary');
  check(schemaRefsResolve(file), file + ' resolves every local schema reference');
}

const moduleContract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-semantic-candidate-materializer-v1.contract.json'), 'utf8'));
check(moduleContract.schema === 'axm.module-contract/v1' && moduleContract.status === 'TEST' &&
  moduleContract.permissions.join('|') === 'candidate.output-write|candidate.replay-ledger-reserve',
  'module contract declares only detached candidate and replay-reservation writes');
check(['candidate-code-execution', 'existing-root-overwrite', 'installation', 'integration', 'persistent-learning-admission', 'promotion', 'canon-change']
  .every((item) => moduleContract.boundaries.refuses.includes(item)),
  'module contract refuses execution, overwrite, lifecycle, learning, promotion, and CANON effects');

const source = fs.readFileSync(path.join(__dirname, 'semantic-candidate-materializer-v1.js'), 'utf8');
check(!/child_process|\bexecSync\b|\bspawnSync\b|\bfetch\s*\(|\beval\s*\(|new\s+Function|process\.env|http\.request|https\.request/.test(source),
  'materializer source has no process, provider, dynamic-code, environment, or network hand');
check(source.includes("flag: 'wx'") && source.includes('Nursery.inspectCandidate') && source.includes('fs.realpathSync'),
  'source exposes exclusive writes, canonical path checks, and Nursery inspection');
check(M.LIMITATIONS.includes('REPLAY_PREVENTION_IS_SCOPED_TO_ONE_HOST_BOUND_NURSERY_LEDGER') &&
  M.LIMITATIONS.includes('BOUNDED_PROGRAM_TO_SEMANTIC_REQUEST_BRIDGE_NOT_IMPLEMENTED'),
  'cross-nursery replay and v0.8-to-semantic bridging remain explicit gaps');

const decisionPair = crypto.generateKeyPairSync('ed25519');
const revocationPair = crypto.generateKeyPairSync('ed25519');
const wrongPair = crypto.generateKeyPairSync('ed25519');
const policy = M.buildExampleTrustPolicy(
  keyRecord('mike-tier1-decision-key', decisionPair),
  keyRecord('host-tier1-revocation-key', revocationPair)
);
const request = Semantic.buildExampleRequest();
const prepared = M.prepare(request, policy);

check(M.normalizeTrustPolicy(policy).policyDigest === policy.policyDigest &&
  !sameKey(policy.decisionKey, policy.revocationKey),
  'trust policy seals independent decision and revocation keys');
check(prepared.packet.lane === 'NATIVE' && prepared.packet.reuseRights.state === 'RESEARCH_ONLY_HOLD' &&
  prepared.subject.status === 'PREPARED_FOR_HUMAN_DECISION',
  'preparation rebuilds one native research-held candidate without execution');
check(prepared.subject.resources.candidateFileCount === 7 &&
  prepared.files.map((file) => file.path).includes('module-bundle.json'),
  'prepared subject binds all six candidate files plus the exact module bundle');
check(prepared.subject.declaredAuthority.permissions.length === 0 &&
  prepared.subject.declaredAuthority.networkDomains.length === 0 &&
  prepared.subject.declaredAuthority.lifecycleEffects.length === 0,
  'prepared subject remains permissionless, networkless, and lifecycle-free');
check(prepared.subject.rootsGate.map((item) => item.root).join('|') === M.ROOTS.join('|') &&
  prepared.subject.rootsGate.every((item) => item.verdict === 'PASS'),
  'prepared subject binds four ordered PASS decisions');
check(M.prepare(request, policy).subject.subjectDigest === prepared.subject.subjectDigest,
  'identical preparation inputs produce an identical subject digest');

function sameKey(left, right) {
  return Readiness.buildTrustKeyRef(left).sha256 === Readiness.buildTrustKeyRef(right).sha256;
}

function decision(choice = 'AUTHORIZE', nonce = 'candidate-decision-001', issuedAt = '2026-08-23T08:10:00.000Z', expiresAt = '2026-08-23T08:40:00.000Z') {
  const unsigned = M.buildDecision({ subject: prepared.subject, trustPolicy: policy, choice, issuedAt, expiresAt, nonce });
  return signDecision(unsigned, decisionPair.privateKey);
}

function snapshot(overrides = {}) {
  const unsigned = M.buildRevocationSnapshot({
    trustPolicy: policy,
    observedAt: overrides.observedAt || '2026-08-23T08:19:00.000Z',
    expiresAt: overrides.expiresAt || '2026-08-23T08:24:00.000Z',
    revokedSeatIds: overrides.revokedSeatIds || [],
    revokedDecisionKeyDigests: overrides.revokedDecisionKeyDigests || [],
    revokedNonces: overrides.revokedNonces || [],
    revokedDecisionDigests: overrides.revokedDecisionDigests || []
  });
  return signRevocation(unsigned, overrides.privateKey || revocationPair.privateKey);
}

function evaluationInput(decisionValue = decision(), snapshotValue = snapshot(), evaluatedAt = '2026-08-23T08:20:00.000Z') {
  return { generationRequest: request, decision: decisionValue, trustPolicy: policy, revocationSnapshot: snapshotValue, evaluatedAt };
}

const authorizedDecision = decision();
const clearSnapshot = snapshot();
const readyInput = evaluationInput(authorizedDecision, clearSnapshot);
const ready = M.evaluateDecision(readyInput, { trustedPolicyDigest: policy.policyDigest });
check(ready.status === M.READY_STATUS && ready.holds.length === 0,
  'valid exact decision and revocation signatures reach replay reservation only');
check(ready.truth.decisionSignatureVerified && ready.truth.revocationSignatureVerified && ready.truth.revocationClear,
  'ready evaluation records exact signature and revocation proof');
check(!ready.truth.naturalPersonIdentityProven && !ready.truth.informedUnderstandingProven &&
  !ready.truth.hostClockIndependentlyTrusted && !ready.truth.candidateCodeExecuted,
  'authentication does not overclaim natural-person identity, understanding, trusted time, or execution');
check(M.verifyDecisionEvaluation(ready, readyInput, { trustedPolicyDigest: policy.policyDigest }).pass,
  'ready evaluation verifies against deterministic regeneration');
const forgedEvaluationStatus = clone(ready);
delete forgedEvaluationStatus.evaluationDigest;
forgedEvaluationStatus.status = 'READY_FOR_INSTALLATION';
forgedEvaluationStatus.evaluationDigest = M.sha256Value(forgedEvaluationStatus);
rejects(() => M.normalizeEvaluation(forgedEvaluationStatus), /status is unsupported/,
  're-digested unknown evaluation statuses are rejected');

const wrongPolicyDigest = M.sha256Value({ wrong: 'policy' });
check(M.evaluateDecision(readyInput, { trustedPolicyDigest: wrongPolicyDigest }).status === 'TRUST_POLICY_HOLD',
  'caller cannot substitute an unselected self-signed trust policy');

const wrongSignatureUnsigned = M.buildDecision({
  subject: prepared.subject, trustPolicy: policy, choice: 'AUTHORIZE',
  issuedAt: '2026-08-23T08:10:00.000Z', expiresAt: '2026-08-23T08:40:00.000Z', nonce: 'wrong-signature-001'
});
const wrongSignature = signDecision(wrongSignatureUnsigned, wrongPair.privateKey);
check(M.evaluateDecision(evaluationInput(wrongSignature), { trustedPolicyDigest: policy.policyDigest }).status === 'SIGNATURE_HOLD',
  'a valid signature from the wrong key fails closed');

const forgedCandidate = clone(authorizedDecision);
forgedCandidate.candidateRef.sha256 = M.sha256Value({ forged: 'candidate' });
const forgedCandidateSigned = resealDecision(forgedCandidate, decisionPair.privateKey);
check(M.evaluateDecision(evaluationInput(forgedCandidateSigned), { trustedPolicyDigest: policy.policyDigest }).status === 'SUBJECT_HOLD',
  're-digested and correctly signed candidate-byte substitution is rejected');

const forgedSubject = clone(authorizedDecision);
forgedSubject.subjectRef.sha256 = M.sha256Value({ forged: 'subject' });
const forgedSubjectSigned = resealDecision(forgedSubject, decisionPair.privateKey);
check(M.evaluateDecision(evaluationInput(forgedSubjectSigned), { trustedPolicyDigest: policy.policyDigest }).status === 'SUBJECT_HOLD',
  're-digested and correctly signed subject substitution is rejected');

const driftedRoots = clone(authorizedDecision);
driftedRoots.rootsGate[0].evidenceRefs[0].sha256 = M.sha256Value({ changed: 'root-evidence' });
const driftedRootsSigned = resealDecision(driftedRoots, decisionPair.privateKey);
check(M.evaluateDecision(evaluationInput(driftedRootsSigned), { trustedPolicyDigest: policy.policyDigest }).status === 'ROOTS_HOLD',
  'changed root evidence requires a new signed subject and decision');

check(M.evaluateDecision(evaluationInput(decision('HOLD', 'human-hold-001')), { trustedPolicyDigest: policy.policyDigest }).status === 'HUMAN_HOLD',
  'a signed human HOLD cannot be clicked into authorization');
check(M.evaluateDecision(evaluationInput(decision('REJECT', 'human-reject-001')), { trustedPolicyDigest: policy.policyDigest }).status === 'HUMAN_REJECTED',
  'a signed human rejection stops materialization');
check(M.evaluateDecision(evaluationInput(decision('AUTHORIZE', 'expired-001', '2026-08-23T08:00:00.000Z', '2026-08-23T08:10:00.000Z')),
  { trustedPolicyDigest: policy.policyDigest }).status === 'TIME_HOLD',
  'expired exact decisions fail closed');
check(M.evaluateDecision(evaluationInput(decision('AUTHORIZE', 'future-001', '2026-08-23T08:30:00.000Z', '2026-08-23T08:40:00.000Z')),
  { trustedPolicyDigest: policy.policyDigest }).status === 'TIME_HOLD',
  'future-issued decisions fail closed');
rejects(() => decision('AUTHORIZE', 'too-long-001', '2026-08-23T08:10:00.000Z', '2026-08-23T10:10:00.000Z'), /window exceeds policy/,
  'decision windows cannot exceed the trust-policy maximum');

check(M.evaluateDecision(evaluationInput(authorizedDecision, snapshot({ observedAt: '2026-08-23T08:00:00.000Z', expiresAt: '2026-08-23T08:30:00.000Z' })),
  { trustedPolicyDigest: policy.policyDigest }).status === 'REVOCATION_HOLD',
  'stale signed revocation snapshots fail closed');
check(M.evaluateDecision(evaluationInput(authorizedDecision, snapshot({ privateKey: wrongPair.privateKey })),
  { trustedPolicyDigest: policy.policyDigest }).status === 'REVOCATION_HOLD',
  'revocation snapshots signed by the wrong key fail closed');
check(M.evaluateDecision(evaluationInput(authorizedDecision, snapshot({ revokedSeatIds: [policy.seatRef.id] })),
  { trustedPolicyDigest: policy.policyDigest }).status === 'REVOKED',
  'revoked review seats fail closed');
check(M.evaluateDecision(evaluationInput(authorizedDecision, snapshot({
  revokedDecisionKeyDigests: [Readiness.buildTrustKeyRef(policy.decisionKey).sha256]
})), { trustedPolicyDigest: policy.policyDigest }).status === 'REVOKED',
  'revoked decision keys fail closed');
check(M.evaluateDecision(evaluationInput(authorizedDecision, snapshot({ revokedNonces: [authorizedDecision.nonce] })),
  { trustedPolicyDigest: policy.policyDigest }).status === 'REVOKED',
  'revoked nonces fail closed');
check(M.evaluateDecision(evaluationInput(authorizedDecision, snapshot({ revokedDecisionDigests: [authorizedDecision.decisionDigest] })),
  { trustedPolicyDigest: policy.policyDigest }).status === 'REVOKED',
  'revoked decision digests fail closed');

const weakPolicyCore = clone(policy);
delete weakPolicyCore.policyDigest;
weakPolicyCore.decisionKey = clone(weakPolicyCore.revocationKey);
rejects(() => M.sealTrustPolicy(weakPolicyCore), /independent/, 'one key cannot serve as both decision and revocation authority');
const permissivePolicyCore = clone(policy);
delete permissivePolicyCore.policyDigest;
permissivePolicyCore.allowedPermissions = ['workspace.write'];
rejects(() => M.sealTrustPolicy(permissivePolicyCore), /permissionless/, 'Tier 1 policy cannot add workspace permissions');
const learningPolicyCore = clone(policy);
delete learningPolicyCore.policyDigest;
learningPolicyCore.lifecycle.learn = true;
rejects(() => M.sealTrustPolicy(learningPolicyCore), /must remain false/, 'Tier 1 policy cannot inherit learning authority');

const tempBase = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'axm-materializer-v09-selftest-'));
const protectedRoot = path.join(tempBase, 'protected-source');
fs.mkdirSync(protectedRoot);

function newNursery(name, withLedger = true) {
  const parent = path.join(tempBase, name);
  fs.mkdirSync(parent);
  if (withLedger) fs.mkdirSync(path.join(parent, M.LEDGER_DIRECTORY));
  return fs.realpathSync(parent);
}

function options(parent, faultAt = null, rootName = prepared.subject.candidateRootName, protectedRoots = [fs.realpathSync(protectedRoot)]) {
  return { allowedParent: parent, rootName, protectedRoots, trustedPolicyDigest: policy.policyDigest, faultAt };
}

function cleanup() {
  const real = fs.realpathSync(tempBase);
  const temp = fs.realpathSync(os.tmpdir());
  if (path.dirname(real) !== temp || !path.basename(real).startsWith('axm-materializer-v09-selftest-')) {
    throw new Error('selftest cleanup boundary refused');
  }
  fs.rmSync(real, { recursive: true, force: true });
}

try {
  const successParent = newNursery('success-nursery');
  const successOptions = options(successParent);
  const receipt = M.materialize(readyInput, successOptions);
  const outerRoot = path.join(successParent, prepared.subject.candidateRootName);
  const candidateRoot = path.join(outerRoot, prepared.packet.candidate.id);
  check(receipt.status === 'DETACHED_CANDIDATE_WRITTEN_FOR_REVIEW' &&
    fs.existsSync(path.join(outerRoot, 'materialization-receipt.json')),
  'valid signed decision materializes one retained detached candidate and receipt');
  check(fs.readdirSync(candidateRoot).sort().join('|') === prepared.files.map((file) => file.path).sort().join('|'),
    'materialized candidate contains the exact seven byte-bound files');
  check(Nursery.inspectCandidate(candidateRoot, prepared.packet.candidate.id).status === 'READY_FOR_LATER_INTAKE',
    'Detached Candidate Nursery independently accepts static structure without execution');
  check(M.verifyMaterialization(receipt, readyInput, successOptions).pass,
    'materialization verifies from candidate bytes, signed decision, reservation, and Nursery evidence');
  check(receipt.resourceObservation.candidateBytes === prepared.subject.resources.candidateBytes &&
    receipt.resourceObservation.totalWrittenBytes === receipt.resourceObservation.candidateBytes + receipt.resourceObservation.evidenceBytes,
    'receipt measures candidate, replay, receipt, and complete written-byte totals');
  check(!receipt.truth.candidateCodeExecuted && !receipt.truth.installed && !receipt.truth.integrated &&
    !receipt.truth.persistentLearningAdmitted && !receipt.truth.promoted && !receipt.truth.canonChanged,
    'materialization grants no execution, install, integration, learning, promotion, or CANON result');
  const ledgerFiles = fs.readdirSync(path.join(successParent, M.LEDGER_DIRECTORY));
  check(ledgerFiles.length === 1 && ledgerFiles[0].endsWith('.json'),
    'one exclusive hashed nonce reservation is retained in the host-bound ledger');
  const reservation = M.normalizeReservation(JSON.parse(fs.readFileSync(path.join(successParent, M.LEDGER_DIRECTORY, ledgerFiles[0]), 'utf8')));
  const durableText = JSON.stringify({ receipt, reservation });
  check(!durableText.includes(tempBase) && !durableText.includes(request.goal) && !durableText.includes('adapter.js source'),
    'durable receipts omit machine paths, raw goal text, and candidate source content');

  const originalAdapter = fs.readFileSync(path.join(candidateRoot, 'adapter.js'));
  fs.writeFileSync(path.join(candidateRoot, 'adapter.js'), Buffer.from('tampered candidate data\n', 'utf8'));
  check(!M.verifyMaterialization(receipt, readyInput, successOptions).pass,
    'post-write candidate byte drift invalidates materialization evidence');
  fs.writeFileSync(path.join(candidateRoot, 'adapter.js'), originalAdapter);

  const tamperedReceipt = clone(receipt);
  tamperedReceipt.truth.installed = true;
  rejects(() => M.normalizeReceipt(tamperedReceipt), /truth ceiling|resource observation/, 'receipt cannot be re-digested into an installation claim');
  const driftedReceipt = clone(receipt);
  driftedReceipt.candidateFiles[0].sha256 = M.sha256Value({ drift: true });
  rejects(() => M.normalizeReceipt(driftedReceipt), /digest mismatch|canonical|resource observation/, 'receipt cannot hide candidate digest drift');
  const contradictoryReceipt = clone(receipt);
  delete contradictoryReceipt.receiptDigest;
  contradictoryReceipt.candidateRef.id = contradictoryReceipt.candidateRef.id.slice(0, -1) + 'x';
  contradictoryReceipt.receiptDigest = M.sha256Value(contradictoryReceipt);
  rejects(() => M.normalizeReceipt(contradictoryReceipt), /identities conflict/,
    're-digested receipt cannot point at a different candidate identity');

  fs.rmSync(outerRoot, { recursive: true, force: true });
  rejects(() => M.materialize(readyInput, successOptions), /EEXIST|exist/i,
    'a consumed decision nonce cannot replay after the candidate is discarded');

  const existingParent = newNursery('existing-root-nursery');
  fs.mkdirSync(path.join(existingParent, prepared.subject.candidateRootName));
  rejects(() => M.materialize(readyInput, options(existingParent)), /must not already exist/,
    'existing candidate roots are never overwritten');
  check(fs.readdirSync(path.join(existingParent, M.LEDGER_DIRECTORY)).length === 0,
    'obvious output collision is rejected before consuming the nonce');

  const faultDecision = decision('AUTHORIZE', 'fault-decision-001');
  const faultInput = evaluationInput(faultDecision, snapshot());
  const faultParent = newNursery('fault-nursery');
  const faultOptions = options(faultParent, 'AFTER_FIRST_FILE');
  rejects(() => M.materialize(faultInput, faultOptions), /bounded materialization fault/,
    'bounded injected write failure aborts materialization');
  check(!fs.existsSync(path.join(faultParent, prepared.subject.candidateRootName)) &&
    fs.readdirSync(path.join(faultParent, M.LEDGER_DIRECTORY)).length === 1,
    'failed attempt cleans only its candidate root and retains spent-nonce evidence');
  rejects(() => M.materialize(faultInput, options(faultParent)), /EEXIST|exist/i,
    'a failed attempt cannot silently retry the same signed decision');

  const missingLedgerParent = newNursery('missing-ledger-nursery', false);
  rejects(() => M.materialize(readyInput, options(missingLedgerParent)), /replay ledger|ENOENT/,
    'host must provision the exact replay ledger before any write');
  rejects(() => M.materialize(readyInput, options(newNursery('wrong-name-nursery'), null, 'axm-semantic-candidate-wrong-000000000000')),
    /root name/, 'signed candidate root name cannot drift');

  const overlapParent = newNursery('overlap-nursery');
  rejects(() => M.materialize(readyInput, options(overlapParent, null, prepared.subject.candidateRootName, [overlapParent])),
    /overlaps/, 'candidate parent cannot overlap a protected source, workspace, or evidence root');
  rejects(() => M.materialize(readyInput, options(successParent + path.sep + '.')),
    /canonical/, 'dot-segment parent aliases are rejected');

  const junctionTarget = newNursery('junction-target');
  const junctionParent = path.join(tempBase, 'junction-parent');
  let junctionCreated = false;
  try {
    fs.symlinkSync(junctionTarget, junctionParent, 'junction');
    junctionCreated = true;
  } catch (_) {}
  if (junctionCreated) {
    rejects(() => M.materialize(readyInput, options(junctionParent)), /real directory|alias|junction/,
      'junction candidate parents are rejected');
  } else {
    check(true, 'junction candidate-parent check unavailable on this host and not claimed');
  }

  const ledgerJunctionParent = newNursery('ledger-junction-parent', false);
  const ledgerTarget = path.join(tempBase, 'ledger-target');
  fs.mkdirSync(ledgerTarget);
  let ledgerJunctionCreated = false;
  try {
    fs.symlinkSync(ledgerTarget, path.join(ledgerJunctionParent, M.LEDGER_DIRECTORY), 'junction');
    ledgerJunctionCreated = true;
  } catch (_) {}
  if (ledgerJunctionCreated) {
    rejects(() => M.materialize(readyInput, options(ledgerJunctionParent)), /real directory|alias|junction/,
      'junction replay ledgers are rejected');
  } else {
    check(true, 'junction replay-ledger check unavailable on this host and not claimed');
  }
} finally {
  cleanup();
}

process.stdout.write('SEMANTIC CANDIDATE MATERIALIZER SELFTEST PASS (' + checks + ' checks)\n');
