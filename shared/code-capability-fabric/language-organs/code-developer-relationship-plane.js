'use strict';

const crypto = require('crypto');
const ATLAS = require('./developer-substrate-atlas.json');

const AUTHORITY = Object.freeze({
  workspaceRead: false,
  workspaceMutation: false,
  toolExecution: false,
  network: false,
  install: false,
  deployment: false,
  promotion: false,
  canon: false
});

const NODE_KINDS = new Set([
  'FILE', 'SYMBOL', 'MODULE', 'PACKAGE', 'BUILD_TARGET', 'BUILD_ACTION',
  'TEST', 'VERIFIER', 'SCHEMA', 'RUNTIME_BOUNDARY', 'ARTIFACT', 'CONFIG',
  'EXTERNAL_DEPENDENCY', 'GENERIC'
]);

const EDGE_CLASSES = new Set([
  'DEFINES', 'REFERENCES', 'CALLS', 'IMPORTS', 'IMPLEMENTS', 'OVERRIDES',
  'DEPENDS_ON', 'BUILDS_FROM', 'PRODUCES', 'CONSUMES', 'TESTS', 'COVERS',
  'FLOWS_TO', 'BOUNDARY_TO', 'GENERATES', 'CONFIGURES'
]);

const PROPAGATION = Object.freeze({
  DEFINES: 'BOTH',
  REFERENCES: 'REVERSE',
  CALLS: 'REVERSE',
  IMPORTS: 'REVERSE',
  IMPLEMENTS: 'REVERSE',
  OVERRIDES: 'REVERSE',
  DEPENDS_ON: 'REVERSE',
  BUILDS_FROM: 'REVERSE',
  PRODUCES: 'FORWARD',
  CONSUMES: 'REVERSE',
  TESTS: 'REVERSE',
  COVERS: 'REVERSE',
  FLOWS_TO: 'FORWARD',
  BOUNDARY_TO: 'BOTH',
  GENERATES: 'FORWARD',
  CONFIGURES: 'REVERSE'
});

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(typeof v === 'string' ? v : canon(v)).digest('hex');
}

function cleanId(v, fallback = '') {
  const s = String(v == null ? '' : v).trim();
  return s || fallback;
}

function uniqSorted(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function normalizeSourceClass(v) {
  const s = String(v || 'MANUAL_EVIDENCE').toUpperCase();
  return ATLAS.sourceClasses.includes(s) ? s : 'MANUAL_EVIDENCE';
}

function normalizeNode(raw, sourceClass) {
  const id = cleanId(raw && raw.id);
  if (!id) throw new Error('DEVELOPER_GRAPH_NODE_ID_REQUIRED');
  const kind = String(raw.kind || 'GENERIC').toUpperCase();
  if (!NODE_KINDS.has(kind)) throw new Error(`DEVELOPER_GRAPH_NODE_KIND_INVALID:${kind}`);
  return {
    id,
    kind,
    label: cleanId(raw.label, id),
    languageId: raw.languageId == null ? null : String(raw.languageId),
    path: raw.path == null ? null : String(raw.path),
    digest: raw.digest == null ? null : String(raw.digest),
    metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? JSON.parse(JSON.stringify(raw.metadata)) : {},
    sourceClasses: [sourceClass]
  };
}

function normalizeEdge(raw, sourceClass) {
  const from = cleanId(raw && raw.from);
  const to = cleanId(raw && raw.to);
  if (!from || !to) throw new Error('DEVELOPER_GRAPH_EDGE_ENDPOINT_REQUIRED');
  const edgeClass = String(raw.class || '').toUpperCase();
  if (!EDGE_CLASSES.has(edgeClass)) throw new Error(`DEVELOPER_GRAPH_EDGE_CLASS_INVALID:${edgeClass}`);
  return {
    from,
    to,
    class: edgeClass,
    propagation: PROPAGATION[edgeClass],
    label: raw.label == null ? null : String(raw.label),
    confidenceClass: String(raw.confidenceClass || 'OBSERVED').toUpperCase(),
    evidenceDigest: raw.evidenceDigest == null ? null : String(raw.evidenceDigest),
    sourceClass
  };
}

function mergeNode(existing, next, conflicts) {
  if (!existing) return next;
  if (existing.kind !== next.kind) {
    conflicts.push({ id: existing.id, field: 'kind', left: existing.kind, right: next.kind });
  }
  if (existing.languageId && next.languageId && existing.languageId !== next.languageId) {
    conflicts.push({ id: existing.id, field: 'languageId', left: existing.languageId, right: next.languageId });
  }
  if (existing.digest && next.digest && existing.digest !== next.digest) {
    conflicts.push({ id: existing.id, field: 'digest', left: existing.digest, right: next.digest });
  }
  return {
    ...existing,
    sourceClasses: uniqSorted([...(existing.sourceClasses || []), ...(next.sourceClasses || [])]),
    languageId: existing.languageId || next.languageId,
    path: existing.path || next.path,
    digest: existing.digest || next.digest,
    metadata: { ...next.metadata, ...existing.metadata }
  };
}

function stronglyConnected(nodeIds, edges, classes = new Set(['IMPORTS', 'DEPENDS_ON', 'CALLS'])) {
  const graph = new Map(nodeIds.map(id => [id, []]));
  for (const edge of edges) {
    if (classes.has(edge.class) && graph.has(edge.from) && graph.has(edge.to)) graph.get(edge.from).push(edge.to);
  }
  for (const list of graph.values()) list.sort();
  let index = 0;
  const indexes = new Map(), low = new Map(), stack = [], onStack = new Set(), components = [];
  function visit(v) {
    indexes.set(v, index); low.set(v, index); index += 1; stack.push(v); onStack.add(v);
    for (const w of graph.get(v) || []) {
      if (!indexes.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), indexes.get(w)));
    }
    if (low.get(v) === indexes.get(v)) {
      const component = []; let w;
      do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
      components.push(component.sort());
    }
  }
  for (const id of [...nodeIds].sort()) if (!indexes.has(id)) visit(id);
  return components.filter(c => c.length > 1 || edges.some(e => classes.has(e.class) && e.from === c[0] && e.to === c[0]))
    .map(members => ({ members, edgeClasses: uniqSorted(edges.filter(e => members.includes(e.from) && members.includes(e.to)).map(e => e.class)) }));
}

