import { ArrowLeft, CheckCircle2, LocateFixed, Radio, RefreshCw, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, streamTracker } from '../api/client';
import type { Appointment, Tracker } from '../types/api';
import { ApiErrorState, Button, EmptyState, LoadingState } from '../components/ui';

const terminalAppointments = new Set(['completed', 'cancelled', 'no_show']);
const terminalTokens = new Set(['completed', 'cancelled', 'skipped']);
const modeLabels: Record<string, string> = { in_person: 'In Person', video: 'Video', audio: 'Audio', chat: 'Chat' };

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function doctorStatusLabel(value: string) {
  if (value === 'available') return 'Available';
  if (value === 'in_consultation') return 'In consultation';
  if (value === 'on_break') return 'On break';
  if (value === 'offline') return 'Not available';
  return statusLabel(value);
}

export function TrackerPage() {
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [locationState, setLocationState] = useState<'needed' | 'checking' | 'granted' | 'denied' | 'unsupported' | 'unavailable'>('needed');
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const streamActiveRef = useRef(false);

  const loadSnapshot = useCallback(async () => {
    if (!appointmentId) return null;
    const result = await api.getTracker(appointmentId);
    if (mountedRef.current) {
      setTracker(result.tracker);
      setLastUpdated(new Date());
    }
    return result.tracker;
  }, [appointmentId]);

  const sendLocation = useCallback(() => {
    if (!appointmentId || !navigator.geolocation) {
      setLocationState('unsupported');
      return;
    }
    setLocationState('checking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current) return;
        void api.sendLocationSignal(appointmentId, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          ...(Number.isFinite(position.coords.accuracy) && position.coords.accuracy > 0 ? { accuracyMeters: position.coords.accuracy } : {}),
        }).then((result) => {
          if (!mountedRef.current) return;
          setLocationState(result.eligible || result.token ? 'granted' : 'granted');
          void loadSnapshot();
        }).catch((nextError) => {
          if (mountedRef.current) setLocationState(nextError instanceof ApiError && nextError.status === 404 ? 'unavailable' : 'unavailable');
        });
      }, (positionError) => {
        if (!mountedRef.current) return;
        setLocationState(positionError.code === 1 ? 'denied' : 'unavailable');
      }, { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 });
  }, [appointmentId, loadSnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    if (!appointmentId) return () => undefined;
    void api.getAppointment(appointmentId).then((result) => {
      if (!mountedRef.current) return;
      setAppointment(result.appointment);
      return loadSnapshot();
    }).catch(setError).finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [appointmentId, loadSnapshot]);

  useEffect(() => {
    if (!appointment || appointment.consultationMode !== 'in_person' || terminalAppointments.has(appointment.status)) return;
    const shouldCollectLocation = !tracker?.ownToken;
    if (shouldCollectLocation) {
      sendLocation();
      heartbeatTimerRef.current = window.setInterval(sendLocation, 60_000);
    }
    return () => { if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current); heartbeatTimerRef.current = null; };
  }, [appointment, tracker?.ownToken, sendLocation]);

  useEffect(() => {
    if (!appointment || tracker?.ownToken || appointment.consultationMode !== 'in_person' || terminalAppointments.has(appointment.status)) return;
    const thresholdAt = new Date(appointment.scheduledStartAt).getTime() - 60 * 60 * 1000;
    if (thresholdAt <= Date.now()) return;
    const delay = Math.min(2_147_000_000, thresholdAt - Date.now() + 250);
    const thresholdTimer = window.setTimeout(() => { void loadSnapshot(); }, delay);
    return () => window.clearTimeout(thresholdTimer);
  }, [appointment, tracker?.ownToken, loadSnapshot]);

  useEffect(() => {
    if (!appointmentId || !tracker || terminalAppointments.has(tracker.appointmentStatus) || terminalTokens.has(tracker.ownToken?.status ?? '')) return;
    let disposed = false;
    const startStream = () => {
      if (disposed || streamActiveRef.current) return;
      streamActiveRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController(); abortRef.current = controller;
      setConnectionState('connecting');
      void streamTracker(appointmentId, controller.signal, () => { void loadSnapshot(); }).then(() => {
        if (!disposed && !controller.signal.aborted) scheduleReconnect();
      }).catch(() => {
        if (!disposed && !controller.signal.aborted) { setConnectionState('polling'); startPolling(); scheduleReconnect(); }
      }).finally(() => { streamActiveRef.current = false; });
      setConnectionState('live');
    };
    const scheduleReconnect = () => {
      if (reconnectTimerRef.current === null && !disposed) reconnectTimerRef.current = window.setTimeout(() => { reconnectTimerRef.current = null; stopPolling(); startStream(); }, 2_000);
    };
    const startPolling = () => {
      if (pollingTimerRef.current === null && !disposed) pollingTimerRef.current = window.setInterval(() => { void loadSnapshot(); }, 15_000);
    };
    const stopPolling = () => { if (pollingTimerRef.current !== null) window.clearInterval(pollingTimerRef.current); pollingTimerRef.current = null; };
    startStream();
    return () => { disposed = true; abortRef.current?.abort(); abortRef.current = null; streamActiveRef.current = false; if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; stopPolling(); };
  }, [appointmentId, tracker, loadSnapshot]);

  if (loading) return <LoadingState label="Loading your live visit" />;
  if (error) return <ApiErrorState error={error} />;
  if (!appointment || !tracker) return <EmptyState title="Tracker unavailable" message="This appointment could not be found." />;
  const terminal = terminalAppointments.has(tracker.appointmentStatus);
  const needsLocation = appointment.consultationMode === 'in_person' && tracker.appointmentStatus === 'booked' && !tracker.ownToken;
  const isServingSelf = tracker.ownToken?.status === 'serving';
  const waitDisplay = tracker.estimatedWaitMinutes === null ? 'Estimated wait unavailable' : `~${tracker.estimatedWaitMinutes} min`;

  return <div><Link className="back-link" to={`/app/appointments/${appointment.id}`}><ArrowLeft size={16} />Appointment detail</Link><div className="mt-6 eyebrow">Live visit</div><h1 className="page-title">{tracker.clinic.name}</h1><p className="page-lead">{tracker.doctor.name} · {modeLabels[tracker.consultationMode] ?? tracker.consultationMode} · {statusLabel(tracker.appointmentStatus)}</p><div className="mt-5 flex flex-wrap gap-2"><span className="tag"><Radio size={14} />{connectionState === 'live' ? 'Live updates' : 'Refreshing automatically'}</span>{lastUpdated && <span className="tag"><RefreshCw size={14} />Updated {lastUpdated.toLocaleTimeString()}</span>}</div>{needsLocation && <LocationPanel state={locationState} onRetry={sendLocation} />}{terminal ? <TerminalPanel status={tracker.appointmentStatus} /> : <><section className="tracker-hero mt-6"><div><p className="label text-teal-200">My token</p><p className="token-number">{tracker.ownToken?.label ?? 'Not issued yet'}</p><p className="mt-2 text-sm text-teal-100/75">{tracker.ownToken ? statusLabel(tracker.ownToken.status) : needsLocation ? 'Waiting for eligibility' : 'Waiting for the clinic'}</p></div><UserRound className="text-teal-800/70" size={110} strokeWidth={1} /></section><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Now serving" value={tracker.nowServing ?? '—'} />{!isServingSelf && <Metric label="Patients ahead" value={String(tracker.patientsAhead)} />}{!isServingSelf && <Metric label="Estimated wait" value={waitDisplay} />}<Metric label="Doctor status" value={doctorStatusLabel(tracker.doctorStatus)} /></div>{!isServingSelf && tracker.estimatedWaitMinutes === null && tracker.doctorStatus === 'on_break' && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Estimated wait unavailable while the doctor is on break.</p>}{isServingSelf && <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900"><CheckCircle2 size={20} /><strong>It is your turn. Please be ready for your consultation.</strong></div>}</>}</div>;
}

