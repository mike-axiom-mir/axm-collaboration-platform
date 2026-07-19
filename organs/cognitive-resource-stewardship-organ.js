'use strict';

const fs = require('fs');
const path = require('path');
const Metrology = require('../kernel/cognitive-work-metrology-cell');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.cognitive-resource-stewardship-organ/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OBSERVATION_STATE_DIR = path.join(ROOT, 'state', 'cognitive-work-observations');
const DEFAULT_PROFILE_STATE_DIR = path.join(ROOT, 'state', 'cognitive-resource-profiles');
const DEFAULT_POLICY_PATH = path.join(ROOT, 'training', 'TRAINING_POLICY.json');

function json(value) { return JSON.stringify(Metrology.stable(value), null, 2) + '\n'; }
function same(left, right) { return Metrology.digest(left) === Metrology.digest(right); }

function loadPolicy(options = {}) {
  const policy = options.policy || JSON.parse(fs.readFileSync(path.resolve(options.policyPath || DEFAULT_POLICY_PATH), 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('cognitive-resource stewardship requires the Mirror training policy');
  if (policy.cognitiveWorkObservationIntakeEnabled !== true) throw new Error('cognitive-work observation intake is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) {
    throw new Error('cognitive-resource stewardship refuses runtime, canon, or authority growth');
  }
  return policy;
}

function realChildDirectories(stateDir, prefix) {
  const root = path.resolve(stateDir);
  if (!fs.existsSync(root)) return [];
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('cognitive-resource state root must be a real directory');
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !entry.name.startsWith(prefix)) throw new Error(`unexpected cognitive-resource state entry: ${entry.name}`);
      const absolute = path.join(root, entry.name);
      const stat = fs.lstatSync(absolute);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`cognitive-resource state entry is not a real directory: ${entry.name}`);
      return absolute;
    });
}

function loadObservations(stateDir = DEFAULT_OBSERVATION_STATE_DIR) {
  return realChildDirectories(stateDir, 'cognitive-work-observation-').map(runDir => {
    const names = fs.readdirSync(runDir).sort();
    if (!same(names, ['observation.json'])) throw new Error(`cognitive-work observation directory fields changed: ${path.basename(runDir)}`);
    const file = path.join(runDir, 'observation.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`cognitive-work observation is not a real file: ${path.basename(runDir)}`);
    const observation = JSON.parse(fs.readFileSync(file, 'utf8'));
    Metrology.verifyObservation(observation);
    if (path.basename(runDir) !== observation.observationId) throw new Error('cognitive-work observation directory identity changed');
    return observation;
  });
}

function loadProfiles(observations, stateDir = DEFAULT_PROFILE_STATE_DIR) {
  if (!Array.isArray(observations)) throw new Error('cognitive-resource profile loading requires source observations');
  const observationsById = new Map(observations.map(observation => [observation.observationId, observation]));
  return realChildDirectories(stateDir, 'cognitive-resource-profile-').map(runDir => {
    const names = fs.readdirSync(runDir).sort();
    if (!same(names, ['profile.json'])) throw new Error(`cognitive-resource profile directory fields changed: ${path.basename(runDir)}`);
    const file = path.join(runDir, 'profile.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`cognitive-resource profile is not a real file: ${path.basename(runDir)}`);
    const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
    const sourceObservations = profile.source.observationIds.map((observationId, index) => {
      const observation = observationsById.get(observationId);
      if (!observation || observation.observationDigest !== profile.source.observationDigests[index]) throw new Error('cognitive-resource profile source observation changed');
      return observation;
    });
    Metrology.verifyResourceProfile(profile, sourceObservations);
    if (path.basename(runDir) !== profile.profileId) throw new Error('cognitive-resource profile directory identity changed');
    return profile;
  });
}

function commitRecord(stateDir, recordId, fileName, record, verify) {
  const root = path.resolve(stateDir);
  fs.mkdirSync(root, { recursive: true });
  const runDir = path.join(root, recordId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, fileName), 'utf8'));
    verify(existing, runDir);
    if (!same(existing, record)) throw new Error('content-addressed cognitive-resource identity collision');
    return { record: existing, runDir, reused: true };
  }
  const stageDir = path.join(root, `.stage-${recordId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`cognitive-resource staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, fileName), json(record), { flag: 'wx' });
  verify(record, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { record, runDir, reused: commit.reused };
}

function intake(draft, options = {}) {
  loadPolicy(options);
  const observation = Metrology.sealObservation(draft);
  Metrology.verifyObservation(observation);
  const committed = commitRecord(
    options.observationStateDir || DEFAULT_OBSERVATION_STATE_DIR,
    observation.observationId,
    'observation.json',
    observation,
    (candidate, directory) => {
      Metrology.verifyObservation(candidate);
      if (directory) {
        const disk = JSON.parse(fs.readFileSync(path.join(directory, 'observation.json'), 'utf8'));
        if (!same(disk, candidate)) throw new Error('cognitive-work observation file changed');
      }
    }
  );
  return {
    observation: committed.record,
    state: observation.assessment.resourceProfileEligible
      ? 'RECORDED_PROFILE_ELIGIBLE_OBSERVATION'
      : 'RECORDED_INCOMPLETE_OBSERVATION_HOLD',
    runDir: committed.runDir,
    reused: committed.reused,
    authority: {
      privateObservationWrite: true,
      forecastClaim: false,
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

function profile(comparisonKey, options = {}) {
  loadPolicy(options);
  const observations = options.observations || loadObservations(options.observationStateDir || DEFAULT_OBSERVATION_STATE_DIR);
  const resourceProfile = Metrology.buildResourceProfile(observations, comparisonKey);
  Metrology.verifyResourceProfile(resourceProfile, observations);
  if (options.write === false) return { profile: resourceProfile, runDir: null, reused: false, written: false };
  const committed = commitRecord(
    options.profileStateDir || DEFAULT_PROFILE_STATE_DIR,
    resourceProfile.profileId,
    'profile.json',
    resourceProfile,
    candidate => Metrology.verifyResourceProfile(candidate, observations)
  );
  return { profile: committed.record, runDir: committed.runDir, reused: committed.reused, written: true };
}

module.exports = {
  ORGAN_ID,
  DEFAULT_OBSERVATION_STATE_DIR,
  DEFAULT_PROFILE_STATE_DIR,
  DEFAULT_POLICY_PATH,
  loadPolicy,
  loadObservations,
  loadProfiles,
  intake,
  profile
};
