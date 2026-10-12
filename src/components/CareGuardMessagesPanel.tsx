import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import type { CareGuardPatientThread } from '../types/api';
import { ApiErrorState, Button } from './ui';

const timeLabel = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const modeText: Record<string, string> = {
  included: 'Messaging is included with your care at this clinic.',
  limited: 'This clinic offers limited messaging.',
  billed: 'This clinic may charge separately for messaging. Ask the clinic about fees.',
};

// "Ask My Clinic": non-emergency questions to the clinic. The clinic decides whether this is offered.
export function CareGuardMessagesPanel({ planId, emergency }: { planId: string; emergency: string }) {
  const [thread, setThread] = useState<CareGuardPatientThread | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState<string | null>(null);

  const load = useCallback(() => { void api.getCareGuardMessages(planId).then(setThread).catch(setError); }, [planId]);
  useEffect(load, [load]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setError(null); setWarning(null);
    try {
      const result = await api.sendCareGuardMessage(planId, text.trim());
      setText(''); setWarning(result.urgentWarning); setResponseNote(result.responseNote);
      load();
    } catch (nextError) { setError(nextError); } finally { setBusy(false); }
  };

  return (
    <section className="surface mt-8" aria-label="Ask my clinic">
      <div className="eyebrow">Ask My Clinic</div>
      <h2 className="section-title">Questions for the clinic</h2>
      <p className="mt-2 text-sm text-slate-600">For non-urgent questions about your plan. {emergency}</p>
      {error ? <div className="mt-4"><ApiErrorState error={error} /></div> : null}
      {thread && !thread.messaging.enabled && <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{thread.messaging.clinicName} has not turned on messaging. Please call or visit the clinic.</p>}
      {thread?.messaging.enabled && (
        <>
          <p className="mt-3 text-sm text-slate-600">{modeText[thread.messaging.mode]}{thread.messaging.note ? ` ${thread.messaging.note}` : ''}</p>
          <ul className="mt-4 grid gap-2" aria-label="Messages">
            {thread.messages.map((message) => (
              <li key={message.id} className={`rounded-xl border p-3 text-sm ${message.from === 'patient' ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                <p className="font-semibold">{message.fromLabel} <span className="font-normal text-slate-500">· {timeLabel(message.createdAt)}</span></p>
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
              </li>
            ))}
            {thread.messages.length === 0 && <li className="text-sm text-slate-500">No messages yet.</li>}
          </ul>
          <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold text-slate-700">Your question</span><textarea className="field" rows={3} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} /></label>
          <div className="mt-3"><Button type="button" disabled={busy || !text.trim()} onClick={() => void send()}>Send to clinic</Button></div>
          {warning && <div className="mt-4 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={18} /><p>Your message was sent, but it may describe an emergency. {warning}</p></div>}
          {!warning && responseNote && <p className="mt-3 text-sm text-slate-600" role="status">Sent. {responseNote}</p>}
        </>
      )}
    </section>
  );
}
