(function () {
  'use strict';

  var O = AXMOps;
  var notice = document.getElementById('notice');
  var items = [];
  var current = null;
  var authorityIndex = { policy: { state: 'NOT_CONFIGURED' }, byReviewId: {} };
  var operationLease = { state:'HELD', reasonCode:'LEASE_STATUS_UNAVAILABLE' };
  var currentVoteReady = false;
  var selectionRevision = 0;
  var typedReviewKinds = [
    'model-shadow-retention-audit-hold',
    'model-shadow-transition-settlement-history-reconciliation'
  ];

  function typedViewFor(item) {
    return [window.AXMRetentionAuditReviewView, window.AXMHistoryReconciliationReviewView].find(function (view) {
      return view && typeof view.inspect === 'function' && view.REVIEW_KIND === item.kind;
    }) || null;
  }

  function evidenceLine(label, value) {
    return value ? '<span>' + O.esc(label) + ': <code>' + O.esc(value) + '</code></span>' : '';
  }

  function authorityFor(item) {
    return item && authorityIndex && authorityIndex.byReviewId && authorityIndex.byReviewId[item.id] || null;
  }

  function recoveryFor(item) {
    var recovery = authorityIndex && authorityIndex.recovery;
    var operations = recovery && Array.isArray(recovery.operations) ? recovery.operations : [];
    return item ? operations.filter(function (operation) { return operation.reviewId === item.id; }) : [];
  }

  function mutationLeaseFree() { return operationLease && operationLease.state === 'FREE'; }

  function renderAuthorityStatus(index, lease) {
    authorityIndex = index && typeof index === 'object' ? index : { policy: { state:'NOT_CONFIGURED' }, byReviewId:{} };
    operationLease = lease && typeof lease === 'object' ? lease : { state:'HELD', reasonCode:'LEASE_STATUS_UNAVAILABLE' };
    var policy = authorityIndex.policy || { state:'NOT_CONFIGURED' };
    var recovery = authorityIndex.recovery || { state:'HELD', reasonCode:'RECOVERY_STATUS_UNAVAILABLE', pendingOperations:0, blockedOperations:0, invalidOperations:0 };
    var node = document.getElementById('authorityStatus');
    var ready = policy.state === 'READY' && recovery.state === 'CURRENT';
    var pending = policy.state === 'READY' && recovery.state === 'RECOVERY_REQUIRED';
    node.className = 'authority-status ' + (!mutationLeaseFree() ? 'hold' : ready ? 'ready' : pending ? 'recovery' : 'hold');
    if (!mutationLeaseFree()) node.innerHTML = '<b>Review mutation lease held</b><span>' + O.esc(operationLease.reasonCode || 'REVIEW_OPERATION_LEASE_PRESENT') + (operationLease.acquiredAt ? ' · owner metadata acquiredAt: ' + O.esc(operationLease.acquiredAt) : '') + '</span><small>The holder may be active, crashed, or invalid; this page does not infer liveness or offer an unlock route. Mutations fail closed pending operator inspection.</small>';
    else if (ready) node.innerHTML = '<b>Host-key path current</b><span>' + O.esc(policy.enabledKeys || 0) + ' enabled public key(s) · ' + O.esc(recovery.projectedOperations || 0) + ' current projection(s)</span><small>Configured-key possession only. No real-world identity, human participation, or trusted time is proven.</small>';
    else if (pending) node.innerHTML = '<b>Signed projection recovery required</b><span>' + O.esc(recovery.pendingOperations || 0) + ' durable signed intent(s) have no matching ordinary Review Inbox projection</span><small>Authority stays held. Recovery is an explicit host-only method; there is no browser recovery route or automatic replay.</small>';
    else if (policy.state === 'READY') node.innerHTML = '<b>Host-key projection held</b><span>' + O.esc(recovery.reasonCode || recovery.state || 'HELD') + ' · ' + O.esc((recovery.blockedOperations || 0) + (recovery.invalidOperations || 0)) + ' blocked or invalid operation(s)</span><small>No automatic recovery, action authority, rollback protection, or external custody is claimed.</small>';
    else node.innerHTML = '<b>Host-key authority held</b><span>' + O.esc(policy.state || 'NOT_CONFIGURED') + ' · attributed votes remain separate</span><small>Legacy APPROVED can never substitute for authenticated authority.</small>';
  }

  function renderStructural(view) {
    var status = document.getElementById('structuralStatus');
    var root = document.getElementById('structuralCandidates');
    view = view || { state: 'UNAVAILABLE', reason: 'Structural review evidence was not returned.', reviewCandidates: [] };
    if (view.state !== 'CURRENT') {
      status.className = 'structural-status hold';
      status.innerHTML = '<b>Review evidence needs attention</b><span>' + O.esc(view.state) + ' · ' + O.esc(view.reason || 'No current structural evidence is available.') + '</span>';
      root.innerHTML = '<p class="truth">No module is shown as ready for inspection while this evidence is ' + O.esc(String(view.state).toLowerCase()) + '.</p>';
      return;
    }

    var summary = view.summary || {};
    var candidates = Array.isArray(view.reviewCandidates) ? view.reviewCandidates : [];
    status.className = 'structural-status';
    status.innerHTML = '<b>Evidence is current · ' + candidates.length + ' module' + (candidates.length === 1 ? '' : 's') + ' ready for human inspection</b><span>' + O.esc(summary.contractsValid) + ' valid contracts · ' + O.esc(summary.topLevelSelftests) + ' top-level self-tests · ' + O.esc(summary.legacyKinds) + ' legacy kind declarations remain</span>';
    root.innerHTML = candidates.map(function (candidate) {
      var paths = candidate.evidencePaths || {};
      var open = candidate.moduleRoute ? '<a href="' + O.esc(candidate.moduleRoute) + '">Inspect module</a>' : '';
      return '<article class="structural-card">' +
        '<span class="eyebrow">HUMAN DECISION REQUIRED</span>' +
        '<h3>' + O.esc(candidate.name || candidate.id) + '</h3>' +
        '<code>' + O.esc(candidate.id) + ' · ' + O.esc(candidate.version || 'version unknown') + '</code>' +
        '<div class="evidence-paths">' +
          evidenceLine('manifest', paths.manifest) +
          evidenceLine('contract', paths.contract) +
          evidenceLine('self-test', paths.selftest) +
        '</div>' +
        '<p class="truth">Current structural and self-test evidence is ready to inspect. Nothing has been approved or promoted.</p>' +
        (open ? '<div class="actions">' + open + '</div>' : '') +
      '</article>';
    }).join('') || '<p class="truth">The evidence is current; no module is waiting for human inspection.</p>';
  }

  function select(id) {
    var revision = ++selectionRevision;
    current = items.find(function (item) { return item.id === id; }) || null;
    currentVoteReady = false;
    document.querySelectorAll('.review-card').forEach(function (card) {
      card.classList.toggle('selected', card.dataset.id === id);
    });
    var typedRoot = document.getElementById('typedReview');
    var vote = document.getElementById('vote');
    document.getElementById('selected').textContent = current ? O.pretty({
      id: current.id,
      kind: current.kind,
      title: current.title,
      state: current.state,
      digest: current.artifactDigest,
      source: current.sourceRef,
      requiredSeats: current.requiredSeats,
      votes: current.votes,
      action: current.action,
      authorityEvidence: authorityFor(current),
      projectionRecoveryEvidence: recoveryFor(current),
      operationLeaseEvidence: operationLease
    }) : 'Select an exact-digest review item.';
    if (!current) {
      typedRoot.innerHTML = '';
      vote.disabled = true;
      return;
    }
    var typed = typedViewFor(current);
    if (!typed || typeof typed.inspect !== 'function') {
      if (typedReviewKinds.indexOf(current.kind) !== -1) typedRoot.innerHTML = '<section class="typed-audit-review hold" role="alert"><span class="badge bad">HOLD</span><h3>Typed artifact verifier unavailable</h3><p>Voting is disabled. Raw evidence remains below for diagnosis.</p></section>';
      else { typedRoot.innerHTML = ''; currentVoteReady = true; }
      vote.disabled = !currentVoteReady || !mutationLeaseFree();
      return;
    }
    if (current.kind === typed.REVIEW_KIND) typedRoot.innerHTML = typed.renderPending();
    else typedRoot.innerHTML = '';
    vote.disabled = current.kind === typed.REVIEW_KIND;
    typed.inspect(current).then(function (view) {
      if (revision !== selectionRevision || !current || current.id !== id) return;
      typedRoot.innerHTML = typed.render(view);
      currentVoteReady = view.applies ? view.voteReady === true : true;
      vote.disabled = !currentVoteReady || !mutationLeaseFree();
    }).catch(function () {
      if (revision !== selectionRevision || !current || current.id !== id) return;
      typedRoot.innerHTML = typed.renderUnavailable();
      currentVoteReady = false;
      vote.disabled = true;
    });
  }

  function renderDigestQueue(data) {
    renderAuthorityStatus(data.authority, data.operationLease);
    items = Array.isArray(data.items) ? data.items : [];
    var summary = data.summary || { total: 0, byState: {} };
    document.getElementById('facts').innerHTML = '<span>' + O.esc(summary.total || 0) + ' total</span>' + Object.keys(summary.byState || {}).map(function (state) {
      return '<span>' + O.esc(state) + ' ' + O.esc(summary.byState[state]) + '</span>';
    }).join('');
    document.getElementById('items').innerHTML = items.map(function (item) {
      var authority = authorityFor(item);
      var authenticated = authority && authority.authorityState === 'HOST_KEY_AUTHENTICATED_APPROVED';
      var projectionPending = authority && authority.projectionState === 'PENDING';
      var projectionInvalid = authority && authority.projectionState === 'INVALID';
      var badge = item.state === 'APPROVED' && authenticated ? 'ok' : item.state === 'REJECTED' ? 'bad' : 'warn';
      if (projectionInvalid) badge = 'bad';
      var stateLabel = projectionPending ? item.state + ' · SIGNED PROJECTION PENDING' : projectionInvalid ? item.state + ' · AUTH EVIDENCE INVALID' : item.state === 'APPROVED' ? (authenticated ? 'APPROVED · HOST KEY' : 'APPROVED · AUTHORITY HELD') : item.state;
      var seats = authority ? authority.authenticatedApprovalSeats + '/' + authority.requiredSeats + ' authenticated' : '0/' + item.requiredSeats + ' authenticated';
      return '<article class="card review-card" data-id="' + O.esc(item.id) + '">' +
        '<span class="badge ' + badge + '">' + O.esc(stateLabel) + '</span>' +
        '<h3>' + O.esc(item.title) + '</h3>' +
        '<p>' + O.esc(item.summary) + '</p>' +
        '<p class="muted"><code>' + O.esc(String(item.artifactDigest || '').slice(0, 18)) + '</code> · ' + O.esc((item.votes || []).length) + '/' + O.esc(item.requiredSeats) + ' attributed · ' + O.esc(seats) + '</p>' +
        '<button class="secondary choose">Inspect exact digest</button>' +
      '</article>';
    }).join('') || '<p>No exact-digest review items in this state.</p>';
    document.querySelectorAll('.choose').forEach(function (button) {
      button.onclick = function () { select(this.closest('.review-card').dataset.id); };
    });
    if (current) select(current.id);
  }

  function load() {
    var state = document.getElementById('filter').value;
    O.get('/api/reviews' + (state ? '?state=' + encodeURIComponent(state) : '')).then(function (data) {
      renderStructural(data.structuralReview);
      renderDigestQueue(data);
    }).catch(function (error) {
      renderStructural({ state: 'UNAVAILABLE', reason: error.message, reviewCandidates: [] });
      O.notice(notice, error.message, 'bad');
    });
  }

  document.getElementById('filter').onchange = load;
  document.getElementById('vote').onclick = function () {
    if (!current || !currentVoteReady || !mutationLeaseFree()) return;
    O.post('/api/reviews/vote', {
      id: current.id,
      artifactDigest: current.artifactDigest,
      actor: document.getElementById('actor').value,
      actorKind: document.getElementById('actorKind').value,
      verdict: document.getElementById('verdict').value,
      note: document.getElementById('note').value,
      confirmation: document.getElementById('confirmation').value
    }, { 'x-axm-review': 'exact-digest-vote' }).then(function (item) {
      O.notice(notice, 'Vote recorded. Item state: ' + item.state + '.', 'ok');
      current = item;
      load();
    }).catch(function (error) {
      O.notice(notice, error.message, 'bad');
    });
  };

  load();
})();
