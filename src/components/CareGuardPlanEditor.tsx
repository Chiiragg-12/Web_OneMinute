import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CareGuardDoctorPlan, CareGuardFeeling, CareGuardPreviousPlan, PrescriptionMedicine } from '../types/api';
import { ApiErrorState, Button, LoadingState } from './ui';

type Row = { enabled: boolean; times: string[]; startDate: string; durationDays: string };
const feelingLabels: Record<CareGuardFeeling, string> = { better: 'Better', same: 'About the same', worse: 'Worse' };
const today = () => new Date().toLocaleDateString('en-CA');
const defaultRow = (): Row => ({ enabled: true, times: ['08:00', '20:00'], startDate: today(), durationDays: '5' });
const hhmm = (time: string) => { const [h, m] = time.split(':').map(Number); return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, m))); };

function rowsFrom(medicines: PrescriptionMedicine[], plan: CareGuardDoctorPlan | null): Record<string, Row> {
  const rows: Record<string, Row> = {};
  for (const medicine of medicines) {
    const saved = plan?.schedules.find((schedule) => schedule.prescriptionMedicineId === medicine.id);
    if (saved) {
      const days = Math.round((Date.parse(`${saved.endDate}T00:00:00Z`) - Date.parse(`${saved.startDate}T00:00:00Z`)) / 86_400_000) + 1;
      rows[medicine.id] = { enabled: true, times: saved.timesOfDay, startDate: saved.startDate, durationDays: String(days) };
    } else rows[medicine.id] = plan ? { ...defaultRow(), enabled: false } : defaultRow();
  }
  return rows;
}

