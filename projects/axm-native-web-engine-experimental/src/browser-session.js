'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Digest = require('./digest');
const Engine = require('./engine');

const BUNDLE_SCHEMA = 'axm.web.local-browser-bundle/v1';
const SESSION_SCHEMA = 'axm.web.local-browser-session/v1';
const DEFAULT_MAX_PAGES = 16;
const DEFAULT_MAX_HISTORY = 128;
const DEFAULT_MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_TRANSITIONS = 512;
const ACTION_TYPES = new Set(['activate', 'open-locator', 'back', 'forward', 'reload', 'focus-entry', 'scroll-entry']);

class AxmBrowserSessionError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmBrowserSessionError';
    this.code = code;
    this.details = details || {};
  }
}

function positiveInteger(value, fallback, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new TypeError(name + ' must be a positive integer');
  return value;
}

function cleanLocator(value) {
  const locator = String(value == null ? '' : value).replace(/\\/g, '/');
  if (!locator || locator === '-') {
    throw new AxmBrowserSessionError('SESSION_LOCAL_FILE_REQUIRED', 'local browser sessions require named local files');
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(locator)) {
    throw new AxmBrowserSessionError('SESSION_LOCAL_FILE_REQUIRED', 'session page locators must be local file paths', { locator });
  }
  return locator;
}

function pathKey(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function normalizeDescriptors(entryPath, allowedPaths, baseDirectory) {
  const inputs = [entryPath].concat(allowedPaths || []);
  const seen = new Set();
  const base = baseDirectory == null ? process.cwd() : path.resolve(baseDirectory);
  return inputs.map(function (input, index) {
    const locator = cleanLocator(input);
    const filePath = path.resolve(base, input);
    const key = pathKey(filePath);
    if (seen.has(key)) {
      throw new AxmBrowserSessionError('SESSION_DUPLICATE_PAGE', 'each explicitly allowed local page must be unique', { locator });
    }
    seen.add(key);
    return { locator, filePath, entry: index === 0 };
  });
}

function readExplicitFile(descriptor) {
  let stat;
  try {
    stat = fs.lstatSync(descriptor.filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new AxmBrowserSessionError('SESSION_PAGE_NOT_FOUND', 'explicitly allowed session page was not found', { locator: descriptor.locator });
    }
    throw error;
  }
  if (stat.isSymbolicLink()) {
    throw new AxmBrowserSessionError('SESSION_PAGE_SYMLINK_HELD', 'session pages may not be loaded through symbolic links', { locator: descriptor.locator });
  }
  if (!stat.isFile()) {
    throw new AxmBrowserSessionError('SESSION_PAGE_NOT_FILE', 'session page must be a regular file', { locator: descriptor.locator });
  }
  return fs.readFileSync(descriptor.filePath);
}

function pageIdFor(locator) {
  return 'page-' + Digest.canonicalDigest({ locator }).slice(0, 24);
}

function defaultEntryRef(index) {
  const heading = index.entries.find(function (entry) { return entry.kind === 'heading'; });
  return heading ? heading.entryId : (index.entries[0] ? index.entries[0].entryId : null);
}

function splitHref(rawHref) {
  const value = String(rawHref);
  const hashAt = value.indexOf('#');
  const beforeHash = hashAt === -1 ? value : value.slice(0, hashAt);
  const fragmentRaw = hashAt === -1 ? '' : value.slice(hashAt + 1);
  const queryAt = beforeHash.indexOf('?');
  return {
    pathname: queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt),
    query: queryAt === -1 ? '' : beforeHash.slice(queryAt),
    fragmentRaw
  };
}

function hasHeldScheme(locator) {
  const value = String(locator);
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) && !/^[A-Za-z]:\//.test(value);
}

function decodeFragment(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return null;
  }
}

function entryForFragment(page, fragment) {
  if (!fragment) return null;
  const target = page.idTargets.find(function (item) { return item.id === fragment; });
  if (!target) return null;
  const entry = page.entries.find(function (item) { return item.nodeRef === target.nodeRef; });
  return entry ? entry.entryId : null;
}

