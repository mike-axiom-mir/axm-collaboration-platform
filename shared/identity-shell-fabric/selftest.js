'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Fabric = require('./identity-shell-fabric');
const Independent = require('./independent-verifier');

const FIXTURES = path.join(__dirname, 'fixtures');
function json(relative) { return JSON.parse(fs.readFileSync(path.join(FIXTURES, relative), 'utf8')); }
function copy(value) { return Fabric.clone(value); }
function ref(id, schema, seed) { return { id, schema, sha256: Fabric.sha256(seed) }; }
function componentRef(descriptor) { return { id: descriptor.descriptorId, schema: descriptor.schema, sha256: Fabric.descriptorDigest(descriptor) }; }

const baseBlueprint = json('blueprints/sample-portable-shell.blueprint.json');
const alpha = json('adapters/neutral-neural-alpha.adapter.json');
const beta = json('adapters/neutral-neural-beta.adapter.json');
const softwareBody = json('bodies/software-workspace.body.json');
const roboticBody = json('bodies/robotic-observer.body.json');

const schemaFiles = [
  'adapter-descriptor.schema.json', 'body-descriptor.schema.json', 'build-gap-receipt.schema.json',
  'compiled-shell-manifest.schema.json', 'continuity-event.schema.json', 'continuity-policy.schema.json',
  'human-decision-receipt.schema.json', 'identity-root.schema.json', 'lineage-receipt.schema.json',
  'resource-envelope.schema.json', 'shell-blueprint.schema.json'
];

let assertions = 0;
function ok(condition, label) { assert.ok(condition, label); assertions += 1; }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); assertions += 1; }
function expectCode(code, fn, label) {
  let observed = null;
  try { fn(); } catch (error) { observed = error.code || error.name; }
  assert.strictEqual(observed, code, label + ' (observed ' + observed + ')');
  assertions += 1;
}

function compile(blueprint, descriptors, extra) {
  return Fabric.compileShell({
    blueprint,
    descriptors,
    parentManifests: extra && extra.parentManifests || [],
    continuityReceipts: extra && extra.continuityReceipts || [],
    humanDecisionReceipts: extra && extra.humanDecisionReceipts || []
  });
}

function setSlot(blueprint, slotId, descriptor) {
  const slot = blueprint.slots.find(item => item.slotId === slotId);
  slot.descriptorId = descriptor.descriptorId;
  slot.descriptorVersion = descriptor.descriptorVersion;
  slot.descriptorSha256 = Fabric.descriptorDigest(descriptor);
}

function acceptedOriginReceipt() {
  return Fabric.createContinuityReceipt({
    receiptId: 'accepted-origin-event',
    policyId: baseBlueprint.continuityPolicy.policyId,
    sequence: 0,
    previousReceiptDigest: null,
    eventType: 'ORIGIN',
    status: 'ACCEPTED',
    payloadRef: ref('origin-payload', 'axm.identity-shell.origin-payload/v1', 'origin-payload'),
    candidateReceiptDigest: null,
    acceptanceReceiptRef: ref('origin-acceptance', 'axm.human-acceptance/v1', 'origin-acceptance'),
    rollbackTargetDigest: null,
    modelSwapDisclosure: null,
    occurredAt: '2026-08-22T00:00:00.000Z'
  });
}

function attachContinuity(blueprint, receipts) {
  blueprint.continuityReceiptRefs = receipts.map(receipt => ({ id: receipt.receiptId, schema: receipt.schema, sha256: receipt.receiptDigest }));
  blueprint.expectedContinuityHeadDigest = receipts.length ? receipts[receipts.length - 1].receiptDigest : null;
  blueprint.lineage.continuityEvidenceRefs = copy(blueprint.continuityReceiptRefs);
}

function parentRef(parent) {
  return { id: parent.shellId, schema: parent.schema, sha256: parent.manifestDigest };
}

