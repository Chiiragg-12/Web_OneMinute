import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorLayout } from '../components/DoctorLayout';
import { DoctorQueuePage } from '../pages/DoctorPages';

const mocks = vi.hoisted(() => ({
  api: { getDoctorQueue: vi.fn(), getDoctorNowServing: vi.fn(), getDoctorCurrentPatient: vi.fn(), startNextConsultation: vi.fn(), endCurrentConsultation: vi.fn() },
  useAuth: vi.fn(),
  streamDoctorQueue: vi.fn(),
}));

vi.mock('../api/client', () => ({ api: mocks.api, streamDoctorQueue: mocks.streamDoctorQueue }));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));

const doctor = { id: 'doctor-1', fullName: 'Dr. Demo', specialization: 'General medicine', clinics: [{ id: 'clinic-1', name: 'Demo Clinic', isActive: true }] };
const waitingOne = { appointmentId: 'appointment-1', patient: { id: 'patient-1', name: 'Patient One' }, token: { number: 1, label: 'T-1', status: 'waiting' } };
const waitingTwo = { appointmentId: 'appointment-2', patient: { id: 'patient-2', name: 'Patient Two' }, token: { number: 2, label: 'T-2', status: 'waiting' } };
const servingOne = { appointmentId: 'appointment-0', patient: { id: 'patient-0', name: 'Patient Zero' }, token: { number: 0, label: 'T-0', status: 'serving' } };

