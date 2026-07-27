'use strict';

const C = require('./core');

const CAPABILITY = 'sense.integrity.taint/v1';
const RECEIPT_SCHEMA = 'axm.taint-sniffer-record/v1';
const STATES = ['NO_TAINT_SIGNAL', 'TAINT_SIGNALLED', 'UNKNOWN'];
const DEFAULT_MAX_BYTES = 256 * 1024;

const INJECTION_PATTERNS = [
  ['INSTRUCTION_OVERRIDE_PATTERN', /\b(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions?\b/i],
  ['PROMPT_DISCLOSURE_PATTERN', /\b(?:reveal|show|print|return|expose)\s+(?:the\s+)?(?:system|developer)\s+prompt\b/i],
  ['EXFILTRATION_PATTERN', /\b(?:exfiltrate|upload|send|copy)\s+(?:all\s+|the\s+)?(?:credentials?|secrets?|access\s+keys?|tokens?)\b/i],
  ['SAFEGUARD_BYPASS_PATTERN', /\b(?:disable|bypass|evade|override)\s+(?:the\s+)?(?:safety|security|verification|review|approval|gate|policy)\b/i]
];

const CREDENTIAL_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/
];

function textLike(mediaType) {
  return /^(?:text\/[^;]+|application\/(?:json|xml|javascript|x-javascript|yaml|x-yaml))(?:;|$)/i.test(String(mediaType || ''));
}

function binarySignature(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return 'WINDOWS_EXECUTABLE';
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return 'ELF_EXECUTABLE';
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3])) return 'ZIP_CONTAINER';
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) return 'WASM_BINARY';
  return null;
}

function toOwnedBuffer(material) {
  if (typeof material === 'string') return Buffer.from(material, 'utf8');
  if (Buffer.isBuffer(material) || material instanceof Uint8Array) return Buffer.from(material);
  return null;
}

function create(options) {
  options = options || {};
  const store = C.createReceiptStore(options.receiptLimit);
  const maxBytes = Math.max(1024, Math.min(1024 * 1024, Math.round(Number(options.maxBytes) || DEFAULT_MAX_BYTES)));

  function seal(input, details) {
    return store.push(Object.assign({
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      materialId: C.compact(input.materialId, 500),
      mediaType: C.compact(input.mediaType || 'application/octet-stream', 120),
      observedAt: C.now(input.observedAt),
      actualSha256: null,
      expectedSha256: null,
      bytesInspected: 0,
      state: 'UNKNOWN',
      signals: [],
      namedSeams: [],
      routedTo: 'input-review',
      recommendationOnly: true,
      tookNoDirectAction: true,
      materialRetained: false,
      rawRetainedBytesAfterSeal: 0,
      rawRetainedItemsAfterSeal: 0,
      cleanupComplete: true,
      limitations: [
        'Deterministic warning signals are not proof that material is malicious or safe.',
        'No malware execution, reputation lookup, cryptographic signer validation, or semantic intent judgment is performed.',
        'Obfuscated or novel attacks may produce no signal; normal text may still resemble an injection pattern.'
      ]
    }, details || {}));
  }

  function sniff(input) {
    input = input || {};
    const materialId = C.assertExactIdentifier(input.materialId, 'materialId');
    const normalized = Object.assign({}, input, { materialId });
    const bytes = toOwnedBuffer(input.material);
    if (!bytes) {
      return seal(normalized, {
        namedSeams: ['MATERIAL_UNAVAILABLE'],
        nextCheapestCheck: 'Supply one bounded string or byte array directly; this sense does not fetch paths or URLs.'
      });
    }
    if (bytes.length > maxBytes) {
      const suppliedBytes = bytes.length;
      bytes.fill(0);
      return seal(normalized, {
        suppliedBytes,
        namedSeams: ['MATERIAL_BUDGET_EXCEEDED'],
        nextCheapestCheck: 'Reduce the sample to at most ' + maxBytes + ' bytes without changing its declared identity.'
      });
    }

    const expected = input.expectedSha256 == null ? null : String(input.expectedSha256).trim().toLowerCase();
    if (expected !== null && !/^[a-f0-9]{64}$/.test(expected)) {
      bytes.fill(0);
      return seal(normalized, {
        expectedDigestSupplied: true,
        namedSeams: ['EXPECTED_DIGEST_INVALID'],
        nextCheapestCheck: 'Supply a 64-character hexadecimal SHA-256 digest or omit the expectation.'
      });
    }

    const actual = C.digest(bytes);
    const signals = [];
    function signal(code, axis) {
      if (!signals.some(function (item) { return item.code === code; })) signals.push({ code, axis });
    }
    if (expected && expected !== actual) signal('EXPECTED_DIGEST_MISMATCH', 'integrity');

    const mediaType = normalized.mediaType || 'application/octet-stream';
    if (textLike(mediaType)) {
      const signature = binarySignature(bytes);
      if (signature) signal('CONTENT_SIGNATURE_MISMATCH', 'declared-format');
      const text = bytes.toString('utf8');
      if (text.includes('\ufffd')) signal('INVALID_UTF8_SEQUENCE', 'encoding');
      if (/[\u202a-\u202e\u2066-\u2069]/u.test(text)) signal('UNICODE_DIRECTIONAL_CONTROL', 'text-integrity');
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) signal('UNEXPECTED_CONTROL_CHARACTER', 'text-integrity');
      INJECTION_PATTERNS.forEach(function (entry) { if (entry[1].test(text)) signal(entry[0], 'instruction-integrity'); });
      if (CREDENTIAL_PATTERNS.some(function (pattern) { return pattern.test(text); })) signal('CREDENTIAL_PATTERN', 'sensitive-material');
      if (/^application\/json(?:;|$)/i.test(mediaType)) {
        try { JSON.parse(text); } catch (_) { signal('DECLARED_JSON_INVALID', 'declared-format'); }
      }
    }

    bytes.fill(0);
    const state = signals.length ? 'TAINT_SIGNALLED' : 'NO_TAINT_SIGNAL';
    return seal(normalized, {
      actualSha256: actual,
      expectedSha256: expected,
      bytesInspected: Buffer.byteLength(typeof input.material === 'string' ? input.material : Buffer.from(input.material)),
      state,
      signals,
      namedSeams: signals.map(function (item) { return item.code; }),
      routedTo: signals.length ? 'gate-review' : 'none',
      nextCheapestCheck: signals.length
        ? 'Review the named signal with the domain-specific intake or security gate; do not treat this warning as a guilt verdict.'
        : 'Continue normal provenance, contract, and domain-specific safety checks; absence of a signal is not proof of safety.'
    });
  }

  return {
    capability: CAPABILITY,
    sniff,
    receipts: store.list,
    status: function () { return C.status(store, { maxBytes, materialRetained: false }); }
  };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, STATES, DEFAULT_MAX_BYTES, INJECTION_PATTERNS, CREDENTIAL_PATTERNS, textLike, binarySignature, create };
