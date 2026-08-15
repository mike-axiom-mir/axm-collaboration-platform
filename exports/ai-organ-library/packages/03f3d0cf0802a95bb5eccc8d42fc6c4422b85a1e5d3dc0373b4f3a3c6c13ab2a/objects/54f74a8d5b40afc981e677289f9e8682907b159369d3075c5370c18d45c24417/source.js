'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const RecipeCell = require('../kernel/declarative-reasoning-organ-recipe-cell');

const ORGAN_ID = 'axm.mirror.organ/declarative-reasoning-organ-candidate-builder-v1';
const BATCH_SCHEMA = 'axm.mirror.declarative-reasoning-organ-candidate-builder-batch/v1';
const RESPONSE_SCHEMA = 'axm.mirror.declarative-reasoning-organ-candidate-builder-response/v1';
const CANDIDATE_CONTRACT_SCHEMA = 'axm.mirror.declarative-reasoning-organ-candidate-contract/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'declarative-reasoning-organ-candidate-forge-runs');
const MAX_ITEMS = 16;
const SOURCE_PATHS = Object.freeze([
  'organs/declarative-reasoning-organ-candidate-builder-organ.js',
  'organs/declarative-reasoning-organ-review-organ.js',
  'kernel/declarative-reasoning-organ-recipe-cell.js',
  'kernel/organ-admission-cell.js',
  'kernel/immutable-batch-store.js',
  'contracts/reviewed-declarative-reasoning-organ-recipe.schema.json',
  'contracts/declarative-reasoning-organ-review-response.schema.json',
  'contracts/declarative-reasoning-organ-candidate-contract.schema.json',
  'contracts/declarative-reasoning-organ-candidate-builder-batch.schema.json',
  'contracts/declarative-reasoning-organ-candidate-builder-response.schema.json'
]);
const GENERATION_CONTRACT = Object.freeze({
  version: 'reviewed-structural-features-to-isolated-epistemic-path-candidate-v1',
  reviewedRecipeRequired: true,
  supportedLanguage: RecipeCell.LANGUAGE_KIND,
  supportedInputSchema: RecipeCell.INPUT_SCHEMA,
  supportedOutputSchema: RecipeCell.OUTPUT_SCHEMA,
  generatedFiles: ['organ.js', 'contract.json', 'recipe.json', 'selftest.js'],
  candidateRoot: 'ignored-private-state-only',
  inputProseRead: false,
  schemaSelectedPositiveStructuralFactsOnly: true,
  outputKinds: ['ask', 'observe', 'hold'],
  pathSelection: false,
  toolRequest: false,
  permissionRequirement: false,
  heldOutFixtureAuthoring: false,
  heldOutEvaluation: false,
  install: false,
  load: false,
  trainingAdmission: false,
  runtimePromotion: false,
  canonChange: false,
  worldAction: false
});

function stable(value) { return RecipeCell.stable(value); }
function digest(value) { return RecipeCell.digest(value); }
function clone(value) { return RecipeCell.clone(value); }
function same(left, right) { return RecipeCell.same(left, right); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function inside(root, target) { const relation = path.relative(path.resolve(root), path.resolve(target)); return !!relation && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation); }
function relative(root, target) { return path.relative(root, target).replace(/\\/g, '/'); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter(key => !expected.has(key));
  const missing = keys.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (unexpected.length || missing.length) throw new Error(`${label} fields changed: unexpected=${unexpected.join(',') || 'none'} missing=${missing.join(',') || 'none'}`);
}

function sourceLineage(root = ROOT) {
  return SOURCE_PATHS.map(sourcePath => {
    const bytes = fs.readFileSync(path.join(root, sourcePath));
    return { path: sourcePath, bytes: bytes.length, sha256: digest(bytes) };
  });
}

