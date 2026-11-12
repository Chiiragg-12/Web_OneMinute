import { useEffect, useState } from 'react';
import { api, type AdminDoctor } from '../api/client';
import { ApiErrorState, Button, EmptyState, LoadingState, SuccessMessage } from '../components/ui';

type Filter = 'pending' | 'verified' | 'all';
const filters: { value: Filter; label: string }[] = [{ value: 'pending', label: 'Waiting for check' }, { value: 'verified', label: 'Verified' }, { value: 'all', label: 'All doctors' }];

// A doctor is only shown to patients, and can only be booked, after an administrator has checked the registration here.
export function AdminDoctorsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = (next: Filter) => {
    setError(null); setDoctors(null);
    void api.getAdminDoctors(next).then((result) => setDoctors(result.doctors)).catch(setError);
  };
  useEffect(() => { load(filter); }, [filter]);

  const decide = async (doctor: AdminDoctor, verify: boolean) => {
    setBusyId(doctor.id); setError(null); setMessage(null);
    try {
      await (verify ? api.verifyDoctor(doctor.id) : api.revokeDoctor(doctor.id));
      setMessage(verify ? `${doctor.fullName} is verified and can now be booked.` : `${doctor.fullName} is no longer verified and is hidden from patients.`);
      load(filter);
    } catch (cause) { setError(cause); } finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="eyebrow">Platform</div>
      <h1 className="page-title">Doctor verification</h1>
      <p className="page-lead">Check each doctor&apos;s registration number and council with the medical council before verifying. Patients only see and book verified doctors.</p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Doctor filter">
        {filters.map((option) => (
          <button key={option.value} role="tab" aria-selected={filter === option.value} className={`button ${filter === option.value ? 'button-primary' : 'button-outline'}`} onClick={() => setFilter(option.value)}>{option.label}</button>
        ))}
      </div>

      {message ? <div className="mt-4"><SuccessMessage>{message}</SuccessMessage></div> : null}
      {error ? <div className="mt-4"><ApiErrorState error={error} onRetry={() => load(filter)} /></div> : null}
      {!doctors && !error ? <LoadingState label="Loading doctors" /> : null}
      {doctors && doctors.length === 0 ? <div className="mt-6"><EmptyState title="No doctors here" message={filter === 'pending' ? 'No doctor is waiting for a check.' : 'No doctors match this filter.'} /></div> : null}

      <div className="mt-6 grid gap-4">
        {doctors?.map((doctor) => (
          <section className="surface" key={doctor.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">{doctor.fullName}</h2>
                <p className="text-sm text-slate-500">{[doctor.specialization, doctor.qualifications].filter(Boolean).join(' · ') || 'No specialty entered'}</p>
                <p className="mt-1 text-sm text-slate-500">{doctor.email ?? doctor.phone ?? 'No contact'} · {doctor.publicDoctorId ?? 'No Doctor ID'}</p>
                <p className="mt-2 text-sm"><span className="font-semibold">Registration:</span> {doctor.registrationNumber ? `${doctor.registrationNumber}${doctor.registrationCouncil ? ` (${doctor.registrationCouncil})` : ''}` : <span className="text-amber-700">not entered yet</span>}</p>
                <p className="mt-1 text-sm text-slate-500">Clinics: {doctor.clinics.length ? doctor.clinics.join(', ') : 'not linked to a clinic'}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={doctor.verified ? 'text-sm font-semibold text-teal-700' : 'text-sm font-semibold text-amber-700'}>{doctor.verified ? 'Verified' : 'Not verified'}</span>
                {doctor.verified
                  ? <Button variant="outline" disabled={busyId === doctor.id} onClick={() => void decide(doctor, false)}>Remove verification</Button>
                  : <Button disabled={busyId === doctor.id || !doctor.registrationNumber} onClick={() => void decide(doctor, true)}>Verify doctor</Button>}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
