import { FLOODPLAIN_SUCCESSION_GUILDS } from './floodplain-succession.mjs';
import { FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA } from './floodplain-plant-matter.mjs';
import {
  FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
  FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA
} from './floodplain.mjs';

export const FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-plant-resources-state/v1';
export const FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-plant-resources-receipt/v1';
export const FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA =
  'axm.foundation-planet.floodplain-plant-detritus-resource-debit/v1';

const GUILD_RESOURCE_TRAITS = Object.freeze({
  aquaticPioneers: Object.freeze({
    liveCarbonPhosphorusRatio: 240, liveWaterKgPerKgC: 7.5
  }),
  mudflatAnnuals: Object.freeze({
    liveCarbonPhosphorusRatio: 320, liveWaterKgPerKgC: 4.8
  }),
  reedSedge: Object.freeze({
    liveCarbonPhosphorusRatio: 360, liveWaterKgPerKgC: 6.2
  }),
  wetMeadow: Object.freeze({
    liveCarbonPhosphorusRatio: 300, liveWaterKgPerKgC: 4.6
  }),
  riparianWoodland: Object.freeze({
    liveCarbonPhosphorusRatio: 420, liveWaterKgPerKgC: 3.1
  })
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function livePool(source = {}) {
  return {
    supportedCarbonKgC: Math.max(0, finite(source.supportedCarbonKgC)),
    phosphorusKgP: Math.max(0, finite(source.phosphorusKgP)),
    waterKg: Math.max(0, finite(source.waterKg))
  };
}

function detritalPool(source = {}) {
  return {
    supportedCarbonKgC: Math.max(0, finite(source.supportedCarbonKgC)),
    phosphorusKgP: Math.max(0, finite(source.phosphorusKgP))
  };
}

function resourceFlux(source = {}) {
  return {
    phosphorusKgP: Math.max(0, finite(source.phosphorusKgP)),
    waterKg: Math.max(0, finite(source.waterKg))
  };
}

function addResourceFlux(...sources) {
  return sources.reduce((total, source) => ({
    phosphorusKgP: total.phosphorusKgP +
      Math.max(0, finite(source?.phosphorusKgP)),
    waterKg: total.waterKg + Math.max(0, finite(source?.waterKg))
  }), resourceFlux());
}

function addDetritalPools(...sources) {
  return sources.reduce((total, source) => ({
    supportedCarbonKgC: total.supportedCarbonKgC +
      Math.max(0, finite(source?.supportedCarbonKgC)),
    phosphorusKgP: total.phosphorusKgP +
      Math.max(0, finite(source?.phosphorusKgP))
  }), detritalPool());
}

function rounded(source = {}, digits = 9) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) =>
    [key, round(Math.max(0, finite(value)), digits)]));
}

function truth() {
  return {
    persistentPlantPhosphorusAndTissueWater: true,
    pairedFloodplainResourceExchangeRequired: true,
    resourceBackedCarbonReferenceOwnsCarbon: false,
    independentBoundaryCreation: false,
    mortalityWaterReturnsToLocalFloodplainReservoir: true,
    phosphorusRetainedThroughStandingDeadAndLitter: true,
    decompositionAndSoilNutrientReturn: false,
    detritalDecompositionSenderDebitAvailable: true,
    floodplainChemistryReturnAvailable: true,
    transpirationAndAtmosphereCoupling: false,
    resolvedRootHydraulics: false,
    mechanisticStoichiometry: false,
    scientificPlantResourceModel: false
  };
}

function emptyGuildState(id) {
  return {
    id,
    live: livePool(),
    standingDead: detritalPool(),
    litter: detritalPool(),
    migrationLegacyUnsupported: {
      liveCarbonKgC: 0,
      standingDeadCarbonKgC: 0,
      litterCarbonKgC: 0
    },
    cumulativeFloodplainUptake: resourceFlux(),
    cumulativeMortalityWaterReturnKg: 0,
    cumulativeMortalityPhosphorusKgP: 0,
    cumulativeStandingDeadToLitterPhosphorusKgP: 0,
    cumulativeDetritusDecompositionDebits: detritalPool()
  };
}

