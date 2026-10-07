import { useEffect, useRef, useState } from 'react';
import { motion, motionValue } from 'motion/react';
import { ShaderMount } from '@paper-design/shaders';
import { cardFragmentShader } from './cardShader';
import { startEngine, type CardControls } from '../engine/engine';
import { finishById, settings } from '../state/settings';
import { FragileMark } from '../ui/icons';

/** Live stress, 0..1. Written by the engine every frame; read by the UI without re-rendering. */
export const stressValue = motionValue(1);

/** Imperative handles for keyboard shortcuts. Filled in once the engine starts. */
export const cardControls: CardControls = { flip() {}, shake() {} };

const NUMBER = '4716 0038 2291 5530';
const NAME = 'HANDLE WITH CARE';
const GLYPHS = '0123456789#%&/\\<>?_=+*';

export function CardStage({ reducedMotion }: { reducedMotion: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const surface = surfaceRef.current!;
    const finish = finishById(settings.get().finish);
    let shader: ShaderMount | null = null;
    try {
      shader = new ShaderMount(
        surface,
        cardFragmentShader,
        {
          u_clock: 0,
          u_stress: 1,
          u_back: 0,
          u_tilt: [0, 0],
          u_deep: finish.deep,
          u_light: finish.light,
          u_accent: [0.83, 1.0, 0.24],
        },
        { antialias: false, powerPreference: 'high-performance' },
        0, // speed 0: Paper's own loop stays off, our engine drives every frame
      );
      // A compile failure doesn't throw; ShaderMount just has no program.
      if ((shader as unknown as { program: unknown }).program == null) {
        throw new Error('card shader failed to compile');
      }
    } catch (err) {
      console.warn('[handle-with-care] falling back to CSS surface:', err);
      shader?.dispose();
      shader = null;
      surface.querySelector('canvas')?.remove();
      setFallback(true);
    }

    // Inside the 3D-transformed card, Chrome can report the device-pixel box
    // at 1× — the shader then renders at half resolution on retina. Paper
    // sizes from that report, so correct its minimum pixel ratio to match.
    let minRatio = 2;
    let fixFrame = 0;
    const fixResolution = () => {
      if (!shader || !shader.canvasElement.width) return;
      const dpr = Math.max(1, window.devicePixelRatio);
      const want = surface.clientWidth * Math.max(dpr, 2);
      const have = shader.canvasElement.width;
      if (have >= want * 0.95) return;
      minRatio = (dpr * want * Math.max(1, minRatio / dpr)) / have;
      shader.setMinPixelRatio(minRatio);
    };
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(fixFrame);
      fixFrame = requestAnimationFrame(fixResolution);
    });
    resizeObserver.observe(surface);

    const engine = startEngine({
      stage: stageRef.current!,
      card: cardRef.current!,
      lift: liftRef.current!,
      shadow: shadowRef.current!,
      shader,
      stress: stressValue,
      reducedMotion,
    });
    cardControls.flip = engine.flip;
    cardControls.shake = engine.shake;

    return () => {
      cancelAnimationFrame(fixFrame);
      resizeObserver.disconnect();
      engine.dispose();
      shader?.dispose();
    };
  }, [reducedMotion]);

  // Glitch the printed text along with the surface.
  useEffect(() => {
    const card = cardRef.current!;
    const number = numberRef.current!;
    const name = nameRef.current!;
    let lastTick = 0;
    let scrambled = false;
    return stressValue.on('change', (v) => {
      const gl = Math.max(0, Math.min(1, (v - 0.66) / 0.32));
      card.style.setProperty('--glitch', gl.toFixed(3));
      card.style.setProperty('--stress', v.toFixed(3));
      const now = performance.now();
      if (gl > 0 && now - lastTick > 60) {
        lastTick = now;
        scrambled = true;
        number.textContent = scramble(NUMBER, gl * 0.55);
        name.textContent = scramble(NAME, gl * 0.3);
      } else if (gl === 0 && scrambled) {
        scrambled = false;
        number.textContent = NUMBER;
        name.textContent = NAME;
      }
    });
  }, []);

  return (
    <div className="stage" ref={stageRef} aria-hidden="true">
      <motion.div
        className="card-anchor"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 56, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 1 }}
      >
        <div className="card-shadow" ref={shadowRef} />
        <div className="card-lift" ref={liftRef}>
          <div className="card" ref={cardRef}>
            <div className={`card-surface${fallback ? ' is-fallback' : ''}`} ref={surfaceRef} />
            <div className="card-edge" style={{ '--z': '-1.2px' } as React.CSSProperties} />
            <div className="card-edge" style={{ '--z': '-0.4px' } as React.CSSProperties} />
            <div className="card-edge" style={{ '--z': '0.4px' } as React.CSSProperties} />
            <div className="card-edge" style={{ '--z': '1.2px' } as React.CSSProperties} />

            <div className="card-face card-front">
              <div className="cf-top">
                <span className="cf-issuer">
                  <FragileMark className="cf-mark" />
                  Fragile
                </span>
                <Contactless className="cf-contactless" />
              </div>
              <Chip className="cf-chip" />
              <span className="cf-number" ref={numberRef}>
                {NUMBER}
              </span>
              <div className="cf-bottom">
                <div className="cf-field">
                  <span className="cf-label">Cardholder</span>
                  <span className="cf-value" ref={nameRef}>
                    {NAME}
                  </span>
                </div>
                <div className="cf-field cf-field--end">
                  <span className="cf-label">Valid thru</span>
                  <span className="cf-value cf-mono">10/29</span>
                </div>
              </div>
            </div>

            <div className="card-face card-back">
              <div className="cb-signature">
                <span className="cb-sign">handle with care</span>
                <span className="cb-cvv">042</span>
              </div>
              <p className="cb-fine">
                This card degrades under stress and recovers at rest.
                <br />
                If found broken, leave it alone for a moment.
              </p>
              <FragileMark className="cb-mark" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function scramble(text: string, amount: number) {
  let out = '';
  for (const ch of text) {
    out += ch !== ' ' && Math.random() < amount ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : ch;
  }
  return out;
}

function Chip({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 50 38" aria-hidden="true">
      <defs>
        <linearGradient id="chip-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e7b4" />
          <stop offset=".45" stopColor="#c9a65a" />
          <stop offset=".55" stopColor="#8a6a2c" />
          <stop offset="1" stopColor="#e8cf8c" />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="49" height="37" rx="6.5" fill="url(#chip-g)" stroke="rgba(0,0,0,.35)" />
      <g fill="none" stroke="rgba(60,40,10,.55)" strokeWidth="1">
        <path d="M17 .5v11.5M33 .5v11.5M17 26v11.5M33 26v11.5" />
        <path d="M.5 13H17M33 13h16.5M.5 25H17M33 25h16.5" />
        <rect x="17" y="12" width="16" height="14" rx="3" />
      </g>
    </svg>
  );
}

function Contactless({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M8.5 7.5a6.5 6.5 0 0 1 0 9" />
        <path d="M12 5a10 10 0 0 1 0 14" />
        <path d="M15.5 2.5a13.5 13.5 0 0 1 0 19" />
      </g>
    </svg>
  );
}