function heldResolution(state, rawTarget) {
  return {
    state,
    targetPageId: null,
    targetLocator: null,
    fragment: null,
    targetEntryRef: null,
    rawTarget: rawTarget == null ? null : String(rawTarget)
  };
}

function resolveLink(record, link, recordsByPath, rootPath) {
  const rawTarget = link.href;
  if (rawTarget == null || rawTarget === '') return heldResolution('HELD_MISSING_TARGET', rawTarget);
  const value = String(rawTarget);
  if (/^https?:\/\//i.test(value) || /^\/\//.test(value)) return heldResolution('HELD_NETWORK', value);
  if (hasHeldScheme(value)) return heldResolution('HELD_SCHEME', value);
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return heldResolution('HELD_INVALID_TARGET', value);

  const parts = splitHref(value);
  if (parts.query) return heldResolution('HELD_QUERY_UNSUPPORTED', value);
  let targetPath = record.filePath;
  if (parts.pathname) {
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(parts.pathname);
    } catch (_error) {
      return heldResolution('HELD_INVALID_TARGET', value);
    }
    targetPath = decodedPath.startsWith('/')
      ? path.resolve(rootPath, '.' + decodedPath)
      : path.resolve(path.dirname(record.filePath), decodedPath);
  }
  const targetRecord = recordsByPath.get(pathKey(targetPath));
  if (!targetRecord) return heldResolution('HELD_UNLISTED_LOCAL', value);
  const fragment = decodeFragment(parts.fragmentRaw);
  if (parts.fragmentRaw && fragment == null) return heldResolution('HELD_INVALID_TARGET', value);
  const targetEntryRef = entryForFragment(targetRecord.publicPage, fragment);
  const samePage = targetRecord.pageId === record.pageId;
  return {
    state: samePage ? 'SAME_DOCUMENT' : 'AVAILABLE',
    targetPageId: targetRecord.pageId,
    targetLocator: targetRecord.locator + parts.query + (parts.fragmentRaw ? '#' + parts.fragmentRaw : ''),
    fragment,
    targetEntryRef,
    rawTarget: value
  };
}

function buildRecord(descriptor, options, providedBytes) {
  const bytes = providedBytes || readExplicitFile(descriptor);
  const engineOptions = {
    requestedUrl: descriptor.locator,
    maxBytes: options.maxBytes,
    maxTokens: options.maxTokens,
    maxAttributes: options.maxAttributes,
    maxNesting: options.maxNesting,
    maxLayoutItems: options.maxLayoutItems,
    maxLayoutTextChars: options.maxLayoutTextChars,
    maxCanvasHeight: options.maxCanvasHeight,
    requestedBy: 'local-browser-session'
  };
  const processed = Engine.processBytes(bytes, engineOptions);
  const structure = Engine.deriveStructure(processed, engineOptions);
  const pageId = pageIdFor(descriptor.locator);
  const publicPage = {
    pageId,
    locator: descriptor.locator,
    title: structure.structureIndex.title,
    language: structure.structureIndex.language,
    sourceDigest: processed.source.sha256,
    documentDigest: processed.documentTree.documentDigest,
    pageModelDigest: processed.pageModel.pageModelDigest,
    structureIndexDigest: structure.structureIndex.structureIndexDigest,
    summary: structure.structureIndex.summary,
    entryCount: structure.structureIndex.entryCount,
    defaultEntryRef: defaultEntryRef(structure.structureIndex),
    entries: structure.structureIndex.entries,
    idTargets: processed.pageModel.relationships.idTargets,
    links: []
  };
  return {
    descriptor,
    locator: descriptor.locator,
    filePath: descriptor.filePath,
    pageId,
    bytes,
    processed,
    publicPage
  };
}

