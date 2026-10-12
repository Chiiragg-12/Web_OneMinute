import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Stethoscope,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api, ApiError } from "../api/client";
import { openRazorpayCheckout } from "../utils/razorpay";
import type {
  Appointment,
  Clinic,
  ConsultationMode,
  ConsultationOption,
  Doctor,
  BookingInput,
  FamilyMember,
  HealthRecordSummary,
} from "../types/api";
import {
  ApiErrorState,
  Button,
  EmptyState,
  LoadingState,
} from "../components/ui";

const paymentLabels = {
  wallet: "Pay Online with Razorpay",
  upi: "Pay Online with Razorpay",
  razorpay: "Pay Online with Razorpay",
  pay_at_reception: "Pay at reception",
} as const;
const modeLabels: Record<ConsultationMode, string> = {
  in_person: "In person",
  video: "Video",
  audio: "Audio",
  chat: "Chat",
};
const appointmentStatusLabels: Record<string, string> = {
  booked: "Booked",
  queued: "Queued",
  in_consultation: "In Consultation",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};
const paymentStatusLabels: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  pay_at_reception: "Pay at Reception",
};
const readableAppointmentStatus = (value: string) =>
  appointmentStatusLabels[value] ??
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const readablePaymentStatus = (value: string) =>
  paymentStatusLabels[value] ??
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatClinicDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function clinicLocalDate(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function availableModes(options: ConsultationOption[]) {
  return [...new Set(options.map((option) => option.consultationMode))];
}

export function BookingPage() {
  const { clinicId, doctorId } = useParams();
  const location = useLocation();
  const initialOption = location.state as ConsultationOption | undefined;
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [options, setOptions] = useState<ConsultationOption[]>([]);
  const [mode, setMode] = useState<ConsultationMode | null>(
    initialOption?.consultationMode ?? null,
  );
  const [duration, setDuration] = useState<number | null>(
    initialOption?.durationMinutes ?? null,
  );
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotReload, setSlotReload] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    BookingInput["paymentMethod"] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [slotError, setSlotError] = useState<unknown>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Appointment | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecordSummary[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    if (!clinicId || !doctorId) return;
    void Promise.all([
      api.getClinic(clinicId),
      api.getDoctorOptions(clinicId, doctorId),
    ])
      .then(([clinicResult, optionsResult]) => {
        setClinic(clinicResult.clinic);
        setDoctor(optionsResult.doctor);
        setOptions(optionsResult.options);
        const nextMode =
          initialOption &&
          optionsResult.options.some(
            (option) =>
              option.consultationMode === initialOption.consultationMode &&
              option.durationMinutes === initialOption.durationMinutes,
          )
            ? initialOption.consultationMode
            : (optionsResult.options[0]?.consultationMode ?? null);
        setMode(nextMode);
        setDuration(
          nextMode
            ? (optionsResult.options.find(
                (option) => option.consultationMode === nextMode,
              )?.durationMinutes ?? null)
            : null,
        );
        setDate(clinicLocalDate(clinicResult.clinic.timezone));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [clinicId, doctorId]);

  useEffect(() => {
    void api
      .listFamilyMembers()
      .then((result) => setFamilyMembers(result.familyMembers))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    setSelectedRecordIds([]);
    setRecordsLoading(true);
    void api
      .listHealthRecords(familyMemberId ?? undefined)
      .then((result) => setHealthRecords(result.records))
      .catch(() => setHealthRecords([]))
      .finally(() => setRecordsLoading(false));
  }, [familyMemberId]);

  const durations = useMemo(
    () => options.filter((option) => option.consultationMode === mode),
    [options, mode],
  );
  const selectedOption =
    durations.find((option) => option.durationMinutes === duration) ?? null;
  const online = mode !== null && mode !== "in_person";
  const paymentOptions: BookingInput["paymentMethod"][] = online
    ? ["razorpay"]
    : ["razorpay", "pay_at_reception"];

  useEffect(() => {
    if (!clinicId || !doctorId || !date) return;
    setSlotsLoading(true);
    setSlotError(null);
    setSlot(null);
    void api
      .listSlots(clinicId, doctorId, date)
      .then((result) => setSlots(result.slots))
      .catch(setSlotError)
      .finally(() => setSlotsLoading(false));
  }, [clinicId, doctorId, date, slotReload]);

  function changeMode(nextMode: ConsultationMode) {
    setMode(nextMode);
    setDuration(
      options.find((option) => option.consultationMode === nextMode)
        ?.durationMinutes ?? null,
    );
    setSlot(null);
    setPaymentMethod(null);
  }

  function submit() {
    if (
      !clinicId ||
      !doctorId ||
      !mode ||
      !slot ||
      !paymentMethod ||
      !selectedOption
    )
      return;
    setBusy(true);
    setSubmitError(null);
    const input: BookingInput = {
      doctorId,
      clinicId,
      scheduledStartAt: slot,
      consultationMode: mode,
      durationMinutes: selectedOption.durationMinutes,
      ...(reason.trim() ? { consultationReason: reason.trim() } : {}),
      paymentMethod,
      ...(familyMemberId ? { familyMemberId } : {}),
      ...(selectedRecordIds.length
        ? { healthRecordIds: selectedRecordIds }
        : {}),
    };
    void api
      .createAppointment(input)
      .then((result) => setCreated(result.appointment))
      .catch((nextError) => {
        setSubmitError(nextError);
        if (nextError instanceof ApiError && nextError.status === 409)
          setSlot(null);
      })
      .finally(() => setBusy(false));
  }

  if (created && clinic && doctor)
    return (
      <BookingConfirmation
        appointment={created}
        clinic={clinic}
        doctor={doctor}
      />
    );
  if (loading) return <LoadingState label="Preparing your booking" />;
  if (error) return <ApiErrorState error={error} />;
  if (!clinic || !doctor || !mode)
    return (
      <EmptyState
        title="Booking is unavailable"
        message="This doctor or clinic is no longer available."
      />
    );

  return (
    <div>
      <Link
        className="back-link"
        to={`/app/clinics/${clinic.id}/doctors/${doctor.id}`}
      >
        <ArrowLeft size={16} />
        Back to doctor
      </Link>
      <div className="mt-6 eyebrow">Book an appointment</div>
      <h1 className="page-title">Plan your visit</h1>
      <p className="page-lead">
        Choose a consultation, a clinic-local time, and your preferred payment
        selection.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <BookingSection
            step="01"
            icon={Stethoscope}
            title="Consultation mode"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {availableModes(options).map((optionMode) => (
                <button
                  key={optionMode}
                  className={`selection-card ${mode === optionMode ? "selected" : ""}`}
                  type="button"
                  onClick={() => changeMode(optionMode)}
                >
                  <span>
                    <strong>{modeLabels[optionMode]}</strong>
                    <small>
                      {optionMode === "in_person"
                        ? "At the clinic"
                        : "Remote consultation"}
                    </small>
                  </span>
                  <span className="selection-mark">
                    {mode === optionMode ? "Selected" : "Choose"}
                  </span>
                </button>
              ))}
            </div>
          </BookingSection>
          <BookingSection
            step="00"
            icon={Stethoscope}
            title="Who is this appointment for?"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className={`selection-card ${familyMemberId === null ? "selected" : ""}`}
                type="button"
                onClick={() => setFamilyMemberId(null)}
              >
                <span>
                  <strong>Myself</strong>
                  <small>
                    {familyMemberId === null
                      ? "Your patient profile"
                      : "Book for yourself"}
                  </small>
                </span>
                <span className="selection-mark">
                  {familyMemberId === null ? "Selected" : "Choose"}
                </span>
              </button>
              {familyMembers.map((member) => (
                <button
                  className={`selection-card ${familyMemberId === member.id ? "selected" : ""}`}
                  type="button"
                  key={member.id}
                  onClick={() => setFamilyMemberId(member.id)}
                >
                  <span>
                    <strong>{member.fullName}</strong>
                    <small>{member.relationship}</small>
                  </span>
                  <span className="selection-mark">
                    {familyMemberId === member.id ? "Selected" : "Choose"}
                  </span>
                </button>
              ))}
            </div>
            {familyMemberId && (
              <p className="mt-3 text-sm font-semibold text-teal-800">
                Care recipient:{" "}
                {
                  familyMembers.find((member) => member.id === familyMemberId)
                    ?.fullName
                }
              </p>
            )}
          </BookingSection>
          <BookingSection
            step="01A"
            icon={FileText}
            title="Attach health records (optional)"
          >
            {recordsLoading ? (
              <LoadingState label="Loading health records" />
            ) : healthRecords.length === 0 ? (
              <p className="text-sm text-slate-500">
                No health records added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {healthRecords.map((record) => (
                  <label className="action-card cursor-pointer" key={record.id}>
                    <input
                      className="size-4 accent-teal-700"
                      type="checkbox"
                      checked={selectedRecordIds.includes(record.id)}
                      onChange={(event) =>
                        setSelectedRecordIds((current) =>
                          event.target.checked
                            ? [...current, record.id]
                            : current.filter((id) => id !== record.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <strong>
                        {record.title || readablePaymentStatus(record.type)}
                      </strong>
                      <span className="break-words">
                        {record.originalFilename}
                      </span>
                    </span>
                    <span className="status-badge">
                      {record.type.replaceAll("_", " ")}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </BookingSection>
          <BookingSection step="02" icon={Clock3} title="Duration and price">
            <div className="grid gap-3 sm:grid-cols-3">
              {durations.map((option) => (
                <button
                  key={option.durationMinutes}
                  className={`selection-card ${duration === option.durationMinutes ? "selected" : ""}`}
                  type="button"
                  onClick={() => {
                    setDuration(option.durationMinutes);
                    setPaymentMethod(null);
                  }}
                >
                  <span>
                    <strong>{option.durationMinutes} min</strong>
                    <small>{formatMoney(option.priceCents)}</small>
                  </span>
                  <span className="selection-mark">
                    {duration === option.durationMinutes
                      ? "Selected"
                      : "Choose"}
                  </span>
                </button>
              ))}
            </div>
          </BookingSection>
          <BookingSection
            step="03"
            icon={CalendarDays}
            title="Date and available slot"
          >
            <label className="block max-w-xs">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Clinic date
              </span>
              <input
                className="field"
                type="date"
                value={date}
                min={clinicLocalDate(clinic.timezone)}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <p className="mt-3 text-xs text-slate-500">
              Times shown in {clinic.timezone}.
            </p>
            {slotsLoading ? (
              <LoadingState label="Finding available times" />
            ) : slotError ? (
              <div className="mt-4">
                <ApiErrorState
                  error={slotError}
                  onRetry={() => setSlotReload((current) => current + 1)}
                />
              </div>
            ) : slots.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No slots on this date"
                  message="Choose another clinic date to see available times."
                />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {slots.map((availableSlot) => (
                  <button
                    key={availableSlot}
                    className={`slot-button ${slot === availableSlot ? "selected" : ""}`}
                    type="button"
                    onClick={() => setSlot(availableSlot)}
                  >
                    {formatClinicTime(availableSlot, clinic.timezone)}
                  </button>
                ))}
              </div>
            )}
          </BookingSection>
          <BookingSection step="04" icon={FileText} title="Reason for visit">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Consultation reason{" "}
                <span className="font-normal text-slate-500">(optional)</span>
              </span>
              <textarea
                className="field min-h-28 resize-y"
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Tell the doctor what you would like help with"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {reason.length}/500
              </span>
            </label>
          </BookingSection>
          <BookingSection step="05" icon={CreditCard} title="Payment selection">
            <div className="grid gap-3 sm:grid-cols-3">
              {paymentOptions.map((payment) => (
                <button
                  key={payment}
                  className={`selection-card ${paymentMethod === payment ? "selected" : ""}`}
                  type="button"
                  onClick={() => setPaymentMethod(payment)}
                >
                  <span>
                    <strong>{paymentLabels[payment]}</strong>
                    <small>
                      {payment === "pay_at_reception"
                        ? "Settle at the clinic"
                        : "Selection only"}
                    </small>
                  </span>
                  <span className="selection-mark">
                    {paymentMethod === payment ? "Selected" : "Choose"}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Selecting a method does not charge your wallet or confirm an
              online payment.
            </p>
          </BookingSection>
          {submitError ? <ApiErrorState error={submitError} /> : null}
        </div>
        <aside className="h-fit lg:sticky lg:top-7">
          <BookingReview
            clinic={clinic}
            doctor={doctor}
            mode={mode}
            duration={selectedOption?.durationMinutes ?? null}
            price={selectedOption?.priceCents ?? null}
            slot={slot}
            paymentMethod={paymentMethod}
            timezone={clinic.timezone}
          />
          <Button
            className="mt-4 w-full"
            disabled={busy || !slot || !paymentMethod || !selectedOption}
            onClick={submit}
          >
            {busy ? (
              "Booking…"
            ) : (
              <>
                Confirm appointment <ArrowRight size={17} />
              </>
            )}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function BookingSection({
  step,
  icon: Icon,
  title,
  children,
}: {
  step: string;
  icon: typeof Stethoscope;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="surface">
      <div className="mb-5 flex items-center gap-3">
        <span className="step-number">{step}</span>
        <Icon className="text-teal-700" size={19} />
        <h2 className="font-display text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BookingReview({
  clinic,
  doctor,
  mode,
  duration,
  price,
  slot,
  paymentMethod,
  timezone,
}: {
  clinic: Clinic;
  doctor: Doctor;
  mode: ConsultationMode;
  duration: number | null;
  price: number | null;
  slot: string | null;
  paymentMethod: BookingInput["paymentMethod"] | null;
  timezone: string;
}) {
  return (
    <section className="review-card">
      <p className="eyebrow">Review</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">
        Your appointment
      </h2>
      <dl className="mt-6 space-y-4 text-sm">
        <ReviewRow label="Clinic" value={clinic.name} />
        <ReviewRow label="Doctor" value={doctor.fullName} />
        <ReviewRow
          label="Consultation"
          value={`${modeLabels[mode]}${duration ? ` · ${duration} min` : ""}`}
        />
        <ReviewRow
          label="When"
          value={slot ? formatClinicDateTime(slot, timezone) : "Choose a slot"}
        />
        <ReviewRow
          label="Payment"
          value={
            paymentMethod ? paymentLabels[paymentMethod] : "Choose a method"
          }
        />
        {price !== null && (
          <ReviewRow label="Listed price" value={formatMoney(price)} />
        )}
      </dl>
      <p className="mt-6 border-t border-teal-800/40 pt-4 text-xs leading-5 text-teal-100/70">
        The backend confirms the final appointment state and price.
      </p>
    </section>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[.12em] text-teal-200/70">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-white">{value}</dd>
    </div>
  );
}

function BookingConfirmation({
  appointment,
  clinic,
  doctor,
}: {
  appointment: Appointment;
  clinic: Clinic;
  doctor: Doctor;
}) {
  const [currentAppointment, setCurrentAppointment] = useState(appointment);
  const [paymentStatus, setPaymentStatus] = useState(appointment.payment?.status ?? "pending");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<unknown>(null);
  const payOnline = async () => {
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const order = await api.createRazorpayOrder(appointment.id);
      if (!order.orderId) throw new Error("Razorpay order is unavailable");
      const result = await openRazorpayCheckout({ keyId: order.keyId, orderId: order.orderId, amount: order.amount, currency: order.currency, name: "OneMinute Healthcare", description: `${modeLabels[appointment!.consultationMode]} appointment` });
      const verified = await api.verifyRazorpayPayment(appointment.id, { razorpayPaymentId: result.razorpay_payment_id, razorpayOrderId: result.razorpay_order_id, razorpaySignature: result.razorpay_signature });
      setPaymentStatus(verified.payment?.status ?? "pending");
      const refreshed = await api.getAppointment(appointment.id);
      setCurrentAppointment(refreshed.appointment);
    } catch (nextError) {
      setPaymentError(nextError);
    } finally {
      setPaymentBusy(false);
    }
  };
  const paymentErrorMessage = paymentError instanceof Error ? paymentError.message : paymentError ? "Payment verification failed" : null;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="surface text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={29} />
        </span>
        <div className="mt-5 eyebrow">{currentAppointment.status === "pending_payment" ? "Payment required" : "Appointment created"}</div>
        <h1 className="page-title mt-2">{currentAppointment.status === "pending_payment" ? "Complete payment to book." : "You are booked."}</h1>
        <p className="page-lead mx-auto">
          This confirmation uses the appointment state returned by the backend.
        </p>
        <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
          <Info
            label="Patient"
            value={appointment.patient?.name ?? "Not available"}
          />
          <Info
            label="Booked by"
            value={
              appointment.bookedBy?.name ??
              appointment.patient?.name ??
              "Not available"
            }
          />
          <Info label="Appointment ID" value={appointment.publicAppointmentId ?? appointment.id} />
          <Info label="Clinic" value={clinic.name} />
          <Info label="Doctor" value={doctor.fullName} />
          <Info
            label="When"
            value={formatClinicDateTime(
              appointment.scheduledStartAt,
              clinic.timezone,
            )}
          />
          <Info
            label="Status"
            value={readableAppointmentStatus(currentAppointment.status)}
          />
          <Info
            label="Payment state"
            value={readablePaymentStatus(currentAppointment.payment?.status ?? paymentStatus)}
          />
        </div>
        {appointment.payment?.method !== "pay_at_reception" && paymentStatus !== "paid" && <div className="mt-6"><Button disabled={paymentBusy} onClick={() => void payOnline()}>Pay Online with Razorpay</Button>{paymentErrorMessage && <p className="mt-3 text-sm text-red-700">{paymentErrorMessage}</p>}<p className="mt-2 text-xs text-slate-500">Payment is marked paid only after secure server verification.</p></div>}
        {currentAppointment.status !== "pending_payment" && <Link className="button button-primary mt-8" to={`/app/appointments/${currentAppointment.id}`}>
          View appointment <ArrowRight size={17} />
        </Link>}
      </div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="label">{label}</p>
      <p className="mt-2 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}
function formatClinicTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AppointmentsPage() {
  const [view, setView] = useState<'self' | 'family'>('self');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicTimezones, setClinicTimezones] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const load = () => {
    setLoading(true);
    setError(null);
    void api
      .listAppointments(view)
      .then(async (result) => {
        setAppointments(result.appointments);
        const clinicIds = [
          ...new Set(
            result.appointments
              .map((item) => item.clinic?.id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const clinics = await Promise.all(
          clinicIds.map(async (id) => {
            try {
              return await api.getClinic(id);
            } catch {
              return null;
            }
          }),
        );
        setClinicTimezones(
          Object.fromEntries(
            clinics
              .filter((result): result is { clinic: Clinic } => Boolean(result))
              .map((result) => [result.clinic.id, result.clinic.timezone]),
          ),
        );
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [view]);
  if (loading) return <LoadingState label="Loading your appointments" />;
  if (error) return <ApiErrorState error={error} onRetry={load} />;
  return (
    <div>
      <div className="eyebrow">Your care</div>
      <h1 className="page-title">{view === 'family' ? 'Family Member Appointments' : 'My appointments'}</h1>
      <p className="page-lead">
        Only appointments belonging to your patient account appear here.
      </p>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Appointment views"><button className={`mode-tab ${view === 'self' ? 'active' : ''}`} role="tab" aria-selected={view === 'self'} onClick={() => setView('self')}>My Appointments</button><button className={`mode-tab ${view === 'family' ? 'active' : ''}`} role="tab" aria-selected={view === 'family'} onClick={() => setView('family')}>Family Member Appointments</button></div>
      {appointments.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No appointments yet"
            message={view === 'family' ? 'No family member appointments yet.' : 'Choose a clinic to plan your first visit.'}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {appointments.map((appointment) => (
            <Link
              className="appointment-row"
              to={`/app/appointments/${appointment.id}`}
              key={appointment.id}
            >
              <span className="calendar-tile">
                <CalendarDays size={20} />
              </span>
              <span className="min-w-0">
                <strong>{appointment.doctor?.name ?? "Doctor"}</strong>
                {appointment.patient?.name && (
                  <span>{appointment.patient.name}</span>
                )}
                {view === 'family' && <span>Booked by: {appointment.bookedBy?.name ?? 'You'} · {appointment.patient?.relationship ?? 'Family member'}</span>}
                <span>
                  {appointment.token
                    ? `Token ${appointment.token.label}`
                    : "Token: Not generated yet"}
                </span>
                <span>
                  {appointment.clinic?.name ?? "Clinic"} ·{" "}
                  {modeLabels[appointment.consultationMode]}
                </span>
                <small>
                  {appointment.clinic?.id &&
                  clinicTimezones[appointment.clinic.id]
                    ? formatClinicDateTime(
                        appointment.scheduledStartAt,
                        clinicTimezones[appointment.clinic.id],
                      )
                    : "Clinic time unavailable"}
                </small>
              </span>
              <span className="status-badge">
                {readableAppointmentStatus(appointment.status)}
              </span>
              <ArrowRight className="shrink-0 text-slate-400" size={18} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppointmentDetailPage() {
  const location = useLocation();
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [payment, setPayment] = useState<Appointment["payment"]>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("Changed plans");
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<unknown>(null);
  const [openingRecordId, setOpeningRecordId] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<import('../types/api').Prescription | null>(null);
  const load = () => {
    if (!appointmentId) return;
    setLoading(true);
    setError(null);
    void api
      .getAppointment(appointmentId)
      .then(async (result) => {
        setAppointment(result.appointment);
        if (result.appointment.status === "completed") void api.getPatientPrescription(appointmentId).then((item) => setPrescription(item.prescription)).catch(() => undefined);
        const [paymentResult, clinicResult] = await Promise.all([
          api.getPayment(appointmentId),
          result.appointment.clinic?.id
            ? api.getClinic(result.appointment.clinic.id)
            : Promise.resolve({ clinic: null }),
        ]);
        setPayment(paymentResult.payment);
        setClinic(clinicResult.clinic);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(load, [appointmentId]);
  if (loading) return <LoadingState label="Loading appointment" />;
  if (error || !appointment)
    return error ? (
      <ApiErrorState error={error} onRetry={load} />
    ) : (
      <EmptyState
        title="Appointment not found"
        message="This appointment is no longer available."
      />
    );
  const clinicTimezone = clinic?.timezone ?? "UTC";
  const paymentErrorMessage = paymentError instanceof Error ? paymentError.message : paymentError ? "Payment verification failed" : null;
  const requestedReturnTo = new URLSearchParams(location.search).get('returnTo');
  const returnTo = requestedReturnTo?.startsWith('/app/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : '/app/appointments';
  const canCancel = ["booked", "queued"].includes(appointment.status);
  async function cancel() {
    if (!appointmentId || !reason.trim()) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelAppointment(appointmentId, reason.trim());
      setCancelOpen(false);
      load();
    } catch (nextError) {
      setCancelError(nextError);
      load();
    } finally {
      setCancelling(false);
    }
  }
  async function payLegacyOnline() {
    if (!appointmentId) return;
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const order = await api.createRazorpayOrder(appointmentId);
      if (!order.orderId) throw new Error("Razorpay order is unavailable");
      const result = await openRazorpayCheckout({ keyId: order.keyId, orderId: order.orderId, amount: order.amount, currency: order.currency, name: "OneMinute Healthcare", description: `${modeLabels[appointment!.consultationMode]} appointment` });
      await api.verifyRazorpayPayment(appointmentId, { razorpayPaymentId: result.razorpay_payment_id, razorpayOrderId: result.razorpay_order_id, razorpaySignature: result.razorpay_signature });
      load();
    } catch (nextError) {
      setPaymentError(nextError);
    } finally {
      setPaymentBusy(false);
    }
  }
  async function openRecord(recordId: string) {
    setOpeningRecordId(recordId);
    try {
      const blob = await api.openHealthRecord(recordId);
      window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
    } catch (nextError) {
      setCancelError(nextError);
    } finally {
      setOpeningRecordId(null);
    }
  }
  const prescriptionContent = prescription ? <FinalPrescriptionContent appointment={appointment} prescription={prescription} clinicTimezone={clinicTimezone} showPrintAction /> : null;
  const printPrescription = prescription ? createPortal(<FinalPrescriptionContent appointment={appointment} prescription={prescription} clinicTimezone={clinicTimezone} />, document.body) : null;
  return (
    <>
    <div>
      <Link className="back-link" to={returnTo}>
        <ArrowLeft size={16} />
        My appointments
      </Link>
      <div className="mt-6 eyebrow">Appointment detail</div>
      <h1 className="page-title">
        {appointment.doctor?.name ?? "Your appointment"}
      </h1>
      <p className="page-lead">
        {appointment.clinic?.name ?? "Clinic"} ·{" "}
        {appointment.consultationMode.replace("_", " ")}
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="surface">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="status-badge large">
              {readableAppointmentStatus(appointment.status)}
            </span>
            <div className="flex flex-wrap gap-2">
              {appointment.consultationMode === "in_person" &&
                !["cancelled", "completed", "no_show"].includes(
                  appointment.status,
                ) && (
                  <Link
                    className="button button-primary"
                    to={`/app/appointments/${appointment.id}/track`}
                  >
                    Track visit
                  </Link>
                )}
              {canCancel && (
                <Button variant="danger" onClick={() => setCancelOpen(true)}>
                  Cancel appointment
                </Button>
              )}
              {appointment.token && ["booked", "queued", "in_consultation"].includes(appointment.status) && <p className="w-full text-sm text-amber-700">Cancellation is no longer available because your token has already been generated. This appointment is not eligible for a cancellation refund.</p>}
            </div>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <Info
              label="Doctor"
              value={appointment.doctor?.name ?? "Not available"}
            />
            <Info
              label="Patient"
              value={appointment.patient?.name ?? "Not available"}
            />
            <Info
              label="Booked by"
              value={
                appointment.bookedBy?.name ??
                appointment.patient?.name ??
                "Not available"
              }
            />
            {appointment.patient?.relationship && (
              <Info
                label="Relationship"
                value={appointment.patient.relationship}
              />
            )}
            <Info
              label="Clinic"
              value={appointment.clinic?.name ?? "Not available"}
            />
            <Info label="Appointment ID" value={appointment.publicAppointmentId ?? appointment.id} />
            <Info
              label="Scheduled"
              value={formatClinicDateTime(
                appointment.scheduledStartAt,
                clinicTimezone,
              )}
            />
            <Info
              label="Consultation"
              value={`${modeLabels[appointment.consultationMode]}${appointment.durationMinutes ? ` · ${appointment.durationMinutes} min` : ""}`}
            />
            <Info
              label="Token"
              value={
                appointment.token
                  ? `${appointment.token.label} · ${readableAppointmentStatus(appointment.token.status)}`
                  : "Not generated yet"
              }
            />
            <Info
              label="Reason"
              value={appointment.consultationReason || "No reason provided"}
            />
            <Info
              label="Height"
              value={
                appointment.patient?.heightCm
                  ? `${appointment.patient.heightCm} cm`
                  : "Not added"
              }
            />
            <Info
              label="Weight"
              value={
                appointment.patient?.weightKg
                  ? `${appointment.patient.weightKg} kg`
                  : "Not added"
              }
            />
            <Info
              label="BMI"
              value={
                appointment.patient?.bmi != null
                  ? String(appointment.patient.bmi)
                  : "Not available"
              }
            />
            <Info
              label="Date of birth"
              value={
                appointment.patient?.dob
                  ? new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                    }).format(new Date(appointment.patient.dob))
                  : "Not added"
              }
            />
            <Info
              label="Sex"
              value={
                appointment.patient?.sex
                  ? appointment.patient.sex.replaceAll("_", " ")
                  : "Not added"
              }
            />
            <Info
              label="Attached records"
              value={
                appointment.healthRecords?.length
                  ? `${appointment.healthRecords.length} health record${appointment.healthRecords.length === 1 ? "" : "s"} attached`
                  : "None attached"
              }
            />
          </div>
          <section className="mt-6 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Health records</div>
                <h2 className="section-title">Attached records</h2>
              </div>
              <span className="status-badge">
                {appointment.healthRecords?.length ?? 0} attached
              </span>
            </div>
            {appointment.healthRecords?.length ? (
              <div className="mt-4 space-y-3">
                {appointment.healthRecords.map((record) => (
                  <div className="action-card" key={record.id}>
                    <span className="min-w-0 flex-1">
                      <strong>
                        {record.title || record.type.replaceAll("_", " ")}
                      </strong>
                      <span className="break-words">
                        {record.originalFilename}
                      </span>
                    </span>
                    <button
                      className="button button-quiet"
                      type="button"
                      disabled={openingRecordId === record.id}
                      onClick={() => void openRecord(record.id)}
                    >
                      {openingRecordId === record.id ? "Opening…" : "View"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No records attached.
              </p>
            )}
          </section>
          {prescriptionContent}
          {cancelError ? (
            <div className="mt-5">
              <ApiErrorState error={cancelError} onRetry={load} />
            </div>
          ) : null}
        </section>
        <section className="review-card">
          <p className="eyebrow">Payment state</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            {payment
              ? readablePaymentStatus(payment.status)
              : appointment.payment
                ? readablePaymentStatus(appointment.payment.status)
                : "Not returned"}
          </h2>
          <p className="mt-4 text-sm leading-6 text-teal-100/75">
            Payment selection and payment settlement are separate. No payment
            has been marked successful by this screen.
          </p>
          {appointment.consultationMode !== "in_person" && (payment ?? appointment.payment)?.method === "razorpay" && (payment ?? appointment.payment)?.status === "pending" && <div className="mt-6"><Button disabled={paymentBusy} onClick={() => void payLegacyOnline()}>Pay Online with Razorpay</Button>{paymentErrorMessage && <p className="mt-3 text-sm text-red-700">{paymentErrorMessage}</p>}</div>}
          {(payment || appointment.payment) && (
            <p className="mt-6 border-t border-teal-800/40 pt-4 text-sm text-teal-100">
              Method: {payment?.method ?? appointment.payment?.method}
            </p>
          )}
          {appointment.refund && <div className="mt-6 border-t border-teal-800/40 pt-4 text-sm text-teal-100"><p className="font-semibold">Refund status: {appointment.refund.status}</p><p className="mt-1">Refunds are processed to the original payment method. Amount: {formatMoney(appointment.refund.amountCents)}</p>{appointment.refund.failureReason && <p className="mt-1 text-rose-200">{appointment.refund.failureReason}</p>}</div>}
        </section>
      </div>
      {cancelOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
        >
          <div className="modal">
            <h2
              id="cancel-title"
              className="font-display text-2xl font-semibold"
            >
              Cancel this appointment?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              The backend will confirm whether it can still be cancelled.
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold">Reason</span>
              <textarea
                className="field min-h-24"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="quiet" onClick={() => setCancelOpen(false)}>
                Keep appointment
              </Button>
              <Button
                variant="danger"
                disabled={cancelling || !reason.trim()}
                onClick={() => void cancel()}
              >
                {cancelling ? "Cancelling…" : "Confirm cancellation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    {printPrescription}
    </>
  );
}

export function FinalPrescriptionContent({ appointment, prescription, clinicTimezone, showPrintAction = false }: { appointment: Appointment; prescription: import('../types/api').Prescription; clinicTimezone: string; showPrintAction?: boolean }) {
  return <section className={showPrintAction ? 'surface mt-6' : 'prescription-print-portal'}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">Prescription available</div><h2 className="section-title">FINAL PRESCRIPTION</h2></div>{showPrintAction && <Button variant="quiet" onClick={() => window.print()}>Print Prescription</Button>}</div>{prescription.identity && <div className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="Clinic" value={`${prescription.identity.clinicName ?? 'Clinic'} · ${prescription.identity.clinicPublicId ?? 'ID unavailable'}`} /><Info label="Doctor" value={`${prescription.identity.doctorName ?? 'Doctor'}${prescription.identity.doctorQualifications ? ` · ${prescription.identity.doctorQualifications}` : ''}`} /><Info label="Patient" value={prescription.identity.patientName ?? 'Patient'} /><Info label="Appointment" value={`${appointment.id} · ${modeLabels[appointment.consultationMode]}`} />{prescription.identity.bookedByName && <Info label="Booked by" value={`${prescription.identity.bookedByName}${prescription.identity.relationship ? ` · ${prescription.identity.relationship}` : ''}`} />}</div>}<div className="mt-5 space-y-3">{prescription.medicines.map((medicine) => <div className="rounded-xl border border-slate-200 p-4" key={medicine.id}><strong>{medicine.medicineName}</strong><p className="mt-1 text-sm text-slate-600">{[medicine.strength, medicine.dosage, medicine.route, medicine.frequency, medicine.duration].filter(Boolean).join(' · ')}</p>{medicine.instructions && <p className="mt-1 text-sm">{medicine.instructions}</p>}</div>)}</div>{prescription.advice && <p className="mt-4 text-sm">Advice: {prescription.advice}</p>}<p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">Approved by {prescription.identity?.doctorName ?? 'treating Doctor'} on {prescription.approvedAt ? formatClinicDateTime(prescription.approvedAt, clinicTimezone) : 'recorded approval'}</p></section>;
}
