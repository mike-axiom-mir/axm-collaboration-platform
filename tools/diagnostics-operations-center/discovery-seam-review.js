#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const manifest = JSON.parse(read('manifest.json')), contract = JSON.parse(read('module.contract.json'));
const html = read('index.html'), app = read('app.js'), css = read('diagnostics-center.css');
const service = fs.readFileSync(path.join(__dirname, '../../shared/operations/diagnostics-service.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../../shared/operations/operations-api.js'), 'utf8');
const controls = [
  ['modern manifest remains explicit', () => manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product'],
  ['TEST status remains behind Mike gate', () => manifest.status === 'TEST'],
  ['dependencies remain separate from permissions', () => manifest.uses.length > 0 && manifest.permissions.length === 0 && contract.permissions.length === 0],
  ['probe failure containment is declared', () => contract.provides.includes('isolated-diagnostic-probes') && contract.boundaries.refuses.includes('one-probe-failure-as-whole-dashboard-failure')],
  ['partial snapshot truth is declared', () => contract.provides.includes('partial-health-snapshot-on-probe-failure')],
  ['probe states are explicit', () => service.includes("const PROBE_STATES = new Set(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'NOT_CONFIGURED'])")],
  ['probe exceptions are converted to evidence', () => service.includes("code: 'PROBE_FAILED'")],
  ['probe errors pass through redaction', () => service.includes('safeMessage(error)')],
  ['log source catalog omits absolute paths', () => service.includes('absolutePathsExposed: false')],
  ['unconfigured log sources are refused', () => service.includes('diagnostic log source is unavailable')],
  ['unknown log sources are refused', () => service.includes('diagnostic log is not allowlisted')],
  ['log bytes are hard bounded', () => service.includes('Math.min(200000')],
  ['log content has a SHA-256 digest', () => service.includes('contentSha256: U.sha256(encoded)')],
  ['structured sensitive fields are redacted', () => service.includes("output[key] = '[REDACTED]'")],
  ['redaction does not claim certification', () => service.includes('secretFreeCertified: false') && html.includes('never certified secret-free')],
  ['export remains explicit', () => api.includes("explicit(req, 'x-axm-diagnostics', 'explicit-export')")],
  ['export lineage is bounded', () => service.includes('lineage.exports.slice(-200)')],
  ['lineage observation is a GET route', () => api.includes("url === '/api/diagnostics/exports' && req.method === 'GET'")],
  ['browser composes independent endpoint results', () => app.includes('function result(promise)')],
  ['browser state comes from server only', () => !/localStorage|sessionStorage/.test(app + html)],
  ['mobile layout is authored', () => css.includes('@media (max-width: 700px)')],
  ['automatic repair and restart remain refused', () => contract.boundaries.refuses.includes('automatic-repair') && contract.boundaries.refuses.includes('automatic-restart')],
  ['health cannot become promotion approval', () => contract.boundaries.refuses.includes('diagnostic-evidence-as-promotion-approval')]
];
controls.forEach(([label, test]) => assert(test(), label));
console.log('Diagnostics & Operations Center discovery seam review: PASS - ' + controls.length + ' controls');
