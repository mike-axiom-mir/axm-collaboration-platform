(function () {
  'use strict';

  var Core = window.AXMModularSeed;
  var STORAGE_KEY = 'axm.modular-seed-foundry.v1';
  var form = document.getElementById('seedForm');
  var generateButton = document.getElementById('generateButton');
  var result = document.getElementById('result');
  var emptyState = document.getElementById('emptyState');
  var outputState = document.getElementById('outputState');
  var liveStatus = document.getElementById('liveStatus');
  var packet = null;
  var brief = '';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character];
    });
  }
  function selectedTracks() {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="tracks"]:checked')).map(function (item) { return item.value; });
  }
  function values() {
    var data = new FormData(form);
    return {
      title: data.get('title'),
      subject: data.get('subject'),
      goal: data.get('goal'),
      kind: data.get('kind'),
      depth: data.get('depth'),
      seedCount: data.get('seedCount'),
      suggestedRuns: data.get('suggestedRuns'),
      maxChildrenPerSeed: data.get('maxChildrenPerSeed'),
      targetPlatform: data.get('targetPlatform'),
      constraints: data.get('constraints'),
      existingCapabilities: data.get('existingCapabilities'),
      parentDigest: data.get('parentDigest'),
      tracks: selectedTracks(),
      createdAt: new Date().toISOString(),
      operator: 'Mike'
    };
  }
  function saveForm(data) {
    var copy = Object.assign({}, data);
    delete copy.createdAt;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(copy)); } catch (error) { /* Form persistence is optional. */ }
  }
  function restoreForm() {
    var saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (error) { return; }
    if (!saved || typeof saved !== 'object') return;
    Object.keys(saved).forEach(function (key) {
      if (key === 'tracks') return;
      var field = form.elements.namedItem(key);
      if (field && typeof saved[key] !== 'object') field.value = saved[key];
    });
    if (Array.isArray(saved.tracks) && saved.tracks.length) {
      form.querySelectorAll('input[name="tracks"]').forEach(function (input) { input.checked = saved.tracks.indexOf(input.value) !== -1; });
    }
  }
  async function sha256(source) {
    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder === 'undefined') throw new Error('This browser does not expose the required local SHA-256 engine.');
    var bytes = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return Array.prototype.map.call(new Uint8Array(bytes), function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }
  function metric(value, label) {
    return '<article class="metric"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></article>';
  }
  function trackFor(id) {
    return Core.TRACKS.find(function (track) { return track.id === id; }) || { icon:'SEED', title:id };
  }
  function renderGraph(modules) {
    var centerX = 50, centerY = 37, radiusX = 39, radiusY = 27;
    var lines = ['<ellipse class="orbit" cx="50" cy="37" rx="39" ry="27"></ellipse>'];
    var nodes = [];
    modules.forEach(function (item, index) {
      var angle = (-Math.PI / 2) + (Math.PI * 2 * index / modules.length);
      var x = centerX + Math.cos(angle) * radiusX;
      var y = centerY + Math.sin(angle) * radiusY;
      var track = trackFor(item.lane);
      lines.push('<line class="link" x1="' + centerX + '" y1="' + centerY + '" x2="' + x.toFixed(2) + '" y2="' + y.toFixed(2) + '"></line>');
      nodes.push('<circle class="node" cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="5.1"></circle><text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '">' + esc(track.icon) + '</text>');
    });
    lines.push('<circle class="core" cx="50" cy="37" r="9"></circle><text class="center-label" x="50" y="37">SEED</text>');
    document.getElementById('orbitGraph').innerHTML = lines.join('') + nodes.join('');
  }
  function renderSeeds(modules) {
    document.getElementById('seedList').innerHTML = modules.map(function (item) {
      var track = trackFor(item.lane);
      return '<article class="seed-card"><header><span class="sigil">' + esc(track.icon) + '</span><h3>' + esc(item.title) + '</h3></header><p>' + esc(item.purpose) + '</p><footer><span class="chip">' + esc(item.lane.toUpperCase()) + '</span><span class="chip">SEED</span><span class="chip">' + esc(item.work.minimumChecks) + '+ CHECKS</span></footer></article>';
    }).join('');
  }
  function renderPacket(nextPacket) {
    packet = nextPacket;
    brief = Core.platformBrief(packet);
    emptyState.hidden = true;
    result.hidden = false;
    outputState.textContent = 'COMPILED';
    outputState.classList.remove('waiting');
    document.getElementById('seedId').textContent = packet.seedId;
    document.getElementById('seedDigest').textContent = packet.integrity.semanticDigest;
    document.getElementById('metrics').innerHTML = metric(packet.modules.length, 'starting seeds') + metric(new Set(packet.modules.map(function (item) { return item.lane; })).size, 'growth lanes') + metric(packet.growthBudget.maximumCandidatesPerRun, 'run ceiling') + metric(packet.growthBudget.suggestedHumanInitiatedRuns, 'suggested runs');
    document.getElementById('topologyLabel').textContent = packet.kind.replace(/-/g, ' ').toUpperCase();
    renderGraph(packet.modules);
    renderSeeds(packet.modules);
    document.getElementById('packetPreview').textContent = JSON.stringify(packet, null, 2);
    liveStatus.textContent = packet.modules.length + ' modular seeds compiled with semantic digest ' + packet.integrity.semanticDigest + '. Nothing was sent or installed.';
  }
  async function compile(event) {
    event.preventDefault();
    var data = values();
    if (!data.tracks.length) {
      liveStatus.textContent = 'Choose at least one growth lane.';
      form.querySelector('input[name="tracks"]').focus();
      return;
    }
    generateButton.disabled = true;
    outputState.textContent = 'HASHING';
    outputState.classList.remove('waiting');
    try {
      var draft = Core.compile(data);
      var digest = await sha256(Core.semanticMaterial(draft));
      var completed = Core.attachDigest(draft, digest);
      var validation = Core.validate(completed);
      if (!validation.pass) throw new Error(validation.errors.join('; '));
      saveForm(data);
      renderPacket(completed);
    } catch (error) {
      outputState.textContent = 'HELD';
      liveStatus.textContent = 'Seed compilation held: ' + error.message;
    } finally {
      generateButton.disabled = false;
    }
  }
  function safeName(extension) {
    var base = packet ? packet.seedId : 'axm-modular-seed';
    return base.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + extension;
  }
  function download(filename, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type:type }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function requirePacket() {
    if (packet) return true;
    liveStatus.textContent = 'Generate a seed pack before exporting.';
    return false;
  }
  function updateCeiling() {
    var count = Math.max(1, Math.min(12, Number(form.elements.seedCount.value) || 6));
    var children = Math.max(1, Math.min(4, Number(form.elements.maxChildrenPerSeed.value) || 2));
    document.getElementById('candidateCeiling').textContent = count * children;
  }

  form.addEventListener('submit', compile);
  form.elements.seedCount.addEventListener('input', updateCeiling);
  form.elements.maxChildrenPerSeed.addEventListener('input', updateCeiling);
  document.getElementById('downloadBrief').addEventListener('click', function () {
    if (!requirePacket()) return;
    download(safeName('-platform-brief.md'), brief, 'text/markdown;charset=utf-8');
    liveStatus.textContent = 'Platform brief downloaded. It contains the complete machine-readable seed pack.';
  });
  document.getElementById('downloadJson').addEventListener('click', function () {
    if (!requirePacket()) return;
    download(safeName('.axm-seed.json'), JSON.stringify(packet, null, 2) + '\n', 'application/json;charset=utf-8');
    liveStatus.textContent = 'Machine-readable seed pack downloaded.';
  });
  document.getElementById('copyBrief').addEventListener('click', async function () {
    if (!requirePacket()) return;
    try {
      await navigator.clipboard.writeText(brief);
      liveStatus.textContent = 'Platform brief copied to the clipboard.';
    } catch (error) {
      liveStatus.textContent = 'Clipboard access was unavailable. Use Download platform brief instead.';
    }
  });

  restoreForm();
  updateCeiling();
  outputState.classList.add('waiting');
}());
