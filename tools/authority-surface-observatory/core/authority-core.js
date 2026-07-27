'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAP_SCHEMA = 'axm.authority-surface-map/v1';
const MODULE_SCHEMA = 'axm.module-authority-surface/v1';
const PERMISSION_SCHEMA = 'axm.permission-declaration-record/v1';
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

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter(item => !rightSet.has(item));
}

function safeContractPath(moduleDir, declared) {
  if (typeof declared !== 'string' || !declared || declared.includes('\0')) return null;
  const target = path.resolve(moduleDir, declared);
  return target.startsWith(moduleDir + path.sep) ? target : null;
}

function readRegularJson(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('not a regular non-symlink JSON file');
  const bytes = fs.readFileSync(file);
  return { value: JSON.parse(bytes.toString('utf8')), sha256: sha256(bytes) };
}

function readContract(moduleDir, manifest) {
  if (!manifest.contract) return {
    state: 'NOT_DECLARED',
    digest: null,
    permissionsPresent: false,
    permissions: [],
    writesPresent: false,
    writes: [],
    refusesPresent: false,
    refuses: [],
    issue: 'module contract not declared'
  };
  const target = safeContractPath(moduleDir, manifest.contract);
  if (!target) return {
    state: 'UNSAFE_PATH',
    digest: null,
    permissionsPresent: false,
    permissions: [],
    writesPresent: false,
    writes: [],
    refusesPresent: false,
    refuses: [],
    issue: 'declared contract path is unsafe'
  };
  try {
    const loaded = readRegularJson(target);
    const contract = loaded.value;
    const boundaries = contract.boundaries && typeof contract.boundaries === 'object' ? contract.boundaries : {};
    return {
      state: 'DECLARED',
      digest: loaded.sha256,
      id: typeof contract.id === 'string' ? contract.id : null,
      permissionsPresent: Array.isArray(contract.permissions),
      permissions: cleanStrings(contract.permissions),
      writesPresent: Array.isArray(boundaries.writes),
      writes: cleanStrings(boundaries.writes),
      refusesPresent: Array.isArray(boundaries.refuses),
      refuses: cleanStrings(boundaries.refuses),
      issue: null
    };
  } catch (error) {
    return {
      state: 'UNAVAILABLE',
      digest: null,
      permissionsPresent: false,
      permissions: [],
      writesPresent: false,
      writes: [],
      refusesPresent: false,
      refuses: [],
      issue: 'declared contract is unavailable or invalid'
    };
  }
}

function authorityState(manifest, contract) {
  const manifestPermissionsPresent = Array.isArray(manifest.permissions);
  const manifestPermissions = cleanStrings(manifest.permissions);
  const manifestUses = cleanStrings(manifest.uses);
  const findings = [];
  if (!manifestPermissionsPresent) findings.push('MANIFEST_PERMISSIONS_MISSING');
  if (contract.state !== 'DECLARED') findings.push('CONTRACT_AUTHORITY_UNKNOWN');
  if (contract.state === 'DECLARED') {
    if (!contract.permissionsPresent) findings.push('CONTRACT_PERMISSIONS_MISSING');
    if (!contract.writesPresent) findings.push('CONTRACT_WRITES_MISSING');
    if (!contract.refusesPresent) findings.push('CONTRACT_REFUSES_MISSING');
    if (contract.id && contract.id !== manifest.id) findings.push('CONTRACT_ID_DRIFT');
  }
  const manifestOnly = contract.state === 'DECLARED' ? difference(manifestPermissions, contract.permissions) : manifestPermissions.slice();
  const contractOnly = contract.state === 'DECLARED' ? difference(contract.permissions, manifestPermissions) : [];
  const contractOutsideUses = contract.state === 'DECLARED' ? difference(contract.permissions, manifestUses) : [];
  if (contract.state === 'DECLARED' && (manifestOnly.length || contractOnly.length)) {
    findings.push('MANIFEST_CONTRACT_PERMISSION_DRIFT');
  }
  if (contract.state === 'DECLARED' && contractOutsideUses.length) {
    findings.push('CONTRACT_PERMISSION_OUTSIDE_MANIFEST_USES');
  }
  let state = 'EXACT_DECLARATION';
  if (contract.state !== 'DECLARED') state = 'CONTRACT_AUTHORITY_UNKNOWN';
  else if (
    !manifestPermissionsPresent ||
    !contract.permissionsPresent ||
    !contract.writesPresent ||
    !contract.refusesPresent
  ) state = 'INCOMPLETE_DECLARATION';
  else if (contractOutsideUses.length) state = 'PERMISSION_OUTSIDE_USES';
  else if (manifestOnly.length || contractOnly.length) state = 'PERMISSION_DRIFT';
  else if (contract.id && contract.id !== manifest.id) state = 'CONTRACT_ID_DRIFT';
  return {
    state,
    findings: Array.from(new Set(findings)).sort(),
    manifestPermissionsPresent,
    manifestPermissions,
    manifestUses,
    manifestOnly,
    contractOnly,
    contractOutsideUses
  };
}

function freshness(map, options = {}) {
  const observedMs = Date.parse(map && map.measuredAt);
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const ttlMs = Number(map && map.freshnessTtlMs);
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs) || !Number.isFinite(ttlMs) || ttlMs < 0) {
    return { status: 'UNTIMED', ageMs: null, ttlMs: Number.isFinite(ttlMs) ? ttlMs : null };
  }
  const ageMs = Math.max(0, nowMs - observedMs);
  return { status: ageMs <= ttlMs ? 'LIVE' : 'STALE', ageMs, ttlMs };
}

