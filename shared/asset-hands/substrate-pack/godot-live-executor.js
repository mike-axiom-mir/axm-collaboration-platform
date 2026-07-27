'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Pack = require('./pack-core');

function runCaptured(command, args, job, timeout) {
  const token = crypto.randomBytes(5).toString('hex');
  const stdoutFile = path.join(job, 'godot-stdout-' + token + '.txt');
  const stderrFile = path.join(job, 'godot-stderr-' + token + '.txt');
  const out = fs.openSync(stdoutFile, 'wx'); const err = fs.openSync(stderrFile, 'wx');
  let result;
  try { result = childProcess.spawnSync(command, args, { windowsHide: true, shell: false, timeout: timeout || 120000, stdio: ['ignore', out, err], env: Object.assign({}, process.env, { GODOT_SILENCE_ROOT_WARNING: '1' }) }); }
  finally { fs.closeSync(out); fs.closeSync(err); }
  const stdout = fs.readFileSync(stdoutFile); const stderr = fs.readFileSync(stderrFile);
  if (stdout.length > 8 * 1024 * 1024 || stderr.length > 8 * 1024 * 1024) throw new Error('Godot process output exceeds bounds');
  return { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR'), stdout: stdout.toString('utf8'), stdout_digest: Pack.sha256(stdout), stderr_digest: Pack.sha256(stderr) };
}

function safeProjectRelative(value) {
  const relative = String(value || '').replace(/\\/g, '/');
  if (!relative || relative.startsWith('/') || /^[A-Za-z]:/.test(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('unsafe Godot project file path');
  return relative;
}
function inside(root, relative) {
  const target = path.resolve(root, safeProjectRelative(relative));
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Godot project file escaped job');
  return target;
}
function parseProbe(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((item) => item.startsWith('AXM_GODOT_PROBE:'));
  if (!line) return null;
  try { return JSON.parse(line.slice('AXM_GODOT_PROBE:'.length)); } catch (error) { return null; }
}
function diagnostic(job, executed) {
  const log = path.join(job, 'run.log');
  const combined = (executed && executed.stdout || '') + '\n' + (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '');
  const lines = combined.split(/\r?\n/).filter((line) => /ERROR|SCRIPT|Parse|Invalid|failed/i.test(line)).slice(-20).join('\n');
  return Pack.cleanText(lines, 3000) || null;
}

function createExecutor(options) {
  options = options || {};
  const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot());
  const lock = options.lock || Pack.loadLock(options.lockPath);
  const visual = options.visual === true;
  const identity = Object.freeze({ kind: 'native-host', fresh_process: true, id: 'axm-godot-live-project-executor', version: '1.0.0', host: 'godot', render_mode: visual ? 'offscreen-window' : 'headless', network: false, retains_project: false });
  function resolve() { return Pack.resolveRequest({ id: 'godot' }, { root, lock, inventory: options.inventory }); }
  function run(bundle, resource) {
    const resolution = resolve();
    if (resolution.status !== 'READY') return { schema: 'axm.godot-live-project-receipt/v1', version: '1.0.0', status: 'MISSING_SUBSTRATE', missing: resolution.missing || ['godot-runtime'], identity, private_location_retained: false };
    if (!bundle || bundle.schema !== 'axm.godot-asset-probe/v1' || !Array.isArray(bundle.files)) throw new Error('Godot project bundle required');
    if (!resource || !Buffer.isBuffer(resource.content) || resource.content.length < 1 || resource.content.length > 256 * 1024 * 1024) throw new Error('bounded Godot resource content required');
    if (String(resource.path) !== String(bundle.resource_path)) throw new Error('Godot resource path does not match project bundle');
    const jobRoot = path.resolve(root, '.jobs'); fs.mkdirSync(jobRoot, { recursive: true });
    const job = path.join(jobRoot, 'godot-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
    if (!job.startsWith(jobRoot + path.sep)) throw new Error('Godot job escaped root');
    fs.mkdirSync(job, { recursive: false });
    try {
      for (const file of bundle.files) {
        const target = inside(job, file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, String(file.text), { flag: 'wx' });
      }
      const resourceRelative = safeProjectRelative(String(resource.path).replace(/^res:\/\//, ''));
      const resourceFile = inside(job, resourceRelative); fs.mkdirSync(path.dirname(resourceFile), { recursive: true }); fs.writeFileSync(resourceFile, resource.content, { flag: 'wx' });
      const godot = Pack.entrypointPath(root, Pack.entryById(lock, 'godot'), 'godot_console');
      const imported = runCaptured(godot, ['--headless', '--no-header', '--path', job, '--import', '--log-file', path.join(job, 'import.log')], job, 180000);
      const renderArgs = visual
        ? ['--no-header', '--display-driver', 'windows', '--rendering-driver', 'opengl3', '--audio-driver', 'Dummy', '--position', '-10000,-10000', '--resolution', '640x360']
        : ['--headless', '--no-header'];
      const executed = imported.status === 0 && !imported.error ? runCaptured(godot, renderArgs.concat(['--path', job, '--quit-after', '120', '--log-file', path.join(job, 'run.log')]), job, 30000) : null;
      const probe = executed && parseProbe(executed.stdout);
      const frame = path.join(job, 'axm-probe-frame.png');
      const frameDigest = fs.existsSync(frame) && fs.statSync(frame).size > 0 ? Pack.sha256(fs.readFileSync(frame)) : null;
      const checks = [
        { name: 'godot-import-process', pass: imported.status === 0 && !imported.error },
        { name: 'godot-fresh-scene-process', pass: !!executed && executed.status === 0 && !executed.error },
        { name: 'texture-loaded', pass: !!(probe && probe.texture_loaded) },
        { name: 'visible-frame-captured', pass: !!(probe && probe.frame_saved && frameDigest) },
        { name: 'declared-budgets', pass: !!(probe && probe.status === 'PASS') },
      ];
      const status = checks.every((item) => item.pass) ? 'PASS' : checks[0].pass && checks[2].pass ? 'VISUAL_OR_BUDGET_HOLD' : 'FAIL';
      const receipt = { schema: 'axm.godot-live-project-receipt/v1', version: '1.0.0', status, identity, runtime: resolution.selected, project_bundle_digest: bundle.digest, resource: { digest: Pack.sha256(resource.content), bytes: resource.content.length, mime: String(resource.mime || 'application/octet-stream') }, frame_digest: frameDigest, metrics: probe, checks, diagnostic: diagnostic(job, executed), process_receipts: { import: { status: imported.status, error: imported.error || null, stdout_digest: imported.stdout_digest, stderr_digest: imported.stderr_digest }, run: executed ? { status: executed.status, error: executed.error || null, stdout_digest: executed.stdout_digest, stderr_digest: executed.stderr_digest } : null }, private_location_retained: false, automatic_project_retention: false };
      receipt.digest = Pack.digest(receipt); return receipt;
    } finally {
      const resolved = path.resolve(job); if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe Godot job cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
  return Object.freeze({ identity, resolve, run });
}

module.exports = { createExecutor, parseProbe };
