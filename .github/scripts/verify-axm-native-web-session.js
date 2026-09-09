#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const VERIFICATION_SCHEMA = 'axm.ci.web-session-verification/v1';
const MAX_FINDINGS = 128;
const MAX_TRANSITIONS = 512;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const PAGE_RE = /^page-[a-f0-9]{24}$/;
const ENTRY_RE = /^entry-[0-9]{4}$/;

function canonicalize(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (!value || typeof value !== 'object') throw new TypeError('unsupported canonical value');
  seen = seen || new Set();
  if (seen.has(value)) throw new TypeError('cyclic canonical value');
  seen.add(value);
  let out;
  if (Array.isArray(value)) {
    out = value.map(function (item) { return canonicalize(item, seen); });
  } else {
    out = {};
    Object.keys(value).sort().forEach(function (key) { out[key] = canonicalize(value[key], seen); });
  }
  seen.delete(value);
  return out;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withoutKey(value, key) {
  const copy = clone(value);
  delete copy[key];
  return copy;
}

function endpointEqual(left, right) {
  return Boolean(left && right)
    && left.pageId === right.pageId
    && left.address === right.address
    && left.historyCursor === right.historyCursor;
}

function verify(snapshot) {
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
  if (!rootOk) return receipt(null, null, null, null, checks, passes, findings);

  check(snapshot.schema === 'axm.web.local-browser-session/v1', 'SESSION_SCHEMA_MISMATCH', 'unexpected session schema');
  check(snapshot.version === 1, 'SESSION_VERSION_MISMATCH', 'unexpected session version');
  check(snapshot.status === 'EXPERIMENTAL', 'SESSION_STATUS_MISMATCH', 'unexpected session status');

  let sessionComputed = null;
  try { sessionComputed = digest(withoutKey(snapshot, 'sessionDigest')); } catch (_error) {}
  check(typeof snapshot.sessionDigest === 'string' && DIGEST_RE.test(snapshot.sessionDigest), 'SESSION_DIGEST_INVALID', 'declared session digest is malformed');
  check(Boolean(sessionComputed) && snapshot.sessionDigest === sessionComputed, 'SESSION_DIGEST_MISMATCH', 'declared session digest does not match canonical session bytes');

  const bundle = snapshot.bundle;
  const bundleOk = check(Boolean(bundle && typeof bundle === 'object' && !Array.isArray(bundle)), 'BUNDLE_INVALID', 'bundle must be an object');
  let bundleComputed = null;
  let pageMap = new Map();

  if (bundleOk) {
    try { bundleComputed = digest(withoutKey(bundle, 'bundleDigest')); } catch (_error) {}
    check(bundle.schema === 'axm.web.local-browser-bundle/v1', 'BUNDLE_SCHEMA_MISMATCH', 'unexpected bundle schema');
    check(typeof bundle.bundleDigest === 'string' && DIGEST_RE.test(bundle.bundleDigest), 'BUNDLE_DIGEST_INVALID', 'declared bundle digest is malformed');
    check(Boolean(bundleComputed) && bundle.bundleDigest === bundleComputed, 'BUNDLE_DIGEST_MISMATCH', 'declared bundle digest does not match canonical bundle bytes');
    check(Array.isArray(bundle.pages), 'BUNDLE_PAGES_INVALID', 'bundle pages must be an array');

    if (Array.isArray(bundle.pages)) {
      check(bundle.pageCount === bundle.pages.length, 'PAGE_COUNT_MISMATCH', 'pageCount must equal pages length');
      bundle.pages.forEach(function (page, pageIndex) {
        const pageOk = check(Boolean(page && typeof page === 'object' && !Array.isArray(page)), 'PAGE_INVALID', 'page ' + pageIndex + ' must be an object');
        if (!pageOk) return;
        check(typeof page.pageId === 'string' && PAGE_RE.test(page.pageId), 'PAGE_ID_INVALID', 'page ' + pageIndex + ' has invalid pageId');
        check(!pageMap.has(page.pageId), 'PAGE_ID_DUPLICATE', 'pageId must be unique: ' + page.pageId);
        if (!pageMap.has(page.pageId)) pageMap.set(page.pageId, page);
        check(typeof page.sourceDigest === 'string' && DIGEST_RE.test(page.sourceDigest), 'PAGE_SOURCE_DIGEST_INVALID', 'page source digest is malformed');
        check(typeof page.documentDigest === 'string' && DIGEST_RE.test(page.documentDigest), 'PAGE_DOCUMENT_DIGEST_INVALID', 'page document digest is malformed');
        check(typeof page.pageModelDigest === 'string' && DIGEST_RE.test(page.pageModelDigest), 'PAGE_MODEL_DIGEST_INVALID', 'page model digest is malformed');
        check(typeof page.structureIndexDigest === 'string' && DIGEST_RE.test(page.structureIndexDigest), 'PAGE_STRUCTURE_DIGEST_INVALID', 'page structure digest is malformed');
        check(Array.isArray(page.entries), 'PAGE_ENTRIES_INVALID', 'page entries must be an array');

        const entryIds = new Set();
        if (Array.isArray(page.entries)) {
          check(page.entryCount === page.entries.length, 'ENTRY_COUNT_MISMATCH', 'entryCount must equal entries length for ' + page.pageId);
          page.entries.forEach(function (entry) {
            if (!entry || typeof entry !== 'object') return;
            check(typeof entry.entryId === 'string' && ENTRY_RE.test(entry.entryId), 'ENTRY_ID_INVALID', 'entry id is malformed on ' + page.pageId);
            check(!entryIds.has(entry.entryId), 'ENTRY_ID_DUPLICATE', 'entry id must be unique on ' + page.pageId + ': ' + entry.entryId);
            entryIds.add(entry.entryId);
          });
          if (page.defaultEntryRef != null) check(entryIds.has(page.defaultEntryRef), 'DEFAULT_ENTRY_MISSING', 'default entry ref is absent on ' + page.pageId);
        }
        page.__ciEntryIds = entryIds;
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
              check(target.__ciEntryIds.has(resolution.targetEntryRef), 'LINK_TARGET_ENTRY_MISSING', 'active link target entry is absent');
            }
            if (resolution.state === 'SAME_DOCUMENT') check(resolution.targetPageId === page.pageId, 'SAME_DOCUMENT_PAGE_MISMATCH', 'same-document link points to another page');
            if (resolution.state === 'AVAILABLE') check(resolution.targetPageId !== page.pageId, 'AVAILABLE_PAGE_MISMATCH', 'available cross-page link points to current page');
          } else if (typeof resolution.state === 'string' && resolution.state.startsWith('HELD_')) {
            check(resolution.targetPageId == null && resolution.targetLocator == null && resolution.targetEntryRef == null, 'HELD_LINK_HAS_TARGET', 'held link must not retain an actionable target');
          }
        });
      });
    }
  }

  const state = snapshot.state;
  const stateOk = check(Boolean(state && typeof state === 'object' && !Array.isArray(state)), 'STATE_INVALID', 'session state must be an object');
  if (stateOk) {
    check(Array.isArray(state.history) && state.history.length > 0, 'HISTORY_INVALID', 'history must be a non-empty array');
    if (Array.isArray(state.history) && state.history.length > 0) {
      const maxHistory = bundle && bundle.bounds && Number.isInteger(bundle.bounds.maxHistory) ? bundle.bounds.maxHistory : null;
      if (maxHistory != null) check(state.history.length <= maxHistory, 'HISTORY_BOUND_EXCEEDED', 'history exceeds declared bundle bound');
      check(Number.isInteger(state.historyCursor) && state.historyCursor >= 0 && state.historyCursor < state.history.length, 'HISTORY_CURSOR_INVALID', 'history cursor is out of range');
      const historyIds = new Set();
      state.history.forEach(function (entry) {
        if (!entry || typeof entry !== 'object') return;
        check(!historyIds.has(entry.navigationId), 'NAVIGATION_ID_DUPLICATE', 'history navigationId must be unique');
        historyIds.add(entry.navigationId);
        check(pageMap.has(entry.pageId), 'HISTORY_PAGE_MISSING', 'history references an absent page');
        const page = pageMap.get(entry.pageId);
        if (page && entry.focusEntryRef != null) check(page.__ciEntryIds.has(entry.focusEntryRef), 'HISTORY_FOCUS_MISSING', 'history focus ref is absent');
        if (page && entry.scrollEntryRef != null) check(page.__ciEntryIds.has(entry.scrollEntryRef), 'HISTORY_SCROLL_MISSING', 'history scroll ref is absent');
      });

      if (Number.isInteger(state.historyCursor) && state.history[state.historyCursor]) {
        const currentHistory = state.history[state.historyCursor];
        check(Boolean(state.current && state.current.pageId === currentHistory.pageId && state.current.address === currentHistory.address && state.current.fragment === currentHistory.fragment && state.current.focusEntryRef === currentHistory.focusEntryRef && state.current.scrollEntryRef === currentHistory.scrollEntryRef), 'CURRENT_HISTORY_MISMATCH', 'current state must match the active history entry');
        const currentPage = pageMap.get(currentHistory.pageId);
        if (currentPage && state.current) {
          check(state.current.title === currentPage.title, 'CURRENT_TITLE_MISMATCH', 'current title differs from bundle page title');
          check(state.current.sourceDigest === currentPage.sourceDigest, 'CURRENT_SOURCE_DIGEST_MISMATCH', 'current source digest differs from bundle page');
          check(state.current.documentDigest === currentPage.documentDigest, 'CURRENT_DOCUMENT_DIGEST_MISMATCH', 'current document digest differs from bundle page');
          check(state.current.pageModelDigest === currentPage.pageModelDigest, 'CURRENT_PAGE_MODEL_DIGEST_MISMATCH', 'current page model digest differs from bundle page');
          check(state.current.structureIndexDigest === currentPage.structureIndexDigest, 'CURRENT_STRUCTURE_DIGEST_MISMATCH', 'current structure digest differs from bundle page');
        }
      }
      check(state.canGoBack === (state.historyCursor > 0), 'BACK_FLAG_MISMATCH', 'canGoBack disagrees with history cursor');
      check(state.canGoForward === (state.historyCursor < state.history.length - 1), 'FORWARD_FLAG_MISMATCH', 'canGoForward disagrees with history cursor');
    }
  }

  const trace = snapshot.transitionTrace;
  check(Array.isArray(trace), 'TRACE_INVALID', 'transition trace must be an array');
  if (Array.isArray(trace)) {
    check(trace.length <= MAX_TRANSITIONS, 'TRACE_BOUND_EXCEEDED', 'transition trace exceeds the runtime hard bound');
    let reloads = 0;
    trace.forEach(function (transition, index) {
      if (!transition || typeof transition !== 'object') return;
      check(transition.sequence === index + 1, 'TRACE_SEQUENCE_MISMATCH', 'transition sequence must be contiguous from one');
      if (transition.action && transition.action.type === 'reload') reloads += 1;
      if (index > 0) check(endpointEqual(trace[index - 1].to, transition.from), 'TRANSITION_CHAIN_MISMATCH', 'transition endpoints are not contiguous');
    });
    if (stateOk && Number.isInteger(state.reloadCount)) check(state.reloadCount === reloads, 'RELOAD_COUNT_MISMATCH', 'reloadCount differs from reload transitions');
    if (stateOk && trace.length > 0 && state.current) {
      check(endpointEqual(trace[trace.length - 1].to, { pageId: state.current.pageId, address: state.current.address, historyCursor: state.historyCursor }), 'TRACE_CURRENT_MISMATCH', 'last transition endpoint differs from current state');
    }
  }

  pageMap.forEach(function (page) { delete page.__ciEntryIds; });
  return receipt(snapshot.sessionDigest || null, sessionComputed, bundle && bundle.bundleDigest || null, bundleComputed, checks, passes, findings);
}