function loadPolicy(options = {}) {
  const file = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('declarative organ candidate forge requires the Mirror training policy');
  if (policy.automaticDeclarativeReasoningOrganCandidateBuilding !== false || policy.automaticDeclarativeReasoningOrganCandidateForgeEmptyBatch !== true) throw new Error('declarative organ candidate forge policy must require explicit review and permit only the automatic empty batch');
  if (!String(policy.explicitDeclarativeReasoningOrganCandidateForgeScope || '').includes('exact-reconstructable-propose-build-assessment')) throw new Error('declarative organ candidate forge policy scope is incomplete');
  if (policy.automaticOrganInstallation !== false || policy.automaticAuthorityGrowth !== false || policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false) throw new Error('declarative organ candidate forge refuses automatic installation, authority, runtime, or CANON growth');
  return policy;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new Error(`declarative organ candidate forge accepts at most ${MAX_ITEMS} reviewed items`);
  const output = items.map((item, index) => {
    exactKeys(item, ['admissionInput', 'assessment', 'recipe'], `declarative organ candidate source ${index}`);
    RecipeCell.verifyRecipe(item.recipe, item.assessment, item.admissionInput);
    return { admissionInput: clone(item.admissionInput), assessment: clone(item.assessment), recipe: clone(item.recipe) };
  }).sort((left, right) => left.recipe.recipeId.localeCompare(right.recipe.recipeId));
  const recipeIds = output.map(item => item.recipe.recipeId);
  const assessmentIds = output.map(item => item.assessment.assessmentId);
  if (new Set(recipeIds).size !== recipeIds.length || new Set(assessmentIds).size !== assessmentIds.length) throw new Error('declarative organ candidate forge sources must bind unique recipes and assessments');
  return output;
}

function informationValue(value) { return value === 'LOW' ? 0.25 : value === 'HIGH' ? 0.75 : 0.5; }

function candidateBasis(item, lineage) {
  return {
    generationContract: GENERATION_CONTRACT,
    sourceLineage: lineage,
    assessmentId: item.assessment.assessmentId,
    assessmentDigest: item.assessment.assessmentDigest,
    proposalId: item.assessment.buildProposal.proposalId,
    targetSeamId: item.assessment.buildProposal.targetSeamId,
    targetContract: item.assessment.proposedContract,
    recipeId: item.recipe.recipeId,
    recipeDigest: item.recipe.recipeDigest,
    language: item.recipe.language
  };
}

function contractDocument(candidateId, item) {
  return {
    schema: CANDIDATE_CONTRACT_SCHEMA,
    candidateId,
    targetOrganId: item.assessment.proposedContract.organId,
    targetSeamId: item.assessment.buildProposal.targetSeamId,
    sourceAdmission: { assessmentId: item.assessment.assessmentId, assessmentDigest: item.assessment.assessmentDigest, proposalId: item.assessment.buildProposal.proposalId },
    sourceRecipe: { recipeId: item.recipe.recipeId, recipeDigest: item.recipe.recipeDigest },
    interface: {
      export: 'originate',
      inputSchema: RecipeCell.INPUT_SCHEMA,
      structuralProjectionSchema: 'axm.mirror.reasoning-structural-feature-projection/v1',
      outputSchema: RecipeCell.OUTPUT_SCHEMA,
      targetContractConformance: 'UNTESTED_REQUIRES_INDEPENDENT_EXAM',
      projectionSourceReconstruction: 'NOT_PERFORMED_BY_CANDIDATE'
    },
    status: 'ISOLATED_CANDIDATE_NOT_INSTALLED',
    heldOutExam: clone(item.recipe.heldOutExam),
    authority: {
      proposalOnly: true,
      sourceRead: false,
      pathSelection: false,
      toolUse: false,
      permissionGrant: false,
      memoryWrite: false,
      trainingAdmission: false,
      install: false,
      load: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false,
      worldAction: false
    },
    boundary: 'This ignored-state candidate maps separately supplied content-sealed positive structural facts to non-mutating epistemic path profiles. It does not reconstruct the projection source, read prose, select a path, execute, pass a held-out exam, install, load, train, grant, promote, change CANON, or act.'
  };
}

