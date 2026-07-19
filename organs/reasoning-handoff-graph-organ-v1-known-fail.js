'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const Frontier = require('../kernel/frontier-cell');
const HandoffCell = require('../kernel/contract-handoff-cell');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/reasoning-handoff-graph-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-handoff-route-batch/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-handoff-route-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-handoff-route-response/v1';
const MAX_CONTRACTS = 64;
const MAX_INTERFACES_PER_DIRECTION = 64;
const MAX_EDGES = 256;
const MAX_ROUTES = 256;
const MAX_DEPTH = 2;
const IMPLEMENTATION_CONTRACT = Object.freeze({
  version: 'exact-typed-handoff-graph-v1',
  edgeRule: 'producer.handoffs.emits[] exact-match consumer.handoffs.accepts[]',
  routeRule: 'all non-cyclic paths at depth one and two',
  decoyRule: 'same terminal typed output to a consumer that does not accept it',
  generatedHumanWordingAuthority: false,
  trainingAdmission: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  const bytes = Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }

function token(value, fallback = 'handoff') {
  const result = String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  return result || fallback;
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !!relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function typedList(value, field) {
  if (!Array.isArray(value) || value.length > MAX_INTERFACES_PER_DIRECTION) throw new Error(`${field} must be a bounded array`);
  const rows = value.map(item => String(item == null ? '' : item).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 240));
  if (rows.some(item => !item) || new Set(rows).size !== rows.length) throw new Error(`${field} must contain unique non-empty typed identifiers`);
  return rows.slice().sort();
}

function publicContract(record) {
  return {
    moduleId: record.moduleId,
    contractRelativePath: record.contractRelativePath,
    contractSha256: record.contractSha256,
    emits: record.emits.slice(),
    accepts: record.accepts.slice()
  };
}

function cellContract(record) {
  return {
    moduleId: record.moduleId,
    contractSha256: record.contractSha256,
    emits: record.emits.slice(),
    accepts: record.accepts.slice()
  };
}

function discover(workshopRoot) {
  const root = path.resolve(workshopRoot);
  const toolsRoot = path.join(root, 'tools');
  if (!fs.existsSync(toolsRoot) || !fs.statSync(toolsRoot).isDirectory()) throw new Error(`Workshop tools root missing: ${toolsRoot}`);
  const contracts = [];
  const refused = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(toolsRoot, entry.name);
    if (fs.lstatSync(directory).isSymbolicLink()) {
      refused.push({ directory: entry.name, state: 'REFUSED_SYMBOLIC_LINK_DIRECTORY' });
      continue;
    }
    const file = path.join(directory, 'module.contract.json');
    if (!fs.existsSync(file)) continue;
    const info = fs.lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || !inside(toolsRoot, file)) {
      refused.push({ directory: entry.name, state: 'REFUSED_UNSAFE_CONTRACT_PATH' });
      continue;
    }
    let contract;
    let bytes;
    try {
      bytes = fs.readFileSync(file);
      contract = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      refused.push({ directory: entry.name, state: 'REFUSED_INVALID_JSON', reason: String(error.message || error).slice(0, 300) });
      continue;
    }
    if (entry.name.startsWith('_') || contract.id === 'CHANGE-ME') {
      refused.push({ directory: entry.name, state: 'EXCLUDED_TEMPLATE' });
      continue;
    }
    try {
      if (contract.schema !== 'axm.module-contract/v1' || contract.id !== entry.name || !contract.handoffs || typeof contract.handoffs !== 'object') {
        throw new Error('schema, module ID, or handoffs object mismatch');
      }
      contracts.push({
        moduleId: contract.id,
        contractFile: file,
        contractRelativePath: path.relative(root, file).replace(/\\/g, '/'),
        contractSha256: digest(bytes),
        emits: typedList(contract.handoffs.emits, `${contract.id}.handoffs.emits`),
        accepts: typedList(contract.handoffs.accepts, `${contract.id}.handoffs.accepts`)
      });
    } catch (error) {
      refused.push({ directory: entry.name, state: 'REFUSED_UNTYPED_OR_MISMATCHED_HANDOFF_CONTRACT', reason: String(error.message || error).slice(0, 300) });
    }
  }
  if (contracts.length > MAX_CONTRACTS) throw new Error(`handoff graph holds: ${contracts.length} eligible contracts exceed the ${MAX_CONTRACTS} contract bound`);
  if (new Set(contracts.map(item => item.moduleId)).size !== contracts.length) throw new Error('handoff graph refuses duplicate module IDs');
  return { workshopRoot: root, toolsRoot, contracts, refused };
}

