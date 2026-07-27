'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const Hands = require('../../asset-hands/asset-hands');
const TargetCanvas = require('../../asset-hands/target-canvas');
const Bridge = require('../../asset-hands/native-bridge-codec');
const PackageCodec = require('../package-codec');
const BlenderPackage = require('../blender/package');
const { NativeHostRuntime } = require('../runtime');
const { MirrorNativeHostAdapter } = require('../mirror-adapter');
const { NativeAdapterRegistry } = require('../registry');
const { MirrorCore, MIKE_ID, AI_ID } = require('../../mirror-core/core/mirror-core');

const BLENDER_ROOT = path.resolve(__dirname, '..', 'blender');
const MIRROR_ROOT = path.resolve(__dirname, '..', '..', 'mirror-core');

function atomicJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
}

class FakeBlenderDriver {
  constructor(options) {
    options = options || {};
    this.calls = [];
    this.failAfterWrite = options.failAfterWrite || false;
  }

  apply(input) {
    this.calls.push({ mode: 'apply', project: input.project_file });
    const request = JSON.parse(fs.readFileSync(input.request_file, 'utf8'));
    const project = {
      format: 'fake-blend-for-contract-test',
      bundle_id: request.bundle_id,
      change_digest: request.change_digest,
      source_digest: request.source_digest,
      metadata: request.metadata || {},
      objects: [{ name: 'ImportedMesh', type: 'MESH', vertices: 8, polygons: 12 }]
    };
    atomicJson(request.project_file, project);
    if (this.failAfterWrite) throw new Error('simulated native process failure after project write');
    return this.facts(request, 'apply');
  }

  inspect(input) {
    this.calls.push({ mode: 'inspect', project: input.project_file });
    const request = JSON.parse(fs.readFileSync(input.request_file, 'utf8'));
    return this.facts(request, 'inspect');
  }

  facts(request, mode) {
    const project = JSON.parse(fs.readFileSync(request.project_file, 'utf8'));
    return {
      ok: project.change_digest === request.change_digest && project.source_digest === request.source_digest,
      mode,
      blender_version: '4.4.3',
      project_file: request.project_file,
      project_digest: PackageCodec.sha256File(request.project_file),
      object_count: project.objects.length,
      mesh_count: 1,
      vertices: 8,
      polygons: 12,
      matching_object_count: 1,
      axm_bundle_id: project.bundle_id,
      axm_change_digest: project.change_digest,
      axm_source_digest: project.source_digest,
      axm_metadata: project.metadata || {},
      objects: project.objects,
      unit_system: 'METRIC',
      unit_scale_length: 1
    };
  }
}