// Baseline deterministic compilation and pure-input boundary.
const baseInputBlueprint = copy(baseBlueprint);
const baseDescriptors = [copy(alpha), copy(softwareBody)];
const beforeInputs = Fabric.canonicalJson({ baseInputBlueprint, baseDescriptors });
const origin = compile(baseInputBlueprint, baseDescriptors);
equal(origin.status, 'COMPILED', 'origin blueprint compiles');
equal(origin.manifest.status, 'EXPERIMENTAL', 'manifest remains EXPERIMENTAL');
ok(origin.manifest.truth.inert && !origin.manifest.truth.runtimeClaimed, 'manifest is explicitly inert');
ok(!origin.manifest.truth.installed && !origin.manifest.truth.promoted && !origin.manifest.truth.canon, 'manifest cannot self-install, promote, or canonize');
equal(Fabric.canonicalJson({ baseInputBlueprint, baseDescriptors }), beforeInputs, 'compiler does not mutate caller inputs');
const rebuilt = compile(copy(baseBlueprint), [copy(alpha), copy(softwareBody)]);
equal(rebuilt.manifest.manifestDigest, origin.manifest.manifestDigest, 'same canonical inputs produce the same manifest digest');
ok(Fabric.verifyCompilation({ blueprint: copy(baseBlueprint), descriptors: [copy(alpha), copy(softwareBody)], parentManifests: [], continuityReceipts: [], humanDecisionReceipts: [] }, origin).pass, 'exact compilation rebuild verifies');
equal(Independent.verify(origin.manifest).verdict, 'PASS', 'independent manifest verifier passes');
const exported = Fabric.exportManifest(origin.manifest);
equal(Fabric.exportManifest(Fabric.importManifest(exported)), exported, 'canonical export/import round trip is byte exact');
ok(schemaFiles.every(name => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', name), 'utf8'));
  return schema.$id && schema.type === 'object' && schema.additionalProperties === false;
}), 'all public artifact schemas parse and close their root object shape');

// Strict shape, type, alias, and ambiguity refusal.
const extraField = copy(baseBlueprint); extraField.surprise = true;
expectCode('UNKNOWN_OR_MISSING_FIELD', () => compile(extraField, [alpha, softwareBody]), 'unknown blueprint fields are rejected');
const coerced = copy(baseBlueprint); coerced.resourceEnvelope.compute.requested = '20';
expectCode('COERCION_REFUSED', () => compile(coerced, [alpha, softwareBody]), 'numeric strings are not coerced');
const duplicateSlot = copy(baseBlueprint); duplicateSlot.slots.push(copy(duplicateSlot.slots[0]));
expectCode('DUPLICATE_ID', () => compile(duplicateSlot, [alpha, softwareBody]), 'duplicate slot ids are rejected');
const ambiguousBeta = copy(alpha); ambiguousBeta.descriptorVersion = '0.1.1';
expectCode('AMBIGUOUS_COMPONENT_VERSION', () => compile(baseBlueprint, [alpha, ambiguousBeta, softwareBody]), 'ambiguous descriptor versions are rejected');
const uppercaseId = copy(baseBlueprint); uppercaseId.identityRoot.shellId = 'Sample-Shell';
expectCode('NON_PORTABLE_ID', () => compile(uppercaseId, [alpha, softwareBody]), 'case aliases are rejected');
const unicodeId = copy(baseBlueprint); unicodeId.identityRoot.shellId = 'café-shell';
expectCode('NON_PORTABLE_ID', () => compile(unicodeId, [alpha, softwareBody]), 'Unicode identifier aliases are rejected');
const windowsId = copy(baseBlueprint); windowsId.identityRoot.shellId = 'con.shell';
expectCode('WINDOWS_ALIAS_HAZARD', () => compile(windowsId, [alpha, softwareBody]), 'Windows reserved aliases are rejected');
const pathId = copy(baseBlueprint); pathId.identityRoot.shellId = 'sample/shell';
expectCode('NON_PORTABLE_ID', () => compile(pathId, [alpha, softwareBody]), 'path-shaped ids are rejected');

