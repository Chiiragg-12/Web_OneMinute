import type {
  Appointment,
  BookingInput,
  Clinic,
  ConsultationOption,
  Doctor,
  PatientProfile,
  PublicDoctor,
  Tracker,
  UserSummary,
  LocationSignalResult,
  DoctorAppointment,
  DoctorDashboard,
  DoctorNowServing,
  DoctorPricing,
  DoctorProfile,
  DoctorQueueToken,
  ReceptionistAppointment,
  ReceptionistDashboard,
  ReceptionistProfile,
  SubscriptionOverview,
  CareGuardCaredFor,
  CareGuardCaregiver,
  CareGuardDoctorPlan,
  CareGuardExplanation,
  CareGuardFollowUpRow,
  CareGuardInboxThread,
  CareGuardMessage,
  CareGuardPatientThread,
  CareGuardPreviousPlan,
  CareGuardScopes,
  CareGuardStaffThread,
  ClinicMessagingMode,
  CareGuardDose,
  CareGuardFeeling,
  CareGuardCheckInEntry,
  CareGuardHistoryEntry,
  CareGuardPlanDetail,
  CareGuardPlanDraftInput,
  CareGuardPlanSummary,
  CareGuardSafety,
  SubscriptionPlan,
  FamilyMember,
  HealthRecordSummary,
  Prescription,
  CareDiscoveryResult,
} from '../types/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
let onSessionExpired: (() => void) | undefined;
type SessionRole = 'patient' | 'doctor' | 'receptionist' | 'admin';
const roleForPath = (): SessionRole => window.location.pathname.startsWith('/doctor') ? 'doctor' : window.location.pathname.startsWith('/receptionist') ? 'receptionist' : window.location.pathname.startsWith('/admin') ? 'admin' : 'patient';
const accessTokens = new Map<SessionRole, string>();
const tokenGenerations = new Map<SessionRole, number>();
const refreshPromises = new Map<SessionRole, Promise<string>>();
let sessionExpiryNotified = false;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function setAccessToken(token: string | null, role: SessionRole = roleForPath()) {
  if (token) accessTokens.set(role, token); else accessTokens.delete(role);
  tokenGenerations.set(role, (tokenGenerations.get(role) ?? 0) + 1);
  if (token) sessionExpiryNotified = false;
}

export function setSessionExpiredHandler(handler: (() => void) | undefined) {
  onSessionExpired = handler;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? 'Something went wrong');
  }
  return body as T;
}

async function refreshAccessToken(role: SessionRole = roleForPath()): Promise<string> {
  const existing = refreshPromises.get(role);
  if (existing) return existing;
  const pending = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh/${role}`, {
      method: 'POST',
      credentials: 'include',
    });
    const body = await parseResponse<{ accessToken: string }>(response);
    setAccessToken(body.accessToken, role);
    return body.accessToken;
  })().finally(() => {
    refreshPromises.delete(role);
  });
  refreshPromises.set(role, pending);
  return pending;
}

function expireSession(error: unknown, role: SessionRole, generation: number): never {
  if ((tokenGenerations.get(role) ?? 0) !== generation) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Your session has expired');
  }
  setAccessToken(null, role);
  if (!sessionExpiryNotified) {
    sessionExpiryNotified = true;
    onSessionExpired?.();
  }
  if (error instanceof ApiError) throw error;
  throw new ApiError(401, 'Your session has expired');
}

export async function request<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
  const role = roleForPath();
  const generation = tokenGenerations.get(role) ?? 0;
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = accessTokens.get(role);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && canRetry) {
    try {
      if ((tokenGenerations.get(role) ?? 0) === generation) await refreshAccessToken(role);
      return request<T>(path, init, false);
    } catch (error) { expireSession(error, role, generation); }
  }
  return parseResponse<T>(response);
}

async function requestPrivateFile(path: string, canRetry = true): Promise<Blob> {
  const role = roleForPath();
  const generation = tokenGenerations.get(role) ?? 0;
  const headers = new Headers();
  const token = accessTokens.get(role);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' });
  if (response.status === 401 && canRetry) { try { if ((tokenGenerations.get(role) ?? 0) === generation) await refreshAccessToken(role); return requestPrivateFile(path, false); } catch (error) { expireSession(error, role, generation); } }
  if (!response.ok) await parseResponse<never>(response);
  return response.blob();
}

export async function streamTracker(
  appointmentId: string,
  signal: AbortSignal,
  onEvent: () => void,
  canRetry = true,
): Promise<void> {
  const role = roleForPath();
  const generation = tokenGenerations.get(role) ?? 0;
  const headers = new Headers({ Accept: 'text/event-stream' });
  const token = accessTokens.get(role);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}/api/appointments/${appointmentId}/tracker/events`, {
    headers,
    credentials: 'include',
    signal,
  });
  if (response.status === 401 && canRetry) {
    try {
      if ((tokenGenerations.get(role) ?? 0) === generation) await refreshAccessToken(role);
      return streamTracker(appointmentId, signal, onEvent, false);
    } catch (error) { expireSession(error, role, generation); }
  }
  if (!response.ok || !response.body) {
    await parseResponse<never>(response);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const result = await reader.read();
    if (result.done) return;
    buffer += decoder.decode(result.value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      if (frame.split('\n').some((line) => line.startsWith('data: '))) onEvent();
    }
  }
}

