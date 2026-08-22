'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Consent = require('./grounded-consent-scope-v1');
const Readiness = require('./code-capability-readiness-v1');
const Comparator = require('./git-object-inventory-comparator-v1');

let passed = 0;

function ok(condition, label) {
  if (!condition) throw new Error('FAIL: ' + label);
  passed += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function same(left, right) {
  return Comparator.canonicalJson(left) === Comparator.canonicalJson(right);
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

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function localSchemaRefsResolve(schema) {
  function visit(value) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every(visit);
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) {
      let cursor = schema;
      for (const part of value.$ref.slice(2).split('/')) {
        cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
      }
      if (cursor === undefined) return false;
    }
    return Object.values(value).every(visit);
  }
  return visit(schema);
}

function makeSigner(id) {
  const pair = crypto.generateKeyPairSync('ed25519');
  return {
    key: {
      schema: Readiness.TRUST_KEY_SCHEMA,
      id,
      algorithm: 'Ed25519',
      publicKeySpkiDerBase64: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
    },
    privateKey: pair.privateKey
  };
}

const primary = makeSigner('git-inventory-observer-primary');
const secondary = makeSigner('git-inventory-observer-secondary');
const subjectRef = {
  id: 'workshop-git-object-set-test',
  schema: Comparator.SUBJECT_SCHEMA,
  sha256: Comparator.sha256('workshop-git-object-set-test-subject')
};

function oid(hex, format = 'SHA1') {
  return hex.repeat(format === 'SHA1' ? 40 : 64);
}

function record(hex, type = 'blob', size = 1, format = 'SHA1') {
  return { oid: oid(hex, format), type, size };
}

function inventory(role, objects, options = {}) {
  const format = options.objectFormat || 'SHA1';
  const records = options.preserveOrder ? objects.slice() : objects.slice().sort((a, b) => a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : 0);
  return Comparator.sealInventory({
    schema: Comparator.INVENTORY_SCHEMA,
    version: Comparator.VERSION,
    id: options.id || role.toLowerCase() + '-git-object-inventory-test',
    role: options.role || role,
    subjectRef: options.subjectRef || subjectRef,
    objectFormat: format,
    enumerationClaim: Comparator.ENUMERATION_CLAIM,
    observedAt: options.observedAt || '2026-08-22T18:10:00.000Z',
    expiresAt: options.expiresAt || '2026-08-22T18:30:00.000Z',
    objects: records,
    objectCount: records.length,
    totalDeclaredObjectBytes: records.reduce((sum, item) => sum + item.size, 0),
    authority: 'NONE'
  });
}

function signInventory(value, signer = primary, signedAt = '2026-08-22T18:11:00.000Z') {
  const core = {
    schema: Readiness.OBSERVATION_ATTESTATION_SCHEMA,
    observationRecordDigest: value.inventoryDigest,
    keyRef: Readiness.buildTrustKeyRef(signer.key),
    signedAt
  };
  return {
    ...core,
    signatureBase64: crypto.sign(
      null,
      Readiness.buildObservationAttestationPayload(core),
      signer.privateKey
    ).toString('base64')
  };
}

function exactInput(options = {}) {
  const format = options.objectFormat || 'SHA1';
  const sourceObjects = options.sourceObjects || [record('1', 'blob', 12, format), record('2', 'tree', 40, format)];
  const mirrorObjects = options.mirrorObjects || sourceObjects;
  const source = options.sourceInventory || inventory('SOURCE', sourceObjects, {
    objectFormat: format,
    id: options.sourceId,
    role: options.sourceRole,
    subjectRef: options.sourceSubjectRef,
    observedAt: options.sourceObservedAt,
    expiresAt: options.sourceExpiresAt
  });
  const mirror = options.mirrorInventory || inventory('MIRROR', mirrorObjects, {
    objectFormat: options.mirrorObjectFormat || format,
    id: options.mirrorId,
    role: options.mirrorRole,
    subjectRef: options.mirrorSubjectRef,
    observedAt: options.mirrorObservedAt,
    expiresAt: options.mirrorExpiresAt
  });
  const signers = options.signers || [primary];
  const sourceSigner = options.sourceSigner || primary;
  const mirrorSigner = options.mirrorSigner || primary;
  return Comparator.buildExampleInput(
    source,
    mirror,
    signers.map((item) => item.key),
    options.sourceAttestation || signInventory(source, sourceSigner, options.sourceSignedAt),
    options.mirrorAttestation || signInventory(mirror, mirrorSigner, options.mirrorSignedAt)
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
    const sealed = { ...core, receiptDigest: Comparator.sha256(core) };
    const next = jsonBytes(sealed).length;
    if (next === receiptBytes) return sealed;
    receiptBytes = next;
  }
  throw new Error('test receipt length did not stabilize');
}

