import { ArrowRight } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ApiErrorState, Button, Field } from "../components/ui";
import { BrandLogo } from "../components/BrandLogo";

function AuthFrame({
  children,
  title,
  eyebrow,
  supportingText,
  loginPath,
}: {
  children: ReactNode;
  title: string;
  eyebrow: string;
  supportingText: string;
  loginPath: string;
}) {
  return (
    <div className="min-h-screen bg-[#f4f8f6] px-4 py-8 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="relative hidden overflow-hidden bg-teal-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-20 size-72 rounded-full border border-teal-700/50" />
          <div className="absolute -bottom-28 -left-24 size-80 rounded-full border border-amber-300/20" />
          <Link
            to={loginPath}
            className="relative inline-flex w-fit rounded-2xl bg-white p-3"
          >
            <BrandLogo />
          </Link>
          <div className="relative max-w-sm">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
              {eyebrow}
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[1.02]">
              {supportingText}
            </h1>
            <p className="mt-6 max-w-xs text-base leading-7 text-teal-100/80">
              Care tools shaped for your role.
            </p>
          </div>
          <p className="relative text-xs text-teal-200/60">
            Secure access to your OneMinute Healthcare workspace.
          </p>
        </section>
        <section className="flex items-center p-6 sm:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-5 flex justify-center lg:hidden">
              <BrandLogo />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
              {eyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {supportingText}
            </p>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

type WebRole = "receptionist" | "admin";

function homeForRole(role: WebRole) {
  return role === "admin" ? "/admin" : "/receptionist";
}
export function safeReturnTo(value: unknown, role: WebRole) {
  const fallback = homeForRole(role);
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return fallback;
  const allowedPrefix = homeForRole(role);
  return value === allowedPrefix ||
    value.startsWith(`${allowedPrefix}/`) ||
    value.startsWith(`${allowedPrefix}?`)
    ? value
    : fallback;
}
function useAuthRedirect(audience?: WebRole) {
  const { state } = useAuth();
  if (
    state.status !== "authenticated" ||
    (state.user.role !== "receptionist" && state.user.role !== "admin") ||
    (audience && state.user.role !== audience)
  )
    return null;
  return <Navigate to={homeForRole(state.user.role)} replace />;
}

function GoogleButton({
  role,
  onError,
  onCredential,
}: {
  role: "receptionist";
  onError: (error: unknown) => void;
  onCredential?: (credential: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { googleLogin } = useAuth();
  useEffect(() => {
    if (!ref.current) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
      | string
      | undefined;
    if (!clientId) return;
    const render = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !ref.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) =>
          void (
            onCredential
              ? onCredential(response.credential)
              : googleLogin(response.credential, role)
          ).catch(onError),
      });
      google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        width: Math.min(360, ref.current.clientWidth),
      });
    };
    if ((window as any).google) render();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
      return () => script.remove();
    }
  }, [googleLogin, onCredential, onError, role]);
  return (
    <div
      ref={ref}
      className="mt-5 min-h-10"
      aria-label="Continue with Google"
    />
  );
}

function LoginError({ error }: { error: unknown }) {
  const apiError = error instanceof ApiError ? error : null;
  const rawMessage = error instanceof Error ? error.message : "";
  const message =
    apiError?.status === 401 ||
    /Missing refresh token|Invalid or expired refresh token/.test(rawMessage)
      ? "Invalid email/phone or password."
      : rawMessage || "Please try again.";
  return (
    <div
      className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5"
      role="alert"
    >
      <h3 className="font-display text-lg font-semibold text-rose-950">
        Unable to sign in
      </h3>
      <p className="mt-2 text-sm text-rose-800">{message}</p>
    </div>
  );
}

function SessionExpiredNotice() {
  return (
    <div
      className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"
      role="status"
    >
      <h3 className="font-display text-lg font-semibold text-amber-950">
        Your session has expired
      </h3>
      <p className="mt-2 text-sm text-amber-800">Please sign in again.</p>
    </div>
  );
}

