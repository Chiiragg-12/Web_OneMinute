import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, SearchX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="loading-delayed flex min-h-48 flex-col items-center justify-center gap-3 text-slate-500" role="status"><LoaderCircle className="animate-spin text-teal-600" size={26} /><span>{label}</span></div>;
}

export function EmptyState({ title, message, icon: Icon = SearchX }: { title: string; message: string; icon?: typeof SearchX }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center"><Icon className="mx-auto mb-3 text-slate-400" size={30} /><h2 className="font-display text-xl font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-500">{message}</p></div>;
}

export function ApiErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const title = apiError?.status === 401 ? 'Your session has ended' : apiError?.status === 409 ? 'That action needs attention' : 'We could not load this yet';
  const message = error instanceof Error ? error.message : 'Please try again in a moment.';
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert"><AlertCircle className="mb-3 text-rose-600" size={25} /><h2 className="font-display text-xl font-semibold text-rose-950">{title}</h2><p className="mt-2 text-sm text-rose-800">{message}</p>{onRetry && <button className="button button-danger mt-5" onClick={onRetry} type="button">Try again</button>}</div>;
}

export function UnauthorizedState() {
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><LockKeyhole className="mx-auto mb-3 text-amber-700" size={28} /><h2 className="font-display text-xl font-semibold text-amber-950">Sign in required</h2><p className="mt-2 text-sm text-amber-800">This patient area is protected. Sign in to continue.</p></div>;
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={18} />{children}</div>;
}

export function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  const isPassword = props.type === 'password';
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {isPassword ? (
        <span className="relative block">
          <input className="field pr-12" {...props} type={shown ? 'text' : 'password'} />
          <button type="button" className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-teal-700" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={() => setShown((value) => !value)}>{shown ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </span>
      ) : <input className="field" {...props} />}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' | 'success' }) {
  return <button className={`button button-${variant}`} {...props}>{children}</button>;
}
