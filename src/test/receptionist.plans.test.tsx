import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceptionistLayout } from '../components/ReceptionistLayout';
import { ReceptionistPlansPage } from '../pages/ReceptionistPlansPage';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  updateReceptionist: vi.fn(),
  checkout: vi.fn(),
  api: { getSubscription: vi.fn(), createSubscriptionOrder: vi.fn(), verifySubscriptionPayment: vi.fn(), getReceptionistProfile: vi.fn() },
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('../api/client', () => ({ api: mocks.api }));
vi.mock('../utils/razorpay', () => ({ openRazorpayCheckout: mocks.checkout }));

const plans = [
  { id: '3m', label: '3 months', months: 3, amountCents: 199_900 },
  { id: '6m', label: '6 months', months: 6, amountCents: 349_900 },
  { id: '12m', label: '12 months', months: 12, amountCents: 599_900 },
];
const expired = { status: 'expired', trialStartedAt: null, trialEndsAt: '2026-09-01T00:00:00.000Z', daysRemaining: 0, subscriptionEndsAt: null };
const active = { status: 'active', trialStartedAt: null, trialEndsAt: null, daysRemaining: null, subscriptionEndsAt: '2027-01-10T00:00:00.000Z' };

function authWith(trial: unknown) {
  mocks.useAuth.mockReturnValue({
    state: { status: 'authenticated', user: { id: 'u1', role: 'receptionist' }, patient: null, doctor: null, receptionist: { id: 'r1', fullName: 'Reception A', clinic: { id: 'c1', name: 'Demo Clinic', isActive: true, trial } } },
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

  it('creates an order, opens checkout, verifies the payment and refreshes the session', async () => {
    mocks.api.getSubscription.mockResolvedValue({ plans, currency: 'INR', trial: expired });
    mocks.api.createSubscriptionOrder.mockResolvedValue({ keyId: 'rzp_test_x', orderId: 'order_1', amount: 349_900, currency: 'INR', plan: plans[1] });
    mocks.checkout.mockResolvedValue({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig' });
    mocks.api.verifySubscriptionPayment.mockResolvedValue({ plans, currency: 'INR', trial: active });
    mocks.api.getReceptionistProfile.mockResolvedValue({ receptionist: { id: 'r1' } });
    render(<MemoryRouter><ReceptionistPlansPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole('button', { name: 'Subscribe' }))[1]);
    await waitFor(() => expect(mocks.api.verifySubscriptionPayment).toHaveBeenCalledWith({ razorpayPaymentId: 'pay_1', razorpayOrderId: 'order_1', razorpaySignature: 'sig' }));
    expect(mocks.api.createSubscriptionOrder).toHaveBeenCalledWith('6m');
    await waitFor(() => expect(mocks.updateReceptionist).toHaveBeenCalledWith({ id: 'r1' }));
    expect(await screen.findByText('Your plan is active')).toBeInTheDocument();
  });

  it('treats closing the checkout window as a cancellation, not an error', async () => {
    mocks.api.getSubscription.mockResolvedValue({ plans, currency: 'INR', trial: expired });
    mocks.api.createSubscriptionOrder.mockResolvedValue({ keyId: 'rzp_test_x', orderId: 'order_1', amount: 199_900, currency: 'INR', plan: plans[0] });
    mocks.checkout.mockRejectedValue(new Error('Razorpay Checkout was closed'));
    render(<MemoryRouter><ReceptionistPlansPage /></MemoryRouter>);
    await userEvent.setup().click((await screen.findAllByRole('button', { name: 'Subscribe' }))[0]);
    expect(await screen.findByText('Payment cancelled. No charge was made.')).toBeInTheDocument();
    expect(mocks.api.verifySubscriptionPayment).not.toHaveBeenCalled();
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
