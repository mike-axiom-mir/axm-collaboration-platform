'use strict';

const path = require('path');
const WorkshopRoot = require('../config/workshop-root');
const Archive = require('../modules/ai-organ-archive/core/organ-archive');
const Evidence = require('../modules/ai-organ-archive/core/verification-spine-evidence');

const ORGAN_ID = 'axm.mirror.organ/workshop-verification-spine-intake-v1';
const RESULT_SCHEMA = 'axm.mirror.workshop-verification-spine-intake-result/v1';
const ROOT = path.resolve(__dirname, '..');

function intake(options = {}) {
  const resolution = WorkshopRoot.inspect({
    workshopRoot: options.workshopRoot,
    config: options.config,
    configRoot: ROOT,
    environment: options.environment,
    platform: options.platform,
    homeDirectory: options.homeDirectory
  });
  if (!resolution.available) {
    return {
      schema: RESULT_SCHEMA,
      status: 'TEST',
      state: 'HOLD_WORKSHOP_ABSENT',
      receiptId: null,
      receiptReused: false,
      reportVerdict: null,
      categories: [],
      contradictions: 0,
      validationErrors: [resolution.reason],
      workshopRootResolution: resolution,
      workshopWrites: 0,
      externalCodeExecutions: 0,
      promotions: 0,
      canonChanges: 0,
      worldActions: 0
    };
  }
  const archiveRoot = path.resolve(options.archiveRoot || Archive.DEFAULT_ARCHIVE_ROOT);
  const result = Evidence.intakeWorkshopReport({
    workshopRoot: resolution.root,
    archiveRoot,
    recordedAt: options.recordedAt
  });
  const refreshed = Archive.scanAndArchive({
    sourceRoot: path.resolve(options.sourceRoot || path.join(ROOT, 'organs')),
    repositoryRoot: path.resolve(options.repositoryRoot || ROOT),
    archiveRoot,
    at: options.recordedAt
  });
  return Object.assign(result, { workshopRootResolution: resolution, catalogDigest: refreshed.catalogDigest });
}

module.exports = { ORGAN_ID, RESULT_SCHEMA, intake };
