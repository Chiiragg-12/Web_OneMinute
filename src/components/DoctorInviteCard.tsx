import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from './ui';

const when = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso));

export function DoctorInviteCard({ doctorName, publicDoctorId, code, expiresAt }: { doctorName: string; publicDoctorId: string | null; code: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/doctor/claim`;
  const message = `Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}: activate your OneMinute doctor account at ${link}\nDoctor ID: ${publicDoctorId ?? ''}\nInvite code: ${code} (valid until ${when(expiresAt)}, works once)`;
  const copy = async () => { try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); } };
  return (
    <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5" aria-label={`Invite for ${doctorName}`}>
      <p className="label text-amber-900">One-time invite · shown only now</p>
      <h3 className="mt-1 font-display text-xl font-semibold">{doctorName} can now activate their login</h3>
      <p className="mt-2 text-sm text-amber-950">Give them this Doctor ID and code. Until they use it, this profile has no login and the doctor cannot start consultations or write prescriptions.</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-600">Doctor ID</dt><dd className="font-mono text-lg font-semibold">{publicDoctorId}</dd></div>
        <div><dt className="text-slate-600">Invite code</dt><dd className="font-mono text-lg font-semibold">{code}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-amber-950">They open <strong>{link}</strong> and choose their own email or phone and password. The code works once and expires on {when(expiresAt)}.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void copy()}><Copy size={16} />Copy message for the doctor</Button>
        {copied && <span className="text-sm font-semibold text-emerald-700" role="status">Copied</span>}
      </div>
    </section>
  );
}
