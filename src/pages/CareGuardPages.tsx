import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Bell, CalendarClock, Pill } from 'lucide-react';
import { api } from '../api/client';
import type { CareGuardDose, CareGuardFeeling, CareGuardHistoryEntry, CareGuardPlanDetail, CareGuardPlanSummary } from '../types/api';
import { ApiErrorState, Button, EmptyState, LoadingState } from '../components/ui';
import { CareGuardExplanationPanel } from '../components/CareGuardExplanationPanel';
import { CareGuardMessagesPanel } from '../components/CareGuardMessagesPanel';
import { notifyRemindersChanged, remindersSupported, reminderPermission, requestReminderPermission, syncCareGuardReminders } from '../utils/careguardReminders';
import type { ReminderPermission } from '../utils/careguardReminders';

const feelingLabels: Record<CareGuardFeeling, string> = { better: 'Better', same: 'About the same', worse: 'Worse' };
const stateLabels: Record<CareGuardDose['status'], string> = { pending: 'Not recorded', taken: 'Taken', postponed: 'Remind me later', missed: 'Missed' };

const timeLabel = (iso: string, timeZone: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const hhmmLabel = (time: string) => { const [h, m] = time.split(':').map(Number); return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, m))); };

function EmergencyNotice({ text }: { text: string }) {
  return <div className="mt-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="note"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={18} /><p>{text}</p></div>;
}

function followUpText(plan: Pick<CareGuardPlanSummary, 'followUp'>) {
  const followUp = plan.followUp;
  if (!followUp) return null;
  if (followUp.daysUntil < 0) return `Follow-up was due on ${dateLabel(followUp.date)}`;
  if (followUp.daysUntil === 0) return 'Follow-up is due today';
  return `Follow-up on ${dateLabel(followUp.date)} (in ${followUp.daysUntil} day${followUp.daysUntil === 1 ? '' : 's'})`;
}

const dismissKey = (planId: string, date: string) => `oneminute:careguard-followup-dismissed:${planId}:${date}`;
function readDismissed(key: string) { try { return localStorage.getItem(key) === '1'; } catch { return false; } }
function writeDismissed(key: string) { try { localStorage.setItem(key, '1'); } catch { /* storage unavailable: dismissal just won't persist */ } }

// ---------------------------------------------------------------------------
// In-app reminders. They fire while the app is open; there is no background
// push yet, and the page says so.
// ---------------------------------------------------------------------------
function useDueDoses(doses: CareGuardDose[], enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  const due = useMemo(() => doses.filter((dose) => {
    if (dose.status === 'pending') return new Date(dose.scheduledFor).getTime() <= now;
    if (dose.status === 'postponed') return dose.snoozedUntil !== null && new Date(dose.snoozedUntil).getTime() <= now;
    return false;
  }), [doses, now]);
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    for (const dose of due) {
      const key = `${dose.scheduleId}|${dose.scheduledFor}|${dose.status}|${dose.snoozedUntil ?? ''}`;
      if (notified.current.has(key)) continue;
      notified.current.add(key);
      try { new Notification(`Time for ${dose.medicineName}`, { body: [dose.dosageText, dose.instructionText].filter(Boolean).join(' · ') || 'As prescribed by your doctor' }); } catch { /* some WebViews block the constructor */ }
    }
  }, [due]);
  return due;
}

function PhoneReminders() {
  const [permission, setPermission] = useState<ReminderPermission>('unsupported');
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void reminderPermission().then(setPermission).catch(() => undefined); }, []);
  const enable = async () => {
    setError('');
    try {
      const next = await requestReminderPermission();
      setPermission(next);
      if (next === 'granted') setScheduled((await syncCareGuardReminders())?.scheduled ?? 0);
    } catch { setError('Could not turn on phone reminders. Please try again.'); }
  };
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <Bell size={18} className="text-teal-700" />
      <p className="min-w-0 flex-1 text-slate-600">
        Phone reminders arrive even when OneMinute is closed, for the next few days of your plan. Android may deliver them a few minutes late, so keep your doctor’s schedule handy.
      </p>
      {permission === 'prompt' && <Button variant="outline" type="button" onClick={() => void enable()}>Turn on phone reminders</Button>}
      {permission === 'granted' && <span className="font-semibold text-emerald-700">Phone reminders on{scheduled !== null ? ` (${scheduled} scheduled)` : ''}</span>}
      {permission === 'denied' && <span className="text-slate-500">Notifications are blocked in your phone settings</span>}
      {error && <span className="text-rose-700" role="alert">{error}</span>}
    </div>
  );
}

