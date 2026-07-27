'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REGISTRY_SCHEMA = 'axm.detached-candidate-registry/v1';
const RECORD_SCHEMA = 'axm.detached-candidate-record/v1';
const BUNDLE_SCHEMA = 'axm.module-bundle/v1';
const CONTRACT_SCHEMA = 'axm.module-contract/v1';
const RECEIPT_SCHEMA = 'axm.module-candidate-receipt/v1';
const STATUSES = new Set(['EXPERIMENTAL', 'TEST', 'WORKING', 'CANON', 'SHELL', 'BROKEN']);
const ENCODINGS = new Set(['utf8', 'base64']);
const MAX_FILES = 300;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 30 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const LIFECYCLE = {
  state_owner: new Set(['browser', 'service', 'filesystem', 'mixed', 'none']),
  reload: new Set(['resume', 'reset', 'not-applicable', 'pending']),
  disconnect: new Set(['reconnect', 'graceful-degrade', 'not-applicable', 'pending']),
  cleanup: new Set(['automatic', 'explicit', 'not-applicable', 'pending'])
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function issue(code, file, detail) {
  return {
    code,
    file: file || null,
    detail: detail || null
  };
}

function safeRelative(value) {
  const relative = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relative || relative.includes('\0') || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('unsafe relative path refused');
  }
  if (/^[a-zA-Z]:/.test(relative)) throw new Error('absolute path refused');
  return relative;
}

function resolveUnder(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, safeRelative(relative));
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (!target.startsWith(prefix)) throw new Error('path escaped candidate folder');
  return target;
}

function readJson(file, label, errors) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      errors.push(issue('FILE_TYPE_REFUSED', label, 'Required JSON must be a regular file.'));
      return null;
    }
    if (stat.size > MAX_FILE_BYTES) {
      errors.push(issue('FILE_TOO_LARGE', label, 'Required JSON exceeds the 10 MiB limit.'));
      return null;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    errors.push(issue('INVALID_JSON', label, error.message));
    return null;
  }
}

function walkCandidateFiles(folder, errors) {
  const files = [];
  let totalBytes = 0;
  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(folder, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        errors.push(issue('SYMLINK_REFUSED', relative, 'Candidate symlinks are never followed.'));
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!entry.isFile()) {
        errors.push(issue('FILE_TYPE_REFUSED', relative, 'Only regular files are accepted.'));
        continue;
      }
      const stat = fs.statSync(absolute);
      totalBytes += stat.size;
      if (stat.size > MAX_FILE_BYTES) errors.push(issue('FILE_TOO_LARGE', relative, 'File exceeds the 10 MiB per-file limit.'));
      if (files.length >= MAX_FILES || totalBytes > MAX_BUNDLE_BYTES) {
        errors.push(issue('CANDIDATE_LIMIT_EXCEEDED', null, 'Candidate exceeds 300 files or 30 MiB.'));
        return;
      }
      files.push({
        path: relative,
        absolute,
        bytes: stat.size,
        sha256: sha256(fs.readFileSync(absolute))
      });
    }
  }
  visit(folder);
  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    totalBytes
  };
}

function validateManifest(manifest, folder, errors) {
  if (!manifest) return;
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(manifest.id || ''))) {
    errors.push(issue('MANIFEST_ID_INVALID', 'manifest.json', 'id must use lowercase letters, digits, and hyphens.'));
  }
  if (!String(manifest.name || '').trim()) errors.push(issue('MANIFEST_NAME_MISSING', 'manifest.json'));
  if (!String(manifest.version || '').trim()) errors.push(issue('MANIFEST_VERSION_MISSING', 'manifest.json'));
  if (!STATUSES.has(manifest.status)) errors.push(issue('MANIFEST_STATUS_UNSUPPORTED', 'manifest.json'));
  if (manifest.contract !== 'module.contract.json') {
    errors.push(issue('CONTRACT_DECLARATION_INVALID', 'manifest.json', 'manifest must declare module.contract.json.'));
  }
  if (!Array.isArray(manifest.uses)) errors.push(issue('MANIFEST_USES_INVALID', 'manifest.json'));
  let entry = null;
  try {
    entry = safeRelative(manifest.entry || 'index.html');
    const target = resolveUnder(folder, entry);
    if (!fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isFile()) {
      errors.push(issue('ENTRY_FILE_MISSING', entry));
    }
  } catch (error) {
    errors.push(issue('ENTRY_PATH_UNSAFE', 'manifest.json', error.message));
  }
}

