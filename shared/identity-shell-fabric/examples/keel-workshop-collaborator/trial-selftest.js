'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Fabric = require('../../identity-shell-fabric');
const Independent = require('../../independent-verifier');

const ROOT = __dirname;
const FIXTURES = path.resolve(ROOT, '..', '..', 'fixtures');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function ref(id, schema, seed) {
  return { id, schema, sha256: Fabric.sha256(seed) };
}

function descriptorRef(descriptor) {
  return { id: descriptor.descriptorId, schema: descriptor.schema, sha256: Fabric.descriptorDigest(descriptor) };
}

function parentRef(parent) {
  return { id: parent.shellId, schema: parent.schema, sha256: parent.manifestDigest };
}

function setSlot(target, slotId, descriptor) {
  const slot = target.slots.find(item => item.slotId === slotId);
  slot.descriptorId = descriptor.descriptorId;
  slot.descriptorVersion = descriptor.descriptorVersion;
  slot.descriptorSha256 = Fabric.descriptorDigest(descriptor);
}

function attachContinuity(target, receipts) {
  target.continuityReceiptRefs = receipts.map(receipt => ({ id: receipt.receiptId, schema: receipt.schema, sha256: receipt.receiptDigest }));
  target.expectedContinuityHeadDigest = receipts.length ? receipts[receipts.length - 1].receiptDigest : null;
  target.lineage.continuityEvidenceRefs = copy(target.continuityReceiptRefs);
}

function compile(targetBlueprint, targetDescriptors, extra = {}) {
  return Fabric.compileShell({
    blueprint: targetBlueprint,
    descriptors: targetDescriptors,
    parentManifests: extra.parentManifests || [],
    continuityReceipts: extra.continuityReceipts || [],
    humanDecisionReceipts: extra.humanDecisionReceipts || []
  });
}

function expectCode(code, action) {
  let observed = null;
  try { action(); } catch (error) { observed = error.code || error.name; }
  assert.strictEqual(observed, code);
}

const blueprint = readJson(path.join(ROOT, 'keel-workshop-collaborator.blueprint.json'));
const descriptors = [
  readJson(path.join(FIXTURES, 'adapters', 'neutral-neural-alpha.adapter.json')),
  readJson(path.join(FIXTURES, 'bodies', 'software-workspace.body.json'))
];
const beta = readJson(path.join(FIXTURES, 'adapters', 'neutral-neural-beta.adapter.json'));

const input = {
  blueprint,
  descriptors,
  parentManifests: [],
  continuityReceipts: [],
  humanDecisionReceipts: []
};
const result = Fabric.compileShell(input);

assert.strictEqual(result.status, 'COMPILED');
assert.strictEqual(result.manifest.shellId, 'keel-workshop-collaborator');
assert.strictEqual(result.manifest.identityRoot.display.label, 'Keel · Codex technical substrate');
assert.deepStrictEqual(result.manifest.identityRoot.roots.map(root => root.id), [
  'agency-nondomination', 'continuity', 'truth', 'wisdom-over-speed'
]);
assert.strictEqual(result.manifest.identityRoot.disclosure.consciousnessClaimed, false);
assert.strictEqual(result.manifest.identityRoot.disclosure.personhoodClaimed, false);
assert.strictEqual(result.manifest.identityRoot.disclosure.subjectiveContinuityClaimed, false);
assert.strictEqual(result.manifest.identityRoot.ownership.controllerKind, 'HUMAN_STEWARD');
assert.strictEqual(result.manifest.identityRoot.ownership.automaticInheritance, false);
assert.strictEqual(result.manifest.identityRoot.ownership.automaticPromotion, false);
assert.strictEqual(result.manifest.continuity.state, 'EMPTY');
assert.deepStrictEqual(result.manifest.continuity.acceptedReceiptDigests, []);
assert.deepStrictEqual(result.manifest.continuity.candidateReceiptDigests, []);
assert.ok(result.manifest.components.every(component => component.descriptor.providerBinding === undefined || component.descriptor.providerBinding.state === 'UNBOUND'));
assert.strictEqual(result.manifest.resourceEnvelope.network.mode, 'DISABLED');
assert.strictEqual(result.manifest.resourceEnvelope.actuation.mode, 'UNAVAILABLE_V0_1');
assert.strictEqual(result.manifest.truth.inert, true);
assert.strictEqual(result.manifest.truth.runtimeClaimed, false);
assert.strictEqual(result.manifest.truth.installed, false);
assert.strictEqual(result.manifest.truth.promoted, false);
assert.strictEqual(result.manifest.truth.canon, false);
assert.strictEqual(Fabric.verifyCompilation(input, result).pass, true);
assert.strictEqual(Independent.verify(result.manifest).verdict, 'PASS');

