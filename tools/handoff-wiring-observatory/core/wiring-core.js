'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAP_SCHEMA = 'axm.handoff-wiring-map/v1';
const ARTIFACT_SCHEMA = 'axm.handoff-artifact-record/v1';
const MODULE_SCHEMA = 'axm.handoff-module-envelope/v1';
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

function arrayDifference(left, right) {
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

function effectiveArray(manifest, metadata, field) {
  if (Array.isArray(manifest[field])) {
    return { values: cleanStrings(manifest[field]), source: 'manifest' };
  }
  if (metadata && Array.isArray(metadata[field])) {
    return { values: cleanStrings(metadata[field]), source: 'capability-metadata-fallback' };
  }
  return { values: [], source: 'missing' };
}

function contractEnvelope(moduleDir, manifest) {
  if (!manifest.contract) return {
    state: 'NOT_DECLARED',
    accepts: [],
    emits: [],
    digest: null,
    issue: 'module contract not declared'
  };
  const target = safeContractPath(moduleDir, manifest.contract);
  if (!target) return {
    state: 'UNSAFE_PATH',
    accepts: [],
    emits: [],
    digest: null,
    issue: 'declared contract path is unsafe'
  };
  try {
    const loaded = readRegularJson(target);
    const contract = loaded.value;
    if (!contract.handoffs || typeof contract.handoffs !== 'object') {
      return {
        state: 'INVALID_HANDOFFS',
        accepts: [],
        emits: [],
        digest: loaded.sha256,
        issue: 'contract handoffs object is missing'
      };
    }
    return {
      state: 'DECLARED',
      accepts: cleanStrings(contract.handoffs.accepts),
      emits: cleanStrings(contract.handoffs.emits),
      digest: loaded.sha256,
      issue: null
    };
  } catch (error) {
    return {
      state: 'UNAVAILABLE',
      accepts: [],
      emits: [],
      digest: null,
      issue: 'declared contract is unavailable or invalid'
    };
  }
}

function envelopeRelation(effective, contract, source) {
  if (contract.state !== 'DECLARED') {
    return {
      state: 'CONTRACT_UNKNOWN',
      effectiveOnly: effective.slice(),
      contractOnly: [],
      source
    };
  }
  const effectiveOnly = arrayDifference(effective, contract.values);
  const contractOnly = arrayDifference(contract.values, effective);
  let state = 'EXACT';
  if (source !== 'manifest') state = 'FALLBACK_COMPARED';
  if (effectiveOnly.length || contractOnly.length) state = source === 'manifest' ? 'DRIFT' : 'FALLBACK_DRIFT';
  return { state, effectiveOnly, contractOnly, source };
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

  let metadata = { modules: {} };
  let metadataDigest = null;
  let metadataState = 'MISSING';
  const metadataFile = path.join(workshopRoot, 'shared', 'capabilities', 'capability-metadata.json');
  if (fs.existsSync(metadataFile)) {
    try {
      const loaded = readRegularJson(metadataFile);
      metadata = loaded.value;
      metadataDigest = loaded.sha256;
      metadataState = 'LOADED';
    } catch (error) {
      metadataState = 'INVALID';
    }
  }

  const modules = [];
  const skippedSymlinks = [];
  const broken = [];
  const sourceRows = [];
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
    const id = String(manifest.id || entry.name);
    const authored = metadata && metadata.modules && metadata.modules[id] || null;
    const accepts = effectiveArray(manifest, authored, 'accepts');
    const produces = effectiveArray(manifest, authored, 'produces');
    const contract = contractEnvelope(moduleDir, manifest);
    const acceptsRelation = envelopeRelation(accepts.values, {
      state: contract.state,
      values: contract.accepts
    }, accepts.source);
    const emitsRelation = envelopeRelation(produces.values, {
      state: contract.state,
      values: contract.emits
    }, produces.source);
    modules.push({
      schema: MODULE_SCHEMA,
      id,
      folder: entry.name,
      name: String(manifest.name || id),
      version: String(manifest.version || ''),
      status: String(manifest.status || ''),
      accepts: accepts.values,
      produces: produces.values,
      sources: {
        accepts: accepts.source,
        produces: produces.source
      },
      contract: {
        state: contract.state,
        issue: contract.issue,
        accepts: contract.accepts,
        emits: contract.emits
      },
      reconciliation: {
        accepts: acceptsRelation,
        emits: emitsRelation
      }
    });
    sourceRows.push({
      folder: entry.name,
      manifestSha256: loaded.sha256,
      contractSha256: contract.digest
    });
  }
  modules.sort((left, right) => left.id.localeCompare(right.id));

  const providers = new Map();
  const consumers = new Map();
  for (const module of modules) {
    for (const artifact of module.produces) {
      if (!providers.has(artifact)) providers.set(artifact, []);
      providers.get(artifact).push(module.id);
    }
    for (const artifact of module.accepts) {
      if (!consumers.has(artifact)) consumers.set(artifact, []);
      consumers.get(artifact).push(module.id);
    }
  }
  const artifacts = Array.from(new Set([...providers.keys(), ...consumers.keys()]))
    .sort((left, right) => left.localeCompare(right))
    .map(artifact => {
      const artifactProviders = (providers.get(artifact) || []).sort();
      const artifactConsumers = (consumers.get(artifact) || []).sort();
      let state = 'EXACTLY_WIRED';
      if (!artifactProviders.length) state = 'CONSUMER_ONLY';
      else if (!artifactConsumers.length) state = 'PRODUCER_ONLY';
      else if (
        artifactProviders.length === 1 &&
        artifactConsumers.length === 1 &&
        artifactProviders[0] === artifactConsumers[0]
      ) state = 'SELF_LOOP_ONLY';
      return {
        schema: ARTIFACT_SCHEMA,
        artifact,
        state,
        providers: artifactProviders,
        consumers: artifactConsumers,
        distinctModules: Array.from(new Set([...artifactProviders, ...artifactConsumers])).sort(),
        multiProvider: artifactProviders.length > 1,
        multiConsumer: artifactConsumers.length > 1,
        truth: {
          exactStringMatchOnly: true,
          wildcardCompatibilityInferred: false,
          semanticCompatibilityInferred: false,
          multiProviderCalledCollision: false,
          runtimeReadinessInferred: false
        }
      };
    });

  const relations = [];
  for (const artifact of artifacts) {
    if (artifact.state === 'PRODUCER_ONLY' || artifact.state === 'CONSUMER_ONLY') continue;
    for (const provider of artifact.providers) {
      for (const consumer of artifact.consumers) {
        relations.push({
          artifact: artifact.artifact,
          provider,
          consumer,
          self: provider === consumer
        });
      }
    }
  }
  relations.sort((left, right) =>
    left.artifact.localeCompare(right.artifact) ||
    left.provider.localeCompare(right.provider) ||
    left.consumer.localeCompare(right.consumer));

  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = options.ttlMs === undefined ? DEFAULT_TTL_MS : Number(options.ttlMs);
  if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new Error('ttlMs must be a non-negative number');
  const fingerprintMaterial = {
    sourceRows,
    metadataDigest,
    modules: modules.map(module => ({
      id: module.id,
      accepts: module.accepts,
      produces: module.produces,
      contract: module.contract,
      reconciliation: module.reconciliation
    })),
    artifacts,
    relations
  };
  const stateCount = state => artifacts.filter(item => item.state === state).length;
  const fallbackModules = modules.filter(module =>
    module.sources.accepts === 'capability-metadata-fallback' ||
    module.sources.produces === 'capability-metadata-fallback');
  const driftModules = modules.filter(module =>
    module.reconciliation.accepts.state.endsWith('DRIFT') ||
    module.reconciliation.emits.state.endsWith('DRIFT'));
  return {
    schema: MAP_SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(workshopRoot),
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      toolsScope: 'top-level tools/<folder>/manifest.json excluding underscore-prefixed folders',
      capabilityMetadataState: metadataState,
      capabilityMetadataSha256: metadataDigest,
      symlinksFollowed: false,
      skippedSymlinks,
      broken
    },
    summary: {
      modules: modules.length,
      artifacts: artifacts.length,
      exactlyWiredArtifacts: stateCount('EXACTLY_WIRED'),
      producerOnlyArtifacts: stateCount('PRODUCER_ONLY'),
      consumerOnlyArtifacts: stateCount('CONSUMER_ONLY'),
      selfLoopOnlyArtifacts: stateCount('SELF_LOOP_ONLY'),
      exactModuleRelations: relations.length,
      modulesUsingMetadataFallback: fallbackModules.length,
      modulesWithManifestContractDrift: driftModules.length,
      contractsDeclared: modules.filter(module => module.contract.state === 'DECLARED').length,
      contractsUnknown: modules.filter(module => module.contract.state !== 'DECLARED').length
    },
    modules,
    artifacts,
    relations,
    truth: {
      exactArtifactStringsOnly: true,
      schemaNamesNormalized: false,
      wildcardCompatibilityInferred: false,
      semanticCompatibilityInferred: false,
      automaticAdaptersGenerated: false,
      automaticRewirePerformed: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      permissionChanged: false,
      rollbackChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  MAP_SCHEMA,
  ARTIFACT_SCHEMA,
  MODULE_SCHEMA,
  DEFAULT_TTL_MS,
  sha256,
  cleanStrings,
  safeContractPath,
  scanWorkshop,
  freshness
};
