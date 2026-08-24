'use strict';

const base = require('./code-grammar-glass-base.js');
const cycleApi = require('./code-grammar-glass-cycle.js');
const observation = require('./code-grammar-glass-observation.js');

const {
  AUTHORITY,
  hash,
  deepFreeze,
  digestCurrent
} = base;

const DEFAULT_CONTACT_MEMORY_POLICY = Object.freeze({
  retentionTicks: 6,
  decayPerTick: 0.58,
  hopAttenuation: 0.52,
  maxHopCount: 3,
  maxEdges: 2048,
  maxPaths: 320,
  maxFanoutPerAtom: 6,
  maxEdgePpm: 5200,
  maxMemoryCarryPpm: 1100,
  minRetainedPpm: 8,
  maxMemoryCarriesPerTick: 96
});

function bounded(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function createContactMemoryPolicy(values = {}) {
  const settings = {
    retentionTicks: Math.round(bounded(values.retentionTicks, DEFAULT_CONTACT_MEMORY_POLICY.retentionTicks, 1, 64)),
    decayPerTick: bounded(values.decayPerTick, DEFAULT_CONTACT_MEMORY_POLICY.decayPerTick, 0.01, 1),
    hopAttenuation: bounded(values.hopAttenuation, DEFAULT_CONTACT_MEMORY_POLICY.hopAttenuation, 0.01, 1),
    maxHopCount: Math.round(bounded(values.maxHopCount, DEFAULT_CONTACT_MEMORY_POLICY.maxHopCount, 2, 5)),
    maxEdges: Math.round(bounded(values.maxEdges, DEFAULT_CONTACT_MEMORY_POLICY.maxEdges, 32, 8192)),
    maxPaths: Math.round(bounded(values.maxPaths, DEFAULT_CONTACT_MEMORY_POLICY.maxPaths, 16, 2048)),
    maxFanoutPerAtom: Math.round(bounded(values.maxFanoutPerAtom, DEFAULT_CONTACT_MEMORY_POLICY.maxFanoutPerAtom, 1, 24)),
    maxEdgePpm: Math.round(bounded(values.maxEdgePpm, DEFAULT_CONTACT_MEMORY_POLICY.maxEdgePpm, 100, 20000)),
    maxMemoryCarryPpm: Math.round(bounded(values.maxMemoryCarryPpm, DEFAULT_CONTACT_MEMORY_POLICY.maxMemoryCarryPpm, 10, 10000)),
    minRetainedPpm: Math.round(bounded(values.minRetainedPpm, DEFAULT_CONTACT_MEMORY_POLICY.minRetainedPpm, 1, 1000)),
    maxMemoryCarriesPerTick: Math.round(bounded(values.maxMemoryCarriesPerTick, DEFAULT_CONTACT_MEMORY_POLICY.maxMemoryCarriesPerTick, 1, 512))
  };
  const core = {
    schema: 'axm.code.grammar-contact-memory-policy.v1',
    version: '1.0.0',
    result: 'CONTACT_MEMORY_POLICY_READY',
    settings,
    truth: {
      policyDoesNotLearnWeights: true,
      decayIsExplicitAndReplayable: true,
      multiHopPropagationIsBounded: true,
      grammarIdentityMayNotBeMergedByMemory: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, policySha256: hash(core) });
}

function resolvePolicy(policy) {
  if (policy && policy.schema === 'axm.code.grammar-contact-memory-policy.v1' && digestCurrent(policy, 'policySha256')) return policy;
  return createContactMemoryPolicy(policy && policy.settings ? policy.settings : policy || {});
}

function validContactMemory(memory) {
  return !!memory && memory.schema === 'axm.code.grammar-contact-memory.v1' && digestCurrent(memory, 'contactMemorySha256');
}

function edgeKey(edge) {
  return [edge.sourceAtomId, edge.targetAtomId, edge.connectionClass || 'UNKNOWN'].join('|');
}

function normalizeEdge(edge, tick, policy, refreshed = false) {
  const settings = policy.settings;
  const signed = Math.max(-settings.maxEdgePpm, Math.min(settings.maxEdgePpm, Math.round(Number(edge.signedDeltaPpm || 0))));
  const core = {
    schema: 'axm.code.grammar-contact-memory-edge.v1',
    version: '1.0.0',
    sourceAtomId: String(edge.sourceAtomId),
    targetAtomId: String(edge.targetAtomId),
    sourceLanguageId: String(edge.sourceLanguageId),
    targetLanguageId: String(edge.targetLanguageId),
    crossGrammar: edge.sourceLanguageId !== edge.targetLanguageId,
    connectionClass: String(edge.connectionClass || 'UNRESOLVED_NEIGHBOURHOOD'),
    signedDeltaPpm: signed,
    firstObservedTick: Number.isSafeInteger(edge.firstObservedTick) ? edge.firstObservedTick : tick,
    lastObservedTick: refreshed ? tick : (Number.isSafeInteger(edge.lastObservedTick) ? edge.lastObservedTick : tick),
    ageTicks: Math.max(0, tick - (Number.isSafeInteger(edge.lastObservedTick) ? edge.lastObservedTick : tick)),
    observationCount: Math.max(1, Number.isSafeInteger(edge.observationCount) ? edge.observationCount : 1),
    originCarrySha256s: [...new Set(Array.isArray(edge.originCarrySha256s) ? edge.originCarrySha256s.filter(Boolean).map(String) : [])].sort(),
    refreshedThisTick: refreshed,
    truth: {
      memoryOfContactIsNotSemanticEquivalence: true,
      edgeDoesNotRewriteGrammarProfile: true,
      edgeMagnitudeIsReplayableMetadataState: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, memoryEdgeSha256: hash(core) });
}

function decayEdge(edge, tick, policy) {
  const settings = policy.settings;
  const elapsed = Math.max(1, tick - edge.lastObservedTick);
  const signedDeltaPpm = Math.round(Number(edge.signedDeltaPpm || 0) * Math.pow(settings.decayPerTick, elapsed));
  if (Math.abs(signedDeltaPpm) < settings.minRetainedPpm || elapsed > settings.retentionTicks) return null;
  return normalizeEdge({
    ...edge,
    signedDeltaPpm,
    originCarrySha256s: edge.originCarrySha256s,
    observationCount: edge.observationCount
  }, tick, policy, false);
}

function pathMagnitude(edges, policy) {
  const settings = policy.settings;
  let magnitude = Math.abs(Number(edges[0].signedDeltaPpm || 0));
  let sign = Math.sign(Number(edges[0].signedDeltaPpm || 0)) || 1;
  for (let index = 1; index < edges.length; index += 1) {
    const edge = edges[index];
    const ratio = Math.min(1, Math.abs(Number(edge.signedDeltaPpm || 0)) / settings.maxEdgePpm);
    magnitude *= ratio * settings.hopAttenuation;
    sign *= Math.sign(Number(edge.signedDeltaPpm || 0)) || 1;
  }
  return Math.max(-settings.maxMemoryCarryPpm, Math.min(settings.maxMemoryCarryPpm, Math.round(sign * magnitude)));
}

function buildMultiHopPaths(edges, policy) {
  const settings = policy.settings;
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceAtomId)) adjacency.set(edge.sourceAtomId, []);
    adjacency.get(edge.sourceAtomId).push(edge);
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => Math.abs(b.signedDeltaPpm) - Math.abs(a.signedDeltaPpm) || a.memoryEdgeSha256.localeCompare(b.memoryEdgeSha256));
    if (list.length > settings.maxFanoutPerAtom) list.length = settings.maxFanoutPerAtom;
  }

  const paths = [];
  const seen = new Set();
  const addPath = chain => {
    const atomIds = [chain[0].sourceAtomId, ...chain.map(edge => edge.targetAtomId)];
    if (new Set(atomIds).size !== atomIds.length) return;
    const signedDeltaPpm = pathMagnitude(chain, policy);
    if (Math.abs(signedDeltaPpm) < settings.minRetainedPpm) return;
    const edgeDigests = chain.map(edge => edge.memoryEdgeSha256);
    const key = edgeDigests.join('>');
    if (seen.has(key)) return;
    seen.add(key);
    const languageIds = [chain[0].sourceLanguageId, ...chain.map(edge => edge.targetLanguageId)];
    const connectionClasses = chain.map(edge => edge.connectionClass);
    const core = {
      schema: 'axm.code.grammar-contact-memory-path.v1',
      version: '1.0.0',
      sourceAtomId: atomIds[0],
      targetAtomId: atomIds[atomIds.length - 1],
      sourceLanguageId: languageIds[0],
      targetLanguageId: languageIds[languageIds.length - 1],
      pathAtomIds: atomIds,
      pathLanguageIds: languageIds,
      edgeDigests,
      hopCount: chain.length,
      signedDeltaPpm,
      crossGrammar: new Set(languageIds).size > 1,
      connectionClasses,
      unresolvedOrBoundaryVisible: connectionClasses.some(kind => ['CONTRAST', 'REPULSION', 'BOUNDARY', 'UNRESOLVED_NEIGHBOURHOOD'].includes(kind)),
      truth: {
        pathIsDerivedFromRecordedContactEdges: true,
        pathDoesNotClaimSemanticTransitivity: true,
        pathDoesNotMergeGrammarIdentity: true,
        pathIsNotLearningOrTraining: true
      },
      authority: 'NONE'
    };
    paths.push(deepFreeze({ ...core, memoryPathSha256: hash(core) }));
  };

  const walk = (chain, visited) => {
    if (paths.length >= settings.maxPaths) return;
    if (chain.length >= 2) addPath(chain);
    if (chain.length >= settings.maxHopCount) return;
    const last = chain[chain.length - 1];
    const nextEdges = adjacency.get(last.targetAtomId) || [];
    for (const next of nextEdges) {
      if (paths.length >= settings.maxPaths) return;
      if (visited.has(next.targetAtomId)) continue;
      const nextVisited = new Set(visited);
      nextVisited.add(next.targetAtomId);
      walk([...chain, next], nextVisited);
    }
  };

  const starters = [...edges].sort((a, b) => Math.abs(b.signedDeltaPpm) - Math.abs(a.signedDeltaPpm) || a.memoryEdgeSha256.localeCompare(b.memoryEdgeSha256));
  for (const edge of starters) {
    if (paths.length >= settings.maxPaths) break;
    walk([edge], new Set([edge.sourceAtomId, edge.targetAtomId]));
  }
  return paths
    .sort((a, b) => Math.abs(b.signedDeltaPpm) - Math.abs(a.signedDeltaPpm) || a.memoryPathSha256.localeCompare(b.memoryPathSha256))
    .slice(0, settings.maxPaths);
}

