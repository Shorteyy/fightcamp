# Fight Camp

A kickboxing training planner: schedule trainings, track weight goals, and log nutrition & calories.

## Stack

Vite + React + TypeScript frontend, backed by Supabase (Postgres + Auth). The original [Claude Design](https://claude.ai) mockup this app is based on is kept for reference in [`design-reference/`](design-reference/) — it's not used at runtime.

## Development

1. Copy `.env.example` to `.env` and fill in your Supabase project's URL and anon key (Project Settings → API in the Supabase dashboard).
2. Install dependencies:
   ```
   npm install
   ```
3. Run the dev server:
   ```
   npm run dev
   ```

## Other scripts

- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally
- `npm run lint` — lint the codebase

## Supabase Edge Functions

Some features (deleting a user's auth account, AI meal plan generation, AI calorie estimation) need secrets — the Supabase `service_role` key and the Gemini API key — that must never reach the frontend bundle. Those live server-side as [Supabase Edge Functions](https://supabase.com/docs/guides/functions) (Deno runtime), in `supabase/functions/`.

### One-time setup

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Log in / link locally using values from `.env` (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`):
   ```
   supabase link --project-ref $SUPABASE_PROJECT_REF
   ```
   Schema migrations (`supabase db push`) only need `SUPABASE_DB_PASSWORD` (via `--db-url`). Deploying functions or setting secrets additionally needs `SUPABASE_ACCESS_TOKEN` — a Supabase **Personal Access Token** (Account → Access Tokens in the dashboard), since those go through the Management API rather than a direct DB connection.

### Working on a function

- Function code lives in `supabase/functions/<name>/index.ts`; shared helpers (CORS, the Gemini API wrapper) are in `supabase/functions/_shared/`.
- Run locally: `supabase functions serve <name> --env-file .env` (the local emulator injects `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` automatically; add any other secrets, e.g. `GEMINI_API_KEY`, to `.env`).
- Deploy: `supabase functions deploy <name> --project-ref $SUPABASE_PROJECT_REF`.
- Set a secret the function reads at runtime (e.g. the Gemini key): `supabase secrets set GEMINI_API_KEY=... --project-ref $SUPABASE_PROJECT_REF`. Secrets are account/project-scoped, not per-function, and never appear in frontend code or the git history.
- The frontend calls a deployed function with `supabase.functions.invoke('<name>', { body: {...} })`, which automatically forwards the signed-in user's auth token — functions verify identity/role server-side before doing anything privileged.

### Current functions

- `delete-user` — coach-only; deletes a person's Supabase Auth account (and everything that cascades from it) via the admin API.
- `estimate-nutrition` — any authenticated user; estimates calories/macros for one or more food descriptions via Gemini.
- `generate-mealplan` — any authenticated user; generates a full weekly meal plan (from a calorie target or a weight goal, respecting dietary restrictions) via Gemini.
