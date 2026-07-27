'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAP_SCHEMA = 'axm.schema-identity-map/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_JSON_FILES = 20000;
const MAX_JSON_BYTES = 128 * 1024 * 1024;
const MAX_SINGLE_JSON_BYTES = 8 * 1024 * 1024;
const EXCLUDED_DIRECTORIES = new Set([
  '.cache',
  '.git',
  'backups',
  'coverage',
  'exports',
  'local-data',
  'logs',
  'node_modules',
  'state'
]);

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

function pointerToken(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function cleanIdentity(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function protocolShape(identity) {
  const future = identity.startsWith('future:');
  const body = future ? identity.slice('future:'.length) : identity;
  const match = body.match(/^(.*)\/(v[0-9][A-Za-z0-9._-]*)$/);
  return {
    future,
    convention: match ? 'AXM_SLASH_VERSION' : 'UNPARSED_VERSION_CONVENTION',
    family: match ? match[1] : null,
    version: match ? match[2] : null
  };
}

function visitJson(value, location, fileRecord, definitions, references) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitJson(
      item,
      location + '/' + index,
      fileRecord,
      definitions,
      references
    ));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const identity = cleanIdentity(value.$id);
  if (identity) {
    definitions.push({
      identity,
      path: fileRecord.path,
      pointer: location || '/',
      fileSha256: fileRecord.sha256,
      definitionSha256: sha256(Buffer.from(stableJson(value))),
      protocol: protocolShape(identity)
    });
  }

  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if ((key === 'schema' || key === 'schema_version') && cleanIdentity(child)) {
      const referencedIdentity = cleanIdentity(child);
      references.push({
        identity: referencedIdentity,
        field: key,
        path: fileRecord.path,
        pointer: (location || '') + '/' + pointerToken(key),
        fileSha256: fileRecord.sha256,
        protocol: protocolShape(referencedIdentity)
      });
    }
    visitJson(
      child,
      (location || '') + '/' + pointerToken(key),
      fileRecord,
      definitions,
      references
    );
  }
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('root must be a regular non-symlink directory');
  }

  const files = [];
  const parseFailures = [];
  const formatNotes = [];
  const skippedSymlinks = [];
  const definitions = [];
  const references = [];
  let totalBytes = 0;

  function walk(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        skippedSymlinks.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) walk(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
      if (files.length >= MAX_JSON_FILES) throw new Error('JSON file safety limit exceeded');
      const stat = fs.lstatSync(absolute);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        skippedSymlinks.push(relative);
        continue;
      }
      if (stat.size > MAX_SINGLE_JSON_BYTES) {
        parseFailures.push({ path: relative, code: 'JSON_FILE_SIZE_LIMIT', bytes: stat.size });
        continue;
      }
      totalBytes += stat.size;
      if (totalBytes > MAX_JSON_BYTES) throw new Error('JSON byte safety limit exceeded');
      const bytes = fs.readFileSync(absolute);
      const fileRecord = { path: relative, bytes: bytes.length, sha256: sha256(bytes) };
      files.push(fileRecord);
      try {
        const rawText = bytes.toString('utf8');
        const hasUtf8Bom = rawText.charCodeAt(0) === 0xfeff;
        if (hasUtf8Bom) formatNotes.push({ path: relative, code: 'UTF8_BOM_PRESENT' });
        visitJson(JSON.parse(hasUtf8Bom ? rawText.slice(1) : rawText), '', fileRecord, definitions, references);
      } catch (error) {
        parseFailures.push({
          path: relative,
          code: 'INVALID_JSON',
          message: String(error && error.message || error).slice(0, 240)
        });
      }
    }
  }

  walk(root);

  const definitionsByIdentity = new Map();
  for (const definition of definitions) {
    if (!definitionsByIdentity.has(definition.identity)) definitionsByIdentity.set(definition.identity, []);
    definitionsByIdentity.get(definition.identity).push(definition);
  }
  const definitionGroups = Array.from(definitionsByIdentity.entries()).map(([identity, occurrences]) => {
    const digests = Array.from(new Set(occurrences.map(item => item.definitionSha256))).sort();
    return {
      identity,
      state: digests.length > 1
        ? 'DIVERGENT_SAME_ID_DEFINITIONS'
        : occurrences.length > 1
          ? 'REPEATED_IDENTICAL_DEFINITION'
          : 'UNIQUE_DEFINITION',
      definitionDigests: digests,
      occurrences: occurrences.sort((left, right) =>
        left.path.localeCompare(right.path) || left.pointer.localeCompare(right.pointer)
      ),
      truth: {
        semanticEquivalenceProven: false,
        compatibilityProven: false,
        collisionAutomaticallyResolved: false
      }
    };
  }).sort((left, right) => left.identity.localeCompare(right.identity));

  const referencesByIdentity = new Map();
  for (const reference of references) {
    if (!referencesByIdentity.has(reference.identity)) referencesByIdentity.set(reference.identity, []);
    referencesByIdentity.get(reference.identity).push(reference);
  }
  const referenceGroups = Array.from(referencesByIdentity.entries()).map(([identity, occurrences]) => ({
    identity,
    state: definitionsByIdentity.has(identity)
      ? 'LOCAL_DEFINITION_OBSERVED'
      : 'NO_LOCAL_DEFINITION_OBSERVED',
    occurrences: occurrences.sort((left, right) =>
      left.path.localeCompare(right.path) || left.pointer.localeCompare(right.pointer)
    ),
    truth: {
      definitionRequiredInThisWorkshop: false,
      externalRegistryChecked: false,
      referenceValidityProven: false
    }
  })).sort((left, right) => left.identity.localeCompare(right.identity));

  const measuredAt = options.now || new Date().toISOString();
  const sourceMaterial = {
    files,
    skippedSymlinks: skippedSymlinks.sort(),
    definitionGroups,
    referenceGroups,
    parseFailures: parseFailures.sort((left, right) => left.path.localeCompare(right.path)),
    formatNotes: formatNotes.sort((left, right) => left.path.localeCompare(right.path))
  };
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
    ? Math.floor(options.ttlMs)
    : DEFAULT_TTL_MS;

  return {
    schema: MAP_SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(root),
      fingerprint: sha256(Buffer.from(stableJson(sourceMaterial))),
      jsonFilesRead: files.length,
      jsonBytesRead: totalBytes,
      exclusions: Array.from(EXCLUDED_DIRECTORIES).sort(),
      symlinksFollowed: false,
      skippedSymlinks: skippedSymlinks.sort()
    },
    summary: {
      definitionOccurrences: definitions.length,
      uniqueDefinitionIds: definitionGroups.length,
      uniqueDefinitions: definitionGroups.filter(group => group.state === 'UNIQUE_DEFINITION').length,
      repeatedIdenticalDefinitions: definitionGroups.filter(group => group.state === 'REPEATED_IDENTICAL_DEFINITION').length,
      divergentSameIdDefinitions: definitionGroups.filter(group => group.state === 'DIVERGENT_SAME_ID_DEFINITIONS').length,
      referenceOccurrences: references.length,
      uniqueReferenceIds: referenceGroups.length,
      referencesWithLocalDefinition: referenceGroups.filter(group => group.state === 'LOCAL_DEFINITION_OBSERVED').length,
      referencesWithoutLocalDefinition: referenceGroups.filter(group => group.state === 'NO_LOCAL_DEFINITION_OBSERVED').length,
      parseFailures: parseFailures.length,
      formatNotes: formatNotes.length
    },
    definitionGroups,
    referenceGroups,
    parseFailures: sourceMaterial.parseFailures,
    formatNotes: sourceMaterial.formatNotes,
    scopeBoundary: 'Exact local JSON identity observation only. Reuse is not compatibility; absence of a local definition is not invalidity; divergent definitions are held for human review.',
    truth: {
      jsonSchemaValidationPerformed: false,
      externalRegistryChecked: false,
      semanticCompatibilityInferred: false,
      schemasRegistered: false,
      adaptersGenerated: false,
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
  MAP_SCHEMA,
  DEFAULT_TTL_MS,
  EXCLUDED_DIRECTORIES,
  sha256,
  stableJson,
  protocolShape,
  scanWorkshop,
  freshness
};
