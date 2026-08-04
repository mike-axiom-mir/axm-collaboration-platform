'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const NETWORK_EVIDENCE_SCHEMA = 'axm.deploy.windows-network-evidence.v2';
const RUNTIME_MANIFEST_SCHEMA = 'axm.deploy.windows-runtime-manifest.v1';
const RUNTIME_VERIFICATION_SCHEMA = 'axm.deploy.windows-runtime-verification.v1';
const GATE_SCHEMA = 'axm.deploy.windows-offline-gate.v1';
const STATUS_SCHEMA = 'axm.windows-offline-readiness/v1';
const PREVIEW_SCHEMA = 'axm.windows-offline-assessment-preview/v1';
const RECEIPT_SCHEMA = 'axm.windows-offline-assessment-receipt/v1';
const LEDGER_SCHEMA = 'axm.windows-offline-assessment-ledger/v1';
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1']);
const WINDOWS_DEVICE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, index) => 'COM' + (index + 1)),
  ...Array.from({ length: 9 }, (_, index) => 'LPT' + (index + 1))
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_RUNTIME_FILES = 5000;
const MAX_RUNTIME_BYTES = 512 * 1024 * 1024;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((output, key) => {
      output[key] = stableValue(value[key]);
      return output;
    }, {});
  }
  return value;
}

function stableJson(value) { return JSON.stringify(stableValue(value)); }
function digest(value) { return U.sha256(Buffer.from(stableJson(value), 'utf8')); }
function isSha256(value) { return SHA256_PATTERN.test(String(value || '').toLowerCase()); }
function errorOnce(errors, code) { if (!errors.includes(code)) errors.push(code); }

function validateWindowsRelative(value) {
  const relative = String(value || '');
  if (!relative || relative.includes('\0') || relative.includes('\\') || relative.startsWith('/') || /^[a-z]:/i.test(relative)) return false;
  const parts = relative.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' ') || part.includes(':'))) return false;
  return !parts.some(part => WINDOWS_DEVICE_NAMES.has(part.split('.')[0].toUpperCase()));
}

function validateNetworkEvidence(evidence) {
  const value = evidence && typeof evidence === 'object' ? evidence : {};
  const errors = [];
  if (value.schema !== NETWORK_EVIDENCE_SCHEMA) errors.push('WINDOWS_EVIDENCE_SCHEMA_MISMATCH');
  if (value.target_os !== 'Windows') errors.push('WINDOWS_TARGET_REQUIRED');
  if (!['AMD64', 'x64'].includes(value.architecture)) errors.push('WINDOWS_X64_REQUIRED');
  if (!['PHYSICAL_WINDOWS_TARGET', 'SYNTHETIC_WINDOWS_FIXTURE'].includes(value.evidence_level)) errors.push('WINDOWS_EVIDENCE_LEVEL_UNKNOWN');
  if (value.collector_changes_made !== false) errors.push('COLLECTOR_CHANGED_SYSTEM');

  const adapters = Array.isArray(value.adapters) ? value.adapters : [];
  if (!adapters.length) errors.push('ADAPTER_EVIDENCE_MISSING');
  for (const adapter of adapters) {
    const hardware = adapter && (adapter.hardware_interface === true || adapter.HardwareInterface === true);
    const status = adapter && (adapter.status || adapter.Status);
    const name = String(adapter && (adapter.name || adapter.Name) || 'unnamed');
    if (hardware && status !== 'Disabled') errors.push('HARDWARE_ADAPTER_NOT_DISABLED:' + name.slice(0, 120));
  }

  if (!Array.isArray(value.default_routes)) errors.push('DEFAULT_ROUTE_EVIDENCE_MISSING');
  else if (value.default_routes.length) errors.push('DEFAULT_ROUTE_PRESENT');

  if (!Array.isArray(value.active_ip_addresses)) errors.push('ACTIVE_ADDRESS_EVIDENCE_MISSING');
  else {
    const nonLoopback = [...new Set(value.active_ip_addresses.map(String).filter(address => !LOOPBACK_ADDRESSES.has(address)))].sort();
    if (nonLoopback.length) errors.push('NON_LOOPBACK_ADDRESS_ACTIVE:' + nonLoopback.join(',').slice(0, 500));
  }

  if (!Array.isArray(value.dns_servers)) errors.push('DNS_EVIDENCE_MISSING');
  else if (value.dns_servers.length) errors.push('DNS_SERVER_PRESENT');
  if (value.proxy_enabled !== false) errors.push('PROXY_STATE_NOT_DISABLED');
  if (value.network_requests_observed === null || value.network_requests_observed === undefined) errors.push('NETWORK_REQUEST_COUNT_UNMEASURED');
  else if (value.network_requests_observed !== 0) errors.push('NETWORK_REQUEST_OBSERVED');

  const observation = value.network_observation;
  if (!observation || observation.request_count_measured !== true || !observation.lifecycle_window) errors.push('LIFECYCLE_NETWORK_TRACE_MISSING');
  if (observation && Array.isArray(observation.outbound_connections) && observation.outbound_connections.length) errors.push('OUTBOUND_CONNECTION_OBSERVED');
  return errors;
}

