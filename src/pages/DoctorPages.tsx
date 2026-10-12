import { CareGuardPlanEditor } from '../components/CareGuardPlanEditor';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, streamDoctorQueue } from "../api/client";
import { useDoctorContext } from "../components/DoctorLayout";
import {
  ApiErrorState,
  Button,
  EmptyState,
  Field,
  LoadingState,
} from "../components/ui";
import type {
  ConsultationMode,
  DoctorAppointment,
  DoctorDashboard,
} from "../types/api";

const modes: ConsultationMode[] = ["in_person", "video", "audio", "chat"];
const modeLabels: Record<ConsultationMode, string> = {
  in_person: "In Person",
  video: "Video",
  audio: "Audio",
  chat: "Chat",
};
const statusLabels: Record<string, string> = {
  booked: "Booked",
  queued: "Queued",
  in_consultation: "In Consultation",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  waiting: "Waiting",
  serving: "Serving",
};
const readable = (value: string) =>
  statusLabels[value] ??
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const clinicTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function DoctorOverviewPage() {
  const { doctor, clinicId } = useDoctorContext();
  const [dashboard, setDashboard] = useState<DoctorDashboard | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    if (!clinicId) return;
    setLoading(true);
    void api
      .getDoctorDashboard(clinicId)
      .then((result) => setDashboard(result.dashboard))
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [clinicId]);
  if (!clinicId)
    return (
      <EmptyState
        title="No active clinic"
        message="Your account has no active clinic membership."
      />
    );
  if (loading) return <LoadingState label="Loading doctor dashboard" />;
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  if (!dashboard) return null;
  const appointmentCounts = dashboard.appointmentCounts ?? dashboard.appointments.reduce<Record<string, number>>((result, appointment) => { result[appointment.consultationMode] = (result[appointment.consultationMode] ?? 0) + 1; return result; }, { total: dashboard.appointments.length });
  return (
    <div>
      <div className="eyebrow">Doctor overview</div>
      <h1 className="page-title">
        Good morning, {doctor.fullName.replace(/^Dr\.\s*/i, "")}.
      </h1>
      <p className="page-lead">
        {dashboard.clinic.name} · {readable(dashboard.status)}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Today's visits"
          value={String(dashboard.appointments.length)}
        />
        <Metric
          label="Waiting"
          value={String(
            Object.values(dashboard.waitingByMode).reduce(
              (sum, count) => sum + count,
              0,
            ),
          )}
        />
        <Metric
          label="Completed"
          value={String(dashboard.counts.completed ?? 0)}
        />
        <Metric label="Current status" value={readable(dashboard.status)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Today's total appointments" value={String(appointmentCounts.total ?? dashboard.appointments.length)} />
        {modes.map((mode) => <Metric key={mode} label={`Today's ${modeLabels[mode]} appointments`} value={String(appointmentCounts[mode] ?? 0)} />)}
      </div>
      <section className="surface mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Queue by mode</div>
            <h2 className="section-title">Separate consultation queues</h2>
          </div>
          <Link className="text-sm font-bold text-teal-700" to="/doctor/queue">
            Open queue <ArrowRight size={15} className="inline" />
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modes.map((mode) => (
            <div className="metric-card" key={mode}>
              <p className="label">{modeLabels[mode]}</p>
              <p className="mt-2 font-display text-2xl font-semibold">
                {dashboard.waitingByMode[mode] ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500">waiting</p>
            </div>
          ))}
        </div>
      </section>
      <section className="surface mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Today</div>
            <h2 className="section-title">Appointments</h2>
          </div>
          <Link
            className="text-sm font-bold text-teal-700"
            to="/doctor/appointments"
          >
            View all <ArrowRight size={15} className="inline" />
          </Link>
        </div>
        <AppointmentTable
          appointments={dashboard.appointments.slice(0, 5)}
          timezone={dashboard.clinic.timezone}
          clinicId={clinicId}
        />
      </section>
    </div>
  );
}

