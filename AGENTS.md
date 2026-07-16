# AI Agent Instructions for Church Connect Portal

## Critical Guardrails (Read Before Doing Anything)
- DO NOT add TypeScript. Keep all new files as `.js` or `.jsx`.
- DO NOT install tailwind, bootstrap, or any CSS framework. Modify `src/App.css` directly for styles.
- DO NOT add any testing frameworks, Prettier configs, or GitHub actions.
- SECURITY: Live Supabase credentials are in `.env` and committed to git. DO NOT hardcode these values anywhere else, and do not print them in terminal logs.

## Environment Variables Configuration
- This project uses Vite-style environment variables inside Next.js (`import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`).
- DO NOT use `process.env`. Next.js rewrites the `import.meta.env` syntax at build time.

## Project Commands
- Local Dev: `npm run dev`
- Production Build Check: `npm run build`
- Linter: `npm run lint` (Uses ESLint v10 flat config. Do not create `.eslintrc` files).

## Architecture & Code Map
- Framework: React 19 + Next.js 16 (App Router).
- SPA Paradigm: We use `'use client'` at the top of files. Do not create Server Components or API Routes.
- Main File: Entry point is `app/page.js` which renders `src/App.jsx`. Most views (attendance/follow-up) live in `src/App.jsx`.
- Styles: Hand-written CSS lives entirely in `src/App.css`.
- Database: Supabase client is initialized at `src/lib/supabase.js`. Database schema reference is in `supabase/schema.sql`.
- State Management: Attendance is handled via Supabase RPC (`record_attendance`). Follow-up caching relies on `localStorage` keys `cc-people` and `cc-team`.

## Validation Step
- After writing code, you MUST run `npm run lint` and `npm run build` in your VM. 
- Do not submit a Pull Request if the Next.js build fails or if ESLint throws errors.