function evolveContactMemory({ previousMemory = null, cycle, memoryPolicy = null } = {}) {
  if (!cycle || !digestCurrent(cycle, 'cycleSha256')) throw new Error('GRAMMAR_GLASS_VALID_CYCLE_REQUIRED_FOR_CONTACT_MEMORY');
  const policy = resolvePolicy(memoryPolicy);
  if (previousMemory && !validContactMemory(previousMemory)) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_INVALID');
  if (previousMemory && previousMemory.policySha256 !== policy.policySha256) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_POLICY_MISMATCH');

  const tick = cycle.tick;
  const map = new Map();
  if (previousMemory) {
    for (const edge of previousMemory.contactEdges) {
      const decayed = decayEdge(edge, tick, policy);
      if (decayed) map.set(edgeKey(decayed), decayed);
    }
  }

  for (const carry of Array.isArray(cycle.influenceCarries) ? cycle.influenceCarries : []) {
    if (!carry || !carry.sourceAtomId || !carry.targetAtomId || !carry.carrySha256) continue;
    const key = edgeKey(carry);
    const prior = map.get(key);
    const combined = Math.max(-policy.settings.maxEdgePpm, Math.min(policy.settings.maxEdgePpm,
      Math.round(Number(prior && prior.signedDeltaPpm || 0) + Number(carry.signedDeltaPpm || 0))));
    const edge = normalizeEdge({
      sourceAtomId: carry.sourceAtomId,
      targetAtomId: carry.targetAtomId,
      sourceLanguageId: carry.sourceLanguageId,
      targetLanguageId: carry.targetLanguageId,
      connectionClass: carry.connectionClass,
      signedDeltaPpm: combined,
      firstObservedTick: prior ? prior.firstObservedTick : tick,
      lastObservedTick: tick,
      observationCount: (prior ? prior.observationCount : 0) + 1,
      originCarrySha256s: [...(prior ? prior.originCarrySha256s : []), carry.carrySha256]
    }, tick, policy, true);
    map.set(key, edge);
  }

  const contactEdges = [...map.values()]
    .sort((a, b) => Math.abs(b.signedDeltaPpm) - Math.abs(a.signedDeltaPpm) || a.memoryEdgeSha256.localeCompare(b.memoryEdgeSha256))
    .slice(0, policy.settings.maxEdges);
  const multiHopPaths = buildMultiHopPaths(contactEdges, policy);
  const core = {
    schema: 'axm.code.grammar-contact-memory.v1',
    version: '1.0.0',
    result: 'CONTACT_MEMORY_UPDATED_APPEND_DERIVED_STATE',
    tick,
    cycleSha256: cycle.cycleSha256,
    policySha256: policy.policySha256,
    contactEdgeCount: contactEdges.length,
    multiHopPathCount: multiHopPaths.length,
    contactEdges,
    multiHopPaths,
    truth: {
      contactMemoryIsDerivedFromRecordedCarries: true,
      oldContactInfluenceDecaysExplicitly: true,
      multiHopInfluenceIsBoundedAndReplayable: true,
      multiHopPathDoesNotProveSemanticTransitivity: true,
      grammarProfilesAreNotRewritten: true,
      contactMemoryIsNotTrainingOrLearnedWeights: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, contactMemorySha256: hash(core) });
}

