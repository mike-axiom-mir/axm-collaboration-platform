'use strict';

const path = require('path');
const OrganArchive = require('../modules/ai-organ-archive/core/organ-archive');
const Protocol = require('../modules/ai-organ-archive/core/dormant-organ-component-protocol');

const ORGAN_ID = 'axm.mirror.dormant-organ-component-projector-organ/v1';
const OUTPUT_SCHEMA = Protocol.PROJECTION_SCHEMA;
const RECEIPT_SCHEMA = Protocol.RECEIPT_SCHEMA;
const CLAIM_CEILING = 'TEST_STATIC_CONTENT_ADDRESSED_DORMANT_ORGAN_COMPONENT_AND_GRAPH_PROJECTION_NO_EXECUTION_OR_ADMISSION';
const DEFAULT_PROJECTION_ROOT = path.resolve(__dirname, '..', 'state', 'dormant-organ-component-projections');

function authority() {
  return {
    readPrivateArchiveCatalog: true,
    writePrivateProjection: true,
    staticGraphAssessment: true,
    loadOrgan: false,
    executeOrgan: false,
    connectOrgan: false,
    admitOrgan: false,
    installOrgan: false,
    startOrgan: false,
    grantPermission: false,
    promoteRuntime: false,
    changeCanon: false,
    writeWorkshop: false,
    worldAction: false
  };
}

function projectCurrentArchive(options = {}) {
  const archiveRoot = path.resolve(options.archiveRoot || OrganArchive.DEFAULT_ARCHIVE_ROOT);
  const projectionRoot = path.resolve(options.projectionRoot || DEFAULT_PROJECTION_ROOT);
  const { catalog, catalogDigest } = Protocol.readCurrentCatalog(archiveRoot);
  const projection = Protocol.projectCatalog(catalog, catalogDigest);
  const sealed = Protocol.sealProjection(projectionRoot, projection, options.recordedAt || new Date().toISOString());
  return {
    schema: 'axm.mirror.dormant-organ-component-projector-result/v1',
    status: 'TEST',
    organ: { id: ORGAN_ID, claimCeiling: CLAIM_CEILING, learnedWeights: false },
    state: sealed.state,
    sourceCatalogDigest: catalogDigest,
    projectionDigest: projection.projectionDigest,
    componentCount: projection.componentCount,
    summary: projection.summary,
    receipt: sealed.receipt,
    effects: { privateProjectionWrites: sealed.writes, organLoads: 0, organExecutions: 0, automaticConnections: 0 },
    authority: authority(),
    boundary: 'This result creates or reuses static dormant component metadata only. It does not load, execute, connect, admit, install, start, promote, grant permission, alter Workshop, or establish CANON.'
  };
}

function assessArchivedSet(projection, archiveObjectIds) {
  return Protocol.assessGraph(projection, archiveObjectIds);
}

module.exports = {
  ORGAN_ID,
  OUTPUT_SCHEMA,
  RECEIPT_SCHEMA,
  CLAIM_CEILING,
  DEFAULT_PROJECTION_ROOT,
  authority,
  projectCurrentArchive,
  assessArchivedSet
};
