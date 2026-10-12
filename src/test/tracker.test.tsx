import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentDetailPage } from '../pages/BookingPages';
import { TrackerPage } from '../pages/TrackerPage';

const mocks = vi.hoisted(() => ({
  api: { getAppointment: vi.fn(), getTracker: vi.fn(), getPayment: vi.fn(), getClinic: vi.fn(), sendLocationSignal: vi.fn() },
  streamTracker: vi.fn(),
}));

vi.mock('../api/client', () => ({
  api: mocks.api,
  streamTracker: mocks.streamTracker,
  ApiError: class MockApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } },
}));

const appointment = { id: 'appointment-1', clinic: { id: 'clinic-1', name: 'OneMinute Demo Clinic' }, doctor: { id: 'doctor-1', name: 'Dr. Demo' }, scheduledStartAt: '2030-01-02T04:30:00.000Z', consultationMode: 'in_person', durationMinutes: 60, status: 'booked', token: null, payment: null };
const tracker = { appointmentId: appointment.id, doctor: { id: 'doctor-1', name: 'Dr. Demo' }, clinic: { id: 'clinic-1', name: 'OneMinute Demo Clinic' }, consultationMode: 'in_person', ownToken: null, nowServing: null, patientsAhead: 0, estimatedWaitMinutes: 20, doctorStatus: 'available', appointmentStatus: 'booked' };

function renderTracker() { return render(<MemoryRouter initialEntries={[`/app/appointments/${appointment.id}/track`]}><Routes><Route path="/app/appointments/:appointmentId/track" element={<TrackerPage />} /></Routes></MemoryRouter>); }
function renderDetail() { return render(<MemoryRouter initialEntries={[`/app/appointments/${appointment.id}`]}><Routes><Route path="/app/appointments/:appointmentId" element={<AppointmentDetailPage />} /></Routes></MemoryRouter>); }

beforeEach(() => {
  vi.useRealTimers(); vi.clearAllMocks();
  mocks.api.getAppointment.mockResolvedValue({ appointment });
  mocks.api.getTracker.mockResolvedValue({ tracker });
  mocks.api.getPayment.mockResolvedValue({ payment: null });
  mocks.api.getClinic.mockResolvedValue({ clinic: { id: 'clinic-1', name: 'OneMinute Demo Clinic', address: null, timezone: 'Asia/Kolkata' } });
  mocks.api.sendLocationSignal.mockResolvedValue({ eligible: false, token: null });
  mocks.streamTracker.mockImplementation(() => new Promise(() => undefined));
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: vi.fn() } });
});
afterEach(() => { vi.useRealTimers(); });

