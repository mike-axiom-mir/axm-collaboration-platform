'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Accessibility = require('../../scripts/accessibility-static-audit');
const Core = require('./reasoning-shell-core');

const ROOT = __dirname;
let checks = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); checks += 1; }
function throws(fn, pattern, label) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  ok(error && pattern.test(error.message), label);
}
function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function json(name) { return JSON.parse(read(name)); }

const manifest = json('manifest.json');
const contract = json('module.contract.json');
const profiles = json('profiles.json');
const html = read('index.html');

ok(manifest.schema === ContractVerifier.MANIFEST_SCHEMA && manifest.kind === 'product', 'modern product manifest declared');
ok(manifest.contract === 'module.contract.json', 'manifest explicitly declares contract');
ok(manifest.permissions.includes('storage') && manifest.permissions.includes('ai') && manifest.permissions.includes('gate') && manifest.permissions.includes('files') && manifest.permissions.includes('export'), 'all runtime authorities are explicit');
ok(ContractVerifier.validateContract(contract, manifest).pass, 'contract validates against modern manifest');
ok(contract.boundaries.refuses.includes('automatic-tweak-application') && contract.boundaries.refuses.includes('gate-denial-bypass'), 'contract refuses auto-apply and gate bypass');
ok(contract.lifecycle.reload === 'reset' && contract.lifecycle.disconnect === 'graceful-degrade', 'lifecycle declares reset and manual degrade');

ok(profiles.format === 1 && Object.keys(profiles.profiles).length === 7, 'format:1 catalog has seven profiles');
const profileRows = Object.values(profiles.profiles);
ok(profileRows.filter(profile => profile.placeholder === false).length === 1, 'exactly one profile is labeled non-placeholder');
ok(profileRows.filter(profile => profile.placeholder === true).length === 6, 'six profiles remain visibly placeholder');
ok(profileRows.every(profile => profile.name && Array.isArray(profile.weaknessesTargeted) && profile.systemFrame && profile.stepRule && Array.isArray(profile.proofLabels) && profile.proofLabels.length), 'every profile is schema-complete');

const profile = profiles.profiles['small-local-model'];
const on = Core.createSession('small-local-model', 'shell-on', 'Verify one claim.', 1000);
const off = Core.createSession('small-local-model', 'shell-off', 'Verify one claim.', 2000);
ok(on.format === 1 && on.task === 'Verify one claim.' && on.startedTs === 1000, 'session creation is deterministic with supplied timestamp');
throws(() => Core.createSession('small-local-model', 'unknown', 'task', 1), /condition/, 'unsupported condition refused');
throws(() => Core.createSession('small-local-model', 'shell-on', '   ', 1), /task/, 'empty task refused');

on.steps.push({ summary: 'Read source' });
on.repairContext = 'The first claim lacked a test.';
const onPrompt = Core.buildStepPrompt(on, profile);
const offPrompt = Core.buildStepPrompt(off, profile);
ok(onPrompt.includes(profile.systemFrame) && onPrompt.includes(profile.stepRule), 'shell-on prompt includes selected profile frame and rule');
ok(onPrompt.includes('REPAIR CONTEXT') && onPrompt.includes('Read source'), 'shell-on prompt includes repair context and prior accepted step');
ok(!offPrompt.includes(profile.systemFrame) && !offPrompt.includes(profile.stepRule), 'shell-off prompt excludes profile frame and rule');
ok(!offPrompt.includes('REPAIR CONTEXT'), 'shell-off prompt excludes repair context');
throws(() => Core.buildStepPrompt(Core.createSession('missing', 'shell-on', 'task', 1), null), /profile/, 'shell-on prompt refuses missing profile');

const labeled = Core.makeCheckpoint('CLAIM: It works | PROOF: ran | UNCERTAINTY: low', 2, 'ok', 3000);
ok(labeled.claim === 'It works' && labeled.proofLabel === 'ran' && labeled.uncertainty === 'low' && labeled.ts === 3000, 'checkpoint parses labeled fields');
const unlabeled = Core.makeCheckpoint('plain response', 1, 'rejected', 3001);
ok(unlabeled.proofLabel === 'unlabeled' && unlabeled.uncertainty === 'unlabeled', 'missing labels stay explicit');
throws(() => Core.makeCheckpoint('x', 1, 'maybe', 1), /verdict/, 'unsupported checkpoint verdict refused');

