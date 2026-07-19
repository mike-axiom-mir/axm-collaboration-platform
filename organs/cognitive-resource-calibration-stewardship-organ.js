'use strict';

const fs = require('fs');
const path = require('path');
const Calibration = require('../kernel/cognitive-resource-calibration-cell');
const MetrologyStewardship = require('./cognitive-resource-stewardship-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.cognitive-resource-calibration-stewardship-organ/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PREDICTION_STATE_DIR = path.join(ROOT, 'state', 'cognitive-resource-predictions');
const DEFAULT_REPORT_STATE_DIR = path.join(ROOT, 'state', 'cognitive-resource-calibration-reports');

function json(value) { return JSON.stringify(Calibration.stable(value), null, 2) + '\n'; }
function same(left, right) { return Calibration.digest(left) === Calibration.digest(right); }

function loadPolicy(options = {}) {
  const policy = MetrologyStewardship.loadPolicy(options);
  if (policy.cognitiveResourceCalibrationIntakeEnabled !== true) throw new Error('cognitive-resource calibration intake is not enabled');
  return policy;
}

function realChildDirectories(stateDir, prefix) {
  const root = path.resolve(stateDir);
  if (!fs.existsSync(root)) return [];
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('cognitive-resource calibration state root must be a real directory');
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !entry.name.startsWith(prefix)) throw new Error(`unexpected cognitive-resource calibration state entry: ${entry.name}`);
      const absolute = path.join(root, entry.name);
      const stat = fs.lstatSync(absolute);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`cognitive-resource calibration state entry is not a real directory: ${entry.name}`);
      return absolute;
    });
}

function commitRecord(stateDir, recordId, fileName, record, verify) {
  const root = path.resolve(stateDir);
  fs.mkdirSync(root, { recursive: true });
  const runDir = path.join(root, recordId);
  if (fs.existsSync(runDir)) {
    const names = fs.readdirSync(runDir).sort();
    if (!same(names, [fileName])) throw new Error('existing cognitive-resource calibration record fields changed');
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, fileName), 'utf8'));
    verify(existing);
    if (!same(existing, record)) throw new Error('content-addressed cognitive-resource calibration identity collision');
    return { record: existing, runDir, reused: true };
  }
  const stageDir = path.join(root, `.stage-${recordId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`cognitive-resource calibration staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, fileName), json(record), { flag: 'wx' });
  verify(record);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { record, runDir, reused: commit.reused };
}

function sourceOrder(left, right) {
  return left.source.sourceSystemId.localeCompare(right.source.sourceSystemId) || left.source.sequence - right.source.sequence || left.predictionId.localeCompare(right.predictionId);
}

