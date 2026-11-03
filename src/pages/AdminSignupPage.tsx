import { useState, type FormEvent } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { ApiErrorState, Button, Field } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';

export function AdminSignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const isAlreadyInitialized =
    error instanceof ApiError &&
    (error.status === 409 || error.message.toLowerCase().includes('already been created'));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError(new ApiError(400, 'Passwords do not match'));
      return;
    }
    setBusy(true);
    try {
      await api.registerFirstAdmin(form);
      navigate('/', { replace: true, state: { message: 'Admin account created. Sign in to continue.' } });
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f6] px-4 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl items-center">
        <section className="surface w-full">
          <div className="mb-6 flex justify-center">
            <BrandLogo />
          </div>
          <div className="eyebrow">OneMinute Admin</div>
          <h1 className="page-title mt-2">Create the first admin</h1>
          <p className="page-lead">This bootstrap page works only while no admin account exists.</p>

          {isAlreadyInitialized ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <Lock className="mx-auto mb-3 text-amber-700" size={32} />
              <h2 className="font-display text-lg font-semibold text-amber-950">
                Admin Console Already Initialized
              </h2>
              <p className="mt-2 text-sm text-amber-800">
                An administrator account has already been created. For platform security, public admin registration is permanently locked.
              </p>
              <div className="mt-6">
                <Link to="/" className="button button-primary inline-flex items-center gap-2">
                  <span>Sign in as Admin</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={submit}>
              {error ? <ApiErrorState error={error} /> : null}
              <Field
                label="Full Name"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                autoComplete="name"
                required
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
                required
              />
              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <Field
                label="Confirm Password"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <Button disabled={busy}>
                {busy ? 'Creating admin…' : <>Create admin <ArrowRight size={17} /></>}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-slate-500">
            Already have an admin account? <Link className="font-semibold text-teal-700" to="/">Sign in</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
