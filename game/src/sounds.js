// sounds.js — semua bunyi disintesis WebAudio, tanpa file suara.
// Dengung mesin mengikuti throttle, desis angin mengikuti kecepatan,
// dan bunyi-bunyi peristiwa (cincin, paket, mendarat, jatuh).
export function makeSfx() {
  const sfx = {
    ctx: null, engine: null, engineGain: null, wind: null, windGain: null,
    muted: false,
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return true;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        // Mesin: dua osilator detuned + lowpass.
        this.engine = this.ctx.createOscillator();
        this.engine.type = "sawtooth";
        this.engine.frequency.value = 52;
        const sub = this.ctx.createOscillator();
        sub.type = "triangle";
        sub.frequency.value = 26;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filt = this.ctx.createBiquadFilter();
        filt.type = "lowpass"; filt.frequency.value = 420;
        this.engine.connect(filt); sub.connect(filt);
        filt.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
        this.engine.start(); sub.start();
        this._sub = sub;
        // Angin: noise buffer melalui bandpass.
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.wind = this.ctx.createBufferSource();
        this.wind.buffer = buf; this.wind.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 640; bp.Q.value = 0.6;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        this.wind.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.ctx.destination);
        this.wind.start();
        return true;
      } catch (e) { return false; }
    },
    update(throttle, speed, onGround) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const rpm = 42 + throttle * 88 + (onGround ? 0 : 8);
      this.engine.frequency.setTargetAtTime(rpm, t, 0.08);
      this._sub.frequency.setTargetAtTime(rpm / 2, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.02 + throttle * 0.055, t, 0.1);
      this.windGain.gain.setTargetAtTime(Math.min(0.06, Math.max(0, (speed - 18) / 92 * 0.07)), t, 0.15);
    },
    blip(freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    ring() { this.blip(660, 0.16, "sine", 0.16, 990); setTimeout(() => this.blip(990, 0.22, "sine", 0.14, 1320), 90); },
    drop() { this.blip(300, 0.14, "triangle", 0.12, 180); },
    dropGood() { this.blip(520, 0.14, "sine", 0.15, 780); setTimeout(() => this.blip(780, 0.2, "sine", 0.13, 1040), 100); },
    dropBad() { this.blip(220, 0.3, "sawtooth", 0.07, 110); },
    crash() { this.blip(140, 0.5, "sawtooth", 0.16, 45); },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, "triangle", 0.13), i * 130));
    },
    click() { this.blip(880, 0.06, "square", 0.05); },
  };
  return sfx;
}