const input = exactInput();
const prepared = Comparator.prepare(input);
const receipt = Comparator.compareInventories(input);

ok(Comparator.PROFILE.kind === 'PURE_DATA_COMPARISON', 'profile is a pure data comparison');
ok(Comparator.PROFILE.filesystemReads === 'DISABLED_HOST_SUPPLIES_RECORDS', 'host must supply inert records');
ok(Comparator.PROFILE.filesystemWrites === 'DISABLED', 'profile disables filesystem writes');
ok(Comparator.PROFILE.gitCommands === 'DISABLED', 'profile disables Git commands');
ok(Comparator.PROFILE.network === 'DISABLED', 'profile disables network');
ok(Comparator.PROFILE.childProcesses === 'DISABLED', 'profile disables child processes');
ok(Comparator.PROFILE.objectExecution === 'DISABLED', 'profile disables object execution');
ok(Comparator.PROFILE.authority === 'NONE', 'profile grants no authority');
ok(Comparator.PROFILE.maximumObjectsPerInventory === 2048, 'profile pins record count ceiling');
ok(Comparator.PROFILE.maximumDeclaredObjectBytesPerInventory === 1099511627776, 'profile pins declared byte ceiling');
ok(Comparator.PROFILE.maximumDeclaredMemoryBytes === 134217728, 'profile pins declared memory ceiling');
ok(Comparator.PROFILE.maximumDeclaredDurationMs === 5000, 'profile pins declared duration ceiling');
ok(same(prepared.instance.permissions, []), 'consent permissions remain empty');
ok(same(prepared.instance.networkDomains, []), 'consent network remains empty');
ok(Object.values(prepared.instance.lifecycle).every((value) => value === false), 'all lifecycle effects remain false');
ok(receipt.status === 'MATCH', 'equal signed inventories produce MATCH');
ok(receipt.delta.unchangedObjectCount === 2 && receipt.delta.unchangedDeclaredBytes === 52, 'MATCH counts unchanged records and bytes');
ok(receipt.delta.added.length === 0 && receipt.delta.removed.length === 0 && receipt.delta.metadataChanged.length === 0, 'MATCH has no drift categories');
ok(receipt.source.inventoryRef.byteLength === jsonBytes(input.sourceInventory).length, 'source inventory lineage binds exact bytes');
ok(receipt.mirror.inventoryRef.byteLength === jsonBytes(input.mirrorInventory).length, 'mirror inventory lineage binds exact bytes');
ok(receipt.source.attestationRef.byteLength === jsonBytes(input.sourceAttestation).length, 'source attestation lineage binds exact bytes');
ok(receipt.mirror.attestationRef.byteLength === jsonBytes(input.mirrorAttestation).length, 'mirror attestation lineage binds exact bytes');
ok(receipt.truth.objectSetEqualityWithinSignedObservationsProven, 'MATCH truth is limited to signed observations');
ok(!receipt.truth.objectSetDriftWithinSignedObservationsObserved, 'MATCH does not claim observed drift');
ok(receipt.truth.sourceObservationSignatureVerified && receipt.truth.mirrorObservationSignatureVerified, 'both observation signatures are verified');
ok(!receipt.truth.hostEnumerationCompletenessVerified, 'host enumeration completeness is not overclaimed');
ok(!receipt.truth.actualRepositoryObjectSetEqualityProven, 'actual repository equality is not overclaimed');
ok(!receipt.truth.GitRepositoryOpened && !receipt.truth.GitCommandExecuted, 'no repository or Git execution is claimed');
ok(!receipt.truth.objectBytesRead && !receipt.truth.objectContentIntegrityRecomputed, 'object bytes and content hashes are not claimed');
ok(!receipt.truth.networkUsed && !receipt.truth.childProcessSpawned, 'network and child processes remain unused');
ok(!receipt.truth.fileContentRetainedInReceipt, 'receipt retains no object content');
ok(!receipt.truth.mirrorCodeCloneConnected && !receipt.truth.mirrorCodeCloneExecuted, 'clone runtime remains detached');
ok(!receipt.truth.sourceMutationPerformed && !receipt.truth.mirrorMutationPerformed, 'comparison mutates neither side');
ok(!receipt.truth.automaticMergePerformed && !receipt.truth.canonChanged, 'comparison cannot merge or change CANON');
ok(!receipt.truth.machineDefaultActivated && !receipt.truth.persistentLearningAdmitted, 'comparison activates no default or learning');
ok(!receipt.truth.cryptographicHumanAuthenticationVerified && !receipt.truth.interactiveDeclarationReplayPrevented, 'human authentication and replay prevention are not overclaimed');
ok(!receipt.truth.trustedClockObserved && !receipt.truth.liveRevocationChecked, 'trusted time and live revocation are not overclaimed');
ok(receipt.resourceObservation.verifierInputBytes <= Comparator.MAX_VERIFIER_INPUT_BYTES, 'conservative input byte ceiling is observed');
ok(receipt.resourceObservation.receiptBytes === jsonBytes(receipt).length, 'receipt byte observation is exact');
ok(!receipt.resourceObservation.attemptCountEnforced, 'cross-invocation attempt enforcement is not overclaimed');
ok(!receipt.resourceObservation.durationEnforced && !receipt.resourceObservation.memoryEnforced, 'runtime governor enforcement is not overclaimed');
ok(Comparator.verifyReceipt(receipt, input).receiptDigest === receipt.receiptDigest, 'receipt verifies against exact bound inputs');
ok(same(Comparator.compareInventories(input), receipt), 'same exact input rebuilds deterministically');

