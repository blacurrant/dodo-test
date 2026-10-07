import type { MotionValue } from 'motion/react';
import type { ShaderMount } from '@paper-design/shaders';
import {
  advance,
  createState,
  flipImpulse,
  isBackFacing,
  shakeImpulse,
  STEP,
  type SimInput,
} from './physics';
import { fromRotVec, mul, nlerp, rotate, toCssMatrix, type Quat } from './quat';
import { finishById, settings } from '../state/settings';

/**
 * The one rAF loop. Owns the simulation and writes straight to its outputs —
 * the card's transform, the shader's uniforms and the stress MotionValue — so
 * React never re-renders per frame.
 */

export interface EngineTargets {
  /** Receives pointer input. Usually the whole viewport behind the UI. */
  stage: HTMLElement;
  /** The rotating card (preserve-3d). */
  card: HTMLElement;
  /** Wrapper that carries the idle float. */
  lift: HTMLElement;
  shadow: HTMLElement;
  shader: ShaderMount | null;
  stress: MotionValue<number>;
  reducedMotion: boolean;
}

export interface CardControls {
  flip(): void;
  shake(): void;
}

const HOVER_MAX = 0.24; // rad — how far the card leans toward the cursor
const TAP_SLOP = 5; // px
const TAP_TIME = 260; // ms
const VELOCITY_WINDOW = 90; // ms of pointer history used for the throw

const expLerp = (dt: number, rate: number) => 1 - Math.exp(-rate * dt);

