'use strict';

const base = require('./code-grammar-glass-base.js');
const cycle = require('./code-grammar-glass-cycle.js');
const {
  GRAMMAR_FAMILY,
  UNIVERSAL_ATOM_TYPES,
  CONNECTION_CLASSES,
  INFLUENCE_CARRY_CLASSES,
  MIRROR_LENSES,
  FUTURE_GRAMMAR_FAMILIES,
  LEDGER_EVENT_TYPES,
  AUTHORITY,
  hash,
  deepFreeze,
  clean,
  cleanId,
  strings,
  digestCurrent,
  containsRawPrivateOrSource,
  unitFromSeed
} = base;
const { getAtom, validFormation } = cycle;

function observeFormation({ cycle, catalog, formation, lens = null, reasoningBinding = null, metadata = null } = {}) {
  const rawPath = containsRawPrivateOrSource({ reasoningBinding, metadata });
  if (rawPath) {
    return deepFreeze({
      schema: 'axm.code.reactive-draft-mirror-observation.v1',
      result: 'RAW_PRIVATE_INNER_REASONING_OR_SOURCE_REFUSED',
      refusedPath: rawPath,
      acceptedInstead: ['typed rules', 'decision summaries', 'finding references', 'evidence digests', 'atom ancestry'],
      authority: 'NONE'
    });
  }
  if (!cycle || !digestCurrent(cycle, 'cycleSha256') || !catalog || !digestCurrent(catalog, 'catalogSha256') || !validFormation(formation)) {
    return deepFreeze({ schema: 'axm.code.reactive-draft-mirror-observation.v1', result: 'VALID_CYCLE_CATALOG_AND_FORMATION_REQUIRED', authority: 'NONE' });
  }
  if (formation.cycleFrameSha256 !== (cycle.cycleFrameSha256 || cycle.cycleSha256)) {
    return deepFreeze({ schema: 'axm.code.reactive-draft-mirror-observation.v1', result: 'FORMATION_CYCLE_FRAME_MISMATCH', authority: 'NONE' });
  }
  const selectedLens = String(lens || 'STRUCTURAL_SEAM').toUpperCase();
  if (!MIRROR_LENSES.includes(selectedLens)) {
    return deepFreeze({ schema: 'axm.code.reactive-draft-mirror-observation.v1', result: 'MIRROR_LENS_INVALID', allowedLenses: MIRROR_LENSES, authority: 'NONE' });
  }
  const atoms = formation.atomIds.map(atomId => getAtom(catalog, atomId));
  const findingRefs = strings(reasoningBinding && reasoningBinding.findingRefs, 64).sort();
  const analysisDigest = reasoningBinding && reasoningBinding.analysisDigest ? String(reasoningBinding.analysisDigest) : null;
  const recipeCore = {
    schema: 'axm.code.inert-structural-draft-recipe.v1',
    version: '1.0.0',
    result: 'INERT_EDITABLE_DRAFT_RECIPE_READY',
    mirrorLens: selectedLens,
    formationSha256: formation.formationSha256,
    structuralIngredients: atoms.map(atom => ({
      atomId: atom.atomId,
      atomType: atom.atomType,
      languageId: atom.languageId,
      sourceProfileDigest: atom.sourceProfileDigest,
      structuralFeatureRefs: atom.structuralFeatureRefs,
      structuralFeatureDigest: atom.structuralFeatureDigest
    })),
    connectionClasses: formation.connectionClasses,
    compositionPlan: {
      kind: formation.composite.kind,
      grammarComponents: formation.composite.grammarComponents,
      compositeLineageSha256: formation.composite.compositeLineageSha256,
      influenceCarryDigests: formation.composite.influenceCarryDigests,
      mergedGrammarIdentityCreated: false,
      componentBoundariesPreserved: true
    },
    assemblyNotes: formation.connections.map(connection => ({
      connectionClass: connection.connectionClass,
      leftAtomId: connection.leftAtomId,
      rightAtomId: connection.rightAtomId,
      reasonCodes: connection.reasons,
      equivalenceClaimed: false
    })),
    unresolvedQuestions: formation.connections
      .filter(connection => ['UNRESOLVED_NEIGHBOURHOOD', 'BOUNDARY', 'CONTRAST', 'REPULSION'].includes(connection.connectionClass))
      .map(connection => `${connection.connectionClass}:${connection.leftAtomId}:${connection.rightAtomId}`),
    requestedOutput: 'EDITABLE_PRODUCTION_DRAFT_CANDIDATE_PACKET_ONLY',
    sourceCodeIncluded: false,
    executable: false,
    compilableClaimed: false,
    usefulClaimed: false,
    novelClaimed: false,
    automaticReentry: false,
    automaticSelection: false,
    automaticPromotion: false,
    authority: AUTHORITY
  };
  const recipe = deepFreeze({ ...recipeCore, draftRecipeSha256: hash(recipeCore) });
  const previewCore = {
    schema: 'axm.code.grammar-glass-preview.v1',
    version: '1.0.0',
    result: 'STRUCTURAL_PREVIEW_READY_NOT_RUNTIME_EVIDENCE',
    formationSha256: formation.formationSha256,
    mirrorLens: selectedLens,
    title: `${atoms.map(atom => atom.displayName).join(' × ')} temporary formation`,
    atomCount: atoms.length,
    languageIds: formation.languageIds,
    atomTypes: formation.atomTypes,
    connectionClasses: formation.connectionClasses,
    compositeKind: formation.composite.kind,
    grammarComponentCount: formation.composite.grammarComponents.length,
    status: formation.result,
    visualProjectionOnly: true,
    runtimeEvidence: false
  };
  const preview = deepFreeze({ ...previewCore, previewSha256: hash(previewCore) });
  const core = {
    schema: 'axm.code.reactive-draft-mirror-observation.v1',
    version: '1.0.0',
    result: 'REACTIVE_DRAFT_MIRROR_OBSERVATION_READY',
    cycleSha256BeforeObservation: cycle.cycleSha256,
    cycleSha256AfterObservation: cycle.cycleSha256,
    cycleMutationPerformed: false,
    formationSha256: formation.formationSha256,
    formationSeed: formation.formationSeed,
    mirrorLens: selectedLens,
    contributingAtomIds: formation.atomIds,
    contributingAtomDigests: formation.atomSha256s,
    contributingProfileDigests: formation.profileDigests,
    compositeLineage: formation.composite,
    explanations: formation.connections.map(connection => ({
      connectionClass: connection.connectionClass,
      atoms: [connection.leftAtomId, connection.rightAtomId],
      reasons: connection.reasons,
      equivalenceClaimed: false
    })),
    draftRecipe: recipe,
    preview,
    reasoningBinding: {
      analysisDigest,
      findingRefs,
      rawPrivateInnerReasoningStored: false
    },
    truth: {
      mirrorObservesBesideCycle: true,
      mirrorDoesNotControlCycle: true,
      mirrorDoesNotExecuteOrCompile: true,
      mirrorDoesNotSelectWinner: true,
      mirrorDoesNotPromoteOrMerge: true,
      reflectionDoesNotReenterAutomatically: true,
      previewIsNotRuntimeEvidence: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, mirrorObservationSha256: hash(core) });
}

