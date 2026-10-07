/**
 * Tile colour = how rare the token is. BPE ids are merge ranks: low ids were
 * merged first because they're everywhere (" the", "."), high ids are the
 * long tail. The rarest tokens get Dodo lime.
 */

export interface Swatch {
  name: string;
  bg: string;
  fg: string;
}

const TIERS: [number, Swatch][] = [
  [1_000, { name: 'everywhere', bg: '#ffffff', fg: '#0d0d0d' }],
  [10_000, { name: 'common', bg: '#eef0f3', fg: '#0d0d0d' }],
  [40_000, { name: 'familiar', bg: '#1264ff', fg: '#ffffff' }],
  [100_000, { name: 'uncommon', bg: '#00ad64', fg: '#ffffff' }],
  [150_000, { name: 'rare', bg: '#ff8a3d', fg: '#ffffff' }],
  [Infinity, { name: 'very rare', bg: '#c6fe1e', fg: '#0d0d0d' }],
];

export const FRAGMENT: Swatch = { name: 'byte fragment', bg: '#0d0d0d', fg: '#c6fe1e' };

export function swatchFor(id: number, fragment = false): Swatch {
  if (fragment) return FRAGMENT;
  return TIERS.find(([max]) => id < max)![1];
}

export const LEGEND = TIERS.map(([, s]) => s);
