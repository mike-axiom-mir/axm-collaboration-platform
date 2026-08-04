#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const PRIVATE_TOP_LEVEL = new Set([
  'exports', 'backups', 'logs', 'saves', 'state', '.claude', '.codex', '.grok',
  '.git', 'node_modules', 'runtime', 'sessions', 'cache', 'tmp', 'projects', 'intakes',
  'distributions'
]);
const PRIVATE_NESTED = new Set([
  'exports', 'backups', 'logs', 'saves', 'state', '.claude', '.codex', '.grok',
  '.git', 'node_modules', 'sessions', 'cache', 'tmp', 'projects', 'intakes',
  'rollback', '__pycache__', '.pytest_cache', 'coverage'
]);
const PRIVATE_TOP_LEVEL_PATTERNS = [
  /^_archive_review_/i,
  /^AXM_.*_WORKING(?:_|$)/i,
  /^AXM_.*_PACK_/i,
  /^AXM_AETHERGLASS_VISUAL_ENGINE_/i,
  /^AXM_VISUAL_HANDSHAKE_/i
];
const SENSITIVE_EXTENSIONS = new Set(['.pem', '.pfx', '.key', '.log']);
const PUBLIC_OMISSIONS = new Set([
  'tools/game-hub/game-library/008-district-party/assets/source/user_generated/interactable_alpha_pack_2026-07-19/AXM_DISTRICT_PARTY_INTERACTABLE_ALPHA_PACK_2026-07-19.zip',
  'intakes/universal-object-fabric-v0.7.0-2026-07-28/source/AXM_UNIVERSAL_OBJECT_FABRIC_COMPLETE_INTAKE_v0_7_0_2026-07-28.zip'
]);
const REVIEWED_PUBLIC_INTAKES = new Set([
  'intakes/ai-team-collaboration-runs-01-101-v1',
  'intakes/universal-object-fabric-v0.7.0-2026-07-28'
]);

function slash(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '') || '.';
}

function isUnder(candidate, parent) {
  const child = path.resolve(candidate);
  const root = path.resolve(parent);
  return child === root || child.startsWith(root + path.sep);
}

