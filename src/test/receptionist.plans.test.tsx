import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceptionistLayout } from '../components/ReceptionistLayout';
import { ReceptionistPlansPage } from '../pages/ReceptionistPlansPage';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  updateReceptionist: vi.fn(),
  api: { getSubscription: vi.fn() },
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('../api/client', () => ({ api: mocks.api }));

const plans = [
  { id: '3m', label: '3 months', months: 3, amountCents: 199_900 },
  { id: '6m', label: '6 months', months: 6, amountCents: 349_900 },
  { id: '12m', label: '12 months', months: 12, amountCents: 599_900 },
];
const expired = { status: 'expired', trialStartedAt: null, trialEndsAt: '2026-09-01T00:00:00.000Z', daysRemaining: 0, subscriptionEndsAt: null };
const active = { status: 'active', trialStartedAt: null, trialEndsAt: null, daysRemaining: null, subscriptionEndsAt: '2027-01-10T00:00:00.000Z' };

function authWith(trial: unknown, clinicExtra: Record<string, unknown> = {}) {
  mocks.useAuth.mockReturnValue({
    state: { status: 'authenticated', user: { id: 'u1', role: 'receptionist' }, patient: null, doctor: null, receptionist: { id: 'r1', fullName: 'Reception A', clinic: { id: 'c1', name: 'Demo Clinic', isActive: true, trial, ...clinicExtra } } },
    logout: vi.fn(),
    updateReceptionist: mocks.updateReceptionist,
  });
}

beforeEach(() => { vi.clearAllMocks(); authWith(expired); });
afterEach(cleanup);

describe('Receptionist subscription plans', () => {
  it('shows the three plans with their prices once the free month has ended', async () => {
    mocks.api.getSubscription.mockResolvedValue({ plans, currency: 'INR', trial: expired });
    render(<MemoryRouter><ReceptionistPlansPage /></MemoryRouter>);
    expect(await screen.findByText('Your free month has ended')).toBeInTheDocument();
    expect(screen.getByText('₹1,999')).toBeInTheDocument();
    expect(screen.getByText('₹3,499')).toBeInTheDocument();
    expect(screen.getByText('₹5,999')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Subscribe' })).toHaveLength(3);
  });

  it('shows the UPI QR, the exact amount and the clinic ID after choosing a plan, without any online checkout', async () => {
    mocks.api.getSubscription.mockResolvedValue({ plans, currency: 'INR', trial: expired });
    authWith(expired, { publicClinicId: 'OMC-TEST1234' });
    render(<MemoryRouter><ReceptionistPlansPage /></MemoryRouter>);
    expect(screen.queryByRole('img', { name: /UPI QR/ })).not.toBeInTheDocument();
    await userEvent.setup().click((await screen.findAllByRole('button', { name: 'Subscribe' }))[1]);
    expect(screen.getByRole('img', { name: /UPI QR/ })).toBeInTheDocument();
    expect(screen.getByText(/6 months plan/)).toBeInTheDocument();
    expect(screen.getAllByText('₹3,499').length).toBeGreaterThan(0);
    expect(screen.getByText('OMC-TEST1234')).toBeInTheDocument();
    expect(screen.getByText(/starts after OneMinute confirms the payment/)).toBeInTheDocument();
    expect(screen.queryByText(/Razorpay/)).not.toBeInTheDocument();
  });
});

describe('Receptionist layout with an expired trial', () => {
  const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/receptionist" element={<ReceptionistLayout />}><Route index element={<div>Overview page</div>} /><Route path="queue" element={<div>Queue page</div>} /><Route path="plans" element={<div>Plans page</div>} /></Route></Routes></MemoryRouter>);

  it('sends the receptionist to the plans page from any other page', async () => {
    renderAt('/receptionist/queue');
    expect(await screen.findByText('Plans page')).toBeInTheDocument();
    expect(screen.queryByText('Queue page')).not.toBeInTheDocument();
  });

  it('does not redirect while the trial is still running', async () => {
    authWith({ ...expired, status: 'trial', daysRemaining: 5 });
    renderAt('/receptionist/queue');
    expect(await screen.findByText('Queue page')).toBeInTheDocument();
  });

  it('does not redirect an active subscription', async () => {
    authWith(active);
    renderAt('/receptionist/queue');
    expect(await screen.findByText('Queue page')).toBeInTheDocument();
  });
});
