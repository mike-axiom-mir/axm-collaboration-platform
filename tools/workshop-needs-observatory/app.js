(function () {
  'use strict';

  var O = window.AXMOps;
  var state = null;
  var notice = document.getElementById('notice');

  function esc(value) { return O.esc(value); }
  function show(text, tone) { O.notice(notice, text, tone); }
  function active(need) { return need.state !== 'SATISFIED' && need.state !== 'CANCELLED'; }

  function renderReadiness() {
    var readiness = state.readiness || { state: 'UNAVAILABLE', reviewCandidates: [], reason: 'Readiness evidence is unavailable.' };
    var status = document.getElementById('readiness-status');
    var candidates = document.getElementById('review-candidates');
    if (readiness.state !== 'CURRENT') {
      status.innerHTML = '<div class="readiness-hold"><b>Review evidence needs a refresh</b><span>' + esc(readiness.reason) + '</span></div>';
      candidates.innerHTML = '<p class="truth">No module is shown as review-ready while the evidence is ' + esc(readiness.state.toLowerCase()) + '.</p>';
      return;
    }

    var summary = readiness.summary || {};
    status.innerHTML = '<div class="readiness-current"><b>Evidence is current</b><span>' + esc(summary.contractsValid) + ' valid contracts &middot; ' + esc(summary.topLevelSelftests) + ' top-level self-tests &middot; ' + esc(summary.legacyKinds) + ' legacy kind declarations left</span></div>';
    candidates.innerHTML = readiness.reviewCandidates.map(function (candidate) {
      return '<article class="review-card"><span class="eyebrow">HUMAN DECISION REQUIRED</span><h3>' + esc(candidate.name) + '</h3><code>' + esc(candidate.id) + '</code><p>Current contract and self-test evidence is ready to inspect. Nothing has been promoted.</p></article>';
    }).join('') || '<p class="truth">The evidence is current; no module is waiting for human review.</p>';
  }

  function renderInventory() {
    var query = document.getElementById('filter').value.toLowerCase();
    var rows = state.inventory.capabilities.filter(function (capability) {
      return !query || (capability.id + ' ' + capability.providers.join(' ')).toLowerCase().indexOf(query) >= 0;
    });
    var shown = rows.slice(0, 120);
    document.getElementById('inventory').innerHTML = (rows.length > shown.length ? '<p class="truth">Showing ' + shown.length + ' of ' + rows.length + ' declarations. Filter to narrow the body.</p>' : '') + (shown.map(function (capability) {
      return '<div class="inventory-row"><code>' + esc(capability.id) + '</code><span>' + esc(capability.providers.join(', ')) + '</span></div>';
    }).join('') || '<p class="truth">No matching declared capability.</p>');
  }

  function render() {
    var summary = state.summary;
    document.getElementById('summary').innerHTML = [
      ['OPEN NEEDS', summary.open],
      ['SATISFIED', summary.satisfied],
      ['MODULES', summary.installedModules],
      ['PROMOTED PIECES', summary.promotedPieces],
      ['REVIEW CANDIDATES', summary.reviewCandidates || 0],
      ['EXACT CAPABILITIES', summary.exactCapabilities],
      ['DECLARATION DRIFT', summary.declarationFindings || 0],
      ['VISIBLE GAPS', summary.derivedGaps]
    ].map(function (item) {
      return '<div class="meter"><span>' + item[0] + '</span><b>' + item[1] + '</b></div>';
    }).join('');

    renderReadiness();
    document.getElementById('derived').innerHTML = state.derived.map(function (gap) {
      return '<div class="gap"><span>' + esc(gap.gapType) + '</span><b>' + esc(gap.title) + '</b><small>' + esc(gap.truth || gap.status) + '</small></div>';
    }).join('') || '<p class="truth">No derived gaps.</p>';

    var options = '<option value="">Choose a quarantined or promoted candidate</option>' + state.candidates.map(function (candidate) {
      return '<option value="' + esc(candidate.id) + '">' + esc(candidate.piece.title) + ' &middot; ' + esc(candidate.state) + '</option>';
    }).join('');
    document.getElementById('needs').innerHTML = state.needs.map(function (need) {
      var ready = need.computedState === 'READY_TO_CLOSE' || need.state === 'READY_TO_CLOSE';
      return '<article class="need ' + (ready ? 'ready ' : '') + (active(need) ? '' : 'closed') + '"><span class="eyebrow">' + esc(need.state) + (need.computedState ? ' &rarr; ' + esc(need.computedState) : '') + '</span><h3>' + esc(need.title) + '</h3><p>' + esc(need.description) + '</p><div class="caps">' + need.requiredCapabilities.map(function (capability) { return '<code>' + esc(capability) + '</code>'; }).join('') + '</div><p class="truth">Missing now: ' + esc((need.currentlyMissing || []).join(', ') || 'none') + '</p>' + (active(need) ? '<div class="match-row"><select data-select="' + esc(need.id) + '">' + options + '</select><button data-match="' + esc(need.id) + '">Match exact</button></div><div class="actions">' + (ready ? '<button data-satisfy="' + esc(need.id) + '">Accept built capability</button>' : '') + '<button class="secondary" data-pause="' + esc(need.id) + '">Pause</button><button class="danger" data-cancel="' + esc(need.id) + '">Cancel</button></div>' : '') + '</article>';
    }).join('') || '<p class="truth">No needs recorded yet.</p>';

    renderInventory();
    bind();
  }

  function load() {
    return O.get('/api/workshop-needs').then(function (value) { state = value; render(); }).catch(function (error) { show(error.message, 'bad'); });
  }

  function post(url, data, header, value) {
    var headers = {};
    headers[header] = value;
    return O.post(url, data, headers).then(function () { show('State updated.', 'ok'); return load(); }).catch(function (error) { show(error.message, 'bad'); });
  }

  function bind() {
    document.querySelectorAll('[data-match]').forEach(function (button) {
      button.onclick = function () {
        var id = button.dataset.match;
        var select = document.querySelector('[data-select="' + id + '"]');
        if (!select.value) return show('Choose a candidate first.', 'warn');
        post('/api/workshop-needs/match', { needId: id, candidateId: select.value, actor: 'Mike' }, 'x-axm-needs', 'exact-capability-match');
      };
    });
    document.querySelectorAll('[data-satisfy]').forEach(function (button) {
      button.onclick = function () {
        if (!confirm('Accept this promoted exact capability as satisfying the need?')) return;
        post('/api/workshop-needs/transition', { needId: button.dataset.satisfy, state: 'SATISFIED', confirmation: 'ACCEPT BUILT CAPABILITY', actor: 'Mike' }, 'x-axm-needs', 'explicit-transition');
      };
    });
    document.querySelectorAll('[data-pause]').forEach(function (button) {
      button.onclick = function () { post('/api/workshop-needs/transition', { needId: button.dataset.pause, state: 'PAUSED', actor: 'Mike' }, 'x-axm-needs', 'explicit-transition'); };
    });
    document.querySelectorAll('[data-cancel]').forEach(function (button) {
      button.onclick = function () {
        if (confirm('Cancel this need?')) post('/api/workshop-needs/transition', { needId: button.dataset.cancel, state: 'CANCELLED', actor: 'Mike' }, 'x-axm-needs', 'explicit-transition');
      };
    });
  }

  document.getElementById('create').onclick = function () {
    var capabilities = document.getElementById('capabilities').value.split(/\r?\n|,/).map(function (value) { return value.trim(); }).filter(Boolean);
    post('/api/workshop-needs/create', { title: document.getElementById('title').value, description: document.getElementById('description').value, requiredCapabilities: capabilities, priority: document.getElementById('priority').value, actor: 'Mike' }, 'x-axm-needs', 'explicit-create');
  };
  document.getElementById('refresh').onclick = load;
  document.getElementById('filter').oninput = renderInventory;
  load();
}());
