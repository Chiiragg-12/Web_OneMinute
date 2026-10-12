import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceptionistLayout } from '../components/ReceptionistLayout';
import { ReceptionistOverviewPage, ReceptionistWalkInPage } from '../pages/ReceptionistPages';
import { ReceptionistQueuePage } from '../pages/ReceptionistQueueExtras';

const mocks = vi.hoisted(() => ({ api: { getReceptionistDashboard: vi.fn(), lookupReceptionistPatient: vi.fn(), createWalkIn: vi.fn(), getDoctorQueue: vi.fn(), getDoctorNowServing: vi.fn(), startNextConsultation: vi.fn(), endCurrentConsultation: vi.fn() }, useAuth: vi.fn(), streamDoctorQueue: vi.fn() }));
vi.mock('../api/client', () => ({ api: mocks.api, streamDoctorQueue: mocks.streamDoctorQueue }));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

const receptionist = { id: 'r1', fullName: 'Reception A', clinic: { id: 'clinic-1', name: 'Demo Clinic', isActive: true } };
const dashboard = { clinic: { id: 'clinic-1', name: 'Demo Clinic', timezone: 'Asia/Kolkata' }, doctors: [{ doctor: { id: 'doctor-1', fullName: 'Dr. Demo' }, status: 'available', waitingByMode: { in_person: 1 }, servingByMode: [] }], counts: { queued: 1, completed: 2 }, appointmentCounts: { total: 4, in_person: 1, video: 1, audio: 1, chat: 1 }, appointments: [{ consultationMode: 'in_person' }, { consultationMode: 'video' }, { consultationMode: 'audio' }, { consultationMode: 'chat' }] };
const patient = { id: 'patient-1', healthId: 'OM-TEST', name: 'Arjun Sharma', email: null, phone: '919800000000' };

function renderReceptionist(path = '/receptionist') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/receptionist" element={<ReceptionistLayout />}><Route index element={<ReceptionistOverviewPage />} /><Route path="walk-in" element={<ReceptionistWalkInPage />} /><Route path="queue" element={<ReceptionistQueuePage />} /></Route></Routes></MemoryRouter>); }

beforeEach(() => { vi.clearAllMocks(); mocks.streamDoctorQueue.mockReturnValue(new Promise(() => undefined)); mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'u1', role: 'receptionist' }, patient: null, doctor: null, receptionist }, logout: vi.fn() }); mocks.api.getReceptionistDashboard.mockResolvedValue({ dashboard }); mocks.api.lookupReceptionistPatient.mockResolvedValue({ patient }); mocks.api.createWalkIn.mockResolvedValue({ appointment: { id: 'a1', patient, doctor: { id: 'doctor-1', name: 'Dr. Demo' }, status: 'queued', consultationMode: 'in_person', token: { label: 'T-4', status: 'waiting' }, payment: { status: 'pay_at_reception', method: 'pay_at_reception', amountCents: 1500 } } }); mocks.api.getDoctorQueue.mockResolvedValue({ waiting: [] }); mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: null }); });

