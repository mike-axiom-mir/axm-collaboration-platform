'use strict';

const assert = require('assert/strict');
const glass = require('./code-grammar-glass.js');

let n = 0;
const ok = (value, message) => { assert.ok(value, message); n += 1; };
const eq = (left, right, message) => { assert.equal(left, right, message); n += 1; };
const de = (left, right, message) => { assert.deepEqual(left, right, message); n += 1; };
const ne = (left, right, message) => { assert.notEqual(left, right, message); n += 1; };

function advancedRun(dayStart, catalog, conditionRevision, memoryPolicy, ticks) {
  let cycle = glass.initializeCycle({ dayStart, catalog });
  let contactMemory = null;
  let lastStep = null;
  for (let index = 0; index < ticks; index += 1) {
    lastStep = glass.stepCycleWithContactMemory({ cycle, catalog, conditionRevision, contactMemory, memoryPolicy });
    cycle = lastStep.cycle;
    contactMemory = lastStep.contactMemory;
  }
  return { cycle, contactMemory, lastStep };
}

(function main() {
  const source = glass.loadGrammarSource();
  const catalog = glass.createAtomCatalog(source);
  const condition = glass.createConditionRevision({
    values: {
      interactionsPerTick: 128,
      scheduledAtomBudget: 320,
      collisionThreshold: 0.18,
      crossGrammarInfluenceWeight: 0.92,
      influenceCarryDecay: 0.66,
      influenceCarryLimitPpm: 2600,
      rotationRatePpm: 1410
    },
    reason: 'CONTACT_MEMORY_SELFTEST'
  });
  const policy = glass.createContactMemoryPolicy({
    retentionTicks: 6,
    decayPerTick: 0.58,
    hopAttenuation: 0.52,
    maxHopCount: 3,
    maxMemoryCarryPpm: 1100,
    maxMemoryCarriesPerTick: 96
  });
  const seed = '7f85925670e770e86e18fbad7e5aa1f580cf84588dd95aaa93fd2dcde70b47d1';
  const day = glass.createDayStart({ source, catalog, conditionRevision: condition, dayId: 'grammar-glass-memory-selftest', rootSeed: seed, startingStateRefs: ['pr:61:memory-steward'] });
  const replayDay = glass.createDayStart({ source, catalog, conditionRevision: condition, dayId: 'grammar-glass-memory-selftest', rootSeed: seed, startingStateRefs: ['pr:61:memory-steward'] });

  eq(policy.settings.maxHopCount, 3, 'three-hop ceiling');
  eq(policy.truth.policyDoesNotLearnWeights, true, 'memory policy is not learning');
  const first = advancedRun(day, catalog, condition, policy, 5);
  const replay = advancedRun(replayDay, catalog, condition, policy, 5);
  eq(first.cycle.cycleSha256, replay.cycle.cycleSha256, 'advanced cycle replay');
  eq(first.contactMemory.contactMemorySha256, replay.contactMemory.contactMemorySha256, 'contact memory replay');
  eq(first.lastStep.appliedMemoryCarryDigest, replay.lastStep.appliedMemoryCarryDigest, 'memory carry replay');
  ok(first.contactMemory.contactEdgeCount > 0, 'contact edges retained');
  ok(first.contactMemory.multiHopPathCount > 0, 'multi-hop paths exist');
  ok(first.contactMemory.multiHopPaths.some(path => path.crossGrammar), 'cross-grammar multi-hop path exists');
  ok(first.contactMemory.multiHopPaths.every(path => path.hopCount >= 2 && path.hopCount <= policy.settings.maxHopCount), 'hop count bounded');
  ok(first.contactMemory.multiHopPaths.every(path => new Set(path.pathAtomIds).size === path.pathAtomIds.length), 'paths do not loop through same atom');
  ok(first.contactMemory.multiHopPaths.every(path => path.truth.pathDoesNotClaimSemanticTransitivity), 'multi-hop path is not semantic transitivity');
  ok(first.contactMemory.contactEdges.every(edge => edge.truth.memoryOfContactIsNotSemanticEquivalence), 'contact memory is not equivalence');

  const nextCarries = glass.memoryCarriesForNextTick({ contactMemory: first.contactMemory, cycle: first.cycle, memoryPolicy: policy });
  ok(nextCarries.length > 0, 'memory carries produced');
  ok(nextCarries.every(carry => carry.carryClass === 'CONTACT_MEMORY_PROPAGATION'), 'memory carry class explicit');
  ok(nextCarries.every(carry => carry.hopCount >= 2 && carry.hopCount <= 3), 'memory carries retain hop count');
  ok(nextCarries.every(carry => Math.abs(carry.signedDeltaPpm) <= policy.settings.maxMemoryCarryPpm), 'memory carries bounded');
  ok(nextCarries.every(carry => carry.truth.memoryCarryIsNotLearnedWeight), 'memory carry not learned weight');

  const injected = glass.injectContactMemoryCarries({ cycle: first.cycle, contactMemory: first.contactMemory, memoryPolicy: policy });
  ok(injected.memoryCarryCount > 0, 'memory injected for next tick');
  const withMemory = glass.stepCycle({ cycle: injected.injectedCycle, catalog, conditionRevision: condition });
  const withoutMemory = glass.stepCycle({ cycle: first.cycle, catalog, conditionRevision: condition });
  const changedAtoms = withMemory.atomStates.filter(state => {
    const peer = withoutMemory.atomStates.find(item => item.atomId === state.atomId);
    return peer && state.phasePpm !== peer.phasePpm;
  });
  ok(changedAtoms.length > 0, 'contact memory changes later circulation');
  ok(changedAtoms.some(state => state.appliedInfluenceCarryCount > 0), 'changed atom records applied influence');
  ne(withMemory.cycleSha256, withoutMemory.cycleSha256, 'memory changes deterministic cycle digest');

  const decayed = glass.decayContactMemory(first.contactMemory, first.contactMemory.tick + 1, policy);
  ok(decayed.contactEdgeCount > 0, 'some memory survives one decay tick');
  const retained = decayed.contactEdges.find(edge => first.contactMemory.contactEdges.some(old => old.sourceAtomId === edge.sourceAtomId && old.targetAtomId === edge.targetAtomId && old.connectionClass === edge.connectionClass));
  ok(retained, 'retained edge addressable');
  const oldRetained = first.contactMemory.contactEdges.find(old => old.sourceAtomId === retained.sourceAtomId && old.targetAtomId === retained.targetAtomId && old.connectionClass === retained.connectionClass);
  ok(Math.abs(retained.signedDeltaPpm) <= Math.abs(oldRetained.signedDeltaPpm), 'memory magnitude decays without refresh');
  ok(decayed.contactEdges.every(edge => edge.ageTicks <= policy.settings.retentionTicks), 'retention bounded');

  const formation = first.cycle.formations[0];
  ok(formation, 'formation available for explanation');
  const mirror = glass.observeFormation({ cycle: first.cycle, catalog, formation, lens: 'POLYGLOT_CONTRAST' });
  eq(mirror.result, 'REACTIVE_DRAFT_MIRROR_OBSERVATION_READY', 'mirror observes formation');
  const why = glass.explainCompositeFormation({ formation, cycle: first.cycle, contactMemory: first.contactMemory, appliedMemoryCarries: first.lastStep.appliedMemoryCarries });
  eq(why.result, 'FORMATION_DERIVATION_EXPLAINED_WITHOUT_QUALITY_CLAIM', 'why inspector ready');
  eq(why.formationSha256, formation.formationSha256, 'why exact formation');
  eq(why.compositeLineageSha256, formation.composite.compositeLineageSha256, 'why exact lineage');
  ok(why.whySteps.length >= 4, 'why steps present');
  ok(why.connectionEvidence.every(item => item.equivalenceClaimed === false), 'why does not fake equivalence');
  eq(why.truth.privateChainOfThoughtRequired, false, 'why does not require chain of thought');

  const response = glass.createMirrorResponse({ mirrorObservation: mirror, formation, explanation: why });
  eq(response.result, 'MIRROR_STRUCTURAL_RESPONSE_READY_NOT_EXECUTABLE', 'mirror response ready');
  ok(response.lines.some(line => line.startsWith('component ')), 'response is derived from grammar components');
  ok(response.lines.some(line => line.startsWith('relation ')), 'response is derived from typed relations');
  eq(response.truth.responseIsNotSourceCode, true, 'response is structural not source');

  let ledger = glass.createConstellationLedger({ dayStart: day, source, catalog });
  ledger = glass.appendFormation(ledger, formation);
  const star = glass.captureDraftStar({ dayStart: day, conditionRevision: condition, cycle: first.cycle, formation, mirrorObservation: mirror });
  ledger = glass.appendDraftStar(ledger, star);
  const visual = glass.createVisualSnapshot({
    source,
    catalog,
    dayStart: day,
    conditionRevision: condition,
    cycle: first.cycle,
    contactMemory: first.contactMemory,
    memoryStep: first.lastStep,
    mirrorObservations: [mirror],
    ledger,
    stars: [star]
  });
  eq(visual.version, '1.2.0', 'advanced visual version');
  ok(visual.contactMemory.multiHopPathCount > 0, 'visual carries contact memory paths');
  ok(visual.formationWhy.length > 0, 'visual carries why inspector data');
  eq(visual.mirrorResponses.length, 1, 'visual carries mirror response');
  eq(visual.animationModel.interpolationCreatesEvidence, false, 'animation creates no evidence');
  eq(visual.truth.animationUsesRecordedStateButCreatesNoEvidence, true, 'animation truth boundary');
  eq(visual.truth.multiHopMemoryIsNotSemanticTransitivity, true, 'visual multi-hop truth boundary');

  const snap = glass.contactMemorySnapshot();
  eq(snap.truth.memoryIsNotTraining, true, 'snapshot memory not training');
  eq(snap.truth.animationIsNotRuntimeEvidence, true, 'snapshot animation not runtime evidence');
  ok(Object.values(glass.AUTHORITY).every(value => value === false), 'authority remains none');

  process.stdout.write(JSON.stringify({
    result: 'GRAMMAR_GLASS_CONTACT_MEMORY_STEWARD_SELFTEST_PASS',
    assertions: n,
    profileCount: source.profileCount,
    atomCount: catalog.atomCount,
    contactEdgeCount: first.contactMemory.contactEdgeCount,
    multiHopPathCount: first.contactMemory.multiHopPathCount,
    appliedMemoryCarryCount: first.lastStep.appliedMemoryCarries.length,
    changedAtomCountAgainstNoMemoryCounterfixture: changedAtoms.length,
    explanationSha256: why.explanationSha256,
    responseSha256: response.responseSha256,
    visualSnapshotSha256: visual.visualSnapshotSha256,
    authority: 'NONE'
  }, null, 2) + '\n');
})();
