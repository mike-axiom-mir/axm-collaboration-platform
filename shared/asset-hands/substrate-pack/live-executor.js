'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Pack = require('./pack-core');

const ADAPTER = path.join(__dirname, 'python-adapter.py');
const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;

function cleanObject(value, privateFragments) {
  privateFragments = privateFragments || [];
  if (Array.isArray(value)) return value.slice(0, 1000).map((item) => cleanObject(item, privateFragments));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).slice(0, 1000)) out[key] = cleanObject(value[key], privateFragments);
    return out;
  }
  if (typeof value !== 'string') return value;
  let cleaned = Pack.cleanText(value, 4000);
  for (const fragment of privateFragments) {
    const variants = [String(fragment), String(fragment).replace(/\\/g, '/'), String(fragment).replace(/\//g, '\\')];
    for (const variant of variants) if (variant) cleaned = cleaned.split(variant).join('<private-path>');
  }
  if (/(?:^|[\\/])\.jobs[\\/]validator-[^\\/]+[\\/]/i.test(cleaned)) return '<private-path>';
  return cleaned;
}

function parseJson(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  try { return cleanObject(JSON.parse(value)); }
  catch (error) {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return cleanObject(JSON.parse(value.slice(start, end + 1))); }
      catch (ignored) { return { raw_digest: Pack.sha256(Buffer.from(value)), parse_error: true }; }
    }
    return { raw_digest: Pack.sha256(Buffer.from(value)), parse_error: true };
  }
}