// Descriptor binding, role, authority, resource, network, and body boundaries.
const substituted = copy(baseBlueprint); substituted.slots[0].descriptorSha256 = Fabric.descriptorDigest(beta);
expectCode('DIGEST_MISMATCH', () => compile(substituted, [alpha, softwareBody]), 'descriptor digest substitution is rejected');
const roleMismatch = copy(baseBlueprint); roleMismatch.slots[0].role = 'OUTPUT';
expectCode('ROLE_MISMATCH', () => compile(roleMismatch, [alpha, softwareBody]), 'adapter role mismatch is rejected');
const permissionExpansion = copy(alpha); permissionExpansion.requestedPermissions.push('network.use');
const permissionBlueprint = copy(baseBlueprint); setSlot(permissionBlueprint, 'reasoner-slot', permissionExpansion);
expectCode('AUTHORITY_EXPANSION', () => compile(permissionBlueprint, [permissionExpansion, softwareBody]), 'component permissions cannot expand shell authority');
const resourceExpansion = copy(alpha); resourceExpansion.resourceRequest.computeUnits = 20;
const resourceBlueprint = copy(baseBlueprint); setSlot(resourceBlueprint, 'reasoner-slot', resourceExpansion);
expectCode('RESOURCE_EXPANSION', () => compile(resourceBlueprint, [resourceExpansion, softwareBody]), 'component resources cannot expand requested or permitted limits');
const networkExpansion = copy(alpha); networkExpansion.resourceRequest.networkDomains = ['example.test'];
const networkBlueprint = copy(baseBlueprint); setSlot(networkBlueprint, 'reasoner-slot', networkExpansion);
expectCode('AUTHORITY_EXPANSION', () => compile(networkBlueprint, [networkExpansion, softwareBody]), 'component network scope cannot expand a disabled envelope');
const actuationAttempt = copy(roboticBody); actuationAttempt.actuationBoundary.allowedInterfaceIds = ['sensor-observation-input'];
expectCode('ACTUATION_UNAVAILABLE', () => Fabric.normalizeBodyDescriptor(actuationAttempt), 'robotic actuation interfaces are unavailable in v0.1');
const actuationResourceAttempt = copy(roboticBody); actuationResourceAttempt.resourceRequest.actuationOperations = 1;
expectCode('ACTUATION_UNAVAILABLE', () => Fabric.normalizeBodyDescriptor(actuationResourceAttempt), 'robotic actuation operations are unavailable in v0.1');
const unknownResource = copy(baseBlueprint); unknownResource.resourceEnvelope.compute = { state: 'UNKNOWN', unit: 'abstract-compute-unit', requested: null, permitted: null };
const resourceHold = compile(unknownResource, [alpha, softwareBody]);
equal(resourceHold.status, 'HOLD', 'UNKNOWN resource ceiling emits HOLD');
ok(resourceHold.buildGapReceipt.gaps.some(item => item.capabilityId === 'shell.resource.ceiling.known'), 'UNKNOWN resource ceiling emits a typed capability gap');
const unknownUnlimited = copy(unknownResource); unknownUnlimited.resourceEnvelope.compute.permitted = 999;
expectCode('UNKNOWN_NOT_UNLIMITED', () => compile(unknownUnlimited, [alpha, softwareBody]), 'UNKNOWN resource is never coerced to unlimited');

