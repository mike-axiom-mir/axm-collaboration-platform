'use strict';

const U = require('../operations/operations-utils');

const FAMILY_SCHEMA = 'axm.modular-family-contract/v1';
const BUILT_INS = Object.freeze([
  family('module', 'Workshop module', 'manifest.json', 'module-installer', 'module'),
  family('universal-component', 'Universal component', 'component.json', 'neutral-library', 'component'),
  family('hand', 'Executable hand contract', 'hand.json', 'neutral-library', 'hand'),
  family('organ', 'AI organ contract', 'organ.json', 'neutral-library', 'organ'),
  family('schema', 'Data schema', 'schema.json', 'neutral-library', 'foundation'),
  family('protocol', 'Interchange protocol', 'protocol.json', 'neutral-library', 'foundation'),
  family('verifier', 'Verifier contract', 'verifier.json', 'neutral-library', 'foundation')
]);

function family(id, title, descriptorFile, storagePolicy, verificationProfile) {
  return Object.freeze({
    schema: FAMILY_SCHEMA, id, version: '1.0.0', title, descriptorFile, storagePolicy,
    verificationProfile, executionAuthority: 'none', origin: 'built-in',
    boundaries: ['no-auto-execution', 'no-arbitrary-destination', 'exact-version', 'explicit-promotion']
  });
}

function validate(input, allowBuiltInPolicy) {
  const value = input || {}, errors = [];
  try { U.cleanId(value.id, 'family id'); } catch (error) { errors.push(error.message); }
  if (value.schema !== FAMILY_SCHEMA) errors.push('family schema mismatch');
  if (!String(value.version || '').trim()) errors.push('family version is required');
  if (!String(value.title || '').trim()) errors.push('family title is required');
  try { U.safeRelative(value.descriptorFile); } catch (error) { errors.push('descriptorFile: ' + error.message); }
  const policies = allowBuiltInPolicy ? ['neutral-library', 'module-installer'] : ['neutral-library'];
  if (!policies.includes(value.storagePolicy)) errors.push('custom family storagePolicy must be neutral-library');
  if (value.executionAuthority !== 'none') errors.push('family executionAuthority must be none');
  if (!String(value.verificationProfile || '').trim()) errors.push('verificationProfile is required');
  return { pass: errors.length === 0, errors: Array.from(new Set(errors)) };
}

function create(custom) {
  const records = new Map();
  BUILT_INS.forEach(item => records.set(item.id, item));
  (custom || []).forEach(item => {
    const result = validate(item, false);
    if (result.pass && !records.has(item.id)) records.set(item.id, Object.freeze(Object.assign({}, item, { origin: 'reviewed-custom' })));
  });
  return {
    get(id) { const found = records.get(String(id || '').toLowerCase()); return found ? JSON.parse(JSON.stringify(found)) : null; },
    list() { return Array.from(records.values()).map(item => JSON.parse(JSON.stringify(item))).sort((a, b) => a.id.localeCompare(b.id)); }
  };
}

module.exports = { FAMILY_SCHEMA, BUILT_INS, validate, create };
