'use strict';

const { TextDecoder } = require('node:util');
const Source = require('./source-record');
const Tokenizer = require('./tokenizer');
const Tree = require('./tree-builder');
const Page = require('./page-model');
const Metadata = require('./metadata');

const HEADLESS_SCHEMA = 'axm.web.headless-result/v1';

function decodeUtf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    const wrapped = new Error('input is not valid UTF-8');
    wrapped.name = 'AxmEncodingError';
    wrapped.code = 'INVALID_UTF8';
    wrapped.cause = error;
    throw wrapped;
  }
}

function processBytes(input, options) {
  options = options || {};
  const bytes = Buffer.isBuffer(input) ? Buffer.from(input) : Buffer.from(String(input), 'utf8');
  const source = Source.createSourceRecord(bytes, options);
  const text = decodeUtf8(bytes);
  const tokenStream = Tokenizer.tokenize(text, {
    sourceDigest: source.sha256,
    maxTokens: options.maxTokens,
    maxAttributes: options.maxAttributes
  });
  const documentTree = Tree.buildDocument(tokenStream, { maxNesting: options.maxNesting });
  const pageModel = Page.buildPageModel(documentTree);
  return { source, tokenStream, documentTree, pageModel };
}

function headlessEnvelope(processed, options) {
  options = options || {};
  const command = options.command || 'inspect';
  const envelope = {
    schema: HEADLESS_SCHEMA,
    version: 1,
    engine: Metadata.engineMetadata(),
    mode: 'semantic',
    command,
    source: options.omitSourceBytes === true ? Source.withoutRawBytes(processed.source) : processed.source,
    capabilities: Metadata.capabilities(),
    documentDigest: processed.documentTree.documentDigest,
    pageModelDigest: processed.pageModel.pageModelDigest,
    warnings: processed.documentTree.warnings,
    unsupported: processed.documentTree.unsupported
  };
  if (command === 'tokenize') envelope.tokenStream = processed.tokenStream;
  if (command === 'parse') envelope.document = processed.documentTree;
  if (command === 'inspect') envelope.page = processed.pageModel;
  if (command === 'full') {
    envelope.tokenStream = processed.tokenStream;
    envelope.document = processed.documentTree;
    envelope.page = processed.pageModel;
  }
  return envelope;
}

function run(input, options) {
  const processed = processBytes(input, options);
  return headlessEnvelope(processed, options);
}

module.exports = {
  HEADLESS_SCHEMA,
  decodeUtf8,
  processBytes,
  headlessEnvelope,
  run
};
