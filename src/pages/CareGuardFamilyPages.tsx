import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import type { CareGuardCaredFor, CareGuardCaregiver, CareGuardPlanDetail, CareGuardPlanSummary, CareGuardScopes } from '../types/api';
import { ApiErrorState, Button, EmptyState, LoadingState } from '../components/ui';
import { PlanView } from './CareGuardPages';

type ScopeFlags = Record<'scopeMedication' | 'scopeAppointments' | 'scopeHealth', boolean>;
const scopeLabels: { key: keyof ScopeFlags; label: string; hint: string }[] = [
  { key: 'scopeMedication', label: 'Medicine reminders', hint: 'See today’s doses and mark them taken, postponed or missed.' },
  { key: 'scopeAppointments', label: 'Follow-up and appointment details', hint: 'See the follow-up date and book it.' },
  { key: 'scopeHealth', label: 'Health updates', hint: 'See the daily “how are you feeling” check-ins (read only).' },
];
const toFlags = (scopes: CareGuardScopes): ScopeFlags => ({ scopeMedication: scopes.medication, scopeAppointments: scopes.appointments, scopeHealth: scopes.health });
const dateLabel = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso));

// ---------------------------------------------------------------------------
// The owner: who helps me, and with what
// ---------------------------------------------------------------------------
export function CaregiversPage() {
  const [caregivers, setCaregivers] = useState<CareGuardCaregiver[] | null>(null);
  const [caredFor, setCaredFor] = useState<CareGuardCaredFor[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [healthId, setHealthId] = useState('');
  const [flags, setFlags] = useState<ScopeFlags>({ scopeMedication: true, scopeAppointments: true, scopeHealth: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    void api.getCareGuardCaregivers().then((result) => setCaregivers(result.caregivers)).catch(setError);
    void api.getCareGuardCaredFor().then((result) => setCaredFor(result.people)).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const run = async (work: () => Promise<unknown>) => { setBusy(true); setError(null); try { await work(); load(); } catch (nextError) { setError(nextError); } finally { setBusy(false); } };
  const noScope = !flags.scopeMedication && !flags.scopeAppointments && !flags.scopeHealth;

  if (!caregivers && !error) return <LoadingState label="Loading caregivers" />;
  return (
    <div>
      <Link className="back-link" to="/app/careguard"><ArrowLeft size={16} />My CareGuard Plan</Link>
      <div className="eyebrow mt-6">Family Care Mode</div>
      <h1 className="page-title">Family & caregivers</h1>
      <p className="page-lead">Let a trusted person with their own OneMinute account help you follow your plan. You choose what they can see, and you can stop at any time.</p>
      {error ? <div className="mt-5"><ApiErrorState error={error} /></div> : null}

      <section className="surface mt-8" aria-label="People who help me">
        <h2 className="section-title">People who help me</h2>
        {caregivers && caregivers.length === 0 && <p className="mt-3 text-sm text-slate-500">Nobody has access to your plans.</p>}
        <ul className="mt-4 grid gap-4">
          {caregivers?.map((caregiver) => <CaregiverRow key={caregiver.id} caregiver={caregiver} busy={busy} onSave={(next) => run(() => api.updateCareGuardCaregiver(caregiver.id, next))} onRevoke={() => run(() => api.revokeCareGuardCaregiver(caregiver.id))} />)}
        </ul>
      </section>

      <form className="surface mt-8" aria-label="Add a caregiver" onSubmit={(event) => { event.preventDefault(); void run(async () => { await api.addCareGuardCaregiver({ healthId: healthId.trim(), ...flags }); setHealthId(''); }); }}>
        <h2 className="section-title">Add a caregiver</h2>
        <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold text-slate-700">Their Health ID</span><input className="field" value={healthId} onChange={(event) => setHealthId(event.target.value.toUpperCase())} placeholder="OM-XXXXXXXXXX" /></label>
        <fieldset className="mt-4 grid gap-2"><legend className="mb-1 text-sm font-semibold text-slate-700">What they can see</legend>
          {scopeLabels.map(({ key, label, hint }) => <label className="flex items-start gap-2 text-sm" key={key}><input type="checkbox" className="mt-1" checked={flags[key]} onChange={(event) => setFlags((current) => ({ ...current, [key]: event.target.checked }))} /><span><strong>{label}</strong><span className="block text-slate-500">{hint}</span></span></label>)}
        </fieldset>
        <p className="mt-3 text-xs text-slate-500">They will only ever see your CareGuard plans, never your other records.</p>
        <div className="mt-4"><Button type="submit" disabled={busy || noScope || healthId.trim().length < 3}>Give access</Button></div>
      </form>

      <section className="surface mt-8" aria-label="People I help">
        <h2 className="section-title">People I help</h2>
        {caredFor.length === 0 && <p className="mt-3 text-sm text-slate-500">Nobody has shared their plan with you.</p>}
        <ul className="mt-4 grid gap-3">
          {caredFor.map((person) => (
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3" key={person.id}>
              <Link className="font-semibold text-teal-800 underline" to={`/app/careguard/for/${person.id}`}>{person.personName}</Link>
              <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(() => api.leaveCareGuardCaredFor(person.id))}>Stop helping</Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CaregiverRow({ caregiver, busy, onSave, onRevoke }: { caregiver: CareGuardCaregiver; busy: boolean; onSave: (flags: ScopeFlags) => Promise<void>; onRevoke: () => Promise<void> }) {
  const [flags, setFlags] = useState<ScopeFlags>(toFlags(caregiver.scopes));
  const changed = JSON.stringify(flags) !== JSON.stringify(toFlags(caregiver.scopes));
  const none = !flags.scopeMedication && !flags.scopeAppointments && !flags.scopeHealth;
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-semibold">{caregiver.personName} <span className="font-normal text-slate-500">· {caregiver.personHealthId}</span></p>
      <p className="text-xs text-slate-500">Added {dateLabel(caregiver.createdAt)}</p>
      <div className="mt-3 grid gap-2">
        {scopeLabels.map(({ key, label }) => <label className="flex items-center gap-2 text-sm" key={key}><input type="checkbox" checked={flags[key]} onChange={(event) => setFlags((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || !changed || none} onClick={() => void onSave(flags)}>Save changes</Button>
        <Button type="button" variant="danger" disabled={busy} onClick={() => void onRevoke()}>Remove access</Button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The caregiver: the plans someone shared with me
// ---------------------------------------------------------------------------
export function CaredForPlansPage() {
  const { grantId = '' } = useParams();
  const [data, setData] = useState<{ person: { id: string; name: string; scopes: CareGuardScopes }; plans: CareGuardPlanSummary[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { setError(null); void api.getCareGuardCaredForPlans(grantId).then(setData).catch(setError); }, [grantId]);
  useEffect(load, [load]);
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading shared plans" />;
  return (
    <div>
      <Link className="back-link" to="/app/careguard"><ArrowLeft size={16} />My CareGuard Plan</Link>
      <div className="eyebrow mt-6">Caregiver view</div>
      <h1 className="page-title">{data.person.name}</h1>
      <p className="page-lead">Plans {data.person.name} has shared with you.</p>
      {data.plans.length === 0 && <div className="mt-8"><EmptyState title="No plans to show" message="They have no CareGuard plan right now." /></div>}
      <div className="mt-6 grid gap-4">
        {data.plans.map((plan) => (
          <Link key={plan.id} className="action-card" to={`/app/careguard/for/${grantId}/${plan.id}`}>
            <span className="min-w-0"><strong>{plan.doctorName} · {plan.clinicName}</strong>
              <span className="block text-sm text-slate-600">{data.person.scopes.medication ? `${plan.medicineCount} medicine${plan.medicineCount === 1 ? '' : 's'}` : 'Medicine details are not shared'}{plan.active && plan.today && data.person.scopes.medication ? ` · ${plan.today.pendingDoses} of ${plan.today.totalDoses} doses still to record today` : ''}</span></span>
            <span className="status-badge">{plan.active ? 'Active' : 'Ended'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CaredForPlanPage() {
  const { grantId = '', planId = '' } = useParams();
  const [plan, setPlan] = useState<CareGuardPlanDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { setError(null); void api.getCareGuardCaredForPlan(grantId, planId).then((result) => setPlan(result.plan)).catch(setError); }, [grantId, planId]);
  useEffect(load, [load]);
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!plan) return <LoadingState label="Loading shared plan" />;
  return <PlanView plan={plan} reload={load} grantId={grantId} />;
}
