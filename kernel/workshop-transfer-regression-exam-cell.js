'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Foundation = require('./reasoning-foundation');
const Seam = require('./seam-cell');
const ContractCurriculum = require('../organs/reasoning-contract-curriculum-organ');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const WorkshopInventory = require('../scripts/measure-workshop-inventory');

const CELL_ID = 'axm.mirror.workshop-transfer-regression-exam-cell/v1';
const RESULT_SCHEMA = 'axm.mirror.workshop-transfer-regression-exam-result/v1';
const CRITERIA_ID = 'axm.mirror.workshop-transfer-relational-conservation-criteria/v1';
const PASS_STATE = 'PASS_BOUND_WORKSHOP_TRANSFER_REVALIDATION';
const FAIL_STATE = 'FAIL_BOUND_WORKSHOP_TRANSFER_REGRESSION_OBSERVED';
const HOLD_STATE = 'HOLD_WORKSHOP_TRANSFER_REVALIDATION_INSUFFICIENT';
const SOURCE_CHANGED_STATE = 'HOLD_WORKSHOP_SOURCE_CHANGED_DURING_REVALIDATION';
const MAX_INPUT_DOCUMENTS = 256;

const CRITERIA = Object.freeze({
  id: CRITERIA_ID,
  authoredBeforeRepairCandidate: true,
  contractBoundary: Object.freeze({
    minimumEligibleContracts: 1,
    minimumHeldOutContracts: 1,
    expectedDecisionValue: -1,
    requireExactSelectedAction: true,
    maximumBehaviorMismatches: 0,
    maximumAuthoritySeams: 0
  }),
  handoffGraph: Object.freeze({
    minimumManifestBoundContracts: 1,
    minimumExactRoutes: 1,
    expectedDecisionValue: 1,
    requireExactSelectedAction: true,
    requireUnboundDecoyRejection: true,
    maximumBehaviorMismatches: 0,
    maximumAuthoritySeams: 0
  }),
  source: Object.freeze({
    requireStableBytesDuringExam: true,
    refuseSymbolicLinks: true,
    executeWorkshopJavaScript: false
  }),
  authority: Object.freeze({
    trainingAdmission: false,
    repairSelection: false,
    permissionGrant: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  })
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}

function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes === undefined ? 'undefined' : bytes).digest('hex');
}

function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function forward(value) { return String(value).replace(/\\/g, '/'); }
function fileSha256(file) { return digest(fs.readFileSync(file)); }

function sourceLineage(root = path.resolve(__dirname, '..')) {
  const files = [
    'contracts/workshop-transfer-regression-exam-result.schema.json',
    'contracts/workshop-transfer-regression-exam.schema.json',
    'kernel/reasoning-foundation.js',
    'kernel/seam-cell.js',
    'kernel/workshop-transfer-regression-exam-cell.js',
    'organs/foundation-development-observatory-organ.js',
    'organs/reasoning-contract-curriculum-organ.js',
    'organs/reasoning-handoff-graph-organ.js',
    'organs/workshop-transfer-regression-exam-organ.js',
    'scripts/measure-workshop-inventory.js',
    'training/TRAINING_POLICY.json'
  ];
  return files.map(relativePath => ({ path: relativePath, sha256: fileSha256(path.join(root, relativePath)) }));
}

function compactInventory(scope, measured) {
  return {
    scope,
    extension: measured.extension,
    files: measured.files,
    bytes: measured.bytes,
    digest: measured.digest,
    refusedSymbolicLinks: measured.refusedSymbolicLinks.slice()
  };
}

