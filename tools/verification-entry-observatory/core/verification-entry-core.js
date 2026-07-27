'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.verification-entry-map/v1';
const RUN_REQUEST_SCHEMA = 'axm.verification-run-request/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const EXCLUDED_DIRECTORIES = new Set([
  '.cache', '.git', 'assets', 'backups', 'coverage', 'exports',
  'local-data', 'logs', 'node_modules', 'state', 'vendor'
]);
const TEST_EXTENSIONS = new Set(['.cjs', '.html', '.js', '.mjs', '.ts', '.tsx']);

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

function toRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
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

function isTestShapedFilename(filename) {
  const lower = filename.toLowerCase();
  if (!TEST_EXTENSIONS.has(path.extname(lower))) return false;
  const stem = lower.slice(0, -path.extname(lower).length);
  if (stem === 'discovery-seam-review') return true;
  return /(^|[._-])(selftest|test|tests|spec|verify|verification)([._-]|$)/.test(stem);
}

function classifyEntry(relativeWithinModule) {
  if (relativeWithinModule === 'selftest.js') return 'CONVENTIONAL_PRIMARY_SELFTEST';
  if (relativeWithinModule === 'discovery-seam-review.js') return 'DISCOVERY_SEAM_REVIEW';
  return relativeWithinModule.includes('/') ? 'NESTED_NAME_MATCH' : 'MODULE_LOCAL_NAME_MATCH';
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const toolsRoot = path.join(root, 'tools');
  const toolsStat = fs.lstatSync(toolsRoot);
  if (!toolsStat.isDirectory() || toolsStat.isSymbolicLink()) {
    throw new Error('tools root must be a regular non-symlink directory');
  }

  const modules = [];
  const sourceFiles = [];
  const skippedSymlinks = [];
  const readIssues = [];
  const toolEntries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const toolEntry of toolEntries) {
    if (toolEntry.name.startsWith('_')) continue;
    if (toolEntry.isSymbolicLink()) {
      skippedSymlinks.push('tools/' + toolEntry.name);
      continue;
    }
    if (!toolEntry.isDirectory()) continue;
    const moduleRoot = path.join(toolsRoot, toolEntry.name);
    const manifestPath = path.join(moduleRoot, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    let manifestLoaded;
    try {
      manifestLoaded = readRegularJson(manifestPath);
    } catch (error) {
      readIssues.push({
        path: 'tools/' + toolEntry.name + '/manifest.json',
        code: 'MANIFEST_READ_FAILED',
        message: String(error && error.message || error).slice(0, 240)
      });
      continue;
    }
    sourceFiles.push({
      path: 'tools/' + toolEntry.name + '/manifest.json',
      sha256: manifestLoaded.sha256,
      bytes: manifestLoaded.bytes
    });
    const manifest = manifestLoaded.value;
    const moduleId = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : toolEntry.name;
    const entries = [];

    function walk(directory) {
      const children = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const child of children) {
        const absolute = path.join(directory, child.name);
        const relativeWithinModule = toRelative(moduleRoot, absolute);
        const relativeToWorkshop = toRelative(root, absolute);
        if (child.isSymbolicLink()) {
          skippedSymlinks.push(relativeToWorkshop);
          continue;
        }
        if (child.isDirectory()) {
          if (!EXCLUDED_DIRECTORIES.has(child.name.toLowerCase())) walk(absolute);
          continue;
        }
        if (!child.isFile() || relativeWithinModule === 'manifest.json' || relativeWithinModule === 'package.json') continue;
        if (!isTestShapedFilename(child.name)) continue;
        const stat = fs.statSync(absolute);
        entries.push({
          path: relativeWithinModule,
          role: classifyEntry(relativeWithinModule),
          state: 'NAME_MATCH_ONLY',
          bytes: stat.size,
          executableProven: false,
          runPerformed: false
        });
      }
    }
    walk(moduleRoot);
    entries.sort((left, right) => left.path.localeCompare(right.path));

    const packageScripts = [];
    const packagePath = path.join(moduleRoot, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const packageLoaded = readRegularJson(packagePath);
        sourceFiles.push({
          path: 'tools/' + toolEntry.name + '/package.json',
          sha256: packageLoaded.sha256,
          bytes: packageLoaded.bytes
        });
        const scripts = packageLoaded.value && packageLoaded.value.scripts;
        if (scripts && typeof scripts === 'object' && !Array.isArray(scripts)) {
          for (const scriptName of Object.keys(scripts).sort()) {
            if (!/(test|selftest|verify|check)/i.test(scriptName)) continue;
            if (typeof scripts[scriptName] !== 'string') continue;
            packageScripts.push({
              name: scriptName,
              declaredCommand: scripts[scriptName],
              state: 'DECLARED_NOT_RUN'
            });
          }
        }
      } catch (error) {
        readIssues.push({
          path: 'tools/' + toolEntry.name + '/package.json',
          code: 'PACKAGE_READ_FAILED',
          message: String(error && error.message || error).slice(0, 240)
        });
      }
    }

    modules.push({
      id: moduleId,
      folder: toolEntry.name,
      version: typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN',
      status: typeof manifest.status === 'string' ? manifest.status : 'UNKNOWN',
      manifestSha256: manifestLoaded.sha256,
      conventionalSelftest: entries.some(entry => entry.role === 'CONVENTIONAL_PRIMARY_SELFTEST'),
      discoverySeamReview: entries.some(entry => entry.role === 'DISCOVERY_SEAM_REVIEW'),
      entries,
      packageScripts,
      summary: {
        nameMatchedFiles: entries.length,
        declaredPackageScripts: packageScripts.length
      }
    });
  }
  modules.sort((left, right) => left.id.localeCompare(right.id));
  skippedSymlinks.sort();
  sourceFiles.sort((left, right) => left.path.localeCompare(right.path));
  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0 ? Math.floor(options.ttlMs) : DEFAULT_TTL_MS;
  const fingerprintMaterial = {
    sourceFiles,
    skippedSymlinks,
    readIssues,
    modules
  };
  return {
    schema: SCHEMA,
    version: 'v0.2',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(root),
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      filesRead: sourceFiles.length,
      fingerprintBasis: 'manifest/package hashes plus test-shaped relative paths and byte-size metadata',
      symlinksFollowed: false,
      skippedSymlinks,
      excludedDirectories: Array.from(EXCLUDED_DIRECTORIES).sort()
    },
    summary: {
      modules: modules.length,
      modulesWithConventionalSelftest: modules.filter(module => module.conventionalSelftest).length,
      modulesWithDiscoverySeamReview: modules.filter(module => module.discoverySeamReview).length,
      modulesWithNameMatches: modules.filter(module => module.entries.length).length,
      modulesWithDeclaredPackageScripts: modules.filter(module => module.packageScripts.length).length,
      nameMatchedFiles: modules.reduce((total, module) => total + module.entries.length, 0),
      declaredPackageScripts: modules.reduce((total, module) => total + module.packageScripts.length, 0),
      modulesWithoutNameMatches: modules.filter(module => !module.entries.length && !module.packageScripts.length).length,
      readIssues: readIssues.length
    },
    modules,
    readIssues,
    scopeBoundary: 'Only test-shaped filenames and matching package.json script declarations are inventoried. Source bodies are not interpreted and nothing is executed.',
    preservedOwners: {
      execution: 'Machine Host and each module selftest owner',
      receipts: 'Evidence Desk',
      readiness: 'Technical Glasses',
      hubAndWorkshopGates: 'Workshop root verification programs'
    },
    truth: {
      testsExecuted: false,
      commandsExecuted: false,
      entrypointExecutableProven: false,
      testPassingProven: false,
      coverageProven: false,
      readinessProven: false,
      qualityProven: false,
      machineHostChanged: false,
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

function runtimeHint(relativePath) {
  const extension = path.extname(String(relativePath || '').toLowerCase());
  if (extension === '.html') return 'BROWSER_RUNTIME_NOT_PROVEN';
  if (extension === '.ts' || extension === '.tsx') return 'TYPESCRIPT_TOOLCHAIN_NOT_PROVEN';
  if (extension === '.js' || extension === '.cjs' || extension === '.mjs') {
    return 'NODE_OR_DECLARED_MODULE_RUNTIME_NOT_PROVEN';
  }
  return 'RUNTIME_UNKNOWN';
}

function createRunRequest(map, moduleIdInput, entryPathInput, options = {}) {
  if (!map || map.schema !== SCHEMA) {
    throw new Error('run request requires an ' + SCHEMA + ' source map');
  }
  const moduleId = typeof moduleIdInput === 'string' ? moduleIdInput.trim() : '';
  const entryPath = typeof entryPathInput === 'string' ? entryPathInput.trim() : '';
  if (!moduleId || !entryPath) throw new Error('run request requires one exact module id and mapped entry path');
  const moduleRecord = Array.isArray(map.modules) && map.modules.find(item => item.id === moduleId);
  if (!moduleRecord) throw new Error('module is not present in source map: ' + moduleId);
  const entry = Array.isArray(moduleRecord.entries) && moduleRecord.entries.find(item => item.path === entryPath);
  if (!entry) throw new Error('verification entry is not mapped for selected module: ' + entryPath);

  const selectedEntry = {
    path: entry.path,
    role: entry.role,
    observedState: entry.state,
    bytes: entry.bytes,
    runtimeHint: runtimeHint(entry.path)
  };
  const checks = [
    'CHECK_SOURCE_FINGERPRINT_AND_ENTRY_PRESENCE',
    'CHECK_REQUIRED_RUNTIME_OR_ADAPTER',
    'RUN_ONLY_SELECTED_ENTRY_IN_BOUNDED_MODULE_SCOPE',
    'CAPTURE_EXIT_OUTPUT_AND_SIDE_EFFECT_RECEIPT'
  ].map(id => ({
    id,
    state: 'REQUEST_NOT_RUN',
    executionAuthority: 'MACHINE_HOST_OR_DECLARING_MODULE_OWNER',
    observation: null,
    decision: null
  }));
  const generatedAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    schema: RUN_REQUEST_SCHEMA,
    selectedModule: {
      id: moduleRecord.id,
      folder: moduleRecord.folder,
      version: moduleRecord.version,
      status: moduleRecord.status
    },
    selectedEntry,
    sourceFingerprint: map.source && map.source.fingerprint,
    checks
  };
  return {
    schema: RUN_REQUEST_SCHEMA,
    version: 'v0.2',
    generatedAt,
    fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
    selectedModule: fingerprintMaterial.selectedModule,
    selectedEntry,
    sourceObservation: {
      schema: map.schema,
      measuredAt: map.measuredAt,
      freshnessTtlMs: map.freshnessTtlMs,
      fingerprint: map.source && map.source.fingerprint,
      freshnessAtRequest: freshness(map, { now: generatedAt })
    },
    executionEnvelope: {
      commandIncluded: false,
      argumentsIncluded: false,
      environmentValuesIncluded: false,
      fixtureInputIncluded: false,
      networkAccessRequested: false,
      sourceWriteAccessRequested: false,
      sideEffectsUnknownUntilOwnerReview: true
    },
    summary: {
      entriesSelected: 1,
      checksRequested: checks.length,
      checksRun: 0
    },
    checks,
    scopeBoundary: 'This request names one already-observed verification entry. It supplies no command, arguments, environment values, or fixture and cannot execute itself.',
    truth: {
      requestOnly: true,
      sourceBodyInterpreted: false,
      executionPerformed: false,
      passingProven: false,
      coverageProven: false,
      readinessProven: false,
      sideEffectsProvenAbsent: false,
      machineHostChanged: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      permissionChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  SCHEMA,
  RUN_REQUEST_SCHEMA,
  DEFAULT_TTL_MS,
  EXCLUDED_DIRECTORIES,
  TEST_EXTENSIONS,
  isTestShapedFilename,
  classifyEntry,
  scanWorkshop,
  freshness,
  runtimeHint,
  createRunRequest
};
