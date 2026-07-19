'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');
const ContractVerifier = require('../../hub/module-contract-verifier');

const BUNDLE_SCHEMA = 'axm.module-bundle/v1';
const STATUSES = new Set(['EXPERIMENTAL','TEST','WORKING','CANON','SHELL','BROKEN']);
const TEXT_ENCODINGS = new Set(['utf8','base64']);

function canonicalDigest(files) {
  const rows = files.map(file => ({ path: file.path, sha256: U.sha256(file.bytes) })).sort((a, b) => a.path.localeCompare(b.path));
  return U.sha256(Buffer.from(JSON.stringify(rows)));
}

function decodeBundle(input) {
  if (!input || input.schema !== BUNDLE_SCHEMA) throw new Error('bundle schema must be ' + BUNDLE_SCHEMA);
  if (!Array.isArray(input.files) || !input.files.length || input.files.length > 300) throw new Error('bundle must contain 1–300 files');
  let total = 0;
  const seen = new Set(), files = input.files.map(item => {
    const rel = U.safeRelative(item.path);
    if (seen.has(rel.toLowerCase())) throw new Error('duplicate bundle path: ' + rel);
    seen.add(rel.toLowerCase());
    const encoding = item.encoding || 'utf8';
    if (!TEXT_ENCODINGS.has(encoding)) throw new Error('unsupported bundle encoding');
    const bytes = Buffer.from(String(item.content || ''), encoding);
    total += bytes.length;
    if (bytes.length > 10 * 1024 * 1024 || total > 30 * 1024 * 1024) throw new Error('bundle size safety limit exceeded');
    if (item.sha256 && String(item.sha256).toLowerCase() !== U.sha256(bytes)) throw new Error('bundle digest mismatch: ' + rel);
    return { path: rel, bytes };
  });
  return { files, totalBytes: total, digest: canonicalDigest(files) };
}

function inspectDecoded(decoded) {
  const errors = [], warnings = [], find = name => decoded.files.find(file => file.path === name);
  const manifestFile = find('manifest.json'), contractFile = find('module.contract.json');
  if (!manifestFile) errors.push('manifest.json is required');
  if (!contractFile) errors.push('module.contract.json is required');
  let manifest = null, contract = null;
  try { if (manifestFile) manifest = JSON.parse(manifestFile.bytes.toString('utf8')); } catch (error) { errors.push('manifest.json is invalid: ' + error.message); }
  try { if (contractFile) contract = JSON.parse(contractFile.bytes.toString('utf8')); } catch (error) { errors.push('module.contract.json is invalid: ' + error.message); }
  if (manifest) {
    try { U.cleanId(manifest.id, 'manifest id'); } catch (error) { errors.push(error.message); }
    if (!String(manifest.name || '').trim()) errors.push('manifest name is required');
    if (!String(manifest.version || '').trim()) errors.push('manifest version is required');
    if (!STATUSES.has(manifest.status)) errors.push('manifest status is unsupported');
    if (manifest.contract !== 'module.contract.json') errors.push('manifest must declare module.contract.json');
    try { if (!find(U.safeRelative(manifest.entry || 'index.html'))) errors.push('manifest entry file is missing'); } catch (error) { errors.push('manifest entry path is unsafe'); }
    if (!Array.isArray(manifest.uses)) errors.push('manifest uses must be an array');
  }
  if (manifest && contract) {
    const result = ContractVerifier.validateContract(contract, manifest);
    errors.push(...result.errors);
    if (!contract.lifecycle) errors.push('contract lifecycle declaration is required for governed install');
  }
  decoded.files.forEach(file => {
    if (/\.(?:js|cjs|mjs|html)$/i.test(file.path)) {
      const source = file.bytes.toString('utf8');
      if (/\b(?:child_process|powershell(?:\.exe)?|cmd\.exe|execSync|spawnSync)\b/i.test(source)) warnings.push(file.path + ': host execution token found; manual review required');
      if (/https?:\/\//i.test(source)) warnings.push(file.path + ': remote URL found; network boundary needs review');
      if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) warnings.push(file.path + ': dynamic code construction found');
    }
  });
  return { pass: errors.length === 0, errors, warnings: Array.from(new Set(warnings)), manifest, contract };
}

