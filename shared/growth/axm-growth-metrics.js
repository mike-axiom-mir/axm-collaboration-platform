'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEXT_EXT = new Set(['.js', '.cjs', '.mjs', '.html', '.css', '.json', '.md', '.txt', '.bat', '.cmd', '.ps1', '.svg', '.csv', '.tsv', '.xml', '.yml', '.yaml']);
const EXCLUDED = new Set(['.git', 'node_modules', 'exports', 'backups', 'logs', 'state', 'local-data', '.cache', 'coverage']);
const COMPONENT_KEYS = ['hands', 'schemas', 'protocols', 'validators'];
const METRIC_KEYS = ['totalFiles', 'textFiles', 'binaryFiles', 'characters', 'lines', 'bytes', 'modules', 'worlds', 'games', 'tests', 'hands', 'schemas', 'protocols', 'validators', 'exactCapabilities', 'capabilityDeclarations', 'codeFiles', 'codeLines', 'testLines', 'documentLines', 'otherTextLines', 'assetFiles', 'assetBytes'];
const MIRROR_METRIC_KEYS = ['totalFiles', 'bytes', 'bodyFiles', 'bodyBytes', 'characters', 'lines', 'stateFiles', 'stateBytes', 'substrateFiles', 'substrateBytes', 'historyFiles', 'historyBytes', 'outputFiles', 'outputBytes', 'logFiles', 'logBytes', 'modules', 'organs', 'tests', 'contracts', 'trainingFiles', 'specializationCount'];
const VELOCITY_KEYS = ['codeLines', 'testLines', 'documentLines', 'otherTextLines', 'assetFiles', 'assetBytes'];
const DEFAULT_SCHEDULE = Object.freeze({ enabled: true, localTime: '05:00', lastCaptureDate: null, lastCapturedAt: null });
const SNAPSHOT_RETENTION = 'all-compact-history';
const CODE_EXT = new Set(['.js', '.cjs', '.mjs', '.html', '.css', '.ps1', '.bat', '.cmd']);
const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.wav', '.mp3', '.ogg', '.mp4', '.webm', '.obj', '.gltf', '.glb', '.mtlx', '.pdf', '.dxf', '.ktx2']);

function activityKind(rel, ext) {
  if (/(^|\/)(selftest|.*-test|.*\.test|.*\.spec)\.(js|cjs|mjs)$/.test(rel)) return 'tests';
  if (ASSET_EXT.has(ext)) return 'assets';
  if (CODE_EXT.has(ext)) return 'code';
  if (['.md','.txt','.csv','.tsv','.json','.xml','.yml','.yaml'].includes(ext)) return 'documents';
  return 'other';
}

function componentKind(rel, ext) {
  const name = path.basename(rel, ext).toLowerCase();
  if (/^shared\/asset-hands\/hands\/[^/]+\.js$/.test(rel) || /^shared\/ai-native-hands\/[^/]+-hand\.js$/.test(rel)) return 'hands';
  if (/\.schema\.json$/.test(rel) || (ext === '.json' && /\/(?:schema|schemas)\//.test('/' + rel))) return 'schemas';
  if (['.js', '.cjs', '.mjs', '.json', '.md'].includes(ext) && /(^|[-_.])protocols?($|[-_.])/.test(name)) return 'protocols';
  if (['.js', '.cjs', '.mjs', '.py', '.ps1'].includes(ext) && /(validator|verifier|verification)/.test(name) && !/(selftest|test|spec)/.test(name)) return 'validators';
  return null;
}

function scanCapabilities(root) {
  const toolsRoot = path.join(root, 'tools'), exact = new Set();
  let declarations = 0;
  if (!fs.existsSync(toolsRoot)) return { exactCapabilities:0, capabilityDeclarations:0 };
  fs.readdirSync(toolsRoot, { withFileTypes:true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_')).forEach(function (entry) {
    try {
      const moduleRoot = path.join(toolsRoot, entry.name), manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'manifest.json'), 'utf8'));
      const contractFile = manifest.contract && path.join(moduleRoot, manifest.contract);
      const contract = contractFile && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
      const provided = Array.from(new Set([].concat(contract.provides || [], manifest.produces || []).map(item => String(item || '').trim()).filter(Boolean)));
      declarations += provided.length;
      provided.forEach(capability => exact.add(capability));
    } catch (_) {}
  });
  return { exactCapabilities:exact.size, capabilityDeclarations:declarations };
}