// Doctor-side editor for the CareGuard plan that hangs off an approved prescription.
export function CareGuardPlanEditor({ appointmentId, medicines }: { appointmentId: string; medicines: PrescriptionMedicine[] }) {
  const [plan, setPlan] = useState<CareGuardDoctorPlan | null | undefined>(undefined);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [checkInsEnabled, setCheckInsEnabled] = useState(true);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((next: CareGuardDoctorPlan | null) => {
    setPlan(next);
    setRows(rowsFrom(medicines, next));
    setCheckInsEnabled(next?.checkInsEnabled ?? true);
    setFollowUpDate(next?.followUpDate ?? '');
    setFollowUpNote(next?.followUpNote ?? '');
  }, [medicines]);

  useEffect(() => { void api.getDoctorCareGuardPlan(appointmentId).then((result) => apply(result.plan)).catch(setError); }, [appointmentId, apply]);

  const update = (id: string, patch: Partial<Row>) => setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const draftInput = () => ({
    schedules: medicines.filter((medicine) => rows[medicine.id]?.enabled).map((medicine) => ({ prescriptionMedicineId: medicine.id, timesOfDay: rows[medicine.id].times, startDate: rows[medicine.id].startDate, durationDays: Number(rows[medicine.id].durationDays) })),
    checkInsEnabled,
    followUpDate: followUpDate || null,
    followUpNote: followUpNote.trim() || null,
  });
  const invalid = medicines.some((medicine) => { const row = rows[medicine.id]; return row?.enabled && (row.times.length === 0 || row.times.some((time) => !time) || !row.startDate || !(Number(row.durationDays) >= 1)); });

  const run = async (work: () => Promise<CareGuardDoctorPlan>) => {
    setBusy(true); setError(null);
    try { apply(await work()); } catch (nextError) { setError(nextError); } finally { setBusy(false); }
  };
  const saveDraft = () => run(async () => (await api.saveDoctorCareGuardPlan(appointmentId, draftInput())).plan);
  const approve = () => run(async () => { await api.saveDoctorCareGuardPlan(appointmentId, draftInput()); return (await api.approveDoctorCareGuardPlan(appointmentId)).plan; });
  const endPlan = () => run(async () => (await api.endDoctorCareGuardPlan(appointmentId)).plan);

  if (plan === undefined && !error) return <section className="surface sm:col-span-2"><LoadingState label="Loading CareGuard plan" /></section>;
  const locked = plan !== null && plan !== undefined && plan.status !== 'draft';

  return (
    <section className="surface sm:col-span-2" aria-label="CareGuard plan">
      <div className="eyebrow">CareGuard</div>
      <h3 className="section-title">{locked ? (plan!.status === 'ended' ? 'CareGuard plan (ended)' : 'CareGuard plan (approved)') : 'After-visit care plan'}</h3>
      <p className="mt-2 text-sm text-slate-600">Reminder times you set here are shown to the patient exactly as written, with medicine names and instructions copied from the approved prescription. Patient replies are self-reported and are not monitored live.</p>
      {error ? <div className="mt-4"><ApiErrorState error={error} /></div> : null}

      {locked ? (
        <div className="mt-4 text-sm">
          <ul className="grid gap-2">
            {plan!.schedules.map((schedule) => <li key={schedule.id}><strong>{schedule.medicineName}</strong> · {schedule.timesOfDay.map(hhmm).join(', ')} · {schedule.startDate} to {schedule.endDate}</li>)}
          </ul>
          <p className="mt-3">Daily check-ins: {plan!.checkInsEnabled ? 'on' : 'off'}{plan!.followUpDate ? ` · Follow-up: ${plan!.followUpDate}` : ''}{plan!.followUpNote ? ` (${plan!.followUpNote})` : ''}</p>
          {plan!.sharedUpdates ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="label">Reported by the patient · shared with their permission</p>
              {plan!.sharedUpdates.checkIns.length === 0 ? <p className="mt-2 text-slate-500">No check-ins yet.</p> : <ul className="mt-2 grid gap-1">{plan!.sharedUpdates.checkIns.slice(0, 14).map((checkIn) => <li key={checkIn.date}>{checkIn.date} · {feelingLabels[checkIn.feeling]}{checkIn.note ? ` · “${checkIn.note}”` : ''}</li>)}</ul>}
              <p className="mt-2">Medicine records (self-reported): {plan!.sharedUpdates.adherence.taken} taken, {plan!.sharedUpdates.adherence.postponed} postponed, {plan!.sharedUpdates.adherence.missed} missed of {plan!.sharedUpdates.adherence.scheduledSoFar} scheduled so far.</p>
              <p className="mt-2 text-xs text-slate-500">These are not live monitoring. A “worse” entry does not alert anyone; patients are told to contact the clinic themselves.</p>
            </div>
          ) : <p className="mt-4 text-slate-500">The patient has not shared their check-ins or medicine records with the clinic.</p>}
          {plan!.status === 'approved' && <div className="mt-4"><Button type="button" variant="outline" disabled={busy} onClick={() => void endPlan()}>End plan</Button></div>}
        </div>
      ) : (
        <form className="mt-4 grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
          {medicines.map((medicine) => {
            const row = rows[medicine.id] ?? defaultRow();
            return (
              <fieldset className="rounded-xl border border-slate-200 p-4" key={medicine.id}>
                <legend className="px-1 text-sm font-semibold">{medicine.medicineName}{medicine.dosage ? ` · ${medicine.dosage}` : ''}</legend>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.enabled} onChange={(event) => update(medicine.id, { enabled: event.target.checked })} />Send reminders for this medicine</label>
                {row.enabled && (
                  <div className="mt-3 grid gap-3">
                    <div className="flex flex-wrap items-end gap-2">
                      {row.times.map((time, index) => (
                        <label className="block text-sm" key={index}><span className="mb-1 block font-semibold text-slate-700">Time {index + 1}</span>
                          <span className="flex gap-1"><input className="field" type="time" aria-label={`${medicine.medicineName} time ${index + 1}`} value={time} onChange={(event) => update(medicine.id, { times: row.times.map((current, position) => (position === index ? event.target.value : current)) })} />
                            {row.times.length > 1 && <button type="button" className="icon-button" aria-label={`Remove time ${index + 1} for ${medicine.medicineName}`} onClick={() => update(medicine.id, { times: row.times.filter((_, position) => position !== index) })}>×</button>}</span>
                        </label>
                      ))}
                      {row.times.length < 6 && <Button type="button" variant="quiet" onClick={() => update(medicine.id, { times: [...row.times, '12:00'] })}>Add time</Button>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm"><span className="mb-1 block font-semibold text-slate-700">Start date</span><input className="field" type="date" min={today()} value={row.startDate} aria-label={`${medicine.medicineName} start date`} onChange={(event) => update(medicine.id, { startDate: event.target.value })} /></label>
                      <label className="block text-sm"><span className="mb-1 block font-semibold text-slate-700">Number of days</span><input className="field" type="number" min={1} max={365} value={row.durationDays} aria-label={`${medicine.medicineName} number of days`} onChange={(event) => update(medicine.id, { durationDays: event.target.value })} /></label>
                    </div>
                  </div>
                )}
              </fieldset>
            );
          })}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checkInsEnabled} onChange={(event) => setCheckInsEnabled(event.target.checked)} />Ask the patient a daily “How are you feeling?” check-in</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-1 block font-semibold text-slate-700">Follow-up date (optional)</span><input className="field" type="date" min={today()} value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>
            <label className="block text-sm"><span className="mb-1 block font-semibold text-slate-700">Follow-up note (optional)</span><input className="field" maxLength={500} value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} /></label>
          </div>
          <p className="text-sm font-semibold text-amber-800">DRAFT — not visible to the patient until you approve. An approved plan cannot be edited.</p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="outline" disabled={busy || invalid}>Save draft</Button>
            <Button type="button" disabled={busy || invalid} onClick={() => void approve()}>Approve and share with patient</Button>
          </div>
        </form>
      )}
      <PreviousPlans appointmentId={appointmentId} />
    </section>
  );
}

