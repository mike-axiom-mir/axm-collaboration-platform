'use strict';

const { TextDecoder } = require('node:util');
const Digest = require('./digest');

const VERIFICATION_SCHEMA = 'axm.web.local-browser-session-verification/v1';
const DEFAULT_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_FINDINGS = 128;
const MAX_TRANSITIONS = 512;
const DIGEST_RE = /^[a-f0-9]{64}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withoutKey(value, key) {
  const copy = clone(value);
  delete copy[key];
  return copy;
}

function nullableDigest(value) {
  return typeof value === 'string' && DIGEST_RE.test(value) ? value : null;
}

function endpointEqual(left, right) {
  return Boolean(left && right)
    && left.pageId === right.pageId
    && left.address === right.address
    && left.historyCursor === right.historyCursor;
}

function finalize(inputBytes, sessionDeclared, sessionComputed, bundleDeclared, bundleComputed, checks, passes, findings, limits) {
  const material = {
    schema: VERIFICATION_SCHEMA,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    inputBytes,
    sessionDigestDeclared: sessionDeclared,
    sessionDigestComputed: sessionComputed,
    bundleDigestDeclared: bundleDeclared,
    bundleDigestComputed: bundleComputed,
    checks: { total: checks, passed: passes, failed: checks - passes },
    findingCount: findings.length,
    findings,
    limits,
    authority: {
      mutationAllowed: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { verificationDigest: Digest.canonicalDigest(material) });
}

function verifySessionSnapshot(snapshot, options) {
  options = options || {};
  const inputBytes = Number.isInteger(options.inputBytes) && options.inputBytes >= 0 ? options.inputBytes : 0;
  const maxInputBytes = Number.isInteger(options.maxInputBytes) && options.maxInputBytes > 0
    ? options.maxInputBytes : DEFAULT_MAX_INPUT_BYTES;
  const findings = [];
  let checks = 0;
  let passes = 0;

  function check(condition, code, message) {
    checks += 1;
    if (condition) {
      passes += 1;
      return true;
    }
    if (findings.length < MAX_FINDINGS) findings.push({ code, message });
    return false;
  }

  const rootOk = check(Boolean(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)), 'ROOT_INVALID', 'session snapshot must be an object');
  if (!rootOk) return finalize(inputBytes, null, null, null, null, checks, passes, findings, { maxInputBytes, maxFindings: MAX_FINDINGS, maxTransitions: MAX_TRANSITIONS });

  check(snapshot.schema === 'axm.web.local-browser-session/v1', 'SESSION_SCHEMA_MISMATCH', 'unexpected session schema');
  check(snapshot.version === 1, 'SESSION_VERSION_MISMATCH', 'unexpected session version');
  check(snapshot.status === 'EXPERIMENTAL', 'SESSION_STATUS_MISMATCH', 'unexpected session status');

  const sessionDeclared = nullableDigest(snapshot.sessionDigest);
  let sessionComputed = null;
  try { sessionComputed = Digest.canonicalDigest(withoutKey(snapshot, 'sessionDigest')); } catch (_error) {}
  check(Boolean(sessionDeclared), 'SESSION_DIGEST_INVALID', 'declared session digest is malformed');
  check(Boolean(sessionComputed) && sessionDeclared === sessionComputed, 'SESSION_DIGEST_MISMATCH', 'declared session digest does not match canonical session material');

  const bundle = snapshot.bundle;
  const bundleOk = check(Boolean(bundle && typeof bundle === 'object' && !Array.isArray(bundle)), 'BUNDLE_INVALID', 'session bundle must be an object');
  let bundleDeclared = null;
  let bundleComputed = null;
  const pageMap = new Map();

  if (bundleOk) {
    bundleDeclared = nullableDigest(bundle.bundleDigest);
    try { bundleComputed = Digest.canonicalDigest(withoutKey(bundle, 'bundleDigest')); } catch (_error) {}
    check(bundle.schema === 'axm.web.local-browser-bundle/v1', 'BUNDLE_SCHEMA_MISMATCH', 'unexpected bundle schema');
    check(Boolean(bundleDeclared), 'BUNDLE_DIGEST_INVALID', 'declared bundle digest is malformed');
    check(Boolean(bundleComputed) && bundleDeclared === bundleComputed, 'BUNDLE_DIGEST_MISMATCH', 'declared bundle digest does not match canonical bundle material');
    check(Array.isArray(bundle.pages), 'BUNDLE_PAGES_INVALID', 'bundle pages must be an array');
    if (Array.isArray(bundle.pages)) {
      check(bundle.pageCount === bundle.pages.length, 'PAGE_COUNT_MISMATCH', 'bundle pageCount differs from pages length');
      bundle.pages.forEach(function (page) {
        if (!page || typeof page !== 'object') {
          check(false, 'PAGE_INVALID', 'bundle contains a non-object page');
          return;
        }
        check(typeof page.pageId === 'string' && page.pageId, 'PAGE_ID_INVALID', 'bundle pageId is missing');
        check(!pageMap.has(page.pageId), 'PAGE_ID_DUPLICATE', 'bundle pageId must be unique: ' + String(page.pageId));
        if (!pageMap.has(page.pageId)) pageMap.set(page.pageId, page);
        check(Array.isArray(page.entries), 'PAGE_ENTRIES_INVALID', 'page entries must be an array: ' + String(page.pageId));
        const entryIds = new Set();
        if (Array.isArray(page.entries)) {
          check(page.entryCount === page.entries.length, 'ENTRY_COUNT_MISMATCH', 'page entryCount differs from entries length: ' + String(page.pageId));
          page.entries.forEach(function (entry) {
            if (!entry || typeof entry.entryId !== 'string') return;
            check(!entryIds.has(entry.entryId), 'ENTRY_ID_DUPLICATE', 'entryId must be unique on ' + String(page.pageId));
            entryIds.add(entry.entryId);
          });
          if (page.defaultEntryRef != null) check(entryIds.has(page.defaultEntryRef), 'DEFAULT_ENTRY_MISSING', 'defaultEntryRef is absent from page entries');
        }
        pageMap.set(page.pageId, { page, entryIds });
      });
      check(pageMap.has(bundle.entryPageId), 'ENTRY_PAGE_MISSING', 'bundle entryPageId is absent');

      bundle.pages.forEach(function (page) {
        if (!page || !Array.isArray(page.links)) return;
        page.links.forEach(function (link) {
          if (!link || !link.resolution) return;
          const resolution = link.resolution;
          const active = resolution.state === 'AVAILABLE' || resolution.state === 'SAME_DOCUMENT';
          if (active) {
            check(pageMap.has(resolution.targetPageId), 'LINK_TARGET_PAGE_MISSING', 'active link target page is absent');
            const target = pageMap.get(resolution.targetPageId);
            if (target && resolution.targetEntryRef != null) {
              check(target.entryIds.has(resolution.targetEntryRef), 'LINK_TARGET_ENTRY_MISSING', 'active link target entry is absent');
            }
            if (resolution.state === 'SAME_DOCUMENT') check(resolution.targetPageId === page.pageId, 'SAME_DOCUMENT_PAGE_MISMATCH', 'same-document link points to another page');
            if (resolution.state === 'AVAILABLE') check(resolution.targetPageId !== page.pageId, 'AVAILABLE_PAGE_MISMATCH', 'cross-page link points to current page');
          } else if (typeof resolution.state === 'string' && resolution.state.startsWith('HELD_')) {
            check(resolution.targetPageId == null && resolution.targetLocator == null && resolution.targetEntryRef == null, 'HELD_LINK_HAS_TARGET', 'held link retains an actionable target');
          }
        });
      });
    }
  }

  const state = snapshot.state;
  const stateOk = check(Boolean(state && typeof state === 'object' && !Array.isArray(state)), 'STATE_INVALID', 'session state must be an object');
  if (stateOk) {
    const historyOk = check(Array.isArray(state.history) && state.history.length > 0, 'HISTORY_INVALID', 'history must be a non-empty array');
    if (historyOk) {
      const maxHistory = bundle && bundle.bounds && Number.isInteger(bundle.bounds.maxHistory) ? bundle.bounds.maxHistory : null;
      if (maxHistory != null) check(state.history.length <= maxHistory, 'HISTORY_BOUND_EXCEEDED', 'history exceeds bundle maxHistory');
      const cursorOk = check(Number.isInteger(state.historyCursor) && state.historyCursor >= 0 && state.historyCursor < state.history.length, 'HISTORY_CURSOR_INVALID', 'history cursor is out of range');
      const navigationIds = new Set();
      state.history.forEach(function (entry) {
        if (!entry || typeof entry !== 'object') {
          check(false, 'HISTORY_ENTRY_INVALID', 'history contains a non-object entry');
          return;
        }
        check(!navigationIds.has(entry.navigationId), 'NAVIGATION_ID_DUPLICATE', 'history navigationId must be unique');
        navigationIds.add(entry.navigationId);
        check(pageMap.has(entry.pageId), 'HISTORY_PAGE_MISSING', 'history references an absent page');
        const target = pageMap.get(entry.pageId);
        if (target && entry.focusEntryRef != null) check(target.entryIds.has(entry.focusEntryRef), 'HISTORY_FOCUS_MISSING', 'history focus entry is absent');
        if (target && entry.scrollEntryRef != null) check(target.entryIds.has(entry.scrollEntryRef), 'HISTORY_SCROLL_MISSING', 'history scroll entry is absent');
      });
      if (cursorOk && state.current) {
        const active = state.history[state.historyCursor];
        check(state.current.pageId === active.pageId && state.current.address === active.address && state.current.fragment === active.fragment && state.current.focusEntryRef === active.focusEntryRef && state.current.scrollEntryRef === active.scrollEntryRef, 'CURRENT_HISTORY_MISMATCH', 'current state differs from active history entry');
        const currentTarget = pageMap.get(active.pageId);
        if (currentTarget) {
          const page = currentTarget.page;
          check(state.current.title === page.title, 'CURRENT_TITLE_MISMATCH', 'current title differs from bundle page');
          check(state.current.sourceDigest === page.sourceDigest, 'CURRENT_SOURCE_DIGEST_MISMATCH', 'current source digest differs from bundle page');
          check(state.current.documentDigest === page.documentDigest, 'CURRENT_DOCUMENT_DIGEST_MISMATCH', 'current document digest differs from bundle page');
          check(state.current.pageModelDigest === page.pageModelDigest, 'CURRENT_PAGE_MODEL_DIGEST_MISMATCH', 'current page model digest differs from bundle page');
          check(state.current.structureIndexDigest === page.structureIndexDigest, 'CURRENT_STRUCTURE_DIGEST_MISMATCH', 'current structure digest differs from bundle page');
        }
      }
      check(state.canGoBack === (state.historyCursor > 0), 'BACK_FLAG_MISMATCH', 'canGoBack disagrees with history cursor');
      check(state.canGoForward === (state.historyCursor < state.history.length - 1), 'FORWARD_FLAG_MISMATCH', 'canGoForward disagrees with history cursor');
    }
  }

  const traceOk = check(Array.isArray(snapshot.transitionTrace), 'TRACE_INVALID', 'transitionTrace must be an array');
  if (traceOk) {
    const trace = snapshot.transitionTrace;
    check(trace.length <= MAX_TRANSITIONS, 'TRACE_BOUND_EXCEEDED', 'transition trace exceeds hard lifecycle bound');
    let reloads = 0;
    trace.forEach(function (transition, index) {
      if (!transition || typeof transition !== 'object') {
        check(false, 'TRANSITION_INVALID', 'transition trace contains a non-object entry');
        return;
      }
      check(transition.sequence === index + 1, 'TRACE_SEQUENCE_MISMATCH', 'transition sequence must be contiguous from one');
      if (transition.action && transition.action.type === 'reload') reloads += 1;
      if (index > 0) check(endpointEqual(trace[index - 1].to, transition.from), 'TRANSITION_CHAIN_MISMATCH', 'transition endpoints are not contiguous');
    });
    if (stateOk && Number.isInteger(state.reloadCount)) check(state.reloadCount === reloads, 'RELOAD_COUNT_MISMATCH', 'reloadCount differs from recorded reload actions');
    if (stateOk && trace.length > 0 && state.current) {
      check(endpointEqual(trace[trace.length - 1].to, { pageId: state.current.pageId, address: state.current.address, historyCursor: state.historyCursor }), 'TRACE_CURRENT_MISMATCH', 'last transition endpoint differs from current state');
    }
  }

  return finalize(inputBytes, sessionDeclared, sessionComputed, bundleDeclared, bundleComputed, checks, passes, findings, { maxInputBytes, maxFindings: MAX_FINDINGS, maxTransitions: MAX_TRANSITIONS });
}

