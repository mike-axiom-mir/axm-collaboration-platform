'use strict';

const Digest = require('./digest');

const REFERENCE_RECEIPT_SCHEMA = 'axm.web.reference-receipt/v1';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 120000;
const MAX_QUERY_CHARS = 400;
const MAX_NAME_CHARS = 180;
const MAX_HINT_CHARS = 1000;
const MAX_PREVIEW_CHARS = 2000;
const PURPOSES = new Set(['find-similar', 'research', 'identify', 'compare']);
const SAFE_TEXT_MEDIA = new Set(['text/plain', 'text/markdown', 'text/html', 'application/json']);
const IMAGE_MEDIA = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const DOCUMENT_MEDIA = new Set(['application/pdf', ...SAFE_TEXT_MEDIA]);

class AxmReferenceIntakeError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmReferenceIntakeError';
    this.code = code;
    this.details = details || {};
  }
}

function cleanText(value, name, max, required) {
  const text = String(value == null ? '' : value).trim();
  if (required && !text) throw new AxmReferenceIntakeError('REFERENCE_INVALID', name + ' is required');
  if (text.length > max) throw new AxmReferenceIntakeError('REFERENCE_LIMIT', name + ' exceeds its character bound', { name, max, length: text.length });
  return text;
}

function cleanName(value) {
  const name = cleanText(value || 'reference', 'name', MAX_NAME_CHARS, true)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '_');
  return name || 'reference';
}

function cleanPurpose(value) {
  const purpose = cleanText(value || 'find-similar', 'purpose', 32, true).toLowerCase();
  if (!PURPOSES.has(purpose)) throw new AxmReferenceIntakeError('REFERENCE_INVALID', 'unsupported reference purpose', { purpose });
  return purpose;
}

function baseAuthority() {
  return {
    observationOnly: true,
    executableContentAllowed: false,
    browserMutationAllowed: false,
    networkAuthorityGranted: false,
    providerExecutionGranted: false,
    installAllowed: false,
    promotionAllowed: false,
    canonAllowed: false
  };
}

function seal(material) {
  return Object.assign({}, material, { receiptDigest: Digest.canonicalDigest(material) });
}

function createQueryReference(queryInput, options) {
  const query = cleanText(queryInput, 'query', MAX_QUERY_CHARS, true).replace(/\s+/g, ' ');
  const words = query.split(' ');
  if (words.length > 50) throw new AxmReferenceIntakeError('REFERENCE_LIMIT', 'query exceeds the 50-word bound', { words: words.length });
  const material = {
    schema: REFERENCE_RECEIPT_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    kind: 'query',
    name: 'search-query',
    mediaType: 'text/plain',
    bytes: Buffer.byteLength(query, 'utf8'),
    sha256: Digest.sha256Hex(Buffer.from(query, 'utf8')),
    purpose: cleanPurpose(options && options.purpose),
    userHint: cleanText(options && options.userHint, 'userHint', MAX_HINT_CHARS, false) || null,
    textPreview: query.slice(0, MAX_PREVIEW_CHARS),
    contentState: 'TEXT_AVAILABLE',
    privacy: 'USER_SELECTED_LOCAL_INPUT',
    authority: baseAuthority()
  };
  return { receipt: seal(material), runtime: { kind: 'query', text: query } };
}

function createTextReference(textInput, options) {
  const text = cleanText(textInput, 'text', MAX_TEXT_CHARS, true);
  const mediaType = String(options && options.mediaType || 'text/plain').toLowerCase();
  if (!SAFE_TEXT_MEDIA.has(mediaType)) throw new AxmReferenceIntakeError('REFERENCE_MEDIA_UNSUPPORTED', 'text reference media type is not in the safe-text allowlist', { mediaType });
  const bytes = Buffer.from(text, 'utf8');
  const material = {
    schema: REFERENCE_RECEIPT_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    kind: 'document',
    name: cleanName(options && options.name || 'reference.txt'),
    mediaType,
    bytes: bytes.length,
    sha256: Digest.sha256Hex(bytes),
    purpose: cleanPurpose(options && options.purpose),
    userHint: cleanText(options && options.userHint, 'userHint', MAX_HINT_CHARS, false) || null,
    textPreview: text.slice(0, MAX_PREVIEW_CHARS),
    contentState: 'TEXT_AVAILABLE',
    privacy: 'USER_SELECTED_LOCAL_INPUT',
    authority: baseAuthority()
  };
  return { receipt: seal(material), runtime: { kind: 'document', mediaType, text } };
}

function normalizeBytes(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  throw new AxmReferenceIntakeError('REFERENCE_INVALID', 'file reference bytes must be Buffer, Uint8Array, or ArrayBuffer');
}

function classifyMediaType(mediaType) {
  if (IMAGE_MEDIA.has(mediaType)) return 'image';
  if (DOCUMENT_MEDIA.has(mediaType)) return 'document';
  return null;
}