function decayContactMemory(previousMemory, nextTick, memoryPolicy = null) {
  if (!validContactMemory(previousMemory)) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_INVALID');
  const policy = resolvePolicy(memoryPolicy || createContactMemoryPolicy());
  if (previousMemory.policySha256 !== policy.policySha256) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_POLICY_MISMATCH');
  const contactEdges = previousMemory.contactEdges.map(edge => decayEdge(edge, nextTick, policy)).filter(Boolean);
  const multiHopPaths = buildMultiHopPaths(contactEdges, policy);
  const core = {
    schema: 'axm.code.grammar-contact-memory.v1',
    version: '1.0.0',
    result: 'CONTACT_MEMORY_DECAYED_WITHOUT_NEW_CONTACT',
    tick: nextTick,
    cycleSha256: previousMemory.cycleSha256,
    policySha256: policy.policySha256,
    contactEdgeCount: contactEdges.length,
    multiHopPathCount: multiHopPaths.length,
    contactEdges,
    multiHopPaths,
    truth: {
      contactMemoryIsDerivedFromRecordedCarries: true,
      oldContactInfluenceDecaysExplicitly: true,
      multiHopInfluenceIsBoundedAndReplayable: true,
      multiHopPathDoesNotProveSemanticTransitivity: true,
      grammarProfilesAreNotRewritten: true,
      contactMemoryIsNotTrainingOrLearnedWeights: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, contactMemorySha256: hash(core) });
}

