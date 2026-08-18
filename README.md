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
