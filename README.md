# OneMinute web (reception and admin)

React 19 + Vite + Tailwind 4. This website is for **clinic reception teams and administrators**. Patients and doctors use the mobile app in `../mobile`. Both talk to the same backend in `../backend`.

```
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck
npm run build      # dist/ (the backend serves it in production)
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` (leave it empty to use the same origin as the backend).

Routes: `/receptionist/*` (reception console), `/admin/*` (administration), `/privacy` and `/terms` (public). The old patient and doctor addresses show a "Use the OneMinute app" page.