const emptyReceipt = Comparator.compareInventories(exactInput({ sourceObjects: [], mirrorObjects: [] }));
ok(emptyReceipt.status === 'MATCH' && emptyReceipt.delta.unchangedObjectCount === 0, 'empty signed inventories compare deterministically');

const sha256Receipt = Comparator.compareInventories(exactInput({ objectFormat: 'SHA256' }));
ok(sha256Receipt.status === 'MATCH' && sha256Receipt.source.objectFormat === 'SHA256', 'SHA-256 object format is supported explicitly');

const added = Comparator.compareInventories(exactInput({
  mirrorObjects: [record('1', 'blob', 12), record('2', 'tree', 40), record('3', 'commit', 80)]
}));
ok(added.status === 'DRIFT', 'added object produces DRIFT');
ok(added.delta.added.length === 1 && added.delta.added[0].oid === oid('3'), 'added object is precise');
ok(same(added.issues, ['OBJECTS_ADDED']), 'added object has typed issue');
ok(added.truth.objectSetDriftWithinSignedObservationsObserved && !added.truth.objectSetEqualityWithinSignedObservationsProven, 'DRIFT truth cannot inflate equality');

const removed = Comparator.compareInventories(exactInput({ mirrorObjects: [record('1', 'blob', 12)] }));
ok(removed.status === 'DRIFT' && removed.delta.removed[0].oid === oid('2'), 'removed object is precise DRIFT');
ok(same(removed.issues, ['OBJECTS_REMOVED']), 'removed object has typed issue');

const metadata = Comparator.compareInventories(exactInput({
  mirrorObjects: [record('1', 'tree', 13), record('2', 'tree', 40)]
}));
ok(metadata.status === 'DRIFT' && metadata.delta.metadataChanged.length === 1, 'metadata contradiction produces DRIFT');
ok(metadata.delta.metadataChanged[0].sourceType === 'blob' && metadata.delta.metadataChanged[0].mirrorType === 'tree', 'metadata type contradiction is retained');
ok(metadata.delta.metadataChanged[0].sourceSize === 12 && metadata.delta.metadataChanged[0].mirrorSize === 13, 'metadata size contradiction is retained');
ok(same(metadata.issues, ['OBJECT_METADATA_CONTRADICTION']), 'metadata contradiction has typed issue');

const combined = Comparator.compareInventories(exactInput({
  sourceObjects: [record('1', 'blob', 1), record('2', 'blob', 2), record('3', 'blob', 3)],
  mirrorObjects: [record('1', 'tree', 4), record('4', 'blob', 5), record('5', 'blob', 6)]
}));
ok(combined.status === 'DRIFT', 'combined delta produces DRIFT');
ok(combined.delta.added.length === 2 && combined.delta.removed.length === 2 && combined.delta.metadataChanged.length === 1, 'combined delta categories are exact');
ok(same(combined.issues, ['OBJECTS_ADDED', 'OBJECTS_REMOVED', 'OBJECT_METADATA_CONTRADICTION']), 'combined issues are canonical');
for (const field of ['added', 'removed', 'metadataChanged']) {
  ok(combined.delta[field].every((item, index, values) => index === 0 || values[index - 1].oid < item.oid), field + ' output order is canonical');
}