function compactModuleFingerprints(value) {
  const source = value && typeof value === 'object' ? value : {};
  const output = {};
  Object.keys(source).sort().slice(0, 1000).forEach(function (id) {
    const safeId = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 100);
    const digest = String(source[id] || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 32).toLowerCase();
    if (safeId && digest) output[safeId] = digest;
  });
  return output;
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

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return null; }
}

function cleanId(value, fallback) {
  const id = String(value || '').replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 160);
  return id || fallback;
}

function displayFromId(value) {
  return String(value || 'Unnamed specialization').replace(/[-_.]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()).slice(0, 100);
}

function measureMirrorTree(root, readOwnedText) {
  const out = { files:0, bytes:0, textFiles:0, characters:0, lines:0 };
  if (!root || !fs.existsSync(root)) return out;
  function visit(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes:true }); } catch (_) { return; }
    entries.forEach(function (entry) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return visit(full);
      if (!entry.isFile()) return;
      let stat;
      try { stat = fs.statSync(full); } catch (_) { return; }
      out.files++;
      out.bytes += stat.size;
      const ext = path.extname(entry.name).toLowerCase();
      if (readOwnedText && TEXT_EXT.has(ext) && stat.size <= 10 * 1024 * 1024) {
        try {
          const text = fs.readFileSync(full, 'utf8');
          out.textFiles++;
          out.characters += text.length;
          out.lines += text ? text.split(/\r?\n/).length : 0;
        } catch (_) {}
      }
    });
  }
  visit(root);
  return out;
}

function mergeMeasure(target, measured) {
  ['files','bytes','textFiles','characters','lines'].forEach(key => { target[key] = Number(target[key] || 0) + Number(measured[key] || 0); });
  return target;
}

function specializationMeasure(root, descriptorFile, stateRoot) {
  let descriptor = { files:0, bytes:0 };
  if (descriptorFile && fs.existsSync(descriptorFile)) {
    try { descriptor = { files:1, bytes:fs.statSync(descriptorFile).size }; } catch (_) {}
  }
  const state = stateRoot && fs.existsSync(stateRoot) ? measureMirrorTree(stateRoot, false) : { files:0, bytes:0 };
  return { files:Number(descriptor.files || 0) + Number(state.files || 0), bytes:Number(descriptor.bytes || 0) + Number(state.bytes || 0) };
}