function buildBundle(descriptors, options) {
  options = options || {};
  const maxPages = positiveInteger(options.maxPages, DEFAULT_MAX_PAGES, 'maxPages');
  const maxHistory = positiveInteger(options.maxHistory, DEFAULT_MAX_HISTORY, 'maxHistory');
  const maxTotalBytes = positiveInteger(options.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES, 'maxTotalBytes');
  if (!Array.isArray(descriptors) || descriptors.length === 0) {
    throw new AxmBrowserSessionError('SESSION_EMPTY', 'a local browser session requires at least one explicitly allowed page');
  }
  if (descriptors.length > maxPages) {
    throw new AxmBrowserSessionError('SESSION_PAGE_LIMIT', 'session page count exceeds the configured bound', {
      pageCount: descriptors.length,
      maxPages
    });
  }
  const loaded = descriptors.map(function (descriptor) {
    return { descriptor, bytes: readExplicitFile(descriptor) };
  });
  const totalBytes = loaded.reduce(function (sum, item) { return sum + item.bytes.length; }, 0);
  if (totalBytes > maxTotalBytes) {
    throw new AxmBrowserSessionError('SESSION_BYTES_LIMIT', 'combined session sources exceed the configured byte bound', {
      totalBytes,
      maxTotalBytes
    });
  }
  const records = loaded.map(function (item) { return buildRecord(item.descriptor, options, item.bytes); });
  const recordsByPath = new Map(records.map(function (record) { return [pathKey(record.filePath), record]; }));
  const rootPath = path.dirname(descriptors[0].filePath);
  records.forEach(function (record) {
    const pageModelLinks = record.publicPage.entries.filter(function (entry) { return entry.kind === 'link'; });
    const processedLinks = record.processed.pageModel.links;
    record.publicPage.links = processedLinks.map(function (link, index) {
      const entry = pageModelLinks.find(function (candidate) { return candidate.nodeRef === link.nodeRef; });
      return {
        linkId: 'link-' + String(index + 1).padStart(4, '0'),
        entryRef: entry ? entry.entryId : null,
        nodeRef: link.nodeRef,
        text: link.text || '(untitled link)',
        rawTarget: link.href,
        rel: link.rel,
        target: link.target,
        resolution: resolveLink(record, link, recordsByPath, rootPath)
      };
    });
  });
  const material = {
    schema: BUNDLE_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    entryPageId: records[0].pageId,
    pageCount: records.length,
    totalSourceBytes: totalBytes,
    bounds: { maxPages, maxHistory, maxTotalBytes },
    pages: records.map(function (record) { return record.publicPage; }),
    held: [
      { feature: 'unlisted-local-page-navigation', state: 'HELD' },
      { feature: 'http-https-navigation', state: 'HELD' },
      { feature: 'page-script-execution', state: 'HELD' },
      { feature: 'page-form-submission', state: 'HELD' }
    ]
  };
  return { bundle: Object.assign({}, material, { bundleDigest: Digest.canonicalDigest(material) }), records };
}

function pageById(bundle, pageId) {
  return bundle.pages.find(function (page) { return page.pageId === pageId; }) || null;
}

function pageByLocator(bundle, locator) {
  const parts = splitHref(locator);
  return bundle.pages.find(function (page) { return page.locator === parts.pathname; }) || null;
}

function makeHistoryEntry(state, page, address, fragment, focusEntryRef, scrollEntryRef) {
  const entry = {
    navigationId: 'nav-' + String(state.nextNavigationSequence).padStart(4, '0'),
    pageId: page.pageId,
    address,
    fragment: fragment || null,
    focusEntryRef: focusEntryRef === undefined ? page.defaultEntryRef : focusEntryRef,
    scrollEntryRef: scrollEntryRef === undefined ? (focusEntryRef === undefined ? page.defaultEntryRef : focusEntryRef) : scrollEntryRef
  };
  state.nextNavigationSequence += 1;
  return entry;
}

