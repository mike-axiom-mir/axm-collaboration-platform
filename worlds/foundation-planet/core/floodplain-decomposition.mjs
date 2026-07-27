import { FLOODPLAIN_SUCCESSION_GUILDS } from './floodplain-succession.mjs';
import {
  FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
  normalizeFloodplainPlantMatterState
} from './floodplain-plant-matter.mjs';
import {
  FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
  normalizeFloodplainPlantResourcesState
} from './floodplain-plant-resources.mjs';
import {
  FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
  normalizeFloodplainState
} from './floodplain.mjs';

export const FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-decomposition-state/v1';
export const FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-decomposition-receipt/v1';

const GUILD_DECOMPOSITION_TRAITS = Object.freeze({
  aquaticPioneers: Object.freeze({
    standingDeadRateDay: .002, litterRateDay: .018
  }),
  mudflatAnnuals: Object.freeze({
    standingDeadRateDay: .003, litterRateDay: .024
  }),
  reedSedge: Object.freeze({
    standingDeadRateDay: .0012, litterRateDay: .012
  }),
  wetMeadow: Object.freeze({
    standingDeadRateDay: .0015, litterRateDay: .016
  }),
  riparianWoodland: Object.freeze({
    standingDeadRateDay: .00025, litterRateDay: .004
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

function elements(source = {}) {
  return {
    carbonKgC: Math.max(0, finite(source.carbonKgC)),
    nitrogenKgN: Math.max(0, finite(source.nitrogenKgN)),
    phosphorusKgP: Math.max(0, finite(source.phosphorusKgP))
  };
}

function addElements(...sources) {
  return sources.reduce((sum, source) => ({
    carbonKgC: sum.carbonKgC + Math.max(0, finite(source?.carbonKgC)),
    nitrogenKgN: sum.nitrogenKgN +
      Math.max(0, finite(source?.nitrogenKgN)),
    phosphorusKgP: sum.phosphorusKgP +
      Math.max(0, finite(source?.phosphorusKgP))
  }), elements());
}

function roundedElements(source = {}) {
  return {
    carbonKgC: round(Math.max(0, finite(source.carbonKgC)), 9),
    nitrogenKgN: round(Math.max(0, finite(source.nitrogenKgN)), 9),
    phosphorusKgP: round(Math.max(0, finite(source.phosphorusKgP)), 12)
  };
}

function truth() {
  return {
    persistentDecompositionProcessMemory: true,
    materialOwnership: false,
    plantDetritusSenderDebitsRequired: true,
    localFloodplainChemistryReceiverRequired: true,
    onlyResourceBackedDetritusEligible: true,
    independentMaterialCreation: false,
    atmosphericRespirationModeled: false,
    oxygenConsumptionModeled: false,
    soilReceiverModeled: false,
    microbialPopulationsResolved: false,
    mechanisticDecompositionModel: false,
    scientificCalibrationClaimed: false
  };
}

export function emptyFloodplainDecompositionState(options = {}) {
  return {
    schema: FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedDecompositionDays: 0,
    dormantDays: 0,
    cumulativeFloodplainReturn: elements(),
    lastActivity: {
      moistureFactor: 0,
      lifeAbundance: 0,
      activityScale: 0,
      eligibleCarbonKgC: 0
    },
    lastMatterDebitReceiptDigest: null,
    lastResourceDebitReceiptDigest: null,
    lastFloodplainCreditReceiptDigest: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainDecompositionState(source,
  options = {}) {
  const state = emptyFloodplainDecompositionState(options);
  if (source?.schema !== FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.observedDecompositionDays = Math.max(0,
    finite(source.observedDecompositionDays));
  state.dormantDays = Math.max(0, finite(source.dormantDays));
  state.cumulativeFloodplainReturn = elements(
    source.cumulativeFloodplainReturn);
  state.lastActivity = {
    moistureFactor: clamp(finite(source.lastActivity?.moistureFactor)),
    lifeAbundance: clamp(finite(source.lastActivity?.lifeAbundance), 0, 2),
    activityScale: clamp(finite(source.lastActivity?.activityScale), 0, 1.5),
    eligibleCarbonKgC: Math.max(0,
      finite(source.lastActivity?.eligibleCarbonKgC))
  };
  for (const key of ['lastMatterDebitReceiptDigest',
    'lastResourceDebitReceiptDigest', 'lastFloodplainCreditReceiptDigest']) {
    state[key] = typeof source[key] === 'string' ? source[key] : null;
  }
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

export function floodplainDecompositionSummary(source) {
  const state = normalizeFloodplainDecompositionState(source);
  return {
    observedDecompositionDays: round(state.observedDecompositionDays, 8),
    dormantDays: round(state.dormantDays, 8),
    cumulativeFloodplainReturn: roundedElements(
      state.cumulativeFloodplainReturn),
    lastActivity: {
      moistureFactor: round(state.lastActivity.moistureFactor, 9),
      lifeAbundance: round(state.lastActivity.lifeAbundance, 9),
      activityScale: round(state.lastActivity.activityScale, 9),
      eligibleCarbonKgC: round(state.lastActivity.eligibleCarbonKgC, 9)
    },
    truth: truth()
  };
}

export function floodplainDecompositionPlan(source, matterSource,
  resourceSource, floodplainSource, context = {}) {
  const state = normalizeFloodplainDecompositionState(source);
  const matter = normalizeFloodplainPlantMatterState(matterSource);
  const resources = normalizeFloodplainPlantResourcesState(resourceSource);
  const floodplain = normalizeFloodplainState(floodplainSource);
  const durationDays = finite(context.durationDays, 1);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain decomposition step must be greater than zero and no longer than one day');
  }
  const livingEnabled = context.livingEnabled !== false;
  const lifeAbundance = livingEnabled
    ? clamp(finite(context.lifeAbundance, 1), 0, 2) : 0;
  const hasFreeWater = floodplain.waterKg > 1e-9 ? 1 : 0;
  const moistureFactor = clamp(.18 + .62 * Math.sqrt(clamp(
    floodplain.inundatedFraction)) + .2 * hasFreeWater, .05, 1);
  const activityScale = state.migrationCheckpoint || !livingEnabled
    ? 0 : clamp(moistureFactor * lifeAbundance, 0, 1.5);
  const perGuild = {};
  let totals = elements();
  let eligibleCarbonKgC = 0;
  for (const guildId of FLOODPLAIN_SUCCESSION_GUILDS) {
    const pools = {};
    for (const pool of ['standingDead', 'litter']) {
      const matterPool = matter.guilds[guildId][pool];
      const resourcePool = resources.guilds[guildId][pool];
      const eligibleCarbon = Math.min(
        Math.max(0, finite(matterPool.carbonKgC)),
        Math.max(0, finite(resourcePool.supportedCarbonKgC)));
      const rate = pool === 'standingDead'
        ? GUILD_DECOMPOSITION_TRAITS[guildId].standingDeadRateDay
        : GUILD_DECOMPOSITION_TRAITS[guildId].litterRateDay;
      const fraction = 1 - Math.exp(-rate * durationDays * activityScale);
      const carbonKgC = eligibleCarbon * fraction;
      const nitrogenKgN = matterPool.carbonKgC > 1e-30
        ? matterPool.nitrogenKgN * carbonKgC / matterPool.carbonKgC : 0;
      const phosphorusKgP = resourcePool.supportedCarbonKgC > 1e-30
        ? resourcePool.phosphorusKgP * carbonKgC /
          resourcePool.supportedCarbonKgC : 0;
      const returned = { carbonKgC, nitrogenKgN, phosphorusKgP };
      pools[pool] = {
        eligibleCarbonKgC: round(eligibleCarbon, 9),
        rateDay: round(rate, 9),
        fraction: round(fraction, 12),
        returned: roundedElements(returned)
      };
      eligibleCarbonKgC += eligibleCarbon;
      totals = addElements(totals, returned);
    }
    perGuild[guildId] = pools;
  }
  return {
    durationDays: round(durationDays, 8),
    livingEnabled,
    migrationCheckpoint: state.migrationCheckpoint,
    moistureFactor: round(moistureFactor, 9),
    lifeAbundance: round(lifeAbundance, 9),
    activityScale: round(activityScale, 9),
    eligibleCarbonKgC: round(eligibleCarbonKgC, 9),
    perGuild,
    totals: roundedElements(totals),
    truth: {
      onlyResourceBackedDetritusEligible: true,
      legacyUnsupportedDetritusUntouched: true,
      LifeOffHasZeroActivity: !livingEnabled ? activityScale === 0 : true,
      migrationHasZeroActivity: state.migrationCheckpoint
        ? activityScale === 0 : true
    }
  };
}

function requireReceipt(receipt, schema, label) {
  if (receipt?.schema !== schema || !Array.isArray(receipt.allocations)) {
    throw new TypeError(`Floodplain decomposition requires ${label}`);
  }
  return receipt;
}

function allocationMap(receipt) {
  return new Map(receipt.allocations.map(entry => [entry.transferId, entry]));
}

export function advanceFloodplainDecomposition(source, plan,
  matterDebitSource, resourceDebitSource, floodplainCreditSource,
  context = {}) {
  const state = normalizeFloodplainDecompositionState(source);
  const matterDebit = requireReceipt(matterDebitSource,
    FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
    'the current plant-detritus matter debit receipt');
  const resourceDebit = requireReceipt(resourceDebitSource,
    FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
    'the current plant-detritus resource debit receipt');
  const floodplainCredit = requireReceipt(floodplainCreditSource,
    FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    'the current floodplain detrital-return credit receipt');
  const reachId = String(context.reachId || '');
  if (!reachId || [matterDebit, resourceDebit, floodplainCredit].some(
    receipt => receipt.reachId !== reachId)) {
    throw new Error('Floodplain decomposition receipt reach lineage mismatch');
  }
  const durationDays = finite(context.durationDays, 1);
  const totals = elements(plan?.totals);
  const matterById = allocationMap(matterDebit);
  const resourceById = allocationMap(resourceDebit);
  const receiverById = allocationMap(floodplainCredit);
  const ids = [...matterById.keys()].sort();
  const exactIds = ids.length === resourceById.size &&
    ids.length === receiverById.size && ids.every(id =>
      resourceById.has(id) && receiverById.has(id));
  if (!exactIds) {
    throw new Error('Floodplain decomposition sender and receiver transfer IDs differ');
  }
  let maximumTransferResidual = 0;
  for (const id of ids) {
    const matter = matterById.get(id);
    const resource = resourceById.get(id);
    const receiver = receiverById.get(id);
    if (matter.guildId !== resource.guildId ||
      matter.guildId !== receiver.guildId ||
      matter.pool !== resource.pool || matter.pool !== receiver.pool) {
      throw new Error(`Floodplain decomposition transfer identity mismatch: ${id}`);
    }
    maximumTransferResidual = Math.max(maximumTransferResidual,
      Math.abs(finite(matter.carbonKgC) -
        finite(resource.supportedCarbonKgC)),
      Math.abs(finite(matter.carbonKgC) - finite(receiver.carbonKgC)),
      Math.abs(finite(matter.nitrogenKgN) - finite(receiver.nitrogenKgN)),
      Math.abs(finite(resource.phosphorusKgP) -
        finite(receiver.phosphorusKgP)));
  }
  const receiptTotalsMatch =
    Math.abs(finite(matterDebit.debited?.carbonKgC) -
      totals.carbonKgC) < 1e-7 &&
    Math.abs(finite(matterDebit.debited?.nitrogenKgN) -
      totals.nitrogenKgN) < 1e-7 &&
    Math.abs(finite(resourceDebit.debited?.supportedCarbonKgC) -
      totals.carbonKgC) < 1e-7 &&
    Math.abs(finite(resourceDebit.debited?.phosphorusKgP) -
      totals.phosphorusKgP) < 1e-9 &&
    Math.abs(finite(floodplainCredit.credited?.carbonKgC) -
      totals.carbonKgC) < 1e-7 &&
    Math.abs(finite(floodplainCredit.credited?.nitrogenKgN) -
      totals.nitrogenKgN) < 1e-7 &&
    Math.abs(finite(floodplainCredit.credited?.phosphorusKgP) -
      totals.phosphorusKgP) < 1e-9;
  if (!receiptTotalsMatch || maximumTransferResidual >= 1e-7) {
    throw new Error('Floodplain decomposition sender and receiver quantities differ');
  }
  const before = floodplainDecompositionSummary(state);
  let status;
  if (state.migrationCheckpoint) {
    if (totals.carbonKgC > 1e-12 || totals.nitrogenKgN > 1e-12 ||
      totals.phosphorusKgP > 1e-15 || ids.length) {
      throw new Error('Floodplain decomposition migration cannot move material');
    }
    state.migrationCheckpoint = false;
    status = 'initialized-after-v12-migration-no-invented-history';
  } else if (plan?.livingEnabled === false) {
    if (totals.carbonKgC > 1e-12 || totals.nitrogenKgN > 1e-12 ||
      totals.phosphorusKgP > 1e-15 || ids.length) {
      throw new Error('Life-off decomposition must have zero transfers');
    }
    state.dormantDays += durationDays;
    status = 'life-disabled-dormant';
  } else {
    state.observedDecompositionDays += durationDays;
    state.cumulativeFloodplainReturn = addElements(
      state.cumulativeFloodplainReturn, totals);
    status = totals.carbonKgC > 1e-12 || totals.nitrogenKgN > 1e-12 ||
      totals.phosphorusKgP > 1e-15
      ? 'detritus-returned-to-local-floodplain-chemistry'
      : 'decomposition-maintained-no-eligible-detritus';
  }
  state.lastActivity = {
    moistureFactor: clamp(finite(plan?.moistureFactor)),
    lifeAbundance: clamp(finite(plan?.lifeAbundance), 0, 2),
    activityScale: clamp(finite(plan?.activityScale), 0, 1.5),
    eligibleCarbonKgC: Math.max(0, finite(plan?.eligibleCarbonKgC))
  };
  state.lastMatterDebitReceiptDigest = matterDebit.digest;
  state.lastResourceDebitReceiptDigest = resourceDebit.digest;
  state.lastFloodplainCreditReceiptDigest = floodplainCredit.digest;
  const after = floodplainDecompositionSummary(state);
  const receipt = {
    schema: FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-decomposition:${stableDigest({
        reachId, startDay: round(context.startDay, 8),
        matterDebitDigest: matterDebit.digest,
        resourceDebitDigest: resourceDebit.digest,
        receiverDigest: floodplainCredit.digest
      }).slice(9)}`),
    reachId,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    matterDebitReceiptDigest: matterDebit.digest,
    resourceDebitReceiptDigest: resourceDebit.digest,
    floodplainCreditReceiptDigest: floodplainCredit.digest,
    transferIds: ids,
    activity: {
      moistureFactor: round(finite(plan?.moistureFactor), 9),
      lifeAbundance: round(finite(plan?.lifeAbundance), 9),
      activityScale: round(finite(plan?.activityScale), 9),
      eligibleCarbonKgC: round(finite(plan?.eligibleCarbonKgC), 9)
    },
    perGuild: clone(plan?.perGuild || {}),
    transfers: roundedElements(totals),
    before,
    after,
    closure: {
      maximumTransferResidualKg: round(maximumTransferResidual, 12),
      carbonResidualKgC: round(finite(matterDebit.debited?.carbonKgC) -
        finite(floodplainCredit.credited?.carbonKgC), 12),
      nitrogenResidualKgN: round(finite(matterDebit.debited?.nitrogenKgN) -
        finite(floodplainCredit.credited?.nitrogenKgN), 12),
      phosphorusResidualKgP: round(
        finite(resourceDebit.debited?.phosphorusKgP) -
        finite(floodplainCredit.credited?.phosphorusKgP), 12)
    },
    truth: {
      ...truth(),
      exactSenderReceiverTransferIds: exactIds,
      plantMatterSenderDebited:
        matterDebit.truth?.persistentPlantMatterSenderDebited === true,
      plantResourceSenderDebited:
        resourceDebit.truth?.persistentPlantResourceSenderDebited === true,
      floodplainChemistryReceiverCredited:
        floodplainCredit.truth
          ?.persistentFloodplainChemistryReceiverCredited === true,
      carbonNitrogenPhosphorusClosed: maximumTransferResidual < 1e-7 &&
        receiptTotalsMatch,
      migrationInventedHistory: false,
      decompositionPoolsFrozen: status === 'life-disabled-dormant'
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  return { state: normalizeFloodplainDecompositionState(state),
    receipt: clone(receipt) };
}

export function floodplainDecompositionDescription() {
  return {
    stateSchema: FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA,
    matterDebitReceiptSchema:
      FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
    resourceDebitReceiptSchema:
      FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
    receiverCreditReceiptSchema: FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    guilds: FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      id, ...GUILD_DECOMPOSITION_TRAITS[id]
    })),
    donorPools: ['resource-backed-standing-dead-carbon-nitrogen-phosphorus',
      'resource-backed-litter-carbon-nitrogen-phosphorus'],
    receiverPools: ['floodplain-dissolved-organic-carbon',
      'floodplain-dissolved-inorganic-nitrogen',
      'floodplain-dissolved-inorganic-phosphorus'],
    processes: ['moisture-bounded-aggregate-detrital-breakdown',
      'exact-paired-plant-detritus-sender-debits',
      'exact-local-floodplain-chemistry-receiver-credit',
      'v12-zero-history-migration', 'Life-off-freeze'],
    maximumStepDays: 1,
    truth: truth()
  };
}