function mirrorSpecializations(root) {
  const rows = [], seen = new Set();
  const branchDir = path.join(root, 'lineage', 'identity-branches');
  if (fs.existsSync(branchDir)) {
    fs.readdirSync(branchDir, { withFileTypes:true }).filter(entry => entry.isFile() && /\.branch\.json$/i.test(entry.name)).forEach(function (entry) {
      const descriptorFile = path.join(branchDir, entry.name), descriptor = safeJson(descriptorFile) || {};
      const id = cleanId(descriptor.branchId, path.basename(entry.name, '.branch.json'));
      const namespace = String(descriptor.privateLogNamespace || '').replace(/\\/g, '/');
      const stateRoot = namespace && !namespace.includes('..') ? path.join(root, ...namespace.split('/')) : null;
      const measured = specializationMeasure(root, descriptorFile, stateRoot);
      rows.push({
        id,
        displayName:cleanText(descriptor.displayName, displayFromId(path.basename(entry.name, '.branch.json')), 100),
        kind:'identity-branch',
        status:cleanId(descriptor.status, 'UNKNOWN'),
        files:measured.files,
        bytes:measured.bytes,
        sharedParentCode:descriptor.codeForkCreated !== true,
        activeRuntime:descriptor.runtimeCreated === true || descriptor.activeRuntime === true,
        parentIdentity:cleanId(descriptor.forkPoint && descriptor.forkPoint.parentIdentity, 'axm.machine.mirror/seed-0')
      });
      seen.add(id);
    });
  }
  const specialistDir = path.join(root, 'state', 'ai-organ-archive', 'specialist-mirrors');
  if (fs.existsSync(specialistDir)) {
    fs.readdirSync(specialistDir, { withFileTypes:true }).filter(entry => entry.isDirectory()).forEach(function (entry) {
      const bodyRoot = path.join(specialistDir, entry.name), lineage = safeJson(path.join(bodyRoot, 'LINEAGE.json')) || {};
      const id = cleanId(lineage.branchId || lineage.specialistId, entry.name);
      if (seen.has(id)) return;
      const measured = measureMirrorTree(bodyRoot, false);
      rows.push({
        id,
        displayName:cleanText(lineage.displayName, displayFromId(lineage.specialistId || entry.name), 100),
        kind:'specialist-body',
        status:cleanId(lineage.status, 'EXPERIMENTAL'),
        files:measured.files,
        bytes:measured.bytes,
        sharedParentCode:true,
        activeRuntime:lineage.runtimeCreated === true || lineage.activeRuntime === true,
        parentIdentity:cleanId(lineage.parentIdentity, 'axm.machine.mirror/seed-0')
      });
    });
  }
  const priority = { 'Creative Mirror':0, RepairBuddy:1, 'English Learner Mirror':2 };
  return rows.sort((a,b) => (priority[a.displayName] == null ? 50 : priority[a.displayName]) - (priority[b.displayName] == null ? 50 : priority[b.displayName]) || a.displayName.localeCompare(b.displayName)).map(function (row) {
    row.fingerprint = crypto.createHash('sha256').update(JSON.stringify({ id:row.id, status:row.status, files:row.files, bytes:row.bytes })).digest('hex').slice(0, 16);
    return row;
  });
}

