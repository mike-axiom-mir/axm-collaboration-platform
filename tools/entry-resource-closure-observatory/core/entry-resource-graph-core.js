'use strict';

const fs = require('fs');
const path = require('path');
const Direct = require('./entry-resource-closure-core');

const SCHEMA = 'axm.entry-resource-graph/v1';
const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_MAX_NODES_PER_MODULE = 500;
const DEFAULT_MAX_TEXT_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_TEXT_BYTES_PER_MODULE = 12 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.cjs', '.mjs']);
const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);

function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function sourceKind(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.html' || extension === '.htm') return 'HTML';
  if (extension === '.css') return 'CSS';
  if (JAVASCRIPT_EXTENSIONS.has(extension)) return 'JAVASCRIPT';
  return 'ASSET';
}

function pushMatch(output, text, match, type, rawIndex) {
  const raw = match[rawIndex];
  if (typeof raw !== 'string') return;
  output.push({
    type,
    raw,
    line: lineAt(text, match.index),
    textualPatternOnly: true
  });
}

function extractHtmlReferences(text) {
  return Direct.extractStaticQuotedReferences(text).map(item => ({
    type: item.tag.toUpperCase() + '_' + item.attribute.toUpperCase(),
    raw: item.raw,
    line: item.line,
    textualPatternOnly: true
  }));
}

function extractCssReferences(text) {
  const output = [];
  const occupied = new Set();
  const importPattern = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^'")\s;]+))/gi;
  let match;
  while ((match = importPattern.exec(text))) {
    const rawIndex = match[1] !== undefined ? 1 : match[2] !== undefined ? 2 : 3;
    pushMatch(output, text, match, 'CSS_IMPORT', rawIndex);
    occupied.add(match.index + ':' + match[rawIndex]);
  }
  const urlPattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s]+))\s*\)/gi;
  while ((match = urlPattern.exec(text))) {
    const rawIndex = match[1] !== undefined ? 1 : match[2] !== undefined ? 2 : 3;
    const key = match.index + ':' + match[rawIndex];
    if (occupied.has(key)) continue;
    pushMatch(output, text, match, 'CSS_URL', rawIndex);
  }
  return output;
}

