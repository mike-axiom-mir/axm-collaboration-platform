'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Frontier = require('../kernel/frontier-cell');
const BoundedSegment = require('../kernel/bounded-segment-cell');
const HandoffCell = require('../kernel/contract-handoff-cell');
const BindingCell = require('../kernel/contract-manifest-binding-cell');
const SessionEvidenceSegments = require('../kernel/session-evidence-segment-cell');
const LegacyV1 = require('./reasoning-handoff-graph-organ-v1-known-fail');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/reasoning-handoff-graph-v2';
const BATCH_SCHEMA = 'axm.mirror.reasoning-handoff-route-batch/v2';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-handoff-route-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-handoff-route-response/v2';
const MAX_CONTRACTS_PER_SEGMENT = 64;
const MAX_CONTRACT_SEGMENTS = 64;
const MAX_CONTRACTS = MAX_CONTRACTS_PER_SEGMENT * MAX_CONTRACT_SEGMENTS;
const MAX_INTERFACES_PER_DIRECTION = 64;
const MAX_EDGES = 256;
const MAX_ROUTES_PER_SEGMENT = 256;
const MAX_ROUTE_SEGMENTS = 16;
const MAX_ROUTES = MAX_ROUTES_PER_SEGMENT;
const MAX_TOTAL_ROUTES = MAX_ROUTES_PER_SEGMENT * MAX_ROUTE_SEGMENTS;
const MAX_DEPTH = 2;
const IMPLEMENTATION_CONTRACT = Object.freeze({
  version: 'manifest-bound-exact-typed-handoff-graph-bounded-route-session-segments-v3',
  admissionRule: 'manifest.contract safely resolves to the exact content-digested contract and manifest.id equals contract.id',
  permissionDeclarationRule: 'every contract.permissions[] value is present in manifest.uses[]',
  edgeRule: 'admitted producer.handoffs.emits[] exact-match admitted consumer.handoffs.accepts[]',
  segmentationRule: 'all eligible contracts are covered once by content-sealed lexical segments of at most 64; edge comparisons use bounded segment pairs',
  routeRule: 'all non-cyclic paths at depth one and two over admitted edges, covered once in fixed maximum segments of 256',
  maximumRouteSegments: MAX_ROUTE_SEGMENTS,
  sessionStorage: 'HASH_CHAINED_JSONL_PER_ROUTE_SEGMENT_V1',
  historicalSessionFilesRewritten: false,
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
    require.resolve('../kernel/bounded-segment-cell'),
    require.resolve('../kernel/session-evidence-segment-cell'),
    require.resolve('../kernel/contract-handoff-cell'),
    require.resolve('../kernel/contract-manifest-binding-cell'),
    path.join(root, 'contracts', 'contract-manifest-binding.schema.json'),
    path.join(root, 'contracts', 'session-evidence-segment-manifest.schema.json'),
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
  if (contracts.length > MAX_CONTRACTS) throw new Error(`handoff graph holds: ${contracts.length} eligible contracts exceed the ${MAX_CONTRACTS} segmented contract capacity`);
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
  const publicContracts = discovery.contracts.map(publicContract);
  const segmentation = BoundedSegment.build(publicContracts, {
    subject: 'manifest-bound-handoff-graph-contracts',
    maximumItemsPerSegment: MAX_CONTRACTS_PER_SEGMENT,
    identity: item => item.moduleId,
    seal: item => item
  });
  if (segmentation.plan.segmentCount > MAX_CONTRACT_SEGMENTS) {
    throw new Error(`handoff graph holds: ${segmentation.plan.segmentCount} contract segments exceed the ${MAX_CONTRACT_SEGMENTS} segment bound`);
  }
  BoundedSegment.verify(segmentation.plan, publicContracts, {
    subject: 'manifest-bound-handoff-graph-contracts',
    maximumItemsPerSegment: MAX_CONTRACTS_PER_SEGMENT,
    identity: item => item.moduleId,
    seal: item => item
  });

  const contracts = segmentation.orderedItems;
  const edges = [];
  for (const producerSegment of segmentation.segments) {
    for (const consumerSegment of segmentation.segments) {
      for (const producer of producerSegment.items) {
        for (const handoffType of producer.emits) {
          for (const consumer of consumerSegment.items) {
            if (producer.moduleId === consumer.moduleId || !consumer.accepts.includes(handoffType)) continue;
            const compatibilityReceipt = HandoffCell.evaluate({ producer, consumer, handoffType });
            const basis = {
              producerModuleId: producer.moduleId,
              producerContractSha256: producer.contractSha256,
              consumerModuleId: consumer.moduleId,
              consumerContractSha256: consumer.contractSha256,
              handoffType
            };
            edges.push(Object.assign({ edgeId: `handoff-edge-${digest(basis).slice(0, 20)}` }, basis, { compatibilityReceipt }));
          }
        }
      }
    }
  }
  edges.sort((a, b) => a.producerModuleId.localeCompare(b.producerModuleId) || a.consumerModuleId.localeCompare(b.consumerModuleId) || a.handoffType.localeCompare(b.handoffType));
  if (edges.length > MAX_EDGES) throw new Error(`handoff graph holds: ${edges.length} edges exceed the ${MAX_EDGES} edge bound`);
  if (new Set(edges.map(item => item.edgeId)).size !== edges.length) throw new Error('handoff graph edge digest collision');
  return { contracts, edges, contractSegments: segmentation.plan };
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
    const routeBasis = { edgeIds, moduleIds, handoffTypes, depth: basis.edges.length };
    const routeId = `handoff-route-${digest(routeBasis).slice(0, 20)}`;
    if (!unique.has(routeId)) unique.set(routeId, {
      routeId,
      depth: basis.edges.length,
      moduleIds,
      handoffTypes,
      edgeIds,
      edges: basis.edges
    });
  }
  const routes = Array.from(unique.values()).sort((left, right) => left.depth - right.depth || left.routeId.localeCompare(right.routeId));
  if (routes.length > MAX_TOTAL_ROUTES) {
    throw new Error(`handoff graph holds: ${routes.length} routes exceed the ${MAX_TOTAL_ROUTES} segmented route capacity`);
  }
  return routes.map(route => Object.assign(route, { unboundDecoy: unboundDecoyFor(route, graph) }));
}