function scanMirror(root) {
  const measuredAt = new Date().toISOString();
  if (!root || !fs.existsSync(root)) return { schema:'axm.mirror-growth/v1', available:false, measuredAt, reason:'Mirror Native body is not installed at its configured local root.', specializations:[] };
  const buckets = {
    body:{ files:0, bytes:0, textFiles:0, characters:0, lines:0 },
    state:{ files:0, bytes:0, textFiles:0, characters:0, lines:0 },
    substrates:{ files:0, bytes:0, textFiles:0, characters:0, lines:0 },
    history:{ files:0, bytes:0, textFiles:0, characters:0, lines:0 },
    outputs:{ files:0, bytes:0, textFiles:0, characters:0, lines:0 },
    logs:{ files:0, bytes:0, textFiles:0, characters:0, lines:0 }
  };
  const category = function (name) {
    if (name === 'substrates') return 'substrates';
    if (name === 'state' || name === 'runtime') return 'state';
    if (name === '.git') return 'history';
    if (name === 'exports') return 'outputs';
    if (name === 'logs') return 'logs';
    return 'body';
  };
  fs.readdirSync(root, { withFileTypes:true }).forEach(function (entry) {
    const bucket = category(entry.name), full = path.join(root, entry.name);
    if (entry.isDirectory()) mergeMeasure(buckets[bucket], measureMirrorTree(full, bucket === 'body'));
    else if (entry.isFile()) {
      let stat;
      try { stat = fs.statSync(full); } catch (_) { return; }
      const single = { files:1, bytes:stat.size, textFiles:0, characters:0, lines:0 }, ext = path.extname(entry.name).toLowerCase();
      if (bucket === 'body' && TEXT_EXT.has(ext) && stat.size <= 10 * 1024 * 1024) {
        try { const text = fs.readFileSync(full, 'utf8'); single.textFiles=1; single.characters=text.length; single.lines=text ? text.split(/\r?\n/).length : 0; } catch (_) {}
      }
      mergeMeasure(buckets[bucket], single);
    }
  });
  const totalFiles = Object.values(buckets).reduce((sum, item) => sum + item.files, 0), bytes = Object.values(buckets).reduce((sum, item) => sum + item.bytes, 0);
  const countFiles = function (dir, predicate) {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    (function visit(folder) { fs.readdirSync(folder, { withFileTypes:true }).forEach(function (entry) { const full=path.join(folder,entry.name); if(entry.isDirectory())visit(full); else if(entry.isFile() && predicate(entry.name, full))count++; }); }(dir));
    return count;
  };
  const directDirs = function (dir) { return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes:true }).filter(entry => entry.isDirectory()).length : 0; };
  const specializations = mirrorSpecializations(root);
  const out = {
    schema:'axm.mirror-growth/v1', available:true, measurementVersion:1, measuredAt,
    scope:'installed-mirror-family-local-metadata',
    totalFiles, bytes,
    bodyFiles:buckets.body.files, bodyBytes:buckets.body.bytes, characters:buckets.body.characters, lines:buckets.body.lines,
    stateFiles:buckets.state.files, stateBytes:buckets.state.bytes,
    substrateFiles:buckets.substrates.files, substrateBytes:buckets.substrates.bytes,
    historyFiles:buckets.history.files, historyBytes:buckets.history.bytes,
    outputFiles:buckets.outputs.files, outputBytes:buckets.outputs.bytes,
    logFiles:buckets.logs.files, logBytes:buckets.logs.bytes,
    modules:directDirs(path.join(root, 'modules')),
    organs:countFiles(path.join(root, 'organs'), name => /\.js$/i.test(name)),
    tests:countFiles(path.join(root, 'tests'), name => /(?:test|spec)\.js$/i.test(name)),
    contracts:countFiles(path.join(root, 'contracts'), name => /\.json$/i.test(name)),
    trainingFiles:countFiles(path.join(root, 'training'), () => true),
    specializationCount:specializations.length,
    specializations,
    boundaries:{ sourceContentsRetained:false, absolutePathExposed:false, privateStateContentsRead:false, privateStateMetadataRead:true, sharedParentCodeCountedOnce:true, specializationFootprintsStateAndDescriptorOnly:true }
  };
  out.fingerprint = crypto.createHash('sha256').update(JSON.stringify(MIRROR_METRIC_KEYS.reduce((memo,key) => { memo[key]=out[key]; return memo; }, { specializations:specializations.map(item => [item.id,item.fingerprint]) }))).digest('hex').slice(0, 16);
  return out;
}

function attachMirror(metrics, mirror) {
  const out = Object.assign({}, metrics, { measurementVersion:7, mirror:mirror || null });
  out.fingerprint = crypto.createHash('sha256').update(JSON.stringify({ workshop:metrics.fingerprint, mirror:mirror && mirror.fingerprint || null })).digest('hex').slice(0, 16);
  return out;
}

