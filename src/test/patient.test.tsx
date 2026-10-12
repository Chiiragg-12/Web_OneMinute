import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { ClinicPage, ClinicsPage, DoctorPage } from '../pages/PatientPages';

const mocks = vi.hoisted(() => ({
  api: { refresh: vi.fn(), login: vi.fn(), registerPatient: vi.fn(), logout: vi.fn(), getPatient: vi.fn(), getDoctorProfile: vi.fn(), getDoctorDashboard: vi.fn(), listClinics: vi.fn(), discoverCare: vi.fn(), getClinic: vi.fn(), listClinicDoctors: vi.fn(), getDoctor: vi.fn(), getDoctorOptions: vi.fn(), updatePatient: vi.fn() },
  setAccessToken: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
}));

vi.mock('../api/client', () => ({ ...mocks, ApiError: class ApiError extends Error { status = 400; constructor(_status: number, message: string) { super(message); } } }));

const patient = { healthId: 'H-PERMANENT', fullName: 'Asha Patient', email: 'asha@example.com', phone: null, dob: '1990-01-01', gender: null, heightCm: 170, weightKg: 65, sex: 'male', bmi: 22.5, healthProfileComplete: true };
const token = ['header', btoa(JSON.stringify({ sub: 'user-1', role: 'patient' })), 'signature'].join('.');

function renderApp(path = '/app') { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>); }
function setAuthenticated() { mocks.api.refresh.mockResolvedValue(token); mocks.api.getPatient.mockResolvedValue({ patient }); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.refresh.mockRejectedValue(new Error('not signed in'));
  mocks.api.getPatient.mockResolvedValue({ patient });
  mocks.api.logout.mockResolvedValue(null);
  mocks.api.getDoctorDashboard.mockResolvedValue({ dashboard: { doctor: { id: 'doctor-1', fullName: 'Dr. Demo', specialization: 'General medicine' }, clinic: { id: 'clinic-1', name: 'Clinic', timezone: 'Asia/Kolkata' }, status: 'available', activeBreak: null, counts: {}, appointmentCounts: {}, waitingByMode: {}, servingByMode: [], appointments: [] } });
});

describe('patient authentication and protection', () => {
  it('logs in successfully and loads the patient profile', async () => {
    mocks.api.login.mockResolvedValue({ accessToken: token, user: { id: 'user-1', role: 'patient', email: patient.email, phone: null } });
    const user = userEvent.setup(); renderApp('/login');
    await user.type(screen.getByLabelText('Email or phone'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mocks.api.login).toHaveBeenCalledOnce());
    expect(mocks.api.getPatient).toHaveBeenCalled();
    expect(await screen.findByText('Patient care')).toBeInTheDocument();
  });

  it('shows the dedicated patient and doctor login presentations and routes Doctor login to Doctor care', async () => {
    renderApp('/login'); expect((await screen.findAllByText('PATIENT APP')).length).toBeGreaterThan(0); cleanup();
    const doctorToken = ['header', btoa(JSON.stringify({ sub: 'doctor-user', role: 'doctor' })), 'signature'].join('.');
    mocks.api.login.mockResolvedValue({ accessToken: doctorToken, user: { id: 'doctor-user', role: 'doctor', email: 'demo.doctor@oneminute.local', phone: null } });
    mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Demo', specialization: 'General medicine', professionalProfileComplete: true, clinics: [{ id: 'clinic-1', publicClinicId: 'OMC-12345678', name: 'Clinic', address: null, isActive: true }], membershipStates: [{ id: 'membership-1', clinicId: 'clinic-1', isActive: true, status: 'active', clinic: { id: 'clinic-1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }] } });
    const user = userEvent.setup(); renderApp('/doctor/login'); expect((await screen.findAllByText('DOCTOR APP')).length).toBeGreaterThan(0); await user.type(screen.getAllByLabelText('Email or phone').at(-1)!, 'demo.doctor@oneminute.local'); await user.type(screen.getAllByLabelText('Password').at(-1)!, 'password'); await user.click(screen.getAllByRole('button', { name: /sign in/i }).at(-1)!); expect(await screen.findByText('Doctor care')).toBeInTheDocument();
  });

  it('shows a login failure without entering the app', async () => {
    mocks.api.login.mockRejectedValue(new Error('Invalid email/phone or password'));
    const user = userEvent.setup(); renderApp('/login');
    await user.type(screen.getByLabelText('Email or phone'), 'asha@example.com'); await user.type(screen.getByLabelText('Password'), 'wrongpass'); await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Invalid email/phone or password')).toBeInTheDocument();
  });

  it('validates registration identifiers before making an API call', async () => {
    const user = userEvent.setup(); renderApp('/register');
    await user.type(screen.getByLabelText('Full name'), 'Asha Patient'); await user.type(screen.getByLabelText('Password'), 'password123'); await user.click(screen.getByRole('button', { name: /create patient account/i }));
    expect(await screen.findByText('Email or phone is required')).toBeInTheDocument(); expect(mocks.api.registerPatient).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users away from patient routes after refresh fails', async () => {
    renderApp('/app');
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  });

  it('shows the permanent Health ID and logs out', async () => {
    setAuthenticated(); const user = userEvent.setup(); renderApp('/app');
    expect(await screen.findByText('H-PERMANENT')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More options' })); await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(mocks.api.logout).toHaveBeenCalledOnce());
  });
});