function scanWorkshop(root, options = {}) {
  const workshopRoot = path.resolve(root);
  const rootStat = fs.lstatSync(workshopRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('Workshop root must be a regular non-symlink directory');
  const toolsRoot = path.join(workshopRoot, 'tools');
  const toolsStat = fs.lstatSync(toolsRoot);
  if (toolsStat.isSymbolicLink() || !toolsStat.isDirectory()) throw new Error('Workshop tools root is unavailable or symlinked');

  const modules = [];
  const sourceRows = [];
  const skippedSymlinks = [];
  const broken = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    const moduleDir = path.join(toolsRoot, entry.name);
    if (entry.isSymbolicLink()) {
      skippedSymlinks.push(entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(moduleDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    let loaded;
    try {
      loaded = readRegularJson(manifestPath);
    } catch (error) {
      broken.push({ folder: entry.name, issue: 'manifest unavailable or invalid' });
      continue;
    }
    const manifest = loaded.value;
    const contract = readContract(moduleDir, manifest);
    const assessment = authorityState(manifest, contract);
    const id = String(manifest.id || entry.name);
    modules.push({
      schema: MODULE_SCHEMA,
      id,
      folder: entry.name,
      name: String(manifest.name || id),
      version: String(manifest.version || ''),
      status: String(manifest.status || ''),
      riskLabel: manifest.risk === undefined ? null : String(manifest.risk),
      state: assessment.state,
      findings: assessment.findings,
      manifest: {
        permissionsPresent: assessment.manifestPermissionsPresent,
        permissions: assessment.manifestPermissions,
        uses: assessment.manifestUses
      },
      contract: {
        state: contract.state,
        issue: contract.issue,
        permissionsPresent: contract.permissionsPresent,
        permissions: contract.permissions,
        writesPresent: contract.writesPresent,
        writes: contract.writes,
        refusesPresent: contract.refusesPresent,
        refuses: contract.refuses
      },
      deltas: {
        manifestOnlyPermissions: assessment.manifestOnly,
        contractOnlyPermissions: assessment.contractOnly,
        contractPermissionsOutsideManifestUses: assessment.contractOutsideUses
      },
      truth: {
        declarationsAreRuntimeGrants: false,
        writesResolvedOrOpened: false,
        refusalsProveEnforcement: false,
        permissionlessMeansSafe: false,
        riskScoreComputed: false
      }
    });
    sourceRows.push({
      folder: entry.name,
      manifestSha256: loaded.sha256,
      contractSha256: contract.digest
    });
  }
  modules.sort((left, right) => left.id.localeCompare(right.id));

  const permissionNames = new Set();
  for (const module of modules) {
    for (const permission of module.manifest.permissions) permissionNames.add(permission);
    for (const permission of module.contract.permissions) permissionNames.add(permission);
  }
  const permissions = Array.from(permissionNames).sort().map(permission => ({
    schema: PERMISSION_SCHEMA,
    permission,
    manifestDeclarers: modules.filter(module => module.manifest.permissions.includes(permission)).map(module => module.id),
    contractDeclarers: modules.filter(module => module.contract.permissions.includes(permission)).map(module => module.id),
    manifestUsesDeclarers: modules.filter(module => module.manifest.uses.includes(permission)).map(module => module.id),
    truth: {
      declarationIsGrant: false,
      runtimeUseProven: false,
      riskInferred: false
    }
  }));

  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = options.ttlMs === undefined ? DEFAULT_TTL_MS : Number(options.ttlMs);
  if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new Error('ttlMs must be a non-negative number');
  const fingerprintMaterial = {
    sourceRows,
    modules: modules.map(module => ({
      id: module.id,
      state: module.state,
      findings: module.findings,
      manifest: module.manifest,
      contract: module.contract,
      deltas: module.deltas
    })),
    permissions
  };
  const stateCount = state => modules.filter(module => module.state === state).length;
  return {
    schema: MAP_SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(workshopRoot),
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      toolsScope: 'top-level tools/<folder>/manifest.json excluding underscore-prefixed folders',
      symlinksFollowed: false,
      skippedSymlinks,
      broken
    },
    summary: {
      modules: modules.length,
      exactDeclarations: stateCount('EXACT_DECLARATION'),
      contractAuthorityUnknown: stateCount('CONTRACT_AUTHORITY_UNKNOWN'),
      incompleteDeclarations: stateCount('INCOMPLETE_DECLARATION'),
      permissionDrift: stateCount('PERMISSION_DRIFT'),
      permissionOutsideUses: stateCount('PERMISSION_OUTSIDE_USES'),
      contractIdDrift: stateCount('CONTRACT_ID_DRIFT'),
      uniqueDeclaredPermissions: permissions.length,
      modulesWithManifestPermissions: modules.filter(module => module.manifest.permissions.length > 0).length,
      contractsWithDeclaredWrites: modules.filter(module => module.contract.writes.length > 0).length,
      contractsWithDeclaredRefusals: modules.filter(module => module.contract.refuses.length > 0).length
    },
    modules,
    permissions,
    truth: {
      declarationsAreRuntimeGrants: false,
      runtimeEnforcementVerified: false,
      declaredWriteTargetsResolved: false,
      secretValuesRead: false,
      permissionlessMeansSafe: false,
      refusalsProveEnforcement: false,
      riskScoreComputed: false,
      modulesRanked: false,
      grantsCreated: false,
      grantsRevoked: false,
      automaticContractRepairPerformed: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      rollbackChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  MAP_SCHEMA,
  MODULE_SCHEMA,
  PERMISSION_SCHEMA,
  DEFAULT_TTL_MS,
  sha256,
  cleanStrings,
  safeContractPath,
  authorityState,
  scanWorkshop,
  freshness
};
