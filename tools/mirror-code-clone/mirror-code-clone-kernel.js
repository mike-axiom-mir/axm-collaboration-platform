'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');

const CANDIDATE_SCHEMA = 'axm.disposable-code-candidate/v1';
const RECEIPT_SCHEMA = 'axm.mirror-code-clone.receipt/v1';
const MARKER = '.axm-mirror-code-clone-candidate.json';
const REPAIR_CLASS = 'declare-contracted-manifest-permissions';
const COMPLETENESS_REPAIR_CLASS = 'declare-empty-manifest-permissions-field';
const WORKSHOP_ROOT = path.resolve(__dirname, '..', '..');
const EXPORT_ROOT = path.join(WORKSHOP_ROOT, 'exports', 'mirror-code-clone', 'candidates');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function isWithin(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function assertOrdinaryFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(label + ' cannot be a symlink');
  if (!stat.isFile()) throw new Error(label + ' must be a regular file');
}

function assertOrdinaryDirectory(dirPath, label) {
  const stat = fs.lstatSync(dirPath);
  if (stat.isSymbolicLink()) throw new Error(label + ' cannot be a symlink');
  if (!stat.isDirectory()) throw new Error(label + ' must be a directory');
}

function assertCandidateRoot(inputRoot) {
  const root = path.resolve(inputRoot);
  if (!fs.existsSync(root)) throw new Error('candidate root does not exist');
  assertOrdinaryDirectory(root, 'candidate root');
  const realRoot = path.resolve(fs.realpathSync(root));
  if (realRoot.toLowerCase() !== root.toLowerCase()) throw new Error('candidate root cannot resolve through a link or junction');
  const allowed = isWithin(root, os.tmpdir()) || isWithin(root, EXPORT_ROOT);
  if (!allowed) throw new Error('candidate root is outside the disposable write zones');
  if (root === WORKSHOP_ROOT || isWithin(root, path.join(WORKSHOP_ROOT, 'tools')) || isWithin(root, path.join(WORKSHOP_ROOT, 'shared')) || isWithin(root, path.join(WORKSHOP_ROOT, 'museum'))) {
    throw new Error('Workshop source and Mirror roots are never candidate write zones');
  }
  const markerPath = path.join(root, MARKER);
  if (!fs.existsSync(markerPath)) throw new Error('candidate marker is missing');
  assertOrdinaryFile(markerPath, 'candidate marker');
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  if (marker.schema !== CANDIDATE_SCHEMA || marker.writeScope !== 'this-root-only') throw new Error('candidate marker is invalid');
  return { root, marker };
}

function readModule(root, folder) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(folder)) throw new Error('unsafe module folder');
  const moduleRoot = path.join(root, 'tools', folder);
  const manifestPath = path.join(moduleRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  assertOrdinaryDirectory(moduleRoot, 'module root');
  assertOrdinaryFile(manifestPath, 'manifest');
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  let manifest;
  try { manifest = JSON.parse(manifestText); } catch (error) {
    return { folder, manifestPath, manifestText, manifest: null, contract: null, check: { pass: false, errors: ['manifest is not valid JSON: ' + error.message] } };
  }
  if (!manifest.contract || typeof manifest.contract !== 'string' || path.basename(manifest.contract) !== manifest.contract) {
    return { folder, manifestPath, manifestText, manifest, contract: null, check: { pass: false, errors: ['bounded contract file is not declared'] } };
  }
  const contractPath = path.join(moduleRoot, manifest.contract);
  if (!fs.existsSync(contractPath)) return { folder, manifestPath, manifestText, manifest, contract: null, check: { pass: false, errors: ['declared contract file missing'] } };
  assertOrdinaryFile(contractPath, 'contract');
  let contract;
  try { contract = JSON.parse(fs.readFileSync(contractPath, 'utf8')); } catch (error) {
    return { folder, manifestPath, manifestText, manifest, contract: null, check: { pass: false, errors: ['contract is not valid JSON: ' + error.message] } };
  }
  return { folder, manifestPath, manifestText, manifest, contract, check: ContractVerifier.validateContract(contract, manifest) };
}

