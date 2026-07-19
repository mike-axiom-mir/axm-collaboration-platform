'use strict';

const fs = require('fs');
const path = require('path');
const Reader = require('../adapters/workshop/cognitive-resource-meter-reader');
const Metrology = require('../kernel/cognitive-work-metrology-cell');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.cognitive-resource-meter-handoff-organ/v1';
const ASSESSMENT_SCHEMA = 'axm.mirror.cognitive-resource-meter-handoff-assessment/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'cognitive-resource-meter-handoff-runs');
const DEFAULT_POLICY_PATH = path.join(ROOT, 'training', 'TRAINING_POLICY.json');

function stable(value) { return Metrology.stable(value); }
function digest(value) { return Metrology.digest(value); }
function same(left, right) { return digest(left) === digest(right); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }

function loadPolicy(options = {}) {
  const policy = options.policy || JSON.parse(fs.readFileSync(path.resolve(options.policyPath || DEFAULT_POLICY_PATH), 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('cognitive-resource-meter handoff requires the Mirror training policy');
  if (policy.cognitiveResourceMeterHandoffObservationEnabled !== true) throw new Error('cognitive-resource-meter handoff observation is not enabled');
  const scope = String(policy.cognitiveResourceMeterHandoffObservationScope || '');
  for (const required of ['bounded-typed-declaration-and-export-read-only', 'no-automatic-intake', 'no-evidence-admission', 'no-selection-or-budget-authority']) {
    if (!scope.includes(required)) throw new Error(`cognitive-resource-meter handoff scope is incomplete: ${required}`);
  }
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) {
    throw new Error('cognitive-resource-meter handoff refuses runtime, canon, or authority growth');
  }
  return policy;
}

function buildAssessment(observation) {
  Reader.verifyObservation(observation);
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    assessmentId: null,
    assessmentDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, workshopSourceExecution: false, automaticIntake: false },
    source: {
      workshopObservationSchema: observation.schema,
      workshopObservationDigest: observation.observationDigest,
      moduleId: observation.declaration && observation.declaration.moduleId || null,
      providerCatalogSha256: observation.declaration && observation.declaration.providerCatalog.sha256 || null
    },
    workshopObservation: observation,
    state: observation.state,
    summary: Object.assign({}, observation.summary, { privateHandoffAssessmentsWritten: 1 }),
    authority: {
      privateHandoffAssessmentWrite: true,
      workshopWrite: false,
      automaticIntake: false,
      evidenceAdmission: false,
      observationSeal: false,
      economicsProfileSeal: false,
      currentPriceCertification: false,
      measuredOrBilledCostClaim: false,
      universalTokenComputeConversion: false,
      nonlinearBillingClaim: false,
      calibratedCostClaim: false,
      ranking: false,
      modelHardwareProviderOrPlanSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This private assessment records a bounded read-only Workshop handoff observation. It does not execute Workshop source, copy draft content into the trace, seal or admit an observation or economics profile, certify price or cost, convert tokens to universal compute, rank or select anything, allocate budget, grant permission, train, promote, change CANON, or act.'
  };
  const identityBasis = {
    organId: ORGAN_ID,
    workshopObservationDigest: observation.observationDigest,
    state: observation.state
  };
  assessment.assessmentId = `cognitive-resource-meter-handoff-${digest(identityBasis).slice(0, 24)}`;
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return stable(assessment);
}

function verifyAssessment(assessment, observation = null, runDir = null) {
  if (!assessment || assessment.schema !== ASSESSMENT_SCHEMA || assessment.assessmentDigest !== digest(Object.assign({}, assessment, { assessmentDigest: null }))) throw new Error('cognitive-resource-meter handoff assessment digest changed');
  Reader.verifyObservation(assessment.workshopObservation);
  const identityBasis = {
    organId: ORGAN_ID,
    workshopObservationDigest: assessment.workshopObservation.observationDigest,
    state: assessment.workshopObservation.state
  };
  if (assessment.assessmentId !== `cognitive-resource-meter-handoff-${digest(identityBasis).slice(0, 24)}`) throw new Error('cognitive-resource-meter handoff assessment identity changed');
  if (!assessment.organ || assessment.organ.id !== ORGAN_ID || assessment.organ.learnedWeights !== false || assessment.organ.workshopSourceExecution !== false || assessment.organ.automaticIntake !== false) throw new Error('cognitive-resource-meter handoff organ boundary changed');
  if (!assessment.authority || Object.entries(assessment.authority).some(([key, value]) => key === 'privateHandoffAssessmentWrite' ? value !== true : value !== false)) throw new Error('cognitive-resource-meter handoff authority changed');
  if (assessment.summary.privateHandoffAssessmentsWritten !== 1 || assessment.summary.observationsAdmitted !== 0 || assessment.summary.economicsProfilesAdmitted !== 0) throw new Error('cognitive-resource-meter handoff write boundary changed');
  if (observation && !same(buildAssessment(observation), assessment)) throw new Error('cognitive-resource-meter handoff assessment content changed');
  if (runDir) {
    const directory = path.resolve(runDir);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('cognitive-resource-meter handoff run is not a real directory');
    const names = fs.readdirSync(directory).sort();
    if (!same(names, ['assessment.json'])) throw new Error('cognitive-resource-meter handoff run fields changed');
    const file = path.join(directory, 'assessment.json');
    const fileStat = fs.lstatSync(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error('cognitive-resource-meter handoff assessment is not a real file');
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!same(disk, assessment)) throw new Error('cognitive-resource-meter handoff assessment file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const observation = Reader.observe(options);
  const assessment = buildAssessment(observation);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const stateStat = fs.lstatSync(stateDir);
  if (!stateStat.isDirectory() || stateStat.isSymbolicLink()) throw new Error('cognitive-resource-meter handoff state root must be a real directory');
  const runDir = path.join(stateDir, assessment.assessmentId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'assessment.json'), 'utf8'));
    verifyAssessment(existing, observation, runDir);
    return { assessment: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${assessment.assessmentId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`cognitive-resource-meter handoff staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'assessment.json'), json(assessment), { flag: 'wx' });
  verifyAssessment(assessment, observation, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { assessment, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID,
  ASSESSMENT_SCHEMA,
  ROOT,
  DEFAULT_STATE_DIR,
  DEFAULT_POLICY_PATH,
  loadPolicy,
  buildAssessment,
  verifyAssessment,
  run
};
