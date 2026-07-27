'use strict';

const U = require('./foundation-utils');

const RECEIPT_SCHEMA = 'axm.round-trip-ledger-receipt/v1';

function bytes(value, label) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new Error((label || 'content') + ' must be a Buffer or string');
}

function flatten(value, prefix, out) {
  out = out || {};
  prefix = prefix || '$';
  if (value === null || typeof value !== 'object') {
    out[prefix] = value;
    return out;
  }
  const keys = Array.isArray(value) ? value.map((_, index) => String(index)) : Object.keys(value).sort();
  if (!keys.length) out[prefix] = Array.isArray(value) ? [] : {};
  for (const key of keys) flatten(value[key], prefix + (Array.isArray(value) ? '[' + key + ']' : '.' + key), out);
  return out;
}

function semanticDiff(before, after) {
  const left = flatten(before);
  const right = flatten(after);
  const keys = Array.from(new Set(Object.keys(left).concat(Object.keys(right)))).sort();
  return keys.filter((key) => U.canonical(left[key]) !== U.canonical(right[key]));
}

function createAdapter(spec) {
  spec = spec || {};
  const knownLosses = U.boundedArray(spec.known_losses || [], 0, 100, 'known losses').map((item) => U.text(item, 200, 'known loss path')).sort();
  U.ensure(new Set(knownLosses).size === knownLosses.length, 'known losses must be unique');
  U.ensure(typeof spec.import_content === 'function' && typeof spec.export_content === 'function', 'adapter import and export functions required');
  return Object.freeze({
    schema: 'axm.round-trip-adapter/v1',
    id: U.text(spec.id, 100, 'adapter id'),
    version: U.text(spec.version, 40, 'adapter version'),
    input_mime: U.text(spec.input_mime, 100, 'adapter input MIME'),
    output_mime: U.text(spec.output_mime, 100, 'adapter output MIME'),
    known_losses: Object.freeze(knownLosses),
    import_content: spec.import_content,
    export_content: spec.export_content,
  });
}

function evaluate(adapter, source) {
  U.ensure(adapter && adapter.schema === 'axm.round-trip-adapter/v1', 'round-trip adapter required');
  source = source || {};
  const sourceBytes = bytes(source.content, 'source content');
  const sourceMime = U.text(source.mime, 100, 'source MIME');
  U.ensure(sourceMime === adapter.input_mime, 'source MIME is not supported by this adapter');
  const imported = adapter.import_content(Buffer.from(sourceBytes), { mime: sourceMime });
  U.ensure(imported && Object.prototype.hasOwnProperty.call(imported, 'document') && imported.facts, 'adapter import must return document and semantic facts');
  const exported = adapter.export_content(U.clone(imported.document), { source_mime: sourceMime });
  U.ensure(exported && exported.mime === adapter.output_mime, 'adapter export MIME mismatch');
  const outputBytes = bytes(exported.content, 'exported content');
  const reimported = adapter.import_content(Buffer.from(outputBytes), { mime: exported.mime, round_trip: true });
  U.ensure(reimported && reimported.facts, 'adapter must re-import its output for semantic comparison');
  const differences = semanticDiff(imported.facts, reimported.facts);
  const declared = U.boundedArray(exported.losses || [], 0, 100, 'exported losses').map((item) => U.text(item, 200, 'exported loss path')).sort();
  const unexpected = differences.filter((item) => !declared.includes(item));
  const falseDeclarations = declared.filter((item) => !differences.includes(item));
  const unknownDeclarations = declared.filter((item) => !adapter.known_losses.includes(item));
  const pass = unexpected.length === 0 && falseDeclarations.length === 0 && unknownDeclarations.length === 0;
  const status = !pass ? 'FAIL' : differences.length ? 'DECLARED_LOSS' : 'LOSSLESS';
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: '1.0.0',
    adapter: { id: adapter.id, version: adapter.version },
    input: { mime: sourceMime, sha256: U.sha256(sourceBytes), bytes: sourceBytes.length },
    output: { mime: exported.mime, sha256: U.sha256(outputBytes), bytes: outputBytes.length },
    exact_source: { encoding: 'base64', content: sourceBytes.toString('base64'), sha256: U.sha256(sourceBytes) },
    semantic_differences: differences,
    declared_losses: declared,
    unexpected_losses: unexpected,
    false_loss_declarations: falseDeclarations,
    unknown_loss_declarations: unknownDeclarations,
    byte_identical: sourceMime === exported.mime && sourceBytes.equals(outputBytes),
    status,
  };
  receipt.id = U.receiptId('round-trip', receipt);
  receipt.digest = U.sha256(receipt);
  return { receipt, content: outputBytes, mime: exported.mime, document: U.clone(reimported.document) };
}

module.exports = { RECEIPT_SCHEMA, createAdapter, semanticDiff, evaluate };
