(function () {
  'use strict';
  var KEY = 'axm.hub.radio.v1';
  var stations = {
    defcon: { name: 'DEF CON Radio', urls: ['https://ice5.somafm.com/defcon-128-mp3', 'https://ice2.somafm.com/defcon-128-mp3'] },
    dubstep: { name: 'Dub Step Beyond', urls: ['https://ice5.somafm.com/dubstep-128-mp3', 'https://ice6.somafm.com/dubstep-128-mp3'] },
    thetrip: { name: 'The Trip', urls: ['https://ice5.somafm.com/thetrip-128-mp3', 'https://ice6.somafm.com/thetrip-128-mp3'] },
    metal: { name: 'Metal Detector', urls: ['https://ice5.somafm.com/metal-128-mp3', 'https://ice2.somafm.com/metal-128-mp3'] },
    poptron: { name: 'PopTron', urls: ['https://ice5.somafm.com/poptron-128-mp3', 'https://ice2.somafm.com/poptron-128-mp3'] },
    indiepop: { name: 'Indie Pop Rocks!', urls: ['https://ice5.somafm.com/indiepop-128-mp3', 'https://ice2.somafm.com/indiepop-128-mp3'] },
    soul: { name: 'Seven Inch Soul', urls: ['https://ice5.somafm.com/7soul-128-mp3', 'https://ice6.somafm.com/7soul-128-mp3'] },
    bootliquor: { name: 'Boot Liquor', urls: ['https://ice5.somafm.com/bootliquor-128-mp3', 'https://ice2.somafm.com/bootliquor-128-mp3'] },
    secretagent: { name: 'Secret Agent', urls: ['https://ice5.somafm.com/secretagent-128-mp3', 'https://ice2.somafm.com/secretagent-128-mp3'] }
  };
  var state = { station: 'defcon', volume: 0.35, playingIntent: false };
  var audio, select, play, status, player, topButton, volume, upButton, downButton;
  var requested = false, resumeNeeded = false, sourceIndex = 0, localTracks = [], localIndex = 0;

  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && stations[saved.station]) state.station = saved.station;
      if (saved && Number.isFinite(Number(saved.volume))) state.volume = Math.max(0, Math.min(1, Number(saved.volume)));
      state.playingIntent = !!(saved && saved.playingIntent);
    } catch (_) {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function setStatus(text, kind) { status.textContent = text; status.className = 'radio-status ' + (kind || ''); }
  function updateTop() {
    var station = stations[state.station];
    topButton.textContent = requested ? '❚❚ ' + station.name : resumeNeeded ? '▶ Resume' : '♫ Radio';
    topButton.classList.toggle('radio-on', requested);
    topButton.classList.toggle('radio-resume', resumeNeeded);
    topButton.setAttribute('aria-label', requested ? 'Radio playing ' + station.name : resumeNeeded ? 'Resume Hub radio' : 'Open Hub radio');
  }
  function showVolume() {
    var amount = Math.round(state.volume * 100) + '%';
    if (volume) volume.value = String(state.volume);
    var label = document.getElementById('hubRadioVolumeText');
    if (label) label.textContent = amount;
    if (upButton) { upButton.title = 'Radio volume up · ' + amount; upButton.setAttribute('aria-label', 'Radio volume up · current ' + amount); }
    if (downButton) { downButton.title = 'Radio volume down · ' + amount; downButton.setAttribute('aria-label', 'Radio volume down · current ' + amount); }
  }
  function adjustVolume(delta, button) {
    state.volume = Math.max(0, Math.min(1, Math.round((state.volume + delta) * 10) / 10));
    audio.volume = state.volume;
    showVolume(); save();
    button.classList.add('bump'); setTimeout(function () { button.classList.remove('bump'); }, 220);
  }
  function streamSource() { var station = stations[state.station]; return station.urls[Math.min(sourceIndex, station.urls.length - 1)]; }
  function loadCurrent() {
    var station = stations[state.station]; sourceIndex = 0;
    if (station.local) {
      if (!localTracks.length) { setStatus('LOCAL MIX EMPTY', 'bad'); return false; }
      var track = localTracks[localIndex % localTracks.length]; audio.src = track.src; setStatus(track.title || 'LOCAL TRACK', '');
    } else { audio.src = streamSource(); setStatus(station.name.toUpperCase() + ' · READY', ''); }
    audio.load(); return true;
  }
  function start() {
    requested = true; resumeNeeded = false; state.playingIntent = true; save();
    if (!audio.src && !loadCurrent()) { requested = false; resumeNeeded = true; updateTop(); return; }
    setStatus('CONNECTING…', '');
    audio.play().then(updateTop).catch(function (error) {
      requested = false;
      resumeNeeded = !!(error && error.name === 'NotAllowedError');
      state.playingIntent = resumeNeeded; save();
      setStatus(resumeNeeded ? 'PRESS PLAY TO RESUME' : 'STREAM UNAVAILABLE', 'bad'); updateTop();
    });
  }
  function stop() { requested = false; resumeNeeded = false; state.playingIntent = false; save(); audio.pause(); setStatus(stations[state.station].name.toUpperCase() + ' · PAUSED', ''); updateTop(); }
  function toggle() { if (requested) stop(); else start(); }
  function choose() {
    var wasRequested = requested || resumeNeeded;
    state.station = select.value; sourceIndex = 0; localIndex = 0; save();
    audio.pause(); audio.removeAttribute('src'); audio.load(); loadCurrent();
    if (wasRequested) start(); else updateTop();
  }
  function nextLocal() { if (!localTracks.length) return; localIndex = (localIndex + 1) % localTracks.length; audio.src = localTracks[localIndex].src; audio.load(); if (requested) audio.play().catch(function () { requested = false; resumeNeeded = true; updateTop(); }); }
  function loadLocal() {
    fetch('/assets/audio/radio/index.json', { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('no local manifest'); return response.json(); }).then(function (manifest) {
      localTracks = (manifest.tracks || []).filter(function (track) { return track && track.src; });
      if (!localTracks.length) return;
      stations.local = { name: manifest.name || 'AXM Local Mix', local: true, urls: [] };
      var option = document.createElement('option'); option.value = 'local'; option.textContent = stations.local.name + ' · local'; select.appendChild(option);
    }).catch(function () {});
  }
  function init() {
    audio = document.getElementById('hubRadioAudio'); select = document.getElementById('hubRadioStation'); play = document.getElementById('hubRadioPlay'); status = document.getElementById('hubRadioStatus'); player = document.getElementById('hubRadioPlayer'); topButton = document.getElementById('btnRadio'); volume = document.getElementById('hubRadioVolume'); upButton = document.getElementById('btnRadioUp'); downButton = document.getElementById('btnRadioDown');
    if (!audio || !select || !play || !status || !player || !topButton || !volume || !upButton || !downButton) return;
    read(); select.value = state.station; volume.value = String(state.volume); audio.volume = state.volume;
    topButton.onclick = function () { document.getElementById('radioScreen').classList.add('show'); };
    upButton.onclick = function () { adjustVolume(0.1, upButton); };
    downButton.onclick = function () { adjustVolume(-0.1, downButton); };
    play.onclick = toggle; select.onchange = choose;
    volume.oninput = function () { state.volume = Number(this.value); audio.volume = state.volume; showVolume(); save(); };
    showVolume();
    audio.addEventListener('playing', function () { requested = true; resumeNeeded = false; state.playingIntent = true; save(); player.classList.add('playing'); play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause radio'); setStatus(stations[state.station].name.toUpperCase() + ' · LIVE', 'live'); updateTop(); });
    audio.addEventListener('pause', function () { player.classList.remove('playing'); play.textContent = '▶'; play.setAttribute('aria-label', 'Play radio'); });
    audio.addEventListener('waiting', function () { if (requested) setStatus('BUFFERING…', ''); });
    audio.addEventListener('ended', function () { if (stations[state.station].local) nextLocal(); });
    audio.addEventListener('error', function () {
      var station = stations[state.station];
      if (requested && !station.local && sourceIndex + 1 < station.urls.length) { sourceIndex++; audio.src = streamSource(); audio.load(); audio.play().catch(function () { requested = false; resumeNeeded = true; setStatus('STREAM UNAVAILABLE', 'bad'); updateTop(); }); return; }
      if (requested) { requested = false; resumeNeeded = false; state.playingIntent = false; save(); setStatus('STREAM UNAVAILABLE · TRY ANOTHER STATION', 'bad'); updateTop(); }
    });
    window.AXMHubRadio = { stop: stop, start: start, isPlaying: function () { return requested && !audio.paused; }, volume: function () { return state.volume; } };
    loadCurrent(); loadLocal(); updateTop(); if (state.playingIntent) start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
