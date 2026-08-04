(function () {
  'use strict';

  var O = AXMOps;
  var notice = document.getElementById('notice');
  var candidateSelect = document.getElementById('candidate');
  var applyButton = document.getElementById('apply');
  var confirmInstall = document.getElementById('confirmInstall');
  var items = [];
  var pollTimer = null;

  function selected() {
    return items.find(function (item) { return item.id === candidateSelect.value; }) || null;
  }

  function shortDigest(value) {
    return value ? String(value).slice(0, 16) : 'unavailable';
  }

  function badge(label, tone) {
    return '<span class="badge ' + (tone || '') + '">' + O.esc(label) + '</span>';
  }

  function reviewTone(governance) {
    if (!governance || !governance.digestMatch) return 'bad';
    if (governance.reviewState === 'APPROVED') return 'ok';
    if (['REJECTED', 'REPAIR', 'CANCELLED', 'SUPERSEDED', 'MISSING'].includes(governance.reviewState)) return 'bad';
    return 'warn';
  }

  function verificationTone(verification) {
    var state = verification && verification.state;
    if (state === 'PASS' || state === 'ROLLED_BACK') return 'ok';
    if (state === 'FAIL' || state === 'ERROR') return 'bad';
    return state === 'RUNNING' || state === 'NOT_AVAILABLE' ? 'warn' : '';
  }

  function step(number, title, state, tone, detail) {
    return '<div class="lineage-step ' + O.esc(tone || '') + '"><span class="step-number">' + number + '</span><div><strong>' + O.esc(title) + '</strong>' + badge(state, tone) + '<small>' + O.esc(detail) + '</small></div></div>';
  }

  function changeSummary(intake) {
    var changes = intake && intake.changes;
    if (!changes) return '';
    return '+' + changes.added.length + ' added · ~' + changes.modified.length + ' changed · -' + changes.removed.length + ' removed';
  }

  function returnEvidence(item) {
    var intake = item.intake;
    if (!intake) return '';
    return '<div class="return-evidence"><strong>Returned build-on ZIP</strong>' +
      badge(intake.baseBinding || 'UNKNOWN BASE', intake.baseBinding === 'EXACT_MATCH' ? 'ok' : 'bad') +
      '<span>' + O.esc(changeSummary(intake)) + '</span>' +
      '<small>Export <code>' + O.esc(intake.exportId || 'unavailable') + '</code> · archive <code>' + O.esc(shortDigest(intake.archiveSha256)) + '</code> · target <code>' + O.esc(intake.targetScope || item.moduleId) + '</code></small></div>';
  }

  function syncApplyButton() {
    var item = selected();
    var eligible = !!(item && item.governance && item.governance.installEligible);
    applyButton.disabled = !(eligible && confirmInstall.value === 'INSTALL REVIEWED MODULE');
  }

  function detail() {
    var item = selected();
    var target = document.getElementById('candidateDetail');
    var applyState = document.getElementById('applyState');
    if (!item) {
      target.innerHTML = '<p class="muted">No pending candidate selected.</p>';
      applyState.className = 'badge warn';
      applyState.textContent = 'WAITING';
      syncApplyButton();
      return;
    }

    var governance = item.governance || {};
    var verification = item.verification || { state: 'NOT_RUN', truth: 'Post-install verification has not run.' };
    var warnings = item.warnings || [];
    var reviewDetail = governance.digestMatch
      ? (governance.approvals || 0) + ' of ' + (governance.requiredSeats || '?') + ' required approval(s)'
      : 'Review digest ' + shortDigest(governance.reviewDigest) + ' does not match';
    var requestState = governance.installEligible ? 'ELIGIBLE TO REQUEST' : 'HELD';
    var requestTone = governance.installEligible ? 'warn' : 'bad';
    var applyDetail = governance.installEligible
      ? 'Still needs module.install permission, typed confirmation, digest recheck, and backup-before-replace.'
      : (governance.holdReason || 'Exact-digest approval is unavailable.');
    var applied = !!item.appliedAt;
    var warningHtml = warnings.length
      ? '<div class="review-flags"><strong>Review flags · evidence, not accusation</strong><ul>' + warnings.map(function (warning) { return '<li>' + O.esc(warning) + '</li>'; }).join('') + '</ul></div>'
      : '<p class="clean-scan">No static review flags were found. Human review is still required.</p>';

    target.innerHTML =
      '<div class="candidate-heading"><div><span class="section-kicker">' + O.esc(item.mode.toUpperCase()) + '</span><h3>' + O.esc(item.name) + ' <small>' + O.esc(item.version) + '</small></h3></div>' + badge(item.state, applied ? 'ok' : warnings.length ? 'warn' : '') + '</div>' +
      returnEvidence(item) +
      '<div class="lineage">' +
        step('1', 'Staged candidate', 'BOUND', 'ok', item.fileCount + ' file(s) · ' + item.totalBytes + ' bytes · ' + shortDigest(item.digest)) +
        step('2', 'Exact-digest review', governance.reviewState || 'MISSING', reviewTone(governance), reviewDetail) +
        step('3', 'Explicit install request', requestState, requestTone, applyDetail) +
        step('4', 'Single-generation replace', applied ? 'APPLIED' : 'NOT RUN', applied ? 'ok' : '', applied ? ('Previous generation ' + (item.backupId || 'not needed for a new install')) : 'No tool files are written before the prior gates pass') +
        step('5', 'Post-install self-test', verification.state || 'NOT RUN', verificationTone(verification), verification.truth || 'No passing runtime receipt exists.') +
      '</div>' +
      warningHtml +
      '<dl class="evidence-list"><div><dt>Candidate</dt><dd>' + O.esc(item.id) + '</dd></div><div><dt>Review</dt><dd>' + O.esc(item.reviewId) + '</dd></div><div><dt>Candidate digest</dt><dd><code>' + O.esc(item.digest) + '</code></dd></div><div><dt>Digest match</dt><dd>' + (governance.digestMatch ? 'YES' : 'NO') + '</dd></div></dl>' +
      '<p class="authority-note">Review approval is evidence. It does not install, promote, or grant permission.</p>';

    syncApplyButton();
    applyState.className = 'badge ' + requestTone;
    applyState.textContent = requestState;
  }

  function verificationCell(item) {
    var governance = item.governance || {};
    var verification = item.verification || { state: 'NOT_RUN' };
    var receiptCurrent = verification.receiptAppliesToCurrentModule === true;
    var gate = governance.installEligible ? badge('ELIGIBLE TO REQUEST', 'warn') : badge(item.appliedAt ? 'APPLIED' : 'HELD', item.appliedAt ? 'ok' : 'bad');
    var verify = item.appliedAt ? '<br>' + badge((receiptCurrent ? 'SELF-TEST ' : 'HISTORICAL SELF-TEST ') + verification.state, receiptCurrent ? verificationTone(verification) : 'warn') : '';
    var rollback = receiptCurrent && verification.state === 'FAIL' && verification.rollbackAvailable
      ? '<br><button class="secondary mini-action" data-prepare-rollback="' + O.esc(item.moduleId) + '">Roll back previous</button>'
      : '';
    var truth = receiptCurrent
      ? (verification.truth || '')
      : (verification.currentDigestState === 'DRIFT' ? (verification.truth || 'Historical receipt only: the current module digest differs; current verification is UNKNOWN.') : 'Historical receipt only: current digest comparison is unavailable; current verification is UNKNOWN.');
    return gate + verify + rollback + '<br><span class="muted">' + O.esc(item.appliedAt ? truth : (governance.holdReason || '')) + '</span>';
  }

  function load() {
    var previous = candidateSelect.value;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    return O.get('/api/installer').then(function (data) {
      items = data.candidates || [];
      document.getElementById('rows').innerHTML = items.map(function (item) {
        var governance = item.governance || {};
        var warnings = item.warnings || [];
        var candidateTone = item.state === 'APPLIED' ? 'ok' : warnings.length ? 'warn' : '';
        return '<tr><td><strong>' + O.esc(item.moduleId) + '</strong><br><span class="muted">' + O.esc(item.version) + ' · ' + O.esc(item.mode) + '</span></td><td>' + badge(item.state, candidateTone) + '<br><code>' + O.esc(item.id) + '</code>' + (item.intake ? '<br><span class="muted">' + O.esc(changeSummary(item.intake)) + '</span>' : '') + '</td><td>' + badge(governance.reviewState || 'MISSING', reviewTone(governance)) + '<br><span class="muted">' + O.esc(item.reviewId) + '</span></td><td>' + badge(governance.digestMatch ? 'MATCH' : 'MISMATCH', governance.digestMatch ? 'ok' : 'bad') + '<br><code>' + shortDigest(item.digest) + '</code></td><td>' + verificationCell(item) + '</td></tr>';
      }).join('') || '<tr><td colspan="5">No staged candidates.</td></tr>';

      var pending = items.filter(function (item) { return !item.appliedAt; });
      candidateSelect.innerHTML = pending.map(function (item) { return '<option value="' + O.esc(item.id) + '">' + O.esc(item.moduleId) + ' · ' + O.esc(item.governance ? item.governance.reviewState : item.state) + '</option>'; }).join('');
      if (pending.some(function (item) { return item.id === previous; })) candidateSelect.value = previous;
      detail();
      if (items.some(function (item) { return item.verification && item.verification.state === 'RUNNING'; })) pollTimer = setTimeout(load, 1500);
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  }

  function readAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '').split(',')[1] || ''); };
      reader.onerror = function () { reject(reader.error || new Error('Could not read the returned ZIP.')); };
      reader.readAsDataURL(file);
    });
  }

  function loadBackups(moduleId, announce) {
    var id = String(moduleId || document.getElementById('rollbackModule').value).trim();
    if (!id) { O.notice(notice, 'Enter a module id before loading backups.', 'warn'); return Promise.resolve([]); }
    document.getElementById('rollbackModule').value = id;
    return O.get('/api/installer?moduleId=' + encodeURIComponent(id)).then(function (data) {
      var backups = data.backups || [];
      document.getElementById('backup').innerHTML = backups.map(function (item) { return '<option value="' + O.esc(item.backupId) + '">' + O.esc(item.backupId) + ' · ' + O.date(item.createdAt) + '</option>'; }).join('');
      if (announce !== false) O.notice(notice, backups.length ? 'Previous generation is ready for explicit rollback.' : 'No retained previous generation was found.', backups.length ? '' : 'warn');
      return backups;
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); return []; });
  }

  function prepareRollback(moduleId) {
    loadBackups(moduleId, true).then(function (backups) {
      if (backups.length) document.querySelector('.rollback-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  candidateSelect.onchange = detail;
  confirmInstall.oninput = syncApplyButton;
  document.getElementById('refresh').onclick = load;

  document.getElementById('stageReturn').onclick = function () {
    var file = document.getElementById('returnZip').files[0];
    if (!file) return O.notice(notice, 'Choose the improved build-on ZIP.', 'warn');
    if (file.size > 30 * 1024 * 1024) return O.notice(notice, 'The returned ZIP is larger than the 30 MB safety limit.', 'bad');
    O.notice(notice, 'Reading and comparing the returned ZIP…', '');
    readAsBase64(file).then(function (archiveBase64) {
      return O.post('/api/installer/stage-return', {
        return: { schema: 'axm.workshop-package-return/v1', archiveBase64: archiveBase64, moduleId: document.getElementById('returnModule').value.trim() },
        actor: document.getElementById('actor').value
      }, { 'x-axm-installer': 'explicit-return-stage' });
    }).then(function (item) {
      O.notice(notice, 'Return matched the current base and staged ' + item.moduleId + ' (' + changeSummary(item.intake) + '). Review ' + item.reviewId + ' owns the exact candidate digest.', 'ok');
      load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('stage').onclick = function () {
    var file = document.getElementById('bundle').files[0];
    if (!file) return O.notice(notice, 'Choose a module bundle JSON file.', 'warn');
    file.text().then(JSON.parse).then(function (bundle) {
      return O.post('/api/installer/stage', { bundle: bundle, actor: document.getElementById('actor').value }, { 'x-axm-installer': 'explicit-stage' });
    }).then(function (item) {
      O.notice(notice, 'Staged ' + item.moduleId + ' as ' + item.id + '. Review ' + item.reviewId + ' now owns the exact digest.', 'ok');
      load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  applyButton.onclick = function () {
    var item = selected();
    if (!item) return O.notice(notice, 'Choose a pending candidate.', 'warn');
    O.post('/api/installer/apply', { candidateId: item.id, confirmation: confirmInstall.value }, { 'x-axm-installer': 'apply-approved-digest' }).then(function (done) {
      var suffix = done.verificationJobId ? ' Post-install self-test started.' : ' No executable self-test was available; runtime behavior remains unverified.';
      confirmInstall.value = '';
      O.notice(notice, done.moduleId + ' installed. Previous generation: ' + (done.backupId || 'not needed for a new module') + '.' + suffix, done.verificationJobId ? 'ok' : 'warn');
      load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('rows').onclick = function (event) {
    var button = event.target.closest('[data-prepare-rollback]');
    if (button) prepareRollback(button.getAttribute('data-prepare-rollback'));
  };

  document.getElementById('loadBackups').onclick = function () { loadBackups(); };

  document.getElementById('rollback').onclick = function () {
    O.post('/api/installer/rollback', { moduleId: document.getElementById('rollbackModule').value.trim(), backupId: document.getElementById('backup').value, confirmation: document.getElementById('confirmRollback').value }, { 'x-axm-installer': 'explicit-rollback' }).then(function (item) {
      document.getElementById('confirmRollback').value = '';
      O.notice(notice, item.moduleId + ' rolled back from its retained previous generation.', 'ok');
      load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  load();
}());