function validateRuntimeManifest(manifest) {
  const value = manifest && typeof manifest === 'object' ? manifest : {};
  const errors = [];
  if (value.schema !== RUNTIME_MANIFEST_SCHEMA) errors.push('RUNTIME_MANIFEST_SCHEMA_MISMATCH');
  if (!['x64', 'AMD64', 'arm64', 'ARM64'].includes(value.architecture)) errors.push('RUNTIME_ARCHITECTURE_UNSUPPORTED');
  if (typeof value.synthetic_fixture !== 'boolean') errors.push('RUNTIME_SYNTHETIC_STATE_MISSING');
  if (!validateWindowsRelative(value.launcher_relative)) errors.push('RUNTIME_LAUNCHER_PATH_UNSAFE');
  const entries = Array.isArray(value.entries) ? value.entries : [];
  if (!entries.length || entries.length > MAX_RUNTIME_FILES) errors.push('RUNTIME_ENTRY_COUNT_INVALID');

  const exact = new Set(), folded = new Set();
  let bytes = 0;
  for (const entry of entries) {
    const relative = String(entry && entry.path || '');
    if (!validateWindowsRelative(relative)) errors.push('RUNTIME_PATH_UNSAFE:' + relative.slice(0, 240));
    if (exact.has(relative)) errors.push('RUNTIME_DUPLICATE_PATH:' + relative.slice(0, 240));
    exact.add(relative);
    const lower = relative.toLowerCase();
    if (folded.has(lower)) errors.push('RUNTIME_CASE_COLLISION:' + relative.slice(0, 240));
    folded.add(lower);
    if (!Number.isSafeInteger(entry && entry.size) || entry.size < 0) errors.push('RUNTIME_SIZE_INVALID:' + relative.slice(0, 240));
    else bytes += entry.size;
    if (!isSha256(entry && entry.sha256)) errors.push('RUNTIME_DIGEST_INVALID:' + relative.slice(0, 240));
  }
  if (bytes > MAX_RUNTIME_BYTES) errors.push('RUNTIME_EXPANSION_LIMIT_EXCEEDED');
  if (!exact.has(String(value.launcher_relative || ''))) errors.push('RUNTIME_LAUNCHER_NOT_MANIFESTED');

  const unsigned = U.clone(value);
  const stored = String(unsigned.manifest_sha256 || '').toLowerCase();
  delete unsigned.manifest_sha256;
  if (!isSha256(stored) || digest(unsigned) !== stored) errors.push('RUNTIME_MANIFEST_DIGEST_MISMATCH');
  return errors;
}

function runtimeFiles(root) {
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) throw new Error('RUNTIME_ROOT_MISSING');
  const files = [];
  let bytes = 0;
  function visit(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const absolute = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('RUNTIME_SYMLINK_REFUSED');
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        const stat = fs.statSync(absolute);
        files.push({ absolute, relative: path.relative(resolvedRoot, absolute).replace(/\\/g, '/'), size: stat.size });
        bytes += stat.size;
        if (files.length > MAX_RUNTIME_FILES) throw new Error('RUNTIME_FILE_LIMIT_EXCEEDED');
        if (bytes > MAX_RUNTIME_BYTES) throw new Error('RUNTIME_EXPANSION_LIMIT_EXCEEDED');
      } else throw new Error('RUNTIME_SPECIAL_FILE_REFUSED');
    }
  }
  visit(resolvedRoot);
  files.sort((left, right) => left.relative.localeCompare(right.relative));
  return { files, bytes };
}

