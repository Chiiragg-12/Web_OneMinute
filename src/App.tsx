import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { PatientLayout } from './components/PatientLayout';
import { DoctorClaimPage, ForcePasswordChangePage, LoginPage, RegisterPage, StaffRegisterPage } from './pages/AuthPages';
import { ClinicPage, ClinicsPage, DashboardPage, DoctorPage, HealthProfileOnboarding, ProfilePage } from './pages/PatientPages';
import { AppointmentDetailPage, AppointmentsPage, BookingPage } from './pages/BookingPages';
import { TrackerPage } from './pages/TrackerPage';
import { FamilyMemberFormPage, FamilyMemberPage, FamilyMembersPage } from './pages/FamilyPages';
import { DoctorLayout } from './components/DoctorLayout';
import { DoctorAppointmentDetailPage, DoctorAppointmentsPage, DoctorOverviewPage, DoctorPricingPage, DoctorProfilePage, DoctorQueuePage } from './pages/DoctorPages';
import { ReceptionistLayout } from './components/ReceptionistLayout';
import { ReceptionistAppointmentDetailPage, ReceptionistAppointmentsPage, ReceptionistOverviewPage, ReceptionistWalkInPage } from './pages/ReceptionistPages';
import { ReceptionistProfilePage, ReceptionistQueuePage } from './pages/ReceptionistQueueExtras';
import { ReceptionistAddDoctorPage } from './pages/ReceptionistAddDoctorPage';
import { ReceptionistFinancePage } from './pages/ReceptionistFinancePage';
import { ReceptionistPlansPage } from './pages/ReceptionistPlansPage';
import { PatientHistoryPage, ReceptionistHistoryPage } from './pages/HistoryPages';
import { AdminAuditLogPage, AdminClinicDetailPage, AdminClinicsPage, AdminCommissionsPage, AdminLayout, AdminOverviewPage, AdminPaymentsPage, AdminReconciliationPage, AdminSettlementsPage } from './pages/AdminPages';
import { AdminSignupPage } from './pages/AdminSignupPage';
import { PrivacyPolicyPage, TermsOfServicePage } from './pages/LegalPages';
import { CareGuardHistoryPage, CareGuardHomePage, CareGuardPlanPage } from './pages/CareGuardPages';
import { CaredForPlanPage, CaredForPlansPage, CaregiversPage } from './pages/CareGuardFamilyPages';
import { DoctorMessagesPage, ReceptionistFollowUpsPage, ReceptionistMessagesPage } from './pages/CareGuardClinicPages';

function healthOnboardingSkippedKey(userId: string) { return `oneminute:health-onboarding-skipped:${userId}`; }

function PatientGuard() {
  const location = useLocation();
  const { state } = useAuth();
  const userId = state.status === 'authenticated' ? state.user.id : null;
  const [skipped, setSkipped] = useState(false);
  useEffect(() => { if (userId) setSkipped(sessionStorage.getItem(healthOnboardingSkippedKey(userId)) === '1'); }, [userId]);
  if (state.status === 'loading') return <div className="screen-loading">Checking your session…</div>;
  if (state.status !== 'authenticated' || state.user.role !== 'patient' || !state.patient) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (state.user.mustChangePassword) return <ForcePasswordChangePage />;
  if (!state.patient.healthProfileComplete && !skipped) {
    return <HealthProfileOnboarding onSkip={() => { sessionStorage.setItem(healthOnboardingSkippedKey(state.user.id), '1'); setSkipped(true); }} />;
  }
  return <PatientLayout />;
}

function DoctorGuard() {
  const location = useLocation();
  const { state } = useAuth();
  if (state.status === 'loading') return <div className="screen-loading">Checking your session…</div>;
  if (state.status !== 'authenticated' || state.user.role !== 'doctor' || !state.doctor) return <Navigate to="/doctor/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (state.user.mustChangePassword) return <ForcePasswordChangePage />;
  return <Outlet />;
}

function ReceptionistGuard() {
  const location = useLocation();
  const { state } = useAuth();
  if (state.status === 'loading') return <div className="screen-loading">Checking your session…</div>;
  if (state.status !== 'authenticated' || state.user.role !== 'receptionist' || !state.receptionist) return <Navigate to="/receptionist/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (state.user.mustChangePassword) return <ForcePasswordChangePage />;
  return <Outlet />;
}

function AdminGuard() {
  const location = useLocation();
  const { state } = useAuth();
  if (state.status === 'loading') return <div className="screen-loading">Checking your session…</div>;
  if (state.status !== 'authenticated' || state.user.role !== 'admin') return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <Outlet />;
}