function normalizeGuildState(source, id) {
  const state = emptyGuildState(id);
  if (!source || source.id !== id) return state;
  state.live = livePool(source.live);
  state.standingDead = detritalPool(source.standingDead);
  state.litter = detritalPool(source.litter);
  state.migrationLegacyUnsupported = {
    liveCarbonKgC: Math.max(0, finite(
      source.migrationLegacyUnsupported?.liveCarbonKgC)),
    standingDeadCarbonKgC: Math.max(0, finite(
      source.migrationLegacyUnsupported?.standingDeadCarbonKgC)),
    litterCarbonKgC: Math.max(0, finite(
      source.migrationLegacyUnsupported?.litterCarbonKgC))
  };
  state.cumulativeFloodplainUptake = resourceFlux(
    source.cumulativeFloodplainUptake);
  state.cumulativeMortalityWaterReturnKg = Math.max(0, finite(
    source.cumulativeMortalityWaterReturnKg));
  state.cumulativeMortalityPhosphorusKgP = Math.max(0, finite(
    source.cumulativeMortalityPhosphorusKgP));
  state.cumulativeStandingDeadToLitterPhosphorusKgP = Math.max(0, finite(
    source.cumulativeStandingDeadToLitterPhosphorusKgP));
  state.cumulativeDetritusDecompositionDebits = detritalPool(
    source.cumulativeDetritusDecompositionDebits);
  return state;
}

export function emptyFloodplainPlantResourcesState(options = {}) {
  return {
    schema: FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedResourceDays: 0,
    dormantDays: 0,
    guilds: Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
      [id, emptyGuildState(id)])),
    lastPlantMatterReceiptDigest: null,
    lastFloodplainResourceDebitReceiptDigest: null,
    lastFloodplainWaterReturnReceiptDigest: null,
    lastDetritusResourceDebitReceipt: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainPlantResourcesState(source,
  options = {}) {
  const state = emptyFloodplainPlantResourcesState(options);
  if (source?.schema !== FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.observedResourceDays = Math.max(0,
    finite(source.observedResourceDays));
  state.dormantDays = Math.max(0, finite(source.dormantDays));
  state.guilds = Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
    [id, normalizeGuildState(source.guilds?.[id], id)]));
  for (const key of [
    'lastPlantMatterReceiptDigest',
    'lastFloodplainResourceDebitReceiptDigest',
    'lastFloodplainWaterReturnReceiptDigest'
  ]) state[key] = typeof source[key] === 'string' ? source[key] : null;
  state.lastDetritusResourceDebitReceipt =
    source.lastDetritusResourceDebitReceipt?.schema ===
      FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA
      ? clone(source.lastDetritusResourceDebitReceipt) : null;
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

function stateTotals(source) {
  const state = normalizeFloodplainPlantResourcesState(source);
  const totals = {
    live: livePool(), standingDead: detritalPool(), litter: detritalPool(),
    migrationLegacyUnsupportedCarbonKgC: 0,
    cumulativeFloodplainUptake: resourceFlux(),
    cumulativeMortalityWaterReturnKg: 0
  };
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const guild = state.guilds[id];
    for (const key of Object.keys(totals.live)) {
      totals.live[key] += finite(guild.live[key]);
    }
    for (const key of Object.keys(totals.standingDead)) {
      totals.standingDead[key] += finite(guild.standingDead[key]);
      totals.litter[key] += finite(guild.litter[key]);
    }
    totals.migrationLegacyUnsupportedCarbonKgC +=
      finite(guild.migrationLegacyUnsupported.liveCarbonKgC) +
      finite(guild.migrationLegacyUnsupported.standingDeadCarbonKgC) +
      finite(guild.migrationLegacyUnsupported.litterCarbonKgC);
    totals.cumulativeFloodplainUptake = addResourceFlux(
      totals.cumulativeFloodplainUptake,
      guild.cumulativeFloodplainUptake);
    totals.cumulativeMortalityWaterReturnKg +=
      finite(guild.cumulativeMortalityWaterReturnKg);
  }
  totals.total = {
    supportedCarbonKgC: totals.live.supportedCarbonKgC +
      totals.standingDead.supportedCarbonKgC +
      totals.litter.supportedCarbonKgC,
    phosphorusKgP: totals.live.phosphorusKgP +
      totals.standingDead.phosphorusKgP + totals.litter.phosphorusKgP,
    liveWaterKg: totals.live.waterKg
  };
  return totals;
}

