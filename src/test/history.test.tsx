import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientHistoryPage, ReceptionistHistoryPage } from '../pages/HistoryPages';

const mocks = vi.hoisted(() => ({ api: { listAppointments: vi.fn(), listReceptionistAppointments: vi.fn() } }));
vi.mock('../api/client', () => ({ api: mocks.api }));
const self = { id: 'self-1', patient: { id: 'p1', name: 'Arjun Sharma' }, doctor: { id: 'd1', name: 'Dr. Demo' }, clinic: { id: 'c1', name: 'Demo Clinic' }, scheduledStartAt: '2026-09-17T10:00:00.000Z', completedAt: '2026-09-18T10:00:00.000Z', consultationMode: 'in_person', durationMinutes: 60, consultationReason: 'Self visit', status: 'completed', token: { label: 'T-1', status: 'completed' }, payment: null };
const family = { ...self, id: 'family-1', patient: { id: 'm1', name: 'Ramesh', relationship: 'Father' }, bookedBy: { id: 'p1', name: 'Arjun Sharma', healthId: 'H1' }, relationship: 'Father', consultationReason: 'Family visit' };
function patientPage() { return render(<MemoryRouter initialEntries={['/app/history']}><Routes><Route path="/app/history" element={<PatientHistoryPage />} /></Routes></MemoryRouter>); }
function receptionistPage() { return render(<MemoryRouter initialEntries={['/receptionist/history']}><Routes><Route path="/receptionist/history" element={<ReceptionistHistoryPage />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); mocks.api.listAppointments.mockImplementation((recipient: string) => Promise.resolve({ appointments: recipient === 'family' ? [family] : [self] })); mocks.api.listReceptionistAppointments.mockImplementation((_filter: string, _doctor: string | undefined, recipient: string) => Promise.resolve({ appointments: recipient === 'family' ? [family] : [{ ...self, patient: { id: 'p1', healthId: 'H1', name: 'Arjun Sharma', heightCm: null, weightKg: null, dob: null, sex: null, bmi: null }, bookedBy: { id: 'p1', name: 'Arjun Sharma', healthId: 'H1' }, relationship: null }] })); });

describe('consultation history', () => {
  it('shows Patient My History and Family Member History with correct identity', async () => { patientPage(); expect(await screen.findByText('Arjun Sharma')).toBeInTheDocument(); expect(screen.getByText('Completed')).toBeInTheDocument(); await userEvent.setup().click(screen.getByRole('tab', { name: 'Family Member History' })); expect(await screen.findByText('Ramesh')).toBeInTheDocument(); expect(screen.getByText(/Booked by: Arjun Sharma/)).toBeInTheDocument(); expect(mocks.api.listAppointments).toHaveBeenLastCalledWith('family', true); });
  it('shows Receptionist Patient and Family Member History with Appointment Fully Done identity', async () => { receptionistPage(); expect(await screen.findByText('Arjun Sharma')).toBeInTheDocument(); expect(screen.getByText('Appointment Fully Done')).toBeInTheDocument(); await userEvent.setup().click(screen.getByRole('tab', { name: 'Family Member History' })); expect(await screen.findByText('Ramesh')).toBeInTheDocument(); expect(screen.getByText(/Booked by: Arjun Sharma/)).toBeInTheDocument(); expect(mocks.api.listReceptionistAppointments).toHaveBeenLastCalledWith('completed', undefined, 'family'); });
});