function fixture(t, options) {
  options = options || {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-native-host-test-'));
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  const pair = crypto.generateKeyPairSync('ed25519');
  const manifest = BlenderPackage.seal(BLENDER_ROOT, 'test-key', pair.privateKey);
  const trustStore = {
    'test-key': {
      public_key: pair.publicKey,
      package_ids: ['axm.native.blender.reference']
    }
  };
  const driver = options.driver || new FakeBlenderDriver();
  const runtime = new NativeHostRuntime({
    workspaceRoot: workspace,
    packageRoot: BLENDER_ROOT,
    manifest,
    trustStore,
    driver,
    faultInjector: options.faultInjector || null,
    clock: function () { return '2026-07-19T12:00:00.000Z'; }
  });
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  return { root, workspace, pair, manifest, trustStore, driver, runtime };
}

function targetCanvas(overrides) {
  const value = {
    medium: '3d-surface',
    dimensions: { width: 4, height: 2, unit: 'm' },
    colour: { space: 'material-channel', transparency: 'opaque', bit_depth: 8 },
    spatial: { coordinate_unit: 'm', up_axis: 'y', handedness: 'right', world_scale: 1, origin: [0, 0, 0] },
    behaviour: ['static'],
    performance: { max_file_bytes: 500000, max_polygon_count: 100000, max_vertices: 80000 },
    intended_use: 'native-bridge'
  };
  Object.assign(value, overrides || {});
  return TargetCanvas.inspect(value).canvas;
}

function adapterManifest(canvas) {
  return Bridge.sealManifest({
    id: 'blender',
    contract_version: '1.0.0',
    application_version: '4.4.3',
    canvas_mediums: ['3d-surface'],
    units: ['m'],
    colour_spaces: ['material-channel'],
    transparency_modes: ['opaque'],
    behaviours: ['static'],
    intended_uses: ['native-bridge'],
    supported_constraints: TargetCanvas.requestedConstraints(canvas)
  });
}

function makeBundle(runtime, workspace, suffix, canvas) {
  suffix = suffix || 'demo';
  canvas = canvas || targetCanvas();
  const stagedRelative = 'staging/' + suffix + '.glb';
  const staged = path.join(workspace, stagedRelative);
  fs.mkdirSync(path.dirname(staged), { recursive: true });
  fs.writeFileSync(staged, Buffer.from('glTF-contract-fixture-' + suffix));
  const projectRoot = 'projects/' + suffix;
  const projectFile = projectRoot + '/' + suffix + '.blend';
  const baseline = runtime.baselineForProject(projectFile);
  const value = {
    schema: 'axm.native-bridge-bundle/v1',
    version: '1.0.0',
    id: 'bridge-bundle-' + suffix,
    adapter: adapterManifest(canvas),
    project: { id: suffix, adapter_id: 'blender', root: projectRoot, project_file: projectFile },
    change: {
      target_canvas_digest: Bridge.sha256(canvas),
      source_artifact: {
        digest: PackageCodec.sha256File(staged),
        mime: 'model/gltf-binary',
        format: 'GLB 2.0',
        staged_path: stagedRelative
      },
      operations: [
        { type: 'create-directory', path: projectRoot + '/assets' },
        { type: 'import-asset', path: projectRoot + '/assets/' + suffix + '.glb', source_path: stagedRelative },
        { type: 'set-metadata', path: projectRoot + '/assets/' + suffix + '.glb', metadata: { axm_test: suffix } },
        { type: 'refresh-index', path: projectRoot + '/assets' }
      ]
    },
    approval: {
      bound_change_digest: '',
      human: { approved: true, actor: 'human:mike' },
      machine: { approved: true, actor: 'machine:axm-governor', receipt_digest: Bridge.sha256('governance-' + suffix) }
    },
    rollback: {
      reversible: true,
      strategy: 'restore-project-snapshot',
      snapshot_digest: baseline.digest,
      snapshot_path: 'snapshots/' + suffix + '-before.blend'
    },
    host_application_receipt: null,
    provenance: { fabric_record_id: 'fabric-' + suffix, studio_handoff_id: 'studio-' + suffix }
  };
  value.approval.bound_change_digest = Bridge.validate(value).changeDigest;
  assert.equal(Bridge.validate(value).pass, true, Bridge.validate(value).errors.join('; '));
  return { bundle: value, canvas, staged };
}

test('signed package verification binds identity, capabilities and fixed entrypoint bytes', function (t) {
  const value = fixture(t);
  const checked = PackageCodec.verify(value.manifest, { packageRoot: BLENDER_ROOT, trustStore: value.trustStore });
  assert.equal(checked.ok, true, checked.errors.join('; '));
  assert.equal(checked.signature_verified, true);
  const tampered = JSON.parse(JSON.stringify(value.manifest));
  tampered.capabilities.source_mime_types.push('application/x-python');
  assert.equal(PackageCodec.verify(tampered, { packageRoot: BLENDER_ROOT, trustStore: value.trustStore }).ok, false);
  const untrusted = PackageCodec.verify(value.manifest, { packageRoot: BLENDER_ROOT, trustStore: {} });
  assert.equal(untrusted.ok, false);
  assert.match(untrusted.errors.join('; '), /not trusted/);
});

test('shared native registry selects compatible signed packages and fails unsupported canvases honestly', function (t) {
  const value = fixture(t);
  const registry = new NativeAdapterRegistry({ trustStore: value.trustStore });
  registry.register({ manifest: value.manifest, packageRoot: BLENDER_ROOT });
  const request = {
    adapter_id: 'blender', application_version: '4.4.3', target_canvas: targetCanvas(),
    source_mime: 'model/gltf-binary', operations: ['create-directory', 'import-asset', 'set-metadata', 'refresh-index']
  };
  assert.equal(registry.diagnose(request).status, 'MATCHED');
  assert.equal(registry.diagnose(Object.assign({}, request, { application_version: '5.2.0' })).status, 'MATCHED');
  const futureVersion = registry.diagnose(Object.assign({}, request, { application_version: '5.3.0' }));
  assert.equal(futureVersion.status, 'MISSING_NATIVE_CAPABILITY');
  assert(futureVersion.rejections[0].reasons.includes('APPLICATION_VERSION_UNSUPPORTED'));
  const profile = registry.hostProfile(request);
  assert(profile.capabilities.includes('native-dcc-adapter'));
  assert(profile.permissions.includes('filesystem:write'));
  const fabricRequest = Object.assign({}, request, { target_canvas: targetCanvas({ medium: 'fabric' }) });
  assert.equal(registry.diagnose(fabricRequest).status, 'UNSUPPORTED_CANVAS');
  const unsupportedProfile = registry.hostProfile(fabricRequest);
  assert(!unsupportedProfile.capabilities.includes('native-dcc-adapter'));
  assert.equal(registry.diagnose(Object.assign({}, request, { adapter_id: 'unreal' })).status, 'MISSING_NATIVE_ADAPTER');
});

test('canvas, source, bundle approval and exact baseline reach the signed adapter boundary', function (t) {
  const value = fixture(t);
  const built = makeBundle(value.runtime, value.workspace, 'coverage');
  const preview = value.runtime.preview({ bundle: built.bundle, targetCanvas: built.canvas, sourcePath: built.staged });
  assert.equal(preview.ok, true, preview.errors.join('; '));
  assert.equal(preview.package_signature_verified, true);
  assert.equal(preview.canvas_coverage.checks.every(function (item) { return item.pass; }), true);

  const wrongCanvas = JSON.parse(JSON.stringify(built.canvas));
  wrongCanvas.medium = 'fabric';
  const unsupported = value.runtime.preview({ bundle: built.bundle, targetCanvas: wrongCanvas, sourcePath: built.staged });
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.errors.join('; '), /target canvas|does not cover/);

  fs.appendFileSync(built.staged, 'tampered');
  const tamperedSource = value.runtime.preview({ bundle: built.bundle, targetCanvas: built.canvas, sourcePath: built.staged });
  assert.equal(tamperedSource.ok, false);
  assert.match(tamperedSource.errors.join('; '), /source bytes/);
});

