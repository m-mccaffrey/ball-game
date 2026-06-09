// audio.js — tiny WebAudio synth. No assets, everything is generated.

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

// Call from the first user gesture so the context is allowed to start.
export function unlock() {
  ensure();
}

function tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.3, slide = 0, delay = 0 }) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const PHASE_FREQ = { m: 392, y: 440, g: 494, c: 587 };

export function playSwitch(color, restored) {
  const f = PHASE_FREQ[color] || 440;
  tone({ freq: restored ? f * 0.75 : f, type: 'square', dur: 0.1, vol: 0.12 });
  tone({ freq: (restored ? f * 0.75 : f) * 2, type: 'sine', dur: 0.12, vol: 0.08 });
}

export function playBounce(mag) {
  tone({ freq: 120 + 140 * mag, type: 'sine', dur: 0.08, vol: 0.10 + 0.12 * mag, slide: -60 });
}

export function playCollect() {
  tone({ freq: 660, type: 'triangle', dur: 0.12, vol: 0.22 });
  tone({ freq: 880, type: 'triangle', dur: 0.16, vol: 0.2, delay: 0.07 });
  tone({ freq: 1320, type: 'sine', dur: 0.22, vol: 0.16, delay: 0.14 });
}

export function playWin() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.28, vol: 0.18, delay: i * 0.09 }));
}

export function playDeath() {
  tone({ freq: 220, type: 'sawtooth', dur: 0.3, vol: 0.16, slide: -150 });
  tone({ freq: 110, type: 'square', dur: 0.35, vol: 0.1, slide: -70, delay: 0.04 });
}

export function playClick() {
  tone({ freq: 700, type: 'sine', dur: 0.05, vol: 0.1 });
}

export function playBoing() {
  tone({ freq: 180, type: 'triangle', dur: 0.16, vol: 0.26, slide: 320 });
  tone({ freq: 90, type: 'sine', dur: 0.1, vol: 0.14, slide: 80 });
}

export function playWarp() {
  tone({ freq: 1100, type: 'sine', dur: 0.22, vol: 0.18, slide: -700 });
  tone({ freq: 300, type: 'sine', dur: 0.25, vol: 0.16, slide: 900, delay: 0.08 });
}
