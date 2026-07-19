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

// short filtered noise burst — the basis for the fold "card slide" and the
// check "knock", so they read as physical sounds rather than beeps
function noiseBurst(
  start: number,
  dur: number,
  gain: number,
  filterFreq: number,
  filterType: BiquadFilterType,
  c: AudioContext
) {
  const bufferSize = Math.ceil(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(c.currentTime + start);
  src.stop(c.currentTime + start + dur + 0.02);
}

// haptic pulse — light for your own actions, medium for winning a hand. Silently
// no-ops on desktop/unsupported browsers.
function haptic(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}

export function playChip() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  // two quick clinks of slightly different pitch, like two chips landing on a stack
  tone(2100, 0, 0.05, "square", 0.045, c);
  tone(2700, 0.045, 0.05, "square", 0.035, c);
  noiseBurst(0, 0.03, 0.02, 4000, "highpass", c);
}

// a raise gets a heavier, three-clink cascade instead of the plain call/check
// "two clinks" — the ear should be able to tell a raise happened without
// looking at the screen.
export function playRaise() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(1900, 0, 0.05, "square", 0.05, c);
  tone(2400, 0.05, 0.05, "square", 0.045, c);
  tone(3000, 0.1, 0.06, "square", 0.04, c);
  noiseBurst(0, 0.05, 0.03, 4500, "highpass", c);
}

// all-in: a low rising sweep under the chip cascade — meant to feel like a
// stack of everything hitting the felt at once, not just "a bigger raise"
export function playAllIn() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.35);
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.42);
  tone(2100, 0.1, 0.05, "square", 0.045, c);
  tone(2700, 0.15, 0.05, "square", 0.04, c);
  tone(3300, 0.2, 0.06, "square", 0.035, c);
  haptic([12, 30, 12, 30, 20]);
}

// a soft riffle-shuffle burst right as a new hand starts dealing
export function playShuffle() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  for (let i = 0; i < 5; i++) {
    noiseBurst(i * 0.045, 0.05, 0.025, 2600 + i * 200, "bandpass", c);
  }
}

// a single soft tick, meant to be called sparingly (last few seconds of your
// own turn) — deliberately quieter than playTurn so it doesn't nag
export function playCountdownTick() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(1200, 0, 0.04, "sine", 0.03, c);
}

export function playDeal() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  noiseBurst(0, 0.07, 0.05, 2200, "bandpass", c);
}

export function playCheck() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  // a soft "knock" — low thud with a fast decay, not a beep
  tone(140, 0, 0.09, "sine", 0.08, c);
  noiseBurst(0, 0.04, 0.03, 300, "lowpass", c);
}

export function playFold() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  // a card sliding off the felt — filtered noise sweep, no tonal beep
  noiseBurst(0, 0.18, 0.06, 1800, "bandpass", c);
}

export function playTurn() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(880, 0, 0.08, "sine", 0.05, c);
  haptic(20);
}

export function playWin() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.25, "triangle", 0.07, c));
  haptic([30, 40, 60]);
}

export function playYourAction() {
  haptic(15);
}
