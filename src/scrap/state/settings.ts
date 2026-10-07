import { useSyncExternalStore } from 'react';

export type FinishId = 'chrome' | 'gold' | 'lime';

export interface Finish {
  id: FinishId;
  label: string;
  /** Shadow, body, highlight of the metal — linear-ish 0..1 RGB. */
  deep: [number, number, number];
  light: [number, number, number];
  /** CSS gradient for the swatch in the dock. */
  swatch: string;
}

export const FINISHES: Finish[] = [
  {
    id: 'chrome',
    label: 'Chrome',
    deep: [0.07, 0.075, 0.085],
    light: [0.96, 0.97, 1.0],
    swatch: 'linear-gradient(135deg, #f4f6fa 0%, #8b919b 45%, #22252a 55%, #d9dde4 100%)',
  },
  {
    id: 'gold',
    label: 'Gold',
    deep: [0.13, 0.075, 0.02],
    light: [1.0, 0.89, 0.6],
    swatch: 'linear-gradient(135deg, #fff1c4 0%, #c69a4a 45%, #3b260b 55%, #f0d28c 100%)',
  },
  {
    id: 'lime',
    label: 'Lime',
    deep: [0.06, 0.085, 0.01],
    light: [0.85, 1.0, 0.32],
    swatch: 'linear-gradient(135deg, #f1ffb8 0%, #a8d12a 45%, #1d2a04 55%, #dcff5c 100%)',
  },
];

export interface Settings {
  finish: FinishId;
  fragility: number;
  recovery: number;
}

export const DEFAULTS: Settings = { finish: 'chrome', fragility: 0.5, recovery: 0.45 };

type Listener = () => void;

function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<T>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const settings = createStore<Settings>({ ...DEFAULTS });

export function useSettings<K>(select: (s: Settings) => K): K {
  return useSyncExternalStore(settings.subscribe, () => select(settings.get()));
}

export const finishById = (id: FinishId) => FINISHES.find((f) => f.id === id) ?? FINISHES[0];
