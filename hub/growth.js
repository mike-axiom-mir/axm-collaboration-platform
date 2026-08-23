(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, data = null, observatoryData = null, activeYear = '', activeMonth = '', activeOpportunityFilter = 'ALL', activeView = 'growth', observatoryPoll = null, mirrorPoll = null, scopePoll = null;
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function bytes(n) { n = Number(n || 0); if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'; return (n / 1073741824).toFixed(2) + ' GB'; }
  function delta(n) { n = Number(n || 0); return (n > 0 ? '+' : '') + fmt(n); }
  function metric(value, label, note) { return '<article class="growth-metric"><b>' + (typeof value === 'string' ? value : fmt(value)) + '</b><span>' + label + '</span><small>' + note + '</small></article>'; }
  function orbit(value, label) { return '<div class="growth-orbit"><div><b>' + fmt(value) + '</b><span>' + label + '</span></div></div>'; }
  function component(value, label, note) { return '<div class="growth-component"><b>' + fmt(value) + '</b><span>' + label + '</span><small>' + note + '</small></div>'; }
  function capability(value, label, note, tone) { return '<article class="growth-capability ' + tone + '"><span>' + label + '</span><b>' + fmt(value) + '</b><small>' + note + '</small></article>'; }
  function deltaRow(label, value, note) { var unavailable = value == null; return '<div class="growth-delta"><span>' + label + (note ? '<small>' + note + '</small>' : '') + '</span><b class="' + (unavailable || Number(value) === 0 ? 'zero' : '') + '">' + (unavailable ? '—' : delta(value)) + '</b></div>'; }
  function percent(value, total) { return total ? Math.round(Number(value || 0) / Number(total) * 100) : 0; }
  function coverage(value, total, label, note, tone) { return '<article class="growth-coverage ' + (tone || '') + '"><div><b>' + fmt(value) + '</b><span>' + (total == null ? '' : ' / ' + fmt(total)) + '</span></div><strong>' + label + '</strong><small>' + note + (total == null ? '' : ' · ' + percent(value, total) + '% coverage') + '</small></article>'; }

  function attr(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function jsonResponse(response, label) {
    return response.text().then(function (body) {
      var contentType = String(response.headers.get('content-type') || '').toLowerCase(), parsed;
      if (contentType.indexOf('application/json') === -1) {
        throw Error(label + ' API returned a webpage instead of data. Restart the Workshop server, then refresh this view.');
      }
      try { parsed = JSON.parse(body); } catch (error) { throw Error(label + ' API returned invalid JSON. Restart the Workshop server.'); }
      if (!response.ok || !parsed.ok) throw Error(parsed.error || label + ' unavailable');
      return parsed;
    });
  }
  function yearKey(value) { var date = new Date(value); return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear()); }
  function monthKey(value) { var date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'); }
  function monthLabel(key) { var parts = String(key || '').split('-'), date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1); return Number.isNaN(date.getTime()) ? 'Unknown month' : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
  function renderYearPicker(history) {
    var years = Array.from(new Set(history.map(function (snapshot) { return yearKey(snapshot.capturedAt); }).filter(Boolean))).sort();
    if (!years.length) { activeYear = ''; $('growthYear').replaceChildren(); $('growthYear').disabled = true; return []; }
    if (!activeYear || years.indexOf(activeYear) === -1) activeYear = years[years.length - 1];
    var select = $('growthYear'), fragment = document.createDocumentFragment();
    years.forEach(function (key) { var option = document.createElement('option'); option.value = key; option.textContent = key; option.selected = key === activeYear; fragment.appendChild(option); });
    select.replaceChildren(fragment); select.disabled = false;
    return history.filter(function (snapshot) { return yearKey(snapshot.capturedAt) === activeYear; });
  }
  function renderMonthPicker(history) {
    var months = Array.from(new Set(history.map(function (snapshot) { return monthKey(snapshot.capturedAt); }).filter(Boolean))).sort();
    if (!months.length) { activeMonth = ''; $('growthMonth').replaceChildren(); $('growthMonth').disabled = true; return []; }
    if (!activeMonth || (activeMonth !== 'all' && months.indexOf(activeMonth) === -1)) activeMonth = months[months.length - 1];
    var select = $('growthMonth'), fragment = document.createDocumentFragment(), all = document.createElement('option');
    all.value = 'all'; all.textContent = 'All months'; all.selected = activeMonth === 'all'; fragment.appendChild(all);
    months.forEach(function (key) { var option = document.createElement('option'); option.value = key; option.textContent = monthLabel(key); option.selected = key === activeMonth; fragment.appendChild(option); });
    select.replaceChildren(fragment); select.disabled = false;
    return activeMonth === 'all' ? history : history.filter(function (snapshot) { return monthKey(snapshot.capturedAt) === activeMonth; });
  }

  function renderMirror() {
    var mirror = data.current && data.current.mirror, parent = $('growthMirrorParent'), specialists = $('growthMirrorSpecializations'), deltas = $('growthMirrorDeltas');
    if (!mirror || mirror.available !== true) {
      var refreshing = data.mirrorMeasurement && data.mirrorMeasurement.inFlight, reason = mirror && mirror.reason || 'The configured local Mirror body is not available.';
      parent.innerHTML = '<div class="growth-mirror-unavailable"><b>' + (refreshing ? 'Workshop growth is ready; Mirror is measuring separately.' : 'Mirror measurement is unavailable.') + '</b><span>' + attr(reason) + '</span></div>';
      specialists.innerHTML = '<div class="growth-empty">No local Mirror specializations to show.</div>';
      deltas.innerHTML = '<div class="growth-empty">' + (refreshing ? 'This card will update when the separate Mirror scan finishes.' : 'Mirror history begins when the body is available.') + '</div>';
      return;
    }
    parent.innerHTML = '<article class="growth-mirror-parent"><div class="growth-mirror-identity"><div class="growth-mirror-sigil" aria-hidden="true">M</div><div><span>PARENT BODY · ORIGINAL FIRST</span><h4>Original Mirror</h4><p>' + fmt(mirror.totalFiles) + ' installed files · ' + bytes(mirror.bytes) + ' total local footprint</p></div><b class="growth-mirror-status">FILESYSTEM MEASURED</b></div><div class="growth-mirror-measures"><div><span>Owned body / source</span><b>' + bytes(mirror.bodyBytes) + '</b><small>' + fmt(mirror.characters) + ' characters · ' + fmt(mirror.lines) + ' lines</small></div><div><span>Living state</span><b>' + bytes(mirror.stateBytes) + '</b><small>' + fmt(mirror.stateFiles) + ' files</small></div><div><span>Installed substrates</span><b>' + bytes(mirror.substrateBytes) + '</b><small>Blender, Python, media and validation runtimes</small></div><div><span>Repository history</span><b>' + bytes(mirror.historyBytes) + '</b><small>Git continuity, not active source</small></div><div><span>Outputs + logs</span><b>' + bytes(Number(mirror.outputBytes || 0) + Number(mirror.logBytes || 0)) + '</b><small>kept separate from body growth</small></div></div><div class="growth-mirror-anatomy"><div><b>' + fmt(mirror.organs) + '</b><span>organ source files</span></div><div><b>' + fmt(mirror.tests) + '</b><span>test files</span></div><div><b>' + fmt(mirror.contracts) + '</b><span>contract JSON files</span></div><div><b>' + fmt(mirror.trainingFiles) + '</b><span>training files</span></div><div><b>' + fmt(mirror.modules) + '</b><span>module directories</span></div><small>Inventory only · not a capability or intelligence score</small></div></article>';
    var rows = Array.isArray(mirror.specializations) ? mirror.specializations : [];
    specialists.innerHTML = rows.length ? rows.map(function (row) {
      return '<article class="growth-mirror-specialist"><div><span>' + attr(row.kind === 'identity-branch' ? 'IDENTITY BRANCH' : 'SPECIALIST BODY') + '</span><h5>' + attr(row.displayName) + '</h5></div><b class="growth-mirror-specialist-status">' + attr(row.status) + '</b><p>' + bytes(row.bytes) + ' · ' + fmt(row.files) + ' footprint files</p><small>' + (row.sharedParentCode === false ? 'separate code body' : 'shares Original Mirror code · footprint only') + (row.activeRuntime ? ' · runtime declared active in lineage · not live-measured' : ' · no active runtime declared') + '</small></article>';
    }).join('') : '<div class="growth-empty">No declared Mirror specializations yet.</div>';
    var md = data.mirrorDeltaFromPrevious, change = data.mirrorSpecializationChanges || {}, ready = data.mirrorDeltaReady === true && md;
    deltas.innerHTML = ready ? deltaRow('Installed footprint', md.bytes, 'body + state + substrates + history') + deltaRow('Owned body / source', md.bodyBytes) + deltaRow('Living state', md.stateBytes) + deltaRow('Installed substrates', md.substrateBytes) + deltaRow('Repository history', md.historyBytes) + deltaRow('Specializations', md.specializationCount) + deltaRow('Specialists added', change.ready ? (change.added || []).length : null) + deltaRow('Specialists updated', change.ready ? (change.updated || []).length : null) : '<div class="growth-empty">Mirror baseline begins with the next saved snapshot.</div>';
  }

  function renderScopeTransitions() {
    var status = data.scopeTransitions || {}, rows = Array.isArray(status.transitions) ? status.transitions : [], row = rows[rows.length - 1], target = $('growthReconciliation');
    target.className = 'growth-reconciliation ' + String(status.state || 'BROKEN').toLowerCase();
    if (!row) {
      target.innerHTML = '<div class="growth-reconciliation-head"><div><span>BROKEN · RECEIPT REQUIRED</span><h3 id="growthReconciliationTitle">Scope transition proof is missing</h3></div></div><p>The Growth page will not call a counting-scope change verified until its old snapshot, new baseline, archive manifest, and full archive audit are bound together.</p>';
      return;
    }
    var archive = row.archive || {}, audit = row.audit || {}, runner = status.auditRunner || {}, old = row.previousSnapshot || {}, baseline = row.comparableBaseline || {}, recovery = row.recovery || {}, recovered = recovery.recoveredBaseline || {}, errors = row.errors || [], items = archive.items || [], receiptLink = row.receiptPath ? '<a href="/' + attr(row.receiptPath) + '" target="_blank" rel="noopener">Open recovery receipt</a>' : '';
    var auditNote = status.state === 'VERIFYING' ? 'Current server archive rehash started ' + (runner.startedAt ? new Date(runner.startedAt).toLocaleString() : 'now') + '; the prior receipt is not accepted yet.' : (audit.verifiedAt ? 'Full archive inventory rehashed ' + new Date(audit.verifiedAt).toLocaleString() + (runner.durationMs != null ? ' in ' + Math.round(Number(runner.durationMs) / 1000) + ' seconds.' : '.') : 'No current full archive audit receipt.');
    var itemRows = items.map(function (item) { return '<li><b>' + attr(item.name) + '</b><span>' + fmt(item.fileCount) + ' files · ' + bytes(item.byteCount) + ' · ' + attr(item.admittedTarget || 'held safely; not admitted') + '</span></li>'; }).join('');
    target.innerHTML = '<div class="growth-reconciliation-head"><div><span>' + attr(row.state) + ' · PERMANENT SCOPE-TRANSITION RECEIPT</span><h3 id="growthReconciliationTitle">' + attr(row.title) + '</h3></div><b class="growth-reconciliation-state">' + attr(row.state) + '</b></div><p>' + attr(row.reason) + '</p><div class="growth-reconciliation-grid"><article><span>Last rules-v0 snapshot</span><b>' + fmt(old.totalFiles) + ' files</b><small>' + fmt(old.exactCapabilities) + ' exact capabilities · retained as ' + attr(old.id) + '</small></article><article><span>First comparable rules-v2 baseline</span><b>' + fmt(baseline.totalFiles) + ' files</b><small>' + fmt(baseline.exactCapabilities) + ' exact capabilities · retained as ' + attr(baseline.id) + '</small></article><article><span>Recoverable intake archive</span><b>' + fmt(archive.fileCount) + ' files</b><small>' + bytes(archive.byteCount) + ' · ' + fmt(archive.itemCount) + ' reviewed roots · no deletion</small></article><article><span>Recovered Workshop capability inventory</span><b>' + fmt(recovered.exactCapabilities || baseline.exactCapabilities) + ' exact</b><small>' + fmt(recovered.capabilityDeclarations || baseline.capabilityDeclarations) + ' provider declarations · continuity gate protected</small></article></div><div class="growth-reconciliation-proof"><b>Manifest SHA-256</b><code>' + attr(archive.manifestSha256 || 'missing') + '</code><span>' + attr(auditNote) + '</span>' + receiptLink + '</div><p class="growth-reconciliation-boundary"><b>Why the numbers do not add up directly:</b> ' + attr(row.truth && row.truth.arithmeticBalanceReason || 'The snapshots use different counting scopes; archive carrier totals are evidence of preservation, not a growth delta.') + '</p>' + (errors.length ? '<div class="growth-reconciliation-errors"><b>Verification blockers</b><span>' + errors.map(attr).join(' · ') + '</span></div>' : '') + '<details><summary>Show all archived roots and admitted destinations</summary><ul>' + itemRows + '</ul></details>';
  }

  function renderMilestones(rows) {
    rows = Array.isArray(rows) ? rows.slice().reverse() : [];
    $('growthMilestones').innerHTML = rows.length ? rows.slice(0, 20).map(function (row) {
      var evidence = row.evidence || {}, truth = row.truth || {};
      return '<article class="growth-milestone"><div><span>' + new Date(row.recordedAt).toLocaleString() + '</span><h4>' + attr(row.label) + '</h4>' + (row.note ? '<p>' + attr(row.note) + '</p>' : '') + '</div><div class="growth-milestone-evidence"><b>' + fmt(evidence.tools) + ' tools</b><b>' + fmt(evidence.validContracts) + ' valid contracts</b><b>' + fmt(evidence.connectedCapabilities) + ' connected seams</b><small>' + (truth.automaticallyProven === false ? 'human-recorded · not automatically proven' : 'legacy truth boundary unavailable') + '</small></div></article>';
    }).join('') : '<div class="growth-empty">No explicit milestones recorded yet. Ordinary snapshots remain in the timeline above.</div>';
  }

  function renderOpportunities(rows) {
    rows = Array.isArray(rows) ? rows : [];
    var visible = activeOpportunityFilter === 'ALL' ? rows : rows.filter(function (row) { return row.severity === activeOpportunityFilter; });
    $('growthOpportunities').innerHTML = visible.length ? visible.map(function (row) {
      var samplesText = row.sampleIds && row.sampleIds.length ? '<small class="growth-opportunity-samples">Examples: ' + row.sampleIds.map(attr).join(', ') + '</small>' : '';
      return '<article class="growth-opportunity ' + attr(String(row.severity || '').toLowerCase()) + '"><div class="growth-opportunity-title"><span>' + attr(row.severity) + ' · ' + attr(row.category) + '</span><b>' + fmt(row.count) + ' ' + attr(row.unit) + '</b></div><h4>' + attr(row.title) + '</h4><p>' + attr(row.detail) + '</p><strong>Next: ' + attr(row.action) + '</strong>' + samplesText + '<small class="growth-opportunity-evidence">Evidence: ' + attr(row.evidence) + '</small></article>';
    }).join('') : '<div class="growth-empty">No ' + attr(activeOpportunityFilter === 'ALL' ? '' : activeOpportunityFilter.toLowerCase() + ' ') + 'signals in the current measurement.</div>';
  }

  function renderOpportunitySummary(rows, source, freshness, measuredAt, runner) {
    rows = Array.isArray(rows) ? rows : [];
    var bySeverity = { BLOCKING:0, ATTENTION:0, OPPORTUNITY:0, CONTEXT:0 };
    rows.forEach(function (row) { if (Object.prototype.hasOwnProperty.call(bySeverity, row.severity)) bySeverity[row.severity]++; });
    var stale = freshness && freshness.stale === true, sourceLabel = source && source.label || 'unknown local body';
    var measured = measuredAt ? new Date(measuredAt).toLocaleString() : 'not measured';
    var refreshState = runner && runner.inFlight ? ' · refresh running' : '';
    $('growthOpportunitySummary').classList.toggle('stale', stale);
    $('growthOpportunitySummary').innerHTML = '<strong>' + fmt(rows.length) + ' signal types</strong><span>' + fmt(bySeverity.BLOCKING) + ' blocking · ' + fmt(bySeverity.ATTENTION) + ' attention · ' + fmt(bySeverity.OPPORTUNITY) + ' optional · ' + fmt(bySeverity.CONTEXT) + ' context</span><small>' + (stale ? 'STALE SNAPSHOT · do not treat these counts as current' : 'CURRENT SNAPSHOT') + ' · body ' + attr(sourceLabel) + ' · measured ' + attr(measured) + attr(refreshState) + '</small>';
  }

  function renderObservatory() {
    var response = observatoryData || {}, o = response.observatory, freshness = response.freshness || {};
    renderMilestones(response.milestones || []);
    $('growthDefinitions').innerHTML = '<p><b>Scale</b> counts active source while excluding state, logs, exports, backups, dependencies and caches. <b>Lifecycle</b> is the status declared in each live tool manifest; TEST, WORKING and CANON are not converted into a pass count. <b>Structural coverage</b> checks present and valid contracts, top-level selftests and current verification receipts. <b>Capability seams</b> compare exact contract identifiers only; no semantic compatibility is guessed. <b>Improvement signals</b> are deterministic navigation cues, not a score or an automatic work queue. <b>Milestones</b> are explicit human records with a compact evidence attachment; they do not automatically prove success or promote anything.</p>';
    if (!o) {
      $('growthObservatoryFreshness').textContent = freshness.state || 'MEASURING';
      $('growthObservatoryLifecycle').innerHTML = '<div class="growth-empty">Reading live lifecycle declarations…</div>';
      $('growthObservatoryEvidence').innerHTML = '<div class="growth-empty">Checking contracts and evidence…</div>';
      $('growthObservatoryConnections').innerHTML = '<div class="growth-empty">Mapping exact capability seams…</div>';
      $('growthOpportunities').innerHTML = '<div class="growth-empty">Typed improvement signals will appear when the isolated scan completes.</div>';
      $('growthOpportunitySummary').innerHTML = '<small>Waiting for the first body-labelled measurement.</small>';
      $('growthOpportunitySummary').classList.remove('stale');
      $('growthObservatoryNote').textContent = response.error ? 'Observatory unavailable · ' + response.error : 'Measuring outside the page thread; the existing growth view remains usable.';
      return;
    }
    var lifecycle = o.lifecycle || {}, statuses = lifecycle.statuses || {}, structure = o.structure || {}, contracts = structure.contracts || {}, selftests = structure.selftests || {}, evidence = o.evidence || {}, verification = evidence.currentVerification || {}, verdicts = verification.verdicts || {}, connections = o.connections || {}, source = o.source || {}, runner = response.observatoryRunner || {};
    $('growthObservatoryFreshness').textContent = (freshness.state || 'CURRENT') + (freshness.ageMs == null ? '' : ' · ' + Math.max(0, Math.round(freshness.ageMs / 60000)) + 'm');
    $('growthObservatoryFreshness').classList.toggle('stale', freshness.stale === true);
    $('growthObservatoryLifecycle').innerHTML = ['CANON','WORKING','TEST','EXPERIMENTAL','SHELL','BROKEN','UNKNOWN'].map(function (status) { return '<div class="growth-status-row status-' + status.toLowerCase() + '"><span>' + status + '</span><b>' + fmt(statuses[status]) + '</b></div>'; }).join('');
    $('growthObservatoryEvidence').innerHTML = coverage(contracts.valid, structure.tools, 'valid contracts', 'structure only; not runtime proof', 'teal') + coverage(selftests.topLevel, structure.tools, 'top-level selftests', 'deterministic entrypoints present', 'blue') + coverage(verdicts.PASS, verification.currentResults, 'current PASS receipts', verification.receiptAvailable ? 'digest-matched local results' : 'no local verification receipt available', 'green') + coverage(evidence.documentedProofClaims, null, 'documented public proof claims', 'claims stay bounded by their does-not-prove fields', 'gold');
    $('growthObservatoryConnections').innerHTML = coverage(connections.connected, connections.exactContractCapabilities, 'connected identifiers', 'one or more exact providers and consumers', 'green') + coverage(connections.consumerOnly, connections.exactContractCapabilities, 'consumer-only', 'attention: no exact provider declared', 'red') + coverage(connections.providerOnly, connections.exactContractCapabilities, 'provider-only', 'reuse candidate or intentional public output', 'gold');
    renderOpportunities(o.opportunities || []);
    renderOpportunitySummary(o.opportunities || [], source, freshness, o.measuredAt, runner);
    var status = response.scanStatus || {}, registry = evidence.registry || {};
    $('growthObservatoryNote').textContent = (freshness.stale === true ? 'Stale measurement; a refresh may be running. ' : '') + 'Body ' + String(source.label || 'unknown') + ' · measured ' + new Date(o.measuredAt).toLocaleString() + (status.durationMs == null ? '' : ' · isolated scan ' + (status.durationMs / 1000).toFixed(1) + 's') + ' · evidence registry ' + String(registry.state || 'UNKNOWN').toLowerCase().replace(/_/g, ' ') + ' · no quality score produced.';
  }

  function render() {
    if (!data) return;
    var c = data.current, d = data.deltaFromPrevious || {}, h = data.history || [], schedule = data.schedule || {}, total = Math.max(1, c.totalFiles), textPct = Math.round(c.textFiles / total * 100), componentReady = data.componentDeltaReady === true, worldReady = data.worldDeltaReady === true, capabilityReady = data.capabilityDeltaReady === true, changes = data.moduleChanges || {}, worldChanges = data.worldChanges || {};
    $('growthPrimary').innerHTML = metric(c.totalFiles, 'active files', fmt(c.textFiles) + ' text · ' + fmt(c.binaryFiles) + ' binary') + metric(c.characters, 'text characters', fmt(c.lines) + ' lines') + metric(c.lines, 'lines', 'UTF-8 source and documents') + metric(bytes(c.bytes), 'active size', 'generated copies excluded');
    renderScopeTransitions();
    $('growthOrbits').innerHTML = orbit(c.modules, 'top-level tools') + orbit(c.worlds, 'living worlds') + orbit(c.games, 'games') + orbit(c.tests, 'test files');
    $('growthCapabilities').innerHTML = capability(c.exactCapabilities, 'Exact capabilities', 'unique machine-declared abilities after overlap is merged', 'exact') + capability(c.capabilityDeclarations, 'Capability declarations', 'provider-local breadth and reuse across modules', 'declared');
    var handBreakdown = c.handBreakdown || {}, handNote = handBreakdown.creation != null ? fmt(handBreakdown.creation) + ' creation · ' + fmt(handBreakdown.aiNative) + ' AI-native · ' + fmt(handBreakdown.sensoryAdapters) + ' sensory adapters separate' : 'creation + AI-native';
    $('growthComponents').innerHTML = component(c.hands, 'executable hands', handNote) + component(c.schemas, 'typed schemas', 'declared data shapes') + component(c.protocols, 'protocol seams', 'named exchange rules') + component(c.validators, 'verifier programs', 'executable checks');
    $('growthComposition').innerHTML = '<div class="growth-bar"><i class="text" style="width:' + textPct + '%"></i><i class="binary" style="width:' + (100 - textPct) + '%"></i></div><div class="growth-legend"><span>TEXT ' + textPct + '%</span><span>BINARY ' + (100 - textPct) + '%</span></div>';
    $('growthDeltas').innerHTML = !h.length ? '<div class="growth-empty">Save the first snapshot to begin measuring daily growth.</div>' : data.deltaComparison && data.deltaComparison.ready === false ? '<div class="growth-empty"><b>Counting scope updated—no files were declared lost.</b><span>' + attr(data.deltaComparison.message || 'The next saved snapshot becomes the comparable baseline.') + '</span></div>' : deltaRow('Files', d.totalFiles) + deltaRow('Characters', d.characters, 'net active-source change; old and new modules and worlds all count') + deltaRow('Lines', d.lines, 'net world, game, tool, test and document growth') + deltaRow('Exact capabilities', capabilityReady ? d.exactCapabilities : null, capabilityReady ? 'unique contract identifiers' : 'capability-aware baseline begins next snapshot') + deltaRow('Capability declarations', capabilityReady ? d.capabilityDeclarations : null, capabilityReady ? 'provider-local reuse and overlap' : 'capability-aware baseline begins next snapshot') + deltaRow('New top-level tools', d.modules) + deltaRow(changes.exact ? 'Existing tools updated' : 'Tool folders touched', changes.exact ? changes.updated : changes.touched, changes.exact ? 'compact fingerprint comparison' : 'legacy snapshot · timestamp signal') + deltaRow('New living worlds', worldReady ? d.worlds : null, worldReady ? '' : 'baseline begins next snapshot') + deltaRow(worldChanges.exact ? 'Existing worlds updated' : 'World folders touched', worldChanges.exact ? worldChanges.updated : worldChanges.touched, worldChanges.exact ? 'compact per-world fingerprint comparison' : 'legacy snapshot · timestamp signal') + deltaRow('Executable hands', componentReady ? d.hands : null, componentReady ? '' : 'baseline begins next snapshot') + deltaRow('Typed schemas', componentReady ? d.schemas : null, componentReady ? '' : 'baseline begins next snapshot') + deltaRow('Protocol seams', componentReady ? d.protocols : null, componentReady ? '' : 'baseline begins next snapshot') + deltaRow('Verifier programs', componentReady ? d.validators : null, componentReady ? '' : 'baseline begins next snapshot');
    var yearHistory = renderYearPicker(h), visibleHistory = renderMonthPicker(yearHistory), max = Math.max.apply(null, h.map(function (s) { return Number(s.characters) || 0; }).concat([1]));
    $('growthHistory').innerHTML = visibleHistory.length ? visibleHistory.map(function (s) { var height = Math.max(4, Math.round(Number(s.characters || 0) / max * 100)), capabilityNote = Number(s.measurementVersion || 0) >= 7 ? ' · ' + fmt(s.exactCapabilities) + ' exact capabilities' : ' · capability baseline not recorded yet'; return '<div class="growth-snapshot" style="height:' + height + '%" title="' + fmt(s.characters) + ' characters · ' + fmt(s.totalFiles) + ' files' + capabilityNote + ' · ' + attr(s.label || 'Workshop snapshot') + '"><span>' + new Date(s.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</span></div>'; }).join('') : '<div class="growth-empty">No saved snapshots for this period.</div>';
    var totalMonths = new Set(h.map(function (s) { return monthKey(s.capturedAt); }).filter(Boolean)).size, totalYears = new Set(h.map(function (s) { return yearKey(s.capturedAt); }).filter(Boolean)).size, period = activeMonth === 'all' ? activeYear : monthLabel(activeMonth);
    $('growthMonthSummary').textContent = h.length ? period + ' · ' + visibleHistory.length + ' saved moment' + (visibleHistory.length === 1 ? '' : 's') + ' · ' + h.length + ' retained across ' + totalMonths + ' month' + (totalMonths === 1 ? '' : 's') + ' / ' + totalYears + ' year' + (totalYears === 1 ? '' : 's') : 'The first compact snapshot will begin the journey.';
    renderMirror();
    $('growthAutoEnabled').checked = schedule.enabled !== false;
    $('growthAutoTime').value = schedule.localTime || '05:00';
    $('growthScheduleSummary').textContent = (schedule.enabled === false ? 'Daily snapshot paused' : 'Daily at ' + (schedule.localTime || '05:00') + ' local time') + (schedule.lastCapturedAt ? ' · last ' + new Date(schedule.lastCapturedAt).toLocaleString() : '') + ' · compact metrics only';
    $('growthRules').innerHTML = '<b>Honest counting scope:</b> active workshop files only. Excluded: ' + data.countingRules.excluded.join(', ') + '. Raw intake carriers stay recoverable outside active-source growth and a scope-rule change starts a fresh comparable baseline instead of looking like lost work. Foundation Planet and every future <code>worlds/*</code> source file contribute to the same character and line totals as games and tools; compact world fingerprints make deep upgrades visible without double-counting them as new tools. Exact capabilities deduplicate machine-declared provides/produces identifiers; capability declarations retain provider-local overlap so reuse stays visible. Human-facing action prose never inflates either count. Hands are executable files in the two shared hand registries; schemas, named protocol seams and verifier programs are counted by their declared file roles. Daily records store aggregate counts plus short per-tool and per-world fingerprints—not screenshots, source content or file lists. Compact snapshots remain in the monthly journey; the visible delta compares with the latest scope-compatible snapshot.<br><b>Mirror family:</b> ' + attr(data.countingRules.mirrorSignal || 'local file metadata only; private contents are not read; parent code is counted once') + '. Clone cards retain only compact declared footprints in daily history.';
  }

  function setStatus(message, isError) { var inline = $('growthActionStatus'), detail = $('growthStatus'); inline.textContent = message || ''; inline.classList.toggle('error', !!isError); detail.textContent = message || ''; detail.style.color = isError ? '#ff8190' : ''; }
  function setObservatoryStatus(message, isError) { var status = $('growthObservatoryActionStatus'); status.textContent = message || ''; status.classList.toggle('error', !!isError); }
  function setView(view) {
    activeView = view === 'observatory' ? 'observatory' : 'growth';
    var sheet = $('growthScreen').querySelector('.growth-sheet'), isObservatory = activeView === 'observatory';
    sheet.classList.toggle('view-growth', !isObservatory);
    sheet.classList.toggle('view-observatory', isObservatory);
    $('growthViewGrowth').setAttribute('aria-selected', String(!isObservatory));
    $('growthViewObservatory').setAttribute('aria-selected', String(isObservatory));
    $('growthKicker').textContent = isObservatory ? 'AXM · evidence-backed workshop observatory' : 'AXM · workshop growth';
    $('growthTitle').textContent = isObservatory ? 'See proof, seams, and the next useful gaps.' : 'See what the Workshop has actually grown.';
    $('growthIntro').textContent = isObservatory ? 'Structure, evidence, exact connections, holds and opportunities stay separate from simple scale.' : 'Active files, characters, tools, capabilities, worlds, history and velocity stay together without treating archives as lost source.';
    $('growthClose').setAttribute('aria-label', 'Close Workshop ' + (isObservatory ? 'Observatory' : 'Growth'));
    if (isObservatory && mirrorPoll) { window.clearTimeout(mirrorPoll); mirrorPoll = null; }
    if (isObservatory && scopePoll) { window.clearTimeout(scopePoll); scopePoll = null; }
  }
  function scheduleMirrorPoll() {
    if (mirrorPoll || activeView !== 'growth' || !data || !data.mirrorMeasurement || !data.mirrorMeasurement.inFlight) return;
    mirrorPoll = window.setTimeout(function () {
      mirrorPoll = null;
      fetch('/api/workshop-growth/mirror', { cache: 'no-store' }).then(function (r) { return jsonResponse(r, 'Mirror growth'); }).then(function (j) {
        data.mirrorMeasurement = j.mirrorMeasurement || {};
        if (j.ready) {
          data.current.mirror = j.mirror;
          data.mirrorDeltaFromPrevious = j.mirrorDeltaFromPrevious;
          data.mirrorSpecializationChanges = j.mirrorSpecializationChanges;
          data.mirrorDeltaReady = j.mirrorDeltaReady;
          renderMirror();
        } else scheduleMirrorPoll();
      }).catch(function (e) { data.mirrorMeasurement = { ready:false, inFlight:false, error:e.message }; renderMirror(); });
    }, 1800);
  }
  function scheduleScopePoll() {
    if (scopePoll || activeView !== 'growth' || !data || !data.scopeTransitions || data.scopeTransitions.state !== 'VERIFYING') return;
    scopePoll = window.setTimeout(function () {
      scopePoll = null;
      fetch('/api/workshop-growth/scope-transition', { cache:'no-store' }).then(function (r) { return jsonResponse(r, 'Scope transition'); }).then(function (j) {
        data.scopeTransitions = j.scopeTransitions;
        renderScopeTransitions();
        if (!j.ready) scheduleScopePoll();
      }).catch(function (e) { data.scopeTransitions = { state:'BROKEN', errors:[e.message], transitions:[] }; renderScopeTransitions(); });
    }, 1800);
  }
  function refreshGrowth() { return fetch('/api/workshop-growth', { cache: 'no-store' }).then(function (r) { return jsonResponse(r, 'Growth'); }).then(function (j) { data = j; render(); scheduleMirrorPoll(); scheduleScopePoll(); }).catch(function (e) { setStatus('Growth unavailable · ' + e.message, true); }); }
  function refreshObservatory() { return fetch('/api/workshop-observatory', { cache: 'no-store' }).then(function (r) { return jsonResponse(r, 'Observatory'); }).then(function (j) { observatoryData = j; setObservatoryStatus('', false); renderObservatory(); if (activeView === 'observatory' && (!j.ready || j.freshness && j.freshness.stale) && !observatoryPoll) { observatoryPoll = window.setTimeout(function () { observatoryPoll = null; refreshObservatory(); }, 1800); } }).catch(function (e) { observatoryData = { ready:false, error:e.message, milestones:observatoryData && observatoryData.milestones || [] }; setObservatoryStatus(e.message, true); renderObservatory(); }); }
  function refreshCurrent() { return activeView === 'observatory' ? refreshObservatory() : refreshGrowth(); }
  function open(view) { setView(view); $('growthScreen').classList.add('show'); setStatus('', false); setObservatoryStatus('', false); refreshCurrent(); }
  function openGrowth() { open('growth'); }
  function openObservatory() { open('observatory'); }
  function close() { $('growthScreen').classList.remove('show'); if (observatoryPoll) { window.clearTimeout(observatoryPoll); observatoryPoll = null; } if (mirrorPoll) { window.clearTimeout(mirrorPoll); mirrorPoll = null; } if (scopePoll) { window.clearTimeout(scopePoll); scopePoll = null; } }
  function capture() { var label = $('growthLabel').value.trim() || 'Workshop snapshot', button = $('growthCapture'); button.disabled = true; button.textContent = 'Saving…'; setStatus('Measuring the active workshop…', false); fetch('/api/workshop-growth/capture', { method: 'POST', headers: { 'content-type': 'application/json', 'x-axm-growth': 'explicit-local-snapshot' }, body: JSON.stringify({ label: label, actor: 'local-human' }) }).then(function (r) { return jsonResponse(r, 'Growth snapshot'); }).then(function (j) { setStatus(j.duplicate ? 'Already saved · nothing changed.' : 'Snapshot saved.', false); return refreshGrowth(); }).catch(function (e) { setStatus('Save failed · ' + e.message, true); }).then(function () { button.disabled = false; button.textContent = 'Save snapshot'; }); }
  function saveSchedule() { var button = $('growthScheduleSave'); button.disabled = true; setStatus('Saving daily schedule…', false); fetch('/api/workshop-growth/schedule', { method: 'POST', headers: { 'content-type': 'application/json', 'x-axm-growth': 'explicit-local-schedule' }, body: JSON.stringify({ enabled: $('growthAutoEnabled').checked, localTime: $('growthAutoTime').value || '05:00', actor: 'local-human' }) }).then(function (r) { return jsonResponse(r, 'Growth schedule'); }).then(function () { setStatus($('growthAutoEnabled').checked ? 'Daily snapshots enabled.' : 'Daily snapshots paused.', false); return refreshGrowth(); }).catch(function (e) { setStatus('Schedule failed · ' + e.message, true); }).then(function () { button.disabled = false; }); }
  function recordMilestone() { var button = $('growthMilestoneSave'), label = $('growthMilestoneLabel').value.trim(), note = $('growthMilestoneNote').value.trim(); if (!label) { setObservatoryStatus('Milestone title is required.', true); $('growthMilestoneLabel').focus(); return; } button.disabled = true; button.textContent = 'Recording…'; fetch('/api/workshop-observatory/milestones', { method:'POST', headers:{ 'content-type':'application/json', 'x-axm-observatory':'explicit-local-milestone' }, body:JSON.stringify({ label:label, note:note, actor:'local-human' }) }).then(function (r) { return jsonResponse(r, 'Observatory milestone'); }).then(function (j) { $('growthMilestoneLabel').value = ''; $('growthMilestoneNote').value = ''; setObservatoryStatus(j.duplicate ? 'That milestone is already attached to this evidence snapshot.' : 'Milestone recorded · human importance preserved without automatic proof.', false); return refreshObservatory(); }).catch(function (e) { setObservatoryStatus('Milestone failed · ' + e.message, true); }).then(function () { button.disabled = false; button.textContent = 'Record milestone'; }); }
  function refreshObservatoryNow() { var button = $('growthObservatoryRefresh'); button.disabled = true; setObservatoryStatus('Starting a fresh evidence measurement…', false); return fetch('/api/workshop-observatory/refresh', { method:'POST', headers:{ 'x-axm-observatory':'explicit-local-refresh' } }).then(function (r) { return jsonResponse(r, 'Observatory refresh'); }).then(function () { setObservatoryStatus('Refresh started · waiting for the isolated measurement.', false); return refreshObservatory(); }).catch(function (e) { setObservatoryStatus(e.message, true); observatoryData = { ready:false, error:e.message, milestones:observatoryData && observatoryData.milestones || [] }; renderObservatory(); }).then(function () { button.disabled = false; }); }

  $('growthClose').onclick = close;
  $('growthScreen').onclick = function (event) { if (event.target === $('growthScreen')) close(); };
  $('growthCapture').onclick = capture;
  $('growthRefresh').onclick = refreshGrowth;
  $('growthObservatoryRefresh').onclick = refreshObservatoryNow;
  $('growthScheduleSave').onclick = saveSchedule;
  $('growthMilestoneSave').onclick = recordMilestone;
  $('growthViewGrowth').onclick = function () { setView('growth'); refreshGrowth(); };
  $('growthViewObservatory').onclick = function () { setView('observatory'); refreshObservatory(); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-growth-filter]'), function (button) { button.onclick = function () { activeOpportunityFilter = button.getAttribute('data-growth-filter') || 'ALL'; Array.prototype.forEach.call(document.querySelectorAll('[data-growth-filter]'), function (item) { item.classList.toggle('active', item === button); }); renderOpportunities(observatoryData && observatoryData.observatory && observatoryData.observatory.opportunities || []); }; });
  $('growthYear').onchange = function () { activeYear = $('growthYear').value; activeMonth = ''; render(); };
  $('growthMonth').onchange = function () { activeMonth = $('growthMonth').value; render(); };
  window.AXMWorkshopGrowth = { open: openGrowth, openGrowth: openGrowth, openObservatory: openObservatory, refresh: refreshCurrent };
}());