test('apply writes ahead, reopens in an independent process, binds its receipt and is idempotent', async function (t) {
  const value = fixture(t);
  const built = makeBundle(value.runtime, value.workspace, 'apply');
  const prepared = value.runtime.prepare({ bundle: built.bundle, targetCanvas: built.canvas, sourcePath: built.staged });
  assert.equal(prepared.state, 'PREPARED');
  const receipt = value.runtime.apply(prepared.transaction_id);
  assert.equal(value.runtime.read(prepared.transaction_id).state, 'INSPECTED');
  assert.equal(receipt.independently_verified, true);
  assert.equal(receipt.adapter_package_id, 'axm.native.blender.reference');
  assert.equal(receipt.adapter_package_signature_verified, true);
  assert.equal(receipt.host_application_version_actual, '4.4.3');
  assert.equal(receipt.source_digest, built.bundle.change.source_artifact.digest);
  assert.match(receipt.project_digest, /^[a-f0-9]{64}$/);
  assert.match(receipt.inspection_digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(value.driver.calls.map(function (item) { return item.mode; }), ['apply', 'inspect']);
  assert.deepEqual(value.runtime.apply(prepared.transaction_id), receipt);
  assert.equal(value.driver.calls.length, 2);

  const finishedBundle = JSON.parse(JSON.stringify(built.bundle));
  finishedBundle.host_application_receipt = receipt;
  const handResult = await Hands.createAsync('native-dcc-bridge', {
    id: 'verified-native-finish',
    title: 'Verified native finish',
    kind: 'native-bridge',
    operation_mode: 'finish',
    intended_use: 'native-bridge',
    target_canvas: built.canvas,
    required_outputs: ['bridge-receipt'],
    editable_recipe_formats: ['axm.native-bridge-recipe/v1'],
    source_artifacts: [{
      id: 'native-bridge-bundle', role: 'source', mime: 'application/json', format: 'JSON',
      text: JSON.stringify(finishedBundle), digest: Bridge.sha256(finishedBundle), editable: true,
      metadata: { schema: 'axm.native-bridge-bundle/v1' }
    }]
  }, {
    host: { capabilities: ['json', 'svg', 'native-dcc-adapter'], permissions: ['filesystem:write', 'plugin-data'], accepts: [Hands.RESULT_SCHEMA, 'application/json', 'image/svg+xml'] },
    createdAt: '2026-07-19T12:00:00Z', seed: 'verified-native-finish'
  });
  assert.equal(handResult.status, 'READY');
  const bridgeReceipt = JSON.parse(handResult.artifacts.find(function (item) { return item.id === 'bridge-receipt'; }).text);
  assert.equal(bridgeReceipt.result, 'HOST_REPORTED_INSPECTED');
  assert.equal(bridgeReceipt.independently_verified_application, false);
  assert.equal(bridgeReceipt.host_reported_independent_inspection, true);
  assert.equal(bridgeReceipt.host_application_receipt.inspection_digest, receipt.inspection_digest);
  assert.equal(bridgeReceipt.integrity.cryptographic_signature_verified, false);
});

test('crash after native save becomes visible recovery work and rollback is idempotent', function (t) {
  let crashed = false;
  const value = fixture(t, {
    faultInjector: function (point) {
      if (point === 'after-native-save-before-commit' && !crashed) {
        crashed = true;
        throw new Error('simulated coordinator crash');
      }
    }
  });
  const built = makeBundle(value.runtime, value.workspace, 'crash');
  const prepared = value.runtime.prepare({ bundle: built.bundle, targetCanvas: built.canvas, sourcePath: built.staged });
  assert.throws(function () { value.runtime.apply(prepared.transaction_id); }, /simulated coordinator crash/);
  assert.equal(value.runtime.read(prepared.transaction_id).state, 'RECOVERY_REQUIRED');
  assert.equal(value.runtime.listRecoveryRequired().length, 1);
  const rollback = value.runtime.rollback(prepared.transaction_id);
  assert.equal(rollback.ok, true);
  assert.equal(rollback.removed_created_project, true);
  assert.equal(fs.existsSync(path.join(value.workspace, built.bundle.project.project_file)), false);
  assert.deepEqual(value.runtime.rollback(prepared.transaction_id), rollback);
});

test('crash during project materialization is journaled before writes and can be cleaned explicitly', function (t) {
  let crashed = false;
  const value = fixture(t, {
    faultInjector: function (point) {
      if (point === 'after-project-materialization-before-prepare-commit' && !crashed) {
        crashed = true;
        throw new Error('simulated prepare coordinator crash');
      }
    }
  });
  const built = makeBundle(value.runtime, value.workspace, 'prepare-crash');
  assert.throws(function () { value.runtime.prepare({ bundle: built.bundle, targetCanvas: built.canvas, sourcePath: built.staged }); }, /prepare coordinator crash/);
  const transactionId = value.runtime.transactionId(Bridge.validate(built.bundle).changeDigest);
  const record = value.runtime.read(transactionId);
  assert.equal(record.history[0].state, 'PREPARING');
  assert.equal(record.state, 'RECOVERY_REQUIRED');
  assert.equal(fs.existsSync(path.join(value.workspace, record.imported_path)), true);
  assert.equal(value.runtime.rollback(transactionId).ok, true);
  assert.equal(fs.existsSync(path.join(value.workspace, record.imported_path)), false);
});

test('partial native failure is never success and later project edits block destructive rollback', function (t) {
  const partial = fixture(t, { driver: new FakeBlenderDriver({ failAfterWrite: true }) });
  const failed = makeBundle(partial.runtime, partial.workspace, 'partial');
  const prepared = partial.runtime.prepare({ bundle: failed.bundle, targetCanvas: failed.canvas, sourcePath: failed.staged });
  assert.throws(function () { partial.runtime.apply(prepared.transaction_id); }, /simulated native process failure/);
  assert.equal(partial.runtime.read(prepared.transaction_id).state, 'RECOVERY_REQUIRED');
  assert.equal(partial.runtime.rollback(prepared.transaction_id).ok, true);

  const value = fixture(t);
  const built = makeBundle(value.runtime, value.workspace, 'post-edit');
  const next = value.runtime.prepare({ bundle: built.bundle, targetCanvas: built.canvas, sourcePath: built.staged });
  value.runtime.apply(next.transaction_id);
  fs.appendFileSync(path.join(value.workspace, built.bundle.project.project_file), 'external-edit');
  assert.throws(function () { value.runtime.rollback(next.transaction_id); }, /changed after transaction/);
  assert.equal(value.runtime.read(next.transaction_id).state, 'INSPECTED');
});

test('Mirror can inject the native adapter without auto-consent, then approve, inspect and roll back it', function (t) {
  const value = fixture(t);
  const built = makeBundle(value.runtime, value.workspace, 'mirror');
  const adapter = new MirrorNativeHostAdapter({ runtime: value.runtime });
  const mirrorRuntime = path.join(value.root, 'mirror-runtime');
  const core = new MirrorCore({ rootDir: MIRROR_ROOT, runtimeDir: mirrorRuntime, additionalAdapters: [adapter] });
  assert.equal(adapter.connection.mode, 'disconnected');
  const mike = core.actor(MIKE_ID);
  const consent = core.consentFor(adapter);
  core.consentEngine.grant(consent, mike);
  core.bridge.connect(adapter.descriptor.adapter_id, 'approved_apply', mike, consent.consent_id);

  const packet = core.createProposal({
    source_system: 'asset-fabric',
    target_system: adapter.descriptor.source_system_id,
    target_adapter_id: adapter.descriptor.adapter_id,
    actor_id: AI_ID,
    intent: 'Apply the exact signed Blender transaction.',
    reason: 'Native host adapter integration contract test.',
    operations: [{ type: 'request_adapter_action', action: 'apply_native_bridge_bundle', bundle: built.bundle, target_canvas: built.canvas, source_path: built.staged }],
    affected_entities: [], evidence_refs: [], reversibility: 'reversible'
  });
  core.validateProposal(packet.packet_id, AI_ID);
  core.propose(packet.packet_id, AI_ID);
  core.review(packet.packet_id, MIKE_ID, 'Native transaction review');
  core.approve(packet.packet_id, MIKE_ID, 'Native transaction approval');
  const applied = core.apply(packet.packet_id, MIKE_ID);
  assert.equal(applied.receipt.adapter_receipt.independently_verified, true);
  assert.equal(core.verify(applied.receipt.application_id, MIKE_ID).ok, true);
  assert.equal(core.rollback(applied.receipt.application_id, MIKE_ID).status, 'ROLLED_BACK');
  assert.equal(fs.existsSync(path.join(value.workspace, built.bundle.project.project_file)), false);
});