export async function streamDoctorQueue(clinicId: string, doctorId: string, mode: string, signal: AbortSignal, onEvent: () => void, canRetry = true): Promise<void> {
  const role = roleForPath();
  const generation = tokenGenerations.get(role) ?? 0;
  const headers = new Headers({ Accept: 'text/event-stream' });
  const token = accessTokens.get(role);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}/api/appointments/queue/${clinicId}/${doctorId}/events?mode=${encodeURIComponent(mode)}`, { headers, credentials: 'include', signal });
  if (response.status === 401 && canRetry) { try { if ((tokenGenerations.get(role) ?? 0) === generation) await refreshAccessToken(role); return streamDoctorQueue(clinicId, doctorId, mode, signal, onEvent, false); } catch (error) { expireSession(error, role, generation); } }
  if (!response.ok || !response.body) { await parseResponse<never>(response); return; }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  while (true) { const result = await reader.read(); if (result.done) return; buffer += decoder.decode(result.value, { stream: true }); const frames = buffer.split('\n\n'); buffer = frames.pop() ?? ''; if (frames.some((frame) => frame.split('\n').some((line) => line.startsWith('data: ')))) onEvent(); }
}

export const api = {
  registerPatient: (input: Record<string, unknown>) => request<{ accessToken: string; user: UserSummary }>('/api/auth/register/patient', { method: 'POST', body: JSON.stringify(input) }),
  registerFirstAdmin: (input: { fullName: string; email: string; password: string; confirmPassword: string }) => request<{ user: UserSummary }>('/api/auth/register/admin/first', { method: 'POST', body: JSON.stringify(input) }),
  registerDoctor: (input: Record<string, unknown>) => request<{ accessToken: string; user: UserSummary }>('/api/auth/register/doctor/public', { method: 'POST', body: JSON.stringify(input) }),
  registerReceptionist: (input: Record<string, unknown>) => request<{ accessToken: string; user: UserSummary }>('/api/auth/register/receptionist/public', { method: 'POST', body: JSON.stringify(input) }),
  googleOnboardReceptionist: (input: Record<string, unknown>) => request<{ accessToken: string; user: UserSummary }>('/api/auth/google/receptionist/onboard', { method: 'POST', body: JSON.stringify(input) }),
  googleLogin: (role: UserSummary['role'], credential: string) => request<{ accessToken: string; user: UserSummary }>(`/api/auth/google/${role}`, { method: 'POST', body: JSON.stringify({ credential }) }),
  login: (input: Record<string, unknown>) => request<{ accessToken: string; user: UserSummary }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }, false),
  refresh: refreshAccessToken,
  logout: (role = roleForPath()) => request<void>(`/api/auth/logout/${role}`, { method: 'POST' }, false),
  getPatient: () => request<{ patient: PatientProfile }>('/api/patients/me'),
  getDoctorProfile: () => request<{ doctor: DoctorProfile }>('/api/doctors/me'),
  getDoctorPublicId: () => request<{ publicDoctorId: string }>('/api/doctors/me/public-id'),
  updateDoctorConsultationModes: (modes: unknown) => request<{ pricing: unknown[] }>('/api/doctors/me/consultation-modes', { method: 'PUT', body: JSON.stringify({ modes }) }),
  createDoctorClinicIntent: (clinicName: string) => request<{ intent: unknown }>('/api/doctors/me/clinic-intent', { method: 'POST', body: JSON.stringify({ clinicName }) }),
  resolveDoctorClinic: (publicClinicId: string) => request<{ clinic: Clinic; membership: { id: string; isActive: boolean; status: string } | null }>(`/api/clinics/public/${encodeURIComponent(publicClinicId)}`),
  linkDoctorClinic: (publicClinicId: string) => request<{ clinic: Clinic; membership: unknown }>('/api/doctors/me/clinics/link', { method: 'POST', body: JSON.stringify({ publicClinicId }) }),
  updateDoctorProfile: (input: Record<string, unknown>) => request<{ doctor: DoctorProfile }>('/api/doctors/me', { method: 'PATCH', body: JSON.stringify(input) }),
  getReceptionistProfile: () => request<{ receptionist: ReceptionistProfile }>('/api/receptionists/me'),
  getSubscription: () => request<SubscriptionOverview>('/api/receptionists/me/subscription'),
  createSubscriptionOrder: (planId: string) => request<{ keyId: string; orderId: string; amount: number; currency: string; plan: SubscriptionPlan }>('/api/receptionists/me/subscription/order', { method: 'POST', body: JSON.stringify({ planId }) }),
  verifySubscriptionPayment: (input: { razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string }) => request<SubscriptionOverview>('/api/receptionists/me/subscription/verify', { method: 'POST', body: JSON.stringify(input) }),
  findReceptionistDoctor: (publicDoctorId: string) => request<{ doctor: import('../types/api').DoctorPublicPreview }>('/api/receptionists/me/doctors/find', { method: 'POST', body: JSON.stringify({ publicDoctorId }) }),
  linkReceptionistDoctor: (publicDoctorId: string) => request<{ membership: unknown }>('/api/receptionists/me/doctors/link', { method: 'POST', body: JSON.stringify({ publicDoctorId }) }),
  listDoctorRequests: () => request<{ requests: { id: string; status: string; doctor: { id: string; publicDoctorId: string | null; fullName: string; specialization: string | null; qualifications: string | null; registrationNumber: string | null } }[] }>('/api/receptionists/me/doctor-requests'),
  approveDoctorRequest: (membershipId: string) => request<{ membership: unknown }>(`/api/receptionists/me/doctor-requests/${membershipId}/approve`, { method: 'POST' }),
  rejectDoctorRequest: (membershipId: string) => request<{ membership: unknown }>(`/api/receptionists/me/doctor-requests/${membershipId}/reject`, { method: 'POST' }),
  createReceptionistDoctor: (input: unknown) => request<{ doctor: import('../types/api').DoctorPublicPreview & { invite?: import('../types/api').DoctorInvite } }>('/api/receptionists/me/doctors', { method: 'POST', body: JSON.stringify(input) }),
  listDoctorsAwaitingLogin: () => request<{ doctors: import('../types/api').DoctorAwaitingLogin[] }>('/api/receptionists/me/doctors/awaiting-login'),
  reissueDoctorInvite: (doctorId: string) => request<{ invite: import('../types/api').DoctorInvite }>(`/api/receptionists/me/doctors/${doctorId}/invite`, { method: 'POST' }),
  claimDoctor: (input: Record<string, unknown>) => request<{ accessToken: string; user: UserSummary }>('/api/auth/doctor/claim', { method: 'POST', body: JSON.stringify(input) }, false),
  changePassword: (input: Record<string, unknown>) => request<{ accessToken: string }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(input) }),
  getReceptionistClinic: () => request<{ clinic: Clinic }>('/api/receptionists/me/clinic'),
  getReceptionistFinance: (start: string, end: string) => request<{ report: { clinicId: string; online: { grossCents: number; commissionCents: number; clinicPayableCents: number }; offline: { collectedCents: number; commissionReceivableCents: number; settledCommissionCents: number; outstandingCommissionCents: number }; doctors: { doctor: { id: string; fullName: string; publicDoctorId: string | null }; onlineGrossCents: number; onlineCommissionCents: number; clinicPayableCents: number; offlineCollectedCents: number; offlineCommissionCents: number }[] } }>(`/api/finance/clinic?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getFinanceOverview: (start: string, end: string) => request<{ overview: { online: { grossCents: number; commissionCents: number; clinicPayableCents: number }; offline: { collectedCents: number; commissionReceivableCents: number; outstandingCommissionCents: number }; entries: number } }>(`/api/finance/overview?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getFinancePayments: (start: string, end: string) => request<{ payments: { id: string; publicLedgerId?: string | null; appointmentId: string; appointment?: { publicAppointmentId?: string | null }; appointmentPayment?: { publicPaymentId?: string | null }; clinic: { id: string; publicClinicId?: string | null; name: string }; doctor: { id: string; fullName: string; publicDoctorId: string | null }; grossAmountCents: number; commissionAmountCents: number; clinicShareCents: number; paymentMethod: string; finalizedAt: string; refund: { id: string; publicRefundId?: string | null; amountCents: number; status: string; razorpayRefundId: string | null } | null }[] }>(`/api/finance/payments?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getFinanceClinics: (start: string, end: string) => request<{ clinics: { clinic: { id: string; publicClinicId: string; name: string }; report: { online: { grossCents: number; commissionCents: number; clinicPayableCents: number }; offline: { collectedCents: number; commissionReceivableCents: number; outstandingCommissionCents: number } } }[] }>(`/api/finance/clinics?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getFinanceSettlements: (start: string, end: string) => request<{ settlements: { id: string; settlementId: string; clinicId: string; clinic: { id: string; name: string }; clinicPayableCents: number; finalAmountCents: number; status: string; externalReference: string | null; createdAt: string; completedAt: string | null }[] }>(`/api/finance/settlements?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getFinanceAuditLogs: (start: string, end: string) => request<{ auditLogs: { id: string; actorUserId: string | null; role: string; action: string; entity: string; entityId: string; metadata: unknown; createdAt: string }[] }>(`/api/finance/audit-logs?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getFinanceClinicReport: (clinicId: string, start: string, end: string) => request<{ report: { clinicId: string; online: { grossCents: number; commissionCents: number; clinicPayableCents: number }; offline: { collectedCents: number; commissionReceivableCents: number }; doctors: { doctor: { id: string; fullName: string; publicDoctorId: string | null }; onlineGrossCents: number; onlineCommissionCents: number; clinicPayableCents: number; offlineCollectedCents: number; offlineCommissionCents: number }[] } }>(`/api/finance/clinics/${clinicId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  getFinanceReconciliation: (start: string, end: string) => request<{ reconciliation: { reconciled: boolean; entriesChecked: number; issueCount: number; issues: { id: string; type: string; explanation: string; severity: 'high' | 'medium' | 'low'; appointmentId: string | null; paymentId: string | null; ledgerId: string | null; clinic: { id: string; name: string } | null; doctor: { id: string; fullName: string; publicDoctorId: string | null } | null; amountCents: number | null; paymentMethod: string | null; razorpay: { orderId: string | null; paymentId: string | null } | null; expected: string; actual: string; eventAt: string | null; recommendedAction: string; historical: boolean }[] } }>(`/api/finance/reconciliation?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  updateReceptionistClinic: (input: Record<string, unknown>) => request<{ clinic: Clinic }>('/api/receptionists/me/clinic', { method: 'PATCH', body: JSON.stringify(input) }),
  getReceptionistDashboard: () => request<{ dashboard: ReceptionistDashboard }>('/api/receptionists/me/dashboard'),
  listReceptionistAppointments: (filter = 'today', doctorId?: string, recipient: 'self' | 'family' = 'self') => request<{ appointments: ReceptionistAppointment[] }>(`/api/receptionists/me/appointments?filter=${encodeURIComponent(filter)}&recipient=${recipient}${doctorId ? `&doctorId=${encodeURIComponent(doctorId)}` : ''}`),
  getReceptionistAppointment: (appointmentId: string) => request<{ appointment: ReceptionistAppointment }>(`/api/receptionists/me/appointments/${appointmentId}`),
  lookupReceptionistPatient: (identifier: { healthId?: string; phone?: string }) => request<{ patient: { id: string; healthId: string; name: string; phone: string | null } }>(`/api/receptionists/me/patients?${identifier.healthId ? `healthId=${encodeURIComponent(identifier.healthId)}` : `phone=${encodeURIComponent(identifier.phone ?? '')}`}`),
  createWalkIn: (input: { requestId: string; doctorId: string; patientHealthId?: string; patientPhone?: string; newPatient?: { fullName: string; phone: string; email?: string; password: string; confirmPassword: string; dob?: string; gender?: string }; paymentMethod: string; consultationReason: string }) => request<{ appointment: ReceptionistAppointment }>('/api/receptionists/me/walk-ins', { method: 'POST', body: JSON.stringify(input) }),
  getDoctorDashboard: (clinicId: string) => request<{ dashboard: DoctorDashboard }>(`/api/doctors/me/clinics/${clinicId}/dashboard`),
  getDoctorCurrentPatient: (clinicId: string) => request<{ appointment: DoctorAppointment | null }>(`/api/doctors/me/clinics/${clinicId}/current-patient`),
  listDoctorAppointments: (clinicId: string, filter = 'today') => request<{ appointments: DoctorAppointment[] }>(`/api/doctors/me/clinics/${clinicId}/appointments?filter=${encodeURIComponent(filter)}`),
  getDoctorAppointment: (clinicId: string, appointmentId: string) => request<{ appointment: DoctorAppointment }>(`/api/doctors/me/clinics/${clinicId}/appointments/${appointmentId}`),
  getDoctorPricing: (clinicId: string) => request<{ pricing: DoctorPricing[] }>(`/api/doctors/me/pricing?clinicId=${encodeURIComponent(clinicId)}`),
  updateDoctorPricing: (input: { clinicId: string; consultationMode: string; durationMinutes: number; priceCents: number }) => request<{ pricing: DoctorPricing }>('/api/doctors/me/pricing', { method: 'PUT', body: JSON.stringify(input) }),
  startDoctorBreak: (clinicId: string, expectedEndAt?: string) => request<{ break: { startedAt: string; expectedEndAt: string | null } }>(`/api/doctors/clinics/${clinicId}/break/start`, { method: 'POST', body: JSON.stringify(expectedEndAt ? { expectedEndAt } : {}) }),
  endDoctorBreak: (clinicId: string) => request<{ break: { endedAt: string | null } }>(`/api/doctors/clinics/${clinicId}/break/end`, { method: 'POST' }),
  getHealthId: () => request<{ healthId: string }>('/api/patients/me/health-id'),
  updatePatient: (input: Record<string, unknown>) => request<{ patient: PatientProfile }>('/api/patients/me', { method: 'PATCH', body: JSON.stringify(input) }),
  listFamilyMembers: () => request<{ familyMembers: FamilyMember[] }>('/api/family/members'),
  createFamilyMember: (input: Record<string, unknown>) => request<{ familyMember: FamilyMember }>('/api/family/members', { method: 'POST', body: JSON.stringify(input) }),
  getFamilyMember: (familyMemberId: string) => request<{ familyMember: FamilyMember }>('/api/family/members/' + familyMemberId),
  updateFamilyMember: (familyMemberId: string, input: Record<string, unknown>) => request<{ familyMember: FamilyMember }>(`/api/family/members/${familyMemberId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  listHealthRecords: (familyMemberId?: string) => request<{ records: HealthRecordSummary[] }>(familyMemberId ? `/api/family/members/${familyMemberId}/records` : '/api/family/records'),
  uploadHealthRecord: (file: File, metadata: { type: string; title?: string; documentDate?: string }, familyMemberId?: string) => { const body = new FormData(); body.append('file', file); Object.entries(metadata).forEach(([key, value]) => { if (value) body.append(key, value); }); return request<{ record: HealthRecordSummary }>(familyMemberId ? `/api/family/members/${familyMemberId}/records` : '/api/family/records', { method: 'POST', body }); },
  openHealthRecord: (recordId: string) => requestPrivateFile(`/api/family/records/${recordId}/file`),
  openDoctorHealthRecord: (appointmentId: string, recordId: string) => requestPrivateFile(`/api/doctors/me/appointments/${appointmentId}/records/${recordId}/file`),
  getDoctorPrescription: (appointmentId: string) => request<{ prescription: Prescription | null }>(`/api/prescriptions/doctor/appointments/${appointmentId}`),
  createDoctorPrescription: (appointmentId: string, file?: File) => { const body = new FormData(); if (file) body.append('file', file); return request<{ prescription: Prescription }>(`/api/prescriptions/doctor/appointments/${appointmentId}`, { method: 'POST', body }); },
  runDoctorPrescriptionOcr: (appointmentId: string) => request<{ prescription: Prescription }>(`/api/prescriptions/doctor/appointments/${appointmentId}/ocr`, { method: 'POST' }),
  saveDoctorPrescription: (appointmentId: string, input: unknown) => request<{ prescription: Prescription }>(`/api/prescriptions/doctor/appointments/${appointmentId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  // CareGuard: patient side
  getCareGuardPlans: () => request<{ plans: CareGuardPlanSummary[]; safety: Pick<CareGuardSafety, 'emergency' | 'selfReported'> }>('/api/careguard/patient/plans'),
  getCareGuardPlan: (planId: string, date?: string) => request<{ plan: CareGuardPlanDetail }>(`/api/careguard/patient/plans/${planId}${date ? `?date=${date}` : ''}`),
  getCareGuardHistory: () => request<{ history: CareGuardHistoryEntry[]; safety: Pick<CareGuardSafety, 'selfReported'> }>('/api/careguard/patient/history'),
  logCareGuardDose: (planId: string, input: { scheduleId: string; scheduledFor: string; status: 'taken' | 'postponed' | 'missed'; snoozeMinutes?: number }) => request<{ dose?: CareGuardDose; notice: string | null }>(`/api/careguard/patient/plans/${planId}/doses`, { method: 'POST', body: JSON.stringify(input) }),
  saveCareGuardCheckIn: (planId: string, input: { feeling: CareGuardFeeling; note?: string | null }) => request<{ checkIn: CareGuardCheckInEntry; message: string; urgent: string | null }>(`/api/careguard/patient/plans/${planId}/check-in`, { method: 'PUT', body: JSON.stringify(input) }),
  setCareGuardSharing: (planId: string, shareWithClinic: boolean) => request<{ shareWithClinic: boolean }>(`/api/careguard/patient/plans/${planId}/sharing`, { method: 'PATCH', body: JSON.stringify({ shareWithClinic }) }),
  // CareGuard: Ask My Clinic (patient)
  getCareGuardMessages: (planId: string) => request<CareGuardPatientThread>(`/api/careguard/patient/plans/${planId}/messages`),
  sendCareGuardMessage: (planId: string, body: string) => request<{ message: CareGuardMessage; urgentWarning: string | null; urgentWarningHi: string | null; responseNote: string | null }>(`/api/careguard/patient/plans/${planId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  // CareGuard: plain-language explanations
  getCareGuardExplanation: (planId: string, lang: 'en' | 'hi', grantId?: string) => request<CareGuardExplanation>(grantId ? `/api/careguard/patient/cared-for/${grantId}/plans/${planId}/explanation?lang=${lang}` : `/api/careguard/patient/plans/${planId}/explanation?lang=${lang}`),
  // CareGuard: Family Care Mode
  getCareGuardCaregivers: () => request<{ caregivers: CareGuardCaregiver[] }>('/api/careguard/patient/caregivers'),
  addCareGuardCaregiver: (input: { healthId: string } & Record<'scopeMedication' | 'scopeAppointments' | 'scopeHealth', boolean>) => request<{ caregiver: CareGuardCaregiver }>('/api/careguard/patient/caregivers', { method: 'POST', body: JSON.stringify(input) }),
  updateCareGuardCaregiver: (grantId: string, input: Record<'scopeMedication' | 'scopeAppointments' | 'scopeHealth', boolean>) => request<{ caregiver: CareGuardCaregiver }>(`/api/careguard/patient/caregivers/${grantId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  revokeCareGuardCaregiver: (grantId: string) => request<{ revoked: boolean }>(`/api/careguard/patient/caregivers/${grantId}`, { method: 'DELETE' }),
  getCareGuardCaredFor: () => request<{ people: CareGuardCaredFor[] }>('/api/careguard/patient/cared-for'),
  leaveCareGuardCaredFor: (grantId: string) => request<{ left: boolean }>(`/api/careguard/patient/cared-for/${grantId}`, { method: 'DELETE' }),
  getCareGuardCaredForPlans: (grantId: string) => request<{ person: { id: string; name: string; scopes: CareGuardScopes }; plans: CareGuardPlanSummary[] }>(`/api/careguard/patient/cared-for/${grantId}/plans`),
  getCareGuardCaredForPlan: (grantId: string, planId: string) => request<{ plan: CareGuardPlanDetail }>(`/api/careguard/patient/cared-for/${grantId}/plans/${planId}`),
  logCareGuardCaredForDose: (grantId: string, planId: string, input: { scheduleId: string; scheduledFor: string; status: 'taken' | 'postponed' | 'missed' }) => request<{ dose?: CareGuardDose; notice: string | null }>(`/api/careguard/patient/cared-for/${grantId}/plans/${planId}/doses`, { method: 'POST', body: JSON.stringify(input) }),
  // CareGuard: clinic staff (doctor / receptionist)
  getCareGuardInbox: (role: 'doctor' | 'receptionist') => request<{ threads: CareGuardInboxThread[] }>(`/api/careguard/${role}/threads`),
  getCareGuardStaffThread: (role: 'doctor' | 'receptionist', planId: string) => request<CareGuardStaffThread>(`/api/careguard/${role}/threads/${planId}`),
  replyCareGuardThread: (role: 'doctor' | 'receptionist', planId: string, body: string) => request<{ message: CareGuardMessage }>(`/api/careguard/${role}/threads/${planId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  forwardCareGuardThread: (planId: string) => request<{ forwardedToDoctor: boolean }>(`/api/careguard/receptionist/threads/${planId}/forward`, { method: 'POST' }),
  getCareGuardClinicSettings: () => request<{ messagingMode: ClinicMessagingMode; messagingNote: string | null }>('/api/careguard/receptionist/settings'),
  saveCareGuardClinicSettings: (input: { messagingMode: ClinicMessagingMode; messagingNote: string | null }) => request<{ messagingMode: ClinicMessagingMode; messagingNote: string | null }>('/api/careguard/receptionist/settings', { method: 'PUT', body: JSON.stringify(input) }),
  getCareGuardFollowUps: () => request<{ today: string; followUps: CareGuardFollowUpRow[] }>('/api/careguard/receptionist/followups'),
  getDoctorPreviousCareGuardPlans: (appointmentId: string) => request<{ plans: CareGuardPreviousPlan[] }>(`/api/careguard/doctor/appointments/${appointmentId}/previous-plans`),
  // CareGuard: doctor side
  getDoctorCareGuardPlan: (appointmentId: string) => request<{ plan: CareGuardDoctorPlan | null }>(`/api/careguard/doctor/appointments/${appointmentId}`),
  saveDoctorCareGuardPlan: (appointmentId: string, input: CareGuardPlanDraftInput) => request<{ plan: CareGuardDoctorPlan }>(`/api/careguard/doctor/appointments/${appointmentId}`, { method: 'PUT', body: JSON.stringify(input) }),
  approveDoctorCareGuardPlan: (appointmentId: string) => request<{ plan: CareGuardDoctorPlan }>(`/api/careguard/doctor/appointments/${appointmentId}/approve`, { method: 'POST' }),
  endDoctorCareGuardPlan: (appointmentId: string) => request<{ plan: CareGuardDoctorPlan }>(`/api/careguard/doctor/appointments/${appointmentId}/end`, { method: 'POST' }),
  approveDoctorPrescription: (appointmentId: string) => request<{ prescription: Prescription }>(`/api/prescriptions/doctor/appointments/${appointmentId}/approve`, { method: 'POST' }),
  getPatientPrescription: (appointmentId: string) => request<{ prescription: Prescription }>(`/api/prescriptions/patient/appointments/${appointmentId}`),
  getReceptionistPrescription: (appointmentId: string) => request<{ prescription: Prescription }>(`/api/prescriptions/receptionist/appointments/${appointmentId}`),
  listClinics: () => request<{ clinics: Clinic[] }>('/api/clinics'),
  discoverCare: (filters: { specialty?: string; latitude?: number; longitude?: number; maxDistanceKm?: number; maxPrice?: number; consultationModes?: string[] }) => { const query = new URLSearchParams(); if (filters.specialty) query.set('specialty', filters.specialty); if (filters.latitude !== undefined && filters.longitude !== undefined) { query.set('latitude', String(filters.latitude)); query.set('longitude', String(filters.longitude)); } if (filters.maxDistanceKm) query.set('maxDistanceKm', String(filters.maxDistanceKm)); if (filters.maxPrice) query.set('maxPrice', String(filters.maxPrice)); if (filters.consultationModes?.length) query.set('consultationModes', filters.consultationModes.join(',')); return request<{ results: CareDiscoveryResult[]; specialties: string[] }>(`/api/clinics/discover?${query}`); },
  getClinic: (clinicId: string) => request<{ clinic: Clinic }>(`/api/clinics/${clinicId}`),
  listClinicDoctors: (clinicId: string) => request<{ doctors: Doctor[] }>(`/api/clinics/${clinicId}/doctors`),
  getDoctor: (doctorId: string) => request<{ doctor: PublicDoctor }>(`/api/doctors/${doctorId}`),
  getDoctorOptions: (clinicId: string, doctorId: string) => request<{ doctor: Doctor; clinicId: string; options: ConsultationOption[] }>(`/api/clinics/${clinicId}/doctors/${doctorId}/options`),
  listSlots: (clinicId: string, doctorId: string, date: string) => request<{ slots: string[] }>(`/api/clinics/${clinicId}/doctors/${doctorId}/slots?date=${encodeURIComponent(date)}`),
  createAppointment: (input: BookingInput) => request<{ appointment: Appointment }>('/api/appointments', { method: 'POST', body: JSON.stringify(input) }),
  listAppointments: (recipient: 'self' | 'family' = 'self', history = false) => request<{ appointments: Appointment[] }>(`/api/appointments?recipient=${recipient}${history ? '&history=true' : ''}`),
  getAppointment: (appointmentId: string) => request<{ appointment: Appointment }>(`/api/appointments/${appointmentId}`),
  getPayment: (appointmentId: string) => request<{ payment: Appointment['payment'] }>(`/api/appointments/${appointmentId}/payment`),
  createRazorpayOrder: (appointmentId: string) => request<{ keyId: string; orderId: string | null; amount: number; currency: string; appointmentId: string; payment: Appointment['payment'] }>(`/api/appointments/${appointmentId}/payment/order`, { method: 'POST' }),
  verifyRazorpayPayment: (appointmentId: string, input: { razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string }) => request<{ payment: Appointment['payment'] }>(`/api/appointments/${appointmentId}/payment/verify`, { method: 'POST', body: JSON.stringify(input) }),
  cancelAppointment: (appointmentId: string, reason: string) => request<{ appointment: Appointment }>(`/api/appointments/${appointmentId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getTracker: (appointmentId: string) => request<{ tracker: Tracker }>(`/api/appointments/${appointmentId}/tracker`),
  sendLocationSignal: (appointmentId: string, input: { latitude: number; longitude: number; accuracyMeters?: number }) => request<LocationSignalResult>(`/api/appointments/${appointmentId}/location-signal`, { method: 'POST', body: JSON.stringify(input) }),
  getDoctorQueue: (clinicId: string, doctorId: string, mode: string) => request<{ waiting: DoctorQueueToken[] }>(`/api/appointments/queue/${clinicId}/${doctorId}/waiting?mode=${encodeURIComponent(mode)}`),
  getDoctorNowServing: (clinicId: string, doctorId: string, mode: string) => request<{ nowServing: DoctorNowServing | null }>(`/api/appointments/queue/${clinicId}/${doctorId}/now-serving?mode=${encodeURIComponent(mode)}`),
  startNextConsultation: (clinicId: string, doctorId: string, mode: string) => request<{ token: { id: string; number: number; label: string; status: string } }>(`/api/appointments/queue/${clinicId}/${doctorId}/start-next`, { method: 'POST', body: JSON.stringify({ consultationMode: mode }) }),
  endCurrentConsultation: (clinicId: string, doctorId: string, mode: string, expectedAppointmentId?: string) => request<{ appointment: DoctorAppointment }>(`/api/appointments/queue/${clinicId}/${doctorId}/end-current`, { method: 'POST', body: JSON.stringify({ consultationMode: mode, ...(expectedAppointmentId ? { expectedAppointmentId } : {}) }) }),
  payAtReception: (appointmentId: string, input: { method: 'cash' | 'upi'; actualAmountCents: number; upiReference?: string }) => request<{ payment: ReceptionistAppointment['payment'] }>(`/api/appointments/${appointmentId}/pay-at-reception`, { method: 'POST', body: JSON.stringify(input) }),
  listReceptionistPaymentStatus: (status: 'pending' | 'completed', recipient: 'self' | 'family') => request<{ appointments: ReceptionistAppointment[] }>(`/api/receptionists/me/payment-status?status=${status}&recipient=${recipient}`),
  listReceptionistConsultationStatus: (status: 'pending' | 'in_consultation' | 'completed', recipient: 'self' | 'family') => request<{ appointments: ReceptionistAppointment[] }>(`/api/receptionists/me/consultation-status?status=${status}&recipient=${recipient}`),
  markNoShow: (appointmentId: string) => request<{ appointment: { id: string; status: string } }>(`/api/appointments/${appointmentId}/no-show`, { method: 'POST' }),
  startReceptionistBreak: (clinicId: string, doctorId: string) => request<{ break: unknown }>(`/api/receptionists/clinics/${clinicId}/doctors/${doctorId}/break/start`, { method: 'POST', body: JSON.stringify({}) }),
  endReceptionistBreak: (clinicId: string, doctorId: string) => request<{ break: unknown }>(`/api/receptionists/clinics/${clinicId}/doctors/${doctorId}/break/end`, { method: 'POST' }),
};