function scan(root) {
  const files = walk(root);
  let bytes = 0, textFiles = 0, binaryFiles = 0, characters = 0, lines = 0, modules = 0, worlds = 0, games = 0, tests = 0;
  let hands = 0, creationHands = 0, aiNativeHands = 0, schemas = 0, protocols = 0, validators = 0;
  let codeFiles = 0, codeLines = 0, testLines = 0, documentLines = 0, otherTextLines = 0, assetFiles = 0, assetBytes = 0;
  const extensions = {}, largest = [], activityNow = Date.now(), hourMs = 3600000, hourlyMap = {}, latest = [], moduleIds = new Set(), moduleParts = {}, worldIds = new Set(), worldParts = {};
  for (let offset = 23; offset >= 0; offset--) { const start = Math.floor((activityNow - offset * hourMs) / hourMs) * hourMs; hourlyMap[start] = { startedAt:new Date(start).toISOString(), files:0, code:0, assets:0, tests:0, documents:0, other:0, bytesCurrent:0, linesCurrent:0 }; }
  for (const file of files) {
    const stat = fs.statSync(file), rel = path.relative(root, file).replace(/\\/g, '/'), ext = path.extname(file).toLowerCase() || '(none)', kind = activityKind(rel, ext);
    let fileLines = 0;
    bytes += stat.size;
    extensions[ext] = (extensions[ext] || 0) + 1;
    const moduleManifest = /^tools\/([^/]+)\/manifest\.json$/.exec(rel);
    if (moduleManifest && moduleManifest[1][0] !== '_') { modules++; moduleIds.add(moduleManifest[1]); }
    const worldManifest = /^worlds\/([^/]+)\/world\.manifest\.json$/.exec(rel);
    if (worldManifest && worldManifest[1][0] !== '_') { worlds++; worldIds.add(worldManifest[1]); }
    if (/(^|\/)tools\/game-hub\/game-library\/[^/]+\/game\.manifest\.json$/.test(rel)) games++;
    if (/(^|\/)(selftest|.*-test|.*\.test|.*\.spec)\.(js|cjs|mjs)$/.test(rel)) tests++;
    const component = componentKind(rel, ext);
    if (component === 'hands') {
      hands++;
      if (/^shared\/asset-hands\/hands\/[^/]+\.js$/.test(rel)) creationHands++;
      else if (/^shared\/ai-native-hands\/[^/]+-hand\.js$/.test(rel)) aiNativeHands++;
    }
    else if (component === 'schemas') schemas++;
    else if (component === 'protocols') protocols++;
    else if (component === 'validators') validators++;
    const modulePath = /^tools\/([^/]+)\/(.+)$/.exec(rel);
    if (modulePath && modulePath[1][0] !== '_') {
      const record = moduleParts[modulePath[1]] || (moduleParts[modulePath[1]] = { parts: [], latestModifiedMs: 0, files: 0, bytes: 0 });
      record.parts.push(modulePath[2] + '\u0000' + stat.size + '\u0000' + Math.floor(stat.mtimeMs));
      record.latestModifiedMs = Math.max(record.latestModifiedMs, stat.mtimeMs);
      record.files++;
      record.bytes += stat.size;
    }
    const worldPath = /^worlds\/([^/]+)\/(.+)$/.exec(rel);
    if (worldPath && worldPath[1][0] !== '_') {
      const record = worldParts[worldPath[1]] || (worldParts[worldPath[1]] = { parts: [], latestModifiedMs: 0, files: 0, bytes: 0 });
      record.parts.push(worldPath[2] + '\u0000' + stat.size + '\u0000' + Math.floor(stat.mtimeMs));
      record.latestModifiedMs = Math.max(record.latestModifiedMs, stat.mtimeMs);
      record.files++;
      record.bytes += stat.size;
    }
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
  const moduleFingerprints = {}, moduleActivity = {}, worldFingerprints = {}, worldActivity = {};
  Array.from(moduleIds).sort().forEach(function (id) {
    const record = moduleParts[id] || { parts: [], latestModifiedMs: 0, files: 0, bytes: 0 };
    moduleFingerprints[id] = crypto.createHash('sha256').update(record.parts.sort().join('\n')).digest('hex').slice(0, 16);
    moduleActivity[id] = { latestModifiedAt: record.latestModifiedMs ? new Date(record.latestModifiedMs).toISOString() : null, files: record.files, bytes: record.bytes };
  });
  Array.from(worldIds).sort().forEach(function (id) {
    const record = worldParts[id] || { parts: [], latestModifiedMs: 0, files: 0, bytes: 0 };
    worldFingerprints[id] = crypto.createHash('sha256').update(record.parts.sort().join('\n')).digest('hex').slice(0, 16);
    worldActivity[id] = { latestModifiedAt: record.latestModifiedMs ? new Date(record.latestModifiedMs).toISOString() : null, files: record.files, bytes: record.bytes };
  });
  const hourly = Object.values(hourlyMap).sort((a,b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)), lastHour = { files:0, code:0, assets:0, tests:0, documents:0, other:0, bytesCurrent:0, linesCurrent:0 };
  latest.filter(item => Date.parse(item.modifiedAt) >= activityNow - hourMs).forEach(item => { lastHour.files++; lastHour[item.kind]++; lastHour.bytesCurrent += item.bytes; lastHour.linesCurrent += item.linesCurrent; });
  let sensoryAdapters = 0;
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'sensorium', 'registry.json'), 'utf8'));
    sensoryAdapters = Array.isArray(registry.senses) ? registry.senses.length : 0;
  } catch (_) {}
  const capabilityCounts = scanCapabilities(root);
  const measured = { measurementVersion:7, scope: 'active-workshop-source', excluded: Array.from(EXCLUDED), totalFiles: files.length, textFiles, binaryFiles, characters, lines, bytes, modules, worlds, games, tests, hands, handBreakdown:{ creation:creationHands, aiNative:aiNativeHands, sensoryAdapters, sensoryOverlapNote:'Sensorium Eye reuses the ephemeral-vision AI-native hand.' }, schemas, protocols, validators, exactCapabilities:capabilityCounts.exactCapabilities, capabilityDeclarations:capabilityCounts.capabilityDeclarations, codeFiles, codeLines, testLines, documentLines, otherTextLines, assetFiles, assetBytes, moduleFingerprints, moduleActivity, worldFingerprints, worldActivity, extensions, largest: largest.slice(0, 8), activity: { windowHours:24, lastHour, hourly, latest:latest.slice(0,16), truth:{ filesystemModificationSignal:true, completedWorkClaim:false, linesCurrentInTouchedFilesNotLinesAdded:true, verifiedGoalCompletionSeparate:true } }, measuredAt: new Date(activityNow).toISOString() };
  measured.fingerprint = crypto.createHash('sha256').update(JSON.stringify({ totalFiles: measured.totalFiles, characters: measured.characters, lines: measured.lines, bytes: measured.bytes, modules, worlds, games, tests, hands, schemas, protocols, validators, exactCapabilities:measured.exactCapabilities, capabilityDeclarations:measured.capabilityDeclarations, codeLines, testLines, assetFiles, assetBytes, moduleFingerprints, worldFingerprints })).digest('hex').slice(0, 16);
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
  if (snapshot.measurementVersion >= 4) snapshot.moduleFingerprints = compactModuleFingerprints(value.moduleFingerprints);
  if (snapshot.measurementVersion >= 6) snapshot.worldFingerprints = compactModuleFingerprints(value.worldFingerprints);
  if (value.mirror && value.mirror.available) snapshot.mirror = compactMirrorSnapshot(value.mirror);
  return snapshot;
}

