import Matter from 'matter-js';
import type { Token } from './tokenizer';
import { displayText, hexBytes } from './composer';
import { swatchFor } from './palette';
import {
  playArp,
  playBlocked,
  playChirp,
  playClack,
  playCoin,
  playKaching,
  playPlop,
  playPoke,
  playRefund,
  playToken,
} from './audio';

const { Engine, Bodies, Body, Composite, Constraint, Events, Query, Sleeping } = Matter;

/**
 * The pile. Matter.js does the physics; every tile is a real DOM element so
 * the type stays crisp and selectable-looking. One rAF loop steps the engine
 * at a fixed 120 Hz and writes transforms only for bodies that are awake.
 */

export interface TileInfo {
  token: Token;
  label: string;
  /** Replaces the id/rarity line in the tooltip (the dodo uses it). */
  meta?: string;
}

export interface WorldEvents {
  /** Tokens currently sitting in the pile. */
  onPileChange(count: number): void;
  /** One tile has dropped through the meter. */
  onBilled(tokens: number): void;
  onBillDone(): void;
  onHover(info: TileInfo | null, x: number, y: number): void;
  /** First real interaction with the pile (for hint dismissal). */
  onTouch(): void;
  /** Where billed tiles fly to (client coordinates): the printer's slot. */
  billTarget(): { x: number; y: number; spread: number };
  /** The pile has hit its size cap — time to bill. */
  onFull(): void;
  /** The pile's floor and walls, as insets from the stage's edges. */
  bounds(): { floor: number; left: number; right: number };
}

type Kind = 'token' | 'dodo' | 'coin' | 'berry';

interface Tile {
  body: Matter.Body;
  el: HTMLElement;
  token: Token;
  /** The tokens this tile stands for: one for a word tile; a secret's real tokens (or none, for currencies). */
  tokens: Token[];
  kind: Kind;
  /** The receipt line this tile was printed on (for refunds and fraud blocks). */
  itemKey?: number;
  /** Flagged as fraud: on its way off the shelf, never billed. */
  blocked?: boolean;
  w: number;
  h: number;
  born: number;
  lx: number;
  ly: number;
  la: number;
}

const STEP = 1000 / 120;
/** The pile may cover at most this share of the screen before the oldest tiles get billed. */
const MAX_AREA = 0.36;
const TAP_SLOP = 6;
const TAP_MS = 260;
const POKE_RADIUS = 190;

