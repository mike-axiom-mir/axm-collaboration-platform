'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Accessibility = require('../../scripts/accessibility-static-audit');
const Registry = require('../agent-command-center/identity-registry');

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
ok(JSON.stringify(manifest.permissions) === '[]' && JSON.stringify(contract.permissions) === '[]', 'Duo requests no Hub permission token');
ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates against the manifest');
ok(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'reset', 'transcript is session-only and resets on reload');
[
  'cross-identity-private-memory-transfer',
  'identity-route-bypass',
  'connector-or-model-lock-bypass',
  'automatic-wisdom-promotion',
  'automatic-background-dispatch',
  'external-network-access-outside-loopback-model-discovery',
  'automatic-workshop-status-promotion',
  'canon-authority'
].forEach(boundary => ok(contract.boundaries.refuses.includes(boundary), 'contract refuses ' + boundary));

const urls = Array.from(html.matchAll(/https?:\/\/[^'"\s<]+/g), match => match[0]);
ok(JSON.stringify(urls) === JSON.stringify(['http://127.0.0.1:8787/local-models']), 'only the declared loopback discovery URL is embedded');
ok(!/AXMIdentityRegistry\.(?:remember|memories|context)\s*\(/.test(html), 'page performs no direct identity-memory read or write');
ok(!/\b(?:localStorage|sessionStorage|AXM\.store\.(?:save|remove))\b/.test(html), 'page persists no transcript or prompt state');
ok(!/\b(?:setInterval|WebSocket|EventSource|child_process)\b/.test(html), 'page contains no background loop, socket, or process primitive');
ok(/Promise\.all\(\[ask\('nova',p\),ask\('gemini-local',p\)\]\)/.test(html), 'independent mode sends the same visible prompt to both identities');
ok(/Nova answered:/.test(html) && /Independently review Nova/.test(html), 'relay instruction is visibly attributed and requests independent review');
for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  new Function(match[1]);
  checks += 1;
}
ok(Accessibility.auditHtml(path.join(ROOT, 'index.html')).length === 0, 'static accessibility audit has zero definite findings');

const memory = {};
Registry.configure({
  storage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
    setItem(key, value) { memory[key] = String(value); },
    removeItem(key) { delete memory[key]; }
  }
}).reset();
const privateFixture = Registry.remember('nova', {
  text: 'SELFTEST_PRIVATE_NOVA_ONLY',
  source: 'synthetic selftest',
  evidence: ['direct synthetic fixture'],
  confidence: 'high'
});
ok(privateFixture.scope === 'private', 'adjacent registry stores the synthetic Nova fixture as private');
ok(!Registry.memories('gemini-local', { includeShared: false }).some(item => item.text === privateFixture.text), 'Gemini private memory excludes the Nova fixture');
ok(Registry.binding('nova').model === 'axm-llama-3.1-8b' && Registry.binding('gemini-local').model === 'gemini-local', 'adjacent registry exposes distinct model locks');
let routeRefusal = null;
try { Registry.assertModel('nova', 'gemini-local'); } catch (error) { routeRefusal = error; }
ok(routeRefusal && /model route blocked/.test(routeRefusal.message), 'adjacent registry rejects a cross-identity model route');

async function createPage(models, discoveryFailure) {
  const elements = {};
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    elements[match[1]] = {
      id: match[1],
      value: '',
      textContent: '',
      innerHTML: '',
      disabled: false,
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      prepend(child) { this.children.unshift(child); return child; }
    };
  }

  const calls = [];
  const alerts = [];
  const fetches = [];
  const responses = [];
  const bindings = {
    nova: { model: 'axm-llama-3.1-8b', connector: 'local' },
    'gemini-local': { model: 'gemini-local', connector: 'local' }
  };
  const document = {
    getElementById(id) { return elements[id]; },
    createElement(tag) {
      return {
        tag,
        className: '',
        textContent: '',
        children: [],
        appendChild(child) { this.children.push(child); return child; }
      };
    },
    createTextNode(text) { return { textContent: String(text) }; }
  };
  const context = {
    document,
    AXM: { init: async () => ({ storageBackend: 'selftest-memory' }) },
    AXMIdentityRegistry: {
      binding(id) { return bindings[id]; },
      connectorFor(id) { return bindings[id].connector; },
      async ask(identityId, prompt, options) {
        calls.push({ identityId, prompt, options: Object.assign({}, options) });
        if (identityId === 'nova' && options.model && options.model !== bindings.nova.model) {
          throw new Error('identity model route blocked: nova');
        }
        const next = responses.length ? responses.shift() : identityId + ' selftest reply';
        if (next instanceof Error) throw next;
        return { text: next, raw: { provider: 'selftest-local' } };
      }
    },
    fetch: async target => {
      fetches.push(target);
      if (discoveryFailure) throw discoveryFailure;
      return { ok: true, json: async () => ({ data: models.map(id => ({ id })) }) };
    },
    alert(message) { alerts.push(message); },
    Date,
    Promise,
    JSON,
    console
  };

  const inline = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi), match => match[1]).join('\n');
  vm.runInNewContext(inline, context, { filename: 'duo-test/index.html' });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return { elements, calls, alerts, fetches, responses };
}

