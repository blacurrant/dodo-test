import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion } from 'motion/react';
import { stressValue } from '../card/Card';

type Condition = 'intact' | 'worn' | 'broken';

const TICKS = 24;
const detent = (f: number) => {
  const t = Math.min(1, Math.max(0, (f - 0.8) / 0.2));
  return t * t * (3 - 2 * t);
};
const conditionOf = (v: number): Condition => (v < 0.3 ? 'intact' : v < 0.68 ? 'worn' : 'broken');

/**
 * Live readout of the card's stress. Everything here is written straight to
 * the DOM from the stress MotionValue; React only re-renders when the
 * condition label changes.
 */
export function StressMeter() {
  const rootRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null);
  const odoRef = useRef<HTMLSpanElement>(null);
  const [condition, setCondition] = useState<Condition>(() => conditionOf(stressValue.get()));

  useEffect(() => {
    const root = rootRef.current!;
    const ticks = Array.from(ticksRef.current!.children) as HTMLElement[];
    const columns = Array.from(odoRef.current!.querySelectorAll<HTMLElement>('[data-col]'));
    let lit = -1;
    let cond = conditionOf(stressValue.get());
    let lastAria = 0;

    const update = (v: number) => {
      // Odometer: each wheel holds its digit, then rolls to the next over the
      // last fifth of a step (a detent) — readable at rest, alive in motion.
      // Higher wheels roll only while the wheel below passes 9 → 0.
      const x = Math.min(100, Math.max(0, v * 100));
      const roll = detent(x % 1);
      const units = [100, 10, 1]; // ones, tenths, hundredths of the 0.00 readout
      columns.forEach((col, i) => {
        const unit = units[i];
        const carrying = x % unit >= unit - 1;
        const pos = (Math.floor(x / unit) % 10) + (carrying ? roll : 0);
        col.style.transform = `translateY(${(-pos * 100) / 11}%)`;
      });

      const n = Math.round(v * TICKS);
      if (n !== lit) {
        lit = n;
        ticks.forEach((t, i) => {
          t.toggleAttribute('data-on', i < n);
          t.toggleAttribute('data-head', i === n - 1);
        });
      }

      const next = conditionOf(v);
      if (next !== cond) {
        if (next === 'broken') {
          animate(root, { x: [0, -3, 3, -2, 1.5, 0] }, { duration: 0.34, ease: 'easeOut' });
        }
        cond = next;
        setCondition(next);
      }

      const now = performance.now();
      if (now - lastAria > 250) {
        lastAria = now;
        root.setAttribute('aria-valuenow', v.toFixed(2));
      }
    };

    update(stressValue.get());
    return stressValue.on('change', update);
  }, []);

  return (
    <div
      ref={rootRef}
      className="meter"
      data-condition={condition}
      role="meter"
      aria-label="Card stress"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuetext={condition}
    >
      <div className="meter-head">
        <span className="meter-label">Stress</span>
        <span className="odo" ref={odoRef} aria-hidden="true">
          <OdoColumn />
          <span className="odo-dot">.</span>
          <OdoColumn />
          <OdoColumn />
        </span>
      </div>
      <div className="meter-ticks" ref={ticksRef} aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <i key={i} data-hot={i >= TICKS * 0.68 ? '' : undefined} />
        ))}
      </div>
      <div className="meter-state">
        <span className="meter-dot" />
        <span className="meter-word">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={condition}
              initial={{ opacity: 0, y: 7, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -7, filter: 'blur(3px)' }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              {condition}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}

function OdoColumn() {
  return (
    <span className="odo-col">
      <span className="odo-strip" data-col="">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </span>
    </span>
  );
}