/** A little dodo: round body, big hooked beak, a tuft of tail. Its eye blinks (CSS). */
const DODO_SVG = `<svg class="dodo-art" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M8.5 25.5c-2.6-1.8-3.6-4.6-2.7-7.2 1.9 2.2 4 3 6.2 3.1z" fill="#0d0d0d"/>
  <ellipse cx="21" cy="29.5" rx="13.5" ry="11" fill="#0d0d0d"/>
  <path d="M24.5 22.5c.2-4.2 1.6-7.6 4.6-9.3l5.2 4.4c-1.6 3.2-4.5 5.7-8.1 6.6z" fill="#0d0d0d"/>
  <circle cx="31" cy="14.5" r="7.2" fill="#0d0d0d"/>
  <path d="M35.5 10.6c5.7-.6 9.6 2.2 9.4 6.4-.1 2.3-1.8 3.9-3.6 3.6-1.3-.2-1.6-1.6-1-2.7-1.3.6-3 .7-4.9.2l-2.2-.7z" fill="#c6fe1e" stroke="#0d0d0d" stroke-width="1.6" stroke-linejoin="round"/>
  <ellipse class="dodo-eye" cx="31.6" cy="13" rx="1.9" ry="1.9" fill="#fff"/>
  <circle cx="32.1" cy="13.2" r=".85" fill="#0d0d0d"/>
  <path class="dodo-wing" d="M14 27.5c3.8-3.2 8.6-2.4 11.2 1.6-4.2 2.6-8.3 2.2-11.2-1.6z" fill="#3a3a3d"/>
  <path d="M18 40v4.6M25 40v4.6M15.8 45h4.4M22.8 45h4.4" stroke="#0d0d0d" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/** A strawberry: the same on every device, unlike the emoji. */
const BERRY_SVG = `<svg class="berry-art" viewBox="0 0 40 46" aria-hidden="true">
  <path d="M20 43C11 39 4 30 4 21c0-7 6-11 12-10 1.6.3 2.9.9 4 1.6 1.1-.7 2.4-1.3 4-1.6 6-1 12 3 12 10 0 9-7 18-16 22z" fill="#e5383b" stroke="#0d0d0d" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="12.5" cy="18" rx="2.6" ry="4.6" transform="rotate(-24 12.5 18)" fill="#fff" opacity=".32"/>
  <g fill="#ffe08a">
    <ellipse cx="20" cy="18.5" rx=".9" ry="1.4"/><ellipse cx="27" cy="19.5" rx=".9" ry="1.4"/>
    <ellipse cx="10.5" cy="26" rx=".9" ry="1.4"/><ellipse cx="17" cy="25" rx=".9" ry="1.4"/>
    <ellipse cx="24" cy="25.5" rx=".9" ry="1.4"/><ellipse cx="30.5" cy="26.5" rx=".9" ry="1.4"/>
    <ellipse cx="14" cy="32" rx=".9" ry="1.4"/><ellipse cx="21" cy="32" rx=".9" ry="1.4"/>
    <ellipse cx="27.5" cy="32.5" rx=".9" ry="1.4"/><ellipse cx="18" cy="38" rx=".9" ry="1.4"/>
    <ellipse cx="23.5" cy="37.5" rx=".9" ry="1.4"/>
  </g>
  <path d="M20 13.5l-6-6.2 4.3 2.4L16.4 3l3.6 5.2L23.6 3l-1.9 6.7 4.3-2.4z" fill="#3fa34d" stroke="#0d0d0d" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M20 7V1.5" stroke="#0d0d0d" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/** global — Dodo settles in 80+ currencies. A few of them, raining down. */
const CURRENCIES: [string, string][] = [
  ['₹', 'INR'], ['€', 'EUR'], ['$', 'USD'], ['£', 'GBP'], ['¥', 'JPY'], ['R$', 'BRL'],
  ['₦', 'NGN'], ['₩', 'KRW'], ['A$', 'AUD'], ['₺', 'TRY'], ['zł', 'PLN'], ['฿', 'THB'],
];

/** Build the DOM for a token tile. Shared by the live preview in the composer. */
export function tileContent(token: Token): { className: string; html: string; style: Record<string, string> } {
  const sw = swatchFor(token.id, token.text === null);
  if (token.text === null) {
    // A fragment can carry the word's leading space as byte 0x20 — draw it
    // the same way as on text tiles.
    const bytes = token.bytes ?? [];
    const lead = bytes[0] === 0x20 && bytes.length > 1;
    return {
      className: 'tile tile--bytes',
      html: `${lead ? '<span class="tile-lead" aria-hidden="true"></span>' : ''}<span class="tile-text">${hexBytes(lead ? bytes.slice(1) : bytes)}</span>`,
      style: { '--bg': sw.bg, '--fg': sw.fg },
    };
  }
  const { lead, body } = displayText(token.text);
  return {
    className: 'tile',
    html: `${lead ? '<span class="tile-lead" aria-hidden="true"></span>' : ''}<span class="tile-text">${escapeHtml(body)}</span>`,
    style: { '--bg': sw.bg, '--fg': sw.fg },
  };
}

