// Le icone condivise tra più card: decorative, il testo accanto dice tutto.

/** Il calendario: accanto a una scadenza, o a un termine decorso. */
export function Calendario({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
