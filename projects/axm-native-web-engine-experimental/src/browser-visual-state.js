'use strict';

const Digest = require('./digest');

const VISUAL_STATE_SCHEMA = 'axm.web.browser-visual-state/v1';
const MAX_VISIBLE_ENTRIES = 128;
const THEMES = new Set(['midnight', 'paper', 'contrast']);
const DENSITIES = new Set(['comfortable', 'compact']);
const TEXT_SCALES = new Set(['small', 'normal', 'large']);
const FOCUS_MODES = new Set(['full', 'reading']);

class AxmBrowserVisualStateError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmBrowserVisualStateError';
    this.code = code;
    this.details = details || {};
  }
}

function finiteNumber(value, fallback, min, max, name) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_INVALID', name + ' is outside its numeric bound', { name, value });
  }
  return number;
}

function boundedText(value, fallback, maxLength, name) {
  const text = value == null ? fallback : String(value);
  if (text.length > maxLength) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_LIMIT', name + ' exceeds its character bound', { name, maxLength, length: text.length });
  }
  return text;
}

function currentPage(snapshot) {
  if (!snapshot || !snapshot.bundle || !snapshot.state || !snapshot.state.current || !Array.isArray(snapshot.bundle.pages)) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_SESSION_REQUIRED', 'a complete local browser session snapshot is required');
  }
  const page = snapshot.bundle.pages.find(function (candidate) {
    return candidate.pageId === snapshot.state.current.pageId;
  });
  if (!page) throw new AxmBrowserVisualStateError('VISUAL_STATE_PAGE_MISSING', 'current session page is not present in the bundle');
  return page;
}

function entryByRef(page, entryRef) {
  return page.entries.find(function (entry) { return entry.entryId === entryRef; }) || null;
}

function normalizeRect(rect) {
  if (rect == null) return null;
  if (!rect || typeof rect !== 'object' || Array.isArray(rect)) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_INVALID', 'visible entry rect must be an object or null');
  }
  return {
    x: finiteNumber(rect.x, 0, -1000000, 1000000, 'rect.x'),
    y: finiteNumber(rect.y, 0, -1000000, 1000000, 'rect.y'),
    width: finiteNumber(rect.width, 0, 0, 1000000, 'rect.width'),
    height: finiteNumber(rect.height, 0, 0, 1000000, 'rect.height')
  };
}

function normalizeVisibleEntries(page, report) {
  if (report.visibleEntries == null) {
    return page.entries.slice(0, MAX_VISIBLE_ENTRIES).map(function (entry, index) {
      return {
        screenOrder: index + 1,
        entryRef: entry.entryId,
        kind: entry.kind,
        label: entry.label,
        text: entry.text,
        meta: entry.meta,
        rect: null,
        visibilityRatio: null
      };
    });
  }
  if (!Array.isArray(report.visibleEntries)) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_INVALID', 'visibleEntries must be an array');
  }
  if (report.visibleEntries.length > MAX_VISIBLE_ENTRIES) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_LIMIT', 'visibleEntries exceeds the configured bound', {
      maxVisibleEntries: MAX_VISIBLE_ENTRIES,
      count: report.visibleEntries.length
    });
  }
  const seen = new Set();
  return report.visibleEntries.map(function (item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AxmBrowserVisualStateError('VISUAL_STATE_INVALID', 'visible entry must be an object', { index });
    }
    const entryRef = boundedText(item.entryRef, '', 128, 'entryRef');
    if (!entryRef || seen.has(entryRef)) {
      throw new AxmBrowserVisualStateError('VISUAL_STATE_INVALID', 'visible entry references must be non-empty and unique', { entryRef });
    }
    seen.add(entryRef);
    const entry = entryByRef(page, entryRef);
    if (!entry) throw new AxmBrowserVisualStateError('VISUAL_STATE_ENTRY_UNKNOWN', 'visible entry is not present on the current page', { entryRef });
    const ratio = item.visibilityRatio == null ? null : finiteNumber(item.visibilityRatio, null, 0, 1, 'visibilityRatio');
    return {
      screenOrder: index + 1,
      entryRef,
      kind: entry.kind,
      label: entry.label,
      text: entry.text,
      meta: entry.meta,
      rect: normalizeRect(item.rect),
      visibilityRatio: ratio
    };
  });
}

