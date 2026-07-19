import { HYDROLOGY_SCHEMA } from './hydrology-model.mjs';
import { EARTH_SYSTEM_COLUMN_SCHEMA, earthCellIdentity } from './earth-system.mjs';
import { earthCellAreaM2 } from './earth-transport.mjs';

export const BASIN_ROUTING_ENGINE_SCHEMA = 'axm.foundation-planet.basin-routing-engine/v1';
export const BASIN_ROUTING_STEP_SCHEMA = 'axm.foundation-planet.basin-routing-step/v1';
export const BASIN_INLET_RECEIPT_SCHEMA = 'axm.foundation-planet.basin-inlet-receipt/v1';
export const RIVER_REACH_TRANSFER_SCHEMA = 'axm.foundation-planet.river-reach-transfer/v1';
export const OCEAN_MOUTH_RECEIPT_SCHEMA = 'axm.foundation-planet.ocean-mouth-receipt/v1';
export const RIVER_BOUNDARY_RECEIPT_SCHEMA = 'axm.foundation-planet.river-boundary-receipt/v1';

const CLOCK_TOLERANCE_DAYS = 1e-6;
const EARTH_RADIUS_M = 6_371_000;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = value => JSON.parse(JSON.stringify(value));
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function transferId(kind, startDay, sourceId, destinationId, amountKg) {
  return `${kind}:${stableDigest({
    startDay: round(startDay, 8), sourceId, destinationId, amountKg: round(amountKg, 3)
  }).slice('fnv1a32:'.length)}`;
}

function reachLengthM(reach) {
  const from = reach.canonicalFrom;
  const to = reach.canonicalTo;
  const lat1 = finite(from?.lat) * Math.PI / 180;
  const lat2 = finite(to?.lat) * Math.PI / 180;
  const deltaLat = lat2 - lat1;
  const deltaLon = (((finite(to?.lon) - finite(from?.lon) + 540) % 360) - 180) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return Math.max(1, 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))));
}

function reachTravelTimeDays(reach) {
  const discharge = Math.max(.001, finite(reach.currentDischargeM3s, finite(reach.dischargeM3s, .001)));
  const slopeBoost = clamp(finite(reach.slope) * 180, 0, 1.8);
  const velocityMps = clamp(.32 + Math.pow(discharge, .18) * .52 + slopeBoost, .25, 4.5);
  return clamp(reachLengthM(reach) / velocityMps / 86_400, .08, 8);
}

function emptyReachState(reachId, day) {
  return {
    reachId,
    storageKg: 0,
    cumulativeInflowKg: 0,
    cumulativeOutflowKg: 0,
    lastTouchedDay: round(day, 8)
  };
}

function normalizedReachState(source) {
  return {
    reachId: source.reachId,
    storageKg: Math.max(0, finite(source.storageKg)),
    cumulativeInflowKg: Math.max(0, finite(source.cumulativeInflowKg)),
    cumulativeOutflowKg: Math.max(0, finite(source.cumulativeOutflowKg)),
    lastTouchedDay: round(finite(source.lastTouchedDay), 8)
  };
}

function profileStorageKg(profile) {
  let total = 0;
  for (const state of profile.reaches.values()) total += state.storageKg;
  return total;
}

function earthWaterMass(columns) {
  let runoffQueueKg = 0;
  let oceanFreshwaterKg = 0;
  for (const column of columns) {
    const areaM2 = earthCellAreaM2(column);
    runoffQueueKg += Math.max(0, finite(column.routing?.runoffQueueMm)) * areaM2;
    if (column.kind === 'ocean') oceanFreshwaterKg += finite(column.ocean?.freshwaterAnomalyMm) * areaM2;
  }
  return { runoffQueueKg, oceanFreshwaterKg };
}

