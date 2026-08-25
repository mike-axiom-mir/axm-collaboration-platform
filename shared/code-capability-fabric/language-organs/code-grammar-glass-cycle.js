'use strict';

const base = require('./code-grammar-glass-base.js');
const {
  UNIVERSAL_ATOM_TYPES,
  AUTHORITY,
  DEFAULT_CONDITIONS,
  hash,
  deepFreeze,
  strings,
  digestCurrent,
  deriveSeed,
  unitFromSeed,
  integerFromSeed,
  atomBand
} = base;

function initializeCycle({ dayStart, catalog } = {}) {
  if (!dayStart || !digestCurrent(dayStart, 'dayStartSha256') || !catalog || !digestCurrent(catalog, 'catalogSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_DAY_AND_CATALOG_REQUIRED');
  }
  const atomStates = catalog.atoms.map((atom, index) => {
    const seed = deriveSeed(dayStart.rootSeed, `atom-init:${atom.atomSha256}`, index);
    const direction = unitFromSeed(seed, 'direction') < 0.5 ? -1 : 1;
    const stateCore = {
      atomId: atom.atomId,
      atomSha256: atom.atomSha256,
      languageId: atom.languageId,
      atomType: atom.atomType,
      orbitBand: atomBand(atom),
      phasePpm: Math.floor(unitFromSeed(seed, 'phase') * 1000000),
      radialOffsetPpm: Math.floor((unitFromSeed(seed, 'radius') - 0.5) * 90000),
      angularVelocityPpm: direction * (500 + Math.floor(unitFromSeed(seed, 'velocity') * 2200)),
      circulationDirection: direction > 0 ? 'CLOCKWISE' : 'COUNTERCLOCKWISE',
      consumed: false,
      eligibleForInfluence: true,
      appliedInfluenceCarryPpm: 0,
      appliedInfluenceCarryCount: 0,
      appliedInfluenceCarryDigest: null
    };
    return deepFreeze({ ...stateCore, atomStateSha256: hash(stateCore) });
  });
  const cycleFrameSha256 = hash({
    dayStartSha256: dayStart.dayStartSha256,
    catalogSha256: catalog.catalogSha256,
    conditionSha256: dayStart.conditionSha256,
    tick: 0,
    atomStates: atomStates.map(state => state.atomStateSha256),
    interactions: []
  });
  const core = {
    schema: 'axm.code.grammar-glass-cycle-state.v1',
    version: '1.0.0',
    result: 'CODE_TWISTER_CYCLE_READY',
    dayStartSha256: dayStart.dayStartSha256,
    rootSeed: dayStart.rootSeed,
    catalogSha256: catalog.catalogSha256,
    profileSnapshotSha256: dayStart.profileSnapshotSha256,
    conditionSha256: dayStart.conditionSha256,
    tick: 0,
    cyclePhasePpm: 0,
    previousCycleSha256: null,
    cycleFrameSha256,
    derivedTickSeed: deriveSeed(dayStart.rootSeed, 'cycle-tick', 0),
    atomCount: atomStates.length,
    participatingProfileCount: new Set(atomStates.map(state => state.languageId)).size,
    atomStates,
    interactions: [],
    influenceCarries: [],
    influenceCarryDigest: hash([]),
    interactionCoverage: {
      observedProfileIdsThisTick: [],
      observedProfileIdsEver: [],
      observedProfileCountEver: 0,
      availableProfileCount: new Set(atomStates.map(state => state.languageId)).size,
      allProfilesObservedYet: false
    },
    formations: [],
    scheduler: {
      mode: 'DETERMINISTIC_TICK_SCHEDULING',
      qualityReductionAllowed: false,
      verificationReductionAllowed: false
    },
    truth: {
      atomsContinueCirculating: true,
      atomsConsumed: false,
      allAvailableProfilesCanParticipate: true,
      participationDoesNotMeanInteractionObserved: true,
      crossGrammarInfluenceCanPersistAcrossTicksWithoutEquivalence: true,
      influenceCarryIsBoundedDeterministicStateNotLearnedWeight: true,
      cycleIsMetadataSimulationNotExecution: true,
      deterministicAfterSeedAndStateRecorded: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, cycleSha256: hash(core) });
}

function circularDistancePpm(left, right) {
  const raw = Math.abs(left - right) % 1000000;
  return Math.min(raw, 1000000 - raw) / 1000000;
}