function routeSegmentIdentity(route) { return `${route.depth}/${route.routeId}`; }
function routeSegmentSeal(route) {
  return {
    routeId: route.routeId,
    depth: route.depth,
    moduleIds: route.moduleIds,
    handoffTypes: route.handoffTypes,
    edgeIds: route.edgeIds
  };
}

function planRouteSegments(routes) {
  const segmentation = BoundedSegment.build(routes, {
    subject: 'manifest-bound-handoff-graph-routes',
    maximumItemsPerSegment: MAX_ROUTES_PER_SEGMENT,
    identity: routeSegmentIdentity,
    seal: routeSegmentSeal
  });
  if (segmentation.plan.segmentCount > MAX_ROUTE_SEGMENTS) {
    throw new Error(`handoff graph holds: ${segmentation.plan.segmentCount} route segments exceed the ${MAX_ROUTE_SEGMENTS} segment bound`);
  }
  return segmentation;
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

function verifyRouteSegments(batch, expectedRoutes) {
  if (!batch.routeSegments) {
    if (batch.results.length > MAX_ROUTES_PER_SEGMENT || batch.results.some(result => result.routeSegmentIndex != null || result.routeSegmentId != null)) {
      throw new Error('legacy handoff graph batch exceeds its total route bound or impersonates segmented lineage');
    }
    return { legacy: true, segmentCount: batch.results.length ? 1 : 0 };
  }
  if (batch.routeSegments.maximumItemsPerSegment !== MAX_ROUTES_PER_SEGMENT || batch.routeSegments.segmentCount > MAX_ROUTE_SEGMENTS) {
    throw new Error('manifest-bound handoff graph route segmentation changed');
  }
  BoundedSegment.verify(batch.routeSegments, batch.results, {
    subject: 'manifest-bound-handoff-graph-routes',
    maximumItemsPerSegment: MAX_ROUTES_PER_SEGMENT,
    identity: routeSegmentIdentity,
    seal: routeSegmentSeal
  });
  const rebuilt = planRouteSegments(expectedRoutes);
  if (JSON.stringify(stable(rebuilt.plan)) !== JSON.stringify(stable(batch.routeSegments))) {
    throw new Error('manifest-bound handoff graph route segment plan does not match the complete route set');
  }
  for (const segment of rebuilt.segments) {
    for (const route of segment.items) {
      const result = batch.results.find(item => item.routeId === route.routeId);
      if (!result || result.routeSegmentIndex !== segment.index || result.routeSegmentId !== segment.segmentId) {
        throw new Error(`manifest-bound handoff graph route segment lineage mismatch: ${route.routeId}`);
      }
    }
  }
  return { legacy: false, segmentCount: rebuilt.plan.segmentCount };
}

function verifySessionEvidence(batch, runDir) {
  const evidence = batch.sessionEvidence;
  if (!evidence) return { legacy: true, segmentCount: 0 };
  if (!batch.routeSegments || evidence.cellId !== SessionEvidenceSegments.CELL_ID ||
      evidence.storage !== IMPLEMENTATION_CONTRACT.sessionStorage || evidence.records !== batch.results.length ||
      evidence.legacySessionFilesWritten !== 0 || evidence.historicalRunsRewritten !== false || evidence.automaticDeletion !== false ||
      !Array.isArray(evidence.segments) || evidence.segments.length !== batch.routeSegments.segmentCount) {
    throw new Error('manifest-bound handoff session evidence declaration mismatch');
  }
  const checkedByIndex = new Map();
  for (const segment of evidence.segments) {
    if (!Number.isInteger(segment.routeSegmentIndex) || checkedByIndex.has(segment.routeSegmentIndex)) {
      throw new Error('manifest-bound handoff session evidence segment index is invalid or duplicated');
    }
    const planned = batch.routeSegments.segments[segment.routeSegmentIndex];
    if (!planned || planned.segmentId !== segment.routeSegmentId || segment.manifest.segmentId !== segment.routeSegmentId ||
        segment.manifest.records !== planned.itemCount || path.basename(segment.file || '') !== segment.manifest.segmentFile) {
      throw new Error('manifest-bound handoff session evidence route lineage mismatch');
    }
    let checked = null;
    if (runDir) {
      const file = path.resolve(runDir, segment.file || '');
      if (!inside(runDir, file) || !fs.existsSync(file)) throw new Error(`manifest-bound handoff route session segment missing: ${segment.routeSegmentId}`);
      try { checked = SessionEvidenceSegments.verify(file, segment.manifest); }
      catch (error) { throw new Error(`manifest-bound handoff route session hash mismatch: ${segment.routeSegmentId}: ${error.message}`); }
    }
    checkedByIndex.set(segment.routeSegmentIndex, { segment, checked, planned });
  }
  const referenced = new Set();
  for (const result of batch.results) {
    const stored = checkedByIndex.get(result.routeSegmentIndex);
    const reference = result.sessionRecord;
    if (!stored || result.sessionFile !== stored.segment.file || !reference || !Number.isInteger(reference.index) ||
        reference.index < 0 || reference.index >= stored.planned.itemCount || reference.recordId !== result.reasoningSessionId ||
        reference.payloadDigest !== result.sessionDigest) {
      throw new Error(`manifest-bound handoff route session reference mismatch: ${result.reasoningSessionId}`);
    }
    const key = `${result.routeSegmentIndex}/${reference.index}`;
    if (referenced.has(key)) throw new Error('manifest-bound handoff route session record is referenced more than once');
    referenced.add(key);
    if (stored.checked) {
      const record = stored.checked.records[reference.index];
      if (record.recordId !== reference.recordId || record.payloadDigest !== reference.payloadDigest || record.eventHash !== reference.eventHash) {
        throw new Error(`manifest-bound handoff route session record lineage mismatch: ${result.reasoningSessionId}`);
      }
      const bytes = Buffer.from(json(record.payload), 'utf8');
      if (digest(bytes) !== result.sessionSha256 || record.payload.reasoningSessionId !== result.reasoningSessionId) {
        throw new Error(`manifest-bound handoff route session payload hash mismatch: ${result.reasoningSessionId}`);
      }
      LegacyV1.verifySession(record.payload, result);
    }
  }
  if (referenced.size !== evidence.records) throw new Error('manifest-bound handoff session evidence contains unreferenced records');
  return { legacy: false, segmentCount: evidence.segments.length };
}

function verifyBatch(batch, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || !batch.inputsDigest || !batch.batchDigest) throw new Error('invalid manifest-bound handoff graph batch');
  if (batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('manifest-bound handoff graph batch digest mismatch');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('manifest-bound handoff graph organ lineage mismatch');
  if (!batch.authority || batch.authority.privateEvaluationTraceWrite !== true ||
      Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvaluationTraceWrite' && value !== false)) throw new Error('manifest-bound handoff graph authority boundary changed');
  if (!Array.isArray(batch.contracts) || batch.contracts.length > MAX_CONTRACTS || !Array.isArray(batch.edges) || batch.edges.length > MAX_EDGES || !Array.isArray(batch.results) || batch.results.length > MAX_TOTAL_ROUTES || !Array.isArray(batch.refusedContracts)) throw new Error('manifest-bound handoff graph bounds changed');
  if (!batch.contractSegments || batch.contractSegments.maximumItemsPerSegment !== MAX_CONTRACTS_PER_SEGMENT || batch.contractSegments.segmentCount > MAX_CONTRACT_SEGMENTS) throw new Error('manifest-bound handoff graph contract segmentation changed');
  BoundedSegment.verify(batch.contractSegments, batch.contracts, {
    subject: 'manifest-bound-handoff-graph-contracts',
    maximumItemsPerSegment: MAX_CONTRACTS_PER_SEGMENT,
    identity: item => item.moduleId,
    seal: item => item
  });
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
  const expectedInputsDigest = digest({ organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: currentSourceLineage, contractSegments: batch.contractSegments, routeSegments: batch.routeSegments || null, contracts: batch.contracts, refused: batch.refusedContracts });
  if (batch.inputsDigest !== expectedInputsDigest || batch.batchId !== `reasoning-handoff-graph-${expectedInputsDigest.slice(0, 20)}`) throw new Error('manifest-bound handoff graph input lineage mismatch');
  const expectedGraph = LegacyV1.buildGraph({ contracts: batch.contracts });
  if (JSON.stringify(stable(batch.edges)) !== JSON.stringify(stable(expectedGraph.edges))) throw new Error('manifest-bound handoff graph edges are incomplete, extra, or changed');
  const graph = { contracts: batch.contracts, edges: batch.edges };
  const expectedRoutes = buildRoutes(graph);
  verifyRouteSegments(batch, expectedRoutes);
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
  if (batch.sessionEvidence) verifySessionEvidence(batch, runDir);
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
    if (runDir && !batch.sessionEvidence) {
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
    contractSegmentCount: batch.contractSegments.segmentCount,
    maximumContractsPerSegment: MAX_CONTRACTS_PER_SEGMENT,
    allEligibleContractsCovered: batch.contractSegments.allItemsCovered && batch.contractSegments.deferredItems === 0,
    refusedOrExcludedContracts: batch.refusedContracts.length,
    manifestBindingsPassed: batch.contracts.length,
    manifestBindingsFailed: failedBindings,
    undeclaredContractFiles: batch.refusedContracts.filter(item => item.state === 'REFUSED_MANIFEST_DOES_NOT_DECLARE_CONTRACT').length,
    uniqueEmittedTypes: new Set(batch.contracts.flatMap(item => item.emits)).size,
    uniqueAcceptedTypes: new Set(batch.contracts.flatMap(item => item.accepts)).size,
    exactCrossModuleEdges: batch.edges.length,
    routeSegmentCount: batch.routeSegments ? batch.routeSegments.segmentCount : (batch.results.length ? 1 : 0),
    maximumRoutesPerSegment: MAX_ROUTES_PER_SEGMENT,
    allEligibleRoutesCovered: batch.routeSegments ? batch.routeSegments.allItemsCovered && batch.routeSegments.deferredItems === 0 : batch.results.length <= MAX_ROUTES_PER_SEGMENT,
    directRoutes: batch.results.filter(item => item.depth === 1).length,
    composedDepthTwoRoutes: batch.results.filter(item => item.depth === 2).length,
    maximumDepth: MAX_DEPTH,
    exactRoutesSelected: batch.results.filter(item => item.behaviorMatched).length,
    routeSelectionMismatches: batch.results.filter(item => !item.behaviorMatched).length,
    unboundDecoysRejected: batch.results.filter(item => item.behaviorMatched).length,
    sessionEvidenceRecords: batch.results.length,
    sessionEvidenceSegments: batch.sessionEvidence ? batch.sessionEvidence.segments.length : batch.results.length,
    individualSessionFilesWritten: batch.sessionEvidence ? 0 : batch.results.length,
    sessionFilesAvoidedAgainstLegacyLayout: batch.sessionEvidence ? Math.max(0, batch.results.length - batch.sessionEvidence.segments.length) : 0,
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
  const routeSegmentation = planRouteSegments(routeDefinitions);
  const lineage = sourceLineage();
  const inputsDigest = digest({ organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: lineage, contractSegments: graph.contractSegments, routeSegments: routeSegmentation.plan, contracts: graph.contracts, refused: discovery.refused });
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
  const sessionEvidenceSegments = [];
  for (const routeSegment of routeSegmentation.segments) {
    const resultStart = results.length;
    const sessionRecords = [];
    const relativeSession = path.join('sessions', `route-session-segment-${String(routeSegment.index).padStart(4, '0')}.jsonl`).replace(/\\/g, '/');
    for (const route of routeSegment.items) {
    const input = routeInput(route, graph);
    const expectedDecision = { value: 1, actionId: `propose-${route.routeId}` };
    const decoyActionId = `propose-unbound-${route.routeId}`;
    const session = Foundation.run(input, { at: '1970-01-01T00:00:00.000Z' });
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const behaviorMatched = observedDecision.value === expectedDecision.value && observedDecision.actionId === expectedDecision.actionId;
    const bytes = Buffer.from(json(session), 'utf8');
    const result = {
      routeId: route.routeId,
      depth: route.depth,
      moduleIds: route.moduleIds,
      handoffTypes: route.handoffTypes,
      edgeIds: route.edgeIds,
      routeSegmentIndex: routeSegment.index,
      routeSegmentId: routeSegment.segmentId,
      manifestBindingReceiptDigests: route.moduleIds.map(moduleId => graph.contracts.find(item => item.moduleId === moduleId).bindingReceipt.receiptDigest),
      decoyBindingReceipt: route.unboundDecoy,
      expectedDecision,
      decoyActionId,
      observedDecision,
      behaviorMatched,
      state: behaviorMatched ? 'MANIFEST_BOUND_EXACT_ROUTE_SELECTED' : 'ROUTE_SELECTION_MISMATCH',
      reasoningSessionId: session.reasoningSessionId,
      sessionFile: relativeSession,
      sessionRecord: null,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      trainingReceiptCreated: false,
      worldActionExecuted: false,
      semanticConsolidation: false
    };
    LegacyV1.verifySession(session, result);
    sessionRecords.push({ recordId: session.reasoningSessionId, payload: session });
    results.push(result);
    }
    const writtenSegment = SessionEvidenceSegments.write(path.join(stageDir, relativeSession), sessionRecords, { segmentId: routeSegment.segmentId });
    for (let index = 0; index < writtenSegment.records.length; index += 1) results[resultStart + index].sessionRecord = writtenSegment.records[index];
    sessionEvidenceSegments.push({
      routeSegmentIndex: routeSegment.index,
      routeSegmentId: routeSegment.segmentId,
      file: relativeSession,
      manifest: writtenSegment.manifest
    });
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
      boundedSegmentation: { id: BoundedSegment.CELL_ID, rule: BoundedSegment.RULE, learnedWeights: false },
      sessionEvidence: { id: SessionEvidenceSegments.CELL_ID, schema: SessionEvidenceSegments.MANIFEST_SCHEMA, learnedWeights: false },
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
    contractSegments: graph.contractSegments,
    routeSegments: routeSegmentation.plan,
    sessionEvidence: {
      cellId: SessionEvidenceSegments.CELL_ID,
      storage: IMPLEMENTATION_CONTRACT.sessionStorage,
      records: results.length,
      segments: sessionEvidenceSegments,
      legacySessionFilesWritten: 0,
      historicalRunsRewritten: false,
      automaticDeletion: false
    },
    contracts: graph.contracts,
    edges: graph.edges,
    results,
    frontier,
    summary: {
      discoveredContracts: graph.contracts.length + discovery.refused.length,
      eligibleContracts: graph.contracts.length,
      contractSegmentCount: graph.contractSegments.segmentCount,
      maximumContractsPerSegment: MAX_CONTRACTS_PER_SEGMENT,
      allEligibleContractsCovered: graph.contractSegments.allItemsCovered && graph.contractSegments.deferredItems === 0,
      refusedOrExcludedContracts: discovery.refused.length,
      manifestBindingsPassed: graph.contracts.length,
      manifestBindingsFailed: failedBindings,
      undeclaredContractFiles: discovery.refused.filter(item => item.state === 'REFUSED_MANIFEST_DOES_NOT_DECLARE_CONTRACT').length,
      uniqueEmittedTypes: new Set(graph.contracts.flatMap(item => item.emits)).size,
      uniqueAcceptedTypes: new Set(graph.contracts.flatMap(item => item.accepts)).size,
      exactCrossModuleEdges: graph.edges.length,
      routeSegmentCount: routeSegmentation.plan.segmentCount,
      maximumRoutesPerSegment: MAX_ROUTES_PER_SEGMENT,
      allEligibleRoutesCovered: routeSegmentation.plan.allItemsCovered && routeSegmentation.plan.deferredItems === 0,
      directRoutes: results.filter(item => item.depth === 1).length,
      composedDepthTwoRoutes: results.filter(item => item.depth === 2).length,
      maximumDepth: MAX_DEPTH,
      exactRoutesSelected: results.filter(item => item.behaviorMatched).length,
      routeSelectionMismatches: results.filter(item => !item.behaviorMatched).length,
      unboundDecoysRejected: results.filter(item => item.behaviorMatched).length,
      sessionEvidenceRecords: results.length,
      sessionEvidenceSegments: sessionEvidenceSegments.length,
      individualSessionFilesWritten: 0,
      sessionFilesAvoidedAgainstLegacyLayout: Math.max(0, results.length - sessionEvidenceSegments.length),
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
    boundary: 'The organ proposes and evaluates routes only when exact typed interfaces and exact manifest-to-contract bindings pass. Every admitted route is covered once in fixed maximum segments of 256, and exact reasoning traces append into sealed hash-chained JSONL segments without rewriting historical files. Declared permissions are not granted permissions. Runtime readiness, semantic suitability, execution, success, training, and promotion remain unclaimed.'
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
  MAX_CONTRACTS, MAX_CONTRACTS_PER_SEGMENT, MAX_CONTRACT_SEGMENTS, MAX_INTERFACES_PER_DIRECTION, MAX_EDGES,
  MAX_ROUTES, MAX_ROUTES_PER_SEGMENT, MAX_ROUTE_SEGMENTS, MAX_TOTAL_ROUTES, MAX_DEPTH,
  digest, sourceLineage, discover, buildGraph, buildRoutes, routeSegmentSeal, planRouteSegments, routeInput,
  verifyRouteSegments, verifySessionEvidence, verifyBatch, derive, plan
};
