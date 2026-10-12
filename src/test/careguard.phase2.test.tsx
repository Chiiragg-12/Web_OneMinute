import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareGuardMessagesPanel } from '../components/CareGuardMessagesPanel';
import { CareGuardExplanationPanel } from '../components/CareGuardExplanationPanel';
import { CareGuardInbox } from '../components/CareGuardInbox';
import { CareGuardPlanEditor } from '../components/CareGuardPlanEditor';
import { CaredForPlanPage, CaregiversPage } from '../pages/CareGuardFamilyPages';
import { PlanView } from '../pages/CareGuardPages';
import { ReceptionistFollowUpsPage, ReceptionistMessagesPage } from '../pages/CareGuardClinicPages';

const mocks = vi.hoisted(() => ({
  api: {
    getCareGuardMessages: vi.fn(), sendCareGuardMessage: vi.fn(), getCareGuardExplanation: vi.fn(),
    getCareGuardCaregivers: vi.fn(), addCareGuardCaregiver: vi.fn(), updateCareGuardCaregiver: vi.fn(), revokeCareGuardCaregiver: vi.fn(), getCareGuardCaredFor: vi.fn(), leaveCareGuardCaredFor: vi.fn(),
    getCareGuardCaredForPlan: vi.fn(), logCareGuardCaredForDose: vi.fn(), logCareGuardDose: vi.fn(),
    getCareGuardInbox: vi.fn(), getCareGuardStaffThread: vi.fn(), replyCareGuardThread: vi.fn(), forwardCareGuardThread: vi.fn(),
    getCareGuardClinicSettings: vi.fn(), saveCareGuardClinicSettings: vi.fn(), getCareGuardFollowUps: vi.fn(),
    getDoctorCareGuardPlan: vi.fn(), getDoctorPreviousCareGuardPlans: vi.fn(),
  },
}));
vi.mock('../api/client', () => ({ api: mocks.api, ApiError: class ApiError extends Error { status = 0; } }));

const safety = { emergency: 'Not an emergency service. Call 112.', planNotice: 'Set by your doctor.', selfReported: 'Self-reported.', missedDose: 'Do not take extra medicine.', worse: 'Contact your clinic.', same: 'Thanks.', better: 'Thanks.' };
const safetyHi = { ...safety, emergency: 'यह आपातकालीन सेवा नहीं है।', planNotice: 'यह योजना आपके डॉक्टर ने तय की है।' };
const caregiverPlan = (overrides = {}) => ({
  id: 'plan-1', publicPlanId: 'OMCG-1', status: 'approved', active: true, recipientName: 'Father', doctorName: 'Dr. Demo', clinicName: 'Demo Clinic', approvedAt: '2026-10-12T05:00:00Z', medicineCount: 1,
  followUp: null, timezone: 'Asia/Kolkata', viewer: 'caregiver', scopes: { medication: true, appointments: false, health: false }, safety, safetyHi, explanationsAvailable: true,
  schedules: [{ id: 's1', medicineName: 'Paracetamol', dosageText: '500 mg', instructionText: 'After meals', timesOfDay: ['08:00'], startDate: '2026-10-12', endDate: '2026-10-16' }],
  checkInsEnabled: false, shareWithClinic: null,
  today: { date: '2026-10-12', doses: [{ scheduleId: 's1', medicineName: 'Paracetamol', dosageText: '500 mg', instructionText: 'After meals', scheduledFor: '2099-01-01T02:30:00.000Z', status: 'pending', snoozedUntil: null, overdue: false }], checkIn: null }, ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.api.getCareGuardMessages.mockResolvedValue({ messaging: { mode: 'included', enabled: true, note: 'We reply within a day.', clinicName: 'Demo Clinic' }, messages: [], safety: { emergency: safety.emergency, emergencyHi: safetyHi.emergency } });
  mocks.api.getDoctorPreviousCareGuardPlans.mockResolvedValue({ plans: [] });
});
afterEach(cleanup);