const rebuilt = Fabric.compileShell(JSON.parse(JSON.stringify(input)));
assert.strictEqual(rebuilt.manifest.manifestDigest, result.manifest.manifestDigest);

const manifestPath = path.join(ROOT, 'keel-workshop-collaborator.manifest.json');
const buildPath = path.join(ROOT, 'keel-workshop-collaborator.build-gap-receipt.json');
const lineagePath = path.join(ROOT, 'keel-workshop-collaborator.lineage-receipt.json');
const committedManifest = fs.readFileSync(manifestPath, 'utf8').trim();
assert.strictEqual(Fabric.exportManifest(result.manifest), committedManifest);
assert.strictEqual(Fabric.canonicalJson(result.buildGapReceipt), fs.readFileSync(buildPath, 'utf8').trim());
assert.strictEqual(Fabric.canonicalJson(result.lineageReceipt), fs.readFileSync(lineagePath, 'utf8').trim());

// Keel-specific fork boundary: copying the shell requires a new identity id.
const sameIdFork = copy(blueprint);
sameIdFork.blueprintId = 'keel-workshop-same-id-fork-trial';
sameIdFork.lineage = {
  eventKind: 'FORK',
  parentManifestRefs: [parentRef(result.manifest)],
  continuityEvidenceRefs: [],
  humanDecisionReceiptRef: null,
  disclosures: [{ kind: 'FORK', statement: 'Synthetic fork trial keeps the exact parent visible.', beforeRef: parentRef(result.manifest), afterRef: null }]
};
expectCode('FORK_IDENTITY_REUSE', () => compile(sameIdFork, descriptors, { parentManifests: [result.manifest] }));
const validFork = copy(sameIdFork);
validFork.blueprintId = 'keel-workshop-distinct-fork-trial';
validFork.identityRoot.shellId = 'keel-workshop-collaborator-fork';
const forked = compile(validFork, descriptors, { parentManifests: [result.manifest] });
assert.strictEqual(forked.status, 'COMPILED');
assert.strictEqual(forked.manifest.lineageReceipt.eventKind, 'FORK');
assert.strictEqual(Independent.verify(forked.manifest).verdict, 'PASS');

// Keel-specific memory boundary: generated content remains candidate until an exact acceptance event exists.
const candidate = Fabric.createContinuityReceipt({
  receiptId: 'keel-trial-candidate-memory',
  policyId: blueprint.continuityPolicy.policyId,
  sequence: 0,
  previousReceiptDigest: null,
  eventType: 'MEMORY_CANDIDATE',
  status: 'CANDIDATE',
  payloadRef: ref('keel-trial-candidate-payload', 'axm.identity-shell.memory-payload/v1', 'keel-trial-candidate-payload'),
  candidateReceiptDigest: null,
  acceptanceReceiptRef: null,
  rollbackTargetDigest: null,
  modelSwapDisclosure: null,
  occurredAt: '2026-08-22T00:32:00.000Z'
});
const acceptance = Fabric.createContinuityReceipt({
  receiptId: 'keel-trial-memory-acceptance',
  policyId: blueprint.continuityPolicy.policyId,
  sequence: 1,
  previousReceiptDigest: candidate.receiptDigest,
  eventType: 'MEMORY_ACCEPTANCE',
  status: 'ACCEPTED',
  payloadRef: ref('keel-trial-acceptance-payload', 'axm.identity-shell.memory-acceptance/v1', 'keel-trial-acceptance-payload'),
  candidateReceiptDigest: candidate.receiptDigest,
  acceptanceReceiptRef: ref('keel-trial-human-acceptance', 'axm.human-acceptance/v1', 'keel-trial-human-acceptance'),
  rollbackTargetDigest: null,
  modelSwapDisclosure: null,
  occurredAt: '2026-08-22T00:33:00.000Z'
});
const memoryState = Fabric.reconstructContinuity(blueprint.continuityPolicy, [candidate, acceptance], acceptance.receiptDigest);
assert.deepStrictEqual(memoryState.candidateReceiptDigests, [candidate.receiptDigest]);
assert.deepStrictEqual(memoryState.acceptedReceiptDigests, [acceptance.receiptDigest]);
expectCode('CANDIDATE_MEMORY_BOUNDARY', () => Fabric.createContinuityReceipt({
  receiptId: 'keel-trial-silent-memory-acceptance',
  policyId: blueprint.continuityPolicy.policyId,
  sequence: 0,
  previousReceiptDigest: null,
  eventType: 'MEMORY_CANDIDATE',
  status: 'ACCEPTED',
  payloadRef: ref('keel-trial-silent-payload', 'axm.identity-shell.memory-payload/v1', 'keel-trial-silent-payload'),
  candidateReceiptDigest: null,
  acceptanceReceiptRef: ref('keel-trial-false-acceptance', 'axm.human-acceptance/v1', 'keel-trial-false-acceptance'),
  rollbackTargetDigest: null,
  modelSwapDisclosure: null,
  occurredAt: '2026-08-22T00:34:00.000Z'
}));

