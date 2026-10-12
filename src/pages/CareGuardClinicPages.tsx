import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CareGuardFollowUpRow, ClinicMessagingMode } from '../types/api';
import { ApiErrorState, Button, EmptyState, LoadingState } from '../components/ui';
import { CareGuardInbox } from '../components/CareGuardInbox';

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const modeOptions: { value: ClinicMessagingMode; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'Patients cannot message the clinic through CareGuard.' },
  { value: 'included', label: 'Included', hint: 'Messaging is part of normal care.' },
  { value: 'limited', label: 'Limited', hint: 'Messaging is offered with limits you describe below.' },
  { value: 'billed', label: 'Billed separately', hint: 'The clinic charges for messaging outside the app.' },
];

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Receptionist
// ---------------------------------------------------------------------------
function MessagingSettings() {
  const [mode, setMode] = useState<ClinicMessagingMode | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { void api.getCareGuardClinicSettings().then((settings) => { setMode(settings.messagingMode); setNote(settings.messagingNote ?? ''); }).catch(setError); }, []);
  const save = async () => {
    if (!mode) return;
    setError(null); setSaved(false);
    try { await api.saveCareGuardClinicSettings({ messagingMode: mode, messagingNote: note.trim() || null }); setSaved(true); } catch (nextError) { setError(nextError); }
  };
  return (
    <section className="surface mt-8" aria-label="Messaging policy">
      <div className="eyebrow">Clinic policy</div>
      <h2 className="section-title">Patient messaging</h2>
      <p className="mt-2 text-sm text-slate-600">Decide whether patients can ask this clinic questions from their CareGuard plan, and tell them what to expect. Only turn it on if someone will actually read and answer messages.</p>
      {error ? <div className="mt-4"><ApiErrorState error={error} /></div> : null}
      {mode && (
        <>
          <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Messaging mode">
            {modeOptions.map((option) => <label className="flex items-start gap-2 text-sm" key={option.value}><input type="radio" name="messaging-mode" className="mt-1" checked={mode === option.value} onChange={() => { setMode(option.value); setSaved(false); }} /><span><strong>{option.label}</strong><span className="block text-slate-500">{option.hint}</span></span></label>)}
          </div>
          <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold text-slate-700">What patients should expect (shown to them)</span><input className="field" maxLength={300} value={note} onChange={(event) => { setNote(event.target.value); setSaved(false); }} placeholder="For example: we reply within one working day, Mon–Sat" /></label>
          <div className="mt-4 flex items-center gap-3"><Button type="button" onClick={() => void save()}>Save policy</Button>{saved && <span className="text-sm font-semibold text-emerald-700" role="status">Saved</span>}</div>
        </>
      )}
    </section>
  );
}

export function ReceptionistMessagesPage() {
  return (
    <div>
      <div className="eyebrow">CareGuard</div>
      <h1 className="page-title">Patient messages</h1>
      <p className="page-lead">Route patient questions: answer practical ones, forward medical ones to the doctor.</p>
      <MessagingSettings />
      <div className="mt-8"><CareGuardInbox role="receptionist" /></div>
    </div>
  );
}

const statusText: Record<CareGuardFollowUpRow['status'], string> = { overdue: 'Overdue', due_today: 'Due today', upcoming: 'Upcoming', booked: 'Booked' };

export function ReceptionistFollowUpsPage() {
  const [data, setData] = useState<{ today: string; followUps: CareGuardFollowUpRow[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { setError(null); void api.getCareGuardFollowUps().then(setData).catch(setError); }, []);
  useEffect(load, [load]);
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading follow-ups" />;
  return (
    <div>
      <div className="eyebrow">CareGuard</div>
      <h1 className="page-title">Follow-ups due</h1>
      <p className="page-lead">Follow-up dates set by doctors for the next two weeks, and any that were missed in the last two. A follow-up counts as booked when the patient has a later appointment with the same doctor.</p>
      {data.followUps.length === 0 && <div className="mt-8"><EmptyState title="No follow-ups in this window" message="Follow-ups appear here when a doctor sets a date in a CareGuard plan." /></div>}
      <ul className="mt-8 grid gap-3">
        {data.followUps.map((row) => (
          <li className="surface" key={row.planId}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{row.recipientName} · {row.doctorName}</p>
                <p className="text-sm text-slate-600">Follow-up on {dateLabel(row.followUpDate)}{row.followUpNote ? ` · ${row.followUpNote}` : ''}</p>
                {row.status === 'booked' && row.bookedFor && <p className="text-sm text-emerald-800">Booked for {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.bookedFor))}</p>}
                <p className="mt-1 text-sm text-slate-500">Contact {row.contact.name ?? 'patient'}: {[row.contact.phone, row.contact.email].filter(Boolean).join(' · ') || 'no contact details on file'}</p>
              </div>
              <span className="status-badge" style={row.status === 'overdue' ? { background: '#fde8e8', color: '#9b1c1c' } : undefined}>{statusText[row.status]}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