function memoryCarriesForNextTick({ contactMemory, cycle, memoryPolicy = null } = {}) {
  if (!validContactMemory(contactMemory)) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_INVALID');
  if (!cycle || !digestCurrent(cycle, 'cycleSha256')) throw new Error('GRAMMAR_GLASS_VALID_CYCLE_REQUIRED_FOR_MEMORY_CARRY');
  const policy = resolvePolicy(memoryPolicy);
  if (contactMemory.policySha256 !== policy.policySha256) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_POLICY_MISMATCH');
  return contactMemory.multiHopPaths
    .filter(path => path.sourceAtomId !== path.targetAtomId && Math.abs(path.signedDeltaPpm) >= policy.settings.minRetainedPpm)
    .slice(0, policy.settings.maxMemoryCarriesPerTick)
    .map(path => {
      const signedDeltaPpm = Math.max(-policy.settings.maxMemoryCarryPpm, Math.min(policy.settings.maxMemoryCarryPpm, Math.round(path.signedDeltaPpm)));
      const core = {
        schema: 'axm.code.grammar-contact-memory-carry.v1',
        version: '1.0.0',
        result: 'BOUNDED_MULTI_HOP_CONTACT_MEMORY_CARRY_READY',
        sourceInteractionSha256: path.memoryPathSha256,
        sourceAtomId: path.sourceAtomId,
        sourceLanguageId: path.sourceLanguageId,
        targetAtomId: path.targetAtomId,
        targetLanguageId: path.targetLanguageId,
        crossGrammar: path.crossGrammar,
        connectionClass: 'MULTI_HOP_CONTACT_MEMORY',
        carryClass: 'CONTACT_MEMORY_PROPAGATION',
        signedDeltaPpm,
        createdAtTick: cycle.tick,
        appliesAtTick: cycle.tick + 1,
        decay: policy.settings.decayPerTick,
        limitPpm: policy.settings.maxMemoryCarryPpm,
        memoryPathSha256: path.memoryPathSha256,
        hopCount: path.hopCount,
        pathAtomIds: path.pathAtomIds,
        pathLanguageIds: path.pathLanguageIds,
        truth: {
          memoryCarryIsNotEquivalence: true,
          memoryCarryDoesNotRewriteGrammarProfile: true,
          memoryCarryIsNotLearnedWeight: true,
          multiHopCarryIsDeterministicFromRecordedContactMemory: true
        },
        authority: 'NONE'
      };
      return deepFreeze({ ...core, carrySha256: hash(core) });
    });
}

