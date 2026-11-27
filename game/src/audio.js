// Sound for Skycourier: Island Hopper — everything is synthesised with
// WebAudio, no audio files. An engine hum whose pitch follows throttle and
// speed, wind that rises with airspeed, a chime when a ring is scored or a
// delivery lands, a low thud for a hard touchdown and a noise burst for a
// crash. The AudioContext starts on the first user gesture, as browsers
// require; until then the game is silent, never blocked.

export function makeSound() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let silenced = false;

  function startEngine() {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    // Engine: a sawtooth through a lowpass, plus a sub octave for body.
    engineOsc = ctx.createOscillator();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 55;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 28;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    engineOsc.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    sub.start();
    // Wind: a looped brown-noise buffer through a bandpass, gain by airspeed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    wind.start();
    return true;
  }

  function ensure() {
    if (ctx) return true;
    try {
      return startEngine();
    } catch {
      return false;
    }
  }

  // Short beep: a sine blip at `freq` Hz for `dur` seconds, fading out.
  function tone(freq, dur, vol, when = 0) {
    if (!ctx || silenced) return;
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
      silenced = !silenced;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return silenced;
    },
    get muted() {
      return silenced;
    },
    // Engine hum: louder and higher with throttle, a little higher with
    // speed. Wind rises with airspeed and fades on the ground.
    engine(throttle, speed, flying) {
      if (!ctx || silenced || !engineGain) return;
      const target = flying ? 0.02 + throttle * 0.05 : throttle * 0.02;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(
        48 + throttle * 55 + speed * 0.35, ctx.currentTime, 0.1,
      );
      if (windGain) {
        const windTarget = flying ? Math.min(0.09, speed * 0.0011) : 0;
        windGain.gain.setTargetAtTime(windTarget, ctx.currentTime, 0.2);
        // Faster air rushes at a higher pitch.
        windFilter.frequency.setTargetAtTime(300 + speed * 6, ctx.currentTime, 0.2);
      }
    },
    ring() {
      tone(880, 0.22, 0.22);
      tone(1318, 0.3, 0.18, 0.09);
    },
    deliver() {
      tone(523, 0.18, 0.22);
      tone(659, 0.18, 0.22, 0.1);
      tone(784, 0.34, 0.22, 0.2);
    },
    thud() {
      tone(90, 0.25, 0.3);
    },
    crash() {
      if (!ctx || silenced) return;
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      tone(55, 0.5, 0.3);
    },
  };
}
