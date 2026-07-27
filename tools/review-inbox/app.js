(function () {
  'use strict';

  var O = AXMOps;
  var notice = document.getElementById('notice');
  var items = [];
  var current = null;

  function evidenceLine(label, value) {
    return value ? '<span>' + O.esc(label) + ': <code>' + O.esc(value) + '</code></span>' : '';
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
    current = items.find(function (item) { return item.id === id; }) || null;
    document.querySelectorAll('.review-card').forEach(function (card) {
      card.classList.toggle('selected', card.dataset.id === id);
    });
    document.getElementById('selected').textContent = current ? O.pretty({
      id: current.id,
      title: current.title,
      state: current.state,
      digest: current.artifactDigest,
      source: current.sourceRef,
      requiredSeats: current.requiredSeats,
      votes: current.votes,
      action: current.action
    }) : 'Select an exact-digest review item.';
    document.getElementById('vote').disabled = !current;
  }

  function renderDigestQueue(data) {
    items = Array.isArray(data.items) ? data.items : [];
    var summary = data.summary || { total: 0, byState: {} };
    document.getElementById('facts').innerHTML = '<span>' + O.esc(summary.total || 0) + ' total</span>' + Object.keys(summary.byState || {}).map(function (state) {
      return '<span>' + O.esc(state) + ' ' + O.esc(summary.byState[state]) + '</span>';
    }).join('');
    document.getElementById('items').innerHTML = items.map(function (item) {
      var badge = item.state === 'APPROVED' ? 'ok' : item.state === 'REJECTED' ? 'bad' : 'warn';
      return '<article class="card review-card" data-id="' + O.esc(item.id) + '">' +
        '<span class="badge ' + badge + '">' + O.esc(item.state) + '</span>' +
        '<h3>' + O.esc(item.title) + '</h3>' +
        '<p>' + O.esc(item.summary) + '</p>' +
        '<p class="muted"><code>' + O.esc(String(item.artifactDigest || '').slice(0, 18)) + '</code> · ' + O.esc((item.votes || []).length) + '/' + O.esc(item.requiredSeats) + ' seat(s)</p>' +
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
    if (!current) return;
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
