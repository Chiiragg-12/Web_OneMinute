# Senior Citizen Healthcare Companion — implementation plan

Status: backend and frontend implemented on the feature branch; operational activation and installed-device validation remain pending.
Branch in all three repositories: `feature/senior-citizen-companion`.

## 1. Scope and existing integration points

Create a separate Companion Service module integrated with OneMinute accounts, family profiles, clinics, notifications and administration.

Repository review found:

- `Backend`: Express, TypeScript, Prisma/PostgreSQL, Zod request validation, JWT authentication and role middleware. Existing modules use routes, schemas and services, with repositories where needed.
- `Web_OneMinute`: React/Vite, React Router, Tailwind, a shared API client and guarded admin/receptionist dashboards. Patient and doctor web routes currently direct users to the mobile app.
- `Moblie_Oneminute`: Expo/React Native with Expo Router, patient/doctor route groups, family profiles, booking, location utilities and push notification handling.
- Existing appointment APIs provide Razorpay order/verification/refund patterns and SSE live updates. These are reference patterns, not companion endpoints ready for reuse.
- Existing financial ledger and settlements require appointment, clinic and doctor relationships. Companion finance needs its own records rather than dummy appointments or clinic payouts.
- Existing push delivery is best effort, and SSE uses an in-process event emitter. Safety alerts require durable delivery and escalation beyond those mechanisms.

Proposed channel split, following the existing product flow:

| Audience | Interface |
| --- | --- |
| Customer / family | Existing mobile app: booking, payment, tracking, history, complaints |
| Companion | New companion role and route group in the existing mobile app |
| Administrator | New Companion Service area in the existing web admin dashboard |

Customer web booking would be an additional scope change because patient web sign-in is currently blocked. The proposed first release keeps the current channel split.

## 2. Module and data design

Backend module: `Backend/src/modules/companions/`, with separate route, schema, service, repository, pricing, payment, event and worker files as needed. Public API namespace: `/api/companions`.

Add reviewed, additive Prisma migrations for these logical records:

- Companion profile: user, languages, service area, assistance capabilities, verification state, active/suspended state.
- Verification submission/review: private identity documents, background-check evidence, reviewer, decision, reason and expiry.
- Availability: working windows, exceptions, time zone and reserved booking windows including travel buffers.
- Booking: booker, patient/family reference and service snapshot, pickup coordinates/address, destination snapshot, schedule, expected duration, support needs, emergency contacts and assigned companion.
- Quote/pricing configuration: versioned rates, included time, travel/transport policy, approved extras, taxes if applicable, cancellation rules and expiry. Snapshot accepted terms on the booking.
- Booking events/check-ins: immutable timeline, actor, timestamp, transition and confirmation evidence.
- Tracking grants/location samples: authorized family viewers, revocation, limited retention, accuracy and recorded/server timestamps.
- Payments/refunds, companion ledger/payouts and commission snapshots, separate from clinic finance.
- Emergency incidents, complaints, audit history and durable notification/outbox jobs.

Use integer minor currency units. Store timestamps in UTC and display the relevant service time zone. Restrict patient and verification document access by purpose and role.

## 3. Booking and assignment workflow

1. Family selects an existing family member or enters patient details, assistance needs, pickup, destination, date/time and emergency contacts.
2. Server validates service coverage and availability and returns an itemized, expiring quote.
3. Create a booking with a short-lived capacity reservation and initiate online payment. Release expired unpaid reservations.
4. Confirm payment server-side; assign an eligible verified companion through admin assignment or an eligible offer/accept flow.
5. If no companion can be assigned within the configured deadline, notify the family and initiate the applicable refund.
6. Companion travels to pickup, confirms patient handover, assists at the hospital, returns the patient and confirms safe handover at home.
7. Complete the booking, reconcile approved charges, make the companion earnings eligible for payout and allow complaints.

Proposed journey states:

`awaiting_payment → awaiting_assignment → assigned → en_route_to_pickup → arrived_at_pickup → picked_up → arrived_at_hospital → visit_in_progress → returning_home → dropped_off → completed`

Additional controlled outcomes: `expired`, `unfulfilled`, `cancelled`, `no_show`. Payment, verification, refunds, payouts and emergency incidents have separate states.

Enforce legal transitions on the server. Require pickup and drop-off confirmation codes or explicit authorized handover confirmation, with rate limits and expiry. An exceptional admin override requires a reason and audit entry. Do not permit routine cancellation to abandon a patient after pickup; use a supervised incident/handover flow.

