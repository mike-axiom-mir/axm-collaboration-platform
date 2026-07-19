'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const HandPlanner = require('./foundation-development-hand-planner-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-capability-survey-organ/v2';
const DECLARATION_SCHEMA = 'axm.mirror.foundation-development-capability-declaration/v2';
const BATCH_SCHEMA = 'axm.mirror.foundation-development-capability-survey-batch/v2';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CAPABILITY_DIR = path.join(ROOT, 'capabilities');
const DEFAULT_HAND_STATE_DIR = HandPlanner.DEFAULT_STATE_DIR;
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-capability-survey-runs');

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const encoded = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(encoded === undefined ? 'undefined' : encoded).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function relative(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, child);
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`foundation capability path escapes its parent: ${child}`);
  return resolved;
}
function boundedRootFile(child) {
  const resolved = path.resolve(ROOT, child);
  const rel = path.relative(ROOT, resolved);
  if (!rel || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error(`foundation capability source escapes Mirror root: ${child}`);
  return resolved;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation capability survey requires the Mirror training policy');
  if (policy.automaticFoundationDevelopmentCapabilitySurvey !== true) throw new Error('automatic foundation capability survey is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation capability survey refuses runtime, canon, or authority growth');
  if (!String(policy.foundationDevelopmentCapabilitySurveyScope || '').includes('all-declarations-no-frequency-or-first-match-selection-no-operational-fit-or-new-organ-claim')) throw new Error('foundation capability survey scope is incomplete');
  return policy;
}

function loadCurrentHandBatch(options = {}) {
  if (options.handBatch) {
    HandPlanner.verifyBatch(options.handBatch);
    return options.handBatch;
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentHandPlannerEvidence || {}).currentBatchId;
  if (!/^foundation-development-hands-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation capability survey current hand batch id is missing');
  const handStateDir = path.resolve(options.handStateDir || DEFAULT_HAND_STATE_DIR);
  const runDir = boundedChild(handStateDir, batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  HandPlanner.verifyBatch(batch, null, runDir);
  return batch;
}

function declarationDigest(declaration) {
  return digest(Object.assign({}, declaration, { declarationDigest: null }));
}

function validateDeclaration(declaration) {
  if (!declaration || declaration.schema !== DECLARATION_SCHEMA) throw new Error('capability declaration schema changed');
  if (!/^axm\.mirror\.declared-capability\/[a-z0-9-]+\/v1$/.test(String(declaration.capabilityId || ''))) throw new Error('capability declaration id changed');
  if (declaration.declarationDigest !== declarationDigest(declaration)) throw new Error('capability declaration digest changed');
  if (!declaration.implementation || !String(declaration.implementation.organId || '').trim()) throw new Error('capability declaration organ id missing');
  if (!Array.isArray(declaration.implementation.sourceFiles) || !declaration.implementation.sourceFiles.length) throw new Error('capability declaration source lineage missing');
  const sourcePaths = new Set();
  for (const source of declaration.implementation.sourceFiles) {
    if (!source || !String(source.path || '').trim() || !/^[a-f0-9]{64}$/.test(String(source.sha256 || ''))) throw new Error('capability declaration source binding changed');
    if (sourcePaths.has(source.path)) throw new Error('capability declaration repeats a source path');
    sourcePaths.add(source.path);
    const absolute = boundedRootFile(source.path);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`capability declaration source missing: ${source.path}`);
    if (digest(fs.readFileSync(absolute)) !== source.sha256) throw new Error(`capability declaration source stale: ${source.path}`);
  }
  for (const key of ['supportedHandFamilies', 'inputKinds', 'outputKinds', 'capabilityTokens']) {
    if (!Array.isArray(declaration[key]) || !declaration[key].length || new Set(declaration[key]).size !== declaration[key].length || declaration[key].some(item => !String(item || '').trim())) throw new Error(`capability declaration ${key} changed`);
  }
  if (!declaration.authority || Object.values(declaration.authority).some(value => value !== false)) throw new Error('capability declaration authority changed');
  return true;
}

function collectInventory(options = {}) {
  const capabilityDir = path.resolve(options.capabilityDir || DEFAULT_CAPABILITY_DIR);
  if (!fs.existsSync(capabilityDir) || !fs.statSync(capabilityDir).isDirectory()) return [];
  return fs.readdirSync(capabilityDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.capability.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => {
      const file = boundedChild(capabilityDir, entry.name);
      const bytes = fs.readFileSync(file);
      const record = { path: relative(file), bytes: bytes.length, sha256: digest(bytes), status: null, issue: null, declaration: null };
      try {
        record.declaration = JSON.parse(bytes.toString('utf8'));
        validateDeclaration(record.declaration);
        record.status = 'VERIFIED_DECLARATION';
      } catch (error) {
        record.status = 'REFUSED_DECLARATION';
        record.issue = String(error.message || error).slice(0, 500);
      }
      return record;
    });
}

function assessHand(hand, inventory) {
  const requiredTokens = (hand.proposedContract.requiredCapabilityTokens || []).slice().sort();
  const requiredOutputKind = hand.proposedContract.outputKind;
  const assessments = inventory.map(record => {
    if (record.status !== 'VERIFIED_DECLARATION') return {
      declarationPath: record.path,
      capabilityId: null,
      declarationStatus: record.status,
      familyMatch: false,
      inputKindMatch: false,
      outputKindMatch: false,
      requiredOutputKind,
      declaredOutputKinds: [],
      missingCapabilityTokens: requiredTokens,
      state: 'REFUSED_DECLARATION_NOT_A_COMPATIBILITY_WITNESS'
    };
    const declaration = record.declaration;
    const available = new Set(declaration.capabilityTokens);
    const missing = requiredTokens.filter(token => !available.has(token));
    const familyMatch = declaration.supportedHandFamilies.includes(hand.handFamily);
    const inputKindMatch = declaration.inputKinds.includes(hand.proposedContract.inputKind);
    const outputKindMatch = declaration.outputKinds.includes(requiredOutputKind);
    return {
      declarationPath: record.path,
      capabilityId: declaration.capabilityId,
      declarationDigest: declaration.declarationDigest,
      declarationStatus: record.status,
      familyMatch,
      inputKindMatch,
      outputKindMatch,
      requiredOutputKind,
      declaredOutputKinds: declaration.outputKinds.slice().sort(),
      requiredCapabilityTokens: requiredTokens,
      missingCapabilityTokens: missing,
      operatingMode: declaration.operatingMode,
      state: familyMatch && inputKindMatch && outputKindMatch && !missing.length
        ? 'DECLARED_EXACT_COMPATIBILITY_WITNESS_NOT_OPERATIONAL_FIT'
        : familyMatch && inputKindMatch && !outputKindMatch && !missing.length
          ? 'DECLARED_INPUT_TOKEN_COMPATIBILITY_WITNESS_REQUIRES_OUTPUT_ADAPTER'
          : 'NOT_DECLARED_COMPATIBILITY_WITNESS'
    };
  });
  const exactWitnesses = assessments.filter(item => item.state === 'DECLARED_EXACT_COMPATIBILITY_WITNESS_NOT_OPERATIONAL_FIT');
  const partialWitnesses = assessments.filter(item => item.state === 'DECLARED_INPUT_TOKEN_COMPATIBILITY_WITNESS_REQUIRES_OUTPUT_ADAPTER');
  const witnessRef = item => ({
    capabilityId: item.capabilityId,
    declarationDigest: item.declarationDigest,
    requiredOutputKind: item.requiredOutputKind,
    declaredOutputKinds: item.declaredOutputKinds
  });
  return {
    handRequestId: hand.handRequestId,
    handRequestDigest: hand.handRequestDigest,
    handFamily: hand.handFamily,
    inputKind: hand.proposedContract.inputKind,
    outputKind: requiredOutputKind,
    requiredCapabilityTokens: requiredTokens,
    assessments,
    declaredCompatibilityWitnesses: exactWitnesses.map(witnessRef).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId)),
    declaredPartialCompatibilityWitnesses: partialWitnesses.map(witnessRef).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId)),
    classification: exactWitnesses.length
      ? 'DECLARED_EXACT_COMPATIBILITY_WITNESSES_REQUIRE_INDEPENDENT_AFFORDANCE_EXAM'
      : partialWitnesses.length
        ? 'DECLARED_PARTIAL_COMPATIBILITY_WITNESSES_REQUIRE_OUTPUT_ADAPTER'
        : 'HOLD_NO_DECLARED_COMPATIBILITY_WITNESS',
    existingCapabilitySelected: false,
    operationalFit: 'UNTESTED',
    newOrganNeed: 'UNASSESSED'
  };
}

