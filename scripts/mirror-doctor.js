'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PublicSourceInventory = require('../kernel/foundation-public-source-inventory-cell');
const PublicBodyIntegrity = require('../kernel/foundation-public-body-integrity-cell');

const ROOT = path.resolve(__dirname, '..');
const DOCUMENT_ANCHORS = Object.freeze(['README.md', 'STATUS.json', 'MODEL_BOM.json']);

function bounded(relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error(`invalid declared body path: ${relative}`);
  const target = path.resolve(ROOT, relative);
  const relation = path.relative(ROOT, target);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) throw new Error(`declared body path escapes root: ${relative}`);
  return target;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function learnedComponentHolds(model) {
  const holds = [];
  const seen = new Set();
  for (const component of model.experimentalLearnedComponents || []) {
    try {
      if (!component || typeof component.path !== 'string' || !/^[a-f0-9]{64}$/.test(component.sha256 || '')) throw new Error('component path or digest is invalid');
      if (component.runtimeAuthority !== false) throw new Error('runtime authority is not closed');
      if (seen.has(component.path)) throw new Error('component path is duplicated');
      seen.add(component.path);
      const file = bounded(component.path);
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('component is not a real file');
      if (sha256(file) !== component.sha256) throw new Error('component SHA-256 changed');
    } catch (error) {
      holds.push({ path: component && component.path || null, reason: error.message });
    }
  }
  return holds;
}

const documentHolds = DOCUMENT_ANCHORS.filter(relative => {
  try {
    const stat = fs.lstatSync(bounded(relative));
    return !stat.isFile() || stat.isSymbolicLink();
  } catch (_) { return true; }
}).map(pathname => ({ path: pathname, reason: 'document anchor absent or non-file' }));

let status;
let model;
let packageJson;
let trainingPolicy;
let inventory;
let integrity;
let inspectionError = null;
try {
  status = JSON.parse(fs.readFileSync(bounded('STATUS.json'), 'utf8'));
  model = JSON.parse(fs.readFileSync(bounded('MODEL_BOM.json'), 'utf8'));
  packageJson = JSON.parse(fs.readFileSync(bounded('package.json'), 'utf8'));
  trainingPolicy = JSON.parse(fs.readFileSync(bounded('training/TRAINING_POLICY.json'), 'utf8'));
  inventory = PublicSourceInventory.collect(ROOT);
  integrity = PublicBodyIntegrity.inspect(ROOT, inventory);
} catch (error) {
  inspectionError = error;
  status = status || {};
  model = model || { experimentalLearnedComponents: [] };
  packageJson = packageJson || {};
  trainingPolicy = trainingPolicy || {};
}

const learnedHolds = learnedComponentHolds(model);
const tokenFile = path.join(ROOT, 'state', 'runtime-token.txt');
const pidFile = path.join(ROOT, 'state', 'runtime.pid');

