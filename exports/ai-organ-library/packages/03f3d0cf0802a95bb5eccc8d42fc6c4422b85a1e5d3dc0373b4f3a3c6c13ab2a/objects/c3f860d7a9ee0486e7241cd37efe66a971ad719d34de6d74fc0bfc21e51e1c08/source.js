'use strict';

const fs = require('fs');
const path = require('path');
const WorkshopRoot = require('../config/workshop-root');
const Reader = require('../adapters/workshop/capability-intelligence-reader');
const Cell = require('../kernel/capability-intelligence-source-archive-cell');
const Metrology = require('../kernel/cognitive-work-metrology-cell');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.capability-intelligence-source-drift-organ/v1';
const OBSERVATION_SCHEMA = 'axm.mirror.capability-intelligence-source-drift-observation/v1';
const ASSESSMENT_SCHEMA = 'axm.mirror.capability-intelligence-source-drift-assessment/v1';
const MODULE_ID = 'grounded-evolution-intelligence';
const MODULE_VERSION = '0.7.0';
const SOURCE_PACKAGE_BASENAME = 'AXM_GROUNDED_EVOLUTION_INTELLIGENCE_MODULE3_MASTER_LOCAL_INTAKE_v0_7_0.zip';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'capability-intelligence-source-drift-runs');
const DEFAULT_POLICY_PATH = path.join(ROOT, 'training', 'TRAINING_POLICY.json');

function stable(value) { return Metrology.stable(value); }
function digest(value) { return Metrology.digest(value); }
function same(left, right) { return digest(left) === digest(right); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }

