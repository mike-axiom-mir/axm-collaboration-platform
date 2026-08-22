'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const AssetHands = require('../asset-hands/asset-hands');
const Holodeck = require('../holodeck');
const HolodeckVisualCapture = require('./holodeck-visual-capture');
const EchoAtriumWorld = require('../holodeck/examples/echo-atrium.world.json');

const REQUEST_SCHEMA = 'axm.platform-courier.request/v1';
const RESPONSE_SCHEMA = 'axm.platform-courier.response/v1';
const CONSENT_SCHEMA = 'axm.platform-courier.consent/v1';
const STATUS_SCHEMA = 'axm.platform-courier.status/v1';
const SETTINGS_SCHEMA = 'axm.platform-connect.settings/v1';
const CONNECTIONS_SCHEMA = 'axm.platform-connect.connections/v1';
const READ_SCOPE = 'platform.read';
const HAND_SCOPE = 'platform.hands.invoke';
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const MAX_OUTBOX_FILES = 500;
const MAX_CONNECTIONS = 32;
const MAX_HOLODECK_SESSIONS = 16;
const HOLODECK_SESSION_SCHEMA = 'axm.platform-courier.holodeck-session/v1';
const PROVIDER_PROFILES = Object.freeze([
  { id:'anthropic-platform', label:'Claude Platform / Cowork', maturity:'LIVE_PROVEN', transport:'shared-folder-mailbox', summary:'Verified with a sandboxed Claude Platform session through the AXM courier.' },
  { id:'generic-sandbox', label:'Generic sandboxed AI', maturity:'CONTRACT_READY', transport:'shared-folder-mailbox', summary:'For a platform that can read and write the mounted AXM courier folder.' },
  { id:'local-agent', label:'Local AI agent', maturity:'CONTRACT_READY', transport:'shared-folder-mailbox', summary:'For a local agent using the same typed mailbox instead of raw Workshop access.' },
]);
const DEFAULT_SETTINGS = Object.freeze({
  schema:SETTINGS_SCHEMA,
  enabled:true,
  connectionMode:'shared-folder-mailbox',
  providerProfile:'anthropic-platform',
  allowRead:true,
  allowHandInvocation:true,
  allowSafePreviews:true,
  allowHeartbeatStatus:false,
  allowHolodeck:false,
  receiptRetention:MAX_OUTBOX_FILES,
  updatedAt:null,
  updatedBy:null,
});
const SAFE_POST_ROUTES = new Set([
  '/api/module-workbench/validate',
  '/api/modular-intake/inspect',
  '/api/template-runtime/render',
  '/api/world-adapters/evaluate',
  '/api/cognitive-resource-meter/preview-observation',
  '/api/cognitive-resource-meter/preview-goal-receipt',
  '/api/cognitive-resource-meter/preview-economics',
  '/api/cognitive-resource-meter/compatibility',
]);

const ACTIONS = Object.freeze([
  { id:'ping', scope:READ_SCOPE, effect:'read', summary:'Prove the local AXM courier is alive.' },
  { id:'catalog', scope:READ_SCOPE, effect:'read', summary:'Describe actions, limits, and consent state.' },
  { id:'discover', scope:READ_SCOPE, effect:'read', summary:'Search the deterministic public module and capability registry.' },
  { id:'search', scope:READ_SCOPE, effect:'read', summary:'Use AXM Workshop Search with its private-state exclusions.' },
  { id:'api.call', scope:READ_SCOPE, effect:'read-or-preview', summary:'Call local AXM GET APIs or an allowlisted deterministic preview POST.' },
  { id:'hands.catalog', scope:READ_SCOPE, effect:'read', summary:'List reusable AXM asset hands and their contracts.' },
  { id:'hands.diagnose', scope:READ_SCOPE, effect:'read', summary:'Diagnose whether AXM can satisfy an asset brief.' },
  { id:'hands.plan', scope:READ_SCOPE, effect:'read', summary:'Route an asset brief to compatible deterministic hands.' },
  { id:'hands.invoke', scope:HAND_SCOPE, effect:'bounded-artifact-write', summary:'Invoke one registered AXM hand and write returned artifacts only inside courier state.' },
  { id:'evidence.status', scope:READ_SCOPE, effect:'read', summary:'Read AXM evidence-retention status.' },
  { id:'heartbeat.status', scope:READ_SCOPE, effect:'read', summary:'Read the live Platform Heartbeat, organ bridge and next-beat status without changing its rhythm.' },
  { id:'holodeck.catalog', scope:READ_SCOPE, effect:'read', summary:'Describe the bounded Echo Atrium world and machine interaction contract.' },
  { id:'holodeck.session.list', scope:READ_SCOPE, effect:'read', summary:'List bounded courier-owned Holodeck sessions without exposing state payloads.' },
  { id:'holodeck.session.start', scope:HAND_SCOPE, effect:'bounded-state-write', summary:'Start or resume one courier-owned Echo Atrium session.' },
  { id:'holodeck.observe', scope:READ_SCOPE, effect:'read', summary:'Receive a structured Holodeck sensor frame from one session.' },
  { id:'holodeck.capture', scope:HAND_SCOPE, effect:'bounded-visual-artifact-write', summary:'Render one exact courier-owned session through the local Three.js Screen Deck and return a hash-bound PNG.' },
  { id:'holodeck.intent.dispatch', scope:HAND_SCOPE, effect:'bounded-state-write', summary:'Dispatch one MOVE, TURN or INTERACT intent through the deterministic Holodeck kernel.' },
  { id:'holodeck.snapshot', scope:READ_SCOPE, effect:'read', summary:'Create a hash-bound state snapshot for one courier-owned session.' },
  { id:'holodeck.session.reset', scope:HAND_SCOPE, effect:'bounded-state-write', summary:'Explicitly reset one exact courier-owned Echo Atrium session.' },
]);

