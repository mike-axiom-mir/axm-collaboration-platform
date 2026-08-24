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
  const dayStart = glass.createDayStart({
    source,
    catalog,
    conditionRevision: conditions,
    dayId,
    rootSeed: seed || null,
    startingStateRefs: ['grammar-glass-snapshot-generator:v1.1-cross-grammar-influence']
  });
  let cycle = glass.initializeCycle({ dayStart, catalog });
  let ledger = glass.createConstellationLedger({ dayStart, source, catalog });
  const mirrors = [];
  const stars = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    cycle = glass.stepCycle({ cycle, catalog, conditionRevision: conditions });
    ledger = glass.appendLedgerEvent({
      ledger,
      eventType: 'CYCLE_OBSERVATION_APPENDED',
      payloadDigest: cycle.cycleSha256,
      payloadState: `CYCLE_TICK_${cycle.tick}_OBSERVED`
    });
    for (const formation of cycle.formations) {
      ledger = glass.appendFormation(ledger, formation);
      if (stars.length >= starLimit) continue;
      const mirror = glass.observeFormation({
        cycle,
        catalog,
        formation,
        lens: glass.MIRROR_LENSES[stars.length % glass.MIRROR_LENSES.length]
      });
      if (mirror.result !== 'REACTIVE_DRAFT_MIRROR_OBSERVATION_READY') continue;
      const star = glass.captureDraftStar({
        dayStart,
        conditionRevision: conditions,
        cycle,
        formation,
        mirrorObservation: mirror
      });
      mirrors.push(mirror);
      stars.push(star);
      ledger = glass.appendDraftStar(ledger, star);
    }
  }
  const visual = glass.createVisualSnapshot({
    source,
    catalog,
    dayStart,
    conditionRevision: conditions,
    cycle,
    mirrorObservations: mirrors,
    ledger,
    stars
  });
  process.stdout.write(`${JSON.stringify(visual, null, 2)}\n`);
}

main();
