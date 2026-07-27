'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CENSUS_SCHEMA = 'axm.workshop-census/v1';
const REFERENCE_SCHEMA = 'axm.workshop-census-reference/v1';
const COMPARISON_SCHEMA = 'axm.workshop-census-comparison/v1';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.cache',
  'backups',
  'coverage',
  'exports',
  'local-data',
  'logs',
  'node_modules',
  'state'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function posixRelative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function listTopLevelDirectories(root, relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function walkEvidence(root) {
  const manifests = [];
  const contracts = [];
  const games = [];
  const skippedSymlinks = [];
  const stack = [root];

  while (stack.length) {
    const directory = stack.pop();
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = posixRelative(root, absolute);
      if (entry.isSymbolicLink()) {
        skippedSymlinks.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name === 'manifest.json') manifests.push(absolute);
      if (entry.name === 'module.contract.json') contracts.push(absolute);
      if (entry.name === 'game.manifest.json') games.push(absolute);
    }
  }

  const sortPaths = values => values.sort((a, b) => posixRelative(root, a).localeCompare(posixRelative(root, b)));
  return {
    manifests: sortPaths(manifests),
    contracts: sortPaths(contracts),
    games: sortPaths(games),
    skippedSymlinks: skippedSymlinks.sort((a, b) => a.localeCompare(b))
  };
}

function inspectJson(root, absolute) {
  const relative = posixRelative(root, absolute);
  const bytes = fs.readFileSync(absolute);
  try {
    return {
      path: relative,
      sha256: sha256(bytes),
      value: JSON.parse(bytes.toString('utf8')),
      error: null
    };
  } catch (error) {
    return {
      path: relative,
      sha256: sha256(bytes),
      value: null,
      error: error.message
    };
  }
}