// Candidate memory, accepted receipts, history order, replay drift, and rollback.
const candidate = Fabric.createContinuityReceipt({
  receiptId: 'candidate-memory-event', policyId: baseBlueprint.continuityPolicy.policyId, sequence: 0,
  previousReceiptDigest: null, eventType: 'MEMORY_CANDIDATE', status: 'CANDIDATE',
  payloadRef: ref('candidate-memory-payload', 'axm.identity-shell.memory-payload/v1', 'candidate-memory'),
  candidateReceiptDigest: null, acceptanceReceiptRef: null, rollbackTargetDigest: null, modelSwapDisclosure: null,
  occurredAt: '2026-08-22T00:01:00.000Z'
});
const acceptance = Fabric.createContinuityReceipt({
  receiptId: 'accepted-memory-event', policyId: baseBlueprint.continuityPolicy.policyId, sequence: 1,
  previousReceiptDigest: candidate.receiptDigest, eventType: 'MEMORY_ACCEPTANCE', status: 'ACCEPTED',
  payloadRef: ref('accepted-memory-payload', 'axm.identity-shell.memory-acceptance/v1', 'accepted-memory'),
  candidateReceiptDigest: candidate.receiptDigest,
  acceptanceReceiptRef: ref('memory-human-acceptance', 'axm.human-acceptance/v1', 'memory-human-acceptance'),
  rollbackTargetDigest: null, modelSwapDisclosure: null, occurredAt: '2026-08-22T00:02:00.000Z'
});
const reconstructed = Fabric.reconstructContinuity(baseBlueprint.continuityPolicy, [candidate, acceptance], acceptance.receiptDigest);
equal(reconstructed.state, 'RECONSTRUCTED', 'accepted receipt chain reconstructs');
equal(reconstructed.candidateReceiptDigests[0], candidate.receiptDigest, 'candidate memory stays separately visible');
expectCode('CANDIDATE_MEMORY_BOUNDARY', () => Fabric.createContinuityReceipt({
  receiptId: 'false-accepted-candidate', policyId: baseBlueprint.continuityPolicy.policyId, sequence: 0,
  previousReceiptDigest: null, eventType: 'MEMORY_CANDIDATE', status: 'ACCEPTED',
  payloadRef: ref('false-memory', 'axm.identity-shell.memory-payload/v1', 'false-memory'),
  candidateReceiptDigest: null, acceptanceReceiptRef: ref('false-acceptance', 'axm.human-acceptance/v1', 'false-acceptance'),
  rollbackTargetDigest: null, modelSwapDisclosure: null, occurredAt: '2026-08-22T00:03:00.000Z'
}), 'candidate memory cannot be silently marked accepted');
expectCode('CHAIN_MISMATCH', () => Fabric.reconstructContinuity(baseBlueprint.continuityPolicy, [acceptance, candidate], candidate.receiptDigest), 'reordered history is rejected');
const alteredCandidate = copy(candidate); alteredCandidate.payloadRef.sha256 = Fabric.sha256('altered');
expectCode('DIGEST_MISMATCH', () => Fabric.verifyContinuityReceipt(alteredCandidate), 'altered history fails receipt replay');
const badRollback = Fabric.createContinuityReceipt({
  receiptId: 'bad-rollback-event', policyId: baseBlueprint.continuityPolicy.policyId, sequence: 2,
  previousReceiptDigest: acceptance.receiptDigest, eventType: 'ROLLBACK', status: 'ACCEPTED',
  payloadRef: ref('rollback-payload', 'axm.identity-shell.rollback/v1', 'rollback'), candidateReceiptDigest: null,
  acceptanceReceiptRef: ref('rollback-acceptance', 'axm.human-acceptance/v1', 'rollback-acceptance'),
  rollbackTargetDigest: Fabric.sha256('not-in-history'), modelSwapDisclosure: null, occurredAt: '2026-08-22T00:04:00.000Z'
});
expectCode('ROLLBACK_MISMATCH', () => Fabric.reconstructContinuity(baseBlueprint.continuityPolicy, [candidate, acceptance, badRollback], badRollback.receiptDigest), 'rollback target mismatch is rejected');

// Export privacy and canonical import boundaries.
const privatePath = copy(baseBlueprint); privatePath.identityRoot.display.description = 'Synthetic fixture at ' + ['D:', 'private', 'shell.json'].join('\\');
expectCode('PRIVATE_OR_MACHINE_DATA', () => compile(privatePath, [alpha, softwareBody]), 'machine paths cannot enter exportable shell state');
expectCode('PRIVATE_OR_MACHINE_DATA', () => Fabric.assertExportSafe({ privateChat: 'not retained' }), 'private chat fields are rejected');
expectCode('PRIVATE_OR_MACHINE_DATA', () => Fabric.assertExportSafe({ note: 'person@example.test' }), 'personal email-shaped data is rejected');
expectCode('PRIVATE_OR_MACHINE_DATA', () => Fabric.assertExportSafe({ note: '01a026ae-cf60-7be3-aca2-b2b151ce1006' }), 'session-or-record-id-shaped data is rejected');
expectCode('NON_CANONICAL_EXPORT', () => Fabric.importManifest(JSON.stringify(origin.manifest, null, 2)), 'non-canonical manifest bytes are rejected');

// Fork, migration, adapter/body portability, model-swap disclosure, and parent immutability.
const parent = origin.manifest;
const forkSameId = copy(baseBlueprint);
forkSameId.blueprintId = 'sample-fork-same-id';
forkSameId.lineage = { eventKind: 'FORK', parentManifestRefs: [parentRef(parent)], continuityEvidenceRefs: [], humanDecisionReceiptRef: null, disclosures: [{ kind: 'FORK', statement: 'Synthetic fork declaration.', beforeRef: parentRef(parent), afterRef: null }] };
expectCode('FORK_IDENTITY_REUSE', () => compile(forkSameId, [alpha, softwareBody], { parentManifests: [parent] }), 'a copied shell cannot reuse the parent identity id');
const fork = copy(forkSameId); fork.blueprintId = 'sample-fork-new-id'; fork.identityRoot.shellId = 'sample-portable-shell-fork';
equal(compile(fork, [alpha, softwareBody], { parentManifests: [parent] }).manifest.lineageReceipt.eventKind, 'FORK', 'a copied shell compiles only as a FORK with a new id');

