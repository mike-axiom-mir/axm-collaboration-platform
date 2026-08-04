'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Planner = require('./package-planner');
const WindowsOffline = require('../../shared/operations/windows-offline-gate-service');

const SCRIPT = path.join(__dirname, 'package-workshop.ps1');
const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(ROOT, 'exports', 'workshop-packages');
const RUNTIME_ROOT = path.join(ROOT, 'runtime', 'node');
const RUNTIME_MANIFEST = path.join(ROOT, 'runtime', 'RUNTIME_MANIFEST.json');
const DEPLOYMENT_CATALOG = path.join(ROOT, 'shared', 'operations', 'deployment-capability-catalog.json');
let active = false;

function deploymentCapabilities() {
  try {
    const value = JSON.parse(fs.readFileSync(DEPLOYMENT_CATALOG, 'utf8').replace(/^\uFEFF/, ''));
    return { available: true, schema: value.schema, source: value.source, policy: value.policy, summary: value.summary };
  } catch (error) {
    return { available: false, reason: String(error.message || error), summary: null };
  }
}

function offlineReadiness() {
  if (!fs.existsSync(RUNTIME_ROOT) || !fs.existsSync(RUNTIME_MANIFEST)) {
    return { ready: false, decision: 'HOLD', reason: 'verified bundled runtime and manifest are not prepared', runtime_manifest_sha256: null };
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(RUNTIME_MANIFEST, 'utf8').replace(/^\uFEFF/, ''));
    const verification = WindowsOffline.verifyRuntimeBundle(RUNTIME_ROOT, manifest);
    const names = new Set((manifest.entries || []).map(entry => String(entry.path || '').toLowerCase()));
    const companions = names.has('runtime_provenance.json') && [...names].some(name => /(^|\/)license(?:\.txt)?$/i.test(name));
    const ready = verification.decision === 'PASS' && manifest.synthetic_fixture === false && companions;
    return {
      ready,
      decision: ready ? 'PASS' : 'HOLD',
      reason: ready ? 'approved runtime bytes, license and provenance verified' : (verification.errors.join(';') || 'real runtime license/provenance companion missing'),
      runtime_id: manifest.runtime_id || null,
      version: manifest.version || null,
      architecture: manifest.architecture || null,
      runtime_manifest_sha256: manifest.manifest_sha256 || null,
      files_verified: verification.entries_observed,
      bytes_verified: verification.bytes_observed
    };
  } catch (error) {
    return { ready: false, decision: 'HOLD', reason: String(error.message || error), runtime_manifest_sha256: null };
  }
}

function list() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  return fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter(item => item.isFile() && /\.(?:zip|REFUSED\.json)$/i.test(item.name))
    .map(item => {
      const file = path.join(OUTPUT_DIR, item.name);
      const stat = fs.statSync(file);
      let restoreTest = null;
      if (/\.zip$/i.test(item.name)) {
        const reportPath = path.join(OUTPUT_DIR, item.name.replace(/\.zip$/i, '.RESTORE_TEST.json'));
        try {
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, ''));
          restoreTest = report.ok === true ? 'pass' : 'fail';
        } catch (e) { restoreTest = 'untested'; }
      }
      return {
        name: item.name,
        bytes: stat.size,
        modified_at: stat.mtime.toISOString(),
        kind: /\.zip$/i.test(item.name)
          ? ((item.name.match(/^axm-workshop-(offline-windows|full|public|module|delta)-/i) || [])[1] || 'package').toLowerCase()
          : 'refusal-report',
        restore_test: restoreTest,
        url: '/exports/workshop-packages/' + encodeURIComponent(item.name)
      };
    })
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at));
}

function catalog() {
  return Planner.discoverCatalog(ROOT);
}

function normalizeOptions(options) {
  options = options || {};
  const mode = ['full', 'public', 'module', 'delta', 'offline-windows'].includes(options.mode) ? options.mode : null;
  if (!mode) throw new Error('mode must be full, public, module, delta, or offline-windows');
  const scopes = Planner.normalizeScopes(ROOT, Array.isArray(options.scopes) ? options.scopes : []);
  if (mode === 'module' && !scopes.length) throw new Error('select at least one module, parent module, game, world, or shared system');
  const githubRepo = String(options.github_repo || 'mike-axiom-mir/axm-collaboration-platform').trim();
  const gitRef = String(options.git_ref || 'main').trim();
  if (mode === 'delta' && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(githubRepo)) throw new Error('GitHub repository must be owner/name');
  if (mode === 'delta' && (!gitRef || gitRef.length > 160 || /[\r\n]/.test(gitRef))) throw new Error('GitHub ref is invalid');
  return { mode, scopes, githubRepo, gitRef, keepCopy: options.keep_copy === true };
}

function create(options) {
  let request;
  try { request = normalizeOptions(options); }
  catch (error) { return Promise.reject(error); }
  if (active) return Promise.reject(new Error('a workshop package is already being built'));
  if (!fs.existsSync(SCRIPT)) return Promise.reject(new Error('packager script missing'));
  if (request.mode === 'offline-windows') {
    const readiness = offlineReadiness();
    if (!readiness.ready) return Promise.reject(new Error('offline Windows candidate held: ' + readiness.reason));
  }
  active = true;
  return new Promise((resolve, reject) => {
    const args = [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT,
      '-Mode', request.mode,
      '-KeepCopy', request.keepCopy ? 'true' : 'false',
      '-ScopesBase64', Buffer.from(JSON.stringify(request.scopes), 'utf8').toString('base64'),
      '-GitHubRepo', request.githubRepo,
      '-GitRef', request.gitRef,
      '-RuntimeRoot', RUNTIME_ROOT,
      '-RuntimeManifestPath', RUNTIME_MANIFEST
    ];
    const child = childProcess.spawn('powershell.exe', args, { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} }, 10 * 60 * 1000);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 1024 * 1024) stdout = stdout.slice(-1024 * 1024); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 256 * 1024) stderr = stderr.slice(-256 * 1024); });
    child.once('error', error => { clearTimeout(timer); active = false; reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      active = false;
      if (code !== 0) return reject(new Error((stderr || stdout || ('packager exited ' + code)).trim().slice(-4000)));
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      try { resolve(JSON.parse(lines[lines.length - 1] || '{}')); }
      catch (error) { reject(new Error('packager returned invalid result: ' + stdout.slice(-1000))); }
    });
  });
}

module.exports = {
  catalog,
  create,
  list,
  normalizeOptions,
  offlineReadiness,
  deploymentCapabilities,
  isActive: () => active,
  outputDir: OUTPUT_DIR
};
