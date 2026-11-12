import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { HeartHandshake, RefreshCw, ShieldCheck } from 'lucide-react';
import { ApiErrorState, Button, LoadingState, SuccessMessage } from '../../components/ui';
import { companionAdmin } from './api';
import { statusLabel } from './types';

export function useCompanionData<T>(path: string, pollMs = 0) {
  const [data, setData] = useState<T>(); const [error, setError] = useState<unknown>(); const [loading, setLoading] = useState(true); const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let pending = false;
    setData(undefined); setLoading(true); setError(undefined);
    const load = async () => {
      if (pending) return; pending = true;
      try { const result = await companionAdmin.get<T>(path, controller.signal); if (!controller.signal.aborted) { setData(result); setError(undefined); } }
      catch (cause) { if (!controller.signal.aborted) setError(cause); }
      finally { if (!controller.signal.aborted) setLoading(false); pending = false; }
    };
    void load(); const interval = pollMs ? setInterval(() => { if (document.visibilityState === 'visible') void load(); }, pollMs) : undefined;
    return () => { controller.abort(); if (interval) clearInterval(interval); };
  }, [path, version, pollMs]);
  return { data, error, loading, refresh: () => setVersion(v => v + 1) };
}
export function Resource({ resource, children }: { resource: { loading: boolean; error: unknown; data: unknown; refresh: () => void }; children: ReactNode }) {
  return <>{resource.error ? <ApiErrorState error={resource.error} onRetry={resource.refresh} /> : null}{resource.loading ? <LoadingState label="Loading companion service…" /> : resource.data ? children : null}</>;
}
export function Status({ value }: { value: string }) {
  const tone = ['approved', 'completed', 'paid', 'processed', 'resolved'].includes(value) ? 'success' : ['rejected', 'suspended', 'failed', 'cancelled', 'expired', 'unfulfilled', 'open'].includes(value) ? 'danger' : 'warning';
  return <span className={`status status-${tone}`}>{statusLabel(value)}</span>;
}
export function ActionForm({ title, children, submitLabel, onSubmit, onSuccess, danger = false }: { title: string; children?: ReactNode; submitLabel: string; onSubmit: (form: FormData) => Promise<unknown>; onSuccess: () => void; danger?: boolean }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(); const [done, setDone] = useState(false); const locked = useRef(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError(undefined); setDone(false);
    const form = e.currentTarget;
    try { await onSubmit(new FormData(form)); setDone(true); onSuccess(); }
    catch (cause) { setError(cause); }
    finally { locked.current = false; setBusy(false); }
  };
  return <form onSubmit={e => void submit(e)} className="surface companion-action"><h3 className="font-display text-lg font-semibold">{title}</h3>{children}{error ? <ApiErrorState error={error} /> : null}{done ? <SuccessMessage>Saved successfully.</SuccessMessage> : null}<Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button></form>;
}
export function TextField({ label, name, type = 'text', required = true, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input className="field mt-2" name={name} type={type} required={required} {...props} /></label>;
}
export function SelectField({ label, name, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<select className="field mt-2" name={name} required {...props}>{children}</select></label>;
}
export function Notes({ label = 'Reason', name = 'reason' }: { label?: string; name?: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<textarea className="field mt-2" name={name} required maxLength={2000} rows={3} /></label>;
}
export const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
export function Paging({ page, setPage, count }: { page: number; setPage: (value: number) => void; count: number }) {
  return <div className="flex items-center justify-between gap-3 py-4"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm text-slate-500">Page {page}</span><Button variant="outline" disabled={count < 25} onClick={() => setPage(page + 1)}>Next</Button></div>;
}
export function CompanionLayout() {
  const tabs = [['', 'Overview'], ['/bookings', 'Bookings'], ['/people', 'Companions'], ['/safety', 'Safety & complaints'], ['/finance', 'Payments & payouts'], ['/pricing', 'Pricing & coverage']];
  return <div className="companion-workspace"><header className="companion-heading"><div className="companion-emblem"><HeartHandshake size={28} /></div><div><p className="eyebrow">OneMinute care services</p><h1 className="font-display text-3xl font-semibold">Senior Companion</h1><p className="mt-2 text-sm text-slate-500">Trusted support, from home to hospital and safely back.</p></div><span className="companion-trust"><ShieldCheck size={16} /> Verification required</span></header><nav className="companion-tabs" aria-label="Companion Service">{tabs.map(([path, label]) => <NavLink key={label} to={`/admin/companions${path}`} end={!path}>{label}</NavLink>)}</nav><Outlet /></div>;
}
export function PageTitle({ title, description, refresh }: { title: string; description: string; refresh?: () => void }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="section-title">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p></div>{refresh ? <Button variant="outline" onClick={refresh}><RefreshCw size={15} />Refresh</Button> : null}</div>;
}