describe('Receptionist frontend', () => {
  it('renders assigned-clinic overview', async () => { renderReceptionist(); expect(await screen.findByText('Clinic day at a glance')).toBeInTheDocument(); expect(screen.getByText('Demo Clinic')).toBeInTheDocument(); });
  it('shows separate canonical today totals for the assigned clinic', async () => { renderReceptionist(); const total = await screen.findByText("Today's total appointments"); expect(total.parentElement).toHaveTextContent('4'); for (const mode of ['In Person', 'Video', 'Audio', 'Chat']) expect(screen.getByText(`Today's ${mode} appointments`)).toBeInTheDocument(); });
  it('performs exact patient lookup and sends protected walk-in fields only', async () => { renderReceptionist('/receptionist/walk-in'); const user = userEvent.setup(); await user.type(await screen.findByLabelText('Exact identifier'), 'OM-TEST'); await user.click(screen.getByRole('button', { name: /find patient/i })); expect(await screen.findByText('Arjun Sharma')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: /continue with this patient/i })); await user.selectOptions(screen.getByLabelText('Doctor'), 'doctor-1'); await user.type(screen.getByLabelText('Reason for visit'), 'Walk-in check'); await user.click(screen.getByRole('button', { name: /create walk-in/i })); await waitFor(() => expect(mocks.api.createWalkIn).toHaveBeenCalledWith({ requestId: expect.any(String), doctorId: 'doctor-1', patientHealthId: 'OM-TEST', paymentMethod: 'pay_at_reception', consultationReason: 'Walk-in check' })); expect(await screen.findByText('T-4')).toBeInTheDocument(); expect(screen.getByText('OM-TEST')).toBeInTheDocument(); });

  it('registers a permanent patient as part of the walk-in request after lookup misses', async () => {
    mocks.api.lookupReceptionistPatient.mockRejectedValueOnce(Object.assign(new Error('Patient not found'), { status: 404 }));
    renderReceptionist('/receptionist/walk-in');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Phone number' }));
    await user.type(screen.getByLabelText('Exact identifier'), '9876543210');
    await user.click(screen.getByRole('button', { name: /find patient/i }));
    expect(await screen.findByText('Permanent patient profile')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Full name'), 'New Walk-In');
    await user.type(screen.getByLabelText('Create password'), 'patient-password');
    await user.type(screen.getByLabelText('Confirm password'), 'patient-password');
    await user.click(screen.getByRole('button', { name: /continue with new patient/i }));
    await user.selectOptions(screen.getByLabelText('Doctor'), 'doctor-1');
    await user.type(screen.getByLabelText('Reason for visit'), 'First visit');
    await user.click(screen.getByRole('button', { name: /create walk-in/i }));
    await waitFor(() => expect(mocks.api.createWalkIn).toHaveBeenCalledWith(expect.objectContaining({ requestId: expect.any(String), doctorId: 'doctor-1', consultationReason: 'First visit', newPatient: expect.objectContaining({ fullName: 'New Walk-In', phone: '9876543210', password: 'patient-password' }) })));
  });
  it('loads queue and calls official start-next', async () => { renderReceptionist('/receptionist/queue'); expect(await screen.findByText('Queue control')).toBeInTheDocument(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: /start next/i })); await waitFor(() => expect(mocks.api.startNextConsultation).toHaveBeenCalledWith('clinic-1', 'doctor-1', 'in_person')); });

  it('keeps all four consultation mode controls rendered and wrap-capable instead of relying on a fixed desktop layout', async () => {
    renderReceptionist('/receptionist/queue');
    expect(await screen.findByText('Queue control')).toBeInTheDocument();
    for (const label of ['In Person', 'Video', 'Audio', 'Chat']) {
      expect(screen.getByRole('button', { name: label })).toBeVisible();
    }
    const modeContainer = screen.getByRole('button', { name: 'Audio' }).parentElement;
    expect(modeContainer?.className).toContain('flex-wrap');
    expect(modeContainer?.className).not.toMatch(/\bgrid-cols-\d/);
  });

  it('keeps the content wrapper eligible for the shell.py-7 bottom-nav clearance padding so the fixed mobile/tablet nav never covers the page', async () => {
    renderReceptionist('/receptionist/queue');
    await screen.findByText('Queue control');
    const contentWrapper = document.querySelector('main')?.parentElement;
    expect(contentWrapper?.className).toContain('shell');
    expect(contentWrapper?.className).toContain('py-7');
  });

  it('shows the server-computed position and estimated wait for each waiting patient, using the same ETA the patient tracker relies on', async () => {
    mocks.api.getDoctorQueue.mockResolvedValue({ waiting: [
      { appointmentId: 'a1', patient: { id: 'p1', name: 'Rahul' }, source: 'booked', token: { number: 11, label: 'T-11', status: 'waiting' }, position: 1, estimatedWaitMinutes: 8 },
      { appointmentId: 'a2', patient: { id: 'p2', name: 'Priya' }, source: 'walk_in', token: { number: 12, label: 'T-12', status: 'waiting' }, position: 2, estimatedWaitMinutes: 18 },
      { appointmentId: 'a3', patient: { id: 'p3', name: 'Arjun' }, source: 'booked', token: { number: 13, label: 'T-13', status: 'waiting' }, position: 3, estimatedWaitMinutes: null },
    ] });
    renderReceptionist('/receptionist/queue');
    expect(await screen.findByText('Rahul')).toBeInTheDocument();
    expect(screen.getByText('Scheduled · Position 1 · ~8 min')).toBeInTheDocument();
    expect(screen.getByText('Walk-In · Position 2 · ~18 min')).toBeInTheDocument();
    expect(screen.getByText('Scheduled · Position 3 · Estimated wait unavailable')).toBeInTheDocument();
  });
});
