"use client";

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}
export function getSoundEnabled() {
  return enabled;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, c: AudioContext) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

export function playChip() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(1800, 0, 0.06, "square", 0.05, c);
  tone(2400, 0.03, 0.05, "square", 0.04, c);
}

export function playDeal() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(600, 0, 0.05, "triangle", 0.06, c);
}

export function playCheck() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(300, 0, 0.08, "sine", 0.06, c);
}

export function playFold() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(220, 0, 0.15, "sawtooth", 0.03, c);
}

export function playTurn() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(880, 0, 0.08, "sine", 0.05, c);
}

export function playWin() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.25, "triangle", 0.07, c));
}
