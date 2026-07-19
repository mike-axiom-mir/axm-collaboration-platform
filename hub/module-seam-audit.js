'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED = {
  state_owner: new Set(['browser', 'service', 'filesystem', 'mixed', 'none']),
  reload: new Set(['resume', 'reset', 'not-applicable', 'pending']),
  disconnect: new Set(['reconnect', 'graceful-degrade', 'not-applicable', 'pending']),
  cleanup: new Set(['automatic', 'explicit', 'not-applicable', 'pending'])
};

function validateLifecycle(lifecycle) {
  const gaps = [];
  if (!lifecycle || typeof lifecycle !== 'object') {
    return { pass: false, gaps: ['lifecycle seam declaration missing'] };
  }
  Object.keys(ALLOWED).forEach(field => {
    if (!ALLOWED[field].has(lifecycle[field])) gaps.push(field + ' is missing or unsupported');
    else if (lifecycle[field] === 'pending') gaps.push(field + ' is pending');
  });
  return { pass: gaps.length === 0, gaps };
}

function auditModules(root) {
  const toolsDir = path.join(root, 'tools');
  const modules = [];
  for (const entry of fs.readdirSync(toolsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name[0] === '_') continue;
    const moduleDir = path.join(toolsDir, entry.name);
    const manifestPath = path.join(moduleDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
    catch (_) { continue; }
    const item = { id: manifest.id || entry.name, contract: manifest.contract || null, gaps: [] };
    if (!manifest.contract) {
      item.gaps.push('module contract not declared');
    } else {
      const contractPath = path.resolve(moduleDir, manifest.contract);
      if (!contractPath.startsWith(moduleDir + path.sep) || !fs.existsSync(contractPath)) {
        item.gaps.push('declared module contract is unavailable');
      } else {
        try {
          const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
          item.gaps.push(...validateLifecycle(contract.lifecycle).gaps);
        } catch (error) {
          item.gaps.push('declared module contract is unreadable');
        }
      }
    }
    item.status = item.gaps.length ? 'open' : 'declared';
    modules.push(item);
  }
  const open = modules.filter(item => item.gaps.length);
  return {
    schema: 'axm.module-seam-gap-report/v1',
    checkedAt: new Date().toISOString(),
    scope: path.resolve(toolsDir),
    moduleCount: modules.length,
    openModuleCount: open.length,
    gapCount: open.reduce((count, item) => count + item.gaps.length, 0),
    modules
  };
}

module.exports = { ALLOWED, validateLifecycle, auditModules };