/** Tooltip text: the token exactly as the model sees it, spaces made visible. */
export function tileLabel(token: Token) {
  return token.text === null ? hexBytes(token.bytes ?? []) : `“${token.text.replace(/ /g, '␣')}”`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export class World {
  private engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  private tiles = new Map<number, Tile>();
  private floor!: Matter.Body;
  private area = 0;
  private walls: Matter.Body[] = [];
  private raf = 0;
  private acc = 0;
  private last = performance.now();
  private width = 0;
  private height = 0;
  private floorY = 0;
  private leftX = 0;
  private rightX = 0;
  private fullSignalled = false;
  private pileTokens = 0; // tokens on the shelf
  private inFlight = 0; // tokens on their way to the meter (still unbilled)
  private billLeft = 0; // of those, how many belong to the current bill
  private billedCount = 0;
  private grab: {
    pointerId: number;
    tile: Tile;
    constraint: Matter.Constraint;
    x0: number;
    y0: number;
    t0: number;
    moved: boolean;
  } | null = null;
  private hovered: Tile | null = null;
  private disposed = false;

  constructor(
    private stage: HTMLElement,
    private layer: HTMLElement,
    private events: WorldEvents,
  ) {
    this.engine.gravity.y = 1.15;
    this.buildBounds();
    Events.on(this.engine, 'collisionStart', this.onCollision);
    stage.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
    stage.addEventListener('pointerleave', this.clearHover);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Unbilled tokens: on the pile or still flying to the meter. */
  get count() {
    return this.pileTokens + this.inFlight;
  }

  // ── Spawning ─────────────────────────────────────────────────────────────

  /** Create tile elements (not yet in the world) so they can be measured in one pass. */
  makeElement(token: Token) {
    const { className, html, style } = tileContent(token);
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
    return el;
  }

  /**
   * Drop tokens in at the given rects (client coordinates, e.g. the composer's
   * live chips). Missing rects are laid out in a row around `origin`.
   */
  spawn(
    tokens: Token[],
    rects: (DOMRect | null)[],
    origin: { x: number; y: number },
    opts: { stagger?: number; itemKey?: number } = {},
  ) {
    if (!tokens.length) return;
    const els = tokens.map((t) => this.makeElement(t));
    els.forEach((el) => {
      el.style.visibility = 'hidden';
      this.layer.append(el);
    });
    // Measure everything in one layout pass.
    const sizes = els.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));

    let rowX = 0;
    const rowWidth = sizes.reduce((s, z) => s + z.w + 6, 0);
    // Pastes rain down as a block of text that fits between the walls.
    const maxRow = Math.max(160, Math.min(this.rightX - this.leftX - 60, 900));
    const stagger = opts.stagger ?? 0;

    tokens.forEach((token, i) => {
      const { w, h } = sizes[i];
      let x: number;
      let y: number;
      const r = rects[i];
      if (r) {
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      } else {
        // Wrap long pastes into rows so they rain down as a block of text.
        const row = Math.floor(rowX / maxRow);
        const col = rowX % maxRow;
        const span = Math.min(rowWidth, maxRow);
        x = origin.x - span / 2 + col + w / 2;
        x = Math.min(Math.max(x, this.leftX + w / 2 + 4), this.rightX - w / 2 - 4);
        y = origin.y + row * (h + 6) - Math.floor(rowWidth / maxRow) * (h + 6);
        rowX += w + 6;
      }
      const el = els[i];
      const add = () => {
        if (this.disposed) return el.remove();
        this.addTile(token, el, x, y, w, h, !!r, undefined, opts.itemKey);
        playToken(token.id, token.text?.trim().length ?? 1, token.text === null);
      };
      if (stagger && i > 0) window.setTimeout(add, i * stagger);
      else add();
    });
  }

  // ── Secret words ─────────────────────────────────────────────────────────
  // Every creature carries the real tokens of the word that summoned it, and
  // anything removed from the pile leaves the receipt with it, so the bill
  // always matches.

  private makeCreature(className: string, html: string) {
    const el = document.createElement('div');
    el.className = `tile ${className}`;
    el.innerHTML = html;
    el.style.visibility = 'hidden';
    this.layer.append(el);
    return { el, w: el.offsetWidth, h: el.offsetHeight };
  }

  private clampX(x: number, w: number) {
    return Math.min(Math.max(x, this.leftX + w / 2 + 4), this.rightX - w / 2 - 4);
  }

  private tilesOf(itemKey: number) {
    return [...this.tiles.values()].filter((t) => t.itemKey === itemKey);
  }

  /** dodo — a dodo drops in instead of its tokens, and the pile hops to greet it. */
  spawnDodo(tokens: Token[], at: { x: number; y: number }, itemKey?: number) {
    if (!tokens.length) return;
    const { el, w, h } = this.makeCreature('tile--dodo', `${DODO_SVG}<span class="tile-text">dodo</span>`);
    this.addTile(tokens[0], el, this.clampX(at.x, w), at.y, w, h, true, { kind: 'dodo', tokens }, itemKey);
    playChirp();
    window.setTimeout(() => {
      for (const t of this.tiles.values()) {
        if (t.el === el) continue;
        Sleeping.set(t.body, false);
        Body.setVelocity(t.body, {
          x: t.body.velocity.x + (Math.random() - 0.5) * 1.5,
          y: t.body.velocity.y - 2.5 - Math.random() * 2,
        });
      }
    }, 260);
  }

  /** refund — a receipt line's tiles dissolve off the shelf. Returns how many tiles went. */
  refundItem(itemKey: number) {
    const tiles = this.tilesOf(itemKey);
    if (!tiles.length) return 0;
    playRefund();
    tiles.forEach((t, i) => {
      const { x, y } = t.body.position;
      const a = t.body.angle;
      this.removeTile(t, true);
      t.el.classList.add('is-refunded');
      const at = (sc: number, lift: number) =>
        `translate3d(${(x - t.w / 2).toFixed(1)}px, ${(y - t.h / 2 - lift).toFixed(1)}px, 0) rotate(${a.toFixed(3)}rad) scale(${sc})`;
      t.el
        .animate(
          [
            { transform: at(1, 0), opacity: 1 },
            { transform: at(1.06, 6), opacity: 1, offset: 0.25 },
            { transform: at(0.7, 30), opacity: 0 },
          ],
          { duration: 520, delay: i * 60, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
        )
        .finished.then(() => t.el.remove());
    });
    this.events.onPileChange(this.count);
    return tiles.length;
  }

  /**
   * fraud — a receipt line's tiles are flagged and stop being billable at once
   * (so a bill can never include them), then get thrown off the shelf.
   */
  blockItem(itemKey: number) {
    const tiles = this.tilesOf(itemKey);
    if (!tiles.length) return 0;
    for (const t of tiles) {
      t.el.classList.add('is-flagged');
      t.blocked = true;
      this.pileTokens -= t.tokens.length;
      t.tokens = [];
    }
    this.events.onPileChange(this.count);
    window.setTimeout(() => playBlocked(), 350);
    window.setTimeout(() => {
      tiles.forEach((t, i) => {
        if (!this.tiles.has(t.body.id)) return;
        const { x, y } = t.body.position;
        const a = t.body.angle;
        this.removeTile(t, true);
        this.events.onPileChange(this.count);
        const at = (px: number, py: number, rot: number) =>
          `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${rot.toFixed(3)}rad)`;
        t.el
          .animate(
            [
              { transform: at(x - t.w / 2, y - t.h / 2, a) },
              { transform: at(x - t.w / 2 - 80, y - t.h / 2 - 140, a - 0.6), offset: 0.4 },
              { transform: at(this.leftX - t.w - 160, y + 260, a - 2.2) },
            ],
            { duration: 820, delay: i * 70, easing: 'cubic-bezier(0.4, 0, 0.7, 1)', fill: 'both' },
          )
          .finished.then(() => t.el.remove());
      });
    }, 900);
    return tiles.length;
  }

  /** global — a rain of currencies. Free: they carry no tokens. */
  spawnCurrencies(display: Token, at: { x: number; y: number }) {
    playArp();
    CURRENCIES.forEach(([symbol, code], i) => {
      window.setTimeout(() => {
        if (this.disposed) return;
        const { el, w, h } = this.makeCreature('tile--coin', `<span class="tile-text">${symbol}</span>`);
        el.dataset.code = code;
        const x = this.clampX(at.x + (Math.random() - 0.5) * 420, w);
        this.addTile(display, el, x, at.y - 40 - Math.random() * 60, w, h, false, { kind: 'coin', tokens: [] });
        if (i % 3 === 0) playCoin(i);
      }, i * 70);
    });
  }

  /** strawberry — strawberries rain across the shelf. Free: they carry no tokens. */
  spawnBerries(display: Token, count = 14) {
    for (let i = 0; i < count; i++) {
      window.setTimeout(() => {
        if (this.disposed) return;
        const { el, w, h } = this.makeCreature('tile--berry', BERRY_SVG);
        const x = this.leftX + w / 2 + 8 + Math.random() * (this.rightX - this.leftX - w - 16);
        this.addTile(display, el, x, -h - Math.random() * 120, w, h, false, { kind: 'berry', tokens: [] });
        window.setTimeout(() => playPlop(Math.floor(Math.random() * 6)), 380 + Math.random() * 120);
      }, i * 55);
    }
  }

  private info(t: Tile): TileInfo {
    const split = t.tokens.map((k) => (k.text ?? '').trim()).join('·');
    const meta = `${t.tokens.length} token${t.tokens.length === 1 ? '' : 's'} · ${split}`;
    switch (t.kind) {
      case 'dodo':
        return { token: t.token, label: 'A dodo!', meta };
      case 'berry':
        return { token: t.token, label: 'A strawberry', meta: 'free · no tokens' };
      case 'coin':
        return { token: t.token, label: `${t.el.textContent} · ${t.el.dataset.code}`, meta: 'one of 80+ currencies · free' };
      default:
        return { token: t.token, label: tileLabel(t.token) };
    }
  }

  private addTile(
    token: Token,
    el: HTMLElement,
    x: number,
    y: number,
    w: number,
    h: number,
    fromInput: boolean,
    special?: { kind: Kind; tokens: Token[] },
    itemKey?: number,
  ) {
    const kind: Kind = special?.kind ?? 'token';
    const creature = kind !== 'token';
    const body = Bodies.rectangle(x, y, w, h, {
      chamfer: { radius: kind === 'coin' || kind === 'berry' ? h * 0.46 : Math.min(creature ? 16 : 10, h * 0.28) },
      friction: 0.35,
      frictionStatic: 0.9,
      frictionAir: 0.008,
      // The dodo and the coins are heavier and bouncier than words.
      restitution: creature ? 0.32 : 0.12,
      density: creature ? 0.0026 : 0.0016,
      sleepThreshold: 45,
    });
    // Words pop up out of the input and get tossed; pastes just rain.
    Body.setVelocity(
      body,
      kind === 'dodo'
        ? { x: (Math.random() - 0.5) * 4, y: -9 }
        : kind === 'coin' || kind === 'berry'
          ? { x: (Math.random() - 0.5) * 3, y: 1 + Math.random() * 2 }
          : fromInput
            ? { x: (Math.random() - 0.5) * 7, y: -4 - Math.random() * 3 }
            : { x: (Math.random() - 0.5) * 4, y: Math.random() },
    );
    Body.setAngularVelocity(body, (Math.random() - 0.5) * (fromInput ? 0.12 : 0.05));
    Composite.add(this.engine.world, body);
    el.style.visibility = '';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    const tokens = special?.tokens ?? [token];
    const tile: Tile = {
      body,
      el,
      token,
      tokens,
      kind,
      itemKey,
      w,
      h,
      born: performance.now(),
      lx: NaN,
      ly: NaN,
      la: NaN,
    };
    this.tiles.set(body.id, tile);
    this.pileTokens += tokens.length;
    this.area += w * h;
    this.write(tile);
    el.classList.add('is-born');

    this.events.onPileChange(this.count);
    // A full pile bills itself, so the receipt always matches the pile.
    if (!this.fullSignalled && !this.billLeft && this.area > MAX_AREA * (this.rightX - this.leftX) * this.floorY) {
      this.fullSignalled = true;
      window.setTimeout(() => this.events.onFull(), 450);
    }
  }

  private removeTile(t: Tile, keepElement = false) {
    Composite.remove(this.engine.world, t.body);
    if (!keepElement) t.el.remove();
    this.tiles.delete(t.body.id);
    this.pileTokens -= t.tokens.length;
    this.area -= t.w * t.h;
    if (this.hovered === t) this.clearHover();
    if (this.grab?.tile === t) this.releaseGrab();
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Bill the pile: every tile leaves the physics and streams into the meter,
   * nearest first, each one ticking the total as it lands.
   */
  bill(): boolean {
    if (this.billLeft) return false;
    const target = this.events.billTarget();
    const queue = [...this.tiles.values()].filter((t) => !t.blocked);
    if (!queue.length) return false;
    this.releaseGrab();
    this.billedCount = 0;
    queue.sort(
      (a, b) =>
        Math.hypot(a.body.position.x - target.x, a.body.position.y - target.y) -
        Math.hypot(b.body.position.x - target.x, b.body.position.y - target.y),
    );
    const stagger = Math.min(38, 1700 / queue.length);
    this.billLeft = queue.length;
    queue.forEach((t, i) => this.flyToMeter(t, i * stagger));
    return true;
  }

  get isBilling() {
    return this.billLeft > 0;
  }

  private flyToMeter(t: Tile, delay: number) {
    const { x, y } = t.body.position;
    const a = t.body.angle;
    this.removeTile(t, true);
    this.inFlight += t.tokens.length;
    t.el.classList.remove('is-hover', 'is-grabbed');
    t.el.classList.add('is-billing');

    const target = this.events.billTarget();
    const x0 = x - t.w / 2;
    const y0 = y - t.h / 2;
    const tx = target.x + (Math.random() - 0.5) * target.spread - t.w / 2;
    const ty = target.y - t.h / 2;
    // Arc up and over, then drop into the printer's slot edge-first.
    const mx = x0 + (tx - x0) * 0.55;
    const my = Math.min(y0, ty) - 90 - Math.random() * 70;
    const at = (px: number, py: number, rot: number, sx: number, sy: number) =>
      `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${rot.toFixed(3)}rad) scale(${sx}, ${sy})`;
    const anim = t.el.animate(
      [
        { transform: at(x0, y0, a, 1, 1), opacity: 1 },
        { transform: at(mx, my, a * 0.3, 0.8, 0.8), opacity: 1, offset: 0.55 },
        { transform: at(tx, ty - 26, 0, 0.62, 0.62), opacity: 1, offset: 0.86 },
        { transform: at(tx, ty, 0, 0.5, 0.05), opacity: 0 },
      ],
      { duration: 760 + Math.random() * 160, delay, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'both' },
    );
    anim.onfinish = () => {
      if (this.disposed) return;
      t.el.remove();
      // The tokens move from unbilled to billed in the same instant.
      this.inFlight -= t.tokens.length;
      this.events.onPileChange(this.count);
      this.events.onBilled(t.tokens.length);
      this.billedCount++;
      playCoin(this.billedCount);
      if (--this.billLeft === 0) {
        this.fullSignalled = false;
        playKaching();
        this.events.onBillDone();
      }
    };
  }

  /** Kick every tile up and sideways — the pile as a fidget. */
  shake() {
    for (const t of this.tiles.values()) {
      Sleeping.set(t.body, false);
      Body.setVelocity(t.body, {
        x: t.body.velocity.x + (Math.random() - 0.5) * 9,
        y: t.body.velocity.y - 6 - Math.random() * 9,
      });
      Body.setAngularVelocity(t.body, (Math.random() - 0.5) * 0.35);
    }
    playPoke();
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    this.acc += Math.min(now - this.last, 50);
    this.last = now;
    while (this.acc >= STEP) {
      Engine.update(this.engine, STEP);
      this.acc -= STEP;
    }

    for (const t of this.tiles.values()) {
      if (!t.body.isSleeping) this.write(t);
    }

  };

  private write(t: Tile) {
    const { x, y } = t.body.position;
    const a = t.body.angle;
    if (Math.abs(x - t.lx) < 0.05 && Math.abs(y - t.ly) < 0.05 && Math.abs(a - t.la) < 0.0005) return;
    t.lx = x;
    t.ly = y;
    t.la = a;
    t.el.style.transform = `translate3d(${(x - t.w / 2).toFixed(2)}px, ${(y - t.h / 2).toFixed(2)}px, 0) rotate(${a.toFixed(4)}rad)`;
  }

  private onCollision = (e: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of e.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      const tile = this.tiles.get(a.isStatic ? b.id : a.id);
      if (tile) playClack(rel, tile.w);
    }
  };

  // ── Pointer ──────────────────────────────────────────────────────────────

  private tileAt(x: number, y: number): Tile | null {
    const bodies = Query.point(
      [...this.tiles.values()].map((t) => t.body),
      { x, y },
    );
    if (!bodies.length) return null;
    // The visually top-most is the last one appended.
    let best: Tile | null = null;
    for (const b of bodies) {
      const t = this.tiles.get(b.id)!;
      if (!best || t.born > best.born) best = t;
    }
    return best;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.grab) return;
    // Keep keyboard focus in the composer on desktop.
    if (e.pointerType === 'mouse') e.preventDefault();
    this.events.onTouch();
    const tile = this.tileAt(e.clientX, e.clientY);
    if (!tile) {
      this.poke(e.clientX, e.clientY);
      return;
    }
    this.stage.setPointerCapture(e.pointerId);
    const body = tile.body;
    Sleeping.set(body, false);
    const offset = { x: e.clientX - body.position.x, y: e.clientY - body.position.y };
    const cos = Math.cos(-body.angle);
    const sin = Math.sin(-body.angle);
    const constraint = Constraint.create({
      pointA: { x: e.clientX, y: e.clientY },
      bodyB: body,
      pointB: { x: offset.x * cos - offset.y * sin, y: offset.x * sin + offset.y * cos },
      length: 0,
      stiffness: 0.18,
      damping: 0.12,
    });
    Composite.add(this.engine.world, constraint);
    this.grab = { pointerId: e.pointerId, tile, constraint, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false };
    tile.el.classList.add('is-grabbed');
    document.documentElement.dataset.grabbing = '';
    this.events.onHover(null, 0, 0);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.grab && e.pointerId === this.grab.pointerId) {
      const g = this.grab;
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_SLOP) g.moved = true;
      g.constraint.pointA = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.pointerType !== 'mouse' || e.target instanceof Node && !this.stage.contains(e.target)) {
      if (this.hovered) this.clearHover();
      return;
    }
    const tile = this.tileAt(e.clientX, e.clientY);
    if (tile !== this.hovered) {
      this.hovered?.el.classList.remove('is-hover');
      this.hovered = tile;
      tile?.el.classList.add('is-hover');
      this.stage.style.cursor = tile ? 'grab' : '';
    }
    this.events.onHover(tile ? this.info(tile) : null, e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    const g = this.grab;
    if (!g || e.pointerId !== g.pointerId) return;
    const tap = !g.moved && performance.now() - g.t0 < TAP_MS;
    this.releaseGrab();
    if (tap) {
      // Tapping a tile plays it — the pile is a xylophone.
      const t = g.tile;
      if (t.kind === 'dodo') playChirp();
      else if (t.kind === 'coin') playCoin(Math.floor(Math.random() * 10));
      else if (t.kind === 'berry') playPlop(Math.floor(Math.random() * 6));
      else playToken(t.token.id, t.token.text?.trim().length ?? 1, t.token.text === null);
      const hop = t.kind === 'dodo' ? -8 : -5.5;
      Body.setVelocity(t.body, { x: t.body.velocity.x, y: hop });
      Body.setAngularVelocity(t.body, (Math.random() - 0.5) * 0.18);
      t.el.classList.remove('is-ping');
      void t.el.offsetWidth;
      t.el.classList.add('is-ping');
    }
  };

  private releaseGrab() {
    if (!this.grab) return;
    Composite.remove(this.engine.world, this.grab.constraint);
    this.grab.tile.el.classList.remove('is-grabbed');
    this.grab = null;
    delete document.documentElement.dataset.grabbing;
  }

  private poke(x: number, y: number) {
    let hit = 0;
    for (const t of this.tiles.values()) {
      const dx = t.body.position.x - x;
      const dy = t.body.position.y - y;
      const d = Math.hypot(dx, dy);
      if (d > POKE_RADIUS) continue;
      const f = Math.pow(1 - d / POKE_RADIUS, 1.5) * 13;
      Sleeping.set(t.body, false);
      Body.setVelocity(t.body, {
        x: t.body.velocity.x + (dx / (d || 1)) * f,
        y: t.body.velocity.y + (dy / (d || 1)) * f - f * 0.35,
      });
      Body.setAngularVelocity(t.body, t.body.angularVelocity + (Math.random() - 0.5) * 0.2);
      hit++;
    }
    if (hit) playPoke();
    const ring = document.createElement('div');
    ring.className = 'poke-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    this.layer.append(ring);
    ring.addEventListener('animationend', () => ring.remove());
  }

  private clearHover = () => {
    this.hovered?.el.classList.remove('is-hover');
    this.hovered = null;
    this.stage.style.cursor = '';
    this.events.onHover(null, 0, 0);
  };

  // ── Bounds ───────────────────────────────────────────────────────────────

  private buildBounds() {
    this.width = this.stage.clientWidth || window.innerWidth;
    this.height = this.stage.clientHeight || window.innerHeight;
    const inset = this.events.bounds();
    // The pile rests on the shelf, between the frame line and the divider.
    this.floorY = this.height - inset.floor;
    this.leftX = inset.left;
    this.rightX = this.width - inset.right;
    const T = 400;
    const opts = { isStatic: true, friction: 0.6, restitution: 0.05 };
    this.floor = Bodies.rectangle(this.width / 2, this.floorY + T / 2, this.width + 2 * T, T, opts);
    this.walls = [
      Bodies.rectangle(this.leftX - T / 2, this.height / 2 - 2000, T, this.height + 4000, opts),
      Bodies.rectangle(this.rightX + T / 2, this.height / 2 - 2000, T, this.height + 4000, opts),
    ];
    Composite.add(this.engine.world, [this.floor, ...this.walls]);
  }

  /** Re-read the layout (call after the UI around the pile changes size). */
  relayout() {
    this.onResize();
  }

  private onResize = () => {
    Composite.remove(this.engine.world, [this.floor, ...this.walls]);
    this.buildBounds();
    for (const t of this.tiles.values()) {
      const { x, y } = t.body.position;
      const cx = Math.min(Math.max(x, this.leftX + t.w / 2), this.rightX - t.w / 2);
      const cy = Math.min(y, this.floorY - t.h / 2);
      if (cx !== x || cy !== y) {
        Body.setPosition(t.body, { x: cx, y: cy });
        Sleeping.set(t.body, false);
      }
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    Events.off(this.engine, 'collisionStart', this.onCollision);
    this.stage.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    this.stage.removeEventListener('pointerleave', this.clearHover);
    for (const t of this.tiles.values()) t.el.remove();
    this.tiles.clear();
    Engine.clear(this.engine);
  }
}
