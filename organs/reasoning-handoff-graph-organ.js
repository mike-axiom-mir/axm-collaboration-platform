'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Frontier = require('../kernel/frontier-cell');
const HandoffCell = require('../kernel/contract-handoff-cell');
const BindingCell = require('../kernel/contract-manifest-binding-cell');
const LegacyV1 = require('./reasoning-handoff-graph-organ-v1-known-fail');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/reasoning-handoff-graph-v2';
const BATCH_SCHEMA = 'axm.mirror.reasoning-handoff-route-batch/v2';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-handoff-route-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-handoff-route-response/v2';
const MAX_CONTRACTS = 64;
const MAX_INTERFACES_PER_DIRECTION = 64;
const MAX_EDGES = 256;
const MAX_ROUTES = 256;
const MAX_DEPTH = 2;
const IMPLEMENTATION_CONTRACT = Object.freeze({
  version: 'manifest-bound-exact-typed-handoff-graph-v2',
  admissionRule: 'manifest.contract safely resolves to the exact content-digested contract and manifest.id equals contract.id',
  permissionDeclarationRule: 'every contract.permissions[] value is present in manifest.uses[]',
  edgeRule: 'admitted producer.handoffs.emits[] exact-match admitted consumer.handoffs.accepts[]',
  routeRule: 'all non-cyclic paths at depth one and two over admitted edges',
  decoyRule: 'preserve exact handoffs but remove the terminal manifest-to-contract declaration',
  consumesInterpretation: 'NOT_INFERRED_AS_ALL_REQUIRED_INPUTS',
  runtimeReadinessInterpretation: 'UNKNOWN_UNLESS_SEPARATELY_PROBED',
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

function digest(value) { return LegacyV1.digest(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('./reasoning-handoff-graph-organ-v1-known-fail'),
    require.resolve('../kernel/contract-handoff-cell'),
    require.resolve('../kernel/contract-manifest-binding-cell'),
    path.join(root, 'contracts', 'contract-manifest-binding.schema.json'),
    path.join(root, 'contracts', 'reasoning-handoff-route-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-handoff-route-response-v2.schema.json'),
    path.join(root, 'contracts', 'reasoning-handoff-route-batch-v2.schema.json')
  ];
  return files.map(file => ({
    path: relative(root, file),
    sha256: digest(fs.readFileSync(file))
  }));
}

function clean(value, maximum = 240) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum);
}

function token(value, fallback = 'handoff') {
  const result = clean(value, 160).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  return result || fallback;
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !!relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function typedList(value, field) {
  if (!Array.isArray(value) || value.length > MAX_INTERFACES_PER_DIRECTION) throw new Error(`${field} must be a bounded array`);
  const rows = value.map(item => clean(item));
  if (rows.some(item => !item) || new Set(rows).size !== rows.length) throw new Error(`${field} must contain unique non-empty typed identifiers`);
  return rows.slice().sort();
}

function safeRegularFile(root, file) {
  if (!inside(root, file) || !fs.existsSync(file)) return false;
  const info = fs.lstatSync(file);
  return info.isFile() && !info.isSymbolicLink();
}

function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }

function contractEvidence(record) {
  return {
    moduleId: record.moduleId,
    contractRelativePath: record.contractRelativePath,
    contractSha256: record.contractSha256,
    permissions: record.permissions.slice()
  };
}

function manifestEvidence(record) {
  return {
    moduleId: record.manifestModuleId,
    manifestRelativePath: record.manifestRelativePath,
    manifestSha256: record.manifestSha256,
    declaredContractRelativePath: record.declaredContractRelativePath,
    uses: record.manifestUses.slice()
  };
}

function readContractRecord(root, directory, contractFile, manifestRecord) {
  if (!safeRegularFile(directory, contractFile)) throw new Error('declared contract path is missing, unsafe, or symbolic');
  const bytes = fs.readFileSync(contractFile);
  const contract = JSON.parse(bytes.toString('utf8'));
  if (contract.schema !== 'axm.module-contract/v1' || !contract.handoffs || typeof contract.handoffs !== 'object') {
    throw new Error('contract schema or handoffs object mismatch');
  }
  const record = {
    moduleId: clean(contract.id, 120),
    contractFile,
    contractRelativePath: relative(root, contractFile),
    contractSha256: digest(bytes),
    permissions: typedList(contract.permissions, `${contract.id}.permissions`),
    emits: typedList(contract.handoffs.emits, `${contract.id}.handoffs.emits`),
    accepts: typedList(contract.handoffs.accepts, `${contract.id}.handoffs.accepts`),
    manifestModuleId: manifestRecord.moduleId,
    manifestRelativePath: manifestRecord.manifestRelativePath,
    manifestSha256: manifestRecord.manifestSha256,
    declaredContractRelativePath: manifestRecord.declaredContractRelativePath,
    manifestUses: manifestRecord.uses
  };
  if (!record.moduleId) throw new Error('contract module ID is required');
  record.bindingReceipt = BindingCell.evaluate({ contract: contractEvidence(record), manifest: manifestEvidence(record) });
  return record;
}

