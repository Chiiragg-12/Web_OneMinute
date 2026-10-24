import { useCallback, useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import paymentQr from '../assets/phonepe-qr.jpg';
import type { SubscriptionOverview, SubscriptionPlan } from '../types/api';
import { ApiErrorState, Button, LoadingState } from '../components/ui';

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

const PAYEE_NAME = 'CHIRAG MAHOUR';

export function ReceptionistPlansPage() {
  const { state } = useAuth();
  const clinic = state.status === 'authenticated' ? state.receptionist?.clinic : null;
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null);

  const load = useCallback(() => {
    setError(null);
    void api.getSubscription().then(setOverview).catch(setError);
  }, []);
  useEffect(load, [load]);

  if (!overview && !error) return <LoadingState label="Loading plans" />;
  if (!overview) return <ApiErrorState error={error} onRetry={load} />;
  return (
    <div>
      <Heading overview={overview} />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {overview.plans.map((plan) => (
          <section className={`surface flex flex-col ${selected?.id === plan.id ? 'ring-2 ring-teal-600' : ''}`} key={plan.id} aria-label={`${plan.label} plan`}>
            <p className="label">{plan.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{rupees(plan.amountCents)}</p>
            <p className="mt-1 text-sm text-slate-500">about {rupees(Math.round(plan.amountCents / plan.months))} per month</p>
            <Button className="button button-primary mt-6" type="button" onClick={() => setSelected(plan)}>
              <QrCode size={17} />{overview.trial.status === 'active' ? 'Renew' : 'Subscribe'}
            </Button>
          </section>
        ))}
      </div>

      {selected ? (
        <section className="surface mt-6 grid gap-6 sm:grid-cols-[auto_1fr]" aria-label="Pay by UPI QR">
          <img src={paymentQr} alt="PhonePe UPI QR code to pay OneMinute Healthcare" className="mx-auto w-56 rounded-2xl border border-slate-200" />
          <div>
            <p className="label">Pay by UPI</p>
            <h2 className="section-title">{selected.label} plan · {rupees(selected.amountCents)}</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Scan the QR code with PhonePe or any UPI app. It pays <strong>{PAYEE_NAME}</strong>.</li>
              <li>Pay exactly <strong>{rupees(selected.amountCents)}</strong>.</li>
              <li>In the payment note write your Clinic ID{clinic?.publicClinicId ? <>: <strong>{clinic.publicClinicId}</strong></> : null}.</li>
              <li>Send the payment screenshot, or the UPI transaction ID, to OneMinute support together with your Clinic ID.</li>
            </ol>
            <p className="mt-4 text-sm text-slate-500">Your plan starts after OneMinute confirms the payment. This is not instant, and the dashboard will not change until then.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
