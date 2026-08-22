(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var rawPlayer = params.get('player') || '';
  var player = /^p[12]$/.test(rawPlayer) ? rawPlayer : 'screen';
  var base = location.pathname.indexOf('/games/002') === 0 ? '/games/002' : '';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var state = null;
  var lastPacket = 0;
  var lastEventAt = 0;
  var trail = [];
  var inputs = { p1: { left: false, right: false }, p2: { left: false, right: false } };
  var mapImages = {};
  var visuals = null;
  var lighting = null;
  var toastTimer = null;

  var connection = document.getElementById('connection');
  var modeLabel = document.getElementById('modeLabel');
  var chapterLabel = document.getElementById('chapterLabel');
  var objectiveLabel = document.getElementById('objectiveLabel');
  var pauseButton = document.getElementById('pauseButton');
  var launchPanel = document.getElementById('launchPanel');
  var launchEyebrow = document.getElementById('launchEyebrow');
  var launchTitle = document.getElementById('launchTitle');
  var launchCopy = document.getElementById('launchCopy');
  var arenaPicker = document.getElementById('arenaPicker');
  var startButton = document.getElementById('startButton');
  var nextButton = document.getElementById('nextButton');
  var seatNote = document.getElementById('seatNote');
  var eventToast = document.getElementById('eventToast');
  var missionObjective = document.getElementById('missionObjective');
  var progressFill = document.getElementById('progressFill');
  var metricLabel = document.getElementById('metricLabel');
  var metricValue = document.getElementById('metricValue');
  var arenaLabel = document.getElementById('arenaLabel');
  var controls = document.getElementById('controls');
  var leftButton = document.getElementById('leftButton');
  var rightButton = document.getElementById('rightButton');
  var powerButton = document.getElementById('powerButton');
  var controllerPanel = document.getElementById('controllerPanel');
  var controllerSeat = document.getElementById('controllerSeat');
  var controllerName = document.getElementById('controllerName');
  var controllerStatus = document.getElementById('controllerStatus');
  var controllerMissionLabel = document.getElementById('controllerMissionLabel');
  var controllerMissionValue = document.getElementById('controllerMissionValue');
  var powerName = document.getElementById('powerName');
  var powerState = document.getElementById('powerState');

  if (player !== 'screen') {
    document.body.classList.add('player-view');
    controls.hidden = false;
    controllerPanel.hidden = false;
  }

  function api(path) { return base + path; }
  function post(path, body) {
    return fetch(api(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (response) { return response.json().then(function (json) { if (!response.ok) throw new Error(json.error || ('HTTP ' + response.status)); return json; }); });
  }
  function arena() {
    if (!state || !state.arenas) return null;
    return state.arenas.find(function (item) { return item.id === state.arenaId; }) || state.arenas[0];
  }
  function mapUrl(item) { return api('/assets/maps/' + item.background); }
  function ensureMapImages() {
    if (!state || !state.arenas) return;
    state.arenas.forEach(function (item) {
      if (mapImages[item.id]) return;
      var image = new Image();
      image.decoding = 'async';
      image.src = mapUrl(item);
      mapImages[item.id] = image;
    });
  }
  function mountAetherglass() {
    try {
      if (!window.AXMVisualEngine || visuals) return;
      visuals = window.AXMVisualEngine.mount({ root: document.body, applyToDocument: true, theme: 'aether', atmosphere: 'eclipse', material: 'obsidian', depth: 'deep', luminosity: 'balanced', density: 'comfortable', shape: 'precise', transparency: 'auto', contrast: 'auto', quality: 'auto', motion: 'auto', intensity: 0.82, pointerLighting: false, reactivePanels: false, parallax: false, trackScroll: false, persist: false });
      if (window.AXMLightingDirector) {
        lighting = new window.AXMLightingDirector(visuals, { maxLights: 5, overflow: 'reject' });
        lighting.bind('#arenaShell', { group: 'arena', color: 'var(--cyan)', strength: 0.18, scaleToTarget: true, targetScale: 1.5, kind: 'ambient' });
        lighting.bind('.brand', { group: 'interface', color: 'var(--cyan)', strength: 0.12, scaleToTarget: true, targetScale: 2, kind: 'ambient' });
      }
    } catch (error) {
      visuals = null;
      lighting = null;
    }
  }
  function pulse(color, strength) {
    if (!lighting || !lighting.pulseAt) return;
    try { lighting.pulseAt('#arenaShell', { color: color, strength: strength || 0.5, size: 780, duration: 620 }); } catch (error) {}
  }
  function showToast(text) {
    if (!text) return;
    eventToast.textContent = text;
    eventToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { eventToast.classList.remove('show'); }, 1100);
  }
  function accept(next) {
    state = next;
    lastPacket = Date.now();
    connection.textContent = 'LIVE · AXM1';
    connection.style.color = '#69dc9a';
    ensureMapImages();
    updateUi();
    if (next.eventAt && next.eventAt !== lastEventAt) {
      lastEventAt = next.eventAt;
      showToast(next.event);
      var color = /CORE|LOST|WARDEN/i.test(next.event || '') ? '#f2877f' : /SEALED|LIGHT|RELAY/i.test(next.event || '') ? '#69dc9a' : '#46d7e7';
      pulse(color, /SEALED|WINS/i.test(next.event || '') ? 0.72 : 0.42);
    }
  }
  function renderArenaPicker() {
    if (!state || !state.arenas) return;
    arenaPicker.innerHTML = '';
    state.arenas.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'arena-choice' + (item.id === state.arenaId ? ' selected' : '');
      var strong = document.createElement('strong');
      strong.textContent = item.label.toUpperCase();
      var small = document.createElement('small');
      small.textContent = item.chapter + ' · ' + item.target + ' CHARGE';
      button.append(strong, small);
      button.onclick = function () {
        button.disabled = true;
        post('/arena', { arenaId: item.id }).then(function (result) { accept(result.state); pulse(item.accent, 0.55); }).catch(function (error) { connection.textContent = error.message; }).finally(function () { button.disabled = false; });
      };
      arenaPicker.appendChild(button);
    });
  }
  function updateUi() {
    if (!state) return;
    var item = arena();
    var coop = state.playMode === 'story-coop';
    modeLabel.textContent = coop ? 'STORY CO-OP' : '1V1 VERSUS';
    modeLabel.style.color = coop ? '#69dc9a' : '#f0bd63';
    chapterLabel.textContent = coop ? item.chapter : 'LOCAL MULTIPLAYER';
    objectiveLabel.textContent = coop ? item.objective : 'FIRST TO ' + state.winScore;
    missionObjective.textContent = coop ? item.objective : state.players.p1.name + ' VS ' + state.players.p2.name;
    arenaLabel.textContent = item.label.toUpperCase();
    pauseButton.textContent = state.phase === 'paused' ? 'RESUME' : 'PAUSE';
    pauseButton.disabled = state.phase !== 'running' && state.phase !== 'paused';
    if (coop) {
      progressFill.style.width = Math.min(100, state.mission.charge / state.mission.target * 100) + '%';
      metricLabel.textContent = 'CORE';
      metricValue.textContent = state.mission.core + ' / ' + state.mission.coreMax;
    } else {
      progressFill.style.width = Math.max(state.scores.p1, state.scores.p2) / state.winScore * 100 + '%';
      metricLabel.textContent = 'SCORE';
      metricValue.textContent = state.scores.p1 + ' · ' + state.scores.p2;
    }
    launchPanel.hidden = state.phase === 'running' || state.phase === 'paused';
    launchEyebrow.textContent = coop ? '1–2 PLAYER STORY / CO-OP' : '2 PLAYER LOCAL MULTIPLAYER';
    launchTitle.textContent = state.phase === 'gameover' ? (state.outcome === 'victory' ? 'LIGHT RESTORED' : state.outcome === 'defeat' ? 'THE CORE FELL' : 'MATCH COMPLETE') : item.objective;
    launchCopy.textContent = coop ? (state.phase === 'gameover' ? (state.outcome === 'victory' ? 'The breach is sealed. Carry the light into the next arena.' : 'The Warden broke the line. Rebuild the relay and try again.') : 'Protect the core together. One player gets an AI wingmate; two players share the defense.') : (state.phase === 'gameover' ? state.players[state.winner].name + ' takes the arena.' : 'Two seats, one ball, first to seven. Every return bends the light.');
    startButton.textContent = state.phase === 'gameover' ? 'REMATCH' : 'ENTER ARENA';
    nextButton.hidden = !(coop && state.phase === 'gameover' && state.outcome === 'victory');
    seatNote.textContent = 'P1 keyboard: A / D · P2 keyboard: arrows · Space / Enter uses power';
    renderArenaPicker();
    if (player !== 'screen') updateController(coop);
  }
  function updateController(coop) {
    var mine = state.players[player];
    var power = state.power[player];
    var seconds = Math.ceil((power && power.readyIn || 0) / 1000);
    controllerSeat.textContent = player.toUpperCase() + ' · ' + (coop ? 'DUET' : 'VERSUS');
    controllerName.textContent = mine.name.toUpperCase();
    controllerStatus.textContent = state.phase.toUpperCase();
    controllerMissionLabel.textContent = coop ? 'CORE / RELAY' : 'SCORE';
    controllerMissionValue.textContent = coop ? state.mission.core + ' CORE · ' + state.mission.charge + '/' + state.mission.target : state.scores.p1 + ' · ' + state.scores.p2;
    powerName.textContent = power && (power.activeLabel || power.label) || 'RANDOM SPECIAL';
    powerState.textContent = state.phase !== 'running' ? 'WAITING FOR MATCH' : power && power.active ? 'ACTIVE' : seconds ? 'RECHARGING · ' + seconds + 's' : 'READY · TAP USE POWER';
    powerButton.disabled = state.phase !== 'running' || seconds > 0;
    powerButton.style.color = power && power.color || '#ff3dd8';
  }
  function connect() {
    var events = new EventSource(api('/events?room=AXM1'));
    events.onmessage = function (event) { try { accept(JSON.parse(event.data)); } catch (error) {} };
    events.onerror = function () { connection.textContent = 'RECONNECTING'; connection.style.color = '#f0bd63'; };
    fetch(api('/state?room=AXM1')).then(function (response) { return response.json(); }).then(accept).catch(function () {});
    setInterval(function () {
      if (Date.now() - lastPacket < 1800) return;
      fetch(api('/state?room=AXM1')).then(function (response) { return response.json(); }).then(accept).catch(function () { connection.textContent = 'OFFLINE'; connection.style.color = '#f2877f'; });
    }, 1200);
  }
  function sendInput(target, extra) {
    if (target === 'screen') return;
    var packet = { left: inputs[target].left, right: inputs[target].right };
    if (extra && extra.power) packet.power = true;
    post('/input?room=AXM1&player=' + target, packet).catch(function (error) { if (!/adapter-controlled/.test(error.message)) connection.textContent = 'INPUT · ' + error.message; });
  }
  function setHeld(target, key, value, button) {
    if (!inputs[target] || inputs[target][key] === value) return;
    inputs[target][key] = value;
    if (button) button.classList.toggle('held', value);
    sendInput(target);
  }
  function bindHold(button, key) {
    function down(event) { event.preventDefault(); try { button.setPointerCapture(event.pointerId); } catch (error) {} setHeld(player, key, true, button); }
    function up(event) { event.preventDefault(); setHeld(player, key, false, button); }
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
  }
  bindHold(leftButton, 'left');
  bindHold(rightButton, 'right');
  powerButton.onclick = function () { sendInput(player, { power: true }); };
  startButton.onclick = function () { startButton.disabled = true; post(state && state.phase === 'gameover' ? '/reset' : '/start').then(function (result) { accept(result.state); }).catch(function (error) { connection.textContent = error.message; }).finally(function () { startButton.disabled = false; }); };
  nextButton.onclick = function () { nextButton.disabled = true; post('/next-arena').then(function (result) { accept(result.state); }).catch(function (error) { connection.textContent = error.message; }).finally(function () { nextButton.disabled = false; }); };
  pauseButton.onclick = function () { post('/pause').then(function (result) { accept(result.state); }).catch(function (error) { connection.textContent = error.message; }); };

  function keyRoute(key) {
    if (key === 'a' || key === 'd') return { player: 'p1', key: key === 'a' ? 'left' : 'right' };
    if (key === 'arrowleft' || key === 'arrowright') return { player: 'p2', key: key === 'arrowleft' ? 'left' : 'right' };
    return null;
  }
  addEventListener('keydown', function (event) {
    var key = event.key.toLowerCase();
    var route = keyRoute(key);
    if (route) { event.preventDefault(); setHeld(route.player, route.key, true); }
    if (key === ' ') { event.preventDefault(); sendInput(player === 'p2' ? 'p2' : 'p1', { power: true }); }
    if (key === 'enter') { event.preventDefault(); sendInput('p2', { power: true }); }
    if (key === 'escape' && state && (state.phase === 'running' || state.phase === 'paused')) pauseButton.click();
  });
  addEventListener('keyup', function (event) {
    var route = keyRoute(event.key.toLowerCase());
    if (route) setHeld(route.player, route.key, false);
  });
  addEventListener('blur', function () {
    ['p1', 'p2'].forEach(function (id) { inputs[id].left = false; inputs[id].right = false; sendInput(id); });
  });

  function drawCover(image) {
    if (!image || !image.complete || !image.naturalWidth) { ctx.fillStyle = '#050914'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    var sourceRatio = image.naturalWidth / image.naturalHeight;
    var targetRatio = canvas.width / canvas.height;
    var sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
    if (sourceRatio > targetRatio) { sw = image.naturalHeight * targetRatio; sx = (image.naturalWidth - sw) / 2; }
    else { sh = image.naturalWidth / targetRatio; sy = (image.naturalHeight - sh) / 2; }
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(1,5,12,.16)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  function roundRect(x, y, width, height, radius) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); }
  function drawPaddle(paddle, color, active, label) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 32 : 18;
    ctx.fillStyle = 'rgba(4,10,18,.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 7 : 4;
    roundRect(paddle.x - paddle.width / 2, paddle.y - paddle.height / 2, paddle.width, paddle.height, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    roundRect(paddle.x - paddle.width * 0.22, paddle.y - 3, paddle.width * 0.44, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#edf6ff';
    ctx.textAlign = 'center';
    ctx.font = '700 11px "Cascadia Mono", Consolas, monospace';
    ctx.fillText(label, paddle.x, paddle.y - 22);
    ctx.restore();
  }
  function drawTrail() {
    if (!state) return;
    trail.unshift({ x: state.ball.x, y: state.ball.y });
    if (trail.length > 14) trail.pop();
    ctx.save();
    for (var index = trail.length - 1; index >= 0; index -= 1) {
      var point = trail[index];
      var alpha = (trail.length - index) / trail.length * 0.22;
      ctx.fillStyle = 'rgba(70,215,231,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(2, state.ball.radius * (1 - index / trail.length) * 0.58), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawBall(ball) {
    drawTrail();
    ctx.save();
    ctx.fillStyle = '#edf6ff';
    ctx.strokeStyle = '#46d7e7';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#46d7e7';
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function drawHud() {
    if (!state) return;
    var coop = state.playMode === 'story-coop';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 14px "Cascadia Mono", Consolas, monospace';
    ctx.fillStyle = '#46d7e7';
    ctx.fillText(state.players.p1.name.toUpperCase(), coop ? state.paddles.p1.x : 205, 770);
    ctx.fillStyle = '#ff3dd8';
    ctx.fillText(state.players.p2.name.toUpperCase(), coop ? state.paddles.p2.x : 995, coop ? 770 : 34);
    if (coop) {
      ctx.fillStyle = '#f0bd63';
      ctx.fillText('WARDEN · WAVE ' + state.mission.wave, state.paddles.warden.x, 32);
      ctx.fillStyle = '#69dc9a';
      ctx.font = '700 18px "Cascadia Mono", Consolas, monospace';
      ctx.fillText('RELAY ' + state.mission.charge + ' / ' + state.mission.target, 600, 410);
    } else {
      ctx.font = '700 54px "Cascadia Mono", Consolas, monospace';
      ctx.fillStyle = '#46d7e7';
      ctx.fillText(state.scores.p1, 120, 425);
      ctx.fillStyle = '#ff3dd8';
      ctx.fillText(state.scores.p2, 1080, 425);
    }
    ctx.restore();
  }
  function render() {
    var image = state ? mapImages[state.arenaId] : null;
    drawCover(image);
    if (state && state.effects && state.effects.slowField) { ctx.fillStyle = 'rgba(73,107,219,.12)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (state) {
      if (state.playMode === 'story-coop') drawPaddle(state.paddles.warden, '#f0bd63', false, 'WARDEN');
      drawPaddle(state.paddles.p1, state.players.p1.color, state.power.p1.active, 'P1');
      drawPaddle(state.paddles.p2, state.players.p2.color, state.power.p2.active, 'P2');
      drawBall(state.ball);
      drawHud();
    } else {
      ctx.fillStyle = '#91a8bb';
      ctx.textAlign = 'center';
      ctx.font = '700 18px "Cascadia Mono", Consolas, monospace';
      ctx.fillText('CONNECTING TO AXM1', canvas.width / 2, canvas.height / 2);
    }
    requestAnimationFrame(render);
  }

  mountAetherglass();
  connect();
  render();
})();
