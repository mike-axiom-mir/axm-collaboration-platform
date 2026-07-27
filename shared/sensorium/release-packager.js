'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./core');
const Dual = require('./automation/dual-form-compiler');
const Inventory = require('./automation/inventory-compiler');
const Zip = require('../../tools/agent-tool-forge/zip-store');

const ROOT = Inventory.ROOT;
const RELEASE_ROOT = path.join(ROOT, 'exports', 'sensorium-release');
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function safeOutput(output) {
  const resolved = path.resolve(output), relative = path.relative(RELEASE_ROOT, resolved);
  if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('release output must stay inside exports/sensorium-release');
  return resolved;
}
function publicSafety(files) {
  const findings = [];
  Object.keys(files).forEach(function (name) {
    const text = String(files[name]);
    if (/[A-Za-z]:\\(?:Users|Documents|AppData)\\/i.test(text) || /\/(?:Users|home)\/[\w.-]+\//.test(text)) findings.push({ file: name, kind: 'local-path' });
    if (/data:(?:image|audio|video)\//i.test(text)) findings.push({ file: name, kind: 'raw-capture' });
    if (/\b(?:sk-[A-Za-z0-9_-]{12,}|password\s*[:=]\s*\S+)/i.test(text)) findings.push({ file: name, kind: 'secret-or-token' });
    if (/state[\\/]body-pulse|rawRetainedBytesAfterSeal\"\s*:\s*[1-9]/i.test(text)) findings.push({ file: name, kind: 'machine-state-or-raw-retention' });
  });
  return { schema: 'axm.sensorium-public-safety-report/v1', verdict: findings.length ? 'FAIL' : 'PASS', findings, checkedFiles: Object.keys(files).length, refuses: ['local-paths','receipts','raw-captures','tokens','machine-state'] };
}
function releaseFiles(source) {
  const rendered = Dual.render(source), files = {};
  Object.keys(rendered).forEach(function (absolute) { files[path.basename(absolute)] = rendered[absolute]; });
  return files;
}
function compatibility(source) {
  return { schema: 'axm.sensorium-host-compatibility/v1', version: source.version, rows: source.skills.map(function (skill) { return { skillId: skill.id, capability: skill.capabilityId + '/' + skill.capabilityVersion, routeType: skill.routeType, requiredHostCapabilities: skill.requiredHostCapabilities, honestMissingState: skill.adapterStatus === 'MISSING_ADAPTER' ? 'MISSING_ADAPTER' : (skill.executorStatus === 'HOST_MEDIATED' ? 'MISSING_VISUAL_INPUT' : 'NONE'), constraints: skill.constraints }; }) };
}
function build(output) {
  const source = Inventory.readSource(), out = safeOutput(output || path.join(RELEASE_ROOT, source.version));
  const files = releaseFiles(source), safety = publicSafety(files);
  if (safety.verdict !== 'PASS') throw new Error('public safety scan failed');
  const artifacts = {};
  source.skills.forEach(function (skill) {
    const pair = {}; pair[skill.id + '.skill.json'] = files[skill.id + '.skill.json']; pair[skill.id + '.SKILL.md'] = files[skill.id + '.SKILL.md'];
    artifacts[skill.id + '-' + source.version + '.zip'] = Buffer.from(Zip.build(pair, skill.id));
  });
  artifacts['axm-sensorium-' + source.version + '.zip'] = Buffer.from(Zip.build(files, 'axm-sensorium-' + source.version));
  const compatibilityText = JSON.stringify(compatibility(source), null, 2) + '\n';
  const safetyText = JSON.stringify(safety, null, 2) + '\n';
  const executable = source.skills.filter(function (skill) { return skill.executorStatus === 'EXECUTABLE'; }).length;
  const mediated = source.skills.filter(function (skill) { return skill.executorStatus === 'HOST_MEDIATED'; }).length;
  const changelog = '# AXM Sensorium ' + source.version + '\n\n- Canonical ' + source.skills.length + '-sense TEST inventory.\n- ' + executable + ' executable routes and ' + mediated + ' host-mediated route.\n- Added receipt-only cross-seat corroboration with no voting or promotion authority.\n- Added own-seat capacity classification with an explicit missing host-adapter hold.\n- Added bounded incoming-material taint signals with review routing and no automatic action.\n- Added before/after typed visual change comparison with no capture or cause claim.\n- Added accessibility-floor measurement using Visual Kernel contrast math and an explicit live computed-style adapter hold.\n- Common zero-retention receipt envelope, coordinator, negotiation, automation, Lab, and guarded Body Pulse use.\n';
  artifacts['compatibility-matrix.json'] = Buffer.from(compatibilityText); artifacts['public-safety-report.json'] = Buffer.from(safetyText); artifacts['CHANGELOG.md'] = Buffer.from(changelog);
  const checksums = Object.keys(artifacts).sort().map(function (name) { return sha256(artifacts[name]) + '  ' + name; }).join('\n') + '\n';
  artifacts['SHA256SUMS.txt'] = Buffer.from(checksums);
  const receipt = { schema: 'axm.sensorium-release-receipt/v1', version: source.version, sourceDigest: C.digest(source), output: path.relative(ROOT, out).replace(/\\/g, '/'), files: Object.keys(artifacts).sort().map(function (name) { return { name, sha256: sha256(artifacts[name]), bytes: artifacts[name].length }; }), publicSafety: 'PASS', deterministicFields: true, promotionAuthority: 'NONE' };
  artifacts['release-receipt.json'] = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
  return { out, artifacts, receipt };
}
function write(output) {
  const built = build(output); fs.mkdirSync(built.out, { recursive: true });
  Object.keys(built.artifacts).forEach(function (name) { fs.writeFileSync(path.join(built.out, name), built.artifacts[name]); });
  return built.receipt;
}
if (require.main === module) {
  try { const receipt = write(); console.log('Sensorium release packager: PASS - ' + receipt.files.length + ' artifacts at ' + receipt.output); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { ROOT, RELEASE_ROOT, safeOutput, publicSafety, releaseFiles, compatibility, build, write };
