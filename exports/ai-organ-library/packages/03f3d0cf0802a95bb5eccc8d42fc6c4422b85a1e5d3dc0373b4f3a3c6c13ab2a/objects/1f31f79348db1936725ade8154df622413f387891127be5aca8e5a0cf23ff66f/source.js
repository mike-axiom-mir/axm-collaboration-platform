'use strict';

const fs = require('fs');
const path = require('path');
const Economics = require('../kernel/cognitive-resource-economics-cell');
const MetrologyStewardship = require('./cognitive-resource-stewardship-organ');
const CalibrationStewardship = require('./cognitive-resource-calibration-stewardship-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.cognitive-resource-economics-stewardship-organ/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PROFILE_STATE_DIR = path.join(ROOT, 'state', 'cognitive-resource-economics-profiles');
const DEFAULT_ESTIMATE_STATE_DIR = path.join(ROOT, 'state', 'cognitive-resource-cost-estimates');
const DEFAULT_POLICY_PATH = path.join(ROOT, 'training', 'TRAINING_POLICY.json');

function json(value) { return JSON.stringify(Economics.stable(value), null, 2) + '\n'; }
function same(left, right) { return Economics.digest(left) === Economics.digest(right); }

function loadPolicy(options = {}) {
  const policy = options.policy || JSON.parse(fs.readFileSync(path.resolve(options.policyPath || DEFAULT_POLICY_PATH), 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('cognitive-resource economics stewardship requires the Mirror training policy');
  if (policy.cognitiveResourceEconomicsIntakeEnabled !== true) throw new Error('cognitive-resource economics intake is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) {
    throw new Error('cognitive-resource economics stewardship refuses runtime, canon, or authority growth');
  }
  return policy;
}

function realChildDirectories(stateDir, prefix) {
  const root = path.resolve(stateDir);
  if (!fs.existsSync(root)) return [];
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('cognitive-resource economics state root must be a real directory');
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !entry.name.startsWith(prefix)) throw new Error(`unexpected cognitive-resource economics state entry: ${entry.name}`);
      const absolute = path.join(root, entry.name);
      const stat = fs.lstatSync(absolute);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`cognitive-resource economics state entry is not a real directory: ${entry.name}`);
      return absolute;
    });
}

function readSingleRecord(runDir, fileName, label) {
  const names = fs.readdirSync(runDir).sort();
  if (!same(names, [fileName])) throw new Error(`${label} directory fields changed: ${path.basename(runDir)}`);
  const file = path.join(runDir, fileName);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} is not a real file: ${path.basename(runDir)}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function commitRecord(stateDir, recordId, fileName, record, verify) {
  const root = path.resolve(stateDir);
  fs.mkdirSync(root, { recursive: true });
  const runDir = path.join(root, recordId);
  if (fs.existsSync(runDir)) {
    const existing = readSingleRecord(runDir, fileName, 'cognitive-resource economics record');
    verify(existing);
    if (!same(existing, record)) throw new Error('content-addressed cognitive-resource economics identity collision');
    return { record: existing, runDir, reused: true };
  }
  const stageDir = path.join(root, `.stage-${recordId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`cognitive-resource economics staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, fileName), json(record), { flag: 'wx' });
  verify(record);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { record, runDir, reused: commit.reused };
}

function loadProfiles(stateDir = DEFAULT_PROFILE_STATE_DIR) {
  return realChildDirectories(stateDir, 'cognitive-resource-economics-profile-').map(runDir => {
    const profile = readSingleRecord(runDir, 'profile.json', 'cognitive-resource economics profile');
    Economics.verifyProfile(profile);
    if (path.basename(runDir) !== profile.profileId) throw new Error('cognitive-resource economics profile directory identity changed');
    return profile;
  });
}

function intakeProfile(draft, options = {}) {
  loadPolicy(options);
  const profile = Economics.sealProfile(draft);
  Economics.verifyProfile(profile);
  const committed = commitRecord(
    options.economicsProfileStateDir || DEFAULT_PROFILE_STATE_DIR,
    profile.profileId,
    'profile.json',
    profile,
    Economics.verifyProfile
  );
  return {
    profile: committed.record,
    state: profile.state,
    runDir: committed.runDir,
    reused: committed.reused,
    authority: {
      privateProfileWrite: true,
      automaticPriceRefresh: false,
      billedCostClaim: false,
      measuredCostClaim: false,
      calibratedCostClaim: false,
      costOptimization: false,
      modelSelection: false,
      hardwareSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    }
  };
}

function sourceInventory(options = {}) {
  const observations = options.observations || MetrologyStewardship.loadObservations(options.observationStateDir || MetrologyStewardship.DEFAULT_OBSERVATION_STATE_DIR);
  const resourceProfiles = options.resourceProfiles || MetrologyStewardship.loadProfiles(observations, options.resourceProfileStateDir || MetrologyStewardship.DEFAULT_PROFILE_STATE_DIR);
  const predictions = options.predictions || CalibrationStewardship.loadPredictions(Object.assign({}, options, {
    observations,
    profiles: resourceProfiles,
    profileStateDir: options.resourceProfileStateDir || MetrologyStewardship.DEFAULT_PROFILE_STATE_DIR
  }));
  return { observations, resourceProfiles, predictions };
}