function initialRuntimeState(bundle, pageId) {
  const page = pageById(bundle, pageId || bundle.entryPageId);
  if (!page) throw new AxmBrowserSessionError('SESSION_ENTRY_PAGE_MISSING', 'entry page is absent from the session bundle');
  const state = {
    history: [],
    historyCursor: 0,
    nextNavigationSequence: 1,
    reloadCount: 0
  };
  state.history.push(makeHistoryEntry(state, page, page.locator, null, page.defaultEntryRef, null));
  return state;
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function entryMaterial(entry) {
  if (!entry) return null;
  return { kind: entry.kind, label: entry.label, text: entry.text, meta: entry.meta };
}

function remapEntryRef(previousPage, nextPage, entryRef, fallback) {
  if (entryRef === null) return null;
  if (!previousPage) return entryExists(nextPage, entryRef) ? entryRef : fallback;
  const previousEntry = previousPage.entries.find(function (entry) { return entry.entryId === entryRef; });
  if (!previousEntry) return fallback;
  const expected = Digest.canonicalDigest(entryMaterial(previousEntry));
  const sameId = nextPage.entries.find(function (entry) { return entry.entryId === entryRef; });
  if (sameId && Digest.canonicalDigest(entryMaterial(sameId)) === expected) return sameId.entryId;
  const matches = nextPage.entries.filter(function (entry) {
    return Digest.canonicalDigest(entryMaterial(entry)) === expected;
  });
  return matches.length === 1 ? matches[0].entryId : fallback;
}

function sanitizeRuntimeState(bundle, candidate, previousBundle) {
  if (!candidate || !Array.isArray(candidate.history) || candidate.history.length === 0) {
    return initialRuntimeState(bundle);
  }
  const state = cloneState(candidate);
  state.history = state.history.filter(function (entry) { return Boolean(pageById(bundle, entry.pageId)); });
  if (state.history.length === 0) return initialRuntimeState(bundle);
  state.history.forEach(function (entry) {
    const page = pageById(bundle, entry.pageId);
    const previousPage = previousBundle ? pageById(previousBundle, entry.pageId) : null;
    entry.focusEntryRef = remapEntryRef(previousPage, page, entry.focusEntryRef, page.defaultEntryRef);
    entry.scrollEntryRef = remapEntryRef(previousPage, page, entry.scrollEntryRef, entry.focusEntryRef);
  });
  state.historyCursor = Math.max(0, Math.min(Number(state.historyCursor) || 0, state.history.length - 1));
  state.nextNavigationSequence = positiveInteger(state.nextNavigationSequence, state.history.length + 1, 'nextNavigationSequence');
  state.reloadCount = Number.isInteger(state.reloadCount) && state.reloadCount >= 0 ? state.reloadCount : 0;
  return state;
}

function currentHistory(state) {
  return state.history[state.historyCursor];
}

function entryExists(page, entryRef) {
  return page.entries.some(function (entry) { return entry.entryId === entryRef; });
}

function pushNavigation(bundle, state, page, address, fragment, focusEntryRef, scrollEntryRef) {
  state.history = state.history.slice(0, state.historyCursor + 1);
  state.history.push(makeHistoryEntry(state, page, address, fragment, focusEntryRef, scrollEntryRef));
  if (state.history.length > bundle.bounds.maxHistory) state.history.shift();
  state.historyCursor = state.history.length - 1;
}

function normalizeAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new AxmBrowserSessionError('SESSION_INVALID_ACTION', 'session action must be an object');
  }
  const type = String(action.type || '');
  if (!ACTION_TYPES.has(type)) throw new AxmBrowserSessionError('SESSION_INVALID_ACTION', 'unsupported session action', { type });
  if (['activate', 'focus-entry', 'scroll-entry'].includes(type)) {
    if (typeof action.entryRef !== 'string' || !/^entry-[0-9]{4}$/.test(action.entryRef)) {
      throw new AxmBrowserSessionError('SESSION_INVALID_ACTION', type + ' requires an entryRef');
    }
    return { type, entryRef: action.entryRef };
  }
  if (type === 'open-locator') {
    if (typeof action.locator !== 'string' || !action.locator) {
      throw new AxmBrowserSessionError('SESSION_INVALID_ACTION', 'open-locator requires a locator');
    }
    return { type, locator: action.locator.replace(/\\/g, '/') };
  }
  return { type };
}

