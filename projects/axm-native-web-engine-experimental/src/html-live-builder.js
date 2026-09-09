'use strict';

const Digest = require('./digest');
const Engine = require('./engine');
const BrowserSnapshot = require('./browser-snapshot');

const HTML_BUILDER_PREVIEW_SCHEMA = 'axm.web.html-builder-preview/v1';
const DEFAULT_MAX_SOURCE_BYTES = 256 * 1024;
const DEFAULT_VIEWPORT = Object.freeze({ width: 1120, height: 760 });

class AxmHtmlBuilderError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmHtmlBuilderError';
    this.code = code;
    this.details = details || {};
  }
}

function cleanPositiveInteger(value, fallback, min, max, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AxmHtmlBuilderError('BUILDER_OPTIONS_INVALID', name + ' must be an integer from ' + min + ' to ' + max, { name, value });
  }
  return value;
}

function normalizeViewport(value) {
  value = value || {};
  return {
    width: cleanPositiveInteger(value.width, DEFAULT_VIEWPORT.width, 240, 3840, 'viewport.width'),
    height: cleanPositiveInteger(value.height, DEFAULT_VIEWPORT.height, 180, 2160, 'viewport.height')
  };
}

function normalizeSource(value, maxSourceBytes) {
  if (typeof value !== 'string') throw new AxmHtmlBuilderError('BUILDER_SOURCE_REQUIRED', 'builder source must be a UTF-8 string');
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > maxSourceBytes) {
    throw new AxmHtmlBuilderError('BUILDER_SOURCE_BYTES_LIMIT', 'builder draft exceeds the configured byte bound', {
      bytes: bytes.length,
      maxSourceBytes
    });
  }
  return { source: value, bytes };
}

function warningView(warning) {
  if (!warning || typeof warning !== 'object') return { code: 'UNKNOWN_WARNING', message: String(warning || '') };
  return {
    code: String(warning.code || warning.type || 'PARSER_WARNING'),
    message: String(warning.message || warning.detail || warning.reason || warning.code || 'Parser warning')
  };
}

function compileHtmlDraft(sourceInput, options) {
  options = options || {};
  const maxSourceBytes = cleanPositiveInteger(options.maxSourceBytes, DEFAULT_MAX_SOURCE_BYTES, 1024, 1024 * 1024, 'maxSourceBytes');
  const normalized = normalizeSource(sourceInput, maxSourceBytes);
  const viewport = normalizeViewport(options.viewport);
  const requestedUrl = String(options.requestedUrl || 'builder-draft.html');
  const engineOptions = {
    requestedUrl,
    viewport,
    maxBytes: maxSourceBytes,
    maxTokens: options.maxTokens,
    maxAttributes: options.maxAttributes,
    maxNesting: options.maxNesting,
    maxLayoutItems: options.maxLayoutItems,
    maxLayoutTextChars: options.maxLayoutTextChars,
    maxCanvasHeight: options.maxCanvasHeight,
    requestedBy: 'html-live-builder'
  };
  let processed;
  let bundle;
  try {
    processed = Engine.processBytes(normalized.bytes, engineOptions);
    bundle = Engine.deriveStructure(processed, engineOptions);
  } catch (error) {
    throw new AxmHtmlBuilderError(String(error && error.code || 'BUILDER_COMPILE_FAILED'), String(error && error.message || error), {
      sourceSha256: Digest.sha256Hex(normalized.bytes),
      sourceBytes: normalized.bytes.length
    });
  }
  const previewHtml = BrowserSnapshot.renderBrowserSnapshot(bundle);
  const warnings = processed.documentTree.warnings.map(warningView);
  const material = {
    schema: HTML_BUILDER_PREVIEW_SCHEMA,
    version: 1,
    status: warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS',
    source: {
      requestedUrl,
      bytes: normalized.bytes.length,
      sha256: processed.source.sha256
    },
    viewport,
    page: {
      title: bundle.structureIndex.title,
      language: bundle.structureIndex.language,
      entryCount: bundle.structureIndex.entryCount,
      summary: bundle.structureIndex.summary
    },
    warnings,
    warningCount: warnings.length,
    unsupportedCount: Array.isArray(processed.documentTree.unsupported) ? processed.documentTree.unsupported.length : 0,
    digests: {
      document: processed.documentTree.documentDigest,
      pageModel: processed.pageModel.pageModelDigest,
      structureIndex: bundle.structureIndex.structureIndexDigest,
      layout: bundle.layout.layoutDigest,
      displayList: bundle.displayList.displayListDigest,
      modificationLedger: bundle.modificationLedger.ledgerDigest
    },
    preview: {
      kind: 'INERT_AXM_STRUCTURE_BROWSER_HTML',
      html: previewHtml,
      activePageCodeExecuted: false,
      externalResourcesLoaded: false
    },
    authority: {
      sourceFileMutationAllowed: false,
      browserSessionMutationAllowed: false,
      pageCodeExecutionAllowed: false,
      externalNetworkAllowed: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { previewDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  HTML_BUILDER_PREVIEW_SCHEMA,
  DEFAULT_MAX_SOURCE_BYTES,
  DEFAULT_VIEWPORT,
  AxmHtmlBuilderError,
  normalizeViewport,
  compileHtmlDraft
};
