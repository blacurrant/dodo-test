import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AVATAR, DISPLAY_NAME, ME, type IconName } from '../me';

/** The maker's card: an avatar in the nav that opens a small profile with links. */
export function Me() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'phone' | 'email' | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(id);
  }, [copied]);

  /**
   * Phones open the dialer or mail app; desktops copy, since tel: and mailto:
   * there open FaceTime, a mail client nobody set up, or nothing at all.
   */
  const reach = async (kind: 'phone' | 'email') => {
    const href = kind === 'phone' ? `tel:${ME.phone.tel}` : `mailto:${ME.email}`;
    if (window.matchMedia('(pointer: coarse)').matches) {
      window.location.href = href;
      return;
    }
    try {
      await navigator.clipboard.writeText(kind === 'phone' ? ME.phone.display : ME.email);
      setCopied(kind);
    } catch {
      window.location.href = href;
    }
  };

  return (
    <div className="me">
      <button
        ref={buttonRef}
        type="button"
        className="me-button"
        aria-label={`About ${DISPLAY_NAME}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar size={30} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={`About ${DISPLAY_NAME}`}
            className="me-panel"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          >
            <header className="me-head">
              <Avatar size={46} />
              <div className="me-who">
                <p className="me-name">{DISPLAY_NAME}</p>
                {ME.location && (
                  <p className="me-place">
                    <Icon name="pin" />
                    {ME.location}
                  </p>
                )}
              </div>
            </header>
            {ME.bio && <p className="me-bio">{ME.bio}</p>}
            <ul className="me-links">
              {ME.links.map((l) => (
                <li key={l.href}>
                  <a className="me-link" href={l.href} target="_blank" rel="noreferrer">
                    <Icon name={l.icon} />
                    <span className="me-label">{l.label}</span>
                    <span className="me-handle">{l.handle}</span>
                    <span className="me-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
              {ME.email && (
                <ReachRow icon="mail" label="Email" value={ME.email} copied={copied === 'email'} onClick={() => reach('email')} />
              )}
              {ME.phone.display && (
                <ReachRow
                  icon="phone"
                  label="Phone"
                  value={ME.phone.display}
                  copied={copied === 'phone'}
                  onClick={() => reach('phone')}
                />
              )}
            </ul>
            <p className="me-foot">Made for Dodo Payments · 2026</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A contact row that copies its value (or opens the app on phones). */
function ReachRow(props: { icon: IconName; label: string; value: string; copied: boolean; onClick(): void }) {
  const { icon, label, value, copied, onClick } = props;
  return (
    <li>
      <button type="button" className="me-link" onClick={onClick} aria-label={`${label} ${value}${copied ? ', copied' : ''}`}>
        <Icon name={icon} />
        <span className="me-label">{label}</span>
        <span className="me-handle" data-copied={copied || undefined}>
          {copied ? 'Copied ✓' : value}
        </span>
        <span className="me-arrow" aria-hidden="true">
          {copied ? '' : '⧉'}
        </span>
      </button>
    </li>
  );
}

function Avatar({ size }: { size: number }) {
  const [failed, setFailed] = useState(!AVATAR);
  // The initial sits underneath, so there's never an empty circle while the photo loads.
  return (
    <span className="me-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      <span aria-hidden="true">{DISPLAY_NAME.charAt(0).toUpperCase()}</span>
      {!failed && (
        <img src={AVATAR} alt="" width={size} height={size} decoding="async" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

/** Small line icons, drawn on a 16px grid to match the rest of the chrome. */
function Icon({ name }: { name: IconName | 'pin' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg className="me-icon" viewBox="0 0 16 16" aria-hidden="true">
      {name === 'globe' && (
        <>
          <circle cx="8" cy="8" r="6.2" {...common} />
          <path d="M1.9 8h12.2M8 1.8c1.7 1.8 2.5 3.9 2.5 6.2S9.7 12.4 8 14.2C6.3 12.4 5.5 10.3 5.5 8S6.3 3.6 8 1.8z" {...common} />
        </>
      )}
      {name === 'github' && (
        <path
          fill="currentColor"
          d="M8 1.2a6.8 6.8 0 0 0-2.15 13.25c.34.06.46-.15.46-.33v-1.15c-1.9.41-2.3-.92-2.3-.92-.3-.79-.75-1-.75-1-.62-.42.05-.41.05-.41.68.05 1.04.7 1.04.7.6 1.04 1.59.74 1.98.57.06-.44.24-.74.43-.91-1.51-.17-3.1-.76-3.1-3.37 0-.74.27-1.35.7-1.83-.07-.17-.3-.86.07-1.8 0 0 .57-.18 1.87.7a6.5 6.5 0 0 1 3.4 0c1.3-.88 1.87-.7 1.87-.7.37.94.14 1.63.07 1.8.44.48.7 1.09.7 1.83 0 2.62-1.6 3.2-3.11 3.37.24.21.46.62.46 1.26v1.86c0 .18.12.4.47.33A6.8 6.8 0 0 0 8 1.2z"
        />
      )}
      {name === 'phone' && (
        <path
          d="M5.2 2.2H3.6c-.8 0-1.4.7-1.3 1.5.6 5.4 4.6 9.4 10 10 .8.1 1.5-.5 1.5-1.3v-1.6c0-.4-.3-.8-.7-.9l-2-.6c-.4-.1-.8 0-1 .3l-.7.9C7.6 9.8 6.2 8.4 5.5 6.6l.9-.7c.3-.2.4-.6.3-1l-.6-2c-.1-.4-.5-.7-.9-.7z"
          {...common}
        />
      )}
      {name === 'mail' && (
        <>
          <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.6" {...common} />
          <path d="M2.3 4.2L8 8.6l5.7-4.4" {...common} />
        </>
      )}
      {name === 'pin' && (
        <>
          <path d="M8 14.5s4.6-4.2 4.6-7.6a4.6 4.6 0 0 0-9.2 0c0 3.4 4.6 7.6 4.6 7.6z" {...common} />
          <circle cx="8" cy="6.9" r="1.6" {...common} />
        </>
      )}
    </svg>
  );
}
