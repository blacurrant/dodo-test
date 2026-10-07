/**
 * Every sound is synthesised — no assets.
 *
 *  - Each token is a marimba note. Pitch comes from the token id on a major
 *    pentatonic scale (so any sentence is in key), octave from its length
 *    (short tokens ring high). The same word always plays the same notes.
 *  - Tiles landing make soft wood-block clacks, pitched by tile size.
 *  - Billing ticks coins up the scale and ends on a register "ka-ching".
 */

const PENTATONIC = [0, 2, 4, 7, 9];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let dry: GainNode | null = null;
let wet: GainNode | null = null;
let muted = false;
let lastClack = 0;

/** Must be called from a user gesture; browsers keep audio locked until then. */
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(comp).connect(ctx.destination);

  dry = ctx.createGain();
  dry.connect(master);
  // A short generated room so notes have somewhere to decay into.
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 1.6);
  wet = ctx.createGain();
  wet.gain.value = 0.22;
  wet.connect(verb).connect(master);
}

export function setMuted(m: boolean) {
  muted = m;
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.03);
}

export const isMuted = () => muted;

function impulse(c: AudioContext, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function out(gain: number, send = 0.5) {
  const g = ctx!.createGain();
  g.gain.value = gain;
  g.connect(dry!);
  const s = ctx!.createGain();
  s.gain.value = send;
  g.connect(s).connect(wet!);
  return g;
}

/** Deterministic note for a token. */
export function noteFor(id: number, length: number) {
  const h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  const degree = PENTATONIC[h % 5];
  const octave = length <= 2 ? 2 : length <= 5 ? 1 : 0;
  return 60 + octave * 12 + degree; // from C4
}

export function playToken(id: number, length: number, fragment = false, when = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + when;
  if (fragment) {
    // Byte shards: a dry, detuned digital blip.
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(mtof(84 + (id % 7)), t);
    o.frequency.exponentialRampToValueAtTime(mtof(72), t + 0.06);
    const g = out(0, 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.1);
    return;
  }
  const f = mtof(noteFor(id, length));
  const g = out(0, 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  // Fundamental + the marimba's characteristic 4th partial, which dies fast.
  const a = ctx.createOscillator();
  a.frequency.value = f;
  const b = ctx.createOscillator();
  b.frequency.value = f * 3.93;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.35, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  a.connect(g);
  b.connect(bg).connect(g);
  a.start(t);
  b.start(t);
  a.stop(t + 1);
  b.stop(t + 0.15);
}

/** A tile hitting something. `speed` in px/frame, `width` in px. */
export function playClack(speed: number, width: number) {
  if (!ctx || muted) return;
  const now = performance.now();
  if (now - lastClack < 28) return; // a pile settling shouldn't sound like hail
  lastClack = now;
  const t = ctx.currentTime;
  const level = Math.min(1, (speed - 1.2) / 9) * 0.22;
  if (level <= 0.005) return;
  const len = 0.05;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600 - Math.min(1, width / 220) * 1500;
  bp.Q.value = 7;
  const g = out(level, 0.12);
  src.connect(bp).connect(g);
  src.start(t);
}

export function playPoke() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  const g = out(0, 0.2);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.25);
}

/** One coin through the meter; `n` walks it up the scale. */
export function playCoin(n: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const step = n % 15;
  const m = 79 + Math.floor(step / 5) * 12 + PENTATONIC[step % 5];
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = mtof(m);
  const g = out(0, 0.35);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.2);
}

export function playKaching() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  [2093, 2637, 3136].forEach((f, i) => {
    const o = ctx!.createOscillator();
    o.frequency.value = f;
    const g = out(0, 0.6);
    const s = t + i * 0.055;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.09, s + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.9);
    o.connect(g);
    o.start(s);
    o.stop(s + 1);
  });
}

/** A thermal printer feeding one line: a short buzzy rasp. */
export function playPrint(lines = 1) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.min(0.32, 0.07 + lines * 0.035);
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    // Noise chopped at ~95 Hz — the stepper motor's grain.
    const gate = Math.sin((i / ctx.sampleRate) * Math.PI * 2 * 95) > 0 ? 1 : 0.35;
    d[i] = (Math.random() * 2 - 1) * gate;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 1.2;
  const g = out(0, 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
  g.gain.setValueAtTime(0.05, t + len - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp).connect(g);
  src.start(t);
}

/** The PAID stamp hitting paper. */
export function playStamp() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  const g = out(0, 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.2);
}

/** Paper tearing along the perforation. */
export function playTear() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = 0.28;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 + p * 0.4 ? 1 : 0.15) * (1 - p);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const g = out(0.09, 0.1);
  src.connect(hp).connect(g);
  src.start(t);
}

/** The dodo: two quick rising whistles with a little warble. */
export function playChirp() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  [0, 0.11].forEach((offset, i) => {
    const t = t0 + offset;
    const o = ctx!.createOscillator();
    o.type = 'sine';
    const base = i === 0 ? 1650 : 1900;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.55, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(base * 1.2, t + 0.1);
    // Warble.
    const lfo = ctx!.createOscillator();
    lfo.frequency.value = 38;
    const depth = ctx!.createGain();
    depth.gain.value = 60;
    lfo.connect(depth).connect(o.frequency);
    const g = out(0, 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.13);
    lfo.stop(t + 0.13);
  });
}

/** A rising arpeggio for the lime wave. */
export function playArp() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  [0, 4, 7, 12, 16].forEach((semi, i) => {
    const t = t0 + i * 0.07;
    const o = ctx!.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(72 + semi);
    const g = out(0, 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.4);
  });
}

/** A strawberry landing: a soft, round plop. */
export function playPlop(pitch = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const f = 520 + pitch * 40;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.09);
  const g = out(0, 0.15);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.12);
}

/** An egg cracking open: two shell snaps, then a little chime. */
export function playHatch() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  [0, 0.16].forEach((offset, i) => {
    const t = t0 + offset;
    const len = 0.045;
    const buf = ctx!.createBuffer(1, Math.floor(ctx!.sampleRate * len), ctx!.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / d.length, 4);
    const src = ctx!.createBufferSource();
    src.buffer = buf;
    const bp = ctx!.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200 + i * 1100;
    bp.Q.value = 5;
    const g = out(0.28, 0.1);
    src.connect(bp).connect(g);
    src.start(t);
  });
  [84, 88, 91].forEach((m, i) => {
    const t = t0 + 0.36 + i * 0.06;
    const o = ctx!.createOscillator();
    o.frequency.value = mtof(m);
    const g = out(0, 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.5);
  });
}

/** A refund: two notes stepping back down, like money returning. */
export function playRefund() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  [76, 69].forEach((m, i) => {
    const t = t0 + i * 0.09;
    const o = ctx!.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(m);
    const g = out(0, 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.3);
  });
}

/** A transaction declined: a short, low double buzz. */
export function playBlocked() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  [0, 0.13].forEach((offset) => {
    const t = t0 + offset;
    const o = ctx!.createOscillator();
    o.type = 'square';
    o.frequency.value = 130;
    const lp = ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = out(0, 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(lp).connect(g);
    o.start(t);
    o.stop(t + 0.11);
  });
}

/** A subscription renewing: a soft two-note chime. */
export function playRenew() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  [79, 84].forEach((m, i) => {
    const t = t0 + i * 0.1;
    const o = ctx!.createOscillator();
    o.frequency.value = mtof(m);
    const g = out(0, 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.55);
  });
}