function injectContactMemoryCarries({ cycle, contactMemory, memoryPolicy = null } = {}) {
  if (!cycle || !digestCurrent(cycle, 'cycleSha256')) throw new Error('GRAMMAR_GLASS_VALID_CYCLE_REQUIRED_FOR_MEMORY_INJECTION');
  if (!validContactMemory(contactMemory)) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_INVALID');
  const policy = resolvePolicy(memoryPolicy);
  const memoryCarries = memoryCarriesForNextTick({ contactMemory, cycle, memoryPolicy: policy });
  const influenceCarries = [...(Array.isArray(cycle.influenceCarries) ? cycle.influenceCarries : []), ...memoryCarries];
  const core = {
    ...cycle,
    influenceCarries,
    influenceCarryDigest: hash(influenceCarries.map(carry => carry.carrySha256)),
    contactMemoryInjection: {
      contactMemorySha256: contactMemory.contactMemorySha256,
      policySha256: policy.policySha256,
      memoryCarryCount: memoryCarries.length,
      memoryCarryDigest: hash(memoryCarries.map(carry => carry.carrySha256)),
      appliesAtTick: cycle.tick + 1,
      authority: 'NONE'
    }
  };
  delete core.cycleSha256;
  const injectedCycle = deepFreeze({ ...core, cycleSha256: hash(core) });
  return deepFreeze({
    schema: 'axm.code.grammar-contact-memory-injection.v1',
    result: memoryCarries.length ? 'CONTACT_MEMORY_CARRIES_INJECTED_FOR_NEXT_TICK' : 'NO_MULTI_HOP_MEMORY_CARRIES_AVAILABLE',
    inputCycleSha256: cycle.cycleSha256,
    injectedCycle,
    memoryCarries,
    memoryCarryCount: memoryCarries.length,
    truth: {
      injectionIsDeterministicStatePreparation: true,
      injectionDoesNotMutateGrammarProfiles: true,
      injectionDoesNotGrantExecutionAuthority: true
    },
    authority: 'NONE'
  });
}

function stepCycleWithContactMemory({ cycle, catalog, conditionRevision, contactMemory = null, memoryPolicy = null } = {}) {
  const policy = resolvePolicy(memoryPolicy);
  const currentMemory = contactMemory || evolveContactMemory({ cycle, memoryPolicy: policy });
  const injection = injectContactMemoryCarries({ cycle, contactMemory: currentMemory, memoryPolicy: policy });
  const nextCycle = cycleApi.stepCycle({ cycle: injection.injectedCycle, catalog, conditionRevision });
  const nextMemory = evolveContactMemory({ previousMemory: currentMemory, cycle: nextCycle, memoryPolicy: policy });
  const core = {
    schema: 'axm.code.grammar-glass-memory-step.v1',
    version: '1.0.0',
    result: 'CODE_TWISTER_ADVANCED_WITH_BOUNDED_CONTACT_MEMORY',
    inputCycleSha256: cycle.cycleSha256,
    preparedCycleSha256: injection.injectedCycle.cycleSha256,
    cycle: nextCycle,
    contactMemory: nextMemory,
    appliedMemoryCarries: injection.memoryCarries,
    appliedMemoryCarryDigest: hash(injection.memoryCarries.map(carry => carry.carrySha256)),
    memoryPolicy: policy,
    truth: {
      contactMemoryCanInfluenceLaterCirculation: injection.memoryCarries.length > 0,
      noGrammarIdentityMerged: true,
      noLearnedWeightUpdated: true,
      noSourceExecutionPerformed: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, memoryStepSha256: hash({ ...core, cycle: nextCycle.cycleSha256, contactMemory: nextMemory.contactMemorySha256 }) });
}