function repairPlan(module) {
  if (!module || !module.manifest) return null;
  if (!Object.prototype.hasOwnProperty.call(module.manifest, 'permissions')) {
    return {
      repairClass: COMPLETENESS_REPAIR_CLASS,
      moduleId: module.manifest.id,
      folder: module.folder,
      missingPermissions: [],
      editCount: 1,
      beforeErrors: ['manifest permissions must be an array']
    };
  }
  if (!module.contract) return null;
  if (module.manifest.schema !== ContractVerifier.MANIFEST_SCHEMA) return null;
  if (!Array.isArray(module.manifest.permissions) || !Array.isArray(module.contract.permissions)) return null;
  const missing = module.contract.permissions.filter(permission => !module.manifest.permissions.includes(permission));
  const extras = module.manifest.permissions.filter(permission => !module.contract.permissions.includes(permission));
  const expectedErrors = missing.map(permission => 'contract permission not declared in manifest permissions: ' + permission);
  if (!missing.length || extras.length) return null;
  if (module.check.errors.length !== expectedErrors.length || expectedErrors.some(error => !module.check.errors.includes(error))) return null;
  if (missing.some(permission => typeof permission !== 'string' || !/^[a-z][a-z0-9.-]{0,63}$/.test(permission))) return null;
  return {
    repairClass: REPAIR_CLASS,
    moduleId: module.manifest.id,
    folder: module.folder,
    missingPermissions: missing.slice(),
    editCount: missing.length,
    beforeErrors: module.check.errors.slice()
  };
}

function verifyRepair(beforeModule, afterModule, plan) {
  if (plan.repairClass === COMPLETENESS_REPAIR_CLASS) {
    const beforeComparable = { ...beforeModule.manifest };
    const afterComparable = { ...afterModule.manifest };
    delete beforeComparable.permissions;
    delete afterComparable.permissions;
    const pass = Array.isArray(afterModule.manifest.permissions) && afterModule.manifest.permissions.length === 0 && stableJson(beforeComparable) === stableJson(afterComparable);
    return {
      pass,
      errors: pass ? [] : ['candidate did not add exactly one empty permissions field'],
      scope: 'manifest-permissions-field-only',
      remainingModuleErrors: afterModule.check && afterModule.check.pass ? [] : (afterModule.check && afterModule.check.errors || [])
    };
  }
  return { ...afterModule.check, scope: 'module-contract-verifier' };
}

function scanCandidate(inputRoot) {
  const { root, marker } = assertCandidateRoot(inputRoot);
  const toolsRoot = path.join(root, 'tools');
  if (!fs.existsSync(toolsRoot)) throw new Error('candidate tools folder is missing');
  assertOrdinaryDirectory(toolsRoot, 'candidate tools folder');
  const rows = [];
  for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('_')) continue;
    const module = readModule(root, entry.name);
    if (module) rows.push({ module, plan: repairPlan(module) });
  }
  const repairable = rows.filter(row => row.plan).map(row => row.plan).sort((a, b) => a.editCount - b.editCount || a.moduleId.localeCompare(b.moduleId));
  return {
    root,
    marker,
    rows,
    repairable,
    selected: repairable[0] || null,
    summary: {
      inspected: rows.length,
      passing: rows.filter(row => row.module.check.pass).length,
      failing: rows.filter(row => !row.module.check.pass).length,
      repairable: repairable.length
    }
  };
}

function writeExactWithBackup(target, newText) {
  const backup = target + '.mirror-code-clone-backup';
  if (fs.existsSync(backup)) throw new Error('stale candidate transaction backup must be reviewed first');
  fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
  try {
    fs.writeFileSync(target, newText);
  } catch (error) {
    restoreBackup(target, backup);
    throw error;
  }
  return backup;
}

function restoreBackup(target, backup) {
  if (fs.existsSync(target)) fs.rmSync(target);
  fs.renameSync(backup, target);
}