function discover(workshopRoot) {
  const root = path.resolve(workshopRoot);
  const toolsRoot = path.join(root, 'tools');
  if (!fs.existsSync(toolsRoot) || !fs.statSync(toolsRoot).isDirectory()) throw new Error(`Workshop tools root missing: ${toolsRoot}`);
  const contracts = [];
  const refused = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      refused.push({ directory: entry.name, state: 'REFUSED_SYMBOLIC_LINK_DIRECTORY' });
      continue;
    }
    if (!entry.isDirectory()) continue;
    const directory = path.join(toolsRoot, entry.name);
    const conventionalContract = path.join(directory, 'module.contract.json');
    const manifestFile = path.join(directory, 'manifest.json');
    if (!fs.existsSync(conventionalContract) && !fs.existsSync(manifestFile)) continue;
    if (entry.name.startsWith('_')) {
      if (fs.existsSync(conventionalContract)) refused.push({ directory: entry.name, state: 'EXCLUDED_TEMPLATE' });
      continue;
    }
    if (!safeRegularFile(directory, manifestFile)) {
      if (fs.existsSync(conventionalContract)) refused.push({ directory: entry.name, moduleId: entry.name, state: 'REFUSED_MISSING_OR_UNSAFE_MANIFEST' });
      continue;
    }
    let manifest;
    let manifestBytes;
    try {
      manifestBytes = fs.readFileSync(manifestFile);
      manifest = JSON.parse(manifestBytes.toString('utf8'));
    } catch (error) {
      refused.push({ directory: entry.name, moduleId: entry.name, state: 'REFUSED_INVALID_MANIFEST_JSON', reason: clean(error.message || error, 300) });
      continue;
    }
    const manifestRecord = {
      moduleId: clean(manifest.id, 120),
      manifestRelativePath: relative(root, manifestFile),
      manifestSha256: digest(manifestBytes),
      declaredContractRelativePath: '',
      uses: []
    };
    try {
      manifestRecord.uses = typedList(manifest.uses, `${manifest.id || entry.name}.manifest.uses`);
    } catch (error) {
      refused.push({ directory: entry.name, moduleId: manifestRecord.moduleId || entry.name, state: 'REFUSED_INVALID_MANIFEST_USES', reason: clean(error.message || error, 300) });
      continue;
    }
    const declared = typeof manifest.contract === 'string' && manifest.contract.trim();
    if (!declared) {
      if (!fs.existsSync(conventionalContract)) continue;
      try {
        const record = readContractRecord(root, directory, conventionalContract, manifestRecord);
        refused.push({
          directory: entry.name,
          moduleId: record.moduleId,
          state: 'REFUSED_MANIFEST_DOES_NOT_DECLARE_CONTRACT',
          contractRelativePath: record.contractRelativePath,
          contractSha256: record.contractSha256,
          manifestRelativePath: record.manifestRelativePath,
          manifestSha256: record.manifestSha256,
          bindingReceipt: record.bindingReceipt
        });
      } catch (error) {
        refused.push({ directory: entry.name, moduleId: manifestRecord.moduleId || entry.name, state: 'REFUSED_INVALID_UNDECLARED_CONTRACT', reason: clean(error.message || error, 300) });
      }
      continue;
    }
    const contractFile = path.resolve(directory, manifest.contract);
    if (!inside(directory, contractFile) || !safeRegularFile(directory, contractFile)) {
      refused.push({ directory: entry.name, moduleId: manifestRecord.moduleId || entry.name, state: 'REFUSED_UNSAFE_OR_MISSING_DECLARED_CONTRACT_PATH' });
      continue;
    }
    manifestRecord.declaredContractRelativePath = relative(root, contractFile);
    try {
      const record = readContractRecord(root, directory, contractFile, manifestRecord);
      if (record.moduleId !== entry.name) throw new Error('contract ID does not match module directory');
      if (!record.bindingReceipt.bound) {
        refused.push({
          directory: entry.name,
          moduleId: record.moduleId,
          state: 'REFUSED_CONTRACT_MANIFEST_BINDING',
          contractRelativePath: record.contractRelativePath,
          contractSha256: record.contractSha256,
          manifestRelativePath: record.manifestRelativePath,
          manifestSha256: record.manifestSha256,
          bindingReceipt: record.bindingReceipt
        });
        continue;
      }
      contracts.push(record);
    } catch (error) {
      refused.push({ directory: entry.name, moduleId: manifestRecord.moduleId || entry.name, state: 'REFUSED_INVALID_OR_MISMATCHED_DECLARED_CONTRACT', reason: clean(error.message || error, 300) });
    }
  }
  if (contracts.length > MAX_CONTRACTS) throw new Error(`handoff graph holds: ${contracts.length} eligible contracts exceed the ${MAX_CONTRACTS} contract bound`);
  if (new Set(contracts.map(item => item.moduleId)).size !== contracts.length) throw new Error('handoff graph refuses duplicate module IDs');
  return { workshopRoot: root, toolsRoot, contracts, refused };
}

