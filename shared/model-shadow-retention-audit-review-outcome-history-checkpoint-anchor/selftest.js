#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const OperationsUtils = require('../operations/operations-utils');
const Ledger = require('../model-shadow-retention-audit-review-outcome-ledger/model-shadow-retention-audit-review-outcome-ledger');
const Fixture = require('../model-shadow-retention-audit-review-outcome-ledger/selftest-fixture');
const History = require('../model-shadow-retention-audit-review-outcome-history-checkpoint/model-shadow-retention-audit-review-outcome-history-checkpoint');
const Anchor = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(operation, pattern, label) { assert.throws(operation, pattern, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function digest(label) { return 'sha256:' + crypto.createHash('sha256').update(label).digest('hex'); }
function makeDir(parent, name) { const value = path.join(parent, name); fs.mkdirSync(value); return value; }
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function writePackage(parent, name, value) { const target = path.join(parent, name + '.json'); fs.writeFileSync(target, JSON.stringify(value), 'utf8'); return target; }
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    cwd: __dirname, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024
  });
  return { status: result.status, value: result.status === 0 ? JSON.parse(result.stdout) : null, stderr: result.stderr };
}
function publicPem(pair) { return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(); }
function signed(value, payload, privateKey) {
  const result = copy(value);
  result.signature = crypto.sign(null, Buffer.from(payload(result), 'utf8'), privateKey).toString('base64');
  return result;
}

function buildPackage(checkpoint, label, settings) {
  const options = settings || {};
  const witnessPairs = options.witnessPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const anchorPairs = options.anchorPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const witnessPrincipals = options.witnessPrincipals || [digest(label + ':witness:1'), digest(label + ':witness:2')];
  const anchorPrincipals = options.anchorPrincipals || [digest(label + ':anchor:1'), digest(label + ':anchor:2')];
  const witnessPolicy = {
    schema: Anchor.WITNESS_POLICY_SCHEMA,
    policyId: label + ':witness-policy',
    issuedAt: '2026-08-21T10:01:00.000Z',
    expiresAt: '2026-08-21T10:30:00.000Z',
    audience: Anchor.WITNESS_AUDIENCE,
    scope: Anchor.WITNESS_SCOPE,
    authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    checkpointRef: { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest },
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 1200,
    keys: witnessPairs.map((pair, index) => ({
      keyId: label + ':witness-key:' + (index + 1), algorithm: 'Ed25519', publicKeyPem: publicPem(pair),
      actorDigest: witnessPrincipals[index], actorKind: index ? 'machine' : 'human', scope: Anchor.WITNESS_SCOPE, enabled: true
    })),
    policyDigest: null
  };
  witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(witnessPolicy);
  const signedAttestations = witnessPairs.map((pair, index) => signed({
    schema: Anchor.WITNESS_ATTESTATION_SCHEMA,
    attestationId: label + ':attestation:' + (index + 1), keyId: witnessPolicy.keys[index].keyId,
    actorDigest: witnessPrincipals[index], actorKind: witnessPolicy.keys[index].actorKind,
    verdict: 'WITNESS', scope: Anchor.WITNESS_SCOPE, policyDigest: witnessPolicy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    issuedAt: '2026-08-21T10:02:0' + index + '.000Z', expiresAt: '2026-08-21T10:20:00.000Z',
    signatureAlgorithm: 'Ed25519', signature: null
  }, Anchor.witnessSigningPayload, pair.privateKey));
  const witnessInput = {
    witnessId: label + ':witness', verifiedAt: '2026-08-21T10:03:00.000Z', checkpoint: copy(checkpoint),
    witnessPolicy, signedAttestations
  };
  const witnessReceipt = Anchor.buildWitness(witnessInput);
  const anchorPolicy = {
    schema: Anchor.ANCHOR_POLICY_SCHEMA,
    policyId: label + ':anchor-policy', anchorId: label + ':anchor', anchorEpoch: 1,
    issuedAt: '2026-08-21T10:04:00.000Z', expiresAt: '2026-08-21T10:30:00.000Z', status: 'TEST',
    audience: Anchor.ANCHOR_AUDIENCE, scope: Anchor.ANCHOR_SCOPE, authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    requiredSignatures: 2, maxAuthorizationAgeSeconds: 1200,
    keys: anchorPairs.map((pair, index) => ({
      keyId: label + ':anchor-key:' + (index + 1), algorithm: 'Ed25519', publicKeyPem: publicPem(pair),
      stewardDigest: anchorPrincipals[index], stewardKind: index ? 'machine' : 'human', scope: Anchor.ANCHOR_SCOPE, enabled: true
    })),
    policyDigest: null
  };
  anchorPolicy.policyDigest = Anchor.anchorPolicyDigest(anchorPolicy);
  const expectedAnchorDigest = Anchor.anchorDigest(witnessReceipt, anchorPolicy);
  const policyAuthorizations = anchorPairs.map((pair, index) => signed({
    schema: Anchor.ANCHOR_AUTHORIZATION_SCHEMA,
    authorizationId: label + ':authorization:' + (index + 1), keyId: anchorPolicy.keys[index].keyId,
    stewardDigest: anchorPrincipals[index], stewardKind: anchorPolicy.keys[index].stewardKind,
    verdict: 'AUTHORIZE', scope: Anchor.ANCHOR_SCOPE, policyDigest: anchorPolicy.policyDigest,
    expectedAnchorDigest, checkpointDigest: checkpoint.checkpointDigest,
    witnessDigest: witnessReceipt.witnessDigest, witnessPolicyDigest: witnessPolicy.policyDigest,
    witnessKeyFingerprintSetDigest: witnessReceipt.signatureEvidence.keyFingerprintSetDigest,
    witnessDeclaredPrincipalSetDigest: witnessReceipt.signatureEvidence.declaredPrincipalSetDigest,
    issuedAt: '2026-08-21T10:05:0' + index + '.000Z', expiresAt: '2026-08-21T10:20:00.000Z',
    signatureAlgorithm: 'Ed25519', signature: null
  }, Anchor.anchorAuthorizationPayload, pair.privateKey));
  const anchoredInput = {
    receiptId: label + ':anchored', verifiedAt: '2026-08-21T10:06:00.000Z', expectedAnchorDigest,
    witnessInput, witnessReceipt, anchorPolicy, policyAuthorizations
  };
  return {
    witnessPairs, anchorPairs, witnessPrincipals, anchorPrincipals, witnessInput, witnessReceipt,
    anchorPolicy, expectedAnchorDigest, policyAuthorizations, anchoredInput,
    anchoredReceipt: Anchor.buildAnchoredCheckpoint(anchoredInput)
  };
}