function NativeEntry() {
  const nativeRole = import.meta.env.MODE === 'doctor' ? 'doctor' : import.meta.env.MODE === 'patient' ? 'patient' : null;
  return <Navigate to={nativeRole === 'doctor' ? '/doctor' : nativeRole === 'patient' ? '/app' : '/login'} replace />;
}

function LegacyApp() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/doctor/login" element={<LoginPage audience="doctor" />} /><Route path="/receptionist/login" element={<LoginPage audience="receptionist" />} /><Route path="/register" element={<RegisterPage />} /><Route element={<PatientGuard />}><Route path="/app" element={<Outlet />}><Route index element={<DashboardPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="family" element={<FamilyMembersPage />} /><Route path="family/new" element={<FamilyMemberFormPage />} /><Route path="family/:familyMemberId" element={<FamilyMemberPage />} /><Route path="family/:familyMemberId/edit" element={<FamilyMemberFormPage />} /><Route path="history" element={<PatientHistoryPage />} /><Route path="careguard" element={<CareGuardHomePage />} /><Route path="careguard/history" element={<CareGuardHistoryPage />} /><Route path="careguard/caregivers" element={<CaregiversPage />} /><Route path="careguard/for/:grantId" element={<CaredForPlansPage />} /><Route path="careguard/for/:grantId/:planId" element={<CaredForPlanPage />} /><Route path="careguard/:planId" element={<CareGuardPlanPage />} /><Route path="clinics" element={<ClinicsPage />} /><Route path="clinics/:clinicId" element={<ClinicPage />} /><Route path="clinics/:clinicId/doctors/:doctorId" element={<DoctorPage />} /><Route path="clinics/:clinicId/doctors/:doctorId/book" element={<BookingPage />} /><Route path="appointments" element={<AppointmentsPage />} /><Route path="appointments/:appointmentId" element={<AppointmentDetailPage />} /><Route path="appointments/:appointmentId/track" element={<TrackerPage />} /></Route></Route><Route element={<DoctorGuard />}><Route path="/doctor" element={<DoctorLayout />}><Route index element={<DoctorOverviewPage />} /><Route path="appointments" element={<DoctorAppointmentsPage />} /><Route path="appointments/:clinicId/:appointmentId" element={<DoctorAppointmentDetailPage />} /><Route path="queue" element={<DoctorQueuePage />} /><Route path="pricing" element={<DoctorPricingPage />} /><Route path="messages" element={<DoctorMessagesPage />} /><Route path="profile" element={<DoctorProfilePage />} /></Route></Route><Route element={<ReceptionistGuard />}><Route path="/receptionist" element={<ReceptionistLayout />}><Route index element={<ReceptionistOverviewPage />} /><Route path="appointments" element={<ReceptionistAppointmentsPage />} /><Route path="appointments/:appointmentId" element={<ReceptionistAppointmentDetailPage />} /><Route path="history" element={<ReceptionistHistoryPage />} /><Route path="walk-in" element={<ReceptionistWalkInPage />} /><Route path="add-doctor" element={<ReceptionistAddDoctorPage />} /><Route path="plans" element={<ReceptionistPlansPage />} /><Route path="followups" element={<ReceptionistFollowUpsPage />} /><Route path="messages" element={<ReceptionistMessagesPage />} /><Route path="queue" element={<ReceptionistQueuePage />} /><Route path="finance" element={<ReceptionistFinancePage />} /><Route path="profile" element={<ReceptionistProfilePage />} /></Route></Route><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
}

function App() {
  return <Routes><Route path="/" element={<NativeEntry />} /><Route path="/privacy" element={<PrivacyPolicyPage />} /><Route path="/terms" element={<TermsOfServicePage />} /><Route path="/doctor/register" element={<StaffRegisterPage role="doctor" />} /><Route path="/doctor/claim" element={<DoctorClaimPage />} /><Route path="/receptionist/register" element={<StaffRegisterPage role="receptionist" />} /><Route path="/admin/signup" element={<AdminSignupPage />} /><Route path="/admin/login" element={<LoginPage audience="admin" />} /><Route element={<AdminGuard />}><Route path="/admin" element={<AdminLayout />}><Route index element={<AdminOverviewPage />} /><Route path="payments" element={<AdminPaymentsPage />} /><Route path="clinics" element={<AdminClinicsPage />} /><Route path="clinics/:clinicId" element={<AdminClinicDetailPage />} /><Route path="commissions" element={<AdminCommissionsPage />} /><Route path="settlements" element={<AdminSettlementsPage />} /><Route path="reconciliation" element={<AdminReconciliationPage />} /><Route path="audit-log" element={<AdminAuditLogPage />} /></Route></Route><Route path="*" element={<LegacyApp />} /></Routes>;
}

export default App;
