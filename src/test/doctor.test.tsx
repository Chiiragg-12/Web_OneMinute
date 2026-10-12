import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorLayout } from '../components/DoctorLayout';
import { DoctorAppointmentDetailPage, DoctorAppointmentsPage, DoctorOverviewPage, DoctorPricingPage, DoctorProfilePage, DoctorQueuePage } from '../pages/DoctorPages';
import { DoctorOnboardingPage } from '../pages/DoctorOnboardingPage';
import { DoctorClinicLinking } from '../pages/DoctorClinicLinking';

const mocks = vi.hoisted(() => ({
  api: { getDoctorDashboard: vi.fn(), listDoctorAppointments: vi.fn(), getDoctorAppointment: vi.fn(), getClinic: vi.fn(), getDoctorQueue: vi.fn(), getDoctorNowServing: vi.fn(), getDoctorCurrentPatient: vi.fn(), startNextConsultation: vi.fn(), endCurrentConsultation: vi.fn(), getDoctorPricing: vi.fn(), updateDoctorPricing: vi.fn(), startDoctorBreak: vi.fn(), endDoctorBreak: vi.fn(), updateDoctorProfile: vi.fn(), updateDoctorConsultationModes: vi.fn(), getDoctorProfile: vi.fn(), resolveDoctorClinic: vi.fn(), linkDoctorClinic: vi.fn() },
  useAuth: vi.fn(),
  streamDoctorQueue: vi.fn(),
}));

vi.mock('../api/client', () => ({ api: mocks.api, streamDoctorQueue: mocks.streamDoctorQueue, ApiError: class ApiError extends Error { status = 400; } }));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

const doctor = { id: 'doctor-1', fullName: 'Dr. Demo', specialization: 'General medicine', clinics: [{ id: 'clinic-1', name: 'OneMinute Demo Clinic', isActive: true }, { id: 'clinic-2', name: 'Second Clinic', isActive: true }] };
const dashboard = { doctor: { id: doctor.id, fullName: doctor.fullName, specialization: doctor.specialization }, clinic: { id: 'clinic-1', name: 'OneMinute Demo Clinic', timezone: 'Asia/Kolkata' }, status: 'available', activeBreak: null, counts: { completed: 1 }, waitingByMode: { in_person: 1, video: 0, audio: 0, chat: 0 }, servingByMode: [], appointments: [] };
const appointment = { id: 'appointment-1', patient: { id: 'patient-1', healthId: 'OM-TEST', name: 'Chirag Mahour', dob: null, gender: null }, scheduledStartAt: '2026-09-17T12:00:00.000Z', status: 'queued', consultationMode: 'in_person', durationMinutes: 60, consultationReason: 'General check', payment: null, token: { label: 'T-1', status: 'waiting' } };
const modeAppointments = [
  appointment,
  { ...appointment, id: 'appointment-video', patient: { ...appointment.patient, name: 'Video Patient' }, consultationMode: 'video' },
  { ...appointment, id: 'appointment-audio', patient: { ...appointment.patient, name: 'Audio Patient' }, consultationMode: 'audio' },
  { ...appointment, id: 'appointment-chat', patient: { ...appointment.patient, name: 'Chat Patient' }, consultationMode: 'chat' },
];