function publicContract(record) {
  return {
    moduleId: record.moduleId,
    contractRelativePath: record.contractRelativePath,
    contractSha256: record.contractSha256,
    permissions: record.permissions.slice(),
    emits: record.emits.slice(),
    accepts: record.accepts.slice(),
    manifestRelativePath: record.manifestRelativePath,
    manifestSha256: record.manifestSha256,
    manifestDeclaredContractRelativePath: record.declaredContractRelativePath,
    manifestUses: record.manifestUses.slice(),
    bindingReceipt: record.bindingReceipt
  };
}

function buildGraph(discovery) {
  const base = LegacyV1.buildGraph({ contracts: discovery.contracts });
  const source = new Map(discovery.contracts.map(item => [item.moduleId, item]));
  const contracts = base.contracts.map(item => Object.assign({}, item, publicContract(source.get(item.moduleId))));
  return { contracts, edges: base.edges };
}

function unboundDecoyFor(route, graph) {
  const terminal = graph.contracts.find(item => item.moduleId === route.moduleIds[route.moduleIds.length - 1]);
  if (!terminal) throw new Error(`handoff route terminal contract missing: ${route.routeId}`);
  const manifest = clone(terminal.bindingReceipt.manifest);
  manifest.declaredContractRelativePath = '';
  const receipt = BindingCell.evaluate({ contract: terminal.bindingReceipt.contract, manifest });
  if (receipt.bound) throw new Error('generated unbound manifest decoy unexpectedly passed');
  return receipt;
}

function buildRoutes(graph) {
  return LegacyV1.buildRoutes(graph).map(route => Object.assign(route, { unboundDecoy: unboundDecoyFor(route, graph) }));
}

