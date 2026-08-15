'use strict';

const fs = require('fs');
const path = require('path');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.organ/code-clone-self-directed-growth-v1';
const INTENTION_SCHEMA = 'axm.mirror.code-clone-growth-intention/v1';
const OUTCOME_SCHEMA = 'axm.mirror.code-clone-growth-outcome/v1';
const MEMORY_SCHEMA = 'axm.mirror.code-clone-growth-memory/v1';
const DEFAULT_STATE_DIR = path.resolve(__dirname, '..', 'state', 'code-clone-growth');

const FORBIDDEN_REASONING_KEYS = new Set([
  'chainofthought',
  'hiddenreasoning',
  'privatereasoning',
  'scratchpad'
]);
const TRANSPORT_OPTIONS = Object.freeze({
  maxBytes: 16 * 1024 * 1024,
  maxDepth: 128,
  maxNodes: 200000,
  rejectKey: key => FORBIDDEN_REASONING_KEYS.has(String(key).replace(/[^A-Za-z0-9]/g, '').toLowerCase()),
  rejectedKeyMessage: 'private hidden reasoning is not part of the growth memory trace'
});

const RESULT_STATES = Object.freeze([
  'WORKED',
  'PARTIAL',
  'FAILED',
  'SURPRISED',
  'CONTRADICTORY',
  'ABANDONED',
  'RESTED',
  'UNKNOWN'
]);
const CAPABILITY_STATES = Object.freeze(['WORKED', 'PARTIAL', 'FAILED', 'CONTRADICTORY', 'UNKNOWN']);
const DISPOSITIONS = Object.freeze(['KEEP', 'REVISE', 'REVERT', 'BRANCH', 'HOLD', 'REST', 'UNDECIDED']);
const RESOURCE_KEYS = Object.freeze([
  'wallMilliseconds',
  'cpuCoreMilliseconds',
  'peakMemoryBytes',
  'processCount',
  'outputBytes',
  'moneyMicros',
  'energyMilliwattHours'
]);

function stable(value) {
  return KeySafeJson.stable(value, TRANSPORT_OPTIONS);
}

function digest(value) {
  return KeySafeJson.digest(value, TRANSPORT_OPTIONS);
}

function same(left, right) {
  return KeySafeJson.same(left, right, TRANSPORT_OPTIONS);
}

function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) {
    throw new Error(`${label} fields changed`);
  }
}

function text(value, label, maximum = 20000, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value.trim();
}

function id(value, label, maximum = 240) {
  const normalized = text(value, label, maximum, 2);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(normalized) || normalized.includes('..')) throw new Error(`${label} is invalid`);
  return normalized;
}

function token(value, label) {
  const normalized = text(value, label, 120, 1);
  if (!/^[A-Z][A-Z0-9_]*$/.test(normalized)) throw new Error(`${label} is invalid`);
  return normalized;
}

function sha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} requires sha256`);
  return value;
}

function nullableSha(value, label) {
  return value === null ? null : sha(value, label);
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be canonical UTC ISO-8601`);
  }
  return value;
}

function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

function nullableInteger(value, label) {
  return value === null ? null : integer(value, label);
}