function replayReadiness(starCore) {
  const checks = [
    !!starCore.dayStartStateDigest,
    !!starCore.rootSeed,
    !!starCore.derivedFormationSeed,
    Number.isSafeInteger(starCore.cycleStep),
    !!starCore.conditionDigest,
    starCore.contributingProfileDigests.length > 0,
    starCore.typedAtomAncestry.length > 0,
    starCore.connectionClasses.length > 0,
    !!starCore.mirrorLens,
    !!starCore.draftRecipeDigest,
    !!starCore.previewDigest,
    starCore.replayRequirements.length >= 5
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 1000) / 1000;
}

function captureDraftStar({ dayStart, conditionRevision, cycle, formation, mirrorObservation, persistence = null } = {}) {
  const rawPath = containsRawPrivateOrSource({ mirrorObservation, persistence });
  if (rawPath) {
    return deepFreeze({
      schema: 'axm.code.grammar-glass-draft-star.v1',
      result: 'DRAFT_STAR_METADATA_REFUSED_RAW_PRIVATE_INNER_REASONING_OR_SOURCE',
      refusedPath: rawPath,
      authority: 'NONE'
    });
  }
  if (!dayStart || !digestCurrent(dayStart, 'dayStartSha256') ||
      !conditionRevision || !digestCurrent(conditionRevision, 'conditionSha256') ||
      !cycle || !digestCurrent(cycle, 'cycleSha256') ||
      !validFormation(formation) ||
      !mirrorObservation || !digestCurrent(mirrorObservation, 'mirrorObservationSha256')) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-draft-star.v1', result: 'VALID_DAY_CONDITION_CYCLE_FORMATION_AND_MIRROR_REQUIRED', authority: 'NONE' });
  }
  if (mirrorObservation.cycleSha256BeforeObservation !== mirrorObservation.cycleSha256AfterObservation || mirrorObservation.cycleMutationPerformed !== false) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-draft-star.v1', result: 'MIRROR_MUTATION_BOUNDARY_VIOLATION', authority: 'NONE' });
  }
  const persistenceMode = persistence && persistence.mode === 'FULL_SAVE_REFERENCE' ? 'FULL_SAVE_REFERENCE' : 'TRANSIENT_LIGHTWEIGHT_RECEIPT';
  const starCore = {
    schema: 'axm.code.grammar-glass-draft-star.v1',
    version: '1.0.0',
    result: 'DRAFT_STAR_CAPTURED_IMMUTABLE_LIGHTWEIGHT_RECEIPT',
    dayId: dayStart.dayId,
    dayStartStateDigest: dayStart.dayStartSha256,
    rootSeed: dayStart.rootSeed,
    derivedFormationSeed: formation.formationSeed,
    cycleStateDigest: cycle.cycleSha256,
    cycleStep: cycle.tick,
    cyclePhasePpm: cycle.cyclePhasePpm,
    conditionDigest: conditionRevision.conditionSha256,
    profileSnapshotDigest: dayStart.profileSnapshotSha256,
    organRegistrySnapshotDigest: dayStart.organRegistrySnapshotSha256,
    contributingGrammarIdentities: formation.languageIds,
    contributingProfileDigests: formation.profileDigests,
    typedAtomAncestry: formation.atomIds.map((atomId, index) => ({
      atomId,
      atomSha256: formation.atomSha256s[index]
    })),
    connectionClasses: formation.connectionClasses,
    connectionDigests: formation.connections.map(connection => connection.connectionSha256),
    compositeKind: formation.composite.kind,
    compositeLineageDigest: formation.composite.compositeLineageSha256,
    grammarComponentLineage: formation.composite.grammarComponents,
    influenceCarryDigests: formation.composite.influenceCarryDigests,
    formationStatus: formation.result,
    contradictionVisible: formation.contradictionsPreserved,
    unresolvedVisible: formation.unresolvedPreserved,
    mirrorLens: mirrorObservation.mirrorLens,
    mirrorObservationDigest: mirrorObservation.mirrorObservationSha256,
    draftRecipeDigest: mirrorObservation.draftRecipe.draftRecipeSha256,
    previewDigest: mirrorObservation.preview.previewSha256,
    previewState: mirrorObservation.preview.result,
    creationReasoningAnalysisDigest: mirrorObservation.reasoningBinding.analysisDigest,
    creationReasoningFindingRefs: mirrorObservation.reasoningBinding.findingRefs,
    persistence: {
      mode: persistenceMode,
      fullSaveReference: persistenceMode === 'FULL_SAVE_REFERENCE' ? {
        slotId: persistence.slotId || null,
        saveSha256: persistence.saveSha256 || null,
        payloadDigest: persistence.payloadDigest || null
      } : null,
      rawPayloadStoredInStar: false,
      consumesFullSaveSlot: persistenceMode === 'FULL_SAVE_REFERENCE'
    },
    replayRequirements: [
      `dayStart:${dayStart.dayStartSha256}`,
      `profileSnapshot:${dayStart.profileSnapshotSha256}`,
      `organRegistrySnapshot:${dayStart.organRegistrySnapshotSha256}`,
      `rootSeed:${dayStart.rootSeed}`,
      `condition:${conditionRevision.conditionSha256}`,
      `cycleStep:${cycle.tick}`,
      `cycleInfluenceCarryDigest:${cycle.influenceCarryDigest || hash([])}`,
      `formationSeed:${formation.formationSeed}`,
      `compositeLineage:${formation.composite.compositeLineageSha256}`
    ],
    metrics: {
      brightnessBasis: 'REPLAY_READINESS_AND_EVIDENCE_COMPLETENESS_ONLY',
      brightness: 0,
      qualityScore: null,
      noveltyScore: null,
      utilityScore: null
    },
    truth: {
      immutableReceipt: true,
      starIsNotGoodByDefault: true,
      starIsNotNovelByDefault: true,
      starIsNotFunctionalByDefault: true,
      starIsNotCompilableByDefault: true,
      starIsNotSelectedByDefault: true,
      starIsNotAdmittedByDefault: true,
      starIsNotPromotedByDefault: true,
      replayDoesNotProveRealWorldCorrectness: true,
      brightnessIsNotQuality: true,
      visualFormationIsNotExecutableSoftware: true,
      mirrorReflectionIsNotRuntimeEvidence: true,
      crossGrammarCompositePreservesDistinctGrammarIdentity: true,
      influenceCarryIsNotTrainingOrLearnedWeight: true
    },
    authority: AUTHORITY
  };
  starCore.metrics.brightness = replayReadiness(starCore);
  starCore.starId = `draft-star:${hash({
    dayStartStateDigest: starCore.dayStartStateDigest,
    formationSeed: starCore.derivedFormationSeed,
    formationStatus: starCore.formationStatus,
    mirrorObservationDigest: starCore.mirrorObservationDigest
  }).slice(0, 24)}`;
  return deepFreeze({ ...starCore, starSha256: hash(starCore) });
}

