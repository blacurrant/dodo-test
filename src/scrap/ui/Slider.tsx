import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

interface Props {
  label: string;
  value: number;
  onChange(value: number): void;
  /** Words for the two ends, read out by screen readers and shown on hover. */
  ends: [string, string];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * A 0..1 instrument slider. The thumb glides to wherever you click, then
 * tracks the pointer 1:1 while dragging. Arrow keys step 0.05 (Shift: 0.1).
 */
export function Slider({ label, value, onChange, ends }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const fromPointer = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return clamp01((clientX - r.left) / r.width);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    onChange(round(fromPointer(e.clientX)));
    // The first move after the jump should track 1:1, not glide.
    requestAnimationFrame(() => setDragging(true));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setDragging(true);
    onChange(round(fromPointer(e.clientX)));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    const next = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      Home: 0,
      End: 1,
      PageUp: value + 0.25,
      PageDown: value - 0.25,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(round(clamp01(next)));
  };

  const pct = `${value * 100}%`;
  const word = value < 0.34 ? ends[0] : value > 0.66 ? ends[1] : 'medium';

  return (
    <div className="slider" data-dragging={dragging || undefined}>
      <div className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{value.toFixed(2)}</span>
      </div>
      <div
        ref={trackRef}
        className="slider-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(2)}, ${word}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span className="slider-rail" />
        {TICKS.map((t) => (
          <span key={t} className="slider-tick" style={{ left: `${t * 100}%` }} data-past={t <= value || undefined} />
        ))}
        <span className="slider-fill" style={{ width: pct }} />
        <span className="slider-thumb" style={{ left: pct }} />
      </div>
    </div>
  );
}

const round = (x: number) => Math.round(x * 100) / 100;