function normalizeScopes(root, values) {
  const incoming = Array.isArray(values) ? values : values ? [values] : [];
  const result = [];
  for (const value of incoming) {
    const relative = slash(value);
    if (relative === '.') continue;
    if (path.isAbsolute(relative) || relative.includes(':') || relative.split('/').includes('..')) {
      throw new Error('scope must be a safe Workshop-relative path: ' + value);
    }
    const absolute = path.resolve(root, relative);
    if (!isUnder(absolute, root)) throw new Error('scope escaped the Workshop: ' + value);
    if (!fs.existsSync(absolute)) throw new Error('scope does not exist: ' + relative);
    if (isPublicExcluded(relative, fs.statSync(absolute).isDirectory())) {
      throw new Error('scope is private or generated and cannot be shared: ' + relative);
    }
    if (!result.includes(relative)) result.push(relative);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function isPublicExcluded(relative, isDirectory) {
  const rel = slash(relative);
  if (rel === '.') return false;
  if (PUBLIC_OMISSIONS.has(rel)) return true;
  const originalSegments = rel.split('/');
  const segments = originalSegments.map(part => part.toLowerCase());
  const reviewedIntake = [...REVIEWED_PUBLIC_INTAKES].some(prefix => rel === prefix || rel.startsWith(prefix + '/'));
  const reviewedIntakeAncestor = isDirectory && [...REVIEWED_PUBLIC_INTAKES].some(prefix => prefix.startsWith(rel + '/'));
  if (segments[0] === 'intakes' && !reviewedIntake && !reviewedIntakeAncestor) return true;
  if (PRIVATE_TOP_LEVEL.has(segments[0]) && !reviewedIntake && !reviewedIntakeAncestor) return true;
  if (PRIVATE_TOP_LEVEL_PATTERNS.some(pattern => pattern.test(originalSegments[0]))) return true;
  if (segments.slice(1, isDirectory ? undefined : -1).some(part => PRIVATE_NESTED.has(part))) return true;
  const name = segments[segments.length - 1];
  if (name === 'axm_start_report.txt') return true;
  if (name.endsWith('.bak') || name.includes('.bak-')) return true;
  if (name === 'bridge-token.txt' || name === 'bridge_token.txt' || name === '.env' || name.startsWith('.env.')) return true;
  if (name === 'private-preview.js' || name.startsWith('private_')) return true;
  if (!isDirectory && SENSITIVE_EXTENSIONS.has(path.extname(name).toLowerCase())) return true;
  return false;
}

function walkFiles(root, relative, output) {
  const rel = slash(relative);
  const absolute = rel === '.' ? root : path.join(root, ...rel.split('/'));
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error('symbolic links are not packageable: ' + rel);
  if (stat.isDirectory()) {
    if (rel !== '.' && isPublicExcluded(rel, true)) return;
    for (const name of fs.readdirSync(absolute).sort((a, b) => a.localeCompare(b))) {
      const child = rel === '.' ? name : rel + '/' + name;
      walkFiles(root, child, output);
    }
    return;
  }
  if (stat.isFile() && !isPublicExcluded(rel, false)) output.set(rel, absolute);
}

function collectFiles(root, scopes) {
  const selected = normalizeScopes(root, scopes);
  const files = new Map();
  for (const scope of selected.length ? selected : ['.']) walkFiles(root, scope, files);
  return { scopes: selected, files };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return null; }
}

function discoverCatalog(root) {
  const toolsRoot = path.join(root, 'tools');
  const manifests = [];
  if (fs.existsSync(toolsRoot)) {
    for (const name of fs.readdirSync(toolsRoot)) {
      const folder = path.join(toolsRoot, name);
      const manifest = readJson(path.join(folder, 'manifest.json'));
      if (manifest && fs.statSync(folder).isDirectory()) manifests.push({ name, folder, manifest });
    }
  }
  const childCounts = new Map();
  for (const entry of manifests) {
    const parent = String(entry.manifest.integratedInto || '').trim();
    if (parent) childCounts.set(parent, (childCounts.get(parent) || 0) + 1);
  }
  const catalog = manifests.map(entry => ({
    id: String(entry.manifest.id || entry.name),
    name: String(entry.manifest.name || entry.name),
    kind: childCounts.has(String(entry.manifest.id || entry.name)) ? 'parent-module' : 'module',
    path: 'tools/' + entry.name,
    status: String(entry.manifest.status || 'UNKNOWN'),
    children: childCounts.get(String(entry.manifest.id || entry.name)) || 0
  }));

  const gamesRoot = path.join(root, 'tools', 'game-hub', 'game-library');
  if (fs.existsSync(gamesRoot)) {
    for (const name of fs.readdirSync(gamesRoot)) {
      const folder = path.join(gamesRoot, name);
      if (!fs.statSync(folder).isDirectory()) continue;
      const manifest = readJson(path.join(folder, 'game.manifest.json')) || {};
      catalog.push({
        id: String(manifest.id || name), name: String(manifest.name || manifest.title || name),
        kind: 'game', path: 'tools/game-hub/game-library/' + name,
        status: String(manifest.status || 'UNKNOWN'), children: 0
      });
    }
  }

  const worldsRoot = path.join(root, 'worlds');
  if (fs.existsSync(worldsRoot)) {
    for (const name of fs.readdirSync(worldsRoot)) {
      const folder = path.join(worldsRoot, name);
      if (!fs.statSync(folder).isDirectory()) continue;
      const manifest = readJson(path.join(folder, 'world.manifest.json')) || {};
      catalog.push({
        id: String(manifest.id || name), name: String(manifest.name || name), kind: 'world',
        path: 'worlds/' + name, status: String(manifest.status || 'UNKNOWN'), children: 0
      });
    }
  }

  const sharedRoot = path.join(root, 'shared');
  if (fs.existsSync(sharedRoot)) {
    for (const name of fs.readdirSync(sharedRoot)) {
      const folder = path.join(sharedRoot, name);
      if (!fs.statSync(folder).isDirectory() || isPublicExcluded('shared/' + name, true)) continue;
      const contract = readJson(path.join(folder, 'service.contract.json')) || readJson(path.join(folder, 'module.contract.json')) || {};
      catalog.push({
        id: String(contract.id || name), name: String(contract.name || name.replace(/-/g, ' ')),
        kind: 'shared-system', path: 'shared/' + name,
        status: String(contract.status || 'UNKNOWN'), children: 0
      });
    }
  }

  return catalog.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

function gitBlobSha(file) {
  const content = fs.readFileSync(file);
  return crypto.createHash('sha1')
    .update(Buffer.from('blob ' + content.length + '\0', 'utf8'))
    .update(content)
    .digest('hex');
}

function githubJson(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'user-agent': 'AXM-Workshop-Packager', accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
    https.get(url, { headers }, response => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error('GitHub API ' + response.statusCode + ': ' + data.slice(0, 300)));
        }
        try { resolve(JSON.parse(data)); }
        catch (error) { reject(new Error('GitHub returned invalid JSON: ' + error.message)); }
      });
    }).on('error', reject);
  });
}