function validateContract(contract, manifest, errors) {
  if (!contract) return;
  if (contract.schema !== CONTRACT_SCHEMA) errors.push(issue('CONTRACT_SCHEMA_INVALID', 'module.contract.json'));
  if (!String(contract.id || '').trim()) errors.push(issue('CONTRACT_ID_MISSING', 'module.contract.json'));
  if (!String(contract.version || '').trim()) errors.push(issue('CONTRACT_VERSION_MISSING', 'module.contract.json'));
  for (const field of ['provides', 'consumes', 'permissions']) {
    if (!Array.isArray(contract[field])) errors.push(issue('CONTRACT_FIELD_INVALID', 'module.contract.json', field + ' must be an array.'));
  }
  if (!contract.handoffs || !Array.isArray(contract.handoffs.emits) || !Array.isArray(contract.handoffs.accepts)) {
    errors.push(issue('CONTRACT_HANDOFFS_INVALID', 'module.contract.json'));
  }
  if (!contract.boundaries || !Array.isArray(contract.boundaries.refuses)) {
    errors.push(issue('CONTRACT_BOUNDARIES_INVALID', 'module.contract.json'));
  }
  if (!contract.lifecycle || typeof contract.lifecycle !== 'object') {
    errors.push(issue('CONTRACT_LIFECYCLE_MISSING', 'module.contract.json'));
  } else {
    for (const [field, allowed] of Object.entries(LIFECYCLE)) {
      if (!allowed.has(contract.lifecycle[field])) {
        errors.push(issue('CONTRACT_LIFECYCLE_INVALID', 'module.contract.json', field + ' is unsupported.'));
      }
    }
  }
  if (manifest) {
    if (contract.id !== manifest.id) errors.push(issue('CONTRACT_ID_MISMATCH', 'module.contract.json'));
    if (contract.version !== manifest.version) errors.push(issue('CONTRACT_VERSION_MISMATCH', 'module.contract.json'));
    const uses = new Set(Array.isArray(manifest.uses) ? manifest.uses : []);
    for (const permission of Array.isArray(contract.permissions) ? contract.permissions : []) {
      if (!uses.has(permission)) {
        errors.push(issue('CONTRACT_PERMISSION_UNDECLARED', 'module.contract.json', String(permission)));
      }
    }
  }
}

