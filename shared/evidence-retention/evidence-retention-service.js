'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.evidence-retention/v1';
const TELEMETRY_TYPES = new Set([
  'heartbeat', 'heartbeat-sample', 'health', 'health-sample', 'indexed', 'poll',
  'presence-sample', 'progress-sample', 'ready-sample', 'scan-sample', 'status-sample'
]);
const PERMANENT_TYPE = /(permission|consent|grant|revoke|refus|deni|vote|approv|promot|deploy|release|rollback|restore|archive|supersed|commit|repair|fail|error|cancel|delete|secret|signing|snapshot)/i;
const managers = new Map();

function now() { return new Date().toISOString(); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function uid(prefix) { return String(prefix) + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return clone(fallback); }
}
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}
function fileSha256(file) { return sha256(fs.readFileSync(file)); }
function readTail(file, maxBytes) {
  const limit = Math.max(1024, Number(maxBytes) || 65536);
  if (!fs.existsSync(file)) return '';
  const stat = fs.statSync(file), start = Math.max(0, stat.size - limit), length = stat.size - start;
  const fd = fs.openSync(file, 'r');
  try { const buffer = Buffer.alloc(length); fs.readSync(fd, buffer, 0, length, start); return buffer.toString('utf8'); }
  finally { fs.closeSync(fd); }
}
function lineCount(file) {
  if (!fs.existsSync(file)) return 0;
  const buffer = fs.readFileSync(file); if (!buffer.length) return 0;
  let count = 0; for (const byte of buffer) if (byte === 10) count++;
  return count + (buffer[buffer.length - 1] === 10 ? 0 : 1);
}
function safePart(value) { return String(value || 'unknown').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'unknown'; }
function findStateRoot(file) {
  let current = path.resolve(path.dirname(file));
  for (let depth = 0; depth < 20; depth++) {
    if (path.basename(current).toLowerCase() === 'state') return current;
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  return null;
}
function isNativeLedger(file) {
  const normalized = path.resolve(file).replace(/\\/g, '/').toLowerCase();
  return normalized.endsWith('/state/cognitive-resource-meter/events.jsonl') || normalized.includes('/mirror-learning/') || normalized.includes('/mirror-native-learning/');
}
function eventType(value) { return String(value && (value.type || value.event || value.kind || value.action) || 'event').trim() || 'event'; }
function classify(value) {
  const type = eventType(value), normalized = type.toLowerCase();
  if (TELEMETRY_TYPES.has(normalized)) return 'TELEMETRY_ROLLUP';
  if (PERMANENT_TYPE.test(type)) return 'PERMANENT_EXACT';
  return 'SESSION_EXACT';
}

function packageRetentionPlan(workshopRoot) {
  const packageRoot = path.join(workshopRoot, 'exports', 'workshop-packages');
  const policy = {
    mode: 'PREVIEW_ONLY',
    automaticDeletion: false,
    retainedZipTiers: { daily: 7, weekly: 4, monthly: 12 },
    latestUnpackedCopy: 1,
    pinnedMilestones: 'PERMANENT',
    note: 'Existing packages are never deleted by this service. A future explicit apply action may use this preview.'
  };
  if (!fs.existsSync(packageRoot)) return { policy, packageRoot: path.relative(workshopRoot, packageRoot).replace(/\\/g, '/'), packages: 0, keep: [], review: [], potentialReclaimBytes: 0 };
  const rows = [];
  for (const entry of fs.readdirSync(packageRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(packageRoot, entry.name), manifestFile = path.join(folder, 'PACKAGE_MANIFEST.json');
    if (!fs.existsSync(manifestFile)) continue;
    const manifest = loadJson(manifestFile, null); if (!manifest) continue;
    const zip = path.join(packageRoot, entry.name + '.zip'), stat = fs.statSync(folder);
    rows.push({
      id: entry.name,
      createdAt: manifest.created_at || stat.mtime.toISOString(),
      sourceBytes: Number(manifest.total_bytes || 0),
      zipBytes: fs.existsSync(zip) ? fs.statSync(zip).size : 0,
      zipPresent: fs.existsSync(zip),
      unpackedPresent: true,
      pinned: fs.existsSync(path.join(folder, '.AXM_PINNED')) || fs.existsSync(path.join(packageRoot, entry.name + '.PINNED'))
    });
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const keep = new Set(), daily = new Set(), weekly = new Set(), monthly = new Set();
  function validDate(row) { const date = new Date(row.createdAt); return Number.isFinite(date.getTime()) ? date : null; }
  for (const row of rows) {
    if (row.pinned) { keep.add(row.id); continue; }
    const date = validDate(row); if (!date) continue;
    const day = date.toISOString().slice(0, 10), first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)), week = date.getUTCFullYear() + '-W' + String(Math.floor((date - first) / 604800000)).padStart(2, '0'), month = day.slice(0, 7);
    if (daily.size < policy.retainedZipTiers.daily && !daily.has(day)) { daily.add(day); keep.add(row.id); continue; }
    if (weekly.size < policy.retainedZipTiers.weekly && !weekly.has(week)) { weekly.add(week); keep.add(row.id); continue; }
    if (monthly.size < policy.retainedZipTiers.monthly && !monthly.has(month)) { monthly.add(month); keep.add(row.id); }
  }
  if (rows[0]) keep.add(rows[0].id);
  const review = rows.filter((row, index) => !keep.has(row.id) || index >= policy.latestUnpackedCopy).map((row, index) => ({
    id: row.id,
    recommendation: !keep.has(row.id) ? 'REVIEW_REDUNDANT_PACKAGE' : 'KEEP_ZIP_REVIEW_UNPACKED_COPY',
    zipPresent: row.zipPresent,
    unpackedPresent: row.unpackedPresent,
    estimatedUnpackedBytes: row.sourceBytes,
    automaticAction: false
  }));
  return { policy, packageRoot: path.relative(workshopRoot, packageRoot).replace(/\\/g, '/'), packages: rows.length, keep: rows.filter(row => keep.has(row.id)).map(row => row.id), review, potentialReclaimBytes: review.reduce((total, row) => total + (row.estimatedUnpackedBytes || 0), 0) };
}

function create(options) {
  const stateRoot = path.resolve(options.stateRoot), workshopRoot = path.dirname(stateRoot), root = path.join(stateRoot, 'evidence-retention');
  const openDir = path.join(root, 'sessions', 'open'), sealedDir = path.join(root, 'sessions', 'sealed');
  const telemetryFile = path.join(root, 'telemetry-rollups.json'), legacyFile = path.join(root, 'legacy-sources.json'), recentFile = path.join(root, 'recent-derived-view.json'), policyFile = path.join(root, 'POLICY.json');
  const limits = Object.assign({ maxEvents: 5000, maxBytes: 10 * 1024 * 1024, maxAgeMs: 24 * 60 * 60 * 1000, recentPerSource: 120 }, options.limits || {});
  let telemetry = loadJson(telemetryFile, { schema: SCHEMA, kind: 'telemetry-rollups', updatedAt: null, buckets: {} });
  let legacy = loadJson(legacyFile, { schema: SCHEMA, kind: 'legacy-source-index', updatedAt: null, sources: {} });
  let recent = loadJson(recentFile, { schema: SCHEMA, kind: 'recent-derived-view', updatedAt: null, sources: {} });
  let session = null, telemetryDirty = false;
  fs.mkdirSync(openDir, { recursive: true }); fs.mkdirSync(sealedDir, { recursive: true });
  if (!fs.existsSync(policyFile)) atomicJson(policyFile, {
    schema: SCHEMA,
    principle: 'Append truth. Seal sessions. Summarize repetition. Preserve evidence of compaction.',
    classes: {
      PERMANENT_EXACT: 'Permissions, consent, refusals, votes, promotions, repairs, releases, restores, failures, and other consequential decisions remain exact.',
      SESSION_EXACT: 'Meaningful work remains exact inside a hash-chained session segment and receives a sealed summary.',
      TELEMETRY_ROLLUP: 'Repeated status, indexing, polling, and heartbeat observations become counted rollups with first/last times and sample digests.',
      DERIVED_REPLACEABLE: 'Indexes, tails, summaries, and snapshots may be rebuilt or replaced.',
      EPHEMERAL: 'Frames, pointer motion, and no-op transient state are not evidence unless promoted by a consequential event.'
    },
    mirrorJournalMigrated: false,
    automaticDeletion: false
  });

  function sourceId(file) { return path.relative(workshopRoot, path.resolve(file)).replace(/\\/g, '/'); }
  function registerLegacy(file, persist) {
    const id = sourceId(file); if (legacy.sources[id]) return id;
    const exists = fs.existsSync(file), stat = exists ? fs.statSync(file) : null;
    legacy.sources[id] = { source: id, registeredAt: now(), sealedLegacy: exists && stat.size > 0, bytes: stat ? stat.size : 0, lines: stat ? lineCount(file) : 0, sha256: stat && stat.size ? fileSha256(file) : null, originalPreserved: true };
    legacy.updatedAt = now(); if (persist !== false) atomicJson(legacyFile, legacy); return id;
  }
  function adoptExistingLegacy() {
    let changed = false, visited = 0;
    function visit(directory) {
      if (!fs.existsSync(directory)) return;
      if (visited >= 2000 || path.resolve(directory).startsWith(path.resolve(root) + path.sep)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (visited >= 2000 || entry.isSymbolicLink()) break;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile() && /\.(jsonl|log)$/i.test(entry.name)) { visited++; const id = sourceId(file); if (!legacy.sources[id]) { registerLegacy(file, false); changed = true; } }
      }
    }
    visit(stateRoot); visit(path.join(workshopRoot, 'logs')); visit(path.join(workshopRoot, 'bridge')); if (changed) atomicJson(legacyFile, legacy);
  }
  function flushTelemetry() { if (!telemetryDirty) return; telemetry.updatedAt = now(); atomicJson(telemetryFile, telemetry); telemetryDirty = false; }
  function flushRecent() { recent.updatedAt = now(); atomicJson(recentFile, recent); }
  function ensureSession() {
    if (session) return session;
    const id = uid('session'), openedAt = now(), file = path.join(openDir, id + '.jsonl');
    session = { id, openedAt, openedMs: Date.now(), file, events: 0, bytes: 0, previousHash: null, summary: { PERMANENT_EXACT: 0, SESSION_EXACT: 0, byType: {}, bySource: {} } };
    return session;
  }
  function appendEnvelope(source, value, evidenceClass) {
    const current = ensureSession();
    if (current.events && (current.events >= limits.maxEvents || current.bytes >= limits.maxBytes || Date.now() - current.openedMs >= limits.maxAgeMs)) { seal('automatic-rotation'); return appendEnvelope(source, value, evidenceClass); }
    const envelope = { schema: SCHEMA, id: uid('evidence'), at: String(value && value.at || now()), sessionId: current.id, source, evidenceClass, type: eventType(value), payload: clone(value), previousHash: current.previousHash };
    envelope.eventHash = sha256(canonical(envelope));
    const line = JSON.stringify(envelope) + '\n'; fs.appendFileSync(current.file, line, 'utf8');
    current.events++; current.bytes += Buffer.byteLength(line); current.previousHash = envelope.eventHash;
    current.summary[evidenceClass]++; current.summary.byType[envelope.type] = (current.summary.byType[envelope.type] || 0) + 1; current.summary.bySource[source] = (current.summary.bySource[source] || 0) + 1;
    const list = recent.sources[source] || []; list.push(envelope); recent.sources[source] = list.slice(-limits.recentPerSource); flushRecent();
    return { evidenceClass, sessionId: current.id, eventHash: envelope.eventHash };
  }
  function rollup(source, value) {
    const type = eventType(value), key = source + '|' + type, at = String(value && value.at || now()), digest = sha256(canonical(value));
    const bucket = telemetry.buckets[key] || { source, type, count: 0, firstAt: at, lastAt: at, firstDigest: digest, lastDigest: digest, lastSample: null };
    bucket.count++; bucket.lastAt = at; bucket.lastDigest = digest; bucket.lastSample = clone(value); telemetry.buckets[key] = bucket; telemetryDirty = true;
    if (bucket.count % 25 === 0) flushTelemetry();
    return { evidenceClass: 'TELEMETRY_ROLLUP', bucket: key, count: bucket.count, digest };
  }
  function record(file, value) {
    const source = registerLegacy(file), evidenceClass = classify(value);
    return evidenceClass === 'TELEMETRY_ROLLUP' ? rollup(source, value) : appendEnvelope(source, value, evidenceClass);
  }
  function verifySegment(file) {
    let previous = null, events = 0, firstAt = null, lastAt = null, summary = { PERMANENT_EXACT: 0, SESSION_EXACT: 0, byType: {}, bySource: {} };
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const item = JSON.parse(line), hash = item.eventHash; delete item.eventHash;
      if (item.previousHash !== previous || sha256(canonical(item)) !== hash) throw new Error('evidence segment hash chain failed: ' + path.basename(file));
      previous = hash; events++; firstAt = firstAt || item.at; lastAt = item.at; const cls = item.evidenceClass;
      if (cls in summary) summary[cls]++; summary.byType[item.type] = (summary.byType[item.type] || 0) + 1; summary.bySource[item.source] = (summary.bySource[item.source] || 0) + 1;
    }
    return { events, firstAt, lastAt, lastHash: previous, summary };
  }
  function seal(reason) {
    flushTelemetry();
    if (!session || !session.events) { session = null; return { sealed: false, reason: 'EMPTY' }; }
    const current = session; session = null; const checked = verifySegment(current.file), month = String(checked.firstAt || now()).slice(0, 7), destinationDir = path.join(sealedDir, month); fs.mkdirSync(destinationDir, { recursive: true });
    const destination = path.join(destinationDir, path.basename(current.file)); fs.renameSync(current.file, destination);
    const manifest = { schema: SCHEMA, kind: 'sealed-session', sessionId: current.id, openedAt: current.openedAt, sealedAt: now(), sealReason: String(reason || 'explicit'), events: checked.events, bytes: fs.statSync(destination).size, segmentSha256: fileSha256(destination), firstAt: checked.firstAt, lastAt: checked.lastAt, lastEventHash: checked.lastHash, summary: checked.summary, sourceSegment: path.relative(workshopRoot, destination).replace(/\\/g, '/'), automaticAuthority: false };
    atomicJson(destination + '.manifest.json', manifest); return { sealed: true, manifest };
  }
  function recoverOpen() {
    for (const name of fs.readdirSync(openDir).filter(name => name.endsWith('.jsonl'))) {
      const file = path.join(openDir, name); if (!fs.statSync(file).size) { fs.rmSync(file, { force: true }); continue; }
      const checked = verifySegment(file), month = String(checked.firstAt || now()).slice(0, 7), destinationDir = path.join(sealedDir, month); fs.mkdirSync(destinationDir, { recursive: true });
      const destination = path.join(destinationDir, name.replace(/\.jsonl$/, '-recovered.jsonl')); fs.renameSync(file, destination);
      atomicJson(destination + '.manifest.json', { schema: SCHEMA, kind: 'sealed-session', sessionId: name.replace(/\.jsonl$/, ''), openedAt: checked.firstAt, sealedAt: now(), sealReason: 'recovered-after-interruption', events: checked.events, bytes: fs.statSync(destination).size, segmentSha256: fileSha256(destination), firstAt: checked.firstAt, lastAt: checked.lastAt, lastEventHash: checked.lastHash, summary: checked.summary, sourceSegment: path.relative(workshopRoot, destination).replace(/\\/g, '/'), automaticAuthority: false });
    }
  }
  function sealedManifests() {
    const items = []; if (!fs.existsSync(sealedDir)) return items;
    for (const month of fs.readdirSync(sealedDir, { withFileTypes: true })) if (month.isDirectory()) for (const name of fs.readdirSync(path.join(sealedDir, month.name))) if (name.endsWith('.manifest.json')) { const item = loadJson(path.join(sealedDir, month.name, name), null); if (item) items.push(item); }
    return items.sort((a, b) => String(b.sealedAt).localeCompare(String(a.sealedAt)));
  }
  function status() {
    flushTelemetry(); const sealed = sealedManifests(), buckets = Object.values(telemetry.buckets).sort((a, b) => b.count - a.count), policy = loadJson(policyFile, {});
    return { schema: SCHEMA, checkedAt: now(), principle: policy.principle, root: path.relative(workshopRoot, root).replace(/\\/g, '/'), currentSession: session ? { id: session.id, openedAt: session.openedAt, events: session.events, bytes: session.bytes, summary: clone(session.summary) } : null, sealedSessions: sealed.length, sealedEvents: sealed.reduce((sum, item) => sum + Number(item.events || 0), 0), legacySources: Object.keys(legacy.sources).length, telemetry: { buckets: buckets.length, observations: buckets.reduce((sum, item) => sum + item.count, 0), top: buckets.slice(0, 12).map(item => ({ source: item.source, type: item.type, count: item.count, firstAt: item.firstAt, lastAt: item.lastAt, lastDigest: item.lastDigest })) }, classifications: policy.classes, mirrorJournalMigrated: false, automaticDeletion: false, packages: packageRetentionPlan(workshopRoot) };
  }
  function tailForSource(file, maxBytes) {
    flushTelemetry(); const source = sourceId(file), limit = Math.max(1024, Math.min(200000, Number(maxBytes) || 50000)), parts = [];
    if (fs.existsSync(file)) parts.push(readTail(file, Math.floor(limit / 2)));
    const exact = (recent.sources[source] || []).map(item => JSON.stringify(item)).join('\n'); if (exact) parts.push(exact + '\n');
    const rollups = Object.values(telemetry.buckets).filter(item => item.source === source).map(item => JSON.stringify({ schema: SCHEMA, evidenceClass: 'TELEMETRY_ROLLUP', source, type: item.type, count: item.count, firstAt: item.firstAt, lastAt: item.lastAt, firstDigest: item.firstDigest, lastDigest: item.lastDigest, lastSample: item.lastSample })).join('\n'); if (rollups) parts.push(rollups + '\n');
    const joined = parts.join(''); return Buffer.from(joined).subarray(Math.max(0, Buffer.byteLength(joined) - limit)).toString('utf8');
  }
  recoverOpen(); adoptExistingLegacy();
  return { record, seal, status, tailForSource, classify, policyFile, root, stateRoot, packageRetentionPlan: () => packageRetentionPlan(workshopRoot) };
}

function forStateRoot(stateRoot, options) {
  const key = path.resolve(stateRoot); if (!managers.has(key)) managers.set(key, create(Object.assign({}, options, { stateRoot: key })));
  return managers.get(key);
}
function recordForFile(file, value) {
  if (isNativeLedger(file)) return null;
  const stateRoot = findStateRoot(file); if (!stateRoot) return null;
  return forStateRoot(stateRoot).record(file, value);
}
function tailForFile(file, maxBytes) {
  const stateRoot = findStateRoot(file); return stateRoot ? forStateRoot(stateRoot).tailForSource(file, maxBytes) : readTail(file, maxBytes);
}
function closeAll(reason) { const results = []; for (const manager of managers.values()) results.push(manager.seal(reason || 'process-stop')); return results; }
function resetForTests() { closeAll('test-reset'); managers.clear(); }

module.exports = { SCHEMA, classify, findStateRoot, isNativeLedger, create, forStateRoot, recordForFile, tailForFile, closeAll, resetForTests, packageRetentionPlan };
