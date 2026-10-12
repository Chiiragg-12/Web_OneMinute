import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../api/client';
import type { CareGuardExplanation, CareGuardSchedule } from '../types/api';
import { ApiErrorState, Button } from './ui';

// AI-generated plain-language wording of the doctor's instructions (English or Hindi).
// Always labelled, shown only next to the doctor's original text, and never edited or stored as a record.
export function CareGuardExplanationPanel({ planId, schedules, grantId }: { planId: string; schedules: CareGuardSchedule[]; grantId?: string }) {
  const [result, setResult] = useState<CareGuardExplanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const explain = async (lang: 'en' | 'hi') => {
    setBusy(true); setError(null);
    try { setResult(await api.getCareGuardExplanation(planId, lang, grantId)); } catch (nextError) { setError(nextError); } finally { setBusy(false); }
  };

  return (
    <section className="surface mt-8" aria-label="Plain-language explanation">
      <div className="eyebrow">Explain in simple words</div>
      <h2 className="section-title">Not sure what an instruction means?</h2>
      <p className="mt-2 text-sm text-slate-600">An AI assistant can rewrite your doctor’s instructions in simpler words. It cannot change them.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void explain('en')}><Sparkles size={16} />Explain in simple English</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void explain('hi')}><Sparkles size={16} />सरल हिंदी में समझाएँ</Button>
      </div>
      {error ? <div className="mt-4"><ApiErrorState error={error} /></div> : null}
      {result && (
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4" aria-label="AI-generated explanation">
          <p className="label text-violet-800">AI-generated · not medical advice</p>
          <ul className="mt-3 grid gap-3 text-sm">
            {result.items.map((item) => {
              const schedule = schedules.find((candidate) => candidate.id === item.scheduleId);
              return (
                <li key={item.scheduleId}>
                  <p className="font-semibold">{schedule?.medicineName}</p>
                  <p>{item.explanation}</p>
                  <p className="mt-1 text-xs text-slate-500">Your doctor’s original: {[schedule?.dosageText, schedule?.instructionText].filter(Boolean).join(' · ') || 'no extra instructions'}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-600">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