function main() {
  const originalNow = OperationsUtils.now;
  OperationsUtils.now = () => '2026-08-21T09:00:00.000Z';
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v34-review-outcome-anchor-'));
  try {
    const item = Fixture.outcomeFixture(tempRoot, 'APPROVED', 'v34-base');
    const ledgerRoot = makeDir(tempRoot, 'origin-ledger');
    const serviceOptions = Fixture.serviceOptions(ledgerRoot, 'v34-ledger', '2020-01-01T00:00:00.000Z');
    const service = Ledger.createService(serviceOptions);
    const recordedAt = Fixture.after(item.outcome.observedAt);
    service.capture(Fixture.captureInput(item, 'v34-record:base', recordedAt));
    const checkpointInput = { checkpointId: 'v34-checkpoint:base', checkpointedAt: '2026-08-21T09:30:00.000Z', serviceOptions: copy(serviceOptions) };
    const checkpoint = History.createCheckpoint(checkpointInput);
    const exactRoot = path.join(tempRoot, 'exact-ledger');
    fs.cpSync(ledgerRoot, exactRoot, { recursive: true });
    const exactServiceOptions = Fixture.serviceOptions(exactRoot, serviceOptions.ledgerId, serviceOptions.createdAt);

    equal(Anchor.VERSION, '3.4.0', 'version is exact');
    equal(Anchor.STATUS, 'TEST', 'status remains TEST');
    equal(Anchor.MAX_SEATS, 10, 'signature seat bound is exact');
    equal(Anchor.MAX_SIGNATURE_AGE_SECONDS, 86400, 'signature age ceiling is exact');
    equal(History.validateCheckpoint(checkpoint), checkpoint, 'v3.3 checkpoint self-validates before witnessing');

    const base = buildPackage(checkpoint, 'v34-base');
    equal(Anchor.verifyWitness(base.witnessInput, base.witnessReceipt).pass, true, 'witness exact-rebuilds');
    equal(Anchor.verifyAnchoredCheckpoint(base.anchoredInput, base.anchoredReceipt).pass, true, 'anchored checkpoint exact-rebuilds');
    equal(base.anchoredReceipt.checkpointRef.sha256, checkpoint.checkpointDigest, 'anchor binds exact v3.3 checkpoint');
    equal(base.anchoredReceipt.witnessRef.sha256, base.witnessReceipt.witnessDigest, 'anchor binds exact witness');
    equal(base.anchoredReceipt.witnessPolicyRef.sha256, base.witnessInput.witnessPolicy.policyDigest, 'anchor binds witness policy');
    equal(base.anchoredReceipt.anchorPolicyRef.sha256, base.anchorPolicy.policyDigest, 'anchor binds anchor policy');
    equal(base.anchoredReceipt.anchorRef.sha256, base.expectedAnchorDigest, 'anchor binds caller-presented expected commitment');
    equal(base.anchoredReceipt.separationEvidence.sharedKeyFingerprintCount, 0, 'no shared verified key fingerprint is observed');
    equal(base.anchoredReceipt.separationEvidence.sharedDeclaredPrincipalDigestCount, 0, 'no shared declared principal digest is observed');
    equal(base.anchoredReceipt.separationEvidence.expectedAnchorOrigin, 'CALLER_PRESENTED_UNAUTHENTICATED', 'expected anchor admits caller-presented origin');
    equal(base.anchoredReceipt.truth.realWorldControllerIndependenceProven, false, 'non-overlap proves no controller independence');
    equal(base.anchoredReceipt.truth.sameControllerWithDistinctKeysAndDigestsStillPossible, true, 'same-controller counterexample is explicit');
    equal(base.anchoredReceipt.truth.jointCheckpointPoliciesSignaturesAndExpectedAnchorReplacementStillPossible, true, 'joint package replacement counterexample is explicit');
    equal(base.anchoredReceipt.truth.checkpointOriginAuthenticated, false, 'checkpoint origin remains unauthenticated');
    equal(base.anchoredReceipt.truth.anchorEpochMonotonicProven, false, 'caller epoch proves no monotonic state');
    equal(base.anchoredReceipt.truth.actualHumanParticipationProven, false, 'declared human kind proves no human participation');
    equal(base.anchoredReceipt.truth.retentionHoldResolved, false, 'anchored receipt leaves retention hold unresolved');
    equal(base.anchoredReceipt.truth.executionAuthorized, false, 'anchored receipt grants no execution authority');
    equal(base.anchoredReceipt.truth.automaticCanon, false, 'anchored receipt grants no CANON status');

    const exactAuditInput = {
      auditId: 'v34-audit:exact', auditedAt: '2026-08-21T10:07:00.000Z',
      anchoredInput: copy(base.anchoredInput), anchoredReceipt: copy(base.anchoredReceipt), currentServiceOptions: copy(exactServiceOptions)
    };
    const exactAudit = Anchor.buildAnchoredAudit(exactAuditInput);
    equal(exactAudit.classification, 'EXACT_HISTORY_MATCH', 'anchored audit composes exact v3.3 classification');
    equal(exactAudit.decision.retentionHoldUnresolved, true, 'anchored exact audit leaves retention hold unresolved');
    equal(exactAudit.decision.autonomousActionCount, 0, 'anchored exact audit authorizes zero actions');
    equal(exactAudit.truth.upstreamV33AuditComposedUnchanged, true, 'audit truth names unchanged v3.3 composition');
    equal(exactAudit.truth.currentLedgerValidatedByV32Reload, true, 'exact audit preserves current-ledger validation truth');
    equal(Anchor.verifyAnchoredAudit(exactAuditInput, exactAudit).pass, true, 'anchored audit exact-rebuilds');

    const nextItem = Fixture.outcomeFixture(tempRoot, 'HOLD', 'v34-forward');
    const nextAt = Fixture.laterThan([recordedAt, nextItem.outcome.observedAt]);
    service.capture(Fixture.captureInput(nextItem, 'v34-record:forward', nextAt));
    const forwardInput = copy(exactAuditInput); forwardInput.auditId = 'v34-audit:forward'; forwardInput.auditedAt = '2026-08-21T10:08:00.000Z'; forwardInput.currentServiceOptions = copy(serviceOptions);
    const forwardAudit = Anchor.buildAnchoredAudit(forwardInput);
    equal(forwardAudit.classification, 'FORWARD_HISTORY_EXTENSION', 'anchored audit preserves forward classification');
    equal(forwardAudit.decision.continuityHoldRequired, false, 'forward history remains review-only without continuity hold');
    equal(forwardAudit.decision.retentionHoldUnresolved, true, 'forward history does not resolve retention hold');

    const absentRoot = makeDir(tempRoot, 'absent-ledger');
    const absentInput = copy(exactAuditInput); absentInput.auditId = 'v34-audit:absent'; absentInput.auditedAt = '2026-08-21T10:09:00.000Z';
    absentInput.currentServiceOptions = Fixture.serviceOptions(absentRoot, serviceOptions.ledgerId, serviceOptions.createdAt);
    const absentAudit = Anchor.buildAnchoredAudit(absentInput);
    equal(absentAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'anchored audit preserves absence classification');
    equal(absentAudit.decision.continuityHoldRequired, true, 'absence remains held');
    equal(absentAudit.truth.currentLedgerValidatedByV32Reload, false, 'absence claims no current-ledger validation');

    const witnessChild = runChild(writePackage(tempRoot, 'child-witness', { action: 'witness', input: base.witnessInput }));
    equal(witnessChild.status, 0, 'fresh process rebuilds witness');
    check(witnessChild.value.pid !== process.pid, 'witness rebuild uses a distinct process');
    equal(witnessChild.value.result, base.witnessReceipt, 'fresh witness receipt is exact');
    const anchorChild = runChild(writePackage(tempRoot, 'child-anchor', { action: 'anchor', input: base.anchoredInput }));
    equal(anchorChild.status, 0, 'fresh process rebuilds anchored checkpoint');
    check(anchorChild.value.pid !== process.pid, 'anchor rebuild uses a distinct process');
    equal(anchorChild.value.result, base.anchoredReceipt, 'fresh anchored checkpoint is exact');
    const auditChild = runChild(writePackage(tempRoot, 'child-audit', { action: 'audit', input: exactAuditInput }));
    equal(auditChild.status, 0, 'fresh process rebuilds anchored audit');
    check(auditChild.value.pid !== process.pid, 'audit rebuild uses a distinct process');
    equal(auditChild.value.result, exactAudit, 'fresh anchored audit is exact');

    const wrongWitnessSignature = copy(base.witnessInput);
    wrongWitnessSignature.signedAttestations[0].signature = wrongWitnessSignature.signedAttestations[1].signature;
    equal(Anchor.verifyWitness(wrongWitnessSignature, base.witnessReceipt).pass, false, 'wrong witness signature fails closed');
    const changedCheckpoint = copy(base.witnessInput); changedCheckpoint.checkpoint.checkpointId += ':changed';
    equal(Anchor.verifyWitness(changedCheckpoint, base.witnessReceipt).pass, false, 'changed checkpoint fails closed');
    const wrongPolicyOrigin = copy(base.witnessInput); wrongPolicyOrigin.witnessPolicy.authorityOrigin = 'TRUSTED'; wrongPolicyOrigin.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(wrongPolicyOrigin.witnessPolicy);
    equal(Anchor.verifyWitness(wrongPolicyOrigin, base.witnessReceipt).pass, false, 'witness policy cannot claim authenticated authority');
    const tooFewWitnesses = copy(base.witnessInput); tooFewWitnesses.signedAttestations.pop();
    equal(Anchor.verifyWitness(tooFewWitnesses, base.witnessReceipt).pass, false, 'insufficient witness threshold fails closed');
    const expiredWitnessPolicy = copy(base.witnessInput); expiredWitnessPolicy.witnessPolicy.expiresAt = '2026-08-21T10:02:30.000Z'; expiredWitnessPolicy.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(expiredWitnessPolicy.witnessPolicy);
    equal(Anchor.verifyWitness(expiredWitnessPolicy, base.witnessReceipt).pass, false, 'expired witness policy fails closed');
    const duplicateWitnessKey = copy(base.witnessInput); duplicateWitnessKey.witnessPolicy.keys[1].publicKeyPem = duplicateWitnessKey.witnessPolicy.keys[0].publicKeyPem; duplicateWitnessKey.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(duplicateWitnessKey.witnessPolicy);
    equal(Anchor.verifyWitness(duplicateWitnessKey, base.witnessReceipt).pass, false, 'duplicate witness fingerprint fails closed');
    const duplicateWitnessPrincipal = copy(base.witnessInput); duplicateWitnessPrincipal.witnessPolicy.keys[1].actorDigest = duplicateWitnessPrincipal.witnessPolicy.keys[0].actorDigest; duplicateWitnessPrincipal.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(duplicateWitnessPrincipal.witnessPolicy);
    equal(Anchor.verifyWitness(duplicateWitnessPrincipal, base.witnessReceipt).pass, false, 'duplicate witness principal fails closed');
    const privatePem = copy(base.witnessInput); privatePem.witnessPolicy.keys[0].publicKeyPem = base.witnessPairs[0].privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(); privatePem.witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(privatePem.witnessPolicy);
    equal(Anchor.verifyWitness(privatePem, base.witnessReceipt).pass, false, 'private-key PEM is rejected');

    const wrongAnchorSignature = copy(base.anchoredInput); wrongAnchorSignature.policyAuthorizations[0].signature = wrongAnchorSignature.policyAuthorizations[1].signature;
    equal(Anchor.verifyAnchoredCheckpoint(wrongAnchorSignature, base.anchoredReceipt).pass, false, 'wrong anchor signature fails closed');
    const wrongExpectedAnchor = copy(base.anchoredInput); wrongExpectedAnchor.expectedAnchorDigest = 'sha256:' + '0'.repeat(64);
    equal(Anchor.verifyAnchoredCheckpoint(wrongExpectedAnchor, base.anchoredReceipt).pass, false, 'wrong expected anchor fails closed');
    const substitutedWitness = copy(base.anchoredInput); substitutedWitness.witnessReceipt.witnessId += ':substituted';
    equal(Anchor.verifyAnchoredCheckpoint(substitutedWitness, base.anchoredReceipt).pass, false, 'witness substitution fails closed');
    const tooFewAnchors = copy(base.anchoredInput); tooFewAnchors.policyAuthorizations.pop();
    equal(Anchor.verifyAnchoredCheckpoint(tooFewAnchors, base.anchoredReceipt).pass, false, 'insufficient anchor threshold fails closed');
    const extraAnchorInput = copy(base.anchoredInput); extraAnchorInput.extra = true;
    equal(Anchor.verifyAnchoredCheckpoint(extraAnchorInput, base.anchoredReceipt).pass, false, 'extra anchored-input field fails closed');
    throws(() => buildPackage(checkpoint, 'shared-key', { witnessPairs: base.witnessPairs, anchorPairs: base.witnessPairs }), /must not share a verified public key fingerprint/, 'cross-layer verified key reuse fails closed');
    throws(() => buildPackage(checkpoint, 'shared-principal', { anchorPrincipals: [digest('shared-principal:witness:1'), digest('shared-principal:witness:2')] }), /must not share a verified declared principal digest/, 'cross-layer principal reuse fails closed');

    const replacementItem = Fixture.outcomeFixture(tempRoot, 'REJECTED', 'v34-replacement');
    const replacementRoot = makeDir(tempRoot, 'replacement-ledger');
    const replacementOptions = Fixture.serviceOptions(replacementRoot, serviceOptions.ledgerId, serviceOptions.createdAt);
    Ledger.createService(replacementOptions).capture(Fixture.captureInput(replacementItem, 'v34-record:replacement', Fixture.after(replacementItem.outcome.observedAt)));
    const replacementCheckpoint = History.createCheckpoint({ checkpointId: 'v34-checkpoint:replacement', checkpointedAt: '2026-08-21T09:40:00.000Z', serviceOptions: replacementOptions });
    const replacement = buildPackage(replacementCheckpoint, 'v34-replacement');
    equal(Anchor.verifyAnchoredCheckpoint(replacement.anchoredInput, replacement.anchoredReceipt).pass, true, 'jointly replaced checkpoint policies keys signatures and anchor still pass relatively');
    check(replacement.anchoredReceipt.receiptDigest !== base.anchoredReceipt.receiptDigest, 'joint replacement yields a distinct valid receipt');
    equal(replacement.anchoredReceipt.truth.originalCheckpointContinuityProven, false, 'joint replacement proves no original continuity');

    const oversizedReceipt = { schema: Anchor.WITNESS_SCHEMA, padding: 'x'.repeat(Anchor.MAX_RECEIPT_CANONICAL_BYTES + 1) };
    equal(Anchor.verifyWitness(base.witnessInput, oversizedReceipt).pass, false, 'oversized witness receipt fails closed');
    oversizedReceipt.schema = Anchor.ANCHORED_CHECKPOINT_SCHEMA;
    equal(Anchor.verifyAnchoredCheckpoint(base.anchoredInput, oversizedReceipt).pass, false, 'oversized anchored receipt fails closed');
    oversizedReceipt.schema = Anchor.ANCHORED_AUDIT_SCHEMA;
    equal(Anchor.verifyAnchoredAudit(exactAuditInput, oversizedReceipt).pass, false, 'oversized anchored audit fails closed');

    const publicReceipts = JSON.stringify([base.witnessReceipt, base.anchoredReceipt, exactAudit]);
    equal(publicReceipts.includes('BEGIN PUBLIC KEY'), false, 'public receipts omit raw public keys');
    equal(publicReceipts.includes(base.policyAuthorizations[0].signature), false, 'public receipts omit raw signatures');
    equal(publicReceipts.includes(ledgerRoot), false, 'public receipts omit ledger paths');
    equal(publicReceipts.includes('PRIVATE KEY'), false, 'public receipts omit private keys');
    equal(publicReceipts.includes(JSON.stringify(item.outcome)), false, 'public receipts omit complete review outcome');

    const schemaNames = ['witness-policy.schema.json', 'witness-attestation.schema.json', 'witness.schema.json', 'anchor-policy.schema.json', 'anchor-authorization.schema.json', 'anchored-checkpoint.schema.json', 'anchored-audit.schema.json'];
    schemaNames.forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
      equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name + ' declares Draft 2020-12');
      equal(schema.type, 'object', name + ' is an object schema');
      equal(schema.additionalProperties, false, name + ' closes unknown top-level fields');
    });
    const contract = require('./module.contract.json');
    equal(contract.version, 'v3.4', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.filter(value => value.startsWith('model.shadow.retention-audit-review-outcome-history-checkpoint-anchor.')).length, 20, 'contract exposes twenty bounded capabilities');
    const contractCheck = ContractVerifier.validateContract(contract);
    equal(contractCheck.pass, true, 'module contract passes repository verifier');
    equal(contractCheck.errors, [], 'module contract verifier reports no errors');

    const runtimeSource = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor.js'), 'utf8');
    equal(runtimeSource.includes('writeFile'), false, 'runtime contains no file-write operation');
    equal(runtimeSource.includes('mkdir'), false, 'runtime contains no directory-write operation');
    equal(runtimeSource.includes('fetch('), false, 'runtime contains no network fetch');
    equal(runtimeSource.includes('generateKeyPair'), false, 'runtime generates no keys');
    equal(runtimeSource.includes('createPrivateKey'), false, 'runtime ingests no private key API');
    equal(runtimeSource.includes('crypto.sign'), false, 'runtime performs no signing');
    check(runtimeSource.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint/"), 'runtime composes exact v3.3 module');
    check(runtimeSource.includes('retentionHoldResolved: false') && runtimeSource.includes('executionAuthorized: false'), 'runtime refuses hold resolution and execution authority');
    check(runtimeSource.includes('humanBenefitProven: false') && runtimeSource.includes('broadLearningClaimed: false'), 'runtime refuses benefit and learning claims');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    OperationsUtils.now = originalNow;
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

main();
