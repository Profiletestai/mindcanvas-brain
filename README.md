# mindcanvas-brain
Central part of the MindCanvas platform
## Local Development (MindCanvas)

### Prerequisites
- Node.js (LTS recommended)
- pnpm (preferred) or npm
- Supabase CLI (for local DB + migrations)

### Install
1. Clone the repo
2. Install dependencies:
   - `pnpm install`

### Environment Variables
Create `.env.local` (or `.env`) and add the required variables. Ask Lisa for the current values.

Minimum required (varies by app):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (or `NEXT_PUBLIC_BASE_URL`)
- Email provider keys (if testing email locally)
- Any 3rd party keys used by the project (if applicable)

> Note: Never commit `.env*` files.

---

## Database: Local Copy Options

### Option A : Use Supabase Local (CLI)
This creates a local Postgres + Supabase services and lets you run migrations locally.

1. Install Supabase CLI
2. From repo root:
   - `supabase init` (if not already initialized)
   - `supabase start`
3. Pull schema from the remote Supabase project (if we use schema migrations):
   - `supabase db pull`
4. Apply migrations locally:
   - `supabase db reset` (or run migrations as per repo structure)
5. Seed data (optional):
   - If a seed script exists, run it (ask Lisa if needed)

When complete:
- Local Supabase URL/keys will be printed by the CLI
- Update `.env.local` to point to local values

### Option B: Use Remote DB 
If local cloning is heavy, we can point your local app to the remote Supabase dev project.
- Set `.env.local` to remote `NEXT_PUBLIC_SUPABASE_URL` + keys
- Use RLS-safe accounts/roles as intended

### Notes
- The platform uses Postgres schemas (e.g. `portal`) and RLS.
- Prefer making changes through migrations (SQL files) rather than manual DB edits.
- For production changes: PR + review only (no direct edits).