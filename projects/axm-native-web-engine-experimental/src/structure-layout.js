'use strict';

const Digest = require('./digest');

const STRUCTURE_LAYOUT_SCHEMA = 'axm.web.structure-layout/v1';
const DEFAULT_VIEWPORT = Object.freeze({ width: 1120, height: 760 });
const DEFAULT_MAX_ITEMS = 512;
const DEFAULT_MAX_TEXT_CHARS = 65536;
const DEFAULT_MAX_CANVAS_HEIGHT = 32768;

class AxmStructureLimitError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmStructureLimitError';
    this.code = code;
    this.details = details || {};
  }
}

function cleanText(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '\ufffd')
    .replace(/[\t\r\n\f ]+/g, ' ')
    .trim();
}

function positiveInteger(value, fallback, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new TypeError(name + ' must be a positive integer');
  return value;
}

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

function nodeOrder(nodeRef) {
  const match = /^n([0-9]+)$/.exec(String(nodeRef || ''));
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function formText(form, controlsByRef) {
  const details = (form.controlRefs || []).map(function (ref) {
    const control = controlsByRef.get(ref);
    if (!control) return null;
    const label = cleanText(control.label || control.name || control.kind || 'control');
    const flags = [cleanText(control.type || control.kind)];
    if (control.required) flags.push('required');
    if (control.disabled) flags.push('disabled');
    return label + ' [' + flags.join(', ') + ']';
  }).filter(Boolean);
  return details.length ? details.join(' \u00b7 ') : 'No extracted controls';
}

function collectBlocks(pageModel) {
  const blocks = [];
  const controlsByRef = new Map((pageModel.controls || []).map(function (control) { return [control.nodeRef, control]; }));

  (pageModel.headings || []).forEach(function (heading) {
    blocks.push({
      nodeRef: heading.nodeRef,
      kind: 'heading',
      label: 'Heading H' + heading.level,
      text: cleanText(heading.text) || '(empty heading)',
      meta: 'Semantic heading level ' + heading.level
    });
  });
  (pageModel.paragraphs || []).forEach(function (paragraph) {
    blocks.push({
      nodeRef: paragraph.nodeRef,
      kind: 'paragraph',
      label: 'Paragraph',
      text: cleanText(paragraph.text) || '(empty paragraph)',
      meta: 'Visible semantic text'
    });
  });
  (pageModel.links || []).forEach(function (link) {
    blocks.push({
      nodeRef: link.nodeRef,
      kind: 'link',
      label: 'Inert link',
      text: cleanText(link.text) || '(untitled link)',
      meta: link.href == null ? 'No href extracted' : 'Target preserved as text: ' + cleanText(link.href)
    });
  });
  (pageModel.media || []).forEach(function (media) {
    blocks.push({
      nodeRef: media.nodeRef,
      kind: 'media',
      label: 'Media placeholder',
      text: cleanText(media.alt) || '(image without alt text)',
      meta: media.src == null ? 'No source extracted' : 'Source preserved as text: ' + cleanText(media.src)
    });
  });
  (pageModel.lists || []).forEach(function (list) {
    blocks.push({
      nodeRef: list.nodeRef,
      kind: 'list',
      label: list.ordered ? 'Ordered list' : 'Unordered list',
      text: (list.items || []).map(function (item, index) {
        return (list.ordered ? String(index + 1) + '.' : '\u2022') + ' ' + cleanText(item.text);
      }).join('  '),
      meta: String((list.items || []).length) + ' extracted item(s)'
    });
  });
  (pageModel.tables || []).forEach(function (table) {
    blocks.push({
      nodeRef: table.nodeRef,
      kind: 'table',
      label: 'Table summary',
      text: cleanText(table.caption) || '(table without caption)',
      meta: String(table.rowCount) + ' row(s) \u00b7 about ' + String(table.columnEstimate) + ' column(s)' +
        ((table.headers || []).length ? ' \u00b7 headers: ' + table.headers.map(cleanText).join(', ') : '')
    });
  });
  (pageModel.forms || []).forEach(function (form) {
    blocks.push({
      nodeRef: form.nodeRef,
      kind: 'form',
      label: 'Inert form',
      text: formText(form, controlsByRef),
      meta: cleanText(String(form.method || 'get').toUpperCase() + ' ' + String(form.action || '(no action)')) + ' \u00b7 submission held'
    });
  });

  blocks.sort(function (a, b) {
    const order = nodeOrder(a.nodeRef) - nodeOrder(b.nodeRef);
    return order || a.kind.localeCompare(b.kind);
  });
  if (blocks.length === 0 && cleanText(pageModel.plainText)) {
    blocks.push({ nodeRef: null, kind: 'plain-text', label: 'Plain text', text: cleanText(pageModel.plainText), meta: 'Fallback semantic view' });
  }
  return blocks;
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

function summaryFor(pageModel) {
  return {
    headings: (pageModel.headings || []).length,
    paragraphs: (pageModel.paragraphs || []).length,
    links: (pageModel.links || []).length,
    media: (pageModel.media || []).length,
    lists: (pageModel.lists || []).length,
    tables: (pageModel.tables || []).length,
    forms: (pageModel.forms || []).length,
    controls: (pageModel.controls || []).length
  };
}

function buildStructureLayout(processed, options) {
  options = options || {};
  if (!processed || !processed.source || !processed.documentTree || !processed.pageModel) {
    throw new TypeError('processed source, document tree, and Page Model are required');
  }
  const viewport = viewportFrom(options);
  const maxItems = positiveInteger(options.maxLayoutItems, DEFAULT_MAX_ITEMS, 'maxLayoutItems');
  const maxTextChars = positiveInteger(options.maxLayoutTextChars, DEFAULT_MAX_TEXT_CHARS, 'maxLayoutTextChars');
  const maxCanvasHeight = positiveInteger(options.maxCanvasHeight, DEFAULT_MAX_CANVAS_HEIGHT, 'maxCanvasHeight');
  const blocks = collectBlocks(processed.pageModel);
  if (blocks.length > maxItems) {
    throw new AxmStructureLimitError('AXM_STRUCTURE_ITEM_LIMIT', 'semantic blocks exceed the configured structure-view item limit', {
      itemCount: blocks.length,
      maxItems
    });
  }

  const locator = cleanText(processed.source.finalUrl || processed.source.requestedUrl || 'stdin:');
  const pageTitle = cleanText(processed.pageModel.title) || 'Untitled local document';
  const textCharacters = blocks.reduce(function (sum, block) {
    return sum + block.label.length + block.text.length + block.meta.length;
  }, locator.length + pageTitle.length);
  if (textCharacters > maxTextChars) {
    throw new AxmStructureLimitError('AXM_STRUCTURE_TEXT_LIMIT', 'structure-view text exceeds the configured character limit', {
      textCharacters,
      maxTextChars
    });
  }

  const margin = 32;
  const cardWidth = viewport.width - margin * 2;
  const bodyCharacters = Math.max(24, Math.floor((cardWidth - 44) / 8.4));
  const metaCharacters = Math.max(24, Math.floor((cardWidth - 44) / 7.4));
  let y = 216;
  const items = blocks.map(function (block, index) {
    const textLines = wrapText(block.text, bodyCharacters);
    const metaLines = wrapText(block.meta, metaCharacters);
    const height = 54 + Math.max(1, textLines.length) * 24 + Math.max(1, metaLines.length) * 18 + 18;
    const item = {
      itemId: 'item-' + String(index + 1).padStart(4, '0'),
      nodeRef: block.nodeRef,
      kind: block.kind,
      label: block.label,
      text: block.text,
      meta: block.meta,
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
    viewport,
    canvas: { width: viewport.width, height: canvasHeight },
    limits: { maxItems, maxTextChars, maxCanvasHeight, observedTextCharacters: textCharacters },
    chrome: {
      product: 'AXM Structure Browser',
      status: 'EXPERIMENTAL',
      title: pageTitle,
      locator,
      view: 'AXM Structure View',
      siteView: 'HELD',
      navigation: 'HELD',
      network: 'OFFLINE'
    },
    summary: summaryFor(processed.pageModel),
    items,
    held: [
      { feature: 'site-css-cascade-and-layout', state: 'HELD' },
      { feature: 'navigation-and-history', state: 'HELD' },
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
  buildStructureLayout
};
