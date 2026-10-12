import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { ApiErrorState, Button, Field } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';

export function AdminSignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) { setError(new ApiError(400, 'Passwords do not match')); return; }
    setBusy(true);
    try { await api.registerFirstAdmin(form); navigate('/', { replace: true, state: { message: 'Admin account created. Sign in to continue.' } }); }
    catch (nextError) { setError(nextError); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-[#f4f8f6] px-4 py-8 sm:px-8"><div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl items-center"><section className="surface w-full"><div className="mb-6 flex justify-center"><BrandLogo /></div><div className="eyebrow">OneMinute Admin</div><h1 className="page-title mt-2">Create the first admin</h1><p className="page-lead">This bootstrap page works only while no admin account exists.</p><form className="mt-8 space-y-5" onSubmit={submit}>{error ? <ApiErrorState error={error} /> : null}<Field label="Full Name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} autoComplete="name" required /><Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required /><Field label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" minLength={8} required /><Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} autoComplete="new-password" minLength={8} required /><Button disabled={busy}>{busy ? 'Creating admin…' : <>Create admin <ArrowRight size={17} /></>}</Button></form><p className="mt-6 text-sm text-slate-500">Already have an admin account? <Link className="font-semibold text-teal-700" to="/">Sign in</Link></p></section></div></div>;
}
