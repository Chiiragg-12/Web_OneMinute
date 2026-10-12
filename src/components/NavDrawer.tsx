import { useEffect, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

export interface DrawerItem {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  end?: boolean;
  /** Overrides NavLink's own active detection (needed for query-string views). */
  active?: boolean;
}

// Left-hand navigation drawer for small screens. Large screens use the static sidebar instead.
export function NavDrawer({ open, onClose, title, items }: { open: boolean; onClose: () => void; title: string; items: readonly DrawerItem[] }) {
  const location = useLocation();

  // Close whenever the route changes (including query-string views).
  useEffect(() => { onClose(); }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="drawer-root lg:hidden">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <nav className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-3 flex items-center justify-between">
          <strong className="font-display text-lg">{title}</strong>
          <button className="icon-button" type="button" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-1">
          {items.map(({ to, label, Icon, end, active }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => ((active ?? isActive) ? 'nav-link active' : 'nav-link')}>
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
