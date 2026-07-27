'use strict';

const fs = require('fs');
const path = require('path');
const C = require('../core');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SOURCE = path.join(ROOT, 'shared', 'sensorium', 'canonical', 'sensorium.json');

function readSource() { return JSON.parse(fs.readFileSync(SOURCE, 'utf8')); }
function validate(source) {
  const errors = [], ids = new Set(), capabilities = new Set();
  if (!source || source.schema !== 'axm.sensorium-canonical/v1') errors.push('wrong canonical schema');
  (source && source.skills || []).forEach(function (skill) {
    if (ids.has(skill.id)) errors.push('duplicate skill id: ' + skill.id); ids.add(skill.id);
    const capability = skill.capabilityId + '/' + skill.capabilityVersion;
    if (capabilities.has(capability)) errors.push('duplicate capability: ' + capability); capabilities.add(capability);
    ['skillStatus','executorStatus','adapterStatus','proofStatus','authorityStatus'].forEach(function (field) {
      if (!(source.statusVocabulary[field] || []).includes(skill[field])) errors.push(skill.id + ' has invalid ' + field);
    });
    const modulePath = path.resolve(ROOT, 'shared', 'sensorium', skill.module || '');
    if (!skill.module || !fs.existsSync(modulePath)) errors.push(skill.id + ' module is missing: ' + skill.module);
    else {
      const mod = require(modulePath);
      if (mod.CAPABILITY && mod.CAPABILITY !== capability) errors.push(skill.id + ' module capability mismatch');
      if (skill.factory && typeof mod[skill.factory] !== 'function') errors.push(skill.id + ' factory is missing: ' + skill.factory);
      if (!skill.factory && typeof mod[skill.operation] !== 'function') errors.push(skill.id + ' host operation is missing: ' + skill.operation);
    }
  });
  const executable = (source && source.skills || []).filter(function (skill) { return skill.executorStatus === 'EXECUTABLE'; }).length;
  const mediated = (source && source.skills || []).filter(function (skill) { return skill.executorStatus === 'HOST_MEDIATED'; }).length;
  if ((source && source.skills || []).length !== 13) errors.push('canonical inventory must contain thirteen skills');
  if (executable !== 12) errors.push('canonical inventory must contain twelve executable routes');
  if (mediated !== 1) errors.push('canonical inventory must contain one host-mediated route');
  return { ok: errors.length === 0, errors, counts: { skills: ids.size, executableRoutes: executable, hostMediatedRoutes: mediated } };
}
function registry(source) {
  const checked = validate(source);
  if (!checked.ok) throw new Error(checked.errors.join('; '));
  return {
    schema: 'axm.sensorium-runtime-registry/v2', version: source.version, status: source.status,
    generatedFrom: 'shared/sensorium/canonical/sensorium.json', sourceDigest: C.digest(source), promotionGate: source.promotionGate,
    authority: 'Every adapter and lease is injected per use. Registry presence grants nothing.', retentionLaw: source.retention.law,
    counts: checked.counts, statusVocabulary: source.statusVocabulary,
    senses: source.skills.map(function (skill) {
      return {
        id: skill.id, displayName: skill.displayName, sense: skill.sense, capability: skill.capabilityId + '/' + skill.capabilityVersion,
        capabilityId: skill.capabilityId, capabilityVersion: skill.capabilityVersion, routeType: skill.routeType, module: skill.module,
        factory: skill.factory || null, operation: skill.operation, specificReceiptSchema: skill.specificReceiptSchema,
        skillStatus: skill.skillStatus, executorStatus: skill.executorStatus, adapterStatus: skill.adapterStatus,
        proofStatus: skill.proofStatus, authorityStatus: skill.authorityStatus, requiredHostCapabilities: skill.requiredHostCapabilities,
        constraints: skill.constraints, resourceBudget: skill.resourceBudget,
        routing: skill.id === 'eye-live-visual-verifier' ? { primary: 'BROWSER_PRIMARY', fallback: 'WINDOWS_FALLBACK', fallbackCapability: 'visual.capture.windows-native/v1', fallbackModule: '../ai-native-hands/windows-native-capture-hand.js', automaticActivation: false, permissionTransfer: false, nativeScopes: ['screen.primary','screen.virtual'], exactWindowIsolation: false, windowIsolationHold: 'WINDOWS_WINDOW_ISOLATION_UNAVAILABLE' } : undefined
      };
    })
  };
}
function matrix(source) {
  return {
    schema: 'axm.sensorium-capability-matrix/v1', version: source.version, generatedFrom: 'shared/sensorium/canonical/sensorium.json',
    rows: source.skills.map(function (skill) {
      let cheapestAlternative = 'Inject the declared bounded adapter or keep the dependent claim UNKNOWN.';
      if (skill.executorStatus === 'HOST_MEDIATED') cheapestAlternative = 'Supply an attributable typed host observation.';
      else if (skill.id === 'eye-accessibility-inspector') cheapestAlternative = 'Inject the exact-target browser computed-style adapter or supply bounded measured properties; incomplete coverage and complex backgrounds remain UNKNOWN.';
      else if (skill.adapterStatus === 'NOT_REQUIRED') cheapestAlternative = 'Supply the bounded declared inputs; no host adapter is required.';
      return { senseId: skill.id, capability: skill.capabilityId + '/' + skill.capabilityVersion, routeType: skill.routeType, executorStatus: skill.executorStatus, adapterStatus: skill.adapterStatus, proofStatus: skill.proofStatus, authorityStatus: skill.authorityStatus, constraints: skill.constraints, cheapestAlternative };
    })
  };
}
function render(source) {
  source = source || readSource();
  const outputs = {};
  outputs[path.join(ROOT, 'shared', 'sensorium', 'registry.json')] = JSON.stringify(registry(source), null, 2) + '\n';
  outputs[path.join(ROOT, 'shared', 'sensorium', 'capability-matrix.json')] = JSON.stringify(matrix(source), null, 2) + '\n';
  return outputs;
}
function write(outputs) {
  Object.keys(outputs).forEach(function (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, outputs[file], 'utf8'); });
}
if (require.main === module) {
  try { const outputs = render(); write(outputs); console.log('Sensorium inventory compiler: PASS - ' + Object.keys(outputs).length + ' artifacts'); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { ROOT, SOURCE, readSource, validate, registry, matrix, render, write };
