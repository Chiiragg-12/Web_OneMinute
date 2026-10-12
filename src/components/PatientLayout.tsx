import {
  CalendarDays,
  HeartPulse,
  MapPin,
  Menu,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { REMINDERS_CHANGED_EVENT, syncCareGuardReminders } from "../utils/careguardReminders";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BrandLogo } from './BrandLogo';
import { NavDrawer } from './NavDrawer';
import { UserMenu } from './UserMenu';

const drawerItems = [
  { to: "/app", label: "Overview", Icon: HeartPulse, end: true },
  { to: "/app/clinics", label: "Find care", Icon: MapPin },
  { to: "/app/appointments", label: "Appointments", Icon: CalendarDays },
  { to: "/app/history", label: "History", Icon: CalendarDays },
  { to: "/app/careguard", label: "CareGuard", Icon: ShieldCheck },
  { to: "/app/profile", label: "My profile", Icon: UserRound },
  { to: "/app/family", label: "Family members", Icon: UserRound },
] as const;

export function PatientLayout() {
  const { state, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  // Keep the phone's CareGuard reminders current: on opening the app and after doses/check-ins change.
  useEffect(() => {
    const sync = () => { void syncCareGuardReminders().catch(() => undefined); };
    sync();
    window.addEventListener(REMINDERS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(REMINDERS_CHANGED_EVENT, sync);
  }, []);
  const patientName =
    state.status === "authenticated" && state.patient
      ? state.patient.fullName
      : "Patient";
  return (
    <div className="min-h-screen bg-[#f4f8f6] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="shell flex min-h-20 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="icon-button lg:hidden"
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={19} />
            </button>
            <Link
              to="/app"
              className="flex min-w-0 items-center gap-3"
              aria-label="OneMinute home"
            >
              <BrandLogo compact />
              <span className="min-w-0 break-words">
                <strong className="font-display text-lg tracking-tight">
                  OneMinute Healthcare
                </strong>
                <span className="ml-2 hidden text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 sm:inline">
                  Patient care
                </span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              Hi, {patientName.split(" ")[0]}
            </span>
            <UserMenu onSignOut={() => void logout("patient")} />
          </div>
        </div>
      </header>
      <NavDrawer open={drawerOpen} onClose={closeDrawer} title="Menu" items={drawerItems} />
      <div className="shell grid gap-8 py-7 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-7 space-y-1">
            <NavLink className="nav-link" to="/app" end>
              <MapPin size={17} />
              Overview
            </NavLink>
            <NavLink className="nav-link" to="/app/clinics">
              <MapPin size={17} />
              Find care
            </NavLink>
            <NavLink className="nav-link" to="/app/appointments">
              <CalendarDays size={17} />
              Appointments
            </NavLink>
            <NavLink className="nav-link" to="/app/history">
              <CalendarDays size={17} />
              History
            </NavLink>
            <NavLink className="nav-link" to="/app/careguard">
              <ShieldCheck size={17} />
              CareGuard
            </NavLink>
            <NavLink className="nav-link" to="/app/profile">
              <UserRound size={17} />
              My profile
            </NavLink>
            <NavLink className="nav-link" to="/app/family">
              <UserRound size={17} />
              Family members
            </NavLink>
          </nav>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden">
        <NavLink className="mobile-nav" to="/app" end>
          <HeartPulse size={17} />
          Home
        </NavLink>
        <NavLink className="mobile-nav" to="/app/clinics">
          <MapPin size={17} />
          Find care
        </NavLink>
        <NavLink className="mobile-nav" to="/app/appointments">
          <CalendarDays size={17} />
          Visits
        </NavLink>
        <NavLink className="mobile-nav" to="/app/history">
          <CalendarDays size={17} />
          History
        </NavLink>
        <NavLink className="mobile-nav" to="/app/profile">
          <UserRound size={17} />
          Profile
        </NavLink>
        <NavLink className="mobile-nav" to="/app/family">
          <UserRound size={17} />
          Family
        </NavLink>
      </nav>
    </div>
  );
}