// Earlier CareGuard plans this doctor wrote for the same patient, for use at a later visit.
// What the patient reported appears only when they chose to share it.
function PreviousPlans({ appointmentId }: { appointmentId: string }) {
  const [plans, setPlans] = useState<CareGuardPreviousPlan[] | null>(null);
  useEffect(() => { void api.getDoctorPreviousCareGuardPlans(appointmentId).then((result) => setPlans(result.plans)).catch(() => setPlans([])); }, [appointmentId]);
  if (!plans || plans.length === 0) return null;
  return (
    <details className="mt-6 rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Earlier CareGuard plans for this patient ({plans.length})</summary>
      <ul className="mt-3 grid gap-4 text-sm">
        {plans.map((plan) => (
          <li key={plan.planId}>
            <p className="font-semibold">{plan.approvedAt ? plan.approvedAt.slice(0, 10) : 'Plan'} · {plan.publicPlanId}</p>
            <p className="label mt-2">Your plan (clinical)</p>
            <ul className="grid gap-1">{plan.clinical.medicines.map((medicine) => <li key={medicine.id}>{medicine.medicineName} · {medicine.timesOfDay.map(hhmm).join(', ')} · {medicine.startDate} to {medicine.endDate}</li>)}</ul>
            {plan.clinical.followUpDate && <p>Follow-up: {plan.clinical.followUpDate}</p>}
            {plan.patientReported ? (
              <div className="mt-2 rounded-lg bg-slate-50 p-3">
                <p className="label">Reported by the patient · shared with their permission</p>
                {plan.patientReported.checkIns.length === 0 ? <p className="text-slate-500">No check-ins.</p> : <ul className="grid gap-1">{plan.patientReported.checkIns.slice(0, 10).map((checkIn) => <li key={checkIn.date}>{checkIn.date} · {feelingLabels[checkIn.feeling]}{checkIn.note ? ` · “${checkIn.note}”` : ''}</li>)}</ul>}
                <p>Medicine records (self-reported): {plan.patientReported.adherence.taken} taken, {plan.patientReported.adherence.postponed} postponed, {plan.patientReported.adherence.missed} missed of {plan.patientReported.adherence.scheduledSoFar} scheduled.</p>
              </div>
            ) : <p className="mt-2 text-slate-500">The patient has not shared what they reported for this plan.</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
