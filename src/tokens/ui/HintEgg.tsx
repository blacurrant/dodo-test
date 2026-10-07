import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { SECRETS, type Secret } from '../composer';
import { playHatch } from '../audio';

/** A nudge, not the answer. */
const HINTS: Record<Secret, string> = {
  dodo: 'The bird on the logo.',
  refund: 'Changed your mind? Get the last one back.',
  subscription: 'Pay once. And again. And again…',
  fraud: 'Something the checks should catch before it’s charged.',
  checkout: 'Where a cart goes to become a payment.',
  global: '220+ countries, 80+ currencies, one word.',
};

/** "refund" → "r_____": the first letter and the word's length. */
const shape = (word: string) => word[0] + '_'.repeat(word.length - 1);

type EggState = 'whole' | 'cracking' | 'open';

/**
 * A little egg on the shelf. It wiggles every few seconds until someone
 * cracks it open; inside are the hints for the six secret words.
 */
export function HintEgg({ found }: { found: Secret[] }) {
  const [state, setState] = useState<EggState>('whole');
  const [open, setOpen] = useState(false);
  // useId can contain characters that break url(#…) references in SVG.
  const ids = `egg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const complete = found.length === SECRETS.length;

  const onClick = () => {
    if (state === 'open') {
      setOpen(true);
      return;
    }
    if (state === 'cracking') return;
    setState('cracking');
    playHatch();
    window.setTimeout(() => {
      setState('open');
      setOpen(true);
    }, 420);
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      buttonRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const top = `${ids}-top`;
  const bottom = `${ids}-bottom`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="hint-egg"
        data-state={state}
        data-complete={complete || undefined}
        onClick={onClick}
        aria-label="Hints for the secret words"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg viewBox="0 0 32 40" aria-hidden="true">
          <defs>
            <clipPath id={top}>
              <path d="M0 0H32V20.5H27l-3.5 3L20 20l-4 4-3.5-4L9 24l-4-3H0z" />
            </clipPath>
            <clipPath id={bottom}>
              <path d="M0 21h5l4 3 3.5-4 3.5 4 4-4 3.5 3.5 3.5-3H32V40H0z" />
            </clipPath>
          </defs>
          <g className="egg-sparkle">
            <path d="M16 10l1.2 3.2L20.4 14l-3.2 1.2L16 18.4l-1.2-3.2-3.2-1.2 3.2-.8z" />
          </g>
          <g clipPath={`url(#${bottom})`}>
            <EggShell />
          </g>
          <g className="egg-top" clipPath={`url(#${top})`}>
            <EggShell />
          </g>
          <path className="egg-zig" d="M5 21l4 3 3.5-4 3.5 4 4-4 3.5 3.5 3.5-3" />
        </svg>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="letter-scrim hints-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <motion.section
                className="hints"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${ids}-title`}
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.16 } }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              >
                <header className="hints-head">
                  <div>
                    <h2 id={`${ids}-title`} className="hints-title">
                      Six secret words
                    </h2>
                    <p className="hints-sub">
                      Type one on its own and see what it does · <b>{found.length}</b> of {SECRETS.length} found
                    </p>
                  </div>
                  <button ref={closeRef} type="button" className="letter-close" onClick={() => setOpen(false)} aria-label="Close hints">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </header>
                <ol className="hints-list">
                  {SECRETS.map((word) => {
                    const got = found.includes(word);
                    return (
                      <li key={word} className="hints-row" data-found={got || undefined}>
                        <span className="hints-mark" aria-hidden="true">
                          {got ? '✓' : ''}
                        </span>
                        <span className="hints-word" aria-label={got ? word : `${word.length} letters, starts with ${word[0]}`}>
                          {got ? word : shape(word)}
                        </span>
                        <span className="hints-clue">{HINTS[word]}</span>
                      </li>
                    );
                  })}
                </ol>
                <footer className="hints-foot">
                  <span>{complete ? 'All six. You know payments.' : 'Every word they summon is still billed honestly.'}</span>
                  <button type="button" className="letter-done" onClick={() => setOpen(false)}>
                    Got it
                  </button>
                </footer>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function EggShell() {
  return (
    <>
      <path d="M16 2c6.6 0 12 10.5 12 20.5C28 31 22.6 37 16 37S4 31 4 22.5C4 12.5 9.4 2 16 2z" className="egg-shell" />
      <g className="egg-speckles">
        <circle cx="11" cy="17" r="1.3" />
        <circle cx="19.5" cy="11" r="1" />
        <circle cx="21" cy="26" r="1.6" />
        <circle cx="11.5" cy="29" r="1.1" />
        <circle cx="17" cy="20" r=".8" />
      </g>
    </>
  );
}
