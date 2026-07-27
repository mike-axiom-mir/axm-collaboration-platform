'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BUILD_REQUEST_SCHEMA = 'axm.modern-asset-forge.build-request/v1';
const BUILD_RECEIPT_SCHEMA = 'axm.modern-asset-forge.build-receipt/v1';
const ASSET_MANIFEST_SCHEMA = 'axm.modern-asset-forge.asset-manifest/v1';
const CAPABILITY_SCHEMA = 'axm.modern-asset-forge.capability-inventory/v1';
const STAGE_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED', 'DEGRADED', 'SKIPPED', 'PREPARED', 'UNKNOWN']);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileDigest(file) {
  return sha256(fs.readFileSync(file));
}

function cleanRelative(value, label = 'path') {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be a non-empty relative path');
  const normalized = value.replace(/\\/g, '/');
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(value)) throw new Error(label + ' must not be absolute');
  const clean = path.posix.normalize(normalized);
  if (clean === '..' || clean.startsWith('../') || clean.includes('/../')) throw new Error(label + ' escapes its declared root');
  if (clean === '.' || clean.startsWith('./')) throw new Error(label + ' must name a child path');
  if (/^[a-zA-Z]:/.test(clean)) throw new Error(label + ' must not contain a drive letter');
  return clean;
}

function resolveInside(root, relative, label) {
  const clean = cleanRelative(relative, label);
  const base = path.resolve(root);
  const resolved = path.resolve(base, clean);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new Error((label || 'path') + ' escapes its declared root');
  return resolved;
}

function count(array) {
  return Array.isArray(array) ? array.length : 0;
}

function inspectGlb(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const errors = [];
  const warnings = [];
  let json = null;
  let binBytes = 0;
  if (bytes.length < 20) return { pass: false, errors: ['GLB is shorter than its header and JSON chunk'], warnings, byte_length: bytes.length };
  const magic = bytes.readUInt32LE(0);
  const version = bytes.readUInt32LE(4);
  const declaredLength = bytes.readUInt32LE(8);
  if (magic !== 0x46546c67) errors.push('GLB magic mismatch');
  if (version !== 2) errors.push('GLB version must be 2');
  if (declaredLength !== bytes.length) errors.push('GLB declared length does not match the file');
  let offset = 12;
  let chunkIndex = 0;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > bytes.length) {
      errors.push('GLB chunk exceeds file bounds');
      break;
    }
    if (chunkIndex === 0 && chunkType !== 0x4e4f534a) errors.push('first GLB chunk is not JSON');
    if (chunkType === 0x4e4f534a && json === null) {
      try {
        json = JSON.parse(bytes.subarray(start, end).toString('utf8').replace(/\u0000+$/g, '').trimEnd());
      } catch (error) {
        errors.push('GLB JSON is invalid: ' + error.message);
      }
    } else if (chunkType === 0x004e4942) binBytes += chunkLength;
    else if (chunkType !== 0x4e4f534a) warnings.push('unrecognized GLB chunk type at index ' + chunkIndex);
    offset = end;
    chunkIndex += 1;
  }
  if (offset !== bytes.length) errors.push('GLB has trailing or truncated chunk bytes');
  if (!json) errors.push('GLB JSON document is missing');
  if (json && (!json.asset || json.asset.version !== '2.0')) errors.push('glTF asset.version must be 2.0');

  let primitives = 0;
  let triangles = 0;
  let vertices = 0;
  if (json) {
    for (const mesh of json.meshes || []) {
      for (const primitive of mesh.primitives || []) {
        primitives += 1;
        const positionAccessor = primitive.attributes && json.accessors && json.accessors[primitive.attributes.POSITION];
        if (positionAccessor && Number.isInteger(positionAccessor.count)) vertices += positionAccessor.count;
        const indexed = Number.isInteger(primitive.indices) && json.accessors && json.accessors[primitive.indices];
        const elementCount = indexed && Number.isInteger(indexed.count) ? indexed.count : positionAccessor && positionAccessor.count || 0;
        const mode = primitive.mode == null ? 4 : primitive.mode;
        if (mode === 4) triangles += Math.floor(elementCount / 3);
        else if (mode === 5 || mode === 6) triangles += Math.max(0, elementCount - 2);
      }
    }
    if (!count(json.scenes)) warnings.push('glTF declares no scenes');
    if (!primitives) errors.push('glTF contains no mesh primitives');
    for (const required of json.extensionsRequired || []) {
      if (!(json.extensionsUsed || []).includes(required)) errors.push('required extension is not listed in extensionsUsed: ' + required);
    }
    const embeddedBufferBytes = (json.buffers || [])
      .filter(item => !item.uri && !(item.extensions && item.extensions.EXT_meshopt_compression && item.extensions.EXT_meshopt_compression.fallback === true))
      .reduce((sum, item) => sum + (Number(item.byteLength) || 0), 0);
    if (embeddedBufferBytes > binBytes) errors.push('declared physical buffer bytes exceed embedded BIN chunks');
  }

  return {
    pass: errors.length === 0,
    errors,
    warnings,
    byte_length: bytes.length,
    glb_version: version,
    generator: json && json.asset && json.asset.generator || null,
    metrics: json ? {
      scenes: count(json.scenes), nodes: count(json.nodes), meshes: count(json.meshes), primitives,
      triangles, vertices, materials: count(json.materials), textures: count(json.textures), images: count(json.images),
      skins: count(json.skins), animations: count(json.animations), accessors: count(json.accessors),
      draw_call_upper_bound: primitives, embedded_bin_bytes: binBytes,
      extensions_used: (json.extensionsUsed || []).slice().sort(), extensions_required: (json.extensionsRequired || []).slice().sort()
    } : null,
    json
  };
}

