/**
 * The real o200k_base tokenizer (GPT‑4o / GPT‑5), lazy-loaded — the merge
 * table is ~1 MB gzipped, so the page paints first and the vocabulary
 * streams in behind it.
 */

export interface Token {
  id: number;
  /** Decoded text, or null when the token is a fragment of a multi-byte character. */
  text: string | null;
  /** Raw UTF-8 bytes, only for fragments (e.g. the three shards of 🦤). */
  bytes: number[] | null;
}

type Encoding = typeof import('gpt-tokenizer/encoding/o200k_base');
interface Core {
  decodeNativeGenerator(tokens: Iterable<number>): Generator<Uint8Array | string>;
}

let loading: Promise<Encoding> | null = null;
let encoding: Encoding | null = null;

export function loadTokenizer(): Promise<Encoding> {
  loading ??= import('gpt-tokenizer/encoding/o200k_base').then((m) => (encoding = m));
  return loading;
}

export const tokenizerReady = () => encoding !== null;

export function tokenize(text: string): Token[] {
  if (!encoding || !text) return [];
  // gpt-tokenizer keeps the byte-level decoder private; it's the only way to
  // see the raw bytes of a token that splits a character.
  const core = (encoding.default as unknown as { bytePairEncodingCoreProcessor: Core })
    .bytePairEncodingCoreProcessor;
  return encoding.encode(text).map((id) => {
    const [piece] = core.decodeNativeGenerator([id]);
    return typeof piece === 'string'
      ? { id, text: piece, bytes: null }
      : { id, text: null, bytes: Array.from(piece ?? []) };
  });
}