function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function cleanId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id)) throw new Error('request id must be 1-120 safe characters');
  return id;
}
function cleanSegment(value, fallback) {
  return String(value || fallback || 'artifact').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'artifact';
}
function cleanLabel(value, fallback, max) {
  const text = String(value == null ? fallback || '' : value).trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  return text.slice(0, max || 120);
}
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const temporary = file + '.' + process.pid + '.' + Date.now() + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
}
function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = canonical(value[key]); return out; }, {});
}
function boundedJson(value, maxBytes, label) {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > maxBytes) throw new Error(label + ' exceeds ' + maxBytes + ' bytes');
  return text;
}
function extensionFor(artifact) {
  const format = String(artifact.format || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const mime = String(artifact.mime || '').toLowerCase();
  const byMime = { 'image/png':'png', 'image/svg+xml':'svg', 'image/gif':'gif', 'image/webp':'webp', 'image/ktx2':'ktx2', 'audio/midi':'mid', 'audio/wav':'wav', 'video/mp4':'mp4', 'video/webm':'webm', 'model/gltf-binary':'glb', 'model/gltf+json':'gltf', 'application/pdf':'pdf', 'application/epub+zip':'epub', 'application/json':'json', 'text/html':'html', 'text/css':'css', 'text/plain':'txt' };
  return byMime[mime] || format.slice(0, 12) || (artifact.text != null ? 'txt' : 'bin');
}
function decodeArtifact(artifact) {
  if (typeof artifact.dataUrl === 'string' && artifact.dataUrl) {
    const match = artifact.dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) throw new Error('artifact dataUrl is invalid');
    return match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  }
  if (typeof artifact.text === 'string') return Buffer.from(artifact.text, 'utf8');
  if (Array.isArray(artifact.bytes)) return Buffer.from(artifact.bytes);
  return null;
}
function artifactReceipt(artifact, absolute, root, bytes) {
  const copy = Object.assign({}, artifact);
  delete copy.dataUrl; delete copy.text; delete copy.bytes;
  copy.courier_file = path.relative(root, absolute).replace(/\\/g, '/');
  copy.bytes = bytes.length;
  copy.sha256 = sha256(bytes);
  return copy;
}
function persistArtifacts(result, requestId, artifactsRoot, stateRoot) {
  if (!result || !Array.isArray(result.artifacts)) return result;
  const output = clone(result);
  const target = path.join(artifactsRoot, cleanSegment(requestId));
  fs.mkdirSync(target, { recursive:true });
  output.artifacts = result.artifacts.map((artifact, index) => {
    const bytes = decodeArtifact(artifact);
    if (!bytes) return clone(artifact);
    const name = cleanSegment(artifact.id || artifact.name || 'artifact-' + (index + 1));
    const absolute = path.join(target, name + '.' + extensionFor(artifact));
    fs.writeFileSync(absolute, bytes);
    return artifactReceipt(artifact, absolute, stateRoot, bytes);
  });
  output.courier_artifact_root = path.relative(stateRoot, target).replace(/\\/g, '/');
  return output;
}

function defaultHandHost() {
  const accepts = new Set([AssetHands.RESULT_SCHEMA, 'application/json', 'image/svg+xml']);
  AssetHands.list().forEach(hand => (hand.produces || []).forEach(value => accepts.add(value)));
  return { capabilities:['json','svg','deterministic-recipes'], permissions:[], accepts:Array.from(accepts).sort() };
}

