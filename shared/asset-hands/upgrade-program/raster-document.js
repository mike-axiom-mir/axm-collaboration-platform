'use strict';

const U = require('./foundation-utils');
const Raster = require('../raster-codec');

const DOCUMENT_SCHEMA = 'axm.nondestructive-raster-document/v1';

function byteBuffer(value, expected, label) {
  const buffer = Buffer.isBuffer(value) ? Buffer.from(value) : typeof value === 'string' ? Buffer.from(value, 'base64') : Buffer.from(value || []);
  U.ensure(buffer.length === expected, (label || 'buffer') + ' must contain exactly ' + expected + ' bytes');
  return buffer;
}

function normalizeLayer(layer, width, height) {
  const common = { id: U.text(layer.id, 100, 'raster layer id'), name: U.text(layer.name || layer.id, 120, 'raster layer name'), kind: U.text(layer.kind || 'pixels', 30, 'raster layer kind'), visible: layer.visible !== false, opacity: Math.max(0, Math.min(1, U.finite(layer.opacity == null ? 1 : layer.opacity, 'raster layer opacity'))), blend_mode: U.text(layer.blend_mode || 'normal', 30, 'blend mode') };
  U.ensure(['normal', 'multiply', 'screen'].includes(common.blend_mode), 'unsupported raster blend mode');
  if (common.kind === 'pixels') {
    common.rgba8_base64 = byteBuffer(layer.rgba8 != null ? layer.rgba8 : layer.rgba8_base64, width * height * 4, 'pixel layer').toString('base64');
    common.source_digest = U.text(layer.source_digest || U.sha256(Buffer.from(common.rgba8_base64, 'base64')), 128, 'pixel source digest');
    const maskValue = layer.mask_alpha != null ? layer.mask_alpha : layer.mask_alpha_base64;
    common.mask_alpha_base64 = maskValue == null ? null : byteBuffer(maskValue, width * height, 'layer mask').toString('base64');
  } else if (common.kind === 'adjustment') {
    common.adjustments = U.boundedArray(layer.adjustments, 1, 20, 'adjustments').map((item) => ({ type: U.text(item.type, 30, 'adjustment type'), value: U.finite(item.value, 'adjustment value') }));
    U.ensure(common.adjustments.every((item) => ['brightness', 'contrast'].includes(item.type)), 'unsupported raster adjustment');
  } else throw new Error('unsupported raster layer kind: ' + common.kind);
  return common;
}

function create(spec) {
  spec = U.clone(spec || {});
  const width = Math.floor(U.finite(spec.width, 'raster document width'));
  const height = Math.floor(U.finite(spec.height, 'raster document height'));
  U.ensure(width > 0 && height > 0 && width * height <= 16777216, 'raster document dimensions invalid');
  const layers = U.boundedArray(spec.layers, 1, 1000, 'raster layers').map((item) => normalizeLayer(item, width, height));
  U.ensure(new Set(layers.map((item) => item.id)).size === layers.length, 'raster layer ids must be unique');
  const document = { schema: DOCUMENT_SCHEMA, version: '1.0.0', id: U.text(spec.id, 100, 'raster document id'), width, height, colour_space: U.text(spec.colour_space || 'srgb', 80, 'raster colour space'), bit_depth: 8, layers, history: U.clone(spec.history || []), revision: Number(spec.revision) || 0 };
  document.digest = U.sha256(document);
  return document;
}

function blendChannel(mode, source, destination) {
  if (mode === 'multiply') return source * destination / 255;
  if (mode === 'screen') return 255 - (255 - source) * (255 - destination) / 255;
  return source;
}

function render(document) {
  U.ensure(document && document.schema === DOCUMENT_SCHEMA, 'raster document required');
  const output = Buffer.alloc(document.width * document.height * 4);
  for (const layer of document.layers) {
    if (!layer.visible) continue;
    if (layer.kind === 'adjustment') {
      for (const adjustment of layer.adjustments) for (let index = 0; index < output.length; index += 4) for (let channel = 0; channel < 3; channel += 1) {
        let value = output[index + channel];
        if (adjustment.type === 'brightness') value += adjustment.value * 255;
        else value = (value - 127.5) * adjustment.value + 127.5;
        output[index + channel] = Math.max(0, Math.min(255, Math.round(value)));
      }
      continue;
    }
    const source = Buffer.from(layer.rgba8_base64, 'base64');
    const mask = layer.mask_alpha_base64 ? Buffer.from(layer.mask_alpha_base64, 'base64') : null;
    for (let index = 0, pixel = 0; index < output.length; index += 4, pixel += 1) {
      const sourceAlpha = source[index + 3] / 255 * layer.opacity * (mask ? mask[pixel] / 255 : 1);
      if (sourceAlpha <= 0) continue;
      const destinationAlpha = output[index + 3] / 255;
      const finalAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      for (let channel = 0; channel < 3; channel += 1) {
        const blended = blendChannel(layer.blend_mode, source[index + channel], output[index + channel]);
        output[index + channel] = Math.max(0, Math.min(255, Math.round((blended * sourceAlpha + output[index + channel] * destinationAlpha * (1 - sourceAlpha)) / finalAlpha)));
      }
      output[index + 3] = Math.round(finalAlpha * 255);
    }
  }
  const png = Raster.encodeRgba(document.width, document.height, output);
  return { rgba8: output, pixel_digest: U.sha256(output), png, document_digest: document.digest };
}

