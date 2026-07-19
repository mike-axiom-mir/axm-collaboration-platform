'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');
const ContractVerifier = require('../../hub/module-contract-verifier');
const SeamAudit = require('../../hub/module-seam-audit');

function create(options) {
  const root = options.root, toolsRoot = path.join(root, 'tools'), installer = options.installerService;
  function modules() {
    const audit = SeamAudit.auditModules(root), gapMap = new Map(audit.modules.map(item => [item.id, item]));
    const rows = [];
    for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const file = path.join(toolsRoot, entry.name, 'manifest.json');
      try { const manifest = JSON.parse(fs.readFileSync(file, 'utf8')); rows.push({ folder: entry.name, id: manifest.id, name: manifest.name, version: manifest.version, status: manifest.status, contract: manifest.contract || null, gaps: (gapMap.get(manifest.id) || { gaps: [] }).gaps }); } catch (_) {}
    }
    return { schema: audit.schema, checkedAt: audit.checkedAt, gapCount: audit.gapCount, modules: rows.sort((a, b) => a.id.localeCompare(b.id)) };
  }
  function readModule(id) {
    id = U.cleanId(id, 'moduleId');
    const row = modules().modules.find(item => item.id === id); if (!row) throw new Error('module not found');
    const dir = path.join(toolsRoot, row.folder), manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    let contract = null; if (manifest.contract && fs.existsSync(path.join(dir, manifest.contract))) contract = JSON.parse(fs.readFileSync(path.join(dir, manifest.contract), 'utf8'));
    return { row, manifest, contract };
  }
  function validate(input) {
    const manifest = input && input.manifest, contract = input && input.contract, errors = [];
    if (!manifest || typeof manifest !== 'object') errors.push('manifest object is required');
    else {
      try { U.cleanId(manifest.id, 'manifest id'); } catch (error) { errors.push(error.message); }
      if (!manifest.name) errors.push('manifest name is required');
      if (!manifest.version) errors.push('manifest version is required');
      if (manifest.contract !== 'module.contract.json') errors.push('manifest must declare module.contract.json');
      if (!Array.isArray(manifest.uses)) errors.push('manifest uses must be an array');
    }
    if (manifest && contract) errors.push(...ContractVerifier.validateContract(contract, manifest).errors);
    else errors.push('module contract object is required');
    const lifecycle = contract && SeamAudit.validateLifecycle(contract.lifecycle); if (lifecycle && !lifecycle.pass) errors.push(...lifecycle.gaps);
    return { pass: errors.length === 0, errors: Array.from(new Set(errors)) };
  }
  function stage(input, actor) {
    const current = readModule(input.moduleId), manifest = input.manifest, contract = input.contract, checked = validate({ manifest, contract });
    if (!checked.pass) throw new Error(checked.errors.join('; '));
    if (manifest.id !== current.manifest.id) throw new Error('workbench cannot rename an installed module');
    const dir = path.join(toolsRoot, current.row.folder), scan = U.walk(dir, { maxFiles: 300, maxBytes: 30 * 1024 * 1024 });
    const files = scan.files.filter(file => !/^_/.test(path.basename(file.relative))).map(file => ({ path: file.relative, encoding: 'base64', content: fs.readFileSync(file.absolute).toString('base64') }));
    function replace(rel, value) { const encoded = Buffer.from(JSON.stringify(value, null, 2) + '\n').toString('base64'), item = files.find(file => file.path === rel); if (item) Object.assign(item, { encoding: 'base64', content: encoded }); else files.push({ path: rel, encoding: 'base64', content: encoded }); }
    replace('manifest.json', manifest); replace('module.contract.json', contract);
    return installer.stage({ schema: 'axm.module-bundle/v1', files, requiredSeats: input.requiredSeats || 1 }, actor);
  }
  return { modules, readModule, validate, stage };
}

module.exports = { create };

