'use strict';

const Core = require('./core');

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function pad4(length) {
  return (length + 3) & ~3;
}

function parse(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const inspected = Core.inspectGlb(bytes);
  if (!inspected.pass) throw new Error('input GLB is invalid: ' + inspected.errors.join('; '));
  let offset = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === JSON_CHUNK) json = JSON.parse(bytes.subarray(start, start + length).toString('utf8').trimEnd());
    else if (type === BIN_CHUNK) bin = Buffer.from(bytes.subarray(start, start + length));
    else throw new Error('unsupported GLB chunk type: ' + type);
    offset = start + length;
  }
  if (!json) throw new Error('GLB JSON chunk is missing');
  return { json, bin };
}

function build(json, bin) {
  const jsonRaw = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonBytes = Buffer.alloc(pad4(jsonRaw.length), 0x20);
  jsonRaw.copy(jsonBytes);
  const binRaw = Buffer.from(bin);
  const binBytes = Buffer.alloc(pad4(binRaw.length), 0x00);
  binRaw.copy(binBytes);
  const total = 12 + 8 + jsonBytes.length + (binBytes.length ? 8 + binBytes.length : 0);
  const output = Buffer.alloc(total);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(total, 8);
  output.writeUInt32LE(jsonBytes.length, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  jsonBytes.copy(output, 20);
  if (binBytes.length) {
    const header = 20 + jsonBytes.length;
    output.writeUInt32LE(binBytes.length, header);
    output.writeUInt32LE(BIN_CHUNK, header + 4);
    binBytes.copy(output, header + 8);
  }
  return output;
}

function physicalBufferIndex(json) {
  const candidates = (json.buffers || []).map((buffer, index) => ({ buffer, index })).filter(item => {
    const extension = item.buffer.extensions && item.buffer.extensions.EXT_meshopt_compression;
    return !item.buffer.uri && !(extension && extension.fallback === true);
  });
  if (candidates.length !== 1) throw new Error('GLB must expose exactly one physical embedded buffer');
  return candidates[0].index;
}

function bind(inputGlb, bindings) {
  if (!Array.isArray(bindings) || bindings.length === 0) throw new Error('at least one KTX2 binding is required');
  const parsed = parse(inputGlb);
  const json = parsed.json;
  const bufferIndex = physicalBufferIndex(json);
  if (!Array.isArray(json.textures) || json.textures.length === 0) throw new Error('GLB declares no textures to bind');
  json.images = Array.isArray(json.images) ? json.images : [];
  json.bufferViews = Array.isArray(json.bufferViews) ? json.bufferViews : [];
  json.extensionsUsed = Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [];
  json.extensionsRequired = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  if (!json.extensionsUsed.includes('KHR_texture_basisu')) json.extensionsUsed.push('KHR_texture_basisu');
  if (!json.extensionsRequired.includes('KHR_texture_basisu')) json.extensionsRequired.push('KHR_texture_basisu');

  let bin = Buffer.from(parsed.bin);
  const seen = new Set();
  const mapped = [];
  for (const [order, binding] of bindings.entries()) {
    if (!binding || !Buffer.isBuffer(binding.bytes) || binding.bytes.length < 16) throw new Error('binding[' + order + '] has no valid KTX2 bytes');
    const textureIndex = binding.targetTextureIndex;
    if (!Number.isInteger(textureIndex) || textureIndex < 0 || textureIndex >= json.textures.length) throw new Error('binding[' + order + '] target texture index is out of range');
    if (seen.has(textureIndex)) throw new Error('target texture index is bound more than once: ' + textureIndex);
    seen.add(textureIndex);
    const offset = pad4(bin.length);
    if (offset > bin.length) bin = Buffer.concat([bin, Buffer.alloc(offset - bin.length)]);
    const bufferViewIndex = json.bufferViews.length;
    json.bufferViews.push({ buffer: bufferIndex, byteOffset: offset, byteLength: binding.bytes.length, name: binding.name || 'AXM KTX2 ' + textureIndex });
    const imageIndex = json.images.length;
    json.images.push({ bufferView: bufferViewIndex, mimeType: 'image/ktx2', name: binding.name || 'AXM KTX2 ' + textureIndex });
    const texture = json.textures[textureIndex];
    texture.extensions = Object.assign({}, texture.extensions, { KHR_texture_basisu: { source: imageIndex } });
    delete texture.source;
    bin = Buffer.concat([bin, binding.bytes]);
    mapped.push({ texture_index: textureIndex, image_index: imageIndex, buffer_view_index: bufferViewIndex, byte_offset: offset, byte_length: binding.bytes.length, ktx2_sha256: Core.sha256(binding.bytes) });
  }
  json.extensionsUsed.sort();
  json.extensionsRequired.sort();
  json.buffers[bufferIndex].byteLength = bin.length;
  const output = build(json, bin);
  const inspected = Core.inspectGlb(output);
  if (!inspected.pass) throw new Error('bound GLB failed inspection: ' + inspected.errors.join('; '));
  return {
    bytes: output,
    receipt: {
      schema: 'axm.modern-asset-forge.ktx2-glb-binding-receipt/v1',
      version: '1.0.0',
      status: 'PASS',
      input_glb_sha256: Core.sha256(inputGlb),
      output_glb_sha256: Core.sha256(output),
      physical_buffer_index: bufferIndex,
      mappings: mapped,
      extensions_used: inspected.metrics.extensions_used,
      extensions_required: inspected.metrics.extensions_required,
      fallback_sources_removed: true,
      network_access_performed: false,
      private_location_retained: false
    }
  };
}

module.exports = { parse, build, bind };