function explainCompositeFormation({ formation, cycle, contactMemory = null, appliedMemoryCarries = [] } = {}) {
  if (!cycle || !digestCurrent(cycle, 'cycleSha256') || !cycleApi.validFormation(formation)) {
    throw new Error('GRAMMAR_GLASS_VALID_FORMATION_AND_CYCLE_REQUIRED_FOR_EXPLANATION');
  }
  if (contactMemory && !validContactMemory(contactMemory)) throw new Error('GRAMMAR_GLASS_CONTACT_MEMORY_INVALID');
  const atomSet = new Set(formation.atomIds);
  const directCarries = (cycle.influenceCarries || []).filter(carry => atomSet.has(carry.sourceAtomId) || atomSet.has(carry.targetAtomId));
  const memoryCarries = (appliedMemoryCarries || []).filter(carry => atomSet.has(carry.targetAtomId) || atomSet.has(carry.sourceAtomId));
  const memoryPaths = contactMemory ? contactMemory.multiHopPaths.filter(path => path.pathAtomIds.some(atomId => atomSet.has(atomId))).slice(0, 24) : [];
  const whySteps = [
    {
      code: 'ATOM_SET_SELECTED_FROM_DETERMINISTIC_CYCLE_INTERACTION',
      detail: `${formation.atomIds.length} atom identities were captured at cycle tick ${formation.cycleStep}.`
    },
    {
      code: 'PAIRWISE_TYPED_RELATIONS_EVALUATED',
      detail: `${formation.connections.length} pairwise relations preserved classes: ${formation.connectionClasses.join(', ')}.`
    },
    {
      code: formation.nearestCircularDistance <= formation.collisionThreshold ? 'COLLISION_THRESHOLD_MET' : 'NON_COLLISION_CONTRAST_OR_BOUNDARY_OBSERVED',
      detail: `nearest=${formation.nearestCircularDistance}; threshold=${formation.collisionThreshold}; status=${formation.result}.`
    },
    {
      code: formation.composite.crossGrammar ? 'CROSS_GRAMMAR_COMPONENT_LINEAGE_PRESERVED' : 'SINGLE_GRAMMAR_LINEAGE_PRESERVED',
      detail: formation.composite.grammarComponents.map(component => `${component.languageId}:${component.atomTypes.join('+')}`).join(' | ')
    }
  ];
  if (memoryCarries.length) {
    whySteps.push({
      code: 'PRIOR_CONTACT_MEMORY_APPLIED_BEFORE_THIS_TICK',
      detail: `${memoryCarries.length} bounded multi-hop carry receipt(s) targeted atoms in this formation before observation.`
    });
  } else if (memoryPaths.length) {
    whySteps.push({
      code: 'CONTACT_MEMORY_PATHS_EXIST_BUT_EXACT_APPLICATION_NOT_CLAIMED',
      detail: `${memoryPaths.length} related memory path(s) exist; this explanation does not claim they altered this exact formation without an applied carry receipt.`
    });
  }
  const core = {
    schema: 'axm.code.grammar-glass-formation-explanation.v1',
    version: '1.0.0',
    result: 'FORMATION_DERIVATION_EXPLAINED_WITHOUT_QUALITY_CLAIM',
    formationSha256: formation.formationSha256,
    cycleSha256: cycle.cycleSha256,
    formationStatus: formation.result,
    compositeLineageSha256: formation.composite.compositeLineageSha256,
    grammarComponents: formation.composite.grammarComponents,
    connectionEvidence: formation.connections.map(connection => ({
      connectionSha256: connection.connectionSha256,
      connectionClass: connection.connectionClass,
      atoms: [connection.leftAtomId, connection.rightAtomId],
      reasons: connection.reasons,
      equivalenceClaimed: false
    })),
    directInfluenceCarryDigests: directCarries.map(carry => carry.carrySha256).sort(),
    appliedMemoryCarryDigests: memoryCarries.map(carry => carry.carrySha256).sort(),
    relatedMemoryPaths: memoryPaths.map(path => ({
      memoryPathSha256: path.memoryPathSha256,
      hopCount: path.hopCount,
      pathAtomIds: path.pathAtomIds,
      pathLanguageIds: path.pathLanguageIds,
      signedDeltaPpm: path.signedDeltaPpm,
      unresolvedOrBoundaryVisible: path.unresolvedOrBoundaryVisible
    })),
    whySteps,
    truth: {
      explanationCoversSimulatorDerivationOnly: true,
      explanationDoesNotProveSemanticCausality: true,
      explanationDoesNotProveUsefulCorrectOrExecutableSoftware: true,
      privateChainOfThoughtRequired: false,
      grammarIdentityRemainsDistinct: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, explanationSha256: hash(core) });
}

