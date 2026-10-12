import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceptionistAppointmentsPage } from '../pages/ReceptionistPages';

const mocks = vi.hoisted(() => ({ api: { listReceptionistAppointments: vi.fn(), getReceptionistDashboard: vi.fn() } }));
vi.mock('../api/client', () => ({ api: mocks.api }));

const dashboard = { clinic: { id: 'clinic-1', name: 'Demo Clinic', timezone: 'Asia/Kolkata' }, doctors: [{ doctor: { id: 'doctor-1', fullName: 'Dr. Demo' }, status: 'available', waitingByMode: {}, servingByMode: [] }], counts: {}, appointments: [] };
const selfAppointment = { id: 'self-1', doctor: { id: 'doctor-1', name: 'Dr. Demo' }, patient: { id: 'p1', healthId: 'H-1', name: 'Arjun Sharma', heightCm: null, weightKg: null, dob: null, sex: null, bmi: null }, bookedBy: { id: 'p1', name: 'Arjun Sharma', healthId: 'H-1' }, relationship: null, scheduledStartAt: '2026-09-18T12:00:00.000Z', consultationMode: 'in_person', durationMinutes: 60, consultationReason: 'Self visit', status: 'booked', source: 'booked', payment: null, token: null };
const familyAppointment = { ...selfAppointment, id: 'family-1', patient: { ...selfAppointment.patient, id: 'member-1', name: 'Rajesh Sharma' }, bookedBy: { id: 'p1', name: 'Arjun Sharma', healthId: 'H-1' }, relationship: 'Father', consultationReason: 'Family visit' };
const modeAppointments = [
  selfAppointment,
  { ...selfAppointment, id: 'video-1', patient: { ...selfAppointment.patient, name: 'Video Patient' }, consultationMode: 'video' },
  { ...selfAppointment, id: 'audio-1', patient: { ...selfAppointment.patient, name: 'Audio Patient' }, consultationMode: 'audio' },
  { ...selfAppointment, id: 'chat-1', patient: { ...selfAppointment.patient, name: 'Chat Patient' }, consultationMode: 'chat' },
];
function renderPage() { return render(<MemoryRouter initialEntries={['/receptionist/appointments']}><Routes><Route path="/receptionist/appointments" element={<ReceptionistAppointmentsPage />} /></Routes></MemoryRouter>); }

beforeEach(() => { vi.clearAllMocks(); mocks.api.getReceptionistDashboard.mockResolvedValue({ dashboard }); mocks.api.listReceptionistAppointments.mockImplementation((_filter: string, _doctor: string | undefined, recipient: string) => Promise.resolve({ appointments: recipient === 'family' ? [familyAppointment] : [selfAppointment] })); });

describe('Receptionist appointment recipient sections', () => {
  it('shows self appointments by default and excludes family appointments', async () => { renderPage(); expect(await screen.findByText('Arjun Sharma')).toBeInTheDocument(); expect(screen.queryByText('Rajesh Sharma')).not.toBeInTheDocument(); expect(mocks.api.listReceptionistAppointments).toHaveBeenCalledWith('today', undefined, 'self'); });
  it('shows only family appointments with actual patient, booked-by, and relationship', async () => { renderPage(); const user = userEvent.setup(); await screen.findByText('Arjun Sharma'); await user.click(screen.getByRole('tab', { name: 'Family Member Appointments' })); expect(await screen.findByText('Rajesh Sharma')).toBeInTheDocument(); expect(screen.getByText(/Booked by: Arjun Sharma/)).toBeInTheDocument(); expect(screen.getByText(/Father/)).toBeInTheDocument(); expect(screen.queryByText('Self visit')).not.toBeInTheDocument(); expect(mocks.api.listReceptionistAppointments).toHaveBeenLastCalledWith('today', undefined, 'family'); });
  it('keeps receptionist mode tabs strict and preserves the URL-backed mode on refresh', async () => {
    mocks.api.listReceptionistAppointments.mockResolvedValue({ appointments: modeAppointments });
    render(<MemoryRouter initialEntries={['/receptionist/appointments?mode=audio']}><Routes><Route path="/receptionist/appointments" element={<ReceptionistAppointmentsPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Audio Patient')).toBeInTheDocument();
    expect(screen.queryByText('Video Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Arjun Sharma')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true');
  });
});