export function DoctorAppointmentsPage() {
  const { clinicId } = useDoctorContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMode = searchParams.get("mode") as ConsultationMode | null;
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    void Promise.all([
      api.listDoctorAppointments(clinicId, "today"),
      api.getClinic(clinicId),
    ])
      .then(([appointmentsResult, clinicResult]) => {
        setAppointments(appointmentsResult.appointments);
        setTimezone(clinicResult.clinic.timezone);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [clinicId]);
  if (loading || !timezone)
    return <LoadingState label="Loading today's appointments" />;
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  return (
    <div>
      <div className="eyebrow">Clinic schedule</div>
      <h1 className="page-title">Today's appointments</h1>
      <p className="page-lead">
        Patient information shown here is limited to the approved doctor
        workflow.
      </p>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Appointment modes">
        <ModeTab label="All" active={!selectedMode} onClick={() => setSearchParams({})} />
        {modes.map((mode) => <ModeTab key={mode} label={modeLabels[mode]} active={selectedMode === mode} onClick={() => setSearchParams({ mode })} />)}
      </div>
      {(selectedMode ? appointments.filter((appointment) => appointment.consultationMode === selectedMode) : appointments).length ? (
        <section className="surface mt-8">
          <AppointmentTable
            appointments={selectedMode ? appointments.filter((appointment) => appointment.consultationMode === selectedMode) : appointments}
            timezone={timezone}
            clinicId={clinicId}
          />
        </section>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No appointments today"
            message="There are no appointments in this clinic's local day."
          />
        </div>
      )}
    </div>
  );
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button className={`mode-tab${active ? " active" : ""}`} type="button" role="tab" aria-selected={active} onClick={onClick}>{label}</button>;
}

function AppointmentTable({
  appointments,
  timezone,
  clinicId,
}: {
  appointments: DoctorAppointment[];
  timezone: string;
  clinicId: string;
}) {
  return (
    <div className="mt-5 divide-y divide-slate-100">
      {appointments.map((appointment) => (
        <Link
          className="doctor-appointment-row"
          to={`/doctor/appointments/${clinicId}/${appointment.id}`}
          key={appointment.id}
        >
          <span className="calendar-tile">
            <CalendarDays size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <strong>{appointment.patient?.name ?? "Patient"}</strong>
            <span>
              {clinicTime(appointment.scheduledStartAt, timezone)} ·{" "}
              {modeLabels[appointment.consultationMode]}
            </span>
            <small>
              {appointment.consultationReason || "No reason provided"}
            </small>
            <small>
              {appointment.relationship ? `Family Member · ${appointment.relationship}` : "Self"} · Booked by: {appointment.bookedBy?.name ?? appointment.patient?.name ?? "Unknown"} · Appointment ID: {appointment.publicAppointmentId ?? appointment.id} · Token: {appointment.token?.label ?? "Not issued"} · Payment: {appointment.payment ? readable(appointment.payment.status) : "Not recorded"}
            </small>
          </span>
          <span className="status-badge">{readable(appointment.status)}</span>
          <ArrowRight className="text-slate-400" size={18} />
        </Link>
      ))}
    </div>
  );
}

export function DoctorAppointmentDetailPage() {
  const { clinicId, appointmentId } = useDoctorContextParams();
  const [appointment, setAppointment] = useState<DoctorAppointment | null>(
    null,
  );
  const [clinicTimezone, setClinicTimezone] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    void Promise.all([
      api.getDoctorAppointment(clinicId, appointmentId),
      api.getClinic(clinicId),
    ])
      .then(([appointmentResult, clinicResult]) => {
        setAppointment(appointmentResult.appointment);
        setClinicTimezone(clinicResult.clinic.timezone);
      })
      .catch(setError);
  }, [clinicId, appointmentId]);
  if (error) return <ApiErrorState error={error} />;
  if (!appointment || !clinicTimezone)
    return <LoadingState label="Loading appointment" />;
  return (
    <div>
      <div className="eyebrow">Appointment detail</div>
      <h1 className="page-title">{appointment.patient?.name ?? "Patient"}</h1>
      <p className="page-lead">
        {modeLabels[appointment.consultationMode]} ·{" "}
        {readable(appointment.status)}
      </p>
      <section className="surface mt-8 grid gap-4 sm:grid-cols-2">
        <Info
          label="Scheduled Date & Time"
          value={clinicTime(appointment.scheduledStartAt, clinicTimezone)}
        />
        <Info
          label="Reason for visit"
          value={appointment.consultationReason || "No reason provided"}
        />
        <Info label="Token" value={appointment.token?.label || "Not issued"} />
        <Info
          label="Patient Health ID"
          value={appointment.patient?.healthId || "Not available"}
        />
        <Info
          label="Consultation duration"
          value={
            appointment.durationMinutes
              ? `${appointment.durationMinutes} minutes`
              : "Not specified"
          }
        />
        <Info
          label="Payment state"
          value={
            appointment.payment
              ? readable(appointment.payment.status)
              : "Not returned"
          }
        />
      </section>
    </div>
  );
}
function useDoctorContextParams() {
  return useParams() as { clinicId: string; appointmentId: string };
}

