'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const ReadinessHands = require('./reasoning-readiness-hand-organ');
const HandoffGraph = require('./reasoning-handoff-graph-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/reasoning-readiness-probe-affordance-planner-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-readiness-probe-affordance-batch/v1';
const ASSESSMENT_SCHEMA = 'axm.mirror.readiness-probe-affordance-assessment/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-readiness-probe-affordance-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-readiness-probe-affordance-response/v1';
const MAX_HANDS = 128;
const MAX_SERVICE_CONTRACTS = 512;
const AFFORDANCE_CONTRACT = Object.freeze({
  version: 'exact-provider-declaration-to-review-packet-v2',
  moduleRule: 'verified manifest-bound axm.module-contract/v1 with exact requirement ID and existing declared entry',
  sharedServiceRule: 'axm.shared-service-contract/v1 with exact requirement ID under shared',
  foundationServiceRule: 'axm.foundation-service-plane/v1 with exact unique requirement ID membership under shared',
  consumerBindingAloneIsProviderEvidence: false,
  folderOrFilenameResemblanceIsProviderEvidence: false,
  proposalKinds: ['DECLARED_MODULE_AVAILABLE', 'DECLARED_SHARED_SERVICE_AVAILABLE', 'DECLARED_FOUNDATION_SERVICE_AVAILABLE'],
  positiveStateCeiling: 'AVAILABLE',
  failureState: 'UNKNOWN',
  humanReviewRequired: true,
  candidateBuild: false,
  liveExecution: false,
  workshopWrite: false,
  install: false,
  automaticStart: false,
  automaticRepair: false,
  permissionGrant: false,
  trainingAdmission: false,
  runtimePromotion: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function inside(root, target) { const rel = path.relative(path.resolve(root), path.resolve(target)); return !!rel && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }
function token(value, maximum = 160) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/reasoning-foundation'),
    require.resolve('../kernel/seam-cell'),
    require.resolve('../kernel/contract-manifest-binding-cell'),
    require.resolve('./reasoning-readiness-hand-organ'),
    require.resolve('./reasoning-handoff-graph-organ'),
    path.join(root, 'contracts', 'reasoning-readiness-probe-affordance-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-probe-affordance-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-probe-affordance-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function safeRelative(value) {
  const result = token(value, 500).replace(/\\/g, '/');
  if (!result || result.startsWith('/') || /^[a-z]:/i.test(result) || result.split('/').some(part => !part || part === '.' || part === '..')) return null;
  return result;
}

function resolvedRegularFile(root, relativePath, maximumBytes = 2 * 1024 * 1024) {
  const safe = safeRelative(relativePath);
  if (!safe) throw new Error('declaration path is not a normalized relative path');
  const resolvedRoot = path.resolve(root);
  const rootStat = fs.lstatSync(resolvedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('declaration root is not a real directory');
  let cursor = resolvedRoot;
  for (const part of safe.split('/')) {
    cursor = path.join(cursor, part);
    const item = fs.lstatSync(cursor);
    if (item.isSymbolicLink()) throw new Error('declaration path crosses a symbolic link');
  }
  const realRoot = fs.realpathSync(resolvedRoot);
  const realFile = fs.realpathSync(cursor);
  const rel = path.relative(realRoot, realFile);
  if (!rel || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('declaration path leaves its root');
  const stat = fs.statSync(realFile);
  if (!stat.isFile() || stat.size > maximumBytes) throw new Error('declaration target is not a bounded regular file');
  return { file: realFile, relativePath: relative(resolvedRoot, realFile), bytes: fs.readFileSync(realFile) };
}

function moduleEvidence(record, workshopRoot, requirementId) {
  if (!record || record.moduleId !== requirementId || !record.bindingReceipt || record.bindingReceipt.verdict !== 'PASS' || record.bindingReceipt.bound !== true) return null;
  const manifestFile = resolvedRegularFile(workshopRoot, record.manifestRelativePath);
  const contractFile = resolvedRegularFile(workshopRoot, record.contractRelativePath);
  if (digest(manifestFile.bytes) !== record.manifestSha256 || digest(contractFile.bytes) !== record.contractSha256) throw new Error(`manifest-bound declaration drifted for ${requirementId}`);
  const manifest = JSON.parse(manifestFile.bytes.toString('utf8'));
  const contract = JSON.parse(contractFile.bytes.toString('utf8'));
  if (!manifest || manifest.id !== requirementId || !contract || contract.schema !== 'axm.module-contract/v1' || contract.id !== requirementId) throw new Error(`module declaration IDs or schema changed for ${requirementId}`);
  const declaredContract = safeRelative(manifest.contract);
  const declaredEntry = safeRelative(manifest.entry);
  if (!declaredContract || !declaredEntry) throw new Error(`module declaration has unsafe contract or entry for ${requirementId}`);
  const moduleRoot = path.dirname(manifestFile.file);
  const boundContract = resolvedRegularFile(moduleRoot, declaredContract);
  const entryFile = resolvedRegularFile(moduleRoot, declaredEntry, 32 * 1024 * 1024);
  if (boundContract.file !== contractFile.file) throw new Error(`module manifest contract pointer changed for ${requirementId}`);
  const permissions = Array.isArray(contract.permissions) ? contract.permissions : null;
  const uses = Array.isArray(manifest.uses) ? manifest.uses : null;
  if (!permissions || !uses || !permissions.every(permission => uses.includes(permission))) throw new Error(`module permission declaration binding changed for ${requirementId}`);
  return {
    declarationKind: 'BOUND_MODULE',
    requirementId,
    manifestRelativePath: manifestFile.relativePath,
    manifestSha256: digest(manifestFile.bytes),
    contractRelativePath: contractFile.relativePath,
    contractSha256: digest(contractFile.bytes),
    entryRelativePath: relative(workshopRoot, entryFile.file),
    entrySha256: digest(entryFile.bytes),
    bindingReceiptDigest: record.bindingReceipt.receiptDigest,
    checks: {
      exactManifestId: true,
      exactContractId: true,
      exactContractSchema: true,
      manifestBoundContract: true,
      declaredEntryIsRegularFile: true,
      declaredPermissionsBound: true,
      noSymbolicPath: true
    }
  };
}

function walkServiceContracts(workshopRoot) {
  const sharedRoot = path.join(workshopRoot, 'shared');
  if (!fs.existsSync(sharedRoot)) return [];
  const rootStat = fs.lstatSync(sharedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return [];
  const pending = [sharedRoot];
  const files = [];
  while (pending.length) {
    const directory = pending.shift();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && (entry.name === 'service.contract.json' || entry.name === 'service-contract.json')) {
        files.push(target);
        if (files.length > MAX_SERVICE_CONTRACTS) throw new Error(`shared-service declaration scan exceeds ${MAX_SERVICE_CONTRACTS}`);
      }
    }
  }
  return files.sort();
}

function serviceInventory(workshopRoot) {
  return walkServiceContracts(workshopRoot).map(file => {
    const relativePath = relative(workshopRoot, file);
    try {
      const source = resolvedRegularFile(workshopRoot, relativePath);
      const contract = JSON.parse(source.bytes.toString('utf8'));
      const schema = token(contract && contract.schema);
      const sharedShape = !!contract && schema === 'axm.shared-service-contract/v1' && typeof contract.id === 'string' && !!contract.id && typeof contract.version === 'string' && !!contract.version && Array.isArray(contract.provides) && Array.isArray(contract.accepts) && Array.isArray(contract.produces) && contract.boundaries && typeof contract.boundaries === 'object';
      const serviceIds = Array.isArray(contract && contract.services) ? contract.services.map(value => token(value)).filter(Boolean) : [];
      const foundationShape = !!contract && schema === 'axm.foundation-service-plane/v1' && typeof contract.purpose === 'string' && !!token(contract.purpose) && Array.isArray(contract.rules) && contract.rules.length > 0 && contract.rules.every(rule => typeof rule === 'string' && !!token(rule)) && serviceIds.length > 0 && serviceIds.length === contract.services.length && new Set(serviceIds).size === serviceIds.length;
      const exactShape = sharedShape || foundationShape;
      return {
        relativePath: source.relativePath,
        sha256: digest(source.bytes),
        declarationKind: sharedShape ? 'SHARED_SERVICE' : foundationShape ? 'FOUNDATION_SERVICE_PLANE' : null,
        declaredIds: sharedShape ? [token(contract.id)] : serviceIds,
        schema,
        exactShape,
        error: exactShape ? null : 'Service declaration lacks the exact shared-service or foundation-service-plane structural fields.'
      };
    } catch (error) {
      return { relativePath, sha256: null, declarationKind: null, declaredIds: [], schema: null, exactShape: false, error: token(error.message, 500) };
    }
  });
}

function consumerBindings(handRequest, workshopRoot) {
  const expected = `service:${handRequest.requirementId}`;
  const bindings = [];
  for (const evidence of handRequest.evidenceBindings || []) {
    try {
      const source = resolvedRegularFile(workshopRoot, evidence.contractRelativePath);
      if (digest(source.bytes) !== evidence.contractSha256) throw new Error('source contract digest changed');
      const contract = JSON.parse(source.bytes.toString('utf8'));
      for (const consumed of Array.isArray(contract.consumes) ? contract.consumes : []) {
        if (consumed === expected || consumed.startsWith(`${expected}/`)) bindings.push({ moduleId: evidence.moduleId, contractRelativePath: source.relativePath, contractSha256: digest(source.bytes), consumes: consumed });
      }
    } catch (_) {}
  }
  return bindings.sort((a, b) => `${a.moduleId}:${a.consumes}`.localeCompare(`${b.moduleId}:${b.consumes}`));
}

function recommendation(handRequest, evidence) {
  const module = evidence.declarationKind === 'BOUND_MODULE';
  const foundationService = evidence.declarationKind === 'FOUNDATION_SERVICE_MEMBER';
  return {
    handRequestId: handRequest.requestId,
    handRequestDigest: handRequest.requestDigest,
    requirementId: handRequest.requirementId,
    decisionAuthority: 'HUMAN_REVIEW_REQUIRED',
    suggestedProbe: {
      kind: module ? 'DECLARED_MODULE_AVAILABLE' : foundationService ? 'DECLARED_FOUNDATION_SERVICE_AVAILABLE' : 'DECLARED_SHARED_SERVICE_AVAILABLE',
      targetRelativePath: module ? evidence.manifestRelativePath : evidence.contractRelativePath,
      presentState: 'AVAILABLE',
      missingState: 'UNKNOWN',
      requiredPermission: 'files:read',
      liveExecutionApproved: false
    },
    evidenceDigest: digest(evidence),
    interpretation: module
      ? 'The exact requirement ID has a verified manifest-bound module declaration and declared entry. This supports a review proposal for structural availability only.'
      : foundationService
        ? 'The exact requirement ID is a unique member of one typed foundation service-plane declaration. This supports a review proposal for structural availability only.'
        : 'The exact requirement ID has one typed shared-service provider declaration. This supports a review proposal for structural availability only.',
    unknowns: ['runtime health', 'semantic fitness for each consumer', 'permission grant', 'installation fitness'],
    stateCeiling: 'AVAILABLE',
    candidateBuilt: false,
    reviewed: false
  };
}

function assessHand(handRequest, handoffBatch, inventory, workshopRoot) {
  if (!handRequest || handRequest.schema !== 'axm.mirror.readiness-probe-hand-request/v1' || handRequest.requestDigest !== digest(Object.assign({}, handRequest, { requestDigest: null })) || handRequest.state !== 'REVIEWABLE_MISSING_PROBE_HAND_REQUEST_NOT_BUILT') throw new Error('invalid source readiness hand request');
  const moduleMatches = handoffBatch.contracts.filter(record => record.moduleId === handRequest.requirementId).map(record => moduleEvidence(record, workshopRoot, handRequest.requirementId)).filter(Boolean);
  const serviceSignals = inventory.filter(record => record.declaredIds.includes(handRequest.requirementId));
  const serviceMatches = serviceSignals.filter(record => record.exactShape).map(record => ({
    declarationKind: record.declarationKind === 'FOUNDATION_SERVICE_PLANE' ? 'FOUNDATION_SERVICE_MEMBER' : 'SHARED_SERVICE',
    requirementId: handRequest.requirementId,
    contractRelativePath: record.relativePath,
    contractSha256: record.sha256,
    schema: record.schema,
    checks: record.declarationKind === 'FOUNDATION_SERVICE_PLANE'
      ? { exactUniqueServiceMembership: true, exactContractSchema: true, requiredStructuralFields: true, underSharedRoot: true, noSymbolicPath: true }
      : { exactContractId: true, exactContractSchema: true, requiredStructuralFields: true, underSharedRoot: true, noSymbolicPath: true }
  }));
  const providers = moduleMatches.concat(serviceMatches).sort((a, b) => JSON.stringify(stable(a)).localeCompare(JSON.stringify(stable(b))));
  let classification = 'HOLD_NO_EXACT_PROVIDER_DECLARATION';
  if (providers.length === 1) {
    classification = providers[0].declarationKind === 'BOUND_MODULE'
      ? 'PROPOSE_EXACT_BOUND_MODULE_AFFORDANCE'
      : providers[0].declarationKind === 'FOUNDATION_SERVICE_MEMBER'
        ? 'PROPOSE_EXACT_FOUNDATION_SERVICE_AFFORDANCE'
        : 'PROPOSE_EXACT_SHARED_SERVICE_AFFORDANCE';
  }
  else if (providers.length > 1) classification = 'HOLD_AMBIGUOUS_EXACT_PROVIDER_DECLARATIONS';
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    assessmentDigest: null,
    handRequestId: handRequest.requestId,
    handRequestDigest: handRequest.requestDigest,
    requirementId: handRequest.requirementId,
    classification,
    providerEvidence: providers,
    rejectedExactServiceSignals: serviceSignals.filter(record => !record.exactShape),
    consumerBindings: consumerBindings(handRequest, workshopRoot),
    recommendation: providers.length === 1 ? recommendation(handRequest, providers[0]) : null,
    limits: {
      consumerBindingDoesNotProveProvider: true,
      nameOrPathResemblanceDoesNotProveProvider: true,
      structuralAvailabilityDoesNotProveReady: true,
      generatedRecommendationIsNotHumanReview: true
    },
    authority: {
      humanReview: false,
      recipeSeal: false,
      candidateGeneration: false,
      readinessClaim: false,
      workshopWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveProbeExecution: false,
      trainingAdmission: false,
      toolUse: false,
      worldAction: false,
      runtimePromotion: false,
      canonChange: false
    },
    boundary: 'This assessment may recommend an exact typed structural probe to an attributed human reviewer. It does not review, seal, build, run, install, start, repair, grant, train, promote, or call a requirement READY.'
  };
  assessment.assessmentDigest = digest(without(assessment, 'assessmentDigest'));
  return assessment;
}

function reasoningInput(assessment) {
  const proposed = !!assessment.recommendation;
  const truthfulActionId = proposed ? `propose-review-packet-${assessment.requirementId}` : `hold-provider-unknown-${assessment.requirementId}`;
  const inferenceActionId = `infer-provider-from-name-${assessment.requirementId}`;
  const readyActionId = `claim-ready-${assessment.requirementId}`;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `readiness-affordance-exam-${digest(assessment.assessmentDigest).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-readiness-probe-affordance-planner-organ' },
    goal: 'Choose whether exact typed provider evidence supports only a human-review packet for an AVAILABLE-at-most structural probe, while rejecting name inference and READY claims.',
    evidence: [{ id: 'affordance-assessment', kind: 'observation', status: 'observed', statement: `${assessment.requirementId} is classified ${assessment.classification} from exact provider declarations.`, source: { kind: 'readiness-affordance-assessment', id: assessment.assessmentDigest, uri: `sha256:${assessment.assessmentDigest}` }, confidence: { low: 1, high: 1, basis: 'Content-digested declarations and current hand lineage.' } }],
    unknowns: [{ id: 'runtime-readiness', question: 'Is the structurally declared component healthy and semantically ready for every current consumer?', blocking: true }],
    assumptions: [], constraints: [], permissions: [],
    actions: [
      { id: truthfulActionId, kind: 'proposal', label: proposed ? 'Propose the exact evidence-bound structural probe to a human reviewer' : 'Hold because no unique exact typed provider declaration exists', supportingEvidence: ['affordance-assessment'], preconditionEvidence: ['affordance-assessment'], requiredPermissions: [], expectedEffects: ['A review packet or explicit hold is recorded without changing Workshop.'], possibleSideEffects: ['Structural presence could be overread as runtime readiness.'], reversible: true, recovery: 'Discard the ignored-state assessment and preserve UNKNOWN.', risk: 'low' },
      { id: inferenceActionId, kind: 'proposal', label: 'Infer a provider from a matching folder, filename, or consumer string', supportingEvidence: ['affordance-assessment'], preconditionEvidence: ['affordance-assessment'], requiredPermissions: [], expectedEffects: ['An undeclared provider would be invented.'], possibleSideEffects: ['False availability could unblock routes.'], reversible: false, recovery: 'Reject the inference and preserve UNKNOWN.', risk: 'high' },
      { id: readyActionId, kind: 'proposal', label: 'Claim READY from structural declaration evidence', supportingEvidence: ['affordance-assessment'], preconditionEvidence: ['affordance-assessment'], requiredPermissions: [], expectedEffects: ['Availability would be confused with health.'], possibleSideEffects: ['Unsafe route activation.'], reversible: false, recovery: 'Keep READY unavailable until a separate live contract is reviewed.', risk: 'high' }
    ],
    decomposition: [{ id: 'compare-provider-evidence', question: 'Is there exactly one exact typed provider declaration for this requirement?', dependsOn: [], cheapestCheck: 'Inspect the content-bound affordance assessment.', status: 'ANSWERED', answerEvidenceRefs: ['affordance-assessment'] }],
    pathProfiles: [
      { actionId: truthfulActionId, pathId: `truthful-${assessment.requirementId}`, approach: 'Follow exact declaration evidence and preserve the human review and AVAILABLE ceiling.', requiredEvidence: ['affordance-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['A recommendation is treated as review or READY.'], strategyTags: ['exact-provider-declaration', 'review-bound'] },
      { actionId: inferenceActionId, pathId: `name-inference-${assessment.requirementId}`, approach: 'Treat resemblance or consumption as provision.', requiredEvidence: ['affordance-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No exact provider declaration exists.'], strategyTags: ['reject-name-inference'] },
      { actionId: readyActionId, pathId: `false-ready-${assessment.requirementId}`, approach: 'Promote structural availability into runtime readiness.', requiredEvidence: ['affordance-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No health or semantic probe ran.'], strategyTags: ['reject-false-ready'] }
    ],
    verificationReceipts: [
      { id: `verify-truthful-${assessment.requirementId}`, actionId: truthfulActionId, claim: 'The action matches the exact declaration classification and preserves all review boundaries.', evidenceRefs: ['affordance-assessment'], method: 'Recompute classification from current content-bound declarations.', result: 'PASS', limitations: ['Does not establish runtime readiness.'] },
      { id: `verify-inference-${assessment.requirementId}`, actionId: inferenceActionId, claim: 'A name, folder, or consumer binding is an exact provider declaration.', evidenceRefs: ['affordance-assessment'], method: 'Compare consumer and provider relations.', result: 'FAIL', limitations: ['A later provider contract could change the next immutable assessment.'] },
      { id: `verify-ready-${assessment.requirementId}`, actionId: readyActionId, claim: 'Structural declaration proves READY.', evidenceRefs: ['affordance-assessment'], method: 'Compare structural and live readiness evidence.', result: 'FAIL', limitations: ['A separately reviewed live probe could later establish more.'] }
    ],
    budget: { maxCandidates: 5, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('affordance planner requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('affordance planner session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const inferred = session.pathSet.comparisons.find(item => item.actionId === result.nameInferenceActionId);
  const ready = session.pathSet.comparisons.find(item => item.actionId === result.falseReadyActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !inferred || inferred.verificationStatus !== 'FAIL' || inferred.eligible || !ready || ready.verificationStatus !== 'FAIL' || ready.eligible) throw new Error('affordance planner discrimination changed');
  return true;
}

function expectedSummary(results) {
  return {
    handRequestsAssessed: results.length,
    exactModuleReviewPackets: results.filter(item => item.assessment.classification === 'PROPOSE_EXACT_BOUND_MODULE_AFFORDANCE').length,
    exactSharedServiceReviewPackets: results.filter(item => item.assessment.classification === 'PROPOSE_EXACT_SHARED_SERVICE_AFFORDANCE').length,
    exactFoundationServiceReviewPackets: results.filter(item => item.assessment.classification === 'PROPOSE_EXACT_FOUNDATION_SERVICE_AFFORDANCE').length,
    reviewPacketsProposed: results.filter(item => item.assessment.recommendation).length,
    noProviderHolds: results.filter(item => item.assessment.classification === 'HOLD_NO_EXACT_PROVIDER_DECLARATION').length,
    ambiguousProviderHolds: results.filter(item => item.assessment.classification === 'HOLD_AMBIGUOUS_EXACT_PROVIDER_DECLARATIONS').length,
    reasoningDecisionsMatched: results.filter(item => item.behaviorMatched).length,
    nameInferenceCandidatesRejected: results.filter(item => item.nameInferenceRejected).length,
    falseReadyCandidatesRejected: results.filter(item => item.falseReadyRejected).length,
    humanReviewsCreated: 0,
    recipesSealed: 0,
    candidatesBuilt: 0,
    liveProbesExecuted: 0,
    workshopFilesChanged: 0,
    servicesStartedOrRepaired: 0,
    permissionsGranted: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifyBatch(batch, runDir, handBatch, handoffBatch, workshopRoot) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid readiness affordance batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('readiness affordance organ identity changed');
  if (JSON.stringify(stable(batch.affordanceContract)) !== JSON.stringify(stable(AFFORDANCE_CONTRACT))) throw new Error('readiness affordance contract changed');
  if (JSON.stringify(stable(batch.sourceLineage)) !== JSON.stringify(stable(sourceLineage()))) throw new Error('readiness affordance source lineage mismatch');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_HANDS) throw new Error('readiness affordance hand bound changed');
  if (!batch.authority || batch.authority.privateEvidenceTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key === 'privateEvidenceTraceWrite' ? value !== true : value !== false)) throw new Error('readiness affordance authority boundary changed');
  if (handBatch) ReadinessHands.verifyBatch(handBatch);
  if (handoffBatch) HandoffGraph.verifyBatch(handoffBatch);
  const inputBasis = { organ: ORGAN_ID, affordanceContract: AFFORDANCE_CONTRACT, sourceLineage: sourceLineage(), sourceHandBatch: batch.sourceHandBatch, sourceHandoffGraph: batch.sourceHandoffGraph, serviceInventoryDigest: batch.serviceInventoryDigest, assessments: batch.results.map(item => item.assessment) };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-readiness-probe-affordances-${inputsDigest.slice(0, 20)}`) throw new Error('readiness affordance input lineage mismatch');
  if (handBatch && (batch.sourceHandBatch.batchId !== handBatch.batchId || batch.sourceHandBatch.batchDigest !== handBatch.batchDigest)) throw new Error('readiness affordance source hand batch changed');
  if (handoffBatch && (batch.sourceHandoffGraph.batchId !== handoffBatch.batchId || batch.sourceHandoffGraph.batchDigest !== handoffBatch.batchDigest)) throw new Error('readiness affordance source handoff graph changed');
  const sourceHands = handBatch ? new Map(handBatch.results.filter(item => item.handRequest).map(item => [item.handRequest.requestId, item.handRequest])) : null;
  const inventory = workshopRoot && handoffBatch ? serviceInventory(workshopRoot) : null;
  if (inventory && batch.serviceInventoryDigest !== digest(inventory)) throw new Error('readiness affordance service inventory changed');
  const ids = new Set();
  for (const result of batch.results) {
    if (!result.assessment || ids.has(result.assessment.handRequestId)) throw new Error('readiness affordance assessments must be present and unique');
    ids.add(result.assessment.handRequestId);
    if (result.assessment.assessmentDigest !== digest(without(result.assessment, 'assessmentDigest'))) throw new Error('readiness affordance assessment digest mismatch');
    if (sourceHands) {
      const hand = sourceHands.get(result.assessment.handRequestId);
      if (!hand) throw new Error('readiness affordance assessment hand is absent from current source');
      const expected = assessHand(hand, handoffBatch, inventory, workshopRoot);
      if (JSON.stringify(stable(expected)) !== JSON.stringify(stable(result.assessment))) throw new Error(`readiness affordance assessment changed for ${result.assessment.requirementId}`);
    }
    const truthfulActionId = result.assessment.recommendation ? `propose-review-packet-${result.assessment.requirementId}` : `hold-provider-unknown-${result.assessment.requirementId}`;
    if (result.expectedDecision.value !== 1 || result.expectedDecision.actionId !== truthfulActionId || !result.behaviorMatched || !result.nameInferenceRejected || !result.falseReadyRejected || result.humanReviewCreated || result.recipeSealed || result.candidateBuilt || result.liveProbeExecuted || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('readiness affordance result exceeds proposal boundary');
    if (runDir) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`readiness affordance session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`readiness affordance session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`readiness affordance session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary(batch.results)))) throw new Error('readiness affordance summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-readiness-probe-affordance-runs'));
  if (!inside(root, stateDir)) throw new Error('readiness affordance private state must stay inside Mirror root');
  const handDerived = options.handDerived || ReadinessHands.derive(Object.assign({}, options.handOptions || {}, { root, workshopRoot }));
  ReadinessHands.verifyBatch(handDerived.batch);
  HandoffGraph.verifyBatch(handDerived.handoff.batch);
  const inventory = serviceInventory(workshopRoot);
  const hands = handDerived.batch.results.filter(item => item.handRequest).map(item => item.handRequest).sort((a, b) => a.requestId.localeCompare(b.requestId));
  if (hands.length > MAX_HANDS) throw new Error(`readiness affordance planner holds: ${hands.length} hands exceed ${MAX_HANDS}`);
  const assessments = hands.map(hand => assessHand(hand, handDerived.handoff.batch, inventory, workshopRoot));
  const lineage = sourceLineage();
  const sourceHandBatch = { batchId: handDerived.batch.batchId, batchDigest: handDerived.batch.batchDigest };
  const sourceHandoffGraph = { batchId: handDerived.handoff.batch.batchId, batchDigest: handDerived.handoff.batch.batchDigest };
  const serviceInventoryDigest = digest(inventory);
  const inputBasis = { organ: ORGAN_ID, affordanceContract: AFFORDANCE_CONTRACT, sourceLineage: lineage, sourceHandBatch, sourceHandoffGraph, serviceInventoryDigest, assessments };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-readiness-probe-affordances-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, handDerived.batch, handDerived.handoff.batch, workshopRoot);
    return { batch, runDir, reused: true, handDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const results = assessments.map(assessment => {
    const session = Foundation.run(reasoningInput(assessment), { at: '1970-01-01T00:00:00.000Z' });
    const truthfulActionId = assessment.recommendation ? `propose-review-packet-${assessment.requirementId}` : `hold-provider-unknown-${assessment.requirementId}`;
    const nameInferenceActionId = `infer-provider-from-name-${assessment.requirementId}`;
    const falseReadyActionId = `claim-ready-${assessment.requirementId}`;
    const inferred = session.pathSet.comparisons.find(item => item.actionId === nameInferenceActionId);
    const ready = session.pathSet.comparisons.find(item => item.actionId === falseReadyActionId);
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const sessionFile = path.join('sessions', `session-${digest(assessment.assessmentDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = {
      assessment,
      expectedDecision: { value: 1, actionId: truthfulActionId },
      nameInferenceActionId,
      falseReadyActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === truthfulActionId,
      nameInferenceRejected: !!inferred && inferred.verificationStatus === 'FAIL' && inferred.eligible === false,
      falseReadyRejected: !!ready && ready.verificationStatus === 'FAIL' && ready.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      humanReviewCreated: false,
      recipeSealed: false,
      candidateBuilt: false,
      liveProbeExecuted: false,
      workshopChanged: false,
      trainingReceiptCreated: false,
      worldActionExecuted: false
    };
    verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, sessionFile), bytes, { flag: 'wx' });
    return result;
  });
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_EXACT_PROVIDER_DECLARATION_AFFORDANCE_PLANNER', learnedWeights: false },
    affordanceContract: AFFORDANCE_CONTRACT,
    sourceLineage: lineage,
    sourceHandBatch,
    sourceHandoffGraph,
    serviceInventoryDigest,
    results,
    summary: expectedSummary(results),
    authority: {
      privateEvidenceTraceWrite: true,
      humanReview: false,
      recipeSeal: false,
      candidateGeneration: false,
      readinessClaim: false,
      installedRuntimeWrite: false,
      workshopWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveProbeExecution: false,
      trainingAdmission: false,
      contractWrite: false,
      manifestWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The planner discovers exact typed provider declarations and proposes evidence-bound structural-probe inputs for attributed human review. Consumer strings and name resemblance are never provider evidence. No review, recipe, candidate, live probe, Workshop write, install, start, repair, grant, training, action, READY claim, promotion, or CANON change occurs.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, handDerived.batch, handDerived.handoff.batch, workshopRoot);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, handDerived };
}

function respond(batchOrDerived, request = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`readiness affordance request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'requirementId', 'limit'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical readiness affordance request fields: ${unexpected.join(', ')}`);
  const requirementId = request.requirementId == null ? null : token(request.requirementId);
  const limit = Math.max(1, Math.min(MAX_HANDS, Number(request.limit) || 20));
  let selected = batch.results;
  let state;
  let reason;
  if (requirementId) {
    selected = selected.filter(item => item.assessment.requirementId === requirementId);
    if (!selected.length) {
      state = 'HOLD_UNKNOWN_READINESS_HAND';
      reason = 'The current hand batch contains no reviewable missing-probe request for that requirement ID.';
    }
  }
  selected = selected.slice(0, limit);
  const reviewPackets = selected.filter(item => item.assessment.recommendation && item.behaviorMatched).map(item => ({ assessmentDigest: item.assessment.assessmentDigest, classification: item.assessment.classification, providerEvidence: item.assessment.providerEvidence, recommendation: item.assessment.recommendation }));
  const holds = selected.filter(item => !item.assessment.recommendation || !item.behaviorMatched).map(item => ({ assessmentDigest: item.assessment.assessmentDigest, requirementId: item.assessment.requirementId, classification: item.assessment.classification, providerEvidence: item.assessment.providerEvidence, consumerBindings: item.assessment.consumerBindings, rejectedExactServiceSignals: item.assessment.rejectedExactServiceSignals, state: 'HELD_UNKNOWN_NO_RECIPE_SEALED' }));
  if (!state && reviewPackets.length) {
    state = 'PROPOSED_EXACT_DECLARATION_REVIEW_PACKETS';
    reason = 'Unique exact typed provider declarations support AVAILABLE-at-most structural-probe inputs for attributed human review.';
  } else if (!state && holds.length) {
    state = 'HOLD_NO_UNIQUE_EXACT_PROVIDER_DECLARATION';
    reason = 'Consumer evidence or naming signals exist, but no unique exact typed provider declaration supports a probe recipe.';
  } else if (!state) {
    state = 'NO_READINESS_AFFORDANCES';
    reason = 'No current missing-probe hands require affordance assessment.';
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    request: { requirementId, limit },
    state,
    reason,
    reviewPackets,
    holds,
    humanReviewCreated: false,
    recipesSealed: false,
    candidatesBuilt: false,
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, ASSESSMENT_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, MAX_HANDS, MAX_SERVICE_CONTRACTS, AFFORDANCE_CONTRACT,
  digest, sourceLineage, safeRelative, resolvedRegularFile, moduleEvidence, walkServiceContracts, serviceInventory, consumerBindings, recommendation, assessHand, reasoningInput, verifySession, expectedSummary, verifyBatch, derive, respond
};