function createConstellationLedger({ dayStart, source, catalog } = {}) {
  if (!dayStart || !digestCurrent(dayStart, 'dayStartSha256') || !source || !digestCurrent(source, 'sourceSha256') || !catalog || !digestCurrent(catalog, 'catalogSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_DAY_SOURCE_AND_CATALOG_REQUIRED');
  }
  const initialEventCore = {
    schema: 'axm.code.constellation-ledger-event.v1',
    sequence: 1,
    eventType: 'DAY_START_CAPTURED',
    parentEventSha256: null,
    payloadDigest: dayStart.dayStartSha256,
    payloadState: 'IMMUTABLE_DAY_START',
    starSha256: null,
    formationSha256: null,
    conditionSha256: dayStart.conditionSha256,
    fullSaveReference: null
  };
  const initialEvent = deepFreeze({ ...initialEventCore, eventSha256: hash(initialEventCore) });
  const core = {
    schema: 'axm.code.constellation-ledger.v1',
    version: '1.0.0',
    result: 'CONSTELLATION_LEDGER_READY_APPEND_ONLY',
    dayId: dayStart.dayId,
    dayStartSha256: dayStart.dayStartSha256,
    rootSeed: dayStart.rootSeed,
    sourceSha256: source.sourceSha256,
    profileSnapshotSha256: source.profileSnapshotSha256,
    organRegistrySnapshotSha256: source.organRegistrySnapshotSha256,
    catalogSha256: catalog.catalogSha256,
    events: [initialEvent],
    eventCount: 1,
    headEventSha256: initialEvent.eventSha256,
    starDigests: [],
    failedFormationDigests: [],
    contradictoryFormationDigests: [],
    fullSaveReferences: [],
    replayStatus: 'DAY_START_RECORDED_NO_REPLAY_ATTEMPT',
    truth: {
      appendOnly: true,
      oldStarsRewritten: false,
      failedAndContradictoryFormationsPreserved: true,
      lightweightStarsAreNotFullPayloadSaves: true,
      starCountIsNotQualityScore: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, ledgerSha256: hash(core) });
}

