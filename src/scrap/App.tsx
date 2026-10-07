import { useEffect, useState } from 'react';
import { MotionConfig, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { CardStage, cardControls } from './card/Card';
import { About } from './ui/About';
import { FragileMark } from './ui/icons';
import { KeyHints } from './ui/KeyHints';
import { SegmentedControl } from './ui/SegmentedControl';
import { Slider } from './ui/Slider';
import { StressMeter } from './ui/StressMeter';
import { FINISHES, settings, useSettings } from './state/settings';

const FINISH_OPTIONS = FINISHES.map((f, i) => ({
  id: f.id,
  label: f.label,
  swatch: f.swatch,
  hint: `${f.label} — press ${i + 1}`,
}));

/** UI arrives after the card has started to heal. */
const enter = (delay: number, y = 8): HTMLMotionProps<'div'> => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
});

export function App() {
  const reducedMotion = useReducedMotion() ?? false;
  const finish = useSettings((s) => s.finish);
  const fragility = useSettings((s) => s.fragility);
  const recovery = useSettings((s) => s.recovery);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      // Let buttons and radios keep Space for themselves.
      const native = target?.closest('button, input, textarea, select, [role="radio"]');
      if (e.code === 'Space') {
        if (native) return;
        e.preventDefault();
        if (!e.repeat) cardControls.flip();
      } else if (e.code === 'KeyS') {
        if (!e.repeat) cardControls.shake();
      } else if (/^Digit[1-3]$/.test(e.code)) {
        settings.set({ finish: FINISHES[Number(e.code.slice(5)) - 1].id });
      }
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.stage')) setTouched(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <main className="app">
        <div className="backdrop" aria-hidden="true" />
        <CardStage reducedMotion={reducedMotion} />

        <div className="hud">
          <motion.div className="scrap-note" {...enter(0.4, -6)}>
            <a className="scrap-link" href="/">
              <span className="scrap-tag">Scrap</span>
              The first idea, set aside. See what I built instead
              <span aria-hidden="true">→</span>
            </a>
          </motion.div>
          <header className="hud-top">
            <motion.div className="brand" {...enter(0.55, -6)}>
              <FragileMark className="brand-mark" />
              <h1 className="brand-title">Handle With Care</h1>
              <span className="brand-sub">A card that remembers how it’s treated</span>
              <About />
            </motion.div>
            <motion.div {...enter(0.65, -6)}>
              <StressMeter />
            </motion.div>
          </header>

          <footer className="hud-bottom">
            <motion.div className="hint-slot" {...enter(0.8)}>
              <p className="hint" data-quiet={touched || undefined}>
                <span className="hint-fine">Drag to throw · Click to flip</span>
                <span className="hint-coarse">Drag to throw · Tap to flip</span>
              </p>
            </motion.div>

            <motion.div className="dock" role="group" aria-label="Card settings" {...enter(0.75, 12)}>
              <SegmentedControl
                label="Finish"
                options={FINISH_OPTIONS}
                value={finish}
                onChange={(id) => settings.set({ finish: id })}
              />
              <span className="dock-sep" aria-hidden="true" />
              <Slider
                label="Fragility"
                value={fragility}
                ends={['tough', 'glass']}
                onChange={(v) => settings.set({ fragility: v })}
              />
              <span className="dock-sep" aria-hidden="true" />
              <Slider
                label="Recovery"
                value={recovery}
                ends={['slow', 'fast']}
                onChange={(v) => settings.set({ recovery: v })}
              />
            </motion.div>

            <motion.div className="keys-slot" {...enter(0.85)}>
              <KeyHints />
            </motion.div>
          </footer>
        </div>
      </main>
    </MotionConfig>
  );
}
