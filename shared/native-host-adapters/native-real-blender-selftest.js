#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Hands = require('../asset-hands/asset-hands');
const TargetCanvas = require('../asset-hands/target-canvas');
const Bridge = require('../asset-hands/native-bridge-codec');
const PackageCodec = require('./package-codec');
const BlenderPackage = require('./blender/package');
const { BlenderDriver } = require('./blender/blender-driver');
const { NativeHostRuntime } = require('./runtime');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function bytesFromDataUrl(value) {
  const match = /^data:[^;,]+;base64,(.+)$/.exec(String(value || ''));
  if (!match) throw new Error('Asset Hand did not emit a base64 GLB data URL');
  return Buffer.from(match[1], 'base64');
}

function canvas() {
  return TargetCanvas.inspect({
    medium: '3d-surface',
    dimensions: { width: 2, height: 1, depth: 1, unit: 'm' },
    colour: { space: 'material-channel', transparency: 'opaque', bit_depth: 8 },
    spatial: { coordinate_unit: 'm', up_axis: 'y', handedness: 'right', world_scale: 1, origin: [0, 0, 0] },
    behaviour: ['static'],
    performance: { max_file_bytes: 5000000, max_polygon_count: 1000, max_vertices: 1000 },
    intended_use: 'native-bridge'
  }).canvas;
}

function bridgeBundle(runtime, staged, targetCanvas, applicationVersion) {
  const projectRoot = 'projects/real-blender';
  const projectFile = projectRoot + '/real-blender.blend';
  const baseline = runtime.baselineForProject(projectFile);
  const adapter = Bridge.sealManifest({
    id: 'blender', contract_version: '1.0.0', application_version: applicationVersion,
    canvas_mediums: ['3d-surface'], units: ['m'], colour_spaces: ['material-channel'],
    transparency_modes: ['opaque'], behaviours: ['static'], intended_uses: ['native-bridge'],
    supported_constraints: TargetCanvas.requestedConstraints(targetCanvas)
  });
  const value = {
    schema: 'axm.native-bridge-bundle/v1', version: '1.0.0', id: 'real-blender-reference-test', adapter,
    project: { id: 'real-blender', adapter_id: 'blender', root: projectRoot, project_file: projectFile },
    change: {
      target_canvas_digest: Bridge.sha256(targetCanvas),
      source_artifact: { digest: PackageCodec.sha256File(staged), mime: 'model/gltf-binary', format: 'GLB 2.0', staged_path: 'staging/real-model.glb' },
      operations: [
        { type: 'create-directory', path: projectRoot + '/assets' },
        { type: 'import-asset', path: projectRoot + '/assets/real-model.glb', source_path: 'staging/real-model.glb' },
        { type: 'set-metadata', path: projectRoot + '/assets/real-model.glb', metadata: { axm_reference_test: true } },
        { type: 'refresh-index', path: projectRoot + '/assets' }
      ]
    },
    approval: {
      bound_change_digest: '', human: { approved: true, actor: 'human:reference-test' },
      machine: { approved: true, actor: 'machine:reference-governor', receipt_digest: Bridge.sha256('real-blender-governance') }
    },
    rollback: { reversible: true, strategy: 'restore-project-snapshot', snapshot_digest: baseline.digest, snapshot_path: 'snapshots/real-blender-before.blend' },
    host_application_receipt: null,
    provenance: { test: 'native-real-blender-selftest' }
  };
  value.approval.bound_change_digest = Bridge.validate(value).changeDigest;
  assert(Bridge.validate(value).pass, Bridge.validate(value).errors.join('; '));
  return value;
}

(function main() {
  const executable = argument('--blender');
  if (!executable) throw new Error('usage: node native-real-blender-selftest.js --blender <absolute Blender executable> [--blender-version 5.2.0]');
  const applicationVersion = argument('--blender-version') || '4.4.3';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-real-blender-'));
  const workspace = path.join(root, 'workspace');
  const blenderRoot = path.resolve(__dirname, 'blender');
  fs.mkdirSync(path.join(workspace, 'staging'), { recursive: true });
  try {
    const targetCanvas = canvas();
    const mesh = Hands.create('parametric-mesh', {
      id: 'real-blender-source', title: 'Real Blender reference crate', kind: 'mesh', intended_use: 'mesh',
      target_canvas: {
        medium: '3d-surface', dimensions: { width: 2, height: 1, depth: 1, unit: 'm' },
        colour: { space: 'material-channel', transparency: 'opaque' }, behaviour: ['static'],
        performance: { max_polygon_count: 1000, max_file_bytes: 5000000 }, intended_use: 'mesh'
      },
      required_outputs: ['model/gltf-binary'], editable_recipe_formats: ['axm.parametric-mesh-recipe/v1']
    }, {
      seed: 'real-blender-reference', createdAt: '2026-07-19T12:00:00Z',
      host: { capabilities: ['json'], permissions: [], accepts: [Hands.RESULT_SCHEMA, 'model/gltf-binary', 'model/obj', 'application/json', 'image/svg+xml'] }
    });
    assert.equal(mesh.status, 'READY');
    const glb = mesh.artifacts.find(function (item) { return item.mime === 'model/gltf-binary'; });
    assert(glb, 'parametric mesh hand did not emit GLB');
    const staged = path.join(workspace, 'staging', 'real-model.glb');
    fs.writeFileSync(staged, bytesFromDataUrl(glb.dataUrl));

    const pair = crypto.generateKeyPairSync('ed25519');
    const manifest = BlenderPackage.seal(blenderRoot, 'ephemeral-real-test', pair.privateKey);
    const driver = new BlenderDriver({
      executable: path.resolve(executable), entrypoint: path.join(blenderRoot, 'blender-host.py'),
      minimumVersion: manifest.host_application.minimum_version,
      maximumVersionExclusive: manifest.host_application.maximum_version_exclusive,
      executableSha256: argument('--blender-sha256') || null
    });
    const runtime = new NativeHostRuntime({
      workspaceRoot: workspace, packageRoot: blenderRoot, manifest,
      trustStore: { 'ephemeral-real-test': { public_key: pair.publicKey, package_ids: [manifest.package_id] } },
      driver
    });
    const bundle = bridgeBundle(runtime, staged, targetCanvas, applicationVersion);
    const prepared = runtime.prepare({ bundle, targetCanvas, sourcePath: staged });
    const receipt = runtime.apply(prepared.transaction_id);
    assert.equal(receipt.independently_verified, true);
    if (argument('--blender-sha256')) assert.equal(receipt.host_executable_digest_verified, true);
    assert.equal(runtime.read(prepared.transaction_id).inspection.independent_process, true);
    assert.equal(runtime.read(prepared.transaction_id).inspection.blender_version.split('.').slice(0, 2).join('.'), applicationVersion.split('.').slice(0, 2).join('.'));
    assert(runtime.read(prepared.transaction_id).inspection.mesh_count >= 1);
    assert(runtime.read(prepared.transaction_id).inspection.polygons > 0);
    assert.equal(runtime.rollback(prepared.transaction_id).ok, true);
    assert.equal(fs.existsSync(path.join(workspace, bundle.project.project_file)), false);
    console.log('Real Blender native adapter PASS (' + runtime.read(prepared.transaction_id).inspection.blender_version + ', signed fixed entrypoint, Asset Hand GLB import, fresh-process inspection, exact receipt, rollback)');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})()