export function startEngine(t: EngineTargets): CardControls & { dispose(): void } {
  // Arrive slightly turned and fully broken; the intro is the card healing.
  const sim = createState(fromRotVec([0.35, -0.55, 0.05]), 1);
  let prevQ: Quat = sim.q;
  const input: SimInput = { target: null };
  let acc = 0;
  let clock = 0;
  let last = performance.now();
  let raf = 0;

  // Hover lean (spring) and idle sway (amplitude fades out while dragging).
  const hoverTarget = [0, 0];
  const hover = [0, 0];
  const hoverVel = [0, 0];
  let sway = 1;
  // The idle float eases out on its own — zeroing it would make the card jump.
  let bob = 1;

  const finish = finishById(settings.get().finish);
  const deep = [...finish.deep] as [number, number, number];
  const light = [...finish.light] as [number, number, number];

  let drag: {
    id: number;
    x0: number;
    y0: number;
    t0: number;
    q0: Quat;
    moved: boolean;
    samples: { t: number; x: number; y: number }[];
  } | null = null;

  let renderQ: Quat = sim.q;
  let lastStress = -1;

  const radPerPx = () => Math.PI / (t.card.offsetWidth * 1.15 || 400);

  // Card centre, cached — reading layout on every pointermove would force a
  // style flush right after our transform writes.
  let centre = { x: 0, y: 0 };
  const measure = () => {
    const r = t.lift.getBoundingClientRect();
    centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  measure();
  // The card rises into place on load; measure again once it has landed.
  const settleTimer = window.setTimeout(measure, 1400);

  function idleRotVec(time: number): [number, number, number] {
    const amp = t.reducedMotion ? 0.25 : 1;
    return [
      (-hover[1] * HOVER_MAX + Math.sin(time * 0.7) * 0.03 * sway * amp),
      (hover[0] * HOVER_MAX + Math.sin(time * 0.53 + 1.3) * 0.045 * sway * amp),
      Math.sin(time * 0.41 + 0.4) * 0.012 * sway * amp,
    ];
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const time = now / 1000;
    const s = settings.get();

    acc = advance(sim, input, s, dt, acc, () => {
      prevQ = sim.q;
    });
    const alpha = acc / STEP;
    const simQ = nlerp(prevQ, sim.q, alpha);

    // Hover spring (critically damped-ish) — only when not dragging.
    for (let i = 0; i < 2; i++) {
      const target = drag ? 0 : hoverTarget[i];
      hoverVel[i] += ((target - hover[i]) * 70 - hoverVel[i] * 15) * dt;
      hover[i] += hoverVel[i] * dt;
    }
    sway += ((drag ? 0 : 1) - sway) * expLerp(dt, 1.2);
    bob += ((drag ? 0 : 1) - bob) * expLerp(dt, drag ? 5 : 1.2);

    renderQ = mul(fromRotVec(idleRotVec(time)), simQ);

    const floatY = t.reducedMotion ? 0 : Math.sin(time * 0.9) * 5 * bob;
    t.lift.style.transform = `translate3d(0, ${floatY.toFixed(2)}px, 0)`;
    t.card.style.transform = toCssMatrix(renderQ);

    const n = rotate(renderQ, [0, 0, 1]);
    const back = isBackFacing(renderQ);
    const facing = Math.abs(n[2]);
    t.shadow.style.transform = `translate3d(0, ${(-floatY * 0.4).toFixed(2)}px, 0) scale(${(0.5 + 0.5 * facing - floatY * 0.006).toFixed(3)}, 1)`;
    t.shadow.style.opacity = (0.45 + 0.55 * facing).toFixed(3);

    // Finish colours ease toward the selected finish.
    const f = finishById(s.finish);
    const k = expLerp(dt, 7);
    for (let i = 0; i < 3; i++) {
      deep[i] += (f.deep[i] - deep[i]) * k;
      light[i] += (f.light[i] - light[i]) * k;
    }

    const stress = sim.stress;
    clock += dt * (1 + stress * 1.6);

    t.shader?.setUniforms({
      u_clock: clock,
      u_stress: stress,
      u_back: back ? 1 : 0,
      u_tilt: back ? [-n[0], n[1]] : [n[0], n[1]],
      // Fresh arrays: ShaderMount caches uniforms by reference, so a mutated
      // array would never be re-uploaded.
      u_deep: [deep[0], deep[1], deep[2]],
      u_light: [light[0], light[1], light[2]],
    });

    // Always deliver the endpoints, or the UI can be left a hair above zero.
    const settled = stress === 0 || stress === 1;
    if (stress !== lastStress && (settled || Math.abs(stress - lastStress) > 1e-4)) {
      lastStress = stress;
      t.stress.set(stress);
    }
  }

  // ── Pointer ──────────────────────────────────────────────────────────────
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || drag) return;
    t.stage.setPointerCapture(e.pointerId);
    // Bake the lean + sway into the body so grabbing never jumps.
    sim.q = renderQ;
    prevQ = renderQ;
    hover[0] = hover[1] = hoverVel[0] = hoverVel[1] = 0;
    sway = 0;
    // Holding without moving pins the card where it is.
    input.target = renderQ;
    const now = performance.now();
    drag = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: now,
      q0: renderQ,
      moved: false,
      samples: [{ t: now, x: e.clientX, y: e.clientY }],
    };
    document.documentElement.dataset.dragging = '';
  }

  function onPointerMove(e: PointerEvent) {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > TAP_SLOP) drag.moved = true;
      if (drag.moved) {
        const k = radPerPx();
        input.target = mul(fromRotVec([-dy * k, dx * k, 0]), drag.q0);
      }
      const now = performance.now();
      drag.samples.push({ t: now, x: e.clientX, y: e.clientY });
      while (drag.samples.length > 2 && now - drag.samples[0].t > VELOCITY_WINDOW) {
        drag.samples.shift();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      hoverTarget[0] = clampUnit((e.clientX - centre.x) / (window.innerWidth / 2));
      hoverTarget[1] = clampUnit((e.clientY - centre.y) / (window.innerHeight / 2));
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const now = performance.now();
    const wasTap = !drag.moved && now - drag.t0 < TAP_TIME;
    if (drag.moved) {
      const first = drag.samples[0];
      const lastS = drag.samples[drag.samples.length - 1];
      const span = (lastS.t - first.t) / 1000;
      // Pointer stopped before release → no throw, let the spring settle.
      const stale = now - lastS.t > 60;
      if (span > 0.008 && !stale) {
        const k = radPerPx();
        const vx = (lastS.x - first.x) / span;
        const vy = (lastS.y - first.y) / span;
        sim.w = [-vy * k, vx * k, sim.w[2] * 0.5];
      }
    }
    input.target = null;
    drag = null;
    delete document.documentElement.dataset.dragging;
    if (wasTap) controls.flip();
  }

  function onPointerLeave() {
    hoverTarget[0] = hoverTarget[1] = 0;
  }

  const controls: CardControls = {
    flip() {
      flipImpulse(sim, (Math.random() - 0.5) * 1.6);
    },
    shake() {
      shakeImpulse(sim);
    },
  };

  t.stage.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('resize', measure);
  raf = requestAnimationFrame(frame);

  return {
    ...controls,
    dispose() {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      t.stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', measure);
      delete document.documentElement.dataset.dragging;
    },
  };
}

function clampUnit(x: number) {
  return Math.max(-1, Math.min(1, x));
}
