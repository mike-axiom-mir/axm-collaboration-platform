'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.entry-resource-closure-map/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const TAG_ATTRIBUTES = Object.freeze({
  script: ['src'],
  link: ['href'],
  img: ['src'],
  source: ['src'],
  audio: ['src'],
  video: ['src', 'poster'],
  object: ['data']
});
const LOCAL_ISSUE_STATES = new Set([
  'STATIC_LOCAL_MISSING',
  'UNSAFE_LOCAL_PATH',
  'SYMLINK_REFUSED',
  'NOT_REGULAR_FILE',
  'LOCAL_STAT_FAILED'
]);
const UNRESOLVED_STATES = new Set([
  'REMOTE_REFERENCE_NOT_FETCHED',
  'INLINE_OR_RUNTIME_SCHEME',
  'FRAGMENT_REFERENCE',
  'DYNAMIC_REFERENCE_NOT_RESOLVED',
  'ENCODED_REFERENCE_NOT_RESOLVED',
  'NON_FILE_SCHEME',
  'DOCUMENT_SELF_REFERENCE'
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

function toRelative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function cleanErrorCode(error) {
  return error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
}

function readRegularJson(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('NOT_REGULAR_JSON');
  const bytes = fs.readFileSync(file);
  return {
    value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')),
    sha256: sha256(bytes),
    bytes: bytes.length
  };
}

function hasSymlinkSegment(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return false;
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) return false;
    if (fs.lstatSync(current).isSymbolicLink()) return true;
  }
  return false;
}

function inspectEntry(moduleRoot, declared) {
  if (typeof declared !== 'string' || !declared.trim()) {
    return { declared: false, path: null, state: 'NOT_DECLARED', bytes: null, absolute: null };
  }
  const clean = declared.trim();
  if (clean.includes('\0') || clean.includes('\\')) {
    return { declared: true, path: clean, state: 'UNSAFE_PATH', bytes: null, absolute: null };
  }
  const absolute = path.resolve(moduleRoot, clean);
  if (!absolute.startsWith(moduleRoot + path.sep)) {
    return { declared: true, path: clean, state: 'UNSAFE_PATH', bytes: null, absolute: null };
  }
  if (hasSymlinkSegment(moduleRoot, absolute)) {
    return { declared: true, path: clean, state: 'SYMLINK_REFUSED', bytes: null, absolute: null };
  }
  if (!fs.existsSync(absolute)) {
    return { declared: true, path: clean, state: 'MISSING', bytes: null, absolute: null };
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile()) {
    return { declared: true, path: clean, state: 'NOT_REGULAR_FILE', bytes: null, absolute: null };
  }
  const extension = path.extname(absolute).toLowerCase();
  return {
    declared: true,
    path: clean,
    state: extension === '.html' || extension === '.htm' ? 'PRESENT_HTML' : 'PRESENT_NON_HTML',
    bytes: stat.size,
    absolute
  };
}

function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function extractStaticQuotedReferences(html) {
  const references = [];
  const tagPattern = /<(script|link|img|source|audio|video|object)\b[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(html))) {
    const tag = tagMatch[1].toLowerCase();
    const allowed = TAG_ATTRIBUTES[tag];
    const attributePattern = /(?:^|\s)(src|href|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(tagMatch[0]))) {
      const attribute = attributeMatch[1].toLowerCase();
      if (!allowed.includes(attribute)) continue;
      references.push({
        tag,
        attribute,
        raw: attributeMatch[2] === undefined ? attributeMatch[3] : attributeMatch[2],
        line: lineAt(html, tagMatch.index + attributeMatch.index)
      });
    }
  }
  return references;
}

function baseReference(reference) {
  return {
    tag: reference.tag,
    attribute: reference.attribute,
    raw: reference.raw,
    line: reference.line,
    state: null,
    resolvedPath: null,
    bytes: null
  };
}

