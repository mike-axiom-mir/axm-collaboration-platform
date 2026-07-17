/* AXM sonic signature v0.1
   First composed in AXM Audio Studio: D4 -> A4 -> D5 -> F#5 at 144 BPM.
   Browsers require a user gesture before audio may begin, so the Hub arms the
   cue on load and plays it once on the first click, tap, or keyboard action. */
(function (global) {
  'use strict';

  const SESSION_KEY = 'axm.hub.sonic-wake.v1';
  const AudioContext = global.AudioContext || global.webkitAudioContext;
  const bpm = 144;
  const beatSeconds = 60 / bpm;
  const motif = Object.freeze([
    { pitch: 'D4', frequency: 293.66, beat: 0, duration: 0.5, velocity: 88 },
    { pitch: 'A4', frequency: 440.00, beat: 0.5, duration: 0.5, velocity: 98 },
    { pitch: 'D5', frequency: 587.33, beat: 1, duration: 0.75, velocity: 108 },
    { pitch: 'F#5', frequency: 739.99, beat: 1.75, duration: 1.25, velocity: 76 }
  ]);

  let context = null;
  let played = false;
  let armed = false;

  function alreadyPlayed() {
    try { return global.sessionStorage.getItem(SESSION_KEY) === 'played'; }
    catch (_) { return false; }
  }

  function rememberPlayed() {
    try { global.sessionStorage.setItem(SESSION_KEY, 'played'); }
    catch (_) { /* The sound still works when storage is unavailable. */ }
  }

  function removeWakeListeners() {
    global.removeEventListener('pointerdown', wake, true);
    global.removeEventListener('keydown', wake, true);
  }

  function playWake() {
    if (played || alreadyPlayed() || !AudioContext) return false;
    played = true;
    rememberPlayed();

    context = context || new AudioContext();
    if (context.state === 'suspended') context.resume().catch(function () {});

    const master = context.createGain();
    master.gain.value = 0.16;
    master.connect(context.destination);
    const start = context.currentTime + 0.025;

    motif.forEach(function (note, index) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const noteStart = start + note.beat * beatSeconds;
      const noteEnd = noteStart + note.duration * beatSeconds;
      const peak = Math.max(0.035, note.velocity / 127 * 0.11);

      oscillator.type = index === motif.length - 1 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      envelope.gain.setValueAtTime(0.0001, noteStart);
      envelope.gain.exponentialRampToValueAtTime(peak, noteStart + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    });

    return true;
  }

  function wake() {
    removeWakeListeners();
    playWake();
  }

  function arm() {
    if (armed || alreadyPlayed() || !AudioContext) return false;
    armed = true;
    global.addEventListener('pointerdown', wake, true);
    global.addEventListener('keydown', wake, true);
    return true;
  }

  global.AXMSonicSignature = Object.freeze({
    version: '0.1.0',
    name: 'AXM Wake',
    bpm: bpm,
    motif: motif,
    arm: arm,
    playWake: playWake
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm, { once: true });
  } else {
    arm();
  }
})(window);
