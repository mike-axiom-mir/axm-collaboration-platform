'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ASSUMPTION_SCHEMA = 'axm.host-assumption-map/v1';
const PROBE_REQUEST_SCHEMA = 'axm.environment-probe-request/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const KIND_NAMES = [
  'ABSOLUTE_PATH_SYNTAX',
  'BACKSLASH_PATH_SYNTAX',
  'BROWSER_ENVIRONMENT_DECLARATION',
  'ENVIRONMENT_VARIABLE_SYNTAX',
  'FILESYSTEM_DECLARATION',
  'HOST_RESOURCE_DECLARATION',
  'NETWORK_ENVIRONMENT_DECLARATION',
  'OPERATING_SYSTEM_LITERAL',
  'RUNTIME_OR_TOOL_DECLARATION'
];
const PROBE_CHECKS = {
  ABSOLUTE_PATH_SYNTAX: 'CHECK_PATH_SYNTAX_AND_EXISTENCE',
  BACKSLASH_PATH_SYNTAX: 'CHECK_PATH_SYNTAX_AND_EXISTENCE',
  BROWSER_ENVIRONMENT_DECLARATION: 'CHECK_BROWSER_CAPABILITY',
  ENVIRONMENT_VARIABLE_SYNTAX: 'CHECK_ENVIRONMENT_VARIABLE_PRESENCE_WITHOUT_REVEALING_VALUE',
  FILESYSTEM_DECLARATION: 'CHECK_DECLARED_STORAGE_OR_PATH_BOUNDARY',
  HOST_RESOURCE_DECLARATION: 'CHECK_NAMED_HOST_RESOURCE',
  NETWORK_ENVIRONMENT_DECLARATION: 'CHECK_NETWORK_BOUNDARY_WITHOUT_CONNECTING',
  OPERATING_SYSTEM_LITERAL: 'CHECK_OPERATING_SYSTEM_MATCH',
  RUNTIME_OR_TOOL_DECLARATION: 'CHECK_RUNTIME_OR_TOOL_AVAILABILITY'
};

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
  return {
    value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')),
    sha256: sha256(bytes),
    bytes: bytes.length
  };
}

function classifyToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) return [];
  const lower = token.toLowerCase();
  const kinds = [];
  if (/^(filesystem(?::|\.|\/)|storage(?::|\.|$)|local-data(?::|\/)|assets(?::|\/)|exports(?::|\/)|backups(?::|\/))/.test(lower)) {
    kinds.push('FILESYSTEM_DECLARATION');
  }
  if (/^host(?::|-)/.test(lower)) kinds.push('HOST_RESOURCE_DECLARATION');
  if (/^(browser(?::|-)|hub-store:|user-download:|user-file:|learner-private:)/.test(lower) || /browser-[a-z0-9-]+-api/.test(lower)) {
    kinds.push('BROWSER_ENVIRONMENT_DECLARATION');
  }
  if (/^(network(?::|\.)|private-lan$|official-https|discord:|chatgpt:|claude:)/.test(lower) || /^https?:\/\//.test(lower)) {
    kinds.push('NETWORK_ENVIRONMENT_DECLARATION');
  }
  if (/^(runtime(?::|$)|service:runtime$|optional-adapter:|adapter:|bridge:local$|provider:)/.test(lower) ||
      /(^|[-:])(ffmpeg|node|python|chromium|websocket|webgl|webrtc)([-:/]|$)/.test(lower)) {
    kinds.push('RUNTIME_OR_TOOL_DECLARATION');
  }
  if (/(^|[^a-z])(windows|linux|macos|darwin|posix|android|ios)([^a-z]|$)/.test(lower)) {
    kinds.push('OPERATING_SYSTEM_LITERAL');
  }
  if (/^(\/(?!\/)|[a-zA-Z]:[\\/]|\\\\)/.test(token)) kinds.push('ABSOLUTE_PATH_SYNTAX');
  if (token.includes('\\')) kinds.push('BACKSLASH_PATH_SYNTAX');
  if (/^(env|environment):[A-Za-z_][A-Za-z0-9_]*$/.test(token) ||
      /\$\{[A-Za-z_][A-Za-z0-9_]*\}/.test(token) ||
      /^process\.env\.[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
    kinds.push('ENVIRONMENT_VARIABLE_SYNTAX');
  }
  return Array.from(new Set(kinds)).sort();
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const toolsRoot = path.join(root, 'tools');
  const toolsStat = fs.lstatSync(toolsRoot);
  if (!toolsStat.isDirectory() || toolsStat.isSymbolicLink()) {
    throw new Error('tools root must be a regular non-symlink directory');
  }

  const rawModules = [];
  const declarations = [];
  const sourceFiles = [];
  const skippedSymlinks = [];
  const readIssues = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  function add(moduleId, role, values) {
    cleanStrings(values).forEach(token => {
      declarations.push({
        moduleId,
        role,
        token,
        kinds: classifyToken(token)
      });
    });
  }

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

    let manifestLoaded;
    try {
      manifestLoaded = readRegularJson(manifestPath);
    } catch (error) {
      readIssues.push({
        path: 'tools/' + entry.name + '/manifest.json',
        code: 'MANIFEST_READ_FAILED',
        message: String(error && error.message || error).slice(0, 240)
      });
      continue;
    }
    const manifest = manifestLoaded.value;
    const moduleId = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : entry.name;
    const moduleRecord = {
      id: moduleId,
      folder: entry.name,
      version: typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN',
      status: typeof manifest.status === 'string' ? manifest.status : 'UNKNOWN',
      manifestSha256: manifestLoaded.sha256,
      contractState: manifest.contract ? 'DECLARED_UNREAD' : 'NOT_DECLARED',
      contractSha256: null
    };
    sourceFiles.push({ path: 'tools/' + entry.name + '/manifest.json', sha256: manifestLoaded.sha256, bytes: manifestLoaded.bytes });
    add(moduleId, 'manifest.uses', manifest.uses);
    add(moduleId, 'manifest.readiness', manifest.readiness);
    add(moduleId, 'manifest.permissions', manifest.permissions);
    add(moduleId, 'manifest.accepts', manifest.accepts);
    add(moduleId, 'manifest.produces', manifest.produces);

    if (manifest.contract) {
      const target = safeContractPath(moduleDirectory, manifest.contract);
      if (!target) {
        moduleRecord.contractState = 'UNSAFE_PATH';
      } else if (!fs.existsSync(target)) {
        moduleRecord.contractState = 'MISSING';
      } else {
        try {
          const contractLoaded = readRegularJson(target);
          const contract = contractLoaded.value;
          moduleRecord.contractState = 'PRESENT';
          moduleRecord.contractSha256 = contractLoaded.sha256;
          sourceFiles.push({
            path: path.relative(root, target).split(path.sep).join('/'),
            sha256: contractLoaded.sha256,
            bytes: contractLoaded.bytes
          });
          add(moduleId, 'contract.consumes', contract.consumes);
          add(moduleId, 'contract.permissions', contract.permissions);
          add(moduleId, 'contract.boundaries.writes', contract.boundaries && contract.boundaries.writes);
        } catch (error) {
          moduleRecord.contractState = 'INVALID';
          readIssues.push({
            path: path.relative(root, target).split(path.sep).join('/'),
            code: 'CONTRACT_READ_FAILED',
            message: String(error && error.message || error).slice(0, 240)
          });
        }
      }
    }
    rawModules.push(moduleRecord);
  }

  declarations.sort((left, right) =>
    left.moduleId.localeCompare(right.moduleId) ||
    left.role.localeCompare(right.role) ||
    left.token.localeCompare(right.token)
  );
  const assumptionDeclarations = declarations.filter(item => item.kinds.length);
  const tokenMap = new Map();
  for (const declaration of assumptionDeclarations) {
    if (!tokenMap.has(declaration.token)) tokenMap.set(declaration.token, []);
    tokenMap.get(declaration.token).push(declaration);
  }
  const assumptions = Array.from(tokenMap.entries()).map(([token, occurrences]) => ({
    token,
    state: 'DECLARED_NOT_PROBED',
    kinds: Array.from(new Set(occurrences.flatMap(item => item.kinds))).sort(),
    modules: Array.from(new Set(occurrences.map(item => item.moduleId))).sort(),
    roles: Array.from(new Set(occurrences.map(item => item.role))).sort(),
    occurrences: occurrences.map(item => ({ moduleId: item.moduleId, role: item.role, kinds: item.kinds })),
    truth: {
      presentOnCurrentHost: false,
      compatibleWithCurrentHost: false,
      readyOnCurrentHost: false,
      permissionGranted: false
    }
  })).sort((left, right) => left.token.localeCompare(right.token));
  const modules = rawModules.map(module => {
    const own = assumptionDeclarations.filter(item => item.moduleId === module.id);
    return Object.assign({}, module, {
      assumptionOccurrences: own.length,
      uniqueAssumptions: new Set(own.map(item => item.token)).size,
      kinds: Array.from(new Set(own.flatMap(item => item.kinds))).sort()
    });
  }).sort((left, right) => left.id.localeCompare(right.id));
  const kindCounts = Object.fromEntries(KIND_NAMES.map(kind => [kind, 0]));
  assumptionDeclarations.forEach(item => item.kinds.forEach(kind => {
    kindCounts[kind] = (kindCounts[kind] || 0) + 1;
  }));

  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0 ? Math.floor(options.ttlMs) : DEFAULT_TTL_MS;
  const sourceMaterial = {
    sourceFiles: sourceFiles.slice().sort((left, right) => left.path.localeCompare(right.path)),
    skippedSymlinks: skippedSymlinks.slice().sort(),
    readIssues,
    modules,
    declarations
  };
  return {
    schema: ASSUMPTION_SCHEMA,
    version: 'v0.2',
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
      declarationOccurrencesScanned: declarations.length,
      assumptionOccurrences: assumptionDeclarations.length,
      uniqueAssumptions: assumptions.length,
      modulesWithAssumptions: modules.filter(module => module.assumptionOccurrences > 0).length,
      unclassifiedDeclarationOccurrences: declarations.length - assumptionDeclarations.length,
      kindOccurrences: Object.fromEntries(Object.entries(kindCounts).sort(([left], [right]) => left.localeCompare(right))),
      readIssues: readIssues.length
    },
    modules,
    assumptions,
    scopeBoundary: 'Only exact strings in manifest uses/readiness/permissions/accepts/produces and contract consumes/permissions/boundaries.writes are classified by explicit syntax. Prose, source code, runtime state, and undeclared assumptions are outside scope.',
    probeHandoff: {
      state: 'RUNTIME_PROBE_REQUIRED_FOR_COMPATIBILITY',
      compatibleInputForTouchEnvironmentProbe: true,
      actualProbePerformed: false
    },
    truth: {
      proseInferred: false,
      undeclaredAssumptionsInferred: false,
      actualHostProbed: false,
      compatibilityProven: false,
      readinessProven: false,
      toolAvailabilityProven: false,
      pathExistenceProven: false,
      networkReachabilityProven: false,
      permissionChanged: false,
      dependencyInstalled: false,
      pathRewritten: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
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

function createProbeRequest(map, moduleIdInput, options = {}) {
  if (!map || map.schema !== ASSUMPTION_SCHEMA) {
    throw new Error('probe request requires an ' + ASSUMPTION_SCHEMA + ' source map');
  }
  const moduleId = typeof moduleIdInput === 'string' ? moduleIdInput.trim() : '';
  if (!moduleId) throw new Error('probe request requires one exact module id');
  const moduleRecord = Array.isArray(map.modules) && map.modules.find(item => item.id === moduleId);
  if (!moduleRecord) throw new Error('module is not present in source map: ' + moduleId);

  const assumptions = (Array.isArray(map.assumptions) ? map.assumptions : []).flatMap(assumption => {
    const occurrences = (Array.isArray(assumption.occurrences) ? assumption.occurrences : [])
      .filter(occurrence => occurrence.moduleId === moduleId);
    if (!occurrences.length) return [];
    return [{
      token: assumption.token,
      state: 'DECLARED_NOT_PROBED',
      kinds: Array.from(new Set(occurrences.flatMap(occurrence => occurrence.kinds || []))).sort(),
      roles: Array.from(new Set(occurrences.map(occurrence => occurrence.role))).sort(),
      occurrences: occurrences.length
    }];
  }).sort((left, right) => left.token.localeCompare(right.token));
  if (!assumptions.length) {
    throw new Error('selected module has no classified host assumptions: ' + moduleId);
  }

  const kinds = Array.from(new Set(assumptions.flatMap(assumption => assumption.kinds))).sort();
  const checkIds = Array.from(new Set(kinds.map(kind => PROBE_CHECKS[kind]).filter(Boolean))).sort();
  const checks = checkIds.map(checkId => ({
    id: checkId,
    state: 'REQUEST_NOT_RUN',
    executionAuthority: 'TOUCH_ENVIRONMENT_PROBE',
    readOnlyRequested: true,
    secretValuesRequested: false,
    observation: null,
    decision: null,
    sourceKinds: kinds.filter(kind => PROBE_CHECKS[kind] === checkId)
  }));
  const generatedAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    schema: PROBE_REQUEST_SCHEMA,
    module: {
      id: moduleRecord.id,
      folder: moduleRecord.folder,
      version: moduleRecord.version,
      contractState: moduleRecord.contractState
    },
    sourceFingerprint: map.source && map.source.fingerprint,
    assumptions,
    checks
  };
  return {
    schema: PROBE_REQUEST_SCHEMA,
    version: 'v0.2',
    generatedAt,
    fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
    selectedModule: fingerprintMaterial.module,
    sourceObservation: {
      schema: map.schema,
      measuredAt: map.measuredAt,
      freshnessTtlMs: map.freshnessTtlMs,
      fingerprint: map.source && map.source.fingerprint,
      freshnessAtRequest: freshness(map, { now: generatedAt })
    },
    summary: {
      assumptions: assumptions.length,
      assumptionOccurrences: assumptions.reduce((total, assumption) => total + assumption.occurrences, 0),
      checksRequested: checks.length,
      checksRun: 0
    },
    assumptions,
    checks,
    scopeBoundary: 'This is a bounded request for Touch Environment Probe to inspect one selected module read-only. It contains no commands, does not request secret values, and does not execute any check.',
    truth: {
      requestOnly: true,
      actualProbePerformed: false,
      environmentValuesCaptured: false,
      compatibilityProven: false,
      readinessProven: false,
      permissionChanged: false,
      dependencyInstalled: false,
      pathRewritten: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  ASSUMPTION_SCHEMA,
  PROBE_REQUEST_SCHEMA,
  DEFAULT_TTL_MS,
  KIND_NAMES,
  PROBE_CHECKS,
  cleanStrings,
  safeContractPath,
  classifyToken,
  scanWorkshop,
  freshness,
  createProbeRequest
};
