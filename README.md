# OneMinute website (reception and admin)

React 19, Vite, Tailwind 4, React Router 7. For **clinic reception teams and administrators** only. Patients and doctors use the mobile app in `../mobile`; both talk to the backend in `../backend`.

## Start

```bash
cd web
npm install
cp .env.example .env     # set VITE_API_BASE_URL (empty = same origin as the backend)
npm run dev              # http://localhost:5173
```

The backend (`cd ../backend && npm run dev`, port 4000) must be running. Sign in with the demo accounts from the root `README.md`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | type-check and build to `dist/` (the backend serves it in production) |
| `npm test` | Vitest |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | oxlint |

## Environment (`.env`)

`VITE_API_BASE_URL` (backend origin), `VITE_PLAY_STORE_URL` and `VITE_APP_STORE_URL` (install buttons on `/get-the-app`).

## Routes

| Path | Page |
|---|---|
| `/` | landing page |
| `/receptionist/login`, `/receptionist/register` | reception sign-in; sign-up creates the clinic |
| `/receptionist/*` | queue, appointments, walk-in registration, add doctor and invite codes, plans and CareGuard inbox, finance, status, history |
| `/admin/login`, `/admin/signup` | admin sign-in and sign-up |
| `/admin/*` | clinics, settlement, users |
| `/privacy`, `/terms` | public legal pages |
| `/get-the-app` | shown for old patient and doctor addresses (`/login`, `/register`, `/app/*`, `/doctor/*`) |

## Layout

`src/App.tsx` (routes), `src/pages/` (receptionist, admin, auth, landing, legal), `src/components/` (layouts, nav, CareGuard inbox, invite card, final prescription), `src/api/client.ts` (fetch client, refreshes the session once on 401), `src/auth/AuthContext.tsx` (refuses patient and doctor accounts).

## Notes

Sessions use an httpOnly refresh cookie set by the backend, so the site and API must share a site or have `CORS_ORIGIN` set to the site's exact origin.