const continuity = acceptedOriginReceipt();
const migration = copy(baseBlueprint);
migration.blueprintId = 'sample-neural-migration';
setSlot(migration, 'reasoner-slot', beta);
migration.lineage = {
  eventKind: 'MIGRATION', parentManifestRefs: [parentRef(parent)], continuityEvidenceRefs: [], humanDecisionReceiptRef: null,
  disclosures: [
    { kind: 'MIGRATION', statement: 'Synthetic migration keeps the shell id and exact parent digest visible.', beforeRef: parentRef(parent), afterRef: null },
    { kind: 'ADAPTER_SWAP', statement: 'The inert neural adapter descriptor changed.', beforeRef: componentRef(alpha), afterRef: componentRef(beta) }
  ]
};
attachContinuity(migration, [continuity]);
expectCode('MODEL_SWAP_UNDISCLOSED', () => compile(migration, [beta, softwareBody], { parentManifests: [parent], continuityReceipts: [continuity] }), 'neural descriptor swap without model-or-connector disclosure is rejected');
migration.lineage.disclosures.push({ kind: 'MODEL_OR_CONNECTOR_SWAP', statement: 'The neural slot changed; runtime provider and connector remain unbound.', beforeRef: componentRef(alpha), afterRef: componentRef(beta) });
const migrated = compile(migration, [beta, softwareBody], { parentManifests: [parent], continuityReceipts: [continuity] });
equal(migrated.status, 'COMPILED', 'second inert neural descriptor demonstrates disclosed portability');
equal(parent.manifestDigest, origin.manifest.manifestDigest, 'migration does not mutate the parent manifest');

const bodyMigration = copy(baseBlueprint);
bodyMigration.blueprintId = 'sample-body-migration';
setSlot(bodyMigration, 'body-slot', roboticBody);
bodyMigration.lineage = {
  eventKind: 'MIGRATION', parentManifestRefs: [parentRef(parent)], continuityEvidenceRefs: [], humanDecisionReceiptRef: null,
  disclosures: [
    { kind: 'MIGRATION', statement: 'Synthetic body migration keeps the parent digest visible.', beforeRef: parentRef(parent), afterRef: null },
    { kind: 'BODY_SWAP', statement: 'The software body descriptor changed to an inert robotic observation descriptor.', beforeRef: componentRef(softwareBody), afterRef: componentRef(roboticBody) }
  ]
};
attachContinuity(bodyMigration, [continuity]);
const bodyMigrated = compile(bodyMigration, [alpha, roboticBody], { parentManifests: [parent], continuityReceipts: [continuity] });
equal(bodyMigrated.status, 'COMPILED', 'second inert body descriptor demonstrates portability without actuation');
ok(!bodyMigrated.manifest.truth.actuationPerformed, 'robotic-class body remains non-actuating');

const reconstruction = copy(baseBlueprint);
reconstruction.blueprintId = 'sample-shell-reconstruction';
reconstruction.lineage = {
  eventKind: 'RECONSTRUCTION', parentManifestRefs: [parentRef(parent)], continuityEvidenceRefs: [], humanDecisionReceiptRef: null,
  disclosures: [{ kind: 'RECONSTRUCTION', statement: 'Synthetic reconstruction uses exact accepted receipts and the same shell id.', beforeRef: parentRef(parent), afterRef: null }]
};
attachContinuity(reconstruction, [continuity]);
const reconstructedShell = compile(reconstruction, [alpha, softwareBody], { parentManifests: [parent], continuityReceipts: [continuity] });
equal(reconstructedShell.manifest.lineageReceipt.eventKind, 'RECONSTRUCTION', 'shell reconstruction compiles from exact continuity and parent evidence');
equal(Independent.verify(reconstructedShell.manifest).verdict, 'PASS', 'independent verifier accepts a valid reconstruction manifest');

const falseContinuation = copy(fork);
falseContinuation.blueprintId = 'false-continuation-migration';
falseContinuation.lineage.eventKind = 'MIGRATION';
falseContinuation.lineage.disclosures = [{ kind: 'MIGRATION', statement: 'Invalid migration label for a new shell id.', beforeRef: parentRef(parent), afterRef: null }];
attachContinuity(falseContinuation, [continuity]);
expectCode('LINEAGE_MISMATCH', () => compile(falseContinuation, [alpha, softwareBody], { parentManifests: [parent], continuityReceipts: [continuity] }), 'a fork cannot be falsely labelled continuation or migration');

