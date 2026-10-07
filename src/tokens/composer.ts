/**
 * What gets committed (dropped into the world) as you type.
 *
 * BPE tokenizers attach a word's leading space to the word (" hello"), so a
 * word is committed the moment you type the space *after* it, and that space
 * becomes the start of the next word. The pending word stays in the input,
 * where you can still edit it and watch its tokens split live.
 */

export const MAX_PENDING = 48;

export interface Split {
  commits: string[];
  pending: string;
}

/** Split an input value into finished words and the word still being typed. */
export function splitInput(value: string): Split {
  const commits: string[] = [];
  let start = 0;
  for (let i = 1; i < value.length; i++) {
    // A space that follows a non-space ends the word before it.
    if (value[i] === ' ' && value[i - 1] !== ' ') {
      commits.push(value.slice(start, i));
      start = i;
    }
  }
  let pending = value.slice(start);
  if (pending.length > MAX_PENDING) {
    commits.push(pending);
    pending = '';
  }
  return { commits, pending };
}

/** How a token's text is drawn on a tile: leading spaces and whitespace made visible. */
export function displayText(text: string): { lead: boolean; body: string } {
  const lead = text.startsWith(' ') && text.trim().length > 0;
  const body = (lead ? text.slice(1) : text)
    .replace(/\n/g, '↵')
    .replace(/\t/g, '⇥')
    .replace(/^ +$/, (s) => '␣'.repeat(Math.min(s.length, 4)));
  return { lead, body };
}

/** Dodo Payments words that do something. Typed on their own — any case, punctuation ignored. */
export const SECRETS = ['dodo', 'refund', 'subscription', 'fraud', 'checkout', 'global'] as const;
export type Secret = (typeof SECRETS)[number];

/** " Dodo," → 'dodo'. A paste or a phrase never counts — it has to be one word. */
export function secretWord(text: string): Secret | null {
  const word = text.trim();
  if (!word || /\s/.test(word)) return null;
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  return (SECRETS as readonly string[]).includes(letters) ? (letters as Secret) : null;
}

export const isDodo = (text: string) => secretWord(text) === 'dodo';

/** Not a secret — the hints advertise it — but it does rain strawberries. */
export function isStrawberry(text: string) {
  const word = text.trim();
  if (!word || /\s/.test(word)) return false;
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  return letters === 'strawberry' || letters === 'strawberries';
}

export const hexBytes = (bytes: number[]) =>
  bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
