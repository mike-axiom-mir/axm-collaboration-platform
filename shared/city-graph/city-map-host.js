'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Core = require('./city-map-core');

const SKIP_DIRS = new Set(['.git', '.pytest_cache', '__pycache__', 'node_modules', 'vendor', 'exports', 'state', 'workspace', 'logs', 'backups', 'evidence', 'fixtures']);
const SKIP_FILES = new Set(['bridge-token.txt', 'bridge_token.txt', 'bridge.log', 'workshop.log']);
const SORT_LOCALE = 'en-US';

function compareText(left, right) {
  return String(left).localeCompare(String(right), SORT_LOCALE);
}

function textSha256(bytes) {
  return Core.sha256(Buffer.from(bytes).toString('utf8').replace(/\r\n?/g, '\n'));
}

function portable(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function readJsonDeclaration(root, file, code) {
  const relative = portable(root, file);
  let bytes;
  try { bytes = fs.readFileSync(file); }
  catch (error) { throw new Core.CityMapError(code || 'DECLARATION_READ_FAILED', `Cannot read ${relative}: ${error.message}`, { path: relative }); }
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch (error) { throw new Core.CityMapError('INVALID_DECLARATION_JSON', `Invalid JSON in ${relative}: ${error.message}`, { path: relative }); }
  return { path: relative, sha256: textSha256(bytes), value };
}

function walkFiles(start, predicate, limit) {
  const found = [];
  const queue = [start];
  let cursor = 0;
  let visited = 0;
  while (cursor < queue.length) {
    const current = queue[cursor];
    cursor += 1;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch (_) { continue; }
    entries.sort((a, b) => compareText(a.name, b.name));
    for (const entry of entries) {
      visited += 1;
      if (visited > limit) throw new Core.CityMapError('DISCOVERY_BUDGET_EXCEEDED', `Discovery exceeded ${limit} entries under ${start}`, { start, limit });
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) queue.push(absolute);
      } else if (entry.isFile() && !SKIP_FILES.has(entry.name.toLowerCase()) && predicate(absolute, entry.name)) found.push(absolute);
    }
  }
  return found.sort(compareText);
}

function proofFiles(repositoryRoot, moduleRoot) {
  return walkFiles(moduleRoot, (_file, name) => /selftest.*\.(?:js|mjs|cjs)$/i.test(name) || /(?:^|-)test\.(?:js|mjs|cjs)$/i.test(name), 20000)
    .map(file => ({ path: portable(repositoryRoot, file), sha256: textSha256(fs.readFileSync(file)) }));
}

function evidenceLocators(repositoryRoot, moduleRoot) {
  const candidates = ['EVIDENCE.md', 'EVIDENCE_ROUTE.json', 'evidence-route.json', 'candidate.receipt.json', 'INTAKE_RECEIPT.json'];
  const found = [];
  for (const name of candidates) {
    const file = path.join(moduleRoot, name);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) found.push({ path: portable(repositoryRoot, file), sha256: textSha256(fs.readFileSync(file)) });
  }
  return found.sort((a, b) => compareText(a.path, b.path));
}

function sourceFiles(repositoryRoot, moduleRoot) {
  return walkFiles(moduleRoot, (_file, name) => /\.(?:js|mjs|cjs|json|html|css|md|txt)$/i.test(name), 30000)
    .map(file => ({ path: portable(repositoryRoot, file), sha256: textSha256(fs.readFileSync(file)) }));
}

function discoverDeclarations(repositoryRoot, rootsConfig) {
  const declarations = [];
  for (const rootConfig of rootsConfig.roots || []) {
    if (rootConfig.mode !== 'DIRECT_CHILDREN') throw new Core.CityMapError('UNSUPPORTED_DISCOVERY_MODE', `Unsupported discovery mode ${rootConfig.mode}`, rootConfig);
    const absoluteRoot = path.resolve(repositoryRoot, rootConfig.path);
    if (!inside(repositoryRoot, absoluteRoot)) throw new Core.CityMapError('ROOT_ESCAPE', `Configured root escapes repository: ${rootConfig.path}`);
    if (!fs.existsSync(absoluteRoot)) throw new Core.CityMapError('MISSING_DECLARATION_ROOT', `Configured root does not exist: ${rootConfig.path}`);
    const children = fs.readdirSync(absoluteRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && (!rootConfig.ignorePrefix || !entry.name.startsWith(rootConfig.ignorePrefix)))
      .sort((a, b) => compareText(a.name, b.name));
    for (const child of children) {
      const moduleRoot = path.join(absoluteRoot, child.name);
      const files = (rootConfig.declarations || []).map(name => path.join(moduleRoot, name)).filter(file => fs.existsSync(file) && fs.statSync(file).isFile());
      if (files.length === 0) continue;
      const parsed = files.map(file => readJsonDeclaration(repositoryRoot, file));
      const manifest = parsed.find(row => /(?:^|\/)(?:manifest|world\.manifest)\.json$/i.test(row.path));
      const contract = parsed.find(row => /(?:module|service)\.contract\.json$/i.test(row.path));
      const logicalId = String(manifest && manifest.value && manifest.value.id || contract && contract.value && contract.value.id || child.name);
      const modulePath = portable(repositoryRoot, moduleRoot);
      const observedSourceFiles = sourceFiles(repositoryRoot, moduleRoot);
      const declaredEntry = manifest && manifest.value && typeof manifest.value.entry === 'string'
        ? path.resolve(moduleRoot, manifest.value.entry)
        : null;
      if (declaredEntry && inside(repositoryRoot, declaredEntry) && fs.existsSync(declaredEntry) && fs.statSync(declaredEntry).isFile()) {
        const entryRow = { path: portable(repositoryRoot, declaredEntry), sha256: textSha256(fs.readFileSync(declaredEntry)) };
        if (!observedSourceFiles.some(row => row.path === entryRow.path)) observedSourceFiles.push(entryRow);
        observedSourceFiles.sort((a, b) => compareText(a.path, b.path));
      }
      declarations.push({
        root: modulePath,
        cityId: rootConfig.idMode === 'ROOT_QUALIFIED' ? modulePath : logicalId,
        folder: child.name,
        declarations: parsed.map(row => ({ path: row.path, sha256: row.sha256 })),
        manifest: manifest || null,
        contract: contract || null,
        sourceFiles: observedSourceFiles,
        selftests: proofFiles(repositoryRoot, moduleRoot),
        evidence: evidenceLocators(repositoryRoot, moduleRoot)
      });
    }
  }
  return declarations.sort((a, b) => compareText(a.root, b.root));
}

