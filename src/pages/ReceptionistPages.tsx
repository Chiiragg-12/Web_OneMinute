import { CalendarDays, CheckCircle2, Search, UserPlus, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { FinalPrescriptionContent } from "../components/FinalPrescription";
import { ReceptionistStatusPage } from './ReceptionistStatusPage';
import { useReceptionistContext } from "../components/ReceptionistLayout";
import {
  ApiErrorState,
  Button,
  EmptyState,
  Field,
  LoadingState,
} from "../components/ui";
import type {
  Appointment,
  ClinicTrialSummary,
  Prescription,
  ReceptionistAppointment,
  ReceptionistDashboard,
} from "../types/api";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-slate-900 break-words">{value}</p>
    </div>
  );
}

export function DoctorRequests() {
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof api.listDoctorRequests>>['requests']>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => { if (typeof api.listDoctorRequests !== 'function') return; void api.listDoctorRequests().then((result) => setRequests(result.requests)).catch(() => setRequests([])); };
  useEffect(load, []);
  const decide = async (id: string, action: 'approve' | 'reject') => { setBusy(id); try { if (action === 'approve') await api.approveDoctorRequest(id); else await api.rejectDoctorRequest(id); load(); } finally { setBusy(null); } };
  if (!requests.length) return null;
  return <section className="surface mt-6"><div className="eyebrow">Doctor requests</div><h2 className="section-title">Pending clinic requests</h2><div className="mt-4 grid gap-3">{requests.map((request) => <div className="action-card flex-col items-stretch gap-3 sm:flex-row sm:items-start" key={request.id}><div className="min-w-0 flex-1"><strong className="break-words">{request.doctor.fullName}</strong><span className="mt-1 block break-words">{request.doctor.publicDoctorId ?? 'Doctor ID unavailable'} · {request.doctor.specialization ?? 'Specialization not added'}</span><span className="mt-1 block break-words">{request.doctor.qualifications ?? 'Qualifications not added'}</span></div><div className="flex w-full gap-2 sm:w-auto"><Button className="flex-1 sm:flex-none" disabled={busy === request.id} onClick={() => void decide(request.id, 'approve')}>Approve</Button><Button className="flex-1 sm:flex-none" variant="quiet" disabled={busy === request.id} onClick={() => void decide(request.id, 'reject')}>Reject</Button></div></div>)}</div></section>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="metric-card">
      <p className="label">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold">{value}</p>
    </section>
  );
}

// Small, non-intrusive strip — informational only, never blocks/locks anything.
// Status/dates come straight from the backend-computed trial summary.
function PilotStatusBanner({ trial }: { trial?: ClinicTrialSummary }) {
  if (!trial || trial.status !== 'trial' || !trial.trialEndsAt) return null;
  const endsLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(trial.trialEndsAt));
  const days = trial.daysRemaining ?? 0;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-2 text-sm text-teal-900">
      <strong className="font-semibold">Free Pilot</strong>
      <span>· {days} day{days === 1 ? '' : 's'} remaining</span>
      <span>· Pilot ends: {endsLabel}</span>
      <Link className="ml-auto font-semibold underline" to="/receptionist/plans">View plans</Link>
    </div>
  );
}

