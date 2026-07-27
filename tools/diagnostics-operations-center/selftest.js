#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Diagnostics = require('../../shared/operations/diagnostics-service');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const html = read('index.html'), app = read('app.js'), css = read('diagnostics-center.css');
const service = fs.readFileSync(path.join(__dirname, '../../shared/operations/diagnostics-service.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../../shared/operations/operations-api.js'), 'utf8');
let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('PASS  ' + label); }

check('Diagnostics is a modern TEST product at v0.2', () => {
  assert.equal(manifest.schema, 'axm.tool-manifest/v1');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.status, 'TEST');
  assert.equal(manifest.version, 'v0.2');
});
check('Manifest and contract identity version and permissions agree', () => {
  assert.equal(contract.id, manifest.id);
  assert.equal(contract.version, manifest.version);
  assert.deepStrictEqual(contract.permissions, manifest.permissions);
  assert(ContractVerifier.validateContract(contract, manifest).pass);
});
check('Contract declares isolated probes and partial snapshots', () => {
  assert(contract.provides.includes('isolated-diagnostic-probes'));
  assert(contract.provides.includes('partial-health-snapshot-on-probe-failure'));
});
check('Contract declares bounded redacted digest-bearing log envelopes', () => {
  assert(contract.provides.includes('available-log-source-catalog'));
  assert(contract.provides.includes('bounded-redacted-log-envelope'));
  assert(contract.provides.includes('diagnostic-log-content-digest'));
});
check('Contract declares persistent export lineage', () => {
  assert(contract.provides.includes('persistent-diagnostic-export-lineage'));
  assert(contract.boundaries.writes.includes('state/diagnostics/export-lineage.json'));
});
check('Contract refuses authority and certification collapse', () => {
  ['automatic-repair','automatic-restart','automatic-export','arbitrary-log-path','raw-log-return','redaction-as-secret-free-certification','health-as-certification','diagnostic-evidence-as-promotion-approval'].forEach(value => assert(contract.boundaries.refuses.includes(value)));
});
check('Service exports versioned snapshot log and lineage schemas', () => {
  assert.equal(Diagnostics.SNAPSHOT_SCHEMA, 'axm.diagnostics-snapshot/v2');
  assert.equal(Diagnostics.LOG_CATALOG_SCHEMA, 'axm.diagnostics-log-source-catalog/v1');
  assert.equal(Diagnostics.LOG_ENVELOPE_SCHEMA, 'axm.diagnostics-log-envelope/v1');
  assert.equal(Diagnostics.EXPORT_LINEAGE_SCHEMA, 'axm.diagnostics-export-lineage/v1');
});
check('Every diagnostic probe is wrapped by the contained runner', () => {
  assert(service.includes('function runProbe(spec)'));
  assert(service.includes("state: 'UNAVAILABLE'"));
  assert(service.includes('partialSnapshotOnProbeFailure: true'));
});
check('Log source resolution never eagerly dereferences optional adapters', () => {
  assert(service.includes('function resolvedSources()'));
  assert(service.includes("state: resolutionError ? 'UNAVAILABLE'"));
  assert(service.includes("'NOT_CONFIGURED'"));
});
check('Log envelopes bound bytes and carry a content digest', () => {
  assert(service.includes('Math.min(200000'));
  assert(service.includes('contentSha256: U.sha256(encoded)'));
});
check('Log output uses structured and pattern redaction without certification', () => {
  assert(service.includes('BEST_EFFORT_STRUCTURED_AND_PATTERN_REDACTION'));
  assert(service.includes('secretFreeCertified: false'));
  assert(service.includes('rawLogReturned: false'));
});
check('Export writes report receipt and bounded persistent lineage', () => {
  assert(service.includes("id + '.receipt.json'"));
  assert(service.includes('lineage.exports = lineage.exports.slice(-200)'));
  assert(service.includes('automaticExport: false'));
});
check('Read-only Diagnostics routes expose snapshot sources logs and lineage', () => {
  ['/api/diagnostics\'','/api/diagnostics/log-sources','/api/diagnostics/logs','/api/diagnostics/exports'].forEach(route => assert(api.includes(route)));
});
check('Export route retains explicit intent and temporary-session mutation guard', () => {
  const route = api.slice(api.indexOf("if (url === '/api/diagnostics/export'"), api.indexOf("if (url === '/api/search'"));
  assert(route.includes('mutationAllowed()'));
  assert(route.includes("explicit(req, 'x-axm-diagnostics', 'explicit-export')"));
});
check('Browser loads snapshot source catalog and export lineage independently', () => {
  assert(app.includes("O.get('/api/diagnostics')"));
  assert(app.includes("O.get('/api/diagnostics/log-sources')"));
  assert(app.includes("O.get('/api/diagnostics/exports')"));
  assert(app.includes('function result(promise)'));
});
check('Browser makes probe states and redaction limits visible', () => {
  assert(html.includes('Diagnostic probes'));
  assert(html.includes('Redaction is a guard, not a guarantee.'));
  assert(app.includes('secret-free certification: NO'));
});
check('Browser does not shadow service truth in local storage', () => {
  assert(!/localStorage|sessionStorage/.test(app + html));
});
check('Interface has local-only assets and no mojibake markers', () => {
  assert(!/https?:\/\//.test(html));
  assert(!/[Ââ]/.test(html + app));
});
check('Interface has responsive probe log and metric layouts', () => {
  assert(css.includes('@media (max-width: 700px)'));
  assert(css.includes('.probe-grid'));
  assert(css.includes('.log-controls'));
  assert(css.includes('.metric-grid'));
});
check('Interface retains visible Hub return and keyboard skip route', () => {
  assert(html.includes('href="../../hub/index.html"'));
  assert(html.includes('class="skip-link"'));
  assert(html.includes('tabindex="0"'));
});

console.log('Diagnostics & Operations Center selftest: PASS (' + pass + ' controls)');