function discoverSchemas(repositoryRoot, rootsConfig) {
  const files = [];
  for (const rootConfig of rootsConfig.roots || []) {
    const absoluteRoot = path.resolve(repositoryRoot, rootConfig.path);
    files.push(...walkFiles(absoluteRoot, (_file, name) => /(?:schema|contract)\.json$/i.test(name), 120000));
  }
  const byId = new Map();
  for (const file of Array.from(new Set(files)).sort()) {
    let value;
    let bytes;
    try {
      bytes = fs.readFileSync(file);
      value = JSON.parse(bytes.toString('utf8'));
    } catch (_) {
      continue;
    }
    const id = typeof value.$id === 'string' && value.$id.trim() ? value.$id.trim() : null;
    if (!id) continue;
    const row = { id, path: portable(repositoryRoot, file), sha256: textSha256(bytes) };
    if (byId.has(id) && byId.get(id).sha256 !== row.sha256) {
      throw new Core.CityMapError('DUPLICATE_SCHEMA_ID', `Schema id ${id} resolves to multiple byte-distinct files`, { first: byId.get(id), second: row });
    }
    byId.set(id, row);
  }
  return Array.from(byId.values()).sort((a, b) => compareText(a.id, b.id));
}

function sourceCommit(repositoryRoot) {
  try {
    return childProcess.execFileSync('git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim().toLowerCase();
  } catch (_) {
    return null;
  }
}

function loadSnapshot(repositoryRoot, options) {
  options = options || {};
  repositoryRoot = fs.realpathSync(path.resolve(repositoryRoot));
  const configFile = path.join(repositoryRoot, 'shared', 'city-graph', 'city-roots.json');
  const config = readJsonDeclaration(repositoryRoot, configFile, 'CITY_ROOTS_READ_FAILED').value;
  if (config.schema !== 'axm.city-roots/v1') throw new Core.CityMapError('INVALID_CITY_ROOTS', 'city-roots.json has an unsupported schema');
  return {
    // A committed generated file cannot name the commit that contains itself:
    // doing so would make every commit stale by construction. Callers may bind
    // an external snapshot explicitly; the default committed identity is the
    // deterministic declaration digest assembled by the pure core.
    sourceCommit: Object.prototype.hasOwnProperty.call(options, 'sourceCommit') ? options.sourceCommit : null,
    roots: (config.roots || []).map(row => row.path),
    declarations: discoverDeclarations(repositoryRoot, config),
    schemas: discoverSchemas(repositoryRoot, config),
    strictSchemas: options.strictSchemas === true
  };
}

function compileRepository(repositoryRoot, options) {
  return Core.compileSnapshot(loadSnapshot(repositoryRoot, options));
}

function existingViews(repositoryRoot, names) {
  const result = {};
  for (const name of names) {
    const file = path.resolve(repositoryRoot, name);
    if (!inside(repositoryRoot, file)) throw new Core.CityMapError('OUTPUT_ESCAPE', `Generated view escapes repository: ${name}`);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) result[name] = fs.readFileSync(file, 'utf8');
  }
  return result;
}

function checkRepository(repositoryRoot, options) {
  const graph = compileRepository(repositoryRoot, options);
  const expected = Core.buildViews(graph);
  const existing = existingViews(repositoryRoot, Object.keys(expected));
  return Core.compareGenerated(graph, existing);
}

function writeRepositoryViews(repositoryRoot, options) {
  repositoryRoot = fs.realpathSync(path.resolve(repositoryRoot));
  const graph = compileRepository(repositoryRoot, options);
  const files = Core.buildViews(graph);
  for (const [name, content] of Object.entries(files)) {
    const target = path.resolve(repositoryRoot, name);
    if (!inside(repositoryRoot, target)) throw new Core.CityMapError('OUTPUT_ESCAPE', `Generated view escapes repository: ${name}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, target);
  }
  return { graph, files };
}

module.exports = {
  SKIP_DIRS,
  SKIP_FILES,
  textSha256,
  portable,
  inside,
  readJsonDeclaration,
  walkFiles,
  sourceFiles,
  discoverDeclarations,
  discoverSchemas,
  sourceCommit,
  loadSnapshot,
  compileRepository,
  existingViews,
  checkRepository,
  writeRepositoryViews
};
