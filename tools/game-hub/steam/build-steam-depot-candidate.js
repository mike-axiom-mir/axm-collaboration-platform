#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(__dirname, 'steam-depot-content.json');
const MANIFEST_NAME = 'AXM_STEAM_DEPOT_MANIFEST.json';
const TEXT_EXTENSIONS = new Set([
  '', '.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.svg',
  '.txt', '.webmanifest'
]);
const SECRET_PATTERNS = [
  { id: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'openai-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { id: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'slack-token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/ },
  { id: 'stripe-live-key', pattern: /\b[rs]k_live_[0-9A-Za-z]{16,}\b/ },
  { id: 'windows-user-path', pattern: /\b[A-Za-z]:[\\/]Users[\\/][^\\/\s"']+/i }
];

function slash(value) {
  return String(value).replaceAll('\\', '/');
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function inside(base, target) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function readConfig(configPath = CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.schema !== 'axm.steam-depot-content/v1') throw new Error('unexpected Steam depot content schema');
  if (config.status !== 'TEST') throw new Error('Steam depot content contract must remain TEST before approval');
  if (!Array.isArray(config.core_include_paths) || !config.core_include_paths.length) throw new Error('core include paths are missing');
  return config;
}

function parseArgs(argv) {
  const result = { output: null, verify: null };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--output') result.output = argv[++index];
    else if (item === '--verify') result.verify = argv[++index];
    else if (item === '--help' || item === '-h') result.help = true;
    else throw new Error('unknown argument: ' + item);
  }
  return result;
}

function excludedRelative(relative, config) {
  const parts = slash(relative).split('/').filter(Boolean);
  const blockedSegments = new Set((config.excluded_segments || []).map(value => String(value).toLowerCase()));
  if (parts.some(part => blockedSegments.has(part.toLowerCase()))) return true;
  const name = (parts[parts.length - 1] || '').toLowerCase();
  if ((config.excluded_file_names || []).some(value => name === String(value).toLowerCase())) return true;
  if (name === '.env' || name.startsWith('.env.')) return true;
  if ((config.forbidden_suffixes || []).some(value => name.endsWith(String(value).toLowerCase()))) return true;
  return false;
}

function scanFile(file, relative, config) {
  if (excludedRelative(relative, config)) return [{ id: 'forbidden-path', file: slash(relative) }];
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) return [{ id: 'symbolic-link', file: slash(relative) }];
  if (!stat.isFile()) return [];
  if (stat.size > 8 * 1024 * 1024 || !TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return [];
  const text = fs.readFileSync(file, 'utf8');
  return SECRET_PATTERNS.filter(item => item.pattern.test(text)).map(item => ({ id: item.id, file: slash(relative) }));
}

function collectSources(root, config) {
  const sources = new Map();
  function addFile(file, destinationRelative) {
    const destination = slash(destinationRelative).replace(/^\/+/, '');
    if (excludedRelative(destination, config)) return;
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error('symbolic links are not allowed in the depot candidate: ' + destination);
    if (!stat.isFile()) throw new Error('depot input is not a regular file: ' + destination);
    const existing = sources.get(destination);
    if (existing && path.resolve(existing) !== path.resolve(file)) throw new Error('two sources map to depot path: ' + destination);
    sources.set(destination, file);
  }
  function addPath(relative) {
    const normalized = slash(relative).replace(/^\/+/, '');
    const source = path.resolve(root, normalized);
    if (!inside(root, source)) throw new Error('depot input escapes the source root: ' + normalized);
    if (!fs.existsSync(source)) throw new Error('missing depot input: ' + normalized);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error('symbolic links are not allowed in the depot candidate: ' + normalized);
    if (stat.isFile()) return addFile(source, normalized);
    if (!stat.isDirectory()) throw new Error('unsupported depot input: ' + normalized);
    const walk = directory => {
      const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = path.join(directory, entry.name);
        const relativePath = slash(path.relative(root, full));
        if (excludedRelative(relativePath, config)) continue;
        if (entry.isSymbolicLink()) throw new Error('symbolic links are not allowed in the depot candidate: ' + relativePath);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) addFile(full, relativePath);
      }
    };
    walk(source);
  }

  config.core_include_paths.forEach(addPath);
  const libraryRelative = config.game_library.directory;
  const library = path.join(root, libraryRelative);
  const games = fs.readdirSync(library, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(library, entry.name, 'game.manifest.json')))
    .map(entry => entry.name)
    .sort();
  for (const game of games) {
    const gameBase = slash(path.join(libraryRelative, game));
    addPath(gameBase + '/game.manifest.json');
    const evidence = [];
    for (const name of config.game_library.rights_files || []) {
      const relative = gameBase + '/' + name;
      if (fs.existsSync(path.join(root, relative))) { addPath(relative); evidence.push(name); }
    }
    if (!evidence.length) throw new Error('game has no standardized rights ledger: ' + game);
    const content = config.game_library.content_overrides[game] || config.game_library.default_content_paths;
    if (!Array.isArray(content) || !content.length) throw new Error('game has no depot content route: ' + game);
    content.forEach(relative => addPath(gameBase + '/' + relative));
  }
  return { games, sources };
}

function assertSafeOutput(output, sourceRoot = ROOT) {
  const resolved = path.resolve(output || '');
  if (!output) throw new Error('an explicit --output directory is required');
  if (inside(sourceRoot, resolved) || inside(resolved, sourceRoot)) {
    throw new Error('the depot candidate must be outside the source workspace');
  }
  if (fs.existsSync(resolved)) {
    if (!fs.statSync(resolved).isDirectory()) throw new Error('output exists and is not a directory');
    if (fs.readdirSync(resolved).length) throw new Error('output directory must be new or empty');
  }
  return resolved;
}