const inventoryCore = clone(input.sourceInventory);
delete inventoryCore.inventoryDigest;
const malformedInventoryCases = [
  [(value) => { value.extra = true; }, /unsupported fields/, 'inventory extra field'],
  [(value) => { value.version = '0.2.0'; }, /identity mismatch/, 'inventory version ambiguity'],
  [(value) => { value.role = 'PRIMARY'; }, /role/, 'ambiguous inventory role'],
  [(value) => { value.objectFormat = 'sha1'; }, /objectFormat/, 'ambiguous object format'],
  [(value) => { value.enumerationClaim = 'TRUST_ME'; }, /enumeration claim/, 'forged enumeration claim'],
  [(value) => { value.authority = 'READ'; }, /authority/, 'inventory authority inflation'],
  [(value) => { value.observedAt = '2026-08-22 18:10:00Z'; }, /timestamp/, 'noncanonical observation timestamp'],
  [(value) => { value.expiresAt = value.observedAt; }, /window/, 'zero inventory window'],
  [(value) => { value.expiresAt = '2026-08-22T19:10:00.001Z'; }, /window/, 'oversized inventory window'],
  [(value) => { value.objects[0].oid = 'A'.repeat(40); }, /does not match/, 'uppercase object id'],
  [(value) => { value.objects[0].oid = '1'.repeat(39); }, /does not match/, 'short SHA-1 object id'],
  [(value) => { value.objects[0].type = 'delta'; }, /unsupported/, 'unsupported object type'],
  [(value) => { value.objects[0].size = -1; }, /integer/, 'negative object size'],
  [(value) => { value.objects[0].size = 1.5; }, /integer/, 'fractional object size'],
  [(value) => { value.objectCount += 1; }, /count or byte total/, 'forged object count'],
  [(value) => { value.totalDeclaredObjectBytes += 1; }, /count or byte total/, 'forged declared byte total']
];
malformedInventoryCases.forEach(([edit, pattern, label]) => {
  const value = clone(inventoryCore);
  edit(value);
  expectThrow(() => Comparator.sealInventory(value), pattern, label + ' is rejected');
});

const duplicateObjects = clone(inventoryCore);
duplicateObjects.objects = [clone(duplicateObjects.objects[0]), clone(duplicateObjects.objects[0])];
duplicateObjects.objectCount = 2;
duplicateObjects.totalDeclaredObjectBytes = duplicateObjects.objects[0].size * 2;
expectThrow(() => Comparator.sealInventory(duplicateObjects), /duplicate/, 'duplicate object id is rejected');

const reversedObjects = clone(inventoryCore);
reversedObjects.objects.reverse();
expectThrow(() => Comparator.sealInventory(reversedObjects), /not canonical/, 'noncanonical object ordering is rejected');

const tooManyObjects = clone(inventoryCore);
tooManyObjects.objects = Array.from({ length: Comparator.MAX_OBJECTS + 1 }, (_, index) => ({
  oid: index.toString(16).padStart(40, '0'), type: 'blob', size: 0
}));
tooManyObjects.objectCount = tooManyObjects.objects.length;
tooManyObjects.totalDeclaredObjectBytes = 0;
expectThrow(() => Comparator.sealInventory(tooManyObjects), /bounded array/, 'inventory record count ceiling is enforced');

const tooManyBytes = clone(inventoryCore);
tooManyBytes.objects[0].size = Comparator.MAX_DECLARED_OBJECT_BYTES;
tooManyBytes.objects[1].size = 1;
tooManyBytes.totalDeclaredObjectBytes = Comparator.MAX_DECLARED_OBJECT_BYTES + 1;
expectThrow(() => Comparator.sealInventory(tooManyBytes), /byte total/, 'aggregate declared object byte ceiling is enforced');

const badInventoryDigest = clone(input.sourceInventory);
badInventoryDigest.inventoryDigest = Comparator.sha256('wrong inventory');
expectThrow(() => Comparator.normalizeInventory(badInventoryDigest), /digest mismatch/, 'inventory digest drift is rejected');

