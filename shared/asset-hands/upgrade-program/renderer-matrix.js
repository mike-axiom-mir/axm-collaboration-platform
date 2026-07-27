'use strict';

const U = require('./foundation-utils');

const SCENE_SCHEMA = 'axm.renderer-reference-scene/v1';
const CAPTURE_SCHEMA = 'axm.renderer-capture/v1';
const MATRIX_SCHEMA = 'axm.renderer-comparison-matrix/v1';

function createScene(spec) {
  spec = U.clone(spec || {});
  const scene = {
    schema: SCENE_SCHEMA, version: '1.0.0', id: U.text(spec.id, 100, 'reference scene id'),
    target_canvas_digest: U.text(spec.target_canvas_digest, 128, 'reference scene canvas digest'),
    dimensions: { width: Math.floor(U.finite(spec.dimensions && spec.dimensions.width, 'scene width')), height: Math.floor(U.finite(spec.dimensions && spec.dimensions.height, 'scene height')) },
    camera: U.clone(spec.camera), lights: U.boundedArray(spec.lights, 1, 32, 'scene lights').map(U.clone),
    geometry: U.boundedArray(spec.geometry, 1, 1000, 'scene geometry').map(U.clone), materials: U.boundedArray(spec.materials, 1, 1000, 'scene materials').map(U.clone),
    colour_pipeline: U.clone(spec.colour_pipeline), deterministic_seed: U.text(spec.deterministic_seed, 100, 'scene seed'),
  };
  U.ensure(scene.dimensions.width > 0 && scene.dimensions.height > 0 && scene.dimensions.width * scene.dimensions.height <= 16777216, 'reference scene dimensions invalid');
  U.ensure(scene.camera && scene.colour_pipeline, 'reference scene camera and colour pipeline required');
  scene.digest = U.sha256(scene);
  return scene;
}

function capture(scene, spec) {
  U.ensure(scene && scene.schema === SCENE_SCHEMA, 'reference scene required');
  spec = spec || {};
  const pixels = Buffer.isBuffer(spec.rgba8) ? Buffer.from(spec.rgba8) : Buffer.from(spec.rgba8 || []);
  U.ensure(pixels.length === scene.dimensions.width * scene.dimensions.height * 4, 'capture must contain exact RGBA8 pixels');
  const receipt = {
    schema: CAPTURE_SCHEMA, version: '1.0.0', scene_digest: scene.digest,
    renderer: { id: U.text(spec.renderer && spec.renderer.id, 100, 'renderer id'), version: U.text(spec.renderer && spec.renderer.version, 60, 'renderer version'), backend_family: U.text(spec.renderer && spec.renderer.backend_family, 80, 'renderer backend family') },
    authority: { kind: U.text(spec.authority && spec.authority.kind || 'fixture', 40, 'capture authority'), fresh_process: spec.authority && spec.authority.fresh_process === true },
    dimensions: U.clone(scene.dimensions), pixel_format: 'RGBA8', pixel_digest: U.sha256(pixels), pixels_base64: pixels.toString('base64'),
    frame_metadata: U.clone(spec.frame_metadata || {}),
  };
  receipt.digest = U.sha256(receipt);
  return receipt;
}

function pixelDiff(left, right) {
  U.ensure(left.length === right.length, 'pixel buffers differ in length');
  let squared = 0;
  let max = 0;
  let changedPixels = 0;
  for (let index = 0; index < left.length; index += 4) {
    let changed = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const difference = Math.abs(left[index + channel] - right[index + channel]);
      squared += difference * difference;
      max = Math.max(max, difference);
      if (difference) changed = true;
    }
    if (changed) changedPixels += 1;
  }
  return { rmse: Number((Math.sqrt(squared / left.length) / 255).toFixed(8)), max_channel_delta: Number((max / 255).toFixed(8)), changed_pixel_ratio: Number((changedPixels / (left.length / 4)).toFixed(8)) };
}

function compare(scene, captures, thresholds) {
  U.ensure(scene && scene.schema === SCENE_SCHEMA, 'reference scene required');
  captures = U.boundedArray(captures, 2, 20, 'renderer captures');
  thresholds = U.clone(thresholds || {});
  const limits = { rmse: U.finite(thresholds.rmse == null ? 0.02 : thresholds.rmse, 'RMSE threshold'), max_channel_delta: U.finite(thresholds.max_channel_delta == null ? 0.1 : thresholds.max_channel_delta, 'max channel threshold'), changed_pixel_ratio: U.finite(thresholds.changed_pixel_ratio == null ? 0.3 : thresholds.changed_pixel_ratio, 'changed pixel threshold') };
  U.ensure(captures.every((item) => item.scene_digest === scene.digest), 'capture scene binding mismatch');
  U.ensure(new Set(captures.map((item) => item.renderer.id)).size === captures.length, 'renderer captures must have unique renderer ids');
  U.ensure(new Set(captures.map((item) => item.renderer.backend_family)).size >= 2, 'at least two independent backend families required');
  const pairs = [];
  for (let leftIndex = 0; leftIndex < captures.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < captures.length; rightIndex += 1) {
    const left = Buffer.from(captures[leftIndex].pixels_base64, 'base64');
    const right = Buffer.from(captures[rightIndex].pixels_base64, 'base64');
    const metrics = pixelDiff(left, right);
    pairs.push({ left: captures[leftIndex].renderer.id, right: captures[rightIndex].renderer.id, metrics, pass: metrics.rmse <= limits.rmse && metrics.max_channel_delta <= limits.max_channel_delta && metrics.changed_pixel_ratio <= limits.changed_pixel_ratio });
  }
  const thresholdsPass = pairs.every((item) => item.pass);
  const live = captures.every((item) => item.authority.kind === 'native-renderer' && item.authority.fresh_process === true);
  const matrix = {
    schema: MATRIX_SCHEMA, version: '1.0.0', scene_digest: scene.digest,
    captures: captures.map((item) => ({ renderer: item.renderer, authority: item.authority, pixel_digest: item.pixel_digest, digest: item.digest })),
    thresholds: limits, pairs, status: thresholdsPass ? (live ? 'PASS' : 'TEST_ONLY') : 'FAIL',
    human_review: pairs.some((item) => item.metrics.rmse > limits.rmse * 0.8 || item.metrics.max_channel_delta > limits.max_channel_delta * 0.8) ? 'REQUIRED_THRESHOLD_EDGE' : 'OPTIONAL',
  };
  matrix.digest = U.sha256(matrix);
  return matrix;
}

