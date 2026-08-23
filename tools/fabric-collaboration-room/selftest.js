#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Core = require('./collaboration-room-core');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const json = name => JSON.parse(read(name));
const manifest = json('manifest.json');
const contract = json('module.contract.json');
const schema = json('collaboration-decision-draft.schema.json');
const html = read('index.html');
const app = read('app.js');
const source = read('collaboration-room-core.js');
const css = read('styles.css');
let passed = 0;

function check(condition, message) {
  assert.ok(condition, message);
  passed += 1;
  console.log('PASS ' + message);
}
function rejects(fn, pattern, message) {
  assert.throws(fn, pattern);
  passed += 1;
  console.log('PASS ' + message);
}
function walk(value, visitor, pointer = '#') {
  if (!value || typeof value !== 'object') return;
  visitor(value, pointer);
  Object.keys(value).forEach(key => walk(value[key], visitor, pointer + '/' + key));
}

check(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product', 'manifest uses the current product contract');
check(manifest.id === 'fabric-collaboration-room' && manifest.version === 'v0.1', 'manifest binds the exact room identity');
check(manifest.status === 'TEST' && manifest.permissions.length === 0, 'room remains permissionless TEST');
check(contract.id === manifest.id && contract.version === manifest.version, 'module contract matches the manifest');
check(contract.permissions.length === 0, 'contract grants no permission');
check(contract.boundaries.writes.length === 1 && contract.boundaries.writes[0].startsWith('browser-memory:'), 'only ephemeral browser memory is declared');
check(contract.lifecycle.state_owner === 'browser' && contract.lifecycle.reload === 'reset' && contract.lifecycle.cleanup === 'automatic', 'lifecycle uses the Workshop verifier vocabulary');
[
  'live-presence-claim', 'provider-call', 'mirror-observation', 'workspace-read',
  'workspace-write', 'network-access', 'decision-authentication', 'identity-proof',
  'candidate-generation', 'candidate-execution', 'review-inbox-write',
  'automatic-installation', 'automatic-integration', 'automatic-promotion',
  'automatic-learning', 'automatic-canon-change'
].forEach(boundary => check(contract.boundaries.refuses.includes(boundary), 'contract refuses ' + boundary));

check(schema.$id === 'axm.collaboration-decision-draft/v1', 'decision draft schema has the exact public identity');
walk(schema, (node, pointer) => {
  if (node.type === 'object') assert.equal(node.additionalProperties, false, pointer + ' must be closed');
});
passed += 1;
console.log('PASS every typed schema object boundary is closed');
check(schema.properties.authority.const === 'NONE' && schema.properties.effect.const === 'NONE', 'schema fixes draft authority and effect to NONE');
check(schema.properties.authenticated.const === false && schema.properties.installed.const === false, 'schema cannot claim authentication or installation');
check(schema.properties.promoted.const === false && schema.properties.canonChanged.const === false, 'schema cannot claim promotion or CANON');

check(Core.COLLABORATORS.length === 7, 'seven separate collaborator roles are visible');
check(new Set(Core.COLLABORATORS.map(item => item.id)).size === 7, 'collaborator identities are unambiguous');
check(Core.COLLABORATORS.find(item => item.id === 'ai').state === 'OFF BY DEFAULT', 'AI remains visibly optional and off by default');
check(Core.COLLABORATORS.find(item => item.id === 'mirror').state.includes('LIVE UNKNOWN'), 'Mirror live state remains UNKNOWN');
check(Core.COLLABORATORS.find(item => item.id === 'mike').role.includes('final Workshop merge gate'), 'Mike remains the displayed merge gate');

const planA = Core.scenario('plan');
const planB = Core.scenario('plan');
check(JSON.stringify(planA) === JSON.stringify(planB), 'scenario output is deterministic');
planA.active.push('forged');
check(!Core.scenario('plan').active.includes('forged'), 'scenario callers cannot mutate retained declarations');
check(Core.scenario('trial').state === 'CONTRACT GAP', 'candidate trial keeps its missing contract visible');
check(Core.scenario('install').state === 'LOCKED', 'installation route remains visibly locked');
rejects(() => Core.scenario('automatic'), /unsupported/, 'unknown scenarios cannot invent a route');

const base = {
  goal: 'Inspect one exact candidate before any bounded trial.',
  decision: 'HOLD', candidateDigest: '', note: '', acknowledgement: false
};
const hold = Core.buildDecisionDraft(base);
check(Core.validateDecisionDraft(hold), 'a HOLD draft validates by exact deterministic rebuild');
check(hold.status === 'UNAUTHENTICATED_DRAFT' && hold.authority === 'NONE' && hold.effect === 'NONE', 'HOLD draft has no authentication authority or effect');
check(hold.candidateDigest === null && hold.nextGate === 'PROPOSAL_OR_EVIDENCE_MUST_CHANGE', 'HOLD needs no invented candidate and requires changed evidence');

const repair = Core.buildDecisionDraft({ ...base, decision: 'ASK_REPAIR', note: 'Clarify the missing evidence.' });
check(Core.validateDecisionDraft(repair) && repair.consentTier === 'TIER_1_REPAIR_REQUEST', 'repair remains a bounded new-request draft');
const digest = 'sha256:' + 'a'.repeat(64);
const trial = Core.buildDecisionDraft({ ...base, decision: 'PREPARE_SANDBOX_TRIAL', candidateDigest: digest, acknowledgement: true });
check(Core.validateDecisionDraft(trial), 'exact candidate trial draft validates');
check(trial.candidateDigest === digest && trial.consentTier === 'TIER_2_SANDBOX_TRIAL', 'trial draft binds exact candidate digest and tier');
check(trial.nextGate === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED', 'trial preparation cannot impersonate authenticated consent');
check(!trial.installed && !trial.integrated && !trial.promoted && !trial.canonChanged, 'trial draft grants no lifecycle effect');

rejects(() => Core.buildDecisionDraft({ ...base, decision: 'PREPARE_SANDBOX_TRIAL', acknowledgement: true }), /exact candidate digest/, 'trial without exact candidate bytes fails closed');
rejects(() => Core.buildDecisionDraft({ ...base, decision: 'PREPARE_SANDBOX_TRIAL', candidateDigest: digest }), /acknowledgement/, 'trial without draft-only acknowledgement fails closed');
rejects(() => Core.buildDecisionDraft({ ...base, candidateDigest: 'sha256:' + 'A'.repeat(64) }), /exact sha256/, 'noncanonical digest fails closed');
rejects(() => Core.buildDecisionDraft({ ...base, decision: 'APPROVE' }), /unsupported/, 'approval cannot be smuggled into the draft contract');
rejects(() => Core.buildDecisionDraft({ ...base, authority: 'INSTALL' }), /fields are not exact/, 'unknown input cannot smuggle authority');
rejects(() => Core.buildDecisionDraft({ ...base, goal: '   ' }), /outside its text boundary/, 'empty goal cannot produce a draft');
rejects(() => Core.buildDecisionDraft({ ...base, note: 'bad\ncontrol' }), /outside its text boundary/, 'control characters cannot enter a draft');

const forged = { ...trial, authenticated: true };
rejects(() => Core.validateDecisionDraft(forged), /truth or ordering drifted/, 're-shaped draft cannot claim authentication');
const installed = { ...trial, installed: true };
rejects(() => Core.validateDecisionDraft(installed), /truth or ordering drifted/, 're-shaped draft cannot claim installation');
const extra = { ...trial, signature: 'self-issued' };
rejects(() => Core.validateDecisionDraft(extra), /fields are not exact/, 'extra output cannot smuggle a signature');

check(html.includes('id="constellation"') && html.includes('id="actors"'), 'HTML exposes the collaboration constellation');
check(html.includes('Mike remains merge gate') && html.includes('Visualization is not presence. A draft is not authority.'), 'human and truth boundaries are visible');
check(html.includes('../review-inbox/index.html'), 'room routes exact decisions to the existing Review Inbox');
check((html.match(/data-scenario=/g) || []).length === 3 && (html.match(/data-decision=/g) || []).length === 3, 'all scenarios and draft choices are explicit controls');
check(html.includes('role="status"') && html.includes('aria-live="polite"'), 'draft feedback is exposed to assistive technology');
check(css.includes('@media (max-width: 820px)') && css.includes('@media (max-width: 520px)'), 'layout declares tablet and narrow viewport adaptations');
check(css.includes('@media (prefers-reduced-motion: reduce)'), 'motion honors reduced-motion preference');
const networkSurface = html + css + app.replace('http://www.w3.org/2000/svg', 'svg-namespace');
check(!/https?:\/\//.test(networkSurface), 'room loads no external asset or network URL');
check(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage)\b/.test(app + source), 'room exposes no network or durable browser-storage hand');
check(!/\b(eval|Function|Worker|SharedWorker)\b/.test(app + source), 'room exposes no dynamic-code or worker hand');
check(!/\.innerHTML\s*=/.test(app), 'dynamic UI content uses node creation and textContent');
new Function(source);
new Function(app);
passed += 1;
console.log('PASS browser JavaScript parses');

console.log('Fabric Collaboration Room selftest: PASS (' + passed + ' checks)');