const distinctIdFailure = inventory('MIRROR', input.sourceInventory.objects, { id: input.sourceInventory.id });
expectThrow(() => Comparator.buildRequest(input.sourceInventory, distinctIdFailure, [primary.key]), /ids must be distinct/, 'source and mirror observation ids cannot alias');

const wrongSubject = { id: 'other-subject', schema: Comparator.SUBJECT_SCHEMA, sha256: Comparator.sha256('other') };
expectThrow(() => Comparator.prepare(exactInput({ mirrorSubjectRef: wrongSubject })), /same logical subject/, 'subject drift is rejected');
expectThrow(() => Comparator.prepare(exactInput({ mirrorObjectFormat: 'SHA256', mirrorObjects: [record('1', 'blob', 12, 'SHA256')] })), /formats are incompatible/, 'object format ambiguity is rejected');
expectThrow(() => Comparator.prepare(exactInput({ sourceRole: 'MIRROR' })), /roles are directional/, 'source role swap is rejected');
expectThrow(() => Comparator.prepare(exactInput({ mirrorRole: 'SOURCE' })), /roles are directional/, 'mirror role swap is rejected');
expectThrow(() => Comparator.prepare(exactInput({ sourceObservedAt: '2026-08-22T18:04:59.000Z', mirrorObservedAt: '2026-08-22T18:10:00.000Z' })), /skew profile/, 'cross-host observation skew is bounded');
expectThrow(() => Comparator.prepare(exactInput({ sourceExpiresAt: '2026-08-22T18:14:59.000Z', sourceSignedAt: '2026-08-22T18:11:00.000Z' })), /stale or future-dated/, 'stale inventory is rejected');
expectThrow(() => Comparator.prepare(exactInput({ sourceObservedAt: '2026-08-22T18:16:00.000Z', sourceExpiresAt: '2026-08-22T18:30:00.000Z', sourceSignedAt: '2026-08-22T18:16:00.000Z' })), /stale or future-dated/, 'future inventory is rejected');

const forgedSignature = exactInput();
const forgedCore = clone(forgedSignature.sourceAttestation);
delete forgedCore.signatureBase64;
forgedSignature.sourceAttestation.signatureBase64 = crypto.sign(null, Readiness.buildObservationAttestationPayload(forgedCore), secondary.privateKey).toString('base64');
expectThrow(() => Comparator.prepare(forgedSignature), /signature is invalid/, 'forged inventory signature is rejected');

const swappedAttestations = exactInput();
[swappedAttestations.sourceAttestation, swappedAttestations.mirrorAttestation] = [swappedAttestations.mirrorAttestation, swappedAttestations.sourceAttestation];
expectThrow(() => Comparator.prepare(swappedAttestations), /digest mismatch/, 'attestation replay across inventory roles is rejected');

const untrustedSigner = exactInput({ sourceSigner: secondary });
expectThrow(() => Comparator.prepare(untrustedSigner), /not consent-bound/, 'untrusted observation signer is rejected');

const signedBeforeObservation = exactInput({ sourceSignedAt: '2026-08-22T18:09:59.999Z' });
expectThrow(() => Comparator.prepare(signedBeforeObservation), /attestation time/, 'signature before observation is rejected');

const signedAfterEvaluation = exactInput({ sourceSignedAt: '2026-08-22T18:16:00.000Z' });
expectThrow(() => Comparator.prepare(signedAfterEvaluation), /attestation time/, 'signature after consent evaluation is rejected');

const duplicateKeys = exactInput();
duplicateKeys.observerKeys.push(clone(primary.key));
expectThrow(() => Comparator.prepare(duplicateKeys), /do not match|duplicates/, 'duplicate observer keys are rejected');

const wrongKeySet = exactInput();
wrongKeySet.observerKeys = [secondary.key];
expectThrow(() => Comparator.prepare(wrongKeySet), /do not match/, 'observer key-set drift is rejected');

const twoKeyInput = exactInput({ signers: [primary, secondary] });
ok(Comparator.compareInventories(twoKeyInput).status === 'MATCH', 'bounded two-key consent set is supported');
const reversedKeyRequestCore = clone(twoKeyInput.request);
delete reversedKeyRequestCore.requestDigest;
reversedKeyRequestCore.trustedObserverRefs.reverse();
expectThrow(() => Comparator.sealRequest(reversedKeyRequestCore), /not canonical/, 'noncanonical observer selection order is rejected');

