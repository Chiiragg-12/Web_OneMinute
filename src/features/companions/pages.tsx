import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, HeartHandshake, Pencil, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { ApiErrorState, Button, EmptyState } from '../../components/ui';
import { downloadPrivateFile } from '../../api/client';
import { companionAdmin as api } from './api';
import { ActionForm, field, Notes, PageTitle, Paging, Resource, SelectField, Status, TextField, useCompanionData } from './shared';
import { dateTime, finished, money, stages, statusLabel, type Availability, type Booking, type BookingEvent, type Companion, type Complaint, type Incident, type Page, type Payment, type Payout, type Pricing, type Refund, type Tracker, type Verification } from './types';

export function CompanionOverview() {
  const r = useCompanionData<{ bookingStates: { status: string; _count: number }[]; verificationStates: { verificationStatus: string; _count: number }[]; openIncidents: number; openComplaints: number; pendingRefunds: number }>('/admin/overview', 30000);
  const availability = useCompanionData<{ enabled: boolean }>('/service');
  const metrics = r.data ? [
    { label: 'Active journeys', value: r.data.bookingStates.filter(s => !finished(s.status) && !['awaiting_payment', 'awaiting_assignment'].includes(s.status)).reduce((sum, s) => sum + s._count, 0), Icon: HeartHandshake, to: '/admin/companions/bookings' },
    { label: 'Awaiting acceptance', value: r.data.bookingStates.find(s => s.status === 'awaiting_assignment')?._count ?? 0, Icon: CalendarClock, to: '/admin/companions/bookings?status=awaiting_assignment' },
    { label: 'Pending verification', value: r.data.verificationStates.find(s => s.verificationStatus === 'pending')?._count ?? 0, Icon: ShieldCheck, to: '/admin/companions/people' },
    { label: 'Open safety incidents', value: r.data.openIncidents, Icon: AlertTriangle, to: '/admin/companions/safety' },
  ] : [];
  return <><PageTitle title="Care operations at a glance" description="Review safety alerts, verified supply and the journeys that need your attention." refresh={r.refresh} />{availability.data && !availability.data.enabled ? <div className="companion-notice">New bookings are currently disabled. Configure coverage, verified companions and staffed assistance before enabling the service.</div> : null}<Resource resource={r}><div className="companion-metrics">{metrics.map(({ label, value, Icon, to }) => <Link className="companion-metric" key={label} to={to}><Icon size={22} /><strong>{value}</strong><span>{label}</span><ArrowRight size={16} /></Link>)}</div><div className="companion-two-col"><section className="surface"><h3 className="section-title">Booking activity</h3>{r.data?.bookingStates.length ? r.data.bookingStates.map(s => <div className="companion-detail-row" key={s.status}><Status value={s.status} /><strong>{s._count}</strong></div>) : <EmptyState title="Ready for the first journey" message="Bookings will appear here when the service is available." icon={HeartHandshake} />}</section><section className="surface"><h3 className="section-title">Follow up</h3><Link className="companion-detail-row" to="/admin/companions/safety"><span>Open complaints</span><strong>{r.data?.openComplaints}</strong></Link><Link className="companion-detail-row" to="/admin/companions/finance"><span>Refunds to review</span><strong>{r.data?.pendingRefunds}</strong></Link><p className="mt-5 text-sm text-slate-500">Review identity and background evidence before approval. Every pickup and home handover requires a family confirmation code.</p></section></div></Resource></>;
}
export function CompanionPeople() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState('');
  const r = useCompanionData<Page<Companion>>(`/admin/companions?page=${page}&limit=25${status ? `&status=${status}` : ''}`);
  return <><PageTitle title="Companions" description="Review applications, verification expiry and service eligibility." refresh={r.refresh} /><SelectField label="Verification status" name="status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['unsubmitted', 'pending', 'approved', 'rejected'].map(s => <option key={s}>{s}</option>)}</SelectField><Resource resource={r}>{r.data?.items.length ? <div className="companion-table-wrap"><table className="companion-table"><thead><tr><th>Companion</th><th>Languages / coverage</th><th>Verification</th><th>Valid until</th><th /></tr></thead><tbody>{r.data.items.map(p => <tr key={p.id}><td><strong>{p.fullName}</strong><small>{p.phone}</small></td><td>{p.languages.join(', ')}<small>{p.serviceAreas.join(', ')}</small></td><td><Status value={p.suspended ? 'suspended' : p.verificationStatus} /></td><td>{p.verifiedUntil ? dateTime(p.verifiedUntil) : 'Awaiting review'}</td><td><Link className="button button-outline" to={`/admin/companions/people/${p.id}`}>Review profile</Link></td></tr>)}</tbody></table></div> : <EmptyState title="No companions found" message="New companion applications will appear here." icon={Users} />}<Paging page={page} setPage={setPage} count={r.data?.items.length ?? 0} /></Resource></>;
}
export function CompanionPerson() {
  const { id } = useParams(); const r = useCompanionData<{ companion: Companion & { availability: Availability[] }; documents: Verification[] }>(`/admin/companions/${id}`); const [fileError, setFileError] = useState(''); const [opening, setOpening] = useState('');
  const person = r.data?.companion;
  return <><Link className="back-link" to="/admin/companions/people">Back to companions</Link><Resource resource={r}>{person ? <><PageTitle title={person.fullName} description={`${person.phone} · ${person.languages.join(', ')}`} /><div className="flex flex-wrap gap-2"><Status value={person.verificationStatus} />{person.suspended ? <Status value="suspended" /> : null}</div><div className="companion-two-col"><section className="surface"><h3 className="section-title">Evidence and availability</h3><p className="my-3 text-sm text-slate-500">Open and review both identity and background evidence before approving this companion.</p>{r.data?.documents.map(doc => <div className="companion-detail-row" key={doc.id}><div><strong>{statusLabel(doc.kind)}</strong><small className="block text-slate-500">{dateTime(doc.createdAt)} · {doc.status}</small>{doc.reviewNote ? <p className="text-sm">{doc.reviewNote}</p> : null}</div><Button variant="outline" disabled={!!opening} onClick={() => { setOpening(doc.id); setFileError(''); void downloadPrivateFile(`/api/companions/documents/${doc.id}/file`, `${doc.kind}.pdf`).catch(e => setFileError(e instanceof Error ? e.message : 'Could not open document')).finally(() => setOpening('')); }}>{opening === doc.id ? 'Opening…' : 'Open evidence'}</Button></div>)}{!r.data?.documents.length ? <p className="text-sm">No documents submitted.</p> : null}{fileError ? <p role="alert" className="text-rose-700">{fileError}</p> : null}<h4 className="mt-6 font-semibold">Availability</h4>{person.availability.map(a => <p className="mt-2 text-sm" key={a.id}>{dateTime(a.startsAt)} — {dateTime(a.endsAt)}</p>)}{!person.availability.length ? <p className="mt-2 text-sm text-slate-500">No availability added.</p> : null}</section><div className="space-y-5"><ActionForm title="Verification review" submitLabel="Save verification decision" onSuccess={r.refresh} onSubmit={f => api.post(`/admin/companions/${id}/review`, { decision: field(f, 'decision'), note: field(f, 'note'), ...(field(f, 'expiresAt') ? { expiresAt: new Date(field(f, 'expiresAt')).toISOString() } : {}) })}><SelectField label="Decision" name="decision"><option value="approved">Approve after evidence review</option><option value="rejected">Reject / reopen verification</option></SelectField><TextField label="Valid until (required for approval)" name="expiresAt" type="datetime-local" required={false} /><Notes name="note" label="Review notes" /><label className="companion-checkbox"><input type="checkbox" required />I reviewed the submitted identity and background-check evidence.</label></ActionForm><ActionForm title={person.suspended ? 'Restore eligibility' : 'Suspend companion'} submitLabel={person.suspended ? 'Remove suspension' : 'Suspend and flag active journeys'} danger={!person.suspended} onSuccess={r.refresh} onSubmit={f => api.post(`/admin/companions/${id}/suspension`, { suspended: !person.suspended, reason: field(f, 'reason') })}><Notes /></ActionForm><ActionForm title="Service coverage" submitLabel="Update service areas" onSuccess={r.refresh} onSubmit={f => api.patch(`/admin/companions/${id}/service-areas`, { serviceAreas: field(f, 'areas').split(',').map(v => v.trim()).filter(Boolean), reason: field(f, 'reason') })}><TextField name="areas" label="Service areas, separated by commas" defaultValue={person.serviceAreas.join(', ')} /><Notes /></ActionForm></div></div></> : null}</Resource></>;
}
export function CompanionBookings() {
  const initial = new URLSearchParams(window.location.search).get('status') ?? '';
  const [status, setStatus] = useState(initial); const [page, setPage] = useState(1);
  const r = useCompanionData<Page<Booking>>(`/admin/bookings?page=${page}&limit=25${status ? `&status=${status}` : ''}`, 30000);
  return <><PageTitle title="Bookings" description="Follow each journey and resolve assignment or payment issues." refresh={r.refresh} /><SelectField name="status" label="Booking status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All bookings</option>{[...stages, 'cancelled', 'expired', 'unfulfilled', 'no_show'].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</SelectField><Resource resource={r}>{r.data?.items.length ? <div className="companion-table-wrap"><table className="companion-table"><thead><tr><th>Patient / destination</th><th>Pickup time</th><th>Companion</th><th>Status</th><th>Price</th><th /></tr></thead><tbody>{r.data.items.map(b => <tr key={b.id}><td><strong>{b.itinerary?.patient.fullName}</strong><small>{b.itinerary?.destination.name}</small></td><td>{dateTime(b.scheduledAt)}</td><td>{b.companion?.fullName ?? 'Awaiting assignment'}</td><td><Status value={b.status} /></td><td>{money(b.amount ?? 0)}</td><td><Link className="button button-outline" to={`/admin/companions/bookings/${b.id}`}>View journey</Link></td></tr>)}</tbody></table></div> : <EmptyState title="No bookings yet" message="Bookings matching this filter will appear here." />}<Paging page={page} setPage={setPage} count={r.data?.items.length ?? 0} /></Resource></>;
}
// A family that paid by scanning the UPI QR sends the transaction ID. Nothing checks it automatically: confirm it
// only after the money is visible in the receiving account.
function UpiPaymentReview({ bookingId, bookingStatus, onChanged }: { bookingId: string; bookingStatus: string; onChanged: () => void }) {
  const r = useCompanionData<{ payment: Payment | null; refunds: Refund[]; amount: number }>(`/bookings/${bookingId}/payment`, 15000);
  const payment = r.data?.payment;
  if (!r.data || !payment?.orderId?.startsWith('upi_')) return null;
  const reference = payment.orderId.slice(4);
  const changed = () => { r.refresh(); onChanged(); };
  const pendingRefunds = r.data.refunds.filter((refund) => refund.status === 'pending');
  return (
    <section className="space-y-4" aria-label="UPI payment">
      <div className="surface">
        <h3 className="section-title">UPI payment</h3>
        <p className="mt-3 text-sm">Amount <strong>{money(r.data.amount)}</strong> · Transaction ID <strong>{reference}</strong></p>
        <p className="mt-2 text-sm text-slate-500">{payment.status === 'paid' ? 'Confirmed.' : bookingStatus === 'awaiting_payment' ? 'Waiting for your check. Confirm only after you see this amount and ID in the receiving account.' : 'This booking closed before the payment was confirmed. If the money arrived, send it back to the family.'}</p>
      </div>
      {payment.status === 'pending' && bookingStatus === 'awaiting_payment' ? <>
        <ActionForm title="Money received" submitLabel="Confirm payment" onSuccess={changed} onSubmit={() => api.post(`/admin/bookings/${bookingId}/payment/upi/confirm`, {})} />
        <ActionForm title="Money not received" submitLabel="Reject this transaction ID" danger onSuccess={changed} onSubmit={(form) => api.post(`/admin/bookings/${bookingId}/payment/upi/reject`, { reason: field(form, 'reason') })}><Notes /></ActionForm>
      </> : null}
      {payment.status === 'paid' ? pendingRefunds.map((refund) => (
        <ActionForm key={refund.id} title={`Refund ${money(refund.amount)} to the family`} submitLabel="Record refund as sent" onSuccess={changed} onSubmit={(form) => api.post(`/admin/refunds/${refund.id}/upi-paid`, { reference: field(form, 'reference') })}>
          <TextField label="UPI transaction ID of the refund you sent" name="reference" minLength={8} maxLength={35} />
        </ActionForm>
      )) : null}
    </section>
  );
}
export function CompanionBookingDetail() {
  const { id } = useParams(); const r = useCompanionData<{ booking: Booking; events: BookingEvent[] }>(`/admin/bookings/${id}`, 15000);
  const tracker = useCompanionData<Tracker>(`/bookings/${id}/tracker`, 10000);
  const people = useCompanionData<Page<Companion>>('/admin/companions?status=approved&limit=100');
  const b = r.data?.booking; const refresh = () => { r.refresh(); tracker.refresh(); };
  return <><Link className="back-link" to="/admin/companions/bookings">Back to bookings</Link><Resource resource={r}>{b ? <><PageTitle title={b.itinerary?.patient.fullName ?? 'Journey details'} description={`${dateTime(b.scheduledAt)} · ${b.itinerary?.destination.name ?? 'Hospital visit'}`} refresh={refresh} /><div className="flex flex-wrap gap-3"><Status value={b.status} /><span className="tag">{money(b.amount ?? 0)}</span><span className="tag">{b.companion?.fullName ?? 'Companion not assigned'}</span></div><div className="companion-two-col"><div className="space-y-5"><UpiPaymentReview bookingId={b.id} bookingStatus={b.status} onChanged={refresh} /><section className="surface"><h3 className="section-title">Journey details</h3><dl><div className="companion-detail-row"><dt>Pickup</dt><dd>{b.itinerary?.pickup.address}</dd></div><div className="companion-detail-row"><dt>Hospital</dt><dd>{b.itinerary?.destination.address}</dd></div><div className="companion-detail-row"><dt>Assistance</dt><dd>{b.itinerary?.patient.assistanceNeeds.join(', ') || 'No additional needs'}</dd></div></dl><h4 className="mt-4 font-semibold">Emergency contacts</h4>{b.itinerary?.emergencyContacts.map((c, i) => <p key={i} className="mt-2 text-sm">{c.fullName} · {c.relationship} · <a className="text-teal-700" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a></p>)}</section><section className="surface"><h3 className="section-title">Live location</h3>{tracker.error ? <p role="alert">Tracking could not be refreshed. Last displayed information may be out of date.</p> : null}<p className="my-3 text-sm text-slate-500">{tracker.data?.trackingActive ? tracker.data.locationStale ? 'Location is unavailable or more than two minutes old.' : 'Location updated recently.' : 'Location sharing starts when the companion begins the journey.'}</p>{tracker.data?.location ? <><iframe className="companion-map" title="Companion last reported location" referrerPolicy="no-referrer" src={mapUrl(tracker.data.location.latitude, tracker.data.location.longitude)} /><p className="mt-2 text-xs text-slate-500">Last report: {dateTime(tracker.data.location.recordedAt)} · Accuracy ±{Math.round(tracker.data.location.accuracy)} m</p></> : null}</section><section className="surface"><h3 className="section-title">Booking timeline</h3><ol className="companion-timeline">{r.data?.events.map(e => <li key={e.id}><strong>{statusLabel(e.type)}</strong><time>{dateTime(e.createdAt)}</time>{typeof e.detail?.reason === 'string' ? <p>{e.detail.reason}</p> : null}</li>)}</ol></section></div><div className="space-y-5">{['awaiting_assignment', 'assigned'].includes(b.status) ? <ActionForm title="Offer to a verified companion" submitLabel="Send assignment offer" onSuccess={refresh} onSubmit={f => api.post(`/admin/bookings/${id}/assign`, { companionId: field(f, 'companionId'), reason: field(f, 'reason') })}><SelectField label="Companion" name="companionId"><option value="">Select companion</option>{people.data?.items.filter(p => !p.suspended).map(p => <option key={p.id} value={p.id}>{p.fullName} · {p.serviceAreas.join(', ')}</option>)}</SelectField><p className="text-xs text-slate-500">Availability and verification are checked again before assignment. The companion must accept the offer.</p><Notes /></ActionForm> : null}{!finished(b.status) && ['awaiting_payment', 'awaiting_assignment', 'assigned', 'en_route_to_pickup', 'arrived_at_pickup'].includes(b.status) ? <ActionForm title="Cancel before pickup" submitLabel="Cancel and queue any refund" danger onSuccess={refresh} onSubmit={f => api.post(`/bookings/${id}/cancel`, { reason: field(f, 'reason') })}><p className="text-sm">Admin cancellation requests a full refund for a captured payment.</p><Notes /></ActionForm> : null}{['picked_up', 'arrived_at_hospital', 'visit_in_progress', 'returning_home', 'dropped_off'].includes(b.status) ? <ActionForm title="Supervised safe handover" submitLabel="Confirm safe arrival and complete" onSuccess={refresh} onSubmit={f => api.post(`/admin/bookings/${id}/handover`, { reason: field(f, 'reason'), confirmationCode: field(f, 'code') })}><Notes label="Intervention and safe handover details" /><TextField label="Family drop-off confirmation code" name="code" pattern="[0-9]{6}" maxLength={6} /><label className="companion-checkbox"><input type="checkbox" required />The patient is safely home and the family confirmed handover.</label></ActionForm> : null}<ActionForm title="Review payment" submitLabel="Reconcile with payment provider" onSuccess={refresh} onSubmit={() => api.post(`/admin/bookings/${id}/payment/reconcile`)}><p className="text-sm">Current payment: {b.payment?.status ?? 'Not recorded'}</p></ActionForm>{b.payment?.status === 'paid' ? <RefundRequest bookingId={b.id} maximum={b.amount ?? 0} refresh={refresh} /> : null}{!finished(b.status) ? <ActionForm title="Raise a safety incident" submitLabel="Alert the operations team" danger onSuccess={refresh} onSubmit={f => api.post(`/bookings/${id}/emergency`, { message: field(f, 'message') })}><Notes name="message" label="What assistance is needed?" /></ActionForm> : null}</div></div></> : null}</Resource></>;
}
function RefundRequest({ bookingId, maximum, refresh }: { bookingId: string; maximum: number; refresh: () => void }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  return <ActionForm title="Request refund" submitLabel="Queue refund for review" onSuccess={() => { setKey(crypto.randomUUID()); refresh(); }} onSubmit={f => api.post(`/admin/bookings/${bookingId}/refunds`, { requestKey: key, amount: Math.round(Number(field(f, 'amount')) * 100), reason: field(f, 'reason') })}><TextField label="Refund amount (₹)" name="amount" type="number" min="0.01" step="0.01" max={maximum / 100} /><Notes /><p className="text-xs text-slate-500">Pending refunds appear in Payments & payouts. Processing sends a refund to the payment provider.</p></ActionForm>;
}
export function mapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - .012},${lat - .008},${lng + .012},${lat + .008}&layer=mapnik&marker=${lat},${lng}`;
}
export function CompanionSafety() {
  const [tab, setTab] = useState<'incidents' | 'complaints'>('incidents'); const [page, setPage] = useState(1); const [status, setStatus] = useState('open');
  const r = useCompanionData<Page<Incident | Complaint>>(`/admin/${tab}?page=${page}&limit=25${status ? `&status=${status}` : ''}`, 15000);
  return <><PageTitle title="Safety & complaints" description="Acknowledge emergency incidents promptly and record how each case was resolved." refresh={r.refresh} /><div className="flex flex-wrap gap-3">{(['incidents', 'complaints'] as const).map(t => <Button key={t} variant={tab === t ? 'primary' : 'outline'} onClick={() => { setTab(t); setPage(1); setStatus('open'); }}>{statusLabel(t)}</Button>)}<SelectField name="status" label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All</option><option value="open">Open</option>{tab === 'incidents' ? <option value="acknowledged">Acknowledged</option> : null}<option value="resolved">Resolved</option></SelectField></div><Resource resource={r}>{!r.data?.items.length ? <EmptyState title="No cases in this view" message="New safety incidents and complaints will appear here." /> : <div className="companion-two-col">{r.data.items.map(item => <section className="surface" key={item.id}><div className="flex justify-between gap-3"><Status value={item.status} /><time className="text-xs text-slate-500">{dateTime(item.createdAt)}</time></div><p className="my-4 whitespace-pre-wrap">{item.message}</p><Link className="text-sm font-semibold text-teal-700" to={`/admin/companions/bookings/${item.bookingId}`}>Open journey →</Link>{'escalationDueAt' in item && !item.escalatedAt && item.status === 'open' ? <p className="mt-3 text-sm text-amber-800">Awaiting acknowledgement. Escalation due: {dateTime(item.escalationDueAt!)}</p> : null}{item.resolution ? <p className="mt-3 text-sm">Resolution: {item.resolution}</p> : null}{tab === 'incidents' && item.status === 'open' ? <ActionForm title="Take ownership" submitLabel="Acknowledge incident" onSuccess={r.refresh} onSubmit={() => api.post(`/admin/incidents/${item.id}/acknowledge`)} /> : item.status !== 'resolved' ? <ActionForm title="Resolve case" submitLabel="Record resolution" onSuccess={r.refresh} onSubmit={f => api.post(`/admin/${tab}/${item.id}/resolve`, { resolution: field(f, 'resolution') })}><Notes label="Resolution details" name="resolution" /></ActionForm> : null}</section>)}</div>}<Paging page={page} setPage={setPage} count={r.data?.items.length ?? 0} /></Resource></>;
}
// Fills the latitude and longitude boxes of the pricing form so nobody has to look them up by hand.
// The area name is sent to OpenStreetMap's public search (no key needed); only the name leaves the site.
function LocationFinder() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fill = (button: HTMLButtonElement, latitude: number, longitude: number) => {
    const form = button.closest('form');
    const set = (name: string, value: number) => { const input = form?.querySelector<HTMLInputElement>(`input[name="${name}"]`); if (input) input.value = value.toFixed(6); };
    set('lat', latitude); set('lng', longitude);
  };
  const find = async (button: HTMLButtonElement) => {
    const name = button.closest('form')?.querySelector<HTMLInputElement>('input[name="serviceArea"]')?.value.trim();
    if (!name) { setMessage('Type the service area name first, for example "Connaught Place, Delhi".'); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(name)}`);
      const found = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!found.length) { setMessage('No place found. Add the city or state to the name, or enter the numbers by hand.'); return; }
      fill(button, Number(found[0].lat), Number(found[0].lon));
      setMessage(`Found: ${found[0].display_name}. Check it matches the area you meant.`);
    } catch { setMessage('Could not look the place up. Check your connection or enter the numbers by hand.'); }
    finally { setBusy(false); }
  };
  const here = (button: HTMLButtonElement) => {
    if (!navigator.geolocation) { setMessage('This browser cannot share its location.'); return; }
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => { fill(button, position.coords.latitude, position.coords.longitude); setMessage('Filled from your current location.'); },
      () => setMessage('Location was blocked. Allow it in the browser, or use "Find location".'),
    );
  };
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={(event) => void find(event.currentTarget)}>{busy ? 'Looking up…' : 'Find location from the name'}</Button><Button type="button" variant="outline" onClick={(event) => here(event.currentTarget)}>Use my current location</Button></div>{message ? <p className="text-sm text-slate-600" role="status">{message}</p> : null}</div>;
}
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="surface my-8 w-full max-w-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <button type="button" aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const defaultTransportPolicy = 'Family arranges and pays for transport separately.';