function tokenIntersection(left, right) {
  const rightSet = new Set(right);
  return left.filter(token => rightSet.has(token));
}

function classifyConnection(left, right, conditionRevision = null) {
  if (!left || !right || left.schema !== 'axm.code.grammar-structural-atom.v1' || right.schema !== 'axm.code.grammar-structural-atom.v1') {
    throw new Error('GRAMMAR_GLASS_TWO_VALID_ATOMS_REQUIRED');
  }
  const conditions = conditionRevision && conditionRevision.conditions || DEFAULT_CONDITIONS;
  const sharedTokens = tokenIntersection(left.featureTokens, right.featureTokens);
  const sameType = left.atomType === right.atomType;
  const sameLanguage = left.languageId === right.languageId;
  const sameFamily = left.grammarFamilyId === right.grammarFamilyId;
  const failureVerificationPair = new Set([left.atomType, right.atomType]);
  const explicitFailureContrast = failureVerificationPair.has('FAILURE') && failureVerificationPair.has('VERIFICATION');
  const stateEffectPair = failureVerificationPair.has('STATE') && failureVerificationPair.has('EFFECT');
  const interfaceDependencyPair = failureVerificationPair.has('INTERFACE') && failureVerificationPair.has('DEPENDENCY');
  let connectionClass = 'UNRESOLVED_NEIGHBOURHOOD';
  const reasons = [];
  if (explicitFailureContrast) {
    connectionClass = 'CONTRAST';
    reasons.push('failure evidence and verification intent remain distinct');
  } else if (sameType && sharedTokens.length > 0) {
    connectionClass = 'TYPED_COMPATIBILITY';
    reasons.push('same universal atom type with shared declared structural tokens');
  } else if (sameType) {
    connectionClass = 'ANALOGY';
    reasons.push('same universal atom type without shared declared structural tokens');
  } else if (stateEffectPair || interfaceDependencyPair) {
    connectionClass = 'BOUNDARY';
    reasons.push('related structural roles meet at a typed boundary');
  } else if (sameLanguage && !sameType) {
    connectionClass = 'BOUNDARY';
    reasons.push('different structural roles inside one grammar profile');
  } else if (!sameFamily && ['TYPE', 'REPRESENTATION'].includes(left.atomType) && ['TYPE', 'REPRESENTATION'].includes(right.atomType)) {
    connectionClass = 'REPULSION';
    reasons.push('different grammar families and representation/type claims cannot be collapsed');
  } else if (sharedTokens.length > 0) {
    connectionClass = 'CONTRAST';
    reasons.push('shared vocabulary appears across unlike structural roles');
  } else {
    reasons.push('insufficient declared structural evidence for compatibility or incompatibility');
  }
  const sharedRatio = sharedTokens.length / Math.max(1, new Set([...left.featureTokens, ...right.featureTokens]).size);
  const attraction = connectionClass === 'TYPED_COMPATIBILITY'
    ? conditions.attractionWeight * (0.55 + sharedRatio)
    : connectionClass === 'ANALOGY'
      ? conditions.attractionWeight * 0.32
      : connectionClass === 'BOUNDARY'
        ? conditions.attractionWeight * 0.12
        : 0;
  const contrast = ['CONTRAST', 'BOUNDARY', 'UNRESOLVED_NEIGHBOURHOOD'].includes(connectionClass)
    ? conditions.contrastWeight * (connectionClass === 'CONTRAST' ? 1 : 0.55)
    : 0;
  const repulsion = connectionClass === 'REPULSION'
    ? conditions.repulsionWeight
    : connectionClass === 'UNRESOLVED_NEIGHBOURHOOD'
      ? conditions.uncertaintyInfluence * 0.2
      : 0;
  const core = {
    schema: 'axm.code.grammar-atom-connection.v1',
    version: '1.0.0',
    leftAtomId: left.atomId,
    rightAtomId: right.atomId,
    leftAtomSha256: left.atomSha256,
    rightAtomSha256: right.atomSha256,
    connectionClass,
    sameAtomType: sameType,
    sameLanguage,
    sameGrammarFamily: sameFamily,
    crossGrammar: !sameLanguage,
    sharedTokens,
    influence: {
      attraction: Number(attraction.toFixed(6)),
      contrast: Number(contrast.toFixed(6)),
      repulsion: Number(repulsion.toFixed(6)),
      verification: (left.atomType === 'VERIFICATION' || right.atomType === 'VERIFICATION') ? conditions.verificationInfluence : 0,
      uncertainty: connectionClass === 'UNRESOLVED_NEIGHBOURHOOD' ? conditions.uncertaintyInfluence : 0,
      crossGrammarWeight: !sameLanguage ? conditions.crossGrammarInfluenceWeight : 1
    },
    reasons,
    compatibilityClaim: {
      equivalent: false,
      typedCompatibilityOnly: connectionClass === 'TYPED_COMPATIBILITY',
      analogyOnly: connectionClass === 'ANALOGY',
      incompatibleOrUnresolvedVisible: ['CONTRAST', 'REPULSION', 'BOUNDARY', 'UNRESOLVED_NEIGHBOURHOOD'].includes(connectionClass)
    },
    truth: {
      relationIsDerivedFromDeclaredMetadata: true,
      relationIsNotSemanticEquivalenceProof: true,
      crossGrammarInfluenceDoesNotClaimGrammarEquivalence: true,
      relationIsNotRuntimeEvidence: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, connectionSha256: hash(core) });
}

