import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { splitInput } from '../composer';
import { tokenize, type Token } from '../tokenizer';
import { Tile } from './Tile';

export interface CommitOptions {
  /** Pastes rain in one tile at a time. */
  stagger?: number;
  /** Whether a person did this, or the intro typed it. */
  byUser?: boolean;
}

interface Props {
  ready: boolean;
  onCommit(text: string, tokens: Token[], rects: (DOMRect | null)[], opts?: CommitOptions): void;
  onUserInput(): void;
  /** Controls docked at the right end of the input. */
  tools?: ReactNode;
  /** Teach the space bar: show "space to drop" while a word is being typed. */
  dropHint?: boolean;
}

export interface ComposerHandle {
  /** Type one character as if from the keyboard (the intro uses this). */
  type(ch: string): void;
  focus(): void;
}

const HINTS = [
  'Type anything…',
  'Try writing “dodo”…',
  'Six secret words. Think payments…',
  'Try “strawberry”',
  'Try an emoji 🫠',
];

/**
 * A real <input> sits invisibly over a row of live token chips. While you type
 * a word you watch it split; when you hit space the chips lift out and fall.
 */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { ready, onCommit, onUserInput, tools, dropHint },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const composing = useRef(false);
  const [pending, setPending] = useState('');
  const [hint, setHint] = useState(0);
  const [focused, setFocused] = useState(false);
  const [drops, setDrops] = useState(0);
  const [spaceDown, setSpaceDown] = useState(false);

  // A lone space waiting for the next word isn't worth a chip.
  const tokens = useMemo(() => (ready && pending.trim() ? tokenize(pending) : []), [pending, ready]);

  useEffect(() => {
    if (pending) return;
    const id = window.setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2600);
    return () => window.clearInterval(id);
  }, [pending]);

  const commit = (texts: string[], previous: string, opts?: CommitOptions) => {
    for (const text of texts) {
      if (!text) continue;
      const toks = tokenize(text);
      // When the committed word is exactly what was on screen, hand the chips'
      // positions to the physics so the tiles lift out of the input in place.
      const rects =
        texts.length === 1 && text === previous ? toks.map((_, i) => chipRefs.current[i]?.getBoundingClientRect() ?? null) : [];
      onCommit(text, toks, rects, opts);
      setDrops((n) => n + 1);
    }
  };

  const apply = (value: string, byUser = true) => {
    if (!ready) {
      setPending(value);
      return;
    }
    const split = splitInput(value);
    commit(split.commits, pending, { byUser });
    setPending(split.pending);
    if (inputRef.current && inputRef.current.value !== split.pending) inputRef.current.value = split.pending;
  };

  useImperativeHandle(ref, () => ({
    type(ch: string) {
      if (ch === '\n') {
        commit([pending], pending, { byUser: false });
        setPending('');
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      apply(pending + ch, false);
    },
    focus() {
      inputRef.current?.focus({ preventScroll: true });
    },
  }));

  // When the tokenizer arrives, settle whatever was typed while it loaded.
  useEffect(() => {
    if (ready && pending) apply(pending, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="composer" data-focused={focused || undefined} data-empty={!pending || undefined}>
      {/* Re-keyed on every drop so the flash replays. */}
      {drops > 0 && <span key={drops} className="composer-flash" aria-hidden="true" />}
      <div className="composer-field">
        <div className="composer-row" aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {tokens.map((t, i) => (
              <motion.span
                key={`${i}:${t.id}`}
                className="composer-chip"
                layout="position"
                initial={{ opacity: 0, y: 6, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0 } }}
                transition={{ type: 'spring', stiffness: 700, damping: 36 }}
              >
                <Tile
                  token={t}
                  ref={(el) => {
                    chipRefs.current[i] = el;
                  }}
                />
              </motion.span>
            ))}
          </AnimatePresence>
          {!ready && pending && <span className="composer-raw">{pending}</span>}
          <span className="composer-caret" />
          {!pending.trim() && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={ready ? hint : 'loading'}
                className="composer-hint"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                {ready ? HINTS[hint] : 'Loading the tokenizer…'}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
        <input
          ref={inputRef}
          className="composer-input"
          aria-label="Type text to tokenize"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={(e) => {
            composing.current = false;
            apply(e.currentTarget.value);
          }}
          onInput={(e) => {
            onUserInput();
            if (!composing.current) apply(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              setSpaceDown(true);
              window.setTimeout(() => setSpaceDown(false), 140);
            }
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && pending) {
              e.preventDefault();
              commit([pending], pending, { byUser: true });
              setPending('');
              e.currentTarget.value = '';
            } else if (e.key === 'Escape') {
              setPending('');
              e.currentTarget.value = '';
            }
            // Keep the caret at the end — the chips only show an end caret.
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (el) el.setSelectionRange(el.value.length, el.value.length);
            });
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (!text || !ready) return;
            e.preventDefault();
            onUserInput();
            commit([pending + text], '', { stagger: 16, byUser: true });
            setPending('');
            e.currentTarget.value = '';
          }}
        />
      </div>
      <div className="composer-side">
        <AnimatePresence initial={false}>
          {tokens.length > 0 && (
            <motion.span
              className="composer-meta"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="composer-count" aria-live="polite">
                <b>{tokens.length}</b> {tokens.length === 1 ? 'token' : 'tokens'}
              </span>
              {dropHint && (
                <span className="composer-drop">
                  <kbd data-down={spaceDown || undefined}>space</kbd> to drop
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
        {tools}
      </div>
    </div>
  );
});