function validLedger(ledger) {
  return !!ledger && ledger.schema === 'axm.code.constellation-ledger.v1' && digestCurrent(ledger, 'ledgerSha256');
}

function appendLedgerEvent({
  ledger,
  eventType,
  payloadDigest,
  payloadState,
  star = null,
  formation = null,
  conditionRevision = null,
  fullSaveReference = null,
  replayStatus = null
} = {}) {
  if (!validLedger(ledger)) throw new Error('GRAMMAR_GLASS_VALID_LEDGER_REQUIRED');
  const kind = String(eventType || '').toUpperCase();
  if (!LEDGER_EVENT_TYPES.includes(kind)) throw new Error(`GRAMMAR_GLASS_LEDGER_EVENT_TYPE_INVALID:${kind}`);
  if (star && (!star.starSha256 || !digestCurrent(star, 'starSha256'))) throw new Error('GRAMMAR_GLASS_LEDGER_STAR_INVALID');
  if (formation && !validFormation(formation)) throw new Error('GRAMMAR_GLASS_LEDGER_FORMATION_INVALID');
  if (conditionRevision && !digestCurrent(conditionRevision, 'conditionSha256')) throw new Error('GRAMMAR_GLASS_LEDGER_CONDITION_INVALID');
  const eventCore = {
    schema: 'axm.code.constellation-ledger-event.v1',
    sequence: ledger.events.length + 1,
    eventType: kind,
    parentEventSha256: ledger.headEventSha256,
    payloadDigest: clean(payloadDigest),
    payloadState: clean(payloadState, 'REFERENCE_ONLY'),
    starSha256: star ? star.starSha256 : null,
    formationSha256: formation ? formation.formationSha256 : null,
    conditionSha256: conditionRevision ? conditionRevision.conditionSha256 : null,
    fullSaveReference: fullSaveReference ? {
      slotId: fullSaveReference.slotId || null,
      saveSha256: fullSaveReference.saveSha256 || null,
      payloadDigest: fullSaveReference.payloadDigest || null
    } : null
  };
  const event = deepFreeze({ ...eventCore, eventSha256: hash(eventCore) });
  const starDigests = star ? [...ledger.starDigests, star.starSha256] : [...ledger.starDigests];
  const failedFormationDigests = formation && formation.result.startsWith('FORMATION_FAILED')
    ? [...ledger.failedFormationDigests, formation.formationSha256]
    : [...ledger.failedFormationDigests];
  const contradictoryFormationDigests = formation && formation.result === 'CONTRADICTORY_FORMATION_OBSERVED'
    ? [...ledger.contradictoryFormationDigests, formation.formationSha256]
    : [...ledger.contradictoryFormationDigests];
  const fullSaveReferences = fullSaveReference
    ? [...ledger.fullSaveReferences, event.fullSaveReference]
    : [...ledger.fullSaveReferences];
  const core = {
    ...ledger,
    events: [...ledger.events, event],
    eventCount: ledger.events.length + 1,
    headEventSha256: event.eventSha256,
    starDigests,
    failedFormationDigests,
    contradictoryFormationDigests,
    fullSaveReferences,
    replayStatus: replayStatus || ledger.replayStatus
  };
  delete core.ledgerSha256;
  return deepFreeze({ ...core, ledgerSha256: hash(core) });
}

