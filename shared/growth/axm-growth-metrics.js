'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEXT_EXT = new Set(['.js', '.cjs', '.mjs', '.html', '.css', '.json', '.md', '.txt', '.bat', '.cmd', '.ps1', '.svg', '.csv', '.tsv', '.xml', '.yml', '.yaml']);
const EXCLUDED = new Set(['.git', 'node_modules', 'exports', 'backups', 'logs', 'state', 'local-data', '.cache', 'coverage']);
const METRIC_KEYS = ['totalFiles', 'textFiles', 'binaryFiles', 'characters', 'lines', 'bytes', 'modules', 'games', 'tests', 'codeFiles', 'codeLines', 'testLines', 'documentLines', 'otherTextLines', 'assetFiles', 'assetBytes'];
const VELOCITY_KEYS = ['codeLines', 'testLines', 'documentLines', 'otherTextLines', 'assetFiles', 'assetBytes'];
const DEFAULT_SCHEDULE = Object.freeze({ enabled: true, localTime: '05:00', lastCaptureDate: null, lastCapturedAt: null });
const CODE_EXT = new Set(['.js', '.cjs', '.mjs', '.html', '.css', '.ps1', '.bat', '.cmd']);
const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.wav', '.mp3', '.ogg', '.mp4', '.webm', '.obj', '.gltf', '.glb', '.mtlx', '.pdf', '.dxf', '.ktx2']);

function activityKind(rel, ext) {
  if (/(^|\/)(selftest|.*-test|.*\.test|.*\.spec)\.(js|cjs|mjs)$/.test(rel)) return 'tests';
  if (ASSET_EXT.has(ext)) return 'assets';
  if (CODE_EXT.has(ext)) return 'code';
  if (['.md','.txt','.csv','.tsv','.json','.xml','.yml','.yaml'].includes(ext)) return 'documents';
  return 'other';
}

function walk(root) {
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDED.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && path.extname(entry.name).toLowerCase() !== '.log') files.push(full);
    }
  }
  visit(root);
  return files;
}

