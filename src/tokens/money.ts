/** An illustrative input rate, roughly what frontier models charge. */
export const USD_PER_MILLION = 2.5;

/** Always derive money from an integer token count, so totals never drift. */
export const usdOf = (tokens: number) => (tokens * USD_PER_MILLION) / 1_000_000;

/** $0.0000025 per token needs seven decimals to show a single token's cost. */
export const formatUsd = (tokens: number) => `$${usdOf(tokens).toFixed(7)}`;
