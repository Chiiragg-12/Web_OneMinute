import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareGuardHistoryPage, CareGuardHomePage, CareGuardPlanPage } from '../pages/CareGuardPages';
import { CareGuardPlanEditor } from '../components/CareGuardPlanEditor';

const mocks = vi.hoisted(() => ({
  api: {
    getCareGuardPlans: vi.fn(), getCareGuardPlan: vi.fn(), getCareGuardHistory: vi.fn(), logCareGuardDose: vi.fn(), saveCareGuardCheckIn: vi.fn(), setCareGuardSharing: vi.fn(),
    getDoctorCareGuardPlan: vi.fn(), saveDoctorCareGuardPlan: vi.fn(), approveDoctorCareGuardPlan: vi.fn(), endDoctorCareGuardPlan: vi.fn(),
    getCareGuardCaredFor: vi.fn(), getCareGuardMessages: vi.fn(), sendCareGuardMessage: vi.fn(), getCareGuardExplanation: vi.fn(), getDoctorPreviousCareGuardPlans: vi.fn(),
  },
}));
vi.mock('../api/client', () => ({ api: mocks.api }));

const safety = {
  emergency: 'CareGuard is not an emergency service. Call 112 or go to the nearest emergency facility now.',
  planNotice: 'This plan was set by your doctor.',
  selfReported: 'What you record here is self-reported.',
  missedDose: 'Do not take extra medicine to make up for a missed dose.',
  worse: 'You said you feel worse. Please contact your clinic.',
  same: 'Thanks for the update.',
  better: 'Thanks for the update.',
};
const dose = (overrides = {}) => ({ scheduleId: 's1', medicineName: 'Paracetamol', dosageText: '500 mg', instructionText: 'After meals', scheduledFor: '2099-01-01T02:30:00.000Z', status: 'pending', snoozedUntil: null, overdue: false, ...overrides });
const planDetail = (overrides = {}) => ({
  id: 'plan-1', publicPlanId: 'OMCG-1', status: 'approved', active: true, recipientName: 'Rahul', doctorName: 'Dr. Demo', clinicName: 'Demo Clinic', approvedAt: '2026-10-12T05:00:00.000Z', medicineCount: 1,
  followUp: { date: '2026-10-17', note: 'Review', daysUntil: 5, clinicId: 'clinic-1', doctorId: 'doctor-1' },
  timezone: 'Asia/Kolkata', schedules: [{ id: 's1', medicineName: 'Paracetamol', dosageText: '500 mg', instructionText: 'After meals', timesOfDay: ['08:00', '20:00'], startDate: '2026-10-12', endDate: '2026-10-16' }],
  checkInsEnabled: true, shareWithClinic: false, today: { date: '2026-10-12', doses: [dose()], checkIn: null }, safety, ...overrides,
});
const renderPlan = () => render(<MemoryRouter initialEntries={['/app/careguard/plan-1']}><Routes><Route path="/app/careguard/:planId" element={<CareGuardPlanPage />} /></Routes></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.api.getCareGuardCaredFor.mockResolvedValue({ people: [] });
  mocks.api.getCareGuardMessages.mockResolvedValue({ messaging: { mode: 'off', enabled: false, note: null, clinicName: 'Demo Clinic' }, messages: [], safety: { emergency: 'x', emergencyHi: 'x' } });
  mocks.api.getDoctorPreviousCareGuardPlans.mockResolvedValue({ plans: [] });
});
afterEach(cleanup);

describe('CareGuard home', () => {
  it('lists plans with today\'s progress and keeps the emergency notice in view', async () => {
    mocks.api.getCareGuardPlans.mockResolvedValue({ plans: [{ ...planDetail(), today: { date: '2026-10-12', pendingDoses: 2, totalDoses: 3 } }], safety });
    render(<MemoryRouter><CareGuardHomePage /></MemoryRouter>);
    expect(await screen.findByText('Rahul')).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 doses still to record today/)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('not an emergency service');
    expect(screen.getByRole('link', { name: 'Recovery history' })).toBeInTheDocument();
  });

  it('explains what to expect when there is no plan yet', async () => {
    mocks.api.getCareGuardPlans.mockResolvedValue({ plans: [], safety });
    render(<MemoryRouter><CareGuardHomePage /></MemoryRouter>);
    expect(await screen.findByText('No CareGuard plan yet')).toBeInTheDocument();
  });
});

