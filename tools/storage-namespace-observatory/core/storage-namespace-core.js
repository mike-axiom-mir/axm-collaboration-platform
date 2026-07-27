'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.storage-namespace-map/v1';
const REVIEW_SCHEMA = 'axm.storage-namespace-review-request/v1';
const GRAPH_SCHEMA = 'axm.entry-resource-graph/v1';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
    return output;
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function sourceOwner(relativePath, folderToId) {
  const parts = String(relativePath).split('/');
  if (parts[0] === 'tools' && parts.length > 2 && folderToId.has(parts[1])) {
    return folderToId.get(parts[1]);
  }
  return null;
}

function collectSources(graph) {
  const folderToId = new Map(graph.modules.map(module => [module.folder, module.id]));
  const byPath = new Map();
  for (const module of graph.modules) {
    for (const node of module.nodes || []) {
      if (!node.bodyRead || !['HTML', 'JAVASCRIPT'].includes(node.kind)) continue;
      if (!byPath.has(node.path)) {
        byPath.set(node.path, {
          path: node.path,
          kind: node.kind,
          sha256: node.sha256,
          bytes: node.bytes,
          sourceOwner: sourceOwner(node.path, folderToId),
          consumingModules: []
        });
      }
      byPath.get(node.path).consumingModules.push(module.id);
    }
  }
  return Array.from(byPath.values()).map(source => Object.assign(source, {
    consumingModules: Array.from(new Set(source.consumingModules)).sort()
  })).sort((left, right) => left.path.localeCompare(right.path));
}

function readGraphSource(root, source) {
  const absolute = path.resolve(root, source.path);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolute.startsWith(prefix)) return { state: 'UNSAFE_GRAPH_PATH', text: null };
  if (!fs.existsSync(absolute)) return { state: 'SOURCE_MISSING_AFTER_GRAPH', text: null };
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) return { state: 'SOURCE_TYPE_DRIFT', text: null };
  const bytes = fs.readFileSync(absolute);
  const digest = sha256(bytes);
  if (digest !== source.sha256) {
    return { state: 'SOURCE_HASH_DRIFT', text: null, observedSha256: digest, bytes: bytes.length };
  }
  return { state: 'VERIFIED_GRAPH_SOURCE', text: bytes.toString('utf8'), bytes: bytes.length };
}

function stringConstants(text) {
  const constants = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)')/g;
  let match;
  while ((match = pattern.exec(text))) {
    constants.set(match[1], match[2] === undefined ? match[3] : match[2]);
  }
  return constants;
}

function resolveArgument(raw, constants) {
  const clean = String(raw || '').trim();
  let match = clean.match(/^"([^"\r\n]*)"$/);
  if (match) return { state: 'LITERAL', namespace: match[1] };
  match = clean.match(/^'([^'\r\n]*)'$/);
  if (match) return { state: 'LITERAL', namespace: match[1] };
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(clean) && constants.has(clean)) {
    return { state: 'CONST_RESOLVED', namespace: constants.get(clean), identifier: clean };
  }
  return { state: 'DYNAMIC_NOT_RESOLVED', namespace: null };
}

