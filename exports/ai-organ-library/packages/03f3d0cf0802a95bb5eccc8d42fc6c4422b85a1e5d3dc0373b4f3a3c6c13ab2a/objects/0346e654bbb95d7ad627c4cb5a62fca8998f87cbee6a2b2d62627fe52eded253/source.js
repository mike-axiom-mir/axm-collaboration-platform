'use strict';

const fs = require('fs');
const path = require('path');
const Outcome = require('../kernel/outcome-learning-cell');
const OutcomeOrgan = require('./outcome-learning-organ');
const Planner = require('./outcome-curriculum-planner-organ');
const Challenger = require('./outcome-method-challenger-organ');
const Watch = require('./outcome-method-prospective-watch-organ');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.outcome-growth-conductor-organ/v1';
const CYCLE_SCHEMA = 'axm.mirror.outcome-growth-conductor-cycle/v1';
const SOURCE_SCHEMA = 'axm.mirror.outcome-growth-conductor-source/v1';
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'outcome-growth-conductor-cycles');
const DEFAULT_OUTCOME_STATE_DIR = Planner.DEFAULT_OUTCOME_STATE_DIR;
const DEFAULT_CURRICULUM_STATE_DIR = Planner.DEFAULT_STATE_DIR;
const DEFAULT_CHALLENGER_STATE_DIR = Challenger.DEFAULT_STATE_DIR;
const DEFAULT_REGISTRATION_STATE_DIR = Watch.DEFAULT_REGISTRATION_STATE_DIR;
const DEFAULT_OBSERVATION_STATE_DIR = Watch.DEFAULT_STATE_DIR;
const MAX_RUNS_PER_FAMILY = 128;
const MAX_OUTCOME_BATCHES = 256;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_SOURCE_BYTES = 256 * 1024 * 1024;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return Outcome.same(left, right); }
function digest(value) { return Outcome.digest(value); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|reasoning.?content/i.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function isIso(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
function validateTrigger(trigger) {
  exactKeys(trigger, ['id', 'digest', 'at', 'kind'], 'outcome growth trigger');
  if (!String(trigger.id || '').trim() || !/^[a-f0-9]{64}$/.test(trigger.digest) || !isIso(trigger.at) || !String(trigger.kind || '').trim()) throw new Error('outcome growth trigger changed');
  return clone(trigger);
}
function refs(items, idKey, digestKey) {
  return items.map(item => ({ [idKey]: item[idKey], [digestKey]: item[digestKey] })).sort((left, right) => left[idKey].localeCompare(right[idKey]));
}
function outcomeRefs(batches) { return refs(batches, 'batchId', 'batchDigest'); }
function curriculumOutcomeRefs(batches) {
  return batches.map(item => ({ batchId: item.batchId, batchDigest: item.batchDigest, createdAt: item.createdAt })).sort((left, right) => left.batchId.localeCompare(right.batchId));
}
function assertUnique(items, idKey, digestKey, label) {
  if (new Set(items.map(item => item[idKey])).size !== items.length || new Set(items.map(item => item[digestKey])).size !== items.length) throw new Error(`${label} contains duplicate identity`);
}
function validateOutcomeBatches(input) {
  if (!Array.isArray(input) || input.length > MAX_OUTCOME_BATCHES) throw new Error('outcome growth Outcome inventory exceeds its bound');
  const rows = input.map(clone).sort((left, right) => left.batchId.localeCompare(right.batchId));
  rows.forEach(OutcomeOrgan.verify);
  assertUnique(rows, 'batchId', 'batchDigest', 'outcome growth Outcome inventory');
  return rows;
}
function validateRows(input, label, verifier) {
  if (!Array.isArray(input) || input.length > MAX_RUNS_PER_FAMILY) throw new Error(`${label} exceeds its run bound`);
  const rows = input.map(row => {
    exactKeys(row, ['batch', 'source'], `${label} row`);
    const copy = clone(row);
    verifier(copy.batch, copy.source);
    return copy;
  }).sort((left, right) => left.batch.batchId.localeCompare(right.batch.batchId));
  assertUnique(rows.map(item => item.batch), 'batchId', 'batchDigest', label);
  return rows;
}
function validateDiscovery(discovery, source) {
  exactKeys(discovery, ['outcomeBatches', 'curriculumRuns', 'challengerRuns', 'registrationRuns', 'observationRuns', 'ignoredStagingEntries'], 'outcome growth discovery');
  for (const key of Object.keys(discovery)) if (!Number.isInteger(discovery[key]) || discovery[key] < 0) throw new Error('outcome growth discovery counts changed');
  const expected = {
    outcomeBatches: source.outcomeBatches.length,
    curriculumRuns: source.curriculumRuns.length,
    challengerRuns: source.challengerRuns.length,
    registrationRuns: source.registrationRuns.length,
    observationRuns: source.observationRuns.length
  };
  for (const [key, value] of Object.entries(expected)) if (discovery[key] !== value) throw new Error(`outcome growth discovery ${key} count changed`);
  return clone(discovery);
}
function normalizeSource(input) {
  rejectHidden(input);
  exactKeys(input, ['schema', 'trigger', 'outcomeBatches', 'curriculumRuns', 'challengerRuns', 'registrationRuns', 'observationRuns', 'discovery'], 'outcome growth source');
  if (input.schema !== SOURCE_SCHEMA) throw new Error('outcome growth source schema changed');
  const source = {
    schema: SOURCE_SCHEMA,
    trigger: validateTrigger(input.trigger),
    outcomeBatches: validateOutcomeBatches(input.outcomeBatches),
    curriculumRuns: validateRows(input.curriculumRuns, 'outcome growth curriculum inventory', (batch, batches) => Planner.verify(batch, batches)),
    challengerRuns: validateRows(input.challengerRuns, 'outcome growth challenger inventory', (batch, rowSource) => Challenger.verify(batch, rowSource)),
    registrationRuns: validateRows(input.registrationRuns, 'outcome growth registration inventory', (batch, rowSource) => Watch.verifyRegistration(batch, rowSource)),
    observationRuns: validateRows(input.observationRuns, 'outcome growth observation inventory', (batch, rowSource) => Watch.verifyObservation(batch, rowSource)),
    discovery: null
  };
  source.discovery = validateDiscovery(input.discovery, source);
  if (Buffer.byteLength(JSON.stringify(source), 'utf8') > MAX_SOURCE_BYTES) throw new Error('outcome growth source exceeds its byte bound');
  return source;
}

function ref(batch) { return batch ? { batchId: batch.batchId, batchDigest: batch.batchDigest } : null; }
function routeRef(row) { return row ? { batch: ref(row.batch), state: row.batch.state } : null; }
function currentCurriculumMatches(source) {
  const current = curriculumOutcomeRefs(source.outcomeBatches);
  return source.curriculumRuns.filter(row => same(row.batch.sourceBatches, current));
}
function currentChallengerMatches(source, curriculum) {
  if (!curriculum) return [];
  const outcomes = outcomeRefs(source.outcomeBatches);
  return source.challengerRuns.filter(row => same(row.batch.source.curriculumBatch, ref(curriculum.batch)) && same(row.batch.source.outcomeBatches, outcomes) && row.batch.selectionPacks.length === 0 && row.batch.confirmationPacks.length === 0);
}
function currentRegistrationMatches(source, challenger) {
  if (!challenger) return [];
  const outcomes = outcomeRefs(source.outcomeBatches);
  return source.registrationRuns.filter(row => same(row.batch.source.challengerBatch, ref(challenger.batch)) && same(row.batch.source.knownOutcomeBatches, outcomes));
}
function observationMatches(source, registration) {
  const outcomes = outcomeRefs(source.outcomeBatches);
  return source.observationRuns.filter(row => same(row.batch.source.registrationBatch, ref(registration.batch)) && same(row.batch.source.outcomeBatches, outcomes));
}
function hold(phase, state, candidates = []) {
  return { phase, state, candidates: candidates.map(row => ref(row.batch)).sort((left, right) => left.batchId.localeCompare(right.batchId)) };
}
function authority() {
  return {
    privateGrowthTraceWrite: true,
    outcomeCurriculumPlanning: true,
    closedChallengerDerivation: true,
    prospectiveObservation: true,
    prospectiveRegistration: true,
    predictionRewrite: false,
    expectedOutcomeGeneration: false,
    probabilityGeneration: false,
    arbitraryCodeGeneration: false,
    evidenceAdmission: false,
    curriculumAdmission: false,
    trainingAdmission: false,
    methodSelection: false,
    repairSelection: false,
    repairApply: false,
    permissionGrant: false,
    toolUse: false,
    operativeShadowAdmission: false,
    runtimeSelection: false,
    runtimeAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}
function sealCycle(body) {
  body.cycleId = `outcome-growth-conductor-${digest(Object.assign({}, body, { cycleId: null, cycleDigest: null })).slice(0, 24)}`;
  body.cycleDigest = digest(Object.assign({}, body, { cycleDigest: null }));
  return Outcome.stable(body);
}
function runNormalized(source, options = {}) {
  const createdAt = String(options.at == null ? source.trigger.at : options.at);
  if (createdAt !== source.trigger.at) throw new Error('outcome growth cycle time must equal its trigger time');
  const holds = [];
  let curriculum = null;
  let challenger = null;
  let registration = null;
  const curriculumMatches = currentCurriculumMatches(source);
  if (source.outcomeBatches.length && curriculumMatches.length === 1) curriculum = curriculumMatches[0];
  else if (source.outcomeBatches.length && curriculumMatches.length !== 1) holds.push(hold('CURRICULUM', curriculumMatches.length ? 'HOLD_MULTIPLE_EXACT_CURRICULUM_RUNS' : 'HOLD_MISSING_EXACT_CURRICULUM_RUN', curriculumMatches));

  if (curriculum && curriculum.batch.summary.recurrentSignatures > 0) {
    const matches = currentChallengerMatches(source, curriculum);
    if (matches.length === 1) challenger = matches[0];
    else holds.push(hold('CHALLENGER', matches.length ? 'HOLD_MULTIPLE_EXACT_ZERO_PACK_CHALLENGER_RUNS' : 'HOLD_MISSING_EXACT_ZERO_PACK_CHALLENGER_RUN', matches));
  }

  const priorObservationRoutes = [];
  const triggerTime = Date.parse(source.trigger.at);
  for (const row of source.registrationRuns) {
    const registrationTime = Date.parse(row.batch.createdAt);
    if (!Number.isFinite(registrationTime)) throw new Error('outcome growth registration time changed');
    if (registrationTime > triggerTime) {
      holds.push(hold('PRIOR_OBSERVATION', 'HOLD_FUTURE_DATED_REGISTRATION', [row]));
      continue;
    }
    if (registrationTime === triggerTime) continue;
    const matches = observationMatches(source, row);
    if (matches.length === 1) {
      priorObservationRoutes.push({ registration: ref(row.batch), observation: ref(matches[0].batch), state: matches[0].batch.state, reviewProposals: matches[0].batch.summary.privateShadowReviewProposals });
    } else {
      const state = matches.length ? 'HOLD_MULTIPLE_EXACT_CURRENT_OBSERVATIONS' : 'HOLD_MISSING_EXACT_CURRENT_OBSERVATION';
      holds.push(hold('PRIOR_OBSERVATION', state, matches.length ? matches : [row]));
      priorObservationRoutes.push({ registration: ref(row.batch), observation: null, state, reviewProposals: 0 });
    }
  }
  priorObservationRoutes.sort((left, right) => left.registration.batchId.localeCompare(right.registration.batchId));

  if (challenger && challenger.batch.summary.declarativeCandidatesDerived > 0) {
    const matches = currentRegistrationMatches(source, challenger);
    if (matches.length === 1) registration = matches[0];
    else holds.push(hold('REGISTRATION', matches.length ? 'HOLD_MULTIPLE_EXACT_CURRENT_REGISTRATIONS' : 'HOLD_MISSING_EXACT_CURRENT_REGISTRATION', matches));
  }

  const reviewProposals = priorObservationRoutes.reduce((sum, item) => sum + item.reviewProposals, 0);
  const sameCycleObserved = priorObservationRoutes.filter(item => {
    const row = source.registrationRuns.find(candidate => candidate.batch.batchId === item.registration.batchId);
    return row && row.batch.createdAt === source.trigger.at;
  }).length;
  if (sameCycleObserved !== 0) throw new Error('outcome growth observed a same-cycle registration');
  const state = source.outcomeBatches.length === 0
    ? 'NO_OUTCOME_BATCHES'
    : holds.length
      ? 'OUTCOME_GROWTH_ROUTE_HELD'
      : curriculum && curriculum.batch.summary.recurrentSignatures === 0
        ? 'NO_RECURRENT_OUTCOME_FAILURE'
        : challenger && challenger.batch.summary.declarativeCandidatesDerived === 0
          ? 'NO_DERIVABLE_CLOSED_CHALLENGER'
          : reviewProposals > 0
            ? 'PROSPECTIVE_METHOD_REVIEW_PROPOSED'
            : registration && registration.batch.summary.watchesRegistered > 0
              ? 'WAITING_FOR_LATER_OUTCOME_EVIDENCE'
              : 'PROSPECTIVE_METHOD_EVIDENCE_HELD';
  return sealCycle({
    schema: CYCLE_SCHEMA,
    cycleId: null,
    cycleDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_AUTOMATIC_OUTCOME_TO_CLOSED_CHALLENGER_PROSPECTIVE_EVIDENCE_CONDUCTOR' },
    trigger: source.trigger,
    source: {
      sourceDigest: digest(source),
      outcomeBatches: outcomeRefs(source.outcomeBatches),
      curriculumRuns: refs(source.curriculumRuns.map(item => item.batch), 'batchId', 'batchDigest'),
      challengerRuns: refs(source.challengerRuns.map(item => item.batch), 'batchId', 'batchDigest'),
      registrationRuns: refs(source.registrationRuns.map(item => item.batch), 'batchId', 'batchDigest'),
      observationRuns: refs(source.observationRuns.map(item => item.batch), 'batchId', 'batchDigest'),
      discovery: source.discovery
    },
    sequence: ['DISCOVER_VERIFIED_OUTCOMES', 'ENSURE_CURRICULUM_PLAN', 'ENSURE_EXAM_BLIND_CLOSED_CHALLENGER', 'OBSERVE_ONLY_PRIOR_REGISTRATIONS', 'ENSURE_CURRENT_REGISTRATION', 'SEAL_CYCLE'],
    routes: {
      curriculum: routeRef(curriculum),
      challenger: routeRef(challenger),
      priorObservations: priorObservationRoutes,
      currentRegistration: routeRef(registration)
    },
    holds: holds.sort((left, right) => left.phase.localeCompare(right.phase) || left.state.localeCompare(right.state)),
    summary: {
      outcomeBatches: source.outcomeBatches.length,
      recurrentCurriculumRequests: curriculum ? curriculum.batch.summary.recurrentSignatures : 0,
      declarativeCandidates: challenger ? challenger.batch.summary.declarativeCandidatesDerived : 0,
      priorRegistrationsEligible: source.registrationRuns.filter(row => Date.parse(row.batch.createdAt) < triggerTime).length,
      priorRegistrationsObserved: priorObservationRoutes.filter(item => item.observation).length,
      sameCycleRegistrationsObserved: 0,
      watchesRegistered: registration ? registration.batch.summary.watchesRegistered : 0,
      prospectiveReviewProposals: reviewProposals,
      holds: holds.length,
      expectedOutcomesGenerated: 0,
      probabilitiesGenerated: 0,
      arbitraryCodeGenerated: 0,
      evidenceAdmissions: 0,
      curriculumAdmissions: 0,
      trainingAdmissions: 0,
      methodSelections: 0,
      predictionRewrites: 0,
      repairsSelected: 0,
      repairsApplied: 0,
      permissionGrants: 0,
      toolCalls: 0,
      operativeShadowAdmissions: 0,
      runtimeSelections: 0,
      runtimeAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state,
    authority: authority(),
    boundary: 'This TEST conductor discovers bounded verified Outcome state, ensures one exact curriculum plan and exam-blind closed challenger, observes every earlier prospective registration against the current complete bounded Outcome inventory, and only then ensures the current registration. It traffics immutable private evidence; it cannot observe a same-cycle registration, invent expected outcomes or probabilities, generate arbitrary code, admit evidence or curriculum, train, select or replace a method, repair, grant permission, use tools, admit an operative shadow, enter or promote runtime, change CANON, or act.'
  });
}
function run(input, options = {}) {
  return runNormalized(normalizeSource(input), options);
}
function verifyNormalized(cycle, source, runDir) {
  exactKeys(cycle, ['schema', 'cycleId', 'cycleDigest', 'createdAt', 'organ', 'trigger', 'source', 'sequence', 'routes', 'holds', 'summary', 'state', 'authority', 'boundary'], 'outcome growth conductor cycle');
  if (cycle.schema !== CYCLE_SCHEMA || cycle.organ.id !== ORGAN_ID || cycle.organ.status !== 'TEST' || cycle.organ.learnedWeights !== false || cycle.organ.claimCeiling !== 'TEST_AUTOMATIC_OUTCOME_TO_CLOSED_CHALLENGER_PROSPECTIVE_EVIDENCE_CONDUCTOR') throw new Error('outcome growth conductor boundary changed');
  if (!same(cycle.authority, authority())) throw new Error('outcome growth conductor gained authority');
  const zeros = ['sameCycleRegistrationsObserved', 'expectedOutcomesGenerated', 'probabilitiesGenerated', 'arbitraryCodeGenerated', 'evidenceAdmissions', 'curriculumAdmissions', 'trainingAdmissions', 'methodSelections', 'predictionRewrites', 'repairsSelected', 'repairsApplied', 'permissionGrants', 'toolCalls', 'operativeShadowAdmissions', 'runtimeSelections', 'runtimeAdmissions', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => cycle.summary[key] !== 0)) throw new Error('outcome growth conductor claim ceiling changed');
  const reconstructed = runNormalized(source, { at: cycle.createdAt });
  if (!same(reconstructed, cycle)) throw new Error('outcome growth conductor cycle does not replay from its complete source snapshot');
  const expectedId = `outcome-growth-conductor-${digest(Object.assign({}, cycle, { cycleId: null, cycleDigest: null })).slice(0, 24)}`;
  const expectedDigest = digest(Object.assign({}, cycle, { cycleDigest: null }));
  if (cycle.cycleId !== expectedId || cycle.cycleDigest !== expectedDigest) throw new Error('outcome growth conductor identity changed');
  if (runDir) {
    const diskCycle = readJson(path.join(runDir, 'cycle.json'), 'stored outcome growth cycle');
    const diskSource = readJson(path.join(runDir, 'source.json'), 'stored outcome growth source');
    if (!same(diskCycle, cycle) || !same(diskSource, source)) throw new Error('outcome growth conductor stored files changed');
  }
  return true;
}
function verify(cycle, input, runDir) {
  return verifyNormalized(cycle, normalizeSource(input), runDir);
}

function readJson(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) throw new Error(`${label} is not a bounded real file`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function ensureDirectory(directory, label) {
  const target = path.resolve(directory);
  fs.mkdirSync(target, { recursive: true });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return target;
}
function inspectRoot(rootPath, regex, label) {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root)) return { root, entries: [], ignoredStagingEntries: 0 };
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  const entries = [];
  let ignoredStagingEntries = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith('.')) { ignoredStagingEntries += 1; continue; }
    if (!entry.isDirectory() || !regex.test(entry.name)) throw new Error(`${label} contains an unexpected non-staging entry: ${entry.name}`);
    const runDir = path.join(root, entry.name);
    const runStat = fs.lstatSync(runDir);
    if (!runStat.isDirectory() || runStat.isSymbolicLink()) throw new Error(`${label} entry is not a real directory: ${entry.name}`);
    entries.push({ name: entry.name, runDir });
  }
  if (entries.length > MAX_RUNS_PER_FAMILY) throw new Error(`${label} exceeds its run bound`);
  return { root, entries, ignoredStagingEntries };
}
function loadCurriculumRuns(options = {}) {
  const inspected = inspectRoot(options.curriculumStateDir || DEFAULT_CURRICULUM_STATE_DIR, /^outcome-curriculum-plan-[a-f0-9]{24}$/, 'outcome growth curriculum root');
  const rows = inspected.entries.map(entry => {
    const batch = readJson(path.join(entry.runDir, 'batch.json'), 'outcome growth curriculum batch');
    const source = readJson(path.join(entry.runDir, 'source-batches.json'), 'outcome growth curriculum source');
    Planner.verify(batch, source, entry.runDir);
    if (batch.batchId !== entry.name) throw new Error('outcome growth curriculum directory identity changed');
    return { batch, source };
  });
  return { rows, ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function loadChallengerRuns(options = {}) {
  const inspected = inspectRoot(options.challengerStateDir || DEFAULT_CHALLENGER_STATE_DIR, /^outcome-method-challenger-[a-f0-9]{24}$/, 'outcome growth challenger root');
  const rows = inspected.entries.map(entry => {
    const batch = readJson(path.join(entry.runDir, 'batch.json'), 'outcome growth challenger batch');
    const source = readJson(path.join(entry.runDir, 'source.json'), 'outcome growth challenger source');
    Challenger.verify(batch, source, entry.runDir);
    if (batch.batchId !== entry.name) throw new Error('outcome growth challenger directory identity changed');
    return { batch, source };
  });
  return { rows, ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function loadRegistrationRuns(options = {}) {
  const inspected = inspectRoot(options.registrationStateDir || DEFAULT_REGISTRATION_STATE_DIR, /^outcome-method-watch-registration-[a-f0-9]{24}$/, 'outcome growth registration root');
  const rows = inspected.entries.map(entry => {
    const batch = readJson(path.join(entry.runDir, 'batch.json'), 'outcome growth registration batch');
    const source = readJson(path.join(entry.runDir, 'source.json'), 'outcome growth registration source');
    Watch.verifyRegistration(batch, source, entry.runDir);
    if (batch.batchId !== entry.name) throw new Error('outcome growth registration directory identity changed');
    return { batch, source };
  });
  return { rows, ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function loadObservationRuns(options = {}) {
  const inspected = inspectRoot(options.observationStateDir || DEFAULT_OBSERVATION_STATE_DIR, /^outcome-method-watch-observation-[a-f0-9]{24}$/, 'outcome growth observation root');
  const rows = inspected.entries.map(entry => {
    const batch = readJson(path.join(entry.runDir, 'batch.json'), 'outcome growth observation batch');
    const source = readJson(path.join(entry.runDir, 'source.json'), 'outcome growth observation source');
    Watch.verifyObservation(batch, source, entry.runDir);
    if (batch.batchId !== entry.name) throw new Error('outcome growth observation directory identity changed');
    return { batch, source };
  });
  return { rows, ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function canonicalTrustedSource(input) {
  const source = {
    schema: SOURCE_SCHEMA,
    trigger: validateTrigger(input.trigger),
    outcomeBatches: input.outcomeBatches.slice().sort((left, right) => left.batchId.localeCompare(right.batchId)),
    curriculumRuns: input.curriculumRuns.slice().sort((left, right) => left.batch.batchId.localeCompare(right.batch.batchId)),
    challengerRuns: input.challengerRuns.slice().sort((left, right) => left.batch.batchId.localeCompare(right.batch.batchId)),
    registrationRuns: input.registrationRuns.slice().sort((left, right) => left.batch.batchId.localeCompare(right.batch.batchId)),
    observationRuns: input.observationRuns.slice().sort((left, right) => left.batch.batchId.localeCompare(right.batch.batchId)),
    discovery: Object.assign({}, input.discovery)
  };
  if (!Number.isInteger(source.discovery.ignoredStagingEntries) || source.discovery.ignoredStagingEntries < 0) throw new Error('outcome growth ignored staging count changed');
  source.discovery.outcomeBatches = source.outcomeBatches.length;
  source.discovery.curriculumRuns = source.curriculumRuns.length;
  source.discovery.challengerRuns = source.challengerRuns.length;
  source.discovery.registrationRuns = source.registrationRuns.length;
  source.discovery.observationRuns = source.observationRuns.length;
  if (Buffer.byteLength(JSON.stringify(source), 'utf8') > MAX_SOURCE_BYTES) throw new Error('outcome growth source exceeds its byte bound');
  return source;
}
function snapshot(trigger, options = {}) {
  const outcomeBatches = Planner.loadOutcomeBatches({ outcomeStateDir: options.outcomeStateDir || DEFAULT_OUTCOME_STATE_DIR });
  const curriculum = loadCurriculumRuns(options);
  const challenger = loadChallengerRuns(options);
  const registration = loadRegistrationRuns(options);
  const observation = loadObservationRuns(options);
  return canonicalTrustedSource({
    schema: SOURCE_SCHEMA,
    trigger,
    outcomeBatches,
    curriculumRuns: curriculum.rows,
    challengerRuns: challenger.rows,
    registrationRuns: registration.rows,
    observationRuns: observation.rows,
    discovery: {
      outcomeBatches: outcomeBatches.length,
      curriculumRuns: curriculum.rows.length,
      challengerRuns: challenger.rows.length,
      registrationRuns: registration.rows.length,
      observationRuns: observation.rows.length,
      ignoredStagingEntries: curriculum.ignoredStagingEntries + challenger.ignoredStagingEntries + registration.ignoredStagingEntries + observation.ignoredStagingEntries
    }
  });
}
function withDiscoveryCounts(source) {
  source.discovery.outcomeBatches = source.outcomeBatches.length;
  source.discovery.curriculumRuns = source.curriculumRuns.length;
  source.discovery.challengerRuns = source.challengerRuns.length;
  source.discovery.registrationRuns = source.registrationRuns.length;
  source.discovery.observationRuns = source.observationRuns.length;
  return source;
}
function runCurrent(options = {}) {
  const trigger = validateTrigger(options.trigger);
  const effects = [];
  let source = snapshot(trigger, options);
  if (source.outcomeBatches.length) {
    let matches = currentCurriculumMatches(source);
    if (matches.length === 0) {
      const result = Planner.record({ batches: source.outcomeBatches }, { at: trigger.at, write: options.write !== false, stateDir: options.curriculumStateDir || DEFAULT_CURRICULUM_STATE_DIR });
      effects.push({ phase: 'CURRICULUM', batchId: result.batch.batchId, written: result.written, reused: result.reused });
      source.curriculumRuns.push({ batch: result.batch, source: clone(source.outcomeBatches) });
      source = withDiscoveryCounts(source);
      matches = currentCurriculumMatches(source);
    }
    if (matches.length === 1 && matches[0].batch.summary.recurrentSignatures > 0) {
      let challengers = currentChallengerMatches(source, matches[0]);
      if (challengers.length === 0) {
        const challengerSource = { curriculumBatch: matches[0].batch, sourceOutcomeBatches: matches[0].source, selectionPackDrafts: [], confirmationPackDrafts: [] };
        const result = Challenger.record(challengerSource, { at: trigger.at, write: options.write !== false, stateDir: options.challengerStateDir || DEFAULT_CHALLENGER_STATE_DIR });
        effects.push({ phase: 'CHALLENGER', batchId: result.batch.batchId, written: result.written, reused: result.reused });
        source.challengerRuns.push({ batch: result.batch, source: challengerSource });
        source = withDiscoveryCounts(source);
        challengers = currentChallengerMatches(source, matches[0]);
      }
    }
  }

  const priorRegistrations = source.registrationRuns.filter(row => Date.parse(row.batch.createdAt) < Date.parse(trigger.at));
  for (const registration of priorRegistrations) {
    const matches = observationMatches(source, registration);
    if (matches.length === 0) {
      const observationSource = { registrationBatch: registration.batch, registrationSource: registration.source, outcomeBatches: source.outcomeBatches };
      const result = Watch.recordObservation(observationSource, { at: trigger.at, write: options.write !== false, stateDir: options.observationStateDir || DEFAULT_OBSERVATION_STATE_DIR });
      effects.push({ phase: 'PRIOR_OBSERVATION', batchId: result.batch.batchId, registrationBatchId: registration.batch.batchId, written: result.written, reused: result.reused });
      source.observationRuns.push({ batch: result.batch, source: observationSource });
      source = withDiscoveryCounts(source);
    }
  }

  const curricula = currentCurriculumMatches(source);
  const challengers = curricula.length === 1 ? currentChallengerMatches(source, curricula[0]) : [];
  if (challengers.length === 1 && challengers[0].batch.summary.declarativeCandidatesDerived > 0) {
    const registrations = currentRegistrationMatches(source, challengers[0]);
    if (registrations.length === 0) {
      const registrationSource = { challengerBatch: challengers[0].batch, challengerSource: challengers[0].source, knownOutcomeBatches: source.outcomeBatches };
      const result = Watch.recordRegistration(registrationSource, { at: trigger.at, write: options.write !== false, stateDir: options.registrationStateDir || DEFAULT_REGISTRATION_STATE_DIR });
      effects.push({ phase: 'REGISTRATION', batchId: result.batch.batchId, written: result.written, reused: result.reused });
      source.registrationRuns.push({ batch: result.batch, source: registrationSource });
      source = withDiscoveryCounts(source);
    }
  }

  source = canonicalTrustedSource(withDiscoveryCounts(source));
  const cycle = runNormalized(source, { at: trigger.at });
  verifyNormalized(cycle, source);
  if (options.write === false) return { cycle, source, effects, written: false, reused: false, runDir: null };
  const root = ensureDirectory(options.stateDir || DEFAULT_STATE_DIR, 'outcome growth conductor cycle root');
  const finalDir = path.join(root, cycle.cycleId);
  if (fs.existsSync(finalDir)) {
    const existingCycle = readJson(path.join(finalDir, 'cycle.json'), 'stored outcome growth cycle');
    const existingSource = readJson(path.join(finalDir, 'source.json'), 'stored outcome growth source');
    if (!same(existingSource, source)) throw new Error('outcome growth conductor immutable source collision');
    verifyNormalized(existingCycle, source, finalDir);
    if (!same(existingCycle, cycle)) throw new Error('outcome growth conductor immutable identity collision');
    return { cycle: existingCycle, source, effects, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.${cycle.cycleId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'cycle.json'), JSON.stringify(cycle, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source.json'), JSON.stringify(source, null, 2) + '\n', { flag: 'wx' });
  verifyNormalized(cycle, source, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { cycle, source, effects, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}

module.exports = {
  ROOT,
  ORGAN_ID,
  CYCLE_SCHEMA,
  SOURCE_SCHEMA,
  DEFAULT_STATE_DIR,
  DEFAULT_OUTCOME_STATE_DIR,
  DEFAULT_CURRICULUM_STATE_DIR,
  DEFAULT_CHALLENGER_STATE_DIR,
  DEFAULT_REGISTRATION_STATE_DIR,
  DEFAULT_OBSERVATION_STATE_DIR,
  MAX_RUNS_PER_FAMILY,
  MAX_OUTCOME_BATCHES,
  MAX_FILE_BYTES,
  MAX_SOURCE_BYTES,
  digest,
  same,
  authority,
  normalizeSource,
  run,
  verify,
  inspectRoot,
  loadCurriculumRuns,
  loadChallengerRuns,
  loadRegistrationRuns,
  loadObservationRuns,
  snapshot,
  runCurrent
};
