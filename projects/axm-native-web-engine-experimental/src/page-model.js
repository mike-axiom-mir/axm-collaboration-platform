'use strict';

const Digest = require('./digest');

const PAGE_SCHEMA = 'axm.web.page-model/v1';
const HIDDEN_TEXT_ELEMENTS = new Set(['script', 'style', 'template', 'noscript']);
const TEXT_SEPARATOR_ELEMENTS = new Set([
  'html', 'head', 'body', 'main', 'nav', 'aside', 'header', 'footer', 'section',
  'article', 'div', 'ul', 'ol', 'dl', 'table', 'thead', 'tbody', 'tfoot', 'tr',
  'form', 'figure'
]);

function isElement(node, tagName) {
  return Boolean(node && node.type === 'element' && (!tagName || node.tagName === tagName));
}

function attr(node, name) {
  if (!isElement(node)) return null;
  return Object.prototype.hasOwnProperty.call(node.attributeMap || {}, name) ? node.attributeMap[name] : null;
}

function normalizeText(value) {
  return String(value || '').replace(/[\t\r\n\f ]+/g, ' ').trim();
}

function textContent(node, options) {
  options = options || {};
  if (!node) return '';
  if (node.type === 'text') return node.data || '';
  if (node.type !== 'element' && node.type !== 'document') return '';
  if (node.type === 'element' && HIDDEN_TEXT_ELEMENTS.has(node.tagName) && options.includeHeld !== true) return '';
  const separator = node.type === 'document' || TEXT_SEPARATOR_ELEMENTS.has(node.tagName) ? ' ' : '';
  return (node.children || []).map(function (child) { return textContent(child, options); }).join(separator);
}

function walk(root, visitor, ancestors) {
  ancestors = ancestors || [];
  visitor(root, ancestors);
  if (!root || !Array.isArray(root.children)) return;
  const nextAncestors = root.type === 'element' ? ancestors.concat(root) : ancestors;
  root.children.forEach(function (child) { walk(child, visitor, nextAncestors); });
}

function descendants(node, predicate) {
  const found = [];
  (node.children || []).forEach(function (child) {
    walk(child, function (candidate) { if (predicate(candidate)) found.push(candidate); });
  });
  return found;
}

function directElementChildren(node, tagName) {
  return (node.children || []).filter(function (child) { return isElement(child, tagName); });
}

function inferredRole(node) {
  const explicit = attr(node, 'role');
  if (explicit) return explicit;
  return ({
    main: 'main', nav: 'navigation', aside: 'complementary', header: 'banner',
    footer: 'contentinfo', article: 'article', section: 'region', form: 'form'
  })[node.tagName] || null;
}

