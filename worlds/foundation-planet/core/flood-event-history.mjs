import {
  FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_STATE_SCHEMA,
  floodplainTotals,
  normalizeFloodplainState
} from './floodplain.mjs';

export const FLOOD_EVENT_HISTORY_STATE_SCHEMA =
  'axm.foundation-planet.flood-event-history-state/v1';
export const FLOOD_EVENT_SCHEMA =
  'axm.foundation-planet.flood-event/v1';
export const FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA =
  'axm.foundation-planet.flood-event-transition-receipt/v1';
export const FLOOD_EVENT_ARCHIVE_LIMIT = 32;

const GRAINS = Object.freeze(['clay', 'silt', 'sand', 'gravel']);
const CHEMISTRY = Object.freeze([
  'carbonKgC', 'nitrogenKgN', 'phosphorusKgP', 'oxygenKgO2'
]);
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
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

function zeroMap(keys) {
  return Object.fromEntries(keys.map(key => [key, 0]));
}

function positiveMap(source, keys) {
  return Object.fromEntries(keys.map(key => [key,
    Math.max(0, finite(source?.[key]))]));
}

function addMap(left, right, keys) {
  return Object.fromEntries(keys.map(key => [key,
    Math.max(0, finite(left?.[key])) +
      Math.max(0, finite(right?.[key]))]));
}

function roundedMap(source, keys, digits = 9) {
  return Object.fromEntries(keys.map(key => [key,
    round(Math.max(0, finite(source?.[key])), digits)]));
}

function truth() {
  return {
    persistentBoundedFloodEventChronicle: true,
    readOnlyFloodplainMaterialObserver: true,
    exchangeEvidenceBound: true,
    archiveBounded: true,
    migrationInventsNoHistory: true,
    resolvedInundationHydraulics: false,
    scientificFloodFrequencyModel: false,
    scientificFloodForecast: false
  };
}

function normalizeEvent(source) {
  if (source?.schema !== FLOOD_EVENT_SCHEMA ||
    typeof source.eventId !== 'string') return null;
  return {
    schema: FLOOD_EVENT_SCHEMA,
    eventId: source.eventId,
    reachId: typeof source.reachId === 'string' ? source.reachId : null,
    startDay: round(finite(source.startDay), 8),
    endDay: source.endDay == null ? null : round(finite(source.endDay), 8),
    durationDays: Math.max(0, round(finite(source.durationDays), 8)),
    observationCount: Math.max(0, Math.round(finite(
      source.observationCount))),
    startExchangeDigest: typeof source.startExchangeDigest === 'string'
      ? source.startExchangeDigest : null,
    latestExchangeDigest: typeof source.latestExchangeDigest === 'string'
      ? source.latestExchangeDigest : null,
    peakWaterKg: Math.max(0, round(finite(source.peakWaterKg), 6)),
    peakInundatedFraction: clamp(finite(source.peakInundatedFraction)),
    cumulativeInundatedExposureDays: Math.max(0, round(finite(
      source.cumulativeInundatedExposureDays), 9)),
    cumulativeOverbankWaterKg: Math.max(0, round(finite(
      source.cumulativeOverbankWaterKg), 6)),
    cumulativeReturnWaterKg: Math.max(0, round(finite(
      source.cumulativeReturnWaterKg), 6)),
    overbankChemistry: roundedMap(source.overbankChemistry,
      CHEMISTRY),
    overbankSedimentKg: roundedMap(source.overbankSedimentKg,
      GRAINS),
    depositedSedimentKg: roundedMap(source.depositedSedimentKg,
      GRAINS),
    truth: {
      materialObservationOnly: true,
      resolvedInundationHydraulics: false
    }
  };
}

