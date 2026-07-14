(function () {
  'use strict';

  var Core = window.AXMUIUXCore;
  var STORE = 'axm.uiux-builder.v1';
  var stepOrder = ['human', 'journey', 'look', 'preview', 'handoff'];
  var principles = {
    clarity: ['Clarity', 'The next choice is obvious.'],
    control: ['Control', 'Pause, back, cancel, and stop stay visible.'],
    feedback: ['Feedback', 'Every action answers back.'],
    forgiveness: ['Forgiveness', 'Mistakes can be undone or recovered.'],
    accessibility: ['Accessibility', 'Readable, reachable, and keyboard-friendly.'],
    speed: ['Speed', 'The common job stays quick.']
  };
  var presetLabels = {
    'calm-night': ['Calm night', 'Focused and trustworthy'],
    'warm-workshop': ['Warm workshop', 'Creative and grounded'],
    'clear-day': ['Clear day', 'Bright and straightforward'],
    'soft-violet': ['Soft violet', 'Imaginative and calm']
  };
  var workspace = loadWorkspace();
  var currentStep = 'human';
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function loadWorkspace() {
    try { var saved = JSON.parse(localStorage.getItem(STORE) || 'null'); return saved ? Core.normalize(saved) : Core.baseWorkspace(); }
    catch (error) { return Core.baseWorkspace(); }
  }
  function persist(message) {
    workspace.updatedAt = Core.now();
    localStorage.setItem(STORE, JSON.stringify(workspace));
    $('saveState').textContent = 'Saved locally · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (window.AXMHub) AXMHub.save({ workspace: workspace });
    if (message) toast(message);
  }
  function toast(message) {
    $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.remove('show'); }, 2400);
  }
  function download(name, value) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1200);
  }
  function setStep(step) {
    if (stepOrder.indexOf(step) < 0) return;
    currentStep = step;
    document.querySelectorAll('.step').forEach(function (button) {
      var active = button.dataset.step === step; button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.step-view').forEach(function (view) { var active = view.dataset.view === step; view.hidden = !active; view.classList.toggle('active', active); });
    if (step === 'preview' || step === 'handoff') renderAnalysis();
    document.querySelector('.main-panel').scrollTop = 0;
  }

  function bindFields() {
    ['projectName', 'target', 'audience', 'primaryJob', 'frustration', 'humanNote'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        var key = { projectName: 'name', humanNote: 'humanNote' }[id] || id;
        workspace[key] = this.value; workspace.humanVerdict = id === 'humanNote' ? workspace.humanVerdict : 'pending'; persist(); renderHeader(); renderStatuses();
      });
    });
    ['accent', 'background', 'surface', 'text', 'muted'].forEach(function (id) {
      $(id).addEventListener('input', function () { workspace.theme[id] = this.value; workspace.preset = 'custom'; workspace.humanVerdict = 'pending'; persist(); renderLook(); renderAnalysis(); });
    });
    $('radius').addEventListener('input', function () { workspace.theme.radius = Number(this.value); workspace.preset = 'custom'; workspace.humanVerdict = 'pending'; persist(); renderLook(); renderAnalysis(); });
    $('textScale').addEventListener('input', function () { workspace.theme.textScale = Number(this.value); workspace.preset = 'custom'; workspace.humanVerdict = 'pending'; persist(); renderLook(); renderAnalysis(); });
    ['density', 'navigation'].forEach(function (id) { $(id).addEventListener('change', function () { workspace.theme[id] = this.value; workspace.preset = 'custom'; workspace.humanVerdict = 'pending'; persist(); renderLook(); renderAnalysis(); }); });
  }

  function renderHeader() {
    $('projectRailName').textContent = workspace.name || 'Untitled experience';
    $('projectRailTarget').textContent = workspace.target || 'Choose a target';
    $('projectName').value = workspace.name; $('target').value = workspace.target; $('audience').value = workspace.audience;
    $('primaryJob').value = workspace.primaryJob; $('frustration').value = workspace.frustration; $('humanNote').value = workspace.humanNote;
  }
  function renderPrinciples() {
    var box = $('principles'); box.innerHTML = '';
    Object.keys(principles).forEach(function (key) {
      var label = document.createElement('label'); label.className = 'principle';
      label.innerHTML = '<input type="checkbox"><span><strong></strong><small></small></span>';
      label.querySelector('input').checked = !!workspace.principles[key];
      label.querySelector('strong').textContent = principles[key][0]; label.querySelector('small').textContent = principles[key][1];
      label.querySelector('input').onchange = function () { workspace.principles[key] = this.checked; workspace.humanVerdict = 'pending'; persist(); renderStatuses(); };
      box.appendChild(label);
    });
  }
  function renderFlow() {
    var box = $('flowList'); box.innerHTML = '';
    workspace.flow.forEach(function (step, index) {
      var row = document.createElement('div'); row.className = 'flow-item';
      row.innerHTML = '<div class="flow-number"></div><input aria-label="Journey step"><div class="flow-actions"><button type="button" aria-label="Move step up">↑</button><button type="button" aria-label="Move step down">↓</button><button type="button" aria-label="Delete step">×</button></div>';
      row.querySelector('.flow-number').textContent = index + 1;
      var input = row.querySelector('input'); input.value = step; input.oninput = function () { workspace.flow[index] = Core.clean(this.value, 100); workspace.humanVerdict = 'pending'; persist(); renderStatuses(); };
      var buttons = row.querySelectorAll('button');
      buttons[0].disabled = index === 0; buttons[1].disabled = index === workspace.flow.length - 1;
      buttons[0].onclick = function () { var item = workspace.flow.splice(index, 1)[0]; workspace.flow.splice(index - 1, 0, item); workspace.humanVerdict = 'pending'; persist(); renderFlow(); };
      buttons[1].onclick = function () { var item = workspace.flow.splice(index, 1)[0]; workspace.flow.splice(index + 1, 0, item); workspace.humanVerdict = 'pending'; persist(); renderFlow(); };
      buttons[2].onclick = function () { if (workspace.flow.length <= 1) return toast('Keep at least one journey step.'); workspace.flow.splice(index, 1); workspace.humanVerdict = 'pending'; persist(); renderFlow(); };
      box.appendChild(row);
    });
    $('flowCount').textContent = workspace.flow.length + ' step' + (workspace.flow.length === 1 ? '' : 's');
  }
  function renderPresets() {
    var box = $('presetGrid'); box.innerHTML = '';
    Object.keys(Core.PRESETS).forEach(function (name) {
      var p = Core.PRESETS[name], b = document.createElement('button'); b.type = 'button'; b.className = 'preset' + (workspace.preset === name ? ' active' : '');
      b.innerHTML = '<div class="preset-swatch"><i></i></div><strong></strong><small></small>';
      b.querySelector('.preset-swatch').style.background = p.surface; b.querySelector('.preset-swatch').style.border = '1px solid ' + p.muted;
      b.querySelector('i').style.background = p.accent; b.querySelector('strong').textContent = presetLabels[name][0]; b.querySelector('small').textContent = presetLabels[name][1];
      b.onclick = function () { workspace = Core.applyPreset(workspace, name); workspace.humanVerdict = 'pending'; persist('Visual starting point changed.'); renderAll(); };
      box.appendChild(b);
    });
  }
  function renderLook() {
    ['accent', 'background', 'surface', 'text', 'muted'].forEach(function (id) { $(id).value = workspace.theme[id]; });
    $('radius').value = workspace.theme.radius; $('radiusValue').textContent = workspace.theme.radius + 'px';
    $('textScale').value = workspace.theme.textScale; $('textScaleValue').textContent = workspace.theme.textScale + '%';
    $('density').value = workspace.theme.density; $('navigation').value = workspace.theme.navigation;
    $('presetStatus').textContent = workspace.preset === 'custom' ? 'Custom direction' : presetLabels[workspace.preset][0];
  }
  function previewHtml() {
    var cards = [
      ['Create', 'Design, draw, and prepare ideas.', 'Open creative workspace →'],
      ['Build', 'Turn plans into tested working parts.', 'Open building workspace →'],
      ['Play', 'Launch games and shared experiences.', 'Open game space →'],
      ['AI Team', 'Work with identities and local models.', 'Open collaboration space →']
    ];
    return '<div class="mock-top"><div class="mock-logo">AXM</div><span class="mock-brand">AXM Hub</span><span class="mock-presence">● ' + esc(workspace.audience || 'human collaborator') + '</span><button class="mock-stop">Pause AI</button></div>' +
      '<div class="mock-body"><nav class="mock-nav"><strong>Home</strong><span class="selected">Choose a workspace</span>' + workspace.flow.slice(0, 5).map(function (step) { return '<span>' + esc(step) + '</span>'; }).join('') + '</nav>' +
      '<main class="mock-main"><div class="mock-kicker">Local operating space</div><h2>What do you want to do?</h2><p>' + esc(workspace.primaryJob || 'Choose a workspace. The system details stay available without getting in your way.') + '</p><div class="mock-cards">' +
      cards.map(function (card) { return '<article class="mock-card"><b>' + card[0] + '</b><p>' + card[1] + '</p><span>' + card[2] + '</span></article>'; }).join('') + '</div></main></div>';
  }
  function renderPreview() {
    var preview = $('productPreview'), t = workspace.theme;
    preview.className = 'product-preview ' + workspace.device; preview.dataset.nav = t.navigation; preview.innerHTML = previewHtml();
    preview.style.setProperty('--preview-accent', t.accent); preview.style.setProperty('--preview-background', t.background); preview.style.setProperty('--preview-surface', t.surface);
    preview.style.setProperty('--preview-text', t.text); preview.style.setProperty('--preview-muted', t.muted); preview.style.setProperty('--preview-radius', t.radius + 'px');
    preview.style.setProperty('--preview-scale', t.textScale / 100); preview.style.setProperty('--preview-pad', { compact: '9px', comfortable: '13px', spacious: '18px' }[t.density]);
    document.querySelectorAll('[data-device]').forEach(function (button) { button.classList.toggle('active', button.dataset.device === workspace.device); });
  }
  function renderAudit() {
    var report = Core.audit(workspace), box = $('auditList'); box.innerHTML = '';
    $('auditScore').textContent = report.passed + '/' + report.checks.length;
    $('auditTitle').textContent = report.gatePassed ? (report.warnings ? 'Safe, with suggestions' : 'Human gates pass') : report.failed + ' important fix' + (report.failed === 1 ? '' : 'es');
    report.checks.forEach(function (item) {
      var row = document.createElement('div'); var kind = item.ok ? 'pass' : item.severity === 'warn' ? 'warn' : 'fail'; row.className = 'audit-item ' + kind;
      row.innerHTML = '<span class="audit-mark"></span><div><strong></strong><small></small></div>'; row.querySelector('.audit-mark').textContent = item.ok ? '✓' : item.severity === 'warn' ? '!' : '×';
      row.querySelector('strong').textContent = item.label; row.querySelector('small').textContent = item.ok ? 'Looks good.' : item.message; box.appendChild(row);
    });
    return report;
  }
  function renderHandoff() {
    var p = Core.proposal(workspace), report = p.audit;
    $('proposalState').textContent = p.status; $('proposalState').style.color = report.reviewReady ? 'var(--green)' : 'var(--gold)';
    $('verdictYes').classList.toggle('selected', workspace.humanVerdict === 'yes'); $('verdictNo').classList.toggle('selected', workspace.humanVerdict === 'not-yet');
    $('summaryName').textContent = workspace.name;
    $('summaryFacts').innerHTML = '<dt>Target</dt><dd>' + esc(workspace.target) + '</dd><dt>Person</dt><dd>' + esc(workspace.audience || 'Not described yet') + '</dd><dt>Journey</dt><dd>' + workspace.flow.length + ' steps</dd><dt>Visual</dt><dd>' + esc(workspace.preset === 'custom' ? 'Custom direction' : presetLabels[workspace.preset][0]) + '</dd><dt>Checks</dt><dd>' + report.passed + '/' + report.checks.length + ' pass</dd><dt>Human verdict</dt><dd>' + esc(workspace.humanVerdict === 'yes' ? 'Ready for review' : workspace.humanVerdict === 'not-yet' ? 'Needs another pass' : 'Still needed') + '</dd>';
    var gate = $('handoffGate'); gate.className = 'handoff-gate ' + (report.reviewReady ? 'ready' : 'blocked');
    gate.textContent = report.reviewReady ? '✓ Review-ready proposal. It still changes nothing until builders inspect and apply it.' : report.failed ? 'Blocked by ' + report.failed + ' important human check' + (report.failed === 1 ? '' : 's') + '.' : 'Checks pass. Waiting for your human verdict.';
    var variables = Core.cssVariables(workspace); $('tokenOutput').textContent = ':root {\n' + Object.keys(variables).map(function (key) { return '  ' + key + ': ' + variables[key] + ';'; }).join('\n') + '\n}';
    $('exportProposal').disabled = !report.reviewReady;
  }
  function renderStatuses() {
    var report = Core.audit(workspace);
    $('humanStatus').textContent = workspace.audience.length >= 12 && workspace.primaryJob.length >= 20 ? 'Brief captured' : 'Needs a brief';
    if (currentStep === 'preview' || currentStep === 'handoff') renderAnalysis();
    return report;
  }
  function renderAnalysis() { renderPreview(); renderAudit(); renderHandoff(); }
  function renderAll() { renderHeader(); renderPrinciples(); renderFlow(); renderPresets(); renderLook(); renderStatuses(); renderAnalysis(); }

  document.querySelectorAll('.step').forEach(function (button) { button.onclick = function () { setStep(this.dataset.step); }; });
  document.querySelectorAll('[data-next]').forEach(function (button) { button.onclick = function () { setStep(this.dataset.next); }; });
  document.querySelectorAll('[data-device]').forEach(function (button) { button.onclick = function () { workspace.device = this.dataset.device; persist(); renderPreview(); }; });
  $('addFlowForm').onsubmit = function (event) {
    event.preventDefault(); var value = Core.clean($('newFlowStep').value, 100); if (!value) return;
    if (workspace.flow.length >= Core.MAX_FLOW) return toast('Seven steps is the limit—combine steps before adding more.');
    workspace.flow.push(value); workspace.humanVerdict = 'pending'; $('newFlowStep').value = ''; persist('Journey step added.'); renderFlow(); renderStatuses();
  };
  $('hubStarter').onclick = function () { if (!confirm('Replace this workspace with the AXM Hub human-first starter?')) return; workspace = Core.hubStarter(); persist('Hub starter loaded.'); renderAll(); setStep('human'); };
  $('exportWorkspace').onclick = function () { download('axm-uiux-workspace.json', workspace); toast('Workspace exported.'); if (window.AXMHub) AXMHub.log('UI/UX Builder exported workspace'); };
  $('importButton').onclick = function () { $('importFile').click(); };
  $('importFile').onchange = function () { var file = this.files && this.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var next = Core.normalize(JSON.parse(reader.result)); if (!confirm('Replace the current local workspace with "' + next.name + '"?')) return; workspace = next; persist('Workspace imported.'); renderAll(); setStep('human'); } catch (error) { alert('Import refused: ' + error.message); } }; reader.readAsText(file); this.value = ''; };
  $('verdictYes').onclick = function () { workspace.humanVerdict = 'yes'; persist('Human verdict recorded.'); renderHandoff(); };
  $('verdictNo').onclick = function () { workspace.humanVerdict = 'not-yet'; persist('Marked for another design pass.'); renderHandoff(); };
  $('copyTokens').onclick = async function () { try { await navigator.clipboard.writeText($('tokenOutput').textContent); toast('Tokens copied.'); } catch (error) { toast('Clipboard unavailable. Select the token text manually.'); } };
  $('exportProposal').onclick = function () { var proposal = Core.proposal(workspace); if (!proposal.audit.reviewReady) return toast('Finish the human checks and verdict first.'); download('axm-uiux-review-proposal.json', proposal); toast('Review proposal exported.'); if (window.AXMHub) AXMHub.log('UI/UX Builder exported REVIEW READY proposal for ' + workspace.target); };
  $('resetWorkspace').onclick = function () { if (!confirm('Start over? The current workspace remains available only if you exported it.')) return; workspace = Core.baseWorkspace(); persist('New workspace started.'); renderAll(); setStep('human'); };

  bindFields(); renderAll(); setStep('human');
  if (!localStorage.getItem(STORE)) persist();
  if (window.AXMHub) {
    AXMHub.onInit(function () { AXMHub.log('UI/UX Builder ready · human-first, proposal-only'); });
    AXMHub.onShutdown(function () { persist(); });
    AXMHub.ready({ id: 'ui-ux-builder', name: 'AXM UI/UX Builder', version: 'v0.1', hubApiVersion: '1.0', permissions: [], savesState: true, handlesShutdown: true });
  }
}());