export function floodplainPlantResourcesSummary(source) {
  const state = normalizeFloodplainPlantResourcesState(source);
  const totals = stateTotals(state);
  const guilds = Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id => {
    const guild = state.guilds[id];
    return [id, {
      live: rounded(guild.live),
      standingDead: rounded(guild.standingDead),
      litter: rounded(guild.litter),
      total: rounded({
        supportedCarbonKgC: guild.live.supportedCarbonKgC +
          guild.standingDead.supportedCarbonKgC +
          guild.litter.supportedCarbonKgC,
        phosphorusKgP: guild.live.phosphorusKgP +
          guild.standingDead.phosphorusKgP + guild.litter.phosphorusKgP,
        liveWaterKg: guild.live.waterKg
      }),
      migrationLegacyUnsupported: rounded(
        guild.migrationLegacyUnsupported)
    }];
  }));
  const dominantGuild = totals.total.phosphorusKgP > 1e-15 ||
    totals.total.liveWaterKg > 1e-12
    ? FLOODPLAIN_SUCCESSION_GUILDS.reduce((best, id) =>
      state.guilds[id].live.phosphorusKgP >
        state.guilds[best].live.phosphorusKgP ? id : best,
    FLOODPLAIN_SUCCESSION_GUILDS[0]) : 'unresourced';
  return {
    observedResourceDays: round(state.observedResourceDays, 8),
    dormantDays: round(state.dormantDays, 8),
    live: rounded(totals.live),
    standingDead: rounded(totals.standingDead),
    litter: rounded(totals.litter),
    total: rounded(totals.total),
    migrationLegacyUnsupportedCarbonKgC: round(
      totals.migrationLegacyUnsupportedCarbonKgC, 9),
    cumulativeFloodplainUptake: rounded(
      totals.cumulativeFloodplainUptake),
    cumulativeMortalityWaterReturnKg: round(
      totals.cumulativeMortalityWaterReturnKg, 9),
    dominantGuild,
    guilds,
    truth: truth()
  };
}

function requirePlantMatterReceipt(receipt) {
  if (receipt?.schema !== FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA ||
    !Array.isArray(receipt.guildFlows)) {
    throw new TypeError('Floodplain plant resources require the current plant-matter transition receipt');
  }
  return receipt;
}

export function floodplainPlantResourceDemandFromMatterDemand(
  matterDemand = {}) {
  const perGuild = {};
  let totals = resourceFlux();
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const carbonKgC = Math.max(0, finite(
      matterDemand.perGuild?.[id]?.demand?.carbonKgC));
    const traits = GUILD_RESOURCE_TRAITS[id];
    const uptake = {
      phosphorusKgP: carbonKgC / traits.liveCarbonPhosphorusRatio,
      waterKg: carbonKgC * traits.liveWaterKgPerKgC
    };
    perGuild[id] = {
      supportedCarbonKgC: round(carbonKgC, 9),
      uptake: rounded(uptake)
    };
    totals = addResourceFlux(totals, uptake);
  }
  return { perGuild, totals: rounded(totals) };
}

