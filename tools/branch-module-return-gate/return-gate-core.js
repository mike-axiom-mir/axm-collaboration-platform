'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const moduleApi = require('module');

const RETURN_SCHEMA = 'axm.branch-module-return/v1';
const PACKAGE_SCHEMA = 'axm.modular-piece-package/v1';
const INSPECTION_SCHEMA = 'axm.branch-return-inspection/v1';
const RECEIPT_SCHEMA = 'axm.branch-return-receipt/v1';
const MAX_FILES = 300;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const REQUIRED_FILES = ['axm-branch-return.json', 'manifest.json', 'module.contract.json'];
const EXECUTABLE_TEXT = new Set(['.js', '.cjs', '.mjs', '.html', '.htm', '.css']);
const NATIVE_EXTENSIONS = new Set(['.exe', '.dll', '.msi', '.node', '.com', '.scr', '.ps1', '.bat', '.cmd', '.sh', '.wasm']);
const FORBIDDEN_SEGMENTS = new Set(['.git', 'node_modules', '.cache', '__pycache__', '.pytest_cache']);
const BUILTINS = new Set(moduleApi.builtinModules.map(name => name.replace(/^node:/, '')));

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function digest(value) {
  return sha256(Buffer.from(canonical(value), 'utf8'));
}

function uniqueSorted(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))).sort(compareText);
}

function sameTextSet(left, right) {
  return JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));
}

function portableRelative(value) {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw || raw.includes('\0') || raw.includes(':') || raw.startsWith('/') || /^[a-zA-Z]:\//.test(raw)) throw new Error('path must be relative and portable');
  if (raw.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('path traversal segments are refused');
  const normalized = path.posix.normalize(raw);
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error('path escapes the selected root');
  if (normalized === '.' || normalized.endsWith('/')) throw new Error('path must name a file');
  return normalized;
}

function readJson(absolute, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    errors.push(label + ' must contain valid JSON: ' + error.message);
    return null;
  }
}

function resolveUnder(root, relative) {
  const absolute = path.resolve(root, relative.split('/').join(path.sep));
  const prefix = path.resolve(root) + path.sep;
  if (absolute !== path.resolve(root) && !absolute.toLowerCase().startsWith(prefix.toLowerCase())) throw new Error('path escapes the selected root');
  return absolute;
}

function collectTree(root, errors) {
  const files = [];
  function visit(directory, prefix) {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (error) { errors.push('cannot read ' + (prefix || '.') + ': ' + error.message); return; }
    entries.sort((a, b) => compareText(a.name, b.name));
    for (const entry of entries) {
      const relative = prefix ? prefix + '/' + entry.name : entry.name;
      const absolute = path.join(directory, entry.name);
      let stat;
      try { stat = fs.lstatSync(absolute); }
      catch (error) { errors.push('cannot inspect ' + relative + ': ' + error.message); continue; }
      if (stat.isSymbolicLink()) { errors.push('symbolic link or junction is refused: ' + relative); continue; }
      if (stat.isDirectory()) visit(absolute, relative);
      else if (stat.isFile()) files.push(relative.replace(/\\/g, '/'));
      else errors.push('non-regular filesystem entry is refused: ' + relative);
    }
  }
  visit(root, '');
  return files;
}

