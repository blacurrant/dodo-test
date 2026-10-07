import { useEffect, useState } from 'react';

const HINTS = [
  { code: 'Space', cap: 'Space', label: 'Flip' },
  { code: 'KeyS', cap: 'S', label: 'Shake' },
] as const;

/** Keycaps that physically press when you press the real key. */
export function KeyHints() {
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const set = (code: string, on: boolean) =>
      setDown((prev) => {
        if (prev.has(code) === on) return prev;
        const next = new Set(prev);
        if (on) next.add(code);
        else next.delete(code);
        return next;
      });
    const onDown = (e: KeyboardEvent) => set(e.code, true);
    const onUp = (e: KeyboardEvent) => set(e.code, false);
    const clear = () => setDown(new Set());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
    };
  }, []);

  return (
    <ul className="keys" aria-label="Keyboard shortcuts">
      {HINTS.map((h) => (
        <li key={h.code} className="key-hint">
          <kbd className="keycap" data-down={down.has(h.code) || undefined}>
            {h.cap}
          </kbd>
          <span>{h.label}</span>
        </li>
      ))}
    </ul>
  );
}
