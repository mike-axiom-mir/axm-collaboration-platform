(function () {
  'use strict';
  var api = window.AXMFabrication;
  var zeros = '0'.repeat(64), ones = '1'.repeat(64), twos = '2'.repeat(64), threes = '3'.repeat(64);
  var ids = ['processFamily','format','width','height','depth','tolerance','technical','machine','humanVisual','machineVote','operator'];
  var currentCandidate = null, currentEvaluation = null;

  function el(id) { return document.getElementById(id); }
  function receipt(ok, digest) { return { status: ok ? 'PASS' : 'MISSING', digest: ok ? digest : '' }; }
  function review(enabled, action, digest) { return enabled ? { action: action, candidateDigest: zeros, digest: digest } : null; }

  function candidate() {
    var tech = el('technical').checked, machine = el('machine').checked;
    return {
      schema: 'axm.fabrication-candidate/v1', id: 'readiness-preview-001', digest: zeros,
      source: { id: 'ucp-preview', version: '1', digest: ones, provenanceDigest: twos, licenseId: 'LOCAL-RESEARCH' },
      adapter: { id: 'vendor-neutral-preview', version: '0.1', processFamily: el('processFamily').value, vendorNeutral: true, standardInterchangeFormat: el('format').value.trim(), automaticExecution: false },
      physical: {
        dimensions: { widthMm: Number(el('width').value), heightMm: Number(el('height').value), depthMm: Number(el('depth').value) },
        scale: '1:1', orientation: 'upright', geometryIntent: 'closed printable solid', colourIntent: 'preserve authored colour', textureIntent: 'preserve authored texture', materialIntent: 'operator-selected compatible material', transparencyIntent: 'preserve where process supports it', strengthRequirement: 'display object only', toleranceMm: Number(el('tolerance').value), safetyNotes: ['External operator must confirm machine and material safety.']
      },
      technical: {
        sourceIntegrity: receipt(tech, ones), formatValidation: receipt(tech, twos), geometryValidation: receipt(tech, threes), printability: receipt(tech, ones), simulation: receipt(tech, twos), materialCompatibility: receipt(tech, threes)
      },
      machine: { evidenceClass: machine ? 'NATIVE_TEST' : 'ADVERTISEMENT', claimsVerified: machine, profileDigest: machine ? threes : '', vendorAiBypassable: machine, coreOfflineCapable: machine },
      reviews: {
        humanVisual: review(el('humanVisual').checked, 'APPROVE', ones),
        machineCrosscheck: review(el('machineVote').checked, 'RECOMMEND', twos),
        humanOperator: review(el('operator').checked, 'APPROVE_BOUNDED_TEST', threes)
      },
      hardwareCommand: null
    };
  }

  function render() {
    currentCandidate = candidate();
    currentEvaluation = api.evaluate(currentCandidate);
    var status = currentEvaluation.status, badge = el('statusBadge');
    badge.textContent = status.replaceAll('_', ' ');
    badge.className = 'status ' + (status === 'BOUNDED_EXTERNAL_TEST_PACKAGE_READY' ? 'ready' : status === 'BLOCKED' ? 'blocked' : 'review');
    el('resultTitle').textContent = status === 'BOUNDED_EXTERNAL_TEST_PACKAGE_READY' ? 'One external test package may be prepared.' : status === 'BLOCKED' ? 'This candidate violates a hard boundary.' : 'The route is visible; evidence is still missing.';
    el('resultText').textContent = currentEvaluation.nextCheapestStep;
    var items = currentEvaluation.failed.concat(currentEvaluation.missing, currentEvaluation.holds);
    el('gapList').innerHTML = items.length ? items.slice(0, 10).map(function (item) { return '<li><strong>' + escapeHtml(item.id) + '</strong> — ' + escapeHtml(item.detail) + '</li>'; }).join('') : '<li>All digital, technical and governance gates are present.</li>';
    el('packageButton').disabled = status !== 'BOUNDED_EXTERNAL_TEST_PACKAGE_READY';
    el('packageOutput').hidden = true;
  }

  function escapeHtml(value) { var node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
  function reset() { ids.forEach(function(id){ var node=el(id); if(node.type==='checkbox') node.checked=false; }); el('processFamily').value='full-colour-3d';el('format').value='3MF';el('width').value=80;el('height').value=120;el('depth').value=45;el('tolerance').value=.2;render(); }

  el('evaluateButton').addEventListener('click', render);
  el('resetButton').addEventListener('click', reset);
  el('packageButton').addEventListener('click', function () {
    var output = api.buildBoundedTestPackage(currentCandidate, currentEvaluation);
    el('packageOutput').textContent = JSON.stringify(output, null, 2);
    el('packageOutput').hidden = false;
  });
  render();
}());
