import { FRAGMENT, LEGEND } from '../palette';
import { SECRETS, type Secret } from '../composer';
import { HintEgg } from './HintEgg';

/** The floor the pile rests on — it carries the colour key and the secret-word tally. */
export function Shelf({ found }: { found: Secret[] }) {
  const list = found.length ? `Found: ${found.join(', ')}` : 'None found yet';
  return (
    <footer className="shelf">
      <div className="shelf-legend" aria-label="Tile colour is how rare the token is">
        <span className="shelf-label">Rarity</span>
        {[...LEGEND, FRAGMENT].map((s) => (
          <span key={s.name} className="shelf-chip">
            <i style={{ background: s.bg }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="shelf-secrets">
        <HintEgg found={found} />
        <span className="shelf-label" title={list} aria-label={`Secret words: ${found.length} of ${SECRETS.length}. ${list}`}>
          Secret words
        </span>
        <span className="shelf-pips" aria-hidden="true">
          {SECRETS.map((s, i) => (
            <i key={s} data-on={i < found.length || undefined} />
          ))}
        </span>
        <span className="shelf-count">
          {found.length}/{SECRETS.length}
        </span>
      </div>
    </footer>
  );
}