function decodeSafeText(bytes) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (_error) { throw new AxmReferenceIntakeError('REFERENCE_TEXT_UTF8', 'text document must contain valid UTF-8'); }
  if (text.length > MAX_TEXT_CHARS) throw new AxmReferenceIntakeError('REFERENCE_LIMIT', 'decoded text exceeds the character bound', { length: text.length, max: MAX_TEXT_CHARS });
  return text;
}

function createFileReference(bytesInput, metadata) {
  metadata = metadata || {};
  const bytes = normalizeBytes(bytesInput);
  if (!bytes.length) throw new AxmReferenceIntakeError('REFERENCE_INVALID', 'file reference may not be empty');
  if (bytes.length > MAX_FILE_BYTES) throw new AxmReferenceIntakeError('REFERENCE_LIMIT', 'file reference exceeds the byte bound', { bytes: bytes.length, max: MAX_FILE_BYTES });
  const mediaType = cleanText(metadata.mediaType, 'mediaType', 120, true).toLowerCase().split(';')[0].trim();
  const kind = classifyMediaType(mediaType);
  if (!kind) throw new AxmReferenceIntakeError('REFERENCE_MEDIA_UNSUPPORTED', 'media type is not supported by reference intake', {
    mediaType,
    supported: Array.from(new Set([...IMAGE_MEDIA, ...DOCUMENT_MEDIA])).sort()
  });
  const text = SAFE_TEXT_MEDIA.has(mediaType) ? decodeSafeText(bytes) : null;
  const material = {
    schema: REFERENCE_RECEIPT_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    kind,
    name: cleanName(metadata.name || (kind === 'image' ? 'reference-image' : 'reference-document')),
    mediaType,
    bytes: bytes.length,
    sha256: Digest.sha256Hex(bytes),
    purpose: cleanPurpose(metadata.purpose),
    userHint: cleanText(metadata.userHint, 'userHint', MAX_HINT_CHARS, false) || null,
    textPreview: text == null ? null : text.slice(0, MAX_PREVIEW_CHARS),
    contentState: text == null ? 'BINARY_AVAILABLE' : 'TEXT_AVAILABLE',
    privacy: 'USER_SELECTED_LOCAL_INPUT',
    authority: baseAuthority()
  };
  return {
    receipt: seal(material),
    runtime: text == null
      ? { kind, mediaType, dataBase64: bytes.toString('base64') }
      : { kind, mediaType, text }
  };
}

function receiptMaterial(receipt) {
  const copy = JSON.parse(JSON.stringify(receipt));
  delete copy.receiptDigest;
  return copy;
}

function validateReference(reference) {
  if (!reference || !reference.receipt || reference.receipt.schema !== REFERENCE_RECEIPT_SCHEMA || typeof reference.receipt.receiptDigest !== 'string') {
    throw new AxmReferenceIntakeError('REFERENCE_INVALID', 'a sealed AXM reference bundle is required');
  }
  const receipt = reference.receipt;
  const computedReceipt = Digest.canonicalDigest(receiptMaterial(receipt));
  if (computedReceipt !== receipt.receiptDigest) throw new AxmReferenceIntakeError('REFERENCE_DIGEST_MISMATCH', 'reference receipt digest does not match its material');
  const runtime = reference.runtime || {};
  let bytes;
  if (typeof runtime.text === 'string') bytes = Buffer.from(runtime.text, 'utf8');
  else if (typeof runtime.dataBase64 === 'string') {
    try { bytes = Buffer.from(runtime.dataBase64, 'base64'); }
    catch (_error) { throw new AxmReferenceIntakeError('REFERENCE_INVALID', 'reference dataBase64 is invalid'); }
  } else {
    throw new AxmReferenceIntakeError('REFERENCE_INVALID', 'reference runtime payload is missing');
  }
  if (bytes.length !== receipt.bytes || Digest.sha256Hex(bytes) !== receipt.sha256) {
    throw new AxmReferenceIntakeError('REFERENCE_CONTENT_DIGEST_MISMATCH', 'reference runtime bytes do not match the sealed receipt', {
      expectedBytes: receipt.bytes,
      actualBytes: bytes.length
    });
  }
  return reference;
}

function providerPayload(reference) {
  validateReference(reference);
  return {
    receipt: reference.receipt,
    kind: reference.receipt.kind,
    mediaType: reference.receipt.mediaType,
    name: reference.receipt.name,
    text: typeof reference.runtime.text === 'string' ? reference.runtime.text : null,
    dataBase64: typeof reference.runtime.dataBase64 === 'string' ? reference.runtime.dataBase64 : null
  };
}

module.exports = {
  REFERENCE_RECEIPT_SCHEMA,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  MAX_QUERY_CHARS,
  IMAGE_MEDIA,
  DOCUMENT_MEDIA,
  SAFE_TEXT_MEDIA,
  AxmReferenceIntakeError,
  createQueryReference,
  createTextReference,
  createFileReference,
  validateReference,
  providerPayload
};