function improveCandidate(inputRoot, options = {}) {
  const before = scanCandidate(inputRoot);
  if (!before.selected) {
    return { schema: RECEIPT_SCHEMA, status: 'NO_REPAIRABLE_CANDIDATE', changed: false, summary: before.summary };
  }
  const selected = before.selected;
  const row = before.rows.find(item => item.plan && item.plan.moduleId === selected.moduleId);
  const originalText = row.module.manifestText;
  const patchedPermissions = selected.repairClass === COMPLETENESS_REPAIR_CLASS
    ? []
    : row.module.manifest.permissions.concat(selected.missingPermissions);
  const patched = { ...row.module.manifest, permissions: patchedPermissions };
  const patchedText = JSON.stringify(patched, null, 2) + '\n';
  const target = row.module.manifestPath;
  const backup = writeExactWithBackup(target, patchedText);
  let afterModule;
  let postCheck;
  let rolledBack = false;
  try {
    afterModule = readModule(before.root, selected.folder);
    const defaultCheck = verifyRepair(row.module, afterModule, selected);
    postCheck = typeof options.verifyCandidate === 'function'
      ? options.verifyCandidate({ defaultCheck, module: afterModule, plan: selected })
      : defaultCheck;
    if (!postCheck || postCheck.pass !== true) {
      restoreBackup(target, backup);
      rolledBack = true;
    } else {
      fs.rmSync(backup);
    }
  } catch (error) {
    if (fs.existsSync(backup)) restoreBackup(target, backup);
    rolledBack = true;
    postCheck = { pass: false, errors: [error.message] };
  }
  const finalText = fs.readFileSync(target, 'utf8');
  const evidence = {
    repairClass: selected.repairClass,
    selectedWithoutNamedTarget: true,
    moduleId: selected.moduleId,
    relativePath: path.relative(before.root, target).replace(/\\/g, '/'),
    addedPermissions: selected.missingPermissions,
    declaredPermissionsField: selected.repairClass === COMPLETENESS_REPAIR_CLASS,
    beforeSha256: sha256(originalText),
    proposedSha256: sha256(patchedText),
    finalSha256: sha256(finalText),
    beforeErrors: selected.beforeErrors,
    verifier: postCheck,
    rolledBack,
    changed: !rolledBack && finalText === patchedText
  };
  const boundaries = {
    candidateRootOnly: true,
    sourceWorkshopWriteAttempted: false,
    originalMirrorWriteAttempted: false,
    installed: false,
    promoted: false,
    published: false
  };
  const artifactDigest = sha256(stableJson({ schema: RECEIPT_SCHEMA, evidence, boundaries }));
  const runId = artifactDigest.slice(0, 20);
  return {
    schema: RECEIPT_SCHEMA,
    runId,
    status: evidence.changed ? 'IMPROVED_CANDIDATE' : 'ROLLED_BACK',
    changed: evidence.changed,
    candidateLabel: before.marker.label || path.basename(before.root),
    discovery: { ...before.summary, selectedModuleId: selected.moduleId, selectionRule: 'fewest-edits-then-module-id' },
    evidence,
    artifactDigest,
    boundaries
  };
}

function assertSourceRoot(inputRoot) {
  const root = path.resolve(inputRoot);
  if (!fs.existsSync(root)) throw new Error('source root does not exist');
  assertOrdinaryDirectory(root, 'source root');
  if (path.resolve(fs.realpathSync(root)).toLowerCase() !== root.toLowerCase()) throw new Error('source root cannot resolve through a link or junction');
  const toolsRoot = path.join(root, 'tools');
  if (!fs.existsSync(toolsRoot)) throw new Error('source tools folder is missing');
  assertOrdinaryDirectory(toolsRoot, 'source tools folder');
  return { root, toolsRoot };
}

function discoverWorkshopDraftPlans(inputRoot, options = {}) {
  const { root, toolsRoot } = assertSourceRoot(inputRoot);
  const excluded = new Set(Array.isArray(options.excludeFingerprints) ? options.excludeFingerprints : []);
  const plans = [];
  for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('_') || entry.name.startsWith('mirror-')) continue;
    const module = readModule(root, entry.name);
    const plan = repairPlan(module);
    if (!plan) continue;
    const sourceSha256 = sha256(module.manifestText);
    const fingerprint = sha256(stableJson({ moduleId: plan.moduleId, repairClass: plan.repairClass, sourceSha256 }));
    if (excluded.has(fingerprint)) continue;
    plans.push({ ...plan, sourceRelativePath: path.relative(root, module.manifestPath).replace(/\\/g, '/'), sourceSha256, fingerprint });
  }
  return plans.sort((a, b) => a.editCount - b.editCount || a.moduleId.localeCompare(b.moduleId));
}

function assertNewCandidateLocation(inputRoot) {
  const root = path.resolve(inputRoot);
  if (fs.existsSync(root)) throw new Error('candidate draft root already exists');
  const allowed = isWithin(root, os.tmpdir()) || isWithin(root, EXPORT_ROOT);
  if (!allowed) throw new Error('candidate draft root is outside the disposable write zones');
  return root;
}