const modeLabels: Record<string, string> = {
  in_person: "In Person",
  video: "Video",
  audio: "Audio",
  chat: "Chat",
};
const labels: Record<string, string> = {
  booked: "Booked",
  queued: "Queued",
  in_consultation: "In Consultation",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  waiting: "Waiting",
  serving: "Serving",
  walk_in: "Walk-In",
  pending: "Pending",
  paid: "Paid",
  pay_at_reception: "Pay at Reception",
};
const readable = (value: string) =>
  labels[value] ??
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const money = (cents: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
const healthValue = (
  value: number | string | null | undefined,
  fallback: string,
) => (value == null || value === 0 || value === "" ? fallback : String(value));
const formatDob = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Not added";

export function ReceptionistOverviewPage() {
  const [dashboard, setDashboard] = useState<ReceptionistDashboard | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  const load = () =>
    void api
      .getReceptionistDashboard()
      .then((result) => setDashboard(result.dashboard))
      .catch(setError);
  useEffect(load, []);
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!dashboard) return <LoadingState label="Loading clinic overview" />;
  const appointmentCounts = dashboard.appointmentCounts ?? dashboard.appointments.reduce<Record<string, number>>((result, appointment) => { result[appointment.consultationMode] = (result[appointment.consultationMode] ?? 0) + 1; return result; }, { total: dashboard.appointments.length });
  return (
    <div>
      <div className="eyebrow">Receptionist overview</div>
      <h1 className="page-title">Clinic day at a glance</h1>
      <p className="page-lead">
        {dashboard.clinic.name} · {dashboard.clinic.timezone}
      </p>
      <PilotStatusBanner trial={dashboard.clinic.trial} />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Today's visits"
          value={String(dashboard.appointments.length)}
        />
        <Metric label="Queued" value={String(dashboard.counts.queued ?? 0)} />
        <Metric
          label="Completed"
          value={String(dashboard.counts.completed ?? 0)}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Today's total appointments" value={String(appointmentCounts.total ?? dashboard.appointments.length)} />
        {(['in_person', 'video', 'audio', 'chat'] as const).map((mode) => <Metric key={mode} label={`Today's ${modeLabels[mode]} appointments`} value={String(appointmentCounts[mode] ?? 0)} />)}
      </div>
      <section className="surface mt-6">
        <div className="eyebrow">Doctor operations</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {dashboard.doctors.map((entry) => (
            <div className="action-card" key={entry.doctor.id}>
              <span className="doctor-avatar">
                <UserRound size={19} />
              </span>
              <span>
                <strong>{entry.doctor.fullName}</strong>
                <span>
                  {readable(entry.status)} ·{" "}
                  {Object.values(entry.waitingByMode).reduce(
                    (sum, count) => sum + count,
                    0,
                  )}{" "}
                  waiting
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
      <DoctorRequests />
    </div>
  );
}

export function ReceptionistAppointmentsPage() {
  const location = useLocation();
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'payments') return <ReceptionistStatusPage kind="payment" />;
  if (view === 'consultations') return <ReceptionistStatusPage kind="consultation" />;
  return <ReceptionistAppointmentList />;
}

function ReceptionistAppointmentList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMode = searchParams.get('mode') as keyof typeof modeLabels | null;
  const [recipient, setRecipient] = useState<'self' | 'family'>('self');
  const [appointments, setAppointments] = useState<ReceptionistAppointment[]>(
    [],
  );
  const [doctors, setDoctors] = useState<ReceptionistDashboard["doctors"]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    void Promise.all([
      api.listReceptionistAppointments("today", doctorId || undefined, recipient),
      api.getReceptionistDashboard(),
    ])
      .then(([list, dashboard]) => {
        setAppointments(list.appointments);
        setDoctors(dashboard.dashboard.doctors);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [doctorId, recipient]);
  if (loading) return <LoadingState label="Loading appointments" />;
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  return (
    <div>
      <div className="eyebrow">Clinic schedule</div>
      <h1 className="page-title">Today's appointments</h1>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Appointment views"><Button variant={recipient === 'self' ? 'primary' : 'quiet'} role="tab" aria-selected={recipient === 'self'} onClick={() => setRecipient('self')}>Appointments</Button><Button variant={recipient === 'family' ? 'primary' : 'quiet'} role="tab" aria-selected={recipient === 'family'} onClick={() => setRecipient('family')}>Family Member Appointments</Button></div>
      <div className="receptionist-mode-strip mt-4 flex gap-2" role="tablist" aria-label="Appointment modes">
        <ModeTab label="All" active={!selectedMode} onClick={() => setSearchParams((current) => { current.delete('mode'); return current; })} />
        {(['in_person', 'video', 'audio', 'chat'] as const).map((mode) => <ModeTab key={mode} label={modeLabels[mode]} active={selectedMode === mode} onClick={() => setSearchParams((current) => { current.set('mode', mode); return current; })} />)}
      </div>
      <div className="mt-6 max-w-sm">
        <label>
          <span className="mb-2 block text-sm font-semibold">
            Doctor filter
          </span>
          <select
            className="field"
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
          >
            <option value="">All doctors</option>
            {doctors.map((entry) => (
              <option key={entry.doctor.id} value={entry.doctor.id}>
                {entry.doctor.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(selectedMode ? appointments.filter((appointment) => appointment.consultationMode === selectedMode) : appointments).length ? (
        <section className="surface mt-6">
          <div className="divide-y divide-slate-100">
            {(selectedMode ? appointments.filter((appointment) => appointment.consultationMode === selectedMode) : appointments).map((appointment) => (
              <Link
                className="doctor-appointment-row"
                to={`/receptionist/appointments/${appointment.id}`}
                key={appointment.id}
              >
                <span className="calendar-tile">
                  <CalendarDays size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong>{appointment.patient.name}</strong>
                  <span>{appointment.relationship ? `Family Member · ${appointment.relationship}` : 'Self'} · Booked by: {appointment.bookedBy?.name ?? appointment.patient.name}</span>
                  <span>
                    {appointment.doctor.name} ·{" "}
                    {formatTime(appointment.scheduledStartAt, "Asia/Kolkata")}
                  </span>
                  <small>
                    {modeLabels[appointment.consultationMode]} ·{" "}
                    Appointment ID: {appointment.publicAppointmentId ?? appointment.id} · Token: {appointment.token?.label ?? 'Not issued'} · Payment: {appointment.payment ? readable(appointment.payment.status) : 'Not recorded'} ·{" "}
                    {appointment.source ? readable(appointment.source) : ""} ·{" "}
                    {appointment.consultationReason || "No reason provided"}
                  </small>
                </span>
                <span className="status-badge">
                  {readable(appointment.status)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No appointments today"
            message={recipient === 'family' ? 'No family member appointments for this clinic.' : 'This clinic has no appointments in its local day.'}
          />
        </div>
      )}
    </div>
  );
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button className={`mode-tab${active ? " active" : ""}`} type="button" role="tab" aria-selected={active} onClick={onClick}>{label}</button>;
}

export function ReceptionistAppointmentDetailPage() {
  const { receptionist } = useReceptionistContext();
  if (!receptionist.clinic) return null;
  const { appointmentId } = useParams();
  const location = useLocation();
  const [appointment, setAppointment] =
    useState<ReceptionistAppointment | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [showPrescription, setShowPrescription] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | null>(null);
  const [amount, setAmount] = useState("");
  const load = () => {
    if (appointmentId)
      void api
        .getReceptionistAppointment(appointmentId)
        .then(async (result) => { setAppointment(result.appointment); if (result.appointment.prescriptionStatus === 'available') { try { const response = await api.getReceptionistPrescription(result.appointment.id); setPrescription(response.prescription); } catch { setPrescription(null); } } else setPrescription(null); })
        .catch(setError);
  };
  useEffect(load, [appointmentId]);
  if (error) return <ApiErrorState error={error} />;
  if (!appointment) return <LoadingState label="Loading appointment" />;
  const requestedReturnTo = new URLSearchParams(location.search).get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/receptionist/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : '/receptionist/appointments';
  const receptionCollectionEligible = appointment.consultationMode === "in_person" && appointment.payment?.method === "pay_at_reception" && appointment.payment.status !== "paid";
  const choosePaymentMethod = (method: "cash") => {
    setPaymentMethod(method);
    setAmount(((appointment.payment?.amountCents ?? 0) / 100).toFixed(2));
  };
  const recordPayment = async () => {
    if (!paymentMethod || !/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) { setActionError(new Error("Enter a valid amount greater than zero")); return; }
    setBusy(true);
    setActionError(null);
    try {
      await api.payAtReception(appointment.id, { method: "cash", actualAmountCents: Math.round(Number(amount) * 100) });
      setPaymentMethod(null);
      load();
    } catch (nextError) {
      setActionError(nextError);
    } finally {
      setBusy(false);
    }
  };
  const noShow = async () => {
    if (!window.confirm("Mark this appointment as no-show?")) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.markNoShow(appointment.id);
      load();
    } catch (nextError) {
      setActionError(nextError);
    } finally {
      setBusy(false);
    }
  };
  const prescriptionAppointment: Appointment = appointment ? { id: appointment.id, patient: { id: appointment.patient.id, name: appointment.patient.name, healthId: appointment.patient.healthId }, doctor: { id: appointment.doctor.id, name: appointment.doctor.name }, clinic: { id: receptionist.clinic.id, name: receptionist.clinic.name }, scheduledStartAt: appointment.scheduledStartAt, consultationMode: appointment.consultationMode, durationMinutes: appointment.durationMinutes, consultationReason: appointment.consultationReason, status: appointment.status, token: appointment.token, payment: appointment.payment } : {} as Appointment;
  const prescriptionContent = prescription && showPrescription ? <FinalPrescriptionContent appointment={prescriptionAppointment} prescription={prescription} clinicTimezone="Asia/Kolkata" showPrintAction /> : null;
  const printPrescription = prescription ? createPortal(<FinalPrescriptionContent appointment={prescriptionAppointment} prescription={prescription} clinicTimezone="Asia/Kolkata" />, document.body) : null;
  return (
    <>
    <div>
      <div className="eyebrow">Appointment detail</div>
      <h1 className="page-title">{appointment.patient.name}</h1>
      <p className="page-lead">
        {appointment.doctor.name} · {modeLabels[appointment.consultationMode]}
      </p>
      <Link className="back-link" to={returnTo}>Back</Link>
      <section className="surface mt-8 grid gap-4 sm:grid-cols-2">
        <Info label="Health ID" value={appointment.patient.healthId ?? "Not applicable"} />
        <Info label="Booked by" value={appointment.bookedBy?.name ?? appointment.patient.name} />
        {appointment.relationship && <Info label="Relationship" value={appointment.relationship} />}
        <Info label="Status" value={readable(appointment.status)} />
        <Info
          label="Source"
          value={appointment.source ? readable(appointment.source) : "Booked"}
        />
        <Info label="Token" value={appointment.token?.label ?? "Not issued"} />
        <Info
          label="Reason"
          value={appointment.consultationReason || "No reason provided"}
        />
        <Info
          label="Payment"
          value={
            appointment.payment
              ? `${readable(appointment.payment.status)} · ${money(appointment.payment.amountCents)}`
              : "Not returned"
          }
        />
        <Info label="Documents" value={appointment.healthRecords?.length ? `${appointment.healthRecords.length} health record${appointment.healthRecords.length === 1 ? "" : "s"} attached` : "None attached"} />
        <div className="rounded-xl bg-slate-50 p-4"><p className="label">Prescription</p><p className="mt-2 font-semibold text-slate-900">{appointment.prescriptionStatus === 'available' ? 'Available' : 'Not available'}</p>{appointment.prescriptionStatus === 'available' && <Button className="mt-3" variant="quiet" onClick={() => setShowPrescription((current) => !current)}>{showPrescription ? 'Hide Prescription' : 'View Prescription'}</Button>}</div>
      </section>
      <section className="surface mt-6">
        <div className="flex items-center justify-between gap-3"><div><div className="eyebrow">Documents</div><h2 className="section-title">Attached records</h2></div><span className="status-badge">{appointment.healthRecords?.length ?? 0} attached</span></div>
        {appointment.healthRecords?.length ? <div className="mt-4 space-y-3">{appointment.healthRecords.map((record) => <div className="action-card" key={record.id}><span className="min-w-0"><strong>{record.title || readable(record.type)}</strong><span className="break-words">{record.originalFilename}</span>{record.documentDate && <small>{formatDob(record.documentDate)}</small>}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">None attached</p>}
      </section>
      <section className="surface mt-6">
        <div className="eyebrow">Patient health</div>
        <h2 className="section-title">Basic health profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Info
            label="Height"
            value={`${healthValue(appointment.patient.heightCm, "Not added")}${appointment.patient.heightCm ? " cm" : ""}`}
          />
          <Info
            label="Weight"
            value={`${healthValue(appointment.patient.weightKg, "Not added")}${appointment.patient.weightKg ? " kg" : ""}`}
          />
          <Info
            label="BMI"
            value={healthValue(appointment.patient.bmi, "Not available")}
          />
          <Info label="Date of birth" value={formatDob(appointment.patient.dob)} />
          <Info
            label="Sex"
            value={appointment.patient.sex ? readable(appointment.patient.sex) : "Not added"}
          />
        </div>
      </section>
      {appointment.status === "completed" && <section className="surface mt-6"><div className="eyebrow">Consultation</div><h2 className="section-title">Consultation completed</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Info label="Consultation Status" value="Completed" /><Info label="Consultation Completed At" value={appointment.completedAt ? formatTime(appointment.completedAt, "Asia/Kolkata") : "Recorded completion unavailable"} /></div></section>}
      {actionError ? (
        <div className="mt-5">
          <ApiErrorState error={actionError} />
        </div>
      ) : null}
      <section className="surface mt-6">
        <div className="eyebrow">{receptionCollectionEligible ? "Payment collection" : "Payment status"}</div>
        {appointment.payment?.status === "paid" ? <div className="mt-3"><h2 className="section-title">Payment completed</h2><p className="mt-2 font-semibold">Amount paid: {money(appointment.payment.actualAmountCents ?? appointment.payment.amountCents)} · {readable(appointment.payment.receptionMethod ?? appointment.payment.method)}</p>{appointment.payment.actualAmountCents != null && appointment.payment.actualAmountCents !== appointment.payment.amountCents && <p className="mt-1 text-sm text-slate-600">Original amount due: {money(appointment.payment.amountCents)}</p>}<p className="mt-1 text-sm text-slate-500">Recorded by {appointment.payment.recordedByName ?? "the clinic"} {appointment.payment.paidAt ? `on ${formatTime(appointment.payment.paidAt, "Asia/Kolkata")}` : ""}</p></div> : appointment.payment ? <div className="mt-3"><h2 className="section-title">{receptionCollectionEligible ? "Payment pending" : "Online payment required"}</h2><p className="mt-2 text-sm">Amount due: <strong>{money(appointment.payment.amountCents)}</strong></p>{receptionCollectionEligible ? (!paymentMethod ? <Button className="mt-4" onClick={() => choosePaymentMethod("cash")}>Collect Payment</Button> : <div className="mt-4 space-y-4"><Field label="Amount to collect (INR)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /><div className="flex gap-2"><Button disabled={busy} onClick={() => void recordPayment()}>Save Payment</Button><Button disabled={busy} variant="quiet" onClick={() => setPaymentMethod(null)}>Cancel</Button></div></div>) : <p className="mt-3 text-sm text-slate-500">Reception collection is unavailable for this payment mode. Payment must be completed online.</p>}</div> : <p className="mt-2 text-sm text-slate-500">No payment obligation was returned.</p>}
      </section>
      <div className="mt-5 flex flex-wrap gap-3">
        {["booked", "queued"].includes(appointment.status) && (
          <Button
            disabled={busy}
            variant="danger"
            onClick={() => void noShow()}
          >
            Mark as No Show
          </Button>
        )}
      </div>
    </div>
    {prescriptionContent}
    {printPrescription}
    </>
  );
}

export function ReceptionistWalkInPage() {
  const { receptionist } = useReceptionistContext();
  if (!receptionist.clinic) return null;
  const [kind, setKind] = useState<"healthId" | "phone">("healthId");
  const [value, setValue] = useState("");
  const [patient, setPatient] = useState<{
    id: string;
    healthId: string;
    name: string;
    phone: string | null;
  } | null>(null);
  const [patientSelected, setPatientSelected] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [newPatient, setNewPatient] = useState({ fullName: "", phone: "", email: "", dob: "", gender: "", password: "", confirmPassword: "" });
  const [doctorId, setDoctorId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pay_at_reception");
  const [reason, setReason] = useState("");
  const [doctors, setDoctors] = useState<ReceptionistDashboard["doctors"]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ReceptionistAppointment | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    void api
      .getReceptionistDashboard()
      .then((result) => setDoctors(result.dashboard.doctors))
      .catch(setError);
  }, []);
  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.lookupReceptionistPatient(
        kind === "healthId"
          ? { healthId: value.trim() }
          : { phone: value.trim() },
      );
      setPatient(result.patient);
      setPatientSelected(false);
      setRegistering(false);
    } catch (nextError) {
      setPatient(null);
      setPatientSelected(false);
      if ((nextError as { status?: number }).status === 404) {
        setRegistering(true);
        if (kind === "phone") setNewPatient((current) => ({ ...current, phone: value.trim() }));
      } else {
        setError(nextError);
      }
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if ((!patientSelected && !registering) || !doctorId || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createWalkIn({
        requestId,
        doctorId,
        ...(patientSelected && patient ? { patientHealthId: patient.healthId } : {
          newPatient: {
            fullName: newPatient.fullName,
            phone: newPatient.phone,
            ...(newPatient.email ? { email: newPatient.email } : {}),
            ...(newPatient.dob ? { dob: newPatient.dob } : {}),
            ...(newPatient.gender ? { gender: newPatient.gender } : {}),
            password: newPatient.password,
            confirmPassword: newPatient.confirmPassword,
          },
        }),
        paymentMethod,
        consultationReason: reason.trim(),
      });
      setCreated(result.appointment);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  if (created)
    return (
      <div className="mx-auto max-w-2xl">
        <section className="surface text-center">
          <CheckCircle2 className="mx-auto text-emerald-600" size={34} />
          <div className="mt-4 eyebrow">Walk-In Created</div>
          <h1 className="page-title mt-2">{created.patient.name}</h1>
          <p className="mt-3 text-slate-500">
            {created.doctor.name} · {readable(created.status)}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info label="Appointment ID" value={created.publicAppointmentId ?? created.id} />
            <Info label="Permanent Health ID" value={created.patient.healthId} />
            <Info label="Token" value={created.token?.label ?? "Not issued"} />
            <Info
              label="Payment"
              value={
                created.payment
                  ? readable(created.payment.status)
                  : "Not returned"
              }
            />
            <Info label="Clinic" value={receptionist.clinic.name} />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className="button button-outline" to="/receptionist/queue">Return to queue</Link>
            <Button onClick={() => {
              setCreated(null); setPatient(null); setPatientSelected(false); setRegistering(false); setValue("");
              setDoctorId(""); setReason(""); setNewPatient({ fullName: "", phone: "", email: "", dob: "", gender: "", password: "", confirmPassword: "" });
              setRequestId(crypto.randomUUID());
            }}>Create another walk-in</Button>
          </div>
        </section>
      </div>
    );
  return (
    <div>
      <div className="eyebrow">Front desk</div>
      <h1 className="page-title">Walk-In</h1>
      <p className="page-lead">
        Find an existing patient, or register a permanent patient profile before joining the clinic queue.
      </p>
      {error ? (
        <div className="mt-5">
          <ApiErrorState error={error} />
        </div>
      ) : null}
      <section className="surface mt-6">
        <div className="flex flex-wrap gap-2">
          <button
            className={`mode-tab ${kind === "healthId" ? "active" : ""}`}
            onClick={() => setKind("healthId")}
          >
            Health ID
          </button>
          <button
            className={`mode-tab ${kind === "phone" ? "active" : ""}`}
            onClick={() => setKind("phone")}
          >
            Phone number
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field
              label="Exact identifier"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <Button disabled={busy || !value.trim()} onClick={() => void find()}>
            <Search size={17} />
            Find Patient
          </Button>
        </div>
        {patient && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="label">Patient</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {patient.name}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Health ID: {patient.healthId}
            </p>
            <Button className="mt-4" onClick={() => setPatientSelected(true)}>
              Continue with this patient
            </Button>
          </div>
        )}
      </section>
      {registering && !patient && (
        <section className="surface mt-6">
          <div className="flex items-center gap-3"><UserPlus className="text-teal-700" size={22} /><div><div className="eyebrow">Register New Patient</div><h2 className="section-title">Permanent patient profile</h2></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required value={newPatient.fullName} onChange={(event) => setNewPatient({ ...newPatient, fullName: event.target.value })} />
            <Field label="Phone number" required value={newPatient.phone} onChange={(event) => setNewPatient({ ...newPatient, phone: event.target.value })} />
            <Field label="Email (optional)" type="email" value={newPatient.email} onChange={(event) => setNewPatient({ ...newPatient, email: event.target.value })} />
            <Field label="Date of birth (optional)" type="date" value={newPatient.dob} onChange={(event) => setNewPatient({ ...newPatient, dob: event.target.value })} />
            <label><span className="mb-2 block text-sm font-semibold">Gender (optional)</span><select className="field" value={newPatient.gender} onChange={(event) => setNewPatient({ ...newPatient, gender: event.target.value })}><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
            <div />
            <Field label="Create password" aria-label="Create password" required type="password" minLength={8} value={newPatient.password} onChange={(event) => setNewPatient({ ...newPatient, password: event.target.value })} hint="The patient can use this phone and password in the Patient app later." />
            <Field label="Confirm password" required type="password" minLength={8} value={newPatient.confirmPassword} onChange={(event) => setNewPatient({ ...newPatient, confirmPassword: event.target.value })} />
          </div>
          <Button className="mt-5" disabled={!newPatient.fullName.trim() || !newPatient.phone.trim() || newPatient.password.length < 8 || newPatient.password !== newPatient.confirmPassword} onClick={() => setPatientSelected(true)}>Continue with new patient</Button>
        </section>
      )}
      {((patient && patientSelected) || (registering && patientSelected)) && (
        <section className="surface mt-6">
          <div className="eyebrow">Walk-in consultation</div>
          <h2 className="section-title">Confirm visit</h2>
          <p className="mt-2 text-sm text-slate-500">
            {patient?.name ?? newPatient.fullName} · {receptionist.clinic.name} · In Person
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-semibold">Doctor</span>
              <select
                className="field"
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
              >
                <option value="">Choose a doctor</option>
                {doctors.map((entry) => (
                  <option value={entry.doctor.id} key={entry.doctor.id}>
                    {entry.doctor.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold">Payment</span>
              <select
                className="field"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="wallet">Wallet</option>
                <option value="upi">UPI</option>
                <option value="pay_at_reception">Pay at Reception</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold">
              Reason for visit
            </span>
            <textarea
              className="field min-h-24"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Button
            className="mt-5"
            disabled={busy || !doctorId || !reason.trim()}
            onClick={() => void create()}
          >
            {busy ? "Creating Walk-In..." : "Create Walk-In"}
          </Button>
        </section>
      )}
    </div>
  );
}
