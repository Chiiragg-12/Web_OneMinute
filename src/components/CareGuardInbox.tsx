import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import type { CareGuardInboxThread, CareGuardStaffThread } from '../types/api';
import { ApiErrorState, Button, EmptyState, LoadingState } from './ui';

const when = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

// Patient questions from CareGuard plans ("Ask My Clinic"), for a doctor (their own patients)
// or for reception (the clinic's patients). Reception routes; the doctor answers medical questions.
export function CareGuardInbox({ role }: { role: 'doctor' | 'receptionist' }) {
  const [threads, setThreads] = useState<CareGuardInboxThread[] | null>(null);
  const [open, setOpen] = useState<CareGuardStaffThread | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const loadInbox = useCallback(() => { void api.getCareGuardInbox(role).then((result) => setThreads(result.threads)).catch(setError); }, [role]);
  useEffect(loadInbox, [loadInbox]);

  const openThread = async (planId: string) => {
    setError(null);
    try { setOpen(await api.getCareGuardStaffThread(role, planId)); loadInbox(); } catch (nextError) { setError(nextError); }
  };
  const send = async () => {
    if (!open || !reply.trim()) return;
    setBusy(true); setError(null);
    try { await api.replyCareGuardThread(role, open.planId, reply.trim()); setReply(''); await openThread(open.planId); } catch (nextError) { setError(nextError); } finally { setBusy(false); }
  };
  const forward = async () => {
    if (!open) return;
    setBusy(true); setError(null);
    try { await api.forwardCareGuardThread(open.planId); await openThread(open.planId); } catch (nextError) { setError(nextError); } finally { setBusy(false); }
  };

  if (!threads && !error) return <LoadingState label="Loading messages" />;
  return (
    <section aria-label="Patient messages">
      {error ? <div className="mb-4"><ApiErrorState error={error} /></div> : null}
      {threads && threads.length === 0 && <EmptyState title="No patient messages" message="Questions from patients about their CareGuard plans will appear here." />}
      <ul className="grid gap-3">
        {threads?.map((thread) => (
          <li key={thread.planId}>
            <button type="button" className="action-card w-full text-left" onClick={() => void openThread(thread.planId)} aria-label={`Open conversation with ${thread.recipientName}`}>
              <span className="min-w-0">
                <strong>{thread.recipientName}</strong>
                <span className="block text-sm text-slate-500">{role === 'receptionist' ? `${thread.doctorName} · ` : ''}{thread.lastMessage?.preview ?? 'No messages'}</span>
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {thread.urgent && <span className="status-badge" style={{ background: '#fde8e8', color: '#9b1c1c' }}>May be urgent</span>}
                {thread.forwardedToDoctor && <span className="status-badge">For doctor</span>}
                {thread.unreadCount > 0 && <span className="status-badge">{thread.unreadCount} new</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="surface mt-6" aria-label={`Conversation with ${open.recipientName}`}>
          <div className="eyebrow">Conversation</div>
          <h3 className="section-title">{open.recipientName}</h3>
          {role === 'receptionist' && <p className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="note"><AlertTriangle className="mt-0.5 shrink-0" size={16} />Reception can answer practical questions (timings, bookings, how to reach the clinic). Do not give medical advice. Forward medical questions to {open.doctorName}.</p>}
          <ul className="mt-4 grid gap-2">
            {open.messages.map((message) => (
              <li key={message.id} className={`rounded-xl border p-3 text-sm ${message.from === 'patient' ? 'border-slate-200 bg-white' : 'border-teal-200 bg-teal-50'}`}>
                <p className="font-semibold">{message.fromLabel} <span className="font-normal text-slate-500">· {when(message.createdAt)}</span>{message.flaggedUrgent && <span className="ml-2 font-semibold text-rose-700">May describe an emergency. The patient was told to seek urgent help.</span>}</p>
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
              </li>
            ))}
          </ul>
          <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold text-slate-700">Reply</span><textarea className="field" rows={3} maxLength={2000} value={reply} onChange={(event) => setReply(event.target.value)} /></label>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" disabled={busy || !reply.trim()} onClick={() => void send()}>Send reply</Button>
            {role === 'receptionist' && !open.forwardedToDoctor && <Button type="button" variant="outline" disabled={busy} onClick={() => void forward()}>Forward to doctor</Button>}
            {role === 'receptionist' && open.forwardedToDoctor && <span className="self-center text-sm font-semibold text-teal-800">Forwarded to {open.doctorName}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