// Human-gated succession proposal: missing authority holds; exact synthetic test receipt compiles a proposal but never makes succession effective.
const succession = copy(baseBlueprint);
succession.blueprintId = 'sample-successor-proposal';
succession.identityRoot.shellId = 'sample-successor-shell';
succession.lineage = {
  eventKind: 'SUCCESSION_PROPOSAL', parentManifestRefs: [parentRef(parent)], continuityEvidenceRefs: [], humanDecisionReceiptRef: null,
  disclosures: [{ kind: 'SUCCESSION', statement: 'Synthetic succession proposal is distinct from fork and remains externally gated.', beforeRef: parentRef(parent), afterRef: null }]
};
attachContinuity(succession, [continuity]);
const successionHold = compile(succession, [alpha, softwareBody], { parentManifests: [parent], continuityReceipts: [continuity] });
equal(successionHold.status, 'HOLD', 'succession without a human receipt emits HOLD');
ok(successionHold.buildGapReceipt.gaps.some(item => item.gapType === 'AUTHORITY'), 'succession HOLD names the authority gap');
const decision = Fabric.createHumanDecisionReceipt({
  decisionId: 'synthetic-succession-decision',
  decisionAt: '2026-08-22T00:05:00.000Z',
  actor: { kind: 'HUMAN', id: 'synthetic-reviewer', authorshipVerificationRef: ref('synthetic-authorship-check', 'axm.external-human-authorship-check/v1', 'synthetic-authorship') },
  subject: { eventKind: 'SUCCESSION_PROPOSAL', parentShellId: parent.shellId, parentManifestDigest: parent.manifestDigest, proposedShellId: succession.identityRoot.shellId, proposalDigest: Fabric.successionProposalDigest(succession) },
  decision: 'AUTHORIZE_SUCCESSION_PROPOSAL',
  consent: { explicit: true, scope: 'SINGLE_LINEAGE_PROPOSAL', automatic: false },
  lineageEvidenceRefs: [parentRef(parent)],
  continuityEvidenceRefs: copy(succession.continuityReceiptRefs),
  confirmation: 'AUTHORIZE SUCCESSION PROPOSAL'
});
succession.lineage.humanDecisionReceiptRef = { id: decision.decisionId, schema: decision.schema, sha256: decision.receiptDigest };
const successor = compile(succession, [alpha, softwareBody], { parentManifests: [parent], continuityReceipts: [continuity], humanDecisionReceipts: [decision] });
equal(successor.status, 'COMPILED', 'exact synthetic human receipt compiles an inert succession proposal');
equal(successor.manifest.lifecycleState, 'SUCCESSION_PROPOSED', 'succession remains only proposed');
ok(!successor.manifest.lineageReceipt.truth.successionEffective && !successor.manifest.lineageReceipt.truth.automaticInheritance, 'compiler cannot make succession effective or automatic');
equal(Independent.verify(successor.manifest).verdict, 'PASS', 'independent verifier accepts a valid externally gated succession proposal');
const modelDecision = copy(decision); modelDecision.actor.kind = 'MODEL';
expectCode('UNSUPPORTED_VALUE', () => Fabric.verifyHumanDecisionReceipt(modelDecision), 'a child or model cannot select inheritance');

