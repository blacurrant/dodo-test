import { memo } from 'react';

/**
 * Rolling digits. Each digit is a 0–9 strip that slides to its value, so a
 * changing number reads as a mechanical counter rather than flickering text.
 * Columns are keyed from the right so they keep their identity as the number
 * grows.
 */
export const Odometer = memo(function Odometer({ value, className }: { value: string; className?: string }) {
  const chars = [...value];
  return (
    <span className={`odo ${className ?? ''}`} aria-label={value} role="text">
      {chars.map((ch, i) => {
        const key = chars.length - i;
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${key}`} className="odo-static" aria-hidden="true">
              {ch}
            </span>
          );
        }
        const d = Number(ch);
        return (
          <span key={`d${key}`} className="odo-col" aria-hidden="true">
            <span className="odo-strip" style={{ transform: `translateY(${-d * 10}%)` }}>
              {'0123456789'.split('').map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
});