function buildGraph({ observations = [] } = {}) {
  if (!Array.isArray(observations)) throw new Error('DEVELOPER_GRAPH_OBSERVATIONS_ARRAY_REQUIRED');
  const nodeMap = new Map(), edges = [], conflicts = [], sourceClasses = [];
  for (const observation of observations) {
    const sourceClass = normalizeSourceClass(observation && observation.sourceClass);
    sourceClasses.push(sourceClass);
    for (const raw of observation?.nodes || []) {
      const next = normalizeNode(raw, sourceClass);
      nodeMap.set(next.id, mergeNode(nodeMap.get(next.id), next, conflicts));
    }
    for (const raw of observation?.edges || []) edges.push(normalizeEdge(raw, sourceClass));
  }
  const nodes = [...nodeMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  const known = new Set(nodes.map(n => n.id));
  const edgeMap = new Map();
  for (const edge of edges) {
    const key = `${edge.from}\0${edge.to}\0${edge.class}\0${edge.sourceClass}\0${edge.evidenceDigest || ''}`;
    if (!edgeMap.has(key)) edgeMap.set(key, edge);
  }
  const dedupedEdges = [...edgeMap.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.class.localeCompare(b.class));
  const unresolvedEdges = dedupedEdges.filter(e => !known.has(e.from) || !known.has(e.to)).map(e => ({
    from: e.from, to: e.to, class: e.class, missingFrom: !known.has(e.from), missingTo: !known.has(e.to), sourceClass: e.sourceClass
  }));
  const resolvedEdges = dedupedEdges.filter(e => known.has(e.from) && known.has(e.to));
  const cycles = stronglyConnected(nodes.map(n => n.id), resolvedEdges);
  const core = {
    schema: 'axm.code.developer-relationship-graph.v1',
    version: '1.0.0',
    result: conflicts.length ? 'GRAPH_READY_WITH_CONFLICTS' : 'GRAPH_READY',
    nodes,
    edges: resolvedEdges,
    unresolvedEdges,
    conflicts,
    cycles,
    coverage: {
      sourceClasses: uniqSorted(sourceClasses),
      nodeCount: nodes.length,
      edgeCount: resolvedEdges.length,
      unresolvedEdgeCount: unresolvedEdges.length,
      graphCoverageCompleteClaimed: false
    },
    truth: {
      edgeIsNotCorrectnessProof: true,
      unresolvedEdgesRetained: true,
      cyclesAreObservedNotDefectProof: true,
      absenceOfEdgeIsNotNoRelationshipProof: true,
      graphCompletenessClaimed: false,
      workspaceReadByThisModule: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, graphSha256: hash(core) });
}

function propagationNeighbors(graph, nodeId) {
  const out = [];
  for (const edge of graph.edges || []) {
    if ((edge.propagation === 'FORWARD' || edge.propagation === 'BOTH') && edge.from === nodeId) {
      out.push({ nodeId: edge.to, edge, direction: 'FORWARD' });
    }
    if ((edge.propagation === 'REVERSE' || edge.propagation === 'BOTH') && edge.to === nodeId) {
      out.push({ nodeId: edge.from, edge, direction: 'REVERSE' });
    }
  }
  return out.sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.edge.class.localeCompare(b.edge.class));
}

