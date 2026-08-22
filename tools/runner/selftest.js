'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Accessibility = require('../../scripts/accessibility-static-audit');

const ROOT = __dirname;
let checks = 0;
function ok(value, label) {
  if (!value) throw new Error('FAIL: ' + label);
  checks += 1;
}
function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function json(name) { return JSON.parse(read(name)); }

const manifest = json('manifest.json');
const contractPath = path.join(ROOT, 'module.contract.json');
ok(fs.existsSync(contractPath), 'module contract file exists');
const contract = json('module.contract.json');
const html = read('index.html');

ok(manifest.schema === ContractVerifier.MANIFEST_SCHEMA && manifest.kind === 'product', 'modern product manifest is explicit');
ok(manifest.contract === 'module.contract.json', 'manifest declares its module contract');
ok(JSON.stringify(manifest.permissions) === '[]' && JSON.stringify(contract.permissions) === '[]', 'desk requests no Hub permission token');
ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates against the manifest');
ok(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'reset', 'desk owns no persisted state and resets on reload');
[
  'browser-command-execution',
  'unauthenticated-machine-host-access',
  'verify-pass-claim-from-run-request',
  'automatic-workshop-status-promotion',
  'canon-authority',
  'external-network-access'
].forEach(boundary => ok(contract.boundaries.refuses.includes(boundary), 'contract refuses ' + boundary));

const fetchTargets = Array.from(html.matchAll(/fetch\(['"]([^'"]+)['"]\)/g), match => match[1]);
ok(JSON.stringify(fetchTargets) === JSON.stringify(['/api/health', '/exports/verify-report.txt']), 'only the two declared same-origin read targets are fetched');
ok(html.includes("schema:'axm.run-request/v1'") && html.includes("effect:'proposal-only'") && html.includes('executed:false'), 'export remains an explicitly unexecuted run proposal');
ok(/AXMHub\.ready\(\{[\s\S]*?permissions:\[\][\s\S]*?savesState:false/.test(html), 'Hub passport carries zero authority and no persistence claim');
ok(!/https?:\/\//i.test(html), 'page declares no direct external-network URL');
ok(!/\b(?:child_process|execFile|execSync|spawnSync|powershell|cmd\.exe)\b/i.test(html), 'page contains no process-execution primitive');
for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  new Function(match[1]);
  checks += 1;
}
ok(Accessibility.auditHtml(path.join(ROOT, 'index.html')).length === 0, 'static accessibility audit has zero definite findings');

async function exerciseActualPageHandlers() {
  const elements = {};
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    elements[match[1]] = { id: match[1], textContent: '', onclick: null };
  }

  const anchors = [];
  const blobs = [];
  const requested = [];
  const logs = [];
  const readyCalls = [];
  const initCallbacks = [];
  const revoked = [];
  let healthPayload = { ok: true, service: 'workshop' };
  let reportResponse = { ok: true, body: '530 PASS · 0 FAIL' };
  let fetchFailure = null;

  class BlobStub {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
      blobs.push(this);
    }
  }

  const document = {
    getElementById(id) { return elements[id]; },
    createElement(tag) {
      const element = {
        tag,
        download: '',
        href: '',
        clicks: 0,
        click() { this.clicks += 1; }
      };
      anchors.push(element);
      return element;
    }
  };
  const context = {
    document,
    fetch: async target => {
      requested.push(target);
      if (fetchFailure) throw fetchFailure;
      if (target === '/api/health') return { ok: true, json: async () => healthPayload };
      if (target === '/exports/verify-report.txt') {
        return { ok: reportResponse.ok, text: async () => reportResponse.body };
      }
      throw new Error('unexpected fetch target: ' + target);
    },
    AXMHub: {
      log(message) { logs.push(message); },
      onInit(callback) { initCallbacks.push(callback); },
      ready(passport) { readyCalls.push(passport); }
    },
    Blob: BlobStub,
    URL: {
      createObjectURL(blob) {
        ok(blob instanceof BlobStub, 'proposal creates a Blob from the exported request');
        return 'blob:selftest';
      },
      revokeObjectURL(value) { revoked.push(value); }
    },
    setTimeout(callback) { callback(); return 1; },
    Date,
    JSON,
    console
  };

  const inline = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi), match => match[1]).join('\n');
  vm.runInNewContext(inline, context, { filename: 'runner/index.html' });

  ok(readyCalls.length === 1 && readyCalls[0].id === 'runner', 'page publishes one runner passport');
  ok(JSON.stringify(readyCalls[0].permissions) === '[]' && readyCalls[0].savesState === false, 'runtime passport remains zero-authority and stateless');
  ok(initCallbacks.length === 1, 'page registers one Hub initialization callback');
  initCallbacks[0]();
  ok(logs.includes('Verification Desk ready · read-only'), 'Hub initialization logs the read-only boundary');

  await elements.health.onclick();
  ok(requested.at(-1) === '/api/health' && elements.status.textContent === 'server healthy', 'health action reads only the declared health endpoint');
  ok(JSON.parse(elements.out.textContent).service === 'workshop', 'health response is displayed without mutation');

  await elements.report.onclick();
  ok(requested.at(-1) === '/exports/verify-report.txt', 'report action reads only the declared report export');
  ok(elements.out.textContent === reportResponse.body && /no command executed/.test(elements.status.textContent), 'existing report is labeled as read evidence, not a new run');

  reportResponse = { ok: false, body: '' };
  await elements.report.onclick();
  ok(elements.status.textContent === 'report unavailable' && /Run node verify\.js/.test(elements.out.textContent), 'missing report routes to manual run instructions');

  fetchFailure = new Error('selftest offline');
  await elements.health.onclick();
  ok(elements.status.textContent === 'health unavailable' && elements.out.textContent === 'selftest offline', 'health failure degrades visibly without a false success');
  fetchFailure = null;

  const fetchCountBeforeProposal = requested.length;
  elements.proposal.onclick();
  ok(requested.length === fetchCountBeforeProposal, 'proposal export performs no network request');
  ok(anchors.length === 1 && anchors[0].clicks === 1 && anchors[0].download === 'axm-verify-run-request.json', 'proposal export requires one explicit local download click');
  const proposal = JSON.parse(blobs[0].parts[0]);
  ok(proposal.schema === 'axm.run-request/v1' && proposal.task === 'verify', 'exported proposal has the declared request schema and task');
  ok(proposal.effect === 'proposal-only' && proposal.executed === false, 'exported proposal cannot be mistaken for execution evidence');
  ok(revoked.length === 1 && revoked[0] === 'blob:selftest', 'temporary proposal URL is revoked');

  elements.clear.onclick();
  ok(/^ready\b.*\bread-only$/.test(elements.status.textContent) && /Choose Health check/.test(elements.out.textContent), 'clear returns the desk to its read-only initial state');
}

exerciseActualPageHandlers().then(() => {
  console.log('PASS Verification Desk selftest: ' + checks + ' assertions; live server and report availability remain separate runtime checks');
}).catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