// Keel-specific provider portability: a neural descriptor change needs all migration disclosures.
const originReceipt = Fabric.createContinuityReceipt({
  receiptId: 'keel-trial-accepted-origin',
  policyId: blueprint.continuityPolicy.policyId,
  sequence: 0,
  previousReceiptDigest: null,
  eventType: 'ORIGIN',
  status: 'ACCEPTED',
  payloadRef: ref('keel-trial-origin-payload', 'axm.identity-shell.origin-payload/v1', 'keel-trial-origin-payload'),
  candidateReceiptDigest: null,
  acceptanceReceiptRef: ref('keel-trial-origin-acceptance', 'axm.human-acceptance/v1', 'keel-trial-origin-acceptance'),
  rollbackTargetDigest: null,
  modelSwapDisclosure: null,
  occurredAt: '2026-08-22T00:35:00.000Z'
});
const migration = copy(blueprint);
migration.blueprintId = 'keel-workshop-neural-migration-trial';
setSlot(migration, 'reasoner-slot', beta);
migration.resourceEnvelope.compute.requested = 14;
migration.resourceEnvelope.memory.requested = 2162688;
migration.resourceEnvelope.time.requested = 700;
migration.resourceEnvelope.energy.requested = 2;
migration.lineage = {
  eventKind: 'MIGRATION',
  parentManifestRefs: [parentRef(result.manifest)],
  continuityEvidenceRefs: [],
  humanDecisionReceiptRef: null,
  disclosures: [
    { kind: 'MIGRATION', statement: 'Synthetic Keel migration retains the exact identity and parent digest while declaring the alternate descriptor resource request inside the existing permitted ceiling.', beforeRef: parentRef(result.manifest), afterRef: null },
    { kind: 'ADAPTER_SWAP', statement: 'The inert neural proposal descriptor changes.', beforeRef: descriptorRef(descriptors[0]), afterRef: descriptorRef(beta) }
  ]
};
attachContinuity(migration, [originReceipt]);
expectCode('MODEL_SWAP_UNDISCLOSED', () => compile(migration, [beta, descriptors[1]], { parentManifests: [result.manifest], continuityReceipts: [originReceipt] }));
migration.lineage.disclosures.push({ kind: 'MODEL_OR_CONNECTOR_SWAP', statement: 'The neural slot changed; the runtime provider and connector remain unbound.', beforeRef: descriptorRef(descriptors[0]), afterRef: descriptorRef(beta) });
const migrated = compile(migration, [beta, descriptors[1]], { parentManifests: [result.manifest], continuityReceipts: [originReceipt] });
assert.strictEqual(migrated.status, 'COMPILED');
assert.strictEqual(migrated.manifest.shellId, result.manifest.shellId);
assert.ok(migrated.manifest.lineageReceipt.disclosureKinds.includes('MODEL_OR_CONNECTOR_SWAP'));
assert.strictEqual(Independent.verify(migrated.manifest).verdict, 'PASS');
assert.strictEqual(result.manifest.manifestDigest, 'sha256:575f667d86b5b81784579f080a07c6e6c581545233f2e9c013fa464e78e85307');

process.stdout.write(JSON.stringify({
  status: 'PASS',
  shellId: result.manifest.shellId,
  manifestDigest: result.manifest.manifestDigest,
  independentVerification: 'PASS',
  continuityState: result.manifest.continuity.state,
  scenarios: ['origin-rebuild', 'distinct-fork', 'candidate-memory-acceptance', 'disclosed-neural-migration'],
  runtimeClaimed: false,
  canon: false
}) + '\n');
