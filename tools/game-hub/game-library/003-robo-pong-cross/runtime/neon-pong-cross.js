(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var bindingParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  var rawPlayer = params.get('player') || '';
  var player = /^p[1-4]$/.test(rawPlayer) ? rawPlayer : 'screen';
  var seatId = bindingParams.get('seat') || '';
  var seatToken = bindingParams.get('token') || '';
  var inputSequence = 0;
  var inputChain = Promise.resolve();
  var base = location.pathname.indexOf('/games/003') === 0 ? '/games/003' : '';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var state = null;
  var lastPacket = 0;
  var lastEventAt = 0;
  var mapImages = {};
  var trails = {};
  var inputs = { p1: { left: false, right: false }, p2: { left: false, right: false }, p3: { left: false, right: false }, p4: { left: false, right: false } };
  var visuals = null;
  var lighting = null;
  var toastTimer = null;

  var connection = document.getElementById('connection');
  var modeLabel = document.getElementById('modeLabel');
  var playerCountLabel = document.getElementById('playerCountLabel');
  var objectiveLabel = document.getElementById('objectiveLabel');
  var pauseButton = document.getElementById('pauseButton');
  var launchPanel = document.getElementById('launchPanel');
  var launchEyebrow = document.getElementById('launchEyebrow');
  var launchTitle = document.getElementById('launchTitle');
  var launchCopy = document.getElementById('launchCopy');
  var arenaPicker = document.getElementById('arenaPicker');
  var startButton = document.getElementById('startButton');
  var eventToast = document.getElementById('eventToast');
  var missionKicker = document.getElementById('missionKicker');
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
  var scoreStrip = document.getElementById('scoreStrip');
  var powerName = document.getElementById('powerName');
  var powerState = document.getElementById('powerState');
  var directionHint = document.getElementById('directionHint');

  if (player !== 'screen') {
    document.body.classList.add('player-view');
    controls.hidden = false;
    controllerPanel.hidden = false;
    setupControllerCache();
  }

  function api(path) { return base + path; }
  function post(path, body) {
    return fetch(api(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (response) { return response.json().then(function (json) { if (!response.ok) { var error = new Error(json.error || json.reason || ('HTTP ' + response.status)); error.data = json; throw error; } return json; }); });
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
  function setupControllerCache() {
    if (!('serviceWorker' in navigator) || !isSecureContext) return;
    navigator.serviceWorker.register(api('/controller-sw.js'), { scope: api('/') }).catch(function () {});
  }
  function mountAetherglass() {
    try {
      if (!window.AXMVisualEngine || visuals) return;
      visuals = window.AXMVisualEngine.mount({ root: document.body, applyToDocument: true, theme: 'aether', atmosphere: 'eclipse', material: 'obsidian', depth: 'deep', luminosity: 'balanced', density: 'comfortable', shape: 'precise', transparency: 'auto', contrast: 'auto', quality: 'auto', motion: 'auto', intensity: 0.82, pointerLighting: false, reactivePanels: false, parallax: false, trackScroll: false, persist: false });
      if (window.AXMLightingDirector) {
        lighting = new window.AXMLightingDirector(visuals, { maxLights: 5, overflow: 'reject' });
        lighting.bind('#arenaShell', { group: 'arena', color: 'var(--cyan)', strength: 0.18, scaleToTarget: true, targetScale: 1.55, kind: 'ambient' });
        lighting.bind('.brand', { group: 'interface', color: 'var(--cyan)', strength: 0.12, scaleToTarget: true, targetScale: 2, kind: 'ambient' });
      }
    } catch (error) { visuals = null; lighting = null; }
  }
  function pulse(color, strength) {
    if (!lighting || !lighting.pulseAt) return;
    try { lighting.pulseAt('#arenaShell', { color: color, strength: strength || 0.5, size: 820, duration: 650 }); } catch (error) {}
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
    connection.textContent = 'LIVE · ' + next.seatCount + ' SEATS';
    connection.style.color = '#69dc9a';
    ensureMapImages();
    updateUi();
    if (next.eventAt && next.eventAt !== lastEventAt) {
      lastEventAt = next.eventAt;
      showToast(next.event);
      var color = /LOST|ELIMINATED|WARDEN/i.test(next.event || '') ? '#f2877f' : /RELAY|CORE BALL|WINS|COMPLETE/i.test(next.event || '') ? '#69dc9a' : '#46d7e7';
      pulse(color, /WINS|COMPLETE/i.test(next.event || '') ? 0.72 : 0.42);
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
      small.textContent = item.objective;
      button.append(strong, small);
      button.onclick = function () {
        button.disabled = true;
        post('/arena', { arenaId: item.id }).then(function (result) { accept(result.state); pulse(item.accent, 0.55); }).catch(function (error) { connection.textContent = error.message; }).finally(function () { button.disabled = false; });
      };
      arenaPicker.appendChild(button);
    });
  }
  function aliveCount() { return Object.keys(state.players).filter(function (id) { return state.players[id].participant && state.players[id].alive; }).length; }
  function updateUi() {
    if (!state) return;
    var item = arena();
    var coop = state.playMode === 'coop';
    var alive = aliveCount();
    modeLabel.textContent = coop ? 'CO-OP SURVIVAL' : 'MULTIPLAYER';
    modeLabel.style.color = coop ? '#69dc9a' : '#f0bd63';
    playerCountLabel.textContent = state.seatCount + ' PLAYER';
    objectiveLabel.textContent = item.label.toUpperCase();
    arenaLabel.textContent = item.label.toUpperCase();
    pauseButton.textContent = state.phase === 'paused' ? 'RESUME' : 'PAUSE';
    pauseButton.disabled = state.phase !== 'running' && state.phase !== 'paused';
    if (coop) {
      missionKicker.textContent = 'CO-OP OBJECTIVE';
      missionObjective.textContent = item.objective;
      progressFill.style.width = (1 - state.mission.boss / state.mission.bossMax) * 100 + '%';
      metricLabel.textContent = 'CORE / WARDEN';
      metricValue.textContent = state.mission.core + ' / ' + state.mission.boss;
    } else {
      missionKicker.textContent = 'MATCH';
      missionObjective.textContent = 'LAST LIGHT STANDING';
      progressFill.style.width = (state.seatCount - alive) / Math.max(1, state.seatCount - 1) * 100 + '%';
      metricLabel.textContent = 'ALIVE';
      metricValue.textContent = alive + ' / ' + state.seatCount;
    }
    launchPanel.hidden = state.phase === 'running' || state.phase === 'paused';
    launchEyebrow.textContent = state.seatCount + ' PLAYER ' + (coop ? 'CO-OP SURVIVAL' : 'MULTIPLAYER');
    launchTitle.textContent = state.phase === 'gameover' ? (coop ? (state.outcome === 'victory' ? 'RELAY COMPLETE' : 'THE CORE FELL') : (state.winner ? state.players[state.winner].name + ' WINS' : 'DRAW')) : item.label.toUpperCase();
    launchCopy.textContent = coop ? (state.phase === 'gameover' ? (state.outcome === 'victory' ? 'The team broke the Warden. Run it again or choose a new arena.' : 'The light escaped the perimeter. Rebuild the relay and try again.') : 'Pass the light between different players to arm the relay, then strike the central Warden core.') : (state.phase === 'gameover' ? 'The arena is sealed. Rematch with the same seats or choose another map.' : 'Every active edge is a seat. Missing the light costs a life; the final player standing owns the arena.');
    startButton.textContent = state.phase === 'gameover' ? 'REMATCH' : 'START CROSS MATCH';
    renderArenaPicker();
    if (player !== 'screen') updateController(coop);
  }
  function updateController(coop) {
    var mine = state.players[player];
    var power = state.power[player];
    var seconds = Math.ceil((power && power.readyIn || 0) / 1000);
    controllerSeat.textContent = player.toUpperCase() + ' · ' + mine.side.toUpperCase();
    controllerName.textContent = mine.name.toUpperCase();
    controllerStatus.textContent = !mine.participant ? 'SEALED EDGE' : state.phase.toUpperCase();
    scoreStrip.innerHTML = '';
    ['p1', 'p2', 'p3', 'p4'].forEach(function (id) {
      var chip = document.createElement('div');
      chip.className = 'score-chip' + (id === player ? ' current' : '') + (!state.players[id].alive ? ' out' : '');
      chip.textContent = id.toUpperCase() + ' · ' + (coop ? (state.players[id].role === 'warden' ? 'WARDEN' : state.players[id].name) : state.lives[id]);
      chip.style.borderColor = id === player ? mine.color : '';
      scoreStrip.appendChild(chip);
    });
    powerName.textContent = power && (power.activeLabel || power.label) || 'RANDOM SPECIAL';
    powerName.style.color = power && power.color || '#ff3dd8';
    powerState.textContent = !mine.participant ? 'THIS EDGE IS SEALED' : state.phase !== 'running' ? 'WAITING FOR MATCH' : power && power.active ? 'ACTIVE' : seconds ? 'RECHARGING · ' + seconds + 's' : 'READY · TAP USE POWER';
    powerButton.disabled = !mine.participant || state.phase !== 'running' || seconds > 0;
    powerButton.style.color = power && power.color || '#ff3dd8';
    var vertical = mine.side === 'left' || mine.side === 'right';
    leftButton.textContent = vertical ? 'UP' : 'LEFT';
    rightButton.textContent = vertical ? 'DOWN' : 'RIGHT';
    directionHint.textContent = coop ? 'Build a relay with different players. Your edge is part of one shared core.' : 'Move along your edge. Tap power when it lights.';
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
    function report(error) {
      if (error.data && Number.isInteger(error.data.nextSequenceMinimum)) inputSequence = error.data.nextSequenceMinimum;
      if (!/not a human participant|legacy-controller-human-only|stale-sequence/.test(error.message)) connection.textContent = 'INPUT · ' + error.message;
    }
    if (seatId && seatToken) {
      var intent = { axis: (packet.right ? 1 : 0) - (packet.left ? 1 : 0), power: packet.power === true };
      inputChain = inputChain.then(function () {
        return post('/api/input', { roomCode: 'AXM1', seatId: seatId, token: seatToken, sequence: inputSequence, intent: intent });
      }).then(function (result) {
        inputSequence = Number(result.nextSequenceMinimum || inputSequence + 1);
      }).catch(report);
      return;
    }
    post('/input?room=AXM1&player=' + target, packet).catch(report);
  }
  setInterval(function () { if (player !== 'screen') sendInput(player); }, 750);
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
  pauseButton.onclick = function () { post('/pause').then(function (result) { accept(result.state); }).catch(function (error) { connection.textContent = error.message; }); };

  function keyRoute(key) {
    var routes = {
      a: { player: 'p1', key: 'left' }, d: { player: 'p1', key: 'right' },
      j: { player: 'p2', key: 'left' }, l: { player: 'p2', key: 'right' },
      w: { player: 'p3', key: 'left' }, s: { player: 'p3', key: 'right' },
      arrowup: { player: 'p4', key: 'left' }, arrowdown: { player: 'p4', key: 'right' }
    };
    return routes[key] || null;
  }
  addEventListener('keydown', function (event) {
    var key = event.key.toLowerCase();
    var route = keyRoute(key);
    if (route) { event.preventDefault(); setHeld(route.player, route.key, true); }
    if (key === '1' || key === '2' || key === '3' || key === '4') sendInput('p' + key, { power: true });
    if (key === ' ' && player !== 'screen') { event.preventDefault(); sendInput(player, { power: true }); }
    if (key === 'escape' && state && (state.phase === 'running' || state.phase === 'paused')) pauseButton.click();
  });
  addEventListener('keyup', function (event) {
    var route = keyRoute(event.key.toLowerCase());
    if (route) setHeld(route.player, route.key, false);
  });
  addEventListener('blur', function () {
    ['p1', 'p2', 'p3', 'p4'].forEach(function (id) { inputs[id].left = false; inputs[id].right = false; sendInput(id); });
  });

  function drawCover(image) {
    if (!image || !image.complete || !image.naturalWidth) { ctx.fillStyle = '#050914'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    var sourceRatio = image.naturalWidth / image.naturalHeight;
    var targetRatio = 1;
    var sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
    if (sourceRatio > targetRatio) { sw = image.naturalHeight; sx = (image.naturalWidth - sw) / 2; }
    else { sh = image.naturalWidth; sy = (image.naturalHeight - sh) / 2; }
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 1000, 1000);
    ctx.fillStyle = 'rgba(1,5,12,.12)';
    ctx.fillRect(0, 0, 1000, 1000);
  }
  function roundRect(x, y, width, height, radius) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); }
  function drawPaddle(paddle, color, active, alive, role) {
    if (!alive) return;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 30 : 17;
    ctx.fillStyle = 'rgba(4,10,18,.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = role === 'warden' ? 7 : active ? 6 : 4;
    if (paddle.horizontal) roundRect(paddle.x - paddle.length / 2, paddle.y - paddle.thickness / 2, paddle.length, paddle.thickness, 7);
    else roundRect(paddle.x - paddle.thickness / 2, paddle.y - paddle.length / 2, paddle.thickness, paddle.length, 7);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    if (paddle.horizontal) { roundRect(paddle.x - paddle.length * .2, paddle.y - 3, paddle.length * .4, 6, 3); ctx.fill(); }
    else { roundRect(paddle.x - 3, paddle.y - paddle.length * .2, 6, paddle.length * .4, 3); ctx.fill(); }
    ctx.restore();
  }
  function drawDiamond() {
    if (!state) return;
    var radius = state.diamond.radius;
    var color = state.playMode === 'coop' && state.mission.relayArmed ? '#69dc9a' : '#f2877f';
    ctx.save();
    ctx.translate(500, 500);
    ctx.rotate(Math.PI / 4 + state.diamond.angle);
    ctx.fillStyle = 'rgba(6,13,24,.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.shadowColor = color;
    ctx.shadowBlur = state.playMode === 'coop' && state.mission.relayArmed ? 34 : 18;
    ctx.fillRect(-radius / Math.SQRT2, -radius / Math.SQRT2, radius * Math.SQRT2, radius * Math.SQRT2);
    ctx.strokeRect(-radius / Math.SQRT2, -radius / Math.SQRT2, radius * Math.SQRT2, radius * Math.SQRT2);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '700 12px "Cascadia Mono", Consolas, monospace';
    ctx.fillText(state.playMode === 'coop' ? (state.mission.relayArmed ? 'RELAY ARMED' : 'WARDEN') : 'PRISM', 500, 505);
    ctx.restore();
  }
  function drawTrail(ball, index) {
    var color = index === 0 ? '70,215,231' : '240,189,99';
    trails[ball.id] = trails[ball.id] || [];
    trails[ball.id].unshift({ x: ball.x, y: ball.y });
    if (trails[ball.id].length > 12) trails[ball.id].pop();
    ctx.save();
    trails[ball.id].forEach(function (point, pointIndex) {
      var alpha = (trails[ball.id].length - pointIndex) / trails[ball.id].length * .18;
      ctx.fillStyle = 'rgba(' + color + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(2, ball.radius * (1 - pointIndex / trails[ball.id].length) * .5), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  function drawBall(ball, index) {
    drawTrail(ball, index);
    var glow = index === 0 ? '#46d7e7' : '#f0bd63';
    ctx.save();
    ctx.fillStyle = '#edf6ff';
    ctx.strokeStyle = glow;
    ctx.lineWidth = 4;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function drawSealedEdges() {
    if (!state) return;
    ctx.save();
    ctx.strokeStyle = '#394958';
    ctx.lineWidth = 8;
    Object.keys(state.players).forEach(function (id) {
      var data = state.players[id];
      if (data.alive) return;
      if (data.side === 'bottom') { ctx.beginPath(); ctx.moveTo(28, 976); ctx.lineTo(972, 976); ctx.stroke(); }
      if (data.side === 'top') { ctx.beginPath(); ctx.moveTo(28, 24); ctx.lineTo(972, 24); ctx.stroke(); }
      if (data.side === 'left') { ctx.beginPath(); ctx.moveTo(24, 28); ctx.lineTo(24, 972); ctx.stroke(); }
      if (data.side === 'right') { ctx.beginPath(); ctx.moveTo(976, 28); ctx.lineTo(976, 972); ctx.stroke(); }
    });
    ctx.restore();
  }
  function drawHud() {
    if (!state) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 14px "Cascadia Mono", Consolas, monospace';
    var p1 = state.players.p1, p2 = state.players.p2, p3 = state.players.p3, p4 = state.players.p4;
    ctx.fillStyle = p2.color; ctx.fillText(p2.name + ' · ' + (state.playMode === 'coop' && p2.role === 'warden' ? 'WARDEN' : state.lives.p2), 500, 34);
    ctx.fillStyle = p1.color; ctx.fillText(p1.name + ' · ' + state.lives.p1, 500, 974);
    ctx.save(); ctx.translate(34, 500); ctx.rotate(-Math.PI / 2); ctx.fillStyle = p3.color; ctx.fillText(p3.name + ' · ' + state.lives.p3, 0, 0); ctx.restore();
    ctx.save(); ctx.translate(966, 500); ctx.rotate(Math.PI / 2); ctx.fillStyle = p4.color; ctx.fillText(p4.name + ' · ' + (state.playMode === 'coop' && p4.role === 'warden' ? 'WARDEN' : state.lives.p4), 0, 0); ctx.restore();
    if (state.playMode === 'coop') {
      ctx.fillStyle = '#69dc9a';
      ctx.font = '700 17px "Cascadia Mono", Consolas, monospace';
      ctx.fillText('CORE ' + state.mission.core + ' · WARDEN ' + state.mission.boss, 500, 735);
      ctx.font = '700 12px "Cascadia Mono", Consolas, monospace';
      ctx.fillText('RELAY ' + state.mission.relayChain.length + '/' + Math.min(3, state.seatCount), 500, 758);
    }
    ctx.restore();
  }
  function render() {
    drawCover(state ? mapImages[state.arenaId] : null);
    if (state && state.effects && state.effects.slowField) { ctx.fillStyle = 'rgba(73,107,219,.12)'; ctx.fillRect(0, 0, 1000, 1000); }
    if (state) {
      drawSealedEdges();
      drawDiamond();
      ['p1', 'p2', 'p3', 'p4'].forEach(function (id) { drawPaddle(state.paddles[id], state.players[id].color, state.power[id].active, state.players[id].alive, state.players[id].role); });
      (state.balls || [state.ball]).forEach(drawBall);
      drawHud();
    } else {
      ctx.fillStyle = '#91a8bb';
      ctx.textAlign = 'center';
      ctx.font = '700 18px "Cascadia Mono", Consolas, monospace';
      ctx.fillText('CONNECTING TO CROSS ARENA', 500, 500);
    }
    requestAnimationFrame(render);
  }

  mountAetherglass();
  connect();
  render();
})();