export function DoctorQueuePage() {
  const { doctor, clinicId } = useDoctorContext();
  const [mode, setMode] = useState<ConsultationMode>("in_person");
  const [waiting, setWaiting] = useState<
    Awaited<ReturnType<typeof api.getDoctorQueue>>["waiting"]
  >([]);
  const [serving, setServing] =
    useState<Awaited<ReturnType<typeof api.getDoctorNowServing>>["nowServing"]>(
      null,
    );
  const [currentPatient, setCurrentPatient] =
    useState<DoctorAppointment | null>(null);
  const [openingRecordId, setOpeningRecordId] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<import('../types/api').Prescription | null>(null);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [medicines, setMedicines] = useState<Array<{ id?: string; medicineName: string; strength: string; dosage: string; route: string; frequency: string; duration: string; instructions: string; needsReview: boolean }>>([]);
  const [advice, setAdvice] = useState('');
  const [prescriptionBusy, setPrescriptionBusy] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);
  const load = () => {
    if (!clinicId) return;
    void Promise.all([
      api.getDoctorQueue(clinicId, doctor.id, mode),
      api.getDoctorNowServing(clinicId, doctor.id, mode),
      api.getDoctorCurrentPatient(clinicId),
    ])
      .then(([queue, current, activeConsultation]) => {
        setWaiting(queue.waiting);
        setServing(current.nowServing);
        setCurrentPatient(activeConsultation.appointment);
      })
      .catch(setError);
  };
  useEffect(() => {
    let disposed = false;
    const stopPolling = () => {
      if (pollingRef.current !== null) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
    const scheduleReconnect = () => {
      if (reconnectRef.current === null && !disposed)
        reconnectRef.current = window.setTimeout(() => {
          reconnectRef.current = null;
          connect();
        }, 2000);
    };
    const connect = () => {
      if (disposed) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void streamDoctorQueue(clinicId, doctor.id, mode, controller.signal, load)
        .then(() => {
          if (!disposed) {
            stopPolling();
            scheduleReconnect();
          }
        })
        .catch(() => {
          if (!disposed) {
            if (pollingRef.current === null)
              pollingRef.current = window.setInterval(load, 15000);
            scheduleReconnect();
          }
        });
    };
    load();
    connect();
    return () => {
      disposed = true;
      abortRef.current?.abort();
      stopPolling();
      if (reconnectRef.current !== null)
        window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    };
  }, [clinicId, doctor.id, mode]);
  useEffect(() => { if (currentPatient && typeof api.getDoctorPrescription === 'function') void api.getDoctorPrescription(currentPatient.id).then((result) => { setPrescription(result.prescription); if (result.prescription) { setMedicines(result.prescription.medicines.map((medicine) => ({ ...medicine, strength: medicine.strength ?? '', dosage: medicine.dosage ?? '', route: medicine.route ?? '', frequency: medicine.frequency ?? '', duration: medicine.duration ?? '', instructions: medicine.instructions ?? '' }))); setAdvice(result.prescription.advice ?? ''); } }).catch(() => undefined); }, [currentPatient]);
  const action = async (kind: "start" | "end") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "start")
        await api.startNextConsultation(clinicId, doctor.id, mode);
      else
        await api.endCurrentConsultation(
          clinicId,
          doctor.id,
          mode,
          serving?.appointmentId,
        );
      load();
    } catch (nextError) {
      setError(nextError);
      load();
    } finally {
      setBusy(false);
    }
  };
  const remainingMinutes =
    currentPatient?.consultationStartedAt &&
    currentPatient.estimatedDurationMinutes
      ? Math.max(
          0,
          Math.round(
            currentPatient.estimatedDurationMinutes -
              (Date.now() -
                new Date(currentPatient.consultationStartedAt).getTime()) /
                60000,
          ),
        )
      : null;
  const openRecord = async (recordId: string) => { setOpeningRecordId(recordId); try { const blob = await api.openDoctorHealthRecord(currentPatient!.id, recordId); window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer'); } catch (nextError) { setError(nextError); } finally { setOpeningRecordId(null); } };
  const createPrescription = async () => { if (!currentPatient) return; setPrescriptionBusy(true); setPrescriptionError(null); try { const result = await api.createDoctorPrescription(currentPatient.id, prescriptionFile ?? undefined); setPrescription(result.prescription); setPrescriptionFile(null); } catch (nextError) { setPrescriptionError(nextError instanceof Error ? nextError.message : 'Unable to create prescription draft'); } finally { setPrescriptionBusy(false); } };
  const runOcr = async () => { if (!currentPatient) return; setPrescriptionBusy(true); setPrescriptionError(null); try { const result = await api.runDoctorPrescriptionOcr(currentPatient.id); setPrescription(result.prescription); } catch (nextError) { setPrescriptionError(nextError instanceof Error ? nextError.message : 'OCR provider unavailable; enter prescription manually'); } finally { setPrescriptionBusy(false); } };
  const savePrescription = async () => { if (!currentPatient || !prescription || medicines.some((medicine) => !medicine.medicineName.trim())) return; setPrescriptionBusy(true); try { const result = await api.saveDoctorPrescription(currentPatient.id, { medicines: medicines.map(({ id: _id, ...medicine }) => ({ ...medicine, medicineName: medicine.medicineName.trim() })), advice: advice || null }); setPrescription(result.prescription); } catch (nextError) { setError(nextError); } finally { setPrescriptionBusy(false); } };
  const approvePrescription = async () => { if (!currentPatient) return; setPrescriptionBusy(true); try { const result = await api.approveDoctorPrescription(currentPatient.id); setPrescription(result.prescription); } catch (nextError) { setError(nextError); } finally { setPrescriptionBusy(false); } };
  return (
    <div>
      <div className="eyebrow">Live queue</div>
      <h1 className="page-title">Consultation queues</h1>
      <p className="page-lead">
        Each consultation mode has its own waiting order.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {modes.map((item) => (
          <button
            className={`mode-tab ${mode === item ? "active" : ""}`}
            key={item}
            onClick={() => setMode(item)}
          >
            {modeLabels[item]}
          </button>
        ))}
      </div>
      {error ? (
        <div className="mt-5">
          <ApiErrorState error={error} />
        </div>
      ) : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="surface">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Waiting</div>
              <h2 className="section-title">
                {waiting.length} patient{waiting.length === 1 ? "" : "s"}
              </h2>
            </div>
            <RefreshCw className="text-teal-700" size={19} />
          </div>
          {waiting.length ? (
            <div className="mt-5 space-y-3">
              {waiting.map((item) => (
                <div className="doctor-queue-row" key={item.appointmentId}>
                  <span className="token-tile">{item.token.label}</span>
                  <span>
                    <strong>{item.patient.name}</strong>
                    <small>{item.recipientType === 'family' ? `Family Member · ${item.relationship ?? 'Family'}` : 'Self'}</small>
                    <small>Booked by {item.bookedBy?.name ?? item.patient.name} · {(item.consultationMode ?? mode).replace('_', ' ')} · {item.durationMinutes ?? 0} min</small>
                    <small>Appointment ID: {item.appointmentId} · Payment: {item.paymentStatus === 'paid' ? 'Completed' : 'Pending'}</small>
                    <small>{readable(item.token.status)}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="Queue is clear"
                message="No waiting patients for this consultation mode."
              />
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <section className="review-card">
            <p className="eyebrow">Now serving</p>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              {serving?.token.label ?? "—"}
            </h2>
            <p className="mt-2 text-sm text-teal-100/75">
              {serving?.patient.name ?? "No active consultation"}
            </p>
            <div className="mt-6 space-y-2">
              <Button
                disabled={busy || Boolean(serving)}
                onClick={() => void action("start")}
              >
                <PlayCircle size={17} />
                Start next consultation
              </Button>
              <Button
                variant="quiet"
                disabled={busy || !serving}
                onClick={() => void action("end")}
              >
                <CheckCircle2 size={17} />
                End consultation
              </Button>
            </div>
          </section>
        </aside>
      </div>
      <section className="surface mt-6">
        <div className="eyebrow">Current patient</div>
        <h2 className="section-title">
          {currentPatient ? "In consultation" : "No active consultation"}
        </h2>
        {currentPatient && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info
              label="Patient"
              value={currentPatient.patient?.name ?? "Not available"}
            />
            <Info
              label="Health ID"
              value={currentPatient.patient?.healthId ?? "Not available"}
            />
            <Info
              label="Booked by"
              value={currentPatient.bookedBy?.name ?? currentPatient.patient?.name ?? "Not available"}
            />
            {currentPatient.relationship && <Info label="Relationship" value={currentPatient.relationship} />}
            <Info
              label="Height"
              value={currentPatient.patient?.heightCm ? `${currentPatient.patient.heightCm} cm` : "Not added"}
            />
            <Info
              label="Weight"
              value={currentPatient.patient?.weightKg ? `${currentPatient.patient.weightKg} kg` : "Not added"}
            />
            <Info
              label="BMI"
              value={currentPatient.patient?.bmi ? String(currentPatient.patient.bmi) : "Not available"}
            />
            <Info
              label="Date of birth"
              value={currentPatient.patient?.dob ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(currentPatient.patient.dob)) : "Not added"}
            />
            <Info
              label="Sex"
              value={currentPatient.patient?.sex ? readable(currentPatient.patient.sex) : "Not added"}
            />
            <Info
              label="Attached records"
              value={currentPatient.healthRecords?.length ? `${currentPatient.healthRecords.length} health record${currentPatient.healthRecords.length === 1 ? "" : "s"} attached` : "None attached"}
            />
            {currentPatient.healthRecords?.map((record) => <button className="action-card text-left" type="button" key={record.id} disabled={openingRecordId === record.id} onClick={() => void openRecord(record.id)}><span className="min-w-0"><strong>{record.title || readable(record.type)}</strong><span>{record.originalFilename}</span></span><span className="text-sm font-bold text-teal-700">{openingRecordId === record.id ? "Opening…" : "View"}</span></button>)}
            <Info label="Appointment ID" value={currentPatient.id} />
            <Info
              label="Token"
              value={currentPatient.token?.label ?? "Not available"}
            />
            <Info
              label="Consultation"
              value={`${modeLabels[currentPatient.consultationMode]}${currentPatient.durationMinutes ? ` · ${currentPatient.durationMinutes} min` : ""}`}
            />
            <Info
              label="Reason for visit"
              value={currentPatient.consultationReason || "No reason provided"}
            />
            {remainingMinutes !== null && (
              <Info
                label="Remaining (approx.)"
                value={`~${remainingMinutes} min`}
              />
            )}
            <section className="surface sm:col-span-2"><div className="eyebrow">Prescription</div><h3 className="section-title">{prescription?.status === 'approved' ? 'FINAL PRESCRIPTION' : 'DRAFT — NOT SHARED WITH PATIENT'}</h3>{prescriptionError && <p className="mt-2 text-sm font-semibold text-rose-700">{prescriptionError}</p>}{prescription?.ocrWarnings?.map((warning) => <p className="mt-2 text-sm font-semibold text-amber-700" key={warning}>Needs review: {warning}</p>)}{prescription?.ocrRawText && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Raw OCR text — Doctor review required</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">{prescription.ocrRawText}</pre></details>}{prescription?.status !== 'approved' && <><label className="mt-4 block"><span className="mb-2 block text-sm font-semibold">Optional prescription image (JPEG or PNG)</span><input className="field" aria-label="Prescription image" type="file" accept="image/jpeg,image/png" onChange={(event) => setPrescriptionFile(event.target.files?.[0] ?? null)} /></label><div className="mt-4 flex flex-wrap gap-3"><Button disabled={prescriptionBusy} onClick={() => void createPrescription()}>{prescription ? 'Save draft image' : 'Enter manually / Create draft'}</Button>{prescription && <Button disabled={prescriptionBusy || !prescription.sourceAvailable} variant="quiet" onClick={() => void runOcr()}>Run OCR / Retry OCR</Button>}</div>{prescription && <div className="mt-5 space-y-5">{medicines.map((medicine, index) => <div className="rounded-xl border border-slate-200 p-4" key={medicine.id ?? `new-${index}`}><div className="flex items-center justify-between gap-3"><h4 className="font-display font-semibold">Medicine {index + 1}</h4>{index > 0 && <Button variant="quiet" type="button" onClick={() => setMedicines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Medicine Name" value={medicine.medicineName} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, medicineName: event.target.value } : item))} /><Field label="Strength" value={medicine.strength} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, strength: event.target.value } : item))} /><Field label="Dosage" value={medicine.dosage} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dosage: event.target.value } : item))} /><Field label="Route" value={medicine.route} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, route: event.target.value } : item))} /><Field label="Frequency" value={medicine.frequency} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, frequency: event.target.value } : item))} /><Field label="Duration" value={medicine.duration} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, duration: event.target.value } : item))} /><div className="sm:col-span-2"><Field label="Instructions" value={medicine.instructions} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, instructions: event.target.value } : item))} /></div></div></div>)}<Button variant="quiet" type="button" onClick={() => setMedicines((current) => [...current, { medicineName: '', strength: '', dosage: '', route: '', frequency: '', duration: '', instructions: '', needsReview: false }])}>+ Add Medicine</Button><Field className="mt-4" label="Advice / Notes" value={advice} onChange={(event) => setAdvice(event.target.value)} /><div className="flex flex-wrap gap-3"><Button disabled={prescriptionBusy || !medicines.length || medicines.some((medicine) => !medicine.medicineName.trim())} variant="quiet" onClick={() => void savePrescription()}>Save Draft</Button><Button disabled={prescriptionBusy || !medicines.length || medicines.some((medicine) => !medicine.medicineName.trim())} onClick={() => void approvePrescription()}>Approve & Finalize Prescription</Button></div></div>}</>}{prescription?.status === 'approved' && <div className="mt-4 space-y-3">{prescription.medicines.map((medicine) => <div className="rounded-xl bg-slate-50 p-3" key={medicine.id}><strong>{medicine.medicineName}</strong><p className="mt-1 text-sm text-slate-600">{[medicine.strength, medicine.dosage, medicine.route, medicine.frequency, medicine.duration].filter(Boolean).join(' · ')}</p>{medicine.instructions && <p className="mt-1 text-sm">{medicine.instructions}</p>}</div>)}{prescription.advice && <p className="mt-4 text-sm">Advice: {prescription.advice}</p>}<p className="mt-4 text-xs text-slate-500">Approved prescriptions are read-only.</p></div>}</section>
            {prescription?.status === 'approved' && currentPatient && <CareGuardPlanEditor appointmentId={currentPatient.id} medicines={prescription.medicines} />}
          </div>
        )}
      </section>
    </div>
  );
}

