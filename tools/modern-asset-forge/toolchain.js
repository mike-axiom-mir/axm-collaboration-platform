'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const Pack = require('../../shared/asset-hands/substrate-pack/pack-core');
const KTX2 = require('../../shared/asset-hands/ktx2-codec');
const Core = require('./core');

const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const BROWSER_RUNTIME_ROOT = path.resolve(__dirname, '../../shared/asset-hands/browser-3d-runtime');

function findOnPath(name) {
  const executable = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = childProcess.spawnSync(executable, [name], { shell: false, windowsHide: true, encoding: 'utf8', timeout: 5000 });
  if (result.status !== 0) return null;
  const candidates = String(result.stdout || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (process.platform !== 'win32') return candidates[0] || null;
  return candidates.find(value => /\.exe$/i.test(value))
    || candidates.find(value => /\.cmd$/i.test(value))
    || candidates.find(value => /\.bat$/i.test(value))
    || candidates[0]
    || null;
}

function capture(command, args, options = {}) {
  if (!command) return { status: null, error: 'MISSING_COMMAND', stdout: '', stderr: '' };
  const result = Pack.runBatch(command, args, {
    cwd: options.cwd,
    env: Object.assign({}, process.env, options.env || {}),
    timeout: options.timeout || DEFAULT_TIMEOUT_MS,
    maxBuffer: MAX_CAPTURE_BYTES
  });
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  if (Buffer.byteLength(stdout) > MAX_CAPTURE_BYTES || Buffer.byteLength(stderr) > MAX_CAPTURE_BYTES) throw new Error('native process output exceeds capture bounds');
  return {
    status: result.status,
    error: result.error || null,
    stdout,
    stderr,
    stdout_sha256: Core.sha256(stdout),
    stderr_sha256: Core.sha256(stderr)
  };
}

function exactSubstrate(id, entrypoint) {
  try {
    const lock = Pack.loadLock();
    const root = Pack.defaultRoot();
    const entry = Pack.entryById(lock, id);
    const probe = Pack.probeOne(entry, lock, root, {});
    if (probe.status !== 'READY') return { available: false, status: probe.status, reason: probe.reason, command: null, provider: 'axm-substrate-pack', version: entry.runtime_version };
    return { available: true, status: 'READY', reason: probe.reason, command: Pack.entrypointPath(root, entry, entrypoint), provider: 'axm-substrate-pack', version: entry.runtime_version, evidence_digest: probe.probe_digest };
  } catch (error) {
    return { available: false, status: 'UNKNOWN', reason: error.message, command: null, provider: 'axm-substrate-pack', version: null };
  }
}

function pathTool(name, override, versionArgs) {
  const command = override || findOnPath(name);
  if (!command) return { available: false, status: 'MISSING', reason: 'command is not installed or configured', command: null, provider: override ? 'request-override' : 'PATH', version: null };
  const probe = capture(command, versionArgs, { timeout: 10000 });
  if (probe.error || (probe.status !== 0 && probe.status !== 1)) return { available: false, status: 'PROBE_FAILED', reason: probe.error || probe.stderr || 'version probe failed', command: null, provider: override ? 'request-override' : 'PATH', version: null };
  const text = (probe.stdout + '\n' + probe.stderr).trim().slice(0, 500);
  return { available: true, status: 'READY_UNPINNED', reason: 'live command probe passed; version is not bound by the AXM substrate lock', command, provider: override ? 'request-override' : 'PATH', version: text, evidence_digest: Core.sha256(text) };
}

function browserRuntime() {
  const manifestFile = path.join(BROWSER_RUNTIME_ROOT, 'manifest.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (manifest.schema !== 'axm.browser-3d-runtime.manifest/v1') throw new Error('browser runtime manifest schema mismatch');
    for (const item of manifest.files || []) {
      const file = Core.resolveInside(BROWSER_RUNTIME_ROOT, item.path, 'browser runtime file');
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size !== item.bytes) throw new Error('browser runtime size mismatch: ' + item.path);
      if (Core.fileDigest(file) !== item.sha256) throw new Error('browser runtime digest mismatch: ' + item.path);
    }
    const required = ['loaders/KTX2Loader.js', 'utils/WorkerPool.js', 'libs/ktx-parse.module.js', 'libs/zstddec.module.js', 'basis/basis_transcoder.js', 'basis/basis_transcoder.wasm', 'meshopt_decoder.mjs'];
    if (!required.every(relative => (manifest.files || []).some(item => item.path === relative))) throw new Error('browser runtime manifest omits a required decoder file');
    return {
      available: true,
      status: 'READY',
      reason: 'pinned local Three.js r160 KTX2 and meshoptimizer decoders passed byte-level manifest verification',
      command: null,
      provider: 'axm-browser-3d-runtime',
      version: 'three@' + manifest.three_version + ' + meshoptimizer@' + manifest.meshoptimizer_version,
      evidence_digest: Core.fileDigest(manifestFile)
    };
  } catch (error) {
    return { available: false, status: 'MISSING_OR_INVALID', reason: error.message, command: null, provider: 'axm-browser-3d-runtime', version: null };
  }
}

