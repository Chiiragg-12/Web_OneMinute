import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, streamDoctorQueue } from "../api/client";
import { useReceptionistContext } from "../components/ReceptionistLayout";
import {
  ApiErrorState,
  Button,
  EmptyState,
  Field,
  LoadingState,
} from "../components/ui";
import type { ConsultationMode, ReceptionistDashboard } from "../types/api";

const modes: ConsultationMode[] = ["in_person", "video", "audio", "chat"];
const labels: Record<string, string> = {
  in_person: "In Person",
  video: "Video",
  audio: "Audio",
  chat: "Chat",
  waiting: "Waiting",
  serving: "Serving",
};
const readable = (value: string) =>
  labels[value] ??
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function ReceptionistQueuePage() {
  const {} = useReceptionistContext();
  const [mode, setMode] = useState<ConsultationMode>("in_person");
  const [doctorId, setDoctorId] = useState("");
  const [dashboard, setDashboard] = useState<ReceptionistDashboard | null>(
    null,
  );
  const [waiting, setWaiting] = useState<
    Awaited<ReturnType<typeof api.getDoctorQueue>>["waiting"]
  >([]);
  const [serving, setServing] =
    useState<Awaited<ReturnType<typeof api.getDoctorNowServing>>["nowServing"]>(
      null,
    );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pollingRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const load = () => {
    void api
      .getReceptionistDashboard()
      .then(async (result) => {
        setDashboard(result.dashboard);
        const nextDoctor =
          doctorId || result.dashboard.doctors[0]?.doctor.id || "";
        setDoctorId(nextDoctor);
        if (nextDoctor) {
          const [queue, current] = await Promise.all([
            api.getDoctorQueue(result.dashboard.clinic.id, nextDoctor, mode),
            api.getDoctorNowServing(
              result.dashboard.clinic.id,
              nextDoctor,
              mode,
            ),
          ]);
          setWaiting(queue.waiting);
          setServing(current.nowServing);
        }
      })
      .catch(setError);
  };
  useEffect(() => {
    let disposed = false;
    const stopPolling = () => {
      if (pollingRef.current !== null) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
    const connect = () => {
      if (disposed || !dashboard || !doctorId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void streamDoctorQueue(
        dashboard.clinic.id,
        doctorId,
        mode,
        controller.signal,
        load,
      )
        .then(() => {
          if (!disposed) {
            stopPolling();
            reconnectRef.current = window.setTimeout(() => {
              reconnectRef.current = null;
              connect();
            }, 2000);
          }
        })
        .catch(() => {
          if (!disposed) {
            if (pollingRef.current === null)
              pollingRef.current = window.setInterval(load, 15000);
            reconnectRef.current = window.setTimeout(() => {
              reconnectRef.current = null;
              connect();
            }, 2000);
          }
        });
    };
    load();
    if (dashboard && doctorId) connect();
    return () => {
      disposed = true;
      abortRef.current?.abort();
      stopPolling();
      if (reconnectRef.current !== null)
        window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    };
  }, [mode, doctorId, dashboard?.clinic.id]);
  const action = async (kind: "start" | "end") => {
    if (!dashboard || busy || !doctorId) return;
    setBusy(true);
    try {
      if (kind === "start")
        await api.startNextConsultation(dashboard.clinic.id, doctorId, mode);
      else
        await api.endCurrentConsultation(
          dashboard.clinic.id,
          doctorId,
          mode,
          serving?.appointmentId,
        );
      load();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  if (!dashboard) return <LoadingState label="Loading queue" />;
  return (
    <div>
      <div className="eyebrow">Clinic queue</div>
      <h1 className="page-title">Queue control</h1>
      {error ? (
        <div className="mt-5">
          <ApiErrorState error={error} />
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <label className="block w-full lg:w-auto lg:max-w-xs">
          <span className="mb-2 block text-sm font-semibold">Doctor</span>
          <select
            className="field"
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
          >
            {dashboard.doctors.map((entry) => (
              <option value={entry.doctor.id} key={entry.doctor.id}>
                {entry.doctor.fullName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {modes.map((item) => (
            <button
              className={`mode-tab ${mode === item ? "active" : ""}`}
              onClick={() => setMode(item)}
              key={item}
            >
              {labels[item]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="surface">
          <h2 className="section-title">Waiting · {waiting.length}</h2>
          {waiting.length ? (
            waiting.map((item) => (
              <div className="doctor-queue-row mt-3" key={item.appointmentId}>
                <span className="token-tile">{item.token.label}</span>
                <span className="min-w-0 flex-1">
                  <strong className="break-words">{item.patient.name}</strong>
                  <small>
                    {item.source === "walk_in" ? "Walk-In" : "Scheduled"} · Position {item.position} ·{" "}
                    {item.estimatedWaitMinutes === null
                      ? "Estimated wait unavailable"
                      : `~${item.estimatedWaitMinutes} min`}
                  </small>
                </span>
              </div>
            ))
          ) : (
            <div className="mt-5">
              <EmptyState
                title="Queue is clear"
                message="No waiting patients for this Doctor and mode."
              />
            </div>
          )}
        </section>
        <section className="review-card">
          <p className="eyebrow">Now serving</p>
          <h2 className="mt-2 font-display text-4xl">
            {serving?.token.label ?? "—"}
          </h2>
          <p className="mt-2 text-sm text-teal-100/75">
            {serving?.patient.name ?? "No active consultation"}
          </p>
          <div className="mt-5 space-y-2">
            <Button
              disabled={busy || Boolean(serving)}
              onClick={() => void action("start")}
            >
              Start Next
            </Button>
            <Button
              variant="quiet"
              disabled={busy || !serving}
              onClick={() => void action("end")}
            >
              End Current
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
export function ReceptionistProfilePage() {
  const { receptionist } = useReceptionistContext();
  if (!receptionist.clinic) return null;
  const [dashboard, setDashboard] = useState<ReceptionistDashboard | null>(
    null,
  );
  const [doctorId, setDoctorId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const load = () =>
    void api
      .getReceptionistDashboard()
      .then((result) => {
        setDashboard(result.dashboard);
        setDoctorId(
          (current) => current || result.dashboard.doctors[0]?.doctor.id || "",
        );
      })
      .catch(setError);
  useEffect(load, []);
  const [clinic, setClinic] = useState<any>(null);
  const [clinicForm, setClinicForm] = useState<Record<string, string>>({});
  useEffect(() => { void api.getReceptionistClinic().then(({ clinic: nextClinic }) => { setClinic(nextClinic); setClinicForm({ name: nextClinic.name, ownerName: nextClinic.ownerName ?? '', addressLine1: nextClinic.addressLine1 ?? '', addressLine2: nextClinic.addressLine2 ?? '', city: nextClinic.city ?? '', state: nextClinic.state ?? '', postalCode: nextClinic.postalCode ?? '', country: nextClinic.country ?? '', phone: nextClinic.phone ?? '', email: nextClinic.email ?? '' }); }).catch(setError); }, []);
  const selected = dashboard?.doctors.find(
    (entry) => entry.doctor.id === doctorId,
  );
  const toggle = async () => {
    if (!dashboard || !doctorId || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (selected?.status === "on_break")
        await api.endReceptionistBreak(dashboard.clinic.id, doctorId);
      else await api.startReceptionistBreak(dashboard.clinic.id, doctorId);
      load();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  };
  const saveClinic = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(null); try { const result = await api.updateReceptionistClinic(clinicForm); setClinic(result.clinic); } catch (nextError) { setError(nextError); } finally { setBusy(false); } };
  return (
    <div>
      <div className="eyebrow">Front desk profile</div>
      <h1 className="page-title">{receptionist.fullName}</h1>
      <Link className="button button-primary mt-5" to="/receptionist/add-doctor">Add Doctor</Link>
      <section className="surface mt-8">
        <Info label="Assigned clinic" value={receptionist.clinic.name} />
        <p className="mt-4 text-sm text-slate-500">
          {receptionist.clinic.isActive
            ? "Active clinic assignment"
            : "Clinic assignment unavailable"}
        </p>
        <div className="mt-6 border-t border-slate-100 pt-6">
          <h2 className="font-display text-xl font-semibold">
            Doctor break controls
          </h2>
          {error ? (
            <div className="mt-4">
              <ApiErrorState error={error} />
            </div>
          ) : null}
          {dashboard && (
            <>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold">Doctor</span>
                <select
                  className="field"
                  value={doctorId}
                  onChange={(event) => setDoctorId(event.target.value)}
                >
                  {dashboard.doctors.map((entry) => (
                    <option value={entry.doctor.id} key={entry.doctor.id}>
                      {entry.doctor.fullName} · {readable(entry.status)}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                className="mt-4"
                disabled={busy || !doctorId}
                variant={selected?.status === "on_break" ? "quiet" : "primary"}
                onClick={() => void toggle()}
              >
                {busy
                  ? "Saving…"
                  : selected?.status === "on_break"
                    ? "End Break"
                    : "Start Break"}
              </Button>
            </>
          )}
        </div>
      </section>
      {clinic && <section className="surface mt-8"><div className="eyebrow">Clinic setup</div><h2 className="section-title">{clinic.name}</h2><Info label="Clinic ID" value={clinic.publicClinicId} /><p className="mt-3 text-sm text-slate-500">{clinic.name && clinic.ownerName && clinic.addressLine1 ? 'Complete clinic profile' : 'Complete Clinic Profile'}</p><form className="mt-5 grid gap-5 sm:grid-cols-2" onSubmit={saveClinic}><Field label="Clinic name" value={clinicForm.name ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, name: event.target.value })} /><Field label="Owner / authorized person" value={clinicForm.ownerName ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, ownerName: event.target.value })} /><Field label="Address line 1" value={clinicForm.addressLine1 ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, addressLine1: event.target.value })} /><Field label="Address line 2" value={clinicForm.addressLine2 ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, addressLine2: event.target.value })} /><Field label="City" value={clinicForm.city ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, city: event.target.value })} /><Field label="State" value={clinicForm.state ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, state: event.target.value })} /><Field label="Postal / PIN code" value={clinicForm.postalCode ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, postalCode: event.target.value })} /><Field label="Country" value={clinicForm.country ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, country: event.target.value })} /><Field label="Phone" value={clinicForm.phone ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, phone: event.target.value })} /><Field label="Email" type="email" value={clinicForm.email ?? ''} onChange={(event) => setClinicForm({ ...clinicForm, email: event.target.value })} /><div className="sm:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save clinic profile'}</Button></div></form></section>}
    </div>
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
