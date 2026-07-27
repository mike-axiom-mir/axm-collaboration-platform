'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SURFACE_SCHEMA = 'axm.protocol-version-surface/v1';
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

function parseProtocolToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) return null;
  const future = token.startsWith('future:');
  const body = future ? token.slice('future:'.length) : token;
  const match = body.match(/^(.*)\/(v[0-9][A-Za-z0-9._-]*)$/);
  return {
    token,
    future,
    convention: match ? 'AXM_SLASH_VERSION' : 'UNPARSED_VERSION_CONVENTION',
    family: match ? match[1] : null,
    version: match ? match[2] : null
  };
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

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const toolsRoot = path.join(root, 'tools');
  const rootStat = fs.lstatSync(toolsRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('tools root must be a regular non-symlink directory');
  }

  const modules = [];
  const sourceFiles = [];
  const skippedSymlinks = [];
  const readIssues = [];
  const declarations = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  function add(moduleId, role, values) {
    cleanStrings(values).forEach(value => {
      declarations.push(Object.assign({
        moduleId,
        role
      }, parseProtocolToken(value)));
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
    const moduleId = typeof manifest.id === 'string' && manifest.id.trim()
      ? manifest.id.trim()
      : entry.name;
    const moduleRecord = {
      id: moduleId,
      folder: entry.name,
      version: typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN',
      status: typeof manifest.status === 'string' ? manifest.status : 'UNKNOWN',
      manifestSha256: manifestLoaded.sha256,
      contractState: manifest.contract ? 'DECLARED_UNREAD' : 'NOT_DECLARED',
      contractSha256: null,
      declarationCount: 0
    };
    sourceFiles.push({
      path: 'tools/' + entry.name + '/manifest.json',
      sha256: manifestLoaded.sha256,
      bytes: manifestLoaded.bytes
    });
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
          add(moduleId, 'contract.provides', contract.provides);
          add(moduleId, 'contract.handoffs.accepts', contract.handoffs && contract.handoffs.accepts);
          add(moduleId, 'contract.handoffs.emits', contract.handoffs && contract.handoffs.emits);
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
    modules.push(moduleRecord);
  }

  declarations.sort((left, right) =>
    left.token.localeCompare(right.token) ||
    left.moduleId.localeCompare(right.moduleId) ||
    left.role.localeCompare(right.role)
  );
  for (const module of modules) {
    module.declarationCount = declarations.filter(item => item.moduleId === module.id).length;
  }
  modules.sort((left, right) => left.id.localeCompare(right.id));

  const tokenMap = new Map();
  for (const declaration of declarations) {
    if (!tokenMap.has(declaration.token)) tokenMap.set(declaration.token, []);
    tokenMap.get(declaration.token).push(declaration);
  }
  const tokens = Array.from(tokenMap.entries()).map(([token, occurrences]) => {
    const parsed = parseProtocolToken(token);
    return {
      token,
      future: parsed.future,
      convention: parsed.convention,
      family: parsed.family,
      version: parsed.version,
      modules: Array.from(new Set(occurrences.map(item => item.moduleId))).sort(),
      roles: Array.from(new Set(occurrences.map(item => item.role))).sort(),
      occurrences: occurrences.map(item => ({ moduleId: item.moduleId, role: item.role })),
      truth: {
        protocolValidated: false,
        compatibilityProven: false,
        preferredVersionSelected: false
      }
    };
  }).sort((left, right) => left.token.localeCompare(right.token));

  const familyMap = new Map();
  for (const token of tokens.filter(item => item.convention === 'AXM_SLASH_VERSION')) {
    if (!familyMap.has(token.family)) familyMap.set(token.family, []);
    familyMap.get(token.family).push(token);
  }
  const unparsedSet = new Set(tokens
    .filter(item => item.convention === 'UNPARSED_VERSION_CONVENTION')
    .map(item => item.future ? item.token.slice('future:'.length) : item.token));
  const families = Array.from(familyMap.entries()).map(([family, familyTokens]) => {
    const versions = Array.from(new Set(familyTokens.map(item => item.version))).sort();
    const mixedUnparsedTokens = tokens
      .filter(item =>
        item.convention === 'UNPARSED_VERSION_CONVENTION' &&
        (item.token === family || item.token === 'future:' + family)
      )
      .map(item => item.token)
      .sort();
    const mixed = unparsedSet.has(family);
    return {
      family,
      state: mixed
        ? 'MIXED_VERSIONED_AND_UNPARSED_FAMILY'
        : versions.length > 1
          ? 'MULTIPLE_DECLARED_VERSIONS'
          : 'SINGLE_DECLARED_VERSION',
      versions,
      tokens: familyTokens.map(item => item.token).sort(),
      modules: Array.from(new Set(familyTokens.flatMap(item => item.modules))).sort(),
      roles: Array.from(new Set(familyTokens.flatMap(item => item.roles))).sort(),
      futureTokens: familyTokens.filter(item => item.future).map(item => item.token).sort(),
      mixedUnparsedTokens,
      truth: {
        versionsIncompatible: false,
        migrationRequired: false,
        preferredVersionSelected: false,
        adapterRequired: false
      }
    };
  }).sort((left, right) => left.family.localeCompare(right.family));

  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
    ? Math.floor(options.ttlMs)
    : DEFAULT_TTL_MS;
  const sourceMaterial = {
    sourceFiles: sourceFiles.slice().sort((left, right) => left.path.localeCompare(right.path)),
    skippedSymlinks: skippedSymlinks.slice().sort(),
    readIssues,
    modules,
    declarations,
    tokens,
    families
  };

  return {
    schema: SURFACE_SCHEMA,
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
      contractUnknown: modules.filter(module => module.contractState !== 'PRESENT').length,
      declarationOccurrences: declarations.length,
      uniqueTokens: tokens.length,
      slashVersionedTokens: tokens.filter(token => token.convention === 'AXM_SLASH_VERSION').length,
      unparsedConventionTokens: tokens.filter(token => token.convention === 'UNPARSED_VERSION_CONVENTION').length,
      versionFamilies: families.length,
      multipleVersionFamilies: families.filter(family => family.state === 'MULTIPLE_DECLARED_VERSIONS').length,
      mixedVersionedAndUnparsedFamilies: families.filter(family => family.state === 'MIXED_VERSIONED_AND_UNPARSED_FAMILY').length,
      futureTokenOccurrences: declarations.filter(item => item.future).length,
      readIssues: readIssues.length
    },
    modules,
    tokens,
    families,
    readIssues,
    scopeBoundary: 'Only the exact trailing /v... AXM convention is parsed. Other syntax remains unparsed. Multiple versions are observations, never automatic incompatibility or migration claims.',
    truth: {
      protocolsValidated: false,
      nonAxmVersionSyntaxGuessed: false,
      compatibilityInferred: false,
      preferredVersionSelected: false,
      migrationGenerated: false,
      adapterGenerated: false,
      declarationRewritten: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
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

module.exports = {
  SURFACE_SCHEMA,
  DEFAULT_TTL_MS,
  sha256,
  stableJson,
  cleanStrings,
  parseProtocolToken,
  safeContractPath,
  scanWorkshop,
  freshness
};
