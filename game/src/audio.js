// Sound for Skycourier: everything is synthesised with WebAudio, no audio
// files. An engine hum whose pitch follows throttle and speed, a chime when a
// ring is scored or a delivery lands, a low thud for a hard touchdown and a
// noise burst for a crash. The AudioContext starts on the first user gesture,
// as browsers require; until then the game is silent, never blocked.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = "sawtooth";
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  // Short beep: a sine blip at `freq` Hz for `dur` seconds, fading out.
  function blip(freq, dur, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    // Call on any user gesture so the context is allowed to start.
    unlock() {
      if (ensure() && ctx.state === "suspended") void ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
    get muted() {
      return muted;
    },
    // Engine hum: louder and higher with throttle, a little higher with speed.
    engine(throttle, speed, flying) {
      if (!ctx || muted || !engineGain) return;
      const target = flying ? 0.02 + throttle * 0.05 : throttle * 0.02;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 55 + speed * 0.35, ctx.currentTime, 0.1);
    },
    ring() {
      blip(880, 0.22, 0.22);
      blip(1318, 0.3, 0.18, 0.09);
    },
    deliver() {
      blip(523, 0.18, 0.22);
      blip(659, 0.18, 0.22, 0.1);
      blip(784, 0.34, 0.22, 0.2);
    },
    thud() {
      blip(90, 0.25, 0.3);
    },
    crash() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      blip(55, 0.5, 0.3);
    },
  };
}
