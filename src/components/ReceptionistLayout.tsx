import { CalendarClock, CalendarDays, ChartNoAxesCombined, ClipboardList, CreditCard, HeartPulse, Menu, MessageSquare, PlusCircle, Star, UserRound, UserPlus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NavDrawer } from './NavDrawer';
import { UserMenu } from './UserMenu';
import type { ReceptionistProfile } from '../types/api';

export interface ReceptionistContext { receptionist: ReceptionistProfile; }
export function useReceptionistContext() { return useOutletContext<ReceptionistContext>(); }

export function ReceptionistLayout() {
  const { state, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const receptionist = state.status === 'authenticated' ? state.receptionist : null;
  if (!receptionist) return null;
  if (!receptionist.clinic) return null;
  // Free month is over and no paid period is running: the only place to go is the plans page.
  if (receptionist.clinic.trial?.status === 'expired' && location.pathname !== '/receptionist/plans') return <Navigate to="/receptionist/plans" replace />;
  const view = new URLSearchParams(location.search).get('view');
  const navigation = [
    { to: '/receptionist', label: 'Overview', Icon: HeartPulse, active: location.pathname === '/receptionist' },
    { to: '/receptionist/appointments', label: 'Appointments', Icon: CalendarDays, active: location.pathname === '/receptionist/appointments' && !view },
    { to: '/receptionist/appointments?view=payments', label: 'Payments', Icon: CreditCard, active: location.pathname === '/receptionist/appointments' && view === 'payments' },
    { to: '/receptionist/appointments?view=consultations', label: 'Consultations', Icon: ClipboardList, active: location.pathname === '/receptionist/appointments' && view === 'consultations' },
    { to: '/receptionist/finance', label: 'Finance', Icon: ChartNoAxesCombined, active: location.pathname === '/receptionist/finance' },
    { to: '/receptionist/history', label: 'History', Icon: CalendarDays, active: location.pathname === '/receptionist/history' },
    { to: '/receptionist/walk-in', label: 'Walk-In', Icon: PlusCircle, active: location.pathname === '/receptionist/walk-in' },
    { to: '/receptionist/add-doctor', label: 'Add Doctor', Icon: UserPlus, active: location.pathname === '/receptionist/add-doctor' },
    { to: '/receptionist/queue', label: 'Queue', Icon: ClipboardList, active: location.pathname === '/receptionist/queue' },
    { to: '/receptionist/profile', label: 'Profile', Icon: UserRound, active: location.pathname === '/receptionist/profile' },
    { to: '/receptionist/followups', label: 'Follow-ups', Icon: CalendarClock, active: location.pathname === '/receptionist/followups' },
    { to: '/receptionist/messages', label: 'Messages', Icon: MessageSquare, active: location.pathname === '/receptionist/messages' },
    { to: '/receptionist/plans', label: 'Plans', Icon: Star, active: location.pathname === '/receptionist/plans' },
  ];
  return <div className="min-h-screen bg-[#f4f8f6] text-slate-900"><header className="border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="shell flex min-h-20 items-center justify-between gap-4"><div className="flex items-center gap-3"><button className="icon-button lg:hidden" type="button" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}><Menu size={19} /></button><NavLink to="/receptionist" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-teal-800 text-white"><HeartPulse size={21} /></span><span><strong className="font-display text-lg">OneMinute</strong><span className="ml-2 hidden text-xs font-bold uppercase tracking-[.18em] text-teal-700 sm:inline">Receptionist care</span></span></NavLink></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{receptionist.fullName}</span><UserMenu onSignOut={() => void logout('receptionist')} /></div></div></header><NavDrawer open={drawerOpen} onClose={closeDrawer} title="Menu" items={navigation} /><div className="shell grid gap-8 py-7 lg:grid-cols-[220px_1fr]"><aside className="hidden lg:block"><nav className="sticky top-7 space-y-1">{navigation.map(({ to, label, Icon, active }) => <NavLink key={to} className={() => active ? 'nav-link active' : 'nav-link'} to={to}><Icon size={17} />{label}</NavLink>)}</nav></aside><main className="min-w-0"><div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4"><p className="label">Assigned clinic</p><p className="mt-1 font-display text-lg font-semibold">{receptionist.clinic.name}</p><p className="mt-1 text-sm text-slate-500">{receptionist.clinic.isActive ? 'Active clinic' : 'Clinic unavailable'}</p></div><Outlet context={{ receptionist }} /></main></div><nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden">{navigation.slice(0, 4).map(({ to, label, Icon, active }) => <NavLink key={to} className={() => active ? 'mobile-nav active' : 'mobile-nav'} to={to}><Icon size={17} />{label}</NavLink>)}</nav></div>;
}
