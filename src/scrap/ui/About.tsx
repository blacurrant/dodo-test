import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { InfoIcon } from './icons';

/** The submission note, living inside the piece. Grows out of its button. */
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
        <InfoIcon className="about-icon" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label="About Handle With Care"
            className="about-panel"
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          >
            <p className="about-lede">
              A payment card that remembers how it’s treated. Throw it and the liquid metal breaks into
              halftone, then tears into glitch. Leave it alone and it heals.
            </p>
            <p>
              One input drives everything: the card’s angular speed feeds a single <em>stress</em> value,
              and the whole material — metal, dots, glitch — is one shader evaluated at that value.
            </p>
            <dl className="about-meta">
              <div>
                <dt>Built with</dt>
                <dd>Paper Shaders, React, Motion</dd>
              </div>
              <div>
                <dt>Physics</dt>
                <dd>Quaternion spring, 240 Hz fixed step</dd>
              </div>
              <div>
                <dt>For</dt>
                <dd>Dodo Payments, 2026</dd>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