Assignment and acceptance must be atomic: recheck current verification, suspension, service area and overlapping reservations at acceptance. Handle companion rejection, cancellation and reassignment with family notification.

## 4. Proposed backend API groups

Exact schemas will follow current validation, error, pagination and authentication conventions. These routes are proposed contracts.

| API group | Proposed endpoints / responsibilities |
| --- | --- |
| Pricing | `POST /quotes`: validate itinerary, eligibility and availability; return price breakdown and terms |
| Customer bookings | `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel` |
| Payments | `POST /bookings/:id/payment/order`, `POST /bookings/:id/payment/verify`, `GET /bookings/:id/payment`; signed provider webhook endpoint |
| Family monitoring | `GET /bookings/:id/tracker`, `GET /bookings/:id/events`; create/list/revoke viewer invitations with booking-scoped access |
| Companion onboarding | Register/login through the existing auth module with the new role; `GET/PATCH /me`, private verification submission and status |
| Companion work | Availability CRUD, eligible offers, assigned bookings, accept/reject, explicit check-in/check-out and journey transition actions |
| Location | `POST /bookings/:id/location`: assigned companion only, active journey only, validated and rate limited |
| Safety and support | Booking-scoped emergency raise/acknowledge/resolve and complaint create/list/detail |
| Admin | `/admin/*`: overview, companion reviews/suspension, assignment/reassignment, pricing, booking oversight, incidents, complaints, refunds, commissions and payout batches |

Check ownership and permissions on every booking, stream, upload and financial operation. Verification approval is admin-only; companions cannot modify their own eligibility. A new companion role also requires updates to auth validation, JWT/session types, login routing, push registration and role tests across clients.

## 5. Frontend plan and existing theme

Web module: `Web_OneMinute/src/features/companions/`. Integrate routes under `/admin/companions/*` and add navigation through the current admin layout.

Reuse `AppShell`, `BrandLogo`, `components/ui.tsx`, `src/api/client.ts`, existing field/button/status/table styles and theme variables in `src/index.css`: teal branding, light backgrounds, white rounded surfaces, DM Sans and Space Grotesk. Keep existing loading, validation, empty, retry and session-expired patterns.

Admin screens:

- Overview: bookings, unassigned work, active journeys, pending reviews and open incidents.
- Companion applications: private document review, background-check evidence, approve/reject/suspend and availability.
- Booking list/detail: filters, event timeline, location freshness, assignment and supervised overrides.
- Pricing/coverage: rates, duration rules, commission and cancellation/refund settings.
- Finance: payment/refund status, earnings, payout batches and reconciliation.
- Complaints and emergency incidents: priority, ownership, acknowledgement, resolution and audit trail.

Mobile customer screens:

- Home entry, service explanation, patient/pickup/destination/schedule form, quote and payment.
- Booking confirmation/detail, companion verification summary, live map and timeline, authorized family sharing and emergency action.
- Booking history, cancellation/refund summary and complaint submission.

Mobile companion screens:

- Registration, document submission and verification status; availability and assigned/eligible work.
- Journey detail with pickup/destination, necessary patient support information, check-in/out, handover confirmation, stage actions and emergency assistance.
- Earnings and payout history.

Reuse mobile `src/ui.tsx` colors, cards, fields, buttons and existing API/session infrastructure. Use large readable text, clear stage labels, accessible controls and explicit confirmation for critical actions.

## 6. Safety, tracking and notifications

- Only currently approved, non-suspended companions can accept/start work. Verification expiry and suspension during an active trip trigger operational review and safe reassignment/handover.
- Real background checks require evidence from an actual review/provider. Uploading identity documents alone never marks a companion verified.
- Allow only the booker, explicitly authorized family viewers, assigned companion and authorized admins to access the relevant booking data. Additional family viewers use authenticated, expiring/revocable grants; no public location URLs.
- Collect location only for the agreed active service window, with consent, configured retention and access logging. Display the last update time and stale/offline state; never imply continuous tracking when updates stop.
- Use the current SSE approach for connected status delivery with reconnect/snapshot recovery and polling fallback. Persist journey events. Multi-instance hosting requires shared event delivery.
- Validate location timestamps, accuracy and plausible movement; flag anomalies for review. Location alone does not prove handover.
- Background location needs device permission and installed-build testing. Permission denial, app termination and connectivity loss must produce visible monitoring gaps and an operational fallback.
- Persist milestone notifications for assignment, pickup, hospital arrival, return, drop-off, cancellation and refund; reuse Expo push delivery with retries and deduplication.
- Emergency action creates a durable incident with last known location, contacts and admin visibility. Acknowledgement deadlines and configured escalation are required; push delivery alone is insufficient. Provide callable emergency/family contacts and an offline fallback.