function appendFormation(ledger, formation) {
  const eventType = formation.result === 'CONTRADICTORY_FORMATION_OBSERVED'
    ? 'FORMATION_CONTRADICTORY'
    : formation.result.startsWith('FORMATION_FAILED')
      ? 'FORMATION_FAILED'
      : 'CYCLE_OBSERVATION_APPENDED';
  return appendLedgerEvent({
    ledger,
    eventType,
    payloadDigest: formation.formationSha256,
    payloadState: formation.result,
    formation
  });
}

function appendDraftStar(ledger, star) {
  return appendLedgerEvent({
    ledger,
    eventType: 'DRAFT_STAR_CAPTURED',
    payloadDigest: star.starSha256,
    payloadState: star.persistence.mode,
    star
  });
}

function summarizeConstellation(ledger) {
  if (!validLedger(ledger)) throw new Error('GRAMMAR_GLASS_VALID_LEDGER_REQUIRED');
  const core = {
    schema: 'axm.code.constellation-ledger-summary.v1',
    version: '1.0.0',
    result: 'CONSTELLATION_SUMMARY_READY',
    dayId: ledger.dayId,
    dayStartSha256: ledger.dayStartSha256,
    ledgerSha256: ledger.ledgerSha256,
    eventCount: ledger.eventCount,
    starCount: ledger.starDigests.length,
    failedFormationCount: ledger.failedFormationDigests.length,
    contradictoryFormationCount: ledger.contradictoryFormationDigests.length,
    fullSaveReferenceCount: ledger.fullSaveReferences.length,
    constellationDigest: hash({
      dayStartSha256: ledger.dayStartSha256,
      headEventSha256: ledger.headEventSha256,
      starDigests: ledger.starDigests,
      failedFormationDigests: ledger.failedFormationDigests,
      contradictoryFormationDigests: ledger.contradictoryFormationDigests
    }),
    metrics: {
      starCountMeaning: 'LIGHTWEIGHT_RECEIPT_COUNT_ONLY_NOT_QUALITY',
      qualityScore: null,
      automaticWinner: null
    },
    truth: {
      failuresAndContradictionsRetained: true,
      oldStarsNotRewritten: true,
      fullSaveReferencesSeparateFromLightweightStars: true,
      summaryDoesNotRankOrSelect: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, summarySha256: hash(core) });
}

function requestExplicitReentry({ star, lineageRequest = null } = {}) {
  return deepFreeze({
    schema: 'axm.code.grammar-glass-reentry-request.v1',
    version: '1.0.0',
    result: 'PHASE_1_DRAFT_REENTRY_HELD_NOT_EXECUTED',
    starSha256: star && star.starSha256 || null,
    lineageRequestDigest: lineageRequest ? hash(lineageRequest) : null,
    truth: {
      futureExplicitLineageBoundSurfaceMayExist: true,
      automaticReentryRefused: true,
      currentRequestExecuted: false,
      cycleMutationPerformed: false
    },
    authority: 'NONE'
  });
}

function integrationSurfaceMap() {
  const surfaces = {
    workContextDock: {
      mode: 'DIGEST_AND_REFERENCE_ONLY',
      automaticDirectionChange: false
    },
    productionDraftFabric: {
      mode: 'INERT_CANDIDATE_PACKET_ONLY',
      automaticBatchCreation: false,
      automaticSelection: false
    },
    productionBudget: {
      mode: 'EXTERNAL_BUDGET_ASSESSMENT_REQUIRED_FOR_FUTURE_WORK',
      budgetFitIsExecutionPermission: false
    },
    builtSoftwareExperimentSandbox: {
      mode: 'EXISTING_FIVE_SLOT_PERSISTENCE_ADAPTER',
      simulatorProvidesOsContainment: false
    },
    creationReasoningSeamProbe: {
      mode: 'ANALYSIS_DIGEST_AND_FINDING_REFERENCES_ONLY',
      rawPrivateInnerReasoningAccepted: false
    },
    machineKeyboard: {
      mode: 'LANGUAGE_IDENTITY_AND_STRUCTURAL_PLAN_REFERENCE_ONLY',
      editProgramExecuted: false
    },
    prebuildAdmission: {
      mode: 'EXTERNAL_EXPLICIT_GATE_ONLY',
      automaticAdmission: false
    },
    artifactBuildWindow: {
      mode: 'VISUAL_SNAPSHOT_OR_INERT_CANDIDATE_DISPLAY_ONLY',
      runtimeEvidenceClaimed: false
    },
    developerRelationshipPlane: {
      mode: 'PRESERVED_EXTERNAL_HUMAN_AI_RELATIONSHIP_BOUNDARY',
      humanMergeGateReplaced: false
    }
  };
  const core = {
    schema: 'axm.code.grammar-glass-integration-surface-map.v1',
    version: '1.0.0',
    result: 'PR_61_INTEGRATION_SURFACES_BOUND_WITHOUT_AUTHORITY',
    surfaces,
    truth: {
      existingSurfacesAreReferencedNotReimplemented: true,
      noAutomaticAdmissionSelectionExecutionOrPromotion: true,
      mikeRemainsFinalMergeGate: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, integrationMapSha256: hash(core) });
}