export function floodplainPlantResourcePlan(source, plantMatterReceipt) {
  const state = normalizeFloodplainPlantResourcesState(source);
  const matter = requirePlantMatterReceipt(plantMatterReceipt);
  const migration = state.migrationCheckpoint;
  const dormant = matter.status === 'life-disabled-dormant';
  const perGuild = {};
  let uptakeTotals = resourceFlux();
  let waterReturnKg = 0;
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const guild = state.guilds[id];
    const flow = matter.guildFlows.find(entry => entry.guildId === id);
    if (!flow) throw new Error(`Plant-matter receipt lacks guild flow: ${id}`);
    const creditedCarbon = migration || dormant ? 0 : Math.max(0,
      finite(flow.landEcologyCredit?.carbonKgC));
    const uptake = migration || dormant ? resourceFlux() : {
      phosphorusKgP: creditedCarbon /
        GUILD_RESOURCE_TRAITS[id].liveCarbonPhosphorusRatio,
      waterKg: creditedCarbon *
        GUILD_RESOURCE_TRAITS[id].liveWaterKgPerKgC
    };
    const mortalityFraction = migration || dormant ? 0 : clamp(
      finite(flow.liveToStandingDead?.carbonKgC) /
      Math.max(1e-30, finite(flow.before?.live?.carbonKgC)));
    const standingFallFraction = migration || dormant ? 0 : clamp(
      finite(flow.standingDeadToLitter?.carbonKgC) /
      Math.max(1e-30, finite(flow.before?.standingDead?.carbonKgC)));
    const returnedWaterKg = guild.live.waterKg * mortalityFraction;
    perGuild[id] = {
      supportedCarbonCreditKgC: round(creditedCarbon, 9),
      uptake: rounded(uptake),
      mortalityFraction: round(mortalityFraction, 12),
      standingFallFraction: round(standingFallFraction, 12),
      returnedWaterKg: round(returnedWaterKg, 9)
    };
    uptakeTotals = addResourceFlux(uptakeTotals, uptake);
    waterReturnKg += returnedWaterKg;
  }
  return {
    migrationCheckpoint: migration,
    dormant,
    perGuild,
    uptakeTotals: rounded(uptakeTotals),
    waterReturnKg: round(waterReturnKg, 9)
  };
}

