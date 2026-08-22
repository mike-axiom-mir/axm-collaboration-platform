(function () {
  'use strict';
  var Pulse = window.AXMBodyPulseClient;
  var Heartbeat = window.AXMPlatformHeartbeatClient;
  var current = null;
  var currentHeartbeat = null;
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
  function cadenceLabel(milliseconds) {
    var minutes = Math.round(Number(milliseconds || 0) / 60000);
    if (minutes >= 60 && minutes % 60 === 0) return (minutes / 60) + ' hour' + (minutes === 60 ? '' : 's');
    return minutes + ' minute' + (minutes === 1 ? '' : 's');
  }
  function elapsed(milliseconds) {
    var value = Number(milliseconds);
    if (!Number.isFinite(value) || value < 0) return 'not measured';
    if (value < 1000) return Math.round(value) + ' ms';
    if (value < 60000) return (value / 1000).toFixed(value < 10000 ? 1 : 0) + ' sec';
    var minutes = Math.floor(value / 60000), seconds = Math.round((value % 60000) / 1000);
    return minutes + 'm ' + String(seconds).padStart(2, '0') + 's';
  }
  function runDuration(run) {
    var start = Date.parse(run && run.startedAt), end = Date.parse(run && run.completedAt);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
  }
  function verificationEvidence(bridge) {
    if (bridge.evidenceSummary) return bridge.evidenceSummary;
    var runs = bridge.recentRuns || [], checks = runs.reduce(function (all, run) { return all.concat(run.checks || []); }, []), latest = runs[runs.length - 1] || null;
    return { retainedWindowCount:runs.length, passWindowCount:runs.filter(function (run) { return run.status === 'PASS'; }).length, checkExecutionCount:checks.length, passCheckCount:checks.filter(function (check) { return check.status === 'PASS'; }).length, failedCheckCount:checks.filter(function (check) { return check.status === 'FAIL' || check.status === 'TIMEOUT'; }).length, uniqueCheckCount:new Set(checks.map(function (check) { return check.checkId; }).filter(Boolean)).size, lastDurationMs:runDuration(latest), latestBeatSequence:latest && latest.beatSequence, pressureSampleCount:0, peakCpuUsedRatio:null, averageCpuUsedRatio:null };
  }
  function draftEvidence(bridge) {
    if (bridge.evidenceSummary) return bridge.evidenceSummary;
    var runs = bridge.recentRuns || [], drafts = runs.reduce(function (all, run) { return all.concat(run.drafts || []); }, []), latest = runs[runs.length - 1] || null;
    return { retainedWindowCount:runs.length, candidateExecutionCount:drafts.length, draftedCandidateCount:drafts.filter(function (draft) { return draft.status === 'DRAFTED'; }).length, failedCandidateCount:drafts.filter(function (draft) { return draft.status === 'FAILED'; }).length, pendingReviewCount:(bridge.queue || []).filter(function (item) { return item.state === 'PENDING'; }).length, latestDraftCount:latest && latest.drafts ? latest.drafts.length : 0, lastDurationMs:runDuration(latest), latestBeatSequence:latest && latest.beatSequence };
  }
  function localDateTimeValue(value) {
    if (!value) return '';
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  }
  function renderHeartbeat(status, pulseStatus) {
    currentHeartbeat = status;
    var bridge = status.verificationBridge || {};
    var draftBridge = status.codeDraftBridge || {};
    var learningBridge = status.mirrorLearningBridge || {};
    var draftQueue = draftBridge.queue || [];
    var draftRuns = (draftBridge.recentRuns || []).slice().reverse().slice(0, 4);
    var latestDraftRun = draftRuns[0];
    var enabled = status.config && status.config.enabled === true;
    var pulseOpen = pulseStatus && ['ACTIVE', 'CONSERVE'].indexOf(pulseStatus.mode) >= 0;
    var verificationFacts = verificationEvidence(bridge);
    var draftFacts = draftEvidence(draftBridge);
    var latestVerificationRun = (bridge.recentRuns || []).slice(-1)[0] || null;
    var latestVerificationChecks = latestVerificationRun && latestVerificationRun.checks || [];
    var latestVerificationPassed = latestVerificationChecks.filter(function (check) { return check.status === 'PASS'; }).length;
    var sameCycle = verificationFacts.latestBeatSequence != null && verificationFacts.latestBeatSequence === draftFacts.latestBeatSequence;
    var latestCycleMs = Number(verificationFacts.lastDurationMs || 0) + (sameCycle ? Number(draftFacts.lastDurationMs || 0) : 0);
    $('heartbeatState').textContent = enabled ? 'BEATING' : 'STOPPED';
    $('heartbeatCadence').textContent = cadenceLabel(status.config && status.config.cadenceMs);
    $('heartbeatNote').textContent = enabled
      ? (status.scheduleMode === 'ANCHORED' ? 'Runs from the chosen local time. Missed beats coalesce; no catch-up burst is allowed.' : 'One shared clock. Missed beats coalesce after sleep; no catch-up burst is allowed.')
      : 'The timing organ is stopped. Its receipts and settings remain preserved.';
    $('heartbeatNext').textContent = enabled && status.nextDueAt ? new Date(status.nextDueAt).toLocaleString() : 'not scheduled';
    $('heartbeatSchedule').textContent = status.scheduleMode === 'ANCHORED' ? 'anchored' : 'interval from change';
    $('verificationState').textContent = pulseOpen ? (bridge.state || 'IDLE') : 'HELD · Pulse ' + String(pulseStatus && pulseStatus.mode || 'unknown');
    $('verificationBudget').textContent = Number(bridge.maxChecksPerHour || 10) + ' checks/hour';
    $('codeDraftState').textContent = draftBridge.enabled === false ? 'DORMANT · QUEUE PRESERVED' : pulseOpen ? ((draftBridge.state || 'IDLE') + (latestDraftRun ? ' · ' + latestDraftRun.status : '')) : 'HELD';
    $('codeDraftQueueCount').textContent = draftQueue.length + ' active';
    $('codeDraftBudget').textContent = draftBridge.enabled === false ? 'STOPPED · 1/H IF ENABLED' : Number(draftBridge.maxDraftsPerHour || 1) + ' draft/hour';
    $('mirrorLearningState').textContent = learningBridge.enabled ? (learningBridge.state || 'GATED') : 'PREPARED · OFF';
    $('mirrorLearningLane').textContent = learningBridge.state || 'DORMANT';
    $('mirrorLearningPulse').textContent = learningBridge.pulseModule && learningBridge.pulseModule.enabled ? 'ENABLED · ' + esc(learningBridge.pulseModule.mode) : 'DISABLED';
    $('mirrorLearningFeed').textContent = learningBridge.lastActionFeedState || 'UNKNOWN';
    $('mirrorLearningWaiting').textContent = (learningBridge.waitingLessons || []).length + ' WAITING';
    $('mirrorLearningReason').textContent = learningBridge.lastReason || 'Prepared without activation.';
    $('mirrorLearningBadge').textContent = learningBridge.enabled ? 'LANE ON · GATES STILL APPLY' : 'OFF BY DEFAULT';
    $('mirrorLearningToggle').textContent = learningBridge.enabled ? 'Turn lesson lane OFF' : 'Prepared · turn lane ON';
    $('mirrorLearningToggle').classList.toggle('on', learningBridge.enabled === true);
    $('heartbeatProfile').value = status.config && status.config.profileId !== 'custom' ? status.config.profileId : 'low';
    if (document.activeElement !== $('heartbeatAnchor')) $('heartbeatAnchor').value = localDateTimeValue(status.nextDueAt);
    $('heartbeatToggle').textContent = enabled ? 'Stop heartbeat' : 'Start heartbeat';
    $('verificationDeckSize').textContent = Number(bridge.deckSize || 0) + ' safe checks available';
    $('verificationNext').innerHTML = (bridge.nextChecks || []).map(function (check, index) {
      return '<span><b>' + (index + 1) + '</b>' + esc(check.label) + '</span>';
    }).join('') || '<p>The deterministic deck is not linked yet.</p>';
    $('verificationRuns').innerHTML = (bridge.recentRuns || []).slice().reverse().slice(0, 4).map(function (run) {
      var passed = (run.checks || []).filter(function (check) { return check.status === 'PASS'; }).length;
      return '<div><b>' + esc(run.status) + '</b><span>Beat ' + esc(run.beatSequence) + ' · ' + passed + '/' + (run.checks || []).length + ' passed</span><small>' + esc(run.completedAt ? new Date(run.completedAt).toLocaleString() : 'running') + '</small></div>';
    }).join('') || '<p>No scheduled verification window has run yet.</p>';
    $('heartbeatWallTime').textContent = latestCycleMs ? elapsed(latestCycleMs) : 'not measured';
    $('heartbeatLatestChecks').textContent = latestVerificationPassed + ' / ' + latestVerificationChecks.length + ' PASS';
    $('heartbeatCheckHistory').textContent = Number(verificationFacts.passCheckCount || 0) + ' / ' + Number(verificationFacts.checkExecutionCount || 0) + ' retained executions passed';
    $('heartbeatCoverage').textContent = Number(verificationFacts.uniqueCheckCount || 0) + ' / ' + Number(bridge.deckSize || 0);
    $('heartbeatCpuEvidence').textContent = Number.isFinite(verificationFacts.peakCpuUsedRatio) ? Math.round(verificationFacts.peakCpuUsedRatio * 100) + '% peak' : 'unknown';
    $('heartbeatCpuNote').textContent = Number(verificationFacts.pressureSampleCount || 0) ? (Math.round(Number(verificationFacts.averageCpuUsedRatio || 0) * 100) + '% sampled average · ' + verificationFacts.pressureSampleCount + ' bounded samples') : 'Historical run had no bounded pressure series';
    $('heartbeatDraftYield').textContent = draftBridge.enabled === false ? 'DORMANT' : Number(draftFacts.latestDraftCount || 0) + ' LATEST';
    $('heartbeatDraftHistory').textContent = Number(draftFacts.pendingReviewCount || draftQueue.length || 0) + ' pending exact-digest candidate(s) preserved';
    var evidenceAttention = Number(verificationFacts.failedCheckCount || 0) > 0 || Number(draftFacts.failedCandidateCount || 0) > 0;
    $('heartbeatYield').textContent = evidenceAttention ? 'ATTENTION REQUIRED' : verificationFacts.checkExecutionCount ? 'USEFUL · EVIDENCE RETAINED' : 'AWAITING EVIDENCE';
    $('heartbeatYield').classList.toggle('attention', evidenceAttention);
    $('codeDraftNext').innerHTML = (draftBridge.nextDrafts || []).map(function (draft) { return '<span>' + esc(draft.moduleId) + ' · ' + esc(draft.repairClass) + '</span>'; }).join('') || '<p>No new allow-listed source improvement is waiting to be drafted.</p>';
    $('codeDraftQueue').innerHTML = draftQueue.map(function (item) {
      var moduleId = item.action && item.action.moduleId || item.title || 'candidate';
      var own = (item.votes || []).find(function (vote) { return String(vote.actor).toLowerCase() === 'mike'; });
      return '<article class="codeDraftCard" data-draft-review="' + esc(item.id) + '" data-draft-digest="' + esc(item.artifactDigest) + '"><div><span class="eyebrow">' + esc(item.state) + ' · ' + (item.votes || []).length + '/' + item.requiredSeats + ' REVIEWS</span><h4>' + esc(moduleId) + '</h4><code>' + esc(item.artifactDigest.slice(0,16)) + '…</code></div><div><small>' + esc(item.summary) + '</small><br><small>Queue until ' + esc(item.expiresAt ? new Date(item.expiresAt).toLocaleString() : 'seven-day retention check') + '</small></div><div class="codeDraftVote"><a href="../workshop-command-center/index.html#codeDraftReviewTitle">OPEN PLAIN-LANGUAGE REVIEW</a><small>' + (own ? ('Mike reviewed ' + esc(own.verdict)) : 'Technical steward must check first') + '</small></div></article>';
    }).join('') || '<p>No candidate drafts are waiting. The draft lane is dormant.</p>';
    $('codeDraftRuns').innerHTML = draftRuns.map(function (run) {
      var drafted = (run.drafts || []).filter(function (draft) { return draft.status === 'DRAFTED'; }).length;
      return '<div><b>' + esc(run.status) + '</b><span>Beat ' + esc(run.beatSequence == null ? run.beatId : run.beatSequence) + ' · ' + drafted + '/' + (run.drafts || []).length + ' drafted</span><small>' + esc(run.completedAt ? new Date(run.completedAt).toLocaleString() : 'running') + '</small></div>';
    }).join('') || '<p>No scheduled draft window has run yet.</p>';
    $('mirrorLearningRuns').innerHTML = (learningBridge.recentRuns || []).slice().reverse().slice(0, 4).map(function (run) {
      var lesson = run.lesson || {};
      return '<div><b>' + esc(run.status) + '</b><span>' + esc(lesson.moduleId || run.reason || 'No lesson') + '</span><small>' + esc(run.completedAt ? new Date(run.completedAt).toLocaleString() : 'running') + '</small></div>';
    }).join('') || '<p>No hourly lesson intake has run.</p>';
    document.querySelector('.heartbeat').classList.toggle('stopped', !enabled);
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
  async function refresh() { try { var values = await Promise.all([Pulse.status(), Heartbeat.status()]); render(values[0]); renderHeartbeat(values[1], values[0]); } catch (error) { $('modeNote').innerHTML = '<span class="error">' + esc(error.message) + '</span>'; $('heartbeatNote').innerHTML = '<span class="error">' + esc(error.message) + '</span>'; } }
  async function toggleModule(moduleId) { var module = current.modules.find(function (item) { return item.moduleId === moduleId; }); if (!module) return; render(await Pulse.register(Object.assign({}, module, { enabled: !module.enabled }))); }
  async function changeGoalStatus(goalId, status) { var goal = current.goals.find(function (item) { return item.goalId === goalId; }); if (!goal) return; render(await Pulse.goal(Object.assign({}, goal, { status: status, statusChangedBy: 'local-steward-ui' }))); }
  function selectedArchiveIds() { return Array.from(document.querySelectorAll('[data-archive-select]:checked')).map(function (checkbox) { return checkbox.dataset.archiveSelect; }); }
  function updateArchiveSelection() { $('deleteSelected').disabled = selectedArchiveIds().length === 0; }
  async function deleteArchived(goalIds, question) { if (!goalIds.length || !confirm(question)) return; render(await Pulse.deleteGoals(goalIds, 'local-steward-ui')); }
  document.querySelectorAll('[data-mode]').forEach(function (button) { button.onclick = async function () { await Pulse.setMode(button.dataset.mode, 'mike'); await refresh(); }; });
  $('refresh').onclick = refresh;
  $('heartbeatSave').onclick = async function () {
    var localValue = $('heartbeatAnchor').value;
    try {
      await Heartbeat.configure({ profileId: $('heartbeatProfile').value, anchorAt: localValue ? new Date(localValue).toISOString() : null, enabled: true, actorId: 'mike' });
      await refresh();
    } catch (error) {
      $('heartbeatNote').innerHTML = '<span class="error">' + esc(error.message) + '</span>';
    }
  };
  $('heartbeatToggle').onclick = async function () { await Heartbeat.configure({ enabled: !(currentHeartbeat && currentHeartbeat.config && currentHeartbeat.config.enabled), actorId: 'mike' }); await refresh(); };
  $('mirrorLearningToggle').onclick = async function () { try { await Heartbeat.configureMirrorLearning({ enabled: !(currentHeartbeat && currentHeartbeat.mirrorLearningBridge && currentHeartbeat.mirrorLearningBridge.enabled), actorId: 'mike' }); await refresh(); } catch (error) { $('mirrorLearningReason').innerHTML = '<span class="error">' + esc(error.message) + '</span>'; } };
  $('heartbeatStep').onclick = async function () { await Heartbeat.manual('mike'); await refresh(); };
  $('deleteSelected').onclick = function () { var ids = selectedArchiveIds(); deleteArchived(ids, 'Delete the ' + ids.length + ' selected archived request(s) permanently?'); };
  $('clearArchive').onclick = function () { var ids = current.goals.filter(function (goal) { return ['DONE', 'CANCELLED'].indexOf(goal.status) >= 0; }).map(function (goal) { return goal.goalId; }); deleteArchived(ids, 'Clear the entire request archive permanently? This cannot be undone.'); };
  $('goalForm').onsubmit = async function (event) { event.preventDefault(); render(await Pulse.goal({ moduleId: $('goalModule').value, title: $('goalTitle').value, priority: Number($('goalPriority').value), maxPulses: Number($('goalPulses').value), createdBy: 'mike', requiresReview: true })); $('goalTitle').value = ''; };
  refresh();
})();