const route = Core.makeRepairRoute('bad answer', 1, '  Missing proof.  ');
ok(Core.validRoute(route) && route.rejected[0].rejection_reason === 'Missing proof.', 'repair route trims and preserves non-empty reason');
ok(!Core.validRoute({ step: 1, rejected: [] }), 'empty rejection list is invalid');
ok(!Core.validRoute({ step: 1, rejected: [{ rejection_reason: '   ' }] }), 'blank rejection reason is invalid');
throws(() => Core.makeRepairRoute('bad', 1, '   '), /rejection_reason/, 'repair builder fails closed on blank reason');

on.checkpoints.push(labeled, unlabeled);
on.routes.push(route);
const afterAction = Core.buildAfterAction(on);
ok(afterAction.tweakProposal && afterAction.tweakProposal.status === 'proposal', 'repair creates proposal-only tweak');
ok(afterAction.fakeDoneSuspected === true && afterAction.repairs[0] === 'Missing proof.', 'after-action reports unlabeled proof and repair evidence');
const cleanAfterAction = Core.buildAfterAction(off);
ok(cleanAfterAction.tweakProposal === null && cleanAfterAction.contextLossSuspected === false, 'no repair creates no tweak proposal');

const onMetrics = Core.sessionMetrics({ format: 1, session: on });
ok(onMetrics.condition === 'shell-on' && onMetrics.accepted === 1 && onMetrics.repairs === 1 && onMetrics.unlabeled === 1, 'session metrics count recorded facts only');
const comparison = Core.compareExports({ format: 1, session: on }, { format: 1, session: off });
ok(/Recorded comparison only/.test(comparison) && /shell-on/.test(comparison) && /shell-off/.test(comparison), 'paired comparison remains count-only');
throws(() => Core.compareExports({ format: 1, session: off }, { format: 1, session: on }), /first export/, 'swapped comparison conditions refused');
throws(() => Core.sessionMetrics({ format: 1, session: { format: 1, condition: 'shell-on', steps: [], checkpoints: [], routes: [{ rejected: [] }] } }), /invalid rejection route/, 'metrics refuse invalid embedded route');

