import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Token } from '../tokenizer';
import { formatUsd, usdOf, USD_PER_MILLION } from '../money';
import { swatchFor } from '../palette';
import { hexBytes } from '../composer';
import { Odometer } from './Odometer';

export interface LineItem {
  key: number;
  tokens: Token[];
  /** The dodo prints as its own lime line; other secret words get a ✦. */
  kind?: 'dodo' | 'secret' | 'renewal' | 'blocked';
  /** Refunded lines stay on the receipt, struck through, and no longer count. */
  refunded?: boolean;
}

export interface Receipt {
  no: number;
  opened: Date;
  items: LineItem[];
}

interface Props {
  receipt: Receipt;
  paid: boolean;
  billed: number;
  pile: number;
  billing: boolean;
  onBill(): void;
  /** Until the first bill, the receipt and the key point at what to do. */
  hintBill: boolean;
}

const ease = [0.22, 1, 0.36, 1] as const;
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The meter, as Dodo would ship it: a receipt printer. Every word you drop
 * prints a line item; billing feeds the pile into the slot, stamps the
 * receipt PAID and tears it off.
 */
export const Register = forwardRef<HTMLDivElement, Props>(function Register(
  { receipt, paid, billed, pile, billing, onBill, hintBill },
  slotRef,
) {
  const printing = usePrinting(receipt.items.length, billing);
  const itemsRef = useRef<HTMLUListElement>(null);
  const overflowing = useOverflow(itemsRef, receipt.items.length);
  // Refunded and blocked lines stay visible but don't count toward the bill.
  const billable = receipt.items.filter((it) => !it.refunded && it.kind !== 'blocked');
  const tokens = billable.reduce((n, it) => n + it.tokens.length, 0);
  const chars = billable.reduce((n, it) => n + it.tokens.reduce((c, t) => c + (t.text?.length ?? 1), 0), 0);

  return (
    <aside className="register" aria-label="Usage">
      <div className="paper-window">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.article
            key={receipt.no}
            className="paper"
            layout
            initial={{ y: '102%' }}
            animate={{ y: 0, rotate: 0, x: 0, opacity: 1 }}
            exit={{ y: -90, x: 40, rotate: -7, opacity: 0, transition: { duration: 0.6, ease } }}
            transition={{ type: 'spring', stiffness: 150, damping: 24 }}
          >
            <header className="rc-head">
              <div className="rc-brand">Tokens</div>
              <div className="rc-sub">Metered by the token</div>
              <div className="rc-meta">
                <span>No. {String(receipt.no).padStart(4, '0')}</span>
                <span>{receipt.opened.toLocaleTimeString('en-GB')}</span>
              </div>
            </header>
            <div className="rc-cols" aria-hidden="true">
              <span>Item</span>
              <span>Tok</span>
              <span>USD</span>
            </div>
            <ul className="rc-items" ref={itemsRef} data-overflow={overflowing || undefined}>
              <AnimatePresence initial={false}>
                {receipt.items.map((it) => (
                  <motion.li
                    key={it.key}
                    className={['rc-item', it.kind && `rc-item--${it.kind}`, it.refunded && 'rc-item--refunded']
                      .filter(Boolean)
                      .join(' ')}
                    layout="position"
                    initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
                    animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
                    transition={{ duration: 0.24, ease: 'linear' }}
                  >
                    <span className="rc-text">
                      {it.kind === 'dodo' && <DodoGlyph />}
                      {(it.kind === 'secret' || it.kind === 'blocked') && (
                        <span className="rc-star" aria-label="secret word">
                          ✦
                        </span>
                      )}
                      {it.kind === 'renewal' && (
                        <span className="rc-star" aria-label="renewal">
                          ↻
                        </span>
                      )}
                      {it.tokens.map((t, i) => (
                        <span key={i} className="rc-tok" style={{ '--tier': tierInk(t) } as React.CSSProperties}>
                          {t.text === null ? `‹${fragmentHex(t.bytes ?? [])}›` : t.text.trim() || '␣'}
                        </span>
                      ))}
                    </span>
                    <span className="rc-qty">{it.tokens.length}</span>
                    <span className="rc-amt">
                      {it.refunded ? 'refunded' : it.kind === 'blocked' ? 'blocked' : usdOf(it.tokens.length).toFixed(7)}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
              {!receipt.items.length && <li className="rc-empty">Nothing metered yet</li>}
            </ul>
            <dl className="rc-totals">
              <div>
                <dt>Tokens</dt>
                <dd>{tokens}</dd>
              </div>
              <div>
                <dt>Chars / token</dt>
                <dd>{tokens ? (chars / tokens).toFixed(1) : '—'}</dd>
              </div>
              <div>
                <dt>Rate</dt>
                <dd>${USD_PER_MILLION.toFixed(2)} / 1M</dd>
              </div>
            </dl>
            <div className="rc-total">
              <span>Total</span>
              <Odometer value={formatUsd(tokens)} />
            </div>
            <AnimatePresence>
              {paid && (
                <motion.div
                  className="rc-stamp"
                  initial={{ scale: 2.4, opacity: 0, rotate: -24 }}
                  animate={{ scale: 1, opacity: 1, rotate: -11 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 17 }}
                >
                  Paid
                </motion.div>
              )}
            </AnimatePresence>
            {hintBill && receipt.items.length > 0 && !paid && (
              <p className="rc-hint">
                Press <b>Bill</b> to pay <span aria-hidden="true">↓</span>
              </p>
            )}
            <Barcode ids={receipt.items.flatMap((it) => it.tokens.map((t) => t.id))} />
            <p className="rc-foot">Thank you for your tokens</p>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="printer">
        <div className="printer-slot" ref={slotRef} />
        <div className="printer-face">
          <span className="printer-led" data-on={printing || undefined} aria-hidden="true" />
          <div className="printer-display">
            <span className="printer-label">Billed</span>
            <Odometer value={formatUsd(billed)} className="printer-odo" />
          </div>
          <button
            type="button"
            className="printer-bill"
            onClick={onBill}
            disabled={!pile || billing}
            data-hint={(hintBill && pile > 0 && !billing) || undefined}
            aria-keyshortcuts={MAC ? 'Meta+Enter' : 'Control+Enter'}
          >
            {billing ? 'Billing' : 'Bill'}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
});

/** A tiny dodo for the receipt line. */
function DodoGlyph() {
  return (
    <svg className="rc-dodo" viewBox="0 0 48 48" aria-label="dodo">
      <ellipse cx="21" cy="29.5" rx="13.5" ry="11" fill="currentColor" />
      <circle cx="31" cy="14.5" r="7.2" fill="currentColor" />
      <path d="M24.5 22.5c.2-4.2 1.6-7.6 4.6-9.3l5.2 4.4c-1.6 3.2-4.5 5.7-8.1 6.6z" fill="currentColor" />
      <path d="M35.5 10.6c5.7-.6 9.6 2.2 9.4 6.4-.1 2.3-1.8 3.9-3.6 3.6-1.3-.2-1.6-1.6-1-2.7-1.3.6-3 .7-4.9.2l-2.2-.7z" fill="currentColor" />
      <path d="M8.5 25.5c-2.6-1.8-3.6-4.6-2.7-7.2 1.9 2.2 4 3 6.2 3.1z" fill="currentColor" />
    </svg>
  );
}

/** A barcode drawn from the receipt's own token ids — every receipt's is different. */
function Barcode({ ids }: { ids: number[] }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const seq = ids.length ? ids : [0x2a];
  for (let i = 0; x < 216; i++) {
    const id = seq[i % seq.length] + i * 7919;
    const w = 1 + (id % 3);
    bars.push({ x, w });
    x += w + 1 + ((id >> 3) % 3);
  }
  return (
    <svg className="rc-barcode" viewBox="0 0 220 28" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="28" />
      ))}
    </svg>
  );
}

/** A fragment's leading 0x20 is just the word's space — leave it out, as the tiles do. */
function fragmentHex(bytes: number[]) {
  return hexBytes(bytes[0] === 0x20 && bytes.length > 1 ? bytes.slice(1) : bytes);
}

/**
 * Whether the line items overflow their window. They're bottom-aligned, so
 * overflow spills upward where scrollHeight can't see it — sum the rows instead.
 */
function useOverflow(ref: React.RefObject<HTMLUListElement | null>, count: number) {
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const rows = [...el.children] as HTMLElement[];
    const gap = parseFloat(cs.rowGap) || 0;
    const content =
      rows.reduce((h, r) => h + r.offsetHeight, 0) +
      gap * Math.max(0, rows.length - 1) +
      parseFloat(cs.paddingTop) +
      parseFloat(cs.paddingBottom);
    setOver(content > parseFloat(cs.maxHeight) + 1);
  }, [ref, count]);
  return over;
}

/** Common tokens are white tiles; on paper their underline needs to be visible. */
function tierInk(t: Token) {
  const bg = swatchFor(t.id, t.text === null).bg;
  return bg === '#ffffff' || bg === '#eef0f3' ? '#d0d5dd' : bg;
}

/** The status LED: lit while a line is printing or the pile is being billed. */
function usePrinting(lines: number, billing: boolean) {
  const [on, setOn] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setOn(true);
    const id = window.setTimeout(() => setOn(false), 320);
    return () => window.clearTimeout(id);
  }, [lines]);
  return on || billing;
}
