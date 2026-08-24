'use strict';

const base = require('./code-grammar-glass-base.js');
const cycle = require('./code-grammar-glass-cycle.js');
const observation = require('./code-grammar-glass-observation.js');

module.exports = Object.freeze({
  GRAMMAR_FAMILY: base.GRAMMAR_FAMILY,
  UNIVERSAL_ATOM_TYPES: base.UNIVERSAL_ATOM_TYPES,
  CONNECTION_CLASSES: base.CONNECTION_CLASSES,
  INFLUENCE_CARRY_CLASSES: base.INFLUENCE_CARRY_CLASSES,
  MIRROR_LENSES: base.MIRROR_LENSES,
  FUTURE_GRAMMAR_FAMILIES: base.FUTURE_GRAMMAR_FAMILIES,
  DEFAULT_CONDITIONS: base.DEFAULT_CONDITIONS,
  AUTHORITY: base.AUTHORITY,
  canon: base.canon,
  hash: base.hash,
  digestCurrent: base.digestCurrent,
  containsRawPrivateOrSource: base.containsRawPrivateOrSource,
  loadGrammarSource: base.loadGrammarSource,
  createAtomCatalog: base.createAtomCatalog,
  createConditionRevision: base.createConditionRevision,
  drawRootSeed: base.drawRootSeed,
  deriveSeed: base.deriveSeed,
  createDayStart: base.createDayStart,
  initializeCycle: cycle.initializeCycle,
  classifyConnection: cycle.classifyConnection,
  influenceCarryClass: cycle.influenceCarryClass,
  buildFormation: cycle.buildFormation,
  stepCycle: cycle.stepCycle,
  observeFormation: observation.observeFormation,
  captureDraftStar: observation.captureDraftStar,
  createConstellationLedger: observation.createConstellationLedger,
  appendLedgerEvent: observation.appendLedgerEvent,
  appendFormation: observation.appendFormation,
  appendDraftStar: observation.appendDraftStar,
  summarizeConstellation: observation.summarizeConstellation,
  requestExplicitReentry: observation.requestExplicitReentry,
  integrationSurfaceMap: observation.integrationSurfaceMap,
  createProductionDraftCandidatePacket: observation.createProductionDraftCandidatePacket,
  bindFullSaveIntent: observation.bindFullSaveIntent,
  grammarFamilyAdapterSeam: observation.grammarFamilyAdapterSeam,
  createVisualSnapshot: observation.createVisualSnapshot,
  snapshot: observation.snapshot
});