function create(options) {
  const root = options.root, toolsRoot = path.join(root, 'tools'), stateDir = path.join(options.stateRoot, 'module-installer');
  const candidatesDir = path.join(stateDir, 'candidates'), indexFile = path.join(stateDir, 'candidates.json'), auditFile = path.join(stateDir, 'audit.jsonl');
  const backupRoot = path.join(options.backupRoot || path.join(root, 'backups'), 'module-installer'), review = options.reviewService;
  function index() { return U.loadJson(indexFile, { schema: 'axm.module-installer.candidates/v1', candidates: [] }); }
  function saveIndex(state) { state.updatedAt = U.now(); U.atomicJson(indexFile, state); }
  function candidate(id) { return index().candidates.find(item => item.id === id) || null; }
  function stagedFiles(id) { return path.join(candidatesDir, id, 'files'); }

  function stage(bundle, actor) {
    const decoded = decodeBundle(bundle), inspection = inspectDecoded(decoded);
    if (!inspection.pass) throw new Error(inspection.errors.join('; '));
    const id = U.uid('candidate'), moduleId = inspection.manifest.id, folder = stagedFiles(id);
    fs.mkdirSync(folder, { recursive: true });
    decoded.files.forEach(file => { const target = U.resolveUnder(folder, file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, file.bytes); });
    const target = path.join(toolsRoot, moduleId), mode = fs.existsSync(target) ? 'update' : 'install';
    const reviewItem = review.submit({ kind: 'module-' + mode, title: (mode === 'install' ? 'Install ' : 'Update ') + inspection.manifest.name, sourceRef: 'installer:' + id, artifactDigest: decoded.digest, summary: inspection.manifest.name + ' ' + inspection.manifest.version + ' · ' + decoded.files.length + ' files · ' + inspection.warnings.length + ' review warning(s)', requiredSeats: bundle.requiredSeats || 1, action: { kind: 'installer-apply', candidateId: id } });
    const record = { id, moduleId, name: inspection.manifest.name, version: inspection.manifest.version, mode, state: inspection.warnings.length ? 'REVIEW_WARNINGS' : 'AWAITING_REVIEW', digest: decoded.digest, fileCount: decoded.files.length, totalBytes: decoded.totalBytes, warnings: inspection.warnings, reviewId: reviewItem.id, stagedAt: U.now(), stagedBy: String(actor || 'local-user').slice(0, 120), appliedAt: null, backupId: null };
    const state = index(); state.candidates.unshift(record); saveIndex(state); U.appendJsonl(auditFile, { type: 'staged', at: U.now(), id, moduleId, mode, digest: decoded.digest, actor: record.stagedBy, warnings: inspection.warnings });
    return U.clone(record);
  }

  function replaceFromFolder(source, moduleId, label) {
    const target = path.join(toolsRoot, moduleId), suffix = U.uid('swap').replace(/[^a-z0-9-]/g, ''), temp = path.join(toolsRoot, '_' + moduleId + '-installing-' + suffix), previous = path.join(toolsRoot, '_' + moduleId + '-previous-' + suffix);
    U.assertUnder(temp, toolsRoot); U.assertUnder(previous, toolsRoot);
    U.copyTree(source, temp);
    let movedOld = false;
    try {
      if (fs.existsSync(target)) { fs.renameSync(target, previous); movedOld = true; }
      fs.renameSync(temp, target);
      if (movedOld && fs.existsSync(previous)) fs.rmSync(previous, { recursive: true, force: true });
    } catch (error) {
      try { if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true }); } catch (_) {}
      try { if (movedOld && fs.existsSync(previous)) fs.renameSync(previous, target); } catch (_) {}
      try { if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true }); } catch (_) {}
      throw new Error(label + ' failed and previous module was restored: ' + error.message);
    }
  }

  function apply(id, input) {
    const record = candidate(id); if (!record) throw new Error('candidate not found');
    if (record.appliedAt) throw new Error('candidate was already applied');
    if (!review.approved(record.reviewId, record.digest)) throw new Error('exact candidate digest is not approved in Review Inbox');
    if (String(input && input.confirmation || '') !== 'INSTALL REVIEWED MODULE') throw new Error('exact install confirmation is required');
    const source = stagedFiles(id); if (!fs.existsSync(source)) throw new Error('staged candidate files are unavailable');
    const decoded = { files: U.walk(source, { maxFiles: 300, maxBytes: 30 * 1024 * 1024 }).files.map(file => ({ path: file.relative, bytes: fs.readFileSync(file.absolute) })) };
    decoded.digest = canonicalDigest(decoded.files); const inspection = inspectDecoded(decoded);
    if (!inspection.pass || decoded.digest !== record.digest || inspection.manifest.id !== record.moduleId) throw new Error('staged candidate no longer matches its approved digest');
    const target = path.join(toolsRoot, record.moduleId); let backupId = null;
    if (fs.existsSync(target)) {
      backupId = U.uid('backup'); const backup = path.join(backupRoot, record.moduleId, backupId); U.copyTree(target, backup);
      U.atomicJson(path.join(backup, 'AXM_INSTALL_BACKUP.json'), { schema: 'axm.module-install-backup/v1', backupId, moduleId: record.moduleId, candidateId: id, candidateDigest: record.digest, createdAt: U.now() });
    }
    replaceFromFolder(source, record.moduleId, 'module install');
    const state = index(), saved = state.candidates.find(item => item.id === id); saved.state = 'APPLIED'; saved.appliedAt = U.now(); saved.appliedBy = String(input.actor || 'local-user').slice(0, 120); saved.backupId = backupId; saveIndex(state);
    U.appendJsonl(auditFile, { type: 'applied', at: saved.appliedAt, id, moduleId: record.moduleId, digest: record.digest, backupId, actor: saved.appliedBy });
    return U.clone(saved);
  }

  function backups(moduleId) {
    const base = path.join(backupRoot, U.cleanId(moduleId, 'moduleId')); if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => {
      const file = path.join(base, x.name, 'AXM_INSTALL_BACKUP.json'); return U.loadJson(file, { backupId: x.name, moduleId, createdAt: null });
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function rollback(moduleId, backupId, input) {
    moduleId = U.cleanId(moduleId, 'moduleId'); backupId = U.cleanId(backupId, 'backupId');
    if (String(input && input.confirmation || '') !== 'ROLL BACK MODULE') throw new Error('exact rollback confirmation is required');
    const source = path.join(backupRoot, moduleId, backupId); U.assertUnder(source, backupRoot);
    if (!fs.existsSync(path.join(source, 'manifest.json'))) throw new Error('backup is unavailable or invalid');
    const restoreSource = path.join(stateDir, 'rollback-stage-' + U.uid('tmp')); fs.mkdirSync(restoreSource, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) if (entry.name !== 'AXM_INSTALL_BACKUP.json') U.copyTree(path.join(source, entry.name), path.join(restoreSource, entry.name));
    try { replaceFromFolder(restoreSource, moduleId, 'module rollback'); } finally { if (fs.existsSync(restoreSource)) fs.rmSync(restoreSource, { recursive: true, force: true }); }
    U.appendJsonl(auditFile, { type: 'rollback', at: U.now(), moduleId, backupId, actor: String(input.actor || 'local-user').slice(0, 120) });
    return { moduleId, backupId, state: 'ROLLED_BACK', at: U.now() };
  }

  function list() { return index().candidates.map(U.clone); }
  return { bundleSchema: BUNDLE_SCHEMA, decodeBundle, inspectDecoded, stage, apply, rollback, backups, list, candidate, auditFile, indexFile };
}

module.exports = { BUNDLE_SCHEMA, decodeBundle, inspectDecoded, canonicalDigest, create };