function create(options) {
  options = options || {};
  const workshopRoot = path.resolve(options.root);
  const stateRoot = path.join(path.resolve(options.stateRoot), 'axm-platform-courier');
  const inbox = path.join(stateRoot, 'inbox');
  const outbox = path.join(stateRoot, 'outbox');
  const artifacts = path.join(stateRoot, 'artifacts');
  const statusFile = path.join(stateRoot, 'status.json');
  const consentFile = path.join(stateRoot, 'consent.json');
  const settingsFile = path.join(stateRoot, 'settings.json');
  const connectionsFile = path.join(stateRoot, 'connections.json');
  const holodeckSessions = path.join(stateRoot, 'holodeck-sessions');
  const modulesFile = path.join(workshopRoot, 'registry', 'modules.json');
  let timer = null;
  let heartbeat = null;
  let processing = false;
  let processed = 0;
  let lastRequestAt = null;
  let lastError = null;
  [inbox, outbox, artifacts, holodeckSessions].forEach(folder => fs.mkdirSync(folder, { recursive:true }));
  const echoAtriumPlan = Holodeck.Compiler.compile(EchoAtriumWorld);
  const holodeckVisualCapture = options.holodeckVisualCapture || HolodeckVisualCapture.create({ workshopRoot, stateRoot, port:options.port, getPort:options.getPort });

  function settings() {
    const value = loadJson(settingsFile, {});
    const profileIds = new Set(PROVIDER_PROFILES.map(profile => profile.id));
    return {
      schema:SETTINGS_SCHEMA,
      enabled:value.enabled !== false,
      connectionMode:'shared-folder-mailbox',
      providerProfile:profileIds.has(value.providerProfile) ? value.providerProfile : DEFAULT_SETTINGS.providerProfile,
      allowRead:value.allowRead !== false,
      allowHandInvocation:value.allowHandInvocation !== false,
      allowSafePreviews:value.allowSafePreviews !== false,
      allowHeartbeatStatus:value.allowHeartbeatStatus === true,
      allowHolodeck:value.allowHolodeck === true,
      receiptRetention:Math.max(50, Math.min(MAX_OUTBOX_FILES, Number(value.receiptRetention) || MAX_OUTBOX_FILES)),
      updatedAt:value.updatedAt || null,
      updatedBy:value.updatedBy || null,
    };
  }
  function configure(input, actor) {
    input = input && typeof input === 'object' ? input : {};
    const current = settings();
    const next = Object.assign({}, current, {
      enabled:typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
      providerProfile:input.providerProfile == null ? current.providerProfile : cleanLabel(input.providerProfile, '', 80),
      allowRead:typeof input.allowRead === 'boolean' ? input.allowRead : current.allowRead,
      allowHandInvocation:typeof input.allowHandInvocation === 'boolean' ? input.allowHandInvocation : current.allowHandInvocation,
      allowSafePreviews:typeof input.allowSafePreviews === 'boolean' ? input.allowSafePreviews : current.allowSafePreviews,
      allowHeartbeatStatus:typeof input.allowHeartbeatStatus === 'boolean' ? input.allowHeartbeatStatus : current.allowHeartbeatStatus,
      allowHolodeck:typeof input.allowHolodeck === 'boolean' ? input.allowHolodeck : current.allowHolodeck,
      receiptRetention:input.receiptRetention == null ? current.receiptRetention : Math.max(50, Math.min(MAX_OUTBOX_FILES, Number(input.receiptRetention) || current.receiptRetention)),
      updatedAt:now(),
      updatedBy:cleanLabel(actor, 'local-user', 120),
    });
    if (!PROVIDER_PROFILES.some(profile => profile.id === next.providerProfile)) throw new Error('invalid Platform Connect provider profile');
    atomicJson(settingsFile, next);
    writeStatus();
    return snapshot();
  }

  function connections() {
    const value = loadJson(connectionsFile, { schema:CONNECTIONS_SCHEMA, connections:[] });
    return value && value.schema === CONNECTIONS_SCHEMA && Array.isArray(value.connections) ? value.connections.slice(0, MAX_CONNECTIONS) : [];
  }
  function recordConnection(request, outcome) {
    const client = request && request.client && typeof request.client === 'object' ? request.client : {};
    const provider = cleanLabel(client.provider, 'unknown-platform', 80) || 'unknown-platform';
    const surface = cleanLabel(client.surface, 'shared-folder', 80) || 'shared-folder';
    const sessionId = cleanLabel(client.session_id, 'anonymous', 120) || 'anonymous';
    const id = cleanSegment(client.id || [provider, surface, sessionId].join('-'), 'anonymous-shared-folder');
    const list = connections();
    const existing = list.find(item => item.id === id);
    const stamp = now();
    const next = existing ? Object.assign({}, existing) : { id, provider, surface, sessionId, label:cleanLabel(client.label, provider, 120), firstSeenAt:stamp, actionCount:0 };
    next.lastSeenAt = stamp;
    next.lastAction = cleanLabel(request && request.action, 'unknown', 80);
    next.lastOutcome = outcome ? 'ok' : 'error';
    next.actionCount = Math.max(0, Number(next.actionCount) || 0) + 1;
    atomicJson(connectionsFile, { schema:CONNECTIONS_SCHEMA, updatedAt:stamp, connections:[next].concat(list.filter(item => item.id !== id)).slice(0, MAX_CONNECTIONS) });
  }

  function consent() {
    const value = loadJson(consentFile, null);
    if (!value || value.schema !== CONSENT_SCHEMA || value.granted !== true || !Array.isArray(value.scopes)) return { granted:false, scopes:[] };
    if (value.expiresAt && Date.parse(value.expiresAt) <= Date.now()) return { granted:false, scopes:[], expired:true, expiresAt:value.expiresAt };
    return value;
  }
  function grantConsent(input, actor) {
    input = input && typeof input === 'object' ? input : {};
    const allowed = new Set([READ_SCOPE, HAND_SCOPE]);
    const requested = Array.isArray(input.scopes) ? input.scopes.map(value => String(value)) : [];
    const scopes = Array.from(new Set(requested.filter(scope => allowed.has(scope))));
    if (!scopes.length || scopes.length !== requested.length) throw new Error('consent requires exact declared Platform Connect scopes');
    const expiry = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) throw new Error('consent expiry must be a valid future time');
    const value = { schema:CONSENT_SCHEMA, granted:true, actor:cleanLabel(actor, 'local-user', 120), subject:cleanLabel(input.subject, settings().providerProfile, 120), grantedAt:now(), expiresAt:expiry ? expiry.toISOString() : null, scopes };
    atomicJson(consentFile, value);
    writeStatus();
    return snapshot();
  }
  function revokeConsent(actor) {
    atomicJson(consentFile, { schema:CONSENT_SCHEMA, granted:false, actor:cleanLabel(actor, 'local-user', 120), revokedAt:now(), expiresAt:null, scopes:[] });
    writeStatus();
    return snapshot();
  }
  function requireScope(scope) {
    const configuration = settings();
    if (!configuration.enabled) throw new Error('Platform Connect is disabled by the local user');
    if (scope === READ_SCOPE && !configuration.allowRead) throw new Error('Platform Connect read capability is disabled by the local user');
    if (scope === HAND_SCOPE && !configuration.allowHandInvocation) throw new Error('Platform Connect hand invocation is disabled by the local user');
    const current = consent();
    if (!current.granted || !current.scopes.includes(scope)) throw new Error('local consent scope required: ' + scope);
    return current;
  }
  function status() {
    const current = consent();
    const configuration = settings();
    return { schema:STATUS_SCHEMA, ready:!!timer && configuration.enabled, serviceRunning:!!timer, enabled:configuration.enabled, mode:'integrated-with-axm-server', transport:configuration.connectionMode, pid:process.pid, heartbeatAt:now(), root:path.relative(workshopRoot, stateRoot).replace(/\\/g, '/'), inbox:path.relative(workshopRoot, inbox).replace(/\\/g, '/'), outbox:path.relative(workshopRoot, outbox).replace(/\\/g, '/'), consent:{ granted:!!current.granted, scopes:(current.scopes || []).slice(), actor:current.actor || null, subject:current.subject || null, expiresAt:current.expiresAt || null }, processing, processed, pending:fs.readdirSync(inbox).filter(name => name.endsWith('.json')).length, lastRequestAt, lastError, boundaries:{ localOnly:true, arbitraryShell:false, remoteUrls:false, secrets:false, mutations:false, safePreviewPosts:Array.from(SAFE_POST_ROUTES).sort(), maxRequestBytes:MAX_REQUEST_BYTES, maxResponseBytes:MAX_RESPONSE_BYTES } };
  }
  function writeStatus() { atomicJson(statusFile, status()); }
  function snapshot() {
    return { schema:'axm.platform-connect.snapshot/v1', status:status(), settings:settings(), providerProfiles:PROVIDER_PROFILES, connections:connections(), actions:ACTIONS };
  }
  function catalog() {
    const current = consent();
    return { schema:'axm.platform-courier.catalog/v1', actions:ACTIONS, consent:{ granted:!!current.granted, scopes:(current.scopes || []).slice() }, platform:{ moduleRegistry:'registry/modules.json', moduleCount:(loadJson(modulesFile, {}).modules || []).length, handCount:AssetHands.list().length }, boundaries:status().boundaries };
  }
  function discover(payload) {
    const registry = loadJson(modulesFile, null);
    if (!registry || !Array.isArray(registry.modules)) throw new Error('public module registry is unavailable');
    const query = String(payload.query || '').trim().toLowerCase().slice(0, 160);
    const statusFilter = String(payload.status || '').trim().toUpperCase();
    const kind = String(payload.kind || '').trim().toLowerCase();
    const capability = String(payload.capability || '').trim().toLowerCase().slice(0, 160);
    const limit = Math.max(1, Math.min(200, Number(payload.limit) || 40));
    const matches = registry.modules.filter(module => {
      const provides = module.contract && Array.isArray(module.contract.provides) ? module.contract.provides : [];
      const haystack = [module.id,module.name,module.status,module.kind,module.audience,module.source_path,module.entry_path].concat(provides).join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (!statusFilter || String(module.status).toUpperCase() === statusFilter) && (!kind || String(module.kind).toLowerCase() === kind) && (!capability || provides.some(item => String(item).toLowerCase().includes(capability)));
    });
    return { schema:'axm.platform-discovery-result/v1', query:query || null, filters:{ status:statusFilter || null, kind:kind || null, capability:capability || null }, total:matches.length, results:matches.slice(0, limit).map(module => ({ id:module.id, name:module.name, status:module.status, kind:module.kind, audience:module.audience, source_path:module.source_path, entry_path:module.entry_path, provides:module.contract && module.contract.provides || [], consumes:module.contract && module.contract.consumes || [], permissions:module.contract && module.contract.permissions || [], manifest:module.manifest && { valid:module.manifest.valid, sha256:module.manifest.sha256 }, contract:module.contract && { valid:module.contract.valid, path:module.contract.path } })), registry:{ generatedAt:registry.generated_at, summary:registry.summary, truth:registry.truth } };
  }
  function apiCall(payload) {
    const method = String(payload.method || 'GET').toUpperCase();
    const route = String(payload.route || '').trim();
    if (!/^\/api\/[a-zA-Z0-9/_?=&.%+-]*$/.test(route) || route.includes('..')) throw new Error('api.call route must be a local /api path');
    if (method !== 'GET' && !(method === 'POST' && SAFE_POST_ROUTES.has(route.split('?')[0]))) throw new Error('api.call only allows GET or a declared deterministic preview POST');
    if (method === 'POST' && !settings().allowSafePreviews) throw new Error('Platform Connect safe preview calls are disabled by the local user');
    const port = Number(typeof options.getPort === 'function' ? options.getPort() : options.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('AXM server port is not ready');
    const body = method === 'POST' ? boundedJson(payload.body || {}, MAX_REQUEST_BYTES, 'api.call body') : null;
    return new Promise((resolve, reject) => {
      const request = http.request({ hostname:'127.0.0.1', port, path:route, method, headers:body ? { 'content-type':'application/json; charset=utf-8', 'content-length':Buffer.byteLength(body), 'x-axm-actor':'claude-via-platform-courier' } : {} }, response => {
        const chunks = []; let bytes = 0;
        response.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_RESPONSE_BYTES) { request.destroy(new Error('AXM API response exceeds courier limit')); return; } chunks.push(chunk); });
        response.on('end', () => {
          try { const text = Buffer.concat(chunks).toString('utf8'); resolve({ statusCode:response.statusCode, headers:{ 'content-type':response.headers['content-type'] || null }, body:text ? JSON.parse(text) : null }); }
          catch (error) { reject(new Error('AXM API returned invalid JSON: ' + error.message)); }
        });
      });
      request.setTimeout(30000, () => request.destroy(new Error('AXM API call timed out')));
      request.on('error', reject);
      if (body) request.write(body);
      request.end();
    });
  }
  function handPayload(payload) {
    if (!payload.brief || typeof payload.brief !== 'object' || Array.isArray(payload.brief)) throw new Error('hands action requires a brief object');
    boundedJson(payload.brief, MAX_REQUEST_BYTES, 'hand brief');
    return payload.brief;
  }
  function requireFeature(action) {
    const configuration = settings();
    if (action === 'heartbeat.status' && !configuration.allowHeartbeatStatus) throw new Error('Platform Heartbeat visibility is disabled in Platform Connect settings');
    if (action.startsWith('holodeck.') && !configuration.allowHolodeck) throw new Error('Holodeck access is disabled in Platform Connect settings');
  }
  async function heartbeatStatus() {
    const response = await apiCall({ method:'GET', route:'/api/platform-heartbeat' });
    if (response.statusCode < 200 || response.statusCode >= 300 || !response.body || response.body.ok !== true) throw new Error('live Platform Heartbeat status is unavailable');
    return response.body.status;
  }
  function holodeckSessionId(request, payload) {
    const client = request && request.client && typeof request.client === 'object' ? request.client : {};
    return cleanId(payload.session_id || client.session_id || 'platform-echo-atrium');
  }
  function holodeckActor(request, payload) {
    const client = request && request.client && typeof request.client === 'object' ? request.client : {};
    const id = cleanSegment(payload.actor_id || client.id || 'platform-machine', 'platform-machine');
    return { id, kind:'machine', name:cleanLabel(payload.actor_name || client.label, id, 120) || id };
  }
  function holodeckSessionFile(sessionId) { return path.join(holodeckSessions, sessionId + '.json'); }
  function readHolodeckSession(sessionId, required) {
    const record = loadJson(holodeckSessionFile(sessionId), null);
    if (!record) {
      if (required) throw new Error('Holodeck session not found: ' + sessionId);
      return null;
    }
    if (record.schema !== HOLODECK_SESSION_SCHEMA || record.sessionId !== sessionId || record.planDigest !== echoAtriumPlan.planDigest) throw new Error('Holodeck session contract mismatch: ' + sessionId);
    const verification = Holodeck.State.verify(echoAtriumPlan, record.state);
    if (!verification.ok) throw new Error('Holodeck session state failed verification: ' + verification.errors.join('; '));
    return record;
  }
  function writeHolodeckSession(record) {
    boundedJson(record, MAX_RESPONSE_BYTES, 'Holodeck session');
    atomicJson(holodeckSessionFile(record.sessionId), record);
    return record;
  }
  function holodeckSessionSummary(record) {
    return { sessionId:record.sessionId, worldId:record.worldId, planDigest:record.planDigest, revision:record.state.revision, tick:record.state.tick, stateDigest:record.state.stateDigest, createdAt:record.createdAt, updatedAt:record.updatedAt, lastIntentStatus:record.lastReceipt ? record.lastReceipt.status : null };
  }
  function holodeckFrame(record, actor) { return Holodeck.Sensor.observe(echoAtriumPlan, record.state, actor); }
  function createHolodeckSession(request, payload, reset) {
    const sessionId = holodeckSessionId(request, payload);
    const actor = holodeckActor(request, payload);
    const existing = readHolodeckSession(sessionId, false);
    if (existing && !reset) return { schema:'axm.platform-courier.holodeck-session-result/v1', resumed:true, session:holodeckSessionSummary(existing), observation:holodeckFrame(existing, actor) };
    const files = fs.readdirSync(holodeckSessions).filter(name => name.endsWith('.json'));
    if (!existing && files.length >= MAX_HOLODECK_SESSIONS) throw new Error('Holodeck session limit reached; reset an existing session instead');
    const stamp = now();
    const record = writeHolodeckSession({ schema:HOLODECK_SESSION_SCHEMA, sessionId, worldId:echoAtriumPlan.worldId, planDigest:echoAtriumPlan.planDigest, createdAt:existing ? existing.createdAt : stamp, updatedAt:stamp, resetAt:reset && existing ? stamp : null, state:Holodeck.State.create(echoAtriumPlan), lastReceipt:null });
    return { schema:'axm.platform-courier.holodeck-session-result/v1', resumed:false, reset:!!existing, session:holodeckSessionSummary(record), observation:holodeckFrame(record, actor) };
  }
  function holodeckCatalog() {
    return { schema:'axm.platform-courier.holodeck-catalog/v1', world:{ id:echoAtriumPlan.worldId, title:echoAtriumPlan.worldTitle, description:echoAtriumPlan.worldDescription, planDigest:echoAtriumPlan.planDigest, objective:echoAtriumPlan.narrative.objective }, intentKinds:Holodeck.Intents.KINDS.slice(), sensorSchema:Holodeck.Sensor.SENSOR_SCHEMA, intentSchema:Holodeck.Intents.INTENT_SCHEMA, sessionLimit:MAX_HOLODECK_SESSIONS, renderer:{ screenAdapterImplemented:true, renderer:'three-r160-webgl', courierObservationIsStructuredState:true, structuredObservationCameraPixels:false, visualCaptureAvailable:true, visualCaptureAction:'holodeck.capture', visualCaptureRetention:HolodeckVisualCapture.MAX_CAPTURE_FILES }, boundaries:{ canonicalWorldOnly:'world.holodeck.echo-atrium', arbitraryWorldImport:false, arbitraryCaptureUrl:false, actorKind:'machine', platformMutation:false, physicalManipulation:false } };
  }
  function listHolodeckSessions() {
    return { schema:'axm.platform-courier.holodeck-session-list/v1', sessions:fs.readdirSync(holodeckSessions).filter(name => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(name)).sort().map(name => readHolodeckSession(path.basename(name, '.json'), true)).map(holodeckSessionSummary) };
  }
  function observeHolodeck(request, payload) {
    const record = readHolodeckSession(holodeckSessionId(request, payload), true);
    return { schema:'axm.platform-courier.holodeck-observation/v1', session:holodeckSessionSummary(record), frame:holodeckFrame(record, holodeckActor(request, payload)) };
  }
  async function captureHolodeck(request, payload) {
    const record = readHolodeckSession(holodeckSessionId(request, payload), true);
    const runner = typeof holodeckVisualCapture === 'function' ? holodeckVisualCapture : holodeckVisualCapture && holodeckVisualCapture.capture;
    if (typeof runner !== 'function') throw new Error('Holodeck visual capture adapter is unavailable');
    const capture = await runner.call(holodeckVisualCapture, {
      requestId:request.id,
      sessionId:record.sessionId,
      state:clone(record.state),
      viewport:payload.viewport,
    });
    if (!capture || capture.schema !== HolodeckVisualCapture.CAPTURE_SCHEMA) throw new Error('Holodeck visual capture returned an invalid contract');
    return { schema:'axm.platform-courier.holodeck-capture-result/v1', session:holodeckSessionSummary(record), capture };
  }
  function dispatchHolodeckIntent(request, payload) {
    const sessionId = holodeckSessionId(request, payload);
    const record = readHolodeckSession(sessionId, true);
    const actor = holodeckActor(request, payload);
    const previousSequence = Number(record.state.actorSequences && record.state.actorSequences[actor.id]) || 0;
    const requestedSequence = payload.sequence == null ? previousSequence + 1 : Number(payload.sequence);
    if (!Number.isInteger(requestedSequence) || requestedSequence < 1) throw new Error('Holodeck intent sequence must be a positive integer');
    const kind = String(payload.kind || '').trim().toUpperCase();
    const intentPayload = payload.intent_payload && typeof payload.intent_payload === 'object' && !Array.isArray(payload.intent_payload) ? payload.intent_payload : {};
    boundedJson(intentPayload, 100000, 'Holodeck intent payload');
    const transition = Holodeck.Intents.dispatch(echoAtriumPlan, record.state, { schema:Holodeck.Intents.INTENT_SCHEMA, actor, sequence:requestedSequence, kind, payload:intentPayload });
    record.state = transition.state; record.lastReceipt = transition.receipt; record.updatedAt = now(); writeHolodeckSession(record);
    return { schema:'axm.platform-courier.holodeck-intent-result/v1', session:holodeckSessionSummary(record), receipt:transition.receipt, observation:holodeckFrame(record, actor) };
  }
  function snapshotHolodeck(request, payload) {
    const record = readHolodeckSession(holodeckSessionId(request, payload), true);
    return { schema:'axm.platform-courier.holodeck-snapshot-result/v1', session:holodeckSessionSummary(record), snapshot:Holodeck.Persistence.create(echoAtriumPlan, record.state, cleanLabel(payload.label, 'Platform courier snapshot', 160)) };
  }
  async function execute(request) {
    const action = String(request.action || '').trim();
    const payload = request.payload && typeof request.payload === 'object' ? request.payload : {};
    const descriptor = ACTIONS.find(item => item.id === action);
    if (!descriptor) throw new Error('unknown courier action: ' + action);
    requireScope(descriptor.scope);
    requireFeature(action);
    if (action === 'ping') return { pong:true, at:now(), pid:process.pid, platformPort:Number(typeof options.getPort === 'function' ? options.getPort() : options.port) || null };
    if (action === 'catalog') return catalog();
    if (action === 'discover') return discover(payload);
    if (action === 'search') {
      if (!options.searchService || typeof options.searchService.search !== 'function') throw new Error('AXM search service is unavailable');
      return options.searchService.search(String(payload.query || ''), { limit:Math.max(1, Math.min(100, Number(payload.limit) || 30)), prefix:String(payload.prefix || '') });
    }
    if (action === 'api.call') return apiCall(payload);
    if (action === 'heartbeat.status') return heartbeatStatus();
    if (action === 'holodeck.catalog') return holodeckCatalog();
    if (action === 'holodeck.session.list') return listHolodeckSessions();
    if (action === 'holodeck.session.start') return createHolodeckSession(request, payload, false);
    if (action === 'holodeck.observe') return observeHolodeck(request, payload);
    if (action === 'holodeck.capture') return captureHolodeck(request, payload);
    if (action === 'holodeck.intent.dispatch') return dispatchHolodeckIntent(request, payload);
    if (action === 'holodeck.snapshot') return snapshotHolodeck(request, payload);
    if (action === 'holodeck.session.reset') return createHolodeckSession(request, payload, true);
    if (action === 'hands.catalog') {
      const query = String(payload.query || '').toLowerCase().slice(0, 120);
      const limit = Math.max(1, Math.min(100, Number(payload.limit) || 50));
      const hands = AssetHands.list().filter(hand => !query || JSON.stringify([hand.id,hand.title,hand.summary,hand.kinds,hand.operation_modes,hand.produces]).toLowerCase().includes(query));
      return { schema:'axm.platform-hand-catalog/v1', version:AssetHands.VERSION, total:hands.length, hands:hands.slice(0, limit), missingHands:AssetHands.listMissingHands(), operationModes:AssetHands.OPERATION_MODES, canvasModels:AssetHands.CANVAS_MODELS, targetCanvasMediums:AssetHands.TARGET_CANVAS_MEDIUMS };
    }
    if (action === 'hands.diagnose') return AssetHands.diagnose(handPayload(payload), defaultHandHost());
    if (action === 'hands.plan') return { schema:'axm.platform-hand-plan/v1', routes:AssetHands.routes(handPayload(payload), defaultHandHost()), diagnosis:AssetHands.diagnose(payload.brief, defaultHandHost()) };
    if (action === 'hands.invoke') {
      const handId = String(payload.hand_id || '').trim();
      if (!AssetHands.list().some(hand => hand.id === handId)) throw new Error('unknown registered AXM hand: ' + handId);
      const result = await AssetHands.createAsync(handId, handPayload(payload), { seed:String(payload.seed || request.id).slice(0, 200), createdAt:String(payload.created_at || request.createdAt || now()).slice(0, 40), host:defaultHandHost() });
      return persistArtifacts(result, request.id, artifacts, stateRoot);
    }
    if (action === 'evidence.status') {
      if (!options.evidenceRetentionService || typeof options.evidenceRetentionService.status !== 'function') throw new Error('AXM evidence-retention service is unavailable');
      return options.evidenceRetentionService.status();
    }
    throw new Error('courier action is not implemented: ' + action);
  }
  function responseFor(request, requestText, ok, result, error, startedAt) {
    const base = { schema:RESPONSE_SCHEMA, id:request.id, action:request.action, ok, requestSha256:sha256(requestText), startedAt, completedAt:now(), result:ok ? result : null, error:ok ? null : String(error && (error.stack || error.message) || error).slice(0, 6000), boundaries:{ arbitraryShell:false, remoteUrls:false, secrets:false, platformMutations:false } };
    const unsigned = JSON.stringify(canonical(base));
    base.receiptSha256 = sha256(unsigned);
    boundedJson(base, MAX_RESPONSE_BYTES, 'courier response');
    return base;
  }
  function prune() {
    const files = fs.readdirSync(outbox).filter(name => name.endsWith('.json')).map(name => ({ name, stat:fs.statSync(path.join(outbox, name)) })).sort((a,b) => b.stat.mtimeMs - a.stat.mtimeMs);
    files.slice(settings().receiptRetention).forEach(item => fs.unlinkSync(path.join(outbox, item.name)));
  }
  async function processFile(file) {
    const source = path.join(inbox, file);
    const claimed = source + '.processing-' + process.pid;
    try { fs.renameSync(source, claimed); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    let request = { id:cleanSegment(path.basename(file, '.json')), action:null };
    let text = '';
    const startedAt = now();
    try {
      const stat = fs.statSync(claimed);
      if (stat.size > MAX_REQUEST_BYTES) throw new Error('courier request exceeds ' + MAX_REQUEST_BYTES + ' bytes');
      text = fs.readFileSync(claimed, 'utf8');
      request = JSON.parse(text);
      if (!request || request.schema !== REQUEST_SCHEMA) throw new Error('request schema must be ' + REQUEST_SCHEMA);
      request.id = cleanId(request.id);
      if (file !== request.id + '.json') throw new Error('request filename must equal request id plus .json');
      const result = await execute(request);
      atomicJson(path.join(outbox, request.id + '.response.json'), responseFor(request, text, true, result, null, startedAt));
      recordConnection(request, true);
    } catch (error) {
      lastError = String(error.message || error).slice(0, 1000);
      const safeText = text || JSON.stringify(request);
      try { atomicJson(path.join(outbox, cleanSegment(request.id) + '.response.json'), responseFor(request, safeText, false, null, error, startedAt)); } catch (writeError) { lastError += '; response write failed: ' + writeError.message; }
      if (text) recordConnection(request, false);
    } finally {
      try { fs.unlinkSync(claimed); } catch (_) {}
      processed += 1; lastRequestAt = now(); prune(); writeStatus();
    }
    return true;
  }
  async function processOnce() {
    if (processing) return false;
    processing = true;
    try {
      const files = fs.readdirSync(inbox).filter(name => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(name)).sort();
      if (!files.length) return false;
      return await processFile(files[0]);
    } finally { processing = false; }
  }
  function start() {
    if (timer) return status();
    writeStatus();
    timer = setInterval(() => processOnce().catch(error => { lastError=String(error.message || error).slice(0,1000); writeStatus(); }), 250);
    heartbeat = setInterval(writeStatus, 5000);
    if (typeof timer.unref === 'function') timer.unref();
    if (typeof heartbeat.unref === 'function') heartbeat.unref();
    return status();
  }
  function stop() {
    if (timer) clearInterval(timer);
    if (heartbeat) clearInterval(heartbeat);
    timer = null; heartbeat = null;
    const value = status(); value.ready = false; value.serviceRunning = false; value.stoppedAt = now(); atomicJson(statusFile, value);
    return value;
  }
  return { start, stop, status, snapshot, settings, configure, consent, grantConsent, revokeConsent, connections, processOnce, execute, paths:{ stateRoot,inbox,outbox,artifacts,statusFile,consentFile,settingsFile,connectionsFile,holodeckSessions }, constants:{ REQUEST_SCHEMA,RESPONSE_SCHEMA,CONSENT_SCHEMA,SETTINGS_SCHEMA,CONNECTIONS_SCHEMA,HOLODECK_SESSION_SCHEMA,READ_SCOPE,HAND_SCOPE,SAFE_POST_ROUTES:Array.from(SAFE_POST_ROUTES) } };
}

module.exports = { create, ACTIONS, REQUEST_SCHEMA, RESPONSE_SCHEMA, CONSENT_SCHEMA, STATUS_SCHEMA, SETTINGS_SCHEMA, CONNECTIONS_SCHEMA, HOLODECK_SESSION_SCHEMA, READ_SCOPE, HAND_SCOPE, SAFE_POST_ROUTES, PROVIDER_PROFILES, DEFAULT_SETTINGS };