function list(value, label, maximum = 4096) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} is invalid`);
  return value;
}

function unique(values, label, key = value => JSON.stringify(value)) {
  const seen = new Set();
  for (const value of values) {
    const identity = key(value);
    if (seen.has(identity)) throw new Error(`${label} contains duplicates`);
    seen.add(identity);
  }
  return values;
}

function normalizeRef(value, label) {
  exact(value, ['id', 'digest', 'kind'], label);
  return {
    id: id(value.id, `${label}.id`),
    digest: sha(value.digest, `${label}.digest`),
    kind: token(value.kind, `${label}.kind`)
  };
}

function normalizeRefs(value, label, maximum = 4096) {
  return unique(list(value, label, maximum).map((item, index) => normalizeRef(item, `${label}[${index}]`)), label, item => `${item.kind}:${item.id}:${item.digest}`)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizeCharter(value) {
  exact(value, ['charterId', 'digest'], 'charter');
  const charterId = id(value.charterId, 'charter.charterId');
  if (!/^code-clone-sandbox-charter-[a-f0-9]{24}$/.test(charterId)) throw new Error('charter.charterId is invalid');
  return { charterId, digest: sha(value.digest, 'charter.digest') };
}

function normalizeClone(value) {
  exact(value, ['instanceId', 'specialistRole', 'parentMirror', 'disposable'], 'clone');
  if (value.specialistRole !== 'future-code-mirror' || value.parentMirror !== 'axm.machine.mirror/seed-0' || value.disposable !== true) {
    throw new Error('clone identity changed');
  }
  return {
    instanceId: id(value.instanceId, 'clone.instanceId'),
    specialistRole: value.specialistRole,
    parentMirror: value.parentMirror,
    disposable: true
  };
}

function normalizeInterval(value, label) {
  if (value === null) return null;
  exact(value, ['lower', 'upper'], label);
  const lower = integer(value.lower, `${label}.lower`);
  const upper = integer(value.upper, `${label}.upper`);
  if (upper < lower) throw new Error(`${label} interval is inverted`);
  return { lower, upper };
}

function normalizePrediction(value) {
  exact(value, ['sourceRef', ...RESOURCE_KEYS], 'resourcePrediction');
  return {
    sourceRef: value.sourceRef === null ? null : normalizeRef(value.sourceRef, 'resourcePrediction.sourceRef'),
    ...Object.fromEntries(RESOURCE_KEYS.map(key => [key, normalizeInterval(value[key], `resourcePrediction.${key}`)]))
  };
}

function normalizeActual(value) {
  exact(value, ['sourceRefs', ...RESOURCE_KEYS], 'actualResources');
  return {
    sourceRefs: normalizeRefs(value.sourceRefs, 'actualResources.sourceRefs'),
    ...Object.fromEntries(RESOURCE_KEYS.map(key => [key, nullableInteger(value[key], `actualResources.${key}`)]))
  };
}

function normalizeIntention(value) {
  exact(value, [
    'schema',
    'intentionId',
    'intentionDigest',
    'status',
    'charter',
    'clone',
    'origin',
    'lineage',
    'goal',
    'startingState',
    'hypotheses',
    'intendedChange',
    'resourcePrediction',
    'pulseRequestRef',
    'recordedAt',
    'boundary'
  ], 'growth intention');
  if (value.schema !== INTENTION_SCHEMA || ![null, 'EXPERIMENTAL'].includes(value.status)) throw new Error('growth intention identity changed');
  if (value.intentionId !== null && !/^code-clone-growth-intention-[a-f0-9]{24}$/.test(value.intentionId)) throw new Error('growth intention id is invalid');
  if (value.intentionDigest !== null) sha(value.intentionDigest, 'intentionDigest');

  exact(value.origin, ['selectedBy', 'humanDirectiveSource'], 'origin');
  if (value.origin.selectedBy !== 'CLONE_SELF' || value.origin.humanDirectiveSource !== false) throw new Error('growth goal must originate with the clone');

  exact(value.lineage, ['parentCycleDigests'], 'lineage');
  const parentCycleDigests = unique(list(value.lineage.parentCycleDigests, 'lineage.parentCycleDigests', 4096).map((item, index) => sha(item, `lineage.parentCycleDigests[${index}]`)), 'lineage.parentCycleDigests').sort();

  exact(value.goal, ['statement', 'reason', 'expectedObservation'], 'goal');
  exact(value.startingState, ['workshopDigest', 'mirrorDigest', 'capabilityMapRef', 'observationRefs'], 'startingState');
  exact(value.intendedChange, ['summary', 'changeKinds', 'targetRefs', 'recovery'], 'intendedChange');
  exact(value.intendedChange.recovery, ['state', 'statement'], 'intendedChange.recovery');
  if (!['DECLARED', 'UNKNOWN'].includes(value.intendedChange.recovery.state)) throw new Error('intendedChange.recovery.state is invalid');

  const hypotheses = unique(list(value.hypotheses, 'hypotheses').map((item, index) => {
    exact(item, ['hypothesisId', 'statement'], `hypotheses[${index}]`);
    return { hypothesisId: id(item.hypothesisId, `hypotheses[${index}].hypothesisId`), statement: text(item.statement, `hypotheses[${index}].statement`) };
  }), 'hypotheses', item => item.hypothesisId).sort((left, right) => left.hypothesisId.localeCompare(right.hypothesisId));

  const changeKinds = unique(list(value.intendedChange.changeKinds, 'intendedChange.changeKinds').map((item, index) => token(item, `intendedChange.changeKinds[${index}]`)), 'intendedChange.changeKinds').sort();
  const targetRefs = normalizeRefs(value.intendedChange.targetRefs, 'intendedChange.targetRefs');

  return stable({
    schema: INTENTION_SCHEMA,
    intentionId: value.intentionId,
    intentionDigest: value.intentionDigest,
    status: 'EXPERIMENTAL',
    charter: normalizeCharter(value.charter),
    clone: normalizeClone(value.clone),
    origin: { selectedBy: 'CLONE_SELF', humanDirectiveSource: false },
    lineage: { parentCycleDigests },
    goal: {
      statement: text(value.goal.statement, 'goal.statement'),
      reason: text(value.goal.reason, 'goal.reason'),
      expectedObservation: text(value.goal.expectedObservation, 'goal.expectedObservation')
    },
    startingState: {
      workshopDigest: sha(value.startingState.workshopDigest, 'startingState.workshopDigest'),
      mirrorDigest: sha(value.startingState.mirrorDigest, 'startingState.mirrorDigest'),
      capabilityMapRef: value.startingState.capabilityMapRef === null ? null : normalizeRef(value.startingState.capabilityMapRef, 'startingState.capabilityMapRef'),
      observationRefs: normalizeRefs(value.startingState.observationRefs, 'startingState.observationRefs')
    },
    hypotheses,
    intendedChange: {
      summary: text(value.intendedChange.summary, 'intendedChange.summary'),
      changeKinds,
      targetRefs,
      recovery: {
        state: value.intendedChange.recovery.state,
        statement: text(value.intendedChange.recovery.statement, 'intendedChange.recovery.statement')
      }
    },
    resourcePrediction: normalizePrediction(value.resourcePrediction),
    pulseRequestRef: value.pulseRequestRef === null ? null : normalizeRef(value.pulseRequestRef, 'pulseRequestRef'),
    recordedAt: timestamp(value.recordedAt, 'recordedAt'),
    boundary: text(value.boundary, 'boundary')
  });
}

function sealIntention(value) {
  const normalized = normalizeIntention(stable(value));
  const basis = stable({ ...normalized, intentionId: null, intentionDigest: null });
  const intentionDigest = digest(basis);
  return stable({
    ...basis,
    intentionId: `code-clone-growth-intention-${intentionDigest.slice(0, 24)}`,
    intentionDigest
  });
}

function verifyIntention(value) {
  const normalized = normalizeIntention(stable(value));
  const expected = sealIntention({ ...normalized, intentionId: null, intentionDigest: null });
  if (!same(normalized, expected)) throw new Error('growth intention content address changed');
  return true;
}

function normalizeOutcome(value) {
  exact(value, [
    'schema',
    'outcomeId',
    'outcomeDigest',
    'status',
    'intention',
    'recordedAt',
    'resultState',
    'endingState',
    'observations',
    'capabilityObservations',
    'frictionSignals',
    'actualResources',
    'verificationRefs',
    'reflection',
    'boundary'
  ], 'growth outcome');
  if (value.schema !== OUTCOME_SCHEMA || ![null, 'EXPERIMENTAL'].includes(value.status)) throw new Error('growth outcome identity changed');
  if (value.outcomeId !== null && !/^code-clone-growth-outcome-[a-f0-9]{24}$/.test(value.outcomeId)) throw new Error('growth outcome id is invalid');
  if (value.outcomeDigest !== null) sha(value.outcomeDigest, 'outcomeDigest');
  exact(value.intention, ['intentionId', 'intentionDigest'], 'outcome intention');
  if (!/^code-clone-growth-intention-[a-f0-9]{24}$/.test(value.intention.intentionId)) throw new Error('outcome intention id is invalid');
  if (!RESULT_STATES.includes(value.resultState)) throw new Error('resultState is invalid');
  exact(value.endingState, ['workshopDigest', 'mirrorDigest', 'changeSetDigest'], 'endingState');

  const observations = unique(list(value.observations, 'observations').map((item, index) => {
    exact(item, ['observationId', 'kind', 'statement', 'evidenceRefs'], `observations[${index}]`);
    return {
      observationId: id(item.observationId, `observations[${index}].observationId`),
      kind: token(item.kind, `observations[${index}].kind`),
      statement: text(item.statement, `observations[${index}].statement`),
      evidenceRefs: normalizeRefs(item.evidenceRefs, `observations[${index}].evidenceRefs`)
    };
  }), 'observations', item => item.observationId).sort((left, right) => left.observationId.localeCompare(right.observationId));

  const capabilityObservations = list(value.capabilityObservations, 'capabilityObservations').map((item, index) => {
    exact(item, ['capabilityId', 'state', 'statement', 'evidenceRefs'], `capabilityObservations[${index}]`);
    if (!CAPABILITY_STATES.includes(item.state)) throw new Error(`capabilityObservations[${index}].state is invalid`);
    return {
      capabilityId: id(item.capabilityId, `capabilityObservations[${index}].capabilityId`),
      state: item.state,
      statement: text(item.statement, `capabilityObservations[${index}].statement`),
      evidenceRefs: normalizeRefs(item.evidenceRefs, `capabilityObservations[${index}].evidenceRefs`)
    };
  }).sort((left, right) => left.capabilityId.localeCompare(right.capabilityId) || left.state.localeCompare(right.state) || left.statement.localeCompare(right.statement));

  const frictionSignals = unique(list(value.frictionSignals, 'frictionSignals').map((item, index) => {
    exact(item, ['frictionId', 'statement', 'evidenceRefs'], `frictionSignals[${index}]`);
    return {
      frictionId: id(item.frictionId, `frictionSignals[${index}].frictionId`),
      statement: text(item.statement, `frictionSignals[${index}].statement`),
      evidenceRefs: normalizeRefs(item.evidenceRefs, `frictionSignals[${index}].evidenceRefs`)
    };
  }), 'frictionSignals', item => item.frictionId).sort((left, right) => left.frictionId.localeCompare(right.frictionId));

  exact(value.reflection, ['whatChanged', 'whatLearned', 'assumptionsThatChanged', 'newQuestions', 'nextDisposition', 'nextGoalSeeds'], 'reflection');
  if (!DISPOSITIONS.includes(value.reflection.nextDisposition)) throw new Error('reflection.nextDisposition is invalid');
  const strings = (items, label) => unique(list(items, label).map((item, index) => text(item, `${label}[${index}]`)), label).sort();

  return stable({
    schema: OUTCOME_SCHEMA,
    outcomeId: value.outcomeId,
    outcomeDigest: value.outcomeDigest,
    status: 'EXPERIMENTAL',
    intention: {
      intentionId: value.intention.intentionId,
      intentionDigest: sha(value.intention.intentionDigest, 'outcome intention digest')
    },
    recordedAt: timestamp(value.recordedAt, 'recordedAt'),
    resultState: value.resultState,
    endingState: {
      workshopDigest: sha(value.endingState.workshopDigest, 'endingState.workshopDigest'),
      mirrorDigest: sha(value.endingState.mirrorDigest, 'endingState.mirrorDigest'),
      changeSetDigest: nullableSha(value.endingState.changeSetDigest, 'endingState.changeSetDigest')
    },
    observations,
    capabilityObservations,
    frictionSignals,
    actualResources: normalizeActual(value.actualResources),
    verificationRefs: normalizeRefs(value.verificationRefs, 'verificationRefs'),
    reflection: {
      whatChanged: text(value.reflection.whatChanged, 'reflection.whatChanged'),
      whatLearned: text(value.reflection.whatLearned, 'reflection.whatLearned'),
      assumptionsThatChanged: strings(value.reflection.assumptionsThatChanged, 'reflection.assumptionsThatChanged'),
      newQuestions: strings(value.reflection.newQuestions, 'reflection.newQuestions'),
      nextDisposition: value.reflection.nextDisposition,
      nextGoalSeeds: strings(value.reflection.nextGoalSeeds, 'reflection.nextGoalSeeds')
    },
    boundary: text(value.boundary, 'boundary')
  });
}

function sealOutcome(value, intention) {
  verifyIntention(intention);
  const normalized = normalizeOutcome(stable(value));
  if (normalized.intention.intentionId !== intention.intentionId || normalized.intention.intentionDigest !== intention.intentionDigest) {
    throw new Error('growth outcome is bound to a different intention');
  }
  const basis = stable({ ...normalized, outcomeId: null, outcomeDigest: null });
  const outcomeDigest = digest(basis);
  return stable({
    ...basis,
    outcomeId: `code-clone-growth-outcome-${outcomeDigest.slice(0, 24)}`,
    outcomeDigest
  });
}

function verifyOutcome(value, intention) {
  const normalized = normalizeOutcome(stable(value));
  const expected = sealOutcome({ ...normalized, outcomeId: null, outcomeDigest: null }, intention);
  if (!same(normalized, expected)) throw new Error('growth outcome content address changed');
  return true;
}

function compareResource(interval, actual) {
  if (interval === null || actual === null) return 'UNKNOWN';
  if (actual < interval.lower) return 'UNDER_PREDICTION';
  if (actual > interval.upper) return 'OVER_PREDICTION';
  return 'WITHIN_PREDICTION';
}

function resourceComparison(intention, outcome) {
  return stable(Object.fromEntries(RESOURCE_KEYS.map(key => [
    key,
    compareResource(intention.resourcePrediction[key], outcome ? outcome.actualResources[key] : null)
  ])));
}

function capabilityBeliefState(counts) {
  if (counts.CONTRADICTORY > 0) return 'CONTRADICTORY';
  if ((counts.WORKED > 0 || counts.PARTIAL > 0) && counts.FAILED > 0) return 'VARIABLE';
  if (counts.WORKED > 1) return 'REPEATED_OBSERVED';
  if (counts.WORKED === 1) return 'OBSERVED_ONCE';
  if (counts.PARTIAL > 0) return 'PARTIAL_OBSERVED';
  if (counts.FAILED > 0) return 'NOT_OBSERVED_WORKING';
  return 'UNKNOWN';
}

function buildMemory(intentions, outcomes) {
  const safeIntentions = stable(intentions);
  const safeOutcomes = stable(outcomes);
  const normalizedIntentions = list(safeIntentions, 'intentions', 100000).map(value => {
    verifyIntention(value);
    return stable(value);
  });
  const normalizedOutcomes = list(safeOutcomes, 'outcomes', 100000).map(value => stable(value));
  if (!normalizedIntentions.length) throw new Error('growth memory requires at least one intention');
  unique(normalizedIntentions, 'intentions', item => item.intentionId);
  unique(normalizedOutcomes, 'outcomes', item => item.outcomeId);

  const intentionById = new Map(normalizedIntentions.map(item => [item.intentionId, item]));
  const outcomeByIntention = new Map();
  for (const outcome of normalizedOutcomes) {
    const intention = intentionById.get(outcome.intention.intentionId);
    if (!intention) throw new Error('growth outcome intention is absent from memory input');
    verifyOutcome(outcome, intention);
    if (outcomeByIntention.has(intention.intentionId)) throw new Error('growth intention has multiple outcomes');
    outcomeByIntention.set(intention.intentionId, outcome);
  }

  const first = normalizedIntentions[0];
  for (const intention of normalizedIntentions) {
    if (!same(intention.clone, first.clone) || !same(intention.charter, first.charter)) throw new Error('growth memory mixes clone or charter identity');
  }

  const cycles = normalizedIntentions
    .slice()
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.intentionId.localeCompare(right.intentionId))
    .map(intention => {
      const outcome = outcomeByIntention.get(intention.intentionId) || null;
      const cycleDigest = digest({ intentionDigest: intention.intentionDigest, outcomeDigest: outcome ? outcome.outcomeDigest : null });
      return stable({
        cycleDigest,
        intentionId: intention.intentionId,
        intentionDigest: intention.intentionDigest,
        outcomeId: outcome ? outcome.outcomeId : null,
        outcomeDigest: outcome ? outcome.outcomeDigest : null,
        parentCycleDigests: intention.lineage.parentCycleDigests,
        goal: intention.goal,
        startedAt: intention.recordedAt,
        endedAt: outcome ? outcome.recordedAt : null,
        resultState: outcome ? outcome.resultState : 'OPEN',
        startingWorkshopDigest: intention.startingState.workshopDigest,
        endingWorkshopDigest: outcome ? outcome.endingState.workshopDigest : null,
        resourceComparison: resourceComparison(intention, outcome),
        nextDisposition: outcome ? outcome.reflection.nextDisposition : null
      });
    });

  const cycleDigests = new Set(cycles.map(item => item.cycleDigest));
  const referencedParents = new Set(cycles.flatMap(item => item.parentCycleDigests).filter(item => cycleDigests.has(item)));
  const missingParentDigests = unique(cycles.flatMap(item => item.parentCycleDigests).filter(item => !cycleDigests.has(item)), 'missingParentDigests').sort();

  const capabilityMap = new Map();
  const frictionMap = new Map();
  const openQuestions = new Set();
  const nextGoalSeeds = new Set();
  const resourceStates = Object.fromEntries(RESOURCE_KEYS.map(key => [key, {
    UNDER_PREDICTION: 0,
    WITHIN_PREDICTION: 0,
    OVER_PREDICTION: 0,
    UNKNOWN: 0
  }]));

  for (const cycle of cycles) {
    for (const key of RESOURCE_KEYS) resourceStates[key][cycle.resourceComparison[key]] += 1;
    const outcome = cycle.outcomeId ? outcomeByIntention.get(cycle.intentionId) : null;
    if (!outcome) continue;
    for (const observation of outcome.capabilityObservations) {
      if (!capabilityMap.has(observation.capabilityId)) {
        capabilityMap.set(observation.capabilityId, {
          capabilityId: observation.capabilityId,
          counts: Object.fromEntries(CAPABILITY_STATES.map(state => [state, 0])),
          lastCycleDigest: cycle.cycleDigest,
          evidenceRefs: []
        });
      }
      const entry = capabilityMap.get(observation.capabilityId);
      entry.counts[observation.state] += 1;
      entry.lastCycleDigest = cycle.cycleDigest;
      entry.evidenceRefs.push(...observation.evidenceRefs);
    }
    for (const friction of outcome.frictionSignals) {
      if (!frictionMap.has(friction.frictionId)) {
        frictionMap.set(friction.frictionId, {
          frictionId: friction.frictionId,
          observations: 0,
          lastStatement: friction.statement,
          lastCycleDigest: cycle.cycleDigest,
          evidenceRefs: []
        });
      }
      const entry = frictionMap.get(friction.frictionId);
      entry.observations += 1;
      entry.lastStatement = friction.statement;
      entry.lastCycleDigest = cycle.cycleDigest;
      entry.evidenceRefs.push(...friction.evidenceRefs);
    }
    outcome.reflection.newQuestions.forEach(item => openQuestions.add(item));
    outcome.reflection.nextGoalSeeds.forEach(item => nextGoalSeeds.add(item));
  }

  const dedupeRefs = refs => Array.from(new Map(
    refs.map(item => {
      const normalized = stable(item);
      return [`${normalized.kind}:${normalized.id}:${normalized.digest}`, normalized];
    })
  ).values()).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const capabilityBeliefs = Array.from(capabilityMap.values()).map(entry => stable({
    capabilityId: entry.capabilityId,
    state: capabilityBeliefState(entry.counts),
    counts: entry.counts,
    lastCycleDigest: entry.lastCycleDigest,
    evidenceRefs: dedupeRefs(entry.evidenceRefs)
  })).sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  const frictions = Array.from(frictionMap.values()).map(entry => stable({
    ...entry,
    evidenceRefs: dedupeRefs(entry.evidenceRefs)
  })).sort((left, right) => left.frictionId.localeCompare(right.frictionId));

  const basis = stable({
    schema: MEMORY_SCHEMA,
    memoryId: null,
    memoryDigest: null,
    status: 'EXPERIMENTAL',
    organ: {
      id: ORGAN_ID,
      learnedWeights: false,
      goalSelection: false,
      actionSelection: false,
      rewardScore: false
    },
    charter: first.charter,
    clone: first.clone,
    source: {
      intentionRefs: normalizedIntentions.map(item => ({ id: item.intentionId, digest: item.intentionDigest })).sort((left, right) => left.id.localeCompare(right.id)),
      outcomeRefs: normalizedOutcomes.map(item => ({ id: item.outcomeId, digest: item.outcomeDigest })).sort((left, right) => left.id.localeCompare(right.id)),
      intentions: normalizedIntentions.length,
      completedOutcomes: normalizedOutcomes.length,
      openIntentions: normalizedIntentions.length - normalizedOutcomes.length
    },
    cycles,
    lineage: {
      roots: cycles.filter(item => item.parentCycleDigests.length === 0).map(item => item.cycleDigest).sort(),
      heads: cycles.filter(item => !referencedParents.has(item.cycleDigest)).map(item => item.cycleDigest).sort(),
      missingParentDigests
    },
    selfModel: {
      capabilityBeliefs,
      frictions,
      openQuestions: Array.from(openQuestions).sort(),
      nextGoalSeeds: Array.from(nextGoalSeeds).sort(),
      nextGoalRanking: null
    },
    resourceLearning: {
      comparisons: cycles.map(item => ({ cycleDigest: item.cycleDigest, metrics: item.resourceComparison })),
      metricStates: resourceStates,
      score: null
    },
    boundary: 'This EXPERIMENTAL organ preserves and reconstructs self-directed growth experience. It does not choose, rank, approve, reject, execute, or reward goals or actions. Its questions and next-goal seeds are memory for the clone executive, not commands.'
  });
  const memoryDigest = digest(basis);
  return stable({
    ...basis,
    memoryId: `code-clone-growth-memory-${memoryDigest.slice(0, 24)}`,
    memoryDigest
  });
}

function verifyMemory(memory, intentions, outcomes) {
  const safeMemory = stable(memory);
  exact(safeMemory, ['schema', 'memoryId', 'memoryDigest', 'status', 'organ', 'charter', 'clone', 'source', 'cycles', 'lineage', 'selfModel', 'resourceLearning', 'boundary'], 'growth memory');
  if (safeMemory.schema !== MEMORY_SCHEMA || safeMemory.status !== 'EXPERIMENTAL') throw new Error('growth memory identity changed');
  const expected = buildMemory(intentions, outcomes);
  if (!same(safeMemory, expected)) throw new Error('growth memory does not reconstruct from its source cycles');
  return true;
}

function stateDirectory(value = DEFAULT_STATE_DIR) {
  const resolved = path.resolve(value);
  const stat = fs.existsSync(resolved) ? fs.lstatSync(resolved) : null;
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error('growth state root must be a real directory');
  return resolved;
}

function commitRecord(root, collection, recordId, fileName, record, verify) {
  const collectionDir = path.join(root, collection);
  fs.mkdirSync(collectionDir, { recursive: true });
  const recordDir = path.join(collectionDir, recordId);
  if (fs.existsSync(recordDir)) {
    const names = fs.readdirSync(recordDir).sort();
    if (!same(names, [fileName])) throw new Error('existing growth record shape changed');
    const existing = JSON.parse(fs.readFileSync(path.join(recordDir, fileName), 'utf8'));
    verify(existing);
    if (!same(existing, record)) throw new Error('growth record content-address collision');
    return { record: existing, recordDir, reused: true };
  }
  const stageDir = path.join(collectionDir, `.stage-${recordId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error('growth record staging directory already exists');
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, fileName), JSON.stringify(stable(record), null, 2) + '\n', { flag: 'wx' });
  verify(record);
  const committed = ImmutableBatchStore.commitDirectory(stageDir, recordDir);
  return { record, recordDir, reused: committed.reused };
}