function addOceanFreshwater(column, amountKg) {
  const areaM2 = earthCellAreaM2(column);
  const referenceWaterMm = Math.max(1, finite(column.ocean.mixedLayerDepthM) * 1000);
  const previousAnomalyMm = finite(column.ocean.freshwaterAnomalyMm);
  const referenceSalinityPsu = finite(column.ocean.salinityPsu) *
    (referenceWaterMm + previousAnomalyMm) / referenceWaterMm;
  column.ocean.freshwaterAnomalyMm = previousAnomalyMm + amountKg / areaM2;
  column.ocean.salinityPsu = clamp(referenceSalinityPsu * referenceWaterMm /
    Math.max(1, referenceWaterMm + column.ocean.freshwaterAnomalyMm), 2, 43);
}

function reachCellId(reach, resolutionDeg) {
  return earthCellIdentity(reach.canonicalFrom.lat, reach.canonicalFrom.lon, { resolutionDeg }).id;
}

function outletRank(reach, resolutionDeg) {
  if (reach.reachesOcean) return 3;
  if (!reach.downstreamReachId) return 2;
  const targetId = earthCellIdentity(reach.canonicalTo.lat, reach.canonicalTo.lon, { resolutionDeg }).id;
  return targetId !== reachCellId(reach, resolutionDeg) ? 1 : 0;
}

function selectInlets(reaches, resolutionDeg) {
  const grouped = new Map();
  for (const reach of reaches) {
    const cellId = reachCellId(reach, resolutionDeg);
    const candidates = grouped.get(cellId) || [];
    candidates.push(reach);
    grouped.set(cellId, candidates);
  }
  const selected = new Map();
  for (const [cellId, candidates] of grouped) {
    candidates.sort((a, b) => outletRank(b, resolutionDeg) - outletRank(a, resolutionDeg) ||
      finite(b.contributingAreaKm2) - finite(a.contributingAreaKm2) || a.id.localeCompare(b.id));
    selected.set(cellId, candidates[0]);
  }
  return selected;
}

function validateColumns(sourceColumns) {
  if (!Array.isArray(sourceColumns) || sourceColumns.length === 0) {
    throw new Error('Basin routing requires at least one Earth-system column');
  }
  const columns = sourceColumns.map(column => {
    if (!column || column.schema !== EARTH_SYSTEM_COLUMN_SCHEMA) {
      throw new Error('Basin routing received an invalid Earth-system column');
    }
    return clone(column);
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(columns.map(column => column.id)).size !== columns.length) {
    throw new Error('Basin routing received duplicate Earth-system columns');
  }
  if (new Set(columns.map(column => column.profileId)).size !== 1) {
    throw new Error('Basin routing cannot mix condition profiles');
  }
  if (new Set(columns.map(column => column.resolutionDeg)).size !== 1) {
    throw new Error('Basin routing cannot mix Earth-cell resolutions');
  }
  return columns;
}

function validateSector(sector) {
  if (sector == null) return [];
  if (sector.schema !== HYDROLOGY_SCHEMA || !Array.isArray(sector.rivers)) {
    throw new Error('Basin routing requires a canonical hydrology sector');
  }
  const reaches = sector.rivers.map(reach => clone(reach)).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(reaches.map(reach => reach.id)).size !== reaches.length) {
    throw new Error('Basin routing received duplicate canonical reach IDs');
  }
  if (reaches.some(reach => !reach.id || !reach.canonicalFrom || !reach.canonicalTo)) {
    throw new Error('Basin routing received an incomplete canonical reach');
  }
  return reaches;
}

function ensureReach(profile, reachId, day, maximumReachStates) {
  let state = profile.reaches.get(reachId);
  if (state) return state;
  if (profile.reaches.size >= maximumReachStates) {
    throw new Error('Basin routing reach-state capacity exceeded; stored water was not discarded');
  }
  state = emptyReachState(reachId, day);
  profile.reaches.set(reachId, state);
  return state;
}

function roundColumnRouting(column) {
  column.routing.runoffQueueMm = round(Math.max(0, column.routing.runoffQueueMm), 15);
  column.routing.cumulativeRoutedRunoffMm = round(Math.max(0, finite(column.routing.cumulativeRoutedRunoffMm)), 15);
  column.routing.cumulativeChannelizedRunoffMm = round(Math.max(0, finite(column.routing.cumulativeChannelizedRunoffMm)), 15);
  column.truth.runoffCanEnterCanonicalRiverReach = true;
}