function loadPolicy(options = {}) {
  const policy = options.policy || JSON.parse(fs.readFileSync(path.resolve(options.policyPath || DEFAULT_POLICY_PATH), 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('source drift localization requires the Mirror training policy');
  if (policy.capabilityIntelligenceSourceDriftLocalizationEnabled !== true) throw new Error('capability-intelligence source drift localization is not enabled');
  const scope = String(policy.capabilityIntelligenceSourceDriftLocalizationScope || '');
  for (const required of ['read-only-source-archive', 'receipt-bound-baseline', 'no-source-execution', 'no-automatic-repair-or-promotion']) {
    if (!scope.includes(required)) throw new Error(`source drift localization scope is incomplete: ${required}`);
  }
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('source drift localization refuses runtime, canon, or authority growth');
  return policy;
}

function readContext(workshopRoot) {
  const shared = path.join(workshopRoot, 'shared', 'capability-intelligence');
  const statusRead = Reader.boundedJson(path.join(shared, 'status.json'), Reader.MAX_JSON_BYTES, 'capability-intelligence drift status');
  const receiptRead = Reader.boundedJson(path.join(shared, 'generated', 'verified-workflow', 'pipeline-receipt.json'), Reader.MAX_JSON_BYTES, 'capability-intelligence drift receipt');
  const status = statusRead.value;
  const receipt = receiptRead.value;
  const statusCopy = JSON.parse(JSON.stringify(status)); delete statusCopy.status_sha256;
  const receiptCopy = JSON.parse(JSON.stringify(receipt)); delete receiptCopy.receipt_sha256;
  const packages = Array.isArray(status.source_packages) ? status.source_packages : [];
  const candidates = packages.filter(item => item && typeof item.path === 'string' && path.posix.basename(item.path) === SOURCE_PACKAGE_BASENAME);
  const recordedBefore = receipt.supplier_source_stability && receipt.supplier_source_stability.before && receipt.supplier_source_stability.before[MODULE_ID];
  const recordedAfter = receipt.supplier_source_stability && receipt.supplier_source_stability.after && receipt.supplier_source_stability.after[MODULE_ID];
  return {
    status: { schema: status.schema || null, rawSha256: statusRead.sha256, selfDigest: status.status_sha256 || null, selfDigestValid: status.status_sha256 === Reader.prefixedDigest(statusCopy), receiptLinkMatches: Boolean(status.verified_workflow && status.verified_workflow.receipt_sha256 === receipt.receipt_sha256) },
    receipt: { schema: receipt.schema || null, rawSha256: receiptRead.sha256, selfDigest: receipt.receipt_sha256 || null, selfDigestValid: receipt.receipt_sha256 === Reader.prefixedDigest(receiptCopy), supplierStabilityStatus: receipt.supplier_source_stability && receipt.supplier_source_stability.status || null, recordedBefore: recordedBefore || null, recordedAfter: recordedAfter || null },
    sourcePackageCandidates: candidates.map(item => ({ path: item.path, sha256: item.sha256 || null }))
  };
}

function emptyObservation(resolution, issues, state) {
  const observation = {
    schema: OBSERVATION_SCHEMA,
    observationDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, sourceExecution: false, automaticRepair: false },
    workshop: { state: resolution.state, source: resolution.source, absolutePathPersisted: false },
    sourceExecution: false,
    module: { id: MODULE_ID, version: MODULE_VERSION },
    handoffObservation: null,
    reference: null,
    current: null,
    drift: null,
    issues: issues.slice().sort(),
    summary: {
      receiptBoundBaselines: 0, sourceArchivesExecuted: 0, changedFilesLocalized: 0, addedFiles: 0, removedFiles: 0, modifiedFiles: 0,
      repairsApplied: 0, workshopWrites: 0, permissionsGranted: 0, trainingAdmissions: 0, runtimePromotions: 0, canonChanges: 0, worldActions: 0
    },
    state,
    authority: { workshopWrite: false, sourceExecution: false, automaticRepair: false, codeGeneration: false, permissionGrant: false, trainingAdmission: false, runtimePromotion: false, canonChange: false, worldAction: false },
    boundary: 'This read-only observation may identify changed source files only after the declared archive hash, internal archive inventory, verified receipt tree, and stable current engine are joined. It does not execute source, repair code, write Workshop files, grant permission, train, promote, change CANON, or act.'
  };
  observation.observationDigest = digest(Object.assign({}, observation, { observationDigest: null }));
  return stable(observation);
}

function observe(options = {}) {
  const resolution = WorkshopRoot.inspect(options);
  if (!resolution.available) return emptyObservation(resolution, ['WORKSHOP_ABSENT'], 'WORKSHOP_ABSENT');
  const issues = [];
  let handoffObservation = null;
  try {
    const handoff = Reader.observe(options);
    handoffObservation = { observationDigest: handoff.observationDigest, state: handoff.state, issues: handoff.issues.slice() };
  } catch (error) {
    issues.push(`HANDOFF_OBSERVATION_UNAVAILABLE:${error.message}`);
  }
  let firstContext;
  try { firstContext = readContext(resolution.root); } catch (error) { return emptyObservation(resolution, [`CONTEXT_READ_FAILED:${error.message}`], 'HOLD_UNBOUND_OR_UNSTABLE_SOURCE_EVIDENCE'); }
  if (firstContext.status.schema !== 'axm.capability-intelligence-platform-status/v1') issues.push('PLATFORM_STATUS_SCHEMA_MISMATCH');
  if (firstContext.receipt.schema !== 'axm.capability-intelligence-pipeline-receipt/v1') issues.push('PIPELINE_RECEIPT_SCHEMA_MISMATCH');
  if (!firstContext.status.selfDigestValid) issues.push('PLATFORM_STATUS_DIGEST_MISMATCH');
  if (!firstContext.receipt.selfDigestValid) issues.push('PIPELINE_RECEIPT_DIGEST_MISMATCH');
  if (!firstContext.status.receiptLinkMatches) issues.push('STATUS_RECEIPT_LINK_MISMATCH');
  if (firstContext.receipt.supplierStabilityStatus !== 'PASS') issues.push('SUPPLIER_STABILITY_RECEIPT_NOT_PASS');
  if (!same(firstContext.receipt.recordedBefore, firstContext.receipt.recordedAfter)) issues.push('RECORDED_BEFORE_AFTER_TREE_MISMATCH');
  if (firstContext.sourcePackageCandidates.length !== 1) issues.push(`SOURCE_PACKAGE_DECLARATION_COUNT:${firstContext.sourcePackageCandidates.length}`);

  let sourcePackage = null;
  let source = null;
  const declared = firstContext.sourcePackageCandidates[0] || null;
  if (declared) {
    try {
      const archivePath = Reader.contained(resolution.root, declared.path, 'capability-intelligence source package');
      const firstRead = Reader.boundedFile(archivePath, Cell.MAX_ZIP_BYTES, 'capability-intelligence source package');
      const secondRead = Reader.boundedFile(archivePath, Cell.MAX_ZIP_BYTES, 'capability-intelligence source package replay');
      if (firstRead.sha256 !== secondRead.sha256 || firstRead.bytesLength !== secondRead.bytesLength) issues.push('SOURCE_ARCHIVE_CHANGED_DURING_READ');
      sourcePackage = { relativePath: declared.path.split('\\').join('/'), declaredSha256: declared.sha256, rawSha256: `sha256:${firstRead.sha256}`, bytes: firstRead.bytesLength, stableAcrossSecondRead: firstRead.sha256 === secondRead.sha256 && firstRead.bytesLength === secondRead.bytesLength };
      if (declared.sha256 !== sourcePackage.rawSha256) issues.push('SOURCE_ARCHIVE_DECLARED_DIGEST_MISMATCH');
      source = Cell.inspectSourceArchive(firstRead.bytes);
    } catch (error) { issues.push(`SOURCE_ARCHIVE_REJECTED:${error.message}`); }
  }

  let current = null;
  try {
    const engineRoot = path.join(resolution.root, 'tools', MODULE_ID, 'engine');
    const first = Cell.inventoryDirectory(engineRoot);
    const second = Cell.inventoryDirectory(engineRoot);
    current = { files: first.files, bytes: first.bytes, treeSha256: first.treeSha256, rows: first.rows, stableAcrossSecondRead: same(first, second) };
    if (!current.stableAcrossSecondRead) issues.push('CURRENT_ENGINE_CHANGED_DURING_READ');
  } catch (error) { issues.push(`CURRENT_ENGINE_REJECTED:${error.message}`); }

  let secondContext;
  try {
    secondContext = readContext(resolution.root);
    if (!same(firstContext, secondContext)) issues.push('STATUS_OR_RECEIPT_CHANGED_DURING_READ');
  } catch (error) { issues.push(`CONTEXT_REPLAY_FAILED:${error.message}`); }

  const recorded = firstContext.receipt.recordedAfter;
  let archiveBaselineMatchesReceipt = false;
  if (source && recorded) {
    archiveBaselineMatchesReceipt = recorded.files === source.engine.files && recorded.tree_sha256 === source.engine.treeSha256;
    if (!archiveBaselineMatchesReceipt) issues.push('SOURCE_ARCHIVE_BASELINE_DOES_NOT_MATCH_RECEIPT');
  } else issues.push('SOURCE_ARCHIVE_OR_RECORDED_TREE_ABSENT');

  const binding = {
    platformStatusSelfDigestValid: firstContext.status.selfDigestValid,
    pipelineReceiptSelfDigestValid: firstContext.receipt.selfDigestValid,
    statusReceiptLinkMatches: firstContext.status.receiptLinkMatches,
    recordedBeforeAfterMatches: same(firstContext.receipt.recordedBefore, firstContext.receipt.recordedAfter),
    declaredSourceDigestMatches: Boolean(sourcePackage && sourcePackage.declaredSha256 === sourcePackage.rawSha256 && sourcePackage.stableAcrossSecondRead),
    archiveInventoryVerified: Boolean(source && source.inventory && source.inventory.verifiedFiles > 0),
    archiveBaselineMatchesReceipt,
    currentStableAcrossSecondRead: Boolean(current && current.stableAcrossSecondRead),
    contextStableAcrossSecondRead: Boolean(secondContext && same(firstContext, secondContext))
  };
  const receiptBound = Object.values(binding).every(Boolean);
  let drift = null;
  if (receiptBound && source && current) drift = Cell.compareInventories(source.engine.rows, current.rows);
  const state = receiptBound
    ? (drift.changed === 0 ? 'RECEIPT_BOUND_NO_DRIFT' : 'RECEIPT_BOUND_DRIFT_LOCALIZED')
    : 'HOLD_UNBOUND_OR_UNSTABLE_SOURCE_EVIDENCE';
  const observation = emptyObservation(resolution, issues, state);
  observation.handoffObservation = handoffObservation;
  observation.reference = {
    sourcePackage,
    archive: source ? {
      schema: source.schema, cell: source.cell, sourceExecution: source.sourceExecution, archiveEntries: source.archiveEntries, decodedFiles: source.decodedFiles,
      decodedBytes: source.decodedBytes, masterManifest: source.masterManifest, inventory: source.inventory, workingBody: source.workingBody,
      engine: { files: source.engine.files, bytes: source.engine.bytes, treeSha256: source.engine.treeSha256 }
    } : null,
    receipt: recorded ? { files: recorded.files, treeSha256: recorded.tree_sha256 } : null,
    binding,
    receiptBound
  };
  observation.current = current ? { files: current.files, bytes: current.bytes, treeSha256: current.treeSha256, stableAcrossSecondRead: current.stableAcrossSecondRead } : null;
  observation.drift = drift;
  observation.summary.receiptBoundBaselines = receiptBound ? 1 : 0;
  observation.summary.changedFilesLocalized = drift ? drift.changed : 0;
  observation.summary.addedFiles = drift ? drift.added.length : 0;
  observation.summary.removedFiles = drift ? drift.removed.length : 0;
  observation.summary.modifiedFiles = drift ? drift.modified.length : 0;
  observation.observationDigest = digest(Object.assign({}, observation, { observationDigest: null }));
  const sealed = stable(observation);
  verifyObservation(sealed);
  return sealed;
}

function verifyObservation(observation) {
  if (!observation || observation.schema !== OBSERVATION_SCHEMA || observation.observationDigest !== digest(Object.assign({}, observation, { observationDigest: null }))) throw new Error('source drift observation digest changed');
  if (!observation.organ || observation.organ.id !== ORGAN_ID || observation.organ.learnedWeights !== false || observation.organ.sourceExecution !== false || observation.organ.automaticRepair !== false) throw new Error('source drift organ boundary changed');
  if (observation.sourceExecution !== false || !observation.workshop || observation.workshop.absolutePathPersisted !== false) throw new Error('source drift read boundary changed');
  if (!observation.authority || Object.values(observation.authority).some(Boolean)) throw new Error('source drift authority changed');
  for (const key of ['sourceArchivesExecuted', 'repairsApplied', 'workshopWrites', 'permissionsGranted', 'trainingAdmissions', 'runtimePromotions', 'canonChanges', 'worldActions']) if (!observation.summary || observation.summary[key] !== 0) throw new Error(`source drift outcome boundary changed: ${key}`);
  if (observation.state === 'RECEIPT_BOUND_DRIFT_LOCALIZED' || observation.state === 'RECEIPT_BOUND_NO_DRIFT') {
    if (!observation.reference || observation.reference.receiptBound !== true || Object.values(observation.reference.binding).some(value => value !== true)) throw new Error('source drift receipt binding changed');
    if (!observation.drift || observation.summary.changedFilesLocalized !== observation.drift.changed) throw new Error('source drift classification changed');
  }
  if (observation.drift && [...observation.drift.added, ...observation.drift.removed].some(item => 'content' in item) || observation.drift && observation.drift.modified.some(item => 'content' in item.before || 'content' in item.after)) throw new Error('source drift persisted source content');
  return true;
}

function buildAssessment(observation) {
  verifyObservation(observation);
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    assessmentId: null,
    assessmentDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, sourceExecution: false, automaticRepair: false },
    source: { observationSchema: observation.schema, observationDigest: observation.observationDigest },
    observation,
    state: observation.state,
    summary: Object.assign({}, observation.summary, { privateDriftAssessmentsWritten: 1 }),
    authority: { privateDriftAssessmentWrite: true, workshopWrite: false, sourceExecution: false, automaticRepair: false, codeGeneration: false, permissionGrant: false, trainingAdmission: false, runtimePromotion: false, canonChange: false, worldAction: false },
    boundary: 'This immutable private assessment preserves one receipt-bound source drift observation. Exact changed paths are diagnosis evidence, not repair authority or proof that either version is better. No Workshop source was executed or written.'
  };
  assessment.assessmentId = `capability-intelligence-source-drift-${digest({ organId: ORGAN_ID, observationDigest: observation.observationDigest, state: observation.state }).slice(0, 24)}`;
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return stable(assessment);
}