function organSource(candidateId, item) {
  const language = JSON.stringify(stable(item.recipe.language));
  const targetOrganId = JSON.stringify(item.assessment.proposedContract.organId);
  const assessmentId = JSON.stringify(item.assessment.assessmentId);
  const assessmentDigest = JSON.stringify(item.assessment.assessmentDigest);
  const recipeId = JSON.stringify(item.recipe.recipeId);
  const recipeDigest = JSON.stringify(item.recipe.recipeDigest);
  return `'use strict';

const crypto = require('crypto');

const CANDIDATE_ID = ${JSON.stringify(candidateId)};
const TARGET_ORGAN_ID = ${targetOrganId};
const ASSESSMENT_ID = ${assessmentId};
const ASSESSMENT_DIGEST = ${assessmentDigest};
const RECIPE_ID = ${recipeId};
const RECIPE_DIGEST = ${recipeDigest};
const LANGUAGE = Object.freeze(${language});
const PROBLEM_KEYS = Object.freeze(['schema','goal','observations','assertions','derived','predictions','assumptions','unknowns','constraints','permissions','evidenceRefs','contradictions','authority']);
const FORBIDDEN_FEATURE_PARTS = Object.freeze(${JSON.stringify(RecipeCell.FORBIDDEN_FEATURE_PARTS)});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function exactRoot(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter(key => !expected.has(key));
  const missing = keys.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (unexpected.length || missing.length) throw new Error(label + ' root fields changed');
}
function verifyProblemState(value) {
  exactRoot(value, PROBLEM_KEYS, 'reasoning problem state');
  if (value.schema !== 'axm.mirror.reasoning-state/v1' || value.authority !== 'NONE') throw new Error('reasoning problem state contract changed');
  for (const key of ['observations','assertions','derived','predictions','assumptions','unknowns','constraints','permissions','evidenceRefs','contradictions']) if (!Array.isArray(value[key])) throw new Error('reasoning problem state bounded arrays changed');
  return true;
}
function verifyProjection(value) {
  if (!value || value.schema !== 'axm.mirror.reasoning-structural-feature-projection/v1' || value.projectionDigest !== digest(Object.assign({}, value, { projectionDigest: null }))) throw new Error('structural projection seal changed');
  if (!value.policy || value.policy.schemaSelectedPathsOnly !== true || value.policy.finiteMachineValuesOnly !== true || value.policy.unselectedFieldsIgnored !== true || value.policy.proseCanBecomeFeature !== false || value.policy.identifiersCanBecomeFeature !== false) throw new Error('structural projection policy changed');
  if (!value.source || value.source.fullSourcePersisted !== false || value.source.proseFieldsRead !== 0 || value.source.idsRead !== 0) throw new Error('structural projection source boundary changed');
  if (!value.authority || Object.entries(value.authority).some(([key, item]) => key === 'sourceRead' ? item !== true : item !== false)) throw new Error('structural projection authority changed');
  if (!Array.isArray(value.features) || value.features.some(item => !/^structural-fact:[a-z0-9._:/-]+$/.test(String(item)) || FORBIDDEN_FEATURE_PARTS.some(part => String(item).includes(part)))) throw new Error('candidate accepts only positive non-prose non-identity structural facts');
  if (JSON.stringify(Array.from(new Set(value.features)).sort()) !== JSON.stringify(value.features)) throw new Error('structural features must be unique and sorted');
  return true;
}
function action(rule) {
  return {
    id: ('declarative-' + rule.ruleId).slice(0, 120),
    kind: rule.actionKind.toLowerCase(),
    label: 'Review isolated structural rule candidate: ' + rule.ruleId + '.',
    requiredPermissions: [],
    supportingEvidence: [],
    preconditionEvidence: [],
    expectedEffects: ['Produce or request bounded information that may close one reasoning seam.'],
    possibleSideEffects: ['The reviewed structural mapping may fail outside its independent exam.'],
    reversible: true,
    recovery: 'No world mutation occurs; preserve the failed candidate and return to HOLD.',
    risk: 'low'
  };
}
function profile(rule) {
  const candidateAction = action(rule);
  const value = rule.informationValue === 'LOW' ? 0.25 : rule.informationValue === 'HIGH' ? 0.75 : 0.5;
  return {
    pathId: ('declarative-path-' + rule.ruleId).slice(0, 120),
    actionId: candidateAction.id,
    approach: 'Evaluate the reviewed structural rule ' + rule.ruleId + ' through the Reasoning Foundation and an independent exam.',
    questionIds: [],
    requiredEvidence: [],
    requiredPermissions: [],
    toolRequest: null,
    estimatedCost: rule.estimatedCost,
    informationValue: value,
    reversible: true,
    failureConditions: ['Structural applicability does not establish outcome correctness or transfer.'],
    strategyTags: rule.strategyTags.slice(),
    source: 'REVIEWED_DECLARATIVE_ISOLATED_CANDIDATE',
    candidateAction
  };
}
function originate(problemState, structuralProjection) {
  verifyProblemState(problemState);
  verifyProjection(structuralProjection);
  const features = new Set(structuralProjection.features);
  const matched = LANGUAGE.rules.filter(rule => rule.requiresAll.every(item => features.has(item)) && !rule.forbidsAny.some(item => features.has(item)));
  const profiles = matched.map(profile);
  return {
    schema: 'axm.mirror.reasoning-path-set/v1',
    profiles,
    comparisons: [],
    selectedPathId: null,
    selectedActionId: null,
    state: 'HOLD',
    selectionReason: profiles.length ? 'Isolated candidate profiles were originated but no path was selected; Foundation and independent held-out evaluation remain required.' : 'No reviewed structural rule matched; HOLD is preserved.',
    inputOrderAuthority: false,
    strategyGuidance: {
      mode: 'NONE',
      featureSource: 'CANDIDATE_ORIGIN_LEGACY_PLUS_SCHEMA_SELECTED_MACHINE_PROJECTION',
      problemFeatures: structuralProjection.features.slice(),
      structuralProjection: clone(structuralProjection),
      prediction: null,
      activeRuntimeAuthority: false
    }
  };
}
function sealBuilderCanaryProjection(features) {
  const ordered = Array.from(new Set(features)).sort();
  const value = {
    schema: 'axm.mirror.reasoning-structural-feature-projection/v1',
    projectionId: 'builder-canary-' + digest(ordered).slice(0, 24),
    projectionDigest: null,
    organ: { id: 'axm.mirror.organ/declarative-candidate-builder-canary', status: 'SYNTHETIC_BUILDER_CANARY', learnedWeights: false },
    selector: { schema: 'axm.mirror.structural-feature-selector/v1', selectorId: 'builder-canary', selectorDigest: digest(ordered), sourceSchema: 'axm.mirror.reasoning-feature-source/v1', rules: ordered.length },
    source: { schema: 'axm.mirror.reasoning-feature-source/v1', selectionDigest: digest(ordered), fullSourcePersisted: false, proseFieldsRead: 0, idsRead: 0 },
    observations: [], features: ordered, negativeFeatures: [], unknowns: [],
    summary: { rules: ordered.length, rulesObserved: ordered.length, positiveStructuralFeatures: ordered.length, nonPositiveStructuralFeatures: 0, proseFieldsRead: 0, idsRead: 0, decisionsMade: 0, permissionsGranted: 0, trainingAdmissions: 0, worldActions: 0 },
    policy: { schemaSelectedPathsOnly: true, finiteMachineValuesOnly: true, unselectedFieldsIgnored: true, proseCanBecomeFeature: false, identifiersCanBecomeFeature: false, selectorChangeRequiresNewDigest: true },
    authority: { activeRuntime: false, sourceRead: true, semanticTruthWrite: false, evidenceAdmission: false, decisionAuthority: false, permissionGrant: false, trainingAdmission: false, toolUse: false, runtimePromotion: false, canonChange: false, worldAction: false },
    boundary: 'Synthetic builder canary projection only; not source-reconstructed evidence.'
  };
  value.projectionDigest = digest(Object.assign({}, value, { projectionDigest: null }));
  return value;
}

module.exports = { CANDIDATE_ID, TARGET_ORGAN_ID, ASSESSMENT_ID, ASSESSMENT_DIGEST, RECIPE_ID, RECIPE_DIGEST, LANGUAGE, stable, digest, verifyProblemState, verifyProjection, originate, sealBuilderCanaryProjection };
`;
}