## 7. Payments, cancellations and payouts

- Extract/reuse provider transport/signature helpers where safe; keep appointment-specific business rules separate.
- Verify provider order, booking reference, captured status, amount, currency and signature on the server. Add signed webhooks, idempotent processing and reconciliation for interrupted clients or delayed payment events.
- Snapshot prices and platform commission at booking. Show transport costs, included hours and any extension policy before payment; obtain approval for extra charges.
- Calculate cancellation/refund eligibility on the server. Track requested, processing, successful and failed refunds separately, including retries and partial refunds.
- Calculate companion earnings from reconciled payments and approved adjustments. Hold disputed earnings according to the agreed policy; prevent duplicate or excessive payouts.
- First release proposal: admin-reviewed payout batches with bank-transfer references and reconciliation. Automated payouts need a separately configured payout provider and beneficiary onboarding; Razorpay checkout credentials alone do not supply this.

## 8. Delivery order and acceptance checks

| Phase | Deliverable | Acceptance checks |
| --- | --- | --- |
| 1. Foundation | Schema/migrations, role/auth integration, module skeleton, configuration | Existing roles and login flows continue working; private documents stay private |
| 2. Verification and supply | Companion onboarding, admin review, availability, coverage | Unverified/suspended companions cannot accept; concurrent assignments cannot overlap |
| 3. Booking and payment | Patient forms, quotes, reservations, payment confirmation, assignment | Full mobile-to-API booking; server owns pricing; retries cannot duplicate charges/bookings |
| 4. Journey and safety | Check-in/out, tracking, family permissions, notifications and incidents | Authorized family follows the whole trip; invalid transitions fail; offline/stale states and emergency escalation work |
| 5. Finance and support | Cancellation/refunds, commission, payouts and complaints | Refund/payment races reconcile; payout totals balance; disputes and audit history are visible |
| 6. Release validation | Documentation, test data, device/provider sandbox validation and controlled rollout | End-to-end happy path plus failure paths pass before production enablement |

Testing: backend unit/API/PostgreSQL integration coverage for authorization, verification, concurrency, transitions and money; web/mobile interaction tests for critical flows. Run existing regression tests, type checks, web lint/build and applicable mobile checks. Test location and push on installed iOS/Android builds, payment/refund callbacks in provider test mode, and a migration on a disposable database.

Release behind a Companion Service feature flag and enabled service areas. Keep it disabled until verified supply, staffed emergency handling and payment/refund operations are ready. Update READMEs, API docs and environment examples. Production publishing, real transfers and deployment are separate actions.

## 9. Business decisions to settle before the dependent implementation

Proposed defaults for approval:

- Keep family booking in mobile and admin operations on web; companion uses the same mobile app with a new role.
- Begin with one configured service area, configurable duration-based pricing and admin assignment plus verified companion acceptance.
- Treat this as an accompaniment service. Vehicle provision, transport booking, fares, mobility equipment and clinical assistance need an explicit service policy.
- Use admin-reviewed identity/background evidence initially; select an automated verification provider later if required.
- Use Razorpay for customer payment and admin-reviewed payout batches initially.

Still to supply/configure: launch area, prices and included hours, travel/transport responsibility, extension charges, commission, cancellation/refund/no-show rules, verification requirements and expiry, payout schedule, map/geocoding provider, family tracking retention and staffed emergency escalation contacts/hours.

Provider credentials and operational decisions can be represented by configuration and test adapters during development. Live verification, continuous tracking, automated payouts and staffed emergency response must not be represented as operational before they are actually connected and validated.

## Implementation progress

Backend APIs and additive migration are implemented in `Backend`. Web administration and mobile customer/companion screens are implemented on the feature branch. See [frontend implementation and validation](senior-companion-frontend.md) for delivered routes, configuration and testing. Installed-device/provider verification, operational configuration and production activation remain pending; no deployment has been performed.
