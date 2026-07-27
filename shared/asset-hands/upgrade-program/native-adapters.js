'use strict';

const U = require('./foundation-utils');
const Sandbox = require('./extension-sandbox');

const TRANSACTION_SCHEMA = 'axm.native-adapter-transaction/v1';
const RECEIPT_SCHEMA = 'axm.native-adapter-receipt/v1';

function createAdapter(spec) {
  spec = spec || {};
  const manifestCheck = Sandbox.verifyManifest(spec.signed_manifest, spec.trust || {});
  U.ensure(manifestCheck.pass, 'native adapter manifest is not trusted: ' + manifestCheck.reason);
  return Object.freeze({
    schema: 'axm.native-adapter/v1',
    id: U.text(spec.id, 100, 'native adapter id'),
    version: U.text(spec.version, 40, 'native adapter version'),
    host: U.text(spec.host, 80, 'native adapter host'),
    signed_manifest: U.clone(spec.signed_manifest),
    manifest_digest: spec.signed_manifest.digest,
    operations: Object.freeze(U.boundedArray(spec.operations, 1, 50, 'native adapter operations').map((item) => U.text(item, 80, 'native adapter operation')).sort()),
    runtime_request: U.clone(spec.runtime_request),
  });
}

function plan(adapter, spec) {
  U.ensure(adapter && adapter.schema === 'axm.native-adapter/v1', 'native adapter required');
  spec = U.clone(spec || {});
  const operations = U.boundedArray(spec.operations, 1, 1000, 'native adapter transaction operations').map((operation) => {
    U.ensure(adapter.operations.includes(operation.type), 'native adapter operation not declared: ' + operation.type);
    return U.clone(operation);
  });
  const transaction = {
    schema: TRANSACTION_SCHEMA,
    version: '1.0.0',
    id: U.text(spec.id, 120, 'native transaction id'),
    adapter: { id: adapter.id, version: adapter.version, manifest_digest: adapter.manifest_digest, host: adapter.host },
    baseline_digest: U.text(spec.baseline_digest, 128, 'native transaction baseline digest'),
    operations,
    expected: U.clone(spec.expected || {}),
    rollback: { strategy: 'restore-exact-baseline', baseline_digest: U.text(spec.rollback && spec.rollback.baseline_digest || spec.baseline_digest, 128, 'rollback baseline digest') },
    automatic_publish: false,
  };
  U.ensure(transaction.rollback.baseline_digest === transaction.baseline_digest, 'rollback baseline must match the transaction baseline');
  transaction.digest = U.sha256(transaction);
  return transaction;
}

function resultBase(adapter, transaction, status, reason) {
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: '1.0.0',
    adapter: { id: adapter.id, version: adapter.version, manifest_digest: adapter.manifest_digest, host: adapter.host },
    transaction_digest: transaction.digest,
    baseline_digest: transaction.baseline_digest,
    status,
    reason,
    fresh_process_inspection: null,
    saved_project_digest: null,
    rollback: { available: true, applied: false, idempotent: null },
    authority: 'candidate-only',
  };
  receipt.id = U.receiptId('native-adapter', receipt);
  receipt.digest = U.sha256(receipt);
  return receipt;
}

