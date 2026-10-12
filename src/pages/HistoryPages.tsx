import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { ApiErrorState, EmptyState, LoadingState } from '../components/ui';
import type { Appointment, ReceptionistAppointment } from '../types/api';

const modes: Record<string, string> = { in_person: 'In Person', video: 'Video', audio: 'Audio', chat: 'Chat' };
const statuses: Record<string, string> = { completed: 'Completed' };
const readable = (value: string) => statuses[value] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateTime = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function PatientHistoryCard({ appointment, returnTo }: { appointment: Appointment; returnTo: string }) {
  return <Link className="appointment-row" to={`/app/appointments/${appointment.id}?returnTo=${encodeURIComponent(returnTo)}`}><span className="calendar-tile"><CalendarDays size={20} /></span><span className="min-w-0"><strong>{appointment.patient?.name ?? 'Patient'}</strong><span>Doctor: {appointment.doctor?.name ?? 'Doctor'}</span><span>Clinic: {appointment.clinic?.name ?? 'Clinic'}</span><span>Completed: {dateTime(appointment.completedAt ?? appointment.scheduledStartAt)}</span><span>{modes[appointment.consultationMode]} · Appointment ID: {appointment.publicAppointmentId ?? appointment.id}</span>{appointment.token && <span>Token {appointment.token.label}</span>}{appointment.bookedBy && <span>Booked by: {appointment.bookedBy.name}{appointment.patient?.relationship ? ` · ${appointment.patient.relationship}` : ''}</span>}<small>{appointment.consultationReason || 'No reason provided'}</small></span><span className="status-badge">{readable(appointment.status)}</span></Link>;
}

function ReceptionistHistoryCard({ appointment, returnTo }: { appointment: ReceptionistAppointment; returnTo: string }) {
  return <Link className="doctor-appointment-row" to={`/receptionist/appointments/${appointment.id}?returnTo=${encodeURIComponent(returnTo)}`}><span className="calendar-tile"><CalendarDays size={19} /></span><span className="min-w-0 flex-1"><strong>{appointment.patient.name}</strong>{appointment.relationship && <span>Booked by: {appointment.bookedBy?.name ?? 'Unknown'} · {appointment.relationship}</span>}<span>{appointment.doctor.name} · {dateTime(appointment.completedAt ?? appointment.scheduledStartAt)}</span><small>{modes[appointment.consultationMode]} · Appointment ID: {appointment.publicAppointmentId ?? appointment.id}{appointment.token ? ` · ${appointment.token.label}` : ''}</small></span><span className="status-badge">Appointment Fully Done</span></Link>;
}

export function PatientHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams(); const view = searchParams.get('recipient') === 'family' ? 'family' : 'self'; const [appointments, setAppointments] = useState<Appointment[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<unknown>(null);
  const load = () => { setLoading(true); void api.listAppointments(view, true).then((result) => setAppointments(result.appointments)).catch(setError).finally(() => setLoading(false)); };
  useEffect(load, [view]); if (loading) return <LoadingState label="Loading consultation history" />; if (error) return <ApiErrorState error={error} onRetry={load} />;
  const returnTo = `/app/history?recipient=${view}`;
  return <div><div className="eyebrow">Completed care</div><h1 className="page-title">History</h1><p className="page-lead">Completed consultations are read-only and remain available here.</p><div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="History views"><button className={`mode-tab ${view === 'self' ? 'active' : ''}`} role="tab" aria-selected={view === 'self'} onClick={() => setSearchParams({ recipient: 'self' })}>My History</button><button className={`mode-tab ${view === 'family' ? 'active' : ''}`} role="tab" aria-selected={view === 'family'} onClick={() => setSearchParams({ recipient: 'family' })}>Family Member History</button></div>{appointments.length ? <div className="mt-6 space-y-3">{appointments.map((appointment) => <PatientHistoryCard appointment={appointment} returnTo={returnTo} key={appointment.id} />)}</div> : <div className="mt-6"><EmptyState title={view === 'family' ? 'No completed family member consultations yet.' : 'No completed consultations yet.'} message="Completed consultations will appear here." /></div>}</div>;
}

export function ReceptionistHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams(); const view = searchParams.get('recipient') === 'family' ? 'family' : 'self'; const [appointments, setAppointments] = useState<ReceptionistAppointment[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<unknown>(null);
  const load = () => { setLoading(true); void api.listReceptionistAppointments('completed', undefined, view).then((result) => setAppointments(result.appointments)).catch(setError).finally(() => setLoading(false)); };
  useEffect(load, [view]); if (loading) return <LoadingState label="Loading clinic history" />; if (error) return <ApiErrorState error={error} onRetry={load} />;
  const returnTo = `/receptionist/history?recipient=${view}`;
  return <div><div className="eyebrow">Completed clinic care</div><h1 className="page-title">History</h1><p className="page-lead">Completed consultations from the assigned active clinic.</p><div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="History views"><button className={`mode-tab ${view === 'self' ? 'active' : ''}`} role="tab" aria-selected={view === 'self'} onClick={() => setSearchParams({ recipient: 'self' })}>Patient History</button><button className={`mode-tab ${view === 'family' ? 'active' : ''}`} role="tab" aria-selected={view === 'family'} onClick={() => setSearchParams({ recipient: 'family' })}>Family Member History</button></div>{appointments.length ? <div className="mt-6 space-y-3">{appointments.map((appointment) => <ReceptionistHistoryCard appointment={appointment} returnTo={returnTo} key={appointment.id} />)}</div> : <div className="mt-6"><EmptyState title={view === 'family' ? 'No completed family member consultations for this clinic.' : 'No completed patient consultations for this clinic.'} message="Completed consultations will appear here." /></div>}</div>;
}
