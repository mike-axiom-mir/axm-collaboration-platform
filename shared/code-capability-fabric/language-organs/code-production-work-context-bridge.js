'use strict';

const crypto = require('crypto');
const dock = require('./code-work-context-dock.js');
const production = require('./code-production-draft-fabric.js');

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(canon(v)).digest('hex');
}

function buildProductionContextCard({
  direction,
  progressEvents = [],
  scratchNotes = [],
  currentStepId = null,
  buildWindowState = null,
  relationshipImpact = null,
  maxScratch = 8,
  batch = null,
  drafts = [],
  selection = null
} = {}) {
  const card = dock.buildContextCard({
    direction,
    progressEvents,
    scratchNotes,
    currentStepId,
    buildWindowState,
    relationshipImpact,
    maxScratch
  });
  if (!card || !String(card.result || '').startsWith('CONTEXT_CARD_READY')) {
    return Object.freeze({
      schema: 'axm.code.production-work-context-card.v1',
      result: 'BASE_CONTEXT_CARD_HELD',
      baseResult: card && card.result || null,
      authority: 'NONE'
    });
  }
  if (!batch) {
    const core = {
      schema: 'axm.code.production-work-context-card.v1',
      version: '1.0.0',
      result: 'CONTEXT_CARD_READY_NO_PRODUCTION_BATCH',
      projectId: direction.projectId,
      directionSha256: direction.directionSha256,
      baseCardSha256: card.cardSha256,
      card,
      production: null,
      truth: {
        derivedCacheOnly: true,
        productionStateOptional: true,
        noRanking: true,
        noSelectionAuthority: true,
        noWorkspaceMutation: true
      },
      authority: 'NONE'
    };
    return Object.freeze({ ...core, productionCardSha256: hash(core) });
  }

  const summary = production.summarizeProduction({ batch, drafts, selection, direction });
  const stale = summary.directionStatus === 'PRODUCTION_BATCH_DIRECTION_STALE';
  const warning = !['PRODUCTION_BATCH_DIRECTION_CURRENT', 'PRODUCTION_BATCH_DIRECTION_STALE'].includes(summary.directionStatus);
  const core = {
    schema: 'axm.code.production-work-context-card.v1',
    version: '1.0.0',
    result: stale
      ? 'CONTEXT_CARD_READY_WITH_STALE_PRODUCTION_BATCH'
      : warning
        ? 'CONTEXT_CARD_READY_WITH_PRODUCTION_WARNING'
        : 'CONTEXT_CARD_READY_WITH_PRODUCTION',
    projectId: direction.projectId,
    directionSha256: direction.directionSha256,
    baseCardSha256: card.cardSha256,
    card,
    production: {
      productionContextSha256: summary.productionContextSha256 || null,
      batchSha256: summary.batchSha256 || null,
      batchDirectionSha256: summary.batchDirectionSha256 || null,
      directionStatus: summary.directionStatus || null,
      draftCount: summary.draftCount || 0,
      latestDrafts: summary.latestDrafts || [],
      selected: summary.selected || null,
      duplicateProgramCandidates: summary.duplicateProgramCandidates || []
    },
    truth: {
      derivedCacheOnly: true,
      productionSummaryNotRawSource: true,
      staleBatchDoesNotDisappear: true,
      staleBatchMustNotBeSilentlyTreatedAsCurrent: true,
      selectedDraftIsNotPromoted: true,
      noRanking: true,
      noWorkspaceMutation: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, productionCardSha256: hash(core) });
}

function verifyProductionContextCard({ card, direction } = {}) {
  if (!card || card.schema !== 'axm.code.production-work-context-card.v1') {
    return Object.freeze({ result: 'INVALID_PRODUCTION_CONTEXT_CARD', authority: 'NONE' });
  }
  if (!direction || direction.schema !== 'axm.code.work-direction.v1') {
    return Object.freeze({ result: 'INVALID_DIRECTION', authority: 'NONE' });
  }
  if (card.projectId !== direction.projectId) return Object.freeze({ result: 'PROJECT_MISMATCH', authority: 'NONE' });
  if (card.directionSha256 !== direction.directionSha256) {
    return Object.freeze({ result: 'STALE_PRODUCTION_CONTEXT_CARD_DIRECTION_CHANGED', authority: 'NONE' });
  }
  if (card.production && card.production.directionStatus === 'PRODUCTION_BATCH_DIRECTION_STALE') {
    return Object.freeze({
      result: 'PRODUCTION_CONTEXT_CARD_CURRENT_BATCH_STALE',
      projectId: direction.projectId,
      directionSha256: direction.directionSha256,
      batchSha256: card.production.batchSha256,
      authority: 'NONE'
    });
  }
  return Object.freeze({
    result: 'PRODUCTION_CONTEXT_CARD_CURRENT',
    projectId: direction.projectId,
    directionSha256: direction.directionSha256,
    batchSha256: card.production && card.production.batchSha256 || null,
    authority: 'NONE'
  });
}

module.exports = {
  buildProductionContextCard,
  verifyProductionContextCard
};
