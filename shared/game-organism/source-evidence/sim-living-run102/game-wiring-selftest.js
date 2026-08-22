'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ExperimentWorld = require('../../../../shared/experiment-world/experiment-world');
const VerificationSpine = require('../../../../shared/verification-spine/verification-spine');
const Bridge = require('./game-wiring');

const first = Bridge.writeArtifacts();
const second = Bridge.buildArtifacts();

assert.strictEqual(first.mapping.schema, 'axm.sim-living-game-system-wiring-map/v1');
assert.strictEqual(first.mapping.mappings.length, 100);
assert.strictEqual(new Set(first.mapping.mappings.map((item) => item.sourceModuleId)).size, 100);
assert(first.mapping.mappings.every((item) => item.atlasMatches.length === 4));
assert(first.mapping.mappings.every((item) => item.truth.semanticEquivalenceProven === false));
assert.strictEqual(first.atlas.schema, 'axm.game-capability-plan/v1');
assert(first.atlas.items.length > 0 && first.atlas.items.length <= 100);
assert.strictEqual(first.atlas.wiring.sourceModulesMapped, 100);
assert.strictEqual(first.atlas.truth.automaticInstall, false);

assert.strictEqual(first.forge.schema, 'axm.game-forge-project/v1');
assert.strictEqual(first.forge.status, 'DRAFT');
assert.strictEqual(first.forge.systems.length, 100);
assert.strictEqual(new Set(first.forge.systems.map((item) => item.data.sourceModuleId)).size, 100);
assert(first.forge.systems.every((item) => item.data.runtimeEnabled === false && item.data.implementation === 'ABSENT'));
assert.strictEqual(first.forge.truth.sourceModulesExecuted, 0);
assert.strictEqual(first.forge.truth.authoritativeWorldChanged, false);
assert.strictEqual(first.forge.truth.canonicalGameChanged, false);

assert.strictEqual(first.experiment.schema, ExperimentWorld.CHECKPOINT_SCHEMA);
const restored = ExperimentWorld.restore(first.experiment);
assert.strictEqual(restored.status, 'FROZEN');
assert.strictEqual(restored.artifacts.filter((item) => item.kind === 'sim-living-blueprint').length, 100);
assert(restored.artifacts.filter((item) => item.kind === 'sim-living-blueprint').every((item) => item.evidence.length === 1));
assert.strictEqual(restored.truth.canonicalWorkshopChanged, false);
assert.strictEqual(restored.truth.arbitraryCodeExecuted, false);
assert.strictEqual(restored.truth.externalNetworkUsed, false);

assert.strictEqual(first.world.state, 'RECEIVER_VALIDATED_NOT_APPLIED');
assert.strictEqual(first.world.moduleCount, 100);
assert.strictEqual(first.world.batchCount, 2);
assert.deepStrictEqual(first.world.batches.map((batch) => batch.operations.length), [50, 50]);
assert(first.world.batches.flatMap((batch) => batch.operations).every((operation) => operation.type === 'upsert-entity'));
assert.strictEqual(first.world.receiverValidation, 'PASS');
assert.strictEqual(first.world.applyCalled, false);
assert.strictEqual(first.world.stateReadCalled, false);
assert.strictEqual(first.world.worldCreated, false);
assert.strictEqual(first.world.worldId, null);
assert.strictEqual(first.world.expectedRevision, null);
assert.strictEqual(first.world.truth.semanticAndUnitCompatibilityProven, false);
assert.strictEqual(first.world.truth.worldMutated, false);

assert.strictEqual(first.verification.receipts.length, 2);
first.verification.receipts.forEach((receipt) => assert(VerificationSpine.validateReceipt(receipt).pass));
assert.strictEqual(first.verification.report.verdict, 'HELD');
assert.strictEqual(first.verification.report.claim_count, 200);
assert.strictEqual(first.verification.report.holds.length, 100);
assert.strictEqual(first.verification.truth.staticTransportClaimsPassed, 100);
assert.strictEqual(first.verification.truth.runtimeValidatorsMissing, 100);

assert.strictEqual(first.organism.verdict, 'CANDIDATE_READY');
assert.strictEqual(first.organism.truth.executionStarted, false);
assert.strictEqual(first.organism.truth.canonicalGameChanged, false);
assert.strictEqual(first.organism.truth.humanReleaseRequired, true);

assert.strictEqual(first.receipt.routes.gameCapabilityAtlas.sourceModulesMapped, 100);
assert.strictEqual(first.receipt.routes.gameForge.proposedSystems, 100);
assert.strictEqual(first.receipt.routes.experimentWorld.candidateBlueprintArtifacts, 100);
assert.strictEqual(first.receipt.routes.livingWorldState.receiverValidatedOperations, 100);
assert.strictEqual(first.receipt.routes.livingWorldState.applyCalled, false);
assert.strictEqual(first.receipt.routes.verificationSpine.verdict, 'HELD');
assert.strictEqual(first.receipt.capabilityStatus.staticGameSystemWiring, 'READY');
assert(Object.values(first.receipt.authority).every((value) => value === false));

Object.entries(Bridge.OUTPUT_FILES).forEach(([key, name]) => {
  const file = path.join(Bridge.EVIDENCE_DIR, name);
  assert(fs.existsSync(file), name + ' was not written');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), first[key]);
});

for (const key of Object.keys(Bridge.OUTPUT_FILES)) {
  assert.strictEqual(Bridge.digest(first[key]), Bridge.digest(second[key]), key + ' must build deterministically');
}

console.log('Sim Living game wiring selftest: PASS - 100/100 modules cross six static game seams; world apply 0; runtime and authority held');