function renderQueue() {
  return render(<MemoryRouter initialEntries={['/doctor/queue']}><Routes><Route path="/doctor" element={<DoctorLayout />}><Route path="queue" element={<DoctorQueuePage />} /></Route></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.useAuth.mockReturnValue({ state: { status: 'authenticated', user: { id: 'user-1', role: 'doctor' }, patient: null, doctor }, logout: vi.fn() });
  mocks.api.getDoctorQueue.mockResolvedValue({ waiting: [waitingOne] });
  mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: servingOne });
  mocks.api.getDoctorCurrentPatient.mockResolvedValue({ appointment: null });
  mocks.api.startNextConsultation.mockResolvedValue({ token: { id: 'token-1', number: 1, label: 'T-1', status: 'serving' } });
  mocks.api.endCurrentConsultation.mockResolvedValue({ appointment: { id: 'appointment-0', status: 'completed' } });
  mocks.streamDoctorQueue.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Doctor queue realtime recovery', () => {
  it('loads authoritative waiting/current state and establishes one SSE stream', async () => {
    renderQueue();
    expect(await screen.findByText('Patient One')).toBeInTheDocument();
    expect(screen.getByText('T-0')).toBeInTheDocument();
    expect(mocks.api.getDoctorQueue).toHaveBeenCalledWith('clinic-1', 'doctor-1', 'in_person');
    expect(mocks.api.getDoctorNowServing).toHaveBeenCalledWith('clinic-1', 'doctor-1', 'in_person');
    expect(mocks.streamDoctorQueue).toHaveBeenCalledOnce();
    expect(mocks.streamDoctorQueue).toHaveBeenCalledWith('clinic-1', 'doctor-1', 'in_person', expect.any(AbortSignal), expect.any(Function));
    await Promise.resolve();
  });

  it('refetches authoritative queue state when an SSE event arrives', async () => {
    let onEvent: (() => void) | undefined;
    mocks.streamDoctorQueue.mockImplementation((_clinic: string, _doctor: string, _mode: string, _signal: AbortSignal, eventHandler: () => void) => { onEvent = eventHandler; return new Promise(() => undefined); });
    renderQueue();
    await screen.findByText('Patient One');
    mocks.api.getDoctorQueue.mockResolvedValue({ waiting: [waitingTwo] });
    mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: null });
    onEvent?.();
    await waitFor(() => expect(screen.getByText('Patient Two')).toBeInTheDocument());
    expect(screen.queryByText('Patient One')).not.toBeInTheDocument();
    expect(screen.queryByText('T-0')).not.toBeInTheDocument();
  });

  it('keeps valid queue state and polls during SSE failure, then reconnects once', async () => {
    vi.useFakeTimers();
    let streamCalls = 0;
    mocks.streamDoctorQueue.mockImplementation(() => { streamCalls += 1; return streamCalls <= 2 ? new Promise((_, reject) => window.setTimeout(() => reject(new Error('disconnected')), 0)) : new Promise(() => undefined); });
    renderQueue();
    await vi.waitFor(() => expect(screen.getByText('Patient One')).toBeInTheDocument());
    await vi.waitFor(() => expect(mocks.streamDoctorQueue).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mocks.streamDoctorQueue).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(0);
    const requestsBeforePolling = mocks.api.getDoctorQueue.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mocks.api.getDoctorQueue.mock.calls.length).toBeGreaterThan(requestsBeforePolling);
    expect(screen.getByText('Patient One')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mocks.streamDoctorQueue).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.streamDoctorQueue).toHaveBeenCalledTimes(3);
  });

  it('cleans the stream abort and recovery timers on unmount', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    mocks.streamDoctorQueue.mockImplementation((_clinic: string, _doctor: string, _mode: string, signal: AbortSignal) => { capturedSignal = signal; return Promise.reject(new Error('disconnected')); });
    const view = renderQueue();
    await vi.waitFor(() => expect(mocks.streamDoctorQueue).toHaveBeenCalledOnce());
    view.unmount();
    expect(capturedSignal?.aborted).toBe(true);
    const requestCount = mocks.api.getDoctorQueue.mock.calls.length;
    vi.advanceTimersByTime(30_000);
    expect(mocks.api.getDoctorQueue.mock.calls.length).toBe(requestCount);
    expect(mocks.streamDoctorQueue).toHaveBeenCalledOnce();
  });

  it('prevents duplicate Start Next and End Current mutations while pending', async () => {
    let resolveStart: (value: unknown) => void = () => undefined;
    mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: null });
    mocks.api.startNextConsultation.mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
    renderQueue();
    const user = userEvent.setup();
    const start = await screen.findByRole('button', { name: /start next consultation/i });
    await user.click(start);
    await user.click(start);
    await waitFor(() => expect(mocks.api.startNextConsultation).toHaveBeenCalledOnce());
    resolveStart({ token: { id: 'token-1', number: 1, label: 'T-1', status: 'serving' } });
    await waitFor(() => expect(start).not.toBeDisabled());

    let resolveEnd: (value: unknown) => void = () => undefined;
    mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: servingOne });
    mocks.api.endCurrentConsultation.mockReturnValue(new Promise((resolve) => { resolveEnd = resolve; }));
    cleanup(); renderQueue();
    const end = await screen.findByRole('button', { name: /end consultation/i });
    await user.click(end);
    await user.click(end);
    expect(mocks.api.endCurrentConsultation).toHaveBeenCalledOnce();
    resolveEnd({ appointment: { id: 'appointment-0', status: 'completed' } });
  });

  it('shows "No active consultation" for Current Patient when there is no authoritative serving appointment', async () => {
    mocks.api.getDoctorCurrentPatient.mockResolvedValue({ appointment: null });
    renderQueue();
    expect(await screen.findByText('No active consultation')).toBeInTheDocument();
  });

  it('shows Current Patient details, including reason/intake and Health ID, once a serving consultation is authoritative', async () => {
    mocks.api.getDoctorCurrentPatient.mockResolvedValue({ appointment: {
      id: 'appointment-9', patient: { id: 'patient-9', healthId: 'OM-CURRENT-9', name: 'Ishaan Rao', dob: '1988-04-05', gender: null, heightCm: 179, weightKg: 70, sex: 'male', bmi: 99.9 },
      scheduledStartAt: '2026-09-17T10:00:00.000Z', status: 'in_consultation', consultationMode: 'in_person', durationMinutes: 60,
      consultationReason: 'Recurring headaches', consultationStartedAt: null, estimatedDurationMinutes: null,
      payment: null, token: { label: 'T-9', status: 'serving' },
    } });
    renderQueue();
    expect(await screen.findByText('In consultation')).toBeInTheDocument();
    expect(screen.getAllByText('Ishaan Rao')).toHaveLength(2);
    expect(screen.getByText('OM-CURRENT-9')).toBeInTheDocument();
    expect(screen.getByText('Recurring headaches')).toBeInTheDocument();
    expect(screen.getByText('appointment-9')).toBeInTheDocument();
    expect(screen.getByText('179 cm')).toBeInTheDocument();
    expect(screen.getByText('70 kg')).toBeInTheDocument();
    expect(screen.getByText('99.9')).toBeInTheDocument();
    expect(screen.getByText('5 Apr 1988')).toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
  });

  it('clears Current Patient after End Consultation completes', async () => {
    mocks.api.getDoctorCurrentPatient.mockResolvedValueOnce({ appointment: {
      id: 'appointment-0', patient: { id: 'patient-0', healthId: 'OM-CURRENT-0', name: 'Patient Zero', dob: null, gender: null },
      scheduledStartAt: '2026-09-17T10:00:00.000Z', status: 'in_consultation', consultationMode: 'in_person', durationMinutes: 60,
      consultationReason: 'Follow-up', consultationStartedAt: null, estimatedDurationMinutes: null,
      payment: null, token: { label: 'T-0', status: 'serving' },
    } });
    mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: servingOne });
    const user = userEvent.setup();
    renderQueue();
    expect(await screen.findByText('OM-CURRENT-0')).toBeInTheDocument();
    mocks.api.getDoctorCurrentPatient.mockResolvedValue({ appointment: null });
    mocks.api.getDoctorNowServing.mockResolvedValue({ nowServing: null });
    mocks.api.endCurrentConsultation.mockResolvedValue({ appointment: { id: 'appointment-0', status: 'completed' } });
    await user.click(screen.getByRole('button', { name: /end consultation/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'No active consultation' })).toBeInTheDocument());
    expect(screen.queryByText('OM-CURRENT-0')).not.toBeInTheDocument();
  });
});
