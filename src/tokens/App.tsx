import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, type HTMLMotionProps } from 'motion/react';
import { MeshGradient } from '@paper-design/shaders-react';
import { loadTokenizer, tokenizerReady, type Token } from './tokenizer';
import { World, type TileInfo } from './world';
import { isMuted, playPrint, playRenew, playStamp, playTear, setMuted, unlockAudio } from './audio';
import { swatchFor } from './palette';
import { Composer, type ComposerHandle, type CommitOptions } from './ui/Composer';
import { isStrawberry, secretWord, type Secret } from './composer';
import { Register, type LineItem, type Receipt } from './ui/Register';
import { Shelf } from './ui/Shelf';
import { About } from './ui/About';
import { Letter } from './ui/Letter';

const INTRO = 'Everything you type gets metered.\n';
/** How long the PAID stamp sits on the receipt before it tears off. */
const STAMP_HOLD = 1150;
/** The one-line note under the input when a secret word is found. */
const SECRET_NOTES: Record<Secret, string> = {
  dodo: 'dodo: one dodo, delivered',
  refund: 'refund: last line refunded',
  subscription: 'subscription: renews 3 more times',
  fraud: 'fraud: blocked, never charged',
  checkout: 'checkout: billing the pile',
  global: 'global: 80+ currencies, one meter',
};
/** How often, and how many times, a subscription renews itself. */
const RENEW_EVERY = 2200;
const RENEWALS = 3;

/** After this many words dropped by hand, the "space to drop" hint retires. */
const DROPS_TO_LEARN = 3;
/** The one-time "tap a tile" line stays this long unless the pile is touched first. */
const COACH_MS = 6500;

const enter = (delay: number, y = 8): HTMLMotionProps<'div'> => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
});

