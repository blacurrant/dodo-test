import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  swatch?: string;
  hint?: string;
}

interface Props<T extends string> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
}

/** A radio group whose selection pill slides between options. */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.id === value);
    const next = (i + dir + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className="seg" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className="seg-option"
            data-active={active || undefined}
            onClick={() => onChange(o.id)}
            title={o.hint}
          >
            {active && (
              <motion.span
                layoutId={`seg-pill-${label}`}
                className="seg-pill"
                transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }}
              />
            )}
            {o.swatch && <span className="seg-swatch" style={{ background: o.swatch }} />}
            <span className="seg-label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