function buildRuntimeManifest(runtimeRoot, options) {
  const config = options && typeof options === 'object' ? options : {};
  const inventory = runtimeFiles(runtimeRoot);
  const runtimeId = String(config.runtime_id || config.runtimeId || '').trim();
  const version = String(config.version || '').trim();
  const architecture = String(config.architecture || '').trim();
  const launcherRelative = String(config.launcher_relative || config.launcherRelative || '').replace(/\\/g, '/');
  if (!runtimeId || runtimeId.length > 160) throw new Error('RUNTIME_ID_INVALID');
  if (!version || version.length > 80) throw new Error('RUNTIME_VERSION_INVALID');
  if (!['x64', 'AMD64', 'arm64', 'ARM64'].includes(architecture)) throw new Error('RUNTIME_ARCHITECTURE_UNSUPPORTED');
  if (!validateWindowsRelative(launcherRelative)) throw new Error('RUNTIME_LAUNCHER_PATH_UNSAFE');
  const manifest = {
    schema: RUNTIME_MANIFEST_SCHEMA,
    runtime_id: runtimeId,
    version,
    architecture,
    launcher_relative: launcherRelative,
    synthetic_fixture: config.synthetic_fixture === true || config.syntheticFixture === true,
    entries: inventory.files.map(file => ({
      path: file.relative,
      size: file.size,
      sha256: U.fileSha256(file.absolute)
    }))
  };
  manifest.manifest_sha256 = digest(manifest);
  const errors = validateRuntimeManifest(manifest);
  if (errors.length) throw new Error(errors.join(';'));
  return manifest;
}