function shortestSignedPhaseDirection(fromPpm, toPpm) {
  const forward = ((toPpm - fromPpm) % 1000000 + 1000000) % 1000000;
  if (forward === 0) return 0;
  return forward <= 500000 ? 1 : -1;
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function influenceCarryClass(connectionClass) {
  const map = {
    TYPED_COMPATIBILITY: 'ATTRACTIVE_PULL',
    ANALOGY: 'ANALOGICAL_PULL',
    CONTRAST: 'CONTRAST_DEFLECTION',
    REPULSION: 'REPULSIVE_PUSH',
    BOUNDARY: 'BOUNDARY_TENSION',
    UNRESOLVED_NEIGHBOURHOOD: 'UNCERTAINTY_DRIFT'
  };
  return map[connectionClass] || 'UNCERTAINTY_DRIFT';
}

function interactionCarryPair({ interaction, connection, leftState, rightState, conditions } = {}) {
  const crossGrammarFactor = connection.crossGrammar ? conditions.crossGrammarInfluenceWeight : 1;
  const attraction = Number(connection.influence.attraction || 0);
  const repulsion = Number(connection.influence.repulsion || 0);
  const contrast = Number(connection.influence.contrast || 0);
  const uncertainty = Number(connection.influence.uncertainty || 0);
  const verification = Number(connection.influence.verification || 0);
  const relationMagnitude = Math.max(attraction, repulsion, contrast * 0.72, uncertainty * 0.45, verification * 0.22);
  const proximity = Math.max(0.08, 1 - Math.min(1, interaction.circularDistance * 2));
  const magnitude = clampInteger(relationMagnitude * crossGrammarFactor * proximity * conditions.influenceCarryLimitPpm, 0, conditions.influenceCarryLimitPpm);
  const toward = shortestSignedPhaseDirection(leftState.phasePpm, rightState.phasePpm);
  let leftSign = toward || (unitFromSeed(interaction.derivedInteractionSeed, 'zero-distance-direction') < 0.5 ? -1 : 1);
  if (['CONTRAST', 'REPULSION', 'BOUNDARY'].includes(connection.connectionClass)) leftSign *= -1;
  if (connection.connectionClass === 'UNRESOLVED_NEIGHBOURHOOD') {
    leftSign = unitFromSeed(interaction.derivedInteractionSeed, 'unresolved-direction') < 0.5 ? -1 : 1;
  }
  const carryClass = influenceCarryClass(connection.connectionClass);
  const create = (sourceState, targetState, sign) => {
    const core = {
      schema: 'axm.code.grammar-influence-carry.v1',
      version: '1.0.0',
      result: 'BOUNDED_CROSS_GRAMMAR_INFLUENCE_CARRY_READY',
      sourceInteractionSha256: interaction.interactionSha256,
      sourceAtomId: sourceState.atomId,
      sourceLanguageId: sourceState.languageId,
      targetAtomId: targetState.atomId,
      targetLanguageId: targetState.languageId,
      crossGrammar: sourceState.languageId !== targetState.languageId,
      connectionClass: connection.connectionClass,
      carryClass,
      signedDeltaPpm: clampInteger(sign * magnitude, -conditions.influenceCarryLimitPpm, conditions.influenceCarryLimitPpm),
      createdAtTick: interaction.tick,
      appliesAtTick: interaction.tick + 1,
      decay: conditions.influenceCarryDecay,
      limitPpm: conditions.influenceCarryLimitPpm,
      sourceAtomDigest: sourceState.atomSha256,
      targetAtomDigest: targetState.atomSha256,
      truth: {
        influenceIsNotEquivalence: true,
        influenceDoesNotRewriteGrammarProfile: true,
        influenceIsNotLearnedWeight: true,
        influenceIsDeterministicFromRecordedState: true
      },
      authority: 'NONE'
    };
    return deepFreeze({ ...core, carrySha256: hash(core) });
  };
  return [
    create(rightState, leftState, leftSign),
    create(leftState, rightState, -leftSign)
  ];
}

function aggregateInfluenceForAtom(cycle, atomId, conditions) {
  const carries = (Array.isArray(cycle.influenceCarries) ? cycle.influenceCarries : [])
    .filter(carry => carry.targetAtomId === atomId && carry.appliesAtTick === cycle.tick + 1);
  const raw = carries.reduce((sum, carry) => sum + Number(carry.signedDeltaPpm || 0) * conditions.influenceCarryDecay, 0);
  return {
    signedDeltaPpm: clampInteger(raw, -conditions.influenceCarryLimitPpm, conditions.influenceCarryLimitPpm),
    count: carries.length,
    digest: carries.length ? hash(carries.map(carry => carry.carrySha256).sort()) : null,
    carrySha256s: carries.map(carry => carry.carrySha256).sort()
  };
}

function getAtom(catalog, atomId) {
  return catalog.atoms.find(atom => atom.atomId === atomId) || null;
}

function getAtomState(cycle, atomId) {
  return cycle.atomStates.find(state => state.atomId === atomId) || null;
}

function buildFormation({ cycle, catalog, conditionRevision, atomIds, formationSeed = null, source = 'EXPLICIT_OBSERVATION_SET' } = {}) {
  if (!cycle || !digestCurrent(cycle, 'cycleSha256') || !catalog || !digestCurrent(catalog, 'catalogSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_CYCLE_AND_CATALOG_REQUIRED');
  }
  const ids = [...new Set(strings(atomIds, 12))];
  if (ids.length < 2) throw new Error('GRAMMAR_GLASS_FORMATION_REQUIRES_AT_LEAST_TWO_ATOMS');
  const atoms = ids.map(id => getAtom(catalog, id));
  if (atoms.some(atom => !atom)) throw new Error('GRAMMAR_GLASS_FORMATION_ATOM_UNKNOWN');
  const connections = [];
  const distances = [];
  for (let leftIndex = 0; leftIndex < atoms.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < atoms.length; rightIndex += 1) {
      const left = atoms[leftIndex];
      const right = atoms[rightIndex];
      const leftState = getAtomState(cycle, left.atomId);
      const rightState = getAtomState(cycle, right.atomId);
      const distance = circularDistancePpm(leftState.phasePpm, rightState.phasePpm);
      distances.push(distance);
      connections.push({
        ...classifyConnection(left, right, conditionRevision),
        circularDistance: Number(distance.toFixed(6))
      });
    }
  }
  const classes = [...new Set(connections.map(connection => connection.connectionClass))].sort();
  const attractionPresent = classes.some(kind => ['TYPED_COMPATIBILITY', 'ANALOGY'].includes(kind));
  const incompatibilityPresent = classes.some(kind => ['CONTRAST', 'REPULSION', 'BOUNDARY', 'UNRESOLVED_NEIGHBOURHOOD'].includes(kind));
  const threshold = conditionRevision && conditionRevision.conditions.collisionThreshold || DEFAULT_CONDITIONS.collisionThreshold;
  const nearestDistance = Math.min(...distances);
  let formationState = 'TEMPORARY_FORMATION_OBSERVED';
  if (attractionPresent && incompatibilityPresent) formationState = 'CONTRADICTORY_FORMATION_OBSERVED';
  else if (nearestDistance > threshold) formationState = 'FORMATION_FAILED_COLLISION_THRESHOLD_NOT_MET';
  const seed = formationSeed || deriveSeed(cycle.rootSeed, `formation:${cycle.tick}:${ids.join('|')}`, 0);
  const languageIds = [...new Set(atoms.map(atom => atom.languageId))].sort();
  const grammarComponents = languageIds.map(languageId => {
    const componentAtoms = atoms.filter(atom => atom.languageId === languageId);
    return {
      languageId,
      profileDigests: [...new Set(componentAtoms.map(atom => atom.sourceProfileDigest))].sort(),
      atomIds: componentAtoms.map(atom => atom.atomId).sort(),
      atomTypes: [...new Set(componentAtoms.map(atom => atom.atomType))].sort()
    };
  });
  const relatedAtomSet = new Set(ids);
  const influenceCarryDigests = (Array.isArray(cycle.influenceCarries) ? cycle.influenceCarries : [])
    .filter(carry => relatedAtomSet.has(carry.sourceAtomId) || relatedAtomSet.has(carry.targetAtomId))
    .map(carry => carry.carrySha256)
    .sort();
  const compositeCore = {
    kind: languageIds.length > 1 ? 'CROSS_GRAMMAR_COMPOSITE_FORMATION' : 'SINGLE_GRAMMAR_FORMATION',
    grammarComponents,
    crossGrammar: languageIds.length > 1,
    mergedGrammarIdentityCreated: false,
    componentBoundariesPreserved: true,
    influenceCarryDigests
  };
  const composite = { ...compositeCore, compositeLineageSha256: hash(compositeCore) };
  const core = {
    schema: 'axm.code.grammar-glass-formation.v1',
    version: '1.0.0',
    result: formationState,
    source,
    dayStartSha256: cycle.dayStartSha256,
    cycleFrameSha256: cycle.cycleFrameSha256 || cycle.cycleSha256,
    cycleStateDigestObserved: cycle.cycleSha256,
    cycleStep: cycle.tick,
    cyclePhasePpm: cycle.cyclePhasePpm,
    conditionSha256: conditionRevision ? conditionRevision.conditionSha256 : cycle.conditionSha256,
    formationSeed: seed,
    atomIds: ids,
    atomSha256s: atoms.map(atom => atom.atomSha256),
    languageIds,
    profileDigests: [...new Set(atoms.map(atom => atom.sourceProfileDigest))].sort(),
    composite,
    atomTypes: [...new Set(atoms.map(atom => atom.atomType))].sort(),
    connections,
    connectionClasses: classes,
    nearestCircularDistance: Number(nearestDistance.toFixed(6)),
    collisionThreshold: threshold,
    contradictionsPreserved: attractionPresent && incompatibilityPresent,
    unresolvedPreserved: classes.includes('UNRESOLVED_NEIGHBOURHOOD'),
    truth: {
      formationIsTemporary: true,
      formationDoesNotConsumeAtoms: true,
      formationDoesNotProveUsefulOrNovelSoftware: true,
      incompatibleRelationsRemainVisible: incompatibilityPresent,
      crossGrammarCompositeDoesNotMergeOrRewriteGrammarIdentity: true,
      compositeRecipeMayCombineRolesWhilePreservingComponentLineage: true,
      collisionDoesNotProveCorrectness: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, formationSha256: hash(core) });
}

