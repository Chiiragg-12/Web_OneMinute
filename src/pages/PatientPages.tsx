import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getCurrentDeviceLocation } from "../utils/location";
import type { CareDiscoveryResult, Clinic, ConsultationMode, Doctor, PublicDoctor } from "../types/api";
import {
  ApiErrorState,
  Button,
  EmptyState,
  Field,
  LoadingState,
  SuccessMessage,
} from "../components/ui";

export function DashboardPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated" || !state.patient) return null;
  return (
    <div className="min-w-0 w-full">
      <div className="eyebrow">Patient overview</div>
      <h1 className="page-title">
        Good morning, {state.patient.fullName.split(" ")[0]}.
      </h1>
      <p className="page-lead">Your care details are ready when you are.</p>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <section className="hero-panel min-w-0">
          <div className="relative z-10">
            <span className="tag tag-warm">
              <ShieldCheck size={14} />
              Verified profile
            </span>
            <h2 className="mt-6 max-w-md font-display text-3xl font-semibold leading-tight text-white">
              Your permanent Health ID travels with you.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-teal-100/75">
              Use it whenever a clinic needs to find your patient record.
            </p>
            <Link className="button button-warm mt-7" to="/app/profile">
              View profile <ArrowRight size={17} />
            </Link>
          </div>
          <HeartPulse
            className="absolute -bottom-4 right-5 text-teal-800/70"
            size={150}
            strokeWidth={0.8}
          />
        </section>
        <section className="health-card min-w-0">
          <p className="label">Health ID</p>
          <p className="mt-3 break-all font-display text-2xl font-semibold tracking-tight text-slate-950">
            {state.patient.healthId}
          </p>
          <p className="mt-3 text-sm text-slate-500">Permanent and read-only</p>
        </section>
      </div>
      <section className="surface mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Health snapshot</div>
            <h2 className="section-title">Your body metrics</h2>
          </div>
          <Link className="text-sm font-bold text-teal-700" to="/app/profile">
            Update health details <ArrowRight className="inline" size={15} />
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="metric-card">
            <p className="label">BMI</p>
            <p className="mt-2 font-display text-2xl font-semibold">
              {state.patient.bmi ?? "Not available"}
            </p>
          </div>
          <div className="metric-card">
            <p className="label">Height</p>
            <p className="mt-2 font-display text-2xl font-semibold">
              {state.patient.heightCm != null
                ? `${state.patient.heightCm} cm`
                : "Not added"}
            </p>
          </div>
          <div className="metric-card">
            <p className="label">Weight</p>
            <p className="mt-2 font-display text-2xl font-semibold">
              {state.patient.weightKg != null
                ? `${state.patient.weightKg} kg`
                : "Not added"}
            </p>
          </div>
        </div>
      </section>
      <div className="mt-8 flex items-end justify-between">
        <div>
          <div className="eyebrow">Next step</div>
          <h2 className="section-title">Find care near you</h2>
        </div>
        <Link className="text-sm font-bold text-teal-700" to="/app/clinics">
          Browse clinics <ArrowRight className="inline" size={15} />
        </Link>
      </div>
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <QuickLink
          icon={MapPin}
          title="Browse clinics"
          text="Explore active clinics and their doctors."
          to="/app/clinics"
        />
        <QuickLink
          icon={UserRound}
          title="Your profile"
          text="Keep your contact details up to date."
          to="/app/profile"
        />
        <QuickLink
          icon={ShieldCheck}
          title="My CareGuard Plan"
          text="Medicine reminders, check-ins and follow-ups from your doctor."
          to="/app/careguard"
        />
      </section>
    </div>
  );
}
function QuickLink({
  icon: Icon,
  title,
  text,
  to,
}: {
  icon: typeof MapPin;
  title: string;
  text: string;
  to: string;
}) {
  return (
    <Link className="action-card" to={to}>
      <span className="icon-tile">
        <Icon size={19} />
      </span>
      <span>
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <ArrowRight className="ml-auto text-slate-400" size={18} />
    </Link>
  );
}

