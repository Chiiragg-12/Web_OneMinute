export type BookingStatus = 'awaiting_payment' | 'awaiting_assignment' | 'assigned' | 'en_route_to_pickup' | 'arrived_at_pickup' | 'picked_up' | 'arrived_at_hospital' | 'visit_in_progress' | 'returning_home' | 'dropped_off' | 'completed' | 'expired' | 'unfulfilled' | 'cancelled' | 'no_show';
export interface Companion { id: string; userId: string; fullName: string; phone: string; languages: string[]; serviceAreas: string[]; capabilities: string[]; verificationStatus: 'unsubmitted' | 'pending' | 'approved' | 'rejected'; verifiedUntil: string | null; suspended: boolean; suspensionReason?: string | null }
export interface Point { address: string; latitude: number; longitude: number }
export interface Itinerary { serviceArea: string; familyMemberId?: string; patient: { fullName: string; age: number; assistanceNeeds: string[] }; pickup: Point; destination: Point & { name: string; clinicId?: string }; scheduledAt: string; durationHours: number; emergencyContacts: { fullName: string; phone: string; relationship: string }[] }
export interface Booking { id: string; status: BookingStatus; bookerUserId?: string; companionId?: string | null; companion: Pick<Companion, 'id' | 'fullName' | 'phone' | 'languages' | 'verificationStatus' | 'verifiedUntil' | 'suspended'> | null; scheduledAt: string; reservedUntil?: string; itinerary?: Itinerary; pickup?: Point; destination?: Point & { name: string }; amount?: number; currency?: string; pricingSnapshot?: Pricing; payment?: Payment | null; completedAt?: string | null }
export interface Payment { id: string; bookingId: string; status: string; orderId?: string | null; paymentId?: string | null; paidAt?: string | null; createdAt: string }
export interface Pricing { id: string; active: boolean; serviceArea: string; centerLatitude: number; centerLongitude: number; radiusKm: number; baseAmount: number; hourlyAmount: number; minimumHours: number; maximumHours: number; travelBufferMinutes: number; commissionBps: number; freeCancellationHours: number; lateCancellationBps: number; transportPolicy: string }
export interface Verification { id: string; kind: string; status: string; reviewNote: string | null; createdAt: string }
export interface Availability { id: string; startsAt: string; endsAt: string }
export interface BookingEvent { id: string; type: string; createdAt: string; detail?: Record<string, unknown> }
export interface Tracker { booking: Booking; events: BookingEvent[]; location: { latitude: number; longitude: number; accuracy: number; recordedAt: string } | null; locationStale: boolean; trackingActive: boolean; emergencyPhone: string | null }
export interface Refund { id: string; bookingId: string; amount: number; reason: string; status: string; failureReason?: string | null; providerRefundId?: string | null; createdAt: string }
export interface Payout { id: string; companionId: string; amount: number; status: string; externalReference: string | null; createdAt: string }
export interface Incident { id: string; bookingId: string; message: string; status: string; resolution?: string | null; acknowledgedAt?: string | null; escalationDueAt?: string; escalatedAt?: string | null; createdAt: string }
export interface Complaint { id: string; bookingId: string; message: string; status: string; resolution?: string | null; createdAt: string }
export interface Page<T> { items: T[]; total?: number; page?: number; limit?: number }
export const stages: BookingStatus[] = ['awaiting_payment', 'awaiting_assignment', 'assigned', 'en_route_to_pickup', 'arrived_at_pickup', 'picked_up', 'arrived_at_hospital', 'visit_in_progress', 'returning_home', 'dropped_off', 'completed'];
export const finished = (status: string) => ['completed', 'expired', 'unfulfilled', 'cancelled', 'no_show'].includes(status);
export const statusLabel = (value: string) => value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
export const dateTime = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