const retirement = copy(baseBlueprint);
retirement.blueprintId = 'sample-retirement-proposal';
retirement.lineage = {
  eventKind: 'RETIREMENT_PROPOSAL', parentManifestRefs: [parentRef(parent)], continuityEvidenceRefs: [], humanDecisionReceiptRef: null,
  disclosures: [{ kind: 'RETIREMENT', statement: 'Synthetic retirement remains a proposal for an external human gate.', beforeRef: parentRef(parent), afterRef: null }]
};
attachContinuity(retirement, [continuity]);
const retirementDecision = Fabric.createHumanDecisionReceipt({
  decisionId: 'synthetic-retirement-decision', decisionAt: '2026-08-22T00:06:00.000Z',
  actor: { kind: 'HUMAN', id: 'synthetic-reviewer', authorshipVerificationRef: ref('synthetic-retirement-authorship', 'axm.external-human-authorship-check/v1', 'synthetic-retirement-authorship') },
  subject: { eventKind: 'RETIREMENT_PROPOSAL', parentShellId: parent.shellId, parentManifestDigest: parent.manifestDigest, proposedShellId: retirement.identityRoot.shellId, proposalDigest: Fabric.successionProposalDigest(retirement) },
  decision: 'AUTHORIZE_RETIREMENT_PROPOSAL', consent: { explicit: true, scope: 'SINGLE_LINEAGE_PROPOSAL', automatic: false },
  lineageEvidenceRefs: [parentRef(parent)], continuityEvidenceRefs: copy(retirement.continuityReceiptRefs), confirmation: 'AUTHORIZE RETIREMENT PROPOSAL'
});
retirement.lineage.humanDecisionReceiptRef = { id: retirementDecision.decisionId, schema: retirementDecision.schema, sha256: retirementDecision.receiptDigest };
const retirementResult = compile(retirement, [alpha, softwareBody], { parentManifests: [parent], continuityReceipts: [continuity], humanDecisionReceipts: [retirementDecision] });
equal(retirementResult.manifest.lifecycleState, 'RETIREMENT_PROPOSED', 'retirement remains an externally gated proposal');
ok(!retirementResult.manifest.lineageReceipt.truth.retirementEffective, 'compiler cannot make retirement effective');
equal(Independent.verify(retirementResult.manifest).verdict, 'PASS', 'independent verifier accepts a valid externally gated retirement proposal');

// Empty/fake capability and self-promotion refusal.
const emptyShell = copy(baseBlueprint); emptyShell.slots = [];
expectCode('ARRAY_BOUNDARY', () => compile(emptyShell, []), 'empty shell is rejected');
const fakeAdapter = copy(alpha); fakeAdapter.contracts.produces = [];
expectCode('ARRAY_BOUNDARY', () => Fabric.normalizeAdapterDescriptor(fakeAdapter), 'fake adapter with no produced contract is rejected');
const automaticInheritance = copy(baseBlueprint); automaticInheritance.identityRoot.ownership.automaticInheritance = true;
expectCode('BOUNDARY_VIOLATION', () => compile(automaticInheritance, [alpha, softwareBody]), 'blueprint cannot select automatic inheritance');
const promoted = copy(origin.manifest); promoted.truth.promoted = true; const promotedPayload = copy(promoted); delete promotedPayload.manifestDigest; promoted.manifestDigest = Fabric.sha256(promotedPayload);
expectCode('BOUNDARY_VIOLATION', () => Fabric.verifyManifest(promoted), 'manifest cannot promote itself even with a recomputed digest');
equal(Independent.verify(promoted).verdict, 'FAIL', 'independent verifier also rejects self-promotion');

// Independent verifier semantic regressions: a valid top digest cannot legitimize unsafe nested state.
function resignManifest(value) {
  const output = copy(value);
  delete output.manifestDigest;
  output.manifestDigest = Fabric.sha256(output);
  return output;
}
function resignEmbeddedDescriptor(value, index) {
  value.components[index].descriptorRef.sha256 = Fabric.sha256(value.components[index].descriptor);
}
function resignContinuityState(value) {
  const core = copy(value.continuity);
  delete core.stateDigest;
  value.continuity.stateDigest = Fabric.sha256(core);
}
function resignLineage(value) {
  const core = copy(value.lineageReceipt);
  delete core.receiptDigest;
  value.lineageReceipt.receiptDigest = Fabric.sha256(core);
}
function independentReject(value, label) {
  equal(Independent.verify(resignManifest(value)).verdict, 'FAIL', label);
}

