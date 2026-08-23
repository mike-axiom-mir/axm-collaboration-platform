'use strict';

const Digest = require('./digest');
const Source = require('./source-record');

const TOKEN_SCHEMA = 'axm.web.token-stream/v1';
const DEFAULT_MAX_TOKENS = 100000;
const DEFAULT_MAX_ATTRIBUTES = 128;
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);

const NAMED_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0'
});

function makeLocator(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) if (source.charCodeAt(i) === 10) starts.push(i + 1);
  function point(offset) {
    let low = 0, high = starts.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (starts[mid] <= offset) low = mid + 1;
      else high = mid - 1;
    }
    const lineIndex = Math.max(0, high);
    return { line: lineIndex + 1, column: offset - starts[lineIndex] + 1 };
  }
  return function span(start, end) {
    const a = point(start), b = point(end);
    return {
      start,
      end,
      startLine: a.line,
      startColumn: a.column,
      endLine: b.line,
      endColumn: b.column,
      offsetUnit: 'utf16-code-unit'
    };
  };
}

function decodeEntities(text, warnings, offset) {
  return String(text).replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/g, function (full, body, relative) {
    if (body[0] === '#') {
      const hex = body[1] && body[1].toLowerCase() === 'x';
      const raw = body.slice(hex ? 2 : 1);
      const value = Number.parseInt(raw, hex ? 16 : 10);
      if (!Number.isInteger(value) || value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
        warnings.push({ code: 'INVALID_NUMERIC_ENTITY', severity: 'warning', offset: offset + relative, detail: full });
        return '\ufffd';
      }
      return String.fromCodePoint(value);
    }
    if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)) return NAMED_ENTITIES[body];
    warnings.push({ code: 'UNKNOWN_NAMED_ENTITY', severity: 'warning', offset: offset + relative, detail: full });
    return full;
  });
}

