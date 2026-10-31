let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture (e.g. "Start camera") so iOS allows later sounds. */
export function unlockAudio() {
  getCtx();
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", volume = 0.25) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function vibrate(pattern: number | number[]) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

export function playSuccess() {
  tone(880, 0, 0.12);
  tone(1320, 0.1, 0.2);
  vibrate(120);
}

export function playWarning() {
  tone(660, 0, 0.12, "triangle");
  tone(660, 0.18, 0.12, "triangle");
  vibrate([80, 60, 80]);
}

export function playError() {
  tone(160, 0, 0.45, "sawtooth", 0.18);
  vibrate([250]);
}
