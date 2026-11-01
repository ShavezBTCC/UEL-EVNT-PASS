/** Tiny Web Audio chimes — no asset files needed, works offline. */
let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.25) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.05);
}

export function playSuccess() {
  try {
    tone(880, 0, 0.12);
    tone(1320, 0.12, 0.2);
  } catch {
    /* audio unavailable */
  }
}

export function playWarning() {
  try {
    tone(440, 0, 0.18, "square", 0.15);
    tone(440, 0.22, 0.18, "square", 0.15);
  } catch {
    /* ignore */
  }
}

export function playError() {
  try {
    tone(220, 0, 0.35, "sawtooth", 0.18);
  } catch {
    /* ignore */
  }
}

/** Call once on a user gesture (e.g. "Start camera") so iOS allows audio. */
export function unlockAudio() {
  try {
    getCtx();
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
