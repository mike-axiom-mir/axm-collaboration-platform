'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.native-host-adapter-package/v1';
const VERSION = '1.0.0';

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + canonical(value[key]);
    }).join(',') + '}';
  }
  return JSON.stringify(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filename) {
  return sha256Bytes(fs.readFileSync(filename));
}

function payload(manifest) {
  const copy = clone(manifest || {});
  delete copy.integrity;
  delete copy.signature;
  return copy;
}

function signedPayload(manifest) {
  const copy = clone(manifest || {});
  delete copy.signature;
  return copy;
}

function seal(manifest, keyId, privateKey) {
  const output = clone(manifest || {});
  output.integrity = {
    algorithm: 'sha-256',
    payload_digest: sha256Bytes(Buffer.from(canonical(payload(output)), 'utf8'))
  };
  output.signature = {
    algorithm: 'ed25519',
    key_id: String(keyId || ''),
    value: crypto.sign(null, Buffer.from(canonical(signedPayload(output)), 'utf8'), privateKey).toString('base64')
  };
  return output;
}

function safeRelative(value) {
  const text = String(value || '');
  return !!text && text.length <= 240 && !path.isAbsolute(text) && !/(^|[\\/])\.\.([\\/]|$)/.test(text) && !/^[a-z]+:/i.test(text);
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function validateShape(manifest) {
  const errors = [];
  if (!manifest || manifest.schema !== SCHEMA) errors.push('adapter package schema mismatch');
  if (manifest && manifest.version !== VERSION) errors.push('adapter package contract version mismatch');
  ['package_id', 'package_version', 'adapter_id', 'adapter_contract_version'].forEach(function (field) {
    if (!manifest || !manifest[field]) errors.push('adapter package field missing: ' + field);
  });
  const host = manifest && manifest.host_application || {};
  if (!host.name || !host.minimum_version || !host.maximum_version_exclusive) errors.push('host application version range is incomplete');
  const entry = manifest && manifest.entrypoint || {};
  if (entry.type !== 'fixed-python-script' || !safeRelative(entry.path) || !/^[a-f0-9]{64}$/.test(String(entry.sha256 || ''))) {
    errors.push('fixed adapter entrypoint declaration is invalid');
  }
  const capabilities = manifest && manifest.capabilities || {};
  ['canvas_mediums', 'units', 'colour_spaces', 'transparency_modes', 'behaviours', 'intended_uses', 'supported_constraints', 'source_mime_types', 'operations'].forEach(function (field) {
    if (!Array.isArray(capabilities[field]) || !capabilities[field].length) errors.push('adapter package capability is incomplete: ' + field);
  });
  if (!manifest || !manifest.permissions || manifest.permissions.network !== 'none' || manifest.permissions.arbitrary_code !== false) {
    errors.push('adapter package must deny network and arbitrary bundle code');
  }
  return errors;
}

function verify(manifest, options) {
  options = options || {};
  const errors = validateShape(manifest);
  const expectedIntegrity = sha256Bytes(Buffer.from(canonical(payload(manifest)), 'utf8'));
  if (!manifest || !manifest.integrity || manifest.integrity.algorithm !== 'sha-256' || manifest.integrity.payload_digest !== expectedIntegrity) {
    errors.push('adapter package payload integrity mismatch');
  }
  const signature = manifest && manifest.signature || {};
  const trust = options.trustStore && options.trustStore[signature.key_id];
  if (signature.algorithm !== 'ed25519' || !signature.value || !trust) {
    errors.push('adapter package signature is not trusted');
  } else {
    if (Array.isArray(trust.package_ids) && !trust.package_ids.includes(manifest.package_id)) errors.push('signing key is not trusted for this package');
    let verified = false;
    try {
      verified = crypto.verify(null, Buffer.from(canonical(signedPayload(manifest)), 'utf8'), trust.public_key, Buffer.from(signature.value, 'base64'));
    } catch (error) {
      verified = false;
    }
    if (!verified) errors.push('adapter package signature verification failed');
  }
  let entrypoint = null;
  if (options.packageRoot && manifest && manifest.entrypoint && safeRelative(manifest.entrypoint.path)) {
    entrypoint = path.resolve(options.packageRoot, manifest.entrypoint.path);
    if (!inside(options.packageRoot, entrypoint) || !fs.existsSync(entrypoint)) errors.push('adapter package entrypoint is missing or outside package root');
    else if (sha256File(entrypoint) !== manifest.entrypoint.sha256) errors.push('adapter package entrypoint digest mismatch');
  }
  return {
    ok: errors.length === 0,
    errors: Array.from(new Set(errors)),
    package_payload_digest: expectedIntegrity,
    signature_verified: errors.indexOf('adapter package signature is not trusted') < 0 && errors.indexOf('adapter package signature verification failed') < 0 && errors.indexOf('signing key is not trusted for this package') < 0,
    entrypoint: entrypoint
  };
}

module.exports = {
  SCHEMA,
  VERSION,
  canonical,
  sha256Bytes,
  sha256File,
  safeRelative,
  inside,
  payload,
  signedPayload,
  seal,
  verify
};