const requestExtra = clone(input.request);
requestExtra.surprise = true;
expectThrow(() => Comparator.normalizeRequest(requestExtra), /unsupported fields/, 'request extra fields are rejected');
const requestDigestDrift = clone(input.request);
requestDigestDrift.requestDigest = Comparator.sha256('wrong request');
expectThrow(() => Comparator.normalizeRequest(requestDigestDrift), /digest mismatch/, 'request digest drift is rejected');
const requestRefAlias = clone(input.request);
delete requestRefAlias.requestDigest;
requestRefAlias.mirrorInventoryRef.id = requestRefAlias.sourceInventoryRef.id;
expectThrow(() => Comparator.sealRequest(requestRefAlias), /ids must be distinct/, 'request inventory id alias is rejected');

const packetDriftAfterConsent = exactInput();
packetDriftAfterConsent.mirrorInventory = inventory('MIRROR', [record('1', 'blob', 12)]);
expectThrow(() => Comparator.prepare(packetDriftAfterConsent), /bind the exact inventories/, 'inventory drift after consent is rejected');

const wrongAck = exactInput();
wrongAck.authorization.acknowledgement = 'COMPARE GIT OBJECTS';
expectThrow(() => Comparator.prepare(wrongAck), /authorization/, 'ambiguous interactive acknowledgement is rejected');
const forgedInstruction = exactInput();
forgedInstruction.authorization.instructionRef.sha256 = Comparator.sha256('forged instruction');
expectThrow(() => Comparator.prepare(forgedInstruction), /authorization/, 'forged instruction lineage is rejected');
const staleEvaluation = exactInput();
staleEvaluation.consentEvaluation.evaluatedAt = '2026-08-22T17:00:00.000Z';
expectThrow(() => Comparator.prepare(staleEvaluation), /evaluation|digest/, 'forged consent evaluation is rejected');

const consentExpansionCases = [
  ['permission', {
    policy(value) { value.domainRules[0].allowedPermissions.push('workspace.read'); },
    instance(value) { value.permissions.push('workspace.read'); }
  }, /permission scope/],
  ['network', {
    policy(value) { value.domainRules[0].allowedNetworkDomains.push('example.com'); },
    instance(value) { value.networkDomains.push('example.com'); }
  }, /network/],
  ['action', {
    policy(value) { value.domainRules[0].allowedActions.push('code.execute'); },
    instance(value) { value.actions.push('code.execute'); }
  }, /action scope/],
  ['install lifecycle', {
    policy(value) { value.domainRules[0].allowedLifecycle.install = true; },
    instance(value) { value.lifecycle.install = true; }
  }, /lifecycle/],
  ['attempt count', {
    policy(value) { value.domainRules[0].resourceCeilings.maxAttempts = 2; },
    instance(value) { value.resources.maxAttempts = 2; }
  }, /resource scope/],
  ['process count', {
    policy(value) { value.domainRules[0].resourceCeilings.maxProcesses = 2; },
    instance(value) { value.resources.maxProcesses = 2; }
  }, /resource scope/],
  ['declared memory', {
    policy(value) { value.domainRules[0].resourceCeilings.maxMemoryBytes = Comparator.MAX_DECLARED_MEMORY_BYTES + 1; },
    instance(value) { value.resources.maxMemoryBytes = Comparator.MAX_DECLARED_MEMORY_BYTES + 1; }
  }, /resource scope/],
  ['declared duration', {
    policy(value) { value.domainRules[0].resourceCeilings.maxDurationMs = Comparator.MAX_DECLARED_DURATION_MS + 1; },
    instance(value) { value.resources.maxDurationMs = Comparator.MAX_DECLARED_DURATION_MS + 1; }
  }, /resource scope/]
];
consentExpansionCases.forEach(([label, edits, pattern]) => {
  expectThrow(() => Comparator.prepare(resealConsent(exactInput(), edits)), pattern, label + ' expansion is rejected');
});

const inputBudget = resealConsent(exactInput(), {
  policy(value) { value.domainRules[0].resourceCeilings.maxInputBytes = 9000; },
  instance(value) { value.resources.maxInputBytes = 9000; }
});
expectThrow(() => Comparator.prepare(inputBudget), /input byte budget/, 'actual verifier input byte budget is enforced');

const outputBudget = resealConsent(exactInput(), {
  policy(value) { value.domainRules[0].resourceCeilings.maxOutputBytes = 6000; },
  instance(value) { value.resources.maxOutputBytes = 6000; }
});
expectThrow(() => Comparator.compareInventories(outputBudget), /output byte budget/, 'actual receipt output byte budget is enforced');