function applyRuntimeAction(bundle, previousState, requestedAction) {
  const state = cloneState(previousState);
  const action = normalizeAction(requestedAction);
  const before = currentHistory(state);
  const currentPage = pageById(bundle, before.pageId);
  let status = 'APPLIED';
  let reason = null;

  if (action.type === 'activate') {
    const link = currentPage.links.find(function (candidate) { return candidate.entryRef === action.entryRef; });
    if (!link) throw new AxmBrowserSessionError('SESSION_LINK_NOT_FOUND', 'entry is not a link on the current page', { entryRef: action.entryRef });
    if (!['AVAILABLE', 'SAME_DOCUMENT'].includes(link.resolution.state)) {
      status = 'HELD';
      reason = link.resolution.state;
    } else {
      const page = pageById(bundle, link.resolution.targetPageId);
      pushNavigation(bundle, state, page, link.resolution.targetLocator, link.resolution.fragment,
        link.resolution.targetEntryRef || page.defaultEntryRef,
        link.resolution.targetEntryRef || null);
    }
  } else if (action.type === 'open-locator') {
    const parts = splitHref(action.locator);
    if (/^https?:\/\//i.test(action.locator) || /^\/\//.test(action.locator)) {
      status = 'HELD';
      reason = 'HELD_NETWORK';
    } else if (hasHeldScheme(action.locator)) {
      status = 'HELD';
      reason = 'HELD_SCHEME';
    } else if (parts.query) {
      status = 'HELD';
      reason = 'HELD_QUERY_UNSUPPORTED';
    } else {
      const allowedPage = parts.pathname ? pageByLocator(bundle, action.locator) : currentPage;
      if (allowedPage) {
        const fragment = decodeFragment(parts.fragmentRaw);
        if (parts.fragmentRaw && fragment == null) {
          status = 'HELD';
          reason = 'HELD_INVALID_TARGET';
        } else {
          pushNavigation(bundle, state, allowedPage, action.locator, fragment,
            entryForFragment(allowedPage, fragment) || allowedPage.defaultEntryRef,
            entryForFragment(allowedPage, fragment) || null);
        }
      } else {
        status = 'HELD';
        reason = 'HELD_UNLISTED_LOCAL';
      }
    }
  } else if (action.type === 'back') {
    if (state.historyCursor === 0) {
      status = 'NOOP';
      reason = 'HISTORY_START';
    } else state.historyCursor -= 1;
  } else if (action.type === 'forward') {
    if (state.historyCursor >= state.history.length - 1) {
      status = 'NOOP';
      reason = 'HISTORY_END';
    } else state.historyCursor += 1;
  } else if (action.type === 'reload') {
    state.reloadCount += 1;
  } else if (action.type === 'focus-entry' || action.type === 'scroll-entry') {
    if (!entryExists(currentPage, action.entryRef)) {
      throw new AxmBrowserSessionError('SESSION_ENTRY_NOT_FOUND', 'entry is not present on the current page', { entryRef: action.entryRef });
    }
    if (action.type === 'focus-entry') {
      before.focusEntryRef = action.entryRef;
      before.scrollEntryRef = action.entryRef;
    }
    else before.scrollEntryRef = action.entryRef;
  }

  const after = currentHistory(state);
  return {
    state,
    transition: {
      action,
      status,
      reason,
      from: { pageId: before.pageId, address: before.address, historyCursor: previousState.historyCursor },
      to: { pageId: after.pageId, address: after.address, historyCursor: state.historyCursor }
    }
  };
}