function buildGraph(discovery) {
  const contracts = discovery.contracts.map(publicContract).sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  const edges = [];
  for (const producer of contracts) {
    for (const handoffType of producer.emits) {
      for (const consumer of contracts) {
        if (producer.moduleId === consumer.moduleId || !consumer.accepts.includes(handoffType)) continue;
        const compatibility = HandoffCell.evaluate({ producer: cellContract(producer), consumer: cellContract(consumer), handoffType });
        const basis = {
          producerModuleId: producer.moduleId,
          producerContractSha256: producer.contractSha256,
          consumerModuleId: consumer.moduleId,
          consumerContractSha256: consumer.contractSha256,
          handoffType
        };
        edges.push(Object.assign({ edgeId: `handoff-edge-${digest(basis).slice(0, 20)}` }, basis, {
          compatibilityReceipt: compatibility
        }));
      }
    }
  }
  edges.sort((a, b) => a.producerModuleId.localeCompare(b.producerModuleId) || a.consumerModuleId.localeCompare(b.consumerModuleId) || a.handoffType.localeCompare(b.handoffType));
  if (edges.length > MAX_EDGES) throw new Error(`handoff graph holds: ${edges.length} edges exceed the ${MAX_EDGES} edge bound`);
  if (new Set(edges.map(item => item.edgeId)).size !== edges.length) throw new Error('handoff graph edge digest collision');
  return { contracts, edges };
}

function decoyFor(route, graph) {
  const finalEdge = route.edges[route.edges.length - 1];
  const producer = graph.contracts.find(item => item.moduleId === finalEdge.producerModuleId);
  const validConsumer = finalEdge.consumerModuleId;
  const candidates = graph.contracts.filter(item => item.moduleId !== producer.moduleId && item.moduleId !== validConsumer && !item.accepts.includes(finalEdge.handoffType));
  candidates.sort((a, b) => digest({ routeId: route.routeId, moduleId: a.moduleId }).localeCompare(digest({ routeId: route.routeId, moduleId: b.moduleId })) || a.moduleId.localeCompare(b.moduleId));
  const consumer = candidates[0];
  if (!consumer) throw new Error(`handoff route ${route.routeId} has no incompatible decoy consumer`);
  const compatibility = HandoffCell.evaluate({ producer: cellContract(producer), consumer: cellContract(consumer), handoffType: finalEdge.handoffType });
  if (compatibility.compatible) throw new Error('handoff decoy unexpectedly became compatible');
  return {
    producerModuleId: producer.moduleId,
    producerContractSha256: producer.contractSha256,
    consumerModuleId: consumer.moduleId,
    consumerContractSha256: consumer.contractSha256,
    handoffType: finalEdge.handoffType,
    compatibilityReceipt: compatibility
  };
}

function buildRoutes(graph) {
  const routeBases = [];
  for (const edge of graph.edges) routeBases.push({ edges: [edge] });
  for (const first of graph.edges) {
    for (const second of graph.edges) {
      if (first.consumerModuleId !== second.producerModuleId || first.producerModuleId === second.consumerModuleId) continue;
      routeBases.push({ edges: [first, second] });
    }
  }
  const unique = new Map();
  for (const basis of routeBases) {
    const edgeIds = basis.edges.map(item => item.edgeId);
    const moduleIds = [basis.edges[0].producerModuleId].concat(basis.edges.map(item => item.consumerModuleId));
    const handoffTypes = basis.edges.map(item => item.handoffType);
    const digestBasis = { edgeIds, moduleIds, handoffTypes, depth: basis.edges.length };
    const routeId = `handoff-route-${digest(digestBasis).slice(0, 20)}`;
    if (!unique.has(routeId)) unique.set(routeId, {
      routeId,
      depth: basis.edges.length,
      moduleIds,
      handoffTypes,
      edgeIds,
      edges: basis.edges
    });
  }
  const routes = Array.from(unique.values()).sort((a, b) => a.depth - b.depth || a.routeId.localeCompare(b.routeId));
  if (routes.length > MAX_ROUTES) throw new Error(`handoff graph holds: ${routes.length} routes exceed the ${MAX_ROUTES} route bound`);
  for (const route of routes) route.decoy = decoyFor(route, graph);
  return routes;
}