function ReminderControls() {
  if (remindersSupported()) return <PhoneReminders />;
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState<string>(supported ? Notification.permission : 'unsupported');
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <Bell size={18} className="text-teal-700" />
      <p className="min-w-0 flex-1 text-slate-600">
        Reminders appear here while OneMinute is open on your phone. Reminders when the app is closed are not available yet, so keep your doctor’s schedule handy.
      </p>
      {supported && permission === 'default' && <Button variant="outline" type="button" onClick={() => void Notification.requestPermission().then(setPermission)}>Allow notifications</Button>}
      {supported && permission === 'granted' && <span className="font-semibold text-emerald-700">Notifications on</span>}
      {supported && permission === 'denied' && <span className="text-slate-500">Notifications are blocked in your browser settings</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home: list of plans
// ---------------------------------------------------------------------------
export function CareGuardHomePage() {
  const [data, setData] = useState<(Awaited<ReturnType<typeof api.getCareGuardPlans>> & { people: Awaited<ReturnType<typeof api.getCareGuardCaredFor>>['people'] }) | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => {
    setError(null);
    // The caregiver list is a bonus; the page still works if it fails.
    void Promise.all([api.getCareGuardPlans(), api.getCareGuardCaredFor().catch(() => ({ people: [] }))]).then(([plans, caredFor]) => setData({ ...plans, people: caredFor.people })).catch(setError);
  }, []);
  useEffect(load, [load]);
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading your CareGuard plans" />;
  const { plans, safety } = data;
  const current = plans.filter((plan) => plan.active);
  const past = plans.filter((plan) => !plan.active);
  return (
    <div>
      <div className="eyebrow">CareGuard</div>
      <h1 className="page-title">My CareGuard Plan</h1>
      <p className="page-lead">Medicine reminders, daily check-ins and follow-ups, set by your doctor after a visit.</p>
      <EmergencyNotice text={safety.emergency} />
      <div className="mt-6 flex flex-wrap gap-3"><Link className="button button-outline" to="/app/careguard/history">Recovery history</Link><Link className="button button-outline" to="/app/careguard/caregivers">Family & caregivers</Link></div>
      {data.people.length > 0 && <section className="mt-6" aria-label="People I help"><h2 className="section-title">People I help</h2><div className="mt-3 grid gap-3">{data.people.map((person) => <Link key={person.id} className="action-card" to={`/app/careguard/for/${person.id}`}><span><strong>{person.personName}</strong><span className="block text-sm text-slate-500">Shared with you as a caregiver</span></span></Link>)}</div></section>}
      {plans.length === 0 && <div className="mt-8"><EmptyState title="No CareGuard plan yet" message="When your doctor approves a care plan after a visit, it will appear here." icon={Pill} /></div>}
      {current.length > 0 && <h2 className="section-title mt-8">Current plans</h2>}
      <div className="mt-4 grid gap-4">{current.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</div>
      {past.length > 0 && <h2 className="section-title mt-8">Earlier plans</h2>}
      <div className="mt-4 grid gap-4">{past.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</div>
      <p className="mt-8 text-xs text-slate-500">{safety.selfReported}</p>
    </div>
  );
}

function PlanCard({ plan }: { plan: CareGuardPlanSummary }) {
  const followUp = followUpText(plan);
  return (
    <Link to={`/app/careguard/${plan.id}`} className="action-card" aria-label={`Open plan for ${plan.recipientName}`}>
      <span className="min-w-0">
        <strong>{plan.recipientName}</strong>
        <span className="block text-sm text-slate-500">{plan.doctorName} · {plan.clinicName}</span>
        <span className="mt-1 block text-sm text-slate-600">{plan.medicineCount} medicine{plan.medicineCount === 1 ? '' : 's'}{plan.active && plan.today ? ` · ${plan.today.pendingDoses} of ${plan.today.totalDoses} dose${plan.today.totalDoses === 1 ? '' : 's'} still to record today` : ''}</span>
        {followUp && <span className="mt-1 flex items-center gap-1 text-sm text-teal-800"><CalendarClock size={14} />{followUp}</span>}
      </span>
      <span className="status-badge">{plan.active ? 'Active' : plan.status === 'ended' ? 'Ended' : 'Completed'}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// One plan
// ---------------------------------------------------------------------------
export function CareGuardPlanPage() {
  const { planId = '' } = useParams();
  const [plan, setPlan] = useState<CareGuardPlanDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { setError(null); void api.getCareGuardPlan(planId).then((result) => setPlan(result.plan)).catch(setError); }, [planId]);
  useEffect(load, [load]);
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!plan) return <LoadingState label="Loading your plan" />;
  return <PlanView plan={plan} reload={load} />;
}

export function PlanView({ plan, reload, grantId }: { plan: CareGuardPlanDetail; reload: () => void; grantId?: string }) {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const caregiver = plan.viewer === 'caregiver';
  const safety = lang === 'hi' && plan.safetyHi ? plan.safetyHi : plan.safety;
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const canRecord = plan.status === 'approved';
  const due = useDueDoses(plan.today.doses, plan.active);

  const recordDose = async (dose: CareGuardDose, status: 'taken' | 'postponed' | 'missed') => {
    setBusy(true); setActionError(null); setNotice('');
    try {
      const input = { scheduleId: dose.scheduleId, scheduledFor: dose.scheduledFor, status };
      const result = grantId ? await api.logCareGuardCaredForDose(grantId, plan.id, input) : await api.logCareGuardDose(plan.id, input);
      if (result.notice) setNotice(lang === 'hi' ? safety.missedDose : result.notice);
      notifyRemindersChanged();
      reload();
    } catch (error) { setActionError(error); } finally { setBusy(false); }
  };

  const followUp = followUpText(plan);
  const dismissedKey = plan.followUp ? dismissKey(plan.id, plan.followUp.date) : '';
  const [followUpDismissed, setFollowUpDismissed] = useState(() => (dismissedKey ? readDismissed(dismissedKey) : false));

  return (
    <div>
      <Link className="back-link" to="/app/careguard"><ArrowLeft size={16} />All plans</Link>
      <div className="eyebrow mt-6">CareGuard plan</div>
      <h1 className="page-title">{plan.recipientName}</h1>
      <p className="page-lead">{plan.doctorName} · {plan.clinicName}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Notice language"><span className="text-slate-500">Safety notices in:</span><button type="button" className={`mode-tab ${lang === 'en' ? 'active' : ''}`} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button><button type="button" className={`mode-tab ${lang === 'hi' ? 'active' : ''}`} aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>हिन्दी</button></div>
      {caregiver && <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950" role="note">You are viewing {plan.recipientName}’s plan as their caregiver. You can see: {[plan.scopes?.medication && 'medicine reminders', plan.scopes?.appointments && 'follow-up details', plan.scopes?.health && 'health updates'].filter(Boolean).join(', ') || 'nothing yet'}. They can change this at any time.</p>}
      <p className="mt-3 text-sm text-slate-600">{safety.planNotice}</p>
      {plan.status === 'ended' && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">This plan has ended. You can still read it, but nothing more can be recorded.</p>}
      <EmergencyNotice text={safety.emergency} />
      {plan.active && !caregiver && <ReminderControls />}
      {actionError ? <div className="mt-5"><ApiErrorState error={actionError} /></div> : null}

      {due.length > 0 && (
        <div className="mt-6 rounded-xl border border-teal-300 bg-teal-50 p-4" role="alert">
          <p className="font-semibold text-teal-950">Time for your medicine</p>
          <ul className="mt-1 text-sm text-teal-900">{due.map((dose) => <li key={`${dose.scheduleId}${dose.scheduledFor}`}>{dose.medicineName} · due {timeLabel(dose.scheduledFor, plan.timezone)}</li>)}</ul>
        </div>
      )}

      <section className="surface mt-8" aria-label="Today's medicines">
        <div className="eyebrow">Today · {dateLabel(plan.today.date)}</div>
        <h2 className="section-title">Medicine reminders</h2>
        {plan.today.doses.length === 0 && <p className="mt-3 text-sm text-slate-500">No medicine is scheduled for today.</p>}
        <ul className="mt-4 grid gap-3">
          {plan.today.doses.map((dose) => (
            <li className="rounded-xl border border-slate-200 bg-white p-4" key={`${dose.scheduleId}${dose.scheduledFor}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{timeLabel(dose.scheduledFor, plan.timezone)} · {dose.medicineName}</p>
                  {dose.dosageText && <p className="text-sm text-slate-600">{dose.dosageText}</p>}
                  {dose.instructionText && <p className="text-sm text-slate-600">{dose.instructionText}</p>}
                </div>
                <span className="status-badge">{stateLabels[dose.status]}{dose.overdue ? ' · time has passed' : ''}</span>
              </div>
              {canRecord && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="success" disabled={busy} onClick={() => void recordDose(dose, 'taken')}>Taken</Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void recordDose(dose, 'postponed')}>Remind me later</Button>
                  <Button type="button" variant="quiet" disabled={busy} onClick={() => void recordDose(dose, 'missed')}>Missed</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {notice && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">{notice}</p>}
        <p className="mt-4 text-xs text-slate-500">“Taken” is what you tell us. It is not proof that a medicine was taken. {safety.missedDose}</p>
      </section>

      {!caregiver && plan.checkInsEnabled && <CheckInCard plan={plan} safety={safety} onSaved={reload} />}
      {caregiver && plan.today.checkIn && <section className="surface mt-8" aria-label="Today's check-in"><div className="eyebrow">Reported by {plan.recipientName} today</div><p className="mt-2">{feelingLabels[plan.today.checkIn.feeling]}{plan.today.checkIn.note ? ` · “${plan.today.checkIn.note}”` : ''}</p><p className="mt-2 text-xs text-slate-500">Self-reported, not a medical record.</p></section>}

      {plan.followUp && !followUpDismissed && (
        <section className="surface mt-8" aria-label="Follow-up">
          <div className="eyebrow">Follow-up</div>
          <h2 className="section-title">{followUp}</h2>
          {plan.followUp.note && <p className="mt-2 text-sm text-slate-600">{plan.followUp.note}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="button button-primary" to={`/app/clinics/${plan.followUp.clinicId}/doctors/${plan.followUp.doctorId}/book`}>Book follow-up</Link>
            <Button type="button" variant="quiet" onClick={() => { writeDismissed(dismissedKey); setFollowUpDismissed(true); }}>Dismiss reminder</Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">This opens the booking screen for the same doctor. Nothing is booked until you confirm.</p>
        </section>
      )}

      <section className="surface mt-8" aria-label="Medicine schedule">
        <div className="eyebrow">Schedule from your doctor</div>
        <h2 className="section-title">Medicines</h2>
        <ul className="mt-4 grid gap-3">
          {plan.schedules.map((schedule) => (
            <li className="rounded-xl border border-slate-200 bg-white p-4" key={schedule.id}>
              <p className="font-semibold">{schedule.medicineName}</p>
              {schedule.dosageText && <p className="text-sm text-slate-600">{schedule.dosageText}</p>}
              {schedule.instructionText && <p className="text-sm text-slate-600">{schedule.instructionText}</p>}
              <p className="mt-1 text-sm text-slate-600">At {schedule.timesOfDay.map(hhmmLabel).join(', ')} · {dateLabel(schedule.startDate)} to {dateLabel(schedule.endDate)}</p>
            </li>
          ))}
        </ul>
      </section>

      {plan.explanationsAvailable && plan.scopes?.medication !== false && <CareGuardExplanationPanel planId={plan.id} schedules={plan.schedules} grantId={grantId} />}
      {!caregiver && <CareGuardMessagesPanel planId={plan.id} emergency={safety.emergency} />}
      {!caregiver && <SharingCard plan={plan} onChanged={reload} />}
      <p className="mt-8 text-xs text-slate-500">{safety.selfReported}</p>
    </div>
  );
}

function CheckInCard({ plan, safety, onSaved }: { plan: CareGuardPlanDetail; safety: CareGuardPlanDetail['safety']; onSaved: () => void }) {
  const [feeling, setFeeling] = useState<CareGuardFeeling | null>(plan.today.checkIn?.feeling ?? null);
  const [note, setNote] = useState(plan.today.checkIn?.note ?? '');
  const [result, setResult] = useState<{ message: string; urgent: string | null } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!feeling) return;
    setBusy(true); setError(null);
    try { const saved = await api.saveCareGuardCheckIn(plan.id, { feeling, note: note.trim() || null }); setResult({ message: saved.message, urgent: saved.urgent }); notifyRemindersChanged(); onSaved(); } catch (nextError) { setError(nextError); } finally { setBusy(false); }
  };
  return (
    <section className="surface mt-8" aria-label="Daily check-in">
      <div className="eyebrow">Daily check-in</div>
      <h2 className="section-title">How are you feeling compared with yesterday?</h2>
      {plan.active ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="How you feel">
            {(['better', 'same', 'worse'] as const).map((value) => <button key={value} type="button" className={`mode-tab ${feeling === value ? 'active' : ''}`} aria-pressed={feeling === value} onClick={() => setFeeling(value)}>{feelingLabels[value]}</button>)}
          </div>
          <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold text-slate-700">Optional note</span><textarea className="field" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: fever has reduced" /></label>
          <div className="mt-4"><Button type="button" disabled={!feeling || busy} onClick={() => void save()}>{plan.today.checkIn ? 'Update today’s check-in' : 'Save check-in'}</Button></div>
          {error ? <div className="mt-4"><ApiErrorState error={error} /></div> : null}
          {plan.today.checkIn && !result && <p className="mt-3 text-sm text-slate-600">Today you reported: {feelingLabels[plan.today.checkIn.feeling]}.</p>}
          {result && <div className="mt-4 text-sm"><p role="status">{result.message}</p>{result.urgent && <EmergencyNotice text={result.urgent} />}</div>}
          {feeling === 'worse' && !result && <p className="mt-3 text-sm text-slate-600">{safety.worse}</p>}
        </>
      ) : <p className="mt-3 text-sm text-slate-500">Check-ins are only open while a plan is active.</p>}
      <p className="mt-4 text-xs text-slate-500">Check-ins are reported by you. They are not a medical record and are not a diagnosis.</p>
    </section>
  );
}

function SharingCard({ plan, onChanged }: { plan: CareGuardPlanDetail; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const toggle = async (value: boolean) => {
    setBusy(true); setError(null);
    try { await api.setCareGuardSharing(plan.id, value); onChanged(); } catch (nextError) { setError(nextError); } finally { setBusy(false); }
  };
  return (
    <section className="surface mt-8" aria-label="Sharing">
      <div className="eyebrow">Privacy</div>
      <h2 className="section-title">Share with {plan.clinicName}</h2>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={Boolean(plan.shareWithClinic)} disabled={busy} onChange={(event) => void toggle(event.target.checked)} />
        <span>Let {plan.doctorName} see my daily check-ins and medicine records for this plan. You can turn this off at any time. Turning it on does not mean anyone is watching them live.</span>
      </label>
      {error ? <div className="mt-4"><ApiErrorState error={error} /></div> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recovery history
// ---------------------------------------------------------------------------
export function CareGuardHistoryPage() {
  const [data, setData] = useState<{ history: CareGuardHistoryEntry[]; safety: { selfReported: string } } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { setError(null); void api.getCareGuardHistory().then(setData).catch(setError); }, []);
  useEffect(load, [load]);
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading your recovery history" />;
  return (
    <div>
      <Link className="back-link" to="/app/careguard"><ArrowLeft size={16} />My CareGuard Plan</Link>
      <div className="eyebrow mt-6">CareGuard</div>
      <h1 className="page-title">Recovery history</h1>
      <p className="page-lead">Your doctor’s plans, and what you reported afterwards, kept apart so they are never confused.</p>
      {data.history.length === 0 && <div className="mt-8"><EmptyState title="Nothing here yet" message="Your history will build up as you use CareGuard plans." icon={CalendarClock} /></div>}
      <div className="mt-8 grid gap-6">
        {data.history.map((entry) => (
          <section className="surface" key={entry.id} aria-label={`History for ${entry.recipientName}`}>
            <div className="eyebrow">{entry.approvedAt ? dateLabel(entry.approvedAt.slice(0, 10)) : 'Plan'}</div>
            <h2 className="section-title">{entry.recipientName} · {entry.doctorName}</h2>
            <p className="text-sm text-slate-500">{entry.clinicName}</p>

            <h3 className="label mt-5">Set by your doctor (clinical plan)</h3>
            <ul className="mt-2 grid gap-1 text-sm text-slate-700">
              {entry.clinicalPlan.medicines.map((medicine) => <li key={medicine.id}>{medicine.medicineName}{medicine.dosageText ? ` · ${medicine.dosageText}` : ''} · {medicine.timesOfDay.map(hhmmLabel).join(', ')} · {dateLabel(medicine.startDate)} to {dateLabel(medicine.endDate)}</li>)}
              {entry.clinicalPlan.followUpDate && <li>Follow-up: {dateLabel(entry.clinicalPlan.followUpDate)}{entry.clinicalPlan.followUpNote ? ` · ${entry.clinicalPlan.followUpNote}` : ''}</li>}
            </ul>

            <h3 className="label mt-5">Reported by you (self-reported)</h3>
            {entry.patientReported.checkIns.length === 0 ? <p className="mt-2 text-sm text-slate-500">No check-ins recorded.</p> : (
              <ul className="mt-2 grid gap-1 text-sm text-slate-700">
                {entry.patientReported.checkIns.map((checkIn) => <li key={checkIn.date}>{dateLabel(checkIn.date)} · {feelingLabels[checkIn.feeling]}{checkIn.note ? ` · “${checkIn.note}”` : ''}</li>)}
              </ul>
            )}
            <p className="mt-3 text-sm text-slate-700">Medicine records you entered: {entry.patientReported.adherence.taken} taken, {entry.patientReported.adherence.postponed} postponed, {entry.patientReported.adherence.missed} missed, out of {entry.patientReported.adherence.scheduledSoFar} scheduled so far.</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-500">{data.safety.selfReported}</p>
    </div>
  );
}