describe('patient live tracker', () => {
  it('loads the authoritative appointment and tracker snapshot before live updates', async () => {
    renderTracker();
    expect(await screen.findByText('OneMinute Demo Clinic')).toBeInTheDocument();
    expect(mocks.api.getAppointment).toHaveBeenCalledWith(appointment.id);
    expect(mocks.api.getTracker).toHaveBeenCalledWith(appointment.id);
    await waitFor(() => expect(mocks.streamTracker).toHaveBeenCalledWith(appointment.id, expect.any(AbortSignal), expect.any(Function)));
  });

  it('requests location explicitly and sends only allowed location fields', async () => {
    const getCurrentPosition = navigator.geolocation.getCurrentPosition as ReturnType<typeof vi.fn>;
    getCurrentPosition.mockImplementation((success: PositionCallback) => success({ coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 18 } } as GeolocationPosition));
    renderTracker();
    await waitFor(() => expect(mocks.api.sendLocationSignal).toHaveBeenCalledWith(appointment.id, { latitude: 12.9716, longitude: 77.5946, accuracyMeters: 18 }));
    expect(document.body.innerHTML).not.toContain('12.9716');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('handles denied and unsupported geolocation', async () => {
    const getCurrentPosition = navigator.geolocation.getCurrentPosition as ReturnType<typeof vi.fn>;
    getCurrentPosition.mockImplementation((_success: PositionCallback, failure: PositionErrorCallback) => failure({ code: 1, message: 'denied' } as GeolocationPositionError));
    renderTracker(); await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled()); expect(await screen.findByText('Location access denied')).toBeInTheDocument();
    cleanup();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    renderTracker(); expect(await screen.findByText('Location is unavailable')).toBeInTheDocument();
  });

  it('renders only the server-issued token and authoritative queue values', async () => {
    mocks.api.getTracker.mockResolvedValue({ tracker: { ...tracker, ownToken: { label: 'T-17', status: 'waiting' }, nowServing: 'T-12', patientsAhead: 4, estimatedWaitMinutes: 35, doctorStatus: 'in_consultation', appointmentStatus: 'queued' } });
    renderTracker();
    expect(await screen.findByText('T-17')).toBeInTheDocument(); expect(screen.getByText('T-12')).toBeInTheDocument(); expect(screen.getByText('4')).toBeInTheDocument(); expect(screen.getByText('~35 min')).toBeInTheDocument(); expect(screen.getByText('In consultation')).toBeInTheDocument();
    expect(screen.queryByText('T-1', { exact: true })).not.toBeInTheDocument();
  });

  it('shows unavailable ETA during a break', async () => {
    mocks.api.getTracker.mockResolvedValue({ tracker: { ...tracker, doctorStatus: 'on_break', estimatedWaitMinutes: null } }); renderTracker();
    expect(await screen.findByText('Estimated wait unavailable while the doctor is on break.')).toBeInTheDocument(); expect(screen.getByText('On break')).toBeInTheDocument();
  });

  it('refreshes the authoritative snapshot when an SSE event arrives', async () => {
    let eventHandler: (() => void) | undefined;
    mocks.streamTracker.mockImplementation((_id: string, _signal: AbortSignal, onEvent: () => void) => { eventHandler = onEvent; return new Promise(() => undefined); });
    mocks.api.getTracker.mockResolvedValueOnce({ tracker }).mockResolvedValueOnce({ tracker: { ...tracker, ownToken: { label: 'T-21', status: 'waiting' }, appointmentStatus: 'queued' } });
    renderTracker(); await screen.findByText('Not issued yet'); eventHandler?.();
    await waitFor(() => expect(screen.getByText('T-21')).toBeInTheDocument()); expect(mocks.api.getTracker).toHaveBeenCalledTimes(2);
  });

  it('falls back to polling after stream failure and cleans polling on unmount', async () => {
    vi.useFakeTimers(); mocks.streamTracker.mockRejectedValue(new Error('connection lost')); renderTracker(); await vi.runOnlyPendingTimersAsync();
    expect(mocks.api.getTracker).toHaveBeenCalled(); const callsBeforeUnmount = mocks.api.getTracker.mock.calls.length;
    document.body.innerHTML = ''; vi.advanceTimersByTime(16_000); expect(mocks.api.getTracker.mock.calls.length).toBe(callsBeforeUnmount);
  });

  it.each([
    ['cancelled', 'Visit Cancelled'], ['completed', 'Visit Completed'], ['no_show', 'Visit No Show'],
  ])('stops location and live tracking for %s appointments', async (status, label) => {
    mocks.api.getAppointment.mockResolvedValue({ appointment: { ...appointment, status } }); mocks.api.getTracker.mockResolvedValue({ tracker: { ...tracker, appointmentStatus: status } });
    renderTracker(); expect(await screen.findByText(label)).toBeInTheDocument(); expect(mocks.streamTracker).not.toHaveBeenCalled(); expect(mocks.api.sendLocationSignal).not.toHaveBeenCalled();
  });

  it('shows the consultation mode alongside the doctor and appointment status', async () => {
    mocks.api.getTracker.mockResolvedValue({ tracker: { ...tracker, consultationMode: 'video' } });
    renderTracker();
    expect(await screen.findByText('Dr. Demo · Video · Booked')).toBeInTheDocument();
  });

  it('shows "It is your turn" and hides the now-moot ahead/ETA metrics once the patient is being served', async () => {
    mocks.api.getTracker.mockResolvedValue({ tracker: { ...tracker, ownToken: { label: 'T-9', status: 'serving' }, nowServing: 'T-9', patientsAhead: 0, estimatedWaitMinutes: 0, doctorStatus: 'in_consultation', appointmentStatus: 'in_consultation' } });
    renderTracker();
    expect(await screen.findByText('It is your turn. Please be ready for your consultation.')).toBeInTheDocument();
    expect(screen.queryByText('Patients ahead')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimated wait')).not.toBeInTheDocument();
    expect(screen.getByText('Now serving')).toBeInTheDocument();
  });
});

describe('tracker entry', () => {
  it('offers tracking only for relevant in-person appointments', async () => {
    mocks.api.getAppointment.mockResolvedValue({ appointment }); mocks.api.getPayment.mockResolvedValue({ payment: null });
    renderDetail(); expect(await screen.findByText('Track visit')).toBeInTheDocument();
    cleanup(); mocks.api.getAppointment.mockResolvedValue({ appointment: { ...appointment, consultationMode: 'video' } }); renderDetail(); await waitFor(() => expect(screen.queryByText('Track visit')).not.toBeInTheDocument());
  });
});
