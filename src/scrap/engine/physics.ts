import {
  angleBetween,
  conj,
  fromAxisAngle,
  fromRotVec,
  identity,
  mul,
  normalize,
  toRotVec,
  type Quat,
  type Vec3,
} from './quat';

/**
 * The card is a rigid body with one rotational degree of freedom per axis.
 * While dragged it springs toward the pointer's target orientation; when free
 * it coasts, then gets pulled into whichever face is nearer (a magnetic detent).
 *
 * Stress is the toy's only "material" input: it rises quickly with angular
 * speed and drains slowly at a rate set by `recovery`.
 */

export interface Params {
  /** 0 = tough, 1 = glass. How little spin it takes to break the card. */
  fragility: number;
  /** 0 = scars linger, 1 = heals fast. */
  recovery: number;
}

export interface SimState {
  q: Quat;
  /** Angular velocity, world space, rad/s. */
  w: Vec3;
  /** 0 = pristine, 1 = fully broken. */
  stress: number;
  /** A face the card has been told to go to (a flip), until it gets past halfway. */
  override: Quat | null;
}

export interface SimInput {
  /** Orientation the pointer is asking for, or null when the card is free. */
  target: Quat | null;
}

export const FRONT: Quat = identity();
export const BACK: Quat = fromAxisAngle([0, 1, 0], Math.PI);

export const STEP = 1 / 240;
const MAX_FRAME = 1 / 30;

export const TUNING = {
  dragStiffness: 520,
  dragDamping: 38,
  restStiffness: 70,
  restDampingSlow: 9,
  restDampingFast: 0.75,
  flipStiffness: 64,
  flipDampingRatio: 0.72,
  /** Spin speeds (rad/s) over which damping blends from slow to fast. */
  coastRange: [3, 13] as const,
  maxSpin: 70,
  /** Spin below this never stresses the card — idle wobble stays clean. */
  stressDeadZone: 1.8,
  /** Spin (rad/s) that fully breaks the card, at fragility 0 → 1. */
  breakSpeed: [26, 8] as const,
  stressAttack: 14,
  /** Stress drained per second, at recovery 0 → 1. */
  recoveryRate: [0.14, 1.25] as const,
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function createState(q: Quat = identity(), stress = 0): SimState {
  return { q, w: [0, 0, 0], stress, override: null };
}

export function nearestRest(q: Quat): Quat {
  return angleBetween(q, FRONT) <= angleBetween(q, BACK) ? FRONT : BACK;
}

export const speedOf = (s: SimState) => Math.hypot(s.w[0], s.w[1], s.w[2]);

/** Is the back of the card facing the viewer? */
export function isBackFacing(q: Quat): boolean {
  // z of the rotated card normal (0, 0, 1)
  return 1 - 2 * (q[0] * q[0] + q[1] * q[1]) < 0;
}

export function step(s: SimState, input: SimInput, p: Params, dt: number): void {
  const speed = speedOf(s);

  let k: number;
  let c: number;
  let goal: Quat;
  if (input.target) {
    s.override = null;
    goal = input.target;
    k = TUNING.dragStiffness;
    c = TUNING.dragDamping;
  } else if (s.override) {
    // A flip: a slightly under-damped spring straight to the other face.
    goal = s.override;
    k = TUNING.flipStiffness;
    c = 2 * Math.sqrt(k) * TUNING.flipDampingRatio;
    if (angleBetween(s.q, goal) < 0.02 && speed < 0.3) s.override = null;
  } else {
    goal = nearestRest(s.q);
    k = TUNING.restStiffness;
    c = mix(
      TUNING.restDampingSlow,
      TUNING.restDampingFast,
      smoothstep(TUNING.coastRange[0], TUNING.coastRange[1], speed),
    );
  }

  // World-space error rotation that would take us from q to the goal.
  const e = toRotVec(mul(goal, conj(s.q)));
  for (let i = 0; i < 3; i++) s.w[i] += (e[i] * k - s.w[i] * c) * dt;

  const spin = speedOf(s);
  if (spin > TUNING.maxSpin) {
    const f = TUNING.maxSpin / spin;
    for (let i = 0; i < 3; i++) s.w[i] *= f;
  }

  s.q = normalize(mul(fromRotVec([s.w[0] * dt, s.w[1] * dt, s.w[2] * dt]), s.q));

  // Stress
  const full = mix(TUNING.breakSpeed[0], TUNING.breakSpeed[1], clamp01(p.fragility));
  const dead = TUNING.stressDeadZone;
  const target = clamp01((speedOf(s) - dead) / (full - dead));
  if (target > s.stress) {
    s.stress += (target - s.stress) * (1 - Math.exp(-TUNING.stressAttack * dt));
  } else {
    const drain = mix(TUNING.recoveryRate[0], TUNING.recoveryRate[1], clamp01(p.recovery));
    s.stress = Math.max(target, s.stress - drain * dt);
  }
}

/**
 * Fixed-timestep integrator. Feed it the real frame delta; it runs whole
 * STEPs and returns the leftover so the renderer can interpolate.
 */
export function advance(
  s: SimState,
  input: SimInput,
  p: Params,
  frameDt: number,
  acc: number,
  onStep?: () => void,
): number {
  acc += Math.min(Math.max(frameDt, 0), MAX_FRAME);
  while (acc >= STEP) {
    onStep?.();
    step(s, input, p, STEP);
    acc -= STEP;
  }
  return acc;
}

/**
 * A keyboard/click flip. A free impulse lands on a face more or less at random
 * (the detent can bounce it on through), so a flip aims: it springs straight
 * to the other face. `wobble` adds a little off-axis spin so it feels thrown.
 */
export function flipImpulse(s: SimState, wobble = 0): void {
  s.override = nearestRest(s.q) === FRONT ? BACK : FRONT;
  s.w[0] += wobble;
}

/** Throw the card hard in a random direction — the "break it" shortcut. */
export function shakeImpulse(s: SimState, rand: () => number = Math.random): void {
  const a = rand() * Math.PI * 2;
  const tilt = (rand() - 0.5) * 0.8;
  const speed = 34 + rand() * 10;
  s.w = [Math.cos(a) * speed, Math.sin(a) * speed, tilt * speed];
}
