let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a user gesture (e.g. "Start camera") so iOS allows audio later. */
export function unlockAudio() {
  audio();
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.25) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export function playSuccess() {
  tone(880, 0, 0.12);
  tone(1318.5, 0.1, 0.22);
  vibrate(120);
}

export function playDuplicate() {
  tone(660, 0, 0.12, "triangle", 0.3);
  tone(660, 0.18, 0.12, "triangle", 0.3);
  vibrate([100, 80, 100]);
}

export function playError() {
  tone(160, 0, 0.45, "sawtooth", 0.18);
  vibrate([300]);
}
