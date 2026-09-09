'use strict';

const Digest = require('./digest');

const STRUCTURE_INDEX_SCHEMA = 'axm.web.structure-index/v1';
const DEFAULT_MAX_ITEMS = 512;
const DEFAULT_MAX_TEXT_CHARS = 65536;

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

function collectEntries(pageModel) {
  const entries = [];
  const controlsByRef = new Map((pageModel.controls || []).map(function (control) { return [control.nodeRef, control]; }));

  (pageModel.headings || []).forEach(function (heading) {
    entries.push({
      nodeRef: heading.nodeRef,
      kind: 'heading',
      label: 'Heading H' + heading.level,
      text: cleanText(heading.text) || '(empty heading)',
      meta: 'Semantic heading level ' + heading.level
    });
  });
  (pageModel.paragraphs || []).forEach(function (paragraph) {
    entries.push({
      nodeRef: paragraph.nodeRef,
      kind: 'paragraph',
      label: 'Paragraph',
      text: cleanText(paragraph.text) || '(empty paragraph)',
      meta: 'Visible semantic text'
    });
  });
  (pageModel.landmarks || []).forEach(function (landmark) {
    const role = cleanText(landmark.role) || 'landmark';
    const label = cleanText(landmark.label);
    entries.push({
      nodeRef: landmark.nodeRef,
      kind: 'landmark',
      label: role.charAt(0).toUpperCase() + role.slice(1) + ' landmark',
      text: label || '(unlabelled ' + role + ')',
      meta: 'Semantic document region'
    });
  });
  (pageModel.links || []).forEach(function (link) {
    entries.push({
      nodeRef: link.nodeRef,
      kind: 'link',
      label: 'Inert page link',
      text: cleanText(link.text) || '(untitled link)',
      meta: link.href == null ? 'No href extracted' : 'Target preserved as text: ' + cleanText(link.href)
    });
  });
  (pageModel.media || []).forEach(function (media) {
    entries.push({
      nodeRef: media.nodeRef,
      kind: 'media',
      label: 'Media placeholder',
      text: cleanText(media.alt) || '(image without alt text)',
      meta: media.src == null ? 'No source extracted' : 'Source preserved as text: ' + cleanText(media.src)
    });
  });
  (pageModel.lists || []).forEach(function (list) {
    entries.push({
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
    entries.push({
      nodeRef: table.nodeRef,
      kind: 'table',
      label: 'Table summary',
      text: cleanText(table.caption) || '(table without caption)',
      meta: String(table.rowCount) + ' row(s) \u00b7 about ' + String(table.columnEstimate) + ' column(s)' +
        ((table.headers || []).length ? ' \u00b7 headers: ' + table.headers.map(cleanText).join(', ') : '')
    });
  });
  (pageModel.forms || []).forEach(function (form) {
    entries.push({
      nodeRef: form.nodeRef,
      kind: 'form',
      label: 'Inert form',
      text: formText(form, controlsByRef),
      meta: cleanText(String(form.method || 'get').toUpperCase() + ' ' + String(form.action || '(no action)')) + ' \u00b7 submission held'
    });
  });

  entries.sort(function (a, b) {
    const order = nodeOrder(a.nodeRef) - nodeOrder(b.nodeRef);
    return order || a.kind.localeCompare(b.kind);
  });
  if (entries.length === 0 && cleanText(pageModel.plainText)) {
    entries.push({
      nodeRef: null,
      kind: 'plain-text',
      label: 'Plain text',
      text: cleanText(pageModel.plainText),
      meta: 'Fallback semantic view'
    });
  }
  return entries.map(function (entry, index) {
    return Object.assign({ entryId: 'entry-' + String(index + 1).padStart(4, '0') }, entry);
  });
}

function summaryFor(pageModel) {
  return {
    headings: (pageModel.headings || []).length,
    paragraphs: (pageModel.paragraphs || []).length,
    landmarks: (pageModel.landmarks || []).length,
    links: (pageModel.links || []).length,
    media: (pageModel.media || []).length,
    lists: (pageModel.lists || []).length,
    tables: (pageModel.tables || []).length,
    forms: (pageModel.forms || []).length,
    controls: (pageModel.controls || []).length
  };
}

function buildStructureIndex(processed, options) {
  options = options || {};
  if (!processed || !processed.source || !processed.documentTree || !processed.pageModel) {
    throw new TypeError('processed source, document tree, and Page Model are required');
  }
  const maxItems = positiveInteger(options.maxLayoutItems, DEFAULT_MAX_ITEMS, 'maxLayoutItems');
  const maxTextChars = positiveInteger(options.maxLayoutTextChars, DEFAULT_MAX_TEXT_CHARS, 'maxLayoutTextChars');
  const entries = collectEntries(processed.pageModel);
  if (entries.length > maxItems) {
    throw new AxmStructureLimitError('AXM_STRUCTURE_ITEM_LIMIT', 'semantic entries exceed the configured structure-index item limit', {
      itemCount: entries.length,
      maxItems
    });
  }

  const locator = cleanText(processed.source.finalUrl || processed.source.requestedUrl || 'stdin:');
  const title = cleanText(processed.pageModel.title) || 'Untitled local document';
  const textCharacters = entries.reduce(function (sum, entry) {
    return sum + entry.label.length + entry.text.length + entry.meta.length;
  }, locator.length + title.length);
  if (textCharacters > maxTextChars) {
    throw new AxmStructureLimitError('AXM_STRUCTURE_TEXT_LIMIT', 'structure-index text exceeds the configured character limit', {
      textCharacters,
      maxTextChars
    });
  }

  const material = {
    schema: STRUCTURE_INDEX_SCHEMA,
    version: 1,
    sourceDigest: processed.source.sha256,
    documentDigest: processed.documentTree.documentDigest,
    pageModelDigest: processed.pageModel.pageModelDigest,
    plainTextDigest: processed.pageModel.plainTextDigest,
    title,
    language: processed.pageModel.language,
    locator,
    summary: summaryFor(processed.pageModel),
    limits: { maxItems, maxTextChars, observedTextCharacters: textCharacters },
    entryCount: entries.length,
    entries,
    held: [
      { feature: 'page-link-activation', state: 'HELD' },
      { feature: 'form-submission', state: 'HELD' },
      { feature: 'page-script-execution', state: 'HELD' },
      { feature: 'network-resource-loading', state: 'HELD' }
    ]
  };
  return Object.assign({}, material, { structureIndexDigest: Digest.canonicalDigest(material) });
}

function assertLineage(index, processed) {
  if (!index || index.schema !== STRUCTURE_INDEX_SCHEMA) throw new TypeError('structure index schema mismatch');
  if (index.sourceDigest !== processed.source.sha256 ||
      index.documentDigest !== processed.documentTree.documentDigest ||
      index.pageModelDigest !== processed.pageModel.pageModelDigest) {
    throw new TypeError('structure index lineage mismatch');
  }
}

module.exports = {
  STRUCTURE_INDEX_SCHEMA,
  DEFAULT_MAX_ITEMS,
  DEFAULT_MAX_TEXT_CHARS,
  AxmStructureLimitError,
  cleanText,
  positiveInteger,
  nodeOrder,
  collectEntries,
  summaryFor,
  buildStructureIndex,
  assertLineage
};