function readCollection(root, collection, fileName, verify) {
  const collectionDir = path.join(root, collection);
  if (!fs.existsSync(collectionDir)) return [];
  const stat = fs.lstatSync(collectionDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('growth record collection must be a real directory');
  return fs.readdirSync(collectionDir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => {
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('growth record entry must be a real directory');
      const recordPath = path.join(collectionDir, entry.name, fileName);
      const names = fs.readdirSync(path.join(collectionDir, entry.name)).sort();
      if (!same(names, [fileName])) throw new Error('growth record directory shape changed');
      const fileStat = fs.lstatSync(recordPath);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error('growth record must be a real file');
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
      verify(record);
      return record;
    });
}

function beginCycle(draft, options = {}) {
  const intention = sealIntention(draft);
  verifyIntention(intention);
  const root = stateDirectory(options.stateDir);
  return commitRecord(root, 'intentions', intention.intentionId, 'intention.json', intention, verifyIntention);
}

function loadIntentions(options = {}) {
  return readCollection(stateDirectory(options.stateDir), 'intentions', 'intention.json', verifyIntention);
}

function loadOutcomes(intentions, options = {}) {
  const byId = new Map(intentions.map(item => [item.intentionId, item]));
  return readCollection(stateDirectory(options.stateDir), 'outcomes', 'outcome.json', outcome => {
    const intention = byId.get(outcome.intention.intentionId);
    if (!intention) throw new Error('persisted outcome intention is absent');
    verifyOutcome(outcome, intention);
  });
}

function completeCycle(draft, options = {}) {
  const root = stateDirectory(options.stateDir);
  const intentions = loadIntentions({ stateDir: root });
  const intention = intentions.find(item => item.intentionId === draft.intention.intentionId);
  if (!intention) throw new Error('growth intention is absent');
  const existing = loadOutcomes(intentions, { stateDir: root });
  if (existing.some(item => item.intention.intentionId === intention.intentionId)) throw new Error('growth intention already has an outcome');
  const outcome = sealOutcome(draft, intention);
  verifyOutcome(outcome, intention);
  return commitRecord(root, 'outcomes', outcome.outcomeId, 'outcome.json', outcome, candidate => verifyOutcome(candidate, intention));
}

function reconstruct(options = {}) {
  const root = stateDirectory(options.stateDir);
  const intentions = loadIntentions({ stateDir: root });
  const outcomes = loadOutcomes(intentions, { stateDir: root });
  const memory = buildMemory(intentions, outcomes);
  verifyMemory(memory, intentions, outcomes);
  if (options.write === false) return { memory, recordDir: null, reused: false, written: false };
  const committed = commitRecord(root, 'memories', memory.memoryId, 'memory.json', memory, candidate => verifyMemory(candidate, intentions, outcomes));
  return { memory: committed.record, recordDir: committed.recordDir, reused: committed.reused, written: true };
}

module.exports = {
  ORGAN_ID,
  INTENTION_SCHEMA,
  OUTCOME_SCHEMA,
  MEMORY_SCHEMA,
  DEFAULT_STATE_DIR,
  RESOURCE_KEYS,
  RESULT_STATES,
  CAPABILITY_STATES,
  DISPOSITIONS,
  stable,
  digest,
  sealIntention,
  verifyIntention,
  sealOutcome,
  verifyOutcome,
  resourceComparison,
  buildMemory,
  verifyMemory,
  beginCycle,
  completeCycle,
  loadIntentions,
  loadOutcomes,
  reconstruct
};
