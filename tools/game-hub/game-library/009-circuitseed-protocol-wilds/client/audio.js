(function () {
  'use strict';

  class CircuitAudio {
    constructor() {
      this.context = null;
      this.master = null;
      this.volume = 0.35;
      this.ambient = null;
    }
    async unlock() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return true;
    }
    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, Number(value) || 0));
      if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.03);
    }
    tone(frequency, duration, options = {}) {
      if (!this.context || !this.master || this.volume <= 0) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = options.type || 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.endFrequency || frequency * 1.08), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(options.gain || 0.08, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain); gain.connect(this.master);
      oscillator.start(now); oscillator.stop(now + duration + 0.02);
    }
    scan() { this.tone(310, 0.36, { endFrequency: 980, gain: 0.06, type: 'sine' }); }
    connect() { this.tone(220, 0.45, { endFrequency: 440, gain: 0.055, type: 'triangle' }); setTimeout(() => this.tone(330, 0.35, { endFrequency: 660, gain: 0.04 }), 90); }
    confirm() { this.tone(440, 0.18, { endFrequency: 660, gain: 0.055 }); setTimeout(() => this.tone(660, 0.22, { endFrequency: 880, gain: 0.045 }), 100); }
    warn() { this.tone(170, 0.28, { endFrequency: 130, gain: 0.055, type: 'sawtooth' }); }
    encounter(action) {
      const base = { Scan: 420, Anchor: 180, Shield: 260, Patch: 330, Reroute: 520, Challenge: 210, Isolate: 145, Synchronize: 620 }[action] || 300;
      this.tone(base, 0.24, { endFrequency: base * 1.35, gain: 0.05, type: action === 'Challenge' ? 'square' : 'triangle' });
    }
    startAmbient() {
      if (!this.context || this.ambient || this.volume <= 0) return;
      const oscillator = this.context.createOscillator();
      const lfo = this.context.createOscillator();
      const lfoGain = this.context.createGain();
      const gain = this.context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 58;
      lfo.type = 'sine'; lfo.frequency.value = 0.08; lfoGain.gain.value = 8;
      lfo.connect(lfoGain); lfoGain.connect(oscillator.frequency);
      gain.gain.value = 0.018;
      oscillator.connect(gain); gain.connect(this.master);
      oscillator.start(); lfo.start();
      this.ambient = { oscillator, lfo, gain };
    }
    stopAmbient() {
      if (!this.ambient) return;
      try { this.ambient.oscillator.stop(); this.ambient.lfo.stop(); } catch (error) {}
      this.ambient = null;
    }
  }

  window.CircuitAudio = CircuitAudio;
})();
