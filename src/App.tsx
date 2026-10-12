import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { LoginPage, StaffRegisterPage } from './pages/AuthPages';
import { ReceptionistLayout } from './components/ReceptionistLayout';
import { ReceptionistAppointmentDetailPage, ReceptionistAppointmentsPage, ReceptionistOverviewPage, ReceptionistWalkInPage } from './pages/ReceptionistPages';
import { ReceptionistProfilePage, ReceptionistQueuePage } from './pages/ReceptionistQueueExtras';
import { ReceptionistAddDoctorPage } from './pages/ReceptionistAddDoctorPage';
import { ReceptionistFinancePage } from './pages/ReceptionistFinancePage';
import { ReceptionistPlansPage } from './pages/ReceptionistPlansPage';
import { ReceptionistHistoryPage } from './pages/HistoryPages';
import { AdminAuditLogPage, AdminClinicDetailPage, AdminClinicsPage, AdminCommissionsPage, AdminLayout, AdminOverviewPage, AdminPaymentsPage, AdminReconciliationPage, AdminSettlementsPage } from './pages/AdminPages';
import { AdminSignupPage } from './pages/AdminSignupPage';
import { PrivacyPolicyPage, TermsOfServicePage } from './pages/LegalPages';
import { ReceptionistFollowUpsPage, ReceptionistMessagesPage } from './pages/CareGuardClinicPages';
import { GetTheAppPage, HomePage } from './pages/LandingPages';

function ReceptionistGuard() {
  const location = useLocation();
  const { state } = useAuth();
  if (state.status === 'loading') return <div className="screen-loading">Checking your session…</div>;
  if (state.status !== 'authenticated' || state.user.role !== 'receptionist' || !state.receptionist) return <Navigate to="/receptionist/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <Outlet />;
}

function AdminGuard() {
  const location = useLocation();
  const { state } = useAuth();
  if (state.status === 'loading') return <div className="screen-loading">Checking your session…</div>;
  if (state.status !== 'authenticated' || state.user.role !== 'admin') return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <Outlet />;
}

// Patients and doctors use the mobile app. Their old web addresses explain that instead of showing a dead end.
const appOnlyPaths = ['/login', '/register', '/doctor/*', '/app/*'];

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/get-the-app" element={<GetTheAppPage />} />
      {appOnlyPaths.map((path) => <Route key={path} path={path} element={<GetTheAppPage />} />)}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/receptionist/login" element={<LoginPage audience="receptionist" />} />
      <Route path="/receptionist/register" element={<StaffRegisterPage role="receptionist" />} />
      <Route path="/admin/signup" element={<AdminSignupPage />} />
      <Route path="/admin/login" element={<LoginPage audience="admin" />} />
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="clinics" element={<AdminClinicsPage />} />
          <Route path="clinics/:clinicId" element={<AdminClinicDetailPage />} />
          <Route path="commissions" element={<AdminCommissionsPage />} />
          <Route path="settlements" element={<AdminSettlementsPage />} />
          <Route path="reconciliation" element={<AdminReconciliationPage />} />
          <Route path="audit-log" element={<AdminAuditLogPage />} />
        </Route>
      </Route>
      <Route element={<ReceptionistGuard />}>
        <Route path="/receptionist" element={<ReceptionistLayout />}>
          <Route index element={<ReceptionistOverviewPage />} />
          <Route path="appointments" element={<ReceptionistAppointmentsPage />} />
          <Route path="appointments/:appointmentId" element={<ReceptionistAppointmentDetailPage />} />
          <Route path="history" element={<ReceptionistHistoryPage />} />
          <Route path="walk-in" element={<ReceptionistWalkInPage />} />
          <Route path="add-doctor" element={<ReceptionistAddDoctorPage />} />
          <Route path="plans" element={<ReceptionistPlansPage />} />
          <Route path="followups" element={<ReceptionistFollowUpsPage />} />
          <Route path="messages" element={<ReceptionistMessagesPage />} />
          <Route path="queue" element={<ReceptionistQueuePage />} />
          <Route path="finance" element={<ReceptionistFinancePage />} />
          <Route path="profile" element={<ReceptionistProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