function buildEstimate(sourceKind, sourceId, economicsProfileId, options = {}) {
  loadPolicy(options);
  const economicsProfiles = options.economicsProfiles || loadProfiles(options.economicsProfileStateDir || DEFAULT_PROFILE_STATE_DIR);
  const economicsProfile = economicsProfiles.find(profile => profile.profileId === economicsProfileId);
  if (!economicsProfile) throw new Error('cognitive-resource economics profile is absent');
  const inventory = sourceInventory(options);
  if (sourceKind === 'observation') {
    const observation = inventory.observations.find(item => item.observationId === sourceId);
    if (!observation) throw new Error('cognitive-work observation is absent');
    return { estimate: Economics.estimateObservation(observation, economicsProfile), sourceRecord: observation, economicsProfile, context: {} };
  }
  if (sourceKind === 'prediction') {
    const prediction = inventory.predictions.find(item => item.predictionId === sourceId);
    if (!prediction) throw new Error('cognitive-resource prediction is absent');
    const resourceProfile = inventory.resourceProfiles.find(item => item.profileId === prediction.method.resourceProfileId);
    if (!resourceProfile) throw new Error('cognitive-resource prediction profile is absent');
    return {
      estimate: Economics.estimatePrediction(prediction, resourceProfile, economicsProfile, inventory.observations),
      sourceRecord: prediction,
      economicsProfile,
      context: { resourceProfile, observations: inventory.observations }
    };
  }
  throw new Error('source kind must be observation or prediction');
}

function estimate(sourceKind, sourceId, economicsProfileId, options = {}) {
  const built = buildEstimate(sourceKind, sourceId, economicsProfileId, options);
  Economics.verifyEstimate(built.estimate, built.sourceRecord, built.economicsProfile, built.context);
  if (options.write === false) return { estimate: built.estimate, runDir: null, reused: false, written: false };
  const committed = commitRecord(
    options.estimateStateDir || DEFAULT_ESTIMATE_STATE_DIR,
    built.estimate.estimateId,
    'estimate.json',
    built.estimate,
    candidate => Economics.verifyEstimate(candidate, built.sourceRecord, built.economicsProfile, built.context)
  );
  return { estimate: committed.record, runDir: committed.runDir, reused: committed.reused, written: true };
}

function loadEstimates(options = {}) {
  loadPolicy(options);
  const economicsProfiles = options.economicsProfiles || loadProfiles(options.economicsProfileStateDir || DEFAULT_PROFILE_STATE_DIR);
  const economicsById = new Map(economicsProfiles.map(profile => [profile.profileId, profile]));
  const inventory = sourceInventory(options);
  const observationsById = new Map(inventory.observations.map(observation => [observation.observationId, observation]));
  const predictionsById = new Map(inventory.predictions.map(prediction => [prediction.predictionId, prediction]));
  const resourceProfilesById = new Map(inventory.resourceProfiles.map(profile => [profile.profileId, profile]));
  return realChildDirectories(options.estimateStateDir || DEFAULT_ESTIMATE_STATE_DIR, 'cognitive-resource-cost-estimate-').map(runDir => {
    const estimateRecord = readSingleRecord(runDir, 'estimate.json', 'cognitive-resource cost estimate');
    const economicsProfile = economicsById.get(estimateRecord.economicsProfile.profileId);
    if (!economicsProfile || economicsProfile.profileDigest !== estimateRecord.economicsProfile.profileDigest) throw new Error('cognitive-resource cost estimate economics profile changed');
    let sourceRecord;
    let context = {};
    if (estimateRecord.source.kind === 'SEALED_COGNITIVE_WORK_OBSERVATION') sourceRecord = observationsById.get(estimateRecord.source.sourceId);
    else {
      sourceRecord = predictionsById.get(estimateRecord.source.sourceId);
      const resourceProfile = sourceRecord && resourceProfilesById.get(sourceRecord.method.resourceProfileId);
      context = { resourceProfile, observations: inventory.observations };
    }
    if (!sourceRecord || sourceRecord[estimateRecord.source.kind === 'SEALED_COGNITIVE_WORK_OBSERVATION' ? 'observationDigest' : 'predictionDigest'] !== estimateRecord.source.sourceDigest) {
      throw new Error('cognitive-resource cost estimate source changed');
    }
    Economics.verifyEstimate(estimateRecord, sourceRecord, economicsProfile, context);
    if (path.basename(runDir) !== estimateRecord.estimateId) throw new Error('cognitive-resource cost estimate directory identity changed');
    return estimateRecord;
  });
}

module.exports = {
  ORGAN_ID,
  DEFAULT_PROFILE_STATE_DIR,
  DEFAULT_ESTIMATE_STATE_DIR,
  DEFAULT_POLICY_PATH,
  loadPolicy,
  loadProfiles,
  loadEstimates,
  intakeProfile,
  estimate
};