function createProductionDraftCandidatePacket({ star, projectId, directionSha256, workContextRef = null } = {}) {
  if (!star || !star.starSha256 || !digestCurrent(star, 'starSha256')) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-production-draft-candidate.v1', result: 'VALID_DRAFT_STAR_REQUIRED', authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.grammar-glass-production-draft-candidate.v1',
    version: '1.0.0',
    result: 'INERT_PRODUCTION_DRAFT_CANDIDATE_PACKET_READY_NOT_ADMITTED',
    projectId: cleanId(projectId, 'grammar-glass'),
    directionSha256: directionSha256 == null ? null : String(directionSha256),
    workContextRef: workContextRef == null ? null : String(workContextRef),
    draftStarSha256: star.starSha256,
    draftRecipeDigest: star.draftRecipeDigest,
    previewDigest: star.previewDigest,
    languageIds: star.contributingGrammarIdentities,
    typedAtomAncestry: star.typedAtomAncestry,
    connectionClasses: star.connectionClasses,
    compositeKind: star.compositeKind,
    compositeLineageDigest: star.compositeLineageDigest,
    grammarComponentLineage: star.grammarComponentLineage,
    unresolvedVisible: star.unresolvedVisible,
    sourceCodeIncluded: false,
    requestedNextSurface: 'EXPLICIT_PRODUCTION_DRAFT_CREATION_BY_EXTERNAL_AUTHORIZED_CALLER',
    integrationSurfaceMap: integrationSurfaceMap(),
    truth: {
      packetIsNotProductionBatch: true,
      packetIsNotAdmission: true,
      packetIsNotSelection: true,
      packetIsNotExecution: true,
      packetIsNotPromotion: true,
      packetMayBeIgnoredOrEdited: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, candidatePacketSha256: hash(core) });
}

function bindFullSaveIntent({ sandbox = null, workspace, saveSet, saveIntent } = {}) {
  const sandboxApi = sandbox || require('./code-built-software-experiment-sandbox.js');
  if (!sandboxApi || typeof sandboxApi.assessIterationPersistence !== 'function') {
    throw new Error('GRAMMAR_GLASS_EXISTING_SANDBOX_ADAPTER_REQUIRED');
  }
  const assessment = sandboxApi.assessIterationPersistence({ workspace, saveSet, saveIntent });
  const core = {
    schema: 'axm.code.grammar-glass-full-save-binding.v1',
    version: '1.0.0',
    result: 'GRAMMAR_GLASS_FULL_SAVE_INTENT_BOUND_TO_EXISTING_SANDBOX',
    sandboxAssessment: assessment,
    slotCount: sandboxApi.SAVE_SLOT_COUNT,
    maxBytesPerSlot: sandboxApi.MAX_SAVE_BYTES,
    newSaveSystemInvented: false,
    starReceiptConsumesSlot: false,
    fullPayloadSaveConsumesSlotOnlyWhenExternalStoreCompletes: true,
    truth: {
      exactlyFiveActiveSlotsRemainAuthoritative: sandboxApi.SAVE_SLOT_COUNT === 5,
      maxBytesPerSlotRemainsOneHundredMillion: sandboxApi.MAX_SAVE_BYTES === 100000000,
      sixthSilentSaveAllowed: false,
      persistenceAssessmentIsNotExecutionPermission: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, bindingSha256: hash(core) });
}

function grammarFamilyAdapterSeam() {
  const adapters = [{
    grammarFamily: 'CODE',
    status: 'IMPLEMENTED_PHASE_1',
    inputSchema: 'axm.code.language-grammar-profile.v1',
    outputSchema: 'axm.code.grammar-structural-atom-catalog.v1'
  }, ...FUTURE_GRAMMAR_FAMILIES.map(grammarFamily => ({
    grammarFamily,
    status: 'TYPED_ADAPTER_SEAM_HELD_NOT_IMPLEMENTED',
    inputSchema: null,
    outputSchema: 'axm.code.grammar-structural-atom-catalog.v1'
  }))];
  const core = {
    schema: 'axm.code.grammar-family-adapter-seam.v1',
    version: '1.0.0',
    result: 'GRAMMAR_FAMILY_ADAPTER_SEAM_READY_CODE_ONLY',
    adapters,
    truth: {
      codeIsFirstFamilyNotOnlyPossibleFamily: true,
      futureFamiliesNotImplemented: true,
      futureAdaptersGrantNoAuthority: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, adapterSeamSha256: hash(core) });
}

function atomPosition(state, bandCount = UNIVERSAL_ATOM_TYPES.length) {
  const angle = (state.phasePpm / 1000000) * Math.PI * 2;
  const normalizedBand = bandCount <= 1 ? 0 : state.orbitBand / (bandCount - 1);
  const baseRadius = 0.52 + normalizedBand * 0.31;
  const radius = baseRadius + state.radialOffsetPpm / 1000000;
  return {
    x: Number((Math.cos(angle) * radius).toFixed(6)),
    y: Number((Math.sin(angle) * radius).toFixed(6)),
    radius: Number(radius.toFixed(6)),
    angle: Number(angle.toFixed(6))
  };
}