function makeReceipt(state, matter, context, status, before, after, flows,
  exchange) {
  const credited = addResourceFlux(...flows.map(flow => flow.uptake));
  const returnedWaterKg = flows.reduce((sum, flow) => sum +
    finite(flow.waterReturnedToFloodplainKg), 0);
  const maximumResidual = Math.max(0, ...flows.flatMap(flow => [
    Math.abs(flow.closure.supportedCarbonResidualKgC),
    Math.abs(flow.closure.phosphorusResidualKgP),
    Math.abs(flow.closure.liveWaterResidualKg)
  ]));
  const receipt = {
    schema: FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-plant-resources:${stableDigest({
        reachId: context.reachId || matter.reachId || null,
        startDay: round(context.startDay, 8),
        matterDigest: matter.digest,
        debitDigest: exchange?.debitReceiptDigest || null,
        returnDigest: exchange?.returnReceiptDigest || null
      }).slice(9)}`),
    reachId: context.reachId || matter.reachId || null,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(context.durationDays, 8),
    plantMatterReceiptDigest: matter.digest,
    floodplainResourceDebitReceiptDigest:
      exchange?.debitReceiptDigest || null,
    floodplainWaterReturnReceiptDigest:
      exchange?.returnReceiptDigest || null,
    uptakeTransferIds: flows.map(flow => flow.uptakeTransferId)
      .filter(Boolean).sort(),
    waterReturnTransferIds: flows.map(flow => flow.waterReturnTransferId)
      .filter(Boolean).sort(),
    before: clone(before),
    after: clone(after),
    guildFlows: clone(flows),
    transfers: {
      floodplainUptake: rounded(credited),
      mortalityWaterReturnedKg: round(returnedWaterKg, 9),
      liveToStandingDeadPhosphorusKgP: round(flows.reduce((sum, flow) =>
        sum + finite(flow.liveToStandingDead.phosphorusKgP), 0), 9),
      standingDeadToLitterPhosphorusKgP: round(flows.reduce((sum, flow) =>
        sum + finite(flow.standingDeadToLitter.phosphorusKgP), 0), 9)
    },
    closure: {
      maximumResidualKg: round(maximumResidual, 12),
      supportedCarbonResidualKgC: round(after.total.supportedCarbonKgC -
        before.total.supportedCarbonKgC - flows.reduce((sum, flow) =>
          sum + finite(flow.supportedCarbonCreditKgC), 0), 12),
      phosphorusResidualKgP: round(after.total.phosphorusKgP -
        before.total.phosphorusKgP - credited.phosphorusKgP, 12),
      liveWaterResidualKg: round(after.total.liveWaterKg -
        before.total.liveWaterKg - credited.waterKg + returnedWaterKg, 12)
    },
    truth: {
      ...truth(),
      plantMatterEvidenceBound: typeof matter.digest === 'string',
      floodplainUptakeDebited: credited.phosphorusKgP <= 1e-15 &&
        credited.waterKg <= 1e-12
        ? true : typeof exchange?.debitReceiptDigest === 'string',
      mortalityWaterReceiverCredited: returnedWaterKg <= 1e-12
        ? true : typeof exchange?.returnReceiptDigest === 'string',
      exactPairedTransferIds: flows.every(flow =>
        flow.uptake.phosphorusKgP <= 1e-15 && flow.uptake.waterKg <= 1e-12
          ? flow.uptakeTransferId == null
          : typeof flow.uptakeTransferId === 'string') &&
        flows.every(flow => flow.waterReturnedToFloodplainKg <= 1e-12
          ? flow.waterReturnTransferId == null
          : typeof flow.waterReturnTransferId === 'string'),
      resourceLedgersClosed: maximumResidual < 1e-7 &&
        Math.abs(after.total.phosphorusKgP - before.total.phosphorusKgP -
          credited.phosphorusKgP) < 1e-7 &&
        Math.abs(after.total.liveWaterKg - before.total.liveWaterKg -
          credited.waterKg + returnedWaterKg) < 1e-7,
      migrationInventedResources: false,
      resourcePoolsFrozen: status === 'life-disabled-dormant'
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  state.lastPlantMatterReceiptDigest = matter.digest;
  state.lastFloodplainResourceDebitReceiptDigest =
    receipt.floodplainResourceDebitReceiptDigest;
  state.lastFloodplainWaterReturnReceiptDigest =
    receipt.floodplainWaterReturnReceiptDigest;
  return receipt;
}

export function advanceFloodplainPlantResources(source, plantMatterReceipt,
  exchange = {}, context = {}) {
  const durationDays = finite(context.durationDays, 1);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain plant resource step must be greater than zero and no longer than one day');
  }
  const state = normalizeFloodplainPlantResourcesState(source);
  const matter = requirePlantMatterReceipt(plantMatterReceipt);
  const before = floodplainPlantResourcesSummary(state);
  if (state.migrationCheckpoint) {
    for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
      const matterGuild = matter.after?.guilds?.[id] || {};
      state.guilds[id].migrationLegacyUnsupported = {
        liveCarbonKgC: Math.max(0, finite(matterGuild.live?.carbonKgC)),
        standingDeadCarbonKgC: Math.max(0,
          finite(matterGuild.standingDead?.carbonKgC)),
        litterCarbonKgC: Math.max(0, finite(matterGuild.litter?.carbonKgC))
      };
    }
    state.migrationCheckpoint = false;
    const flows = FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      guildId: id, uptakeTransferId: null, waterReturnTransferId: null,
      supportedCarbonCreditKgC: 0, uptake: resourceFlux(),
      liveToStandingDead: detritalPool(),
      standingDeadToLitter: detritalPool(),
      waterReturnedToFloodplainKg: 0,
      closure: { supportedCarbonResidualKgC: 0,
        phosphorusResidualKgP: 0, liveWaterResidualKg: 0 }
    }));
    const after = floodplainPlantResourcesSummary(state);
    const receipt = makeReceipt(state, matter, context,
      'initialized-after-v11-migration-no-invented-resources', before,
      after, flows, {});
    return { state: normalizeFloodplainPlantResourcesState(state),
      receipt: clone(receipt) };
  }
  if (matter.status === 'life-disabled-dormant') {
    state.dormantDays += durationDays;
    const flows = FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      guildId: id, uptakeTransferId: null, waterReturnTransferId: null,
      supportedCarbonCreditKgC: 0, uptake: resourceFlux(),
      liveToStandingDead: detritalPool(),
      standingDeadToLitter: detritalPool(),
      waterReturnedToFloodplainKg: 0,
      closure: { supportedCarbonResidualKgC: 0,
        phosphorusResidualKgP: 0, liveWaterResidualKg: 0 }
    }));
    const after = floodplainPlantResourcesSummary(state);
    const receipt = makeReceipt(state, matter, context,
      'life-disabled-dormant', before, after, flows, {});
    return { state: normalizeFloodplainPlantResourcesState(state),
      receipt: clone(receipt) };
  }
  const plan = floodplainPlantResourcePlan(state, matter);
  const supplied = resourceFlux(exchange.totals);
  if (Math.abs(supplied.phosphorusKgP -
      plan.uptakeTotals.phosphorusKgP) > 1e-8 ||
    Math.abs(supplied.waterKg - plan.uptakeTotals.waterKg) > 1e-6 ||
    Math.abs(Math.max(0, finite(exchange.waterReturnKg)) -
      plan.waterReturnKg) > 1e-6) {
    throw new Error('Floodplain plant resource exchange does not match transition plan');
  }
  const flows = [];
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const guild = state.guilds[id];
    const prior = clone(guild);
    const planned = plan.perGuild[id];
    const suppliedGuild = resourceFlux(exchange.perGuild?.[id]);
    if (Math.abs(suppliedGuild.phosphorusKgP -
        planned.uptake.phosphorusKgP) > 1e-8 ||
      Math.abs(suppliedGuild.waterKg - planned.uptake.waterKg) > 1e-6) {
      throw new Error(`Floodplain plant resource guild exchange mismatch: ${id}`);
    }
    const mortalityFraction = planned.mortalityFraction;
    const fallFraction = planned.standingFallFraction;
    const liveToStandingDead = {
      supportedCarbonKgC: prior.live.supportedCarbonKgC *
        mortalityFraction,
      phosphorusKgP: prior.live.phosphorusKgP * mortalityFraction
    };
    const waterReturnedToFloodplainKg = prior.live.waterKg *
      mortalityFraction;
    const standingDeadToLitter = {
      supportedCarbonKgC: prior.standingDead.supportedCarbonKgC *
        fallFraction,
      phosphorusKgP: prior.standingDead.phosphorusKgP * fallFraction
    };
    guild.live = livePool({
      supportedCarbonKgC: prior.live.supportedCarbonKgC -
        liveToStandingDead.supportedCarbonKgC +
        planned.supportedCarbonCreditKgC,
      phosphorusKgP: prior.live.phosphorusKgP -
        liveToStandingDead.phosphorusKgP + suppliedGuild.phosphorusKgP,
      waterKg: prior.live.waterKg - waterReturnedToFloodplainKg +
        suppliedGuild.waterKg
    });
    guild.standingDead = detritalPool({
      supportedCarbonKgC: prior.standingDead.supportedCarbonKgC -
        standingDeadToLitter.supportedCarbonKgC +
        liveToStandingDead.supportedCarbonKgC,
      phosphorusKgP: prior.standingDead.phosphorusKgP -
        standingDeadToLitter.phosphorusKgP +
        liveToStandingDead.phosphorusKgP
    });
    guild.litter = detritalPool({
      supportedCarbonKgC: prior.litter.supportedCarbonKgC +
        standingDeadToLitter.supportedCarbonKgC,
      phosphorusKgP: prior.litter.phosphorusKgP +
        standingDeadToLitter.phosphorusKgP
    });
    guild.cumulativeFloodplainUptake = addResourceFlux(
      prior.cumulativeFloodplainUptake, suppliedGuild);
    guild.cumulativeMortalityWaterReturnKg +=
      waterReturnedToFloodplainKg;
    guild.cumulativeMortalityPhosphorusKgP +=
      liveToStandingDead.phosphorusKgP;
    guild.cumulativeStandingDeadToLitterPhosphorusKgP +=
      standingDeadToLitter.phosphorusKgP;
    const beforeSupportedC = prior.live.supportedCarbonKgC +
      prior.standingDead.supportedCarbonKgC +
      prior.litter.supportedCarbonKgC;
    const afterSupportedC = guild.live.supportedCarbonKgC +
      guild.standingDead.supportedCarbonKgC +
      guild.litter.supportedCarbonKgC;
    const beforeP = prior.live.phosphorusKgP +
      prior.standingDead.phosphorusKgP + prior.litter.phosphorusKgP;
    const afterP = guild.live.phosphorusKgP +
      guild.standingDead.phosphorusKgP + guild.litter.phosphorusKgP;
    flows.push({
      guildId: id,
      uptakeTransferId: exchange.uptakeTransferIds?.[id] || null,
      waterReturnTransferId:
        exchange.waterReturnTransferIds?.[id] || null,
      supportedCarbonCreditKgC: planned.supportedCarbonCreditKgC,
      uptake: rounded(suppliedGuild),
      liveToStandingDead: rounded(liveToStandingDead),
      standingDeadToLitter: rounded(standingDeadToLitter),
      waterReturnedToFloodplainKg: round(
        waterReturnedToFloodplainKg, 9),
      before: { live: rounded(prior.live),
        standingDead: rounded(prior.standingDead),
        litter: rounded(prior.litter) },
      after: { live: rounded(guild.live),
        standingDead: rounded(guild.standingDead),
        litter: rounded(guild.litter) },
      closure: {
        supportedCarbonResidualKgC: round(afterSupportedC -
          beforeSupportedC - planned.supportedCarbonCreditKgC, 12),
        phosphorusResidualKgP: round(afterP - beforeP -
          suppliedGuild.phosphorusKgP, 12),
        liveWaterResidualKg: round(guild.live.waterKg -
          prior.live.waterKg - suppliedGuild.waterKg +
          waterReturnedToFloodplainKg, 12)
      }
    });
  }
  state.observedResourceDays += durationDays;
  const after = floodplainPlantResourcesSummary(state);
  const status = plan.uptakeTotals.phosphorusKgP > 1e-15 ||
    plan.uptakeTotals.waterKg > 1e-12
    ? 'floodplain-phosphorus-water-uptake-credited'
    : plan.waterReturnKg > 1e-12
      ? 'mortality-water-returned' : 'plant-resources-maintained';
  const receipt = makeReceipt(state, matter, context, status, before, after,
    flows, exchange);
  return { state: normalizeFloodplainPlantResourcesState(state),
    receipt: clone(receipt) };
}

function normalizedDetritusResourceAllocations(allocations = []) {
  const normalized = [...allocations].map(entry => ({
    transferId: String(entry?.transferId || ''),
    guildId: String(entry?.guildId || ''),
    pool: String(entry?.pool || ''),
    supportedCarbonKgC: Math.max(0,
      finite(entry?.supportedCarbonKgC)),
    phosphorusKgP: Math.max(0, finite(entry?.phosphorusKgP))
  })).sort((a, b) => a.transferId.localeCompare(b.transferId));
  if (normalized.some(entry => !entry.transferId ||
      !FLOODPLAIN_SUCCESSION_GUILDS.includes(entry.guildId) ||
      !['standingDead', 'litter'].includes(entry.pool)) ||
    new Set(normalized.map(entry => entry.transferId)).size !==
      normalized.length) {
    throw new Error('Plant detritus resource debit requires unique bound guild-pool transfers');
  }
  return normalized;
}

export function applyFloodplainPlantDetritusResourceDebit(source,
  allocations = [], context = {}) {
  const state = normalizeFloodplainPlantResourcesState(source);
  const reachId = String(context.reachId || '');
  if (!reachId) {
    throw new Error('Plant detritus resource debit requires a reach ID');
  }
  const entries = normalizedDetritusResourceAllocations(allocations);
  if (context.livingEnabled === false && entries.some(entry =>
    entry.supportedCarbonKgC > 1e-12 || entry.phosphorusKgP > 1e-15)) {
    throw new Error('Life-off cannot debit plant detritus resources');
  }
  const before = floodplainPlantResourcesSummary(state);
  const flows = [];
  for (const entry of entries) {
    const guild = state.guilds[entry.guildId];
    const pool = detritalPool(guild[entry.pool]);
    if (entry.supportedCarbonKgC > pool.supportedCarbonKgC + 1e-7 ||
      entry.phosphorusKgP > pool.phosphorusKgP + 1e-9) {
      throw new Error(`Plant detritus resource donor exhausted: ${entry.guildId}/${entry.pool}`);
    }
    guild[entry.pool] = detritalPool({
      supportedCarbonKgC: pool.supportedCarbonKgC -
        entry.supportedCarbonKgC,
      phosphorusKgP: pool.phosphorusKgP - entry.phosphorusKgP
    });
    guild.cumulativeDetritusDecompositionDebits = addDetritalPools(
      guild.cumulativeDetritusDecompositionDebits, entry);
    flows.push({
      ...entry,
      supportedCarbonKgC: round(entry.supportedCarbonKgC, 9),
      phosphorusKgP: round(entry.phosphorusKgP, 12),
      before: rounded(pool),
      after: rounded(guild[entry.pool]),
      closure: {
        supportedCarbonResidualKgC: round(pool.supportedCarbonKgC -
          entry.supportedCarbonKgC -
          guild[entry.pool].supportedCarbonKgC, 12),
        phosphorusResidualKgP: round(pool.phosphorusKgP -
          entry.phosphorusKgP - guild[entry.pool].phosphorusKgP, 12)
      }
    });
  }
  const debited = addDetritalPools(...entries);
  const after = floodplainPlantResourcesSummary(state);
  const receipt = {
    schema: FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(finite(context.durationDays, 1), 8),
    allocations: flows,
    before,
    debited: rounded(debited),
    after,
    closure: {
      supportedCarbonResidualKgC: round(
        before.total.supportedCarbonKgC - debited.supportedCarbonKgC -
        after.total.supportedCarbonKgC, 12),
      phosphorusResidualKgP: round(before.total.phosphorusKgP -
        debited.phosphorusKgP - after.total.phosphorusKgP, 12)
    },
    truth: {
      persistentPlantResourceSenderDebited: true,
      standingDeadAndLitterOnly: true,
      exactPerGuildPoolTransferIds: true,
      supportedCarbonIsNonOwningReference: true,
      phosphorusClosed: Math.abs(before.total.phosphorusKgP -
        debited.phosphorusKgP - after.total.phosphorusKgP) < 1e-9,
      decompositionCreatesResources: false,
      lifeOffFrozen: context.livingEnabled === false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastDetritusResourceDebitReceipt = clone(receipt);
  return { state: normalizeFloodplainPlantResourcesState(state),
    receipt: clone(receipt) };
}

export function floodplainPlantResourcesDescription() {
  return {
    stateSchema: FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
    debitReceiptSchema: FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
    waterReturnReceiptSchema: FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
    detritusResourceDebitReceiptSchema:
      FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
    guilds: FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      id, ...GUILD_RESOURCE_TRAITS[id]
    })),
    pools: ['live-tissue-water', 'live-phosphorus',
      'standing-dead-phosphorus', 'litter-phosphorus',
      'non-owning-resource-backed-carbon-reference'],
    processes: ['joint-growth-resource-demand',
      'paired-floodplain-water-phosphorus-uptake',
      'mortality-phosphorus-to-standing-dead',
      'standing-dead-phosphorus-to-litter',
      'mortality-tissue-water-return-to-local-floodplain',
      'paired-detritus-decomposition-resource-debit',
      'v11-zero-resource-migration', 'Life-off-freeze'],
    maximumStepDays: 1,
    truth: truth()
  };
}