function renderDoctor(path = '/doctor') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/doctor" element={<DoctorLayout />}><Route index element={<DoctorOverviewPage />} /><Route path="appointments" element={<DoctorAppointmentsPage />} /><Route path="appointments/:clinicId/:appointmentId" element={<DoctorAppointmentDetailPage />} /><Route path="queue" element={<DoctorQueuePage />} /><Route path="pricing" element={<DoctorPricingPage />} /><Route path="profile" element={<DoctorProfilePage />} /></Route></Routes></MemoryRouter>); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'user-1', role: 'doctor', email: null, phone: null }, patient: null, doctor }, logout: vi.fn() });
  mocks.api.getDoctorDashboard.mockResolvedValue({ dashboard });
  mocks.api.listDoctorAppointments.mockResolvedValue({ appointments: [appointment] });
  mocks.api.getDoctorAppointment.mockResolvedValue({ appointment });
  mocks.api.getClinic.mockResolvedValue({ clinic: { id: 'clinic-1', name: 'OneMinute Demo Clinic', timezone: 'Asia/Kolkata' } });
  mocks.api.getDoctorQueue.mockResolvedValue({ waiting: [{ appointmentId: appointment.id, patient: { id: 'patient-1', name: 'Chirag Mahour' }, token: { number: 1, label: 'T-1', status: 'waiting' } }] });
  mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: null });
  mocks.api.getDoctorCurrentPatient.mockResolvedValue({ appointment: null });
  mocks.api.getDoctorPricing.mockResolvedValue({ pricing: [{ id: 'price-1', consultationMode: 'in_person', durationMinutes: 60, priceCents: 1500 }] });
  mocks.api.updateDoctorPricing.mockResolvedValue({ pricing: { id: 'price-1', consultationMode: 'in_person', durationMinutes: 60, priceCents: 1800 } });
  mocks.api.startNextConsultation.mockResolvedValue({ token: { id: 'token-1', number: 1, label: 'T-1', status: 'serving' } });
  mocks.api.endCurrentConsultation.mockResolvedValue({ appointment: { ...appointment, status: 'completed', token: { label: 'T-1', status: 'completed' } } });
  mocks.api.startDoctorBreak.mockResolvedValue({ break: { startedAt: new Date().toISOString(), expectedEndAt: null } });
  mocks.api.endDoctorBreak.mockResolvedValue({ break: { endedAt: new Date().toISOString() } });
  mocks.streamDoctorQueue.mockReturnValue(new Promise(() => undefined));
});