function createVisualSnapshot({ source, catalog, dayStart, conditionRevision, cycle, mirrorObservations = [], ledger, stars = [] } = {}) {
  if (!source || !catalog || !dayStart || !conditionRevision || !cycle || !validLedger(ledger)) {
    throw new Error('GRAMMAR_GLASS_VISUAL_SNAPSHOT_INPUTS_REQUIRED');
  }
  const validStars = stars.filter(star => star && star.starSha256 && digestCurrent(star, 'starSha256'));
  const validMirrors = mirrorObservations.filter(observation => observation && observation.mirrorObservationSha256 && digestCurrent(observation, 'mirrorObservationSha256'));
  const atomById = new Map(catalog.atoms.map(atom => [atom.atomId, atom]));
  const visualAtoms = cycle.atomStates.map(state => {
    const atom = atomById.get(state.atomId);
    return {
      atomId: state.atomId,
      atomSha256: state.atomSha256,
      languageId: state.languageId,
      displayName: atom.displayName,
      atomType: state.atomType,
      grammarFamilyId: atom.grammarFamilyId,
      sourceProfileDigest: atom.sourceProfileDigest,
      orbitBand: state.orbitBand,
      phasePpm: state.phasePpm,
      angularVelocityPpm: state.angularVelocityPpm,
      appliedInfluenceCarryPpm: state.appliedInfluenceCarryPpm || 0,
      appliedInfluenceCarryCount: state.appliedInfluenceCarryCount || 0,
      appliedInfluenceCarryDigest: state.appliedInfluenceCarryDigest || null,
      position: atomPosition(state),
      structuralFeatureRefs: atom.structuralFeatureRefs,
      featurePreview: atom.structuralFeatureValues.slice(0, 4),
      unresolvedStatus: atom.unresolved.status
    };
  });
  const visualEdges = cycle.interactions.slice(0, 160).map(interaction => ({
    interactionId: interaction.interactionId,
    leftAtomId: interaction.leftAtomId,
    rightAtomId: interaction.rightAtomId,
    connectionClass: interaction.connectionClass,
    circularDistance: interaction.circularDistance,
    thresholdMet: interaction.thresholdMet,
    crossGrammar: interaction.crossGrammar,
    leftLanguageId: interaction.leftLanguageId,
    rightLanguageId: interaction.rightLanguageId,
    influence: interaction.influence
  }));
  const visualInfluenceCarries = (cycle.influenceCarries || []).slice(0, 320).map(carry => ({
    carrySha256: carry.carrySha256,
    sourceAtomId: carry.sourceAtomId,
    targetAtomId: carry.targetAtomId,
    sourceLanguageId: carry.sourceLanguageId,
    targetLanguageId: carry.targetLanguageId,
    crossGrammar: carry.crossGrammar,
    connectionClass: carry.connectionClass,
    carryClass: carry.carryClass,
    signedDeltaPpm: carry.signedDeltaPpm,
    appliesAtTick: carry.appliesAtTick
  }));
  const draftSky = validStars.map(star => {
    const seed = star.starSha256;
    const angle = unitFromSeed(seed, 'star-angle') * Math.PI * 2;
    const radius = 0.18 + unitFromSeed(seed, 'star-radius') * 0.74;
    return {
      starId: star.starId,
      starSha256: star.starSha256,
      x: Number((Math.cos(angle) * radius).toFixed(6)),
      y: Number((Math.sin(angle) * radius).toFixed(6)),
      brightness: star.metrics.brightness,
      brightnessBasis: star.metrics.brightnessBasis,
      languageIds: star.contributingGrammarIdentities,
      atomTypes: star.typedAtomAncestry.map(ancestry => ancestry.atomId.split(':').pop()),
      connectionClasses: star.connectionClasses,
      compositeKind: star.compositeKind,
      compositeLineageDigest: star.compositeLineageDigest,
      formationStatus: star.formationStatus,
      cycleStep: star.cycleStep,
      conditionDigest: star.conditionDigest,
      replayRequirements: star.replayRequirements,
      truth: star.truth
    };
  });
  const constellation = summarizeConstellation(ledger);
  const core = {
    schema: 'axm.code.grammar-glass-visual-snapshot.v1',
    version: '1.0.0',
    result: 'DRAFTSKY_VISUAL_SNAPSHOT_READY',
    title: 'GRAMMAR GLASS',
    internalName: 'CODE TWISTER',
    observationSurface: 'DRAFTSKY',
    capturedEvents: 'DRAFT STARS',
    ledgerName: 'CONSTELLATION LEDGER',
    sourceMode: source.bindingMode,
    sourceSha256: source.sourceSha256,
    profileSnapshotSha256: source.profileSnapshotSha256,
    profileCount: source.profileCount,
    atomCount: catalog.atomCount,
    dayId: dayStart.dayId,
    dayStartSha256: dayStart.dayStartSha256,
    rootSeed: dayStart.rootSeed,
    cycle: {
      cycleSha256: cycle.cycleSha256,
      tick: cycle.tick,
      phasePpm: cycle.cyclePhasePpm,
      conditionSha256: conditionRevision.conditionSha256,
      conditions: conditionRevision.conditions,
      atomCount: cycle.atomCount,
      participatingProfileCount: cycle.participatingProfileCount,
      interactionCoverage: cycle.interactionCoverage,
      influenceCarryDigest: cycle.influenceCarryDigest,
      influenceCarries: visualInfluenceCarries,
      atoms: visualAtoms,
      edges: visualEdges,
      formations: cycle.formations.map(formation => ({
        formationSha256: formation.formationSha256,
        result: formation.result,
        atomIds: formation.atomIds,
        languageIds: formation.languageIds,
        connectionClasses: formation.connectionClasses,
        compositeKind: formation.composite.kind,
        compositeLineageSha256: formation.composite.compositeLineageSha256,
        grammarComponents: formation.composite.grammarComponents,
        influenceCarryDigests: formation.composite.influenceCarryDigests,
        formationSeed: formation.formationSeed
      }))
    },
    mirrors: validMirrors.map(observation => ({
      mirrorObservationSha256: observation.mirrorObservationSha256,
      mirrorLens: observation.mirrorLens,
      formationSha256: observation.formationSha256,
      contributingAtomIds: observation.contributingAtomIds,
      compositeLineage: observation.compositeLineage,
      explanations: observation.explanations,
      draftRecipeDigest: observation.draftRecipe.draftRecipeSha256,
      preview: observation.preview,
      cycleMutationPerformed: false
    })),
    draftSky,
    constellation,
    adapterSeam: grammarFamilyAdapterSeam(),
    integrationSurfaceMap: integrationSurfaceMap(),
    legend: {
      atomTypes: UNIVERSAL_ATOM_TYPES,
      connectionClasses: CONNECTION_CLASSES,
      influenceCarryClasses: INFLUENCE_CARRY_CLASSES,
      mirrorLenses: MIRROR_LENSES,
      brightnessMeaning: 'replay readiness and evidence completeness, never quality'
    },
    truth: {
      visualPositionsDerivedFromCycleState: true,
      starPositionsDerivedFromStarDigest: true,
      noCannedLanguageActivity: true,
      crossGrammarInfluenceShownFromRecordedCarriesOnly: true,
      compositeFormationPreservesComponentLineage: true,
      interactionCoverageDistinguishesAvailableFromObservedProfiles: true,
      visualInterpolationCreatesNoNewEvidence: true,
      visualFormationIsNotExecutableSoftware: true,
      simulatorIsNotOsSandboxing: true,
      simulatorIsNotLocalAdvancedCreationFactory: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, visualSnapshotSha256: hash(core) });
}