function apply(adapter, transaction, context) {
  U.ensure(adapter && adapter.schema === 'axm.native-adapter/v1', 'native adapter required');
  U.ensure(transaction && transaction.schema === TRANSACTION_SCHEMA, 'native adapter transaction required');
  context = context || {};
  if (!context.runtime_resolution || context.runtime_resolution.status !== 'READY') return resultBase(adapter, transaction, 'MISSING_SUBSTRATE', 'exact reviewed native host runtime is unavailable');
  if (context.current_baseline_digest !== transaction.baseline_digest) return resultBase(adapter, transaction, 'BASELINE_CONFLICT', 'host project changed after transaction planning');
  U.ensure(context.executor && typeof context.executor.apply === 'function' && typeof context.executor.inspect_fresh === 'function', 'native apply and fresh-inspect executor required');
  let applied;
  try { applied = context.executor.apply(U.clone(transaction)); } catch (error) { return resultBase(adapter, transaction, 'APPLY_FAILED', String(error.message || error).slice(0, 500)); }
  if (!applied || applied.status !== 'SAVED' || !applied.saved_project_digest) return resultBase(adapter, transaction, 'APPLY_FAILED', 'native host did not return a digest-bound saved project');
  let inspected;
  try { inspected = context.executor.inspect_fresh({ transaction_digest: transaction.digest, saved_project_digest: applied.saved_project_digest }); } catch (error) { return resultBase(adapter, transaction, 'INSPECTION_FAILED', String(error.message || error).slice(0, 500)); }
  const inspectedPass = inspected && inspected.fresh_process === true && inspected.saved_project_digest === applied.saved_project_digest && inspected.transaction_digest === transaction.digest && inspected.status === 'PASS';
  const identity = context.executor.identity || {};
  const liveAuthority = identity.kind === 'native-host' && identity.fresh_process === true;
  const status = !inspectedPass ? 'INSPECTION_FAILED' : liveAuthority ? 'PASS' : 'TEST_ONLY';
  const receipt = resultBase(adapter, transaction, status, !inspectedPass ? 'fresh-process inspection did not bind to the saved project and transaction' : liveAuthority ? 'saved project was reopened and independently inspected by a native host executor' : 'transaction contract passed with a non-production fixture executor');
  receipt.saved_project_digest = applied.saved_project_digest;
  receipt.fresh_process_inspection = U.clone(inspected || null);
  receipt.executor = U.clone(identity.kind ? identity : { kind: 'undeclared' });
  receipt.id = U.receiptId('native-adapter', Object.assign({}, receipt, { id: undefined, digest: undefined }));
  receipt.digest = U.sha256(Object.assign({}, receipt, { digest: undefined }));
  return receipt;
}

function rollback(adapter, transaction, receipt, context) {
  U.ensure(receipt && receipt.schema === RECEIPT_SCHEMA, 'native adapter receipt required');
  U.ensure(context && context.executor && typeof context.executor.rollback === 'function', 'native rollback executor required');
  const first = context.executor.rollback({ transaction_digest: transaction.digest, restore_digest: transaction.baseline_digest });
  const second = context.executor.rollback({ transaction_digest: transaction.digest, restore_digest: transaction.baseline_digest });
  const idempotent = first && second && first.status === 'RESTORED' && second.status === 'UNCHANGED' && first.current_digest === transaction.baseline_digest && second.current_digest === transaction.baseline_digest;
  const next = U.clone(receipt);
  next.rollback = { available: true, applied: !!(first && first.status === 'RESTORED'), idempotent, first: U.clone(first), second: U.clone(second) };
  if (!idempotent) next.status = 'ROLLBACK_FAILED';
  next.digest = U.sha256(Object.assign({}, next, { digest: undefined }));
  return next;
}