export class BasinRoutingEngine {
  constructor(options = {}) {
    this.maximumReachStates = Math.max(16, Math.min(65_536, Math.round(finite(options.maximumReachStates, 4096))));
    this.profiles = new Map();
    this.receipts = new Map();
    if (options.state) this.restore(options.state);
  }

  profile(profileId) {
    let profile = this.profiles.get(profileId);
    if (!profile) {
      profile = { profileId, lastDay: null, reaches: new Map() };
      this.profiles.set(profileId, profile);
    }
    return profile;
  }

  advance(sourceColumns, sector, dtDays, options = {}) {
    const durationDays = finite(dtDays);
    if (!(durationDays > 0) || durationDays > 1.000001) {
      throw new Error('Basin routing step must be greater than zero and no longer than one day');
    }
    const columns = validateColumns(sourceColumns);
    const reaches = validateSector(sector);
    const profileId = columns[0].profileId;
    if (options.profileId && options.profileId !== profileId) {
      throw new Error('Basin routing profile does not match its Earth-system columns');
    }
    const current = this.profile(profileId);
    const startDay = Number.isFinite(Number(options.startDay))
      ? Number(options.startDay)
      : current.lastDay ?? Math.max(...columns.map(column => finite(column.lastDay))) - durationDays;
    if (current.lastDay !== null && Math.abs(current.lastDay - startDay) > CLOCK_TOLERANCE_DAYS) {
      throw new Error('Basin routing clock does not match the committed transport clock');
    }
    const endDay = startDay + durationDays;
    const working = {
      profileId,
      lastDay: current.lastDay,
      reaches: new Map([...current.reaches.entries()].map(([id, state]) => [id, normalizedReachState(state)]))
    };
    const initialEarth = earthWaterMass(columns);
    const initialRiverStorageKg = profileStorageKg(working);
    const preRouteStorage = new Map([...working.reaches.entries()].map(([id, state]) => [id, state.storageKg]));
    const reachById = new Map(reaches.map(reach => [reach.id, reach]));
    const selectedInlets = reaches.length ? selectInlets(reaches, columns[0].resolutionDeg) : new Map();
    const inletReceipts = [];
    const captureTimeDays = clamp(finite(options.captureTimeDays, .55), .02, 20);
    const captureFraction = 1 - Math.exp(-durationDays / captureTimeDays);

    for (const column of columns) {
      if (column.kind !== 'land' || finite(column.routing?.runoffQueueMm) <= 0) continue;
      const reach = selectedInlets.get(column.id);
      if (!reach) continue;
      const areaM2 = earthCellAreaM2(column);
      const queuedBeforeKg = column.routing.runoffQueueMm * areaM2;
      const amountKg = queuedBeforeKg * captureFraction;
      if (amountKg <= 1e-9) continue;
      const state = ensureReach(working, reach.id, endDay, this.maximumReachStates);
      column.routing.runoffQueueMm -= amountKg / areaM2;
      column.routing.cumulativeRoutedRunoffMm = finite(column.routing.cumulativeRoutedRunoffMm) + amountKg / areaM2;
      column.routing.cumulativeChannelizedRunoffMm = finite(column.routing.cumulativeChannelizedRunoffMm) + amountKg / areaM2;
      column.routing.lastDownstreamReachId = reach.id;
      state.storageKg += amountKg;
      state.cumulativeInflowKg += amountKg;
      state.lastTouchedDay = round(endDay, 8);
      const id = transferId('basin-inlet', startDay, column.id, reach.id, amountKg);
      inletReceipts.push({
        schema: BASIN_INLET_RECEIPT_SCHEMA,
        transferId: id,
        status: 'accepted',
        reason: 'canonical-main-reach-inside-earth-cell',
        sender: {
          schema: 'axm.foundation-planet.basin-inlet-sender/v1',
          earthCellId: column.id,
          debitedKg: round(amountKg, 3),
          queueBeforeKg: round(queuedBeforeKg, 3),
          queueAfterKg: round(column.routing.runoffQueueMm * areaM2, 3)
        },
        receiver: {
          schema: 'axm.foundation-planet.basin-inlet-receiver/v1',
          reachId: reach.id,
          creditedKg: round(amountKg, 3)
        }
      });
    }

    const routeProposals = [];
    const routeReceipts = [];
    const boundaryReceipts = [];
    const oceanColumns = new Map(columns.filter(column => column.kind === 'ocean').map(column => [column.id, column]));

    for (const [reachId, storedKg] of [...preRouteStorage.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (storedKg <= 1e-9) continue;
      const reach = reachById.get(reachId);
      if (!reach) {
        boundaryReceipts.push({
          schema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
          reachId,
          status: 'retained',
          reason: 'reach-not-in-loaded-sector',
          retainedWaterKg: round(storedKg, 3)
        });
        continue;
      }
      const routedFraction = 1 - Math.exp(-durationDays / reachTravelTimeDays(reach));
      const amountKg = storedKg * routedFraction;
      if (amountKg <= 1e-9) continue;
      if (reach.downstreamReachId && reachById.has(reach.downstreamReachId)) {
        routeProposals.push({ kind: 'reach-to-reach', sourceReachId: reachId, destinationReachId: reach.downstreamReachId, amountKg });
        continue;
      }
      if (reach.reachesOcean) {
        const oceanCellId = earthCellIdentity(reach.canonicalTo.lat, reach.canonicalTo.lon, {
          resolutionDeg: columns[0].resolutionDeg
        }).id;
        if (oceanColumns.has(oceanCellId)) {
          routeProposals.push({ kind: 'ocean-mouth', sourceReachId: reachId, destinationCellId: oceanCellId, amountKg });
        } else {
          boundaryReceipts.push({
            schema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
            reachId,
            downstreamReachId: null,
            oceanCellId,
            status: 'retained',
            reason: 'ocean-mouth-cell-not-loaded',
            retainedWaterKg: round(storedKg, 3)
          });
        }
        continue;
      }
      boundaryReceipts.push({
        schema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
        reachId,
        downstreamReachId: reach.downstreamReachId || null,
        status: 'retained',
        reason: reach.downstreamReachId ? 'downstream-reach-not-loaded' : 'no-canonical-downstream',
        retainedWaterKg: round(storedKg, 3)
      });
    }

    let deliveredToOceanKg = 0;
    let reachToReachKg = 0;
    for (const proposal of routeProposals) {
      const source = ensureReach(working, proposal.sourceReachId, endDay, this.maximumReachStates);
      source.storageKg -= proposal.amountKg;
      source.cumulativeOutflowKg += proposal.amountKg;
      source.lastTouchedDay = round(endDay, 8);
      if (proposal.kind === 'reach-to-reach') {
        const receiver = ensureReach(working, proposal.destinationReachId, endDay, this.maximumReachStates);
        receiver.storageKg += proposal.amountKg;
        receiver.cumulativeInflowKg += proposal.amountKg;
        receiver.lastTouchedDay = round(endDay, 8);
        reachToReachKg += proposal.amountKg;
        const id = transferId('river-reach', startDay, proposal.sourceReachId, proposal.destinationReachId, proposal.amountKg);
        routeReceipts.push({
          schema: RIVER_REACH_TRANSFER_SCHEMA,
          transferId: id,
          status: 'routed',
          sourceReachId: proposal.sourceReachId,
          destinationReachId: proposal.destinationReachId,
          routedWaterKg: round(proposal.amountKg, 3),
          simultaneous: true
        });
      } else {
        const ocean = oceanColumns.get(proposal.destinationCellId);
        addOceanFreshwater(ocean, proposal.amountKg);
        deliveredToOceanKg += proposal.amountKg;
        const id = transferId('ocean-mouth', startDay, proposal.sourceReachId, proposal.destinationCellId, proposal.amountKg);
        routeReceipts.push({
          schema: OCEAN_MOUTH_RECEIPT_SCHEMA,
          transferId: id,
          status: 'delivered',
          sourceReachId: proposal.sourceReachId,
          destinationCellId: proposal.destinationCellId,
          deliveredFreshwaterKg: round(proposal.amountKg, 3),
          simultaneous: true
        });
      }
    }

    for (const column of columns) {
      roundColumnRouting(column);
      if (column.ocean) {
        column.ocean.freshwaterAnomalyMm = round(column.ocean.freshwaterAnomalyMm, 15);
        column.ocean.salinityPsu = round(column.ocean.salinityPsu, 15);
      }
    }
    for (const state of working.reaches.values()) {
      state.storageKg = round(Math.max(0, state.storageKg), 6);
      state.cumulativeInflowKg = round(Math.max(0, state.cumulativeInflowKg), 6);
      state.cumulativeOutflowKg = round(Math.max(0, state.cumulativeOutflowKg), 6);
    }
    working.lastDay = round(endDay, 8);
    const finalEarth = earthWaterMass(columns);
    const finalRiverStorageKg = profileStorageKg(working);
    const waterResidualKg = finalEarth.runoffQueueKg + finalEarth.oceanFreshwaterKg + finalRiverStorageKg -
      initialEarth.runoffQueueKg - initialEarth.oceanFreshwaterKg - initialRiverStorageKg;
    inletReceipts.sort((a, b) => a.sender.earthCellId.localeCompare(b.sender.earthCellId));
    routeReceipts.sort((a, b) => a.transferId.localeCompare(b.transferId));
    boundaryReceipts.sort((a, b) => a.reachId.localeCompare(b.reachId));
    const receipt = {
      schema: BASIN_ROUTING_STEP_SCHEMA,
      profileId,
      startDay: round(startDay, 8),
      endDay: round(endDay, 8),
      durationDays: round(durationDays, 8),
      loadedReachCount: reaches.length,
      persistedReachStateCount: working.reaches.size,
      inletReceipts,
      routeReceipts,
      boundaryReceipts,
      transfers: {
        earthCellToRiverKg: round(inletReceipts.reduce((sum, receipt) => sum + receipt.receiver.creditedKg, 0), 3),
        reachToReachKg: round(reachToReachKg, 3),
        riverToOceanKg: round(deliveredToOceanKg, 3)
      },
      storage: {
        initialRiverKg: round(initialRiverStorageKg, 3),
        finalRiverKg: round(finalRiverStorageKg, 3)
      },
      conservation: {
        waterResidualKg: round(waterResidualKg, 3)
      },
      truth: {
        pairedEarthCellAndReachReceipts: true,
        simultaneousReachRouting: true,
        canonicalReachIds: true,
        oceanDeliveryRequiresLoadedMouthCell: true,
        unresolvedReachWaterRetained: true,
        globalBasinNetwork: false,
        scientificRiverForecast: false
      }
    };
    receipt.digest = stableDigest(receipt);
    this.profiles.set(profileId, working);
    this.receipts.set(profileId, clone(receipt));
    return { columns: columns.map(clone), receipt: clone(receipt) };
  }

  decorateSector(sector, profileId) {
    if (!sector || sector.schema !== HYDROLOGY_SCHEMA) return sector;
    const profile = this.profiles.get(profileId);
    const receipt = this.receipts.get(profileId) || null;
    const routedByReach = new Map();
    for (const route of receipt?.routeReceipts || []) {
      const amountKg = finite(route.routedWaterKg, finite(route.deliveredFreshwaterKg));
      routedByReach.set(route.sourceReachId, amountKg /
        Math.max(1, finite(receipt.durationDays) * 86_400 * 1000));
    }
    const rivers = sector.rivers.map(reach => {
      const state = profile?.reaches.get(reach.id);
      return {
        ...reach,
        channelStorageKg: state?.storageKg || 0,
        cumulativeChannelInflowKg: state?.cumulativeInflowKg || 0,
        cumulativeChannelOutflowKg: state?.cumulativeOutflowKg || 0,
        routedDischargeM3s: routedByReach.get(reach.id) || 0
      };
    });
    const activeStates = rivers.filter(reach => reach.channelStorageKg > 0);
    return {
      ...sector,
      rivers,
      basinRouting: receipt ? clone(receipt) : null,
      summary: {
        ...sector.summary,
        activeChannelReachStates: activeStates.length,
        channelStorageKg: activeStates.reduce((sum, reach) => sum + reach.channelStorageKg, 0),
        riverToOceanKg: finite(receipt?.transfers?.riverToOceanKg),
        riverBoundaryRetentions: receipt?.boundaryReceipts?.length || 0
      },
      truth: {
        ...sector.truth,
        statefulBasinRouting: true,
        oceanMouthReceipts: true,
        unresolvedReachWaterRetained: true
      }
    };
  }

  status(profileId) {
    const profile = this.profiles.get(profileId);
    return {
      schema: BASIN_ROUTING_ENGINE_SCHEMA,
      profileId,
      lastDay: profile?.lastDay ?? null,
      reachStateCount: profile?.reaches.size || 0,
      storedWaterKg: profile ? round(profileStorageKg(profile), 3) : 0,
      receipt: this.receipts.has(profileId) ? clone(this.receipts.get(profileId)) : null
    };
  }

  snapshot() {
    return {
      schema: BASIN_ROUTING_ENGINE_SCHEMA,
      maximumReachStates: this.maximumReachStates,
      profiles: [...this.profiles.values()].sort((a, b) => a.profileId.localeCompare(b.profileId)).map(profile => ({
        profileId: profile.profileId,
        lastDay: profile.lastDay,
        reaches: [...profile.reaches.values()].map(normalizedReachState).sort((a, b) => a.reachId.localeCompare(b.reachId))
      })),
      receipts: [...this.receipts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([profileId, receipt]) => ({
        profileId, receipt: clone(receipt)
      }))
    };
  }

  restore(state) {
    if (!state || state.schema !== BASIN_ROUTING_ENGINE_SCHEMA || !Array.isArray(state.profiles)) return false;
    const profiles = new Map();
    for (const candidate of state.profiles) {
      if (!candidate || typeof candidate.profileId !== 'string' || !Array.isArray(candidate.reaches)) continue;
      const reaches = new Map();
      for (const reach of candidate.reaches.slice(-this.maximumReachStates)) {
        if (!reach || typeof reach.reachId !== 'string') continue;
        reaches.set(reach.reachId, normalizedReachState(reach));
      }
      profiles.set(candidate.profileId, {
        profileId: candidate.profileId,
        lastDay: candidate.lastDay === null ? null : round(finite(candidate.lastDay), 8),
        reaches
      });
    }
    this.profiles = profiles;
    this.receipts = new Map((Array.isArray(state.receipts) ? state.receipts : [])
      .filter(entry => entry && typeof entry.profileId === 'string' && entry.receipt?.schema === BASIN_ROUTING_STEP_SCHEMA)
      .map(entry => [entry.profileId, clone(entry.receipt)]));
    return true;
  }

  descriptor(profileId = null) {
    const profile = profileId ? this.profiles.get(profileId) : null;
    return {
      schema: BASIN_ROUTING_ENGINE_SCHEMA,
      maximumReachStates: this.maximumReachStates,
      activeProfiles: this.profiles.size,
      activeProfileId: profileId,
      activeProfileLastDay: profile?.lastDay ?? null,
      activeProfileReachStates: profile?.reaches.size || 0,
      activeProfileStoredWaterKg: profile ? round(profileStorageKg(profile), 3) : 0,
      deterministic: true,
      persistent: true
    };
  }
}

export function basinRoutingDescription() {
  return {
    engineSchema: BASIN_ROUTING_ENGINE_SCHEMA,
    stepSchema: BASIN_ROUTING_STEP_SCHEMA,
    inletReceiptSchema: BASIN_INLET_RECEIPT_SCHEMA,
    reachTransferSchema: RIVER_REACH_TRANSFER_SCHEMA,
    oceanMouthReceiptSchema: OCEAN_MOUTH_RECEIPT_SCHEMA,
    boundaryReceiptSchema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
    topology: 'loaded canonical hydrology reaches bridged from canonical Earth-system cells',
    processes: ['earth-cell-to-main-reach-capture', 'simultaneous-reach-routing', 'loaded-ocean-mouth-delivery'],
    persistentReachStorage: true,
    unresolvedWaterRetained: true,
    maximumStepDays: 1,
    globalBasinNetwork: false,
    scientificRiverForecast: false
  };
}
