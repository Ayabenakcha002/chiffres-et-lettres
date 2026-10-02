// Petits effets sonores générés avec WebAudio (aucun fichier audio nécessaire).

let ctx = null;
let enabled = true;

function tone(freq, duration = 0.1, type = 'sine', volume = 0.07, delay = 0) {
  if (!enabled) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    /* audio indisponible : on ignore */
  }
}

export const sound = {
  get enabled() { return enabled; },
  set enabled(v) { enabled = !!v; },
  flip() { tone(520, 0.06, 'triangle'); },
  click() { tone(380, 0.04, 'triangle', 0.05); },
  tick() { tone(900, 0.05, 'square', 0.03); },
  ok() { tone(660, 0.1); tone(880, 0.2, 'sine', 0.08, 0.1); },
  fail() { tone(200, 0.3, 'sawtooth', 0.04); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, i * 0.12)); },
};