function validateReturnContract(value, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push('return contract must be an object'); return; }
  if (value.schema !== RETURN_SCHEMA) errors.push('return contract schema must be ' + RETURN_SCHEMA);
  const module = value.module;
  if (!module || typeof module !== 'object') errors.push('module identity is required');
  else {
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(module.id || ''))) errors.push('module.id must be a portable lowercase id');
    if (!String(module.version || '').trim()) errors.push('module.version is required');
    if (!String(module.title || '').trim()) errors.push('module.title is required');
    if (!String(module.summary || '').trim()) errors.push('module.summary is required');
  }
  if (!value.source || typeof value.source !== 'object' || !String(value.source.project || '').trim() || !String(value.source.branch || '').trim()) {
    errors.push('source.project and source.branch are required');
  }
  if (!value.selection || !Array.isArray(value.selection.files)) errors.push('selection.files is required');
  else if (value.selection.files.length < 5 || value.selection.files.length > MAX_FILES) errors.push('selection.files must contain 5-' + MAX_FILES + ' entries');
  const portability = value.portability;
  if (!portability || typeof portability !== 'object') errors.push('portability declaration is required');
  else {
    if (portability.target !== 'axm-workshop-dependency-free') errors.push('portability.target must be axm-workshop-dependency-free');
    ['branchRuntimeRequired', 'networkRequired', 'packageManagerRequired', 'hostCommandsRequired'].forEach(key => {
      if (portability[key] !== false) errors.push('portability.' + key + ' must be false');
    });
    ['externalPackages', 'remoteServices', 'nativeComponents', 'hostCommands', 'absolutePaths'].forEach(key => {
      if (!Array.isArray(portability[key]) || portability[key].length) errors.push('portability.' + key + ' must be an empty array');
    });
    ['workshopCapabilities', 'permissions'].forEach(key => {
      if (!Array.isArray(portability[key])) errors.push('portability.' + key + ' must be an array');
    });
  }
  if (!value.verification || !String(value.verification.selftest || '').trim()) errors.push('verification.selftest is required');
  if (value.requiredSeats !== undefined && value.requiredSeats !== 'dual') errors.push('requiredSeats must be dual');
}

function validateManifest(manifest, contract, declaration, selected, errors, warnings) {
  if (!manifest || !contract || !declaration) return;
  if (manifest.schema !== 'axm.tool-manifest/v1') errors.push('manifest schema must be axm.tool-manifest/v1');
  if (contract.schema !== 'axm.module-contract/v1') errors.push('module contract schema must be axm.module-contract/v1');
  const id = String(declaration.module.id || '');
  const version = String(declaration.module.version || '');
  if (manifest.id !== id || contract.id !== id) errors.push('manifest, module contract and return contract ids must match');
  if (manifest.version !== version || contract.version !== version) errors.push('manifest, module contract and return contract versions must match');
  if (String(manifest.status || '').toUpperCase() === 'CANON') errors.push('CANON material cannot cross the branch return gate');
  if (manifest.contract !== 'module.contract.json') errors.push('manifest.contract must be module.contract.json');
  let entry = null;
  try { entry = portableRelative(manifest.entry); }
  catch (error) { errors.push('manifest.entry: ' + error.message); }
  if (entry && !selected.has(entry.toLowerCase())) errors.push('manifest entry is not selected: ' + entry);
  ['uses', 'permissions'].forEach(key => {
    if (!Array.isArray(manifest[key])) errors.push('manifest.' + key + ' must be an array');
  });
  ['provides', 'consumes', 'permissions'].forEach(key => {
    if (!Array.isArray(contract[key])) errors.push('module contract.' + key + ' must be an array');
  });
  if (!contract.handoffs || !Array.isArray(contract.handoffs.emits) || !Array.isArray(contract.handoffs.accepts)) {
    errors.push('module contract handoffs.emits and handoffs.accepts must be arrays');
  }
  if (!contract.lifecycle || typeof contract.lifecycle !== 'object') errors.push('module contract lifecycle is required');
  const expectedCapabilities = uniqueSorted([...(manifest.uses || []), ...(contract.consumes || [])]);
  const expectedPermissions = uniqueSorted([...(manifest.permissions || []), ...(contract.permissions || [])]);
  if (!sameTextSet(declaration.portability.workshopCapabilities, expectedCapabilities)) {
    errors.push('portability.workshopCapabilities must exactly declare manifest uses plus contract consumes');
  }
  if (!sameTextSet(declaration.portability.permissions, expectedPermissions)) {
    errors.push('portability.permissions must exactly declare manifest plus contract permissions');
  }
  if ((manifest.uses || []).some(value => /^package:/i.test(String(value)))) warnings.push('manifest package-like capability needs human review');
}