function createMirrorResponse({ mirrorObservation, formation, explanation } = {}) {
  if (!mirrorObservation || !digestCurrent(mirrorObservation, 'mirrorObservationSha256') || !cycleApi.validFormation(formation) || !explanation || !digestCurrent(explanation, 'explanationSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_MIRROR_FORMATION_EXPLANATION_REQUIRED');
  }
  const lines = [
    `observe ${formation.composite.kind}`,
    ...formation.composite.grammarComponents.map(component => `component ${component.languageId} :: ${component.atomTypes.join(' + ')}`),
    ...formation.connections.slice(0, 6).map(connection => `relation ${connection.leftAtomId} --${connection.connectionClass}--> ${connection.rightAtomId}`),
    explanation.appliedMemoryCarryDigests.length
      ? `contact-memory applied :: ${explanation.appliedMemoryCarryDigests.length} bounded multi-hop carry receipt(s)`
      : `contact-memory applied :: none claimed for this formation`,
    `mirror lens :: ${mirrorObservation.mirrorLens}`,
    `emit inert recipe :: ${mirrorObservation.draftRecipe.draftRecipeSha256}`,
    `authority :: NONE`
  ];
  const core = {
    schema: 'axm.code.grammar-glass-mirror-response.v1',
    version: '1.0.0',
    result: 'MIRROR_STRUCTURAL_RESPONSE_READY_NOT_EXECUTABLE',
    mirrorObservationSha256: mirrorObservation.mirrorObservationSha256,
    formationSha256: formation.formationSha256,
    explanationSha256: explanation.explanationSha256,
    compositeLineageSha256: formation.composite.compositeLineageSha256,
    draftRecipeSha256: mirrorObservation.draftRecipe.draftRecipeSha256,
    title: `${formation.languageIds.join(' × ')} structural response`,
    lines,
    truth: {
      responseDerivedFromRecordedFormationAndRecipe: true,
      responseIsNotSourceCode: true,
      responseIsNotExecution: true,
      responseIsNotQualityOrWinnerSelection: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, responseSha256: hash(core) });
}