describe('patient discovery states', () => {
  it('shows clinic loading and error states', async () => {
    let resolveRequest: (value: { results: never[]; specialties: never[] }) => void = () => undefined;
    mocks.api.discoverCare.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<MemoryRouter><ClinicsPage /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Finding care options'); resolveRequest({ results: [], specialties: [] });
    await waitFor(() => expect(screen.getByText('No doctors found for these filters.')).toBeInTheDocument());
    mocks.api.discoverCare.mockRejectedValue(new Error('Directory unavailable')); render(<MemoryRouter><ClinicsPage /></MemoryRouter>);
    expect(await screen.findByText('Directory unavailable')).toBeInTheDocument();
  });

  it('loads a selected clinic and doctor', async () => {
    mocks.api.getClinic.mockResolvedValue({ clinic: { id: 'clinic-1', name: 'Harbor Clinic', address: null, timezone: 'Asia/Kolkata' } });
    mocks.api.listClinicDoctors.mockResolvedValue({ doctors: [{ id: 'doctor-1', fullName: 'Dr. Mira', specialization: 'Family medicine' }] });
    render(<MemoryRouter initialEntries={['/app/clinics/clinic-1']}><Routes><Route path="/app/clinics/:clinicId" element={<ClinicPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Dr. Mira')).toBeInTheDocument();
    expect(mocks.api.listClinicDoctors).toHaveBeenCalledWith('clinic-1');
  });

  it('loads doctor options while preserving the selected clinic context', async () => {
    mocks.api.getDoctor.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Mira', specialization: 'Family medicine', clinics: [{ id: 'clinic-1', name: 'Harbor Clinic', address: null, timezone: 'Asia/Kolkata' }] } });
    mocks.api.getDoctorOptions.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Mira', specialization: 'Family medicine' }, clinicId: 'clinic-1', options: [{ consultationMode: 'video', durationMinutes: 20, priceCents: 2500 }] });
    render(<MemoryRouter initialEntries={['/app/clinics/clinic-1/doctors/doctor-1']}><Routes><Route path="/app/clinics/:clinicId/doctors/:doctorId" element={<DoctorPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('video')).toBeInTheDocument();
  });
});

describe('health profile onboarding', () => {
  const incompletePatient = { ...patient, heightCm: null, weightKg: null, sex: null, bmi: null, healthProfileComplete: false };

  beforeEach(() => { sessionStorage.clear(); });

  it('shows onboarding to a Patient with an incomplete health profile', async () => {
    setAuthenticated(); mocks.api.getPatient.mockResolvedValue({ patient: incompletePatient });
    renderApp('/app');
    expect(await screen.findByText('Complete your health profile')).toBeInTheDocument();
  });

  it('does not show onboarding once the health profile is complete', async () => {
    setAuthenticated(); renderApp('/app');
    expect(await screen.findByText('Good morning, Asha.')).toBeInTheDocument();
    expect(screen.queryByText('Complete your health profile')).not.toBeInTheDocument();
  });

  it('does not show the patient onboarding to a Doctor session', async () => {
    const doctorToken = ['header', btoa(JSON.stringify({ sub: 'doctor-user', role: 'doctor' })), 'signature'].join('.');
    mocks.api.refresh.mockResolvedValue(doctorToken);
    mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { id: 'doctor-1', fullName: 'Dr. Demo', specialization: 'General medicine', professionalProfileComplete: true, clinics: [{ id: 'clinic-1', publicClinicId: 'OMC-12345678', name: 'Clinic', address: null, isActive: true }], membershipStates: [{ id: 'membership-1', clinicId: 'clinic-1', isActive: true, status: 'active', clinic: { id: 'clinic-1', publicClinicId: 'OMC-12345678', name: 'Clinic', isActive: true } }] } });
    renderApp('/doctor');
    expect(await screen.findByText('Doctor care')).toBeInTheDocument();
    expect(screen.queryByText('Complete your health profile')).not.toBeInTheDocument();
  });

  it('Skip For Now enters the Patient App and does not immediately re-show onboarding in the same session', async () => {
    setAuthenticated(); mocks.api.getPatient.mockResolvedValue({ patient: incompletePatient });
    const user = userEvent.setup(); renderApp('/app');
    await user.click(await screen.findByRole('button', { name: /skip for now/i }));
    expect(await screen.findByText('Good morning, Asha.')).toBeInTheDocument();
    cleanup();
    renderApp('/app');
    await waitFor(() => expect(screen.queryByText('Complete your health profile')).not.toBeInTheDocument());
    expect(await screen.findByText('Good morning, Asha.')).toBeInTheDocument();
  });

  it('Save and Continue submits the health profile and then enters the Patient App using the authoritative response', async () => {
    setAuthenticated(); mocks.api.getPatient.mockResolvedValue({ patient: incompletePatient });
    mocks.api.updatePatient.mockResolvedValue({ patient: { ...patient, healthProfileComplete: true } });
    const user = userEvent.setup(); renderApp('/app');
    await screen.findByText('Complete your health profile');
    await user.type(screen.getByLabelText('Height (cm)'), '170');
    await user.type(screen.getByLabelText('Weight (kg)'), '65');
    await user.selectOptions(screen.getByLabelText('Sex'), 'male');
    await user.click(screen.getByRole('button', { name: /save and continue/i }));
    await waitFor(() => expect(mocks.api.updatePatient).toHaveBeenCalledWith(expect.objectContaining({ heightCm: 170, weightKg: 65, sex: 'male' })));
    expect(await screen.findByText('Good morning, Asha.')).toBeInTheDocument();
  });
});

describe('My Profile health section', () => {
  it('displays health profile fields and BMI, and keeps the Health ID read-only', async () => {
    setAuthenticated(); renderApp('/app/profile');
    expect(await screen.findByText('H-PERMANENT')).toBeInTheDocument();
    expect(screen.getByLabelText('Height (cm)')).toHaveValue(170);
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(65);
    expect(screen.getByLabelText('Sex')).toHaveValue('male');
    expect(screen.getByText('22.5')).toBeInTheDocument();
    expect(screen.queryByLabelText(/health id/i)).not.toBeInTheDocument();
  });

  it('saves profile edits and immediately displays the recalculated BMI from the backend response', async () => {
    setAuthenticated();
    mocks.api.updatePatient.mockResolvedValue({ patient: { ...patient, heightCm: 170, weightKg: 80, bmi: 27.7 } });
    const user = userEvent.setup(); renderApp('/app/profile');
    const weightInput = await screen.findByLabelText('Weight (kg)');
    await user.clear(weightInput); await user.type(weightInput, '80');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mocks.api.updatePatient).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 80 })));
    expect(await screen.findByText('27.7')).toBeInTheDocument();
  });
});