function stage(id, status, detail = {}) {
  if (!STAGE_STATUSES.has(status)) throw new Error('unsupported stage status: ' + status);
  return Object.assign({ id, status, evidence: [], gaps: [] }, detail);
}

function aggregateStatus(stages) {
  if (stages.some(item => item.status === 'FAIL')) return 'FAIL';
  if (stages.some(item => item.status === 'BLOCKED' || item.status === 'UNKNOWN')) return 'BLOCKED';
  if (stages.some(item => ['DEGRADED', 'SKIPPED', 'PREPARED'].includes(item.status))) return 'COMPLETED_WITH_GAPS';
  return 'PASS';
}

function validateRequest(value) {
  const errors = [];
  if (!value || typeof value !== 'object') return { pass: false, errors: ['request must be an object'] };
  if (value.schema !== BUILD_REQUEST_SCHEMA) errors.push('schema must be ' + BUILD_REQUEST_SCHEMA);
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(value.job_id || '')) errors.push('job_id must be a portable 3..80 character id');
  if (!['canonical_build', 'diagnostic_smoke'].includes(value.mode)) errors.push('mode must be canonical_build or diagnostic_smoke');
  if (!['cool_idle', 'authoring_interactive', 'batch_optimize', 'heavy_compute'].includes(value.workload_mode)) errors.push('workload_mode must be one of the four declared governor modes');
  if (!value.source || !['blend', 'glb'].includes(value.source.kind)) errors.push('source.kind must be blend or glb');
  if (!value.source || typeof value.source.path !== 'string') errors.push('source.path is required');
  else try { cleanRelative(value.source.path, 'source.path'); } catch (error) { errors.push(error.message); }
  if (!value.source || typeof value.source.license !== 'string' || !value.source.license.trim()) errors.push('source.license is required');
  if (!value.output_root) errors.push('output_root is required');
  else try { cleanRelative(value.output_root, 'output_root'); } catch (error) { errors.push(error.message); }
  if (value.mode === 'canonical_build' && value.source && value.source.kind !== 'blend') errors.push('canonical_build requires a .blend authoring source');
  if (!value.delivery || value.delivery.format !== 'glb') errors.push('delivery.format must be glb');
  if (!value.delivery || value.delivery.texture_codec !== 'ktx2_basisu') errors.push('delivery.texture_codec must be ktx2_basisu');
  if (!value.delivery || value.delivery.mesh_compression !== 'meshopt') errors.push('delivery.mesh_compression must be meshopt');
  for (const [index, texture] of (value.textures || []).entries()) {
    if (!texture || texture.format !== 'png') errors.push('textures[' + index + '].format must be png');
    try { cleanRelative(texture.path, 'textures[' + index + '].path'); } catch (error) { errors.push(error.message); }
    if (!['srgb', 'linear'].includes(texture.colour_space)) errors.push('textures[' + index + '].colour_space must be srgb or linear');
    if (texture.target_texture_index != null && (!Number.isInteger(texture.target_texture_index) || texture.target_texture_index < 0)) errors.push('textures[' + index + '].target_texture_index must be a non-negative integer');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  BUILD_REQUEST_SCHEMA, BUILD_RECEIPT_SCHEMA, ASSET_MANIFEST_SCHEMA, CAPABILITY_SCHEMA,
  STAGE_STATUSES, stableStringify, sha256, fileDigest, cleanRelative, resolveInside,
  inspectGlb, stage, aggregateStatus, validateRequest
};