function decodeBundle(bundle, errors) {
  if (!bundle || bundle.schema !== BUNDLE_SCHEMA) {
    errors.push(issue('BUNDLE_SCHEMA_INVALID', 'module-bundle.json'));
    return null;
  }
  if (!Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > MAX_FILES) {
    errors.push(issue('BUNDLE_FILE_COUNT_INVALID', 'module-bundle.json'));
    return null;
  }
  const files = [];
  const seen = new Set();
  let totalBytes = 0;
  for (const [index, item] of bundle.files.entries()) {
    let relative;
    try {
      relative = safeRelative(item && item.path);
    } catch (error) {
      errors.push(issue('BUNDLE_PATH_UNSAFE', 'module-bundle.json', 'files[' + index + ']: ' + error.message));
      continue;
    }
    const key = relative.toLowerCase();
    if (seen.has(key)) {
      errors.push(issue('BUNDLE_PATH_DUPLICATE', relative));
      continue;
    }
    seen.add(key);
    if (relative === 'module-bundle.json') {
      errors.push(issue('BUNDLE_SELF_REFERENCE_REFUSED', relative));
      continue;
    }
    const encoding = item.encoding || 'utf8';
    if (!ENCODINGS.has(encoding)) {
      errors.push(issue('BUNDLE_ENCODING_UNSUPPORTED', relative));
      continue;
    }
    const content = String(item.content || '');
    if (encoding === 'base64' && (!/^[a-zA-Z0-9+/]*={0,2}$/.test(content) || content.length % 4 !== 0)) {
      errors.push(issue('BUNDLE_BASE64_INVALID', relative));
      continue;
    }
    const bytes = Buffer.from(content, encoding);
    totalBytes += bytes.length;
    if (bytes.length > MAX_FILE_BYTES || totalBytes > MAX_BUNDLE_BYTES) {
      errors.push(issue('BUNDLE_SIZE_LIMIT_EXCEEDED', relative));
      continue;
    }
    const digest = sha256(bytes);
    if (!item.sha256) {
      errors.push(issue('BUNDLE_FILE_DIGEST_MISSING', relative));
    } else if (String(item.sha256).toLowerCase() !== digest) {
      errors.push(issue('BUNDLE_FILE_DIGEST_MISMATCH', relative));
    }
    files.push({ path: relative, bytes, sha256: digest });
  }
  const rows = files.map(file => ({ path: file.path, sha256: file.sha256 }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    totalBytes,
    digest: sha256(Buffer.from(JSON.stringify(rows)))
  };
}

function validateReceipt(receipt, manifest, warnings, errors) {
  if (!receipt) {
    warnings.push(issue('AUTHORITY_RECEIPT_MISSING', 'candidate.receipt.json'));
    return null;
  }
  if (receipt.schema !== RECEIPT_SCHEMA) errors.push(issue('AUTHORITY_RECEIPT_SCHEMA_INVALID', 'candidate.receipt.json'));
  if (manifest && receipt.candidate) {
    if (receipt.candidate.id !== manifest.id) errors.push(issue('AUTHORITY_RECEIPT_ID_MISMATCH', 'candidate.receipt.json'));
    if (receipt.candidate.version !== manifest.version) errors.push(issue('AUTHORITY_RECEIPT_VERSION_MISMATCH', 'candidate.receipt.json'));
  }
  const authority = receipt.authority;
  if (!authority || typeof authority !== 'object') {
    warnings.push(issue('AUTHORITY_STATE_MISSING', 'candidate.receipt.json'));
    return null;
  }
  const detachedFlags = ['installed', 'registered', 'staged', 'promoted', 'canonChanged', 'permissionsChanged'];
  for (const flag of detachedFlags) {
    if (authority[flag] !== false) {
      errors.push(issue('DETACHED_AUTHORITY_CONFLICT', 'candidate.receipt.json', flag + ' must be explicitly false.'));
    }
  }
  return {
    installed: authority.installed,
    registered: authority.registered,
    staged: authority.staged,
    promoted: authority.promoted,
    canonChanged: authority.canonChanged,
    permissionsChanged: authority.permissionsChanged
  };
}

function inspectCandidate(folder, folderName) {
  const errors = [];
  const warnings = [];
  const scan = walkCandidateFiles(folder, errors);
  const byPath = new Map(scan.files.map(file => [file.path, file]));
  const manifestFile = path.join(folder, 'manifest.json');
  const contractFile = path.join(folder, 'module.contract.json');
  const bundleFile = path.join(folder, 'module-bundle.json');
  const receiptFile = path.join(folder, 'candidate.receipt.json');
  const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile, 'manifest.json', errors) : null;
  const contract = fs.existsSync(contractFile) ? readJson(contractFile, 'module.contract.json', errors) : null;
  const receipt = fs.existsSync(receiptFile) ? readJson(receiptFile, 'candidate.receipt.json', errors) : null;
  if (!fs.existsSync(manifestFile)) errors.push(issue('MANIFEST_MISSING', 'manifest.json'));
  if (!fs.existsSync(contractFile)) errors.push(issue('CONTRACT_MISSING', 'module.contract.json'));
  validateManifest(manifest, folder, errors);
  validateContract(contract, manifest, errors);
  const authority = validateReceipt(receipt, manifest, warnings, errors);

  let decoded = null;
  let bundleFileSha256 = null;
  if (fs.existsSync(bundleFile)) {
    const bundle = readJson(bundleFile, 'module-bundle.json', errors);
    bundleFileSha256 = byPath.get('module-bundle.json') ? byPath.get('module-bundle.json').sha256 : null;
    decoded = decodeBundle(bundle, errors);
  }

  if (decoded) {
    const bundleByPath = new Map(decoded.files.map(file => [file.path, file]));
    for (const required of ['manifest.json', 'module.contract.json']) {
      if (!bundleByPath.has(required)) errors.push(issue('BUNDLE_REQUIRED_FILE_MISSING', required));
    }
    if (manifest) {
      try {
        const entry = safeRelative(manifest.entry || 'index.html');
        if (!bundleByPath.has(entry)) errors.push(issue('BUNDLE_ENTRY_MISSING', entry));
      } catch (_) {}
    }
    const currentFiles = scan.files.filter(file => file.path !== 'module-bundle.json');
    for (const current of currentFiles) {
      const bundled = bundleByPath.get(current.path);
      if (!bundled) {
        errors.push(issue('BUNDLE_MISSING_CURRENT_FILE', current.path));
      } else if (bundled.sha256 !== current.sha256) {
        errors.push(issue('BUNDLE_FOLDER_DRIFT', current.path, 'Folder bytes no longer match the bundle.'));
      }
    }
    for (const bundled of decoded.files) {
      if (!byPath.has(bundled.path)) errors.push(issue('BUNDLE_FILE_NOT_IN_FOLDER', bundled.path));
    }
  }

  let status;
  if (errors.length) status = 'NEEDS_REPAIR';
  else if (!decoded) status = 'DRAFT';
  else if (warnings.length) status = 'REVIEW_REQUIRED';
  else status = 'READY_FOR_LATER_INTAKE';

  return {
    schema: RECORD_SCHEMA,
    folder: folderName,
    id: manifest && manifest.id || null,
    name: manifest && manifest.name || folderName,
    version: manifest && manifest.version || null,
    declaredStatus: manifest && manifest.status || null,
    status,
    structuralInspectionOnly: true,
    fileCount: scan.files.length,
    totalBytes: scan.totalBytes,
    manifestSha256: byPath.get('manifest.json') ? byPath.get('manifest.json').sha256 : null,
    contractSha256: byPath.get('module.contract.json') ? byPath.get('module.contract.json').sha256 : null,
    bundle: decoded ? {
      fileSha256: bundleFileSha256,
      canonicalDigest: decoded.digest,
      fileCount: decoded.files.length,
      totalBytes: decoded.totalBytes,
      exactFolderParity: !errors.some(item => item.code.startsWith('BUNDLE_'))
    } : null,
    authority,
    errors,
    warnings,
    truth: {
      codeExecuted: false,
      staged: false,
      installed: false,
      promoted: false,
      canonChanged: false,
      runtimeReadinessProven: false,
      visualApprovalProven: false
    }
  };
}

