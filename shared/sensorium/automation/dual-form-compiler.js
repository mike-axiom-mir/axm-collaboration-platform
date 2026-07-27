'use strict';

const fs = require('fs');
const path = require('path');
const C = require('../core');
const Inventory = require('./inventory-compiler');
const ROOT = Inventory.ROOT;
const PACK_ROOT = path.join(ROOT, 'tools', 'agent-tool-forge', 'skills', 'sensorium');

function definition(source, skill) {
  return {
    schema: 'axm.sensorium-skill/v1', id: skill.id, type: 'skill', sense: skill.sense, pack: 'axm-sensorium/' + source.version,
    status: skill.skillStatus, capability: skill.capabilityId + '/' + skill.capabilityVersion, purpose: skill.oneLine,
    inputs: skill.inputs, procedure: skill.procedure, rules: ['Perception is not permission.', 'UNKNOWN is preferred to a plausible guess.', 'Every use emits a typed receipt and releases raw material.'],
    boundaries: skill.boundaries, retention: source.retention,
    receipt: { schema: skill.specificReceiptSchema, envelopeSchema: 'axm.sensorium-receipt/v1' },
    runtime: { routeType: skill.routeType, module: skill.module, factory: skill.factory || null, operation: skill.operation },
    statuses: { skillStatus: skill.skillStatus, executorStatus: skill.executorStatus, adapterStatus: skill.adapterStatus, proofStatus: skill.proofStatus, authorityStatus: skill.authorityStatus },
    requiredHostCapabilities: skill.requiredHostCapabilities, constraints: skill.constraints, resourceBudget: skill.resourceBudget,
    authorityInherited: false, promotionGate: source.promotionGate
  };
}
function markdown(source, skill) {
  const d = definition(source, skill);
  function list(items) { return items.map(function (item) { return '- ' + item; }).join('\n'); }
  return [
    '---', 'name: ' + d.id, 'sense: ' + d.sense, 'status: ' + d.status, 'pack: ' + d.pack, 'capability: ' + d.capability, '---', '',
    '# ' + skill.displayName, '', skill.oneLine, '', '## Inputs', '', list(skill.inputs), '', '## Procedure', '', skill.procedure.map(function (item, index) { return (index + 1) + '. ' + item; }).join('\n'), '',
    '## Boundaries', '', list(skill.boundaries), '', '## Release before the next step', '',
    '**Ephemeral by default.** ' + source.retention.law, '',
    '- Raw material: ' + source.retention.raw_material,
    '- Release boundary: ' + source.retention.released_when,
    '- Survives: ' + source.retention.survives,
    '- Raw retained after step: ' + source.retention.raw_retained_after_step,
    '- Accumulation across uses: ' + source.retention.accumulation_across_uses,
    '- Receipt cap: ' + source.retention.receipt_cap,
    '- Deletion scope: ' + source.retention.deletion_scope, '',
    '## Runtime contract', '',
    '- Route: `' + skill.routeType + '`', '- Module: `' + skill.module + '`', '- Specific receipt: `' + skill.specificReceiptSchema + '`', '- Common envelope: `axm.sensorium-receipt/v1`',
    '- Authority inherited: `false`', '- Promotion gate: `' + source.promotionGate + '`', '',
    '## Current separate statuses', '',
    '- Skill: `' + skill.skillStatus + '`', '- Executor: `' + skill.executorStatus + '`', '- Adapter: `' + skill.adapterStatus + '`', '- Proof: `' + skill.proofStatus + '`', '- Authority: `' + skill.authorityStatus + '`', ''
  ].join('\n');
}
function index(source) {
  const executable = source.skills.filter(function (skill) { return skill.executorStatus === 'EXECUTABLE'; }).length;
  const mediated = source.skills.filter(function (skill) { return skill.executorStatus === 'HOST_MEDIATED'; }).length;
  return {
    schema: 'axm.skill-pack/v1', pack: 'axm-sensorium', version: source.version, status: source.status, generatedFrom: 'shared/sensorium/canonical/sensorium.json', sourceDigest: C.digest(source),
    purpose: source.skills.length + ' bounded senses for human and AI collaborators. None grants permission.', dual_form: 'Generated Workshop JSON and portable Markdown share one canonical source.',
    skills: source.skills.map(function (skill) { return { id: skill.id, sense: skill.sense, status: skill.skillStatus, executorStatus: skill.executorStatus, proofStatus: skill.proofStatus, one_line: skill.oneLine }; }),
    retention_law: source.retention, routeCounts: { executable, hostMediated: mediated }, shared_ceilings: ['No authority inheritance.','No raw sense material after seal.','No automatic action or promotion.','UNKNOWN remains visible.'], promotionGate: source.promotionGate
  };
}
function packReadme(source) {
  const executable = source.skills.filter(function (skill) { return skill.executorStatus === 'EXECUTABLE'; }).length;
  const mediated = source.skills.filter(function (skill) { return skill.executorStatus === 'HOST_MEDIATED'; }).length;
  const rows = source.skills.map(function (skill) { return '| `' + skill.id + '` | ' + skill.sense + ' | ' + skill.executorStatus + ' | ' + skill.proofStatus + ' |'; }).join('\n');
  return ['# AXM Sensorium - generated portable skill pack', '', 'Version: **' + source.version + '**  ', 'Status: **' + source.status + '**  ', 'Source: `shared/sensorium/canonical/sensorium.json`', '', source.skills.length + ' senses; ' + executable + ' executable routes and ' + mediated + ' honest host-mediated route. Perception never grants permission.', '', '| Skill | Sense | Executor | Proof |', '|---|---|---|---|', rows, '', 'Every `.skill.json`, `.SKILL.md`, index, host metadata, and bundle manifest is generated. Run the parity guard before release.', '', 'Raw sense material is ephemeral by default and must be zero after every seal.', ''].join('\n');
}
function handoff(source) {
  const executable = source.skills.filter(function (skill) { return skill.executorStatus === 'EXECUTABLE'; }).length;
  const mediated = source.skills.filter(function (skill) { return skill.executorStatus === 'HOST_MEDIATED'; }).length;
  return ['# Generated Sensorium builder handoff', '', 'Schema: `axm.sensorium-generated-handoff/v1`  ', 'Version: `' + source.version + '`  ', 'Source digest: `' + C.digest(source) + '`', '',
    '## Verified state', '', '- ' + source.skills.length + ' canonical TEST skills.', '- ' + executable + ' executable runtime routes.', '- ' + mediated + ' honest host-mediated static-image route.', '- Common receipt envelope and composition coordinator.', '- Registry-driven positive, negative, and two-use zero-retention proofs.', '- Deterministic automation, Lab discovery, release packages, and Body Pulse guard.', '',
    '## Remaining holds', '', '- `WINDOWS_WINDOW_ISOLATION_UNAVAILABLE` remains visible; Windows capture cannot claim exact named-window isolation.', '- `SEAT_CAPACITY_ADAPTER_UNAVAILABLE` remains visible; Interoception has contract proof but no installed host metric adapter.', '',
    '## Closed visual adapter gap', '', '- Eye 4 now has a bounded exact-target browser computed-style adapter. It retains no content or pixels and returns UNKNOWN for incomplete coverage, gradients, background images, transparency, and ancestor opacity.', '',
    '## Authority', '', '- No authority is inherited.', '- This handoff grants no capture, write, install, publish, delete, promotion, or canon authority.', '- Mike remains the promotion gate.', '',
    '## Resume', '', '1. Run `node shared/sensorium/selftest.js`.', '2. Read `shared/sensorium/roadmap-status.json` and `exports/sensorium-roadmap-acceptance.json`.', '3. Regenerate with `node shared/sensorium/automation/build.js`; parity must remain byte-identical.', '4. Treat novel failures and capabilities as visible holds, never silent repair.', ''].join('\n');
}
function render(source) {
  source = source || Inventory.readSource();
  const checked = Inventory.validate(source); if (!checked.ok) throw new Error(checked.errors.join('; '));
  const outputs = {};
  source.skills.forEach(function (skill) {
    outputs[path.join(PACK_ROOT, skill.id + '.skill.json')] = JSON.stringify(definition(source, skill), null, 2) + '\n';
    outputs[path.join(PACK_ROOT, skill.id + '.SKILL.md')] = markdown(source, skill);
  });
  outputs[path.join(PACK_ROOT, 'sensorium.index.json')] = JSON.stringify(index(source), null, 2) + '\n';
  outputs[path.join(PACK_ROOT, 'host-metadata.json')] = JSON.stringify({ schema: 'axm.sensorium-host-metadata/v1', version: source.version, capabilities: source.skills.map(function (skill) { return { id: skill.id, capability: skill.capabilityId + '/' + skill.capabilityVersion, routeType: skill.routeType, requiredHostCapabilities: skill.requiredHostCapabilities, constraints: skill.constraints }; }) }, null, 2) + '\n';
  outputs[path.join(PACK_ROOT, 'bundle.manifest.json')] = JSON.stringify({ schema: 'axm.sensorium-bundle-manifest/v1', version: source.version, sourceDigest: C.digest(source), generatedArtifacts: source.skills.flatMap(function (skill) { return [skill.id + '.skill.json', skill.id + '.SKILL.md']; }).concat(['sensorium.index.json','host-metadata.json','bundle.manifest.json','README.md','HANDOFF_TO_CODEX.md']), publicSafety: { localPaths: false, rawCaptures: false, receipts: false, tokens: false, machineState: false } }, null, 2) + '\n';
  outputs[path.join(PACK_ROOT, 'README.md')] = packReadme(source);
  outputs[path.join(PACK_ROOT, 'HANDOFF_TO_CODEX.md')] = handoff(source);
  return outputs;
}
function write(outputs) { Object.keys(outputs).forEach(function (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, outputs[file], 'utf8'); }); }
if (require.main === module) {
  try { const outputs = render(); write(outputs); console.log('Sensorium dual-form compiler: PASS - ' + Object.keys(outputs).length + ' artifacts'); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { ROOT, PACK_ROOT, definition, markdown, index, packReadme, handoff, render, write };