function verificationFailure(inputBytes, code, message, maxInputBytes) {
  return finalize(inputBytes, null, null, null, null, 1, 0, [{ code, message }], {
    maxInputBytes,
    maxFindings: MAX_FINDINGS,
    maxTransitions: MAX_TRANSITIONS
  });
}

function verifySessionBytes(bytes, options) {
  options = options || {};
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  const maxInputBytes = Number.isInteger(options.maxInputBytes) && options.maxInputBytes > 0
    ? options.maxInputBytes : DEFAULT_MAX_INPUT_BYTES;
  if (bytes.length > maxInputBytes) {
    return verificationFailure(bytes.length, 'INPUT_BYTES_LIMIT', 'session JSON exceeds verifier byte bound', maxInputBytes);
  }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (_error) { return verificationFailure(bytes.length, 'INPUT_UTF8_INVALID', 'session input is not valid UTF-8', maxInputBytes); }
  let snapshot;
  try { snapshot = JSON.parse(text); }
  catch (_error) { return verificationFailure(bytes.length, 'INPUT_JSON_INVALID', 'session input is not valid JSON', maxInputBytes); }
  return verifySessionSnapshot(snapshot, { inputBytes: bytes.length, maxInputBytes });
}

module.exports = {
  VERIFICATION_SCHEMA,
  DEFAULT_MAX_INPUT_BYTES,
  MAX_FINDINGS,
  MAX_TRANSITIONS,
  verifySessionSnapshot,
  verifySessionBytes
};