function selftestSource() {
  return `'use strict';

const assert = require('node:assert/strict');
const Candidate = require('./organ');

function problemState() {
  return {
    schema: 'axm.mirror.reasoning-state/v1',
    goal: { id: 'builder-canary-goal', statement: 'This prose is not inspected by the candidate.' },
    observations: [], assertions: [], derived: [], predictions: [], assumptions: [], unknowns: [], constraints: [], permissions: [], evidenceRefs: [], contradictions: [], authority: 'NONE'
  };
}

const first = Candidate.LANGUAGE.rules[0];
const projection = Candidate.sealBuilderCanaryProjection(first.requiresAll);
const output = Candidate.originate(problemState(), projection);
assert.equal(output.schema, 'axm.mirror.reasoning-path-set/v1');
assert.equal(output.state, 'HOLD');
assert.equal(output.selectedPathId, null);
assert.equal(output.selectedActionId, null);
assert.ok(output.profiles.length >= 1);
assert.ok(output.profiles.every(item => item.toolRequest === null && item.requiredPermissions.length === 0 && item.candidateAction.requiredPermissions.length === 0));

const reversed = Candidate.sealBuilderCanaryProjection(first.requiresAll.slice().reverse());
assert.deepEqual(Candidate.originate(problemState(), reversed), output);

const unmatched = Candidate.originate(problemState(), Candidate.sealBuilderCanaryProjection(['structural-fact:builder-canary:unmatched:true']));
assert.equal(unmatched.profiles.length, 0);
assert.equal(unmatched.state, 'HOLD');

output.profiles[0].candidateAction.label = 'mutated';
assert.notEqual(Candidate.originate(problemState(), projection).profiles[0].candidateAction.label, 'mutated');
assert.throws(() => Candidate.originate(problemState(), Candidate.sealBuilderCanaryProjection(['structural-negative:builder-canary:bad:true'])), /positive/);
assert.throws(() => Candidate.originate(problemState(), Candidate.sealBuilderCanaryProjection(['structural-fact:builder-canary:item.id:value'])), /non-prose non-identity/);
assert.throws(() => Candidate.originate(Object.assign(problemState(), { hiddenReasoning: 'forbidden' }), projection), /root fields changed/);

process.stdout.write(JSON.stringify({ schema: 'axm.mirror.declarative-organ-builder-canary/v1', pass: 7, fail: 0 }) + '\\n');
`;
}

