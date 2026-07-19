(function () {
  'use strict';
  var Pulse = window.AXMBodyPulseClient;
  var current = null;
  var $ = function (id) { return document.getElementById(id); };
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]; }); }
  function percent(value) { return value == null ? 'unknown' : Math.round(value * 100) + '%'; }
  function temperature(body) {
    if (body.thermalC == null) return 'unknown';
    return Math.round(body.thermalC) + '°C · ' + (body.temperatureSource || 'sensor');
  }
  function battery(body) {
    if (body.batteryPercent == null) return 'unknown';
    return Math.round(body.batteryPercent) + '% · ' + (body.onBattery ? 'battery' : 'AC');
  }
  function bytes(value) {
    var size = new Blob([JSON.stringify(value)]).size;
    if (size < 1024) return size + ' B';
    if (size < 1048576) return (size / 1024).toFixed(1) + ' KB';
    return (size / 1048576).toFixed(1) + ' MB';
  }
  function modeNote(mode) { return { ACTIVE: 'Goal-backed modules may request leases when the body has room.', CONSERVE: 'Only priority 70+ goals may receive leases.', REST: 'Modules stay registered and quiet; no new leases are granted.', STOPPED: 'The governor records state but grants no work.' }[mode] || 'Unknown mode.'; }
  function activity(module) {
    var value = module.lastGrantedAt || module.lastRequestedAt || module.updatedAt || module.registeredAt;
    return value ? new Date(value).toLocaleString() : 'never';
  }
  function render(status) {
    current = status;
    $('mode').textContent = status.mode;
    $('modeNote').textContent = modeNote(status.mode);
    $('pressure').textContent = status.body.pressure;
    $('cpu').textContent = percent(status.body.cpuUsedRatio);
    $('memory').textContent = percent(status.body.memoryUsedRatio);
    $('gpu').textContent = percent(status.body.gpuUsedRatio);
    $('thermal').textContent = temperature(status.body);
    $('battery').textContent = battery(status.body);
    $('unknown').textContent = (status.body.unknownSignals || []).join(', ') || 'none';
    $('bodyNote').textContent = status.body.note || 'Sensor source details unavailable.';
    document.querySelectorAll('[data-mode]').forEach(function (button) { button.classList.toggle('active', button.dataset.mode === status.mode); });
    $('modules').innerHTML = status.modules.map(function (module) {
      return '<article class="card"><div class="cardHead"><div><span>' + esc(module.moduleId) + '</span><h3>' + esc(module.name) + '</h3></div><b class="status">' + esc(module.lastStatus) + '</b></div><p>' + esc(module.lastReason) + '</p><div class="meta"><span>Priority <b>' + module.priority + '</b></span><span>Open goals <b>' + module.openGoals + '</b></span><span>Active cadence <b>' + Math.round(module.activeCadenceMs / 60000) + 'm</b></span><span>Idle cadence <b>' + Math.round(module.idleCadenceMs / 60000) + 'm</b></span><span>Authority <b>' + esc(module.authority) + '</b></span><span>Gate <b>' + esc(module.promotionGate) + '</b></span></div><button class="enable ' + (module.enabled ? 'on' : '') + '" data-toggle="' + module.moduleId + '">' + (module.enabled ? 'Enabled · set idle' : 'Idle · enable requests') + '</button></article>';
    }).join('');
    $('goalModule').innerHTML = status.modules.map(function (module) { return '<option value="' + esc(module.moduleId) + '">' + esc(module.name) + '</option>'; }).join('');
    var dormant = status.modules.filter(function (module) { return !module.activeLease; });
    $('dormantCount').textContent = dormant.length + ' quiet';
    $('dormant').innerHTML = dormant.map(function (module) {
      var presence = module.enabled ? (module.openGoals ? 'waiting for lease' : 'enabled · no open goal') : 'idle by choice';
      return '<div class="dormantLine"><div><b>' + esc(module.name) + '</b><small>' + esc(module.moduleId) + '</small></div><span>' + esc(presence) + '<br><small>' + esc(module.lastReason) + '</small></span><span>Gate · ' + esc(module.promotionGate) + '<br><small>' + module.openGoals + ' open goal(s)</small></span><strong>LAST · ' + esc(activity(module)) + '</strong></div>';
    }).join('') || '<p>No dormant lines. Every registered module currently holds a lease.</p>';
    var activeGoals = status.goals.filter(function (goal) { return ['DONE', 'CANCELLED'].indexOf(goal.status) < 0; });
    $('goals').innerHTML = activeGoals.slice().sort(function (a, b) { return b.priority - a.priority; }).map(function (goal) {
      var pause = goal.status === 'PAUSED' ? '<button data-goal-status="OPEN" data-goal-id="' + esc(goal.goalId) + '">Resume</button>' : '<button data-goal-status="PAUSED" data-goal-id="' + esc(goal.goalId) + '">Pause</button>';
      return '<div class="goal"><b>' + esc(goal.status) + '</b><span>' + esc(goal.title) + '<br><small>' + esc(goal.moduleId) + ' · ' + goal.usedPulses + '/' + goal.maxPulses + ' pulses</small></span><strong>P' + goal.priority + '</strong><div class="goalActions">' + pause + '<button data-goal-status="DONE" data-goal-id="' + esc(goal.goalId) + '">Complete</button><button data-goal-status="CANCELLED" data-goal-id="' + esc(goal.goalId) + '">Cancel</button></div></div>';
    }).join('') || '<p>No active requests. Paused requests remain here; completed requests move to the archive.</p>';
    var archived = status.goals.filter(function (goal) { return ['DONE', 'CANCELLED'].indexOf(goal.status) >= 0; }).sort(function (a, b) { return Date.parse(b.archivedAt || b.updatedAt) - Date.parse(a.archivedAt || a.updatedAt); });
    var retention = status.retention || {};
    var archiveSize = bytes({ goals: archived });
    if (retention.approximateBytes != null) {
      var size = retention.approximateBytes;
      archiveSize = size < 1024 ? size + ' B' : size < 1048576 ? (size / 1024).toFixed(1) + ' KB' : (size / 1048576).toFixed(1) + ' MB';
    }
    $('archiveStats').textContent = archived.length + ' request' + (archived.length === 1 ? '' : 's') + ' · approx ' + archiveSize + (retention.warning === 'ARCHIVE_GROWING' ? ' · CLEANUP DUE' : '');
    $('archive').innerHTML = archived.map(function (goal) { return '<div class="archiveItem"><input type="checkbox" data-archive-select="' + esc(goal.goalId) + '" aria-label="Select ' + esc(goal.title) + '"><b>' + esc(goal.status) + '</b><span>' + esc(goal.title) + '<br><small>' + esc(goal.moduleId) + ' · archived ' + esc(new Date(goal.archivedAt || goal.updatedAt).toLocaleString()) + '</small></span><button data-delete-goal="' + esc(goal.goalId) + '">Delete</button></div>'; }).join('') || '<p>No archived requests.</p>';
    $('clearArchive').disabled = archived.length === 0;
    $('deleteSelected').disabled = true;
    $('receipts').innerHTML = status.recentReceipts.slice().reverse().map(function (receipt) { return '<div class="receipt"><b>' + esc(receipt.outcome) + '</b><span>' + esc(receipt.summary) + '<br><small>' + esc(receipt.moduleId) + ' · ' + esc(receipt.effect) + '</small></span><strong>NO AUTHORITY</strong></div>'; }).join('') || '<p>No pulse has claimed completion yet.</p>';
    document.querySelectorAll('[data-toggle]').forEach(function (button) { button.onclick = function () { toggleModule(button.dataset.toggle); }; });
    document.querySelectorAll('[data-goal-status]').forEach(function (button) { button.onclick = function () { changeGoalStatus(button.dataset.goalId, button.dataset.goalStatus); }; });
    document.querySelectorAll('[data-delete-goal]').forEach(function (button) { button.onclick = function () { deleteArchived([button.dataset.deleteGoal], 'Delete this archived request permanently?'); }; });
    document.querySelectorAll('[data-archive-select]').forEach(function (checkbox) { checkbox.onchange = updateArchiveSelection; });
  }
  async function refresh() { try { render(await Pulse.status()); } catch (error) { $('modeNote').innerHTML = '<span class="error">' + esc(error.message) + '</span>'; } }
  async function toggleModule(moduleId) { var module = current.modules.find(function (item) { return item.moduleId === moduleId; }); if (!module) return; render(await Pulse.register(Object.assign({}, module, { enabled: !module.enabled }))); }
  async function changeGoalStatus(goalId, status) { var goal = current.goals.find(function (item) { return item.goalId === goalId; }); if (!goal) return; render(await Pulse.goal(Object.assign({}, goal, { status: status, statusChangedBy: 'local-steward-ui' }))); }
  function selectedArchiveIds() { return Array.from(document.querySelectorAll('[data-archive-select]:checked')).map(function (checkbox) { return checkbox.dataset.archiveSelect; }); }
  function updateArchiveSelection() { $('deleteSelected').disabled = selectedArchiveIds().length === 0; }
  async function deleteArchived(goalIds, question) { if (!goalIds.length || !confirm(question)) return; render(await Pulse.deleteGoals(goalIds, 'local-steward-ui')); }
  document.querySelectorAll('[data-mode]').forEach(function (button) { button.onclick = async function () { render(await Pulse.setMode(button.dataset.mode, 'mike')); }; });
  $('refresh').onclick = refresh;
  $('deleteSelected').onclick = function () { var ids = selectedArchiveIds(); deleteArchived(ids, 'Delete the ' + ids.length + ' selected archived request(s) permanently?'); };
  $('clearArchive').onclick = function () { var ids = current.goals.filter(function (goal) { return ['DONE', 'CANCELLED'].indexOf(goal.status) >= 0; }).map(function (goal) { return goal.goalId; }); deleteArchived(ids, 'Clear the entire request archive permanently? This cannot be undone.'); };
  $('goalForm').onsubmit = async function (event) { event.preventDefault(); render(await Pulse.goal({ moduleId: $('goalModule').value, title: $('goalTitle').value, priority: Number($('goalPriority').value), maxPulses: Number($('goalPulses').value), createdBy: 'mike', requiresReview: true })); $('goalTitle').value = ''; };
  refresh();
})();
