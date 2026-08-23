'use strict';

const Digest = require('./digest');

const SCHEMA = 'axm.web.source-record/v1';
const DEFAULT_MAX_BYTES = 1024 * 1024;

class AxmLimitError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmLimitError';
    this.code = code;
    this.details = details || {};
  }
}

function cleanLocator(value) {
  const text = String(value == null ? 'stdin:' : value).replace(/\\/g, '/');
  if (!text || text === '-') return 'stdin:';
  return text;
}

function createSourceRecord(input, options) {
  options = options || {};
  const bytes = Buffer.isBuffer(input) ? Buffer.from(input) : Buffer.from(String(input), 'utf8');
  const maxBytes = Number.isInteger(options.maxBytes) ? options.maxBytes : DEFAULT_MAX_BYTES;
  if (maxBytes < 1) throw new TypeError('maxBytes must be a positive integer');
  if (bytes.length > maxBytes) {
    throw new AxmLimitError('SOURCE_BYTES_LIMIT', 'source exceeds configured byte limit', {
      byteLength: bytes.length,
      maxBytes
    });
  }
  const digest = Digest.sha256Hex(bytes);
  const requestedUrl = cleanLocator(options.requestedUrl);
  const finalUrl = cleanLocator(options.finalUrl == null ? requestedUrl : options.finalUrl);
  return {
    schema: SCHEMA,
    sourceId: 'source-' + digest.slice(0, 24),
    requestedUrl,
    finalUrl,
    originKind: requestedUrl === 'stdin:' ? 'stdin' : 'local-file',
    mimeType: String(options.mimeType || 'text/html'),
    encoding: 'utf-8',
    byteLength: bytes.length,
    sha256: digest,
    bytesPreserved: true,
    rawSourceBase64: bytes.toString('base64'),
    fetchedAt: options.fetchedAt == null ? null : String(options.fetchedAt),
    responseMetadata: null,
    networkReceipt: null,
    resourceDigests: []
  };
}

function recoverBytes(record) {
  if (!record || record.schema !== SCHEMA || record.bytesPreserved !== true || typeof record.rawSourceBase64 !== 'string') {
    throw new TypeError('source record does not contain preserved bytes');
  }
  const bytes = Buffer.from(record.rawSourceBase64, 'base64');
  if (bytes.length !== record.byteLength || Digest.sha256Hex(bytes) !== record.sha256) {
    throw new Error('source record byte binding failed');
  }
  return bytes;
}

function withoutRawBytes(record) {
  const copy = Object.assign({}, record);
  delete copy.rawSourceBase64;
  copy.bytesPreservedInEnvelope = false;
  copy.binding = { algorithm: 'sha256', digest: record.sha256, byteLength: record.byteLength };
  return copy;
}

module.exports = {
  SCHEMA,
  DEFAULT_MAX_BYTES,
  AxmLimitError,
  createSourceRecord,
  recoverBytes,
  withoutRawBytes
};
