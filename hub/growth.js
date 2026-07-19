(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, data = null;
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function bytes(n) { n = Number(n || 0); if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function delta(n) { n = Number(n || 0); return (n > 0 ? '+' : '') + fmt(n); }
  function metric(value, label, note) { return '<article class="growth-metric"><b>' + (typeof value === 'string' ? value : fmt(value)) + '</b><span>' + label + '</span><small>' + note + '</small></article>'; }
  function orbit(value, label) { return '<div class="growth-orbit"><div><b>' + fmt(value) + '</b><span>' + label + '</span></div></div>'; }
  function deltaRow(label, value) { return '<div class="growth-delta"><span>' + label + '</span><b class="' + (Number(value) === 0 ? 'zero' : '') + '">' + delta(value) + '</b></div>'; }

  function render() {
    if (!data) return;
    var c = data.current, d = data.deltaFromPrevious || {}, h = data.history || [], schedule = data.schedule || {}, total = Math.max(1, c.totalFiles), textPct = Math.round(c.textFiles / total * 100);
    $('growthPrimary').innerHTML = metric(c.totalFiles, 'active files', fmt(c.textFiles) + ' text · ' + fmt(c.binaryFiles) + ' binary') + metric(c.characters, 'text characters', fmt(c.lines) + ' lines') + metric(c.lines, 'lines', 'UTF-8 source and documents') + metric(bytes(c.bytes), 'active size', 'generated copies excluded');
    $('growthOrbits').innerHTML = orbit(c.modules, 'tool modules') + orbit(c.games, 'games') + orbit(c.tests, 'test files');
    $('growthComposition').innerHTML = '<div class="growth-bar"><i class="text" style="width:' + textPct + '%"></i><i class="binary" style="width:' + (100 - textPct) + '%"></i></div><div class="growth-legend"><span>TEXT ' + textPct + '%</span><span>BINARY ' + (100 - textPct) + '%</span></div>';
    $('growthDeltas').innerHTML = h.length ? deltaRow('Files since previous snapshot', d.totalFiles) + deltaRow('Characters since previous snapshot', d.characters) + deltaRow('Lines since previous snapshot', d.lines) + deltaRow('Modules since previous snapshot', d.modules) : '<div class="growth-empty">Save the first snapshot to begin measuring daily growth.</div>';
    var max = Math.max.apply(null, h.map(function (s) { return Number(s.characters) || 0; }).concat([1]));
    $('growthHistory').innerHTML = h.length ? h.slice(-20).map(function (s) { var height = Math.max(4, Math.round(Number(s.characters || 0) / max * 100)); return '<div class="growth-snapshot" style="height:' + height + '%" title="' + fmt(s.characters) + ' characters · ' + fmt(s.totalFiles) + ' files"><span>' + new Date(s.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</span></div>'; }).join('') : '<div class="growth-empty">No saved snapshots yet.</div>';
    $('growthAutoEnabled').checked = schedule.enabled !== false;
    $('growthAutoTime').value = schedule.localTime || '05:00';
    $('growthScheduleSummary').textContent = (schedule.enabled === false ? 'Daily snapshot paused' : 'Daily at ' + (schedule.localTime || '05:00') + ' local time') + (schedule.lastCapturedAt ? ' · last ' + new Date(schedule.lastCapturedAt).toLocaleString() : '') + ' · compact metrics only';
    $('growthRules').innerHTML = '<b>Honest counting scope:</b> active workshop files only. Excluded: ' + data.countingRules.excluded.join(', ') + '. Daily records store aggregate counts, not screenshots or file lists. The original baseline remains in history; the visible delta compares with the latest snapshot.';
  }

  function setStatus(message, isError) { var inline = $('growthActionStatus'), detail = $('growthStatus'); inline.textContent = message || ''; inline.classList.toggle('error', !!isError); detail.textContent = message || ''; detail.style.color = isError ? '#ff8190' : ''; }
  function refresh() { return fetch('/api/workshop-growth', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw Error(j.error || 'growth unavailable'); data = j; render(); }).catch(function (e) { setStatus(e.message, true); }); }
  function open() { $('growthScreen').classList.add('show'); setStatus('', false); refresh(); }
  function close() { $('growthScreen').classList.remove('show'); }
  function capture() { var label = $('growthLabel').value.trim() || 'Workshop snapshot', button = $('growthCapture'); button.disabled = true; button.textContent = 'Saving…'; setStatus('Measuring the active workshop…', false); fetch('/api/workshop-growth/capture', { method: 'POST', headers: { 'content-type': 'application/json', 'x-axm-growth': 'explicit-local-snapshot' }, body: JSON.stringify({ label: label, actor: 'local-human' }) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw Error(j.error || 'snapshot failed'); return j; }); }).then(function (j) { setStatus(j.duplicate ? 'Already saved · nothing changed.' : 'Snapshot saved.', false); return refresh(); }).catch(function (e) { setStatus('Save failed · ' + e.message, true); }).then(function () { button.disabled = false; button.textContent = 'Save snapshot'; }); }
  function saveSchedule() { var button = $('growthScheduleSave'); button.disabled = true; setStatus('Saving daily schedule…', false); fetch('/api/workshop-growth/schedule', { method: 'POST', headers: { 'content-type': 'application/json', 'x-axm-growth': 'explicit-local-schedule' }, body: JSON.stringify({ enabled: $('growthAutoEnabled').checked, localTime: $('growthAutoTime').value || '05:00', actor: 'local-human' }) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw Error(j.error || 'schedule failed'); return j; }); }).then(function () { setStatus($('growthAutoEnabled').checked ? 'Daily snapshots enabled.' : 'Daily snapshots paused.', false); return refresh(); }).catch(function (e) { setStatus('Schedule failed · ' + e.message, true); }).then(function () { button.disabled = false; }); }

  $('growthClose').onclick = close;
  $('growthScreen').onclick = function (event) { if (event.target === $('growthScreen')) close(); };
  $('growthCapture').onclick = capture;
  $('growthRefresh').onclick = function () { setStatus('Refreshing current workshop totals…', false); refresh().then(function () { setStatus('Current totals refreshed.', false); }); };
  $('growthScheduleSave').onclick = saveSchedule;
  window.AXMWorkshopGrowth = { open: open, refresh: refresh };
}());