function routeInput(route, graph, sessionId) {
  const edgeEvidence = route.edges.map((edge, index) => ({
    id: `exact-handoff-${index + 1}`,
    kind: 'test',
    status: 'tested',
    statement: `${edge.producerModuleId} emits ${edge.handoffType} and ${edge.consumerModuleId} accepts the same typed identifier.`,
    source: { kind: 'contract-handoff-compatibility-receipt', id: edge.compatibilityReceipt.receiptDigest, uri: `sha256:${edge.compatibilityReceipt.receiptDigest}` },
    confidence: { low: 1, high: 1, basis: 'Independent exact-membership compatibility receipt.' }
  }));
  const bindingEvidence = route.moduleIds.map((moduleId, index) => {
    const record = graph.contracts.find(item => item.moduleId === moduleId);
    return {
      id: `manifest-binding-${index + 1}`,
      kind: 'test',
      status: 'tested',
      statement: `${moduleId} is bound to its exact contract by its content-digested manifest declaration.`,
      source: { kind: 'contract-manifest-binding-receipt', id: record.bindingReceipt.receiptDigest, uri: `sha256:${record.bindingReceipt.receiptDigest}` },
      confidence: { low: 1, high: 1, basis: 'Independent manifest-to-contract binding and permission-declaration receipt.' }
    };
  });
  const decoyEvidenceId = 'unbound-terminal-contract';
  const decoyEvidence = {
    id: decoyEvidenceId,
    kind: 'test',
    status: 'tested',
    statement: `The terminal contract is not declared by its manifest in this structural counterexample.`,
    source: { kind: 'contract-manifest-binding-receipt', id: route.unboundDecoy.receiptDigest, uri: `sha256:${route.unboundDecoy.receiptDigest}` },
    confidence: { low: 1, high: 1, basis: 'Independent failed manifest-to-contract binding receipt.' }
  };
  const support = edgeEvidence.concat(bindingEvidence).map(item => item.id);
  const validActionId = `propose-${route.routeId}`;
  const decoyActionId = `propose-unbound-${route.routeId}`;
  const validAction = {
    id: validActionId,
    kind: 'proposal',
    label: `Propose manifest-bound exact typed route ${route.moduleIds.join(' -> ')}`,
    requiredPermissions: [],
    supportingEvidence: support,
    preconditionEvidence: support,
    expectedEffects: ['A reviewable route proposal is produced; no module is invoked.'],
    possibleSideEffects: ['The proposal may still be unsuitable or unavailable at runtime.'],
    reversible: true,
    recovery: 'Discard the proposal; no Workshop module or artifact was changed.',
    risk: 'low'
  };
  const decoyAction = {
    id: decoyActionId,
    kind: 'proposal',
    label: `Propose the same typed route without a terminal manifest binding`,
    requiredPermissions: [],
    supportingEvidence: edgeEvidence.map(item => item.id).concat(decoyEvidenceId),
    preconditionEvidence: edgeEvidence.map(item => item.id).concat(decoyEvidenceId),
    expectedEffects: ['An orphan contract file would influence a route proposal.'],
    possibleSideEffects: ['A file not declared as the module contract could be mistaken for authority.'],
    reversible: true,
    recovery: 'Discard the proposal; no Workshop module or artifact was changed.',
    risk: 'low'
  };
  const actions = parseInt(digest(route.routeId).slice(0, 2), 16) % 2 ? [decoyAction, validAction] : [validAction, decoyAction];
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: sessionId || `manifest-bound-handoff-exam-${digest(route.routeId).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-manifest-bound-handoff-graph-organ' },
    goal: 'Choose the supplied route whose adjacent handoffs match exactly and whose module contracts are explicitly bound by their manifests.',
    evidence: edgeEvidence.concat(bindingEvidence, decoyEvidence),
    unknowns: ['Runtime readiness remains unknown unless separately probed.'],
    assumptions: [],
    constraints: [],
    permissions: [],
    actions,
    decomposition: [{
      id: 'check-adjacent-handoffs',
      question: 'Does every adjacent producer emission exactly match the next consumer acceptance?',
      dependsOn: [],
      cheapestCheck: 'Use independent contract-handoff compatibility receipts.',
      status: 'ANSWERED',
      answerEvidenceRefs: edgeEvidence.map(item => item.id)
    }, {
      id: 'check-manifest-contract-bindings',
      question: 'Does every route module manifest explicitly bind the exact contract supplying this graph evidence?',
      dependsOn: ['check-adjacent-handoffs'],
      cheapestCheck: 'Use independent manifest-to-contract binding receipts.',
      status: 'ANSWERED',
      answerEvidenceRefs: bindingEvidence.map(item => item.id).concat(decoyEvidenceId)
    }],
    pathProfiles: [{
      actionId: validActionId,
      pathId: `path-${route.routeId}`,
      approach: 'Require exact typed handoffs and exact manifest-to-contract binding receipts.',
      requiredEvidence: support,
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: 1,
      reversible: true,
      failureConditions: ['Any compatibility or binding receipt fails or any source digest changes.'],
      strategyTags: ['follow-manifest-bound-exact-typed-handoff']
    }, {
      actionId: decoyActionId,
      pathId: `path-unbound-${route.routeId}`,
      approach: 'Use exact handoffs while trusting an undeclared contract file.',
      requiredEvidence: edgeEvidence.map(item => item.id).concat(decoyEvidenceId),
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: 0,
      reversible: true,
      failureConditions: ['The terminal manifest does not declare the contract file.'],
      strategyTags: ['reject-unbound-contract-evidence']
    }],
    verificationReceipts: [{
      id: `verify-${route.routeId}`,
      actionId: validActionId,
      claim: 'Every adjacent handoff is exact and every module contract is manifest-bound.',
      evidenceRefs: support,
      method: 'Independent exact-membership and manifest-binding receipts.',
      result: 'PASS',
      limitations: ['Declaration integrity does not prove permission grant, runtime readiness, semantic suitability, or execution success.']
    }, {
      id: `verify-unbound-${route.routeId}`,
      actionId: decoyActionId,
      claim: 'The terminal manifest binds the supplied contract evidence.',
      evidenceRefs: [decoyEvidenceId],
      method: 'Independent manifest-to-contract binding receipt.',
      result: 'FAIL',
      limitations: ['This is a generated structural counterexample, not a real module invocation.']
    }],
    budget: { maxCandidates: 4, deadlineMs: 1000 }
  };
}

function frontierFor(results) {
  const mismatches = results.filter(item => !item.behaviorMatched);
  if (!mismatches.length) return { state: 'NO_UNEXPECTED_SEAM', assessment: null };
  const assessment = Frontier.inspect({
    subject: { id: 'manifest-bound-typed-handoff-route-composition', statement: 'Originate bounded routes only from exact typed handoffs and manifest-bound contracts.', domain: 'reasoning-foundation' },
    observations: mismatches.map(item => ({
      id: item.reasoningSessionId,
      domain: 'contract-handoff-graph',
      statement: `Route ${item.routeId} expected ${item.expectedDecision.value}/${item.expectedDecision.actionId} but observed ${item.observedDecision.value}/${item.observedDecision.actionId}.`,
      perspective: 'MACHINE_NATIVE',
      patternTags: ['manifest-bound-handoff-route-mismatch'],
      evidenceRef: item.sessionSha256
    })),
    unexpectedSeams: mismatches.map(item => ({
      id: `manifest-bound-handoff-route-${item.routeId}`,
      statement: `Manifest-bound exact typed route was not selected for ${item.routeId}.`,
      severity: 'high',
      evidenceRefs: [item.sessionSha256]
    }))
  });
  return { state: mismatches.length > 1 ? 'REPEATED_GAP_FRONTIER_EXAM_REQUIRED' : 'SINGLE_GAP_MORE_EVIDENCE_REQUIRED', assessment };
}

function verifyBatch(batch, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || !batch.inputsDigest || !batch.batchDigest) throw new Error('invalid manifest-bound handoff graph batch');
  if (batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('manifest-bound handoff graph batch digest mismatch');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('manifest-bound handoff graph organ lineage mismatch');
  if (!batch.authority || batch.authority.privateEvaluationTraceWrite !== true ||
      Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvaluationTraceWrite' && value !== false)) throw new Error('manifest-bound handoff graph authority boundary changed');
  if (!Array.isArray(batch.contracts) || batch.contracts.length > MAX_CONTRACTS || !Array.isArray(batch.edges) || batch.edges.length > MAX_EDGES || !Array.isArray(batch.results) || batch.results.length > MAX_ROUTES || !Array.isArray(batch.refusedContracts)) throw new Error('manifest-bound handoff graph bounds changed');
  const contracts = new Map(batch.contracts.map(item => [item.moduleId, item]));
  if (contracts.size !== batch.contracts.length) throw new Error('manifest-bound handoff graph batch has duplicate modules');
  for (const contract of batch.contracts) {
    BindingCell.verify(contract.bindingReceipt);
    if (!contract.bindingReceipt.bound || contract.bindingReceipt.contract.moduleId !== contract.moduleId ||
        contract.bindingReceipt.contract.contractSha256 !== contract.contractSha256 || contract.bindingReceipt.manifest.manifestSha256 !== contract.manifestSha256 ||
        contract.bindingReceipt.manifest.declaredContractRelativePath !== contract.contractRelativePath ||
        JSON.stringify(contract.emits) !== JSON.stringify(typedList(contract.emits, `${contract.moduleId}.emits`)) ||
        JSON.stringify(contract.accepts) !== JSON.stringify(typedList(contract.accepts, `${contract.moduleId}.accepts`)) ||
        JSON.stringify(contract.permissions) !== JSON.stringify(typedList(contract.permissions, `${contract.moduleId}.permissions`)) ||
        JSON.stringify(contract.manifestUses) !== JSON.stringify(typedList(contract.manifestUses, `${contract.moduleId}.manifestUses`))) {
      throw new Error(`manifest-bound handoff contract record is not canonical: ${contract.moduleId}`);
    }
  }
  for (const refused of batch.refusedContracts) {
    if (refused.bindingReceipt) {
      BindingCell.verify(refused.bindingReceipt);
      if (refused.bindingReceipt.bound) throw new Error(`refused manifest binding unexpectedly passed: ${refused.moduleId}`);
    }
  }
  const currentSourceLineage = sourceLineage();
  if (JSON.stringify(stable(batch.sourceLineage)) !== JSON.stringify(stable(currentSourceLineage))) throw new Error('manifest-bound handoff graph source lineage mismatch');
  const expectedInputsDigest = digest({ organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: currentSourceLineage, contracts: batch.contracts, refused: batch.refusedContracts });
  if (batch.inputsDigest !== expectedInputsDigest || batch.batchId !== `reasoning-handoff-graph-${expectedInputsDigest.slice(0, 20)}`) throw new Error('manifest-bound handoff graph input lineage mismatch');
  const expectedGraph = LegacyV1.buildGraph({ contracts: batch.contracts });
  if (JSON.stringify(stable(batch.edges)) !== JSON.stringify(stable(expectedGraph.edges))) throw new Error('manifest-bound handoff graph edges are incomplete, extra, or changed');
  const graph = { contracts: batch.contracts, edges: batch.edges };
  const expectedRoutes = buildRoutes(graph);
  const expectedRouteById = new Map(expectedRoutes.map(item => [item.routeId, item]));
  if (expectedRouteById.size !== batch.results.length) throw new Error('manifest-bound handoff route set is incomplete or duplicated');
  const edges = new Map();
  for (const edge of batch.edges) {
    if (edges.has(edge.edgeId)) throw new Error('manifest-bound handoff graph has duplicate edges');
    const producer = contracts.get(edge.producerModuleId);
    const consumer = contracts.get(edge.consumerModuleId);
    if (!producer || !consumer || producer.contractSha256 !== edge.producerContractSha256 || consumer.contractSha256 !== edge.consumerContractSha256) throw new Error(`manifest-bound handoff edge lineage mismatch: ${edge.edgeId}`);
    HandoffCell.verify(edge.compatibilityReceipt);
    if (!edge.compatibilityReceipt.compatible) throw new Error(`manifest-bound handoff edge is not exactly compatible: ${edge.edgeId}`);
    edges.set(edge.edgeId, edge);
  }
  for (const result of batch.results) {
    const expectedRoute = expectedRouteById.get(result.routeId);
    if (!expectedRoute) throw new Error(`manifest-bound handoff graph has an unexpected route: ${result.routeId}`);
    if (![1, 2].includes(result.depth) || result.edgeIds.length !== result.depth || result.moduleIds.length !== result.depth + 1 || result.handoffTypes.length !== result.depth) throw new Error(`manifest-bound handoff route shape mismatch: ${result.routeId}`);
    if (result.moduleIds.some(moduleId => !contracts.has(moduleId))) throw new Error(`manifest-bound handoff route references an unbound module: ${result.routeId}`);
    const routeEdges = result.edgeIds.map(edgeId => edges.get(edgeId));
    if (routeEdges.some(item => !item)) throw new Error(`manifest-bound handoff route references a missing edge: ${result.routeId}`);
    for (let index = 0; index < routeEdges.length; index += 1) {
      const edge = routeEdges[index];
      if (edge.producerModuleId !== result.moduleIds[index] || edge.consumerModuleId !== result.moduleIds[index + 1] || edge.handoffType !== result.handoffTypes[index]) throw new Error(`manifest-bound handoff route sequence mismatch: ${result.routeId}`);
    }
    const bindingDigests = result.moduleIds.map(moduleId => contracts.get(moduleId).bindingReceipt.receiptDigest);
    BindingCell.verify(result.decoyBindingReceipt);
    if (result.decoyBindingReceipt.bound || result.decoyBindingReceipt.receiptDigest !== expectedRoute.unboundDecoy.receiptDigest ||
        JSON.stringify(result.edgeIds) !== JSON.stringify(expectedRoute.edgeIds) || JSON.stringify(result.moduleIds) !== JSON.stringify(expectedRoute.moduleIds) ||
        JSON.stringify(result.handoffTypes) !== JSON.stringify(expectedRoute.handoffTypes) || JSON.stringify(result.manifestBindingReceiptDigests) !== JSON.stringify(bindingDigests)) {
      throw new Error(`manifest-bound handoff route binding evidence changed: ${result.routeId}`);
    }
    const expectedDecision = { value: 1, actionId: `propose-${result.routeId}` };
    const matched = result.observedDecision.value === expectedDecision.value && result.observedDecision.actionId === expectedDecision.actionId;
    if (JSON.stringify(stable(result.expectedDecision)) !== JSON.stringify(stable(expectedDecision)) || result.decoyActionId !== `propose-unbound-${result.routeId}` ||
        result.behaviorMatched !== matched || result.state !== (matched ? 'MANIFEST_BOUND_EXACT_ROUTE_SELECTED' : 'ROUTE_SELECTION_MISMATCH')) throw new Error(`manifest-bound handoff route decision lineage changed: ${result.routeId}`);
    if (result.trainingReceiptCreated !== false || result.worldActionExecuted !== false || result.semanticConsolidation !== false) throw new Error('manifest-bound handoff evaluation impersonates training or a world outcome');
    if (runDir) {
      const file = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, file) || !fs.existsSync(file)) throw new Error(`manifest-bound handoff route session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(file);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`manifest-bound handoff route session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`manifest-bound handoff route session lineage mismatch: ${result.reasoningSessionId}`);
      LegacyV1.verifySession(session, result);
    }
  }
  const failedBindings = batch.refusedContracts.filter(item => item.bindingReceipt && !item.bindingReceipt.bound).length;
  const expectedSummary = {
    discoveredContracts: batch.contracts.length + batch.refusedContracts.length,
    eligibleContracts: batch.contracts.length,
    refusedOrExcludedContracts: batch.refusedContracts.length,
    manifestBindingsPassed: batch.contracts.length,
    manifestBindingsFailed: failedBindings,
    undeclaredContractFiles: batch.refusedContracts.filter(item => item.state === 'REFUSED_MANIFEST_DOES_NOT_DECLARE_CONTRACT').length,
    uniqueEmittedTypes: new Set(batch.contracts.flatMap(item => item.emits)).size,
    uniqueAcceptedTypes: new Set(batch.contracts.flatMap(item => item.accepts)).size,
    exactCrossModuleEdges: batch.edges.length,
    directRoutes: batch.results.filter(item => item.depth === 1).length,
    composedDepthTwoRoutes: batch.results.filter(item => item.depth === 2).length,
    maximumDepth: MAX_DEPTH,
    exactRoutesSelected: batch.results.filter(item => item.behaviorMatched).length,
    routeSelectionMismatches: batch.results.filter(item => !item.behaviorMatched).length,
    unboundDecoysRejected: batch.results.filter(item => item.behaviorMatched).length,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary))) throw new Error('manifest-bound handoff graph summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-handoff-graph-runs'));
  if (!inside(root, stateDir)) throw new Error('manifest-bound handoff private state must stay inside Mirror root');
  const discovery = discover(workshopRoot);
  const graph = buildGraph(discovery);
  const routeDefinitions = buildRoutes(graph);
  const lineage = sourceLineage();
  const inputsDigest = digest({ organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: lineage, contracts: graph.contracts, refused: discovery.refused });
  const batchId = `reasoning-handoff-graph-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir);
    if (batch.inputsDigest !== inputsDigest) throw new Error('manifest-bound handoff graph run collision');
    return { batch, runDir, reused: true };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const results = [];
  for (const route of routeDefinitions) {
    const input = routeInput(route, graph);
    const expectedDecision = { value: 1, actionId: `propose-${route.routeId}` };
    const decoyActionId = `propose-unbound-${route.routeId}`;
    const session = Foundation.run(input, { at: '1970-01-01T00:00:00.000Z' });
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const behaviorMatched = observedDecision.value === expectedDecision.value && observedDecision.actionId === expectedDecision.actionId;
    const name = `session-${digest(route.routeId).slice(0, 20)}.json`;
    const relativeSession = path.join('sessions', name).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = {
      routeId: route.routeId,
      depth: route.depth,
      moduleIds: route.moduleIds,
      handoffTypes: route.handoffTypes,
      edgeIds: route.edgeIds,
      manifestBindingReceiptDigests: route.moduleIds.map(moduleId => graph.contracts.find(item => item.moduleId === moduleId).bindingReceipt.receiptDigest),
      decoyBindingReceipt: route.unboundDecoy,
      expectedDecision,
      decoyActionId,
      observedDecision,
      behaviorMatched,
      state: behaviorMatched ? 'MANIFEST_BOUND_EXACT_ROUTE_SELECTED' : 'ROUTE_SELECTION_MISMATCH',
      reasoningSessionId: session.reasoningSessionId,
      sessionFile: relativeSession,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      trainingReceiptCreated: false,
      worldActionExecuted: false,
      semanticConsolidation: false
    };
    LegacyV1.verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, relativeSession), bytes, { flag: 'wx' });
    results.push(result);
  }
  const frontier = frontierFor(results);
  const failedBindings = discovery.refused.filter(item => item.bindingReceipt && !item.bindingReceipt.bound).length;
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_MANIFEST_BOUND_PROPOSAL_ONLY_TYPED_HANDOFF_GRAPH', learnedWeights: false },
    cells: {
      handoffCompatibility: { id: HandoffCell.CELL_ID, schema: HandoffCell.SCHEMA, learnedWeights: false },
      contractManifestBinding: { id: BindingCell.CELL_ID, schema: BindingCell.SCHEMA, learnedWeights: false }
    },
    implementationContract: IMPLEMENTATION_CONTRACT,
    sourceLineage: lineage,
    knownFailSupersession: {
      organId: LegacyV1.ORGAN_ID,
      state: 'KNOWN_FAIL_UNDECLARED_CONTRACT_FILES_ENTERED_GRAPH',
      preservedBatchId: 'reasoning-handoff-graph-e892a17be6dd49a06248',
      observedContamination: { undeclaredContractFiles: 6, edges: 4, routes: 7 }
    },
    refusedContracts: discovery.refused,
    contracts: graph.contracts,
    edges: graph.edges,
    results,
    frontier,
    summary: {
      discoveredContracts: graph.contracts.length + discovery.refused.length,
      eligibleContracts: graph.contracts.length,
      refusedOrExcludedContracts: discovery.refused.length,
      manifestBindingsPassed: graph.contracts.length,
      manifestBindingsFailed: failedBindings,
      undeclaredContractFiles: discovery.refused.filter(item => item.state === 'REFUSED_MANIFEST_DOES_NOT_DECLARE_CONTRACT').length,
      uniqueEmittedTypes: new Set(graph.contracts.flatMap(item => item.emits)).size,
      uniqueAcceptedTypes: new Set(graph.contracts.flatMap(item => item.accepts)).size,
      exactCrossModuleEdges: graph.edges.length,
      directRoutes: results.filter(item => item.depth === 1).length,
      composedDepthTwoRoutes: results.filter(item => item.depth === 2).length,
      maximumDepth: MAX_DEPTH,
      exactRoutesSelected: results.filter(item => item.behaviorMatched).length,
      routeSelectionMismatches: results.filter(item => !item.behaviorMatched).length,
      unboundDecoysRejected: results.filter(item => item.behaviorMatched).length,
      trainingReceiptsCreated: 0,
      worldActionsExecuted: 0
    },
    authority: {
      privateEvaluationTraceWrite: true,
      trainingAdmission: false,
      contractWrite: false,
      manifestWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      permissionGrant: false,
      runtimeReadinessClaim: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The organ proposes and evaluates routes only when exact typed interfaces and exact manifest-to-contract bindings pass. Declared permissions are not granted permissions. Runtime readiness, semantic suitability, execution, success, training, and promotion remain unclaimed.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
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
  const refusedIds = new Set(batch.refusedContracts.map(item => item.moduleId).filter(Boolean));
  let state = 'PROPOSED_MANIFEST_BOUND_EXACT_TYPED_ROUTES';
  let reason = 'Every adjacent interface and every manifest-to-contract declaration has an independent digest-bound receipt.';
  let proposals = [];
  if (refusedIds.has(sourceModuleId) || refusedIds.has(targetModuleId)) {
    state = 'HOLD_UNBOUND_MODULE_CONTRACT';
    reason = 'At least one requested module has a local contract file that its manifest does not safely bind; orphan contract evidence cannot enter the route graph.';
  } else if (!moduleIds.has(sourceModuleId) || !moduleIds.has(targetModuleId)) {
    state = 'HOLD_UNKNOWN_MODULE';
    reason = 'The current manifest-bound contract graph does not contain both requested module IDs.';
  } else {
    proposals = batch.results.filter(item => item.depth <= maximumDepth && item.moduleIds[0] === sourceModuleId && item.moduleIds[item.moduleIds.length - 1] === targetModuleId && item.behaviorMatched)
      .sort((a, b) => a.depth - b.depth || a.routeId.localeCompare(b.routeId)).slice(0, 8).map(item => ({
        routeId: item.routeId,
        depth: item.depth,
        moduleIds: item.moduleIds,
        handoffTypes: item.handoffTypes,
        compatibilityReceiptDigests: item.edgeIds.map(edgeId => batch.edges.find(edge => edge.edgeId === edgeId).compatibilityReceipt.receiptDigest),
        manifestBindingReceiptDigests: item.manifestBindingReceiptDigests,
        reasoningSessionId: item.reasoningSessionId,
        runtimeReadiness: 'UNKNOWN_NOT_PROBED',
        state: 'REVIEWABLE_PROPOSAL_NOT_EXECUTED'
      }));
    if (!proposals.length) {
      state = 'HOLD_NO_MANIFEST_BOUND_EXACT_TYPED_ROUTE';
      reason = `No depth-${maximumDepth}-or-less path exists using both exact handoff equality and manifest-bound contracts.`;
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
      manifestWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      permissionGrant: false,
      runtimeReadinessClaim: false,
      semanticTruthWrite: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'A manifest-bound compatible route is a review proposal. Declaration is not permission grant; readiness is UNKNOWN until probed; no module is invoked and no outcome is claimed.'
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, IMPLEMENTATION_CONTRACT,
  MAX_CONTRACTS, MAX_INTERFACES_PER_DIRECTION, MAX_EDGES, MAX_ROUTES, MAX_DEPTH,
  digest, sourceLineage, discover, buildGraph, buildRoutes, routeInput, verifyBatch, derive, plan
};