function receipt(sessionDeclared, sessionComputed, bundleDeclared, bundleComputed, checks, passes, findings) {
  const material = {
    schema: VERIFICATION_SCHEMA,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    sessionDigestDeclared: sessionDeclared,
    sessionDigestComputed: sessionComputed,
    bundleDigestDeclared: bundleDeclared,
    bundleDigestComputed: bundleComputed,
    checks: { total: checks, passed: passes, failed: checks - passes },
    findingCount: findings.length,
    findings,
    limits: { maxFindings: MAX_FINDINGS, maxTransitions: MAX_TRANSITIONS },
    authority: { mutationAllowed: false, promotionAllowed: false, canonAllowed: false }
  };
  return Object.assign({}, material, { verificationDigest: digest(material) });
}

function requireFailure(result, code) {
  if (result.status !== 'FAIL' || !result.findings.some(function (item) { return item.code === code; })) {
    throw new Error('tamper selftest did not produce ' + code);
  }
}

function selftest(snapshot) {
  const clean = verify(snapshot);
  if (clean.status !== 'PASS') throw new Error('clean session failed independent verification');

  const currentTamper = clone(snapshot);
  currentTamper.state.current.title += ' [tampered]';
  requireFailure(verify(currentTamper), 'SESSION_DIGEST_MISMATCH');
  requireFailure(verify(currentTamper), 'CURRENT_TITLE_MISMATCH');

  const bundleTamper = clone(snapshot);
  bundleTamper.bundle.pages[0].entries[0].text += ' [tampered]';
  requireFailure(verify(bundleTamper), 'BUNDLE_DIGEST_MISMATCH');
  requireFailure(verify(bundleTamper), 'SESSION_DIGEST_MISMATCH');

  if (snapshot.transitionTrace.length > 1) {
    const chainTamper = clone(snapshot);
    chainTamper.transitionTrace[1].from.address += '#tampered';
    requireFailure(verify(chainTamper), 'TRANSITION_CHAIN_MISMATCH');
  }
}

function main(argv) {
  const args = argv.slice();
  const selftestRequested = args.includes('--selftest');
  const file = args.find(function (arg) { return arg !== '--selftest'; });
  if (!file) throw new Error('usage: verify-axm-native-web-session.js <session.json> [--selftest]');
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (selftestRequested) selftest(snapshot);
  const result = verify(snapshot);
  process.stdout.write(JSON.stringify(canonicalize(result), null, 2) + '\n');
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('independent session verifier failed: ' + String(error && error.message || error) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { canonicalize, canonicalStringify, digest, verify, selftest };