function scanSupply(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('candidate root must be an existing directory');
  }
  const excludedFolders = new Set((options.excludeFolders || []).map(value => String(value)));
  const excludedArchives = new Set((options.excludeArchives || []).map(value => String(value)));
  const candidates = [];
  const archives = [];
  const skippedSymlinks = [];
  const ignoredEntries = [];
  const entries = fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      skippedSymlinks.push(entry.name);
      continue;
    }
    if (entry.isDirectory()) {
      if (!excludedFolders.has(entry.name)) candidates.push(inspectCandidate(absolute, entry.name));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
      if (excludedArchives.has(entry.name)) continue;
      const stat = fs.statSync(absolute);
      archives.push({
        file: entry.name,
        bytes: stat.size,
        sha256: stat.size <= MAX_ARCHIVE_BYTES ? sha256(fs.readFileSync(absolute)) : null,
        digestStatus: stat.size <= MAX_ARCHIVE_BYTES ? 'RECORDED' : 'SKIPPED_SIZE_LIMIT'
      });
      continue;
    }
    ignoredEntries.push(entry.name);
  }
  const counts = {
    total: candidates.length,
    readyForLaterIntake: candidates.filter(item => item.status === 'READY_FOR_LATER_INTAKE').length,
    reviewRequired: candidates.filter(item => item.status === 'REVIEW_REQUIRED').length,
    drafts: candidates.filter(item => item.status === 'DRAFT').length,
    needsRepair: candidates.filter(item => item.status === 'NEEDS_REPAIR').length
  };
  const fingerprintEvidence = {
    candidates: candidates.map(item => ({
      folder: item.folder,
      id: item.id,
      status: item.status,
      manifestSha256: item.manifestSha256,
      contractSha256: item.contractSha256,
      bundleFileSha256: item.bundle && item.bundle.fileSha256,
      bundleCanonicalDigest: item.bundle && item.bundle.canonicalDigest,
      errors: item.errors,
      warnings: item.warnings
    })),
    archives,
    excludedFolders: Array.from(excludedFolders).sort((a, b) => a.localeCompare(b)),
    excludedArchives: Array.from(excludedArchives).sort((a, b) => a.localeCompare(b)),
    skippedSymlinks,
    ignoredEntries
  };
  return {
    schema: REGISTRY_SCHEMA,
    version: 'v0.1',
    measuredAt: new Date(options.now || Date.now()).toISOString(),
    source: {
      label: path.basename(root),
      fingerprint: sha256(Buffer.from(JSON.stringify(fingerprintEvidence))),
      pathExposed: false,
      topLevelOnly: true,
      symlinksFollowed: false,
      excludedFolders: Array.from(excludedFolders).sort((a, b) => a.localeCompare(b)),
      excludedArchives: Array.from(excludedArchives).sort((a, b) => a.localeCompare(b))
    },
    summary: counts,
    candidates,
    archives,
    skippedSymlinks,
    ignoredEntries,
    truth: {
      structuralInspectionOnly: true,
      candidateCodeExecuted: false,
      archiveExtracted: false,
      stagingPerformed: false,
      installationPerformed: false,
      automaticRepair: false,
      permissionChanged: false,
      canonChanged: false,
      automaticAction: false
    }
  };
}

module.exports = {
  REGISTRY_SCHEMA,
  RECORD_SCHEMA,
  BUNDLE_SCHEMA,
  CONTRACT_SCHEMA,
  RECEIPT_SCHEMA,
  STATUSES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_BUNDLE_BYTES,
  sha256,
  safeRelative,
  decodeBundle,
  inspectCandidate,
  scanSupply
};
