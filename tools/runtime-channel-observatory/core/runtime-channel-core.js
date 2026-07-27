'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.runtime-channel-map/v1';
const REVIEW_SCHEMA = 'axm.runtime-channel-review-request/v1';
const GRAPH_SCHEMA = 'axm.entry-resource-graph/v1';
const ENVIRONMENT_EVENTS = new Set(['message', 'storage', 'online', 'offline', 'hashchange', 'popstate']);

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

function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
  return line;
}

function ownerFor(relativePath, folders) {
  const parts = String(relativePath).split('/');
  return parts[0] === 'tools' && parts.length > 2 && folders.has(parts[1]) ? folders.get(parts[1]) : null;
}

function collectSources(graph) {
  const folders = new Map((graph.modules || []).map(module => [module.folder, module.id]));
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
          sourceOwner: ownerFor(node.path, folders),
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
  const observedSha256 = sha256(bytes);
  if (observedSha256 !== source.sha256) return { state: 'SOURCE_HASH_DRIFT', text: null, observedSha256, bytes: bytes.length };
  return { state: 'VERIFIED_GRAPH_SOURCE', text: bytes.toString('utf8'), bytes: bytes.length };
}

function stringConstants(text) {
  const constants = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)')/g;
  let match;
  while ((match = pattern.exec(text))) constants.set(match[1], match[2] === undefined ? match[3] : match[2]);
  return constants;
}

function resolveArgument(raw, constants) {
  const clean = String(raw || '').trim();
  let match = clean.match(/^"([^"\r\n]*)"$/);
  if (match) return { state: 'LITERAL', name: match[1] };
  match = clean.match(/^'([^'\r\n]*)'$/);
  if (match) return { state: 'LITERAL', name: match[1] };
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(clean) && constants.has(clean)) {
    return { state: 'CONST_RESOLVED', name: constants.get(clean), identifier: clean };
  }
  return { state: 'DYNAMIC_NOT_RESOLVED', name: null };
}

