import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ConsultationMode, DoctorAwaitingLogin, DoctorInvite, DoctorPublicPreview } from '../types/api';
import { ApiErrorState, Button, Field } from '../components/ui';
import { DoctorRequests } from './ReceptionistPages';
import { DoctorInviteCard } from '../components/DoctorInviteCard';

const modes: ConsultationMode[] = ['in_person', 'video', 'audio', 'chat'];
type ModeDraft = { enabled: boolean; duration: string; price: string };
const initialModes: Record<ConsultationMode, ModeDraft> = { in_person: { enabled: true, duration: '60', price: '' }, video: { enabled: false, duration: '20', price: '' }, audio: { enabled: false, duration: '15', price: '' }, chat: { enabled: false, duration: '10', price: '' } };

export function ReceptionistAddDoctorPage() { return <><DoctorRequests /><DoctorsAwaitingLogin /><ReceptionistAddDoctorFormPage /></>; }

const statusText: Record<DoctorAwaitingLogin['invite']['status'], string> = { valid: 'Invite active', expired: 'Invite expired', locked: 'Invite locked after wrong codes', none: 'No invite yet' };

// Doctors this clinic created that have no login of their own yet, each with a way to issue a new code.
function DoctorsAwaitingLogin() {
  const [doctors, setDoctors] = useState<DoctorAwaitingLogin[]>([]);
  const [fresh, setFresh] = useState<{ doctor: DoctorAwaitingLogin; invite: DoctorInvite } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { void api.listDoctorsAwaitingLogin().then((result) => setDoctors(result.doctors)).catch(() => setDoctors([])); }, []);
  useEffect(load, [load]);
  const reissue = async (doctor: DoctorAwaitingLogin) => {
    setError(null);
    try { const result = await api.reissueDoctorInvite(doctor.id); setFresh({ doctor, invite: result.invite }); load(); } catch (nextError) { setError(nextError); }
  };
  if (doctors.length === 0 && !fresh) return null;
  return (
    <section className="surface mt-6" aria-label="Doctors waiting to log in">
      <div className="eyebrow">Doctor logins</div>
      <h2 className="section-title">Doctors waiting to log in</h2>
      <p className="mt-2 text-sm text-slate-600">You created these profiles, so they have no login yet. Give each doctor a one-time code to activate their account. Issuing a new code cancels the old one.</p>
      {error ? <div className="mt-4"><ApiErrorState error={error instanceof Error ? error : new Error('Could not issue a code')} /></div> : null}
      <ul className="mt-4 grid gap-3">
        {doctors.map((doctor) => (
          <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3" key={doctor.id}>
            <div className="min-w-0"><strong>{doctor.fullName}</strong><span className="block text-sm text-slate-500">{doctor.publicDoctorId} · {statusText[doctor.invite.status]}</span></div>
            <Button type="button" variant="outline" onClick={() => void reissue(doctor)}>New invite code</Button>
          </li>
        ))}
      </ul>
      {fresh && <DoctorInviteCard doctorName={fresh.doctor.fullName} publicDoctorId={fresh.doctor.publicDoctorId} code={fresh.invite.code} expiresAt={fresh.invite.expiresAt} />}
    </section>
  );
}

