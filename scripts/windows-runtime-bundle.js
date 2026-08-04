#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Gate = require('../shared/operations/windows-offline-gate-service');

function parse(values) {
  const output = { command: values[0] || '' };
  for (let index = 1; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith('--')) throw new Error('unexpected argument: ' + token);
    const key = token.slice(2).replace(/-/g, '_');
    const next = values[index + 1];
    output[key] = next && !next.startsWith('--') ? values[++index] : true;
  }
  return output;
}

function inside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function json(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(file, value) {
  const destination = path.resolve(file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = destination + '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  try { fs.renameSync(temporary, destination); }
  catch (error) { try { fs.unlinkSync(temporary); } catch (_) {} throw error; }
  return destination;
}

function requireRealRuntimeCompanions(runtimeRoot, manifest) {
  if (manifest.synthetic_fixture) return;
  const entryNames = new Set(manifest.entries.map(entry => entry.path.toLowerCase()));
  if (![...entryNames].some(name => /(^|\/)license(?:\.txt)?$/i.test(name))) throw new Error('RUNTIME_LICENSE_COMPANION_MISSING');
  if (!entryNames.has('runtime_provenance.json')) throw new Error('RUNTIME_PROVENANCE_COMPANION_MISSING');
  const provenance = json(path.join(runtimeRoot, 'RUNTIME_PROVENANCE.json'));
  if (String(provenance.version || '') !== manifest.version) throw new Error('RUNTIME_PROVENANCE_VERSION_MISMATCH');
  if (!/^https:\/\/nodejs\.org\//i.test(String(provenance.source_url || ''))) throw new Error('RUNTIME_PROVENANCE_SOURCE_INVALID');
  if (!/^[a-f0-9]{64}$/i.test(String(provenance.archive_sha256 || ''))) throw new Error('RUNTIME_PROVENANCE_ARCHIVE_DIGEST_INVALID');
  if (!String(provenance.license || '').trim()) throw new Error('RUNTIME_PROVENANCE_LICENSE_MISSING');
}

function loadVerified(runtimeRoot, manifestPath) {
  const manifest = json(manifestPath);
  const verification = Gate.verifyRuntimeBundle(runtimeRoot, manifest);
  if (verification.decision !== 'PASS') throw new Error(verification.errors.join(';'));
  requireRealRuntimeCompanions(runtimeRoot, manifest);
  return { manifest, verification };
}

function candidateFiles(candidateRoot, manifest, stage) {
  const now = new Date().toISOString();
  const candidate = {
    schema: 'axm.deploy.windows-offline-candidate.v1',
    status: manifest.synthetic_fixture ? 'SYNTHETIC_WINDOWS_CANDIDATE' : 'UNPROVEN_WINDOWS_CANDIDATE',
    created_at: now,
    target_profile: {
      operating_system: 'Windows',
      architecture: manifest.architecture === 'AMD64' ? 'x64' : manifest.architecture.toLowerCase(),
      network_expectation: 'offline-first; loopback-only application listener',
      first_launch_route: 'verified bundled runtime only',
      user_level: 'beginner-safe double-click launcher'
    },
    runtime_id: manifest.runtime_id,
    runtime_manifest_sha256: manifest.manifest_sha256,
    bundled_runtime_before_first_launch: true,
    runtime_synthetic_fixture: manifest.synthetic_fixture,
    automatic_runtime_download: false,
    automatic_installation: false,
    automatic_publication: false,
    windows_offline_first_proven: false,
    physical_proof: false,
    publication_authority: false,
    stage_receipt: stage
  };
  const truth = {
    schema: 'axm.deploy.public-deployment-truth.v1',
    candidate_built_with_bundled_runtime: true,
    runtime_manifest_verified_during_build: true,
    first_launch_download_path_disabled: true,
    clean_windows_x64_tested: false,
    network_adapters_disabled_tested: false,
    lifecycle_network_trace_measured: false,
    windows_offline_first_proven: false,
    publicly_supported: false,
    publication_authority: false,
    next_proof: 'Run PROVE_AXM_OFFLINE.cmd on a clean physical Windows x64 device with adapters disabled.'
  };
  const matrix = {
    schema: 'axm.deploy.clean-device-test-matrix.v1',
    candidate_runtime_manifest_sha256: manifest.manifest_sha256,
    required_profile: 'PHYSICAL_WINDOWS_' + (manifest.architecture === 'AMD64' ? 'X64' : manifest.architecture.toUpperCase()) + '_ADAPTERS_DISABLED',
    cases: [
      { id: 'runtime-integrity', status: 'BUILD_PASS', evidence: stage.runtime_manifest_sha256 },
      { id: 'first-launch-no-download', status: 'NOT_RUN', evidence: null },
      { id: 'loopback-readiness', status: 'NOT_RUN', evidence: null },
      { id: 'graceful-stop-port-release', status: 'NOT_RUN', evidence: null },
      { id: 'restart-same-candidate', status: 'NOT_RUN', evidence: null },
      { id: 'adapter-disabled-lifecycle-trace', status: 'NOT_RUN', evidence: null }
    ],
    physical_proof: false
  };
  const guide = [
    'AXM OFFLINE WINDOWS CANDIDATE',
    '=============================',
    '',
    '1. Extract this complete ZIP to a normal local folder.',
    '2. Double-click OPEN_AXM_WORKSHOP.cmd.',
    '3. The launcher verifies runtime\\node against RUNTIME_MANIFEST.json before starting.',
    '4. This candidate never downloads a runtime and never installs anything system-wide.',
    '',
    'For physical offline proof, disable network adapters and run PROVE_AXM_OFFLINE.cmd.',
    'A build receipt is not the same as clean-device proof or public support.',
    ''
  ].join('\r\n');
  writeJson(path.join(candidateRoot, 'RUNTIME_MANIFEST.json'), manifest);
  writeJson(path.join(candidateRoot, 'AXM_OFFLINE_FIRST.json'), candidate);
  writeJson(path.join(candidateRoot, 'proof', 'CLEAN_DEVICE_TEST_MATRIX.json'), matrix);
  writeJson(path.join(candidateRoot, 'public', 'OFFLINE_DEPLOYMENT_TRUTH.json'), truth);
  fs.mkdirSync(path.join(candidateRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(candidateRoot, 'docs', 'START_OFFLINE_WINDOWS.txt'), guide, 'utf8');
  return { candidate, truth, matrix };
}

function main() {
  const args = parse(process.argv.slice(2));
  if (!['manifest', 'verify', 'stage', 'probe'].includes(args.command)) throw new Error('command must be manifest, verify, stage, or probe');

  if (args.command === 'probe') {
    const target = path.resolve(args.path || process.cwd());
    const disk = fs.statfsSync(target);
    return {
      schema: 'axm.deploy.host-capability-probe.v1',
      read_only: true,
      changes_made: false,
      os_name: os.platform(),
      os_release: os.release(),
      architecture: os.arch(),
      node_version: process.version,
      node_executable: process.execPath,
      storage_free_bytes: disk.bavail * disk.bsize,
      storage_total_bytes: disk.blocks * disk.bsize
    };
  }

  const runtimeRoot = path.resolve(String(args.runtime_root || ''));
  if (!args.runtime_root || !fs.existsSync(runtimeRoot) || !fs.statSync(runtimeRoot).isDirectory()) throw new Error('--runtime-root must be an existing directory');

  if (args.command === 'manifest') {
    if (!args.output) throw new Error('--output is required');
    const manifest = Gate.buildRuntimeManifest(runtimeRoot, {
      runtime_id: args.runtime_id,
      version: args.version,
      architecture: args.architecture || 'x64',
      launcher_relative: args.launcher_relative || 'node.exe',
      synthetic_fixture: args.synthetic_fixture === true || args.synthetic_fixture === 'true'
    });
    requireRealRuntimeCompanions(runtimeRoot, manifest);
    const output = writeJson(args.output, manifest);
    return { schema: 'axm.deploy.windows-runtime-manifest-write.v1', decision: 'PASS', output, manifest };
  }

  if (!args.manifest) throw new Error('--manifest is required');
  const loaded = loadVerified(runtimeRoot, path.resolve(args.manifest));
  if (args.command === 'verify') return loaded.verification;

  if (!args.destination || !args.candidate_root) throw new Error('stage requires --destination and --candidate-root');
  const candidateRoot = path.resolve(args.candidate_root);
  const destination = path.resolve(args.destination);
  if (!fs.existsSync(candidateRoot) || !fs.statSync(candidateRoot).isDirectory()) throw new Error('candidate root must already exist');
  if (!inside(destination, candidateRoot) || destination === candidateRoot) throw new Error('runtime destination must be inside the candidate root');
  if (inside(candidateRoot, runtimeRoot) || inside(runtimeRoot, candidateRoot)) throw new Error('candidate and runtime roots must be separate');
  const stage = Gate.stageRuntimeBundle(runtimeRoot, destination, loaded.manifest);
  const companion = candidateFiles(candidateRoot, loaded.manifest, stage);
  return {
    schema: 'axm.deploy.windows-offline-candidate-stage.v1',
    decision: 'PASS',
    candidate_root: candidateRoot,
    bundled_runtime_before_first_launch: true,
    runtime_stage: stage,
    candidate_status: companion.candidate.status,
    physical_proof: false
  };
}

try {
  const result = main();
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (error) {
  process.stderr.write(String(error && (error.stack || error.message) || error) + '\n');
  process.exitCode = 1;
}