function buildPageModel(documentTree) {
  if (!documentTree || documentTree.schema !== 'axm.web.document-tree/v1') throw new TypeError('document tree schema mismatch');
  const headings = [];
  const paragraphs = [];
  const landmarks = [];
  const links = [];
  const media = [];
  const lists = [];
  const tables = [];
  const forms = [];
  const controls = [];
  const metadata = [];
  const idIndex = new Map();
  const labelsByFor = new Map();
  let title = '';
  let language = null;

  walk(documentTree.root, function (node) {
    if (!isElement(node)) return;
    const id = attr(node, 'id');
    if (id) idIndex.set(id, node.nodeId);
    if (node.tagName === 'label') {
      const target = attr(node, 'for');
      if (target) labelsByFor.set(target, normalizeText(textContent(node)));
    }
  });

  walk(documentTree.root, function (node, ancestors) {
    if (!isElement(node)) return;
    const text = normalizeText(textContent(node));
    if (!title && node.tagName === 'title') title = text;
    if (node.tagName === 'html') language = attr(node, 'lang') || language;

    if (/^h[1-6]$/.test(node.tagName)) {
      headings.push({ nodeRef: node.nodeId, level: Number(node.tagName.slice(1)), text });
    }
    if (node.tagName === 'p') paragraphs.push({ nodeRef: node.nodeId, text });

    const role = inferredRole(node);
    if (role && ['main', 'navigation', 'complementary', 'banner', 'contentinfo', 'article', 'region', 'form'].includes(role)) {
      landmarks.push({ nodeRef: node.nodeId, role, label: attr(node, 'aria-label') || null });
    }

    if (node.tagName === 'a') {
      links.push({
        nodeRef: node.nodeId,
        href: attr(node, 'href'),
        text,
        rel: attr(node, 'rel'),
        target: attr(node, 'target')
      });
    }

    if (node.tagName === 'img') {
      media.push({
        nodeRef: node.nodeId,
        kind: 'image',
        src: attr(node, 'src'),
        alt: attr(node, 'alt'),
        title: attr(node, 'title'),
        loading: attr(node, 'loading')
      });
    }

    if (node.tagName === 'ol' || node.tagName === 'ul') {
      lists.push({
        nodeRef: node.nodeId,
        ordered: node.tagName === 'ol',
        items: directElementChildren(node, 'li').map(function (item) {
          return { nodeRef: item.nodeId, text: normalizeText(textContent(item)) };
        })
      });
    }

    if (node.tagName === 'table') {
      const rows = descendants(node, function (candidate) { return isElement(candidate, 'tr'); });
      const headerNodes = descendants(node, function (candidate) { return isElement(candidate, 'th'); });
      let columnEstimate = 0;
      rows.forEach(function (row) {
        const cells = (row.children || []).filter(function (child) { return isElement(child, 'td') || isElement(child, 'th'); });
        columnEstimate = Math.max(columnEstimate, cells.length);
      });
      const caption = descendants(node, function (candidate) { return isElement(candidate, 'caption'); })[0];
      tables.push({
        nodeRef: node.nodeId,
        caption: caption ? normalizeText(textContent(caption)) : null,
        rowCount: rows.length,
        columnEstimate,
        headers: headerNodes.map(function (header) { return normalizeText(textContent(header)); })
      });
    }

    if (node.tagName === 'form') {
      const formControls = descendants(node, function (candidate) {
        return isElement(candidate) && ['input', 'button', 'textarea', 'select'].includes(candidate.tagName);
      });
      forms.push({
        nodeRef: node.nodeId,
        action: attr(node, 'action'),
        method: (attr(node, 'method') || 'get').toLowerCase(),
        controlRefs: formControls.map(function (control) { return control.nodeId; })
      });
    }

    if (['input', 'button', 'textarea', 'select'].includes(node.tagName)) {
      const parentLabel = ancestors.slice().reverse().find(function (ancestor) { return ancestor.tagName === 'label'; });
      const controlId = attr(node, 'id');
      controls.push({
        nodeRef: node.nodeId,
        kind: node.tagName,
        type: node.tagName === 'input'
          ? (attr(node, 'type') || 'text').toLowerCase()
          : (node.tagName === 'button' ? (attr(node, 'type') || 'submit').toLowerCase() : node.tagName),
        name: attr(node, 'name'),
        value: attr(node, 'value'),
        label: (controlId && labelsByFor.get(controlId)) || (parentLabel ? normalizeText(textContent(parentLabel)) : null),
        required: attr(node, 'required') !== null,
        disabled: attr(node, 'disabled') !== null
      });
    }

    if (node.tagName === 'meta') {
      metadata.push({
        nodeRef: node.nodeId,
        name: attr(node, 'name'),
        property: attr(node, 'property'),
        httpEquiv: attr(node, 'http-equiv'),
        content: attr(node, 'content'),
        charset: attr(node, 'charset')
      });
    }
  });

  const plainText = normalizeText(textContent(documentTree.root));
  const material = {
    schema: PAGE_SCHEMA,
    sourceDigest: documentTree.sourceDigest,
    documentDigest: documentTree.documentDigest,
    title,
    language,
    plainText,
    plainTextDigest: Digest.sha256Hex(plainText),
    headings,
    paragraphs,
    landmarks,
    lists,
    links,
    media,
    tables,
    forms,
    controls,
    metadata,
    relationships: {
      idTargets: Array.from(idIndex.entries()).sort(function (a, b) { return a[0].localeCompare(b[0]); }).map(function (pair) {
        return { id: pair[0], nodeRef: pair[1] };
      })
    }
  };
  return Object.assign({}, material, { pageModelDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  PAGE_SCHEMA,
  HIDDEN_TEXT_ELEMENTS,
  TEXT_SEPARATOR_ELEMENTS,
  isElement,
  attr,
  normalizeText,
  textContent,
  walk,
  descendants,
  inferredRole,
  buildPageModel
};