export function ProfilePage() {
  const { state, updatePatient } = useAuth();
  if (state.status !== "authenticated" || !state.patient) return null;
  const patient = state.patient;
  const [form, setForm] = useState({
    fullName: patient.fullName,
    email: patient.email ?? "",
    phone: patient.phone ?? "",
    gender: patient.gender ?? "",
    dob: patient.dob?.slice(0, 10) ?? "",
    heightCm: patient.heightCm != null ? String(patient.heightCm) : "",
    weightKg: patient.weightKg != null ? String(patient.weightKg) : "",
    sex: patient.sex ?? "",
  });
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updatePatient({
        fullName: form.fullName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        sex: form.sex || undefined,
      });
      setSaved(true);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="eyebrow">Your details</div>
      <h1 className="page-title">Profile & Health ID</h1>
      <p className="page-lead">
        Your Health ID is permanent. Contact details can be updated here.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
        <section className="health-card bg-teal-950 text-white">
          <p className="label text-teal-200">Permanent Health ID</p>
          <p className="mt-5 break-all font-display text-3xl font-semibold">
            {patient.healthId}
          </p>
          <p className="mt-5 text-sm leading-6 text-teal-100/70">
            This identifier belongs to your patient record and cannot be edited.
          </p>
        </section>
        <div className="space-y-6">
          {error ? <ApiErrorState error={error} /> : null}
          {saved && <SuccessMessage>Profile updated.</SuccessMessage>}
          <form onSubmit={submit}>
            <section className="surface">
              <div className="mb-6 flex items-center gap-3">
                <span className="icon-tile">
                  <UserRound size={18} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    Personal details
                  </h2>
                  <p className="text-sm text-slate-500">
                    Only your own patient profile is shown.
                  </p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Full name"
                    value={form.fullName}
                    onChange={(event) =>
                      setForm({ ...form, fullName: event.target.value })
                    }
                    required
                  />
                </div>
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
                <Field
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
                <Field
                  label="Gender"
                  value={form.gender}
                  onChange={(event) =>
                    setForm({ ...form, gender: event.target.value })
                  }
                />
              </div>
            </section>
            <section className="surface mt-6">
              <div className="mb-6 flex items-center gap-3">
                <span className="icon-tile">
                  <HeartPulse size={18} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    Health profile
                  </h2>
                  <p className="text-sm text-slate-500">
                    Your BMI is calculated automatically from height and weight.
                  </p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Height (cm)"
                  type="number"
                  min="50"
                  max="250"
                  value={form.heightCm}
                  onChange={(event) =>
                    setForm({ ...form, heightCm: event.target.value })
                  }
                />
                <Field
                  label="Weight (kg)"
                  type="number"
                  min="2"
                  max="500"
                  value={form.weightKg}
                  onChange={(event) =>
                    setForm({ ...form, weightKg: event.target.value })
                  }
                />
                <Field
                  label="Date of birth"
                  type="date"
                  value={form.dob}
                  onChange={(event) =>
                    setForm({ ...form, dob: event.target.value })
                  }
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Sex
                  </span>
                  <select
                    className="field"
                    value={form.sex}
                    onChange={(event) =>
                      setForm({ ...form, sex: event.target.value })
                    }
                  >
                    <option value="">Not set</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="label">BMI</p>
                <p className="mt-2 font-display text-2xl font-semibold text-slate-950">
                  {patient.bmi ?? "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Calculated from your current height and weight.
                </p>
              </div>
              <Button className="mt-6" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </section>
          </form>
        </div>
      </div>
    </div>
  );
}

