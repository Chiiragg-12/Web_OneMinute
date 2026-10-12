import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareGuardInbox } from '../components/CareGuardInbox';
import { ReceptionistFollowUpsPage, ReceptionistMessagesPage } from '../pages/CareGuardClinicPages';

const mocks = vi.hoisted(() => ({
  api: {
    getCareGuardInbox: vi.fn(), getCareGuardStaffThread: vi.fn(), replyCareGuardThread: vi.fn(), forwardCareGuardThread: vi.fn(),
    getCareGuardClinicSettings: vi.fn(), saveCareGuardClinicSettings: vi.fn(), getCareGuardFollowUps: vi.fn(),
  },
}));
vi.mock('../api/client', () => ({ api: mocks.api, ApiError: class ApiError extends Error { status = 0; } }));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

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
