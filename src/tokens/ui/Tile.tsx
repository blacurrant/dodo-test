import { forwardRef } from 'react';
import type { Token } from '../tokenizer';
import { tileContent } from '../world';

/** A token tile rendered by React — the composer's live preview. Same markup as the physics tiles. */
export const Tile = forwardRef<HTMLSpanElement, { token: Token }>(function Tile({ token }, ref) {
  const { className, html, style } = tileContent(token);
  return (
    <span
      ref={ref}
      className={`${className} tile--preview`}
      style={style as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