function scope(scopeId, label, count, definition, members) {
  return {
    scopeId,
    label,
    count,
    definition,
    members
  };
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('Workshop root must be an existing directory');
  }

  const evidence = walkEvidence(root);
  const manifestRecords = evidence.manifests.map(file => inspectJson(root, file));
  const contractRecords = evidence.contracts.map(file => inspectJson(root, file));
  const gameRecords = evidence.games.map(file => inspectJson(root, file));
  const toolDirectories = listTopLevelDirectories(root, 'tools');
  const toolTemplates = toolDirectories.filter(name => name.startsWith('_'));
  const activeToolDirectories = toolDirectories.filter(name => !name.startsWith('_'));
  const hubTools = [];
  const toolDirectoriesWithoutManifest = [];

  for (const folder of activeToolDirectories) {
    const manifestPath = path.join(root, 'tools', folder, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      toolDirectoriesWithoutManifest.push('tools/' + folder);
      continue;
    }
    const record = inspectJson(root, manifestPath);
    const value = record.value || {};
    const contractRelative = typeof value.contract === 'string' && value.contract.trim()
      ? path.posix.join('tools', folder, value.contract.split(path.sep).join('/'))
      : null;
    const contractAbsolute = contractRelative ? path.resolve(root, contractRelative) : null;
    const toolPrefix = path.resolve(root, 'tools', folder) + path.sep;
    const safeContract = contractAbsolute && contractAbsolute.startsWith(toolPrefix);
    hubTools.push({
      folder,
      path: record.path,
      id: typeof value.id === 'string' && value.id.trim() ? value.id : null,
      name: typeof value.name === 'string' && value.name.trim() ? value.name : null,
      status: typeof value.status === 'string' && value.status.trim() ? value.status : null,
      version: typeof value.version === 'string' && value.version.trim() ? value.version : null,
      manifestValid: !record.error,
      manifestError: record.error,
      contractDeclared: Boolean(contractRelative),
      contractPathSafe: Boolean(safeContract),
      contractPresent: Boolean(safeContract && fs.existsSync(contractAbsolute))
    });
  }

  hubTools.sort((a, b) => a.folder.localeCompare(b.folder));
  const sharedBodies = listTopLevelDirectories(root, 'shared')
    .filter(name => !name.startsWith('_') && name !== 'vendor');
  const worlds = listTopLevelDirectories(root, 'worlds').filter(name => !name.startsWith('_'));
  const assetZones = listTopLevelDirectories(root, 'assets').filter(name => !name.startsWith('_'));
  const recursiveManifestPaths = manifestRecords.map(record => record.path);
  const recursiveContractPaths = contractRecords.map(record => record.path);
  const gamePaths = gameRecords.map(record => record.path);
  const hubManifestPaths = new Set(hubTools.map(tool => tool.path));
  const nestedOrNonHubManifests = recursiveManifestPaths.filter(item => !hubManifestPaths.has(item));
  const hubToolsWithContracts = hubTools.filter(tool => tool.contractDeclared && tool.contractPathSafe && tool.contractPresent);

  function duplicateIds(records) {
    const ids = new Map();
    for (const record of records) {
      const id = record.value && typeof record.value.id === 'string' ? record.value.id.trim() : '';
      if (!id) continue;
      const paths = ids.get(id) || [];
      paths.push(record.path);
      ids.set(id, paths);
    }
    return Array.from(ids.entries())
      .filter(([, paths]) => paths.length > 1)
      .map(([id, paths]) => ({ id, paths: paths.sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  const templateManifestRecords = manifestRecords.filter(record => /^tools\/_/.test(record.path));
  const activeManifestRecords = manifestRecords.filter(record => !/^tools\/_/.test(record.path));
  const duplicateManifestIds = duplicateIds(activeManifestRecords);
  const templateDuplicateManifestIds = duplicateIds(templateManifestRecords);

  const scopes = [
    scope(
      'hub-registered-tools',
      'Hub-registered tools',
      hubTools.length,
      'Top-level tools/<folder>/manifest.json entries, excluding underscore-prefixed template folders.',
      hubTools.map(tool => tool.folder)
    ),
    scope(
      'tool-directories',
      'Top-level tool directories',
      toolDirectories.length,
      'Every top-level directory under tools/, including explicitly separated template directories.',
      toolDirectories
    ),
    scope(
      'hub-tools-with-declared-contracts',
      'Hub tools with present declared contracts',
      hubToolsWithContracts.length,
      'Hub-registered tools whose manifest declares a safe contract path and whose contract file is present.',
      hubToolsWithContracts.map(tool => tool.folder)
    ),
    scope(
      'recursive-manifest-files',
      'Recursive manifest files',
      recursiveManifestPaths.length,
      'Every active-source manifest.json below the selected root after generated, state, dependency, and cache exclusions.',
      recursiveManifestPaths
    ),
    scope(
      'recursive-module-contract-files',
      'Recursive module contract files',
      recursiveContractPaths.length,
      'Every active-source module.contract.json below the selected root after exclusions.',
      recursiveContractPaths
    ),
    scope(
      'shared-top-level-bodies',
      'Shared top-level bodies',
      sharedBodies.length,
      'Top-level directories under shared/, excluding underscore-prefixed folders and the vendor dependency zone.',
      sharedBodies
    ),
    scope(
      'world-directories',
      'World directories',
      worlds.length,
      'Non-template top-level directories under worlds/.',
      worlds
    ),
    scope(
      'game-packages',
      'Game packages',
      gamePaths.length,
      'Active-source game.manifest.json files found recursively.',
      gamePaths
    ),
    scope(
      'asset-zones',
      'Asset zones',
      assetZones.length,
      'Non-template top-level directories under assets/.',
      assetZones
    )
  ];

  const fingerprintEvidence = {
    scopes: scopes.map(item => ({ scopeId: item.scopeId, members: item.members })),
    manifests: manifestRecords.map(record => ({ path: record.path, sha256: record.sha256 })),
    contracts: contractRecords.map(record => ({ path: record.path, sha256: record.sha256 })),
    games: gameRecords.map(record => ({ path: record.path, sha256: record.sha256 })),
    skippedSymlinks: evidence.skippedSymlinks
  };

  return {
    schema: CENSUS_SCHEMA,
    version: 'v0.1',
    measuredAt: new Date(options.now || Date.now()).toISOString(),
    source: {
      label: path.basename(root),
      fingerprint: sha256(Buffer.from(JSON.stringify(fingerprintEvidence))),
      exclusions: Array.from(EXCLUDED_DIRECTORIES).sort((a, b) => a.localeCompare(b)),
      symlinksFollowed: false,
      skippedSymlinkCount: evidence.skippedSymlinks.length
    },
    scopes,
    relations: {
      toolTemplateDirectories: toolTemplates,
      toolDirectoriesWithoutManifest,
      nestedOrNonHubManifests,
      duplicateManifestIds,
      templateDuplicateManifestIds,
      invalidManifestFiles: manifestRecords.filter(record => record.error).map(record => ({ path: record.path, error: record.error })),
      invalidContractFiles: contractRecords.filter(record => record.error).map(record => ({ path: record.path, error: record.error })),
      hubToolContractCoverage: {
        numerator: hubToolsWithContracts.length,
        denominator: hubTools.length,
        missing: hubTools.filter(tool => !tool.contractDeclared || !tool.contractPathSafe || !tool.contractPresent)
          .map(tool => ({
            folder: tool.folder,
            contractDeclared: tool.contractDeclared,
            contractPathSafe: tool.contractPathSafe,
            contractPresent: tool.contractPresent
          }))
      }
    },
    truth: {
      universalModuleTotalClaimed: false,
      scopeCountsInterchangeable: false,
      readinessProven: false,
      qualityProven: false,
      installationPerformed: false,
      permissionChanged: false,
      canonChanged: false,
      automaticAction: false
    }
  };
}

function compareReference(census, reference, options = {}) {
  if (!census || census.schema !== CENSUS_SCHEMA || !Array.isArray(census.scopes)) {
    throw new Error('census schema must be ' + CENSUS_SCHEMA);
  }
  const input = reference && typeof reference === 'object' ? reference : {};
  const nowMs = new Date(options.now || Date.now()).getTime();
  const measuredMs = Date.parse(input.measuredAt || '');
  const requestedTtl = Number(options.ttlMs === undefined ? input.ttlMs : options.ttlMs);
  const ttlMs = Number.isFinite(requestedTtl) && requestedTtl >= 0 ? requestedTtl : DEFAULT_TTL_MS;
  const timed = Number.isFinite(measuredMs);
  const rawAgeMs = timed ? nowMs - measuredMs : null;
  const ageMs = timed ? Math.max(0, rawAgeMs) : null;
  const freshness = !timed ? 'UNTIMED' : ageMs <= ttlMs ? 'LIVE' : 'STALE';
  const selected = census.scopes.find(item => item.scopeId === input.scopeId) || null;
  const referenceCount = Number(input.count);

  let outcome;
  let reason;
  let delta = null;
  if (!selected) {
    outcome = 'NOT_COMPARABLE';
    reason = 'The reference scope is missing or is not declared by this census.';
  } else if (!Number.isInteger(referenceCount) || referenceCount < 0) {
    outcome = 'INVALID_REFERENCE';
    reason = 'The reference count must be a non-negative integer.';
  } else {
    delta = selected.count - referenceCount;
    outcome = delta === 0 ? 'MATCH' : 'DRIFT';
    reason = delta === 0
      ? 'The current and reference counts match within the same named scope.'
      : 'The same named scope changed; the signed delta is current minus reference.';
  }

  return {
    schema: COMPARISON_SCHEMA,
    comparedAt: new Date(nowMs).toISOString(),
    censusFingerprint: census.source && census.source.fingerprint || null,
    reference: {
      schema: input.schema || REFERENCE_SCHEMA,
      scopeId: input.scopeId || null,
      count: Number.isFinite(referenceCount) ? referenceCount : null,
      measuredAt: timed ? new Date(measuredMs).toISOString() : null,
      ttlMs,
      freshness,
      ageMs,
      futureTimestamp: Boolean(timed && rawAgeMs < 0)
    },
    current: selected ? {
      scopeId: selected.scopeId,
      count: selected.count,
      definition: selected.definition
    } : null,
    outcome,
    delta,
    reason,
    comparableScopeIds: census.scopes.map(item => item.scopeId),
    truth: {
      sameScopeRequired: true,
      automaticRepair: false,
      automaticInstallation: false,
      canonChanged: false
    }
  };
}

module.exports = {
  CENSUS_SCHEMA,
  REFERENCE_SCHEMA,
  COMPARISON_SCHEMA,
  DEFAULT_TTL_MS,
  EXCLUDED_DIRECTORIES,
  scanWorkshop,
  compareReference
};
