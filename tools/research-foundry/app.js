(function () {
  'use strict';
  var report = null, view = 'builders';
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function byGap(id) { return report.gaps.find(function (item) { return item.id === id; }); }
  function experimentFor(gapId) { return report.experiments.find(function (item) { return item.gapId === gapId; }); }
  function metric(value, label) { return '<article class="metric"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></article>'; }
  function backlogCard(item) {
    var gap = byGap(item.gapId) || {}, experiment = experimentFor(item.gapId);
    return '<article class="card"><header><div><span class="route">' + esc(item.proposedRoute.replace(/_/g,' ')) + '</span><h2>' + esc(item.capabilityId) + '</h2></div><span class="score">' + item.score + ' pts</span></header><p>' + esc(item.title) + '</p><div class="chips"><span class="chip">' + esc(item.gapType) + '</span><span class="chip">' + esc(gap.source || 'goal') + '</span><span class="chip">' + esc(item.status) + '</span></div>' + (experiment ? '<details><summary>Cheapest disconfirming test</summary><p>' + esc(experiment.claim.passCondition) + '</p><ol>' + experiment.procedure.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol></details>' : '') + '</article>';
  }
  function questionCard(item) {
    var experiment = experimentFor(item.gapId);
    return '<article class="card"><header><div><span class="route">OPEN QUESTION</span><h2>' + esc(item.capabilityId) + '</h2></div></header><p>' + esc(item.question) + '</p>' + (experiment ? '<details><summary>Evidence route</summary><p><b>Pass:</b> ' + esc(experiment.claim.passCondition) + '</p><p><b>Counterevidence:</b> ' + esc(experiment.claim.counterevidence) + '</p><p><b>Primary:</b> <code>' + esc(experiment.claim.primarySurface) + '</code></p></details>' : '') + '</article>';
  }
  function truth() {
    return Object.keys(report.truth).map(function (key) { return '<article class="card"><header><h2>' + esc(key.replace(/([A-Z])/g,' $1')) + '</h2><span class="score">' + esc(report.truth[key]) + '</span></header></article>'; }).join('');
  }
  function render() {
    if (!report) return;
    var html = '';
    if (view === 'builders') html = report.backlog.builders.map(backlogCard).join('');
    if (view === 'stewards') html = report.backlog.stewards.map(backlogCard).join('');
    if (view === 'questions') html = report.questions.map(questionCard).join('');
    if (view === 'truth') html = truth();
    document.getElementById('content').innerHTML = html || '<div class="empty">No items in this queue.</div>';
  }
  document.querySelector('.tabs').addEventListener('click', function (event) {
    if (!event.target.dataset.view) return;
    view = event.target.dataset.view;
    document.querySelectorAll('.tabs button').forEach(function (button) { button.classList.toggle('active', button === event.target); });
    render();
  });
  fetch('/exports/deterministic-research/latest/research-report.json', { cache:'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('Run the deterministic research CLI to generate the first report.');
    return response.json();
  }).then(function (data) {
    report = data;
    document.getElementById('objective').textContent = report.goal.objective;
    document.getElementById('status').textContent = report.route + ' · digest ' + report.researchDigest.slice(0,16) + ' · observed ' + report.observedAt;
    document.getElementById('summary').innerHTML = metric(report.workshop.summary.modules,'Workshop modules') + metric(report.workshop.summary.exactCapabilities,'Exact declared capabilities') + metric(report.gaps.length,'Open research gaps') + metric(report.backlog.builders.length,'Builder candidates') + metric(report.backlog.stewards.length,'Steward decisions');
    render();
  }).catch(function (error) {
    var status = document.getElementById('status'); status.textContent = error.message; status.classList.add('error');
    document.getElementById('content').innerHTML = '<div class="empty">No research claim was invented as a fallback.</div>';
  });
})();