describe('CareGuard plan screen', () => {
  it('shows the doctor\'s medicine wording and the self-reported disclaimer', async () => {
    mocks.api.getCareGuardPlan.mockResolvedValue({ plan: planDetail() });
    renderPlan();
    expect(await screen.findByText('This plan was set by your doctor.')).toBeInTheDocument();
    const today = screen.getByRole('region', { name: "Today's medicines" });
    expect(within(today).getByText('500 mg')).toBeInTheDocument();
    expect(within(today).getByText('After meals')).toBeInTheDocument();
    expect(within(today).getByText(/not proof that a medicine was taken/)).toBeInTheDocument();
  });

  it('records a dose as taken, postponed or missed with the exact scheduled time', async () => {
    mocks.api.getCareGuardPlan.mockResolvedValue({ plan: planDetail() });
    mocks.api.logCareGuardDose.mockResolvedValue({ notice: null });
    renderPlan();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Taken' }));
    expect(mocks.api.logCareGuardDose).toHaveBeenCalledWith('plan-1', { scheduleId: 's1', scheduledFor: '2099-01-01T02:30:00.000Z', status: 'taken' });
    await user.click(screen.getByRole('button', { name: 'Remind me later' }));
    expect(mocks.api.logCareGuardDose).toHaveBeenLastCalledWith('plan-1', expect.objectContaining({ status: 'postponed' }));
  });

  it('shows the "do not take extra" notice after a missed dose and never suggests doubling', async () => {
    mocks.api.getCareGuardPlan.mockResolvedValue({ plan: planDetail() });
    mocks.api.logCareGuardDose.mockResolvedValue({ notice: safety.missedDose });
    renderPlan();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Missed' }));
    expect(await screen.findByText(safety.missedDose, { selector: '[role=status]' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/double dose|take two/i);
  });

  it('puts emergency guidance in front when the check-in says worse', async () => {
    mocks.api.getCareGuardPlan.mockResolvedValue({ plan: planDetail() });
    mocks.api.saveCareGuardCheckIn.mockResolvedValue({ checkIn: { date: '2026-10-12', feeling: 'worse', note: null, recordedAt: '', source: 'patient_reported' }, message: safety.worse, urgent: safety.emergency });
    renderPlan();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Worse' }));
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    await waitFor(() => expect(mocks.api.saveCareGuardCheckIn).toHaveBeenCalledWith('plan-1', { feeling: 'worse', note: null }));
    expect(await screen.findByText(safety.worse, { selector: '[role=status]' })).toBeInTheDocument();
    expect(screen.getAllByRole('note').some((node) => node.textContent?.includes('Call 112'))).toBe(true);
  });

  it('links the follow-up to the existing booking flow and lets it be dismissed', async () => {
    mocks.api.getCareGuardPlan.mockResolvedValue({ plan: planDetail() });
    renderPlan();
    const link = await screen.findByRole('link', { name: 'Book follow-up' });
    expect(link).toHaveAttribute('href', '/app/clinics/clinic-1/doctors/doctor-1/book');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss reminder' }));
    expect(screen.queryByRole('link', { name: 'Book follow-up' })).not.toBeInTheDocument();
  });

  it('lets the patient control sharing with the clinic, off by default', async () => {
    mocks.api.getCareGuardPlan.mockResolvedValue({ plan: planDetail() });
    mocks.api.setCareGuardSharing.mockResolvedValue({ shareWithClinic: true });
    renderPlan();
    const checkbox = await screen.findByRole('checkbox', { name: /Let Dr\. Demo see my daily check-ins/ });
    expect(checkbox).not.toBeChecked();
    await userEvent.setup().click(checkbox);
    expect(mocks.api.setCareGuardSharing).toHaveBeenCalledWith('plan-1', true);
  });

  it('is read-only once the plan has ended', async () => {
    mocks.api.getCareGuardPlan.mockResolvedValue({ plan: planDetail({ status: 'ended', active: false }) });
    renderPlan();
    expect(await screen.findByText(/This plan has ended/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Taken' })).not.toBeInTheDocument();
  });
});

describe('CareGuard recovery history', () => {
  it('keeps the doctor\'s clinical plan apart from what the patient reported', async () => {
    mocks.api.getCareGuardHistory.mockResolvedValue({
      history: [{ ...planDetail(), clinicalPlan: { medicines: planDetail().schedules, followUpDate: '2026-10-17', followUpNote: 'Review' }, patientReported: { checkIns: [{ date: '2026-10-12', feeling: 'better', note: 'Fever has reduced', recordedAt: '', source: 'patient_reported' }], adherence: { scheduledSoFar: 4, taken: 3, postponed: 0, missed: 1, selfReported: true } } }],
      safety: { selfReported: safety.selfReported },
    });
    render(<MemoryRouter><CareGuardHistoryPage /></MemoryRouter>);
    expect(await screen.findByText('Set by your doctor (clinical plan)')).toBeInTheDocument();
    expect(screen.getByText('Reported by you (self-reported)')).toBeInTheDocument();
    expect(screen.getByText(/Fever has reduced/)).toBeInTheDocument();
    expect(screen.getByText(/3 taken, 0 postponed, 1 missed, out of 4 scheduled so far/)).toBeInTheDocument();
  });
});

describe('Doctor CareGuard plan editor', () => {
  const medicines = [{ id: 'med-1', medicineName: 'Paracetamol', strength: '500 mg', dosage: '1 tablet', route: 'oral', frequency: 'twice daily', duration: '5 days', instructions: 'After meals', needsReview: false }];
  const approvedPlan = { id: 'plan-1', publicPlanId: 'OMCG-1', status: 'approved', timezone: 'Asia/Kolkata', checkInsEnabled: true, followUpDate: '2026-10-17', followUpNote: null, approvedAt: '2026-10-12T05:00:00Z', schedules: [{ id: 's1', prescriptionMedicineId: 'med-1', medicineName: 'Paracetamol', dosageText: null, instructionText: null, timesOfDay: ['08:00', '20:00'], startDate: '2026-10-12', endDate: '2026-10-16' }], sharedWithClinic: false, active: true, sharedUpdates: null };

  it('saves the draft and then approves, sending the times the doctor chose', async () => {
    mocks.api.getDoctorCareGuardPlan.mockResolvedValue({ plan: null });
    mocks.api.saveDoctorCareGuardPlan.mockResolvedValue({ plan: { ...approvedPlan, status: 'draft' } });
    mocks.api.approveDoctorCareGuardPlan.mockResolvedValue({ plan: approvedPlan });
    render(<CareGuardPlanEditor appointmentId="appt-1" medicines={medicines} />);
    expect(await screen.findByText(/DRAFT — not visible to the patient/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Approve and share with patient' }));
    await waitFor(() => expect(mocks.api.approveDoctorCareGuardPlan).toHaveBeenCalledWith('appt-1'));
    const sent = mocks.api.saveDoctorCareGuardPlan.mock.calls[0][1];
    expect(sent.schedules).toEqual([expect.objectContaining({ prescriptionMedicineId: 'med-1', timesOfDay: ['08:00', '20:00'], durationDays: 5 })]);
    expect(sent.checkInsEnabled).toBe(true);
    expect(await screen.findByText('CareGuard plan (approved)')).toBeInTheDocument();
  });

  it('shows patient updates only when they are shared, labelled as self-reported', async () => {
    mocks.api.getDoctorCareGuardPlan.mockResolvedValue({ plan: { ...approvedPlan, sharedWithClinic: true, sharedUpdates: { selfReported: true, checkIns: [{ date: '2026-10-12', feeling: 'worse', note: null, recordedAt: '', source: 'patient_reported' }], adherence: { scheduledSoFar: 2, taken: 1, postponed: 0, missed: 1, selfReported: true } } } });
    render(<CareGuardPlanEditor appointmentId="appt-1" medicines={medicines} />);
    expect(await screen.findByText(/Reported by the patient · shared with their permission/)).toBeInTheDocument();
    expect(screen.getByText(/does not alert anyone/)).toBeInTheDocument();
  });

  it('says nothing was shared when the patient has not consented', async () => {
    mocks.api.getDoctorCareGuardPlan.mockResolvedValue({ plan: approvedPlan });
    render(<CareGuardPlanEditor appointmentId="appt-1" medicines={medicines} />);
    expect(await screen.findByText(/has not shared their check-ins/)).toBeInTheDocument();
  });
});
