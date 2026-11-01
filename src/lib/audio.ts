let ctx: AudioContext | null = null;

function getContext() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture (e.g. "Start camera") so iOS allows sound later. */
export function unlockAudio() {
  getContext();
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.2) {
  const ac = getContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function vibrate(pattern: number | number[]) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

export function playSuccess() {
  tone(880, 0, 0.12);
  tone(1320, 0.1, 0.22);
  vibrate(120);
}

export function playWarning() {
  tone(660, 0, 0.12, "triangle");
  tone(660, 0.18, 0.12, "triangle");
  vibrate([80, 60, 80]);
}

export function playError() {
  tone(160, 0, 0.4, "sawtooth", 0.15);
  vibrate([250]);
}