function save(document) {
  U.ensure(document && document.schema === DOCUMENT_SCHEMA, 'raster document required');
  const text = JSON.stringify(document, null, 2);
  return { mime: 'application/json', schema: DOCUMENT_SCHEMA, text, digest: U.sha256(text), editable: true };
}

function load(text) {
  const raw = JSON.parse(U.text(text, 50 * 1024 * 1024, 'raster project text'));
  return create(raw);
}

function addLayer(document, layer) {
  const raw = U.clone(document);
  delete raw.digest;
  raw.layers.push(normalizeLayer(layer, raw.width, raw.height));
  raw.revision += 1;
  raw.history.push({ op: 'add-layer', layer_id: layer.id, layer_digest: U.sha256(layer) });
  return create(raw);
}

function drawDisk(buffer, width, height, x, y, radius, colour, opacity, tip, texture) {
  const minX = Math.max(0, Math.floor(x - radius)); const maxX = Math.min(width - 1, Math.ceil(x + radius));
  const minY = Math.max(0, Math.floor(y - radius)); const maxY = Math.min(height - 1, Math.ceil(y + radius));
  for (let py = minY; py <= maxY; py += 1) for (let px = minX; px <= maxX; px += 1) {
    const inside = tip === 'square' || (px - x) ** 2 + (py - y) ** 2 <= radius ** 2;
    if (!inside) continue;
    const index = (py * width + px) * 4;
    const grain = texture ? 0.65 + (Number.parseInt(U.sha256(texture + '|' + px + '|' + py).slice(0, 4), 16) / 65535) * 0.35 : 1;
    const alpha = Math.max(0, Math.min(1, opacity * grain));
    const destinationAlpha = buffer[index + 3] / 255;
    const finalAlpha = alpha + destinationAlpha * (1 - alpha);
    for (let channel = 0; channel < 3; channel += 1) buffer[index + channel] = Math.round((colour[channel] * alpha + buffer[index + channel] * destinationAlpha * (1 - alpha)) / finalAlpha);
    buffer[index + 3] = Math.round(finalAlpha * 255);
  }
}

function stroke(document, spec) {
  spec = U.clone(spec || {});
  const samples = U.boundedArray(spec.samples, 2, 100000, 'brush samples').map((item) => ({ x: U.finite(item.x, 'brush x'), y: U.finite(item.y, 'brush y'), pressure: Math.max(0, Math.min(1, U.finite(item.pressure, 'brush pressure'))), time_ms: U.finite(item.time_ms, 'brush timestamp') }));
  U.ensure(samples.every((item, index) => index === 0 || item.time_ms >= samples[index - 1].time_ms), 'brush timestamps must be monotonic');
  const stabilization = Math.max(1, Math.min(20, Math.floor(U.finite(spec.stabilization || 1, 'brush stabilization'))));
  const smooth = samples.map((item, index) => {
    const window = samples.slice(Math.max(0, index - stabilization + 1), index + 1);
    return { x: window.reduce((sum, sample) => sum + sample.x, 0) / window.length, y: window.reduce((sum, sample) => sum + sample.y, 0) / window.length, pressure: window.reduce((sum, sample) => sum + sample.pressure, 0) / window.length, time_ms: item.time_ms };
  });
  const rgba = Buffer.alloc(document.width * document.height * 4);
  const colour = U.boundedArray(spec.colour_rgba, 4, 4, 'brush colour').map((item) => Math.max(0, Math.min(255, Math.round(U.finite(item, 'brush colour channel')))));
  const baseRadius = Math.max(0.25, Math.min(512, U.finite(spec.base_radius, 'brush radius')));
  for (let segment = 1; segment < smooth.length; segment += 1) {
    const a = smooth[segment - 1]; const b = smooth[segment]; const distance = Math.hypot(b.x - a.x, b.y - a.y); const steps = Math.max(1, Math.ceil(distance / Math.max(0.5, baseRadius * 0.25)));
    for (let step = 0; step <= steps; step += 1) { const t = step / steps; const pressure = a.pressure + (b.pressure - a.pressure) * t; drawDisk(rgba, document.width, document.height, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, baseRadius * (0.2 + pressure * 0.8), colour, colour[3] / 255 * pressure, spec.tip || 'circle', spec.texture_seed || null); }
  }
  const layer = { id: U.text(spec.layer_id, 100, 'brush layer id'), name: spec.layer_name || spec.layer_id, kind: 'pixels', rgba8: rgba, opacity: 1, blend_mode: 'normal', source_digest: U.sha256({ samples, brush: { baseRadius, colour, stabilization, tip: spec.tip || 'circle', texture: spec.texture_seed || null } }) };
  const next = addLayer(document, layer);
  const receipt = { schema: 'axm.brush-stroke-receipt/v1', status: rgba.some((value) => value !== 0) ? 'PASS' : 'FAIL', samples_digest: U.sha256(samples), stabilized_samples_digest: U.sha256(smooth), output_layer_digest: U.sha256(rgba), pressure_range: [Math.min(...samples.map((item) => item.pressure)), Math.max(...samples.map((item) => item.pressure))], brush: { base_radius: baseRadius, tip: spec.tip || 'circle', texture_seed: spec.texture_seed || null } };
  receipt.digest = U.sha256(receipt);
  return { document: next, receipt };
}