function extractJavascriptReferences(text) {
  const output = [];
  const patterns = [
    {
      type: 'JS_STATIC_IMPORT_OR_EXPORT',
      pattern: /\b(?:import|export)\s+(?:[^;\r\n]*?\sfrom\s*)?(?:"([^"\r\n]+)"|'([^'\r\n]+)')/g
    },
    {
      type: 'JS_LITERAL_DYNAMIC_IMPORT',
      pattern: /\bimport\s*\(\s*(?:"([^"]+)"|'([^']+)')\s*\)/g
    },
    {
      type: 'JS_LITERAL_WORKER',
      pattern: /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(?:"([^"]+)"|'([^']+)')/g
    },
    {
      type: 'JS_LITERAL_IMPORT_SCRIPTS',
      pattern: /\bimportScripts\s*\(\s*(?:"([^"]+)"|'([^']+)')/g
    }
  ];
  for (const item of patterns) {
    let match;
    while ((match = item.pattern.exec(text))) {
      pushMatch(output, text, match, item.type, match[1] !== undefined ? 1 : 2);
    }
  }
  const seen = new Set();
  return output.filter(item => {
    const key = item.type + ':' + item.line + ':' + item.raw;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractReferences(kind, text) {
  if (kind === 'HTML') return extractHtmlReferences(text);
  if (kind === 'CSS') return extractCssReferences(text);
  if (kind === 'JAVASCRIPT') return extractJavascriptReferences(text);
  return [];
}

function safeLocalCandidates(workshopRoot, sourceAbsolute, raw, kind) {
  const clean = String(raw || '').trim();
  const base = {
    raw,
    state: null,
    targetPath: null,
    resolutionStrategy: null
  };
  if (!clean) return Object.assign(base, { state: 'EMPTY_REFERENCE' });
  if (clean.startsWith('#')) return Object.assign(base, { state: 'FRAGMENT_REFERENCE' });
  if (clean.includes('${') || clean.includes('{{') || clean.includes('<%')) {
    return Object.assign(base, { state: 'DYNAMIC_REFERENCE_NOT_RESOLVED' });
  }
  if (clean.includes('%')) return Object.assign(base, { state: 'ENCODED_REFERENCE_NOT_RESOLVED' });
  if (/^(?:data|blob):/i.test(clean)) return Object.assign(base, { state: 'INLINE_OR_RUNTIME_SCHEME' });
  if (/^(?:https?:)?\/\//i.test(clean)) return Object.assign(base, { state: 'REMOTE_REFERENCE_NOT_FETCHED' });
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return Object.assign(base, { state: 'NON_FILE_SCHEME' });
  if (clean.includes('\\') || clean.includes('\0')) return Object.assign(base, { state: 'UNSAFE_LOCAL_PATH' });
  if (kind === 'JAVASCRIPT' && !clean.startsWith('/') && !clean.startsWith('./') && !clean.startsWith('../')) {
    return Object.assign(base, { state: 'BARE_MODULE_SPECIFIER_NOT_RESOLVED' });
  }

  const separator = clean.search(/[?#]/);
  const localPath = separator === -1 ? clean : clean.slice(0, separator);
  if (!localPath) return Object.assign(base, { state: 'DOCUMENT_SELF_REFERENCE' });
  const exact = localPath.startsWith('/')
    ? path.resolve(workshopRoot, localPath.slice(1))
    : path.resolve(path.dirname(sourceAbsolute), localPath);
  if (exact !== workshopRoot && !exact.startsWith(workshopRoot + path.sep)) {
    return Object.assign(base, { state: 'UNSAFE_LOCAL_PATH' });
  }

  const candidates = [{ absolute: exact, strategy: 'EXACT_STATIC_PATH' }];
  if (kind === 'JAVASCRIPT' && !path.extname(exact)) {
    for (const suffix of ['.js', '.mjs', '.cjs', '/index.js', '/index.mjs', '/index.cjs']) {
      candidates.push({ absolute: exact + suffix, strategy: 'STATIC_EXTENSION_CANDIDATE_' + suffix.replace(/\W/g, '_').toUpperCase() });
    }
  }
  for (const candidate of candidates) {
    if (candidate.absolute !== workshopRoot && !candidate.absolute.startsWith(workshopRoot + path.sep)) continue;
    if (Direct.hasSymlinkSegment(workshopRoot, candidate.absolute)) {
      return Object.assign(base, {
        state: 'SYMLINK_REFUSED',
        targetPath: Direct.toRelative(workshopRoot, candidate.absolute),
        resolutionStrategy: candidate.strategy
      });
    }
    if (!fs.existsSync(candidate.absolute)) continue;
    const stat = fs.lstatSync(candidate.absolute);
    if (!stat.isFile()) {
      return Object.assign(base, {
        state: 'NOT_REGULAR_FILE',
        targetPath: Direct.toRelative(workshopRoot, candidate.absolute),
        resolutionStrategy: candidate.strategy
      });
    }
    return Object.assign(base, {
      state: 'STATIC_LOCAL_PRESENT',
      targetPath: Direct.toRelative(workshopRoot, candidate.absolute),
      resolutionStrategy: candidate.strategy,
      bytes: stat.size,
      absolute: candidate.absolute
    });
  }
  return Object.assign(base, {
    state: 'STATIC_LOCAL_MISSING',
    targetPath: Direct.toRelative(workshopRoot, exact),
    resolutionStrategy: 'EXACT_STATIC_PATH'
  });
}

function canonicalCycle(cycle) {
  const body = cycle.slice(0, -1);
  if (!body.length) return cycle;
  const rotations = body.map((_, index) => body.slice(index).concat(body.slice(0, index)));
  rotations.sort((left, right) => left.join('>').localeCompare(right.join('>')));
  return rotations[0].concat(rotations[0][0]);
}

function detectCycles(nodes, edges) {
  const traversed = new Set(nodes.filter(node => node.bodyRead).map(node => node.path));
  const adjacency = new Map();
  for (const node of traversed) adjacency.set(node, []);
  for (const edge of edges) {
    if (edge.state !== 'STATIC_LOCAL_PRESENT' || !traversed.has(edge.from) || !traversed.has(edge.targetPath)) continue;
    adjacency.get(edge.from).push(edge.targetPath);
  }
  for (const targets of adjacency.values()) targets.sort();
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = new Map();
  function visit(node) {
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const target of adjacency.get(node) || []) {
      if (visiting.has(target)) {
        const index = stack.indexOf(target);
        const cycle = canonicalCycle(stack.slice(index).concat(target));
        cycles.set(cycle.join('>'), cycle);
      } else {
        visit(target);
      }
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of Array.from(traversed).sort()) visit(node);
  return Array.from(cycles.values()).sort((left, right) => left.join('>').localeCompare(right.join('>')));
}

function scanModule(workshopRoot, directModule, limits, readIssues) {
  const nodes = [];
  const edges = [];
  const nodeByPath = new Map();
  const queued = new Map();
  const queue = [];
  let textBytesRead = 0;
  let limitHolds = 0;

  function queuePath(relative, depth) {
    if (queued.has(relative) || nodeByPath.has(relative)) return true;
    if (queued.size + nodeByPath.size >= limits.maxNodesPerModule) {
      limitHolds += 1;
      return false;
    }
    queued.set(relative, depth);
    queue.push({ relative, depth });
    return true;
  }

  if (directModule.entry.state !== 'PRESENT_HTML') {
    return {
      id: directModule.id,
      folder: directModule.folder,
      version: directModule.version,
      status: directModule.status,
      entry: directModule.entry,
      nodes,
      edges,
      cycles: [],
      summary: {
        nodes: 0,
        textBodiesRead: 0,
        assetLeaves: 0,
        edges: 0,
        localPresentEdges: 0,
        unresolvedEdges: 0,
        missingEdges: 0,
        cycles: 0,
        limitHolds: 0,
        textBytesRead: 0
      }
    };
  }
  queuePath('tools/' + directModule.folder + '/' + directModule.entry.path, 0);

  while (queue.length) {
    const item = queue.shift();
    queued.delete(item.relative);
    if (nodeByPath.has(item.relative)) continue;
    const absolute = path.resolve(workshopRoot, item.relative);
    if (absolute !== workshopRoot && !absolute.startsWith(workshopRoot + path.sep)) continue;
    const kind = sourceKind(absolute);
    const stat = fs.lstatSync(absolute);
    const node = {
      path: item.relative,
      kind,
      state: 'PRESENT',
      bytes: stat.size,
      sha256: null,
      bodyRead: false,
      depth: item.depth
    };
    nodeByPath.set(item.relative, node);
    nodes.push(node);
    if (!TEXT_EXTENSIONS.has(path.extname(absolute).toLowerCase())) continue;
    if (item.depth > limits.maxDepth) {
      node.state = 'DEPTH_LIMIT_HOLD';
      limitHolds += 1;
      continue;
    }
    if (stat.size > limits.maxTextBytes) {
      node.state = 'TEXT_FILE_SIZE_LIMIT_HOLD';
      limitHolds += 1;
      continue;
    }
    if (textBytesRead + stat.size > limits.maxTextBytesPerModule) {
      node.state = 'MODULE_TEXT_BUDGET_LIMIT_HOLD';
      limitHolds += 1;
      continue;
    }
    let bytes;
    try {
      bytes = fs.readFileSync(absolute);
    } catch (error) {
      node.state = 'TEXT_READ_FAILED';
      readIssues.push({
        moduleId: directModule.id,
        path: item.relative,
        code: error && error.code || 'UNKNOWN'
      });
      continue;
    }
    textBytesRead += bytes.length;
    node.sha256 = Direct.sha256(bytes);
    node.bodyRead = true;
    const text = bytes.toString('utf8');
    for (const reference of extractReferences(kind, text)) {
      const resolution = safeLocalCandidates(workshopRoot, absolute, reference.raw, kind);
      const edge = {
        from: item.relative,
        type: reference.type,
        raw: reference.raw,
        line: reference.line,
        textualPatternOnly: true,
        state: resolution.state,
        targetPath: resolution.targetPath,
        resolutionStrategy: resolution.resolutionStrategy
      };
      if (resolution.state === 'STATIC_LOCAL_PRESENT') {
        const targetKind = sourceKind(resolution.absolute);
        edge.targetKind = targetKind;
        edge.targetBytes = resolution.bytes;
        if (!queuePath(resolution.targetPath, item.depth + 1)) {
          edge.state = 'NODE_LIMIT_HOLD';
        }
      }
      edges.push(edge);
    }
  }

  nodes.sort((left, right) => left.path.localeCompare(right.path));
  edges.sort((left, right) => (
    left.from.localeCompare(right.from)
    || left.line - right.line
    || left.type.localeCompare(right.type)
    || left.raw.localeCompare(right.raw)
  ));
  const cycles = detectCycles(nodes, edges);
  return {
    id: directModule.id,
    folder: directModule.folder,
    version: directModule.version,
    status: directModule.status,
    entry: directModule.entry,
    nodes,
    edges,
    cycles,
    summary: {
      nodes: nodes.length,
      textBodiesRead: nodes.filter(node => node.bodyRead).length,
      assetLeaves: nodes.filter(node => node.kind === 'ASSET').length,
      edges: edges.length,
      localPresentEdges: edges.filter(edge => edge.state === 'STATIC_LOCAL_PRESENT').length,
      unresolvedEdges: edges.filter(edge => ![
        'STATIC_LOCAL_PRESENT', 'STATIC_LOCAL_MISSING'
      ].includes(edge.state)).length,
      missingEdges: edges.filter(edge => edge.state === 'STATIC_LOCAL_MISSING').length,
      cycles: cycles.length,
      limitHolds,
      textBytesRead
    }
  };
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const limits = {
    maxDepth: Number.isInteger(options.maxDepth) && options.maxDepth >= 0
      ? options.maxDepth : DEFAULT_MAX_DEPTH,
    maxNodesPerModule: Number.isInteger(options.maxNodesPerModule) && options.maxNodesPerModule > 0
      ? options.maxNodesPerModule : DEFAULT_MAX_NODES_PER_MODULE,
    maxTextBytes: Number.isInteger(options.maxTextBytes) && options.maxTextBytes > 0
      ? options.maxTextBytes : DEFAULT_MAX_TEXT_BYTES,
    maxTextBytesPerModule: Number.isInteger(options.maxTextBytesPerModule) && options.maxTextBytesPerModule > 0
      ? options.maxTextBytesPerModule : DEFAULT_MAX_TEXT_BYTES_PER_MODULE
  };
  const directMap = options.directMap || Direct.scanWorkshop(root, {
    now: options.now,
    ttlMs: options.ttlMs
  });
  if (!directMap || directMap.schema !== Direct.SCHEMA) {
    throw new Error('resource graph requires an ' + Direct.SCHEMA + ' direct map');
  }
  const readIssues = [];
  const modules = directMap.modules.map(module => scanModule(root, module, limits, readIssues));
  const allNodes = modules.flatMap(module => module.nodes);
  const allEdges = modules.flatMap(module => module.edges);
  const measuredAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    directMapFingerprint: directMap.source.fingerprint,
    limits,
    modules,
    readIssues
  };
  return {
    schema: SCHEMA,
    version: 'v0.2',
    measuredAt,
    freshnessTtlMs: directMap.freshnessTtlMs,
    source: {
      label: directMap.source.label,
      fingerprint: Direct.sha256(Buffer.from(Direct.stableJson(fingerprintMaterial))),
      directMapSchema: directMap.schema,
      directMapFingerprint: directMap.source.fingerprint,
      symlinksFollowed: false,
      textualPatternParser: true
    },
    limits,
    summary: {
      modules: modules.length,
      modulesWithTextBodies: modules.filter(module => module.summary.textBodiesRead).length,
      nodes: allNodes.length,
      textBodiesRead: allNodes.filter(node => node.bodyRead).length,
      textBytesRead: modules.reduce((total, module) => total + module.summary.textBytesRead, 0),
      assetLeaves: allNodes.filter(node => node.kind === 'ASSET').length,
      edges: allEdges.length,
      localPresentEdges: allEdges.filter(edge => edge.state === 'STATIC_LOCAL_PRESENT').length,
      missingEdges: allEdges.filter(edge => edge.state === 'STATIC_LOCAL_MISSING').length,
      unresolvedEdges: allEdges.filter(edge => ![
        'STATIC_LOCAL_PRESENT', 'STATIC_LOCAL_MISSING'
      ].includes(edge.state)).length,
      modulesWithCycles: modules.filter(module => module.cycles.length).length,
      cycles: modules.reduce((total, module) => total + module.cycles.length, 0),
      limitHolds: modules.reduce((total, module) => total + module.summary.limitHolds, 0),
      readIssues: readIssues.length
    },
    modules,
    readIssues,
    scopeBoundary: 'Starting from each manifest-declared HTML entry, the graph follows bounded static quoted HTML references, CSS @import/url() patterns, JavaScript import/export literals, literal dynamic imports, literal Worker constructors, and importScripts calls. Local text bodies are read only for pattern extraction and hashing. No parser result is execution proof; bare packages, dynamic expressions, browser resolution, CSS application, code execution, network retrieval, rendering, and media decoding remain outside scope.',
    preservedOwners: {
      directEntryClosure: 'Entry Resource Closure direct map',
      browserResolutionAndRuntime: 'Browser, LAN and Hardware QA Lab',
      javascriptSemantics: 'declaring module and runtime owner',
      networkRetrieval: 'Source Connector and explicit network owners',
      readiness: 'Technical Glasses'
    },
    truth: {
      localTextResourceBodiesRead: true,
      binaryResourceBodiesRead: false,
      syntaxTreeParsed: false,
      browserResolutionPerformed: false,
      networkFetched: false,
      browserLoaded: false,
      markupRendered: false,
      scriptsExecuted: false,
      stylesApplied: false,
      mediaDecoded: false,
      dynamicReferencesResolved: false,
      barePackagesResolved: false,
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

module.exports = {
  SCHEMA,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES_PER_MODULE,
  DEFAULT_MAX_TEXT_BYTES,
  DEFAULT_MAX_TEXT_BYTES_PER_MODULE,
  TEXT_EXTENSIONS,
  sourceKind,
  extractHtmlReferences,
  extractCssReferences,
  extractJavascriptReferences,
  extractReferences,
  safeLocalCandidates,
  detectCycles,
  scanWorkshop
};
