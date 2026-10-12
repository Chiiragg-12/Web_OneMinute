import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { AppointmentDetailPage, AppointmentsPage, BookingPage } from '../pages/BookingPages';

const mocks = vi.hoisted(() => ({
  api: {
    getClinic: vi.fn(), getDoctorOptions: vi.fn(), listSlots: vi.fn(), createAppointment: vi.fn(),
    createRazorpayOrder: vi.fn(), verifyRazorpayPayment: vi.fn(),
    listAppointments: vi.fn(), getAppointment: vi.fn(), getPayment: vi.fn(), getPatientPrescription: vi.fn(), cancelAppointment: vi.fn(), listFamilyMembers: vi.fn(), listHealthRecords: vi.fn(),
  }, openRazorpayCheckout: vi.fn(),
}));

vi.mock('../api/client', () => ({ api: mocks.api, ApiError: class MockApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } } }));
vi.mock('../utils/razorpay', () => ({ openRazorpayCheckout: mocks.openRazorpayCheckout }));

const clinic = { id: 'clinic-1', name: 'Harbor Clinic', address: '1 Harbor Road', timezone: 'Asia/Kolkata' };
const doctor = { id: 'doctor-1', fullName: 'Dr. Mira', specialization: 'Family medicine' };
const options = [
  { consultationMode: 'in_person', durationMinutes: 60, priceCents: 1500 },
  { consultationMode: 'video', durationMinutes: 20, priceCents: 2500 },
  { consultationMode: 'video', durationMinutes: 40, priceCents: 4500 },
  { consultationMode: 'audio', durationMinutes: 15, priceCents: 1800 },
  { consultationMode: 'chat', durationMinutes: 10, priceCents: 1200 },
] as const;
const appointment = { id: 'appointment-1', doctor: { id: doctor.id, name: doctor.fullName }, clinic: { id: clinic.id, name: clinic.name }, scheduledStartAt: '2030-01-02T04:30:00.000Z', consultationMode: 'video', durationMinutes: 20, consultationReason: 'Follow up', status: 'booked', token: null, payment: { method: 'upi', status: 'pending', amountCents: 2500 } };

function renderBooking() {
  return render(<MemoryRouter initialEntries={[`/app/clinics/${clinic.id}/doctors/${doctor.id}/book`]}><Routes><Route path="/app/clinics/:clinicId/doctors/:doctorId/book" element={<BookingPage />} /></Routes></MemoryRouter>);
}
function renderAppointments(path = '/app/appointments') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/appointments" element={<AppointmentsPage />} /><Route path="/app/appointments/:appointmentId" element={<AppointmentDetailPage />} /></Routes></MemoryRouter>);
}
async function readyForBooking() {
  expect(await screen.findByText('Plan your visit')).toBeInTheDocument();
  const date = screen.getByLabelText('Clinic date'); await userEvent.setup().clear(date); await userEvent.setup().type(date, '2030-01-02');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.openRazorpayCheckout.mockResolvedValue({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'signature' });
  mocks.api.createRazorpayOrder.mockResolvedValue({ keyId: 'rzp_test_fixture', orderId: 'order_1', amount: 2500, currency: 'INR', appointmentId: appointment.id, payment: appointment.payment });
  mocks.api.verifyRazorpayPayment.mockResolvedValue({ payment: { ...appointment.payment, status: 'paid' } });
  mocks.api.getClinic.mockResolvedValue({ clinic });
  mocks.api.getDoctorOptions.mockResolvedValue({ doctor, clinicId: clinic.id, options });
  mocks.api.listSlots.mockResolvedValue({ slots: ['2030-01-02T04:30:00.000Z'] });
  mocks.api.createAppointment.mockResolvedValue({ appointment });
  mocks.api.getPayment.mockResolvedValue({ payment: appointment.payment });
  mocks.api.cancelAppointment.mockResolvedValue({ appointment: { ...appointment, status: 'cancelled' } });
  mocks.api.listFamilyMembers.mockResolvedValue({ familyMembers: [] });
  mocks.api.listHealthRecords.mockResolvedValue({ records: [] });
  mocks.api.getPatientPrescription.mockResolvedValue({ prescription: null });
});

