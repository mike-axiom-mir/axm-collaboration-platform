'use strict';

const fs = require('fs');
const path = require('path');

const BASELINE_SCHEMA = 'axm.workshop-continuity-baseline/v1';
const RETIREMENTS_SCHEMA = 'axm.workshop-continuity-retirements/v1';
const RETIREMENT_KINDS = new Set(['path', 'tool', 'providedCapability', 'providerBinding', 'consumerBinding']);

function readJson(file, label) {
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(label + ' is unreadable: ' + error.message); }
  return value;
}

function sortedUnique(values) {
  return Array.from(new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateSortedUnique(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(label + ' must be an array');
    return;
  }
  if (!sameArray(value, sortedUnique(value))) errors.push(label + ' must be sorted, unique, and non-empty by item');
}

function validateBaseline(baseline) {
  const errors = [];
  if (!baseline || typeof baseline !== 'object') return { pass:false, errors:['baseline must be an object'] };
  if (baseline.schema !== BASELINE_SCHEMA) errors.push('baseline schema must be ' + BASELINE_SCHEMA);
  const inventory = baseline.inventory;
  if (!inventory || typeof inventory !== 'object') errors.push('baseline inventory is required');
  else {
    ['protectedPaths', 'toolIds', 'providedCapabilityIds', 'providerBindings', 'consumerBindings'].forEach(key => validateSortedUnique(inventory[key], 'baseline inventory.' + key, errors));
    (inventory.protectedPaths || []).forEach(item => {
      const normalized = String(item || '').replace(/\\/g, '/');
      if (!normalized || path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) errors.push('baseline path escapes the Workshop: ' + item);
      if (normalized === 'intakes' || normalized.startsWith('intakes/')) errors.push('raw intakes may not be continuity-protected active source: ' + item);
    });
  }
  if (!baseline.truth || baseline.truth.retirementRequiresExplicitMikeRecord !== true) errors.push('baseline truth must require explicit Mike retirement records');
  if (!baseline.truth || baseline.truth.moduleMayNotSelfRetire !== true) errors.push('baseline truth must forbid module self-retirement');
  return { pass:errors.length === 0, errors };
}

function validateRetirements(retirements) {
  const errors = [];
  if (!retirements || typeof retirements !== 'object') return { pass:false, errors:['retirements ledger must be an object'] };
  if (retirements.schema !== RETIREMENTS_SCHEMA) errors.push('retirements schema must be ' + RETIREMENTS_SCHEMA);
  if (!Array.isArray(retirements.entries)) errors.push('retirements entries must be an array');
  const seen = new Set();
  (retirements.entries || []).forEach((entry, index) => {
    const prefix = 'retirement entry ' + index;
    if (!entry || typeof entry !== 'object') { errors.push(prefix + ' must be an object'); return; }
    if (!RETIREMENT_KINDS.has(entry.kind)) errors.push(prefix + ' has unsupported kind');
    const id = String(entry.id || '').trim();
    if (!id) errors.push(prefix + ' requires id');
    const key = entry.kind + '\0' + id;
    if (seen.has(key)) errors.push(prefix + ' duplicates ' + entry.kind + ': ' + id);
    seen.add(key);
    if (entry.status !== 'AUTHORIZED') errors.push(prefix + ' status must be AUTHORIZED');
    if (entry.authorizedBy !== 'Mike Tobi') errors.push(prefix + ' must be explicitly authorizedBy Mike Tobi');
    if (String(entry.reason || '').trim().length < 12) errors.push(prefix + ' requires a concrete reason');
    if (!Number.isFinite(Date.parse(entry.recordedAt))) errors.push(prefix + ' requires a valid recordedAt');
  });
  if (!retirements.truth || retirements.truth.automaticRetirement !== false) errors.push('retirements truth must keep automaticRetirement false');
  return { pass:errors.length === 0, errors };
}

function collectLiveInventory(root) {
  root = path.resolve(root);
  const toolsRoot = path.join(root, 'tools');
  const toolIds = [];
  const providedCapabilityIds = [];
  const providerBindings = [];
  const consumerBindings = [];
  const errors = [];
  let entries = [];
  try { entries = fs.readdirSync(toolsRoot, { withFileTypes:true }); }
  catch (error) { return { toolIds:[], providedCapabilityIds:[], providerBindings:[], consumerBindings:[], errors:['tools inventory is unreadable: ' + error.message] }; }
  entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('_')).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
    const moduleRoot = path.join(toolsRoot, entry.name);
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'manifest.json'), 'utf8')); }
    catch (error) { errors.push('tools/' + entry.name + '/manifest.json is unreadable: ' + error.message); return; }
    const toolId = String(manifest.id || entry.name).trim();
    toolIds.push(toolId);
    let contract = {};
    if (manifest.contract) {
      const contractFile = path.resolve(moduleRoot, manifest.contract);
      if (contractFile !== moduleRoot && !contractFile.startsWith(moduleRoot + path.sep)) {
        errors.push('tools/' + entry.name + ' contract escapes its tool folder');
      } else {
        try { contract = JSON.parse(fs.readFileSync(contractFile, 'utf8')); }
        catch (error) { errors.push('tools/' + entry.name + ' contract is unreadable: ' + error.message); }
      }
    }
    const provides = sortedUnique([].concat(contract.provides || [], manifest.produces || []));
    const consumes = sortedUnique(contract.consumes || []);
    provides.forEach(capability => {
      providedCapabilityIds.push(capability);
      providerBindings.push(toolId + '::' + capability);
    });
    consumes.forEach(capability => consumerBindings.push(toolId + '::' + capability));
  });
  return {
    toolIds:sortedUnique(toolIds),
    providedCapabilityIds:sortedUnique(providedCapabilityIds),
    providerBindings:sortedUnique(providerBindings),
    consumerBindings:sortedUnique(consumerBindings),
    errors
  };
}