function assessColourPipeline(spec) {
  spec = U.clone(spec || {});
  const samples = U.boundedArray(spec.samples, 3, 1000, 'colour samples').map((item) => ({ input: U.boundedArray(item.input, 3, 4, 'colour input').map((value) => U.finite(value, 'colour input value')), expected: U.boundedArray(item.expected, 3, 4, 'expected colour').map((value) => U.finite(value, 'expected colour value')), actual: U.boundedArray(item.actual, 3, 4, 'actual colour').map((value) => U.finite(value, 'actual colour value')) }));
  const tolerance = U.finite(spec.tolerance == null ? 0.0001 : spec.tolerance, 'colour numeric tolerance');
  const sampleChecks = samples.map((item, index) => ({ index, max_error: Math.max(...item.expected.map((value, channel) => Math.abs(value - item.actual[channel]))), transformed: item.input.some((value, channel) => Math.abs(value - item.actual[channel]) > 1e-12) }));
  const external = spec.external_receipt;
  const receipt = {
    schema: 'axm.colour-pipeline-receipt/v1', version: '1.0.0',
    config: { id: U.text(spec.config && spec.config.id, 100, 'colour config id'), digest: U.text(spec.config && spec.config.digest, 128, 'colour config digest'), version: U.text(spec.config && spec.config.version, 60, 'colour config version') },
    transform: { source: U.text(spec.source_space, 80, 'source colour space'), destination: U.text(spec.destination_space, 80, 'destination colour space') },
    samples: sampleChecks, tolerance, external_receipt_digest: external && external.digest || null,
    render_matrix_digest: spec.render_matrix && spec.render_matrix.digest || null,
    status: external && external.status === 'PASS' && sampleChecks.every((item) => item.max_error <= tolerance) && sampleChecks.some((item) => item.transformed) && spec.render_matrix && spec.render_matrix.status === 'PASS' ? 'PASS' : external && external.status === 'MISSING_SUBSTRATE' ? 'MISSING_SUBSTRATE' : 'FAIL',
    label_only_transform_forbidden: true,
  };
  receipt.digest = U.sha256(receipt);
  return receipt;
}

function assessMaterialMatrix(spec) {
  spec = U.clone(spec || {});
  const shaders = U.boundedArray(spec.shader_receipts, 2, 20, 'MaterialX shader receipts');
  const validator = spec.validator_receipt;
  const render = spec.render_matrix;
  const receipt = {
    schema: 'axm.materialx-renderer-matrix-receipt/v1', version: '1.0.0',
    graph: { mime: 'application/mtlx+xml', digest: U.sha256(U.text(spec.graph_xml, 2000000, 'MaterialX graph')), declared_version: U.text(spec.declared_version, 20, 'MaterialX version') },
    validator_receipt_digest: validator && validator.digest || null,
    shader_receipts: shaders.map((item) => ({ backend: item.backend, status: item.status, digest: item.digest })),
    render_matrix_digest: render && render.digest || null,
    status: spec.declared_version === '1.39' && validator && validator.status === 'PASS' && shaders.every((item) => item.status === 'PASS' && item.digest) && new Set(shaders.map((item) => item.backend)).size >= 2 && render && render.status === 'PASS' ? 'PASS' : validator && validator.status === 'MISSING_SUBSTRATE' ? 'MISSING_SUBSTRATE' : 'FAIL',
  };
  receipt.digest = U.sha256(receipt);
  return receipt;
}

function assessGltfFidelity(spec) {
  spec = U.clone(spec || {});
  const cases = U.boundedArray(spec.corpus_cases, 1, 500, 'glTF fidelity cases');
  const validator = spec.validator_receipt;
  const matrix = spec.render_matrix;
  const required = U.boundedArray(spec.required_features, 1, 50, 'required glTF features');
  const receipt = {
    schema: 'axm.gltf-render-fidelity-receipt/v1', version: '1.0.0', artifact_digest: U.text(spec.artifact_digest, 128, 'glTF artifact digest'),
    validator_receipt_digest: validator && validator.digest || null, render_matrix_digest: matrix && matrix.digest || null,
    required_features: required.slice(), corpus_cases: cases.map((item) => ({ id: item.id, features: item.features, status: item.status, receipt_digest: item.receipt_digest })),
  };
  receipt.status = validator && validator.status === 'PASS' && matrix && matrix.status === 'PASS' && required.every((feature) => cases.some((item) => item.status === 'PASS' && item.receipt_digest && (item.features || []).includes(feature))) ? 'PASS' : validator && validator.status === 'MISSING_SUBSTRATE' ? 'MISSING_SUBSTRATE' : 'FAIL';
  receipt.digest = U.sha256(receipt);
  return receipt;
}

module.exports = { SCENE_SCHEMA, CAPTURE_SCHEMA, MATRIX_SCHEMA, createScene, capture, pixelDiff, compare, assessColourPipeline, assessMaterialMatrix, assessGltfFidelity };