export function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const worldRef = useRef<World | null>(null);
  const introRef = useRef<number | null>(null);
  const itemKey = useRef(0);
  const billingRef = useRef(false);
  /** Words dropped while a bill is in progress belong on the next receipt. */
  const queuedRef = useRef<LineItem[]>([]);
  /** The live receipt, for the secret words that act on its lines. */
  const receiptRef = useRef<LineItem[]>([]);
  const renewTimers = useRef<number[]>([]);

  const [ready, setReady] = useState(tokenizerReady());
  const [pile, setPile] = useState(0);
  const [billed, setBilled] = useState(0);
  const [billing, setBilling] = useState(false);
  const [paid, setPaid] = useState(false);
  const [receipt, setReceipt] = useState<Receipt>(() => ({ no: 1, opened: new Date(), items: [] }));
  receiptRef.current = receipt.items;
  const [muted, setMutedState] = useState(isMuted());
  const [hover, setHover] = useState<{ info: TileInfo; x: number; y: number } | null>(null);

  // Contextual hints: each appears only when relevant and retires once learned.
  const [userDrops, setUserDrops] = useState(0);
  const [coach, setCoach] = useState<'idle' | 'showing' | 'done'>('idle');
  const [hasBilled, setHasBilled] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterRead, setLetterRead] = useState(false);
  const [found, setFound] = useState<Secret[]>([]);
  const [note, setNote] = useState<{ key: number; text: string } | null>(null);
  const showNote = useCallback((text: string) => setNote({ key: Date.now(), text }), []);
  const closeLetter = useCallback(() => setLetterOpen(false), []);
  const coachRef = useRef(coach);
  coachRef.current = coach;

  useEffect(() => {
    loadTokenizer().then(() => setReady(true));
  }, []);

  const stopIntro = useCallback(() => {
    if (introRef.current !== null) {
      window.clearTimeout(introRef.current);
      introRef.current = null;
    }
  }, []);

  const bill = useCallback(() => {
    const world = worldRef.current;
    if (!world || !world.count || billingRef.current) return;
    stopIntro();
    // Nothing billable (say, only blocked tiles left): don't start a bill that can't finish.
    if (!world.bill()) return;
    billingRef.current = true;
    setBilling(true);
    setHasBilled(true);
  }, [stopIntro]);

  // When the last tile lands: stamp PAID, hold, tear off, open a fresh receipt.
  const onBillDone = useCallback(() => {
    setPaid(true);
    playStamp();
    window.setTimeout(() => {
      playTear();
      setPaid(false);
      const items = queuedRef.current;
      queuedRef.current = [];
      setReceipt((r) => ({ no: r.no + 1, opened: new Date(), items }));
      billingRef.current = false;
      setBilling(false);
    }, STAMP_HOLD);
  }, []);

  useEffect(() => {
    const world = new World(stageRef.current!, layerRef.current!, {
      onPileChange: setPile,
      onBilled: (n) => setBilled((b) => b + n),
      onBillDone,
      onHover: (info, x, y) => setHover(info ? { info, x, y } : null),
      onTouch: () => {
        stopIntro();
        if (coachRef.current !== 'done') setCoach('done');
      },
      onFull: () => bill(),
      billTarget: () => {
        const r = slotRef.current?.getBoundingClientRect();
        return r
          ? { x: r.left + r.width / 2, y: r.top + r.height / 2, spread: r.width * 0.6 }
          : { x: window.innerWidth - 160, y: window.innerHeight - 120, spread: 0 };
      },
      bounds: () => {
        // The pile lives in the workspace column: from the frame line to the divider.
        const shelf = document.querySelector<HTMLElement>('.shelf');
        const divider = document.querySelector<HTMLElement>('.divider');
        const rails = document.querySelector<HTMLElement>('.bg-rails');
        const docked = window.matchMedia('(max-width: 760px)').matches;
        const left = !docked && rails ? rails.getBoundingClientRect().left + 1 : 0;
        const right = !docked && divider ? window.innerWidth - divider.getBoundingClientRect().left : 0;
        return { floor: shelf?.offsetHeight ?? 0, left, right };
      },
    });
    worldRef.current = world;
    // Webfonts change the layout once they land.
    document.fonts?.ready.then(() => world.relayout());
    return () => world.dispose();
  }, [bill, onBillDone, stopIntro]);

  // Browsers keep audio locked until a gesture; the first key or click opens it.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Keystrokes anywhere go to the composer; ⌘/Ctrl+Enter bills.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        bill();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, button, [role="dialog"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1 || e.key === 'Backspace') composerRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bill]);

  // The intro types itself, so the first frame already shows the idea.
  useEffect(() => {
    if (!ready) return;
    const chars = [...INTRO];
    let i = 0;
    const tick = () => {
      if (i >= chars.length) {
        introRef.current = null;
        return;
      }
      const ch = chars[i++];
      composerRef.current?.type(ch);
      introRef.current = window.setTimeout(tick, ch === ' ' ? 120 : ch === '.' ? 380 : 52 + Math.random() * 40);
    };
    introRef.current = window.setTimeout(tick, 700);
    return () => stopIntro();
  }, [ready, stopIntro]);

  /** A new receipt line — or, mid-bill, a line for the next receipt. */
  const addItem = useCallback((item: LineItem) => {
    if (billingRef.current) queuedRef.current.push(item);
    else setReceipt((r) => ({ ...r, items: [...r.items, item] }));
  }, []);

  const markItem = useCallback((key: number, patch: Partial<LineItem>) => {
    setReceipt((r) => ({ ...r, items: r.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  }, []);

  const onCommit = useCallback(
    (text: string, tokens: Token[], rects: (DOMRect | null)[], opts?: CommitOptions) => {
      const world = worldRef.current;
      if (!world || !tokens.length) return;
      const box = document.querySelector('.composer')!.getBoundingClientRect();
      const origin = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      // Creatures rise out of where the word's chips were.
      const placed = rects.filter((r): r is DOMRect => !!r);
      const at = placed.length
        ? { x: (placed[0].left + placed[placed.length - 1].right) / 2, y: placed[0].top + placed[0].height / 2 }
        : origin;

      const key = ++itemKey.current;
      const secret = secretWord(text);
      let effect = !!secret;
      let kind: LineItem['kind'] = secret ? 'secret' : undefined;

      if (secret === 'dodo') {
        kind = 'dodo';
        world.spawnDodo(tokens, at, key);
      } else {
        world.spawn(tokens, rects, origin, { ...opts, itemKey: key });
      }

      switch (secret) {
        case 'refund': {
          // Refund the most recent line that's still on the shelf.
          const target = billingRef.current
            ? undefined
            : [...receiptRef.current].reverse().find((it) => !it.refunded && it.kind !== 'blocked');
          if (target && world.refundItem(target.key)) {
            markItem(target.key, { refunded: true });
          } else {
            effect = false;
            showNote(billingRef.current ? 'Can’t refund mid-bill.' : 'Nothing to refund yet.');
          }
          break;
        }
        case 'fraud':
          kind = 'blocked';
          world.blockItem(key);
          break;
        case 'checkout':
          window.setTimeout(() => bill(), 650);
          break;
        case 'global':
          world.spawnCurrencies(tokens[0], origin);
          break;
        case 'subscription':
          for (let i = 1; i <= RENEWALS; i++) {
            const id = window.setTimeout(() => {
              const w = worldRef.current;
              if (!w) return;
              const renewalKey = ++itemKey.current;
              w.spawn(tokens, [], origin, { itemKey: renewalKey });
              addItem({ key: renewalKey, tokens, kind: 'renewal' });
              playRenew();
            }, i * RENEW_EVERY);
            renewTimers.current.push(id);
          }
          break;
      }

      if (isStrawberry(text)) {
        world.spawnBerries(tokens[0]);
        showNote(
          tokens.length === 1
            ? 'strawberry: one token here. At the start of a line it’s st·raw·berry.'
            : `strawberry: ${tokens.length} tokens here (${tokens.map((t) => (t.text ?? '').trim()).join('·')}).`,
        );
      }

      if (secret && effect) {
        showNote(`✦ ${SECRET_NOTES[secret]}`);
        setFound((f) => (f.includes(secret) ? f : [...f, secret]));
      }

      addItem({ key, tokens, kind: effect ? kind : undefined });
      playPrint(Math.ceil(tokens.length / 6));
      if (opts?.byUser) {
        setUserDrops((n) => n + 1);
        // First word dropped by hand: show the pile's one-line coach mark.
        if (coachRef.current === 'idle') setCoach('showing');
      }
    },
    [addItem, bill, markItem, showNote],
  );

  useEffect(() => () => renewTimers.current.forEach((id) => window.clearTimeout(id)), []);

  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 2800);
    return () => window.clearTimeout(id);
  }, [note]);

  useEffect(() => {
    if (coach !== 'showing') return;
    const id = window.setTimeout(() => setCoach('done'), COACH_MS);
    return () => window.clearTimeout(id);
  }, [coach]);

  const toggleSound = () => {
    unlockAudio();
    setMuted(!muted);
    setMutedState(!muted);
  };

  const tools = (
    <>
      <button
        type="button"
        className="icon-button"
        onClick={() => worldRef.current?.shake()}
        disabled={!pile}
        aria-label="Shake the pile"
        data-tip="Shake"
      >
        <ShakeIcon />
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={toggleSound}
        aria-pressed={!muted}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        data-tip={muted ? 'Sound off' : 'Sound on'}
      >
        <SoundIcon off={muted} />
      </button>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <main className="app">
        <div className="bg" aria-hidden="true">
          <MeshGradient
            className="bg-mesh"
            colors={['#ffffff', '#e5fbf2', '#e7efff', '#fff3eb', '#ffffff']}
            distortion={0.7}
            swirl={0.15}
            speed={0.12}
          />
          <div className="bg-dots" />
          <div className="bg-rails" />
        </div>

        <div className="stage" ref={stageRef} />

        <div className="ui">
          <header className="top">
            <motion.div className="brand" {...enter(0.1, -6)}>
              <span className="brand-mark" aria-hidden="true">
                <span>to</span>
                <span>ken</span>
              </span>
              <h1 className="brand-title">Tokens</h1>
              <span className="brand-sep" aria-hidden="true" />
              <p className="brand-sub">Everything you type gets metered.</p>
              <About />
            </motion.div>

            <motion.nav className="nav-actions" aria-label="About this submission" {...enter(0.2, -6)}>
              <a className="nav-button" href="/scrap/">
                <ScrapIcon />
                <span className="nav-label">Scrap idea</span>
              </a>
              <button
                type="button"
                className="nav-button nav-button--letter"
                onClick={() => {
                  setLetterOpen(true);
                  setLetterRead(true);
                }}
                aria-haspopup="dialog"
                aria-expanded={letterOpen}
              >
                <EnvelopeIcon />
                <span className="nav-label">Letter</span>
                {!letterRead && <span className="nav-unread" aria-label="unread" />}
              </button>
            </motion.nav>
          </header>

          <div className="divider" aria-hidden="true" />

          <motion.div className="composer-wrap" {...enter(0.18)}>
            <Composer
              ref={composerRef}
              ready={ready}
              onCommit={onCommit}
              onUserInput={stopIntro}
              tools={tools}
              dropHint={userDrops < DROPS_TO_LEARN}
            />
            <AnimatePresence mode="wait">
              {note ? (
                <motion.p
                  key={note.key}
                  className="coach coach--note"
                  role="status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {note.text}
                </motion.p>
              ) : (
                coach === 'showing' && (
                  <motion.p
                    key="coach"
                    className="coach"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="coach-dot" aria-hidden="true" />
                    Tap a tile to hear it · drag to throw
                  </motion.p>
                )
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div className="register-wrap" {...enter(0.3, 16)}>
            <Register
              ref={slotRef}
              receipt={receipt}
              paid={paid}
              billed={billed}
              pile={pile}
              billing={billing}
              onBill={bill}
              hintBill={!hasBilled}
            />
          </motion.div>

          <Shelf found={found} />
        </div>

        <div className="tiles" ref={layerRef} aria-hidden="true" />

        {hover && <Tooltip {...hover} />}

        <Letter open={letterOpen} onClose={closeLetter} />
      </main>
    </MotionConfig>
  );
}

function Tooltip({ info, x, y }: { info: TileInfo; x: number; y: number }) {
  const sw = swatchFor(info.token.id, info.token.text === null);
  const flip = x > window.innerWidth - 240;
  return (
    <div className="tooltip" style={{ transform: `translate3d(${flip ? x - 14 : x + 14}px, ${y + 18}px, 0) translateX(${flip ? '-100%' : '0'})` }}>
      <span className="tooltip-text">{info.label}</span>
      <span className="tooltip-meta">
        {info.meta ?? (
          <>
            <i style={{ background: sw.bg }} />#{info.token.id.toLocaleString('en-US')} · {sw.name}
          </>
        )}
      </span>
    </div>
  );
}

function ScrapIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="icon nav-icon">
      <path d="M4 1.8h5.2L12.5 5v9.2H4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9 1.9V5.2h3.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path className="nav-scribble" d="M5.8 8.4c1-.7 1.8.6 2.8 0s1.6-.6 2.2 0M5.8 11c.9-.5 1.6.4 2.6 0" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** An envelope whose letter peeks out on hover. */
function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 18 16" aria-hidden="true" className="icon nav-icon">
      <g className="nav-paper">
        <rect x="4.4" y="2.6" width="9.2" height="8" rx="1" className="nav-env-fill" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6.4 5.2h5.2M6.4 7.2h3.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </g>
      <path d="M1.8 6.6v6.8c0 .6.4 1 1 1h12.4c.6 0 1-.4 1-1V6.6l-7.2 4.6z" className="nav-env-fill" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function ShakeIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="icon">
      <rect x="2.2" y="5.2" width="6.2" height="4.4" rx="1.3" transform="rotate(-14 5.3 7.4)" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="7.8" y="7.6" width="6" height="4.4" rx="1.3" transform="rotate(12 10.8 9.8)" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 2.6l.9 1.2M13 3.2l-.9 1.1M8.2 1.8v1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SoundIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="icon">
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" fill="currentColor" />
      {off ? (
        <path d="M10.5 6l3 4m0-4l-3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <>
          <path d="M10.4 5.6a3.2 3.2 0 0 1 0 4.8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M12.2 3.8a5.8 5.8 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