function snapshot() {
  const core = {
    schema: 'axm.code.grammar-glass-snapshot.v1',
    version: '1.1.0',
    status: 'TEST',
    seriousName: 'GRAMMAR GLASS',
    internalName: 'CODE TWISTER',
    visualSurface: 'DRAFTSKY',
    capturedEvent: 'DRAFT STAR',
    ledger: 'CONSTELLATION LEDGER',
    grammarFamily: GRAMMAR_FAMILY,
    universalAtomTypes: UNIVERSAL_ATOM_TYPES,
    connectionClasses: CONNECTION_CLASSES,
    mirrorLenses: MIRROR_LENSES,
    futureGrammarFamilies: FUTURE_GRAMMAR_FAMILIES,
    integrationSurfaceMap: integrationSurfaceMap(),
    claim: 'Seeded, replayable, provenance-bound polyglot structural field and observation simulator.',
    truth: {
      decorativeParticleAnimationOnly: false,
      crossGrammarInfluenceCarriesImplemented: true,
      compositeFormationLineageImplemented: true,
      crossGrammarInfluenceIsNotEquivalence: true,
      influenceCarryIsNotTrainingOrLearnedWeight: true,
      allWorldCodeIngested: false,
      rngProvesNovelty: false,
      quantumOrSoftwareEntanglementClaimed: false,
      consciousnessEmergenceOrAutonomousLifeClaimed: false,
      visualFormationProvesExecutableSoftware: false,
      deterministicReplayProvesRealWorldCorrectness: false,
      authorityGranted: false
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = Object.freeze({
  observeFormation,
  captureDraftStar,
  createConstellationLedger,
  appendLedgerEvent,
  appendFormation,
  appendDraftStar,
  summarizeConstellation,
  requestExplicitReentry,
  integrationSurfaceMap,
  createProductionDraftCandidatePacket,
  bindFullSaveIntent,
  grammarFamilyAdapterSeam,
  createVisualSnapshot,
  snapshot
});
