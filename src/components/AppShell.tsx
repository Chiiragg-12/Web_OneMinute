import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

export interface ShellItem {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  /** Overrides NavLink's own active detection (needed for query-string views). */
  active?: boolean;
  end?: boolean;
}
export interface ShellGroup { label?: string; items: ShellItem[] }
export interface ShellUser {
  name: string;
  email?: string | null;
  /** Rows under "Current context", for example the role and the clinic. */
  context: { label: string; value: string }[];
  accountLinks?: ShellItem[];
}

const COLLAPSED_KEY = 'oneminute.sidebarCollapsed';
const readCollapsed = () => { try { return window.localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; } };
const saveCollapsed = (value: boolean) => { try { window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0'); } catch { /* a remembered choice is a convenience only */ } };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '?';

function NavItems({ groups, collapsed, onNavigate }: { groups: ShellGroup[]; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="shell-nav" aria-label="Main">
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="shell-group">
          {group.label && !collapsed ? <p className="shell-group-label">{group.label}</p> : null}
          {group.label && collapsed ? <div className="shell-group-rule" /> : null}
          {group.items.map(({ to, label, Icon, active, end }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} onClick={onNavigate} className={({ isActive }) => ((active ?? isActive) ? 'shell-link active' : 'shell-link')}>
              <Icon size={18} />{collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function AccountMenu({ user, onSignOut }: { user: ShellUser; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
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
      <button type="button" className="shell-avatar" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{initials(user.name)}</button>
      {open ? (
        <div className="shell-popover" role="menu">
          <div className="shell-popover-head">
            <span className="shell-avatar shell-avatar-lg" aria-hidden="true">{initials(user.name)}</span>
            <div className="min-w-0 flex-1"><strong className="block truncate">{user.name}</strong>{user.email ? <span className="block truncate text-xs text-slate-500">{user.email}</span> : null}</div>
            <button type="button" className="icon-button shell-signout" role="menuitem" aria-label="Sign out" title="Sign out" onClick={() => { setOpen(false); onSignOut(); }}><LogOut size={17} /></button>
          </div>
          <p className="shell-popover-label">Current context</p>
          {user.context.map(({ label, value }) => <div key={label} className="shell-context"><span>{label}</span><strong>{value}</strong></div>)}
          {user.accountLinks?.length ? <><p className="shell-popover-label">Account</p>{user.accountLinks.map(({ to, label, Icon }) => <Link key={to} to={to} role="menuitem" className="shell-popover-link"><Icon size={16} />{label}</Link>)}</> : null}
          <div className="shell-popover-foot"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
        </div>
      ) : null}
    </div>
  );
}

/** Sidebar + header layout shared by the reception console and the admin panel. */
export function AppShell({ groups, user, onSignOut, homeTo, subtitle, children }: { groups: ShellGroup[]; user: ShellUser; onSignOut: () => void; homeTo: string; subtitle?: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const all = [...groups.flatMap((group) => group.items), ...(user.accountLinks ?? [])];
  const current = all.find((item) => item.active) ?? all.find((item) => item.to.split('?')[0] === location.pathname);
  const toggle = () => setCollapsed((value) => { saveCollapsed(!value); return !value; });

  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="shell-root">
      <aside className={collapsed ? 'shell-sidebar collapsed' : 'shell-sidebar'}>
        <button type="button" className="shell-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggle}>{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button>
        <div className="shell-scroll">
          <div className="shell-brand">
            <Link to={homeTo} aria-label="OneMinute Healthcare home" className="shell-brand-link">{collapsed ? <BrandLogo compact /> : <BrandLogo />}</Link>
          </div>
          <NavItems groups={groups} collapsed={collapsed} />
        </div>
      </aside>
      {drawerOpen ? (
        <div className="drawer-root lg:hidden">
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="mb-3 flex items-center justify-between"><BrandLogo compact /><button className="icon-button" type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}><X size={18} /></button></div>
            <NavItems groups={groups} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="shell-main">
        <header className="shell-header">
          <div className="flex items-center gap-3">
            <button className="icon-button shell-burger" type="button" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}><Menu size={19} /></button>
            <h2 className="sr-only">{current?.label === 'Account settings' ? 'Profile' : current?.label ?? 'OneMinute'}</h2>
          </div>
          <div className="flex items-center gap-3">{subtitle ? <span className="hidden max-w-[16rem] truncate text-sm text-slate-500 sm:inline">{subtitle}</span> : null}<AccountMenu user={user} onSignOut={onSignOut} /></div>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
