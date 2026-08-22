(function () {
  'use strict';

  var Core = window.BraceRoomCore;
  var Gamepad = window.AXMBraceRoomGamepad;
  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');
  var depthCanvas = document.getElementById('scene-depth');
  var depthRenderer = window.AXMBraceDepth ? window.AXMBraceDepth.create(depthCanvas) : null;
  var appEl = document.getElementById('app');

  var startScreen = document.getElementById('start-screen');
  var pauseScreen = document.getElementById('pause-screen');
  var endScreen = document.getElementById('end-screen');
  var helpOverlay = document.getElementById('help-overlay');
  var toastLayer = document.getElementById('toast-layer');
  var hullBar = document.getElementById('hull-bar');
  var hullFill = document.getElementById('hull-fill');
  var hullValue = document.getElementById('hull-value');
  var waveLabel = document.getElementById('wave-label');
  var timerValue = document.getElementById('timer-value');
  var endTitle = document.getElementById('end-title');
  var endSummary = document.getElementById('end-summary');
  var soundToggle = document.getElementById('sound-toggle');
  var gamepadStatus = document.getElementById('gamepad-status');

  appEl.dataset.gamepadProfile = Gamepad.PROFILE_ID;
  appEl.dataset.gamepadsReady = '0';
  appEl.dataset.gamepadsUnsupported = '0';

  var gamepadQaPanel = document.getElementById('gamepad-qa-panel');
  var gamepadQaEnabled = new URLSearchParams(location.search).get('gamepadQa') === '1';
  var gamepadQaState = {
    connected: false,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, function () { return { pressed: false, value: 0 }; })
  };
  if (gamepadQaEnabled) {
    gamepadQaPanel.hidden = false;
    appEl.dataset.gamepadQa = 'simulated-not-physical';
  }

  /**
   * All sound is synthesized with WebAudio oscillators — no audio files,
   * consistent with ASSET_PROVENANCE.md's zero-third-party-asset policy.
   * The AudioContext is created lazily on the Start button click (a real
   * user gesture) since browsers block autoplay before one.
   */
  var Audio = (function () {
    var ctxAudio = null;
    var muted = false;
    var heartbeatTimer = null;

    function ensureContext() {
      if (!ctxAudio) {
        var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return null;
        ctxAudio = new AudioContextCtor();
      }
      if (ctxAudio.state === 'suspended') ctxAudio.resume();
      return ctxAudio;
    }

    function tone(freq, startOffset, durationSec, options) {
      if (muted) return;
      var audioCtx = ensureContext();
      if (!audioCtx) return;
      var opts = options || {};
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = opts.type || 'sine';
      var startAt = audioCtx.currentTime + (startOffset || 0);
      osc.frequency.setValueAtTime(freq, startAt);
      if (opts.slideTo) osc.frequency.linearRampToValueAtTime(opts.slideTo, startAt + durationSec);
      var peakVol = opts.volume != null ? opts.volume : 0.12;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(peakVol, startAt + Math.min(0.02, durationSec / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(startAt);
      osc.stop(startAt + durationSec + 0.02);
    }

    return {
      unlock: function () { ensureContext(); },
      setMuted: function (value) {
        muted = value;
        if (muted) this.stopHeartbeat();
      },
      isMuted: function () { return muted; },
      resolved: function () { tone(660, 0, 0.09, { type: 'sine', volume: 0.14 }); tone(880, 0.07, 0.12, { type: 'sine', volume: 0.12 }); },
      missed: function () { tone(180, 0, 0.22, { type: 'sawtooth', slideTo: 90, volume: 0.13 }); },
      falseAlarmMistake: function () { tone(220, 0, 0.09, { type: 'square', volume: 0.11 }); tone(140, 0.09, 0.16, { type: 'square', volume: 0.11 }); },
      falseAlarmAvoided: function () { tone(520, 0, 0.05, { type: 'sine', volume: 0.05 }); },
      waveUp: function () { tone(320, 0, 0.1, { type: 'triangle', slideTo: 640, volume: 0.1 }); },
      win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, i * 0.11, 0.22, { type: 'sine', volume: 0.13 }); }); },
      lose: function () { [220, 196, 165].forEach(function (f, i) { tone(f, i * 0.16, 0.3, { type: 'sawtooth', volume: 0.1 }); }); },
      startHeartbeat: function (intervalMs) {
        this.stopHeartbeat();
        var self = this;
        heartbeatTimer = setInterval(function () { tone(70, 0, 0.14, { type: 'sine', volume: 0.09 }); }, intervalMs);
      },
      stopHeartbeat: function () {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      }
    };
  })();

  soundToggle.addEventListener('click', function () {
    var next = !Audio.isMuted();
    Audio.setMuted(next);
    soundToggle.setAttribute('aria-pressed', String(next));
    soundToggle.textContent = next ? '🔇' : '🔊';
    soundToggle.title = next ? 'Unmute sound' : 'Mute sound';
    soundToggle.setAttribute('aria-label', next ? 'Unmute sound' : 'Mute sound');
  });

  var selectedPlayers = 4;
  var selectedMinutes = 9;
  var state = null;
  var paused = false;
  var lastFrameAt = 0;
  var rafHandle = null;

  // Juice: particle burst on resolve/miss, a brief screen shake on damage,
  // and a color flash overlay. Shake is skipped under reduced-motion (it's
  // the one effect here that's a real motion-sickness trigger); particles
  // and the flash stay but get toned down instead of removed entirely.
  var particles = [];
  var shakeUntil = 0;
  var shakeMagnitude = 0;
  var flashUntil = 0;
  var flashColor = null;

  var KEY_MAP = {
    p1: { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', action: 'Space' },
    p2: { up: 'ArrowUp', left: 'ArrowLeft', down: 'ArrowDown', right: 'ArrowRight', action: 'Enter' },
    p3: { up: 'KeyI', left: 'KeyJ', down: 'KeyK', right: 'KeyL', action: 'KeyO' },
    p4: { up: 'Numpad8', left: 'Numpad4', down: 'Numpad5', right: 'Numpad6', action: 'Numpad0' }
  };

  var PLAYER_COLORS = { p1: '#35e0e0', p2: '#ff5fd6', p3: '#f5c542', p4: '#7cff6b' };
  var VERB_SHAPE = { mash: 'square', hold: 'triangle', rhythm: 'diamond', crew2: 'double' };

  var keysDown = new Set();
  var actionEdgeQueue = new Set();

  // Every code any player cluster or global shortcut uses. Space/Enter in
  // particular MUST be prevented here: a focused <button> (e.g. the Start
  // button the player just clicked) fires its own synthetic click when
  // Space/Enter is released, which was silently re-running startRun() and
  // wiping the whole session every time a "hold" fault's action key was
  // released — the exact "Breaker always fails" bug.
  var RESERVED_CODES = (function () {
    var set = new Set(['KeyH', 'KeyM', 'KeyC', 'Escape']);
    Object.keys(KEY_MAP).forEach(function (id) {
      var m = KEY_MAP[id];
      [m.up, m.left, m.down, m.right, m.action].forEach(function (code) { set.add(code); });
    });
    return set;
  })();

  window.addEventListener('keydown', function (e) {
    if (!RESERVED_CODES.has(e.code)) return;
    e.preventDefault(); // stop arrow-key page scroll and Space/Enter button activation

    if (e.code === 'KeyH') { toggleHelp(); }
    else if (e.code === 'KeyM') { toggleReducedMotion(); }
    else if (e.code === 'KeyC') { toggleHighContrast(); }
    else if (e.code === 'Escape') { onEscape(); }

    if (!e.repeat) actionEdgeQueue.add(e.code);
    keysDown.add(e.code);
  });
  window.addEventListener('keyup', function (e) {
    if (!RESERVED_CODES.has(e.code)) return;
    e.preventDefault();
    keysDown.delete(e.code);
  });

  function toggleHelp() {
    helpOverlay.classList.toggle('hidden');
  }

  function toggleReducedMotion() {
    appEl.classList.toggle('theme-reduced-motion');
  }

  function toggleHighContrast() {
    appEl.classList.toggle('theme-high-contrast');
  }

  function onEscape() {
    if (!helpOverlay.classList.contains('hidden')) { helpOverlay.classList.add('hidden'); return; }
    if (!state || state.status !== 'running') return;
    paused = !paused;
    pauseScreen.classList.toggle('hidden', !paused);
    if (!paused) { lastFrameAt = performance.now(); }
  }

  // --- start screen wiring ---
  document.getElementById('player-count').addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    selectedPlayers = Number(btn.dataset.players);
    setActiveChip('player-count', btn);
  });
  document.getElementById('session-length').addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    selectedMinutes = Number(btn.dataset.minutes);
    setActiveChip('session-length', btn);
  });
  function setActiveChip(groupId, btn) {
    var group = document.getElementById(groupId);
    Array.prototype.forEach.call(group.querySelectorAll('.chip'), function (c) {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
  }

  function blurActiveElement() {
    // Belt-and-suspenders alongside the keydown preventDefault() above: a
    // focused button left over from a mouse click must not keep intercepting
    // Space/Enter as a "click me again" trigger once gameplay starts.
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }

  document.getElementById('start-button').addEventListener('click', function () {
    startRun();
    blurActiveElement();
  });
  document.getElementById('restart-button').addEventListener('click', function () {
    endScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    blurActiveElement();
  });
  // "Go again" skips the start screen entirely and reuses whatever crew
  // size / session length the last run already had — selectedPlayers and
  // selectedMinutes only change when a chip is actually clicked, so they're
  // already sitting there from the run that just ended. This is purely a
  // convenience path; "Change crew" (above) still exists for anyone who
  // wants to pick different settings before the next run.
  document.getElementById('quick-restart-button').addEventListener('click', function () {
    startRun();
    blurActiveElement();
  });
  document.getElementById('help-close').addEventListener('click', function () {
    toggleHelp();
    blurActiveElement();
  });

  function startRun() {
    Audio.unlock(); // the Start click is the user gesture WebAudio needs
    var seed = Math.floor(Math.random() * 1e9);
    state = Core.createInitialState({ seed: seed, sessionMinutes: selectedMinutes, playerCount: selectedPlayers });
    paused = false;
    lastKnownWave = 0;
    heartbeatActive = false;
    Audio.stopHeartbeat();
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    lastFrameAt = performance.now();
    if (rafHandle) cancelAnimationFrame(rafHandle);
    rafHandle = requestAnimationFrame(loop);
  }

  // Phone input relay: Game Hub's existing QR/lobby seam (lobby-controller.html,
  // one level up) redirects a joined phone to runtime/controller.html?player=pN,
  // which posts joystick + action state to this game's own /api/input. We poll
  // that back out here and merge it per-seat with the shared keyboard, so a
  // seat can be played from the couch keyboard, a joined phone, or both.
  var phoneInputs = {};
  var phoneEdgeQueue = new Set();
  var gamepadEdgeQueue = new Set();
  var gamepadFrames = {
    p1: Gamepad.sampleStandardGamepad(null),
    p2: Gamepad.sampleStandardGamepad(null),
    p3: Gamepad.sampleStandardGamepad(null),
    p4: Gamepad.sampleStandardGamepad(null)
  };
  var gamepadStatusKey = '';
  // Tracks the last known 'fresh' / 'disconnected' per seat so a toast only
  // fires on an actual transition, not on every 80ms poll while a phone
  // stays dropped (or stays connected).
  var phoneConnectionState = {};
  var PLAYER_LABEL = { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4' };

  function pollPhoneInputs() {
    fetch('/api/input', { cache: 'no-store' }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (!data) return;
      var fresh = data.inputs || {};
      var status = data.phoneStatus || {};
      Object.keys(phoneInputs).forEach(function (id) { if (!fresh[id]) delete phoneInputs[id]; });
      Object.keys(fresh).forEach(function (id) {
        phoneInputs[id] = fresh[id];
        if (fresh[id].actionEdge) phoneEdgeQueue.add(id);
      });
      // Only meaningful once a run is actually in progress — the setup
      // screen already shows nothing is connected, so a toast there would
      // just be noise before there's anything to be disconnected *from*.
      if (state && state.status === 'running') {
        Object.keys(status).forEach(function (id) {
          var prev = phoneConnectionState[id];
          var next = status[id];
          if (prev === 'fresh' && next === 'disconnected') {
            pushToast((PLAYER_LABEL[id] || id) + ' phone controller lost connection — keyboard still works', 'bad');
          } else if (prev === 'disconnected' && next === 'fresh') {
            pushToast((PLAYER_LABEL[id] || id) + ' phone controller reconnected', 'good');
          }
          phoneConnectionState[id] = next;
        });
      } else {
        phoneConnectionState = {};
      }
    }).catch(function () { /* no phone joined this run — normal for shared-screen-only play */ });
  }
  setInterval(pollPhoneInputs, 80);

  function updateGamepadStatus() {
    var samples = Core.PLAYER_IDS.map(function (id) { return gamepadFrames[id]; });
    var ready = samples.filter(function (sample) { return sample.supported; }).length;
    var readySeats = Core.PLAYER_IDS.filter(function (id) { return gamepadFrames[id].supported; }).map(function (id) { return id.toUpperCase(); });
    var unsupported = samples.filter(function (sample) { return sample.connected && !sample.supported; }).length;
    var nextKey = ready + '|' + unsupported;
    if (nextKey === gamepadStatusKey) return;
    gamepadStatusKey = nextKey;
    appEl.dataset.gamepadsReady = String(ready);
    appEl.dataset.gamepadsUnsupported = String(unsupported);
    gamepadStatus.classList.toggle('ready', ready > 0);
    gamepadStatus.classList.toggle('unsupported', unsupported > 0);
    if (unsupported > 0) {
      gamepadStatus.textContent = unsupported + ' gamepad' + (unsupported === 1 ? ' needs' : 's need') + ' standard mapping · fallback ready';
    } else if (ready > 0) {
      gamepadStatus.textContent = ready + ' gamepad' + (ready === 1 ? '' : 's') + ' ready · ' + readySeats.join(' / ');
    } else {
      gamepadStatus.textContent = 'No gamepads detected · keyboard/phone ready';
    }
  }

  function rememberGamepadActivity(id, sample) {
    if (sample.actionEdge) appEl.dataset.lastGamepadInput = 'action';
    else if (Math.abs(sample.moveX) > Math.abs(sample.moveY) && sample.moveX) appEl.dataset.lastGamepadInput = sample.moveX < 0 ? 'move-left' : 'move-right';
    else if (sample.moveY) appEl.dataset.lastGamepadInput = sample.moveY < 0 ? 'move-up' : 'move-down';
    else return;
    appEl.dataset.lastGamepadSeat = id;
  }

  function qaPressButton(index) {
    gamepadQaState.buttons[index] = { pressed: true, value: 1 };
    setTimeout(function () { gamepadQaState.buttons[index] = { pressed: false, value: 0 }; }, 100);
  }

  if (gamepadQaEnabled) {
    gamepadQaPanel.addEventListener('click', function (event) {
      var button = event.target.closest('[data-gamepad-qa]');
      if (!button) return;
      var action = button.dataset.gamepadQa;
      if (action === 'connect' || action === 'unsupported') {
        gamepadQaState.connected = true;
        gamepadQaState.mapping = action === 'connect' ? 'standard' : 'nonstandard';
      } else if (action === 'right') {
        gamepadQaState.axes[0] = gamepadQaState.axes[0] > 0 ? 0 : 0.9;
        button.classList.toggle('active', gamepadQaState.axes[0] > 0);
      } else if (action === 'action') {
        qaPressButton(0);
      } else if (action === 'menu') {
        qaPressButton(9);
      } else if (action === 'disconnect') {
        gamepadQaState.connected = false;
        gamepadQaState.axes[0] = 0;
        gamepadQaPanel.querySelector('[data-gamepad-qa="right"]').classList.remove('active');
      }
    });
  }

  function availableGamepads() {
    if (gamepadQaEnabled) return gamepadQaState.connected ? [gamepadQaState] : [];
    try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []); } catch (_) { return []; }
  }

  function pollGamepads() {
    var pads = availableGamepads();
    Core.PLAYER_IDS.forEach(function (id, index) {
      var previous = gamepadFrames[id];
      var sample = Gamepad.sampleStandardGamepad(pads[index] || null, previous);
      gamepadFrames[id] = sample;
      if (sample.supported) rememberGamepadActivity(id, sample);
      if (sample.actionEdge) {
        gamepadEdgeQueue.add(id);
        if ((!state && !startScreen.classList.contains('hidden')) || (state && (state.status === 'won' || state.status === 'lost'))) startRun();
      }
      if (sample.pauseEdge) onEscape();
    });
    updateGamepadStatus();
    requestAnimationFrame(pollGamepads);
  }
  pollGamepads();

  // Adapter observation push: mirrors the live `state` object out to the
  // server at ~8Hz so an external agent (Codex, another Claude instance,
  // any locally-running adapter with real network access to this host —
  // see docs/AI_NATIVE_SEAT_CONTRACT.md) can GET /api/adapter-observation
  // and actually see the running session, then act through the same
  // /api/input endpoint the phone controller uses. `state.rng` is a
  // function and JSON.stringify silently drops it, which is correct here:
  // an adapter should see current game facts, not be handed the seed
  // needed to predict future spawns.
  function buildObservationSnapshot() {
    return {
      sessionMinutes: state.sessionMinutes,
      elapsedMs: state.elapsedMs,
      sessionLengthMs: state.sessionLengthMs,
      wave: state.wave || 1,
      hull: state.hull,
      status: state.status,
      playerCount: state.playerCount,
      currentStreak: state.currentStreak,
      bestStreak: state.bestStreak,
      stats: state.stats,
      stations: Core.STATIONS.map(function (s) {
        var pos = Core.stationPosition(s);
        return { id: s.id, label: s.label, verb: s.verb, x: pos.x, y: pos.y };
      }),
      faults: state.faults.map(function (f) {
        return {
          id: f.id, stationId: f.stationId, verb: f.verb, kind: f.kind,
          effort: f.effort, effortTarget: Core.EFFORT_TARGET,
          ringMs: f.ringMs, remainingMs: Math.max(0, f.ringMs - (state.elapsedMs - f.spawnedAt))
        };
      }),
      players: (function () {
        var out = {};
        Core.PLAYER_IDS.forEach(function (id, i) {
          out[id] = { x: state.players[id].x, y: state.players[id].y, active: i < state.playerCount };
        });
        return out;
      })(),
      summary: state.summary
    };
  }

  function pushObservation() {
    if (!state) return;
    fetch('/api/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildObservationSnapshot())
    }).catch(function () { /* adapter observation is best-effort, never blocks play */ });
  }
  setInterval(pushObservation, 125);

  function collectInputs() {
    var inputs = {};
    for (var i = 0; i < Core.PLAYER_IDS.length; i += 1) {
      var id = Core.PLAYER_IDS[i];
      if (i >= state.playerCount) continue;
      var map = KEY_MAP[id];
      var kbMoveX = (keysDown.has(map.right) ? 1 : 0) - (keysDown.has(map.left) ? 1 : 0);
      var kbMoveY = (keysDown.has(map.down) ? 1 : 0) - (keysDown.has(map.up) ? 1 : 0);
      var kbAction = keysDown.has(map.action);
      var kbEdge = actionEdgeQueue.has(map.action);
      var phone = phoneInputs[id];
      var pad = gamepadFrames[id];
      inputs[id] = {
        moveX: Gamepad.strongestAxis(kbMoveX, phone && phone.moveX, pad && pad.supported && pad.moveX),
        moveY: Gamepad.strongestAxis(kbMoveY, phone && phone.moveY, pad && pad.supported && pad.moveY),
        action: kbAction || Boolean(phone && phone.action) || Boolean(pad && pad.supported && pad.action),
        actionEdge: kbEdge || phoneEdgeQueue.has(id) || gamepadEdgeQueue.has(id)
      };
    }
    actionEdgeQueue.clear();
    phoneEdgeQueue.clear();
    gamepadEdgeQueue.clear();
    return inputs;
  }

  var lastKnownWave = 0;
  var heartbeatActive = false;

  function loop(now) {
    var dtMs = Math.min(50, now - lastFrameAt);
    lastFrameAt = now;

    if (!paused && state && state.status === 'running') {
      var inputs = collectInputs();
      Core.tick(state, dtMs, inputs);
      showToasts(state.lastEvents);
      processFeedbackEvents(state.lastEvents, now);

      if (state.wave && state.wave !== lastKnownWave) {
        if (lastKnownWave !== 0) Audio.waveUp();
        lastKnownWave = state.wave;
      }

      var wantsHeartbeat = state.hull > 0 && state.hull <= 30;
      if (wantsHeartbeat && !heartbeatActive) {
        heartbeatActive = true;
        Audio.startHeartbeat(Math.max(300, 900 - (30 - state.hull) * 20));
      } else if (!wantsHeartbeat && heartbeatActive) {
        heartbeatActive = false;
        Audio.stopHeartbeat();
      }
    } else {
      actionEdgeQueue.clear();
      phoneEdgeQueue.clear();
      gamepadEdgeQueue.clear();
    }

    updateParticles(dtMs);
    render(now);

    if (state && state.status !== 'running' && endScreen.classList.contains('hidden')) {
      Audio.stopHeartbeat();
      heartbeatActive = false;
      if (state.status === 'won') Audio.win(); else Audio.lose();
      showEndScreen(state.summary);
    }

    rafHandle = requestAnimationFrame(loop);
  }

  function spawnParticles(x, y, color, count, reducedMotion) {
    var n = reducedMotion ? Math.ceil(count / 3) : count;
    for (var i = 0; i < n; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var speed = reducedMotion ? 0 : 60 + Math.random() * 90;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 400 + Math.random() * 200,
        color: color
      });
    }
  }

  function triggerShake(magnitude, durationMs, reducedMotion) {
    if (reducedMotion) return;
    shakeMagnitude = magnitude;
    shakeUntil = performance.now() + durationMs;
  }

  function triggerFlash(color, durationMs) {
    flashColor = color;
    flashUntil = performance.now() + durationMs;
  }

  function processFeedbackEvents(events, now) {
    if (!events || events.length === 0) return;
    var reducedMotion = appEl.classList.contains('theme-reduced-motion');
    events.forEach(function (evt) {
      var station = Core.STATIONS.find(function (s) { return s.id === evt.stationId; });
      var pos = station ? Core.stationPosition(station) : { x: Core.ARENA.centerX, y: Core.ARENA.centerY };
      if (evt.type === 'resolved') {
        spawnParticles(pos.x, pos.y, '#7cff6b', 14, reducedMotion);
        Audio.resolved();
      } else if (evt.type === 'missed') {
        spawnParticles(pos.x, pos.y, '#ff4d5e', 10, reducedMotion);
        triggerShake(6, 220, reducedMotion);
        triggerFlash('rgba(255,77,94,0.18)', 260);
        Audio.missed();
      } else if (evt.type === 'false-alarm-mistake') {
        spawnParticles(pos.x, pos.y, '#ff4d5e', 10, reducedMotion);
        triggerShake(4, 180, reducedMotion);
        triggerFlash('rgba(255,77,94,0.12)', 220);
        Audio.falseAlarmMistake();
      } else if (evt.type === 'false-alarm-avoided') {
        spawnParticles(pos.x, pos.y, '#93a4c2', 6, reducedMotion);
        Audio.falseAlarmAvoided();
      }
    });
  }

  function updateParticles(dtMs) {
    if (particles.length === 0) return;
    var dtSec = dtMs / 1000;
    particles = particles.filter(function (p) {
      p.life += dtMs;
      if (p.life >= p.maxLife) return false;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vx *= 0.9;
      p.vy *= 0.9;
      return true;
    });
  }

  function pushToast(text, cls) {
    var el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    toastLayer.appendChild(el);
    setTimeout(function () { el.remove(); }, 1600);
  }

  function showToasts(events) {
    if (!events || events.length === 0) return;
    events.forEach(function (evt) {
      var text = '';
      var cls = 'neutral';
      var station = Core.STATIONS.find(function (s) { return s.id === evt.stationId; });
      var name = station ? station.label : evt.stationId;
      if (evt.type === 'resolved') { text = name + ' secured'; cls = 'good'; }
      else if (evt.type === 'missed') { text = name + ' failed'; cls = 'bad'; }
      else if (evt.type === 'false-alarm-mistake') { text = name + ' — false alarm, wrong call'; cls = 'bad'; }
      else if (evt.type === 'false-alarm-avoided') { text = name + ' — false alarm dodged'; cls = 'good'; }
      pushToast(text, cls);
    });
  }

  function hullColor(hull) {
    if (hull > 60) return getComputedStyle(document.documentElement).getPropertyValue('--hull-ok').trim();
    if (hull > 30) return getComputedStyle(document.documentElement).getPropertyValue('--hull-warn').trim();
    return getComputedStyle(document.documentElement).getPropertyValue('--hull-crit').trim();
  }

  function formatClock(ms) {
    var totalSec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function drawShape(shape, x, y, r) {
    ctx.beginPath();
    if (shape === 'square') {
      ctx.rect(x - r, y - r, r * 2, r * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x - r, y + r);
      ctx.closePath();
    } else if (shape === 'diamond') {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x + r * 0.4, y);
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
    }
  }

  function render(now) {
    if (!state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (depthRenderer) depthRenderer.clear();
      return;
    }
    var nowMs = now || performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var reducedMotion = appEl.classList.contains('theme-reduced-motion');
    var highContrast = appEl.classList.contains('theme-high-contrast');
    // Canvas palette swap for the C toggle. CSS already handles page chrome
    // (see .theme-high-contrast in styles.css); these are the equivalents
    // for shapes drawn on the canvas itself, which CSS can't reach. Picked
    // to keep the same *meaning* per color (real-fault ring stays warm,
    // false-alarm ring stays cool/neutral, resolve progress stays green)
    // while pushing every value to near-maximum contrast against pure black.
    var palette = highContrast
      ? {
          hullBg: '#000000', stationStroke: '#ffffff', stationFill: '#000000',
          label: '#ffffff', ringFalse: '#4fd7ff', ringReal: '#ffe600',
          effortFalse: '#ffffff', effortReal: '#00ff6a'
        }
      : {
          hullBg: '#0e1522', stationStroke: '#2c3c56', stationFill: '#131c2c',
          label: '#93a4c2', ringFalse: '#6b7690', ringReal: '#f5c542',
          effortFalse: '#c9d2e3', effortReal: '#7cff6b'
        };

    ctx.save();
    if (nowMs < shakeUntil) {
      var shakeLeft = (shakeUntil - nowMs) / 1000;
      ctx.translate((Math.random() - 0.5) * shakeMagnitude * shakeLeft * 6, (Math.random() - 0.5) * shakeMagnitude * shakeLeft * 6);
    }

    drawBackgroundGrid(highContrast);

    // center hull gauge
    var hull = state.hull;
    var hColor = hullColor(hull);
    ctx.beginPath();
    ctx.arc(Core.ARENA.centerX, Core.ARENA.centerY, 70, 0, Math.PI * 2);
    ctx.fillStyle = palette.hullBg;
    ctx.fill();
    // Dim full-circle track behind the progress arc — without it the gauge
    // only ever shows "how much hull is left" with no reference for "out
    // of what," which reads oddly once hull drops low and the arc becomes
    // a short, context-free sliver.
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = highContrast ? 'rgba(255,255,255,0.18)' : 'rgba(147,164,194,0.18)';
    ctx.arc(Core.ARENA.centerX, Core.ARENA.centerY, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    if (!highContrast) { ctx.shadowColor = hColor; ctx.shadowBlur = 10; }
    ctx.lineWidth = 6;
    ctx.strokeStyle = hColor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(Core.ARENA.centerX, Core.ARENA.centerY, 70, -Math.PI / 2, -Math.PI / 2 + (hull / 100) * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#eaf2ff';
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(hull), Core.ARENA.centerX, Core.ARENA.centerY);

    // stations
    Core.STATIONS.forEach(function (station) {
      var pos = Core.stationPosition(station);
      var fault = state.faults.find(function (f) { return f.stationId === station.id; });

      // Idle stations get a slow breathing glow so the field doesn't read as
      // dead space between faults — skipped under reduced motion.
      var idleGlow = !fault && !reducedMotion ? 0.5 + 0.5 * Math.sin(nowMs / 900 + station.angleDeg) : 0;

      ctx.save();
      // A small always-on glow (not just the idle breathing pulse) so every
      // station reads as a powered console rather than dead metal, plus a
      // subtle radial gradient fill instead of one flat color for a hint of
      // real depth — both skipped under high contrast, which wants flat
      // maximum-contrast shapes on purpose.
      if (!highContrast) {
        ctx.shadowColor = 'rgba(79,139,255,0.45)';
        ctx.shadowBlur = 4 + 6 * idleGlow;
      }
      ctx.strokeStyle = palette.stationStroke;
      ctx.lineWidth = highContrast ? 3 : 2;
      drawShape(VERB_SHAPE[station.verb], pos.x, pos.y, 24);
      if (highContrast) {
        ctx.fillStyle = palette.stationFill;
      } else {
        var stationFill = ctx.createRadialGradient(pos.x, pos.y - 6, 2, pos.x, pos.y, 26);
        stationFill.addColorStop(0, '#1b283f');
        stationFill.addColorStop(1, palette.stationFill);
        ctx.fillStyle = stationFill;
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (fault) {
        var remainingMs = Math.max(0, fault.ringMs - (state.elapsedMs - fault.spawnedAt));
        var remainingFraction = fault.ringMs > 0 ? remainingMs / fault.ringMs : 0;
        var ringColor = fault.kind === 'false' ? palette.ringFalse : palette.ringReal;

        if (reducedMotion) {
          // A continuously shrinking arc is exactly the kind of motion this
          // toggle exists to remove. Swap it for a static ring plus a plain
          // number — same information (time left), no animation.
          ctx.beginPath();
          ctx.lineWidth = 5;
          ctx.strokeStyle = ringColor;
          ctx.arc(pos.x, pos.y, 34, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = ringColor;
          ctx.font = '700 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((remainingMs / 1000).toFixed(1) + 's', pos.x, pos.y - 44);
        } else {
          // Outer ring: time remaining before the fault expires (shrinks
          // clockwise). A matching glow gives active faults a genuine
          // "something needs attention" neon urgency instead of a flat
          // stroke — skipped under high contrast for the same legibility
          // reason as everywhere else.
          ctx.save();
          if (!highContrast) { ctx.shadowColor = ringColor; ctx.shadowBlur = 8; }
          ctx.beginPath();
          ctx.lineWidth = 5;
          ctx.strokeStyle = ringColor;
          ctx.arc(pos.x, pos.y, 34, -Math.PI / 2, -Math.PI / 2 + remainingFraction * Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Inner ring: how close this fault is to being resolved — this is the
        // "am I actually doing anything" signal, so it needs to be loud, not
        // a faint 18px dot. Bright and thick, plus a live percentage label.
        var effortFraction = fault.effort / Core.EFFORT_TARGET;
        if (effortFraction > 0) {
          var effortColor = fault.kind === 'false' ? palette.effortFalse : palette.effortReal;
          ctx.save();
          if (!highContrast) { ctx.shadowColor = effortColor; ctx.shadowBlur = 7; }
          ctx.beginPath();
          ctx.lineWidth = 6;
          ctx.strokeStyle = effortColor;
          ctx.arc(pos.x, pos.y, 24, -Math.PI / 2, -Math.PI / 2 + effortFraction * Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = highContrast ? '#ffffff' : '#eaf2ff';
        ctx.font = '700 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(effortFraction * 100) + '%', pos.x, pos.y);

        // Radio's rhythm-tap verb had no metronome at all — nothing told a
        // player *when* the beat landed, only that pressing on-beat mattered.
        // A dot orbits the station once per beat and flashes bright right in
        // the pressable window, so "tap when it's at the top and glowing" is
        // an actual visible instruction, not a guess.
        if (fault.verb === 'rhythm') {
          var sinceAnchor = state.elapsedMs - fault.beatAnchorMs;
          var onBeat = Core.nearestBeatDelta(sinceAnchor) <= Core.RHYTHM_WINDOW_MS;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
          ctx.strokeStyle = onBeat ? palette.effortReal : (highContrast ? 'rgba(255,255,255,0.6)' : 'rgba(147,164,194,0.35)');
          ctx.lineWidth = onBeat ? 3 : 1;
          ctx.stroke();
          if (!reducedMotion) {
            // The orbiting dot is the animated version of the same "when to
            // press" signal the static ring above already gives in reduced
            // motion — skip the continuous rotation, keep the flash.
            var beatFraction = (sinceAnchor % Core.RHYTHM_BEAT_MS) / Core.RHYTHM_BEAT_MS;
            var tickAngle = -Math.PI / 2 + beatFraction * Math.PI * 2;
            var tickX = pos.x + Math.cos(tickAngle) * 40;
            var tickY = pos.y + Math.sin(tickAngle) * 40;
            ctx.beginPath();
            ctx.fillStyle = onBeat ? palette.effortReal : (highContrast ? '#4fd7ff' : '#4f8bff');
            ctx.arc(tickX, tickY, onBeat ? 7 : 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.fillStyle = palette.label;
      ctx.font = '600 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(station.label, pos.x, pos.y + 44);
    });

    // players
    Core.PLAYER_IDS.forEach(function (id, index) {
      if (index >= state.playerCount) return;
      var player = state.players[id];
      // A soft glow in the seat's own color gives each crew member a small
      // "presence" halo rather than a flat token — same skip-under-high-
      // contrast rule as every other glow added this pass.
      ctx.save();
      if (!highContrast) { ctx.shadowColor = PLAYER_COLORS[id]; ctx.shadowBlur = 9; }
      ctx.beginPath();
      ctx.fillStyle = PLAYER_COLORS[id];
      ctx.arc(player.x, player.y, Core.PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#051019';
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), player.x, player.y);
    });

    // particles (drawn inside the shake transform, restored right after)
    particles.forEach(function (p) {
      var fade = 1 - p.life / p.maxLife;
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.arc(p.x, p.y, 3 * fade + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.restore(); // end shake transform

    if (nowMs < flashUntil && flashColor) {
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    hullFill.style.width = Math.max(0, hull) + '%';
    hullFill.style.background = hullColor(hull);
    hullValue.textContent = Math.round(hull);
    hullBar.classList.toggle('critical', hull > 0 && hull <= 30);
    waveLabel.textContent = 'WAVE ' + (state.wave || 1);
    timerValue.textContent = formatClock(state.sessionLengthMs - state.elapsedMs);
    if (depthRenderer) {
      depthRenderer.draw({
        state: state,
        stations: Core.STATIONS.map(function (station) {
          var position = Core.stationPosition(station);
          return { id: station.id, verb: station.verb, x: position.x, y: position.y };
        }),
        reducedMotion: reducedMotion,
        highContrast: highContrast,
        now: nowMs
      });
    }
  }

  function drawBackgroundGrid(highContrast) {
    // Subtle engineering-grid texture so the play field reads as a
    // structure under stress, not empty space. A soft radial vignette sits
    // under the grid so the hull/stations read as the well-lit center of a
    // room rather than shapes floating on flat black — still cheap (one
    // gradient fill + a fixed-step line grid, no images, no per-frame
    // allocation beyond the gradient object). Skipped under high contrast:
    // that mode's whole point is maximum legibility against pure black, and
    // a vignette would only fight that.
    if (!highContrast) {
      var vignette = ctx.createRadialGradient(
        Core.ARENA.centerX, Core.ARENA.centerY, 40,
        Core.ARENA.centerX, Core.ARENA.centerY, Math.max(canvas.width, canvas.height) * 0.62
      );
      vignette.addColorStop(0, 'rgba(23,34,54,0.55)');
      vignette.addColorStop(1, 'rgba(5,8,13,0)');
      ctx.save();
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    var step = 40;
    ctx.save();
    ctx.strokeStyle = highContrast ? 'rgba(255,255,255,0.08)' : 'rgba(79,139,255,0.06)';
    ctx.lineWidth = 1;
    for (var x = step; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (var y = step; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function showEndScreen(summary) {
    endTitle.textContent = summary.outcome === 'won' ? 'Hull held' : 'Hull breached';
    var quickRestartBtn = document.getElementById('quick-restart-button');
    if (quickRestartBtn) {
      var crewWord = selectedPlayers === 1 ? 'player' : 'players';
      quickRestartBtn.textContent = 'Go again (' + selectedPlayers + ' ' + crewWord + ', ' + selectedMinutes + ' min)';
    }
    endSummary.innerHTML = '';
    var rows = [
      ['Faults resolved', summary.resolved],
      ['Faults missed', summary.missed],
      ['False alarms dodged', summary.falseAlarmsAvoided],
      ['Wrong calls', summary.falseAlarmsMisresolved],
      ['Best streak', summary.bestStreak],
      ['Final hull', summary.finalHull],
      ['Crew size', summary.playerCount]
    ];
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      endSummary.appendChild(dt);
      endSummary.appendChild(dd);
    });
    endScreen.classList.remove('hidden');
  }

  render();
})();