function publicState(bundle, state) {
  const current = currentHistory(state);
  const page = pageById(bundle, current.pageId);
  return {
    current: {
      pageId: page.pageId,
      address: current.address,
      title: page.title,
      sourceDigest: page.sourceDigest,
      documentDigest: page.documentDigest,
      pageModelDigest: page.pageModelDigest,
      structureIndexDigest: page.structureIndexDigest,
      fragment: current.fragment,
      focusEntryRef: current.focusEntryRef,
      scrollEntryRef: current.scrollEntryRef
    },
    history: cloneState(state.history),
    historyCursor: state.historyCursor,
    canGoBack: state.historyCursor > 0,
    canGoForward: state.historyCursor < state.history.length - 1,
    reloadCount: state.reloadCount
  };
}

class LocalBrowserSession {
  constructor(entryPath, allowedPaths, options) {
    this.options = Object.assign({}, options || {});
    this.descriptors = normalizeDescriptors(entryPath, allowedPaths, this.options.baseDirectory);
    const built = buildBundle(this.descriptors, this.options);
    this.bundle = built.bundle;
    this.records = built.records;
    this.sessionId = 'session-' + this.bundle.bundleDigest.slice(0, 24);
    this.runtimeState = initialRuntimeState(this.bundle);
    this.transitionTrace = [];
    this.nextTransitionSequence = 1;
  }

  apply(requestedAction) {
    const action = normalizeAction(requestedAction);
    if (this.transitionTrace.length >= MAX_TRANSITIONS) {
      throw new AxmBrowserSessionError(
        'SESSION_TRANSITION_LIMIT',
        'session transition trace reached its hard bound',
        { transitionCount: this.transitionTrace.length, maxTransitions: MAX_TRANSITIONS }
      );
    }
    let reparseReceipt = null;
    if (action.type === 'reload') {
      const previousBundle = this.bundle;
      const previousState = this.runtimeState;
      const built = buildBundle(this.descriptors, this.options);
      this.bundle = built.bundle;
      this.records = built.records;
      this.runtimeState = sanitizeRuntimeState(this.bundle, previousState, previousBundle);
      reparseReceipt = this.bundle.pages.map(function (page) {
        const before = pageById(previousBundle, page.pageId);
        return {
          pageId: page.pageId,
          locator: page.locator,
          beforeSourceDigest: before ? before.sourceDigest : null,
          afterSourceDigest: page.sourceDigest,
          changed: !before || before.sourceDigest !== page.sourceDigest
        };
      });
    }
    const applied = applyRuntimeAction(this.bundle, this.runtimeState, action);
    this.runtimeState = applied.state;
    this.transitionTrace.push(Object.assign({
      sequence: this.nextTransitionSequence,
      reparseReceipt
    }, applied.transition));
    this.nextTransitionSequence += 1;
    return this.snapshot();
  }

  snapshot() {
    const material = {
      schema: SESSION_SCHEMA,
      version: 1,
      status: 'EXPERIMENTAL',
      sessionId: this.sessionId,
      bundle: this.bundle,
      state: publicState(this.bundle, this.runtimeState),
      transitionTrace: cloneState(this.transitionTrace),
      held: [
        { feature: 'external-network-navigation', state: 'HELD' },
        { feature: 'page-script-execution', state: 'HELD' },
        { feature: 'form-submission', state: 'HELD' },
        { feature: 'tabs', state: 'HELD' }
      ]
    };
    return Object.assign({}, material, { sessionDigest: Digest.canonicalDigest(material) });
  }
}

module.exports = {
  BUNDLE_SCHEMA,
  SESSION_SCHEMA,
  DEFAULT_MAX_PAGES,
  DEFAULT_MAX_HISTORY,
  DEFAULT_MAX_TOTAL_BYTES,
  MAX_TRANSITIONS,
  ACTION_TYPES,
  AxmBrowserSessionError,
  positiveInteger,
  cleanLocator,
  pathKey,
  normalizeDescriptors,
  pageIdFor,
  defaultEntryRef,
  splitHref,
  buildBundle,
  initialRuntimeState,
  entryMaterial,
  remapEntryRef,
  sanitizeRuntimeState,
  normalizeAction,
  applyRuntimeAction,
  publicState,
  LocalBrowserSession
};
