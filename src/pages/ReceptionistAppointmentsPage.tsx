import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ApiErrorState, EmptyState, LoadingState } from "../components/ui";
import type {
  ReceptionistAppointment,
  ReceptionistDashboard,
} from "../types/api";
const modes: Record<string, string> = {
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
  walk_in: "Walk-In",
};
const readable = (value: string) =>
  labels[value] ??
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const clinicTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export function ReceptionistAppointmentsPage() {
  const [view, setView] = useState<'self' | 'family'>('self');
  const [appointments, setAppointments] = useState<ReceptionistAppointment[]>(
    [],
  );
  const [doctors, setDoctors] = useState<ReceptionistDashboard["doctors"]>([]);
  const [timezone, setTimezone] = useState("UTC");
  const [doctorId, setDoctorId] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    void Promise.all([
      api.listReceptionistAppointments("today", doctorId || undefined, view),
      api.getReceptionistDashboard(),
    ])
      .then(([list, dashboard]) => {
        setAppointments(list.appointments);
        setDoctors(dashboard.dashboard.doctors);
        setTimezone(dashboard.dashboard.clinic.timezone);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [doctorId, view]);
  if (loading) return <LoadingState label="Loading appointments" />;
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  return (
    <div>
      <div className="eyebrow">Clinic schedule</div>
      <h1 className="page-title">Today's appointments</h1>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Appointment views"><button className={`mode-tab ${view === 'self' ? 'active' : ''}`} role="tab" aria-selected={view === 'self'} onClick={() => setView('self')}>Appointments</button><button className={`mode-tab ${view === 'family' ? 'active' : ''}`} role="tab" aria-selected={view === 'family'} onClick={() => setView('family')}>Family Member Appointments</button></div>
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
      {appointments.length ? (
        <section className="surface mt-6">
          <div className="divide-y divide-slate-100">
            {appointments.map((appointment) => (
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
                  {view === 'family' && <span>Booked by: {appointment.bookedBy?.name ?? 'Unknown'} · {appointment.relationship ?? 'Family member'}</span>}
                  <span>
                    {appointment.doctor.name} ·{" "}
                    {clinicTime(appointment.scheduledStartAt, timezone)}
                  </span>
                  <small>
                    {modes[appointment.consultationMode]} ·{" "}
                    {appointment.source
                      ? readable(appointment.source)
                      : "Booked"}{" "}
                    · {appointment.consultationReason || "No reason provided"}
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
            message={view === 'family' ? 'No family member appointments for this clinic.' : 'This clinic has no appointments in its local day.'}
          />
        </div>
      )}
    </div>
  );
}