function audit(root, baseline, retirements) {
  root = path.resolve(root);
  const errors = [];
  const baselineCheck = validateBaseline(baseline);
  const retirementCheck = validateRetirements(retirements);
  errors.push.apply(errors, baselineCheck.errors.map(error => 'baseline: ' + error));
  errors.push.apply(errors, retirementCheck.errors.map(error => 'retirements: ' + error));
  if (!baselineCheck.pass || !retirementCheck.pass) return { pass:false, errors, missing:[], added:{} };

  const live = collectLiveInventory(root);
  errors.push.apply(errors, live.errors.map(error => 'live inventory: ' + error));
  const authorized = new Set(retirements.entries.map(entry => entry.kind + '\0' + entry.id));
  const missing = [];
  function protect(kind, baselineValues, liveValues) {
    const liveSet = new Set(liveValues || []);
    baselineValues.forEach(id => {
      if (!liveSet.has(id) && !authorized.has(kind + '\0' + id)) missing.push({ kind, id });
    });
  }
  baseline.inventory.protectedPaths.forEach(relative => {
    if (!fs.existsSync(path.join(root, ...relative.split('/'))) && !authorized.has('path\0' + relative)) missing.push({ kind:'path', id:relative });
  });
  protect('tool', baseline.inventory.toolIds, live.toolIds);
  protect('providedCapability', baseline.inventory.providedCapabilityIds, live.providedCapabilityIds);
  protect('providerBinding', baseline.inventory.providerBindings, live.providerBindings);
  protect('consumerBinding', baseline.inventory.consumerBindings, live.consumerBindings);
  missing.forEach(item => errors.push('UNAUTHORIZED_DISAPPEARANCE ' + item.kind + ': ' + item.id));

  function additions(baselineValues, liveValues) {
    const protectedSet = new Set(baselineValues);
    return (liveValues || []).filter(id => !protectedSet.has(id));
  }
  return {
    pass:errors.length === 0,
    errors,
    missing,
    added:{
      tools:additions(baseline.inventory.toolIds, live.toolIds),
      providedCapabilities:additions(baseline.inventory.providedCapabilityIds, live.providedCapabilityIds),
      providerBindings:additions(baseline.inventory.providerBindings, live.providerBindings),
      consumerBindings:additions(baseline.inventory.consumerBindings, live.consumerBindings)
    },
    summary:{
      protectedPaths:baseline.inventory.protectedPaths.length,
      protectedTools:baseline.inventory.toolIds.length,
      protectedProvidedCapabilities:baseline.inventory.providedCapabilityIds.length,
      protectedProviderBindings:baseline.inventory.providerBindings.length,
      protectedConsumerBindings:baseline.inventory.consumerBindings.length,
      authorizedRetirements:retirements.entries.length,
      unauthorizedDisappearances:missing.length
    }
  };
}

function auditFiles(root, baselineFile, retirementsFile) {
  return audit(root, readJson(baselineFile, 'continuity baseline'), readJson(retirementsFile, 'continuity retirements ledger'));
}

module.exports = { BASELINE_SCHEMA, RETIREMENTS_SCHEMA, RETIREMENT_KINDS, sortedUnique, validateBaseline, validateRetirements, collectLiveInventory, audit, auditFiles };