function normalizeVisualReport(snapshot, report) {
  report = report || {};
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_INVALID', 'visual report must be an object');
  }
  const page = currentPage(snapshot);
  const theme = boundedText(report.theme, 'midnight', 24, 'theme').toLowerCase();
  const density = boundedText(report.density, 'comfortable', 24, 'density').toLowerCase();
  const textScale = boundedText(report.textScale, 'normal', 24, 'textScale').toLowerCase();
  const focusMode = boundedText(report.focusMode, 'full', 24, 'focusMode').toLowerCase();
  if (!THEMES.has(theme) || !DENSITIES.has(density) || !TEXT_SCALES.has(textScale) || !FOCUS_MODES.has(focusMode)) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_INVALID', 'visual report contains an unsupported shell option', {
      theme, density, textScale, focusMode
    });
  }
  const focusedEntryRef = report.focusedEntryRef == null ? snapshot.state.current.focusEntryRef : boundedText(report.focusedEntryRef, '', 128, 'focusedEntryRef');
  if (focusedEntryRef && !entryByRef(page, focusedEntryRef)) {
    throw new AxmBrowserVisualStateError('VISUAL_STATE_ENTRY_UNKNOWN', 'focused entry is not present on the current page', { focusedEntryRef });
  }
  return {
    page,
    report: {
      viewport: {
        width: finiteNumber(report.viewport && report.viewport.width, 1280, 1, 16384, 'viewport.width'),
        height: finiteNumber(report.viewport && report.viewport.height, 720, 1, 16384, 'viewport.height'),
        scrollX: finiteNumber(report.viewport && report.viewport.scrollX, 0, -10000000, 10000000, 'viewport.scrollX'),
        scrollY: finiteNumber(report.viewport && report.viewport.scrollY, 0, -10000000, 10000000, 'viewport.scrollY'),
        devicePixelRatio: finiteNumber(report.viewport && report.viewport.devicePixelRatio, 1, 0.25, 8, 'viewport.devicePixelRatio')
      },
      shell: {
        theme,
        density,
        textScale,
        focusMode,
        metadataVisible: report.metadataVisible !== false,
        filter: boundedText(report.filter, '', 200, 'filter')
      },
      activeElementId: boundedText(report.activeElementId, '', 128, 'activeElementId') || null,
      focusedEntryRef: focusedEntryRef || null,
      visibleEntries: normalizeVisibleEntries(page, report)
    }
  };
}

function buildVisualState(snapshot, report, options) {
  const normalized = normalizeVisualReport(snapshot, report);
  const page = normalized.page;
  const view = normalized.report;
  const material = {
    schema: VISUAL_STATE_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    sessionId: snapshot.sessionId,
    bundleDigest: snapshot.bundle.bundleDigest,
    page: {
      pageId: page.pageId,
      address: snapshot.state.current.address,
      locator: page.locator,
      title: page.title,
      sourceDigest: page.sourceDigest,
      structureIndexDigest: page.structureIndexDigest
    },
    viewport: view.viewport,
    shell: view.shell,
    focus: {
      activeElementId: view.activeElementId,
      focusedEntryRef: view.focusedEntryRef,
      sessionScrollEntryRef: snapshot.state.current.scrollEntryRef
    },
    visualFidelity: report && Array.isArray(report.visibleEntries) ? 'DOM_GEOMETRY' : 'STRUCTURED_SCREEN_MODEL',
    visibleEntryCount: view.visibleEntries.length,
    visibleEntries: view.visibleEntries,
    authority: {
      observationOnly: true,
      browserMutationAllowed: false,
      networkAuthorityGranted: false,
      pageCodeExecuted: false
    }
  };
  if (options && Number.isInteger(options.sequence) && options.sequence >= 0) material.sequence = options.sequence;
  return Object.assign({}, material, { visualDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  VISUAL_STATE_SCHEMA,
  MAX_VISIBLE_ENTRIES,
  AxmBrowserVisualStateError,
  buildVisualState,
  normalizeVisualReport
};
