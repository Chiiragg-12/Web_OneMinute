import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ApiErrorState, LoadingState } from '../components/ui';

function period() {
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function money(cents: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(cents / 100);
}

export function ReceptionistFinancePage() {
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.getReceptionistFinance>>['report'] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const range = period();
  useEffect(() => { void api.getReceptionistFinance(range.start, range.end).then((result) => setReport(result.report)).catch(setError); }, [range.start, range.end]);
  if (error) return <ApiErrorState error={error} />;
  if (!report) return <LoadingState label="Loading clinic finance" />;
  return <div><div className="eyebrow">Clinic finance</div><h1 className="page-title">Collections and obligations</h1><p className="page-lead">Today’s financial events for your assigned clinic. Doctor figures are reporting only; settlement ownership remains with the clinic.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><section className="surface"><p className="label">Verified online gross</p><p className="mt-3 font-display text-2xl font-semibold">{money(report.online.grossCents)}</p></section><section className="surface"><p className="label">Online clinic payable</p><p className="mt-3 font-display text-2xl font-semibold">{money(report.online.clinicPayableCents)}</p></section><section className="surface"><p className="label">Cash commission settled</p><p className="mt-3 font-display text-2xl font-semibold">{money(report.offline.settledCommissionCents)}</p></section><section className="surface"><p className="label">Cash commission outstanding</p><p className="mt-3 font-display text-2xl font-semibold">{money(report.offline.outstandingCommissionCents)}</p></section></div><section className="surface mt-6"><div className="eyebrow">Doctor contribution</div><h2 className="section-title">Breakdown</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Doctor</th><th className="pb-3">Online gross</th><th className="pb-3">Commission</th><th className="pb-3">Clinic payable</th><th className="pb-3">Reported cash</th></tr></thead><tbody className="divide-y divide-slate-100">{report.doctors.map((doctor) => <tr key={doctor.doctor.id}><td className="py-4 font-semibold">{doctor.doctor.fullName}</td><td className="py-4">{money(doctor.onlineGrossCents)}</td><td className="py-4">{money(doctor.onlineCommissionCents + doctor.offlineCommissionCents)}</td><td className="py-4">{money(doctor.clinicPayableCents)}</td><td className="py-4">{money(doctor.offlineCollectedCents)}</td></tr>)}</tbody></table></div></section></div>;
}
