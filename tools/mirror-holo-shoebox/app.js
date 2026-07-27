(function () {
  'use strict';

  var Engine = window.AXMExperimentWorld;
  var STORAGE_KEY = 'axm.mirror-holo-shoebox.checkpoint.v1';
  var state = null;
  var selectedId = 'artifact-intent';
  var mode = 'curiosity';
  var view = 'world';
  var pulseTimer = null;
  var toastTimer = null;

  function byId(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function hash(text) {
    var h = 2166136261;
    text = String(text);
    for (var i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function colorFor(kind) {
    if (kind === 'intent') return '#ffc968';
    if (kind === 'unknown-capsule') return '#b985ff';
    if (kind.indexOf('visual') >= 0) return '#62e4ff';
    if (kind.indexOf('code') >= 0 || kind.indexOf('rule') >= 0) return '#6fffc1';
    if (kind.indexOf('experience') >= 0 || kind.indexOf('game') >= 0) return '#ff8fc6';
    return '#8bb8ff';
  }
  function toast(message, error) {
    var node = byId('toast');
    node.textContent = message;
    node.classList.toggle('error', !!error);
    node.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { node.classList.remove('show'); }, 2400);
  }
  function budgets() {
    return {
      timeMinutes: Number(byId('time-budget').value),
      storageMb: Number(byId('storage-budget').value),
      computePercent: Number(byId('compute-budget').value),
      maxArtifacts: 24,
      maxForks: 3
    };
  }
  function openWorld() {
    stopPulses();
    state = Engine.create({ goal: byId('goal').value, mode: mode, budgets: budgets() });
    selectedId = 'artifact-intent';
    render();
    toast('Disposable candidate world opened. Nothing canonical changed.');
  }
  function positionFor(artifact, index, count) {
    if (artifact.id === 'artifact-intent') return { x: 50, y: 49, scale: 1.15, z: 12 };
    var seed = hash(artifact.id + ':' + view);
    var angle = (index * (360 / Math.max(1, count - 1)) + (seed % 47)) * Math.PI / 180;
    var ring = 23 + (seed % 10);
    if (view === 'anatomy') ring = artifact.kind === 'unknown-capsule' ? 34 : 25;
    if (view === 'evidence') ring = artifact.evidence.length ? 20 : 34;
    if (view === 'timeline') {
      return { x: 15 + ((index - 1) % 5) * 17.5, y: 34 + Math.floor((index - 1) / 5) * 25, scale: .82, z: 7 };
    }
    return {
      x: clamp(50 + Math.cos(angle) * ring, 13, 87),
      y: clamp(49 + Math.sin(angle) * ring * .73, 15, 84),
      scale: .78 + (seed % 28) / 100,
      z: 5 + seed % 6
    };
  }
  function positions() {
    var result = {};
    state.artifacts.forEach(function (artifact, index) { result[artifact.id] = positionFor(artifact, index, state.artifacts.length); });
    return result;
  }
  function renderGlobe() {
    var layer = byId('artifact-layer');
    var links = byId('link-layer');
    var map = positions();
    layer.innerHTML = '';
    links.innerHTML = '';
    state.links.forEach(function (link) {
      if (!map[link.from] || !map[link.to]) return;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', map[link.from].x); line.setAttribute('y1', map[link.from].y);
      line.setAttribute('x2', map[link.to].x); line.setAttribute('y2', map[link.to].y);
      links.appendChild(line);
    });
    state.artifacts.forEach(function (artifact, index) {
      var pos = map[artifact.id];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'artifact-node' + (artifact.id === selectedId ? ' selected' : '');
      button.dataset.kind = artifact.kind;
      button.dataset.artifactId = artifact.id;
      button.style.setProperty('--x', pos.x + '%'); button.style.setProperty('--y', pos.y + '%');
      button.style.setProperty('--scale', pos.scale); button.style.setProperty('--z', pos.z);
      button.style.setProperty('--node-color', colorFor(artifact.kind));
      button.setAttribute('role', 'listitem');
      button.setAttribute('aria-label', artifact.kind + ': ' + artifact.title);
      button.innerHTML = '<strong>' + String(index + 1).padStart(2, '0') + '</strong><small></small>';
      button.querySelector('small').textContent = artifact.title;
      button.addEventListener('click', function () { selectedId = artifact.id; renderGlobe(); renderInspector(); });
      layer.appendChild(button);
    });
    byId('stage-empty').hidden = state.artifacts.length > 1;
  }
  function renderInspector() {
    var artifact = state.artifacts.find(function (item) { return item.id === selectedId; }) || state.artifacts[0];
    selectedId = artifact.id;
    var symbol = byId('inspector-symbol');
    symbol.className = 'artifact-symbol ' + artifact.kind;
    symbol.style.color = colorFor(artifact.kind);
    symbol.style.borderColor = colorFor(artifact.kind);
    symbol.querySelector('span').textContent = String(state.artifacts.indexOf(artifact) + 1).padStart(2, '0');
    byId('inspector-kind').textContent = artifact.kind.toUpperCase().replace(/-/g, ' ');
    byId('inspector-title').textContent = artifact.title;
    byId('inspector-summary').textContent = artifact.summary;
    byId('inspector-creator').textContent = artifact.createdBy;
    byId('inspector-inputs').textContent = artifact.inputs.length ? artifact.inputs.join(', ') : 'none';
    byId('inspector-evidence').textContent = artifact.evidence.length + (artifact.evidence.length === 1 ? ' receipt' : ' receipts');
    byId('inspector-digest').textContent = artifact.digest;
    byId('inspector-facets').textContent = JSON.stringify(artifact.facets, null, 2);
  }
  function renderCapabilities() {
    var list = byId('capability-list');
    list.innerHTML = '';
    var counts = { READY: 0, DEGRADED: 0, BLOCKED: 0 };
    state.capabilities.forEach(function (capability) {
      counts[capability.status] += 1;
      var row = document.createElement('div');
      row.className = 'capability ' + capability.status.toLowerCase();
      row.innerHTML = '<i></i><div><strong></strong><span></span></div>';
      row.querySelector('strong').textContent = capability.status + ' / ' + capability.id;
      row.querySelector('span').textContent = capability.note;
      list.appendChild(row);
    });
    byId('capability-count').textContent = counts.READY + ' ready / ' + counts.DEGRADED + ' degraded / ' + counts.BLOCKED + ' blocked';
  }
  function renderTimeline() {
    var timeline = byId('timeline');
    timeline.innerHTML = '';
    state.events.slice().reverse().slice(0, 18).forEach(function (entry) {
      var node = document.createElement('article');
      node.className = 'event' + (entry.type === 'intent.refused' ? ' refused' : '');
      node.innerHTML = '<span></span><strong></strong><small></small>';
      node.querySelector('span').textContent = '#' + String(entry.sequence).padStart(3, '0') + ' / ' + entry.type;
      node.querySelector('strong').textContent = entry.message;
      node.querySelector('small').textContent = 'actor: ' + entry.actor;
      timeline.appendChild(node);
    });
  }
  function renderMetrics(frame) {
    byId('metric-artifacts').textContent = state.usage.artifacts + ' / ' + state.budgets.maxArtifacts;
    byId('metric-storage').textContent = state.usage.storageMb.toFixed(1) + ' / ' + state.budgets.storageMb + ' MB';
    byId('metric-compute').textContent = state.usage.computePercentPeak.toFixed(0) + ' / ' + state.budgets.computePercent + '%';
    byId('metric-state').textContent = state.status;
    byId('world-title').textContent = state.mode.replace('-', ' ') + ' / ' + state.branch;
    byId('frame-digest').textContent = frame.frameDigest;
    document.documentElement.dataset.worldStatus = state.status;
    document.documentElement.dataset.worldDigest = state.worldDigest;
    document.documentElement.dataset.frameDigest = frame.frameDigest;
    document.documentElement.dataset.mirrorConnected = String(state.truth.mirrorConnected);
    document.documentElement.dataset.canonicalChanged = String(state.truth.canonicalWorkshopChanged);
  }
  function render() {
    if (!state) return;
    var frame = Engine.observe(state, { id: 'holo-observer', kind: 'machine' });
    renderGlobe(); renderInspector(); renderCapabilities(); renderTimeline(); renderMetrics(frame);
    byId('freeze-candidate').disabled = state.status === 'FROZEN';
    byId('pulse-once').disabled = state.status === 'FROZEN';
    byId('pulse-five').disabled = state.status === 'FROZEN' || !!pulseTimer;
  }
  function runPulse() {
    var result = Engine.runPulse(state);
    state = result.state;
    if (result.ok && result.artifact) selectedId = result.artifact.id;
    render();
    if (!result.ok) { stopPulses(); toast(result.refusal.message, true); }
    return result.ok;
  }
  function runFive() {
    if (pulseTimer || state.status === 'FROZEN') return;
    var remaining = 5;
    byId('pause-pulses').disabled = false;
    byId('pulse-five').disabled = true;
    function next() {
      if (!runPulse()) return;
      remaining -= 1;
      if (remaining <= 0) { stopPulses(); toast('Five bounded rehearsal pulses completed.'); return; }
      pulseTimer = window.setTimeout(next, 520);
    }
    next();
  }
  function stopPulses() {
    if (pulseTimer) window.clearTimeout(pulseTimer);
    pulseTimer = null;
    if (byId('pause-pulses')) byId('pause-pulses').disabled = true;
    if (byId('pulse-five') && state) byId('pulse-five').disabled = state.status === 'FROZEN';
  }
  function freeze() {
    stopPulses();
    var result = Engine.applyIntent(state, {
      schema: Engine.INTENT_SCHEMA,
      id: 'human-freeze-' + (state.sequence + 1),
      type: 'experiment.freeze',
      actor: { id: 'mike', kind: 'human' },
      effects: [],
      resource: { timeMinutes: 0, storageMb: 0, computePercent: 0 }
    });
    state = result.state; render();
    toast('Candidate frozen. Promotion remains outside this module.');
  }
  function saveCheckpoint() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Engine.checkpoint(state)));
      byId('storage-truth').textContent = 'Explicit checkpoint saved in this browser. Nothing was promoted or published.';
      toast('Shoebox checkpoint saved explicitly.');
    } catch (error) { toast('Checkpoint save failed: ' + error.message, true); }
  }
  function loadCheckpoint() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error('no explicit checkpoint exists');
      stopPulses(); state = Engine.restore(JSON.parse(raw)); selectedId = state.artifacts[0].id; render();
      byId('storage-truth').textContent = 'Explicit checkpoint restored. Canonical Workshop state was not touched.';
      toast('Saved shoebox restored.');
    } catch (error) { toast('Restore failed: ' + error.message, true); }
  }
  function downloadCheckpoint() {
    var checkpoint = Engine.checkpoint(state);
    var blob = new Blob([JSON.stringify(checkpoint, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url; anchor.download = state.id + '.checkpoint.json'; anchor.click();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Candidate checkpoint downloaded.');
  }
  function discard() {
    stopPulses();
    localStorage.removeItem(STORAGE_KEY);
    openWorld();
    byId('storage-truth').textContent = 'Shoebox candidate discarded. Only this tool\'s browser checkpoint was cleared.';
    toast('Disposable shoebox cleared. Workshop files stayed untouched.');
  }
  function safeIntentExample() {
    return {
      schema: Engine.INTENT_SCHEMA,
      id: 'mirror-candidate-' + String(state.sequence + 1).padStart(3, '0'),
      type: 'artifact.transform',
      actor: { id: 'mirror-contract-seat', kind: 'machine' },
      sourceIds: [state.artifacts[state.artifacts.length - 1].id],
      effects: ['candidate-memory'],
      resource: { timeMinutes: 0.25, storageMb: 0.4, computePercent: 8 },
      artifact: {
        kind: 'unknown-capsule',
        title: 'Something we did not name yet',
        summary: 'A typed but deliberately unclassified candidate. It remains inside the shoebox.',
        facets: { classification: 'UNCLASSIFIED', proposedContract: 'axm.artifact.proposal/unresolved' }
      }
    };
  }
  function openPort() {
    byId('intent-json').value = JSON.stringify(safeIntentExample(), null, 2);
    byId('intent-status').textContent = 'Contract ready. Live Mirror broker is not attached.';
    byId('intent-dialog').showModal();
  }
  function applyPortIntent() {
    try {
      var intent = JSON.parse(byId('intent-json').value);
      var result = Engine.applyIntent(state, intent);
      state = result.state;
      if (result.ok && result.artifact) selectedId = result.artifact.id;
      render();
      if (!result.ok) {
        byId('intent-status').textContent = result.refusal.code + ': ' + result.refusal.message;
        toast(result.refusal.message, true);
        return;
      }
      byId('intent-dialog').close();
      toast('Typed candidate intent admitted inside the shoebox.');
    } catch (error) {
      byId('intent-status').textContent = 'INVALID: ' + error.message;
      toast('Intent rejected: ' + error.message, true);
    }
  }
  function bind() {
    document.querySelectorAll('[data-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        mode = button.dataset.mode;
        document.querySelectorAll('[data-mode]').forEach(function (item) { item.classList.toggle('selected', item === button); });
      });
    });
    document.querySelectorAll('[data-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        view = button.dataset.view;
        document.querySelectorAll('[data-view]').forEach(function (item) { item.classList.toggle('selected', item === button); });
        renderGlobe();
      });
    });
    [['time-budget','time-output',' min'],['storage-budget','storage-output',' MB'],['compute-budget','compute-output','%']].forEach(function (binding) {
      byId(binding[0]).addEventListener('input', function () { byId(binding[1]).textContent = byId(binding[0]).value + binding[2]; });
    });
    byId('open-world').addEventListener('click', openWorld);
    byId('pulse-once').addEventListener('click', function () { if (runPulse()) toast('One bounded rehearsal pulse completed.'); });
    byId('pulse-five').addEventListener('click', runFive);
    byId('pause-pulses').addEventListener('click', function () { stopPulses(); toast('Pulse sequence paused.'); });
    byId('freeze-candidate').addEventListener('click', freeze);
    byId('save-checkpoint').addEventListener('click', saveCheckpoint);
    byId('load-checkpoint').addEventListener('click', loadCheckpoint);
    byId('download-checkpoint').addEventListener('click', downloadCheckpoint);
    byId('discard-world').addEventListener('click', discard);
    byId('open-port').addEventListener('click', openPort);
    byId('apply-intent').addEventListener('click', applyPortIntent);
  }

  bind();
  openWorld();
})();
