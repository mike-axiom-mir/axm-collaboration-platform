'use strict';

const path = require('path');
const U = require('./operations-utils');

const SCHEMA = 'axm.source-connector-hub/v1';
const CONNECTORS = {
  'world-bank': { id: 'world-bank', name: 'World Bank Indicators API v2', authority: 'World Bank', format: 'json', origin: 'https://api.worldbank.org', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures' },
  eurostat: { id: 'eurostat', name: 'Eurostat Statistics API', authority: 'Eurostat', format: 'json-stat-2', origin: 'https://ec.europa.eu', docs: 'https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started' },
  cbs: { id: 'cbs', name: 'CBS Open Data OData', authority: 'Statistics Netherlands (CBS)', format: 'odata-json', origin: 'https://opendata.cbs.nl', docs: 'https://www.cbs.nl/-/media/_pdf/2017/13/handleiding-cbs-open-data-services.pdf' },
  dzs: { id: 'dzs', name: 'Croatian Bureau of Statistics official release', authority: 'Državni zavod za statistiku', format: 'official-html', origin: 'https://dzs.gov.hr', docs: 'https://dzs.gov.hr/en' }
};

function create(options) {
  const stateFile = path.join(options.stateRoot, 'source-connector-hub', 'sources.json');
  const auditFile = path.join(options.stateRoot, 'source-connector-hub', 'audit.jsonl');
  const cacheDir = path.join(options.stateRoot, 'source-connector-hub', 'cache');
  function read() { return U.loadJson(stateFile, { schema: SCHEMA, version: 1, previews: [], promoted: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function cleanCode(value, label, pattern) { const text = String(value || '').trim(); if (!pattern.test(text)) throw new Error(label + ' has unsupported characters'); return text; }
  function buildUrl(connectorId, params) {
    const p = params || {}, connector = CONNECTORS[connectorId]; if (!connector) throw new Error('source connector not found');
    if (connectorId === 'world-bank') {
      const countries = cleanCode(p.countries || 'all', 'country list', /^(?:all|[a-z]{2,3}(?:;[a-z]{2,3})*)$/i), indicator = cleanCode(p.indicator, 'indicator', /^[A-Z0-9_.]{3,80}$/i), start = Math.max(1900, Math.min(2200, Number(p.start) || new Date().getUTCFullYear() - 5)), end = Math.max(start, Math.min(2200, Number(p.end) || new Date().getUTCFullYear()));
      return 'https://api.worldbank.org/v2/country/' + encodeURIComponent(countries).replace(/%3B/g, ';') + '/indicator/' + encodeURIComponent(indicator) + '?format=json&date=' + start + ':' + end + '&per_page=1000';
    }
    if (connectorId === 'eurostat') {
      const dataset = cleanCode(p.dataset, 'Eurostat dataset', /^[a-z0-9_.-]{2,80}$/i), url = new URL('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/' + encodeURIComponent(dataset)); url.searchParams.set('lang', 'en');
      const filters = p.filters && typeof p.filters === 'object' ? p.filters : {}; let count = 0;
      for (const [key, value] of Object.entries(filters)) { if (++count > 12) throw new Error('Eurostat filter limit exceeded'); cleanCode(key, 'Eurostat dimension', /^[A-Z0-9_.-]{1,40}$/i); const text = String(value || ''); if (!/^[A-Z0-9_,.:+ -]{1,300}$/i.test(text)) throw new Error('Eurostat filter value is unsupported'); url.searchParams.set(key, text); }
      return url.toString();
    }
    if (connectorId === 'cbs') {
      const dataset = cleanCode(p.dataset, 'CBS dataset', /^[a-z0-9_-]{3,80}$/i), table = cleanCode(p.table || 'TypedDataSet', 'CBS table', /^[a-z0-9_-]{3,80}$/i), top = Math.max(1, Math.min(1000, Number(p.top) || 100));
      return 'https://opendata.cbs.nl/ODataApi/OData/' + encodeURIComponent(dataset) + '/' + encodeURIComponent(table) + '?$top=' + top;
    }
    const releasePath = String(p.path || '/en').trim();
    if (!/^\/[a-z0-9_?=&%./-]{1,400}$/i.test(releasePath) || releasePath.includes('..')) throw new Error('DZS path must stay on the official dzs.gov.hr site');
    return 'https://dzs.gov.hr' + releasePath;
  }
  async function fetchBounded(url, injected) {
    if (injected) return injected(url);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { redirect: 'error', signal: controller.signal, headers: { accept: 'application/json,text/html;q=0.8', 'user-agent': 'AXM-Source-Connector/1.0' } });
      if (!response.ok) throw new Error('source returned HTTP ' + response.status);
      const declared = Number(response.headers.get('content-length') || 0); if (declared > 5 * 1024 * 1024) throw new Error('source response exceeds 5 MB limit');
      const data = Buffer.from(await response.arrayBuffer()); if (data.length > 5 * 1024 * 1024) throw new Error('source response exceeds 5 MB limit');
      return { status: response.status, contentType: String(response.headers.get('content-type') || ''), body: data.toString('utf8') };
    } finally { clearTimeout(timer); }
  }
  function normalize(connectorId, fetched, url) {
    const connector = CONNECTORS[connectorId], contentType = String(fetched.contentType || ''), raw = typeof fetched.body === 'string' ? fetched.body : JSON.stringify(fetched.body), digest = U.sha256(raw); let data, rows = [], metadata = {};
    if (connectorId === 'dzs' || /text\/html/i.test(contentType)) {
      const title = ((raw.match(/<title[^>]*>([^<]+)/i) || [,'Official DZS release'])[1] || '').replace(/\s+/g, ' ').trim(); data = { title, capturedHtmlBytes: Buffer.byteLength(raw), officialPage: url }; rows = [{ title, url }];
    } else {
      try { data = typeof fetched.body === 'object' ? fetched.body : JSON.parse(raw); } catch (_) { throw new Error('source returned invalid JSON'); }
      if (connectorId === 'world-bank') { metadata = Array.isArray(data) ? data[0] || {} : {}; rows = Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 2000).map(x => ({ country: x.country && x.country.value, countryCode: x.countryiso3code, indicator: x.indicator && x.indicator.value, indicatorCode: x.indicator && x.indicator.id, period: x.date, value: x.value, unit: x.unit || '', observationStatus: x.obs_status || '' })) : []; }
      else if (connectorId === 'cbs') { rows = (data.value || data.d && data.d.results || []).slice(0, 2000); metadata = { odataContext: data['@odata.context'] || null }; }
      else { metadata = { id: data.id || null, label: data.label || null, updated: data.updated || null, size: data.size || null }; rows = Array.isArray(data.value) ? data.value.slice(0, 2000).map((value, index) => ({ index, value })) : []; }
    }
    return { connector: U.clone(connector), sourceUrl: url, fetchedAt: U.now(), contentType, rawDigest: digest, rows, metadata, dataPreview: connectorId === 'eurostat' ? data : undefined, citation: { authority: connector.authority, url, accessedAt: U.now(), licenseReviewRequired: true } };
  }
  async function preview(input, actor, fetcher) {
    const body = input || {}, connectorId = U.cleanId(body.connectorId, 'connector id'), url = buildUrl(connectorId, body.params), fetched = await fetchBounded(url, fetcher), normalized = normalize(connectorId, fetched, url), state = read();
    const preview = { schema: 'axm.source-preview/v1', id: U.uid('source'), connectorId, actor: String(actor || 'local-user').slice(0, 120), query: U.clone(body.params || {}), result: normalized, state: 'REVIEW_REQUIRED', createdAt: U.now() }; preview.artifactDigest = U.sha256(JSON.stringify(preview.result));
    if (options.reviewService) { const review = options.reviewService.submit({ kind: 'source-import', title: CONNECTORS[connectorId].name + ' source preview', sourceRef: 'source-connector:' + preview.id, artifactDigest: preview.artifactDigest, summary: normalized.rows.length + ' normalized row(s) from ' + normalized.sourceUrl, requiredSeats: body.requiredSeats || 1, action: { type: 'promote-source-cache', previewId: preview.id } }); preview.reviewId = review.id; }
    state.previews.unshift(preview); state.previews = state.previews.slice(0, 100); write(state); audit({ type: 'preview', id: preview.id, connectorId, digest: preview.artifactDigest, rows: normalized.rows.length }); return U.clone(preview);
  }
  function promote(previewId, reviewId, actor) {
    const state = read(), preview = state.previews.find(x => x.id === previewId); if (!preview) throw new Error('source preview not found');
    if (!options.reviewService || !options.reviewService.approved(reviewId || preview.reviewId, preview.artifactDigest)) throw new Error('source preview needs exact-digest approval');
    const record = { schema: 'axm.promoted-source/v1', id: U.uid('promoted-source'), previewId: preview.id, connectorId: preview.connectorId, artifactDigest: preview.artifactDigest, sourceUrl: preview.result.sourceUrl, citation: preview.result.citation, rowCount: preview.result.rows.length, promotedAt: U.now(), promotedBy: String(actor || 'local-user').slice(0, 120), cacheFile: '' }, file = path.join(cacheDir, record.id + '.json'); record.cacheFile = path.relative(options.root, file).replace(/\\/g, '/');
    U.atomicJson(file, { schema: 'axm.source-cache/v1', record, result: preview.result }); state.promoted.unshift(record); preview.state = 'PROMOTED'; preview.promotedId = record.id; write(state); audit({ type: 'promoted', id: record.id, previewId, digest: record.artifactDigest }); return U.clone(record);
  }
  function status() { const state = read(); return { schema: SCHEMA, connectors: Object.values(CONNECTORS).map(U.clone), previews: state.previews, promoted: state.promoted, networkOrigins: Object.values(CONNECTORS).map(x => x.origin), arbitraryUrlFetch: false, automaticImport: false }; }
  return { status, buildUrl, preview, promote, normalize, stateFile, auditFile };
}

module.exports = { SCHEMA, CONNECTORS, create };
