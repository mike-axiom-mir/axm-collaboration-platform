export class PocketAudio {
  constructor(getEnabled) {
    this.getEnabled = getEnabled;
    this.context = null;
    this.master = null;
  }

  ensure() {
    if (!this.getEnabled()) return null;
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = .18;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
    return this.context;
  }

  tone(frequency, duration = .12, type = 'sine', offset = 0, volume = .2) {
    const context = this.ensure();
    if (!context) return;
    const at = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, frequency * .82), at + duration);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
  }

  click() { this.tone(310, .06, 'triangle', 0, .08); }
  travel() { this.tone(180, .2, 'sine', 0, .12); this.tone(260, .18, 'triangle', .08, .09); }
  success() { [330, 440, 660].forEach((note, index) => this.tone(note, .25, 'triangle', index * .07, .11)); }
  reaction() { [220, 370, 510, 760].forEach((note, index) => this.tone(note, .35, 'sine', index * .045, .08)); }
  portal() {
    const context = this.ensure();
    if (!context) return;
    for (let index = 0; index < 9; index += 1) {
      this.tone(110 + index * 53, .46 - index * .02, index % 2 ? 'sine' : 'triangle', index * .035, .07);
    }
  }
  unknown() { [90, 180, 720, 1440].forEach((note, index) => this.tone(note, .8, 'sawtooth', index * .12, .045)); }
}
