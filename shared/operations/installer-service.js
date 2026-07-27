'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');
const ContractVerifier = require('../../hub/module-contract-verifier');
const WorkshopReturn = require('./workshop-package-return');

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
  const backupRoot = path.join(options.backupRoot || path.join(root, 'backups'), 'module-installer'), review = options.reviewService, machine = options.machineHost || null;
  function index() { return U.loadJson(indexFile, { schema: 'axm.module-installer.candidates/v1', candidates: [] }); }
  function saveIndex(state) { state.updatedAt = U.now(); U.atomicJson(indexFile, state); }
  function candidate(id) { return index().candidates.find(item => item.id === id) || null; }
  function stagedFiles(id) { return path.join(candidatesDir, id, 'files'); }

  function moduleDigest(folder) {
    const files = U.walk(folder, { maxFiles: 300, maxBytes: 30 * 1024 * 1024 }).files.map(file => ({ path: file.relative, bytes: fs.readFileSync(file.absolute) }));
    return canonicalDigest(files);
  }

  function stage(bundle, actor, intake) {
    const decoded = decodeBundle(bundle), inspection = inspectDecoded(decoded);
    if (!inspection.pass) throw new Error(inspection.errors.join('; '));
    const id = U.uid('candidate'), moduleId = inspection.manifest.id, folder = stagedFiles(id);
    fs.mkdirSync(folder, { recursive: true });
    decoded.files.forEach(file => { const target = U.resolveUnder(folder, file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, file.bytes); });
    const target = path.join(toolsRoot, moduleId), mode = fs.existsSync(target) ? 'update' : 'install';
    const changeNote = intake && intake.changes ? ' · return +' + intake.changes.added.length + ' ~' + intake.changes.modified.length + ' -' + intake.changes.removed.length + ' · base ' + intake.baseBinding : '';
    const reviewItem = review.submit({ kind: 'module-' + mode, title: (mode === 'install' ? 'Install ' : 'Update ') + inspection.manifest.name, sourceRef: 'installer:' + id, artifactDigest: decoded.digest, summary: inspection.manifest.name + ' ' + inspection.manifest.version + ' · ' + decoded.files.length + ' files · ' + inspection.warnings.length + ' review warning(s)' + changeNote, requiredSeats: bundle.requiredSeats || 1, action: { kind: 'installer-apply', candidateId: id } });
    const record = { id, moduleId, name: inspection.manifest.name, version: inspection.manifest.version, mode, state: inspection.warnings.length ? 'REVIEW_WARNINGS' : 'AWAITING_REVIEW', digest: decoded.digest, fileCount: decoded.files.length, totalBytes: decoded.totalBytes, warnings: inspection.warnings, intake: intake ? U.clone(intake) : null, reviewId: reviewItem.id, stagedAt: U.now(), stagedBy: String(actor || 'local-user').slice(0, 120), appliedAt: null, backupId: null, backupRetentionRemoved: 0, verificationJobId: null, verificationState: 'NOT_RUN' };
    const state = index(); state.candidates.unshift(record); saveIndex(state); U.appendJsonl(auditFile, { type: 'staged', at: U.now(), id, moduleId, mode, digest: decoded.digest, actor: record.stagedBy, warnings: inspection.warnings });
    return U.clone(record);
  }

  function stageReturnedZip(input, actor) {
    const prepared = WorkshopReturn.inspect(input, { root, tempRoot: path.join(stateDir, 'return-temp') });
    return stage(prepared.bundle, actor, prepared.intake);
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

  function retainOnlyBackup(moduleId, keepBackupId) {
    const base = path.join(backupRoot, U.cleanId(moduleId, 'moduleId'));
    U.assertUnder(base, backupRoot);
    if (!fs.existsSync(base)) return 0;
    let removed = 0;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === keepBackupId) continue;
      const target = path.join(base, entry.name); U.assertUnder(target, base);
      fs.rmSync(target, { recursive: true, force: true }); removed += 1;
    }
    return removed;
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
    const target = path.join(toolsRoot, record.moduleId); let backupId = null, backupRetentionRemoved = 0;
    if (record.intake && record.intake.currentModuleDigestAtStage) {
      if (!fs.existsSync(target) || moduleDigest(target) !== record.intake.currentModuleDigestAtStage) throw new Error('STALE_BUILD_ON_BASE: the live module changed after return staging; create and review a fresh return');
    }
    if (fs.existsSync(target)) {
      const previousDigest = moduleDigest(target);
      backupId = U.uid('backup'); const backup = path.join(backupRoot, record.moduleId, backupId); U.copyTree(target, backup);
      U.atomicJson(path.join(backup, 'AXM_INSTALL_BACKUP.json'), { schema: 'axm.module-install-backup/v1', backupId, moduleId: record.moduleId, candidateId: id, previousDigest, candidateDigest: record.digest, retention: 'single-generation', createdAt: U.now() });
      backupRetentionRemoved = retainOnlyBackup(record.moduleId, backupId);
    }
    replaceFromFolder(source, record.moduleId, 'module install');
    let verificationJob = null, verificationState = 'NOT_AVAILABLE';
    if (machine && typeof machine.run === 'function') {
      try { verificationJob = machine.run('module-selftest', { moduleId: record.moduleId }); verificationState = verificationJob.state; }
      catch (error) { verificationState = /unavailable/i.test(error.message) ? 'NOT_AVAILABLE' : 'ERROR'; }
    }
    const state = index(), saved = state.candidates.find(item => item.id === id); saved.state = 'APPLIED'; saved.appliedAt = U.now(); saved.appliedBy = String(input.actor || 'local-user').slice(0, 120); saved.backupId = backupId; saved.backupRetentionRemoved = backupRetentionRemoved; saved.verificationJobId = verificationJob && verificationJob.id || null; saved.verificationState = verificationState; saveIndex(state);
    U.appendJsonl(auditFile, { type: 'applied', at: saved.appliedAt, id, moduleId: record.moduleId, digest: record.digest, backupId, backupRetentionRemoved, verificationJobId: saved.verificationJobId, verificationState, actor: saved.appliedBy });
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
    const receipt = U.loadJson(path.join(source, 'AXM_INSTALL_BACKUP.json'), null);
    const liveTarget = path.join(toolsRoot, moduleId);
    if (!receipt || !receipt.candidateDigest) throw new Error('backup rollback receipt is unavailable or invalid');
    if (!fs.existsSync(liveTarget) || moduleDigest(liveTarget) !== receipt.candidateDigest) throw new Error('current module changed after installation; direct rollback is refused until reviewed');
    const restoreSource = path.join(stateDir, 'rollback-stage-' + U.uid('tmp')); fs.mkdirSync(restoreSource, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) if (entry.name !== 'AXM_INSTALL_BACKUP.json') U.copyTree(path.join(source, entry.name), path.join(restoreSource, entry.name));
    try { replaceFromFolder(restoreSource, moduleId, 'module rollback'); } finally { if (fs.existsSync(restoreSource)) fs.rmSync(restoreSource, { recursive: true, force: true }); }
    const at = U.now(), state = index(), applied = state.candidates.find(item => item.id === receipt.candidateId);
    if (applied) { applied.state = 'ROLLED_BACK'; applied.rolledBackAt = at; applied.verificationState = 'ROLLED_BACK'; saveIndex(state); }
    U.appendJsonl(auditFile, { type: 'rollback', at, moduleId, backupId, candidateId: receipt.candidateId, actor: String(input.actor || 'local-user').slice(0, 120) });
    return { moduleId, backupId, candidateId: receipt.candidateId, state: 'ROLLED_BACK', at };
  }

  function governance(record, reviewItem) {
    const item = reviewItem || null;
    const reviewState = item ? item.state : 'MISSING';
    const reviewDigest = item ? item.artifactDigest : null;
    const digestMatch = !!(item && reviewDigest === record.digest);
    const votes = item && Array.isArray(item.votes) ? item.votes : [];
    const approvals = new Set(votes.filter(vote => vote.verdict === 'APPROVE').map(vote => String(vote.actor || '').toLowerCase())).size;
    const holds = votes.filter(vote => vote.verdict === 'HOLD').length;
    const rejections = votes.filter(vote => vote.verdict === 'REJECT').length;
    const exactDigestApproved = digestMatch && reviewState === 'APPROVED';
    const installEligible = !record.appliedAt && exactDigestApproved;
    let holdReason = 'Exact digest is waiting for Review Inbox.';
    if (record.appliedAt) holdReason = 'Candidate was already applied.';
    else if (!item) holdReason = 'Linked Review Inbox record is unavailable.';
    else if (!digestMatch) holdReason = 'Linked review digest does not match the staged candidate.';
    else if (reviewState === 'APPROVED') holdReason = 'Digest is approved; install still requires permission and typed confirmation.';
    else if (reviewState === 'HOLD') holdReason = 'Review Inbox has placed the exact digest on hold.';
    else if (reviewState === 'REJECTED') holdReason = 'Review Inbox rejected the exact digest.';
    else if (reviewState === 'REPAIR') holdReason = 'Review Inbox requires a changed digest before review can reopen.';
    else if (reviewState === 'CANCELLED') holdReason = 'Review Inbox cancelled this exact-digest review.';
    else if (reviewState === 'SUPERSEDED') holdReason = 'A newer digest superseded this review.';
    return {
      schema: 'axm.module-install-governance-view/v1', reviewId: record.reviewId, reviewState,
      candidateDigest: record.digest, reviewDigest, digestMatch, approvals, requiredSeats: item ? item.requiredSeats : null,
      holds, rejections, exactDigestApproved, installEligible, applyAuthority: false,
      remainingGates: installEligible ? ['module.install permission', 'exact typed confirmation', 'server-side digest recheck', 'backup before replace'] : [],
      holdReason
    };
  }

  function verification(record) {
    let job = null, state = record.verificationState || 'NOT_RUN';
    if (record.verificationJobId && machine && typeof machine.get === 'function') {
      job = machine.get(record.verificationJobId); if (job) state = job.state;
    }
    return {
      schema: 'axm.module-post-install-verification/v1',
      state,
      jobId: record.verificationJobId || null,
      exitCode: job ? job.exitCode : null,
      endedAt: job ? job.endedAt : null,
      output: job ? String(job.output || '').slice(-12000) : '',
      selftestAvailable: ['RUNNING', 'PASS', 'FAIL', 'ERROR'].includes(state),
      rollbackAvailable: !!(record.appliedAt && record.backupId && record.state !== 'ROLLED_BACK'),
      truth: state === 'PASS' ? 'The installed module selftest passed.' : state === 'FAIL' ? 'The installed module selftest failed; the retained previous generation can be rolled back directly.' : state === 'RUNNING' ? 'The installed module selftest is still running.' : state === 'NOT_AVAILABLE' ? 'No executable module selftest was available; runtime behavior remains unverified.' : 'No passing post-install runtime receipt exists.'
    };
  }

  function list() {
    const reviewItems = review && typeof review.list === 'function' ? review.list() : [];
    const reviewsById = new Map(reviewItems.map(item => [item.id, item]));
    return index().candidates.map(item => Object.assign(U.clone(item), { governance: governance(item, reviewsById.get(item.reviewId)), verification: verification(item) }));
  }
  return { bundleSchema: BUNDLE_SCHEMA, returnSchema: WorkshopReturn.RETURN_SCHEMA, decodeBundle, inspectDecoded, stage, stageReturnedZip, apply, rollback, backups, list, candidate, moduleDigest, retainOnlyBackup, auditFile, indexFile };
}

module.exports = { BUNDLE_SCHEMA, decodeBundle, inspectDecoded, canonicalDigest, create };