async function exerciseActualPageHandlers() {
  const page = await createPage(['gemini-local', 'axm-llama-3.1-8b']);
  const { elements, calls, alerts, fetches, responses } = page;
  ok(fetches.length === 1 && fetches[0] === 'http://127.0.0.1:8787/local-models', 'boot performs one loopback-only discovery read');
  ok(elements.askNova.disabled === false && elements.askGemini.disabled === false, 'reversed discovery order still recognizes both bound models');
  ok(elements.askBoth.disabled === false && elements.relay.disabled === false, 'dual actions enable only when both bound models are available');
  ok(/Nova: online/.test(elements.boot.innerHTML) && /Gemini Local: online/.test(elements.boot.innerHTML), 'boot reports both identity-bound models online');

  elements.prompt.value = 'Inspect the visible task.';
  responses.push('Nova visible answer');
  await elements.askNova.onclick();
  ok(calls.length === 1 && calls[0].identityId === 'nova', 'Ask Nova routes to the Nova identity');
  ok(calls[0].prompt === 'Inspect the visible task.' && calls[0].options.temperature === 0, 'Nova receives the visible prompt with deterministic sampling');
  ok(!calls[0].options.model || calls[0].options.model === 'axm-llama-3.1-8b', 'Nova never receives a model selected by discovery order');

  responses.push('Nova independent answer', 'Gemini independent answer');
  await elements.askBoth.onclick();
  const independent = calls.slice(-2);
  ok(independent[0].identityId === 'nova' && independent[1].identityId === 'gemini-local', 'Ask both routes once to each distinct identity');
  ok(independent.every(call => call.prompt === 'Inspect the visible task.'), 'independent route gives both identities the same visible prompt');

  elements.prompt.value = 'Review this task.';
  responses.push('Nova relay-visible answer', 'Gemini review answer');
  await elements.relay.onclick();
  const relay = calls.slice(-2);
  ok(relay[0].identityId === 'nova' && relay[0].prompt === 'Review this task.', 'relay begins with the visible task routed to Nova');
  ok(relay[1].identityId === 'gemini-local' && relay[1].prompt.includes('Nova relay-visible answer'), 'relay sends only Nova\'s visible answer to Gemini');
  ok(!relay[1].prompt.includes(privateFixture.text), 'relay excludes the synthetic private-memory sentinel');

  responses.push(new Error('selftest connector unavailable'));
  await elements.askGemini.onclick();
  ok(String(elements.errors.textContent) === '1' && elements.feed.children[0].children[0].textContent === 'err', 'connector failure increments the visible error count and attribution');

  const callsBeforeEmpty = calls.length;
  elements.prompt.value = '   ';
  await elements.askNova.onclick();
  ok(calls.length === callsBeforeEmpty && alerts.length === 1, 'blank prompt is refused before identity dispatch');

  const novaOnly = await createPage(['axm-llama-3.1-8b']);
  ok(novaOnly.elements.askNova.disabled === false && novaOnly.elements.askGemini.disabled === true, 'missing Gemini disables only the Gemini-specific action');
  ok(novaOnly.elements.askBoth.disabled === true && novaOnly.elements.relay.disabled === true, 'missing one model disables both dual-identity actions');

  const offline = await createPage([], new Error('selftest bridge offline'));
  ok(offline.elements.askNova.disabled === true && offline.elements.askGemini.disabled === true, 'discovery failure disables both single-identity actions');
  ok(offline.elements.askBoth.disabled === true && offline.elements.relay.disabled === true, 'discovery failure disables both dual-identity actions');
}

exerciseActualPageHandlers().then(() => {
  console.log('PASS Supervised Local Duo selftest: ' + checks + ' assertions; real local-model responses and visual usability remain separate live checks');
}).catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