// One form for adding an area and for editing one. Saving always publishes a new version of the area; the
// backend switches the previous version of the same area off, and existing bookings keep their accepted terms.
function PricingForm({ initial, onDone, onCancel }: { initial: Pricing | null; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(undefined);
    const form = new FormData(event.currentTarget);
    const number = (key: string) => Number(field(form, key));
    try {
      await api.post('/admin/pricing', { serviceArea: field(form, 'serviceArea'), centerLatitude: number('lat'), centerLongitude: number('lng'), radiusKm: number('radius'), baseAmount: Math.round(number('base') * 100), hourlyAmount: Math.round(number('hourly') * 100), minimumHours: number('min'), maximumHours: number('max'), travelBufferMinutes: number('buffer'), commissionBps: Math.round(number('commission') * 100), freeCancellationHours: number('freeHours'), lateCancellationBps: Math.round(number('cancelFee') * 100), transportPolicy: field(form, 'transport') });
      onDone();
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      {initial ? <p className="text-sm text-slate-500">Saving publishes a new version for this area. The current version is switched off, and bookings already made keep the terms they were made under.</p> : null}
      <TextField label="Service area name" name="serviceArea" defaultValue={initial?.serviceArea ?? ''} readOnly={Boolean(initial)} />
      <LocationFinder />
      <div className="companion-two-fields">
        <TextField label="Center latitude" name="lat" type="number" step="any" min="-90" max="90" defaultValue={initial ? String(initial.centerLatitude) : ''} />
        <TextField label="Center longitude" name="lng" type="number" step="any" min="-180" max="180" defaultValue={initial ? String(initial.centerLongitude) : ''} />
      </div>
      <TextField label="Coverage radius (km)" name="radius" type="number" min="1" max="500" defaultValue={String(initial?.radiusKm ?? 25)} />
      <div className="companion-two-fields">
        <TextField label="Base price (₹)" name="base" type="number" min="0" step="0.01" defaultValue={String((initial?.baseAmount ?? 10000) / 100)} />
        <TextField label="Hourly price (₹)" name="hourly" type="number" min="0.01" step="0.01" defaultValue={String((initial?.hourlyAmount ?? 20000) / 100)} />
        <TextField label="Minimum hours" name="min" type="number" min="1" max="24" defaultValue={String(initial?.minimumHours ?? 1)} />
        <TextField label="Maximum hours" name="max" type="number" min="1" max="24" defaultValue={String(initial?.maximumHours ?? 8)} />
      </div>
      <TextField label="Travel buffer (minutes)" name="buffer" type="number" min="0" max="180" defaultValue={String(initial?.travelBufferMinutes ?? 60)} />
      <TextField label="Platform commission (%)" name="commission" type="number" min="0" max="100" step="0.01" defaultValue={String((initial?.commissionBps ?? 1500) / 100)} />
      <TextField label="Free cancellation before pickup (hours)" name="freeHours" type="number" min="0" max="168" defaultValue={String(initial?.freeCancellationHours ?? 24)} />
      <TextField label="Late cancellation fee (%)" name="cancelFee" type="number" min="0" max="100" step="0.01" defaultValue={String((initial?.lateCancellationBps ?? 2500) / 100)} />
      <label className="block text-sm font-semibold text-slate-700">Transport responsibility and costs<textarea className="field mt-2" name="transport" required maxLength={2000} rows={3} defaultValue={initial?.transportPolicy ?? defaultTransportPolicy} /></label>
      {error ? <ApiErrorState error={error} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add service area'}</Button>
      </div>
    </form>
  );
}

type PricingDialog = { mode: 'add' } | { mode: 'edit'; item: Pricing } | { mode: 'delete'; item: Pricing };

export function CompanionPricing() {
  const r = useCompanionData<Page<Pricing>>('/admin/pricing');
  const [dialog, setDialog] = useState<PricingDialog | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>();
  const items = [...(r.data?.items ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.serviceArea.localeCompare(b.serviceArea));
  const shown = showDisabled ? items : items.filter((item) => item.active);
  const close = () => { setDialog(null); setDeleteError(undefined); };
  const saved = () => { close(); r.refresh(); };
  const remove = async (item: Pricing) => {
    setDeleting(true); setDeleteError(undefined);
    try { await api.remove(`/admin/pricing/${item.id}`); saved(); }
    catch (cause) { setDeleteError(cause); }
    finally { setDeleting(false); }
  };
  return (
    <>
      <PageTitle title="Pricing & coverage" description="Service areas and their prices. Patients can only book inside an active area. Existing bookings keep their accepted terms." refresh={r.refresh} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showDisabled} onChange={(event) => setShowDisabled(event.target.checked)} />Show disabled and older versions</label>
        <Button onClick={() => setDialog({ mode: 'add' })}><Plus size={16} />Add service area</Button>
      </div>
      <Resource resource={r}>
        {!shown.length ? <div className="mt-4"><EmptyState title="No service areas configured" message="Add the first coverage area and its pricing." /></div> : (
          <div className="surface mt-4 overflow-x-auto p-0">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>{['Area', 'Center', 'Radius', 'Base', 'Hourly', 'Hours', 'Buffer', 'Commission', 'Cancellation', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3"><div className="font-semibold">{item.serviceArea}</div><div className="mt-1 max-w-[220px] text-xs text-slate-500">{item.transportPolicy}</div></td>
                    <td className="px-3 py-3 whitespace-nowrap">{Number(item.centerLatitude).toFixed(4)}, {Number(item.centerLongitude).toFixed(4)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{item.radiusKm} km</td>
                    <td className="px-3 py-3 whitespace-nowrap">{money(item.baseAmount)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{money(item.hourlyAmount)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{item.minimumHours}–{item.maximumHours} h</td>
                    <td className="px-3 py-3 whitespace-nowrap">{item.travelBufferMinutes} min</td>
                    <td className="px-3 py-3 whitespace-nowrap">{item.commissionBps / 100}%</td>
                    <td className="px-3 py-3 whitespace-nowrap">{item.freeCancellationHours} h free, then {item.lateCancellationBps / 100}%</td>
                    <td className="px-3 py-3"><Status value={item.active ? 'approved' : 'disabled'} /></td>
                    <td className="px-3 py-3">
                      {item.active ? (
                        <div className="flex gap-2">
                          <Button variant="outline" aria-label={`Edit ${item.serviceArea}`} onClick={() => setDialog({ mode: 'edit', item })}><Pencil size={14} />Edit</Button>
                          <Button variant="danger" aria-label={`Delete ${item.serviceArea}`} onClick={() => setDialog({ mode: 'delete', item })}><Trash2 size={14} />Delete</Button>
                        </div>
                      ) : <span className="text-slate-400">Closed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Resource>
      {dialog?.mode === 'add' ? <Dialog title="Add a service area" onClose={close}><PricingForm initial={null} onDone={saved} onCancel={close} /></Dialog> : null}
      {dialog?.mode === 'edit' ? <Dialog title={`Edit ${dialog.item.serviceArea}`} onClose={close}><PricingForm key={dialog.item.id} initial={dialog.item} onDone={saved} onCancel={close} /></Dialog> : null}
      {dialog?.mode === 'delete' ? (
        <Dialog title="Delete this service area?" onClose={close}>
          <p className="text-sm text-slate-600">New quotes for <strong>{dialog.item.serviceArea}</strong> will stop right away. Bookings already made keep their price and terms. You can add the area again later.</p>
          {deleteError ? <div className="mt-3"><ApiErrorState error={deleteError} /></div> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={close}>Keep it</Button>
            <Button variant="danger" disabled={deleting} onClick={() => void remove(dialog.item)}>{deleting ? 'Deleting…' : 'Delete area'}</Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
export function CompanionFinance() {
  const [tab, setTab] = useState<'payments' | 'refunds' | 'payouts'>('payments'); const [page, setPage] = useState(1);
  const r = useCompanionData<Page<Payment | Refund | Payout>>(`/admin/${tab}?page=${page}&limit=25`);
  const completed = useCompanionData<Page<Booking>>('/admin/bookings?status=completed&limit=100');
  const [selected, setSelected] = useState<string[]>([]); const [payoutKey, setPayoutKey] = useState(() => crypto.randomUUID()); const [companionId, setCompanionId] = useState('');
  const checks = useCompanionData<{ issues: { bookingId: string; issue: string }[]; checkedBookings: number }>('/admin/reconciliation');
  const refresh = () => { r.refresh(); checks.refresh(); completed.refresh(); };
  const companions = [...new Map((completed.data?.items ?? []).filter(b => b.companion).map(b => [b.companion!.id, b.companion!])).values()];
  return <><PageTitle title="Payments & payouts" description="Review captured payments, process refunds and record companion transfers." refresh={refresh} /><div className="flex flex-wrap gap-3">{(['payments', 'refunds', 'payouts'] as const).map(t => <Button key={t} variant={tab === t ? 'primary' : 'outline'} onClick={() => { setTab(t); setPage(1); }}>{statusLabel(t)}</Button>)}</div><Resource resource={r}><div className="space-y-4">{r.data?.items.map(item => <section className="surface" key={item.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><Status value={item.status} /><small className="ml-3 text-slate-500">{dateTime(item.createdAt)}</small></div>{'amount' in item ? <strong>{money(item.amount)}</strong> : null}</div>{'bookingId' in item ? <Link className="mt-3 block break-all text-sm text-teal-700" to={`/admin/companions/bookings/${item.bookingId}`}>View booking {item.bookingId}</Link> : <p className="mt-3 break-all text-sm">Companion: {item.companionId}</p>}{'reason' in item ? <p className="mt-3 text-sm">{item.reason}</p> : null}{'failureReason' in item && item.failureReason ? <p className="mt-3 text-sm text-amber-800">{item.failureReason}</p> : null}{tab === 'refunds' && item.status === 'pending' ? <ActionForm title="Send refund to provider" submitLabel={`Process ${money((item as Refund).amount)} refund`} onSuccess={refresh} onSubmit={() => api.post(`/admin/refunds/${item.id}/process`)}><label className="companion-checkbox"><input type="checkbox" required />I reviewed the refund amount and reason.</label></ActionForm> : tab === 'refunds' && item.status === 'processing' ? <ActionForm title="Check uncertain refund outcome" submitLabel="Reconcile refund" onSuccess={refresh} onSubmit={() => api.post(`/admin/refunds/${item.id}/reconcile`)}><p className="text-sm">Reconciliation checks the original request and does not submit a second refund.</p></ActionForm> : null}{tab === 'payouts' && item.status === 'pending' ? <div className="companion-two-col"><ActionForm title="Record completed bank transfer" submitLabel="Record payout as completed" onSuccess={refresh} onSubmit={f => api.post(`/admin/payouts/${item.id}/complete`, { externalReference: field(f, 'reference') })}><TextField name="reference" label="Unique bank transfer reference" /><label className="companion-checkbox"><input type="checkbox" required />The transfer has already been made and verified.</label></ActionForm><ActionForm title="Release unpaid reservation" submitLabel="Cancel payout reservation" danger onSuccess={refresh} onSubmit={f => api.post(`/admin/payouts/${item.id}/cancel`, { reason: field(f, 'reason') })}><Notes /><label className="companion-checkbox"><input type="checkbox" required />No bank transfer has been made for this reservation.</label></ActionForm></div> : null}</section>)}{!r.data?.items.length ? <EmptyState title={`No ${tab} yet`} message="Service transactions will appear here." /> : null}</div><Paging page={page} setPage={setPage} count={r.data?.items.length ?? 0} /></Resource>{tab === 'payouts' ? <ActionForm title="Reserve completed companion earnings" submitLabel="Create payout reservation" onSuccess={() => { setSelected([]); setPayoutKey(crypto.randomUUID()); refresh(); }} onSubmit={() => {
    if (!selected.length) return Promise.reject(new Error('Choose at least one completed booking.'));
    return api.post('/admin/payouts', { requestKey: payoutKey, companionId, bookingIds: selected });
  }}><SelectField name="companionId" label="Companion with completed bookings" value={companionId} onChange={e => { setCompanionId(e.target.value); setSelected([]); }}><option value="">Select companion</option>{companions.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</SelectField>{completed.data?.items.filter(b => b.companion?.id === companionId).map(b => <label className="companion-checkbox" key={b.id}><input type="checkbox" checked={selected.includes(b.id)} onChange={e => setSelected(values => e.target.checked ? [...values, b.id] : values.filter(v => v !== b.id))} />{b.itinerary?.patient.fullName} · {dateTime(b.scheduledAt)}</label>)}<p className="text-sm text-slate-500">The server calculates net earnings and checks hold periods, disputes, refunds and prior payouts. This reserves funds; make the bank transfer separately.</p></ActionForm> : null}<section className="surface"><h3 className="section-title">Reconciliation</h3>{checks.error ? <p role="alert">Reconciliation could not be loaded. Refresh to retry.</p> : checks.data?.issues.length ? checks.data.issues.map((i, index) => <Link className="companion-detail-row" key={index} to={`/admin/companions/bookings/${i.bookingId}`}>{i.issue}<ArrowRight size={16} /></Link>) : <p className="mt-3 text-sm text-slate-500">{checks.data ? `No issues found in ${checks.data.checkedBookings} checked bookings.` : 'Checking records…'}</p>}</section></>;
}