function verifyAssessment(assessment, observation = null, runDir = null) {
  if (!assessment || assessment.schema !== ASSESSMENT_SCHEMA || assessment.assessmentDigest !== digest(Object.assign({}, assessment, { assessmentDigest: null }))) throw new Error('source drift assessment digest changed');
  verifyObservation(assessment.observation);
  const expectedId = `capability-intelligence-source-drift-${digest({ organId: ORGAN_ID, observationDigest: assessment.observation.observationDigest, state: assessment.observation.state }).slice(0, 24)}`;
  if (assessment.assessmentId !== expectedId) throw new Error('source drift assessment identity changed');
  if (!assessment.authority || Object.entries(assessment.authority).some(([key, value]) => key === 'privateDriftAssessmentWrite' ? value !== true : value !== false)) throw new Error('source drift assessment authority changed');
  if (assessment.summary.privateDriftAssessmentsWritten !== 1 || assessment.summary.repairsApplied !== 0 || assessment.summary.workshopWrites !== 0) throw new Error('source drift assessment outcome boundary changed');
  if (observation && !same(buildAssessment(observation), assessment)) throw new Error('source drift assessment content changed');
  if (runDir) {
    const directory = path.resolve(runDir);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('source drift run is not a real directory');
    if (!same(fs.readdirSync(directory).sort(), ['assessment.json'])) throw new Error('source drift run fields changed');
    const file = path.join(directory, 'assessment.json');
    const fileStat = fs.lstatSync(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error('source drift assessment is not a real file');
    if (!same(JSON.parse(fs.readFileSync(file, 'utf8')), assessment)) throw new Error('source drift assessment file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const observation = observe(options);
  const assessment = buildAssessment(observation);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const stateStat = fs.lstatSync(stateDir);
  if (!stateStat.isDirectory() || stateStat.isSymbolicLink()) throw new Error('source drift state root must be a real directory');
  const runDir = path.join(stateDir, assessment.assessmentId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'assessment.json'), 'utf8'));
    verifyAssessment(existing, observation, runDir);
    return { assessment: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${assessment.assessmentId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`source drift staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'assessment.json'), json(assessment), { flag: 'wx' });
  verifyAssessment(assessment, observation, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { assessment, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, OBSERVATION_SCHEMA, ASSESSMENT_SCHEMA, MODULE_ID, MODULE_VERSION, SOURCE_PACKAGE_BASENAME, ROOT, DEFAULT_STATE_DIR, DEFAULT_POLICY_PATH,
  loadPolicy, readContext, observe, verifyObservation, buildAssessment, verifyAssessment, run
};