describe('Patient Overview health snapshot', () => {
  it('shows the backend-returned BMI, height, and weight without recalculating BMI on the frontend', async () => {
    setAuthenticated();
    // Deliberately mismatched: if the frontend ever recomputed BMI from height/weight
    // (65 / 1.70^2 = 22.5) instead of trusting the backend value, this would fail.
    mocks.api.getPatient.mockResolvedValue({ patient: { ...patient, heightCm: 170, weightKg: 65, bmi: 40.1 } });
    renderApp('/app');
    expect(await screen.findByText('Health snapshot')).toBeInTheDocument();
    expect(screen.getByText('40.1')).toBeInTheDocument();
    expect(screen.getByText('170 cm')).toBeInTheDocument();
    expect(screen.getByText('65 kg')).toBeInTheDocument();
  });

  it('shows "Not available" for a null BMI and "Not added" for missing height/weight, never NaN/undefined/0', async () => {
    setAuthenticated();
    mocks.api.getPatient.mockResolvedValue({ patient: { ...patient, heightCm: null, weightKg: null, bmi: null } });
    renderApp('/app');
    expect(await screen.findByText('Health snapshot')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getAllByText('Not added')).toHaveLength(2);
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('"Update health details" navigates to the existing My Profile page', async () => {
    setAuthenticated(); const user = userEvent.setup(); renderApp('/app');
    await screen.findByText('Health snapshot');
    await user.click(screen.getByRole('link', { name: /update health details/i }));
    expect(await screen.findByText('Profile & Health ID')).toBeInTheDocument();
  });
});
