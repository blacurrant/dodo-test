/** The "fragile" shipping pictogram — a stemmed glass — with a hairline crack. */
export function FragileMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h10l-.55 5.1a4.47 4.47 0 0 1-8.9 0L7 3Z" />
        <path d="M12 12.6V20.4M8.6 20.6h6.8" />
        <path d="M11 3.3l1.15 2.3-1.35 1.5 1 1.7" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r=".95" fill="currentColor" />
    </svg>
  );
}