function routeInput(route, sessionId) {
  const edgeEvidence = route.edges.map((edge, index) => ({
    id: `exact-handoff-${index + 1}`,
    kind: 'test',
    status: 'tested',
    statement: `${edge.producerModuleId} emits ${edge.handoffType} and ${edge.consumerModuleId} accepts the same typed identifier.`,
    source: { kind: 'contract-handoff-compatibility-receipt', id: edge.compatibilityReceipt.receiptDigest, uri: `sha256:${edge.compatibilityReceipt.receiptDigest}` },
    confidence: { low: 1, high: 1, basis: 'Independent exact-membership compatibility receipt.' }
  }));
  const mismatchEvidenceId = 'incompatible-terminal-handoff';
  const mismatchEvidence = {
    id: mismatchEvidenceId,
    kind: 'test',
    status: 'tested',
    statement: `${route.decoy.consumerModuleId} does not accept terminal type ${route.decoy.handoffType} from ${route.decoy.producerModuleId}.`,
    source: { kind: 'contract-handoff-compatibility-receipt', id: route.decoy.compatibilityReceipt.receiptDigest, uri: `sha256:${route.decoy.compatibilityReceipt.receiptDigest}` },
    confidence: { low: 1, high: 1, basis: 'Independent exact-membership incompatibility receipt.' }
  };
  const validActionId = `propose-${route.routeId}`;
  const invalidActionId = `propose-incompatible-${route.routeId}`;
  const validAction = {
    id: validActionId,
    kind: 'proposal',
    label: `Propose exact typed handoff route ${route.moduleIds.join(' -> ')}`,
    requiredPermissions: [],
    supportingEvidence: edgeEvidence.map(item => item.id),
    preconditionEvidence: edgeEvidence.map(item => item.id),
    expectedEffects: ['A reviewable route proposal is produced; no module is invoked.'],
    possibleSideEffects: ['The proposed route may still be unsuitable for an unstated human goal.'],
    reversible: true,
    recovery: 'Discard the proposal; no Workshop module or artifact was changed.',
    risk: 'low'
  };
  const invalidAction = {
    id: invalidActionId,
    kind: 'proposal',
    label: `Propose incompatible terminal handoff to ${route.decoy.consumerModuleId}`,
    requiredPermissions: [],
    supportingEvidence: [mismatchEvidenceId],
    preconditionEvidence: [mismatchEvidenceId],
    expectedEffects: ['An incompatible route would be proposed.'],
    possibleSideEffects: ['A downstream module could receive an interface it does not declare.'],
    reversible: true,
    recovery: 'Discard the proposal; no Workshop module or artifact was changed.',
    risk: 'low'
  };
  const actions = parseInt(digest(route.routeId).slice(0, 2), 16) % 2 ? [invalidAction, validAction] : [validAction, invalidAction];
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: sessionId || `handoff-exam-${digest(route.routeId).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-handoff-graph-organ' },
    goal: `Choose the supplied route whose adjacent Workshop module handoffs have exact typed compatibility.`,
    evidence: edgeEvidence.concat(mismatchEvidence),
    unknowns: [],
    assumptions: [],
    constraints: [],
    permissions: [],
    actions,
    decomposition: [{
      id: 'check-adjacent-handoffs',
      question: 'Does every adjacent producer emission exactly match the next consumer acceptance?',
      dependsOn: [],
      cheapestCheck: 'Use the independent contract-handoff compatibility receipts.',
      status: 'ANSWERED',
      answerEvidenceRefs: edgeEvidence.map(item => item.id).concat(mismatchEvidenceId)
    }],
    pathProfiles: [{
      actionId: validActionId,
      pathId: `path-${route.routeId}`,
      approach: 'Follow only exact typed handoff compatibility receipts.',
      requiredEvidence: edgeEvidence.map(item => item.id),
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: 1,
      reversible: true,
      failureConditions: ['Any adjacent exact-compatibility receipt fails or its source contract digest changes.'],
      strategyTags: ['follow-exact-typed-handoff']
    }, {
      actionId: invalidActionId,
      pathId: `path-incompatible-${route.routeId}`,
      approach: 'Route a terminal type to a consumer that does not accept it.',
      requiredEvidence: [mismatchEvidenceId],
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: 0,
      reversible: true,
      failureConditions: ['The consumer does not declare the terminal handoff type.'],
      strategyTags: ['reject-incompatible-typed-handoff']
    }],
    verificationReceipts: [{
      id: `verify-${route.routeId}`,
      actionId: validActionId,
      claim: 'Every adjacent typed handoff in the proposed route is compatible.',
      evidenceRefs: edgeEvidence.map(item => item.id),
      method: 'Independent exact membership in producer emits and consumer accepts.',
      result: 'PASS',
      limitations: ['Exact interface compatibility does not prove semantic suitability or permission to execute.']
    }, {
      id: `verify-incompatible-${route.routeId}`,
      actionId: invalidActionId,
      claim: 'The decoy terminal consumer accepts the supplied type.',
      evidenceRefs: [mismatchEvidenceId],
      method: 'Independent exact membership in producer emits and consumer accepts.',
      result: 'FAIL',
      limitations: ['This is a generated structural counterexample, not a real failed world action.']
    }],
    budget: { maxCandidates: 4, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true &&
    Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false) throw new Error('handoff graph requires a deterministic Reasoning Foundation session');
  if (!authorityClosed(session)) throw new Error('handoff graph session gained authority');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error(`handoff graph session failed independent authority review: ${independent.seams.map(item => `${item.id}=${item.statement}`).join('; ')}`);
  const validComparison = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const decoyComparison = session.pathSet.comparisons.find(item => item.actionId === result.decoyActionId);
  if (!validComparison || validComparison.verificationStatus !== 'PASS' || !validComparison.eligible ||
      !decoyComparison || decoyComparison.verificationStatus !== 'FAIL' || decoyComparison.eligible) {
    throw new Error('handoff graph candidate discrimination is not preserved');
  }
  return true;
}

function frontierFor(results) {
  const mismatches = results.filter(item => !item.behaviorMatched);
  if (!mismatches.length) return { state: 'NO_UNEXPECTED_SEAM', assessment: null };
  const assessment = Frontier.inspect({
    subject: { id: 'typed-handoff-route-composition', statement: 'Originate bounded module routes from exact typed handoff compatibility.', domain: 'reasoning-foundation' },
    observations: mismatches.map(item => ({
      id: item.reasoningSessionId,
      domain: 'contract-handoff-graph',
      statement: `Route ${item.routeId} expected ${item.expectedDecision.value}/${item.expectedDecision.actionId} but observed ${item.observedDecision.value}/${item.observedDecision.actionId}.`,
      perspective: 'MACHINE_NATIVE',
      patternTags: ['typed-handoff-route-mismatch'],
      evidenceRef: item.sessionSha256
    })),
    unexpectedSeams: mismatches.map(item => ({
      id: `handoff-route-${item.routeId}`,
      statement: `Exact typed handoff route was not selected for ${item.routeId}.`,
      severity: 'high',
      evidenceRefs: [item.sessionSha256]
    }))
  });
  return { state: mismatches.length > 1 ? 'REPEATED_GAP_FRONTIER_EXAM_REQUIRED' : 'SINGLE_GAP_MORE_EVIDENCE_REQUIRED', assessment };
}

function verifyBatch(batch, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || !batch.inputsDigest || !batch.batchDigest) throw new Error('invalid handoff graph batch');
  if (batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('handoff graph batch digest mismatch');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('handoff graph organ lineage mismatch');
  if (!batch.authority || batch.authority.privateEvaluationTraceWrite !== true ||
      Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvaluationTraceWrite' && value !== false)) throw new Error('handoff graph authority boundary changed');
  if (!Array.isArray(batch.contracts) || batch.contracts.length > MAX_CONTRACTS || !Array.isArray(batch.edges) || batch.edges.length > MAX_EDGES || !Array.isArray(batch.results) || batch.results.length > MAX_ROUTES) throw new Error('handoff graph batch bounds changed');
  const contracts = new Map(batch.contracts.map(item => [item.moduleId, item]));
  if (contracts.size !== batch.contracts.length) throw new Error('handoff graph batch has duplicate modules');
  for (const contract of batch.contracts) {
    if (!contract.contractRelativePath || !/^[a-f0-9]{64}$/.test(contract.contractSha256 || '') ||
        JSON.stringify(contract.emits) !== JSON.stringify(typedList(contract.emits, `${contract.moduleId}.emits`)) ||
        JSON.stringify(contract.accepts) !== JSON.stringify(typedList(contract.accepts, `${contract.moduleId}.accepts`))) {
      throw new Error(`handoff graph contract record is not canonical: ${contract.moduleId}`);
    }
  }
  const expectedInputsDigest = digest({
    organ: ORGAN_ID,
    implementationContract: IMPLEMENTATION_CONTRACT,
    contracts: batch.contracts,
    refused: batch.refusedContracts
  });
  if (batch.inputsDigest !== expectedInputsDigest || batch.batchId !== `reasoning-handoff-graph-${expectedInputsDigest.slice(0, 20)}`) throw new Error('handoff graph input lineage mismatch');
  const expectedGraph = buildGraph({ contracts: batch.contracts });
  if (JSON.stringify(stable(batch.edges)) !== JSON.stringify(stable(expectedGraph.edges))) throw new Error('handoff graph edges are incomplete, extra, or changed');
  const expectedRoutes = buildRoutes(expectedGraph);
  const expectedRouteById = new Map(expectedRoutes.map(item => [item.routeId, item]));
  if (expectedRouteById.size !== batch.results.length) throw new Error('handoff graph route set is incomplete or duplicated');
  const edges = new Map();
  for (const edge of batch.edges) {
    if (edges.has(edge.edgeId)) throw new Error('handoff graph batch has duplicate edges');
    const producer = contracts.get(edge.producerModuleId);
    const consumer = contracts.get(edge.consumerModuleId);
    if (!producer || !consumer || producer.contractSha256 !== edge.producerContractSha256 || consumer.contractSha256 !== edge.consumerContractSha256) throw new Error(`handoff edge contract lineage mismatch: ${edge.edgeId}`);
    HandoffCell.verify(edge.compatibilityReceipt);
    if (!edge.compatibilityReceipt.compatible || edge.compatibilityReceipt.handoffType !== edge.handoffType ||
        edge.compatibilityReceipt.producer.moduleId !== edge.producerModuleId || edge.compatibilityReceipt.consumer.moduleId !== edge.consumerModuleId) throw new Error(`handoff edge is not exactly compatible: ${edge.edgeId}`);
    edges.set(edge.edgeId, edge);
  }
  for (const result of batch.results) {
    const expectedRoute = expectedRouteById.get(result.routeId);
    if (!expectedRoute) throw new Error(`handoff graph has an unexpected route: ${result.routeId}`);
    if (![1, 2].includes(result.depth) || result.edgeIds.length !== result.depth || result.moduleIds.length !== result.depth + 1 || result.handoffTypes.length !== result.depth) throw new Error(`handoff route shape mismatch: ${result.routeId}`);
    const routeEdges = result.edgeIds.map(edgeId => edges.get(edgeId));
    if (routeEdges.some(item => !item)) throw new Error(`handoff route references missing edge: ${result.routeId}`);
    for (let index = 0; index < routeEdges.length; index += 1) {
      const edge = routeEdges[index];
      if (edge.producerModuleId !== result.moduleIds[index] || edge.consumerModuleId !== result.moduleIds[index + 1] || edge.handoffType !== result.handoffTypes[index]) throw new Error(`handoff route sequence mismatch: ${result.routeId}`);
    }
    HandoffCell.verify(result.decoyCompatibilityReceipt);
    if (JSON.stringify(result.edgeIds) !== JSON.stringify(expectedRoute.edgeIds) || JSON.stringify(result.moduleIds) !== JSON.stringify(expectedRoute.moduleIds) ||
        JSON.stringify(result.handoffTypes) !== JSON.stringify(expectedRoute.handoffTypes) || result.decoyModuleId !== expectedRoute.decoy.consumerModuleId ||
        result.decoyCompatibilityReceipt.receiptDigest !== expectedRoute.decoy.compatibilityReceipt.receiptDigest ||
        result.decoyCompatibilityReceipt.compatible || result.decoyCompatibilityReceipt.handoffType !== result.handoffTypes[result.handoffTypes.length - 1]) throw new Error(`handoff route decoy or deterministic composition changed: ${result.routeId}`);
    const expectedDecision = { value: 1, actionId: `propose-${result.routeId}` };
    const matched = result.observedDecision.value === expectedDecision.value && result.observedDecision.actionId === expectedDecision.actionId;
    if (JSON.stringify(stable(result.expectedDecision)) !== JSON.stringify(stable(expectedDecision)) || result.decoyActionId !== `propose-incompatible-${result.routeId}` ||
        result.behaviorMatched !== matched || result.state !== (matched ? 'EXACT_ROUTE_SELECTED' : 'ROUTE_SELECTION_MISMATCH')) throw new Error(`handoff route decision lineage changed: ${result.routeId}`);
    if (result.trainingReceiptCreated !== false || result.worldActionExecuted !== false || result.semanticConsolidation !== false) throw new Error('handoff route evaluation impersonates training or a world outcome');
    if (runDir) {
      const file = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, file) || !fs.existsSync(file)) throw new Error(`handoff route session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(file);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`handoff route session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`handoff route session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  const expectedSummary = {
    discoveredContracts: batch.contracts.length + batch.refusedContracts.length,
    eligibleContracts: batch.contracts.length,
    refusedOrExcludedContracts: batch.refusedContracts.length,
    uniqueEmittedTypes: new Set(batch.contracts.flatMap(item => item.emits)).size,
    uniqueAcceptedTypes: new Set(batch.contracts.flatMap(item => item.accepts)).size,
    exactCrossModuleEdges: batch.edges.length,
    directRoutes: batch.results.filter(item => item.depth === 1).length,
    composedDepthTwoRoutes: batch.results.filter(item => item.depth === 2).length,
    maximumDepth: MAX_DEPTH,
    exactRoutesSelected: batch.results.filter(item => item.behaviorMatched).length,
    routeSelectionMismatches: batch.results.filter(item => !item.behaviorMatched).length,
    incompatibleDecoysRejected: batch.results.filter(item => item.behaviorMatched).length,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary))) throw new Error('handoff graph summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-handoff-graph-runs'));
  if (!inside(root, stateDir)) throw new Error('handoff graph private state must stay inside Mirror root');
  const discovery = discover(workshopRoot);
  const graph = buildGraph(discovery);
  const routeDefinitions = buildRoutes(graph);
  const inputsDigest = digest({
    organ: ORGAN_ID,
    implementationContract: IMPLEMENTATION_CONTRACT,
    contracts: graph.contracts,
    refused: discovery.refused
  });
  const batchId = `reasoning-handoff-graph-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir);
    if (batch.inputsDigest !== inputsDigest) throw new Error('handoff graph run collision');
    return { batch, runDir, reused: true };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const results = [];
  for (const route of routeDefinitions) {
    const input = routeInput(route);
    const expectedDecision = { value: 1, actionId: `propose-${route.routeId}` };
    const decoyActionId = `propose-incompatible-${route.routeId}`;
    const session = Foundation.run(input, { at: '1970-01-01T00:00:00.000Z' });
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const behaviorMatched = observedDecision.value === expectedDecision.value && observedDecision.actionId === expectedDecision.actionId;
    const name = `session-${digest(route.routeId).slice(0, 20)}.json`;
    const relative = path.join('sessions', name).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = {
      routeId: route.routeId,
      depth: route.depth,
      moduleIds: route.moduleIds,
      handoffTypes: route.handoffTypes,
      edgeIds: route.edgeIds,
      decoyModuleId: route.decoy.consumerModuleId,
      decoyCompatibilityReceipt: route.decoy.compatibilityReceipt,
      expectedDecision,
      decoyActionId,
      observedDecision,
      behaviorMatched,
      state: behaviorMatched ? 'EXACT_ROUTE_SELECTED' : 'ROUTE_SELECTION_MISMATCH',
      reasoningSessionId: session.reasoningSessionId,
      sessionFile: relative,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      trainingReceiptCreated: false,
      worldActionExecuted: false,
      semanticConsolidation: false
    };
    verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, relative), bytes, { flag: 'wx' });
    results.push(result);
  }
  const frontier = frontierFor(results);
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_PROPOSAL_ONLY_TYPED_HANDOFF_GRAPH', learnedWeights: false },
    cell: { id: HandoffCell.CELL_ID, schema: HandoffCell.SCHEMA, learnedWeights: false },
    implementationContract: IMPLEMENTATION_CONTRACT,
    refusedContracts: discovery.refused,
    contracts: graph.contracts,
    edges: graph.edges,
    results,
    frontier,
    summary: {
      discoveredContracts: graph.contracts.length + discovery.refused.length,
      eligibleContracts: graph.contracts.length,
      refusedOrExcludedContracts: discovery.refused.length,
      uniqueEmittedTypes: new Set(graph.contracts.flatMap(item => item.emits)).size,
      uniqueAcceptedTypes: new Set(graph.contracts.flatMap(item => item.accepts)).size,
      exactCrossModuleEdges: graph.edges.length,
      directRoutes: results.filter(item => item.depth === 1).length,
      composedDepthTwoRoutes: results.filter(item => item.depth === 2).length,
      maximumDepth: MAX_DEPTH,
      exactRoutesSelected: results.filter(item => item.behaviorMatched).length,
      routeSelectionMismatches: results.filter(item => !item.behaviorMatched).length,
      incompatibleDecoysRejected: results.filter(item => item.behaviorMatched).length,
      trainingReceiptsCreated: 0,
      worldActionsExecuted: 0
    },
    authority: {
      privateEvaluationTraceWrite: true,
      trainingAdmission: false,
      contractWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      permissionGrant: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The organ proposes and evaluates exact typed module routes only. Compatibility does not imply semantic suitability, permission, execution, real-world success, training evidence, or promotion. Generated wording has no decision authority.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  fs.renameSync(stageDir, runDir);
  return { batch, runDir, reused: false };
}

function plan(batchOrDerived, request) {
  const batch = batchOrDerived && batchOrDerived.batch || batchOrDerived;
  verifyBatch(batch);
  if (!request || request.schema !== REQUEST_SCHEMA || typeof request !== 'object' || Array.isArray(request)) throw new Error(`handoff route request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'sourceModuleId', 'targetModuleId', 'maximumDepth'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical handoff route request fields: ${unexpected.join(', ')}`);
  const sourceModuleId = token(request.sourceModuleId, '');
  const targetModuleId = token(request.targetModuleId, '');
  if (!sourceModuleId || !targetModuleId) throw new Error('handoff route request requires sourceModuleId and targetModuleId');
  const maximumDepth = Math.max(1, Math.min(MAX_DEPTH, Number(request.maximumDepth) || MAX_DEPTH));
  const moduleIds = new Set(batch.contracts.map(item => item.moduleId));
  let state = 'PROPOSED_EXACT_TYPED_ROUTES';
  let reason = 'Every adjacent interface has an independent exact-compatibility receipt.';
  let proposals = [];
  if (!moduleIds.has(sourceModuleId) || !moduleIds.has(targetModuleId)) {
    state = 'HOLD_UNKNOWN_MODULE';
    reason = 'The current content-digested contract graph does not contain both requested module IDs.';
  } else {
    proposals = batch.results.filter(item => item.depth <= maximumDepth && item.moduleIds[0] === sourceModuleId && item.moduleIds[item.moduleIds.length - 1] === targetModuleId && item.behaviorMatched)
      .sort((a, b) => a.depth - b.depth || a.routeId.localeCompare(b.routeId)).slice(0, 8).map(item => ({
        routeId: item.routeId,
        depth: item.depth,
        moduleIds: item.moduleIds,
        handoffTypes: item.handoffTypes,
        compatibilityReceiptDigests: item.edgeIds.map(edgeId => batch.edges.find(edge => edge.edgeId === edgeId).compatibilityReceipt.receiptDigest),
        reasoningSessionId: item.reasoningSessionId,
        state: 'REVIEWABLE_PROPOSAL_NOT_EXECUTED'
      }));
    if (!proposals.length) {
      state = 'HOLD_NO_EXACT_TYPED_ROUTE';
      reason = `No depth-${maximumDepth}-or-less path exists using exact handoffs.emits[] to handoffs.accepts[] equality.`;
    }
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    sourceBatchDigest: batch.batchDigest,
    request: { sourceModuleId, targetModuleId, maximumDepth },
    state,
    reason,
    proposals,
    humanRenderingAuthority: false,
    authority: {
      execution: false,
      contractWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      permissionGrant: false,
      semanticTruthWrite: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'A compatible route is a proposal over exact typed interfaces. It is not permission to invoke modules, proof that the route satisfies the human goal, or a real-world outcome.'
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, IMPLEMENTATION_CONTRACT,
  MAX_CONTRACTS, MAX_INTERFACES_PER_DIRECTION, MAX_EDGES, MAX_ROUTES, MAX_DEPTH,
  digest, discover, buildGraph, buildRoutes, routeInput, verifySession, verifyBatch, derive, plan
};