function loadPredictions(options = {}) {
  const observations = options.observations || MetrologyStewardship.loadObservations(options.observationStateDir);
  const profiles = options.profiles || MetrologyStewardship.loadProfiles(observations, options.profileStateDir);
  const profileById = new Map(profiles.map(profile => [profile.profileId, profile]));
  const records = realChildDirectories(options.predictionStateDir || DEFAULT_PREDICTION_STATE_DIR, 'cognitive-resource-prediction-').map(runDir => {
    const names = fs.readdirSync(runDir).sort();
    if (!same(names, ['prediction.json'])) throw new Error(`cognitive-resource prediction directory fields changed: ${path.basename(runDir)}`);
    const file = path.join(runDir, 'prediction.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`cognitive-resource prediction is not a real file: ${path.basename(runDir)}`);
    const prediction = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (path.basename(runDir) !== prediction.predictionId) throw new Error('cognitive-resource prediction directory identity changed');
    return prediction;
  }).sort(sourceOrder);
  const predecessorBySource = new Map();
  const targets = new Set();
  for (const prediction of records) {
    const profile = profileById.get(prediction.method.resourceProfileId);
    if (!profile) throw new Error('cognitive-resource prediction profile is absent');
    const predecessor = predecessorBySource.get(prediction.source.sourceSystemId) || null;
    Calibration.verifyPrediction(prediction, profile, observations, predecessor);
    predecessorBySource.set(prediction.source.sourceSystemId, prediction);
    const targetKey = Calibration.digest(prediction.target);
    if (targets.has(targetKey)) throw new Error('duplicate cognitive-resource prediction target');
    targets.add(targetKey);
  }
  return records;
}

function sealPrediction(draft, options = {}) {
  loadPolicy(options);
  const normalized = Calibration.normalizeDraft(draft);
  const observations = options.observations || MetrologyStewardship.loadObservations(options.observationStateDir);
  const profiles = options.profiles || MetrologyStewardship.loadProfiles(observations, options.profileStateDir);
  const profile = profiles.find(item => item.profileId === draft.method.resourceProfileId);
  if (!profile) throw new Error('prediction resource profile is absent');
  const predictions = loadPredictions(Object.assign({}, options, { observations, profiles }));
  const targetKey = Calibration.digest(normalized.target);
  const existingTarget = predictions.find(item => Calibration.digest(item.target) === targetKey);
  if (existingTarget) {
    const existingDraft = Calibration.normalizeDraft({
      schema: Calibration.PREDICTION_DRAFT_SCHEMA,
      source: existingTarget.source,
      target: existingTarget.target,
      method: existingTarget.method,
      intervals: existingTarget.intervals,
      costBinding: existingTarget.costBinding,
      permission: existingTarget.permission
    });
    if (!same(existingDraft, normalized)) throw new Error('duplicate cognitive-resource prediction target');
    return {
      prediction: existingTarget,
      state: existingTarget.assessment.heldOutEvaluationEligible ? 'SEALED_LOCAL_PRE_OUTCOME_PREDICTION' : 'SEALED_PREDICTION_HOLD',
      runDir: path.join(path.resolve(options.predictionStateDir || DEFAULT_PREDICTION_STATE_DIR), existingTarget.predictionId),
      reused: true,
      authority: existingTarget.authority
    };
  }
  const predecessor = predictions.filter(item => item.source.sourceSystemId === draft.source.sourceSystemId).sort(sourceOrder).at(-1) || null;
  const prediction = Calibration.sealPrediction(draft, profile, { observations, predecessor });
  Calibration.verifyPrediction(prediction, profile, observations, predecessor);
  const committed = commitRecord(
    options.predictionStateDir || DEFAULT_PREDICTION_STATE_DIR,
    prediction.predictionId,
    'prediction.json',
    prediction,
    candidate => Calibration.verifyPrediction(candidate, profile, observations, predecessor)
  );
  return {
    prediction: committed.record,
    state: prediction.assessment.heldOutEvaluationEligible ? 'SEALED_LOCAL_PRE_OUTCOME_PREDICTION' : 'SEALED_PREDICTION_HOLD',
    runDir: committed.runDir,
    reused: committed.reused,
    authority: prediction.authority
  };
}

function report(calibrationKey, options = {}) {
  loadPolicy(options);
  const observations = options.observations || MetrologyStewardship.loadObservations(options.observationStateDir);
  const profiles = options.profiles || MetrologyStewardship.loadProfiles(observations, options.profileStateDir);
  const predictions = loadPredictions(Object.assign({}, options, { observations, profiles }));
  const calibrationReport = Calibration.buildCalibrationReport(predictions, observations, calibrationKey);
  Calibration.verifyCalibrationReport(calibrationReport, predictions, observations);
  if (options.write === false) return { report: calibrationReport, runDir: null, reused: false, written: false };
  const committed = commitRecord(
    options.reportStateDir || DEFAULT_REPORT_STATE_DIR,
    calibrationReport.reportId,
    'report.json',
    calibrationReport,
    candidate => Calibration.verifyCalibrationReport(candidate, predictions, observations)
  );
  return { report: committed.record, runDir: committed.runDir, reused: committed.reused, written: true };
}

module.exports = {
  ORGAN_ID,
  DEFAULT_PREDICTION_STATE_DIR,
  DEFAULT_REPORT_STATE_DIR,
  loadPolicy,
  loadPredictions,
  sealPrediction,
  report
};
