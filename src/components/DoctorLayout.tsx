import { CalendarDays, CircleDollarSign, ClipboardList, HeartPulse, Menu, MessageSquare, UserRound } from 'lucide-react';
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { DoctorProfile } from '../types/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DoctorOnboardingPage } from '../pages/DoctorOnboardingPage';
import { NavDrawer } from './NavDrawer';
import { UserMenu } from './UserMenu';

export interface DoctorContext { doctor: DoctorProfile; clinicId: string; setClinicId: (id: string) => void; }
export function useDoctorContext() { return useOutletContext<DoctorContext>(); }

export function DoctorLayout() {
  const { state, logout } = useAuth();
  const { updateDoctor } = useAuth();
  const navigate = useNavigate();
  const doctor = state.status === 'authenticated' ? state.doctor : null;
  const activeClinics = doctor?.clinics.filter((clinic) => clinic.isActive) ?? [];
  const pendingClinic = doctor?.membershipStates?.find((membership) => membership.status === 'pending');
  const [clinicId, setClinicId] = useState(activeClinics[0]?.id ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => {
    if (!activeClinics.some((clinic) => clinic.id === clinicId)) setClinicId(activeClinics[0]?.id ?? '');
  }, [activeClinics, clinicId]);
  // The doctor/clinic snapshot in AuthContext is only as fresh as the last
  // login/session-restore — if a clinic membership gets approved while this
  // app instance stays alive in the background (no cold restart, so no fresh
  // getDoctorProfile() call happens), that snapshot goes stale and keeps
  // routing an already-ACTIVE Doctor into Clinic Linking/Waiting. Re-verify
  // once, authoritatively, whenever about to render a non-Overview branch.
  const revalidated = useRef(false);
  useEffect(() => {
    if (!doctor || activeClinics.length > 0 || revalidated.current) return;
    revalidated.current = true;
    void (async () => {
      try {
        const fresh = await api.getDoctorProfile();
        updateDoctor(fresh.doctor);
      } catch {
        // Keep the existing (possibly still-accurate) state on failure.
      }
    })();
  }, [doctor, activeClinics.length, updateDoctor]);
  const signOut = async () => { await logout('doctor'); navigate('/doctor/login', { replace: true }); };
  if (!doctor) return null;
  if (doctor.professionalProfileComplete === false) return <div className="doctor-app min-h-screen bg-[#f4f8f6] p-6"><main className="shell"><header className="mb-8 flex items-center justify-end"><UserMenu onSignOut={() => void signOut()} /></header><DoctorOnboardingPage onCompleted={(completedDoctor) => { updateDoctor(completedDoctor); navigate('/doctor', { replace: true }); }} /></main></div>;
  if (!activeClinics.length && pendingClinic) return <div className="doctor-app min-h-screen bg-[#f4f8f6] p-6"><main className="shell"><header className="mb-8 flex items-center justify-end"><UserMenu onSignOut={() => void signOut()} /></header><div className="surface"><div className="eyebrow">Clinic approval</div><h1 className="page-title">Waiting for approval</h1><p className="page-lead">Your request to join {pendingClinic.clinic.name} is waiting for receptionist approval.</p></div></main></div>;
  // Reached only when professionalProfileComplete is already true (the branch above returns first otherwise) — skip straight to clinic linking, never re-show the "choice" screen.
  if (!activeClinics.length) return <div className="doctor-app min-h-screen bg-[#f4f8f6] p-6"><main className="shell"><header className="mb-8 flex items-center justify-end"><UserMenu onSignOut={() => void signOut()} /></header><DoctorOnboardingPage professionalProfileComplete onCompleted={(completedDoctor) => { updateDoctor(completedDoctor); navigate('/doctor', { replace: true }); }} /></main></div>;
  const navigation = [['/doctor', 'Overview', HeartPulse], ['/doctor/appointments', 'Appointments', CalendarDays], ['/doctor/queue', 'Queue', ClipboardList], ['/doctor/messages', 'Messages', MessageSquare], ['/doctor/pricing', 'Pricing', CircleDollarSign], ['/doctor/profile', 'Profile', UserRound]] as const;
  return <div className="min-h-screen bg-[#f4f8f6] text-slate-900"><header className="border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="shell flex min-h-20 items-center justify-between gap-4"><div className="flex items-center gap-3"><button className="icon-button lg:hidden" type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button><NavLink to="/doctor" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-teal-950 text-white"><HeartPulse size={21} /></span><span><strong className="font-display text-lg tracking-tight">OneMinute</strong><span className="ml-2 hidden text-xs font-bold uppercase tracking-[.18em] text-teal-700 sm:inline">Doctor care</span></span></NavLink></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">Dr. {doctor.fullName.replace(/^Dr\.\s*/i, '')}</span><UserMenu onSignOut={() => void logout('doctor')} /></div></div></header><NavDrawer open={menuOpen} onClose={closeMenu} title="Menu" items={navigation.map(([to, label, Icon]) => ({ to, label, Icon, end: to === '/doctor' }))} /><div className="shell grid gap-8 py-7 lg:grid-cols-[220px_1fr]"><aside className="hidden lg:block"><nav className="sticky top-7 space-y-1">{navigation.map(([to, label, Icon]) => <NavLink key={to} end={to === '/doctor'} className="nav-link" to={to}><Icon size={17} />{label}</NavLink>)}</nav></aside><main className="min-w-0"><div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="label">Clinic context</p><p className="mt-1 font-display text-lg font-semibold">{activeClinics.find((clinic) => clinic.id === clinicId)?.name ?? 'No active clinic'}</p></div><select className="field max-w-sm" value={clinicId} onChange={(event) => setClinicId(event.target.value)} aria-label="Select clinic">{activeClinics.map((clinic) => <option value={clinic.id} key={clinic.id}>{clinic.name}</option>)}</select></div><Outlet context={{ doctor, clinicId, setClinicId }} /></main></div><nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden">{navigation.slice(0, 4).map(([to, label, Icon]) => <NavLink key={to} className="mobile-nav" to={to} end={to === '/doctor'}><Icon size={17} />{label}</NavLink>)}</nav></div>;
}