function inspectReference(workshopRoot, entryAbsolute, reference) {
  const result = baseReference(reference);
  const clean = String(reference.raw).trim();
  if (!clean) {
    result.state = 'EMPTY_REFERENCE';
    return result;
  }
  if (clean.startsWith('#')) {
    result.state = 'FRAGMENT_REFERENCE';
    return result;
  }
  if (clean.includes('${') || clean.includes('{{') || clean.includes('<%')) {
    result.state = 'DYNAMIC_REFERENCE_NOT_RESOLVED';
    return result;
  }
  if (clean.includes('%')) {
    result.state = 'ENCODED_REFERENCE_NOT_RESOLVED';
    return result;
  }
  if (/^(?:data|blob):/i.test(clean)) {
    result.state = 'INLINE_OR_RUNTIME_SCHEME';
    return result;
  }
  if (/^(?:https?:)?\/\//i.test(clean)) {
    result.state = 'REMOTE_REFERENCE_NOT_FETCHED';
    return result;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    result.state = 'NON_FILE_SCHEME';
    return result;
  }
  if (clean.includes('\\') || clean.includes('\0')) {
    result.state = 'UNSAFE_LOCAL_PATH';
    return result;
  }

  const separator = clean.search(/[?#]/);
  const localPath = separator === -1 ? clean : clean.slice(0, separator);
  if (!localPath) {
    result.state = 'DOCUMENT_SELF_REFERENCE';
    return result;
  }
  const absolute = localPath.startsWith('/')
    ? path.resolve(workshopRoot, localPath.slice(1))
    : path.resolve(path.dirname(entryAbsolute), localPath);
  if (absolute !== workshopRoot && !absolute.startsWith(workshopRoot + path.sep)) {
    result.state = 'UNSAFE_LOCAL_PATH';
    return result;
  }
  result.resolvedPath = toRelative(workshopRoot, absolute) || '.';
  try {
    if (hasSymlinkSegment(workshopRoot, absolute)) {
      result.state = 'SYMLINK_REFUSED';
      return result;
    }
    if (!fs.existsSync(absolute)) {
      result.state = 'STATIC_LOCAL_MISSING';
      return result;
    }
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile()) {
      result.state = 'NOT_REGULAR_FILE';
      return result;
    }
    result.state = 'STATIC_LOCAL_PRESENT';
    result.bytes = stat.size;
    return result;
  } catch (error) {
    result.state = 'LOCAL_STAT_FAILED';
    result.errorCode = cleanErrorCode(error);
    return result;
  }
}

function summarizeReferences(references) {
  return {
    total: references.length,
    localPresent: references.filter(item => item.state === 'STATIC_LOCAL_PRESENT').length,
    localMissing: references.filter(item => item.state === 'STATIC_LOCAL_MISSING').length,
    localSafetyHolds: references.filter(item => [
      'UNSAFE_LOCAL_PATH', 'SYMLINK_REFUSED', 'NOT_REGULAR_FILE', 'LOCAL_STAT_FAILED'
    ].includes(item.state)).length,
    unresolvedExternalOrRuntime: references.filter(item => UNRESOLVED_STATES.has(item.state)).length,
    empty: references.filter(item => item.state === 'EMPTY_REFERENCE').length
  };
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('Workshop root must be a regular non-symlink directory');
  }
  const toolsRoot = path.join(root, 'tools');
  const toolsStat = fs.lstatSync(toolsRoot);
  if (!toolsStat.isDirectory() || toolsStat.isSymbolicLink()) {
    throw new Error('tools root must be a regular non-symlink directory');
  }

  const modules = [];
  const sourceFiles = [];
  const skippedSymlinks = [];
  const readIssues = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    if (entry.isSymbolicLink()) {
      skippedSymlinks.push('tools/' + entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const moduleRoot = path.join(toolsRoot, entry.name);
    const manifestPath = path.join(moduleRoot, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    let loaded;
    try {
      loaded = readRegularJson(manifestPath);
    } catch (error) {
      readIssues.push({
        path: 'tools/' + entry.name + '/manifest.json',
        code: 'MANIFEST_READ_FAILED',
        detail: cleanErrorCode(error)
      });
      continue;
    }
    sourceFiles.push({
      path: 'tools/' + entry.name + '/manifest.json',
      sha256: loaded.sha256,
      bytes: loaded.bytes
    });
    const manifest = loaded.value;
    const moduleId = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : entry.name;
    const inspectedEntry = inspectEntry(moduleRoot, manifest.entry);
    const entryRecord = {
      declared: inspectedEntry.declared,
      path: inspectedEntry.path,
      state: inspectedEntry.state,
      bytes: inspectedEntry.bytes,
      sha256: null,
      markupParsed: false
    };
    let references = [];
    if (inspectedEntry.state === 'PRESENT_HTML') {
      try {
        const bytes = fs.readFileSync(inspectedEntry.absolute);
        const html = bytes.toString('utf8');
        entryRecord.sha256 = sha256(bytes);
        entryRecord.bytes = bytes.length;
        entryRecord.markupParsed = true;
        sourceFiles.push({
          path: toRelative(root, inspectedEntry.absolute),
          sha256: entryRecord.sha256,
          bytes: entryRecord.bytes
        });
        references = extractStaticQuotedReferences(html)
          .map(reference => inspectReference(root, inspectedEntry.absolute, reference))
          .sort((left, right) => (
            left.line - right.line
            || left.tag.localeCompare(right.tag)
            || left.attribute.localeCompare(right.attribute)
            || left.raw.localeCompare(right.raw)
          ));
      } catch (error) {
        entryRecord.state = 'HTML_READ_FAILED';
        entryRecord.markupParsed = false;
        readIssues.push({
          path: 'tools/' + entry.name + '/' + inspectedEntry.path,
          code: 'ENTRY_HTML_READ_FAILED',
          detail: cleanErrorCode(error)
        });
      }
    }
    const moduleSummary = summarizeReferences(references);
    modules.push({
      id: moduleId,
      folder: entry.name,
      version: typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN',
      status: typeof manifest.status === 'string' ? manifest.status : 'UNKNOWN',
      manifestSha256: loaded.sha256,
      entry: entryRecord,
      references,
      summary: Object.assign({}, moduleSummary, {
        hasLocalIssues: references.some(item => LOCAL_ISSUE_STATES.has(item.state))
      })
    });
  }

  modules.sort((left, right) => left.id.localeCompare(right.id));
  sourceFiles.sort((left, right) => left.path.localeCompare(right.path));
  skippedSymlinks.sort();
  readIssues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0 ? Math.floor(options.ttlMs) : DEFAULT_TTL_MS;
  const allReferences = modules.flatMap(module => module.references);
  const fingerprintMaterial = { sourceFiles, skippedSymlinks, readIssues, modules };
  return {
    schema: SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(root),
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      filesRead: sourceFiles.length,
      fingerprintBasis: 'manifest and declared HTML entry hashes plus static quoted reference states and metadata',
      symlinksFollowed: false,
      skippedSymlinks
    },
    summary: {
      modules: modules.length,
      entriesPresentHtml: modules.filter(module => module.entry.state === 'PRESENT_HTML').length,
      entriesUnavailableOrNonHtml: modules.filter(module => module.entry.state !== 'PRESENT_HTML').length,
      modulesWithReferences: modules.filter(module => module.references.length).length,
      modulesWithLocalIssues: modules.filter(module => module.summary.hasLocalIssues).length,
      totalReferences: allReferences.length,
      localPresent: allReferences.filter(item => item.state === 'STATIC_LOCAL_PRESENT').length,
      localMissing: allReferences.filter(item => item.state === 'STATIC_LOCAL_MISSING').length,
      localSafetyHolds: allReferences.filter(item => [
        'UNSAFE_LOCAL_PATH', 'SYMLINK_REFUSED', 'NOT_REGULAR_FILE', 'LOCAL_STAT_FAILED'
      ].includes(item.state)).length,
      remoteNotFetched: allReferences.filter(item => item.state === 'REMOTE_REFERENCE_NOT_FETCHED').length,
      inlineOrRuntime: allReferences.filter(item => item.state === 'INLINE_OR_RUNTIME_SCHEME').length,
      fragments: allReferences.filter(item => item.state === 'FRAGMENT_REFERENCE').length,
      dynamicNotResolved: allReferences.filter(item => item.state === 'DYNAMIC_REFERENCE_NOT_RESOLVED').length,
      encodedNotResolved: allReferences.filter(item => item.state === 'ENCODED_REFERENCE_NOT_RESOLVED').length,
      otherUnresolved: allReferences.filter(item => [
        'NON_FILE_SCHEME', 'DOCUMENT_SELF_REFERENCE'
      ].includes(item.state)).length,
      emptyReferences: allReferences.filter(item => item.state === 'EMPTY_REFERENCE').length,
      readIssues: readIssues.length
    },
    modules,
    readIssues,
    scopeBoundary: 'Only static quoted src, href, poster, and data attributes on a finite set of tags in each manifest-declared HTML entry are parsed. Local targets are presence-checked without reading their bodies. CSS imports, srcset, dynamic JavaScript references, network resources, browser loading, rendering, and execution remain outside this map.',
    preservedOwners: {
      doorDeclarationAndPresence: 'Dual Door Observatory',
      browserRuntimeAndVisualJudgment: 'Browser, LAN and Hardware QA Lab',
      inlineScriptSyntax: 'Workshop HTML script syntax test',
      networkRetrieval: 'Source Connector and explicit network owners',
      readiness: 'Technical Glasses'
    },
    truth: {
      localResourceBodiesRead: false,
      networkFetched: false,
      browserLoaded: false,
      markupRendered: false,
      scriptsExecuted: false,
      stylesApplied: false,
      mediaDecoded: false,
      cssImportsTraversed: false,
      srcsetParsed: false,
      dynamicReferencesResolved: false,
      runtimeRouteFallbackExcluded: false,
      visualQualityProven: false,
      readinessProven: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
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
  SCHEMA,
  DEFAULT_TTL_MS,
  TAG_ATTRIBUTES,
  LOCAL_ISSUE_STATES,
  UNRESOLVED_STATES,
  sha256,
  stableJson,
  toRelative,
  hasSymlinkSegment,
  inspectEntry,
  extractStaticQuotedReferences,
  inspectReference,
  scanWorkshop,
  freshness
};