function impact({ graph, changedNodeIds = [], maxDepth = 8 } = {}) {
  if (!graph || graph.schema !== 'axm.code.developer-relationship-graph.v1') {
    return Object.freeze({ schema: 'axm.code.change-impact-report.v1', result: 'INVALID_GRAPH', authority: 'NONE' });
  }
  const known = new Map((graph.nodes || []).map(n => [n.id, n]));
  const changed = uniqSorted(changedNodeIds);
  const unknownChanged = changed.filter(id => !known.has(id));
  const queue = [], seen = new Map(), paths = [];
  for (const id of changed.filter(id => known.has(id))) {
    seen.set(id, { id, depth: 0, root: id, via: null });
    queue.push({ id, depth: 0, root: id });
  }
  const depthLimit = Number.isInteger(maxDepth) ? Math.max(1, Math.min(32, maxDepth)) : 8;
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= depthLimit) continue;
    for (const next of propagationNeighbors(graph, current.id)) {
      const depth = current.depth + 1;
      paths.push({ from: current.id, to: next.nodeId, edgeClass: next.edge.class, direction: next.direction, depth, root: current.root });
      const prior = seen.get(next.nodeId);
      if (!prior || depth < prior.depth) {
        seen.set(next.nodeId, { id: next.nodeId, depth, root: current.root, via: { from: current.id, edgeClass: next.edge.class, direction: next.direction } });
        queue.push({ id: next.nodeId, depth, root: current.root });
      }
    }
  }
  const affected = [...seen.values()].filter(x => !changed.includes(x.id)).sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
    .map(x => ({ ...x, kind: known.get(x.id)?.kind || 'UNKNOWN' }));
  const affectedIds = new Set(affected.map(x => x.id));
  const core = {
    schema: 'axm.code.change-impact-report.v1',
    version: '1.0.0',
    result: unknownChanged.length ? 'IMPACT_READY_WITH_UNKNOWN_CHANGE_ROOTS' : 'IMPACT_READY',
    graphSha256: graph.graphSha256,
    changedNodeIds: changed,
    unknownChangedNodeIds: unknownChanged,
    maxDepth: depthLimit,
    affected,
    affectedTests: affected.filter(x => x.kind === 'TEST').map(x => x.id),
    affectedVerifiers: affected.filter(x => x.kind === 'VERIFIER').map(x => x.id),
    affectedBuildTargets: affected.filter(x => x.kind === 'BUILD_TARGET').map(x => x.id),
    affectedBuildActions: affected.filter(x => x.kind === 'BUILD_ACTION').map(x => x.id),
    affectedArtifacts: affected.filter(x => x.kind === 'ARTIFACT').map(x => x.id),
    propagationPaths: paths.filter(p => affectedIds.has(p.to)).slice(0, 5000),
    truth: {
      affectedSetCompleteOnlyWithinObservedGraph: true,
      unknownChangeRootsRetained: true,
      graphCoverageCompleteClaimed: false,
      affectedDoesNotMeanBroken: true,
      automaticTestExecution: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, impactSha256: hash(core) });
}

function inferredPlanes(graph, impactReport) {
  const ids = new Set([...(impactReport.changedNodeIds || []), ...(impactReport.affected || []).map(x => x.id)]);
  const classes = new Set((graph.edges || []).filter(e => ids.has(e.from) || ids.has(e.to)).map(e => e.class));
  const planes = [];
  if ([...classes].some(c => ['DEFINES', 'REFERENCES', 'CALLS', 'IMPLEMENTS', 'OVERRIDES'].includes(c))) planes.push('SYMBOL_REFERENCE_GRAPH');
  if ([...classes].some(c => ['IMPORTS', 'DEPENDS_ON', 'BOUNDARY_TO', 'CONFIGURES'].includes(c))) planes.push('DEPENDENCY_ROUTE_GRAPH');
  if (classes.has('FLOWS_TO')) planes.push('DATA_FLOW_GRAPH');
  if ([...classes].some(c => ['BUILDS_FROM', 'PRODUCES', 'CONSUMES', 'GENERATES'].includes(c))) planes.push('BUILD_ACTION_GRAPH');
  if ([...classes].some(c => ['TESTS', 'COVERS'].includes(c))) planes.push('TEST_COVERAGE_MAP');
  return uniqSorted(planes);
}