function extractRaw(text, source) {
  const constants = stringConstants(text);
  const output = [];
  function add(match, family, role, raw, extra = {}) {
    const resolved = raw === null ? { state: 'UNNAMED', name: null } : resolveArgument(raw, constants);
    output.push(Object.assign({
      family,
      role,
      name: resolved.name,
      resolution: resolved.state,
      identifier: resolved.identifier || null,
      path: source.path,
      line: lineAt(text, match.index),
      sourceOwner: source.sourceOwner,
      consumingModules: source.consumingModules
    }, extra));
  }

  let match;
  const broadcast = /\bnew\s+BroadcastChannel\s*\(\s*([^,\)\r\n]+)/g;
  while ((match = broadcast.exec(text))) add(match, 'BROADCAST_CHANNEL', 'ENDPOINT_DECLARATION', match[1]);

  const custom = /\bnew\s+CustomEvent\s*\(\s*([^,\)\r\n]+)/g;
  while ((match = custom.exec(text))) add(match, 'CUSTOM_EVENT', 'PRODUCER_CONSTRUCTED', match[1]);

  const listener = /\b(?:window|document|self|globalThis|[A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*addEventListener\s*\(\s*([^,\)\r\n]+)/g;
  while ((match = listener.exec(text))) add(match, 'DOM_EVENT_LISTENER', 'CONSUMER_REGISTERED', match[1]);

  const websocket = /\bnew\s+WebSocket\s*\(\s*([^,\)\r\n]+)/g;
  while ((match = websocket.exec(text))) add(match, 'WEB_SOCKET', 'ENDPOINT_TEXT_DECLARATION', match[1]);

  const eventSource = /\bnew\s+EventSource\s*\(\s*([^,\)\r\n]+)/g;
  while ((match = eventSource.exec(text))) add(match, 'EVENT_SOURCE', 'ENDPOINT_TEXT_DECLARATION', match[1]);

  const messageChannel = /\bnew\s+MessageChannel\s*\(/g;
  while ((match = messageChannel.exec(text))) add(match, 'MESSAGE_CHANNEL', 'ANONYMOUS_PAIR_DECLARATION', null);

  const postMessage = /\b(?:window|self|globalThis|parent|top|opener|[A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*postMessage\s*\(/g;
  while ((match = postMessage.exec(text))) add(match, 'POST_MESSAGE', 'UNNAMED_PRODUCER_CALL', null);

  const unique = new Map();
  for (const item of output) {
    const key = [item.family, item.role, item.name, item.resolution, item.path, item.line].join('|');
    unique.set(key, item);
  }
  return Array.from(unique.values()).sort((left, right) => (
    left.path.localeCompare(right.path)
    || left.line - right.line
    || left.family.localeCompare(right.family)
  ));
}

function ownershipScope(item) {
  return item.sourceOwner || 'SHARED_SOURCE:' + item.path;
}

function normalizeObservations(raw) {
  const customNames = new Set(raw.filter(item => item.family === 'CUSTOM_EVENT' && item.name).map(item => item.name));
  return raw.filter(item => {
    if (item.family !== 'DOM_EVENT_LISTENER') return true;
    return item.name && (customNames.has(item.name) || ENVIRONMENT_EVENTS.has(item.name));
  }).map(item => {
    if (item.family !== 'DOM_EVENT_LISTENER') return item;
    return Object.assign({}, item, {
      family: customNames.has(item.name) ? 'CUSTOM_EVENT' : 'ENVIRONMENT_EVENT'
    });
  });
}

function buildGroups(observations) {
  const grouped = new Map();
  for (const item of observations) {
    if (!item.name || !['CUSTOM_EVENT', 'BROADCAST_CHANNEL', 'ENVIRONMENT_EVENT'].includes(item.family)) continue;
    const key = item.family + ':' + item.name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  const output = [];
  for (const [key, items] of grouped) {
    const separator = key.indexOf(':');
    const family = key.slice(0, separator);
    const name = key.slice(separator + 1);
    const producers = items.filter(item => ['PRODUCER_CONSTRUCTED', 'ENDPOINT_DECLARATION'].includes(item.role));
    const consumers = items.filter(item => ['CONSUMER_REGISTERED', 'ENDPOINT_DECLARATION'].includes(item.role));
    const scopes = Array.from(new Set(items.map(ownershipScope))).sort();
    let state = 'OBSERVED_NAMED_CHANNEL';
    if (family === 'CUSTOM_EVENT' && producers.length && !consumers.length) state = 'PRODUCER_WITHOUT_STATIC_CONSUMER_REVIEW';
    else if (family === 'CUSTOM_EVENT' && consumers.length && !producers.length) state = 'CONSUMER_WITHOUT_STATIC_PRODUCER_REVIEW';
    else if (scopes.length > 1) state = 'MULTI_OWNER_NAMED_CHANNEL_REVIEW';
    output.push({
      id: sha256(Buffer.from(key)).slice(0, 20),
      family,
      name,
      state,
      ownershipScopes: scopes,
      producerCount: producers.length,
      consumerCount: consumers.length,
      observations: items.map(item => ({
        role: item.role,
        path: item.path,
        line: item.line,
        sourceOwner: item.sourceOwner,
        consumingModules: item.consumingModules
      }))
    });
  }
  return output.sort((left, right) => left.family.localeCompare(right.family) || left.name.localeCompare(right.name));
}

function analyzeWorkshop(rootInput, graph, options = {}) {
  if (!graph || graph.schema !== GRAPH_SCHEMA) throw new Error('runtime channel analysis requires an ' + GRAPH_SCHEMA + ' graph');
  const root = path.resolve(rootInput || process.cwd());
  const sources = collectSources(graph);
  const sourceReceipts = [];
  const readIssues = [];
  const raw = [];
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
    raw.push(...extractRaw(loaded.text, source));
  }
  const observations = normalizeObservations(raw);
  const channels = buildGroups(observations);
  const measuredAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    graphFingerprint: graph.source && graph.source.fingerprint,
    sourceReceipts,
    observations,
    channels,
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
      namedChannels: channels.length,
      broadcastChannels: observations.filter(item => item.family === 'BROADCAST_CHANNEL').length,
      customEventObservations: observations.filter(item => item.family === 'CUSTOM_EVENT').length,
      environmentEventConsumers: observations.filter(item => item.family === 'ENVIRONMENT_EVENT').length,
      postMessageCalls: observations.filter(item => item.family === 'POST_MESSAGE').length,
      messageChannelDeclarations: observations.filter(item => item.family === 'MESSAGE_CHANNEL').length,
      endpointTextDeclarations: observations.filter(item => ['WEB_SOCKET', 'EVENT_SOURCE'].includes(item.family)).length,
      dynamicNotResolved: observations.filter(item => item.resolution === 'DYNAMIC_NOT_RESOLVED').length,
      reviewSeams: channels.filter(item => item.state.endsWith('_REVIEW')).length,
      readIssues: readIssues.length
    },
    observations,
    channels,
    sourceReceipts,
    readIssues,
    scopeBoundary: 'Only exact textual declarations of BroadcastChannel, CustomEvent and selected listeners, postMessage, MessageChannel, WebSocket, and EventSource are observed in graph-bounded HTML and JavaScript whose hash still matches the graph. No producer, consumer, socket, stream, worker, or browser is run. Pairing is static name evidence only.',
    preservedOwners: {
      runtimeDelivery: 'Handoff Wiring and declaring modules',
      liveNetworkAndBrowser: 'Browser, LAN and Hardware QA Lab',
      protocolCompatibility: 'Protocol Version Observatory and protocol owners',
      permissions: 'Authority Surface and permission owners',
      sourceScope: 'Entry Resource Closure Observatory',
      readiness: 'Technical Glasses'
    },
    truth: {
      sourceTextPatternRead: true,
      javascriptParsedCompletely: false,
      browserLoaded: false,
      scriptsExecuted: false,
      socketOpened: false,
      eventStreamOpened: false,
      channelOpened: false,
      messageSent: false,
      eventDispatched: false,
      deliveryProven: false,
      protocolCompatibilityProven: false,
      permissionGranted: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

function createReviewRequest(map, channelIdInput, options = {}) {
  if (!map || map.schema !== SCHEMA) throw new Error('review request requires an ' + SCHEMA + ' map');
  const channelId = typeof channelIdInput === 'string' ? channelIdInput.trim() : '';
  const channel = map.channels.find(item => item.id === channelId);
  if (!channel) throw new Error('named channel is not present: ' + channelId);
  const questions = [
    'CONFIRM_CHANNEL_NAME_AND_FAMILY_ARE_INTENTIONAL',
    'IDENTIFY_PRODUCER_CONSUMER_AND_RUNTIME_OWNER',
    'VERIFY_PAYLOAD_PROTOCOL_AND_DELIVERY_IN_EXISTING_RUNTIME_QA',
    'RECORD_KEEP_ADAPT_OR_RETIRE_DECISION_WITH_COMPATIBILITY_BOUNDARY'
  ].map(id => ({ id, state: 'REQUEST_NOT_RUN', answer: null, evidence: null }));
  const generatedAt = options.now || new Date().toISOString();
  const material = { schema: REVIEW_SCHEMA, mapFingerprint: map.source.fingerprint, channel, questions };
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
    selectedChannel: channel,
    questions,
    summary: { channelsSelected: 1, questionsRequested: questions.length, questionsAnswered: 0 },
    scopeBoundary: 'This packet asks existing runtime and protocol owners to inspect one named static channel seam. It starts no channel, sends no message, changes no payload, grants no permission, and proves no delivery.',
    truth: {
      requestOnly: true,
      browserLoaded: false,
      channelOpened: false,
      messageSent: false,
      deliveryProven: false,
      payloadIncluded: false,
      protocolChanged: false,
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
  ENVIRONMENT_EVENTS,
  collectSources,
  readGraphSource,
  stringConstants,
  resolveArgument,
  extractRaw,
  normalizeObservations,
  buildGroups,
  analyzeWorkshop,
  createReviewRequest
};
