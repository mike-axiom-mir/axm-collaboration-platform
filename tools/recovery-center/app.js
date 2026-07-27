(function () {
  'use strict';

  var O = AXMOps;
  var notice = document.getElementById('notice');
  var currentRestore = null;
  var currentRollback = null;
  var latestStatus = null;
  var restoreConfirm = document.getElementById('confirmation');
  var rollbackConfirm = document.getElementById('rollbackConfirmation');
  var restoreApply = document.getElementById('apply');
  var rollbackApply = document.getElementById('rollbackApply');

  function shortHash(value) {
    value = String(value || '');
    return value ? value.slice(0, 12) + (value.length > 12 ? '…' : '') : 'absent';
  }

  function badge(state) {
    var value = String(state || 'UNKNOWN');
    var tone = /^(PASS|APPLIED|PREVIEWED|ELIGIBLE)$/.test(value) ? 'ok' : /^(HELD|EXPIRED|UNPROVEN|ROLLED_BACK)$/.test(value) ? 'warn' : '';
    return '<span class="badge ' + tone + '">' + O.esc(value) + '</span>';
  }

  function restoreGate() {
    restoreApply.disabled = !(currentRestore && currentRestore.state === 'PREVIEWED' && Date.parse(currentRestore.expiresAt) > Date.now() && restoreConfirm.value === 'RESTORE SELECTED FILES');
  }

  function rollbackGate() {
    rollbackApply.disabled = !(currentRollback && currentRollback.eligible && currentRollback.state === 'PREVIEWED' && Date.parse(currentRollback.expiresAt) > Date.now() && rollbackConfirm.value === 'ROLL BACK RESTORE');
  }

  function changeRows(changes, rollback) {
    return (changes || []).map(function (item) {
      var label = rollback ? item.action : item.change;
      var hashes = rollback ? 'current ' + shortHash(item.currentSha256) + ' · previous ' + shortHash(item.previousSha256) : 'current ' + shortHash(item.currentSha256) + ' · snapshot ' + shortHash(item.snapshotSha256);
      return '<div class="change-row"><div><code>' + O.esc(item.path) + '</code><br>' + badge(label) + '</div><small>' + O.esc(hashes) + '</small></div>';
    }).join('');
  }

  function renderRestorePreview(item) {
    var counts = (item.changes || []).reduce(function (out, change) { out[change.change] = (out[change.change] || 0) + 1; return out; }, {});
    document.getElementById('previewResult').className = 'preview-card';
    document.getElementById('previewResult').innerHTML = '<div class="preview-head"><div><span class="section-kicker">FRESH UNTIL ' + O.esc(O.date(item.expiresAt)) + '</span><h3>Exact restore preview</h3></div>' + badge(item.state) + '</div><div class="preview-meta"><div><span>Replace</span><strong>' + (counts.REPLACE || 0) + '</strong></div><div><span>Create</span><strong>' + (counts.CREATE || 0) + '</strong></div><div><span>Unchanged</span><strong>' + (counts.UNCHANGED || 0) + '</strong></div></div><p class="digest">Preview digest ' + O.esc(item.artifactDigest) + '</p><div class="change-list">' + changeRows(item.changes, false) + '</div>';
  }

  function renderRollbackPreview(item) {
    var conflicts = (item.conflicts || []).map(function (conflict) { return '<li>' + O.esc(conflict.message || conflict.code) + (conflict.path ? ' · ' + O.esc(conflict.path) : '') + '</li>'; }).join('');
    document.getElementById('rollbackResult').className = 'preview-card';
    document.getElementById('rollbackResult').innerHTML = '<div class="preview-head"><div><span class="section-kicker">ROLLBACK PREVIEW</span><h3>' + O.esc(item.restoreId) + '</h3></div>' + badge(item.eligible ? 'ELIGIBLE' : 'HELD') + '</div><p class="digest">Preview digest ' + O.esc(item.artifactDigest) + ' · expires ' + O.esc(O.date(item.expiresAt)) + '</p>' + (conflicts ? '<ul class="conflict-list">' + conflicts + '</ul>' : '<p class="truth">No later overlapping restore or current-byte drift was found.</p>') + '<div class="change-list">' + changeRows(item.changes, true) + '</div>';
  }

  function renderSnapshots(items) {
    var previous = document.getElementById('snapshotId').value;
    document.getElementById('snapshots').innerHTML = items.map(function (item) {
      return '<tr><td><code>' + O.esc(item.id) + '</code></td><td>' + O.esc(O.date(item.createdAt)) + '</td><td>' + Number(item.files || 0) + '</td><td>' + badge(item.restoreTest) + '</td><td><code>' + O.esc(shortHash(item.manifestDigest)) + '</code></td></tr>';
    }).join('') || '<tr><td colspan="5">No retained full snapshot yet.</td></tr>';
    document.getElementById('snapshotId').innerHTML = items.map(function (item) { return '<option value="' + O.esc(item.id) + '">' + O.esc(item.id) + '</option>'; }).join('');
    if (items.some(function (item) { return item.id === previous; })) document.getElementById('snapshotId').value = previous;
  }

  function renderRestores(items) {
    document.getElementById('restores').innerHTML = items.map(function (item) {
      var canRollback = item.state === 'APPLIED' && Number(item.filesRestored || 0) > 0;
      return '<article class="receipt-card"><div class="receipt-head"><div><span class="section-kicker">RESTORE RECEIPT</span><h3>' + O.esc(item.restoreId) + '</h3></div>' + badge(item.state) + '</div><div class="receipt-grid"><div><span>Snapshot</span><strong>' + O.esc(item.snapshotId) + '</strong></div><div><span>Applied</span><strong>' + O.esc(O.date(item.appliedAt)) + '</strong></div><div><span>Changed files</span><strong>' + Number(item.filesRestored || 0) + '</strong></div><div><span>Safety copy</span><strong>' + O.esc(item.preRestoreBackup) + '</strong></div></div><p class="digest">Artifact ' + O.esc(item.artifactDigest) + '</p><button class="secondary" data-rollback="' + O.esc(item.restoreId) + '"' + (canRollback ? '' : ' disabled') + '>' + (item.state === 'ROLLED_BACK' ? 'Rollback completed' : 'Prepare rollback') + '</button></article>';
    }).join('') || '<div class="preview-empty">No completed restore receipts yet.</div>';
    Array.from(document.querySelectorAll('[data-rollback]')).forEach(function (button) {
      button.onclick = function () { prepareRollback(button.getAttribute('data-rollback')); };
    });
  }

  function load() {
    return O.get('/api/recovery').then(function (data) {
      latestStatus = data;
      document.getElementById('localTime').value = data.config.localTime;
      document.getElementById('enabled').checked = data.config.enabled;
      document.getElementById('facts').innerHTML = '<span>' + data.snapshots.length + ' retained snapshot(s)</span><span>' + data.restores.filter(function (item) { return item.state === 'APPLIED'; }).length + ' rollback-eligible restore(s)</span><span>scheduler ' + (data.scheduleRunning ? 'running' : 'stopped') + '</span><span>packager ' + (data.packagerActive ? 'busy' : 'ready') + '</span><span>preview TTL ' + Number(data.previewTtlMinutes || 0) + ' min</span>';
      renderSnapshots(data.snapshots || []);
      renderRestores(data.restores || []);
      if (!currentRestore) {
        currentRestore = (data.restorePreviews || []).find(function (item) { return item.effectiveState === 'PREVIEWED'; }) || null;
        if (currentRestore) renderRestorePreview(currentRestore);
      }
      if (!currentRollback) {
        currentRollback = (data.rollbackPreviews || []).find(function (item) { return item.effectiveState === 'PREVIEWED' && item.eligible; }) || null;
        if (currentRollback) renderRollbackPreview(currentRollback);
      }
      restoreGate(); rollbackGate();
      return data;
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); throw error; });
  }

  function prepareRollback(restoreId) {
    currentRollback = null; rollbackConfirm.value = ''; rollbackGate();
    O.notice(notice, 'Building a rollback preview for ' + restoreId + '. Nothing is being rolled back.', 'warn');
    O.post('/api/recovery/rollback/preview', { restoreId: restoreId }, { 'x-axm-recovery': 'explicit-rollback-preview' }).then(function (item) {
      currentRollback = item; renderRollbackPreview(item); rollbackGate();
      O.notice(notice, item.eligible ? 'Rollback preview is eligible. Inspect every action before confirmation.' : 'Rollback is held. Resolve the listed conflict and build a fresh preview.', item.eligible ? 'warn' : 'bad');
      document.getElementById('rollbackFlow').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  }

  document.getElementById('refresh').onclick = function () { load(); };
  document.getElementById('snapshot').onclick = function () {
    var button = this; button.disabled = true;
    O.notice(notice, 'Building a private snapshot and checking its restore path…', 'warn');
    O.post('/api/recovery/snapshot', { reason: document.getElementById('reason').value }, { 'x-axm-recovery': 'explicit-snapshot' }).then(function (item) { O.notice(notice, 'Snapshot ' + item.zip_name + ' passed its restore test.', 'ok'); return load(); }).catch(function (error) { O.notice(notice, error.message, 'bad'); }).finally(function () { button.disabled = false; });
  };
  document.getElementById('schedule').onclick = function () {
    O.post('/api/recovery/configure', { enabled: document.getElementById('enabled').checked, localTime: document.getElementById('localTime').value }, { 'x-axm-recovery': 'explicit-configure' }).then(function () { O.notice(notice, 'In-process recovery schedule saved.', 'ok'); return load(); }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  document.getElementById('preview').onclick = function () {
    var paths = document.getElementById('paths').value.split(/\r?\n/).map(function (value) { return value.trim(); }).filter(Boolean);
    currentRestore = null; restoreConfirm.value = ''; restoreGate();
    O.post('/api/recovery/restore/preview', { snapshotId: document.getElementById('snapshotId').value, paths: paths }, { 'x-axm-recovery': 'explicit-preview' }).then(function (item) { currentRestore = item; renderRestorePreview(item); restoreGate(); O.notice(notice, 'Fresh preview created. Inspect every target before applying.', 'warn'); }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  restoreConfirm.oninput = restoreGate;
  restoreApply.onclick = function () {
    if (!currentRestore || restoreApply.disabled) return;
    O.post('/api/recovery/restore/apply', { previewId: currentRestore.id, confirmation: restoreConfirm.value }, { 'x-axm-recovery': 'apply-preview' }).then(function (item) {
      O.notice(notice, 'Restored ' + item.filesRestored + ' file(s). Safety copy: ' + item.preRestoreBackup + '.', 'ok');
      currentRestore = null; restoreConfirm.value = ''; restoreGate(); document.getElementById('previewResult').className = 'preview-empty'; document.getElementById('previewResult').textContent = 'Restore completed. Build a fresh preview for any further change.'; return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); restoreGate(); });
  };
  rollbackConfirm.oninput = rollbackGate;
  rollbackApply.onclick = function () {
    if (!currentRollback || rollbackApply.disabled) return;
    O.post('/api/recovery/rollback/apply', { previewId: currentRollback.id, confirmation: rollbackConfirm.value }, { 'x-axm-recovery': 'apply-rollback-preview' }).then(function (item) {
      O.notice(notice, 'Rolled back ' + item.filesRolledBack + ' file(s). Pre-rollback safety copy: ' + item.preRollbackBackup + '.', 'ok');
      currentRollback = null; rollbackConfirm.value = ''; rollbackGate(); document.getElementById('rollbackResult').className = 'preview-empty'; document.getElementById('rollbackResult').textContent = 'Rollback completed. The receipt remains in restore lineage.'; return load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); rollbackGate(); });
  };

  restoreGate(); rollbackGate(); load();
}());