function extractOccurrences(text, source) {
  const constants = stringConstants(text);
  const output = [];
  function add(match, storageKind, operation, rawArgument) {
    const resolved = resolveArgument(rawArgument, constants);
    output.push({
      storageKind,
      operation,
      namespace: resolved.namespace,
      resolution: resolved.state,
      identifier: resolved.identifier || null,
      path: source.path,
      line: lineAt(text, match.index),
      sourceOwner: source.sourceOwner,
      consumingModules: source.consumingModules
    });
  }

  const keyCall = /\b(localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*([^,\)\r\n]+)/g;
  let match;
  while ((match = keyCall.exec(text))) add(match, match[1].toUpperCase(), match[2].toUpperCase(), match[3]);

  const clearCall = /\b(localStorage|sessionStorage)\s*\.\s*clear\s*\(/g;
  while ((match = clearCall.exec(text))) {
    output.push({
      storageKind: match[1].toUpperCase(),
      operation: 'CLEAR_ALL',
      namespace: null,
      resolution: 'WHOLE_STORE_OPERATION',
      identifier: null,
      path: source.path,
      line: lineAt(text, match.index),
      sourceOwner: source.sourceOwner,
      consumingModules: source.consumingModules
    });
  }

  const indexedDb = /\bindexedDB\s*\.\s*open\s*\(\s*([^,\)\r\n]+)/g;
  while ((match = indexedDb.exec(text))) add(match, 'INDEXED_DB', 'OPEN', match[1]);

  const cacheStorage = /\bcaches\s*\.\s*open\s*\(\s*([^,\)\r\n]+)/g;
  while ((match = cacheStorage.exec(text))) add(match, 'CACHE_STORAGE', 'OPEN', match[1]);

  const property = /\b(localStorage|sessionStorage)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const methods = new Set(['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length']);
  while ((match = property.exec(text))) {
    if (methods.has(match[2])) continue;
    output.push({
      storageKind: match[1].toUpperCase(),
      operation: 'PROPERTY_ACCESS',
      namespace: match[2],
      resolution: 'PROPERTY_LITERAL',
      identifier: null,
      path: source.path,
      line: lineAt(text, match.index),
      sourceOwner: source.sourceOwner,
      consumingModules: source.consumingModules
    });
  }
  const unique = new Map();
  for (const occurrence of output) {
    const key = [
      occurrence.storageKind, occurrence.operation, occurrence.namespace,
      occurrence.resolution, occurrence.path, occurrence.line
    ].join('|');
    unique.set(key, occurrence);
  }
  return Array.from(unique.values()).sort((left, right) => (
    left.path.localeCompare(right.path)
    || left.line - right.line
    || left.storageKind.localeCompare(right.storageKind)
    || left.operation.localeCompare(right.operation)
  ));
}

function ownershipScope(occurrence) {
  return occurrence.sourceOwner || 'SHARED_SOURCE:' + occurrence.path;
}

function collisionGroups(occurrences) {
  const groups = new Map();
  for (const occurrence of occurrences) {
    if (!occurrence.namespace) continue;
    const key = occurrence.storageKind + ':' + occurrence.namespace;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(occurrence);
  }
  const output = [];
  for (const [key, items] of groups) {
    const scopes = Array.from(new Set(items.map(ownershipScope))).sort();
    if (scopes.length < 2) continue;
    const separator = key.indexOf(':');
    const storageKind = key.slice(0, separator);
    const namespace = key.slice(separator + 1);
    output.push({
      id: sha256(Buffer.from(key)).slice(0, 20),
      storageKind,
      namespace,
      state: 'SHARED_EXACT_NAMESPACE_REVIEW',
      ownershipScopes: scopes,
      occurrences: items.map(item => ({
        path: item.path,
        line: item.line,
        operation: item.operation,
        sourceOwner: item.sourceOwner,
        consumingModules: item.consumingModules
      }))
    });
  }
  return output.sort((left, right) => (
    left.storageKind.localeCompare(right.storageKind)
    || left.namespace.localeCompare(right.namespace)
  ));
}

function analyzeWorkshop(rootInput, graph, options = {}) {
  if (!graph || graph.schema !== GRAPH_SCHEMA) {
    throw new Error('storage namespace analysis requires an ' + GRAPH_SCHEMA + ' graph');
  }
  const root = path.resolve(rootInput || process.cwd());
  const sources = collectSources(graph);
  const sourceReceipts = [];
  const occurrences = [];
  const readIssues = [];
  for (const source of sources) {
    const loaded = readGraphSource(root, source);
    sourceReceipts.push({
      path: source.path,
      graphSha256: source.sha256,
      state: loaded.state,
      observedSha256: loaded.observedSha256 || source.sha256,
      bytes: loaded.bytes === undefined ? source.bytes : loaded.bytes
    });
    if (!loaded.text) {
      readIssues.push({ path: source.path, code: loaded.state });
      continue;
    }
    occurrences.push(...extractOccurrences(loaded.text, source));
  }
  const collisions = collisionGroups(occurrences);
  const measuredAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    graphFingerprint: graph.source && graph.source.fingerprint,
    sourceReceipts,
    occurrences,
    collisions,
    readIssues
  };
  return {
    schema: SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: graph.freshnessTtlMs,
    source: {
      label: graph.source && graph.source.label,
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      graphSchema: graph.schema,
      graphFingerprint: graph.source && graph.source.fingerprint,
      uniqueTextSources: sources.length,
      sourceBodiesReadAfterHashMatch: sourceReceipts.filter(item => item.state === 'VERIFIED_GRAPH_SOURCE').length,
      symlinksFollowed: false
    },
    summary: {
      modulesInGraph: graph.summary && graph.summary.modules,
      uniqueTextSources: sources.length,
      verifiedSources: sourceReceipts.filter(item => item.state === 'VERIFIED_GRAPH_SOURCE').length,
      occurrences: occurrences.length,
      literalOrResolved: occurrences.filter(item => item.namespace !== null).length,
      dynamicNotResolved: occurrences.filter(item => item.resolution === 'DYNAMIC_NOT_RESOLVED').length,
      wholeStoreOperations: occurrences.filter(item => item.resolution === 'WHOLE_STORE_OPERATION').length,
      localStorageOccurrences: occurrences.filter(item => item.storageKind === 'LOCALSTORAGE').length,
      sessionStorageOccurrences: occurrences.filter(item => item.storageKind === 'SESSIONSTORAGE').length,
      indexedDbOccurrences: occurrences.filter(item => item.storageKind === 'INDEXED_DB').length,
      cacheStorageOccurrences: occurrences.filter(item => item.storageKind === 'CACHE_STORAGE').length,
      exactCollisionGroups: collisions.length,
      readIssues: readIssues.length
    },
    occurrences,
    collisionGroups: collisions,
    sourceReceipts,
    readIssues,
    scopeBoundary: 'Only exact textual patterns for localStorage, sessionStorage, indexedDB.open, and caches.open are observed in graph-bounded HTML and JavaScript sources whose current hash still matches the graph. Literal strings and same-file string constants are resolved. Stored values and live browser storage are never read or changed. A repeated namespace is review evidence, not proof of an unsafe collision.',
    preservedOwners: {
      runtimeStorage: 'declaring module and Workshop storage services',
      permissions: 'Authority Surface and permission owners',
      browserBehavior: 'Browser, LAN and Hardware QA Lab',
      sourceScope: 'Entry Resource Closure Observatory',
      readiness: 'Technical Glasses'
    },
    truth: {
      sourceTextPatternRead: true,
      liveStorageRead: false,
      liveStorageWritten: false,
      storedValuesRead: false,
      namespaceOwnershipProven: false,
      collisionHarmProven: false,
      browserLoaded: false,
      scriptsExecuted: false,
      permissionGranted: false,
      readinessProven: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

function createReviewRequest(map, groupIdInput, options = {}) {
  if (!map || map.schema !== SCHEMA) throw new Error('review request requires an ' + SCHEMA + ' map');
  const groupId = typeof groupIdInput === 'string' ? groupIdInput.trim() : '';
  const group = map.collisionGroups.find(item => item.id === groupId);
  if (!group) throw new Error('exact collision group is not present: ' + groupId);
  const questions = [
    'CONFIRM_NAMESPACE_IS_INTENTIONALLY_SHARED_OR_ACCIDENTAL',
    'IDENTIFY_RUNTIME_OWNER_FOR_EACH_SCOPE',
    'CHECK_VALUE_SHAPE_AND_LIFECYCLE_COMPATIBILITY_SEPARATELY',
    'RECORD_KEEP_ADAPT_OR_RENAME_DECISION_WITH_MIGRATION_BOUNDARY'
  ].map(id => ({ id, state: 'REQUEST_NOT_RUN', answer: null, evidence: null }));
  const generatedAt = options.now || new Date().toISOString();
  const material = {
    schema: REVIEW_SCHEMA,
    mapFingerprint: map.source.fingerprint,
    group,
    questions
  };
  return {
    schema: REVIEW_SCHEMA,
    version: 'v0.1',
    generatedAt,
    fingerprint: sha256(Buffer.from(stableJson(material))),
    sourceObservation: {
      schema: map.schema,
      measuredAt: map.measuredAt,
      freshnessTtlMs: map.freshnessTtlMs,
      fingerprint: map.source.fingerprint
    },
    selectedGroup: group,
    questions,
    summary: {
      groupsSelected: 1,
      questionsRequested: questions.length,
      questionsAnswered: 0
    },
    scopeBoundary: 'This packet asks existing storage and module owners to explain one exact repeated namespace. It contains no stored value, migration, rename command, browser action, grant, or execution authority.',
    truth: {
      requestOnly: true,
      liveStorageRead: false,
      storedValuesIncluded: false,
      migrationPerformed: false,
      namespaceRenamed: false,
      browserLoaded: false,
      permissionChanged: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  SCHEMA,
  REVIEW_SCHEMA,
  GRAPH_SCHEMA,
  collectSources,
  readGraphSource,
  stringConstants,
  resolveArgument,
  extractOccurrences,
  collisionGroups,
  analyzeWorkshop,
  createReviewRequest
};