const receiptDigestDrift = clone(receipt);
receiptDigestDrift.receiptDigest = Comparator.sha256('wrong receipt');
expectThrow(() => Comparator.normalizeReceipt(receiptDigestDrift), /digest mismatch/, 'receipt digest drift is rejected');
const receiptVersion = clone(receipt);
receiptVersion.version = '0.2.0';
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(receiptVersion)), /identity mismatch/, 'receipt version ambiguity is rejected');
const receiptExtra = clone(receipt);
receiptExtra.surprise = true;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(receiptExtra)), /unsupported fields/, 'receipt extra fields are rejected');
const truthInflation = clone(receipt);
truthInflation.truth.actualRepositoryObjectSetEqualityProven = true;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(truthInflation)), /truth.*actualRepository/, 'actual repository equality truth inflation is rejected');
const gitInflation = clone(receipt);
gitInflation.truth.GitCommandExecuted = true;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(gitInflation)), /truth.*GitCommand/, 'Git execution truth inflation is rejected');
const statusFlip = clone(receipt);
statusFlip.status = 'DRIFT';
statusFlip.truth.objectSetEqualityWithinSignedObservationsProven = false;
statusFlip.truth.objectSetDriftWithinSignedObservationsObserved = true;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(statusFlip)), /status contradicts/, 'self-consistent status flip is rejected');
const malformedDelta = clone(receipt);
malformedDelta.delta.added = {};
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(malformedDelta)), /bounded array/, 'malformed delta array is rejected');
const noncanonicalDelta = clone(combined);
noncanonicalDelta.delta.added.reverse();
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(noncanonicalDelta)), /non-canonical/, 'noncanonical emitted object order is rejected');
const duplicateDelta = clone(added);
duplicateDelta.delta.removed.push(clone(duplicateDelta.delta.added[0]));
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(duplicateDelta)), /multiple delta categories|contradict/, 'object repeated across delta categories is rejected');
const badMetadataSize = clone(metadata);
badMetadataSize.delta.metadataChanged[0].sourceSize = -1;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(badMetadataSize)), /integer/, 'malformed emitted metadata record is rejected');
const forgedSummaryCount = clone(receipt);
forgedSummaryCount.source.objectCount += 1;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(forgedSummaryCount)), /summaries contradict/, 'forged inventory summary count is rejected');
const forgedSummaryBytes = clone(receipt);
forgedSummaryBytes.mirror.totalDeclaredObjectBytes += 1;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(forgedSummaryBytes)), /summaries contradict/, 'forged inventory summary bytes are rejected');
const forgedInventoryLineage = clone(receipt);
forgedInventoryLineage.source.inventoryRef.schema = 'axm.other/v1';
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(forgedInventoryLineage)), /lineage schema/, 'forged inventory lineage schema is rejected');
const forgedAttestationLineage = clone(receipt);
forgedAttestationLineage.source.attestationRef.schema = 'axm.other/v1';
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(forgedAttestationLineage)), /lineage schema/, 'forged attestation lineage schema is rejected');
const forgedObserverLineage = clone(receipt);
forgedObserverLineage.source.observerRef.schema = 'axm.other/v1';
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(forgedObserverLineage)), /lineage schema/, 'forged observer lineage schema is rejected');
const forgedConsentLineage = clone(receipt);
forgedConsentLineage.consentEvaluationRef.id = 'other-consent-evaluation';
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(forgedConsentLineage)), /reference lineage/, 'forged consent lineage id is rejected');
const receiptResourceOverclaim = clone(receipt);
receiptResourceOverclaim.resourceObservation.durationEnforced = true;
expectThrow(() => Comparator.normalizeReceipt(resealReceipt(receiptResourceOverclaim)), /resource observation mismatch/, 'duration enforcement overclaim is rejected');
const receiptByteForgery = clone(receipt);
receiptByteForgery.resourceObservation.receiptBytes += 9;
delete receiptByteForgery.receiptDigest;
receiptByteForgery.receiptDigest = Comparator.sha256(receiptByteForgery);
expectThrow(() => Comparator.normalizeReceipt(receiptByteForgery), /byte observation mismatch/, 'receipt byte observation forgery is rejected');
expectThrow(() => Comparator.verifyReceipt(receipt, exactInput({ mirrorObjects: [record('1', 'blob', 12)] })), /differs from deterministic rebuild/, 'receipt cannot replay against another signed inventory pair');

