'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const STATUS_SCHEMA = 'axm.recovery-status/v1';
const LINEAGE_SCHEMA = 'axm.recovery-lineage/v1';
const RESTORE_PREVIEW_SCHEMA = 'axm.restore-preview/v2';
const ROLLBACK_PREVIEW_SCHEMA = 'axm.recovery-rollback-preview/v1';
const PREVIEW_TTL_MS = 15 * 60 * 1000;

function create(options) {
  const root = options.root, packager = options.packager, stateDir = path.join(options.stateRoot, 'recovery-center');
  const configFile = path.join(stateDir, 'config.json'), lineageFile = path.join(stateDir, 'previews.json'), auditFile = path.join(stateDir, 'audit.jsonl');
  const backupRoot = path.join(options.backupRoot || path.join(root, 'backups'), 'recovery-center');
  let timer = null, runningScheduled = false;

  function config() { return U.loadJson(configFile, { schema: 'axm.recovery.config/v1', enabled: false, localTime: '04:30', lastSnapshotDate: null, lastSnapshotAt: null }); }
  function saveConfig(value) { U.atomicJson(configFile, value); return value; }
  function readLineage() {
    const value = U.loadJson(lineageFile, {});
    value.schema = LINEAGE_SCHEMA;
    if (!Array.isArray(value.previews)) value.previews = [];
    if (!Array.isArray(value.restores)) value.restores = [];
    if (!Array.isArray(value.rollbackPreviews)) value.rollbackPreviews = [];
    if (!Array.isArray(value.rollbacks)) value.rollbacks = [];
    return value;
  }
  function saveLineage(value) {
    value.schema = LINEAGE_SCHEMA;
    value.previews = value.previews.slice(0, 30);
    value.restores = value.restores.slice(0, 50);
    value.rollbackPreviews = value.rollbackPreviews.slice(0, 30);
    value.rollbacks = value.rollbacks.slice(0, 50);
    U.atomicJson(lineageFile, value);
  }
  function audit(value) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, value)); }
  function dateKey(date) { const d = date || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function expiresAt() { return new Date(Date.now() + PREVIEW_TTL_MS).toISOString(); }

  function loadSnapshot(snapshotId) {
    snapshotId = U.cleanId(snapshotId, 'snapshotId');
    if (!/^axm-workshop-full-/.test(snapshotId)) throw new Error('retained full snapshot id is required');
    const folder = U.resolveUnder(packager.outputDir, snapshotId), manifestFile = path.join(folder, 'PACKAGE_MANIFEST.json');
    if (!fs.existsSync(manifestFile)) throw new Error('retained snapshot not found');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''));
    if (!manifest || !Array.isArray(manifest.files)) throw new Error('snapshot manifest is invalid');
    return { id: snapshotId, folder, manifestFile, manifest, manifestDigest: U.fileSha256(manifestFile) };
  }

  function list() {
    const output = packager.outputDir; fs.mkdirSync(output, { recursive: true });
    const items = [];
    for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^axm-workshop-full-/.test(entry.name)) continue;
      try {
        const snap = loadSnapshot(entry.name), zip = path.join(output, entry.name + '.zip'), restore = path.join(output, entry.name + '.RESTORE_TEST.json');
        const restoreReport = U.loadJson(restore, { ok: false });
        items.push({ id: entry.name, createdAt: snap.manifest.created_at, files: snap.manifest.file_count, bytes: snap.manifest.total_bytes, manifestDigest: snap.manifestDigest, folderRetained: true, zipPresent: fs.existsSync(zip), restoreTest: restoreReport.ok === true ? 'PASS' : 'UNPROVEN' });
      } catch (_) {}
    }
    return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function snapshot(actor, reason) {
    if (packager.isActive()) throw new Error('Workshop Packager is already active');
    const result = await packager.create({ mode: 'full', keep_copy: true });
    const state = config(); state.lastSnapshotDate = dateKey(); state.lastSnapshotAt = U.now(); saveConfig(state);
    audit({ type: 'snapshot', actor: String(actor || 'local-user').slice(0, 120), reason: String(reason || 'manual').slice(0, 200), zip: result.zip_name, restoreTest: result.restore_test, files: result.files });
    return result;
  }

  function selectEntries(manifest, requested) {
    if (!Array.isArray(requested) || !requested.length || requested.length > 100) throw new Error('select 1–100 file or folder paths');
    const paths = requested.map(U.safeRelative), deniedTop = new Set(['exports', 'node_modules', '.git']), entries = [];
    for (const wanted of paths) {
      const top = wanted.split('/')[0].toLowerCase(); if (deniedTop.has(top)) throw new Error('restore path is outside the recoverable scope: ' + wanted);
      const matches = manifest.files.filter(file => file.path === wanted || file.path.startsWith(wanted.replace(/\/$/, '') + '/'));
      if (!matches.length) throw new Error('snapshot path not found: ' + wanted);
      entries.push(...matches);
    }
    const unique = Array.from(new Map(entries.map(item => [item.path, item])).values());
    if (unique.length > 5000 || unique.reduce((n, item) => n + Number(item.bytes || 0), 0) > 500 * 1024 * 1024) throw new Error('restore selection safety limit exceeded');
    return unique;
  }

  function currentState(relative) {
    const target = U.resolveUnder(root, relative);
    if (!fs.existsSync(target)) return { exists: false, sha256: null, target };
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('restore target is not a regular file: ' + relative);
    return { exists: true, sha256: U.fileSha256(target), target };
  }

  function verifiedSource(folder, item) {
    const source = U.resolveUnder(folder, item.path);
    if (!fs.existsSync(source) || fs.lstatSync(source).isSymbolicLink() || !fs.statSync(source).isFile() || U.fileSha256(source) !== item.sha256) throw new Error('snapshot integrity check failed: ' + item.path);
    return source;
  }

  function restoreDigest(changes) {
    return U.sha256(Buffer.from(JSON.stringify(changes.map(item => [item.path, item.snapshotSha256, item.currentExists, item.currentSha256]))));
  }

  function buildRestoreChanges(snap, entries) {
    return entries.map(item => {
      verifiedSource(snap.folder, item);
      const current = currentState(item.path);
      return { path: item.path, bytes: item.bytes, snapshotSha256: item.sha256, currentExists: current.exists, currentSha256: current.sha256, change: current.sha256 === item.sha256 ? 'UNCHANGED' : current.exists ? 'REPLACE' : 'CREATE' };
    });
  }

  function preview(snapshotId, requested, actor) {
    const snap = loadSnapshot(snapshotId), entries = selectEntries(snap.manifest, requested), changes = buildRestoreChanges(snap, entries);
    const record = { schema: RESTORE_PREVIEW_SCHEMA, id: U.uid('restore-preview'), snapshotId: snap.id, snapshotManifestDigest: snap.manifestDigest, artifactDigest: restoreDigest(changes), requested: requested.map(String), changes, state: 'PREVIEWED', createdAt: U.now(), expiresAt: expiresAt(), actor: String(actor || 'local-user').slice(0, 120) };
    const state = readLineage(); state.previews.unshift(record); saveLineage(state);
    audit({ type: 'restore-preview', id: record.id, snapshotId: record.snapshotId, digest: record.artifactDigest, files: changes.length, expiresAt: record.expiresAt, actor: record.actor });
    return U.clone(record);
  }

  function assertFresh(record, label) {
    if (!record.expiresAt) throw new Error((label || 'preview') + ' is legacy and lacks an expiry');
    if (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= Date.now()) throw new Error((label || 'preview') + ' expired; build a fresh preview');
  }

  function holdPreview(state, record, reason, type) {
    record.state = 'HELD'; record.heldAt = U.now(); record.holdReason = String(reason || 'preview no longer matches').slice(0, 500); saveLineage(state);
    audit({ type: type || 'preview-held', id: record.id, reason: record.holdReason });
  }

  function repairApplied(entries, safety, applied) {
    let repaired = true;
    for (const entry of applied.slice().reverse()) {
      try {
        const target = U.resolveUnder(root, entry.path);
        if (entry.beforeExisted) fs.copyFileSync(U.resolveUnder(safety, entry.path), target);
        else fs.rmSync(target, { force: true });
      } catch (_) { repaired = false; }
    }
    return repaired;
  }

  function apply(previewId, input) {
    const state = readLineage(), record = state.previews.find(item => item.id === String(previewId || ''));
    if (!record) throw new Error('restore preview not found');
    if (record.state !== 'PREVIEWED') throw new Error('restore preview is no longer applicable');
    assertFresh(record, 'restore preview');
    if (String(input && input.confirmation || '') !== 'RESTORE SELECTED FILES') throw new Error('exact restore confirmation is required');
    const snap = loadSnapshot(record.snapshotId);
    if (snap.manifestDigest !== record.snapshotManifestDigest) { holdPreview(state, record, 'snapshot manifest changed after restore preview', 'restore-preview-held'); throw new Error(record.holdReason); }
    const entries = selectEntries(snap.manifest, record.requested), changes = buildRestoreChanges(snap, entries), digest = restoreDigest(changes);
    if (digest !== record.artifactDigest) {
      const changed = changes.find((item, index) => !record.changes[index] || item.path !== record.changes[index].path || item.currentExists !== record.changes[index].currentExists || item.currentSha256 !== record.changes[index].currentSha256 || item.snapshotSha256 !== record.changes[index].snapshotSha256);
      const reason = 'Workshop changed after restore preview' + (changed ? ': ' + changed.path : ''); holdPreview(state, record, reason, 'restore-preview-held'); throw new Error(reason);
    }
    const selected = changes.filter(item => item.change !== 'UNCHANGED'), restoreId = U.uid('restore'), safety = path.join(backupRoot, restoreId);
    const safetyEntries = selected.map(item => ({ path: item.path, beforeExisted: item.currentExists, beforeSha256: item.currentSha256, restoredSha256: item.snapshotSha256 }));
    for (const item of safetyEntries) if (item.beforeExisted) {
      const current = currentState(item.path), before = U.resolveUnder(safety, item.path);
      if (!current.exists || current.sha256 !== item.beforeSha256) throw new Error('Workshop changed while preparing safety copy: ' + item.path);
      fs.mkdirSync(path.dirname(before), { recursive: true }); fs.copyFileSync(current.target, before);
    }
    const safetyManifest = { schema: 'axm.pre-restore-backup/v2', restoreId, previewId: record.id, snapshotId: record.snapshotId, artifactDigest: record.artifactDigest, state: 'PREPARED', createdAt: U.now(), entries: safetyEntries };
    U.atomicJson(path.join(safety, 'AXM_PRE_RESTORE.json'), safetyManifest);
    const applied = [];
    try {
      for (const item of selected) {
        const source = verifiedSource(snap.folder, entries.find(entry => entry.path === item.path)), target = U.resolveUnder(root, item.path);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
        if (U.fileSha256(target) !== item.snapshotSha256) throw new Error('restored file verification failed: ' + item.path);
        applied.push(safetyEntries.find(entry => entry.path === item.path));
      }
    } catch (error) {
      const repaired = repairApplied(safetyEntries, safety, applied);
      safetyManifest.state = repaired ? 'APPLY_FAILED_REPAIRED' : 'APPLY_FAILED_REPAIR_INCOMPLETE'; safetyManifest.failure = String(error.message || error).slice(0, 1000); U.atomicJson(path.join(safety, 'AXM_PRE_RESTORE.json'), safetyManifest);
      audit({ type: 'restore-apply-failed', previewId: record.id, restoreId, repaired, error: safetyManifest.failure });
      throw new Error('restore failed' + (repaired ? ' and prior state was repaired: ' : '; automatic repair was incomplete: ') + error.message);
    }
    safetyManifest.state = 'APPLIED'; safetyManifest.appliedAt = U.now(); U.atomicJson(path.join(safety, 'AXM_PRE_RESTORE.json'), safetyManifest);
    const receipt = { schema: 'axm.recovery-restore-receipt/v1', restoreId, previewId: record.id, snapshotId: record.snapshotId, artifactDigest: record.artifactDigest, filesSelected: changes.length, filesRestored: selected.length, unchangedFiles: changes.length - selected.length, preRestoreBackup: path.relative(root, safety).replace(/\\/g, '/'), entries: safetyEntries, state: 'APPLIED', appliedAt: safetyManifest.appliedAt, appliedBy: String(input && input.actor || 'local-user').slice(0, 120) };
    U.atomicJson(path.join(safety, 'AXM_RESTORE_RECEIPT.json'), receipt);
    record.state = 'APPLIED'; record.appliedAt = receipt.appliedAt; record.restoreId = restoreId; record.appliedBy = receipt.appliedBy;
    state.restores.unshift(receipt); saveLineage(state);
    audit({ type: 'restore-applied', previewId: record.id, restoreId, snapshotId: record.snapshotId, files: selected.length, actor: receipt.appliedBy, preRestoreBackup: receipt.preRestoreBackup });
    return U.clone(receipt);
  }

  function rollbackDigest(changes) {
    return U.sha256(Buffer.from(JSON.stringify(changes.map(item => [item.path, item.action, item.currentSha256, item.previousSha256]))));
  }

  function laterOverlap(state, receipt) {
    const paths = new Set(receipt.entries.map(item => item.path)), index = state.restores.findIndex(item => item.restoreId === receipt.restoreId);
    return (index < 0 ? [] : state.restores.slice(0, index)).find(item => item.state === 'APPLIED' && item.entries.some(entry => paths.has(entry.path))) || null;
  }

  function restoreSafetyRoot(receipt) {
    const safety = U.resolveUnder(root, receipt.preRestoreBackup);
    U.assertUnder(safety, backupRoot);
    return safety;
  }

  function buildRollbackChanges(receipt, state) {
    const conflicts = [], overlap = laterOverlap(state, receipt);
    if (overlap) conflicts.push({ code: 'LATER_RESTORE_OVERLAP', restoreId: overlap.restoreId, message: 'A later active restore overlaps this file set.' });
    const changes = receipt.entries.map(item => {
      const current = currentState(item.path), action = item.beforeExisted ? 'RESTORE_PREVIOUS' : 'REMOVE_CREATED';
      if (!current.exists || current.sha256 !== item.restoredSha256) conflicts.push({ code: 'CURRENT_STATE_DRIFT', path: item.path, message: 'Current bytes no longer match this restore.' });
      if (item.beforeExisted) {
        const backup = U.resolveUnder(restoreSafetyRoot(receipt), item.path);
        if (!fs.existsSync(backup) || U.fileSha256(backup) !== item.beforeSha256) conflicts.push({ code: 'SAFETY_COPY_DRIFT', path: item.path, message: 'Pre-restore safety bytes are unavailable or changed.' });
      }
      return { path: item.path, action, currentSha256: current.sha256, previousSha256: item.beforeSha256, currentExists: current.exists, previousExists: item.beforeExisted };
    });
    return { changes, conflicts };
  }

  function previewRollback(restoreId, actor) {
    const state = readLineage(), receipt = state.restores.find(item => item.restoreId === String(restoreId || ''));
    if (!receipt) throw new Error('restore receipt not found');
    if (receipt.state !== 'APPLIED') throw new Error('restore is no longer eligible for rollback');
    if (!receipt.entries.length) throw new Error('restore changed no files; rollback is unnecessary');
    const plan = buildRollbackChanges(receipt, state), record = { schema: ROLLBACK_PREVIEW_SCHEMA, id: U.uid('rollback-preview'), restoreId: receipt.restoreId, artifactDigest: rollbackDigest(plan.changes), changes: plan.changes, conflicts: plan.conflicts, eligible: plan.conflicts.length === 0, state: plan.conflicts.length ? 'HELD' : 'PREVIEWED', createdAt: U.now(), expiresAt: expiresAt(), actor: String(actor || 'local-user').slice(0, 120) };
    state.rollbackPreviews.unshift(record); saveLineage(state);
    audit({ type: 'rollback-preview', id: record.id, restoreId: record.restoreId, digest: record.artifactDigest, files: record.changes.length, eligible: record.eligible, conflicts: record.conflicts.map(item => item.code), actor: record.actor });
    return U.clone(record);
  }

  function repairRollback(preRollback, applied) {
    let repaired = true;
    for (const item of applied.slice().reverse()) {
      try {
        const source = U.resolveUnder(preRollback, item.path), target = U.resolveUnder(root, item.path);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
      } catch (_) { repaired = false; }
    }
    return repaired;
  }

  function applyRollback(previewId, input) {
    const state = readLineage(), previewRecord = state.rollbackPreviews.find(item => item.id === String(previewId || ''));
    if (!previewRecord) throw new Error('rollback preview not found');
    if (previewRecord.state !== 'PREVIEWED' || !previewRecord.eligible) throw new Error('rollback preview is held or no longer applicable');
    assertFresh(previewRecord, 'rollback preview');
    if (String(input && input.confirmation || '') !== 'ROLL BACK RESTORE') throw new Error('exact rollback confirmation is required');
    const receipt = state.restores.find(item => item.restoreId === previewRecord.restoreId);
    if (!receipt || receipt.state !== 'APPLIED') throw new Error('restore is no longer eligible for rollback');
    const plan = buildRollbackChanges(receipt, state);
    if (plan.conflicts.length || rollbackDigest(plan.changes) !== previewRecord.artifactDigest) { holdPreview(state, previewRecord, 'Workshop changed after rollback preview; build a fresh preview', 'rollback-preview-held'); throw new Error(previewRecord.holdReason); }
    const rollbackId = U.uid('rollback'), preRollback = path.join(backupRoot, 'rollback-safety', rollbackId);
    const preRollbackEntries = plan.changes.map(item => ({ path: item.path, sha256: item.currentSha256 }));
    for (const item of preRollbackEntries) {
      const current = currentState(item.path), target = U.resolveUnder(preRollback, item.path);
      if (!current.exists || current.sha256 !== item.sha256) throw new Error('Workshop changed while preparing rollback safety copy: ' + item.path);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(current.target, target);
    }
    const rollbackSafety = { schema: 'axm.pre-rollback-backup/v1', rollbackId, rollbackPreviewId: previewRecord.id, restoreId: receipt.restoreId, state: 'PREPARED', createdAt: U.now(), entries: preRollbackEntries };
    U.atomicJson(path.join(preRollback, 'AXM_PRE_ROLLBACK.json'), rollbackSafety);
    const applied = [];
    try {
      for (const item of plan.changes) {
        const target = U.resolveUnder(root, item.path);
        if (item.action === 'RESTORE_PREVIOUS') {
          const source = U.resolveUnder(restoreSafetyRoot(receipt), item.path);
          fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
          if (U.fileSha256(target) !== item.previousSha256) throw new Error('rollback verification failed: ' + item.path);
        } else {
          fs.rmSync(target, { force: true });
          if (fs.existsSync(target)) throw new Error('rollback could not remove restore-created file: ' + item.path);
        }
        applied.push(item);
      }
    } catch (error) {
      const repaired = repairRollback(preRollback, applied);
      rollbackSafety.state = repaired ? 'ROLLBACK_FAILED_REPAIRED' : 'ROLLBACK_FAILED_REPAIR_INCOMPLETE'; rollbackSafety.failure = String(error.message || error).slice(0, 1000); U.atomicJson(path.join(preRollback, 'AXM_PRE_ROLLBACK.json'), rollbackSafety);
      audit({ type: 'rollback-apply-failed', rollbackPreviewId: previewRecord.id, rollbackId, repaired, error: rollbackSafety.failure });
      throw new Error('rollback failed' + (repaired ? ' and restored state was repaired: ' : '; automatic repair was incomplete: ') + error.message);
    }
    rollbackSafety.state = 'APPLIED'; rollbackSafety.appliedAt = U.now(); U.atomicJson(path.join(preRollback, 'AXM_PRE_ROLLBACK.json'), rollbackSafety);
    const rollbackReceipt = { schema: 'axm.recovery-rollback-receipt/v1', rollbackId, rollbackPreviewId: previewRecord.id, restoreId: receipt.restoreId, artifactDigest: previewRecord.artifactDigest, filesRolledBack: plan.changes.length, restoredPreviousFiles: plan.changes.filter(item => item.action === 'RESTORE_PREVIOUS').length, removedRestoreCreatedFiles: plan.changes.filter(item => item.action === 'REMOVE_CREATED').length, preRollbackBackup: path.relative(root, preRollback).replace(/\\/g, '/'), state: 'APPLIED', appliedAt: rollbackSafety.appliedAt, appliedBy: String(input && input.actor || 'local-user').slice(0, 120) };
    U.atomicJson(path.join(preRollback, 'AXM_ROLLBACK_RECEIPT.json'), rollbackReceipt);
    previewRecord.state = 'APPLIED'; previewRecord.appliedAt = rollbackReceipt.appliedAt; previewRecord.rollbackId = rollbackId;
    receipt.state = 'ROLLED_BACK'; receipt.rolledBackAt = rollbackReceipt.appliedAt; receipt.rollbackId = rollbackId;
    state.rollbacks.unshift(rollbackReceipt); saveLineage(state);
    audit({ type: 'rollback-applied', rollbackPreviewId: previewRecord.id, rollbackId, restoreId: receipt.restoreId, files: plan.changes.length, actor: rollbackReceipt.appliedBy, preRollbackBackup: rollbackReceipt.preRollbackBackup });
    return U.clone(rollbackReceipt);
  }

  function configure(input) {
    const time = String(input.localTime || '').trim(); if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('localTime must be HH:MM');
    const state = config(); state.enabled = input.enabled === true; state.localTime = time; state.updatedAt = U.now(); state.updatedBy = String(input.actor || 'local-user').slice(0, 120); saveConfig(state); return state;
  }
  function scheduleTick() {
    const cfg = config(), now = new Date(), hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (!cfg.enabled || cfg.lastSnapshotDate === dateKey(now) || hhmm < cfg.localTime || runningScheduled) return;
    runningScheduled = true; snapshot('recovery-scheduler', 'scheduled').catch(error => audit({ type: 'scheduled-snapshot-failed', error: String(error.message || error).slice(0, 1000) })).finally(() => { runningScheduled = false; });
  }
  function startSchedule() { if (!timer) { timer = setInterval(scheduleTick, 60 * 1000); if (timer.unref) timer.unref(); scheduleTick(); } }
  function stopSchedule() { if (timer) clearInterval(timer); timer = null; }
  function observedPreview(item) {
    const value = U.clone(item);
    value.effectiveState = value.state === 'PREVIEWED' && !value.expiresAt ? 'LEGACY_UNBOUND' : value.state === 'PREVIEWED' && Date.parse(value.expiresAt) <= Date.now() ? 'EXPIRED' : value.state;
    return value;
  }
  function status() {
    const state = readLineage();
    return { schema: STATUS_SCHEMA, config: config(), snapshots: list(), restorePreviews: state.previews.slice(0, 10).map(observedPreview), restores: U.clone(state.restores), rollbackPreviews: state.rollbackPreviews.slice(0, 10).map(observedPreview), rollbacks: U.clone(state.rollbacks), packagerActive: packager.isActive(), scheduleRunning: !!timer, previewTtlMinutes: PREVIEW_TTL_MS / 60000, truth: { restoreRequiresFreshCurrentStateBinding: true, restoreRequiresPermission: true, rollbackRequiresFreshPreview: true, rollbackRequiresPermission: true, automaticRestore: false, automaticRollback: false, absentFilesDeletedByRestore: false, snapshotManifestPathsExposed: false, previewObservationMutatesLineage: false } };
  }
  return { snapshot, list, preview, apply, previewRollback, applyRollback, configure, status, startSchedule, stopSchedule, auditFile, configFile, lineageFile };
}

module.exports = { create, PREVIEW_TTL_MS };