function transferInputInventory(workshopRoot) {
  const root = path.resolve(workshopRoot);
  const toolsRoot = path.join(root, 'tools');
  const documents = [];
  const refusedSymbolicLinks = [];
  if (!fs.existsSync(toolsRoot) || !fs.statSync(toolsRoot).isDirectory()) throw new Error(`Workshop tools root missing: ${toolsRoot}`);
  for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const directory = path.join(toolsRoot, entry.name);
    if (entry.isSymbolicLink()) { refusedSymbolicLinks.push(forward(path.relative(root, directory))); continue; }
    if (!entry.isDirectory()) continue;
    for (const name of ['manifest.json', 'module.contract.json']) {
      const file = path.join(directory, name);
      if (!fs.existsSync(file)) continue;
      const info = fs.lstatSync(file);
      const relativePath = forward(path.relative(root, file));
      if (info.isSymbolicLink()) { refusedSymbolicLinks.push(relativePath); continue; }
      if (!info.isFile()) continue;
      const bytes = fs.readFileSync(file);
      documents.push({ relativePath, bytes: bytes.length, sha256: digest(bytes) });
    }
  }
  documents.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (documents.length > MAX_INPUT_DOCUMENTS) throw new Error(`Workshop transfer inputs exceed the ${MAX_INPUT_DOCUMENTS} document bound`);
  return {
    scope: 'TRANSFER_CONTRACT_AND_MANIFEST_INPUTS',
    extension: '.json',
    files: documents.length,
    bytes: documents.reduce((sum, item) => sum + item.bytes, 0),
    digest: digest(documents),
    refusedSymbolicLinks: refusedSymbolicLinks.sort()
  };
}

function inspectSource(workshopRoot) {
  const root = path.resolve(workshopRoot);
  const inventories = [
    compactInventory('WHOLE_WORKSHOP_JAVASCRIPT', WorkshopInventory.measure(root, 'js')),
    compactInventory('SHARED_JAVASCRIPT', WorkshopInventory.measure(path.join(root, 'shared'), 'js')),
    compactInventory('SHARED_JSON', WorkshopInventory.measure(path.join(root, 'shared'), 'json')),
    transferInputInventory(root)
  ];
  return {
    schema: 'axm.mirror.workshop-transfer-source-inventory/v1',
    rootAvailable: true,
    inventories,
    digest: digest(inventories),
    refusedSymbolicLinks: inventories.reduce((sum, item) => sum + item.refusedSymbolicLinks.length, 0)
  };
}

function settledSource(audit) {
  if (!audit || audit.schema !== 'axm.mirror.settled-workshop-growth-audit/v1') throw new Error('Workshop transfer revalidation requires the settled Workshop audit');
  return [
    { scope: 'WHOLE_WORKSHOP_JAVASCRIPT', extension: '.js', files: audit.workshop.javascriptFiles, bytes: audit.workshop.javascriptBytes, digest: audit.workshop.javascriptDigest, refusedSymbolicLinks: [] },
    { scope: 'SHARED_JAVASCRIPT', extension: '.js', files: audit.workshop.sharedJavascriptFiles, bytes: audit.workshop.sharedJavascriptBytes, digest: audit.workshop.sharedJavascriptDigest, refusedSymbolicLinks: [] },
    { scope: 'SHARED_JSON', extension: '.json', files: audit.workshop.sharedJsonFiles, bytes: audit.workshop.sharedJsonBytes, digest: audit.workshop.sharedJsonDigest, refusedSymbolicLinks: [] }
  ];
}

function sourceDrift(before, audit) {
  const expected = new Map(settledSource(audit).map(item => [item.scope, item]));
  const changedScopes = [];
  for (const current of before.inventories.filter(item => expected.has(item.scope))) {
    const prior = expected.get(current.scope);
    if (current.files !== prior.files || current.bytes !== prior.bytes || current.digest !== prior.digest || current.refusedSymbolicLinks.length) changedScopes.push(current.scope);
  }
  return { observed: changedScopes.length > 0, changedScopes: changedScopes.sort(), settledDigest: digest(Array.from(expected.values())) };
}

