#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Ledger = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');
const LedgerFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/selftest-fixture');
const History = require('../model-shadow-two-phase-history-checkpoint/model-shadow-two-phase-history-checkpoint');
const Anchor = require('./model-shadow-history-checkpoint-anchor');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(action, pattern, label) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught, label + ' should throw');
  if (pattern) assert.match(caught.message, pattern, label + ' message');
  checks += pattern ? 2 : 1;
  console.log('PASS ' + label);
}
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function publicKeyPem(pair) { return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(); }
function sign(value, privateKey, payloadBuilder) {
  const result = copy(value);
  result.signature = crypto.sign(null, Buffer.from(payloadBuilder(result), 'utf8'), privateKey).toString('base64');
  return result;
}
function digest(label) { return Anchor.sha256('synthetic-v2.2-declared-principal:' + label); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function recordPackage(proposalInput, proposalResult, settlementInput, settlementResult) {
  return {
    proposal: { input: copy(proposalInput), evidence: copy(proposalResult.prewriteEvidence), receipt: copy(proposalResult.proposal) },
    settlement: { input: copy(settlementInput), evidence: copy(settlementResult.postwriteEvidence), receipt: copy(settlementResult.settlement) }
  };
}
function writePackage(parent, name, value) {
  const target = path.join(parent, name + '.json');
  fs.writeFileSync(target, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return target;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  return { status: result.status, value: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

function buildPackage(checkpoint, tag, options) {
  const settings = options || {};
  const witnessPairs = settings.witnessPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const anchorPairs = settings.anchorPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const witnessPrincipals = settings.witnessPrincipals || [digest(tag + ':witness:1'), digest(tag + ':witness:2')];
  const anchorPrincipals = settings.anchorPrincipals || [digest(tag + ':anchor:1'), digest(tag + ':anchor:2')];
  const witnessPolicy = {
    schema: Anchor.WITNESS_POLICY_SCHEMA,
    policyId: 'history-checkpoint-witness-policy:' + tag,
    issuedAt: '2026-08-20T15:36:10.000Z',
    expiresAt: '2026-08-20T16:10:00.000Z',
    audience: Anchor.WITNESS_AUDIENCE,
    scope: Anchor.WITNESS_SCOPE,
    authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    checkpointRef: { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest },
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 3600,
    keys: witnessPairs.map((pair, index) => ({
      keyId: 'history-checkpoint-witness-key:' + tag + ':' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      actorDigest: witnessPrincipals[index],
      actorKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.WITNESS_SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(witnessPolicy);
  const signedAttestations = witnessPairs.map((pair, index) => sign({
    schema: Anchor.WITNESS_ATTESTATION_SCHEMA,
    attestationId: 'history-checkpoint-attestation:' + tag + ':' + (index + 1),
    keyId: witnessPolicy.keys[index].keyId,
    actorDigest: witnessPolicy.keys[index].actorDigest,
    actorKind: witnessPolicy.keys[index].actorKind,
    verdict: 'WITNESS',
    scope: Anchor.WITNESS_SCOPE,
    policyDigest: witnessPolicy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    issuedAt: '2026-08-20T15:36:20.000Z',
    expiresAt: '2026-08-20T16:00:00.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair.privateKey, Anchor.witnessSigningPayload));
  const witnessInput = {
    witnessId: 'history-checkpoint-witness:' + tag,
    verifiedAt: '2026-08-20T15:36:30.000Z',
    checkpoint: copy(checkpoint),
    witnessPolicy,
    signedAttestations
  };
  const witnessReceipt = Anchor.buildWitness(witnessInput);
  const anchorPolicy = {
    schema: Anchor.ANCHOR_POLICY_SCHEMA,
    policyId: 'history-checkpoint-anchor-policy:' + tag,
    anchorId: 'history-checkpoint-anchor:' + tag,
    anchorEpoch: 1,
    issuedAt: '2026-08-20T15:36:31.000Z',
    expiresAt: '2026-08-20T16:20:00.000Z',
    status: Anchor.STATUS,
    audience: Anchor.ANCHOR_AUDIENCE,
    scope: Anchor.ANCHOR_SCOPE,
    authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 3600,
    keys: anchorPairs.map((pair, index) => ({
      keyId: 'history-checkpoint-anchor-key:' + tag + ':' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      stewardDigest: anchorPrincipals[index],
      stewardKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.ANCHOR_SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  anchorPolicy.policyDigest = Anchor.anchorPolicyDigest(anchorPolicy);
  const expectedAnchorDigest = Anchor.sha256(Anchor.anchorCommitment(witnessReceipt, anchorPolicy));
  const policyAuthorizations = anchorPairs.map((pair, index) => sign({
    schema: Anchor.ANCHOR_AUTHORIZATION_SCHEMA,
    authorizationId: 'history-checkpoint-anchor-authorization:' + tag + ':' + (index + 1),
    keyId: anchorPolicy.keys[index].keyId,
    stewardDigest: anchorPolicy.keys[index].stewardDigest,
    stewardKind: anchorPolicy.keys[index].stewardKind,
    verdict: 'AUTHORIZE',
    scope: Anchor.ANCHOR_SCOPE,
    policyDigest: anchorPolicy.policyDigest,
    expectedAnchorDigest,
    checkpointDigest: witnessReceipt.checkpointRef.sha256,
    witnessDigest: witnessReceipt.witnessDigest,
    witnessPolicyDigest: witnessReceipt.witnessPolicyRef.sha256,
    witnessKeyFingerprintSetDigest: witnessReceipt.signatureEvidence.keyFingerprintSetDigest,
    witnessDeclaredPrincipalSetDigest: witnessReceipt.signatureEvidence.declaredPrincipalSetDigest,
    issuedAt: '2026-08-20T15:36:40.000Z',
    expiresAt: '2026-08-20T16:10:00.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair.privateKey, Anchor.anchorAuthorizationPayload));
  const anchoredInput = {
    receiptId: 'history-checkpoint-anchored:' + tag,
    verifiedAt: '2026-08-20T15:36:50.000Z',
    expectedAnchorDigest,
    witnessInput,
    witnessReceipt,
    anchorPolicy,
    policyAuthorizations
  };
  return {
    witnessPairs, anchorPairs, witnessPrincipals, anchorPrincipals,
    witnessInput, witnessReceipt, anchorPolicy, expectedAnchorDigest, policyAuthorizations,
    anchoredInput, anchoredReceipt: Anchor.buildAnchoredCheckpoint(anchoredInput)
  };
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v22-anchor-'));
  try {
    const scenario = LedgerFixture.buildScenario(tempRoot);
    const ledgerRoot = makeDir(tempRoot, 'ledger');
    const genesisRef = LedgerFixture.separatedRef(scenario.baseChain);
    const options = LedgerFixture.serviceOptions(scenario.state, scenario.sourceRoot, ledgerRoot, 'v22-anchor-ledger', genesisRef);
    const service = Ledger.createService(copy(options));
    const proposalInput = LedgerFixture.proposalInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'v22-anchor');
    const proposal = service.propose(proposalInput);
    const settlementInput = LedgerFixture.settlementInput(proposalInput, proposal, 'v22-anchor');
    const settlement = service.settle(settlementInput);
    const records = [recordPackage(proposalInput, proposal, settlementInput, settlement)];
    const checkpointInput = { checkpointId: 'history-checkpoint:v22-base', checkpointedAt: '2026-08-20T15:36:00.000Z', serviceOptions: copy(options), records: copy(records) };
    const checkpoint = History.createCheckpoint(checkpointInput);

    equal(Anchor.VERSION, '2.2.0', 'version is exact');
    equal(Anchor.STATUS, 'TEST', 'status remains TEST');
    equal(Anchor.MAX_SEATS, 10, 'seat bound is exact');
    equal(History.validateCheckpoint(checkpoint), checkpoint, 'v2.1 checkpoint self-validates before witnessing');

    const base = buildPackage(checkpoint, 'base');
    equal(Anchor.verifyWitness(base.witnessInput, base.witnessReceipt).pass, true, 'witness exact-rebuilds');
    equal(Anchor.verifyAnchoredCheckpoint(base.anchoredInput, base.anchoredReceipt).pass, true, 'anchored checkpoint exact-rebuilds');
    equal(base.anchoredReceipt.checkpointRef.sha256, checkpoint.checkpointDigest, 'anchor binds exact v2.1 checkpoint');
    equal(base.anchoredReceipt.witnessRef.sha256, base.witnessReceipt.witnessDigest, 'anchor binds exact witness');
    equal(base.anchoredReceipt.witnessPolicyRef.sha256, base.witnessInput.witnessPolicy.policyDigest, 'anchor binds exact witness policy');
    equal(base.anchoredReceipt.anchorPolicyRef.sha256, base.anchorPolicy.policyDigest, 'anchor binds exact anchor policy');
    equal(base.anchoredReceipt.anchorRef.sha256, base.expectedAnchorDigest, 'expected anchor digest exactly matches commitment');
    equal(base.anchoredReceipt.separationEvidence.sharedKeyFingerprintCount, 0, 'no shared verified key fingerprint observed');
    equal(base.anchoredReceipt.separationEvidence.sharedDeclaredPrincipalDigestCount, 0, 'no shared verified declared principal digest observed');
    equal(base.anchoredReceipt.truth.realWorldControllerIndependenceProven, false, 'cryptographic separation does not prove controller independence');
    equal(base.anchoredReceipt.truth.sameControllerWithDistinctKeysAndDigestsStillPossible, true, 'same-controller counterexample remains explicit');
    equal(base.anchoredReceipt.truth.jointCheckpointPoliciesSignaturesAndExpectedAnchorReplacementStillPossible, true, 'joint replacement counterexample remains explicit');
    equal(base.anchoredReceipt.truth.actualHumanParticipationProven, false, 'declared human kind proves no human participation');
    equal(base.anchoredReceipt.truth.expectedAnchorDigestAuthorityAuthenticated, false, 'expected anchor origin is not authenticated');
    equal(
      base.anchoredReceipt.truth.checkpointOriginAuthenticated || base.anchoredReceipt.truth.hostAuthorizationAuthenticated || base.anchoredReceipt.truth.providerInvoked,
      false,
      'anchored receipt proves no checkpoint origin host authority or provider invocation'
    );
    equal(base.anchoredReceipt.truth.executionAuthorized, false, 'anchored receipt grants no execution authority');
    equal(base.anchoredReceipt.truth.automaticCanon, false, 'anchored receipt grants no CANON status');

    const auditInput = {
      auditId: 'history-checkpoint-anchored-audit:exact',
      auditedAt: '2026-08-20T15:37:00.000Z',
      anchoredInput: copy(base.anchoredInput),
      anchoredReceipt: copy(base.anchoredReceipt),
      current: { serviceOptions: copy(options), records: copy(records) }
    };
    const audit = Anchor.buildAnchoredAudit(auditInput);
    equal(audit.classification, 'EXACT_HISTORY_MATCH', 'anchored audit composes exact v2.1 classification');
    equal(audit.comparison.exactHistoryMatch, true, 'anchored audit retains exact comparison');
    equal(audit.decision.autonomousActionCount, 0, 'anchored audit authorizes no autonomous action');
    equal(audit.truth.upstreamV21AuditComposedUnchanged, true, 'anchored audit truth names unchanged v2.1 composition');
    equal(Anchor.verifyAnchoredAudit(auditInput, audit).pass, true, 'anchored audit exact-rebuilds');
    const oversizedReceipt = { schema: Anchor.WITNESS_SCHEMA, padding: 'x'.repeat(Anchor.MAX_RECEIPT_CANONICAL_BYTES + 1) };
    equal(Anchor.verifyWitness(base.witnessInput, oversizedReceipt).pass, false, 'oversized witness receipt fails before exact comparison');
    oversizedReceipt.schema = Anchor.ANCHORED_CHECKPOINT_SCHEMA;
    equal(Anchor.verifyAnchoredCheckpoint(base.anchoredInput, oversizedReceipt).pass, false, 'oversized anchored checkpoint receipt fails before exact comparison');
    oversizedReceipt.schema = Anchor.ANCHORED_AUDIT_SCHEMA;
    equal(Anchor.verifyAnchoredAudit(auditInput, oversizedReceipt).pass, false, 'oversized anchored audit receipt fails before exact comparison');
    const absentAuditInput = copy(auditInput);
    absentAuditInput.auditId = 'history-checkpoint-anchored-audit:absent';
    absentAuditInput.auditedAt = '2026-08-20T15:37:05.000Z';
    const absentRoot = makeDir(tempRoot, 'absent-ledger');
    absentAuditInput.current = {
      serviceOptions: Object.assign(copy(options), { stateRoot: absentRoot }),
      records: []
    };
    const absentAudit = Anchor.buildAnchoredAudit(absentAuditInput);
    equal(absentAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'anchored audit preserves v2.1 absence classification');
    equal(absentAudit.decision.holdRequired, true, 'anchored absence remains held for review');
    equal(absentAudit.truth.currentLedgerValidatedByV2Reload, false, 'absent audit claims no current-ledger validation');

    const witnessChild = runChild(writePackage(tempRoot, 'child-witness', { action: 'witness', input: base.witnessInput }));
    equal(witnessChild.status, 0, 'fresh process rebuilds witness');
    check(witnessChild.value.pid !== process.pid, 'witness rebuild uses distinct process');
    equal(witnessChild.value.result, base.witnessReceipt, 'fresh witness receipt is exact');
    const anchorChild = runChild(writePackage(tempRoot, 'child-anchor', { action: 'anchor', input: base.anchoredInput }));
    equal(anchorChild.status, 0, 'fresh process rebuilds anchored checkpoint');
    check(anchorChild.value.pid !== process.pid, 'anchor rebuild uses distinct process');
    equal(anchorChild.value.result, base.anchoredReceipt, 'fresh anchored checkpoint is exact');
    const auditChild = runChild(writePackage(tempRoot, 'child-audit', { action: 'audit', input: auditInput }));
    equal(auditChild.status, 0, 'fresh process rebuilds anchored audit');
    check(auditChild.value.pid !== process.pid, 'audit rebuild uses distinct process');
    equal(auditChild.value.result, audit, 'fresh anchored audit is exact');

    const wrongWitnessSignature = copy(base.witnessInput);
    wrongWitnessSignature.signedAttestations[0].signature = wrongWitnessSignature.signedAttestations[1].signature;
    equal(Anchor.verifyWitness(wrongWitnessSignature, base.witnessReceipt).pass, false, 'wrong witness signature fails closed');
    const witnessSubstitution = copy(base.anchoredInput);
    witnessSubstitution.witnessReceipt.witnessId += ':substituted';
    equal(Anchor.verifyAnchoredCheckpoint(witnessSubstitution, base.anchoredReceipt).pass, false, 'witness receipt substitution fails closed');
    const wrongAnchorSignature = copy(base.anchoredInput);
    wrongAnchorSignature.policyAuthorizations[0].signature = wrongAnchorSignature.policyAuthorizations[1].signature;
    equal(Anchor.verifyAnchoredCheckpoint(wrongAnchorSignature, base.anchoredReceipt).pass, false, 'wrong anchor signature fails closed');
    const wrongPin = copy(base.anchoredInput);
    wrongPin.expectedAnchorDigest = 'sha256:' + '0'.repeat(64);
    equal(Anchor.verifyAnchoredCheckpoint(wrongPin, base.anchoredReceipt).pass, false, 'wrong expected anchor digest fails closed');
    const tooFewWitnesses = copy(base.witnessInput);
    tooFewWitnesses.signedAttestations.pop();
    equal(Anchor.verifyWitness(tooFewWitnesses, base.witnessReceipt).pass, false, 'insufficient witness threshold fails closed');
    const tooFewAnchors = copy(base.anchoredInput);
    tooFewAnchors.policyAuthorizations.pop();
    equal(Anchor.verifyAnchoredCheckpoint(tooFewAnchors, base.anchoredReceipt).pass, false, 'insufficient anchor threshold fails closed');
    const expiredWitnessPolicy = copy(base.witnessInput);
    expiredWitnessPolicy.witnessPolicy.expiresAt = '2026-08-20T15:36:25.000Z';
    expiredWitnessPolicy.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(expiredWitnessPolicy.witnessPolicy);
    equal(Anchor.verifyWitness(expiredWitnessPolicy, base.witnessReceipt).pass, false, 'expired witness policy fails closed');
    const expiredAnchorPolicy = copy(base.anchoredInput);
    expiredAnchorPolicy.anchorPolicy.expiresAt = '2026-08-20T15:36:45.000Z';
    expiredAnchorPolicy.anchorPolicy.policyDigest = Anchor.anchorPolicyDigest(expiredAnchorPolicy.anchorPolicy);
    equal(Anchor.verifyAnchoredCheckpoint(expiredAnchorPolicy, base.anchoredReceipt).pass, false, 'expired anchor policy fails closed');

    const duplicateWitnessKey = copy(base.witnessInput);
    duplicateWitnessKey.witnessPolicy.keys[1].publicKeyPem = duplicateWitnessKey.witnessPolicy.keys[0].publicKeyPem;
    duplicateWitnessKey.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(duplicateWitnessKey.witnessPolicy);
    equal(Anchor.verifyWitness(duplicateWitnessKey, base.witnessReceipt).pass, false, 'duplicate witness fingerprint fails closed');
    const duplicateWitnessPrincipal = copy(base.witnessInput);
    duplicateWitnessPrincipal.witnessPolicy.keys[1].actorDigest = duplicateWitnessPrincipal.witnessPolicy.keys[0].actorDigest;
    duplicateWitnessPrincipal.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(duplicateWitnessPrincipal.witnessPolicy);
    equal(Anchor.verifyWitness(duplicateWitnessPrincipal, base.witnessReceipt).pass, false, 'duplicate witness principal fails closed');
    const privatePem = copy(base.witnessInput);
    privatePem.witnessPolicy.keys[0].publicKeyPem = base.witnessPairs[0].privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    privatePem.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(privatePem.witnessPolicy);
    equal(Anchor.verifyWitness(privatePem, base.witnessReceipt).pass, false, 'private-key PEM is rejected');

    const sharedKeyPackage = () => buildPackage(checkpoint, 'shared-key', {
      witnessPairs: base.witnessPairs,
      anchorPairs: base.witnessPairs
    });
    throws(sharedKeyPackage, /must not share a verified public key fingerprint/, 'cross-layer verified key reuse fails closed');
    const sharedPrincipalPackage = () => buildPackage(checkpoint, 'shared-principal', {
      anchorPrincipals: [digest('shared-principal:witness:1'), digest('shared-principal:witness:2')]
    });
    throws(sharedPrincipalPackage, /must not share a verified declared principal digest/, 'cross-layer declared principal reuse fails closed');

    const replacementCheckpoint = History.createCheckpoint({
      checkpointId: 'history-checkpoint:v22-joint-replacement',
      checkpointedAt: '2026-08-20T15:36:05.000Z',
      serviceOptions: copy(options),
      records: copy(records)
    });
    const replacement = buildPackage(replacementCheckpoint, 'joint-replacement');
    equal(Anchor.verifyAnchoredCheckpoint(replacement.anchoredInput, replacement.anchoredReceipt).pass, true, 'jointly replaced checkpoint policies keys signatures and anchor still pass relatively');
    check(replacement.anchoredReceipt.receiptDigest !== base.anchoredReceipt.receiptDigest, 'joint replacement yields a distinct valid receipt');
    equal(replacement.anchoredReceipt.truth.originalCheckpointContinuityProven, false, 'joint replacement proves no continuity with original');

    const publicReceipts = JSON.stringify([base.witnessReceipt, base.anchoredReceipt, audit]);
    equal(publicReceipts.includes('BEGIN PUBLIC KEY'), false, 'public receipts contain no raw public key');
    equal(publicReceipts.includes(base.policyAuthorizations[0].signature), false, 'public receipts contain no raw signature');
    equal(publicReceipts.includes(ledgerRoot), false, 'public receipts contain no state path');
    equal(publicReceipts.includes('PRIVATE KEY'), false, 'public receipts contain no private key material');

    ['witness-policy.schema.json', 'witness-attestation.schema.json', 'witness.schema.json', 'anchor-policy.schema.json',
      'anchor-authorization.schema.json', 'anchored-checkpoint.schema.json', 'anchored-audit.schema.json'].forEach(file => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      equal(schema.type, 'object', file + ' is an object schema');
      equal(schema.additionalProperties, false, file + ' closes unknown top-level fields');
    });
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(contract.version, 'v2.2', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status is TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.filter(value => value.startsWith('model.shadow.portable-history-checkpoint-anchor.')).length, 18, 'contract exposes exactly eighteen bounded capabilities');
    const runtimeSource = fs.readFileSync(path.join(__dirname, 'model-shadow-history-checkpoint-anchor.js'), 'utf8');
    equal(runtimeSource.includes('writeFile'), false, 'runtime contains no file-write operation');
    equal(runtimeSource.includes('mkdir'), false, 'runtime contains no directory-write operation');
    equal(runtimeSource.includes('fetch('), false, 'runtime contains no network fetch');
    equal(runtimeSource.includes("generateKeyPair"), false, 'runtime generates no keys');
    equal(runtimeSource.includes("createPrivateKey"), false, 'runtime ingests no private key API');
    check(runtimeSource.includes("require('../model-shadow-two-phase-history-checkpoint/"), 'runtime composes exact v2.1 module');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

main();
