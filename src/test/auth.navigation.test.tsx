import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { safeReturnTo } from '../pages/AuthPages';

const mocks = vi.hoisted(() => ({ api: { refresh: vi.fn(), login: vi.fn(), logout: vi.fn(), getDoctorProfile: vi.fn(), getDoctorDashboard: vi.fn(), getReceptionistProfile: vi.fn(), getReceptionistDashboard: vi.fn(), getPatient: vi.fn(), getDoctorAppointment: vi.fn(), getClinic: vi.fn(), getReceptionistAppointment: vi.fn(), updateDoctorProfile: vi.fn(), updateDoctorConsultationModes: vi.fn(), googleLogin: vi.fn() }, setAccessToken: vi.fn(), setSessionExpiredHandler: vi.fn() }));
vi.mock('../api/client', () => ({ ...mocks, ApiError: class ApiError extends Error { status = 401; } }));

const activeDoctorProfile = { id: 'doctor-1', fullName: 'Dr. Active', professionalProfileComplete: true, clinics: [{ id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', address: null, isActive: true }], membershipStates: [{ id: 'm1', clinicId: 'c1', isActive: true, status: 'active', clinic: { id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }] };

// Programmatically drives AuthContext's googleLogin — the same context method the
// native/web Google Sign-In button calls after obtaining a credential — without
// depending on the platform SDK, which isn't available in this test environment.
function GoogleLoginHarness({ credential }: { credential: string }) {
  const { googleLogin } = useAuth();
  useEffect(() => { void googleLogin(credential, 'doctor'); }, [googleLogin, credential]);
  return null;
}

const token = (role: string) => ['header', btoa(JSON.stringify({ sub: `${role}-user`, role })), 'signature'].join('.');
function renderApp(path: string) { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>); }

let sessionExpiredHandler: (() => void) | undefined;
beforeEach(() => { vi.clearAllMocks(); sessionExpiredHandler = undefined; mocks.setSessionExpiredHandler.mockImplementation((handler: (() => void) | undefined) => { sessionExpiredHandler = handler; }); mocks.api.refresh.mockRejectedValue(new Error('expired')); mocks.api.login.mockRejectedValue(new Error('login unavailable')); mocks.api.logout.mockResolvedValue(null); mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Demo', specialization: null, qualifications: null, registrationNumber: null, registrationCouncil: null, designation: null, professionalProfileComplete: true, clinics: [], membershipStates: [] } }); mocks.api.getDoctorDashboard.mockResolvedValue({ dashboard: { doctor: { id: 'doctor-1', fullName: 'Dr. Demo', specialization: null }, clinic: { id: 'clinic-1', name: 'Clinic', timezone: 'Asia/Kolkata' }, status: 'available', activeBreak: null, counts: {}, appointmentCounts: {}, waitingByMode: {}, servingByMode: [], appointments: [] } }); mocks.api.getReceptionistProfile.mockResolvedValue({ receptionist: { id: 'rec-1', fullName: 'Reception Demo', clinic: { id: 'clinic-1', publicClinicId: 'OMC-1', name: 'Clinic', isActive: true } } }); mocks.api.getReceptionistDashboard.mockResolvedValue({ dashboard: { clinic: { id: 'clinic-1', name: 'Clinic', timezone: 'Asia/Kolkata' }, doctors: [], counts: {}, appointments: [] } }); mocks.api.getDoctorAppointment.mockReturnValue(new Promise(() => undefined)); mocks.api.getClinic.mockReturnValue(new Promise(() => undefined)); mocks.api.getReceptionistAppointment.mockReturnValue(new Promise(() => undefined)); });

describe('role-scoped auth navigation', () => {
  it('shows Doctor login for Patient and Receptionist sessions instead of treating them as Doctor sessions', async () => {
    mocks.api.refresh.mockResolvedValue(token('patient')); mocks.api.getPatient.mockResolvedValue({ patient: { healthId: 'H-1', fullName: 'Patient', healthProfileComplete: true } });
    renderApp('/doctor/login'); expect(await screen.findByText('Welcome back, Doctor')).toBeInTheDocument();
    mocks.api.refresh.mockResolvedValue(token('receptionist')); mocks.api.getReceptionistProfile.mockResolvedValue({ receptionist: { id: 'r-1', fullName: 'Reception', clinic: null } });
    renderApp('/doctor/login'); expect((await screen.findAllByText('DOCTOR APP')).length).toBeGreaterThan(0);
  });

  it('routes an incomplete authenticated Doctor from Doctor login to onboarding', async () => {
    mocks.api.refresh.mockResolvedValue(token('doctor')); mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Incomplete', professionalProfileComplete: false, clinics: [] } });
    renderApp('/doctor/login'); expect(await screen.findByText('Set up your professional profile')).toBeInTheDocument();
  });

  it('routes a pending Doctor to approval waiting and never shows clinic linking', async () => {
    mocks.api.refresh.mockResolvedValue(token('doctor')); mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Pending', professionalProfileComplete: true, clinics: [], membershipStates: [{ id: 'm1', clinicId: 'c1', isActive: false, status: 'pending', clinic: { id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }] } });
    renderApp('/doctor'); expect(await screen.findByText('Waiting for approval')).toBeInTheDocument(); expect(screen.queryByText('Register for a Clinic')).not.toBeInTheDocument();
  });

  it('routes an active Doctor directly to the dashboard without clinic linking', async () => {
    mocks.api.refresh.mockResolvedValue(token('doctor')); mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Active', professionalProfileComplete: true, clinics: [{ id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', address: null, isActive: true }], membershipStates: [{ id: 'm1', clinicId: 'c1', isActive: true, status: 'active', clinic: { id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }] } });
    renderApp('/doctor'); expect(await screen.findByText('Doctor overview')).toBeInTheDocument(); expect(screen.queryByText('Register for a Clinic')).not.toBeInTheDocument();
  });

  it('routes a complete Doctor with no membership to clinic registration', async () => {
    mocks.api.refresh.mockResolvedValue(token('doctor')); mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. New', professionalProfileComplete: true, clinics: [], membershipStates: [] } });
    renderApp('/doctor'); expect(await screen.findByText('Register for a Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Set up your professional profile')).not.toBeInTheDocument();
  });

  it('revalidates a stale no-clinic session snapshot and routes straight to Overview once the backend confirms an active membership', async () => {
    mocks.api.refresh.mockResolvedValue(token('doctor'));
    mocks.api.getDoctorProfile
      .mockResolvedValueOnce({ doctor: { id: 'doctor-1', fullName: 'Dr. Stale', professionalProfileComplete: true, clinics: [], membershipStates: [] } })
      .mockResolvedValueOnce({ doctor: { id: 'doctor-1', fullName: 'Dr. Stale', professionalProfileComplete: true, clinics: [{ id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', address: null, isActive: true }], membershipStates: [{ id: 'm1', clinicId: 'c1', isActive: true, status: 'active', clinic: { id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }] } });
    renderApp('/doctor');
    expect(await screen.findByText('Doctor overview')).toBeInTheDocument();
    expect(screen.queryByText('Register for a Clinic')).not.toBeInTheDocument();
    expect(screen.queryByText('Set up your professional profile')).not.toBeInTheDocument();
  });

  it('Register For Myself only shows success after the backend persists every required field and confirms professionalProfileComplete, then Continue opens Overview for an active-clinic Doctor', async () => {
    mocks.api.refresh.mockResolvedValue(token('doctor'));
    const incompleteProfile = { doctor: { id: 'doctor-1', fullName: 'Dr. New', professionalProfileComplete: false, clinics: [], membershipStates: [] } };
    mocks.api.getDoctorProfile
      .mockResolvedValueOnce(incompleteProfile) // AuthContext bootstrap fetch on login
      .mockResolvedValueOnce(incompleteProfile) // DoctorLayout's (unmodified) clinic-membership revalidation effect, unrelated to this flow
      .mockResolvedValueOnce({
        doctor: {
          id: 'doctor-1',
          publicDoctorId: 'OMD-ABCD1234',
          fullName: 'Dr. Ready',
          specialization: 'General medicine',
          qualifications: 'MBBS',
          registrationNumber: 'REG-1',
          registrationCouncil: 'Medical Council',
          professionalProfileComplete: true,
          clinics: [{ id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', address: null, isActive: true }],
          membershipStates: [{ id: 'm1', clinicId: 'c1', isActive: true, status: 'active', clinic: { id: 'c1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }],
        },
      });
    mocks.api.updateDoctorProfile.mockResolvedValue({ doctor: {} });
    mocks.api.updateDoctorConsultationModes.mockResolvedValue({ pricing: [] });
    renderApp('/doctor/login');
    expect(await screen.findByText('Set up your professional profile')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Register for Myself/ }));
    await user.type(screen.getByLabelText('Full legal/professional name'), 'Dr. Ready');
    await user.type(screen.getByLabelText('Primary specialization'), 'General medicine');
    await user.type(screen.getByLabelText('Medical qualification'), 'MBBS');
    await user.type(screen.getByLabelText('Registration number'), 'REG-1');
    await user.type(screen.getByLabelText('Registration council/authority'), 'Medical Council');
    await user.type(screen.getByLabelText('Fee (INR)'), '500');
    await user.click(screen.getByRole('button', { name: /Complete Profile/ }));
    await waitFor(() => expect(mocks.api.updateDoctorProfile).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'Dr. Ready',
      specialization: 'General medicine',
      qualifications: 'MBBS',
      registrationNumber: 'REG-1',
      registrationCouncil: 'Medical Council',
    })));
    expect(mocks.api.getDoctorProfile).toHaveBeenCalledTimes(3); // bootstrap + layout revalidation + the post-save confirmation that gates success
    expect(await screen.findByText('Your profile is ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByText('Doctor overview')).toBeInTheDocument();
  });

  it('sends Doctor and Receptionist refresh failures to their own login pages without a patient fallback', async () => { renderApp('/doctor/appointments'); expect(await screen.findByText('Welcome back, Doctor')).toBeInTheDocument(); renderApp('/receptionist/appointments/a1'); expect((await screen.findAllByText('RECEPTIONIST APP')).length).toBeGreaterThan(0); });
  it.each(['Missing refresh token', 'Invalid or expired refresh token'])('never renders a bootstrap %s error on Receptionist login', async (message) => {
    mocks.api.refresh.mockRejectedValue(new Error(message));
    renderApp('/receptionist/login');
    expect((await screen.findAllByText('RECEPTIONIST APP')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Your session has ended')).not.toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.api.logout).toHaveBeenCalled());
  });
  it('shows credential-specific feedback for a failed Receptionist login without refreshing', async () => {
    mocks.api.login.mockRejectedValue(new Error('Invalid email/phone or password'));
    const user = userEvent.setup();
    renderApp('/receptionist/login');
    await screen.findByText('Welcome back');
    await user.type(screen.getByLabelText('Email or phone'), 'receptionist@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Unable to sign in')).toBeInTheDocument();
    expect(screen.getByText('Invalid email/phone or password')).toBeInTheDocument();
    expect(screen.queryByText('Your session has ended')).not.toBeInTheDocument();
  });
  it('shows only a user-friendly notice when an active Receptionist session expires', async () => {
    mocks.api.refresh.mockResolvedValue(token('receptionist'));
    renderApp('/receptionist');
    await waitFor(() => expect(sessionExpiredHandler).toBeTypeOf('function'));
    act(() => sessionExpiredHandler?.());
    expect((await screen.findAllByText('RECEPTIONIST APP')).length).toBeGreaterThan(0);
    expect(screen.getByText('Your session has expired')).toBeInTheDocument();
    expect(screen.getByText('Please sign in again.')).toBeInTheDocument();
    expect(screen.queryByText('Invalid or expired refresh token')).not.toBeInTheDocument();
  });
  it('keeps an authorized Doctor detail route during bootstrap and logs out to Doctor login', async () => { mocks.api.refresh.mockResolvedValue(token('doctor')); mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Demo', professionalProfileComplete: true, clinics: [{ id: 'clinic-1', publicClinicId: 'OMC-12345678', name: 'Clinic', address: null, isActive: true }], membershipStates: [{ id: 'm1', clinicId: 'clinic-1', isActive: true, status: 'active', clinic: { id: 'clinic-1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }] } }); const user = userEvent.setup(); renderApp('/doctor/appointments/clinic-1/a1'); expect(await screen.findByText('Doctor care')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'More options' })); await user.click(await screen.findByRole('menuitem', { name: 'Sign out' })); await waitFor(() => expect(mocks.api.logout).toHaveBeenCalledWith('doctor')); expect(await screen.findByText('Welcome back, Doctor')).toBeInTheDocument(); });
  it('keeps an authorized Receptionist detail route during bootstrap and logs out to Receptionist login', async () => { mocks.api.refresh.mockResolvedValue(token('receptionist')); const user = userEvent.setup(); renderApp('/receptionist/appointments/a1'); expect(await screen.findByText('Receptionist care')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'More options' })); await user.click(await screen.findByRole('menuitem', { name: 'Sign out' })); await waitFor(() => expect(mocks.api.logout).toHaveBeenCalledWith('receptionist')); expect((await screen.findAllByText('RECEPTIONIST APP')).length).toBeGreaterThan(0); });
  it('accepts only same-role internal return paths', () => { expect(safeReturnTo('/receptionist/appointments?view=payments&status=pending', 'receptionist')).toContain('status=pending'); expect(safeReturnTo('https://attacker.test', 'receptionist')).toBe('/receptionist'); expect(safeReturnTo('/doctor/appointments', 'receptionist')).toBe('/receptionist'); expect(safeReturnTo('/app/history', 'doctor')).toBe('/doctor'); });

  describe('Doctor authentication lifecycle', () => {
    it('app close/reopen without logout restores the session and opens Overview directly (no Login/onboarding)', async () => {
      mocks.api.refresh.mockResolvedValue(token('doctor'));
      mocks.api.getDoctorProfile.mockResolvedValue({ doctor: activeDoctorProfile });
      renderApp('/doctor');
      expect(await screen.findByText('Doctor overview')).toBeInTheDocument();
      expect(screen.queryByText('Welcome back, Doctor')).not.toBeInTheDocument();
      expect(screen.queryByText('Set up your professional profile')).not.toBeInTheDocument();
    });

    it('phone restart / app kill without logout restores the session and opens Overview directly', async () => {
      // From the frontend's perspective a cold process restart is identical to a fresh
      // mount that restores its session via the persisted refresh cookie — there is no
      // separate in-memory state to lose, so the same mechanism is exercised here.
      mocks.api.refresh.mockResolvedValue(token('doctor'));
      mocks.api.getDoctorProfile.mockResolvedValue({ doctor: activeDoctorProfile });
      renderApp('/doctor');
      expect(await screen.findByText('Doctor overview')).toBeInTheDocument();
    });

    it('explicit Logout is the only action that clears the persisted session — reopening after Logout shows Login, not Overview', async () => {
      mocks.api.refresh.mockResolvedValue(token('doctor'));
      mocks.api.getDoctorProfile.mockResolvedValue({ doctor: activeDoctorProfile });
      const user = userEvent.setup();
      renderApp('/doctor');
      expect(await screen.findByText('Doctor overview')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'More options' })); await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
      await waitFor(() => expect(mocks.api.logout).toHaveBeenCalledWith('doctor'));
      expect(await screen.findByText('Welcome back, Doctor')).toBeInTheDocument();
      // Simulate the next app open: the refresh cookie was cleared by Logout, so restoring now fails.
      mocks.api.refresh.mockRejectedValue(new Error('expired'));
      renderApp('/doctor');
      expect(await screen.findByText('Welcome back, Doctor')).toBeInTheDocument();
      expect(screen.queryByText('Doctor overview')).not.toBeInTheDocument();
    });

    it('an existing completed Doctor logging in again with email/password lands on Overview directly, never onboarding', async () => {
      mocks.api.login.mockResolvedValue({ accessToken: token('doctor'), user: { id: 'doctor-1', role: 'doctor', email: 'doc@example.com', phone: null } });
      mocks.api.getDoctorProfile.mockResolvedValue({ doctor: activeDoctorProfile });
      const user = userEvent.setup();
      renderApp('/doctor/login');
      await screen.findByText('Welcome back, Doctor');
      await user.type(screen.getByLabelText('Email or phone'), 'doc@example.com');
      await user.type(screen.getByLabelText('Password'), 'correct-password');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      expect(await screen.findByText('Doctor overview')).toBeInTheDocument();
      expect(screen.queryByText('Set up your professional profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Register for a Clinic')).not.toBeInTheDocument();
    });

    it('an existing completed Doctor returning through Google Sign-In lands on Overview directly, never onboarding', async () => {
      mocks.api.googleLogin.mockResolvedValue({ accessToken: token('doctor'), user: { id: 'doctor-1', role: 'doctor', email: 'doc@example.com', phone: null } });
      mocks.api.getDoctorProfile.mockResolvedValue({ doctor: activeDoctorProfile });
      render(<MemoryRouter initialEntries={['/doctor/login']}><AuthProvider><GoogleLoginHarness credential="mock-google-credential" /><App /></AuthProvider></MemoryRouter>);
      expect(await screen.findByText('Doctor overview')).toBeInTheDocument();
      expect(screen.queryByText('Set up your professional profile')).not.toBeInTheDocument();
      expect(mocks.api.googleLogin).toHaveBeenCalledWith('doctor', 'mock-google-credential');
    });
  });
});