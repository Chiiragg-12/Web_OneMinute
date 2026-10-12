import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useDoctorContext } from '../components/DoctorLayout';
import { ApiErrorState, Button, LoadingState, SuccessMessage } from '../components/ui';
import type { DoctorPricing } from '../types/api';

const modeLabels: Record<string, string> = { in_person: 'In Person', video: 'Video', audio: 'Audio', chat: 'Chat' };
const formatMoney = (priceCents: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(priceCents / 100);
const keyFor = (item: Pick<DoctorPricing, 'consultationMode' | 'durationMinutes'>) => `${item.consultationMode}:${item.durationMinutes}`;

export function DoctorPricingPage() {
  const { clinicId } = useDoctorContext();
  const [pricing, setPricing] = useState<DoctorPricing[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    void api.getDoctorPricing(clinicId).then((result) => {
      setPricing(result.pricing);
      setDrafts(Object.fromEntries(result.pricing.map((item) => [keyFor(item), String(item.priceCents / 100)])));
      setSaved(false);
    }).catch(setError).finally(() => setLoading(false));
  };
  useEffect(load, [clinicId]);

  const dirty = useMemo(() => pricing.some((item) => drafts[keyFor(item)] !== String(item.priceCents / 100)), [pricing, drafts]);

  const save = async () => {
    setError(null);
    setSaved(false);
    const updates = pricing.map((item) => {
      const value = drafts[keyFor(item)] ?? '';
      const rupees = Number(value);
      if (value.trim() === '' || !Number.isFinite(rupees) || !Number.isInteger(rupees) || rupees < 0) throw new Error('Enter a non-negative whole rupee amount for every price.');
      return { clinicId, consultationMode: item.consultationMode, durationMinutes: item.durationMinutes, priceCents: rupees * 100 };
    });
    setSaving(true);
    try {
      const results = await Promise.allSettled(updates.map((update) => api.updateDoctorPricing(update)));
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      const confirmed = results.filter((result): result is PromiseFulfilledResult<{ pricing: DoctorPricing }> => result.status === 'fulfilled').map((result) => result.value.pricing);
      if (confirmed.length) {
        setPricing((current) => current.map((item) => confirmed.find((next) => next.id === item.id) ?? item));
        setDrafts((current) => ({ ...current, ...Object.fromEntries(confirmed.map((item) => [keyFor(item), String(item.priceCents / 100)])) }));
      }
      if (failures.length) throw failures[0].reason;
      setSaved(true);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading pricing" />;
  return <div><div className="eyebrow">Doctor settings</div><h1 className="page-title">Pricing</h1><p className="page-lead">Set your consultation prices in rupees. Changes are applied when you save.</p>{error ? <div className="mt-5"><ApiErrorState error={error} onRetry={load} /></div> : null}{saved && <div className="mt-5"><SuccessMessage>Pricing updated.</SuccessMessage></div>}<section className="surface mt-8"><div className="divide-y divide-slate-100">{pricing.map((item) => { const key = keyFor(item); return <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={key}><div><strong className="font-display">{modeLabels[item.consultationMode]}</strong><p className="text-sm text-slate-500">{item.durationMinutes} minutes</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold text-slate-700">{formatMoney(item.priceCents)}</span><label className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-500">₹</span><input className="field w-32" type="number" min="0" step="1" value={drafts[key] ?? ''} aria-label={`${item.consultationMode} ${item.durationMinutes} price in rupees`} onChange={(event) => { setSaved(false); setDrafts((current) => ({ ...current, [key]: event.target.value })); }} /></label></div></div>; })}</div><div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><Button disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Changes'}</Button></div></section></div>;
}
