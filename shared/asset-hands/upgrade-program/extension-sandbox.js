'use strict';

const crypto = require('crypto');
const vm = require('vm');
const U = require('./foundation-utils');

const MANIFEST_SCHEMA = 'axm.signed-hand-extension/v1';
const RECEIPT_SCHEMA = 'axm.hand-extension-execution-receipt/v1';

function publicFingerprint(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  return U.sha256(key.export({ type: 'spki', format: 'der' }));
}

function signingPayload(manifest) {
  const payload = U.clone(manifest);
  delete payload.signature;
  delete payload.digest;
  return Buffer.from(U.canonical(payload), 'utf8');
}

function createSignedManifest(spec, privateKeyPem) {
  spec = U.clone(spec || {});
  const source = U.text(spec.source, 200000, 'extension source');
  const capabilities = U.boundedArray(spec.capabilities || [], 0, 100, 'extension capabilities').map((item) => U.text(item, 100, 'extension capability')).sort();
  U.ensure(new Set(capabilities).size === capabilities.length, 'extension capabilities must be unique');
  const manifest = {
    schema: MANIFEST_SCHEMA,
    manifest_version: '1.0.0',
    id: U.text(spec.id, 100, 'extension id'),
    version: U.text(spec.version, 40, 'extension version'),
    source,
    source_sha256: U.sha256(source),
    public_key_pem: U.text(spec.public_key_pem, 10000, 'extension public key'),
    key_fingerprint: publicFingerprint(spec.public_key_pem),
    capabilities,
    limits: {
      timeout_ms: Math.max(1, Math.min(5000, Math.floor(U.finite(spec.limits && spec.limits.timeout_ms || 100, 'extension timeout')))),
      max_output_bytes: Math.max(64, Math.min(10 * 1024 * 1024, Math.floor(U.finite(spec.limits && spec.limits.max_output_bytes || 65536, 'extension output limit')))),
    },
    policies: {
      network: 'none',
      filesystem: 'none',
      child_process: 'none',
      code_generation: 'none',
      capability_api: 'json-values-only',
    },
  };
  manifest.signature = crypto.sign(null, signingPayload(manifest), privateKeyPem).toString('base64');
  manifest.digest = U.sha256(manifest);
  return manifest;
}

function verifyManifest(manifest, trust) {
  trust = trust || {};
  const checks = [];
  function check(name, pass) { checks.push({ name, pass: !!pass }); }
  check('schema', manifest && manifest.schema === MANIFEST_SCHEMA);
  if (!manifest || manifest.schema !== MANIFEST_SCHEMA) return { pass: false, checks, reason: 'manifest schema mismatch' };
  let fingerprint = null;
  let signaturePass = false;
  try {
    fingerprint = publicFingerprint(manifest.public_key_pem);
    signaturePass = crypto.verify(null, signingPayload(manifest), manifest.public_key_pem, Buffer.from(manifest.signature || '', 'base64'));
  } catch (_) {
    signaturePass = false;
  }
  check('source-digest', U.sha256(manifest.source || '') === manifest.source_sha256);
  check('key-fingerprint', fingerprint === manifest.key_fingerprint);
  check('signature', signaturePass);
  check('trusted-key', Array.isArray(trust.allowed_key_fingerprints) && trust.allowed_key_fingerprints.includes(fingerprint));
  check('not-revoked', !(trust.revoked_manifest_digests || []).includes(manifest.digest) && !(trust.revoked_extension_ids || []).includes(manifest.id));
  const pass = checks.every((item) => item.pass);
  return { pass, checks, reason: pass ? 'signed manifest is trusted and not revoked' : checks.filter((item) => !item.pass).map((item) => item.name).join(', ') };
}

function execute(manifest, input, options) {
  options = options || {};
  const verified = verifyManifest(manifest, options.trust || {});
  U.ensure(verified.pass, 'extension verification failed: ' + verified.reason);
  const available = options.capability_values || {};
  const granted = {};
  for (const capability of manifest.capabilities) {
    U.ensure(Object.prototype.hasOwnProperty.call(available, capability), 'declared capability unavailable: ' + capability);
    const value = available[capability];
    U.ensure(value === null || ['string', 'number', 'boolean', 'object'].includes(typeof value), 'capability values must be JSON data');
    U.ensure(typeof value !== 'function', 'host functions cannot cross the extension boundary');
    granted[capability] = U.clone(value);
  }
  const source = U.text(manifest.source, 200000, 'extension source');
  U.ensure(U.jsonBytes(input) <= 10 * 1024 * 1024, 'extension input exceeds hard limit');
  const context = vm.createContext(Object.create(null), {
    name: 'axm-extension-' + manifest.id,
    codeGeneration: { strings: false, wasm: false },
  });
  const invocation = [
    "'use strict';",
    'const __api = Object.freeze(' + JSON.stringify(granted) + ');',
    'const __input = Object.freeze(' + JSON.stringify(U.clone(input)) + ');',
    'const __extension = (' + source + ');',
    "if (typeof __extension !== 'function') throw new Error('extension source must evaluate to a function');",
    '__extension(__api, __input);',
  ].join('\n');
  const started = process.hrtime.bigint();
  let output;
  let status = 'PASS';
  let error = null;
  try {
    output = new vm.Script(invocation, { filename: manifest.id + '.extension.js' }).runInContext(context, { timeout: manifest.limits.timeout_ms, breakOnSigint: true });
    U.ensure(!(output && typeof output.then === 'function'), 'async extension results are not supported');
    output = U.clone(output);
    U.ensure(U.jsonBytes(output) <= manifest.limits.max_output_bytes, 'extension output limit exceeded');
  } catch (caught) {
    status = 'FAIL';
    error = { name: caught && caught.name || 'Error', message: String(caught && caught.message || caught).slice(0, 500) };
    output = null;
  }
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: '1.0.0',
    extension: { id: manifest.id, version: manifest.version, manifest_digest: manifest.digest, key_fingerprint: manifest.key_fingerprint },
    input_digest: U.sha256(input),
    output_digest: status === 'PASS' ? U.sha256(output) : null,
    status,
    error,
    duration_ms: Number(durationMs.toFixed(6)),
    granted_capabilities: manifest.capabilities.slice(),
    policies: U.clone(manifest.policies),
    isolation_claim: 'restricted Node language context; not an operating-system or native-code security boundary',
  };
  receipt.id = U.receiptId('extension-execution', receipt);
  receipt.digest = U.sha256(receipt);
  return { output, receipt };
}

module.exports = { MANIFEST_SCHEMA, RECEIPT_SCHEMA, publicFingerprint, createSignedManifest, verifyManifest, execute };