['shell.session.start', 'shell.step', 'shell.checkpoint', 'shell.after-action', 'shell.tweak.propose', 'shell.session.export'].forEach(action => {
  ok(html.includes("allow('" + action + "'"), action + ' is wired through the deny-honoring helper');
});
ok(/function allow\([\s\S]*?if\(verdict\.allow\) return true;[\s\S]*?return false;/.test(html), 'gate helper returns false on denial');
ok(html.includes("status:'proposal'") && html.includes('rejection_reason'), 'top-level locked verifier literals remain present');
ok(/reasoning-shell-core\.js/.test(html) && /AXMReasoningShell/.test(html), 'page loads and uses the deterministic core');
ok(/URL\.revokeObjectURL/.test(html), 'explicit export revokes temporary object URL');
ok(!/https?:\/\//.test(html), 'page declares no direct external network URL');
for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) { new Function(match[1]); checks += 1; }
const findings = Accessibility.auditHtml(path.join(ROOT, 'index.html'));
ok(findings.length === 0, 'static accessibility audit has zero definite findings');

async function exerciseActualPageHandlers() {
  const elements = {};
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    elements[match[1]] = {
      id: match[1], value: '', disabled: false, files: [], textContent: '', innerHTML: '', children: [],
      appendChild(child) { this.children.push(child); if (this.id === 'profileSel' && !this.value) this.value = child.value; return child; },
      prepend(child) { this.children.unshift(child); return child; },
      click() { this.clicks = Number(this.clicks || 0) + 1; }
    };
  }
  ['stepBtn', 'ckOkBtn', 'ckBadBtn', 'aarBtn', 'expBtn'].forEach(id => { elements[id].disabled = true; });

  const gateDecisions = Object.create(null), gateCalls = [];
  let saveFailure = null, saveAttempts = 0;
  const saved = [];
  const urlCalls = { created: 0, revoked: 0 };
  const document = {
    getElementById(id) { return elements[id]; },
    createElement(tag) {
      return { tag, value: '', textContent: '', className: '', children: [], appendChild(child) { this.children.push(child); }, click() { this.clicks = Number(this.clicks || 0) + 1; } };
    },
    createTextNode(text) { return { textContent: String(text) }; }
  };
  const context = {
    window: { AXMReasoningShell: Core },
    document,
    AXMGate: {
      submit(request) {
        gateCalls.push(request);
        const allowed = gateDecisions[request.action] !== false;
        return { allow: allowed, reason: allowed ? 'selftest allow' : 'selftest deny' };
      }
    },
    AXM: {
      init: async () => ({ storageBackend: 'selftest-memory' }),
      wisdom: { on() {} },
      ask: async () => ({ text: 'CLAIM: Test step | PROOF: ran | UNCERTAINTY: low' }),
      store: {
        async save(key, value) {
          saveAttempts += 1;
          if (saveFailure) throw saveFailure;
          saved.push({ key, value });
        }
      }
    },
    localStorage: { getItem() { return 'false'; } },
    fetch: async resource => {
      ok(resource === 'profiles.json', 'page handler fetch remains same-origin profile catalog');
      return { json: async () => profiles };
    },
    Blob: class Blob { constructor(parts, options) { this.parts = parts; this.options = options; } },
    URL: {
      createObjectURL() { urlCalls.created += 1; return 'blob:selftest'; },
      revokeObjectURL(value) { if (value === 'blob:selftest') urlCalls.revoked += 1; }
    },
    alert() {},
    prompt() { return 'Missing proof.'; },
    setTimeout(fn) { fn(); return 1; },
    console,
    Date,
    Promise,
    JSON
  };

  const inlineScripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi), match => match[1]);
  vm.runInNewContext(inlineScripts.join('\n'), context, { filename: 'reasoning-shell/index.html' });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  ok(/ready/.test(elements.boot.textContent) && elements.profileSel.value === 'small-local-model', 'actual page handler boot loads profiles');

  elements.task.value = 'Exercise the gate.';
  elements.conditionSel.value = 'shell-on';
  gateDecisions['shell.session.start'] = false;
  elements.startBtn.onclick();
  ok(elements.stepBtn.disabled === true, 'denied session start leaves step action disabled');

  gateDecisions['shell.session.start'] = true;
  elements.startBtn.onclick();
  ok(elements.stepBtn.disabled === false, 'allowed session start enables one-step action');

  gateDecisions['shell.step'] = true;
  await elements.stepBtn.onclick();
  ok(elements.ckBadBtn.disabled === false, 'allowed model step opens human checkpoint');

  gateDecisions['shell.checkpoint'] = false;
  elements.ckBadBtn.onclick();
  ok(elements.stepCount.textContent === '', 'denied checkpoint records no accepted step or repair');

  gateDecisions['shell.checkpoint'] = true;
  elements.ckBadBtn.onclick();
  ok(/0 accepted/.test(elements.stepCount.textContent) && /1 repairs/.test(elements.stepCount.textContent), 'allowed rejection records exactly one repair');

  gateDecisions['shell.after-action'] = false;
  await elements.aarBtn.onclick();
  ok(saveAttempts === 0 && elements.expBtn.disabled === true, 'denied after-action performs no save and enables no export');

  gateDecisions['shell.after-action'] = true;
  gateDecisions['shell.tweak.propose'] = false;
  saveFailure = new Error('selftest storage failure');
  await elements.aarBtn.onclick();
  ok(saveAttempts === 1 && saved.length === 0 && elements.expBtn.disabled === true, 'failed save remains fail-closed for export');

  saveFailure = null;
  await elements.aarBtn.onclick();
  ok(saved.length === 1 && saved[0].value.session.afterAction.tweakProposal === null, 'denied tweak is removed before successful session persistence');
  ok(elements.expBtn.disabled === false, 'successful explicit save enables export');

  gateDecisions['shell.session.export'] = false;
  elements.expBtn.onclick();
  ok(urlCalls.created === 0, 'denied export creates no blob URL');
  gateDecisions['shell.session.export'] = true;
  elements.expBtn.onclick();
  ok(urlCalls.created === 1 && urlCalls.revoked === 1, 'allowed export creates and revokes one blob URL');

  const attempted = new Set(gateCalls.map(call => call.action));
  ['shell.session.start', 'shell.step', 'shell.checkpoint', 'shell.after-action', 'shell.tweak.propose', 'shell.session.export'].forEach(action => {
    ok(attempted.has(action), 'actual page handler submitted ' + action);
  });
}

exerciseActualPageHandlers().then(() => {
  console.log('PASS Reasoning Shell selftest: ' + checks + ' assertions; real-model effectiveness UNKNOWN');
}).catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
