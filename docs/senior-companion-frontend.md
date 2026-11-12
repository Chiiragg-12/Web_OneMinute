# Senior Companion frontend

The module uses the existing OneMinute API, authentication and theme. Changes are local on `feature/senior-citizen-companion`; no site has been published.

## Web administration

Sign in as an existing admin and select **Senior Companion** in the sidebar.

| Route | Purpose |
| --- | --- |
| `/admin/companions` | Live operational counts, service enabled state and safety follow-up |
| `/admin/companions/people` | Paginated companion applications and verification filters |
| `/admin/companions/people/:id` | Private evidence downloads, verification decisions/expiry, suspension and service areas |
| `/admin/companions/bookings` | Booking history, status filters and live refresh |
| `/admin/companions/bookings/:id` | Itinerary, current location/freshness, timeline, assignment, refunds, cancellation and supervised handover |
| `/admin/companions/safety` | Emergency acknowledgement, complaint handling and recorded resolutions |
| `/admin/companions/finance` | Payments, refund processing/reconciliation, manual payout reservations and transfer references |
| `/admin/companions/pricing` | Versioned coverage radius, prices, commission and cancellation policy |

Source: `src/features/companions/`. All routes sit inside the existing admin guard and AppShell. API calls and protected downloads use the existing role session and refresh handling. Forms require reasons and confirmation for sensitive financial/safety actions, surface API refusals and prevent duplicate submissions while pending. Tables scroll on narrow screens; forms and panels collapse to a single column.

The API remains authoritative for eligibility, concurrent capacity, legal stage transitions, money and authorization. Assignment sends an offer that the companion must accept. A verification review requires actual identity/background evidence. A completed payout records a bank transfer already performed by operations; clicking a button does not send funds.

## Mobile family journey

From the existing patient home, select **Senior Companion**.

- `/companion-service`: own bookings, shared journeys, history/pagination and service availability.
- `/companion-book`: existing family profile or entered patient, address geocoding/map confirmation, hospital, local date/time, duration, emergency contact and explicit tracking/transport consent.
- Quote review shows server pricing and accepted cancellation rules, expires automatically and is invalidated when form details change. Reserving creates an idempotent booking and opens its details for payment.
- `/companion-visit?id=...`: native Razorpay checkout and server confirmation, secure handover codes, companion contact/verification, active location map/freshness, visit timeline, cancellation/refunds, sharing, emergency contacts and complaints.
- Additional family accounts share their account ID from **Account → Share account ID**. The booker explicitly grants access. Shared viewers see monitoring and assistance, with booker-only codes/payment/sharing controls excluded.

## Mobile companion journey

Sign in or register using the new **Companion** audience. Doctor and patient flows remain separate.

- `/companion-home`: verification state, offers, active/history bookings, profile, earnings and sign-out.
- `/companion-profile`: private PDF/JPEG/PNG evidence uploads, admin review notes and dated availability windows.
- `/companion-journey?id=...`: accept/decline an offer, sequential journey actions, family-code check-in/out, location controls and assistance/support.
- `/companion-earnings`: net completed earnings and payout records.

Notification taps route to the appropriate family or companion screen. The API's current suspension state is included in booking responses and shown to the family.

## Native setup and location behavior

SDK-compatible `expo-task-manager` and `expo-crypto`, plus `react-native-razorpay`, are included in mobile dependencies. Expo location configuration enables background permissions and an Android foreground-service notification. Regenerate an installed development/release build through the project's existing Expo/EAS workflow; Expo Go cannot exercise native checkout or the complete background service.

Location begins only after an active journey starts and the companion grants permission. A module-scope task handles background samples, checks booking access/stage, restores a companion session where needed and retries after transient reconnection failures. If background support/permission is unavailable, the UI explicitly states that the app must stay open. Low-accuracy samples are withheld. Location stops at safe drop-off, completion, pause, logout or a refused/finished booking; permission and network failures remain visible. Family screens distinguish missing/stale location and failed refreshes.

OpenStreetMap provides map tiles/embeds; address lookup uses Expo's device geocoder. Phone dialer and external maps links are user initiated. Patient pickup and hospital pins must be confirmed. Continuous tracking still depends on device permissions, operating-system scheduling, connectivity and keeping the installed app available.

## Configuration and validation

Run the backend migration and configure verified supply, coverage, Razorpay/webhook credentials and staffed emergency assistance before enabling `COMPANION_SERVICE_ENABLED`. Until then, new booking controls show unavailable; existing journeys remain accessible. API setup is documented in `Backend/docs/companion-service-api.md`.

Commands:

```bash
# Web_OneMinute
npm run typecheck
npm run build
npm test
npm run lint

# Moblie_Oneminute
npm run typecheck
npm test -- --runInBand
npm run lint
npx expo export --platform android --output-dir /private/tmp/oneminute-companion-android
```

The mobile repo now has an Expo ESLint configuration and a direct `eslint src` script because Expo CLI's lint wrapper rejected the installed ESLint version on this host. Full mobile lint exposes existing issues in older screens, compiler-readiness rules and icon subpath resolution. Targeted companion lint is clean; these unrelated files were not rewritten to suppress the baseline findings.

Validated with component/API mocks, existing auth/navigation regression tests, TypeScript, the web production build and an Android JavaScript/Hermes export. Browser screenshots, physical-device checkout, background permissions and push delivery were not exercised in this environment. Before release, test an installed iOS/Android build through booking/payment, pickup, hospital, background/foreground transitions, offline recovery, safe drop-off, emergency escalation and payout reconciliation. Provider sandbox/device verification and operational activation remain release work.