describe('Doctor frontend workflow', () => {
  it('logs out only the incomplete Doctor session and redirects to Doctor Login', async () => {
    const logout = vi.fn();
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'doctor-user', role: 'doctor', email: null, phone: null }, patient: null, doctor: { ...doctor, professionalProfileComplete: false }, receptionist: null }, logout });
    render(<MemoryRouter initialEntries={['/doctor']}><Routes><Route path="/doctor" element={<DoctorLayout />} /><Route path="/doctor/login" element={<div>Doctor Login</div>} /></Routes></MemoryRouter>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledWith('doctor');
    await waitFor(() => expect(screen.getByText('Doctor Login')).toBeInTheDocument());
  });

  it('routes a complete independent Doctor to clinic registration without requesting a clinic dashboard', async () => {
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'doctor-user', role: 'doctor', email: null, phone: null }, patient: null, doctor: { ...doctor, professionalProfileComplete: true, clinics: [] }, receptionist: null }, logout: vi.fn(), updateDoctor: vi.fn() });
    renderDoctor('/doctor/profile');
    expect(await screen.findByText('Register for a Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Set up your professional profile')).not.toBeInTheDocument();
    expect(mocks.api.getDoctorDashboard).not.toHaveBeenCalled();
  });

  it('keeps onboarding decisions in a centered vertical stack', () => {
    render(<DoctorOnboardingPage />);
    const myself = screen.getByRole('button', { name: /Register for Myself/ });
    expect(myself.parentElement?.className).toContain('space-y-4');
    expect(myself.className).toContain('w-full');
    expect(screen.getByRole('button', { name: /Register for a Clinic/ })).toBeInTheDocument();
  });

  it('auto-continues the instant Clinic Linking detects an ACTIVE membership, with no manual click required', async () => {
    mocks.api.resolveDoctorClinic.mockResolvedValue({ clinic: { id: 'clinic-1', publicClinicId: 'OMC-12345678', name: 'NovaCare Family Clinic', isActive: true }, membership: { id: 'm1', isActive: true, status: 'active' } });
    const onContinue = vi.fn();
    render(<DoctorClinicLinking onContinue={onContinue} />);
    await userEvent.setup().type(screen.getByLabelText('Clinic ID'), 'OMC-12345678');
    await userEvent.setup().click(screen.getByRole('button', { name: /Find clinic/ }));
    await screen.findByText("You're already linked to this clinic.");
    await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  });

  it('never claims onboarding is complete when Skip for Now does not exist as a fake-completion shortcut', () => {
    render(<DoctorOnboardingPage />);
    expect(screen.queryByRole('button', { name: /Skip for Now/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Your profile is ready')).not.toBeInTheDocument();
  });

  it('shows onboarding success only after the backend confirms a permanent Doctor ID', async () => {
    mocks.api.updateDoctorProfile.mockResolvedValue({ doctor: { ...doctor, publicDoctorId: 'OMD-ABCD1234', professionalProfileComplete: true } });
    mocks.api.updateDoctorConsultationModes.mockResolvedValue({ pricing: [] });
    mocks.api.getDoctorProfile.mockResolvedValue({ doctor: { ...doctor, publicDoctorId: 'OMD-ABCD1234', professionalProfileComplete: true } });
    render(<DoctorOnboardingPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Register for Myself/ }));
    const successUser = userEvent.setup();
    await successUser.type(screen.getByLabelText('Full legal/professional name'), 'Dr. Ready');
    await successUser.type(screen.getByLabelText('Primary specialization'), 'General medicine');
    await successUser.type(screen.getByLabelText('Medical qualification'), 'MBBS');
    await successUser.type(screen.getByLabelText('Registration number'), 'REG-1');
    await successUser.type(screen.getByLabelText('Registration council/authority'), 'Council');
    await successUser.type(screen.getByLabelText('Fee (INR)'), '500');
    await userEvent.setup().click(screen.getByRole('button', { name: /Complete Profile/ }));
    expect(await screen.findByText('Your profile is ready')).toBeInTheDocument();
    expect(mocks.api.getDoctorProfile).toHaveBeenCalledOnce();
  });

  it('never leaves a completed Doctor stuck on the success screen with only Logout — a Continue button hands back the fresh backend profile', async () => {
    const confirmedDoctor = { ...doctor, publicDoctorId: 'OMD-ABCD1234', professionalProfileComplete: true, clinics: [] };
    mocks.api.updateDoctorProfile.mockResolvedValue({ doctor: confirmedDoctor });
    mocks.api.updateDoctorConsultationModes.mockResolvedValue({ pricing: [] });
    mocks.api.getDoctorProfile.mockResolvedValue({ doctor: confirmedDoctor });
    const onCompleted = vi.fn();
    render(<DoctorOnboardingPage onCompleted={onCompleted} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Register for Myself/ }));
    const successUser = userEvent.setup();
    await successUser.type(screen.getByLabelText('Full legal/professional name'), 'Dr. Ready');
    await successUser.type(screen.getByLabelText('Primary specialization'), 'General medicine');
    await successUser.type(screen.getByLabelText('Medical qualification'), 'MBBS');
    await successUser.type(screen.getByLabelText('Registration number'), 'REG-1');
    await successUser.type(screen.getByLabelText('Registration council/authority'), 'Council');
    await successUser.type(screen.getByLabelText('Fee (INR)'), '500');
    await userEvent.setup().click(screen.getByRole('button', { name: /Complete Profile/ }));
    const continueButton = await screen.findByRole('button', { name: /Continue/ });
    await userEvent.setup().click(continueButton);
    expect(onCompleted).toHaveBeenCalledWith(confirmedDoctor);
  });

  it('keeps the onboarding form visible when profile save fails', async () => {
    mocks.api.updateDoctorProfile.mockRejectedValue(new Error('Profile save failed'));
    render(<DoctorOnboardingPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Register for Myself/ }));
    const failureUser = userEvent.setup();
    await failureUser.type(screen.getByLabelText('Full legal/professional name'), 'Dr. Failed');
    await failureUser.type(screen.getByLabelText('Primary specialization'), 'General medicine');
    await failureUser.type(screen.getByLabelText('Medical qualification'), 'MBBS');
    await failureUser.type(screen.getByLabelText('Registration number'), 'REG-2');
    await failureUser.type(screen.getByLabelText('Registration council/authority'), 'Council');
    await failureUser.type(screen.getByLabelText('Fee (INR)'), '500');
    await userEvent.setup().click(screen.getByRole('button', { name: /Complete Profile/ }));
    expect(await screen.findByText('Profile save failed')).toBeInTheDocument();
    expect(screen.queryByText('Your profile is ready')).not.toBeInTheDocument();
  });
  it('does not render Doctor UI for a patient session and exposes logout', async () => {
    const logout = vi.fn(); mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'patient-1', role: 'patient', email: null, phone: null }, patient: { healthId: 'H-1', fullName: 'Patient', email: null, phone: null, dob: null, gender: null }, doctor: null }, logout });
    renderDoctor(); expect(screen.queryByText('Doctor overview')).not.toBeInTheDocument();
    mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'user-1', role: 'doctor', email: null, phone: null }, patient: null, doctor }, logout });
    renderDoctor(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'More options' })); await user.click(await screen.findByRole('menuitem', { name: 'Sign out' })); expect(logout).toHaveBeenCalledOnce();
  });

  it('loads the dashboard and supports clinic context selection', async () => {
    renderDoctor(); expect(await screen.findByText('Good morning, Demo.')).toBeInTheDocument(); expect(screen.getByLabelText('Select clinic')).toHaveValue('clinic-1');
    await userEvent.setup().selectOptions(screen.getByLabelText('Select clinic'), 'clinic-2'); await waitFor(() => expect(mocks.api.getDoctorDashboard).toHaveBeenCalledWith('clinic-2')); cleanup();
  });

  it('loads permitted appointments and appointment detail', async () => {
    renderDoctor('/doctor/appointments'); expect(await screen.findByText('Chirag Mahour')).toBeInTheDocument(); expect(screen.getByText('General check')).toBeInTheDocument(); cleanup();
    renderDoctor('/doctor/appointments/clinic-1/appointment-1'); expect(await screen.findByText('OM-TEST')).toBeInTheDocument(); expect(screen.getByText('Scheduled Date & Time')).toBeInTheDocument(); expect(screen.getByText('17 Sept 2026, 5:30 pm')).toBeInTheDocument();
  });

  it('shows canonical today mode totals and keeps appointment mode filters strict after refresh', async () => {
    mocks.api.getDoctorDashboard.mockResolvedValue({ dashboard: { ...dashboard, appointments: modeAppointments, appointmentCounts: { total: 4, in_person: 1, video: 1, audio: 1, chat: 1 } } });
    mocks.api.listDoctorAppointments.mockResolvedValue({ appointments: modeAppointments });
    renderDoctor();
    expect(await screen.findByText("Today's total appointments")).toBeInTheDocument();
    expect(screen.getByText("Today's total appointments").parentElement).toHaveTextContent('4');
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(4);
    cleanup();
    renderDoctor('/doctor/appointments?mode=video');
    expect(await screen.findByText('Video Patient')).toBeInTheDocument();
    expect(screen.queryByText('Audio Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Chirag Mahour')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Video' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders a separate queue and calls start-next', async () => {
    renderDoctor('/doctor/queue'); expect(await screen.findByText('T-1')).toBeInTheDocument(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: /start next consultation/i })); await waitFor(() => expect(mocks.api.startNextConsultation).toHaveBeenCalledWith('clinic-1', 'doctor-1', 'in_person'));
  });

  it('handles an active-consultation conflict without inventing a transition', async () => {
    mocks.api.startNextConsultation.mockRejectedValue(new Error('Doctor already has a serving consultation')); renderDoctor('/doctor/queue'); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: /start next consultation/i })); expect(await screen.findByText('Doctor already has a serving consultation')).toBeInTheDocument();
  });

  it('ends the current consultation through the backend', async () => {
    mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: { appointmentId: appointment.id, patient: { id: 'patient-1', name: 'Chirag Mahour' }, token: { number: 1, label: 'T-1', status: 'serving' } } }); renderDoctor('/doctor/queue'); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: /end consultation/i })); await waitFor(() => expect(mocks.api.endCurrentConsultation).toHaveBeenCalledWith('clinic-1', 'doctor-1', 'in_person', appointment.id));
  });

  it('loads and updates pricing', async () => {
    renderDoctor('/doctor/pricing'); expect(await screen.findByText('In Person')).toBeInTheDocument(); const input = screen.getByRole('spinbutton'); expect(input).toHaveValue(15); const user = userEvent.setup(); await user.clear(input); await user.type(input, '18'); await user.tab(); expect(mocks.api.updateDoctorPricing).not.toHaveBeenCalled(); await user.click(screen.getByRole('button', { name: 'Save Changes' })); await waitFor(() => expect(mocks.api.updateDoctorPricing).toHaveBeenCalledWith({ clinicId: 'clinic-1', consultationMode: 'in_person', durationMinutes: 60, priceCents: 1800 }));
  });

  it('starts and ends a backend-authoritative break', async () => {
    mocks.api.getDoctorDashboard.mockResolvedValueOnce({ dashboard }).mockResolvedValueOnce({ dashboard: { ...dashboard, activeBreak: { startedAt: new Date().toISOString(), expectedEndAt: null } } });
    renderDoctor('/doctor/profile'); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: /start break/i })); await waitFor(() => expect(mocks.api.startDoctorBreak).toHaveBeenCalledWith('clinic-1')); await user.click(await screen.findByRole('button', { name: /end break/i })); expect(mocks.api.endDoctorBreak).toHaveBeenCalledWith('clinic-1');
  });
});
