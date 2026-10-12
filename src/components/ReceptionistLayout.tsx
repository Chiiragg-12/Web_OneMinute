import { CalendarClock, CalendarDays, ChartNoAxesCombined, ClipboardList, CreditCard, HeartPulse, MessageSquare, PlusCircle, Star, UserRound, UserPlus } from 'lucide-react';
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppShell, type ShellGroup } from './AppShell';
import type { ReceptionistProfile } from '../types/api';

export interface ReceptionistContext { receptionist: ReceptionistProfile; }
export function useReceptionistContext() { return useOutletContext<ReceptionistContext>(); }

export function ReceptionistLayout() {
  const { state, logout } = useAuth();
  const location = useLocation();
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
  const groups: ShellGroup[] = [
    { items: [navigation[0]] },
    { label: 'Appointments', items: [navigation[1], navigation[2], navigation[3], navigation[8], navigation[6]] },
    { label: 'Clinic', items: [navigation[7], navigation[4], navigation[5]] },
    { label: 'CareGuard', items: [navigation[10], navigation[11]] },
    { label: 'Account', items: [navigation[12], navigation[9]] },
  ];
  return (
    <AppShell
      homeTo="/receptionist"
      subtitle={receptionist.clinic.name}
      groups={groups}
      onSignOut={() => void logout('receptionist')}
      user={{
        name: receptionist.fullName,
        email: state.status === 'authenticated' ? state.user.email : null,
        context: [{ label: 'Role', value: 'Receptionist' }, { label: 'Clinic', value: `${receptionist.clinic.name}${receptionist.clinic.isActive ? '' : ' (unavailable)'}` }],
        accountLinks: [{ to: '/receptionist/profile', label: 'Account settings', Icon: UserRound }],
      }}
    >
      <Outlet context={{ receptionist }} />
    </AppShell>
  );
}