console.log('AXM Mirror Doctor');
console.log(`Identity: ${status.identity || 'missing'}`);
console.log(`Body: ${status.body || 'unknown'}`);
console.log(`Learned runtime weights: ${status.learnedWeights === true ? 'yes' : 'no'}`);
console.log(`Experimental learned components: ${(model.experimentalLearnedComponents || []).length}`);
console.log(`Private hierarchical language challenger: ${status.privateHierarchicalContextLanguageChallenger || 'missing'}`);
console.log(`Public source inventory: ${inventory ? `${inventory.summary.files} files / ${inventory.summary.rootsObserved.length} roots / ${inventory.digest}` : 'HOLD'}`);
console.log(`Public body structural integrity: ${integrity ? `${integrity.state} / ${integrity.summary.javascriptSyntaxChecked} JavaScript / ${integrity.summary.jsonParsed} JSON / ${integrity.summary.activeOrgansWithTestReachability} of ${integrity.summary.activeOrgansChecked} active organs with static test reachability` : 'HOLD'}`);
console.log(`Typed-trace language organ: ${status.typedTraceLanguageOrgan || 'missing'}`);
console.log(`Typed-trace language shadow evaluation: ${status.typedTraceLanguageShadowEvaluationOrgan || 'missing'}`);
console.log(`Typed-trace language independent exam: ${status.typedTraceLanguageIndependentExamOrgan || 'missing'}`);
console.log(`Foundation development observatory: ${status.foundationDevelopmentObservatoryOrgan || 'missing'}`);
console.log(`Foundation observation request hand: ${status.foundationDevelopmentObservationRequestOrgan || 'missing'}`);
console.log(`Foundation observation executor: ${status.foundationDevelopmentObservationExecutorOrgan || 'missing'}`);
console.log(`Foundation development frontier router: ${status.foundationDevelopmentFrontierRouterOrgan || 'missing'}`);
console.log(`Foundation development hand planner: ${status.foundationDevelopmentHandPlannerOrgan || 'missing'}`);
console.log(`Foundation development capability survey: ${status.foundationDevelopmentCapabilitySurveyOrgan || 'missing'}`);
console.log(`Foundation capability affordance exam planner: ${status.foundationDevelopmentCapabilityAffordanceExamPlannerOrgan || 'missing'}`);
console.log(`Foundation capability output-adapter planner: ${status.foundationDevelopmentCapabilityOutputAdapterPlannerOrgan || 'missing'}`);
console.log(`Foundation output-adapter fixture examiner: ${status.foundationCapabilityOutputAdapterFixtureExamOrgan || 'missing'}`);
console.log(`Foundation native-artifact inventory: ${status.foundationCapabilityNativeArtifactInventoryOrgan || 'missing'}`);
console.log(`Foundation native-evidence eligibility: ${status.foundationNativeEvidenceEligibilityOrgan || 'missing'}`);
console.log(`Cognitive-resource stewardship: ${status.cognitiveResourceStewardshipOrgan || 'missing'}`);
console.log(`Cognitive-resource calibration stewardship: ${status.cognitiveResourceCalibrationStewardshipOrgan || 'missing'}`);
console.log(`Cognitive-resource economics stewardship: ${status.cognitiveResourceEconomicsStewardshipOrgan || 'missing'}`);
console.log(`Cognitive-resource-meter Workshop handoff: ${status.cognitiveResourceMeterHandoffOrgan || 'missing'}`);
console.log(`Immutable batch store: ${status.immutableBatchStore || 'missing'}`);
console.log(`External packages: ${Object.keys(packageJson.dependencies || {}).length}`);
console.log(`Workshop Root Resolution: ${status.workshopRootResolution || 'missing'}`);
console.log(`Native Reasoning Foundation: ${status.nativeReasoningFoundation || 'missing'}`);
console.log(`Reasoning Foundation Seam Audit: ${status.reasoningFoundationSeamAudit || 'missing'}`);
console.log(`Organ growth route: ${status.organGrowthRoute || 'missing'}`);
console.log(`Organ Admission Cell: ${status.organAdmissionCell || 'missing'}`);
console.log(`Reasoning Strategy Organ: ${status.reasoningStrategyOrgan || 'missing'}`);
console.log(`Reasoning Experience Organ: ${status.reasoningExperienceOrgan || 'missing'}`);
console.log(`Reasoning Structural Feature Projection Organ: ${status.reasoningStructuralFeatureProjectionOrgan || 'missing'}`);
console.log(`Reasoning Memory Context Organ: ${status.reasoningMemoryContextOrgan || 'missing'}`);
console.log(`Reasoning Memory Feature Binding Organ: ${status.reasoningMemoryFeatureBindingOrgan || 'missing'}`);
console.log(`Reasoning Memory Guidance Organ: ${status.reasoningMemoryGuidanceOrgan || 'missing'}`);
console.log(`Reasoning Memory Guidance Exam: ${status.reasoningMemoryGuidanceExamOrgan || 'missing'}`);
console.log(`Reasoning Contract Curriculum Organ: ${status.reasoningContractCurriculumOrgan || 'missing'}`);
console.log(`Reasoning Handoff Graph Organ: ${status.reasoningHandoffGraphOrgan || 'missing'}`);
console.log(`Reasoning Route Readiness Organ: ${status.reasoningRouteReadinessOrgan || 'missing'}`);
console.log(`Reasoning Readiness Hand Organ: ${status.reasoningReadinessHandOrgan || 'missing'}`);
console.log(`Provider Declaration Hand Organ: ${status.providerDeclarationHandOrgan || 'missing'}`);
console.log(`Provider Declaration Research Exam Organ: ${status.providerDeclarationResearchExamOrgan || 'missing'}`);
console.log(`Provider Declaration Architecture Survey Organ: ${status.providerDeclarationArchitectureSurveyOrgan || 'missing'}`);
console.log(`Provider Declaration Implementation Evidence Survey Organ: ${status.providerDeclarationImplementationEvidenceSurveyOrgan || 'missing'}`);
console.log(`Provider Declaration Binding Experiment Planner Organ: ${status.providerDeclarationBindingExperimentPlannerOrgan || 'missing'}`);
console.log(`Provider Declaration Research Executor Organ: ${status.providerDeclarationResearchExecutorOrgan || 'missing'}`);
console.log(`Reasoning Readiness Probe Builder Organ: ${status.reasoningReadinessProbeBuilderOrgan || 'missing'}`);
console.log(`Reasoning Counterexample Organ: ${status.reasoningCounterexampleOrgan || 'missing'}`);
console.log(`Reasoning Metamorphic Organ: ${status.reasoningMetamorphicOrgan || 'missing'}`);
console.log(`Reasoning skill loop: ${status.reasoningSkillLearningLoop || 'unrecorded'}`);
console.log(`Latest reasoning skill cycle: ${status.latestReasoningSkillCycle || 'unrecorded'}`);
console.log(`Automatic training: ${trainingPolicy.automaticTraining === true ? 'enabled' : 'off'}`);
console.log(`Automatic canon promotion: ${trainingPolicy.automaticCanonPromotion === true ? 'enabled' : 'off'}`);
console.log(`Learning loop: ${status.learningLoop || 'unrecorded'}`);
console.log(`Latest private language cycle: ${status.latestLearningCycle || 'unrecorded'}`);
console.log(`Runtime token: ${fs.existsSync(tokenFile) ? 'present (value hidden)' : 'created on first start'}`);
console.log(`Runtime PID: ${fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim() : 'offline'}`);

const structuralHolds = [];
if (inspectionError) structuralHolds.push(`inspection error: ${inspectionError.message}`);
if (integrity && integrity.state !== PublicBodyIntegrity.PASS_STATE) structuralHolds.push(...integrity.holds.map(item => `${item.code}:${item.path || 'body'}`));
structuralHolds.push(...documentHolds.map(item => `${item.reason}:${item.path}`));
structuralHolds.push(...learnedHolds.map(item => `${item.reason}:${item.path || 'learned-component'}`));
if (structuralHolds.length) {
  console.error(`Structure: HOLD (${structuralHolds.join(', ')})`);
  process.exitCode = 1;
} else {
  console.log('Structure: PASS');
}