export function HealthProfileOnboarding({ onSkip }: { onSkip: () => void }) {
  const { updatePatient } = useAuth();
  const [form, setForm] = useState({
    heightCm: "",
    weightKg: "",
    dob: "",
    sex: "",
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await updatePatient({
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        dob: form.dob || undefined,
        sex: form.sex || undefined,
      });
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#f4f8f6] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-lg">
        <div className="surface">
          <div className="eyebrow">One quick step</div>
          <h1 className="page-title mt-1 text-3xl">
            Complete your health profile
          </h1>
          <p className="page-lead">
            Your BMI will be calculated automatically.
          </p>
          {error ? (
            <div className="mt-5">
              <ApiErrorState error={error} />
            </div>
          ) : null}
          <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={submit}>
            <Field
              label="Height (cm)"
              type="number"
              min="50"
              max="250"
              value={form.heightCm}
              onChange={(event) =>
                setForm({ ...form, heightCm: event.target.value })
              }
            />
            <Field
              label="Weight (kg)"
              type="number"
              min="2"
              max="500"
              value={form.weightKg}
              onChange={(event) =>
                setForm({ ...form, weightKg: event.target.value })
              }
            />
            <Field
              label="Date of birth"
              type="date"
              value={form.dob}
              onChange={(event) =>
                setForm({ ...form, dob: event.target.value })
              }
            />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Sex
              </span>
              <select
                className="field"
                value={form.sex}
                onChange={(event) =>
                  setForm({ ...form, sex: event.target.value })
                }
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>
            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row">
              <Button disabled={busy}>
                {busy ? "Saving…" : "Save and continue"}
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={onSkip}
              >
                Skip for now
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ClinicsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const specialty = searchParams.get('specialty') ?? '';
  const maxDistanceKm = Number(searchParams.get('distance')) || undefined;
  const maxPrice = Number(searchParams.get('price')) || undefined;
  const modes = searchParams.getAll('mode') as ConsultationMode[];
  const [results, setResults] = useState<CareDiscoveryResult[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const setFilters = (next: { specialty?: string; distance?: number; price?: number; modes?: ConsultationMode[] }) => { const query = new URLSearchParams(); const nextSpecialty = 'specialty' in next ? next.specialty : specialty; const nextDistance = 'distance' in next ? next.distance : maxDistanceKm; const nextPrice = 'price' in next ? next.price : maxPrice; const nextModes = 'modes' in next ? next.modes! : modes; if (nextSpecialty) query.set('specialty', nextSpecialty); if (nextDistance) query.set('distance', String(nextDistance)); if (nextPrice) query.set('price', String(nextPrice)); nextModes.forEach((mode) => query.append('mode', mode)); setSearchParams(query); };
  const load = () => {
    setLoading(true);
    void api
      .discoverCare({ specialty: specialty || undefined, maxDistanceKm, maxPrice, consultationModes: modes, ...(location ?? {}) })
      .then((result) => { setResults(result.results); setSpecialties(result.specialties); })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [specialty, maxDistanceKm, maxPrice, modes.join(','), location?.latitude, location?.longitude]);
  const useCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationMessage(null);
    try {
      const current = await getCurrentDeviceLocation();
      setLocation({ latitude: current.latitude, longitude: current.longitude });
      setLocationMessage(current.isApproximate ? `Using approximate location (about ${Math.round(current.accuracyMeters)} m accuracy).` : null);
    } catch (nextError) {
      setLocation(null);
      setLocationMessage(nextError instanceof Error ? nextError.message : 'Your current location is unavailable.');
    } finally {
      setLocationLoading(false);
    }
  };
  const toggleMode = (mode: ConsultationMode) => setFilters({ modes: modes.includes(mode) ? modes.filter((item) => item !== mode) : [...modes, mode] });
  return (
    <div>
      <div className="eyebrow">Find care</div>
      <h1 className="page-title">Find the right care</h1>
      <p className="page-lead">
        Search doctors by specialty, location, consultation type and price.
      </p>
      <section className="surface mt-6 grid gap-4 lg:grid-cols-4">
        <label><span className="mb-2 block text-sm font-semibold">Specialty / Doctor Type</span><input className="field" list="specialties" value={specialty} onChange={(event) => setFilters({ specialty: event.target.value })} placeholder="All Specialties" /><datalist id="specialties">{specialties.map((item) => <option key={item} value={item} />)}</datalist></label>
        <label><span className="mb-2 block text-sm font-semibold">Distance</span><select className="field" value={maxDistanceKm ?? ''} disabled={!location} onChange={(event) => setFilters({ distance: event.target.value ? Number(event.target.value) : undefined })}><option value="">All distances</option>{[5, 10, 15, 20, 25, 30].map((value) => <option value={value} key={value}>Within {value} km</option>)}</select></label>
        <label><span className="mb-2 block text-sm font-semibold">Consultation Price</span><select className="field" value={maxPrice ?? ''} onChange={(event) => setFilters({ price: event.target.value ? Number(event.target.value) : undefined })}><option value="">Any Price</option>{[200000, 300000, 400000, 500000, 600000].map((value) => <option value={value} key={value}>Up to {formatMoney(value)}</option>)}</select></label>
        <div><span className="mb-2 block text-sm font-semibold">Nearby care</span><Button type="button" variant="quiet" onClick={() => void useCurrentLocation()} disabled={locationLoading}>{locationLoading ? 'Getting location...' : 'Use Current Location'}</Button></div>
        <div className="lg:col-span-4"><span className="mb-2 block text-sm font-semibold">Consultation Mode</span><div className="flex flex-wrap gap-2">{([{ value: 'in_person', label: 'In-Person' }, { value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio' }, { value: 'chat', label: 'Chat' }] as const).map(({ value, label }) => <Button type="button" key={value} variant={modes.includes(value) ? 'primary' : 'quiet'} onClick={() => toggleMode(value)}>{label}</Button>)}<Button type="button" variant="quiet" onClick={() => { setLocationMessage(null); setFilters({ specialty: '', distance: undefined, price: undefined, modes: [] }); }}>Clear Filters</Button></div></div>
        {locationMessage && <p className="text-sm text-slate-600 lg:col-span-4">{locationMessage}</p>}
      </section>
      {loading ? (
        <LoadingState label="Finding care options" />
      ) : error ? (
        <div className="mt-8">
          <ApiErrorState error={error} onRetry={load} />
        </div>
      ) : results.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No doctors found for these filters."
            message="Clear filters to see other available care options."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {results.map((result) => (
            <Link
              className="clinic-card"
              to={`/app/clinics/${result.clinic.id}/doctors/${result.doctor.id}`}
              key={`${result.clinic.id}-${result.doctor.id}`}
            >
              <span className="icon-tile">
                <MapPin size={19} />
              </span>
              <span className="min-w-0">
                <strong>{result.doctor.fullName}</strong>
                <span>
                  {result.doctor.specialization || 'General care'} · {result.clinic.name}
                </span>
                <small>{result.clinic.address || 'Address available at the clinic'}{result.distanceKm !== null ? ` · ${result.distanceKm.toFixed(1)} km away` : location ? ' · Distance unavailable for this clinic' : ''}</small>
                <small>{result.options.map((option) => `${option.consultationMode.replace('_', ' ')} from ${formatMoney(option.priceCents)}`).join(' · ')}</small>
              </span>
              <ArrowRight
                className="ml-auto shrink-0 text-slate-400"
                size={18}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClinicPage() {
  const { clinicId } = useParams();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!clinicId) return;
    void Promise.all([api.getClinic(clinicId), api.listClinicDoctors(clinicId)])
      .then(([clinicResult, doctorsResult]) => {
        setClinic(clinicResult.clinic);
        setDoctors(doctorsResult.doctors);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [clinicId]);
  if (loading) return <LoadingState label="Loading clinic" />;
  if (error) return <ApiErrorState error={error} />;
  if (!clinic)
    return (
      <EmptyState
        title="Clinic not found"
        message="This clinic is no longer available."
      />
    );
  return (
    <div>
      <Link className="back-link" to="/app/clinics">
        <ArrowLeft size={16} />
        All clinics
      </Link>
      <div className="mt-6 eyebrow">Clinic details</div>
      <h1 className="page-title">{clinic.name}</h1>
      <p className="page-lead">
        {clinic.address || "Care team and consultation options"}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="tag">
          <Clock3 size={14} />
          {clinic.timezone}
        </span>
        <span className="tag">
          <MapPin size={14} />
          Active clinic
        </span>
      </div>
      <div className="mt-10 flex items-end justify-between">
        <div>
          <div className="eyebrow">Care team</div>
          <h2 className="section-title">Doctors at this clinic</h2>
        </div>
        <span className="text-sm text-slate-500">
          {doctors.length} available
        </span>
      </div>
      {doctors.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No doctors listed"
            message="This clinic has no active doctors available right now."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {doctors.map((doctor) => (
            <Link
              className="doctor-card"
              to={`/app/clinics/${clinic.id}/doctors/${doctor.id}`}
              key={doctor.id}
            >
              <span className="doctor-avatar">
                <Stethoscope size={20} />
              </span>
              <span>
                <strong>{doctor.fullName}</strong>
                <span>{doctor.specialization || "General care"}</span>
              </span>
              <ArrowRight className="ml-auto text-slate-400" size={18} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DoctorPage() {
  const { clinicId, doctorId } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [options, setOptions] = useState<
    { consultationMode: string; durationMinutes: number; priceCents: number }[]
  >([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!clinicId || !doctorId) return;
    void Promise.all([
      api.getDoctor(doctorId),
      api.getDoctorOptions(clinicId, doctorId),
    ])
      .then(([doctorResult, optionsResult]) => {
        setDoctor(doctorResult.doctor);
        setOptions(optionsResult.options);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [clinicId, doctorId]);
  if (loading) return <LoadingState label="Loading doctor" />;
  if (error) return <ApiErrorState error={error} />;
  if (!doctor)
    return (
      <EmptyState
        title="Doctor not found"
        message="This doctor is no longer available."
      />
    );
  const clinic = doctor.clinics.find((item) => item.id === clinicId);
  return (
    <div>
      <Link className="back-link" to={`/app/clinics/${clinicId}`}>
        <ArrowLeft size={16} />
        Back to {clinic?.name || "clinic"}
      </Link>
      <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="doctor-avatar size-16">
          <Stethoscope size={28} />
        </span>
        <div>
          <div className="eyebrow">Doctor profile</div>
          <h1 className="page-title mt-1">{doctor.fullName}</h1>
          <p className="page-lead">{doctor.specialization || "General care"}</p>
        </div>
      </div>
      <section className="surface mt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Available consultations</div>
            <h2 className="section-title">Choose how you want to meet</h2>
          </div>
          <HeartPulse className="text-teal-600" size={25} />
        </div>
        {options.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No options configured"
              message="This doctor has not published consultation options yet."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {options.map((option) => (
              <button
                className="option-card text-left"
                key={`${option.consultationMode}-${option.durationMinutes}`}
                onClick={() =>
                  navigate(
                    `/app/clinics/${clinicId}/doctors/${doctorId}/book`,
                    { state: option },
                  )
                }
              >
                <span>
                  <strong>{option.consultationMode.replace("_", " ")}</strong>
                  <span>{option.durationMinutes} minutes</span>
                </span>
                <span className="font-display text-lg font-semibold text-teal-800">
                  {formatMoney(option.priceCents)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