export function LegacyDoctorPricingPage() {
  return null;
}

export function DoctorProfilePage() {
  const { doctor, clinicId } = useDoctorContext();
  const [breakActive, setBreakActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [professional, setProfessional] = useState({ qualifications: doctor.qualifications ?? '', specialization: doctor.specialization ?? '', registrationNumber: doctor.registrationNumber ?? '', registrationCouncil: doctor.registrationCouncil ?? '', designation: doctor.designation ?? '' });
  const refreshBreak = () =>
    clinicId ? void api
      .getDoctorDashboard(clinicId)
      .then((result) => setBreakActive(Boolean(result.dashboard.activeBreak)))
      .catch(setError) : setBreakActive(false);
  useEffect(refreshBreak, [clinicId]);
  const toggleBreak = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (breakActive) await api.endDoctorBreak(clinicId);
      else await api.startDoctorBreak(clinicId);
      refreshBreak();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  const saveProfessional = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(null); try { await api.updateDoctorProfile(professional); } catch (nextError) { setError(nextError); } finally { setBusy(false); } };
  return (
    <div>
      <div className="eyebrow">Doctor profile</div>
      <h1 className="page-title">{doctor.fullName}</h1>
      <p className="page-lead">{doctor.specialization || "General medicine"}</p>
      <section className="surface mt-8"><div className="eyebrow">Professional identity</div><h2 className="section-title">Prescription-ready profile</h2><div className="mt-4 rounded-xl bg-teal-50 p-4"><p className="label">Permanent Doctor ID</p><p className="mt-1 font-display text-xl font-semibold">{doctor.publicDoctorId ?? 'Generating…'}</p><p className="mt-2 text-sm text-slate-600">Share this Doctor ID with a clinic/receptionist to connect your professional profile.</p></div><p className="mt-2 text-sm text-slate-500">Only stored professional credentials are shown; no credentials are inferred.</p><form className="mt-5 grid gap-5 sm:grid-cols-2" onSubmit={saveProfessional}><Field label="Qualifications" value={professional.qualifications} onChange={(event) => setProfessional({ ...professional, qualifications: event.target.value })} /><Field label="Specialization" value={professional.specialization} onChange={(event) => setProfessional({ ...professional, specialization: event.target.value })} /><Field label="Medical registration number" value={professional.registrationNumber} onChange={(event) => setProfessional({ ...professional, registrationNumber: event.target.value })} /><Field label="Medical council / authority" value={professional.registrationCouncil} onChange={(event) => setProfessional({ ...professional, registrationCouncil: event.target.value })} /><Field label="Professional designation" value={professional.designation} onChange={(event) => setProfessional({ ...professional, designation: event.target.value })} /><div className="sm:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save professional profile'}</Button></div></form></section>
      <section className="surface mt-8">
        <div className="flex items-center gap-4">
          <span className="doctor-avatar size-16">
            <Stethoscope size={28} />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">
              Clinic memberships
            </h2>
            <p className="text-sm text-slate-500">
              Only active clinic memberships can open clinic workflows.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          {doctor.clinics.map((clinic) => (
            <div className="action-card" key={clinic.id}>
              <span className="icon-tile">
                <CalendarDays size={18} />
              </span>
              <span>
                <strong>{clinic.name}</strong>
                <span>{clinic.publicClinicId} · {clinic.address || "Address not added"}</span>
                <span>{clinic.isActive ? "Active" : "Inactive"}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-slate-100 pt-6">
          <h2 className="font-display text-xl font-semibold">Break controls</h2>
          {!clinicId ? <p className="mt-3 text-sm text-slate-500">Break controls are available when you are connected to a clinic.</p> : null}
          {error ? (
            <div className="mt-4">
              <ApiErrorState error={error} />
            </div>
          ) : null}
          <Button
            className="mt-4"
            disabled={busy || !clinicId}
            variant={breakActive ? "quiet" : "primary"}
            onClick={() => void toggleBreak()}
          >
            {busy ? (
              "Saving…"
            ) : breakActive ? (
              <>
                <PlayCircle size={17} />
                End break
              </>
            ) : (
              <>
                <PauseCircle size={17} />
                Start break
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="metric-card">
      <p className="label">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold">{value}</p>
    </section>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-slate-900 break-words">{value}</p>
    </div>
  );
}

export { DoctorPricingPage } from "./DoctorPricingPage";