describe('patient booking flow', () => {
  it('loads consultation options while preserving clinic and doctor context', async () => {
    renderBooking();
    expect(await screen.findByText('In person')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(mocks.api.getDoctorOptions).toHaveBeenCalledWith(clinic.id, doctor.id);
  });

  it('renders backend in-person pricing and loads slots in clinic time', async () => {
    renderBooking();
    expect(await screen.findByRole('button', { name: /60 min/ })).toHaveTextContent('₹');
    await readyForBooking();
    expect(await screen.findByRole('button', { name: '10:00 am' })).toBeInTheDocument();
    expect(mocks.api.listSlots).toHaveBeenCalledWith(clinic.id, doctor.id, '2030-01-02');
  });

  it('supports backend-returned online durations and hides pay at reception for video', async () => {
    renderBooking(); await screen.findByText('Plan your visit');
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: /video remote consultation/i }));
    expect(screen.getByText('20 min')).toBeInTheDocument(); expect(screen.getByText('40 min')).toBeInTheDocument();
    expect(screen.queryByText('Pay at reception')).not.toBeInTheDocument();
  });

  it.each(['audio', 'chat'] as const)('hides pay at reception for %s', async (mode) => {
    renderBooking(); await screen.findByText('Plan your visit');
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: new RegExp(`${mode} remote consultation`, 'i') }));
    expect(screen.queryByText('Pay at reception')).not.toBeInTheDocument();
  });

  it('shows pay at reception in person and clears it when switching online', async () => {
    renderBooking(); await screen.findByText('Plan your visit'); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /pay at reception/i }));
    expect(screen.getByText('Payment selection')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /video remote consultation/i }));
    expect(screen.queryByText('Pay at reception')).not.toBeInTheDocument();
    expect(screen.getByText('Choose a method')).toBeInTheDocument();
  });

  it('shows an explicit no-slots state', async () => {
    mocks.api.listSlots.mockResolvedValue({ slots: [] }); renderBooking(); await readyForBooking();
    expect(await screen.findByText('No slots on this date')).toBeInTheDocument();
  });

  it('sends the exact booking payload once and shows backend confirmation', async () => {
    renderBooking(); await screen.findByText('Plan your visit'); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /video remote consultation/i }));
    await user.click(screen.getByRole('button', { name: /40 min/i }));
    await readyForBooking();
    await user.click(await screen.findByRole('button', { name: '10:00 am' }));
    await user.type(screen.getByPlaceholderText('Tell the doctor what you would like help with'), 'Follow up');
    await user.click(screen.getByRole('button', { name: /pay online with razorpay/i }));
    const confirm = screen.getByRole('button', { name: /confirm appointment/i }); await user.dblClick(confirm);
    await waitFor(() => expect(mocks.api.createAppointment).toHaveBeenCalledOnce());
    expect(mocks.api.createAppointment).toHaveBeenCalledWith({ doctorId: doctor.id, clinicId: clinic.id, scheduledStartAt: '2030-01-02T04:30:00.000Z', consultationMode: 'video', durationMinutes: 40, consultationReason: 'Follow up', paymentMethod: 'razorpay' });
    expect(await screen.findByText('Appointment created')).toBeInTheDocument(); expect(screen.getByText(appointment.id)).toBeInTheDocument();
  });

  it('does not show Razorpay as paid from Checkout callback without backend verification', async () => {
    mocks.api.verifyRazorpayPayment.mockRejectedValue(new Error('Invalid Razorpay signature'));
    renderBooking(); await screen.findByText('Plan your visit'); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /video remote consultation/i })); await readyForBooking(); await user.click(await screen.findByRole('button', { name: '10:00 am' })); await user.click(screen.getByRole('button', { name: /pay online with razorpay/i })); await user.click(screen.getByRole('button', { name: /confirm appointment/i }));
    await user.click(await screen.findByRole('button', { name: 'Pay Online with Razorpay' }));
    expect(await screen.findByText('Invalid Razorpay signature')).toBeInTheDocument();
    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('selects one family member and sends only that care-recipient id', async () => {
    mocks.api.listFamilyMembers.mockResolvedValue({ familyMembers: [{ id: 'member-1', fullName: 'Rajesh Sharma', relationship: 'Father', dob: null, heightCm: 179, weightKg: 70, sex: 'male', bmi: 21.8 }] });
    renderBooking(); await screen.findByText('Plan your visit'); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Rajesh Sharma Father/i }));
    await readyForBooking(); await user.click(await screen.findByRole('button', { name: '10:00 am' })); await user.click(screen.getByRole('button', { name: /pay online with razorpay/i })); await user.click(screen.getByRole('button', { name: /confirm appointment/i }));
    await waitFor(() => expect(mocks.api.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ familyMemberId: 'member-1' })));
  });

  it('shows and submits only the selected care recipient records, then clears them when switching recipient', async () => {
    const familyMember = { id: 'member-1', fullName: 'Rajesh Sharma', relationship: 'Father', dob: null, heightCm: 179, weightKg: 70, sex: 'male', bmi: 21.8 };
    const record = { id: 'record-rajesh', type: 'lab_report', title: 'Ramesh Lab Report', documentDate: null, originalFilename: 'ramesh.pdf' };
    mocks.api.listFamilyMembers.mockResolvedValue({ familyMembers: [familyMember] });
    mocks.api.listHealthRecords.mockImplementation((familyMemberId?: string) => Promise.resolve({ records: familyMemberId ? [record] : [] }));
    renderBooking(); await screen.findByText('Plan your visit'); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Rajesh Sharma Father/i }));
    expect(await screen.findByText('Ramesh Lab Report')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^Myself/i }));
    expect(screen.queryByText('Ramesh Lab Report')).not.toBeInTheDocument();
    expect(mocks.api.listHealthRecords).toHaveBeenLastCalledWith(undefined);
  });

  it('submits the explicitly selected family health record ID', async () => {
    const familyMember = { id: 'member-1', fullName: 'Rajesh Sharma', relationship: 'Father', dob: null, heightCm: 179, weightKg: 70, sex: 'male', bmi: 21.8 };
    const record = { id: 'record-rajesh', type: 'lab_report', title: 'Ramesh Lab Report', documentDate: null, originalFilename: 'ramesh.pdf' };
    mocks.api.listFamilyMembers.mockResolvedValue({ familyMembers: [familyMember] });
    mocks.api.listHealthRecords.mockImplementation((familyMemberId?: string) => Promise.resolve({ records: familyMemberId ? [record] : [] }));
    renderBooking(); await screen.findByText('Plan your visit'); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Rajesh Sharma Father/i })); await user.click(await screen.findByText('Ramesh Lab Report')); await readyForBooking(); await user.click(await screen.findByRole('button', { name: '10:00 am' })); await user.click(screen.getByRole('button', { name: /pay online with razorpay/i })); await user.click(screen.getByRole('button', { name: /confirm appointment/i }));
    await waitFor(() => expect(mocks.api.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ familyMemberId: 'member-1', healthRecordIds: ['record-rajesh'] })));
  });

  it('handles a booked-slot conflict without retrying creation', async () => {
    mocks.api.createAppointment.mockRejectedValue(new ApiError(409, 'Appointment slot is already booked'));
    renderBooking(); await readyForBooking(); const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '10:00 am' })); await user.click(screen.getByRole('button', { name: /pay online with razorpay/i })); await user.click(screen.getByRole('button', { name: /confirm appointment/i }));
    expect(await screen.findByText('Appointment slot is already booked')).toBeInTheDocument(); expect(mocks.api.createAppointment).toHaveBeenCalledOnce(); expect(screen.getByText('Choose a slot')).toBeInTheDocument();
  });
});

