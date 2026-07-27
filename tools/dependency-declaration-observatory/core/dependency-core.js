'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAP_SCHEMA = 'axm.dependency-declaration-map/v1';
const REVIEW_PACKET_SCHEMA = 'axm.dependency-cycle-review-packet/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = stableValue(value[key]);
    return result;
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function cleanStrings(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim())))
    .sort((left, right) => left.localeCompare(right));
}

function safeContractPath(moduleDirectory, declared) {
  if (typeof declared !== 'string' || !declared.trim() || declared.includes('\0')) return null;
  const target = path.resolve(moduleDirectory, declared);
  return target.startsWith(moduleDirectory + path.sep) ? target : null;
}

function readRegularJson(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular non-symlink JSON file');
  const bytes = fs.readFileSync(file);
  return { value: JSON.parse(bytes.toString('utf8')), sha256: sha256(bytes), bytes: bytes.length };
}

function stronglyConnected(moduleIds, edges) {
  const graph = new Map(moduleIds.map(id => [id, []]));
  edges.forEach(edge => {
    if (graph.has(edge.from) && graph.has(edge.to)) graph.get(edge.from).push(edge.to);
  });
  graph.forEach(values => values.sort());

  let index = 0;
  const indexes = new Map();
  const lows = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(node) {
    indexes.set(node, index);
    lows.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) || []) {
      if (!indexes.has(next)) {
        visit(next);
        lows.set(node, Math.min(lows.get(node), lows.get(next)));
      } else if (onStack.has(next)) {
        lows.set(node, Math.min(lows.get(node), indexes.get(next)));
      }
    }

    if (lows.get(node) === indexes.get(node)) {
      const component = [];
      let current;
      do {
        current = stack.pop();
        onStack.delete(current);
        component.push(current);
      } while (current !== node);
      components.push(component.sort());
    }
  }

  moduleIds.slice().sort().forEach(id => {
    if (!indexes.has(id)) visit(id);
  });

  return components.filter(component => {
    if (component.length > 1) return true;
    return edges.some(edge => edge.from === component[0] && edge.to === component[0]);
  }).map(component => ({
    members: component,
    edges: edges.filter(edge => component.includes(edge.from) && component.includes(edge.to))
  })).sort((left, right) => left.members.join('\0').localeCompare(right.members.join('\0')));
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const toolsRoot = path.join(root, 'tools');
  const rootStat = fs.lstatSync(toolsRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('tools root must be a regular non-symlink directory');
  }

  const sourceFiles = [];
  const skippedSymlinks = [];
  const readIssues = [];
  const rawModules = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    if (entry.isSymbolicLink()) {
      skippedSymlinks.push('tools/' + entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const moduleDirectory = path.join(toolsRoot, entry.name);
    const manifestPath = path.join(moduleDirectory, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const loaded = readRegularJson(manifestPath);
      const manifest = loaded.value;
      const id = typeof manifest.id === 'string' && manifest.id.trim()
        ? manifest.id.trim()
        : entry.name;
      sourceFiles.push({
        path: 'tools/' + entry.name + '/manifest.json',
        sha256: loaded.sha256,
        bytes: loaded.bytes
      });
      rawModules.push({
        id,
        folder: entry.name,
        version: typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN',
        status: typeof manifest.status === 'string' ? manifest.status : 'UNKNOWN',
        manifest,
        manifestSha256: loaded.sha256,
        contract: null,
        contractState: manifest.contract ? 'DECLARED_UNREAD' : 'NOT_DECLARED',
        contractSha256: null,
        contractIssue: manifest.contract ? null : 'module contract not declared'
      });
    } catch (error) {
      readIssues.push({
        path: 'tools/' + entry.name + '/manifest.json',
        code: 'MANIFEST_READ_FAILED',
        message: String(error && error.message || error).slice(0, 240)
      });
    }
  }

  const ids = rawModules.map(module => module.id);
  const duplicateIds = Array.from(new Set(ids.filter((id, index) => ids.indexOf(id) !== index))).sort();
  const idSet = new Set(ids);

  for (const module of rawModules) {
    if (!module.manifest.contract) continue;
    const moduleDirectory = path.join(toolsRoot, module.folder);
    const target = safeContractPath(moduleDirectory, module.manifest.contract);
    if (!target) {
      module.contractState = 'UNSAFE_PATH';
      module.contractIssue = 'declared contract path is unsafe';
      continue;
    }
    if (!fs.existsSync(target)) {
      module.contractState = 'MISSING';
      module.contractIssue = 'declared contract is missing';
      continue;
    }
    try {
      const loaded = readRegularJson(target);
      module.contract = loaded.value;
      module.contractSha256 = loaded.sha256;
      module.contractState = 'PRESENT';
      module.contractIssue = null;
      sourceFiles.push({
        path: path.relative(root, target).split(path.sep).join('/'),
        sha256: loaded.sha256,
        bytes: loaded.bytes
      });
    } catch (error) {
      module.contractState = 'INVALID';
      module.contractIssue = String(error && error.message || error).slice(0, 240);
    }
  }

  const declarations = [];
  function add(module, source, value, explicitByField) {
    if (typeof value !== 'string' || !value.trim()) return;
    const token = value.trim();
    const prefixed = token.match(/^(service|module|tool):(.+)$/);
    let target = null;
    let explicit = explicitByField === true;
    let targetKind = explicitByField === true ? 'integration' : null;
    if (prefixed) {
      target = prefixed[2];
      explicit = true;
      targetKind = prefixed[1];
    } else if (idSet.has(token)) {
      target = token;
      explicit = true;
      targetKind = 'direct-module-id';
    } else if (explicitByField === true) {
      target = token;
    }
    const state = explicit
      ? idSet.has(target)
        ? 'EXACT_MODULE_RELATION'
        : 'EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE'
      : 'GENERIC_TOKEN_UNINTERPRETED';
    declarations.push({
      moduleId: module.id,
      source,
      token,
      state,
      targetKind,
      targetModuleId: explicit ? target : null,
      truth: {
        dependencyAvailable: false,
        dependencyReady: false,
        versionCompatible: false,
        activationOrderSelected: false
      }
    });
  }

  for (const module of rawModules) {
    cleanStrings(module.manifest.uses).forEach(value => add(module, 'manifest.uses', value, false));
    cleanStrings(module.manifest.readiness).forEach(value => add(module, 'manifest.readiness', value, false));
    if (typeof module.manifest.integratedInto === 'string' && module.manifest.integratedInto.trim()) {
      add(module, 'manifest.integratedInto', module.manifest.integratedInto, true);
    }
    if (module.contract) {
      cleanStrings(module.contract.consumes).forEach(value => add(module, 'contract.consumes', value, false));
    }
  }

  declarations.sort((left, right) =>
    left.moduleId.localeCompare(right.moduleId) ||
    left.source.localeCompare(right.source) ||
    left.token.localeCompare(right.token)
  );

  const edgeMap = new Map();
  for (const declaration of declarations.filter(item => item.state === 'EXACT_MODULE_RELATION')) {
    const key = declaration.moduleId + '\0' + declaration.targetModuleId;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        from: declaration.moduleId,
        to: declaration.targetModuleId,
        sources: [],
        tokens: []
      });
    }
    const edge = edgeMap.get(key);
    edge.sources.push(declaration.source);
    edge.tokens.push(declaration.token);
  }
  const edges = Array.from(edgeMap.values()).map(edge => ({
    from: edge.from,
    to: edge.to,
    sources: Array.from(new Set(edge.sources)).sort(),
    tokens: Array.from(new Set(edge.tokens)).sort()
  })).sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));

  const cycles = stronglyConnected(ids, edges);
  const modules = rawModules.map(module => {
    const own = declarations.filter(item => item.moduleId === module.id);
    return {
      id: module.id,
      folder: module.folder,
      version: module.version,
      status: module.status,
      manifestSha256: module.manifestSha256,
      contractState: module.contractState,
      contractSha256: module.contractSha256,
      contractIssue: module.contractIssue,
      exactTargets: Array.from(new Set(own
        .filter(item => item.state === 'EXACT_MODULE_RELATION')
        .map(item => item.targetModuleId))).sort(),
      explicitTargetsNotTopLevelModules: Array.from(new Set(own
        .filter(item => item.state === 'EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE')
        .map(item => item.targetModuleId))).sort(),
      genericTokens: Array.from(new Set(own
        .filter(item => item.state === 'GENERIC_TOKEN_UNINTERPRETED')
        .map(item => item.token))).sort(),
      inDeclaredCycle: cycles.some(cycle => cycle.members.includes(module.id))
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const explicitTargetsNotTopLevel = declarations.filter(item => item.state === 'EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE');
  const generic = declarations.filter(item => item.state === 'GENERIC_TOKEN_UNINTERPRETED');
  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
    ? Math.floor(options.ttlMs)
    : DEFAULT_TTL_MS;
  const sourceMaterial = {
    sourceFiles: sourceFiles.slice().sort((left, right) => left.path.localeCompare(right.path)),
    skippedSymlinks: skippedSymlinks.slice().sort(),
    readIssues,
    duplicateIds,
    modules,
    declarations,
    edges,
    cycles
  };

  return {
    schema: MAP_SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(root),
      fingerprint: sha256(Buffer.from(stableJson(sourceMaterial))),
      filesRead: sourceFiles.length,
      symlinksFollowed: false,
      skippedSymlinks: skippedSymlinks.sort()
    },
    summary: {
      modules: modules.length,
      contractsPresent: modules.filter(module => module.contractState === 'PRESENT').length,
      contractUnknown: modules.filter(module => module.contractState !== 'PRESENT').length,
      declarationOccurrences: declarations.length,
      exactModuleRelations: edges.length,
      modulesInDeclaredCycles: modules.filter(module => module.inDeclaredCycle).length,
      declaredCycles: cycles.length,
      explicitTargetsNotTopLevelModules: explicitTargetsNotTopLevel.length,
      genericTokensUninterpreted: new Set(generic.map(item => item.token)).size,
      duplicateManifestIds: duplicateIds.length,
      readIssues: readIssues.length
    },
    modules,
    edges,
    cycles,
    explicitTargetsNotTopLevelModules: explicitTargetsNotTopLevel,
    genericTokens: Array.from(new Set(generic.map(item => item.token))).sort(),
    duplicateManifestIds: duplicateIds,
    readIssues,
    scopeBoundary: 'Only targets matching a current top-level module ID form edges. Explicit service:/module:/tool: names without that match are reported as not observed in this scope, never called missing; generic tokens remain uninterpreted.',
    truth: {
      dependencyAvailabilityProbed: false,
      readinessProbed: false,
      versionResolutionPerformed: false,
      activationOrderSelected: false,
      providerSubstitutionPerformed: false,
      networkUsed: false,
      dependencyInstalled: false,
      declarationRepairPerformed: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      permissionChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

function freshness(observation, options = {}) {
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const observedMs = Date.parse(observation && observation.measuredAt);
  const ttlMs = Number(observation && observation.freshnessTtlMs);
  if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    return { status: 'UNTIMED', ageMs: null, remainingMs: null };
  }
  const ageMs = Math.max(0, nowMs - observedMs);
  return {
    status: ageMs <= ttlMs ? 'LIVE' : 'STALE',
    ageMs,
    remainingMs: Math.max(0, ttlMs - ageMs)
  };
}

function createCycleReviewPacket(map, memberId, options = {}) {
  if (!map || map.schema !== MAP_SCHEMA || !Array.isArray(map.cycles) || !Array.isArray(map.edges)) {
    throw new Error('dependency map schema must be ' + MAP_SCHEMA);
  }
  const requestedMemberId = typeof memberId === 'string' ? memberId.trim() : '';
  if (!requestedMemberId) throw new Error('cycle member id is required');
  const cycle = map.cycles.find(item =>
    Array.isArray(item.members) && item.members.includes(requestedMemberId)
  );
  if (!cycle) throw new Error('selected module is not in an observed declared cycle: ' + requestedMemberId);

  const memberSet = new Set(cycle.members);
  const internalEdges = map.edges.filter(edge => memberSet.has(edge.from) && memberSet.has(edge.to));
  const incomingEdges = map.edges.filter(edge => !memberSet.has(edge.from) && memberSet.has(edge.to));
  const outgoingEdges = map.edges.filter(edge => memberSet.has(edge.from) && !memberSet.has(edge.to));
  const modules = cycle.members.map(id => {
    const record = (map.modules || []).find(item => item.id === id);
    return record ? {
      id: record.id,
      version: record.version,
      status: record.status,
      contractState: record.contractState,
      exactTargets: record.exactTargets,
      explicitTargetsNotTopLevelModules: record.explicitTargetsNotTopLevelModules,
      genericTokens: record.genericTokens
    } : {
      id,
      version: 'UNKNOWN',
      status: 'UNKNOWN',
      contractState: 'UNKNOWN',
      exactTargets: [],
      explicitTargetsNotTopLevelModules: [],
      genericTokens: []
    };
  });
  const questions = internalEdges.map(edge => ({
    id: 'edge-role:' + edge.from + '->' + edge.to,
    kind: 'EDGE_ROLE',
    prompt: 'Is ' + edge.from + ' → ' + edge.to + ' required for startup, runtime cooperation, optional navigation, or presentation only?',
    evidence: {
      sources: edge.sources,
      tokens: edge.tokens
    },
    answer: null
  }));
  modules.filter(module => module.contractState !== 'PRESENT').forEach(module => {
    questions.push({
      id: 'contract-boundary:' + module.id,
      kind: 'CONTRACT_BOUNDARY',
      prompt: 'Which versioned contract, if any, defines ' + module.id + '\'s dependency and failure boundary?',
      evidence: {
        contractState: module.contractState
      },
      answer: null
    });
  });
  questions.push({
    id: 'cycle-runtime-behavior',
    kind: 'RUNTIME_EVIDENCE',
    prompt: 'Does runtime evidence show harmless reciprocal integration, ordered startup, degraded operation, or an actual deadlock?',
    evidence: null,
    answer: null
  });

  const generatedAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    dependencyMapFingerprint: map.source && map.source.fingerprint || null,
    requestedMemberId,
    members: cycle.members,
    internalEdges,
    incomingEdges,
    outgoingEdges,
    modules,
    questions
  };
  return {
    schema: REVIEW_PACKET_SCHEMA,
    version: 'v0.1',
    generatedAt,
    sourceMap: {
      measuredAt: map.measuredAt,
      freshnessTtlMs: map.freshnessTtlMs,
      freshnessAtGeneration: freshness(map, { now: generatedAt }),
      fingerprint: map.source && map.source.fingerprint || null
    },
    reviewFingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
    selection: {
      rule: 'EXACT_MEMBER_OF_OBSERVED_DECLARED_CYCLE',
      requestedMemberId,
      selectedSmallestAutomatically: options.selectedSmallestAutomatically === true
    },
    cycle: {
      state: 'DECLARED_CYCLE_REVIEW_REQUIRED',
      members: cycle.members,
      internalEdges,
      incomingEdges,
      outgoingEdges
    },
    modules,
    questions,
    unknowns: [
      'runtime call order',
      'startup requirements',
      'dependency optionality',
      'failure and degraded-mode behavior',
      'whether any deadlock exists',
      'whether any edge should change'
    ],
    humanDecision: {
      state: 'UNDECIDED',
      acceptedAsIntentional: null,
      edgeChangeRequested: null,
      notes: null
    },
    truth: {
      cycleIsDefect: false,
      deadlockProven: false,
      runtimeBehaviorProbed: false,
      edgeRemovalRecommended: false,
      activationOrderSelected: false,
      declarationRepairPerformed: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      permissionChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  MAP_SCHEMA,
  REVIEW_PACKET_SCHEMA,
  DEFAULT_TTL_MS,
  sha256,
  stableJson,
  cleanStrings,
  safeContractPath,
  stronglyConnected,
  scanWorkshop,
  freshness,
  createCycleReviewPacket
};
