export type Role = 'patient' | 'doctor' | 'receptionist' | 'admin';
export type ConsultationMode = 'in_person' | 'video' | 'audio' | 'chat';

export interface UserSummary {
  id: string;
  role: Role;
  email: string | null;
  phone: string | null;
  mustChangePassword?: boolean;
}

export interface DoctorInvite { code: string; expiresAt: string; }
export interface DoctorAwaitingLogin { id: string; publicDoctorId: string | null; fullName: string; invite: { status: 'valid' | 'expired' | 'locked' | 'none'; expiresAt: string | null }; }

export type PatientSex = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface PatientProfile {
  healthId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: PatientSex | null;
  bmi: number | null;
  healthProfileComplete: boolean;
}

export interface Clinic {
  id: string;
  publicClinicId: string;
  name: string;
  address: string | null;
  timezone: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Doctor {
  id: string;
  fullName: string;
  specialization: string | null;
}

export interface CareDiscoveryResult {
  doctor: { id: string; fullName: string; specialization: string | null };
  clinic: { id: string; name: string; address: string | null; timezone: string };
  distanceKm: number | null;
  options: { consultationMode: ConsultationMode; durationMinutes: number; priceCents: number }[];
}

export interface DoctorProfile {
  id: string;
  publicDoctorId: string | null;
  fullName: string;
  specialization: string | null;
  qualifications: string | null;
  registrationNumber: string | null;
  registrationCouncil: string | null;
  designation: string | null;
  dob?: string | null;
  gender?: string | null;
  languages?: string[];
  experienceYears?: number | null;
  bio?: string | null;
  professionalProfileComplete: boolean;
  clinics: { id: string; publicClinicId: string; name: string; address: string | null; isActive: boolean }[];
  membershipStates?: { id: string; clinicId: string; isActive: boolean; status: string; clinic: { id: string; publicClinicId: string; name: string; isActive: boolean } }[];
}

export interface DoctorPublicPreview { publicDoctorId: string | null; fullName: string; specialization: string | null; qualifications: string | null; registrationNumber: string | null; registrationCouncil: string | null; experienceYears?: number | null; bio?: string | null; consultationModes: { consultationMode: ConsultationMode; durationMinutes: number; priceCents: number }[]; }

export interface ClinicTrialSummary {
  status: 'trial' | 'active' | 'expired';
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  subscriptionEndsAt?: string | null;
}

export interface SubscriptionPlan { id: string; label: string; months: number; amountCents: number; }
export interface SubscriptionOverview { plans: SubscriptionPlan[]; currency: string; trial: ClinicTrialSummary; }

export interface ReceptionistProfile {
  id: string;
  fullName: string;
  clinic: { id: string; publicClinicId: string; name: string; address?: string | null; isActive: boolean; trial?: ClinicTrialSummary } | null;
}

export interface ReceptionistDashboard {
  clinic: { id: string; name: string; timezone: string; trial?: ClinicTrialSummary };
  doctors: { doctor: { id: string; fullName: string }; status: string; waitingByMode: Record<string, number>; servingByMode: { consultationMode: ConsultationMode; token: string }[] }[];
  counts: Record<string, number>;
  appointmentCounts: Record<string, number>;
  appointments: ReceptionistAppointment[];
}

export interface ReceptionistAppointment {
  id: string;
  publicAppointmentId?: string | null;
  doctor: { id: string; name: string };
  patient: { id: string; healthId: string; name: string; email?: string | null; phone?: string | null; heightCm: number | null; weightKg: number | null; dob: string | null; sex: PatientSex | null; bmi: number | null };
  bookedBy: { id: string; name: string; healthId: string } | null;
  relationship: string | null;
  scheduledStartAt: string;
  consultationMode: ConsultationMode;
  durationMinutes: number | null;
  consultationReason: string | null;
  checkedInAt?: string | null;
  checkInMethod?: 'receptionist_manual' | null;
  status: string;
  fullyDone?: boolean;
  source?: string;
  payment: { method: string; status: string; amountCents: number; actualAmountCents?: number | null; receptionMethod?: string | null; upiReference?: string | null; paidAt?: string | null; recordedByUserId?: string | null; recordedByName?: string | null; razorpayOrderId?: string | null; razorpayPaymentId?: string | null } | null;
  clinicUpiPaymentInfo?: string | null;
  token: { label: string; status: string } | null;
  completedAt?: string | null;
  healthRecords?: HealthRecordSummary[];
  prescriptionStatus?: 'available' | null;
}

export interface HealthRecordSummary { id: string; publicHealthRecordId?: string | null; type: 'old_prescription' | 'lab_report'; title: string | null; documentDate: string | null; originalFilename: string; }
export interface PrescriptionMedicine { id: string; medicineName: string; strength: string | null; dosage: string | null; route: string | null; frequency: string | null; duration: string | null; instructions: string | null; needsReview: boolean; }
export interface Prescription { id: string; publicPrescriptionId?: string | null; appointmentId: string; status: string; advice: string | null; followUpText: string | null; ocrRawText?: string | null; ocrWarnings?: string[]; approvedAt: string | null; sourceFilename: string | null; sourceAvailable: boolean; medicines: PrescriptionMedicine[]; identity?: { clinicPublicId: string | null; clinicName: string | null; clinicAddress: string | null; doctorName: string | null; doctorQualifications: string | null; doctorSpecialization: string | null; doctorRegistrationNumber: string | null; doctorRegistrationCouncil: string | null; patientName: string | null; patientHealthId?: string | null; bookedByName: string | null; relationship: string | null; patientDob: string | null; patientSex: PatientSex | null }; }

export interface DoctorAppointment {
  id: string;
  publicAppointmentId?: string | null;
  patient: { id: string; healthId: string | null; name: string; dob: string | null; gender: string | null; heightCm: number | null; weightKg: number | null; sex: PatientSex | null; bmi: number | null } | null;
  bookedBy: { id: string; name: string; healthId: string } | null;
  relationship: string | null;
  scheduledStartAt: string;
  status: string;
  consultationMode: ConsultationMode;
  durationMinutes: number | null;
  consultationReason: string | null;
  consultationStartedAt?: string | null;
  estimatedDurationMinutes?: number | null;
  payment: { method: string; status: string; amountCents: number; razorpayOrderId?: string | null; razorpayPaymentId?: string | null } | null;
  token: { label: string; status: string } | null;
  healthRecords?: HealthRecordSummary[];
}

export interface DoctorDashboard {
  doctor: { id: string; fullName: string; specialization: string | null };
  clinic: { id: string; name: string; timezone: string };
  status: string;
  activeBreak: { startedAt: string; expectedEndAt: string | null } | null;
  counts: Record<string, number>;
  appointmentCounts: Record<string, number>;
  waitingByMode: Record<string, number>;
  servingByMode: { consultationMode: ConsultationMode; token: string; appointment: DoctorAppointment }[];
  appointments: DoctorAppointment[];
}

export interface DoctorQueueToken {
  appointmentId: string;
  patient: { id: string; name: string };
  token: { number: number; label: string; status: string };
  position: number;
  estimatedWaitMinutes: number | null;
  recipientType: 'self' | 'family';
  bookedBy: { id: string; name: string } | null;
  relationship: string | null;
  scheduledStartAt: string;
  source?: 'booked' | 'walk_in';
  consultationMode: ConsultationMode;
  durationMinutes: number | null;
  paymentStatus: string | null;
}

export interface DoctorNowServing {
  appointmentId: string;
  patient: { id: string; name: string };
  token: { number: number; label: string; status: string };
}

export interface DoctorPricing {
  id: string;
  consultationMode: ConsultationMode;
  durationMinutes: number;
  priceCents: number;
}

export interface PublicDoctor extends Doctor {
  clinics: Clinic[];
}

export interface ConsultationOption {
  consultationMode: ConsultationMode;
  durationMinutes: number;
  priceCents: number;
}

export interface Appointment {
  id: string;
  publicAppointmentId?: string | null;
  patient?: { id: string; name: string; healthId?: string | null; relationship?: string | null; heightCm?: number | null; weightKg?: number | null; dob?: string | null; sex?: PatientSex | null; bmi?: number | null };
  bookedBy?: { id: string; name: string; healthId: string };
  doctor?: { id: string; name: string };
  clinic?: { id: string; name: string };
  scheduledStartAt: string;
  consultationMode: ConsultationMode;
  durationMinutes: number | null;
  consultationReason?: string | null;
  estimatedDurationMinutes?: number | null;
  completedAt?: string | null;
  status: string;
  source?: string;
  token: { id?: string; number?: number; label: string; status: string } | null;
  payment: { id?: string; publicPaymentId?: string | null; method: string; status: string; amountCents: number } | null;
  refund?: { id: string; publicRefundId?: string | null; amountCents: number; status: string; razorpayRefundId: string | null; failureReason: string | null } | null;
  healthRecords?: HealthRecordSummary[];
}

export interface BookingInput {
  doctorId: string;
  clinicId: string;
  scheduledStartAt: string;
  consultationMode: ConsultationMode;
  durationMinutes?: number;
  consultationReason?: string;
  paymentMethod: 'wallet' | 'upi' | 'razorpay' | 'pay_at_reception';
  familyMemberId?: string;
  healthRecordIds?: string[];
}

export interface FamilyMember { id: string; fullName: string; relationship: string; dob: string | null; heightCm: number | null; weightKg: number | null; sex: PatientSex | null; bmi: number | null; records?: HealthRecordSummary[]; }

export interface Tracker {
  appointmentId: string;
  doctor: { id: string; name: string };
  clinic: { id: string; name: string };
  consultationMode: ConsultationMode;
  ownToken: { label: string; status: string } | null;
  nowServing: string | null;
  patientsAhead: number;
  estimatedWaitMinutes: number | null;
  doctorStatus: string;
  appointmentStatus: string;
}

export interface LocationSignalResult {
  eligible: boolean;
  token: { id: string; number: number; label: string; status: string } | null;
}

// ---- CareGuard (after-visit care plans) ----
export type CareGuardDoseState = 'pending' | 'taken' | 'postponed' | 'missed';
export type CareGuardFeeling = 'better' | 'same' | 'worse';
export interface CareGuardDose { scheduleId: string; medicineName: string; dosageText: string | null; instructionText: string | null; scheduledFor: string; status: CareGuardDoseState; snoozedUntil: string | null; overdue: boolean; }
export interface CareGuardFollowUp { date: string; note: string | null; daysUntil: number; clinicId: string; doctorId: string; }
export interface CareGuardCheckInEntry { date: string; feeling: CareGuardFeeling; note: string | null; recordedAt: string; source: 'patient_reported'; }
export interface CareGuardSchedule { id: string; medicineName: string; dosageText: string | null; instructionText: string | null; timesOfDay: string[]; startDate: string; endDate: string; }
export interface CareGuardSafety { emergency: string; planNotice: string; selfReported: string; missedDose: string; worse: string; same: string; better: string; }
export interface CareGuardPlanSummary { id: string; publicPlanId: string; status: 'approved' | 'ended'; active: boolean; recipientName: string; doctorName: string; clinicName: string; approvedAt: string | null; medicineCount: number; followUp: CareGuardFollowUp | null; today?: { date: string; pendingDoses: number; totalDoses: number }; }
export interface CareGuardScopes { medication: boolean; appointments: boolean; health: boolean; }
export interface CareGuardPlanDetail extends Omit<CareGuardPlanSummary, 'today'> { timezone: string; viewer?: 'owner' | 'caregiver'; scopes?: CareGuardScopes; safetyHi?: CareGuardSafety; explanationsAvailable?: boolean; schedules: CareGuardSchedule[]; checkInsEnabled: boolean; shareWithClinic: boolean | null; today: { date: string; doses: CareGuardDose[]; checkIn: CareGuardCheckInEntry | null }; safety: CareGuardSafety; }
export interface CareGuardAdherence { scheduledSoFar: number; taken: number; postponed: number; missed: number; selfReported: true; }
export interface CareGuardHistoryEntry extends CareGuardPlanSummary { clinicalPlan: { medicines: CareGuardSchedule[]; followUpDate: string | null; followUpNote: string | null }; patientReported: { checkIns: CareGuardCheckInEntry[]; adherence: CareGuardAdherence }; }
export interface CareGuardDoctorSchedule { id: string; prescriptionMedicineId: string | null; medicineName: string; dosageText: string | null; instructionText: string | null; timesOfDay: string[]; startDate: string; endDate: string; }
export interface CareGuardDoctorPlan { id: string; publicPlanId: string; status: 'draft' | 'approved' | 'ended'; timezone: string; checkInsEnabled: boolean; followUpDate: string | null; followUpNote: string | null; approvedAt: string | null; schedules: CareGuardDoctorSchedule[]; sharedWithClinic: boolean; active: boolean; sharedUpdates?: { selfReported: true; checkIns: CareGuardCheckInEntry[]; adherence: CareGuardAdherence } | null; }
export interface CareGuardPlanDraftInput { schedules: { prescriptionMedicineId: string; timesOfDay: string[]; startDate: string; durationDays: number }[]; checkInsEnabled: boolean; followUpDate?: string | null; followUpNote?: string | null; }

export type ClinicMessagingMode = 'off' | 'included' | 'limited' | 'billed';
export interface CareGuardMessage { id: string; from: 'patient' | 'doctor' | 'receptionist'; fromLabel: string; body: string; createdAt: string; flaggedUrgent: boolean; }
export interface CareGuardPatientThread { messaging: { mode: ClinicMessagingMode; enabled: boolean; note: string | null; clinicName: string }; messages: CareGuardMessage[]; safety: { emergency: string; emergencyHi: string }; }
export interface CareGuardInboxThread { planId: string; publicPlanId: string; recipientName: string; doctorName: string; lastMessage: { from: string; preview: string; createdAt: string } | null; lastMessageAt: string; unreadCount: number; urgent: boolean; forwardedToDoctor: boolean; }
export interface CareGuardStaffThread { planId: string; recipientName: string; doctorName: string; forwardedToDoctor: boolean; messages: CareGuardMessage[]; }
export interface CareGuardCaregiver { id: string; personName: string; personHealthId: string; scopes: CareGuardScopes; createdAt: string; }
export interface CareGuardCaredFor { id: string; personName: string; scopes: CareGuardScopes; }
export interface CareGuardExplanation { language: 'en' | 'hi'; aiGenerated: true; model: string; disclaimer: string; items: { scheduleId: string; explanation: string }[]; }
export interface CareGuardFollowUpRow { planId: string; recipientName: string; doctorName: string; followUpDate: string; followUpNote: string | null; status: 'overdue' | 'due_today' | 'upcoming' | 'booked'; bookedFor: string | null; contact: { name: string | null; phone: string | null; email: string | null }; }
export interface CareGuardPreviousPlan { planId: string; publicPlanId: string; status: string; approvedAt: string | null; clinical: { medicines: CareGuardSchedule[]; followUpDate: string | null; followUpNote: string | null }; patientReported: { selfReported: true; checkIns: CareGuardCheckInEntry[]; adherence: CareGuardAdherence } | null; sharedWithClinic: boolean; }