function candidatePlan(item, lineage) {
  const basis = candidateBasis(item, lineage);
  const candidateId = `declarative-reasoning-organ-candidate-${digest(basis).slice(0, 24)}`;
  const files = {
    'organ.js': organSource(candidateId, item),
    'contract.json': json(contractDocument(candidateId, item)),
    'recipe.json': json(item.recipe),
    'selftest.js': selftestSource()
  };
  const fileSeals = Object.keys(files).sort().map(name => ({ name, bytes: Buffer.byteLength(files[name]), sha256: digest(Buffer.from(files[name])) }));
  const candidate = {
    candidateId,
    candidateDigest: digest({ basis, fileSeals }),
    directory: `candidates/${candidateId}`,
    state: 'ISOLATED_DECLARATIVE_ORGAN_CANDIDATE_BUILDER_CANARIES_PENDING_HELD_OUT_NOT_RUN_NOT_INSTALLED',
    targetOrganId: item.assessment.proposedContract.organId,
    targetSeamId: item.assessment.buildProposal.targetSeamId,
    sourceAdmission: { assessmentId: item.assessment.assessmentId, assessmentDigest: item.assessment.assessmentDigest, proposalId: item.assessment.buildProposal.proposalId },
    sourceRecipe: { recipeId: item.recipe.recipeId, recipeDigest: item.recipe.recipeDigest },
    files: fileSeals,
    heldOutExam: clone(item.recipe.heldOutExam),
    installed: false,
    loaded: false
  };
  return { basis, candidate, files };
}

function writeCandidate(stageDir, plan) {
  const directory = path.join(stageDir, plan.candidate.directory);
  if (!inside(stageDir, directory)) throw new Error('declarative organ candidate directory escaped the private batch');
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, content] of Object.entries(plan.files)) fs.writeFileSync(path.join(directory, name), content, { flag: 'wx' });
  return directory;
}

