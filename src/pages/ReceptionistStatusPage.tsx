import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { ApiErrorState, Button, EmptyState, LoadingState } from '../components/ui';
import type { ReceptionistAppointment } from '../types/api';

const money = (cents: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(cents / 100);
const modeLabels: Record<string, string> = { in_person: 'In Person', video: 'Video', audio: 'Audio', chat: 'Chat' };

export function ReceptionistStatusPage({ kind }: { kind: 'payment' | 'consultation' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedStatuses = kind === 'payment' ? ['pending', 'completed'] : ['pending', 'in_consultation', 'completed'];
  const status = allowedStatuses.includes(searchParams.get('status') ?? '') ? searchParams.get('status')! : 'pending';
  const recipient = searchParams.get('recipient') === 'family' ? 'family' : 'self';
  const [appointments, setAppointments] = useState<ReceptionistAppointment[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const statusOptions = kind === 'payment' ? [['pending', 'Payment Pending'], ['completed', 'Payment Completed']] : [['pending', 'Consultation Pending'], ['in_consultation', 'In Consultation'], ['completed', 'Consultation Completed']];
  useEffect(() => {
    setAppointments(null);
    const response = kind === 'payment' ? api.listReceptionistPaymentStatus(status as 'pending' | 'completed', recipient) : api.listReceptionistConsultationStatus(status as 'pending' | 'in_consultation' | 'completed', recipient);
    void response.then((result) => setAppointments(result.appointments)).catch(setError);
  }, [kind, recipient, status]);
  const update = (next: { status?: string; recipient?: 'self' | 'family' }) => setSearchParams({ view: kind === 'payment' ? 'payments' : 'consultations', status: next.status ?? status, recipient: next.recipient ?? recipient });
  if (error) return <ApiErrorState error={error} />;
  if (!appointments) return <LoadingState label="Loading clinic status" />;
  const returnTo = `/receptionist/appointments?${searchParams.toString()}`;
  return <div><div className="eyebrow">Clinic operations</div><h1 className="page-title">{kind === 'payment' ? 'Payment status' : 'Consultation status'}</h1><div className="mt-6 flex flex-wrap gap-2">{statusOptions.map(([value, label]) => <Button key={value} variant={status === value ? 'primary' : 'quiet'} onClick={() => update({ status: value })}>{label}</Button>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button variant={recipient === 'self' ? 'primary' : 'quiet'} onClick={() => update({ recipient: 'self' })}>Patients</Button><Button variant={recipient === 'family' ? 'primary' : 'quiet'} onClick={() => update({ recipient: 'family' })}>Family Members</Button></div><section className="surface mt-6 divide-y divide-slate-100">{appointments.length ? appointments.map((appointment) => <Link className="block py-4" key={appointment.id} to={`/receptionist/appointments/${appointment.id}?returnTo=${encodeURIComponent(returnTo)}`}><strong>{appointment.patient.name}</strong><p className="mt-1 text-sm text-slate-600">{appointment.doctor.name} · {modeLabels[appointment.consultationMode]} · {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(appointment.scheduledStartAt))}</p>{recipient === 'family' && <p className="mt-1 text-sm">Booked by {appointment.bookedBy?.name ?? 'Patient'} · {appointment.relationship}</p>}<p className="mt-1 text-sm">{kind === 'payment' ? `${appointment.payment?.status === 'paid' ? 'Amount paid' : 'Amount due'}: ${money(appointment.payment?.actualAmountCents ?? appointment.payment?.amountCents ?? 0)}${appointment.payment?.receptionMethod ? ` · ${appointment.payment.receptionMethod.toUpperCase()}` : ''}` : `Payment: ${appointment.payment?.status === 'paid' ? 'Completed' : 'Pending'}`}</p><p className="mt-1 text-sm">Consultation: {appointment.status.replaceAll('_', ' ')}</p></Link>) : <EmptyState title="No appointments" message="No matching appointments in this clinic." />}</section></div>;
}