function buildBatch(handBatch, inventory) {
  HandPlanner.verifyBatch(handBatch);
  inventory = (inventory || []).slice().sort((a, b) => a.path.localeCompare(b.path));
  const results = (handBatch.hands || []).map(hand => assessHand(hand, inventory)).sort((a, b) => a.handRequestId.localeCompare(b.handRequestId));
  const exactWitnessCount = results.reduce((sum, item) => sum + item.declaredCompatibilityWitnesses.length, 0);
  const partialWitnessCount = results.reduce((sum, item) => sum + item.declaredPartialCompatibilityWitnesses.length, 0);
  const basis = { organId: ORGAN_ID, handBatchDigest: handBatch.batchDigest, inventory: inventory.map(item => ({ path: item.path, sha256: item.sha256, status: item.status })), results };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-capability-survey-${digest(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, sourceExecution: false, firstMatchSelection: false, frequencySelection: false },
    source: { handBatchId: handBatch.batchId, handBatchDigest: handBatch.batchDigest },
    inventory,
    results,
    summary: {
      evidenceHandRequests: (handBatch.hands || []).length,
      declarationsInventoried: inventory.length,
      verifiedDeclarations: inventory.filter(item => item.status === 'VERIFIED_DECLARATION').length,
      refusedDeclarations: inventory.filter(item => item.status === 'REFUSED_DECLARATION').length,
      declaredCompatibilityWitnesses: exactWitnessCount,
      declaredExactCompatibilityWitnesses: exactWitnessCount,
      declaredPartialCompatibilityWitnesses: partialWitnessCount,
      handsWithWitnesses: results.filter(item => item.declaredCompatibilityWitnesses.length).length,
      handsWithExactWitnesses: results.filter(item => item.declaredCompatibilityWitnesses.length).length,
      handsWithPartialOnlyWitnesses: results.filter(item => !item.declaredCompatibilityWitnesses.length && item.declaredPartialCompatibilityWitnesses.length).length,
      handsWithoutAnyWitnesses: results.filter(item => !item.declaredCompatibilityWitnesses.length && !item.declaredPartialCompatibilityWitnesses.length).length,
      existingCapabilitiesSelected: 0,
      operationalFitsClaimed: 0,
      newOrgansRequired: 0,
      implementationsBuilt: 0,
      evidenceAcquisitions: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      promotions: 0,
      worldActions: 0
    },
    state: !results.length ? 'NO_EVIDENCE_HANDS_TO_SURVEY'
      : exactWitnessCount ? 'DECLARED_EXACT_COMPATIBILITY_WITNESSES_RECORDED'
        : partialWitnessCount ? 'DECLARED_PARTIAL_COMPATIBILITY_WITNESSES_RECORDED'
          : 'NO_DECLARED_COMPATIBILITY_WITNESSES',
    authority: {
      privateEvaluationTraceWrite: true,
      sourceExecution: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      implementationBuild: false,
      evidenceAcquisition: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This v2 survey compares every typed hand family, input kind, output kind, and capability-token requirement with every content- and source-hash-bound declaration. Exact and output-adapter-required witnesses remain distinct. Neither is operational fit, readiness, selection, evidence, proof of organ need, permission, implementation, training, promotion, or action.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyBatch(batch, handBatch, inventory, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation capability survey batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || batch.organ.sourceExecution !== false || batch.organ.firstMatchSelection !== false || batch.organ.frequencySelection !== false) throw new Error('foundation capability survey organ boundary changed');
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => key === 'privateEvaluationTraceWrite' ? value !== true : value !== false)) throw new Error('foundation capability survey authority changed');
  if (handBatch && inventory) {
    const expected = buildBatch(handBatch, inventory);
    if (!same(expected, batch)) throw new Error('foundation capability survey content changed');
  }
  if (batch.summary.existingCapabilitiesSelected !== 0 || batch.summary.operationalFitsClaimed !== 0 || batch.summary.newOrgansRequired !== 0 || batch.summary.implementationsBuilt !== 0) throw new Error('foundation capability survey summary changed');
  if ((batch.results || []).some(item => item.existingCapabilitySelected !== false || item.operationalFit !== 'UNTESTED' || item.newOrganNeed !== 'UNASSESSED')) throw new Error('foundation capability survey result boundary changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation capability survey batch file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const handBatch = loadCurrentHandBatch(options);
  const inventory = options.inventory || collectInventory(options);
  const batch = buildBatch(handBatch, inventory);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, handBatch, inventory, runDir);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation capability survey identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation capability survey staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, handBatch, inventory, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, DECLARATION_SCHEMA, BATCH_SCHEMA, DEFAULT_CAPABILITY_DIR, DEFAULT_HAND_STATE_DIR, DEFAULT_STATE_DIR,
  loadPolicy, loadCurrentHandBatch, declarationDigest, validateDeclaration, collectInventory, assessHand, buildBatch, verifyBatch, run
};
