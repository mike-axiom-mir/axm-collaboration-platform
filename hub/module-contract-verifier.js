'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.module-contract/v1';
const LIFECYCLE = {
  state_owner: new Set(['browser', 'service', 'filesystem', 'mixed', 'none']),
  reload: new Set(['resume', 'reset', 'not-applicable', 'pending']),
  disconnect: new Set(['reconnect', 'graceful-degrade', 'not-applicable', 'pending']),
  cleanup: new Set(['automatic', 'explicit', 'not-applicable', 'pending'])
};

function validateContract(contract, manifest) {
  const errors = [];
  if (!contract || typeof contract !== 'object') return { pass: false, errors: ['contract is not an object'] };
  if (contract.schema !== SCHEMA) errors.push('schema must be ' + SCHEMA);
  ['id', 'version'].forEach(field => { if (!String(contract[field] || '').trim()) errors.push(field + ' is required'); });
  ['provides', 'consumes', 'permissions'].forEach(field => {
    if (!Array.isArray(contract[field])) errors.push(field + ' must be an array');
  });
  if (!contract.handoffs || typeof contract.handoffs !== 'object') errors.push('handoffs object is required');
  else {
    if (!Array.isArray(contract.handoffs.emits)) errors.push('handoffs.emits must be an array');
    if (!Array.isArray(contract.handoffs.accepts)) errors.push('handoffs.accepts must be an array');
  }
  if (!contract.boundaries || typeof contract.boundaries !== 'object') errors.push('boundaries object is required');
  else if (!Array.isArray(contract.boundaries.refuses)) errors.push('boundaries.refuses must be an array');
  if (contract.lifecycle !== undefined) {
    if (!contract.lifecycle || typeof contract.lifecycle !== 'object') errors.push('lifecycle must be an object');
    else Object.keys(LIFECYCLE).forEach(field => {
      if (!LIFECYCLE[field].has(contract.lifecycle[field])) errors.push('lifecycle.' + field + ' is unsupported');
    });
  }
  if (manifest) {
    if (contract.id !== manifest.id) errors.push('contract id does not match manifest id');
    const declared = Array.isArray(manifest.uses) ? manifest.uses : [];
    (contract.permissions || []).forEach(p => { if (declared.indexOf(p) < 0) errors.push('permission not declared in manifest uses: ' + p); });
  }
  return { pass: errors.length === 0, errors };
}

function verifyDeclaredContracts(root) {
  const toolsDir = path.join(root, 'tools');
  const results = [];
  for (const entry of fs.readdirSync(toolsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name[0] === '_') continue;
    const manifestPath = path.join(toolsDir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
    catch (e) { continue; }
    if (!manifest.contract) continue;
    const contractPath = path.resolve(path.dirname(manifestPath), manifest.contract);
    const dirPrefix = path.dirname(manifestPath) + path.sep;
    if (!contractPath.startsWith(dirPrefix)) {
      results.push({ id: manifest.id || entry.name, pass: false, errors: ['contract path escapes module folder'] });
      continue;
    }
    if (!fs.existsSync(contractPath)) {
      results.push({ id: manifest.id || entry.name, pass: false, errors: ['declared contract file missing'] });
      continue;
    }
    try {
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      const checked = validateContract(contract, manifest);
      results.push({ id: manifest.id || entry.name, path: path.relative(root, contractPath), pass: checked.pass, errors: checked.errors, contract });
    } catch (e) {
      results.push({ id: manifest.id || entry.name, pass: false, errors: ['contract is not valid JSON: ' + e.message] });
    }
  }
  return { pass: results.every(r => r.pass), results };
}

module.exports = { SCHEMA, LIFECYCLE, validateContract, verifyDeclaredContracts };
