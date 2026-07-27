'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.browser-global-surface/v1';
const REVIEW_SCHEMA = 'axm.browser-global-review-request/v1';
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

function ownerFor(relativePath, folderToId) {
  const parts = String(relativePath).split('/');
  if (parts[0] === 'tools' && parts.length > 2 && folderToId.has(parts[1])) {
    return folderToId.get(parts[1]);
  }
  return null;
}

function collectSources(graph) {
  const folderToId = new Map((graph.modules || []).map(module => [module.folder, module.id]));
  const byPath = new Map();
  for (const module of graph.modules || []) {
    for (const node of module.nodes || []) {
      if (!node.bodyRead || !['HTML', 'JAVASCRIPT'].includes(node.kind)) continue;
      if (!byPath.has(node.path)) {
        byPath.set(node.path, {
          path: node.path,
          kind: node.kind,
          bytes: node.bytes,
          sha256: node.sha256,
          sourceOwner: ownerFor(node.path, folderToId),
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

function resolveName(raw, constants) {
  const clean = String(raw || '').trim();
  let match = clean.match(/^"([^"\r\n]*)"$/);
  if (match) return { state: 'LITERAL', symbol: match[1] };
  match = clean.match(/^'([^'\r\n]*)'$/);
  if (match) return { state: 'LITERAL', symbol: match[1] };
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(clean) && constants.has(clean)) {
    return { state: 'CONST_RESOLVED', symbol: constants.get(clean), identifier: clean };
  }
  return { state: 'DYNAMIC_NOT_RESOLVED', symbol: null };
}

function extractObservations(text, source) {
  const constants = stringConstants(text);
  const output = [];
  const definitionOffsets = new Set();

  function add(match, operation, surface, symbol, resolution, identifier) {
    const item = {
      operation,
      surface,
      symbol,
      resolution,
      identifier: identifier || null,
      path: source.path,
      line: lineAt(text, match.index),
      sourceOwner: source.sourceOwner,
      consumingModules: source.consumingModules
    };
    output.push(item);
    if (operation === 'DEFINE') definitionOffsets.add(match.index + '|' + surface + '|' + symbol);
  }

  let match;
  const dotDefinition = /\b(window|globalThis)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=|>)/g;
  while ((match = dotDefinition.exec(text))) add(match, 'DEFINE', match[1], match[2], 'DOT_LITERAL');

  const bracketDefinition = /\b(window|globalThis)\s*\[\s*([^\]\r\n]+)\s*\]\s*=(?!=|>)/g;
  while ((match = bracketDefinition.exec(text))) {
    const resolved = resolveName(match[2], constants);
    add(match, 'DEFINE', match[1], resolved.symbol, resolved.state, resolved.identifier);
  }

  const defineProperty = /\bObject\s*\.\s*defineProperty\s*\(\s*(window|globalThis)\s*,\s*([^,\r\n]+)/g;
  while ((match = defineProperty.exec(text))) {
    const resolved = resolveName(match[2], constants);
    add(match, 'DEFINE_PROPERTY', match[1], resolved.symbol, resolved.state, resolved.identifier);
  }

  const deletion = /\bdelete\s+(window|globalThis)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((match = deletion.exec(text))) add(match, 'DELETE', match[1], match[2], 'DOT_LITERAL');

  const dotReference = /\b(window|globalThis)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((match = dotReference.exec(text))) {
    if (definitionOffsets.has(match.index + '|' + match[1] + '|' + match[2])) continue;
    const prefix = text.slice(Math.max(0, match.index - 20), match.index);
    if (/\bdelete\s*$/.test(prefix)) continue;
    const suffix = text.slice(dotReference.lastIndex, dotReference.lastIndex + 24);
    if (/^\s*=(?!=|>)/.test(suffix)) continue;
    add(match, 'REFERENCE', match[1], match[2], 'DOT_LITERAL');
  }

  const bracketReference = /\b(window|globalThis)\s*\[\s*([^\]\r\n]+)\s*\]/g;
  while ((match = bracketReference.exec(text))) {
    const suffix = text.slice(bracketReference.lastIndex, bracketReference.lastIndex + 24);
    if (/^\s*=(?!=|>)/.test(suffix)) continue;
    const resolved = resolveName(match[2], constants);
    add(match, 'REFERENCE', match[1], resolved.symbol, resolved.state, resolved.identifier);
  }

  const unique = new Map();
  for (const item of output) {
    const key = [item.operation, item.surface, item.symbol, item.resolution, item.path, item.line].join('|');
    unique.set(key, item);
  }
  return Array.from(unique.values()).sort((left, right) => (
    left.path.localeCompare(right.path)
    || left.line - right.line
    || left.operation.localeCompare(right.operation)
    || String(left.symbol).localeCompare(String(right.symbol))
  ));
}

function ownershipScope(item) {
  return item.sourceOwner || 'SHARED_SOURCE:' + item.path;
}

function buildGroups(observations) {
  const bySymbol = new Map();
  for (const item of observations) {
    if (!item.symbol || !['DEFINE', 'DEFINE_PROPERTY'].includes(item.operation)) continue;
    if (!bySymbol.has(item.symbol)) bySymbol.set(item.symbol, []);
    bySymbol.get(item.symbol).push(item);
  }
  const output = [];
  for (const [symbol, definitions] of bySymbol) {
    const scopes = Array.from(new Set(definitions.map(ownershipScope))).sort();
    if (scopes.length < 2) continue;
    const references = observations.filter(item => item.symbol === symbol && item.operation === 'REFERENCE');
    output.push({
      id: sha256(Buffer.from(symbol)).slice(0, 20),
      symbol,
      state: 'MULTI_OWNER_GLOBAL_DEFINITION_REVIEW',
      ownershipScopes: scopes,
      definitions: definitions.map(item => ({
        surface: item.surface,
        path: item.path,
        line: item.line,
        sourceOwner: item.sourceOwner,
        consumingModules: item.consumingModules
      })),
      references: references.map(item => ({
        surface: item.surface,
        path: item.path,
        line: item.line,
        sourceOwner: item.sourceOwner,
        consumingModules: item.consumingModules
      }))
    });
  }
  return output.sort((left, right) => left.symbol.localeCompare(right.symbol));
}

function analyzeWorkshop(rootInput, graph, options = {}) {
  if (!graph || graph.schema !== GRAPH_SCHEMA) {
    throw new Error('browser global analysis requires an ' + GRAPH_SCHEMA + ' graph');
  }
  const root = path.resolve(rootInput || process.cwd());
  const sources = collectSources(graph);
  const sourceReceipts = [];
  const readIssues = [];
  const observations = [];
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
    observations.push(...extractObservations(loaded.text, source));
  }
  const groups = buildGroups(observations);
  const measuredAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    graphFingerprint: graph.source && graph.source.fingerprint,
    sourceReceipts,
    observations,
    groups,
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
      observations: observations.length,
      definitions: observations.filter(item => ['DEFINE', 'DEFINE_PROPERTY'].includes(item.operation)).length,
      references: observations.filter(item => item.operation === 'REFERENCE').length,
      deletions: observations.filter(item => item.operation === 'DELETE').length,
      dynamicNotResolved: observations.filter(item => item.resolution === 'DYNAMIC_NOT_RESOLVED').length,
      multiOwnerDefinitionGroups: groups.length,
      readIssues: readIssues.length
    },
    observations,
    definitionGroups: groups,
    sourceReceipts,
    readIssues,
    scopeBoundary: 'Only exact textual window and globalThis dot access, bracket access, assignment, deletion, and Object.defineProperty patterns are observed in graph-bounded HTML and JavaScript whose current hash matches the graph. This is not a JavaScript parser or browser execution trace. A repeated definition is a review seam, not proof of collision or harm.',
    preservedOwners: {
      runtimeGlobals: 'declaring modules and browser runtime',
      runtimeCollision: 'Browser, LAN and Hardware QA Lab',
      permissions: 'Authority Surface and permission owners',
      sourceScope: 'Entry Resource Closure Observatory',
      readiness: 'Technical Glasses'
    },
    truth: {
      sourceTextPatternRead: true,
      javascriptParsedCompletely: false,
      browserLoaded: false,
      scriptsExecuted: false,
      browserGlobalsReadAtRuntime: false,
      browserGlobalsMutated: false,
      symbolOwnershipProven: false,
      collisionHarmProven: false,
      permissionGranted: false,
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
  const group = map.definitionGroups.find(item => item.id === groupId);
  if (!group) throw new Error('definition group is not present: ' + groupId);
  const questions = [
    'CONFIRM_GLOBAL_SYMBOL_IS_INTENTIONALLY_SHARED_OR_ACCIDENTAL',
    'IDENTIFY_RUNTIME_OWNER_AND_LOAD_ORDER_EXPECTATION',
    'CHECK_VALUE_SHAPE_AND_REPLACEMENT_COMPATIBILITY_IN_BROWSER_QA',
    'RECORD_KEEP_ADAPT_NAMESPACE_OR_REMOVE_DECISION'
  ].map(id => ({ id, state: 'REQUEST_NOT_RUN', answer: null, evidence: null }));
  const generatedAt = options.now || new Date().toISOString();
  const material = { schema: REVIEW_SCHEMA, mapFingerprint: map.source.fingerprint, group, questions };
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
    summary: { groupsSelected: 1, questionsRequested: questions.length, questionsAnswered: 0 },
    scopeBoundary: 'This packet asks existing owners to explain one exact browser-global definition seam. It executes no JavaScript, reads or writes no live global, grants no permission, and makes no rename or load-order decision.',
    truth: {
      requestOnly: true,
      browserLoaded: false,
      scriptsExecuted: false,
      globalReadAtRuntime: false,
      globalMutated: false,
      sourceChanged: false,
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
  resolveName,
  extractObservations,
  buildGroups,
  analyzeWorkshop,
  createReviewRequest
};