function planReanalysis({ graph, impactReport, invalidatedPlanes = [] } = {}) {
  if (!graph || !impactReport || impactReport.schema !== 'axm.code.change-impact-report.v1') {
    return Object.freeze({ schema: 'axm.code.reanalysis-plan.v1', result: 'INVALID_IMPACT_INPUT', authority: 'NONE' });
  }
  const planes = uniqSorted([...(invalidatedPlanes || []), ...inferredPlanes(graph, impactReport)]);
  const tasks = uniqSorted([
    ...(impactReport.affectedTests || []).map(id => `TEST:${id}`),
    ...(impactReport.affectedVerifiers || []).map(id => `VERIFY:${id}`),
    ...(impactReport.affectedBuildActions || []).map(id => `BUILD_ACTION:${id}`),
    ...(impactReport.affectedBuildTargets || []).map(id => `BUILD_TARGET:${id}`)
  ]);
  const core = {
    schema: 'axm.code.reanalysis-plan.v1',
    version: '1.0.0',
    result: 'REANALYSIS_PLAN_READY',
    graphSha256: graph.graphSha256,
    impactSha256: impactReport.impactSha256,
    analysisPlanesToRefresh: planes,
    affectedTaskCandidates: tasks,
    uncoveredWarning: graph.coverage?.graphCoverageCompleteClaimed ? null : 'Observed graph may be partial; do not interpret this task set as exhaustive.',
    truth: {
      taskListIsCandidateScopeNotExecution: true,
      missingGraphCoverageCanHideAffectedWork: true,
      noAutomaticExecution: true,
      noAutomaticAdmissionChange: true
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, planSha256: hash(core) });
}

function actionIdentity({ actionId, inputs = [], toolchainDigest = null, configDigest = null, environmentDigest = null, commandDigest = null } = {}) {
  const normalizedInputs = (inputs || []).map(x => ({ id: cleanId(x.id), digest: x.digest == null ? null : String(x.digest) }))
    .filter(x => x.id).sort((a, b) => a.id.localeCompare(b.id));
  const missing = normalizedInputs.filter(x => !x.digest).map(x => x.id);
  if (!toolchainDigest) missing.push('toolchainDigest');
  if (!configDigest) missing.push('configDigest');
  const core = {
    schema: 'axm.code.action-identity.v1',
    version: '1.0.0',
    result: missing.length ? 'ACTION_IDENTITY_HELD_UNKNOWN_INPUT' : 'ACTION_IDENTITY_READY',
    actionId: cleanId(actionId, 'anonymous-action'),
    inputs: normalizedInputs,
    toolchainDigest: toolchainDigest == null ? null : String(toolchainDigest),
    configDigest: configDigest == null ? null : String(configDigest),
    environmentDigest: environmentDigest == null ? null : String(environmentDigest),
    commandDigest: commandDigest == null ? null : String(commandDigest),
    missingIdentityInputs: uniqSorted(missing),
    truth: { identityMatchIsNotRuntimeCorrectnessProof: true, cacheWriteAuthority: false },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, actionSha256: core.result === 'ACTION_IDENTITY_READY' ? hash(core) : null });
}

function compareActionIdentity(previous, current) {
  if (!previous || !current || previous.result !== 'ACTION_IDENTITY_READY' || current.result !== 'ACTION_IDENTITY_READY') {
    return Object.freeze({ schema: 'axm.code.action-cache-decision.v1', result: 'CACHE_REUSE_HELD_UNKNOWN_IDENTITY', authority: 'NONE' });
  }
  const same = previous.actionSha256 === current.actionSha256;
  return Object.freeze({
    schema: 'axm.code.action-cache-decision.v1',
    result: same ? 'CACHE_REUSE_CANDIDATE' : 'RECOMPUTE_REQUIRED',
    previousActionSha256: previous.actionSha256,
    currentActionSha256: current.actionSha256,
    truth: { cacheReuseIsCandidateNotAuthority: true, cachedOutputCorrectnessNotProven: true },
    authority: AUTHORITY
  });
}

function depKey(d) {
  return `${String(d.ecosystem || 'unknown').toLowerCase()}\0${String(d.name || '')}\0${String(d.manifest || '')}\0${String(d.scope || '')}`;
}