function inventoryDirectory(candidate) {
  const files = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('candidate contains a symbolic link: ' + slash(path.relative(candidate, full)));
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push({ full, relative: slash(path.relative(candidate, full)) });
    }
  };
  walk(candidate);
  return files;
}

function scanTree(candidate, config) {
  const findings = [];
  for (const item of inventoryDirectory(candidate)) findings.push(...scanFile(item.full, item.relative, config));
  return findings;
}

function contentDigest(files) {
  const digest = crypto.createHash('sha256');
  for (const file of files) digest.update(file.path + '\0' + file.bytes + '\0' + file.sha256 + '\n');
  return digest.digest('hex');
}

function buildCandidate(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const config = options.config || readConfig(options.configPath || CONFIG_PATH);
  const output = assertSafeOutput(options.output, root);
  const collected = collectSources(root, config);
  const sourceFindings = [];
  for (const [relative, file] of collected.sources) sourceFindings.push(...scanFile(file, relative, config));
  if (sourceFindings.length) throw new Error('source safety scan failed: ' + JSON.stringify(sourceFindings));
  fs.mkdirSync(output, { recursive: true });
  for (const [relative, source] of [...collected.sources.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const destination = path.join(output, ...relative.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  const stagedFindings = scanTree(output, config);
  if (stagedFindings.length) throw new Error('staged safety scan failed: ' + JSON.stringify(stagedFindings));
  const files = inventoryDirectory(output).map(item => {
    const bytes = fs.readFileSync(item.full);
    return { path: item.relative, bytes: bytes.length, sha256: sha256(bytes) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    schema: 'axm.steam-depot-candidate/v1',
    status: 'TEST',
    product: config.product,
    built_at: new Date().toISOString(),
    human_approval: false,
    steam_upload_performed: false,
    source_worktree_may_be_dirty: true,
    content_contract: 'tools/game-hub/steam/steam-depot-content.json',
    games: collected.games,
    game_count: collected.games.length,
    file_count: files.length,
    total_bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    content_sha256: contentDigest(files),
    safety_scan: { verdict: 'PASS', findings: [] },
    files
  };
  fs.writeFileSync(path.join(output, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  verifyCandidate(output, { config });
  return manifest;
}

function verifyCandidate(candidatePath, options = {}) {
  const candidate = path.resolve(candidatePath);
  const config = options.config || readConfig(options.configPath || CONFIG_PATH);
  const manifestPath = path.join(candidate, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) throw new Error('candidate manifest is missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== 'axm.steam-depot-candidate/v1' || manifest.status !== 'TEST') throw new Error('unexpected candidate manifest');
  if (manifest.human_approval !== false || manifest.steam_upload_performed !== false) throw new Error('candidate approval/upload boundary is invalid');
  const actual = inventoryDirectory(candidate).filter(item => item.relative !== MANIFEST_NAME);
  if (actual.length !== manifest.files.length) throw new Error('candidate file count differs from manifest');
  const expected = new Map(manifest.files.map(item => [item.path, item]));
  const verified = [];
  for (const item of actual) {
    const declared = expected.get(item.relative);
    if (!declared) throw new Error('undeclared candidate file: ' + item.relative);
    const bytes = fs.readFileSync(item.full);
    const digest = sha256(bytes);
    if (bytes.length !== declared.bytes || digest !== declared.sha256) throw new Error('candidate digest mismatch: ' + item.relative);
    verified.push({ path: item.relative, bytes: bytes.length, sha256: digest });
  }
  verified.sort((a, b) => a.path.localeCompare(b.path));
  if (contentDigest(verified) !== manifest.content_sha256) throw new Error('candidate content digest mismatch');
  const findings = scanTree(candidate, config);
  if (findings.length) throw new Error('candidate safety scan failed: ' + JSON.stringify(findings));
  if (manifest.game_count !== 19 || manifest.games.length !== 19) throw new Error('candidate must contain the current 19-game library');
  return { manifest, findings, verified_files: verified.length };
}

function printHelp() {
  console.log('Build:  node tools/game-hub/steam/build-steam-depot-candidate.js --output <new-empty-directory>');
  console.log('Verify: node tools/game-hub/steam/build-steam-depot-candidate.js --verify <candidate-directory>');
  console.log('The output directory must be outside the source workspace. No upload is performed.');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) return printHelp();
  if (args.verify) {
    const result = verifyCandidate(args.verify);
    console.log(`Steam depot candidate verified: ${result.verified_files} files · ${result.manifest.game_count} games · ${result.manifest.content_sha256}`);
    return result;
  }
  const manifest = buildCandidate({ output: args.output });
  console.log(`Steam depot candidate built: ${manifest.file_count} files · ${(manifest.total_bytes / 1048576).toFixed(2)} MiB · ${manifest.game_count} games`);
  console.log(`Content SHA-256: ${manifest.content_sha256}`);
  return manifest;
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error('Steam depot candidate failed: ' + error.message); process.exitCode = 1; }
}

module.exports = {
  CONFIG_PATH,
  MANIFEST_NAME,
  ROOT,
  SECRET_PATTERNS,
  assertSafeOutput,
  buildCandidate,
  collectSources,
  contentDigest,
  excludedRelative,
  inventoryDirectory,
  readConfig,
  scanFile,
  scanTree,
  sha256,
  verifyCandidate
};
