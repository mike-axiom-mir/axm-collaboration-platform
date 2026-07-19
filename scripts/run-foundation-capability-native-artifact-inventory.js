'use strict';

const Inventory = require('../organs/foundation-capability-native-artifact-inventory-organ');

try {
  const result = Inventory.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    state: result.batch.state,
    sourceAdapterRequestBatchId: result.batch.source.adapterRequestBatchId,
    inventoryDeclarationsRead: result.batch.summary.inventoryDeclarationsRead,
    verifiedInventoryDeclarations: result.batch.summary.verifiedInventoryDeclarations,
    rootsDeclared: result.batch.summary.rootsDeclared,
    optionalRootsAbsent: result.batch.summary.optionalRootsAbsent,
    matchingArtifactFiles: result.batch.summary.matchingArtifactFiles,
    nativeArtifactRootSchemaWitnesses: result.batch.summary.nativeArtifactRootSchemaWitnesses,
    genericEnvelopeCompatibleWitnesses: result.batch.summary.genericEnvelopeCompatibleWitnesses,
    genericEnvelopeBoundaryRefusals: result.batch.summary.genericEnvelopeBoundaryRefusals,
    refusedArtifactFiles: result.batch.summary.refusedArtifactFiles,
    artifactSelections: 0,
    permissionEvaluations: 0,
    evidenceEligibilityEvaluations: 0,
    adapterExecutions: 0,
    nativeSourceExecutions: 0,
    evidenceAdmissions: 0,
    evidenceRelabelings: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION CAPABILITY NATIVE-ARTIFACT INVENTORY REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