function ReceptionistAddDoctorFormPage() {
  const [tab, setTab] = useState<'details' | 'id'>('id');
  const [publicDoctorId, setPublicDoctorId] = useState('');
  const [preview, setPreview] = useState<DoctorPublicPreview | null>(null);
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState<{ doctorName: string; publicDoctorId: string | null; code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [modeState, setModeState] = useState(initialModes);
  const [form, setForm] = useState({ fullName: '', specialization: '', qualifications: '', registrationNumber: '', registrationCouncil: '', designation: '' });
  const errorView = error ? <ApiErrorState error={error instanceof Error ? error : new Error('Doctor action failed')} /> : null;
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const find = async () => { setError(null); setMessage(''); try { const result = await api.findReceptionistDoctor(publicDoctorId.trim()); setPreview(result.doctor); } catch (nextError) { setError(nextError); } };
  const link = async () => { setError(null); try { await api.linkReceptionistDoctor(publicDoctorId.trim()); setMessage('Doctor connected to this clinic.'); } catch (nextError) { setError(nextError); } };
  const create = async (event: React.FormEvent) => { event.preventDefault(); setError(null); try { const consultationModes = modes.filter((mode) => modeState[mode].enabled).map((consultationMode) => ({ consultationMode, durationMinutes: Number(modeState[consultationMode].duration), priceCents: Math.round(Number(modeState[consultationMode].price) * 100) })); const result = await api.createReceptionistDoctor({ ...form, consultationModes }); setPreview(result.doctor); setMessage(`Doctor created with ID ${result.doctor.publicDoctorId}.`); setInvite(result.doctor.invite ? { doctorName: result.doctor.fullName, publicDoctorId: result.doctor.publicDoctorId, code: result.doctor.invite.code, expiresAt: result.doctor.invite.expiresAt } : null); } catch (nextError) { setError(nextError); } };
  return <div><div className="eyebrow">Clinic team</div><h1 className="page-title">Add Doctor</h1><p className="page-lead">Connect an existing professional profile or create one for this clinic.</p><div className="mt-6 flex flex-wrap gap-3"><button className={`mode-tab ${tab === 'details' ? 'active' : ''}`} onClick={() => setTab('details')}>Fill Doctor Details</button><button className={`mode-tab ${tab === 'id' ? 'active' : ''}`} onClick={() => setTab('id')}>Find Doctor by ID</button></div><div className="mt-5">{errorView}</div>{message && <p className="mt-5 text-sm font-semibold text-emerald-700">{message}</p>}{invite && <DoctorInviteCard {...invite} />}{tab === 'id' ? <section className="surface mt-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><Field label="Permanent Doctor ID" placeholder="OMD-A1B2C3D4" value={publicDoctorId} onChange={(event) => setPublicDoctorId(event.target.value.toUpperCase())} /></div><Button onClick={() => void find()} disabled={!publicDoctorId.trim()}>Find Doctor</Button></div>{preview && <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-5"><p className="label">Doctor preview</p><h2 className="mt-1 font-display text-2xl font-semibold">{preview.fullName}</h2><p className="mt-2">{preview.publicDoctorId} · {preview.specialization}</p><p className="mt-2 text-sm">{preview.qualifications} · Registration {preview.registrationNumber} ({preview.registrationCouncil})</p><p className="mt-3 text-sm text-slate-600">{preview.consultationModes.map((mode) => `${mode.consultationMode}: ₹${mode.priceCents / 100}`).join(' · ')}</p><Button className="mt-4" onClick={() => void link()}>Add Doctor to Clinic</Button></div>}</section> : <form className="surface mt-6 grid gap-4" onSubmit={create}><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} required /><Field label="Specialization" value={form.specialization} onChange={(event) => update('specialization', event.target.value)} required /><Field label="Qualifications" value={form.qualifications} onChange={(event) => update('qualifications', event.target.value)} required /><Field label="Registration number" value={form.registrationNumber} onChange={(event) => update('registrationNumber', event.target.value)} required /><Field label="Registration council" value={form.registrationCouncil} onChange={(event) => update('registrationCouncil', event.target.value)} required /><Field label="Designation" value={form.designation} onChange={(event) => update('designation', event.target.value)} /></div><div className="flex flex-wrap gap-3">{modes.map((mode) => { const value = modeState[mode]; return <div className="metric-card min-w-44 flex-1" key={mode}><strong className="block capitalize">{mode.replace('_', ' ')}</strong><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={value.enabled} onChange={(event) => setModeState((current) => ({ ...current, [mode]: { ...current[mode], enabled: event.target.checked } }))} /> Enabled</label>{value.enabled && <><Field label="Fee (INR)" type="number" value={value.price} onChange={(event) => setModeState((current) => ({ ...current, [mode]: { ...current[mode], price: event.target.value } }))} required /><Field label="Duration (minutes)" type="number" value={value.duration} onChange={(event) => setModeState((current) => ({ ...current, [mode]: { ...current[mode], duration: event.target.value } }))} required /></>}</div>; })}</div><Button type="submit" disabled={!modes.some((mode) => modeState[mode].enabled && Number(modeState[mode].price) > 0)}>Create Doctor</Button></form>}</div>;
}
