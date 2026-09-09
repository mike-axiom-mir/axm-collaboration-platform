(function () {
  'use strict';

  var Core = window.AXMGuestMakerCore;
  if (!Core) return;

  var state = Core.defaultState();
  var editable = false;
  var studioCanvas = document.getElementById('studioCanvas');
  var studioContext = studioCanvas.getContext('2d');
  var studioDraft = null;
  var studioPointer = null;
  var audioContext = null;
  var gameFrame = 0;
  var gameRuntime = null;
  var gameKeys = {};
  var gameArtwork = null;
  var demoStatusCopy = {
    studio: 'Full Studio active · browser-local canvas engine',
    sfx: 'Audio Studio active · browser-local audio engine',
    game: 'Game Forge active · browser-local production route',
    site: 'Shapeable Builder active · standalone HTML export'
  };
  var compactMakerQuery = window.matchMedia('(max-width: 650px)');

  function usesCompactMaker() { return compactMakerQuery.matches; }
  function quickMakerFor(name) {
    var panel = document.querySelector('[data-maker-panel="' + name + '"]');
    return panel && panel.querySelector('.quick-maker');
  }
  function compactStatus(name) {
    var labels = { studio: 'Phone sketcher', sfx: 'Phone SFX maker', game: 'Phone game maker', site: 'Phone site maker' };
    return (labels[name] || 'Phone maker') + ' active · full workspace waits for a wider screen';
  }

  function demoFrames() { return Array.prototype.slice.call(document.querySelectorAll('[data-demo-tool]')); }
  function sendDemoState(frame) {
    if (!frame || !frame.contentWindow || !frame.src) return;
    frame.contentWindow.postMessage({ type: 'axm:demo-session', active: editable === true && !usesCompactMaker() }, location.origin);
  }
  function loadDemoFrame(name) {
    if (!editable) return;
    var frame = document.querySelector('[data-demo-tool="' + name + '"]');
    if (!frame) return;
    if (usesCompactMaker()) {
      var compactShell = frame.closest('[data-demo-shell]');
      if (compactShell) compactShell.classList.add('is-mobile-route');
      var compactQuickMaker = quickMakerFor(name);
      document.querySelectorAll('.quick-maker').forEach(function (candidate) { if (candidate !== compactQuickMaker) candidate.open = false; });
      if (compactQuickMaker) compactQuickMaker.open = true;
      var compactStatusNode = document.getElementById(name === 'sfx' ? 'sfxStatus' : name + 'Status');
      if (compactStatusNode) compactStatusNode.textContent = compactStatus(name);
      return;
    }
    if (!frame.src && frame.dataset.demoSrc) frame.src = frame.dataset.demoSrc;
    var shell = frame.closest('[data-demo-shell]');
    if (shell) shell.classList.add('is-live');
    var statusNode = document.getElementById(name === 'sfx' ? 'sfxStatus' : name + 'Status');
    if (statusNode && demoStatusCopy[name]) statusNode.textContent = demoStatusCopy[name];
    sendDemoState(frame);
  }
  function updateDemoFrames() {
    demoFrames().forEach(function (frame) {
      var shell = frame.closest('[data-demo-shell]');
      var compact = usesCompactMaker();
      if (shell) {
        shell.classList.toggle('is-live', editable && !compact);
        shell.classList.toggle('is-mobile-route', editable && compact);
      }
      frame.style.pointerEvents = editable && !compact ? '' : 'none';
      frame.tabIndex = editable && !compact ? 0 : -1;
      if (!editable) {
        var name = frame.dataset.demoTool;
        var statusNode = document.getElementById(name === 'sfx' ? 'sfxStatus' : name + 'Status');
        if (statusNode) statusNode.textContent = 'Timed session locked';
      }
      sendDemoState(frame);
    });
    if (editable) loadDemoFrame(state.activeTool);
  }

  function openQuickMaker(name, moveFocus) {
    var quickMaker = quickMakerFor(name);
    if (!quickMaker) return;
    quickMaker.open = true;
    if (moveFocus) {
      var firstControl = quickMaker.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
      if (firstControl) firstControl.focus({ preventScroll: true });
      quickMaker.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function handleResponsiveRoute() {
    updateDemoFrames();
    if (editable && usesCompactMaker()) openQuickMaker(state.activeTool, false);
  }

  function $(id) { return document.getElementById(id); }
  function copy(value) { return Core.clone(value); }
  function now() { return new Date().toISOString(); }
  function status(id, message) { $(id).textContent = message; }
  function emitChange(message) {
    document.dispatchEvent(new CustomEvent('axm:makers-change', { detail: { state: copy(state), message: message || '' } }));
  }
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }
  function downloadDataUrl(dataUrl, filename) {
    var anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  function safeFilename(value, extension) {
    return Core.slug(value).toUpperCase() + '.' + extension;
  }
  function latestArtifact(type) {
    for (var index = state.artifacts.length - 1; index >= 0; index -= 1) {
      if (state.artifacts[index].type === type) return state.artifacts[index];
    }
    return null;
  }
  function artworkData() {
    var artifact = latestArtifact('visual');
    return artifact && artifact.payload ? Core.safeDataImage(artifact.payload.dataUrl) : '';
  }
  function addArtifact(type, title, summary, payload) {
    state.artifacts.push({
      id: type + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      type: type,
      title: Core.cleanText(title, 100, 'Untitled artifact'),
      summary: Core.cleanText(summary, 320, ''),
      createdAt: now(),
      payload: payload || {}
    });
    state.artifacts = state.artifacts.slice(-16);
    state = Core.normalizeState(state);
    renderArtifacts();
    renderGameConfig();
    renderSitePreview();
    emitChange(type.charAt(0).toUpperCase() + type.slice(1) + ' artifact attached to the project.');
  }

  function selectTab(name, shouldEmit) {
    state.activeTool = ['studio', 'sfx', 'game', 'site'].indexOf(name) >= 0 ? name : 'studio';
    document.querySelectorAll('[data-maker-tab]').forEach(function (button) {
      var active = button.dataset.makerTab === state.activeTool;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-maker-panel]').forEach(function (panel) {
      var active = panel.dataset.makerPanel === state.activeTool;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    if (state.activeTool === 'studio') renderStudio();
    if (state.activeTool === 'sfx') renderWaveform();
    if (state.activeTool === 'game') drawGamePreview();
    if (state.activeTool === 'site') renderSitePreview();
    loadDemoFrame(state.activeTool);
    if (shouldEmit) emitChange();
  }

  function drawStudioCommand(command) {
    if (!command || !command.points || !command.points.length) return;
    var points = command.points;
    studioContext.save();
    studioContext.lineWidth = command.size;
    studioContext.lineCap = 'round';
    studioContext.lineJoin = 'round';
    studioContext.strokeStyle = command.type === 'eraser' ? state.studio.background : command.color;
    studioContext.fillStyle = command.color;
    if (command.type === 'brush' || command.type === 'eraser') {
      studioContext.beginPath();
      studioContext.moveTo(points[0].x, points[0].y);
      if (points.length === 1) studioContext.lineTo(points[0].x + 0.01, points[0].y + 0.01);
      for (var index = 1; index < points.length; index += 1) studioContext.lineTo(points[index].x, points[index].y);
      studioContext.stroke();
    } else {
      var first = points[0];
      var last = points[points.length - 1];
      studioContext.beginPath();
      if (command.type === 'line') {
        studioContext.moveTo(first.x, first.y);
        studioContext.lineTo(last.x, last.y);
      } else if (command.type === 'rectangle') {
        studioContext.rect(first.x, first.y, last.x - first.x, last.y - first.y);
      } else {
        var radius = Math.hypot(last.x - first.x, last.y - first.y);
        studioContext.arc(first.x, first.y, radius, 0, Math.PI * 2);
      }
      studioContext.stroke();
    }
    studioContext.restore();
  }
  function renderStudio() {
    studioContext.clearRect(0, 0, studioCanvas.width, studioCanvas.height);
    studioContext.fillStyle = state.studio.background;
    studioContext.fillRect(0, 0, studioCanvas.width, studioCanvas.height);
    state.studio.commands.forEach(drawStudioCommand);
    if (studioDraft) drawStudioCommand(studioDraft);
    document.querySelectorAll('[data-studio-tool]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.studioTool === state.studio.tool); });
    $('studioColor').value = state.studio.color;
    $('studioBackground').value = state.studio.background;
    $('studioSize').value = String(state.studio.size);
    $('studioSizeOutput').textContent = Math.round(state.studio.size) + ' px';
    $('studioUndo').disabled = !editable || !state.studio.commands.length;
  }
  function studioPoint(event) {
    var rect = studioCanvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(studioCanvas.width, (event.clientX - rect.left) * studioCanvas.width / rect.width)),
      y: Math.max(0, Math.min(studioCanvas.height, (event.clientY - rect.top) * studioCanvas.height / rect.height))
    };
  }
  function beginStudioStroke(event) {
    if (!editable || event.button > 0) return;
    event.preventDefault();
    studioPointer = event.pointerId;
    studioCanvas.setPointerCapture(event.pointerId);
    studioDraft = { type: state.studio.tool, color: state.studio.color, size: state.studio.size, points: [studioPoint(event)] };
    renderStudio();
  }
  function moveStudioStroke(event) {
    if (studioPointer !== event.pointerId || !studioDraft) return;
    event.preventDefault();
    var point = studioPoint(event);
    if (studioDraft.type === 'brush' || studioDraft.type === 'eraser') studioDraft.points.push(point);
    else studioDraft.points[1] = point;
    renderStudio();
  }
  function endStudioStroke(event) {
    if (studioPointer !== event.pointerId || !studioDraft) return;
    event.preventDefault();
    if (studioDraft.points.length === 1) studioDraft.points.push(studioPoint(event));
    state.studio.commands.push(studioDraft);
    state.studio.commands = state.studio.commands.slice(-420);
    studioDraft = null;
    studioPointer = null;
    renderStudio();
    status('studioStatus', state.studio.commands.length + ' reversible mark' + (state.studio.commands.length === 1 ? '' : 's'));
    emitChange();
  }
  function studioThumbnail() {
    var preview = document.createElement('canvas');
    preview.width = 480;
    preview.height = 270;
    preview.getContext('2d').drawImage(studioCanvas, 0, 0, preview.width, preview.height);
    var data = preview.toDataURL('image/webp', 0.76);
    if (!Core.safeDataImage(data)) data = preview.toDataURL('image/jpeg', 0.78);
    return Core.safeDataImage(data);
  }

  function sfxFromInputs() {
    return Core.normalizeSfx({
      preset: $('sfxPreset').value,
      waveform: $('sfxWave').value,
      frequency: $('sfxPitch').value,
      sweep: $('sfxSweep').value,
      duration: $('sfxDuration').value,
      volume: $('sfxVolume').value
    });
  }
  function syncSfxInputs() {
    $('sfxPreset').value = Object.prototype.hasOwnProperty.call(Core.SFX_PRESETS, state.sfx.preset) ? state.sfx.preset : 'custom';
    $('sfxWave').value = state.sfx.waveform;
    $('sfxPitch').value = String(state.sfx.frequency);
    $('sfxSweep').value = String(state.sfx.sweep);
    $('sfxDuration').value = String(state.sfx.duration);
    $('sfxVolume').value = String(state.sfx.volume);
    $('sfxPitchOutput').textContent = Math.round(state.sfx.frequency) + ' Hz';
    $('sfxSweepOutput').textContent = (state.sfx.sweep >= 0 ? '+' : '') + Math.round(state.sfx.sweep) + ' Hz';
    $('sfxDurationOutput').textContent = state.sfx.duration.toFixed(2) + ' s';
    $('sfxVolumeOutput').textContent = Math.round(state.sfx.volume * 100) + '%';
  }
  function renderWaveform() {
    syncSfxInputs();
    var canvas = $('sfxCanvas');
    var context = canvas.getContext('2d');
    var samples = Core.generateSfxSamples(state.sfx, 12000);
    context.clearRect(0, 0, canvas.width, canvas.height);
    var gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0b1425');
    gradient.addColorStop(1, '#07101c');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(151,189,224,.14)';
    context.lineWidth = 1;
    for (var grid = 1; grid < 8; grid += 1) {
      context.beginPath();
      context.moveTo(grid * canvas.width / 8, 0);
      context.lineTo(grid * canvas.width / 8, canvas.height);
      context.stroke();
    }
    context.beginPath();
    context.moveTo(0, canvas.height / 2);
    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();
    context.strokeStyle = '#6fe4ef';
    context.shadowColor = '#6fe4ef';
    context.shadowBlur = 12;
    context.lineWidth = 2;
    context.beginPath();
    for (var x = 0; x < canvas.width; x += 1) {
      var sampleIndex = Math.floor(x / canvas.width * samples.length);
      var y = canvas.height / 2 - samples[sampleIndex] * canvas.height * 0.42;
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
    context.shadowBlur = 0;
  }
  function ensureAudio() {
    var Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) return null;
    if (!audioContext) audioContext = new Constructor();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }
  function playSfx(config) {
    var context = ensureAudio();
    if (!context) { status('sfxStatus', 'This browser does not expose Web Audio'); return; }
    var samples = Core.generateSfxSamples(config, context.sampleRate);
    var buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
  }
  function updateSfx(emit) {
    state.sfx = sfxFromInputs();
    if (state.sfx.preset !== $('sfxPreset').value) state.sfx.preset = 'custom';
    renderWaveform();
    status('sfxStatus', state.sfx.waveform + ' / ' + Math.round(state.sfx.frequency) + ' Hz / ' + state.sfx.duration.toFixed(2) + ' s');
    if (emit) emitChange();
  }

  function gameConfigFromInputs() {
    return Core.normalizeGame({
      title: $('gameTitle').value,
      accent: $('gameAccent').value,
      background: $('gameBackground').value,
      speed: $('gameSpeed').value,
      goal: $('gameGoal').value,
      useArtwork: $('gameUseArtwork').checked,
      useSfx: $('gameUseSfx').checked
    });
  }
  function loadGameArtwork() {
    var data = state.game.useArtwork ? artworkData() : '';
    gameArtwork = null;
    if (!data) { drawGamePreview(); return; }
    var image = new Image();
    image.onload = function () { gameArtwork = image; drawGamePreview(); };
    image.src = data;
  }
  function renderGameConfig() {
    $('gameTitle').value = state.game.title;
    $('gameAccent').value = state.game.accent;
    $('gameBackground').value = state.game.background;
    $('gameSpeed').value = String(state.game.speed);
    $('gameGoal').value = String(state.game.goal);
    $('gameUseArtwork').checked = state.game.useArtwork;
    $('gameUseSfx').checked = state.game.useSfx;
    $('gameSpeedOutput').textContent = state.game.speed.toFixed(1) + 'x';
    $('gameGoalOutput').textContent = String(state.game.goal);
    $('gamePreviewTitle').textContent = state.game.title;
    if (!gameRuntime || !gameRuntime.running) $('gamePreviewScore').textContent = '0 / ' + state.game.goal;
    loadGameArtwork();
  }
  function updateGame(emit) {
    state.game = gameConfigFromInputs();
    renderGameConfig();
    status('gameStatus', state.game.goal + ' signals / ' + state.game.speed.toFixed(1) + 'x movement' + (artworkData() && state.game.useArtwork ? ' / Studio art linked' : ''));
    if (emit) emitChange();
  }
  function resetGameRuntime() {
    gameRuntime = { running: false, player: { x: 100, y: 280, r: 15 }, items: [], score: 0, last: 0 };
    for (var index = 0; index < state.game.goal; index += 1) gameRuntime.items.push({ x: 160 + Math.random() * 730, y: 55 + Math.random() * 450, r: 10 });
  }
  function drawGamePreview(time) {
    var canvas = $('gameCanvas');
    if (!canvas) return;
    var context = canvas.getContext('2d');
    if (!gameRuntime) resetGameRuntime();
    context.fillStyle = state.game.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (gameArtwork) {
      context.save();
      context.globalAlpha = 0.22;
      context.drawImage(gameArtwork, 0, 0, canvas.width, canvas.height);
      context.restore();
    }
    context.strokeStyle = 'rgba(255,255,255,.07)';
    for (var x = 0; x <= canvas.width; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke(); }
    for (var y = 0; y <= canvas.height; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke(); }
    gameRuntime.items.forEach(function (item, index) {
      var bob = Math.sin((time || 0) / 220 + index) * 3;
      context.save();
      context.translate(item.x, item.y + bob);
      context.rotate(Math.PI / 4);
      context.fillStyle = state.game.accent;
      context.shadowColor = state.game.accent;
      context.shadowBlur = 18;
      context.fillRect(-item.r, -item.r, item.r * 2, item.r * 2);
      context.restore();
    });
    context.fillStyle = state.game.accent;
    context.shadowColor = state.game.accent;
    context.shadowBlur = 20;
    context.beginPath();
    context.arc(gameRuntime.player.x, gameRuntime.player.y, gameRuntime.player.r, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.stroke();
  }
  function stopGame() {
    if (gameFrame) cancelAnimationFrame(gameFrame);
    gameFrame = 0;
    if (gameRuntime) gameRuntime.running = false;
  }
  function startGame() {
    stopGame();
    updateGame(false);
    resetGameRuntime();
    gameRuntime.running = true;
    gameRuntime.last = performance.now();
    $('gameOverlay').classList.add('is-running');
    $('gamePreviewScore').textContent = '0 / ' + state.game.goal;
    status('gameStatus', 'Preview active - collect every signal');
    gameFrame = requestAnimationFrame(gameLoop);
  }
  function gameLoop(time) {
    if (!gameRuntime || !gameRuntime.running) return;
    var delta = Math.min(0.04, (time - gameRuntime.last) / 1000);
    gameRuntime.last = time;
    var dx = (gameKeys.ArrowRight || gameKeys.d ? 1 : 0) - (gameKeys.ArrowLeft || gameKeys.a ? 1 : 0);
    var dy = (gameKeys.ArrowDown || gameKeys.s ? 1 : 0) - (gameKeys.ArrowUp || gameKeys.w ? 1 : 0);
    if (dx || dy) {
      var length = Math.hypot(dx, dy);
      gameRuntime.player.x = Math.max(gameRuntime.player.r, Math.min(960 - gameRuntime.player.r, gameRuntime.player.x + dx / length * 235 * state.game.speed * delta));
      gameRuntime.player.y = Math.max(gameRuntime.player.r, Math.min(560 - gameRuntime.player.r, gameRuntime.player.y + dy / length * 235 * state.game.speed * delta));
    }
    for (var index = gameRuntime.items.length - 1; index >= 0; index -= 1) {
      var item = gameRuntime.items[index];
      if (Math.hypot(gameRuntime.player.x - item.x, gameRuntime.player.y - item.y) < gameRuntime.player.r + item.r + 4) {
        gameRuntime.items.splice(index, 1);
        gameRuntime.score += 1;
        if (state.game.useSfx) playSfx(state.sfx);
        $('gamePreviewScore').textContent = gameRuntime.score + ' / ' + state.game.goal;
      }
    }
    drawGamePreview(time);
    if (gameRuntime.score >= state.game.goal) {
      gameRuntime.running = false;
      $('gameOverlay').classList.remove('is-running');
      $('gameOverlay').querySelector('span').textContent = 'LOCAL RESULT / COMPLETE';
      status('gameStatus', 'Playable proof complete - ready to download');
      return;
    }
    gameFrame = requestAnimationFrame(gameLoop);
  }

  function buildFeatureInputs() {
    var container = $('siteFeatureInputs');
    container.textContent = '';
    for (var index = 0; index < 3; index += 1) {
      var group = document.createElement('div');
      group.className = 'feature-input-group';
      var titleLabel = document.createElement('label');
      titleLabel.textContent = 'Card ' + (index + 1) + ' title';
      var titleInput = document.createElement('input');
      titleInput.maxLength = 70;
      titleInput.dataset.siteFeatureTitle = String(index);
      titleInput.dataset.makerEdit = '';
      titleLabel.appendChild(titleInput);
      var bodyLabel = document.createElement('label');
      bodyLabel.textContent = 'Card ' + (index + 1) + ' text';
      var bodyInput = document.createElement('textarea');
      bodyInput.maxLength = 240;
      bodyInput.dataset.siteFeatureBody = String(index);
      bodyInput.dataset.makerEdit = '';
      bodyLabel.appendChild(bodyInput);
      group.appendChild(titleLabel);
      group.appendChild(bodyLabel);
      container.appendChild(group);
    }
    container.addEventListener('input', function () { updateSite(true); });
  }
  function siteConfigFromInputs() {
    var features = [];
    for (var index = 0; index < 3; index += 1) {
      features.push({
        title: document.querySelector('[data-site-feature-title="' + index + '"]').value,
        body: document.querySelector('[data-site-feature-body="' + index + '"]').value
      });
    }
    return Core.normalizeSite({
      brand: $('siteBrand').value,
      eyebrow: $('siteEyebrow').value,
      headline: $('siteHeadline').value,
      body: $('siteBody').value,
      cta: $('siteCta').value,
      accent: $('siteAccent').value,
      background: $('siteBackground').value,
      theme: $('siteTheme').value,
      useArtwork: $('siteUseArtwork').checked,
      features: features
    });
  }
  function syncSiteInputs() {
    $('siteBrand').value = state.site.brand;
    $('siteEyebrow').value = state.site.eyebrow;
    $('siteHeadline').value = state.site.headline;
    $('siteBody').value = state.site.body;
    $('siteCta').value = state.site.cta;
    $('siteAccent').value = state.site.accent;
    $('siteBackground').value = state.site.background;
    $('siteTheme').value = state.site.theme;
    $('siteUseArtwork').checked = state.site.useArtwork;
    state.site.features.forEach(function (feature, index) {
      document.querySelector('[data-site-feature-title="' + index + '"]').value = feature.title;
      document.querySelector('[data-site-feature-body="' + index + '"]').value = feature.body;
    });
  }
  function renderSitePreview() {
    var preview = $('sitePreview');
    if (!preview) return;
    preview.style.setProperty('--site-accent', state.site.accent);
    preview.style.setProperty('--site-bg', state.site.background);
    preview.dataset.theme = state.site.theme;
    $('sitePreviewBrand').textContent = state.site.brand;
    $('sitePreviewEyebrow').textContent = state.site.eyebrow;
    $('sitePreviewHeadline').textContent = state.site.headline;
    $('sitePreviewBody').textContent = state.site.body;
    $('sitePreviewCta').textContent = state.site.cta;
    var art = state.site.useArtwork ? artworkData() : '';
    var artNode = $('sitePreviewArtwork');
    artNode.classList.toggle('has-art', Boolean(art));
    artNode.style.backgroundImage = art ? 'url("' + art + '")' : '';
    artNode.querySelector('b').hidden = Boolean(art);
    var features = $('sitePreviewFeatures');
    features.textContent = '';
    state.site.features.forEach(function (feature, index) {
      var article = document.createElement('article');
      var number = document.createElement('span');
      number.textContent = '0' + (index + 1);
      var title = document.createElement('b');
      title.textContent = feature.title;
      var body = document.createElement('p');
      body.textContent = feature.body;
      article.appendChild(number);
      article.appendChild(title);
      article.appendChild(body);
      features.appendChild(article);
    });
  }
  function updateSite(emit) {
    state.site = siteConfigFromInputs();
    renderSitePreview();
    status('siteStatus', state.site.theme + ' shape' + (artworkData() && state.site.useArtwork ? ' / Studio art linked' : '') + ' / standalone HTML');
    if (emit) emitChange();
  }

  function renderArtifacts() {
    var list = $('artifactList');
    list.textContent = '';
    if (!state.artifacts.length) {
      var empty = document.createElement('p');
      empty.className = 'artifact-empty';
      empty.textContent = 'Nothing attached yet. Make something, then keep its compact source or preview here.';
      list.appendChild(empty);
      return;
    }
    state.artifacts.slice().reverse().forEach(function (artifact) {
      var item = document.createElement('article');
      item.className = 'artifact-item artifact-' + artifact.type;
      var type = document.createElement('span');
      type.textContent = artifact.type.toUpperCase();
      var copyWrap = document.createElement('div');
      var title = document.createElement('b');
      title.textContent = artifact.title;
      var summary = document.createElement('small');
      summary.textContent = artifact.summary;
      copyWrap.appendChild(title);
      copyWrap.appendChild(summary);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.dataset.removeArtifact = artifact.id;
      remove.disabled = !editable;
      item.appendChild(type);
      item.appendChild(copyWrap);
      item.appendChild(remove);
      list.appendChild(item);
    });
  }

  function renderAll() {
    selectTab(state.activeTool, false);
    renderStudio();
    renderWaveform();
    renderGameConfig();
    syncSiteInputs();
    renderSitePreview();
    renderArtifacts();
    setEditable(editable);
  }
  function setEditable(value) {
    editable = Boolean(value);
    document.querySelectorAll('[data-maker-edit]').forEach(function (control) { control.disabled = !editable; });
    studioCanvas.setAttribute('aria-disabled', String(!editable));
    renderStudio();
    renderArtifacts();
    updateDemoFrames();
  }
  function loadState(input) {
    stopGame();
    state = Core.normalizeState(input);
    studioDraft = null;
    studioPointer = null;
    resetGameRuntime();
    renderAll();
  }
  function reset() { loadState(null); }

  function bind() {
    demoFrames().forEach(function (frame) {
      frame.addEventListener('load', function () { sendDemoState(frame); });
    });
    window.addEventListener('message', function (event) {
      if (event.origin !== location.origin || !event.data || event.data.type !== 'axm:demo-tool-ready') return;
      demoFrames().forEach(function (frame) { if (frame.contentWindow === event.source) sendDemoState(frame); });
    });
    document.querySelectorAll('[data-maker-tab]').forEach(function (button) {
      button.addEventListener('click', function () { selectTab(button.dataset.makerTab, true); });
    });
    document.querySelectorAll('[data-open-quick]').forEach(function (button) {
      button.addEventListener('click', function () { openQuickMaker(button.dataset.openQuick, true); });
    });
    if (compactMakerQuery.addEventListener) compactMakerQuery.addEventListener('change', handleResponsiveRoute);
    else compactMakerQuery.addListener(handleResponsiveRoute);
    document.querySelectorAll('[data-studio-tool]').forEach(function (button) {
      button.addEventListener('click', function () { if (!editable) return; state.studio.tool = button.dataset.studioTool; renderStudio(); emitChange(); });
    });
    $('studioColor').addEventListener('input', function () { state.studio.color = Core.safeColor(this.value); renderStudio(); emitChange(); });
    $('studioBackground').addEventListener('input', function () { state.studio.background = Core.safeColor(this.value, '#07111f'); renderStudio(); emitChange(); });
    $('studioSize').addEventListener('input', function () { state.studio.size = Number(this.value); renderStudio(); emitChange(); });
    $('studioUndo').addEventListener('click', function () { if (!editable || !state.studio.commands.length) return; state.studio.commands.pop(); renderStudio(); status('studioStatus', 'Last mark removed'); emitChange(); });
    $('studioClear').addEventListener('click', function () { if (!editable || !state.studio.commands.length || !window.confirm('Clear every mark from this Studio canvas?')) return; state.studio.commands = []; renderStudio(); status('studioStatus', 'Canvas cleared'); emitChange(); });
    studioCanvas.addEventListener('pointerdown', beginStudioStroke);
    studioCanvas.addEventListener('pointermove', moveStudioStroke);
    studioCanvas.addEventListener('pointerup', endStudioStroke);
    studioCanvas.addEventListener('pointercancel', function (event) { if (studioPointer !== event.pointerId) return; studioDraft = null; studioPointer = null; renderStudio(); });
    $('studioDownload').addEventListener('click', function () { downloadDataUrl(studioCanvas.toDataURL('image/png'), safeFilename('AXM Studio Art', 'png')); status('studioStatus', 'PNG prepared for download'); });
    $('studioAttach').addEventListener('click', function () {
      if (!editable) return;
      addArtifact('visual', 'Studio artwork', state.studio.commands.length + ' editable command' + (state.studio.commands.length === 1 ? '' : 's') + ' with a compact embedded preview.', { dataUrl: studioThumbnail(), commandCount: state.studio.commands.length, background: state.studio.background });
    });

    $('sfxPreset').addEventListener('change', function () { if (this.value !== 'custom') state.sfx = Core.preset(this.value); syncSfxInputs(); renderWaveform(); status('sfxStatus', this.options[this.selectedIndex].text + ' preset ready'); emitChange(); });
    ['sfxWave', 'sfxPitch', 'sfxSweep', 'sfxDuration', 'sfxVolume'].forEach(function (id) { $(id).addEventListener('input', function () { $('sfxPreset').value = 'custom'; updateSfx(true); }); });
    $('sfxPlay').addEventListener('click', function () { updateSfx(false); playSfx(state.sfx); status('sfxStatus', 'Playing locally through Web Audio'); });
    $('sfxDownload').addEventListener('click', function () { updateSfx(false); var bytes = Core.encodeWav(Core.generateSfxSamples(state.sfx, 44100), 44100); downloadBlob(new Blob([bytes], { type: 'audio/wav' }), safeFilename('AXM ' + state.sfx.preset + ' SFX', 'wav')); status('sfxStatus', 'WAV prepared for download'); });
    $('sfxAttach').addEventListener('click', function () { if (!editable) return; updateSfx(false); addArtifact('sfx', state.sfx.preset === 'custom' ? 'Custom SFX recipe' : state.sfx.preset + ' SFX', state.sfx.waveform + ' from ' + Math.round(state.sfx.frequency) + ' Hz for ' + state.sfx.duration.toFixed(2) + ' seconds.', { recipe: copy(state.sfx) }); });

    ['gameTitle', 'gameAccent', 'gameBackground', 'gameSpeed', 'gameGoal', 'gameUseArtwork', 'gameUseSfx'].forEach(function (id) { $(id).addEventListener('input', function () { stopGame(); updateGame(true); }); });
    $('gamePlay').addEventListener('click', startGame);
    $('gameDownload').addEventListener('click', function () { updateGame(false); var html = Core.generateGameHtml(state.game, { artworkData: artworkData(), sfx: state.sfx }); downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), safeFilename(state.game.title, 'html')); status('gameStatus', 'Standalone game HTML prepared for download'); });
    $('gameAttach').addEventListener('click', function () { if (!editable) return; updateGame(false); addArtifact('game', state.game.title, 'Playable local game shape with ' + state.game.goal + ' signals and ' + state.game.speed.toFixed(1) + 'x movement.', { config: copy(state.game), usesVisualArtifact: Boolean(artworkData() && state.game.useArtwork), usesSfxRecipe: state.game.useSfx }); });
    window.addEventListener('keydown', function (event) { var key = event.key.length === 1 ? event.key.toLowerCase() : event.key; gameKeys[key] = true; if (gameRuntime && gameRuntime.running && key.indexOf('Arrow') === 0) event.preventDefault(); });
    window.addEventListener('keyup', function (event) { gameKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false; });
    document.querySelectorAll('[data-game-key]').forEach(function (button) {
      var map = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
      var key = map[button.dataset.gameKey];
      button.addEventListener('pointerdown', function (event) { event.preventDefault(); gameKeys[key] = true; button.setPointerCapture(event.pointerId); });
      button.addEventListener('pointerup', function () { gameKeys[key] = false; });
      button.addEventListener('pointercancel', function () { gameKeys[key] = false; });
    });

    buildFeatureInputs();
    ['siteBrand', 'siteEyebrow', 'siteHeadline', 'siteBody', 'siteCta', 'siteAccent', 'siteBackground', 'siteTheme', 'siteUseArtwork'].forEach(function (id) { $(id).addEventListener('input', function () { updateSite(true); }); });
    $('siteDownload').addEventListener('click', function () { updateSite(false); var html = Core.generateWebsiteHtml(state.site, { artworkData: artworkData() }); downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), safeFilename(state.site.brand + ' website', 'html')); status('siteStatus', 'Hostable one-page HTML prepared for download'); });
    $('siteAttach').addEventListener('click', function () { if (!editable) return; updateSite(false); addArtifact('website', state.site.brand + ' one-page website', state.site.theme + ' shape with three feature cards and one portable HTML output.', { config: copy(state.site), usesVisualArtifact: Boolean(artworkData() && state.site.useArtwork) }); });

    $('artifactList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-artifact]');
      if (!button || !editable) return;
      state.artifacts = state.artifacts.filter(function (artifact) { return artifact.id !== button.dataset.removeArtifact; });
      renderArtifacts();
      renderGameConfig();
      renderSitePreview();
      emitChange('Artifact removed from this project record. Downloaded files were not touched.');
    });
  }

  window.AXMGuestMakers = {
    getState: function () { return copy(state); },
    loadState: loadState,
    reset: reset,
    setEditable: setEditable,
    getArtifacts: function () { return copy(state.artifacts); }
  };

  bind();
  var requestedTool = new URLSearchParams(location.search).get('tool');
  var publicToolRoutes = { studio: 'studio', 'audio-studio': 'sfx', sfx: 'sfx', 'game-forge': 'game', game: 'game', 'shapeable-builder': 'site', site: 'site' };
  if (publicToolRoutes[requestedTool]) state.activeTool = publicToolRoutes[requestedTool];
  resetGameRuntime();
  renderAll();
}());