export function emptyFloodEventHistoryState(options = {}) {
  return {
    schema: FLOOD_EVENT_HISTORY_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    awaitingDryBoundary: false,
    observedDays: 0,
    currentEvent: null,
    recentEvents: [],
    completedEventCount: 0,
    evictedEventCount: 0,
    totalCompletedDurationDays: 0,
    recurrenceIntervalCount: 0,
    totalRecurrenceIntervalDays: 0,
    lastCompletedEndDay: null,
    historicalPeakWaterKg: 0,
    historicalPeakInundatedFraction: 0,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodEventHistoryState(source, options = {}) {
  const state = emptyFloodEventHistoryState(options);
  if (source?.schema !== FLOOD_EVENT_HISTORY_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.awaitingDryBoundary = source.awaitingDryBoundary === true;
  state.observedDays = Math.max(0, finite(source.observedDays));
  state.currentEvent = normalizeEvent(source.currentEvent);
  state.recentEvents = (Array.isArray(source.recentEvents)
    ? source.recentEvents : []).map(normalizeEvent).filter(Boolean)
    .filter(event => event.endDay != null)
    .sort((a, b) => a.startDay - b.startDay ||
      a.eventId.localeCompare(b.eventId))
    .slice(-FLOOD_EVENT_ARCHIVE_LIMIT);
  state.completedEventCount = Math.max(state.recentEvents.length,
    Math.round(finite(source.completedEventCount)));
  state.evictedEventCount = Math.max(0,
    Math.round(finite(source.evictedEventCount)));
  state.totalCompletedDurationDays = Math.max(0,
    finite(source.totalCompletedDurationDays));
  state.recurrenceIntervalCount = Math.max(0,
    Math.round(finite(source.recurrenceIntervalCount)));
  state.totalRecurrenceIntervalDays = Math.max(0,
    finite(source.totalRecurrenceIntervalDays));
  state.lastCompletedEndDay = source.lastCompletedEndDay == null
    ? null : round(finite(source.lastCompletedEndDay), 8);
  state.historicalPeakWaterKg = Math.max(0,
    finite(source.historicalPeakWaterKg));
  state.historicalPeakInundatedFraction = clamp(
    finite(source.historicalPeakInundatedFraction));
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

export function floodEventHistorySummary(source) {
  const state = normalizeFloodEventHistoryState(source);
  return {
    observedDays: round(state.observedDays, 8),
    awaitingDryBoundary: state.awaitingDryBoundary,
    active: Boolean(state.currentEvent),
    currentEvent: state.currentEvent ? clone(state.currentEvent) : null,
    recentEvents: state.recentEvents.map(clone),
    archivedEventCount: state.recentEvents.length,
    completedEventCount: state.completedEventCount,
    evictedEventCount: state.evictedEventCount,
    meanCompletedDurationDays: state.completedEventCount > 0
      ? round(state.totalCompletedDurationDays /
        state.completedEventCount, 8) : 0,
    meanRecurrenceIntervalDays: state.recurrenceIntervalCount > 0
      ? round(state.totalRecurrenceIntervalDays /
        state.recurrenceIntervalCount, 8) : null,
    historicalPeakWaterKg: round(state.historicalPeakWaterKg, 6),
    historicalPeakInundatedFraction: round(
      state.historicalPeakInundatedFraction, 9),
    archiveLimit: FLOOD_EVENT_ARCHIVE_LIMIT,
    truth: truth()
  };
}

function exchangePayload(exchange) {
  return {
    overbankWaterKg: Math.max(0, finite(exchange?.water?.overbankKg)),
    returnWaterKg: Math.max(0, finite(exchange?.water?.returnKg)),
    overbankChemistry: positiveMap(exchange?.chemistry?.overbank,
      CHEMISTRY),
    overbankSedimentKg: positiveMap(exchange?.sediment?.overbankKg,
      GRAINS),
    depositedSedimentKg: positiveMap(exchange?.sediment?.depositedKg,
      GRAINS)
  };
}

function beginEvent(reachId, startDay, durationDays, material, exchange) {
  const payload = exchangePayload(exchange);
  const eventId = `flood-event:${stableDigest({
    reachId, startDay: round(startDay, 8),
    exchangeDigest: exchange?.digest || null
  }).slice(9)}`;
  return normalizeEvent({
    schema: FLOOD_EVENT_SCHEMA,
    eventId,
    reachId,
    startDay,
    endDay: null,
    durationDays,
    observationCount: 1,
    startExchangeDigest: exchange?.digest || null,
    latestExchangeDigest: exchange?.digest || null,
    peakWaterKg: material.waterKg,
    peakInundatedFraction: material.inundatedFraction,
    cumulativeInundatedExposureDays:
      material.inundatedFraction * durationDays,
    cumulativeOverbankWaterKg: payload.overbankWaterKg,
    cumulativeReturnWaterKg: payload.returnWaterKg,
    overbankChemistry: payload.overbankChemistry,
    overbankSedimentKg: payload.overbankSedimentKg,
    depositedSedimentKg: payload.depositedSedimentKg
  });
}

function continueEvent(source, durationDays, material, exchange) {
  const event = normalizeEvent(source);
  const payload = exchangePayload(exchange);
  event.durationDays += durationDays;
  event.observationCount += 1;
  event.latestExchangeDigest = exchange?.digest ||
    event.latestExchangeDigest;
  event.peakWaterKg = Math.max(event.peakWaterKg, material.waterKg);
  event.peakInundatedFraction = Math.max(
    event.peakInundatedFraction, material.inundatedFraction);
  event.cumulativeInundatedExposureDays +=
    material.inundatedFraction * durationDays;
  event.cumulativeOverbankWaterKg += payload.overbankWaterKg;
  event.cumulativeReturnWaterKg += payload.returnWaterKg;
  event.overbankChemistry = addMap(event.overbankChemistry,
    payload.overbankChemistry, CHEMISTRY);
  event.overbankSedimentKg = addMap(event.overbankSedimentKg,
    payload.overbankSedimentKg, GRAINS);
  event.depositedSedimentKg = addMap(event.depositedSedimentKg,
    payload.depositedSedimentKg, GRAINS);
  return normalizeEvent(event);
}

function compactEvent(event) {
  if (!event) return null;
  return {
    eventId: event.eventId,
    startDay: event.startDay,
    endDay: event.endDay,
    durationDays: event.durationDays,
    observationCount: event.observationCount,
    peakWaterKg: event.peakWaterKg,
    peakInundatedFraction: event.peakInundatedFraction,
    cumulativeInundatedExposureDays:
      event.cumulativeInundatedExposureDays,
    cumulativeOverbankWaterKg: event.cumulativeOverbankWaterKg,
    cumulativeReturnWaterKg: event.cumulativeReturnWaterKg,
    overbankChemistry: clone(event.overbankChemistry),
    overbankSedimentKg: clone(event.overbankSedimentKg),
    depositedSedimentKg: clone(event.depositedSedimentKg),
    startExchangeDigest: event.startExchangeDigest,
    latestExchangeDigest: event.latestExchangeDigest
  };
}

export function advanceFloodEventHistory(source, floodplainSource,
  exchangeReceipt, dtDays, context = {}) {
  const durationDays = finite(dtDays);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Flood event history step must be greater than zero and no longer than one day');
  }
  if (exchangeReceipt?.schema !== FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA) {
    throw new TypeError('Flood event history requires the current floodplain exchange receipt');
  }
  const state = normalizeFloodEventHistoryState(source);
  const floodplain = normalizeFloodplainState(floodplainSource);
  const material = floodplainTotals(floodplain);
  const materialBeforeDigest = stableDigest(floodplainSource ?? null);
  const wet = material.waterKg > 1e-6 ||
    material.inundatedFraction > 1e-9;
  const startDay = round(finite(context.startDay), 8);
  const endDay = round(startDay + durationDays, 8);
  const reachId = String(context.reachId || exchangeReceipt.reachId || '');
  const transitionId = String(context.transitionId ||
    `flood-event-transition:${stableDigest({
      reachId, startDay, durationDays,
      exchangeDigest: exchangeReceipt.digest
    }).slice(9)}`);
  const before = floodEventHistorySummary(state);

  if (state.migrationCheckpoint) {
    state.migrationCheckpoint = false;
    state.awaitingDryBoundary = wet;
    const receipt = {
      schema: FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA,
      transitionId,
      reachId,
      status: 'initialized-after-migration-no-history',
      startDay,
      endDay,
      durationDays: round(durationDays, 8),
      floodplainStateSchema: FLOODPLAIN_STATE_SCHEMA,
      floodplainExchangeDigest: exchangeReceipt.digest,
      observation: {
        wet, waterKg: round(material.waterKg, 6),
        inundatedFraction: round(material.inundatedFraction, 9),
        materialBeforeDigest,
        materialAfterDigest: stableDigest(floodplainSource ?? null)
      },
      event: { before: null, after: null, completed: null },
      history: {
        observedDaysBefore: 0, observedDaysAfter: 0,
        completedEventCountBefore: 0,
        completedEventCountAfter: 0,
        archiveCountAfter: 0,
        archiveLimit: FLOOD_EVENT_ARCHIVE_LIMIT,
        awaitingDryBoundaryAfter: state.awaitingDryBoundary
      },
      truth: {
        ...truth(), floodplainMaterialMutated: false,
        historicalEventsInvented: false,
        lifecycleTransitionValid: true
      }
    };
    receipt.digest = stableDigest(receipt);
    state.lastTransitionReceipt = clone(receipt);
    return { state: normalizeFloodEventHistoryState(state),
      receipt: clone(receipt) };
  }

  state.observedDays += durationDays;
  let status = 'dry-between-events';
  let completed = null;
  if (state.awaitingDryBoundary) {
    status = wet ? 'migration-wet-boundary-awaiting-dry'
      : 'migration-dry-boundary-established';
    if (!wet) state.awaitingDryBoundary = false;
  } else if (!state.currentEvent && wet) {
    state.currentEvent = beginEvent(reachId, startDay, durationDays,
      material, exchangeReceipt);
    status = 'flood-event-started';
    if (state.lastCompletedEndDay != null) {
      const interval = Math.max(0, startDay - state.lastCompletedEndDay);
      state.recurrenceIntervalCount += 1;
      state.totalRecurrenceIntervalDays += interval;
    }
  } else if (state.currentEvent && wet) {
    state.currentEvent = continueEvent(state.currentEvent, durationDays,
      material, exchangeReceipt);
    status = 'flood-event-continued';
  } else if (state.currentEvent && !wet) {
    completed = normalizeEvent({ ...state.currentEvent, endDay });
    state.currentEvent = null;
    state.recentEvents.push(completed);
    state.completedEventCount += 1;
    state.totalCompletedDurationDays += completed.durationDays;
    state.lastCompletedEndDay = endDay;
    state.historicalPeakWaterKg = Math.max(
      state.historicalPeakWaterKg, completed.peakWaterKg);
    state.historicalPeakInundatedFraction = Math.max(
      state.historicalPeakInundatedFraction,
      completed.peakInundatedFraction);
    if (state.recentEvents.length > FLOOD_EVENT_ARCHIVE_LIMIT) {
      const removeCount = state.recentEvents.length -
        FLOOD_EVENT_ARCHIVE_LIMIT;
      state.recentEvents.splice(0, removeCount);
      state.evictedEventCount += removeCount;
    }
    status = 'flood-event-completed';
  }

  const after = floodEventHistorySummary(state);
  const materialAfterDigest = stableDigest(floodplainSource ?? null);
  const receipt = {
    schema: FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA,
    transitionId,
    reachId,
    status,
    startDay,
    endDay,
    durationDays: round(durationDays, 8),
    floodplainStateSchema: FLOODPLAIN_STATE_SCHEMA,
    floodplainExchangeDigest: exchangeReceipt.digest,
    observation: {
      wet,
      waterKg: round(material.waterKg, 6),
      inundatedFraction: round(material.inundatedFraction, 9),
      ...exchangePayload(exchangeReceipt),
      materialBeforeDigest,
      materialAfterDigest
    },
    event: {
      before: compactEvent(before.currentEvent),
      after: compactEvent(after.currentEvent),
      completed: compactEvent(completed)
    },
    history: {
      observedDaysBefore: before.observedDays,
      observedDaysAfter: after.observedDays,
      completedEventCountBefore: before.completedEventCount,
      completedEventCountAfter: after.completedEventCount,
      archiveCountAfter: after.archivedEventCount,
      evictedEventCountAfter: after.evictedEventCount,
      archiveLimit: FLOOD_EVENT_ARCHIVE_LIMIT,
      meanCompletedDurationDays: after.meanCompletedDurationDays,
      meanRecurrenceIntervalDays: after.meanRecurrenceIntervalDays,
      awaitingDryBoundaryAfter: after.awaitingDryBoundary
    },
    truth: {
      ...truth(),
      floodplainMaterialMutated:
        materialBeforeDigest !== materialAfterDigest,
      historicalEventsInvented: false,
      lifecycleTransitionValid: true,
      archiveWithinBound:
        after.archivedEventCount <= FLOOD_EVENT_ARCHIVE_LIMIT
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  return { state: normalizeFloodEventHistoryState(state),
    receipt: clone(receipt) };
}

export function floodEventHistoryDescription() {
  return {
    stateSchema: FLOOD_EVENT_HISTORY_STATE_SCHEMA,
    eventSchema: FLOOD_EVENT_SCHEMA,
    transitionReceiptSchema: FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA,
    archiveLimit: FLOOD_EVENT_ARCHIVE_LIMIT,
    lifecycle: [
      'dry-between-events', 'flood-event-started',
      'flood-event-continued', 'flood-event-completed'
    ],
    eventEvidence: [
      'duration-and-observation-count', 'peak-water-and-inundation',
      'inundated-exposure', 'overbank-and-return-water',
      'overbank-dissolved-chemistry',
      'overbank-and-deposited-grain-payload',
      'exact-floodplain-exchange-digest'
    ],
    materialAuthority: 'read-only-floodplain-state-observer',
    maximumStepDays: 1,
    truth: truth()
  };
}