function normalizeDependency(d) {
  return {
    ecosystem: String(d.ecosystem || 'unknown'),
    name: String(d.name || ''),
    version: d.version == null ? null : String(d.version),
    relationship: String(d.relationship || 'UNKNOWN').toUpperCase(),
    manifest: d.manifest == null ? null : String(d.manifest),
    scope: d.scope == null ? null : String(d.scope),
    license: d.license == null ? null : String(d.license),
    vulnerabilities: Array.isArray(d.vulnerabilities) ? uniqSorted(d.vulnerabilities) : [],
    evidenceDigest: d.evidenceDigest == null ? null : String(d.evidenceDigest)
  };
}

function dependencyDiff({ before = [], after = [] } = {}) {
  const left = new Map((before || []).map(d => { const n = normalizeDependency(d); return [depKey(n), n]; }));
  const right = new Map((after || []).map(d => { const n = normalizeDependency(d); return [depKey(n), n]; }));
  const added = [], removed = [], updated = [];
  for (const [key, next] of right) {
    if (!left.has(key)) added.push(next);
    else {
      const prev = left.get(key);
      if (canon(prev) !== canon(next)) updated.push({ before: prev, after: next });
    }
  }
  for (const [key, prev] of left) if (!right.has(key)) removed.push(prev);
  const core = {
    schema: 'axm.code.dependency-diff.v1',
    version: '1.0.0',
    result: added.length || removed.length || updated.length ? 'DEPENDENCY_CHANGES_OBSERVED' : 'NO_DEPENDENCY_CHANGE_OBSERVED',
    added: added.sort((a, b) => depKey(a).localeCompare(depKey(b))),
    removed: removed.sort((a, b) => depKey(a).localeCompare(depKey(b))),
    updated: updated.sort((a, b) => depKey(a.after).localeCompare(depKey(b.after))),
    transitiveAdditions: added.filter(x => x.relationship === 'TRANSITIVE'),
    callerSuppliedVulnerabilityEvidence: added.filter(x => x.vulnerabilities.length).concat(updated.filter(x => x.after.vulnerabilities.length).map(x => x.after)),
    truth: {
      noNetworkLookupPerformed: true,
      vulnerabilityMetadataNotIndependentlyVerified: true,
      dependencyChangeIsNotAutomaticallyRejected: true,
      reviewIsSeparateAuthority: true
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, diffSha256: hash(core) });
}

function renderImpactSvg({ graph, impactReport, title = 'Change Impact' } = {}) {
  if (!graph || !impactReport || impactReport.schema !== 'axm.code.change-impact-report.v1') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 100"><text x="20" y="55">NO IMPACT GRAPH</text></svg>';
  }
  const changed = new Set(impactReport.changedNodeIds || []);
  const affected = new Map((impactReport.affected || []).map(x => [x.id, x]));
  const ids = uniqSorted([...changed, ...affected.keys()]).slice(0, 40);
  const nodeMap = new Map((graph.nodes || []).map(n => [n.id, n]));
  const rowH = 46, width = 900, height = 80 + ids.length * rowH;
  const rows = ids.map((id, i) => {
    const n = nodeMap.get(id) || { kind: 'UNKNOWN', label: id };
    const state = changed.has(id) ? 'CHANGED' : `AFFECTED d${affected.get(id)?.depth || '?'}`;
    const y = 64 + i * rowH;
    const fill = changed.has(id) ? '#ffe4b5' : '#eef4ff';
    return `<g><rect x="24" y="${y - 24}" width="852" height="34" rx="6" fill="${fill}" stroke="currentColor"/><text x="38" y="${y - 3}" font-size="13" font-weight="700">${escapeXml(id)}</text><text x="430" y="${y - 3}" font-size="11">${escapeXml(n.kind)} · ${escapeXml(state)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><rect width="100%" height="100%" fill="white"/><text x="24" y="30" font-size="20" font-weight="700">${escapeXml(title)}</text><text x="24" y="49" font-size="11">Observed graph only · affected does not mean broken</text>${rows}</svg>`;
}

function escapeXml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function snapshot() {
  const core = {
    schema: 'axm.code.developer-substrate-snapshot.v1',
    version: '1.0.0',
    firstClassFoundationCount: ATLAS.firstClassFoundations.length,
    sourceClassCount: ATLAS.sourceClasses.length,
    nodeKindCount: NODE_KINDS.size,
    edgeClassCount: EDGE_CLASSES.size,
    propagationPolicy: PROPAGATION,
    atlasSha256: hash(ATLAS),
    authority: 'NONE'
  };
  return Object.freeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = {
  NODE_KINDS,
  EDGE_CLASSES,
  PROPAGATION,
  buildGraph,
  impact,
  planReanalysis,
  actionIdentity,
  compareActionIdentity,
  dependencyDiff,
  renderImpactSvg,
  snapshot
};
