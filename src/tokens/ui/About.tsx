import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LEGEND, FRAGMENT } from '../palette';

/** The submission note, living inside the piece. */
export function About() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  return (
    <div className="about">
      <button
        ref={buttonRef}
        type="button"
        className="about-button"
        aria-label="About this piece"
        aria-expanded={open}
        aria-controls={id}
        data-open={open || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label="About Tokens"
            className="about-panel"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          >
            <p className="about-lede">
              AI products are billed by the token. This makes tokens something you can hold.
            </p>
            <p>
              Everything you type is split by the real o200k tokenizer (GPT‑4o, GPT‑5) and dropped into the pile. Each
              token is a note, so the same word always sounds the same. Tap tiles to play them, drag to throw, click
              empty space to poke. When you’re done, bill the pile.
            </p>
            <p className="about-try">
              Notice “Dodo” is two tokens, <b>D</b>·<b>odo</b>, and see what happens when you type it. Emoji
              shatter into raw bytes. The same sentence costs about 1.7× the tokens in Hindi and 2.3× in Japanese:
              the same meter, a different bill.
            </p>
            <div className="about-legend" aria-label="Tile colours">
              {[...LEGEND, FRAGMENT].map((s) => (
                <span key={s.name}>
                  <i style={{ background: s.bg }} />
                  {s.name}
                </span>
              ))}
            </div>
            <p className="about-foot">
              Colour is how rare a token is (its merge rank). Built with Paper Shaders, Matter.js, React and Motion.
              For Dodo Payments, 2026. <a href="/scrap/">See the scrapped first idea →</a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
