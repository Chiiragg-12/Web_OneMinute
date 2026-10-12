import { ArrowRight, Building2, ShieldCheck, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';

// Where the mobile app can be installed. Set these when the app is published; until then the page just explains.
const playStoreUrl = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;
const appStoreUrl = import.meta.env.VITE_APP_STORE_URL as string | undefined;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f8f6] px-4 py-8 text-slate-800 sm:px-8">
      <header className="mx-auto flex max-w-4xl items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <Link to="/" aria-label="OneMinute Healthcare home" className="flex items-center gap-3">
          <BrandLogo />
          <span className="hidden font-display text-lg font-semibold text-slate-950 sm:inline">OneMinute Healthcare</span>
        </Link>
        <nav className="flex gap-5 text-sm font-semibold text-teal-700" aria-label="Legal pages">
          <Link to="/privacy" className="hover:text-teal-900">Privacy</Link>
          <Link to="/terms" className="hover:text-teal-900">Terms</Link>
        </nav>
      </header>
      <main className="mx-auto mt-8 max-w-4xl">{children}</main>
    </div>
  );
}

function Choice({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="action-card">
      <span className="icon-tile">{icon}</span>
      <span className="min-w-0">
        <strong>{title}</strong>
        <span className="block text-sm text-slate-500">{text}</span>
      </span>
      <ArrowRight className="ml-auto shrink-0 text-slate-400" size={18} />
    </Link>
  );
}

export function HomePage() {
  return (
    <Frame>
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">OneMinute Healthcare</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950">Clinic and administration console</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          This website is for clinic reception teams and administrators. Patients and doctors use the OneMinute mobile app.
        </p>
        <div className="mt-8 grid gap-3">
          <Choice to="/receptionist/login" icon={<Building2 size={18} />} title="Clinic reception" text="Appointments, queue, walk-ins, doctors, finance and subscription." />
          <Choice to="/admin/login" icon={<ShieldCheck size={18} />} title="Administration" text="Payments, commissions, settlements and reconciliation." />
          <Choice to="/get-the-app" icon={<Smartphone size={18} />} title="Patients and doctors" text="Get the OneMinute app for booking, queues, prescriptions and consultations." />
        </div>
      </div>
    </Frame>
  );
}

export function GetTheAppPage() {
  return (
    <Frame>
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Patients and doctors</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950">Use the OneMinute app</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Booking, live queues, prescriptions, family records and CareGuard reminders for patients, and queues, consultations and prescriptions for doctors, are in the OneMinute mobile app. Install it on your phone and choose <strong>Patient</strong> or <strong>Doctor</strong> when you sign in.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          A doctor added by a clinic receptionist signs in the first time with the Doctor ID and invite code the clinic gives them, using “Activate your account” in the app.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {playStoreUrl && <a className="button button-primary" href={playStoreUrl}>Get it on Google Play</a>}
          {appStoreUrl && <a className="button button-primary" href={appStoreUrl}>Download on the App Store</a>}
          {!playStoreUrl && !appStoreUrl && <p className="text-sm font-semibold text-slate-600">Ask your clinic or administrator for the install link.</p>}
        </div>
        <p className="mt-10 text-sm text-slate-500">
          Clinic staff? <Link className="font-semibold text-teal-700 hover:text-teal-900" to="/receptionist/login">Sign in to the reception console</Link>.
        </p>
      </div>
    </Frame>
  );
}