function selectionMask(width, height, region) {
  const mask = Buffer.alloc(width * height);
  const x0 = Math.max(0, Math.floor(U.finite(region.x, 'selection x'))); const y0 = Math.max(0, Math.floor(U.finite(region.y, 'selection y')));
  const x1 = Math.min(width, Math.ceil(x0 + U.finite(region.width, 'selection width'))); const y1 = Math.min(height, Math.ceil(y0 + U.finite(region.height, 'selection height')));
  U.ensure(x1 > x0 && y1 > y0, 'selection region is empty');
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) mask[y * width + x] = 255;
  return mask;
}

function retouch(document, spec) {
  spec = U.clone(spec || {});
  const layerIndex = document.layers.findIndex((item) => item.id === spec.layer_id && item.kind === 'pixels');
  U.ensure(layerIndex >= 0, 'retouch pixel layer not found');
  const before = Buffer.from(document.layers[layerIndex].rgba8_base64, 'base64'); const after = Buffer.from(before);
  const mask = selectionMask(document.width, document.height, spec.region || {});
  const dx = Math.round(U.finite(spec.source_offset && spec.source_offset.x || 0, 'retouch source offset x')); const dy = Math.round(U.finite(spec.source_offset && spec.source_offset.y || 0, 'retouch source offset y'));
  const operation = U.text(spec.operation, 30, 'retouch operation');
  U.ensure(['clone', 'heal', 'warp'].includes(operation), 'unsupported retouch operation');
  for (let y = 0; y < document.height; y += 1) for (let x = 0; x < document.width; x += 1) {
    const pixel = y * document.width + x; if (!mask[pixel]) continue;
    const sourceX = Math.max(0, Math.min(document.width - 1, x + dx)); const sourceY = Math.max(0, Math.min(document.height - 1, y + dy));
    const targetIndex = pixel * 4; const sourceIndex = (sourceY * document.width + sourceX) * 4;
    for (let channel = 0; channel < 4; channel += 1) after[targetIndex + channel] = operation === 'heal' ? Math.round((before[targetIndex + channel] + before[sourceIndex + channel]) / 2) : before[sourceIndex + channel];
  }
  let outsideChanged = 0; let insideChanged = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) { const changed = !before.subarray(pixel * 4, pixel * 4 + 4).equals(after.subarray(pixel * 4, pixel * 4 + 4)); if (changed && mask[pixel]) insideChanged += 1; if (changed && !mask[pixel]) outsideChanged += 1; }
  const raw = U.clone(document); delete raw.digest; raw.layers[layerIndex].rgba8_base64 = after.toString('base64'); raw.layers[layerIndex].source_digest = U.sha256(after); raw.revision += 1; raw.history.push({ op: operation, layer_id: spec.layer_id, region: U.clone(spec.region), source_offset: { x: dx, y: dy }, before_digest: U.sha256(before), mask_digest: U.sha256(mask), after_digest: U.sha256(after) });
  const next = create(raw);
  const receipt = { schema: 'axm.raster-retouch-receipt/v1', status: outsideChanged === 0 && insideChanged > 0 ? 'PASS' : 'FAIL', operation, before_digest: U.sha256(before), mask_digest: U.sha256(mask), after_digest: U.sha256(after), inside_changed_pixels: insideChanged, outside_changed_pixels: outsideChanged, source_offset: { x: dx, y: dy }, source_retained: true };
  receipt.digest = U.sha256(receipt);
  return { document: next, mask, receipt };
}

module.exports = { DOCUMENT_SCHEMA, create, render, save, load, addLayer, stroke, retouch, selectionMask };