export function LoginPage({
  audience = "receptionist",
}: {
  audience?: WebRole;
}) {
  const redirect = useAuthRedirect(audience);
  if (redirect) return redirect;
  const { login, logout, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const copy =
    audience === "admin"
      ? {
          app: "ADMIN CONSOLE",
          title: "Financial operations",
          supporting:
            "Review verified collections, obligations and settlements.",
          path: "/admin/login",
          role: "admin" as const,
        }
      : {
          app: "RECEPTIONIST APP",
          title: "Welcome back",
          supporting: "Sign in to coordinate your clinic day.",
          path: "/receptionist/login",
          role: "receptionist" as const,
        };
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const role = await login({
        ...(identifier.includes("@")
          ? { email: identifier }
          : { phone: identifier }),
        password,
      });
      if (role !== copy.role) {
        await logout(role);
        throw new ApiError(
          403,
          `This login is for ${copy.app.toLowerCase()} accounts.`,
        );
      }
      navigate(
        safeReturnTo((location.state as { from?: unknown } | null)?.from, role),
        { replace: true },
      );
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthFrame
      eyebrow={copy.app}
      title={copy.title}
      supportingText={copy.supporting}
      loginPath={copy.path}
    >
      {sessionExpired ? <SessionExpiredNotice /> : null}
      <form className="mt-8 space-y-5" onSubmit={submit}>
        {error ? <LoginError error={error} /> : null}
        <Field
          label="Email or phone"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          required
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          placeholder="Your password"
        />
        <Button disabled={busy}>
          {busy ? (
            "Signing in…"
          ) : (
            <>
              Sign in <ArrowRight size={17} />
            </>
          )}
        </Button>
      </form>
      {copy.role !== "admin" ? (
        <>
          <div className="my-5 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            or
          </div>
          <GoogleButton role={copy.role} onError={setError} />
          <p className="mt-7 text-sm text-slate-500">
            New to OneMinute?{" "}
            <Link
              className="font-semibold text-teal-700 hover:text-teal-900"
              to="/receptionist/register"
            >
              Create New Account
            </Link>
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Doctor or patient?{" "}
            <Link
              className="font-semibold text-teal-700 hover:text-teal-900"
              to="/get-the-app"
            >
              Use the OneMinute app
            </Link>
          </p>
        </>
      ) : null}
    </AuthFrame>
  );
}

export function StaffRegisterPage({
  role,
}: {
  role: "receptionist";
}) {
  const redirect = useAuthRedirect(role);
  if (redirect) return redirect;
  const { register, googleOnboardReceptionist } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    clinicName: "",
    clinicAddress: "",
    city: "",
    pincode: "",
    handlerName: "",
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(
        {
          clinicName: form.clinicName,
          clinicAddress: form.clinicAddress,
          city: form.city,
          pincode: form.pincode,
          handlerName: form.handlerName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          confirmPassword: form.confirmPassword,
        },
        role,
      );
      navigate("/receptionist", { replace: true });
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  const receptionistGoogle = async (credential: string) => {
    setBusy(true);
    setError(null);
    try {
      await googleOnboardReceptionist({
        credential,
        clinicName: form.clinicName,
        clinicAddress: form.clinicAddress,
        city: form.city,
        pincode: form.pincode,
        handlerName: form.handlerName,
        email: form.email,
        phone: form.phone,
      });
      navigate("/receptionist", { replace: true });
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthFrame
      eyebrow={`${role.toUpperCase()} APP`}
      title="Create your account"
      supportingText="Onboard your clinic and manage it on OneMinute."
      loginPath="/receptionist/login"
    >
      <form className="mt-8 space-y-5" onSubmit={submit}>
        {error ? <ApiErrorState error={error} /> : null}
        {role === "receptionist" ? (
          <>
            <Field
              label="Clinic Name"
              value={form.clinicName}
              onChange={(event) =>
                setForm({ ...form, clinicName: event.target.value })
              }
              required
            />
            <Field
              label="Clinic Address"
              value={form.clinicAddress}
              onChange={(event) =>
                setForm({ ...form, clinicAddress: event.target.value })
              }
              required
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="City"
                value={form.city}
                onChange={(event) =>
                  setForm({ ...form, city: event.target.value })
                }
                required
              />
              <Field
                label="Pincode"
                inputMode="numeric"
                pattern="[1-9][0-9]{5}"
                value={form.pincode}
                onChange={(event) =>
                  setForm({ ...form, pincode: event.target.value })
                }
                required
              />
            </div>
            <Field
              label="Handler Name"
              hint="Person who will manage this clinic on OneMinute"
              value={form.handlerName}
              onChange={(event) =>
                setForm({ ...form, handlerName: event.target.value })
              }
              required
            />
          </>
        ) : (
          <Field
            label="Full name"
            value={form.fullName}
            onChange={(event) =>
              setForm({ ...form, fullName: event.target.value })
            }
            required
          />
        )}
        <Field
          label="Email Address"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <Field
          label="Phone Number"
          type="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          required={role === "receptionist"}
        />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(event) =>
            setForm({ ...form, password: event.target.value })
          }
          minLength={8}
          required
        />
        {role === "receptionist" ? (
          <Field
            label="Confirm Password"
            type="password"
            value={form.confirmPassword}
            onChange={(event) =>
              setForm({ ...form, confirmPassword: event.target.value })
            }
            minLength={8}
            required
          />
        ) : null}
        <Button disabled={busy}>Create Account</Button>
      </form>
      {role === "receptionist" ? (
        <>
          <div className="my-5 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            or
          </div>
          <GoogleButton
            role="receptionist"
            onError={setError}
            onCredential={receptionistGoogle}
          />
        </>
      ) : null}
      <p className="mt-7 text-sm text-slate-500">
        Already registered?{" "}
        <Link
          className="font-semibold text-teal-700"
          to="/receptionist/login"
        >
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
