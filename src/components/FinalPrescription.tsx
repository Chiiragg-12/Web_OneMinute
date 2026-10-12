import type { Appointment, ConsultationMode, Prescription } from '../types/api';
import { Button } from './ui';

const modeLabels: Record<ConsultationMode, string> = { in_person: 'In person', video: 'Video', audio: 'Audio', chat: 'Chat' };

export function formatClinicDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="label">{label}</p>
      <p className="mt-2 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function FinalPrescriptionContent({ appointment, prescription, clinicTimezone, showPrintAction = false }: { appointment: Appointment; prescription: Prescription; clinicTimezone: string; showPrintAction?: boolean }) {
  return <section className={showPrintAction ? 'surface mt-6' : 'prescription-print-portal'}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">Prescription available</div><h2 className="section-title">FINAL PRESCRIPTION</h2></div>{showPrintAction && <Button variant="quiet" onClick={() => window.print()}>Print Prescription</Button>}</div>{prescription.identity && <div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Clinic" value={`${prescription.identity.clinicName ?? 'Clinic'} · ${prescription.identity.clinicPublicId ?? 'ID unavailable'}`} /><Info label="Doctor" value={`${prescription.identity.doctorName ?? 'Doctor'}${prescription.identity.doctorQualifications ? ` · ${prescription.identity.doctorQualifications}` : ''}`} /><Info label="Patient" value={prescription.identity.patientName ?? 'Patient'} /><Info label="Appointment" value={`${appointment.id} · ${modeLabels[appointment.consultationMode]}`} />{prescription.identity.bookedByName && <Info label="Booked by" value={`${prescription.identity.bookedByName}${prescription.identity.relationship ? ` · ${prescription.identity.relationship}` : ''}`} />}</div>}<div className="mt-5 space-y-3">{prescription.medicines.map((medicine) => <div className="rounded-xl border border-slate-200 p-4" key={medicine.id}><strong>{medicine.medicineName}</strong><p className="mt-1 text-sm text-slate-600">{[medicine.strength, medicine.dosage, medicine.route, medicine.frequency, medicine.duration].filter(Boolean).join(' · ')}</p>{medicine.instructions && <p className="mt-1 text-sm">{medicine.instructions}</p>}</div>)}</div>{prescription.advice && <p className="mt-4 text-sm">Advice: {prescription.advice}</p>}<p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">Approved by {prescription.identity?.doctorName ?? 'treating Doctor'} on {prescription.approvedAt ? formatClinicDateTime(prescription.approvedAt, clinicTimezone) : 'recorded approval'}</p></section>;
}
