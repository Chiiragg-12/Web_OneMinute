import { Component, useEffect, useState, type ErrorInfo, type FormEvent, type ReactNode } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  HeartHandshake,
  CreditCard,
  Filter,
  Landmark,
  LayoutDashboard,
  Percent,
  RefreshCw,
  RotateCcw,
  Scale,
  ScrollText,
  Search,
} from 'lucide-react';
import { AppShell, type ShellGroup } from '../components/AppShell';
import { ApiErrorState, Button, EmptyState, Field, LoadingState, SuccessMessage } from '../components/ui';

// ─── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AdminErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Admin panel uncaught exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="surface m-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center" role="alert">
          <AlertCircle className="mx-auto mb-3 text-rose-600" size={32} />
          <h2 className="font-display text-xl font-semibold text-rose-950">Section error occurred</h2>
          <p className="mt-2 text-sm text-rose-800">
            {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button className="button button-danger" type="button" onClick={this.handleReset}>
              Try reloading section
            </button>
            <button className="button button-quiet" type="button" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Date range helpers ────────────────────────────────────────────────────────

function todayRange() {
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function toLocalDateValue(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE');
}

function fromLocalDateValue(value: string, isEnd: boolean) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  if (isEnd) { d.setHours(23, 59, 59, 999); } else { d.setHours(0, 0, 0, 0); }
  return d.toISOString();
}

function DateRangePicker({
  start,
  end,
  onChange,
  onRefresh,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <span className="font-medium">From</span>
        <input
          type="date"
          className="field w-auto"
          value={toLocalDateValue(start)}
          max={toLocalDateValue(end)}
          onChange={(e) => { const v = fromLocalDateValue(e.target.value, false); if (v) onChange(v, end); }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <span className="font-medium">To</span>
        <input
          type="date"
          className="field w-auto"
          value={toLocalDateValue(end)}
          min={toLocalDateValue(start)}
          max={toLocalDateValue(new Date().toISOString())}
          onChange={(e) => { const v = fromLocalDateValue(e.target.value, true); if (v) onChange(start, v); }}
        />
      </label>
      {onRefresh && (
        <button
          className="button button-quiet flex items-center gap-1.5"
          type="button"
          onClick={onRefresh}
          title="Refresh current data"
          aria-label="Refresh data"
        >
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      )}
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function money(cents: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(cents / 100);
}

function issueMoney(cents: number | null) {
  return cents === null ? 'Not available' : money(cents);
}

function issueLabel(type: string) {
  return type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-card"><p className="label">{label}</p><p className="mt-2 font-display text-xl font-semibold">{value}</p></div>;
}

function PageHeader({
  eyebrow,
  title,
  lead,
  range,
  onRangeChange,
  onRefresh,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  range: { start: string; end: string };
  onRangeChange: (start: string, end: string) => void;
  onRefresh?: () => void;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="page-title">{title}</h1>
      {lead ? <p className="page-lead">{lead}</p> : null}
      <div className="mt-4">
        <DateRangePicker start={range.start} end={range.end} onChange={onRangeChange} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const groups: ShellGroup[] = [
    { items: [{ to: '/admin', label: 'Overview', Icon: LayoutDashboard, end: true }] },
    { label: 'Money', items: [{ to: '/admin/payments', label: 'Payments', Icon: CreditCard }, { to: '/admin/commissions', label: 'Commissions', Icon: Percent }, { to: '/admin/settlements', label: 'Settlements', Icon: Landmark }, { to: '/admin/reconciliation', label: 'Reconciliation', Icon: Scale }] },
    { label: 'Care services', items: [{ to: '/admin/companions', label: 'Senior Companion', Icon: HeartHandshake }] },
    { label: 'Platform', items: [{ to: '/admin/clinics', label: 'Clinics', Icon: Building2 }, { to: '/admin/doctors', label: 'Doctors', Icon: BadgeCheck }, { to: '/admin/audit-log', label: 'Audit Log', Icon: ScrollText }] },
  ];
  return (
    <AppShell
      homeTo="/admin"
      groups={groups}
      onSignOut={() => void logout('admin').then(() => navigate('/'))}
      user={{ name: 'Administrator', email: state.status === 'authenticated' ? state.user.email : null, context: [{ label: 'Role', value: 'Admin' }, { label: 'Workspace', value: 'Financial operations' }] }}
    >
      <AdminErrorBoundary>
        <Outlet />
      </AdminErrorBoundary>
    </AppShell>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export function AdminOverviewPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getFinanceOverview>>['overview'] | null>(null);
  const [reconciliation, setReconciliation] = useState<Awaited<ReturnType<typeof api.getFinanceReconciliation>>['reconciliation'] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);

  function load(start: string, end: string) {
    setError(null); setData(null); setReconciliation(null);
    void Promise.all([api.getFinanceOverview(start, end), api.getFinanceReconciliation(start, end)])
      .then(([overview, check]) => { setData(overview.overview); setReconciliation(check.reconciliation); })
      .catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [range.start, range.end]);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!data || !reconciliation) return <LoadingState label="Loading financial overview" />;

  const metrics = [
    ['Verified online collections', money(data.online.grossCents)],
    ['OneMinute online commission', money(data.online.commissionCents)],
    ['Clinic payable', money(data.online.clinicPayableCents)],
    ['Reported offline collections', money(data.offline.collectedCents)],
    ['Cash commission outstanding', money(data.offline.outstandingCommissionCents)],
    ['Ledger entries', String(data.entries)],
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Financial control room"
        lead="Finalized financial events. Online capture and receptionist collection use their event timestamps."
        range={range}
        onRangeChange={handleRangeChange}
        onRefresh={() => load(range.start, range.end)}
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value]) => (
          <section className="surface" key={label}><p className="label">{label}</p><p className="mt-3 font-display text-2xl font-semibold text-slate-950">{value}</p></section>
        ))}
      </div>
      <section className="surface mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Reconciliation</p>
          <h2 className="section-title">{reconciliation.reconciled ? 'No discrepancies detected' : 'Review required'}</h2>
          <p className="mt-1 text-sm text-slate-500">{reconciliation.issueCount} issue(s) detected across {reconciliation.entriesChecked} ledger entries checked.</p>
        </div>
        {reconciliation.reconciled
          ? <span className="status status-success">Reconciled</span>
          : <Link className="button button-danger" to="/admin/reconciliation">{reconciliation.issueCount} issue(s) · View issues</Link>
        }
      </section>
    </div>
  );
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

export function AdminReconciliationPage() {
  const [reconciliation, setReconciliation] = useState<Awaited<ReturnType<typeof api.getFinanceReconciliation>>['reconciliation'] | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);

  function load(start: string, end: string) {
    setError(null); setReconciliation(null);
    void api.getFinanceReconciliation(start, end).then((result) => setReconciliation(result.reconciliation)).catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [range.start, range.end]);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!reconciliation) return <LoadingState label="Loading reconciliation details" />;

  const filtered = reconciliation.issues.filter((issue) =>
    filter === 'all' ||
    (filter === 'missing' && issue.type.includes('missing')) ||
    (filter === 'mismatch' && issue.type.includes('mismatch')) ||
    (filter === 'allocation' && issue.type.includes('allocation')) ||
    (filter === 'cross-clinic' && issue.type.includes('cross_clinic')) ||
    (filter === 'other' && !issue.type.includes('missing') && !issue.type.includes('mismatch') && !issue.type.includes('allocation') && !issue.type.includes('cross_clinic'))
  );

  return (
    <div>
      <Link className="back-link" to="/admin">Back to overview</Link>
      <div className="mt-6">
        <PageHeader
          eyebrow="Reconciliation"
          title="Issue details"
          lead="Read-only findings from the reconciliation engine. Viewing issues does not modify financial records."
          range={range}
          onRangeChange={handleRangeChange}
          onRefresh={() => load(range.start, range.end)}
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {[['all', 'All'], ['missing', 'Missing Ledger'], ['mismatch', 'Mismatch'], ['allocation', 'Allocation'], ['cross-clinic', 'Cross-clinic'], ['other', 'Other']].map(([value, label]) => (
          <button className={filter === value ? 'button button-primary' : 'button button-quiet'} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      {reconciliation.reconciled
        ? <section className="surface mt-6"><h2 className="section-title">No discrepancies detected</h2><p className="mt-2 text-sm text-slate-500">{reconciliation.entriesChecked} ledger entries checked.</p></section>
        : filtered.length === 0
          ? <div className="mt-6"><EmptyState title="No issues match this filter" message="Try a different filter category." /></div>
          : <div className="mt-6 space-y-4">
            {filtered.map((issue) => (
              <article className="surface" key={issue.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="eyebrow">{issueLabel(issue.type)}</span>
                      <span className={issue.severity === 'high' ? 'status status-danger' : issue.severity === 'medium' ? 'status status-warning' : 'status'}>{issue.severity}</span>
                      {issue.historical ? <span className="status">Historical candidate</span> : null}
                    </div>
                    <h2 className="mt-2 section-title">{issue.explanation}</h2>
                  </div>
                  <p className="font-display text-xl font-semibold">{issueMoney(issue.amountCents)}</p>
                </div>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="label">Appointment</dt><dd className="mt-1 break-all">{issue.appointmentId ?? 'Not available'}</dd></div>
                  <div><dt className="label">Payment</dt><dd className="mt-1 break-all">{issue.paymentId ?? 'Not available'}</dd></div>
                  <div><dt className="label">Ledger</dt><dd className="mt-1 break-all">{issue.ledgerId ?? 'Missing'}</dd></div>
                  <div><dt className="label">Clinic</dt><dd className="mt-1">{issue.clinic ? `${issue.clinic.name} (${issue.clinic.id})` : 'Not available'}</dd></div>
                  <div><dt className="label">Doctor</dt><dd className="mt-1">{issue.doctor ? `${issue.doctor.fullName} (${issue.doctor.id})` : 'Not available'}</dd></div>
                  <div><dt className="label">Payment method</dt><dd className="mt-1">{issue.paymentMethod ?? 'Not available'}</dd></div>
                  <div><dt className="label">Razorpay reference</dt><dd className="mt-1 break-all">{issue.razorpay?.paymentId ?? issue.razorpay?.orderId ?? 'Not applicable'}</dd></div>
                  <div><dt className="label">Event date/time</dt><dd className="mt-1">{issue.eventAt ? new Date(issue.eventAt).toLocaleString('en-IN') : 'Not available'}</dd></div>
                  <div><dt className="label">Expected</dt><dd className="mt-1">{issue.expected}</dd></div>
                  <div><dt className="label">Actual</dt><dd className="mt-1">{issue.actual}</dd></div>
                </dl>
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="label">Recommended investigation/action</p>
                  <p className="mt-1 text-sm text-slate-700">{issue.recommendedAction}</p>
                </div>
              </article>
            ))}
          </div>
      }
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function AdminPaymentsPage() {
  type PaymentRow = Awaited<ReturnType<typeof api.getFinancePayments>>['payments'][number];
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  // Reversal modal / inline state
  const [reversalTarget, setReversalTarget] = useState<PaymentRow | null>(null);
  const [reversalType, setReversalType] = useState<'refund' | 'adjustment'>('adjustment');
  const [reversalAmountRupees, setReversalAmountRupees] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reversalBusy, setReversalBusy] = useState(false);
  const [reversalError, setReversalError] = useState<unknown>(null);
  const [reversalSuccess, setReversalSuccess] = useState('');

  function load(start: string, end: string) {
    setError(null); setRows(null);
    void api.getFinancePayments(start, end).then((result) => setRows(result.payments)).catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [range.start, range.end]);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  const handleCreateReversal = async (e: FormEvent) => {
    e.preventDefault();
    if (!reversalTarget) return;
    setReversalBusy(true); setReversalError(null); setReversalSuccess('');
    try {
      const amountRupees = parseFloat(reversalAmountRupees);
      if (isNaN(amountRupees) || amountRupees <= 0) {
        setReversalError(new Error('Enter a valid positive amount in ₹'));
        return;
      }
      const amountCents = Math.round(amountRupees * 100);
      if (amountCents > reversalTarget.grossAmountCents) {
        setReversalError(new Error(`Amount exceeds original transaction gross of ${money(reversalTarget.grossAmountCents)}`));
        return;
      }
      if (!reversalReason.trim()) {
        setReversalError(new Error('A reason is required for creating a reversal.'));
        return;
      }

      const res = await api.createReversal({
        sourceEntryId: reversalTarget.id,
        amountCents,
        type: reversalType,
        reason: reversalReason.trim(),
      });

      setReversalSuccess(`Reversal recorded successfully (${res.reversal.publicLedgerId ?? res.reversal.id}).`);
      setReversalTarget(null);
      setReversalAmountRupees('');
      setReversalReason('');
      load(range.start, range.end);
    } catch (err) {
      setReversalError(err);
    } finally {
      setReversalBusy(false);
    }
  };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!rows) return <LoadingState label="Loading payments" />;

  const filteredRows = rows.filter((r) => {
    if (methodFilter !== 'all' && r.paymentMethod !== methodFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const match =
        r.id.toLowerCase().includes(term) ||
        (r.publicLedgerId && r.publicLedgerId.toLowerCase().includes(term)) ||
        (r.appointmentId && r.appointmentId.toLowerCase().includes(term)) ||
        (r.appointment?.publicAppointmentId && r.appointment.publicAppointmentId.toLowerCase().includes(term)) ||
        (r.clinic.name && r.clinic.name.toLowerCase().includes(term)) ||
        (r.doctor.fullName && r.doctor.fullName.toLowerCase().includes(term));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Payments"
        title="Traceable payment events"
        lead="Financial event timestamp: captured payment or recorded collection. Refund and settlement states are backend-authoritative."
        range={range}
        onRangeChange={handleRangeChange}
        onRefresh={() => load(range.start, range.end)}
      />

      {reversalSuccess ? <div className="mt-4"><SuccessMessage>{reversalSuccess}</SuccessMessage></div> : null}

      {/* Filter toolbar */}
      <div className="surface mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            className="field pl-9"
            placeholder="Search by ID, Doctor, or Clinic…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={16} />
          <span className="text-sm font-medium text-slate-600">Method:</span>
          <select
            className="field w-auto py-1.5"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="all">All Methods</option>
            <option value="razorpay">Razorpay (Online)</option>
            <option value="cash">Cash (Reception)</option>
            <option value="upi">UPI</option>
          </select>
        </div>
      </div>

      {/* Reversal modal dialog */}
      {reversalTarget && (
        <section className="surface mt-6 border-2 border-amber-300">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="section-title">Create Reversal / Adjustment</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ledger entry: <span className="font-mono">{reversalTarget.publicLedgerId ?? reversalTarget.id}</span> ·{' '}
                Original gross: {money(reversalTarget.grossAmountCents)} ({reversalTarget.clinic.name})
              </p>
            </div>
            <button className="button button-quiet" type="button" onClick={() => setReversalTarget(null)}>
              Cancel
            </button>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleCreateReversal}>
            {reversalError ? <ApiErrorState error={reversalError} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Reversal Type</label>
                <select
                  className="field"
                  value={reversalType}
                  onChange={(e) => setReversalType(e.target.value as 'refund' | 'adjustment')}
                >
                  <option value="adjustment">Adjustment (compensating entry)</option>
                  <option value="refund">Refund (patient compensation)</option>
                </select>
              </div>
              <Field
                label={`Amount (₹) — Max ${money(reversalTarget.grossAmountCents)}`}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 500"
                value={reversalAmountRupees}
                onChange={(e) => setReversalAmountRupees(e.target.value)}
                required
              />
            </div>
            <Field
              label="Mandatory Reason / Audit explanation"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Disputed consultation fee compensation per clinic escalation"
              required
              minLength={3}
              maxLength={1000}
            />
            <div className="flex gap-3">
              <Button disabled={reversalBusy}>{reversalBusy ? 'Processing…' : 'Confirm Reversal'}</Button>
              <button className="button button-quiet" type="button" onClick={() => setReversalTarget(null)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {filteredRows.length === 0
        ? <div className="mt-6"><EmptyState title="No payment events match" message="No finalized payments found matching your current filters." /></div>
        : <div className="surface mt-6 overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-3">Event</th>
                <th className="pb-3">Appointment</th>
                <th className="pb-3">Clinic</th>
                <th className="pb-3">Doctor</th>
                <th className="pb-3">Gross</th>
                <th className="pb-3">Commission</th>
                <th className="pb-3">Direction</th>
                <th className="pb-3">Refund</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-4">
                    <div>{new Date(row.finalizedAt).toLocaleString('en-IN')}</div>
                    <div className="break-all text-xs text-slate-500">Ledger {row.publicLedgerId ?? row.id}</div>
                    <div className="break-all text-xs text-slate-500">Payment {row.appointmentPayment?.publicPaymentId ?? 'Not available'}</div>
                    <div className="text-xs capitalize font-medium">{row.paymentMethod}</div>
                  </td>
                  <td className="py-4 break-all">{row.appointment?.publicAppointmentId ?? row.appointmentId}</td>
                  <td className="py-4">{row.clinic.name}<div className="text-xs text-slate-500">{row.clinic.publicClinicId ?? row.clinic.id}</div></td>
                  <td className="py-4">{row.doctor.fullName}<div className="text-xs text-slate-500">{row.doctor.publicDoctorId ?? row.doctor.id}</div></td>
                  <td className="py-4">{money(row.grossAmountCents)}</td>
                  <td className="py-4">{money(row.commissionAmountCents)}</td>
                  <td className="py-4 font-semibold">{row.paymentMethod === 'cash' ? 'Clinic owes OneMinute' : 'OneMinute owes Clinic'}</td>
                  <td className="py-4">{row.refund ? `${row.refund.publicRefundId ?? row.refund.id} · ${row.refund.status} · ${money(row.refund.amountCents)}` : 'None'}</td>
                  <td className="py-4 text-right">
                    <button
                      className="button button-quiet text-xs py-1 px-2.5 inline-flex items-center gap-1"
                      type="button"
                      title="Create ledger reversal or adjustment"
                      onClick={() => {
                        setReversalTarget(row);
                        setReversalAmountRupees((row.grossAmountCents / 100).toFixed(2));
                        setReversalReason('');
                        setReversalError(null);
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Adjust</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}

// ─── Clinics ──────────────────────────────────────────────────────────────────

export function AdminClinicsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.getFinanceClinics>>['clinics'] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);
  const [search, setSearch] = useState('');

  function load(start: string, end: string) {
    setError(null); setRows(null);
    void api.getFinanceClinics(start, end).then((result) => setRows(result.clinics)).catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [range.start, range.end]);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!rows) return <LoadingState label="Loading clinics" />;

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      r.clinic.name.toLowerCase().includes(term) ||
      r.clinic.id.toLowerCase().includes(term) ||
      (r.clinic.publicClinicId && r.clinic.publicClinicId.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      <PageHeader
        eyebrow="Clinics"
        title="Clinic financial accounts"
        lead="Online and cash directions remain separate. Clinic detail uses the exact DoctorClinic attribution from each appointment."
        range={range}
        onRangeChange={handleRangeChange}
        onRefresh={() => load(range.start, range.end)}
      />

      <div className="surface mt-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            className="field pl-9"
            placeholder="Search clinic by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0
        ? <div className="mt-6"><EmptyState title="No clinic data" message="No clinics found matching your current criteria in this date range." /></div>
        : <div className="mt-6 grid gap-4">
          {filtered.map((row) => (
            <section className="surface" key={row.clinic.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="section-title">{row.clinic.name}</h2>
                  <p className="text-sm text-slate-500">{row.clinic.publicClinicId} · {row.clinic.id}</p>
                </div>
                <Link className="button button-primary" to={`/admin/clinics/${row.clinic.id}`}>Open clinic</Link>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Online gross" value={money(row.report.online.grossCents)} />
                <Metric label="Online clinic payable" value={money(row.report.online.clinicPayableCents)} />
                <Metric label="Cash collected" value={money(row.report.offline.collectedCents)} />
                <Metric label="Cash commission outstanding" value={money(row.report.offline.outstandingCommissionCents)} />
              </div>
            </section>
          ))}
        </div>
      }
    </div>
  );
}

// ─── Clinic Detail ────────────────────────────────────────────────────────────

export function AdminClinicDetailPage() {
  const { clinicId } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getFinanceClinicReport>>['report'] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);

  function load(start: string, end: string) {
    setError(null); setData(null);
    if (clinicId) void api.getFinanceClinicReport(clinicId, start, end).then((result) => setData(result.report)).catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [clinicId, range.start, range.end]);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!data) return <LoadingState label="Loading clinic account" />;

  return (
    <div>
      <Link className="back-link" to="/admin/clinics">Back to clinics</Link>
      <div className="mt-6">
        <PageHeader
          eyebrow="Clinic detail"
          title="Financial account"
          range={range}
          onRangeChange={handleRangeChange}
          onRefresh={() => load(range.start, range.end)}
        />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Online gross" value={money(data.online.grossCents)} />
        <Metric label="Online commission" value={money(data.online.commissionCents)} />
        <Metric label="Clinic entitlement" value={money(data.online.clinicPayableCents)} />
        <Metric label="Cash collected" value={money(data.offline.collectedCents)} />
        <Metric label="Cash commission due" value={money(data.offline.commissionReceivableCents)} />
        <Metric label="Settled commission" value={money(data.offline.settledCommissionCents ?? 0)} />
        <Metric label="Outstanding commission" value={money(data.offline.outstandingCommissionCents ?? 0)} />
      </div>
      <section className="surface mt-6">
        <h2 className="section-title">Doctor-wise contribution</h2>
        {data.doctors.length === 0
          ? <div className="mt-4"><EmptyState title="No doctor data" message="No doctor-attributed entries in this period." /></div>
          : <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3">Doctor</th>
                  <th className="pb-3">Online gross</th>
                  <th className="pb-3">Online commission</th>
                  <th className="pb-3">Clinic payable</th>
                  <th className="pb-3">Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.doctors.map((doctor) => (
                  <tr key={doctor.doctor.id}>
                    <td className="py-4">{doctor.doctor.fullName}<div className="text-xs text-slate-500">{doctor.doctor.publicDoctorId ?? doctor.doctor.id}</div></td>
                    <td className="py-4">{money(doctor.onlineGrossCents)}</td>
                    <td className="py-4">{money(doctor.onlineCommissionCents)}</td>
                    <td className="py-4">{money(doctor.clinicPayableCents)}</td>
                    <td className="py-4">{money(doctor.offlineCollectedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  );
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export function AdminSettlementsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.getFinanceSettlements>>['settlements'] | null>(null);
  const [clinics, setClinics] = useState<Awaited<ReturnType<typeof api.getFinanceClinics>>['clinics'] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);
  const [statusFilter, setStatusFilter] = useState('all');

  // Generate settlement form
  const [showGenerate, setShowGenerate] = useState(false);
  const [genClinicId, setGenClinicId] = useState('');
  const [genStart, setGenStart] = useState(toLocalDateValue(todayRange().start));
  const [genEnd, setGenEnd] = useState(toLocalDateValue(todayRange().end));
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<unknown>(null);
  const [genSuccess, setGenSuccess] = useState('');

  // Complete settlement form
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeRef, setCompleteRef] = useState('');
  const [completeNote, setCompleteNote] = useState('');
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeError, setCompleteError] = useState<unknown>(null);

  function load(start: string, end: string) {
    setError(null); setRows(null);
    void api.getFinanceSettlements(start, end).then((result) => setRows(result.settlements)).catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [range.start, range.end]);
  useEffect(() => {
    void api.getFinanceClinics(todayRange().start, todayRange().end).then((r) => setClinics(r.clinics)).catch(() => undefined);
  }, []);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setGenBusy(true); setGenError(null); setGenSuccess('');
    try {
      const start = fromLocalDateValue(genStart, false);
      const end = fromLocalDateValue(genEnd, true);
      if (!start || !end) { setGenError(new Error('Invalid dates')); return; }
      const result = await api.generateSettlement(genClinicId, start, end);
      setGenSuccess(`Settlement ${result.settlement.settlementId} created — status: ${result.settlement.status}`);
      setShowGenerate(false);
      load(range.start, range.end);
    } catch (err) { setGenError(err); }
    finally { setGenBusy(false); }
  };

  const handleComplete = async (e: FormEvent, settlementId: string) => {
    e.preventDefault();
    setCompleteBusy(true); setCompleteError(null);
    try {
      await api.completeSettlement(settlementId, completeRef, completeNote);
      setCompletingId(null); setCompleteRef(''); setCompleteNote('');
      load(range.start, range.end);
    } catch (err) { setCompleteError(err); }
    finally { setCompleteBusy(false); }
  };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!rows) return <LoadingState label="Loading settlements" />;

  const filteredRows = rows.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Settlements"
          title="Clinic settlement batches"
          lead="Internal settlement accounting is separate from external money movement. Completed requires an authoritative external reference."
          range={range}
          onRangeChange={handleRangeChange}
          onRefresh={() => load(range.start, range.end)}
        />
        <button
          className="button button-primary mt-6"
          type="button"
          onClick={() => { setShowGenerate((v) => !v); setGenError(null); setGenSuccess(''); }}
        >
          {showGenerate ? 'Cancel' : 'Generate settlement'}
        </button>
      </div>

      {genSuccess ? <div className="mt-4"><SuccessMessage>{genSuccess}</SuccessMessage></div> : null}

      {showGenerate && (
        <section className="surface mt-6 border-2 border-teal-300">
          <h2 className="section-title">Generate new settlement</h2>
          <p className="mt-1 text-sm text-slate-500">Calculate online gross, commission, and clinic payable for a specific clinic and period.</p>
          <form className="mt-5 space-y-4" onSubmit={handleGenerate}>
            {genError ? <ApiErrorState error={genError} /> : null}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Clinic</label>
              <select className="field" required value={genClinicId} onChange={(e) => setGenClinicId(e.target.value)}>
                <option value="">Select a clinic…</option>
                {clinics?.map((c) => <option key={c.clinic.id} value={c.clinic.id}>{c.clinic.name}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Period start" type="date" value={genStart} onChange={(e) => setGenStart(e.target.value)} required />
              <Field label="Period end" type="date" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} required />
            </div>
            <Button disabled={genBusy || !genClinicId}>{genBusy ? 'Generating…' : 'Generate settlement batch'}</Button>
          </form>
        </section>
      )}

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[['all', 'All'], ['pending', 'Pending'], ['completed', 'Completed'], ['draft', 'Draft']].map(([val, label]) => (
          <button
            key={val}
            className={statusFilter === val ? 'button button-primary' : 'button button-quiet'}
            type="button"
            onClick={() => setStatusFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredRows.length === 0
        ? <div className="mt-6"><EmptyState title="No settlements found" message="No settlement batches match your selected criteria." /></div>
        : <div className="mt-6 space-y-3">
          {filteredRows.map((row) => (
            <section className="surface" key={row.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="section-title">{row.settlementId}</h2>
                  <p className="text-sm text-slate-500">
                    {row.clinic.name}
                    {row.publicSettlementId ? ` · ${row.publicSettlementId}` : ''} · {new Date(row.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={row.status === 'completed' ? 'status status-success' : row.status === 'pending' ? 'status status-warning' : 'status'}>
                    {row.status}
                  </span>
                  {row.status === 'pending' && completingId !== row.id && (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => { setCompletingId(row.id); setCompleteError(null); setCompleteRef(''); setCompleteNote(''); }}
                    >
                      Mark as completed
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric label="Clinic payable" value={money(row.clinicPayableCents)} />
                <Metric label="Actual settlement amount" value={money(row.finalAmountCents)} />
                <Metric label="External reference" value={row.externalReference ?? 'Not recorded'} />
              </div>
              {completingId === row.id && (
                <form className="mt-5 border-t border-slate-200 pt-5 space-y-4" onSubmit={(e) => void handleComplete(e, row.id)}>
                  <h3 className="font-semibold text-slate-800">Complete settlement with bank reference</h3>
                  {completeError ? <ApiErrorState error={completeError} /> : null}
                  <Field label="External reference (Bank UTR / NEFT / IMPS ref)" value={completeRef} onChange={(e) => setCompleteRef(e.target.value)} required minLength={1} maxLength={200} />
                  <Field label="Internal audit note" value={completeNote} onChange={(e) => setCompleteNote(e.target.value)} required minLength={1} maxLength={1000} />
                  <div className="flex gap-3">
                    <Button disabled={completeBusy}>{completeBusy ? 'Saving…' : 'Confirm completion'}</Button>
                    <button className="button button-quiet" type="button" onClick={() => setCompletingId(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </section>
          ))}
        </div>
      }
    </div>
  );
}

// ─── Commissions ──────────────────────────────────────────────────────────────

export function AdminCommissionsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getFinanceOverview>>['overview'] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);

  // Commission rate form
  const [showForm, setShowForm] = useState(false);
  const [ratePct, setRatePct] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(toLocalDateValue(new Date().toISOString()));
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [formSuccess, setFormSuccess] = useState('');

  function load(start: string, end: string) {
    setError(null); setData(null);
    void api.getFinanceOverview(start, end).then((result) => setData(result.overview)).catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [range.start, range.end]);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  const handleSetRate = async (e: FormEvent) => {
    e.preventDefault();
    setFormBusy(true); setFormError(null); setFormSuccess('');
    try {
      const pct = parseFloat(ratePct);
      if (isNaN(pct) || pct < 0 || pct > 100) { setFormError(new Error('Rate must be 0–100%')); return; }
      const rateBps = Math.round(pct * 100);
      const effectiveFromIso = fromLocalDateValue(effectiveFrom, false);
      if (!effectiveFromIso) { setFormError(new Error('Invalid effective date')); return; }
      const result = await api.setCommissionRate(rateBps, effectiveFromIso);
      setFormSuccess(`Commission rate updated to ${(result.configuration.rateBps / 100).toFixed(2)}%, effective ${new Date(result.configuration.effectiveFrom).toLocaleDateString('en-IN')}`);
      setShowForm(false);
      load(range.start, range.end);
    } catch (err) { setFormError(err); }
    finally { setFormBusy(false); }
  };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!data) return <LoadingState label="Loading commissions" />;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Commissions"
          title="Commission accounting"
          lead="Commission values are read from finalized ledger snapshots. Historical entries are not recalculated by current configuration."
          range={range}
          onRangeChange={handleRangeChange}
          onRefresh={() => load(range.start, range.end)}
        />
        <button className="button button-primary mt-6" type="button" onClick={() => { setShowForm((v) => !v); setFormError(null); setFormSuccess(''); }}>
          {showForm ? 'Cancel' : 'Set commission rate'}
        </button>
      </div>

      {formSuccess ? <div className="mt-4"><SuccessMessage>{formSuccess}</SuccessMessage></div> : null}

      {showForm && (
        <section className="surface mt-6 border-2 border-teal-300">
          <h2 className="section-title">Update commission rate</h2>
          <p className="mt-1 text-sm text-slate-500">The new rate applies to all ledger entries finalized on or after the effective date. Historical entries are not recalculated.</p>
          <form className="mt-5 space-y-4" onSubmit={handleSetRate}>
            {formError ? <ApiErrorState error={formError} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="New commission rate (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 10"
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
                required
              />
              <Field
                label="Effective from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
            <Button disabled={formBusy}>{formBusy ? 'Updating…' : 'Apply new rate'}</Button>
          </form>
        </section>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Online commission" value={money(data.online.commissionCents)} />
        <Metric label="Cash commission receivable" value={money(data.offline.commissionReceivableCents)} />
        <Metric label="Outstanding cash commission" value={money(data.offline.outstandingCommissionCents)} />
      </div>
    </div>
  );
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export function AdminAuditLogPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.getFinanceAuditLogs>>['auditLogs'] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [range, setRange] = useState(todayRange);
  const [search, setSearch] = useState('');

  function load(start: string, end: string) {
    setError(null); setRows(null);
    void api.getFinanceAuditLogs(start, end).then((result) => setRows(result.auditLogs)).catch(setError);
  }
  useEffect(() => { load(range.start, range.end); }, [range.start, range.end]);

  const handleRangeChange = (start: string, end: string) => { setRange({ start, end }); };

  if (error) return <ApiErrorState error={error} onRetry={() => load(range.start, range.end)} />;
  if (!rows) return <LoadingState label="Loading audit log" />;

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      r.action.toLowerCase().includes(term) ||
      r.entity.toLowerCase().includes(term) ||
      r.entityId.toLowerCase().includes(term) ||
      (r.actorUserId && r.actorUserId.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      <PageHeader
        eyebrow="Audit Log"
        title="Sensitive financial actions"
        range={range}
        onRangeChange={handleRangeChange}
        onRefresh={() => load(range.start, range.end)}
      />

      <div className="surface mt-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            className="field pl-9"
            placeholder="Search action, entity, or actor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0
        ? <div className="mt-6"><EmptyState title="No audit entries" message="No sensitive financial actions recorded matching your current criteria." /></div>
        : <div className="surface mt-6 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Entity</th>
                <th className="pb-3">ID</th>
                <th className="pb-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="py-4">{new Date(row.createdAt).toLocaleString('en-IN')}</td>
                  <td className="py-4">{row.actorUserId ?? 'System'} · {row.role}</td>
                  <td className="py-4 font-semibold">{row.action}</td>
                  <td className="py-4">{row.entity}</td>
                  <td className="py-4 break-all">{row.entityId}</td>
                  <td className="py-4">{row.metadata ? JSON.stringify(row.metadata) : 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}
