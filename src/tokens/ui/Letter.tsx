import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/** Shown under the letter when set. Left empty until the author signs it. */
const SIGNATURE = 'Nishant Choudhary';

interface Props {
  open: boolean;
  onClose(): void;
}

/**
 * The submission note, as a letter: why this, and why not the first idea.
 * Opens out of the nav button; Esc, the backdrop or the close button put it away.
 */
export function Letter({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="letter-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.25 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.article
            className="letter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="letter-title"
            initial={{ opacity: 0, y: -18, scale: 0.94, rotate: 1.2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <header className="letter-head">
              <span className="letter-mark" aria-hidden="true">
                <span>D</span>
                <span>odo</span>
              </span>
              <div>
                <h2 id="letter-title" className="letter-title">
                  Why dodo-play
                </h2>
                <p className="letter-sub">A short note for the Dodo Payments team</p>
              </div>
              <button ref={closeRef} type="button" className="letter-close" onClick={onClose} aria-label="Close the letter">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="letter-body">
              <p>Hi Dodo team,</p>
              <p>The brief ended with one line, and it ended up deciding everything:</p>
              <blockquote>Make something you’d want to keep playing with.</blockquote>
              <p>
                <b>My first idea was a payment card.</b> You could throw it around, and the harder you spun it, the more
                its liquid-metal finish broke into halftone and then glitch, healing when you left it alone. It looked
                good, and it’s still here as scrap. But once it was built I had to be honest: you throw it twice, see the
                effect, and you’re done. It was a card with an animation. It was the literal idea, and a dark, glitchy
                one that didn’t feel like Dodo at all.
              </p>
              <p>
                <b>So I went back to your site.</b> Dodo has become the billing layer for AI companies, and the words all
                over it are credits, usage metering and tokens. Everything an AI product sells is metered by the token,
                and nobody ever actually sees one.
              </p>
              <p>
                <b>dodo-play makes them something you can hold.</b> Every word you type is split by a real tokenizer and
                drops onto the shelf. Each token plays a note, so typing becomes a melody, and there’s always one more
                thing to find out. “Strawberry” is three tokens at the start of a line and one in the middle. An emoji
                shatters into raw bytes. The same sentence costs more in Hindi. And because Dodo is a Merchant of Record,
                the meter is a receipt printer: billing feeds every tile into the slot, stamps the receipt paid and tears
                it off.
              </p>
              <p>
                <b>The choices I cared about most:</b> real data, not fake (the actual o200k tokenizer, and pricing that
                always adds up to the token); sound as half the experience; and fitting into your visual world (white,
                the dot grid, one lime) instead of fighting it.
              </p>
              <p>
                <b>With more time,</b> I’d put different models’ tokenizers side by side, let you share a pile as a
                receipt link, and add prepaid credits that lock the input when they run out.
              </p>
              <p>Thanks for the open brief. It was a fun one.</p>
              {SIGNATURE && <p className="letter-sign">{SIGNATURE}</p>}
              <p className="letter-ps">P.S. Try typing “dodo”.</p>
            </div>

            <footer className="letter-foot">
              <a className="letter-link" href="/scrap/">
                See the scrapped idea
                <span aria-hidden="true">→</span>
              </a>
              <button type="button" className="letter-done" onClick={onClose}>
                Back to the toy
              </button>
            </footer>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