function createVisualSnapshotWithMemory({ contactMemory = null, memoryStep = null, ...args } = {}) {
  const baseVisual = observation.createVisualSnapshot(args);
  const cycle = args.cycle;
  const mirrors = Array.isArray(args.mirrorObservations) ? args.mirrorObservations : [];
  const memoryCarries = memoryStep && Array.isArray(memoryStep.appliedMemoryCarries) ? memoryStep.appliedMemoryCarries : [];
  const explanations = cycle.formations.map(formation => explainCompositeFormation({
    formation,
    cycle,
    contactMemory,
    appliedMemoryCarries: memoryCarries
  }));
  const explanationByFormation = new Map(explanations.map(item => [item.formationSha256, item]));
  const mirrorResponses = mirrors
    .filter(mirror => mirror && mirror.mirrorObservationSha256 && digestCurrent(mirror, 'mirrorObservationSha256'))
    .map(mirror => {
      const formation = cycle.formations.find(item => item.formationSha256 === mirror.formationSha256);
      const explanation = explanationByFormation.get(mirror.formationSha256);
      return formation && explanation ? createMirrorResponse({ mirrorObservation: mirror, formation, explanation }) : null;
    })
    .filter(Boolean);
  const memorySummary = validContactMemory(contactMemory) ? {
    schema: contactMemory.schema,
    tick: contactMemory.tick,
    contactMemorySha256: contactMemory.contactMemorySha256,
    policySha256: contactMemory.policySha256,
    contactEdgeCount: contactMemory.contactEdgeCount,
    multiHopPathCount: contactMemory.multiHopPathCount,
    contactEdges: contactMemory.contactEdges.slice(0, 320),
    multiHopPaths: contactMemory.multiHopPaths.slice(0, 160)
  } : {
    schema: 'axm.code.grammar-contact-memory-visual-summary.v1',
    result: 'NO_CONTACT_MEMORY_SUPPLIED',
    contactEdgeCount: 0,
    multiHopPathCount: 0,
    contactEdges: [],
    multiHopPaths: []
  };
  const core = {
    ...baseVisual,
    version: '1.2.0',
    result: 'DRAFTSKY_VISUAL_SNAPSHOT_READY_WITH_CONTACT_MEMORY',
    contactMemory: memorySummary,
    appliedMemoryCarries: memoryCarries.slice(0, 160).map(carry => ({
      carrySha256: carry.carrySha256,
      sourceAtomId: carry.sourceAtomId,
      targetAtomId: carry.targetAtomId,
      sourceLanguageId: carry.sourceLanguageId,
      targetLanguageId: carry.targetLanguageId,
      signedDeltaPpm: carry.signedDeltaPpm,
      hopCount: carry.hopCount,
      pathAtomIds: carry.pathAtomIds,
      pathLanguageIds: carry.pathLanguageIds
    })),
    formationWhy: explanations,
    mirrorResponses,
    animationModel: {
      mode: 'RECORDED_STATE_VISUAL_INTERPOLATION_ONLY',
      phaseSource: 'cycle.atoms[].phasePpm',
      velocitySource: 'cycle.atoms[].angularVelocityPpm + appliedInfluenceCarryPpm',
      directPulseSource: 'cycle.influenceCarries[]',
      multiHopPulseSource: 'contactMemory.multiHopPaths[]',
      interpolationCreatesEvidence: false,
      animationMutatesCycle: false
    },
    truth: {
      ...baseVisual.truth,
      contactMemoryPathsDerivedFromRecordedCarries: true,
      mirrorResponseDerivedFromRecordedFormationAndRecipe: true,
      animationUsesRecordedStateButCreatesNoEvidence: true,
      multiHopMemoryIsNotSemanticTransitivity: true
    }
  };
  delete core.visualSnapshotSha256;
  return deepFreeze({ ...core, visualSnapshotSha256: hash(core) });
}

function snapshot() {
  const policy = createContactMemoryPolicy();
  const core = {
    schema: 'axm.code.grammar-contact-memory-snapshot.v1',
    version: '1.0.0',
    status: 'TEST',
    defaultPolicySha256: policy.policySha256,
    defaultPolicy: policy.settings,
    provides: [
      'decaying memory of recorded grammar contact',
      'bounded two-to-three-hop deterministic influence paths',
      'next-tick memory carries',
      'formation derivation inspector',
      'mirror structural response',
      'animated visual interpolation metadata'
    ],
    truth: {
      memoryIsNotTraining: true,
      multiHopInfluenceIsNotSemanticEquivalence: true,
      animationIsNotRuntimeEvidence: true,
      mirrorResponseIsNotExecutableCode: true,
      authorityGranted: false
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = Object.freeze({
  DEFAULT_CONTACT_MEMORY_POLICY,
  createContactMemoryPolicy,
  validContactMemory,
  decayContactMemory,
  buildMultiHopPaths,
  evolveContactMemory,
  memoryCarriesForNextTick,
  injectContactMemoryCarries,
  stepCycleWithContactMemory,
  explainCompositeFormation,
  createMirrorResponse,
  createVisualSnapshotWithMemory,
  snapshot
});