function createGodotProjectBundle(spec) {
  spec = U.clone(spec || {});
  const projectName = U.text(spec.project_name, 80, 'Godot project name').replace(/["\r\n]/g, '');
  const resourcePath = U.text(spec.resource_path, 160, 'Godot resource path');
  U.ensure(/^res:\/\/[A-Za-z0-9_./-]+$/.test(resourcePath), 'Godot resource path must be a safe res:// path');
  const budgets = {
    max_frame_ms: U.finite(spec.budgets && spec.budgets.max_frame_ms, 'Godot max frame ms'),
    max_texture_memory_bytes: U.finite(spec.budgets && spec.budgets.max_texture_memory_bytes, 'Godot max texture memory'),
    max_draw_calls: U.finite(spec.budgets && spec.budgets.max_draw_calls, 'Godot max draw calls'),
  };
  const project = `[application]\nconfig/name="${projectName}"\nrun/main_scene="res://main.tscn"\n[display]\nwindow/size/viewport_width=640\nwindow/size/viewport_height=360\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n`;
  const scene = `[gd_scene load_steps=3 format=3]\n\n[ext_resource path="${resourcePath}" type="Texture2D" id="1_asset"]\n[ext_resource path="res://probe.gd" type="Script" id="2_probe"]\n\n[node name="AXMAssetProbe" type="Node2D"]\nscript = ExtResource("2_probe")\n\n[node name="Asset" type="Sprite2D" parent="."]\ntexture = ExtResource("1_asset")\nposition = Vector2(320, 180)\n`;
  const script = `extends Node2D\n\nvar frame_count := 0\nvar measure_start_usec := 0\n\nfunc _ready() -> void:\n  measure_start_usec = Time.get_ticks_usec()\n\nfunc _process(_delta: float) -> void:\n  frame_count += 1\n  if frame_count < 30:\n    if frame_count == 10:\n      measure_start_usec = Time.get_ticks_usec()\n    return\n  var texture: Texture2D = $Asset.texture\n  var image: Image = get_viewport().get_texture().get_image()\n  var frame_error := image.save_png("res://axm-probe-frame.png")\n  var elapsed_ms := float(Time.get_ticks_usec() - measure_start_usec) / 1000.0\n  var measured_frames := 20.0\n  var frame_ms := elapsed_ms / measured_frames\n  var texture_bytes := texture.get_width() * texture.get_height() * 4 if texture else 0\n  var draw_calls := int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))\n  var pass := texture != null and texture.get_width() > 0 and texture.get_height() > 0 and frame_error == OK and image.get_width() == 640 and image.get_height() == 360\n  pass = pass and frame_ms <= ${budgets.max_frame_ms} and texture_bytes <= ${budgets.max_texture_memory_bytes} and draw_calls <= ${budgets.max_draw_calls}\n  var receipt := {"status": "PASS" if pass else "FAIL", "texture_loaded": texture != null, "texture_width": texture.get_width() if texture else 0, "texture_height": texture.get_height() if texture else 0, "viewport_width": image.get_width(), "viewport_height": image.get_height(), "frame_saved": frame_error == OK, "average_frame_ms": frame_ms, "texture_memory_bytes": texture_bytes, "draw_calls": draw_calls, "frames_observed": frame_count}\n  print("AXM_GODOT_PROBE:" + JSON.stringify(receipt))\n  get_tree().quit(0 if pass else 3)\n`;
  const executableScript = script
    .replace('var pass :=', 'var passed :=')
    .replace('pass = pass and', 'passed = passed and')
    .replace('"PASS" if pass else', '"PASS" if passed else')
    .replace('0 if pass else 3', '0 if passed else 3')
    .replace('var image: Image = get_viewport().get_texture().get_image()\n  var frame_error := image.save_png("res://axm-probe-frame.png")', 'var viewport_texture := get_viewport().get_texture()\n  var image: Image = viewport_texture.get_image() if viewport_texture else null\n  var viewport_width := image.get_width() if image else 0\n  var viewport_height := image.get_height() if image else 0\n  var frame_error := image.save_png("res://axm-probe-frame.png") if image else ERR_UNAVAILABLE')
    .replace('image.get_width() == 640 and image.get_height() == 360', 'viewport_width == 640 and viewport_height == 360')
    .replace('"viewport_width": image.get_width(), "viewport_height": image.get_height()', '"viewport_width": viewport_width, "viewport_height": viewport_height');
  const manifest = {
    schema: 'axm.godot-asset-probe/v1', version: '1.0.0', resource_path: resourcePath,
    required_checks: ['import-complete', 'visible-frame', 'material-bindings', 'animation-if-declared', 'collision-if-declared', 'frame-budget', 'texture-memory-budget', 'draw-call-budget'],
    budgets,
    files: [
      { path: 'project.godot', mime: 'text/plain', text: project, digest: U.sha256(project) },
      { path: 'main.tscn', mime: 'text/plain', text: scene, digest: U.sha256(scene) },
      { path: 'probe.gd', mime: 'text/x-gdscript', text: executableScript, digest: U.sha256(executableScript) },
    ],
    status: 'PROJECT_FIXTURE_ONLY_NATIVE_RUN_REQUIRED',
  };
  manifest.digest = U.sha256(manifest);
  return manifest;
}

module.exports = { TRANSACTION_SCHEMA, RECEIPT_SCHEMA, createAdapter, plan, apply, rollback, createGodotProjectBundle };
