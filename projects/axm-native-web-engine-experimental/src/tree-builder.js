'use strict';

const Digest = require('./digest');
const Source = require('./source-record');

const DOCUMENT_SCHEMA = 'axm.web.document-tree/v1';
const DEFAULT_MAX_NESTING = 256;

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
]);

const PROFILE_ELEMENTS = new Set([
  'html', 'head', 'title', 'meta', 'body', 'main', 'nav', 'aside', 'header',
  'footer', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
  'div', 'span', 'a', 'img', 'ol', 'ul', 'li', 'dl', 'dt', 'dd', 'table',
  'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'form', 'label',
  'input', 'button', 'textarea', 'select', 'option', 'figure', 'figcaption',
  'strong', 'em', 'b', 'i', 'small', 'blockquote', 'pre', 'code', 'br', 'hr'
]);

const HELD_ELEMENTS = new Set([
  'script', 'style', 'link', 'template', 'noscript', 'canvas', 'iframe', 'object',
  'embed', 'video', 'audio', 'source', 'track', 'svg', 'math'
]);

const P_CLOSE_STARTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'footer',
  'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav',
  'ol', 'p', 'pre', 'section', 'table', 'ul'
]);

function supportFor(tagName) {
  if (HELD_ELEMENTS.has(tagName)) return { state: 'HELD', reason: 'FEATURE_OUTSIDE_PHASE1_EXECUTION_PROFILE' };
  if (PROFILE_ELEMENTS.has(tagName)) return { state: 'SUPPORTED', reason: 'PHASE1_TREE_AND_SEMANTIC_SUBSET_ONLY' };
  return { state: 'UNSUPPORTED', reason: 'ELEMENT_NOT_IN_PHASE1_PROFILE' };
}

function attrsToMap(attributes) {
  const out = {};
  (attributes || []).forEach(function (attr) {
    if (!Object.prototype.hasOwnProperty.call(out, attr.name)) out[attr.name] = attr.value;
  });
  return out;
}