describe('patient appointments', () => {
  it('renders loading, empty, and data states', async () => {
    let resolve: (value: { appointments: never[] }) => void = () => undefined; mocks.api.listAppointments.mockReturnValue(new Promise((done) => { resolve = done; })); renderAppointments(); expect(screen.getByRole('status')).toHaveTextContent('Loading your appointments'); resolve({ appointments: [] }); expect(await screen.findByText('No appointments yet')).toBeInTheDocument();
    mocks.api.listAppointments.mockResolvedValue({ appointments: [appointment] }); renderAppointments(); expect(await screen.findByText('Dr. Mira')).toBeInTheDocument(); expect(screen.getByText('Booked')).toBeInTheDocument();
  });

  it('shows appointment detail and refreshes authoritative state after cancellation', async () => {
    mocks.api.getAppointment.mockResolvedValueOnce({ appointment }).mockResolvedValueOnce({ appointment: { ...appointment, status: 'cancelled' } });
    renderAppointments('/app/appointments/appointment-1'); expect(await screen.findByText('Cancel appointment')).toBeInTheDocument();
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Cancel appointment' })); expect(screen.getByRole('dialog')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await waitFor(() => expect(mocks.api.cancelAppointment).toHaveBeenCalledWith('appointment-1', 'Changed plans')); await waitFor(() => expect(screen.getByText('Cancelled')).toBeInTheDocument()); expect(mocks.api.getAppointment).toHaveBeenCalledTimes(2);
  });

  it('keeps the Razorpay CTA available for a legacy completed online appointment with pending payment', async () => {
    const legacy = { ...appointment, status: 'completed', payment: { method: 'razorpay', status: 'pending', amountCents: 2500 } };
    mocks.api.getAppointment.mockResolvedValue({ appointment: legacy });
    mocks.api.getPayment.mockResolvedValue({ payment: legacy.payment });
    mocks.api.getClinic.mockResolvedValue({ clinic });
    renderAppointments('/app/appointments/appointment-1');
    expect(await screen.findByRole('button', { name: 'Pay Online with Razorpay' })).toBeInTheDocument();
  });

  it('marks the finalized prescription surface for print and keeps the print action visible on screen', async () => {
    mocks.api.getAppointment.mockResolvedValue({ appointment: { ...appointment, status: 'completed', completedAt: '2030-01-02T05:30:00.000Z' } });
    mocks.api.getPatientPrescription.mockResolvedValue({ prescription: { id: 'rx-1', appointmentId: appointment.id, status: 'approved', advice: 'Rest', followUpText: null, approvedAt: '2030-01-02T05:30:00.000Z', sourceFilename: null, sourceAvailable: false, medicines: [{ id: 'm1', medicineName: 'Example medicine', strength: '10 mg', dosage: null, route: null, frequency: null, duration: null, instructions: null, needsReview: false }], identity: { clinicPublicId: 'OMC-ABCD1234', clinicName: 'Harbor Clinic', clinicAddress: '1 Harbor Road', doctorName: 'Dr. Mira', doctorQualifications: 'MBBS', doctorSpecialization: 'Family medicine', doctorRegistrationNumber: 'R-1', doctorRegistrationCouncil: 'Council', patientName: 'Asha', bookedByName: 'Asha', relationship: null, patientDob: null, patientSex: null } } });
    renderAppointments('/app/appointments/appointment-1'); expect((await screen.findAllByText('FINAL PRESCRIPTION')).length).toBe(2); expect(screen.getByRole('button', { name: 'Print Prescription' })).toBeInTheDocument(); const printRoot = document.querySelector('.prescription-print-portal'); expect(printRoot).toBeTruthy(); expect(printRoot?.parentElement).toBe(document.body); expect(printRoot?.querySelector('button')).toBeNull();
  });

  it('switches between server-filtered self and family appointment views', async () => {
    mocks.api.listAppointments.mockImplementation((recipient: string) => Promise.resolve({ appointments: recipient === 'family' ? [{ ...appointment, patient: { id: 'member-1', name: 'Rajesh Sharma', relationship: 'Father' }, bookedBy: { id: 'p1', name: 'Arjun Sharma', healthId: 'H-1' } }] : [appointment] }));
    renderAppointments(); expect(await screen.findByText('Dr. Mira')).toBeInTheDocument(); expect(mocks.api.listAppointments).toHaveBeenCalledWith('self');
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Family Member Appointments' }));
    expect(await screen.findByText('Rajesh Sharma')).toBeInTheDocument(); expect(screen.getByText(/Booked by: Arjun Sharma/)).toBeInTheDocument(); expect(mocks.api.listAppointments).toHaveBeenLastCalledWith('family');
  });
});
