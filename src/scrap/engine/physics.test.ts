import { describe, expect, it } from 'vitest';
import {
  advance,
  BACK,
  createState,
  flipImpulse,
  FRONT,
  isBackFacing,
  shakeImpulse,
  STEP,
  type Params,
  type SimState,
} from './physics';
import { angleBetween, fromAxisAngle, fromRotVec, mul, rotate, toCssMatrix, toRotVec } from './quat';

const params: Params = { fragility: 0.5, recovery: 0.5 };
const free = { target: null };

function run(s: SimState, seconds: number, frameDt = 1 / 60, p = params) {
  let acc = 0;
  for (let t = 0; t < seconds; t += frameDt) acc = advance(s, free, p, frameDt, acc);
}

describe('quat', () => {
  it('round-trips rotation vectors', () => {
    const v: [number, number, number] = [0.3, -1.1, 0.4];
    const back = toRotVec(fromRotVec(v));
    back.forEach((x, i) => expect(x).toBeCloseTo(v[i], 6));
  });

  it('rotating about +y moves the normal toward +x (drag right turns the face right)', () => {
    const n = rotate(fromAxisAngle([0, 1, 0], 0.5), [0, 0, 1]);
    expect(n[0]).toBeGreaterThan(0);
  });

  it('builds an identity matrix3d', () => {
    expect(toCssMatrix([0, 0, 0, 1])).toBe(
      'matrix3d(1.000000,0.000000,0.000000,0.000000,0.000000,1.000000,0.000000,0.000000,0.000000,0.000000,1.000000,0.000000,0.000000,0.000000,0.000000,1.000000)',
    );
  });
});

describe('settling', () => {
  it('settles onto the front from a small tilt', () => {
    const s = createState(fromAxisAngle([0.6, 0.8, 0], 1.2));
    run(s, 3);
    expect(angleBetween(s.q, FRONT)).toBeLessThan(0.01);
    expect(isBackFacing(s.q)).toBe(false);
  });

  it('settles onto the back when the back is nearer', () => {
    const s = createState(fromAxisAngle([0, 1, 0], Math.PI - 0.9));
    run(s, 3);
    expect(angleBetween(s.q, BACK)).toBeLessThan(0.01);
    expect(isBackFacing(s.q)).toBe(true);
  });

  it('rights an upside-down card instead of resting on it', () => {
    const s = createState(mul(fromAxisAngle([0, 0, 1], Math.PI - 0.05), FRONT));
    run(s, 4);
    const toFront = angleBetween(s.q, FRONT);
    const toBack = angleBetween(s.q, BACK);
    expect(Math.min(toFront, toBack)).toBeLessThan(0.01);
  });
});

describe('flip', () => {
  it('flips front → back → front', () => {
    const s = createState();
    flipImpulse(s);
    run(s, 3);
    expect(angleBetween(s.q, BACK)).toBeLessThan(0.01);
    flipImpulse(s);
    run(s, 3);
    expect(angleBetween(s.q, FRONT)).toBeLessThan(0.01);
  });

  it('a flip is gentle — it should not break the card', () => {
    const s = createState();
    flipImpulse(s);
    let peak = 0;
    let acc = 0;
    for (let i = 0; i < 180; i++) {
      acc = advance(s, free, params, 1 / 60, acc);
      peak = Math.max(peak, s.stress);
    }
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThan(0.65);
  });
});

describe('stress', () => {
  it('a hard throw breaks the card, and it heals at rest', () => {
    const s = createState();
    let seed = 0.42;
    shakeImpulse(s, () => (seed = (seed * 9301 + 0.49297) % 1));
    let peak = 0;
    let acc = 0;
    for (let i = 0; i < 60; i++) {
      acc = advance(s, free, params, 1 / 60, acc);
      peak = Math.max(peak, s.stress);
    }
    expect(peak).toBeGreaterThan(0.95);
    run(s, 6);
    expect(s.stress).toBe(0);
  });

  it('fragility lowers the speed needed to break', () => {
    const at = (fragility: number) => {
      const s = createState();
      s.w = [0, 14, 0];
      advance(s, free, { fragility, recovery: 0.5 }, 1 / 60, 0);
      return s.stress;
    };
    expect(at(1)).toBeGreaterThan(at(0));
  });

  it('recovery controls how fast it heals', () => {
    const heal = (recovery: number) => {
      const s = createState(FRONT, 1);
      run(s, 1, 1 / 60, { fragility: 0.5, recovery });
      return s.stress;
    };
    expect(heal(1)).toBeLessThan(heal(0));
  });
});

describe('frame-rate independence', () => {
  it('60 Hz and 120 Hz displays produce the same motion', () => {
    const fling = () => {
      const s = createState(fromAxisAngle([0, 1, 0], 0.2));
      s.w = [3, 18, -1];
      return s;
    };
    const a = fling();
    const b = fling();
    // Same wall-clock duration, whole number of steps either way.
    const steps = 240;
    let acc = 0;
    for (let i = 0; i < 60; i++) acc = advance(a, free, params, 1 / 60, acc);
    acc = 0;
    for (let i = 0; i < 120; i++) acc = advance(b, free, params, 1 / 120, acc);
    expect(steps * STEP).toBeCloseTo(1, 9);
    expect(angleBetween(a.q, b.q)).toBeLessThan(0.02);
    expect(a.stress).toBeCloseTo(b.stress, 2);
  });
});