function validatePackageJson(packageJson, errors) {
  if (!packageJson) return;
  ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(key => {
    const values = packageJson[key];
    if (values && typeof values === 'object' && Object.keys(values).length) errors.push('package.json ' + key + ' must be empty');
  });
  const scripts = packageJson.scripts || {};
  ['preinstall', 'install', 'postinstall', 'prepare'].forEach(key => {
    if (scripts[key]) errors.push('package.json install lifecycle script is refused: ' + key);
  });
}

function resolveLocalReference(fromFile, specifier, selected) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [base, base + '.js', base + '.cjs', base + '.mjs', base + '.json', path.posix.join(base, 'index.js')];
  return candidates.find(candidate => selected.has(candidate.toLowerCase())) || null;
}

function inspectTextFile(relative, text, selected, errors, warnings) {
  const extension = path.posix.extname(relative).toLowerCase();
  if (/https?:\/\//i.test(text)) errors.push(relative + ': remote runtime URL is refused');
  if (/file:\/\//i.test(text) || /(?:^|[\s'"(=])(?:[a-zA-Z]:[\\/])/.test(text)) errors.push(relative + ': absolute filesystem path is refused');
  if (/\b(?:child_process|node:child_process|powershell(?:\.exe)?|cmd\.exe)\b/i.test(text) || /\b(?:exec|execFile|execSync|spawn|spawnSync)\s*\(/.test(text)) {
    errors.push(relative + ': host command or process launch is refused');
  }
  if (/\bprocess\.env\b/.test(text)) warnings.push(relative + ': process.env reference requires human review');

  if (['.js', '.cjs', '.mjs'].includes(extension) || extension === '.html' || extension === '.htm') {
    const literal = /\b(?:require\s*\(|import\s*\(|from\s+|import\s+)(['"])([^'"\r\n]+)\1\s*\)?/g;
    let match;
    while ((match = literal.exec(text))) {
      const specifier = match[2];
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        if (!specifier.startsWith('.') || !resolveLocalReference(relative, specifier, selected)) errors.push(relative + ': missing or escaping local import ' + specifier);
      } else if (!BUILTINS.has(specifier.replace(/^node:/, ''))) {
        errors.push(relative + ': external package import is refused: ' + specifier);
      }
    }
    if (/\brequire\s*\(\s*[^'"\s]/.test(text)) errors.push(relative + ': dynamic non-literal require is refused');
    if (/\bimport\s*\(\s*[^'"\s]/.test(text)) errors.push(relative + ': dynamic non-literal import is refused');
  }

  if (extension === '.html' || extension === '.htm') {
    const resource = /\b(?:src|href)\s*=\s*(['"])([^'"]+)\1/gi;
    let match;
    while ((match = resource.exec(text))) {
      const reference = match[2].trim();
      if (!reference || /^(?:data:|#|mailto:|javascript:)/i.test(reference)) continue;
      if (/^(?:https?:|\/\/|\/)/i.test(reference)) errors.push(relative + ': remote or root-relative resource is refused: ' + reference);
      else {
        const clean = reference.split(/[?#]/)[0];
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), clean));
        if (!selected.has(target.toLowerCase())) errors.push(relative + ': undeclared resource is refused: ' + reference);
      }
    }
  }

  if (extension === '.css') {
    const resource = /(?:@import\s+|url\s*\()\s*(['"]?)([^)'"\s;]+)\1/gi;
    let match;
    while ((match = resource.exec(text))) {
      const reference = match[2].trim();
      if (!reference || /^(?:data:|#)/i.test(reference)) continue;
      if (/^(?:https?:|\/\/|\/)/i.test(reference)) errors.push(relative + ': remote or root-relative CSS resource is refused: ' + reference);
      else {
        const clean = reference.split(/[?#]/)[0];
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), clean));
        if (!selected.has(target.toLowerCase())) errors.push(relative + ': undeclared CSS resource is refused: ' + reference);
      }
    }
  }
}

function inspectSource(sourceRoot) {
  const startedErrors = [];
  const errors = [];
  const warnings = [];
  const absoluteRoot = path.resolve(String(sourceRoot || ''));
  if (!sourceRoot || !fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
    return inspection('INVALID_RETURN_CONTRACT', null, [], ['source must be an existing explicit directory'], []);
  }
  if (fs.lstatSync(absoluteRoot).isSymbolicLink()) {
    return inspection('INVALID_RETURN_CONTRACT', null, [], ['source root cannot be a symbolic link or junction'], []);
  }
  const declarationPath = path.join(absoluteRoot, 'axm-branch-return.json');
  if (!fs.existsSync(declarationPath)) return inspection('INVALID_RETURN_CONTRACT', null, [], ['axm-branch-return.json is required'], []);
  const declaration = readJson(declarationPath, 'axm-branch-return.json', startedErrors);
  if (declaration) validateReturnContract(declaration, startedErrors);
  if (startedErrors.length) return inspection('INVALID_RETURN_CONTRACT', declaration && declaration.module || null, [], startedErrors, warnings);

  const selected = new Map();
  for (const raw of declaration.selection.files) {
    let relative;
    try { relative = portableRelative(raw); }
    catch (error) { errors.push('selection ' + JSON.stringify(raw) + ': ' + error.message); continue; }
    const key = relative.toLowerCase();
    if (selected.has(key)) errors.push('duplicate case-insensitive selected path: ' + relative);
    else selected.set(key, relative);
  }
  const selectedSet = new Set(selected.keys());
  REQUIRED_FILES.concat([String(declaration.verification.selftest || '')]).forEach(required => {
    let relative;
    try { relative = portableRelative(required); }
    catch (error) { errors.push('required file path is invalid: ' + required); return; }
    if (!selectedSet.has(relative.toLowerCase())) errors.push('required file is not selected: ' + relative);
  });

  const tree = collectTree(absoluteRoot, errors);
  const treeSet = new Set(tree.map(item => item.toLowerCase()));
  tree.forEach(relative => {
    const segments = relative.toLowerCase().split('/');
    if (segments.some(segment => FORBIDDEN_SEGMENTS.has(segment))) errors.push('forbidden branch residue is present: ' + relative);
    if (/(?:^|\/)(?:\.env(?:\.|$)|[^/]*(?:credential|secret|token|private[-_]?key)[^/]*)/i.test(relative) || /\.(?:pem|p12|pfx|key)$/i.test(relative)) {
      errors.push('secret-like file is refused: ' + relative);
    }
    if (!selectedSet.has(relative.toLowerCase())) errors.push('undeclared file is refused: ' + relative);
  });
  for (const relative of selected.values()) {
    if (!treeSet.has(relative.toLowerCase())) errors.push('selected file is missing or not regular: ' + relative);
    if (NATIVE_EXTENSIONS.has(path.posix.extname(relative).toLowerCase())) errors.push('native or executable host file is refused: ' + relative);
  }

  const inventory = [];
  let totalBytes = 0;
  for (const relative of Array.from(selected.values()).sort(compareText)) {
    const absolute = resolveUnder(absoluteRoot, relative);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    if (stat.size > MAX_FILE_BYTES) errors.push('file exceeds 10 MiB: ' + relative);
    totalBytes += stat.size;
    const buffer = fs.readFileSync(absolute);
    inventory.push({ path: relative, bytes: buffer.length, sha256: sha256(buffer), buffer });
  }
  if (totalBytes > MAX_TOTAL_BYTES) errors.push('selection exceeds 30 MiB total');
  if (inventory.length > MAX_FILES) errors.push('selection exceeds ' + MAX_FILES + ' files');

  const manifest = selectedSet.has('manifest.json') && fs.existsSync(path.join(absoluteRoot, 'manifest.json')) ? readJson(path.join(absoluteRoot, 'manifest.json'), 'manifest.json', errors) : null;
  const contract = selectedSet.has('module.contract.json') && fs.existsSync(path.join(absoluteRoot, 'module.contract.json')) ? readJson(path.join(absoluteRoot, 'module.contract.json'), 'module.contract.json', errors) : null;
  validateManifest(manifest, contract, declaration, selectedSet, errors, warnings);
  if (selectedSet.has('package.json') && fs.existsSync(path.join(absoluteRoot, 'package.json'))) {
    validatePackageJson(readJson(path.join(absoluteRoot, 'package.json'), 'package.json', errors), errors);
  }
  for (const item of inventory) {
    if (EXECUTABLE_TEXT.has(path.posix.extname(item.path).toLowerCase())) inspectTextFile(item.path, item.buffer.toString('utf8'), selectedSet, errors, warnings);
  }
  const status = errors.length ? 'HOLD_PORTABILITY_GAPS' : 'READY_FOR_GOVERNED_INTAKE';
  const report = inspection(status, declaration.module, inventory, errors, warnings);
  report.source = declaration.source;
  report.declaration = declaration;
  report.manifest = manifest;
  report.contract = contract;
  Object.defineProperty(report, '_inventoryBuffers', { value: inventory, enumerable: false });
  return report;
}

function inspection(status, moduleIdentity, inventory, errors, warnings) {
  const cleanInventory = inventory.map(item => ({ path: item.path, bytes: item.bytes, sha256: item.sha256 }));
  return {
    schema: INSPECTION_SCHEMA,
    status,
    pass: status === 'READY_FOR_GOVERNED_INTAKE',
    module: moduleIdentity || null,
    inventory: {
      files: cleanInventory,
      fileCount: cleanInventory.length,
      totalBytes: cleanInventory.reduce((sum, item) => sum + item.bytes, 0),
      digest: digest(cleanInventory)
    },
    findings: { errors: uniqueSorted(errors), warnings: uniqueSorted(warnings) },
    truth: {
      structuralPortabilityChecked: status !== 'INVALID_RETURN_CONTRACT',
      candidateCodeExecuted: false,
      runtimeVerified: false,
      visualsVerified: false,
      installed: false,
      promoted: false,
      canonChanged: false
    }
  };
}

function buildPackage(sourceRoot) {
  const report = inspectSource(sourceRoot);
  if (!report.pass) {
    const error = new Error('branch return is held: ' + report.findings.errors.join('; '));
    error.report = report;
    throw error;
  }
  const manifest = report.manifest;
  const contract = report.contract;
  const declaration = report.declaration;
  const files = report._inventoryBuffers.map(item => ({
    path: item.path,
    encoding: 'base64',
    content: item.buffer.toString('base64'),
    sha256: item.sha256
  }));
  const returnContractItem = report._inventoryBuffers.find(item => item.path === 'axm-branch-return.json');
  const packageValue = {
    schema: PACKAGE_SCHEMA,
    piece: {
      id: declaration.module.id,
      family: 'module',
      version: declaration.module.version,
      title: declaration.module.title,
      summary: declaration.module.summary,
      capabilities: { provides: uniqueSorted(contract.provides), requires: uniqueSorted(contract.consumes) },
      protocols: uniqueSorted([...(contract.handoffs.emits || []), ...(contract.handoffs.accepts || [])]),
      provenance: {
        sourceProject: declaration.source.project,
        sourceRepository: declaration.source.repository || null,
        sourceBranch: declaration.source.branch,
        sourceCommit: declaration.source.commit || null,
        returnContractSha256: returnContractItem.sha256
      },
      resourceProfile: {
        fileCount: files.length,
        totalBytes: report.inventory.totalBytes,
        runtime: 'node-builtins-and-workshop-contracts-only',
        branchRuntimeRequired: false,
        networkRequired: false,
        packageManagerRequired: false,
        nativeComponentsRequired: false
      },
      activation: 'manual'
    },
    files,
    requiredSeats: 'dual'
  };
  const packageDigest = digest(packageValue);
  const receipt = {
    schema: RECEIPT_SCHEMA,
    status: 'READY_FOR_GOVERNED_INTAKE',
    createdAt: new Date().toISOString(),
    module: { id: declaration.module.id, version: declaration.module.version },
    packageDigest,
    inventoryDigest: report.inventory.digest,
    authority: {
      staged: false,
      installed: false,
      promoted: false,
      canonChanged: false,
      permissionsChanged: false,
      candidateCodeExecuted: false
    },
    truth: {
      structuralPortabilityChecked: true,
      runtimeVerified: false,
      visualsVerified: false,
      nextGate: 'shared/modular-intake governed review'
    }
  };
  return { report, package: packageValue, receipt };
}

function decodePackageFile(file) {
  if (!file || file.encoding !== 'base64') throw new Error('package files must use base64 encoding');
  const content = String(file.content || '');
  if (content.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content)) {
    throw new Error('package file content must be canonical base64');
  }
  const buffer = Buffer.from(content, 'base64');
  if (buffer.toString('base64') !== content) throw new Error('package file content must be canonical base64');
  return buffer;
}

function verifyPackage(packageValue, receipt) {
  const errors = [];
  if (!packageValue || packageValue.schema !== PACKAGE_SCHEMA) errors.push('package schema must be ' + PACKAGE_SCHEMA);
  const piece = packageValue && packageValue.piece || {};
  if (piece.family !== 'module') errors.push('package piece family must be module');
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(piece.id || ''))) errors.push('package piece id is invalid');
  if (!String(piece.version || '').trim()) errors.push('package piece version is required');
  if (packageValue && packageValue.requiredSeats !== 'dual') errors.push('package requiredSeats must be dual');
  const files = packageValue && Array.isArray(packageValue.files) ? packageValue.files : [];
  if (!files.length || files.length > MAX_FILES) errors.push('package must contain 1-' + MAX_FILES + ' files');
  const seen = new Set();
  const inventory = [];
  let totalBytes = 0;
  files.forEach((file, index) => {
    let relative;
    try { relative = portableRelative(file.path); }
    catch (error) { errors.push('file ' + index + ': ' + error.message); return; }
    const key = relative.toLowerCase();
    if (seen.has(key)) errors.push('duplicate package path: ' + relative);
    seen.add(key);
    try {
      const buffer = decodePackageFile(file);
      const fileDigest = sha256(buffer);
      if (fileDigest !== String(file.sha256 || '').toLowerCase()) errors.push('file digest mismatch: ' + relative);
      if (buffer.length > MAX_FILE_BYTES) errors.push('file exceeds 10 MiB: ' + relative);
      totalBytes += buffer.length;
      inventory.push({ path: relative, bytes: buffer.length, sha256: fileDigest });
    } catch (error) { errors.push('file ' + index + ': ' + error.message); }
  });
  if (totalBytes > MAX_TOTAL_BYTES) errors.push('package exceeds 30 MiB total');
  inventory.sort((a, b) => compareText(a.path, b.path));
  REQUIRED_FILES.forEach(required => {
    if (!seen.has(required)) errors.push('package required file is missing: ' + required);
  });
  const packageDigest = digest(packageValue);
  const inventoryDigest = digest(inventory);
  if (receipt) {
    if (receipt.schema !== RECEIPT_SCHEMA) errors.push('receipt schema must be ' + RECEIPT_SCHEMA);
    if (receipt.packageDigest !== packageDigest) errors.push('receipt package digest mismatch');
    if (receipt.inventoryDigest !== inventoryDigest) errors.push('receipt inventory digest mismatch');
  }
  return {
    schema: 'axm.branch-return-package-verification/v1',
    pass: errors.length === 0,
    status: errors.length ? 'TAMPERED_OR_INVALID' : 'VERIFIED_INERT_PACKAGE',
    packageDigest,
    inventoryDigest,
    files: inventory.length,
    bytes: totalBytes,
    errors: uniqueSorted(errors),
    authority: { staged: false, installed: false, promoted: false, codeExecuted: false }
  };
}

module.exports = {
  RETURN_SCHEMA,
  PACKAGE_SCHEMA,
  INSPECTION_SCHEMA,
  RECEIPT_SCHEMA,
  canonical,
  digest,
  inspectSource,
  buildPackage,
  verifyPackage
};