function authorityClosed(session) {
  return session && session.schema === 'axm.mirror.reasoning-session/v1' && session.cell && session.cell.learnedWeights === false &&
    session.authority && session.authority.proposalOnly === true &&
    Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function contractCanaries(workshopRoot) {
  const discovery = ContractCurriculum.discover(workshopRoot);
  const results = discovery.contracts.map(record => {
    const basis = ContractCurriculum.evaluatorBasis(record);
    const session = Foundation.run(ContractCurriculum.examInput(record), { at: null });
    let verificationError = null;
    try { ContractCurriculum.verifyDeterministicSession(session); } catch (error) { verificationError = String(error.message || error).slice(0, 300); }
    const observedDecision = {
      value: Number(session.principleTrace.decision.value),
      actionId: session.principleTrace.decision.selectedActionId
    };
    const behaviorMatched = !verificationError && observedDecision.value === basis.expectedDecision.value && observedDecision.actionId === basis.expectedDecision.actionId;
    const seam = Seam.inspectReasoningSession(session, { deliberate: true });
    return {
      moduleId: record.moduleId,
      contractRelativePath: record.contractRelativePath,
      contractSha256: record.contractSha256,
      boundaryId: record.boundaryId,
      partition: record.partition,
      expectedDecision: basis.expectedDecision,
      observedDecision,
      behaviorMatched,
      authoritySeams: seam.summary.open,
      verificationError,
      sessionDigest: digest(session)
    };
  });
  return {
    eligibleContracts: discovery.contracts.length,
    refusedContracts: discovery.refused.length,
    privateTrainingPartitionContracts: results.filter(item => item.partition === 'PRIVATE_TRAINING').length,
    heldOutContracts: results.filter(item => item.partition === 'HELD_OUT_EVALUATION').length,
    boundariesPreserved: results.filter(item => item.behaviorMatched).length,
    behaviorMismatches: results.filter(item => !item.behaviorMatched).length,
    authoritySeams: results.reduce((sum, item) => sum + item.authoritySeams, 0),
    trainingReceiptsCreated: 0,
    results
  };
}

function handoffCanaries(workshopRoot) {
  const discovery = HandoffGraph.discover(workshopRoot);
  const graph = HandoffGraph.buildGraph(discovery);
  const routes = HandoffGraph.buildRoutes(graph);
  const results = routes.map(route => {
    const expectedActionId = `propose-${route.routeId}`;
    const decoyActionId = `propose-unbound-${route.routeId}`;
    const session = Foundation.run(HandoffGraph.routeInput(route, graph), { at: '1970-01-01T00:00:00.000Z' });
    const observedDecision = { value: Number(session.principleTrace.decision.value), actionId: session.principleTrace.decision.selectedActionId };
    const validComparison = session.pathSet.comparisons.find(item => item.actionId === expectedActionId);
    const decoyComparison = session.pathSet.comparisons.find(item => item.actionId === decoyActionId);
    const authoritySeams = authorityClosed(session) ? Seam.inspectReasoningSession(session, { deliberate: true }).summary.open : 1;
    const decoyRejected = !!decoyComparison && decoyComparison.verificationStatus === 'FAIL' && decoyComparison.eligible === false;
    const validAccepted = !!validComparison && validComparison.verificationStatus === 'PASS' && validComparison.eligible === true;
    const behaviorMatched = authoritySeams === 0 && validAccepted && decoyRejected && observedDecision.value === 1 && observedDecision.actionId === expectedActionId;
    return {
      routeId: route.routeId,
      depth: route.depth,
      moduleIds: route.moduleIds,
      handoffTypes: route.handoffTypes,
      expectedDecision: { value: 1, actionId: expectedActionId },
      observedDecision,
      validAccepted,
      unboundDecoyRejected: decoyRejected,
      behaviorMatched,
      authoritySeams,
      sessionDigest: digest(session)
    };
  });
  return {
    manifestBoundContracts: graph.contracts.length,
    refusedContracts: discovery.refused.length,
    exactCrossModuleEdges: graph.edges.length,
    directRoutes: results.filter(item => item.depth === 1).length,
    depthTwoRoutes: results.filter(item => item.depth === 2).length,
    exactRoutes: results.length,
    routesPreserved: results.filter(item => item.behaviorMatched).length,
    behaviorMismatches: results.filter(item => !item.behaviorMatched).length,
    unboundDecoysRejected: results.filter(item => item.unboundDecoyRejected).length,
    authoritySeams: results.reduce((sum, item) => sum + item.authoritySeams, 0),
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0,
    results
  };
}

function criterionChecks(sourceBefore, sourceAfter, contracts, handoffs) {
  return [
    { id: 'source-stable-during-exam', pass: same(sourceBefore, sourceAfter), observed: { before: sourceBefore.digest, after: sourceAfter.digest } },
    { id: 'source-symbolic-links-refused', pass: sourceBefore.refusedSymbolicLinks === 0 && sourceAfter.refusedSymbolicLinks === 0, observed: { before: sourceBefore.refusedSymbolicLinks, after: sourceAfter.refusedSymbolicLinks } },
    { id: 'eligible-contract-coverage', pass: contracts.eligibleContracts >= CRITERIA.contractBoundary.minimumEligibleContracts, observed: contracts.eligibleContracts },
    { id: 'held-out-contract-coverage', pass: contracts.heldOutContracts >= CRITERIA.contractBoundary.minimumHeldOutContracts, observed: contracts.heldOutContracts },
    { id: 'contract-boundaries-preserved', pass: contracts.behaviorMismatches === 0 && contracts.boundariesPreserved === contracts.eligibleContracts, observed: { preserved: contracts.boundariesPreserved, mismatches: contracts.behaviorMismatches } },
    { id: 'contract-authority-closed', pass: contracts.authoritySeams === 0 && contracts.trainingReceiptsCreated === 0, observed: { seams: contracts.authoritySeams, trainingReceipts: contracts.trainingReceiptsCreated } },
    { id: 'manifest-bound-contract-coverage', pass: handoffs.manifestBoundContracts >= CRITERIA.handoffGraph.minimumManifestBoundContracts, observed: handoffs.manifestBoundContracts },
    { id: 'exact-route-coverage', pass: handoffs.exactRoutes >= CRITERIA.handoffGraph.minimumExactRoutes, observed: handoffs.exactRoutes },
    { id: 'exact-routes-preserved', pass: handoffs.behaviorMismatches === 0 && handoffs.routesPreserved === handoffs.exactRoutes, observed: { preserved: handoffs.routesPreserved, mismatches: handoffs.behaviorMismatches } },
    { id: 'unbound-decoys-rejected', pass: handoffs.unboundDecoysRejected === handoffs.exactRoutes, observed: { rejected: handoffs.unboundDecoysRejected, routes: handoffs.exactRoutes } },
    { id: 'handoff-authority-closed', pass: handoffs.authoritySeams === 0 && handoffs.trainingReceiptsCreated === 0 && handoffs.worldActionsExecuted === 0, observed: { seams: handoffs.authoritySeams, trainingReceipts: handoffs.trainingReceiptsCreated, worldActions: handoffs.worldActionsExecuted } }
  ];
}

function examine(options = {}) {
  const workshopRoot = path.resolve(options.workshopRoot || '');
  if (!workshopRoot || !fs.existsSync(workshopRoot)) throw new Error('Workshop transfer revalidation requires an available Workshop root');
  const binding = stable(options.regressionBinding || {});
  if (binding.dimensionId !== 'DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH' || !/^[a-f0-9]{64}$/.test(binding.handRequestDigest || '') || !/^[a-f0-9]{64}$/.test(binding.frontierRequestDigest || '')) {
    throw new Error('Workshop transfer revalidation requires an exact discovery-transfer regression binding');
  }
  const audit = options.settledAudit;
  const before = inspectSource(workshopRoot);
  const drift = sourceDrift(before, audit);
  const contracts = contractCanaries(workshopRoot);
  const handoffs = handoffCanaries(workshopRoot);
  const after = inspectSource(workshopRoot);
  const checks = criterionChecks(before, after, contracts, handoffs);
  const failed = checks.filter(item => !item.pass).map(item => item.id);
  const sourceChangedDuringExam = !same(before, after);
  const coverageFailed = failed.some(id => id.endsWith('-coverage'));
  const behaviorFailed = contracts.behaviorMismatches > 0 || handoffs.behaviorMismatches > 0 || contracts.authoritySeams > 0 || handoffs.authoritySeams > 0;
  const state = sourceChangedDuringExam
    ? SOURCE_CHANGED_STATE
    : coverageFailed
      ? HOLD_STATE
      : behaviorFailed || failed.length
        ? FAIL_STATE
        : PASS_STATE;
  const result = {
    schema: RESULT_SCHEMA,
    resultDigest: null,
    cell: { id: CELL_ID, learnedWeights: false, expectedResultsVersion: CRITERIA_ID },
    regressionBinding: binding,
    source: {
      settledAuditDigest: digest(audit),
      baselineSourceTopologyChanged: drift.observed,
      changedBaselineScopes: drift.changedScopes,
      settledSourceDigest: drift.settledDigest,
      before,
      after,
      stableDuringExam: !sourceChangedDuringExam
    },
    criteria: CRITERIA,
    checks,
    contractBoundaryCanaries: contracts,
    handoffRouteCanaries: handoffs,
    summary: {
      checks: checks.length,
      passedChecks: checks.length - failed.length,
      failedChecks: failed,
      eligibleContracts: contracts.eligibleContracts,
      contractBehaviorMismatches: contracts.behaviorMismatches,
      manifestBoundContracts: handoffs.manifestBoundContracts,
      exactRoutes: handoffs.exactRoutes,
      routeBehaviorMismatches: handoffs.behaviorMismatches,
      authoritySeams: contracts.authoritySeams + handoffs.authoritySeams,
      workshopJavascriptExecuted: 0,
      workshopModulesInvoked: 0,
      networkCalls: 0,
      trainingAdmissions: 0,
      repairCandidatesEvaluated: 0,
      repairsSelected: 0,
      permissionGrants: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    causeClassification: state === PASS_STATE && drift.observed
      ? 'SOURCE_TOPOLOGY_DRIFT_WITH_BOUNDED_RELATIONAL_BEHAVIOR_PRESERVED'
      : state === PASS_STATE
        ? 'NO_BASELINE_SOURCE_DRIFT_WITH_BOUNDED_RELATIONAL_BEHAVIOR_PRESERVED'
        : state === FAIL_STATE
          ? 'BOUND_RELATIONAL_BEHAVIOR_REGRESSION_OBSERVED'
          : 'CAUSE_NOT_CLASSIFIED_EVIDENCE_HELD',
    state,
    claimCeiling: state === PASS_STATE ? 'BOUNDED_CURRENT_WORKSHOP_RELATIONAL_BEHAVIOR_REVALIDATED' : 'NO_BEHAVIOR_PRESERVATION_CLAIM',
    authority: {
      sourceRead: true,
      deterministicMirrorCanaryExecution: true,
      workshopJavascriptExecution: false,
      workshopModuleInvocation: false,
      trainingAdmission: false,
      repairSelection: false,
      modelChange: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This result distinguishes current source-topology drift from bounded contract-boundary and manifest-bound route behavior. It is Mirror-authored evidence, not proof of outside independence, all Workshop behavior, future transfer, general intelligence, repair correctness, permission, training eligibility, runtime readiness, promotion, or canon.'
  };
  result.resultDigest = digest(Object.assign({}, result, { resultDigest: null }));
  return stable(result);
}

function verify(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.resultDigest !== digest(Object.assign({}, result, { resultDigest: null }))) throw new Error('Workshop transfer revalidation result digest changed');
  if (!result.cell || result.cell.id !== CELL_ID || result.cell.learnedWeights !== false || result.cell.expectedResultsVersion !== CRITERIA_ID) throw new Error('Workshop transfer revalidation cell boundary changed');
  if (!same(result.criteria, CRITERIA)) throw new Error('Workshop transfer revalidation criteria changed');
  if (!Array.isArray(result.checks) || !result.checks.length || !result.summary || result.summary.checks !== result.checks.length) throw new Error('Workshop transfer revalidation checks changed');
  const trueAuthority = new Set(['sourceRead', 'deterministicMirrorCanaryExecution']);
  if (!result.authority || Object.entries(result.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('Workshop transfer revalidation gained authority');
  if (![PASS_STATE, FAIL_STATE, HOLD_STATE, SOURCE_CHANGED_STATE].includes(result.state)) throw new Error('Workshop transfer revalidation state changed');
  if (result.state === PASS_STATE && (result.checks.some(item => !item.pass) || result.summary.authoritySeams !== 0 || !result.source.stableDuringExam)) throw new Error('Workshop transfer revalidation pass is not supported');
  if (result.summary.workshopJavascriptExecuted !== 0 || result.summary.workshopModulesInvoked !== 0 || result.summary.networkCalls !== 0 || result.summary.trainingAdmissions !== 0 || result.summary.repairsSelected !== 0 || result.summary.worldActions !== 0) throw new Error('Workshop transfer revalidation crossed its execution boundary');
  return true;
}

module.exports = {
  CELL_ID, RESULT_SCHEMA, CRITERIA_ID, CRITERIA, PASS_STATE, FAIL_STATE, HOLD_STATE, SOURCE_CHANGED_STATE, MAX_INPUT_DOCUMENTS,
  stable, digest, same, sourceLineage, transferInputInventory, inspectSource, settledSource, sourceDrift,
  authorityClosed, contractCanaries, handoffCanaries, criterionChecks, examine, verify
};