function scan(root) {
  const files = walk(root);
  let bytes = 0, textFiles = 0, binaryFiles = 0, characters = 0, lines = 0, modules = 0, games = 0, tests = 0;
  let codeFiles = 0, codeLines = 0, testLines = 0, documentLines = 0, otherTextLines = 0, assetFiles = 0, assetBytes = 0;
  const extensions = {}, largest = [], activityNow = Date.now(), hourMs = 3600000, hourlyMap = {}, latest = [];
  for (let offset = 23; offset >= 0; offset--) { const start = Math.floor((activityNow - offset * hourMs) / hourMs) * hourMs; hourlyMap[start] = { startedAt:new Date(start).toISOString(), files:0, code:0, assets:0, tests:0, documents:0, other:0, bytesCurrent:0, linesCurrent:0 }; }
  for (const file of files) {
    const stat = fs.statSync(file), rel = path.relative(root, file).replace(/\\/g, '/'), ext = path.extname(file).toLowerCase() || '(none)', kind = activityKind(rel, ext);
    let fileLines = 0;
    bytes += stat.size;
    extensions[ext] = (extensions[ext] || 0) + 1;
    if (/(^|\/)tools\/[^/]+\/manifest\.json$/.test(rel) && !rel.includes('/_')) modules++;
    if (/(^|\/)tools\/game-hub\/game-library\/[^/]+\/game\.manifest\.json$/.test(rel)) games++;
    if (/(^|\/)(selftest|.*-test|.*\.test|.*\.spec)\.(js|cjs|mjs)$/.test(rel)) tests++;
    if (kind === 'code') codeFiles++;
    if (kind === 'assets') { assetFiles++; assetBytes += stat.size; }
    if (TEXT_EXT.has(ext) && stat.size <= 10 * 1024 * 1024) {
      let text = '';
      try { text = fs.readFileSync(file, 'utf8'); } catch (_) {}
      textFiles++;
      characters += text.length;
      fileLines = text ? text.split(/\r?\n/).length : 0;
      lines += fileLines;
      if (kind === 'code') codeLines += fileLines;
      else if (kind === 'tests') testLines += fileLines;
      else if (kind === 'documents') documentLines += fileLines;
      else otherTextLines += fileLines;
    } else binaryFiles++;
    largest.push({ file: rel, bytes: stat.size });
    const modifiedMs = Math.floor(stat.mtimeMs), hour = Math.floor(modifiedMs / hourMs) * hourMs;
    if (hourlyMap[hour]) { const bucket = hourlyMap[hour]; bucket.files++; bucket[kind]++; bucket.bytesCurrent += stat.size; bucket.linesCurrent += fileLines; latest.push({ file:rel, kind, modifiedAt:new Date(modifiedMs).toISOString(), bytes:stat.size, linesCurrent:fileLines }); }
  }
  largest.sort((a, b) => b.bytes - a.bytes);
  latest.sort((a,b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
  const hourly = Object.values(hourlyMap).sort((a,b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)), lastHour = { files:0, code:0, assets:0, tests:0, documents:0, other:0, bytesCurrent:0, linesCurrent:0 };
  latest.filter(item => Date.parse(item.modifiedAt) >= activityNow - hourMs).forEach(item => { lastHour.files++; lastHour[item.kind]++; lastHour.bytesCurrent += item.bytes; lastHour.linesCurrent += item.linesCurrent; });
  const measured = { measurementVersion:3, scope: 'active-workshop-source', excluded: Array.from(EXCLUDED), totalFiles: files.length, textFiles, binaryFiles, characters, lines, bytes, modules, games, tests, codeFiles, codeLines, testLines, documentLines, otherTextLines, assetFiles, assetBytes, extensions, largest: largest.slice(0, 8), activity: { windowHours:24, lastHour, hourly, latest:latest.slice(0,16), truth:{ filesystemModificationSignal:true, completedWorkClaim:false, linesCurrentInTouchedFilesNotLinesAdded:true, verifiedGoalCompletionSeparate:true } }, measuredAt: new Date(activityNow).toISOString() };
  measured.fingerprint = crypto.createHash('sha256').update(JSON.stringify({ totalFiles: measured.totalFiles, characters: measured.characters, lines: measured.lines, bytes: measured.bytes, modules, games, tests, codeLines, testLines, assetFiles, assetBytes })).digest('hex').slice(0, 16);
  return measured;
}

function cleanText(value, fallback, max) {
  const text = String(value == null ? fallback : value).replace(/[<>\r\n]/g, ' ').trim().slice(0, max);
  return text || fallback;
}

function validTime(value) {
  const text = String(value || '');
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : DEFAULT_SCHEDULE.localTime;
}

function normalizeSchedule(value) {
  value = value && typeof value === 'object' ? value : {};
  return {
    enabled: value.enabled !== false,
    localTime: validTime(value.localTime),
    lastCaptureDate: /^\d{4}-\d{2}-\d{2}$/.test(String(value.lastCaptureDate || '')) ? value.lastCaptureDate : null,
    lastCapturedAt: value.lastCapturedAt ? String(value.lastCapturedAt).slice(0, 40) : null,
    updatedAt: value.updatedAt ? String(value.updatedAt).slice(0, 40) : null,
    updatedBy: value.updatedBy ? cleanText(value.updatedBy, 'local-user', 80) : null
  };
}

function compactSnapshot(value) {
  value = value && typeof value === 'object' ? value : {};
  const snapshot = {
    id: cleanText(value.id, `growth-${Date.now().toString(36)}`, 100),
    label: cleanText(value.label, 'Workshop snapshot', 100),
    actor: cleanText(value.actor, 'local-human', 80),
    capturedAt: String(value.capturedAt || value.measuredAt || new Date().toISOString()).slice(0, 40),
    scope: 'active-workshop-source',
    fingerprint: cleanText(value.fingerprint, 'missing-fingerprint', 80),
    measurementVersion: Number(value.measurementVersion || 1)
  };
  METRIC_KEYS.forEach(key => { snapshot[key] = Number(value[key] || 0); });
  return snapshot;
}

function compactVelocitySample(value) {
  value = value && typeof value === 'object' ? value : {};
  const sample = { sampledAt: String(value.sampledAt || value.measuredAt || new Date().toISOString()).slice(0, 40), measurementVersion: 3 };
  VELOCITY_KEYS.forEach(key => { sample[key] = Number(value[key] || 0); });
  return sample;
}

function state(input) {
  input = input && typeof input === 'object' ? input : {};
  return {
    schema: 'axm.workshop-growth/v3',
    version: 3,
    schedule: normalizeSchedule(input.schedule),
    snapshots: (Array.isArray(input.snapshots) ? input.snapshots : []).filter(item => item && item.fingerprint).map(compactSnapshot).slice(-365),
    velocitySamples: (Array.isArray(input.velocitySamples) ? input.velocitySamples : []).filter(item => item && item.sampledAt).map(compactVelocitySample).sort((a,b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt)).slice(-744)
  };
}

function recordVelocity(input, metrics, options) {
  const out = state(input), settings = options && typeof options === 'object' ? options : {};
  const sampledAt = String(settings.sampledAt || metrics.measuredAt || new Date().toISOString()).slice(0, 40), last = out.velocitySamples[out.velocitySamples.length - 1] || null;
  const minimumMinutes = Math.max(1, Number(settings.minimumMinutes || 15));
  if (last && Date.parse(sampledAt) - Date.parse(last.sampledAt) < minimumMinutes * 60000) return { state:out, sample:last, duplicate:true };
  const sample = compactVelocitySample(Object.assign({}, metrics, { sampledAt }));
  out.velocitySamples.push(sample); out.velocitySamples = out.velocitySamples.slice(-744);
  return { state:out, sample, duplicate:false };
}

function velocity(current, samples, at) {
  const now = Date.parse(at || current.measuredAt || new Date().toISOString()), rows = (Array.isArray(samples) ? samples : []).map(compactVelocitySample).filter(item => Date.parse(item.sampledAt) < now).sort((a,b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt));
  if (!rows.length) return { ready:false, reason:'A local aggregate baseline has been started; a second sample is needed.', sampleCount:0, automaticLocalAggregateOnly:true };
  const withinHour = rows.filter(item => Date.parse(item.sampledAt) >= now - 3600000), baseline = withinHour[0] || rows[rows.length - 1], elapsedHours = Math.max(1 / 60, (now - Date.parse(baseline.sampledAt)) / 3600000), out = { ready:true, baselineAt:baseline.sampledAt, measuredAt:new Date(now).toISOString(), elapsedHours, sampleCount:rows.length, automaticLocalAggregateOnly:true };
  VELOCITY_KEYS.forEach(key => { const change = Number(current[key] || 0) - Number(baseline[key] || 0); out[key + 'Delta'] = change; out[key + 'PerHour'] = change / elapsedHours; });
  out.truth = 'Net aggregate change per elapsed hour from local line-count samples; deletions reduce the result, source contents are never stored, and this is not typing speed or proof of completion.';
  return out;
}

function hourlyVelocity(current, samples, at) {
  const now = Date.parse(at || current.measuredAt || new Date().toISOString()), hourMs = 3600000, start = Math.floor((now - 23 * hourMs) / hourMs) * hourMs, buckets = [];
  for (let offset=0; offset<24; offset++) buckets.push({ startedAt:new Date(start + offset * hourMs).toISOString(), codeLines:0, testLines:0, assets:0, measured:false });
  const points = (Array.isArray(samples) ? samples : []).map(compactVelocitySample).filter(item => { const time=Date.parse(item.sampledAt); return time >= start - hourMs && time < now; }).sort((a,b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt));
  points.push(compactVelocitySample(Object.assign({}, current, { sampledAt:new Date(now).toISOString() })));
  for (let index=1; index<points.length; index++) { const before=points[index-1], after=points[index], bucketIndex=Math.floor((Date.parse(after.sampledAt)-start)/hourMs); if(bucketIndex<0||bucketIndex>=buckets.length)continue; const bucket=buckets[bucketIndex]; bucket.codeLines += Number(after.codeLines||0)-Number(before.codeLines||0); bucket.testLines += Number(after.testLines||0)-Number(before.testLines||0); bucket.assets += Number(after.assetFiles||0)-Number(before.assetFiles||0); bucket.measured=true; }
  return buckets;
}

function configureSchedule(input, patch) {
  const out = state(input);
  patch = patch && typeof patch === 'object' ? patch : {};
  out.schedule = normalizeSchedule(Object.assign({}, out.schedule, {
    enabled: patch.enabled !== false,
    localTime: validTime(patch.localTime || out.schedule.localTime),
    updatedAt: new Date().toISOString(),
    updatedBy: cleanText(patch.updatedBy, 'local-user', 80)
  }));
  return out;
}

function capture(input, metrics, label, actor, options) {
  const out = state(input), prior = out.snapshots[out.snapshots.length - 1];
  options = options && typeof options === 'object' ? options : {};
  if (!options.allowDuplicateFingerprint && prior && prior.fingerprint === metrics.fingerprint) return { state: out, snapshot: prior, duplicate: true };
  const capturedAt = String(options.capturedAt || new Date().toISOString()).slice(0, 40);
  const snap = compactSnapshot(Object.assign({}, metrics, {
    id: `growth-${Date.now().toString(36)}`,
    label: cleanText(label, 'Workshop snapshot', 100),
    actor: cleanText(actor, 'local-human', 80),
    capturedAt
  }));
  out.snapshots.push(snap);
  out.snapshots = out.snapshots.slice(-365);
  if (options.scheduleDate) {
    out.schedule.lastCaptureDate = String(options.scheduleDate).slice(0, 10);
    out.schedule.lastCapturedAt = capturedAt;
  }
  return { state: out, snapshot: snap, duplicate: false };
}

function delta(current, baseline) {
  const out = {};
  METRIC_KEYS.forEach(key => { out[key] = Number(current && current[key] || 0) - Number(baseline && baseline[key] || 0); });
  return out;
}

module.exports = { TEXT_EXT, CODE_EXT, ASSET_EXT, EXCLUDED, METRIC_KEYS, VELOCITY_KEYS, DEFAULT_SCHEDULE, scan, state, capture, delta, configureSchedule, compactSnapshot, compactVelocitySample, recordVelocity, velocity, hourlyVelocity, validTime, activityKind };