function executable(root, lock, id, name) { return Pack.entrypointPath(root, Pack.entryById(lock, id), name); }
function extension(mime) {
  return ({ 'application/epub+zip': '.epub', 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/tiff': '.tif', 'image/exr': '.exr', 'model/gltf+json': '.gltf', 'model/gltf-binary': '.glb', 'image/ktx2': '.ktx2', 'application/mtlx+xml': '.mtlx' })[mime] || '.bin';
}
function processRun(command, args, options) {
  const captureRoot = options && options.captureRoot;
  if (!captureRoot || !fs.existsSync(captureRoot)) throw new Error('fresh-process capture root is required');
  const token = crypto.randomBytes(6).toString('hex');
  const stdoutFile = path.join(captureRoot, 'stdout-' + token + '.txt');
  const stderrFile = path.join(captureRoot, 'stderr-' + token + '.txt');
  const stdoutFd = fs.openSync(stdoutFile, 'wx');
  const stderrFd = fs.openSync(stderrFile, 'wx');
  let result;
  try {
    result = childProcess.spawnSync(command, args, {
      windowsHide: true, shell: false, timeout: options && options.timeout || 120000,
      stdio: ['ignore', stdoutFd, stderrFd], env: Object.assign({}, process.env, options && options.env || {})
    });
  } finally {
    fs.closeSync(stdoutFd); fs.closeSync(stderrFd);
  }
  const stdoutBytes = fs.readFileSync(stdoutFile);
  const stderrBytes = fs.readFileSync(stderrFile);
  if (stdoutBytes.length > 32 * 1024 * 1024 || stderrBytes.length > 8 * 1024 * 1024) throw new Error('external validator output exceeds capture bounds');
  return { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR'), stdout: stdoutBytes.toString('utf8'), stderr: stderrBytes.toString('utf8') };
}
function runBatch(command, args, options) {
  if (process.platform !== 'win32' || !/\.(bat|cmd)$/i.test(command)) return processRun(command, args, options);
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = '$arguments = ConvertFrom-Json $env:AXM_BATCH_ARGS; & $env:AXM_BATCH_PATH @arguments; if ($null -eq $LASTEXITCODE) { exit 0 } else { exit $LASTEXITCODE }';
  return processRun(shell, ['-NoProfile', '-NonInteractive', '-Command', script], { captureRoot: options && options.captureRoot, timeout: options && options.timeout, env: Object.assign({}, options && options.env || {}, { AXM_BATCH_PATH: command, AXM_BATCH_ARGS: JSON.stringify(args) }) });
}
function complianceBooleans(value, out) {
  out = out || [];
  if (Array.isArray(value)) value.forEach((item) => complianceBooleans(item, out));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if (/^(isCompliant|compliant)$/i.test(key) && typeof item === 'boolean') out.push(item);
    else complianceBooleans(item, out);
  }
  return out;
}

function createExecutor(options) {
  options = options || {};
  const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot());
  const lock = options.lock || Pack.loadLock(options.lockPath);
  const identity = Object.freeze({ kind: 'external-process', fresh_process: true, id: 'axm-pinned-substrate-executor', version: '1.0.0', network: false, retains_artifacts: false });

  function resolve(profile) { return Pack.resolveRequest(profile.runtime_request, { root, lock, inventory: options.inventory }); }
  function run(request) {
    const profile = request && request.profile;
    const artifact = request && request.artifact;
    if (!profile || !artifact || !Buffer.isBuffer(artifact.content)) throw new Error('live validator request is incomplete');
    if (artifact.content.length < 1 || artifact.content.length > MAX_ARTIFACT_BYTES) throw new Error('artifact exceeds live validator byte bounds');
    const current = resolve(profile);
    if (current.status !== 'READY') throw new Error('exact live validator substrate is unavailable');
    if (!request.runtime || request.runtime.artifact_sha256 !== current.selected.artifact_sha256) throw new Error('runtime resolution changed before validation');
    const jobRoot = path.resolve(root, '.jobs');
    fs.mkdirSync(jobRoot, { recursive: true });
    const job = path.join(jobRoot, 'validator-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
    if (!job.startsWith(jobRoot + path.sep)) throw new Error('validator job escaped local root');
    fs.mkdirSync(job, { recursive: false });
    const staged = path.join(job, 'artifact' + extension(artifact.mime));
    fs.writeFileSync(staged, artifact.content, { flag: 'wx' });
    let execution;
    let report;
    let pass = false;
    try {
      if (profile.id === 'w3c-epubcheck') {
        execution = processRun(executable(root, lock, 'java-temurin-jre', 'java'), ['-jar', executable(root, lock, 'epubcheck', 'jar'), '--json', '-', staged], { captureRoot: job });
        report = parseJson(execution.stdout);
        pass = execution.status === 0 && !execution.error;
      } else if (profile.id === 'verapdf-pdfua-pdfa') {
        const javaBin = path.dirname(executable(root, lock, 'java-temurin-jre', 'java'));
        execution = runBatch(executable(root, lock, 'verapdf', 'verapdf'), ['--format', 'json', '--flavour', '0', '--maxfailuresdisplayed', '100', staged], { captureRoot: job, timeout: 180000, env: { PATH: javaBin + path.delimiter + (process.env.PATH || '') } });
        report = parseJson(execution.stdout);
        const values = complianceBooleans(report);
        pass = execution.status === 0 && !execution.error && values.length > 0 && values.every(Boolean);
      } else if (profile.id === 'khronos-gltf-validator') {
        execution = processRun(executable(root, lock, 'gltf-validator', 'validator'), ['-o', staged], { captureRoot: job });
        report = parseJson(execution.stdout);
        pass = execution.status === 0 && !execution.error && report && report.issues && Number(report.issues.numErrors) === 0;
      } else if (profile.id === 'khronos-ktx-tools') {
        execution = processRun(executable(root, lock, 'ktx-tools', 'ktx'), ['validate', '--format', 'mini-json', '--testrun', staged], { captureRoot: job });
        report = parseJson(execution.stdout);
        pass = execution.status === 0 && !execution.error;
      } else if (profile.id === 'openimageio-openexr' || profile.id === 'opencolorio-aces2' || profile.id === 'materialx-1.39') {
        const python = executable(root, lock, 'python-cpython', 'python');
        const mode = profile.id === 'openimageio-openexr' ? 'image' : profile.id === 'opencolorio-aces2' ? 'ocio' : 'materialx';
        const args = [ADAPTER, mode, staged];
        if (mode === 'ocio') args.push(executable(root, lock, 'ocio-aces-config', 'config'));
        execution = processRun(python, args, { captureRoot: job, timeout: 180000 });
        report = parseJson(execution.stdout);
        pass = execution.status === 0 && !execution.error && report && report.pass === true;
      } else throw new Error('no live executor exists for validator ' + profile.id);
      report = cleanObject(report, [root, job, staged]);
      const checks = report && Array.isArray(report.checks) ? report.checks : [{ name: 'official-process-exit', pass, exit_status: execution.status }];
      return { validator_id: profile.id, artifact_digest: artifact.digest, runtime_artifact_sha256: current.selected.artifact_sha256, pass, report: { format: profile.official_report_format, official: report, exit_status: execution.status, stdout_digest: Pack.sha256(Buffer.from(execution.stdout || '')), stderr_digest: Pack.sha256(Buffer.from(execution.stderr || '')) }, checks: cleanObject(checks, [root, job, staged]) };
    } finally {
      const resolved = path.resolve(job);
      if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe validator job cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
  return Object.freeze({ identity, resolve, run });
}

module.exports = { MAX_ARTIFACT_BYTES, createExecutor, parseJson };
