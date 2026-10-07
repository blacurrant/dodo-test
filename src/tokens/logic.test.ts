import { beforeAll, describe, expect, it } from 'vitest';
import { displayText, hexBytes, isDodo, isStrawberry, MAX_PENDING, secretWord, splitInput } from './composer';
import { formatUsd, usdOf } from './money';
import { swatchFor, FRAGMENT } from './palette';
import { loadTokenizer, tokenize } from './tokenizer';

describe('splitInput', () => {
  it('keeps a word pending until the space after it', () => {
    expect(splitInput('hello')).toEqual({ commits: [], pending: 'hello' });
    expect(splitInput('hello ')).toEqual({ commits: ['hello'], pending: ' ' });
  });

  it('carries the space into the next word, like BPE does', () => {
    expect(splitInput(' world wide')).toEqual({ commits: [' world'], pending: ' wide' });
  });

  it('commits several words at once', () => {
    expect(splitInput('a b c')).toEqual({ commits: ['a', ' b'], pending: ' c' });
  });

  it('lets runs of spaces accumulate', () => {
    expect(splitInput('   ')).toEqual({ commits: [], pending: '   ' });
  });

  it('force-commits a runaway word', () => {
    const long = 'x'.repeat(MAX_PENDING + 1);
    expect(splitInput(long)).toEqual({ commits: [long], pending: '' });
  });
});

describe('displayText', () => {
  it('marks a leading space', () => {
    expect(displayText(' strawberry')).toEqual({ lead: true, body: 'strawberry' });
    expect(displayText('st')).toEqual({ lead: false, body: 'st' });
  });

  it('makes bare whitespace visible', () => {
    expect(displayText(' ').body).toBe('␣');
    expect(displayText('\n').body).toBe('↵');
  });

  it('formats bytes as hex', () => {
    expect(hexBytes([240, 159])).toBe('F0 9F');
  });
});

describe('isDodo', () => {
  it('summons on the word dodo, however it is typed', () => {
    for (const w of ['dodo', ' dodo', ' Dodo,', 'DODO!', '"dodo"']) expect(isDodo(w)).toBe(true);
  });
  it('ignores words that merely contain it', () => {
    for (const w of ['dodos', ' dodopayments', 'do do', ' doodo', '']) expect(isDodo(w)).toBe(false);
  });
});

describe('secretWord', () => {
  it('recognises each secret word, however it is typed', () => {
    expect(secretWord(' Refund!')).toBe('refund');
    expect(secretWord('SUBSCRIPTION')).toBe('subscription');
    expect(secretWord(' fraud?')).toBe('fraud');
    expect(secretWord(' checkout.')).toBe('checkout');
    expect(secretWord(' Global')).toBe('global');
  });
  it('never fires inside other words or phrases', () => {
    for (const w of [' refunded', ' subscriptions', ' fraudster', ' check out', ' globally', '']) {
      expect(secretWord(w)).toBe(null);
    }
  });
});

describe('isStrawberry', () => {
  it('rains for strawberry and strawberries, however typed', () => {
    for (const w of ['strawberry', ' Strawberry!', ' STRAWBERRIES']) expect(isStrawberry(w)).toBe(true);
  });
  it('ignores near misses and phrases', () => {
    for (const w of [' straw', ' berry', ' strawberry jam', '']) expect(isStrawberry(w)).toBe(false);
  });
});

describe('money', () => {
  it('charges $2.50 per million tokens', () => {
    expect(usdOf(1_000_000)).toBe(2.5);
  });
  it('shows a single token’s cost', () => {
    expect(formatUsd(1)).toBe('$0.0000025');
    expect(formatUsd(128)).toBe('$0.0003200');
  });
});

describe('palette', () => {
  it('maps rank to rarity', () => {
    expect(swatchFor(290).name).toBe('everywhere');
    expect(swatchFor(101_830).name).toBe('rare');
    expect(swatchFor(190_000).name).toBe('very rare');
    expect(swatchFor(5, true)).toBe(FRAGMENT);
  });
});

describe('tokenizer (o200k_base)', () => {
  beforeAll(async () => {
    await loadTokenizer();
  });

  it('splits strawberry the famous way', () => {
    expect(tokenize('strawberry').map((t) => t.text)).toEqual(['st', 'raw', 'berry']);
  });

  it('shatters the dodo emoji into byte fragments', () => {
    const t = tokenize('🦤');
    expect(t.every((x) => x.text === null && x.bytes)).toBe(true);
    expect(t.flatMap((x) => x.bytes!)).toEqual([0xf0, 0x9f, 0xa6, 0xa4]);
  });
});
