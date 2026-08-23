'use strict';

const { TextDecoder } = require('node:util');
const Source = require('./source-record');
const Tokenizer = require('./tokenizer');
const Tree = require('./tree-builder');
const Page = require('./page-model');
const StructureIndex = require('./structure-index');
const StructureLayout = require('./structure-layout');
const DisplayList = require('./display-list');
const ModificationLedger = require('./modification-ledger');
const Metadata = require('./metadata');

const HEADLESS_SCHEMA = 'axm.web.headless-result/v1';
const STRUCTURE_COMMANDS = new Set(['outline', 'layout', 'display']);
const LAYOUT_COMMANDS = new Set(['layout', 'display']);

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

function deriveStructure(processed, options, providedIndex) {
  options = options || {};
  const structureIndex = providedIndex || StructureIndex.buildStructureIndex(processed, options);
  const layout = StructureLayout.buildStructureLayout(processed, options, structureIndex);
  const displayList = DisplayList.buildDisplayList(layout);
  const modificationLedger = ModificationLedger.createModificationLedger(processed, structureIndex, layout, displayList, options);
  return { processed, structureIndex, layout, displayList, modificationLedger };
}

function headlessEnvelope(processed, options) {
  options = options || {};
  const command = options.command || 'inspect';
  const isStructureCommand = STRUCTURE_COMMANDS.has(command);
  const structureIndex = isStructureCommand ? StructureIndex.buildStructureIndex(processed, options) : null;
  const derived = LAYOUT_COMMANDS.has(command) ? deriveStructure(processed, options, structureIndex) : null;
  const envelope = {
    schema: HEADLESS_SCHEMA,
    version: 1,
    engine: Metadata.engineMetadata(),
    mode: isStructureCommand ? 'axm-structure' : 'semantic',
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
  if (command === 'outline') {
    envelope.structureIndexDigest = structureIndex.structureIndexDigest;
    envelope.structureIndex = structureIndex;
  }
  if (command === 'layout') {
    envelope.structureIndexDigest = derived.structureIndex.structureIndexDigest;
    envelope.layoutDigest = derived.layout.layoutDigest;
    envelope.displayListDigest = derived.displayList.displayListDigest;
    envelope.ledgerDigest = derived.modificationLedger.ledgerDigest;
    envelope.structureLayout = derived.layout;
    envelope.modificationLedger = derived.modificationLedger;
  }
  if (command === 'display') {
    envelope.structureIndexDigest = derived.structureIndex.structureIndexDigest;
    envelope.layoutDigest = derived.layout.layoutDigest;
    envelope.displayListDigest = derived.displayList.displayListDigest;
    envelope.ledgerDigest = derived.modificationLedger.ledgerDigest;
    envelope.displayList = derived.displayList;
    envelope.modificationLedger = derived.modificationLedger;
  }
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
  STRUCTURE_COMMANDS,
  LAYOUT_COMMANDS,
  decodeUtf8,
  processBytes,
  deriveStructure,
  headlessEnvelope,
  run
};