function stageWorkshopDraft(inputSourceRoot, inputCandidateRoot, requestedPlan) {
  const { root: sourceRoot } = assertSourceRoot(inputSourceRoot);
  const candidateRoot = assertNewCandidateLocation(inputCandidateRoot);
  const currentPlan = discoverWorkshopDraftPlans(sourceRoot).find(plan => plan.fingerprint === requestedPlan.fingerprint);
  if (!currentPlan) throw new Error('source changed or the requested draft is no longer repairable');
  const sourceManifest = path.join(sourceRoot, currentPlan.sourceRelativePath);
  assertOrdinaryFile(sourceManifest, 'source manifest');
  const sourceTextBefore = fs.readFileSync(sourceManifest, 'utf8');
  if (sha256(sourceTextBefore) !== currentPlan.sourceSha256) throw new Error('source changed before candidate staging');
  const candidateParent = path.dirname(candidateRoot);
  fs.mkdirSync(candidateParent, { recursive: true });
  assertOrdinaryDirectory(candidateParent, 'candidate parent');
  if (path.resolve(fs.realpathSync(candidateParent)).toLowerCase() !== path.resolve(candidateParent).toLowerCase()) {
    throw new Error('candidate parent cannot resolve through a link or junction');
  }
  fs.mkdirSync(candidateRoot);
  const marker = {
    schema: CANDIDATE_SCHEMA,
    writeScope: 'this-root-only',
    label: 'heartbeat-code-draft-' + currentPlan.moduleId,
    sourceRelativePath: currentPlan.sourceRelativePath,
    sourceSha256: currentPlan.sourceSha256,
    repairClass: currentPlan.repairClass
  };
  fs.writeFileSync(path.join(candidateRoot, MARKER), JSON.stringify(marker, null, 2) + '\n', { flag: 'wx' });
  const candidateModuleRoot = path.join(candidateRoot, 'tools', currentPlan.folder);
  fs.mkdirSync(candidateModuleRoot, { recursive: true });
  fs.copyFileSync(sourceManifest, path.join(candidateModuleRoot, 'manifest.json'), fs.constants.COPYFILE_EXCL);
  const parsed = JSON.parse(sourceTextBefore);
  if (parsed.contract && path.basename(parsed.contract) === parsed.contract) {
    const sourceContract = path.join(path.dirname(sourceManifest), parsed.contract);
    if (fs.existsSync(sourceContract)) {
      assertOrdinaryFile(sourceContract, 'source contract');
      fs.copyFileSync(sourceContract, path.join(candidateModuleRoot, parsed.contract), fs.constants.COPYFILE_EXCL);
    }
  }
  const receipt = improveCandidate(candidateRoot);
  const sourceTextAfter = fs.readFileSync(sourceManifest, 'utf8');
  receipt.source = {
    relativePath: currentPlan.sourceRelativePath,
    beforeSha256: currentPlan.sourceSha256,
    afterSha256: sha256(sourceTextAfter),
    unchanged: sourceTextAfter === sourceTextBefore,
    writeAttempted: false
  };
  if (!receipt.source.unchanged) throw new Error('source changed while the candidate draft was being built');
  receipt.draft = { fingerprint: currentPlan.fingerprint, reviewRequired: true, automaticApply: false, queueRetentionDays: 7 };
  receipt.artifactDigest = sha256(stableJson({ schema: receipt.schema, evidence: receipt.evidence, source: receipt.source, draft: receipt.draft, boundaries: receipt.boundaries }));
  receipt.runId = receipt.artifactDigest.slice(0, 20);
  const receiptPath = writeReceipt(candidateRoot, receipt);
  return { candidateRoot, receiptPath, receipt };
}

function writeReceipt(inputRoot, receipt) {
  const { root } = assertCandidateRoot(inputRoot);
  const receiptRoot = path.join(root, '.mirror-code-clone-receipts');
  fs.mkdirSync(receiptRoot, { recursive: true });
  const receiptPath = path.join(receiptRoot, (receipt.runId || 'no-change') + '.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  return receiptPath;
}

module.exports = {
  CANDIDATE_SCHEMA,
  RECEIPT_SCHEMA,
  MARKER,
  REPAIR_CLASS,
  COMPLETENESS_REPAIR_CLASS,
  sha256,
  assertCandidateRoot,
  scanCandidate,
  improveCandidate,
  discoverWorkshopDraftPlans,
  stageWorkshopDraft,
  writeReceipt
};
