// Small synthesised sounds (WebAudio only, no audio files): a blip for loot, a
// rising tone while the alarm climbs, a sting for being caught, a jingle for the
// getaway. Everything is lazy: the context is created on the first user gesture,
// and every call is safe when audio is unavailable.

export function createSound() {
  let ctx = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, seconds, type, gain, when = 0, slideTo = 0) {
    const audio = ensure();
    if (!audio) return;
    try {
      const t0 = audio.currentTime + when;
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + seconds);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      osc.connect(amp).connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + seconds + 0.05);
    } catch {
      // Sound is decoration: a failure never stops the game.
    }
  }

  return {
    ensure,
    pickup() { tone(880, 0.12, 'sine', 0.12); tone(1318, 0.14, 'sine', 0.1, 0.07); },
    coin() { tone(1568, 0.1, 'triangle', 0.1); },
    smoke() { tone(220, 0.35, 'sawtooth', 0.05, 0, 110); },
    dash() { tone(330, 0.12, 'sine', 0.06, 0, 520); },
    vault() { tone(523, 0.14, 'sine', 0.12); tone(659, 0.14, 'sine', 0.12, 0.1); tone(784, 0.2, 'sine', 0.12, 0.2); },
    spotted() { tone(440, 0.25, 'square', 0.07, 0, 660); },
    caught() { tone(196, 0.5, 'sawtooth', 0.12, 0, 98); tone(147, 0.6, 'sawtooth', 0.1, 0.15, 73); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.11, i * 0.13)); },
  };
}