function stepCycle({ cycle, catalog, conditionRevision } = {}) {
  if (!cycle || !digestCurrent(cycle, 'cycleSha256') || !catalog || !digestCurrent(catalog, 'catalogSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_CYCLE_AND_CATALOG_REQUIRED');
  }
  if (!conditionRevision || !digestCurrent(conditionRevision, 'conditionSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_CONDITION_REVISION_REQUIRED');
  }
  const nextTick = cycle.tick + 1;
  const tickSeed = deriveSeed(cycle.rootSeed, 'cycle-tick', nextTick);
  const conditions = conditionRevision.conditions;
  const appliedCarryByAtom = new Map();
  const atomStates = cycle.atomStates.map((state, index) => {
    const carry = aggregateInfluenceForAtom(cycle, state.atomId, conditions);
    appliedCarryByAtom.set(state.atomId, carry);
    const familyNudge = Math.round((unitFromSeed(tickSeed, `family:${state.languageId}`) - 0.5) * 800 * conditions.grammarFamilyWeight);
    const uncertaintyNudge = Math.round((unitFromSeed(tickSeed, `uncertainty:${state.atomId}`) - 0.5) * 300 * conditions.uncertaintyInfluence);
    const verificationNudge = state.atomType === 'VERIFICATION' ? Math.round(conditions.verificationInfluence * 340) : 0;
    const delta = state.angularVelocityPpm + conditions.rotationRatePpm + familyNudge + uncertaintyNudge + verificationNudge + carry.signedDeltaPpm;
    const phasePpm = ((state.phasePpm + delta + conditions.phaseOffsetPpm) % 1000000 + 1000000) % 1000000;
    const stateCore = {
      atomId: state.atomId,
      atomSha256: state.atomSha256,
      languageId: state.languageId,
      atomType: state.atomType,
      orbitBand: state.orbitBand,
      phasePpm,
      radialOffsetPpm: state.radialOffsetPpm,
      angularVelocityPpm: state.angularVelocityPpm,
      circulationDirection: state.circulationDirection,
      consumed: false,
      eligibleForInfluence: true,
      previousAtomStateSha256: state.atomStateSha256,
      scheduledAtTick: index < conditions.scheduledAtomBudget || integerFromSeed(tickSeed, `schedule:${index}`, cycle.atomCount) < conditions.scheduledAtomBudget,
      appliedInfluenceCarryPpm: carry.signedDeltaPpm,
      appliedInfluenceCarryCount: carry.count,
      appliedInfluenceCarryDigest: carry.digest
    };
    return deepFreeze({ ...stateCore, atomStateSha256: hash(stateCore) });
  });
  const provisionalCore = {
    schema: 'axm.code.grammar-glass-cycle-state.v1',
    version: '1.1.0',
    result: 'CODE_TWISTER_CYCLE_ADVANCED',
    dayStartSha256: cycle.dayStartSha256,
    rootSeed: cycle.rootSeed,
    catalogSha256: cycle.catalogSha256,
    profileSnapshotSha256: cycle.profileSnapshotSha256,
    conditionSha256: conditionRevision.conditionSha256,
    tick: nextTick,
    cyclePhasePpm: ((cycle.cyclePhasePpm + conditions.rotationRatePpm) % 1000000 + 1000000) % 1000000,
    previousCycleSha256: cycle.cycleSha256,
    derivedTickSeed: tickSeed,
    atomCount: atomStates.length,
    participatingProfileCount: new Set(atomStates.map(state => state.languageId)).size,
    atomStates,
    interactions: [],
    influenceCarries: [],
    influenceCarryDigest: hash([]),
    interactionCoverage: {
      observedProfileIdsThisTick: [],
      observedProfileIdsEver: [...new Set((cycle.interactionCoverage && cycle.interactionCoverage.observedProfileIdsEver) || [])].sort(),
      observedProfileCountEver: new Set((cycle.interactionCoverage && cycle.interactionCoverage.observedProfileIdsEver) || []).size,
      availableProfileCount: new Set(atomStates.map(state => state.languageId)).size,
      allProfilesObservedYet: false
    },
    formations: [],
    scheduler: {
      mode: 'DETERMINISTIC_TICK_SCHEDULING',
      scheduledAtomBudget: Math.min(conditions.scheduledAtomBudget, atomStates.length),
      interactionsPerTick: conditions.interactionsPerTick,
      qualityReductionAllowed: false,
      verificationReductionAllowed: false
    },
    truth: {
      atomsContinueCirculating: true,
      atomsConsumed: false,
      allAvailableProfilesCanParticipate: true,
      participationDoesNotMeanInteractionObserved: true,
      crossGrammarInfluenceCanPersistAcrossTicksWithoutEquivalence: true,
      influenceCarryIsBoundedDeterministicStateNotLearnedWeight: true,
      cycleIsMetadataSimulationNotExecution: true,
      deterministicAfterSeedAndStateRecorded: true
    },
    authority: AUTHORITY
  };
  const provisional = { ...provisionalCore, cycleSha256: hash(provisionalCore) };
  const interactions = [];
  const influenceCarries = [];
  const formationMap = new Map();
  const observedProfileIdsThisTick = new Set();
  for (let index = 0; index < conditions.interactionsPerTick; index += 1) {
    let leftIndex = integerFromSeed(tickSeed, `left:${index}`, catalog.atoms.length);
    let rightIndex = integerFromSeed(tickSeed, `right:${index}`, catalog.atoms.length);
    if (rightIndex === leftIndex) rightIndex = (rightIndex + 1 + index) % catalog.atoms.length;
    const left = catalog.atoms[leftIndex];
    const right = catalog.atoms[rightIndex];
    observedProfileIdsThisTick.add(left.languageId);
    observedProfileIdsThisTick.add(right.languageId);
    const connection = classifyConnection(left, right, conditionRevision);
    const leftState = atomStates[leftIndex];
    const rightState = atomStates[rightIndex];
    const distance = circularDistancePpm(leftState.phasePpm, rightState.phasePpm);
    const interactionSeed = deriveSeed(tickSeed, 'interaction', index);
    const interactionCore = {
      interactionId: `interaction:${nextTick}:${String(index + 1).padStart(3, '0')}`,
      tick: nextTick,
      derivedInteractionSeed: interactionSeed,
      leftAtomId: left.atomId,
      rightAtomId: right.atomId,
      leftLanguageId: left.languageId,
      rightLanguageId: right.languageId,
      crossGrammar: left.languageId !== right.languageId,
      connectionSha256: connection.connectionSha256,
      connectionClass: connection.connectionClass,
      circularDistance: Number(distance.toFixed(6)),
      collisionThreshold: conditions.collisionThreshold,
      thresholdMet: distance <= conditions.collisionThreshold,
      influence: connection.influence,
      sourceAtomDigests: [left.atomSha256, right.atomSha256]
    };
    const interaction = deepFreeze({ ...interactionCore, interactionSha256: hash(interactionCore) });
    interactions.push(interaction);
    influenceCarries.push(...interactionCarryPair({ interaction, connection, leftState, rightState, conditions }));
    if (interaction.thresholdMet || ['CONTRAST', 'REPULSION', 'BOUNDARY'].includes(connection.connectionClass)) {
      const thirdIndex = integerFromSeed(tickSeed, `third:${index}`, catalog.atoms.length);
      const ids = [...new Set([left.atomId, right.atomId, catalog.atoms[thirdIndex].atomId])];
      if (ids.length >= 2) formationMap.set(ids.slice().sort().join('|'), ids);
    }
  }
  if (!formationMap.size && interactions.length) {
    const first = interactions[0];
    formationMap.set([first.leftAtomId, first.rightAtomId].sort().join('|'), [first.leftAtomId, first.rightAtomId]);
  }
  const observedEver = [...new Set([
    ...((cycle.interactionCoverage && cycle.interactionCoverage.observedProfileIdsEver) || []),
    ...observedProfileIdsThisTick
  ])].sort();
  const interactionCoverage = {
    observedProfileIdsThisTick: [...observedProfileIdsThisTick].sort(),
    observedProfileIdsEver: observedEver,
    observedProfileCountEver: observedEver.length,
    availableProfileCount: new Set(atomStates.map(state => state.languageId)).size,
    allProfilesObservedYet: observedEver.length === new Set(atomStates.map(state => state.languageId)).size
  };
  const influenceCarryDigest = hash(influenceCarries.map(carry => carry.carrySha256));
  const cycleFrameSha256 = hash({
    dayStartSha256: cycle.dayStartSha256,
    catalogSha256: cycle.catalogSha256,
    conditionSha256: conditionRevision.conditionSha256,
    tick: nextTick,
    atomStates: atomStates.map(state => state.atomStateSha256),
    interactions: interactions.map(interaction => interaction.interactionSha256),
    influenceCarries: influenceCarries.map(carry => carry.carrySha256),
    interactionCoverage
  });
  const withInteractionsCore = { ...provisionalCore, cycleFrameSha256, interactions, influenceCarries, influenceCarryDigest, interactionCoverage };
  const withInteractions = { ...withInteractionsCore, cycleSha256: hash(withInteractionsCore) };
  const formations = [...formationMap.values()].slice(0, 24).map((atomIds, index) => buildFormation({
    cycle: withInteractions,
    catalog,
    conditionRevision,
    atomIds,
    formationSeed: deriveSeed(tickSeed, 'formation', index),
    source: 'DETERMINISTIC_CYCLE_INTERACTION'
  }));
  const finalCore = { ...provisionalCore, cycleFrameSha256, interactions, influenceCarries, influenceCarryDigest, interactionCoverage, formations };
  return deepFreeze({ ...finalCore, cycleSha256: hash(finalCore) });
}

function validFormation(formation) {
  return !!formation && formation.schema === 'axm.code.grammar-glass-formation.v1' && digestCurrent(formation, 'formationSha256');
}

module.exports = Object.freeze({
  initializeCycle,
  circularDistancePpm,
  tokenIntersection,
  classifyConnection,
  shortestSignedPhaseDirection,
  clampInteger,
  influenceCarryClass,
  interactionCarryPair,
  aggregateInfluenceForAtom,
  getAtom,
  getAtomState,
  buildFormation,
  stepCycle,
  validFormation
});
