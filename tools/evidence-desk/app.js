(function () {
  'use strict';

  var Core = window.AXMEvidenceCore;
  var INBOX_KEY = 'axm.knowledge-canvas.inbox.v1';
  var $ = function (id) { return document.getElementById(id); };
  var current = null;
  var currentDirty = true;
  var currentTab = 'report';
  var handoffPreview = null;
  var lastHandoff = null;
  var claimSerial = 0;
  var suspendDirty = false;

  function setStatus(message, state) {
    $('status').textContent = message;
    $('status').dataset.state = state || '';
    if (window.AXMHub) AXMHub.log(message);
  }
  function gate(action, detail) {
    try {
      var decision = AXMGate.submit({
        action: 'evidence-desk.' + action,
        actor: 'local-user', actorType: 'human', tool: 'evidence-desk', detail: detail || {}
      });
      if (!decision.allow) {
        setStatus('Gate denied: ' + decision.reason, 'error');
        return false;
      }
      return true;
    } catch (error) {
      setStatus('Gate unavailable: ' + error.message, 'error');
      return false;
    }
  }
  function splitRows(id, mapper) {
    return $(id).value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
      return mapper(line.split('|').map(function (part) { return part.trim(); }));
    });
  }
  function lines(id) {
    return $(id).value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
  }
  function setValue(node, value) { node.value = value == null ? '' : value; }
  function updateRoute(card) {
    var route = Core.CLAIM_ROUTES[card.querySelector('.claim-kind').value] || Core.CLAIM_ROUTES.other;
    card.querySelector('.route-surface').textContent = route.surface;
    card.querySelector('.route-guidance').textContent = route.evidence;
  }
  function refreshClaimNumbers() {
    Array.prototype.forEach.call(document.querySelectorAll('.claim-card'), function (card, index) {
      card.querySelector('.claim-number').textContent = 'CLAIM ' + (index + 1);
    });
  }
  function addClaim(value) {
    claimSerial += 1;
    var normalized = Core.normalize({ observations: [value || {}] }).observations[0] || Core.normalize({ observations: [''] }).observations[0];
    var card = $('claimTemplate').content.firstElementChild.cloneNode(true);
    card.dataset.claimId = normalized && normalized.id || ('claim-' + claimSerial);
    var kind = card.querySelector('.claim-kind');
    Core.CLAIM_KINDS.forEach(function (id) {
      var option = document.createElement('option');
      option.value = id;
      option.textContent = Core.CLAIM_ROUTES[id].label;
      kind.appendChild(option);
    });
    setValue(card.querySelector('.claim-text'), normalized && normalized.claim);
    setValue(kind, normalized && normalized.kind || 'other');
    setValue(card.querySelector('.claim-risk'), normalized && normalized.risk || 'MEDIUM');
    setValue(card.querySelector('.claim-verdict'), normalized && normalized.verdict || 'UNKNOWN');
    setValue(card.querySelector('.claim-pass'), normalized && normalized.pass_condition);
    setValue(card.querySelector('.claim-observed'), normalized && normalized.observed_evidence);
    setValue(card.querySelector('.claim-counter'), normalized && normalized.counterevidence);
    setValue(card.querySelector('.claim-source-kind'), normalized && normalized.source_kind);
    setValue(card.querySelector('.claim-source'), normalized && normalized.source);
    setValue(card.querySelector('.claim-seam'), normalized && normalized.named_seam);
    kind.addEventListener('change', function () { updateRoute(card); });
    card.querySelector('.remove-claim').addEventListener('click', function () {
      card.remove();
      if (!$('claimRows').children.length) addClaim();
      refreshClaimNumbers();
      markDirty();
    });
    $('claimRows').appendChild(card);
    updateRoute(card);
    refreshClaimNumbers();
    return card;
  }
  function claimsInput() {
    return Array.prototype.map.call(document.querySelectorAll('.claim-card'), function (card) {
      return {
        id: card.dataset.claimId,
        claim: card.querySelector('.claim-text').value,
        kind: card.querySelector('.claim-kind').value,
        risk: card.querySelector('.claim-risk').value,
        verdict: card.querySelector('.claim-verdict').value,
        pass_condition: card.querySelector('.claim-pass').value,
        primary_surface: card.querySelector('.route-surface').textContent,
        observed_evidence: card.querySelector('.claim-observed').value,
        counterevidence: card.querySelector('.claim-counter').value,
        source_kind: card.querySelector('.claim-source-kind').value,
        source: card.querySelector('.claim-source').value,
        named_seam: card.querySelector('.claim-seam').value
      };
    }).filter(function (claim) { return claim.claim.trim(); });
  }
  function inputData() {
    return {
      schema: Core.INPUT_SCHEMA,
      title: $('title').value.trim(), goal: $('goal').value.trim(),
      actor: { id: $('actor').value.trim(), type: $('actorType').value.trim() },
      source_checkpoint: $('checkpoint').value.trim(),
      observations: claimsInput(),
      actions: splitRows('actionsIn', function (p) { return { action: p[0], target: p[1], result: p[2], evidence: p[3], effect: 'bounded-local' }; }),
      checks: splitRows('checks', function (p) { return { name: p[0], status: p[1], evidence: p[2] }; }),
      changes: splitRows('changes', function (p) { return { path: p[0], kind: p[1], summary: p[2] }; }),
      limitations: lines('limits'), next_actions: lines('next')
    };
  }
  function rawProject() {
    return { format: 'axm.evidence-desk-draft/v2', input: inputData(), receipt: currentDirty ? null : current };
  }
  function applyInput(data) {
    suspendDirty = true;
    var normalized = Core.normalize(data || {});
    setValue($('title'), normalized.title);
    setValue($('goal'), normalized.goal);
    setValue($('actor'), normalized.actor.id);
    setValue($('actorType'), normalized.actor.type);
    setValue($('checkpoint'), normalized.source_checkpoint);
    $('claimRows').replaceChildren();
    if (normalized.observations.length) normalized.observations.forEach(addClaim);
    else addClaim();
    setValue($('actionsIn'), normalized.actions.map(function (a) { return [a.action, a.target, a.result, a.evidence].join(' | '); }).join('\n'));
    setValue($('checks'), normalized.checks.map(function (c) { return [c.name, c.status, c.evidence].join(' | '); }).join('\n'));
    setValue($('changes'), normalized.changes.map(function (c) { return [c.path, c.kind, c.summary].join(' | '); }).join('\n'));
    setValue($('limits'), normalized.limitations.join('\n'));
    setValue($('next'), normalized.next_actions.join('\n'));
    suspendDirty = false;
    markDirty();
  }
  function markDirty() {
    if (suspendDirty) return;
    currentDirty = true;
    handoffPreview = null;
    lastHandoff = null;
    $('placeKnowledge').disabled = true;
    $('receiptStatus').textContent = current ? 'INPUT CHANGED' : 'DRAFT';
    $('deliveryState').textContent = 'NOT PREVIEWED';
    if (current) setStatus('Inputs changed · rebuild to create a matching sealed receipt.');
  }
  function renderMetrics() {
    var counts = current && current.counts;
    $('nResolved').textContent = counts ? counts.claims_passed + counts.claims_failed : '0';
    $('nOpen').textContent = counts ? counts.claims_unknown : '0';
    $('nChecks').textContent = counts ? counts.checks_passed : '0';
    $('sealState').textContent = current && current.integrity ? current.integrity.state : 'UNSEALED';
    $('deliveryState').textContent = lastHandoff ? lastHandoff.deliveryState : (handoffPreview ? 'PREVIEWED' : 'NOT PREVIEWED');
  }
  function handoffOutput() {
    if (!handoffPreview && !lastHandoff) return 'No handoff preview yet.\n\nPreviewing performs no inbox write. Placing the preview proves only the local inbox write; Knowledge Canvas acceptance remains pending.';
    return JSON.stringify({ packetPreview: handoffPreview, deliveryReceipt: lastHandoff }, null, 2);
  }
  function render() {
    renderMetrics();
    $('receiptStatus').textContent = currentDirty ? (current ? 'INPUT CHANGED' : 'DRAFT') : current.status;
    if (currentTab === 'handoff') $('output').textContent = handoffOutput();
    else if (!current) $('output').textContent = 'No receipt built yet.';
    else $('output').textContent = currentTab === 'json' ? JSON.stringify(current, null, 2) : Core.report(current);
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (button) {
      button.classList.toggle('active', button.dataset.tab === currentTab);
    });
    var digest = current && current.integrity && current.integrity.digest;
    $('digest').textContent = digest || 'Not sealed';
    $('integrityText').textContent = digest
      ? 'Recomputable content seal. This detects changed receipt bytes; it does not certify the supplied evidence as true.'
      : 'Build the receipt to create a SHA-256 integrity seal.';
  }
  async function buildReceipt() {
    if (!gate('receipt.build', { effect: 'read-only' })) return null;
    setStatus('Building canonical receipt and computing SHA-256…');
    try {
      current = await Core.seal(inputData());
      var integrity = await Core.verify(current);
      if (!integrity.ok) throw new Error('new receipt did not pass its own integrity check');
      currentDirty = false;
      handoffPreview = null;
      lastHandoff = null;
      $('placeKnowledge').disabled = true;
      render();
      var state = current.validation_errors.length ? 'error' : (current.status.indexOf('VERIFIED') >= 0 || current.status.indexOf('OBSERVED_WITH') >= 0 ? 'ok' : '');
      setStatus(current.status + ' · ' + current.warnings.length + ' warning(s) · SHA-256 MATCH', state);
      return current;
    } catch (error) {
      setStatus('Receipt build failed: ' + error.message, 'error');
      return null;
    }
  }
  function validateOnly() {
    if (!gate('receipt.validate', { effect: 'read-only' })) return;
    var result = Core.validate(inputData());
    currentTab = 'json';
    $('output').textContent = JSON.stringify({ ok: result.ok, errors: result.errors, warnings: result.warnings }, null, 2);
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (button) { button.classList.toggle('active', button.dataset.tab === currentTab); });
    setStatus((result.ok ? 'STRUCTURE VALID' : 'STRUCTURE INVALID') + ' · ' + result.errors.length + ' error(s) · ' + result.warnings.length + ' warning(s)', result.ok ? '' : 'error');
  }
  function loadExample() {
    applyInput({
      title: 'Evidence Desk v0.2 review',
      goal: 'Prove the receipt core is structured and leave visual usability open until observed.',
      actor: { id: 'local-steward', type: 'human-machine' },
      source_checkpoint: 'tools/evidence-desk · TEST v0.2',
      observations: [
        {
          id: 'claim-structure', claim: 'The module emits a versioned Evidence Desk v2 receipt.', kind: 'static-structure', risk: 'MEDIUM', verdict: 'PASS',
          pass_condition: 'The parsed receipt schema and module contract both declare axm.evidence-receipt/v2.',
          observed_evidence: 'Parsed manifest, contract, and a sealed sample receipt.',
          counterevidence: 'Any parsed artifact declares another receipt schema or fails structural validation.',
          source_kind: 'schema-validation', source: 'tools/evidence-desk/evidence-receipt.schema.json'
        },
        {
          id: 'claim-mobile', claim: 'The complete Evidence Desk journey is usable on a narrow phone viewport.', kind: 'interaction-journey', risk: 'MEDIUM', verdict: 'UNKNOWN',
          pass_condition: 'A person can add a claim, seal a receipt, and preview a handoff without horizontal overflow.',
          counterevidence: 'Controls overlap, content clips, or the journey cannot be completed at the declared viewport.',
          named_seam: 'Live mobile observation has not run yet.'
        }
      ],
      actions: [{ action: 'module.build', target: 'tools/evidence-desk', result: 'v0.2 candidate created', evidence: 'changed-file digest inventory' }],
      checks: [{ name: 'Evidence Desk focused selftest', status: 'PASS', evidence: 'node tools/evidence-desk/selftest.js' }],
      changes: [{ path: 'tools/evidence-desk', kind: 'modified', summary: 'typed routes, SHA-256 sealing, and explicit handoff preview' }],
      limitations: ['Receipt generation records supplied evidence and does not inspect the world independently.', 'Knowledge Canvas acceptance has no receiver acknowledgement in this version.'],
      next_actions: ['Run live desktop and mobile interaction checks.', 'Keep the module in TEST until human review.']
    });
    setStatus('Example loaded · its mobile claim intentionally remains UNKNOWN until observed.');
  }
  async function ensureCurrent() {
    if (!current || currentDirty) return buildReceipt();
    var verified = await Core.verify(current);
    if (!verified.ok) {
      setStatus('Current receipt integrity mismatch · rebuild required.', 'error');
      return null;
    }
    return current;
  }
  function download(name, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type || 'text/plain' }));
    var anchor = document.createElement('a');
    anchor.download = name;
    anchor.href = url;
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }
  function safeStem(value) {
    return (value || 'evidence-receipt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'evidence-receipt';
  }
  async function saveDraft() {
    if (!gate('draft.save', { effect: 'local-write' })) return;
    try {
      await AXM.store.save('latest', rawProject(), { title: 'Evidence Desk v0.2 draft' });
      setStatus('Draft saved locally by explicit action.', 'ok');
    } catch (error) { setStatus('Draft save failed: ' + error.message, 'error'); }
  }
  async function resumeDraft() {
    if (!gate('draft.load', { effect: 'read-only' })) return;
    try {
      var saved = await AXM.store.load('latest');
      if (!saved || !saved.data) return setStatus('No saved Evidence Desk draft found.');
      applyInput(saved.data.input);
      var receipt = saved.data.receipt;
      if (receipt) {
        var integrity = await Core.verify(receipt);
        var rebound = await Core.seal(saved.data.input, { now: receipt.generated });
        if (integrity.ok && rebound.integrity.digest === receipt.integrity.digest) {
          current = receipt;
          currentDirty = false;
          render();
          return setStatus('Saved draft and matching sealed receipt resumed.', 'ok');
        }
        current = null;
        render();
        return setStatus('Draft resumed, but its receipt did not match the saved inputs · rebuild required.', 'error');
      }
      current = null;
      render();
      setStatus('Saved draft resumed · build to create a sealed receipt.');
    } catch (error) { setStatus('Draft resume failed: ' + error.message, 'error'); }
  }
  async function exportReceipt(kind) {
    var receipt = await ensureCurrent();
    if (!receipt) return;
    if (!gate(kind === 'json' ? 'receipt.export' : 'report.export', { effect: 'file-write', digest: receipt.integrity.digest })) return;
    var stem = safeStem(receipt.title);
    if (kind === 'json') download(stem + '.evidence-receipt.json', JSON.stringify(receipt, null, 2) + '\n', 'application/json');
    else download(stem + '.action-report.txt', Core.report(receipt) + '\n', 'text/plain');
    setStatus((kind === 'json' ? 'Structured receipt' : 'Action Report') + ' exported by explicit user action.', 'ok');
  }
  async function previewKnowledge() {
    var receipt = await ensureCurrent();
    if (!receipt || !gate('knowledge-handoff.preview', { effect: 'read-only', receiptDigest: receipt.integrity.digest })) return;
    try {
      handoffPreview = await Core.knowledgePacket(receipt);
      lastHandoff = Core.handoffReceipt(handoffPreview, 'PREVIEWED', { proof: { inboxWrite: false } });
      $('placeKnowledge').disabled = false;
      currentTab = 'handoff';
      render();
      setStatus('Handoff preview ready · no inbox write occurred; receiver acceptance is PENDING.');
    } catch (error) { setStatus('Handoff preview failed: ' + error.message, 'error'); }
  }
  async function placeKnowledge() {
    if (!handoffPreview) return setStatus('Preview the handoff before placing it.', 'error');
    if (!gate('knowledge-handoff.place', { effect: 'local-write', packetDigest: handoffPreview.digest })) return;
    try {
      var packetCheck = await Core.verifyKnowledgePacket(handoffPreview);
      if (!packetCheck.ok) throw new Error('preview packet integrity mismatch');
      var existingText = localStorage.getItem(INBOX_KEY);
      if (existingText) {
        var existing;
        try { existing = JSON.parse(existingText); } catch (parseError) { existing = null; }
        if (!existing || existing.digest !== handoffPreview.digest) {
          lastHandoff = Core.handoffReceipt(handoffPreview, 'HELD_EXISTING_INBOX', { proof: { inboxWrite: false, existingPacketPreserved: true } });
          currentTab = 'handoff';
          render();
          return setStatus('Handoff held · Knowledge Canvas already has another unread inbox packet. It was preserved.', 'error');
        }
      } else {
        localStorage.setItem(INBOX_KEY, JSON.stringify(handoffPreview));
      }
      var stored = JSON.parse(localStorage.getItem(INBOX_KEY) || 'null');
      var storedCheck = await Core.verifyKnowledgePacket(stored);
      if (!storedCheck.ok || stored.digest !== handoffPreview.digest) throw new Error('inbox readback did not match the previewed packet');
      lastHandoff = Core.handoffReceipt(handoffPreview, 'INBOX_WRITTEN', {
        proof: { method: existingText ? 'identical-packet-readback' : 'same-origin-local-storage-readback', key: INBOX_KEY, exactDigestMatch: true }
      });
      currentTab = 'handoff';
      render();
      setStatus('Knowledge Canvas inbox write verified · receiver acceptance remains PENDING.', 'ok');
    } catch (error) { setStatus('Knowledge inbox placement failed: ' + error.message, 'error'); }
  }
  function bind() {
    $('addClaim').addEventListener('click', function () { addClaim(); markDirty(); });
    $('build').addEventListener('click', buildReceipt);
    $('validate').addEventListener('click', validateOnly);
    $('example').addEventListener('click', loadExample);
    $('save').addEventListener('click', saveDraft);
    $('resume').addEventListener('click', resumeDraft);
    $('exportTxt').addEventListener('click', function () { exportReceipt('text'); });
    $('exportJson').addEventListener('click', function () { exportReceipt('json'); });
    $('previewKnowledge').addEventListener('click', previewKnowledge);
    $('placeKnowledge').addEventListener('click', placeKnowledge);
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (button) {
      button.addEventListener('click', function () { currentTab = button.dataset.tab; render(); });
    });
    $('composer').addEventListener('input', markDirty);
    $('composer').addEventListener('change', markDirty);
  }
  async function init() {
    if (!Core) return setStatus('Missing evidence-core.js', 'error');
    bind();
    addClaim();
    render();
    try {
      await AXM.init({ id: 'evidence-desk', name: 'AXM Evidence Desk', version: 'v0.2' });
      AXM.wisdom.on(localStorage.getItem('axm.identity.growth.enabled') !== 'false');
      AXMHub.ready({
        id: 'evidence-desk', name: 'AXM Evidence Desk', version: 'v0.2', hubApiVersion: '1.0', permissions: [], savesState: true,
        capabilities: ['typed-claim-routing', 'sha256-sealed-receipts', 'receipt-integrity-check', 'explicit-knowledge-handoff-preview']
      });
      AXMHub.log('Evidence Desk ready · records supplied evidence and preserves UNKNOWN');
      setStatus('Ready · build records; it does not independently verify the world.');
    } catch (error) { setStatus('Startup failed: ' + error.message, 'error'); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
