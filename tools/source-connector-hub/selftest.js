#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Sources = require('../../shared/operations/source-connector-service');
const Review = require('../../shared/operations/review-service');

const PREFIX = 'axm-source-connector-selftest-';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
const root = path.join(temp, 'workshop');
const options = { root, stateRoot: path.join(root, 'state'), exportRoot: path.join(root, 'exports') };
let pass = 0;

function check(label, run) {
  run();
  pass += 1;
  console.log('PASS  ' + label);
}

async function checkAsync(label, run) {
  await run();
  pass += 1;
  console.log('PASS  ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function cleanup() {
  const resolved = path.resolve(temp), allowedRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowedRoot) || !path.basename(resolved).startsWith(PREFIX)) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}

async function main() {
  try {
    fs.mkdirSync(options.stateRoot, { recursive: true });
    fs.mkdirSync(options.exportRoot, { recursive: true });

    const manifest = readJson('manifest.json');
    const contract = readJson('module.contract.json');
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    const review = Review.create({ stateRoot: options.stateRoot });
    const sources = Sources.create(Object.assign({}, options, { reviewService: review }));

    check('manifest and contract require fixed-origin reviewed imports', () => {
      assert.equal(manifest.id, 'source-connector-hub');
      assert.equal(contract.id, manifest.id);
      assert.deepStrictEqual(contract.permissions, manifest.permissions);
      assert(contract.boundaries.refuses.includes('arbitrary-url-fetch'));
      assert(contract.boundaries.refuses.includes('redirect-following'));
      assert(contract.boundaries.refuses.includes('automatic-import'));
      assert(contract.boundaries.refuses.includes('unreviewed-cache-promotion'));
    });

    check('connector URLs remain on four declared official origins', () => {
      assert(sources.buildUrl('world-bank', { countries: 'NL', indicator: 'NY.GDP.MKTP.CD', start: 2023, end: 2024 }).startsWith('https://api.worldbank.org/v2/'));
      assert(sources.buildUrl('eurostat', { dataset: 'demo_pjan', filters: { geo: 'NL' } }).startsWith('https://ec.europa.eu/eurostat/api/'));
      assert(sources.buildUrl('cbs', { dataset: '85333NED', table: 'TypedDataSet', top: 25 }).startsWith('https://opendata.cbs.nl/ODataApi/'));
      assert(sources.buildUrl('dzs', { path: '/en' }).startsWith('https://dzs.gov.hr/'));
    });

    check('origin escapes and unsupported connectors are refused', () => {
      assert.throws(() => sources.buildUrl('dzs', { path: 'https://bad.example' }), /official dzs/);
      assert.throws(() => sources.buildUrl('dzs', { path: '/../admin' }), /official dzs/);
      assert.throws(() => sources.buildUrl('unknown', {}), /connector not found/);
    });

    const mockFetch = async url => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { page: 1, pages: 1 },
        [{ country: { value: 'Netherlands' }, countryiso3code: 'NLD', indicator: { value: 'GDP', id: 'NY.GDP.MKTP.CD' }, date: '2024', value: 1 }]
      ])
    });
    let preview;

    await checkAsync('injected fetch produces normalized cited preview without network dependence', async () => {
      preview = await sources.preview({ connectorId: 'world-bank', params: { countries: 'NL', indicator: 'NY.GDP.MKTP.CD', start: 2024, end: 2024 } }, 'selftest', mockFetch);
      assert.equal(preview.state, 'REVIEW_REQUIRED');
      assert.equal(preview.result.rows.length, 1);
      assert.equal(preview.result.rows[0].countryCode, 'NLD');
      assert.equal(preview.result.citation.authority, 'World Bank');
      assert.equal(preview.result.citation.licenseReviewRequired, true);
      assert.match(preview.artifactDigest, /^[a-f0-9]{64}$/);
      assert(preview.reviewId);
    });

    check('cache promotion refuses pending or wrong-digest review', () => {
      assert.throws(() => sources.promote(preview.id, preview.reviewId, 'selftest'), /exact-digest approval/);
      assert.throws(() => review.vote(preview.reviewId, { actor: 'Mike', verdict: 'APPROVE', artifactDigest: '0'.repeat(64) }), /digest does not match/);
    });

    check('exact approved digest promotes one cited local cache record', () => {
      review.vote(preview.reviewId, { actor: 'Mike', verdict: 'APPROVE', artifactDigest: preview.artifactDigest });
      const promoted = sources.promote(preview.id, preview.reviewId, 'selftest');
      assert.equal(promoted.artifactDigest, preview.artifactDigest);
      assert.equal(promoted.rowCount, 1);
      assert.equal(promoted.citation.authority, 'World Bank');
      assert(fs.existsSync(path.join(root, promoted.cacheFile)));
    });

    check('status keeps arbitrary fetch and automatic import disabled', () => {
      const status = sources.status();
      assert.equal(status.connectors.length, 4);
      assert.equal(status.previews.length, 1);
      assert.equal(status.promoted.length, 1);
      assert.equal(status.arbitraryUrlFetch, false);
      assert.equal(status.automaticImport, false);
    });

    check('browser surface separates preview from approved promotion', () => {
      assert(app.includes("O.post('/api/source-connectors/preview'"));
      assert(app.includes("O.post('/api/source-connectors/promote'"));
      assert(app.includes("'x-axm-source':'explicit-preview'"));
      assert(app.includes("'x-axm-source':'promote-approved-digest'"));
    });

    console.log('Source Connector Hub selftest: PASS (' + pass + ' controls)');
  } finally {
    cleanup();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
