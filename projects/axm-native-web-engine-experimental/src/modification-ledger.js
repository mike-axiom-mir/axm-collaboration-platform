'use strict';

const Digest = require('./digest');

const MODIFICATION_LEDGER_SCHEMA = 'axm.web.modification-ledger/v1';

function createModificationLedger(processed, structureIndex, layout, displayList, options) {
  options = options || {};
  if (!processed || !processed.source || !processed.documentTree || !processed.pageModel) throw new TypeError('processed core output is required');
  if (!structureIndex || !layout || !displayList) throw new TypeError('structure index, layout, and display list are required');
  const sourceDigest = processed.source.sha256;
  const material = {
    schema: MODIFICATION_LEDGER_SCHEMA,
    version: 1,
    ledgerKind: 'DERIVED_VIEW_ONLY',
    requestedBy: String(options.requestedBy || 'explicit-caller'),
    createdAt: options.createdAt == null ? null : String(options.createdAt),
    input: {
      sourceDigest,
      documentDigest: processed.documentTree.documentDigest,
      pageModelDigest: processed.pageModel.pageModelDigest
    },
    output: {
      mode: 'axm-structure',
      structureIndexDigest: structureIndex.structureIndexDigest,
      layoutDigest: layout.layoutDigest,
      displayListDigest: displayList.displayListDigest
    },
    sourceMutation: {
      performed: false,
      beforeDigest: sourceDigest,
      afterDigest: sourceDigest
    },
    pageCodeExecuted: false,
    networkUsed: false,
    reversible: true,
    reversal: 'discard-derived-view-and-reload-bound-source',
    entries: [
      {
        sequence: 1,
        operation: 'derive-shared-semantic-structure-index',
        classification: 'SEMANTIC_PROJECTION',
        inputDigest: processed.pageModel.pageModelDigest,
        outputDigest: structureIndex.structureIndexDigest,
        sourceMutated: false
      },
      {
        sequence: 2,
        operation: 'derive-axm-structure-layout',
        classification: 'VIEW_DERIVATION',
        inputDigest: structureIndex.structureIndexDigest,
        outputDigest: layout.layoutDigest,
        sourceMutated: false
      },
      {
        sequence: 3,
        operation: 'compile-renderer-neutral-display-list',
        classification: 'VIEW_DERIVATION',
        inputDigest: layout.layoutDigest,
        outputDigest: displayList.displayListDigest,
        sourceMutated: false
      }
    ]
  };
  return Object.assign({}, material, { ledgerDigest: Digest.canonicalDigest(material) });
}

module.exports = { MODIFICATION_LEDGER_SCHEMA, createModificationLedger };