function LocationPanel({ state, onRetry }: { state: string; onRetry: () => void }) { const copy = { needed: ['Location needed', 'Allow location access so the clinic can determine whether your visit is eligible for automatic queue entry.'], checking: ['Checking your location', 'Your coordinates are sent only to the appointment endpoint for eligibility checking.'], granted: ['Location checked', 'The clinic is checking your appointment eligibility.'], denied: ['Location access denied', 'Enable location access in your browser settings, then try again.'], unsupported: ['Location is unavailable', 'This browser does not support location access.'], unavailable: ['Could not check location', 'Try again when location services are available.'] }[state as 'needed' | 'checking' | 'granted' | 'denied' | 'unsupported' | 'unavailable']; return <section className="location-panel mt-6"><LocateFixed className="shrink-0 text-teal-700" size={23} /><div className="min-w-0"><h2 className="font-display text-lg font-semibold">{copy[0]}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{copy[1]}</p>{['denied', 'unavailable'].includes(state) && <Button variant="quiet" className="mt-3" onClick={onRetry}>Try location again</Button>}</div></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <section className="metric-card"><p className="label">{label}</p><p className="mt-2 font-display text-xl font-semibold text-slate-950">{value}</p></section>; }
function TerminalPanel({ status }: { status: string }) { return <section className="surface mt-6 text-center"><CheckCircle2 className="mx-auto text-slate-400" size={30} /><h2 className="mt-3 font-display text-xl font-semibold">Visit {statusLabel(status)}</h2><p className="mt-2 text-sm text-slate-500">Live location and queue updates have stopped for this appointment.</p></section>; }