function compactMirrorSpecialization(value) {
  value = value && typeof value === 'object' ? value : {};
  return {
    id:cleanId(value.id, 'unknown-specialization'),
    displayName:cleanText(value.displayName, displayFromId(value.id), 100),
    kind:cleanId(value.kind, 'unknown'),
    status:cleanId(value.status, 'UNKNOWN'),
    files:Number(value.files || 0),
    bytes:Number(value.bytes || 0),
    sharedParentCode:value.sharedParentCode !== false,
    activeRuntime:value.activeRuntime === true,
    fingerprint:cleanId(value.fingerprint, 'missing-fingerprint')
  };
}

function compactMirrorSnapshot(value) {
  value = value && typeof value === 'object' ? value : {};
  const snapshot = {
    schema:'axm.mirror-growth-snapshot/v1',
    available:value.available === true,
    measuredAt:String(value.measuredAt || new Date().toISOString()).slice(0, 40),
    fingerprint:cleanId(value.fingerprint, 'missing-fingerprint'),
    scope:'installed-mirror-family-local-metadata',
    specializations:(Array.isArray(value.specializations) ? value.specializations : []).map(compactMirrorSpecialization).slice(0, 100)
  };
  MIRROR_METRIC_KEYS.forEach(key => { snapshot[key] = Number(value[key] || 0); });
  return snapshot;
}

