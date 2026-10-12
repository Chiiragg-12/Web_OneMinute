import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Button, Field, ApiErrorState } from '../components/ui';
import type { Clinic } from '../types/api';

export function DoctorClinicLinking({ onContinue, professionalProfileComplete = false }: { onContinue: () => void; professionalProfileComplete?: boolean }) {
  const [publicClinicId, setPublicClinicId] = useState('');
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const autoContinued = useRef(false);
  useEffect(() => {
    // Never leave an already-ACTIVE Doctor stuck on this screen needing a manual click.
    if (membershipStatus === 'active' && !autoContinued.current) {
      autoContinued.current = true;
      onContinue();
    }
  }, [membershipStatus, onContinue]);
  const findClinic = async () => {
    setError(null); setClinic(null); setMembershipStatus(null); setLinked(false);
    const normalized = publicClinicId.trim().toUpperCase();
    if (!/^OMC-[A-Z0-9]{8}$/.test(normalized)) { setError(new Error('Invalid Clinic ID')); return; }
    setBusy(true);
    try { const result = await api.resolveDoctorClinic(normalized); setPublicClinicId(normalized); setClinic(result.clinic); setMembershipStatus(result.membership?.status ?? null); }
    catch { setError(new Error('Clinic not found / Invalid Clinic ID')); }
    finally { setBusy(false); }
  };
  const linkClinic = async () => {
    if (!clinic) return;
    setBusy(true); setError(null);
    try { await api.linkDoctorClinic(clinic.publicClinicId); setLinked(true); }
    catch (nextError) { setError(nextError); }
    finally { setBusy(false); }
  };
  return <section className="surface mt-8"><div className="eyebrow">Clinic linking</div><h1 className="page-title">Register for a Clinic</h1><p className="page-lead">Enter the Clinic ID shared by the receptionist.</p>{error !== null && <ApiErrorState error={error instanceof Error ? error : new Error('Could not link clinic')} />}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><Field label="Clinic ID" value={publicClinicId} onChange={(event) => setPublicClinicId(event.target.value.toUpperCase())} placeholder="OMC-XXXXXXXX" /><Button type="button" variant="quiet" disabled={busy} onClick={() => void findClinic()}>{busy ? 'Checking…' : 'Find clinic'}</Button></div>{clinic && <div className="action-card mt-5 flex-col items-stretch gap-3 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><strong className="break-words">{clinic.name}</strong><span className="mt-1 block break-words">{clinic.publicClinicId}</span><span className="mt-1 block break-words">{clinic.address ?? clinic.city ?? 'Clinic details available'}</span></div>{membershipStatus === 'active' ? <div className="min-w-0 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">You&apos;re already linked to this clinic.</div> : membershipStatus === 'pending' ? <div className="min-w-0 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">Request already sent. Waiting for receptionist approval.</div> : <Button className="w-full shrink-0 sm:w-auto" type="button" disabled={busy || linked} onClick={() => void linkClinic()}>{linked ? 'Request sent' : 'Request to join clinic'}</Button>}</div>}{(linked || membershipStatus === 'active') && <Button className="mt-5 w-full sm:w-auto" type="button" onClick={onContinue}>{membershipStatus === 'active' ? 'Go to Dashboard' : professionalProfileComplete ? 'Continue' : 'Continue to professional profile'}</Button>}</section>;
}