function staticAudit(plan) {
  const source = plan.files['organ.js'];
  const forbidden = [
    /require\(['"](?:fs|child_process|net|http|https|tls|dgram|worker_threads)['"]\)/,
    /process\.(?:env|exit|kill|binding)/,
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\bfetch\s*\(/,
    /\bWebSocket\b/
  ];
  const holds = forbidden.filter(pattern => pattern.test(source)).map(pattern => String(pattern));
  const contract = JSON.parse(plan.files['contract.json']);
  if (!contract.authority || Object.entries(contract.authority).some(([key, value]) => key === 'proposalOnly' ? value !== true : value !== false)) holds.push('candidate contract authority changed');
  if (contract.interface.targetContractConformance !== 'UNTESTED_REQUIRES_INDEPENDENT_EXAM' || contract.heldOutExam.state !== 'NOT_RUN_REQUIRES_INDEPENDENT_EVALUATOR') holds.push('candidate held-out ceiling changed');
  return { state: holds.length ? 'HOLD_STATIC_AUTHORITY_AUDIT' : 'PASS_STATIC_AUTHORITY_AUDIT', holds, filesInspected: 4, sourceExecutions: 0, pathSelections: 0, installs: 0 };
}

function runCanaries(candidateDir) {
  const result = childProcess.spawnSync(process.execPath, [path.join(candidateDir, 'selftest.js')], {
    cwd: candidateDir,
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
    env: { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || '' }
  });
  let parsed = null;
  try { parsed = JSON.parse(String(result.stdout || '').trim()); } catch (_) {}
  const pass = result.status === 0 && !result.error && parsed && parsed.schema === 'axm.mirror.declarative-organ-builder-canary/v1' && parsed.pass === 7 && parsed.fail === 0;
  return {
    schema: 'axm.mirror.declarative-reasoning-organ-builder-canary-receipt/v1',
    state: pass ? 'PASS_BUILDER_CANARIES_NOT_HELD_OUT' : 'FAIL_BUILDER_CANARIES_NOT_HELD_OUT',
    processStatus: Number.isInteger(result.status) ? result.status : null,
    testsPassed: pass ? 7 : 0,
    testsFailed: pass ? 0 : 1,
    stdoutDigest: digest(String(result.stdout || '')),
    stderrDigest: digest(String(result.stderr || '')),
    timeout: !!(result.error && result.error.code === 'ETIMEDOUT'),
    candidateSourceExecuted: true,
    syntheticBuilderCanariesOnly: true,
    heldOutFixturesAuthored: 0,
    heldOutCasesExecuted: 0,
    heldOutFitEstablished: false,
    targetContractConformanceEstablished: false,
    installed: false,
    loadedIntoRuntime: false
  };
}

function expectedSummary(results) {
  const candidates = results.filter(item => item.candidate);
  const passed = candidates.filter(item => item.staticAudit.state === 'PASS_STATIC_AUTHORITY_AUDIT' && item.canaryReceipt.state === 'PASS_BUILDER_CANARIES_NOT_HELD_OUT');
  return {
    reviewedRecipes: results.length,
    approvedRecipes: candidates.length,
    heldRecipes: results.length - candidates.length,
    candidatesBuilt: candidates.length,
    candidateFilesGenerated: candidates.reduce((sum, item) => sum + item.candidate.files.length, 0),
    staticAuthorityAuditsPassed: passed.length,
    builderCanarySuitesPassed: passed.length,
    builderCanaryCasesPassed: passed.reduce((sum, item) => sum + item.canaryReceipt.testsPassed, 0),
    builderCanaryCasesFailed: candidates.reduce((sum, item) => sum + item.canaryReceipt.testsFailed, 0),
    heldOutFixturesAuthored: 0,
    heldOutCasesExecuted: 0,
    heldOutFitsEstablished: 0,
    targetContractConformanceClaims: 0,
    pathSelections: 0,
    toolCalls: 0,
    permissionGrants: 0,
    trainingAdmissions: 0,
    candidatesInstalled: 0,
    candidatesLoaded: 0,
    runtimePromotions: 0,
    canonChanges: 0,
    worldActions: 0
  };
}

function batchAuthority() {
  return {
    privateCandidateWrite: true,
    isolatedBuilderCanaryExecution: true,
    humanDecision: false,
    heldOutFixtureAuthoring: false,
    heldOutEvaluation: false,
    targetContractConformanceClaim: false,
    pathSelection: false,
    toolUse: false,
    permissionGrant: false,
    trainingAdmission: false,
    install: false,
    load: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false,
    worldAction: false
  };
}

function verifyCandidate(result, item, runDir, lineage) {
  const expected = candidatePlan(item, lineage);
  if (!result.candidate || result.candidate.candidateId !== expected.candidate.candidateId || result.candidate.candidateDigest !== expected.candidate.candidateDigest || !same(result.candidate.files, expected.candidate.files)) throw new Error('declarative organ candidate identity or file plan changed');
  if (!same(result.staticAudit, staticAudit(expected)) || result.staticAudit.state !== 'PASS_STATIC_AUTHORITY_AUDIT') throw new Error('declarative organ candidate static authority audit changed');
  if (result.candidate.heldOutExam.state !== 'NOT_RUN_REQUIRES_INDEPENDENT_EVALUATOR' || result.candidate.installed !== false || result.candidate.loaded !== false) throw new Error('declarative organ candidate claim ceiling changed');
  if (runDir) {
    const directory = path.join(runDir, result.candidate.directory);
    if (!inside(runDir, directory)) throw new Error('stored declarative organ candidate escaped its batch');
    for (const seal of expected.candidate.files) {
      const file = path.join(directory, seal.name);
      const stat = fs.lstatSync(file);
      const bytes = fs.readFileSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || bytes.length !== seal.bytes || digest(bytes) !== seal.sha256) throw new Error(`declarative organ candidate file hash mismatch: ${seal.name}`);
      if (bytes.toString('utf8') !== expected.files[seal.name]) throw new Error(`declarative organ candidate file content mismatch: ${seal.name}`);
    }
    const canary = runCanaries(directory);
    if (!same(result.canaryReceipt, canary) || canary.state !== 'PASS_BUILDER_CANARIES_NOT_HELD_OUT') throw new Error('declarative organ candidate builder canary receipt mismatch');
  }
  return true;
}

function verifyBatch(batch, sourceItems = null, runDir = null, root = ROOT) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('declarative organ candidate builder batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || batch.organ.status !== 'TEST_REVIEW_BOUND_ISOLATED_CANDIDATE_FORGE') throw new Error('declarative organ candidate builder identity changed');
  if (!same(batch.generationContract, GENERATION_CONTRACT)) throw new Error('declarative organ candidate generation contract changed');
  const authority = batchAuthority();
  if (!same(batch.authority, authority)) throw new Error('declarative organ candidate builder authority changed');
  const lineage = sourceLineage(root);
  if (!same(batch.sourceLineage, lineage)) throw new Error('declarative organ candidate builder source lineage changed');
  const items = sourceItems ? normalizeItems(sourceItems) : batch.results.map(item => item.source);
  if (batch.inputsDigest !== digest({ sourceLineage: lineage, items })) throw new Error('declarative organ candidate builder inputs digest changed');
  if (items.length !== batch.results.length) throw new Error('declarative organ candidate builder source/result count changed');
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const result = batch.results[index];
    if (!same(result.source, item) || result.recipeId !== item.recipe.recipeId || result.assessmentId !== item.assessment.assessmentId) throw new Error('declarative organ candidate source binding changed');
    RecipeCell.verifyRecipe(item.recipe, item.assessment, item.admissionInput);
    if (item.recipe.decision === 'HOLD') {
      if (result.candidate !== null || result.staticAudit !== null || result.canaryReceipt !== null || result.state !== 'HELD_REVIEW_NO_CANDIDATE_BYTES') throw new Error('HOLD declarative organ recipe created candidate evidence');
    } else {
      verifyCandidate(result, item, runDir, lineage);
      if (result.state !== 'ISOLATED_DECLARATIVE_ORGAN_CANDIDATE_BUILDER_CANARIES_PASS_HELD_OUT_NOT_RUN_NOT_INSTALLED') throw new Error('declarative organ candidate result state changed');
    }
  }
  if (!same(batch.summary, expectedSummary(batch.results))) throw new Error('declarative organ candidate builder summary changed');
  const expectedState = batch.summary.candidatesBuilt ? 'ISOLATED_DECLARATIVE_ORGAN_CANDIDATES_BUILT_HELD_OUT_NOT_RUN_NOT_INSTALLED' : batch.summary.reviewedRecipes ? 'REVIEWED_DECLARATIVE_ORGAN_RECIPES_HELD_NO_CANDIDATES' : 'NO_REVIEWED_DECLARATIVE_ORGAN_RECIPES_SUBMITTED';
  if (batch.state !== expectedState) throw new Error('declarative organ candidate builder batch state changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('stored declarative organ candidate builder batch changed');
  }
  return true;
}

function derive(options = {}) {
  loadPolicy(options);
  const root = path.resolve(options.root || ROOT);
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'declarative-reasoning-organ-candidate-forge-runs'));
  if (!inside(root, stateDir)) throw new Error('declarative organ candidate forge state must stay inside the Mirror root');
  const items = normalizeItems(options.items || []);
  const lineage = sourceLineage(root);
  const inputsDigest = digest({ sourceLineage: lineage, items });
  const batchId = `declarative-reasoning-organ-candidates-${inputsDigest.slice(0, 24)}`;
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batchId);
  if (fs.existsSync(runDir)) {
    const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(batch, items, runDir, root);
    return { batch, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error('declarative organ candidate forge staging directory already exists');
  fs.mkdirSync(stageDir, { recursive: true });
  const results = [];
  for (const item of items) {
    const base = { recipeId: item.recipe.recipeId, assessmentId: item.assessment.assessmentId, source: clone(item) };
    if (item.recipe.decision === 'HOLD') {
      results.push(Object.assign(base, { state: 'HELD_REVIEW_NO_CANDIDATE_BYTES', candidate: null, staticAudit: null, canaryReceipt: null }));
      continue;
    }
    const plan = candidatePlan(item, lineage);
    const audit = staticAudit(plan);
    if (audit.state !== 'PASS_STATIC_AUTHORITY_AUDIT') throw new Error(`declarative organ candidate static audit held: ${audit.holds.join(', ')}`);
    const candidateDir = writeCandidate(stageDir, plan);
    const canaryReceipt = runCanaries(candidateDir);
    if (canaryReceipt.state !== 'PASS_BUILDER_CANARIES_NOT_HELD_OUT') throw new Error('declarative organ candidate builder canaries failed');
    plan.candidate.state = 'ISOLATED_DECLARATIVE_ORGAN_CANDIDATE_BUILDER_CANARIES_PASS_HELD_OUT_NOT_RUN_NOT_INSTALLED';
    results.push(Object.assign(base, { state: plan.candidate.state, candidate: plan.candidate, staticAudit: audit, canaryReceipt }));
  }
  const summary = expectedSummary(results);
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_REVIEW_BOUND_ISOLATED_CANDIDATE_FORGE', learnedWeights: false },
    cell: { id: RecipeCell.CELL_ID, recipeSchema: RecipeCell.RECIPE_SCHEMA, learnedWeights: false },
    generationContract: clone(GENERATION_CONTRACT),
    sourceLineage: lineage,
    results,
    summary,
    state: summary.candidatesBuilt ? 'ISOLATED_DECLARATIVE_ORGAN_CANDIDATES_BUILT_HELD_OUT_NOT_RUN_NOT_INSTALLED' : summary.reviewedRecipes ? 'REVIEWED_DECLARATIVE_ORGAN_RECIPES_HELD_NO_CANDIDATES' : 'NO_REVIEWED_DECLARATIVE_ORGAN_RECIPES_SUBMITTED',
    authority: batchAuthority(),
    boundary: 'Only an exact reconstructable PROPOSE_BUILD assessment plus an attributed HUMAN-reviewed closed structural recipe may create deterministic bytes under ignored private state and run seven synthetic builder canaries. Builder canaries prove construction mechanics only. No held-out fixture is authored or run, no target fit or contract conformance is claimed, and no candidate is selected, installed, loaded, trained, promoted, made CANON, or allowed to act.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, items, stageDir, root);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

function respond(batchOrDerived) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    state: batch.state,
    summary: clone(batch.summary),
    candidates: batch.results.filter(item => item.candidate).map(item => ({
      candidateId: item.candidate.candidateId,
      candidateDigest: item.candidate.candidateDigest,
      targetOrganId: item.candidate.targetOrganId,
      state: item.state,
      builderCanaries: item.canaryReceipt.state,
      heldOutExam: item.candidate.heldOutExam.state,
      installed: false,
      loaded: false
    })),
    holds: batch.results.filter(item => !item.candidate).map(item => ({ recipeId: item.recipeId, assessmentId: item.assessmentId, state: item.state })),
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, RESPONSE_SCHEMA, CANDIDATE_CONTRACT_SCHEMA, ROOT, DEFAULT_STATE_DIR, MAX_ITEMS,
  SOURCE_PATHS, GENERATION_CONTRACT, stable, digest, clone, same, sourceLineage, loadPolicy, normalizeItems,
  informationValue, candidateBasis, contractDocument, organSource, selftestSource, candidatePlan, staticAudit,
  runCanaries, expectedSummary, batchAuthority, verifyCandidate, verifyBatch, derive, respond
};
