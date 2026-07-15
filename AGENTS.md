# church-connect-portal

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Next.js production build |
| `npm run lint` | ESLint v10 flat config on all .js/.jsx |
| `npm start` | Next.js production server |

No test, typecheck, or format commands exist.

## Architecture

- **React 19 + Next.js 16 (App Router)** with `'use client'` throughout — no server components, no API routes.
- **Supabase** client at `src/lib/supabase.js` using `import.meta.env.VITE_SUPABASE_*` env vars. Schema in `supabase/schema.sql`.
- **No TypeScript.** All `.js`/`.jsx`.
- CSS is hand-written in `src/App.css` (667 lines). No CSS framework.

## Key facts

- **No test infrastructure** — zero test files or frameworks.
- **No CI/CD** — no `.github/workflows/`, no pre-commit hooks.
- **No formatter config** — no Prettier, no EditorConfig.
- **`src/App.jsx`** is the main component (follow-up & attendance views). Entry via `app/page.js` → `src/App.jsx`.
- **Supabase schema** (`supabase/schema.sql`): tables for `service_codes`, `attendance_records`, `follow_up_people`, `follow_up_assignments`, `follow_up_updates`. RLS enabled. Function `record_attendance()`.
- **Attendance** submits via `supabase.rpc('record_attendance', ...)`. **Follow-up** uses `localStorage` keys `cc-people` and `cc-team`.
- `.env` contains live Supabase credentials (committed to git — handle with care).

## Pitfalls

- `eslint.config.js` uses ESLint v10 **flat config** format. Do not add `.eslintrc.*`. Ignores `dist` and `.next` — if you add a new build output dir, add it to `globalIgnores()`.
- `import.meta.env` is used for env vars (Vite-style). Next.js rewrites these at build time.
- No `next.config.js` — Next.js runs with defaults.
- `.gitignore` must list `.next` — Next.js build artifacts are tracked otherwise.
