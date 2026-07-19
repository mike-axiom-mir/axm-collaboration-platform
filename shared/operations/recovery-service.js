'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

function create(options) {
  const root = options.root, packager = options.packager, stateDir = path.join(options.stateRoot, 'recovery-center');
  const configFile = path.join(stateDir, 'config.json'), previewFile = path.join(stateDir, 'previews.json'), auditFile = path.join(stateDir, 'audit.jsonl');
  const backupRoot = path.join(options.backupRoot || path.join(root, 'backups'), 'recovery-center');
  let timer = null, runningScheduled = false;
  function config() { return U.loadJson(configFile, { schema: 'axm.recovery.config/v1', enabled: false, localTime: '04:30', lastSnapshotDate: null, lastSnapshotAt: null }); }
  function saveConfig(value) { U.atomicJson(configFile, value); return value; }
  function previews() { return U.loadJson(previewFile, { schema: 'axm.recovery.previews/v1', previews: [] }); }
  function savePreviews(value) { value.previews = value.previews.slice(0, 30); U.atomicJson(previewFile, value); }
  function audit(value) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, value)); }
  function dateKey(date) { const d = date || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function list() {
    const output = packager.outputDir; fs.mkdirSync(output, { recursive: true });
    const items = [];
    for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^axm-workshop-full-/.test(entry.name)) continue;
      const folder = path.join(output, entry.name), manifestFile = path.join(folder, 'PACKAGE_MANIFEST.json');
      if (!fs.existsSync(manifestFile)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''));
        const zip = path.join(output, entry.name + '.zip'), restore = path.join(output, entry.name + '.RESTORE_TEST.json');
        const restoreReport = U.loadJson(restore, { ok: false });
        items.push({ id: entry.name, createdAt: manifest.created_at, files: manifest.file_count, bytes: manifest.total_bytes, folderRetained: true, zipPresent: fs.existsSync(zip), restoreTest: restoreReport.ok === true ? 'PASS' : 'UNPROVEN', manifestFile });
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
    const paths = requested.map(U.safeRelative), deniedTop = new Set(['exports','node_modules','.git']), entries = [];
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

  function preview(snapshotId, requested, actor) {
    snapshotId = U.cleanId(snapshotId, 'snapshotId'); const snap = list().find(item => item.id === snapshotId);
    if (!snap) throw new Error('retained snapshot not found');
    const folder = path.join(packager.outputDir, snapshotId), manifest = JSON.parse(fs.readFileSync(path.join(folder, 'PACKAGE_MANIFEST.json'), 'utf8').replace(/^\uFEFF/, ''));
    const entries = selectEntries(manifest, requested), changes = [];
    for (const item of entries) {
      const source = U.resolveUnder(folder, item.path); if (!fs.existsSync(source) || U.fileSha256(source) !== item.sha256) throw new Error('snapshot integrity check failed: ' + item.path);
      const target = U.resolveUnder(root, item.path), current = fs.existsSync(target) && fs.statSync(target).isFile() ? U.fileSha256(target) : null;
      changes.push({ path: item.path, bytes: item.bytes, snapshotSha256: item.sha256, currentSha256: current, change: current === item.sha256 ? 'UNCHANGED' : current ? 'REPLACE' : 'CREATE' });
    }
    const digest = U.sha256(Buffer.from(JSON.stringify(changes.map(x => [x.path, x.snapshotSha256])))), record = { id: U.uid('restore-preview'), snapshotId, artifactDigest: digest, requested: requested.map(String), changes, state: 'PREVIEWED', createdAt: U.now(), actor: String(actor || 'local-user').slice(0, 120) };
    const state = previews(); state.previews.unshift(record); savePreviews(state); audit({ type: 'restore-preview', id: record.id, snapshotId, digest, files: changes.length, actor: record.actor });
    return U.clone(record);
  }

  function apply(previewId, input) {
    const state = previews(), record = state.previews.find(item => item.id === previewId);
    if (!record) throw new Error('restore preview not found');
    if (record.state !== 'PREVIEWED') throw new Error('restore preview is no longer applicable');
    if (String(input && input.confirmation || '') !== 'RESTORE SELECTED FILES') throw new Error('exact restore confirmation is required');
    const folder = path.join(packager.outputDir, record.snapshotId), manifest = JSON.parse(fs.readFileSync(path.join(folder, 'PACKAGE_MANIFEST.json'), 'utf8').replace(/^\uFEFF/, ''));
    const entries = selectEntries(manifest, record.requested), digest = U.sha256(Buffer.from(JSON.stringify(entries.map(x => [x.path, x.sha256]))));
    if (digest !== record.artifactDigest) throw new Error('restore preview digest no longer matches snapshot');
    const restoreId = U.uid('restore'), safety = path.join(backupRoot, restoreId);
    for (const item of entries) {
      const source = U.resolveUnder(folder, item.path), target = U.resolveUnder(root, item.path);
      if (U.fileSha256(source) !== item.sha256) throw new Error('snapshot changed after preview: ' + item.path);
      if (fs.existsSync(target) && fs.statSync(target).isFile()) { const before = U.resolveUnder(safety, item.path); fs.mkdirSync(path.dirname(before), { recursive: true }); fs.copyFileSync(target, before); }
    }
    U.atomicJson(path.join(safety, 'AXM_PRE_RESTORE.json'), { schema: 'axm.pre-restore-backup/v1', restoreId, previewId, snapshotId: record.snapshotId, createdAt: U.now(), files: entries.map(x => x.path) });
    for (const item of entries) { const source = U.resolveUnder(folder, item.path), target = U.resolveUnder(root, item.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target); }
    record.state = 'APPLIED'; record.appliedAt = U.now(); record.restoreId = restoreId; record.appliedBy = String(input.actor || 'local-user').slice(0, 120); savePreviews(state);
    audit({ type: 'restore-applied', previewId, restoreId, snapshotId: record.snapshotId, files: entries.length, actor: record.appliedBy, preRestoreBackup: path.relative(root, safety).replace(/\\/g, '/') });
    return { restoreId, snapshotId: record.snapshotId, filesRestored: entries.length, preRestoreBackup: path.relative(root, safety).replace(/\\/g, '/'), restartRecommended: true };
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
  function status() { return { config: config(), snapshots: list(), packagerActive: packager.isActive(), scheduleRunning: !!timer }; }
  return { snapshot, list, preview, apply, configure, status, startSchedule, stopSchedule, auditFile, configFile };
}

module.exports = { create };