describe('Ask My Clinic (patient)', () => {
  it('tells the patient when the clinic has not turned messaging on, and offers no message box', async () => {
    mocks.api.getCareGuardMessages.mockResolvedValue({ messaging: { mode: 'off', enabled: false, note: null, clinicName: 'Demo Clinic' }, messages: [], safety: { emergency: 'x', emergencyHi: 'x' } });
    render(<CareGuardMessagesPanel planId="plan-1" emergency={safety.emergency} />);
    expect(await screen.findByText(/Demo Clinic has not turned on messaging/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to clinic' })).not.toBeInTheDocument();
  });

  it('sends a question and shows the clinic\'s response-time expectation', async () => {
    mocks.api.sendCareGuardMessage.mockResolvedValue({ message: {}, urgentWarning: null, urgentWarningHi: null, responseNote: 'We reply within a day.' });
    render(<CareGuardMessagesPanel planId="plan-1" emergency={safety.emergency} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Your question'), 'What does after food mean?');
    await user.click(screen.getByRole('button', { name: 'Send to clinic' }));
    expect(mocks.api.sendCareGuardMessage).toHaveBeenCalledWith('plan-1', 'What does after food mean?');
    expect(await screen.findByText(/Sent\. We reply within a day\./)).toBeInTheDocument();
  });

  it('shows an alert, not a calm confirmation, when the message may describe an emergency', async () => {
    mocks.api.sendCareGuardMessage.mockResolvedValue({ message: {}, urgentWarning: safety.emergency, urgentWarningHi: null, responseNote: 'We reply within a day.' });
    render(<CareGuardMessagesPanel planId="plan-1" emergency={safety.emergency} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Your question'), 'I have chest pain');
    await user.click(screen.getByRole('button', { name: 'Send to clinic' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('may describe an emergency');
    expect(screen.queryByText(/Sent\. We reply/)).not.toBeInTheDocument();
  });
});

describe('AI explanations', () => {
  const schedules = caregiverPlan().schedules;

  it('labels the result as AI-generated and keeps the doctor\'s original wording beside it', async () => {
    mocks.api.getCareGuardExplanation.mockResolvedValue({ language: 'en', aiGenerated: true, model: 'm', disclaimer: 'AI-generated. Not medical advice.', items: [{ scheduleId: 's1', explanation: 'Take 1 tablet after eating.' }] });
    render(<CareGuardExplanationPanel planId="plan-1" schedules={schedules} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Explain in simple English/ }));
    const block = await screen.findByLabelText('AI-generated explanation');
    expect(within(block).getByText('AI-generated · not medical advice')).toBeInTheDocument();
    expect(within(block).getByText('Take 1 tablet after eating.')).toBeInTheDocument();
    expect(within(block).getByText(/Your doctor’s original: 500 mg · After meals/)).toBeInTheDocument();
    expect(mocks.api.getCareGuardExplanation).toHaveBeenCalledWith('plan-1', 'en', undefined);
  });

  it('asks for Hindi on request and shows an error rather than guessing when the service fails', async () => {
    mocks.api.getCareGuardExplanation.mockRejectedValue(new Error('The explanation service is unavailable right now'));
    render(<CareGuardExplanationPanel planId="plan-1" schedules={schedules} grantId="g1" />);
    await userEvent.setup().click(screen.getByRole('button', { name: /सरल हिंदी में समझाएँ/ }));
    expect(await screen.findByText(/explanation service is unavailable/)).toBeInTheDocument();
    expect(mocks.api.getCareGuardExplanation).toHaveBeenCalledWith('plan-1', 'hi', 'g1');
    expect(screen.queryByLabelText('AI-generated explanation')).not.toBeInTheDocument();
  });
});

describe('Hindi safety notices', () => {
  it('switches the safety notices to Hindi without touching the doctor\'s medicine text', async () => {
    render(<MemoryRouter><PlanView plan={caregiverPlan({ viewer: 'owner', scopes: undefined, checkInsEnabled: false, shareWithClinic: false }) as never} reload={() => undefined} /></MemoryRouter>);
    expect(screen.getAllByText('Set by your doctor.').length).toBeGreaterThan(0);
    await userEvent.setup().click(screen.getByRole('button', { name: 'हिन्दी' }));
    expect(screen.getByText('यह योजना आपके डॉक्टर ने तय की है।')).toBeInTheDocument();
    expect(screen.getAllByText('500 mg').length).toBeGreaterThan(0);
  });
});

describe('Family Care Mode', () => {
  it('lets the owner pick what to share, add by Health ID, change scopes and remove access', async () => {
    const caregiver = { id: 'g1', personName: 'Rahul', personHealthId: 'OM-RAHUL', scopes: { medication: true, appointments: false, health: false }, createdAt: '2026-10-12T05:00:00Z' };
    mocks.api.getCareGuardCaregivers.mockResolvedValue({ caregivers: [caregiver] });
    mocks.api.getCareGuardCaredFor.mockResolvedValue({ people: [{ id: 'g9', personName: 'Mother', scopes: { medication: true, appointments: true, health: false } }] });
    mocks.api.addCareGuardCaregiver.mockResolvedValue({ caregiver });
    mocks.api.updateCareGuardCaregiver.mockResolvedValue({ caregiver });
    mocks.api.revokeCareGuardCaregiver.mockResolvedValue({ revoked: true });
    render(<MemoryRouter><CaregiversPage /></MemoryRouter>);
    const user = userEvent.setup();
    expect(await screen.findByText('Rahul')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mother' })).toHaveAttribute('href', '/app/careguard/for/g9');

    const form = screen.getByRole('form', { name: 'Add a caregiver' });
    await user.type(within(form).getByLabelText('Their Health ID'), 'om-new');
    await user.click(within(form).getByRole('checkbox', { name: /Health updates/ }));
    await user.click(within(form).getByRole('button', { name: 'Give access' }));
    expect(mocks.api.addCareGuardCaregiver).toHaveBeenCalledWith({ healthId: 'OM-NEW', scopeMedication: true, scopeAppointments: true, scopeHealth: true });

    const mine = screen.getByRole('region', { name: 'People who help me' });
    await user.click(within(mine).getByRole('checkbox', { name: 'Follow-up and appointment details' }));
    await user.click(within(mine).getByRole('button', { name: 'Save changes' }));
    expect(mocks.api.updateCareGuardCaregiver).toHaveBeenCalledWith('g1', { scopeMedication: true, scopeAppointments: true, scopeHealth: false });
    await user.click(within(mine).getByRole('button', { name: 'Remove access' }));
    expect(mocks.api.revokeCareGuardCaregiver).toHaveBeenCalledWith('g1');
  });

  it('does not allow giving access with nothing selected', async () => {
    mocks.api.getCareGuardCaregivers.mockResolvedValue({ caregivers: [] });
    mocks.api.getCareGuardCaredFor.mockResolvedValue({ people: [] });
    render(<MemoryRouter><CaregiversPage /></MemoryRouter>);
    const form = await screen.findByRole('form', { name: 'Add a caregiver' });
    const user = userEvent.setup();
    await user.type(within(form).getByLabelText('Their Health ID'), 'OM-NEW');
    await user.click(within(form).getByRole('checkbox', { name: /Medicine reminders/ }));
    await user.click(within(form).getByRole('checkbox', { name: /Follow-up and appointment details/ }));
    expect(within(form).getByRole('button', { name: 'Give access' })).toBeDisabled();
  });

  it('shows the caregiver view with a clear banner, can record doses, and has no sharing or messaging controls', async () => {
    mocks.api.getCareGuardCaredForPlan.mockResolvedValue({ plan: caregiverPlan() });
    mocks.api.logCareGuardCaredForDose.mockResolvedValue({ notice: null });
    render(<MemoryRouter initialEntries={['/app/careguard/for/g1/plan-1']}><Routes><Route path="/app/careguard/for/:grantId/:planId" element={<CaredForPlanPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText(/as their caregiver/)).toHaveTextContent('medicine reminders');
    expect(screen.queryByLabelText('Sharing')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ask my clinic')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Daily check-in')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Taken' }));
    expect(mocks.api.logCareGuardCaredForDose).toHaveBeenCalledWith('g1', 'plan-1', { scheduleId: 's1', scheduledFor: '2099-01-01T02:30:00.000Z', status: 'taken' });
    expect(mocks.api.logCareGuardDose).not.toHaveBeenCalled();
  });
});

describe('Clinic inbox (doctor and reception)', () => {
  const thread = { planId: 'plan-1', publicPlanId: 'OMCG-1', recipientName: 'Rahul', doctorName: 'Dr. Demo', lastMessage: { from: 'patient', preview: 'What does after food mean?', createdAt: '2026-10-12T05:00:00Z' }, lastMessageAt: '2026-10-12T05:00:00Z', unreadCount: 1, urgent: true, forwardedToDoctor: false };
  const open = { planId: 'plan-1', recipientName: 'Rahul', doctorName: 'Dr. Demo', forwardedToDoctor: false, messages: [{ id: 'm1', from: 'patient', fromLabel: 'Rahul', body: 'I have chest pain', createdAt: '2026-10-12T05:00:00Z', flaggedUrgent: true }] };

  it('flags possibly urgent messages and warns reception not to give medical advice', async () => {
    mocks.api.getCareGuardInbox.mockResolvedValue({ threads: [thread] });
    mocks.api.getCareGuardStaffThread.mockResolvedValue(open);
    render(<CareGuardInbox role="receptionist" />);
    expect(await screen.findByText('May be urgent')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open conversation with Rahul' }));
    expect(await screen.findByRole('note')).toHaveTextContent('Do not give medical advice');
    expect(screen.getByText(/May describe an emergency/)).toBeInTheDocument();
  });

  it('lets reception forward a thread to the doctor, but the doctor sees no forward button', async () => {
    mocks.api.getCareGuardInbox.mockResolvedValue({ threads: [thread] });
    mocks.api.getCareGuardStaffThread.mockResolvedValue(open);
    mocks.api.forwardCareGuardThread.mockResolvedValue({ forwardedToDoctor: true });
    const { unmount } = render(<CareGuardInbox role="receptionist" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open conversation with Rahul' }));
    await user.click(await screen.findByRole('button', { name: 'Forward to doctor' }));
    expect(mocks.api.forwardCareGuardThread).toHaveBeenCalledWith('plan-1');
    unmount();
    render(<CareGuardInbox role="doctor" />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Open conversation with Rahul' }));
    await screen.findByLabelText('Conversation with Rahul');
    expect(screen.queryByRole('button', { name: 'Forward to doctor' })).not.toBeInTheDocument();
  });

  it('sends a reply as the signed-in role', async () => {
    mocks.api.getCareGuardInbox.mockResolvedValue({ threads: [thread] });
    mocks.api.getCareGuardStaffThread.mockResolvedValue(open);
    mocks.api.replyCareGuardThread.mockResolvedValue({ message: {} });
    render(<CareGuardInbox role="doctor" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open conversation with Rahul' }));
    await user.type(await screen.findByLabelText('Reply'), 'Take it after a light meal.');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(mocks.api.replyCareGuardThread).toHaveBeenCalledWith('doctor', 'plan-1', 'Take it after a light meal.');
  });
});

describe('Receptionist CareGuard pages', () => {
  it('saves the clinic\'s messaging policy', async () => {
    mocks.api.getCareGuardClinicSettings.mockResolvedValue({ messagingMode: 'off', messagingNote: null });
    mocks.api.getCareGuardInbox.mockResolvedValue({ threads: [] });
    mocks.api.saveCareGuardClinicSettings.mockResolvedValue({ messagingMode: 'limited', messagingNote: 'Mon-Sat' });
    render(<MemoryRouter><ReceptionistMessagesPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: /Limited/ }));
    await user.type(screen.getByLabelText(/What patients should expect/), 'Mon-Sat');
    await user.click(screen.getByRole('button', { name: 'Save policy' }));
    expect(mocks.api.saveCareGuardClinicSettings).toHaveBeenCalledWith({ messagingMode: 'limited', messagingNote: 'Mon-Sat' });
  });

  it('lists follow-ups by urgency with contact details', async () => {
    mocks.api.getCareGuardFollowUps.mockResolvedValue({ today: '2026-10-12', followUps: [
      { planId: 'p1', recipientName: 'Rahul', doctorName: 'Dr. Demo', followUpDate: '2026-10-10', followUpNote: 'Review', status: 'overdue', bookedFor: null, contact: { name: 'Rahul', phone: '9999999999', email: null } },
      { planId: 'p2', recipientName: 'Asha', doctorName: 'Dr. Demo', followUpDate: '2026-10-14', followUpNote: null, status: 'booked', bookedFor: '2026-10-14T05:00:00Z', contact: { name: 'Asha', phone: null, email: 'a@example.com' } },
    ] });
    render(<MemoryRouter><ReceptionistFollowUpsPage /></MemoryRouter>);
    expect(await screen.findByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText(/9999999999/)).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(screen.getByText(/Booked for/)).toBeInTheDocument();
  });
});

describe('Doctor: earlier plans', () => {
  it('shows earlier plans, and only shows patient-reported data that was shared', async () => {
    mocks.api.getDoctorCareGuardPlan.mockResolvedValue({ plan: null });
    mocks.api.getDoctorPreviousCareGuardPlans.mockResolvedValue({ plans: [
      { planId: 'a', publicPlanId: 'OMCG-A', status: 'ended', approvedAt: '2026-07-01T05:00:00Z', clinical: { medicines: [{ id: 's', medicineName: 'Paracetamol', dosageText: null, instructionText: null, timesOfDay: ['08:00'], startDate: '2026-07-01', endDate: '2026-07-05' }], followUpDate: '2026-07-06', followUpNote: null }, patientReported: { selfReported: true, checkIns: [{ date: '2026-07-02', feeling: 'better', note: null, recordedAt: '', source: 'patient_reported' }], adherence: { scheduledSoFar: 5, taken: 4, postponed: 0, missed: 1, selfReported: true } }, sharedWithClinic: true },
      { planId: 'b', publicPlanId: 'OMCG-B', status: 'ended', approvedAt: '2026-06-01T05:00:00Z', clinical: { medicines: [], followUpDate: null, followUpNote: null }, patientReported: null, sharedWithClinic: false },
    ] });
    render(<CareGuardPlanEditor appointmentId="appt-2" medicines={[{ id: 'med-1', medicineName: 'Paracetamol', strength: null, dosage: null, route: null, frequency: null, duration: null, instructions: null, needsReview: false }]} />);
    expect(await screen.findByText(/Earlier CareGuard plans for this patient \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Reported by the patient · shared with their permission/)).toBeInTheDocument();
    expect(screen.getByText(/has not shared what they reported for this plan/)).toBeInTheDocument();
    await waitFor(() => expect(mocks.api.getDoctorPreviousCareGuardPlans).toHaveBeenCalledWith('appt-2'));
  });
});