function buildDocument(tokenStream, options) {
  options = options || {};
  if (!tokenStream || tokenStream.schema !== 'axm.web.token-stream/v1') throw new TypeError('token stream schema mismatch');
  const maxNesting = Number.isInteger(options.maxNesting) ? options.maxNesting : DEFAULT_MAX_NESTING;
  if (maxNesting < 1) throw new TypeError('maxNesting must be a positive integer');

  let nodeCounter = 0;
  function nextId() { nodeCounter += 1; return 'n' + nodeCounter; }
  const root = {
    nodeId: 'n0',
    type: 'document',
    children: [],
    sourceSpan: null
  };
  const stack = [root];
  const warnings = (tokenStream.warnings || []).map(function (item) { return Object.assign({}, item); });
  const unsupported = [];

  function warn(code, token, detail) {
    warnings.push({
      code,
      severity: 'warning',
      offset: token && token.sourceSpan ? token.sourceSpan.start : null,
      detail: detail == null ? null : String(detail)
    });
  }

  function current() { return stack[stack.length - 1]; }
  function append(node) { current().children.push(node); }

  function closeAt(index, closingSpan, code) {
    for (let j = stack.length - 1; j >= index; j -= 1) {
      const node = stack[j];
      node.closeTagSpan = j === index ? closingSpan : null;
      node.syntheticClose = j !== index || code === 'IMPLICIT_CLOSE_ON_START';
      node.sourceSpan = Object.assign({}, node.sourceSpan, {
        end: closingSpan ? closingSpan.end : node.sourceSpan.end,
        endLine: closingSpan ? closingSpan.endLine : node.sourceSpan.endLine,
        endColumn: closingSpan ? closingSpan.endColumn : node.sourceSpan.endColumn
      });
      if (j !== index && code) warnings.push({
        code,
        severity: 'warning',
        offset: closingSpan ? closingSpan.start : null,
        detail: node.tagName
      });
      stack.pop();
    }
  }

  function autoCloseForStart(tagName, token) {
    const top = current();
    if (!top || top.type !== 'element') return;
    let close = false;
    if (tagName === 'li' && top.tagName === 'li') close = true;
    else if (tagName === 'tr' && top.tagName === 'tr') close = true;
    else if ((tagName === 'td' || tagName === 'th') && (top.tagName === 'td' || top.tagName === 'th')) close = true;
    else if (tagName === 'option' && top.tagName === 'option') close = true;
    else if (top.tagName === 'p' && P_CLOSE_STARTS.has(tagName)) close = true;
    if (close) {
      warn('IMPLICIT_CLOSE_ON_START', token, top.tagName + ' before ' + tagName);
      closeAt(stack.length - 1, token.sourceSpan, 'IMPLICIT_CLOSE_ON_START');
    }
  }

  (tokenStream.tokens || []).forEach(function (token) {
    if (token.type === 'startTag') {
      autoCloseForStart(token.name, token);
      const support = supportFor(token.name);
      const node = {
        nodeId: nextId(),
        type: 'element',
        tagName: token.name,
        attributes: (token.attributes || []).map(function (attr) { return Object.assign({}, attr); }),
        attributeMap: attrsToMap(token.attributes),
        children: [],
        support,
        openTagSpan: token.sourceSpan,
        closeTagSpan: null,
        sourceSpan: Object.assign({}, token.sourceSpan),
        syntheticClose: false,
        selfClosing: token.selfClosing === true || VOID_ELEMENTS.has(token.name)
      };
      append(node);
      if (support.state === 'HELD' || support.state === 'UNSUPPORTED') unsupported.push({
        feature: 'element:' + token.name,
        state: support.state,
        nodeRef: node.nodeId,
        reason: support.reason
      });
      if (!node.selfClosing) {
        if (stack.length > maxNesting) {
          throw new Source.AxmLimitError('TREE_NESTING_LIMIT', 'document exceeds configured nesting limit', {
            maxNesting,
            tagName: token.name,
            offset: token.sourceSpan.start
          });
        }
        stack.push(node);
      } else if (token.selfClosing === true && !VOID_ELEMENTS.has(token.name)) {
        warn('NON_VOID_SELF_CLOSE_ACCEPTED_BY_SUBSET', token, token.name);
      }
      return;
    }

    if (token.type === 'endTag') {
      if (VOID_ELEMENTS.has(token.name)) {
        warn('VOID_ELEMENT_END_TAG_IGNORED', token, token.name);
        return;
      }
      let match = -1;
      for (let j = stack.length - 1; j >= 1; j -= 1) {
        if (stack[j].tagName === token.name) { match = j; break; }
      }
      if (match < 0) {
        warn('UNMATCHED_END_TAG', token, token.name);
        return;
      }
      closeAt(match, token.sourceSpan, match === stack.length - 1 ? null : 'IMPLICIT_CLOSE_FOR_MISMATCH');
      return;
    }

    if (token.type === 'text') {
      append({
        nodeId: nextId(),
        type: 'text',
        data: token.data,
        raw: token.raw,
        rawTextContext: token.rawTextContext || null,
        sourceSpan: token.sourceSpan
      });
      return;
    }

    if (token.type === 'comment') {
      append({ nodeId: nextId(), type: 'comment', data: token.data, sourceSpan: token.sourceSpan });
      return;
    }

    if (token.type === 'doctype') {
      append({ nodeId: nextId(), type: 'doctype', name: token.name, sourceSpan: token.sourceSpan });
      return;
    }

    append({
      nodeId: nextId(),
      type: 'unsupported-markup',
      data: token.data || token.raw || '',
      sourceSpan: token.sourceSpan
    });
    unsupported.push({
      feature: 'markup:' + token.type,
      state: 'UNSUPPORTED',
      nodeRef: 'n' + nodeCounter,
      reason: 'TOKEN_TYPE_NOT_IN_PHASE1_TREE_PROFILE'
    });
  });

  const endSpan = tokenStream.tokens && tokenStream.tokens.length
    ? tokenStream.tokens[tokenStream.tokens.length - 1].sourceSpan
    : { end: 0, endLine: 1, endColumn: 1 };
  while (stack.length > 1) {
    const node = stack.pop();
    node.syntheticClose = true;
    node.sourceSpan = Object.assign({}, node.sourceSpan, {
      end: endSpan.end,
      endLine: endSpan.endLine,
      endColumn: endSpan.endColumn
    });
    warnings.push({ code: 'UNCLOSED_ELEMENT_AT_EOF', severity: 'warning', offset: node.openTagSpan.start, detail: node.tagName });
  }
  root.sourceSpan = {
    start: 0,
    end: endSpan.end,
    startLine: 1,
    startColumn: 1,
    endLine: endSpan.endLine,
    endColumn: endSpan.endColumn,
    offsetUnit: 'utf16-code-unit'
  };

  const material = {
    schema: DOCUMENT_SCHEMA,
    sourceDigest: tokenStream.sourceDigest,
    tokenDigest: tokenStream.tokenDigest,
    root,
    nodeCount: nodeCounter + 1,
    warnings,
    unsupported
  };
  return Object.assign({}, material, { documentDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  DOCUMENT_SCHEMA,
  DEFAULT_MAX_NESTING,
  VOID_ELEMENTS,
  PROFILE_ELEMENTS,
  HELD_ELEMENTS,
  supportFor,
  attrsToMap,
  buildDocument
};