function tokenize(input, options) {
  options = options || {};
  const source = String(input);
  const span = makeLocator(source);
  const tokens = [];
  const warnings = [];
  const maxTokens = Number.isInteger(options.maxTokens) ? options.maxTokens : DEFAULT_MAX_TOKENS;
  const maxAttributes = Number.isInteger(options.maxAttributes) ? options.maxAttributes : DEFAULT_MAX_ATTRIBUTES;
  if (maxTokens < 1 || maxAttributes < 1) throw new TypeError('token and attribute limits must be positive integers');

  function push(token) {
    if (tokens.length >= maxTokens) {
      throw new Source.AxmLimitError('TOKEN_COUNT_LIMIT', 'token stream exceeds configured token limit', {
        maxTokens,
        offset: token && token.sourceSpan && token.sourceSpan.start
      });
    }
    tokens.push(token);
  }

  function warning(code, offset, detail) {
    warnings.push({ code, severity: 'warning', offset, detail: detail == null ? null : String(detail) });
  }

  let i = 0;
  let rawTextTag = null;
  while (i < source.length) {
    if (rawTextTag) {
      const lower = source.toLowerCase();
      const closeStart = lower.indexOf('</' + rawTextTag, i);
      const end = closeStart < 0 ? source.length : closeStart;
      if (end > i) {
        const raw = source.slice(i, end);
        push({ type: 'text', raw, data: rawTextTag === 'script' || rawTextTag === 'style' ? raw : decodeEntities(raw, warnings, i), rawTextContext: rawTextTag, sourceSpan: span(i, end) });
      }
      if (closeStart < 0) {
        warning('UNCLOSED_RAW_TEXT_ELEMENT', i, rawTextTag);
        i = source.length;
        rawTextTag = null;
        break;
      }
      i = closeStart;
      rawTextTag = null;
      continue;
    }

    if (source.startsWith('<!--', i)) {
      const start = i;
      const close = source.indexOf('-->', i + 4);
      const end = close < 0 ? source.length : close + 3;
      const raw = source.slice(start, end);
      push({ type: 'comment', raw, data: source.slice(i + 4, close < 0 ? source.length : close), sourceSpan: span(start, end) });
      if (close < 0) warning('UNCLOSED_COMMENT', start, null);
      i = end;
      continue;
    }

    if (/^<!doctype\b/i.test(source.slice(i, i + 16))) {
      const start = i;
      const close = source.indexOf('>', i + 2);
      const end = close < 0 ? source.length : close + 1;
      const raw = source.slice(start, end);
      const nameMatch = raw.match(/^<!doctype\s+([^\s>]+)/i);
      push({ type: 'doctype', raw, name: nameMatch ? nameMatch[1].toLowerCase() : '', sourceSpan: span(start, end) });
      if (close < 0) warning('UNCLOSED_DOCTYPE', start, null);
      i = end;
      continue;
    }

    if (source.startsWith('</', i)) {
      const start = i;
      let cursor = i + 2;
      while (/\s/.test(source[cursor] || '')) cursor += 1;
      const nameStart = cursor;
      while (/[A-Za-z0-9:_-]/.test(source[cursor] || '')) cursor += 1;
      const name = source.slice(nameStart, cursor).toLowerCase();
      const close = source.indexOf('>', cursor);
      if (!name || close < 0) {
        const end = close < 0 ? source.length : close + 1;
        warning('MALFORMED_END_TAG', start, source.slice(start, Math.min(end, start + 80)));
        push({ type: 'text', raw: source.slice(start, end), data: source.slice(start, end), sourceSpan: span(start, end) });
        i = end;
        continue;
      }
      const trailing = source.slice(cursor, close).trim();
      if (trailing) warning('END_TAG_TRAILING_DATA', cursor, trailing);
      const end = close + 1;
      push({ type: 'endTag', raw: source.slice(start, end), name, sourceSpan: span(start, end) });
      i = end;
      continue;
    }

    if (source[i] === '<' && /[A-Za-z]/.test(source[i + 1] || '')) {
      const start = i;
      let cursor = i + 1;
      const nameStart = cursor;
      while (/[A-Za-z0-9:_-]/.test(source[cursor] || '')) cursor += 1;
      const name = source.slice(nameStart, cursor).toLowerCase();
      const attributes = [];
      const seen = new Set();
      let selfClosing = false;
      let closed = false;

      while (cursor < source.length) {
        while (/\s/.test(source[cursor] || '')) cursor += 1;
        if (source.startsWith('/>', cursor)) {
          selfClosing = true;
          cursor += 2;
          closed = true;
          break;
        }
        if (source[cursor] === '>') {
          cursor += 1;
          closed = true;
          break;
        }
        if (cursor >= source.length) break;
        if (attributes.length >= maxAttributes) {
          throw new Source.AxmLimitError('ATTRIBUTE_COUNT_LIMIT', 'tag exceeds configured attribute limit', {
            maxAttributes,
            tagName: name,
            offset: cursor
          });
        }
        const attrStart = cursor;
        while (cursor < source.length && !/[\s=/>]/.test(source[cursor])) cursor += 1;
        const rawName = source.slice(attrStart, cursor);
        if (!rawName) {
          warning('INVALID_ATTRIBUTE_START', cursor, source[cursor]);
          cursor += 1;
          continue;
        }
        const attrName = rawName.toLowerCase();
        while (/\s/.test(source[cursor] || '')) cursor += 1;
        let rawValue = null;
        let value = '';
        let quote = null;
        if (source[cursor] === '=') {
          cursor += 1;
          while (/\s/.test(source[cursor] || '')) cursor += 1;
          if (source[cursor] === '"' || source[cursor] === "'") {
            quote = source[cursor];
            cursor += 1;
            const valueStart = cursor;
            const closeQuote = source.indexOf(quote, cursor);
            if (closeQuote < 0) {
              rawValue = source.slice(valueStart);
              value = decodeEntities(rawValue, warnings, valueStart);
              cursor = source.length;
              warning('UNCLOSED_ATTRIBUTE_VALUE', valueStart, attrName);
            } else {
              rawValue = source.slice(valueStart, closeQuote);
              value = decodeEntities(rawValue, warnings, valueStart);
              cursor = closeQuote + 1;
            }
          } else {
            const valueStart = cursor;
            while (cursor < source.length && !/[\s>]/.test(source[cursor])) {
              if (source.startsWith('/>', cursor)) break;
              cursor += 1;
            }
            rawValue = source.slice(valueStart, cursor);
            value = decodeEntities(rawValue, warnings, valueStart);
          }
        }
        const attribute = {
          name: attrName,
          rawName,
          value,
          rawValue,
          quote,
          boolean: rawValue === null,
          sourceSpan: span(attrStart, cursor)
        };
        if (seen.has(attrName)) warning('DUPLICATE_ATTRIBUTE_IGNORED', attrStart, attrName);
        else {
          seen.add(attrName);
          attributes.push(attribute);
        }
      }

      if (!closed) warning('UNCLOSED_START_TAG', start, name);
      const end = cursor;
      push({ type: 'startTag', raw: source.slice(start, end), name, attributes, selfClosing, sourceSpan: span(start, end) });
      i = end;
      if (closed && !selfClosing && RAW_TEXT_ELEMENTS.has(name)) rawTextTag = name;
      continue;
    }

    if (source.startsWith('<!', i) || source.startsWith('<?', i)) {
      const start = i;
      const close = source.indexOf('>', i + 2);
      const end = close < 0 ? source.length : close + 1;
      warning('UNSUPPORTED_MARKUP_DECLARATION', start, source.slice(start, Math.min(end, start + 80)));
      push({ type: 'declaration', raw: source.slice(start, end), data: source.slice(i + 2, close < 0 ? source.length : close), sourceSpan: span(start, end) });
      i = end;
      continue;
    }

    const start = i;
    let next = source.indexOf('<', i);
    if (next === i) next = i + 1;
    if (next < 0) next = source.length;
    const raw = source.slice(start, next);
    push({ type: 'text', raw, data: decodeEntities(raw, warnings, start), sourceSpan: span(start, next) });
    i = next;
  }

  const material = { schema: TOKEN_SCHEMA, sourceDigest: options.sourceDigest || null, tokens, warnings };
  return Object.assign({}, material, { tokenDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  TOKEN_SCHEMA,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MAX_ATTRIBUTES,
  RAW_TEXT_ELEMENTS,
  NAMED_ENTITIES,
  decodeEntities,
  tokenize
};
