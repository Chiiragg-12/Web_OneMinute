import { useRef, useState, type ReactNode } from 'react';

type Side = 'right' | 'bottom' | 'left';

/**
 * A small dark label that follows hover and keyboard focus. It is positioned with `fixed`, so it is never
 * clipped by a scrolling sidebar or a header. Pass `disabled` to render the children untouched.
 */
export function Tooltip({ label, side = 'right', disabled = false, className = '', children }: { label: string; side?: Side; disabled?: boolean; className?: string; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);
  if (disabled) return <>{children}</>;

  const show = () => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box) return;
    if (side === 'right') setSpot({ top: box.top + box.height / 2, left: box.right + 12 });
    else if (side === 'left') setSpot({ top: box.top + box.height / 2, left: box.left - 12 });
    else setSpot({ top: box.bottom + 10, left: box.left + box.width / 2 });
  };
  const hide = () => setSpot(null);
  const place = side === 'right' ? '-translate-y-1/2' : side === 'left' ? '-translate-x-full -translate-y-1/2' : '-translate-x-1/2';
  const arrow = side === 'right' ? 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' : side === 'left' ? 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' : 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2';

  return (
    <span ref={anchor} className={`inline-flex ${className}`} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onKeyDown={(event) => { if (event.key === 'Escape') hide(); }}>
      {children}
      {spot ? (
        <span role="tooltip" style={{ top: spot.top, left: spot.left }} className={`pointer-events-none fixed z-[100] ${place} animate-[tooltip-in_.12s_ease-out] whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold tracking-wide text-white shadow-xl shadow-slate-900/25 ring-1 ring-white/10`}>
          {label}
          <span aria-hidden="true" className={`absolute size-2 rotate-45 bg-slate-900 ${arrow}`} />
        </span>
      ) : null}
    </span>
  );
}
