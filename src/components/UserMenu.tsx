import { useEffect, useRef, useState } from 'react';
import { LogOut, MoreVertical } from 'lucide-react';

// The three-dot menu in the header. It intentionally holds only "Sign out".
export function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointerDown); document.removeEventListener('touchstart', onPointerDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button className="icon-button" type="button" aria-label="More options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="user-menu" role="menu">
          <button className="user-menu-item" type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}>
            <LogOut size={16} />Sign out
          </button>
        </div>
      )}
    </div>
  );
}
