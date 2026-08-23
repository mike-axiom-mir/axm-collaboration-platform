'use strict';

const Digest = require('./digest');
const StructureIndex = require('./structure-index');

const STRUCTURE_LAYOUT_SCHEMA = 'axm.web.structure-layout/v1';
const DEFAULT_VIEWPORT = Object.freeze({ width: 1120, height: 760 });
const DEFAULT_MAX_ITEMS = StructureIndex.DEFAULT_MAX_ITEMS;
const DEFAULT_MAX_TEXT_CHARS = StructureIndex.DEFAULT_MAX_TEXT_CHARS;
const DEFAULT_MAX_CANVAS_HEIGHT = 32768;
const AxmStructureLimitError = StructureIndex.AxmStructureLimitError;
const cleanText = StructureIndex.cleanText;
const positiveInteger = StructureIndex.positiveInteger;

function viewportFrom(options) {
  const value = options && options.viewport || DEFAULT_VIEWPORT;
  const width = positiveInteger(value.width, DEFAULT_VIEWPORT.width, 'viewport width');
  const height = positiveInteger(value.height, DEFAULT_VIEWPORT.height, 'viewport height');
  if (width < 640 || width > 2400 || height < 320 || height > 2160) {
    throw new AxmStructureLimitError('AXM_VIEWPORT_LIMIT', 'viewport is outside the experimental structure-view bounds', {
      width,
      height,
      allowed: { minWidth: 640, maxWidth: 2400, minHeight: 320, maxHeight: 2160 }
    });
  }
  return { width, height };
}

function collectBlocks(pageModel) {
  return StructureIndex.collectEntries(pageModel).map(function (entry) {
    const block = Object.assign({}, entry);
    delete block.entryId;
    return block;
  });
}

function wrapText(value, maxCharacters) {
  const text = cleanText(value);
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(function (word) {
    const pieces = [];
    let rest = word;
    while (rest.length > maxCharacters) {
      pieces.push(rest.slice(0, maxCharacters));
      rest = rest.slice(maxCharacters);
    }
    if (rest) pieces.push(rest);
    pieces.forEach(function (piece) {
      const candidate = line ? line + ' ' + piece : piece;
      if (candidate.length > maxCharacters && line) {
        lines.push(line);
        line = piece;
      } else {
        line = candidate;
      }
    });
  });
  if (line) lines.push(line);
  return lines;
}

function buildStructureLayout(processed, options, providedIndex) {
  options = options || {};
  if (!processed || !processed.source || !processed.documentTree || !processed.pageModel) {
    throw new TypeError('processed source, document tree, and Page Model are required');
  }
  const structureIndex = providedIndex || StructureIndex.buildStructureIndex(processed, options);
  StructureIndex.assertLineage(structureIndex, processed);
  const viewport = viewportFrom(options);
  const maxCanvasHeight = positiveInteger(options.maxCanvasHeight, DEFAULT_MAX_CANVAS_HEIGHT, 'maxCanvasHeight');
  const margin = 32;
  const cardWidth = viewport.width - margin * 2;
  const bodyCharacters = Math.max(24, Math.floor((cardWidth - 44) / 8.4));
  const metaCharacters = Math.max(24, Math.floor((cardWidth - 44) / 7.4));
  let y = 216;
  const items = structureIndex.entries.map(function (entry, index) {
    const textLines = wrapText(entry.text, bodyCharacters);
    const metaLines = wrapText(entry.meta, metaCharacters);
    const height = 54 + Math.max(1, textLines.length) * 24 + Math.max(1, metaLines.length) * 18 + 18;
    const item = {
      itemId: 'item-' + String(index + 1).padStart(4, '0'),
      entryRef: entry.entryId,
      nodeRef: entry.nodeRef,
      kind: entry.kind,
      label: entry.label,
      text: entry.text,
      meta: entry.meta,
      textLines,
      metaLines,
      box: { x: margin, y, width: cardWidth, height }
    };
    y += height + 14;
    return item;
  });
  const canvasHeight = Math.max(viewport.height, y + 26);
  if (canvasHeight > maxCanvasHeight) {
    throw new AxmStructureLimitError('AXM_STRUCTURE_HEIGHT_LIMIT', 'derived structure view exceeds the configured canvas height', {
      canvasHeight,
      maxCanvasHeight
    });
  }

  const material = {
    schema: STRUCTURE_LAYOUT_SCHEMA,
    version: 1,
    mode: 'axm-structure',
    sourceDigest: processed.source.sha256,
    documentDigest: processed.documentTree.documentDigest,
    pageModelDigest: processed.pageModel.pageModelDigest,
    structureIndexDigest: structureIndex.structureIndexDigest,
    viewport,
    canvas: { width: viewport.width, height: canvasHeight },
    limits: {
      maxItems: structureIndex.limits.maxItems,
      maxTextChars: structureIndex.limits.maxTextChars,
      maxCanvasHeight,
      observedTextCharacters: structureIndex.limits.observedTextCharacters
    },
    chrome: {
      product: 'AXM Structure Browser',
      status: 'EXPERIMENTAL',
      title: structureIndex.title,
      locator: structureIndex.locator,
      view: 'AXM Structure View',
      siteView: 'HELD',
      navigation: 'HELD',
      network: 'OFFLINE'
    },
    summary: structureIndex.summary,
    items,
    held: [
      { feature: 'site-css-cascade-and-layout', state: 'HELD' },
      { feature: 'page-navigation-and-history', state: 'HELD' },
      { feature: 'page-script-execution', state: 'HELD' },
      { feature: 'network-resource-loading', state: 'HELD' }
    ]
  };
  return Object.assign({}, material, { layoutDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  STRUCTURE_LAYOUT_SCHEMA,
  DEFAULT_VIEWPORT,
  DEFAULT_MAX_ITEMS,
  DEFAULT_MAX_TEXT_CHARS,
  DEFAULT_MAX_CANVAS_HEIGHT,
  AxmStructureLimitError,
  cleanText,
  viewportFrom,
  collectBlocks,
  wrapText,
  summaryFor: StructureIndex.summaryFor,
  buildStructureLayout
};