function compactVelocitySample(value) {
  value = value && typeof value === 'object' ? value : {};
  const sample = { sampledAt: String(value.sampledAt || value.measuredAt || new Date().toISOString()).slice(0, 40), measurementVersion: 4 };
  VELOCITY_KEYS.forEach(key => { sample[key] = Number(value[key] || 0); });
  return sample;
}

function state(input) {
  input = input && typeof input === 'object' ? input : {};
  return {
    schema: 'axm.workshop-growth/v7',
    version: 7,
    retention: {
      snapshots: SNAPSHOT_RETENTION,
      velocitySamples: 'rolling-744-aggregate-samples'
    },
    schedule: normalizeSchedule(input.schedule),
    snapshots: (Array.isArray(input.snapshots) ? input.snapshots : []).filter(item => item && item.fingerprint).map(compactSnapshot).sort((a,b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt)),
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
  const withinHour = rows.filter(item => Date.parse(item.sampledAt) >= now - 3600000), baseline = withinHour[0] || rows[rows.length - 1], baselineIndex = rows.indexOf(baseline), prior = baselineIndex > 0 ? rows[baselineIndex - 1] : null, gapBeforeBaselineMinutes = prior ? (Date.parse(baseline.sampledAt) - Date.parse(prior.sampledAt)) / 60000 : null, elapsedHours = Math.max(1 / 60, (now - Date.parse(baseline.sampledAt)) / 3600000), out = { ready:true, baselineAt:baseline.sampledAt, measuredAt:new Date(now).toISOString(), elapsedHours, sampleCount:rows.length, automaticLocalAggregateOnly:true, coverage:{ state:gapBeforeBaselineMinutes != null && gapBeforeBaselineMinutes > 45 ? 'RESUMED_AFTER_GAP' : 'CONTINUOUS', priorSampleAt:prior && prior.sampledAt || null, gapBeforeBaselineMinutes:gapBeforeBaselineMinutes == null ? null : Math.round(gapBeforeBaselineMinutes * 10) / 10, observedMinutes:Math.round(elapsedHours * 600) / 10 } };
  VELOCITY_KEYS.forEach(key => { const change = Number(current[key] || 0) - Number(baseline[key] || 0); out[key + 'Delta'] = change; out[key + 'PerHour'] = change / elapsedHours; });
  out.coverage.hasMeasuredChange = VELOCITY_KEYS.some(key => Number(out[key + 'Delta'] || 0) !== 0);
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

function mirrorDelta(current, baseline) {
  if (!current || current.available !== true || !baseline || baseline.available !== true) return null;
  const out = {};
  MIRROR_METRIC_KEYS.forEach(key => { out[key] = Number(current[key] || 0) - Number(baseline[key] || 0); });
  return out;
}

function mirrorSpecializationChanges(current, baseline) {
  if (!current || current.available !== true || !baseline || baseline.available !== true) return { ready:false, added:[], removed:[], updated:[] };
  const now = new Map((current.specializations || []).map(item => [item.id, item])), before = new Map((baseline.specializations || []).map(item => [item.id, item]));
  return {
    ready:true,
    added:Array.from(now.keys()).filter(id => !before.has(id)).sort(),
    removed:Array.from(before.keys()).filter(id => !now.has(id)).sort(),
    updated:Array.from(now.keys()).filter(id => before.has(id) && now.get(id).fingerprint !== before.get(id).fingerprint).sort()
  };
}

function moduleChanges(current, baseline) {
  const currentMap = compactModuleFingerprints(current && current.moduleFingerprints);
  const priorMap = compactModuleFingerprints(baseline && baseline.moduleFingerprints);
  const currentIds = Object.keys(currentMap).sort(), priorIds = Object.keys(priorMap).sort();
  if (baseline && Number(baseline.measurementVersion || 0) >= 4 && priorIds.length) {
    const added = currentIds.filter(id => !priorMap[id]);
    const removed = priorIds.filter(id => !currentMap[id]);
    const updated = currentIds.filter(id => priorMap[id] && priorMap[id] !== currentMap[id]);
    return { exact: true, mode: 'compact-module-fingerprint', added: added.length, removed: removed.length, updated: updated.length, touched: added.length + updated.length, ids: { added, removed, updated } };
  }
  const since = baseline && Date.parse(baseline.capturedAt), activity = current && current.moduleActivity || {};
  const touchedIds = Number.isFinite(since) ? Object.keys(activity).filter(function (id) { return Date.parse(activity[id] && activity[id].latestModifiedAt) > since; }).sort() : [];
  return { exact: false, mode: baseline ? 'legacy-timestamp-fallback' : 'no-baseline', added: baseline ? Math.max(0, Number(current && current.modules || 0) - Number(baseline.modules || 0)) : null, removed: baseline ? Math.max(0, Number(baseline.modules || 0) - Number(current && current.modules || 0)) : null, updated: null, touched: baseline ? touchedIds.length : null, ids: { touched: touchedIds } };
}

function worldChanges(current, baseline) {
  const currentMap = compactModuleFingerprints(current && current.worldFingerprints);
  const priorMap = compactModuleFingerprints(baseline && baseline.worldFingerprints);
  const currentIds = Object.keys(currentMap).sort(), priorIds = Object.keys(priorMap).sort();
  if (baseline && Number(baseline.measurementVersion || 0) >= 6) {
    const added = currentIds.filter(id => !priorMap[id]);
    const removed = priorIds.filter(id => !currentMap[id]);
    const updated = currentIds.filter(id => priorMap[id] && priorMap[id] !== currentMap[id]);
    return { exact:true, mode:'compact-world-fingerprint', added:added.length, removed:removed.length, updated:updated.length, touched:added.length + updated.length, ids:{ added, removed, updated } };
  }
  const since = baseline && Date.parse(baseline.capturedAt), activity = current && current.worldActivity || {};
  const touchedIds = Number.isFinite(since) ? Object.keys(activity).filter(function (id) { return Date.parse(activity[id] && activity[id].latestModifiedAt) > since; }).sort() : [];
  return { exact:false, mode:baseline ? 'legacy-timestamp-fallback' : 'no-baseline', added:baseline ? Math.max(0, Number(current && current.worlds || 0) - Number(baseline.worlds || 0)) : null, removed:baseline ? Math.max(0, Number(baseline.worlds || 0) - Number(current && current.worlds || 0)) : null, updated:null, touched:baseline ? touchedIds.length : null, ids:{ touched:touchedIds } };
}

module.exports = { TEXT_EXT, CODE_EXT, ASSET_EXT, EXCLUDED, COMPONENT_KEYS, METRIC_KEYS, MIRROR_METRIC_KEYS, VELOCITY_KEYS, DEFAULT_SCHEDULE, SNAPSHOT_RETENTION, scan, scanCapabilities, scanMirror, attachMirror, state, capture, delta, mirrorDelta, mirrorSpecializationChanges, moduleChanges, worldChanges, configureSchedule, compactSnapshot, compactMirrorSnapshot, compactVelocitySample, recordVelocity, velocity, hourlyVelocity, validTime, activityKind, componentKind };