function matchesScopes(relative, scopes) {
  if (!scopes.length) return true;
  return scopes.some(scope => relative === scope || relative.startsWith(scope + '/'));
}

function diffAgainstTree(local, entries, scopes) {
  const remote = new Map();
  for (const entry of entries || []) {
    const rel = slash(entry.path);
    if (entry.type !== 'blob' || isPublicExcluded(rel, false) || !matchesScopes(rel, scopes || [])) continue;
    remote.set(rel, String(entry.sha || '').toLowerCase());
  }
  const changed = [];
  for (const [rel, absolute] of local) {
    if (!remote.has(rel) || gitBlobSha(absolute) !== remote.get(rel)) changed.push(rel);
  }
  const removed = [];
  for (const rel of remote.keys()) if (!local.has(rel)) removed.push(rel);
  return { changed: changed.sort(), removed: removed.sort() };
}

async function githubBaseline(repo, ref) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '')) throw new Error('GitHub repository must be owner/name');
  if (!ref || String(ref).length > 160 || /[\r\n]/.test(ref)) throw new Error('GitHub ref is invalid');
  const base = 'https://api.github.com/repos/' + repo;
  const commit = await githubJson(base + '/commits/' + encodeURIComponent(ref));
  const commitSha = String(commit.sha || '');
  const treeSha = String(commit.commit && commit.commit.tree && commit.commit.tree.sha || '');
  if (!commitSha || !treeSha) throw new Error('GitHub commit did not expose a tree');
  const tree = await githubJson(base + '/git/trees/' + treeSha + '?recursive=1');
  if (tree.truncated) throw new Error('GitHub tree was truncated; delta would be incomplete');
  return { repo, requested_ref: ref, commit_sha: commitSha, tree_sha: treeSha, entries: tree.tree || [] };
}

async function createPlan(options) {
  const root = path.resolve(options.root);
  const mode = options.mode;
  if (!['module', 'delta'].includes(mode)) throw new Error('planner mode must be module or delta');
  const collected = collectFiles(root, options.scopes || []);
  const local = collected.files;
  if (mode === 'module') {
    if (!collected.scopes.length) throw new Error('a modular package needs at least one selected scope');
    if (!local.size) throw new Error('selected scopes contain no public-safe files');
    return {
      schema: 'axm.package-plan/v1', mode, scopes: collected.scopes,
      files: Array.from(local.keys()).sort(), removed_paths: [],
      dependency_closure: 'not-inferred; select multiple scopes when dependencies are required'
    };
  }

  const baseline = await githubBaseline(options.githubRepo, options.gitRef);
  const difference = diffAgainstTree(local, baseline.entries, collected.scopes);
  const changed = difference.changed;
  const removed = difference.removed;
  if (!changed.length && !removed.length) throw new Error('no changed, new, or removed files exist against that GitHub ref');
  return {
    schema: 'axm.package-plan/v1', mode, scopes: collected.scopes,
    files: changed.sort(), removed_paths: removed.sort(),
    baseline: {
      provider: 'github', repository: baseline.repo, requested_ref: baseline.requested_ref,
      commit_sha: baseline.commit_sha, tree_sha: baseline.tree_sha,
      comparison: 'Git blob SHA-1 for local public-safe files versus the selected GitHub tree'
    }
  };
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    result[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return result;
}

async function cli() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root || path.join(__dirname, '..', '..'));
  if (args.catalog) {
    process.stdout.write(JSON.stringify({ ok: true, catalog: discoverCatalog(root) }));
    return;
  }
  const scopePayload = args['scopes-base64']
    ? Buffer.from(String(args['scopes-base64']), 'base64').toString('utf8')
    : (args['scopes-json'] || '[]');
  const scopes = JSON.parse(scopePayload);
  const plan = await createPlan({
    root, mode: args.mode, scopes,
    githubRepo: args['github-repo'] || 'mike-axiom-mir/axm-collaboration-platform',
    gitRef: args['git-ref'] || 'main'
  });
  if (!args.output) throw new Error('--output is required');
  fs.writeFileSync(path.resolve(args.output), JSON.stringify(plan, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({ ok: true, files: plan.files.length, removed: plan.removed_paths.length }));
}

if (require.main === module) {
  cli().catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}

module.exports = {
  collectFiles,
  createPlan,
  diffAgainstTree,
  discoverCatalog,
  gitBlobSha,
  isPublicExcluded,
  normalizeScopes
};