const heldOutSigner = makeSigner('held-out-git-inventory-observer');
const heldOut = exactInput({
  objectFormat: 'SHA256',
  signers: [heldOutSigner],
  sourceSigner: heldOutSigner,
  mirrorSigner: heldOutSigner,
  sourceObjects: [record('a', 'commit', 101, 'SHA256'), record('b', 'tree', 202, 'SHA256')],
  mirrorObjects: [record('a', 'commit', 101, 'SHA256'), record('c', 'blob', 303, 'SHA256')]
});
const heldOutReceipt = Comparator.compareInventories(heldOut);
ok(heldOutReceipt.status === 'DRIFT', 'held-out signed fixture detects drift');
ok(heldOutReceipt.delta.added[0].oid === oid('c', 'SHA256') && heldOutReceipt.delta.removed[0].oid === oid('b', 'SHA256'), 'held-out drift is exact');
ok(Comparator.verifyReceipt(heldOutReceipt, heldOut).receiptDigest === heldOutReceipt.receiptDigest, 'held-out receipt deterministically verifies');
ok(!heldOutReceipt.truth.persistentLearningAdmitted, 'held-out test admits no persistent learning claim');

const moduleSource = fs.readFileSync(path.join(__dirname, 'git-object-inventory-comparator-v1.js'), 'utf8');
ok(!/require\(['"](?:fs|child_process|http|https|net|tls|vm|worker_threads)['"]\)/.test(moduleSource), 'comparator imports no filesystem, executor, or network primitive');
ok(!/process\.env|\beval\s*\(|new Function/.test(moduleSource), 'comparator has no ambient secret or dynamic evaluation access');
ok(!/mirror-code-clone|\bgit\s+(?:clone|fetch|push|remote|cat-file|rev-list|show-ref|rev-parse)/i.test(moduleSource), 'comparator does not connect clone code or invoke Git');
ok(!/readFile|writeFile|createReadStream|createWriteStream|spawn|execFile|execSync/.test(moduleSource), 'comparator source contains no filesystem or child-process operation');

const schemaFiles = [
  ['git-object-inventory-observation.schema.json', Comparator.INVENTORY_SCHEMA],
  ['git-object-inventory-comparison-request.schema.json', Comparator.REQUEST_SCHEMA],
  ['git-object-inventory-comparator-profile.schema.json', Comparator.PROFILE_SCHEMA],
  ['git-object-inventory-comparison-receipt.schema.json', Comparator.RECEIPT_SCHEMA]
];
schemaFiles.forEach(([file, identity]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  ok(schema.additionalProperties === false, file + ' is strict at the record boundary');
  ok(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', file + ' pins JSON Schema 2020-12');
  ok(schema.$id === identity, file + ' binds its exact schema identity');
  ok(schemaObjectNodesAreClosed(schema), file + ' closes every typed object node');
  ok(localSchemaRefsResolve(schema), file + ' resolves every local schema reference');
});

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-git-object-inventory-comparator-v1.contract.json'), 'utf8'));
ok(contract.status === 'TEST', 'module contract remains TEST');
ok(same(contract.permissions, []), 'module contract grants no permissions');
ok(contract.boundaries.writes.length === 0, 'module contract declares no writes');
ok(contract.boundaries.refuses.includes('git-repository-opening'), 'module contract refuses repository opening');
ok(contract.boundaries.refuses.includes('host-enumeration-completeness-claim'), 'module contract refuses enumeration-completeness claims');
ok(contract.boundaries.refuses.includes('full-clone-reliability-claim'), 'module contract refuses full-clone reliability claims');
ok(contract.boundaries.refuses.includes('automatic-canon'), 'module contract refuses automatic CANON');
ok(Comparator.LIMITATIONS.includes('SIGNED_OBSERVATION_DOES_NOT_PROVE_ENUMERATION_COMPLETENESS'), 'enumeration limitation remains explicit');
ok(Comparator.NEXT_GAPS.includes('mirror.git-ref-set.compare'), 'Git ref-set comparison remains a future gap');
ok(Comparator.NEXT_GAPS.includes('mirror.clone-completeness.verify'), 'clone completeness remains a future gap');
ok(Comparator.NEXT_GAPS.includes('mirror.recovery.replay-test'), 'recovery replay remains a future gap');

console.log('Code Capability Fabric signed Git object-inventory comparator selftest: ' + passed + ' checks passed.');
