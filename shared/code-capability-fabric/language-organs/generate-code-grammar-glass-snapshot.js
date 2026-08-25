'use strict';

const glass = require('./code-grammar-glass.js');

function argument(name, fallback = null) {
  const flag = `--${name}`;
  const direct = process.argv.find(value => value.startsWith(`${flag}=`));
  if (direct) return direct.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main() {
  const seed = argument('seed');
  const dayId = argument('day', 'grammar-glass');
  const ticks = Math.max(1, Math.min(64, Number(argument('ticks', '8')) || 8));
  const starLimit = Math.max(1, Math.min(24, Number(argument('stars', '8')) || 8));
  const source = glass.loadGrammarSource();
  const catalog = glass.createAtomCatalog(source);
  const conditions = glass.createConditionRevision({
    values: {
      mirrorLens: 'STRUCTURAL_SEAM',
      interactionsPerTick: 64,
      scheduledAtomBudget: 256,
      collisionThreshold: 0.17,
      crossGrammarInfluenceWeight: 0.9,
      influenceCarryDecay: 0.64,
      influenceCarryLimitPpm: 2400,
      rotationRatePpm: 1360
    },
    reason: 'GRAMMAR_GLASS_VISUAL_SNAPSHOT_GENERATION'
  });
  const memoryPolicy = glass.createContactMemoryPolicy({
    retentionTicks: 6,
    decayPerTick: 0.58,
    hopAttenuation: 0.52,
    maxHopCount: 3,
    maxMemoryCarryPpm: 1100,
    maxMemoryCarriesPerTick: 96
  });
  const interglassPolicy = glass.createInterglassPolicy({ persistenceIntent: 'TRANSIENT', maxAttempts: 1, timeoutMs: 1800 });
  const dayStart = glass.createDayStart({
    source,
    catalog,
    conditionRevision: conditions,
    dayId,
    rootSeed: seed || null,
    startingStateRefs: ['grammar-glass-snapshot-generator:v1.4-execution-history']
  });
  let cycle = glass.initializeCycle({ dayStart, catalog });
  let contactMemory = null;
  let memoryStep = null;
  let ledger = glass.createConstellationLedger({ dayStart, source, catalog });
  let visualMirrors = [];
  const stars = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    memoryStep = glass.stepCycleWithContactMemory({
      cycle,
      catalog,
      conditionRevision: conditions,
      contactMemory,
      memoryPolicy
    });
    cycle = memoryStep.cycle;
    contactMemory = memoryStep.contactMemory;
    ledger = glass.appendLedgerEvent({
      ledger,
      eventType: 'CYCLE_OBSERVATION_APPENDED',
      payloadDigest: cycle.cycleSha256,
      payloadState: `CYCLE_TICK_${cycle.tick}_OBSERVED`
    });
    const tickMirrors = [];
    for (const [formationIndex, formation] of cycle.formations.entries()) {
      ledger = glass.appendFormation(ledger, formation);
      const mirror = glass.observeFormation({
        cycle,
        catalog,
        formation,
        lens: glass.MIRROR_LENSES[formationIndex % glass.MIRROR_LENSES.length]
      });
      if (mirror.result !== 'REACTIVE_DRAFT_MIRROR_OBSERVATION_READY') continue;
      if (tickMirrors.length < 8) tickMirrors.push(mirror);
      if (stars.length >= starLimit) continue;
      const star = glass.captureDraftStar({
        dayStart,
        conditionRevision: conditions,
        cycle,
        formation,
        mirrorObservation: mirror
      });
      stars.push(star);
      ledger = glass.appendDraftStar(ledger, star);
    }
    visualMirrors = tickMirrors;
  }
  let interglassState = glass.createInterglassVisualState();
  if (cycle.formations.length) {
    const formation = cycle.formations[0];
    const mirror = glass.observeFormation({ cycle, catalog, formation, lens: 'STRUCTURAL_SEAM' });
    if (mirror.result === 'REACTIVE_DRAFT_MIRROR_OBSERVATION_READY') {
      const star = glass.captureDraftStar({ dayStart, conditionRevision: conditions, cycle, formation, mirrorObservation: mirror });
      const why = glass.explainCompositeFormation({
        formation,
        cycle,
        contactMemory,
        appliedMemoryCarries: memoryStep && memoryStep.appliedMemoryCarries || []
      });
      const candidateModel = glass.createInterglassCandidateModel({ star, mirrorObservation: mirror, formationWhy: why, policy: interglassPolicy });
      const executorProfile = glass.createBrowserSandboxExecutorProfile({ policy: interglassPolicy });
      const runRequest = glass.createInterglassRunRequest({
        candidateModel,
        star,
        mirrorObservation: mirror,
        executorProfile,
        policy: interglassPolicy,
        requestedBy: 'EXPLICIT_PHASE_2_DEMO_REQUEST'
      });
      interglassState = glass.createInterglassVisualState({ candidateModel, runRequest });
      ledger = glass.appendDraftStar(ledger, star);
      visualMirrors = [mirror, ...visualMirrors.filter(item => item.mirrorObservationSha256 !== mirror.mirrorObservationSha256)].slice(0, 8);
      if (!stars.some(item => item.starSha256 === star.starSha256)) stars.unshift(star);
      if (stars.length > starLimit) stars.length = starLimit;
    }
  }
  const visualBase = glass.createVisualSnapshot({
    source,
    catalog,
    dayStart,
    conditionRevision: conditions,
    cycle,
    contactMemory,
    memoryStep,
    mirrorObservations: visualMirrors,
    ledger,
    stars
  });
  const doubleGlassVisual = glass.augmentVisualSnapshotWithInterglass({ visualSnapshot: visualBase, interglass: interglassState });
  const executionHistory = glass.createExecutionHistory({
    dayStart,
    interglassPolicySha256: interglassPolicy.policySha256
  });
  const visual = glass.augmentVisualSnapshotWithExecutionHistory({
    visualSnapshot: doubleGlassVisual,
    executionHistory
  });
  process.stdout.write(`${JSON.stringify(visual, null, 2)}\n`);
}

main();