async function discover(overrides = {}) {
  const lockedBlender = exactSubstrate('blender', 'blender');
  const lockedValidator = exactSubstrate('gltf-validator', 'validator');
  const lockedKtx = exactSubstrate('ktx-tools', 'ktx');
  const blender = lockedBlender.available ? lockedBlender : pathTool('blender', overrides.blender, ['--version']);
  const validator = lockedValidator.available ? lockedValidator : pathTool('gltf_validator', overrides.gltf_validator, ['--version']);
  const ktx = lockedKtx.available ? lockedKtx : pathTool('ktx', overrides.ktx, ['--version']);
  const transform = pathTool('gltf-transform', overrides.gltf_transform, ['--version']);
  const gltfpack = pathTool('gltfpack', overrides.gltfpack, ['-h']);
  const browser = browserRuntime();
  let basis = { available: false, status: 'PROBE_FAILED', reason: 'Basis engine was not probed', command: null, provider: 'bundled-asset-hand', version: KTX2.BASIS_VERSION };
  try {
    await KTX2.ready();
    basis = { available: true, status: 'READY', reason: 'pinned Basis Universal WebAssembly module initialized', command: null, provider: 'bundled-asset-hand', version: KTX2.BASIS_VERSION, evidence_digest: Core.fileDigest(path.join(__dirname, '../../shared/asset-hands/vendor/basis-universal/basis_encoder.wasm')) };
  } catch (error) {
    basis.reason = error.message;
  }
  const localViewerFiles = [
    path.join(__dirname, '../ps2-asset-forge/vendor/three.module.js'),
    path.join(__dirname, '../ps2-asset-forge/vendor/GLTFLoader.js'),
    path.join(__dirname, '../ps2-asset-forge/vendor/OrbitControls.js')
  ];
  const viewerReady = localViewerFiles.every(file => fs.existsSync(file));
  const tools = { blender, validator, ktx, transform, gltfpack, basis, browser };
  const capabilities = [
    { id: 'preserve.ps2', status: 'available', evidence: 'immutable tree digest plus PS2 selftest' },
    { id: 'contract.manifest', status: 'available', evidence: 'local schemas and selftest' },
    { id: 'contract.receipt', status: 'available', evidence: 'local schemas and selftest' },
    { id: 'contract.asset-id', status: 'available', evidence: 'portable id rules in build request' },
    { id: 'separate.source.delivery', status: 'available', evidence: 'runner uses source root and runtime output roles' },
    { id: 'enforce.no-network', status: 'available', evidence: 'runner contains no network acquisition stage' },
    { id: 'govern.workload.mode', status: 'available', constraints: ['declared scheduling policy only', 'no thermal telemetry claim'], evidence: 'requests must select one of four bounded modes' },
    { id: 'measure.asset.metrics', status: 'available', evidence: 'GLB inspector records geometry, materials, textures, animation, extensions, draw-call upper bound, and bytes' },
    { id: 'measure.system.performance', status: 'unavailable', gap_type: 'EVIDENCE', evidence: 'no approved CPU/GPU temperature, RAM/VRAM peak, battery, or sustained throughput observer is connected' },
    { id: 'inspect.glb.local', status: 'available', constraints: ['structural and metric inspection only', 'not Khronos certification'] },
    { id: 'author.blend', status: blender.available ? (blender.status === 'READY' ? 'available' : 'degraded') : 'unavailable', gap_type: 'SUBSTRATE', evidence: blender.reason },
    { id: 'export.blender.glb', status: blender.available ? (blender.status === 'READY' ? 'available' : 'degraded') : 'unavailable', gap_type: 'SUBSTRATE', evidence: blender.reason },
    { id: 'validate.gltf.khronos', status: validator.available ? (validator.status === 'READY' ? 'available' : 'degraded') : 'unavailable', gap_type: 'SUBSTRATE', evidence: validator.reason },
    { id: 'optimize.gltf.transform', status: transform.available ? 'degraded' : 'unavailable', gap_type: 'SUBSTRATE', constraints: ['PATH or explicit override is live-probed but not pinned'], evidence: transform.reason },
    { id: 'compress.meshopt', status: (transform.available || gltfpack.available) ? 'degraded' : 'unavailable', gap_type: 'SUBSTRATE', constraints: ['optimizer version is not pinned'], evidence: transform.available ? transform.reason : gltfpack.reason },
    { id: 'encode.ktx2.basis', status: basis.available ? 'available' : 'unavailable', gap_type: 'SUBSTRATE', constraints: ['ETC1S BasisLZ only', '4..1024 px', 'standalone texture output'], evidence: basis.reason },
    { id: 'validate.ktx2.independent', status: ktx.available ? (ktx.status === 'READY' ? 'available' : 'degraded') : 'unavailable', gap_type: 'SUBSTRATE', evidence: ktx.reason },
    { id: 'integrate.ktx2.gltf', status: 'available', constraints: ['explicit target texture index required', 'fallback texture source removed', 'post-integration validation required'], evidence: 'deterministic local KHR_texture_basisu GLB binding hand' },
    { id: 'render.webgl2.gltf', status: viewerReady ? 'available' : 'unavailable', gap_type: 'SUBSTRATE', constraints: ['uncompressed GLB diagnostic lane'], evidence: viewerReady ? 'local Three.js r160 GLTFLoader files present' : 'local viewer files missing' },
    { id: 'render.webgl2.ktx2', status: browser.available ? 'available' : 'unavailable', gap_type: 'SUBSTRATE', evidence: browser.reason },
    { id: 'render.webgl2.meshopt', status: browser.available ? 'available' : 'unavailable', gap_type: 'SUBSTRATE', evidence: browser.reason },
    { id: 'observe.browser.smoke', status: viewerReady ? 'available' : 'unavailable', gap_type: 'EVIDENCE', constraints: ['receipt proves load/render facts, not visual quality'], evidence: viewerReady ? 'smoke page and receipt endpoint available' : 'viewer unavailable' }
  ];
  const inventory = { schema: Core.CAPABILITY_SCHEMA, version: '1.0.0', observed_at: new Date().toISOString(), automatic_installation: false, private_location_retained: false, capabilities };
  inventory.digest = Core.sha256(Core.stableStringify(inventory));
  return { tools, inventory };
}

function publicTool(tool) {
  return { available: tool.available, status: tool.status, provider: tool.provider, version: tool.version, reason: tool.reason, evidence_digest: tool.evidence_digest || null, private_location_retained: false };
}

module.exports = { MAX_CAPTURE_BYTES, capture, discover, publicTool, KTX2 };