const unsafePortability = copy(origin.manifest); unsafePortability.portability.machinePathsIncluded = true;
independentReject(unsafePortability, 'independent verifier rejects re-digested unsafe portability flags');
const falseEmptyContinuity = copy(origin.manifest); falseEmptyContinuity.continuity.acceptedReceiptDigests = [Fabric.sha256('false-accepted-history')]; resignContinuityState(falseEmptyContinuity);
independentReject(falseEmptyContinuity, 'independent verifier rejects EMPTY continuity with accepted history');
const coercedResource = copy(origin.manifest); coercedResource.components[1].descriptor.resourceRequest.computeUnits = '10'; resignEmbeddedDescriptor(coercedResource, 1);
independentReject(coercedResource, 'independent verifier rejects numeric-string resource coercion');
const negativeEnvelope = copy(origin.manifest); negativeEnvelope.resourceEnvelope.compute.requested = -1;
independentReject(negativeEnvelope, 'independent verifier rejects negative resource ceilings');
const boundProvider = copy(origin.manifest); boundProvider.components[1].descriptor.providerBinding = { state: 'BOUND', providerFamily: 'synthetic', modelId: 'synthetic', connectorId: 'synthetic' }; resignEmbeddedDescriptor(boundProvider, 1);
independentReject(boundProvider, 'independent verifier rejects provider binding in v0.1');
const descriptorAuthority = copy(origin.manifest); descriptorAuthority.components[1].descriptor.truth.memoryAuthority = true; resignEmbeddedDescriptor(descriptorAuthority, 1);
independentReject(descriptorAuthority, 'independent verifier rejects descriptor memory authority');
const mismatchedRole = copy(origin.manifest); mismatchedRole.components[1].role = 'OUTPUT';
independentReject(mismatchedRole, 'independent verifier rejects wrapper and descriptor role mismatch');
const consciousnessClaim = copy(origin.manifest); consciousnessClaim.identityRoot.disclosure.consciousnessClaimed = true;
independentReject(consciousnessClaim, 'independent verifier rejects identity-root consciousness claims');
const inheritedAuthority = copy(origin.manifest); inheritedAuthority.identityRoot.ownership.automaticInheritance = true;
independentReject(inheritedAuthority, 'independent verifier rejects automatic inheritance in identity root');
const lifecycleMismatch = copy(origin.manifest); lifecycleMismatch.lifecycleState = 'SUCCESSION_PROPOSED';
independentReject(lifecycleMismatch, 'independent verifier couples lifecycle state to lineage event');
const lineageShellMismatch = copy(origin.manifest); lineageShellMismatch.lineageReceipt.shellId = 'different-shell'; resignLineage(lineageShellMismatch);
independentReject(lineageShellMismatch, 'independent verifier rejects lineage shell-id drift');
const lineagePromotion = copy(origin.manifest); lineagePromotion.lineageReceipt.truth.automaticPromotion = true; resignLineage(lineagePromotion);
independentReject(lineagePromotion, 'independent verifier rejects lineage automatic promotion');
const independentNetworkExpansion = copy(origin.manifest); independentNetworkExpansion.components[1].descriptor.resourceRequest.networkDomains = ['example.test']; resignEmbeddedDescriptor(independentNetworkExpansion, 1);
independentReject(independentNetworkExpansion, 'independent verifier rejects component network expansion');
const expandedTruth = copy(origin.manifest); expandedTruth.truth.identityStateExpandedByAttachment = true;
independentReject(expandedTruth, 'independent verifier rejects identity expansion by attachment');
const wrongParentSchema = copy(reconstructedShell.manifest); wrongParentSchema.lineageReceipt.parentManifestRefs[0].schema = 'axm.identity-shell.wrong-parent/v1'; resignLineage(wrongParentSchema);
independentReject(wrongParentSchema, 'independent verifier rejects parent reference schema substitution');
const wrongContinuitySchema = copy(reconstructedShell.manifest); wrongContinuitySchema.lineageReceipt.continuityEvidenceRefs[0].schema = 'axm.identity-shell.wrong-continuity/v1'; resignLineage(wrongContinuitySchema);
independentReject(wrongContinuitySchema, 'independent verifier rejects continuity reference schema substitution');
const wrongHumanSchema = copy(successor.manifest); wrongHumanSchema.lineageReceipt.humanDecisionReceiptRef.schema = 'axm.identity-shell.wrong-human-decision/v1'; resignLineage(wrongHumanSchema);
independentReject(wrongHumanSchema, 'independent verifier rejects human-decision reference schema substitution');
const malformedIndependentInputs = [null, {}, [], 'not-a-manifest', 42];
malformedIndependentInputs.forEach((value, index) => equal(Independent.verify(value).verdict, 'FAIL', 'independent verifier returns FAIL without throwing for malformed input ' + index));

// Rebuild mismatch is visible rather than averaged into confidence.
const driftedResult = copy(origin); driftedResult.buildGapReceipt.truth.runtimeClaimFollows = true;
ok(!Fabric.verifyCompilation({ blueprint: baseBlueprint, descriptors: [alpha, softwareBody], parentManifests: [], continuityReceipts: [], humanDecisionReceipts: [] }, driftedResult).pass, 'compilation replay drift is detected');

console.log('PASS identity-shell-fabric: ' + assertions + ' assertions');