function stageRuntimeBundle(sourceRoot, destinationRoot, manifest) {
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  const overlap = path.relative(source, destination);
  const reverseOverlap = path.relative(destination, source);
  if (overlap === '' || (!overlap.startsWith('..' + path.sep) && overlap !== '..' && !path.isAbsolute(overlap))) throw new Error('RUNTIME_DESTINATION_OVERLAPS_SOURCE');
  if (reverseOverlap === '' || (!reverseOverlap.startsWith('..' + path.sep) && reverseOverlap !== '..' && !path.isAbsolute(reverseOverlap))) throw new Error('RUNTIME_SOURCE_OVERLAPS_DESTINATION');
  const before = verifyRuntimeBundle(source, manifest);
  if (before.decision !== 'PASS') throw new Error(before.errors.join(';'));
  if (fs.existsSync(destination)) throw new Error('RUNTIME_DESTINATION_ALREADY_EXISTS');
  fs.mkdirSync(destination, { recursive: true });
  try {
    for (const entry of manifest.entries) {
      const from = path.join(source, ...entry.path.split('/'));
      const to = path.join(destination, ...entry.path.split('/'));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    }
    const after = verifyRuntimeBundle(destination, manifest);
    if (after.decision !== 'PASS') throw new Error(after.errors.join(';'));
    return {
      schema: 'axm.deploy.windows-runtime-stage.v1',
      decision: 'PASS',
      runtime_id: manifest.runtime_id,
      runtime_manifest_sha256: manifest.manifest_sha256,
      destination,
      entries: after.entries_observed,
      bytes: after.bytes_observed,
      synthetic_fixture: manifest.synthetic_fixture
    };
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

function verifyRuntimeBundle(runtimeRoot, manifest) {
  const errors = validateRuntimeManifest(manifest);
  let inventory;
  try { inventory = runtimeFiles(runtimeRoot); }
  catch (error) { errorOnce(errors, String(error.message || error)); inventory = { files: [], bytes: 0 }; }
  const actual = new Map(inventory.files.map(file => [file.relative, file]));
  const expected = new Set();
  for (const entry of Array.isArray(manifest && manifest.entries) ? manifest.entries : []) {
    const relative = String(entry && entry.path || '');
    if (!validateWindowsRelative(relative)) continue;
    expected.add(relative);
    const file = actual.get(relative);
    if (!file) { errors.push('RUNTIME_FILE_MISSING:' + relative); continue; }
    if (file.size !== entry.size) errors.push('RUNTIME_SIZE_MISMATCH:' + relative);
    if (U.fileSha256(file.absolute) !== String(entry.sha256 || '').toLowerCase()) errors.push('RUNTIME_DIGEST_MISMATCH:' + relative);
  }
  for (const relative of [...actual.keys()].sort()) if (!expected.has(relative)) errors.push('RUNTIME_UNDECLARED_FILE:' + relative);
  const uniqueErrors = [...new Set(errors)];
  return {
    schema: RUNTIME_VERIFICATION_SCHEMA,
    decision: uniqueErrors.length ? 'HOLD' : 'PASS',
    errors: uniqueErrors,
    files_verified: uniqueErrors.length === 0,
    entries_observed: inventory.files.length,
    bytes_observed: inventory.bytes,
    runtime_manifest_sha256: manifest && manifest.manifest_sha256 || null
  };
}

function validateRuntimeVerification(verification, manifest) {
  const value = verification && typeof verification === 'object' ? verification : {};
  const errors = [];
  if (value.schema !== RUNTIME_VERIFICATION_SCHEMA) errors.push('RUNTIME_VERIFICATION_RECEIPT_MISSING');
  if (value.decision !== 'PASS' || value.files_verified !== true || (Array.isArray(value.errors) && value.errors.length)) errors.push('RUNTIME_BUNDLE_NOT_VERIFIED');
  if (!manifest || value.runtime_manifest_sha256 !== manifest.manifest_sha256) errors.push('RUNTIME_VERIFICATION_MANIFEST_MISMATCH');
  return errors;
}

function evaluateGate(input) {
  const packet = input && typeof input === 'object' ? input : {};
  const networkEvidence = packet.networkEvidence || packet.network_evidence || {};
  const runtimeManifest = packet.runtimeManifest || packet.runtime_manifest || {};
  const runtimeVerification = packet.runtimeVerification || packet.runtime_verification || {};
  const candidate = packet.candidateReceipt || packet.candidate_receipt || {};
  const lifecycle = packet.lifecycleReceipt || packet.lifecycle_receipt || {};
  const errors = [
    ...validateNetworkEvidence(networkEvidence),
    ...validateRuntimeManifest(runtimeManifest),
    ...validateRuntimeVerification(runtimeVerification, runtimeManifest)
  ];

  if (!['x64', 'AMD64'].includes(runtimeManifest.architecture)) errors.push('RUNTIME_ARCHITECTURE_NOT_X64');

  if (candidate.decision !== 'PASS') errors.push('CANDIDATE_NOT_PASS');
  if (!isSha256(candidate.candidate_sha256)) errors.push('CANDIDATE_DIGEST_MISSING');
  if (candidate.bundled_runtime_before_first_launch !== true) errors.push('CANDIDATE_RUNTIME_NOT_BUNDLED');
  if (lifecycle.decision !== 'PASS') errors.push('LIFECYCLE_NOT_PASS');
  if (!lifecycle.readiness || lifecycle.readiness.bind !== '127.0.0.1') errors.push('LIFECYCLE_NOT_LOOPBACK');
  if (lifecycle.port_released !== true) errors.push('LIFECYCLE_PORT_NOT_RELEASED');
  if (lifecycle.runtime_from_candidate_bundle !== true) errors.push('LIFECYCLE_RUNTIME_SOURCE_UNPROVEN');
  if (lifecycle.started_with_network_adapters_disabled !== true) errors.push('LIFECYCLE_ADAPTER_STATE_UNPROVEN');
  if (lifecycle.network_trace_request_count !== 0) errors.push('LIFECYCLE_NETWORK_TRACE_NOT_ZERO');

  const uniqueErrors = [...new Set(errors)];
  const physical = networkEvidence.evidence_level === 'PHYSICAL_WINDOWS_TARGET';
  const actualRuntime = runtimeManifest.synthetic_fixture === false;
  const proven = uniqueErrors.length === 0 && physical && actualRuntime;
  return {
    schema: GATE_SCHEMA,
    decision: uniqueErrors.length ? 'HOLD' : 'PASS',
    errors: uniqueErrors,
    network_evidence_level: networkEvidence.evidence_level || null,
    runtime_synthetic_fixture: typeof runtimeManifest.synthetic_fixture === 'boolean' ? runtimeManifest.synthetic_fixture : null,
    runtime_manifest_sha256: runtimeManifest.manifest_sha256 || null,
    candidate_digest: candidate.candidate_sha256 || null,
    windows_offline_first_proven: proven,
    physical_proof: proven,
    public_support: false,
    publication_authority: false
  };
}

function validateGateReceipt(receipt) {
  const value = receipt && typeof receipt === 'object' ? receipt : {};
  const errors = [];
  if (value.schema !== GATE_SCHEMA) errors.push('GATE_SCHEMA_MISMATCH');
  if (!['PASS', 'HOLD'].includes(value.decision)) errors.push('GATE_DECISION_INVALID');
  if (!Array.isArray(value.errors)) errors.push('GATE_ERRORS_MISSING');
  if (value.decision === 'PASS' && value.errors && value.errors.length) errors.push('PASS_WITH_ERRORS');
  if (value.windows_offline_first_proven === true) {
    if (value.decision !== 'PASS') errors.push('PROOF_WITHOUT_PASS');
    if (value.physical_proof !== true) errors.push('PROOF_WITHOUT_PHYSICAL_EVIDENCE');
    if (value.network_evidence_level !== 'PHYSICAL_WINDOWS_TARGET') errors.push('PROOF_WITHOUT_PHYSICAL_WINDOWS_EVIDENCE');
    if (value.runtime_synthetic_fixture !== false) errors.push('PROOF_WITH_SYNTHETIC_RUNTIME');
    if (!isSha256(value.runtime_manifest_sha256)) errors.push('PROOF_WITHOUT_RUNTIME_MANIFEST');
    if (!isSha256(value.candidate_digest)) errors.push('PROOF_WITHOUT_CANDIDATE_DIGEST');
  }
  if (value.public_support !== false) errors.push('PUBLIC_SUPPORT_AUTHORITY_FORBIDDEN');
  if (value.publication_authority !== false) errors.push('PUBLICATION_AUTHORITY_FORBIDDEN');
  return errors;
}

function create(options) {
  const root = path.resolve(options.root);
  const stateFile = path.join(options.stateRoot, 'diagnostics', 'windows-offline-assessments.json');
  const collector = path.join(root, 'scripts', 'collect-windows-offline-evidence.ps1');
  const runtimeProvenance = path.join(root, 'runtime', 'node', 'RUNTIME_PROVENANCE.json');

  function readLedger() {
    const fallback = { schema: LEDGER_SCHEMA, updatedAt: null, assessments: [] };
    const value = U.loadJson(stateFile, fallback);
    if (!value || value.schema !== LEDGER_SCHEMA || !Array.isArray(value.assessments)) return fallback;
    return value;
  }

  function privateRuntimeSummary() {
    if (!fs.existsSync(runtimeProvenance)) return { present: false, verifiedVersion: null, archiveSha256: null };
    const value = U.loadJson(runtimeProvenance, {});
    return {
      present: true,
      verifiedVersion: value.verified_version || value.version || null,
      archiveSha256: isSha256(value.archive_sha256) ? value.archive_sha256 : null
    };
  }

  function status() {
    const ledger = readLedger();
    const rows = ledger.assessments.slice(-100).reverse();
    const latest = rows[0] || null;
    return {
      schema: STATUS_SCHEMA,
      checkedAt: U.now(),
      platform: process.platform,
      collectorAvailable: fs.existsSync(collector),
      collectorPath: 'scripts/collect-windows-offline-evidence.ps1',
      privateRuntime: privateRuntimeSummary(),
      assessmentCount: rows.length,
      latest,
      proofState: latest && latest.gate.windows_offline_first_proven ? 'PROVEN' : latest ? 'HELD' : 'NOT_RUN',
      truth: {
        activeWorkshopPrivateRuntimeIsCandidateProof: false,
        collectorDisablesAdapters: false,
        collectorMeasuresLifecycleRequests: false,
        automaticAssessment: false,
        automaticPublication: false,
        publicSupportGranted: false
      }
    };
  }

  function preview(packet) {
    const gate = evaluateGate(packet);
    return {
      schema: PREVIEW_SCHEMA,
      gate,
      gate_validation_errors: validateGateReceipt(gate),
      source_payload_sha256: digest(packet && typeof packet === 'object' ? packet : {}),
      recorded: false
    };
  }

  function record(packet, actor) {
    const result = preview(packet);
    const receipt = {
      schema: RECEIPT_SCHEMA,
      id: 'windows-offline-' + Date.now().toString(36) + '-' + result.source_payload_sha256.slice(0, 12),
      recordedAt: U.now(),
      actor: String(actor || 'local-user').slice(0, 120),
      sourcePayloadSha256: result.source_payload_sha256,
      gate: result.gate,
      gateValidationErrors: result.gate_validation_errors,
      rawEvidenceRetained: false,
      automaticPromotion: false
    };
    const ledger = readLedger();
    ledger.updatedAt = receipt.recordedAt;
    ledger.assessments = ledger.assessments.concat(receipt).slice(-100);
    U.atomicJson(stateFile, ledger);
    return receipt;
  }

  return { stateFile, status, preview, record };
}

module.exports = {
  NETWORK_EVIDENCE_SCHEMA,
  RUNTIME_MANIFEST_SCHEMA,
  RUNTIME_VERIFICATION_SCHEMA,
  GATE_SCHEMA,
  STATUS_SCHEMA,
  PREVIEW_SCHEMA,
  RECEIPT_SCHEMA,
  stableValue,
  stableJson,
  digest,
  validateWindowsRelative,
  validateNetworkEvidence,
  validateRuntimeManifest,
  buildRuntimeManifest,
  verifyRuntimeBundle,
  stageRuntimeBundle,
  validateRuntimeVerification,
  evaluateGate,
  validateGateReceipt,
  create
};
