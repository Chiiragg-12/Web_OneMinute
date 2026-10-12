import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { SubscriptionOverview, SubscriptionPlan } from '../types/api';
import { ApiErrorState, Button, LoadingState } from '../components/ui';
import { openRazorpayCheckout } from '../utils/razorpay';

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const dateLabel = (value: string | null | undefined) => (value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(value)) : '');

function Heading({ overview }: { overview: SubscriptionOverview }) {
  const { trial } = overview;
  if (trial.status === 'expired') {
    return <><div className="eyebrow">Subscription</div><h1 className="page-title">Your free month has ended</h1><p className="page-lead">Choose a plan to keep using OneMinute for your clinic.</p></>;
  }
  if (trial.status === 'active') {
    return <><div className="eyebrow">Subscription</div><h1 className="page-title">Your plan is active</h1><p className="page-lead">Active until {dateLabel(trial.subscriptionEndsAt)}. You can renew early; the new period starts when this one ends.</p></>;
  }
  const days = trial.daysRemaining ?? 0;
  return <><div className="eyebrow">Subscription</div><h1 className="page-title">Plans</h1><p className="page-lead">Your first month is free, {days} day{days === 1 ? '' : 's'} left. These plans start after the free month ends ({dateLabel(trial.trialEndsAt)}).</p></>;
}

export function ReceptionistPlansPage() {
  const { updateReceptionist } = useAuth();
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    setError(null);
    void api.getSubscription().then(setOverview).catch(setError);
  }, []);
  useEffect(load, [load]);

  const subscribe = async (plan: SubscriptionPlan) => {
    setBusyPlan(plan.id); setMessage(''); setError(null);
    try {
      const order = await api.createSubscriptionOrder(plan.id);
      const paid = await openRazorpayCheckout({ keyId: order.keyId, orderId: order.orderId, amount: order.amount, currency: order.currency, name: 'OneMinute Healthcare', description: `${plan.label} subscription` });
      const next = await api.verifySubscriptionPayment({ razorpayPaymentId: paid.razorpay_payment_id, razorpayOrderId: paid.razorpay_order_id, razorpaySignature: paid.razorpay_signature });
      setOverview(next);
      setMessage('Payment received. Your plan is active.');
      // Refresh the session profile so the rest of the dashboard stops treating the clinic as expired.
      const profile = await api.getReceptionistProfile();
      updateReceptionist(profile.receptionist);
    } catch (nextError) {
      // Closing the Razorpay window is a normal outcome, not an error screen.
      if (nextError instanceof Error && nextError.message === 'Razorpay Checkout was closed') setMessage('Payment cancelled. No charge was made.');
      else setError(nextError instanceof Error ? nextError : new Error('Payment could not be completed'));
    } finally {
      setBusyPlan(null);
    }
  };

  if (!overview && !error) return <LoadingState label="Loading plans" />;
  if (!overview) return <ApiErrorState error={error} onRetry={load} />;
  return (
    <div>
      <Heading overview={overview} />
      {message && <p className="mt-5 text-sm font-semibold text-emerald-700" role="status">{message}</p>}
      {error ? <div className="mt-5"><ApiErrorState error={error} /></div> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {overview.plans.map((plan) => (
          <section className="surface flex flex-col" key={plan.id} aria-label={`${plan.label} plan`}>
            <p className="label">{plan.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{rupees(plan.amountCents)}</p>
            <p className="mt-1 text-sm text-slate-500">about {rupees(Math.round(plan.amountCents / plan.months))} per month</p>
            <Button className="button button-primary mt-6" type="button" disabled={busyPlan !== null} onClick={() => void subscribe(plan)}>
              {busyPlan === plan.id ? 'Opening payment…' : overview.trial.status === 'active' ? 'Renew' : 'Subscribe'}
            </Button>
          </section>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-500">Payments are processed by Razorpay.</p>
    </div>
  );
}
