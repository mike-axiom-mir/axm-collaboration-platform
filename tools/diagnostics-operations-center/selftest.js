#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Diagnostics = require('../../shared/operations/diagnostics-service');
const WindowsOffline = require('../../shared/operations/windows-offline-gate-service');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const html = read('index.html'), app = read('app.js'), css = read('diagnostics-center.css');
const service = fs.readFileSync(path.join(__dirname, '../../shared/operations/diagnostics-service.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../../shared/operations/operations-api.js'), 'utf8');
let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('PASS  ' + label); }

check('Diagnostics is a modern TEST product at v0.3', () => {
  assert.equal(manifest.schema, 'axm.tool-manifest/v1');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.status, 'TEST');
  assert.equal(manifest.version, 'v0.3');
});
check('Manifest and contract identity version and permissions agree', () => {
  assert.equal(contract.id, manifest.id);
  assert.equal(contract.version, manifest.version);
  assert.deepStrictEqual(contract.permissions, manifest.permissions);
  assert(ContractVerifier.validateContract(contract, manifest).pass);
});
check('Contract declares isolated probes and partial snapshots', () => {
  assert(contract.provides.includes('isolated-diagnostic-probes'));
  assert(contract.provides.includes('partial-health-snapshot-on-probe-failure'));
});
check('Contract declares bounded redacted digest-bearing log envelopes', () => {
  assert(contract.provides.includes('available-log-source-catalog'));
  assert(contract.provides.includes('bounded-redacted-log-envelope'));
  assert(contract.provides.includes('diagnostic-log-content-digest'));
});
check('Contract declares persistent export lineage', () => {
  assert(contract.provides.includes('persistent-diagnostic-export-lineage'));
  assert(contract.boundaries.writes.includes('state/diagnostics/export-lineage.json'));
});
check('Contract adds the Windows offline evidence gate without deployment authority', () => {
  assert(contract.provides.includes('windows-offline-evidence-validation'));
  assert(contract.provides.includes('windows-offline-proof-gate'));
  assert(contract.boundaries.refuses.includes('network-adapter-mutation'));
  assert(contract.boundaries.refuses.includes('offline-proof-from-point-in-time-snapshot'));
});
check('Contract refuses authority and certification collapse', () => {
  ['automatic-repair','automatic-restart','automatic-export','arbitrary-log-path','raw-log-return','redaction-as-secret-free-certification','health-as-certification','diagnostic-evidence-as-promotion-approval'].forEach(value => assert(contract.boundaries.refuses.includes(value)));
});
check('Service exports versioned snapshot log and lineage schemas', () => {
  assert.equal(Diagnostics.SNAPSHOT_SCHEMA, 'axm.diagnostics-snapshot/v2');
  assert.equal(Diagnostics.LOG_CATALOG_SCHEMA, 'axm.diagnostics-log-source-catalog/v1');
  assert.equal(Diagnostics.LOG_ENVELOPE_SCHEMA, 'axm.diagnostics-log-envelope/v1');
  assert.equal(Diagnostics.EXPORT_LINEAGE_SCHEMA, 'axm.diagnostics-export-lineage/v1');
});
check('Every diagnostic probe is wrapped by the contained runner', () => {
  assert(service.includes('function runProbe(spec)'));
  assert(service.includes("state: 'UNAVAILABLE'"));
  assert(service.includes('partialSnapshotOnProbeFailure: true'));
});
check('Log source resolution never eagerly dereferences optional adapters', () => {
  assert(service.includes('function resolvedSources()'));
  assert(service.includes("state: resolutionError ? 'UNAVAILABLE'"));
  assert(service.includes("'NOT_CONFIGURED'"));
});
check('Log envelopes bound bytes and carry a content digest', () => {
  assert(service.includes('Math.min(200000'));
  assert(service.includes('contentSha256: U.sha256(encoded)'));
});
check('Log output uses structured and pattern redaction without certification', () => {
  assert(service.includes('BEST_EFFORT_STRUCTURED_AND_PATTERN_REDACTION'));
  assert(service.includes('secretFreeCertified: false'));
  assert(service.includes('rawLogReturned: false'));
});
check('Export writes report receipt and bounded persistent lineage', () => {
  assert(service.includes("id + '.receipt.json'"));
  assert(service.includes('lineage.exports = lineage.exports.slice(-200)'));
  assert(service.includes('automaticExport: false'));
});
check('Read-only Diagnostics routes expose snapshot sources logs and lineage', () => {
  ['/api/diagnostics\'','/api/diagnostics/log-sources','/api/diagnostics/logs','/api/diagnostics/exports'].forEach(route => assert(api.includes(route)));
});
check('Windows offline routes separate preview from explicit receipt recording', () => {
  assert(api.includes("/api/diagnostics/windows-offline/preview"));
  assert(api.includes("/api/diagnostics/windows-offline/record"));
  assert(api.includes("'x-axm-windows-offline', 'record-reviewed-gate'"));
});
check('Export route retains explicit intent and temporary-session mutation guard', () => {
  const route = api.slice(api.indexOf("if (url === '/api/diagnostics/export'"), api.indexOf("if (url === '/api/search'"));
  assert(route.includes('mutationAllowed()'));
  assert(route.includes("explicit(req, 'x-axm-diagnostics', 'explicit-export')"));
});
check('Browser loads snapshot source catalog and export lineage independently', () => {
  assert(app.includes("O.get('/api/diagnostics')"));
  assert(app.includes("O.get('/api/diagnostics/log-sources')"));
  assert(app.includes("O.get('/api/diagnostics/exports')"));
  assert(app.includes('function result(promise)'));
});
check('Browser makes probe states and redaction limits visible', () => {
  assert(html.includes('Diagnostic probes'));
  assert(html.includes('Redaction is a guard, not a guarantee.'));
  assert(app.includes('secret-free certification: NO'));
});
check('Browser exposes the offline gate and keeps its truth ceiling visible', () => {
  assert(html.includes('id="offline-gate"'));
  assert(html.includes('cannot disable adapters, install a runtime, publish, or grant public support'));
  assert(app.includes("O.post('/api/diagnostics/windows-offline/preview'"));
  assert(app.includes("'x-axm-windows-offline':'record-reviewed-gate'"));
});
check('Browser does not shadow service truth in local storage', () => {
  assert(!/localStorage|sessionStorage/.test(app + html));
});
check('Interface has local-only assets and no mojibake markers', () => {
  assert(!/https?:\/\//.test(html));
  assert(!/[Ââ]/.test(html + app));
});
check('Interface has responsive probe log and metric layouts', () => {
  assert(css.includes('@media (max-width: 700px)'));
  assert(css.includes('.probe-grid'));
  assert(css.includes('.log-controls'));
  assert(css.includes('.metric-grid'));
});
check('Interface retains visible Hub return and keyboard skip route', () => {
  assert(html.includes('href="../../hub/index.html"'));
  assert(html.includes('class="skip-link"'));
  assert(html.includes('tabindex="0"'));
});

function runtimeManifest(synthetic) {
  const bytes = Buffer.from('runtime-fixture');
  const unsigned = {
    schema: WindowsOffline.RUNTIME_MANIFEST_SCHEMA,
    runtime_id: synthetic ? 'SYNTHETIC' : 'NODE-X64',
    version: '1.0.0',
    architecture: 'x64',
    launcher_relative: 'node.exe',
    synthetic_fixture: synthetic,
    entries: [{ path: 'node.exe', size: bytes.length, sha256: require('crypto').createHash('sha256').update(bytes).digest('hex') }]
  };
  return { bytes, manifest: Object.assign({}, unsigned, { manifest_sha256: WindowsOffline.digest(unsigned) }) };
}
function gatePacket(synthetic) {
  const built = runtimeManifest(synthetic);
  return {
    networkEvidence: {
      schema: WindowsOffline.NETWORK_EVIDENCE_SCHEMA,
      evidence_level: synthetic ? 'SYNTHETIC_WINDOWS_FIXTURE' : 'PHYSICAL_WINDOWS_TARGET',
      target_os: 'Windows', architecture: 'AMD64', collector_changes_made: false,
      adapters: [{ name: 'Ethernet', hardware_interface: true, status: 'Disabled' }],
      default_routes: [], active_ip_addresses: ['127.0.0.1', '::1'], dns_servers: [], proxy_enabled: false,
      network_requests_observed: 0,
      network_observation: { request_count_measured: true, lifecycle_window: 'candidate-start-to-owned-stop', outbound_connections: [] }
    },
    runtimeManifest: built.manifest,
    runtimeVerification: { schema: WindowsOffline.RUNTIME_VERIFICATION_SCHEMA, decision: 'PASS', errors: [], files_verified: true, runtime_manifest_sha256: built.manifest.manifest_sha256 },
    candidateReceipt: { decision: 'PASS', candidate_sha256: '1'.repeat(64), bundled_runtime_before_first_launch: true },
    lifecycleReceipt: { decision: 'PASS', readiness: { bind: '127.0.0.1' }, port_released: true, runtime_from_candidate_bundle: true, started_with_network_adapters_disabled: true, network_trace_request_count: 0 }
  };
}

check('Synthetic evidence may pass structure but never becomes physical proof', () => {
  const gate = WindowsOffline.evaluateGate(gatePacket(true));
  assert.equal(gate.decision, 'PASS');
  assert.equal(gate.windows_offline_first_proven, false);
  assert.deepStrictEqual(WindowsOffline.validateGateReceipt(gate), []);
});
check('A complete physical packet reaches proof without granting support or publication', () => {
  const gate = WindowsOffline.evaluateGate(gatePacket(false));
  assert.equal(gate.windows_offline_first_proven, true);
  assert.equal(gate.public_support, false);
  assert.equal(gate.publication_authority, false);
});
check('Missing lifecycle trace and enabled hardware stay explicit holds', () => {
  const packet = gatePacket(false);
  packet.networkEvidence.adapters[0].status = 'Up';
  packet.networkEvidence.network_requests_observed = null;
  packet.networkEvidence.network_observation.request_count_measured = false;
  packet.lifecycleReceipt.network_trace_request_count = null;
  const gate = WindowsOffline.evaluateGate(packet);
  assert.equal(gate.decision, 'HOLD');
  assert(gate.errors.some(value => value.startsWith('HARDWARE_ADAPTER_NOT_DISABLED')));
  assert(gate.errors.includes('NETWORK_REQUEST_COUNT_UNMEASURED'));
  assert(gate.errors.includes('LIFECYCLE_NETWORK_TRACE_NOT_ZERO'));
});
check('Forged proof claims fail receipt validation', () => {
  const gate = WindowsOffline.evaluateGate(gatePacket(true));
  gate.windows_offline_first_proven = true;
  gate.physical_proof = true;
  assert(WindowsOffline.validateGateReceipt(gate).includes('PROOF_WITHOUT_PHYSICAL_WINDOWS_EVIDENCE'));
  assert(WindowsOffline.validateGateReceipt(gate).includes('PROOF_WITH_SYNTHETIC_RUNTIME'));
});
check('Runtime verifier binds every file and rejects undeclared additions', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-windows-runtime-test-'));
  try {
    const built = runtimeManifest(false);
    fs.writeFileSync(path.join(temp, 'node.exe'), built.bytes);
    assert.equal(WindowsOffline.verifyRuntimeBundle(temp, built.manifest).decision, 'PASS');
    fs.writeFileSync(path.join(temp, 'extra.dll'), 'extra');
    assert(WindowsOffline.verifyRuntimeBundle(temp, built.manifest).errors.includes('RUNTIME_UNDECLARED_FILE:extra.dll'));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
check('Preview is read only and explicit recording retains only digest plus gate result', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-windows-gate-test-'));
  try {
    const root = path.join(temp, 'workshop'), stateRoot = path.join(root, 'state');
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'scripts', 'collect-windows-offline-evidence.ps1'), '# fixture');
    const service = WindowsOffline.create({ root, stateRoot });
    const preview = service.preview(gatePacket(true));
    assert.equal(preview.recorded, false);
    assert.equal(fs.existsSync(service.stateFile), false);
    const receipt = service.record(gatePacket(true), 'Mike');
    assert.equal(receipt.rawEvidenceRetained, false);
    assert.equal(service.status().assessmentCount, 1);
    assert.equal(JSON.stringify(receipt).includes('Ethernet'), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

console.log('Diagnostics & Operations Center selftest: PASS (' + pass + ' controls)');
