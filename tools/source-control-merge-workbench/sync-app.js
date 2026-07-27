(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var output = byId('sync-output');
  var state = byId('sync-state');
  var capability = byId('sync-capability');
  var summary = byId('sync-summary');
  var reviewedPlanDigest = null;
  var planVerified = false;
  var busy = false;
  var pushConfirmation = 'PUSH REVIEWED PUBLIC SNAPSHOT';

  function show(value) { output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
  function envelope(response) { return response.json().then(function (body) { if (!response.ok || !body.ok) throw new Error(body && body.error || 'request failed'); return body.result; }); }
  function element(tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function bytes(value) {
    var amount = Number(value || 0), units = ['B','KB','MB','GB'], index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return (index ? amount.toFixed(amount >= 10 ? 1 : 2) : String(amount)) + ' ' + units[index];
  }
  function updateControls() {
    var hasPlan = !!reviewedPlanDigest;
    byId('sync-plan').disabled = busy;
    byId('sync-export-plan').disabled = busy || !hasPlan;
    byId('sync-verify').disabled = busy || !hasPlan;
    byId('sync-run').disabled = busy || !hasPlan || !planVerified || byId('sync-run-confirmation').value !== pushConfirmation;
    byId('sync-run').textContent = busy ? 'Background job running...' : '3. Push reviewed plan';
  }
  function setReviewedDigest(value) {
    reviewedPlanDigest = value || null;
    planVerified = false;
    byId('sync-plan-digest').value = reviewedPlanDigest || '';
    if (!reviewedPlanDigest) { summary.hidden = true; summary.replaceChildren(); }
    updateControls();
  }
  function setBusy(value) { busy = value === true; updateControls(); }

  function renderPlanSummary(plan) {
    summary.replaceChildren();
    summary.hidden = false;
    var head = element('div', 'summary-head');
    head.append(element('strong', '', plan.executable ? 'PUBLIC-SAFE PLAN READY' : 'PLAN HELD'));
    head.append(element('span', plan.executable ? 'pass' : 'held', plan.executable ? '0 blockers' : plan.counts.blockers + ' blockers'));
    summary.append(head);
    var metrics = element('div', 'summary-metrics');
    [
      ['Changes', plan.counts.changes],
      ['Add', plan.counts.adds],
      ['Update', plan.counts.updates],
      ['Changed bytes', bytes(plan.counts.changedBytes)]
    ].forEach(function (row) { var card = element('div', 'summary-metric'); card.append(element('span', '', row[0])); card.append(element('strong', '', String(row[1]))); metrics.append(card); });
    summary.append(metrics);
    summary.append(element('p', 'summary-source', plan.source.files + ' public-safe files · ' + bytes(plan.source.bytes) + ' total · source ' + plan.source.digest.slice(0,12) + '...'));
    var areas = element('div', 'summary-areas');
    areas.append(element('strong', '', 'Largest change areas'));
    plan.areas.slice(0,8).forEach(function (area) { var row = element('div', 'summary-area'); row.append(element('code', '', area.area)); row.append(element('span', '', area.changes + ' changes · ' + bytes(area.bytes))); areas.append(row); });
    summary.append(areas);
    if (plan.advisoryRemovals.count) summary.append(element('p', 'summary-advisory', plan.advisoryRemovals.count + ' tracked paths are advisory removals. This method will not delete them.'));
    summary.append(element('p', 'summary-note', 'Review the summary, export the complete JSON if needed, then verify this exact digest.'));
  }

  function render(status) {
    var config = status.config || {};
    capability.textContent = status.capability || 'UNKNOWN';
    capability.classList.toggle('ready', status.capability === 'MANUAL_REVIEW_READY');
    capability.classList.toggle('held', status.capability === 'HELD' || status.capability === 'MISSING_GIT');
    if (!busy) state.textContent = status.hold ? 'Held: ' + status.hold : status.capability === 'MANUAL_REVIEW_READY' ? 'Manual planning is ready. Build and inspect one exact plan before pushing.' : status.capability === 'DISABLED' ? 'Configuration is saved but planning is disabled.' : 'Choose a separate clean Git working copy to configure this lane.';
    if (config.repositoryRoot) byId('sync-repository').value = config.repositoryRoot;
    if (config.remoteName) byId('sync-remote').value = config.remoteName;
    if (config.targetBranch) byId('sync-branch').value = config.targetBranch;
    if (config.authorName) byId('sync-author').value = config.authorName;
    if (config.authorEmail) byId('sync-email').value = config.authorEmail;
    byId('sync-enabled').checked = config.enabled === true;
  }
  function refresh() { return fetch('/api/github-sync').then(envelope).then(render).catch(function (error) { state.textContent = 'Git sync status unavailable: ' + error.message; capability.textContent = 'UNAVAILABLE'; capability.classList.add('held'); }); }

  byId('sync-config').onsubmit = function (event) {
    event.preventDefault();
    setBusy(true);
    var request = { repositoryRoot:byId('sync-repository').value.trim(), remoteName:byId('sync-remote').value.trim(), targetBranch:byId('sync-branch').value.trim(), authorName:byId('sync-author').value.trim(), authorEmail:byId('sync-email').value.trim(), enabled:byId('sync-enabled').checked, pushEnabled:false, approvedBy:null, actor:'Mike', confirmation:byId('sync-confirmation').value };
    fetch('/api/github-sync/configure', { method:'POST', headers:{ 'content-type':'application/json', 'x-axm-github-sync':'explicit-configuration' }, body:JSON.stringify(request) }).then(envelope).then(function (result) { byId('sync-confirmation').value = ''; setReviewedDigest(null); render(result); show({ configured:true, capability:result.capability, unattendedPush:false }); }).catch(function (error) { show('Configuration held: ' + error.message); }).finally(function () { setBusy(false); });
  };

  byId('sync-plan').onclick = function () {
    setReviewedDigest(null);
    setBusy(true);
    state.textContent = 'Calculating the public-safe inventory and exact change digest...';
    show('Building a read-only public-safe plan...');
    fetch('/api/github-sync/plan').then(envelope).then(function (plan) {
      setReviewedDigest(plan.planDigest);
      renderPlanSummary(plan);
      state.textContent = plan.executable ? 'Plan ready. Review the summary or export the complete JSON, then verify this exact digest.' : 'Plan held by ' + plan.counts.blockers + ' blocker(s).';
      show({ state:plan.executable ? 'PLAN_READY' : 'PLAN_HELD', planDigest:plan.planDigest, sourceDigest:plan.source.digest, counts:plan.counts, areas:plan.areas.slice(0,8), advisoryRemovals:plan.advisoryRemovals.count, blockers:plan.blockers });
    }).catch(function (error) { show('Dry plan held: ' + error.message); state.textContent = 'Dry plan held. Inspect the reason below.'; }).finally(function () { setBusy(false); });
  };

  byId('sync-export-plan').onclick = function () {
    if (!reviewedPlanDigest) return;
    setBusy(true);
    show('Rebuilding the exact plan before local export...');
    fetch('/api/github-sync/plan/full', { method:'POST', headers:{ 'content-type':'application/json', 'x-axm-github-sync':'export-exact-plan' }, body:JSON.stringify({ planDigest:reviewedPlanDigest }) }).then(envelope).then(function (plan) {
      var blob = new Blob([JSON.stringify(plan, null, 2) + '\n'], { type:'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'axm-github-sync-plan-' + reviewedPlanDigest.slice(0,12) + '.json';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      show({ state:'FULL_PLAN_EXPORTED', planDigest:reviewedPlanDigest, changes:plan.changes.length, localFile:link.download });
    }).catch(function (error) { show('Full plan export held: ' + error.message); }).finally(function () { setBusy(false); });
  };

  byId('sync-verify').onclick = function () {
    if (!reviewedPlanDigest) return;
    setBusy(true);
    state.textContent = 'Rebuilding and verifying the exact reviewed digest...';
    show('Rebuilding and verifying the exact reviewed digest...');
    fetch('/api/github-sync/verify', { method:'POST', headers:{ 'content-type':'application/json', 'x-axm-github-sync':'verify-exact-plan' }, body:JSON.stringify({ planDigest:reviewedPlanDigest }) }).then(envelope).then(function (verification) {
      planVerified = verification.state === 'PASS';
      state.textContent = planVerified ? 'Exact plan verified. Type the confirmation phrase to unlock the one-use push.' : 'Verification refused. Rebuild the plan before continuing.';
      show(verification);
    }).catch(function (error) { planVerified = false; show('Plan verification held: ' + error.message); state.textContent = 'Verification held. Rebuild the plan before continuing.'; }).finally(function () { setBusy(false); });
  };

  function pollJob(id) {
    fetch('/api/machine-host/jobs?id=' + encodeURIComponent(id)).then(envelope).then(function (job) {
      if (job.state === 'RUNNING') { show({ job:job.id, state:job.state, action:job.action, startedAt:job.startedAt }); window.setTimeout(function () { pollJob(id); }, 1000); return; }
      setBusy(false);
      byId('sync-run-confirmation').value = '';
      setReviewedDigest(null);
      state.textContent = job.state === 'PASS' ? 'Automation branch pushed. Review the draft-PR candidate before opening or merging anything.' : 'Push job ' + job.state.toLowerCase() + '. The exact log is shown below; rebuild the plan before retrying.';
      show({ job:job.id, state:job.state, startedAt:job.startedAt, endedAt:job.endedAt, exitCode:job.exitCode, signal:job.signal, error:job.error, output:job.output });
      refresh();
    }).catch(function (error) { setBusy(false); setReviewedDigest(null); show('Push job status unavailable: ' + error.message); state.textContent = 'Push job status became unavailable. Inspect Machine Host before retrying.'; });
  }

  byId('sync-run').onclick = function () {
    if (!reviewedPlanDigest || !planVerified || byId('sync-run-confirmation').value !== pushConfirmation) return;
    setBusy(true);
    state.textContent = 'The reviewed push is running as a bounded background job...';
    show('Starting the fixed digest-locked background push...');
    fetch('/api/github-sync/manual-push', { method:'POST', headers:{ 'content-type':'application/json', 'x-axm-github-sync':'manual-reviewed-push' }, body:JSON.stringify({ planDigest:reviewedPlanDigest, confirmation:byId('sync-run-confirmation').value, actor:'Mike' }) }).then(envelope).then(function (job) { show({ job:job.id, state:job.state, action:job.action, note:'The Hub remains responsive while Machine Host records PASS, FAIL, or ERROR.' }); pollJob(job.id); }).catch(function (error) { setBusy(false); show('Manual push held: ' + error.message); state.textContent = 'Manual push held. Nothing was sent.'; });
  };

  byId('sync-run-confirmation').addEventListener('input', updateControls);
  setReviewedDigest(null);
  refresh();
})();
