import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceptionistStatusPage } from '../pages/ReceptionistStatusPage';

const mocks = vi.hoisted(() => ({ api: { listReceptionistPaymentStatus: vi.fn(), listReceptionistConsultationStatus: vi.fn() } }));
vi.mock('../api/client', () => ({ api: mocks.api }));

const base = { id: 'appointment-1', doctor: { id: 'doctor-1', name: 'Dr. Demo' }, patient: { id: 'patient-1', healthId: 'H-1', name: 'Arjun Sharma', heightCm: null, weightKg: null, dob: null, sex: null, bmi: null }, bookedBy: null, relationship: null, scheduledStartAt: '2026-10-02T11:00:00.000Z', consultationMode: 'in_person', durationMinutes: 60, consultationReason: null, status: 'completed', token: null };
function renderPayments(search: string) { return render(<MemoryRouter initialEntries={[`/receptionist/appointments${search}`]}><Routes><Route path="/receptionist/appointments" element={<ReceptionistStatusPage kind="payment" />} /></Routes></MemoryRouter>); }

beforeEach(() => { vi.clearAllMocks(); mocks.api.listReceptionistConsultationStatus.mockResolvedValue({ appointments: [] }); });

describe('Receptionist payment status', () => {
  it('renders a consultation-completed appointment as Payment Pending when AppointmentPayment is unpaid', async () => {
    mocks.api.listReceptionistPaymentStatus.mockImplementation((status: string) => Promise.resolve({ appointments: status === 'pending' ? [{ ...base, fullyDone: false, payment: { method: 'pay_at_reception', status: 'pay_at_reception', amountCents: 1500 } }] : [] }));
    renderPayments('?view=payments&status=pending&recipient=self');
    expect(await screen.findByText('Arjun Sharma')).toBeInTheDocument();
    expect(screen.getByText('Amount due: ₹15.00')).toBeInTheDocument();
    expect(screen.getByText('Consultation: completed')).toBeInTheDocument();
    expect(screen.queryByText('Amount paid: ₹15.00')).not.toBeInTheDocument();
  });

  it('renders the appointment as Payment Completed only when AppointmentPayment is paid', async () => {
    mocks.api.listReceptionistPaymentStatus.mockImplementation((status: string) => Promise.resolve({ appointments: status === 'completed' ? [{ ...base, fullyDone: true, payment: { method: 'pay_at_reception', status: 'paid', amountCents: 1500, actualAmountCents: 1250, receptionMethod: 'cash' } }] : [] }));
    renderPayments('?view=payments&status=completed&recipient=self');
    expect(await screen.findByText('Arjun Sharma')).toBeInTheDocument();
    expect(screen.getByText('Amount paid: ₹12.50 · CASH')).toBeInTheDocument();
    expect(screen.queryByText('Amount due: ₹15.00')).not.toBeInTheDocument();
  });
});