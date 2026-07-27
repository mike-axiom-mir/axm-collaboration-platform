(function () {
  'use strict';
  var Engine = window.AXMGameOrganism;
  var Examples = window.AXMGameOrganismExamples;
  var exact = Examples.createStreetLifeExample();
  var activeBlueprint = exact.blueprint;
  var lastReceipt = null;
  var colors = {
    'intent': '#42e7e1', 'design': '#4ea1ff', 'world-rules': '#55bfff', 'physics': '#6df0a8',
    'animation': '#ffc55f', 'asset': '#b57aff', 'assembly': '#e48cff', 'playtest-eye': '#42e7e1',
    'evidence': '#63b8ff', 'repair': '#ff9f6e', 'release-gate': '#ffc55f'
  };
  function el(id) { return document.getElementById(id); }
  function escapeHtml(value) { var node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
  function reseal(mutator) {
    var copy = JSON.parse(JSON.stringify(exact.blueprint));
    delete copy.digest;
    mutator(copy);
    activeBlueprint = Engine.sealBlueprint(copy);
  }
  function organFor(reference) {
    return exact.registry.resolve(reference);
  }
  function renderFlow(brokenCategory) {
    el('organCount').textContent = activeBlueprint.organs.length + ' ORGANS';
    el('organFlow').innerHTML = activeBlueprint.organs.map(function (reference, index) {
      var organ = organFor(reference);
      var broken = brokenCategory === reference.slot_category ? ' broken' : '';
      return '<article class="organ' + broken + '" style="--organ-color:' + colors[reference.slot_category] + '">' +
        '<span class="number">' + String(index + 1).padStart(2, '0') + ' / ' + escapeHtml(reference.slot_category.toUpperCase()) + '</span>' +
        '<h3>' + escapeHtml(organ ? organ.title : 'Missing exact organ') + '</h3>' +
        '<p>' + escapeHtml(organ ? organ.implementation.reference : reference.organ_id) + '</p>' +
        '<span class="state">' + escapeHtml(organ ? organ.implementation.status : 'MISSING') + '</span></article>';
    }).join('');
  }
  function renderReceipt(receipt) {
    lastReceipt = receipt;
    var ready = receipt.verdict === 'CANDIDATE_READY';
    el('verdict').textContent = receipt.verdict.replaceAll('_', ' ');
    el('verdict').className = 'verdict ' + (ready ? 'ready' : 'held');
    el('receiptDigest').textContent = receipt.digest.slice(0, 18) + '…';
    el('resultTitle').textContent = ready ? 'The anatomy fits. A candidate plan may be reviewed.' : 'The organism is held at its broken seam.';
    el('resultText').textContent = ready
      ? 'Compilation created an ordered, evidence-routed assembly plan. It did not run the plan, install a build or judge whether the game is fun.'
      : 'No weaker organ was substituted and no category was coerced. Restore or deliberately replace the failing part.';
    var messages = receipt.errors.length ? receipt.errors : receipt.warnings;
    el('issueList').innerHTML = messages.slice(0, 8).map(function (message) { return '<li>' + escapeHtml(message) + '</li>'; }).join('');
    el('orderedCount').textContent = receipt.execution_order.length;
    el('evidenceCount').textContent = receipt.evidence_plan.length;
    el('judgmentCount').textContent = receipt.human_judgments.length;
    el('exportButton').disabled = false;
  }
  function compile() { renderReceipt(Engine.compile(activeBlueprint, exact.registry)); }
  el('assembleButton').addEventListener('click', compile);
  el('severButton').addEventListener('click', function () {
    reseal(function (copy) {
      copy.connections = copy.connections.filter(function (connection) {
        return !(connection.to.instance_id === 'organ-04' && connection.to.port === 'rules');
      });
    });
    renderFlow('physics'); compile();
  });
  el('budgetButton').addEventListener('click', function () {
    reseal(function (copy) { copy.resource_budget = { cpu_weight: 1, gpu_weight: 1, peak_memory_mb: 16, working_storage_mb: 16 }; });
    renderFlow(); compile();
  });
  el('restoreButton').addEventListener('click', function () {
    activeBlueprint = exact.blueprint; renderFlow(); compile();
  });
  el('exportButton').addEventListener('click', function () {
    if (!lastReceipt) return;
    var blob = new Blob([JSON.stringify(lastReceipt, null, 2) + '\n'], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'street-life-game-organism-receipt.json';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
  });
  renderFlow();
}());
